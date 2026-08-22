// ─────────────────────────────────────────────────────────────
// OrbitGuard v2.0 — Type Definitions
// Satellite Conjunction Analysis & Maneuver Planning Simulator
// ─────────────────────────────────────────────────────────────

/** Parsed Two-Line Element set */
export interface TLEData {
  line1: string;
  line2: string;
  name: string;
  noradId: number;
  classification: string;
  intlDesignator: string;
  epoch: string;               // ISO timestamp of TLE epoch
  meanMotion: number;          // rev/day
  eccentricity: number;        // dimensionless
  inclination: number;         // degrees
  raan: number;                // Right Ascension of Ascending Node (degrees)
  argPerigee: number;          // Argument of Perigee (degrees)
  meanAnomaly: number;         // degrees
  bstar: number;               // B* drag term
  meanMotionDot: number;       // 1st derivative of mean motion
  meanMotionDDot: number;      // 2nd derivative of mean motion
}

/** ECI (Earth-Centered Inertial) state vector */
export interface ECIState {
  position: { x: number; y: number; z: number };  // km
  velocity: { x: number; y: number; z: number };  // km/s
}

/** Risk classification per PRD §4.4 */
export type RiskLevel = 'green' | 'yellow' | 'red';

/** Satellite object with TLE-derived fields */
export interface Satellite {
  id: string;
  name: string;
  noradId: number;
  objectType: 'satellite' | 'debris' | 'rocket_body';
  owner: string;

  // Current orbital parameters (TLE-derived)
  altitude: number;            // km above Earth surface
  inclination: number;         // degrees
  eccentricity: number;
  period: number;              // orbital period in minutes
  velocity: number;            // orbital velocity in km/s
  longitude: number;           // current sub-satellite longitude (degrees)
  latitude: number;            // current sub-satellite latitude (degrees)

  // Semi-major axis & orbital shell
  semiMajorAxis: number;       // km
  apogee: number;              // km (from Earth center)
  perigee: number;             // km (from Earth center)

  // Risk assessment
  riskLevel: RiskLevel;
  activeConjunctions: number;  // count of active conjunctions

  // TLE metadata
  tleEpoch: string;            // ISO timestamp
  lastUpdated: string;         // ISO timestamp
  tleLine1?: string;
  tleLine2?: string;

  // Satellite.js satrec object (stored separately, not serialized)
  // Fuel is estimated / user-configurable for maneuver planning
  estimatedMassKg: number;     // default 500 kg
  fuelRemainingPct: number;    // estimated fuel remaining %
}

/** Conjunction event — output of Steps 2-4 */
export interface ConjunctionEvent {
  id: string;

  // Objects involved
  primaryId: string;           // satellite ID
  primaryName: string;
  secondaryId: string;         // threat object ID (sat or debris)
  secondaryName: string;

  // Conjunction geometry
  tca: string;                 // Time of Closest Approach (ISO timestamp)
  missDistance: number;         // km at TCA
  missDistanceMeters: number;  // meters at TCA (convenience)
  relativeVelocity: number;    // km/s at TCA

  // Risk assessment (Step 3 & 4)
  pc: number;                  // Collision probability (float, e.g. 1.7e-3)
  pcDisplay: string;           // Human-readable Pc (e.g. "1.7 × 10⁻³")
  riskLevel: RiskLevel;        // GREEN / YELLOW / RED

  // Status
  status: 'active' | 'resolved' | 'dismissed';
  detectedAt: string;          // ISO timestamp

  // Source
  source: 'computed' | 'socrates';  // whether from our pipeline or SOCRATES

  // Lifecycle transitions
  lifecycle?: Array<{
    state: string;
    label: string;
    timestamp: string;
    actor: string;
    details: any;
  }>;
}

/** Maneuver plan — output of Step 5 */
export interface ManeuverPlan {
  id: string;
  conjunctionEventId: string;
  satelliteId: string;

  // Burn parameters
  burnDirection: 'prograde' | 'retrograde' | 'radial-in' | 'radial-out' | 'normal' | 'antinormal';
  deltaV: number;              // m/s
  burnTime: string;            // ISO timestamp — optimal burn time
  burnTimingNote: string;      // human note about timing

  // Results
  currentMissDistance: number;  // km (before maneuver)
  newMissDistance: number;      // km (after maneuver)
  targetMissDistance: number;   // km (target, default 5 km)

  // Fuel estimation (Tsiolkovsky)
  propellantMassKg: number;    // kg
  specificImpulse: number;     // s (default 220)
  satelliteMassKg: number;     // kg (default 500)

  // Status
  status: 'proposed' | 'approved' | 'executed' | 'cancelled';
  createdAt: string;           // ISO timestamp

  // Physics honesty fields from ManeuverOption schema
  cwDivergenceFlag?: boolean;
  secondaryConjunctionWarning?: string | null;
}

/** AI Briefing — output of Feature 4 */
export interface AIBriefing {
  id: string;
  conjunctionEventId: string;
  maneuverPlanId?: string;

  // Structured input data
  context: {
    primaryName: string;
    secondaryName: string;
    missDistanceMeters: number;
    pc: number;
    pcDisplay: string;
    riskLevel: RiskLevel;
    tca: string;
    recommendedDeltaV?: number;
    burnTime?: string;
    fuelCostKg?: number;
    newMissDistance?: number;
  };

  // Generated briefing
  briefingText: string;        // 3-5 sentence plain-language summary
  generatedAt: string;         // ISO timestamp
}

/** Incident log — simplified for v2.0 (internal use only) */
export interface IncidentLog {
  id: string;
  type: string;
  satelliteId?: string;
  conjunctionEventId?: string;
  action: string;
  outcome: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}
