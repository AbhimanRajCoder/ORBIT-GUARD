"use client";

import * as React from "react";
import { Satellite, ConjunctionEvent } from "@/types";
import { useToast } from "@/lib/toast-context";

interface StreamContextType {
  satellites: Satellite[];
  conjunctionEvents: ConjunctionEvent[];
  lastUpdated: string;
  connectionStatus: "connecting" | "connected" | "disconnected";
}

const StreamContext = React.createContext<StreamContextType | undefined>(undefined);

export function StreamProvider({ children }: { children: React.ReactNode }) {
  const [satellites, setSatellites] = React.useState<Satellite[]>([]);
  const [conjunctionEvents, setConjunctionEvents] = React.useState<ConjunctionEvent[]>([]);
  const [lastUpdated, setLastUpdated] = React.useState<string>(new Date().toISOString());
  const [connectionStatus, setConnectionStatus] = React.useState<"connecting" | "connected" | "disconnected">("connecting");
  const { addToast } = useToast();

  React.useEffect(() => {
    // 1. Fetch initial states to quickly seed context before first SSE intervals
    async function loadInitialData() {
      try {
        const [satRes, conjRes] = await Promise.all([
          fetch("/api/satellites"),
          fetch("/api/conjunction-events"),
        ]);
        if (satRes.ok && conjRes.ok) {
          const s = await satRes.json();
          const c = await conjRes.json();
          setSatellites(s);
          setConjunctionEvents(c);
        }
      } catch (error) {
        console.error("Failed to seed initial stream provider data:", error);
      }
    }
    loadInitialData();

    // 2. Establish connection to SSE
    setConnectionStatus("connecting");
    const eventSource = new EventSource("/api/stream");

    eventSource.onopen = () => {
      setConnectionStatus("connected");
    };

    eventSource.onerror = (error) => {
      console.error("SSE Connection Error:", error);
      setConnectionStatus("disconnected");
    };

    // 3. Listen for telemetry updates
    eventSource.addEventListener("data_update", (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        const { type, payload } = message;

        if (type === "satellite_update") {
          setSatellites(payload);
          setLastUpdated(new Date().toISOString());
        } else if (type === "new_conjunction") {
          const { event: conjEvent, satellite: updatedSat } = payload;
          
          // Add new warning event to state
          setConjunctionEvents((prev) => {
            if (prev.some((e) => e.id === conjEvent.id)) return prev;
            return [conjEvent, ...prev];
          });

          // Trigger toast alert banner
          addToast(
            `⚠ New conjunction event detected: ${updatedSat.name} + ${conjEvent.secondaryName}`,
            "warning"
          );
        } else if (type === "conjunction_update") {
          const updatedEvent = payload;
          setConjunctionEvents((prev) =>
            prev.map((e) => (e.id === updatedEvent.id ? { ...e, ...updatedEvent } : e))
          );
          addToast(`🔄 Alert status updated for ${updatedEvent.secondaryName}`, "info");
        } else if (type === "status_update") {
          setLastUpdated(payload.lastDataUpdate || new Date().toISOString());
        }
      } catch (err) {
        console.error("Failed to parse SSE payload message:", err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [addToast]);

  return (
    <StreamContext.Provider value={{ satellites, conjunctionEvents, lastUpdated, connectionStatus }}>
      {children}
    </StreamContext.Provider>
  );
}

export function useOrbitStream() {
  const context = React.useContext(StreamContext);
  if (!context) {
    throw new Error("useOrbitStream must be used within a StreamProvider");
  }
  return context;
}
