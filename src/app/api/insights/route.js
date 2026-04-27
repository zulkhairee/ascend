import { getEnv } from '../../../lib/env';

// Format helpers for building the prompt summary
function formatDistance(meters) {
  if (!meters) return '--';
  return (meters / 1000).toFixed(2);
}

function formatDuration(seconds) {
  if (!seconds) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export async function GET() {
  const apiKey = getEnv('GEMINI_API_KEY');

  if (!apiKey || apiKey.includes('REPLACE_WITH')) {
    return Response.json({
      insight: "Please add your Gemini API Key to CREDENTIALS_BACKUP.md to enable AI insights.",
      label: "Setup Required"
    });
  }

  // Fetch workouts fresh for the API route
  let workoutSummary = [];

  try {
    // --- Lyfta ---
    const lyftaRes = await fetch('https://my.lyfta.app/api/v1/workouts', {
      headers: { Authorization: `Bearer ${getEnv('LYFTA_API_KEY')}` },
      cache: 'no-store'
    });

    if (lyftaRes.ok) {
      const lyftaData = await lyftaRes.json();
      if (lyftaData.workouts) {
        lyftaData.workouts.slice(0, 3).forEach(w => {
          workoutSummary.push({
            type: 'Strength Training',
            title: w.title || 'Strength Session',
            date: new Date(w.workout_perform_date).toLocaleDateString(),
            exercises: w.exercises?.length || 0,
            volume: w.total_volume ? `${w.total_volume} kg` : 'N/A'
          });
        });
      }
    }

    // --- Strava ---
    const stravaRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
      headers: { Authorization: `Bearer ${getEnv('STRAVA_ACCESS_TOKEN')}` },
      cache: 'no-store'
    });

    if (stravaRes.ok) {
      const stravaData = await stravaRes.json();
      if (Array.isArray(stravaData)) {
        stravaData.slice(0, 3).forEach(w => {
          const type = (w.type === 'WeightTraining' || w.type === 'Workout') ? 'Strength' : 'Cardio';
          if (type === 'Cardio') {
            workoutSummary.push({
              type: 'Cardio',
              title: w.name,
              date: new Date(w.start_date).toLocaleDateString(),
              distance: formatDistance(w.distance) + ' km',
              duration: formatDuration(w.moving_time),
              avg_hr: w.average_heartrate ? Math.round(w.average_heartrate) + ' bpm' : 'N/A'
            });
          }
        });
      }
    }
  } catch (err) {
    console.error("Error fetching workout data for AI:", err);
  }

  if (workoutSummary.length === 0) {
    return Response.json({
      insight: "No recent workout data found. Log your first workout to get AI coaching insights!",
      label: "No Data Yet"
    });
  }

  const prompt = `You are Ascend AI, a sharp, encouraging, and data-driven personal fitness coach. 
The user has given you their recent workout data below. Write a 2-3 sentence performance insight.
Be specific — reference actual numbers (distances, volume, heart rate) from the data.
Sound like a real coach: motivating, observant, and direct.

Recent workouts:
${JSON.stringify(workoutSummary, null, 2)}

Respond with plain text only. No bullet points, no markdown.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 150
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("Gemini error:", errBody);
      throw new Error('Gemini API error');
    }

    const data = await geminiRes.json();
    const insight = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    return Response.json({
      insight: insight || "Keep up the great work! Your data is looking strong.",
      label: "Ascend AI"
    }, {
      headers: {
        // Cache on CDN for 30 min, allow stale for 1 hour while revalidating in background
        'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600'
      }
    });

  } catch (error) {
    console.error("AI Insights route error:", error);
    return Response.json({
      insight: "I'm having a moment — couldn't connect to Gemini. Check your API key and try again.",
      label: "Error"
    }, { status: 500 });
  }
}
