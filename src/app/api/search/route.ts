import { NextRequest, NextResponse } from "next/server";
import { parseCatalog, FALLBACK_ACTIVE_TLES, FALLBACK_DEBRIS_TLES } from "@/lib/celestrak";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase().trim() || "";

    if (!query) {
      return NextResponse.json({ satellites: [], events: [], logs: [] });
    }

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

    // 2. Filter satellites by query
    const parsedActive = parseCatalog(FALLBACK_ACTIVE_TLES);
    const parsedDebris = parseCatalog(FALLBACK_DEBRIS_TLES);
    const allTLEs = [...parsedActive, ...parsedDebris];

    const satellites = allTLEs.filter(sat => 
      sat.name.toLowerCase().includes(query) ||
      sat.noradId.toString().includes(query)
    ).slice(0, 3).map(tle => {
      const isDebris = tle.name.includes("DEBRIS") || tle.name.includes("FRAGMENT");
      const type = isDebris ? "debris" : "satellite";
      return {
        id: `${type === "satellite" ? "SAT" : "DEBRIS"}-${tle.noradId}`,
        name: tle.name,
        noradId: tle.noradId,
        objectType: type,
        owner: isDebris ? "Debris" : "Unknown"
      };
    });

    // 3. Filter events by query
    const events = backendAlerts.filter(event => 
      event.candidate_id.toLowerCase().includes(query) ||
      event.candidate_name.toLowerCase().includes(query) ||
      event.protected_asset_id.toLowerCase().includes(query)
    ).slice(0, 3).map(alert => {
      const isDebris = alert.candidate_name.includes("DEBRIS");
      const primaryId = `SAT-${alert.protected_asset_id}`;
      const secondaryId = `${isDebris ? "DEBRIS" : "SAT"}-${alert.candidate_id}`;

      return {
        id: `CONJ-${alert.protected_asset_id}-${alert.candidate_id}`,
        primaryId,
        primaryName: "ISS (ZARYA)",
        secondaryId,
        secondaryName: alert.candidate_name,
        tca: alert.time_of_closest_approach,
        missDistanceMeters: Math.round(alert.min_distance_km * 1000),
        riskLevel: alert.risk_score > 75 ? "red" : "yellow"
      };
    });

    // 4. Mock logs search (logs are not saved in backend db, but we can return empty or simple logs)
    const logs: any[] = [];

    return NextResponse.json({ satellites, events, logs });
  } catch (error) {
    console.error("Search API execution failed:", error);
    return NextResponse.json(
      { error: "Search query failed" },
      { status: 500 }
    );
  }
}
