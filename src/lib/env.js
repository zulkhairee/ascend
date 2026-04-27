import fs from 'fs';
import path from 'path';

/**
 * Custom environment loader that checks for CREDENTIALS_BACKUP.md 
 * if standard process.env variables are missing.
 */
export function getEnv(key) {
  // 1. Try standard process.env (Next.js default)
  if (process.env[key]) {
    return process.env[key];
  }

  // 2. Fallback: Try to parse from CREDENTIALS_BACKUP.md
  try {
    const backupPath = path.join(process.cwd(), 'CREDENTIALS_BACKUP.md');
    if (fs.existsSync(backupPath)) {
      const content = fs.readFileSync(backupPath, 'utf8');
      
      // Use regex to find the key/value pattern from the markdown
      // Matches pattern: - **Key Name**: `value`
      // We map our environment keys to the human-readable names in the MD
      const keyMap = {
        'STRAVA_CLIENT_ID': 'Client ID',
        'STRAVA_CLIENT_SECRET': 'Client Secret',
        'STRAVA_ACCESS_TOKEN': 'Access Token',
        'STRAVA_REFRESH_TOKEN': 'Refresh Token',
        'LYFTA_API_KEY': 'API Key'
      };

      const label = keyMap[key];
      if (label) {
        const regex = new RegExp(`\\*\\*${label}\\*\\*:\\s*\`(.*?)\``, 'i');
        const match = content.match(regex);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
  } catch (error) {
    console.error(`Error loading fallback env for ${key}:`, error);
  }

  return undefined;
}
