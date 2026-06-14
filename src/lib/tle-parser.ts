// ─────────────────────────────────────────────────────────────
// OrbitGuard v2.0 — TLE Parser Utility
// ─────────────────────────────────────────────────────────────
import { TLEData } from "@/types";

/**
 * Parses fractional days of the year into an ISO date string.
 */
function parseTLEEpoch(yearStr: string, dayStr: string): string {
  const year2d = parseInt(yearStr, 10);
  const year = year2d < 57 ? 2000 + year2d : 1900 + year2d;
  const dayOfYear = parseFloat(dayStr);
  
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const msInDay = 86400 * 1000;
  // Day 1.0 is Jan 1st 00:00:00, so we subtract 1 from the day count
  const epochMs = startOfYear.getTime() + (dayOfYear - 1) * msInDay;
  return new Date(epochMs).toISOString();
}

/**
 * Parses a TLE decimal value with an implicit decimal point and optional exponent.
 * E.g., "-11606-4" -> -0.11606e-4 = -0.000011606
 * E.g., " 00000-0" -> 0
 * E.g., " 29271-3" -> 0.29271e-3
 */
export function parseTLEExponentField(field: string): number {
  const trimmed = field.trim();
  if (!trimmed || parseFloat(trimmed) === 0) return 0;

  // The field format is: [+-]ddddd[+-]e where decimal point is assumed before the first digit
  // Let's identify the sign, the coefficient, and the exponent
  let sign = 1;
  let remaining = trimmed;
  if (remaining.startsWith("-")) {
    sign = -1;
    remaining = remaining.substring(1);
  } else if (remaining.startsWith("+")) {
    remaining = remaining.substring(1);
  }

  // Find the exponent delimiter (- or +)
  let expIndex = -1;
  for (let i = remaining.length - 1; i >= 0; i--) {
    if (remaining[i] === "-" || remaining[i] === "+") {
      expIndex = i;
      break;
    }
  }

  if (expIndex === -1) {
    // No exponent, just a normal number
    return parseFloat(trimmed);
  }

  const coeffStr = remaining.substring(0, expIndex);
  const expStr = remaining.substring(expIndex);

  // Coeff has implied leading decimal point
  const coeffVal = parseFloat(`0.${coeffStr}`);
  const expVal = parseInt(expStr, 10);

  return sign * coeffVal * Math.pow(10, expVal);
}

/**
 * Parses standard TLE lines into a structured TLEData object.
 */
export function parseTLE(name: string, line1: string, line2: string): TLEData {
  if (!line1 || !line2) {
    throw new Error("TLE must contain at least Line 1 and Line 2");
  }

  // Ensure lines are correctly padded/trimmed
  const l1 = line1.trimEnd();
  const l2 = line2.trimEnd();

  // Extract Line 1 fields (using 1-based indexing columns converted to 0-based index slicing)
  // Column indices are defined in standard TLE specifications
  const noradId = parseInt(l1.substring(2, 7).trim(), 10);
  const classification = l1.substring(7, 8).trim();
  const intlDesignator = l1.substring(9, 17).trim();
  
  const epochYearStr = l1.substring(18, 20);
  const epochDayStr = l1.substring(20, 32);
  const epoch = parseTLEEpoch(epochYearStr, epochDayStr);

  const meanMotionDot = parseFloat(l1.substring(33, 43).trim());
  const meanMotionDDot = parseTLEExponentField(l1.substring(44, 52));
  const bstar = parseTLEExponentField(l1.substring(53, 61));

  // Extract Line 2 fields
  const noradId2 = parseInt(l2.substring(2, 7).trim(), 10);
  if (noradId !== noradId2) {
    throw new Error(`NORAD IDs do not match: ${noradId} vs ${noradId2}`);
  }

  const inclination = parseFloat(l2.substring(8, 16).trim());
  const raan = parseFloat(l2.substring(17, 25).trim());
  
  // Eccentricity has an implied leading decimal point
  const eccStr = l2.substring(26, 33).trim();
  const eccentricity = parseFloat(`0.${eccStr}`);

  const argPerigee = parseFloat(l2.substring(34, 42).trim());
  const meanAnomaly = parseFloat(l2.substring(43, 51).trim());
  const meanMotion = parseFloat(l2.substring(52, 63).trim());

  return {
    line1: line1,
    line2: line2,
    name: name.trim(),
    noradId,
    classification,
    intlDesignator,
    epoch,
    meanMotion,
    eccentricity,
    inclination,
    raan,
    argPerigee,
    meanAnomaly,
    bstar,
    meanMotionDot,
    meanMotionDDot
  };
}
