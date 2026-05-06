from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.logger import logger
from api.routes import health, predict, simulate, recommend, explain, realtime, ingest, agent

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up SmartTraffic AI...")
    # --- API Key diagnostics (helps teammates debug missing .env keys) ---
    from core.config import _ENV_FILE
    logger.info(f"  .env path resolved to: {_ENV_FILE}")
    logger.info(f"  .env exists on disk  : {_ENV_FILE.exists()}")
    logger.info(f"  TOMTOM_API_KEY loaded : {'YES ✓' if settings.TOMTOM_API_KEY else 'NO ✗ — check your .env file!'}")
    logger.info(f"  ORS_API_KEY loaded    : {'YES ✓' if settings.ORS_API_KEY else 'NO ✗'}")
    logger.info(f"  OPENWEATHER_API_KEY   : {'YES ✓' if settings.OPENWEATHER_API_KEY else 'NO ✗'}")
    logger.info(f"  GEMINI_API_KEY        : {'YES ✓' if settings.GEMINI_API_KEY else 'NO ✗'}")
    yield
    logger.info("Shutting down SmartTraffic AI...")

def get_application() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        lifespan=lifespan
    )

    if settings.CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(health.router, tags=["health"])
    app.include_router(predict.router, tags=["predict"])
    app.include_router(simulate.router, tags=["simulate"])
    app.include_router(recommend.router, tags=["recommend"])
    app.include_router(explain.router, tags=["explain"])
    app.include_router(realtime.router, tags=["realtime"])
    app.include_router(ingest.router, tags=["ingest"])
    app.include_router(agent.router, tags=["agent"])

    return app

app = get_application()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
