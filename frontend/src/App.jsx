import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Moon,
  Sun,
  AlertTriangle,
  Clock,
  CheckCircle,
  Info,
  MapPin,
  Navigation,
  Route,
  Zap,
  ArrowRight,
  TrendingDown,
  Car,
  Bike,
  Footprints,
  Bookmark,
  Layers,
  Leaf,
  CloudRain,
  MessageSquare,
  X,
  Send,
  Mic,
  MicOff,
  Brain,
} from "lucide-react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  CircleMarker,
  useMapEvent,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "./App.css";
import ReactMarkdown from "react-markdown";
import StreetPreview from "./StreetPreview.jsx";
import DashcamSimulation from "./DashcamSimulation.jsx";
import EcoProfile from "./EcoProfile.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = "http://127.0.0.1:8000";

const ROUTE_META = [
  { label: "Route A", color: "#3b82f6", darkColor: "#1d4ed8" },
  { label: "Route B", color: "#a855f7", darkColor: "#7c3aed" },
  { label: "Route C", color: "#f59e0b", darkColor: "#d97706" },
];

const RISK_CONFIG = {
  low: { label: "Low Risk", cls: "risk-pill--low", icon: "✓" },
  medium: { label: "Medium Risk", cls: "risk-pill--medium", icon: "~" },
  high: { label: "High Risk", cls: "risk-pill--high", icon: "⚠" },
};

function getRiskLevel(probability) {
  if (probability < 0.4) return "low";
  if (probability <= 0.7) return "medium";
  return "high";
}

// ─────────────────────────────────────────────────────────────────────────────
// Leaflet icon fix
// ─────────────────────────────────────────────────────────────────────────────

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// ─────────────────────────────────────────────────────────────────────────────
// FitBounds helper
// ─────────────────────────────────────────────────────────────────────────────

