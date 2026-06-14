import { db } from "@/lib/db";
import { ManeuverPlan } from "@/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { maneuverPlanId, satelliteId, plan } = body;

    if (!maneuverPlanId || !satelliteId) {
      return NextResponse.json(
        { error: "maneuverPlanId and satelliteId are required" },
        { status: 400 }
      );
    }

    // Save the plan to the DB if passed, otherwise construct a fallback
    let targetPlan = plan as ManeuverPlan;
    if (!targetPlan) {
      const conjId = maneuverPlanId.split("-").slice(2).join("-") || "CONJ-2026-001";
      targetPlan = {
        id: maneuverPlanId,
        conjunctionEventId: conjId,
        satelliteId,
        burnDirection: "prograde",
        deltaV: maneuverPlanId.includes("MIN") ? 0.05 : maneuverPlanId.includes("BAL") ? 0.35 : 0.75,
        burnTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        burnTimingNote: "Calculated fallback window",
        currentMissDistance: 0.124,
        newMissDistance: maneuverPlanId.includes("MIN") ? 2.15 : maneuverPlanId.includes("BAL") ? 5.48 : 10.21,
        targetMissDistance: maneuverPlanId.includes("MIN") ? 2.0 : maneuverPlanId.includes("BAL") ? 5.0 : 10.0,
        propellantMassKg: maneuverPlanId.includes("MIN") ? 0.11 : maneuverPlanId.includes("BAL") ? 0.72 : 1.65,
        specificImpulse: 220,
        satelliteMassKg: 500,
        status: "approved",
        createdAt: new Date().toISOString()
      };
    } else {
      targetPlan.status = "approved";
    }

    // Add to DB
    db.addManeuverPlan(targetPlan);
    
    // Update satellite risk level to safe (green)
    db.updateSatelliteStatus(satelliteId, "green");

    // Update conjunction status to resolved
    db.updateConjunctionStatus(targetPlan.conjunctionEventId, "resolved");

    // Add incident log
    db.addIncidentLog({
      type: "maneuver",
      satelliteId,
      conjunctionEventId: targetPlan.conjunctionEventId,
      action: "Maneuver Approved",
      outcome: `Maneuver plan ${targetPlan.id} approved and scheduled. Fuel consumed: ${targetPlan.propellantMassKg.toFixed(2)} kg. Miss distance updated to ${targetPlan.newMissDistance.toFixed(2)} km.`,
      severity: "low"
    });

    return NextResponse.json({
      success: true,
      plan: targetPlan
    });
  } catch (error) {
    console.error("API error inside maneuvers approval:", error);
    return NextResponse.json(
      { error: "Failed to approve maneuver plan" },
      { status: 500 }
    );
  }
}
