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
import EcoProfile from "./EcoProfile.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// Voice Synthesis Helper (Nova)
// ─────────────────────────────────────────────────────────────────────────────

if ('speechSynthesis' in window) {
  // Trigger voice loading
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

const speakAsNova = (text) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel(); // Stop any current speech
  
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  
  // Look for known high-quality female English voices (Online Neural voices sound like Siri)
  const preferredNames = ["Microsoft Aria Online", "Microsoft Jenny Online", "Google US English", "Samantha", "Victoria", "Karen", "Microsoft Zira"];
  let selectedVoice = voices.find(v => preferredNames.some(name => v.name.includes(name)));
  
  // Fallback heuristics
  if (!selectedVoice) {
    selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman')));
  }
  if (!selectedVoice) {
    selectedVoice = voices.find(v => v.lang === 'en-US' || v.lang === 'en-GB');
  }
  
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  
  // Adjust pitch and rate to sound more natural and dynamic
  utterance.pitch = 1.15;
  utterance.rate = 1.05;
  
  // Prevent feedback loops: mute recognition while speaking
  window.isNovaSpeaking = true;
  utterance.onstart = () => { window.isNovaSpeaking = true; };
  utterance.onend = () => { window.isNovaSpeaking = false; };
  utterance.onerror = () => { window.isNovaSpeaking = false; };
  
  window.speechSynthesis.speak(utterance);
};

