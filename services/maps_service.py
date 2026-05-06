import logging
import json
import ssl
import urllib.request
import urllib.parse
import urllib.error
from typing import Dict, Any, List
from core.config import settings

logger = logging.getLogger("smart_traffic")


def _make_ssl_context(verified: bool = True) -> ssl.SSLContext:
    """
    Return an SSL context. 
    verified=True  → standard context (tries Windows cert store).
    verified=False → unverified context for college/corporate SSL inspection networks.
    """
    if verified:
        ctx = ssl.create_default_context()
        try:
            ctx.load_default_certs(ssl.Purpose.SERVER_AUTH)
        except Exception:
            pass
        return ctx
    else:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx


def _safe_urlopen(req: urllib.request.Request) -> any:
    """
    Open a URL, automatically falling back to unverified SSL if the college/
    corporate network's SSL inspection certificate is not trusted by Python.
    """
    try:
        return urllib.request.urlopen(req, context=_make_ssl_context(verified=True))
    except urllib.error.URLError as e:
        reason = str(getattr(e, "reason", e))
        if "CERTIFICATE_VERIFY_FAILED" in reason or "SSL" in reason.upper():
            logger.warning(
                "SSL verification failed (likely college/corporate SSL inspection). "
                "Retrying without SSL verification — this is fine for development."
            )
            return urllib.request.urlopen(req, context=_make_ssl_context(verified=False))
        raise  # re-raise non-SSL URLErrors



