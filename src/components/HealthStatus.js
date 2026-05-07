import React from 'react';
import { Battery, HeartPulse, Activity } from 'lucide-react';

export default function HealthStatus({ bodyBattery, recoveryTime, readiness }) {
  // Mock data if undefined, representing Garmin metrics
  const bb = bodyBattery ?? 85;
  const rt = recoveryTime ?? 24;
  const tr = readiness ?? 'Prime';

  return (
    <section className="section health-section">
      <h2 className="section-title">Health Status</h2>
      <div className="health-card premium-dark">
        <div className="health-grid">
          <div className="health-item">
            <div className="health-icon-wrapper bb-icon">
              <Battery className="health-icon" />
            </div>
            <div className="health-data">
              <span className="health-value">{bb}</span>
              <span className="health-label">Body Battery</span>
            </div>
          </div>
          
          <div className="health-item">
            <div className="health-icon-wrapper rt-icon">
              <HeartPulse className="health-icon" />
            </div>
            <div className="health-data">
              <span className="health-value">{rt}<span className="health-unit">h</span></span>
              <span className="health-label">Recovery</span>
            </div>
          </div>
          
          <div className="health-item">
            <div className="health-icon-wrapper tr-icon">
              <Activity className="health-icon" />
            </div>
            <div className="health-data">
              <span className="health-value">{tr}</span>
              <span className="health-label">Readiness</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
