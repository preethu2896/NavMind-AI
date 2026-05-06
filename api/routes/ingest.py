from fastapi import APIRouter

router = APIRouter()

@router.post("/api/ingest/log")
async def dummy_ingest_log():
    # A dummy route to catch random telemetry or browser extension logs 
    # to prevent terminal 404 spam.
    return {"status": "ok"}
