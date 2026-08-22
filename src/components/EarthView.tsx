'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { useOrbitStream } from '@/lib/hooks/useOrbitStream';
import { propagateTLE } from '@/lib/sgp4-propagator';
import * as satellite from 'satellite.js';
import {
  ChevronDown,
  X,
  AlertTriangle,
  RotateCcw,
  Zap,
  ShieldAlert,
  Eye,
  EyeOff,
  Layers,
  Activity,
  Play,
  Pause,
} from 'lucide-react';
import { Satellite, ConjunctionEvent, ManeuverPlan } from '@/types';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────
interface SpaceObject {
  mesh: THREE.Mesh;
  satId: string;
  type: 'satellite' | 'large-debris';
}

interface Stats {
  total: number;
  satellites: number;
  largeDebris: number;
  conjunctions: number;
}

// ─────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────
const EARTH_RADIUS = 6.371;
const SCALE = EARTH_RADIUS / 6378.137;
const ORBIT_SEGMENTS = 180;

// ─────────────────────────────────────────────────────
// EarthView Component
// ─────────────────────────────────────────────────────
interface TrajectoryPoint {
  t: string;
  position_ecef_km: [number, number, number];
  position_teme_km?: [number, number, number];
}

interface EarthViewProps {
  selectedObject?: string | null;
  compact?: boolean;
  protectedAssetTrajectory?: TrajectoryPoint[];
  threatTrajectory?: TrajectoryPoint[];
  maneuverTrajectory?: TrajectoryPoint[] | null;
  tcaTime?: string;
  tcaPosition?: [number, number, number];
  safetyRadiusKm?: number;
}

