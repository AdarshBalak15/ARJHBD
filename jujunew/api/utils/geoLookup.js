// ─────────────────────────────────────────────────────────────────────────────
// api/utils/geoLookup.js — Production-Grade Geolocation Lookup
//
// Fetches geolocation data for an IP address with:
//   • Multi-provider fallback (ipwho.is → ipapi.co → ip-api.com)
//   • Retry with exponential backoff for transient failures
//   • Timeout handling per request
//   • Response validation (coordinates, timezone, city)
//   • In-memory cache with TTL
//   • Structured diagnostics for every lookup
//
// Never returns "unknown" silently — always logs the exact reason.
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, { data: object, expiresAt: number }>} */
const geoCache = new Map();
const GEO_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const GEO_CACHE_MAX = 300;

function getCached(ip) {
  const entry = geoCache.get(ip);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { geoCache.delete(ip); return null; }
  return entry.data;
}

function setCache(ip, data) {
  if (geoCache.size >= GEO_CACHE_MAX) {
    const oldest = geoCache.keys().next().value;
    geoCache.delete(oldest);
  }
  geoCache.set(ip, { data, expiresAt: Date.now() + GEO_CACHE_TTL });
}

/**
 * Validate a latitude value.
 * @param {*} val
 * @returns {number|null}
 */
function validateLat(val) {
  if (val == null || val === '') return null;
  const n = Number(val);
  if (isNaN(n) || n < -90 || n > 90) return null;
  return n;
}

/**
 * Validate a longitude value.
 * @param {*} val
 * @returns {number|null}
 */
function validateLon(val) {
  if (val == null || val === '') return null;
  const n = Number(val);
  if (isNaN(n) || n < -180 || n > 180) return null;
  return n;
}

/**
 * Validate an IANA timezone string.
 * @param {*} val
 * @returns {string|null}
 */
function validateTimezone(val) {
  if (!val || typeof val !== 'string') return null;
  // Basic IANA format: Area/Location or UTC
  if (/^[A-Z][a-zA-Z0-9_+-]+\/[A-Za-z0-9_+-/]+$/.test(val)) return val;
  if (val === 'UTC' || val === 'GMT') return val;
  return null;
}

/**
 * Safe string field — returns the value if truthy, else null (not "unknown").
 * @param {*} val
 * @returns {string|null}
 */
function safeStr(val) {
  if (!val || typeof val !== 'string' || val.trim() === '') return null;
  return val.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider definitions
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    name: 'ipwho.is',
    url: (ip) => `https://ipwho.is/${ip}`,
    timeout: 5000,
    headers: {},
    validate: (data) => data && data.success !== false && (data.city || data.country),
    extract: (data) => ({
      city: safeStr(data.city),
      region: safeStr(data.region),
      country: safeStr(data.country),
      latitude: validateLat(data.latitude),
      longitude: validateLon(data.longitude),
      timezone: (data.timezone && typeof data.timezone === 'object')
        ? validateTimezone(data.timezone.id)
        : validateTimezone(data.timezone),
      isp: safeStr(data.connection?.isp),
      org: safeStr(data.connection?.org),
    }),
  },
  {
    name: 'ipapi.co',
    url: (ip) => `https://ipapi.co/${ip}/json/`,
    timeout: 5000,
    headers: { 'Accept': 'application/json', 'User-Agent': 'node-tracker/2.0' },
    validate: (data) => data && !data.error && !data.reason && (data.city || data.country_name),
    extract: (data) => ({
      city: safeStr(data.city),
      region: safeStr(data.region),
      country: safeStr(data.country_name),
      latitude: validateLat(data.latitude),
      longitude: validateLon(data.longitude),
      timezone: validateTimezone(data.timezone),
      isp: safeStr(data.org),
      org: safeStr(data.org),
    }),
  },
  {
    name: 'ip-api.com',
    url: (ip) => `http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,lat,lon,timezone,isp,org`,
    timeout: 5000,
    headers: {},
    validate: (data) => data && data.status === 'success',
    extract: (data) => ({
      city: safeStr(data.city),
      region: safeStr(data.regionName),
      country: safeStr(data.country),
      latitude: validateLat(data.lat),
      longitude: validateLon(data.lon),
      timezone: validateTimezone(data.timezone),
      isp: safeStr(data.isp),
      org: safeStr(data.org),
    }),
  },
];

