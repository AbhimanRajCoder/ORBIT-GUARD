"use client";

import * as React from "react";
import { useOrbitStream } from "@/lib/hooks/useOrbitStream";
import { AIBriefing, ConjunctionEvent } from "@/types";
import { 
  Bot, 
  Terminal, 
  Copy, 
  Check, 
  MessageSquare,
  Sparkles,
  Info,
  ChevronRight,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#0b101f]/90 border border-space-border/60 p-6 rounded-[6px] relative overflow-hidden shadow-lg select-none flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orbit-cyan/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start gap-4">
          <div className="p-3 bg-orbit-cyan/10 border border-orbit-cyan/30 rounded-[4px] text-orbit-cyan shrink-0">
            <Bot className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-display font-bold text-bone tracking-wide uppercase flex items-center gap-2">
              AI Situation Briefing
              <span className="px-2 py-0.5 rounded-[4px] bg-orbit-cyan/15 text-orbit-cyan border border-orbit-cyan/35 text-[9px] font-display font-bold uppercase tracking-widest">
                Llama 3.1
              </span>
            </h2>
            <p className="text-[12px] text-ash max-w-2xl leading-relaxed">
              Generate instant plain-English summaries of critical orbital hazards and recommended evasive maneuvers. Suitable for flight-director briefing packages and rapid operator alignment.
            </p>
          </div>
        </div>

        {/* Dropdown Selector */}
        <div className="flex flex-col gap-1.5 shrink-0 min-w-[240px]">
          <label className="text-[9px] font-display font-bold text-ash uppercase tracking-wider">Select Conjunction Event</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full bg-[#070c18] border border-space-border/70 rounded-[4px] px-3 py-2 text-[12px] font-data font-bold text-bone focus:outline-none focus:border-orbit-cyan cursor-pointer"
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

      {loading ? (
        <div className="bg-[#0b101f]/90 border border-space-border/60 rounded-[6px] p-24 text-center flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="h-8 w-8 text-orbit-cyan animate-spin" />
          <span className="text-[12px] font-display font-bold text-ash uppercase tracking-wider">Synthesizing Situation Briefing...</span>
        </div>
      ) : briefing && selectedEvent ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Plain English Briefing Card - Left */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            <div className="bg-[#0b101f]/95 border border-space-border/60 rounded-[6px] shadow-xl p-6 flex-1 flex flex-col justify-between space-y-6 relative overflow-hidden">
              {/* Corner AI Sparkle Decor */}
              <div className="absolute top-0 right-0 p-4 opacity-15">
                <Sparkles className="h-20 w-20 text-orbit-cyan" />
              </div>

              <div className="space-y-4 relative">
                <div className="flex items-center space-x-2 text-orbit-cyan">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-[10px] font-display font-bold uppercase tracking-wider">Generated Briefing Text</span>
                </div>

                <div className="border-l-2 border-orbit-cyan/50 pl-5 py-2">
                  <p className="text-[14px] text-bone font-body leading-relaxed select-text">
                    {briefing.briefingText}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-space-border/40 pt-4">
                <div className="flex items-center space-x-1 text-ash text-[10px] font-mono">
                  <span>Synthesized:</span>
                  <span>{new Date(briefing.generatedAt).toLocaleTimeString()}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(briefing.briefingText, false)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[4px] border border-space-border hover:border-orbit-cyan text-[11px] font-display font-bold uppercase transition-colors text-ash hover:text-orbit-cyan bg-[#070c18]"
                >
                  {copiedText ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-cleared-green" />
                      <span className="text-cleared-green">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Event Summary Quick Details */}
            <div className="bg-[#0b101f]/90 border border-space-border/60 rounded-[6px] p-5 shadow-lg space-y-4">
              <div className="flex items-center space-x-2 text-ash border-b border-space-border/40 pb-2">
                <Info className="h-4 w-4" />
                <span className="text-[10px] font-display font-bold uppercase tracking-wider">Conjunction Metadata</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-data text-[12px]">
                <div className="space-y-1">
                  <span className="text-[9px] font-display font-bold text-ash uppercase tracking-wider block">TCA epoch</span>
                  <span className="text-bone block truncate">{new Date(selectedEvent.tca).toLocaleTimeString()} UTC</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-display font-bold text-ash uppercase tracking-wider block">Risk Level</span>
                  <span className={cn("font-bold uppercase", {
                    "text-collision-red": selectedEvent.riskLevel === "red",
                    "text-threat-amber": selectedEvent.riskLevel === "yellow",
                    "text-cleared-green": selectedEvent.riskLevel === "green"
                  })}>{selectedEvent.riskLevel}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-display font-bold text-ash uppercase tracking-wider block">Miss Distance</span>
                  <span className="text-bone block">{selectedEvent.missDistanceMeters} m</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-display font-bold text-ash uppercase tracking-wider block">Pc Probability</span>
                  <span className="text-bone block">{selectedEvent.pcDisplay}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Structured JSON Context - Right */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-[#050914] border border-space-border/60 rounded-[6px] shadow-xl overflow-hidden flex flex-col h-[400px] lg:h-full justify-between">
              <div className="flex items-center justify-between bg-[#0a0e19] border-b border-space-border/60 px-4 py-3">
                <div className="flex items-center space-x-2 text-ash">
                  <Terminal className="h-4 w-4" />
                  <span className="text-[10px] font-display font-bold uppercase tracking-wider">Structured JSON Context</span>
                </div>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(briefing.context, null, 2), true)}
                  className="p-1 rounded-[4px] border border-space-border hover:border-orbit-cyan transition-colors"
                  title="Copy JSON to Clipboard"
                >
                  {copiedJson ? (
                    <Check className="h-3.5 w-3.5 text-cleared-green" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-ash hover:text-orbit-cyan" />
                  )}
                </button>
              </div>

              {/* Monospace Code Editor Block */}
              <div className="flex-1 p-4 overflow-y-auto font-data text-[11px] text-[#4affb8] select-text scrollbar-thin bg-black/40">
                <pre>{JSON.stringify(briefing.context, null, 2)}</pre>
              </div>

              <div className="bg-[#0a0e19] border-t border-space-border/60 px-4 py-3 flex items-center justify-between text-[10px] text-ash">
                <div className="flex items-center space-x-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cleared-green" />
                  <span>Payload OK</span>
                </div>
                <span>Size: {JSON.stringify(briefing.context).length} B</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#0b101f]/90 border border-space-border/60 rounded-[6px] p-24 text-center flex flex-col items-center justify-center space-y-4">
          <AlertTriangle className="h-8 w-8 text-threat-amber animate-pulse" />
          <span className="text-[12px] font-display font-bold text-ash uppercase tracking-wider">No Active Conjunction Events Found</span>
          <span className="text-[10px] text-ash/70 font-mono">Sync CelesTrak to populate conjunction event simulator data.</span>
        </div>
      )}
    </div>
  );
}
