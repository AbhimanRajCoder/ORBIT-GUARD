import re
import logging
from typing import List
from app.models import ManeuverOption, RankedOption, RankedComparison

logger = logging.getLogger("triage.tradeoff")

# Auditable trade-off ranking weights
SAFETY_WEIGHT = 0.40             # Weight for relative separation gain
FUEL_WEIGHT = 0.30               # Weight for inverse fuel consumption efficiency
SECONDARY_RISK_WEIGHT = 0.30     # Weight for avoiding secondary conjunctions

# Regex to parse the minimum distance from the secondary conjunction warning
DISTANCE_REGEX = re.compile(r'minimum distance (\d+(?:\.\d+)?) km')

def parse_secondary_distance(warning: str | None) -> float | None:
    """
    Parses secondary conjunction warning message to extract the minimum approach distance.
    """
    if not warning:
        return None
    match = DISTANCE_REGEX.search(warning)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return None

def rank_options(
    options: List[ManeuverOption],
    original_min_distance_km: float
) -> RankedComparison:
    """
    Ranks the calculated maneuver options using a weighted composite score and
    recommends the optimal choice.
    
    Safety Critical Override:
    If a maneuver option creates a secondary conjunction closer than the original
    threat separation, it is critically penalized (score = 0.0) and disqualified
    from being recommended.
    """
    if not options:
        logger.warning("No options provided to rank_options.")
        return RankedComparison(
            candidate_id="",
            ranked_options=[],
            recommended_option_id=None,
            reasoning="No maneuver options provided for trade-off comparison."
        )
        
    # Extract candidate ID from option_id (e.g. 'mnv_45701_1' -> '45701')
    candidate_id = ""
    first_opt = options[0]
    if "_" in first_opt.option_id:
        parts = first_opt.option_id.split("_")
        if len(parts) >= 2:
            candidate_id = parts[1]
            
    # Pre-extract fuel costs for normalization
    fuel_costs = [opt.fuel_cost_kg for opt in options]
    f_max = max(fuel_costs)
    f_min = min(fuel_costs)
    
    ranked_list: List[RankedOption] = []
    disqualified_options: List[tuple] = []
    option_details = {opt.option_id: opt for opt in options}
    
    for opt in options:
        # 1. Safety Score: normalized relative to a nominal safe envelope of 50 km
        safety_score = min(1.0, opt.resulting_distance_sgp4 / 50.0)
        
        # 2. Fuel Efficiency Score: inverse of fuel cost normalized across the compared options
        if f_max > f_min:
            fuel_score = (f_max - opt.fuel_cost_kg) / (f_max - f_min)
        else:
            fuel_score = 1.0
            
        # 3. Secondary Risk Score
        d_sec = parse_secondary_distance(opt.secondary_conjunction_warning)
        
        is_critical = False
        if d_sec is not None:
            if d_sec <= original_min_distance_km:
                is_critical = True
                secondary_score = 0.0
            else:
                # Proximity penalty: scaled ratio of original threat separation to new secondary distance
                penalty = original_min_distance_km / d_sec
                secondary_score = 1.0 - penalty
        else:
            secondary_score = 1.0
            
        if is_critical:
            composite_score = 0.0
            disqualified_options.append((opt, d_sec))
        else:
            composite_score = (
                SAFETY_WEIGHT * safety_score +
                FUEL_WEIGHT * fuel_score +
                SECONDARY_RISK_WEIGHT * secondary_score
            ) * 100.0
            
        ranked_list.append(
            RankedOption(
                option_id=opt.option_id,
                label=opt.label,
                composite_score=round(composite_score, 2)
            )
        )
        
    # Sort options by composite score descending
    ranked_list.sort(key=lambda x: x.composite_score, reverse=True)
    
    # Recommend the top non-disqualified option (composite_score > 0.0)
    recommended = None
    for ro in ranked_list:
        if ro.composite_score > 0.0:
            recommended = ro
            break
            
    recommended_id = recommended.option_id if recommended else None
    
    # Build detailed reasoning string with actual parameters
    reasoning_parts = []
    
    if recommended:
        rec_opt = option_details[recommended.option_id]
        reasoning_parts.append(
            f"Maneuver option '{recommended.label}' ({recommended.option_id}) is recommended with a composite score of {recommended.composite_score:.1f}/100. "
            f"It requires a Delta-V of {rec_opt.delta_v_ms:.3f} m/s, consuming {rec_opt.fuel_cost_kg:.4f} kg of fuel, "
            f"and increases the closest approach separation to {rec_opt.resulting_distance_sgp4:.3f} km."
        )
    else:
        reasoning_parts.append(
            "No maneuver option is recommended because all available options were disqualified "
            f"due to critical secondary conjunction violations closer than the original threat distance of {original_min_distance_km:.2f} km."
        )
        
    # Detail disqualified options
    if disqualified_options:
        dq_strings = []
        for opt, d_sec in disqualified_options:
            dq_strings.append(
                f"Option '{opt.label}' ({opt.option_id}) achieved {opt.resulting_distance_sgp4:.3f} km separation "
                f"but was disqualified because it creates a secondary conjunction with a minimum distance of {d_sec:.2f} km, "
                f"which is closer than the original threat separation of {original_min_distance_km:.2f} km."
            )
        reasoning_parts.append(" ".join(dq_strings))
        
    # Detail other qualified options
    qualified_others = [ro for ro in ranked_list if ro.composite_score > 0.0 and ro.option_id != recommended_id]
    if qualified_others:
        others_strings = []
        for ro in qualified_others:
            opt = option_details[ro.option_id]
            d_sec = parse_secondary_distance(opt.secondary_conjunction_warning)
            warning_note = ""
            if d_sec:
                warning_note = f" (incurring a secondary conjunction risk of {d_sec:.2f} km)"
            others_strings.append(
                f"Option '{opt.label}' was ranked lower with a score of {ro.composite_score:.1f}/100, "
                f"providing {opt.resulting_distance_sgp4:.3f} km of separation for {opt.fuel_cost_kg:.4f} kg of fuel{warning_note}."
            )
        reasoning_parts.append(" ".join(others_strings))
        
    reasoning_str = " ".join(reasoning_parts)
    logger.info(f"Completed trade-off ranking for candidate {candidate_id}. Recommended: {recommended_id}")
    
    return RankedComparison(
        candidate_id=candidate_id,
        ranked_options=ranked_list,
        recommended_option_id=recommended_id,
        reasoning=reasoning_str
    )
