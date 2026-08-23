import os
import json
import time
import logging
from typing import Tuple, List, Dict

from .sources.base import NotYetUpdated
from .sources.celestrak import CelesTrakSource
from .sources.spacetrack import SpaceTrackSource

logger = logging.getLogger("triage.data_fetch")

CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
CACHE_EXPIRY_SECONDS = 2 * 60 * 60  # 2 hours

# Instantiate sources
celestrak_source = CelesTrakSource()
spacetrack_source = SpaceTrackSource()

async def fetch_tle_data(group: str = "active") -> Tuple[List[Dict], str]:
    """
    Fetches TLE data for the specified satellite group.
    Attempts to use cached disk data if it is less than 2 hours old.
    Falls back to CelesTrak, and then Space-Track.
    
    Returns:
        (satellites, source_name)
    """
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_file = os.path.join(CACHE_DIR, f"tle_cache_{group}.json")
    
    cache_exists = os.path.exists(cache_file)
    cached_data = None
    if cache_exists:
        try:
            with open(cache_file, "r") as f:
                cached_data = json.load(f)
            
            source = cached_data.get("source", "cache")
            logger.info(f"Using FORCED local cached TLE data for group '{group}'")
            return cached_data.get("satellites", []), f"cache ({source})"
        except Exception as e:
            logger.warning(f"Error reading cache file {cache_file}: {e}. Will attempt fresh fetch.")
            cached_data = None

    # Cache is either missing, stale, or corrupt. Attempt CelesTrak first.
    try:
        satellites = await celestrak_source.fetch(group)
        source_name = celestrak_source.name
        _save_cache(cache_file, satellites, source_name)
        return satellites, source_name
    except NotYetUpdated:
        # CelesTrak confirmed data hasn't changed. Cache is still valid.
        if cached_data and "satellites" in cached_data:
            logger.info("CelesTrak indicates no new data; refreshing cache timestamp.")
            source_name = celestrak_source.name
            _save_cache(cache_file, cached_data["satellites"], source_name)
            return cached_data["satellites"], f"cache ({source_name} - refreshed)"
        else:
            logger.warning("CelesTrak NotYetUpdated but no valid cache exists. Falling through.")
    except Exception as e:
        logger.warning(f"CelesTrak fetch failed: {e}. Falling back to Space-Track.")

    # CelesTrak failed or returned NotYetUpdated without cache. Attempt Space-Track.
    try:
        satellites = await spacetrack_source.fetch(group)
        source_name = spacetrack_source.name
        _save_cache(cache_file, satellites, source_name)
        return satellites, source_name
    except Exception as e:
        logger.error(f"Space-Track fallback failed: {e}")

    # Both sources failed. Use cache if it exists, even if stale.
    if cached_data and "satellites" in cached_data:
        source = cached_data.get("source", "unknown")
        logger.warning("Both sources failed. Serving stale cache with a loud warning.")
        return cached_data["satellites"], f"stale_cache ({source})"

    raise RuntimeError(f"Failed to retrieve TLE data for group '{group}' from any source and no cache available.")

def _save_cache(cache_file: str, satellites: List[Dict], source: str):
    try:
        cache_payload = {
            "timestamp": time.time(),
            "source": source,
            "satellites": satellites
        }
        with open(cache_file, "w") as f:
            json.dump(cache_payload, f, indent=2)
        logger.info(f"Successfully cached {len(satellites)} satellites (source: {source})")
    except Exception as e:
        logger.error(f"Failed to write cache file {cache_file}: {e}")
