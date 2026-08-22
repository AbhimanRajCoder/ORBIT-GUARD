import { describe, it, expect } from "vitest";

describe("OrbitGuard Pillar Integration Validation Tests", () => {
  // Test Candidate 62099
  const VALIDATION_CANDIDATE_ID = "62099";

  it("Pillar 3 & 4: Maneuver Calculation & Trade-off Comparison Integration", async () => {
    // 1. Fetch real backend comparison directly
    const backendCompareRes = await fetch(`http://127.0.0.1:8000/compare/${VALIDATION_CANDIDATE_ID}`);
    expect(backendCompareRes.ok).toBe(true);
    const backendCompare = await backendCompareRes.json();

    // 2. Fetch real backend options directly
    const backendOptionsRes = await fetch(`http://127.0.0.1:8000/maneuver/${VALIDATION_CANDIDATE_ID}/options`);
    expect(backendOptionsRes.ok).toBe(true);
    const backendOptions = await backendOptionsRes.json();

    // 3. Query Next.js proxy endpoint
    const frontendRes = await fetch("http://localhost:3000/api/maneuvers/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conjunctionEventId: `CONJ-25544-${VALIDATION_CANDIDATE_ID}` })
    });
    expect(frontendRes.ok).toBe(true);
    const frontendData = await frontendRes.json();

    // Assert that frontend payload matches backend options field-for-field
    expect(frontendData.options.length).toBe(backendOptions.length);
    frontendData.options.forEach((opt: any, idx: number) => {
      const backendOpt = backendOptions[idx];
      expect(opt.deltaV).toBe(backendOpt.delta_v_ms);
      expect(opt.newMissDistance).toBe(backendOpt.resulting_min_distance_km);
      expect(opt.propellantMassKg).toBe(backendOpt.fuel_cost_kg);
      expect(opt.cwDivergenceFlag).toBe(backendOpt.cw_divergence_flag);
      expect(opt.secondaryConjunctionWarning).toBe(backendOpt.secondary_conjunction_warning);
    });

    // Assert that frontend comparison matches backend ranked tradeoffs exactly
    expect(frontendData.comparison.candidate_id).toBe(backendCompare.candidate_id);
    expect(frontendData.comparison.recommended_option_id).toBe(backendCompare.recommended_option_id);
    expect(frontendData.comparison.reasoning).toBe(backendCompare.reasoning);
    expect(frontendData.comparison.ranked_options.length).toBe(backendCompare.ranked_options.length);

    frontendData.comparison.ranked_options.forEach((opt: any, idx: number) => {
      const backendRankedOpt = backendCompare.ranked_options[idx];
      expect(opt.option_id).toBe(backendRankedOpt.option_id);
      expect(opt.composite_score).toBe(backendRankedOpt.composite_score);
    });
  }, 60000); // 60 seconds timeout

  it("Pillar 5: Trajectory Sampling & ECEF Coordinates Integration", async () => {
    // 1. Fetch backend visualization directly
    const backendVisRes = await fetch(`http://127.0.0.1:8000/visualize/${VALIDATION_CANDIDATE_ID}?window_hours=6&step_seconds=60`);
    expect(backendVisRes.ok).toBe(true);
    const backendVis = await VisResBody(backendVisRes);

    // 2. Fetch Next.js proxy visualization
    const frontendVisRes = await fetch(`http://localhost:3000/api/visualize?candidate_id=${VALIDATION_CANDIDATE_ID}&window_hours=6&step_seconds=60`);
    expect(frontendVisRes.ok).toBe(true);
    const frontendVis = await frontendVisRes.json();

    // Assert coordinate correctness
    expect(frontendVis.candidate_id).toBe(backendVis.candidate_id);
    expect(frontendVis.protected_asset_path.length).toBe(backendVis.protected_asset_path.length);
    expect(frontendVis.candidate_path.length).toBe(backendVis.candidate_path.length);
    expect(frontendVis.earth_radius_km).toBe(backendVis.earth_radius_km);
    expect(frontendVis.frame).toBe("ECEF");

    // Match sampling points field-for-field
    for (let i = 0; i < frontendVis.candidate_path.length; i++) {
      const fPt = frontendVis.candidate_path[i];
      const bPt = backendVis.candidate_path[i];
      expect(fPt.t).toBe(bPt.t);
      expect(fPt.position_ecef_km[0]).toBe(bPt.position_ecef_km[0]);
      expect(fPt.position_ecef_km[1]).toBe(bPt.position_ecef_km[1]);
      expect(fPt.position_ecef_km[2]).toBe(bPt.position_ecef_km[2]);
    }

    // Match danger zone center & radius
    expect(frontendVis.danger_zone.radius_km).toBe(backendVis.danger_zone.radius_km);
    expect(frontendVis.danger_zone.center_ecef_km[0]).toBe(backendVis.danger_zone.center_ecef_km[0]);
    expect(frontendVis.danger_zone.center_ecef_km[1]).toBe(backendVis.danger_zone.center_ecef_km[1]);
    expect(frontendVis.danger_zone.center_ecef_km[2]).toBe(backendVis.danger_zone.center_ecef_km[2]);
  }, 60000); // 60 seconds timeout
});

async function VisResBody(res: Response) {
  return await res.json();
}
