import os
import time
import httpx
import logging
import asyncio
from typing import List, Dict

from .base import TLESource

logger = logging.getLogger("triage.sources.spacetrack")

class RateLimiter:
    def __init__(self, requests_per_second: float):
        self.interval = 1.0 / requests_per_second
        self.last_request = 0.0
        self.lock = asyncio.Lock()
        
    async def acquire(self):
        async with self.lock:
            now = time.time()
            elapsed = now - self.last_request
            if elapsed < self.interval:
                await asyncio.sleep(self.interval - elapsed)
            self.last_request = time.time()

class SpaceTrackSource(TLESource):
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=60.0)
        self.authenticated = False
        # Limit to 1 request per 2 seconds (0.5 req/s)
        self.rate_limiter = RateLimiter(0.5)

    @property
    def name(self) -> str:
        return "spacetrack"
        
    async def _authenticate(self):
        user = os.getenv("SPACETRACK_USER")
        password = os.getenv("SPACETRACK_PASS")
        
        if not user or not password:
            raise ValueError("SPACETRACK_USER and SPACETRACK_PASS environment variables must be set")
            
        login_url = "https://www.space-track.org/ajaxauth/login"
        data = {
            "identity": user,
            "password": password
        }
        
        logger.info("Authenticating with Space-Track...")
        await self.rate_limiter.acquire()
        resp = await self.client.post(login_url, data=data)
        
        # Space-Track returns 200 on successful login and sets spacetrack_session cookie
        if resp.status_code != 200 or 'spacetrack_session_443' not in self.client.cookies and 'spacetrack_session' not in self.client.cookies:
            # Note: The cookie might be named slightly differently, let's just check status and existence of cookies
            if resp.status_code != 200 or not self.client.cookies:
                raise Exception(f"Space-Track authentication failed: {resp.text}")
            
        self.authenticated = True
        logger.info("Space-Track authentication successful.")

    async def fetch(self, group: str) -> List[Dict]:
        if not self.authenticated:
            await self._authenticate()
            
        # Using EPOCH > now-3 for active data
        url = "https://www.space-track.org/basicspacedata/query/class/gp/DECAY_DATE/null-val/EPOCH/%3Enow-3/orderby/NORAD_CAT_ID/format/tle"
        
        logger.info("Fetching TLE data from Space-Track...")
        await self.rate_limiter.acquire()
        resp = await self.client.get(url)
        
        if resp.status_code == 401:
            logger.info("Space-Track session expired, re-authenticating...")
            self.authenticated = False
            await self._authenticate()
            await self.rate_limiter.acquire()
            resp = await self.client.get(url)
            
        resp.raise_for_status()
        
        lines = [line.strip() for line in resp.text.splitlines() if line.strip()]
        
        satellites = []
        for i in range(0, len(lines) - 2, 3):
            name = lines[i]
            line1 = lines[i+1]
            line2 = lines[i+2]
            
            if len(line1) >= 7:
                norad_id = line1[2:7].strip()
                satellites.append({
                    "name": name,
                    "norad_id": norad_id,
                    "line1": line1,
                    "line2": line2
                })
                
        if not satellites:
            raise ValueError("No satellites successfully parsed from Space-Track data.")
            
        return satellites
