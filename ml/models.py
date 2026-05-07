from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline

def get_models():
    """
    Return instances of the untrained models with pipelines where scaling helps.
    """
    return {
        "logistic": make_pipeline(StandardScaler(), LogisticRegression(random_state=42, max_iter=1000)),
        "knn": make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=7, weights='distance')),
        "decision_tree": DecisionTreeClassifier(random_state=42, max_depth=10),
        "random_forest": RandomForestClassifier(random_state=42, n_estimators=200, max_depth=15)
    }
