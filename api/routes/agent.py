from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import logging
from services.agent_service import NavigationAgent

logger = logging.getLogger("smart_traffic")

router = APIRouter(prefix="/agent", tags=["agent"])

class AgentChatRequest(BaseModel):
    user_prompt: str = Field(..., description="The user's conversational prompt")
    current_lat: float = Field(..., description="Current latitude")
    current_lng: float = Field(..., description="Current longitude")

# We instantiate the agent once so it can retain context if needed, 
# or we can instantiate per request. Instantiating once is better for 
# a stateless API (the agent itself creates a new chat session per request).
agent_service = NavigationAgent()

@router.post("/chat")
async def chat_with_agent(request: AgentChatRequest):
    """
    Send a natural language prompt to the NavMind AI Agent.
    The agent will orchestrate tool calls to find routes and return a synthesized response.
    """
    logger.info(f"Received agent chat request: {request.user_prompt}")
    
    result = agent_service.process_chat(
        user_prompt=request.user_prompt,
        current_lat=request.current_lat,
        current_lng=request.current_lng
    )
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result
