import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const events = db.getConjunctionEvents();
    
    // Determine active critical (red) alerts
    const criticalEvents = events.filter(
      (e) => e.status === "active" && e.riskLevel === "red"
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
