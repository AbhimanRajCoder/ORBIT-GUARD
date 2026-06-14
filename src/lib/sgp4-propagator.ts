// ─────────────────────────────────────────────────────────────
// OrbitGuard v2.0 — SGP4 Propagator Utility
// ─────────────────────────────────────────────────────────────
import * as satellite from "satellite.js";
import { TLEData, ECIState } from "@/types";

export interface GeodeticState {
  latitude: number;  // degrees (-90 to 90)
  longitude: number; // degrees (-180 to 180)
  altitude: number;  // km above sea level
}

/**
 * Propagates a satellite's TLE to a specific Date and returns its ECI position and velocity.
 */
export function propagateTLE(line1: string, line2: string, date: Date): ECIState | null {
  try {
    const satrec = satellite.twoline2satrec(line1, line2);
    const positionAndVelocity = satellite.propagate(satrec, date);
    
    if (!positionAndVelocity) return null;

    const pos = positionAndVelocity.position;
    const vel = positionAndVelocity.velocity;
    
    if (typeof pos === "boolean" || typeof vel === "boolean" || !pos || !vel) {
      return null;
    }
    
    return {
      position: { x: pos.x, y: pos.y, z: pos.z },
      velocity: { x: vel.x, y: vel.y, z: vel.z }
    };
  } catch (error) {
    console.error("Error during SGP4 propagation:", error);
    return null;
  }
}

/**
 * Propagates a satellite's TLE to a specific Date and returns Geodetic coordinates (lat, lon, alt).
 */
export function propagateTLEToGeodetic(line1: string, line2: string, date: Date): GeodeticState | null {
  try {
    const satrec = satellite.twoline2satrec(line1, line2);
    const positionAndVelocity = satellite.propagate(satrec, date);
    
    if (!positionAndVelocity) return null;

    const pos = positionAndVelocity.position;
    if (typeof pos === "boolean" || !pos) {
      return null;
    }
    
    const gmst = satellite.gstime(date);
    // eciToGeodetic returns positions in radians for lat/lon, height in km
    const positionGd = satellite.eciToGeodetic(pos as satellite.EciVec3<number>, gmst);
    
    let longitude = satellite.degreesLong(positionGd.longitude);
    let latitude = satellite.degreesLat(positionGd.latitude);
    
    // Normalize longitude to -180 to 180 range
    if (longitude > 180) longitude -= 360;
    if (longitude < -180) longitude += 360;
    
    return {
      latitude: parseFloat(latitude.toFixed(6)),
      longitude: parseFloat(longitude.toFixed(6)),
      altitude: parseFloat(positionGd.height.toFixed(3))
    };
  } catch (error) {
    console.error("Error during Geodetic propagation:", error);
    return null;
  }
}

/**
 * Generates an array of ECI positions representing the satellite's orbital track over a duration.
 * Typically 1 full orbital period or a subset, to draw the orbit on the globe.
 * @param periodMinutes Orbital period in minutes.
 * @param steps Number of points along the orbit to generate (e.g. 60 or 120 points).
 */
export function generateOrbitalTrack(
  line1: string,
  line2: string,
  startDate: Date,
  periodMinutes: number,
  steps: number = 100
): { x: number; y: number; z: number }[] {
  const points: { x: number; y: number; z: number }[] = [];
  const satrec = satellite.twoline2satrec(line1, line2);
  const periodMs = periodMinutes * 60 * 1000;
  const stepSizeMs = periodMs / steps;

  for (let i = 0; i <= steps; i++) {
    const time = new Date(startDate.getTime() + i * stepSizeMs);
    const positionAndVelocity = satellite.propagate(satrec, time);
    if (!positionAndVelocity) continue;
    const pos = positionAndVelocity.position;
    if (pos && typeof pos !== "boolean") {
      points.push({ x: pos.x, y: pos.y, z: pos.z });
    }
  }

  return points;
}
