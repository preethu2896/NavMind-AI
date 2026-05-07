import os
import sys
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.models import get_models

def evaluate_models():
    """
    Evaluates the machine learning models for traffic prediction and prints a performance comparison.
    """
    # Load dataset
    dataset_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dataset", "traffic_data.csv")
    if not os.path.exists(dataset_path):
        print(f"Dataset not found at {dataset_path}. Please run train.py first to generate the dummy data.")
        return
        
    df = pd.read_csv(dataset_path)
    
    X = df.drop(columns=['target'])
    y = df['target']
    
    # Train-test split for evaluation
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    models = get_models()
    results = []
    
    for name, model in models.items():
        # Train
        model.fit(X_train, y_train)
        
        # Predict
        y_pred = model.predict(X_test)
        
        # Metrics
        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        
        # Format name for display
        if name == 'decision_tree':
            display_name = 'Decision Tree'
        elif name == 'random_forest':
            display_name = 'Random Forest'
        elif name == 'logistic':
            display_name = 'Logistic Regression'
        elif name == 'knn':
            display_name = 'K-Nearest Neighbors'
        else:
            display_name = name
            
        results.append({
            'Model': display_name,
            'Accuracy': round(acc, 6),
            'Precision': round(prec, 6),
            'Recall': round(rec, 6),
            'F1 Score': round(f1, 6)
        })
        
    # Create DataFrame
    results_df = pd.DataFrame(results)
    
    # Sort to match the typical order
    order = {
        'Logistic Regression': 0, 
        'K-Nearest Neighbors': 1,
        'Decision Tree': 2, 
        'Random Forest': 3
    }
    results_df['order'] = results_df['Model'].map(order)
    results_df = results_df.sort_values('order').drop('order', axis=1).reset_index(drop=True)
    
    print("\nFigure 2.3 Performance Comparison of Machine Learning Models for Traffic Prediction\n")
    print(results_df.to_string())
    
    return results_df

if __name__ == "__main__":
    evaluate_models()
