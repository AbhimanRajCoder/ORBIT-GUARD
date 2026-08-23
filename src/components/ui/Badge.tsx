import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "monitoring" | "caution" | "critical" | "cleared" | "safe" | "monitor" | "action-required";
}

export function Badge({ className, variant = "monitoring", children, ...props }: BadgeProps) {
  let dotColor = "bg-[#98ff38]"; // safe/cleared green dot
  if (variant === "caution" || variant === "monitoring" || variant === "monitor") {
    dotColor = "bg-[#ffb829]"; // amber dot
  } else if (variant === "critical" || variant === "action-required") {
    dotColor = "bg-[#ff3355]"; // red dot
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] border border-[#212121] bg-[#1a1a1a] px-2.5 py-1 text-[13px] font-mono uppercase tracking-wider text-[#f3f3f3] select-none",
        className
      )}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)} />
      {children}
    </span>
  );
}