const stripMarkdownForSpeech = (text) => {
  if (!text) return "";
  return text
    // Replace list items with periods for natural pausing
    .replace(/(^|\n)\s*[-*+]\s/g, ". ")
    // Remove bold/italic asterisks, underscores, tildes, backticks
    .replace(/[*_~`]/g, "")
    // Remove headers
    .replace(/#+\s/g, "")
    // Remove markdown links but keep the text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    // Normalize multiple spaces and multiple periods
    .replace(/\s+/g, " ")
    .replace(/\.{2,}/g, ". ")
    .trim();
};

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

function AIRecommendationMessage({ routeOptions, recommendedId, rerouteAdvice }) {
  if (!routeOptions || routeOptions.length === 0) return null;

  const recRoute = routeOptions.find((r) => r.route_id === recommendedId) ?? routeOptions[0];
  const recIdx = routeOptions.indexOf(recRoute);
  const recMeta = ROUTE_META[recIdx] ?? ROUTE_META[0];
  const riskLevel = getRiskLevel(recRoute.probability);
  const riskCfg = RISK_CONFIG[riskLevel];
  const isReroute = rerouteAdvice?.reroute_advised;
  const improvement = rerouteAdvice?.improvement ?? 0;
  const riskColors = { low: "#059669", medium: "#d97706", high: "#dc2626" };
  const riskColor = riskColors[riskLevel];

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${recMeta.color}18 0%, ${recMeta.color}06 100%)`,
        border: `1px solid ${recMeta.color}40`,
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        gridColumn: "1 / -1",
        animation: "fadeInUp 0.4s ease",
      }}
      role="status" aria-live="polite"
    >
      {/* Nova AI badge */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        padding: "8px 14px", borderRadius: 999,
        background: `${recMeta.color}22`, border: `1px solid ${recMeta.color}50`,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: recMeta.color, animation: "pulse 1.5s infinite" }} />
        <Zap size={15} color={recMeta.color} />
        <span style={{ fontWeight: 700, fontSize: "0.82rem", color: recMeta.color }}>Nova AI</span>
      </div>

      {/* Message */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-color)", marginBottom: 3 }}>
          {isReroute
            ? `🔄 Rerouting to ${recMeta.label} — ${(improvement * 100).toFixed(0)}% lower congestion risk`
            : `✨ ${recMeta.label} is your optimal route`}
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          {recRoute.distance} km &bull; {recRoute.duration} min drive &bull; +{recRoute.traffic_delay} min delay
        </div>
      </div>

      {/* Risk pill */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0,
        padding: "8px 16px", borderRadius: 10,
        background: `${riskColor}12`, border: `1px solid ${riskColor}35`,
      }}>
        <span style={{ fontSize: "1.1rem", fontWeight: 800, color: riskColor }}>{(recRoute.probability * 100).toFixed(0)}%</span>
        <span style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>Risk</span>
      </div>

      {/* Route colour chip */}
      <div style={{
        width: 12, height: 40, borderRadius: 6,
        background: `linear-gradient(180deg, ${recMeta.color}, ${recMeta.color}66)`,
        flexShrink: 0,
      }} />
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

  const maxEta = Math.max(...routeOptions.map(r => r.duration + r.traffic_delay));

  return (
    <section
      className="card route-comparison-panel full-width"
      aria-label="Route comparison"
    >
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Route size={20} color="var(--primary-color)" /> Route Options
        {weather && (
          <span style={{ fontSize: "0.78rem", fontWeight: 400, marginLeft: "auto", opacity: 0.7 }}>
            {weatherIcon} <strong style={{ textTransform: "capitalize" }}>{weather}</strong>
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
          const totalEta = (r.duration + r.traffic_delay);
          const etaPct = ((totalEta / maxEta) * 100).toFixed(0);
          const riskColors = { low: "#059669", medium: "#d97706", high: "#dc2626" };
          const riskColor = riskColors[riskKey];

          return (
            <div
              key={r.route_id}
              className={["rc-card", isActive ? "rc-card--active" : "", isRecommended ? "rc-card--best" : ""].join(" ")}
              style={{ "--rc-color": meta.color, position: "relative", overflow: "hidden" }}
              onClick={() => onSelect(r.route_id)}
              role="button" tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelect(r.route_id)}
              aria-pressed={isActive}
            >
              {/* Coloured glow top accent */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${meta.color}, ${meta.color}88)`,
                borderRadius: "12px 12px 0 0",
              }} />

              {/* Header */}
              <div className="rc-card__header" style={{ marginTop: 8 }}>
                <div className="rc-card__title-row">
                  <span className="rc-card__color-dot" style={{ background: meta.color }} />
                  <span className="rc-card__label">{meta.label}</span>
                </div>
                <div className="rc-card__badges">
                  {isRecommended && <span className="badge badge--best">★ AI Pick</span>}
                  <span className={`risk-pill ${riskCfg.cls}`}>{riskCfg.icon} {riskCfg.label}</span>
                </div>
              </div>

              {/* Primary stats grid */}
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
                    <span className="rc-stat__value" style={{ color: r.traffic_delay > 15 ? "#ef4444" : r.traffic_delay > 5 ? "#f59e0b" : "#22c55e" }}>
                      +{r.traffic_delay} min
                    </span>
                  </div>
                </div>
                <div className="rc-stat">
                  <span className="rc-stat__icon" style={{ color: "#10b981" }}><Leaf size={14} /></span>
                  <div className="rc-stat__body">
                    <span className="rc-stat__label">Est. CO₂</span>
                    <span className="rc-stat__value" style={{ color: "#10b981" }}>{r.co2_emission} kg</span>
                  </div>
                </div>
              </div>

              {/* ETA comparison bar */}
              <div style={{ padding: "0 4px", marginTop: 6, marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 5 }}>
                  <span>Total ETA</span>
                  <strong style={{ color: "var(--text-color)" }}>{totalEta.toFixed(1)} min</strong>
                </div>
                <div style={{ height: 8, borderRadius: 6, background: "var(--border-color)" }}>
                  <div style={{
                    height: "100%", borderRadius: 6,
                    width: `${etaPct}%`,
                    background: `linear-gradient(90deg, ${meta.color}, ${meta.color}bb)`,
                    transition: "width 1s ease",
                  }} />
                </div>
              </div>

              {/* Congestion risk bar */}
              <div className="rc-card__risk-bar-wrap">
                <div className="rc-card__risk-bar-label">
                  <span>Congestion Risk</span>
                  <strong style={{ color: riskColor }}>{(r.probability * 100).toFixed(0)}%</strong>
                </div>
                <div className="rc-card__risk-bar-track">
                  <div
                    className={`rc-card__risk-bar-fill rc-card__risk-bar-fill--${riskKey}`}
                    style={{ width: `${(r.probability * 100).toFixed(0)}%` }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="rc-card__footer">
                <span className="rc-card__model" style={{ fontFamily: "monospace", fontSize: "0.7rem" }}>
                  {r.best_model?.replace(/_/g, " ")}
                </span>
                <button
                  className={`btn-switch-route ${isActive ? "btn-switch-route--active" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onSelect(r.route_id); }}
                  aria-label={`Switch to ${meta.label}`}
                  style={isActive ? { background: meta.color, border: `1px solid ${meta.color}` } : {}}
                >
                  {isActive ? "✓ Active" : "Select"}
                  {!isActive && <ArrowRight size={13} style={{ marginLeft: 4 }} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI decision reason */}
      {rerouteAdvice?.reason && (
        <div className="reroute-reason" style={{ marginTop: 16 }}>
          <Zap size={14} style={{ flexShrink: 0, marginTop: 2, color: "var(--primary-color)" }} />
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
  const OWM_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || "bd2853ec01fa4d04454a1f4d8b963255";
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
      style={{ position: "relative", padding: 0, overflow: "hidden" }}
    >
      {/* Premium Map Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 18px",
        background: "linear-gradient(135deg, rgba(79,70,229,0.08), rgba(124,58,237,0.04))",
        borderBottom: "1px solid var(--border-color)",
      }}>
        <h2 style={{ margin: 0, padding: 0, border: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <MapPin size={20} color="var(--primary-color)" />
          <span>Interactive Route Map</span>
          {isNavigating && (
            <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)", letterSpacing: "0.08em" }}>
              ● LIVE
            </span>
          )}
        </h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setShowIncidents(!showIncidents)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 999, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
              background: showIncidents ? "var(--primary-color)" : "transparent",
              color: showIncidents ? "white" : "var(--primary-color)",
              border: `1px solid var(--primary-color)`, transition: "all 0.2s",
            }}
          >
            <Layers size={14} />
            {showIncidents ? "Incidents On" : "Incidents"}
          </button>
          <button
            onClick={() => setCityPlannerMode(!cityPlannerMode)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 999, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
              background: cityPlannerMode ? "#7c3aed" : "transparent",
              color: cityPlannerMode ? "white" : "#7c3aed",
              border: `1px solid #7c3aed`, transition: "all 0.2s",
            }}
          >
            <MapPin size={14} />
            {cityPlannerMode ? "Fleet Mode On" : "Fleet Mode"}
          </button>
          <button
            onClick={toggleNavigation}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 16px",
              borderRadius: 999, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
              background: isNavigating ? "#dc2626" : "linear-gradient(135deg, var(--primary-color), #7c3aed)",
              color: "white", border: "none", transition: "all 0.2s",
              boxShadow: isNavigating ? "0 0 12px rgba(220,38,38,0.4)" : "0 0 12px rgba(79,70,229,0.3)",
            }}
          >
            {isNavigating ? "🛑 Stop" : "🧭 Navigate"}
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

      <div className="map-wrapper">
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
          <TileLayer
            url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`}
            opacity={0.7}
          />
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

  const coordsRef = useRef(null);

  const [currentLocationText, setCurrentLocationText] = useState("");
  const [currentCoords, setCurrentCoords] = useState(null);

  // Keep coordsRef synced with currentCoords for the continuous voice listener closure
  useEffect(() => {
    coordsRef.current = currentCoords;
  }, [currentCoords]);

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
      text: "Hi! I am Nova. How can I help you navigate today?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const sendToAgent = async (userMsg) => {
    if (!userMsg.trim()) return;

    setChatMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setIsAgentTyping(true);

    try {
      const payload = {
        user_prompt: userMsg,
        current_lat: coordsRef.current?.lat || 34.0522,
        current_lng: coordsRef.current?.lng || -118.2437,
      };
      const res = await axios.post(`${API_URL}/agent/chat`, payload, {
        timeout: 15000 // 15 second timeout to prevent infinite hang
      });
      const agentData = res.data;

      setChatMessages((prev) => [
        ...prev,
        {
          sender: "agent",
          text: agentData.response,
          route_data: agentData.route_data,
        },
      ]);
      
      if ('speechSynthesis' in window) {
        speakAsNova(stripMarkdownForSpeech(agentData.response));
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "agent",
          text: "Sorry, I encountered an error connecting to the AI.",
        },
      ]);
      if ('speechSynthesis' in window) {
        speakAsNova("Sorry, I encountered an error connecting to the AI.");
      }
    } finally {
      setIsAgentTyping(false);
    }
  };

  const handleAgentChat = async (e) => {
    e.preventDefault();
    const msg = chatInput;
    setChatInput("");
    await sendToAgent(msg);
  };

  // ── Voice Recognition (Continuous Push-to-Talk) ───────────────────────────
  const isListeningRef = useRef(false);

  const toggleVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    
    if (isListening) {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    
    setIsListening(true);
    isListeningRef.current = true;
    
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true; // Stay on after speaking!
    recognition.interimResults = false;
    
    recognition.onresult = async (event) => {
      if (window.isNovaSpeaking) return; // Prevent Nova from hearing herself
      
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      if (transcript.trim().length > 0) {
        setChatInput("");
        await sendToAgent(transcript);
      }
    };
    
    recognition.onend = () => {
      if (isListeningRef.current) {
        setTimeout(() => {
          try { recognition.start(); } catch(e){}
        }, 100);
      } else {
        setIsListening(false);
      }
    };
    
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        isListeningRef.current = false;
        setIsListening(false);
      }
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  // ── Background Wake Word "Nova" ─────────────────────────────────────────
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const wakeWordRecognitionRef = useRef(null);
  const novaAwakeRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isWakeWordActive) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      
      recognition.onstart = () => console.log("Wake word listener started");
      
      recognition.onresult = async (event) => {
        if (window.isNovaSpeaking) return; // Prevent Nova from hearing herself
        
        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript.toLowerCase();
        
        // If Nova is already awake, treat this as the command
        if (novaAwakeRef.current) {
           novaAwakeRef.current = false; // reset
           if (transcript.trim().length > 0) {
              setIsChatOpen(true);
              setChatInput("");
              await sendToAgent(transcript);
           }
           return;
        }

        if (transcript.includes("nova") || transcript.includes("hey nova")) {
          setIsChatOpen(true);
          
          let command = transcript;
          const wakeWordIndex = command.lastIndexOf("nova");
          if (wakeWordIndex !== -1) {
             command = command.substring(wakeWordIndex + 4).trim();
          }
          
          if (command.length > 0) {
             setChatInput("");
             await sendToAgent(command);
          } else {
             // Wake up and wait for the next command
             novaAwakeRef.current = true;
             if ('speechSynthesis' in window) {
               speakAsNova("Yes?");
             }
             
             // Put her back to sleep after 8 seconds if nothing is said
             setTimeout(() => {
                novaAwakeRef.current = false;
             }, 8000);
          }
        }
      };
      
      recognition.onend = () => {
         if (isWakeWordActive) {
            setTimeout(() => {
               try {
                  wakeWordRecognitionRef.current?.start();
               } catch (e) {}
            }, 100);
         }
      };

      recognition.onerror = (e) => {
         if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            setIsWakeWordActive(false);
         }
         // Ignore other errors (like no-speech) to let onend naturally restart it
      };
      
      wakeWordRecognitionRef.current = recognition;
      try {
         recognition.start();
      } catch (e) {}
    } else {
      if (wakeWordRecognitionRef.current) {
         wakeWordRecognitionRef.current.stop();
         wakeWordRecognitionRef.current = null;
      }
    }
    
    return () => {
      if (wakeWordRecognitionRef.current) {
         wakeWordRecognitionRef.current.stop();
      }
    };
  }, [isWakeWordActive]);

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
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            onClick={() => setIsWakeWordActive(!isWakeWordActive)}
            className={`btn-start-nav ${isWakeWordActive ? "active" : ""}`}
            style={{ 
              background: isWakeWordActive ? "rgba(79, 70, 229, 0.15)" : "transparent",
              color: isWakeWordActive ? "var(--primary-color)" : "var(--text-muted)",
              border: `1px solid ${isWakeWordActive ? "var(--primary-color)" : "var(--border-color)"}`,
              fontSize: "0.8rem",
              padding: "6px 12px",
              borderRadius: "20px"
            }}
            title="Enable continuous background listening for 'Hey Nova'"
          >
            {isWakeWordActive ? <Mic size={16} style={{ display: "inline", marginRight: 6 }} /> : <MicOff size={16} style={{ display: "inline", marginRight: 6 }} />}
            {isWakeWordActive ? "Nova is Listening" : "Wake Word Off"}
          </button>

          <button
            onClick={toggleDarkMode}
            className="theme-toggle"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <main className={`dashboard ${!hasAnalyzed ? "dashboard--hero" : ""}`}>
        {/* ── HERO COPY ── */}
        {!hasAnalyzed && (
          <div style={{
            textAlign: "center", color: "white", maxWidth: 540,
            animation: "fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
            display: "flex", flexDirection: "column", gap: 12
          }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "0 auto", padding: "6px 14px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 999, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", backdropFilter: "blur(10px)" }}>
              <Zap size={14} color="#a78bfa" /> NavMind OS 2.0
            </div>
            <h2 style={{ fontSize: "3.5rem", fontWeight: 900, margin: 0, lineHeight: 1.1, letterSpacing: "-0.03em", textShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
              Drive <span style={{ color: "#a78bfa" }}>Smarter.</span>
            </h2>
            <p style={{ fontSize: "1.1rem", opacity: 0.85, margin: 0, lineHeight: 1.5, textShadow: "0 2px 10px rgba(0,0,0,0.5)", fontWeight: 400 }}>
              AI-powered predictions, live incident scanning, and eco-routing. Your autonomous co-pilot for the road ahead.
            </p>
          </div>
        )}

        {/* ── INPUT PANEL ── */}
        <section 
          className="card input-panel" 
          style={!hasAnalyzed ? { padding: "32px 36px", borderRadius: 24, background: "var(--card-bg)" } : {}}
        >
          {hasAnalyzed && <h2>Route Analysis</h2>}

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
          {routeOptions && (() => {
            const minRisk = (Math.min(...routeOptions.map(r => r.probability)) * 100).toFixed(0);
            const minDist = Math.min(...routeOptions.map(r => r.distance));
            const minEta = Math.min(...routeOptions.map(r => r.duration + r.traffic_delay)).toFixed(0);
            const minCo2 = Math.min(...routeOptions.map(r => r.co2_emission));
            return (
              <div className="result-summary" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 14 }}>
                {[
                  { num: routeOptions.length, lbl: "Routes Found", icon: "🛣️", color: "#4f46e5" },
                  { num: `${minRisk}%`, lbl: "Best Risk", icon: "🎯", color: minRisk < 40 ? "#059669" : minRisk <= 70 ? "#d97706" : "#dc2626" },
                  { num: `${minEta} min`, lbl: "Fastest", icon: "⚡", color: "#0891b2" },
                  { num: `${minCo2} kg`, lbl: "Lowest CO₂", icon: "🌱", color: "#059669" },
                ].map(({ num, lbl, icon, color }) => (
                  <div key={lbl} style={{
                    padding: "10px 8px", borderRadius: 10,
                    background: `linear-gradient(135deg, ${color}12, ${color}04)`,
                    border: `1px solid ${color}30`,
                    textAlign: "center",
                    display: "flex", flexDirection: "column", justifyContent: "center"
                  }}>
                    <div style={{ fontSize: "1.1rem", marginBottom: 2 }}>{icon}</div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 800, color, lineHeight: 1.1 }}>{num}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{lbl}</div>
                  </div>
                ))}
              </div>
            );
          })()}

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
          {prediction && (() => {
            const pct = (prediction.probability * 100).toFixed(1);
            const isHigh = prediction.prediction === 1;
            const ringColor = isHigh
              ? `conic-gradient(#dc2626 0% ${pct}%, var(--border-color) ${pct}% 100%)`
              : `conic-gradient(#059669 0% ${pct}%, var(--border-color) ${pct}% 100%)`;
            return (
              <section className="card prediction-panel">
                <h2 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                  <CheckCircle size={20} color={isHigh ? "#dc2626" : "#059669"} /> AI Traffic Prediction
                </h2>

                <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
                  {/* Donut Ring */}
                  <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
                    <div style={{
                      width: 120, height: 120, borderRadius: "50%",
                      background: ringColor,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{
                        width: 84, height: 84, borderRadius: "50%",
                        background: "var(--card-bg)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontSize: "1.35rem", fontWeight: 800, color: isHigh ? "#dc2626" : "#059669", lineHeight: 1 }}>{pct}%</span>
                        <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Risk</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "6px 14px", borderRadius: 999,
                      background: isHigh ? "rgba(220,38,38,0.1)" : "rgba(5,150,105,0.1)",
                      border: `1px solid ${isHigh ? "rgba(220,38,38,0.4)" : "rgba(5,150,105,0.4)"}`,
                      marginBottom: 14,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: isHigh ? "#dc2626" : "#059669", animation: "pulse 1.5s infinite" }} />
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: isHigh ? "#dc2626" : "#059669" }}>
                        {isHigh ? "⚠ Congestion Likely" : "✓ Traffic Clear"}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="metric">
                        <span>AI Model:</span>
                        <strong style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--primary-color)" }}>{prediction.best_model?.replace(/_/g, " ")}</strong>
                      </div>
                      {weather && (
                        <div className="metric">
                          <span>Live Weather:</span>
                          <strong style={{ textTransform: "capitalize" }}>{weather}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* RECOMMENDATION */}
          {recommendation && (() => {
            const bestHour = recommendation.recommended_hour;
            const bestPct = (recommendation.lowest_probability * 100).toFixed(1);
            const riskLevel = recommendation.risk_level?.toLowerCase() || "low";
            const riskColors = { low: "#059669", medium: "#d97706", high: "#dc2626" };
            const riskColor = riskColors[riskLevel] || "#059669";
            return (
              <section className="card recommendation-panel">
                <h2 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                  <Clock size={20} color={riskColor} /> Optimal Departure
                </h2>

                {/* Big time display */}
                <div style={{
                  textAlign: "center",
                  padding: "20px 16px",
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${riskColor}15 0%, ${riskColor}05 100%)`,
                  border: `1px solid ${riskColor}35`,
                  marginBottom: 16,
                }}>
                  <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 4 }}>Best Time to Leave</div>
                  <div style={{ fontSize: "2.4rem", fontWeight: 900, color: riskColor, lineHeight: 1.1 }}>
                    {bestHour}:00
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                    {bestHour < 12 ? `${bestHour} AM` : bestHour === 12 ? "12 PM" : `${bestHour - 12} PM`}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1, padding: "10px 12px", borderRadius: 8, background: "var(--bg-color)", border: "1px solid var(--border-color)", textAlign: "center" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: riskColor }}>{bestPct}%</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Congestion Risk</div>
                  </div>
                  <div style={{ flex: 1, padding: "10px 12px", borderRadius: 8, background: "var(--bg-color)", border: "1px solid var(--border-color)", textAlign: "center" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: riskColor, textTransform: "capitalize" }}>{riskLevel}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Risk Level</div>
                  </div>
                </div>
              </section>
            );
          })()}

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

          {/* KEY FACTORS (XAI) */}
          {explanation && !routeExplanation && (() => {
            const factors = Object.entries(explanation.feature_importance || {})
              .sort(([,a],[,b]) => b - a)
              .slice(0, 4);
            const maxVal = factors[0]?.[1] || 1;
            const icons = { traffic_delay: "🚦", hour: "🕐", weather: "🌦", day_of_week: "📅" };
            const factorColors = ["#4f46e5", "#7c3aed", "#0891b2", "#059669"];
            return (
              <section className="card explanation-panel">
                <h2 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Info size={20} color="var(--primary-color)" /> Key Traffic Factors
                </h2>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.5 }}>
                  Drivers behind the current traffic prediction, ranked by AI model importance.
                </p>
                <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 16, background: "linear-gradient(135deg, rgba(79,70,229,0.12), rgba(79,70,229,0.04))", border: "1px solid rgba(79,70,229,0.3)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "1.5rem" }}>{icons[explanation.top_factor] || "📊"}</span>
                  <div>
                    <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>Top Factor</div>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--primary-color)" }}>{explanation.top_factor?.replace(/_/g, " ")}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {factors.map(([key, val], i) => {
                    const pct = ((val / maxVal) * 100).toFixed(0);
                    return (
                      <div key={key}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}>
                            <span>{icons[key] || "📊"}</span>{key.replace(/_/g, " ")}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: factorColors[i % factorColors.length], fontWeight: 700 }}>{pct}%</span>
                        </div>
                        <div style={{ height: 7, borderRadius: 4, background: "var(--border-color)" }}>
                          <div style={{ height: "100%", borderRadius: 4, width: `${pct}%`, background: `linear-gradient(90deg, ${factorColors[i % factorColors.length]}, ${factorColors[i % factorColors.length]}99)`, transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })()}



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
        aria-label="Ask Nova"
      >
        {isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {isChatOpen && (
        <div className="agent-chat-window" style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: 18,
          boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Premium header */}
          <div style={{
            padding: "14px 18px",
            background: "linear-gradient(135deg, var(--primary-color), #7c3aed)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Zap size={18} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: "white", fontSize: "0.95rem", lineHeight: 1 }}>Nova</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", animation: "pulse 1.5s infinite" }} />
                <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.75)" }}>
                  {isListening ? "Listening..." : "AI Assistant • Online"}
                </span>
              </div>
            </div>
            <button
              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "white", display: "flex" }}
              onClick={() => setIsChatOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="agent-chat-messages" style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
            {chatMessages.map((msg, idx) => (
              <div key={idx} style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.sender === "user" ? "flex-end" : "flex-start",
                marginBottom: 12,
                animation: "fadeInUp 0.25s ease",
              }}>
                {msg.sender === "agent" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg,var(--primary-color),#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={10} color="white" />
                    </div>
                    <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--primary-color)" }}>Nova</span>
                  </div>
                )}
                <div className={`chat-msg chat-msg--${msg.sender}`} style={{
                  borderRadius: msg.sender === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                  background: msg.sender === "user" ? "linear-gradient(135deg,var(--primary-color),#7c3aed)" : "var(--bg-color)",
                  color: msg.sender === "user" ? "white" : "var(--text-color)",
                  border: msg.sender === "agent" ? "1px solid var(--border-color)" : "none",
                  padding: "10px 14px", maxWidth: "88%",
                }}>
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                  {msg.route_data && (
                    <div
                      className="chat-msg--agent-route"
                      style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(79,70,229,0.12)", border: "1px solid rgba(79,70,229,0.3)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "var(--primary-color)" }}
                      onClick={() => {
                        setRouteOptions([msg.route_data]);
                        setRecommendedId(msg.route_data.route_id);
                        setActiveRouteId(msg.route_data.route_id);
                        setHasAnalyzed(true);
                      }}
                    >
                      📍 View Route on Map →
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isAgentTyping && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 0" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg,var(--primary-color),#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Zap size={10} color="white" />
                </div>
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <form className="agent-chat-input-area" onSubmit={handleAgentChat} style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--border-color)",
            background: "var(--card-bg)",
            gap: 8,
          }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isListening ? "🔴 Listening... speak now" : "Ask Nova anything..."}
              style={{
                borderRadius: 999,
                border: isListening ? "1.5px solid var(--primary-color)" : "1.5px solid var(--border-color)",
                transition: "border-color 0.2s",
                padding: "10px 16px",
              }}
            />
            <button
              type="button"
              className={`agent-chat-send mic-btn ${isListening ? "mic-btn--listening" : ""}`}
              onClick={toggleVoice}
              title={isListening ? "Stop listening" : "Speak to Nova"}
              style={{ borderRadius: "50%", width: 38, height: 38, flexShrink: 0 }}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              type="submit"
              className="agent-chat-send"
              disabled={!chatInput.trim() || isAgentTyping}
              style={{ borderRadius: "50%", width: 38, height: 38, flexShrink: 0, background: "linear-gradient(135deg,var(--primary-color),#7c3aed)", border: "none" }}
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
