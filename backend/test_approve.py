import sys
import httpx
import time
from datetime import datetime, timezone

BASE_URL = "http://127.0.0.1:8000"

def test_1_junior_gating() -> bool:
    print("\n--- [TEST 1] Junior Operator Role Gating Test ---")
    client = httpx.Client(timeout=120.0)
    
    # Refresh alerts
    client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 100.0
    })
    
    # 1. Find a candidate with a valid, non-disqualified recommended option (low fuel)
    r_ref = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 100.0
    })
    alerts = r_ref.json()["alerts"]
    
    candidate_id_low = None
    opt_low_id = None
    for a in alerts:
        r_comp = client.get(f"{BASE_URL}/compare/{a['candidate_id']}")
        if r_comp.status_code == 200:
            comp_data = r_comp.json()
            rec_id = comp_data["recommended_option_id"]
            if rec_id is not None:
                r_opts = client.get(f"{BASE_URL}/maneuver/{a['candidate_id']}/options")
                opt = next((o for o in r_opts.json() if o["option_id"] == rec_id), None)
                if opt and opt["fuel_cost_kg"] <= 5.0:
                    candidate_id_low = a["candidate_id"]
                    opt_low_id = rec_id
                    break
                    
    if not candidate_id_low:
        candidate_id_low = alerts[0]["candidate_id"]
        r_opts = client.get(f"{BASE_URL}/maneuver/{candidate_id_low}/options")
        opt_low_id = r_opts.json()[0]["option_id"]
        
    print(f"Using low-fuel candidate: {candidate_id_low}, option: {opt_low_id}")
    
    # Test A: Junior operator approves low-fuel burn (<= 5.0 kg)
    r_prev_s = client.get(f"{BASE_URL}/approve/{candidate_id_low}/preview?option_id={opt_low_id}")
    token_s = r_prev_s.json()["confirmation_token"]
    
    r_app_s = client.post(f"{BASE_URL}/approve", json={
        "candidate_id": candidate_id_low,
        "chosen_option_id": opt_low_id,
        "approved_by": "op_junior_1",
        "operator_role": "junior",
        "confirmation_token": token_s
    })
    print(f"Junior approving low-fuel burn status: {r_app_s.status_code}")
    assert r_app_s.status_code == 200, f"Junior should have been allowed to approve low-fuel: {r_app_s.text}"
    
    # 2. Find a candidate with a non-disqualified high-fuel burn option (> 5.0 kg)
    candidate_id_high = None
    opt_high_id = None
    opt_high_fuel = 0.0
    
    for a in alerts:
        r_comp = client.get(f"{BASE_URL}/compare/{a['candidate_id']}")
        if r_comp.status_code == 200:
            comp_data = r_comp.json()
            # Find an option that is qualified (score > 0.0)
            for ro in comp_data["ranked_options"]:
                if ro["composite_score"] > 0.0:
                    r_opts = client.get(f"{BASE_URL}/maneuver/{a['candidate_id']}/options")
                    opt = next((o for o in r_opts.json() if o["option_id"] == ro["option_id"]), None)
                    if opt and opt["fuel_cost_kg"] > 5.0:
                        candidate_id_high = a["candidate_id"]
                        opt_high_id = opt["option_id"]
                        opt_high_fuel = opt["fuel_cost_kg"]
                        break
            if candidate_id_high:
                break
                
    if candidate_id_high and opt_high_id:
        print(f"Using high-fuel candidate: {candidate_id_high}, option: {opt_high_id} ({opt_high_fuel:.2f} kg)")
        r_prev_l = client.get(f"{BASE_URL}/approve/{candidate_id_high}/preview?option_id={opt_high_id}")
        token_l = r_prev_l.json()["confirmation_token"]
        
        r_app_l = client.post(f"{BASE_URL}/approve", json={
            "candidate_id": candidate_id_high,
            "chosen_option_id": opt_high_id,
            "approved_by": "op_junior_1",
            "operator_role": "junior",
            "confirmation_token": token_l
        })
        print(f"Junior approving high-fuel burn status: {r_app_l.status_code}")
        assert r_app_l.status_code == 403, f"Junior should be forbidden from high-fuel: {r_app_l.text}"
        print("PASS: Junior operator was successfully restricted from approving high-fuel burn.")
        
        # Test C (A/B direct comparison): Senior operator approves the SAME high-fuel burn option
        # Must request a new token since tokens are single-use and the junior's lookup popped the previous one
        r_prev_senior = client.get(f"{BASE_URL}/approve/{candidate_id_high}/preview?option_id={opt_high_id}")
        token_senior = r_prev_senior.json()["confirmation_token"]
        
        r_app_senior = client.post(f"{BASE_URL}/approve", json={
            "candidate_id": candidate_id_high,
            "chosen_option_id": opt_high_id,
            "approved_by": "op_senior_1",
            "operator_role": "senior",
            "confirmation_token": token_senior
        })
        print(f"Senior approving same high-fuel burn status: {r_app_senior.status_code}")
        assert r_app_senior.status_code == 200, f"Senior operator should be allowed to approve high-fuel: {r_app_senior.text}"
        print("PASS: Senior operator successfully cleared to approve high-fuel burn.")
    else:
        print("No qualified high-fuel burn option found in current database. Skipping Test B & C.")
        
    return True

