"use client";

import React from "react";
import { ConjunctionEvent } from "@/types";
import { 
  CheckCircle2, 
  HelpCircle, 
  Settings, 
  Zap, 
  ShieldCheck, 
  ShieldAlert,
  Clock,
  User,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LifecycleTimelineProps {
  event: ConjunctionEvent;
}

interface StepItem {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
}

const ALL_STEPS: StepItem[] = [
  {
    key: "detected",
    label: "Threat Detected",
    description: "Coarse & fine screening finished. Orbital hazard identified.",
    icon: Activity,
  },
  {
    key: "explained",
    label: "AI Briefing Generated",
    description: "LLM risk summary and situational context established.",
    icon: HelpCircle,
  },
  {
    key: "maneuvers_calculated",
    label: "Dodging Maneuvers Computed",
    description: "Clohessy-Wiltshire relative burn vectors calculated.",
    icon: Settings,
  },
  {
    key: "tradeoff_ranked",
    label: "Trade-off Assessment Ranked",
    description: "Optimal evasive maneuver evaluated against secondary risks.",
    icon: Zap,
  },
  {
    key: "approved", // can be approved or rejected
    label: "Authorization Resolution",
    description: "Operator review completed. Uplink authorization decision logged.",
    icon: ShieldCheck,
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
    <div className="bg-[#0b101f]/75 border border-[#1b2a47] rounded-[8px] p-5 space-y-4">
      <div className="flex items-center space-x-2 border-b border-white/5 pb-2.5">
        <Clock className="h-4 w-4 text-orbit-cyan" />
        <span className="text-[11px] font-display font-bold text-ash uppercase tracking-wider">
          Verifiable Conjunction Lifecycle
        </span>
      </div>

      <div className="relative pl-6 space-y-6">
        {/* Timeline Connecting Vertical Line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-[1px] bg-iron/20" />

        {ALL_STEPS.map((step, idx) => {
          let isCompleted = idx < activeIndex;
          let isActive = idx === activeIndex;
          let key = step.key;

          // Map approved/rejected key to the actual state
          if (key === "approved" && hasRejected) {
            key = "rejected";
          }

          const logEvent = stateEventMap.get(key);
          const Icon = step.icon;

          // Adjust details/styling for rejected step
          let stepLabel = step.label;
          let StepIcon = Icon;
          let iconColor = "text-[#8a99ad]";
          let circleBg = "bg-[#090f1e] border-iron/30";

          if (isCompleted) {
            if (key === "rejected") {
              stepLabel = "Authorization Rejected";
              StepIcon = ShieldAlert;
              iconColor = "text-[#ff4444]";
              circleBg = "bg-[#ff4444]/10 border-[#ff4444]/40";
            } else {
              if (key === "approved") {
                stepLabel = "Maneuver Approved";
              }
              StepIcon = CheckCircle2;
              iconColor = "text-cleared-green";
              circleBg = "bg-cleared-green/10 border-cleared-green/45";
            }
          } else if (isActive) {
            iconColor = "text-orbit-cyan animate-pulse";
            circleBg = "bg-orbit-cyan/15 border-orbit-cyan/60 ring-2 ring-orbit-cyan/20";
          }

          return (
            <div key={step.key} className="relative flex items-start space-x-4">
              {/* Stepper Circle Icon */}
              <div 
                className={cn(
                  "absolute left-[-26px] top-0.5 w-[22px] h-[22px] rounded-full border flex items-center justify-center z-10 transition-all",
                  circleBg
                )}
              >
                <StepIcon className={cn("h-3.5 w-3.5", iconColor)} strokeWidth={2} />
              </div>

              {/* Step Details */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className={cn("text-[13px] font-display font-semibold", 
                    isCompleted ? "text-bone" : isActive ? "text-orbit-cyan" : "text-ash"
                  )}>
                    {stepLabel}
                  </h4>
                  {logEvent && (
                    <span className="text-[10px] text-graphite font-mono">
                      {formatDate(logEvent.timestamp)}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-ash/80 font-sans mt-0.5 leading-relaxed">
                  {step.description}
                </p>

                {/* Event specific metadata formatting */}
                {logEvent && (
                  <div className="mt-2 p-2 bg-[#060a14] rounded border border-white/5 font-data text-[10px] text-cloud space-y-1.5 animate-slide-in">
                    {/* Detected details */}
                    {logEvent.state === "detected" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-ash block uppercase font-bold tracking-wider">Miss Distance</span>
                          <span className="text-bone">{logEvent.details.min_distance_km.toFixed(3)} km</span>
                        </div>
                        <div>
                          <span className="text-ash block uppercase font-bold tracking-wider">Triage Risk Score</span>
                          <span className={cn("font-bold", logEvent.details.risk_score > 75 ? "text-collision-red" : "text-threat-amber")}>
                            {logEvent.details.risk_score.toFixed(1)} / 100
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Explained details */}
                    {logEvent.state === "explained" && (
                      <div>
                        <div className="flex justify-between items-center text-ash mb-1">
                          <span className="uppercase font-bold tracking-wider">AI Analysis Briefing</span>
                          <span className="bg-orbit-cyan/15 text-orbit-cyan px-1.5 py-0.2 rounded text-[9px] font-mono">
                            {logEvent.details.source}
                          </span>
                        </div>
                        <p className="italic text-ash/90 text-justify leading-relaxed">
                          "{logEvent.details.explanation_preview}"
                        </p>
                      </div>
                    )}

                    {/* Calculate details */}
                    {logEvent.state === "maneuvers_calculated" && (
                      <div className="flex items-center justify-between">
                        <span className="text-ash uppercase font-bold tracking-wider">Options Computed</span>
                        <span className="text-bone font-mono">{logEvent.details.options_count} relative trajectories</span>
                      </div>
                    )}

                    {/* Tradeoff details */}
                    {logEvent.state === "tradeoff_ranked" && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-ash uppercase font-bold tracking-wider">Recommended Burn Scale</span>
                          <span className="text-orbit-cyan font-bold uppercase">{logEvent.details.recommended_option_id?.split('_').slice(-2).join(' ')}</span>
                        </div>
                        {logEvent.details.reasoning && (
                          <p className="text-ash/80 border-t border-white/5 pt-1 mt-1 leading-relaxed">
                            {logEvent.details.reasoning}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Visualized details */}
                    {logEvent.state === "visualized" && (
                      <div className="flex items-center justify-between">
                        <span className="text-ash uppercase font-bold tracking-wider">3D Orbit Render Window</span>
                        <span className="text-bone font-mono">±{logEvent.details.window_hours / 2} hours centered on TCA</span>
                      </div>
                    )}

                    {/* Approved details */}
                    {logEvent.state === "approved" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-ash block uppercase font-bold tracking-wider">Authorized Burn</span>
                          <span className="text-cleared-green uppercase font-bold font-mono">
                            {logEvent.details.chosen_option_id?.split('_').slice(-2).join(' ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-ash block uppercase font-bold tracking-wider">Cleared By</span>
                          <span className="text-bone flex items-center space-x-1">
                            <User className="h-3 w-3 text-ash inline" />
                            <span>{logEvent.actor} ({logEvent.details.operator_role})</span>
                          </span>
                        </div>
                        <div className="col-span-2 border-t border-white/5 pt-1 flex justify-between">
                          <span>ΔV magnitude: <strong className="text-bone">{logEvent.details.delta_v_ms?.toFixed(3)} m/s</strong></span>
                          <span>Propellant Cost: <strong className="text-bone">{logEvent.details.fuel_cost_kg?.toFixed(2)} kg</strong></span>
                        </div>
                      </div>
                    )}

                    {/* Rejected details */}
                    {logEvent.state === "rejected" && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-ash uppercase font-bold tracking-wider">Rejection Operator</span>
                          <span className="text-[#ff4444] font-bold font-mono">{logEvent.actor} ({logEvent.details.operator_role})</span>
                        </div>
                        <p className="text-ash/80 border-t border-white/5 pt-1 mt-1 leading-relaxed">
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
