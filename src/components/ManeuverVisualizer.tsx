'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────
interface TrajectoryPoint {
  t: string;
  position_ecef_km: [number, number, number];
  position_teme_km?: [number, number, number];
}

interface ManeuverVisualizerProps {
  protectedAssetTrajectory: TrajectoryPoint[];
  threatTrajectory: TrajectoryPoint[];
  maneuverTrajectory?: TrajectoryPoint[] | null;
  tcaTime?: string;
  tcaPosition?: [number, number, number];
  safetyRadiusKm?: number;
  burnTime?: string | null;
  planRisk?: "green" | "yellow" | "red";
  onSimulationComplete?: (result: 'success' | 'failed') => void;
}

// ─────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────
const EARTH_RADIUS = 6.371;
const SCALE = EARTH_RADIUS / 6378.137;

const COLORS = {
  protectedPath: 0x00bae2,
  threatPath:    0xff3355,
  maneuverPath:  0x0ae448,
  tcaDanger:     0xff3355,
};

// Billboard text sprite
const createTextSprite = (text: string, color: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(16, 16, 16, 0.85)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 44, 8);
    ctx.fill();
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.6, 0.15, 1.0);
  return sprite;
};

// Voice announcer
const speakTelemetry = (text: string, enabled: boolean) => {
  if (!enabled || typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Zira") || v.name.includes("Microsoft")));
  if (voice) utterance.voice = voice;
  utterance.rate = 1.0;
  utterance.pitch = 0.9;
  window.speechSynthesis.speak(utterance);
};

// ─────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────
const ManeuverVisualizer: React.FC<ManeuverVisualizerProps> = ({
  protectedAssetTrajectory,
  threatTrajectory,
  maneuverTrajectory,
  tcaTime,
  tcaPosition,
  safetyRadiusKm = 0.15,
  burnTime = null,
  planRisk = "green",
  onSimulationComplete,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<any>(null);
  const animationIdRef = useRef<number | null>(null);

  const simIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const hasRevealedRef = useRef(false);

  const [isMounted, setIsMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);

  // Simulation phases: idle → countdown → running → ignition → approaching → reveal
  const [simPhase, setSimPhase] = useState<'idle' | 'countdown' | 'running' | 'ignition' | 'approaching' | 'reveal'>('idle');
  const [countdownNum, setCountdownNum] = useState(5);
  const [liveDistance, setLiveDistance] = useState<string>('—');
  const [progressPct, setProgressPct] = useState(0);
  const [missionResult, setMissionResult] = useState<'success' | 'failed' | null>(null);
  const [revealOpacity, setRevealOpacity] = useState(0);

  useEffect(() => { setIsMounted(true); }, []);

  const hasData = protectedAssetTrajectory.length > 0;

  // ═══════════════════════════════════════════════════
  // FULLSCREEN MANAGEMENT
  // ═══════════════════════════════════════════════════
  const enterFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error('Fullscreen failed:', err);
      });
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      // Resize renderer after layout settles
      setTimeout(() => {
        if (mountRef.current && rendererRef.current && cameraRef.current) {
          const w = mountRef.current.clientWidth;
          const h = mountRef.current.clientHeight;
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }, 150);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // ═══════════════════════════════════════════════════
  // AUTO-START: Enter fullscreen + run countdown
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    if (!isMounted || !hasData) return;

    // Auto-enter fullscreen after a tiny delay for mount
    const timer = setTimeout(() => {
      enterFullscreen();
      setSimPhase('countdown');
      speakTelemetry("Mission simulation initializing. Stand by for trajectory analysis.", speechEnabled);
    }, 600);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, hasData]);

  // Countdown 5..4..3..2..1..GO
  useEffect(() => {
    if (simPhase !== 'countdown') return;
    if (countdownNum <= 0) {
      setSimPhase('running');
      isPlayingRef.current = true;
      simIndexRef.current = 0;
      hasRevealedRef.current = false;
      speakTelemetry("Simulation active. Tracking primary asset and debris trajectories.", speechEnabled);
      return;
    }
    const timer = setTimeout(() => setCountdownNum(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [simPhase, countdownNum, speechEnabled]);

  // ═══════════════════════════════════════════════════
  // COORDINATE HELPERS
  // ═══════════════════════════════════════════════════
  const ecefToThree = useCallback((pos: [number, number, number]) => {
    const [x, y, z] = pos;
    return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
  }, []);

  // ═══════════════════════════════════════════════════
  // BUILD SCENE
  // ═══════════════════════════════════════════════════
  const buildScene = useCallback((scene: THREE.Scene) => {
    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starVerts: number[] = [];
    for (let i = 0; i < 3000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 250 + Math.random() * 250;
      starVerts.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, transparent: true, opacity: 0.35 })));

    // Earth
    const loader = new THREE.TextureLoader();
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 64, 64),
      new THREE.MeshPhongMaterial({
        map: loader.load('/textures/earth_atmos_2048.jpg'),
        normalMap: loader.load('/textures/earth_normal_2048.jpg'),
        specularMap: loader.load('/textures/earth_specular_2048.jpg'),
        specular: new THREE.Color(0x3a6a8a), shininess: 25,
      })
    );
    earth.name = 'earth';
    earth.rotation.y = -Math.PI / 2;
    scene.add(earth);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS + 0.02, 64, 64),
      new THREE.MeshPhongMaterial({ map: loader.load('/textures/earth_clouds_1024.png'), transparent: true, opacity: 0.25, depthWrite: false })
    );
    clouds.name = 'clouds';
    clouds.rotation.y = -Math.PI / 2;
    scene.add(clouds);

    // Atmosphere
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS + 0.12, 32, 32),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec3 vNormal; void main() { float i = pow(0.55 - dot(vNormal, vec3(0,0,1)), 2.8); gl_FragColor = vec4(0.05,0.55,0.95,1.0)*i; }`,
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true,
      })
    ));

    // Lighting
    scene.add(new THREE.AmbientLight(0x0a0e1a, 0.7));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    sun.position.set(100, 30, 80);
    scene.add(sun);

    // ── Orbit Paths ──
    const drawPath = (trajectory: TrajectoryPoint[], color: number, name: string, label: string, labelColor: string, dashed = false) => {
      const pts = trajectory.map(pt => {
        const pos = pt.position_ecef_km || pt.position_teme_km;
        if (!pos || pos.some(isNaN)) return null;
        return ecefToThree(pos);
      }).filter((v): v is THREE.Vector3 => v !== null);
      if (pts.length < 2) return;
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      if (dashed) {
        const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.06, transparent: true, opacity: 0.9 }));
        line.computeLineDistances();
        line.name = name;
        scene.add(line);
      } else {
        scene.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })));
        scene.add(new THREE.Line(geo.clone(), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.12 })));
      }
      if (pts.length > 8) {
        const lbl = createTextSprite(label, labelColor);
        const lp = pts[Math.floor(pts.length / 4)];
        lbl.position.set(lp.x, lp.y + 0.12, lp.z);
        scene.add(lbl);
      }
    };

    drawPath(protectedAssetTrajectory, COLORS.protectedPath, 'protected-path', 'NOMINAL PATH', '#00bae2');
    drawPath(threatTrajectory, COLORS.threatPath, 'threat-path', 'DEBRIS PATH', '#ff3355');
    if (maneuverTrajectory && maneuverTrajectory.length > 0) {
      drawPath(maneuverTrajectory, COLORS.maneuverPath, 'maneuver-path', 'DEFLECTED PATH', '#0ae448', true);
    }

    // ── TCA Danger Zone ──
    if (tcaPosition) {
      const tcaPos = ecefToThree(tcaPosition);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), new THREE.MeshBasicMaterial({ color: COLORS.tcaDanger }));
      marker.position.copy(tcaPos);
      marker.name = 'tca-marker';
      scene.add(marker);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), new THREE.MeshBasicMaterial({ color: COLORS.tcaDanger, transparent: true, opacity: 0.08 }));
      glow.position.copy(tcaPos);
      glow.name = 'tca-glow';
      scene.add(glow);
      const radius = Math.max(0.0015, (safetyRadiusKm || 0.15) * SCALE);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 32), new THREE.MeshBasicMaterial({ color: COLORS.tcaDanger, transparent: true, opacity: 0.1, wireframe: true }));
      sphere.position.copy(tcaPos);
      scene.add(sphere);
      const tcaLabel = createTextSprite("TCA IMPACT ZONE", "#ff3355");
      tcaLabel.position.set(tcaPos.x, tcaPos.y + 0.18, tcaPos.z);
      scene.add(tcaLabel);
    }

    // ── Satellite ──
    const satGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8), new THREE.MeshPhongMaterial({ color: 0xe5a93b, emissive: 0x3a2400, shininess: 60 }));
    body.rotation.x = Math.PI / 2;
    satGroup.add(body);
    const panelMat = new THREE.MeshPhongMaterial({ color: 0x1d4ed8, emissive: 0x001133, shininess: 80 });
    const lp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.06), panelMat);
    lp.position.set(-0.12, 0, 0);
    satGroup.add(lp);
    const rp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.06), panelMat);
    rp.position.set(0.12, 0, 0);
    satGroup.add(rp);
    satGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: COLORS.protectedPath })));

    // Thruster plume (hidden)
    const plume = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, 0.12, 8),
      new THREE.MeshBasicMaterial({ color: 0x0ae448, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
    );
    plume.rotation.x = -Math.PI / 2;
    plume.position.set(0, 0, 0.08);
    plume.name = 'thruster-plume';
    plume.visible = false;
    satGroup.add(plume);

    const satLabel = createTextSprite("PRIMARY ASSET", "#00bae2");
    satLabel.position.set(0, 0.18, 0);
    satGroup.add(satLabel);
    satGroup.name = 'protected-asset-mesh';
    scene.add(satGroup);

    // Debris
    const threatMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09, 0),
      new THREE.MeshPhongMaterial({ color: COLORS.threatPath, emissive: 0x550011, emissiveIntensity: 0.6 })
    );
    threatMesh.name = 'threat-mesh';
    const tLabel = createTextSprite("THREAT DEBRIS", "#ff3355");
    tLabel.position.set(0, 0.18, 0);
    threatMesh.add(tLabel);
    scene.add(threatMesh);

    if (tcaPosition) return ecefToThree(tcaPosition);
    if (protectedAssetTrajectory.length > 0) {
      const pos = protectedAssetTrajectory[0].position_ecef_km || protectedAssetTrajectory[0].position_teme_km;
      if (pos) return ecefToThree(pos);
    }
    return null;
  }, [protectedAssetTrajectory, threatTrajectory, maneuverTrajectory, tcaPosition, safetyRadiusKm, ecefToThree]);

  // ═══════════════════════════════════════════════════
  // MAIN SCENE SETUP
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    if (!isMounted || !mountRef.current || !hasData) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = 0.5;
      controls.maxDistance = 60;
      controlsRef.current = controls;

      const focusPoint = buildScene(scene);
      if (focusPoint) {
        controls.target.copy(focusPoint);
        camera.position.set(focusPoint.x + 8, focusPoint.y + 5, focusPoint.z + 8);
        controls.update();
      } else {
        camera.position.set(20, 12, 20);
        camera.lookAt(0, 0, 0);
      }
    });

    let lastTime = Date.now();
    let ignitionAnnounced = false;
    let approachAnnounced = false;
    let dashOffset = 0;

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      const delta = (Date.now() - lastTime) / 1000;
      lastTime = Date.now();

      const ptsLength = protectedAssetTrajectory.length;

      // Advance simulation only when playing
      if (ptsLength > 0 && isPlayingRef.current) {
        const speed = 12;
        simIndexRef.current += delta * speed;

        const pct = Math.min(100, (simIndexRef.current / ptsLength) * 100);
        setProgressPct(pct);

        // End of simulation
        if (simIndexRef.current >= ptsLength - 1) {
          simIndexRef.current = ptsLength - 1;
          isPlayingRef.current = false;

          if (!hasRevealedRef.current) {
            hasRevealedRef.current = true;
            // Determine result
            const result = (maneuverTrajectory && planRisk !== 'red') ? 'success' : 'failed';
            setMissionResult(result);
            setSimPhase('reveal');

            // Dramatic reveal with delay
            setTimeout(() => setRevealOpacity(1), 300);

            if (result === 'success') {
              speakTelemetry("Mission complete. Deflection burn successful. Collision has been averted. Spacecraft is clear.", speechEnabled);
            } else {
              speakTelemetry("Warning. Mission failed. Insufficient separation at closest approach. Collision risk remains critical.", speechEnabled);
            }
            if (onSimulationComplete) onSimulationComplete(result);
          }
        }
      }

      // Rotate Earth
      const earthMesh = scene.getObjectByName('earth');
      const cloudMesh = scene.getObjectByName('clouds');
      if (earthMesh) earthMesh.rotation.y += delta * 0.005;
      if (cloudMesh) cloudMesh.rotation.y += delta * 0.007;

      // Animate dashed lines
      dashOffset += delta * 0.3;

      // Pulse TCA
      const tcaMarker = scene.getObjectByName('tca-marker');
      if (tcaMarker) {
        const pulse = 1.0 + 0.2 * Math.sin(Date.now() * 0.005);
        tcaMarker.scale.set(pulse, pulse, pulse);
      }
      const tcaGlow = scene.getObjectByName('tca-glow');
      if (tcaGlow) {
        const pulse = 1.0 + 0.3 * Math.sin(Date.now() * 0.003);
        tcaGlow.scale.set(pulse, pulse, pulse);
      }

      // Animate meshes
      if (ptsLength > 0) {
        const pct = Math.min(100, (simIndexRef.current / ptsLength) * 100);
        const idx = Math.min(Math.floor(simIndexRef.current), ptsLength - 1);
        const currentPt = protectedAssetTrajectory[idx];

        let isIgnited = false;
        let isDeflected = false;

        if (burnTime && currentPt) {
          const currentTimeMs = new Date(currentPt.t).getTime();
          const ignitionTimeMs = new Date(burnTime).getTime();

          if (currentTimeMs >= ignitionTimeMs) {
            isIgnited = currentTimeMs <= (ignitionTimeMs + 600000);
            isDeflected = true;
          }

          // Phase voice announcements (only once each)
          if (isIgnited && !ignitionAnnounced) {
            ignitionAnnounced = true;
            setSimPhase('ignition');
            speakTelemetry("Thruster ignition. Executing trajectory correction burn.", speechEnabled);
          }

          if (pct > 75 && !approachAnnounced) {
            approachAnnounced = true;
            setSimPhase('approaching');
            speakTelemetry("Approaching closest approach point. Stand by for assessment.", speechEnabled);
          }
        }

        // Position satellite
        const pMesh = scene.getObjectByName('protected-asset-mesh');
        if (pMesh) {
          const usePt = isDeflected && maneuverTrajectory && maneuverTrajectory[idx]
            ? maneuverTrajectory[idx] : protectedAssetTrajectory[idx];
          if (usePt) {
            const pos = usePt.position_ecef_km || usePt.position_teme_km;
            if (pos && !pos.some(isNaN)) {
              pMesh.position.set(pos[0] * SCALE, pos[2] * SCALE, pos[1] * SCALE);
              pMesh.rotation.y += delta * 0.5;
              const plumeMesh = pMesh.getObjectByName('thruster-plume');
              if (plumeMesh) {
                plumeMesh.visible = isIgnited;
                if (isIgnited) {
                  const p = 1.0 + Math.random() * 0.4;
                  plumeMesh.scale.set(p, p, p);
                }
              }
            }
          }
        }

        // Position debris
        const tMesh = scene.getObjectByName('threat-mesh');
        if (tMesh && threatTrajectory[idx]) {
          const pos = threatTrajectory[idx].position_ecef_km || threatTrajectory[idx].position_teme_km;
          if (pos && !pos.some(isNaN)) {
            tMesh.position.set(pos[0] * SCALE, pos[2] * SCALE, pos[1] * SCALE);
            tMesh.rotation.y += delta * 0.8;
          }
        }

        // Live distance
        if (pMesh && tMesh) {
          const dist = pMesh.position.distanceTo(tMesh.position) / SCALE;
          setLiveDistance(dist < 1.0 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(2)} km`);
        }

        // Camera follow
        if (pMesh && controlsRef.current) {
          controlsRef.current.target.copy(pMesh.position);
        }
      }

      if (controlsRef.current) controlsRef.current.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (rendererRef.current && mountRef.current) {
        try { mountRef.current.removeChild(rendererRef.current.domElement); } catch (e) {}
      }
      rendererRef.current?.dispose();
      sceneRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, hasData, buildScene]);

  // Time-to-TCA label
  const timeLabel = (() => {
    if (!hasData || !tcaTime) return '';
    const idx = Math.min(Math.floor(simIndexRef.current), protectedAssetTrajectory.length - 1);
    const pt = protectedAssetTrajectory[idx];
    if (!pt) return '';
    const diffMs = new Date(pt.t).getTime() - new Date(tcaTime).getTime();
    const diffHrs = diffMs / 3600000;
    if (Math.abs(diffHrs) < 0.01) return 'TCA';
    return `${diffHrs > 0 ? '+' : ''}${diffHrs.toFixed(2)}h`;
  })();

  if (!hasData) {
    return (
      <div className="relative w-full h-full bg-[#080808] rounded-[4px] border border-[#212121] flex items-center justify-center">
        <div className="text-center space-y-3 animate-pulse">
          <div className="h-5 w-5 text-[#9c9c9c] mx-auto animate-spin border-2 border-[#9c9c9c] border-t-transparent rounded-full" />
          <div className="font-mono text-[10px] text-[#9c9c9c] uppercase tracking-widest">
            Awaiting trajectory data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#050508] overflow-hidden rounded-[4px] border border-[#212121] font-mono text-white" style={{ minHeight: '100%' }}>
      {/* WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full" />

      {/* ── COUNTDOWN OVERLAY ── */}
      {simPhase === 'countdown' && (
        <div className="absolute inset-0 bg-black/80 z-30 flex flex-col items-center justify-center">
          <span className="text-[10px] text-[#9c9c9c] uppercase tracking-[0.3em] mb-4">Mission Simulation Initializing</span>
          <span className="text-[120px] font-bold text-white leading-none tabular-nums animate-pulse">
            {countdownNum > 0 ? countdownNum : ''}
          </span>
          {countdownNum <= 0 && (
            <span className="text-[32px] font-bold text-[#98ff38] uppercase tracking-widest animate-pulse">LAUNCH</span>
          )}
        </div>
      )}

      {/* ── MISSION RESULT REVEAL OVERLAY ── */}
      {simPhase === 'reveal' && missionResult && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center transition-opacity duration-1000"
          style={{
            opacity: revealOpacity,
            background: missionResult === 'success'
              ? 'radial-gradient(ellipse at center, rgba(10,228,72,0.15) 0%, rgba(0,0,0,0.92) 70%)'
              : 'radial-gradient(ellipse at center, rgba(255,51,85,0.15) 0%, rgba(0,0,0,0.92) 70%)',
          }}
        >
          {/* Pulsing ring */}
          <div className={cn(
            "w-32 h-32 rounded-full border-4 flex items-center justify-center mb-8 animate-pulse",
            missionResult === 'success' ? "border-[#98ff38]" : "border-[#ff3355]"
          )}>
            <span className="text-[48px]">{missionResult === 'success' ? '✓' : '✕'}</span>
          </div>

          <span className={cn(
            "text-[42px] font-bold uppercase tracking-[0.2em]",
            missionResult === 'success' ? "text-[#98ff38]" : "text-[#ff3355]"
          )}>
            {missionResult === 'success' ? 'MISSION SUCCESS' : 'MISSION FAILED'}
          </span>

          <span className="text-[14px] text-[#9c9c9c] mt-3 uppercase tracking-widest max-w-md text-center">
            {missionResult === 'success'
              ? 'Deflection burn executed successfully. Primary asset has cleared the threat debris trajectory.'
              : 'Insufficient separation at closest approach. Collision risk remains elevated. Reconfigure burn parameters.'}
          </span>

          <div className="mt-10 flex items-center space-x-4">
            <button
              onClick={exitFullscreen}
              className={cn(
                "px-8 py-3 rounded-[8px] text-[12px] font-bold uppercase tracking-widest border cursor-pointer transition-all",
                missionResult === 'success'
                  ? "border-[#98ff38] text-[#98ff38] hover:bg-[#98ff38]/10"
                  : "border-[#ff3355] text-[#ff3355] hover:bg-[#ff3355]/10"
              )}
            >
              {missionResult === 'success' ? 'Continue to Approval →' : '← Reconfigure Parameters'}
            </button>
          </div>
        </div>
      )}

      {/* ── TOP LEFT: Phase HUD ── */}
      {simPhase !== 'countdown' && simPhase !== 'reveal' && (
        <div className="absolute top-4 left-4 bg-[#080808]/95 border border-[#212121] px-4 py-3 rounded-lg z-20 select-none pointer-events-none">
          <div className="flex items-center space-x-2 text-[#00bae2] font-bold text-[11px] uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00bae2] animate-pulse" />
            <span>Live Simulation</span>
          </div>
          <div className="text-[9px] text-[#9c9c9c] uppercase flex items-center gap-1.5 mt-1">
            <span>Phase:</span>
            <span className={cn("font-bold",
              simPhase === 'ignition' ? "text-[#e5a93b]" :
              simPhase === 'approaching' ? "text-[#ff3355]" :
              "text-[#9c9c9c]"
            )}>
              {simPhase === 'running' ? 'TRACKING' :
               simPhase === 'ignition' ? 'THRUSTER BURN' :
               simPhase === 'approaching' ? 'APPROACHING TCA' : simPhase.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* ── TOP RIGHT: Distance ── */}
      {simPhase !== 'countdown' && simPhase !== 'reveal' && (
        <div className="absolute top-4 right-4 bg-[#080808]/95 border border-[#212121] px-4 py-3 rounded-lg z-20 select-none pointer-events-none text-right">
          <div className="text-[8px] text-[#9c9c9c] uppercase tracking-widest">Live Separation</div>
          <div className="text-[18px] text-white font-bold leading-none mt-1">{liveDistance}</div>
          <div className="text-[9px] text-[#6a6b6b] mt-0.5">{timeLabel} to TCA</div>
        </div>
      )}

      {/* ── BOTTOM: Progress Bar + Controls ── */}
      {simPhase !== 'countdown' && simPhase !== 'reveal' && (
        <div className="absolute bottom-4 left-4 right-4 z-20">
          {/* Progress bar */}
          <div className="h-[3px] bg-[#212121] rounded-full mb-3 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-300",
                simPhase === 'approaching' ? "bg-[#ff3355]" :
                simPhase === 'ignition' ? "bg-[#e5a93b]" :
                "bg-[#00bae2]"
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="bg-[#080808]/95 border border-[#212121] px-4 py-2.5 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[9px] text-[#6a6b6b] uppercase tracking-widest">
              <span className="w-2 h-[2px] bg-[#00bae2] inline-block" /> <span>Nominal</span>
              <span className="w-2 h-[2px] bg-[#ff3355] inline-block ml-2" /> <span>Debris</span>
              {maneuverTrajectory && (<><span className="w-2 h-[2px] bg-[#0ae448] inline-block ml-2" /> <span>Deflected</span></>)}
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-[#9c9c9c] tabular-nums">{Math.floor(progressPct)}%</span>
              <button
                onClick={() => setSpeechEnabled(!speechEnabled)}
                className={cn("p-1.5 border rounded cursor-pointer transition-colors",
                  speechEnabled ? "border-[#98ff38]/30 text-[#98ff38] bg-[#98ff38]/5" : "border-[#212121] text-[#6a6b6b]"
                )}
              >
                {speechEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ignition flash effect ── */}
      {simPhase === 'ignition' && (
        <div className="absolute inset-0 bg-[#e5a93b]/5 pointer-events-none z-10 animate-pulse" />
      )}

      {/* ── Approaching TCA warning edge glow ── */}
      {simPhase === 'approaching' && (
        <div className="absolute inset-0 border-2 border-[#ff3355]/40 pointer-events-none z-10 animate-pulse" />
      )}
    </div>
  );
};

export default ManeuverVisualizer;
