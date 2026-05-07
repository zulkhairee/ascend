import { GarminConnect } from 'garmin-connect';
import { getEnv } from './env.js';

let cachedClient = null;
const TWO_MINUTES_MS = 2 * 60 * 1000;

async function createClient() {
  const username = getEnv('GARMIN_USERNAME');
  const password = getEnv('GARMIN_PASSWORD');

  if (!username || !password || username === 'your_email@example.com') {
    console.warn('[Garmin] Credentials missing or using placeholder. Skipping Garmin.');
    return null;
  }

  try {
    const gc = new GarminConnect({ username, password });
    await gc.login(username, password);
    console.log('✅ Garmin session established.');
    return gc;
  } catch (error) {
    console.error('[Garmin] Login failed:', error.message);
    return null;
  }
}

export async function getGarminClient() {
  if (cachedClient) return cachedClient;
  cachedClient = await createClient();
  return cachedClient;
}

/**
 * Fetch last N Garmin activities, mapped to unified schema
 */
export async function getGarminActivities(count = 20) {
  const gc = await getGarminClient();
  if (!gc) return [];

  try {
    const raw = await gc.getActivities(0, count);
    return (raw || []).map(a => ({
      id: `garmin-${a.activityId}`,
      garminId: a.activityId,
      title: a.activityName || 'Garmin Activity',
      source: 'Garmin',
      type: mapGarminType(a.activityType?.typeKey),
      startTimestamp: a.beginTimestamp, // Unix ms — used for 2-min dedup
      date: new Date(a.startTimeLocal),
      distance: a.distance, // meters
      duration: a.duration, // seconds
      heartRate: a.averageHR || 0,
      maxHR: a.maxHR || 0,
      calories: a.calories || 0,
      cadence: a.averageRunningCadenceInStepsPerMinute
        ? Math.round(a.averageRunningCadenceInStepsPerMinute * 2)
        : null,
      elevationGain: a.elevationGain || 0,
      aerobicTE: a.aerobicTrainingEffect || 0,
      anaerobicTE: a.anaerobicTrainingEffect || 0,
      trainingLoad: a.activityTrainingLoad || 0,
      trainingEffectLabel: a.trainingEffectLabel || null,
      vO2Max: a.vO2MaxValue || null,
      locationName: a.locationName || null,
      rawGarmin: a,
    }));
  } catch (err) {
    console.error('[Garmin] Failed to fetch activities:', err.message);
    return [];
  }
}

/**
 * Derive Health Status from latest activities.
 * Garmin's wellness endpoints have unstable URLs, so we compute from activity telemetry.
 *
 * Body Battery: estimated from recent load (higher load = lower battery)
 * Recovery Time: from aerobic TE of last activity
 * Readiness: mapped from last activity's training effect label
 */
export function deriveHealthStatus(activities) {
  if (!activities || activities.length === 0) {
    return { bodyBattery: null, recoveryTime: null, readiness: 'N/A' };
  }

  const latest = activities[0];

  // Body Battery: score 0–100 inversely proportional to training load (cap at 150)
  const loadClamp = Math.min(latest.trainingLoad || 0, 150);
  const bodyBattery = Math.round(100 - (loadClamp / 150) * 60); // range ~40–100

  // Recovery Time: aerobic TE 1→8h, 2→16h, 3→24h, 4→36h, 5→48h
  const ateMap = [0, 8, 16, 24, 36, 48];
  const teIndex = Math.min(Math.round(latest.aerobicTE || 0), 5);
  const recoveryTime = ateMap[teIndex];

  // Readiness: map training effect label from Garmin
  const labelMap = {
    'RECOVERY': 'Recovery',
    'BASE': 'Base',
    'TEMPO': 'Tempo',
    'THRESHOLD': 'Threshold',
    'INTERVAL': 'Interval',
    'ANAEROBIC_SPRINT': 'Peak',
    'OVERREACHING': 'Overload',
  };
  const readiness = labelMap[latest.trainingEffectLabel] || 'Moderate';

  return { bodyBattery, recoveryTime, readiness };
}

/**
 * Match a Garmin activity against a list of Strava activities.
 * Uses Unix timestamp proximity (±2 minutes).
 */
export function findStravaMatch(garminActivity, stravaActivities) {
  return stravaActivities.find(s => {
    const timeDiff = Math.abs(s.startTimestamp - garminActivity.startTimestamp);
    return timeDiff <= TWO_MINUTES_MS;
  });
}

function mapGarminType(typeKey) {
  const cardioTypes = [
    'running', 'trail_running', 'treadmill_running', 'track_running', 'indoor_running',
    'cycling', 'indoor_cycling', 'mountain_biking', 'gravel_cycling',
    'swimming', 'lap_swimming', 'open_water_swimming',
    'walking', 'hiking', 'resort_skiing_snowboarding',
  ];
  if (!typeKey) return 'cardio';
  // Anything with 'run' in the typeKey is cardio
  if (typeKey.includes('run') || typeKey.includes('swim') || typeKey.includes('cycling') || typeKey.includes('walk') || typeKey.includes('hike')) return 'cardio';
  return cardioTypes.includes(typeKey) ? 'cardio' : 'strength';
}
