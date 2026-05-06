from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List

from api.routes.simulate import simulator, SimulateRequest, Scenario
from services.decision_engine import analyze_scenarios
from core.logger import logger

router = APIRouter()

class Recommendation(BaseModel):
    recommended_hour: int
    lowest_probability: float
    risk_level: str

class RecommendResponse(BaseModel):
    recommendation: Recommendation
    scenarios: List[Scenario]

@router.post("/recommend", response_model=RecommendResponse, status_code=status.HTTP_200_OK)
async def recommend_traffic(request: SimulateRequest):
    if not simulator or not simulator.model_manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Simulator / Model Manager is not initialized."
        )
        
    try:
        # Step 1: Generate scenarios using simulator
        scenarios = simulator.run_hour_simulation(
            base_hour=request.hour,
            weather=request.weather,
            traffic_delay=request.traffic_delay,
            day_of_week=request.day_of_week
        )
        
        # Step 2: Pass scenarios to decision engine
        recommendation = analyze_scenarios(scenarios)
        
        return {
            "recommendation": recommendation,
            "scenarios": scenarios
        }
    except ValueError as ve:
        logger.warning(f"Validation error during recommendation: {ve}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error(f"Unexpected error during recommendation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the recommendation request."
        )
