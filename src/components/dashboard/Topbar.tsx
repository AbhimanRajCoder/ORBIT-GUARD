"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, Clock, Satellite as SatIcon, AlertTriangle, ScrollText, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUI } from "@/lib/ui-context";

// Route path to Title mapping helper
function getPageTitle(pathname: string): string {
  if (pathname === "/") return "OrbitGuard Simulator";
  if (pathname.startsWith("/dashboard")) return "Operational Dashboard";
  if (pathname.startsWith("/conjunctions")) return "Conjunction Dashboard";
  if (pathname.startsWith("/maneuvers")) return "Orbital Maneuver Queue";
  if (pathname.startsWith("/ai-briefing")) return "AI Situation Briefing";
  if (pathname.startsWith("/map")) return "3D Orbit Map";
  return "Space Traffic Control";
}

interface FlatItem {
  id: string;
  type: "satellite" | "event" | "log";
  title: string;
  subtitle: string;
  href: string;
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarMinimized, toggleSidebar } = useUI();
  const [utcTime, setUtcTime] = React.useState<string>("");
  const [criticalCount, setCriticalCount] = React.useState<number>(0);
  const [syncing, setSyncing] = React.useState(false);

  // Search states
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<{
    satellites: any[];
    events: any[];
    logs: any[];
  }>({ satellites: [], events: [], logs: [] });
  const [loading, setLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const searchRef = React.useRef<HTMLDivElement>(null);

  // 1. Live UTC Clock
  React.useEffect(() => {
    function updateClock() {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toISOString().slice(11, 19);
      setUtcTime(`${dateStr} ${timeStr} UTC`);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Active Critical Conjunction Events
  React.useEffect(() => {
    async function fetchCriticalCount() {
      try {
        const response = await fetch("/api/conjunction-events");
        if (response.ok) {
          const events = await response.json();
          if (Array.isArray(events)) {
            const count = events.filter(
              (event) => event.status === "active" && event.riskLevel === "red"
            ).length;
            setCriticalCount(count);
          }
        }
      } catch (error) {
        console.error("Failed to fetch conjunction count in Topbar:", error);
      }
    }

    fetchCriticalCount();
    const interval = setInterval(fetchCriticalCount, 15000);
    return () => clearInterval(interval);
  }, []);

  // 3. Debounced Search API fetch
  React.useEffect(() => {
    if (!query.trim()) {
      setResults({ satellites: [], events: [], logs: [] });
      setIsOpen(false);
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setIsOpen(true);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error("Search lookup failed:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  // Click outside listener
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Create flat indexed items mapping for arrow key navigations
  const flatItems = React.useMemo(() => {
    const items: FlatItem[] = [];
    results.satellites.forEach((sat) => {
      items.push({
        id: sat.id,
        type: "satellite",
        title: sat.name,
        subtitle: `Owner: ${sat.owner} | NORAD: ${sat.noradId}`,
        href: `/dashboard?sat=${sat.id}`,
      });
    });
    results.events.forEach((event) => {
      items.push({
        id: event.id,
        type: "event",
        title: `${event.id}: Conjunction Alert`,
        subtitle: `vs ${event.secondaryName} (Prob: ${event.pcDisplay})`,
        href: `/maneuvers?event=${event.id}`,
      });
    });
    results.logs.forEach((log) => {
      items.push({
        id: log.id,
        type: "log",
        title: `${log.id}: Command Log`,
        subtitle: log.outcome,
        href: `/dashboard`, // redirects to main dashboard
      });
    });
    return items;
  }, [results]);

  const handleItemClick = (item: FlatItem) => {
    router.push(item.href);
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || flatItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flatItems.length) {
        handleItemClick(flatItems[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <header className={cn(
      "h-[56px] bg-obsidian/85 backdrop-blur-md border-b border-iron/25 flex items-center justify-between px-6 max-md:px-3 fixed top-0 right-0 z-20 select-none transition-all duration-300 ease-in-out",
      sidebarMinimized ? "left-[64px]" : "left-[240px]",
      "max-md:left-0"
    )}>
      {/* Left Title + Toggle Button */}
      <div className="flex items-center space-x-3">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-[4px] border border-iron text-ash hover:text-bone hover:bg-iron/30 transition-colors focus:outline-none cursor-pointer flex items-center justify-center shrink-0"
          title={sidebarMinimized ? "Expand Sidebar" : "Minimize Sidebar"}
        >
          {sidebarMinimized ? (
            <ChevronRight className="h-3.5 w-3.5 text-orbit-cyan" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5 text-orbit-cyan" />
          )}
        </button>
        <h1 className="font-display text-[18px] font-light text-cloud tracking-tight leading-none">
          {getPageTitle(pathname)}
        </h1>
      </div>

      {/* Center Search Bar */}
      <div ref={searchRef} className="hidden md:flex items-center justify-center flex-1 max-w-md mx-8 relative">
        <div className="relative w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-graphite"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query.trim() && flatItems.length > 0) setIsOpen(true);
            }}
            placeholder="Search satellites, threat IDs, events..."
            className="w-full bg-abyss/60 border border-iron/30 rounded-[8px] pl-9 pr-4 py-1.5 font-body text-[12px] text-bone placeholder-fog focus:outline-none focus:border-pure transition-colors"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="h-3 w-3 border-2 border-orbit-cyan border-t-transparent rounded-full animate-spin block" />
            </div>
          )}
          {!loading && !query && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <kbd className="font-data text-[9px] text-graphite bg-iron/40 border border-iron rounded-[3px] px-1.5 py-0.5 tracking-wider">
                ⌘K
              </kbd>
            </div>
          )}
        </div>

        {/* Dropdown Results List Panel */}
        {isOpen && flatItems.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-graphite border border-iron/30 shadow-2xl rounded-[8px] mt-1.5 overflow-hidden z-50 max-h-[360px] overflow-y-auto divide-y divide-iron/20">
            
            {/* Category: Satellites */}
            {results.satellites.length > 0 && (
              <div>
                <div className="flex items-center space-x-1.5 text-[9px] text-orbit-cyan font-bold uppercase tracking-wider px-3.5 py-1.5 bg-abyss/90 border-b border-iron/20">
                  <SatIcon className="h-3 w-3" strokeWidth={2} />
                  <span>Fleet Assets</span>
                </div>
                {results.satellites.map((sat) => {
                  const flatIndex = flatItems.findIndex((item) => item.id === sat.id);
                  const isFocused = flatIndex === selectedIndex;
                  return (
                    <div
                      key={sat.id}
                      onClick={() => handleItemClick(flatItems[flatIndex])}
                      className={cn(
                        "px-3.5 py-2.5 cursor-pointer flex flex-col transition-colors border-l-2 border-transparent",
                        isFocused ? "bg-iron/50 border-orbit-cyan" : "hover:bg-iron/25"
                      )}
                    >
                      <span className="text-[12px] text-bone font-medium font-data">{sat.name}</span>
                      <span className="text-[10px] text-ash truncate mt-0.5 font-body">
                        Owner: {sat.owner} | NORAD: {sat.noradId} | Risk: <span className={cn({
                          "text-cleared-green": sat.riskLevel === "green",
                          "text-threat-amber": sat.riskLevel === "yellow",
                          "text-collision-red": sat.riskLevel === "red",
                        })}>{sat.riskLevel.toUpperCase()}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Category: Conjunction Events */}
            {results.events.length > 0 && (
              <div>
                <div className="flex items-center space-x-1.5 text-[9px] text-threat-amber font-bold uppercase tracking-wider px-3.5 py-1.5 bg-abyss/90 border-b border-iron/20">
                  <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                  <span>Conjunction Events</span>
                </div>
                {results.events.map((event) => {
                  const flatIndex = flatItems.findIndex((item) => item.id === event.id);
                  const isFocused = flatIndex === selectedIndex;
                  return (
                    <div
                      key={event.id}
                      onClick={() => handleItemClick(flatItems[flatIndex])}
                      className={cn(
                        "px-3.5 py-2.5 cursor-pointer flex flex-col transition-colors border-l-2 border-transparent",
                        isFocused ? "bg-iron/50 border-orbit-cyan" : "hover:bg-iron/25"
                      )}
                    >
                      <span className="text-[12px] text-bone font-medium font-data">{event.id}</span>
                      <span className="text-[10px] text-ash truncate mt-0.5 font-body">
                        vs {event.secondaryName} | Prob: {event.pcDisplay}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Category: Incident Logs */}
            {results.logs.length > 0 && (
              <div>
                <div className="flex items-center space-x-1.5 text-[9px] text-ash font-bold uppercase tracking-wider px-3.5 py-1.5 bg-abyss/90 border-b border-iron/20">
                  <ScrollText className="h-3 w-3" strokeWidth={2} />
                  <span>Incident Log Entries</span>
                </div>
                {results.logs.map((log) => {
                  const flatIndex = flatItems.findIndex((item) => item.id === log.id);
                  const isFocused = flatIndex === selectedIndex;
                  return (
                    <div
                      key={log.id}
                      onClick={() => handleItemClick(flatItems[flatIndex])}
                      className={cn(
                        "px-3.5 py-2.5 cursor-pointer flex flex-col transition-colors border-l-2 border-transparent",
                        isFocused ? "bg-iron/50 border-orbit-cyan" : "hover:bg-iron/25"
                      )}
                    >
                      <span className="text-[12px] text-bone font-medium font-data">{log.id}: {log.action}</span>
                      <span className="text-[10px] text-ash truncate mt-0.5 font-body">
                        {log.outcome}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isOpen && flatItems.length === 0 && query.trim() && !loading && (
          <div className="absolute top-full left-0 right-0 bg-void border border-iron shadow-2xl rounded-[4px] mt-1.5 p-4 text-center z-50 text-[11px] text-ash uppercase font-semibold">
            No matching entries found
          </div>
        )}
      </div>

      {/* Right Side Control Telemetry */}
      <div className="flex items-center space-x-6">
        {/* CelesTrak Sync & Provenance */}
        <button
          onClick={async () => {
            if (syncing) return;
            setSyncing(true);
            try {
              const res = await fetch("/api/celestrak/sync", { method: "POST" });
              if (res.ok) {
                router.refresh();
              }
            } catch (error) {
              console.error("CelesTrak Sync failed:", error);
            } finally {
              setSyncing(false);
            }
          }}
          disabled={syncing}
          className={cn(
            "flex items-center space-x-2 bg-abyss/40 border border-iron/20 rounded-[8px] px-3 py-1 cursor-pointer hover:bg-steel/30 transition-all text-ash hover:text-orbit-cyan",
            syncing && "opacity-75 cursor-not-allowed text-orbit-cyan"
          )}
          title="Sync live orbital data from CelesTrak"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} strokeWidth={1.5} />
          <span className="font-data text-[11px] tracking-wider uppercase hidden lg:inline">
            {syncing ? "Syncing..." : "CelesTrak Sync"}
          </span>
        </button>

        {/* Live UTC Clock */}
        <div className="flex items-center space-x-2 bg-abyss/40 border border-iron/20 rounded-[8px] px-3 py-1">
          <Clock className="h-3.5 w-3.5 text-orbit-cyan" strokeWidth={1.5} />
          <span className="font-data text-[12px] text-bone tracking-wider">
            {utcTime || "LOADING UTC..."}
          </span>
        </div>

        {/* Notification Bell Badge */}
        <button className="relative p-1.5 text-ash hover:text-bone hover:bg-steel/30 rounded-[8px] transition-all focus:outline-none cursor-pointer">
          <Bell className="h-4 w-4" strokeWidth={1.5} />
          {criticalCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-collision-red text-[9px] font-bold text-white leading-none">
              {criticalCount}
            </span>
          )}
        </button>

        {/* User Avatar Circle */}
        <div className="flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-full bg-orbit-cyan/15 border border-orbit-cyan/40 flex items-center justify-center font-display text-[11px] font-bold text-orbit-cyan">
            OP
          </div>
        </div>
      </div>
    </header>
  );
}
