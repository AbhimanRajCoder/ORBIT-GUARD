import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let backendAlerts: any[] = [];
    try {
      const res = await fetch("http://127.0.0.1:8000/triage/alerts", { cache: "no-store" });
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
