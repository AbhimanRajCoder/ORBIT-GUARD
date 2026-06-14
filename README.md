# 🛰️ OrbitGuard — Real-Time Spacecraft Collision Avoidance System

<div align="center">

![OrbitGuard Banner](https://img.shields.io/badge/OrbitGuard-v2.0-7c3aed?style=for-the-badge&logo=satellite&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=nextdotjs)
![Three.js](https://img.shields.io/badge/Three.js-0.184-049ef4?style=for-the-badge&logo=threedotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=for-the-badge&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**A full-stack, mission-control-grade space situational awareness platform that detects orbital conjunction threats, computes physics-based evasive maneuvers, and visualizes live satellite trajectories in 3D.**

[Live Demo](#) • [Architecture](#architecture) • [Physics Engine](#physics-engine) • [API Reference](#api-reference)

</div>

---

## Table of Contents

1. [Project Overview](#1-project-overview)  
2. [Key Features](#2-key-features)  
3. [Tech Stack](#3-tech-stack)  
4. [Architecture](#4-architecture)  
5. [Physics Engine](#5-physics-engine)  
   - 5.1 [SGP4 Orbital Propagation](#51-sgp4-orbital-propagation)  
   - 5.2 [Orbital Period & Velocity](#52-orbital-period--velocity)  
   - 5.3 [Collision Probability — Akella-Alfriend 2D Method](#53-collision-probability--akella-alfriend-2d-method)  
   - 5.4 [Tsiolkovsky Rocket Equation — Fuel Cost](#54-tsiolkovsky-rocket-equation--fuel-cost)  
   - 5.5 [Clohessy-Wiltshire Equations — Maneuver ΔV Solver](#55-clohessy-wiltshire-equations--maneuver-v-solver)  
6. [3D Orbit Visualizer](#6-3d-orbit-visualizer)  
7. [Pages & Routes](#7-pages--routes)  
8. [Data Model](#8-data-model)  
9. [Getting Started](#9-getting-started)  
10. [Project Structure](#10-project-structure)  
11. [Hackathon Context](#11-hackathon-context)  

---

## 1. Project Overview

OrbitGuard is a **spacecraft collision avoidance** web application built for the real-world problem of **Kessler Syndrome** — the cascading chain reaction of space debris collisions that could render Low Earth Orbit (LEO) permanently unusable.

**The core workflow:**

```
TLE Data (NORAD) → SGP4 Propagation → Conjunction Detection → 
Collision Probability (Pc) → CW Maneuver Solver → Burn Authorization → 3D Visualization
```

Every calculation in this system is backed by **peer-reviewed astrodynamics formulas** used by NASA's Conjunction Data Messages (CDM) and the 18th Space Control Squadron.

---

## 2. Key Features

| Feature | Description |
|---|---|
| 🌍 **Live 3D Globe** | WebGL Earth with SGP4-propagated orbits, Kessler debris cloud, animated hazard trajectories |
| ⚠️ **Conjunction Detection** | Real-time threat registry with time-to-closest-approach (TCA) and miss distance |
| 📊 **Collision Probability** | Akella-Alfriend 2D analytical Pc computation with RTN→ECI covariance rotation |
| 🚀 **Maneuver Simulator** | CW-equations-based ΔV solver with Tsiolkovsky fuel cost, interactive sandbox |
| 🤖 **AI Situation Briefing** | Natural-language orbital safety audit summarizing all telemetry |
| 🎯 **Guided Demo Playbook** | Cinematic 5-step walkthrough with voice narration (Web Speech API) and subtitles |
| 📈 **Analytics Charts** | Tsiolkovsky mass curves, lead-time efficiency, CW trajectory plots (Recharts) |
| 🔐 **Secure Uplink** | SHA-256 cryptographic command signature for burn authorization |
| 🔊 **Mission Control Audio** | Web Audio API sound effects (alarm, chime, fanfare) synced to mission phases |

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16.2 (App Router, React Server Components) |
| **Language** | TypeScript 5 (strict mode) |
| **3D Engine** | Three.js 0.184 + OrbitControls |
| **Orbital Math** | `satellite.js` 7.0 (SGP4/SDP4 propagator) |
| **Charts** | Recharts 3.8 |
| **UI Components** | Radix UI (Dialog, Dropdown, Tabs) |
| **Animations** | GSAP 3.15, CSS keyframes |
| **Icons** | Lucide React |
| **Styling** | Tailwind CSS v4 |
| **Testing** | Vitest |
| **Package Manager** | pnpm |

---

## 4. Architecture

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
│  │                    Physics Engine                            │  │
│  │  sgp4-propagator.ts  |  orbital-physics.ts                  │  │
│  │  SGP4  |  CW equations  |  Akella-Alfriend Pc  |  Rocket eq │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. TLE strings (Line 1 + Line 2) stored per satellite in MockDatabase
2. SGP4 propagator converts TLE → ECI position/velocity at any time t
3. orbital-physics.ts computes Pc, ΔV, fuel cost, new miss distance
4. useOrbitStream hook exposes { satellites, conjunctionEvents } to all pages
5. EarthView.tsx draws Three.js scene (Earth, orbit lines, debris cloud)
6. Maneuver page renders CW results + Tsiolkovsky charts via Recharts
```

---

## 5. Physics Engine

All formulas are implemented in [`src/lib/orbital-physics.ts`](./src/lib/orbital-physics.ts) and [`src/lib/sgp4-propagator.ts`](./src/lib/sgp4-propagator.ts).

### Constants Used

| Symbol | Value | Unit | Description |
|---|---|---|---|
| `Rₑ` | 6378.137 | km | Earth's equatorial radius |
| `GM` | 398600.4418 | km³/s² | Earth's gravitational parameter (μ) |
| `g₀` | 9.80665 | m/s² | Standard gravity |

---

### 5.1 SGP4 Orbital Propagation

OrbitGuard uses the **Simplified General Perturbations 4 (SGP4)** model via the `satellite.js` library. SGP4 is the standard algorithm used by NORAD to propagate Two-Line Element (TLE) sets.

**TLE Format (Two-Line Element Set):**

```
Line 1: 1 NNNNNC NNNNNAAA NNNNN.NNNNNNNN +.NNNNNNNN +NNNNN-N +NNNNN-N N NNNNN
Line 2: 2 NNNNN NNN.NNNN NNN.NNNN NNNNNNN NNN.NNNN NNN.NNNN NN.NNNNNNNNNNNNNN
```

**Orbital Elements extracted from TLE:**

| Element | Symbol | Description |
|---|---|---|
| Inclination | `i` | Angle between orbit plane and equatorial plane |
| Right Ascension of Ascending Node | `Ω` | Longitude of ascending node |
| Eccentricity | `e` | Shape of orbit (0 = circular, 1 = parabolic) |
| Argument of Perigee | `ω` | Angle from ascending node to perigee |
| Mean Anomaly | `M` | Position along orbit at epoch |
| Mean Motion | `n` | Revolutions per day |

**SGP4 output** — ECI (Earth-Centered Inertial) state vector:

```
r⃗(t) = [x, y, z]    (km)
v⃗(t) = [ẋ, ẏ, ż]    (km/s)
```

**Coordinate conversion ECI → Geodetic:**

```
GMST(t) = Greenwich Mean Sidereal Time at time t
λ = atan2(y, x) - GMST          (longitude)
φ = atan2(z, √(x² + y²))        (geocentric latitude)
h = |r⃗| - Rₑ                   (altitude)
```

Implementation: [`propagateTLE()`](./src/lib/sgp4-propagator.ts#L16) and [`propagateTLEToGeodetic()`](./src/lib/sgp4-propagator.ts#L43)

---

### 5.2 Orbital Period & Velocity

**Orbital Period (Kepler's Third Law):**

```
         _________
        /   a³
T = 2π √  ────     [seconds]
           GM
```

Where:
- `a = Rₑ + h` = semi-major axis (km)
- `GM` = Earth's gravitational parameter (km³/s²)

Converted to minutes: `T_min = T_sec / 60`

**Example:** Starlink at 550 km altitude → T ≈ 95.6 minutes

**Circular Orbital Velocity (Vis-viva equation for circular orbit):**

```
        ___
       / GM
v = √ ────     [km/s]
        a
```

**Example:** At 550 km → v ≈ 7.60 km/s (27,360 km/h)

Implementation: [`calculateOrbitalPeriod()`](./src/lib/orbital-physics.ts#L17) and [`calculateOrbitalVelocity()`](./src/lib/orbital-physics.ts#L28)

---

### 5.3 Collision Probability — Akella-Alfriend 2D Method

This is the core safety computation. OrbitGuard implements the **Akella-Alfriend (2000) 2D Analytical Pc** method, the same approach used in NASA's CARA (Conjunction Assessment Risk Analysis) program.

#### Step 1 — Relative State

```
Δr⃗ = r⃗_A - r⃗_B     (relative position, km)
Δv⃗ = v⃗_A - v⃗_B     (relative velocity, km/s)
```

#### Step 2 — Encounter Reference Frame

The collision plane is defined perpendicular to the relative velocity vector:

```
ê_z = Δv⃗ / |Δv⃗|                           (along relative velocity)

ê_x = (Δr⃗ × Δv⃗) / |Δr⃗ × Δv⃗|             (perpendicular, in orbit plane)

ê_y = ê_z × ê_x                           (completes right-handed frame)
```

#### Step 3 — Covariance Rotation (RTN → ECI)

Each satellite's position uncertainty is modeled in **RTN coordinates** (Radial, Transverse, Normal):

```
Primary (A):    σ_R = 0.3 km,  σ_T = 1.5 km,  σ_N = 0.3 km
Secondary (B):  σ_R = 0.5 km,  σ_T = 2.0 km,  σ_N = 0.5 km
```

RTN unit vectors:
```
û_R = r⃗ / |r⃗|                             (radial: outward)
û_N = (r⃗ × v⃗) / |r⃗ × v⃗|                  (normal: angular momentum)
û_T = û_N × û_R                            (transverse: along-track)
```

ECI covariance matrix (3×3):
```
C_ECI = σ_R² (û_R ⊗ û_R) + σ_T² (û_T ⊗ û_T) + σ_N² (û_N ⊗ û_N)
```

Combined covariance:
```
C_combined = C_A + C_B
```

#### Step 4 — Project to 2D Encounter Plane

```
C_e = | C_e00  C_e01 |
      | C_e01  C_e11 |

where: C_e00 = ê_x · C_combined · ê_x
       C_e01 = ê_x · C_combined · ê_y
       C_e11 = ê_y · C_combined · ê_y
```

Projected miss distance on encounter plane:
```
x_p = Δr⃗ · ê_x
y_p = Δr⃗ · ê_y
```

Mahalanobis distance squared:
```
d_M² = [x_p, y_p] · C_e⁻¹ · [x_p, y_p]ᵀ
```

#### Step 5 — Akella-Alfriend Pc Formula

```
         R²          ⎛   1      ⎞
Pc = ──────────── · exp⎜ - ─ d_M² ⎟
     2√(det(C_e))    ⎝   2      ⎠
```

Where:
- `R` = combined hard-body radius (primary + secondary, in km) — default 15 m
- `det(C_e) = C_e00 · C_e11 - C_e01²`

**Risk thresholds used in OrbitGuard:**

| Pc Range | Risk Level | Action |
|---|---|---|
| `Pc ≥ 1 × 10⁻⁴` | 🔴 RED | Immediate maneuver required |
| `10⁻⁵ ≤ Pc < 10⁻⁴` | 🟡 YELLOW | Maneuver recommended |
| `Pc < 10⁻⁵` | 🟢 GREEN | No action required |

Implementation: [`estimateCollisionProbability()`](./src/lib/orbital-physics.ts#L38)

---

### 5.4 Tsiolkovsky Rocket Equation — Fuel Cost

The **Tsiolkovsky Rocket Equation** (1903) gives the propellant mass required to achieve a velocity change ΔV:

```
                ⎛       ΔV      ⎞
m_prop = m₀ · ⎜1 - exp(- ─────)⎟
                ⎝      Isp · g₀ ⎠
```

Where:
- `m₀` = wet mass of satellite (kg) — default 500 kg
- `ΔV` = required velocity change (m/s)
- `Isp` = specific impulse of thruster (s) — default 220 s (hydrazine monopropellant)
- `g₀` = 9.80665 m/s² (standard gravity)
- `m_prop` = propellant mass consumed (kg)

**Example calculation for a typical LEO avoidance maneuver:**

```
ΔV = 0.35 m/s
m₀ = 500 kg
Isp = 220 s

m_prop = 500 × (1 - exp(-0.35 / (220 × 9.80665)))
       = 500 × (1 - exp(-0.0001623))
       = 500 × 0.0001623
       ≈ 0.081 kg  (81 grams of fuel)
```

**Exhaust velocity:**
```
v_e = Isp × g₀ = 220 × 9.80665 ≈ 2157 m/s
```

**Tsiolkovsky Mass Ratio Curve** (shown in Maneuvers page chart):
```
m_prop/m₀ = 1 - exp(-ΔV / v_e)
```

Implementation: [`calculateFuelCost()`](./src/lib/orbital-physics.ts#L190)

---

### 5.5 Clohessy-Wiltshire Equations — Maneuver ΔV Solver

The **Clohessy-Wiltshire (CW) equations** (1960) describe the relative motion between two objects in nearby circular orbits. Also known as the **Hill equations**, they are used by NASA, ESA, and SpaceX for proximity operations.

**Mean motion:**
```
        2π
n = ──────────     [rad/s]
     T_period
```

**CW Relative Position Equations** (after impulsive burn ΔV at t=0, evaluated at t=Δt):

Given burn components in RTN frame:
- `Δv_R` = radial (outward) velocity change
- `Δv_T` = transverse (along-track) velocity change  
- `Δv_N` = normal (cross-track) velocity change

```
x(Δt) = (Δv_R / n) · sin(nΔt) + (2Δv_T / n) · (1 - cos(nΔt))

y(Δt) = (2Δv_R / n) · (cos(nΔt) - 1) + (Δv_T / n) · (4sin(nΔt) - 3nΔt)

z(Δt) = (Δv_N / n) · sin(nΔt)
```

Where `Δt` = time from burn to Time of Closest Approach (TCA) in seconds.

**Total 3D displacement from burn:**
```
                 ___________________
|Δr⃗| = √(x² + y² + z²)     [meters]
```

**New miss distance (root-sum-square combination):**
```
                      ___________________________________
d_new = √(d_current² + (|Δr⃗|/1000)²)     [km]
```

**Burn direction mapping:**

| Direction | Δv_R | Δv_T | Δv_N |
|---|---|---|---|
| Prograde | 0 | +ΔV | 0 |
| Retrograde | 0 | −ΔV | 0 |
| Radial-Out | +ΔV | 0 | 0 |
| Radial-In | −ΔV | 0 | 0 |
| Normal | 0 | 0 | +ΔV |
| Anti-Normal | 0 | 0 | −ΔV |

**Inverse CW — Solve ΔV for target miss distance:**

```
ΔV ≈ (d_target - d_current) × 1000 / (2 × Δt)     [m/s]
```

This linear approximation is valid when the required deflection is small compared to the orbital radius (satisfied for all LEO avoidance maneuvers in the typical 0.1–2 km range).

**Three maneuver tiers computed automatically:**

| Plan | Target Miss | Strategy |
|---|---|---|
| Minimum Fuel | 2.0 km | Smallest safe deflection, conserves propellant |
| Balanced | 5.0 km | NASA/ESA recommended operational threshold |
| Maximum Safety | 10.0 km | Large margin, used for high-value assets |

Implementation: [`predictNewMissDistance()`](./src/lib/orbital-physics.ts#L204) and [`calculateManeuverOptions()`](./src/lib/orbital-physics.ts#L262)

---

## 6. 3D Orbit Visualizer

The 3D map (`/map`) uses **Three.js WebGL** with the following visual layers, all toggleable from the right-hand control panel:

### Earth Rendering

| Layer | Technology | Detail |
|---|---|---|
| Surface | `MeshPhongMaterial` | 2048×2048 NASA Blue Marble texture |
| Bumps | `bumpMap` | Surface elevation relief (scale 0.04) |
| Specular | `specularMap` | Ocean glint (shininess 25) |
| Clouds | Semi-transparent shell | 1024px cloud texture, opacity 0.3 |
| Atmosphere | Custom `ShaderMaterial` | Back-face additive blending rim glow |

**Atmosphere rim shader (GLSL):**

```glsl
// Vertex shader
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// Fragment shader
varying vec3 vNormal;
void main() {
  float intensity = pow(0.55 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
  gl_FragColor = vec4(0.05, 0.55, 0.95, 1.0) * intensity;  // blue glow
}
```

### Debris Cloud — Kessler Syndrome Simulation

12,000 points distributed across real-world debris density bands:

| Shell | Altitude Range | Count | Color | Distribution |
|---|---|---|---|---|
| LEO (densest) | 200 – 2,000 km | 7,000 pts | Grey-white | Broad inclination spread (±103°) |
| MEO (GPS band) | 5,000 – 20,000 km | 2,000 pts | Blue-grey | Narrow inclination (±34°) |
| GEO belt | 35,000 – 36,000 km | 1,000 pts | Warm grey | Near-equatorial (±3°) |
| Polar cluster | 300 – 1,500 km | 2,000 pts | Cool grey | All inclinations (±180°) |

**Shell point generation formula:**
```
radius = Rₑ + altitude_km / 6378.137 × Rₑ    (in Three.js scene units)
θ = random × 2π                                (longitude)
φ = π/2 + inclination_spread × (random - 0.5) (colatitude ± spread)

x = r × sin(φ) × cos(θ)
y = r × cos(φ)
z = r × sin(φ) × sin(θ)
```

### Orbit Trajectory Lines

Each satellite/debris object draws its full orbital trajectory computed from SGP4 propagation over one complete period (180 sample points):

| Object Type | Line Style | Color | Opacity |
|---|---|---|---|
| Operational satellite | Solid `LineBasicMaterial` | Cyan `#00bae2` | 0.45 |
| Large debris | Solid `LineBasicMaterial` | Dark grey `#4a4e55` | 0.35 |
| Red hazard object | Animated `LineDashedMaterial` | Red `#ff3355` | 0.90 |
| Yellow caution | Animated `LineDashedMaterial` | Amber `#ffb829` | 0.90 |
| Post-burn deflection | Animated `LineDashedMaterial` | Green `#00ff88` | 0.90 |

Dashed hazard lines animate via dashOffset scrolling in the render loop (creates a "marching ants" radar sweep effect).

### Screen-Space Conjunction Distance Labels

Midpoints of active conjunction vectors are projected from 3D world space to 2D screen space each frame:

```
vec_ndc = world_position.clone().project(camera)   // NDC coords [-1, 1]

screen_x = (vec_ndc.x × 0.5 + 0.5) × canvas_width
screen_y = (-vec_ndc.y × 0.5 + 0.5) × canvas_height
```

Labels only render when `vec_ndc.z ≤ 1.0` (in front of camera near-plane).

---

## 7. Pages & Routes

| Route | Component | Description |
|---|---|---|
| `/` | `page.tsx` | Root redirect → `/dashboard` |
| `/dashboard` | Dashboard | Threat cards, live telemetry summary, conjunction table |
| `/map` | `EarthView.tsx` | Interactive 3D WebGL globe with all orbit visualization |
| `/maneuvers` | Maneuvers page | CW solver, physics charts, interactive sandbox, burn uplink |
| `/conjunctions` | Conjunctions | Full conjunction event registry with filters |
| `/ai-briefing` | AI Briefing | Natural-language orbital safety executive summary |
| `/api/maneuvers/calculate` | Route Handler | POST endpoint to compute maneuver plans |

---

## 8. Data Model

### `Satellite`

```typescript
interface Satellite {
  id: string;                    // e.g. "SAT-001"
  name: string;                  // e.g. "STARLINK-4892"
  noradId: string;               // NORAD catalog number
  objectType: 'satellite' | 'debris';
  riskLevel: 'red' | 'yellow' | 'green';
  altitude: number;              // km above sea level
  inclination: number;           // degrees
  period: number;                // orbital period in minutes
  tleLine1: string;              // TLE line 1 (NORAD format)
  tleLine2: string;              // TLE line 2 (NORAD format)
  fuelRemainingPct: number;      // 0-100
  estimatedMassKg: number;       // kg
}
```

### `ConjunctionEvent`

```typescript
interface ConjunctionEvent {
  id: string;                    // e.g. "CONJ-2026-001"
  primaryId: string;             // Satellite ID (maneuverable asset)
  primaryName: string;
  secondaryId: string;           // Debris/secondary object ID
  secondaryName: string;
  tca: string;                   // ISO timestamp — Time of Closest Approach
  missDistance: number;          // km at TCA
  missDistanceMeters: number;    // meters at TCA
  pc: number;                    // collision probability (0-1)
  pcDisplay: string;             // formatted: "3.24 × 10⁻³"
  riskLevel: 'red' | 'yellow';
  status: 'active' | 'resolved' | 'monitoring';
  relativeVelocity: number;      // km/s
}
```

### `ManeuverPlan`

```typescript
interface ManeuverPlan {
  id: string;                    // e.g. "MP-BAL-CONJ-2026-001"
  conjunctionEventId: string;
  satelliteId: string;
  burnDirection: 'prograde' | 'retrograde' | 'radial-in' | 'radial-out' | 'normal' | 'antinormal';
  deltaV: number;                // m/s
  burnTime: string;              // ISO timestamp
  burnTimingNote: string;        // human-readable timing note
  currentMissDistance: number;   // km (before maneuver)
  newMissDistance: number;       // km (after maneuver, from CW solver)
  targetMissDistance: number;    // km (desired)
  propellantMassKg: number;      // kg (from Tsiolkovsky eq)
  specificImpulse: number;       // s
  satelliteMassKg: number;       // kg
  status: 'proposed' | 'approved' | 'executed' | 'rejected';
  createdAt: string;
}
```

---

## 9. Getting Started

### Prerequisites

- Node.js ≥ 18.0.0
- pnpm ≥ 8.0.0

```bash
npm install -g pnpm
```

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/orbitguard.git
cd orbitguard

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app starts at **http://localhost:3000**.

### Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Internal API base URL | `http://localhost:3000` |
| `NEXT_PUBLIC_CELESTRAK_PROXY` | CelesTrak TLE proxy endpoint | (optional) |

### Running Tests

```bash
pnpm test          # Run all tests once
pnpm test:watch    # Watch mode
```

### Build for Production

```bash
pnpm build
pnpm start
```

---

## 10. Project Structure

```
orbitguard/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Root page
│   │   ├── layout.tsx                # Global layout, fonts, nav
│   │   ├── globals.css               # Design tokens, CSS variables
│   │   ├── dashboard/                # Mission control dashboard
│   │   ├── map/                      # 3D orbit map page
│   │   ├── maneuvers/                # Maneuver simulator page
│   │   ├── conjunctions/             # Conjunction event registry
│   │   ├── ai-briefing/              # AI executive summary
│   │   └── api/
│   │       └── maneuvers/
│   │           └── calculate/        # POST /api/maneuvers/calculate
│   │
│   ├── components/
│   │   ├── EarthView.tsx             # Three.js 3D globe (main visualization)
│   │   ├── OnboardingModal.tsx       # First-launch guided intro
│   │   └── dashboard/
│   │       ├── GuidedTour.tsx        # 5-step cinematic demo walkthrough
│   │       └── WorkspaceShell.tsx    # Main layout with nav sidebar
│   │
│   ├── lib/
│   │   ├── sgp4-propagator.ts        # TLE → ECI / Geodetic via satellite.js
│   │   ├── orbital-physics.ts        # CW, Akella-Alfriend Pc, Tsiolkovsky
│   │   ├── tle-parser.ts             # TLE string parser and validator
│   │   ├── db.ts                     # MockDatabase (satellites, events, plans)
│   │   ├── celestrak.ts              # CelesTrak API integration
│   │   ├── sound-effects.ts          # Web Audio API (alarm, chime, fanfare)
│   │   ├── config.ts                 # Global app configuration
│   │   └── hooks/
│   │       └── useOrbitStream.ts     # Real-time data hook
│   │
│   └── types/
│       └── index.ts                  # TypeScript interfaces (Satellite, ConjunctionEvent, etc.)
│
├── public/                           # Static assets
├── package.json
├── tsconfig.json
├── next.config.ts
├── vitest.config.ts
└── README.md
```

---

## 11. Hackathon Context

OrbitGuard was built for a hackathon addressing **Space Sustainability and Orbital Safety**.

### Problem Statement

The United Nations Office for Outer Space Affairs (UNOOSA) estimates over **27,000 trackable debris objects** orbit Earth, with millions of smaller untracked fragments. The **Kessler Syndrome** (proposed by NASA scientist Donald J. Kessler in 1978) describes a cascade scenario where:

```
Collision → More debris → More collisions → Chain reaction → LEO unusable
```

Key statistics:
- **~100 conjunction warnings** are issued per satellite per year
- Average relative velocity of debris collisions: **10 km/s** (10× faster than a rifle bullet)
- Energy released per kg at 10 km/s: **50 MJ** (equivalent to 12 kg of TNT)
- Cost of a single commercial satellite: **$50M – $500M**
- Cost of Kessler cascade to global economy: **$1 trillion+**

### Solution

OrbitGuard provides a **fully automated, physics-accurate decision support system** that:

1. Ingests live TLE data from CelesTrak (NORAD catalog)
2. Propagates orbits using the standard SGP4/SDP4 model
3. Computes collision probability using the **Akella-Alfriend 2D Pc** formula (used by NASA CARA)
4. Generates optimal evasive burn parameters using **Clohessy-Wiltshire equations**
5. Calculates propellant cost using the **Tsiolkovsky Rocket Equation**
6. Provides an AI-generated plain-language safety briefing for non-specialist decision makers
7. Visualizes all data in a photorealistic 3D globe with Kessler debris simulation

### References

- Akella, M.R. & Alfriend, K.T. (2000). *Probability of Collision Between Space Objects*. Journal of Guidance, Control, and Dynamics.
- Clohessy, W.H. & Wiltshire, R.S. (1960). *Terminal Guidance System for Satellite Rendezvous*. Journal of the Aerospace Sciences.
- Tsiolkovsky, K.E. (1903). *The Exploration of Cosmic Space by Means of Reaction Devices*.
- Hoots, F.R. & Roehrich, R.L. (1980). *Models for Propagation of NORAD Element Sets (Spacetrack Report No. 3)*.
- NASA Conjunction Assessment Risk Analysis (CARA) — Handbook, 2020.
- UNOOSA, *Space Debris — The ESA's Annual Space Environment Report*, 2024.

---

<div align="center">

**Built with ❤️ for Space Safety**

*OrbitGuard — Because every orbit matters.*

</div>
