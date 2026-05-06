import numpy as np
from core.logger import logger

WEATHER_MAPPING = {
    "Clear": 0,
    "Cloudy": 1,
    "Rainy": 2,
    "Snowy": 3
}

def preprocess_features(hour: int, weather: str, traffic_delay: float, day_of_week: int) -> np.ndarray:
    """
    Preprocess input features for model prediction.
    """
    try:
        # Validate and convert hour
        if not (0 <= hour <= 23):
            raise ValueError(f"Invalid hour: {hour}. Must be between 0 and 23.")
            
        # Validate and convert weather
        weather_title = weather.title()
        if weather_title not in WEATHER_MAPPING:
            logger.warning(f"Unknown weather '{weather}'. Defaulting to 'Clear' (0).")
            weather_encoded = WEATHER_MAPPING["Clear"]
        else:
            weather_encoded = WEATHER_MAPPING[weather_title]
            
        # Validate traffic_delay
        if traffic_delay < 0:
            raise ValueError(f"Traffic delay cannot be negative: {traffic_delay}")
            
        # Validate day_of_week
        if not (0 <= day_of_week <= 6):
            raise ValueError(f"Invalid day_of_week: {day_of_week}. Must be between 0 and 6.")
            
        # Create feature array
        features = np.array([[hour, weather_encoded, traffic_delay, day_of_week]])
        return features
        
    except Exception as e:
        logger.error(f"Error in preprocessing features: {str(e)}")
        raise
