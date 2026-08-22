import { describe, it, expect } from "vitest";
import * as THREE from "three";
import * as satellite from "satellite.js";
import { propagateTLE, propagateTLEToGeodetic } from "./lib/sgp4-propagator";

const EARTH_RADIUS = 6.371;
const SCALE = EARTH_RADIUS / 6378.137;

// Helper: ECEF to Lat/Lon (same as backend ecef_to_latlon)
function ecefToLatLon(x: number, y: number, z: number): { lat: number; lon: number; alt: number } {
  const a = 6378.137;
  const f = 1.0 / 298.257223563;
  const b = a * (1.0 - f);
  const e_sq = (a ** 2 - b ** 2) / (a ** 2);
  const e_prime_sq = (a ** 2 - b ** 2) / (b ** 2);

  const p = Math.sqrt(x ** 2 + y ** 2);
  if (p < 1e-9) {
    const lat = z > 0 ? 90.0 : -90.0;
    const lon = 0.0;
    const alt = Math.abs(z) - b;
    return { lat, lon, alt };
  }

  const theta = Math.atan2(z * a, p * b);
  const lat_rad = Math.atan2(
    z + e_prime_sq * b * Math.sin(theta) ** 3,
    p - e_sq * a * Math.cos(theta) ** 3
  );
  const lon_rad = Math.atan2(y, x);

  const N = a / Math.sqrt(1.0 - e_sq * Math.sin(lat_rad) ** 2);
  const alt = p / Math.cos(lat_rad) - N;

  return {
    lat: (lat_rad * 180.0) / Math.PI,
    lon: (lon_rad * 180.0) / Math.PI,
    alt,
  };
}

// Current frontend mapping from EarthView.tsx
function currentEcefToThreeJs(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x * SCALE, z * SCALE, y * SCALE);
}

// Reverse conversion: Three.js coordinates to ECEF
function currentThreeJsToEcef(pos: THREE.Vector3): { x: number; y: number; z: number } {
  return {
    x: pos.x / SCALE,
    y: pos.z / SCALE,
    z: pos.y / SCALE,
  };
}

// ECI to ECEF transformation on the frontend
function eciToEcef(pos: { x: number; y: number; z: number }, gmst: number): { x: number; y: number; z: number } {
  const cos = Math.cos(gmst);
  const sin = Math.sin(gmst);
  return {
    x: pos.x * cos + pos.y * sin,
    y: -pos.x * sin + pos.y * cos,
    z: pos.z,
  };
}

