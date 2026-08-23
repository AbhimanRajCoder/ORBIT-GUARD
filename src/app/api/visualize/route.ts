import { NextRequest, NextResponse } from "next/server";
import { BACKEND_API_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const candidateId = searchParams.get("candidate_id");
    const windowHours = searchParams.get("window_hours") || "6";
    const stepSeconds = searchParams.get("step_seconds") || "60";

    const optionLabel = searchParams.get("option_label");

    if (!candidateId) {
      return NextResponse.json({ error: "candidate_id is required" }, { status: 400 });
    }

    let url = `${BACKEND_API_URL}/visualize/${candidateId}?window_hours=${windowHours}&step_seconds=${stepSeconds}`;
    if (optionLabel) {
      url += `&option_label=${encodeURIComponent(optionLabel)}`;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text || "Failed to fetch from backend" }, { status: res.status });
    }
    const data = await res.json();
    console.log("API /visualize fetched data:", JSON.stringify(data, null, 2));
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in proxy visualize:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
