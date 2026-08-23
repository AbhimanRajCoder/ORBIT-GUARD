"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Satellite, ConjunctionEvent } from "@/types";
import { useOrbitStream } from "@/lib/hooks/useOrbitStream";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusDot";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

import { MapLoadingPlaceholder } from "@/components/dashboard/MapLoadingPlaceholder";

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
    <div className="space-y-8 select-none relative animate-fade-in">
      {/* Page Title display headline */}
      <div className="pt-2">
        <h1 className="text-display uppercase">Mission Overview</h1>
        <p className="text-body-secondary mt-2">Real-time space traffic coordination and conjunction screening.</p>
      </div>

      <hr className="hairline-divider" />

      {/* SECTION 1 — Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Satellites */}
        <Card className="p-8">
          <div>
            <span className="text-mono-numeric text-[24px] text-[#f3f3f3] leading-none block font-normal">
              {satellites.length}
            </span>
            <span className="text-meta mt-2 block uppercase text-[11px] tracking-wider text-[#9c9c9c]">
              Total Satellites Tracked
            </span>
          </div>
        </Card>

        {/* Card 2: Active Conjunctions */}
        <Card className="p-8">
          <div>
            <span className={cn("text-mono-numeric text-[24px] leading-none block font-normal", {
              "text-[#ff3355]": activeConjunctions.length > 0,
              "text-[#f3f3f3]": activeConjunctions.length === 0,
            })}>
              {activeConjunctions.length}
            </span>
            <span className="text-meta mt-2 block uppercase text-[11px] tracking-wider text-[#9c9c9c]">
              <InfoTooltip term="Active Conjunctions" explanation="Conjunctions are events where two space objects (like satellites or debris) are predicted to pass very close to each other." />
            </span>
          </div>
        </Card>

        {/* Card 3: Critical Alerts */}
        <Card className="p-8">
          <div>
            <span className={cn("text-mono-numeric text-[24px] leading-none block font-normal", {
              "text-[#ff3355]": criticalConjunctions.length > 0,
              "text-[#f3f3f3]": criticalConjunctions.length === 0,
            })}>
              {criticalConjunctions.length}
            </span>
            <span className="text-meta mt-2 block uppercase text-[11px] tracking-wider text-[#9c9c9c]">
              <InfoTooltip term="Critical Alerts Active" explanation="High-risk conjunctions where the probability of collision is extremely elevated and immediate action is recommended." />
            </span>
          </div>
        </Card>

        {/* Card 4: Conjunction Events (72h) */}
        <Card className="p-8">
          <div>
            <span className="text-mono-numeric text-[24px] text-[#98ff38] leading-none block font-normal">
              {conjunctions.length}
            </span>
            <span className="text-meta mt-2 block uppercase text-[11px] tracking-wider text-[#9c9c9c]">
              Events Screener (72h)
            </span>
          </div>
        </Card>
      </div>

      <hr className="hairline-divider" />

      {/* SECTION 2 — Split-Screen Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[600px]">
        {/* Left Panel (60%) — Active Hazards */}
        <div className="lg:col-span-3 flex flex-col space-y-4 overflow-y-auto pr-1 h-full scrollbar-thin">
          {/* Active Threats */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#212121] pb-2">
              <h2 className="text-meta">
                <InfoTooltip term="Active Hazard Conjunctions" explanation="Ongoing close approach events between satellites and other objects that present a potential risk." />
              </h2>
              <span className="text-mono-numeric text-[11px] text-[#9c9c9c]">
                ACTIVE: {activeConjunctions.length}
              </span>
            </div>

            <div className="space-y-4">
              {activeConjunctions.length === 0 ? (
                <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed border-[#212121]">
                  <StatusDot status="cleared" ping={false} className="mb-2" />
                  <span className="text-meta text-[#9c9c9c]">
                    No Active Hazards
                  </span>
                  <span className="text-body-secondary text-[14px] mt-1 max-w-xs block">
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
                      className={cn("flex flex-col p-6 space-y-4 cursor-pointer transition-all border", {
                        "border-[#ffffff] bg-[#080808]": isSelected,
                        "border-[#212121] bg-transparent": !isSelected,
                      })}
                      onClick={() => {
                        setSelectedConjunctionId(conj.id);
                        if (satellite) {
                          setSelectedSatellite(satellite);
                        }
                      }}
                    >
                      {/* Event Header details */}
                      <div className="flex items-start justify-between border-b border-[#212121] pb-3">
                        <div>
                          <span className="text-mono-numeric text-[11px] text-[#9c9c9c] block">EVENT ID: {conj.id}</span>
                          <h3 className="text-body-primary text-[15px] uppercase mt-1">
                            {satellite?.name} vs {conj.secondaryName}
                          </h3>
                        </div>
                        <Badge variant={isCritical ? "critical" : "caution"}>
                          {conj.riskLevel === "red" ? "RED ALERT" : "YELLOW ALERT"}
                        </Badge>
                      </div>

                      {/* TCA and metrics info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                           <span className="text-meta block text-[#9c9c9c]">
                             <InfoTooltip term="TCA Countdown" explanation="Time of Closest Approach. The countdown to the exact moment when the two objects will be nearest to each other." />
                           </span>
                          <span className="text-mono-numeric text-[14px] text-[#f3f3f3] block mt-1" suppressHydrationWarning>
                            {getTimeRemaining(conj.tca)}
                          </span>
                        </div>
                        <div>
                           <span className="text-meta block text-[#9c9c9c]">
                             <InfoTooltip term="Miss Distance" explanation="The minimum physical distance predicted between the two objects at their closest point." />
                           </span>
                          <span className="text-mono-numeric text-[14px] text-[#f3f3f3] block mt-1" suppressHydrationWarning>
                            {conj.missDistanceMeters.toLocaleString()} m
                          </span>
                        </div>
                        <div className="col-span-2">
                           <span className="text-meta block text-[#9c9c9c]">
                             <InfoTooltip term="Collision Probability" explanation="The mathematical chance (expressed as a percentage) that the two objects will collide during the close approach." />
                           </span>
                          <div className="flex items-center space-x-3 mt-2">
                            <div className="flex-1 h-1.5 bg-[#101010] border border-[#212121] rounded-full overflow-hidden">
                              <div
                                className={cn("h-full", isCritical ? "bg-[#ff3355]" : "bg-[#ffb829]")}
                                style={{ width: `${Math.min(conj.pc * 1000, 100)}%` }}
                              />
                            </div>
                            <span className={cn("text-mono-numeric text-[13px] shrink-0", isCritical ? "text-[#ff3355]" : "text-[#ffb829]")}>
                              {formatPercentage(conj.pc)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex space-x-2 pt-3 border-t border-[#212121]">
                        <Link href={`/maneuvers?event=${conj.id}`} className="flex-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="primary" className="w-full py-2">
                            Plan Maneuver
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismissConjunction(conj.id);
                          }}
                          className="py-2 px-4"
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
        </div> {/* Closes Column 1 (Active Hazards) */}

        {/* Right Panel (40%) — Fleet Status Telemetry */}
        <div className="lg:col-span-2 flex flex-col space-y-4 overflow-y-auto pr-1 h-full scrollbar-thin border-l border-[#212121] pl-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#212121] pb-2">
               <h2 className="text-meta">
                 <InfoTooltip term="Fleet Status Telemetry" explanation="Real-time measurements and operational data transmitted from active satellites." />
               </h2>
            </div>

            <div className="border border-[#212121] rounded-[8px] bg-transparent divide-y divide-[#212121] overflow-hidden">
              {satellites.map((sat) => {
                return (
                  <div
                    key={sat.id}
                    onClick={() => setSelectedSatellite(sat)}
                    className="p-4 flex flex-col hover:bg-[#080808] transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
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
                            <span className="text-mono-numeric text-[13px] text-[#f3f3f3] truncate group-hover:text-[#ffffff] transition-colors">
                              {sat.name}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={sat.riskLevel === "red" ? "critical" : sat.riskLevel === "yellow" ? "caution" : "cleared"} className="h-5 shrink-0 uppercase text-[10px]">
                        {sat.objectType}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center mt-3 gap-4">
                      <div className="flex items-center space-x-3 text-[11px] text-[#9c9c9c] text-mono-numeric">
                        <span><InfoTooltip term="ALT" explanation="Altitude. The height of the satellite above the Earth's surface." />: {sat.altitude != null ? `${sat.altitude.toFixed(0)}km` : "N/A"}</span>
                        <span className="text-[#212121]">|</span>
                        <span><InfoTooltip term="INC" explanation="Inclination. The tilt angle of the satellite's orbit relative to the Earth's equator." />: {sat.inclination != null ? `${sat.inclination.toFixed(1)}°` : "N/A"}</span>
                      </div>

                      <div className="flex items-center space-x-2 w-[100px]">
                        <span className="text-mono-numeric text-[10px] text-[#9c9c9c]">FUEL {sat.fuelRemainingPct != null ? `${sat.fuelRemainingPct.toFixed(0)}%` : "N/A"}</span>
                        <div className="flex-1 h-1 bg-[#101010] border border-[#212121] rounded-full overflow-hidden">
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
        </div> {/* Closes Column 2 (Fleet Status Telemetry) */}
      </div>

      <hr className="hairline-divider" />

      {/* SECTION 3 — Quick Actions */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-[#212121]">
          <h2 className="text-meta">
            Operational Interfaces
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/conjunctions">
            <Card className="hover:border-[#f3f3f3] hover:bg-[#080808]/50 transition-all group cursor-pointer h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <h3 className="text-body-primary text-[18px]">Conjunctions</h3>
                </div>
                <CardDescription>
                  View all active conjunction threats sorted by collision probability. Filter by risk levels and status.
                </CardDescription>
              </div>
            </Card>
          </Link>

          <Link href="/maneuvers">
            <Card className="hover:border-[#f3f3f3] hover:bg-[#080808]/50 transition-all group cursor-pointer h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <h3 className="text-body-primary text-[18px]">Maneuvers</h3>
                </div>
                <CardDescription>
                  Calculate evasive burns using Clohessy-Wiltshire solver equations and simulate Delta-V vectors.
                </CardDescription>
              </div>
            </Card>
          </Link>

          <Link href="/ai-briefing">
            <Card className="hover:border-[#f3f3f3] hover:bg-[#080808]/50 transition-all group cursor-pointer h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <h3 className="text-body-primary text-[18px]">AI Situation</h3>
                </div>
                <CardDescription>
                  Generate human-readable situational intelligence briefing and reports from telemetry streams.
                </CardDescription>
              </div>
            </Card>
          </Link>

          <Link href="/map">
            <Card className="hover:border-[#f3f3f3] hover:bg-[#080808]/50 transition-all group cursor-pointer h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <h3 className="text-body-primary text-[18px]">3D Live Map</h3>
                </div>
                <CardDescription>
                  Track SGP4-propagated orbits in ECEF coordinates on an interactive 3D Earth projection stage.
                </CardDescription>
              </div>
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
                <span className="font-data text-[10px] text-orbit-cyan uppercase tracking-[0.182em] block">
                  <InfoTooltip term="NORAD ID" explanation="A unique five-digit number assigned by the North American Aerospace Defense Command to catalog every object in space." />: {liveSelectedSatellite.noradId}
                </span>
                <h3 className="font-display text-[22px] font-light text-cloud leading-tight mt-1 tracking-tight">
                  {liveSelectedSatellite.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSatellite(null)}
                className="px-2.5 py-1 rounded-[8px] border border-[#212121] text-[#9c9c9c] hover:text-[#f3f3f3] hover:bg-[#080808] transition-all focus:outline-none cursor-pointer font-mono text-[11px]"
              >
                [X]
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1 scrollbar-thin">
              {/* Telemetry Block */}
              <div className="space-y-3">
                <h4 className="font-data text-[10px] text-ash uppercase tracking-[0.182em] block">
                  Orbital <InfoTooltip term="Telemetry" explanation="Real-time measurements and operational data transmitted from active satellites." /> Parameters
                </h4>
                <div className="grid grid-cols-2 gap-3.5 bg-abyss/40 border border-iron/20 rounded-[12px] p-4">
                  <div>
                    <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] block">
                      <InfoTooltip term="Altitude" explanation="The height of the satellite above the Earth's surface." />
                    </span>
                    <span className="font-data text-[13px] text-bone block mt-0.5">{liveSelectedSatellite.altitude != null ? `${liveSelectedSatellite.altitude.toFixed(2)} km` : "N/A"}</span>
                  </div>
                  <div>
                    <span className="font-data text-[9px] text-ash/60 uppercase tracking-[0.1em] block">
                      <InfoTooltip term="Inclination" explanation="The tilt angle of the satellite's orbit relative to the Earth's equator." />
                    </span>
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
                      <span><InfoTooltip term="Propellant Reserves" explanation="The remaining fuel available for satellite maneuvers and orbit corrections." /></span>
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
