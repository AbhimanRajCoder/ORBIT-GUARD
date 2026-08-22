import logging
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.db import get_alert_by_candidate_id, update_alert_field
from app.services.explain import explain_alert

logger = logging.getLogger("triage.explain_router")

router = APIRouter(prefix="/explain", tags=["explain"])

class ExplanationResponse(BaseModel):
    candidate_id: str = Field(..., description="The NORAD Catalog Number of the candidate threat object")
    explanation: str = Field(..., description="Plain-language explanation of the conjunction risk")
    explanation_generated_at: datetime = Field(..., description="The UTC timestamp when the explanation was generated")
    source: str = Field(..., description="The provider that generated this explanation (e.g. 'gemini', 'groq', 'template_fallback')")

_explain_locks = {}
_explain_locks_lock = asyncio.Lock()

async def get_explain_lock(candidate_id: str) -> asyncio.Lock:
    async with _explain_locks_lock:
        if candidate_id not in _explain_locks:
            _explain_locks[candidate_id] = asyncio.Lock()
        return _explain_locks[candidate_id]

@router.get("/{candidate_id}", response_model=ExplanationResponse)
async def get_explanation(candidate_id: str):
    """
    Looks up the alert by candidate_id, generates (or returns cached) risk explanation.
    """
    lock = await get_explain_lock(candidate_id)
    async with lock:
        # Look up in Supabase
        alert = get_alert_by_candidate_id(candidate_id)
        
        if not alert:
            raise HTTPException(
                status_code=404,
                detail=f"Candidate ID {candidate_id} was not found in the current alert database. Run a refresh first."
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
            
        # Check if explanation is already cached
        if alert.explanation and alert.explanation_generated_at and alert.explanation_source:
            logger.info(f"Returning cached explanation for candidate {candidate_id} (source: {alert.explanation_source})")
            return ExplanationResponse(
                candidate_id=alert.candidate_id,
                explanation=alert.explanation,
                explanation_generated_at=alert.explanation_generated_at,
                source=alert.explanation_source
            )
            
        # Generate fresh explanation
        try:
            explanation, source = await explain_alert(alert)
            generated_at = datetime.now(timezone.utc)
            
            # Update alert in Supabase
            update_alert_field(
                candidate_id,
                explanation=explanation,
                explanation_source=source,
                explanation_generated_at=generated_at
            )
            
            logger.info(f"Successfully generated and cached explanation for candidate {candidate_id} (source: {source})")
            
            from app.services.audit import append_entry
            await append_entry(
                pillar=2,
                action="explanation_generated",
                candidate_id=candidate_id,
                actor="system",
                payload={
                    "candidate_id": candidate_id,
                    "source": source,
                    "explanation": explanation
                }
            )
            
            return ExplanationResponse(
                candidate_id=alert.candidate_id,
                explanation=explanation,
                explanation_generated_at=generated_at,
                source=source
            )
        except Exception as e:
            logger.error(f"Failed to generate explanation for candidate {candidate_id}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Error generating explanation: {str(e)}"
            )
