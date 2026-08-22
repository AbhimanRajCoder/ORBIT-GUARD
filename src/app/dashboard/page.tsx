"use client";

import * as React from "react";
import Link from "next/link";
import {
  Satellite as SatelliteIcon,
  Radio,
  Zap,
  ShieldAlert,
  ChevronRight,
  X,
  Activity,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusDot";
import { cn } from "@/lib/utils";
import { Satellite, ConjunctionEvent } from "@/types";
import { useOrbitStream } from "@/lib/hooks/useOrbitStream";
import dynamic from "next/dynamic";

import { MapLoadingPlaceholder } from "@/components/dashboard/MapLoadingPlaceholder";

const EarthView = dynamic(() => import("@/components/EarthView"), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />
});

export default function DashboardPage() {
  const { satellites, conjunctionEvents: conjunctions } = useOrbitStream();

  const [loading, setLoading] = React.useState(true);

  // Client-side interactions states
  const [selectedSatellite, setSelectedSatellite] = React.useState<Satellite | null>(null);
  const [selectedConjunctionId, setSelectedConjunctionId] = React.useState<string | null>(null);
  const [dismissedConjunctionIds, setDismissedConjunctionIds] = React.useState<string[]>([]);

  const liveSelectedSatellite = selectedSatellite
    ? satellites.find((s) => s.id === selectedSatellite.id) || selectedSatellite
    : null;

  // 1. Set loading false once stream data arrives
  React.useEffect(() => {
    if (satellites.length > 0 || conjunctions.length > 0) {
      setLoading(false);
    }
  }, [satellites, conjunctions]);

  // Support reading ?sat query param to open detail drawer
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const satId = params.get("sat");
      if (satId && satellites.length > 0) {
        const match = satellites.find((s) => s.id === satId);
        if (match) {
          setSelectedSatellite(match);
        }
      }
    }
  }, [satellites]);

  // Helpers
  const handleDismissConjunction = (id: string) => {
    setDismissedConjunctionIds((prev) => [...prev, id]);
  };

  const getTimeRemaining = (tcaISO: string) => {
    if (!tcaISO) return "0h 0m";
    let tcaStr = tcaISO.replace(" ", "T");
    if (!tcaStr.endsWith("Z") && !tcaStr.includes("+") && !tcaStr.includes("-")) {
      tcaStr += "Z";
    }
    let diffMs = new Date(tcaStr).getTime() - new Date().getTime();
    if (diffMs <= 0) {
      const tcaTime = new Date(tcaStr).getTime();
      const cycleMs = 3 * 3600 * 1000;
      const elapsed = (new Date().getTime() - tcaTime) % cycleMs;
      diffMs = cycleMs - elapsed;
    }
    const totalMin = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return `${hours}h ${mins}m`;
  };

  const formatPercentage = (pc: number) => {
    const pct = (pc * 100).toFixed(4);
    const fraction = Math.round(1 / pc).toLocaleString();
    return `${pct}% (1 in ${fraction})`;
  };

  // Filter active, non-dismissed conjunctions
  const activeConjunctions = conjunctions.filter(
    (c) => c.status === "active" && !dismissedConjunctionIds.includes(c.id)
  );

  // Critical counts (Pc >= 10^-4)
  const criticalConjunctions = activeConjunctions.filter(
    (c) => c.riskLevel === "red"
  );

  const getFuelColorClass = (fuel: number) => {
    if (fuel > 50) return "bg-cleared-green";
    if (fuel >= 20) return "bg-threat-amber";
    return "bg-collision-red animate-pulse";
  };

  // 2. LOADING STATE (SKELETONS)
  const isPageLoading = loading && satellites.length === 0;
  if (isPageLoading) {
    return (
      <div className="space-y-8 select-none">
        {/* Stats bar skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-abyss border border-iron rounded-[6px] p-4 flex items-center space-x-4 animate-pulse"
            >
              <div className="h-10 w-10 bg-iron rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-iron rounded w-2/3" />
                <div className="h-3 bg-iron rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>

        {/* Double columns skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="h-5 bg-abyss rounded w-1/4 animate-pulse" />
            <div className="border border-iron rounded-[6px] bg-abyss p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-iron/40 rounded-[4px] animate-pulse" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="h-5 bg-abyss rounded w-1/4 animate-pulse" />
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-32 bg-abyss border border-iron rounded-[6px] p-4 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. MAIN DASHBOARD CONTENT
  return (
    <div className="space-y-8 select-none relative">
      {/* SECTION 1 — Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Satellites */}
        <Card className="flex items-center space-x-4 p-4">
          <div className="p-2.5 rounded-full bg-orbit-cyan/10 border border-orbit-cyan/30 text-orbit-cyan">
            <SatelliteIcon className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div>
            <span className="font-data text-[24px] font-bold text-bone leading-none block">
              {satellites.length}
            </span>
            <span className="font-data text-[10px] text-ash uppercase tracking-[0.182em] mt-0.5 block">
              Total Satellites Tracked
            </span>
          </div>
        </Card>

        {/* Card 2: Active Conjunctions */}
        <Card className="flex items-center space-x-4 p-4">
          <div className={cn("p-2.5 rounded-full border", {
            "bg-collision-red/10 border-collision-red/30 text-collision-red": activeConjunctions.length > 0,
            "bg-iron border-graphite text-ash": activeConjunctions.length === 0
          })}>
            <Radio className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div>
            <span className={cn("font-data text-[24px] font-bold leading-none block", {
              "text-collision-red": activeConjunctions.length > 0,
              "text-bone": activeConjunctions.length === 0,
            })}>
              {activeConjunctions.length}
            </span>
            <span className="font-data text-[10px] text-ash uppercase tracking-[0.182em] mt-0.5 block">
              Active Conjunction Events
            </span>
          </div>
        </Card>

        {/* Card 3: Critical Alerts */}
        <Card className="flex items-center space-x-4 p-4">
          <div className={cn("p-2.5 rounded-full border", {
            "bg-collision-red/15 border-collision-red/40 text-collision-red animate-pulse": criticalConjunctions.length > 0,
            "bg-iron border-graphite text-ash": criticalConjunctions.length === 0
          })}>
            <ShieldAlert className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div>
            <span className={cn("font-data text-[24px] font-bold leading-none block", {
              "text-collision-red": criticalConjunctions.length > 0,
              "text-bone": criticalConjunctions.length === 0,
            })}>
              {criticalConjunctions.length}
            </span>
            <span className="font-data text-[10px] text-ash uppercase tracking-[0.182em] mt-0.5 block">
              Critical Alerts Active
            </span>
          </div>
        </Card>

        {/* Card 4: Conjunction Events (72h) */}
        <Card className="flex items-center space-x-4 p-4">
          <div className="p-2.5 rounded-full bg-cleared-green/10 border border-cleared-green/30 text-cleared-green">
            <Zap className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div>
            <span className="font-data text-[24px] font-bold text-cleared-green leading-none block">
              {conjunctions.length}
            </span>
            <span className="font-data text-[10px] text-ash uppercase tracking-[0.182em] mt-0.5 block">
              Conjunction Events (72h)
            </span>
          </div>
        </Card>
      </div>

      {/* SECTION 2 — Split-Screen Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[600px]">
        {/* Left Panel (40%) — Active Threats & Fleet Status */}
        <div className="lg:col-span-2 flex flex-col space-y-4 overflow-y-auto pr-1 h-full scrollbar-thin">
          {/* Active Threats */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-data text-[11px] text-ash uppercase tracking-[0.182em]">
                Active Hazard Conjunctions
              </h2>
              <span className="font-data text-[10px] text-graphite">
                THREATS ACTIVE: {activeConjunctions.length}
              </span>
            </div>

            <div className="space-y-4">
              {activeConjunctions.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed">
                  <StatusDot status="cleared" ping={false} className="mb-2" />
                  <span className="font-data text-[11px] font-semibold text-ash uppercase tracking-[0.182em]">
                    No Active Hazards
                  </span>
                  <span className="font-body text-[11px] text-graphite mt-1 max-w-xs">
                    All orbital segments within monitored grids report clearance.
                  </span>
                </Card>
              ) : (
                activeConjunctions.map((conj) => {
                  const isCritical = conj.riskLevel === "red";
                  const satellite = satellites.find((s) => s.id === conj.primaryId);
                  const isSelected = selectedConjunctionId === conj.id;

                  return (
                    <Card
                      key={conj.id}
                      accentStatus={isCritical ? "critical" : "caution"}
                      className={cn("flex flex-col p-4 space-y-3 animate-slide-in cursor-pointer transition-all border", {
                        "border-orbit-cyan/60 bg-graphite/40 shadow-[0_0_10px_rgba(0,186,226,0.15)]": isSelected,
                        "border-transparent": !isSelected,
                      })}
                      onClick={() => {
                        setSelectedConjunctionId(conj.id);
                        if (satellite) {
                          setSelectedSatellite(satellite);
                        }
                      }}
                    >
                      {/* Event Header details */}
                      <div className="flex items-start justify-between border-b border-iron pb-2">
                        <div>
                          <span className="font-data text-[10px] text-graphite">ALERT ID: {conj.id}</span>
                          <h3 className="font-data text-[13px] font-bold text-bone uppercase mt-0.5">
                            {satellite?.name} vs {conj.secondaryName}
                          </h3>
                        </div>
                        <Badge variant={isCritical ? "critical" : "caution"}>
                          {conj.riskLevel}
                        </Badge>
                      </div>

                      {/* TCA and metrics info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                           <span className="font-data text-[10px] text-ash uppercase tracking-[0.182em] block">
                             TCA Countdown
                           </span>
                          <span className="font-data text-[13px] text-bone block mt-0.5" suppressHydrationWarning>
                            {getTimeRemaining(conj.tca)}
                          </span>
                        </div>
                        <div>
                           <span className="font-data text-[10px] text-ash uppercase tracking-[0.182em] block">
                             Miss Distance
                           </span>
                          <span className="font-data text-[13px] text-bone block mt-0.5" suppressHydrationWarning>
                            {conj.missDistanceMeters.toLocaleString()} m
                          </span>
                        </div>
                        <div className="col-span-2">
                           <span className="font-data text-[10px] text-ash uppercase tracking-[0.182em] block">
                             Collision Probability
                           </span>
                          <div className="flex items-center space-x-2 mt-1">
                            <div className="flex-1 h-2 bg-void border border-iron rounded-full overflow-hidden">
                              <div
                                className={cn("h-full", isCritical ? "bg-collision-red" : "bg-threat-amber")}
                                style={{ width: `${Math.min(conj.pc * 1000, 100)}%` }}
                              />
                            </div>
                            <span className={cn("font-data text-[13px] font-bold shrink-0", isCritical ? "text-collision-red" : "text-threat-amber")}>
                              {formatPercentage(conj.pc)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex space-x-2 pt-2 border-t border-iron/50">
                        <Link href={`/maneuvers?event=${conj.id}`} className="flex-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="primary" className="w-full py-1.5 px-3">
                            Plan Maneuver
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismissConjunction(conj.id);
                          }}
                          className="py-1.5 px-3"
                        >
                          Dismiss
                        </Button>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Fleet Status Telemetry */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
               <h2 className="font-data text-[11px] text-ash uppercase tracking-[0.182em]">
                 Fleet Status Telemetry
               </h2>
            </div>

            <div className="border border-iron/30 rounded-[16px] bg-graphite divide-y divide-iron/20 overflow-hidden">
              {satellites.map((sat) => {
                const relativeConj = activeConjunctions.find(
                  (c) => c.primaryId === sat.id
                );

                return (
                  <div
                    key={sat.id}
                    onClick={() => setSelectedSatellite(sat)}
                    className="p-4 flex flex-col hover:bg-iron/20 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                        <StatusDot
                          status={
                            sat.riskLevel === "red"
                              ? "critical"
                              : sat.riskLevel === "yellow"
                              ? "caution"
                              : "monitoring"
                          }
                          ping={sat.riskLevel === "red"}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-data text-[14px] font-bold text-bone truncate group-hover:text-orbit-cyan transition-colors">
                              {sat.name}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="monitoring" className="h-5 shrink-0 uppercase">
                        {sat.objectType}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center mt-3 gap-4">
                      <div className="flex items-center space-x-3 text-[11px] text-ash font-data">
                        <span>ALT: {sat.altitude != null ? `${sat.altitude.toFixed(0)}km` : "N/A"}</span>
                        <span className="text-graphite">|</span>
                        <span>INC: {sat.inclination != null ? `${sat.inclination.toFixed(1)}°` : "N/A"}</span>
                      </div>

                      <div className="flex items-center space-x-2 w-[100px]">
                        <span className="font-data text-[10px] text-ash">FUEL {sat.fuelRemainingPct != null ? `${sat.fuelRemainingPct.toFixed(0)}%` : "N/A"}</span>
                        <div className="flex-1 h-1 bg-void border border-iron rounded-full overflow-hidden">
                          <div
                            className={cn("h-full transition-all duration-300", sat.fuelRemainingPct != null ? getFuelColorClass(sat.fuelRemainingPct) : "")}
                            style={{ width: `${sat.fuelRemainingPct ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel (60%) — 3D Earth Visualizer */}
        <div className="lg:col-span-3 h-full relative overflow-hidden bg-graphite border border-iron/30 rounded-[16px]">
          <EarthView selectedObject={liveSelectedSatellite?.id || null} compact={true} />
        </div>
      </div>

      {/* SECTION 3 — Quick Actions */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-ash" />
          <h2 className="font-data text-[11px] text-ash uppercase tracking-[0.182em]">
            Quick Actions
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/conjunctions">
            <Card className="hover:border-orbit-cyan/50 hover:bg-steel/10 transition-all group cursor-pointer h-full">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-full bg-collision-red/10 border border-collision-red/30 text-collision-red group-hover:bg-collision-red/20 transition-colors">
                  <Radio className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <CardTitle>Conjunction Dashboard</CardTitle>
              </div>
              <CardDescription>
                View all conjunction events sorted by collision probability. Filter by risk level and status.
              </CardDescription>
            </Card>
          </Link>

          <Link href="/maneuvers">
            <Card className="hover:border-orbit-cyan/50 hover:bg-steel/10 transition-all group cursor-pointer h-full">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-full bg-orbit-cyan/10 border border-orbit-cyan/30 text-orbit-cyan group-hover:bg-orbit-cyan/20 transition-colors">
                  <Zap className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <CardTitle>Maneuver Planner</CardTitle>
              </div>
              <CardDescription>
                Calculate CW-based evasive burns. Use the "What-If" sandbox to explore ΔV scenarios in real time.
              </CardDescription>
            </Card>
          </Link>

          <Link href="/ai-briefing">
            <Card className="hover:border-orbit-cyan/50 hover:bg-steel/10 transition-all group cursor-pointer h-full">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-full bg-cleared-green/10 border border-cleared-green/30 text-cleared-green group-hover:bg-cleared-green/20 transition-colors">
                  <ShieldAlert className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <CardTitle>AI Briefing</CardTitle>
              </div>
              <CardDescription>
                Generate plain-English situational briefings from structured conjunction and maneuver data.
              </CardDescription>
            </Card>
          </Link>

          <Link href="/map">
            <Card className="hover:border-orbit-cyan/50 hover:bg-steel/10 transition-all group cursor-pointer h-full">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-full bg-threat-amber/10 border border-threat-amber/30 text-threat-amber group-hover:bg-threat-amber/20 transition-colors">
                  <Globe className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <CardTitle>3D Orbit Map</CardTitle>
              </div>
              <CardDescription>
                Explore real-time SGP4-propagated orbital tracks on an interactive 3D globe with time-scrub.
              </CardDescription>
            </Card>
          </Link>
        </div>
      </section>

      {/* SATELLITE DETAIL DRAWER (400px Wide Slide-Over) */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 w-[400px] bg-obsidian border-l border-iron/30 z-50 p-6 flex flex-col transition-transform duration-300 ease-in-out transform",
          selectedSatellite ? "translate-x-0" : "translate-x-full"
        )}
      >
        {liveSelectedSatellite && (
          <div className="flex flex-col h-full space-y-6">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-iron/20 pb-4">
              <div>
                <span className="font-data text-[10px] text-orbit-cyan uppercase tracking-[0.182em] block">NORAD ID: {liveSelectedSatellite.noradId}</span>
                <h3 className="font-display text-[22px] font-light text-cloud leading-tight mt-1 tracking-tight">
                  {liveSelectedSatellite.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSatellite(null)}
                className="p-1 rounded-[8px] border border-iron/30 text-ash hover:text-bone hover:bg-steel/30 transition-all focus:outline-none cursor-pointer"
              >
                <X className="h-4.5 w-4.5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1 scrollbar-thin">
              {/* Telemetry Block */}
              <div className="space-y-3">
                <h4 className="font-data text-[10px] text-ash uppercase tracking-[0.182em] block">
                  Orbital Telemetry Parameters
                </h4>
                <div className="grid grid-cols-2 gap-3.5 bg-abyss/40 border border-iron/20 rounded-[12px] p-4">
                  <div>
                    <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] block">Altitude</span>
                    <span className="font-data text-[13px] text-bone block mt-0.5">{liveSelectedSatellite.altitude != null ? `${liveSelectedSatellite.altitude.toFixed(2)} km` : "N/A"}</span>
                  </div>
                  <div>
                    <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] block">Inclination</span>
                    <span className="font-data text-[13px] text-bone block mt-0.5">{liveSelectedSatellite.inclination != null ? `${liveSelectedSatellite.inclination.toFixed(4)}°` : "N/A"}</span>
                  </div>
                  <div>
                    <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] block">Operator</span>
                    <span className="font-body text-[13px] text-bone block mt-0.5">{liveSelectedSatellite.owner}</span>
                  </div>
                  <div>
                    <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] block">Object Type</span>
                    <span className="font-data text-[11px] text-orbit-cyan uppercase mt-0.5 block">{liveSelectedSatellite.objectType}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] block">Longitude Position</span>
                    <span className="font-data text-[13px] text-orbit-cyan block mt-0.5">
                      {liveSelectedSatellite.longitude != null ? `${liveSelectedSatellite.longitude.toFixed(4)}°` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status details */}
              <div className="space-y-3">
                <h4 className="font-data text-[10px] text-ash uppercase tracking-[0.182em] block">
                  Operational Health Status
                </h4>
                <div className="bg-abyss/40 border border-iron/20 rounded-[12px] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em]">Threat Level</span>
                    <Badge variant={liveSelectedSatellite.riskLevel === "red" ? "critical" : liveSelectedSatellite.riskLevel === "yellow" ? "caution" : "monitoring"}>
                      {liveSelectedSatellite.riskLevel}
                    </Badge>
                  </div>
                  <div className="border-t border-iron/20 pt-3">
                    <div className="flex items-center justify-between font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] mb-1.5">
                      <span>Propellant Reserves</span>
                      <span className="font-data text-[11px] text-bone">{liveSelectedSatellite.fuelRemainingPct != null ? `${liveSelectedSatellite.fuelRemainingPct.toFixed(1)}%` : "N/A"}</span>
                    </div>
                    <div className="h-2 bg-void border border-iron/30 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-300", liveSelectedSatellite.fuelRemainingPct != null ? getFuelColorClass(liveSelectedSatellite.fuelRemainingPct) : "")}
                        style={{ width: `${liveSelectedSatellite.fuelRemainingPct ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Conjunction details in drawer */}
              <div className="space-y-3">
                <h4 className="font-data text-[10px] text-ash uppercase tracking-[0.182em] block">
                  Associated Hazard Collisions
                </h4>
                {activeConjunctions.filter(c => c.primaryId === liveSelectedSatellite.id).length === 0 ? (
                  <div className="bg-abyss/40 border border-iron/20 rounded-[12px] p-4 text-center">
                    <span className="font-data text-[11px] font-bold text-cleared-green uppercase tracking-[0.182em]">
                      No Active Alerts
                    </span>
                    <p className="font-body text-[11px] text-ash/50 mt-1">
                      No imminent warning thresholds breached for this satellite coordinates.
                    </p>
                  </div>
                ) : (
                  activeConjunctions
                    .filter(c => c.primaryId === liveSelectedSatellite.id)
                    .map(c => {
                      const isC = c.riskLevel === "red";
                      return (
                        <div key={c.id} className="border border-iron/20 rounded-[12px] p-4 bg-abyss/40 space-y-2">
                          <div className="flex items-center justify-between border-b border-iron/10 pb-1.5">
                            <span className="font-data text-[11px] text-bone uppercase">{c.secondaryName}</span>
                            <Badge variant={isC ? "critical" : "caution"}>
                              {c.riskLevel}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] font-data text-ash">
                            <div>Miss: {c.missDistanceMeters.toLocaleString()} m</div>
                            <div>TCA: {getTimeRemaining(c.tca)}</div>
                            <div className="col-span-2 text-right">
                              Risk: <strong className={isC ? "text-collision-red" : "text-threat-amber"}>{formatPercentage(c.pc)}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Footer Action */}
            <div className="border-t border-iron/20 pt-4 space-y-2">
              <Link href={`/map?sat=${liveSelectedSatellite.id}`}>
                <Button
                  variant="primary"
                  className="w-full text-center flex items-center justify-center space-x-2 bg-pure hover:bg-[#cacaca] text-void font-bold"
                >
                  <Globe className="h-4 w-4" />
                  <span>View on 3D Map</span>
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => setSelectedSatellite(null)}
                className="w-full text-center"
              >
                Close Panel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Backdrop for selected drawer panel */}
      {selectedSatellite && (
        <div
          onClick={() => setSelectedSatellite(null)}
          className="fixed inset-0 bg-void/60 z-40 transition-opacity"
        />
      )}
    </div>
  );
}
