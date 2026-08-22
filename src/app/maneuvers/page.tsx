"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Zap,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Sparkles,
  ChevronDown,
  Clock,
  Gauge,
  Compass,
  FileText,
  Activity,
  Terminal,
  Database,
  Target,
  ShieldCheck,
  Send,
  Loader2,
  X
} from "lucide-react";

const EarthView = dynamic(() => import("@/components/EarthView"), { ssr: false });
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { ConjunctionEvent, Satellite, ManeuverPlan } from "@/types";
import { calculateFuelCost, predictNewMissDistance } from "@/lib/orbital-physics";
import { soundSynth } from "@/lib/sound-effects";
import LifecycleTimeline from "@/components/dashboard/LifecycleTimeline";

interface CalculateAPIResponse {
  options: ManeuverPlan[];
  event: ConjunctionEvent;
  satellite: Satellite;
}

type BurnDirection = 'prograde' | 'retrograde' | 'radial-in' | 'radial-out' | 'normal' | 'antinormal';

function ManeuversPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventParamId = searchParams.get("event");

  // State Management
  const [activeEvents, setActiveEvents] = React.useState<ConjunctionEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = React.useState<string>("");
  const [eventData, setEventData] = React.useState<ConjunctionEvent | null>(null);
  const [satelliteData, setSatelliteData] = React.useState<Satellite | null>(null);
  
  const [options, setOptions] = React.useState<ManeuverPlan[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [calculating, setCalculating] = React.useState(false);
  
  // Selection & Approval
  const [selectedOptionIndex, setSelectedOptionIndex] = React.useState<number>(1); // default to Balanced
  const [approvedPlan, setApprovedPlan] = React.useState<ManeuverPlan | null>(null);
  const [countdownStr, setCountdownStr] = React.useState<string>("");
  const [isApproved, setIsApproved] = React.useState(false);
  const [uplinkStatus, setUplinkStatus] = React.useState<'idle' | 'sending' | 'success'>('idle');

  // What-If Sandbox State
  const [customDeltaV, setCustomDeltaV] = React.useState<number>(1.5);
  const [customLeadTimeHours, setCustomLeadTimeHours] = React.useState<number>(4.0);
  const [burnDirection, setBurnDirection] = React.useState<BurnDirection>('prograde');

  // Gated approval states
  const [comparisonData, setComparisonData] = React.useState<any>(null);
  const [operatorRole, setOperatorRole] = React.useState<'Senior' | 'Junior'>('Senior');
  const [tokenCountdown, setTokenCountdown] = React.useState<number | null>(null);
  const [tokenExpired, setTokenExpired] = React.useState<boolean>(false);
  const [authToken, setAuthToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (tokenCountdown === null) return;
    if (tokenCountdown <= 0) {
      setTokenExpired(true);
      return;
    }
    const timerId = setTimeout(() => {
      setTokenCountdown(tokenCountdown - 1);
    }, 1000);
    return () => clearTimeout(timerId);
  }, [tokenCountdown]);

  const handleRequestToken = () => {
    const mockToken = "TOKEN-" + Math.random().toString(36).substring(2, 10).toUpperCase() + "-" + Date.now().toString().slice(-4);
    setAuthToken(mockToken);
    setTokenCountdown(600); // 10 minutes
    setTokenExpired(false);
  };
  const [isCustomMode, setIsCustomMode] = React.useState<boolean>(false);
  const [devMode, setDevMode] = React.useState<boolean>(false);

  React.useEffect(() => {
    setAuthToken(null);
    setTokenCountdown(null);
    setTokenExpired(false);
  }, [selectedOptionIndex, isCustomMode]);

  // Telemetry Console Logs
  const [consoleLogs, setConsoleLogs] = React.useState<string[]>([]);
  const consoleBottomRef = React.useRef<HTMLDivElement>(null);

  // AI Briefing Preview State
  const [aiBriefingText, setAiBriefingText] = React.useState<string>("");
  const [loadingBriefing, setLoadingBriefing] = React.useState<boolean>(false);

  // 3D Visualization Trajectories
  const [protectedAssetTrajectory, setProtectedAssetTrajectory] = React.useState<any[]>([]);
  const [threatTrajectory, setThreatTrajectory] = React.useState<any[]>([]);
  const [maneuverTrajectory, setManeuverTrajectory] = React.useState<any[] | null>(null);
  const [tcaTime, setTcaTime] = React.useState<string>("");
  const [tcaPosition, setTcaPosition] = React.useState<[number, number, number] | undefined>(undefined);
  const [safetyRadiusKm, setSafetyRadiusKm] = React.useState<number>(0.15);

  // Fetch nominal visualization trajectories
  React.useEffect(() => {
    if (!selectedEventId) {
      setProtectedAssetTrajectory([]);
      setThreatTrajectory([]);
      setTcaTime("");
      setTcaPosition(undefined);
      setSafetyRadiusKm(0.15);
      return;
    }

    const candidateId = selectedEventId.split("-").pop();
    if (!candidateId) return;

    const fetchNominal = async () => {
      try {
        const res = await fetch(`/api/visualize?candidate_id=${candidateId}&window_hours=6&step_seconds=60`);
        if (res.ok) {
          const data = await res.json();
          setProtectedAssetTrajectory(data.protected_asset_path || []);
          setThreatTrajectory(data.candidate_path || []);
          setTcaTime(data.danger_zone?.tca || "");
          setTcaPosition(data.danger_zone?.center_ecef_km);
          setSafetyRadiusKm(data.danger_zone?.radius_km || 0.15);
        }
      } catch (err) {
        console.error("Failed to fetch nominal visualizer paths:", err);
      }
    };
    fetchNominal();
  }, [selectedEventId]);

  // Fetch maneuver post-burn trajectory when selected plan changes
  React.useEffect(() => {
    if (!selectedEventId || options.length === 0 || isCustomMode) {
      setManeuverTrajectory(null);
      return;
    }

    const candidateId = selectedEventId.split("-").pop();
    const selectedPlan = options[selectedOptionIndex];
    if (!candidateId || !selectedPlan) {
      setManeuverTrajectory(null);
      return;
    }

    let optionLabel = "medium burn"; // default BAL
    if (selectedPlan.id.includes("MIN")) optionLabel = "small burn";
    else if (selectedPlan.id.includes("MAX")) optionLabel = "large burn";

    const fetchManeuver = async () => {
      try {
        const res = await fetch(`/api/visualize?candidate_id=${candidateId}&option_label=${encodeURIComponent(optionLabel)}&window_hours=6&step_seconds=60`);
        if (res.ok) {
          const data = await res.json();
          setManeuverTrajectory(data.maneuver_path || null);
        }
      } catch (err) {
        console.error("Failed to fetch maneuver path:", err);
      }
    };
    fetchManeuver();
  }, [selectedEventId, options, selectedOptionIndex, isCustomMode]);

  // 1. Fetch active conjunction events on mount
  React.useEffect(() => {
    async function loadActiveEvents() {
      try {
        const response = await fetch("/api/conjunction-events");
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            const active = data.filter((c) => c.status === "active");
            setActiveEvents(active);

            // Auto-load param event if exists
            if (eventParamId) {
              setSelectedEventId(eventParamId);
            } else if (active.length > 0) {
              setSelectedEventId(active[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load active events:", err);
      }
    }
    loadActiveEvents();
  }, [eventParamId]);

  // 2. Fetch specific event details & satellite details when selection changes
  React.useEffect(() => {
    if (!selectedEventId) return;

    // Reset old details
    setOptions([]);
    setIsApproved(false);
    setApprovedPlan(null);
    setIsCustomMode(false);
    setAiBriefingText("");
    setUplinkStatus('idle');

    async function loadEventContext() {
      setLoading(true);
      try {
        // Find in local activeEvents first, or fetch
        let evt = activeEvents.find((e) => e.id === selectedEventId);
        if (!evt) {
          const res = await fetch("/api/conjunction-events");
          if (res.ok) {
            const list: ConjunctionEvent[] = await res.json();
            evt = list.find((e) => e.id === selectedEventId) || undefined;
          }
        }

        if (evt) {
          setEventData(evt);
          
          // Fetch satellite details
          const satRes = await fetch("/api/satellites");
          if (satRes.ok) {
            const satList: Satellite[] = await satRes.json();
            const sat = satList.find((s) => s.id === evt?.primaryId);
            setSatelliteData(sat || null);
          }
          
          // Auto-calculate options
          triggerCalculation(selectedEventId);
        }
      } catch (err) {
        console.error("Error loading event context:", err);
      } finally {
        setLoading(false);
      }
    }

    loadEventContext();
  }, [selectedEventId, activeEvents]);

  // Fetch AI briefing summary
  const fetchBriefing = React.useCallback(async (eventId: string, planId?: string) => {
    if (!eventId) return;
    setLoadingBriefing(true);
    try {
      const response = await fetch("/api/ai-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conjunctionEventId: eventId, maneuverPlanId: planId }),
      });
      if (response.ok) {
        const data = await response.json();
        setAiBriefingText(data.briefingText);
      }
    } catch (error) {
      console.error("Error generating brief in maneuvers:", error);
    } finally {
      setLoadingBriefing(false);
    }
  }, []);

  // Update AI briefing whenever options or selection changes
  React.useEffect(() => {
    if (selectedEventId && options.length > 0) {
      const currentPlan = options[selectedOptionIndex];
      fetchBriefing(selectedEventId, currentPlan?.id);
    }
  }, [selectedEventId, options, selectedOptionIndex, fetchBriefing]);

  // 3. Trigger Maneuver Options Calculation API
  const triggerCalculation = async (eventId: string) => {
    if (!eventId) return;
    setCalculating(true);
    try {
      const response = await fetch("/api/maneuvers/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conjunctionEventId: eventId }),
      });

      if (response.ok) {
        const result: CalculateAPIResponse = await response.json();
        setOptions(result.options);
        setSelectedOptionIndex(1); // default to Balanced
        setComparisonData((result as any).comparison);
        // Set default sandbox custom slider values
        if (result.options.length > 1) {
          setCustomDeltaV(result.options[1].deltaV);
        }
      }
    } catch (err) {
      console.error("Failed to calculate options:", err);
    } finally {
      setCalculating(false);
    }
  };

  // 4. Approve and Schedule Maneuver Plan API
  const handleApproveManeuver = async (plan: ManeuverPlan) => {
    if (!satelliteData) return;
    if (operatorRole === "Junior" && plan.propellantMassKg > 5.0) {
      alert("Role Block: Junior operators are not permitted to authorize maneuvers consuming more than 5.0 kg of propellant.");
      return;
    }
    try {
      const response = await fetch("/api/maneuvers/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maneuverPlanId: plan.id,
          satelliteId: satelliteData.id,
          plan: plan,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setApprovedPlan(result.plan);
        setIsApproved(true);
      }
    } catch (err) {
      console.error("Failed to approve maneuver plan:", err);
    }
  };

  // 5. Countdown timer for approved burn time
  React.useEffect(() => {
    if (!isApproved || !approvedPlan) return;

    const interval = setInterval(() => {
      const burnTimeMs = new Date(approvedPlan.burnTime).getTime();
      const diffMs = burnTimeMs - Date.now();

      if (diffMs <= 0) {
        setCountdownStr("Burn executing now...");
        clearInterval(interval);
      } else {
        const seconds = Math.floor((diffMs / 1000) % 60);
        const minutes = Math.floor((diffMs / 1000 / 60) % 60);
        const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
        setCountdownStr(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isApproved, approvedPlan]);

  // "What-If" Live Physics Predictions (Clohessy-Wiltshire Solver)
  const whatIfResults = React.useMemo(() => {
    if (!eventData || !satelliteData) return null;

    const m0 = satelliteData.estimatedMassKg || 500;
    const isp = 220;
    const tcaTime = new Date(eventData.tca).getTime();
    
    // Set custom burn time ISO
    const burnTimeISO = new Date(tcaTime - customLeadTimeHours * 60 * 60 * 1000).toISOString();
    
    // Calculate new miss distance & propellant cost
    const newMiss = predictNewMissDistance(
      eventData.missDistance, 
      customDeltaV, 
      burnTimeISO, 
      eventData.tca,
      burnDirection,
      satelliteData.altitude
    );
    const propellant = calculateFuelCost(customDeltaV, m0, isp);
    
    // Determine custom risk
    let customRisk: "green" | "yellow" | "red" = "green";
    if (newMiss < 2.0) {
      customRisk = "red";
    } else if (newMiss < 5.0) {
      customRisk = "yellow";
    }

    return {
      newMiss,
      propellant,
      customRisk,
      burnTimeISO
    };
  }, [eventData, satelliteData, customDeltaV, customLeadTimeHours, burnDirection]);

  // Generate Technical Log Streams for Mission Control Console
  React.useEffect(() => {
    if (!eventData || !satelliteData || !whatIfResults) return;

    const timeStr = new Date().toLocaleTimeString();
    const systemLogs = [
      `[${timeStr}] FLIGHT-DY: CW relative equations initialized for NORAD ${satelliteData.noradId}`,
      `[${timeStr}] SOLVER: Propagating satellite state vectors relative to primary target...`,
      `[${timeStr}] PARAM: Burn vector [direction=${burnDirection.toUpperCase()}] magnitude=${customDeltaV.toFixed(3)} m/s`,
      `[${timeStr}] COVARIANCE: Extrapolating error matrices (σR=300m, σT=1500m, σN=300m)`,
      `[${timeStr}] DYNAMICS: dt = ${(customLeadTimeHours * 3600).toFixed(0)} seconds (${customLeadTimeHours.toFixed(1)} hrs before TCA)`,
      `[${timeStr}] DYNAMICS: Mean motion n = ${((2 * Math.PI) / (satelliteData.period * 60)).toFixed(7)} rad/s`,
      `[${timeStr}] INTEGRATOR: Solve complete. Delta-Radius = ${(Math.abs(whatIfResults.newMiss - eventData.missDistance) * 1000).toFixed(1)} meters`,
      `[${timeStr}] RESULT: Projected TCA miss distance = ${whatIfResults.newMiss.toFixed(3)} km (Pc = ${whatIfResults.customRisk === 'green' ? '< 1e-5' : whatIfResults.customRisk === 'yellow' ? '4.2e-5' : '1.8e-4'})`,
      `[${timeStr}] FUEL: Thruster demand: ${whatIfResults.propellant.toFixed(3)} kg Xenon propellant required.`
    ];

    setConsoleLogs(systemLogs);
  }, [selectedEventId, customDeltaV, customLeadTimeHours, burnDirection, eventData, satelliteData, whatIfResults]);

  // Scroll terminal logs to bottom
  React.useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs]);

  const activePlan = isCustomMode && whatIfResults && eventData && satelliteData
    ? {
        id: `MP-CUST-${eventData.id}`,
        conjunctionEventId: eventData.id,
        satelliteId: satelliteData.id,
        burnDirection: burnDirection,
        deltaV: customDeltaV,
        burnTime: whatIfResults.burnTimeISO,
        burnTimingNote: `Custom optimized burn (${customLeadTimeHours.toFixed(1)}h before TCA)`,
        currentMissDistance: eventData.missDistance,
        newMissDistance: whatIfResults.newMiss,
        targetMissDistance: 5.0,
        propellantMassKg: whatIfResults.propellant,
        specificImpulse: 220,
        satelliteMassKg: satelliteData.estimatedMassKg || 500,
        status: "proposed" as const,
        createdAt: new Date().toISOString()
      }
    : options[selectedOptionIndex];

  // Dynamic SVG orbit deflection path calculation
  const getDeflectionPathCoords = () => {
    if (!activePlan || !eventData) return "";
    const shift = activePlan.newMissDistance - eventData.missDistance;
    const offset = Math.min(75, shift * 10); // Scale deflection km to pixels
    
    let dx = 0;
    let dy = 0;
    
    switch (burnDirection) {
      case 'prograde':
        dx = offset * 0.8;
        dy = -offset * 0.4;
        break;
      case 'retrograde':
        dx = -offset * 0.8;
        dy = offset * 0.4;
        break;
      case 'radial-out':
        dx = -offset * 0.7;
        dy = -offset * 0.7;
        break;
      case 'radial-in':
        dx = offset * 0.7;
        dy = offset * 0.7;
        break;
      case 'normal':
        dx = 0;
        dy = -offset;
        break;
      case 'antinormal':
        dx = 0;
        dy = offset;
        break;
    }
    
    const startX = 40;
    const startY = 170;
    const endX = 360;
    const endY = 30;
    
    const ctrlX = 200 + dx;
    const ctrlY = 100 + dy;
    
    return {
      original: `M ${startX} ${startY} Q 200 100 ${endX} ${endY}`,
      deflected: `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`,
      threatPoint: { x: 200, y: 100 },
      isSafe: activePlan.newMissDistance >= 5.0
    };
  };

  const svgCoords = getDeflectionPathCoords();

  // ─────────────────────────────────────────────────────────────
  // SVG Physics Chart Rendering Methods
  // ─────────────────────────────────────────────────────────────

  const renderPropellantCurve = () => {
    const width = 260;
    const height = 70;
    const padding = 12;
    
    const points = [];
    const maxVal = 15.0;
    for (let dv = 0.05; dv <= maxVal; dv += 0.5) {
      const fuel = calculateFuelCost(dv, satelliteData?.estimatedMassKg || 500, 220);
      const x = padding + (dv / maxVal) * (width - 2 * padding);
      const y = height - padding - (fuel / 15.0) * (height - 2 * padding);
      points.push(`${x},${y}`);
    }
    
    const curFuel = whatIfResults ? whatIfResults.propellant : 0;
    const curX = padding + (customDeltaV / maxVal) * (width - 2 * padding);
    const curY = height - padding - (Math.min(15.0, curFuel) / 15.0) * (height - 2 * padding);
    
    return (
      <div className="space-y-1.5 bg-[#05070a]/60 border border-iron/40 rounded p-2.5">
        <div className="flex justify-between items-center text-[8.5px] font-display font-bold text-graphite uppercase tracking-wider">
          <span>Propellant Mass Curve (Tsiolkovsky)</span>
          <span className="text-purple-400 font-data">{curFuel.toFixed(2)} kg</span>
        </div>
        <svg width={width} height={height} className="w-full">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1c1c1f" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#1c1c1f" strokeWidth="1" />
          <path d={`M ${points.join(' L ')}`} fill="none" stroke="#8052ff" strokeWidth="1.5" opacity="0.8" />
          <circle cx={curX} cy={curY} r="4" fill="#0ae448" className="animate-pulse" />
          <text x={padding + 3} y={padding + 8} fill="#404043" fontSize="7" fontFamily="monospace">15kg</text>
          <text x={width - padding - 34} y={height - padding - 2} fill="#404043" fontSize="7" fontFamily="monospace">15.0 m/s</text>
        </svg>
      </div>
    );
  };

  const renderLeadTimeCurve = () => {
    const width = 260;
    const height = 70;
    const padding = 12;
    
    const points = [];
    const minH = 1.0;
    const maxH = 24.0;
    for (let lt = minH; lt <= maxH; lt += 0.5) {
      const reqDv = 15.0 / lt;
      const x = padding + ((lt - minH) / (maxH - minH)) * (width - 2 * padding);
      const y = height - padding - (Math.min(15.0, reqDv) / 15.0) * (height - 2 * padding);
      points.push(`${x},${y}`);
    }
    
    const curX = padding + ((customLeadTimeHours - minH) / (maxH - minH)) * (width - 2 * padding);
    const reqDvCur = 15.0 / customLeadTimeHours;
    const curY = height - padding - (Math.min(15.0, reqDvCur) / 15.0) * (height - 2 * padding);
    
    return (
      <div className="space-y-1.5 bg-[#05070a]/60 border border-iron/40 rounded p-2.5">
        <div className="flex justify-between items-center text-[8.5px] font-display font-bold text-graphite uppercase tracking-wider">
          <span>Thrust Efficiency vs Lead Time</span>
          <span className="text-orbit-cyan font-data">{(15.0 / customLeadTimeHours).toFixed(2)} Efficiency</span>
        </div>
        <svg width={width} height={height} className="w-full">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1c1c1f" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#1c1c1f" strokeWidth="1" />
          <path d={`M ${points.join(' L ')}`} fill="none" stroke="#00bae2" strokeWidth="1.5" opacity="0.8" />
          <circle cx={curX} cy={curY} r="4" fill="#8052ff" className="animate-pulse" />
          <text x={padding + 3} y={padding + 8} fill="#404043" fontSize="7" fontFamily="monospace">Max ΔV</text>
          <text x={width - padding - 34} y={height - padding - 2} fill="#404043" fontSize="7" fontFamily="monospace">24h (Opt)</text>
        </svg>
      </div>
    );
  };

  const handleTransmitUplink = () => {
    setUplinkStatus('sending');
    soundSynth.playBeep();
    setTimeout(() => {
      setUplinkStatus('success');
      soundSynth.playChime();
    }, 2000);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 select-none p-2 animate-fade-in-slide">
      
      {/* 1. LEFT COLUMN: threat context selection & fleet status (3 cols) */}
      <div className="xl:col-span-3 space-y-6 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="h-4 w-4 text-ash" />
            <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-ash">
              Threat Context Selection
            </h2>
          </div>
          <button
            onClick={() => setDevMode(!devMode)}
            className={cn(
              "px-2 py-1 rounded text-[9px] font-mono border transition-all cursor-pointer",
              devMode
                ? "bg-orbit-cyan/15 border-orbit-cyan/60 text-orbit-cyan"
                : "bg-void/40 border-iron text-ash hover:text-bone hover:border-graphite"
            )}
            title="Dev Audit: Print raw JSON backend fields next to numbers"
          >
            {devMode ? "JSON AUDIT: ON" : "JSON AUDIT"}
          </button>
        </div>

        <Card className="p-4 space-y-5 bg-abyss border border-iron hover:border-graphite transition-all flex-grow">
          <div>
            <label className="font-display text-[10px] font-bold text-ash uppercase tracking-wider block mb-2">
              Active Orbit Threat Registry
            </label>
            <div className="relative">
              <select
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  router.push(`/maneuvers?event=${e.target.value}`);
                }}
                className="w-full bg-void border border-iron rounded-[4px] px-3 py-2.5 text-bone font-data text-[12px] focus:outline-none focus:border-orbit-cyan appearance-none cursor-pointer"
              >
                {activeEvents.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.id} vs {evt.secondaryName.slice(0, 15)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ash pointer-events-none" />
            </div>
          </div>

          {loading && (
            <div className="h-40 bg-void rounded-[4px] animate-pulse flex items-center justify-center text-graphite text-[12px] font-data">
              Syncing event registry...
            </div>
          )}

          {!loading && eventData && (
            <div className="space-y-4 border-t border-iron/50 pt-4">
              <div>
                <span className="font-display text-[10px] text-graphite uppercase tracking-wide block">Threat Target</span>
                <span className="font-data text-[13px] text-bone font-semibold uppercase block mt-0.5">
                  {eventData.secondaryName}
                </span>
                <span className="text-[10px] text-ash font-data block">ID: NORAD {eventData.secondaryId}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-void/50 p-3 rounded border border-iron/40">
                <div title={devMode ? "backend: alert.min_distance_km" : undefined}>
                  <span className="font-display text-[9px] text-graphite uppercase tracking-wide block">Current Miss</span>
                  <span className="font-data text-[12px] text-bone block mt-0.5">
                    {eventData.missDistanceMeters.toLocaleString()} m
                    {devMode && <span className="text-[8px] text-graphite font-mono block">alert.min_distance_km</span>}
                  </span>
                </div>
                <div title={devMode ? "backend: alert.risk_score (scaled to Pc)" : undefined}>
                  <span className="font-display text-[9px] text-graphite uppercase tracking-wide block">Collision Prob</span>
                  <span className="font-data text-[12px] text-collision-red block mt-0.5 font-bold">
                    {eventData.pcDisplay}
                    {devMode && <span className="text-[8px] text-graphite font-mono block">alert.risk_score</span>}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Asset Telemetry readout */}
          {!loading && satelliteData && (
            <div className="border-t border-iron/50 pt-4 space-y-3">
              <h3 className="font-display text-[10px] font-bold text-ash uppercase tracking-wider">
                Fleet Asset Telemetry
              </h3>
              <div className="bg-void/40 border border-iron/60 rounded-[4px] p-3.5 space-y-2.5 font-data text-[11px] text-ash">
                <div className="flex justify-between border-b border-iron/30 pb-1.5">
                  <span className="text-graphite">NAME:</span>
                  <span className="text-bone font-semibold">{satelliteData.name}</span>
                </div>
                <div className="flex justify-between border-b border-iron/30 pb-1.5">
                  <span className="text-graphite">NORAD ID:</span>
                  <span className="text-bone font-semibold">{satelliteData.noradId}</span>
                </div>
                <div className="flex justify-between border-b border-iron/30 pb-1.5">
                  <span className="text-graphite">ALTITUDE:</span>
                  <span className="text-bone font-semibold">{satelliteData.altitude.toFixed(2)} km</span>
                </div>
                <div className="flex justify-between border-b border-iron/30 pb-1.5">
                  <span className="text-graphite">PERIOD:</span>
                  <span className="text-bone font-semibold">{satelliteData.period.toFixed(2)} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-graphite">FUEL RESERVE:</span>
                  <span className={cn("font-bold", satelliteData.fuelRemainingPct > 35 ? "text-cleared-green" : "text-threat-amber")}>
                    {satelliteData.fuelRemainingPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {!loading && eventData && (
          <div className="flex-shrink-0 animate-slide-in">
            <LifecycleTimeline event={eventData} />
          </div>
        )}
      </div>

      {/* 2. CENTER COLUMN: Live Deflection Chart & Burn selection (6 cols) */}
      <div className="xl:col-span-6 space-y-6 flex flex-col">
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-orbit-cyan" />
          <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-ash">
            Maneuver Simulation Center
          </h2>
        </div>

        {options.length === 0 && !isApproved && (
          <Card className="flex flex-col items-center justify-center p-12 text-center space-y-4 bg-abyss border border-iron flex-grow">
            <div className="p-4 rounded-full bg-orbit-cyan/10 border border-orbit-cyan/30 text-orbit-cyan">
              <Compass className="h-8 w-8" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-display text-[14px] font-bold text-bone uppercase tracking-wider">
                Maneuver Options Uncalculated
              </h3>
              <p className="font-body text-[12px] text-ash mt-1 max-w-sm mx-auto leading-relaxed">
                Provide thruster burn delta-V calculations to alter satellite coordinates. Press button below to compile telemetry optimization grids.
              </p>
            </div>
          </Card>
        )}

        {options.length > 0 && !isApproved && (
          <div className="space-y-6 flex-grow flex flex-col">
            
            {/* Real-time 3D Trajectory Visualizer */}
            <Card className="bg-void border border-iron relative overflow-hidden flex flex-col justify-between h-[360px]">
              <div className="absolute top-3 left-4 flex items-center space-x-2 text-[10px] uppercase font-display text-graphite z-10">
                <Target className="h-3 w-3 text-orbit-cyan" />
                <span>3D Trajectory Visualization (Live Backend Feed)</span>
              </div>
              <div className="w-full h-full relative overflow-hidden rounded">
                {satelliteData && (
                  <EarthView 
                    selectedObject={satelliteData.id} 
                    compact={true} 
                    protectedAssetTrajectory={protectedAssetTrajectory}
                    threatTrajectory={threatTrajectory}
                    maneuverTrajectory={maneuverTrajectory}
                    tcaTime={tcaTime}
                    tcaPosition={tcaPosition}
                    safetyRadiusKm={safetyRadiusKm}
                  />
                )}
              </div>
            </Card>

            {/* Selection Options grid */}
            <div className="grid grid-cols-3 gap-4">
              {["Minimum Fuel", "Balanced", "Maximum Safety"].map((name, idx) => {
                const opt = options[idx];
                const active = !isCustomMode && selectedOptionIndex === idx;

                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedOptionIndex(idx);
                      setIsCustomMode(false);
                    }}
                    className={cn(
                      "border rounded-[4px] p-3 text-left transition-all relative flex flex-col justify-between cursor-pointer",
                      active
                        ? "bg-[#0c1b30] border-orbit-cyan shadow-[0_0_12px_rgba(0,186,226,0.1)]"
                        : "bg-abyss border-iron hover:border-graphite"
                    )}
                  >
                    <div className="border-b border-iron/40 pb-1.5 mb-1.5 w-full flex items-center justify-between">
                      <span className="font-display text-[10px] font-bold uppercase tracking-wider text-bone">
                        {name}
                      </span>
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-orbit-cyan animate-pulse" />
                      )}
                    </div>
                    
                    <div className="space-y-1.5 mt-0.5 font-data">
                      <div className="flex justify-between text-[11px]" title={devMode ? `backend: option[${idx}].delta_v_ms` : undefined}>
                        <span className="text-graphite uppercase text-[9px] font-display">Delta-V</span>
                        <span className="text-bone font-semibold">
                          {opt.deltaV.toFixed(2)} m/s
                          {devMode && <span className="text-[8px] text-graphite ml-1">.delta_v_ms</span>}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]" title={devMode ? `backend: option[${idx}].resulting_min_distance_km` : undefined}>
                        <span className="text-graphite uppercase text-[9px] font-display">New Miss</span>
                        <span className="text-orbit-cyan font-bold">
                          {opt.newMissDistance.toFixed(2)} km
                          {devMode && <span className="text-[8px] text-graphite ml-1">.resulting_min_distance_km</span>}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Sandbox Plan Card */}
            {activePlan && (
              <Card className="p-5 space-y-4 bg-abyss border border-iron">
                <div className="flex justify-between items-center border-b border-iron/50 pb-2">
                  <h3 className="font-display text-[11px] font-bold text-ash uppercase tracking-wider">
                    {isCustomMode ? 'Custom Sandbox Solution' : 'Operational Maneuver Solution'}
                  </h3>
                  <span className={cn(
                    "text-[9px] font-display font-bold uppercase tracking-widest px-2 py-0.5 rounded border",
                    isCustomMode 
                      ? "bg-plum-voltage/10 text-purple-400 border-purple-400/20"
                      : "bg-orbit-cyan/10 text-orbit-cyan border-orbit-cyan/20"
                  )}>
                    {isCustomMode ? 'SANDBOX ACTIVE' : 'PRESET SELECTED'}
                  </span>
                </div>
                
                <p className="font-body text-[12px] text-bone leading-relaxed">
                  A <strong className="text-orbit-cyan font-data" title={devMode ? "backend: chosen_option.delta_v_ms" : undefined}>
                    {activePlan.deltaV.toFixed(3)} m/s
                    {devMode && <span className="text-[8px] text-graphite font-mono"> [delta_v_ms]</span>}
                  </strong> thruster burn aligned <strong className="text-bone font-data uppercase">{activePlan.burnDirection}</strong> scheduled at <span className="font-data text-ash">{activePlan.burnTime.slice(11, 19)} UTC</span>. Projected approach offset expands to <strong className="text-cleared-green font-data" title={devMode ? "backend: chosen_option.resulting_min_distance_km" : undefined}>
                    {(activePlan.newMissDistance).toFixed(3)} km
                    {devMode && <span className="text-[8px] text-graphite font-mono"> [resulting_min_distance_km]</span>}
                  </strong>, expending <span className="font-data text-bone" title={devMode ? "backend: chosen_option.fuel_cost_kg" : undefined}>
                    {activePlan.propellantMassKg.toFixed(3)} kg
                    {devMode && <span className="text-[8px] text-graphite font-mono"> [fuel_cost_kg]</span>}
                  </span> Xenon propellant.
                </p>

                {/* Telemetry data matrix */}
                <div className="grid grid-cols-4 gap-3 bg-void/50 border border-iron/40 rounded p-3 font-data text-[11px] text-ash">
                  <div title={devMode ? "backend: chosen_option.delta_v_ms" : undefined}>
                    <span className="font-display text-[8px] text-graphite uppercase block">Velocity change</span>
                    <span className="text-bone font-semibold block mt-0.5">
                      {activePlan.deltaV.toFixed(3)} m/s
                      {devMode && <span className="text-[7px] text-graphite font-mono block">delta_v_ms</span>}
                    </span>
                  </div>
                  <div title={devMode ? "backend: chosen_option.fuel_cost_kg" : undefined}>
                    <span className="font-display text-[8px] text-graphite uppercase block">Fuel spent</span>
                    <span className="text-bone font-semibold block mt-0.5">
                      {activePlan.propellantMassKg.toFixed(3)} kg
                      {devMode && <span className="text-[7px] text-graphite font-mono block">fuel_cost_kg</span>}
                    </span>
                  </div>
                  <div title={devMode ? "backend: chosen_option.resulting_min_distance_km" : undefined}>
                    <span className="font-display text-[8px] text-graphite uppercase block">Offset Approach</span>
                    <span className="text-orbit-cyan font-bold block mt-0.5">
                      {activePlan.newMissDistance.toFixed(3)} km
                      {devMode && <span className="text-[7px] text-graphite font-mono block">resulting_min_distance_km</span>}
                    </span>
                  </div>
                  <div>
                    <span className="font-display text-[8px] text-graphite uppercase block">Burn Window</span>
                    <span className="text-bone font-semibold block mt-0.5">{activePlan.burnTime.slice(11, 19)} UTC</span>
                  </div>
                </div>

                {/* Trade-off Comparison Panel */}
                {comparisonData && (
                  <div className="bg-graphite/40 border border-white/10 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
                      <Sparkles className="h-4 w-4 text-orbit-cyan" />
                      <span className="font-mono text-[10px] text-ash uppercase tracking-wider">
                        Target Analysis & Trade-Off Comparison
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="font-sans text-[14px] leading-relaxed text-ash">
                        {comparisonData.reasoning}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        {comparisonData.ranked_options.map((opt: any, rIdx: number) => {
                          const isRecommended = comparisonData.recommended_option_id === opt.option_id;
                          const score = opt.composite_score;
                          const planType = opt.label === "small burn" ? "MIN" : opt.label === "large burn" ? "MAX" : "BAL";
                          const matchedPlan = options.find(p => p.id.includes(planType));
                          const resultingDist = matchedPlan ? matchedPlan.newMissDistance : (opt.resulting_min_distance_km ?? 0);
                          const fuelCost = matchedPlan ? matchedPlan.propellantMassKg : (opt.fuel_cost_kg ?? 0);

                          const isDivergent = matchedPlan?.cwDivergenceFlag;
                          const secWarning = matchedPlan?.secondaryConjunctionWarning;

                          return (
                            <div 
                              key={opt.option_id}
                              className={cn("p-3 rounded-lg border flex flex-col justify-between space-y-1.5", 
                                isRecommended 
                                  ? "bg-orbit-cyan/5 border-orbit-cyan/45 text-orbit-cyan font-bold"
                                  : "bg-void/40 border-white/5 text-ash",
                                score === 0 && "opacity-40 bg-zinc-950/60 border-zinc-800/40"
                              )}
                              title={devMode ? `comparison.ranked_options[${rIdx}]` : undefined}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-sans text-[12px] capitalize">
                                  {opt.label} {isRecommended && "★"}
                                  {score === 0 && " (Disqualified)"}
                                </span>
                                <span className="font-mono text-[11px]" title={devMode ? `ranked_options[${rIdx}].composite_score` : undefined}>
                                  Score: {score.toFixed(1)}
                                  {devMode && <span className="text-[7px] block text-graphite">composite_score</span>}
                                </span>
                              </div>
                              <div className="font-mono text-[10px] opacity-80 space-y-0.5">
                                <div title={devMode ? "backend: chosen_option.resulting_min_distance_km" : undefined}>
                                  Dist: {resultingDist.toFixed(2)} km
                                  {devMode && <span className="text-[7px] text-graphite ml-1">.resulting_min_distance_km</span>}
                                </div>
                                <div title={devMode ? "backend: chosen_option.fuel_cost_kg" : undefined}>
                                  Fuel: {fuelCost.toFixed(2)} kg
                                  {devMode && <span className="text-[7px] text-graphite ml-1">.fuel_cost_kg</span>}
                                </div>

                                {isDivergent && (
                                  <div className="text-[8px] text-threat-amber font-semibold uppercase mt-1 animate-pulse" title={devMode ? "backend: chosen_option.cw_divergence_flag" : undefined}>
                                    ⚠️ CW Divergence
                                    {devMode && <span className="text-[6px] block text-graphite">.cw_divergence_flag</span>}
                                  </div>
                                )}

                                {secWarning && (
                                  <div className="text-[8px] text-collision-red font-semibold uppercase mt-1" title={devMode ? "backend: chosen_option.secondary_conjunction_warning" : undefined}>
                                    ⚠️ Sec: {secWarning}
                                    {devMode && <span className="text-[6px] block text-graphite">.secondary_conjunction_warning</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Gated Warnings */}
                {(() => {
                  const parts = activePlan.id.split('-');
                  const candidateId = parts[parts.length - 1];
                  const idx = activePlan.id.includes('MIN') ? 1 : activePlan.id.includes('MAX') ? 3 : 2;
                  const optionId = `mnv_${candidateId}_${idx}`;
                  const isDisqualified = comparisonData?.ranked_options?.find((o: any) => o.option_id === optionId)?.composite_score === 0;
                  const isRoleBlocked = operatorRole === 'Junior' && activePlan && activePlan.propellantMassKg > 5.0;

                  return (
                    <>
                      {isDisqualified && (
                        <div className="bg-collision-red/10 border border-collision-red/30 text-collision-red p-4 rounded-xl space-y-2">
                          <span className="font-sans text-[14px] font-bold">⚠ MANEUVER BLOCKED — Secondary Conjunction Risk</span>
                          <p className="font-sans text-[12px] opacity-90">
                            This burn creates a new conjunction closer than the original threat separation. The system does not permit operator overrides for disqualified orbits.
                          </p>
                          <span className="font-mono text-[11px] block">Composite Score: 0.0/100</span>
                        </div>
                      )}

                      {isRoleBlocked && (
                        <div className="bg-collision-red/10 border border-collision-red/30 text-collision-red p-4 rounded-xl space-y-2">
                          <span className="font-sans text-[14px] font-bold">⚠ ACTION BLOCKED — Operator Role Restriction</span>
                          <p className="font-sans text-[12px] opacity-90">
                            Junior operators are not permitted to authorize maneuvers consuming more than 5.0 kg of propellant. This burn requires <strong>{activePlan.propellantMassKg.toFixed(2)} kg</strong>.
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Cryptographic Authorization Gate */}
                <div className="bg-void p-4 rounded-xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="font-mono text-[10px] text-ash uppercase tracking-wider">
                      Cryptographic Authorization Gate
                    </span>
                    {authToken && (
                      <span className={cn("font-mono text-[11px] font-bold px-2 py-0.5 rounded", 
                        tokenExpired ? "bg-collision-red/20 text-collision-red" : "bg-cleared-green/20 text-cleared-green animate-pulse"
                      )}>
                        {tokenExpired ? "EXPIRED" : "ACTIVE"}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      {authToken ? (
                        <>
                          <span className="font-mono text-[11px] text-orbit-cyan block break-all">
                            {authToken}
                          </span>
                          <span className="font-sans text-[11px] text-ash block">
                            Token valid for: <strong className="font-mono text-cloud">{Math.floor((tokenCountdown ?? 0) / 60)}:{((tokenCountdown ?? 0) % 60).toString().padStart(2, '0')}</strong>
                          </span>
                        </>
                      ) : (
                        <span className="font-sans text-[12px] text-ash italic">
                          Acquire an operator authorization token before burn transmission.
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleRequestToken}
                      className="px-4 py-2 bg-transparent border border-white/20 hover:border-pure text-pure hover:bg-white/5 rounded-lg font-sans text-[13px] font-medium transition-all shrink-0 cursor-pointer"
                    >
                      {authToken ? "Regenerate Token" : "Acquire Token →"}
                    </button>
                  </div>
                </div>

                {/* Live Terminal logs widget */}
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-graphite">
                    <Terminal className="h-3 w-3" />
                    <span className="text-[9px] uppercase font-display font-semibold">CW Solver Telemetry Logs</span>
                  </div>
                  <div className="h-28 overflow-y-auto bg-[#04060b] border border-iron rounded p-2.5 font-data text-[9.5px] leading-relaxed text-cleared-green/80 flex flex-col space-y-1 scrollbar-thin">
                    {consoleLogs.map((log, i) => (
                      <div key={i} className="whitespace-pre-wrap font-mono">
                        {log}
                      </div>
                    ))}
                    <div ref={consoleBottomRef} />
                  </div>
                </div>

                {/* Actions footer */}
                <div className="border-t border-iron/40 pt-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  {/* Operator Role Selector */}
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] text-ash uppercase tracking-wider">Role:</span>
                    <select
                      value={operatorRole}
                      onChange={(e) => setOperatorRole(e.target.value as 'Senior' | 'Junior')}
                      className="bg-void border border-iron rounded-[4px] px-2 py-1 text-[11px] text-bone font-sans focus:outline-none"
                    >
                      <option value="Senior">Senior Operator</option>
                      <option value="Junior">Junior Operator</option>
                    </select>
                  </div>

                  <div className="flex space-x-3">
                    <Link
                      href="/dashboard"
                      className="py-2 px-4 border border-iron rounded-[4px] text-ash hover:text-bone hover:bg-iron/10 text-[11px] font-display font-bold uppercase transition-colors"
                    >
                      Cancel
                    </Link>
                    {(() => {
                      const parts = activePlan.id.split('-');
                      const candidateId = parts[parts.length - 1];
                      const idx = activePlan.id.includes('MIN') ? 1 : activePlan.id.includes('MAX') ? 3 : 2;
                      const optionId = `mnv_${candidateId}_${idx}`;
                      const isDisqualified = comparisonData?.ranked_options?.find((o: any) => o.option_id === optionId)?.composite_score === 0;
                      const isRoleBlocked = operatorRole === 'Junior' && activePlan && activePlan.propellantMassKg > 5.0;

                      return (
                        <button
                          onClick={() => handleApproveManeuver(activePlan as any)}
                          disabled={isDisqualified || isRoleBlocked || !authToken || tokenExpired}
                          className={cn("py-2 px-6 font-bold text-[11px] font-display uppercase tracking-wider rounded-[4px] transition-colors cursor-pointer",
                            (isDisqualified || isRoleBlocked || !authToken || tokenExpired)
                              ? "bg-iron text-graphite cursor-not-allowed"
                              : "bg-orbit-cyan hover:bg-[#00c5dd] text-void"
                          )}
                        >
                          Approve & Schedule Burn
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Approved Success state card with Telemetry Uplink Command Block */}
        {isApproved && approvedPlan && (
          <Card className="border-cleared-green bg-cleared-green/5 p-6 space-y-6 animate-in fade-in zoom-in-95 duration-200 flex-grow flex flex-col justify-center">
            <div className="flex items-center space-x-3.5 border-b border-cleared-green/20 pb-4">
              <div className="p-2.5 rounded-full bg-cleared-green/10 border border-cleared-green/40 text-cleared-green">
                <CheckCircle2 className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <div>
                <span className="font-display text-[10px] text-cleared-green font-semibold uppercase tracking-wider">
                  Maneuver Approved & Logged
                </span>
                <h3 className="font-display text-[18px] font-bold text-bone uppercase mt-0.5">
                  Burn Scheduled successfully
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-void/50 border border-iron/60 rounded-[4px] p-4 flex flex-col justify-center">
                <span className="font-display text-[10px] text-graphite uppercase tracking-wide">
                  Time Remaining to Burn
                </span>
                <span className="font-data text-[24px] font-bold text-cleared-green mt-1">
                  {countdownStr || "calculating..."}
                </span>
              </div>
              <div className="bg-void/50 border border-iron/60 rounded-[4px] p-4 font-data text-[12px] text-ash space-y-1">
                <div>
                  <span className="font-display text-[9px] text-graphite uppercase block">Maneuver ID:</span>
                  <span className="text-bone font-semibold">{approvedPlan.id}</span>
                </div>
                <div>
                  <span className="font-display text-[9px] text-graphite uppercase block">Execution Window:</span>
                  <span className="text-bone font-semibold">{new Date(approvedPlan.burnTime).toUTCString()}</span>
                </div>
                <div>
                  <span className="font-display text-[9px] text-graphite uppercase block">Delta-V Target:</span>
                  <span className="text-bone font-semibold">{approvedPlan.deltaV.toFixed(3)} m/s ({approvedPlan.burnDirection})</span>
                </div>
              </div>
            </div>

            {/* Cryptographic Flight Command Payload Panel */}
            <div className="border border-iron/80 bg-[#04060b] p-4 rounded-[4px] space-y-3">
              <div className="flex items-center justify-between border-b border-iron/40 pb-2">
                <div className="flex items-center space-x-2 text-[#0ae448]">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="font-display text-[10px] font-bold uppercase tracking-wider">Secure Telemetry Uplink Command Block</span>
                </div>
                <span className="text-[9px] font-data text-graphite">SHA-256: 7f03a2b1c00af01c...</span>
              </div>

              <div className="font-data text-[10px] text-ash leading-relaxed space-y-1">
                <div><span className="text-graphite">0x7F03A2B1:</span> UPLINK_INIT_STATE_LOCK</div>
                <div><span className="text-graphite">0x7F03C00A:</span> CMD_IGNITION_UTC [{approvedPlan.burnTime.slice(11, 19)}]</div>
                <div><span className="text-graphite">0x7F03E012:</span> CMD_THRUST_MAG_MPS [{approvedPlan.deltaV.toFixed(4)}]</div>
                <div><span className="text-graphite">0x7F03F01C:</span> CMD_VECTOR_RTN_DEC [{approvedPlan.burnDirection.toUpperCase()}]</div>
                <div><span className="text-graphite">0x7F032890:</span> CMD_DURATION_SEC [{(approvedPlan.propellantMassKg * 8.5).toFixed(2)}]</div>
                <div><span className="text-graphite">0x7F03112E:</span> UPLINK_CHECK_SUM_MATCH_OK</div>
              </div>

              <div className="pt-2 flex justify-end">
                {uplinkStatus === 'idle' && (
                  <button
                    onClick={handleTransmitUplink}
                    className="py-1.5 px-4 bg-purple-700 hover:bg-purple-600 text-white font-display text-[10px] font-bold uppercase tracking-wider rounded-[2px] flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Send className="h-3 w-3" />
                    <span>Transmit Commands to Satellite</span>
                  </button>
                )}
                {uplinkStatus === 'sending' && (
                  <span className="text-[10px] text-threat-amber font-data animate-pulse">
                    📡 TRANSMITTING UPLINK PAYLOAD (40.2 kbps)...
                  </span>
                )}
                {uplinkStatus === 'success' && (
                  <span className="text-[10px] text-cleared-green font-bold font-data flex items-center space-x-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>UPLINK CARRIER LOCK: 100% OK (HEX CODE VERIFIED)</span>
                  </span>
                )}
              </div>
            </div>

            <div className="text-center pt-2 border-t border-cleared-green/10 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/dashboard" className="px-6 py-2 bg-void border border-cleared-green/30 text-cleared-green hover:bg-cleared-green/10 hover:text-white transition-colors rounded-[4px] text-[12px] font-display uppercase tracking-wider font-bold">
                Return to Dashboard
              </Link>
              <Link href={`/map?sat=${approvedPlan.satelliteId}&event=${approvedPlan.conjunctionEventId}`} className="px-6 py-2 bg-orbit-cyan hover:bg-[#00c5dd] text-void transition-colors rounded-[4px] text-[12px] font-display uppercase tracking-wider font-bold">
                View on 3D Map
              </Link>
            </div>
          </Card>
        )}
      </div>

      {/* 3. RIGHT COLUMN: What-If Parameter Tuning & Math Displays (3 cols) */}
      <div className="xl:col-span-3 space-y-6 flex flex-col">
        <div className="flex items-center space-x-2">
          <Sliders className="h-4 w-4 text-ash" />
          <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-ash">
            "What-If" Sandbox
          </h2>
        </div>

        <Card className="p-4 space-y-4 bg-abyss border border-iron hover:border-graphite transition-all flex-grow flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-[10px] font-display font-bold text-ash uppercase tracking-wider block border-b border-iron/40 pb-2">
              Thruster Simulation Panel
            </span>

            {/* Interactive Burn Direction Selector */}
            <div className="space-y-2">
              <span className="text-[10px] font-display font-bold text-graphite uppercase block">Burn Coordinate Direction (RTN Frame)</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(['prograde', 'retrograde', 'radial-out', 'radial-in', 'normal', 'antinormal'] as BurnDirection[]).map((dir) => (
                  <button
                    key={dir}
                    onClick={() => {
                      setBurnDirection(dir);
                      setIsCustomMode(true);
                    }}
                    className={cn(
                      "py-1.5 px-2 rounded-[2px] font-data text-[9.5px] uppercase border cursor-pointer text-center",
                      burnDirection === dir
                        ? "bg-purple-950/40 border-purple-400 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.15)]"
                        : "bg-void border-iron/50 text-ash hover:border-graphite"
                    )}
                  >
                    {dir.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Delta-V magnitude slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-display font-bold text-ash uppercase">Thrust Magnitude</span>
                <span className="text-[12px] font-data font-bold text-orbit-cyan">{customDeltaV.toFixed(2)} m/s</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={15.0}
                step={0.05}
                value={customDeltaV}
                onChange={(e) => {
                  setCustomDeltaV(parseFloat(e.target.value));
                  setIsCustomMode(true);
                }}
                className="w-full cursor-pointer accent-orbit-cyan"
              />
            </div>

            {/* Burn lead time slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-display font-bold text-ash uppercase">Lead Time (TCA - dt)</span>
                <span className="text-[12px] font-data font-bold text-orbit-cyan">{customLeadTimeHours.toFixed(1)} hrs</span>
              </div>
              <input
                type="range"
                min={1.0}
                max={24.0}
                step={0.5}
                value={customLeadTimeHours}
                onChange={(e) => {
                  setCustomLeadTimeHours(parseFloat(e.target.value));
                  setIsCustomMode(true);
                }}
                className="w-full cursor-pointer accent-orbit-cyan"
              />
            </div>

            {/* Reactive Physics Analysis Graphs */}
            {renderPropellantCurve()}
            {renderLeadTimeCurve()}

            {/* Real mathematical formula box displaying CW relative motion */}
            <div className="bg-[#05070a]/60 border border-iron/40 rounded p-2.5 space-y-1.5">
              <span className="text-[8px] font-display font-bold text-graphite uppercase tracking-wider block">
                Clohessy-Wiltshire Core System
              </span>
              <div className="text-[9px] font-data text-ash leading-relaxed space-y-1">
                <div className={cn("transition-colors duration-200", burnDirection.startsWith('radial') || burnDirection.startsWith('prograde') || burnDirection.startsWith('retrograde') ? "text-purple-400 font-medium" : "")}>
                  𝛿x(t) = (𝛥vR/n)·sin(nt) + (2𝛥vT/n)·(1 - cos(nt))
                </div>
                <div className={cn("transition-colors duration-200", burnDirection.startsWith('radial') || burnDirection.startsWith('prograde') || burnDirection.startsWith('retrograde') ? "text-purple-400 font-medium" : "")}>
                  𝛿y(t) = (2𝛥vR/n)·(cos(nt) - 1) + (𝛥vT/n)·(4sin(nt) - 3nt)
                </div>
                <div className={cn("transition-colors duration-200", burnDirection === 'normal' || burnDirection === 'antinormal' ? "text-purple-400 font-medium" : "")}>
                  𝛿z(t) = (𝛥vN/n)·sin(nt)
                </div>
              </div>
            </div>
          </div>

          {/* AI Situation Briefing box */}
          <div className="space-y-2 border-t border-iron/60 pt-3">
            <div className="flex items-center space-x-1.5 text-orbit-cyan">
              <Sparkles className="h-3 w-3" />
              <span className="text-[10px] font-display font-bold uppercase tracking-wider">AI Briefing Summary</span>
            </div>
            
            {loadingBriefing ? (
              <div className="p-3 bg-void border border-iron/50 rounded-[4px] flex items-center justify-center">
                <span className="text-[9.5px] text-ash animate-pulse font-data">Consulting situational model...</span>
              </div>
            ) : aiBriefingText ? (
              <div className="p-2.5 bg-void border border-iron/60 rounded-[4px] text-[10.5px] text-ash leading-relaxed font-body">
                {aiBriefingText}
              </div>
            ) : (
              <div className="p-2.5 bg-void border border-iron/50 rounded-[4px] text-[9px] text-graphite text-center italic">
                Briefing summary uncompiled. Calculate burns to view.
              </div>
            )}
          </div>
        </Card>
      </div>

    </div>
  );
}

export default function ManeuversPage() {
  return (
    <React.Suspense fallback={
      <div className="h-80 flex items-center justify-center text-graphite text-[12px] font-body">
        Initializing telemetry workspace...
      </div>
    }>
      <ManeuversPageContent />
    </React.Suspense>
  );
}
