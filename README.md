<div align="center">

# 🧠 NavMind AI
### Smart Traffic Intelligence Platform

*AI-powered real-time traffic analysis, route optimization, and predictive congestion forecasting*

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-Powered-4285F4?style=for-the-badge&logo=google&logoColor=white)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗺️ **Real-Time Traffic** | Live congestion data via TomTom & OpenRouteService APIs |
| 🤖 **AI Route Recommendations** | ML-powered optimal route suggestions (Car, Bike, Walk) |
| 🌱 **Eco-Friendly Routing** | Real-time CO2 emission estimation and eco-profiles |
| ⚠️ **Live Incidents** | Real-time visualization of traffic incidents and hazards |
| 🔮 **Smart Departure** | 12-hour predictive congestion forecasting |
| 🧠 **XAI Explanations** | Human-readable AI insights powered by Gemini |
| 🎙️ **Conversational AI Agent** | Continuous-listening voice assistant with Markdown-formatted chat |
| 🌦️ **Weather Overlays** | Interactive weather radar via OpenWeather API |
| 📍 **Recent Routes** | Persistent route history storage |
| 🚦 **Traffic Simulation** | Scenario-based traffic flow simulation |

---

## 🏗️ Architecture

```
NavMind-AI/
├── main.py                  # FastAPI application entry point
├── requirements.txt         # Python dependencies
├── .env.example             # Environment variable template
│
├── api/routes/              # API endpoint handlers
│   ├── agent.py             # Voice agent endpoint
│   ├── explain.py           # XAI explanations (Gemini)
│   ├── health.py            # Health check
│   ├── ingest.py            # Data ingestion
│   ├── predict.py           # Traffic prediction
│   ├── realtime.py          # Real-time traffic data
│   ├── recommend.py         # Route recommendations
│   └── simulate.py          # Traffic simulation
│
├── core/
│   ├── config.py            # App configuration & settings
│   └── logger.py            # Logging setup
│
├── services/                # Business logic layer
│   ├── agent_service.py     # Voice/chat agent logic
│   ├── decision_engine.py   # Routing decision engine
│   ├── maps_service.py      # TomTom + ORS integration
│   ├── model_manager.py     # ML model loader
│   ├── simulator.py         # Traffic simulation engine
│   ├── weather_service.py   # OpenWeather integration
│   └── xai.py               # Explainable AI module
│
├── ml/                      # Machine Learning
│   ├── models.py            # Model definitions
│   ├── preprocess.py        # Data preprocessing
│   ├── train.py             # Training scripts
│   └── saved_models/        # Trained model artifacts (.pkl)
│       ├── decision_tree.pkl
│       ├── knn.pkl
│       ├── logistic.pkl
│       └── random_forest.pkl
│
└── frontend/                # React + Vite frontend
    ├── src/
    │   ├── App.jsx           # Main application component
    │   ├── App.css           # Global styles
    │   ├── StreetPreview.jsx # Street-level map preview
    │   └── index.css         # Design system & tokens
    ├── public/
    └── vite.config.js
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- API keys (see [Environment Setup](#-environment-setup))

### 1. Clone the Repository

```bash
git clone https://github.com/preethu2896/NavMind-AI.git
cd NavMind-AI
```

### 2. Backend Setup

```bash
# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Environment Setup

Copy the example env file and fill in your API keys:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PROJECT_NAME="SmartTraffic AI"
API_V1_STR="/api/v1"
CORS_ORIGINS=["http://localhost:5173"]

GOOGLE_MAPS_API_KEY=your_google_maps_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
ORS_API_KEY=your_openrouteservice_api_key
TOMTOM_API_KEY=your_tomtom_api_key
GEMINI_API_KEY=your_gemini_api_key
```

Also create `frontend/.env`:

```env
VITE_OPENWEATHER_API_KEY=your_openweather_api_key
```

### 5. Run the Application

**Backend** (from project root):
```bash
python main.py
# Server starts at http://localhost:8000
# API docs at http://localhost:8000/api/v1/openapi.json
```

**Frontend** (from `frontend/` directory):
```bash
npm run dev
# App runs at http://localhost:5173
```

---

## 🔑 API Keys Required

| Service | Purpose | Get Key |
|---|---|---|
| **TomTom** | Real-time traffic data | [developer.tomtom.com](https://developer.tomtom.com) |
| **OpenRouteService** | Route calculation | [openrouteservice.org](https://openrouteservice.org) |
| **OpenWeather** | Weather overlays | [openweathermap.org](https://openweathermap.org/api) |
| **Google Gemini** | XAI explanations & voice agent | [aistudio.google.com](https://aistudio.google.com) |
| **Google Maps** | Map tiles (optional) | [console.cloud.google.com](https://console.cloud.google.com) |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/api/v1/predict` | Predict traffic congestion |
| `POST` | `/api/v1/recommend` | Get AI route recommendations |
| `POST` | `/api/v1/explain` | Get XAI explanation for a route decision |
| `GET` | `/api/v1/realtime` | Fetch real-time traffic conditions |
| `POST` | `/api/v1/simulate` | Run traffic simulation scenario |
| `POST` | `/api/v1/ingest` | Ingest traffic data |
| `POST` | `/api/v1/agent` | Interact with voice/chat agent |

---

## 🧪 ML Models

NavMind AI uses an ensemble of trained classifiers for traffic prediction:

- **Random Forest** — Primary congestion level classifier
- **Decision Tree** — Interpretable rule-based prediction
- **K-Nearest Neighbors (KNN)** — Pattern-matching for similar conditions
- **Logistic Regression** — Probabilistic congestion scoring

Models are pre-trained and stored as `.pkl` files in `ml/saved_models/`.

---

## 🛠️ Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — High-performance async API framework
- [scikit-learn](https://scikit-learn.org/) — ML model training & inference
- [Google Gemini AI](https://ai.google.dev/) — Generative AI for XAI & agent
- [Pydantic](https://docs.pydantic.dev/) — Data validation & settings management

**Frontend**
- [React 19](https://react.dev/) — UI framework
- [Vite 8](https://vitejs.dev/) — Build tool & dev server
- [Leaflet](https://leafletjs.com/) + [React-Leaflet](https://react-leaflet.js.org/) — Interactive maps
- [Recharts](https://recharts.org/) — Data visualizations
- [Lucide React](https://lucide.dev/) — Icon library

**External APIs**
- [TomTom Traffic API](https://developer.tomtom.com/traffic-api/documentation)
- [OpenRouteService](https://openrouteservice.org/dev/#/api-docs)
- [OpenWeatherMap](https://openweathermap.org/api)

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project was developed as part of an internship at **Inventeron Technologies**.

---

<div align="center">
Built with ❤️ by <a href="https://github.com/preethu2896">preethu2896</a>
</div>
