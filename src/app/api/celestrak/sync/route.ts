import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchCelesTrakCatalogs } from "@/lib/celestrak";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Fetch top 50 active satellites and top 50 debris from CelesTrak
    const { active, debris } = await fetchCelesTrakCatalogs(50);
    
    // Load them into DB and re-screen conjunctions
    db.updateDataFromCatalogs(active, debris);

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${db.getSatellites().length} objects (active & debris) from CelesTrak and re-ran conjunction screening.`,
      satellites: db.getSatellites(),
      conjunctionsCount: db.getConjunctionEvents().length
    });
  } catch (error: any) {
    console.error("Error during CelesTrak sync:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Unknown error during sync" },
      { status: 500 }
    );
  }
}