class MapsService:
    def __init__(self):
        self.api_key = settings.ORS_API_KEY
        self.tomtom_key = settings.TOMTOM_API_KEY
        self.geocode_url = "https://api.openrouteservice.org/geocode/search"
        self.tomtom_url = "https://api.tomtom.com/routing/1/calculateRoute"

    # ------------------------------------------------------------------
    # Geocoding helper
    # ------------------------------------------------------------------
    def _geocode_destination(self, destination: str, origin_lat: float = None, origin_lng: float = None) -> list:
        """Return [lng, lat] for the given destination string (or coordinate pair)."""
        # Accept "lat,lng" shorthand directly
        try:
            parts = [p.strip() for p in destination.split(",")]
            if len(parts) == 2:
                lat = float(parts[0])
                lng = float(parts[1])
                return [lng, lat]
        except ValueError:
            pass

        if not self.tomtom_key or self.tomtom_key in ("", "your_key_here"):
            raise ValueError("TomTom API key is not configured for geocoding.")

        # TomTom Search API parameters
        params = {
            "key": self.tomtom_key,
            "limit": 1
        }
        
        # Bias the search around the origin if provided (soft bias without strict radius)
        if origin_lat is not None and origin_lng is not None:
            params["lat"] = origin_lat
            params["lon"] = origin_lng

        # Encode the query
        query = urllib.parse.quote(destination)
        url = f"https://api.tomtom.com/search/2/search/{query}.json?{urllib.parse.urlencode(params)}"

        try:
            req = urllib.request.Request(url)
            with _safe_urlopen(req) as response:
                data = json.loads(response.read().decode("utf-8"))

            results = data.get("results", [])
            if not results:
                raise ValueError(f"No location found for the given destination: '{destination}'.")

            # TomTom returns position as {lat, lon}
            pos = results[0]["position"]
            return [pos["lon"], pos["lat"]]

        except urllib.error.HTTPError as e:
            body_err = e.read().decode("utf-8", errors="replace")
            logger.error(f"TomTom Search API HTTP {e.code}: {body_err}")
            raise ValueError(f"TomTom Geocoding API returned HTTP {e.code}: {body_err}")
        except urllib.error.URLError as e:
            reason = str(e.reason) if hasattr(e, 'reason') else str(e)
            logger.error(f"TomTom Search API network error — reason: {reason}")
            raise ValueError(f"Network error reaching TomTom API: {reason}. Check internet connection or firewall.")
        except json.JSONDecodeError:
            logger.error("Failed to parse response from Geocoding API.")
            raise ValueError("Invalid response from Geocoding API.")

    # ------------------------------------------------------------------
    # Single-route extraction helper
    # ------------------------------------------------------------------
    @staticmethod
    def _extract_tomtom_route(route_data: dict, route_id: int, start_lat: float, start_lng: float,
                              end_lat: float, end_lng: float) -> Dict[str, Any]:
        """Convert a TomTom route dictionary into our internal route dict."""
        summary = route_data["summary"]
        distance_km = round(summary.get("lengthInMeters", 0) / 1000.0, 2)
        duration_min = round(summary.get("travelTimeInSeconds", 0) / 60.0, 2)
        
        # TomTom's "trafficDelayInSeconds" often only reports major incidents. 
        # To get the true live congestion delay, we compare actual travel time to free-flow time.
        travel_time = summary.get("travelTimeInSeconds", 0)
        no_traffic_time = summary.get("noTrafficTravelTimeInSeconds", travel_time)
        actual_delay_sec = max(0, travel_time - no_traffic_time)
        traffic_delay_min = round(actual_delay_sec / 60.0, 2)

        # TomTom points are {"latitude": lat, "longitude": lng}
        geometry = []
        for leg in route_data.get("legs", []):
            for pt in leg.get("points", []):
                geometry.append([pt["longitude"], pt["latitude"]])

        instructions = []
        guidance = route_data.get("guidance", {})
        for inst in guidance.get("instructions", []):
            pt = inst.get("point", {})
            instructions.append({
                "message": inst.get("message", ""),
                "lat": pt.get("latitude"),
                "lng": pt.get("longitude"),
                "distance": inst.get("routeOffsetInMeters", 0)
            })

        return {
            "route_id": route_id,
            "distance": float(distance_km),
            "duration": float(duration_min),
            "traffic_delay": float(traffic_delay_min),
            "geometry": geometry,
            "instructions": instructions,
            "start_location": {"lat": start_lat, "lng": start_lng},
            "end_location": {"lat": end_lat, "lng": end_lng},
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def get_route_options(
        self,
        origin_lat: float,
        origin_lng: float,
        destination: str,
        max_routes: int = 3,
        travel_mode: str = "car",
    ) -> List[Dict[str, Any]]:
        """
        Fetches up to *max_routes* driving route options from ORS.

        ORS supports alternative routes via the POST /geojson endpoint with
        the ``alternative_routes`` options block.  Free-tier keys receive at
        most 3 alternatives; we cap at *max_routes* (default 3).

        Returns a list of route dicts, each containing:
            route_id, distance, duration, traffic_delay, geometry,
            start_location, end_location
        """
        if not self.tomtom_key or self.tomtom_key in ("", "your_key_here"):
            logger.error("TomTom API key is missing. Cannot fetch real-time traffic.")
            raise ValueError("TomTom API key is not configured for real-time traffic.")

        end_lng, end_lat = self._geocode_destination(destination, origin_lat, origin_lng)
        start_lng, start_lat = origin_lng, origin_lat

        # TomTom requires lat,lng:lat,lng
        locations = f"{start_lat},{start_lng}:{end_lat},{end_lng}"
        
        params = {
            "key": self.tomtom_key,
            "maxAlternatives": max_routes - 1,  # 2 alternatives + 1 main = 3 total routes
            "computeTravelTimeFor": "all",
            "traffic": "true" if travel_mode == "car" else "false",
            "instructionsType": "text",
            "language": "en-US",
            "travelMode": travel_mode
        }
        
        query_string = urllib.parse.urlencode(params)
        url = f"{self.tomtom_url}/{locations}/json?{query_string}"

        try:
            req = urllib.request.Request(url)
            with _safe_urlopen(req) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body_err = e.read().decode("utf-8", errors="replace")
            logger.error(f"TomTom HTTP {e.code}: {body_err}")
            raise ValueError(f"TomTom API returned HTTP {e.code}: {body_err}")
        except urllib.error.URLError as e:
            reason = str(e.reason) if hasattr(e, 'reason') else str(e)
            logger.error(f"TomTom API network error — reason: {reason}")
            raise ValueError(f"Network error reaching TomTom API: {reason}. Check internet/firewall.")
        except json.JSONDecodeError:
            logger.error("Failed to parse response from TomTom API.")
            raise ValueError("Invalid response from TomTom API.")
        except Exception as e:
            logger.error(f"Unexpected error in maps service: {e}")
            raise ValueError(f"An unexpected error occurred: {str(e)}")

        if "error" in data:
            error_msg = data["error"].get("description", "Unknown TomTom error")
            logger.error(f"TomTom API error: {error_msg}")
            raise ValueError(f"Failed to find route: {error_msg}")

        tomtom_routes = data.get("routes", [])
        if not tomtom_routes:
            raise ValueError("No routes returned for the given origin and destination.")

        routes: List[Dict[str, Any]] = []
        for idx, route_data in enumerate(tomtom_routes[:max_routes]):
            route = self._extract_tomtom_route(
                route_data, route_id=idx, start_lat=start_lat, start_lng=start_lng,
                end_lat=end_lat, end_lng=end_lng
            )
            routes.append(route)
            logger.info(
                f"Route {idx}: {route['distance']} km, "
                f"{route['duration']} min, delay {route['traffic_delay']} min"
            )

        return routes

    # ------------------------------------------------------------------
    # Backward-compat shim (keeps existing /realtime callers working
    # until we fully migrate them)
    # ------------------------------------------------------------------
    def get_route_info(
        self, origin_lat: float, origin_lng: float, destination: str
    ) -> Dict[str, Any]:
        """Return the single best (first) route. Kept for backward compatibility."""
        routes = self.get_route_options(origin_lat, origin_lng, destination, max_routes=1)
        return routes[0]