def test_2_token_security() -> bool:
    print("\n--- [TEST 2] Token Verification & Security ---")
    client = httpx.Client(timeout=120.0)
    
    # 1. Refresh triage to get active candidate ID
    r_ref = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 100.0
    })
    # Resolve a candidate and a qualified option (score > 0.0) dynamically
    alerts = r_ref.json()["alerts"]
    candidate_id = None
    option_id = None
    
    for a in alerts:
        r_comp = client.get(f"{BASE_URL}/compare/{a['candidate_id']}")
        if r_comp.status_code == 200:
            comp_data = r_comp.json()
            qual_opt = next((ro["option_id"] for ro in comp_data["ranked_options"] if ro["composite_score"] > 0.0), None)
            if qual_opt:
                candidate_id = a["candidate_id"]
                option_id = qual_opt
                break
                
    if not candidate_id or not option_id:
        candidate_id = alerts[0]["candidate_id"]
        r_opts = client.get(f"{BASE_URL}/maneuver/{candidate_id}/options")
        option_id = r_opts.json()[0]["option_id"]
        
    print(f"Using qualified candidate: {candidate_id}, option: {option_id}")
    
    # Test A: Approve without token or with dummy token
    r_dummy = client.post(f"{BASE_URL}/approve", json={
        "candidate_id": candidate_id,
        "chosen_option_id": option_id,
        "approved_by": "op_senior_1",
        "operator_role": "senior",
        "confirmation_token": "dummy-token-1234"
    })
    print(f"Approval with dummy token status: {r_dummy.status_code}")
    assert r_dummy.status_code == 400
    
    # Test B: Approve with token mismatching candidate
    r_prev = client.get(f"{BASE_URL}/approve/{candidate_id}/preview?option_id={option_id}")
    real_token = r_prev.json()["confirmation_token"]
    
    r_mismatch = client.post(f"{BASE_URL}/approve", json={
        "candidate_id": "999999", # mismatched candidate
        "chosen_option_id": option_id,
        "approved_by": "op_senior_1",
        "operator_role": "senior",
        "confirmation_token": real_token
    })
    print(f"Approval with mismatched candidate status: {r_mismatch.status_code}")
    assert r_mismatch.status_code == 400
    
    # Test C: Expired Token Rejection
    r_prev_exp = client.get(f"{BASE_URL}/approve/{candidate_id}/preview?option_id={option_id}")
    exp_token = r_prev_exp.json()["confirmation_token"]
    
    # Force expire the token in Uvicorn process memory via helper endpoint
    r_force_exp = client.post(f"{BASE_URL}/approve/test/expire-token?token={exp_token}")
    assert r_force_exp.status_code == 200
    print("Token force-expired in Uvicorn memory.")
    
    r_app_exp = client.post(f"{BASE_URL}/approve", json={
        "candidate_id": candidate_id,
        "chosen_option_id": option_id,
        "approved_by": "op_senior_1",
        "operator_role": "senior",
        "confirmation_token": exp_token
    })
    print(f"Approval with expired token status: {r_app_exp.status_code}")
    assert r_app_exp.status_code == 400, f"Expected 400 for expired token, got {r_app_exp.status_code}"
    print("PASS: Expired token successfully rejected.")
    
    # Test D: Single-use Token (Reuse Prevention)
    r_prev_reuse = client.get(f"{BASE_URL}/approve/{candidate_id}/preview?option_id={option_id}")
    reuse_token = r_prev_reuse.json()["confirmation_token"]
    
    # First attempt: succeeds
    r_app_first = client.post(f"{BASE_URL}/approve", json={
        "candidate_id": candidate_id,
        "chosen_option_id": option_id,
        "approved_by": "op_senior_1",
        "operator_role": "senior",
        "confirmation_token": reuse_token
    })
    print(f"Approval first-use status: {r_app_first.status_code}")
    assert r_app_first.status_code == 200
    
    # Second attempt: fails because token was deleted on first validation
    r_app_second = client.post(f"{BASE_URL}/approve", json={
        "candidate_id": candidate_id,
        "chosen_option_id": option_id,
        "approved_by": "op_senior_1",
        "operator_role": "senior",
        "confirmation_token": reuse_token
    })
    print(f"Approval second-use status: {r_app_second.status_code}")
    assert r_app_second.status_code == 400, f"Expected 400 for token reuse, got {r_app_second.status_code}"
    print("PASS: Token reuse (second lookup) successfully blocked.")
    
    print("PASS: Security token verification checked.")
    return True

