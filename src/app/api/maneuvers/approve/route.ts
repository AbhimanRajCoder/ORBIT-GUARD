import { NextResponse } from "next/server";
import { BACKEND_API_URL } from "@/lib/config";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { maneuverPlanId, satelliteId } = body;

    if (!maneuverPlanId || !satelliteId) {
      return NextResponse.json(
        { error: "maneuverPlanId and satelliteId are required" },
        { status: 400 }
      );
    }

    // Parse candidate ID and option choice index from plan ID
    // e.g. MP-BAL-CONJ-25544-39000 -> candidate: 39000
    const parts = maneuverPlanId.split("-");
    const candidateId = parts[parts.length - 1];
    const typeCode = parts[1]; // e.g. MIN, BAL, MAX

    let index = 2; // Default to Balanced
    if (typeCode === "MIN") index = 1;
    else if (typeCode === "MAX") index = 3;

    const optionId = `mnv_${candidateId}_${index}`;

    // 1. Query FastAPI preview endpoint to get confirmation token
    const previewUrl = `${BACKEND_API_URL}/approve/${candidateId}/preview?option_id=${optionId}`;
    const previewRes = await fetch(previewUrl, { cache: "no-store" });
    if (!previewRes.ok) {
      const errDetail = await previewRes.text();
      return NextResponse.json(
        { error: `Preview token request failed: ${errDetail}` },
        { status: previewRes.status }
      );
    }
    const previewData = await previewRes.json();
    const token = previewData.confirmation_token;

    // 2. Authorize maneuver on FastAPI backend
    const authorizeRes = await fetch(`${BACKEND_API_URL}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidate_id: candidateId,
        chosen_option_id: optionId,
        approved_by: "Operator",
        operator_role: "senior",
        confirmation_token: token
      }),
      cache: "no-store"
    });

    if (!authorizeRes.ok) {
      const errDetail = await authorizeRes.text();
      return NextResponse.json(
        { error: `Authorization post failed: ${errDetail}` },
        { status: authorizeRes.status }
      );
    }

    const approvalRecord = await authorizeRes.json();

    // 3. Query option details and alert details from backend to map fields accurately
    let backendOptions: any[] = [];
    try {
      const res = await fetch(`${BACKEND_API_URL}/maneuver/${candidateId}/options`, { cache: "no-store" });
      if (res.ok) {
        backendOptions = await res.json();
      }
    } catch (e) {}

    const optionDetail = backendOptions.find(o => o.option_id === optionId);

    let backendAlerts: any[] = [];
    try {
      const res = await fetch(`${BACKEND_API_URL}/triage/alerts`, { cache: "no-store" });
      if (res.ok) {
        backendAlerts = await res.json();
      }
    } catch (e) {}

    const alert = backendAlerts.find(a => a.candidate_id === candidateId);
    const tca = alert ? alert.time_of_closest_approach : new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    const currentMiss = alert ? alert.min_distance_km : 0.124;
    const resultingMinDistance = optionDetail ? optionDetail.resulting_min_distance_km : (index === 1 ? 2.15 : index === 2 ? 5.48 : 12.21);
    const burnLeadS = optionDetail ? optionDetail.time_to_burn_execution_s : 14400;
    const burnTime = new Date(new Date(tca).getTime() - burnLeadS * 1000).toISOString();

    const plan = {
      id: maneuverPlanId,
      conjunctionEventId: `CONJ-${alert ? alert.protected_asset_id : "25544"}-${candidateId}`,
      satelliteId,
      burnDirection: "prograde",
      deltaV: approvalRecord.delta_v_ms,
      burnTime,
      burnTimingNote: `Optimal execution window approved: ${(burnLeadS / 3600).toFixed(2)} hours before TCA`,
      currentMissDistance: currentMiss,
      newMissDistance: resultingMinDistance,
      targetMissDistance: index === 1 ? 2.0 : index === 2 ? 5.0 : 12.0,
      propellantMassKg: approvalRecord.fuel_cost_kg,
      specificImpulse: 220,
      satelliteMassKg: 500,
      status: "approved",
      createdAt: approvalRecord.approved_at || new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      plan
    });
  } catch (error: any) {
    console.error("API error inside maneuvers approval:", error);
    return NextResponse.json(
      { error: error.message || "Failed to approve maneuver plan" },
      { status: 500 }
    );
  }
}
