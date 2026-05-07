'use client';

import { Sparkles } from 'lucide-react';

export default function InsightsPanel({ insight, label = 'Ascend AI' }) {
  const loading = !insight;
  const error = insight && insight.includes('Could not reach');

  return (
    <section className="section coach-section">
      <h2 className="section-title coach-header">
        <Sparkles className="icon-sparkle" />
        AI Performance Insights
      </h2>
      <div className="coach-card">
        <div className="insight-block">
          <h4 className="insight-label">{label}</h4>
          {loading ? (
            <div className="insight-skeleton">
              <div className="skeleton-line skeleton-line-long" />
              <div className="skeleton-line skeleton-line-medium" />
              <div className="skeleton-line skeleton-line-short" />
            </div>
          ) : error ? (
            <p className="insight-text insight-error">
              {insight}
            </p>
          ) : (
            <p className="insight-text">{insight}</p>
          )}
        </div>
      </div>
    </section>
  );
}
