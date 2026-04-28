import { getEnv } from './env';

// In-memory cache for the token to prevent refreshing on every single call
// In a real database scenario, you'd write this back to your DB.
let cachedAccessToken = null;
let tokenExpiresAt = 0; // Unix timestamp in seconds

export async function getValidStravaToken() {
  const currentTime = Math.floor(Date.now() / 1000);
  
  // If we have a cached token and it's valid for at least another 5 minutes
  if (cachedAccessToken && tokenExpiresAt > currentTime + 300) {
    return cachedAccessToken;
  }

  // Otherwise, we need to refresh (or get initial token if none exists)
  console.log('🔄 Refreshing Strava Access Token...');
  const clientId = getEnv('STRAVA_CLIENT_ID');
  const clientSecret = getEnv('STRAVA_CLIENT_SECRET');
  const refreshToken = getEnv('STRAVA_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Strava credentials for token refresh.');
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Failed to refresh Strava token:', errorData);
      // Fallback to the environment token just in case (though it might be expired)
      return getEnv('STRAVA_ACCESS_TOKEN');
    }

    const data = await response.json();
    
    // Update in-memory cache
    cachedAccessToken = data.access_token;
    tokenExpiresAt = data.expires_at;

    console.log('✅ Strava Access Token refreshed successfully.');
    return cachedAccessToken;
  } catch (error) {
    console.error('Network error while refreshing Strava token:', error);
    return getEnv('STRAVA_ACCESS_TOKEN');
  }
}
