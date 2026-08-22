import math
import logging
from datetime import datetime, timezone, timedelta
from typing import Tuple, List, Dict
import numpy as np
from sgp4.api import Satrec

from app.models import TrajectoryPoint
from app.services.conjunction import datetime_to_jd_fr
from app.services.orbital_mechanics import (
    get_relative_state,
    solve_targeting_burn,
    build_cw_state_transition
)

logger = logging.getLogger("triage.visualization")

# Earth rotation rate in radians per second (WGS-84)
OMEGA_EARTH = 7.2921151467e-5

def datetime_to_jd(dt: datetime) -> float:
    """
    Converts datetime to absolute Julian Date.
    """
    timestamp = dt.timestamp()
    return 2440587.5 + timestamp / 86400.0

def get_gmst(dt: datetime) -> float:
    """
    Computes Greenwich Mean Sidereal Time (GMST) in radians using Julian Date (IAU 1982).
    """
    dt_midnight = datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)
    jd_midnight = 2440587.5 + dt_midnight.timestamp() / 86400.0
    T = (jd_midnight - 2451545.0) / 36525.0
    
    gmst_seconds = 24110.54841 + 8640184.812866 * T + 0.093104 * (T ** 2) - 6.2e-6 * (T ** 3)
    
    # Add elapsed UT1 time since midnight with sidereal multiplier
    ut1_seconds = (dt - dt_midnight).total_seconds()
    gmst_seconds += ut1_seconds * 1.002737909350795
    
    gmst_radians = (gmst_seconds * (2.0 * math.pi / 86400.0)) % (2.0 * math.pi)
    if gmst_radians < 0:
        gmst_radians += 2.0 * math.pi
    return gmst_radians

def teme_to_ecef(
    r_teme: np.ndarray,
    v_teme: np.ndarray,
    dt: datetime
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Converts position and velocity from SGP4's native TEME (ECI) frame to ECEF (fixed Earth).
    
    This rotation is critical for rendering satellite paths relative to static Earth continents.
    Z-axis is the Earth rotational axis, X-axis aligns with 0° Prime Meridian at the epoch.
    """
    gmst = get_gmst(dt)
    cos_g = math.cos(gmst)
    sin_g = math.sin(gmst)
    
    # Position rotation
    rx = r_teme[0] * cos_g + r_teme[1] * sin_g
    ry = -r_teme[0] * sin_g + r_teme[1] * cos_g
    rz = r_teme[2]
    r_ecef = np.array([rx, ry, rz], dtype=float)
    
    # Velocity rotation (including Coriolis/transport term: v_ecef = R * v_eci - omega x r_ecef)
    vx_rot = v_teme[0] * cos_g + v_teme[1] * sin_g
    vy_rot = -v_teme[0] * sin_g + v_teme[1] * cos_g
    vz_rot = v_teme[2]
    v_rot = np.array([vx_rot, vy_rot, vz_rot], dtype=float)
    
    omega_cross_r = np.array([
        -OMEGA_EARTH * r_ecef[1],
        OMEGA_EARTH * r_ecef[0],
        0.0
    ], dtype=float)
    
    v_ecef = v_rot - omega_cross_r
    return r_ecef, v_ecef

def sample_trajectory(
    satrec: Satrec,
    start_time: datetime,
    end_time: datetime,
    step_seconds: float
) -> List[TrajectoryPoint]:
    """
    Samples a satellite's nominal orbit trajectory from start_time to end_time
    converting all positions to ECEF coordinates.
    """
    points = []
    current_time = start_time
    
    while current_time <= end_time:
        jd, fr = datetime_to_jd_fr(current_time)
        e, r, v = satrec.sgp4(jd, fr)
        if e == 0:
            r_ecef, _ = teme_to_ecef(np.array(r), np.array(v), current_time)
            points.append(
                TrajectoryPoint(
                    t=current_time,
                    position_ecef_km=[round(float(coord), 4) for coord in r_ecef],
                    position_teme_km=[round(float(coord), 4) for coord in r]
                )
            )
        current_time += timedelta(seconds=step_seconds)
        
    return points

def sample_maneuver_trajectory(
    r0_hill: np.ndarray,
    v0_hill: np.ndarray,
    v_burn_hill: np.ndarray,
    protected_satrec: Satrec,
    n: float,
    start_time: datetime,
    burn_time: datetime,
    end_time: datetime,
    step_seconds: float
) -> List[TrajectoryPoint]:
    """
    Samples the post-burn asset trajectory in ECEF frame.
    
    Before burn_time: follows the nominal ECEF asset path.
    After burn_time: propagates relative state under CW and rotates back to ECI/ECEF.
    """
    points = []
    current_time = start_time
    
    while current_time <= end_time:
        if current_time <= burn_time:
            # Pre-burn follows nominal trajectory
            jd, fr = datetime_to_jd_fr(current_time)
            e, r, v = protected_satrec.sgp4(jd, fr)
            if e == 0:
                r_ecef, _ = teme_to_ecef(np.array(r), np.array(v), current_time)
                points.append(
                    TrajectoryPoint(
                        t=current_time,
                        position_ecef_km=[round(float(coord), 4) for coord in r_ecef],
                        position_teme_km=[round(float(coord), 4) for coord in r]
                    )
                )
        else:
            # Post-burn: relative deviation of asset from nominal path
            t_after_burn = (current_time - burn_time).total_seconds()
            Phi_rr, Phi_rv, _, _ = build_cw_state_transition(n, t_after_burn)
            
            # Initial velocity deviation in Hill frame
            delta_v_asset_hill = -(v_burn_hill - v0_hill)
            
            # Position deviation in Hill frame
            delta_r_asset_hill = Phi_rv @ delta_v_asset_hill
            
            # Nominal asset ECI state at current_time
            jd, fr = datetime_to_jd_fr(current_time)
            e, r_p_nom, v_p_nom = protected_satrec.sgp4(jd, fr)
            
            if e == 0:
                r_p_eci = np.array(r_p_nom, dtype=float)
                v_p_eci = np.array(v_p_nom, dtype=float)
                
                # Transform relative deviation from Hill back to ECI
                e_R = r_p_eci / np.linalg.norm(r_p_eci)
                h_vec = np.cross(r_p_eci, v_p_eci)
                e_C = h_vec / np.linalg.norm(h_vec)
                e_I = np.cross(e_C, e_R)
                T_ECI_to_Hill = np.vstack([e_R, e_I, e_C])
                
                # Absolute ECI post-burn position: r_post = r_nom + T^T * delta_r_asset
                r_post_eci = r_p_eci + (T_ECI_to_Hill.T @ delta_r_asset_hill)
                
                # Convert absolute post-burn ECI position to ECEF
                r_ecef, _ = teme_to_ecef(r_post_eci, v_p_eci, current_time)
                points.append(
                    TrajectoryPoint(
                        t=current_time,
                        position_ecef_km=[round(float(coord), 4) for coord in r_ecef],
                        position_teme_km=[round(float(coord), 4) for coord in r_post_eci]
                    )
                )
                
        current_time += timedelta(seconds=step_seconds)
        
    return points
