import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase().trim() || "";

    if (!query) {
      return NextResponse.json({ satellites: [], events: [], logs: [] });
    }

    // 1. Search satellites by name, owner, or NORAD ID
    const satellites = db.getSatellites().filter(sat => 
      sat.name.toLowerCase().includes(query) ||
      sat.owner.toLowerCase().includes(query) ||
      sat.noradId.toString().includes(query)
    ).slice(0, 3);

    // 2. Search conjunction events by ID, secondary name, or primary ID
    const events = db.getConjunctionEvents().filter(event => 
      event.id.toLowerCase().includes(query) ||
      event.secondaryName.toLowerCase().includes(query) ||
      event.primaryId.toLowerCase().includes(query)
    ).slice(0, 3);

    // 3. Search incident logs by ID, action, outcome, or satellite ID
    const logs = db.getIncidentLogs().filter(log => 
      log.id.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      log.outcome.toLowerCase().includes(query) ||
      (log.satelliteId && log.satelliteId.toLowerCase().includes(query))
    ).slice(0, 3);

    return NextResponse.json({ satellites, events, logs });
  } catch (error) {
    console.error("Search API execution failed:", error);
    return NextResponse.json(
      { error: "Search query failed" },
      { status: 500 }
    );
  }
}
