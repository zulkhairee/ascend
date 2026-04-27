import { Mic, MessageCircle, Footprints, Dumbbell } from "lucide-react";
import MuscleMap from "../components/MuscleMap";
import InsightsPanel from "../components/InsightsPanel";
import { getEnv } from "../lib/env";

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
       muscleData.push({ 
         name: ex.excercise_name, 
         muscles, 
         frequency: ex.sets ? ex.sets.length : 1 
       });
    }
  });
  return muscleData;
}

// Server-side function to grab and harmonize data
async function getWorkouts() {
  // 1. Fetch from Lyfta
  const lyftaRes = await fetch('https://my.lyfta.app/api/v1/workouts', {
    headers: { Authorization: `Bearer ${getEnv('LYFTA_API_KEY')}` },
    next: { revalidate: 0 } // always fetch fresh data
  });
  
  let lyftaWorkouts = [];
  if (lyftaRes.ok) {
    const lyftaData = await lyftaRes.json();
    if (lyftaData.workouts) {
      lyftaWorkouts = lyftaData.workouts.map(w => ({
        id: `lyfta-${w.id}`,
        title: w.title || "Strength Training",
        source: 'Lyfta',
        type: 'strength',
        date: new Date(w.workout_perform_date),
        volume: w.total_volume,
        exercises: w.exercises?.length || 0,
        muscleData: parseLyftaMuscles(w.exercises),
        rawExercises: w.exercises || []
      }));
    }
  }

  // 2. Fetch from Strava (Summary)
  const stravaRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
    headers: { Authorization: `Bearer ${getEnv('STRAVA_ACCESS_TOKEN')}` },
    next: { revalidate: 0 }
  });
  
  let stravaWorkouts = [];
  if (stravaRes.ok) {
    const stravaSummary = await stravaRes.json();
    if (Array.isArray(stravaSummary)) {
      // 2.5 Fetch Detailed Activities to get the exact 'calories' field (missing from summary)
      const detailedPromises = stravaSummary.map(w => 
        fetch(`https://www.strava.com/api/v3/activities/${w.id}`, {
          headers: { Authorization: `Bearer ${getEnv('STRAVA_ACCESS_TOKEN')}` },
          next: { revalidate: 0 }
        }).then(res => res.json())
      );
      
      const detailedData = await Promise.all(detailedPromises);

      stravaWorkouts = detailedData.map(w => ({
        id: `strava-${w.id}`,
        title: w.name,
        source: 'Strava',
        type: (w.type === 'WeightTraining' || w.type === 'Workout') ? 'strength' : 'cardio',
        date: new Date(w.start_date),
        distance: w.distance, // meters
        duration: w.moving_time, // seconds
        heartRate: w.average_heartrate || 0,
        calories: w.calories ? Math.round(w.calories) : 0, // Now using EXACT Strava calculated calories!
        rawStrava: w
      }));
    }
  }

  // 3. Harmonization
  const harmonizedWorkouts = [];
  
  // First, process Lyfta workouts and enrich them with Strava data if available
  for (const lyfta of lyftaWorkouts) {
    const lyftaDateStr = lyfta.date.toDateString();
    
    // Find a matching Strava strength workout on the exact same day
    const matchingStrava = stravaWorkouts.find(s => 
       s.type === 'strength' && s.date.toDateString() === lyftaDateStr
    );

    if (matchingStrava) {
       // Harmonize: Pull time and calories from Strava into Lyfta
       lyfta.calories = matchingStrava.calories;
       lyfta.duration = matchingStrava.duration;
       lyfta.heartRate = matchingStrava.heartRate;
    }
    
    harmonizedWorkouts.push(lyfta);
  }

  // Next, add all Strava workouts that ARE NOT duplicates
  for (const strava of stravaWorkouts) {
    const stravaDateStr = strava.date.toDateString();
    // Skip Strava strength workouts that have already been merged into Lyfta
    if (strava.type === 'strength' && lyftaWorkouts.some(l => l.date.toDateString() === stravaDateStr)) {
       continue;
    }
    harmonizedWorkouts.push(strava);
  }

  // Sort unified list by newest first and return top 3
  const deduplicated = harmonizedWorkouts.sort((a, b) => b.date - a.date);

  return deduplicated.slice(0, 3);
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
  const paceSeconds = 1000 / metersPerSecond; // seconds per km
  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.floor(paceSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')} /km`;
}


export default async function Home() {
  const recentWorkouts = await getWorkouts();

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
          <h1 className="greeting">Good Morning, Zul.</h1>
        </div>

        <div className="input-wrapper">
          <Mic className="icon mic-icon" />
          <input type="text" placeholder="How was your workout?" className="log-input" />
          <button className="icon-btn action-btn">
            <MessageCircle className="icon bubble-icon" />
          </button>
        </div>
      </header>

      {/* Daily Nutrition remains mocked for now until MyFitnessPal / Macros API */}
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

      {/* DYNAMIC WORKOUT LIST */}
      <section className="section training-section">
        <div className="section-header-row">
          <h2 className="section-title">Recent Workouts</h2>
        </div>
        
        <div className="workout-list">
          {recentWorkouts.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No workouts found or waiting for Strava authorization.</p>
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
                        {workout.date.toLocaleDateString()} • {workout.source}
                      </p>
                    </div>
                  </div>
                </div>

                {workout.type === 'cardio' ? (
                  /* CARDIO LAYOUT (STRAVA) */
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
                    
                    {workout.rawStrava && (
                      <details className="workout-details">
                        <summary className="workout-details-summary">View Run Details</summary>
                        <div className="workout-log strava-log">
                          <div className="strava-stats-grid">
                            <div className="strava-stat">
                              <span className="stat-label">Pace</span>
                              <span className="stat-value">{formatPace(workout.rawStrava.average_speed)}</span>
                            </div>
                            <div className="strava-stat">
                              <span className="stat-label">Elev Gain</span>
                              <span className="stat-value">{Math.round(workout.rawStrava.total_elevation_gain || 0)} <span className="stat-unit">m</span></span>
                            </div>
                            <div className="strava-stat">
                              <span className="stat-label">Max HR</span>
                              <span className="stat-value">{Math.round(workout.rawStrava.max_heartrate || 0)} <span className="stat-unit">bpm</span></span>
                            </div>
                            <div className="strava-stat">
                              <span className="stat-label">Cadence</span>
                              <span className="stat-value">{Math.round((workout.rawStrava.average_cadence || 0) * 2)} <span className="stat-unit">spm</span></span>
                            </div>
                            {workout.rawStrava.average_watts > 0 && (
                              <div className="strava-stat">
                                <span className="stat-label">Power</span>
                                <span className="stat-value">{Math.round(workout.rawStrava.average_watts)} <span className="stat-unit">W</span></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  /* STRENGTH LAYOUT (LYFTA / STRAVA STRENGTH) */
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
                                <span>Set</span>
                                <span>Weight</span>
                                <span>Reps</span>
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

      <InsightsPanel />
    </div>
  );
}
