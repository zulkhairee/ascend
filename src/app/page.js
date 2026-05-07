import { Mic, MessageCircle, Footprints, Dumbbell } from "lucide-react";
import MuscleMap from "../components/MuscleMap";
import InsightsPanel from "../components/InsightsPanel";
import HealthStatus from "../components/HealthStatus";
import { getEnv } from "../lib/env";
import { getValidStravaToken } from "../lib/strava";
import { getGarminActivities, deriveHealthStatus, findStravaMatch } from "../lib/garmin";
import { getCachedData, setCachedData } from "../lib/cache";
import { readFileSync } from "fs";
import { join } from "path";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLyftaMuscles(exercises) {
  const muscleData = [];
  if (!exercises) return muscleData;
  exercises.forEach(ex => {
    let muscles = [];
    const url = ex.exercise_image || "";
    if (url.includes("_Chest")) muscles.push("chest");
    if (url.includes("_Upper-Arms")) muscles.push("biceps", "triceps");
    if (url.includes("_Back")) muscles.push("upper-back");
    if (url.includes("_Hips")) muscles.push("gluteal");
    if (url.includes("_Thighs")) muscles.push("quadriceps", "hamstring");
    if (url.includes("_Waist")) muscles.push("abs", "obliques");
    if (url.includes("_Shoulders")) muscles.push("front-deltoids", "back-deltoids");
    if (muscles.length > 0) {
      muscleData.push({ name: ex.excercise_name, muscles, frequency: ex.sets ? ex.sets.length : 1 });
    }
  });
  return muscleData;
}

function formatDuration(seconds) {
  if (!seconds) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}` : `${m} min`;
}

function formatDistance(meters) {
  if (!meters) return '--';
  return (meters / 1000).toFixed(2);
}

function formatPace(metersPerSecond) {
  if (!metersPerSecond || metersPerSecond === 0) return '--';
  const paceSeconds = 1000 / metersPerSecond;
  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.floor(paceSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')} /km`;
}

function getGreeting() {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' })).getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function readAiInsight() {
  try {
    const filePath = join(process.cwd(), 'src', 'data', 'ai_insight.json');
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return { insight: "Ask Antigravity to refresh your AI insights.", label: "Ascend AI" };
  }
}

// ─── Data Fetching with Cache + Garmin-first Harmonization ────────────────────

