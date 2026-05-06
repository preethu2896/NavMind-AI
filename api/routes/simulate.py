from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List

# Reuse the global model manager from predict module to save memory
from api.routes.predict import model_manager
from services.simulator import Simulator
from core.logger import logger

router = APIRouter()
simulator = Simulator(model_manager) if model_manager else None

class SimulateRequest(BaseModel):
    hour: int = Field(..., ge=0, le=23, description="Hour of the day (0-23)")
    weather: str = Field(..., description="Weather condition (Clear, Cloudy, Rainy, Snowy)")
    traffic_delay: float = Field(..., ge=0, description="Traffic delay in minutes")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of the week (0-6)")

class Scenario(BaseModel):
    hour: int
    probability: float

class SimulateResponse(BaseModel):
    scenarios: List[Scenario]

@router.post("/simulate", response_model=SimulateResponse, status_code=status.HTTP_200_OK)
async def simulate_traffic(request: SimulateRequest):
    if not simulator or not simulator.model_manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Simulator / Model Manager is not initialized."
        )
        
    try:
        scenarios = simulator.run_hour_simulation(
            base_hour=request.hour,
            weather=request.weather,
            traffic_delay=request.traffic_delay,
            day_of_week=request.day_of_week
        )
        return {"scenarios": scenarios}
    except ValueError as ve:
        logger.warning(f"Validation error during simulation: {ve}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error(f"Unexpected error during simulation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the simulation request."
        )
