import logging
from fastapi import APIRouter, HTTPException
from app.models import RankedComparison
from app.services.db import get_alert_by_candidate_id
from app.routers.maneuver import get_maneuver_options
from app.services.tradeoff import rank_options

logger = logging.getLogger("triage.compare_router")

router = APIRouter(prefix="/compare", tags=["compare"])

async def perform_tradeoff_comparison(candidate_id: str, log_audit: bool = True) -> RankedComparison:
    """
    Core comparison logic. Retrieves ranked maneuver options and recommends
    the optimal avoidance burn. When called internally (e.g. from approve),
    set log_audit=False to avoid duplicate audit entries.
    """
    # 1. Lookup alert in Supabase
    alert = get_alert_by_candidate_id(candidate_id)
    
    if not alert:
        raise HTTPException(
            status_code=404,
            detail=f"Candidate ID {candidate_id} was not found in the current alert database. Run /triage/refresh first."
        )
        
    # Enforce current refresh ID / timestamp check to invalidate stale candidates
    from app.services.db import get_current_refresh_timestamp
    current_refresh = get_current_refresh_timestamp()
    if current_refresh and alert.created_at:
        if abs((alert.created_at - current_refresh).total_seconds()) > 1.0:
            raise HTTPException(
                status_code=404,
                detail="Candidate not present in most recent triage refresh."
            )
        
    # 2. Re-use get_maneuver_options to generate and cache options if missing
    if not alert.maneuver_options:
        logger.info(f"Maneuver options not cached for candidate {candidate_id}. Generating now...")
        try:
            # get_maneuver_options will update the database
            alert.maneuver_options = await get_maneuver_options(candidate_id)
        except HTTPException as he:
            raise he
        except Exception as e:
            logger.error(f"Failed to generate maneuver options during trade-off: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Error generating maneuver options for trade-off comparison: {str(e)}"
            )
            
    # 3. Perform trade-off ranking
    try:
        comparison = rank_options(alert.maneuver_options, alert.min_distance_km)
        
        if log_audit:
            from app.services.audit import append_entry
            await append_entry(
                pillar=4,
                action="comparison_ranked",
                candidate_id=candidate_id,
                actor="system",
                payload=comparison.model_dump()
            )
        
        return comparison
    except Exception as e:
        logger.error(f"Failed to rank options for candidate {candidate_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error performing trade-off ranking: {str(e)}"
        )

@router.get("/{candidate_id}", response_model=RankedComparison)
async def get_tradeoff_comparison(candidate_id: str):
    """
    API endpoint: Retrieves ranked maneuver options and recommends the optimal
    avoidance burn based on safety, fuel cost, and secondary conjunction risk.
    """
    return await perform_tradeoff_comparison(candidate_id, log_audit=True)
