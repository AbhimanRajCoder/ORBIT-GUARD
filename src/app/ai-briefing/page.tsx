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
      {/* Editorial Header */}
      <div className="bg-[#847dff]/10 border border-[#847dff]/20 p-8 rounded-[30px] relative overflow-hidden shadow-2xl select-none flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#847dff]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#847dff]/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-start gap-5 relative">
          <div className="p-3.5 bg-[#847dff]/15 border border-[#847dff]/30 rounded-2xl text-[#847dff] shrink-0">
            <Bot className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-[32px] font-light text-cloud leading-none" style={{ fontFamily: "'Playfair Display', 'DM Serif Display', serif" }}>
                Situation <em className="italic">Briefing</em>
              </h1>
              <span className="px-2.5 py-1 rounded-full bg-[#847dff]/20 text-[#847dff] border border-[#847dff]/30 text-[10px] font-mono font-bold uppercase tracking-widest">
                Llama 3.1
              </span>
            </div>
            <p className="text-[14px] text-ash/80 max-w-xl leading-relaxed font-sans font-light">
              AI-synthesized plain-English situation overviews for flight-director briefing packages and rapid operator alignment.
            </p>
          </div>
        </div>

        {/* Dropdown Selector */}
        <div className="flex flex-col gap-2 shrink-0 min-w-[280px] relative">
          <label className="text-[10px] font-mono font-medium text-[#847dff]/70 uppercase tracking-widest">Conjunction Event</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full bg-void/60 border border-[#847dff]/25 rounded-xl px-4 py-2.5 text-[13px] font-sans text-cloud focus:outline-none focus:border-[#847dff]/60 cursor-pointer backdrop-blur-sm transition-colors"
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
        <div className="bg-[#847dff]/5 border border-[#847dff]/15 rounded-[30px] p-24 text-center flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="h-8 w-8 text-[#847dff] animate-spin" />
          <span className="text-[14px] font-sans font-light text-ash tracking-wide">Synthesizing situation briefing…</span>
        </div>
      ) : briefing && selectedEvent ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Editorial Briefing Card - Left */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            <div className="bg-[#847dff]/5 border border-[#847dff]/15 rounded-[30px] shadow-2xl p-8 flex-1 flex flex-col justify-between space-y-6 relative overflow-hidden">
              {/* Corner AI Sparkle Decor */}
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Sparkles className="h-24 w-24 text-[#847dff]" />
              </div>

              <div className="space-y-5 relative">
                <div className="flex items-center space-x-2 text-[#847dff]">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-[11px] font-mono font-medium uppercase tracking-widest">Situation Overview</span>
                </div>

                <div className="border-l-2 border-[#847dff]/40 pl-6 py-3">
                  <p className="text-[16px] text-cloud font-light leading-[1.8] select-text" style={{ fontFamily: "'Playfair Display', 'DM Serif Display', serif" }}>
                    {briefing.briefingText}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#847dff]/10 pt-4">
                <div className="flex items-center space-x-1.5 text-ash/60 text-[11px] font-mono">
                  <span>Synthesized:</span>
                  <span>{new Date(briefing.generatedAt).toLocaleTimeString()}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(briefing.briefingText, false)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl border border-[#847dff]/25 hover:border-[#847dff]/50 text-[12px] font-sans font-medium transition-all text-[#847dff]/80 hover:text-[#847dff] hover:bg-[#847dff]/5"
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
            <div className="bg-graphite/30 border border-white/8 rounded-[30px] p-6 shadow-lg space-y-4 backdrop-blur-sm">
              <div className="flex items-center space-x-2 text-ash/70 border-b border-white/5 pb-3">
                <Info className="h-4 w-4 text-[#847dff]/60" />
                <span className="text-[10px] font-mono font-medium uppercase tracking-widest">Conjunction Metadata</span>
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
            <div className="bg-void/80 border border-white/8 rounded-[30px] shadow-2xl overflow-hidden flex flex-col h-[400px] lg:h-full justify-between backdrop-blur-sm">
              <div className="flex items-center justify-between bg-void/60 border-b border-white/5 px-5 py-3.5 rounded-t-[30px]">
                <div className="flex items-center space-x-2 text-ash/70">
                  <Terminal className="h-4 w-4 text-[#847dff]/50" />
                  <span className="text-[10px] font-mono font-medium uppercase tracking-widest">Structured JSON Context</span>
                </div>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(briefing.context, null, 2), true)}
                  className="p-1.5 rounded-lg border border-white/10 hover:border-[#847dff]/40 transition-colors"
                  title="Copy JSON to Clipboard"
                >
                  {copiedJson ? (
                    <Check className="h-3.5 w-3.5 text-cleared-green" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-ash/60 hover:text-[#847dff]" />
                  )}
                </button>
              </div>

              {/* Monospace Code Editor Block */}
              <div className="flex-1 p-5 overflow-y-auto font-mono text-[11px] text-[#847dff]/80 select-text scrollbar-thin bg-void/40">
                <pre>{JSON.stringify(briefing.context, null, 2)}</pre>
              </div>

              <div className="bg-void/60 border-t border-white/5 px-5 py-3 flex items-center justify-between text-[10px] text-ash/50 font-mono rounded-b-[30px]">
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
        <div className="bg-[#847dff]/5 border border-[#847dff]/15 rounded-[30px] p-24 text-center flex flex-col items-center justify-center space-y-4">
          <AlertTriangle className="h-8 w-8 text-[#847dff]/60 animate-pulse" />
          <span className="text-[14px] font-sans font-light text-ash tracking-wide">No active conjunction events found</span>
          <span className="text-[11px] text-ash/50 font-mono">Sync CelesTrak to populate conjunction event simulator data.</span>
        </div>
      )}
    </div>
  );
}
