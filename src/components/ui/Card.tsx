import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accentStatus?: "monitoring" | "caution" | "critical" | "cleared" | null;
}

export function Card({ className, accentStatus = null, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-abyss border border-iron rounded-md p-4 relative overflow-hidden",
        {
          "border-l-[3px] border-l-orbit-cyan": accentStatus === "monitoring",
          "border-l-[3px] border-l-threat-amber": accentStatus === "caution",
          "border-l-[3px] border-l-collision-red": accentStatus === "critical",
          "border-l-[3px] border-l-cleared-green": accentStatus === "cleared",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col space-y-1 mb-3", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-[15px] font-semibold text-bone tracking-wide uppercase",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("font-body text-[12px] text-ash", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("font-body text-[14px] text-bone", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center mt-4 pt-3 border-t border-iron", className)} {...props}>
      {children}
    </div>
  );
}
