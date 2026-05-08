from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List

from services.maps_service import MapsService
from services.weather_service import WeatherService
from services.model_manager import ModelManager
from services.simulator import Simulator
from services.decision_engine import analyze_scenarios, build_reroute_advice, select_best_route
from services.xai import explain_prediction, explain_route
from core.logger import logger

router = APIRouter()

try:
    model_manager = ModelManager()
except Exception as e:
    logger.error(f"Failed to initialize ModelManager: {e}")
    model_manager = None

maps_service = MapsService()
weather_service = WeatherService()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class RealtimeRequest(BaseModel):
    current_lat: float = Field(..., description="Current latitude")
    current_lng: float = Field(..., description="Current longitude")
    destination_lat: float = Field(..., description="Destination latitude")
    destination_lng: float = Field(..., description="Destination longitude")
    travel_mode: str = Field("car", description="Travel mode (car, bicycle, pedestrian)")


class RouteOption(BaseModel):
    route_id: int
    distance: float          # km
    duration: float          # minutes
    traffic_delay: float     # real-time traffic delay in minutes (from TomTom)
    co2_emission: float      # estimated CO2 emissions in kg
    probability: float       # congestion probability from ML ensemble
    prediction: int          # 0 = clear, 1 = congested
    best_model: str
    geometry: list           # list of [lng, lat] coordinate pairs
    instructions: list       # turn-by-turn guidance
    start_location: dict
    end_location: dict


class RerouteAdvice(BaseModel):
    best_route: dict
    reason: str
    reroute_advised: bool
    current_prob: float
    best_prob: float
    improvement: float


class RealtimeResponse(BaseModel):
    route_options: List[RouteOption]
    recommended_route_id: int         # route_id with lowest congestion probability
    reroute_advice: RerouteAdvice     # smart rerouting decision
    prediction: dict                  # prediction detail for the recommended route
    recommendation: dict
    scenarios: list
    explanation: dict
    weather: str
    hour: int


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/realtime", response_model=RealtimeResponse, status_code=status.HTTP_200_OK)
async def process_realtime(request: RealtimeRequest):
    if not model_manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model Manager is not initialized.",
        )

    try:
        # ── 1. Temporal context ────────────────────────────────────────────
        now = datetime.now()
        hour = now.hour
        day_of_week = now.weekday()   # Monday=0, Sunday=6

        # ── 2. Weather (fetched once for origin) ──────────────────────────
        weather = weather_service.get_weather(request.current_lat, request.current_lng)

        # ── 3. Fetch up to 3 route alternatives from ORS ──────────────────
        raw_routes = maps_service.get_route_options(
            origin_lat=request.current_lat,
            origin_lng=request.current_lng,
            destination=f"{request.destination_lat},{request.destination_lng}",
            max_routes=3,
            travel_mode=request.travel_mode,
        )

        # ── 4. Score each route with the ML ensemble ────────────────────────
        #   ML inputs: hour, day_of_week, weather (real-time), traffic_delay (real-time from TomTom)
        route_options_dicts = []
        route_options: List[RouteOption] = []

        for raw in raw_routes:
            ml_result = model_manager.predict(
                hour=hour,
                weather=weather,
                traffic_delay=raw["traffic_delay"],
                day_of_week=day_of_week,
            )
            prob = ml_result["probability"]
            
            # Simple Eco-Routing Calculation:
            # ~0.12 kg CO2 per km at free flow, plus ~0.05 kg CO2 per minute of idling/traffic delay
            co2 = round((raw["distance"] * 0.12) + (raw["traffic_delay"] * 0.05), 2)
            
            ro = RouteOption(
                route_id=raw["route_id"],
                distance=raw["distance"],
                duration=raw["duration"],
                traffic_delay=raw["traffic_delay"],
                co2_emission=co2,
                probability=round(prob, 4),
                prediction=ml_result["prediction"],
                best_model=ml_result["best_model"],
                geometry=raw["geometry"],
                instructions=raw.get("instructions", []),
                start_location=raw["start_location"],
                end_location=raw["end_location"],
            )
            route_options.append(ro)
            route_options_dicts.append(ro.model_dump())

        # ── 5. Smart rerouting decision ─────────────────────────────────────
        #   build_reroute_advice internally calls select_best_route which uses
        #   a composite score: (duration + traffic_delay) * (1 + prob * 0.30)
        #   This means the best route balances: real-time delay, travel time, AND congestion risk.
        reroute_advice = build_reroute_advice(
            route_options=route_options_dicts,
            current_route_id=0,
        )

        # ── 6. Use the composite-best route for downstream ML pipeline ───────
        best_route_id = reroute_advice["best_route"]["route_id"]
        best_raw = raw_routes[best_route_id]
        best_traffic_delay = best_raw["traffic_delay"]

        # ── 7. Full ML prediction detail for the best route ──────────────────
        prediction_result = model_manager.predict(
            hour=hour,
            weather=weather,
            traffic_delay=best_traffic_delay,
            day_of_week=day_of_week,
        )

        # ── 8. 5-hour departure scenario simulation ──────────────────────────
        simulator = Simulator(model_manager)
        scenarios = simulator.run_hour_simulation(
            base_hour=hour,
            weather=weather,
            traffic_delay=best_traffic_delay,
            day_of_week=day_of_week,
        )

        # ── 9. Best departure time recommendation ────────────────────────────
        recommendation = analyze_scenarios(scenarios)

        # ── 10. Explainability (XAI) ─────────────────────────────────────────
        explanation = explain_prediction(model_manager)

        # ── 11. Per-route human-readable XAI explanation ──────────────────────
        route_explanation = explain_route(
            model_manager=model_manager,
            hour=hour,
            weather=weather,
            traffic_delay=best_traffic_delay,
            day_of_week=day_of_week,
        )

        logger.info(
            f"Realtime: {len(route_options)} routes scored | "
            f"Best route_id={best_route_id} (delay={best_traffic_delay:.1f}min, "
            f"prob={reroute_advice['best_prob']:.0%}) | weather={weather}"
        )

        return {
            "route_options":        route_options,
            "recommended_route_id": best_route_id,
            "reroute_advice":       reroute_advice,
            "prediction":           prediction_result,
            "recommendation":       recommendation,
            "scenarios":            scenarios,
            "explanation":          explanation,
            "route_explanation":    route_explanation,
            "weather":              weather,
            "hour":                 hour,
        }

    except ValueError as ve:
        logger.warning(f"Validation error during realtime process: {ve}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        logger.error(f"Unexpected error during realtime process: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the realtime request.",
        )
