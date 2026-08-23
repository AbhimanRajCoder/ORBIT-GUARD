"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Satellite, ConjunctionEvent } from "@/types";
import { AlertTriangle } from "lucide-react";

interface PopulatedSatellite extends Satellite {
  conjunction?: ConjunctionEvent | null;
}

interface SatelliteStatusCardProps {
  satellite: PopulatedSatellite;
}

export function SatelliteStatusCard({ satellite }: SatelliteStatusCardProps) {
  const conj = satellite.conjunction;
  const isCritical = satellite.riskLevel === "red";
  const isWarning = satellite.riskLevel === "yellow";
  const isSafe = satellite.riskLevel === "green";

  // Helper to format countdown (Xh Ym)
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

  return (
    <div
      className={cn(
        "rounded-[6px] border p-5 flex flex-col items-center justify-between text-center transition-all select-none duration-300 h-full",
        {
          "bg-collision-red/5 border-collision-red shadow-[0_0_15px_rgba(200,0,42,0.1)]":
            isCritical,
          "bg-threat-amber/4 border-threat-amber": isWarning,
          "bg-abyss border-[#1e2d4a] hover:border-orbit-cyan/40": isSafe,
        }
      )}
    >
      {/* 1. Large Circle Status containing name */}
      <div className="flex flex-col items-center mt-2 mb-4">
        <div
          className={cn(
            "w-28 h-28 rounded-full border-2 flex items-center justify-center p-3 transition-transform duration-300 hover:scale-105",
            {
              "border-collision-red text-collision-red bg-void shadow-[inset_0_0_10px_rgba(200,0,42,0.2)] animate-pulse":
                isCritical,
              "border-threat-amber text-threat-amber bg-void shadow-[inset_0_0_10px_rgba(224,140,0,0.15)]":
                isWarning,
              "border-cleared-green text-cleared-green bg-void": isSafe,
            }
          )}
        >
          <span className="font-display text-[11px] font-bold uppercase tracking-wider text-bone break-all text-center">
            {satellite.name}
          </span>
        </div>
      </div>

      {/* 2. Text Status Label */}
      <div className="mb-4">
        <span
          className={cn("font-display text-[13px] font-bold uppercase tracking-[0.12em]", {
            "text-collision-red": isCritical,
            "text-threat-amber": isWarning,
            "text-cleared-green": isSafe,
          })}
        >
          {isCritical ? "RED ALERT" : isWarning ? "YELLOW ALERT" : "ALL CLEAR"}
        </span>
      </div>

      {/* 3. Core Telemetry */}
      <div className="w-full border-t border-iron/40 pt-3 space-y-1 font-data text-[12px] text-ash">
        <div className="flex justify-between">
          <span className="font-display text-[10px] text-graphite uppercase">Owner</span>
          <span className="text-bone">{satellite.owner}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-display text-[10px] text-graphite uppercase">Altitude</span>
          <span className="text-bone">{satellite.altitude != null ? `${satellite.altitude.toFixed(1)} km` : "N/A"}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-display text-[10px] text-graphite uppercase">Type</span>
          <span className="text-bone uppercase">{satellite.objectType}</span>
        </div>
      </div>

      {/* 4. Conjunction / Threat Details */}
      {(isCritical || isWarning) && conj ? (
        <div className="w-full mt-4 p-3 bg-void/50 border border-[#1e2d4a] rounded-[4px] space-y-2 text-left">
          <div className="flex items-center space-x-1.5 text-[11px] font-display font-semibold uppercase text-ash border-b border-iron/40 pb-1">
            <AlertTriangle
              className={cn("h-3.5 w-3.5", {
                "text-collision-red animate-bounce": isCritical,
                "text-threat-amber": isWarning,
              })}
              strokeWidth={1.5}
            />
            <span>Threat details</span>
          </div>
          
          <div className="space-y-1 font-data text-[11px] text-ash">
            <div className="flex justify-between">
              <span>Object:</span>
              <span className="text-bone truncate max-w-[140px] font-semibold">
                {conj.secondaryName}
              </span>
            </div>
            <div className="flex justify-between">
              <span>TCA Time:</span>
              <span className="text-bone font-semibold">{getTimeRemaining(conj.tca)}</span>
            </div>
            <div className="flex justify-between">
              <span>Miss Dist:</span>
              <span className="text-bone font-semibold">
                {conj.missDistanceMeters.toLocaleString()} m
              </span>
            </div>
            <div className="flex justify-between">
              <span>Probability:</span>
              <span
                className={cn("font-bold", {
                  "text-collision-red": isCritical,
                  "text-threat-amber": isWarning,
                })}
              >
                {conj.pcDisplay}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-iron/30">
            <Link
              href={`/maneuvers?event=${conj.id}`}
              className={cn(
                "w-full text-center py-1.5 px-3 rounded text-[11px] font-display font-bold uppercase tracking-wider bg-void border border-iron hover:bg-iron/10 transition-colors cursor-pointer",
                {
                  "text-collision-red border-collision-red/40 hover:bg-collision-red/10": isCritical,
                  "text-threat-amber border-threat-amber/40 hover:bg-threat-amber/10": isWarning,
                }
              )}
            >
              Analyze Maneuver →
            </Link>
            <Link
              href={`/map?sat=${satellite.id}`}
              className="w-full text-center py-1.5 px-3 rounded text-[11px] font-display font-bold uppercase tracking-wider text-orbit-cyan border border-orbit-cyan/40 hover:bg-orbit-cyan/10 transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <span>Simulate 3D Orbit</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="w-full mt-4">
          <Link
            href={`/map?sat=${satellite.id}`}
            className="w-full text-center py-2 px-3 rounded text-[11px] font-display font-bold uppercase tracking-wider text-ash border border-iron hover:border-orbit-cyan/50 hover:text-orbit-cyan hover:bg-orbit-cyan/5 transition-all duration-300 cursor-pointer flex items-center justify-center space-x-2"
          >
            <span>Simulate 3D Orbit</span>
          </Link>
        </div>
      )}
    </div>
  );
}
