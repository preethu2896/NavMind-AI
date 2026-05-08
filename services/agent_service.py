import logging
import google.generativeai as genai
from core.config import settings
from services.maps_service import MapsService
from services.model_manager import ModelManager
from services.xai import explain_prediction

logger = logging.getLogger("smart_traffic")

class NavigationAgent:
    def __init__(self):
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
        else:
            logger.warning("GEMINI_API_KEY is not set.")
            
        self.maps_service = MapsService()
        self.model_manager = ModelManager()
        self.last_fetched_route = None
        
        # Define the tool (function) the model can call
        def find_route(origin_lat: float, origin_lng: float, destination: str, travel_mode: str = "car") -> dict:
            """
            Finds the best route between coordinates and a destination address.
            
            Args:
                origin_lat: The latitude of the starting point.
                origin_lng: The longitude of the starting point.
                destination: The human-readable address or place name of the destination.
                travel_mode: The mode of transportation. Can be 'car', 'bike', or 'pedestrian'. Defaults to 'car'.
            """
            logger.info(f"Agent called find_route: {destination} via {travel_mode}")
            try:
                routes = self.maps_service.get_route_options(
                    origin_lat=origin_lat, 
                    origin_lng=origin_lng, 
                    destination=destination, 
                    max_routes=1,
                    travel_mode=travel_mode
                )
                if routes:
                    from datetime import datetime
                    from services.weather_service import WeatherService
                    
                    r = routes[0]
                    
                    # Compute ML risk probability to prevent NaN% in UI
                    now = datetime.now()
                    weather = WeatherService().get_weather(origin_lat, origin_lng)
                    ml_result = self.model_manager.predict(
                        hour=now.hour,
                        weather=weather,
                        traffic_delay=r["traffic_delay"],
                        day_of_week=now.weekday()
                    )
                    r["probability"] = round(ml_result["probability"], 4)
                    r["best_model"] = ml_result["best_model"]
                    r["prediction"] = ml_result["prediction"]
                    
                    # Save the full route so we can return it to the frontend
                    self.last_fetched_route = r
                    
                    # Return only a summary to the LLM to save token space
                    return {
                        "distance_km": r["distance"],
                        "duration_min": r["duration"],
                        "traffic_delay_min": r["traffic_delay"],
                        "route_id": r["route_id"]
                    }
                return {"error": "No route found."}
            except Exception as e:
                logger.error(f"Error in Agent find_route tool: {e}")
                return {"error": str(e)}

        def analyze_traffic_causes() -> dict:
            """
            Analyzes the underlying predictive machine learning models to explain the primary factors causing traffic right now.
            Returns the top factor and a breakdown of feature importance.
            """
            logger.info("Agent called analyze_traffic_causes")
            try:
                return explain_prediction(self.model_manager)
            except Exception as e:
                logger.error(f"Error in Agent analyze_traffic_causes tool: {e}")
                return {"error": str(e)}

        self.tools = [find_route, analyze_traffic_causes]
        
        # Initialize the model with the tool
        try:
            self.model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                tools=self.tools,
                system_instruction=(
                    "You are NavMind AI, a highly advanced autonomous navigation assistant. "
                    "Your job is to help users find the best routes. You have access to a 'find_route' tool. "
                    "Extract the user's destination and travel mode preference. If they don't specify a mode, default to 'car'. "
                    "Call the tool using their current coordinates. Once you get the route data back from the tool, "
                    "summarize it in a highly professional way.\n\n"
                    "CRITICAL FORMATTING INSTRUCTIONS:\n"
                    "- ALWAYS use **Markdown** to structure your responses.\n"
                    "- Use bullet points to list route stats (Distance, ETA, Delay).\n"
                    "- Use bold text for important information (e.g., **High Congestion**).\n"
                    "- Mention **Eco-Friendly Routing**! If a route has low delay, mention that it has a lower Carbon Footprint / CO2 emission due to less idling time.\n\n"
                    "If the user asks WHY there is traffic, or wants an explanation of traffic causes, use the 'analyze_traffic_causes' tool. "
                    "DO NOT make up route details; ONLY use the data returned by the tools. Keep your responses concise but visually stunning."
                )
            )
        except Exception as e:
            logger.error(f"Failed to initialize Gemini model: {e}")
            self.model = None

    def process_chat(self, user_prompt: str, current_lat: float, current_lng: float) -> dict:
        """
        Process a user prompt, allowing the LLM to call tools to resolve the query.
        """
        if not self.model:
            return {"error": "AI Agent is not configured. Missing API key."}
            
        self.last_fetched_route = None # Reset previous route
        
        try:
            # We must start a chat session to handle multi-turn function calling
            chat = self.model.start_chat(enable_automatic_function_calling=True)
            
            # Prepend context to the user's prompt so the model knows where it is
            contextual_prompt = (
                f"Context: My current location coordinates are latitude={current_lat}, longitude={current_lng}. "
                f"User says: {user_prompt}"
            )
            
            logger.info(f"Sending prompt to Gemini: {user_prompt}")
            response = chat.send_message(contextual_prompt)
            
            # The automatic function calling handles invoking find_route and passing the result back.
            # The final response.text will contain the model's human-readable synthesis.
            
            return {
                "response": response.text,
                "route_data": self.last_fetched_route,
                "agent_status": "success"
            }
        except Exception as e:
            logger.error(f"Error in Agent Service: {e}")
            return {"error": str(e)}
