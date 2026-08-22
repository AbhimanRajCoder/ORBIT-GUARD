from datetime import datetime
from pydantic import BaseModel, Field, field_validator

class ConjunctionCandidate(BaseModel):
    """
    Represents a candidate object identified as a potential conjunction threat.
    """
    object_name: str = Field(..., description="The name of the candidate satellite or space debris object")
    norad_id: str = Field(..., description="The NORAD Catalog Number of the candidate object")
    min_distance_km: float = Field(..., description="The minimum Euclidean distance at closest approach in kilometers")
    time_of_closest_approach: datetime = Field(..., description="The UTC time of closest approach")

class ManeuverOption(BaseModel):
    """
    Represents a specific collision avoidance maneuver option calculated via
    Clohessy-Wiltshire relative-motion targeting.
    """
    option_id: str = Field(..., description="Unique identifier for this maneuver option")
    label: str = Field(..., description="Maneuver scale label: 'small burn', 'medium burn', or 'large burn'")
    delta_v_ms: float = Field(..., description="Delta-V impulse magnitude required in meters per second (m/s)")
    fuel_cost_kg: float = Field(..., description="Propellant mass consumed in kilograms (via Tsiolkovsky rocket equation)")
    resulting_min_distance_km: float = Field(..., description="Actual minimum separation distance in km achieved after closed-loop propagation")
    resulting_distance_cw: float = Field(..., description="Targeted separation distance calculated via linear Clohessy-Wiltshire dynamics (km)")
    resulting_distance_sgp4: float = Field(..., description="Actual separation distance calculated via full nonlinear Keplerian/SGP4 orbit propagation (km)")
    cw_divergence_flag: bool = Field(default=False, description="Flag indicating whether linear CW prediction diverges >10% from full nonlinear SGP4 propagation")
    burn_direction: list[float] = Field(..., description="Unit vector [radial, in-track, cross-track] of the burn in Hill frame")
    time_to_burn_execution_s: float = Field(..., description="Time before closest approach when burn is applied, in seconds")
    secondary_conjunction_warning: str | None = Field(default=None, description="Warning if this maneuver induces a conjunction with another tracked catalog object")

class Alert(BaseModel):
    """
    Represents a ranked and scored risk alert for a conjunction event.
    """
    protected_asset_id: str = Field(..., description="NORAD Catalog Number of the protected asset")
    candidate_name: str = Field(..., description="The name of the candidate threat object")
    candidate_id: str = Field(..., description="The NORAD Catalog Number of the candidate threat object")
    min_distance_km: float = Field(..., description="The minimum Euclidean distance at closest approach in kilometers")
    time_of_closest_approach: datetime = Field(..., description="The UTC time of closest approach")
    risk_score: float = Field(..., description="The normalized risk score (0 to 100)")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="The UTC timestamp when this alert was created")

    # Extended fields for Pillar 2 (Risk Explanation)
    mission_priority: float = Field(default=1.0, description="The mission priority multiplier used to score this alert")
    explanation: str | None = Field(default=None, description="Plain-language explanation of the conjunction risk")
    explanation_source: str | None = Field(default=None, description="The provider that generated this explanation (e.g., 'gemini', 'groq')")
    explanation_generated_at: datetime | None = Field(default=None, description="The UTC timestamp when the explanation was generated")
    candidate_tle_epoch: datetime | None = Field(default=None, description="The epoch of the candidate satellite TLE")

    # Extended fields for Pillar 3 (Maneuver Generation)
    maneuver_options: list[ManeuverOption] | None = Field(default=None, description="Available collision avoidance maneuver options")
    approval_status: str = Field(default="pending", description="Decision status of this alert ('pending', 'approved', 'rejected')")
    lifecycle: list[dict] | None = Field(default=None, description="Verifiable alert state transition timeline")

class RefreshRequest(BaseModel):
    """
    Schema for POST /triage/refresh request body.
    """
    protected_asset_ids: list[str] = Field(
        ...,
        description="List of NORAD Catalog Numbers of protected assets to run screening against (e.g., ['25544'])"
    )
    satellite_group: str = Field(
        default="active",
        description="The CelesTrak GP/TLE satellite group (e.g., 'active', 'stations')"
    )
    distance_threshold_km: float = Field(
        default=5.0,
        ge=0.0,
        description="The minimum distance threshold in kilometers to flag a conjunction candidate"
    )
    mission_priority: float = Field(
        default=1.0,
        gt=0.0,
        description="Mission priority multiplier (default 1.0) to adjust the risk score"
    )

    @field_validator("satellite_group")
    @classmethod
    def validate_satellite_group(cls, v: str) -> str:
        valid_groups = {
            "active", "stations", "tle-new", "weather", "noaa", "goes", 
            "resource", "sarsat", "disaster", "tracking", "iridium", 
            "orbcomm", "globalstar", "amateur", "cubesat", "other",
            "gps-ops", "glo-ops", "galileo", "beidou", "sbas", "nnss", 
            "musson", "science", "geodetic", "engineering", "education", 
            "military", "radar", "cube-all"
        }
        if v.lower() not in valid_groups:
            raise ValueError(f"Invalid satellite group. Must be one of: {', '.join(sorted(valid_groups))}")
        return v.lower()

class RefreshResponse(BaseModel):
    """
    Schema for POST /triage/refresh response.
    """
    source: str = Field(..., description="The source of the TLE data (e.g., 'celestrak', 'spacetrack', 'cache')")
    alerts: list[Alert] = Field(..., description="Ranked list of conjunction alerts")

