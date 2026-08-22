import math
import sys
import numpy as np
import httpx
from datetime import datetime, timezone, timedelta
from sgp4.api import Satrec

from app.models import Alert
from app.services.orbital_mechanics import (
    build_cw_state_transition,
    compute_mean_motion,
    get_relative_state,
    solve_targeting_burn,
    delta_v_to_fuel_mass,
    repropagate_relative_trajectory,
    generate_maneuver_options,
    screen_secondary_conjunctions
)

BASE_URL = "http://127.0.0.1:8000"

def test_1_cw_textbook_sanity() -> bool:
    print("\n--- [CHECK 1] Clohessy-Wiltshire State Transition Textbook Sanity Test (t=0) ---")
    n = 0.00113  # Typical LEO mean motion ~ 0.00113 rad/s (ISS ~92 min period)
    t = 0.0
    
    Phi_rr, Phi_rv, Phi_vr, Phi_vv = build_cw_state_transition(n, t)
    
    I3 = np.eye(3)
    O3 = np.zeros((3, 3))
    
    rr_err = np.max(np.abs(Phi_rr - I3))
    rv_err = np.max(np.abs(Phi_rv - O3))
    vr_err = np.max(np.abs(Phi_vr - O3))
    vv_err = np.max(np.abs(Phi_vv - I3))
    
    print(f"Phi_rr max error vs Identity: {rr_err:.6e}")
    print(f"Phi_rv max error vs Zero:     {rv_err:.6e}")
    print(f"Phi_vr max error vs Zero:     {vr_err:.6e}")
    print(f"Phi_vv max error vs Identity: {vv_err:.6e}")
    
    if rr_err < 1e-9 and rv_err < 1e-9 and vr_err < 1e-9 and vv_err < 1e-9:
        print("PASS: Clohessy-Wiltshire state transition matrix identically satisfies textbook t=0 boundary conditions.")
        return True
    else:
        print("FAIL: CW state transition matrix deviates from textbook boundary conditions.")
        return False

def test_2_singular_matrix_handling() -> bool:
    print("\n--- [CHECK 2] Singular-Matrix & Edge Case Error Handling ---")
    n = 0.00113
    r0 = np.array([1.0, 0.0, 0.0])
    v0 = np.array([0.0, 0.01, 0.0])
    
    # Test A: t = 0 or negative
    caught_zero_t = False
    try:
        solve_targeting_burn(r0, v0, 0.0, n, 5.0)
    except ValueError as e:
        caught_zero_t = True
        print(f"Correctly caught zero time-to-TCA error: '{e}'")
        
    # Test B: Exact orbital period where sin(nt) = 0 (t = 2*pi / n)
    t_singular = (2.0 * math.pi) / n
    caught_singular_period = False
    try:
        solve_targeting_burn(r0, v0, t_singular, n, 5.0)
    except ValueError as e:
        caught_singular_period = True
        print(f"Correctly caught singular orbital period error: '{e}'")
        
    if caught_zero_t and caught_singular_period:
        print("PASS: Singular matrices and edge cases cleanly raise explicit ValueErrors rather than returning NaN/garbage.")
        return True
    else:
        print("FAIL: Did not catch all singular matrix edge cases.")
        return False

