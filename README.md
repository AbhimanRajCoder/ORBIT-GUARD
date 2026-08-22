# OrbitGuard: Real-Time Spacecraft Collision Avoidance System

A full-stack, mission-control-grade space situational awareness platform that detects orbital conjunction threats, computes physics-based evasive maneuvers, and visualizes live satellite trajectories in 3D. All calculations in this system are backed by peer-reviewed astrodynamics formulas utilized by NASA's Conjunction Data Messages (CDM) and the 18th Space Control Squadron.

---

## Table of Contents

1. [Project Overview](#1-project-overview)  
2. [The Five System Pillars](#2-the-five-system-pillars)  
3. [Key Features](#3-key-features)  
4. [Tech Stack](#4-tech-stack)  
5. [System Architecture](#5-system-architecture)  
6. [Physics Engine and Mathematical Formulations](#6-physics-engine-and-mathematical-formulations)  
   - 6.1 [SGP4 Orbital Propagation and ECEF Rotation](#61-sgp4-orbital-propagation-and-ecef-rotation)  
   - 6.2 [Akella-Alfriend 2D Collision Probability (Pillar 2)](#62-akella-alfriend-2d-collision-probability-pillar-2)  
   - 6.3 [Clohessy-Wiltshire relative-motion Maneuver Solver (Pillar 3)](#63-clohessy-wiltshire-relative-motion-maneuver-solver-pillar-3)  
   - 6.4 [Tsiolkovsky Propellant Mass Calculation](#64-tsiolkovsky-propellant-mass-calculation)  
   - 6.5 [Multi-Objective Trade-Off and Optimization (Pillar 4)](#65-multi-objective-trade-off-and-optimization-pillar-4)  
7. [3D Orbit Visualizer (Pillar 5)](#7-3d-orbit-visualizer-pillar-5)  
8. [Developer Audit Mode (Pillar Verification)](#8-developer-audit-mode-pillar-verification)  
9. [Pages & Routes](#9-pages--routes)  
10. [Data Model](#10-data-model)  
11. [Getting Started](#11-getting-started)  
12. [Verification and Integration Test Suite](#12-verification-and-integration-test-suite)  

---

## 1. Project Overview

OrbitGuard is a spacecraft collision avoidance web application designed to combat Kessler Syndrome—the cascading chain reaction of orbital collisions that threatens to render Low Earth Orbit (LEO) permanently unusable. 

The application implements a closed-loop workflow:
1. Ingests live Two-Line Element (TLE) datasets from CelesTrak.
2. Runs Simplified General Perturbations 4 (SGP4) propagation.
3. Detects conjunction threats within a defined safety volume.
4. Computes 2D analytical Collision Probability ($P_c$).
5. Solves relative-motion target maneuvers via Clohessy-Wiltshire (CW) equations.
6. Authorizes burns using cryptographic operator verification.
7. Renders the resulting trajectories in a photorealistic 3D WebGL globe.

---

## 2. The Five System Pillars

The platform is engineered around five fundamental modules:

### Pillar 1: Conjunction Detection and Fine Screening
Evaluates active satellite trajectories against cataloged space objects. Initial screening filters out orbits with non-intersecting apogee/perigee envelopes. Fine screening propagates remaining candidates using SGP4 in 1-second intervals over a 24-hour look-ahead window to locate the exact Time of Closest Approach (TCA) and minimum nominal miss distance.

### Pillar 2: AI Risk Triage and Explanation
Quantifies the danger of detected conjunction events. Computes collision probability ($P_c$) using the Akella-Alfriend 2D analytical model on the encounter plane. An integrated AI briefing engine translates raw orbital parameters (RTN covariances, relative velocities, and risk levels) into plain-language summaries for mission operators.

### Pillar 3: Evasive Maneuver Simulator
Allows operators to simulate impulsive velocity changes ($\Delta V$) in the Hill (RTN) frame to deflect a satellite's path. Calculates three pre-calibrated options representing distinct operational intents: Minimum Fuel (2 km target), Balanced (5 km target), and Maximum Safety (12 km target). Calculates fuel costs using the Tsiolkovsky Rocket Equation.

### Pillar 4: Multi-Objective Trade-Off and Optimization
Ranks maneuver options using a weighted composite score (40% Safety, 30% Fuel Efficiency, 30% Secondary Conjunction Avoidance). Automatically disqualifies and greys out any option that creates a secondary conjunction closer than the original hazard distance.

### Pillar 5: 3D Trajectory and Conjunction Visualization
Provides interactive spatial context using a Three.js WebGL rendering of Earth, the Kessler debris cloud, primary/secondary orbits, and the post-burn evasive trajectory. Projects the closest-approach point as a spherical "danger zone" based on the combined hard-body covariance.

---

## 3. Key Features

*   **Photorealistic 3D Globe**: WebGL Earth with SGP4-propagated orbits, animated hazard lines, and a simulated Kessler debris cloud.
*   **Conjunction Detection**: Real-time threat registry with time-to-closest-approach (TCA) and miss distance telemetry.
*   **Collision Probability**: Akella-Alfriend 2D analytical $P_c$ calculation with RTN-to-ECI covariance rotation.
*   **Maneuver Simulator**: CW-equations-based $\Delta V$ solver with Tsiolkovsky propellant mass curves and an interactive sandbox.
*   **AI Situation Briefing**: Natural-language orbital safety audit summarizing all telemetry.
*   **Guided Demo Playbook**: Cinematic 5-step walkthrough with voice narration (Web Speech API) and subtitles.
*   **Analytics Charts**: Propellant spent curves, lead-time efficiency, and relative coordinate displacement plots.
*   **Secure Uplink**: SHA-256 cryptographic command signature for burn authorization.
*   **Mission Control Audio**: Web Audio API sound effects synced to mission phases.
*   **Developer Audit Mode**: Floating toggle that overlays raw backend JSON field names next to every rendered metric for auditability.

---

## 4. Tech Stack

*   **Framework**: Next.js 15 (App Router, Server Components)
*   **Language**: TypeScript 5 (Strict Mode)
*   **3D Engine**: Three.js 0.184
*   **Orbital Math**: `satellite.js` 7.0 (SGP4/SDP4 propagator)
*   **Charts**: Recharts 3.8
*   **UI Components**: Radix UI (Dialog, Dropdown, Tabs)
*   **Animations**: GSAP 3.15
*   **Package Manager**: pnpm

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         OrbitGuard v2.0                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │Dashboard │  │  3D Map  │  │Maneuvers │  │ AI Briefing   │  │
│  │/dashboard│  │  /map    │  │/maneuvers│  │ /ai-briefing  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │              │                 │           │
│  ┌────▼──────────────▼──────────────▼─────────────────▼──────┐  │
│  │                    useOrbitStream (hook)                    │  │
│  │         Reactive real-time data bus (polling + SSE)        │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                       │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │                       MockDatabase (db.ts)                  │  │
│  │   satellites[]  |  conjunctionEvents[]  |  maneuverPlans[] │  │
│  └────┬───────────────────────────────────────────────────────┘  │
│       │                                                           │
│  ┌────▼────────────────────────────────────────────────────────┐  │
│  │                 Physics Engine (FastAPI)                   │  │
│  │  SGP4  |  CW Equations  |  Akella-Alfriend Pc  |  Rocket eq │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Physics Engine and Mathematical Formulations

### Constants Used

*   `Re` = $6378.137\text{ km}$ (Earth equatorial radius)
*   `GM` = $398600.4418\text{ km}^3/\text{s}^2$ (Earth gravitational parameter $\mu$)
*   `g0` = $9.80665\text{ m/s}^2$ (Standard gravity acceleration)

---

### 6.1 SGP4 Orbital Propagation and ECEF Rotation

OrbitGuard propagates standard Two-Line Element (TLE) sets using the SGP4 mathematical model to obtain ECI (Earth-Centered Inertial) state vectors:
$$\vec{r}_{\text{TEME}}(t) = [x,\ y,\ z]^T \quad (\text{km})$$
$$\vec{v}_{\text{TEME}}(t) = [\dot{x},\ \dot{y},\ \dot{z}]^T \quad (\text{km/s})$$

To align coordinates with a fixed Earth mesh in Three.js, ECI positions are rotated into the Earth-Centered Earth-Fixed (ECEF) frame using Greenwich Mean Sidereal Time ($\text{GMST}$):
$$\vec{r}_{\text{ECEF}}(t) = \mathbf{R}_z(\text{GMST}(t)) \, \vec{r}_{\text{TEME}}(t)$$
$$\mathbf{R}_z(\theta) = \begin{pmatrix} \cos\theta & \sin\theta & 0 \\ -\sin\theta & \cos\theta & 0 \\ 0 & 0 & 1 \end{pmatrix}$$

The geodetic coordinates are then resolved:
$$\lambda = \text{atan2}(y_{\text{ECEF}}, x_{\text{ECEF}})$$
$$\phi = \text{atan2}\left(z_{\text{ECEF}}, \sqrt{x_{\text{ECEF}}^2 + y_{\text{ECEF}}^2}\right)$$
$$h = |\vec{r}_{\text{ECEF}}| - R_e$$

---

### 6.2 Akella-Alfriend 2D Collision Probability (Pillar 2)

The 2D encounter frame is defined at TCA relative to the relative velocity vector:
$$\hat{e}_z = \frac{\Delta\vec{v}}{|\Delta\vec{v}|}, \qquad \hat{e}_x = \frac{\Delta\vec{r} \times \Delta\vec{v}}{|\Delta\vec{r} \times \Delta\vec{v}|}, \qquad \hat{e}_y = \hat{e}_z \times \hat{e}_x$$

The position covariances of the primary and secondary objects are defined in their local Radial-Transverse-Normal (RTN) frames:
$$\mathbf{C}_{\text{ECI}} = \sigma_R^2 (\hat{u}_R \otimes \hat{u}_R) + \sigma_T^2 (\hat{u}_T \otimes \hat{u}_T) + \sigma_N^2 (\hat{u}_N \otimes \hat{u}_N)$$

These are combined ($\mathbf{C}_{\text{combined}} = \mathbf{C}_A + \mathbf{C}_B$) and projected onto the 2D encounter plane:
$$\mathbf{C}_e = \begin{pmatrix} C_{e00} & C_{e01} \\ C_{e01} & C_{e11} \end{pmatrix} = \begin{pmatrix} \hat{e}_x \cdot \mathbf{C}_{\text{combined}} \cdot \hat{e}_x & \hat{e}_x \cdot \mathbf{C}_{\text{combined}} \cdot \hat{e}_y \\ \hat{e}_x \cdot \mathbf{C}_{\text{combined}} \cdot \hat{e}_y & \hat{e}_y \cdot \mathbf{C}_{\text{combined}} \cdot \hat{e}_y \end{pmatrix}$$

The collision probability $P_c$ is calculated by integrating the 2D Gaussian probability density function over a circular hard-body region of radius $R$:
$$P_c = \frac{R^2}{2\sqrt{\det(\mathbf{C}_e)}} \exp\left( -\frac{1}{2} \vec{r}_p^T \mathbf{C}_e^{-1} \vec{r}_p \right)$$
Where $\vec{r}_p = [x_p, y_p]^T$ is the projected relative position vector on the encounter plane.

---

### 6.3 Clohessy-Wiltshire relative-motion Maneuver Solver (Pillar 3)

Relative motion in a circular orbit of mean motion $n = \sqrt{GM/a^3}$ is modeled using the Clohessy-Wiltshire (CW) equations. Given a velocity change impulse $\Delta\vec{v} = [\Delta v_R, \Delta v_T, \Delta v_N]^T$ in the Hill frame at $\Delta t = 0$, the relative position at TCA ($t = \Delta t$) is:
$$x(\Delta t) = \frac{\Delta v_R}{n}\sin(n\Delta t) + \frac{2\Delta v_T}{n}\bigl(1 - \cos(n\Delta t)\bigr)$$
$$y(\Delta t) = \frac{2\Delta v_R}{n}\bigl(\cos(n\Delta t) - 1\bigr) + \frac{\Delta v_T}{n}\bigl(4\sin(n\Delta t) - 3n\Delta t\bigr)$$
$$z(\Delta t) = \frac{\Delta v_N}{n}\sin(n\Delta t)$$

Evasive maneuvers are target-solved using the transverse burn ratio:
$$\Delta v_T \approx \frac{(d_{\text{target}} - d_{\text{current}}) \times 1000}{2 \Delta t} \quad (\text{m/s})$$

The backend compares this linear CW target against an independent nonlinear two-body Kepler propagation to TCA:
$$\vec{r}_p(t_{\text{TCA}}) = \text{propagate\_two\_body}(\vec{r}_p(t_{\text{burn}}), \vec{v}_p(t_{\text{burn}}) + \Delta\vec{v}_{\text{ECI}}, \Delta t)$$
If the linear model deviates by $>10\%$ from the SGP4 nonlinear propagation, a `cw_divergence_flag` is set to `true` to warn operators.

---

### 6.4 Tsiolkovsky Propellant Mass Calculation

Propellant spent is calculated using the Tsiolkovsky Rocket Equation:
$$m_{\text{prop}} = m_0 \left(1 - \exp\left( \frac{-\Delta V}{I_{\text{sp}} g_0} \right)\right)$$
*   $m_0$ = wet mass of satellite ($500\text{ kg}$)
*   $I_{\text{sp}}$ = specific impulse of thruster ($220\text{ seconds}$ for hydrazine monopropellant)
*   $g_0$ = $9.80665\text{ m/s}^2$

---

### 6.5 Multi-Objective Trade-Off and Optimization (Pillar 4)

Maneuver options are evaluated using normalized sub-scores:
1.  **Safety Score** ($S_{\text{safety}}$): Scales linearly relative to a safe nominal separation of $50\text{ km}$:
    $$S_{\text{safety}} = \min\left(1.0, \frac{d_{\text{achieved\_sgp4}}}{50.0}\right)$$
2.  **Fuel Score** ($S_{\text{fuel}}$): Normalized inverse cost across options:
    $$S_{\text{fuel}} = \frac{f_{\text{max}} - f_{\text{cost}}}{f_{\text{max}} - f_{\text{min}}}$$
3.  **Secondary Risk Score** ($S_{\text{risk}}$): Evaluated from secondary screening. If the secondary conjunction distance $d_{\text{sec}}$ is closer than the original separation $d_{\text{orig}}$, the option is disqualified ($S_{\text{risk}} = 0.0$ and composite score is forced to $0.0$). Otherwise:
    $$S_{\text{risk}} = 1.0 - \frac{d_{\text{orig}}}{d_{\text{sec}}}$$

The final composite score is calculated as:
$$\text{Score} = (0.40 \cdot S_{\text{safety}} + 0.30 \cdot S_{\text{fuel}} + 0.30 \cdot S_{\text{risk}}) \times 100.0$$

---

## 7. 3D Orbit Visualizer (Pillar 5)

The interactive WebGL visualizer rendered by `EarthView.tsx` converts ECEF coordinates to Three.js world space coordinates:
$$x_{\text{three}} = x_{\text{ECEF}} \cdot \text{SCALE}$$
$$y_{\text{three}} = z_{\text{ECEF}} \cdot \text{SCALE}$$
$$z_{\text{three}} = y_{\text{ECEF}} \cdot \text{SCALE}$$
$$\text{SCALE} = \frac{R_{\text{three\_earth}}}{R_{\text{wgs84\_earth}}} = \frac{6.371}{6378.137}$$

### Scene Components:
*   **Earth mesh**: Phong material with elevation bump maps and specular ocean reflections.
*   **Kessler Cloud**: 12,000 particle systems distributed across LEO, MEO, and GEO belts.
*   **Trajectories**: Draws unperturbed nominal orbits, post-burn paths, and the closest approach vector.
*   **Danger Zone**: Renders a transparent red sphere centered on the threat object at TCA with a radius matching the safety margin.

---

## 8. Developer Audit Mode (Pillar Verification)

OrbitGuard implements a **Developer Audit Mode** toggle. When active:
*   Hovering over any telemetry number displays a HTML tooltip with its source JSON property path (e.g., `backend: chosen_option.delta_v_ms` or `backend: alert.min_distance_km`).
*   Small monospace badges are printed adjacent to numbers showing their exact backend data keys (e.g. `[resulting_min_distance_km]`).

This ensures complete alignment between the backend physics calculations and the user interface.

---

## 9. Pages & Routes

*   `/dashboard`: Real-time threat registry cards and alert summaries.
*   `/map`: Photorealistic 3D WebGL Earth flight path visualizer.
*   `/maneuvers`: Relative-motion targeting solver, physics charts, and burn uplink.
*   `/conjunctions`: Historical and active conjunction event filter logs.
*   `/ai-briefing`: Natural-language safety executive summaries.
*   `/api/maneuvers/calculate`: Proxy endpoint wrapping FastAPI's `/maneuver/{id}/options` and `/compare/{id}` endpoints.

---

## 10. Data Model

See the TypeScript models defined in [`src/types/index.ts`](./src/types/index.ts) representing `Satellite`, `ConjunctionEvent`, and `ManeuverPlan`.

---

## 11. Getting Started

### Prerequisites
*   Node.js $\ge 18.0.0$
*   pnpm $\ge 8.0.0$

### Setup
```bash
# Clone and install dependencies
git clone https://github.com/your-username/orbitguard.git
cd orbitguard
pnpm install

# Start local server
pnpm dev
```
The application will run locally at **http://localhost:3000**.

---

## 12. Verification and Integration Test Suite

OrbitGuard includes a multi-tiered test suite powered by Vitest to verify physical and integration correctness.

To run the test suite:
```bash
npm run test
```

### Physical Correctness Tests (`src/visualization_validation.test.ts`)
*   **Check 1**: Validates ECEF axis mappings against known ISS ground truth from the astrodynamics engine.
*   **Check 2**: Confirms three-dimensional scale consistency between km and WebGL units.
*   **Check 3**: Verifies Earth rotation angular velocity and sidereal time matching.
*   **Check 4**: Assures SGP4 orbit trajectory loops close within natural perturbation margins ($<0.05$ units per orbital period).
*   **Check 5**: Validates that danger zone center positions match TCA positions.

### Integration Contract Tests (`src/pillar_integration.test.ts`)
*   Asserts that Next.js proxy endpoints fetch, map, and return payload properties (including `cw_divergence_flag` and `secondary_conjunction_warning`) that match the backend's Pydantic schemas exactly for validation candidate `62099`.
