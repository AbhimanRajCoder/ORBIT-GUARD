"use client";

import * as React from "react";
import Link from "next/link";
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
    <div className="bg-[#ff3355]/10 border-b border-[#ff3355]/30 px-6 py-2.5 flex items-center justify-between animate-in slide-in-from-top-2 relative overflow-hidden">
      {/* Pulsing left border effect */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff3355] animate-pulse" />
      
      <div className="flex items-center gap-3">
        <p className="font-sans text-[13px] text-[#f3f3f3] tracking-wide">
          <span className="text-[#ff3355] uppercase mr-1.5 font-mono font-normal">CRITICAL:</span>
          {criticalCount} active conjunction event{criticalCount > 1 ? "s" : ""} require immediate attention.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/conjunctions"
          className="font-mono text-[11px] text-[#ff3355] uppercase tracking-wider hover:text-white transition-colors"
        >
          [VIEW EVENTS]
        </Link>
        <div className="w-px h-4 bg-[#ff3355]/30" />
        <button
          onClick={handleDismiss}
          className="text-[#ff3355] hover:text-white transition-colors font-mono text-[11px] uppercase cursor-pointer"
          aria-label="Dismiss alert"
        >
          [DISMISS]
        </button>
      </div>
    </div>
  );
}
