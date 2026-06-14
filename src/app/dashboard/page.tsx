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
import { Card } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusDot";
import { cn } from "@/lib/utils";
import { Satellite, ConjunctionEvent } from "@/types";
import { useOrbitStream } from "@/lib/hooks/useOrbitStream";

export default function DashboardPage() {
  const { satellites, conjunctionEvents: conjunctions } = useOrbitStream();

  const [loading, setLoading] = React.useState(true);

  // Client-side interactions states
  const [selectedSatellite, setSelectedSatellite] = React.useState<Satellite | null>(null);
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
    const diffMs = new Date(tcaISO).getTime() - new Date().getTime();
    if (diffMs <= 0) return "0h 0m";
    const totalMin = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return `${hours}h ${mins}m`;
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
            <span className="font-display text-[10px] font-semibold text-ash uppercase tracking-wider mt-0.5 block">
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
            <span className="font-display text-[10px] font-semibold text-ash uppercase tracking-wider mt-0.5 block">
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
            <span className="font-display text-[10px] font-semibold text-ash uppercase tracking-wider mt-0.5 block">
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
            <span className="font-display text-[10px] font-semibold text-ash uppercase tracking-wider mt-0.5 block">
              Conjunction Events (72h)
            </span>
          </div>
        </Card>
      </div>

      {/* SECTION 2 — Double Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column (60%) — Fleet Status */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-ash">
              Fleet Status Telemetry
            </h2>
            <span className="font-data text-[10px] text-graphite">
              ONLINE STATE REFRESH: NOMINAL
            </span>
          </div>

          <div className="border border-iron rounded-[6px] bg-[#0c1520] divide-y divide-iron overflow-hidden">
            {satellites.map((sat) => {
              // Check if satellite has any active conjunction relative to it
              const relativeConj = activeConjunctions.find(
                (c) => c.primaryId === sat.id
              );

              return (
                <div
                  key={sat.id}
                  onClick={() => setSelectedSatellite(sat)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-iron/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    {/* Status Dot with pulse on critical */}
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
                        <span className="bg-void/50 border border-iron text-[10px] text-ash px-1.5 py-0.5 rounded-[3px] uppercase tracking-wider">
                          {sat.owner}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] text-ash mt-1 font-data">
                        <span>ALT: {sat.altitude.toFixed(1)} km</span>
                        <span className="text-graphite">|</span>
                        <span>INC: {sat.inclination.toFixed(2)}°</span>
                      </div>
                    </div>
                  </div>

                  {/* Fuel gauges */}
                  <div className="flex items-center space-x-6 min-w-[180px]">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[10px] text-ash font-data mb-1">
                        <span>FUEL</span>
                        <span>{sat.fuelRemainingPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-void border border-iron rounded-full overflow-hidden">
                        <div
                          className={cn("h-full transition-all duration-300", getFuelColorClass(sat.fuelRemainingPct))}
                          style={{ width: `${sat.fuelRemainingPct}%` }}
                        />
                      </div>
                    </div>
                    <Badge variant="monitoring" className="h-5 shrink-0 uppercase">
                      {sat.objectType}
                    </Badge>
                  </div>

                  {/* Warning tag if active conjunction exists */}
                  {relativeConj && (
                    <div className="shrink-0 flex items-center">
                      <span className="bg-collision-red/10 border border-collision-red/30 text-collision-red font-display text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[3px] flex items-center space-x-1.5" suppressHydrationWarning>
                        <span className="h-1.5 w-1.5 rounded-full bg-collision-red animate-ping" />
                        <span>⚠ Conjunction in {getTimeRemaining(relativeConj.tca)}</span>
                      </span>
                    </div>
                  )}

                  <ChevronRight
                    className="h-4 w-4 text-graphite group-hover:text-bone transition-colors self-center hidden sm:block"
                    strokeWidth={1.5}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (40%) — Active Threats */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-ash">
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
                <span className="font-display text-[12px] font-bold text-ash uppercase tracking-wider">
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

                return (
                  <Card
                    key={conj.id}
                    accentStatus={isCritical ? "critical" : "caution"}
                    className="flex flex-col p-4 space-y-3 animate-slide-in"
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
                        <span className="font-display text-[10px] font-semibold text-ash uppercase tracking-wider block">
                          TCA Countdown
                        </span>
                        <span className="font-data text-[13px] text-bone block mt-0.5" suppressHydrationWarning>
                          {getTimeRemaining(conj.tca)}
                        </span>
                      </div>
                      <div>
                        <span className="font-display text-[10px] font-semibold text-ash uppercase tracking-wider block">
                          Miss Distance
                        </span>
                        <span className="font-data text-[13px] text-bone block mt-0.5" suppressHydrationWarning>
                          {conj.missDistanceMeters.toLocaleString()} m
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="font-display text-[10px] font-semibold text-ash uppercase tracking-wider block">
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
                            {conj.pcDisplay}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex space-x-2 pt-2 border-t border-iron/50">
                      <Link href={`/maneuvers?event=${conj.id}`} className="flex-1">
                        <Button variant="primary" className="w-full py-1.5 px-3">
                          View Maneuver
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        onClick={() => handleDismissConjunction(conj.id)}
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
      </div>

      {/* SECTION 3 — Quick Actions */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-ash" />
          <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-ash">
            Quick Actions
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/conjunctions">
            <Card className="p-4 hover:border-orbit-cyan/50 transition-all group cursor-pointer h-full">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-full bg-collision-red/10 border border-collision-red/30 text-collision-red group-hover:bg-collision-red/20 transition-colors">
                  <Radio className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <span className="font-display text-[11px] font-bold text-bone uppercase tracking-wider">Conjunction Dashboard</span>
              </div>
              <p className="font-body text-[11px] text-ash leading-relaxed">
                View all conjunction events sorted by collision probability. Filter by risk level and status.
              </p>
            </Card>
          </Link>

          <Link href="/maneuvers">
            <Card className="p-4 hover:border-orbit-cyan/50 transition-all group cursor-pointer h-full">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-full bg-orbit-cyan/10 border border-orbit-cyan/30 text-orbit-cyan group-hover:bg-orbit-cyan/20 transition-colors">
                  <Zap className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <span className="font-display text-[11px] font-bold text-bone uppercase tracking-wider">Maneuver Planner</span>
              </div>
              <p className="font-body text-[11px] text-ash leading-relaxed">
                Calculate CW-based evasive burns. Use the "What-If" sandbox to explore ΔV scenarios in real time.
              </p>
            </Card>
          </Link>

          <Link href="/ai-briefing">
            <Card className="p-4 hover:border-orbit-cyan/50 transition-all group cursor-pointer h-full">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-full bg-cleared-green/10 border border-cleared-green/30 text-cleared-green group-hover:bg-cleared-green/20 transition-colors">
                  <ShieldAlert className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <span className="font-display text-[11px] font-bold text-bone uppercase tracking-wider">AI Briefing</span>
              </div>
              <p className="font-body text-[11px] text-ash leading-relaxed">
                Generate plain-English situational briefings from structured conjunction and maneuver data.
              </p>
            </Card>
          </Link>

          <Link href="/map">
            <Card className="p-4 hover:border-orbit-cyan/50 transition-all group cursor-pointer h-full">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 rounded-full bg-threat-amber/10 border border-threat-amber/30 text-threat-amber group-hover:bg-threat-amber/20 transition-colors">
                  <Globe className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <span className="font-display text-[11px] font-bold text-bone uppercase tracking-wider">3D Orbit Map</span>
              </div>
              <p className="font-body text-[11px] text-ash leading-relaxed">
                Explore real-time SGP4-propagated orbital tracks on an interactive 3D globe with time-scrub.
              </p>
            </Card>
          </Link>
        </div>
      </section>

      {/* SATELLITE DETAIL DRAWER (400px Wide Slide-Over) */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 w-[400px] bg-[#0f1629] border-l border-[#1e2d4a] z-50 shadow-2xl p-6 flex flex-col transition-transform duration-300 ease-in-out transform",
          selectedSatellite ? "translate-x-0" : "translate-x-full"
        )}
      >
        {liveSelectedSatellite && (
          <div className="flex flex-col h-full space-y-6">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-iron pb-4">
              <div>
                <span className="font-data text-[10px] text-orbit-cyan block">NORAD ID: {liveSelectedSatellite.noradId}</span>
                <h3 className="font-display text-[18px] font-bold uppercase text-bone mt-0.5">
                  {liveSelectedSatellite.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSatellite(null)}
                className="p-1 rounded-[4px] border border-iron text-ash hover:text-bone hover:bg-iron transition-colors focus:outline-none cursor-pointer"
              >
                <X className="h-4.5 w-4.5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Telemetry Block */}
              <div className="space-y-3">
                <h4 className="font-display text-[11px] font-semibold text-ash uppercase tracking-wider">
                  Orbital Telemetry Parameters
                </h4>
                <div className="grid grid-cols-2 gap-3.5 bg-void/50 border border-iron/60 rounded-[4px] p-3">
                  <div>
                    <span className="font-display text-[10px] text-graphite uppercase tracking-wide block">Altitude</span>
                    <span className="font-data text-[13px] text-bone block mt-0.5">{liveSelectedSatellite.altitude.toFixed(2)} km</span>
                  </div>
                  <div>
                    <span className="font-display text-[10px] text-graphite uppercase tracking-wide block">Inclination</span>
                    <span className="font-data text-[13px] text-bone block mt-0.5">{liveSelectedSatellite.inclination.toFixed(4)}°</span>
                  </div>
                  <div>
                    <span className="font-display text-[10px] text-graphite uppercase tracking-wide block">Operator</span>
                    <span className="font-display text-[12px] font-semibold text-bone block mt-0.5">{liveSelectedSatellite.owner}</span>
                  </div>
                  <div>
                    <span className="font-display text-[10px] text-graphite uppercase tracking-wide block">Object Type</span>
                    <span className="font-display text-[11px] font-bold text-orbit-cyan uppercase mt-0.5 block">{liveSelectedSatellite.objectType}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="font-display text-[10px] text-graphite uppercase tracking-wide block">Longitude Position</span>
                    <span className="font-data text-[13px] text-orbit-cyan block mt-0.5">
                      {liveSelectedSatellite.longitude !== undefined ? `${liveSelectedSatellite.longitude.toFixed(4)}°` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status details */}
              <div className="space-y-3">
                <h4 className="font-display text-[11px] font-semibold text-ash uppercase tracking-wider">
                  Operational Health Status
                </h4>
                <div className="bg-void/50 border border-iron/60 rounded-[4px] p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[10px] text-graphite uppercase tracking-wide">Threat Level</span>
                    <Badge variant={liveSelectedSatellite.riskLevel === "red" ? "critical" : liveSelectedSatellite.riskLevel === "yellow" ? "caution" : "monitoring"}>
                      {liveSelectedSatellite.riskLevel}
                    </Badge>
                  </div>
                  <div className="border-t border-iron/40 pt-3">
                    <div className="flex items-center justify-between font-display text-[10px] text-graphite uppercase tracking-wide mb-1.5">
                      <span>Propellant Reserves</span>
                      <span className="font-data text-[11px] text-bone">{liveSelectedSatellite.fuelRemainingPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-void border border-iron rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-300", getFuelColorClass(liveSelectedSatellite.fuelRemainingPct))}
                        style={{ width: `${liveSelectedSatellite.fuelRemainingPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Conjunction details in drawer */}
              <div className="space-y-3">
                <h4 className="font-display text-[11px] font-semibold text-ash uppercase tracking-wider">
                  Associated Hazard Collisions
                </h4>
                {activeConjunctions.filter(c => c.primaryId === liveSelectedSatellite.id).length === 0 ? (
                  <div className="bg-void/50 border border-iron/60 rounded-[4px] p-4 text-center">
                    <span className="font-display text-[11px] font-semibold text-cleared-green uppercase tracking-wider">
                      No Active Alerts
                    </span>
                    <p className="font-body text-[11px] text-graphite mt-1">
                      No imminent warning thresholds breached for this satellite coordinates.
                    </p>
                  </div>
                ) : (
                  activeConjunctions
                    .filter(c => c.primaryId === liveSelectedSatellite.id)
                    .map(c => {
                      const isC = c.riskLevel === "red";
                      return (
                        <div key={c.id} className="border border-iron/60 rounded-[4px] p-3 bg-void/50 space-y-2">
                          <div className="flex items-center justify-between border-b border-iron/40 pb-1.5">
                            <span className="font-data text-[11px] text-bone uppercase">{c.secondaryName}</span>
                            <Badge variant={isC ? "critical" : "caution"}>
                              {c.riskLevel}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] font-data text-ash">
                            <div>Miss: {c.missDistanceMeters.toLocaleString()} m</div>
                            <div>TCA: {getTimeRemaining(c.tca)}</div>
                            <div className="col-span-2 text-right">
                              Risk: <strong className={isC ? "text-collision-red" : "text-threat-amber"}>{c.pcDisplay}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Footer Action */}
            <div className="border-t border-iron pt-4 space-y-2">
              <Link href={`/map?sat=${liveSelectedSatellite.id}`}>
                <Button
                  variant="primary"
                  className="w-full text-center flex items-center justify-center space-x-2 bg-orbit-cyan hover:bg-[#00c5dd] text-void font-bold"
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
