// ─────────────────────────────────────────────────────────────
// OrbitGuard v2.0 — Orbital Physics Engine
// ─────────────────────────────────────────────────────────────
import { Satellite, ConjunctionEvent, ManeuverPlan } from "@/types";
import { propagateTLE, propagateTLEToGeodetic } from "./sgp4-propagator";
import { parseTLE } from "./tle-parser";

const EARTH_RADIUS = 6378.1; // km
const GM_EARTH = 398600.4418; // km^3 / s^2
const G0 = 9.80665; // m/s^2

/**
 * Calculates the orbital period of a satellite in minutes.
 * Formula: T = 2 * pi * sqrt(a^3 / GM)
 * @param altitudeKm Altitude above Earth's surface in km.
 */
export function calculateOrbitalPeriod(altitudeKm: number): number {
  const semiMajorAxis = EARTH_RADIUS + altitudeKm;
  const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / GM_EARTH);
  return periodSeconds / 60;
}

/**
 * Calculates the orbital velocity of a satellite in km/s.
 * Formula: v = sqrt(GM / r)
 * @param altitudeKm Altitude above Earth's surface in km.
 */
export function calculateOrbitalVelocity(altitudeKm: number): number {
  const semiMajorAxis = EARTH_RADIUS + altitudeKm;
  return Math.sqrt(GM_EARTH / semiMajorAxis);
}

/**
 * Estimates collision probability Pc using the Akella-Alfriend 2D analytical method.
 * Rotates standard RTN covariances to ECI, projects to the 2D collision plane,
 * and integrates the 2D Gaussian over the combined object cross-section.
 */
