import { db } from "@/lib/db";
import { calculateManeuverOptions } from "@/lib/orbital-physics";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { conjunctionEventId } = body;

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

    // Use primaryId from v2.0 ConjunctionEvent schema
    const satellite = db.getSatelliteById(event.primaryId);
    if (!satellite) {
      return NextResponse.json(
        { error: `Satellite ${event.primaryId} not found` },
        { status: 404 }
      );
    }

    // Calculate burn options using the new Clohessy-Wiltshire solver
    const options = calculateManeuverOptions(event, satellite);

    return NextResponse.json({
      options,
      event,
      satellite
    });
  } catch (error) {
    console.error("API error inside maneuvers calculation:", error);
    return NextResponse.json(
      { error: "Failed to calculate maneuver plans" },
      { status: 500 }
    );
  }
}
