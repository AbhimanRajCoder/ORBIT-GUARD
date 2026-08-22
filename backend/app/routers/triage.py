import logging
from datetime import datetime, timezone, timedelta
import httpx
from fastapi import APIRouter, HTTPException, BackgroundTasks
from sgp4.api import Satrec
from app.models import Alert, RefreshRequest, RefreshResponse
from app.services.data_fetch import fetch_tle_data
from app.services.conjunction import screen_conjunctions
from app.services.risk_score import calculate_risk_score
from app.services.db import upsert_alerts, get_alert_by_candidate_id
from app.services.supabase_client import get_supabase

def get_tle_epoch(satrec: Satrec) -> datetime:
    yr = satrec.epochyr
    if yr < 100:
        year = 2000 + yr if yr < 57 else 1900 + yr
    else:
        year = yr
    epoch_base = datetime(year, 1, 1, tzinfo=timezone.utc)
    epoch_dt = epoch_base + timedelta(days=satrec.epochdays - 1.0)
    return epoch_dt

logger = logging.getLogger("triage.router")

router = APIRouter(prefix="/triage", tags=["triage"])

@router.post("/refresh", response_model=RefreshResponse)
async def refresh_triage(request: RefreshRequest):
    """
    Triggers a fresh TLE data pull and screens active satellites for conjunctions
    against one or more protected asset NORAD IDs.
    
    Generates, scores, ranks, and saves the alerts in Supabase.
    """
    refresh_timestamp = datetime.now(timezone.utc)
    from app.services.db import set_current_refresh_timestamp, get_all_alerts_dict
    set_current_refresh_timestamp(refresh_timestamp)
    existing_alerts = get_all_alerts_dict()

    # 1. Fetch satellite group (e.g. "active")
    try:
        satellites, source_name = await fetch_tle_data(group=request.satellite_group)
    except Exception as e:
        logger.error(f"Failed to fetch satellite group {request.satellite_group}: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Failed to retrieve satellite catalog: {str(e)}"
        )
        
    all_alerts = []
    
    # 2. Process each protected asset ID
    for asset_id in request.protected_asset_ids:
        # Find the protected asset in the fetched list
        protected_tle = next((sat for sat in satellites if sat["norad_id"] == asset_id), None)
        
        # Fallback: if not in the group, try to fetch it directly from CelesTrak
        if not protected_tle:
            logger.info(f"Protected asset {asset_id} not found in group '{request.satellite_group}'. Fetching directly...")
            try:
                direct_url = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={asset_id}&FORMAT=tle"
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
                async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                     resp = await client.get(direct_url)
                     resp.raise_for_status()
                
                lines = [line.strip() for line in resp.text.splitlines() if line.strip()]
                if len(lines) >= 3:
                    protected_tle = {
                        "name": lines[0],
                        "norad_id": asset_id,
                        "line1": lines[1],
                        "line2": lines[2]
                    }
                    # Also append it to our satellites catalog so it's cached or available if needed
                    satellites.append(protected_tle)
            except Exception as e:
                logger.error(f"Failed to fetch individual TLE for asset {asset_id}: {e}")
                
        if not protected_tle:
            logger.warning(f"Protected asset {asset_id} TLE could not be found or retrieved. Skipping this asset.")
            continue
            
        # 3. Run conjunction screening
        logger.info(f"Running conjunction screening for protected asset {protected_tle['name']} ({asset_id})...")
        candidates = screen_conjunctions(
            protected_tle=protected_tle,
            candidate_tles=satellites,
            threshold_km=request.distance_threshold_km
        )
        
        # 4. Score candidates and convert to Alerts
        for candidate in candidates:
            score = calculate_risk_score(
                candidate=candidate,
                threshold_km=request.distance_threshold_km,
                mission_priority=request.mission_priority
            )
            
            # Find candidate TLE to extract epoch
            cand_tle = next((sat for sat in satellites if sat["norad_id"] == candidate.norad_id), None)
            tle_epoch = None
            if cand_tle:
                try:
                    satrec = Satrec.twoline2rv(cand_tle["line1"], cand_tle["line2"])
                    tle_epoch = get_tle_epoch(satrec)
                except Exception as e:
                    logger.error(f"Failed to parse TLE epoch for candidate {candidate.norad_id}: {e}")

            alert = Alert(
                protected_asset_id=asset_id,
                candidate_name=candidate.object_name,
                candidate_id=candidate.norad_id,
                min_distance_km=round(candidate.min_distance_km, 3),
                time_of_closest_approach=candidate.time_of_closest_approach,
                risk_score=score,
                mission_priority=request.mission_priority,
                candidate_tle_epoch=tle_epoch,
                created_at=refresh_timestamp
            )
            
            # Preserve state if the alert already exists in database
            existing_alert = existing_alerts.get(candidate.norad_id)
            if existing_alert:
                logger.info(f"PRESERVE MATCH: {candidate.norad_id} has current status: {existing_alert.approval_status}")
                alert.approval_status = existing_alert.approval_status
                alert.explanation = existing_alert.explanation
                alert.explanation_source = existing_alert.explanation_source
                alert.explanation_generated_at = existing_alert.explanation_generated_at
                alert.maneuver_options = existing_alert.maneuver_options
            else:
                logger.info(f"PRESERVE NO MATCH for {candidate.norad_id}.")
                
            all_alerts.append(alert)
            
    # 5. Sort alerts by risk score descending (highest risk first)
    all_alerts.sort(key=lambda x: x.risk_score, reverse=True)
    
    # Upsert to Supabase
    upsert_alerts(all_alerts)
    
    logger.info(f"Triage refresh complete. Generated {len(all_alerts)} alerts (Source: {source_name}).")
    
    from app.services.lifecycle import populate_alerts_lifecycle
    populate_alerts_lifecycle(all_alerts)

    from app.services.audit import append_entry
    await append_entry(
        pillar=1,
        action="triage_refresh",
        candidate_id=None,
        actor="system",
        payload={
            "source_used": source_name,
            "count_of_alerts_generated": len(all_alerts),
            "threshold_km": request.distance_threshold_km
        }
    )
    
    return RefreshResponse(source=source_name, alerts=all_alerts)

@router.get("/alerts", response_model=list[Alert])
async def get_alerts():
    """
    Returns the currently stored ranked list of conjunction alerts, highest risk first.
    """
    sb = get_supabase()
    response = sb.table("alerts").select("*").order("risk_score", desc=True).execute()
    
    def parse_dt(dt_str):
        if not dt_str: return None
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        
    alerts = []
    for row in response.data:
        from app.models import ManeuverOption
        maneuver_options = None
        if row.get("maneuver_options"):
            maneuver_options = [ManeuverOption(**opt) for opt in row["maneuver_options"]]
            
        alerts.append(Alert(
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
        ))
    from app.services.lifecycle import populate_alerts_lifecycle
    populate_alerts_lifecycle(alerts)
    return alerts
