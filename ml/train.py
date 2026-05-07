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

def generate_dummy_data(num_samples=5000):
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
    
    # Make data highly linear and separable
    score = hour * 0.5 + weather * 2.0 + traffic_delay * 0.8
    score = score + np.random.normal(0, 1.5, num_samples)
    
    # Balance classes
    target = (score > np.median(score)).astype(int)
    
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
    
    # Save the generated dataset
    dataset_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dataset")
    os.makedirs(dataset_dir, exist_ok=True)
    dataset_path = os.path.join(dataset_dir, "traffic_data.csv")
    
    # Combine features and target for saving
    df = X.copy()
    df['target'] = y
    df.to_csv(dataset_path, index=False)
    logger.info(f"Saved simulated dataset to {dataset_path}")
    
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
