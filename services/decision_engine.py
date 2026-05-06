"""
decision_engine.py
──────────────────
Two independent responsibilities:

1. analyze_scenarios(scenarios)   – time-of-day departure recommendation
   (original behaviour, unchanged)

2. select_best_route(route_options) – compares ML-scored route alternatives
   and returns the one with the lowest congestion probability.

3. build_reroute_advice(route_options) – high-level helper that wraps
   select_best_route and adds a human-readable reason + reroute flag.
   This is the entry-point consumed by realtime.py.
"""

from typing import Any, Dict, List

# ── Risk thresholds ───────────────────────────────────────────────────────────
# A route is considered "high risk" when its congestion probability exceeds this.
HIGH_RISK_THRESHOLD = 0.60   # 60 %


# ─────────────────────────────────────────────────────────────────────────────
# 1. Time-of-day scenario analysis  (existing, unchanged)
# ─────────────────────────────────────────────────────────────────────────────

def analyze_scenarios(scenarios: list) -> dict:
    """
    Analyzes a list of traffic scenarios and returns the best departure hour.

    Expected scenario format: {"hour": int, "probability": float}
    """
    if not scenarios:
        raise ValueError("No scenarios provided for analysis.")

    best_scenario = min(scenarios, key=lambda x: x["probability"])
    lowest_prob   = best_scenario["probability"]
    recommended_hour = best_scenario["hour"]

    if lowest_prob < 0.4:
        risk_level = "Low"
    elif lowest_prob <= 0.70:
        risk_level = "Medium"
    else:
        risk_level = "High"

    return {
        "recommended_hour":   recommended_hour,
        "lowest_probability": lowest_prob,
        "risk_level":         risk_level,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Route comparison – select the best alternative
# ─────────────────────────────────────────────────────────────────────────────

def select_best_route(route_options: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compares all scored route options and selects the one with the lowest
    congestion probability.

    Each item in *route_options* must have at least:
        route_id   : int
        probability: float   (ML congestion probability, 0–1)
        distance   : float   (km)
        duration   : float   (minutes)
        traffic_delay: float (minutes)
        prediction : int     (0 = clear, 1 = congested)

    Returns the best route dict (the original item from the list).
    """
    if not route_options:
        raise ValueError("route_options list is empty – cannot select best route.")

    # We calculate a composite score: 
    # Total travel time (duration + traffic_delay) plus a time penalty based on congestion risk.
    # For example, a 100% congestion risk (prob = 1.0) adds a 30% penalty to the total travel time.
    def route_score(r: Dict[str, Any]) -> float:
        total_time = r["duration"] + r["traffic_delay"]
        penalty = 1.0 + (r["probability"] * 0.30)
        return total_time * penalty

    best = min(route_options, key=route_score)
    return best


# ─────────────────────────────────────────────────────────────────────────────
# 3. Smart rerouting advice  (new – main entry-point for realtime.py)
# ─────────────────────────────────────────────────────────────────────────────

def build_reroute_advice(
    route_options: List[Dict[str, Any]],
    current_route_id: int = 0,
) -> Dict[str, Any]:
    """
    High-level smart rerouting helper.

    Parameters
    ----------
    route_options   : list of ML-scored route dicts (from realtime.py scoring loop).
    current_route_id: the route the user is currently on (defaults to route 0 –
                      the first route ORS returns, treated as the "default" route).

    Returns
    -------
    {
      "best_route"     : { route_id, distance, duration, probability, ... },
      "reason"         : str,          # human-readable explanation
      "reroute_advised": bool,         # True  → actively switch routes
      "current_prob"   : float,        # congestion prob of the current route
      "best_prob"      : float,        # congestion prob of the recommended route
      "improvement"    : float,        # probability drop (positive = improvement)
    }
    """
    if not route_options:
        raise ValueError("route_options list is empty – cannot build reroute advice.")

    # ── Find current route ────────────────────────────────────────────────────
    current_matches = [r for r in route_options if r["route_id"] == current_route_id]
    current_route   = current_matches[0] if current_matches else route_options[0]
    current_prob    = current_route["probability"]

    # ── Select globally best route ────────────────────────────────────────────
    best_route  = select_best_route(route_options)
    best_prob   = best_route["probability"]
    improvement = round(current_prob - best_prob, 4)   # positive → better

    # ── Decide whether to advise a reroute ────────────────────────────────────
    #   Reroute if EITHER:
    #     a) current route is high-risk  AND  a better route exists, OR
    #     b) the best alternative is materially better (≥10 pp improvement)
    current_is_high_risk = current_prob >= HIGH_RISK_THRESHOLD
    meaningful_gain      = improvement >= 0.10           # ≥ 10 percentage-point gain
    reroute_advised      = (current_is_high_risk and best_route["route_id"] != current_route_id) \
                           or meaningful_gain

    # ── Build human-readable reason ───────────────────────────────────────────
    if best_route["route_id"] == current_route["route_id"]:
        reason = (
            f"Current route (ID {current_route_id}) already has the lowest "
            f"congestion probability ({best_prob:.0%}). No change needed."
        )
    elif current_is_high_risk and meaningful_gain:
        reason = (
            f"Current route risk is HIGH ({current_prob:.0%}). "
            f"Route {best_route['route_id']} reduces congestion probability by "
            f"{improvement:.0%} (down to {best_prob:.0%}) – strongly recommended."
        )
    elif current_is_high_risk:
        reason = (
            f"Current route risk is HIGH ({current_prob:.0%}). "
            f"Route {best_route['route_id']} offers a lower congestion probability "
            f"({best_prob:.0%}) and is recommended."
        )
    elif meaningful_gain:
        reason = (
            f"Route {best_route['route_id']} has a lower congestion probability "
            f"({best_prob:.0%} vs {current_prob:.0%}), "
            f"a {improvement:.0%} improvement."
        )
    else:
        reason = (
            f"Route {best_route['route_id']} has the lowest congestion probability "
            f"({best_prob:.0%}). Difference vs current route is small ({improvement:.0%})."
        )

    return {
        "best_route":      best_route,
        "reason":          reason,
        "reroute_advised": reroute_advised,
        "current_prob":    round(current_prob, 4),
        "best_prob":       round(best_prob,    4),
        "improvement":     improvement,
    }