class RankedOption(BaseModel):
    """
    Represents a scored and ranked maneuver option.
    """
    option_id: str = Field(..., description="Unique identifier of the maneuver option")
    label: str = Field(..., description="Maneuver scale label")
    composite_score: float = Field(..., description="Composite ranking score (0 to 100)")

class RankedComparison(BaseModel):
    """
    Schema for Pillar 4 Trade-off Comparison response.
    """
    candidate_id: str = Field(..., description="NORAD Catalog Number of the candidate threat object")
    ranked_options: list[RankedOption] = Field(..., description="List of maneuver options sorted by composite score descending")
    recommended_option_id: str | None = Field(..., description="The ID of the recommended maneuver option, or None if all are disqualified")
    reasoning: str = Field(..., description="Detailed explanation of the ranking and recommendation")

class TrajectoryPoint(BaseModel):
    """
    Represents a single sampled point in a satellite path in ECEF frame.
    """
    t: datetime = Field(..., description="The UTC timestamp of this sampled point")
    position_ecef_km: list[float] = Field(..., description="The ECEF position vector [x, y, z] in km")
    position_teme_km: list[float] | None = Field(default=None, description="The TEME position vector [x, y, z] in km")

class DangerZone(BaseModel):
    """
    Represents the danger zone envelope at TCA.
    """
    center_ecef_km: list[float] = Field(..., description="The ECEF coordinate center [x, y, z] in km at TCA")
    radius_km: float = Field(..., description="The collision safety boundary radius in km")

class VisualizationData(BaseModel):
    """
    Schema for Pillar 5 Trajectory Sampling response.
    """
    candidate_id: str = Field(..., description="NORAD Catalog Number of the candidate threat object")
    protected_asset_path: list[TrajectoryPoint] = Field(..., description="Nominal path of the protected asset")
    candidate_path: list[TrajectoryPoint] = Field(..., description="Nominal path of the candidate object")
    maneuver_path: list[TrajectoryPoint] | None = Field(..., description="Post-burn path of the protected asset (using recommended option)")
    danger_zone: DangerZone = Field(..., description="Conjunction collision danger zone centered at TCA")
    earth_radius_km: float = Field(default=6378.137, description="WGS-84 Earth equatorial radius in km")
    frame: str = Field(default="ECEF", description="Reference frame of coordinates")
    units: str = Field(default="km", description="Coordinate units")

class ApprovalRequest(BaseModel):
    """
    Schema for POST /approve request body.
    """
    candidate_id: str = Field(..., description="NORAD Catalog Number of the candidate threat object")
    chosen_option_id: str = Field(..., description="The ID of the maneuver option chosen for approval")
    approved_by: str = Field(..., description="Identifier of the authorizing operator")
    operator_role: str = Field(..., description="Role clearance level of the operator ('junior' or 'senior')")
    confirmation_token: str = Field(..., description="Short-lived token generated during preview")

class ApprovalRecord(BaseModel):
    """
    Schema for registered maneuver approval.
    """
    candidate_id: str = Field(..., description="NORAD Catalog Number of the candidate threat object")
    chosen_option_id: str = Field(..., description="The ID of the approved maneuver option")
    approved_by: str = Field(..., description="Identifier of the authorizing operator")
    operator_role: str = Field(..., description="Role clearance level of the operator")
    confirmation_token: str = Field(..., description="Confirmation token used for validation")
    approved_at: datetime = Field(..., description="The UTC timestamp when approval was registered")
    status: str = Field(default="approved", description="The registered status of this approval ('approved')")
    delta_v_ms: float = Field(..., description="Snapshot delta-V magnitude (m/s)")
    fuel_cost_kg: float = Field(..., description="Snapshot fuel mass consumed (kg)")

class PreviewResponse(BaseModel):
    """
    Schema for GET /approve/{candidate_id}/preview response.
    """
    candidate_id: str = Field(..., description="NORAD Catalog Number of the candidate threat object")
    option_id: str = Field(..., description="The ID of the maneuver option being previewed")
    label: str = Field(..., description="Label of the maneuver option ('small burn', 'medium burn', 'large burn')")
    delta_v_ms: float = Field(..., description="Delta-V impulse required in m/s")
    fuel_cost_kg: float = Field(..., description="Propellant mass consumed in kg")
    confirmation_token: str = Field(..., description="Short-lived authorization confirmation token")
    token_expiry: datetime = Field(..., description="UTC timestamp when confirmation token expires")

class AuditLogEntry(BaseModel):
    """
    Schema for sequential, tamper-evident audit trail records.
    """
    id: int = Field(..., description="Sequential primary key ID of this log entry")
    timestamp: datetime = Field(..., description="UTC timestamp when the log entry was created")
    pillar: int = Field(..., description="Pillar number (1-7) related to this action")
    action: str = Field(..., description="Specific action description (e.g. 'triage_refresh')")
    candidate_id: str | None = Field(default=None, description="NORAD Catalog ID of the candidate if applicable")
    actor: str | None = Field(default=None, description="Initiator of the action ('system' or operator ID)")
    payload: dict = Field(..., description="Input/Output details and context parameters of the step")
    prev_hash: str = Field(..., description="SHA-256 hash of the previous sequential log entry")
    entry_hash: str = Field(..., description="SHA-256 hash of this entry's serialized fields")