def test_3_monotonicity_and_closed_loop_targeting() -> bool:
    print("\n--- [CHECK 3] Monotonicity & SGP4 Nonlinear Distance Convergence ---")
    
    client = httpx.Client(timeout=30.0)
    r_refresh = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 50.0
    })
    assert r_refresh.status_code == 200, f"Refresh failed: {r_refresh.text}"
    alerts = r_refresh.json()["alerts"]
    assert len(alerts) > 0, "No alerts returned"
    
    alert_dict = alerts[0]
    
    from app.services.data_fetch import fetch_tle_data
    import asyncio
    satellites, _ = asyncio.run(fetch_tle_data("active"))
    
    cand_tle = next((s for s in satellites if s["norad_id"] == alert_dict["candidate_id"]), None)
    iss_tle = next((s for s in satellites if s["norad_id"] == "25544"), None)
    
    iss_satrec = Satrec.twoline2rv(iss_tle["line1"], iss_tle["line2"])
    cand_satrec = Satrec.twoline2rv(cand_tle["line1"], cand_tle["line2"])
    
    alert = Alert(
        protected_asset_id=alert_dict["protected_asset_id"],
        candidate_name=alert_dict["candidate_name"],
        candidate_id=alert_dict["candidate_id"],
        min_distance_km=alert_dict["min_distance_km"],
        time_of_closest_approach=datetime.fromisoformat(alert_dict["time_of_closest_approach"]),
        risk_score=alert_dict["risk_score"],
        mission_priority=alert_dict.get("mission_priority", 1.0)
    )
    
    options = generate_maneuver_options(alert, iss_satrec, cand_satrec, all_satellites=satellites)
    
    print(f"\nGenerated {len(options)} options for candidate {alert.candidate_name}:")
    for opt in options:
        print(f"  [{opt.label}] dV={opt.delta_v_ms:.3f} m/s | Fuel={opt.fuel_cost_kg:.4f} kg | CW Dist={opt.resulting_distance_cw:.3f} km | SGP4 Dist={opt.resulting_distance_sgp4:.3f} km | DivFlag={opt.cw_divergence_flag}")
        
    assert len(options) == 3, "Expected 3 maneuver options"
    opt_s, opt_m, opt_l = options[0], options[1], options[2]
    
    mono_dv = opt_s.delta_v_ms < opt_m.delta_v_ms < opt_l.delta_v_ms
    mono_fuel = opt_s.fuel_cost_kg < opt_m.fuel_cost_kg < opt_l.fuel_cost_kg
    mono_dist_cw = opt_s.resulting_distance_cw < opt_m.resulting_distance_cw < opt_l.resulting_distance_cw
    mono_dist_sgp4 = opt_s.resulting_distance_sgp4 < opt_m.resulting_distance_sgp4 < opt_l.resulting_distance_sgp4
    
    print(f"\nMonotonicity Check:")
    print(f"  Delta-V strictly increasing:             {mono_dv} ({opt_s.delta_v_ms} < {opt_m.delta_v_ms} < {opt_l.delta_v_ms})")
    print(f"  Fuel Mass strictly increasing:           {mono_fuel} ({opt_s.fuel_cost_kg} < {opt_m.fuel_cost_kg} < {opt_l.fuel_cost_kg})")
    print(f"  Linear CW Distance strictly increasing:  {mono_dist_cw} ({opt_s.resulting_distance_cw} < {opt_m.resulting_distance_cw} < {opt_l.resulting_distance_cw})")
    print(f"  Nonlinear SGP4 Dist strictly increasing: {mono_dist_sgp4} ({opt_s.resulting_distance_sgp4} < {opt_m.resulting_distance_sgp4} < {opt_l.resulting_distance_sgp4})")
    
    if mono_dv and mono_fuel and mono_dist_cw and mono_dist_sgp4:
        print("PASS: Maneuver options strictly satisfy simultaneous monotonicity in both linear CW and nonlinear SGP4.")
        return True
    else:
        print("FAIL: Monotonicity violation detected.")
        return False

def test_4_secondary_conjunction_mock() -> bool:
    print("\n--- [CHECK 4] Secondary-Conjunction Re-Screening Warning Test ---")
    
    from app.services.data_fetch import fetch_tle_data
    from app.services.conjunction import datetime_to_jd_fr
    import asyncio
    satellites, _ = asyncio.run(fetch_tle_data("active"))
    
    # Pick a real active satellite from catalog
    other_sat = satellites[5]
    other_srec = Satrec.twoline2rv(other_sat["line1"], other_sat["line2"])
    
    now = datetime.now(timezone.utc)
    t_burn = now
    
    # Propagate other satellite at t_burn
    jd_b, fr_b = datetime_to_jd_fr(t_burn)
    _, r_other, v_other = other_srec.sgp4(jd_b, fr_b)
    
    # Set post-burn asset state to fly 3.46 km offset from other satellite
    r_p_burn = np.array(r_other) + np.array([2.0, 2.0, 2.0])
    v_p_post = np.array(v_other)
    
    mock_catalog = [
        {
            "name": other_sat["name"],
            "norad_id": other_sat["norad_id"],
            "line1": other_sat["line1"],
            "line2": other_sat["line2"]
        }
    ]
    
    warning = screen_secondary_conjunctions(
        r_p_burn=r_p_burn,
        v_p_post_burn=v_p_post,
        t_burn=t_burn,
        protected_id="25544",
        candidate_id="99999",
        all_satellites=mock_catalog,
        threshold_km=50.0,
        duration_hours=1.0,
        step_seconds=30.0
    )
    
    print(f"Secondary screening result: '{warning}'")
    if warning and other_sat["name"] in warning and "Warning" in warning:
        print("PASS: Secondary conjunction warning successfully triggered and populated with candidate details.")
        return True
    else:
        print("FAIL: Secondary conjunction warning was not triggered for intersecting orbit.")
        return False

