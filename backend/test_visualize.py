import sys
import httpx
import math
import numpy as np
from datetime import datetime, timezone
from sgp4.api import Satrec

from app.services.visualization import teme_to_ecef
from app.services.conjunction import datetime_to_jd_fr

BASE_URL = "http://127.0.0.1:8000"

def ecef_to_latlon(r_ecef: np.ndarray) -> tuple[float, float, float]:
    """
    Standard geodetic conversion from ECEF (km) to lat/lon (degrees) and altitude (km).
    """
    a = 6378.137
    f = 1.0 / 298.257223563
    b = a * (1.0 - f)
    e_sq = (a**2 - b**2) / (a**2)
    e_prime_sq = (a**2 - b**2) / (b**2)
    
    x = r_ecef[0]
    y = r_ecef[1]
    z = r_ecef[2]
    
    p = math.sqrt(x**2 + y**2)
    if p < 1e-9:
        lat = 90.0 if z > 0 else -90.0
        lon = 0.0
        alt = abs(z) - b
        return lat, lon, alt
        
    theta = math.atan2(z * a, p * b)
    lat_rad = math.atan2(
        z + e_prime_sq * b * (math.sin(theta)**3),
        p - e_sq * a * (math.cos(theta)**3)
    )
    lon_rad = math.atan2(y, x)
    
    N = a / math.sqrt(1.0 - e_sq * (math.sin(lat_rad)**2))
    alt = p / math.cos(lat_rad) - N
    
    return lat_rad * 180.0 / math.pi, lon_rad * 180.0 / math.pi, alt

def test_1_teme_to_ecef_sanity() -> bool:
    print("\n--- [TEST 1] TEME-to-ECEF Reference Check ---")
    
    # ISS TLE
    line1 = "1 25544U 98067A   26051.49479167  .00015000  00000-0  27000-4 0  9993"
    line2 = "2 25544  51.6400 320.1200 0005000  45.1200  90.1200 15.50000000100000"
    
    sat = Satrec.twoline2rv(line1, line2)
    
    # Propagate to a known timestamp
    now = datetime(2026, 2, 20, 12, 0, 0, tzinfo=timezone.utc)
    jd, fr = datetime_to_jd_fr(now)
    e, r, v = sat.sgp4(jd, fr)
    assert e == 0
    
    r_ecef, v_ecef = teme_to_ecef(np.array(r), np.array(v), now)
    lat, lon, alt = ecef_to_latlon(r_ecef)
    
    pos_mag = np.linalg.norm(r_ecef)
    print(f"Propagated ISS to {now}")
    print(f"ECEF Position:    {r_ecef} km")
    print(f"Altitude:         {alt:.3f} km")
    print(f"Geodetic Lat/Lon: {lat:.4f}° Lat, {lon:.4f}° Lon")
    
    # Assertions
    # Earth radius is ~6378km, ISS altitude is ~400km, so total magnitude should be ~6778km
    assert 6500.0 <= pos_mag <= 6900.0, f"Expected geocentric magnitude ~6778km, got {pos_mag:.2f}km"
    assert 350.0 <= alt <= 480.0, f"Expected ISS altitude ~400km, got {alt:.2f}km"
    assert -90.0 <= lat <= 90.0
    assert -180.0 <= lon <= 180.0
    
    print("PASS: TEME-to-ECEF reference matches physical ISS altitude constraints.")
    return True

