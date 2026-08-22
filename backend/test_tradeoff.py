import sys
import httpx
from app.models import ManeuverOption
from app.services.tradeoff import rank_options

BASE_URL = "http://127.0.0.1:8000"

def test_1_critical_override() -> bool:
    print("\n--- [TEST 1] Critical Conjunction Warning Override Test ---")
    
    original_threat_dist = 10.0
    
    # 3 mock options:
    # Option 1 (small burn): achieves 12km separation, 1kg fuel, no secondary warnings
    opt1 = ManeuverOption(
        option_id="mnv_45701_1",
        label="small burn",
        delta_v_ms=1.5,
        fuel_cost_kg=1.0,
        resulting_min_distance_km=12.0,
        resulting_distance_cw=12.0,
        resulting_distance_sgp4=12.0,
        cw_divergence_flag=False,
        burn_direction=[0.0, 1.0, 0.0],
        time_to_burn_execution_s=1800.0,
        secondary_conjunction_warning=None
    )
    
    # Option 2 (medium burn): achieves 18km separation, 2.5kg fuel, no secondary warnings
    opt2 = ManeuverOption(
        option_id="mnv_45701_2",
        label="medium burn",
        delta_v_ms=4.2,
        fuel_cost_kg=2.5,
        resulting_min_distance_km=18.0,
        resulting_distance_cw=18.0,
        resulting_distance_sgp4=18.0,
        cw_divergence_flag=False,
        burn_direction=[0.0, 1.0, 0.0],
        time_to_burn_execution_s=1800.0,
        secondary_conjunction_warning=None
    )
    
    # Option 3 (large burn): achieves 35km separation, 8.5kg fuel, but has a CRITICAL secondary conjunction of 2.87 km
    opt3 = ManeuverOption(
        option_id="mnv_45701_3",
        label="large burn",
        delta_v_ms=10.0,
        fuel_cost_kg=8.5,
        resulting_min_distance_km=35.0,
        resulting_distance_cw=35.0,
        resulting_distance_sgp4=35.0,
        cw_divergence_flag=False,
        burn_direction=[0.0, 1.0, 0.0],
        time_to_burn_execution_s=1800.0,
        secondary_conjunction_warning="Warning: creates secondary conjunction at minimum distance 2.87 km"
    )
    
    options = [opt1, opt2, opt3]
    result = rank_options(options, original_threat_dist)
    
    print(f"Recommended Option: {result.recommended_option_id}")
    print(f"Reasoning: '{result.reasoning}'")
    
    # Assertions
    # Option 3 (large burn) must be disqualified (score = 0.0) since 2.87km <= 10.0km original threat.
    opt3_ranked = next((ro for ro in result.ranked_options if ro.option_id == "mnv_45701_3"), None)
    assert opt3_ranked is not None
    print(f"Large burn score: {opt3_ranked.composite_score}")
    assert opt3_ranked.composite_score == 0.0, "Large burn should be disqualified (score 0.0)!"
    
    # Recommended option should be one of the qualified options, but definitely NOT the disqualified large burn
    assert result.recommended_option_id != "mnv_45701_3", "Should not have recommended disqualified large burn!"
    assert result.recommended_option_id in {"mnv_45701_1", "mnv_45701_2"}, "Recommended option should be one of the qualified options!"
    assert "disqualified because it creates a secondary conjunction with a minimum distance of 2.87 km" in result.reasoning
    
    print("PASS: Critical override works. Disqualified the best-separation burn due to a secondary threat closer than the original.")
    return True

def test_2_clean_fallback() -> bool:
    print("\n--- [TEST 2] Clean Fallback (Safety-vs-Fuel Trade-off) ---")
    original_threat_dist = 5.0
    
    # 3 mock options with NO secondary warnings
    opt1 = ManeuverOption(
        option_id="mnv_45701_1",
        label="small burn",
        delta_v_ms=1.5,
        fuel_cost_kg=1.0,
        resulting_min_distance_km=12.0,
        resulting_distance_cw=12.0,
        resulting_distance_sgp4=12.0,
        cw_divergence_flag=False,
        burn_direction=[0.0, 1.0, 0.0],
        time_to_burn_execution_s=1800.0,
        secondary_conjunction_warning=None
    )
    opt2 = ManeuverOption(
        option_id="mnv_45701_2",
        label="medium burn",
        delta_v_ms=4.2,
        fuel_cost_kg=2.5,
        resulting_min_distance_km=25.0,
        resulting_distance_cw=25.0,
        resulting_distance_sgp4=25.0,
        cw_divergence_flag=False,
        burn_direction=[0.0, 1.0, 0.0],
        time_to_burn_execution_s=1800.0,
        secondary_conjunction_warning=None
    )
    opt3 = ManeuverOption(
        option_id="mnv_45701_3",
        label="large burn",
        delta_v_ms=10.0,
        fuel_cost_kg=8.5,
        resulting_min_distance_km=48.0,
        resulting_distance_cw=48.0,
        resulting_distance_sgp4=48.0,
        cw_divergence_flag=False,
        burn_direction=[0.0, 1.0, 0.0],
        time_to_burn_execution_s=1800.0,
        secondary_conjunction_warning=None
    )
    
    options = [opt1, opt2, opt3]
    result = rank_options(options, original_threat_dist)
    
    print(f"Scores:")
    for ro in result.ranked_options:
        print(f"  {ro.label}: {ro.composite_score}")
        
    # Verify recommended ID is populated and reasoning generated
    assert result.recommended_option_id is not None
    assert len(result.reasoning) > 0
    print("PASS: Clean fallback works.")
    return True