const EarthView: React.FC<EarthViewProps> = ({ 
  selectedObject: externalSelectedObject, 
  compact = false,
  protectedAssetTrajectory,
  threatTrajectory,
  maneuverTrajectory,
  tcaTime,
  tcaPosition,
  safetyRadiusKm = 0.15
}) => {
  const isManeuverMode = !!protectedAssetTrajectory && protectedAssetTrajectory.length > 0;

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<any>(null);

  const objectsRef = useRef<SpaceObject[]>([]);
  const smallDebrisRef = useRef<THREE.Points | null>(null);
  const orbitLinesGroupRef = useRef<THREE.Group | null>(null);
  const conjunctionLinesGroupRef = useRef<THREE.Group | null>(null);
  const deflectionGroupRef = useRef<THREE.Group | null>(null);
  const animationIdRef = useRef<number | null>(null);

  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const hoveredObjectRef = useRef<string | null>(null);

  const { satellites, conjunctionEvents } = useOrbitStream();
  const [maneuverPlans, setManeuverPlans] = useState<ManeuverPlan[]>([]);
  const [visualizationData, setVisualizationData] = useState<any>(null);
  const [loadingVisualization, setLoadingVisualization] = useState<boolean>(false);

  // ── UI State ──
  const [stats, setStats] = useState<Stats>({ total: 0, satellites: 0, largeDebris: 0, conjunctions: 0 });
  const [debrisVisible, setDebrisVisible] = useState(true);
  const [trajectoriesVisible, setTrajectoriesVisible] = useState(true);
  const [showSatellites, setShowSatellites] = useState(true);
  const [showLargeDebris, setShowLargeDebris] = useState(true);
  const [showSmallDebris, setShowSmallDebris] = useState(true);
  const [animationPaused, setAnimationPaused] = useState(false);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);

  // Maneuver playback controls
  const [isPlaying, setIsPlaying] = useState(true);
  const [simIndex, setSimIndex] = useState(0);
  const simIndexRef = useRef(0);
  const isPlayingRef = useRef(true);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    if (externalSelectedObject !== undefined) {
      setSelectedObject(externalSelectedObject);
    }
  }, [externalSelectedObject]);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const animationPausedRef = useRef(false);
  const selectedObjectRef = useRef<string | null>(null);
  const isTransitioningZoomOut = useRef(false);
  const trajectoriesVisibleRef = useRef(true);
  const debrisVisibleRef = useRef(true);

  const sliderRef = useRef<HTMLInputElement>(null);
  const timeTextRef = useRef<HTMLSpanElement>(null);
  const timeOffsetRef = useRef(0);

  const [activeOverlayConjunctions, setActiveOverlayConjunctions] = useState<Array<{
    id: string; label: string; distanceKm: number; x: number; y: number; visible: boolean;
  }>>([]);

  // ─── Load maneuvers from API ──────────────────────
  useEffect(() => {
    async function loadManeuvers() {
      try {
        const res = await fetch('/api/maneuvers');
        if (res.ok) {
          const data = await res.json();
          setManeuverPlans(data);
        }
      } catch (e) {
        console.error('Failed to load maneuver plans from API:', e);
      }
    }
    loadManeuvers();
    const interval = setInterval(loadManeuvers, 5000);
    return () => clearInterval(interval);
  }, []);

  // ─── Load visualization data on selectedObject conjunction ─────
  useEffect(() => {
    if (!selectedObject) {
      setVisualizationData(null);
      return;
    }
    
    const activeConj = conjunctionEvents.find(
      (c) => (c.primaryId === selectedObject || c.secondaryId === selectedObject) && c.status === 'active'
    );
    
    if (!activeConj) {
      setVisualizationData(null);
      return;
    }
    
    const candidateId = activeConj.secondaryId.split('-')[1];
    if (!candidateId) return;
    
    setLoadingVisualization(true);
    fetch('/api/visualize?candidate_id=' + candidateId + '&window_hours=6&step_seconds=60')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Failed to load visualization data');
      })
      .then(data => {
        setVisualizationData(data);
      })
      .catch(err => {
        console.error(err);
        setVisualizationData(null);
      })
      .finally(() => {
        setLoadingVisualization(false);
      });
  }, [selectedObject, conjunctionEvents]);

  // Debugging logs requested by user
  useEffect(() => {
    console.log("EarthView - satellites data:", satellites);
  }, [satellites]);

  useEffect(() => {
    console.log("EarthView - visualization data:", visualizationData);
  }, [visualizationData]);

  // ─── Mount flag ───────────────────────────────────
  useEffect(() => { setIsMounted(true); }, []);

  // ─── Support URL query parameters for routing ───
  useEffect(() => {
    if (typeof window !== 'undefined' && satellites.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const satId = params.get('sat');
      const eventId = params.get('event');
      if (satId) {
        const match = satellites.find(s => s.id === satId);
        if (match) {
          setSelectedObject(match.id);
        }
      } else if (eventId && conjunctionEvents.length > 0) {
        const match = conjunctionEvents.find(c => c.id === eventId);
        if (match) {
          focusOnConjunctionEvent(match);
        }
      }
    }
  }, [satellites, conjunctionEvents]);

  // ─── Sync refs ────────────────────────────────────
  useEffect(() => { animationPausedRef.current = animationPaused; }, [animationPaused]);
  useEffect(() => { trajectoriesVisibleRef.current = trajectoriesVisible; }, [trajectoriesVisible]);
  useEffect(() => { debrisVisibleRef.current = debrisVisible; }, [debrisVisible]);

  // ─── Re-draw orbit lines when satellites or trajectoryVisible changes ───
  useEffect(() => {
    if (isManeuverMode) return;
    if (sceneRef.current && satellites.length > 0) {
      updateSatelliteMeshes(sceneRef.current);
      drawAllOrbitTrajectories(sceneRef.current);
    }
  }, [satellites, isManeuverMode]);

  useEffect(() => {
    if (orbitLinesGroupRef.current) {
      orbitLinesGroupRef.current.visible = trajectoriesVisible;
    }
  }, [trajectoriesVisible]);

  useEffect(() => {
    if (smallDebrisRef.current) {
      smallDebrisRef.current.visible = showSmallDebris;
    }
  }, [showSmallDebris]);

  // ─── Selected object → camera focus + orbit ring ─
  useEffect(() => {
    selectedObjectRef.current = selectedObject;
    if (selectedObject && sceneRef.current) {
      drawSelectedOrbitRing(selectedObject, sceneRef.current, visualizationData);
    } else if (sceneRef.current) {
      clearDeflectionGroup();
    }
  }, [selectedObject, maneuverPlans, visualizationData]);

  // ─── Stats ────────────────────────────────────────
  useEffect(() => {
    setStats({
      total: satellites.length,
      satellites: satellites.filter(s => s.objectType === 'satellite').length,
      largeDebris: satellites.filter(s => s.objectType === 'debris').length,
      conjunctions: conjunctionEvents.filter(c => c.status === 'active').length,
    });
  }, [satellites, conjunctionEvents]);

  // ─── Maneuver Visualization Mode Helpers & Effects ───
  const initializeManeuverVisualization = (scene: THREE.Scene) => {
    const toRemove = [
      'protected-asset-mesh',
      'threat-mesh',
      'protected-path-line',
      'threat-path-line',
      'maneuver-path-line',
      'tca-marker-mesh',
      'safety-sphere-mesh'
    ];
    toRemove.forEach(name => {
      const obj = scene.getObjectByName(name);
      if (obj) {
        scene.remove(obj);
        if ((obj as any).geometry) (obj as any).geometry.dispose();
        if ((obj as any).material) {
          if (Array.isArray((obj as any).material)) {
            (obj as any).material.forEach((m: any) => m.dispose());
          } else {
            (obj as any).material.dispose();
          }
        }
      }
    });

    if (!protectedAssetTrajectory || !threatTrajectory) return;

    // 1. Draw nominal protected asset path (solid cyan)
    const pPts = protectedAssetTrajectory.map(pt => {
      const [x, y, z] = pt.position_ecef_km;
      return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
    });
    if (pPts.length > 0) {
      const geo = new THREE.BufferGeometry().setFromPoints(pPts);
      const mat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.8 });
      const line = new THREE.Line(geo, mat);
      line.name = 'protected-path-line';
      scene.add(line);
    }

    // 2. Draw nominal threat path (solid red)
    const tPts = threatTrajectory.map(pt => {
      const [x, y, z] = pt.position_ecef_km;
      return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
    });
    if (tPts.length > 0) {
      const geo = new THREE.BufferGeometry().setFromPoints(tPts);
      const mat = new THREE.LineBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.8 });
      const line = new THREE.Line(geo, mat);
      line.name = 'threat-path-line';
      scene.add(line);
    }

    // 3. Draw post-burn maneuver path if available (dashed cyan)
    if (maneuverTrajectory && maneuverTrajectory.length > 0) {
      const mPts = maneuverTrajectory.map(pt => {
        const [x, y, z] = pt.position_ecef_km;
        return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
      });
      const geo = new THREE.BufferGeometry().setFromPoints(mPts);
      const mat = new THREE.LineDashedMaterial({
        color: 0x00f0ff,
        dashSize: 0.12,
        gapSize: 0.06,
        transparent: true,
        opacity: 0.9
      });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      line.name = 'maneuver-path-line';
      scene.add(line);
    }

    // 4. Create TCA marker & safety sphere
    if (tcaPosition) {
      const [tx, ty, tz] = tcaPosition;
      const tcaPos = new THREE.Vector3(tx * SCALE, tz * SCALE, ty * SCALE);

      const markerGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.copy(tcaPos);
      marker.name = 'tca-marker-mesh';
      scene.add(marker);

      const radius = (safetyRadiusKm || 0.15) * SCALE;
      const safetyGeo = new THREE.SphereGeometry(Math.max(0.08, radius), 32, 32);
      const safetyMat = new THREE.MeshBasicMaterial({
        color: 0xff3355,
        transparent: true,
        opacity: 0.12,
        wireframe: true
      });
      const safetySphere = new THREE.Mesh(safetyGeo, safetyMat);
      safetySphere.position.copy(tcaPos);
      safetySphere.name = 'safety-sphere-mesh';
      scene.add(safetySphere);
    }

    // 5. Create meshes for the assets
    const pMeshGeo = new THREE.BoxGeometry(0.12, 0.08, 0.16);
    const pMeshMat = new THREE.MeshPhongMaterial({ color: 0x00f0ff, emissive: 0x004455, emissiveIntensity: 0.6 });
    const pMesh = new THREE.Mesh(pMeshGeo, pMeshMat);
    pMesh.name = 'protected-asset-mesh';
    scene.add(pMesh);

    const tMeshGeo = new THREE.OctahedronGeometry(0.08, 0);
    const tMeshMat = new THREE.MeshPhongMaterial({ color: 0xff3355, emissive: 0x550011, emissiveIntensity: 0.6 });
    const tMesh = new THREE.Mesh(tMeshGeo, tMeshMat);
    tMesh.name = 'threat-mesh';
    scene.add(tMesh);

    // Initial camera focus on TCA
    if (cameraRef.current && controlsRef.current) {
      if (tcaPosition) {
        const [tx, ty, tz] = tcaPosition;
        const tcaPos = new THREE.Vector3(tx * SCALE, tz * SCALE, ty * SCALE);
        controlsRef.current.target.copy(tcaPos);
        cameraRef.current.position.set(tcaPos.x + 3.5, tcaPos.y + 2.0, tcaPos.z + 3.5);
      } else if (pPts.length > 0) {
        controlsRef.current.target.copy(pPts[0]);
        cameraRef.current.position.set(pPts[0].x + 3.5, pPts[0].y + 2.0, pPts[0].z + 3.5);
      }
      controlsRef.current.update();
    }
  };

  useEffect(() => {
    if (isManeuverMode && sceneRef.current) {
      initializeManeuverVisualization(sceneRef.current);
    }
  }, [protectedAssetTrajectory, threatTrajectory, tcaPosition, isManeuverMode]);

  useEffect(() => {
    if (isManeuverMode && sceneRef.current) {
      const oldLine = sceneRef.current.getObjectByName('maneuver-path-line');
      if (oldLine) {
        sceneRef.current.remove(oldLine);
        (oldLine as THREE.Line).geometry.dispose();
        ((oldLine as THREE.Line).material as THREE.Material).dispose();
      }

      if (maneuverTrajectory && maneuverTrajectory.length > 0) {
        const mPts = maneuverTrajectory.map(pt => {
          const [x, y, z] = pt.position_ecef_km;
          return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
        });
        const geo = new THREE.BufferGeometry().setFromPoints(mPts);
        const mat = new THREE.LineDashedMaterial({
          color: 0x00f0ff,
          dashSize: 0.12,
          gapSize: 0.06,
          transparent: true,
          opacity: 0.9
        });
        const line = new THREE.Line(geo, mat);
        line.computeLineDistances();
        line.name = 'maneuver-path-line';
        sceneRef.current.add(line);
      }
    }
  }, [maneuverTrajectory, isManeuverMode]);

  // ═══════════════════════════════════════════════════
  // THREE.JS SCENE INITIALISATION
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    if (!isMounted || !mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00000a);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(20, 12, 20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 8;
      controls.maxDistance = 80;
      controlsRef.current = controls;
    });

    // Scene contents
    if (!isManeuverMode) {
      createStarfield(scene);
    }
    createEarth(scene);
    if (!isManeuverMode) {
      createSmallDebrisCloud(scene);
    }
    setupLighting(scene);

    // Groups
    const orbitGroup = new THREE.Group();
    orbitGroup.name = 'orbit-lines-group';
    scene.add(orbitGroup);
    orbitLinesGroupRef.current = orbitGroup;

    const conjGroup = new THREE.Group();
    conjGroup.name = 'conjunction-lines-group';
    scene.add(conjGroup);
    conjunctionLinesGroupRef.current = conjGroup;

    const deflGroup = new THREE.Group();
    deflGroup.name = 'deflection-group';
    scene.add(deflGroup);
    deflectionGroupRef.current = deflGroup;

    if (isManeuverMode) {
      initializeManeuverVisualization(scene);
    } else if (satellites.length > 0) {
      updateSatelliteMeshes(scene);
      drawAllOrbitTrajectories(scene);
    }

    // Animation loop
    let lastTime = Date.now();
    let dashOffset = 0;
 
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
 
      if (!animationPausedRef.current) {
        const delta = (Date.now() - lastTime) / 1000;
        if (isManeuverMode && protectedAssetTrajectory) {
          const ptsLength = protectedAssetTrajectory.length;
          if (ptsLength > 0 && isPlayingRef.current) {
            const speed = 15; // points per second
            simIndexRef.current = (simIndexRef.current + delta * speed) % ptsLength;
            setSimIndex(Math.floor(simIndexRef.current));
          }
        } else {
          timeOffsetRef.current = (timeOffsetRef.current + delta * 0.5) % 72;
          if (sliderRef.current) sliderRef.current.value = timeOffsetRef.current.toString();
          if (timeTextRef.current) timeTextRef.current.textContent = `+${timeOffsetRef.current.toFixed(1)}h`;
        }
        dashOffset += delta * 0.3;
      }
      lastTime = Date.now();
 
      const simTime = new Date(Date.now() + timeOffsetRef.current * 3600 * 1000);
 
      // Earth & clouds rotate based on simulation GMST (Pillar 5 Physics Check)
      const earth = scene.getObjectByName('earth');
      const clouds = scene.getObjectByName('clouds');
      if (!isManeuverMode) {
        const gmst = satellite.gstime(simTime);
        if (earth) earth.rotation.y = gmst;
        if (clouds) clouds.rotation.y = gmst * 1.02; // slow relative drift
      } else {
        if (earth) earth.rotation.y = 0; // Fixed Earth mesh in ECEF mode
        if (clouds) clouds.rotation.y = 0;
      }
 
      // Debris cloud slow drift
      if (!isManeuverMode && smallDebrisRef.current && debrisVisibleRef.current) {
        smallDebrisRef.current.rotation.y += 0.00005;
      }
 
      // Animate dashed hazard orbits by shifting material offset (shader trick)
      if (orbitLinesGroupRef.current) {
        orbitLinesGroupRef.current.children.forEach((child) => {
          const mat = (child as THREE.Line).material as THREE.LineDashedMaterial;
          if (mat && mat.isLineDashedMaterial) {
            (mat as any).dashOffset = -dashOffset;
            mat.needsUpdate = true;
          }
        });
      }
 
      if (isManeuverMode && protectedAssetTrajectory && threatTrajectory) {
        const ptsLength = protectedAssetTrajectory.length;
        if (ptsLength > 0) {
          const idx = Math.floor(simIndexRef.current) % ptsLength;
          const pPoint = maneuverTrajectory && maneuverTrajectory[idx] ? maneuverTrajectory[idx] : protectedAssetTrajectory[idx];
          const tPoint = threatTrajectory[idx];
 
          const pMesh = scene.getObjectByName('protected-asset-mesh');
          if (pMesh && pPoint) {
            const [x, y, z] = pPoint.position_ecef_km;
            pMesh.position.set(x * SCALE, z * SCALE, y * SCALE);
            pMesh.rotation.y += 0.01;
          }
 
          const tMesh = scene.getObjectByName('threat-mesh');
          if (tMesh && tPoint) {
            const [x, y, z] = tPoint.position_ecef_km;
            tMesh.position.set(x * SCALE, z * SCALE, y * SCALE);
            tMesh.rotation.y += 0.01;
          }
        }
 
        // Pulse TCA marker point
        const tcaMarker = scene.getObjectByName('tca-marker-mesh');
        if (tcaMarker) {
          const pulse = 1.0 + 0.15 * Math.sin(Date.now() * 0.006);
          tcaMarker.scale.set(pulse, pulse, pulse);
        }
 
        // Shift maneuver path line dashOffset to animate it
        const mLine = scene.getObjectByName('maneuver-path-line');
        if (mLine) {
          const mat = (mLine as THREE.Line).material as THREE.LineDashedMaterial;
          if (mat && mat.isLineDashedMaterial) {
            (mat as any).dashOffset = -dashOffset;
            mat.needsUpdate = true;
          }
        }
      } else {
        // Update satellite positions (SGP4)
        objectsRef.current.forEach((obj) => {
          const satData = satellites.find(s => s.id === obj.satId);
          if (satData?.tleLine1 && satData?.tleLine2) {
            const state = propagateTLE(satData.tleLine1, satData.tleLine2, simTime);
            if (state) {
              obj.mesh.position.set(
                state.position.x * SCALE,
                state.position.z * SCALE,
                state.position.y * SCALE
              );
              // Rotate mesh slightly for visual life
              obj.mesh.rotation.y += 0.01;
            }
          }
        });
      }
 
      // Update conjunction distance overlays
      if (!isManeuverMode) {
        updateConjunctionOverlay(scene, camera, simTime);
      }
 
      // Camera follow
      if (!isManeuverMode) {
        const selId = selectedObjectRef.current;
        if (selId) {
          const tObj = scene.getObjectByName(selId);
          if (tObj && controlsRef.current && cameraRef.current) {
            controlsRef.current.target.lerp(tObj.position, 0.05);
            const dist = cameraRef.current.position.distanceTo(tObj.position);
            if (dist > 3.5) {
              const dir = new THREE.Vector3().subVectors(cameraRef.current.position, tObj.position).normalize();
              cameraRef.current.position.lerp(tObj.position.clone().add(dir.multiplyScalar(3.5)), 0.05);
            }
          }
        } else if (controlsRef.current && cameraRef.current) {
          if (isTransitioningZoomOut.current) {
            const defPos = new THREE.Vector3(20, 12, 20);
            cameraRef.current.position.lerp(defPos, 0.04);
            controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), 0.04);
            if (cameraRef.current.position.distanceTo(defPos) < 0.3) {
              isTransitioningZoomOut.current = false;
            }
          }
        }
      }

      if (controlsRef.current) controlsRef.current.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    renderer.domElement.addEventListener('click', handleCanvasClick);
    renderer.domElement.addEventListener('mousemove', handleCanvasMouseMove);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      renderer.domElement.removeEventListener('mousemove', handleCanvasMouseMove);
      if (mountRef.current?.contains(renderer.domElement)) mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
      if (controlsRef.current) controlsRef.current.dispose();
    };
  }, [isMounted]);

  // ═══════════════════════════════════════════════════
  // SCENE HELPERS
  // ═══════════════════════════════════════════════════

  const createStarfield = (scene: THREE.Scene) => {
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    for (let i = 0; i < 8000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 300 + Math.random() * 200;
      verts.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    // Two layers: bright + dim stars
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.55 })));

    const geo2 = new THREE.BufferGeometry();
    const verts2: number[] = [];
    for (let i = 0; i < 3000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 250 + Math.random() * 50;
      verts2.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
    }
    geo2.setAttribute('position', new THREE.Float32BufferAttribute(verts2, 3));
    scene.add(new THREE.Points(geo2, new THREE.PointsMaterial({ color: 0xaac6ff, size: 0.5, transparent: true, opacity: 0.35 })));
  };

  const createEarth = (scene: THREE.Scene) => {
    const loader = new THREE.TextureLoader();
    const earthTex = loader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');
    const earthBump = loader.load('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg');
    const earthSpec = loader.load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg');
    const cloudsTex = loader.load('https://threejs.org/examples/textures/planets/earth_clouds_1024.png');

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
    scene.add(earth);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS + 0.02, 64, 64),
      new THREE.MeshPhongMaterial({ map: cloudsTex, transparent: true, opacity: 0.3, depthWrite: false })
    );
    clouds.name = 'clouds';
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
  };

  /**
   * Debris cloud: Mimics real-world Kessler debris distribution.
   * LEO (≈200-2000 km), MEO (≈5000-20000 km), GEO band.
   * Rendered as faint grey point cloud with slight inclination spread.
   */
  const createSmallDebrisCloud = (scene: THREE.Scene) => {
    const COUNT = 12000;
    const positions: number[] = [];
    const colors: number[] = [];

    const addShell = (count: number, altMin: number, altMax: number, incSpread: number, r: number, g: number, b: number) => {
      for (let i = 0; i < count; i++) {
        const alt = altMin + Math.random() * (altMax - altMin);
        const radius = EARTH_RADIUS + alt / 6378.137 * EARTH_RADIUS;
        const inc = (Math.random() - 0.5) * incSpread;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.PI / 2 + inc;
        positions.push(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta)
        );
        // Slight color variation
        colors.push(r + (Math.random() - 0.5) * 0.15, g + (Math.random() - 0.5) * 0.15, b + (Math.random() - 0.5) * 0.15);
      }
    };

    // LEO band — densest (grey-white)
    addShell(7000, 200, 2000, 1.8, 0.7, 0.72, 0.75);
    // MEO (GPS/nav) — sparser (blue-grey)
    addShell(2000, 5000, 20000, 0.6, 0.45, 0.52, 0.65);
    // GEO belt — thin ring (warm grey)
    addShell(1000, 35000, 36000, 0.05, 0.6, 0.56, 0.5);
    // High-inclination polar cluster
    addShell(2000, 300, 1500, Math.PI, 0.6, 0.68, 0.7);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.012,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
    });

    const cloud = new THREE.Points(geo, mat);
    cloud.name = 'debris-cloud';
    scene.add(cloud);
    smallDebrisRef.current = cloud;
  };

  const setupLighting = (scene: THREE.Scene) => {
    scene.add(new THREE.AmbientLight(0x0a0e1a, 0.7));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    sun.position.set(100, 30, 80);
    scene.add(sun);
    // Subtle fill light from the opposite side
    const fill = new THREE.DirectionalLight(0x0044aa, 0.2);
    fill.position.set(-80, -20, -60);
    scene.add(fill);
  };

  // ─── Satellite / Debris meshes ────────────────────
  const updateSatelliteMeshes = (scene: THREE.Scene) => {
    objectsRef.current.forEach(obj => scene.remove(obj.mesh));
    objectsRef.current = [];

    const simTime = new Date(Date.now() + timeOffsetRef.current * 3600 * 1000);

    satellites.forEach((sat) => {
      const isDebris = sat.objectType === 'debris';

      let geo: THREE.BufferGeometry;
      if (isDebris) {
        geo = new THREE.OctahedronGeometry(0.055, 0);
      } else {
        geo = new THREE.BoxGeometry(0.09, 0.055, 0.12);
      }

      let color = 0x00bae2;
      let emissive = 0x004455;
      if (sat.riskLevel === 'red') { color = 0xff3355; emissive = 0x881122; }
      else if (sat.riskLevel === 'yellow') { color = 0xffb829; emissive = 0x664400; }
      else if (isDebris) { color = 0x8e9096; emissive = 0x1c1c1e; }

      const mat = new THREE.MeshPhongMaterial({ color, emissive, emissiveIntensity: 0.7, shininess: 30 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = sat.id;

      if (sat.tleLine1 && sat.tleLine2) {
        const state = propagateTLE(sat.tleLine1, sat.tleLine2, simTime);
        if (state) mesh.position.set(state.position.x * SCALE, state.position.z * SCALE, state.position.y * SCALE);
      }

      if (!showSatellites && !isDebris) mesh.visible = false;
      if (!showLargeDebris && isDebris) mesh.visible = false;

      scene.add(mesh);
      objectsRef.current.push({ mesh, satId: sat.id, type: isDebris ? 'large-debris' : 'satellite' });
    });
  };

  // ─── Draw all orbit trajectory lines ─────────────
  const drawAllOrbitTrajectories = (scene: THREE.Scene) => {
    const group = orbitLinesGroupRef.current;
    if (!group) return;

    // Clear existing
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Line;
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
      group.remove(child);
    }

    const tStart = new Date();

    satellites.forEach((sat) => {
      if (!sat.tleLine1 || !sat.tleLine2) return;

      const isHazard = sat.riskLevel === 'red' || sat.riskLevel === 'yellow';
      const isDebris = sat.objectType === 'debris';
      const periodMs = sat.period * 60 * 1000;

      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
        const t = new Date(tStart.getTime() + (i / ORBIT_SEGMENTS) * periodMs);
        const state = propagateTLE(sat.tleLine1, sat.tleLine2, t);
        if (state) {
          points.push(new THREE.Vector3(state.position.x * SCALE, state.position.z * SCALE, state.position.y * SCALE));
        }
      }
      if (points.length < 2) return;

      const geo = new THREE.BufferGeometry().setFromPoints(points);

      let line: THREE.Line;

      if (isHazard) {
        // Dashed animated line for hazard orbits
        const mat = new THREE.LineDashedMaterial({
          color: sat.riskLevel === 'red' ? 0xff3355 : 0xffb829,
          dashSize: 0.12,
          gapSize: 0.06,
          transparent: true,
          opacity: 0.9,
        });
        line = new THREE.Line(geo, mat);
        line.computeLineDistances();
      } else if (isDebris) {
        const mat = new THREE.LineBasicMaterial({ color: 0x4a4e55, transparent: true, opacity: 0.35 });
        line = new THREE.Line(geo, mat);
      } else {
        const mat = new THREE.LineBasicMaterial({ color: 0x00bae2, transparent: true, opacity: 0.45 });
        line = new THREE.Line(geo, mat);
      }

      line.name = `orbit-${sat.id}`;
      group.add(line);
    });

    group.visible = trajectoriesVisibleRef.current;
  };

  // ─── Selected object ring + deflection arc ────────
  const drawSelectedOrbitRing = (satId: string, scene: THREE.Scene, visData?: any) => {
    clearDeflectionGroup();
    const group = deflectionGroupRef.current;
    if (!group) return;

    // 1. If we have backend visualizationData, draw the real paths!
    if (visData) {
      // Draw nominal protected asset path (Cyan/Blue)
      if (visData.protected_asset_path) {
        const pts: THREE.Vector3[] = visData.protected_asset_path.map((pt: any) => {
          const [x, y, z] = pt.position_teme_km || pt.position_ecef_km;
          return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
        });
        if (pts.length > 0) {
          const mat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 1.0 });
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
          line.name = 'selected-ring';
          group.add(line);
        }
      }

      // Draw nominal candidate threat path (Red/Orange)
      if (visData.candidate_path) {
        const pts: THREE.Vector3[] = visData.candidate_path.map((pt: any) => {
          const [x, y, z] = pt.position_teme_km || pt.position_ecef_km;
          return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
        });
        if (pts.length > 0) {
          const mat = new THREE.LineBasicMaterial({ color: 0xff3355, transparent: true, opacity: 1.0 });
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
          line.name = 'candidate-ring';
          group.add(line);
        }
      }

      // Draw post-maneuver path (Green dashed) if approved
      const hasManeuver = maneuverPlans.some(p => p.satelliteId === satId && p.status === 'approved');
      if (hasManeuver && visData.maneuver_path) {
        const pts: THREE.Vector3[] = visData.maneuver_path.map((pt: any) => {
          const [x, y, z] = pt.position_teme_km || pt.position_ecef_km;
          return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
        });
        if (pts.length > 0) {
          const mat = new THREE.LineDashedMaterial({
            color: 0x00ff88,
            dashSize: 0.15,
            gapSize: 0.07,
            transparent: true,
            opacity: 0.9,
          });
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
          line.computeLineDistances();
          line.name = 'deflection-arc';
          group.add(line);
        }
      }
      
      // Draw Danger Zone sphere at closest approach
      if (visData.danger_zone && visData.candidate_path && visData.candidate_path.length > 0) {
        const tcaIdx = Math.floor(visData.candidate_path.length / 2);
        const pt = visData.candidate_path[tcaIdx];
        if (pt) {
          const [x, y, z] = pt.position_teme_km || pt.position_ecef_km;
          const pos = new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
          const geo = new THREE.SphereGeometry(Math.max(0.08, (visData.danger_zone.radius_km || 0.15) * SCALE), 16, 16);
          const mat = new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.15, wireframe: true });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.copy(pos);
          mesh.name = 'danger-zone-sphere';
          group.add(mesh);
        }
      }

      return;
    }

    // 2. Fallback: Draw default local TLE nominal/deflection if no backend visData is fetched
    const sat = satellites.find(s => s.id === satId);
    if (!sat?.tleLine1 || !sat?.tleLine2) return;

    const tStart = new Date();
    const periodMs = sat.period * 60 * 1000;

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
      const t = new Date(tStart.getTime() + (i / ORBIT_SEGMENTS) * periodMs);
      const state = propagateTLE(sat.tleLine1, sat.tleLine2, t);
      if (state) pts.push(new THREE.Vector3(state.position.x * SCALE, state.position.z * SCALE, state.position.y * SCALE));
    }

    const isHazard = sat.riskLevel !== 'green';
    const ringColor = isHazard ? 0xff3355 : 0x00f0ff;
    const ringMat = new THREE.LineBasicMaterial({ color: ringColor, transparent: true, opacity: 1.0 });
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
    ring.name = 'selected-ring';
    group.add(ring);

    const hasManeuver = maneuverPlans.some(p => p.satelliteId === satId && p.status === 'approved');
    if (hasManeuver) {
      const shiftX = 0.28 * Math.sin((sat.inclination * Math.PI) / 180);
      const shiftZ = 0.18 * Math.cos((sat.inclination * Math.PI) / 180);

      const defPts = pts.map((p, idx) => {
        const factor = Math.sin((idx / ORBIT_SEGMENTS) * Math.PI);
        return new THREE.Vector3(p.x + shiftX * factor, p.y, p.z + shiftZ * factor);
      });

      const defMat = new THREE.LineDashedMaterial({
        color: 0x00ff88,
        dashSize: 0.15,
        gapSize: 0.07,
        transparent: true,
        opacity: 0.9,
      });
      const defLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(defPts), defMat);
      defLine.computeLineDistances();
      defLine.name = 'deflection-arc';
      group.add(defLine);
    }
  };

  const clearDeflectionGroup = () => {
    const group = deflectionGroupRef.current;
    if (!group) return;
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Line;
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
      group.remove(child);
    }
  };

  // ─── Conjunction distance line overlays ───────────
  const updateConjunctionOverlay = (scene: THREE.Scene, camera: THREE.PerspectiveCamera, simTime: Date) => {
    const group = conjunctionLinesGroupRef.current;
    if (!group) return;
    while (group.children.length > 0) group.remove(group.children[0]);

    const overlays: typeof activeOverlayConjunctions = [];

    conjunctionEvents.forEach((event) => {
      if (event.status !== 'active') return;
      const meshA = scene.getObjectByName(event.primaryId) as THREE.Mesh | undefined;
      const meshB = scene.getObjectByName(event.secondaryId) as THREE.Mesh | undefined;
      if (!meshA || !meshB) return;

      const posA = meshA.position;
      const posB = meshB.position;
      const distUnits = posA.distanceTo(posB);
      const distanceKm = distUnits * 1000;

      if (distUnits < 4.0) {
        const pts = [posA.clone(), posB.clone()];
        const color = event.riskLevel === 'red' ? 0xff3355 : 0xffb829;
        const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
        group.add(line);

        // Small sphere at midpoint
        const mid = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 8, 8),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
        );
        sphere.position.copy(mid);
        group.add(sphere);

        // Screen-space label
        const projMid = mid.clone().project(camera);
        if (mountRef.current) {
          const w = mountRef.current.clientWidth;
          const h = mountRef.current.clientHeight;
          overlays.push({
            id: event.id,
            label: `${event.primaryName.slice(0, 9)} ⟷ ${event.secondaryName.slice(0, 9)}`,
            distanceKm,
            x: (projMid.x * 0.5 + 0.5) * w,
            y: (-(projMid.y * 0.5) + 0.5) * h,
            visible: projMid.z <= 1.0,
          });
        }
      }
    });

    setActiveOverlayConjunctions(overlays);
  };

  // ─── Camera focus on conjunction TCA ─────────────
  const focusOnConjunctionEvent = (event: ConjunctionEvent) => {
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return;
    const satA = satellites.find(s => s.id === event.primaryId);
    if (!satA?.tleLine1 || !satA?.tleLine2) return;

    const tcaMs = new Date(event.tca).getTime();
    timeOffsetRef.current = Math.max(0, Math.min(72, (tcaMs - Date.now()) / 3600000));
    setSelectedObject(satA.id);

    const state = propagateTLE(satA.tleLine1, satA.tleLine2, new Date(tcaMs));
    if (state) {
      const p = new THREE.Vector3(state.position.x * SCALE, state.position.z * SCALE, state.position.y * SCALE);
      cameraRef.current.position.set(p.x + 3, p.y + 1.5, p.z + 3);
      controlsRef.current.target.copy(p);
    }
  };

  // ─── Canvas interaction ───────────────────────────
  const handleCanvasMouseMove = (event: MouseEvent) => {
    if (!cameraRef.current || !sceneRef.current || !rendererRef.current) return;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const hits = raycasterRef.current.intersectObjects(objectsRef.current.map(o => o.mesh));
    if (hits.length > 0) {
      hoveredObjectRef.current = hits[0].object.name;
      rendererRef.current.domElement.style.cursor = 'pointer';
    } else {
      hoveredObjectRef.current = null;
      rendererRef.current.domElement.style.cursor = 'default';
    }
  };

  const handleCanvasClick = () => {
    if (hoveredObjectRef.current) {
      setSelectedObject(hoveredObjectRef.current);
    } else {
      setSelectedObject(null);
      isTransitioningZoomOut.current = true;
    }
  };

  // ─── View control helpers ─────────────────────────
  const toggleSatellites = () => {
    const next = !showSatellites;
    setShowSatellites(next);
    objectsRef.current.forEach(o => { if (o.type === 'satellite') o.mesh.visible = next; });
  };

  const toggleLargeDebris = () => {
    const next = !showLargeDebris;
    setShowLargeDebris(next);
    objectsRef.current.forEach(o => { if (o.type === 'large-debris') o.mesh.visible = next; });
  };

  const toggleTrajectories = () => {
    const next = !trajectoriesVisible;
    setTrajectoriesVisible(next);
    if (orbitLinesGroupRef.current) orbitLinesGroupRef.current.visible = next;
  };

  const resetView = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(20, 12, 20);
      controlsRef.current.target.set(0, 0, 0);
      setSelectedObject(null);
    }
  };

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  if (!isMounted) {
    return (
      <div className="relative w-full h-full bg-void overflow-hidden flex items-center justify-center rounded-[4px] border border-iron">
        <div className="text-ash font-data text-sm animate-pulse">Initializing 3D Telemetry Canvas...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-void overflow-hidden rounded-[4px] border border-iron font-display">

      {/* WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full" />

      {/* ── MANEUVER VISUALIZATION MODE UI OVERLAYS ────── */}
      {isManeuverMode ? (
        <>
          {/* Top Left info overlay */}
          <div className="absolute top-3 left-4 bg-void/90 border border-white/10 px-3 py-2 rounded-lg z-20 font-data space-y-0.5 select-none pointer-events-none">
            <div className="flex items-center space-x-1.5 text-orbit-cyan font-bold text-[11px] uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-orbit-cyan animate-pulse" />
              <span>3D Maneuver Planner</span>
            </div>
            <div className="text-[9px] text-ash font-mono uppercase">
              Showing active threat encounter coordinates
            </div>
          </div>

          {/* Bottom play/scrub bar overlay */}
          {protectedAssetTrajectory && protectedAssetTrajectory.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 bg-void/95 border border-white/10 p-2.5 rounded-lg z-20 flex items-center space-x-3 shadow-2xl max-w-[92%] sm:max-w-md md:max-w-lg">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1.5 border border-white/10 hover:border-white/20 hover:bg-white/5 text-ash hover:text-bone rounded cursor-pointer transition-colors shrink-0"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={protectedAssetTrajectory.length - 1}
                value={simIndex}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  simIndexRef.current = val;
                  setSimIndex(val);
                  setIsPlaying(false); // Pause on scrub
                }}
                className="flex-1 cursor-pointer accent-orbit-cyan h-1 bg-abyss rounded-lg appearance-none"
              />
              <div className="font-mono text-[10px] text-bone shrink-0 min-w-[95px] text-right">
                {(() => {
                  const pt = protectedAssetTrajectory[simIndex];
                  if (!pt || !tcaTime) return "";
                  const diffMs = new Date(pt.t).getTime() - new Date(tcaTime).getTime();
                  const diffHrs = diffMs / 3600000;
                  if (Math.abs(diffHrs) < 0.01) return "TCA";
                  return `${diffHrs > 0 ? "+" : ""}${diffHrs.toFixed(2)}h from TCA`;
                })()}
              </div>
              <button
                onClick={() => {
                  if (cameraRef.current && controlsRef.current && tcaPosition) {
                    const [tx, ty, tz] = tcaPosition;
                    const tcaPos = new THREE.Vector3(tx * SCALE, tz * SCALE, ty * SCALE);
                    controlsRef.current.target.copy(tcaPos);
                    cameraRef.current.position.set(tcaPos.x + 3.5, tcaPos.y + 2.0, tcaPos.z + 3.5);
                    controlsRef.current.update();
                  }
                }}
                className="p-1.5 border border-white/10 hover:border-white/20 hover:bg-white/5 text-ash hover:text-bone rounded cursor-pointer transition-colors text-[9px] uppercase font-mono tracking-wider shrink-0"
                title="Recenter Camera on TCA"
              >
                Recenter
              </button>
            </div>
          )}

          {/* Bottom Right Legend overlay */}
          <div className="absolute bottom-20 right-4 bg-void/90 border border-white/10 p-3 rounded-lg font-mono text-[9px] z-20 space-y-1.5 pointer-events-none select-none animate-in fade-in duration-300">
            <span className="text-[9px] font-bold text-graphite uppercase tracking-wider block border-b border-white/5 pb-1 mb-1">
              Orbit Legend
            </span>
            <div className="flex items-center space-x-2">
              <span className="w-5 h-[2px] bg-orbit-cyan inline-block shrink-0" />
              <span className="text-ash">Protected Asset (Nominal)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-5 h-[2px] bg-collision-red inline-block shrink-0" />
              <span className="text-ash">Threat Candidate (Nominal)</span>
            </div>
            {maneuverTrajectory && (
              <div className="flex items-center space-x-2">
                <span className="w-5 h-[2px] inline-block shrink-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #00f0ff 0, #00f0ff 3px, transparent 3px, transparent 6px)', height: '2px' }} />
                <span className="text-ash">Post-Burn Trajectory (Dashed)</span>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full border border-collision-red bg-collision-red/20 inline-block shrink-0 animate-pulse" />
              <span className="text-ash">Danger Zone ({safetyRadiusKm ? safetyRadiusKm.toFixed(1) : "0.15"} km)</span>
            </div>
          </div>
        </>
      ) : (
        /* ── STANDARD CATALOG MODE UI OVERLAYS ────── */
        <>
          {/* Live Separation Labels */}
          <div className="absolute inset-0 pointer-events-none z-10">
            {activeOverlayConjunctions.map(conj => conj.visible && (
              <div
                key={conj.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 bg-void/95 border border-collision-red/80 px-2.5 py-1 rounded-[2px] font-data text-[10px] text-bone flex flex-col space-y-0.5 shadow-[0_0_10px_rgba(255,51,85,0.25)]"
                style={{ left: `${conj.x}px`, top: `${conj.y}px` }}
              >
                <span className="font-semibold text-ash">{conj.label}</span>
                <span className="text-collision-red font-bold font-mono">
                  {conj.distanceKm < 1.0
                    ? `${(conj.distanceKm * 1000).toFixed(0)} m`
                    : `${conj.distanceKm.toFixed(3)} km`}
                </span>
              </div>
            ))}
          </div>

          {/* TOP HEADER BAR */}
          {!compact && (
            <div className="absolute top-0 left-0 right-0 h-9 bg-void/80 border-b border-iron/40 flex items-center px-4 z-20 space-x-6">
              <div className="flex items-center space-x-2">
                <Activity className="h-3.5 w-3.5 text-orbit-cyan animate-pulse" />
                <span className="font-data text-[10.5px] text-bone font-bold tracking-widest uppercase">OrbitGuard — Live 3D Telemetry</span>
              </div>
              <div className="flex items-center space-x-4 ml-auto font-data text-[10px] text-ash">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-orbit-cyan inline-block" />
                  <span>{stats.satellites} Satellites</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-graphite inline-block" />
                  <span>{stats.largeDebris} Debris Objects</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-collision-red animate-ping inline-block" />
                  <span className="text-collision-red font-bold">{stats.conjunctions} Active Threats</span>
                </span>
              </div>
            </div>
          )}

          {/* LEFT PANEL: Conjunction Events */}
          {!compact && (
            <div className={cn(
              "absolute top-12 left-4 bg-void/90 border border-iron p-4 rounded-[4px] w-[260px] max-h-[78%] overflow-y-auto scrollbar-thin transition-all duration-300 z-20 space-y-4",
              !panelExpanded ? "h-[44px] overflow-hidden" : ""
            )}>
              <div className="flex items-center justify-between border-b border-iron/60 pb-2">
                <div className="flex items-center space-x-1.5 text-bone font-bold text-[12px] tracking-wide">
                  <ShieldAlert className="h-4 w-4 text-collision-red animate-pulse" />
                  <span>CONJUNCTION EVENTS</span>
                </div>
                <button
                  onClick={() => setPanelExpanded(!panelExpanded)}
                  className="p-1 border border-iron hover:border-graphite text-ash hover:text-bone rounded cursor-pointer"
                >
                  <ChevronDown className={cn("h-3 w-3 transition-transform", panelExpanded ? "rotate-180" : "")} />
                </button>
              </div>

              {panelExpanded && (
                <div className="space-y-2">
                  {conjunctionEvents.filter(e => e.status === 'active').length === 0 ? (
                    <div className="text-[10.5px] text-graphite text-center italic py-4">No active threats.</div>
                  ) : (
                    conjunctionEvents.filter(e => e.status === 'active').map(event => (
                      <button
                        key={event.id}
                        onClick={() => focusOnConjunctionEvent(event)}
                        className="w-full text-left p-2.5 rounded-[2px] bg-abyss border border-iron/80 hover:border-collision-red/50 transition-all flex flex-col space-y-1.5 cursor-pointer group"
                      >
                        <div className="flex justify-between items-center border-b border-iron/40 pb-1">
                          <span className="font-data text-[10.5px] text-bone font-bold group-hover:text-orbit-cyan">{event.id}</span>
                          <span className={cn(
                            "text-[8.5px] font-bold px-1.5 py-px rounded-[2px] border",
                            event.riskLevel === 'red'
                              ? "bg-collision-red/10 border-collision-red/35 text-collision-red"
                              : "bg-threat-amber/10 border-threat-amber/35 text-threat-amber"
                          )}>
                            {event.riskLevel.toUpperCase()}
                          </span>
                        </div>
                        <div className="font-data text-[9.5px] text-ash space-y-0.5">
                          <div className="truncate text-bone">{event.primaryName} vs {event.secondaryName}</div>
                          <div className="flex justify-between">
                            <span>Miss Dist:</span>
                            <span className="font-bold">{event.missDistanceMeters.toLocaleString()} m</span>
                          </div>
                          <div className="flex justify-between">
                            <span>TCA:</span>
                            <span>{new Date(event.tca).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* RIGHT PANEL: Controls */}
          {!compact && (
            <div className="absolute top-12 right-4 bg-void/90 border border-iron p-4 rounded-[4px] w-[220px] z-20 space-y-4">
              <div>
                <span className="text-[9px] font-bold text-graphite uppercase tracking-wider block border-b border-iron/60 pb-1.5 mb-2.5">
                  Layer Filters
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={toggleSatellites}
                    className={cn(
                      "py-1.5 px-2 rounded-[2px] border font-data text-[9px] uppercase cursor-pointer text-center transition-colors",
                      showSatellites ? "bg-orbit-cyan/10 border-orbit-cyan/35 text-orbit-cyan" : "bg-abyss border-iron text-ash"
                    )}
                  >
                    Satellites
                  </button>
                  <button
                    onClick={toggleLargeDebris}
                    className={cn(
                      "py-1.5 px-2 rounded-[2px] border font-data text-[9px] uppercase cursor-pointer text-center transition-colors",
                      showLargeDebris ? "bg-collision-red/10 border-collision-red/35 text-collision-red" : "bg-abyss border-iron text-ash"
                    )}
                  >
                    Large Debris
                  </button>
                  <button
                    onClick={toggleTrajectories}
                    className={cn(
                      "py-1.5 px-2 rounded-[2px] border font-data text-[9px] uppercase cursor-pointer text-center transition-colors col-span-2",
                      trajectoriesVisible ? "bg-purple-600/10 border-purple-400/35 text-purple-300" : "bg-abyss border-iron text-ash"
                    )}
                  >
                    {trajectoriesVisible ? <><Eye className="h-3 w-3 inline mr-1" />Trajectories ON</> : <><EyeOff className="h-3 w-3 inline mr-1" />Trajectories OFF</>}
                  </button>
                  <button
                    onClick={() => setShowSmallDebris(v => !v)}
                    className={cn(
                      "py-1.5 px-2 rounded-[2px] border font-data text-[9px] uppercase cursor-pointer text-center transition-colors col-span-2",
                      showSmallDebris ? "bg-threat-amber/10 border-threat-amber/35 text-threat-amber" : "bg-abyss border-iron text-ash"
                    )}
                  >
                    {showSmallDebris ? <><Layers className="h-3 w-3 inline mr-1" />Debris Cloud ON</> : <><Layers className="h-3 w-3 inline mr-1" />Debris Cloud OFF</>}
                  </button>
                </div>
              </div>

              {/* Timeline slider */}
              <div className="space-y-1.5 border-t border-iron/50 pt-3">
                <div className="flex justify-between items-center text-[10px] text-ash">
                  <span className="font-bold uppercase tracking-wider">Sim Timeline (+72h)</span>
                  <span ref={timeTextRef} className="font-data text-orbit-cyan font-bold">+0.0h</span>
                </div>
                <input
                  ref={sliderRef}
                  type="range" min={0} max={72} step={0.1} defaultValue={0}
                  onChange={(e) => { timeOffsetRef.current = parseFloat(e.target.value); }}
                  className="w-full cursor-pointer accent-orbit-cyan"
                />
              </div>

              {/* Pause/Play + Reset */}
              <div className="flex gap-2 border-t border-iron/50 pt-3">
                <button
                  onClick={() => setAnimationPaused(v => !v)}
                  className="flex-1 py-1.5 px-2 border border-iron hover:border-graphite text-ash hover:text-bone rounded-[2px] font-data text-[9px] uppercase tracking-wide cursor-pointer flex items-center justify-center space-x-1 transition-colors"
                >
                  {animationPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                  <span>{animationPaused ? 'Resume' : 'Pause'}</span>
                </button>
                <button
                  onClick={resetView}
                  className="flex-1 py-1.5 px-2 border border-iron hover:border-graphite text-ash hover:text-bone rounded-[2px] font-data text-[9px] uppercase tracking-wide cursor-pointer flex items-center justify-center space-x-1 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          )}

          {/* SELECTED OBJECT INSPECTOR */}
          {!compact && selectedObject && (
            <div className="absolute bottom-4 left-4 bg-void/95 border border-iron p-4 rounded-[4px] w-[280px] z-20 space-y-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
              {(() => {
                const sat = satellites.find(s => s.id === selectedObject);
                if (!sat) return <div className="text-[10px] text-ash font-data animate-pulse">Querying NORAD catalog...</div>;

                const isDebris = sat.objectType === 'debris';
                const activeConj = conjunctionEvents.find(c => c.primaryId === sat.id && c.status === 'active');
                const satManeuver = maneuverPlans.find(p => p.satelliteId === sat.id && p.status === 'approved');

                return (
                  <div className="space-y-3">
                    <div className="flex justify-between items-start border-b border-iron/60 pb-1.5">
                      <div>
                        <h3 className="font-bold text-bone text-[13px]">{sat.name}</h3>
                        <span className="font-data text-[10px] text-ash">NORAD #{sat.noradId}</span>
                      </div>
                      <button
                        onClick={() => { setSelectedObject(null); isTransitioningZoomOut.current = true; }}
                        className="p-1 border border-iron hover:border-graphite text-ash hover:text-bone rounded cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 font-data text-[10px] text-ash">
                      {[
                        { label: 'TYPE', val: isDebris ? 'Space Debris' : 'Operational Sat' },
                        { label: 'INCLINATION', val: `${sat.inclination.toFixed(2)}°` },
                        { label: 'ALTITUDE', val: `${sat.altitude.toFixed(1)} km` },
                        { label: 'FUEL', val: `${sat.fuelRemainingPct.toFixed(1)}%` },
                        { label: 'PERIOD', val: `${sat.period.toFixed(1)} min` },
                        { label: 'RISK LEVEL', val: sat.riskLevel.toUpperCase() },
                      ].map(({ label, val }) => (
                        <div key={label} className="bg-abyss border border-iron/40 p-1.5 rounded-[2px]">
                          <span className="text-graphite text-[9px] block">{label}</span>
                          <span className={cn("font-semibold", label === 'RISK LEVEL' && sat.riskLevel === 'red' ? 'text-collision-red' : 'text-bone')}>{val}</span>
                        </div>
                      ))}
                    </div>

                    {satManeuver && (
                      <div className="bg-cleared-green/5 border border-cleared-green/30 p-2 rounded-[2px] text-[10px]">
                        <div className="font-bold text-cleared-green flex items-center space-x-1">
                          <Zap className="h-3 w-3" /><span>APPROVED MANEUVER</span>
                        </div>
                        <p className="text-ash mt-0.5 font-data text-[9px]">
                          Burn at {satManeuver.burnTime.slice(11, 19)} UTC · +{satManeuver.deltaV.toFixed(2)} m/s prograde
                        </p>
                      </div>
                    )}

                    {activeConj && (
                      <div className="bg-collision-red/5 border border-collision-red/30 p-2 rounded-[2px] text-[10px] space-y-1">
                        <span className="font-bold text-collision-red">⚠ CRITICAL CONJUNCTION</span>
                        <div className="font-data text-[9.5px] text-ash space-y-0.5">
                          <div>vs {activeConj.secondaryName}</div>
                          <div>Miss Distance: {activeConj.missDistanceMeters.toLocaleString()} m</div>
                          <div>Pc: {activeConj.pcDisplay}</div>
                        </div>
                      </div>
                    )}

                    <Link
                      href={`/maneuvers?event=${activeConj ? activeConj.id : ''}`}
                      className="w-full py-2 bg-orbit-cyan hover:bg-[#00c5dd] text-void font-bold text-[10.5px] uppercase tracking-wide text-center block rounded-[2px] transition-colors"
                    >
                      Maneuver Simulator →
                    </Link>
                  </div>
                );
              })()}
            </div>
          )}

          {/* BOTTOM RIGHT LEGEND */}
          {!compact && (
            <div className="absolute bottom-4 right-4 bg-void/90 border border-iron p-3.5 rounded-[4px] font-mono text-[9px] z-20 space-y-2">
              <span className="text-[9px] font-bold text-graphite uppercase tracking-wider block border-b border-iron/60 pb-1 mb-1">
                Orbit Legend
              </span>
              {[
                { color: '#00bae2', label: 'Nominal Trajectory', dashed: false },
                { color: '#ff3355', label: 'Critical Hazard (animated)', dashed: true },
                { color: '#ffb829', label: 'Caution Orbit (animated)', dashed: true },
                { color: '#4a4e55', label: 'Debris Object Track', dashed: false },
                { color: '#00ff88', label: 'Post-Burn Deflection', dashed: true },
                { color: '#8e9096', label: 'Kessler Debris Cloud', dot: true },
              ].map(({ color, label, dashed, dot }) => (
                <div key={label} className="flex items-center space-x-2">
                  {dot
                    ? <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
                    : <span
                        className="w-5 h-px inline-block shrink-0"
                        style={{
                          backgroundColor: color,
                          backgroundImage: dashed ? `repeating-linear-gradient(90deg, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)` : 'none',
                          height: '2px',
                        }}
                      />
                  }
                  <span className="text-ash">{label}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EarthView;