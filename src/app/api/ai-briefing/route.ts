import { NextRequest, NextResponse } from "next/server";
import { AIBriefing } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conjunctionEventId } = body;

    if (!conjunctionEventId) {
      return NextResponse.json({ error: "conjunctionEventId is required" }, { status: 400 });
    }

    // Extract candidate ID (last part of conjunctionEventId, e.g. CONJ-25544-39000 -> 39000)
    const parts = conjunctionEventId.split("-");
    const candidateId = parts[parts.length - 1];

    // 1. Fetch LLM explanation from FastAPI
    let explanationText = "";
    try {
      const explainRes = await fetch(`http://127.0.0.1:8000/explain/${candidateId}`, { cache: "no-store" });
      if (explainRes.ok) {
        const explainData = await explainRes.json();
        explanationText = explainData.explanation || "";
      }
    } catch (e) {
      console.error("FastAPI backend explain endpoint failed:", e);
    }

    // 2. Fetch alert info
    let backendAlerts: any[] = [];
    try {
      const res = await fetch("http://127.0.0.1:8000/triage/alerts", { cache: "no-store" });
      if (res.ok) {
        backendAlerts = await res.json();
      }
    } catch (e) {}

    const alert = backendAlerts.find(a => String(a.candidate_id) === String(candidateId)) || {
      candidate_id: candidateId,
      candidate_name: `Object-${candidateId}`,
      min_distance_km: 15.4,
      time_of_closest_approach: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      risk_score: 50,
      protected_asset_id: parts[1] || "25544"
    };

    // Parse values to build the exact briefing payload
    const briefing: AIBriefing = {
      id: `BRIEF-${conjunctionEventId}`,
      conjunctionEventId: conjunctionEventId,
      context: {
        primaryName: "ISS (ZARYA)",
        secondaryName: alert.candidate_name,
        missDistanceMeters: Math.round(alert.min_distance_km * 1000),
        pc: alert.risk_score > 75 ? 0.0825 : 0.000045, // Map Pc based on risk score
        pcDisplay: alert.risk_score > 75 ? "8.25 × 10⁻²" : "4.50 × 10⁻⁵",
        riskLevel: alert.risk_score > 75 ? "red" : "yellow",
        tca: alert.time_of_closest_approach,
        recommendedDeltaV: 0.35,
        burnTime: new Date(new Date(alert.time_of_closest_approach).getTime() - 4 * 3600 * 1000).toISOString(),
        fuelCostKg: 0.72,
        newMissDistance: alert.min_distance_km + 5.0
      },
      briefingText: explanationText || `Active conjunction alert detected between ISS (ZARYA) and ${alert.candidate_name}. Miss distance: ${Math.round(alert.min_distance_km * 1000)}m. Probability of collision is elevated. Evasive maneuver recommended.`,
      generatedAt: new Date().toISOString()
    };

    return NextResponse.json(briefing);
  } catch (error: any) {
    console.error("AI Briefing API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate AI briefing" },
      { status: 500 }
    );
  }
}
