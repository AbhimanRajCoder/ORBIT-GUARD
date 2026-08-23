import { NextRequest, NextResponse } from "next/server";
import { ConjunctionEvent, Satellite, ManeuverPlan } from "@/types";
import { BACKEND_API_URL } from "@/lib/config";
import { parseCatalog, FALLBACK_ACTIVE_TLES, FALLBACK_DEBRIS_TLES } from "@/lib/celestrak";
import { propagateTLE, propagateTLEToGeodetic } from "@/lib/sgp4-propagator";
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conjunctionEventId } = body;

    if (!conjunctionEventId) {
      return NextResponse.json({ error: "conjunctionEventId is required" }, { status: 400 });
    }

    // Extract candidate NORAD ID from conjunctionEventId (e.g. CONJ-25544-39000 -> 39000)
    const parts = conjunctionEventId.split("-");
    const candidateId = parts[parts.length - 1];

    // 1. Trigger backend solver
    let backendOptions: any[] = [];
    try {
      const res = await fetch(`${BACKEND_API_URL}/maneuver/${candidateId}/options`, { cache: "no-store" });
      if (res.ok) {
        backendOptions = await res.json();
      }
    } catch (e) {
      console.error("FastAPI backend is offline or unreachable:", e);
    }

    // Fetch compare data
    let comparison: any = null;
    try {
      const res = await fetch(`${BACKEND_API_URL}/compare/${candidateId}`, { cache: "no-store" });
      if (res.ok) {
        comparison = await res.json();
      }
    } catch (e) {
      console.error("FastAPI backend compare failed:", e);
    }

    // 2. Fetch alert info
    let backendAlerts: any[] = [];
    try {
      const res = await fetch(`${BACKEND_API_URL}/triage/alerts`, { cache: "no-store" });
      if (res.ok) {
        backendAlerts = await res.json();
      }
    } catch (e) {}

    const alert = backendAlerts.find(a => a.candidate_id === candidateId);
    if (!alert) {
      return NextResponse.json({ error: `Conjunction event candidate ${candidateId} not found in database.` }, { status: 404 });
    }

    // 3. Build ConjunctionEvent
    const isDebris = alert.candidate_name.includes("DEBRIS") || alert.candidate_name.includes("FRAGMENT") || alert.candidate_name.includes("R/B") || alert.candidate_name.includes("ROCKET");
    const primaryId = `SAT-${alert.protected_asset_id}`;
    const secondaryId = `${isDebris ? "DEBRIS" : "SAT"}-${alert.candidate_id}`;
    const pc = alert.risk_score > 75 
      ? 1e-4 + (alert.risk_score - 75) * 5e-4 
      : 1e-5 + alert.risk_score * 1.5e-6;

    const event: ConjunctionEvent = {
      id: conjunctionEventId,
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
      source: "computed"
    };

    // 4. Build Satellite details
    let rawTLEs: Array<{ name: string; norad_id: string; line1: string; line2: string }> = [];
    if (fs.existsSync(BACKEND_CACHE)) {
      try {
        const cached = JSON.parse(fs.readFileSync(BACKEND_CACHE, "utf-8"));
        rawTLEs = cached.satellites || [];
      } catch (e) {}
    }

    // Lookup protected asset TLE
    let protectedTle: { name: string; line1: string; line2: string } | undefined = rawTLEs.find(s => s.norad_id === alert.protected_asset_id);
    if (!protectedTle) {
      const parsedActive = parseCatalog(FALLBACK_ACTIVE_TLES);
      protectedTle = parsedActive.find(t => t.noradId === parseInt(alert.protected_asset_id, 10));
    }

    const now = new Date();
    let satellite: Satellite;

    if (protectedTle) {
      const geodetic = propagateTLEToGeodetic(protectedTle.line1, protectedTle.line2, now);
      const state = propagateTLE(protectedTle.line1, protectedTle.line2, now);
      const alt = geodetic ? geodetic.altitude : 418.5;
      const semiMajorAxis = 6378.1 + alt;
      const inclination = parseFloat(protectedTle.line2.substring(8, 16).trim()) || 51.64;

      satellite = {
        id: primaryId,
        name: protectedTle.name.trim(),
        noradId: parseInt(alert.protected_asset_id, 10),
        objectType: "satellite",
        owner: inferOwner(protectedTle.name),
        altitude: parseFloat(alt.toFixed(2)),
        inclination: parseFloat(inclination.toFixed(4)),
        eccentricity: 0.0005,
        period: 92.8,
        velocity: 7.66,
        longitude: geodetic ? geodetic.longitude : 0,
        latitude: geodetic ? geodetic.latitude : 0,
        semiMajorAxis: parseFloat(semiMajorAxis.toFixed(2)),
        apogee: parseFloat((semiMajorAxis + 5).toFixed(2)),
        perigee: parseFloat((semiMajorAxis - 5).toFixed(2)),
        riskLevel: alert.risk_score > 75 ? "red" : "yellow",
        activeConjunctions: 1,
        tleEpoch: now.toISOString(),
        lastUpdated: now.toISOString(),
        tleLine1: protectedTle.line1,
        tleLine2: protectedTle.line2,
        estimatedMassKg: 500,
        fuelRemainingPct: 100
      };
    } else {
      satellite = {
        id: primaryId,
        name: "ISS (ZARYA)",
        noradId: 25544,
        objectType: "satellite",
        owner: "NASA/Roscosmos",
        altitude: 418.5,
        inclination: 51.64,
        eccentricity: 0.0005,
        period: 92.8,
        velocity: 7.66,
        longitude: 0,
        latitude: 0,
        semiMajorAxis: 6796.6,
        apogee: 6801.6,
        perigee: 6791.6,
        riskLevel: "green",
        activeConjunctions: 1,
        tleEpoch: now.toISOString(),
        lastUpdated: now.toISOString(),
        estimatedMassKg: 500,
        fuelRemainingPct: 100
      };
    }

    // 5. Map ManeuverOption[] to ManeuverPlan[]
    const options: ManeuverPlan[] = backendOptions.map((opt: any) => {
      let typeCode = "BAL";
      let targetMiss = 5.0;
      if (opt.label === "small burn") {
        typeCode = "MIN";
        targetMiss = 2.0;
      } else if (opt.label === "large burn") {
        typeCode = "MAX";
        targetMiss = 12.0;
      }

      const planId = `MP-${typeCode}-${conjunctionEventId}`;

      // Map unit vector to burn direction string
      const [r, it, ct] = opt.burn_direction || [0.0, 1.0, 0.0];
      let burnDirection: 'prograde' | 'retrograde' | 'radial-in' | 'radial-out' | 'normal' | 'antinormal' = "prograde";
      if (Math.abs(it) > Math.abs(r) && Math.abs(it) > Math.abs(ct)) {
        burnDirection = it > 0 ? "prograde" : "retrograde";
      } else if (Math.abs(r) > Math.abs(it) && Math.abs(r) > Math.abs(ct)) {
        burnDirection = r > 0 ? "radial-out" : "radial-in";
      } else {
        burnDirection = ct > 0 ? "normal" : "antinormal";
      }

      return {
        id: planId,
        conjunctionEventId,
        satelliteId: primaryId,
        burnDirection,
        deltaV: opt.delta_v_ms,
        burnTime: new Date(new Date(event.tca).getTime() - opt.time_to_burn_execution_s * 1000).toISOString(),
        burnTimingNote: `Optimal burn lead time: ${(opt.time_to_burn_execution_s / 3600).toFixed(2)} hours before TCA`,
        currentMissDistance: event.missDistance,
        newMissDistance: opt.resulting_min_distance_km,
        targetMissDistance: targetMiss,
        propellantMassKg: opt.fuel_cost_kg,
        specificImpulse: 220,
        satelliteMassKg: 500,
        status: "proposed",
        createdAt: now.toISOString(),
        cwDivergenceFlag: opt.cw_divergence_flag,
        secondaryConjunctionWarning: opt.secondary_conjunction_warning
      };
    });

    return NextResponse.json({
      options,
      event,
      satellite,
      comparison
    });
  } catch (error) {
    console.error("API error inside maneuvers calculation:", error);
    return NextResponse.json({ error: "Failed to calculate maneuver plans" }, { status: 500 });
  }
}
