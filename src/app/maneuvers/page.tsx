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

import { MapLoadingPlaceholder } from "@/components/dashboard/MapLoadingPlaceholder";

const ManeuverVisualizer = dynamic(() => import("@/components/ManeuverVisualizer"), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />
});
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
type ActiveTab = 'options' | 'sandbox' | 'analysis';

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
  const [selectedOptionIndex, setSelectedOptionIndex] = React.useState<number>(1);
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

  // Tab state
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('options');

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
    setTokenCountdown(600);
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

    let optionLabel = "medium burn";
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
    setOptions([]);
    setIsApproved(false);
    setApprovedPlan(null);
    setIsCustomMode(false);
    setAiBriefingText("");
    setUplinkStatus('idle');

    async function loadEventContext() {
      setLoading(true);
      try {
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
          const satRes = await fetch("/api/satellites");
          if (satRes.ok) {
            const satList: Satellite[] = await satRes.json();
            const sat = satList.find((s) => s.id === evt?.primaryId);
            setSatelliteData(sat || null);
          }
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
        setSelectedOptionIndex(1);
        setComparisonData((result as any).comparison);
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

  // "What-If" Live Physics Predictions
  const whatIfResults = React.useMemo(() => {
    if (!eventData || !satelliteData) return null;
    const m0 = satelliteData.estimatedMassKg || 500;
    const isp = 220;
    const tcaTime = new Date(eventData.tca).getTime();
    const burnTimeISO = new Date(tcaTime - customLeadTimeHours * 60 * 60 * 1000).toISOString();
    const newMiss = predictNewMissDistance(
      eventData.missDistance, customDeltaV, burnTimeISO, eventData.tca,
      burnDirection, satelliteData.altitude ?? 550
    );
    const propellant = calculateFuelCost(customDeltaV, m0, isp);
    let customRisk: "green" | "yellow" | "red" = "green";
    if (newMiss < 2.0) customRisk = "red";
    else if (newMiss < 5.0) customRisk = "yellow";
    return { newMiss, propellant, customRisk, burnTimeISO };
  }, [eventData, satelliteData, customDeltaV, customLeadTimeHours, burnDirection]);

  // Generate Technical Log Streams
  React.useEffect(() => {
    if (!eventData || !satelliteData || !whatIfResults) return;
    const timeStr = new Date().toLocaleTimeString();
    const systemLogs = [
      `[${timeStr}] FLIGHT-DY: CW relative equations initialized for NORAD ${satelliteData.noradId}`,
      `[${timeStr}] SOLVER: Propagating satellite state vectors relative to primary target...`,
      `[${timeStr}] PARAM: Burn vector [direction=${burnDirection.toUpperCase()}] magnitude=${customDeltaV.toFixed(3)} m/s`,
      `[${timeStr}] COVARIANCE: Extrapolating error matrices (σR=300m, σT=1500m, σN=300m)`,
      `[${timeStr}] DYNAMICS: dt = ${(customLeadTimeHours * 3600).toFixed(0)} seconds (${customLeadTimeHours.toFixed(1)} hrs before TCA)`,
      `[${timeStr}] DYNAMICS: Mean motion n = ${((2 * Math.PI) / ((satelliteData.period || 90) * 60)).toFixed(7)} rad/s`,
      `[${timeStr}] INTEGRATOR: Solve complete. Delta-Radius = ${(Math.abs(whatIfResults.newMiss - eventData.missDistance) * 1000).toFixed(1)} meters`,
      `[${timeStr}] RESULT: Projected TCA miss distance = ${whatIfResults.newMiss.toFixed(3)} km (Pc = ${whatIfResults.customRisk === 'green' ? '< 1e-5' : whatIfResults.customRisk === 'yellow' ? '4.2e-5' : '1.8e-4'})`,
      `[${timeStr}] FUEL: Thruster demand: ${whatIfResults.propellant.toFixed(3)} kg Xenon propellant required.`
    ];
    setConsoleLogs(systemLogs);
  }, [selectedEventId, customDeltaV, customLeadTimeHours, burnDirection, eventData, satelliteData, whatIfResults]);

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

  const handleTransmitUplink = () => {
    setUplinkStatus('sending');
    soundSynth.playBeep();
    setTimeout(() => {
      setUplinkStatus('success');
      soundSynth.playChime();
    }, 2000);
  };

  // SVG chart renderers
  const renderPropellantCurve = () => {
    const width = 300; const height = 80; const padding = 14;
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
      <div className="bg-abyss/40 border border-iron/20 rounded-[12px] p-3">
        <div className="flex justify-between items-center text-[9px] font-data text-ash/60 uppercase tracking-[0.1em] mb-2">
          <span>Propellant Mass Curve</span>
          <span className="text-iris-gleam font-data">{curFuel.toFixed(2)} kg</span>
        </div>
        <svg width={width} height={height} className="w-full">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#2e2e2e" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#2e2e2e" strokeWidth="1" />
          <path d={`M ${points.join(' L ')}`} fill="none" stroke="#847dff" strokeWidth="1.5" opacity="0.8" />
          <circle cx={curX} cy={curY} r="4" fill="#0ae448" className="animate-pulse" />
          <text x={padding + 3} y={padding + 8} fill="#6a6b6b" fontSize="7" fontFamily="monospace">15kg</text>
          <text x={width - padding - 34} y={height - padding - 2} fill="#6a6b6b" fontSize="7" fontFamily="monospace">15.0 m/s</text>
        </svg>
      </div>
    );
  };

  const renderLeadTimeCurve = () => {
    const width = 300; const height = 80; const padding = 14;
    const points = [];
    const minH = 1.0; const maxH = 24.0;
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
      <div className="bg-abyss/40 border border-iron/20 rounded-[12px] p-3">
        <div className="flex justify-between items-center text-[9px] font-data text-ash/60 uppercase tracking-[0.1em] mb-2">
          <span>Thrust Efficiency vs Lead Time</span>
          <span className="text-orbit-cyan font-data">{(15.0 / customLeadTimeHours).toFixed(2)} Eff</span>
        </div>
        <svg width={width} height={height} className="w-full">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#2e2e2e" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#2e2e2e" strokeWidth="1" />
          <path d={`M ${points.join(' L ')}`} fill="none" stroke="#00bae2" strokeWidth="1.5" opacity="0.8" />
          <circle cx={curX} cy={curY} r="4" fill="#847dff" className="animate-pulse" />
          <text x={padding + 3} y={padding + 8} fill="#6a6b6b" fontSize="7" fontFamily="monospace">Max ΔV</text>
          <text x={width - padding - 34} y={height - padding - 2} fill="#6a6b6b" fontSize="7" fontFamily="monospace">24h</text>
        </svg>
      </div>
    );
  };

  // ─── RENDER ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 select-none animate-fade-in-slide">

      {/* ─── ROW 1: 3D Visualizer (full width) ─── */}
      <div className="bg-graphite border border-iron/30 rounded-[16px] overflow-hidden relative h-[340px]">
        <div className="absolute top-4 left-5 flex items-center space-x-2 z-10">
          <Target className="h-3.5 w-3.5 text-orbit-cyan" />
          <span className="font-data text-[10px] text-ash/60 uppercase tracking-[0.1em]">
            3D Trajectory Visualization
          </span>
        </div>
        <ManeuverVisualizer
          protectedAssetTrajectory={protectedAssetTrajectory}
          threatTrajectory={threatTrajectory}
          maneuverTrajectory={maneuverTrajectory}
          tcaTime={tcaTime}
          tcaPosition={tcaPosition}
          safetyRadiusKm={safetyRadiusKm}
        />
      </div>

      {/* ─── ROW 2: Two-column layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── LEFT: Threat Context (4 cols) ── */}
        <div className="lg:col-span-4 space-y-5">
          {/* Event Selector */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4 text-ash" />
                <span className="font-data text-[10px] text-ash uppercase tracking-[0.182em]">Active Threat</span>
              </div>
              <button
                onClick={() => setDevMode(!devMode)}
                className={cn(
                  "px-2 py-0.5 rounded-[6px] text-[8px] font-data uppercase border transition-all cursor-pointer",
                  devMode
                    ? "bg-orbit-cyan/15 border-orbit-cyan/60 text-orbit-cyan"
                    : "bg-abyss/40 border-iron/30 text-fog hover:text-ash"
                )}
              >
                {devMode ? "AUDIT ON" : "AUDIT"}
              </button>
            </div>

            <div className="relative">
              <select
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  router.push(`/maneuvers?event=${e.target.value}`);
                }}
                className="w-full bg-abyss/60 border border-iron/30 rounded-[8px] px-3 py-2.5 text-bone font-data text-[12px] focus:outline-none focus:border-pure appearance-none cursor-pointer"
              >
                {activeEvents.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.id} vs {evt.secondaryName.slice(0, 15)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ash pointer-events-none" />
            </div>

            {loading && (
              <div className="h-24 bg-abyss/40 rounded-[8px] animate-pulse flex items-center justify-center text-fog text-[11px] font-data mt-4">
                Syncing event registry...
              </div>
            )}

            {!loading && eventData && (
              <div className="mt-4 pt-4 border-t border-iron/20 space-y-3">
                <div>
                  <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] block">Threat Target</span>
                  <span className="font-data text-[14px] text-bone font-semibold block mt-0.5">
                    {eventData.secondaryName}
                  </span>
                  <span className="text-[10px] text-ash font-data block">NORAD {eventData.secondaryId}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-abyss/40 border border-iron/20 rounded-[10px] p-3">
                    <span className="font-data text-[8px] text-ash/60 uppercase tracking-[0.1em] block">Miss Distance</span>
                    <span className="font-data text-[13px] text-bone font-semibold block mt-1">
                      {eventData.missDistanceMeters.toLocaleString()} m
                    </span>
                  </div>
                  <div className="bg-abyss/40 border border-iron/20 rounded-[10px] p-3">
                    <span className="font-data text-[8px] text-ash/60 uppercase tracking-[0.1em] block">Collision Prob</span>
                    <span className="font-data text-[13px] text-collision-red font-bold block mt-1">
                      {eventData.pcDisplay}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Asset telemetry readout */}
            {!loading && satelliteData && (
              <div className="mt-4 pt-4 border-t border-iron/20 space-y-2">
                <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] block">Fleet Asset</span>
                <div className="space-y-1.5 font-data text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-fog">NAME</span>
                    <span className="text-bone">{satelliteData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fog">NORAD</span>
                    <span className="text-bone">{satelliteData.noradId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fog">ALT</span>
                    <span className="text-bone">{satelliteData.altitude?.toFixed(1)} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fog">FUEL</span>
                    <span className="text-bone">{satelliteData.fuelRemainingPct?.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* CW Solver Terminal */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center space-x-1.5 px-4 pt-4 pb-2 text-fog">
              <Terminal className="h-3 w-3" />
              <span className="font-data text-[9px] uppercase tracking-[0.1em]">CW Solver Logs</span>
            </div>
            <div className="h-32 overflow-y-auto bg-void/60 px-3 py-2 font-data text-[9px] leading-relaxed text-cleared-green/80 flex flex-col space-y-1 scrollbar-thin">
              {consoleLogs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap font-mono">{log}</div>
              ))}
              <div ref={consoleBottomRef} />
            </div>
          </Card>
        </div>

        {/* ── RIGHT: Main Content with Tabs (8 cols) ── */}
        <div className="lg:col-span-8 space-y-5">

          {/* Tab Navigation */}
          <div className="flex items-center space-x-1 bg-graphite rounded-[12px] p-1">
            {[
              { key: 'options' as ActiveTab, label: 'Burn Options', icon: Zap },
              { key: 'sandbox' as ActiveTab, label: 'What-If Sandbox', icon: Sliders },
              { key: 'analysis' as ActiveTab, label: 'AI Analysis', icon: Sparkles },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-[8px] text-[11px] font-data uppercase tracking-[0.1em] transition-all cursor-pointer",
                  activeTab === key
                    ? "bg-obsidian text-pure"
                    : "text-fog hover:text-ash"
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* ══ TAB: Burn Options ══ */}
          {activeTab === 'options' && (
            <div className="space-y-5">
              {options.length === 0 && !isApproved && (
                <Card className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                  <div className="p-4 rounded-full bg-orbit-cyan/10 border border-orbit-cyan/30 text-orbit-cyan">
                    <Compass className="h-8 w-8" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-display text-[20px] font-light text-cloud tracking-tight">
                      Awaiting Calculation
                    </h3>
                    <p className="font-body text-[13px] text-ash mt-2 max-w-md mx-auto leading-relaxed">
                      Select an active threat event from the left panel. Maneuver options will be computed automatically.
                    </p>
                  </div>
                </Card>
              )}

              {options.length > 0 && !isApproved && (
                <>
                  {/* Three option cards */}
                  <div className="grid grid-cols-3 gap-4">
                    {["Minimum Fuel", "Balanced", "Maximum Safety"].map((name, idx) => {
                      const opt = options[idx];
                      const active = !isCustomMode && selectedOptionIndex === idx;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => { setSelectedOptionIndex(idx); setIsCustomMode(false); }}
                          className={cn(
                            "border rounded-[12px] p-4 text-left transition-all relative flex flex-col cursor-pointer",
                            active
                              ? "bg-graphite border-orbit-cyan"
                              : "bg-graphite/60 border-iron/30 hover:border-iron/60"
                          )}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-data text-[10px] text-ash uppercase tracking-[0.1em]">{name}</span>
                            {active && <span className="h-2 w-2 rounded-full bg-orbit-cyan animate-pulse" />}
                          </div>
                          <div className="space-y-2 font-data">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-fog">ΔV</span>
                              <span className="text-bone font-semibold">{opt.deltaV.toFixed(2)} m/s</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-fog">Miss</span>
                              <span className="text-orbit-cyan font-bold">{opt.newMissDistance.toFixed(2)} km</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-fog">Fuel</span>
                              <span className="text-bone">{opt.propellantMassKg.toFixed(2)} kg</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active plan details */}
                  {activePlan && (
                    <Card>
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-iron/20">
                        <h3 className="font-display text-[16px] font-light text-cloud">
                          {isCustomMode ? 'Custom Solution' : 'Selected Maneuver'}
                        </h3>
                        <span className={cn(
                          "text-[9px] font-data uppercase tracking-[0.1em] px-2.5 py-1 rounded-[6px] border",
                          isCustomMode
                            ? "bg-iris-gleam/10 text-iris-gleam border-iris-gleam/20"
                            : "bg-orbit-cyan/10 text-orbit-cyan border-orbit-cyan/20"
                        )}>
                          {isCustomMode ? 'SANDBOX' : 'PRESET'}
                        </span>
                      </div>

                      <p className="font-body text-[13px] text-ash leading-relaxed mb-4">
                        A <strong className="text-orbit-cyan font-data">{activePlan.deltaV.toFixed(3)} m/s</strong> thruster burn aligned <strong className="text-bone font-data uppercase">{activePlan.burnDirection}</strong> scheduled at <span className="font-data text-ash">{activePlan.burnTime.slice(11, 19)} UTC</span>. Projected miss distance expands to <strong className="text-cleared-green font-data">{activePlan.newMissDistance.toFixed(3)} km</strong>, expending <span className="font-data text-bone">{activePlan.propellantMassKg.toFixed(3)} kg</span> propellant.
                      </p>

                      {/* Metrics grid */}
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        {[
                          { label: 'Velocity', value: `${activePlan.deltaV.toFixed(3)} m/s`, color: 'text-bone' },
                          { label: 'Fuel Cost', value: `${activePlan.propellantMassKg.toFixed(3)} kg`, color: 'text-bone' },
                          { label: 'New Miss', value: `${activePlan.newMissDistance.toFixed(3)} km`, color: 'text-orbit-cyan' },
                          { label: 'Burn Time', value: `${activePlan.burnTime.slice(11, 19)} UTC`, color: 'text-bone' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-abyss/40 border border-iron/20 rounded-[10px] p-3">
                            <span className="font-data text-[8px] text-ash/60 uppercase tracking-[0.1em] block">{label}</span>
                            <span className={cn("font-data text-[12px] font-semibold block mt-1", color)}>{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Trade-off comparison */}
                      {comparisonData && (
                        <div className="bg-abyss/40 border border-iron/20 rounded-[12px] p-4 mb-4 space-y-3">
                          <div className="flex items-center space-x-2 pb-2 border-b border-iron/10">
                            <Sparkles className="h-3.5 w-3.5 text-orbit-cyan" />
                            <span className="font-data text-[9px] text-ash uppercase tracking-[0.1em]">AI Trade-Off Comparison</span>
                          </div>
                          <p className="font-body text-[13px] text-ash leading-relaxed">{comparisonData.reasoning}</p>
                          <div className="grid grid-cols-3 gap-3">
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
                                  className={cn("p-3 rounded-[10px] border flex flex-col space-y-1.5",
                                    isRecommended
                                      ? "bg-orbit-cyan/5 border-orbit-cyan/40 text-orbit-cyan"
                                      : "bg-obsidian/40 border-iron/20 text-ash",
                                    score === 0 && "opacity-40"
                                  )}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="font-body text-[11px] capitalize">{opt.label} {isRecommended && "★"}{score === 0 && " (DQ)"}</span>
                                    <span className="font-data text-[10px]">Score: {score.toFixed(1)}</span>
                                  </div>
                                  <div className="font-data text-[9px] opacity-80 space-y-0.5">
                                    <div>Dist: {resultingDist.toFixed(2)} km</div>
                                    <div>Fuel: {fuelCost.toFixed(2)} kg</div>
                                    {isDivergent && <div className="text-threat-amber font-semibold uppercase mt-1 animate-pulse">⚠️ CW Divergence</div>}
                                    {secWarning && <div className="text-collision-red font-semibold uppercase mt-1">⚠️ Sec: {secWarning}</div>}
                                  </div>
                                </div>
                              );
                            })}
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
                              <div className="bg-collision-red/10 border border-collision-red/30 text-collision-red p-4 rounded-[12px] space-y-2 mb-4">
                                <span className="font-body text-[13px] font-bold">⚠ MANEUVER BLOCKED — Secondary Conjunction Risk</span>
                                <p className="font-body text-[12px] opacity-90">This burn creates a new conjunction closer than the original threat separation.</p>
                              </div>
                            )}
                            {isRoleBlocked && (
                              <div className="bg-collision-red/10 border border-collision-red/30 text-collision-red p-4 rounded-[12px] space-y-2 mb-4">
                                <span className="font-body text-[13px] font-bold">⚠ ACTION BLOCKED — Operator Role Restriction</span>
                                <p className="font-body text-[12px] opacity-90">Junior operators cannot authorize burns above 5.0 kg. This requires <strong>{activePlan.propellantMassKg.toFixed(2)} kg</strong>.</p>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Auth Gate */}
                      <div className="bg-abyss/40 p-4 rounded-[12px] border border-iron/20 space-y-3 mb-4">
                        <div className="flex items-center justify-between pb-2 border-b border-iron/10">
                          <span className="font-data text-[9px] text-ash uppercase tracking-[0.1em]">Authorization Gate</span>
                          {authToken && (
                            <span className={cn("font-data text-[10px] font-bold px-2 py-0.5 rounded-[4px]",
                              tokenExpired ? "bg-collision-red/20 text-collision-red" : "bg-cleared-green/20 text-cleared-green animate-pulse"
                            )}>
                              {tokenExpired ? "EXPIRED" : "ACTIVE"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1 flex-1 min-w-0">
                            {authToken ? (
                              <>
                                <span className="font-data text-[10px] text-orbit-cyan block break-all">{authToken}</span>
                                <span className="font-body text-[11px] text-ash">
                                  Valid for: <strong className="font-data text-cloud">{Math.floor((tokenCountdown ?? 0) / 60)}:{((tokenCountdown ?? 0) % 60).toString().padStart(2, '0')}</strong>
                                </span>
                              </>
                            ) : (
                              <span className="font-body text-[12px] text-fog">Acquire an authorization token before burn transmission.</span>
                            )}
                          </div>
                          <button
                            onClick={handleRequestToken}
                            className="px-4 py-2 bg-transparent border border-iron/30 hover:border-pure text-pure hover:bg-steel/20 rounded-[8px] font-body text-[12px] transition-all shrink-0 cursor-pointer"
                          >
                            {authToken ? "Regenerate" : "Acquire Token →"}
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-iron/20">
                        <div className="flex items-center space-x-2">
                          <span className="font-data text-[9px] text-fog uppercase tracking-[0.1em]">Role:</span>
                          <select
                            value={operatorRole}
                            onChange={(e) => setOperatorRole(e.target.value as 'Senior' | 'Junior')}
                            className="bg-abyss/60 border border-iron/30 rounded-[6px] px-2 py-1 text-[11px] text-bone font-data focus:outline-none cursor-pointer"
                          >
                            <option value="Senior">Senior</option>
                            <option value="Junior">Junior</option>
                          </select>
                        </div>
                        <div className="flex space-x-3">
                          <Link href="/dashboard" className="py-2 px-4 border border-iron/30 rounded-[8px] text-ash hover:text-bone hover:bg-steel/20 text-[11px] font-data uppercase tracking-[0.1em] transition-all">
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
                                className={cn("py-2 px-6 font-data text-[11px] uppercase tracking-[0.1em] rounded-[8px] transition-all cursor-pointer",
                                  (isDisqualified || isRoleBlocked || !authToken || tokenExpired)
                                    ? "bg-steel text-fog cursor-not-allowed"
                                    : "bg-pure hover:bg-silver text-void"
                                )}
                              >
                                Approve & Schedule
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </Card>
                  )}
                </>
              )}

              {/* Approved success state */}
              {isApproved && approvedPlan && (
                <Card className="border-cleared-green/30 space-y-5">
                  <div className="flex items-center space-x-3.5 pb-4 border-b border-cleared-green/20">
                    <div className="p-2.5 rounded-full bg-cleared-green/10 border border-cleared-green/40 text-cleared-green">
                      <CheckCircle2 className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                    <div>
                      <span className="font-data text-[10px] text-cleared-green uppercase tracking-[0.1em] block">Maneuver Approved & Logged</span>
                      <h3 className="font-display text-[20px] font-light text-cloud">Burn Scheduled</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-abyss/40 border border-iron/20 rounded-[12px] p-4 flex flex-col justify-center">
                      <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em]">Time to Burn</span>
                      <span className="font-data text-[28px] font-bold text-cleared-green mt-1">{countdownStr || "..."}</span>
                    </div>
                    <div className="bg-abyss/40 border border-iron/20 rounded-[12px] p-4 font-data text-[11px] space-y-1.5">
                      <div><span className="text-fog">ID:</span> <span className="text-bone">{approvedPlan.id}</span></div>
                      <div><span className="text-fog">Window:</span> <span className="text-bone">{new Date(approvedPlan.burnTime).toUTCString()}</span></div>
                      <div><span className="text-fog">ΔV:</span> <span className="text-bone">{approvedPlan.deltaV.toFixed(3)} m/s ({approvedPlan.burnDirection})</span></div>
                    </div>
                  </div>

                  {/* Uplink Block */}
                  <div className="border border-iron/20 bg-void/40 p-4 rounded-[12px] space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-iron/10">
                      <div className="flex items-center space-x-2 text-cleared-green">
                        <ShieldCheck className="h-4 w-4" />
                        <span className="font-data text-[9px] uppercase tracking-[0.1em]">Secure Uplink Command</span>
                      </div>
                      <span className="text-[9px] font-data text-fog">SHA-256: 7f03a2b1c00af01c...</span>
                    </div>
                    <div className="font-data text-[9px] text-ash leading-relaxed space-y-0.5">
                      <div><span className="text-fog">0x7F03A2B1:</span> UPLINK_INIT_STATE_LOCK</div>
                      <div><span className="text-fog">0x7F03C00A:</span> CMD_IGNITION_UTC [{approvedPlan.burnTime.slice(11, 19)}]</div>
                      <div><span className="text-fog">0x7F03E012:</span> CMD_THRUST_MAG_MPS [{approvedPlan.deltaV.toFixed(4)}]</div>
                      <div><span className="text-fog">0x7F03F01C:</span> CMD_VECTOR_RTN [{approvedPlan.burnDirection.toUpperCase()}]</div>
                      <div><span className="text-fog">0x7F032890:</span> CMD_DURATION_SEC [{(approvedPlan.propellantMassKg * 8.5).toFixed(2)}]</div>
                      <div><span className="text-fog">0x7F03112E:</span> UPLINK_CHECKSUM_OK</div>
                    </div>
                    <div className="pt-2 flex justify-end">
                      {uplinkStatus === 'idle' && (
                        <button onClick={handleTransmitUplink} className="py-1.5 px-4 bg-iris-gleam hover:bg-deep-iris text-white font-data text-[10px] uppercase tracking-[0.1em] rounded-[6px] flex items-center space-x-1.5 cursor-pointer transition-all">
                          <Send className="h-3 w-3" /><span>Transmit to Satellite</span>
                        </button>
                      )}
                      {uplinkStatus === 'sending' && (
                        <span className="text-[10px] text-threat-amber font-data animate-pulse">📡 TRANSMITTING UPLINK...</span>
                      )}
                      {uplinkStatus === 'success' && (
                        <span className="text-[10px] text-cleared-green font-bold font-data flex items-center space-x-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /><span>UPLINK VERIFIED OK</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-center pt-3 border-t border-iron/20 flex gap-3 justify-center">
                    <Link href="/dashboard" className="px-6 py-2 border border-cleared-green/30 text-cleared-green hover:bg-cleared-green/10 transition-all rounded-[8px] text-[11px] font-data uppercase tracking-[0.1em]">
                      Dashboard
                    </Link>
                    <Link href={`/map?sat=${approvedPlan.satelliteId}&event=${approvedPlan.conjunctionEventId}`} className="px-6 py-2 bg-pure hover:bg-silver text-void transition-all rounded-[8px] text-[11px] font-data uppercase tracking-[0.1em]">
                      View on 3D Map
                    </Link>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ══ TAB: What-If Sandbox ══ */}
          {activeTab === 'sandbox' && (
            <Card className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-iron/20">
                <h3 className="font-display text-[18px] font-light text-cloud">Thruster Simulation</h3>
                {whatIfResults && (
                  <span className={cn("font-data text-[10px] px-2.5 py-1 rounded-[6px] border uppercase tracking-[0.1em]",
                    whatIfResults.customRisk === 'green' ? "bg-cleared-green/10 text-cleared-green border-cleared-green/20" :
                    whatIfResults.customRisk === 'yellow' ? "bg-threat-amber/10 text-threat-amber border-threat-amber/20" :
                    "bg-collision-red/10 text-collision-red border-collision-red/20"
                  )}>
                    Risk: {whatIfResults.customRisk}
                  </span>
                )}
              </div>

              {/* Burn Direction selector */}
              <div className="space-y-2">
                <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] block">Burn Direction (RTN Frame)</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['prograde', 'retrograde', 'radial-out', 'radial-in', 'normal', 'antinormal'] as BurnDirection[]).map((dir) => (
                    <button
                      key={dir}
                      onClick={() => { setBurnDirection(dir); setIsCustomMode(true); }}
                      className={cn(
                        "py-2 px-3 rounded-[8px] font-data text-[10px] uppercase border cursor-pointer text-center transition-all",
                        burnDirection === dir
                          ? "bg-iris-gleam/15 border-iris-gleam/50 text-iris-gleam"
                          : "bg-abyss/40 border-iron/20 text-fog hover:border-iron/50 hover:text-ash"
                      )}
                    >
                      {dir.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em]">Thrust Magnitude</span>
                    <span className="text-[13px] font-data font-bold text-orbit-cyan">{customDeltaV.toFixed(2)} m/s</span>
                  </div>
                  <input type="range" min={0.05} max={15.0} step={0.05} value={customDeltaV}
                    onChange={(e) => { setCustomDeltaV(parseFloat(e.target.value)); setIsCustomMode(true); }}
                    className="w-full cursor-pointer accent-orbit-cyan"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em]">Lead Time</span>
                    <span className="text-[13px] font-data font-bold text-orbit-cyan">{customLeadTimeHours.toFixed(1)} hrs</span>
                  </div>
                  <input type="range" min={1.0} max={24.0} step={0.5} value={customLeadTimeHours}
                    onChange={(e) => { setCustomLeadTimeHours(parseFloat(e.target.value)); setIsCustomMode(true); }}
                    className="w-full cursor-pointer accent-orbit-cyan"
                  />
                </div>
              </div>

              {/* Live Result */}
              {whatIfResults && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-abyss/40 border border-iron/20 rounded-[10px] p-3">
                    <span className="font-data text-[8px] text-ash/60 uppercase tracking-[0.1em] block">New Miss Distance</span>
                    <span className={cn("font-data text-[16px] font-bold block mt-1",
                      whatIfResults.customRisk === 'green' ? "text-cleared-green" :
                      whatIfResults.customRisk === 'yellow' ? "text-threat-amber" : "text-collision-red"
                    )}>
                      {whatIfResults.newMiss.toFixed(3)} km
                    </span>
                  </div>
                  <div className="bg-abyss/40 border border-iron/20 rounded-[10px] p-3">
                    <span className="font-data text-[8px] text-ash/60 uppercase tracking-[0.1em] block">Propellant Cost</span>
                    <span className="font-data text-[16px] font-bold text-bone block mt-1">{whatIfResults.propellant.toFixed(3)} kg</span>
                  </div>
                  <div className="bg-abyss/40 border border-iron/20 rounded-[10px] p-3">
                    <span className="font-data text-[8px] text-ash/60 uppercase tracking-[0.1em] block">Burn Time</span>
                    <span className="font-data text-[14px] font-semibold text-bone block mt-1">{whatIfResults.burnTimeISO.slice(11, 19)} UTC</span>
                  </div>
                </div>
              )}

              {/* Physics Charts */}
              <div className="grid grid-cols-2 gap-4">
                {renderPropellantCurve()}
                {renderLeadTimeCurve()}
              </div>

              {/* CW equations */}
              <div className="bg-abyss/40 border border-iron/20 rounded-[12px] p-4 space-y-2">
                <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] block">Clohessy-Wiltshire System</span>
                <div className="text-[10px] font-data text-ash leading-relaxed space-y-1">
                  <div className={cn("transition-colors duration-200", burnDirection.startsWith('radial') || burnDirection.startsWith('prograde') || burnDirection.startsWith('retrograde') ? "text-iris-gleam font-medium" : "")}>
                    𝛿x(t) = (𝛥vR/n)·sin(nt) + (2𝛥vT/n)·(1 - cos(nt))
                  </div>
                  <div className={cn("transition-colors duration-200", burnDirection.startsWith('radial') || burnDirection.startsWith('prograde') || burnDirection.startsWith('retrograde') ? "text-iris-gleam font-medium" : "")}>
                    𝛿y(t) = (2𝛥vR/n)·(cos(nt) - 1) + (𝛥vT/n)·(4sin(nt) - 3nt)
                  </div>
                  <div className={cn("transition-colors duration-200", burnDirection === 'normal' || burnDirection === 'antinormal' ? "text-iris-gleam font-medium" : "")}>
                    𝛿z(t) = (𝛥vN/n)·sin(nt)
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ══ TAB: AI Analysis ══ */}
          {activeTab === 'analysis' && (
            <Card className="space-y-5">
              <div className="flex items-center space-x-2 pb-3 border-b border-iron/20">
                <Sparkles className="h-4 w-4 text-orbit-cyan" />
                <h3 className="font-display text-[18px] font-light text-cloud">AI Situation Briefing</h3>
              </div>

              {loadingBriefing ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="h-6 w-6 text-orbit-cyan animate-spin" />
                  <span className="font-data text-[11px] text-ash animate-pulse">Consulting situational model...</span>
                </div>
              ) : aiBriefingText ? (
                <div className="font-body text-[14px] text-ash leading-[1.8]">
                  {aiBriefingText}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="font-body text-[13px] text-fog">Briefing summary uncompiled. Calculate burns to view.</p>
                </div>
              )}

              {/* Lifecycle Timeline */}
              {eventData && (
                <div className="pt-4 border-t border-iron/20">
                  <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] block mb-3">Event Lifecycle</span>
                  <LifecycleTimeline event={eventData} />
                </div>
              )}
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

export default function ManeuversPage() {
  return (
    <React.Suspense fallback={
      <div className="h-80 flex items-center justify-center text-fog text-[12px] font-body">
        Initializing telemetry workspace...
      </div>
    }>
      <ManeuversPageContent />
    </React.Suspense>
  );
}