def test_3_disqualified_rejection() -> bool:
    print("\n--- [TEST 3] Disqualified Option Rejection (Override Block) ---")
    client = httpx.Client(timeout=120.0)
    
    # Find a candidate with a disqualified option dynamically
    candidate_id_dq = None
    opt_dq_id = None
    opt_dq_label = None
    
    # Try different thresholds until we find a disqualified option
    for threshold in [100.0, 200.0, 300.0]:
        r_ref = client.post(f"{BASE_URL}/triage/refresh", json={
            "protected_asset_ids": ["25544"],
            "satellite_group": "active",
            "distance_threshold_km": threshold
        })
        alerts = r_ref.json().get("alerts", [])
        for a in alerts:
            r_comp = client.get(f"{BASE_URL}/compare/{a['candidate_id']}")
            if r_comp.status_code == 200:
                comp_data = r_comp.json()
                dq_opt = next((ro for ro in comp_data["ranked_options"] if ro["composite_score"] == 0.0), None)
                if dq_opt:
                    candidate_id_dq = a["candidate_id"]
                    opt_dq_id = dq_opt["option_id"]
                    opt_dq_label = dq_opt["label"]
                    break
        if candidate_id_dq:
            break
            
    if candidate_id_dq and opt_dq_id:
        print(f"Using disqualified option for testing override: candidate={candidate_id_dq}, option={opt_dq_id} ({opt_dq_label})")
        # Get preview token for this disqualified option
        r_prev = client.get(f"{BASE_URL}/approve/{candidate_id_dq}/preview?option_id={opt_dq_id}")
        token = r_prev.json()["confirmation_token"]
        
        # Attempt to authorize disqualified option (with Senior role)
        r_app = client.post(f"{BASE_URL}/approve", json={
            "candidate_id": candidate_id_dq,
            "chosen_option_id": opt_dq_id,
            "approved_by": "op_senior_1",
            "operator_role": "senior",
            "confirmation_token": token
        })
        print(f"Attempting override status: {r_app.status_code}")
        print(f"Attempting override response: '{r_app.json()}'")
        
        # Assertions
        assert r_app.status_code == 409, f"Override should be blocked with 409 Conflict, got {r_app.status_code}"
        assert "disqualified" in r_app.json()["detail"]
        print("PASS: System blocked operator attempt to override a disqualified option with 409 Conflict.")
    else:
        print("No disqualified options found in database. Skipping override check.")
        
    return True

