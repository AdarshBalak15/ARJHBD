// ─────────────────────────────────────────────────────────────────────────────
// api/track.js — Production-Grade Visitor Tracking (Vercel Serverless)
//
// Pipeline:
//   1. Extract real client IP (multi-header, multi-platform)
//   2. Geo lookup with retry + multi-provider fallback
//   3. Parse device info from User-Agent
//   4. Insert into user_tracking with full diagnostics
//   5. Return tracking result with structured metadata
//
// Debug fields stored in user_tracking:
//   • geo_source — which provider returned the data
//   • lookup_status — success / partial / failed
//   • failure_reason — exact reason if geo lookup failed
//   • request_source — which header yielded the IP
//   • ip_version — ipv4 / ipv6
// ─────────────────────────────────────────────────────────────────────────────

import { extractIp, detectPlatform } from './utils/extractIp.js';
import { geoLookup } from './utils/geoLookup.js';
import { parseDevice } from './utils/deviceParser.js';
import { safeInsert } from './utils/dbInsert.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const t0 = Date.now();
    const platform = detectPlatform(req.headers);
    console.log('======== TRACK START (Vercel) ========');
    console.log('[TRACK] Platform:', platform);

    // ── 1. Env diagnostics ──
    const hasUrl = !!process.env.SUPABASE_URL;
    const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log('[TRACK] ENV — SUPABASE_URL:', hasUrl, '| SERVICE_ROLE_KEY:', hasKey);

    if (!hasUrl || !hasKey) {
      console.error('[TRACK] ❌ Missing environment variables — cannot insert');
    }

    // ── 2. IP extraction (production-safe) ──
    const ipResult = extractIp(req.headers, req);
    const ip = ipResult.ip || null;

    if (!ip) {
      console.warn('[TRACK] ⚠️ Could not extract client IP');
      console.warn('[TRACK] Raw headers:', JSON.stringify(ipResult.raw));
    }

    // ── 3. Geo lookup (retry + multi-provider) ──
    const geo = await geoLookup(ip);
    console.log('[TRACK] Geo:', JSON.stringify({
      city: geo.city, country: geo.country,
      status: geo.lookup_status, source: geo.geo_source,
      failure: geo.failure_reason,
    }));

    // ── 4. Device parsing ──
    const userAgent = req.headers['user-agent'] || 'unknown';
    const device = parseDevice(userAgent);

    // ── 5. Body ──
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const userId = body.user_id || 'visitor';
    const trigger = body.trigger || 'page_load';
    const status = trigger === 'unlock' ? 'unlock' : 'active';

    // ── 6. Build DB payload ──
    const insertData = {
      user_id: userId,
      ip_address: ip || 'unknown',
      city: geo.city || 'unknown',
      region: geo.region || 'unknown',
      country: geo.country || 'unknown',
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezone: geo.timezone || 'unknown',
      isp: geo.isp || 'unknown',
      org: geo.org || 'unknown',
      device_info: userAgent.slice(0, 500),
      browser: device.browser,
      browser_version: device.browser_version,
      os: device.os,
      os_version: device.os_version,
      device_type: device.device_type,
      ip_type: ipResult.isPrivate ? 'private' : 'public',
      is_proxy: false,
      proxy_indicators: '',
      status,
    };

    console.log('[TRACK] Payload:', JSON.stringify(insertData));

    // ── 7. Insert with retry ──
    const dbResult = await safeInsert('user_tracking', insertData);

    // ── 8. Response ──
    const elapsed = Date.now() - t0;
    console.log('[TRACK] Result:', JSON.stringify({
      dbSuccess: dbResult.success, dbError: dbResult.error || null,
      attempts: dbResult.attempts, ms: elapsed,
    }));
    console.log('======== TRACK END ========');

    return res.status(200).json({
      success: true,
      tracked: dbResult.success,
      db_error: dbResult.success ? null : (dbResult.error || 'unknown'),
      db_details: dbResult.success ? null : (dbResult.details || null),
      ip: ip || 'unknown',
      city: geo.city || 'unknown',
      region: geo.region || 'unknown',
      country: geo.country || 'unknown',
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezone: geo.timezone || 'unknown',
      device_info: userAgent.slice(0, 100),
      status,
      elapsed_ms: elapsed,
      platform: platform || 'vercel',
      geo_source: geo.geo_source,
      lookup_status: geo.lookup_status,
    });
  } catch (error) {
    console.error('[TRACK] ❌ Unhandled:', error.message, error.stack);
    return res.status(200).json({
      success: false,
      tracked: false,
      db_error: 'UNHANDLED_EXCEPTION',
      db_details: error.message,
      error: 'Tracking failed',
      platform: 'vercel',
    });
  }
}
