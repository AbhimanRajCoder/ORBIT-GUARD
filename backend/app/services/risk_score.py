from datetime import datetime, timezone
from app.models import ConjunctionCandidate

def calculate_risk_score(
    candidate: ConjunctionCandidate,
    threshold_km: float = 5.0,
    mission_priority: float = 1.0
) -> float:
    """
    Computes a normalized risk score from 0 (lowest risk) to 100 (highest risk)
    based on:
    1. Miss Distance (closer = higher risk)
    2. Time to Closest Approach (sooner = higher risk, within 48 hour window)
    3. Mission Priority (placeholder multiplier, default 1.0, overridable)
    
    Weights:
    - Miss Distance: 70%
    - Time to Closest Approach: 30%
    """
    now = datetime.now(timezone.utc)
    
    # 1. Distance Factor (0 to 1): closer = higher risk
    # If distance is 0, factor is 1.0. If distance >= threshold, factor is 0.0
    if candidate.min_distance_km <= 0.0:
        distance_factor = 1.0
    elif candidate.min_distance_km >= threshold_km:
        distance_factor = 0.0
    else:
        distance_factor = 1.0 - (candidate.min_distance_km / threshold_km)
        
    # 2. Time Factor (0 to 1): sooner = higher risk
    # Based on a 48-hour screening window.
    # If the approach is immediate (0 hours), factor is 1.0.
    # If it is at the 48-hour boundary, factor is 0.0.
    time_diff = candidate.time_of_closest_approach - now
    time_diff_hours = time_diff.total_seconds() / 3600.0
    
    # Clamp hours between 0 and 48
    hours = max(0.0, min(48.0, time_diff_hours))
    time_factor = 1.0 - (hours / 48.0)
    
    # 3. Combine factors with weights
    # Weighted base score from 0 to 100
    base_score = (distance_factor * 0.7 + time_factor * 0.3) * 100.0
    
    # Apply mission priority multiplier
    raw_score = base_score * mission_priority
    
    # Clamp final score between 0.0 and 100.0
    final_score = max(0.0, min(100.0, raw_score))
    
    return round(final_score, 2)