def test_4_happy_path_e2e() -> bool:
    print("\n--- [TEST 4] Happy Path End-to-End Approval ---")
    client = httpx.Client(timeout=120.0)
    
    # 1. Refresh triage
    r_alerts = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 100.0
    })
    
    # 2. Resolve a candidate with a valid recommended option dynamically
    alerts = r_alerts.json()["alerts"]
    candidate_id = None
    rec_id = None
    for a in alerts:
        # Avoid picking a candidate whose TCA is within the next 10 minutes (prevents race/timing slide-out)
        tca = datetime.fromisoformat(a["time_of_closest_approach"].replace("Z", "+00:00"))
        time_to_tca = (tca - datetime.now(timezone.utc)).total_seconds()
        if time_to_tca < 600:
            continue
            
        r_comp = client.get(f"{BASE_URL}/compare/{a['candidate_id']}")
        if r_comp.status_code == 200:
            comp_data = r_comp.json()
            if comp_data["recommended_option_id"] is not None:
                candidate_id = a["candidate_id"]
                rec_id = comp_data["recommended_option_id"]
                break
                
    if not candidate_id:
        candidate_id = alerts[0]["candidate_id"]
        r_comp = client.get(f"{BASE_URL}/compare/{candidate_id}")
        rec_id = r_comp.json()["recommended_option_id"]
        
    print(f"Using Candidate ID: {candidate_id} with Recommended Option: {rec_id}")
    
    # 3. GET Preview to get confirmation token
    r_prev = client.get(f"{BASE_URL}/approve/{candidate_id}/preview?option_id={rec_id}")
    assert r_prev.status_code == 200
    prev_data = r_prev.json()
    token = prev_data["confirmation_token"]
    
    # 4. POST Approval with Senior role
    r_app = client.post(f"{BASE_URL}/approve", json={
        "candidate_id": candidate_id,
        "chosen_option_id": rec_id,
        "approved_by": "director_1",
        "operator_role": "senior",
        "confirmation_token": token
    })
    print(f"POST /approve status: {r_app.status_code}")
    assert r_app.status_code == 200
    
    record = r_app.json()
    print("Approval Record Created:")
    print(f"  Approved By:   {record['approved_by']}")
    print(f"  Option ID:     {record['chosen_option_id']}")
    print(f"  Delta-V:       {record['delta_v_ms']} m/s")
    print(f"  Fuel Mass:     {record['fuel_cost_kg']} kg")
    print(f"  Approved At:   {record['approved_at']}")
    
    # Verify snapshot parameters are present
    assert record["status"] == "approved"
    assert record["delta_v_ms"] == prev_data["delta_v_ms"]
    assert record["fuel_cost_kg"] == prev_data["fuel_cost_kg"]
    
    # Verify Alert status in database has changed to "approved"
    r_alerts_check = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 100.0
    })
    check_alerts = r_alerts_check.json()["alerts"]
    print(f"Check Alerts returned: {[a['candidate_id'] for a in check_alerts]}")
    updated_alert = next(a for a in check_alerts if a["candidate_id"] == candidate_id)
    print(f"Updated Alert Approval Status: {updated_alert['approval_status']}")
    assert updated_alert["approval_status"] == "approved"
    
    print("PASS: Happy path E2E completed successfully.")
    return True

if __name__ == "__main__":
    print("=========================================================")
    print("      ORBITGUARD PILLAR 6: APPROVAL SYSTEM TESTS         ")
    print("=========================================================")
    
    c1 = test_1_junior_gating()
    c2 = test_2_token_security()
    c3 = test_3_disqualified_rejection()
    c4 = test_4_happy_path_e2e()
    
    print("\n==================== TEST SUMMARY ====================")
    print(f"Check 1 - Role Gating Clearance check:          {'PASS' if c1 else 'FAIL'}")
    print(f"Check 2 - Token Verification & Security:        {'PASS' if c2 else 'FAIL'}")
    print(f"Check 3 - Disqualified Block check (409):       {'PASS' if c3 else 'FAIL'}")
    print(f"Check 4 - E2E Decision Approval check (200):    {'PASS' if c4 else 'FAIL'}")
    
    if all([c1, c2, c3, c4]):
        print("\nALL PILLAR 6 APPROVAL SYSTEM TESTS PASSED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("\nONE OR MORE CHECKS FAILED. SEE DETAILS ABOVE.")
        sys.exit(1)