function FitBounds({ positions }) {
  const map = useMap();
  if (positions.length > 0) {
    map.fitBounds(L.latLngBounds(positions), { padding: [50, 50] });
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Recommendation Message
// ─────────────────────────────────────────────────────────────────────────────

function AIRecommendationMessage({
  routeOptions,
  recommendedId,
  rerouteAdvice,
}) {
  if (!routeOptions || routeOptions.length === 0) return null;

  const recRoute =
    routeOptions.find((r) => r.route_id === recommendedId) ?? routeOptions[0];
  const recIdx = routeOptions.indexOf(recRoute);
  const recMeta = ROUTE_META[recIdx] ?? ROUTE_META[0];
  const recLabel = recMeta.label;
  const riskLevel = getRiskLevel(recRoute.probability);
  const riskCfg = RISK_CONFIG[riskLevel];

  // Build the human-readable message
  const isReroute = rerouteAdvice?.reroute_advised;
  const improvement = rerouteAdvice?.improvement ?? 0;

  const message = isReroute
    ? `AI recommends ${recLabel} to avoid congestion — ${(improvement * 100).toFixed(0)}% lower risk`
    : `AI recommends ${recLabel} as your optimal route`;

  return (
    <div
      className={`ai-recommendation-msg ${isReroute ? "ai-recommendation-msg--urgent" : "ai-recommendation-msg--default"}`}
      role="status"
      aria-live="polite"
    >
      <div className="ai-rec__icon-wrap">
        <Zap size={20} />
      </div>
      <div className="ai-rec__content">
        <span className="ai-rec__text">{message}</span>
        <span className={`risk-pill ${riskCfg.cls}`}>
          {riskCfg.icon} {riskCfg.label} ·{" "}
          {(recRoute.probability * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Comparison Panel (cards + map tabs unified)
// ─────────────────────────────────────────────────────────────────────────────

function RouteComparisonPanel({
  routeOptions,
  activeRouteId,
  recommendedId,
  onSelect,
  weather,
  rerouteAdvice,
}) {
  if (!routeOptions || routeOptions.length === 0) return null;

  const WEATHER_EMOJI = { sunny: "☀️", cloudy: "☁️", rainy: "🌧️" };
  const weatherIcon = WEATHER_EMOJI[weather] ?? "🌡️";

  return (
    <section
      className="card route-comparison-panel full-width"
      aria-label="Route comparison"
    >
      <h2>
        <Route size={20} /> Route Options
        {weather && (
          <span
            style={{
              fontSize: "0.78rem",
              fontWeight: 400,
              marginLeft: 12,
              opacity: 0.7,
            }}
          >
            {weatherIcon} Live weather:{" "}
            <strong style={{ textTransform: "capitalize" }}>{weather}</strong>
          </span>
        )}
      </h2>

      <div className="route-cards-grid">
        {routeOptions.map((r, i) => {
          const meta = ROUTE_META[i] ?? ROUTE_META[0];
          const isActive = r.route_id === activeRouteId;
          const isRecommended = r.route_id === recommendedId;
          const riskKey = getRiskLevel(r.probability);
          const riskCfg = RISK_CONFIG[riskKey];
          const isBest = isRecommended;
          const totalEta = (r.duration + r.traffic_delay).toFixed(1);

          return (
            <div
              key={r.route_id}
              className={[
                "rc-card",
                isActive ? "rc-card--active" : "",
                isBest ? "rc-card--best" : "",
              ].join(" ")}
              style={{ "--rc-color": meta.color }}
              onClick={() => onSelect(r.route_id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelect(r.route_id)}
              aria-pressed={isActive}
            >
              {/* ── Top strip ── */}
              <div
                className="rc-card__top-strip"
                style={{ background: meta.color }}
              />

              {/* ── Header ── */}
              <div className="rc-card__header">
                <div className="rc-card__title-row">
                  <span
                    className="rc-card__color-dot"
                    style={{ background: meta.color }}
                  />
                  <span className="rc-card__label">{meta.label}</span>
                </div>
                <div className="rc-card__badges">
                  {isBest && <span className="badge badge--best">★ Best</span>}
                  <span className={`risk-pill ${riskCfg.cls}`}>
                    {riskCfg.icon} {riskCfg.label}
                  </span>
                </div>
              </div>

              {/* ── Stats ── */}
              <div className="rc-card__stats">
                <div className="rc-stat">
                  <span className="rc-stat__icon">📍</span>
                  <div className="rc-stat__body">
                    <span className="rc-stat__label">Distance</span>
                    <span className="rc-stat__value">{r.distance} km</span>
                  </div>
                </div>
                <div className="rc-stat">
                  <span className="rc-stat__icon">⏱</span>
                  <div className="rc-stat__body">
                    <span className="rc-stat__label">Drive Time</span>
                    <span className="rc-stat__value">{r.duration} min</span>
                  </div>
                </div>
                <div className="rc-stat">
                  <span className="rc-stat__icon">🚦</span>
                  <div className="rc-stat__body">
                    <span className="rc-stat__label">Traffic Delay</span>
                    <span
                      className="rc-stat__value"
                      style={{
                        color:
                          r.traffic_delay > 15
                            ? "#ef4444"
                            : r.traffic_delay > 5
                              ? "#f59e0b"
                              : "#22c55e",
                      }}
                    >
                      +{r.traffic_delay} min
                    </span>
                  </div>
                </div>
                <div className="rc-stat">
                  <span className="rc-stat__icon" style={{color: "#10b981"}}><Leaf size={14} /></span>
                  <div className="rc-stat__body">
                    <span className="rc-stat__label">Est. CO2</span>
                    <span className="rc-stat__value" style={{color: "#10b981"}}>{r.co2_emission} kg</span>
                  </div>
                </div>
                <div
                  className="rc-stat"
                  style={{
                    gridColumn: "1 / -1",
                    borderTop: "1px solid rgba(255,255,255,0.07)",
                    paddingTop: 8,
                    marginTop: 4,
                  }}
                >
                  <span className="rc-stat__icon">🕒</span>
                  <div className="rc-stat__body">
                    <span className="rc-stat__label">Total ETA</span>
                    <span
                      className="rc-stat__value"
                      style={{ fontWeight: 700, fontSize: "1rem" }}
                    >
                      {totalEta} min
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Congestion bar ── */}
              <div className="rc-card__risk-bar-wrap">
                <div className="rc-card__risk-bar-label">
                  <span>Congestion risk</span>
                  <strong>{(r.probability * 100).toFixed(0)}%</strong>
                </div>
                <div className="rc-card__risk-bar-track">
                  <div
                    className={`rc-card__risk-bar-fill rc-card__risk-bar-fill--${riskKey}`}
                    style={{ width: `${(r.probability * 100).toFixed(0)}%` }}
                  />
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="rc-card__footer">
                <span className="rc-card__model">
                  via {r.best_model?.replace(/_/g, " ")}
                </span>
                <button
                  className={`btn-switch-route ${isActive ? "btn-switch-route--active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(r.route_id);
                  }}
                  aria-label={`Switch to ${meta.label}`}
                >
                  {isActive ? "✓ Active" : "Switch Route"}
                  {!isActive && (
                    <ArrowRight size={13} style={{ marginLeft: 4 }} />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── AI decision reason ── */}
      {rerouteAdvice?.reason && (
        <div className="reroute-reason">
          <Zap size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{rerouteAdvice.reason}</span>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Map View
// ─────────────────────────────────────────────────────────────────────────────

function LiveLocationUpdater({ livePosition, isNavigating }) {
  const map = useMap();
  useEffect(() => {
    if (isNavigating && livePosition) {
      map.flyTo(livePosition, 16, { animate: true, duration: 1.5 });
    }
  }, [livePosition, isNavigating, map]);
  return null;
}

function MapInteractionEnabler() {
  const map = useMap();
  useMapEvent("click", () => {
    if (map.scrollWheelZoom.enabled()) {
      map.scrollWheelZoom.disable();
    } else {
      map.scrollWheelZoom.enable();
    }
  });
  useMapEvent("mouseout", () => {
    map.scrollWheelZoom.disable();
  });
  return null;
}

function FleetSimulator({ routeOptions, isEnabled }) {
  const [fleetPositions, setFleetPositions] = useState([]);

  useEffect(() => {
    if (!isEnabled || !routeOptions) {
      setFleetPositions([]);
      return;
    }

    const fleet = routeOptions.map((r, i) => ({
      id: `fleet-${i}`,
      geometry: r.geometry,
      progress: Math.floor(Math.random() * (r.geometry.length / 2)),
      color: ROUTE_META[i % ROUTE_META.length]?.color || "#ffffff",
      speed: 0.2 + Math.random() * 0.3
    }));

    let animationFrame;
    let lastTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const dt = now - lastTime;
      if (dt > 50) {
        lastTime = now;
        setFleetPositions(prev => {
          if (prev.length === 0) return fleet;
          return prev.map(f => {
            let nextProgress = f.progress + f.speed;
            if (nextProgress >= f.geometry.length - 1) {
              nextProgress = 0;
            }
            return { ...f, progress: nextProgress };
          });
        });
      }
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isEnabled, routeOptions]);

  if (!isEnabled || fleetPositions.length === 0) return null;

  return (
    <>
      {fleetPositions.map(f => {
        const floorIdx = Math.floor(f.progress);
        const ceilIdx = Math.min(Math.ceil(f.progress), f.geometry.length - 1);
        const ratio = f.progress - floorIdx;
        const pt1 = f.geometry[floorIdx];
        const pt2 = f.geometry[ceilIdx];
        if (!pt1 || !pt2) return null;
        
        const lng = pt1[0] + (pt2[0] - pt1[0]) * ratio;
        const lat = pt1[1] + (pt2[1] - pt1[1]) * ratio;

        return (
          <CircleMarker
            key={f.id}
            center={[lat, lng]}
            radius={7}
            pathOptions={{ fillColor: f.color, color: "#fff", weight: 2, fillOpacity: 1 }}
          >
            <Popup>
              <strong>🚚 Fleet Unit {f.id.replace('fleet-', '')}</strong><br/>
              Status: Active Route
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

function MapView({ routeOptions, activeRouteId, onRouteSelect }) {
  const [showIncidents, setShowIncidents] = useState(false);
  const [cityPlannerMode, setCityPlannerMode] = useState(false);
  const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || "quMDWPqrTCCd5Mbleyy3rTlJFkQaHYoH";
  const [isNavigating, setIsNavigating] = useState(false);
  const [livePosition, setLivePosition] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0); // in km/h
  const [currentInstruction, setCurrentInstruction] = useState(null);
  const watchIdRef = useRef(null);
  const lastSpokenRef = useRef(0);
  const spokenInstructionsRef = useRef(new Set());

  const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dp / 2) * Math.sin(dp / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current)
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const toggleNavigation = () => {
    if (isNavigating) {
      if (watchIdRef.current)
        navigator.geolocation.clearWatch(watchIdRef.current);
      setIsNavigating(false);
      setLivePosition(null);
      setCurrentSpeed(0);
    } else {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
      }
      setIsNavigating(true);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const speedMpS = pos.coords.speed || 0; // meters per second
          const speedKmH = Math.round(speedMpS * 3.6);

          setLivePosition([lat, lng]);
          setCurrentSpeed(speedKmH);

          // Speed limit check (50 km/h)
          if (speedKmH > 50) {
            const now = Date.now();
            if (now - lastSpokenRef.current > 30000) {
              if ("speechSynthesis" in window) {
                const utterance = new SpeechSynthesisUtterance(
                  "Speed limit exceeded. Please slow down.",
                );
                window.speechSynthesis.speak(utterance);
              }
              lastSpokenRef.current = now;
            }
          }


          // Navigation logic here...
          
          if (!spokenInstructionsRef.current.has('co2-added')) {
             spokenInstructionsRef.current.add('co2-added');
             // Add CO2 savings logic
             if (routeOptions && routeOptions.length > 0) {
               const activeRoute = routeOptions.find((r) => r.route_id === activeRouteId) ?? routeOptions[0];
               // Assume they save CO2 if they navigate using AI
               const worstCo2 = Math.max(...routeOptions.map(r => r.co2_emission));
               const saved = Math.max(0, worstCo2 - activeRoute.co2_emission);
               const toAdd = saved > 0 ? saved : activeRoute.co2_emission * 0.1; // Add baseline saving if taking AI route
               
               const event = new CustomEvent('addCo2', { detail: toAdd });
               window.dispatchEvent(event);
             }
          }

          // Voice Navigation Check
          if (routeOptions && routeOptions.length > 0) {
            const activeRoute =
              routeOptions.find((r) => r.route_id === activeRouteId) ??
              routeOptions[0];
            const instructions = activeRoute.instructions || [];

            let closestInst = null;

            instructions.forEach((inst, idx) => {
              const dist = haversine(lat, lng, inst.lat, inst.lng);

              if (dist < 100) {
                closestInst = inst.message;
              }

              if (!spokenInstructionsRef.current.has(idx)) {
                if (dist < 50) {
                  // within 50 meters
                  spokenInstructionsRef.current.add(idx);
                  if ("speechSynthesis" in window) {
                    window.speechSynthesis.speak(
                      new SpeechSynthesisUtterance(inst.message),
                    );
                  }
                }
              }
            });

            setCurrentInstruction(closestInst);
          }
        },
        (err) => console.error("Navigation error:", err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 },
      );
    }
  };

  if (!routeOptions || routeOptions.length === 0) return null;

  const activeRoute =
    routeOptions.find((r) => r.route_id === activeRouteId) ?? routeOptions[0];
  const activePositions = activeRoute.geometry.map((c) => [c[1], c[0]]);
  const start = [
    activeRoute.start_location.lat,
    activeRoute.start_location.lng,
  ];
  const end = [activeRoute.end_location.lat, activeRoute.end_location.lng];

  return (
    <section
      className="card map-panel full-width"
      style={{ position: "relative" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, padding: 0, border: "none" }}>
          <MapPin size={20} /> Interactive Route Map
        </h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowIncidents(!showIncidents)}
            className={`btn-start-nav ${showIncidents ? "active" : ""}`}
            style={{ 
              background: showIncidents ? "var(--primary-color)" : "transparent", 
              color: showIncidents ? "white" : "var(--primary-color)", 
              border: "1px solid var(--primary-color)" 
            }}
          >
            <Layers size={16} style={{ display: "inline", marginRight: 6 }} />
            {showIncidents ? "Incidents On" : "Incidents Off"}
          </button>
          <button
            onClick={() => setCityPlannerMode(!cityPlannerMode)}
            className={`btn-start-nav ${cityPlannerMode ? "active" : ""}`}
            style={{ 
              background: cityPlannerMode ? "var(--primary-color)" : "transparent", 
              color: cityPlannerMode ? "white" : "var(--primary-color)", 
              border: "1px solid var(--primary-color)" 
            }}
          >
            <MapPin size={16} style={{ display: "inline", marginRight: 6 }} />
            {cityPlannerMode ? "City Planner On" : "City Planner Off"}
          </button>
          <button
            onClick={toggleNavigation}
            className={`btn-start-nav ${isNavigating ? "active" : ""}`}
          >
            {isNavigating ? "🛑 Stop Navigation" : "🧭 Start Navigation"}
          </button>
        </div>
      </div>

      {isNavigating && (
        <div
          className="nav-hud"
          style={{ flexDirection: "column", alignItems: "flex-start" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              alignItems: "center",
            }}
          >
            <div className="nav-hud__speed">
              <span className="speed-val">{currentSpeed}</span>
              <span className="speed-unit">km/h</span>
            </div>
            {currentSpeed > 50 && (
              <div className="nav-hud__warning">⚠ SLOW DOWN</div>
            )}
          </div>
          {currentInstruction && (
            <div
              style={{
                marginTop: "12px",
                background: "rgba(59, 130, 246, 0.15)",
                padding: "10px 14px",
                borderRadius: "8px",
                width: "100%",
                border: "1px solid rgba(59, 130, 246, 0.4)",
              }}
            >
              <strong
                style={{
                  color: "#60a5fa",
                  display: "block",
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                  marginBottom: "4px",
                  letterSpacing: "0.5px",
                }}
              >
                Next Instruction
              </strong>
              <span
                style={{ fontSize: "1rem", fontWeight: "500", color: "white" }}
              >
                {currentInstruction}
              </span>
            </div>
          )}
          
          <DashcamSimulation />
        </div>
      )}

      {/* Route selector tabs */}
      <div className="route-tabs">
        {routeOptions.map((r, i) => {
          const meta = ROUTE_META[i] ?? ROUTE_META[0];
          const riskKey = getRiskLevel(r.probability);
          const riskCfg = RISK_CONFIG[riskKey];
          return (
            <button
              key={r.route_id}
              className={`route-tab ${r.route_id === activeRouteId ? "active" : ""}`}
              style={{ "--tab-color": meta.color }}
              onClick={() => onRouteSelect(r.route_id)}
              aria-pressed={r.route_id === activeRouteId}
            >
              <span className="tab-dot" style={{ background: meta.color }} />
              {meta.label}
              <span className={`tab-risk-pill ${riskCfg.cls}`}>
                {(r.probability * 100).toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>

      <div className={`map-wrapper ${isNavigating ? 'navigating-3d' : ''}`}>
        <MapContainer
          scrollWheelZoom={false}
          zoomControl={true}
          style={{ height: "100%", width: "100%" }}
        >
          <MapInteractionEnabler />
          <TileLayer
            attribution='&copy; TomTom'
            url={`https://api.tomtom.com/map/1/tile/basic/night/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`}
          />
          {showIncidents && (
            <TileLayer
              url={`https://api.tomtom.com/traffic/map/4/tile/incidents/s3/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`}
              opacity={0.8}
            />
          )}
          <FitBounds positions={activePositions} />
          <LiveLocationUpdater
            livePosition={livePosition}
            isNavigating={isNavigating}
          />
          <FleetSimulator isEnabled={cityPlannerMode} routeOptions={routeOptions} />

          {/* Draw inactive routes first, active route last to ensure it's on top */}
          {[...routeOptions]
            .sort((a, b) => (a.route_id === activeRouteId ? 1 : -1))
            .map((r) => {
              const originalIndex = routeOptions.findIndex(
                (ro) => ro.route_id === r.route_id,
              );
              const meta = ROUTE_META[originalIndex] ?? ROUTE_META[0];
              const isActive = r.route_id === activeRouteId;
              const pos = r.geometry.map((c) => [c[1], c[0]]);
              return (
                <Polyline
                  key={`${r.route_id}-${isActive ? "active" : "inactive"}`}
                  positions={pos}
                  color={meta.color}
                  weight={isActive ? 6 : 3}
                  opacity={isActive ? 0.92 : 0.3}
                  dashArray={isActive ? undefined : "8 6"}
                  eventHandlers={{ click: () => onRouteSelect(r.route_id) }}
                />
              );
            })}

          <Marker position={start}>
            <Popup>
              <strong>📍 Current Location</strong>
            </Popup>
          </Marker>
          <Marker position={end}>
            <Popup>
              <strong>🏁 Destination</strong>
            </Popup>
          </Marker>

          {isNavigating && livePosition && (
            <CircleMarker
              center={livePosition}
              radius={8}
              pathOptions={{
                fillColor: "#3b82f6",
                color: "#ffffff",
                weight: 3,
                fillOpacity: 1,
              }}
            >
              <Popup>
                <strong>🚙 You are here</strong>
                <br />
                Speed: {currentSpeed} km/h
              </Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>

      {/* Street-level preview for the active route midpoint */}
      <StreetPreview
        geometry={activeRoute.geometry}
        routeLabel={
          ROUTE_META[routeOptions.indexOf(activeRoute)]?.label ?? "Route"
        }
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────

function AutocompleteInput({
  id,
  label,
  icon: Icon,
  placeholder,
  value,
  onChange,
  onSelect,
  disabled,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);
  const TOMTOM_API_KEY =
    import.meta.env.VITE_TOMTOM_API_KEY || "quMDWPqrTCCd5Mbleyy3rTlJFkQaHYoH";

  useEffect(() => {
    if (!value || !value.trim() || !showSuggestions) {
      setSuggestions([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setError(null);
        const res = await fetch(
          `https://api.tomtom.com/search/2/search/${encodeURIComponent(value)}.json?key=${TOMTOM_API_KEY}&limit=8&typeahead=true&minFuzzyLevel=1&maxFuzzyLevel=2`,
        );

        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }

        const response = await res.json();

        const parsed = (response.results || []).map((item) => ({
          label:
            item.address.freeformAddress || item.address.municipality || "",
          name: item.poi
            ? item.poi.name
            : item.address.localName ||
              item.address.freeformAddress ||
              "Location",
          lat: item.position.lat,
          lng: item.position.lon,
        }));
        setSuggestions(parsed);
      } catch (err) {
        console.error("Actual error:", err);
        setError("Failed to load suggestions.");
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, showSuggestions, TOMTOM_API_KEY]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (feature) => {
    const label = feature.label || feature.name || "Selected Location";
    const selectedLocation = {
      name: label,
      lat: feature.lat,
      lng: feature.lng,
    };

    onSelect(selectedLocation);
    setShowSuggestions(false);
  };

  return (
    <div className="form-group autocomplete-container" ref={dropdownRef}>
      <label>
        <Icon size={14} style={{ display: "inline", marginRight: 5 }} />
        {label}
      </label>
      <input
        type="text"
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        disabled={disabled}
        autoComplete="off"
        required
      />

      {showSuggestions && value && value.trim() && (
        <div className="autocomplete-dropdown">
          {loading && (
            <div className="autocomplete-msg">
              <span className="spinner-small" /> Loading...
            </div>
          )}
          {!loading && error && (
            <div className="autocomplete-msg error">{error}</div>
          )}
          {!loading && !error && suggestions.length === 0 && (
            <div className="autocomplete-msg">No suggestions found.</div>
          )}
          {!loading && !error && suggestions.length > 0 && (
            <ul className="autocomplete-list">
              {suggestions.map((item, idx) => (
                <li
                  key={idx}
                  onClick={() => handleSelect(item)}
                  className="autocomplete-item"
                >
                  <MapPin size={16} className="autocomplete-icon" />
                  <div className="autocomplete-text">
                    <span className="autocomplete-name">
                      {item.name || item.label}
                    </span>
                    {item.label && item.label !== item.name && (
                      <span className="autocomplete-address">{item.label}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [locationState, setLocationState] = useState({
    loading: true,
    error: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [currentLocationText, setCurrentLocationText] = useState("");
  const [currentCoords, setCurrentCoords] = useState(null);

  const [destinationText, setDestinationText] = useState("");
  const [destinationCoords, setDestinationCoords] = useState(null);

  const [travelMode, setTravelMode] = useState("car");
  const [recentRoutes, setRecentRoutes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("recentRoutes")) || [];
    } catch {
      return [];
    }
  });

  const [totalCO2Saved, setTotalCO2Saved] = useState(() => {
    try {
      return parseFloat(localStorage.getItem("totalCO2Saved")) || 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const handleAddCo2 = (e) => {
      setTotalCO2Saved(prev => {
        const next = prev + e.detail;
        localStorage.setItem("totalCO2Saved", next);
        return next;
      });
    };
    window.addEventListener('addCo2', handleAddCo2);
    return () => window.removeEventListener('addCo2', handleAddCo2);
  }, []);

  const resetCo2 = () => {
    setTotalCO2Saved(0);
    localStorage.setItem("totalCO2Saved", 0);
  };

  const ORS_API_KEY =
    import.meta.env.VITE_ORS_API_KEY ||
    "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjE5ODU5MTFhZDdhYTQ0NWFhMzgxMjJiYjU2MmM1OGY4IiwiaCI6Im11cm11cjY0In0=";

  // ── Result state ──────────────────────────────────────────────────────────
  const [routeOptions, setRouteOptions] = useState(null);
  const [recommendedId, setRecommendedId] = useState(null);
  const [activeRouteId, setActiveRouteId] = useState(null);
  const [rerouteAdvice, setRerouteAdvice] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [routeExplanation, setRouteExplanation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  // ── Chat UI State ─────────────────────────────────────────────────────────
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "agent",
      text: "Hi! I am NavMind AI. How can I help you navigate today?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const handleAgentChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setChatInput("");
    setIsAgentTyping(true);

    try {
      const payload = {
        user_prompt: userMsg,
        current_lat: currentCoords?.lat || 34.0522,
        current_lng: currentCoords?.lng || -118.2437,
      };
      const res = await axios.post(`${API_URL}/agent/chat`, payload);
      const agentData = res.data;

      setChatMessages((prev) => [
        ...prev,
        {
          sender: "agent",
          text: agentData.response,
          route_data: agentData.route_data,
        },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "agent",
          text: "Sorry, I encountered an error connecting to the AI.",
        },
      ]);
    } finally {
      setIsAgentTyping(false);
    }
  };

  // ── Voice Recognition ─────────────────────────────────────────
  const toggleVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setChatInput(transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  // ── Geolocation ───────────────────────────────────────────────────────────
  const GEO_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  };

  const GEO_ERRORS = {
    1: "Location access denied. Please enable location or enter coordinates manually.",
    2: "Location unavailable. Your device could not determine position.",
    3: "Location request timed out. Please try again.",
  };

  const fetchReverseGeocode = async (lat, lng) => {
    try {
      const TOMTOM_API_KEY =
        import.meta.env.VITE_TOMTOM_API_KEY ||
        "quMDWPqrTCCd5Mbleyy3rTlJFkQaHYoH";
      const res = await fetch(
        `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json?key=${TOMTOM_API_KEY}`,
      );
      if (!res.ok) throw new Error("Reverse geocode failed");
      const data = await res.json();
      const address = data.addresses?.[0]?.address;
      if (address) {
        const display =
          address.freeformAddress || address.localName || "Current Location";
        setCurrentLocationText(`Current Location: ${display}`);
      } else {
        setCurrentLocationText(`Current Location`);
      }
    } catch (err) {
      console.error(err);
      setCurrentLocationText(`Current Location`);
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState({
        loading: false,
        error: "Geolocation is not supported by your browser.",
      });
      return;
    }
    setLocationState({ loading: true, error: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationState({
          loading: false,
          error: null,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setCurrentCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        fetchReverseGeocode(pos.coords.latitude, pos.coords.longitude);
      },
      (geoErr) =>
        setLocationState({
          loading: false,
          error: GEO_ERRORS[geoErr.code] ?? "Unknown location error.",
        }),
      GEO_OPTIONS,
    );
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationState({
          loading: false,
          error: null,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setCurrentCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        fetchReverseGeocode(pos.coords.latitude, pos.coords.longitude);
      },
      (geoErr) =>
        setLocationState({
          loading: false,
          error: GEO_ERRORS[geoErr.code] ?? "Unknown location error.",
        }),
      GEO_OPTIONS,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dark mode ─────────────────────────────────────────────────────────────
  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.body.classList.toggle("dark-mode", next);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!currentCoords) {
      setError("Please select a valid current location from suggestions.");
      return;
    }
    if (!destinationCoords) {
      setError("Please select a valid destination from suggestions.");
      return;
    }
    setHasAnalyzed(true);
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post(`${API_URL}/realtime`, {
        current_lat: currentCoords.lat,
        current_lng: currentCoords.lng,
        destination_lat: destinationCoords.lat,
        destination_lng: destinationCoords.lng,
        travel_mode: travelMode,
      });

      const d = res.data;
      setRouteOptions(d.route_options);
      setRecommendedId(d.recommended_route_id);
      setActiveRouteId(d.recommended_route_id);
      setRerouteAdvice(d.reroute_advice);
      setPrediction(d.prediction);
      setExplanation(d.explanation);
      setRouteExplanation(d.route_explanation || null);
      setRecommendation(d.recommendation);
      setSimulation(d.scenarios);
      setWeather(d.weather);

      // Save to recent routes
      const newRecent = {
        currText: currentLocationText,
        currCoords: currentCoords,
        destText: destinationText,
        destCoords: destinationCoords,
      };
      const filtered = recentRoutes.filter(
        (r) => r.destText !== destinationText,
      );
      const updated = [newRecent, ...filtered].slice(0, 3);
      setRecentRoutes(updated);
      localStorage.setItem("recentRoutes", JSON.stringify(updated));
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
          "An error occurred connecting to the backend.",
      );
    } finally {
      setLoading(false);
    }
  };

  const featureData = explanation
    ? Object.entries(explanation.feature_importance).map(
        ([name, importance]) => ({ name, importance }),
      )
    : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`app-container ${darkMode ? "dark-mode" : ""} ${!hasAnalyzed ? "hero-mode" : ""}`}
    >
      {/* ── HERO BACKGROUND (user can replace the image in src/assets/hero-bg.jpg) ── */}
      <div className="hero-background" />

      {/* ── HEADER ── */}
      <header className="app-header">
        <div className="app-header__brand">
          <h1>NavMind AI</h1>
        </div>
        <button
          onClick={toggleDarkMode}
          className="theme-toggle"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main className={`dashboard ${!hasAnalyzed ? "dashboard--hero" : ""}`}>
        {/* ── INPUT PANEL ── */}
        <section className="card input-panel">
          <h2>Route Analysis</h2>

          {/* Quick Saves / Recent Routes */}
          {recentRoutes.length > 0 && !hasAnalyzed && (
            <div className="recent-routes">
              <span className="recent-label">
                <Bookmark size={14} /> Recent:
              </span>
              <div className="recent-pills">
                {recentRoutes.map((r, i) => (
                  <button
                    key={i}
                    className="recent-pill"
                    onClick={() => {
                      setCurrentLocationText(r.currText);
                      setCurrentCoords(r.currCoords);
                      setDestinationText(r.destText);
                      setDestinationCoords(r.destCoords);
                    }}
                  >
                    {r.destText.split(",")[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <AutocompleteInput
              id="current-location-input"
              label="Current Location"
              icon={MapPin}
              placeholder="Search current location..."
              value={currentLocationText}
              onChange={(val) => {
                setCurrentLocationText(val);
                setCurrentCoords(null);
              }}
              onSelect={(loc) => {
                setCurrentLocationText(loc.name);
                setCurrentCoords({
                  lat: loc.lat,
                  lng: loc.lng,
                  name: loc.name,
                });
              }}
            />

            <AutocompleteInput
              id="destination-input"
              label="Destination"
              icon={Navigation}
              placeholder="Search destination..."
              value={destinationText}
              onChange={(val) => {
                setDestinationText(val);
                setDestinationCoords(null);
              }}
              onSelect={(loc) => {
                setDestinationText(loc.name);
                setDestinationCoords({
                  lat: loc.lat,
                  lng: loc.lng,
                  name: loc.name,
                });
              }}
            />

            {/* Multi-Mode Toggle */}
            <div className="travel-mode-toggle">
              <button
                type="button"
                className={`mode-btn ${travelMode === "car" ? "active" : ""}`}
                onClick={() => setTravelMode("car")}
              >
                <Car size={16} /> Car
              </button>
              <button
                type="button"
                className={`mode-btn ${travelMode === "motorcycle" ? "active" : ""}`}
                onClick={() => setTravelMode("motorcycle")}
              >
                <Bike size={16} /> Bike
              </button>
              <button
                type="button"
                className={`mode-btn ${travelMode === "pedestrian" ? "active" : ""}`}
                onClick={() => setTravelMode("pedestrian")}
              >
                <Footprints size={16} /> Walk
              </button>
            </div>

            {locationState.error && (
              <div
                className="location-error-wrap"
                style={{
                  marginBottom: "14px",
                  fontSize: "0.82rem",
                  color: "var(--high-risk)",
                }}
              >
                <span className="location-error-msg">
                  {locationState.error}
                </span>
                <button
                  type="button"
                  className="btn-retry-location"
                  style={{
                    marginLeft: "10px",
                    padding: "3px 8px",
                    fontSize: "0.75rem",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                  onClick={requestLocation}
                >
                  ↺ Retry
                </button>
              </div>
            )}

            <button
              type="submit"
              id="analyze-btn"
              disabled={loading || !currentCoords || !destinationCoords}
              className="btn-submit"
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Analyzing…
                </>
              ) : !currentCoords && locationState.loading ? (
                <>
                  <span className="spinner" />
                  Waiting for location…
                </>
              ) : (
                <>Analyze Route</>
              )}
            </button>
          </form>
          {error && (
            <div className="error-msg">
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          {/* Quick stats summary when results are loaded */}
          {routeOptions && (
            <div className="result-summary">
              <div className="result-summary__item">
                <span className="result-summary__num">
                  {routeOptions.length}
                </span>
                <span className="result-summary__lbl">Routes</span>
              </div>
              <div className="result-summary__item">
                <span className="result-summary__num">
                  {(
                    Math.min(...routeOptions.map((r) => r.probability)) * 100
                  ).toFixed(0)}
                  %
                </span>
                <span className="result-summary__lbl">Best Risk</span>
              </div>
              <div className="result-summary__item">
                <span className="result-summary__num">
                  {Math.min(...routeOptions.map((r) => r.distance))} km
                </span>
                <span className="result-summary__lbl">Shortest</span>
              </div>
            </div>
          )}

          <EcoProfile co2Saved={totalCO2Saved} onReset={resetCo2} />
        </section>

        {/* ── RESULTS GRID ── */}
        <div className="results-grid">
          {/* AI RECOMMENDATION MESSAGE */}
          {routeOptions && (
            <AIRecommendationMessage
              routeOptions={routeOptions}
              recommendedId={recommendedId}
              rerouteAdvice={rerouteAdvice}
            />
          )}

          {/* MAP */}
          {routeOptions && (
            <MapView
              routeOptions={routeOptions}
              activeRouteId={activeRouteId}
              onRouteSelect={setActiveRouteId}
            />
          )}

          {/* ROUTE COMPARISON CARDS */}
          {routeOptions && (
            <RouteComparisonPanel
              routeOptions={routeOptions}
              activeRouteId={activeRouteId}
              recommendedId={recommendedId}
              onSelect={setActiveRouteId}
              weather={weather}
              rerouteAdvice={rerouteAdvice}
            />
          )}

          {/* PREDICTION */}
          {prediction && (
            <section className="card prediction-panel">
              <h2>
                <CheckCircle size={20} /> Prediction
              </h2>
              <div className="prediction-content">
                <div
                  className={`status-badge ${prediction.prediction === 1 ? "high-risk" : "low-risk"}`}
                >
                  {prediction.prediction === 1
                    ? "⚠ Congestion Likely"
                    : "✓ Traffic Clear"}
                </div>
                <div className="metric">
                  <span>Probability:</span>
                  <strong>{(prediction.probability * 100).toFixed(1)}%</strong>
                </div>
                <div className="metric">
                  <span>Best Model:</span>
                  <strong>{prediction.best_model?.replace(/_/g, " ")}</strong>
                </div>
                {weather && (
                  <div className="metric">
                    <span>Weather:</span>
                    <strong style={{ textTransform: "capitalize" }}>
                      {weather}
                    </strong>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* RECOMMENDATION */}
          {recommendation && (
            <section className="card recommendation-panel">
              <h2>
                <Clock size={20} /> Departure Timing
              </h2>
              <div className="metric">
                <span>Best Departure Time:</span>
                <strong>{recommendation.recommended_hour}:00</strong>
              </div>
              <div className="metric">
                <span>Lowest Probability:</span>
                <strong>
                  {(recommendation.lowest_probability * 100).toFixed(1)}%
                </strong>
              </div>
              <div className="metric">
                <span>Risk Level:</span>
                <strong
                  className={`risk-${recommendation.risk_level.toLowerCase()}`}
                >
                  {recommendation.risk_level}
                </strong>
              </div>
            </section>
          )}

          {/* AI INSIGHTS / XAI */}
          {routeExplanation && (
            <section className="card explanation-panel">
              <h2>
                <Brain size={20} /> AI Insights
              </h2>

              {/* Summary sentence */}
              {routeExplanation.summary && (
                <p style={{
                  fontSize: "0.88rem",
                  color: "var(--text-muted)",
                  marginBottom: "20px",
                  lineHeight: 1.6,
                }}>
                  {routeExplanation.summary.replace(/\*\*/g, "")}
                </p>
              )}

              {/* Factor Impact Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {(routeExplanation.factors || []).map((factor) => (
                  <div key={factor.key} style={{
                    padding: "14px 16px",
                    borderRadius: "8px",
                    background: "var(--bg-color)",
                    border: "1px solid var(--border-color)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "1.1rem" }}>{factor.icon}</span>
                        <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{factor.label}</span>
                      </div>
                      <span style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "20px",
                        background: factor.impact_color + "18",
                        color: factor.impact_color,
                        border: `1px solid ${factor.impact_color}40`,
                      }}>
                        {factor.impact} Impact
                      </span>
                    </div>
                    {/* Contribution bar */}
                    <div style={{ height: "6px", background: "var(--border-color)", borderRadius: "4px", marginBottom: "8px" }}>
                      <div style={{
                        height: "100%",
                        width: `${factor.contribution_pct}%`,
                        background: factor.impact_color,
                        borderRadius: "4px",
                        transition: "width 0.8s ease",
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                        {factor.detail}
                      </p>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: factor.impact_color, flexShrink: 0 }}>
                        {factor.contribution_pct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* LEGACY XAI BAR CHART - Key Factors */}
          {explanation && !routeExplanation && (
            <section className="card explanation-panel">
              <h2>
                <Info size={20} /> Key Factors
              </h2>
              <div className="metric highlight">
                <span>Top Factor:</span>
                <strong>{explanation.top_factor.replace(/_/g, " ")}</strong>
              </div>
              <div className="chart-container-small">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart
                    data={featureData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={85}
                      tick={{ fontSize: 11, fill: "var(--text-color)" }}
                    />
                    <Tooltip cursor={{ fill: "transparent" }} />
                    <Bar
                      dataKey="importance"
                      fill="var(--primary-color)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* 12-HOUR SMART DEPARTURE FORECAST */}
          {simulation && (() => {
            const bestSlot = simulation.reduce((best, s) =>
              s.probability < best.probability ? s : best
            , simulation[0]);
            const currentSlot = simulation[0];
            const saving = ((currentSlot.probability - bestSlot.probability) * 100).toFixed(0);

            return (
              <section className="card scenario-panel full-width">
                <h2>
                  <TrendingDown size={20} /> 12-Hour Smart Departure Forecast
                </h2>

                {/* Smart callout banner */}
                {bestSlot.hour !== currentSlot.hour && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: "rgba(5, 150, 105, 0.08)",
                    border: "1px solid rgba(5, 150, 105, 0.25)",
                    marginBottom: "20px",
                  }}>
                    <span style={{ fontSize: "1.4rem" }}>💡</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem", color: "var(--text-color)" }}>
                        Best departure: <span style={{ color: "#059669" }}>{bestSlot.time_label}</span> — {(bestSlot.probability * 100).toFixed(0)}% congestion risk
                      </p>
                      <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 3 }}>
                        Leaving now ({currentSlot.time_label}) shows {(currentSlot.probability * 100).toFixed(0)}% risk.
                        {Number(saving) > 5 ? ` Waiting saves ~${saving}% congestion risk.` : " Current timing is already optimal."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart
                      data={simulation}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis
                        dataKey="time_label"
                        stroke="var(--text-muted)"
                        tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                        interval={1}
                        angle={-30}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis
                        domain={[0, 1]}
                        tickFormatter={(t) => `${(t * 100).toFixed(0)}%`}
                        stroke="var(--text-muted)"
                        tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      />
                      <Tooltip
                        formatter={(v, name) => [`${(v * 100).toFixed(1)}%`, "Congestion Risk"]}
                        labelFormatter={(l) => `Depart at ${l}`}
                        contentStyle={{
                          background: "var(--card-bg)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          fontSize: "0.85rem",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="probability"
                        name="Congestion Risk"
                        stroke="var(--primary-color)"
                        strokeWidth={2.5}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          const color = payload.risk_level === "High" ? "#dc2626"
                            : payload.risk_level === "Medium" ? "#d97706" : "#059669";
                          const isBest = payload.hour === bestSlot.hour;
                          return (
                            <circle
                              key={payload.hour}
                              cx={cx} cy={cy}
                              r={isBest ? 7 : 4}
                              fill={isBest ? "#059669" : color}
                              stroke={isBest ? "#ffffff" : "none"}
                              strokeWidth={isBest ? 2 : 0}
                            />
                          );
                        }}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Risk legend */}
                <div style={{ display: "flex", gap: "16px", marginTop: "12px", flexWrap: "wrap" }}>
                  {[["#059669", "Low Risk (<40%)"], ["#d97706", "Medium Risk (40-70%)"], ["#dc2626", "High Risk (>70%)"]].map(([color, label]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
                      {label}
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#059669", border: "2px solid white", outline: "1px solid #059669", display: "inline-block" }} />
                    Best Departure Time
                  </div>
                </div>
              </section>
            );
          })()}
        </div>
      </main>

      {/* ── AI Agent Chat UI ── */}
      <button
        className="agent-fab"
        onClick={() => setIsChatOpen(!isChatOpen)}
        aria-label="Ask NavMind AI"
      >
        {isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {isChatOpen && (
        <div className="agent-chat-window">
          <div className="agent-chat-header">
            <div className="agent-chat-title">
              <Zap size={18} color="var(--primary-color)" /> NavMind AI
            </div>
            <button
              className="agent-chat-close"
              onClick={() => setIsChatOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="agent-chat-messages">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`chat-msg chat-msg--${msg.sender}`}>
                <ReactMarkdown>{msg.text}</ReactMarkdown>
                {msg.route_data && (
                  <div
                    className="chat-msg--agent-route"
                    onClick={() => {
                      setRouteOptions([msg.route_data]);
                      setRecommendedId(msg.route_data.route_id);
                      setActiveRouteId(msg.route_data.route_id);
                      setHasAnalyzed(true);
                    }}
                  >
                    📍 View Suggested Route
                  </div>
                )}
              </div>
            ))}
            {isAgentTyping && (
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            )}
          </div>
          <form className="agent-chat-input-area" onSubmit={handleAgentChat}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isListening ? "Listening... speak now" : "Ask for a route or traffic info..."}
            />
            <button
              type="button"
              className={`agent-chat-send mic-btn ${isListening ? "mic-btn--listening" : ""}`}
              onClick={toggleVoice}
              title={isListening ? "Stop listening" : "Speak to NavMind AI"}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              type="submit"
              className="agent-chat-send"
              disabled={!chatInput.trim() || isAgentTyping}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
