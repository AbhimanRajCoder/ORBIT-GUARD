"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    pathMatch: (path: string) => path === "/dashboard",
  },
  {
    id: "conjunctions",
    label: "Conjunctions",
    href: "/conjunctions",
    pathMatch: (path: string) => path.startsWith("/conjunctions"),
  },
  {
    id: "maneuver",
    label: "Maneuver Planner",
    href: "/maneuvers",
    pathMatch: (path: string) => path.startsWith("/maneuvers"),
  },
  {
    id: "ai-briefing",
    label: "AI Briefing",
    href: "/ai-briefing",
    pathMatch: (path: string) => path.startsWith("/ai-briefing"),
  },
  {
    id: "map",
    label: "3D Live Map",
    href: "/map",
    pathMatch: (path: string) => path.startsWith("/map"),
  },
];

export function WorkflowPipeline() {
  const pathname = usePathname();

  // Find the index of the active step
  const activeIndex = STEPS.findIndex((step) => step.pathMatch(pathname));

  return (
    <div className="w-full bg-transparent border border-[#212121] rounded-[8px] p-4 mb-6 flex items-center justify-between overflow-x-auto gap-4 scrollbar-none">
      {STEPS.map((step, idx) => {
        const isActive = step.pathMatch(pathname);
        const isCompleted = idx < activeIndex;

        return (
          <React.Fragment key={step.id}>
            <Link
              href={step.href}
              className={cn(
                "flex items-center space-x-3 px-4 py-2 rounded-[8px] border transition-all shrink-0 cursor-pointer font-sans",
                isActive
                  ? "bg-[#080808] border-[#ffffff] text-[#f3f3f3]"
                  : isCompleted
                  ? "bg-[#080808]/40 border-[#212121] text-[#9c9c9c] hover:border-[#f3f3f3] hover:text-[#f3f3f3]"
                  : "bg-transparent border-[#212121]/50 text-[#9c9c9c] hover:text-[#f3f3f3] hover:border-[#f3f3f3]"
              )}
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-[#9c9c9c] uppercase tracking-wider leading-none">
                  Step 0{idx + 1}
                </span>
                <span className="text-[12px] uppercase mt-1.5 whitespace-nowrap">
                  {step.label}
                </span>
              </div>
            </Link>

            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-[1px] flex-1 min-w-[15px] max-w-[60px]",
                  idx < activeIndex ? "bg-[#ffffff]/40" : "bg-[#212121]"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
