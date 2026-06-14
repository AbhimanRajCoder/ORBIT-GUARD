import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "monitoring" | "caution" | "critical" | "cleared";
}

export function Badge({ className, variant = "monitoring", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[3px] px-2.5 py-1.25 font-display text-[11px] font-semibold uppercase tracking-[0.12em] select-none",
        {
          "bg-[rgba(0,200,224,0.10)] text-orbit-cyan": variant === "monitoring",
          "bg-[rgba(224,140,0,0.12)] text-threat-amber": variant === "caution",
          "bg-[rgba(200,0,42,0.12)] text-collision-red": variant === "critical",
          "bg-[rgba(0,184,122,0.10)] text-cleared-green": variant === "cleared",
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
