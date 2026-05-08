import React, { useState, useEffect } from "react";
import { Camera, Crosshair } from "lucide-react";
import "./Dashcam.css";

export default function DashcamSimulation() {
  const [boxes, setBoxes] = useState([]);

  useEffect(() => {
    // Simulate computer vision bounding boxes appearing randomly
    const interval = setInterval(() => {
      const numBoxes = Math.floor(Math.random() * 3) + 1; // 1 to 3 boxes
      const newBoxes = [];
      for (let i = 0; i < numBoxes; i++) {
        newBoxes.push({
          id: Date.now() + i,
          x: 20 + Math.random() * 60, // percentage
          y: 30 + Math.random() * 40,
          w: 10 + Math.random() * 15,
          h: 10 + Math.random() * 20,
          type: Math.random() > 0.8 ? "pedestrian" : "vehicle",
          confidence: (70 + Math.random() * 29).toFixed(1)
        });
      }
      setBoxes(newBoxes);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashcam-container">
      <div className="dashcam-header">
        <span className="dashcam-title"><Camera size={14} style={{marginRight: 6}} /> AI Dashcam Feed</span>
        <span className="dashcam-status"><span className="recording-dot"></span> LIVE CV</span>
      </div>
      
      <div className="dashcam-feed">
        {/* CSS-based infinite road animation */}
        <div className="synthetic-road">
          <div className="road-lines"></div>
        </div>
        
        {/* Bounding boxes overlay */}
        <div className="cv-overlay">
          <Crosshair className="cv-crosshair" size={120} strokeWidth={0.5} opacity={0.3} />
          
          {boxes.map(box => (
            <div 
              key={box.id} 
              className={`cv-box cv-box-${box.type}`}
              style={{
                left: `${box.x}%`,
                top: `${box.y}%`,
                width: `${box.w}%`,
                height: `${box.h}%`
              }}
            >
              <div className="cv-label">{box.type} {box.confidence}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
