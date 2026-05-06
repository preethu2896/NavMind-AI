from services.model_manager import ModelManager


def explain_prediction(model_manager: ModelManager) -> dict:
    """
    Extracts global feature importances from the trained RandomForest model.
    Returns raw importances for the bar chart.
    """
    rf_model = model_manager.models.get("random_forest")
    if not rf_model:
        raise ValueError("Random Forest model is not available for explanations.")

    # The models were trained with features in this exact order:
    # ['hour', 'weather', 'traffic_delay', 'day_of_week']
    importances = rf_model.feature_importances_
    feature_names = ["hour", "weather", "traffic_delay", "day_of_week"]

    importance_map = {name: float(imp) for name, imp in zip(feature_names, importances)}
    top_factor = max(importance_map, key=importance_map.get)

    return {
        "feature_importance": importance_map,
        "top_factor": top_factor,
    }


def explain_route(
    model_manager: ModelManager,
    hour: int,
    weather: str,
    traffic_delay: float,
    day_of_week: int,
) -> dict:
    """
    Generate a human-readable, per-route AI explanation of the risk score.
    Returns a list of factor breakdowns with labels, contributions, and impact ratings.
    """
    rf_model = model_manager.models.get("random_forest")
    if not rf_model:
        return {"factors": [], "summary": "Explanation unavailable."}

    importances = rf_model.feature_importances_
    total = sum(importances) or 1.0

    # ── Context-aware contribution values ─────────────────────────────────────
    # We scale each global importance by how "activated" this feature is right now.

    RUSH_HOURS = {7, 8, 9, 10, 17, 18, 19, 20}
    WEATHER_MULTIPLIER = {"rainy": 1.5, "cloudy": 1.1, "sunny": 0.4}
    WEEKDAY_MULTIPLIER = {0: 1.3, 1: 1.3, 2: 1.1, 3: 1.1, 4: 1.4, 5: 0.6, 6: 0.5}

    hour_activation = 1.8 if hour in RUSH_HOURS else 0.5
    weather_activation = WEATHER_MULTIPLIER.get(weather, 1.0)
    traffic_activation = min(traffic_delay / 5.0, 3.0) if traffic_delay > 0 else 0.2
    dow_activation = WEEKDAY_MULTIPLIER.get(day_of_week, 1.0)

    raw_scores = [
        importances[0] * hour_activation,        # hour
        importances[1] * weather_activation,     # weather
        importances[2] * traffic_activation,     # traffic_delay
        importances[3] * dow_activation,         # day_of_week
    ]
    score_total = sum(raw_scores) or 1.0
    pct_scores = [round(s / score_total * 100) for s in raw_scores]

    def impact_level(pct: int) -> str:
        if pct >= 40:
            return "High"
        elif pct >= 20:
            return "Medium"
        return "Low"

    def impact_color(level: str) -> str:
        return {"High": "#dc2626", "Medium": "#d97706", "Low": "#059669"}[level]

    # ── Human-readable context labels ─────────────────────────────────────────
    if hour in RUSH_HOURS:
        hour_detail = f"Rush hour ({hour}:00) — significantly increases congestion risk"
    elif 0 <= hour <= 5:
        hour_detail = f"Off-peak night hours ({hour}:00) — roads typically clear"
    else:
        hour_detail = f"Moderate traffic period ({hour}:00)"

    weather_labels = {
        "rainy": "Rainy weather — reduces road speeds and increases incident risk",
        "cloudy": "Overcast — mild impact on traffic flow",
        "sunny": "Clear conditions — minimal weather-related risk",
    }
    weather_detail = weather_labels.get(weather, f"Weather: {weather}")

    if traffic_delay > 10:
        traffic_detail = f"Heavy real-time delay ({traffic_delay:.1f} min) — major congestion detected"
    elif traffic_delay > 3:
        traffic_detail = f"Moderate delay ({traffic_delay:.1f} min) — some slowdowns"
    else:
        traffic_detail = f"Clear roads ({traffic_delay:.1f} min delay) — traffic flowing well"

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_name = day_names[day_of_week] if 0 <= day_of_week <= 6 else "Today"
    if day_of_week in (5, 6):
        dow_detail = f"{day_name} — weekend, lighter commuter traffic expected"
    elif day_of_week == 4:
        dow_detail = f"{day_name} — end-of-week, typically heavier traffic"
    else:
        dow_detail = f"{day_name} — typical weekday traffic patterns"

    factors = [
        {
            "key": "time_of_day",
            "label": "Time of Day",
            "icon": "🕐",
            "detail": hour_detail,
            "contribution_pct": pct_scores[0],
            "impact": impact_level(pct_scores[0]),
            "impact_color": impact_color(impact_level(pct_scores[0])),
        },
        {
            "key": "weather",
            "label": "Weather",
            "icon": "🌤",
            "detail": weather_detail,
            "contribution_pct": pct_scores[1],
            "impact": impact_level(pct_scores[1]),
            "impact_color": impact_color(impact_level(pct_scores[1])),
        },
        {
            "key": "live_traffic",
            "label": "Live Traffic",
            "icon": "🚦",
            "detail": traffic_detail,
            "contribution_pct": pct_scores[2],
            "impact": impact_level(pct_scores[2]),
            "impact_color": impact_color(impact_level(pct_scores[2])),
        },
        {
            "key": "day_of_week",
            "label": "Day of Week",
            "icon": "📅",
            "detail": dow_detail,
            "contribution_pct": pct_scores[3],
            "impact": impact_level(pct_scores[3]),
            "impact_color": impact_color(impact_level(pct_scores[3])),
        },
    ]

    # Sort by contribution descending
    factors.sort(key=lambda f: f["contribution_pct"], reverse=True)

    top = factors[0]
    summary = f"The primary congestion driver is **{top['label']}** ({top['contribution_pct']}% influence). {top['detail']}."

    return {
        "factors": factors,
        "summary": summary,
    }