export function estimateCollisionProbability(
  posA: { x: number; y: number; z: number },
  velA: { x: number; y: number; z: number },
  posB: { x: number; y: number; z: number },
  velB: { x: number; y: number; z: number },
  combinedRadiusMeters: number = 15 // default 15m combined radius
): { pc: number; pcDisplay: string } {
  // 1. Compute relative state
  const r_rel = { x: posA.x - posB.x, y: posA.y - posB.y, z: posA.z - posB.z };
  const v_rel = { x: velA.x - velB.x, y: velA.y - velB.y, z: velA.z - velB.z };
  const v_mag = Math.sqrt(v_rel.x * v_rel.x + v_rel.y * v_rel.y + v_rel.z * v_rel.z);

  if (v_mag < 1e-6) {
    return { pc: 0, pcDisplay: "0.0" };
  }

  // 2. Define the encounter frame
  // z_e = v_rel / |v_rel|
  const z_e = { x: v_rel.x / v_mag, y: v_rel.y / v_mag, z: v_rel.z / v_mag };
  
  // x_e = (r_rel x v_rel) / |r_rel x v_rel|
  let x_e_raw = {
    x: r_rel.y * v_rel.z - r_rel.z * v_rel.y,
    y: r_rel.z * v_rel.x - r_rel.x * v_rel.z,
    z: r_rel.x * v_rel.y - r_rel.y * v_rel.x
  };
  let x_mag = Math.sqrt(x_e_raw.x * x_e_raw.x + x_e_raw.y * x_e_raw.y + x_e_raw.z * x_e_raw.z);
  if (x_mag < 1e-6) {
    x_e_raw = { x: -z_e.y, y: z_e.x, z: 0 };
    x_mag = Math.sqrt(x_e_raw.x * x_e_raw.x + x_e_raw.y * x_e_raw.y);
    if (x_mag < 1e-6) {
      x_e_raw = { x: 0, y: -z_e.z, z: z_e.y };
      x_mag = Math.sqrt(x_e_raw.y * x_e_raw.y + x_e_raw.z * x_e_raw.z);
    }
  }
  const x_e = { x: x_e_raw.x / x_mag, y: x_e_raw.y / x_mag, z: x_e_raw.z / x_mag };

  // y_e = z_e x x_e
  const y_e = {
    x: z_e.y * x_e.z - z_e.z * x_e.y,
    y: z_e.z * x_e.x - z_e.x * x_e.z,
    z: z_e.x * x_e.y - z_e.y * x_e.x
  };

  // 3. Project relative position onto the encounter plane (x_e, y_e)
  const x_proj = r_rel.x * x_e.x + r_rel.y * x_e.y + r_rel.z * x_e.z;
  const y_proj = r_rel.x * y_e.x + r_rel.y * y_e.y + r_rel.z * y_e.z;

  // 4. Compute RTN covariance for each satellite and rotate to ECI
  // Standard deviations in RTN (km):
  // primary: Radial 0.3 km, Transverse 1.5 km, Normal 0.3 km
  // secondary: Radial 0.5 km, Transverse 2.0 km, Normal 0.5 km
  const getECICovariance = (
    pos: { x: number; y: number; z: number },
    vel: { x: number; y: number; z: number },
    sigR: number,
    sigT: number,
    sigN: number
  ) => {
    const r_m = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    const u_R = { x: pos.x / r_m, y: pos.y / r_m, z: pos.z / r_m };
    
    const n_raw = {
      x: pos.y * vel.z - pos.z * vel.y,
      y: pos.z * vel.x - pos.x * vel.z,
      z: pos.x * vel.y - pos.y * vel.x
    };
    const n_m = Math.sqrt(n_raw.x * n_raw.x + n_raw.y * n_raw.y + n_raw.z * n_raw.z);
    const u_N = { x: n_raw.x / n_m, y: n_raw.y / n_m, z: n_raw.z / n_m };
    
    const u_T = {
      x: u_N.y * u_R.z - u_N.z * u_R.y,
      y: u_N.z * u_R.x - u_N.x * u_R.z,
      z: u_N.x * u_R.y - u_N.y * u_R.x
    };

    const varR = sigR * sigR;
    const varT = sigT * sigT;
    const varN = sigN * sigN;

    const c = new Array(9).fill(0);
    const uR = [u_R.x, u_R.y, u_R.z];
    const uT = [u_T.x, u_T.y, u_T.z];
    const uN = [u_N.x, u_N.y, u_N.z];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        c[i * 3 + j] = varR * uR[i] * uR[j] + varT * uT[i] * uT[j] + varN * uN[i] * uN[j];
      }
    }
    return c;
  };

  const C_p = getECICovariance(posA, velA, 0.3, 1.5, 0.3);
  const C_s = getECICovariance(posB, velB, 0.5, 2.0, 0.5);

  const C_eci = new Array(9);
  for (let i = 0; i < 9; i++) {
    C_eci[i] = C_p[i] + C_s[i];
  }

  // 5. Project Combined ECI Covariance onto Encounter Plane
  const mul = (v1: { x: number; y: number; z: number }, m: number[], v2: { x: number; y: number; z: number }) => {
    const mx = m[0] * v2.x + m[1] * v2.y + m[2] * v2.z;
    const my = m[3] * v2.x + m[4] * v2.y + m[5] * v2.z;
    const mz = m[6] * v2.x + m[7] * v2.y + m[8] * v2.z;
    return v1.x * mx + v1.y * my + v1.z * mz;
  };

  const C_e00 = mul(x_e, C_eci, x_e);
  const C_e01 = mul(x_e, C_eci, y_e);
  const C_e11 = mul(y_e, C_eci, y_e);

  const det_C_e = C_e00 * C_e11 - C_e01 * C_e01;
  if (det_C_e < 1e-12) {
    return { pc: 0, pcDisplay: "0.0" };
  }

  const inv_C_e00 = C_e11 / det_C_e;
  const inv_C_e01 = -C_e01 / det_C_e;
  const inv_C_e11 = C_e00 / det_C_e;

  const d_M_sq = x_proj * (inv_C_e00 * x_proj + inv_C_e01 * y_proj) + 
                 y_proj * (inv_C_e01 * x_proj + inv_C_e11 * y_proj);

  const R_km = combinedRadiusMeters / 1000.0;

  // Akella-Alfriend 2D Analytical Approximation
  // Pc = (R^2 / (2 * sqrt(det(C_e)))) * exp(-0.5 * d_M_sq)
  const pc = (R_km * R_km / (2 * Math.sqrt(det_C_e))) * Math.exp(-0.5 * d_M_sq);
  const pcFinal = Math.max(0, Math.min(0.9999, pc));

  let pcDisplay = "";
  if (pcFinal < 1e-6) {
    pcDisplay = pcFinal === 0 ? "0.0" : "< 10⁻⁶";
  } else {
    const exp = Math.floor(Math.log10(pcFinal));
    const base = pcFinal / Math.pow(10, exp);
    const superscripts: Record<string, string> = {
      "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹"
    };
    const expStr = exp.toString().split("").map(char => superscripts[char] || char).join("");
    pcDisplay = `${base.toFixed(2)} × 10${expStr}`;
  }

  return { pc: pcFinal, pcDisplay };
}

