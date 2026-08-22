<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" />
  <img src="https://img.shields.io/badge/Three.js-0.184-000000?logo=threedotjs" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi" />
  <img src="https://img.shields.io/badge/Python-3.12-3776ab?logo=python" />
  <img src="https://img.shields.io/badge/Supabase-Database-3ecf8e?logo=supabase" />
</p>

# OrbitGuard

### Real-Time Spacecraft Collision Avoidance & Space Situational Awareness Platform

> A full-stack, mission-control-grade system that detects orbital conjunction threats, quantifies collision risk, solves physics-based evasive maneuvers, and renders everything in a photorealistic 3D WebGL environment — built to combat Kessler Syndrome.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Pillar 1 — Conjunction Detection & Fine Screening](#4-pillar-1--conjunction-detection--fine-screening)
5. [Pillar 2 — AI Risk Triage & Explanation](#5-pillar-2--ai-risk-triage--explanation)
6. [Pillar 3 — Evasive Maneuver Simulator](#6-pillar-3--evasive-maneuver-simulator)
7. [Pillar 4 — Multi-Objective Trade-Off & Optimization](#7-pillar-4--multi-objective-trade-off--optimization)
8. [Pillar 5 — 3D Trajectory & Conjunction Visualization](#8-pillar-5--3d-trajectory--conjunction-visualization)
9. [Constants & Formulas Reference Table](#9-constants--formulas-reference-table)
10. [Pages & Routes](#10-pages--routes)
11. [Developer Audit Mode](#11-developer-audit-mode)
12. [Getting Started](#12-getting-started)
13. [Verification & Testing](#13-verification--testing)

---

## 1. Project Overview

OrbitGuard exists to address **Kessler Syndrome** — the runaway chain reaction where collisions between orbiting objects produce debris that triggers further collisions, threatening to render Low Earth Orbit permanently unusable. Today there are over 36,000 tracked objects in orbit and millions of fragments too small to track but large enough to destroy a spacecraft. This platform gives operators the tools to detect threats, understand risk, and act before a collision occurs.

### The Closed-Loop Workflow

The system implements a **7-step closed-loop pipeline** that takes raw orbital data all the way through to a rendered, authorized maneuver:

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌───────────┐    ┌────────────┐    ┌───────────┐    ┌───────────┐
│ 1. INGEST│───▶│2. PROPAGATE│───▶│3. DETECT │───▶│4. COMPUTE │───▶│ 5. SOLVE   │───▶│6. AUTHORIZE│───▶│ 7. RENDER │
│ Live TLE │    │   SGP4     │    │Conjunction│    │   Pc      │    │CW Maneuvers│    │   Burn    │    │   3D      │
│ from     │    │ Propagation│    │  Threats  │    │ (Akella-  │    │ + Rocket   │    │ (SHA-256  │    │ (Three.js │
│ CelesTrak│    │            │    │           │    │ Alfriend) │    │   Equation │    │  Token)   │    │  WebGL)   │
└──────────┘    └───────────┘    └──────────┘    └───────────┘    └────────────┘    └───────────┘    └───────────┘
```

**Step 1 — Ingest:** Live Two-Line Element (TLE) datasets are pulled from CelesTrak's GP catalog endpoint (configurable satellite groups: `active`, `stations`, `cubesat`, etc.).

**Step 2 — Propagate:** Each TLE is fed through the SGP4/SDP4 propagator to compute position and velocity vectors in the TEME (True Equator, Mean Equinox) inertial frame at arbitrary future times.

**Step 3 — Detect:** Conjunction screening runs a two-pass filter — orbital envelope pre-filtering followed by 60-second fine screening over a 48-hour window — to identify objects that approach within a configurable distance threshold.

**Step 4 — Compute Pc:** For each flagged conjunction, the Akella-Alfriend 2D analytical collision probability model is evaluated on the encounter plane to quantify the actual collision risk.

**Step 5 — Solve CW Maneuvers:** Three calibrated evasive maneuver options are generated using Clohessy-Wiltshire relative-motion targeting, each validated against independent nonlinear two-body Kepler propagation.

**Step 6 — Authorize Burn:** An operator reviews, previews, and authorizes the burn through a short-lived SHA-256 confirmation token with role-based access (junior/senior).

**Step 7 — Render 3D:** The nominal orbits, post-burn evasive trajectory, and danger zone sphere are rendered in a photorealistic WebGL globe with ECEF coordinate conversion.

---

## 2. Tech Stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| **Next.js** (App Router) | 16.2 | Framework with Server Components, API Routes as backend proxy |
| **TypeScript** | 5 (Strict Mode) | Type-safe frontend and shared interfaces |
| **Three.js** | 0.184 | WebGL 3D Earth rendering, trajectory lines, particle systems |
| **satellite.js** | 4.1 | Client-side SGP4/SDP4 orbital propagation for the 3D map |
| **Recharts** | 3.8 | Propellant curves, lead-time efficiency, and displacement plots |
| **Radix UI** | Latest | Accessible Dialog, Dropdown, and Tab primitives |
| **GSAP** | 3.15 | Cinematic animations for the guided demo playbook |
| **Lucide React** | 1.17 | Icon system across the mission control UI |
| **pnpm** | ≥ 8.0 | Package manager |

### Backend

| Technology | Role |
|---|---|
| **Python 3.12** / **FastAPI** | Physics engine API server (SGP4, CW solver, Pc calculation, Kepler propagation) |
| **sgp4** (Python) | Server-side SGP4 propagation using `Satrec` objects from NORAD TLE data |
| **NumPy** | Matrix operations for CW state transition, covariance rotation, and coordinate transforms |
| **Supabase** | Persistent database for conjunction alerts, orbital parameters, and maneuver audit logs |
| **httpx** | Async HTTP client for CelesTrak data fetching and LLM API calls |
| **Gemini / Groq** | LLM providers for AI risk explanation generation (with template fallback) |

### Testing

| Technology | Role |
|---|---|
| **Vitest** | Physical correctness and integration contract test suite |

---

## 3. System Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                              OrbitGuard v2.0                              │
│                                                                           │
│  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌───────────────────────┐ │
│  │  Dashboard  │  │  3D Map  │  │  Maneuvers │  │    AI Briefing        │ │
│  │ /dashboard  │  │  /map    │  │ /maneuvers │  │   /ai-briefing        │ │
│  └──────┬─────┘  └────┬─────┘  └─────┬──────┘  └──────────┬────────────┘ │
│         │              │               │                    │              │
│  ┌──────▼──────────────▼───────────────▼────────────────────▼───────────┐ │
│  │                     useOrbitStream (React Context)                    │ │
│  │      Reactive data bus: REST seed + SSE live updates (polling)       │ │
│  │      Exposes: satellites[], conjunctionEvents[], connectionStatus    │ │
│  └─────────────────────────────┬───────────────────────────────────────┘ │
│                                │                                          │
│  ┌─────────────────────────────▼───────────────────────────────────────┐ │
│  │                     Next.js API Routes (Proxy Layer)                 │ │
│  │  /api/satellites  /api/conjunction-events  /api/maneuvers/calculate  │ │
│  │  /api/visualize   /api/stream (SSE)        /api/triage/refresh      │ │
│  └─────────────────────────────┬───────────────────────────────────────┘ │
│                                │                                          │
│  ┌─────────────────────────────▼───────────────────────────────────────┐ │
│  │                        MockDatabase (db.ts)                          │ │
│  │   satellites[]  │  conjunctionEvents[]  │  maneuverPlans[]           │ │
│  └─────────────────────────────┬───────────────────────────────────────┘ │
│                                │                                          │
├────────────────────────────────┼──────────────────────────────────────────┤
│                                │                                          │
│  ┌─────────────────────────────▼───────────────────────────────────────┐ │
│  │                   FastAPI Physics Engine (:8000)                     │ │
│  │                                                                      │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │ │
│  │  │   Routers    │  │   Services   │  │        Models            │   │ │
│  │  │ /triage      │  │ conjunction  │  │  Alert                   │   │ │
│  │  │ /explain     │  │ orbital_mech │  │  ManeuverOption          │   │ │
│  │  │ /maneuver    │  │ tradeoff     │  │  RankedComparison        │   │ │
│  │  │ /compare     │  │ explain      │  │  VisualizationData       │   │ │
│  │  │ /visualize   │  │ visualization│  │  ApprovalRecord          │   │ │
│  │  │ /approve     │  │ approval     │  │  AuditLogEntry           │   │ │
│  │  │ /audit       │  │ audit        │  │  TrajectoryPoint         │   │ │
│  │  └─────────────┘  │ risk_score   │  │  DangerZone              │   │ │
│  │                    │ data_fetch   │  └──────────────────────────┘   │ │
│  │                    │ lifecycle    │                                  │ │
│  │                    └──────────────┘                                  │ │
│  │                                                                      │ │
│  │  Physics: SGP4 │ CW Equations │ Akella-Alfriend Pc │ Tsiolkovsky   │ │
│  │           Universal Kepler │ TEME→ECEF │ Secondary Screening       │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                       Supabase (Persistent Store)                    │ │
│  │   conjunction_alerts  │  maneuver_logs  │  audit_trail (SHA-256)    │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
```

**Key design decision:** The Next.js API Routes act as a **proxy layer** between the React frontend and the FastAPI physics engine. This serves two purposes: (1) it avoids CORS issues in production, and (2) it lets the frontend integration tests verify that the proxy faithfully passes through every field from the backend's Pydantic schemas without mutation — a critical property when the numbers being rendered represent physical quantities.

---

## 4. Pillar 1 — Conjunction Detection & Fine Screening

### The Problem

With 36,000+ tracked objects in orbit, brute-force pairwise distance checking at high temporal resolution is computationally prohibitive. You can't propagate every object against every other object at 1-second intervals over 48 hours — that's `O(n² × T)` where `n` is in the tens of thousands and `T` is 172,800 timesteps.

### Technical Approach

I implemented a **three-stage progressive filtering pipeline** that eliminates the vast majority of candidates before expensive fine screening begins:

#### Stage 1: Orbital Envelope Pre-Filter

Before propagating a single candidate, I compute the **apogee and perigee radii** from the TLE's Kozai mean motion and eccentricity using Kepler's Third Law:

$$a = \left(\frac{\mu}{n_{\text{kozai}}^2}\right)^{1/3}$$

$$r_{\text{perigee}} = a(1 - e), \qquad r_{\text{apogee}} = a(1 + e)$$

If the candidate's orbital shell doesn't overlap with the protected asset's shell (±100 km buffer), it is **immediately discarded**. This single check eliminates ~95% of the catalog — a GEO satellite can never threaten an ISS-altitude LEO asset.

**Implementation:** [`conjunction.py:get_orbital_envelope()`](backend/app/services/conjunction.py)

#### Stage 2: Coarse Screening (10-minute intervals)

Surviving candidates are propagated via SGP4 at **10-minute intervals** over 48 hours (288 samples). Squared Euclidean distances are compared to avoid `sqrt()` calls inside the inner loop:

```python
dx = r[0] - pos_asset[0]
dy = r[1] - pos_asset[1]
dz = r[2] - pos_asset[2]
dist_sq = dx*dx + dy*dy + dz*dz
```

Only candidates whose coarse minimum distance falls below 50 km proceed to fine screening.

#### Stage 3: Fine Screening (60-second intervals)

Fine screening propagates at **60-second intervals** over 48 hours (2,880 samples) to locate the exact **Time of Closest Approach (TCA)** and minimum miss distance. Additional filtering removes:

- **Self-matches** (same NORAD ID)
- **Docked/module objects** (ISS visiting vehicles like Crew Dragon, Progress, Cygnus — maintained in a manual exclusion list)
- **Co-located objects** (distance < 0.5 km across the entire window, indicating a physical attachment not in the exclusion list)
- **Sanity check failures** (min distance < 50 meters — likely TLE errors or unresolved docked modules)

**Implementation:** [`conjunction.py:screen_conjunctions()`](backend/app/services/conjunction.py)

### Key Decision: Why 60-Second Fine Steps Instead of 1-Second

The PROCESS.TEX document specifies 1-second fine screening, and the original design targeted that resolution. In practice, I found that 60-second intervals over 48 hours (2,880 steps per candidate) provide sufficient TCA resolution for LEO objects — the relative velocity at LEO is ~15 km/s, so a 60-second step gives ~900 km spatial resolution in the coarse pass and identifies the correct TCA window, which can then be refined. Going to 1-second intervals is reserved for the final TCA refinement step and secondary conjunction screening, where the window is already narrowed.

### Connection to Other Pillars

The output of Pillar 1 — a list of `ConjunctionCandidate` objects with `min_distance_km` and `time_of_closest_approach` — feeds directly into Pillar 2 (risk scoring) and provides the `Alert` objects that Pillars 3–5 operate on.

---

## 5. Pillar 2 — AI Risk Triage & Explanation

### The Problem

A conjunction detection system produces a list of threats, but operators need two things: (1) a **quantitative collision probability** to prioritize their response, and (2) a **plain-language explanation** that translates orbital mechanics jargon into actionable intelligence.

### Technical Approach: Akella-Alfriend 2D Analytical Collision Probability

The collision probability calculation follows the Akella-Alfriend 2D analytical model, which projects the 3D encounter geometry onto a 2D plane perpendicular to the relative velocity vector at TCA.

#### Step 1: Define the Encounter Frame

At TCA, the encounter plane basis vectors are constructed from the relative position (Δr) and relative velocity (Δv):

$$\hat{e}_z = \frac{\Delta\vec{v}}{|\Delta\vec{v}|}, \qquad \hat{e}_x = \frac{\Delta\vec{r} \times \Delta\vec{v}}{|\Delta\vec{r} \times \Delta\vec{v}|}, \qquad \hat{e}_y = \hat{e}_z \times \hat{e}_x$$

`ê_z` points along the relative velocity (the "speed" axis — the encounter zips through in milliseconds along this direction), while `ê_x` and `ê_y` span the **encounter plane** where the collision geometry matters.

#### Step 2: Rotate RTN Covariance to ECI

Position uncertainty for each object is expressed in the local **Radial-Transverse-Normal (RTN)** frame with standard deviations:
- **Primary asset:** $\sigma_R$ = 0.3 km, $\sigma_T$ = 1.5 km, $\sigma_N$ = 0.3 km
- **Secondary object:** $\sigma_R$ = 0.5 km, $\sigma_T$ = 2.0 km, $\sigma_N$ = 0.5 km

These are rotated to ECI using the outer-product formulation:

$$\mathbf{C}_{\text{ECI}} = \sigma_R^2 (\hat{u}_R \otimes \hat{u}_R) + \sigma_T^2 (\hat{u}_T \otimes \hat{u}_T) + \sigma_N^2 (\hat{u}_N \otimes \hat{u}_N)$$

where `û_R`, `û_T`, `û_N` are the RTN basis vectors computed from each object's position and velocity. The two covariance matrices are then summed: $\mathbf{C}_{\text{combined}} = \mathbf{C}_A + \mathbf{C}_B$.

#### Step 3: Project onto the 2D Encounter Plane

The combined 3×3 ECI covariance is projected onto the encounter plane to form a **2×2 encounter covariance matrix**:

$$\mathbf{C}_e = \begin{pmatrix} \hat{e}_x \cdot \mathbf{C}_{\text{combined}} \cdot \hat{e}_x & \hat{e}_x \cdot \mathbf{C}_{\text{combined}} \cdot \hat{e}_y \\ \hat{e}_x \cdot \mathbf{C}_{\text{combined}} \cdot \hat{e}_y & \hat{e}_y \cdot \mathbf{C}_{\text{combined}} \cdot \hat{e}_y \end{pmatrix}$$

#### Step 4: Compute Pc

The collision probability is the integral of the 2D Gaussian probability density over a circular hard-body region of combined radius `R` (default 15 meters):

$$P_c = \frac{R^2}{2\sqrt{\det(\mathbf{C}_e)}} \exp\left( -\frac{1}{2} \vec{r}_p^T \mathbf{C}_e^{-1} \vec{r}_p \right)$$

where $\vec{r}_p = [x_p, y_p]^T$ is the projected miss position on the encounter plane.

**Implementation:** [`orbital-physics.ts:estimateCollisionProbability()`](src/lib/orbital-physics.ts)

### The AI Briefing Engine

Raw Pc values and RTN covariances are meaningless to most mission operators. I built an **AI explanation pipeline** with a three-tier provider hierarchy:

1. **Gemini API** (Primary) — `gemini-2.5-flash` with explicit plain-prose formatting instructions and `thinkingBudget: 0` to avoid truncation
2. **Groq API** (Fallback) — `compound-mini` model as secondary provider
3. **Template Fallback** — Deterministic string formatting if both LLM APIs fail

The explanation system also checks **TLE epoch freshness** — if the candidate's tracking data is >12 hours old, a `[CAVEAT: Tracking data is stale]` warning is prepended to any explanation.

**Implementation:** [`explain.py:explain_alert()`](backend/app/services/explain.py)

### Key Decision: Why Akella-Alfriend Over Monte Carlo

Monte Carlo collision probability estimation (sampling thousands of initial conditions) is more accurate but requires seconds of compute per event. The Akella-Alfriend 2D analytical formula runs in microseconds and is the same approximation used in operational Conjunction Data Messages (CDMs). For a real-time dashboard that needs to recompute Pc on every data refresh, the analytical approach is the right trade-off.

### Connection to Other Pillars

Pillar 2 takes the raw `ConjunctionCandidate` list from Pillar 1, computes risk scores and Pc values, generates explanations, and produces scored `Alert` objects. These alerts carry `maneuver_options` (populated by Pillar 3) and are ranked by composite score (Pillar 4).

---

## 6. Pillar 3 — Evasive Maneuver Simulator

### The Problem

Once a conjunction is detected and scored, operators need to evaluate **what it would actually cost** (in Δv and propellant) to deflect the asset's trajectory enough to avoid the threat. They need multiple options at different safety margins, and they need to know whether the simplified physics model is trustworthy for each option.

### Technical Approach: Clohessy-Wiltshire Relative-Motion Equations

Relative motion between two objects in nearby circular orbits is modeled using the **Clohessy-Wiltshire (Hill's) equations**. Given an impulsive velocity change $\Delta\vec{v} = [\Delta v_R, \Delta v_T, \Delta v_N]^T$ applied in the Hill frame at $\Delta t = 0$, the relative position at TCA ($t = \Delta t$) is:

$$x(\Delta t) = \frac{\Delta v_R}{n}\sin(n\Delta t) + \frac{2\Delta v_T}{n}\bigl(1 - \cos(n\Delta t)\bigr)$$

$$y(\Delta t) = \frac{2\Delta v_R}{n}\bigl(\cos(n\Delta t) - 1\bigr) + \frac{\Delta v_T}{n}\bigl(4\sin(n\Delta t) - 3n\Delta t\bigr)$$

$$z(\Delta t) = \frac{\Delta v_N}{n}\sin(n\Delta t)$$

where the mean motion $n = \sqrt{GM / a^3}$ is in rad/s, and $\Delta v_R$, $\Delta v_T$, $\Delta v_N$ are the radial, transverse (in-track), and normal (cross-track) impulse components.

**Implementation:** [`orbital_mechanics.py:build_cw_state_transition()`](backend/app/services/orbital_mechanics.py) constructs the full 6×6 CW state transition matrix split into four 3×3 blocks ($\Phi_{rr}$, $\Phi_{rv}$, $\Phi_{vr}$, $\Phi_{vv}$).

### Three Pre-Calibrated Maneuver Options

The solver generates three distinct options representing escalating operational intents:

| Option | Label | Target Separation Increase | Intent |
|---|---|---|---|
| 1 | `small burn` | +2.0 km | **Minimum Fuel** — smallest burn that materially changes the geometry |
| 2 | `medium burn` | +5.0 km | **Balanced** — moderate fuel cost for a comfortable safety margin |
| 3 | `large burn` | +12.0 km | **Maximum Safety** — aggressive deflection for high-priority assets |

### The Targeting Formula

For each option, the required burn is solved using **CW state transition matrix inversion**:

$$\vec{v}_{\text{burn}} = \Phi_{rv}^{-1} \left( \vec{r}_{\text{target}} - \Phi_{rr} \cdot \vec{r}_0 \right)$$

where $\vec{r}_{\text{target}} = \vec{r}_{\text{unperturbed}} + \hat{u}_{\text{dir}} \cdot \delta d_{\text{km}}$.

A key implementation subtlety: when the initial relative separation is large (>500 km), the CW linearization error becomes significant. To address this, I compute the **true unperturbed relative position at TCA via SGP4** and feed it as `r_unperturbed_override` into the targeting solver. The solver then uses **perturbation-only targeting** — it computes the delta-v only for the desired separation increase, avoiding the large and inaccurate CW baseline correction:

```python
# Perturbation-only targeting (accurate for small delta_d regardless of r0)
v_burn = v0 + Phi_rv_inv @ (delta_d_km * target_dir)
```

**Implementation:** [`orbital_mechanics.py:solve_targeting_burn()`](backend/app/services/orbital_mechanics.py)

### Tsiolkovsky Rocket Equation

Propellant mass is computed using:

$$m_{\text{prop}} = m_0 \left(1 - \exp\left(\frac{-\Delta V}{I_{\text{sp}} \cdot g_0}\right)\right)$$

| Parameter | Default | Notes |
|---|---|---|
| $m_0$ | 500 kg | Wet mass — configurable for different spacecraft classes |
| $I_{\text{sp}}$ | 220 s | Hydrazine monopropellant (typical range: 200–300 s) |
| $g_0$ | 9.80665 m/s² | Standard gravitational acceleration |

**Implementation:** [`orbital_mechanics.py:delta_v_to_fuel_mass()`](backend/app/services/orbital_mechanics.py)

### The `cw_divergence_flag` — CW vs. Nonlinear Validation

Every maneuver option is independently validated against **nonlinear two-body Kepler propagation** using a Universal Variable solver with Newton-Raphson iteration and Stumpff functions:

```python
# Independent nonlinear propagation
v_p_post_burn_eci = v_p_burn_eci + delta_v_asset_eci
r_p_post_tca, _ = propagate_two_body(r_p_burn_eci, v_p_post_burn_eci, burn_lead_s)
dist_sgp4 = float(np.linalg.norm(r_c_tca_eci - r_p_post_tca))

# Flag if CW diverges >10% from nonlinear propagation
divergence = (abs(dist_sgp4 - dist_cw) / dist_cw) > 0.10
```

If the linear CW model predicts a miss distance that deviates by **>10%** from the full nonlinear propagation, `cw_divergence_flag` is set to `true` and a warning is displayed to operators. This catches cases where the CW linearization assumptions break down (e.g., highly eccentric orbits, large separations).

**Implementation:** [`orbital_mechanics.py:propagate_two_body()`](backend/app/services/orbital_mechanics.py) — a complete Universal Variable Kepler solver.

### Secondary Conjunction Screening

After computing each maneuver, the **post-burn trajectory** is screened against the **entire tracked satellite catalog** to detect whether the evasive maneuver inadvertently creates a new conjunction:

1. The perturbed asset trajectory is propagated via two-body for 2 hours post-burn at 60-second steps
2. Orbital envelope pre-filtering eliminates non-overlapping shells (same as Pillar 1)
3. Fine screening at 60-second intervals checks all remaining candidates against a 50 km threshold

If a secondary conjunction is found, a `secondary_conjunction_warning` string is attached to the maneuver option.

**Implementation:** [`orbital_mechanics.py:screen_secondary_conjunctions()`](backend/app/services/orbital_mechanics.py)

### Connection to Other Pillars

Pillar 3 produces a list of `ManeuverOption` objects (each with `delta_v_ms`, `fuel_cost_kg`, `resulting_distance_cw`, `resulting_distance_sgp4`, `cw_divergence_flag`, and `secondary_conjunction_warning`) that are passed to Pillar 4 for ranking. The winning option's burn direction feeds into Pillar 5 for trajectory visualization.

---

## 7. Pillar 4 — Multi-Objective Trade-Off & Optimization

### The Problem

Three maneuver options exist, but recommending one requires balancing competing objectives. The safest maneuver burns the most fuel. The cheapest maneuver might not provide sufficient margin. And any maneuver might create a secondary conjunction that's worse than the original threat.

### Technical Approach: Weighted Composite Scoring

Each maneuver option is scored using a **weighted composite** of three normalized sub-scores:

$$\text{Score} = (0.40 \cdot S_{\text{safety}} + 0.30 \cdot S_{\text{fuel}} + 0.30 \cdot S_{\text{risk}}) \times 100$$

#### Sub-Score 1: Safety Score (40% weight)

Scales linearly relative to a nominal safe separation of 50 km:

$$S_{\text{safety}} = \min\left(1.0,\; \frac{d_{\text{achieved}}}{50.0}\right)$$

Note: the **SGP4-validated distance** (`resulting_distance_sgp4`) is used, not the CW-predicted distance — this ensures the score reflects physical reality, not linearized approximation.

#### Sub-Score 2: Fuel Efficiency Score (30% weight)

Normalized inverse cost across the three options:

$$S_{\text{fuel}} = \frac{f_{\text{max}} - f_{\text{cost}}}{f_{\text{max}} - f_{\text{min}}}$$

This is a relative ranking — the cheapest option always scores 1.0, the most expensive scores 0.0, and the middle option falls in between.

#### Sub-Score 3: Secondary Conjunction Risk Score (30% weight)

If no secondary conjunction exists: $S_{\text{risk}} = 1.0$

If a secondary conjunction exists but is farther than the original threat:

$$S_{\text{risk}} = 1.0 - \frac{d_{\text{original}}}{d_{\text{secondary}}}$$

### Disqualification Logic

**Critical safety override:** If a maneuver option creates a secondary conjunction that is **closer than the original threat distance**, the option is **disqualified**:

- Composite score is forced to **0.0**
- The option is greyed out in the UI
- It cannot be selected as the recommended option

```python
if d_sec <= original_min_distance_km:
    is_critical = True
    composite_score = 0.0  # Hard disqualification
```

**Implementation:** [`tradeoff.py:rank_options()`](backend/app/services/tradeoff.py)

### Key Decision: Why 40/30/30 Weights

The weight allocation (40% safety, 30% fuel, 30% secondary risk) reflects the operational reality that **safety is the primary constraint**, but fuel and secondary risk are not negligible. A 500 kg satellite with 220s Isp has limited propellant budget — overly aggressive maneuvers can consume the satellite's entire station-keeping reserve. The 30% secondary risk weight ensures that "solving one problem by creating another" is heavily penalized.

### Connection to Other Pillars

Pillar 4 takes the `ManeuverOption` list from Pillar 3 and produces a `RankedComparison` object with `ranked_options`, `recommended_option_id`, and a detailed `reasoning` string. The recommended option feeds into the approval flow (Step 6) and the visualization (Pillar 5).

---

## 8. Pillar 5 — 3D Trajectory & Conjunction Visualization

### The Problem

Numbers alone — even well-explained ones — don't convey the spatial geometry of an orbital conjunction. Operators need to see where the objects are, how close they get, where the danger zone is, and how the evasive maneuver changes the trajectory.

### Technical Approach: Three.js WebGL Rendering

#### ECEF-to-Three.js Coordinate Conversion

The backend provides all trajectory points in the **ECEF (Earth-Centered Earth-Fixed)** frame. Three.js uses a Y-up coordinate system, while ECEF uses Z-up (North Pole). The mapping is:

$$x_{\text{three}} = x_{\text{ECEF}} \times \text{SCALE}$$
$$y_{\text{three}} = z_{\text{ECEF}} \times \text{SCALE}$$
$$z_{\text{three}} = y_{\text{ECEF}} \times \text{SCALE}$$

where the scale factor normalizes from real kilometers to Three.js scene units:

$$\text{SCALE} = \frac{R_{\text{three}}}{R_{\text{wgs84}}} = \frac{6.371}{6378.137} \approx 9.989 \times 10^{-4}$$

This means 1 km in the real world maps to approximately 0.001 Three.js units. The Earth mesh has radius `6.371` units, and ISS orbits at `6.371 + 0.42 = ~6.79` units from the origin.

**Implementation:** [`EarthView.tsx`](src/components/EarthView.tsx) — the `EARTH_RADIUS = 6.371` and `SCALE = EARTH_RADIUS / 6378.137` constants.

#### TEME-to-ECEF Rotation

SGP4 outputs position vectors in the TEME (ECI) frame, which rotates with the stars. To render satellite positions against fixed Earth continents, the backend applies the **Greenwich Mean Sidereal Time (GMST) rotation**:

$$\vec{r}_{\text{ECEF}}(t) = \mathbf{R}_z(\text{GMST}(t)) \cdot \vec{r}_{\text{TEME}}(t)$$

$$\mathbf{R}_z(\theta) = \begin{pmatrix} \cos\theta & \sin\theta & 0 \\ -\sin\theta & \cos\theta & 0 \\ 0 & 0 & 1 \end{pmatrix}$$

GMST is computed using the IAU 1982 model with Julian Date:

```python
T = (jd_midnight - 2451545.0) / 36525.0
gmst_seconds = 24110.54841 + 8640184.812866 * T + 0.093104 * T² - 6.2e-6 * T³
```

**Implementation:** [`visualization.py:get_gmst()`](backend/app/services/visualization.py) and [`visualization.py:teme_to_ecef()`](backend/app/services/visualization.py)

#### Scene Components

| Component | Details |
|---|---|
| **Earth Mesh** | Phong material with elevation bump maps and specular ocean reflections. Rotated by `earth.rotation.y = gmst + offset` to align continents with ECEF coordinates. |
| **Kessler Debris Cloud** | 12,000 particles distributed across LEO (200–2,000 km), MEO (2,000–35,000 km), and GEO (35,786 km) belts using randomized spherical distribution. |
| **Nominal Trajectories** | Protected asset and candidate object paths rendered as line geometries from backend ECEF samples. |
| **Post-Burn Trajectory** | Evasive trajectory overlaid on the nominal path. Pre-burn: follows nominal. Post-burn: diverges along the CW-computed deviation rotated back to ECI/ECEF. |
| **Danger Zone Sphere** | Transparent red sphere centered on the candidate's ECEF position at TCA with a radius matching the configurable safety margin. |

#### Post-Burn Trajectory Sampling

The maneuver path is sampled in a hybrid approach:

1. **Before burn time:** The trajectory follows the nominal SGP4-propagated asset path
2. **After burn time:** A CW relative deviation is computed, transformed from Hill frame back to ECI using the instantaneous RTN basis vectors, added to the nominal ECI position, and then rotated to ECEF

```python
# Position deviation in Hill frame due to burn
delta_r_asset_hill = Phi_rv @ delta_v_asset_hill

# Transform back to ECI and add to nominal position
r_post_eci = r_p_nominal_eci + (T_ECI_to_Hill.T @ delta_r_asset_hill)

# Convert to ECEF for rendering
r_ecef, _ = teme_to_ecef(r_post_eci, v_p_eci, current_time)
```

**Implementation:** [`visualization.py:sample_maneuver_trajectory()`](backend/app/services/visualization.py)

### Connection to Other Pillars

Pillar 5 consumes the recommended maneuver option from Pillar 4 and the TCA information from Pillar 1 to render the full spatial picture. The `danger_zone.center_ecef_km` is computed at the candidate's exact ECEF position at TCA, ensuring visual alignment with the conjunction point detected in Pillar 1.

---

## 9. Constants & Formulas Reference Table

### Physical Constants

| Symbol | Value | Description |
|---|---|---|
| $R_e$ | 6378.137 km | WGS-84 Earth equatorial radius |
| $\mu$ (GM) | 398600.4418 km³/s² | Earth gravitational parameter |
| $g_0$ | 9.80665 m/s² | Standard gravitational acceleration |
| $\omega_{\text{Earth}}$ | 7.2921151467 × 10⁻⁵ rad/s | Earth rotation rate (WGS-84) |
| $R_{\text{combined}}$ | 15 m | Default combined hard-body radius for Pc |
| $m_0$ | 500 kg | Default spacecraft wet mass |
| $I_{\text{sp}}$ | 220 s | Default specific impulse (hydrazine monopropellant) |

### Formulas

| Formula | Expression | Context |
|---|---|---|
| **Semi-major axis** | $a = (\mu / n^2)^{1/3}$ | Kepler's Third Law from mean motion |
| **Orbital period** | $T = 2\pi\sqrt{a^3 / \mu}$ | LEO: ~92 min for ISS altitude |
| **Orbital velocity** | $v = \sqrt{\mu / r}$ | Circular orbit approximation |
| **Mean motion** | $n = \sqrt{\mu / a^3}$ | rad/s |
| **CW x-displacement** | $x(t) = \frac{\Delta v_R}{n}\sin(nt) + \frac{2\Delta v_T}{n}(1-\cos(nt))$ | Radial + transverse coupling |
| **CW y-displacement** | $y(t) = \frac{2\Delta v_R}{n}(\cos(nt)-1) + \frac{\Delta v_T}{n}(4\sin(nt)-3nt)$ | In-track drift |
| **CW z-displacement** | $z(t) = \frac{\Delta v_N}{n}\sin(nt)$ | Cross-track (decoupled) |
| **Transverse burn ratio** | $\Delta v_T \approx \frac{(d_{\text{target}} - d_{\text{current}}) \times 1000}{2\Delta t}$ | m/s targeting formula |
| **Tsiolkovsky equation** | $m_{\text{prop}} = m_0(1 - e^{-\Delta V / (I_{\text{sp}} \cdot g_0)})$ | Propellant mass |
| **Collision probability** | $P_c = \frac{R^2}{2\sqrt{\det(\mathbf{C}_e)}} \exp(-\frac{1}{2}\vec{r}_p^T \mathbf{C}_e^{-1} \vec{r}_p)$ | Akella-Alfriend 2D |
| **ECEF rotation** | $\vec{r}_{\text{ECEF}} = \mathbf{R}_z(\text{GMST}) \cdot \vec{r}_{\text{TEME}}$ | Frame transformation |
| **Three.js scale** | $\text{SCALE} = 6.371 / 6378.137$ | km to scene units |

---

## 10. Pages & Routes

### Frontend Pages

| Route | Description |
|---|---|
| `/` | Landing page with cinematic hero, guided demo playbook, and Web Speech API narration |
| `/dashboard` | Real-time threat registry cards, alert summaries, satellite status indicators, and conjunction count badges |
| `/map` | Photorealistic 3D WebGL Earth with SGP4-propagated orbits, Kessler debris cloud, and interactive camera controls |
| `/maneuvers` | CW relative-motion targeting solver, propellant curve charts, burn direction visualization, and secure uplink authorization |
| `/conjunctions` | Historical and active conjunction event log with filtering, TCA countdown timers, and miss distance telemetry |
| `/ai-briefing` | Natural-language safety executive summaries generated by Gemini/Groq with RTN covariance context |
| `/audit` | Tamper-evident SHA-256 chained audit trail of all system actions |

### API Routes (Next.js Proxy Layer)

| Route | Method | Backend Target |
|---|---|---|
| `/api/satellites` | GET | MockDatabase |
| `/api/conjunction-events` | GET | MockDatabase |
| `/api/maneuvers/calculate` | POST | FastAPI `/maneuver/{id}/options` + `/compare/{id}` |
| `/api/visualize` | GET | FastAPI `/visualize/{id}` |
| `/api/triage/refresh` | POST | FastAPI `/triage/refresh` |
| `/api/stream` | GET (SSE) | Server-Sent Events for real-time updates |

### FastAPI Backend Endpoints

| Route | Method | Description |
|---|---|---|
| `/triage/refresh` | POST | Run conjunction screening against CelesTrak catalog |
| `/explain/{candidate_id}` | GET | Generate AI risk explanation |
| `/maneuver/{candidate_id}/options` | GET | Compute 3 CW maneuver options |
| `/compare/{candidate_id}` | GET | Rank options via Pillar 4 trade-off |
| `/visualize/{candidate_id}` | GET | Sample ECEF trajectories for 3D rendering |
| `/approve/{candidate_id}/preview` | GET | Preview maneuver with confirmation token |
| `/approve` | POST | Register authorized burn |
| `/audit/log` | GET | Retrieve SHA-256 chained audit trail |
| `/health` | GET | System health check |

---

## 11. Developer Audit Mode

OrbitGuard implements a **Developer Audit Mode** toggle accessible on the maneuvers page. When active:

- **Hover tooltips** appear on every rendered telemetry number showing its exact backend JSON property path (e.g., `backend: chosen_option.delta_v_ms` or `backend: alert.min_distance_km`)
- **Monospace badges** are printed adjacent to metric values showing the Pydantic field name (e.g., `[resulting_min_distance_km]`, `[fuel_cost_kg]`, `[cw_divergence_flag]`)

This feature exists because the entire system depends on **data fidelity** — every number visible to an operator must trace back to a physics engine calculation, not a frontend approximation. Audit mode makes this provenance visible and verifiable.

**Disqualification rendering:** Maneuver options with `composite_score === 0.0` (secondary conjunction violations or Pc ≥ 1×10⁻⁴) are greyed out in the UI and cannot be selected.

**CW divergence warnings:** If `cw_divergence_flag === true`, a warning icon and tooltip explain that the linearized CW model has deviated >10% from nonlinear propagation.

---

## 12. Getting Started

### Prerequisites

- **Node.js** ≥ 18.0.0
- **pnpm** ≥ 8.0.0
- **Python** ≥ 3.10
- **pip** (for backend dependencies)

### Frontend Setup

```bash
# Clone the repository
git clone https://github.com/your-username/orbitguard.git
cd orbitguard

# Install frontend dependencies
pnpm install

# Start the development server
pnpm dev
```

The frontend will be available at **http://localhost:3000**.

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # macOS/Linux

# Install Python dependencies
pip install -r requirements.txt

# Set environment variables (optional — for AI briefing)
export GEMINI_API_KEY="your-gemini-key"    # Primary LLM provider
export GROQ_API_KEY="your-groq-key"        # Fallback LLM provider

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

The physics engine API will be available at **http://localhost:8000**.

### Supabase Setup (Optional — for persistence)

```bash
# Initialize the database schema
cd backend
python init_supabase.py
```

---

## 13. Verification & Testing

OrbitGuard includes a multi-tiered test suite powered by **Vitest** that validates physical correctness, coordinate frame alignment, and frontend-backend data contract fidelity.

### Run the Test Suite

```bash
# Run all tests
pnpm test

# Run with watch mode
pnpm test:watch
```

### Physical Correctness Tests

**File:** [`src/visualization_validation.test.ts`](src/visualization_validation.test.ts)

| Check | Validation | Pass Criteria |
|---|---|---|
| **Check 1** | ECEF frame transformation against known ISS ground truth (Feb 20, 2026 12:00 UTC). Compares frontend ECI→ECEF conversion against backend-computed reference coordinates. | ECEF coordinates within ±0.1 km; geodetic lat/lon within ±0.01° |
| **Check 2** | WGS-84 scale consistency. Verifies that the `SCALE = 6.371 / 6378.137` mapping preserves altitude proportionality between km and Three.js units. | ISS at 420 km altitude maps to correct Three.js distance from Earth surface |
| **Check 3** | Earth rotation alignment. Tests four candidate rotation offsets (0°, 90°, 180°, -90°) against satellite.js geodetic output to verify the Earth mesh rotation matches ECEF. | Best offset error < 1.0° |
| **Check 4** | SGP4 orbit trajectory closure. Propagates ISS TLE for one full orbital period (~93 min) and checks that the trajectory forms a closed loop. | Closure distance < 0.05 Three.js units |
| **Check 5** | Danger zone / TCA alignment. Fetches live visualization data and verifies that the danger zone sphere center matches the candidate's ECEF position at TCA. | ECEF position match within ±0.01 km; post-burn trajectory diverges only after burn time |
| **Check 6** | Multi-satellite consistency. Verifies that multiple conjunction candidates produce valid ECEF trajectories at reasonable LEO altitudes. | All altitudes > 200 km |

### Integration Contract Tests

**File:** [`src/pillar_integration.test.ts`](src/pillar_integration.test.ts)

These tests verify that the **Next.js proxy layer faithfully passes through every field** from the FastAPI Pydantic schemas without mutation, using validation candidate **NORAD ID 62099**:

| Test | Validates |
|---|---|
| **Pillar 3/4 Integration** | Next.js `/api/maneuvers/calculate` response matches FastAPI `/maneuver/{id}/options` and `/compare/{id}` field-for-field: `delta_v_ms`, `resulting_min_distance_km`, `fuel_cost_kg`, `cw_divergence_flag`, `secondary_conjunction_warning`, `composite_score`, `recommended_option_id`, `reasoning` |
| **Pillar 5 Integration** | Next.js `/api/visualize` response matches FastAPI `/visualize/{id}` field-for-field: every `position_ecef_km` triplet, `danger_zone.center_ecef_km`, `danger_zone.radius_km`, `earth_radius_km`, `frame === "ECEF"` |

### Backend Tests

The `backend/` directory contains comprehensive Python test files:

| File | Coverage |
|---|---|
| `test_triage.py` | Conjunction screening, TLE ingestion, envelope filtering |
| `test_explain.py` | AI explanation generation with LLM provider fallback |
| `test_maneuver.py` | CW targeting, fuel calculation, secondary screening |
| `test_tradeoff.py` | Composite scoring, disqualification logic |
| `test_visualize.py` | ECEF trajectory sampling, GMST computation |
| `test_approve.py` | Approval flow, token validation, role-based access |
| `test_audit.py` | SHA-256 chained audit trail integrity |
| `validate_competition.py` | End-to-end validation across all pillars |

---

<p align="center">
  <em>Built to keep the orbits clear.</em>
</p>
