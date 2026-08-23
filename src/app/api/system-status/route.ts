import { NextResponse } from "next/server";
import { BACKEND_API_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let backendAlerts: any[] = [];
    try {
      const res = await fetch(`${BACKEND_API_URL}/triage/alerts`, { cache: "no-store" });
      if (res.ok) {
        backendAlerts = await res.json();
      }
    } catch (e) {
      console.error("FastAPI backend is offline or unreachable:", e);
    }

    const criticalEvents = backendAlerts.filter(
      (e: any) => e.risk_score > 75 && e.approval_status === "pending"
    );

    const activeAlerts = criticalEvents.length;
    const status = activeAlerts > 0 ? "critical" : "nominal";
    
    return NextResponse.json({
      status,
      activeAlerts,
      lastDataUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error("System status API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch system status" },
      { status: 500 }
    );
  }
}
