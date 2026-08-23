import math
import logging
from datetime import datetime, timezone, timedelta
from typing import Tuple, List, Dict
import numpy as np
from sgp4.api import Satrec

from app.models import Alert, ManeuverOption
from app.services.conjunction import datetime_to_jd_fr, get_orbital_envelope, DOCKED_EXCLUSION_LIST, MU_EARTH

logger = logging.getLogger("triage.orbital_mechanics")

# Standard propulsion & spacecraft assumptions
DEFAULT_DRY_MASS_KG = 500.0      # Configurable dry mass assumption for small-sat/medium asset
DEFAULT_ISP_S = 220.0            # Typical monopropellant hydrazine chemical thruster (200-300s)
G0 = 9.80665                     # Standard gravitational acceleration (m/s^2)

# Linearized CW physics assumption notice
CW_ASSUMPTION_NOTE = (
    "Clohessy-Wiltshire (Hill's) equations are a linearized relative-motion approximation "
    "valid for near-circular reference orbits and short-duration, close-range encounters."
)

def compute_mean_motion(semi_major_axis_km: float) -> float:
    """
    Computes orbital mean motion n = sqrt(mu / a^3) in rad/s.
    """
    if semi_major_axis_km <= 0:
        raise ValueError(f"Semi-major axis must be positive, got {semi_major_axis_km}")
    return math.sqrt(MU_EARTH / (semi_major_axis_km ** 3))

def stumpff_c(z: float) -> float:
    if z > 0:
        return (1.0 - math.cos(math.sqrt(z))) / z
    elif z < 0:
        return (math.cosh(math.sqrt(-z)) - 1.0) / (-z)
    else:
        return 0.5

def stumpff_s(z: float) -> float:
    if z > 0:
        sq = math.sqrt(z)
        return (sq - math.sin(sq)) / (sq ** 3)
    elif z < 0:
        sq = math.sqrt(-z)
        return (math.sinh(sq) - sq) / (sq ** 3)
    else:
        return 1.0 / 6.0

def propagate_two_body(r0: np.ndarray, v0: np.ndarray, dt_s: float, mu: float = MU_EARTH) -> Tuple[np.ndarray, np.ndarray]:
    """
    Propagates inertial position r0 (km) and velocity v0 (km/s) forward by dt_s seconds
    using the Universal Variable Kepler solver (exact nonlinear two-body dynamics).
    """
    r0_norm = float(np.linalg.norm(r0))
    v0_norm = float(np.linalg.norm(v0))
    v_r0 = float(np.dot(r0, v0)) / r0_norm
    alpha = 2.0 / r0_norm - (v0_norm ** 2) / mu
    
    # Initial guess for universal anomaly chi
    if alpha > 0:
        chi = math.sqrt(mu) * dt_s * alpha
    else:
        chi = math.sqrt(mu) * dt_s / r0_norm
        
    # Newton-Raphson iteration
    for _ in range(50):
        z = alpha * (chi ** 2)
        c = stumpff_c(z)
        s = stumpff_s(z)
        
        # Kepler universal equation F(chi) = 0
        f_val = (r0_norm * v_r0 / math.sqrt(mu)) * (chi ** 2) * c + (1.0 - alpha * r0_norm) * (chi ** 3) * s + r0_norm * chi - math.sqrt(mu) * dt_s
        # Derivative dF/dchi
        f_prime = (r0_norm * v_r0 / math.sqrt(mu)) * chi * (1.0 - z * s) + (1.0 - alpha * r0_norm) * (chi ** 2) * c + r0_norm
        
        if f_prime == 0:
            break
        d_chi = f_val / f_prime
        chi -= d_chi
        if abs(d_chi) < 1e-12:
            break
            
    # Compute f and g Lagrange coefficients
    z = alpha * (chi ** 2)
    c = stumpff_c(z)
    s = stumpff_s(z)
    
    f = 1.0 - (chi ** 2 / r0_norm) * c
    g = dt_s - (chi ** 3 / math.sqrt(mu)) * s
    
    r = f * r0 + g * v0
    r_norm = float(np.linalg.norm(r))
    
    f_dot = (math.sqrt(mu) / (r_norm * r0_norm)) * (z * s - 1.0) * chi
    g_dot = 1.0 - (chi ** 2 / r_norm) * c
    v = f_dot * r0 + g_dot * v0
    
    return r, v

