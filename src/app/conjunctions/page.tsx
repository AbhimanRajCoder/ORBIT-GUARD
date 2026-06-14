"use client";

import * as React from "react";
import Link from "next/link";
import { useOrbitStream } from "@/lib/hooks/useOrbitStream";
import { ConjunctionEvent, RiskLevel } from "@/types";
import { 
  ArrowUpDown, 
  Filter, 
  Search, 
  Zap, 
  Radio, 
  AlertTriangle,
  CheckCircle,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";

type SortField = "primaryName" | "secondaryName" | "tca" | "missDistance" | "pc" | "riskLevel";
type SortOrder = "asc" | "desc";

export default function ConjunctionsPage() {
  const { conjunctionEvents, satellites } = useOrbitStream();
  const [filterRisk, setFilterRisk] = React.useState<"all" | RiskLevel>("all");
  const [filterStatus, setFilterStatus] = React.useState<"all" | "active" | "resolved">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortField, setSortField] = React.useState<SortField>("pc");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");

  // Summary counts
  const stats = React.useMemo(() => {
    const total = conjunctionEvents.length;
    const active = conjunctionEvents.filter(e => e.status === "active").length;
    const critical = conjunctionEvents.filter(e => e.status === "active" && e.riskLevel === "red").length;
    const warning = conjunctionEvents.filter(e => e.status === "active" && e.riskLevel === "yellow").length;
    const attention = critical + warning;
    return { total, active, critical, warning, attention };
  }, [conjunctionEvents]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Filter & Sort Events
  const filteredEvents = React.useMemo(() => {
    let result = [...conjunctionEvents];

    // Filter by Risk
    if (filterRisk !== "all") {
      result = result.filter(e => e.riskLevel === filterRisk);
    }

    // Filter by Status
    if (filterStatus !== "all") {
      result = result.filter(e => e.status === filterStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        e =>
          e.id.toLowerCase().includes(q) ||
          e.primaryName.toLowerCase().includes(q) ||
          e.secondaryName.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "tca") {
        valA = new Date(a.tca).getTime();
        valB = new Date(b.tca).getTime();
      } else if (sortField === "riskLevel") {
        const priority = { red: 3, yellow: 2, green: 1 };
        valA = priority[a.riskLevel] || 0;
        valB = priority[b.riskLevel] || 0;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [conjunctionEvents, filterRisk, filterStatus, searchQuery, sortField, sortOrder]);

  return (
    <div className="space-y-6">
      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#0b101f]/90 border border-space-border/60 p-4 rounded-[6px] relative overflow-hidden flex flex-col justify-between h-24 shadow-lg select-none">
          <div className="absolute top-0 right-0 w-24 h-24 -mt-6 -mr-6 bg-orbit-cyan/5 rounded-full blur-xl pointer-events-none" />
          <span className="text-[10px] font-display font-bold text-ash uppercase tracking-wider">Conjunction Events (72h)</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-3xl font-data font-bold text-bone">{stats.total}</span>
            <span className="text-[11px] text-ash">total events</span>
          </div>
        </div>

        <div className="bg-[#0b101f]/90 border border-space-border/60 p-4 rounded-[6px] relative overflow-hidden flex flex-col justify-between h-24 shadow-lg select-none">
          <div className="absolute top-0 right-0 w-24 h-24 -mt-6 -mr-6 bg-[#ff3b3b]/5 rounded-full blur-xl pointer-events-none" />
          <span className="text-[10px] font-display font-bold text-ash uppercase tracking-wider">Immediate Attention</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className={cn("text-3xl font-data font-bold", stats.attention > 0 ? "text-collision-red animate-pulse" : "text-bone")}>
              {stats.attention}
            </span>
            <span className="text-[11px] text-ash">require action</span>
          </div>
        </div>

        <div className="bg-[#0b101f]/90 border border-[#ff3b3b]/20 p-4 rounded-[6px] relative overflow-hidden flex flex-col justify-between h-24 shadow-lg select-none">
          <div className="absolute top-0 right-0 w-24 h-24 -mt-6 -mr-6 bg-collision-red/5 rounded-full blur-xl pointer-events-none" />
          <span className="text-[10px] font-display font-bold text-ash uppercase tracking-wider">Critical Hazards</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-3xl font-data font-bold text-collision-red">{stats.critical}</span>
            <span className="text-[11px] text-ash">RED risk status</span>
          </div>
        </div>

        <div className="bg-[#0b101f]/90 border border-[#ffd93d]/20 p-4 rounded-[6px] relative overflow-hidden flex flex-col justify-between h-24 shadow-lg select-none">
          <div className="absolute top-0 right-0 w-24 h-24 -mt-6 -mr-6 bg-threat-amber/5 rounded-full blur-xl pointer-events-none" />
          <span className="text-[10px] font-display font-bold text-ash uppercase tracking-wider">Warning Alerts</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-3xl font-data font-bold text-threat-amber">{stats.warning}</span>
            <span className="text-[11px] text-ash">YELLOW risk status</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-space-section border border-space-border/60 rounded-[6px] p-4 flex flex-wrap items-center justify-between gap-4 shadow-md">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-graphite" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by satellite or threat name..."
            className="w-full bg-[#070c18] border border-space-border/70 rounded-[4px] pl-9 pr-4 py-1.5 text-[12px] text-bone placeholder-graphite focus:outline-none focus:border-orbit-cyan transition-colors"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="h-3.5 w-3.5 text-ash" />
            <span className="text-[11px] font-display font-bold text-ash uppercase tracking-wider">Risk Level</span>
          </div>
          <div className="flex rounded-[4px] border border-space-border/70 overflow-hidden bg-[#070c18]">
            <button
              onClick={() => setFilterRisk("all")}
              className={cn("px-3 py-1.5 text-[11px] font-display font-bold uppercase transition-colors", 
                filterRisk === "all" ? "bg-orbit-cyan/25 text-orbit-cyan" : "text-ash hover:text-bone hover:bg-iron/10"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterRisk("red")}
              className={cn("px-3 py-1.5 text-[11px] font-display font-bold uppercase transition-colors", 
                filterRisk === "red" ? "bg-collision-red/20 text-collision-red" : "text-ash hover:text-bone hover:bg-iron/10"
              )}
            >
              Red
            </button>
            <button
              onClick={() => setFilterRisk("yellow")}
              className={cn("px-3 py-1.5 text-[11px] font-display font-bold uppercase transition-colors", 
                filterRisk === "yellow" ? "bg-threat-amber/15 text-threat-amber" : "text-ash hover:text-bone hover:bg-iron/10"
              )}
            >
              Yellow
            </button>
            <button
              onClick={() => setFilterRisk("green")}
              className={cn("px-3 py-1.5 text-[11px] font-display font-bold uppercase transition-colors", 
                filterRisk === "green" ? "bg-cleared-green/20 text-cleared-green" : "text-ash hover:text-bone hover:bg-iron/10"
              )}
            >
              Green
            </button>
          </div>

          <div className="flex rounded-[4px] border border-space-border/70 overflow-hidden bg-[#070c18]">
            <button
              onClick={() => setFilterStatus("all")}
              className={cn("px-3 py-1.5 text-[11px] font-display font-bold uppercase transition-colors", 
                filterStatus === "all" ? "bg-[#16223f] text-orbit-cyan" : "text-ash hover:text-bone hover:bg-iron/10"
              )}
            >
              All Status
            </button>
            <button
              onClick={() => setFilterStatus("active")}
              className={cn("px-3 py-1.5 text-[11px] font-display font-bold uppercase transition-colors", 
                filterStatus === "active" ? "bg-[#2b1e16] text-threat-amber" : "text-ash hover:text-bone hover:bg-iron/10"
              )}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus("resolved")}
              className={cn("px-3 py-1.5 text-[11px] font-display font-bold uppercase transition-colors", 
                filterStatus === "resolved" ? "bg-[#14261d] text-cleared-green" : "text-ash hover:text-bone hover:bg-iron/10"
              )}
            >
              Resolved
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-[#0b101f]/95 border border-space-border/60 rounded-[6px] shadow-xl overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <Radio className="h-10 w-10 text-graphite animate-pulse" />
            <span className="text-[12px] font-display font-bold text-ash uppercase tracking-wider">No Conjunction Events Found</span>
            <span className="text-[10px] text-ash/70 font-mono">Verify sync or modify query parameters.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-space-border bg-[#0a0e19]">
                  <th className="p-4">
                    <button onClick={() => handleSort("primaryName")} className="flex items-center space-x-1.5 text-[10px] font-display font-bold text-ash uppercase tracking-wider hover:text-bone transition-colors">
                      <span>Primary Object</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="p-4">
                    <button onClick={() => handleSort("secondaryName")} className="flex items-center space-x-1.5 text-[10px] font-display font-bold text-ash uppercase tracking-wider hover:text-bone transition-colors">
                      <span>Secondary Object</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="p-4">
                    <button onClick={() => handleSort("tca")} className="flex items-center space-x-1.5 text-[10px] font-display font-bold text-ash uppercase tracking-wider hover:text-bone transition-colors">
                      <span>TCA (UTC)</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="p-4">
                    <button onClick={() => handleSort("missDistance")} className="flex items-center space-x-1.5 text-[10px] font-display font-bold text-ash uppercase tracking-wider hover:text-bone transition-colors">
                      <span>Miss Distance</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="p-4">
                    <button onClick={() => handleSort("pc")} className="flex items-center space-x-1.5 text-[10px] font-display font-bold text-ash uppercase tracking-wider hover:text-bone transition-colors">
                      <span>Collision Probability (Pc)</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="p-4">
                    <button onClick={() => handleSort("riskLevel")} className="flex items-center space-x-1.5 text-[10px] font-display font-bold text-ash uppercase tracking-wider hover:text-bone transition-colors">
                      <span>Risk Status</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="p-4 text-[10px] font-display font-bold text-ash uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-space-border/40 font-data text-[12px] text-bone">
                {filteredEvents.map((event) => {
                  const isCritical = event.riskLevel === "red";
                  const isWarning = event.riskLevel === "yellow";
                  const isResolved = event.status === "resolved";

                  return (
                    <tr 
                      key={event.id} 
                      className={cn("hover:bg-[#16223f]/20 transition-colors group", {
                        "bg-[#ff4444]/2 border-l border-l-[#ff4444]": isCritical && !isResolved,
                        "bg-[#ffd93d]/1 border-l border-l-[#ffd93d]": isWarning && !isResolved,
                        "opacity-60": isResolved
                      })}
                    >
                      <td className="p-4 font-bold">
                        <div className="flex flex-col">
                          <span className="text-orbit-cyan font-bold">{event.primaryName}</span>
                          <span className="text-[9px] text-ash font-normal font-mono">ID: {event.primaryId}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className={cn("font-semibold", event.secondaryName.includes("DEBRIS") ? "text-[#ff6b6b]" : "text-bone")}>
                            {event.secondaryName}
                          </span>
                          <span className="text-[9px] text-ash font-mono">ID: {event.secondaryId}</span>
                        </div>
                      </td>
                      <td className="p-4 text-ash">
                        {new Date(event.tca).toISOString().replace("T", " ").substring(0, 19)}
                      </td>
                      <td className="p-4 font-mono font-semibold">
                        {event.missDistance.toFixed(3)} km
                        <span className="text-[10px] text-ash font-normal block">({event.missDistanceMeters.toLocaleString()} m)</span>
                      </td>
                      <td className="p-4 font-mono font-bold">
                        {event.pcDisplay}
                      </td>
                      <td className="p-4">
                        <span className={cn("px-2.5 py-0.5 rounded-[4px] text-[10px] font-display font-bold uppercase tracking-wider", {
                          "bg-collision-red/25 text-collision-red border border-collision-red/20": event.riskLevel === "red",
                          "bg-threat-amber/20 text-threat-amber border border-threat-amber/15": event.riskLevel === "yellow",
                          "bg-cleared-green/20 text-cleared-green border border-cleared-green/15": event.riskLevel === "green"
                        })}>
                          {event.riskLevel}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/map?event=${event.id}`}
                            className="p-1.5 rounded-[4px] border border-orbit-cyan/35 text-orbit-cyan hover:bg-orbit-cyan/15 hover:border-orbit-cyan transition-colors"
                            title="Focus in 3D Map"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          {event.status === "resolved" ? (
                            <span className="flex items-center space-x-1 text-cleared-green px-2.5 py-1 text-[11px] font-display font-bold uppercase">
                              <CheckCircle className="h-3 w-3" />
                              <span>RESOLVED</span>
                            </span>
                          ) : (
                            <Link
                              href={`/maneuvers?event=${event.id}`}
                              className="px-2.5 py-1 text-[11px] font-display font-bold uppercase tracking-wider bg-orbit-cyan/20 border border-orbit-cyan/45 text-orbit-cyan hover:bg-orbit-cyan/35 transition-colors rounded-[4px]"
                            >
                              Resolve
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