def test_3_sorting_verification() -> bool:
    print("\n--- [TEST 3] Sorting Verification ---")
    original_threat_dist = 5.0
    
    opt1 = ManeuverOption(
        option_id="mnv_45701_1", label="small burn", delta_v_ms=1.5, fuel_cost_kg=1.0,
        resulting_min_distance_km=12.0, resulting_distance_cw=12.0, resulting_distance_sgp4=12.0,
        cw_divergence_flag=False, burn_direction=[0.0,1.0,0.0], time_to_burn_execution_s=1800.0
    )
    opt2 = ManeuverOption(
        option_id="mnv_45701_2", label="medium burn", delta_v_ms=4.2, fuel_cost_kg=2.5,
        resulting_min_distance_km=25.0, resulting_distance_cw=25.0, resulting_distance_sgp4=25.0,
        cw_divergence_flag=False, burn_direction=[0.0,1.0,0.0], time_to_burn_execution_s=1800.0
    )
    opt3 = ManeuverOption(
        option_id="mnv_45701_3", label="large burn", delta_v_ms=10.0, fuel_cost_kg=8.5,
        resulting_min_distance_km=48.0, resulting_distance_cw=48.0, resulting_distance_sgp4=48.0,
        cw_divergence_flag=False, burn_direction=[0.0,1.0,0.0], time_to_burn_execution_s=1800.0
    )
    
    options = [opt1, opt2, opt3]
    result = rank_options(options, original_threat_dist)
    
    # Assert descending order of scores
    scores = [ro.composite_score for ro in result.ranked_options]
    print(f"Scores list: {scores}")
    assert scores == sorted(scores, reverse=True), "Scores list is not sorted in descending order!"
    print("PASS: Scores list is correctly sorted in descending order.")
    return True

def test_4_fastapi_endpoints() -> bool:
    print("\n--- [TEST 4] FastAPI Router & 404 Verification ---")
    client = httpx.Client(timeout=30.0)
    
    # 1. Refresh triage to get active alerts
    print("Refreshing triage...")
    r_refresh = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 50.0
    })
    alerts = r_refresh.json()["alerts"]
    assert len(alerts) > 0, "No alerts available"
    
    candidate_id = alerts[0]["candidate_id"]
    
    # 2. Call GET /compare/{candidate_id}
    print(f"Calling GET /compare/{candidate_id}...")
    resp = client.get(f"{BASE_URL}/compare/{candidate_id}")
    assert resp.status_code == 200, f"Compare request failed: {resp.text}"
    
    comparison = resp.json()
    print("FastAPI Response:")
    print(f"  Candidate ID:        {comparison['candidate_id']}")
    print(f"  Recommended Option:  {comparison['recommended_option_id']}")
    print(f"  Reasoning:           {comparison['reasoning']}")
    
    # Verify structure
    assert "candidate_id" in comparison
    assert "ranked_options" in comparison
    assert "recommended_option_id" in comparison
    assert "reasoning" in comparison
    
    # 3. Test 404 path
    resp_404 = client.get(f"{BASE_URL}/compare/99999999")
    print(f"404 verification status: {resp_404.status_code}")
    assert resp_404.status_code == 404
    
    print("PASS: Endpoint checks and 404 verification passed.")
    return True

def test_5_live_trace_compare() -> bool:
    print("\n--- [TEST 5] Live End-to-End Conjunction Comparison Trace ---")
    client = httpx.Client(timeout=90.0)
    
    r_refresh = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 50.0
    })
    alerts = r_refresh.json()["alerts"]
    alert = alerts[0]
    candidate_id = alert["candidate_id"]
    
    resp = client.get(f"{BASE_URL}/compare/{candidate_id}")
    comparison = resp.json()
    
    print(f"\nLive Conjunction Pair: ISS (25544) vs {alert['candidate_name']} ({candidate_id})")
    print(f"Original Threat Miss Distance: {alert['min_distance_km']:.3f} km")
    print(f"Recommended Option:            {comparison['recommended_option_id']}")
    print(f"Reasoning Details:")
    print(f"  \"{comparison['reasoning']}\"")
    
    print("\nRanked Scores:")
    for ro in comparison["ranked_options"]:
        print(f"  - Option {ro['option_id']} ({ro['label']}): Score = {ro['composite_score']:.1f}")
        
    print("PASS: Live comparison trace completed.")
    return True

if __name__ == "__main__":
    print("=========================================================")
    print("    ORBITGUARD PILLAR 4: TRADE-OFF COMPARISON TESTS      ")
    print("=========================================================")
    
    c1 = test_1_critical_override()
    c2 = test_2_clean_fallback()
    c3 = test_3_sorting_verification()
    c4 = test_4_fastapi_endpoints()
    c5 = test_5_live_trace_compare()
    
    print("\n==================== TEST SUMMARY ====================")
    print(f"Check 1 - Critical Warnings Override:           {'PASS' if c1 else 'FAIL'}")
    print(f"Check 2 - Clean Fallback Verification:          {'PASS' if c2 else 'FAIL'}")
    print(f"Check 3 - Composite Scores Sorting:             {'PASS' if c3 else 'FAIL'}")
    print(f"Check 4 - FastAPI Endpoint and 404 Path:        {'PASS' if c4 else 'FAIL'}")
    print(f"Check 5 - Live Conjunction Trace Trace:         {'PASS' if c5 else 'FAIL'}")
    
    if all([c1, c2, c3, c4, c5]):
        print("\nALL PILLAR 4 TRADE-OFF COMPARISON TESTS PASSED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("\nONE OR MORE CHECKS FAILED. SEE DETAILS ABOVE.")
        sys.exit(1)