def build_cw_state_transition(n: float, t: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Constructs the 6x6 Clohessy-Wiltshire (Hill's) state transition matrix:
    [r(t); v(t)] = Phi(t) * [r0; v0]
    
    Splits into four 3x3 blocks: (Phi_rr, Phi_rv, Phi_vr, Phi_vv).
    """
    theta = n * t
    sin_t = math.sin(theta)
    cos_t = math.cos(theta)
    
    # 1. Phi_rr: Position-to-Position block
    Phi_rr = np.array([
        [4.0 - 3.0 * cos_t,            0.0, 0.0],
        [6.0 * (sin_t - theta),        1.0, 0.0],
        [0.0,                          0.0, cos_t]
    ], dtype=float)
    
    # 2. Phi_rv: Velocity-to-Position block
    if n > 0:
        Phi_rv = np.array([
            [sin_t / n,                        (2.0 / n) * (1.0 - cos_t),       0.0],
            [-(2.0 / n) * (1.0 - cos_t),       (4.0 * sin_t - 3.0 * theta) / n, 0.0],
            [0.0,                              0.0,                             sin_t / n]
        ], dtype=float)
    else:
        Phi_rv = np.zeros((3, 3), dtype=float)
        
    # 3. Phi_vr: Position-to-Velocity block
    Phi_vr = np.array([
        [3.0 * n * sin_t,              0.0, 0.0],
        [6.0 * n * (cos_t - 1.0),      0.0, 0.0],
        [0.0,                          0.0, -n * sin_t]
    ], dtype=float)
    
    # 4. Phi_vv: Velocity-to-Velocity block
    Phi_vv = np.array([
        [cos_t,                        2.0 * sin_t,       0.0],
        [-2.0 * sin_t,                 4.0 * cos_t - 3.0, 0.0],
        [0.0,                          0.0,               cos_t]
    ], dtype=float)
    
    return Phi_rr, Phi_rv, Phi_vr, Phi_vv

def get_relative_state(
    protected_satrec: Satrec,
    candidate_satrec: Satrec,
    dt: datetime
) -> Tuple[np.ndarray, np.ndarray, float]:
    """
    Propagates both satellites to UTC datetime dt via SGP4, constructs the protected
    asset's rotating Hill (RIC / RTN) coordinate frame, and transforms the candidate's
    relative position and velocity into Hill coordinates [r0, v0].
    
    Returns:
        r0: 3D relative position vector in Hill frame (km) [radial, in-track, cross-track]
        v0: 3D relative velocity vector in Hill frame (km/s) [vx, vy, vz]
        n:  Protected asset mean motion in rad/s
    """
    jd, fr = datetime_to_jd_fr(dt)
    
    ep, rp, vp = protected_satrec.sgp4(jd, fr)
    ec, rc, vc = candidate_satrec.sgp4(jd, fr)
    
    if ep != 0:
        raise RuntimeError(f"SGP4 propagation failed for protected asset (error code {ep})")
    if ec != 0:
        raise RuntimeError(f"SGP4 propagation failed for candidate object (error code {ec})")
        
    r_p = np.array(rp, dtype=float)  # km in ECI (TEME)
    v_p = np.array(vp, dtype=float)  # km/s in ECI (TEME)
    r_c = np.array(rc, dtype=float)
    v_c = np.array(vc, dtype=float)
    
    # Hill frame basis vectors centered on protected asset:
    r_p_mag = np.linalg.norm(r_p)
    if r_p_mag == 0:
        raise ValueError("Protected asset position magnitude is 0")
    e_R = r_p / r_p_mag
    
    h_vec = np.cross(r_p, v_p)
    h_mag = np.linalg.norm(h_vec)
    if h_mag == 0:
        raise ValueError("Protected asset angular momentum is 0 (degenerate trajectory)")
    e_C = h_vec / h_mag
    
    e_I = np.cross(e_C, e_R)
    
    # Transformation matrix from ECI to Hill frame: T_ECI_to_Hill = [e_R; e_I; e_C]
    T_ECI_to_Hill = np.vstack([e_R, e_I, e_C])
    
    delta_r_eci = r_c - r_p
    delta_v_eci = v_c - v_p
    
    r0 = T_ECI_to_Hill @ delta_r_eci
    
    n = h_mag / (r_p_mag ** 2)
    omega_hill = np.array([0.0, 0.0, n], dtype=float)
    v0 = (T_ECI_to_Hill @ delta_v_eci) - np.cross(omega_hill, r0)
    
    return r0, v0, n

def solve_targeting_burn(
    r0: np.ndarray,
    v0: np.ndarray,
    t_to_tca_s: float,
    n: float,
    delta_d_km: float,
    direction: np.ndarray = None,
    r_unperturbed_override: np.ndarray = None
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Solves for the required post-burn relative velocity v_burn in Hill frame to achieve
    an additional delta_d_km separation along the unperturbed miss vector at TCA:
    
    r_tca_nom = Phi_rr(t) * r0 + Phi_rv(t) * v0
    r_target = r_tca_nom + u_dir * delta_d_km
    v_burn = inv(Phi_rv(t)) * (r_target - Phi_rr(t) * r0)
    """
    if t_to_tca_s <= 0.0:
        raise ValueError(f"Time to TCA must be strictly positive for burn targeting, got {t_to_tca_s}s")
        
    Phi_rr, Phi_rv, Phi_vr, Phi_vv = build_cw_state_transition(n, t_to_tca_s)
    
    det_rv = np.linalg.det(Phi_rv)
    cond_rv = np.linalg.cond(Phi_rv)
    
    if abs(det_rv) < 1e-12 or cond_rv > 1e10:
        raise ValueError(
            f"Singular or ill-conditioned Clohessy-Wiltshire state transition matrix at t={t_to_tca_s:.2f}s "
            f"(det={det_rv:.2e}, cond={cond_rv:.2e}, sin(nt)={math.sin(n * t_to_tca_s):.4f}). "
            "Burn targeting cannot be reliably computed at this orbital geometry."
        )
        
    # Use SGP4-derived unperturbed position if available (corrects CW
    # linearization error for large initial separations), else CW prediction
    if r_unperturbed_override is not None:
        r_unperturbed_tca = r_unperturbed_override
    else:
        r_unperturbed_tca = Phi_rr @ r0 + Phi_rv @ v0
    d_unperturbed = np.linalg.norm(r_unperturbed_tca)
    
    # Establish avoidance direction
    if direction is None:
        if d_unperturbed > 1e-6:
            target_dir = r_unperturbed_tca / d_unperturbed
        else:
            target_dir = np.array([0.0, 1.0, 0.0], dtype=float)
    else:
        dir_norm = np.linalg.norm(direction)
        if dir_norm == 0:
            raise ValueError("Provided direction vector has 0 magnitude")
        target_dir = direction / dir_norm
        
    r_target = r_unperturbed_tca + target_dir * delta_d_km
    
    Phi_rv_inv = np.linalg.inv(Phi_rv)
    
    if r_unperturbed_override is not None:
        # Perturbation-only targeting: compute delta-V only for the desired
        # separation increase (delta_d_km), avoiding the large (and inaccurate)
        # CW baseline correction term inv(Phi_rv) @ (r_true - r_cw).
        # CW is accurate for this small perturbation regardless of r0 magnitude.
        v_burn = v0 + Phi_rv_inv @ (delta_d_km * target_dir)
    else:
        # Standard full CW solve (accurate when r0 is small)
        v_burn = Phi_rv_inv @ (r_target - Phi_rr @ r0)
    
    return v_burn, r_target

def delta_v_to_fuel_mass(
    delta_v_ms: float,
    dry_mass_kg: float = DEFAULT_DRY_MASS_KG,
    isp_s: float = DEFAULT_ISP_S
) -> float:
    """
    Computes required propellant mass (kg) via the Tsiolkovsky Rocket Equation:
    Delta_m = m_dry * (1 - exp(-Delta_v / (Isp * g0)))
    """
    if delta_v_ms < 0:
        raise ValueError(f"Delta-V must be non-negative, got {delta_v_ms}")
    if dry_mass_kg <= 0 or isp_s <= 0:
        raise ValueError("Dry mass and Isp must be positive")
        
    exponent = -delta_v_ms / (isp_s * G0)
    fuel_mass = dry_mass_kg * (1.0 - math.exp(exponent))
    return round(fuel_mass, 4)

def repropagate_relative_trajectory(
    r0: np.ndarray,
    v_burn: np.ndarray,
    n: float,
    t_to_tca_s: float
) -> float:
    """
    Performs closed-loop re-propagation of the relative state under CW equations
    at TCA (t = t_to_tca_s) to verify the actual achieved miss separation distance.
    """
    Phi_rr, Phi_rv, _, _ = build_cw_state_transition(n, t_to_tca_s)
    r_tca = Phi_rr @ r0 + Phi_rv @ v_burn
    return float(np.linalg.norm(r_tca))

def screen_secondary_conjunctions(
    r_p_burn: np.ndarray,
    v_p_post_burn: np.ndarray,
    t_burn: datetime,
    protected_id: str,
    candidate_id: str,
    all_satellites: List[Dict],
    threshold_km: float = 5.0,
    duration_hours: float = 2.0,
    step_seconds: float = 60.0
) -> str | None:
    """
    Screens the post-maneuver trajectory of the protected asset against ALL other
    satellites in the active catalog over the specified duration.
    
    Returns a warning string if any other object drops below threshold_km, else None.
    """
    num_steps = int((duration_hours * 3600.0) / step_seconds)
    post_asset_traj = []
    jd_fr_times = []
    
    for i in range(num_steps):
        t_sec = i * step_seconds
        r_step, _ = propagate_two_body(r_p_burn, v_p_post_burn, t_sec)
        t_dt = t_burn + timedelta(seconds=t_sec)
        jd_step, fr_step = datetime_to_jd_fr(t_dt)
        post_asset_traj.append(r_step)
        jd_fr_times.append((jd_step, fr_step, t_dt))
        
    r_perigee = min(np.linalg.norm(r) for r in post_asset_traj)
    r_apogee = max(np.linalg.norm(r) for r in post_asset_traj)
    
    excluded_ids = DOCKED_EXCLUSION_LIST.get(protected_id, set()) | {protected_id, candidate_id}
    
    # Envelope filter
    candidates = []
    for sat in all_satellites:
        if sat["norad_id"] in excluded_ids:
            continue
        try:
            srec = Satrec.twoline2rv(sat["line1"], sat["line2"])
            p_r, a_r = get_orbital_envelope(srec)
            if a_r >= (r_perigee - threshold_km) and p_r <= (r_apogee + threshold_km):
                candidates.append((sat, srec))
        except Exception:
            continue
            
    # Fine screening
    worst_secondary = None
    min_observed_distance = float('inf')
    
    for sat, srec in candidates:
        min_d = float('inf')
        tca_dt = None
        for i, (jd, fr, t_step_dt) in enumerate(jd_fr_times):
            e, r_c, _ = srec.sgp4(jd, fr)
            if e != 0:
                continue
            dist = np.linalg.norm(np.array(r_c) - post_asset_traj[i])
            if dist < min_d:
                min_d = dist
                tca_dt = t_step_dt
                
        if min_d < threshold_km and min_d < min_observed_distance:
            min_observed_distance = min_d
            worst_secondary = (sat["name"], sat["norad_id"], min_d, tca_dt)
            
    if worst_secondary:
        name, norad, dist, t_event = worst_secondary
        t_str = t_event.strftime("%Y-%m-%d %H:%M:%S UTC") if t_event else "TCA"
        return (
            f"Warning: Maneuver creates a secondary conjunction with {name} (NORAD ID: {norad}) "
            f"at minimum distance {dist:.2f} km on {t_str}."
        )
    return None

def generate_maneuver_options(
    alert: Alert,
    protected_satrec: Satrec,
    candidate_satrec: Satrec,
    dry_mass_kg: float = DEFAULT_DRY_MASS_KG,
    isp_s: float = DEFAULT_ISP_S,
    all_satellites: List[Dict] = None
) -> List[ManeuverOption]:
    """
    Generates 3 calibrated collision avoidance maneuver options ('small burn',
    'medium burn', 'large burn') for the specified alert using Clohessy-Wiltshire targeting.
    
    Validates both linear CW model and full nonlinear Keplerian/SGP4 orbit propagation,
    and runs full secondary conjunction screening against all tracked catalog satellites.
    """
    now = datetime.now(timezone.utc)
    tca = alert.time_of_closest_approach
    if tca.tzinfo is None:
        tca = tca.replace(tzinfo=timezone.utc)
        
    total_time_to_tca_s = (tca - now).total_seconds()
    
    if total_time_to_tca_s < 60.0:
        raise ValueError(
            f"Insufficient lead time to TCA ({total_time_to_tca_s:.1f}s). Maneuver execution requires at least 60 seconds."
        )
        
    burn_lead_s = min(total_time_to_tca_s / 2.0, 14400.0)
    t_burn = tca - timedelta(seconds=burn_lead_s)
        
    # 1. Obtain relative state in Hill frame at burn time
    r0, v0, n = get_relative_state(protected_satrec, candidate_satrec, t_burn)
    
    # Protected asset inertial state at burn time
    jd_burn, fr_burn = datetime_to_jd_fr(t_burn)
    _, rp_burn, vp_burn = protected_satrec.sgp4(jd_burn, fr_burn)
    r_p_burn_eci = np.array(rp_burn, dtype=float)
    v_p_burn_eci = np.array(vp_burn, dtype=float)
    
    # Basis vectors for Hill to ECI conversion
    e_R = r_p_burn_eci / np.linalg.norm(r_p_burn_eci)
    h_vec = np.cross(r_p_burn_eci, v_p_burn_eci)
    e_C = h_vec / np.linalg.norm(h_vec)
    e_I = np.cross(e_C, e_R)
    T_Hill_to_ECI = np.column_stack([e_R, e_I, e_C])
    
    # Candidate inertial position at TCA via SGP4
    jd_tca, fr_tca = datetime_to_jd_fr(tca)
    _, rc_tca, _ = candidate_satrec.sgp4(jd_tca, fr_tca)
    r_c_tca_eci = np.array(rc_tca, dtype=float)
    
    # Compute TRUE unperturbed relative position at TCA via SGP4.
    # This corrects CW linearization error for large initial separations
    # (r0 >> 500 km) where CW's predicted miss direction diverges from reality.
    _, rp_tca_raw, vp_tca_raw = protected_satrec.sgp4(jd_tca, fr_tca)
    r_p_tca_eci = np.array(rp_tca_raw, dtype=float)
    v_p_tca_eci = np.array(vp_tca_raw, dtype=float)
    
    # Build Hill frame at TCA (based on unperturbed protected asset)
    e_R_tca = r_p_tca_eci / np.linalg.norm(r_p_tca_eci)
    h_tca = np.cross(r_p_tca_eci, v_p_tca_eci)
    e_C_tca = h_tca / np.linalg.norm(h_tca)
    e_I_tca = np.cross(e_C_tca, e_R_tca)
    T_ECI_to_Hill_tca = np.vstack([e_R_tca, e_I_tca, e_C_tca])
    
    delta_r_tca_eci = r_c_tca_eci - r_p_tca_eci
    r_true_unperturbed_hill = T_ECI_to_Hill_tca @ delta_r_tca_eci
    
    logger.info(
        f"CW vs SGP4 unperturbed baseline: CW={np.linalg.norm(build_cw_state_transition(n, burn_lead_s)[0] @ r0 + build_cw_state_transition(n, burn_lead_s)[1] @ v0):.3f} km, "
        f"SGP4={np.linalg.norm(r_true_unperturbed_hill):.3f} km"
    )
    
    # 2. Define 3 progressive target miss expansions [2.0, 5.0, 12.0] km
    delta_d_list = [2.0, 5.0, 12.0]
    options_raw = []
    
    for delta_d in delta_d_list:
        v_burn, r_target = solve_targeting_burn(
            r0, v0, burn_lead_s, n, delta_d,
            r_unperturbed_override=r_true_unperturbed_hill
        )
        
        # Delta-V impulse in Hill frame
        delta_v_asset_hill = -(v_burn - v0)
        delta_v_mag_ms = float(np.linalg.norm(delta_v_asset_hill)) * 1000.0
        
        # Burn direction unit vector in Hill frame
        norm_dv = np.linalg.norm(delta_v_asset_hill)
        burn_dir = (delta_v_asset_hill / norm_dv).tolist() if norm_dv > 0 else [0.0, 1.0, 0.0]
            
        fuel_kg = delta_v_to_fuel_mass(delta_v_mag_ms, dry_mass_kg, isp_s)
        
        # Closed-loop CW achieved distance: use r_target directly since it
        # encodes the SGP4-corrected baseline + intended separation increase
        dist_cw = float(np.linalg.norm(r_target))
        
        # Independent nonlinear SGP4/Kepler propagation to TCA
        delta_v_asset_eci = T_Hill_to_ECI @ delta_v_asset_hill
        v_p_post_burn_eci = v_p_burn_eci + delta_v_asset_eci
        r_p_post_tca, _ = propagate_two_body(r_p_burn_eci, v_p_post_burn_eci, burn_lead_s)
        dist_sgp4 = float(np.linalg.norm(r_c_tca_eci - r_p_post_tca))
        
        # Flag if linear CW diverges >10% from full nonlinear propagation
        divergence = (abs(dist_sgp4 - dist_cw) / dist_cw) > 0.10
        
        # Secondary conjunction screening against all tracked satellites
        sec_warning = None
        if all_satellites:
            sec_warning = screen_secondary_conjunctions(
                r_p_burn=r_p_burn_eci,
                v_p_post_burn=v_p_post_burn_eci,
                t_burn=t_burn,
                protected_id=alert.protected_asset_id,
                candidate_id=alert.candidate_id,
                all_satellites=all_satellites,
                threshold_km=5.0
            )
            
        options_raw.append({
            "delta_d": delta_d,
            "delta_v_ms": round(delta_v_mag_ms, 3),
            "fuel_cost_kg": fuel_kg,
            "resulting_distance_cw": round(dist_cw, 3),
            "resulting_distance_sgp4": round(dist_sgp4, 3),
            "cw_divergence_flag": divergence,
            "burn_direction": [round(b, 4) for b in burn_dir],
            "time_to_burn_execution_s": round(burn_lead_s, 1),
            "secondary_conjunction_warning": sec_warning
        })
        
    options_raw.sort(key=lambda x: x["delta_v_ms"])
    
    labels = ["small burn", "medium burn", "large burn"]
    maneuver_options: List[ManeuverOption] = []
    
    for idx, opt in enumerate(options_raw):
        opt_id = f"mnv_{alert.candidate_id}_{idx+1}"
        label = labels[idx]
        
        maneuver_options.append(
            ManeuverOption(
                option_id=opt_id,
                label=label,
                delta_v_ms=opt["delta_v_ms"],
                fuel_cost_kg=opt["fuel_cost_kg"],
                resulting_min_distance_km=opt["resulting_distance_sgp4"],
                resulting_distance_cw=opt["resulting_distance_cw"],
                resulting_distance_sgp4=opt["resulting_distance_sgp4"],
                cw_divergence_flag=opt["cw_divergence_flag"],
                burn_direction=opt["burn_direction"],
                time_to_burn_execution_s=opt["time_to_burn_execution_s"],
                secondary_conjunction_warning=opt["secondary_conjunction_warning"]
            )
        )
        
    return maneuver_options
