import math
import logging
from datetime import datetime, timedelta, timezone
from sgp4.api import Satrec, jday
from app.models import ConjunctionCandidate

logger = logging.getLogger("triage.conjunction")

# Earth gravitational parameter mu in km^3/s^2 (WGS-84 standard used by SGP4)
MU_EARTH = 398600.4418
# Safety buffer in km for orbital envelope overlap check
ENVELOPE_BUFFER_KM = 100.0
# Coarse distance threshold in km. If coarse screening comes within this,
# run fine screening. To prevent high-speed objects from skipping through
# the sphere in a 10-minute interval (~15km/s max relative velocity * 300s = 4500km),
# this must be at least 5000.0 km.
COARSE_THRESHOLD_KM = 5000.0

# Docked/module exclusion list to filter out physical attachments/self-matches
# Map protected asset ID to a set of NORAD IDs that are part of or docked to it
DOCKED_EXCLUSION_LIST = {
    "25544": {
        "25575",  # ISS (UNITY)
        "26400",  # ISS (ZVEZDA)
        "26700",  # ISS (DESTINY)
        "36086",  # POISK
        "49044",  # ISS (NAUKA)
        "67796",  # CREW DRAGON 12
        "68319",  # PROGRESS-MS 33
        "68837",  # PROGRESS-MS 34
        "68689",  # CYGNUS NG-24
    }
}

def datetime_to_jd_fr(dt: datetime) -> tuple[float, float]:
    """
    Converts a datetime object in UTC to Julian Date and fraction of day.
    """
    return jday(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + dt.microsecond / 1e6)

def get_orbital_envelope(satrec: Satrec) -> tuple[float, float]:
    """
    Computes perigee and apogee radii (from Earth's center in km)
    for a satellite using its Kozai mean motion (no_kozai) and eccentricity (ecco).
    
    Kepler's Third Law: a = (mu / n^2)^(1/3)
    """
    # satrec.no_kozai is Kozai mean motion in rad/min. Convert to rad/s.
    n_rad_s = satrec.no_kozai / 60.0
    
    if n_rad_s <= 0:
        return 0.0, 0.0
        
    # Semi-major axis in km
    a = (MU_EARTH / (n_rad_s ** 2)) ** (1.0 / 3.0)
    e = satrec.ecco
    
    perigee_r = a * (1.0 - e)
    apogee_r = a * (1.0 + e)
    
    return perigee_r, apogee_r

def propagate_positions(satrec: Satrec, jd_fr_list: list[tuple[float, float]]) -> list[tuple[float, float, float] | None]:
    """
    Propagates a satellite for a list of (jd, fr) Julian Date points.
    Returns a list of (x, y, z) positions in TEME km, or None if propagation fails.
    """
    positions = []
    for jd, fr in jd_fr_list:
        e, r, v = satrec.sgp4(jd, fr)
        if e == 0:
            positions.append(r)
        else:
            positions.append(None)
    return positions