/**
 * Calculates fuel cost in kg using the Tsiolkovsky rocket equation.
 * Formula: m_prop = m0 * (1 - exp(-deltaV / (I_sp * g0)))
 */
export function calculateFuelCost(
  deltaV: number, // m/s
  m0: number = 500, // kg
  isp: number = 220 // s
): number {
  const exponent = -Math.abs(deltaV) / (isp * G0);
  const mProp = m0 * (1 - Math.exp(exponent));
  return parseFloat(mProp.toFixed(3));
}

/**
 * Predicts the new closest approach miss distance after a maneuver using CW-based linear approximation.
 * Supports Prograde, Retrograde, Radial-In/Out, and Normal/Antinormal burns.
 */
export function predictNewMissDistance(
  currentMissDistance: number, // km
  deltaV: number, // m/s
  burnTime: string, // ISO timestamp
  tca: string, // ISO timestamp
  direction: 'prograde' | 'retrograde' | 'radial-in' | 'radial-out' | 'normal' | 'antinormal' = 'prograde',
  altitudeKm: number = 550
): number {
  const dtSeconds = (new Date(tca).getTime() - new Date(burnTime).getTime()) / 1000;
  if (dtSeconds <= 0) return currentMissDistance;

  // Mean motion n = 2 * pi / Period (seconds)
  const periodMinutes = calculateOrbitalPeriod(altitudeKm);
  const n = (2 * Math.PI) / (periodMinutes * 60); // rad/s

  // Map direction to relative burn components in m/s
  let dvR = 0; // Radial
  let dvT = 0; // Transverse (In-track)
  let dvN = 0; // Normal (Cross-track)

  switch (direction) {
    case 'prograde':
      dvT = deltaV;
      break;
    case 'retrograde':
      dvT = -deltaV;
      break;
    case 'radial-out':
      dvR = deltaV;
      break;
    case 'radial-in':
      dvR = -deltaV;
      break;
    case 'normal':
      dvN = deltaV;
      break;
    case 'antinormal':
      dvN = -deltaV;
      break;
  }

  // Clohessy-Wiltshire Relative Position Equations (Relative position change in meters)
  const x = (dvR / n) * Math.sin(n * dtSeconds) + (2 * dvT / n) * (1 - Math.cos(n * dtSeconds));
  const y = (2 * dvR / n) * (Math.cos(n * dtSeconds) - 1) + (dvT / n) * (4 * Math.sin(n * dtSeconds) - 3 * n * dtSeconds);
  const z = (dvN / n) * Math.sin(n * dtSeconds);

  // Total displacement in km
  const shiftKm = Math.sqrt(x * x + y * y + z * z) / 1000.0;

  // Combine using root-sum-square as relative displacement is typically orthogonal to the miss vector
  const newMiss = Math.sqrt(currentMissDistance * currentMissDistance + shiftKm * shiftKm);
  return parseFloat(newMiss.toFixed(3));
}

/**
 * Calculates three distinct maneuver options for a conjunction event.
 * Targets: Minimum Fuel (2.0 km miss), Balanced (5.0 km miss), Maximum Safety (10.0 km miss)
 */
