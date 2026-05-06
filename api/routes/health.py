from fastapi import APIRouter
from core.logger import logger

router = APIRouter()

@router.get("/")
async def health_check():
    logger.info("Health check endpoint called")
    return {"status": "ok", "message": "SmartTraffic AI backend is running"}
