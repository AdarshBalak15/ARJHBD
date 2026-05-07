const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const { formatTime } = require("./utils/formatTime.cjs");

let supabase = null;
function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    console.log("[DB] Supabase client created");
  }
  return supabase;
}

async function sendLoginEmail({ ip, city, region, country, latitude, longitude, timezone, device_info, timestamp, status }) {
  if (process.env.ALERT_EMAIL_ENABLED !== "true") { console.log("[EMAIL] Disabled"); return false; }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) { console.error("[EMAIL] Missing SMTP creds"); return false; }
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
    });
    await transporter.verify();
    console.log("[EMAIL] SMTP verified");

    const isOk = status === "SUCCESS";
    const timeStr = formatTime(timestamp, timezone !== "unknown" ? timezone : "Asia/Kolkata", { preset: "full" });
    const mapsLink = (latitude != null && longitude != null) ? `https://www.google.com/maps?q=${latitude},${longitude}` : null;
    const mapsRow = mapsLink ? `<tr><td style="padding:10px 16px;color:#6b7280;">📍 Map</td><td style="padding:10px 16px;"><a href="${mapsLink}" target="_blank" style="color:#2563eb;">View on Google Maps ↗</a></td></tr>` : "";
    const headerBg = isOk ? "linear-gradient(135deg,#1e293b 0%,#0f172a 100%)" : "linear-gradient(135deg,#dc2626 0%,#991b1b 100%)";
    const badge = isOk ? '<span style="background:#16a34a;color:#fff;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">✅ SUCCESS</span>' : '<span style="background:rgba(255,255,255,0.2);color:#fff;padding:3px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">❌ FAILED</span>';
    const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:540px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;"><div style="background:${headerBg};padding:22px 28px;text-align:center;"><h2 style="color:#fff;margin:0 0 8px;font-size:1.25rem;">${isOk ? "🔓 Login Activity" : "⚠️ Failed Login"}</h2>${badge}</div><div style="padding:0;background:#fff;"><table style="width:100%;border-collapse:collapse;font-size:0.92rem;"><tr style="background:#f9fafb;"><td style="padding:10px 16px;color:#6b7280;width:35%;">🌐 IP</td><td style="padding:10px 16px;font-family:monospace;">${ip}</td></tr><tr><td style="padding:10px 16px;color:#6b7280;">📍 Location</td><td style="padding:10px 16px;">${city}, ${region}, ${country}</td></tr><tr style="background:#f9fafb;"><td style="padding:10px 16px;color:#6b7280;">🕐 Timezone</td><td style="padding:10px 16px;">${timezone}</td></tr><tr><td style="padding:10px 16px;color:#6b7280;">💻 Device</td><td style="padding:10px 16px;word-break:break-all;font-size:0.85rem;">${(device_info||"unknown").slice(0,150)}</td></tr><tr style="background:#f9fafb;"><td style="padding:10px 16px;color:#6b7280;">⏰ Time</td><td style="padding:10px 16px;font-weight:600;">${timeStr}</td></tr>${mapsRow}</table></div><div style="padding:12px 24px;background:#f8fafc;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;color:#94a3b8;font-size:0.75rem;">ARJHBD Security • Netlify</p></div></div>`;

    await transporter.sendMail({
      from: `"🔐 Login Security" <${process.env.SMTP_USER}>`,
      to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
      subject: isOk ? "🔓 Login Activity — ARJHBD" : "⚠️ Failed Login — ARJHBD",
      html,
    });
    console.log("[EMAIL] ✅ Sent for:", status);
    return true;
  } catch (err) {
    console.error("[EMAIL] ❌ Failed:", err.message);
    return false;
  }
}

// CORS headers constant
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ success: false, message: "Method Not Allowed" }) };
  }

  try {
    const t0 = Date.now();
    console.log("======== LOGIN START ========");
    const body = JSON.parse(event.body || "{}");
    const password = body.password || "";
    const device_info = event.headers["user-agent"] || "unknown";
    const timestamp = new Date().toISOString();

    // 1. Password
    const HASHED_PASSWORD = process.env.HASHED_PASSWORD;
    let isValid = false;
    if (HASHED_PASSWORD && password) {
      try { isValid = await bcrypt.compare(password, HASHED_PASSWORD); } catch (e) { console.error("[AUTH] bcrypt error:", e.message); }
    } else { console.error("[AUTH] ❌ HASHED_PASSWORD not set or empty password"); }
    const status = isValid ? "SUCCESS" : "FAILED";

    // 2. IP
    let ip = event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"] || event.headers["client-ip"] || "";
    if (ip.includes(",")) ip = ip.split(",")[0].trim();
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);
    if (!ip || ip === "::1" || ip === "127.0.0.1") ip = "8.8.8.8";
    console.log("[AUTH] IP:", ip, "| Status:", status);

    // 3. Geo primary
    let geoData = null;
    try { const r = await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(4000) }); const d = await r.json(); if (d && d.success !== false) geoData = d; } catch (e) { console.log("[GEO] Primary fail:", e.message); }

    // 4. Geo fallback
    if (!geoData) { try { const r = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(4000) }); const d = await r.json(); if (d && !d.error) geoData = d; } catch (e) { console.log("[GEO] Fallback fail:", e.message); } }

    // 5. Fields
    const city = geoData?.city || geoData?.town || "unknown";
    const region = geoData?.region || geoData?.region_name || "unknown";
    const country = geoData?.country || geoData?.country_name || "unknown";
    const latitude = geoData?.latitude || geoData?.lat || null;
    const longitude = geoData?.longitude || geoData?.lon || null;
    const timezone = (geoData?.timezone && typeof geoData.timezone === "object") ? (geoData.timezone.id || "unknown") : (geoData?.timezone || "unknown");

    // 6. DB
    let dbSuccess = false;
    try {
      const db = getSupabase();
      if (!db) { console.error("[DB] ❌ Not initialized"); }
      else {
        const { error } = await db.from("login_events").insert([{ user_id: "arju", ip_address: ip, city, region, country, latitude, longitude, timezone, device_info, status, anomaly_status: "normal", anomaly_reasons: "", source: "netlify" }]);
        if (error) { console.error("[DB] ❌ Insert error:", error.message); } else { dbSuccess = true; console.log("[DB] ✅ Insert OK"); }
      }
    } catch (e) { console.error("[DB] ❌ Exception:", e.message); }

    // 7. Email (both success & failed)
    let emailSent = false;
    try { emailSent = await sendLoginEmail({ ip, city, region, country, latitude, longitude, timezone, device_info, timestamp, status }); } catch (e) { console.error("[EMAIL] ❌ Exception:", e.message); }

    console.log("[SUMMARY]", JSON.stringify({ status, ip, city, dbSuccess, emailSent, ms: Date.now() - t0 }));
    console.log("======== LOGIN END ========");

    return { statusCode: isValid ? 200 : 401, headers: corsHeaders, body: JSON.stringify({ success: isValid, message: isValid ? "Login successful" : "Invalid password" }) };
  } catch (error) {
    console.error("❌ UNHANDLED:", error.message, error.stack);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ success: false, message: "Internal server error" }) };
  }
};
