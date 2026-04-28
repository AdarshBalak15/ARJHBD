// ─────────────────────────────────────────────────────────────────────────────
// api/login.js — Vercel Serverless Function: Login
//
// Mirrors netlify/functions/login.js for Vercel deployment.
// Endpoint: POST /api/login
//
// SECURITY: Password validated via bcrypt against HASHED_PASSWORD env var.
// DATABASE: Inserts into unified login_events table (Supabase).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { formatTime } from './utils/formatTime.js';

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Client (persistent across warm invocations)
// ─────────────────────────────────────────────────────────────────────────────
let supabase = null;

function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    console.log('[DB] Supabase client created');
  }
  return supabase;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email alert (FAILED only)
// ─────────────────────────────────────────────────────────────────────────────
async function sendFailedLoginEmail({ ip, city, region, country, latitude, longitude, timezone, device_info, timestamp }) {
  if (process.env.ALERT_EMAIL_ENABLED !== 'true') return false;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return false;

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });

    const timeStr = formatTime(timestamp, timezone !== 'unknown' ? timezone : 'Asia/Kolkata', { preset: 'full' });
    const hasCoords = latitude != null && longitude != null;
    const mapsLink = hasCoords ? `https://www.google.com/maps?q=${latitude},${longitude}` : null;
    const mapsRow = mapsLink
      ? `<tr><td style="padding:10px 16px;color:#6b7280;">📍 Map</td><td style="padding:10px 16px;"><a href="${mapsLink}" target="_blank" style="color:#2563eb;">View on Google Maps ↗</a></td></tr>`
      : '';

    const html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:540px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);padding:22px 28px;text-align:center;">
          <h2 style="color:#fff;margin:0 0 8px;font-size:1.25rem;">⚠️ Failed Login Attempt</h2>
          <span style="background:rgba(255,255,255,0.2);color:#fff;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">❌ FAILED</span>
        </div>
        <div style="padding:0;background:#fff;">
          <table style="width:100%;border-collapse:collapse;font-size:0.92rem;">
            <tr style="background:#f9fafb;"><td style="padding:10px 16px;color:#6b7280;width:35%;">🌐 IP</td><td style="padding:10px 16px;color:#111827;font-family:monospace;">${ip}</td></tr>
            <tr><td style="padding:10px 16px;color:#6b7280;">📍 Location</td><td style="padding:10px 16px;color:#111827;">${city}, ${region}, ${country}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:10px 16px;color:#6b7280;">🕐 Timezone</td><td style="padding:10px 16px;color:#111827;">${timezone}</td></tr>
            <tr><td style="padding:10px 16px;color:#6b7280;">💻 Device</td><td style="padding:10px 16px;color:#111827;word-break:break-all;font-size:0.85rem;">${(device_info || 'unknown').slice(0, 150)}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:10px 16px;color:#6b7280;">⏰ Time (IST)</td><td style="padding:10px 16px;color:#111827;font-weight:600;">${timeStr}</td></tr>
            ${mapsRow}
          </table>
        </div>
        <div style="padding:16px 24px;background:#fef2f2;border-top:1px solid #fecaca;">
          <p style="margin:0;color:#991b1b;font-size:0.88rem;line-height:1.5;">🛑 <strong>Security Notice:</strong> Someone tried to log in with an incorrect password.</p>
        </div>
        <div style="padding:12px 24px;background:#f8fafc;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#94a3b8;font-size:0.75rem;">ARJHBD Security System • Automated Alert</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"🔐 Login Security" <${process.env.SMTP_USER}>`,
      to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
      subject: `⚠️ Failed Login Attempt — ARJHBD`,
      html,
    });

    console.log('[EMAIL] ✅ Alert sent');
    return true;
  } catch (err) {
    console.error('[EMAIL] ❌ Send failed:', err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 VERCEL SERVERLESS HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // ── Parse request ────────────────────────────────────────────────────────
    const body = req.body || {};
    const password = body.password || '';
    const device_info = req.headers['user-agent'] || 'unknown';
    const timestamp = new Date().toISOString();

    // ═════════════════════════════════════════════════════════════════════════
    // 1️⃣  SECURE PASSWORD VALIDATION (bcrypt)
    // ═════════════════════════════════════════════════════════════════════════
    const HASHED_PASSWORD = process.env.HASHED_PASSWORD;
    let isValid = false;

    if (HASHED_PASSWORD && password) {
      try {
        isValid = await bcrypt.compare(password, HASHED_PASSWORD);
      } catch (err) {
        console.error('[AUTH] bcrypt.compare error:', err.message);
      }
    } else {
      console.error('[AUTH] ❌ HASHED_PASSWORD env var not set!');
    }

    const status = isValid ? 'SUCCESS' : 'FAILED';

    // ═════════════════════════════════════════════════════════════════════════
    // 2️⃣  FORCE CLEAN IP EXTRACTION (Vercel headers)
    // ═════════════════════════════════════════════════════════════════════════
    let rawIp =
      req.headers['x-real-ip'] ||
      req.headers['x-forwarded-for'] ||
      req.headers['client-ip'] ||
      '';

    let ip = rawIp;

    if (ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    if (!ip || ip === '::1' || ip === '127.0.0.1') {
      ip = '8.8.8.8'; // fallback
    }

    console.log('[AUTH] IP:', ip, '| Status:', status);

    // ═════════════════════════════════════════════════════════════════════════
    // 3️⃣  PRIMARY GEO API: ipwho.is
    // ═════════════════════════════════════════════════════════════════════════
    let geoData = null;

    try {
      const geoRes = await fetch(`https://ipwho.is/${ip}`);
      const data = await geoRes.json();

      if (data && data.success !== false) {
        geoData = data;
      }
    } catch (err) {
      console.log('[GEO] Primary API error:', err.message);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 4️⃣  FALLBACK GEO API: ipapi.co
    // ═════════════════════════════════════════════════════════════════════════
    if (!geoData) {
      try {
        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
        const backupData = await geoRes.json();

        if (backupData && !backupData.error) {
          geoData = backupData;
        }
      } catch (err) {
        console.log('[GEO] Backup API error:', err.message);
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 5️⃣  FORCE FIELD EXTRACTION (NEVER UNDEFINED)
    // ═════════════════════════════════════════════════════════════════════════
    const city = geoData?.city || geoData?.town || 'unknown';
    const region = geoData?.region || geoData?.region_name || 'unknown';
    const country = geoData?.country || geoData?.country_name || 'unknown';
    const latitude = geoData?.latitude || geoData?.lat || null;
    const longitude = geoData?.longitude || geoData?.lon || null;
    const timezone =
      (geoData?.timezone && typeof geoData.timezone === 'object')
        ? (geoData.timezone.id || 'unknown')
        : (geoData?.timezone || 'unknown');

    // ═════════════════════════════════════════════════════════════════════════
    // 6️⃣  INSERT INTO login_events (unified table)
    // ═════════════════════════════════════════════════════════════════════════
    let dbSuccess = false;

    try {
      const db = getSupabase();

      if (!db) {
        console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY NOT SET');
      } else {
        const insertData = {
          user_id: 'arju',
          ip_address: ip,
          city,
          region,
          country,
          latitude,
          longitude,
          timezone,
          device_info,
          status,
          anomaly_status: 'normal',
          anomaly_reasons: '',
          source: 'vercel',
        };

        const { error } = await db
          .from('login_events')
          .insert([insertData]);

        if (error) {
          console.error('❌ DB INSERT ERROR:', error.message);
        } else {
          dbSuccess = true;
          console.log('✅ DB INSERT SUCCESS into login_events');
        }
      }
    } catch (dbErr) {
      console.error('❌ DB INSERT ERROR:', dbErr.message);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 7️⃣  EMAIL ALERT (FAILED ONLY)
    // ═════════════════════════════════════════════════════════════════════════
    let emailSent = false;

    if (status === 'FAILED') {
      emailSent = await sendFailedLoginEmail({
        ip, city, region, country, latitude, longitude, timezone, device_info, timestamp,
      });
    }

    console.log('[SUMMARY]', JSON.stringify({ status, ip, city, country, dbSuccess, emailSent }));

    // ── Response ─────────────────────────────────────────────────────────────
    return res.status(isValid ? 200 : 401).json({
      success: isValid,
      message: isValid ? 'Login successful' : 'Invalid password',
    });
  } catch (error) {
    console.error('❌ UNHANDLED ERROR:', error.message, error.stack);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
