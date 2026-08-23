"use client";

import * as React from "react";
import Link from "next/link";
import { useOrbitStream } from "@/lib/hooks/useOrbitStream";
import { ConjunctionEvent, RiskLevel } from "@/types";
import { cn } from "@/lib/utils";
import LifecycleTimeline from "@/components/dashboard/LifecycleTimeline";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription } from "@/components/ui/Card";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

type SortField = "primaryName" | "secondaryName" | "tca" | "missDistance" | "pc" | "riskLevel";
type SortOrder = "asc" | "desc";

export default function ConjunctionsPage() {
  const { conjunctionEvents, satellites } = useOrbitStream();
  const [filterRisk, setFilterRisk] = React.useState<"all" | RiskLevel>("all");
  const [filterStatus, setFilterStatus] = React.useState<"all" | "active" | "resolved">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortField, setSortField] = React.useState<SortField>("pc");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");
  
  // Refresh catalog states
  const [refreshing, setRefreshing] = React.useState(false);
  
  // AI Explain states
  const [explainingEventId, setExplainingEventId] = React.useState<string | null>(null);
  const [briefingText, setBriefingText] = React.useState<string>("");
  const [loadingBriefing, setLoadingBriefing] = React.useState<boolean>(false);

  const handleRefreshCatalog = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/celestrak/sync", { method: "POST" });
      if (res.ok) {
        alert("TLE catalog synchronized and screening re-run completed.");
      } else {
        alert("Failed to synchronize catalog.");
      }
    } catch (error) {
      console.error(error);
      alert("Error synchronizing catalog.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenExplain = async (eventId: string) => {
    setExplainingEventId(eventId);
    setLoadingBriefing(true);
    try {
      const res = await fetch(`/api/ai-explain-conjunction/${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setBriefingText(data.briefing);
      } else {
        setBriefingText("Failed to compile AI briefing summary.");
      }
    } catch (error) {
      console.error(error);
      setBriefingText("Error compiling AI briefing.");
    } finally {
      setLoadingBriefing(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Stats calculation
  const stats = React.useMemo(() => {
    const activeList = conjunctionEvents.filter((e) => e.status === "active");
    return {
      total: conjunctionEvents.length,
      attention: activeList.filter((e) => e.riskLevel === "red").length,
      critical: conjunctionEvents.filter((e) => e.riskLevel === "red").length,
      warning: conjunctionEvents.filter((e) => e.riskLevel === "yellow").length,
    };
  }, [conjunctionEvents]);

  // Filtered and Sorted list
  const filteredEvents = React.useMemo(() => {
    let result = [...conjunctionEvents];

    // Filter by risk
    if (filterRisk !== "all") {
      result = result.filter((e) => e.riskLevel === filterRisk);
    }

    // Filter by status
    if (filterStatus !== "all") {
      result = result.filter((e) => e.status === filterStatus);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          e.primaryName.toLowerCase().includes(q) ||
          e.secondaryName.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      // Custom comparisons for objects or numeric representation
      if (sortField === "missDistance") {
        valA = a.missDistanceMeters;
        valB = b.missDistanceMeters;
      } else if (sortField === "riskLevel") {
        const priority = { red: 3, yellow: 2, green: 1 };
        valA = priority[a.riskLevel as RiskLevel] || 0;
        valB = priority[b.riskLevel as RiskLevel] || 0;
      }

      if (valA == null) return 1;
      if (valB == null) return -1;

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [conjunctionEvents, filterRisk, filterStatus, searchQuery, sortField, sortOrder]);

  return (
    <div className="space-y-8 select-none relative animate-fade-in">
      {/* Page Title Display Headline */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display uppercase">Orbital Screening</h1>
          <p className="text-body-secondary mt-2">Active space traffic conjunctions and safety screening registry.</p>
        </div>

        <button
          onClick={handleRefreshCatalog}
          disabled={refreshing}
          className="self-start sm:self-center px-6 py-2.5 bg-white text-[#101010] rounded-[9999px] font-sans text-[12px] uppercase tracking-wider hover:bg-[#cacaca] transition-all cursor-pointer font-normal"
        >
          {refreshing ? "Refreshing Catalog..." : "Refresh TLE Catalog"}
        </button>
      </div>

      <hr className="hairline-divider" />

      {/* Summary Row stats cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-8">
          <span className="text-meta block">
            <InfoTooltip term="Conjunction Events (72h)" explanation="Conjunctions are events where two space objects (like satellites or debris) are predicted to pass very close to each other." />
          </span>
          <div className="flex items-baseline space-x-2 mt-3">
            <span className="text-mono-numeric text-[32px] font-normal text-[#f3f3f3]">{stats.total}</span>
            <span className="text-[11px] font-mono text-[#9c9c9c] uppercase">Total</span>
          </div>
        </Card>

        <Card className="p-8">
          <span className="text-meta block">Immediate Attention</span>
          <div className="flex items-baseline space-x-2 mt-3">
            <span className={cn("text-mono-numeric text-[32px] font-normal", stats.attention > 0 ? "text-[#ff3355]" : "text-[#f3f3f3]")}>
              {stats.attention}
            </span>
            <span className="text-[11px] font-mono text-[#9c9c9c] uppercase">Require Action</span>
          </div>
        </Card>

        <Card className="p-8">
          <span className="text-meta block">Critical Hazards</span>
          <div className="flex items-baseline space-x-2 mt-3">
            <span className="text-mono-numeric text-[32px] font-normal text-[#ff3355]">{stats.critical}</span>
            <span className="text-[11px] font-mono text-[#9c9c9c] uppercase">Red Level</span>
          </div>
        </Card>

        <Card className="p-8">
          <span className="text-meta block">Warning Alerts</span>
          <div className="flex items-baseline space-x-2 mt-3">
            <span className="text-mono-numeric text-[32px] font-normal text-[#ffb829]">{stats.warning}</span>
            <span className="text-[11px] font-mono text-[#9c9c9c] uppercase">Yellow Level</span>
          </div>
        </Card>
      </div>

      <hr className="hairline-divider" />

      {/* Filter Toolbar */}
      <div className="bg-transparent border border-[#212121] rounded-[8px] p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by satellite or threat name..."
            className="w-full bg-[#080808] border border-[#212121] rounded-[8px] px-3 py-2 text-[12px] font-mono text-[#f3f3f3] placeholder-[#9c9c9c]/50 focus:outline-none focus:border-[#f3f3f3] transition-colors"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex rounded-[8px] border border-[#212121] overflow-hidden bg-transparent p-0.5">
            {[
              { key: "all", label: "All Risk" },
              { key: "red", label: "Red" },
              { key: "yellow", label: "Yellow" },
              { key: "green", label: "Green" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilterRisk(opt.key as any)}
                className={cn("px-3 py-1 text-[11px] uppercase tracking-wider transition-all font-mono", 
                  filterRisk === opt.key 
                    ? "bg-white text-[#101010] rounded-[6px]" 
                    : "text-[#9c9c9c] hover:text-[#f3f3f3]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex rounded-[8px] border border-[#212121] overflow-hidden bg-transparent p-0.5">
            {[
              { key: "all", label: "All Status" },
              { key: "active", label: "Active" },
              { key: "resolved", label: "Resolved" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilterStatus(opt.key as any)}
                className={cn("px-3 py-1 text-[11px] uppercase tracking-wider transition-all font-mono", 
                  filterStatus === opt.key 
                    ? "bg-white text-[#101010] rounded-[6px]" 
                    : "text-[#9c9c9c] hover:text-[#f3f3f3]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="border border-[#212121] rounded-[8px] overflow-hidden bg-transparent">
        {filteredEvents.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center space-y-3">
            <span className="text-meta text-[#9c9c9c]">No Conjunction Events Found</span>
            <span className="text-[12px] text-[#9c9c9c]/80 font-mono">Verify catalog database sync or update filter parameters.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#212121] bg-[#080808] text-[#9c9c9c] font-mono text-[12px] uppercase">
                  <th className="p-4 font-normal">
                    <button onClick={() => handleSort("primaryName")} className="hover:text-[#f3f3f3] transition-colors cursor-pointer">
                      Primary Object{sortField === "primaryName" && (sortOrder === "asc" ? " ▴" : " ▾")}
                    </button>
                  </th>
                  <th className="p-4 font-normal">
                    <button onClick={() => handleSort("secondaryName")} className="hover:text-[#f3f3f3] transition-colors cursor-pointer">
                      Secondary Object{sortField === "secondaryName" && (sortOrder === "asc" ? " ▴" : " ▾")}
                    </button>
                  </th>
                  <th className="p-4 font-normal">
                    <button onClick={() => handleSort("tca")} className="hover:text-[#f3f3f3] transition-colors cursor-pointer inline-flex items-center gap-1">
                      <InfoTooltip term="TCA (UTC)" explanation="Time of Closest Approach. The exact moment in UTC when the two objects will be nearest to each other." />{sortField === "tca" && (sortOrder === "asc" ? " ▴" : " ▾")}
                    </button>
                  </th>
                  <th className="p-4 font-normal">
                    <button onClick={() => handleSort("missDistance")} className="hover:text-[#f3f3f3] transition-colors cursor-pointer inline-flex items-center gap-1">
                      <InfoTooltip term="Miss Distance" explanation="The minimum physical distance predicted between the two objects at their closest point." />{sortField === "missDistance" && (sortOrder === "asc" ? " ▴" : " ▾")}
                    </button>
                  </th>
                  <th className="p-4 font-normal">
                    <button onClick={() => handleSort("pc")} className="hover:text-[#f3f3f3] transition-colors cursor-pointer inline-flex items-center gap-1">
                      <InfoTooltip term="Probability" explanation="The calculated mathematical chance that these two objects will collide." />{sortField === "pc" && (sortOrder === "asc" ? " ▴" : " ▾")}
                    </button>
                  </th>
                  <th className="p-4 font-normal">
                    <button onClick={() => handleSort("riskLevel")} className="hover:text-[#f3f3f3] transition-colors cursor-pointer">
                      Risk Status{sortField === "riskLevel" && (sortOrder === "asc" ? " ▴" : " ▾")}
                    </button>
                  </th>

                </tr>
              </thead>
              <tbody className="divide-y divide-[#212121] text-[#9c9c9c] text-[13px]">
                {filteredEvents.map((event) => {
                  const isCritical = event.riskLevel === "red";
                  const isWarning = event.riskLevel === "yellow";
                  const isResolved = event.status === "resolved";

                  return (
                    <tr 
                      key={event.id} 
                      className={cn("hover:bg-[#080808]/40 transition-colors", {
                        "bg-[#ff3355]/2 border-l border-l-[#ff3355]": isCritical && !isResolved,
                        "bg-[#ffb829]/2 border-l border-l-[#ffb829]": isWarning && !isResolved,
                        "opacity-50": isResolved
                      })}
                    >
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-[#f3f3f3] font-mono text-[13px]">{event.primaryName}</span>
                          <span className="text-[10px] text-[#9c9c9c] font-mono">ID: {event.primaryId}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className={cn("font-mono text-[13px]", event.secondaryName.includes("DEBRIS") ? "text-[#ffb829]" : "text-[#f3f3f3]")}>
                            {event.secondaryName}
                          </span>
                          <span className="text-[10px] text-[#9c9c9c] font-mono">ID: {event.secondaryId}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-[12px]">
                        {new Date(event.tca).toISOString().replace("T", " ").substring(0, 19)}
                      </td>
                      <td className="p-4 font-mono text-[12px] text-[#f3f3f3]">
                        {event.missDistance.toFixed(3)} km
                        <span className="text-[10px] text-[#9c9c9c] block">({event.missDistanceMeters.toLocaleString()} m)</span>
                      </td>
                      <td className="p-4 font-mono text-[12px] text-[#f3f3f3]">
                        {event.pcDisplay}
                      </td>
                      <td className="p-4">
                        <Badge variant={event.riskLevel === "red" ? "critical" : event.riskLevel === "yellow" ? "caution" : "cleared"}>
                          {event.riskLevel === "red" ? "RED ALERT" : event.riskLevel === "yellow" ? "YELLOW ALERT" : "CLEARED"}
                        </Badge>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Explain Modal */}
      {explainingEventId && (() => {
        const explainingEvent = conjunctionEvents.find((e) => e.id === explainingEventId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#101010]/60 backdrop-blur-sm">
            <div 
              onClick={() => setExplainingEventId(null)}
              className="absolute inset-0"
            />
            
            <div className="relative bg-[#080808] border border-[#212121] w-full max-w-4xl rounded-[8px] p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-[#212121] pb-3">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-[11px] text-[#9c9c9c] uppercase tracking-wider">
                    AI Conjunction analysis & Lifecycle (ID: {explainingEventId})
                  </span>
                </div>
                <button
                  onClick={() => setExplainingEventId(null)}
                  className="px-2 py-1 border border-[#212121] hover:border-[#f3f3f3] text-[#9c9c9c] hover:text-[#f3f3f3] rounded-[8px] cursor-pointer transition-all font-mono text-[11px]"
                >
                  [X]
                </button>
              </div>

              {/* Two-Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[250px]">
                {/* Left Column: AI Briefing */}
                <div className="flex flex-col space-y-3">
                  <h4 className="text-meta">
                    AI Risk Briefing
                  </h4>
                  <div className="flex-1 overflow-y-auto max-h-[350px] pr-1">
                    {loadingBriefing ? (
                      <div className="flex flex-col items-center justify-center space-y-2 py-12">
                        <span className="font-mono text-[11px] text-[#9c9c9c] uppercase tracking-widest animate-pulse">[GENERATING ANALYSIS...]</span>
                      </div>
                    ) : (
                      <p className="font-sans text-[14px] font-light leading-relaxed text-[#f3f3f3] whitespace-pre-line">
                        {briefingText}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Column: Lifecycle Timeline */}
                <div className="overflow-y-auto max-h-[350px] pr-1">
                  {explainingEvent ? (
                    <LifecycleTimeline event={explainingEvent} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[#9c9c9c]/60 font-mono text-[11px]">
                      Loading event metadata...
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end border-t border-[#212121] pt-3">
                <Button variant="ghost" onClick={() => setExplainingEventId(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
