import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
    const stravaRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=2', {
        headers: { Authorization: `Bearer ${process.env.STRAVA_ACCESS_TOKEN}` }
    });
    const stravaData = await stravaRes.json();
    fs.writeFileSync('strava_raw.json', JSON.stringify(stravaData, null, 2));
    console.log("Saved strava_raw.json");
}
check();
