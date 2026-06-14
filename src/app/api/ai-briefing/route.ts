import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateManeuverOptions } from "@/lib/orbital-physics";
import { AIBriefing } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conjunctionEventId, maneuverPlanId } = body;

    if (!conjunctionEventId) {
      return NextResponse.json(
        { error: "conjunctionEventId is required" },
        { status: 400 }
      );
    }

    const event = db.getConjunctionEventById(conjunctionEventId);
    if (!event) {
      return NextResponse.json(
        { error: `Conjunction event ${conjunctionEventId} not found` },
        { status: 404 }
      );
    }

    const satellite = db.getSatelliteById(event.primaryId);
    if (!satellite) {
      return NextResponse.json(
        { error: `Satellite ${event.primaryId} not found` },
        { status: 404 }
      );
    }

    // Get the maneuver plan (if exists/passed, otherwise compute options and take balanced)
    let plan = db.getManeuverPlans().find(
      (p) => p.conjunctionEventId === conjunctionEventId && (maneuverPlanId ? p.id === maneuverPlanId : p.status === "approved")
    );

    // If no approved or specified plan, generate proposed options and take balanced
    if (!plan) {
      const options = calculateManeuverOptions(event, satellite);
      plan = options[1]; // balanced option
    }

    // Format TCA and Burn times for briefing text
    const tcaTimeStr = event.tca.slice(11, 19) + " UTC";
    const burnTimeStr = plan.burnTime.slice(11, 19) + " UTC";
    
    const riskUpper = event.riskLevel.toUpperCase();
    const severityWord = event.riskLevel === "red" ? "critical" : "warning";

    // Generate the plain-language briefing matching PRD §5.4
    const briefingText = `${event.id} is an active ${riskUpper} risk conjunction between ${satellite.owner} ${event.primaryName} and ${event.secondaryName}. Closest approach is projected at ${tcaTimeStr}, with a ${severityWord} miss distance of ${event.missDistanceMeters}m and collision probability of ${event.pcDisplay}. A recommended ${plan.burnDirection} burn of ${plan.deltaV.toFixed(2)} m/s executed at ${burnTimeStr} will increase the miss distance to ${plan.newMissDistance.toFixed(2)} km, consuming ${plan.propellantMassKg.toFixed(2)} kg of propellant.`;

    const briefing: AIBriefing = {
      id: `BRIEF-${event.id}`,
      conjunctionEventId: event.id,
      maneuverPlanId: plan.id,
      context: {
        primaryName: event.primaryName,
        secondaryName: event.secondaryName,
        missDistanceMeters: event.missDistanceMeters,
        pc: event.pc,
        pcDisplay: event.pcDisplay,
        riskLevel: event.riskLevel,
        tca: event.tca,
        recommendedDeltaV: plan.deltaV,
        burnTime: plan.burnTime,
        fuelCostKg: plan.propellantMassKg,
        newMissDistance: plan.newMissDistance
      },
      briefingText,
      generatedAt: new Date().toISOString()
    };

    return NextResponse.json(briefing);
  } catch (error) {
    console.error("AI Briefing API error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI briefing" },
      { status: 500 }
    );
  }
}