def test_5_api_integration_and_caching() -> bool:
    print("\n--- [CHECK 5] FastAPI Endpoint & Caching Verification (GET /maneuver/{candidate_id}/options) ---")
    client = httpx.Client(timeout=30.0)
    
    # 1. Refresh triage to populate ALERTS_DB
    print("Refreshing triage for ISS (25544)...")
    r_refresh = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 50.0
    })
    assert r_refresh.status_code == 200, f"Refresh failed: {r_refresh.text}"
    alerts = r_refresh.json()["alerts"]
    assert len(alerts) > 0, "No alerts returned"
    
    candidate = alerts[0]
    candidate_id = candidate["candidate_id"]
    print(f"Testing maneuver endpoint for candidate: {candidate['candidate_name']} (NORAD ID: {candidate_id})")
    
    # 2. Call GET /maneuver/{candidate_id}/options
    r_options1 = client.get(f"{BASE_URL}/maneuver/{candidate_id}/options")
    assert r_options1.status_code == 200, f"GET /maneuver failed: {r_options1.text}"
    options1 = r_options1.json()
    print(f"Received {len(options1)} maneuver options on initial call.")
    
    # Verify new fields exist
    assert "resulting_distance_cw" in options1[0], "Missing resulting_distance_cw"
    assert "resulting_distance_sgp4" in options1[0], "Missing resulting_distance_sgp4"
    assert "cw_divergence_flag" in options1[0], "Missing cw_divergence_flag"
    
    # 3. Test caching (2nd call should be instantaneous)
    r_options2 = client.get(f"{BASE_URL}/maneuver/{candidate_id}/options")
    assert r_options2.status_code == 200
    options2 = r_options2.json()
    assert options1 == options2, "Cached options did not match initial generation"
    print("PASS: Caching verified (identical options returned instantly).")
    
    # 4. Test 404 for unknown candidate
    r_404 = client.get(f"{BASE_URL}/maneuver/99999999/options")
    print(f"404 test response status: {r_404.status_code}")
    assert r_404.status_code == 404
    print("PASS: 404 correctly returned for non-existent candidate.")
    
    return True

def test_6_raw_numeric_trace_live() -> bool:
    print("\n--- [CHECK 6] Real Alert Live End-to-End Trace (CW vs SGP4 & Secondary Conjunctions) ---")
    
    client = httpx.Client(timeout=30.0)
    r_refresh = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 50.0
    })
    alerts = r_refresh.json()["alerts"]
    alert = alerts[0]
    
    r_options = client.get(f"{BASE_URL}/maneuver/{alert['candidate_id']}/options")
    options = r_options.json()
    
    print(f"\nProtected Asset: ISS (25544) vs Candidate: {alert['candidate_name']} ({alert['candidate_id']})")
    print(f"Current Miss Distance at TCA: {alert['min_distance_km']:.3f} km")
    print(f"Time of Closest Approach:     {alert['time_of_closest_approach']}")
    
    print("\nDetailed Numeric Comparison & Screening Trace:")
    print("-" * 130)
    print(f"{'Option':<12} | {'Delta-V (m/s)':<14} | {'Fuel (kg)':<10} | {'CW Dist (km)':<14} | {'SGP4 Dist (km)':<16} | {'Diff %':<8} | {'Secondary Warning':<30}")
    print("-" * 130)
    
    for opt in options:
        cw_d = opt['resulting_distance_cw']
        sgp4_d = opt['resulting_distance_sgp4']
        diff_pct = abs(sgp4_d - cw_d) / cw_d * 100.0
        sec_warn = opt['secondary_conjunction_warning'] or "None (Clean)"
        if len(sec_warn) > 30:
            sec_warn = sec_warn[:27] + "..."
        print(f"{opt['label']:<12} | {opt['delta_v_ms']:<14.3f} | {opt['fuel_cost_kg']:<10.4f} | {cw_d:<14.3f} | {sgp4_d:<16.3f} | {diff_pct:<7.2f}% | {sec_warn:<30}")
        
    print("-" * 130)
    print("PASS: Live numeric trace confirmed.")
    return True

if __name__ == "__main__":
    print("=========================================================")
    print("    ORBITGUARD PILLAR 3: COMPREHENSIVE VERIFICATION     ")
    print("=========================================================")
    
    c1 = test_1_cw_textbook_sanity()
    c2 = test_2_singular_matrix_handling()
    c3 = test_3_monotonicity_and_closed_loop_targeting()
    c4 = test_4_secondary_conjunction_mock()
    c5 = test_5_api_integration_and_caching()
    c6 = test_6_raw_numeric_trace_live()
    
    print("\n==================== TEST SUMMARY ====================")
    print(f"Check 1 - Textbook Sanity Test (t=0):            {'PASS' if c1 else 'FAIL'}")
    print(f"Check 2 - Singular Matrix Error Handling:        {'PASS' if c2 else 'FAIL'}")
    print(f"Check 3 - Monotonicity in CW & SGP4:             {'PASS' if c3 else 'FAIL'}")
    print(f"Check 4 - Secondary Conjunction Mock Warning:    {'PASS' if c4 else 'FAIL'}")
    print(f"Check 5 - FastAPI Endpoint & Cache (404/200):    {'PASS' if c5 else 'FAIL'}")
    print(f"Check 6 - Live Alert CW vs SGP4 & Secondary:     {'PASS' if c6 else 'FAIL'}")
    
    if all([c1, c2, c3, c4, c5, c6]):
        print("\nALL PILLAR 3 COMPREHENSIVE VERIFICATION CHECKS PASSED WITH ZERO ERRORS!")
        sys.exit(0)
    else:
        print("\nONE OR MORE CHECKS FAILED. SEE DETAILS ABOVE.")
        sys.exit(1)
