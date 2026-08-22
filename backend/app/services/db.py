import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import json
from pydantic import BaseModel

from app.models import Alert, ManeuverOption
from app.services.supabase_client import get_supabase

import os

logger = logging.getLogger("triage.db")

REFRESH_ID_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "current_refresh.txt"))

def set_current_refresh_timestamp(dt: datetime) -> None:
    os.makedirs(os.path.dirname(REFRESH_ID_FILE), exist_ok=True)
    with open(REFRESH_ID_FILE, "w") as f:
        f.write(dt.isoformat())
    logger.info(f"Updated CURRENT_REFRESH_ID to {dt.isoformat()}")

def get_current_refresh_timestamp() -> Optional[datetime]:
    if not os.path.exists(REFRESH_ID_FILE):
        return None
    try:
        with open(REFRESH_ID_FILE, "r") as f:
            val = f.read().strip()
            if val:
                return datetime.fromisoformat(val.replace("Z", "+00:00"))
    except Exception as e:
        logger.error(f"Error reading refresh timestamp: {e}")
    return None

def get_alert_by_candidate_id(candidate_id: str) -> Optional[Alert]:
    """Fetches a single alert from Supabase by candidate ID."""
    sb = get_supabase()
    response = sb.table("alerts").select("*").eq("candidate_id", candidate_id).execute()
    
    if not response.data:
        return None
        
    row = response.data[0]
    
    # Parse maneuver_options back from JSONB
    maneuver_options = None
    if row.get("maneuver_options"):
        maneuver_options = [ManeuverOption(**opt) for opt in row["maneuver_options"]]
        
    # Handle datetime fields
    def parse_dt(dt_str):
        if not dt_str: return None
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        
    return Alert(
        protected_asset_id=row["protected_asset_id"],
        candidate_name=row["candidate_name"],
        candidate_id=row["candidate_id"],
        min_distance_km=row["min_distance_km"],
        time_of_closest_approach=parse_dt(row["time_of_closest_approach"]),
        risk_score=row["risk_score"],
        created_at=parse_dt(row["created_at"]),
        mission_priority=row["mission_priority"],
        explanation=row.get("explanation"),
        explanation_source=row.get("explanation_source"),
        explanation_generated_at=parse_dt(row.get("explanation_generated_at")),
        candidate_tle_epoch=parse_dt(row.get("candidate_tle_epoch")),
        maneuver_options=maneuver_options,
        approval_status=row.get("approval_status", "pending")
    )

def get_all_alerts_dict() -> Dict[str, Alert]:
    """Fetches all alerts from Supabase and returns a dict mapping candidate_id to Alert."""
    sb = get_supabase()
    response = sb.table("alerts").select("*").execute()
    
    alerts_dict = {}
    for row in response.data:
        maneuver_options = None
        if row.get("maneuver_options"):
            maneuver_options = [ManeuverOption(**opt) for opt in row["maneuver_options"]]
            
        def parse_dt(dt_str):
            if not dt_str: return None
            return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            
        alerts_dict[row["candidate_id"]] = Alert(
            protected_asset_id=row["protected_asset_id"],
            candidate_name=row["candidate_name"],
            candidate_id=row["candidate_id"],
            min_distance_km=row["min_distance_km"],
            time_of_closest_approach=parse_dt(row["time_of_closest_approach"]),
            risk_score=row["risk_score"],
            created_at=parse_dt(row["created_at"]),
            mission_priority=row["mission_priority"],
            explanation=row.get("explanation"),
            explanation_source=row.get("explanation_source"),
            explanation_generated_at=parse_dt(row.get("explanation_generated_at")),
            candidate_tle_epoch=parse_dt(row.get("candidate_tle_epoch")),
            maneuver_options=maneuver_options,
            approval_status=row.get("approval_status", "pending")
        )
    return alerts_dict

def upsert_alerts(alerts: List[Alert]) -> None:
    """Bulk upserts alerts into Supabase."""
    sb = get_supabase()
    
    if not alerts:
        # If alerts list is empty, delete ALL alerts from the database!
        sb.table("alerts").delete().neq("candidate_id", "none").execute()
        logger.info("Cleared all alerts from Supabase (empty refresh set).")
        return
    
    data_to_upsert = []
    for alert in alerts:
        row = {
            "protected_asset_id": alert.protected_asset_id,
            "candidate_name": alert.candidate_name,
            "candidate_id": alert.candidate_id,
            "min_distance_km": alert.min_distance_km,
            "time_of_closest_approach": alert.time_of_closest_approach.isoformat(),
            "risk_score": alert.risk_score,
            "created_at": alert.created_at.isoformat(),
            "mission_priority": alert.mission_priority,
            "explanation": alert.explanation,
            "explanation_source": alert.explanation_source,
            "explanation_generated_at": alert.explanation_generated_at.isoformat() if alert.explanation_generated_at else None,
            "candidate_tle_epoch": alert.candidate_tle_epoch.isoformat() if alert.candidate_tle_epoch else None,
            "maneuver_options": [opt.model_dump() for opt in alert.maneuver_options] if alert.maneuver_options else None,
            "approval_status": alert.approval_status
        }
        data_to_upsert.append(row)
        
    sb.table("alerts").upsert(data_to_upsert, on_conflict="candidate_id").execute()
    
    # Delete stale alerts not in the current refresh set.
    # This replicates the in-memory behavior where each refresh produces the
    # complete current threat picture, replacing all previous alerts.
    # NOTE: We use explicit per-ID deletion instead of .not_.in_() which has
    # known reliability issues with PostgREST for large or empty lists.
    current_candidate_ids = {alert.candidate_id for alert in alerts}
    existing_response = sb.table("alerts").select("candidate_id").execute()
    existing_ids = {row["candidate_id"] for row in existing_response.data}
    stale_ids = existing_ids - current_candidate_ids
    
    if stale_ids:
        sb.table("alerts").delete().in_("candidate_id", list(stale_ids)).execute()
        logger.info(f"Pruned {len(stale_ids)} stale alerts from database: {stale_ids}")
    
    logger.info(f"Upserted {len(alerts)} alerts to Supabase (pruned {len(stale_ids)} stale entries).")

def update_alert_field(candidate_id: str, **fields: Any) -> None:
    """Updates specific fields on an alert row."""
    sb = get_supabase()
    
    # Pre-process fields (e.g. serialize datetime, pydantic models)
    processed_fields = {}
    for k, v in fields.items():
        if isinstance(v, datetime):
            processed_fields[k] = v.isoformat()
        elif isinstance(v, list) and len(v) > 0 and isinstance(v[0], BaseModel):
             processed_fields[k] = [item.model_dump() for item in v]
        elif isinstance(v, list) and k == "maneuver_options":
             processed_fields[k] = [item.model_dump() if hasattr(item, "model_dump") else item for item in v]
        else:
            processed_fields[k] = v
            
    sb.table("alerts").update(processed_fields).eq("candidate_id", candidate_id).execute()
    logger.info(f"Updated fields {list(fields.keys())} for candidate {candidate_id}")
