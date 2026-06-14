import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateOrbitalPeriod } from "@/lib/orbital-physics";
import { ConjunctionEvent } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Helper to send SSE event formatted properly
  const sendEvent = (type: string, data: any) => {
    try {
      const sseMessage = `event: data_update\ndata: ${JSON.stringify({ type, payload: data })}\n\n`;
      writer.write(encoder.encode(sseMessage));
    } catch (e) {
      console.error("Error writing to SSE stream:", e);
    }
  };

  // On connection: send initial state immediately
  sendEvent("satellite_update", db.getSatellites());
  
  const events = db.getConjunctionEvents();
  const redAlerts = events.filter((e) => e.status === "active" && e.riskLevel === "red");
  sendEvent("status_update", {
    status: redAlerts.length > 0 ? "critical" : "nominal",
    activeAlerts: redAlerts.length,
    lastDataUpdate: new Date().toISOString()
  });

  // Run update loop every 30 seconds
  const intervalId = setInterval(() => {
    try {
      // 1. Orbital progression: update longitude for each satellite
      const satellites = db.getSatellites();
      satellites.forEach((sat) => {
        const period = calculateOrbitalPeriod(sat.altitude);
        const deltaLon = (0.5 / period) * 360; // 30 sec = 0.5 min
        sat.longitude = parseFloat(((sat.longitude + deltaLon) % 360).toFixed(4));
        sat.lastUpdated = new Date().toISOString();
      });
      sendEvent("satellite_update", satellites);

      // 2. Conjunction detection (5% random chance per update)
      if (Math.random() < 0.05) {
        const activeSats = satellites.filter((s) => s.objectType === "satellite" && s.riskLevel !== "red");
        if (activeSats.length > 0) {
          const targetSat = activeSats[Math.floor(Math.random() * activeSats.length)];
          
          const idNum = Math.floor(10000 + Math.random() * 90000);
          const debrisId = `DEBRIS-${idNum}`;
          const debrisName = `DEBRIS-${idNum} FRAGMENT`;

          // Standard orbital elements
          const alt = targetSat.altitude + (Math.random() * 2 - 1);
          const sma = 6378.1 + alt;
          
          // Create dummy debris in DB
          const newDebris = {
            id: debrisId,
            name: debrisName,
            noradId: idNum,
            objectType: "debris" as const,
            owner: "Debris",
            altitude: parseFloat(alt.toFixed(2)),
            inclination: targetSat.inclination + parseFloat((Math.random() * 0.05 - 0.025).toFixed(4)),
            eccentricity: 0.001,
            period: targetSat.period,
            velocity: targetSat.velocity,
            longitude: (targetSat.longitude + 0.01) % 360,
            latitude: targetSat.latitude,
            semiMajorAxis: parseFloat(sma.toFixed(2)),
            apogee: parseFloat((sma + 5).toFixed(2)),
            perigee: parseFloat((sma - 5).toFixed(2)),
            riskLevel: "yellow" as const,
            activeConjunctions: 1,
            tleEpoch: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            estimatedMassKg: 10,
            fuelRemainingPct: 0
          };
          
          db.getSatellites().push(newDebris);

          // Insert conjunction event
          const eventId = `CONJ-${targetSat.noradId}-${idNum}`;
          const rawPc = 0.000045 + Math.random() * 0.00005; // ~5e-5 to 1e-4
          
          const newEvent: ConjunctionEvent = {
            id: eventId,
            primaryId: targetSat.id,
            primaryName: targetSat.name,
            secondaryId: debrisId,
            secondaryName: debrisName,
            tca: new Date(Date.now() + 12 * 3600 * 1000 + Math.random() * 24 * 3600 * 1000).toISOString(),
            missDistance: parseFloat((0.8 + Math.random() * 1.5).toFixed(3)),
            missDistanceMeters: Math.round((0.8 + Math.random() * 1.5) * 1000),
            relativeVelocity: parseFloat((10 + Math.random() * 5).toFixed(3)),
            pc: rawPc,
            pcDisplay: `${(rawPc * 1e5).toFixed(2)} × 10⁻⁵`,
            riskLevel: "yellow",
            status: "active",
            detectedAt: new Date().toISOString(),
            source: "computed"
          };
          
          db.getConjunctionEvents().push(newEvent);

          // Update satellite risk level to warning (yellow)
          targetSat.riskLevel = "yellow";
          targetSat.activeConjunctions++;

          // Log incident
          db.addIncidentLog({
            type: "conjunction",
            satelliteId: targetSat.id,
            conjunctionEventId: eventId,
            action: "New conjunction detected",
            outcome: `Potential conjunction with ${newEvent.secondaryName} detected. Pc is ${newEvent.pcDisplay} (warning level).`,
            severity: "medium"
          });

          // Emit new conjunction & trigger toast notification on client
          sendEvent("new_conjunction", { event: newEvent, satellite: targetSat });
          
          // Emit updated satellite list immediately
          sendEvent("satellite_update", db.getSatellites());
        }
      }

      // 3. System status summary update
      const allEvents = db.getConjunctionEvents();
      const redAlertsUpdated = allEvents.filter((e) => e.status === "active" && e.riskLevel === "red");
      sendEvent("status_update", {
        status: redAlertsUpdated.length > 0 ? "critical" : "nominal",
        activeAlerts: redAlertsUpdated.length,
        lastDataUpdate: new Date().toISOString()
      });

    } catch (err) {
      console.error("Error in SSE loop execution:", err);
    }
  }, 30000);

  // Close resources on abort
  request.signal.addEventListener("abort", () => {
    clearInterval(intervalId);
    try {
      writer.close();
    } catch (_) {}
  });

  return new NextResponse(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}
