from abc import ABC, abstractmethod

class NotYetUpdated(Exception):
    """
    Exception raised when a TLE source indicates that new data is not yet available,
    meaning the previous cached data is still the most current.
    """
    pass

class TLESource(ABC):
    """
    Abstract interface for fetching TLE (Two-Line Element) orbital data.
    """
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Return the name of the source (e.g. 'celestrak', 'spacetrack')."""
        pass

    @abstractmethod
    async def fetch(self, group: str) -> list[dict]:
        """
        Fetch TLE data for a given satellite group.
        
        Args:
            group: The group identifier (e.g. 'active', 'stations').
            
        Returns:
            A list of dictionaries, each containing:
            {
                "name": str,
                "norad_id": str,
                "line1": str,
                "line2": str
            }
            
        Raises:
            NotYetUpdated: If the source explicitly indicates data hasn't changed.
            Exception: On network or parsing errors.
        """
        pass
