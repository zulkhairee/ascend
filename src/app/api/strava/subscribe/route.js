import { getEnv } from '../../../../lib/env';
import { STRAVA_VERIFY_TOKEN } from '../webhook/route';

// A utility route to easily trigger a webhook subscription
export async function GET(request) {
  try {
    const clientId = getEnv('STRAVA_CLIENT_ID');
    const clientSecret = getEnv('STRAVA_CLIENT_SECRET');

    // The hardcoded Vercel deployment URL
    const callbackUrl = 'https://ascend-web-mocha.vercel.app/api/strava/webhook';

    console.log(`Setting up Strava webhook for: ${callbackUrl}`);

    const response = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        callback_url: callbackUrl,
        verify_token: STRAVA_VERIFY_TOKEN
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to create subscription:', data);
      return Response.json({ success: false, error: data }, { status: response.status });
    }

    console.log('✅ Subscription created successfully:', data);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('Error in subscription route:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
