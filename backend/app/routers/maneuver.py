import logging
import httpx
import asyncio
from fastapi import APIRouter, HTTPException
from sgp4.api import Satrec

from app.models import ManeuverOption
from app.services.db import get_alert_by_candidate_id, update_alert_field
from app.services.data_fetch import fetch_tle_data
from app.services.orbital_mechanics import generate_maneuver_options, CW_ASSUMPTION_NOTE

logger = logging.getLogger("triage.maneuver_router")

router = APIRouter(prefix="/maneuver", tags=["maneuver"])

_maneuver_locks = {}
_maneuver_locks_lock = asyncio.Lock()

async def get_maneuver_lock(candidate_id: str) -> asyncio.Lock:
    async with _maneuver_locks_lock:
        if candidate_id not in _maneuver_locks:
            _maneuver_locks[candidate_id] = asyncio.Lock()
        return _maneuver_locks[candidate_id]

@router.get("/{candidate_id}/options", response_model=list[ManeuverOption])
async def get_maneuver_options(candidate_id: str):
    """
    Generates or retrieves cached collision avoidance maneuver options ('small burn',
    'medium burn', 'large burn') for the specified conjunction candidate using
    Clohessy-Wiltshire relative-motion targeting.
    """
    lock = await get_maneuver_lock(candidate_id)
    async with lock:
        # 1. Look up alert in Supabase
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
            
        # 2. Return cached maneuver options if already computed for this alert
        if alert.maneuver_options:
            logger.info(f"Returning cached maneuver options for candidate {candidate_id}")
            return alert.maneuver_options
            
        # 3. Retrieve satellite catalog to get TLEs for protected asset and candidate
        try:
            satellites, _ = await fetch_tle_data("active")
        except Exception as e:
            logger.error(f"Failed to fetch satellite catalog for maneuver calculation: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"Failed to load satellite catalog: {str(e)}"
            )
            
        # Find candidate TLE
        cand_tle = next((sat for sat in satellites if sat["norad_id"] == candidate_id), None)
        if not cand_tle:
            raise HTTPException(
                status_code=404,
                detail=f"Candidate {candidate_id} TLE could not be found in active catalog."
            )
            
        # Find protected asset TLE
        protected_id = alert.protected_asset_id
        protected_tle = next((sat for sat in satellites if sat["norad_id"] == protected_id), None)
        
        # Fallback direct fetch if protected asset is not in the active group
        if not protected_tle:
            try:
                direct_url = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={protected_id}&FORMAT=tle"
                headers = {"User-Agent": "OrbitGuard/1.0"}
                async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                    resp = await client.get(direct_url)
                    resp.raise_for_status()
                lines = [l.strip() for l in resp.text.splitlines() if l.strip()]
                if len(lines) >= 3:
                    protected_tle = {
                        "name": lines[0],
                        "norad_id": protected_id,
                        "line1": lines[1],
                        "line2": lines[2]
                    }
            except Exception as e:
                logger.error(f"Failed to fetch protected asset TLE directly: {e}")
                
        if not protected_tle:
            raise HTTPException(
                status_code=404,
                detail=f"Protected asset {protected_id} TLE could not be resolved. Maneuver targeting cannot proceed."
            )
            
        try:
            protected_satrec = Satrec.twoline2rv(protected_tle["line1"], protected_tle["line2"])
            candidate_satrec = Satrec.twoline2rv(cand_tle["line1"], cand_tle["line2"])
        except Exception as e:
            logger.error(f"Failed to parse TLEs for maneuver targeting: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to parse satellite orbital elements: {str(e)}"
            )
            
        # 4. Generate maneuver options via Clohessy-Wiltshire targeting
        try:
            options = generate_maneuver_options(
                alert=alert,
                protected_satrec=protected_satrec,
                candidate_satrec=candidate_satrec,
                all_satellites=satellites
            )
        except Exception as e:
            logger.error(f"Maneuver generation error for candidate {candidate_id}: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Maneuver targeting error: {str(e)}"
            )
            
        # 5. Cache options on alert in Supabase and return
        update_alert_field(candidate_id, maneuver_options=options)
        
        logger.info(f"Successfully generated and cached {len(options)} maneuver options for candidate {candidate_id}")
        
        from app.services.audit import append_entry
        await append_entry(
            pillar=3,
            action="maneuver_options_generated",
            candidate_id=candidate_id,
            actor="system",
            payload={
                "options": [opt.model_dump() for opt in options]
            }
        )
        
        return options