async function getWorkouts() {
  const CACHE_KEY = 'unified_workouts';
  const cached = getCachedData(CACHE_KEY);
  if (cached) {
    console.log('✅ Serving workouts from local cache.');
    // Rehydrate date strings back to Date objects after JSON deserialization
    return cached.map(w => ({ ...w, date: new Date(w.date) }));
  }

  // 1. Fetch Garmin (primary)
  const garminActivities = await getGarminActivities(30);

  // 2. Fetch Lyfta (strength enrichment)
  let lyftaWorkouts = [];
  try {
    const lyftaRes = await fetch('https://my.lyfta.app/api/v1/workouts', {
      headers: { Authorization: `Bearer ${getEnv('LYFTA_API_KEY')}` },
      next: { revalidate: 0 }
    });
    if (lyftaRes.ok) {
      const lyftaData = await lyftaRes.json();
      if (lyftaData.workouts) {
        lyftaWorkouts = lyftaData.workouts.map(w => ({
          id: `lyfta-${w.id}`,
          title: w.title || 'Strength Training',
          source: 'Lyfta',
          type: 'strength',
          startTimestamp: new Date(w.workout_perform_date).getTime(),
          date: new Date(w.workout_perform_date),
          volume: w.total_volume,
          exercises: w.exercises?.length || 0,
          muscleData: parseLyftaMuscles(w.exercises),
          rawExercises: w.exercises || []
        }));
      }
    }
  } catch (e) {
    console.error('[Lyfta] Fetch failed:', e.message);
  }

  // 3. Fetch Strava (social metadata fallback)
  let stravaActivities = [];
  try {
    const stravaToken = await getValidStravaToken();
    const stravaRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
      headers: { Authorization: `Bearer ${stravaToken}` },
    });
    if (stravaRes.ok) {
      const stravaSummary = await stravaRes.json();
      if (Array.isArray(stravaSummary)) {
        stravaActivities = stravaSummary.map(a => ({
          id: `strava-${a.id}`,
          stravaId: a.id,
          title: a.name,
          startTimestamp: new Date(a.start_date).getTime(),
          date: new Date(a.start_date),
          type: (a.type === 'WeightTraining' || a.type === 'Workout') ? 'strength' : 'cardio',
          distance: a.distance,
          duration: a.moving_time,
          heartRate: a.average_heartrate || 0,
          calories: a.calories || 0,
          rawStrava: a,
        }));
      }
    }
  } catch (e) {
    console.error('[Strava] Fetch failed:', e.message);
  }

  // 4. Harmonize: Garmin is primary. Stitch Strava title if it's a custom name.
  const harmonized = [];
  const usedStravaIds = new Set();

  for (const garmin of garminActivities) {
    const stravaMatch = findStravaMatch(garmin, stravaActivities);
    if (stravaMatch) {
      usedStravaIds.add(stravaMatch.stravaId);
      // Stitch: prefer Strava title if it differs from the generic Garmin default
      const genericTitles = ['Singapore Running', 'Running', 'Cycling', 'Walking', 'Swimming'];
      if (!genericTitles.includes(garmin.title) || stravaMatch.title !== garmin.title) {
        garmin.title = stravaMatch.title || garmin.title;
      }
      garmin.rawStrava = stravaMatch.rawStrava;
    }

    // Enrich strength-only Garmin activities from Lyfta by date (same calendar day, UTC+8)
    // Guard: never merge a cardio Garmin activity with a Lyfta strength session
    if (garmin.type === 'strength') {
      const garminDayStr = garmin.date.toDateString();
      const lyftaMatch = lyftaWorkouts.find(l => l.date.toDateString() === garminDayStr);
      if (lyftaMatch) {
        garmin.volume = lyftaMatch.volume;
        garmin.exercises = lyftaMatch.exercises;
        garmin.muscleData = lyftaMatch.muscleData;
        garmin.rawExercises = lyftaMatch.rawExercises;
        garmin.source = 'Garmin + Lyfta';
        lyftaMatch._merged = true; // mark so we don't double-add below
      }
    }

    harmonized.push(garmin);
  }

  // 5. Add Lyfta-only strength sessions not already merged into a Garmin activity
  for (const lyfta of lyftaWorkouts) {
    if (!lyfta._merged) harmonized.push(lyfta);
  }

  // 6. Sort by newest, take top 5 for display
  const sorted = harmonized.sort((a, b) => b.date - a.date);
  const result = sorted.slice(0, 5);

  setCachedData(CACHE_KEY, result);
  return result;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function Home() {
  const [recentWorkouts, garminRaw] = await Promise.all([
    getWorkouts(),
    getGarminActivities(5),
  ]);

  const healthStatus = deriveHealthStatus(garminRaw);
  const aiInsight = readAiInsight();

  return (
    <div className="app-container">
      <header className="section header-section">
        <div className="greeting-area">
          <div className="app-brand-row">
            <div className="app-logo">
              <div style={{ width: '28px', height: '28px', flexShrink: 0, overflow: 'hidden', borderRadius: '6px' }}>
                <img src="/ascend_logo.png" alt="Ascend" style={{ width: '28px', height: '28px', objectFit: 'contain', display: 'block' }} />
              </div>
              <span className="brand-name">Ascend</span>
            </div>
          </div>
          <p className="date">Real-time Data</p>
          <h1 className="greeting">{getGreeting()}, Zul.</h1>
        </div>

        <div className="input-wrapper">
          <Mic className="icon mic-icon" />
          <input type="text" placeholder="How was your workout?" className="log-input" />
          <button className="icon-btn action-btn">
            <MessageCircle className="icon bubble-icon" />
          </button>
        </div>
      </header>

      {/* Health Status — Garmin Telemetry */}
      <HealthStatus
        bodyBattery={healthStatus.bodyBattery}
        recoveryTime={healthStatus.recoveryTime}
        readiness={healthStatus.readiness}
      />

      {/* Daily Nutrition */}
      <section className="section nutrition-section">
        <h2 className="section-title">Daily Nutrition</h2>
        <div className="nutrition-card">
          <div className="macro-ring-container">
            <svg className="macro-ring" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" className="ring-track"></circle>
              <circle cx="50" cy="50" r="45" className="ring-fat" strokeDasharray="80 200" strokeDashoffset="25"></circle>
              <circle cx="50" cy="50" r="45" className="ring-carbs" strokeDasharray="100 180" strokeDashoffset="-55"></circle>
              <circle cx="50" cy="50" r="45" className="ring-protein" strokeDasharray="60 220" strokeDashoffset="-155"></circle>
            </svg>
            <div className="ring-content">
              <span className="total-calories">1,840</span>
              <span className="calories-label">Consumed</span>
            </div>
          </div>
          <div className="nutrition-details">
            <div className="macro-stats">
              <div className="macro-item">
                <span className="macro-dot protein-dot"></span>
                <div>
                  <p className="macro-name">Protein</p>
                  <p className="macro-value">110g <span className="macro-target">/ 150g</span></p>
                </div>
              </div>
              <div className="macro-item">
                <span className="macro-dot carbs-dot"></span>
                <div>
                  <p className="macro-name">Carbs</p>
                  <p className="macro-value">220g <span className="macro-target">/ 250g</span></p>
                </div>
              </div>
              <div className="macro-item">
                <span className="macro-dot fat-dot"></span>
                <div>
                  <p className="macro-name">Fat</p>
                  <p className="macro-value">55g <span className="macro-target">/ 70g</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Workout List — Garmin primary */}
      <section className="section training-section">
        <div className="section-header-row">
          <h2 className="section-title">Recent Workouts</h2>
        </div>

        <div className="workout-list">
          {recentWorkouts.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No workouts found. Check Garmin credentials.</p>
          ) : (
            recentWorkouts.map((workout) => (
              <div className="workout-card" key={workout.id}>
                <div className="workout-header">
                  <div className="workout-title-group">
                    <div className={`workout-icon-box ${workout.type === 'cardio' ? 'run-bg' : 'strength-bg'}`}>
                      {workout.type === 'cardio' ? <Footprints className="workout-icon" /> : <Dumbbell className="workout-icon" />}
                    </div>
                    <div className="workout-name-details">
                      <h3 className="workout-name">{workout.title}</h3>
                      <p className="workout-meta">
                        {workout.date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })} • {workout.source}
                        {workout.locationName ? ` • ${workout.locationName}` : ''}
                      </p>
                    </div>
                  </div>
                  {(workout.aerobicTE ?? 0) > 0 && (
                    <span className={`te-badge ${workout.aerobicTE >= 3 ? 'aerobic-te' : 'anaerobic-te'}`}>
                      TE {Number(workout.aerobicTE).toFixed(1)}
                    </span>
                  )}
                </div>

                {workout.type === 'cardio' ? (
                  <>
                    <div className="workout-metrics">
                      <div className="metric-item">
                        <span className="metric-value">{formatDistance(workout.distance)} <span className="metric-unit">km</span></span>
                        <span className="metric-label">Distance</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-value">{formatDuration(workout.duration)}</span>
                        <span className="metric-label">Time</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-value">{workout.heartRate} <span className="metric-unit">bpm</span></span>
                        <span className="metric-label">Avg HR</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-value">{workout.calories || '--'} <span className="metric-unit">kcal</span></span>
                        <span className="metric-label">Calories</span>
                      </div>
                    </div>

                    <details className="workout-details">
                      <summary className="workout-details-summary">View Run Details</summary>
                      <div className="workout-log strava-log">
                        <div className="strava-stats-grid">
                          <div className="strava-stat">
                            <span className="stat-label">Pace</span>
                            <span className="stat-value">{formatPace(workout.rawGarmin?.averageSpeed)}</span>
                          </div>
                          <div className="strava-stat">
                            <span className="stat-label">Elev Gain</span>
                            <span className="stat-value">{Math.round(workout.elevationGain || 0)} <span className="stat-unit">m</span></span>
                          </div>
                          <div className="strava-stat">
                            <span className="stat-label">Max HR</span>
                            <span className="stat-value">{workout.maxHR || '--'} <span className="stat-unit">bpm</span></span>
                          </div>
                          <div className="strava-stat">
                            <span className="stat-label">Cadence</span>
                            <span className="stat-value">{workout.cadence || '--'} <span className="stat-unit">spm</span></span>
                          </div>
                          {workout.vO2Max && (
                            <div className="strava-stat">
                              <span className="stat-label">VO₂ Max</span>
                              <span className="stat-value">{workout.vO2Max}</span>
                            </div>
                          )}
                          {workout.trainingEffectLabel && (
                            <div className="strava-stat">
                              <span className="stat-label">Effect</span>
                              <span className="stat-value">{workout.trainingEffectLabel.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </details>
                  </>
                ) : (
                  <>
                    <div className="workout-content-split">
                      <div className="workout-data-column">
                        <div className="workout-metrics grid-2x2 strength-metrics">
                          <div className="metric-item">
                            <span className="metric-value">
                              {workout.volume ? workout.volume.toLocaleString() : '--'} <span className="metric-unit">kg</span>
                            </span>
                            <span className="metric-label">Volume</span>
                          </div>
                          <div className="metric-item">
                            <span className="metric-value">{workout.exercises > 0 ? workout.exercises : '--'}</span>
                            <span className="metric-label">Exercises</span>
                          </div>
                          <div className="metric-item">
                            <span className="metric-value">{formatDuration(workout.duration)}</span>
                            <span className="metric-label">Time</span>
                          </div>
                          <div className="metric-item">
                            <span className="metric-value">{workout.calories || '--'} <span className="metric-unit">kcal</span></span>
                            <span className="metric-label">Calories</span>
                          </div>
                        </div>
                      </div>
                      <div className="muscle-map">
                        <MuscleMap data={workout.muscleData} />
                      </div>
                    </div>

                    {workout.rawExercises && workout.rawExercises.length > 0 && (
                      <details className="workout-details">
                        <summary className="workout-details-summary">View Workout Log</summary>
                        <div className="workout-log">
                          {workout.rawExercises.map((ex, i) => (
                            <div key={i} className="exercise-log-item">
                              <h5 className="exercise-name">{ex.excercise_name}</h5>
                              <div className="exercise-table">
                                <div className="exercise-table-header">
                                  <span>Set</span><span>Weight</span><span>Reps</span>
                                </div>
                                <div className="exercise-table-body">
                                  {ex.sets.map((set, j) => (
                                    <div className="exercise-row" key={j}>
                                      <span className="set-number">{j + 1}</span>
                                      <span className="set-weight">{set.weight > 0 ? `${parseFloat(set.weight)} kg` : 'Bodyweight'}</span>
                                      <span className="set-reps">{set.reps}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* AI Insights — server-side, zero latency */}
      <InsightsPanel insight={aiInsight.insight} label={aiInsight.label} />
    </div>
  );
}
