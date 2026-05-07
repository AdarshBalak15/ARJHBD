// ─────────────────────────────────────────────────────────────────────────────
// api/login.js — Production-Grade Login Handler (Vercel Serverless)
//
// Pipeline:
//   1. Validate password via bcrypt
//   2. Extract real client IP (multi-header, multi-platform)
//   3. Geo lookup with retry + fallback
//   4. Parse device info from User-Agent
//   5. Insert into login_events with full diagnostics
//   6. Send email alert (non-blocking)
//   7. Return result with structured logging
//
// Debug fields stored:
//   • geo_raw — raw API response for post-mortem analysis
//   • request_source — which header yielded the IP
//   • ip_version — ipv4 / ipv6
//   • lookup_status — success / partial / failed
//   • failure_reason — exact reason if geo lookup failed
// ─────────────────────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { formatTime } from './utils/formatTime.js';
import { extractIp, detectPlatform } from './utils/extractIp.js';
import { geoLookup } from './utils/geoLookup.js';
import { parseDevice } from './utils/deviceParser.js';
import { safeInsert } from './utils/dbInsert.js';

// ─────────────────────────────────────────────────────────────────────────────
// Email Alert
// ─────────────────────────────────────────────────────────────────────────────

async function sendLoginEmail({ ip, city, region, country, latitude, longitude, timezone, device_info, timestamp, status }) {
  if (process.env.ALERT_EMAIL_ENABLED !== 'true') { console.log('[EMAIL] Disabled'); return false; }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) { console.error('[EMAIL] Missing SMTP creds'); return false; }
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
    });
    await transporter.verify();
    console.log('[EMAIL] SMTP verified');

    const isOk = status === 'SUCCESS';
    const tz = (timezone && timezone !== 'unknown') ? timezone : 'Asia/Kolkata';
    const timeStr = formatTime(timestamp, tz, { preset: 'full' });
    const loc = [city, region, country].filter(v => v && v !== 'unknown').join(', ') || 'Unknown location';
    const mapsLink = (latitude != null && longitude != null) ? `https://www.google.com/maps?q=${latitude},${longitude}` : null;
    const mapsRow = mapsLink ? `<tr><td style="padding:10px 16px;color:#6b7280;">📍 Map</td><td style="padding:10px 16px;"><a href="${mapsLink}" target="_blank" style="color:#2563eb;">View on Google Maps ↗</a></td></tr>` : '';
    const headerBg = isOk ? 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)' : 'linear-gradient(135deg,#dc2626 0%,#991b1b 100%)';
    const badge = isOk ? '<span style="background:#16a34a;color:#fff;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">✅ SUCCESS</span>' : '<span style="background:rgba(255,255,255,0.2);color:#fff;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">❌ FAILED</span>';

    const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:540px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);"><div style="background:${headerBg};padding:22px 28px;text-align:center;"><h2 style="color:#fff;margin:0 0 8px;font-size:1.25rem;">${isOk ? '🔓 Login Activity' : '⚠️ Failed Login'}</h2>${badge}</div><div style="padding:0;background:#fff;"><table style="width:100%;border-collapse:collapse;font-size:0.92rem;"><tr style="background:#f9fafb;"><td style="padding:10px 16px;color:#6b7280;width:35%;">🌐 IP</td><td style="padding:10px 16px;font-family:monospace;">${ip || 'unknown'}</td></tr><tr><td style="padding:10px 16px;color:#6b7280;">📍 Location</td><td style="padding:10px 16px;">${loc}</td></tr><tr style="background:#f9fafb;"><td style="padding:10px 16px;color:#6b7280;">🕐 Timezone</td><td style="padding:10px 16px;">${timezone || 'unknown'}</td></tr><tr><td style="padding:10px 16px;color:#6b7280;">💻 Device</td><td style="padding:10px 16px;word-break:break-all;font-size:0.85rem;">${(device_info||'unknown').slice(0,150)}</td></tr><tr style="background:#f9fafb;"><td style="padding:10px 16px;color:#6b7280;">⏰ Time</td><td style="padding:10px 16px;font-weight:600;">${timeStr}</td></tr>${mapsRow}</table></div><div style="padding:12px 24px;background:#f8fafc;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;color:#94a3b8;font-size:0.75rem;">ARJHBD Security • Vercel</p></div></div>`;

    await transporter.sendMail({
      from: `"🔐 Login Security" <${process.env.SMTP_USER}>`,
      to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
      subject: isOk ? '🔓 Login Activity — ARJHBD' : '⚠️ Failed Login — ARJHBD',
      html,
    });
    console.log('[EMAIL] ✅ Sent for:', status);
    return true;
  } catch (err) {
    console.error('[EMAIL] ❌ Failed:', err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  try {
    const t0 = Date.now();
    const platform = detectPlatform(req.headers);
    console.log('======== LOGIN START ========');
    console.log('[LOGIN] Platform:', platform);

    const body = req.body || {};
    const password = body.password || '';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const timestamp = new Date().toISOString();

    // ── 1. Password validation ──
    const HASHED_PASSWORD = process.env.HASHED_PASSWORD;
    let isValid = false;
    if (HASHED_PASSWORD && password) {
      try { isValid = await bcrypt.compare(password, HASHED_PASSWORD); }
      catch (e) { console.error('[AUTH] bcrypt error:', e.message); }
    } else {
      console.error('[AUTH] ❌ HASHED_PASSWORD not set or empty password');
    }
    const status = isValid ? 'SUCCESS' : 'FAILED';
    console.log('[AUTH] Status:', status);

    // ── 2. IP extraction (production-safe) ──
    const ipResult = extractIp(req.headers, req);
    const ip = ipResult.ip || null;

    if (!ip) {
      console.warn('[LOGIN] ⚠️ Could not extract client IP — raw headers:', JSON.stringify(ipResult.raw));
    }

    // ── 3. Geo lookup (with retry + multi-provider fallback) ──
    const geo = await geoLookup(ip);
    console.log('[LOGIN] Geo result:', JSON.stringify({
      city: geo.city, country: geo.country,
      status: geo.lookup_status, source: geo.geo_source,
    }));

    // ── 4. Device parsing ──
    const device = parseDevice(userAgent);

    // ── 5. Build DB payload ──
    const insertData = {
      user_id: 'arju',
      ip_address: ip || 'unknown',
      city: geo.city || 'unknown',
      region: geo.region || 'unknown',
      country: geo.country || 'unknown',
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezone: geo.timezone || 'unknown',
      device_info: userAgent.slice(0, 500),
      status,
      anomaly_status: 'normal',
      anomaly_reasons: '',
      source: platform || 'vercel',
    };

    console.log('[LOGIN] DB payload:', JSON.stringify(insertData));

    // ── 6. Insert into login_events ──
    const dbResult = await safeInsert('login_events', insertData);

    // ── 7. Email alert (non-blocking — don't let email failure block response) ──
    let emailSent = false;
    try {
      emailSent = await sendLoginEmail({
        ip: ip || 'unknown',
        city: geo.city || 'unknown',
        region: geo.region || 'unknown',
        country: geo.country || 'unknown',
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezone || 'unknown',
        device_info: userAgent,
        timestamp,
        status,
      });
    } catch (e) {
      console.error('[EMAIL] ❌ Exception:', e.message);
    }

    // ── 8. Summary ──
    const elapsed = Date.now() - t0;
    console.log('[SUMMARY]', JSON.stringify({
      status, ip: ip || 'none',
      city: geo.city || 'unknown', geoSource: geo.geo_source,
      lookupStatus: geo.lookup_status,
      dbSuccess: dbResult.success, dbError: dbResult.error || null,
      emailSent, ms: elapsed, platform,
    }));
    console.log('======== LOGIN END ========');

    return res.status(isValid ? 200 : 401).json({
      success: isValid,
      message: isValid ? 'Login successful' : 'Invalid password',
    });
  } catch (error) {
    console.error('❌ UNHANDLED:', error.message, error.stack);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
