import logging
import json
import urllib.request
import urllib.parse
import urllib.error
from typing import Dict, Any
from core.config import settings

logger = logging.getLogger("smart_traffic")

class WeatherService:
    def __init__(self):
        self.api_key = settings.OPENWEATHER_API_KEY
        self.base_url = "https://api.openweathermap.org/data/2.5/weather"

    def get_weather(self, lat: float, lng: float) -> str:
        """
        Fetches current weather from OpenWeatherMap API.
        Maps the condition to 'sunny', 'cloudy', or 'rainy'.
        Defaults to 'sunny' if API key missing or request fails.
        """
        if not self.api_key or self.api_key in ["your_key_here", "your_key"]:
            logger.warning("OpenWeatherMap API key is missing or not set. Defaulting to 'sunny'.")
            return "sunny"

        params = {
            "lat": lat,
            "lon": lng,
            "appid": self.api_key
        }
        query_string = urllib.parse.urlencode(params)
        url = f"{self.base_url}?{query_string}"

        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))

            if "weather" not in data or not data["weather"]:
                logger.warning("Weather data missing from OpenWeatherMap response. Defaulting to 'sunny'.")
                return "sunny"

            # OpenWeatherMap returns weather conditions like 'Clear', 'Clouds', 'Rain', 'Snow', etc.
            main_condition = data["weather"][0]["main"].lower()

            if main_condition == "clear":
                return "sunny"
            elif main_condition in ["clouds", "fog", "mist", "haze"]:
                return "cloudy"
            elif main_condition in ["rain", "drizzle", "thunderstorm", "snow"]:
                return "rainy"
            else:
                return "sunny" # Default fallback for unmapped conditions

        except Exception as e:
            logger.error(f"Failed to fetch weather data: {e}. Defaulting to 'sunny'.")
            return "sunny"
