"""
Singleton Supabase client for OrbitGuard.
All services import from here to get a single, configured client instance.
"""
import os
import logging
from supabase import create_client, Client

logger = logging.getLogger("triage.supabase_client")

_client: Client | None = None

def get_supabase() -> Client:
    """Returns the singleton Supabase client, initializing on first call.
    
    Prefers the service_role key (SUPABASE_SERVICE_KEY) which bypasses
    Row Level Security policies. Falls back to the anon key (SUPABASE_KEY)
    if the service key is not set.
    """
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        # Prefer service_role key to bypass RLS for backend operations
        key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_KEY) must be set "
                "in environment variables. Add them to your .env file."
            )
        _client = create_client(url, key)
        role = "service_role" if os.getenv("SUPABASE_SERVICE_KEY") else "anon"
        logger.info(f"Supabase client initialized for {url} (role: {role})")
    return _client
