"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
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
      "h-[56px] bg-[#101010]/85 backdrop-blur-md border-b border-[#212121] flex items-center justify-between px-6 max-md:px-3 fixed top-0 right-0 z-20 select-none transition-all duration-300 ease-in-out",
      sidebarMinimized ? "left-[64px]" : "left-[240px]",
      "max-md:left-0"
    )}>
      {/* Left Title + Toggle Button */}
      <div className="flex items-center space-x-3">
        <button
          onClick={toggleSidebar}
          className="px-2 py-1 rounded-[8px] border border-[#212121] text-[#9c9c9c] hover:text-[#f3f3f3] hover:bg-[#080808] transition-colors focus:outline-none cursor-pointer flex items-center justify-center shrink-0 font-mono text-[11px]"
          title={sidebarMinimized ? "Expand Sidebar" : "Minimize Sidebar"}
        >
          {sidebarMinimized ? ">>" : "<<"}
        </button>
        <h1 className="font-sans text-[18px] font-normal text-[#f3f3f3] uppercase tracking-wider leading-none">
          {getPageTitle(pathname)}
        </h1>
      </div>

      {/* Center Search Bar */}
      <div ref={searchRef} className="hidden md:flex items-center justify-center flex-1 max-w-md mx-8 relative">
        <div className="relative w-full">
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
            className="w-full bg-[#080808] border border-[#212121] rounded-[8px] pl-3 pr-4 py-1.5 font-mono text-[12px] text-[#f3f3f3] placeholder-[#9c9c9c]/55 focus:outline-none focus:border-[#f3f3f3] transition-colors"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="h-3 w-3 border-2 border-[#f3f3f3] border-t-transparent rounded-full animate-spin block" />
            </div>
          )}
          {!loading && !query && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <kbd className="font-mono text-[9px] text-[#9c9c9c] bg-[#101010] border border-[#212121] rounded-[3px] px-1.5 py-0.5 tracking-wider">
                ⌘K
              </kbd>
            </div>
          )}
        </div>

        {/* Dropdown Results List Panel */}
        {isOpen && flatItems.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-[#080808] border border-[#212121] rounded-[8px] mt-1.5 overflow-hidden z-50 max-h-[360px] overflow-y-auto divide-y divide-[#212121]">
            
            {/* Category: Satellites */}
            {results.satellites.length > 0 && (
              <div>
                <div className="text-[10px] text-[#9c9c9c] font-normal uppercase tracking-wider px-3.5 py-1.5 bg-[#101010] border-b border-[#212121] font-sans">
                  Fleet Assets
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
                        isFocused ? "bg-[#101010] border-[#ffffff]" : "hover:bg-[#101010]/50"
                      )}
                    >
                      <span className="text-[12px] text-[#f3f3f3] font-mono">{sat.name}</span>
                      <span className="text-[10px] text-[#9c9c9c] truncate mt-0.5 font-mono">
                        Owner: {sat.owner} | NORAD: {sat.noradId} | Risk: <span className={cn({
                          "text-[#98ff38]": sat.riskLevel === "green",
                          "text-[#ffb829]": sat.riskLevel === "yellow",
                          "text-[#ff3355]": sat.riskLevel === "red",
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
                <div className="text-[10px] text-[#9c9c9c] font-normal uppercase tracking-wider px-3.5 py-1.5 bg-[#101010] border-b border-[#212121] font-sans">
                  Conjunction Events
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
                        isFocused ? "bg-[#101010] border-[#ffffff]" : "hover:bg-[#101010]/50"
                      )}
                    >
                      <span className="text-[12px] text-[#f3f3f3] font-mono">{event.id}</span>
                      <span className="text-[10px] text-[#9c9c9c] truncate mt-0.5 font-mono">
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
                <div className="text-[10px] text-[#9c9c9c] font-normal uppercase tracking-wider px-3.5 py-1.5 bg-[#101010] border-b border-[#212121] font-sans">
                  Incident Log Entries
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
                        isFocused ? "bg-[#101010] border-[#ffffff]" : "hover:bg-[#101010]/50"
                      )}
                    >
                      <span className="text-[12px] text-[#f3f3f3] font-mono">{log.id}: {log.action}</span>
                      <span className="text-[10px] text-[#9c9c9c] truncate mt-0.5 font-mono">
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
          <div className="absolute top-full left-0 right-0 bg-[#080808] border border-[#212121] rounded-[8px] mt-1.5 p-4 text-center z-50 text-[11px] text-[#9c9c9c] uppercase font-mono">
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
            "flex items-center space-x-2 bg-transparent border border-[#212121] rounded-[8px] px-3 py-1.5 cursor-pointer hover:bg-[#080808] transition-all text-[#9c9c9c] hover:text-[#f3f3f3]",
            syncing && "opacity-75 cursor-not-allowed text-[#9c9c9c]"
          )}
          title="Sync live orbital data from CelesTrak"
        >
          <span className="font-mono text-[11px] tracking-wider uppercase">
            {syncing ? "SYNCING..." : "SYNC"}
          </span>
        </button>

        {/* Live UTC Clock */}
        <div className="flex items-center space-x-2 bg-transparent border border-[#212121] rounded-[8px] px-3 py-1.5">
          <span className="font-mono text-[12px] text-[#f3f3f3] tracking-wider">
            UTC: {utcTime ? utcTime.replace(" UTC", "") : "LOADING..."}
          </span>
        </div>

        {/* Notification Bell Badge replacement */}
        <button className="px-3 py-1.5 text-[#9c9c9c] hover:text-[#f3f3f3] hover:bg-[#080808] rounded-[8px] transition-all focus:outline-none cursor-pointer border border-[#212121] bg-transparent font-mono text-[11px] uppercase tracking-wider shrink-0">
          ALERTS ({criticalCount})
        </button>

        {/* User Avatar Circle */}
        <div className="flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-full bg-transparent border border-[#212121] flex items-center justify-center font-mono text-[11px] text-[#f3f3f3] uppercase">
            OP
          </div>
        </div>
      </div>
    </header>
  );
}
