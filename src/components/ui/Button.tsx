import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "destructive";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "ghost", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-200 focus:outline-none disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer text-body-primary font-normal",
          {
            // Primary Button: filled white pill (9999px radius), text color canvas (#101010)
            "bg-[#ffffff] text-[#101010] rounded-[9999px] px-6 py-2.5 hover:bg-[#ffffff]/90 border border-transparent":
              variant === "primary",
            // Ghost outline: transparent fill, 1px white border, 8px radius
            "bg-transparent border border-[#ffffff] text-[#ffffff] rounded-[8px] px-5 py-2.5 hover:bg-[#ffffff]/10":
              variant === "ghost",
            // Destructive: ghost outline with red border, 8px radius
            "bg-transparent border border-[#ff3355] text-[#ff3355] rounded-[8px] px-5 py-2.5 hover:bg-[#ff3355]/10":
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
