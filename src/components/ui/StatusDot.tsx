import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: "monitoring" | "caution" | "critical" | "cleared";
  ping?: boolean;
}

export function StatusDot({
  className,
  status = "monitoring",
  ping = true,
  ...props
}: StatusDotProps) {
  return (
    <span className={cn("relative flex h-2.5 w-2.5", className)} {...props}>
      {ping && (
        <span
          className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            {
              "bg-[#ffb829]": status === "monitoring" || status === "caution",
              "bg-[#ff3355]": status === "critical",
              "bg-[#98ff38]": status === "cleared",
            }
          )}
        />
      )}
      <span
        className={cn("relative inline-flex rounded-full h-2.5 w-2.5", {
          "bg-[#ffb829]": status === "monitoring" || status === "caution",
          "bg-[#ff3355]": status === "critical",
          "bg-[#98ff38]": status === "cleared",
        })}
      />
    </span>
  );
}
