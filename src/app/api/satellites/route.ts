import { NextRequest, NextResponse } from "next/server";
import { parseCatalog, FALLBACK_ACTIVE_TLES, FALLBACK_DEBRIS_TLES } from "@/lib/celestrak";
import { propagateTLE, propagateTLEToGeodetic } from "@/lib/sgp4-propagator";
import { Satellite } from "@/types";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const BACKEND_CACHE = "/Users/abhimanraj/ORBIT-GUARD-NEW/backend/data/tle_cache_active.json";

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

export async function GET() {
  try {
    const now = new Date();
    
    // 1. Fetch active alerts from FastAPI backend
    let backendAlerts: any[] = [];
    try {
      const res = await fetch("http://127.0.0.1:8000/triage/alerts", { cache: "no-store" });
      if (res.ok) {
        backendAlerts = await res.json();
      }
    } catch (e) {
      console.error("FastAPI backend is offline or unreachable:", e);
    }

    // 2. Fetch TLEs from cache or fallbacks
    let rawTLEs: Array<{ name: string; norad_id: string; line1: string; line2: string }> = [];
    
    if (fs.existsSync(BACKEND_CACHE)) {
      try {
        const cached = JSON.parse(fs.readFileSync(BACKEND_CACHE, "utf-8"));
        rawTLEs = cached.satellites || [];
      } catch (e) {
        console.error("Error reading backend TLE cache:", e);
      }
    }

    // Fallback to offline defaults if cache is empty or missing
    const parsedActive = parseCatalog(FALLBACK_ACTIVE_TLES);
    const parsedDebris = parseCatalog(FALLBACK_DEBRIS_TLES);
    const fallbackMap = new Map<number, any>();

    if (rawTLEs.length === 0) {
      parsedActive.forEach(t => fallbackMap.set(t.noradId, { name: t.name, line1: t.line1, line2: t.line2, type: "satellite" }));
      parsedDebris.forEach(t => fallbackMap.set(t.noradId, { name: t.name, line1: t.line1, line2: t.line2, type: "debris" }));
    }

    const satellites: Satellite[] = [];

    // Process cached TLEs
    if (rawTLEs.length > 0) {
      // Limit to 200 satellites to keep UI/Map rendering fast and smooth
      // But ALWAYS include the ones involved in conjunctions
      const conjunctionNoradIds = new Set<string>();
      backendAlerts.forEach(a => {
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
        const eccStr = t.line2.substring(26, 33).trim();
        const eccentricity = parseFloat(`0.${eccStr}`) || 0.001;

        const apogee = semiMajorAxis * (1 + eccentricity) - 6378.1;
        const perigee = semiMajorAxis * (1 - eccentricity) - 6378.1;

        const r_mag = Math.sqrt(state.position.x ** 2 + state.position.y ** 2 + state.position.z ** 2);
        const velocity = Math.sqrt(398600.4418 / r_mag);
        const period = 2 * Math.PI * Math.sqrt(semiMajorAxis ** 3 / 398600.4418) / 60;

        satellites.push({
          id,
          name,
          noradId,
          objectType: type,
          owner: type === "satellite" ? inferOwner(name) : "Debris",
          altitude: parseFloat(alt.toFixed(2)),
          inclination: parseFloat(t.line2.substring(8, 16).trim()) || 0,
          eccentricity,
          period: parseFloat(period.toFixed(2)),
          velocity: parseFloat(velocity.toFixed(3)),
          longitude: geodetic.longitude,
          latitude: geodetic.latitude,
          semiMajorAxis: parseFloat(semiMajorAxis.toFixed(2)),
          apogee: parseFloat((6378.1 + apogee).toFixed(2)),
          perigee: parseFloat((6378.1 + perigee).toFixed(2)),
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
    } else {
      // Fallback data mapping
      fallbackMap.forEach((t, noradId) => {
        const id = `${t.type === "satellite" ? "SAT" : "DEBRIS"}-${noradId}`;
        const geodetic = propagateTLEToGeodetic(t.line1, t.line2, now);
        const state = propagateTLE(t.line1, t.line2, now);
        if (!geodetic || !state) return;

        const alt = geodetic.altitude;
        const semiMajorAxis = 6378.1 + alt;
        const ecc = 0.001;

        satellites.push({
          id,
          name: t.name,
          noradId,
          objectType: t.type,
          owner: t.type === "satellite" ? inferOwner(t.name) : "Debris",
          altitude: parseFloat(alt.toFixed(2)),
          inclination: parseFloat(t.line2.substring(8, 16).trim()) || 0,
          eccentricity: ecc,
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
      });
    }

    // 3. Apply risk levels from active backend alerts
    backendAlerts.forEach(alert => {
      const risk: "red" | "yellow" | "green" = alert.risk_score > 75 ? "red" : "yellow";
      
      // Update Candidate
      const candidateSat = satellites.find(s => s.noradId === parseInt(alert.candidate_id, 10));
      if (candidateSat && alert.approval_status === "pending") {
        candidateSat.activeConjunctions++;
        if (risk === "red") candidateSat.riskLevel = "red";
        else if (risk === "yellow" && candidateSat.riskLevel !== "red") candidateSat.riskLevel = "yellow";
      }

      // Update Protected Asset
      const assetSat = satellites.find(s => s.noradId === parseInt(alert.protected_asset_id, 10));
      if (assetSat && alert.approval_status === "pending") {
        assetSat.activeConjunctions++;
        if (risk === "red") assetSat.riskLevel = "red";
        else if (risk === "yellow" && assetSat.riskLevel !== "red") assetSat.riskLevel = "yellow";
      }
    });

    return NextResponse.json(satellites);
  } catch (error) {
    console.error("API error fetching satellites:", error);
    return NextResponse.json({ error: "Failed to fetch satellites" }, { status: 500 });
  }
}
