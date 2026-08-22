import httpx
import logging
from typing import List, Dict

from .base import TLESource, NotYetUpdated

logger = logging.getLogger("triage.sources.celestrak")

class CelesTrakSource(TLESource):
    @property
    def name(self) -> str:
        return "celestrak"

    async def fetch(self, group: str) -> List[Dict]:
        url = f"https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=tle"
        logger.info(f"Fetching TLE data from {url}")
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OrbitGuard/1.0"
        }
        
        async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
            response = await client.get(url)
            response.raise_for_status()
            
        text = response.text
        
        # Check for the specific "has not updated since" message
        if "has not updated since" in text or "Data is updated once every" in text:
            raise NotYetUpdated("CelesTrak indicates data has not updated yet.")
            
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        
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
            raise ValueError("No satellites successfully parsed from CelesTrak data.")
            
        return satellites
