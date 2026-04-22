// ─────────────────────────────────────────────────────────────────────────────
// services/trackingService.js — User Tracking Orchestrator
//
// This is the core service that ties together all subsystems:
//   1. IP extraction (ipUtils)
//   2. Geolocation lookup (geoService — cached, retry, fallback)
//   3. User-agent parsing (uaParser)
//   4. Data validation & normalization
//   5. Database persistence (Supabase)
//
// Exposes a single function: trackUser(req, userId?)
// Returns the full structured metadata object.
// ─────────────────────────────────────────────────────────────────────────────

import supabase from '../config/db.js';
import { extractClientIP, classifyIP, detectProxyIndicators } from '../utils/ipUtils.js';
import { parseUserAgent } from '../utils/uaParser.js';
import { fetchGeoData } from './geoService.js';

// ─────────────────────────────────────────────────────────────────────────────
// DATA VALIDATION — ensures all fields are safe before DB insertion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a string field: trim whitespace, replace empty/null with 'unknown'.
 *
 * @param {*} value — raw value (may be null, undefined, or non-string)
 * @param {string} [fallback='unknown'] — default if value is falsy
 * @returns {string}
 */
function normalizeString(value, fallback = 'unknown') {
  if (value == null) return fallback;
  const str = String(value).trim();
  return str.length > 0 ? str : fallback;
}

/**
 * Normalize a numeric field (latitude/longitude).
 * Returns null if the value can't be parsed as a finite number.
 *
 * @param {*} value
 * @returns {number | null}
 */
