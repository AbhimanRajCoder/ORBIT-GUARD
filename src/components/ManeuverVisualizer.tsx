'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Play, Pause, RotateCcw } from 'lucide-react';

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
}

// ─────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────
const EARTH_RADIUS = 6.371;
const SCALE = EARTH_RADIUS / 6378.137;

// Orbit palette — matches DESIGN.MD
const COLORS = {
  protectedPath: 0x00bae2,   // Cyan Signal
  threatPath:    0xff3355,   // Collision red
  maneuverPath:  0x0ae448,   // Cleared green
  tcaDanger:     0xff3355,
  earth:         0x0d1b2a,   // Dark blue-black tint
  atmosphere:    0x0055aa,
  gridLine:      0x1a2a3a,
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
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<any>(null);
  const animationIdRef = useRef<number | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(true);
  const [simIndex, setSimIndex] = useState(0);
  const simIndexRef = useRef(0);
  const isPlayingRef = useRef(true);
  const [isMounted, setIsMounted] = useState(false);

  // Live distance readout
  const [liveDistance, setLiveDistance] = useState<string>('—');

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { setIsMounted(true); }, []);

  const hasData = protectedAssetTrajectory.length > 0;

  // ═══════════════════════════════════════════════════
  // HELPER: Convert ECEF km to Three.js coordinates
  // ═══════════════════════════════════════════════════
  const ecefToThree = useCallback((pos: [number, number, number]) => {
    const [x, y, z] = pos;
    return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
  }, []);

  // ═══════════════════════════════════════════════════
  // BUILD SCENE CONTENTS
  // ═══════════════════════════════════════════════════
  const buildScene = useCallback((scene: THREE.Scene) => {
    // ── Starfield (sparse, subtle) ──
    const starGeo = new THREE.BufferGeometry();
    const starVerts: number[] = [];
    for (let i = 0; i < 4000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 200 + Math.random() * 300;
      starVerts.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.5, transparent: true, opacity: 0.4
    })));

    // ── Earth ──
    const loader = new THREE.TextureLoader();
    const earthTex = loader.load('/textures/earth_atmos_2048.jpg');
    const earthBump = loader.load('/textures/earth_normal_2048.jpg');
    const earthSpec = loader.load('/textures/earth_specular_2048.jpg');
    const cloudsTex = loader.load('/textures/earth_clouds_1024.png');

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 64, 64),
      new THREE.MeshPhongMaterial({
        map: earthTex,
        normalMap: earthBump,
        specularMap: earthSpec,
        specular: new THREE.Color(0x3a6a8a),
        shininess: 25,
      })
    );
    earth.name = 'earth';
    earth.rotation.y = -Math.PI / 2; // ECEF-aligned
    scene.add(earth);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS + 0.02, 64, 64),
      new THREE.MeshPhongMaterial({
        map: cloudsTex, transparent: true, opacity: 0.25, depthWrite: false
      })
    );
    clouds.name = 'clouds';
    clouds.rotation.y = -Math.PI / 2;
    scene.add(clouds);

    // Atmosphere rim glow
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS + 0.12, 32, 32),
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.55 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
            gl_FragColor = vec4(0.05, 0.55, 0.95, 1.0) * intensity;
          }`,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
      })
    );
    scene.add(atmo);

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0x0a0e1a, 0.7));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    sun.position.set(100, 30, 80);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x0044aa, 0.2);
    fill.position.set(-80, -20, -60);
    scene.add(fill);

    // ══════════════════════════════════════════════════
    // TRAJECTORY PATHS
    // ══════════════════════════════════════════════════

    // 1. Protected Asset — Nominal Path (solid cyan)
    if (protectedAssetTrajectory.length > 0) {
      const pts = protectedAssetTrajectory
        .map(pt => {
          const pos = pt.position_ecef_km || pt.position_teme_km;
          if (!pos) return null;
          if (pos.some(isNaN)) return null;
          return ecefToThree(pos);
        })
        .filter((v): v is THREE.Vector3 => v !== null);

      if (pts.length > 1) {
        // Create a tube-like glow line using LineBasicMaterial
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
          color: COLORS.protectedPath,
          transparent: true,
          opacity: 0.85,
          linewidth: 2,
        }));
        line.name = 'protected-path-line';
        scene.add(line);

        // Outer glow line
        const glowLine = new THREE.Line(
          geo.clone(),
          new THREE.LineBasicMaterial({
            color: COLORS.protectedPath,
            transparent: true,
            opacity: 0.15,
            linewidth: 4,
          })
        );
        glowLine.name = 'protected-path-glow';
        scene.add(glowLine);
      }
    }

    // 2. Threat — Nominal Path (solid red)
    if (threatTrajectory.length > 0) {
      const pts = threatTrajectory
        .map(pt => {
          const pos = pt.position_ecef_km || pt.position_teme_km;
          if (!pos) return null;
          if (pos.some(isNaN)) return null;
          return ecefToThree(pos);
        })
        .filter((v): v is THREE.Vector3 => v !== null);

      if (pts.length > 1) {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
          color: COLORS.threatPath,
          transparent: true,
          opacity: 0.85,
          linewidth: 2,
        }));
        line.name = 'threat-path-line';
        scene.add(line);

        // Outer glow
        const glowLine = new THREE.Line(
          geo.clone(),
          new THREE.LineBasicMaterial({
            color: COLORS.threatPath,
            transparent: true,
            opacity: 0.12,
            linewidth: 4,
          })
        );
        glowLine.name = 'threat-path-glow';
        scene.add(glowLine);
      }
    }

    // 3. Post-burn maneuver path (dashed green-cyan)
    if (maneuverTrajectory && maneuverTrajectory.length > 0) {
      const pts = maneuverTrajectory
        .map(pt => {
          const pos = pt.position_ecef_km || pt.position_teme_km;
          if (!pos) return null;
          if (pos.some(isNaN)) return null;
          return ecefToThree(pos);
        })
        .filter((v): v is THREE.Vector3 => v !== null);

      if (pts.length > 1) {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineDashedMaterial({
          color: COLORS.maneuverPath,
          dashSize: 0.12,
          gapSize: 0.06,
          transparent: true,
          opacity: 0.9,
        });
        const line = new THREE.Line(geo, mat);
        line.computeLineDistances();
        line.name = 'maneuver-path-line';
        scene.add(line);
      }
    }

    // ══════════════════════════════════════════════════
    // TCA DANGER ZONE
    // ══════════════════════════════════════════════════
    if (tcaPosition) {
      const tcaPos = ecefToThree(tcaPosition);

      // Pulsing marker sphere
      const markerGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: COLORS.tcaDanger });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.copy(tcaPos);
      marker.name = 'tca-marker-mesh';
      scene.add(marker);

      // Inner glow sphere
      const innerGlowGeo = new THREE.SphereGeometry(0.12, 24, 24);
      const innerGlowMat = new THREE.MeshBasicMaterial({
        color: COLORS.tcaDanger,
        transparent: true,
        opacity: 0.08,
      });
      const innerGlow = new THREE.Mesh(innerGlowGeo, innerGlowMat);
      innerGlow.position.copy(tcaPos);
      innerGlow.name = 'tca-inner-glow';
      scene.add(innerGlow);

      // Wireframe safety sphere
      const radius = Math.max(0.08, (safetyRadiusKm || 0.15) * SCALE);
      const safetyGeo = new THREE.SphereGeometry(radius, 32, 32);
      const safetyMat = new THREE.MeshBasicMaterial({
        color: COLORS.tcaDanger,
        transparent: true,
        opacity: 0.1,
        wireframe: true,
      });
      const safetySphere = new THREE.Mesh(safetyGeo, safetyMat);
      safetySphere.position.copy(tcaPos);
      safetySphere.name = 'safety-sphere-mesh';
      scene.add(safetySphere);

      // Ring indicator at TCA altitude
      const ringGeo = new THREE.RingGeometry(radius * 0.9, radius * 1.1, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: COLORS.tcaDanger,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(tcaPos);
      ring.lookAt(0, 0, 0);
      ring.name = 'tca-ring';
      scene.add(ring);
    }

    // ══════════════════════════════════════════════════
    // ASSET MESHES (satellite models)
    // ══════════════════════════════════════════════════

    // Protected asset — satellite bus with solar panels
    const satGroup = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xe5a93b, emissive: 0x3a2400, shininess: 60 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    satGroup.add(body);

    const panelGeo = new THREE.BoxGeometry(0.2, 0.008, 0.06);
    const panelMat = new THREE.MeshPhongMaterial({ color: 0x1d4ed8, emissive: 0x001133, shininess: 80 });
    const leftPanel = new THREE.Mesh(panelGeo, panelMat);
    leftPanel.position.set(-0.12, 0, 0);
    satGroup.add(leftPanel);
    const rightPanel = new THREE.Mesh(panelGeo, panelMat);
    rightPanel.position.set(0.12, 0, 0);
    satGroup.add(rightPanel);

    // Cyan beacon
    const beaconGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: COLORS.protectedPath });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 0.06, 0);
    satGroup.add(beacon);

    satGroup.name = 'protected-asset-mesh';
    scene.add(satGroup);

    // Threat debris — red octahedron
    const threatGeo = new THREE.OctahedronGeometry(0.09, 0);
    const threatMat = new THREE.MeshPhongMaterial({
      color: COLORS.threatPath,
      emissive: 0x550011,
      emissiveIntensity: 0.6,
    });
    const threatMesh = new THREE.Mesh(threatGeo, threatMat);
    threatMesh.name = 'threat-mesh';
    scene.add(threatMesh);

    // ── Initial camera focus ──
    if (tcaPosition) {
      const tcaPos = ecefToThree(tcaPosition);
      return tcaPos; // Return for camera positioning
    } else if (protectedAssetTrajectory.length > 0) {
      const firstPt = protectedAssetTrajectory[0];
      const pos = firstPt.position_ecef_km || firstPt.position_teme_km;
      if (pos) return ecefToThree(pos);
    }
    return null;
  }, [protectedAssetTrajectory, threatTrajectory, maneuverTrajectory, tcaPosition, safetyRadiusKm, ecefToThree]);

  // ═══════════════════════════════════════════════════
  // MAIN SCENE INITIALIZATION
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    if (!isMounted || !mountRef.current || !hasData) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = 0.5;
      controls.maxDistance = 60;
      controls.rotateSpeed = 0.5;
      controls.zoomSpeed = 0.8;
      controlsRef.current = controls;

      // Position camera after controls are ready
      const focusPoint = buildScene(scene);
      if (focusPoint) {
        controls.target.copy(focusPoint);
        camera.position.set(focusPoint.x + 4, focusPoint.y + 2.5, focusPoint.z + 4);
        controls.update();
      } else {
        camera.position.set(20, 12, 20);
        camera.lookAt(0, 0, 0);
      }
    });

    // ── Animation Loop ──
    let lastTime = Date.now();
    let dashOffset = 0;

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      const delta = (Date.now() - lastTime) / 1000;
      lastTime = Date.now();

      // Playback scrubbing
      const ptsLength = protectedAssetTrajectory.length;
      if (ptsLength > 0 && isPlayingRef.current) {
        const speed = 15; // points per second
        simIndexRef.current = (simIndexRef.current + delta * speed) % ptsLength;
        setSimIndex(Math.floor(simIndexRef.current));
      }

      // Animate dash offset
      dashOffset += delta * 0.3;

      // Update maneuver dashed line
      const mLine = scene.getObjectByName('maneuver-path-line');
      if (mLine) {
        const mat = (mLine as THREE.Line).material as THREE.LineDashedMaterial;
        if (mat && mat.isLineDashedMaterial) {
          (mat as any).dashOffset = -dashOffset;
          mat.needsUpdate = true;
        }
      }

      // Pulse TCA marker
      const tcaMarker = scene.getObjectByName('tca-marker-mesh');
      if (tcaMarker) {
        const pulse = 1.0 + 0.2 * Math.sin(Date.now() * 0.005);
        tcaMarker.scale.set(pulse, pulse, pulse);
      }
      const innerGlow = scene.getObjectByName('tca-inner-glow');
      if (innerGlow) {
        const pulse = 1.0 + 0.3 * Math.sin(Date.now() * 0.003);
        innerGlow.scale.set(pulse, pulse, pulse);
      }
      const tcaRing = scene.getObjectByName('tca-ring');
      if (tcaRing) {
        tcaRing.rotation.z += delta * 0.3;
      }

      // Animate asset meshes along trajectories
      if (ptsLength > 0) {
        const idx = Math.floor(simIndexRef.current) % ptsLength;

        const pMesh = scene.getObjectByName('protected-asset-mesh');
        if (pMesh) {
          const usePt = maneuverTrajectory && maneuverTrajectory[idx]
            ? maneuverTrajectory[idx]
            : protectedAssetTrajectory[idx];
          if (usePt) {
            const pos = usePt.position_ecef_km || usePt.position_teme_km;
            if (pos && !pos.some(isNaN)) {
              const [x, y, z] = pos;
              pMesh.position.set(x * SCALE, z * SCALE, y * SCALE);
              pMesh.rotation.y += delta * 0.5;
            }
          }
        }

        const tMesh = scene.getObjectByName('threat-mesh');
        if (tMesh && threatTrajectory[idx]) {
          const pos = threatTrajectory[idx].position_ecef_km || threatTrajectory[idx].position_teme_km;
          if (pos && !pos.some(isNaN)) {
            const [x, y, z] = pos;
            tMesh.position.set(x * SCALE, z * SCALE, y * SCALE);
            tMesh.rotation.y += delta * 0.8;
            tMesh.rotation.x += delta * 0.3;
          }
        }

        // Compute live distance
        if (pMesh && tMesh) {
          const dist = pMesh.position.distanceTo(tMesh.position) / SCALE;
          if (dist < 1.0) {
            setLiveDistance(`${(dist * 1000).toFixed(0)} m`);
          } else {
            setLiveDistance(`${dist.toFixed(2)} km`);
          }
        }
      }

      // Update controls
      if (controlsRef.current) controlsRef.current.update();

      // Render
      renderer.render(scene, camera);
    };

    animate();

    // ── Resize handler ──
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ── Cleanup ──
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (rendererRef.current && mountRef.current) {
        try {
          mountRef.current.removeChild(rendererRef.current.domElement);
        } catch { /* unmounted */ }
      }
      rendererRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [isMounted, hasData, buildScene, protectedAssetTrajectory, threatTrajectory, maneuverTrajectory]);

  // ── Recenter camera handler ──
  const handleRecenter = useCallback(() => {
    if (cameraRef.current && controlsRef.current && tcaPosition) {
      const tcaPos = ecefToThree(tcaPosition);
      controlsRef.current.target.copy(tcaPos);
      cameraRef.current.position.set(tcaPos.x + 4, tcaPos.y + 2.5, tcaPos.z + 4);
      controlsRef.current.update();
    }
  }, [tcaPosition, ecefToThree]);

  // ── Compute time-from-TCA label ──
  const timeLabel = (() => {
    if (!hasData || !tcaTime) return '';
    const pt = protectedAssetTrajectory[simIndex];
    if (!pt) return '';
    const diffMs = new Date(pt.t).getTime() - new Date(tcaTime).getTime();
    const diffHrs = diffMs / 3600000;
    if (Math.abs(diffHrs) < 0.01) return 'TCA';
    return `${diffHrs > 0 ? '+' : ''}${diffHrs.toFixed(2)}h from TCA`;
  })();

  // ═══════════════════════════════════════════════════
  // NO-DATA PLACEHOLDER
  // ═══════════════════════════════════════════════════
  if (!hasData) {
    return (
      <div className="relative w-full h-full bg-abyss rounded-[4px] border border-iron/30 flex items-center justify-center">
        <div className="text-center space-y-3 animate-pulse">
          <div className="w-10 h-10 rounded-full border-2 border-iron/30 mx-auto flex items-center justify-center">
            <RotateCcw className="h-5 w-5 text-fog" />
          </div>
          <div className="font-data text-[11px] text-fog uppercase tracking-[0.1em]">
            Select a threat to visualize orbital trajectories
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div className="relative w-full h-full bg-void overflow-hidden rounded-[4px] border border-iron/30 font-body text-cloud">
      {/* WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full" />

      {/* ── Top Left: Mode Label ── */}
      <div className="absolute top-3 left-4 bg-void/90 backdrop-blur-sm border border-white/10 px-3 py-2 rounded-lg z-20 font-data space-y-0.5 select-none pointer-events-none">
        <div className="flex items-center space-x-1.5 text-orbit-cyan font-bold text-[11px] uppercase tracking-wider">
          <span className="h-1.5 w-1.5 rounded-full bg-orbit-cyan animate-pulse" />
          <span>Maneuver Planner</span>
        </div>
        <div className="text-[9px] text-ash font-mono uppercase">
          Orbital encounter visualization
        </div>
      </div>

      {/* ── Top Right: Live Separation Readout ── */}
      <div className="absolute top-3 right-4 bg-void/90 backdrop-blur-sm border border-white/10 px-3 py-2 rounded-lg z-20 select-none pointer-events-none text-right">
        <div className="font-data text-[8px] text-ash/60 uppercase tracking-[0.1em]">
          Live Separation
        </div>
        <div className="font-mono text-[16px] text-bone font-bold leading-tight mt-0.5">
          {liveDistance}
        </div>
      </div>

      {/* ── Bottom: Playback Scrubber Bar ── */}
      <div className="absolute bottom-4 left-4 right-4 bg-void/95 backdrop-blur-sm border border-white/10 p-2.5 rounded-lg z-20 flex items-center space-x-3 shadow-2xl">
        {/* Play / Pause */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-1.5 border border-white/10 hover:border-white/20 hover:bg-white/5 text-ash hover:text-bone rounded cursor-pointer transition-colors shrink-0"
        >
          {isPlaying
            ? <Pause className="h-3.5 w-3.5" />
            : <Play className="h-3.5 w-3.5" />
          }
        </button>

        {/* Timeline scrubber */}
        <input
          type="range"
          min={0}
          max={protectedAssetTrajectory.length - 1}
          value={simIndex}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            simIndexRef.current = val;
            setSimIndex(val);
            setIsPlaying(false);
          }}
          className="flex-1 cursor-pointer accent-orbit-cyan h-1 bg-abyss rounded-lg appearance-none"
        />

        {/* Time label */}
        <div className="font-mono text-[10px] text-bone shrink-0 min-w-[95px] text-right">
          {timeLabel}
        </div>

        {/* Recenter */}
        <button
          onClick={handleRecenter}
          className="p-1.5 border border-white/10 hover:border-white/20 hover:bg-white/5 text-ash hover:text-bone rounded cursor-pointer transition-colors text-[9px] uppercase font-mono tracking-wider shrink-0"
          title="Recenter Camera on TCA"
        >
          Recenter
        </button>
      </div>

      {/* ── Bottom Right: Orbit Legend ── */}
      <div className="absolute bottom-20 right-4 bg-void/90 backdrop-blur-sm border border-white/10 p-3 rounded-lg font-mono text-[9px] z-20 space-y-1.5 pointer-events-none select-none">
        <span className="text-[9px] font-bold text-ash/40 uppercase tracking-wider block border-b border-white/5 pb-1 mb-1">
          Orbit Legend
        </span>
        <div className="flex items-center space-x-2">
          <span className="w-5 h-[2px] inline-block shrink-0" style={{ backgroundColor: '#00bae2' }} />
          <span className="text-ash">Protected Asset</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-5 h-[2px] inline-block shrink-0" style={{ backgroundColor: '#ff3355' }} />
          <span className="text-ash">Threat Candidate</span>
        </div>
        {maneuverTrajectory && (
          <div className="flex items-center space-x-2">
            <span
              className="w-5 h-[2px] inline-block shrink-0"
              style={{
                backgroundImage: 'repeating-linear-gradient(90deg, #0ae448 0, #0ae448 3px, transparent 3px, transparent 6px)',
                height: '2px',
              }}
            />
            <span className="text-ash">Post-Burn Path</span>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full border border-collision-red bg-collision-red/20 inline-block shrink-0 animate-pulse" />
          <span className="text-ash">TCA Zone ({safetyRadiusKm.toFixed(1)} km)</span>
        </div>
      </div>
    </div>
  );
};

export default ManeuverVisualizer;
