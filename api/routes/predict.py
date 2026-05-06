from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from services.model_manager import ModelManager
from core.logger import logger

router = APIRouter()

# Initialize ModelManager globally so it only loads models once
try:
    model_manager = ModelManager()
except Exception as e:
    logger.error(f"Failed to initialize ModelManager: {e}")
    model_manager = None

class PredictionRequest(BaseModel):
    hour: int = Field(..., ge=0, le=23, description="Hour of the day (0-23)")
    weather: str = Field(..., description="Weather condition (Clear, Cloudy, Rainy, Snowy)")
    traffic_delay: float = Field(..., ge=0, description="Traffic delay in minutes")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of the week (0-6)")

class PredictionResponse(BaseModel):
    best_model: str
    prediction: int
    probability: float
    all_models: dict

@router.post("/predict", response_model=PredictionResponse, status_code=status.HTTP_200_OK)
async def predict_traffic(request: PredictionRequest):
    if not model_manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model Manager is not initialized."
        )
        
    try:
        result = model_manager.predict(
            hour=request.hour,
            weather=request.weather,
            traffic_delay=request.traffic_delay,
            day_of_week=request.day_of_week
        )
        return result
    except ValueError as ve:
        logger.warning(f"Validation error during prediction: {ve}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error(f"Unexpected error during prediction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the prediction request."
        )
