import { revalidateTag } from 'next/cache';
import { getEnv } from '../../../../lib/env';

// You can use any random string for verify_token, it just needs to match what you use in the subscription creation
export const STRAVA_VERIFY_TOKEN = "ASCEND_WEBHOOK_SECURE_TOKEN_2026";

// Handle GET requests (Webhook verification handshake)
export async function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === STRAVA_VERIFY_TOKEN) {
    console.log('✅ Strava Webhook Verified!');
    return Response.json({ 'hub.challenge': challenge });
  } else {
    console.warn('❌ Strava Webhook Verification Failed!', { mode, token });
    return new Response('Forbidden', { status: 403 });
  }
}

// Handle POST requests (Incoming Webhook Events)
export async function POST(request) {
  try {
    const payload = await request.json();
    console.log("🔔 Strava Webhook Event Received:", JSON.stringify(payload));

    // We only care about Activity events (object_type: "activity")
    if (payload.object_type === 'activity') {
      console.log(`Action: ${payload.aspect_type} on Activity ${payload.object_id}. Invalidating cache...`);
      
      // Invalidate the fetch cache for 'strava-activities'
      revalidateTag('strava-activities');
    }

    // Strava requires a 200 OK response within 2 seconds
    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch (error) {
    console.error('Error processing Strava webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
