from datetime import datetime, timezone
from collections import defaultdict
from app.models import Alert
from app.services.supabase_client import get_supabase

def populate_alerts_lifecycle(alerts: list[Alert]) -> list[Alert]:
    """
    Retrieves audit logs associated with the candidate_ids of the given alerts,
    reconstructs their lifecycles, and attaches them to the alerts.
    Uses a single optimized database query for bulk efficiency.
    """
    if not alerts:
        return alerts

    candidate_ids = [a.candidate_id for a in alerts]
    sb = get_supabase()
    
    try:
        # Fetch all audit log entries matching candidate_ids, ordered sequentially
        response = sb.table("audit_log").select("*").in_("candidate_id", candidate_ids).order("id").execute()
        logs_by_candidate = defaultdict(list)
        for log in response.data or []:
            c_id = log.get("candidate_id")
            if c_id:
                logs_by_candidate[c_id].append(log)
    except Exception as e:
        # Graceful degradation in case of network or database issues
        import logging
        logging.getLogger("triage.lifecycle").error(f"Error fetching audit logs for lifecycle: {e}")
        logs_by_candidate = defaultdict(list)

    for alert in alerts:
        alert.lifecycle = build_lifecycle(alert, logs_by_candidate[alert.candidate_id])
    
    return alerts

def build_lifecycle(alert: Alert, logs: list[dict]) -> list[dict]:
    """
    Assembles a chronological timeline of lifecycle events for a specific alert.
    """
    # 1. Start with DETECTED milestone (alert creation)
    events = [
        {
            "state": "detected",
            "label": "Conjunction Threat Detected",
            "timestamp": alert.created_at.isoformat() if alert.created_at else datetime.now(timezone.utc).isoformat(),
            "actor": "system",
            "details": {
                "risk_score": alert.risk_score,
                "min_distance_km": alert.min_distance_km
            }
        }
    ]

    # Helper to parse dates to ISO strings consistently
    def to_iso(val):
        if not val:
            return None
        if isinstance(val, str):
            return val
        if isinstance(val, datetime):
            return val.isoformat()
        return str(val)

    # 2. Iterate through audit log actions to reconstruct transition timeline
    for log in logs:
        action = log.get("action")
        timestamp = to_iso(log.get("timestamp"))
        payload = log.get("payload") or {}
        actor = log.get("actor") or "system"

        if action == "explanation_generated":
            events.append({
                "state": "explained",
                "label": "AI Risk Analysis Generated",
                "timestamp": timestamp,
                "actor": actor,
                "details": {
                    "source": payload.get("source"),
                    "explanation_preview": (payload.get("explanation")[:120] + "...") if payload.get("explanation") else None
                }
            })
        elif action == "maneuver_options_generated":
            events.append({
                "state": "maneuvers_calculated",
                "label": "Avoidance Maneuvers Computed",
                "timestamp": timestamp,
                "actor": actor,
                "details": {
                    "options_count": len(payload.get("options", []))
                }
            })
        elif action == "comparison_ranked":
            events.append({
                "state": "tradeoff_ranked",
                "label": "Trade-off Assessment Completed",
                "timestamp": timestamp,
                "actor": actor,
                "details": {
                    "recommended_option_id": payload.get("recommended_option_id"),
                    "reasoning": payload.get("reasoning")
                }
            })
        elif action == "visualization_requested":
            events.append({
                "state": "visualized",
                "label": "3D Flight Path Rendered",
                "timestamp": timestamp,
                "actor": actor,
                "details": {
                    "window_hours": payload.get("window_hours"),
                    "step_seconds": payload.get("step_seconds")
                }
            })
        elif action == "approval_granted":
            events.append({
                "state": "approved",
                "label": "Maneuver Approved for Execution",
                "timestamp": timestamp,
                "actor": actor,
                "details": {
                    "chosen_option_id": payload.get("request", {}).get("chosen_option_id"),
                    "operator_role": payload.get("request", {}).get("operator_role"),
                    "delta_v_ms": payload.get("snapshot_delta_v_ms"),
                    "fuel_cost_kg": payload.get("snapshot_fuel_cost_kg")
                }
            })
        elif action == "approval_rejected":
            events.append({
                "state": "rejected",
                "label": "Maneuver Authorization Refused",
                "timestamp": timestamp,
                "actor": actor,
                "details": {
                    "reason": payload.get("reason"),
                    "operator_role": payload.get("request", {}).get("operator_role")
                }
            })

    return events
