import { NextRequest, NextResponse } from "next/server";
import { parseCatalog, FALLBACK_ACTIVE_TLES, FALLBACK_DEBRIS_TLES } from "@/lib/celestrak";
import { BACKEND_API_URL } from "@/lib/config";
import { propagateTLE, propagateTLEToGeodetic } from "@/lib/sgp4-propagator";
import { calculateOrbitalPeriod } from "@/lib/orbital-physics";
import { Satellite, ConjunctionEvent } from "@/types";
import fs from "fs";

export const dynamic = "force-dynamic";

const BACKEND_CACHE = process.cwd() + "/backend/data/tle_cache_active.json";

function inferOwner(name: string): string {
  const n = name.toUpperCase();
  if (n.includes("STARLINK")) return "SpaceX";
  if (n.includes("ONEWEB")) return "OneWeb";
  if (n.includes("ISS")) return "NASA/Roscosmos";
  if (n.includes("NOAA")) return "NOAA";
  if (n.includes("FENGYUN")) return "CNSA";
  if (n.includes("COSMOS")) return "Roscosmos";
  return "Unknown";
}

function formatExponent(num: number) {
  const expStr = num.toExponential(2);
  const [coeff, exp] = expStr.split("e");
  const expNum = parseInt(exp, 10);
  const superscriptMap: Record<string, string> = {
    "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹"
  };
  const expSuperscript = String(expNum).split("").map(c => superscriptMap[c] || c).join("");
  return `${coeff} × 10${expSuperscript}`;
}

