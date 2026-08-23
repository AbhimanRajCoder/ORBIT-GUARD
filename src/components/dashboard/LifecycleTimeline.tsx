"use client";

import React from "react";
import { ConjunctionEvent } from "@/types";
import { cn } from "@/lib/utils";

interface LifecycleTimelineProps {
  event: ConjunctionEvent;
}

interface StepItem {
  key: string;
  label: string;
  description: string;
}

const ALL_STEPS: StepItem[] = [
  {
    key: "detected",
    label: "Threat Detected",
    description: "Coarse & fine screening finished. Orbital hazard identified.",
  },
  {
    key: "explained",
    label: "AI Briefing Generated",
    description: "LLM risk summary and situational context established.",
  },
  {
    key: "maneuvers_calculated",
    label: "Dodging Maneuvers Computed",
    description: "Clohessy-Wiltshire relative burn vectors calculated.",
  },
  {
    key: "tradeoff_ranked",
    label: "Trade-off Assessment Ranked",
    description: "Optimal evasive maneuver evaluated against secondary risks.",
  },
  {
    key: "approved",
    label: "Authorization Resolution",
    description: "Operator review completed. Uplink authorization decision logged.",
  }
];

export default function LifecycleTimeline({ event }: LifecycleTimelineProps) {
  const lifecycle = event?.lifecycle || [];

  // Find completed states
  const completedStates = new Set<string>();
  const stateEventMap = new Map<string, any>();

  lifecycle.forEach((item) => {
    completedStates.add(item.state);
    stateEventMap.set(item.state, item);
  });

  // If approved or rejected is in completedStates, mark the final step completed
  const hasApproved = completedStates.has("approved");
  const hasRejected = completedStates.has("rejected");
  const isFinalStepResolved = hasApproved || hasRejected;

  // Determine current active step index
  let activeIndex = 0;
  if (completedStates.has("detected")) activeIndex = 1;
  if (completedStates.has("explained")) activeIndex = 2;
  if (completedStates.has("maneuvers_calculated")) activeIndex = 3;
  if (completedStates.has("tradeoff_ranked")) activeIndex = 4;
  if (isFinalStepResolved) activeIndex = 5;

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toISOString().replace("T", " ").substring(0, 19) + " UTC";
    } catch (_) {
      return isoStr;
    }
  };

  return (
    <div className="bg-transparent border border-[#212121] rounded-[8px] p-5 space-y-4">
      <div className="flex items-center space-x-2 border-b border-[#212121] pb-2.5">
        <span className="text-[11px] font-mono text-[#9c9c9c] uppercase tracking-wider">
          Verifiable Conjunction Lifecycle
        </span>
      </div>

      <div className="relative pl-6 space-y-6">
        {/* Timeline Connecting Vertical Line */}
        <div className="absolute left-[-16px] top-3 bottom-3 w-[1px] bg-[#212121]" />

        {ALL_STEPS.map((step, idx) => {
          let isCompleted = idx < activeIndex;
          let isActive = idx === activeIndex;
          let key = step.key;

          // Map approved/rejected key to the actual state
          if (key === "approved" && hasRejected) {
            key = "rejected";
          }

          const logEvent = stateEventMap.get(key);

          // Adjust details/styling for rejected step
          let stepLabel = step.label;
          if (isCompleted) {
            if (key === "rejected") {
              stepLabel = "Authorization Rejected";
            } else if (key === "approved") {
              stepLabel = "Maneuver Approved";
            }
          }

          return (
            <div key={step.key} className="relative flex items-start space-x-4">
              {/* Stepper Circle Indicator */}
              <div 
                className={cn(
                  "absolute left-[-20px] top-[6px] w-[10px] h-[10px] rounded-full border transition-all z-10",
                  isCompleted 
                    ? (key === "rejected" ? "bg-[#ff3355] border-transparent" : "bg-[#f3f3f3] border-transparent")
                    : isActive 
                      ? "bg-transparent border-[#f3f3f3] ring-2 ring-[#f3f3f3]/25 animate-pulse" 
                      : "bg-transparent border-[#212121]"
                )}
              />

              {/* Step Details */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className={cn("text-[13px] font-sans uppercase tracking-wider", 
                    isCompleted ? "text-[#f3f3f3]" : isActive ? "text-[#ffffff]" : "text-[#9c9c9c]"
                  )}>
                    {stepLabel}
                  </h4>
                  {logEvent && (
                    <span className="text-[10px] text-[#9c9c9c] font-mono">
                      {formatDate(logEvent.timestamp)}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-[#9c9c9c]/80 font-sans mt-0.5 leading-relaxed">
                  {step.description}
                </p>

                {/* Event specific metadata formatting */}
                {logEvent && (
                  <div className="mt-2 p-4 bg-[#080808] rounded-[8px] border border-[#212121] font-mono text-[11px] text-[#9c9c9c] space-y-2">
                    {/* Detected details */}
                    {logEvent.state === "detected" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[#9c9c9c] block uppercase tracking-wider">Miss Distance</span>
                          <span className="text-[#f3f3f3]">{logEvent.details.min_distance_km.toFixed(3)} km</span>
                        </div>
                        <div>
                          <span className="text-[#9c9c9c] block uppercase tracking-wider">Triage Risk Score</span>
                          <span className={cn("font-normal", logEvent.details.risk_score > 75 ? "text-[#ff3355]" : "text-[#ffb829]")}>
                            {logEvent.details.risk_score.toFixed(1)} / 100
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Explained details */}
                    {logEvent.state === "explained" && (
                      <div>
                        <div className="flex justify-between items-center text-[#9c9c9c] mb-1">
                          <span className="uppercase tracking-wider">AI Analysis Briefing</span>
                          <span className="border border-[#212121] px-1.5 py-0.5 rounded text-[9px] font-mono text-[#f3f3f3]">
                            {logEvent.details.source}
                          </span>
                        </div>
                        <p className="italic text-[#9c9c9c]/90 text-justify leading-relaxed">
                          "{logEvent.details.explanation_preview}"
                        </p>
                      </div>
                    )}

                    {/* Calculate details */}
                    {logEvent.state === "maneuvers_calculated" && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#9c9c9c] uppercase tracking-wider">Options Computed</span>
                        <span className="text-[#f3f3f3] font-mono">{logEvent.details.options_count} relative trajectories</span>
                      </div>
                    )}

                    {/* Tradeoff details */}
                    {logEvent.state === "tradeoff_ranked" && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[#9c9c9c] uppercase tracking-wider">Recommended Burn Scale</span>
                          <span className="text-[#f3f3f3] uppercase font-normal">{logEvent.details.recommended_option_id?.split('_').slice(-2).join(' ')}</span>
                        </div>
                        {logEvent.details.reasoning && (
                          <p className="text-[#9c9c9c]/80 border-t border-[#212121] pt-1 mt-1 leading-relaxed">
                            {logEvent.details.reasoning}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Visualized details */}
                    {logEvent.state === "visualized" && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#9c9c9c] uppercase tracking-wider">3D Orbit Render Window</span>
                        <span className="text-[#f3f3f3] font-mono">±{logEvent.details.window_hours / 2} hours centered on TCA</span>
                      </div>
                    )}

                    {/* Approved details */}
                    {logEvent.state === "approved" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[#9c9c9c] block uppercase tracking-wider">Authorized Burn</span>
                          <span className="text-[#98ff38] font-mono">
                            {logEvent.details.chosen_option_id?.split('_').slice(-2).join(' ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#9c9c9c] block uppercase tracking-wider">Cleared By</span>
                          <span className="text-[#f3f3f3]">
                            {logEvent.actor} ({logEvent.details.operator_role})
                          </span>
                        </div>
                        <div className="col-span-2 border-t border-[#212121] pt-2 flex justify-between">
                          <span>ΔV magnitude: <strong className="text-[#f3f3f3] font-normal">{logEvent.details.delta_v_ms?.toFixed(3)} m/s</strong></span>
                          <span>Propellant Cost: <strong className="text-[#f3f3f3] font-normal">{logEvent.details.fuel_cost_kg?.toFixed(2)} kg</strong></span>
                        </div>
                      </div>
                    )}

                    {/* Rejected details */}
                    {logEvent.state === "rejected" && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[#9c9c9c] uppercase tracking-wider">Rejection Operator</span>
                          <span className="text-[#ff3355] font-mono">{logEvent.actor} ({logEvent.details.operator_role})</span>
                        </div>
                        <p className="text-[#9c9c9c]/80 border-t border-[#212121] pt-1 mt-1 leading-relaxed">
                          <strong>Reason:</strong> {logEvent.details.reason}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
