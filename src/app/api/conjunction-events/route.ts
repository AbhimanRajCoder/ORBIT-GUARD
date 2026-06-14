import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const events = db.getConjunctionEvents();
    return NextResponse.json(events);
  } catch (error) {
    console.error("API error fetching conjunction events:", error);
    return NextResponse.json(
      { error: "Failed to fetch conjunction events" },
      { status: 500 }
    );
  }
}
