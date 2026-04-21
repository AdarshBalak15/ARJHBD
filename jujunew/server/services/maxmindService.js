// ─────────────────────────────────────────────────────────────────────────────
// services/maxmindService.js — Offline GeoIP Fallback (MaxMind GeoLite2)
//
// Purpose:
//   Provides a FULLY OFFLINE geolocation fallback when both ipapi.co and
//   ipinfo.io are unavailable (rate-limited, network down, etc.).
//
// How it works:
//   1. On server startup, loads the GeoLite2-City.mmdb binary database
//   2. Lookups are instant (in-memory binary search — ~0.1ms per query)
//   3. No network calls, no API limits, no latency
//
// Setup instructions:
//   1. Create a FREE MaxMind account: https://www.maxmind.com/en/geolite2/signup
//   2. Generate a license key: Account → Manage License Keys → Generate New
//   3. Download GeoLite2-City.mmdb:
//      https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=YOUR_KEY&suffix=tar.gz
//   4. Extract GeoLite2-City.mmdb and place it at:
//      server/data/GeoLite2-City.mmdb
//   5. The service auto-detects the file on startup.
//
// If the .mmdb file is not present, this service gracefully returns null
// (it never crashes the application).
// ─────────────────────────────────────────────────────────────────────────────

import { open } from 'maxmind';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Resolve paths relative to THIS file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Default location for the GeoLite2 database file
const DB_PATH = join(__dirname, '..', 'data', 'GeoLite2-City.mmdb');

// Module-level state
let reader     = null;  // MaxMind Reader instance
let isLoaded   = false;
let loadError  = null;

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION — called once on first lookup (lazy load)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the GeoLite2 database into memory.
 * Called automatically on first lookup. Safe to call multiple times.
 *
 * @returns {Promise<boolean>} — true if DB loaded successfully
 */
export async function initMaxMind() {
  // Already loaded
  if (isLoaded && reader) return true;

  // Already tried and failed
  if (loadError) return false;

  // Check if file exists
  if (!existsSync(DB_PATH)) {
    loadError = 'GeoLite2-City.mmdb not found';
    console.warn(
      `[MAXMIND] ⚠️  Database file not found at: ${DB_PATH}\n` +
      `[MAXMIND]    Offline geo fallback is DISABLED.\n` +
      `[MAXMIND]    To enable: download GeoLite2-City.mmdb from MaxMind\n` +
      `[MAXMIND]    and place it at: server/data/GeoLite2-City.mmdb`
    );
    return false;
  }

  try {
    reader = await open(DB_PATH);
    isLoaded = true;
    console.log(`[MAXMIND] ✅ GeoLite2-City database loaded (offline fallback ready)`);
    return true;
  } catch (err) {
    loadError = err.message;
    console.error(`[MAXMIND] ❌ Failed to load GeoLite2 database:`, err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP — query the offline database
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look up geolocation data for an IP using the offline MaxMind database.
 *
 * @param {string} ip — IP address to look up
 * @returns {Promise<object | null>} — geo data in standard schema, or null if unavailable
 */
export async function lookupOffline(ip) {
  // Lazy initialization
  if (!isLoaded) {
    const loaded = await initMaxMind();
    if (!loaded) return null;
  }

  try {
    const result = reader.get(ip);

    if (!result) {
      console.warn(`[MAXMIND] ⚠️  No data found for IP: ${ip}`);
      return null;
    }

    // Extract and normalize data from MaxMind's response structure
    const city = result.city?.names?.en || 'unknown';
    const region = result.subdivisions?.[0]?.names?.en || 'unknown';
    const country = result.country?.names?.en || 'unknown';
    const latitude = result.location?.latitude ?? null;
    const longitude = result.location?.longitude ?? null;
    const timezone = result.location?.time_zone || 'unknown';

    // MaxMind doesn't include ISP in GeoLite2-City (only in paid GeoIP2)
    // We mark it clearly so downstream consumers know
    const geoData = {
      city,
      region,
      country,
      latitude,
      longitude,
      timezone,
      isp:    'unknown (offline lookup)',
      org:    result.traits?.autonomous_system_organization || 'unknown',
      source: 'maxmind-offline',
    };

    console.log(
      `[MAXMIND] ✅ Offline lookup success for ${ip} → ${city}, ${region}, ${country}`
    );

    return geoData;
  } catch (err) {
    console.error(`[MAXMIND] ❌ Lookup failed for ${ip}:`, err.message);
    return null;
  }
}

/**
 * Check if the MaxMind offline database is available and loaded.
 *
 * @returns {boolean}
 */
export function isMaxMindAvailable() {
  return isLoaded && reader !== null;
}

/**
 * Get status information about the MaxMind service.
 *
 * @returns {{ available: boolean, dbPath: string, error: string | null }}
 */
export function getMaxMindStatus() {
  return {
    available: isLoaded && reader !== null,
    dbPath:    DB_PATH,
    dbExists:  existsSync(DB_PATH),
    error:     loadError,
  };
}