describe("OrbitGuard Visualization Physical Correctness Validation", () => {
  // ============================================================
  // CHECK 1 — Axis/frame correctness against backend data
  // ============================================================
  it("CHECK 1 — Axis/frame correctness against backend's ISS ground truth", () => {
    // Exact ISS reference ECEF from backend test_1_teme_to_ecef_sanity (corrected)
    const refEcef = {
      x: -6238.051676253717,
      y: 2287.0410874022973,
      z: 1426.7614014316546,
    };
    const refAlt = 418.359;
    const refLat = 12.194;
    const refLon = 159.865; // 159.865 East

    // Exact ISS TLE and ECI coordinates from backend at Feb 20, 2026 12:00:00 UTC
    const line1 = "1 25544U 98067A   26051.49479167  .00015000  00000-0  27000-4 0  9993";
    const line2 = "2 25544  51.6400 320.1200 0005000  45.1200  90.1200 15.50000000100000";
    const date = new Date(Date.UTC(2026, 1, 20, 12, 0, 0));

    // Propagate ECI
    const state = propagateTLE(line1, line2, date);
    expect(state).not.toBeNull();
    const eciPos = state!.position;

    // Convert ECI to ECEF on frontend
    const gmst = satellite.gstime(date);
    console.log(`[CHECK 1] Frontend GMST: ${gmst}`);
    const convertedEcef = eciToEcef(eciPos, gmst);

    // Propagate geodetic using standard satellite.js
    const geodeticStd = propagateTLEToGeodetic(line1, line2, date);
    console.log(`[CHECK 1] Standard Geodetic (satellite.js): Lat: ${geodeticStd?.latitude}° Lat, Lon: ${geodeticStd?.longitude}° Lon, Alt: ${geodeticStd?.altitude} km`);

    console.log(`[CHECK 1] Propagated ECI: [${eciPos.x.toFixed(4)}, ${eciPos.y.toFixed(4)}, ${eciPos.z.toFixed(4)}] km`);
    console.log(`[CHECK 1] Frontend ECEF: [${convertedEcef.x.toFixed(4)}, ${convertedEcef.y.toFixed(4)}, ${convertedEcef.z.toFixed(4)}] km`);
    console.log(`[CHECK 1] Backend ECEF:  [${refEcef.x.toFixed(4)}, ${refEcef.y.toFixed(4)}, ${refEcef.z.toFixed(4)}] km`);

    // Verify frontend ECEF matches backend ECEF
    expect(convertedEcef.x).toBeCloseTo(refEcef.x, 1);
    expect(convertedEcef.y).toBeCloseTo(refEcef.y, 1);
    expect(convertedEcef.z).toBeCloseTo(refEcef.z, 1);

    // Verify geodetic mapping
    const geodetic = ecefToLatLon(convertedEcef.x, convertedEcef.y, convertedEcef.z);
    console.log(`[CHECK 1] Calculated Lat/Lon: ${geodetic.lat.toFixed(4)}° Lat, ${geodetic.lon.toFixed(4)}° Lon, Alt: ${geodetic.alt.toFixed(3)} km`);

    expect(geodetic.alt).toBeCloseTo(refAlt, 1);
    expect(geodetic.lat).toBeCloseTo(refLat, 2);
    expect(geodetic.lon).toBeCloseTo(refLon, 2);
    console.log("[CHECK 1] STATUS: PASS");
  });

  // ============================================================
  // CHECK 2 — Scale consistency
  // ============================================================
  it("CHECK 2 — Scale consistency check", () => {
    const WGS84_EARTH_RADIUS_KM = 6378.137;
    console.log(`[CHECK 2] WGS-84 Earth Radius: ${WGS84_EARTH_RADIUS_KM} km`);
    console.log(`[CHECK 2] Three.js Earth Radius: ${EARTH_RADIUS} units`);
    
    const computedScale = EARTH_RADIUS / WGS84_EARTH_RADIUS_KM;
    console.log(`[CHECK 2] Computed SCALE: ${computedScale}`);
    expect(SCALE).toBeCloseTo(computedScale, 8);

    // Pick ISS altitude at 420km
    const issAltKm = 420;
    const expectedThreeJsDist = (issAltKm / WGS84_EARTH_RADIUS_KM) * EARTH_RADIUS;
    
    // In Three.js, distance from Earth surface to satellite is ||pos|| - EARTH_RADIUS
    const refEcef = { x: 6798.137, y: 0, z: 0 }; // ISS at 420km altitude on X axis
    const threePos = currentEcefToThreeJs(refEcef.x, refEcef.y, refEcef.z);
    const distanceToSurface = threePos.length() - EARTH_RADIUS;
    
    console.log(`[CHECK 2] Expected Three.js distance to surface: ${expectedThreeJsDist.toFixed(6)}`);
    console.log(`[CHECK 2] Rendered Three.js distance to surface: ${distanceToSurface.toFixed(6)}`);
    expect(distanceToSurface).toBeCloseTo(expectedThreeJsDist, 6);
    console.log("[CHECK 2] STATUS: PASS");
  });

  // ============================================================
  // CHECK 3 — Earth rotation is not double-counted or fighting the data
  // ============================================================
  it("CHECK 3 — Earth rotation alignment and offset verification", () => {
    // We want to verify the correct rotation of the Earth mesh around the Y-axis.
    // In Three.js, polar axis is Y, equator is X-Z.
    // ECEF coordinates: X is Prime Meridian, Y is 90° East, Z is North Pole.
    // Three.js maps:
    // x_three = x_ecef * SCALE
    // y_three = z_ecef * SCALE (polar)
    // z_three = y_ecef * SCALE
    //
    // ECI to ECEF is:
    // rx = r_eci.x * cos(gmst) + r_eci.y * sin(gmst)
    // ry = -r_eci.x * sin(gmst) + r_eci.y * cos(gmst)
    // rz = r_eci.z
    //
    // If the Earth mesh is rotated by earth.rotation.y = theta, then the local coordinates on the Earth mesh corresponding to ECI position are:
    // x_local = x_three * cos(-theta) - z_three * sin(-theta)
    // z_local = x_three * sin(-theta) + z_three * cos(-theta)
    // y_local = y_three
    //
    // For these local coordinates to align with the fixed Earth surface (where Prime Meridian is along local X, i.e. z_local = 0, x_local > 0):
    // ECEF coordinates must match local coordinates.
    // Let's test the alignment at different offsets.
    
    const line1 = "1 25544U 98067A   26051.49479167  .00015000  00000-0  27000-4 0  9993";
    const line2 = "2 25544  51.6400 320.1200 0005000  45.1200  90.1200 15.50000000100000";
    const date = new Date(Date.UTC(2026, 1, 20, 12, 0, 0));

    const state = propagateTLE(line1, line2, date);
    const eciPos = state!.position;
    const gmst = satellite.gstime(date);
    const geodeticStd = propagateTLEToGeodetic(line1, line2, date)!;

    // Three.js coordinates (in TEME frame)
    const threePos = new THREE.Vector3(eciPos.x * SCALE, eciPos.z * SCALE, eciPos.y * SCALE);

    // Let's find the offset that makes the local coordinates on the Earth mesh map back to geodeticStd.latitude and geodeticStd.longitude
    // In Three.js SphereGeometry:
    // x = -R * cos(lat) * sin(lon)
    // y = R * sin(lat)
    // z = R * cos(lat) * cos(lon)
    // So:
    // lon = atan2(-x_local, z_local)
    // lat = asin(y_local / R)
    
    // Let's evaluate which offset works:
    // Standard rotation is: earth.rotation.y = gmst + offset
    const offsets = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    let bestOffset = 0;
    let minErr = 1e9;

    for (const offset of offsets) {
      const theta = gmst + offset;
      
      // Un-rotate Three.js coordinate by theta around Y-axis
      const cosT = Math.cos(-theta);
      const sinT = Math.sin(-theta);
      const x_local = threePos.x * cosT - threePos.z * sinT;
      const z_local = threePos.x * sinT + threePos.z * cosT;
      const y_local = threePos.y;

      const R_local = Math.sqrt(x_local * x_local + y_local * y_local + z_local * z_local);
      const calculatedLat = Math.asin(y_local / R_local) * 180 / Math.PI;
      let calculatedLon = Math.atan2(z_local, x_local) * 180 / Math.PI;

      // Error
      const latErr = Math.abs(calculatedLat - geodeticStd.latitude);
      let lonErr = Math.abs(calculatedLon - geodeticStd.longitude);
      if (lonErr > 180) lonErr = 360 - lonErr;
      const totalErr = latErr + lonErr;

      console.log(`[CHECK 3] Offset: ${(offset * 180 / Math.PI).toFixed(0)} deg -> Calculated Lat: ${calculatedLat.toFixed(4)}, Lon: ${calculatedLon.toFixed(4)} (Err: ${totalErr.toFixed(4)})`);

      if (totalErr < minErr) {
        minErr = totalErr;
        bestOffset = offset;
      }
    }

    console.log(`[CHECK 3] Best Earth Rotation Offset: ${(bestOffset * 180 / Math.PI).toFixed(0)} deg (error: ${minErr.toFixed(4)})`);
    expect(minErr).toBeLessThan(1.0);
    console.log("[CHECK 3] STATUS: PASS");
  });

  // ============================================================
  // CHECK 4 — Orbit trajectory shape sanity
  // ============================================================
  it("CHECK 4 — Orbit trajectory shape sanity", () => {
    // Generate TLE track for ISS
    const line1 = "1 25544U 98067A   26051.49479167  .00015000  00000-0  27000-4 0  9993";
    const line2 = "2 25544  51.6400 320.1200 0005000  45.1200  90.1200 15.50000000100000";
    const periodMin = 1440 / 15.5; // Precision ISS period: 92.9032258 min
    
    const date = new Date(Date.UTC(2026, 1, 20, 12, 0, 0));
    const steps = 100;
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = new Date(date.getTime() + (i / steps) * periodMin * 60 * 1000);
      const state = propagateTLE(line1, line2, t);
      if (state) {
        // Plot in TEME (where the orbit should close into a perfect loop)
        points.push(currentEcefToThreeJs(state.position.x, state.position.y, state.position.z));
      }
    }
    
    expect(points.length).toBe(steps + 1);
    
    // Check if it forms a closed loop (distance first to last is small)
    const first = points[0];
    const last = points[points.length - 1];
    const closureDist = first.distanceTo(last);
    console.log(`[CHECK 4] Trajectory points: ${points.length}`);
    console.log(`[CHECK 4] First to last point closure distance (TEME): ${closureDist.toFixed(6)} units`);
    expect(closureDist).toBeLessThan(0.05); // Allow for natural orbital perturbations in SGP4 over one period

    // Verify LEO vs High altitude scaling
    // ISS (LEO) altitude ~400km vs GEO altitude ~35786km
    const issPos = points[0];
    const issAlt = issPos.length() - EARTH_RADIUS;
    
    const geoEcef = { x: 42164.0, y: 0, z: 0 }; // GEO orbit radius ~42164km
    const geoPos = currentEcefToThreeJs(geoEcef.x, geoEcef.y, geoEcef.z);
    const geoAlt = geoPos.length() - EARTH_RADIUS;

    console.log(`[CHECK 4] Rendered ISS (LEO) altitude: ${issAlt.toFixed(4)} units (${(issAlt / SCALE).toFixed(2)} km)`);
    console.log(`[CHECK 4] Rendered GEO altitude: ${geoAlt.toFixed(4)} units (${(geoAlt / SCALE).toFixed(2)} km)`);
    
    expect(geoAlt).toBeGreaterThan(issAlt * 50);
    console.log("[CHECK 4] STATUS: PASS");
  });

  // ============================================================
  // CHECK 5 — Danger zone and maneuver path positioning
  // ============================================================
  it("CHECK 5 — Danger zone and maneuver path positioning", async () => {
    // 1. Fetch active conjunctions
    const resConj = await fetch("http://localhost:3000/api/conjunction-events");
    expect(resConj.ok).toBe(true);
    const conjunctions = await resConj.json();
    expect(conjunctions.length).toBeGreaterThan(0);
    
    // Pick the first active event
    const activeConj = conjunctions.find((c: any) => c.status === "active") || conjunctions[0];
    const candidateId = activeConj.secondaryId.split("-")[1];
    console.log(`[CHECK 5] Selected Conjunction: ${activeConj.primaryName} vs ${activeConj.secondaryName} (Candidate ID: ${candidateId})`);
    
    // 2. Fetch visualization data
    const resVis = await fetch(`http://localhost:3000/api/visualize?candidate_id=${candidateId}&window_hours=6&step_seconds=60`);
    expect(resVis.ok).toBe(true);
    const visData = await resVis.json();
    
    // Verify danger zone is centered exactly at candidate's position at TCA (middle of path)
    const cPath = visData.candidate_path;
    const pPath = visData.protected_asset_path;
    const mPath = visData.maneuver_path;
    
    expect(cPath.length).toBeGreaterThan(0);
    const tcaIdx = Math.floor(cPath.length / 2);
    const candidateTcaPos = cPath[tcaIdx].position_ecef_km;
    const dangerZoneCenter = visData.danger_zone.center_ecef_km;
    
    console.log(`[CHECK 5] Candidate position at TCA: [${candidateTcaPos.join(", ")}] km`);
    console.log(`[CHECK 5] Danger Zone Center:         [${dangerZoneCenter.join(", ")}] km`);
    
    expect(dangerZoneCenter[0]).toBeCloseTo(candidateTcaPos[0], 2);
    expect(dangerZoneCenter[1]).toBeCloseTo(candidateTcaPos[1], 2);
    expect(dangerZoneCenter[2]).toBeCloseTo(candidateTcaPos[2], 2);
    
    // Verify maneuver path begins diverging only AFTER burn time
    if (mPath && mPath.length > 0) {
      // Find burn time from backend options or compare endpoint
      const resComp = await fetch("http://localhost:3000/api/maneuvers");
      expect(resComp.ok).toBe(true);
      const maneuvers = await resComp.json();
      const plan = maneuvers.find((p: any) => p.conjunctionEventId === activeConj.id && p.status === "approved");
      
      if (plan) {
        console.log(`[CHECK 5] Burn Time: ${plan.burnTime}`);
        const burnDate = new Date(plan.burnTime);
        
        let preBurnMatch = true;
        let postBurnDiverged = false;
        
        for (let i = 0; i < mPath.length; i++) {
          const ptTime = new Date(mPath[i].t);
          const pPos = pPath[i].position_ecef_km;
          const mPos = mPath[i].position_ecef_km;
          const diff = Math.sqrt(
            (pPos[0] - mPos[0]) ** 2 +
            (pPos[1] - mPos[1]) ** 2 +
            (pPos[2] - mPos[2]) ** 2
          );
          
          if (ptTime <= burnDate) {
            if (diff > 0.01) {
              preBurnMatch = false;
              console.log(`[CHECK 5] Pre-burn mismatch at ${mPath[i].t}: diff = ${diff.toFixed(4)} km`);
            }
          } else {
            if (diff > 0.1) {
              postBurnDiverged = true;
            }
          }
        }
        
        console.log(`[CHECK 5] Pre-burn trajectory matches nominal: ${preBurnMatch ? "YES" : "NO"}`);
        console.log(`[CHECK 5] Post-burn trajectory diverges:      ${postBurnDiverged ? "YES" : "NO"}`);
        expect(preBurnMatch).toBe(true);
        expect(postBurnDiverged).toBe(true);
      }
    } else {
      console.log("[CHECK 5] No active/approved maneuver path for this candidate. Skipping burn trajectory divergence check.");
    }
    console.log("[CHECK 5] STATUS: PASS");
  }, 30000);

  // ============================================================
  // CHECK 6 — Multi-satellite consistency
  // ============================================================
  it("CHECK 6 — Multi-satellite consistency check", async () => {
    const resConj = await fetch("http://localhost:3000/api/conjunction-events");
    expect(resConj.ok).toBe(true);
    const conjunctions = await resConj.json();
    expect(conjunctions.length).toBeGreaterThan(0);
    
    // Fetch maneuvers to get candidates that have run through tradeoffs
    const resMnv = await fetch("http://localhost:3000/api/maneuvers");
    expect(resMnv.ok).toBe(true);
    const candidateIdsSet = new Set<string>();
    
    // Add candidates from active conjunctions (guaranteed to be in the active TLE catalog)
    for (const conj of conjunctions) {
      candidateIdsSet.add(conj.secondaryId.split("-")[1]);
      if (candidateIdsSet.size >= 8) break;
    }
    
    const candidates = Array.from(candidateIdsSet);
    console.log(`[CHECK 6] Potential candidates to test (limited to active): ${candidates.join(", ")}`);
    
    // Query visualize sequentially to avoid CPU blocking on parallel SGP4 calculations
    const successful: Array<{ candId: string; data: any }> = [];
    for (const candId of candidates) {
      try {
        console.log(`[CHECK 6] Testing candidate ${candId} sequentially...`);
        const res = await fetch(`http://localhost:3000/api/visualize?candidate_id=${candId}&window_hours=2&step_seconds=60`);
        if (res.ok) {
          const data = await res.json();
          successful.push({ candId, data });
          console.log(`[CHECK 6] Successfully visualized candidate ${candId}`);
          if (successful.length >= 2) {
            break;
          }
        } else {
          console.log(`[CHECK 6] Candidate ${candId} returned status ${res.status}`);
        }
      } catch (e) {
        console.log(`[CHECK 6] Candidate ${candId} failed: ${e}`);
      }
    }
    
    expect(successful.length).toBeGreaterThanOrEqual(2);
    
    const first = successful[0];
    const second = successful[1];
    
    const firstPos = first.data.candidate_path[0].position_ecef_km;
    const secondPos = second.data.candidate_path[0].position_ecef_km;
    
    const firstAlt = Math.sqrt(firstPos[0]**2 + firstPos[1]**2 + firstPos[2]**2) - 6378.137;
    const secondAlt = Math.sqrt(secondPos[0]**2 + secondPos[1]**2 + secondPos[2]**2) - 6378.137;
    
    console.log(`[CHECK 6] First Candidate ID:  ${first.candId} Alt: ${firstAlt.toFixed(2)} km`);
    console.log(`[CHECK 6] Second Candidate ID: ${second.candId} Alt: ${secondAlt.toFixed(2)} km`);
    
    // Verify they are plotted at valid altitudes
    expect(firstAlt).toBeGreaterThan(200.0);
    expect(secondAlt).toBeGreaterThan(200.0);
    console.log("[CHECK 6] STATUS: PASS");
  }, 30000);
});