def screen_conjunctions(
    protected_tle: dict,
    candidate_tles: list[dict],
    threshold_km: float = 5.0
) -> list[ConjunctionCandidate]:
    """
    CRITICAL DISCLAIMER & ARCHITECTURAL NOTE:
    -----------------------------------------
    This is a simplified orbital conjunction screening pass. It performs deterministic
    orbital propagation using the SGP4 analytical model and calculates Euclidean distance.
    Unlike real Conjunction Data Messages (CDMs) issued by CSpOC or commercial space operations:
    1. It does NOT perform covariance propagation (does not calculate Probability of Collision, Pc).
    2. It does NOT account for errors in the initial state (TLEs have inherent uncertainties of 1-10+ km).
    3. It does NOT account for space weather (atmospheric drag variations) or solar radiation pressure.
    
    Treat this purely as a candidate list for further review, not as a certified collision alert.
    -----------------------------------------
    
    Optimization Flow:
    1. Precompute 48-hour Julian dates (Coarse: 10-min steps, Fine: 60-s steps).
    2. Calculate protected asset apogee/perigee envelope and propagate its positions.
    3. Check each candidate satellite's apogee/perigee. Discard if it cannot cross the asset's
       envelope within ENVELOPE_BUFFER_KM.
    4. Run coarse screening (10-minute intervals). If minimum distance < COARSE_THRESHOLD_KM (50 km),
       proceed to fine screening.
    5. Run fine screening (60-second intervals) to compute the exact minimum distance and time of
       closest approach. Flag if min_distance < threshold_km.
    """
    start_time = datetime.now(timezone.utc)
    
    # 1. Precompute time and Julian dates arrays to avoid redundant conversions
    # Coarse steps: every 10 minutes over 48 hours = 288 samples
    coarse_times = [start_time + timedelta(minutes=10 * i) for i in range(288)]
    coarse_jd_fr = [datetime_to_jd_fr(t) for t in coarse_times]
    
    # Fine steps: every 60 seconds over 48 hours = 2880 samples
    fine_times = [start_time + timedelta(minutes=i) for i in range(2880)]
    fine_jd_fr = [datetime_to_jd_fr(t) for t in fine_times]
    
    # 2. Parse protected asset and precompute its trajectory
    protected_id = protected_tle["norad_id"]
    try:
        protected_satrec = Satrec.twoline2rv(protected_tle["line1"], protected_tle["line2"])
    except Exception as e:
        logger.error(f"Failed to parse TLE for protected asset {protected_id}: {e}")
        return []
        
    r_p_asset, r_a_asset = get_orbital_envelope(protected_satrec)
    if r_p_asset == 0.0 or r_a_asset == 0.0:
        logger.error(f"Invalid orbital envelope for protected asset {protected_id}")
        return []
        
    logger.info(f"Protected Asset {protected_id} envelope: Perigee={r_p_asset:.2f} km, Apogee={r_a_asset:.2f} km")
    
    # Pre-propagate protected asset
    asset_positions_coarse = propagate_positions(protected_satrec, coarse_jd_fr)
    asset_positions_fine = propagate_positions(protected_satrec, fine_jd_fr)
    
    conjunction_candidates = []
    
    # Square thresholds to avoid sqrt inside loops
    # Square thresholds to avoid sqrt inside loops
    actual_coarse_threshold = max(COARSE_THRESHOLD_KM, threshold_km)
    coarse_threshold_sq = actual_coarse_threshold * actual_coarse_threshold
    fine_threshold_sq = threshold_km * threshold_km
    
    pre_filter_count = 0
    coarse_pass_count = 0
    
    for cand in candidate_tles:
        # Skip self-comparison
        if cand["norad_id"] == protected_id:
            continue
            
        # Skip known docked modules or visiting spacecraft (physical attachments)
        if protected_id in DOCKED_EXCLUSION_LIST and cand["norad_id"] in DOCKED_EXCLUSION_LIST[protected_id]:
            logger.info(f"excluding known docked/module asset: {cand['name']} (NORAD ID: {cand['norad_id']})")
            continue
            
        try:
            cand_satrec = Satrec.twoline2rv(cand["line1"], cand["line2"])
        except Exception:
            # Silently skip malformed TLE lines for candidates
            continue
            
        # 3. Orbital Envelope Pre-Filter (Apogee/Perigee check)
        r_p_cand, r_a_cand = get_orbital_envelope(cand_satrec)
        if r_p_cand == 0.0 or r_a_cand == 0.0:
            continue
            
        # Check if orbital shells overlap within the buffer distance
        if r_a_cand < (r_p_asset - ENVELOPE_BUFFER_KM) or r_p_cand > (r_a_asset + ENVELOPE_BUFFER_KM):
            continue
            
        pre_filter_count += 1
        
        # 4. Coarse Screening Pass (10-minute intervals)
        min_coarse_dist_sq = float('inf')
        for idx, pos_asset in enumerate(asset_positions_coarse):
            if pos_asset is None:
                continue
                
            jd, fr = coarse_jd_fr[idx]
            e, r, v = cand_satrec.sgp4(jd, fr)
            if e != 0:
                continue
                
            dx = r[0] - pos_asset[0]
            dy = r[1] - pos_asset[1]
            dz = r[2] - pos_asset[2]
            dist_sq = dx*dx + dy*dy + dz*dz
            if dist_sq < min_coarse_dist_sq:
                min_coarse_dist_sq = dist_sq
                
        # If coarse pass minimum distance is under COARSE_THRESHOLD_KM (50 km), proceed
        if min_coarse_dist_sq >= coarse_threshold_sq:
            continue
            
        coarse_pass_count += 1
        
        # 5. Fine Screening Pass (60-second intervals)
        min_fine_dist_sq = float('inf')
        closest_idx = -1
        
        # Track whether the object stays co-located (distance < 0.5 km) over the entire window
        all_under_co_location_floor = True
        has_computed_fine = False
        
        for idx, pos_asset in enumerate(asset_positions_fine):
            if pos_asset is None:
                continue
                
            jd, fr = fine_jd_fr[idx]
            e, r, v = cand_satrec.sgp4(jd, fr)
            if e != 0:
                continue
                
            has_computed_fine = True
            dx = r[0] - pos_asset[0]
            dy = r[1] - pos_asset[1]
            dz = r[2] - pos_asset[2]
            dist_sq = dx*dx + dy*dy + dz*dz
            
            # 0.5 km threshold -> 0.25 km^2
            if dist_sq >= 0.25:
                all_under_co_location_floor = False
                
            if dist_sq < min_fine_dist_sq:
                min_fine_dist_sq = dist_sq
                closest_idx = idx
                
        # Exclude if it stays permanently co-located (within 0.5 km across the entire window)
        if has_computed_fine and all_under_co_location_floor:
            logger.info(f"excluded as co-located: {cand['name']}")
            continue
            
        # Flag as candidate if fine pass is within threshold
        if min_fine_dist_sq < fine_threshold_sq and closest_idx != -1:
            min_dist = math.sqrt(min_fine_dist_sq)
            time_closest = fine_times[closest_idx]
            
            # Sanity check: exclude unrealistic distances under 50 meters (0.05 km)
            if min_dist < 0.05:
                logger.warning(
                    f"Excluded {cand['name']} ({cand['norad_id']}) from alerts. "
                    f"Minimum distance {min_dist*1000:.1f}m is under the 50m sanity check threshold. "
                    f"Reason Code: SANITY_CHECK_FAILED_MIN_DISTANCE"
                )
                continue
                
            conjunction_candidates.append(
                ConjunctionCandidate(
                    object_name=cand["name"],
                    norad_id=cand["norad_id"],
                    min_distance_km=min_dist,
                    time_of_closest_approach=time_closest
                )
            )
            
    logger.info(
        f"Conjunction screening completed for asset {protected_id}. "
        f"Total candidates checked: {len(candidate_tles)}. "
        f"Passed pre-filter: {pre_filter_count}. "
        f"Passed coarse pass: {coarse_pass_count}. "
        f"Flagged conjunctions: {len(conjunction_candidates)}."
    )
    
    return conjunction_candidates
