import { NextRequest, NextResponse } from "next/server";
import { BACKEND_API_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Call FastAPI triage refresh endpoint
    const refreshRes = await fetch(`${BACKEND_API_URL}/triage/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        protected_asset_ids: ["25544"],
        satellite_group: "active",
        distance_threshold_km: 5.0,
        mission_priority: 1.0
      }),
      cache: "no-store"
    });

    if (!refreshRes.ok) {
      const errDetail = await refreshRes.text();
      return NextResponse.json(
        { success: false, error: `Triage refresh failed: ${errDetail}` },
        { status: refreshRes.status }
      );
    }

    const refreshData = await refreshRes.json();

    return NextResponse.json({
      success: true,
      message: `Successfully synced catalog from CelesTrak and re-ran conjunction screening.`,
      satellites: refreshData.alerts.length,
      conjunctionsCount: refreshData.alerts.length
    });
  } catch (error: any) {
    console.error("Error during CelesTrak sync:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Unknown error during sync" },
      { status: 500 }
    );
  }
}
