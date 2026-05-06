import os
import joblib
import numpy as np
import pandas as pd
import logging
import sys

# Ensure this script can be run standalone by adding the project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.logger import logger
from ml.models import get_models

MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
os.makedirs(MODEL_DIR, exist_ok=True)

def generate_dummy_data(num_samples=1000):
    """
    Generate dummy dataset for traffic prediction.
    Features: hour (0-23), weather (0-3), traffic_delay (0-120), day_of_week (0-6)
    Target: 1 (Congestion) or 0 (No Congestion)
    """
    np.random.seed(42)
    
    hour = np.random.randint(0, 24, num_samples)
    weather = np.random.randint(0, 4, num_samples)
    traffic_delay = np.random.exponential(scale=15, size=num_samples)
    day_of_week = np.random.randint(0, 7, num_samples)
    
    rush_hour = ((hour >= 7) & (hour <= 9)) | ((hour >= 16) & (hour <= 19))
    bad_weather = weather >= 2
    score = rush_hour.astype(int) * 2 + bad_weather.astype(int) * 1.5 + (traffic_delay / 10.0)
    score = score + np.random.normal(0, 1, num_samples)
    
    target = (score > 3.5).astype(int)
    
    X = pd.DataFrame({
        'hour': hour,
        'weather': weather,
        'traffic_delay': traffic_delay,
        'day_of_week': day_of_week
    })
    y = target
    
    return X, y

def train_and_save_models():
    """
    Train models on dummy data and save them.
    """
    logger.info("Generating dummy data...")
    X, y = generate_dummy_data()
    
    models = get_models()
    
    for name, model in models.items():
        logger.info(f"Training {name}...")
        model.fit(X, y)
        
        model_path = os.path.join(MODEL_DIR, f"{name}.pkl")
        joblib.dump(model, model_path)
        logger.info(f"Saved {name} model to {model_path}")
        
    logger.info("All models trained and saved successfully.")

if __name__ == "__main__":
    train_and_save_models()
