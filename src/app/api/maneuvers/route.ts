import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const plans = db.getManeuverPlans();
    return NextResponse.json(plans);
  } catch (error) {
    console.error("API error fetching maneuvers:", error);
    return NextResponse.json(
      { error: "Failed to fetch maneuver plans" },
      { status: 500 }
    );
  }
}
