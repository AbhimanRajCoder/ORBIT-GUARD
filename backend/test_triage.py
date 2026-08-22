import time
import sys
from datetime import datetime, timezone, timedelta
import httpx

# Import functions/models for risk score unit testing
from app.services.risk_score import calculate_risk_score
from app.models import ConjunctionCandidate

BASE_URL = "http://127.0.0.1:8000"

def run_risk_score_unit_tests():
    print("--- Running Risk Score Unit Tests ---")
    now_utc = datetime.now(timezone.utc)
    
    # Base candidate: 2.5 km distance (threshold 5.0 km), 12 hours to closest approach
    candidate = ConjunctionCandidate(
        object_name="Synthetic Candidate",
        norad_id="99999",
        min_distance_km=2.5,
        time_of_closest_approach=now_utc + timedelta(hours=12)
    )
    
    # 1. Base score verification:
    # distance_factor = 1.0 - (2.5 / 5.0) = 0.5
    # time_factor = 1.0 - (12.0 / 48.0) = 0.75
    # base_score = (0.5 * 0.7 + 0.75 * 0.3) * 100.0 = (0.35 + 0.225) * 100.0 = 57.5
    score_base = calculate_risk_score(candidate, threshold_km=5.0, mission_priority=1.0)
    assert abs(score_base - 57.5) < 0.2, f"Base score mismatch: expected 57.5, got {score_base}"
    print(f"Pass: Base score calculation = {score_base}")
    
    # 2. Mission priority multiplier changes the score:
    # 57.5 * 1.2 = 69.0
    score_prio = calculate_risk_score(candidate, threshold_km=5.0, mission_priority=1.2)
    assert abs(score_prio - 69.0) < 0.2, f"Prio score mismatch: expected 69.0, got {score_prio}"
    assert score_prio != score_base, "Priority multiplier did not change score"
    print(f"Pass: Priority multiplier (1.2) changes score to = {score_prio}")
    
    # 3. Clamping to [0, 100] works even with extreme mission_priority
    # 57.5 * 10.0 = 575.0 -> Clamped to 100.0
    score_clamp = calculate_risk_score(candidate, threshold_km=5.0, mission_priority=10.0)
    assert score_clamp == 100.0, f"Clamping check failed: expected 100.0, got {score_clamp}"
    print(f"Pass: Extreme priority score clamp = {score_clamp}")
    print("--- Risk Score Unit Tests Passed ---\n")

