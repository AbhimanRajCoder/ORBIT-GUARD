from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.models import AuditLogEntry
from app.services.audit import get_all_entries, verify_chain

router = APIRouter(prefix="/audit", tags=["Pillar 7 - Audit Trail"])

class VerificationResponse(BaseModel):
    is_valid: bool
    broken_at_id: Optional[int] = None

@router.get("", response_model=List[AuditLogEntry])
async def read_audit_log():
    """
    Retrieves the complete historical audit log sequentially.
    """
    try:
        return get_all_entries()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accessing audit log: {str(e)}")

@router.get("/verify", response_model=VerificationResponse)
async def check_audit_integrity():
    """
    Walks the full log, recomputes each hash from stored fields, and verifies link connectivity.
    Returns exactly where the chain breaks if it has been tampered with.
    """
    try:
        is_valid, broken_id = verify_chain()
        return VerificationResponse(is_valid=is_valid, broken_at_id=broken_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error performing audit verification: {str(e)}")
