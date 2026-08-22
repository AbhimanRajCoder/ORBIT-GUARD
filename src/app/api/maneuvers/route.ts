import { NextResponse } from "next/server";
import { ManeuverPlan } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Fetch audit logs from backend
    let auditLogs: any[] = [];
    try {
      const res = await fetch("http://127.0.0.1:8000/audit", { cache: "no-store" });
      if (res.ok) {
        auditLogs = await res.json();
      }
    } catch (e) {
      console.error("FastAPI backend is offline or unreachable:", e);
    }

    // 2. Fetch alerts to get conjunction info
    let backendAlerts: any[] = [];
    try {
      const res = await fetch("http://127.0.0.1:8000/triage/alerts", { cache: "no-store" });
      if (res.ok) {
        backendAlerts = await res.json();
      }
    } catch (e) {}

    // Filter audit logs for approvals
    const approvalLogs = auditLogs.filter((log: any) => log.action === "approval_granted");

    const plans: ManeuverPlan[] = approvalLogs.map((log: any) => {
      const payload = log.payload || {};
      const req = payload.request || {};
      const candidateId = req.candidate_id || log.candidate_id;
      const chosenOptionId = req.chosen_option_id || "";

      // Find matching alert
      const alert = backendAlerts.find((a: any) => a.candidate_id === candidateId);
      const protectedAssetId = alert ? alert.protected_asset_id : "25544";
      const tca = alert ? alert.time_of_closest_approach : new Date(Date.now() + 4 * 3600 * 1000).toISOString();
      const currentMissDistance = alert ? alert.min_distance_km : 0.124;

      let typeCode = "BAL";
      let targetMiss = 5.0;
      if (chosenOptionId.endsWith("_1")) {
        typeCode = "MIN";
        targetMiss = 2.0;
      } else if (chosenOptionId.endsWith("_3")) {
        typeCode = "MAX";
        targetMiss = 12.0;
      }

      const planId = `MP-${typeCode}-CONJ-${protectedAssetId}-${candidateId}`;

      return {
        id: planId,
        conjunctionEventId: `CONJ-${protectedAssetId}-${candidateId}`,
        satelliteId: `SAT-${protectedAssetId}`,
        burnDirection: "prograde",
        deltaV: payload.snapshot_delta_v_ms || 0.35,
        burnTime: new Date(new Date(tca).getTime() - 4 * 3600 * 1000).toISOString(),
        burnTimingNote: "Balanced energy-safety window (TCA - 4.0h)",
        currentMissDistance,
        newMissDistance: targetMiss + currentMissDistance,
        targetMissDistance: targetMiss,
        propellantMassKg: payload.snapshot_fuel_cost_kg || 0.72,
        specificImpulse: 220,
        satelliteMassKg: 500,
        status: "approved",
        createdAt: log.timestamp
      };
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error("API error fetching maneuvers:", error);
    return NextResponse.json(
      { error: "Failed to fetch maneuver plans" },
      { status: 500 }
    );
  }
}
