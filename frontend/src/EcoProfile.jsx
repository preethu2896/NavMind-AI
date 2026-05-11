import React from "react";
import { Leaf, Award, TrendingDown } from "lucide-react";
import "./EcoProfile.css";

const LEVELS = [
  { min: 0, title: "Beginner Explorer" },
  { min: 50, title: "Eco Commuter" },
  { min: 200, title: "Carbon Saver" },
  { min: 500, title: "Earth Guardian" },
];

export default function EcoProfile({ co2Saved, onReset }) {
  let currentLevel = LEVELS[0];
  let nextLevel = LEVELS[1];

  for (let i = 0; i < LEVELS.length; i++) {
    if (co2Saved >= LEVELS[i].min) {
      currentLevel = LEVELS[i];
      nextLevel = LEVELS[i + 1] || LEVELS[i];
    }
  }

  const progress = nextLevel === currentLevel 
    ? 100 
    : Math.min(100, Math.max(0, ((co2Saved - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100));

  return (
    <div className="eco-profile-card">
      <div className="eco-header">
        <h3><Leaf size={18} style={{marginRight: 8, color: '#10b981'}} /> Eco Dashboard</h3>
        <span className="eco-badge">{currentLevel.title}</span>
      </div>
      
      <div className="eco-stats">
        <div className="eco-stat-box">
          <span className="eco-stat-val">{co2Saved.toFixed(1)}</span>
          <span className="eco-stat-label">kg CO₂ Saved</span>
        </div>
        <div className="eco-stat-box">
          <span className="eco-stat-val">{(co2Saved * 0.15).toFixed(2)}</span>
          <span className="eco-stat-label">Equivalent Trees</span>
        </div>
      </div>

      <div className="eco-progress-wrap">
        <div className="eco-progress-labels">
          <span>Level Progress</span>
          <span>{progress.toFixed(0)}% to {nextLevel.title}</span>
        </div>
        <div className="eco-progress-bar">
          <div className="eco-progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
      
      {co2Saved > 0 && (
        <button className="btn-reset-eco" onClick={onReset}>Reset Stats</button>
      )}
    </div>
  );
}
