// ─────────────────────────────────────────────────────────────────────────────
// netlify/functions/login.js — Production-Grade Login Handler (Netlify)
//
// Same pipeline as api/login.js but using CommonJS for Netlify compatibility.
// ─────────────────────────────────────────────────────────────────────────────

const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { formatTime } = require("./utils/formatTime.cjs");
const { extractIp, detectPlatform } = require("./utils/extractIp.cjs");
const { geoLookup } = require("./utils/geoLookup.cjs");
const { parseDevice } = require("./utils/deviceParser.cjs");
const { safeInsert } = require("./utils/dbInsert.cjs");

// ─────────────────────────────────────────────────────────────────────────────
// Email Alert
// ─────────────────────────────────────────────────────────────────────────────

async function sendLoginEmail({ ip, city, region, country, latitude, longitude, timezone, device_info, timestamp, status }) {
  if (process.env.ALERT_EMAIL_ENABLED !== "true") { console.log("[EMAIL] Disabled"); return false; }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) { console.error("[EMAIL] Missing SMTP creds"); return false; }
  try {
    var transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
    });
    await transporter.verify();
    console.log("[EMAIL] SMTP verified");

    var isOk = status === "SUCCESS";
    var tz = (timezone && timezone !== "unknown") ? timezone : "Asia/Kolkata";
    var timeStr = formatTime(timestamp, tz, { preset: "full" });
    var loc = [city, region, country].filter(function (v) { return v && v !== "unknown"; }).join(", ") || "Unknown location";
    var mapsLink = (latitude != null && longitude != null) ? "https://www.google.com/maps?q=" + latitude + "," + longitude : null;
    var mapsRow = mapsLink ? '<tr><td style="padding:10px 16px;color:#6b7280;">📍 Map</td><td style="padding:10px 16px;"><a href="' + mapsLink + '" target="_blank" style="color:#2563eb;">View on Google Maps ↗</a></td></tr>' : "";
    var headerBg = isOk ? "linear-gradient(135deg,#1e293b 0%,#0f172a 100%)" : "linear-gradient(135deg,#dc2626 0%,#991b1b 100%)";
    var badge = isOk ? '<span style="background:#16a34a;color:#fff;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">✅ SUCCESS</span>' : '<span style="background:rgba(255,255,255,0.2);color:#fff;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">❌ FAILED</span>';
    var html = '<div style="font-family:\'Segoe UI\',Arial,sans-serif;max-width:540px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;"><div style="background:' + headerBg + ';padding:22px 28px;text-align:center;"><h2 style="color:#fff;margin:0 0 8px;font-size:1.25rem;">' + (isOk ? "🔓 Login Activity" : "⚠️ Failed Login") + '</h2>' + badge + '</div><div style="padding:0;background:#fff;"><table style="width:100%;border-collapse:collapse;font-size:0.92rem;"><tr style="background:#f9fafb;"><td style="padding:10px 16px;color:#6b7280;width:35%;">🌐 IP</td><td style="padding:10px 16px;font-family:monospace;">' + (ip || "unknown") + '</td></tr><tr><td style="padding:10px 16px;color:#6b7280;">📍 Location</td><td style="padding:10px 16px;">' + loc + '</td></tr><tr style="background:#f9fafb;"><td style="padding:10px 16px;color:#6b7280;">🕐 Timezone</td><td style="padding:10px 16px;">' + (timezone || "unknown") + '</td></tr><tr><td style="padding:10px 16px;color:#6b7280;">💻 Device</td><td style="padding:10px 16px;word-break:break-all;font-size:0.85rem;">' + ((device_info || "unknown").slice(0, 150)) + '</td></tr><tr style="background:#f9fafb;"><td style="padding:10px 16px;color:#6b7280;">⏰ Time</td><td style="padding:10px 16px;font-weight:600;">' + timeStr + '</td></tr>' + mapsRow + '</table></div><div style="padding:12px 24px;background:#f8fafc;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;color:#94a3b8;font-size:0.75rem;">ARJHBD Security • Netlify</p></div></div>';

    await transporter.sendMail({
      from: '"🔐 Login Security" <' + process.env.SMTP_USER + '>',
      to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
      subject: isOk ? "🔓 Login Activity — ARJHBD" : "⚠️ Failed Login — ARJHBD",
      html: html,
    });
    console.log("[EMAIL] ✅ Sent for:", status);
    return true;
  } catch (err) {
    console.error("[EMAIL] ❌ Failed:", err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORS Headers
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ success: false, message: "Method Not Allowed" }) };
  }

  try {
    var t0 = Date.now();
    var platform = detectPlatform(event.headers);
    console.log("======== LOGIN START ========");
    console.log("[LOGIN] Platform:", platform);

    var body = {};
    try { body = JSON.parse(event.body || "{}"); } catch (_e) { body = {}; }
    var password = body.password || "";
    var userAgent = event.headers["user-agent"] || "unknown";
    var timestamp = new Date().toISOString();

    // ── 1. Password validation ──
    var HASHED_PASSWORD = process.env.HASHED_PASSWORD;
    var isValid = false;
    if (HASHED_PASSWORD && password) {
      try { isValid = await bcrypt.compare(password, HASHED_PASSWORD); }
      catch (e) { console.error("[AUTH] bcrypt error:", e.message); }
    } else {
      console.error("[AUTH] ❌ HASHED_PASSWORD not set or empty password");
    }
    var status = isValid ? "SUCCESS" : "FAILED";
    console.log("[AUTH] Status:", status);

    // ── 2. IP extraction (production-safe) ──
    var ipResult = extractIp(event.headers);
    var ip = ipResult.ip || null;

    if (!ip) {
      console.warn("[LOGIN] ⚠️ Could not extract client IP — raw headers:", JSON.stringify(ipResult.raw));
    }

    // ── 3. Geo lookup (retry + multi-provider) ──
    var geo = await geoLookup(ip);
    console.log("[LOGIN] Geo result:", JSON.stringify({
      city: geo.city, country: geo.country,
      status: geo.lookup_status, source: geo.geo_source,
    }));

    // ── 4. Device parsing ──
    var device = parseDevice(userAgent);

    // ── 5. DB insert ──
    var insertData = {
      user_id: "arju",
      ip_address: ip || "unknown",
      city: geo.city || "unknown",
      region: geo.region || "unknown",
      country: geo.country || "unknown",
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezone: geo.timezone || "unknown",
      device_info: userAgent.slice(0, 500),
      status: status,
      anomaly_status: "normal",
      anomaly_reasons: "",
      source: platform || "netlify",
    };

    console.log("[LOGIN] DB payload:", JSON.stringify(insertData));
    var dbResult = await safeInsert("login_events", insertData);

    // ── 6. Email ──
    var emailSent = false;
    try {
      emailSent = await sendLoginEmail({
        ip: ip || "unknown",
        city: geo.city || "unknown",
        region: geo.region || "unknown",
        country: geo.country || "unknown",
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezone || "unknown",
        device_info: userAgent,
        timestamp: timestamp,
        status: status,
      });
    } catch (e) {
      console.error("[EMAIL] ❌ Exception:", e.message);
    }

    // ── 7. Summary ──
    var elapsed = Date.now() - t0;
    console.log("[SUMMARY]", JSON.stringify({
      status: status, ip: ip || "none",
      city: geo.city || "unknown", geoSource: geo.geo_source,
      lookupStatus: geo.lookup_status,
      dbSuccess: dbResult.success, dbError: dbResult.error || null,
      emailSent: emailSent, ms: elapsed, platform: platform,
    }));
    console.log("======== LOGIN END ========");

    return {
      statusCode: isValid ? 200 : 401,
      headers: corsHeaders,
      body: JSON.stringify({ success: isValid, message: isValid ? "Login successful" : "Invalid password" }),
    };
  } catch (error) {
    console.error("❌ UNHANDLED:", error.message, error.stack);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, message: "Internal server error" }),
    };
  }
};
