"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Satellite,
  LayoutDashboard,
  Radio,
  Zap,
  MessageSquare,
  Globe,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/ui/StatusDot";
import { useUI } from "@/lib/ui-context";

interface NavItem {
  name: string;
  labelOverride?: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  isComingSoon?: boolean;
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Conjunctions", href: "/conjunctions", icon: Radio },
  { name: "Maneuvers", href: "/maneuvers", icon: Zap },
  { name: "AI Briefing", href: "/ai-briefing", icon: MessageSquare },
  { name: "3D Live Map", href: "/map", icon: Globe },
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
      "bg-obsidian border-r border-iron/20 flex flex-col h-screen fixed top-0 left-0 z-30 select-none transition-all duration-300 ease-in-out",
      sidebarMinimized ? "w-[64px]" : "w-[240px]",
      "max-md:hidden"
    )}>
      {/* 1. Top Logo Block */}
      <div className={cn(
        "h-[56px] border-b border-iron/20 flex flex-col justify-center transition-all duration-300",
        sidebarMinimized ? "px-4 items-center" : "px-5"
      )}>
        <div className="flex items-center space-x-2">
          <Satellite className="h-5 w-5 text-orbit-cyan shrink-0" strokeWidth={1.5} />
          {!sidebarMinimized && (
            <span className="font-display text-[18px] font-light tracking-tight text-cloud leading-none">
              OrbitGuard
            </span>
          )}
        </div>
        {!sidebarMinimized && (
          <span className="font-data text-[8px] text-ash/60 uppercase tracking-[0.15em] leading-none mt-1">
            Maneuver Planning Simulator
          </span>
        )}
      </div>

      {/* 2. Navigation Links */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto px-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center rounded-[8px] border-l-4 border-l-transparent text-left transition-all duration-300 cursor-pointer",
                sidebarMinimized ? "justify-center px-1 py-2.5" : "justify-between px-3 py-2.5",
                isActive
                  ? "bg-graphite border-l-orbit-cyan text-orbit-cyan"
                  : "text-ash hover:text-bone hover:bg-steel/30 border-l-transparent"
              )}
              title={sidebarMinimized ? item.name : undefined}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={cn(
                    "h-4.5 w-4.5 transition-colors shrink-0",
                    isActive ? "text-orbit-cyan" : "text-ash group-hover:text-bone"
                  )}
                  strokeWidth={1.5}
                />
                {!sidebarMinimized && (
                  <span className="font-data text-[11px] tracking-[0.1em] uppercase">
                    {item.name}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* 3. Bottom System Status */}
      <div className={cn("border-t border-iron/20 bg-obsidian transition-all duration-300", sidebarMinimized ? "p-2" : "p-4")}>
        <div className={cn(
          "flex items-center bg-abyss/40 border border-iron/20 rounded-[8px] transition-all duration-300",
          sidebarMinimized ? "p-1.5 justify-center" : "p-2.5 space-x-3"
        )}>
          <StatusDot
            status={hasCriticalAlert ? "critical" : "cleared"}
            ping={true}
          />
          {!sidebarMinimized && (
            <div className="flex flex-col">
              <span className="font-data text-[10px] text-ash/80 uppercase tracking-[0.1em]">
                System Health
              </span>
              <span
                className={cn("font-data text-[10px] uppercase tracking-wide leading-none mt-0.5", {
                  "text-collision-red font-semibold": hasCriticalAlert,
                  "text-cleared-green": !hasCriticalAlert,
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
