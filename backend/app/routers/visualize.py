import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Query
from sgp4.api import Satrec
import numpy as np

from app.models import VisualizationData, DangerZone
from app.services.db import get_alert_by_candidate_id, upsert_alerts
from app.routers.compare import perform_tradeoff_comparison
from app.services.data_fetch import fetch_tle_data
from app.services.conjunction import datetime_to_jd_fr
from app.services.orbital_mechanics import get_relative_state, solve_targeting_burn
from app.services.visualization import sample_trajectory, sample_maneuver_trajectory, teme_to_ecef

logger = logging.getLogger("triage.visualize_router")

router = APIRouter(prefix="/visualize", tags=["visualize"])

@router.get("/{candidate_id}", response_model=VisualizationData)
async def get_visualization_paths(
    candidate_id: str,
    window_hours: float = Query(default=6.0, gt=0.0, description="Sampling window centered on TCA in hours"),
    step_seconds: float = Query(default=60.0, gt=0.0, description="Step frequency of path coordinates in seconds"),
    option_label: str = Query(default=None, description="Specific option label to visualize")
):
    """
    Generates and returns ECEF coordinate trajectories for the protected asset, candidate,
    and the optimal recommended maneuver option path.
    """
    # 1. Lookup alert in Supabase
    alert = get_alert_by_candidate_id(candidate_id)
    if not alert:
        # Resilient fallback: build a mock alert for this candidate if it exists in the active catalog
        try:
            satellites, _ = await fetch_tle_data("active")
            cand_tle = next((s for s in satellites if s["norad_id"] == candidate_id), None)
            iss_tle = next((s for s in satellites if s["norad_id"] == "25544"), None)
            if cand_tle and iss_tle:
                # Run screening for this candidate specifically
                from app.services.conjunction import screen_conjunctions
                candidates = screen_conjunctions(iss_tle, [cand_tle], threshold_km=100.0)
                if candidates:
                    c = candidates[0]
                    from app.models import Alert
                    alert = Alert(
                        protected_asset_id="25544",
                        candidate_name=cand_tle["name"],
                        candidate_id=candidate_id,
                        min_distance_km=c.min_distance_km,
                        time_of_closest_approach=c.time_of_closest_approach,
                        risk_score=1.0
                    )
                    upsert_alerts([alert])
                else:
                    # If no conjunction under 100km, still propagate to find closest approach
                    # over the next 48 hours to return a valid path
                    iss_s = Satrec.twoline2rv(iss_tle["line1"], iss_tle["line2"])
                    cand_s = Satrec.twoline2rv(cand_tle["line1"], cand_tle["line2"])
                    
                    now = datetime.now(timezone.utc)
                    min_d = float('inf')
                    best_t = now
                    for i in range(288): # 10 minute steps
                        t = now + timedelta(minutes=10 * i)
                        jd, fr = datetime_to_jd_fr(t)
                        e1, rp, _ = iss_s.sgp4(jd, fr)
                        e2, rc, _ = cand_s.sgp4(jd, fr)
                        if e1 == 0 and e2 == 0:
                            d = np.linalg.norm(np.array(rp) - np.array(rc))
                            if d < min_d:
                                min_d = d
                                best_t = t
                    from app.models import Alert
                    alert = Alert(
                        protected_asset_id="25544",
                        candidate_name=cand_tle["name"],
                        candidate_id=candidate_id,
                        min_distance_km=min_d,
                        time_of_closest_approach=best_t,
                        risk_score=1.0
                    )
                    upsert_alerts([alert])
        except Exception as e:
            logger.error(f"Fallback candidate resolution failed: {e}")
            
    if not alert:
        raise HTTPException(
            status_code=404,
            detail=f"Candidate ID {candidate_id} was not found in the current alert database or active satellite catalog."
        )
        
    tca = alert.time_of_closest_approach
    if tca.tzinfo is None:
        tca = tca.replace(tzinfo=timezone.utc)
        
    # 2. Get trade-off ranking to determine the recommended option
    comparison = await perform_tradeoff_comparison(candidate_id, log_audit=False)
    rec_opt_id = comparison.recommended_option_id
    
    # Reload alert to ensure maneuver_options generated in perform_tradeoff_comparison are populated
    if not alert.maneuver_options:
        db_alert = get_alert_by_candidate_id(candidate_id)
        if db_alert:
            alert = db_alert
            
    # Override recommended option with option_label if provided
    selected_opt_meta = None
    if option_label and alert.maneuver_options:
        normalized_label = option_label.lower().strip()
        selected_opt_meta = next((o for o in alert.maneuver_options if o.label.lower().strip() == normalized_label), None)
        
    if not selected_opt_meta and rec_opt_id and alert.maneuver_options:
        selected_opt_meta = next((o for o in alert.maneuver_options if o.option_id == rec_opt_id), None)
    
    # 3. Retrieve satellite TLEs
    try:
        satellites, _ = await fetch_tle_data("active")
    except Exception as e:
        logger.error(f"Failed to fetch active satellite catalog for visualization: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error accessing satellite catalog: {str(e)}"
        )
        
    cand_tle = next((s for s in satellites if s["norad_id"] == candidate_id), None)
    iss_tle = next((s for s in satellites if s["norad_id"] == alert.protected_asset_id), None)
    
    if not cand_tle or not iss_tle:
        raise HTTPException(
            status_code=500,
            detail=f"Could not resolve TLE data for protected asset or candidate."
        )
        
    iss_satrec = Satrec.twoline2rv(iss_tle["line1"], iss_tle["line2"])
    cand_satrec = Satrec.twoline2rv(cand_tle["line1"], cand_tle["line2"])
    
    # 4. Define trajectory sampling window [TCA - window/2, TCA + window/2]
    half_win = timedelta(hours=window_hours / 2.0)
    start_time = tca - half_win
    end_time = tca + half_win
    
    # Sample nominal paths
    logger.info(f"Sampling trajectories for {alert.protected_asset_id} and {candidate_id}...")
    protected_path = sample_trajectory(iss_satrec, start_time, end_time, step_seconds)
    candidate_path = sample_trajectory(cand_satrec, start_time, end_time, step_seconds)
    
    # 5. Build danger zone centered on candidate at TCA
    jd_tca, fr_tca = datetime_to_jd_fr(tca)
    e, r_c_tca, v_c_tca = cand_satrec.sgp4(jd_tca, fr_tca)
    if e != 0:
        raise HTTPException(status_code=500, detail="SGP4 propagation failed at TCA for candidate.")
        
    r_c_ecef, _ = teme_to_ecef(np.array(r_c_tca), np.array(v_c_tca), tca)
    
    danger_zone = DangerZone(
        center_ecef_km=[round(float(coord), 4) for coord in r_c_ecef],
        radius_km=alert.min_distance_km
    )
    
    # 6. Sample maneuver path if an option is selected/recommended
    maneuver_path = None
    if selected_opt_meta:
        
        # Maps option labels to physical CW targeting expansions
        delta_d_map = {
            "small burn": 2.0,
            "medium burn": 5.0,
            "large burn": 12.0
        }
        delta_d = delta_d_map.get(selected_opt_meta.label, 2.0)
        
        # Re-use the exact cached burn lead time to prevent time-drift race conditions
        burn_lead_s = selected_opt_meta.time_to_burn_execution_s
        t_burn = tca - timedelta(seconds=burn_lead_s)
        
        r0_hill, v0_hill, n = get_relative_state(iss_satrec, cand_satrec, t_burn)
        v_burn_hill, _ = solve_targeting_burn(r0_hill, v0_hill, burn_lead_s, n, delta_d)
        
        logger.info(f"Sampling post-burn trajectory with option '{selected_opt_meta.label}'...")
        maneuver_path = sample_maneuver_trajectory(
            r0_hill=r0_hill,
            v0_hill=v0_hill,
            v_burn_hill=v_burn_hill,
            protected_satrec=iss_satrec,
            n=n,
            start_time=start_time,
            burn_time=t_burn,
            end_time=end_time,
            step_seconds=step_seconds
        )
        
    res = VisualizationData(
        candidate_id=candidate_id,
        protected_asset_path=protected_path,
        candidate_path=candidate_path,
        maneuver_path=maneuver_path,
        danger_zone=danger_zone
    )
    
    from app.services.audit import append_entry
    await append_entry(
        pillar=5,
        action="visualization_requested",
        candidate_id=candidate_id,
        actor="system",
        payload={
            "candidate_id": candidate_id,
            "window_hours": window_hours,
            "step_seconds": step_seconds
        }
    )
    
    return res