async function fetchAlerts() {
  try {
    const res = await fetch(`${BACKEND_API_URL}/triage/alerts`, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error("Stream SSE failed to fetch alerts from backend:", e);
  }
  return [];
}

export async function GET(request: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (type: string, data: any) => {
    try {
      const sseMessage = `event: data_update\ndata: ${JSON.stringify({ type, payload: data })}\n\n`;
      await writer.write(encoder.encode(sseMessage));
    } catch (e) {
      console.error("Error writing to SSE stream:", e);
    }
  };

  // 1. Initial TLE fetch and mapping
  const now = new Date();
  let rawTLEs: Array<{ name: string; norad_id: string; line1: string; line2: string }> = [];
  if (fs.existsSync(BACKEND_CACHE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(BACKEND_CACHE, "utf-8"));
      rawTLEs = cached.satellites || [];
    } catch (e) {}
  }

  const parsedActive = parseCatalog(FALLBACK_ACTIVE_TLES);
  const parsedDebris = parseCatalog(FALLBACK_DEBRIS_TLES);
  const fallbackMap = new Map<number, any>();
  if (rawTLEs.length === 0) {
    parsedActive.forEach(t => fallbackMap.set(t.noradId, { name: t.name, line1: t.line1, line2: t.line2, type: "satellite" }));
    parsedDebris.forEach(t => fallbackMap.set(t.noradId, { name: t.name, line1: t.line1, line2: t.line2, type: "debris" }));
  }

  const satellites: Satellite[] = [];
  let backendAlerts = await fetchAlerts();

  if (rawTLEs.length > 0) {
    const conjunctionNoradIds = new Set<string>();
    backendAlerts.forEach((a: any) => {
      conjunctionNoradIds.add(a.protected_asset_id);
      conjunctionNoradIds.add(a.candidate_id);
    });

    const processedSats = rawTLEs.filter(s => conjunctionNoradIds.has(s.norad_id) || Math.random() < 0.05).slice(0, 300);

    for (const t of processedSats) {
      const noradId = parseInt(t.norad_id, 10);
      const name = t.name.trim();
      const isDebris = name.includes("DEBRIS") || name.includes("FRAGMENT") || name.includes("R/B") || name.includes("ROCKET");
      const type = isDebris ? "debris" : "satellite";
      const id = `${type === "satellite" ? "SAT" : "DEBRIS"}-${noradId}`;

      const geodetic = propagateTLEToGeodetic(t.line1, t.line2, now);
      const state = propagateTLE(t.line1, t.line2, now);
      if (!geodetic || !state) continue;

      const alt = geodetic.altitude;
      const semiMajorAxis = 6378.1 + alt;
      const eccentricity = 0.001;

      satellites.push({
        id,
        name,
        noradId,
        objectType: type,
        owner: type === "satellite" ? inferOwner(name) : "Debris",
        altitude: parseFloat(alt.toFixed(2)),
        inclination: parseFloat(t.line2.substring(8, 16).trim()) || 0,
        eccentricity,
        period: 90,
        velocity: 7.5,
        longitude: geodetic.longitude,
        latitude: geodetic.latitude,
        semiMajorAxis: parseFloat(semiMajorAxis.toFixed(2)),
        apogee: parseFloat((6378.1 + alt).toFixed(2)),
        perigee: parseFloat((6378.1 + alt).toFixed(2)),
        riskLevel: "green",
        activeConjunctions: 0,
        tleEpoch: now.toISOString(),
        lastUpdated: now.toISOString(),
        tleLine1: t.line1,
        tleLine2: t.line2,
        estimatedMassKg: 500,
        fuelRemainingPct: 100
      });
    }
  }

  // Initial updates send
  sendEvent("satellite_update", satellites);

  const redAlerts = backendAlerts.filter((e: any) => e.risk_score > 75 && e.approval_status === "pending");
  sendEvent("status_update", {
    status: redAlerts.length > 0 ? "critical" : "nominal",
    activeAlerts: redAlerts.length,
    lastDataUpdate: new Date().toISOString()
  });

  // Track last known status and lifecycle length for each candidate alert
  const knownEventsMap = new Map<string, { status: string; lifecycleLength: number }>();
  backendAlerts.forEach((a: any) => {
    knownEventsMap.set(a.candidate_id, {
      status: a.approval_status === "approved" ? "resolved" : "active",
      lifecycleLength: a.lifecycle ? a.lifecycle.length : 1
    });
  });

  // Run update loop every 5 seconds for rapid real-time updates
  const intervalId = setInterval(async () => {
    try {
      // 1. Orbital progression: update longitude
      satellites.forEach((sat) => {
        const period = calculateOrbitalPeriod(sat.altitude);
        const deltaLon = (0.0833 / period) * 360; // 5 sec = 0.0833 min
        sat.longitude = parseFloat(((sat.longitude + deltaLon) % 360).toFixed(4));
        sat.lastUpdated = new Date().toISOString();
      });
      sendEvent("satellite_update", satellites);

      // 2. Poll conjunctions from backend
      const latestAlerts = await fetchAlerts();
      latestAlerts.forEach((alert: any) => {
        const isDebris = alert.candidate_name.includes("DEBRIS") || alert.candidate_name.includes("FRAGMENT") || alert.candidate_name.includes("R/B") || alert.candidate_name.includes("ROCKET");
        const primaryId = `SAT-${alert.protected_asset_id}`;
        const secondaryId = `${isDebris ? "DEBRIS" : "SAT"}-${alert.candidate_id}`;
        const pc = alert.risk_score > 75 
          ? 1e-4 + (alert.risk_score - 75) * 5e-4 
          : 1e-5 + alert.risk_score * 1.5e-6;

        const conjEvent: ConjunctionEvent = {
          id: `CONJ-${alert.protected_asset_id}-${alert.candidate_id}`,
          primaryId,
          primaryName: "ISS (ZARYA)",
          secondaryId,
          secondaryName: alert.candidate_name,
          tca: alert.time_of_closest_approach,
          missDistance: parseFloat(alert.min_distance_km.toFixed(3)),
          missDistanceMeters: Math.round(alert.min_distance_km * 1000),
          relativeVelocity: 11.24,
          pc,
          pcDisplay: formatExponent(pc),
          riskLevel: alert.risk_score > 75 ? "red" : "yellow",
          status: alert.approval_status === "approved" ? "resolved" : "active",
          detectedAt: alert.created_at,
          source: "computed",
          lifecycle: alert.lifecycle || []
        };

        const existingState = knownEventsMap.get(alert.candidate_id);

        if (!existingState) {
          // New conjunction detected
          knownEventsMap.set(alert.candidate_id, {
            status: conjEvent.status,
            lifecycleLength: conjEvent.lifecycle ? conjEvent.lifecycle.length : 1
          });

          const satObj = satellites.find(s => s.noradId === parseInt(alert.protected_asset_id, 10));
          if (satObj) {
            satObj.riskLevel = alert.risk_score > 75 ? "red" : "yellow";
            sendEvent("new_conjunction", { event: conjEvent, satellite: satObj });
          }
        } else {
          // Existing conjunction: check for state/lifecycle updates
          const currentStatus = conjEvent.status;
          const currentLifecycleLength = conjEvent.lifecycle ? conjEvent.lifecycle.length : 1;

          if (existingState.status !== currentStatus || existingState.lifecycleLength !== currentLifecycleLength) {
            // Update tracking map
            knownEventsMap.set(alert.candidate_id, {
              status: currentStatus,
              lifecycleLength: currentLifecycleLength
            });

            // Push real-time transition update
            sendEvent("conjunction_update", conjEvent);
          }
        }
      });

      // 3. System status summary update
      const redAlertsUpdated = latestAlerts.filter((e: any) => e.risk_score > 75 && e.approval_status === "pending");
      sendEvent("status_update", {
        status: redAlertsUpdated.length > 0 ? "critical" : "nominal",
        activeAlerts: redAlertsUpdated.length,
        lastDataUpdate: new Date().toISOString()
      });

    } catch (err) {
      console.error("Error in SSE loop execution:", err);
    }
  }, 5000);

  request.signal.addEventListener("abort", () => {
    clearInterval(intervalId);
    try {
      writer.close();
    } catch (_) {}
  });

  return new NextResponse(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}
