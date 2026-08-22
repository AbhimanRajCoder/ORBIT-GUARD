import uuid
import logging
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from app.services.supabase_client import get_supabase

logger = logging.getLogger("triage.approval_service")

# Gating rule: junior operators cannot authorize burns costing more than 5.0 kg of fuel
FUEL_COST_THRESHOLD_KG = 5.0

def generate_token(candidate_id: str, option_id: str) -> tuple[str, datetime]:
    """
    Generates a unique, short-lived (5 minutes) UUID-based confirmation token.
    Stores the token metadata in the Supabase tokens table.
    """
    token = str(uuid.uuid4())
    expiry = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    sb = get_supabase()
    
    # Store token in Supabase
    sb.table("tokens").insert({
        "token": token,
        "candidate_id": candidate_id,
        "option_id": option_id,
        "expiry": expiry.isoformat()
    }).execute()
    
    logger.info(f"Generated confirmation token for candidate {candidate_id}, option {option_id}. Expiry: {expiry}")
    return token, expiry

def validate_token(token: str, candidate_id: str, option_id: str) -> bool:
    """
    Validates that the token exists, has not expired, and matches the correct
    candidate_id and option_id.
    
    Deletes the token from the tokens table on access to ensure single-use security.
    """
    if not token:
        logger.warning("Validation failed: Empty token provided.")
        return False
        
    sb = get_supabase()
    
    # First fetch the token record
    response = sb.table("tokens").select("*").eq("token", token).execute()
    
    if not response.data:
        logger.warning(f"Validation failed: Token '{token}' not found.")
        return False
        
    meta = response.data[0]
    
    # Delete immediately on lookup (single-use)
    sb.table("tokens").delete().eq("token", token).execute()
    
    # Check expiry
    now = datetime.now(timezone.utc)
    expiry = datetime.fromisoformat(meta["expiry"].replace("Z", "+00:00"))
    if now > expiry:
        logger.warning(f"Validation failed: Token expired at {expiry} (current time: {now}).")
        return False
        
    # Check match
    if meta["candidate_id"] != candidate_id or meta["option_id"] != option_id:
        logger.warning(
            f"Validation failed: Token metadata mismatch. Expected cand={meta['candidate_id']}, opt={meta['option_id']}; "
            f"received cand={candidate_id}, opt={option_id}."
        )
        return False
        
    logger.info(f"Token '{token}' successfully validated.")
    return True

def check_role_gating(operator_role: str, fuel_cost_kg: float):
    """
    Role-based gating: returns 403 if a 'junior' operator role attempts to approve
    a maneuver consuming more than the FUEL_COST_THRESHOLD_KG (5.0 kg).
    """
    role_lower = operator_role.lower()
    if role_lower not in {"junior", "senior"}:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid operator role '{operator_role}'. Must be 'junior' or 'senior'."
        )
        
    if role_lower == "junior" and fuel_cost_kg > FUEL_COST_THRESHOLD_KG:
        logger.warning(
            f"Access Denied: Junior operator attempted to approve burn with fuel cost {fuel_cost_kg:.2f} kg "
            f"exceeding threshold of {FUEL_COST_THRESHOLD_KG} kg."
        )
        raise HTTPException(
            status_code=403,
            detail=(
                f"Unauthorized: Operator role 'junior' is restricted from approving maneuvers "
                f"exceeding fuel cost of {FUEL_COST_THRESHOLD_KG} kg (requested: {fuel_cost_kg:.2f} kg). "
                "Requires 'senior' operator clearance."
            )
        )