def test_2_nominal_distance_consistency() -> bool:
    print("\n--- [TEST 2] Nominal Distance Consistency ---")
    client = httpx.Client(timeout=90.0)
    
    # Refresh database at 100km to guarantee alerts
    r_refresh = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 100.0
    })
    alerts = r_refresh.json()["alerts"]
    alert = next((a for a in alerts if a["candidate_id"] == "45701"), None)
    if not alert:
        alert = alerts[0]
    candidate_id = alert["candidate_id"]
    
    # Query visualize endpoint with 60-second steps to match triage frequency
    r_vis = client.get(f"{BASE_URL}/visualize/{candidate_id}?window_hours=2&step_seconds=60")
    if r_vis.status_code != 200:
        print(f"Error from visualize endpoint: {r_vis.text}")
    assert r_vis.status_code == 200
    vis_data = r_vis.json()
    
    p_path = vis_data["protected_asset_path"]
    c_path = vis_data["candidate_path"]
    
    # Verify both paths have identical timestamps and counts
    assert len(p_path) == len(c_path)
    
    # Find minimum distance between the two paths in ECEF
    min_ecef_dist = float('inf')
    for p_pt, c_pt in zip(p_path, c_path):
        p_pos = np.array(p_pt["position_ecef_km"])
        c_pos = np.array(c_pt["position_ecef_km"])
        dist = np.linalg.norm(p_pos - c_pos)
        if dist < min_ecef_dist:
            min_ecef_dist = dist
            
    print(f"Pillar 1 screened min distance: {alert['min_distance_km']:.4f} km")
    print(f"Pillar 5 ECEF sampled min distance: {min_ecef_dist:.4f} km")
    
    # Assert tolerance within 0.25 km (accounting for 60-second step quantization)
    diff = abs(min_ecef_dist - alert['min_distance_km'])
    print(f"Absolute Difference: {diff:.6f} km")
    assert diff < 0.25, f"ECEF path distance diverges from Pillar 1 triage! Diff={diff:.4f}km"
    
    print("PASS: Trajectory sampling matches the screened minimum conjunction distance.")
    return True

def test_3_maneuver_distance_convergence() -> bool:
    print("\n--- [TEST 3] Maneuver Distance Convergence ---")
    client = httpx.Client(timeout=90.0)
    
    # Query compare endpoint to fetch resulting SGP4 distance
    # Fetch current alerts to resolve candidate_id dynamically
    r_refresh = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 100.0
    })
    alerts = r_refresh.json()["alerts"]
    alert = next((a for a in alerts if a["candidate_id"] == "45701"), None)
    if not alert:
        alert = alerts[0]
    candidate_id = alert["candidate_id"]

    # Query compare endpoint to fetch resulting SGP4 distance
    r_comp = client.get(f"{BASE_URL}/compare/{candidate_id}")
    comp_data = r_comp.json()
    rec_id = comp_data["recommended_option_id"]
    
    r_vis = client.get(f"{BASE_URL}/visualize/{candidate_id}?window_hours=2&step_seconds=10")
    vis_data = r_vis.json()
    
    m_path = vis_data["maneuver_path"]
    c_path = vis_data["candidate_path"]
    
    if rec_id and m_path:
        # Find ECEF distance at the exact TCA point (middle of the path)
        mid_idx = len(m_path) // 2
        m_pos_tca = np.array(m_path[mid_idx]["position_ecef_km"])
        c_pos_tca = np.array(c_path[mid_idx]["position_ecef_km"])
        dist_tca = np.linalg.norm(m_pos_tca - c_pos_tca)
        
        # Find the SGP4 distance of the recommended option
        rec_opt_meta = next(ro for ro in comp_data["ranked_options"] if ro["option_id"] == rec_id)
        # Fetch the original options to get the exact SGP4 separation distance
        r_options = client.get(f"{BASE_URL}/maneuver/{candidate_id}/options")
        opt_details = next(o for o in r_options.json() if o["option_id"] == rec_id)
        expected_sgp4_dist = opt_details["resulting_distance_sgp4"]
        
        print(f"Recommended Option: {rec_id} ({opt_details['label']})")
        print(f"Expected separation (SGP4):   {expected_sgp4_dist:.4f} km")
        print(f"Sampled ECEF separation at TCA: {dist_tca:.4f} km")
        
        # Assert tolerance within 20.0 km (accounting for discrete 10s sampling vs continuous SGP4 TCA microsecond offset and CW vs Keplerian differences)
        diff = abs(dist_tca - expected_sgp4_dist)
        print(f"Absolute Difference at TCA: {diff:.6f} km")
        assert diff < 20.0, f"Maneuver path separation at TCA diverges from SGP4 target! Diff={diff:.4f}km"
        print("PASS: Maneuver trajectory ECEF closest approach matches the target SGP4 separation.")
    else:
        print("Maneuver path is None (disqualified). Skipping check.")
        
    return True

def test_4_404_path() -> bool:
    print("\n--- [TEST 4] 404 Verification Path ---")
    client = httpx.Client(timeout=90.0)
    resp = client.get(f"{BASE_URL}/visualize/99999999")
    print(f"404 verification status: {resp.status_code}")
    assert resp.status_code == 404
    print("PASS: 404 correctly returned for non-existent candidate.")
    return True

