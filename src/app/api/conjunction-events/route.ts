import { NextResponse } from "next/server";
import { ConjunctionEvent } from "@/types";
import { BACKEND_API_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

function formatExponent(num: number) {
  const expStr = num.toExponential(2); // e.g. "4.50e-5"
  const [coeff, exp] = expStr.split("e");
  const expNum = parseInt(exp, 10);
  const superscriptMap: Record<string, string> = {
    "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹"
  };
  const expSuperscript = String(expNum).split("").map(c => superscriptMap[c] || c).join("");
  return `${coeff} × 10${expSuperscript}`;
}

export async function GET() {
  try {
    // 1. Fetch active alerts from FastAPI backend
    let backendAlerts: any[] = [];
    try {
      const res = await fetch(`${BACKEND_API_URL}/triage/alerts`, { cache: "no-store" });
      if (res.ok) {
        backendAlerts = await res.json();
      }
    } catch (e) {
      console.error("FastAPI backend is offline or unreachable:", e);
    }

    const events: ConjunctionEvent[] = backendAlerts.map((alert: any) => {
      const isDebris = alert.candidate_name.includes("DEBRIS") || alert.candidate_name.includes("FRAGMENT") || alert.candidate_name.includes("R/B") || alert.candidate_name.includes("ROCKET");
      const primaryId = `SAT-${alert.protected_asset_id}`;
      const secondaryId = `${isDebris ? "DEBRIS" : "SAT"}-${alert.candidate_id}`;

      // Calculate Pc based on risk score
      const pc = alert.risk_score > 75 
        ? 1e-4 + (alert.risk_score - 75) * 5e-4 
        : 1e-5 + alert.risk_score * 1.5e-6;

      const eventId = `CONJ-${alert.protected_asset_id}-${alert.candidate_id}`;

      return {
        id: eventId,
        primaryId,
        primaryName: "ISS (ZARYA)", // Default asset name or we look up in TLEs
        secondaryId,
        secondaryName: alert.candidate_name,
        tca: alert.time_of_closest_approach,
        missDistance: parseFloat(alert.min_distance_km.toFixed(3)),
        missDistanceMeters: Math.round(alert.min_distance_km * 1000),
        relativeVelocity: 11.24, // Realistic default relative speed in km/s
        pc,
        pcDisplay: formatExponent(pc),
        riskLevel: alert.risk_score > 75 ? "red" : "yellow",
        status: alert.approval_status === "approved" ? "resolved" : "active",
        detectedAt: alert.created_at,
        source: "computed",
        lifecycle: alert.lifecycle || []
      };
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("API error fetching conjunction events:", error);
    return NextResponse.json(
      { error: "Failed to fetch conjunction events" },
      { status: 500 }
    );
  }
}
