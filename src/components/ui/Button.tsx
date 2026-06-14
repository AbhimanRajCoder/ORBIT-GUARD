import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "destructive";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-display text-[12px] tracking-[0.10em] font-bold uppercase rounded-[4px] px-5 py-2.5 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-bone disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer",
          {
            // Primary Button: 1px Star White border, transparent fill, white text, inverts on hover
            "bg-transparent border border-bone text-bone hover:bg-bone hover:text-void":
              variant === "primary",
            // Ghost Button: 1px border, transparent fill, muted text, shifts to white
            "bg-transparent border border-iron text-ash hover:bg-bone hover:text-void hover:border-bone":
              variant === "ghost",
            // Destructive Button: 1px Collision Red border, transparent fill, red text
            "bg-transparent border border-collision-red text-collision-red hover:bg-collision-red hover:text-white":
              variant === "destructive",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