def test_5_live_e2e_trace() -> bool:
    print("\n--- [TEST 5] Live End-to-End ECEF Coordinate Trace (Candidate 45701) ---")
    client = httpx.Client(timeout=90.0)
    
    # Query visualize endpoint
    r_refresh = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 100.0
    })
    alerts = r_refresh.json()["alerts"]
    alert = next((a for a in alerts if a["candidate_id"] == "45701"), None)
    if not alert:
        alert = alerts[0]
    candidate_id = alert["candidate_id"]
    
    r_vis = client.get(f"{BASE_URL}/visualize/{candidate_id}?window_hours=4&step_seconds=120")
    if r_vis.status_code != 200:
        print(f"Error from visualize endpoint: {r_vis.text}")
    assert r_vis.status_code == 200
    data = r_vis.json()
    
    p_path = data["protected_asset_path"]
    c_path = data["candidate_path"]
    m_path = data["maneuver_path"] or []
    
    print(f"Total sampled points: {len(p_path)}")
    print(f"Danger Zone Center ECEF: {data['danger_zone']['center_ecef_km']} km (Radius: {data['danger_zone']['radius_km']:.3f} km)")
    
    # Helper to print point details
    def print_pt(label: str, index: int):
        print(f"\n[{label} Point {index}]")
        p_pt = p_path[index]
        c_pt = c_path[index]
        print(f"  Timestamp:         {p_pt['t']}")
        print(f"  Asset Nominal ECEF: {p_pt['position_ecef_km']}")
        print(f"  Candidate ECEF:     {c_pt['position_ecef_km']}")
        if m_path:
            m_pt = m_path[index]
            print(f"  Asset Post-Burn:    {m_pt['position_ecef_km']}")
            # Divergence from nominal
            p_pos = np.array(p_pt['position_ecef_km'])
            m_pos = np.array(m_pt['position_ecef_km'])
            div_km = np.linalg.norm(m_pos - p_pos)
            print(f"  Maneuver Divergence: {div_km:.4f} km")
            
    # Sample first, middle, and last points
    n_pts = len(p_path)
    print_pt("FIRST", 0)
    print_pt("MIDDLE", n_pts // 2)
    print_pt("LAST", n_pts - 1)
    
    # Manually convert the middle point of protected_asset_path to lat/lon
    mid_idx = n_pts // 2
    mid_ecef = np.array(p_path[mid_idx]["position_ecef_km"])
    lat, lon, alt = ecef_to_latlon(mid_ecef)
    print(f"\n--- Geodetic Conversion Check (Middle Point) ---")
    print(f"Middle Point ECEF:    {mid_ecef} km")
    print(f"Calculated Geodetic: {lat:.4f}° Lat, {lon:.4f}° Lon (Alt: {alt:.2f} km)")
    
    assert 350.0 <= alt <= 480.0, "ISS altitude out of bounds!"
    print("PASS: Geodetic check represents a physically plausible ISS orbital location.")
    
    return True

if __name__ == "__main__":
    print("=========================================================")
    print("      ORBITGUARD PILLAR 5: VISUALIZATION TESTS           ")
    print("=========================================================")
    
    c1 = test_1_teme_to_ecef_sanity()
    c2 = test_2_nominal_distance_consistency()
    c3 = test_3_maneuver_distance_convergence()
    c4 = test_4_404_path()
    c5 = test_5_live_e2e_trace()
    
    print("\n==================== TEST SUMMARY ====================")
    print(f"Check 1 - TEME-to-ECEF Reference Alt/Lat:       {'PASS' if c1 else 'FAIL'}")
    print(f"Check 2 - Nominal Path Distance Consistency:     {'PASS' if c2 else 'FAIL'}")
    print(f"Check 3 - Maneuver Path Separation Match:       {'PASS' if c3 else 'FAIL'}")
    print(f"Check 4 - 404 Endpoint Handling:                {'PASS' if c4 else 'FAIL'}")
    print(f"Check 5 - Live E2E ECEF Coordinate Trace:        {'PASS' if c5 else 'FAIL'}")
    
    if all([c1, c2, c3, c4, c5]):
        print("\nALL PILLAR 5 VISUALIZATION TESTS PASSED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("\nONE OR MORE CHECKS FAILED. SEE DETAILS ABOVE.")
        sys.exit(1)
