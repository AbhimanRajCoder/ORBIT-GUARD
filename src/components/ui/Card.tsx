import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accentStatus?: "monitoring" | "caution" | "critical" | "cleared" | null;
}

export function Card({ className, accentStatus = null, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-transparent border border-[#212121] rounded-[8px] p-8 max-md:p-4 relative overflow-hidden transition-all duration-300 shadow-none",
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
    <div className={cn("flex flex-col space-y-1.5 mb-6", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-body-primary text-[20px] font-normal leading-tight tracking-tight text-[#f3f3f3]",
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
    <p className={cn("text-body-secondary text-[16px] leading-tight", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-body-secondary text-[16px] leading-relaxed", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center mt-6 pt-4 border-t border-[#212121]", className)} {...props}>
      {children}
    </div>
  );
}
