"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Radio, Zap, MessageSquare, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    pathMatch: (path: string) => path === "/dashboard",
  },
  {
    id: "conjunctions",
    label: "Conjunctions",
    icon: Radio,
    href: "/conjunctions",
    pathMatch: (path: string) => path.startsWith("/conjunctions"),
  },
  {
    id: "maneuver",
    label: "Maneuver Planner",
    icon: Zap,
    href: "/maneuvers",
    pathMatch: (path: string) => path.startsWith("/maneuvers"),
  },
  {
    id: "ai-briefing",
    label: "AI Briefing",
    icon: MessageSquare,
    href: "/ai-briefing",
    pathMatch: (path: string) => path.startsWith("/ai-briefing"),
  },
  {
    id: "map",
    label: "3D Live Map",
    icon: Globe,
    href: "/map",
    pathMatch: (path: string) => path.startsWith("/map"),
  },
];

export function WorkflowPipeline() {
  const pathname = usePathname();

  // Find the index of the active step
  const activeIndex = STEPS.findIndex((step) => step.pathMatch(pathname));

  return (
    <div className="w-full bg-[#0d1527]/85 backdrop-blur-md border border-[#1b2a47] rounded-[6px] p-3 mb-6 flex items-center justify-between overflow-x-auto gap-4 scrollbar-none">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isActive = step.pathMatch(pathname);
        const isCompleted = idx < activeIndex;

        return (
          <React.Fragment key={step.id}>
            <Link
              href={step.href}
              className={cn(
                "flex items-center space-x-2.5 px-3 py-1.5 rounded-[4px] border border-transparent transition-all shrink-0 cursor-pointer",
                isActive
                  ? "bg-orbit-cyan/15 border-orbit-cyan/45 text-orbit-cyan"
                  : isCompleted
                  ? "text-orbit-cyan/70 hover:text-orbit-cyan"
                  : "text-ash hover:text-bone hover:bg-iron/10"
              )}
            >
              <div className="p-1 rounded bg-[#0a0f1d] border border-iron/40">
                <Icon className={cn("h-4 w-4", isActive && "animate-pulse")} strokeWidth={1.5} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-data text-ash font-bold uppercase tracking-wider leading-none">
                  Step 0{idx + 1}
                </span>
                <span className="text-[12px] font-display font-medium tracking-wide mt-1 whitespace-nowrap">
                  {step.label}
                </span>
              </div>
            </Link>

            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-[1px] flex-1 min-w-[15px] max-w-[60px]",
                  idx < activeIndex ? "bg-orbit-cyan/50" : "bg-iron/30"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
