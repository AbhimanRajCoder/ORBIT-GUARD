// ─────────────────────────────────────────────────────────────
// OrbitGuard v2.0 — CelesTrak API Client
// ─────────────────────────────────────────────────────────────
import { TLEData } from "@/types";
import { parseTLE } from "./tle-parser";

// Cache for catalogs to prevent hitting CelesTrak repeatedly
let cachedActiveTLEs: TLEData[] = [];
let cachedDebrisTLEs: TLEData[] = [];
let lastFetchedTime = 0;
const CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

// Fallback seed TLE data for offline development or CelesTrak failure
export const FALLBACK_ACTIVE_TLES = `
ISS (ZARYA)             
1 25544U 98067A   26165.57833565  .00014352  00000-0  25338-3 0  9997
2 25544  51.6402 234.3411 0004943  87.2188  47.4522 15.49837127572342
STARLINK-4892           
1 48921U 21060A   26165.20138889  .00001432  00000-0  11456-4 0  9998
2 48921  53.2187 142.1098 0001142  92.3412 267.8901 15.06421308 8912
ONEWEB-0234             
1 51042U 22002A   26165.10238889  .00000452  00000-0  34123-5 0  9993
2 51042  86.4012 312.4561 0001298 120.4512 239.5412 14.12093845 2314
SENTINEL-6              
1 46984U 20086A   26165.34018273  .00000123  00000-0  12345-5 0  9999
2 46984  66.0423  88.1234 0000843 189.5432 170.4512 13.36451239 8912
CARTOSAT-2F             
1 43111U 18004A   26165.45129843  .00000842  00000-0  45123-4 0  9994
2 43111  97.4219 190.5412 0001092 270.1234  89.8912 15.05431238 2314
NOAA-19                 
1 33591U 09005A   26165.01239482  .00000213  00000-0  21345-4 0  9990
2 33591  98.7012 110.4512 0001423 310.5412  49.4512 14.12094382 1203
STARLINK-3104           
1 49210U 21082A   26165.23456789  .00001234  00000-0  10234-4 0  9991
2 49210  53.2189 123.4567 0001234  45.6789 315.4321 15.06456789 1234
`.trim();

export const FALLBACK_DEBRIS_TLES = `
FENGYUN-1C DEBRIS       
1 90823U 99025A   26165.21045123  .00002134  00000-0  12345-3 0  9999
2 90823  53.2192 142.1102 0001243  92.3421 267.8892 15.06431201 8914
COSMOS 2251 DEBRIS      
1 11204U 93036A   26165.10549210  .00004512  00000-0  45123-3 0  9994
2 11204  86.4021 312.4589 0001342 120.4589 239.5312 14.12101234 2315
DELTA 2 ROCKET BODY     
1 34901U 04012A   26165.34012398  .00000543  00000-0  56789-4 0  9991
2 34901  98.7010 110.4502 0001398 310.5489  49.4498 14.12089451 1234
SL-8 DEBRIS             
1 56023U 75052A   26165.01239482  .00001234  00000-0  12345-4 0  9992
2 56023  66.0410  88.1256 0000890 189.5412 170.4498 13.36461234 8915
`.trim();

/**
 * Parses raw TLE text files (which contain sets of 3 lines: Name, Line 1, Line 2).
 */
export function parseCatalog(text: string): TLEData[] {
  const lines = text.split(/\r?\n/);
  const tles: TLEData[] = [];

  for (let i = 0; i < lines.length - 2; ) {
    const name = lines[i].trim();
    const l1 = lines[i + 1]?.trim();
    const l2 = lines[i + 2]?.trim();

    if (name && l1 && l2 && l1.startsWith("1") && l2.startsWith("2")) {
      try {
        const parsed = parseTLE(name, l1, l2);
        tles.push(parsed);
      } catch (err) {
        // Skip malformed TLE
      }
      i += 3;
    } else {
      i++;
    }
  }

  return tles;
}

/**
 * Fetches and parses a subset of active satellites and debris from CelesTrak.
 */
export async function fetchCelesTrakCatalogs(limit: number = 50): Promise<{
  active: TLEData[];
  debris: TLEData[];
}> {
  const now = Date.now();
  if (
    cachedActiveTLEs.length > 0 && 
    cachedDebrisTLEs.length > 0 && 
    now - lastFetchedTime < CACHE_DURATION_MS
  ) {
    return { active: cachedActiveTLEs, debris: cachedDebrisTLEs };
  }

  try {
    // 1. Fetch Active Satellite TLEs
    // Using a direct fetch to the catalog text files
    const activeRes = await fetch("https://celestrak.org/pub/TLE/catalog/active.txt", {
      next: { revalidate: 7200 }, // cache at next.js level
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "OrbitGuard-App/2.0" }
    });
    let activeText = "";
    if (activeRes.ok) {
      activeText = await activeRes.text();
    } else {
      throw new Error(`Active status: ${activeRes.status}`);
    }

    // 2. Fetch Debris TLEs
    const debrisRes = await fetch("https://celestrak.org/pub/TLE/catalog/debris.txt", {
      next: { revalidate: 7200 },
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "OrbitGuard-App/2.0" }
    });
    let debrisText = "";
    if (debrisRes.ok) {
      debrisText = await debrisRes.text();
    } else {
      throw new Error(`Debris status: ${debrisRes.status}`);
    }

    const parsedActive = parseCatalog(activeText).slice(0, limit);
    const parsedDebris = parseCatalog(debrisText).slice(0, limit);

    cachedActiveTLEs = parsedActive;
    cachedDebrisTLEs = parsedDebris;
    lastFetchedTime = now;

    return { active: parsedActive, debris: parsedDebris };
  } catch (error) {
    console.warn("CelesTrak live fetch failed, using offline fallback data:", error);
    
    // Parse offline fallback data
    const parsedActive = parseCatalog(FALLBACK_ACTIVE_TLES);
    const parsedDebris = parseCatalog(FALLBACK_DEBRIS_TLES);

    // Don't save fallback into permanent cache so we retry later,
    // but return them for immediate use
    return { active: parsedActive, debris: parsedDebris };
  }
}
