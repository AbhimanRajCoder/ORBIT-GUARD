import { describe, it, expect } from "vitest";
import { propagateTLE, propagateTLEToGeodetic, generateOrbitalTrack } from "./lib/sgp4-propagator";

describe("SGP4 Propagator NaN & Robustness Tests", () => {
  // A valid ISS TLE for testing normal propagation
  const validLine1 = "1 25544U 98067A   26051.49479167  .00015000  00000-0  27000-4 0  9993";
  const validLine2 = "2 25544  51.6400 320.1200 0005000  45.1200  90.1200 15.50000000100000";
  const testDate = new Date(Date.UTC(2026, 1, 20, 12, 0, 0));

  // Garbage TLE lines that cause satellite.js to output NaN coordinates
  const garbageLine1 = "1 99999U 23001A   26050.00000000  .00000000  00000-0  00000-0 0  9999";
  const garbageLine2 = "2 99999   0.0000   0.0000 0000000   0.0000   0.0000  0.00000000000000";

  it("should propagate a valid TLE without NaN values", () => {
    const result = propagateTLE(validLine1, validLine2, testDate);
    expect(result).not.toBeNull();
    expect(result!.position.x).not.toBeNaN();
    expect(result!.position.y).not.toBeNaN();
    expect(result!.position.z).not.toBeNaN();
    expect(result!.velocity.x).not.toBeNaN();
    expect(result!.velocity.y).not.toBeNaN();
    expect(result!.velocity.z).not.toBeNaN();
  });

  it("should return null for garbage TLE lines in propagateTLE", () => {
    const result = propagateTLE(garbageLine1, garbageLine2, testDate);
    expect(result).toBeNull();
  });

  it("should return null for garbage TLE lines in propagateTLEToGeodetic", () => {
    const result = propagateTLEToGeodetic(garbageLine1, garbageLine2, testDate);
    expect(result).toBeNull();
  });

  it("should return an empty array or array without NaN values in generateOrbitalTrack for garbage TLE", () => {
    const points = generateOrbitalTrack(garbageLine1, garbageLine2, testDate, 90, 10);
    // Should filter out any NaN positions, returning either an empty list or only valid points
    const hasNaN = points.some(p => isNaN(p.x) || isNaN(p.y) || isNaN(p.z));
    expect(hasNaN).toBe(false);
  });
});
