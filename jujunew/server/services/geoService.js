// ─────────────────────────────────────────────────────────────────────────────
// services/geoService.js — Geolocation Service Layer
//
// Responsibilities:
//   1. Look up geographic data for an IP address
//   2. Use in-memory cache to avoid redundant API calls
//   3. Primary API: ipapi.co (free, no key required)
//   4. Fallback API: ipinfo.io (free tier, no key required for basic data)
//   5. Retry logic with exponential backoff
//   6. Handle localhost/private IPs gracefully
//   7. Normalize all responses to a consistent schema
//
// Architecture:
//   fetchGeoData(ip) → cache → ipapi.co (retry) → ipinfo.io → MaxMind offline → defaults
// ─────────────────────────────────────────────────────────────────────────────

import geoCache from './geoCache.js';
import { isLocalhost, isPrivateIP } from '../utils/ipUtils.js';
import { lookupOffline } from './maxmindService.js';

// ── Consistent shape for all geo responses ───────────────────────────────────
const GEO_DEFAULTS = Object.freeze({
  city:      'unknown',
  region:    'unknown',
  country:   'unknown',
  latitude:  null,
  longitude: null,
  timezone:  'unknown',
  isp:       'unknown',
  org:       'unknown',
  source:    'none', // Which API provided the data: 'ipapi' | 'ipinfo' | 'cache' | 'none'
});

/**
 * Resolve the lookup IP address.
 * For localhost / private IPs, we pass an empty string to ipapi.co
 * which makes it return data for the server's own public IP.
 *
 * @param {string} ip — client IP
 * @returns {{ lookupIP: string, isLocal: boolean, isPrivate: boolean }}
 */
function resolveLookupIP(ip) {
  const local   = isLocalhost(ip);
  const priv    = isPrivateIP(ip);
  const lookupIP = (local || priv) ? '' : ip;

  return { lookupIP, isLocal: local, isPrivate: priv };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY API — ipapi.co
// Free: 1,000 requests/day, no key needed
// Docs: https://ipapi.co/api/
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFromIpapi(lookupIP) {
  const url = `https://ipapi.co/${lookupIP}json/`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(4000), // 4 s hard timeout
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'node-tracker/1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`ipapi.co returned HTTP ${res.status}`);
  }

  const data = await res.json();

  // ipapi.co returns { error: true, reason: '...' } for invalid IPs
  if (data.error) {
    throw new Error(`ipapi.co error: ${data.reason || 'unknown'}`);
  }

  return {
    city:      data.city         || 'unknown',
    region:    data.region       || 'unknown',
    country:   data.country_name || 'unknown',
    latitude:  data.latitude     ?? null,
    longitude: data.longitude    ?? null,
    timezone:  data.timezone     || 'unknown',
    isp:       data.org          || 'unknown', // ipapi.co uses 'org' for ISP
    org:       data.org          || 'unknown',
    source:    'ipapi',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK API — ipinfo.io
// Free: 50,000 requests/month, no key needed for basic fields
// Docs: https://ipinfo.io/developers
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFromIpinfo(lookupIP) {
  // ipinfo.io uses /ip/json for specific IPs, /json for caller's IP
  const url = lookupIP
    ? `https://ipinfo.io/${lookupIP}/json`
    : `https://ipinfo.io/json`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(4000),
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'node-tracker/1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`ipinfo.io returned HTTP ${res.status}`);
  }

  const data = await res.json();

  // ipinfo.io returns lat/lon as "lat,lon" string in 'loc' field
  let latitude  = null;
  let longitude = null;
  if (data.loc) {
    const [lat, lon] = data.loc.split(',').map(Number);
    if (!isNaN(lat)) latitude  = lat;
    if (!isNaN(lon)) longitude = lon;
  }

  return {
    city:      data.city     || 'unknown',
    region:    data.region   || 'unknown',
    country:   data.country  || 'unknown', // ipinfo returns country code, not name
    latitude,
    longitude,
    timezone:  data.timezone || 'unknown',
    isp:       data.org      || 'unknown',
    org:       data.org      || 'unknown',
    source:    'ipinfo',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RETRY WRAPPER — exponential backoff with configurable attempts
// ─────────────────────────────────────────────────────────────────────────────
async function withRetry(fn, maxRetries = 2, baseDelayMs = 500) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(
        `[GEO] ⏳ Retry ${attempt + 1}/${maxRetries} in ${delay}ms — ${err.message}`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — fetchGeoData(ip)
//
// Resolution order:
//   1. Cache hit → return immediately
//   2. Primary API (ipapi.co) with retry → cache + return
//   3. Fallback API (ipinfo.io) → cache + return
//   4. MaxMind GeoLite2 offline DB → cache + return
//   5. All failed → return defaults (never throws)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchGeoData(ip) {
  // ── Step 1: Check cache ──────────────────────────────────────────────────
  const cached = geoCache.get(ip);
  if (cached) {
    console.log(`[GEO] ⚡ Cache HIT for ${ip}`);
    return { ...cached, source: 'cache' };
  }

  const { lookupIP, isLocal, isPrivate } = resolveLookupIP(ip);

  // ── Step 2: Primary API (ipapi.co) with 2 retries ───────────────────────
  try {
    const result = await withRetry(() => fetchFromIpapi(lookupIP), 2, 500);
    geoCache.set(ip, result);
    console.log(`[GEO] ✅ ipapi.co success for ${ip} → ${result.city}, ${result.country}`);
    return result;
  } catch (primaryErr) {
    console.warn(`[GEO] ⚠️  ipapi.co FAILED for ${ip}: ${primaryErr.message}`);
  }

  // ── Step 3: Fallback API (ipinfo.io) ─────────────────────────────────────
  try {
    const result = await fetchFromIpinfo(lookupIP);
    geoCache.set(ip, result);
    console.log(`[GEO] ✅ ipinfo.io fallback success for ${ip} → ${result.city}, ${result.country}`);
    return result;
  } catch (fallbackErr) {
    console.warn(`[GEO] ⚠️  ipinfo.io FAILED for ${ip}: ${fallbackErr.message}`);
  }

  // ── Step 4: MaxMind GeoLite2 offline database ────────────────────────────
  // Only useful for public IPs (localhost/private won't be in the DB)
  if (!isLocal && !isPrivate) {
    try {
      const offlineResult = await lookupOffline(ip);
      if (offlineResult) {
        geoCache.set(ip, offlineResult);
        console.log(`[GEO] ✅ MaxMind offline success for ${ip} → ${offlineResult.city}, ${offlineResult.country}`);
        return offlineResult;
      }
    } catch (offlineErr) {
      console.warn(`[GEO] ⚠️  MaxMind offline FAILED for ${ip}: ${offlineErr.message}`);
    }
  }

  // ── Step 5: All sources exhausted — return safe defaults ─────────────────
  console.error(`[GEO] ❌ All geo sources failed for ${ip}. Using defaults.`);

  const defaults = {
    ...GEO_DEFAULTS,
    ...(isLocal   && { city: 'localhost', region: 'local', country: 'local' }),
    ...(isPrivate && { city: 'private-network', region: 'private', country: 'private' }),
  };

  return defaults;
}
