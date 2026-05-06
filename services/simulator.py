from services.model_manager import ModelManager

class Simulator:
    def __init__(self, model_manager: ModelManager):
        """
        Initialize with a model manager instance to avoid reloading models.
        """
        self.model_manager = model_manager

    @staticmethod
    def _risk_level(prob: float) -> str:
        if prob < 0.4:
            return "Low"
        elif prob < 0.7:
            return "Medium"
        return "High"

    @staticmethod
    def _time_label(hour: int) -> str:
        """Return human-friendly 12-hour time string, e.g. '9:00 AM'."""
        if hour == 0:
            return "12:00 AM"
        elif hour < 12:
            return f"{hour}:00 AM"
        elif hour == 12:
            return "12:00 PM"
        else:
            return f"{hour - 12}:00 PM"

    def run_hour_simulation(
        self,
        base_hour: int,
        weather: str,
        traffic_delay: float,
        day_of_week: int,
        hours_ahead: int = 12,
    ) -> list:
        """
        Generate 12-hour forward-looking congestion forecast.
        Returns one data point per hour from base_hour to base_hour + hours_ahead - 1.
        Each entry: { hour, time_label, probability, risk_level }
        """
        import random

        scenarios = []
        for offset in range(hours_ahead):
            h = (base_hour + offset) % 24  # wrap around midnight

            # Realistic delay multiplier based on time-of-day patterns
            if 8 <= h <= 10 or 17 <= h <= 19:
                # Morning / evening rush hour
                multiplier = random.uniform(1.6, 2.8)
            elif 0 <= h <= 5:
                # Late night / early morning — nearly clear
                multiplier = random.uniform(0.05, 0.2)
            elif 11 <= h <= 14:
                # Midday — moderate
                multiplier = random.uniform(0.7, 1.3)
            else:
                multiplier = random.uniform(0.5, 1.1)

            simulated_delay = traffic_delay * multiplier

            # Provide realistic baseline even when current traffic is free-flowing
            if traffic_delay < 1.0:
                if 8 <= h <= 10 or 17 <= h <= 19:
                    simulated_delay = random.uniform(4.0, 8.0)
                elif 11 <= h <= 16:
                    simulated_delay = random.uniform(1.0, 3.0)
                elif 0 <= h <= 5:
                    simulated_delay = random.uniform(0.0, 0.3)
                else:
                    simulated_delay = random.uniform(0.3, 1.5)

            result = self.model_manager.predict(
                hour=h,
                weather=weather,
                traffic_delay=simulated_delay,
                day_of_week=day_of_week,
            )

            prob = result["probability"]
            scenarios.append({
                "hour": h,
                "time_label": self._time_label(h),
                "probability": prob,
                "risk_level": self._risk_level(prob),
                "is_current": offset == 0,
            })

        return scenarios

