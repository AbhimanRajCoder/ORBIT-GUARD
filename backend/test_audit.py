import os
import httpx
import json
from dotenv import load_dotenv

load_dotenv()

# We need path configuration to import app modules if running directly
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.supabase_client import get_supabase

BASE_URL = "http://127.0.0.1:8000"

def clean_database():
    """
    Deletes all rows in the Supabase audit_log, alerts, approvals, and tokens tables to start fresh.
    """
    try:
        sb = get_supabase()
        # Delete all records
        sb.table("audit_log").delete().neq("id", 0).execute()
        sb.table("approvals").delete().neq("id", 0).execute()
        sb.table("tokens").delete().neq("token", "").execute()
        sb.table("alerts").delete().neq("id", 0).execute()
        print("Cleaned up existing Supabase data.")
    except Exception as e:
        print(f"Could not clean up Supabase data: {e}")

def run_audit_tests():
    print("=========================================================")
    print("      ORBITGUARD PILLAR 7: AUDIT TRAIL TESTS             ")
    print("=========================================================")
    
    clean_database()
    
    client = httpx.Client(timeout=60.0)
    
    # -------------------------------------------------------------
    # STEP 1: Perform operations across all prior pillars to trigger logging
    # -------------------------------------------------------------
    print("\n--- [STEP 1] Generating Activity across Pillars 1-6 ---")
    
    # Pillar 1: Triage Refresh
    print("Pillar 1: Refreshing threat triage...")
    r_refresh = client.post(f"{BASE_URL}/triage/refresh", json={
        "protected_asset_ids": ["25544"],
        "satellite_group": "active",
        "distance_threshold_km": 100.0
    })
    assert r_refresh.status_code == 200
    alerts = r_refresh.json()["alerts"]
    # Find a candidate that does not have maneuver options cached yet to ensure fresh generation logging
    candidate_id = next((a["candidate_id"] for a in alerts if not a.get("maneuver_options")), None)
    if not candidate_id:
        candidate_id = alerts[0]["candidate_id"]
    print(f"Alerts generated. Selected candidate target: {candidate_id}")
    
    # Pillar 2: Risk Explanation
    print("Pillar 2: Requesting plain-language explanation...")
    r_exp = client.get(f"{BASE_URL}/explain/{candidate_id}")
    assert r_exp.status_code == 200
    
    # Pillar 3: Maneuver Options
    print("Pillar 3: Generating maneuver options...")
    r_opts = client.get(f"{BASE_URL}/maneuver/{candidate_id}/options")
    assert r_opts.status_code == 200
    options = r_opts.json()
    # Find a qualified option to approve
    r_comp = client.get(f"{BASE_URL}/compare/{candidate_id}")
    comp = r_comp.json()
    chosen_opt_id = next((ro["option_id"] for ro in comp["ranked_options"] if ro["composite_score"] > 0.0), None)
    if not chosen_opt_id:
        chosen_opt_id = options[0]["option_id"]
    
    # Pillar 4: Trade-off Comparison
    print("Pillar 4: Querying trade-off rankings...")
    assert r_comp.status_code == 200
    
    # Pillar 5: Trajectory Visualization
    print("Pillar 5: Sampling coordinate trajectories...")
    r_vis = client.get(f"{BASE_URL}/visualize/{candidate_id}?window_hours=1&step_seconds=60")
    assert r_vis.status_code == 200
    
    # Pillar 6: Human Approval
    print("Pillar 6: Requesting preview and operator approval...")
    r_prev = client.get(f"{BASE_URL}/approve/{candidate_id}/preview?option_id={chosen_opt_id}")
    assert r_prev.status_code == 200
    token = r_prev.json()["confirmation_token"]
    
    # Approval rejection logging check (wrong token)
    r_reject = client.post(f"{BASE_URL}/approve", json={
        "candidate_id": candidate_id,
        "chosen_option_id": chosen_opt_id,
        "approved_by": "op_junior_1",
        "operator_role": "junior",
        "confirmation_token": "invalid-token"
    })
    assert r_reject.status_code == 400
    print("Pillar 6: Rejection logged (invalid token).")
    
    # Successful approval logging check
    r_approve = client.post(f"{BASE_URL}/approve", json={
        "candidate_id": candidate_id,
        "chosen_option_id": chosen_opt_id,
        "approved_by": "director_1",
        "operator_role": "senior",
        "confirmation_token": token
    })
    assert r_approve.status_code == 200
    print("Pillar 6: Approval granted logged.")
    
    # -------------------------------------------------------------
    # STEP 2: Verify Audit Log Completeness and Cryptographic Chain
    # -------------------------------------------------------------
    print("\n--- [STEP 2] Verifying Complete Audit Log Integrity ---")
    
    r_audit = client.get(f"{BASE_URL}/audit")
    assert r_audit.status_code == 200
    entries = r_audit.json()
    print(f"Total audit entries logged: {len(entries)}")
    
    for entry in entries:
        print(f"  Entry {entry['id']}: Pillar {entry['pillar']} | Action: {entry['action']} | Hash: {entry['entry_hash'][:12]}...")
        
    # Check that we have entries for all pillars
    pillars_logged = {e["pillar"] for e in entries}
    print(f"Logged Pillars in DB: {pillars_logged}")
    assert 1 in pillars_logged, "Pillar 1 triage refresh was not logged"
    assert 2 in pillars_logged, "Pillar 2 explanation was not logged"
    assert 3 in pillars_logged, "Pillar 3 maneuver options generation was not logged"
    assert 4 in pillars_logged, "Pillar 4 tradeoff comparison was not logged"
    assert 5 in pillars_logged, "Pillar 5 visualization requested was not logged"
    assert 6 in pillars_logged, "Pillar 6 approval was not logged"
    
    # Verify cryptographic chaining integrity
    r_verify = client.get(f"{BASE_URL}/audit/verify")
    assert r_verify.status_code == 200
    verify_data = r_verify.json()
    print(f"Chain integrity check: is_valid = {verify_data['is_valid']}, broken_at_id = {verify_data['broken_at_id']}")
    assert verify_data["is_valid"] is True
    assert verify_data["broken_at_id"] is None
    print("PASS: Cryptographic chain is fully valid on standard execution.")
    
    # -------------------------------------------------------------
    # STEP 3: Verify Tamper-Evident Detection
    # -------------------------------------------------------------
    print("\n--- [STEP 3] Testing Tamper-Evident Chain Break Detection ---")
    
    # Find a record to tamper with (e.g. the first entry)
    target_id = entries[0]["id"]
    print(f"Tampering with record ID {target_id} in Supabase database directly...")
    
    sb = get_supabase()
    # Read original payload
    response = sb.table("audit_log").select("payload").eq("id", target_id).execute()
    assert response.data, f"Could not find audit log entry {target_id}"
    payload = response.data[0]["payload"]
    
    # Inject fake details (e.g. change the threshold parameter from 100.0 to 10.0)
    payload["threshold_km"] = 10.0
    
    # Update Supabase
    sb.table("audit_log").update({"payload": payload}).eq("id", target_id).execute()
    print("Database record successfully altered in Supabase.")
    
    # Call verify endpoint and assert it returns invalid and points to target_id
    r_verify_tampered = client.get(f"{BASE_URL}/audit/verify")
    assert r_verify_tampered.status_code == 200
    verify_tampered_data = r_verify_tampered.json()
    print(f"Post-Tampering Verification status: is_valid = {verify_tampered_data['is_valid']}, broken_at_id = {verify_tampered_data['broken_at_id']}")
    
    assert verify_tampered_data["is_valid"] is False
    assert verify_tampered_data["broken_at_id"] == target_id
    print("PASS: Tamper-evident detection successfully caught the break and located the exact tampered record.")
    
    print("\n==================== TEST SUMMARY ====================")
    print("Check 1 - Pillars 1-6 Audit Trail Logging:       PASS")
    print("Check 2 - Cryptographic Hash Chain Validation:  PASS")
    print("Check 3 - Tamper-Evident Break Detection (Supabase): PASS")
    print("\nALL PILLAR 7 AUDIT TRAIL CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_audit_tests()
