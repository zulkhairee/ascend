'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function InsightsPanel() {
  const [insight, setInsight] = useState(null);
  const [label, setLabel] = useState('Ascend AI');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/insights')
      .then(res => res.json())
      .then(data => {
        setInsight(data.insight);
        setLabel(data.label || 'Ascend AI');
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

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
              Could not reach Ascend AI. Check your API key and try refreshing.
            </p>
          ) : (
            <p className="insight-text">{insight}</p>
          )}
        </div>
      </div>
    </section>
  );
}