function normalizeNumber(value) {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Validates and normalizes all fields for the user_tracking table.
 *
 * @param {object} raw — raw data from various sources
 * @returns {object} — validated, safe-to-insert data
 */
function validateAndNormalize(raw) {
  return {
    user_id:    normalizeString(raw.user_id, 'anonymous'),
    ip_address: normalizeString(raw.ip_address),
    city:       normalizeString(raw.city),
    region:     normalizeString(raw.region),
    country:    normalizeString(raw.country),
    latitude:   normalizeNumber(raw.latitude),
    longitude:  normalizeNumber(raw.longitude),
    timezone:   normalizeString(raw.timezone),
    isp:        normalizeString(raw.isp),
    org:        normalizeString(raw.org),
    device_info: normalizeString(raw.device_info),
    browser:    normalizeString(raw.browser),
    browser_version: normalizeString(raw.browser_version),
    os:         normalizeString(raw.os),
    os_version: normalizeString(raw.os_version),
    device_type: normalizeString(raw.device_type),
    ip_type:    normalizeString(raw.ip_type),
    is_proxy:   typeof raw.is_proxy === 'boolean' ? raw.is_proxy : false,
    proxy_indicators: normalizeString(raw.proxy_indicators, ''),
    status:     normalizeString(raw.status, 'active'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE INSERT — uses Supabase client (SQL injection safe by design)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert a tracking record into the user_tracking table using Supabase.
 * Supabase client parameterizes all values automatically — no SQL injection risk.
 *
 * @param {object} data — validated tracking data
 * @returns {object | null} — inserted row (with id + created_at), or null on failure
 */
async function insertTrackingRecord(data) {
  try {
    const { data: rows, error } = await supabase
      .from('user_tracking')
      .insert([{
        user_id:          data.user_id,
        ip_address:       data.ip_address,
        city:             data.city,
        region:           data.region,
        country:          data.country,
        latitude:         data.latitude,
        longitude:        data.longitude,
        timezone:         data.timezone,
        isp:              data.isp,
        org:              data.org,
        device_info:      data.device_info,
        browser:          data.browser,
        browser_version:  data.browser_version,
        os:               data.os,
        os_version:       data.os_version,
        device_type:      data.device_type,
        ip_type:          data.ip_type,
        is_proxy:         data.is_proxy,
        proxy_indicators: data.proxy_indicators,
        status:           data.status,
      }])
      .select('*')
      .single();

    if (error) {
      console.error('[TRACKING] ❌ Supabase INSERT FAILED:', error.message);
      return null;
    }

    return rows;
  } catch (err) {
    console.error('[TRACKING] ❌ DB INSERT FAILED:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — trackUser(req, userId?)
//
// This is the single entry point for the tracking system.
// It orchestrates: IP extraction → geo lookup → UA parsing → validation → DB insert
//
// Returns a structured result object regardless of partial failures.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Track a user from an incoming HTTP request.
 *
 * @param {import('express').Request} req — Express request object
 * @param {string} [userId='anonymous'] — optional user identifier
 * @returns {Promise<{
 *   success:    boolean,
 *   db_inserted: boolean,
 *   data:       object,
 *   timestamp:  string,
 *   error?:     string,
 * }>}
 */
export async function trackUser(req, userId = 'anonymous') {
  const timestamp = new Date().toISOString();

  try {
    // ── Step 1: Extract IP address ─────────────────────────────────────────
    const ip     = extractClientIP(req);
    const ipType = classifyIP(ip);
    const proxy  = detectProxyIndicators(req);

    console.log(`[TRACKING] 🔍 Tracking request — IP: ${ip} (${ipType})`);

    // ── Step 2: Fetch geolocation data (cached + retry + fallback) ─────────
    const geo = await fetchGeoData(ip);

    // ── Step 3: Parse user-agent ───────────────────────────────────────────
    const uaRaw  = req.headers['user-agent'] || 'unknown';
    const device = parseUserAgent(uaRaw);

    // ── Step 4: Assemble raw data ──────────────────────────────────────────
    const rawData = {
      user_id:         userId,
      ip_address:      ip,
      city:            geo.city,
      region:          geo.region,
      country:         geo.country,
      latitude:        geo.latitude,
      longitude:       geo.longitude,
      timezone:        geo.timezone,
      isp:             geo.isp,
      org:             geo.org,
      device_info:     uaRaw,
      browser:         device.browser,
      browser_version: device.browserVersion,
      os:              device.os,
      os_version:      device.osVersion,
      device_type:     device.deviceType,
      ip_type:         ipType,
      is_proxy:        proxy.isLikelyProxy,
      proxy_indicators: proxy.indicators.join('; '),
      status:          'active',
    };

    // ── Step 5: Validate and normalize ─────────────────────────────────────
    const validated = validateAndNormalize(rawData);

    // ── Step 6: Insert into Supabase ───────────────────────────────────────
    const dbRecord = await insertTrackingRecord(validated);
    const dbInserted = dbRecord !== null;

    // ── Step 7: Build response ─────────────────────────────────────────────
    const responseData = {
      // Identification
      id:           dbRecord?.id || null,
      user_id:      validated.user_id,

      // Network
      ip_address:   validated.ip_address,
      ip_type:      validated.ip_type,
      is_proxy:     validated.is_proxy,
      proxy_indicators: proxy.indicators,

      // Geolocation
      geo: {
        city:       validated.city,
        region:     validated.region,
        country:    validated.country,
        latitude:   validated.latitude,
        longitude:  validated.longitude,
        timezone:   validated.timezone,
        isp:        validated.isp,
        org:        validated.org,
        source:     geo.source,
      },

      // Device
      device: {
        raw:             validated.device_info,
        browser:         validated.browser,
        browser_version: validated.browser_version,
        os:              validated.os,
        os_version:      validated.os_version,
        device_type:     validated.device_type,
      },

      // Meta
      status:     validated.status,
      timestamp:  dbRecord?.created_at || timestamp,
    };

    // ── Step 8: Log for debugging ──────────────────────────────────────────
    console.log(
      `[TRACKING] ✅ Complete — ` +
      `id:${responseData.id} | ` +
      `ip:${ip} (${ipType}) | ` +
      `${validated.city}, ${validated.region}, ${validated.country} | ` +
      `${validated.browser} on ${validated.os} (${validated.device_type}) | ` +
      `db:${dbInserted ? 'YES' : 'NO'}`
    );

    return {
      success:     true,
      db_inserted: dbInserted,
      data:        responseData,
      timestamp,
    };
  } catch (err) {
    // ── Catastrophic failure — never crash the server ─────────────────────
    console.error('[TRACKING] ❌ Unexpected error:', err.message, err.stack);

    return {
      success:     false,
      db_inserted: false,
      data:        null,
      timestamp,
      error:       'Internal tracking error',
    };
  }
}
