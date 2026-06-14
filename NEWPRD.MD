# OrbitGuard
## Satellite Conjunction Analysis & Maneuver Planning Simulator
**Product Requirements Document**
Hackathon Build · Version 2.0 (Revised)
**Status:** Active Draft
**Data Source:** CelesTrak TLE (public, no auth required)
**Stack:** Python + React.js + Three.js
**Audience:** Judges, Developers

> A self-contained, data-realistic simulation of orbital collision avoidance. All physics computed from first principles using publicly available TLE data.

---

## Contents

1. [Overview](#1-overview)
2. [The Problem](#2-the-problem)
   - 2.1 [Low Earth Orbit Is Getting Crowded](#21-low-earth-orbit-is-getting-crowded)
   - 2.2 [The Existing Process Does Not Scale](#22-the-existing-process-does-not-scale)
   - 2.3 [What We Are Actually Building (Realistic Scope)](#23-what-we-are-actually-building-realistic-scope)
3. [Data Source](#3-data-source)
   - 3.1 [CelesTrak TLE Data](#31-celestrak-tle-data)
4. [Core Physics Pipeline](#4-core-physics-pipeline)
   - 4.1 [Step 1: Orbit Propagation via SGP4](#41-step-1-orbit-propagation-via-sgp4)
   - 4.2 [Step 2: Conjunction Screening](#42-step-2-conjunction-screening)
   - 4.3 [Step 3: Probability of Collision (Pc)](#43-step-3-probability-of-collision-pc)
   - 4.4 [Step 4: Risk Classification](#44-step-4-risk-classification)
   - 4.5 [Step 5: Maneuver Planning (Delta-V Calculation)](#45-step-5-maneuver-planning-delta-v-calculation)
5. [Application Features](#5-application-features)
   - 5.1 [Feature 1 — 3D Orbital Visualizer](#51-feature-1--3d-orbital-visualizer)
   - 5.2 [Feature 2 — Conjunction Dashboard](#52-feature-2--conjunction-dashboard)
   - 5.3 [Feature 3 — Maneuver Planner](#53-feature-3--maneuver-planner)
   - 5.4 [Feature 4 — AI Situation Briefing](#54-feature-4--ai-situation-briefing)
6. [Technical Architecture](#6-technical-architecture)
   - 6.1 [Stack](#61-stack)
   - 6.2 [Data Flow](#62-data-flow)
   - 6.3 [Key API Endpoints](#63-key-api-endpoints)
   - 6.4 [Performance Constraints](#64-performance-constraints)
7. [Scope: What Is and Is Not In This Build](#7-scope-what-is-and-is-not-in-this-build)
   - 7.1 [In Scope](#71-in-scope)
   - 7.2 [Out of Scope (Explicitly Excluded)](#72-out-of-scope-explicitly-excluded)
8. [Significance](#8-significance)
9. [Success Criteria](#9-success-criteria)
10. [Conclusion](#10-conclusion)

---

## 1. Overview

OrbitGuard is a web-based orbital conjunction analysis and maneuver planning tool built entirely on public data and open physics. It ingests real Two-Line Element (TLE) sets from CelesTrak, propagates satellite orbits forward using the SGP4 model, detects close-approach events between any pair of tracked objects, computes collision probability using an analytical covariance method, and then solves for the minimum-fuel evasive burn using Hohmann-transfer geometry.

Everything from data ingest to maneuver output runs in a single self-contained pipeline. There is no dependency on space agency APIs, no proprietary data feeds, and no real-time satellite uplink. The goal is to show, in a running system, exactly how the orbital safety problem would be solved — using real math, real data, and a clean interface that makes the results readable to a non-specialist.

> **Design principle:** Every feature in this app feeds the next one. TLE data enables propagation. Propagation enables conjunction detection. Conjunction detection enables risk scoring. Risk scoring enables maneuver planning. Maneuver planning is displayed on the same 3D map that started the whole chain. Nothing is bolted on.

---

## 2. The Problem

### 2.1. Low Earth Orbit Is Getting Crowded

The Low Earth Orbit (LEO) band — roughly 200 to 2,000 km above Earth's surface — is where almost all operational satellites live. It is also where the density of space debris is highest.

As of mid-2024, the US Space Surveillance Network tracks over **27,000 objects** larger than 10 cm. Estimates for objects smaller than 1 cm run into the millions. All of it orbits at average velocities between 7 and 8 km/s. A collision at these speeds is not recoverable — it produces hundreds of new debris fragments, each capable of causing further collisions (the Kessler cascade).

### 2.2. The Existing Process Does Not Scale

Current collision avoidance relies on:

- Radar tracking and TLE updates from US Space Force (public, once or twice per day).
- Automated screening tools (e.g. CARA at NASA) that flag conjunction events and issue Conjunction Data Messages (CDMs) to registered operators.
- Human engineers at each operator who read the CDM, run their own analysis, decide whether to maneuver, and manually compute and uplink the burn.

The bottleneck is the **human-in-the-middle step**. Decision cycles take hours. As constellation sizes grow from hundreds to tens of thousands of satellites, the number of conjunction events grows roughly as **O(N²)** with the number of objects — the current manual workflow cannot keep pace.

### 2.3. What We Are Actually Building (Realistic Scope)

We are not building a live command-and-control system. We are building a working simulation of the decision-making pipeline that such a system would use, fed by real public data. The output is a visual, interactive demonstration of:

1. How satellites actually move (SGP4 orbit propagation from real TLEs).
2. How close-approach events are detected and ranked by danger (conjunction screening + Pc computation).
3. How an evasive maneuver is calculated and what it looks like in 3D (delta-v optimization).
4. How a simple AI assistant helps interpret the numbers for a non-specialist (LLM integration).

---

## 3. Data Source

### 3.1. CelesTrak TLE Data

All orbital data comes from **CelesTrak** (celestrak.org), maintained by Dr. T.S. Kelso. CelesTrak provides freely downloadable TLE files — no API key, no registration, no rate limit beyond normal HTTP etiquette.

A TLE (Two-Line Element set) is a standardized format for encoding an object's orbital state at a given epoch. It encodes six Keplerian orbital elements plus drag and correction terms.

**TLE Structure**

- **Line 1:** Satellite number, classification, launch designator, epoch (YYDDD.DDDDDDDD), first derivative of mean motion (ṅ), second derivative (n̈), B* drag term, element set number.
- **Line 2:** Inclination *i* (deg), RAAN Ω (deg), eccentricity *e* (dimensionless ×10⁷), argument of perigee ω (deg), mean anomaly *M* (deg), mean motion *n* (rev/day), revolution number.

**Example (ISS):**
```
1 25544U 98067A   24001.50000000  .00006418  00000-0  12345-3 0  9993
2 25544  51.6401 324.4219 0001234  85.4321 274.7321 15.50000000123456
```

**Useful CelesTrak feeds for the hackathon:**

- `/SOCRATES/query.php` — pre-computed top 20 conjunction events (updates daily).
- `/pub/TLE/catalog/active.txt` — all ~9,000 active satellites.
- `/pub/TLE/catalog/debris.txt` — tracked debris objects.
- `/pub/TLE/catalog/stations.txt` — crewed spacecraft (ISS, Tiangong).

We fetch these on app startup and cache them locally. No live stream is needed; the SGP4 propagator handles time-forward prediction from the stored epoch.

---

## 4. Core Physics Pipeline

This section describes every mathematical step in OrbitGuard's backend, in the exact order the system executes them.

### 4.1. Step 1: Orbit Propagation via SGP4

SGP4 (Simplified General Perturbations 4) is the standard analytical propagator for near-Earth objects. Given a TLE at epoch *t₀*, it computes the Earth-Centered Inertial (ECI) position vector **r**(t) and velocity vector **v**(t) at any future time *t*.

SGP4 accounts for:
- J2, J3, J4 geopotential harmonics (Earth's oblateness).
- Atmospheric drag (via the B* term).
- Solar and lunar gravitational perturbations (long-period terms).

**Mean Motion with SGP4 Secular Terms**

$$n(t) = n_0 + \dot{n}_0 \Delta t + \frac{1}{2} \ddot{n}_0 \Delta t^2$$

where *n₀* is the TLE mean motion (rad/s), Δt = t − t₀, and ṅ₀, n̈₀ are the first and second time derivatives of mean motion from Line 1 of the TLE.

The mean anomaly at time *t*:

$$M(t) = M_0 + n(t) \cdot \Delta t$$

Eccentric anomaly *E* is solved iteratively from Kepler's equation:

$$M = E - e \sin E \implies E_{k+1} = E_k + \frac{M - E_k + e \sin E_k}{1 - e \cos E_k}$$

True anomaly ν from eccentric anomaly:

$$\tan\frac{\nu}{2} = \sqrt{\frac{1+e}{1-e}} \tan\frac{E}{2}$$

**ECI Position Vector**

$$\mathbf{r} = R_z(-\Omega)\, R_x(-i)\, R_z(-\omega) \begin{pmatrix} r\cos\nu \\ r\sin\nu \\ 0 \end{pmatrix}, \quad r = \frac{a(1-e^2)}{1 + e\cos\nu}$$

where *a* is the semi-major axis derived from mean motion: $a = (\mu / n_0^2)^{1/3}$, with μ = 398,600.4418 km³/s² (Earth's gravitational parameter).

We use the `sgp4` Python library (Brandon Rhodes, PyPI) which implements the full Vallado SGP4 formulation. We propagate every tracked object at **60-second intervals over a 72-hour window**, storing (**r**, **v**) tuples in a NumPy array.

### 4.2. Step 2: Conjunction Screening

Checking every pair of *N* objects at every time step is O(N²T), which is feasible for N = 500 objects but becomes expensive for the full catalog. We implement a **two-filter screening approach**:

#### 4.2.1. Filter A: Orbital Regime Filter

Before any propagation, discard object pairs that cannot possibly come close based on their semi-major axis *a* and eccentricity *e*:

**Apogee / Perigee Filter**

Object *i* with elements (*aᵢ*, *eᵢ*) has:

$$r_{\text{apo},i} = a_i(1 + e_i)$$
$$r_{\text{peri},i} = a_i(1 - e_i)$$

Two objects can only come within distance *d*_max of each other if their orbital shells overlap:

$$r_{\text{peri},j} - d_{\max} < r_{\text{apo},i} \quad \text{AND} \quad r_{\text{peri},i} - d_{\max} < r_{\text{apo},j}$$

We use **d_max = 50 km** as the coarse screening threshold. This typically eliminates >95% of pairs.

#### 4.2.2. Filter B: Time-of-Closest-Approach (TCA) Search

For pairs that survive Filter A, we compute the relative distance at each propagation time step and find the minimum:

**Relative Distance and TCA**

$$d(t_k) = \| \mathbf{r}_i(t_k) - \mathbf{r}_j(t_k) \|_2$$

A local minimum of *d(tₖ)* is identified when *d(tₖ₋₁) > d(tₖ) < d(tₖ₊₁)*. Once a candidate TCA window [tₖ₋₁, tₖ₊₁] is found, we refine it using golden-section search on the continuous SGP4 propagator to find *t** such that:

$$\frac{d}{dt}\|\mathbf{r}_i(t) - \mathbf{r}_j(t)\|_2 = 0 \implies (\mathbf{r}_i - \mathbf{r}_j) \cdot (\mathbf{v}_i - \mathbf{v}_j) = 0$$

The miss distance is then *d*_min = *d(t*)*.

Pairs with **d_min < 5 km** are flagged as conjunction events and passed to Step 3.

### 4.3. Step 3: Probability of Collision (Pc)

The miss distance alone does not tell the full story — positional uncertainty matters. A 500 m miss with ±1 km uncertainty is far more dangerous than a 500 m miss with ±10 m uncertainty.

We implement the **Akella–Alfriend (2000) 2D analytical method**, which is the standard used by NASA's CARA office:

**Collision Probability — 2D Analytical Method**

At the TCA, the relative motion is decomposed into a plane perpendicular to the relative velocity vector **v**_rel. In this conjunction plane, the combined position uncertainty is represented by a 2D Gaussian with covariance:

$$C_{2D} = \Pi (C_i + C_j) \Pi^T$$

where Π is the projection matrix onto the conjunction plane and *C*ᵢ, *C*ⱼ are the 3×3 ECI position covariance matrices of each object.

The collision probability is:

$$P_c = \frac{1}{2\pi \sigma_x \sigma_y} \iint_D \exp\!\left(-\frac{x^2}{2\sigma_x^2} - \frac{y^2}{2\sigma_y^2}\right) dx\, dy$$

where *D* is the circular hard-body disk of radius *r*_HBR = *rᵢ* + *rⱼ* (sum of the two object radii), and σ²_x, σ²_y are the eigenvalues of *C*_2D.

This integral is evaluated numerically using Foster's expansion:

$$P_c \approx \frac{r_{\text{HBR}}^2}{2\sigma_x\sigma_y} \exp\!\left(-\frac{1}{2}\left[\frac{x_m^2}{\sigma_x^2} + \frac{y_m^2}{\sigma_y^2}\right]\right) \cdot I_0\!\left(\frac{r_{\text{HBR}}^2}{4\sigma_x\sigma_y}\right)$$

where (*x*_m, *y*_m) is the nominal miss vector projected onto the conjunction plane and *I*₀ is the modified Bessel function of the first kind.

**Covariance source for the hackathon:** Since operator-provided covariance matrices are unavailable, we use CelesTrak's SOCRATES output (which includes pre-computed Pc values), or assign a default diagonal covariance representative of TLE tracking accuracy: σᵣ ≈ 300 m radial, σₜ ≈ 1,500 m in-track, σₙ ≈ 300 m cross-track. These values are consistent with published TLE uncertainty literature (Flohrer et al., 2008).

### 4.4. Step 4: Risk Classification

Conjunction events are classified into three tiers using thresholds consistent with industry practice:

| Level  | Pc Threshold             | Miss Distance | Action                  |
|--------|--------------------------|---------------|-------------------------|
| 🟢 GREEN  | Pc < 10⁻⁵               | > 5 km        | No action required      |
| 🟡 YELLOW | 10⁻⁵ ≤ Pc < 10⁻⁴       | < 5 km        | Monitor closely         |
| 🔴 RED    | Pc ≥ 10⁻⁴               | < 1 km        | Maneuver recommended    |

The 10⁻⁴ threshold for action is the standard used by most commercial satellite operators (e.g. Starlink, OneWeb) and recommended by the Inter-Agency Space Debris Coordination Committee (IADC).

### 4.5. Step 5: Maneuver Planning (Delta-V Calculation)

When a RED event is detected, the system computes the minimum-fuel evasive maneuver for the primary satellite. We implement a **single-impulse in-track burn** as the default maneuver type, since in-track burns are the most fuel-efficient way to change miss distance at a future TCA.

#### 4.5.1. Hohmann-Inspired In-Track Delta-V

From linearized orbital mechanics (Clohessy–Wiltshire equations), a tangential burn ΔvT applied at time *t*_b produces a change in along-track position at time *t** = *t*_b + Δt:

$$\Delta x(t^*) \approx 2 \,\Delta v_T \cdot \Delta t$$

and a change in radial position:

$$\Delta y(t^*) \approx -\frac{3}{2} n \cdot \Delta v_T \cdot \Delta t^2 + \frac{\Delta v_R}{n}(1 - \cos(n\,\Delta t)) \cdot 2$$

where $n = \sqrt{\mu/a^3}$ is the mean motion and ΔvR is any simultaneous radial burn component.

For a purely in-track burn, the required ΔvT to achieve a desired miss distance change Δd is:

$$\Delta v_T = \frac{\Delta d}{2\,\Delta t}$$

where Δd = *d*_target − *d*_min is the required increase in miss distance and Δt = *t** − *t*_b is the time from burn to TCA. We target **d_target = 5 km**.

#### 4.5.2. Fuel Mass Estimation via Tsiolkovsky

Once Δv is known, the propellant mass required is:

**Tsiolkovsky Rocket Equation**

$$\Delta v = I_{sp} \cdot g_0 \cdot \ln\frac{m_0}{m_f} \implies m_{\text{prop}} = m_0\!\left(1 - e^{-\Delta v / (I_{sp}\, g_0)}\right)$$

where *I*_sp is the specific impulse of the thruster (we use **I_sp = 220 s** for a typical hydrazine thruster), *g*₀ = 9.80665 m/s², and *m*₀ is the satellite's current wet mass (user-configurable, default **500 kg**).

**Example:** For a Δv = 0.3 m/s burn on a 500 kg satellite with I_sp = 220 s:

$$m_{\text{prop}} = 500 \times \left(1 - e^{-0.3 / (220 \times 9.80665)}\right) \approx 0.069 \text{ kg}$$

#### 4.5.3. Burn Timing Optimization

The system searches over candidate burn times $t_b \in [t_{\text{now}} + 1\text{h},\ t^* - 2\text{h}]$ to find the one that minimizes |Δv|:

**Optimal Burn Time**

$$t_b^* = \arg\min_{t_b} |\Delta v(t_b)| = \arg\min_{t_b} \frac{d_{\text{target}} - d_{\min}(t_b)}{2(t^* - t_b)}$$

Since *d*_min(*t*_b) is approximately constant for early burns (far from TCA), |Δv| decreases monotonically as Δt increases. Therefore the **optimal burn is as early as possible**, subject to the constraint that the maneuver does not create a new conjunction with a third object. We check for new conjunctions after each candidate burn using the same screening pipeline.

---

## 5. Application Features

The four features below are tightly coupled: each one is a UI layer on top of the same backend computation pipeline described in Section 4.

### 5.1. Feature 1 — 3D Orbital Visualizer

**What it is:** An interactive 3D globe showing real satellite orbits, built with Three.js and satellite.js (client-side SGP4 in JavaScript).

**What the user sees and can do:**

- A dark-themed Earth with real-time orbital tracks for each loaded satellite. Tracks are rendered as `THREE.Line` objects following the propagated **r**(t) array.
- Color coding directly tied to the risk classification from Step 4: green, yellow, or red glowing dot at each satellite's current position.
- Clicking any satellite opens a side panel showing: object name, NORAD ID, current altitude *h* = |**r**| − R⊕, velocity |**v**|, orbital period *T* = 2π/n, inclination, and current risk status.
- If a RED or YELLOW event exists for a selected satellite, a conjunction line is drawn between the two objects at their predicted TCA positions, with a small sphere marking the closest-approach point.
- A **time-scrub slider** lets the user animate the propagation forward up to 72 hours, watching satellites move and conjunction geometries evolve.

**How it connects to the pipeline:** The visualizer consumes the same (**r**(tₖ), risk_level) arrays produced by Steps 1 and 4. No separate data source or extra computation.

### 5.2. Feature 2 — Conjunction Dashboard

**What it is:** A sortable, filterable table of all active conjunction events, ranked by Pc.

**What the user sees:**

- Each row: Object A name, Object B name, TCA (UTC), miss distance *d*_min (km), Pc (scientific notation), risk level badge (green/yellow/red).
- Sorting by any column. Filtering by risk level.
- Clicking a row: zooms the 3D globe to that conjunction, highlights both objects, and pre-selects the event for maneuver planning.
- A summary header: *X events in next 72 hours. Y require attention.*

**How it connects:** This is a direct rendering of the output of Steps 2, 3, and 4. Every number in the table is computed by the backend pipeline. The "click to view on globe" action links Feature 2 to Feature 1.

### 5.3. Feature 3 — Maneuver Planner

**What it is:** For any RED-level conjunction event, the system computes and displays a recommended evasive burn.

**What the user sees:**

- A card showing: recommended burn time *t*_b*, burn direction (prograde/retrograde/radial), magnitude |Δv| in m/s, estimated propellant mass consumed, and resulting new miss distance after the maneuver.
- Two orbital track overlays on the 3D globe: the **original trajectory** (dashed) and the **post-maneuver trajectory** (solid, different color), so the user can see how the burn changes the orbit.
- A **"What if?" slider** for Δv magnitude: drag it up or down to see how the post-burn miss distance and fuel cost change in real time. This is computed using the linear approximation Δd ≈ 2 · ΔvT · Δt for instant feedback, with a full SGP4 re-propagation triggered on release.
- A plain-English summary generated by the AI assistant (Feature 4).

**How it connects:** The Maneuver Planner reads the conjunction data from Feature 2, runs Step 5 on demand, and writes the post-maneuver trajectory back to the 3D globe in Feature 1.

### 5.4. Feature 4 — AI Situation Briefing

**What it is:** A Claude-powered assistant that takes the structured output of Features 2 and 3 and produces a plain-language situation briefing for the selected conjunction event.

**What it does (and does not do):**

- **Does:** Receives a structured JSON blob containing *d*_min, Pc, risk level, recommended Δv, burn time, and fuel cost. Writes a 3–5 sentence human-readable summary: what is happening, how dangerous it is, what the system recommends, and what trade-off the operator faces (fuel vs. safety margin).
- **Does not:** Invent numbers, contact external systems, or make autonomous decisions. It is purely an interpreter of data already computed by the physics pipeline.

**Example output:**

> At 14:32 UTC tomorrow, COSMOS 2251 DEB (debris fragment) will pass within 340 metres of your satellite DEMOSAT-1, with an estimated collision probability of 1.7 × 10⁻³. This is well above the 10⁻⁴ action threshold. The system recommends a 0.28 m/s prograde burn at 06:15 UTC today, which increases the miss distance to 5.4 km and consumes approximately 65 grams of propellant. If you delay the burn by 6 hours, the required delta-v doubles and fuel consumption quadruples.

**How it connects:** The AI reads the output of all three previous features and translates it into language. It is the final layer of a coherent pipeline, not a standalone chatbot.

---

## 6. Technical Architecture

### 6.1. Stack

| Component | Technology & Rationale |
|---|---|
| TLE Fetch | HTTP GET to CelesTrak; parsed with Python `sgp4` library. No auth. |
| Orbit Propagation | `sgp4` (PyPI) — Vallado formulation, battle-tested, returns ECI (**r**, **v**). |
| Conjunction Screening | NumPy vectorized distance computation over propagated position arrays. |
| Pc Calculation | Custom Python implementation of Akella-Alfriend 2D method. |
| Maneuver Solver | Closed-form CW equations + `scipy.optimize.minimize_scalar` for timing search. |
| Backend API | FastAPI (Python); returns JSON to frontend. |
| Frontend Framework | React.js + TypeScript. |
| 3D Globe | Three.js + satellite.js (client-side propagation for smooth animation). |
| AI Integration | Anthropic Claude API (`claude-sonnet-4-6`); called with structured JSON context. |
| Data Storage | In-memory (NumPy arrays + Python dicts) during session; no database needed. |

### 6.2. Data Flow

The entire system follows a single linear pipeline:

```
CelesTrak TLE
    → SGP4 Propagation
    → Conjunction Screening
    → Pc Computation
    → Risk Classification
    → Maneuver Solve
    → 3D Visualizer + Dashboard + AI Brief
```

Every API endpoint on the backend returns data from one or more stages of this pipeline. The frontend never computes physics independently (except for smooth animation, which uses satellite.js client-side for frame-rate reasons).

### 6.3. Key API Endpoints

| Endpoint | Returns |
|---|---|
| `GET /satellites` | All loaded satellites with current ECI position, velocity, risk level. |
| `GET /satellites/{id}/track` | 72-hour propagated track as array of (**r**, t) tuples. |
| `GET /conjunctions` | All active conjunction events, sorted by Pc. |
| `GET /conjunctions/{id}/maneuver` | Recommended maneuver for a given conjunction event. |
| `POST /ai/briefing` | Takes conjunction + maneuver JSON, returns AI plain-text summary. |

### 6.4. Performance Constraints

For the hackathon demo, we use a curated subset of **N = 200–500 objects** (all active LEO satellites + top debris fragments from SOCRATES). This keeps the backend feasible:

- Propagating 500 objects over 72 hours at 60 s steps = 500 × 4,320 = **2.16 × 10⁶ SGP4 evaluations**. At ~20 µs per evaluation: ≈ 43 seconds. Acceptable as a one-time startup computation; cached afterward.
- Pair screening after orbital filter: ~500 pairs survive (from C(500,2) = 124,750 total). TCA search on 500 pairs ≈ 2 seconds.
- Pc computation: trivial, < 0.1 s for 500 events.
- **Total pipeline latency on startup: ≈ 45–60 seconds.** Subsequent updates (triggered by new TLE fetch) are incremental.

---

## 7. Scope: What Is and Is Not In This Build

### 7.1. In Scope

- ✅ Real TLE ingestion from CelesTrak (no mock data for orbits).
- ✅ Full SGP4 propagation implemented via `sgp4` library.
- ✅ Conjunction detection with TCA refinement.
- ✅ Analytical Pc calculation with configurable covariance.
- ✅ In-track maneuver planning with CW linear approximation + SGP4 verification.
- ✅ Fuel cost estimation via Tsiolkovsky equation.
- ✅ 3D interactive globe with live orbit tracks and conjunction visualization.
- ✅ Risk dashboard table, sortable by Pc.
- ✅ AI plain-language briefing via Claude API.

### 7.2. Out of Scope (Explicitly Excluded)

- ❌ Real-time radar tracking or live telemetry (we use TLE epochs, updated once daily).
- ❌ Actual satellite command uplink or maneuver execution.
- ❌ Integration with any space agency API requiring credentials or approval.
- ❌ Multi-satellite coordinated maneuvers (two-operator negotiation — removed as unrealistic).
- ❌ Mission scheduling constraints (ground contact windows, payload observations).
- ❌ Objects below 10 cm (not tracked in public catalogs).
- ❌ GEO / MEO regimes (demo focused on LEO only).

---

## 8. Significance

This project is significant not because it invents a new algorithm, but because it **assembles a complete, working version of a pipeline that does not currently exist in an accessible, open form**.

The mathematics we use (SGP4, Akella–Alfriend Pc, CW maneuver planning) are all published and understood. The data (CelesTrak TLEs) is public. Yet there is no open, interactive, end-to-end tool that takes raw TLE data and walks you all the way through to a maneuver recommendation with a visual explanation. That is what OrbitGuard builds.

For a judge or decision-maker, OrbitGuard demonstrates something concrete: given real orbital data, here is exactly how you would detect a potential collision, here is the math that tells you how dangerous it is, here is the computed burn that fixes it, and here is a human-readable explanation of all of it. Every number on screen is traceable to a specific formula in this document.

The problem it addresses — the looming scalability crisis in orbital collision avoidance — is real, well-documented, and growing. OrbitGuard is a proof-of-concept that the core decision-making pipeline can be automated, made transparent, and made accessible to anyone with a browser.

---

## 9. Success Criteria

| Criterion | Target |
|---|---|
| Pipeline runs end-to-end | App loads, fetches TLEs, propagates orbits, shows globe with at least one conjunction event detected. |
| Pc values plausible | At least one conjunction from SOCRATES top-20 reproduced within an order of magnitude. |
| Maneuver Δv correct | Hand-verified against CW approximation for a test case. |
| 3D globe interactive | Satellites move in real time; click to inspect; conjunction geometry visible. |
| AI briefing coherent | Output reads like a plausible operations summary, not a hallucination. |
| Latency acceptable | Full pipeline startup under 90 seconds; UI interactions under 2 seconds. |

---

## 10. Conclusion

OrbitGuard started with a big vision: automate space traffic management. After a realistic assessment of what is actually buildable in a hackathon — using only public data and open tools — we stripped it down to its essential core: a physics-honest, end-to-end simulation of the collision avoidance decision pipeline.

What remains is lean, coherent, and technically rigorous. Every feature exists because the one before it requires it. The 3D map needs propagated orbits. The dashboard needs conjunction events. The maneuver planner needs a risk event to plan for. The AI briefing needs a maneuver to explain. Pull any one piece out and the others lose their meaning.

That is the design. And that is what we built.

---

*OrbitGuard — PRD v2.0 (Revised)*
*All formulas verifiable. All data sources public. All claims conservative.*