import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
import os

from app.models import ApprovalRequest, ApprovalRecord, PreviewResponse
from app.services.db import get_alert_by_candidate_id, update_alert_field
from app.routers.maneuver import get_maneuver_options
from app.routers.compare import perform_tradeoff_comparison
from app.services.approval import generate_token, validate_token, check_role_gating
from app.services.supabase_client import get_supabase

logger = logging.getLogger("triage.approve_router")

router = APIRouter(prefix="/approve", tags=["approve"])

@router.get("/{candidate_id}/preview", response_model=PreviewResponse)
async def preview_maneuver_approval(
    candidate_id: str,
    option_id: str | None = Query(default=None, description="Specific option ID to preview. Defaults to recommended option.")
):
    """
    Retrieves details for a selected maneuver option and generates a short-lived
    confirmation token required for final authorization.
    """
    # 1. Lookup alert in Supabase
    alert = get_alert_by_candidate_id(candidate_id)
    if not alert:
        raise HTTPException(
            status_code=404,
            detail=f"Candidate ID {candidate_id} was not found in the current alert database. Run /triage/refresh first."
        )
        
    # 2. Get tradeoff comparison to find recommended option if option_id is None
    if not option_id:
        comparison = await perform_tradeoff_comparison(candidate_id, log_audit=False)
        option_id = comparison.recommended_option_id
        if not option_id:
            raise HTTPException(
                status_code=400,
                detail=f"No option is currently recommended for candidate {candidate_id}. Please specify an option_id explicitly."
            )
            
    # 3. Resolve options to find the correct target option metadata
    if not alert.maneuver_options:
        alert.maneuver_options = await get_maneuver_options(candidate_id)
        
    option = next((o for o in alert.maneuver_options if o.option_id == option_id), None)
    if not option:
        raise HTTPException(
            status_code=404,
            detail=f"Maneuver option {option_id} not found for candidate {candidate_id}."
        )
        
    # 4. Generate short-lived token
    token, expiry = generate_token(candidate_id, option_id)
    
    return PreviewResponse(
        candidate_id=candidate_id,
        option_id=option_id,
        label=option.label,
        delta_v_ms=option.delta_v_ms,
        fuel_cost_kg=option.fuel_cost_kg,
        confirmation_token=token,
        token_expiry=expiry
    )

@router.post("", response_model=ApprovalRecord)
async def authorize_maneuver(request: ApprovalRequest):
    """
    Authorizes a maneuver option.
    
    CRITICAL DECISION BOUNDARY:
    --------------------------
    This endpoint records a validated operator decision to execute a maneuver.
    It does NOT issue command packets, upload sequences, or transmit commands to
    any satellite. Its function is strictly to register and audit operator approval.
    """
    try:
        # 1. Validate confirmation token (prevents stale/accidental submissions)
        token_valid = validate_token(request.confirmation_token, request.candidate_id, request.chosen_option_id)
        if not token_valid:
            raise HTTPException(
                status_code=400,
                detail="Invalid, expired, or mismatching confirmation token. Please request a new preview token."
            )
            
        # 2. Find alert and maneuver option
        alert = get_alert_by_candidate_id(request.candidate_id)
        if not alert or not alert.maneuver_options:
            raise HTTPException(
                status_code=404,
                detail=f"Alert or options for candidate {request.candidate_id} not found."
            )
            
        option = next((o for o in alert.maneuver_options if o.option_id == request.chosen_option_id), None)
        if not option:
            raise HTTPException(
                status_code=404,
                detail=f"Maneuver option {request.chosen_option_id} not found."
            )
            
        # 3. Safety validation: Block human override of disqualified options (score == 0.0)
        comparison = await perform_tradeoff_comparison(request.candidate_id, log_audit=False)
        ranked_opt = next((ro for ro in comparison.ranked_options if ro.option_id == request.chosen_option_id), None)
        
        if ranked_opt and ranked_opt.composite_score == 0.0:
            logger.warning(
                f"Approval Blocked: Attempted human override to approve disqualified option "
                f"'{option.label}' ({option.option_id}) for candidate {request.candidate_id}."
            )
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Conflict: Maneuver option '{option.label}' ({option.option_id}) is disqualified "
                    f"due to safety violations (composite score: 0.0) and cannot be approved. "
                    "The system does not permit operator overrides for disqualified orbits."
                )
            )
            
        # 4. Enforce role gating (Junior restricted above 5.0 kg fuel cost)
        check_role_gating(request.operator_role, option.fuel_cost_kg)
        
        # 5. Record approval and mutate Alert state (the only mutating endpoint)
        approved_at = datetime.now(timezone.utc)
        record = ApprovalRecord(
            candidate_id=request.candidate_id,
            chosen_option_id=request.chosen_option_id,
            approved_by=request.approved_by,
            operator_role=request.operator_role,
            confirmation_token=request.confirmation_token,
            approved_at=approved_at,
            status="approved",
            delta_v_ms=option.delta_v_ms,
            fuel_cost_kg=option.fuel_cost_kg
        )
        
        # Insert into Supabase approvals table
        sb = get_supabase()
        sb.table("approvals").insert({
            "candidate_id": request.candidate_id,
            "chosen_option_id": request.chosen_option_id,
            "approved_by": request.approved_by,
            "operator_role": request.operator_role,
            "confirmation_token": request.confirmation_token,
            "approved_at": approved_at.isoformat(),
            "status": "approved",
            "delta_v_ms": option.delta_v_ms,
            "fuel_cost_kg": option.fuel_cost_kg
        }).execute()
        
        # Update alert status in Supabase
        update_alert_field(request.candidate_id, approval_status="approved")
        
        logger.info(
            f"Maneuver approved for candidate {request.candidate_id} by {request.approved_by} "
            f"({request.operator_role} role) using option {request.chosen_option_id}."
        )
        
        # Append to audit trail
        from app.services.audit import append_entry
        await append_entry(
            pillar=6,
            action="approval_granted",
            candidate_id=request.candidate_id,
            actor=request.approved_by,
            payload={
                "request": request.model_dump(),
                "snapshot_delta_v_ms": option.delta_v_ms,
                "snapshot_fuel_cost_kg": option.fuel_cost_kg
            }
        )
        
        return record
        
    except HTTPException as he:
        from app.services.audit import append_entry
        await append_entry(
            pillar=6,
            action="approval_rejected",
            candidate_id=request.candidate_id,
            actor=request.approved_by,
            payload={
                "request": request.model_dump(),
                "status_code": he.status_code,
                "reason": he.detail
            }
        )
        raise he


# Only register the force-expiry test helper route if running in a TESTING environment
if os.getenv("TESTING") == "true":
    @router.post("/test/expire-token", tags=["test"])
    async def test_expire_token(token: str):
        # NOTE: This helper exists strictly for end-to-end token expiry tests and must never be reachable in production/live deployments.
        from datetime import timedelta
        sb = get_supabase()
        
        response = sb.table("tokens").select("*").eq("token", token).execute()
        if response.data:
            new_expiry = datetime.now(timezone.utc) - timedelta(minutes=10)
            sb.table("tokens").update({"expiry": new_expiry.isoformat()}).eq("token", token).execute()
            return {"status": "expired"}
            
        raise HTTPException(status_code=404, detail="Token not found")
