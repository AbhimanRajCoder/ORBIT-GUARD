"use client";

import * as React from "react";
import { useOrbitStream } from "@/lib/hooks/useOrbitStream";
import { AIBriefing, ConjunctionEvent } from "@/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription } from "@/components/ui/Card";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

export default function AIBriefingPage() {
  const { conjunctionEvents } = useOrbitStream();
  const [selectedEventId, setSelectedEventId] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);
  const [briefing, setBriefing] = React.useState<AIBriefing | null>(null);
  const [copiedText, setCopiedText] = React.useState<boolean>(false);
  const [copiedJson, setCopiedJson] = React.useState<boolean>(false);

  const activeEvents = React.useMemo(() => {
    return conjunctionEvents.filter(e => e.status === "active");
  }, [conjunctionEvents]);

  // Select the first active event on load if available
  React.useEffect(() => {
    if (activeEvents.length > 0 && !selectedEventId) {
      setSelectedEventId(activeEvents[0].id);
    }
  }, [activeEvents, selectedEventId]);

  // Fetch AI briefing
  const generateBriefing = React.useCallback(async (eventId: string) => {
    if (!eventId) return;
    setLoading(true);
    try {
      const response = await fetch("/api/ai-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conjunctionEventId: eventId }),
      });
      if (response.ok) {
        const data = await response.json();
        setBriefing(data);
      } else {
        console.error("Failed to generate AI briefing");
      }
    } catch (error) {
      console.error("Error generating AI briefing:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (selectedEventId) {
      generateBriefing(selectedEventId);
    }
  }, [selectedEventId, generateBriefing]);

  const copyToClipboard = (text: string, isJson: boolean) => {
    navigator.clipboard.writeText(text);
    if (isJson) {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } else {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const selectedEvent = activeEvents.find(e => e.id === selectedEventId);

  return (
    <div className="space-y-8 select-none relative animate-fade-in">
      {/* Editorial Header */}
      <div className="border border-[#212121] p-8 rounded-[8px] select-none flex flex-col md:flex-row md:items-center justify-between gap-6 bg-transparent">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="text-display uppercase">Situation Briefing</h1>
            <Badge variant="cleared">LLAMA 3.1</Badge>
          </div>
          <p className="text-body-secondary text-[15px] max-w-xl leading-relaxed">
            AI-synthesized plain-English situation overviews for flight-director briefing packages and rapid operator alignment.
          </p>
        </div>

        {/* Dropdown Selector */}
        <div className="flex flex-col gap-2 shrink-0 min-w-[280px]">
          <span className="text-meta">Conjunction Event</span>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full bg-[#080808] border border-[#212121] rounded-[8px] px-4 py-2.5 text-[13px] font-mono text-[#f3f3f3] focus:outline-none focus:border-[#f3f3f3] cursor-pointer"
          >
            {activeEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.id} ({event.primaryName} vs {event.secondaryName})
              </option>
            ))}
            {activeEvents.length === 0 && (
              <option value="">No Active Conjunctions</option>
            )}
          </select>
        </div>
      </div>

      <hr className="hairline-divider" />

      {loading ? (
        <div className="border border-[#212121] rounded-[8px] p-24 text-center flex flex-col items-center justify-center space-y-4">
          <span className="text-[14px] font-mono text-[#9c9c9c] animate-pulse">[SYNTHESIZING BRIEFING...]</span>
        </div>
      ) : briefing && selectedEvent ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Editorial Briefing Card - Left */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            <Card className="flex-1 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-meta">Situation Overview</span>
                <div className="border-l-2 border-[#212121] pl-6 py-3">
                  <p className="text-[16px] text-[#f3f3f3] font-light leading-[1.8] select-text">
                    {briefing.briefingText}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#212121] pt-4">
                <div className="flex items-center space-x-1.5 text-[#9c9c9c] text-[11px] font-mono">
                  <span>Synthesized:</span>
                  <span>{new Date(briefing.generatedAt).toLocaleTimeString()}</span>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => copyToClipboard(briefing.briefingText, false)}
                  className="py-1 px-4 text-[12px]"
                >
                  {copiedText ? "Copied" : "Copy Text"}
                </Button>
              </div>
            </Card>

            {/* Event Summary Quick Details */}
            <div className="border border-[#212121] rounded-[8px] p-6 space-y-4 bg-transparent">
              <div className="flex items-center space-x-2 text-[#9c9c9c] border-b border-[#212121] pb-3">
                <span className="text-meta"><InfoTooltip term="Conjunction Metadata" explanation="Conjunction refers to a close approach event in space. Metadata is the structured details describing this event." /></span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-mono-numeric text-[12px]">
                <div className="space-y-1">
                  <span className="text-meta text-[11px] block"><InfoTooltip term="TCA epoch" explanation="Time of Closest Approach. The specific point in time (epoch) when the two objects will be at their absolute closest distance." /></span>
                  <span className="text-[#f3f3f3] block truncate">{new Date(selectedEvent.tca).toLocaleTimeString()} UTC</span>
                </div>
                <div className="space-y-1">
                  <span className="text-meta text-[11px] block">Risk Level</span>
                  <span className={cn("font-normal uppercase", {
                    "text-[#ff3355]": selectedEvent.riskLevel === "red",
                    "text-[#ffb829]": selectedEvent.riskLevel === "yellow",
                    "text-[#98ff38]": selectedEvent.riskLevel === "green"
                  })}>{selectedEvent.riskLevel}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-meta text-[11px] block"><InfoTooltip term="Miss Distance" explanation="The minimum physical distance predicted between the two objects at their closest point." /></span>
                  <span className="text-[#f3f3f3] block">{selectedEvent.missDistanceMeters} m</span>
                </div>
                <div className="space-y-1">
                  <span className="text-meta text-[11px] block"><InfoTooltip term="Pc Probability" explanation="The probability of collision. The calculated chance that the two objects will collide." /></span>
                  <span className="text-[#f3f3f3] block">{selectedEvent.pcDisplay}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Structured JSON Context - Right */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="border border-[#212121] rounded-[8px] overflow-hidden flex flex-col h-[400px] lg:h-full justify-between bg-transparent">
              <div className="flex items-center justify-between bg-[#080808] border-b border-[#212121] px-5 py-3.5">
                <div className="flex items-center space-x-2 text-[#9c9c9c]">
                  <span className="text-meta">Structured JSON Context</span>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => copyToClipboard(JSON.stringify(briefing.context, null, 2), true)}
                  className="py-1 px-3 text-[11px]"
                >
                  {copiedJson ? "Copied" : "Copy JSON"}
                </Button>
              </div>

              {/* Monospace Code Editor Block */}
              <div className="flex-1 p-5 overflow-y-auto font-mono text-[11px] text-[#9c9c9c] select-text scrollbar-thin bg-[#080808]/40">
                <pre>{JSON.stringify(briefing.context, null, 2)}</pre>
              </div>

              <div className="bg-[#080808] border-t border-[#212121] px-5 py-3 flex items-center justify-between text-[11px] text-[#9c9c9c] font-mono">
                <div className="flex items-center space-x-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#98ff38]" />
                  <span>Payload OK</span>
                </div>
                <span>Size: {JSON.stringify(briefing.context).length} B</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-[#212121] rounded-[8px] p-24 text-center flex flex-col items-center justify-center space-y-4">
          <span className="text-[14px] font-mono text-[#9c9c9c] animate-pulse">[NO ACTIVE CONJUNCTIONS FOUND]</span>
          <span className="text-[11px] text-[#9c9c9c] font-mono">Sync CelesTrak to populate conjunction event simulator data.</span>
        </div>
      )}
    </div>
  );
}
