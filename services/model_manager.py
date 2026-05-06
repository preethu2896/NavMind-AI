import os
import joblib
from core.logger import logger
from ml.preprocess import preprocess_features

class ModelManager:
    def __init__(self):
        self.models = {}
        self.model_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml", "saved_models")
        self._load_models()
        
    def _load_models(self):
        """
        Load all trained models from the disk.
        """
        model_names = ["logistic", "knn", "decision_tree", "random_forest"]
        
        if not os.path.exists(self.model_dir):
            logger.warning(f"Model directory {self.model_dir} not found. Ensure models are trained.")
            return

        for name in model_names:
            model_path = os.path.join(self.model_dir, f"{name}.pkl")
            if os.path.exists(model_path):
                try:
                    self.models[name] = joblib.load(model_path)
                    logger.info(f"Loaded model {name} successfully.")
                except Exception as e:
                    logger.error(f"Failed to load model {name}: {str(e)}")
            else:
                logger.warning(f"Model file not found: {model_path}")

    def predict(self, hour: int, weather: str, traffic_delay: float, day_of_week: int) -> dict:
        """
        Run predictions across all loaded models and return the ensemble results.
        """
        if not self.models:
            raise RuntimeError("No models loaded. Please train models first.")
            
        try:
            # Preprocess inputs
            features = preprocess_features(hour, weather, traffic_delay, day_of_week)
            
            all_probs = {}
            best_model = None
            highest_confidence = -1.0
            prediction_class = 0
            best_prob = 0.0
            
            # Get predictions from all models
            for name, model in self.models.items():
                probs = model.predict_proba(features)[0]
                
                # If model only predicted one class, handle it gracefully
                if len(probs) > 1:
                    prob_class_1 = float(probs[1])
                else:
                    predicted_class = model.classes_[0]
                    prob_class_1 = 1.0 if predicted_class == 1 else 0.0
                    
                all_probs[name] = prob_class_1

            # ENSEMBLE STRATEGY: Average the probabilities for a smoother, more realistic risk score
            # (Avoids the issue of pure Decision Tree leaves forcing the prediction to 100%)
            best_model = "ensemble_average"
            if all_probs:
                best_prob = sum(all_probs.values()) / len(all_probs)
            else:
                best_prob = 0.0
                
            # Add a dynamic baseline probability so it's never exactly 0.0%
            import random
            baseline = random.uniform(0.01, 0.05)
            if 7 <= hour <= 10 or 16 <= hour <= 19:
                baseline = random.uniform(0.15, 0.35)
            elif 11 <= hour <= 15:
                baseline = random.uniform(0.05, 0.15)
                
            best_prob = max(best_prob, baseline)

            # --- DYNAMIC REAL-TIME TRAFFIC OVERRIDE ---
            # Ground truth from TomTom takes extreme precedence over historical ML for live routing.
            if traffic_delay > 0:
                # e.g., 15 minutes of delay = 95% risk
                live_risk = min(0.95, traffic_delay / 15.0)
                # Strongly weight live traffic (85%) over ML historical (15%)
                best_prob = (live_risk * 0.85) + (best_prob * 0.15)
            else:
                # If TomTom reports exactly 0 delay, the road is literally clear.
                # ML risk drops to a negligible trace amount (e.g. 5% of its original value) so the UI shows ~1% risk.
                best_prob *= 0.05
                
            # Cap at 99% so the UI never feels broken by showing exactly "100%"
            best_prob = min(0.99, best_prob)

            prediction_class = 1 if best_prob >= 0.5 else 0

            return {
                "best_model": best_model,
                "prediction": prediction_class,
                "probability": best_prob,
                "all_models": all_probs
            }
            
        except Exception as e:
            logger.error(f"Error during prediction: {str(e)}")
            raise