/**
 * Fetch a single URL with timeout and retry.
 * @param {string} url
 * @param {object} headers
 * @param {number} timeout
 * @param {number} retries
 * @returns {Promise<object|null>}
 */
async function fetchWithRetry(url, headers, timeout, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        console.log(`[GEO] HTTP ${res.status} from ${url} (attempt ${attempt}/${retries})`);
        if (res.status === 429) {
          // Rate limited — don't retry this provider
          console.log('[GEO] Rate limited — skipping provider');
          return null;
        }
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * attempt));
          continue;
        }
        return null;
      }

      const data = await res.json();
      return data;
    } catch (err) {
      const reason = err.name === 'AbortError' ? 'timeout' : err.message;
      console.log(`[GEO] Fetch failed: ${url} — ${reason} (attempt ${attempt}/${retries})`);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }
  return null;
}

/**
 * @typedef {object} GeoResult
 * @property {string|null} city
 * @property {string|null} region
 * @property {string|null} country
 * @property {number|null} latitude
 * @property {number|null} longitude
 * @property {string|null} timezone
 * @property {string|null} isp
 * @property {string|null} org
 * @property {string} lookup_status — 'success' | 'partial' | 'failed'
 * @property {string|null} failure_reason
 * @property {string} geo_source — provider name or 'cache' or 'none'
 * @property {object|null} geo_raw — raw API response for debugging
 */

/**
 * Look up geolocation for an IP address.
 * Tries multiple providers with fallback. Validates all fields.
 * Never silently returns "unknown" — uses null + failure_reason instead.
 *
 * @param {string} ip — The IP to look up
 * @returns {Promise<GeoResult>}
 */
export async function geoLookup(ip) {
  const defaults = {
    city: null, region: null, country: null,
    latitude: null, longitude: null, timezone: null,
    isp: null, org: null,
    lookup_status: 'failed', failure_reason: null,
    geo_source: 'none', geo_raw: null,
  };

  if (!ip || ip === 'check' || ip === 'auto') {
    console.log('[GEO] ⚠️ No valid IP for geo lookup');
    return { ...defaults, failure_reason: 'no_valid_ip' };
  }

  // Check cache
  const cached = getCached(ip);
  if (cached) {
    console.log('[GEO] Cache HIT for', ip);
    return { ...cached, geo_source: 'cache', lookup_status: 'success', failure_reason: null };
  }

  const errors = [];

  for (const provider of PROVIDERS) {
    try {
      const url = provider.url(ip);
      console.log(`[GEO] Trying ${provider.name}: ${url}`);

      const rawData = await fetchWithRetry(url, provider.headers, provider.timeout);

      if (!rawData) {
        errors.push(`${provider.name}: no_response`);
        continue;
      }

      if (!provider.validate(rawData)) {
        errors.push(`${provider.name}: invalid_response`);
        console.log(`[GEO] ${provider.name} returned invalid data:`, JSON.stringify(rawData).slice(0, 300));
        continue;
      }

      const extracted = provider.extract(rawData);

      // Determine lookup quality
      const hasLocation = !!(extracted.city || extracted.country);
      const hasCoords = extracted.latitude !== null && extracted.longitude !== null;
      const hasTz = extracted.timezone !== null;

      let lookup_status = 'success';
      let failure_reason = null;

      if (!hasLocation && !hasCoords) {
        errors.push(`${provider.name}: no_location_data`);
        continue; // Try next provider
      }

      if (!hasLocation || !hasCoords || !hasTz) {
        lookup_status = 'partial';
        const missing = [];
        if (!hasLocation) missing.push('location');
        if (!hasCoords) missing.push('coordinates');
        if (!hasTz) missing.push('timezone');
        failure_reason = `partial: missing ${missing.join(', ')}`;
      }

      const result = {
        ...extracted,
        lookup_status,
        failure_reason,
        geo_source: provider.name,
        geo_raw: rawData,
      };

      // Cache successful lookups
      setCache(ip, result);

      console.log('[GEO] ✅ Success from', provider.name, JSON.stringify({
        city: result.city, country: result.country,
        lat: result.latitude, lon: result.longitude,
        tz: result.timezone, status: lookup_status,
      }));

      return result;
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`);
      console.error(`[GEO] ❌ ${provider.name} exception:`, err.message);
    }
  }

  // All providers failed
  const failureReason = errors.join(' | ');
  console.error('[GEO] ❌ All providers failed:', failureReason);

  return {
    ...defaults,
    failure_reason: failureReason,
  };
}

export default geoLookup;
