from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any

from api.routes.predict import model_manager, PredictionRequest, PredictionResponse
from services.xai import explain_prediction
from core.logger import logger

router = APIRouter()

class Explanation(BaseModel):
    feature_importance: Dict[str, float]
    top_factor: str

class ExplainResponse(BaseModel):
    prediction: PredictionResponse
    explanation: Explanation

@router.post("/explain", response_model=ExplainResponse, status_code=status.HTTP_200_OK)
async def explain_traffic(request: PredictionRequest):
    if not model_manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model Manager is not initialized."
        )
        
    try:
        # Step 1: Run prediction
        prediction_result = model_manager.predict(
            hour=request.hour,
            weather=request.weather,
            traffic_delay=request.traffic_delay,
            day_of_week=request.day_of_week
        )
        
        # Step 2: Extract explanation from the Random Forest model
        explanation_result = explain_prediction(model_manager)
        
        return {
            "prediction": prediction_result,
            "explanation": explanation_result
        }
    except ValueError as ve:
        logger.warning(f"Validation error during explanation: {ve}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        logger.error(f"Unexpected error during explanation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the explanation request."
        )
