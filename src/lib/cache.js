import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'data_cache.json');
const TTL_MS = 60 * 60 * 1000; // 1 hour

export function getCachedData(key) {
  if (!fs.existsSync(CACHE_FILE)) return null;
  
  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const entry = cache[key];
    
    if (!entry) return null;
    
    // Check expiration
    if (Date.now() - entry.timestamp > TTL_MS) {
      return null;
    }
    
    return entry.data;
  } catch (err) {
    console.error("Cache read error:", err);
    return null;
  }
}

export function setCachedData(key, data) {
  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch(err) {
      // Ignore if malformed
    }
  }
  
  cache[key] = {
    timestamp: Date.now(),
    data
  };
  
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}
