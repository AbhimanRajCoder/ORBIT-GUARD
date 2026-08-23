"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/ui/StatusDot";
import { useUI } from "@/lib/ui-context";

interface NavItem {
  name: string;
  shortLabel: string;
  href: string;
}

const navItems: NavItem[] = [
  { name: "Dashboard", shortLabel: "DB", href: "/dashboard" },
  { name: "Conjunctions", shortLabel: "CJ", href: "/conjunctions" },
  { name: "AI Briefing", shortLabel: "AI", href: "/ai-briefing" },
  { name: "Maneuvers", shortLabel: "MV", href: "/maneuvers" },
  { name: "3D Live Map", shortLabel: "MP", href: "/map" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarMinimized } = useUI();
  const [systemStatus, setSystemStatus] = React.useState<{ status: "nominal" | "critical"; activeAlerts: number }>({ status: "nominal", activeAlerts: 0 });

  React.useEffect(() => {
    async function checkSystemStatus() {
      try {
        const response = await fetch("/api/system-status");
        if (response.ok) {
          const data = await response.json();
          setSystemStatus({ status: data.status, activeAlerts: data.activeAlerts });
        }
      } catch (error) {
        console.error("Failed to fetch system status:", error);
      }
    }

    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const hasCriticalAlert = systemStatus.status === "critical";

  return (
    <aside className={cn(
      "bg-[#101010] border-r border-[#212121] flex flex-col h-screen fixed top-0 left-0 z-30 select-none transition-all duration-300 ease-in-out shadow-none",
      sidebarMinimized ? "w-[64px]" : "w-[240px]",
      "max-md:hidden"
    )}>
      {/* 1. Top Logo Block */}
      <div className={cn(
        "h-[56px] border-b border-[#212121] flex flex-col justify-center transition-all duration-300",
        sidebarMinimized ? "px-4 items-center" : "px-5"
      )}>
        <div className="flex items-center space-x-2">
          {sidebarMinimized ? (
            <span className="font-mono text-[14px] text-[#6f6759] font-normal uppercase tracking-wider">
              [OG]
            </span>
          ) : (
            <span className="font-sans text-[18px] font-normal tracking-tight text-[#f3f3f3] leading-none uppercase">
              OrbitGuard
            </span>
          )}
        </div>
        {!sidebarMinimized && (
          <span className="text-[10px] text-[#9c9c9c] uppercase tracking-wider leading-none mt-1">
            Maneuver Planning Simulator
          </span>
        )}
      </div>

      {/* 2. Navigation Links */}
      <nav className="flex-1 py-4 space-y-2 overflow-y-auto px-3">
        {navItems.map((item) => {
          const isActive =
             item.href === "/dashboard"
               ? pathname === "/dashboard"
               : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center rounded-[8px] transition-all duration-200 cursor-pointer border border-transparent font-sans",
                sidebarMinimized ? "justify-center p-2 h-10 w-10 mx-auto" : "justify-between px-3 py-2.5",
                isActive
                  ? "bg-[#080808] border-[#212121] text-[#f3f3f3]"
                  : "text-[#9c9c9c] hover:text-[#f3f3f3] hover:bg-[#080808]/50"
              )}
              title={sidebarMinimized ? item.name : undefined}
            >
              <div className="flex items-center space-x-3 w-full justify-center lg:justify-start">
                {sidebarMinimized ? (
                  <span className={cn("font-mono text-[13px] tracking-wider uppercase",
                    isActive ? "text-[#f3f3f3]" : "text-[#6f6759] group-hover:text-[#f3f3f3]"
                  )}>
                    {item.shortLabel}
                  </span>
                ) : (
                  <span className="text-[13px] tracking-wider uppercase">
                    {item.name}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* 3. Bottom System Status */}
      <div className={cn("border-t border-[#212121] bg-[#101010] transition-all duration-300", sidebarMinimized ? "p-2" : "p-4")}>
        <div className={cn(
          "flex items-center border border-[#212121] rounded-[8px] transition-all duration-300",
          sidebarMinimized ? "p-1.5 justify-center" : "p-2.5 space-x-3"
        )}>
          <StatusDot
            status={hasCriticalAlert ? "critical" : "cleared"}
            ping={true}
          />
          {!sidebarMinimized && (
            <div className="flex flex-col">
              <span className="text-[10px] text-[#9c9c9c] uppercase tracking-wider">
                System Health
              </span>
              <span
                className={cn("text-[11px] uppercase tracking-wide leading-none mt-0.5", {
                  "text-[#ff3355]": hasCriticalAlert,
                  "text-[#98ff38]": !hasCriticalAlert,
                })}
              >
                {hasCriticalAlert ? "Alert Active" : "Systems Nominal"}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
