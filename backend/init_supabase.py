"""
One-time Supabase table initialization script for OrbitGuard.

Creates the four tables: alerts, approvals, tokens, audit_log.
Safe to run multiple times — uses IF NOT EXISTS.

Usage:
    python3 init_supabase.py
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

from app.services.supabase_client import get_supabase

def create_tables():
    sb = get_supabase()
    
    # Use Supabase's SQL execution via RPC
    # We'll create each table via raw SQL through the postgrest rpc or
    # directly through the supabase dashboard SQL editor.
    # Since supabase-py doesn't have a raw SQL executor, we'll verify
    # table existence by attempting operations and create via REST.
    
    # For table creation, we'll use the Supabase Management API or 
    # simply attempt inserts. The tables should be created via the 
    # Supabase Dashboard SQL Editor with the following SQL:
    
    sql = """
-- Table: alerts
-- Stores conjunction threat alerts from Pillar 1 triage screening
CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    protected_asset_id TEXT NOT NULL,
    candidate_name TEXT NOT NULL,
    candidate_id TEXT NOT NULL UNIQUE,
    min_distance_km DOUBLE PRECISION NOT NULL,
    time_of_closest_approach TIMESTAMPTZ NOT NULL,
    risk_score DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    mission_priority DOUBLE PRECISION DEFAULT 1.0,
    explanation TEXT,
    explanation_source TEXT,
    explanation_generated_at TIMESTAMPTZ,
    candidate_tle_epoch TIMESTAMPTZ,
    maneuver_options JSONB,
    approval_status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_alerts_candidate_id ON alerts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_alerts_risk_score ON alerts(risk_score DESC);

-- Table: approvals
-- Records operator-authorized maneuver decisions from Pillar 6
CREATE TABLE IF NOT EXISTS approvals (
    id BIGSERIAL PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    chosen_option_id TEXT NOT NULL,
    approved_by TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    confirmation_token TEXT NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'approved',
    delta_v_ms DOUBLE PRECISION NOT NULL,
    fuel_cost_kg DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approvals_candidate_id ON approvals(candidate_id);

-- Table: tokens
-- Short-lived single-use confirmation tokens for Pillar 6 approval flow
CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL,
    option_id TEXT NOT NULL,
    expiry TIMESTAMPTZ NOT NULL
);

-- Table: audit_log
-- Tamper-evident, append-only cryptographic hash chain from Pillar 7
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    pillar INTEGER NOT NULL,
    action TEXT NOT NULL,
    candidate_id TEXT,
    actor TEXT,
    payload JSONB NOT NULL,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_pillar ON audit_log(pillar);
"""
    
    print("=" * 60)
    print("  ORBITGUARD SUPABASE TABLE INITIALIZATION")
    print("=" * 60)
    print()
    print("Please run the following SQL in your Supabase Dashboard")
    print("SQL Editor (https://supabase.com/dashboard) to create")
    print("the required tables:")
    print()
    print(sql)
    print("=" * 60)
    
    # Verify connectivity by attempting a simple query on each table
    print("\nVerifying Supabase connectivity...")
    try:
        sb.table("alerts").select("id").limit(1).execute()
        print("  ✓ alerts table accessible")
    except Exception as e:
        print(f"  ✗ alerts table: {e}")
        print("    → Run the SQL above in Supabase Dashboard first")
        return False
        
    try:
        sb.table("approvals").select("id").limit(1).execute()
        print("  ✓ approvals table accessible")
    except Exception as e:
        print(f"  ✗ approvals table: {e}")
        return False
        
    try:
        sb.table("tokens").select("token").limit(1).execute()
        print("  ✓ tokens table accessible")
    except Exception as e:
        print(f"  ✗ tokens table: {e}")
        return False
        
    try:
        sb.table("audit_log").select("id").limit(1).execute()
        print("  ✓ audit_log table accessible")
    except Exception as e:
        print(f"  ✗ audit_log table: {e}")
        return False
    
    print("\n✓ All tables verified. Supabase is ready for OrbitGuard.")
    return True

if __name__ == "__main__":
    success = create_tables()
    sys.exit(0 if success else 1)
