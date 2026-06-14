import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const satellites = db.getSatellites();
    return NextResponse.json(satellites);
  } catch (error) {
    console.error("API error fetching satellites:", error);
    return NextResponse.json(
      { error: "Failed to fetch satellites" },
      { status: 500 }
    );
  }
}
