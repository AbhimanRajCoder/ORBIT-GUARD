"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AlertBanner() {
  const [criticalCount, setCriticalCount] = React.useState(0);
  const [dismissed, setDismissed] = React.useState(true); // Default true until mounted to avoid hydration mismatch

  React.useEffect(() => {
    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem("orbitguard_alert_dismissed") === "true";
    setDismissed(isDismissed);

    if (!isDismissed) {
      // Fetch conjunction events to count critical ones
      fetch("/api/conjunction-events")
        .then((res) => res.json())
        .then((events) => {
          if (Array.isArray(events)) {
            const count = events.filter(
              (e) => e.status === "active" && e.riskLevel === "red"
            ).length;
            setCriticalCount(count);
          }
        })
        .catch(console.error);
    }
  }, []);

  if (dismissed || criticalCount === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("orbitguard_alert_dismissed", "true");
  };

  return (
    <div className="bg-collision-red/10 border-b border-collision-red/30 px-6 py-2.5 flex items-center justify-between animate-in slide-in-from-top-2 relative overflow-hidden">
      {/* Pulsing left border effect */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-collision-red animate-pulse" />
      
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-collision-red" strokeWidth={2} />
        <p className="font-display text-[12px] text-bone tracking-wide">
          <span className="font-bold text-collision-red uppercase mr-1">⚠ Critical:</span>
          {criticalCount} active conjunction event{criticalCount > 1 ? "s" : ""} require immediate attention.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/conjunctions"
          className="flex items-center gap-1 font-display text-[11px] font-bold text-collision-red uppercase tracking-wider hover:text-bone transition-colors"
        >
          View Events
          <ArrowRight className="h-3 w-3" />
        </Link>
        <div className="w-px h-4 bg-collision-red/30" />
        <button
          onClick={handleDismiss}
          className="text-collision-red hover:text-bone transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