def test_api_checks():
    client = httpx.Client(timeout=30.0)
    
    # Make sure server is up
    try:
        resp = client.get(f"{BASE_URL}/health")
        resp.raise_for_status()
        print(f"System health check passed: {resp.json()}")
    except Exception as e:
        print(f"Error connecting to API server: {e}. Ensure Uvicorn is running.")
        sys.exit(1)

    # CHECK 7a: GET /triage/alerts consistency (before any refresh has run)
    # The uvicorn server might have restarted, so it's a fresh instance.
    print("--- CHECK 7a: GET before refresh ---")
    resp = client.get(f"{BASE_URL}/triage/alerts")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    initial_alerts = resp.json()
    print(f"GET /triage/alerts returned {len(initial_alerts)} alerts (expected: empty).")
    
    # CHECK 5: Invalid/edge-case inputs
    print("--- CHECK 5: Invalid/edge-case inputs ---")
    # Empty protected_asset_ids
    resp = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": [],
        "satellite_group": "active",
        "distance_threshold_km": 50.0
    })
    print(f"Empty protected_asset_ids status: {resp.status_code}, body: {resp.json()}")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert resp.json()["alerts"] == [], "Expected empty alerts list"

    # Non-existent group (validation checks)
    resp = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "nonexistent_group",
        "distance_threshold_km": 50.0
    })
    print(f"Nonexistent group status: {resp.status_code} (expected 422)")
    assert resp.status_code == 422, f"Expected 422, got {resp.status_code}"

    # Non-existent protected NORAD ID ("99999999")
    resp = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["99999999"],
        "satellite_group": "active",
        "distance_threshold_km": 50.0
    })
    print(f"Nonexistent asset status: {resp.status_code}, body: {resp.json()}")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert resp.json()["alerts"] == [], "Expected empty alerts list"

    # CHECK 2: Threshold boundary behavior
    print("--- CHECK 2: Threshold boundary behavior ---")
    # Negative threshold (invalid)
    resp = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": -5.0
    })
    print(f"Negative threshold status: {resp.status_code} (expected 422)")
    assert resp.status_code == 422, f"Expected 422, got {resp.status_code}"

    # 0.0 threshold (valid, empty list)
    resp = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 0.0
    })
    print(f"0.0 threshold status: {resp.status_code}, body size: {len(resp.json()['alerts'])}")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert len(resp.json()["alerts"]) == 0

    # 5.0 threshold (valid tight, potentially empty list depending on data)
    resp = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 5.0
    })
    alerts_5 = resp.json()["alerts"]
    print(f"5.0 threshold status: {resp.status_code}, returned {len(alerts_5)} alerts.")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"

    # CHECK 6: Cache behavior (call twice)
    print("--- CHECK 6: Cache and source behavior ---")
    start_time = time.time()
    resp1 = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 50.0
    })
    elapsed1 = time.time() - start_time
    source1 = resp1.json()["source"]
    alerts_50 = resp1.json()["alerts"]
    print(f"Refresh 1 (50km): time={elapsed1:.2f}s, source={source1}, alerts count={len(alerts_50)}")
    
    start_time = time.time()
    resp2 = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 50.0
    })
    elapsed2 = time.time() - start_time
    source2 = resp2.json()["source"]
    print(f"Refresh 2 (50km): time={elapsed2:.2f}s, source={source2}")
    
    assert "cache" in source2.lower(), f"Expected source to be cache, got: {source2}"
    assert elapsed2 < 10.0, f"Expected fast cached response, but took {elapsed2:.2f}s"
    print("Pass: Cache retrieval is fast and reports source: 'cache'")

    # CHECK 1: Regression check - co-location fix holds
    print("--- CHECK 1: Regression check - co-location fix holds ---")
    alerts_by_threshold = {}
    # Fetch at threshold=50 and threshold=100
    for threshold in [50.0, 100.0]:
        resp = client.post(f"{BASE_URL}/triage/refresh", json={
            "protected_asset_ids": ["25544"],
            "satellite_group": "active",
            "distance_threshold_km": threshold
        })
        data = resp.json()
        alerts = data["alerts"]
        alerts_by_threshold[threshold] = alerts
        print(f"Threshold = {threshold} km: screening generated {len(alerts)} alerts.")
        
        # Blocked NORAD IDs
        docked_ids = {"25575", "26400", "26700", "36086", "49044", "67796", "68319", "68837", "68689"}
        
        for alert in alerts:
            cand_id = alert["candidate_id"]
            cand_name = alert["candidate_name"]
            dist = alert["min_distance_km"]
            
            assert cand_id not in docked_ids, f"Fail: excluded ISS module/docked craft {cand_name} (ID: {cand_id}) was found in alerts!"
            assert dist >= 0.5, f"Fail: candidate {cand_name} has min_distance_km = {dist} km, which is under the 0.5 km floor!"
            
    print("Pass: No docked modules / co-located craft or values < 0.5 km found.")

    # CHECK 2 (superset check): results at 100km are a superset of 50km
    alerts_50_backtoback = alerts_by_threshold[50.0]
    alerts_100_backtoback = alerts_by_threshold[100.0]
    ids_50 = {a["candidate_id"] for a in alerts_50_backtoback}
    ids_100 = {a["candidate_id"] for a in alerts_100_backtoback}
    
    assert ids_50.issubset(ids_100), f"Fail: 100km alerts are not a superset of 50km alerts. Difference: {ids_50 - ids_100}"
    print(f"Pass: 100km alerts ({len(alerts_100_backtoback)}) are a superset of 50km alerts ({len(alerts_50_backtoback)})")

    # CHECK 4: Multi-asset handling
    print("--- CHECK 4: Multi-asset handling ---")
    resp_multi = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544", "20580"], # ISS and Hubble
        "satellite_group": "active",
        "distance_threshold_km": 50.0
    })
    assert resp_multi.status_code == 200, f"Expected 200, got {resp_multi.status_code}"
    multi_alerts = resp_multi.json()["alerts"]
    print(f"Multi-asset refresh (ISS + Hubble) generated {len(multi_alerts)} total alerts.")
    
    iss_candidates = []
    hubble_candidates = []
    
    for alert in multi_alerts:
        asset_id = alert["protected_asset_id"]
        cand_id = alert["candidate_id"]
        if asset_id == "25544":
            iss_candidates.append(cand_id)
        elif asset_id == "20580":
            hubble_candidates.append(cand_id)
        else:
            raise AssertionError(f"Alert has unexpected protected_asset_id: {asset_id}")
            
    print(f"ISS alerts count: {len(iss_candidates)}, Hubble alerts count: {len(hubble_candidates)}")
    
    # Assert tag correctness:
    # ISS and Hubble are in completely different orbits (ISS at ~420km altitude, 51.6° incl; Hubble at ~515km altitude, 28.5° incl).
    # Their candidate threat lists should not overlap.
    iss_set = set(iss_candidates)
    hubble_set = set(hubble_candidates)
    overlap = iss_set.intersection(hubble_set)
    assert not overlap, f"Fail: Hubble and ISS candidate lists overlapped! Overlapping IDs: {overlap}"
    assert len(hubble_set) > 0, "Expected Hubble to return some conjunction candidates at 50km threshold"
    print("Pass: Multi-asset screening returns different, non-overlapping candidate sets for Hubble and ISS.")

    # CHECK 7b: GET /triage/alerts consistency
    print("--- CHECK 7b: GET consistency ---")
    resp_get = client.get(f"{BASE_URL}/triage/alerts")
    assert resp_get.status_code == 200, f"Expected 200, got {resp_get.status_code}"
    get_alerts = resp_get.json()
    
    # Sort multi_alerts by risk score descending (since refresh already did that, but we verify)
    sorted_multi_alerts = sorted(multi_alerts, key=lambda x: x["risk_score"], reverse=True)
    
    assert len(get_alerts) == len(sorted_multi_alerts), f"GET size mismatch: expected {len(sorted_multi_alerts)}, got {len(get_alerts)}"
    
    for idx, (alert_get, alert_post) in enumerate(zip(get_alerts, sorted_multi_alerts)):
        assert alert_get["candidate_id"] == alert_post["candidate_id"], f"Mismatch at rank {idx}"
        assert alert_get["risk_score"] == alert_post["risk_score"], f"Score mismatch at rank {idx}"
        
    print("Pass: GET /triage/alerts matches the last refresh response and is correctly sorted.")

if __name__ == "__main__":
    run_risk_score_unit_tests()
    test_api_checks()
    print("\nALL PILLAR 1 VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
