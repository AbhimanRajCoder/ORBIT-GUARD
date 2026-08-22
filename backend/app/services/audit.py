import json
import hashlib
import logging
import asyncio
from datetime import datetime, timezone
from app.models import AuditLogEntry
from app.services.supabase_client import get_supabase

logger = logging.getLogger("triage.audit_service")

GENESIS_HASH = "0" * 64
_write_lock = asyncio.Lock()

def _normalize_payload(obj):
    if isinstance(obj, dict):
        return {k: _normalize_payload(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_normalize_payload(v) for v in obj]
    elif isinstance(obj, float):
        return int(obj) if obj.is_integer() else obj
    return obj

def compute_hash(prev_hash: str, timestamp: str, pillar: int, action: str, candidate_id: str | None, actor: str | None, payload_str: str) -> str:
    """
    Computes a deterministic SHA-256 hash of the entry's serialized fields.
    """
    fields_str = (
        f"{prev_hash}|"
        f"{timestamp}|"
        f"{pillar}|"
        f"{action}|"
        f"{candidate_id or ''}|"
        f"{actor or ''}|"
        f"{payload_str}"
    )
    return hashlib.sha256(fields_str.encode('utf-8')).hexdigest()

async def append_entry(pillar: int, action: str, candidate_id: str | None, actor: str | None, payload: dict) -> AuditLogEntry:
    """
    Computes the hash chain, inserts a new entry into the Supabase audit log,
    and returns an AuditLogEntry model representation.
    
    Uses asyncio.Lock to properly serialize writes within the async event loop,
    preventing hash chain corruption from concurrent request handlers.
    """
    async with _write_lock:
        sb = get_supabase()
        
        # 1. Retrieve the last entry to get the previous hash
        # Use order('id', desc=True) and limit(1)
        response = sb.table("audit_log").select("entry_hash").order("id", desc=True).limit(1).execute()
        prev_hash = response.data[0]["entry_hash"] if response.data else GENESIS_HASH
        
        # 2. Serialize fields
        payload = _normalize_payload(payload)
        timestamp = datetime.now(timezone.utc).isoformat()
        payload_str = json.dumps(payload, sort_keys=True)
        entry_hash = compute_hash(prev_hash, timestamp, pillar, action, candidate_id, actor, payload_str)
        
        # 3. Insert record
        insert_data = {
            "timestamp": timestamp,
            "pillar": pillar,
            "action": action,
            "candidate_id": candidate_id,
            "actor": actor,
            "payload": payload, # Supabase jsonb handles dicts natively
            "prev_hash": prev_hash,
            "entry_hash": entry_hash
        }
        
        insert_response = sb.table("audit_log").insert(insert_data).execute()
        new_row = insert_response.data[0]
        new_id = new_row["id"]
        
        logger.info(f"Audit Trail: Registered entry {new_id} for Pillar {pillar} / {action}. Hash: {entry_hash[:10]}...")
        
        return AuditLogEntry(
            id=new_id,
            timestamp=datetime.fromisoformat(timestamp.replace("Z", "+00:00")),
            pillar=pillar,
            action=action,
            candidate_id=candidate_id,
            actor=actor,
            payload=payload,
            prev_hash=prev_hash,
            entry_hash=entry_hash
        )

def verify_chain() -> tuple[bool, int | None]:
    """
    Traverses the Supabase audit log sequentially and validates the cryptographic
    chain of prev_hash -> entry_hash connections.
    
    Returns:
        (True, None) if the log is secure and valid.
        (False, broken_at_id) if any entry's hash or link has been tampered with.
    """
    sb = get_supabase()
    response = sb.table("audit_log").select("*").order("id").execute()
    rows = response.data
    
    expected_prev_hash = GENESIS_HASH
    
    for row in rows:
        row_id = row["id"]
        # Reconstruct timestamp exactly as Python generated it to restore any trailing zeros
        # Postgres truncates trailing zeros in microseconds, but python's isoformat padded them
        row_timestamp = datetime.fromisoformat(row["timestamp"]).isoformat()
        row_pillar = row["pillar"]
        row_action = row["action"]
        row_candidate_id = row.get("candidate_id")
        row_actor = row.get("actor")
        
        # Ensure we dump exactly how we would have originally to verify
        normalized_row_payload = _normalize_payload(row["payload"])
        row_payload_str = json.dumps(normalized_row_payload, sort_keys=True)
        row_prev_hash = row["prev_hash"]
        row_entry_hash = row["entry_hash"]
        
        # A. Verify prev_hash matches expected parent hash in the chain
        if row_prev_hash != expected_prev_hash:
            logger.warning(
                f"Chain broken at record ID {row_id}: prev_hash mismatch. "
                f"Stored: {row_prev_hash[:10]}..., expected parent: {expected_prev_hash[:10]}..."
            )
            return False, row_id
            
        # B. Verify entry_hash matches recomputed hash from stored fields (tamper detection)
        recomputed = compute_hash(
            row_prev_hash,
            row_timestamp,
            row_pillar,
            row_action,
            row_candidate_id,
            row_actor,
            row_payload_str
        )
        if recomputed != row_entry_hash:
            logger.warning(
                f"Chain broken at record ID {row_id}: cryptographic mismatch. "
                f"Stored entry_hash: {row_entry_hash[:10]}..., recomputed: {recomputed[:10]}..."
            )
            return False, row_id
            
        # Set parent reference for next sequential check
        expected_prev_hash = row_entry_hash
        
    return True, None

def get_all_entries() -> list[AuditLogEntry]:
    """
    Retrieves all audit trail log entries from Supabase.
    """
    sb = get_supabase()
    response = sb.table("audit_log").select("*").order("id").execute()
    
    entries = []
    for r in response.data:
        entries.append(
            AuditLogEntry(
                id=r["id"],
                timestamp=datetime.fromisoformat(r["timestamp"].replace("Z", "+00:00")),
                pillar=r["pillar"],
                action=r["action"],
                candidate_id=r.get("candidate_id"),
                actor=r.get("actor"),
                payload=r["payload"],
                prev_hash=r["prev_hash"],
                entry_hash=r["entry_hash"]
            )
        )
    return entries