export function calculateManeuverOptions(
  event: ConjunctionEvent,
  satellite: Satellite
): ManeuverPlan[] {
  const tcaTime = new Date(event.tca).getTime();
  // Schedule burn 4 hours before TCA (or half the time to TCA if TCA is less than 8 hours away)
  const timeToTcaMs = tcaTime - Date.now();
  const burnOffsetMs = Math.min(4 * 60 * 60 * 1000, timeToTcaMs / 2);
  const burnTimeISO = new Date(tcaTime - burnOffsetMs).toISOString();
  const dtSeconds = burnOffsetMs / 1000;

  const m0 = satellite.estimatedMassKg || 500;
  const isp = 220;

  // Function to solve Clohessy-Wiltshire for deltaV to achieve target miss distance:
  // shiftKm = targetMiss - currentMiss
  // deltaV = (shiftKm * 1000) / (3 * dtSeconds)
  const solveDeltaV = (targetMissKm: number) => {
    const currentMiss = event.missDistance;
    if (currentMiss >= targetMissKm) return 0.05; // tiny stationkeeping burn
    const shiftKm = targetMissKm - currentMiss;
    const dv = (shiftKm * 1000) / (3 * dtSeconds);
    return parseFloat(Math.max(0.05, dv).toFixed(3));
  };

  // 1. Minimum Fuel (Target: 2.0 km miss)
  const minDeltaV = solveDeltaV(2.0);
  const minFuel = calculateFuelCost(minDeltaV, m0, isp);
  const minNewMiss = predictNewMissDistance(event.missDistance, minDeltaV, burnTimeISO, event.tca);

  const minPlan: ManeuverPlan = {
    id: `MP-MIN-${event.id}`,
    conjunctionEventId: event.id,
    satelliteId: satellite.id,
    burnDirection: 'prograde',
    deltaV: minDeltaV,
    burnTime: burnTimeISO,
    burnTimingNote: "Earliest optimal execution window (TCA - 4.0h)",
    currentMissDistance: event.missDistance,
    newMissDistance: minNewMiss,
    targetMissDistance: 2.0,
    propellantMassKg: minFuel,
    specificImpulse: isp,
    satelliteMassKg: m0,
    status: 'proposed',
    createdAt: new Date().toISOString()
  };

  // 2. Balanced (Target: 5.0 km miss)
  const balDeltaV = solveDeltaV(5.0);
  const balFuel = calculateFuelCost(balDeltaV, m0, isp);
  const balNewMiss = predictNewMissDistance(event.missDistance, balDeltaV, burnTimeISO, event.tca);

  const balPlan: ManeuverPlan = {
    id: `MP-BAL-${event.id}`,
    conjunctionEventId: event.id,
    satelliteId: satellite.id,
    burnDirection: 'prograde',
    deltaV: balDeltaV,
    burnTime: burnTimeISO,
    burnTimingNote: "Balanced energy-safety window (TCA - 4.0h)",
    currentMissDistance: event.missDistance,
    newMissDistance: balNewMiss,
    targetMissDistance: 5.0,
    propellantMassKg: balFuel,
    specificImpulse: isp,
    satelliteMassKg: m0,
    status: 'proposed',
    createdAt: new Date().toISOString()
  };

  // 3. Maximum Safety (Target: 10.0 km miss)
  const maxDeltaV = solveDeltaV(10.0);
  const maxFuel = calculateFuelCost(maxDeltaV, m0, isp);
  const maxNewMiss = predictNewMissDistance(event.missDistance, maxDeltaV, burnTimeISO, event.tca);

  const maxPlan: ManeuverPlan = {
    id: `MP-MAX-${event.id}`,
    conjunctionEventId: event.id,
    satelliteId: satellite.id,
    burnDirection: 'prograde',
    deltaV: maxDeltaV,
    burnTime: burnTimeISO,
    burnTimingNote: "High energy safety window (TCA - 4.0h)",
    currentMissDistance: event.missDistance,
    newMissDistance: maxNewMiss,
    targetMissDistance: 10.0,
    propellantMassKg: maxFuel,
    specificImpulse: isp,
    satelliteMassKg: m0,
    status: 'proposed',
    createdAt: new Date().toISOString()
  };

  return [minPlan, balPlan, maxPlan];
}

/**
 * Formats a maneuver plan details into a clean plain-text description.
 */
export function formatManeuverDescription(plan: ManeuverPlan, eventName?: string): string {
  const oldMissMeters = Math.round(plan.currentMissDistance * 1000);
  const newMissKm = plan.newMissDistance.toFixed(2);
  const timeStr = plan.burnTime.slice(11, 19) + " UTC";

  return `A ${plan.deltaV.toFixed(2)} m/s prograde burn at ${timeStr}. This will increase the closest approach from ${oldMissMeters}m to ${newMissKm}km, using ${plan.propellantMassKg.toFixed(2)} kg of fuel.`;
}
