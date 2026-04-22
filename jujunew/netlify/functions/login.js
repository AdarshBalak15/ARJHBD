const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");

/**
 * Netlify Function: login
 * Migrated from Neon (pg/Pool) to Supabase
 */

const CORRECT_PASSWORD = "Arju!0405";

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
    console.log("[DB] Supabase client created");
  }
  return supabase;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email alert (FAILED only)
// ─────────────────────────────────────────────────────────────────────────────
async function sendFailedLoginEmail({ ip, city, region, country, latitude, longitude, timezone, device_info, timestamp }) {
  if (process.env.ALERT_EMAIL_ENABLED !== "true") return false;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return false;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });

    const timeStr = new Date(timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const hasCoords = latitude != null && longitude != null;
    const mapsLink = hasCoords ? `https://www.google.com/maps?q=${latitude},${longitude}` : null;
    const mapsRow = mapsLink
      ? `<tr><td style="padding:10px 16px;color:#6b7280;">📍 Map</td><td style="padding:10px 16px;"><a href="${mapsLink}" target="_blank" style="color:#2563eb;">View on Google Maps ↗</a></td></tr>`
      : "";

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
            <tr><td style="padding:10px 16px;color:#6b7280;">💻 Device</td><td style="padding:10px 16px;color:#111827;word-break:break-all;font-size:0.85rem;">${(device_info || "unknown").slice(0, 150)}</td></tr>
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

    console.log("[EMAIL] ✅ Alert sent");
    return true;
  } catch (err) {
    console.error("[EMAIL] ❌ Send failed:", err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 NETLIFY FUNCTION HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Method Not Allowed" }),
    };
  }

  try {
    // ── Parse request ────────────────────────────────────────────────────────
    const body = JSON.parse(event.body || "{}");
    const password = body.password || "";
    const isValid = password === CORRECT_PASSWORD;
    const status = isValid ? "SUCCESS" : "FAILED";
    const device_info = event.headers["user-agent"] || "unknown";
    const timestamp = new Date().toISOString();

    // ═════════════════════════════════════════════════════════════════════════
    // 1️⃣  FORCE CLEAN IP EXTRACTION
    // ═════════════════════════════════════════════════════════════════════════
    console.log("======== DEBUG START ========");
    console.log("HEADERS:", JSON.stringify(event.headers));

    let rawIp =
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["x-forwarded-for"] ||
      event.headers["client-ip"] ||
      "";

    console.log("RAW IP:", rawIp);

    let ip = rawIp;

    if (ip.includes(",")) {
      ip = ip.split(",")[0].trim();
    }

    if (!ip || ip === "::1" || ip === "127.0.0.1") {
      ip = "8.8.8.8"; // fallback
    }

    console.log("FINAL IP USED:", ip);

    // ═════════════════════════════════════════════════════════════════════════
    // 2️⃣  PRIMARY GEO API: ipwho.is
    // ═════════════════════════════════════════════════════════════════════════
    let geoData = null;

    try {
      console.log("CALLING PRIMARY API: https://ipwho.is/" + ip);
      const res = await fetch(`https://ipwho.is/${ip}`);
      const data = await res.json();

      console.log("PRIMARY API RAW RESPONSE:", JSON.stringify(data));

      if (data && data.success !== false) {
        geoData = data;
        console.log("PRIMARY API: ✅ SUCCESS");
      } else {
        console.log("PRIMARY API: ❌ returned success=false");
      }
    } catch (err) {
      console.log("PRIMARY API ERROR:", err.message);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 3️⃣  FALLBACK GEO API: ipapi.co
    // ═════════════════════════════════════════════════════════════════════════
    if (!geoData) {
      try {
        console.log("CALLING BACKUP API: https://ipapi.co/" + ip + "/json/");
        const res = await fetch(`https://ipapi.co/${ip}/json/`);
        const backupData = await res.json();

        console.log("BACKUP API RAW RESPONSE:", JSON.stringify(backupData));

        if (backupData && !backupData.error) {
          geoData = backupData;
          console.log("BACKUP API: ✅ SUCCESS");
        } else {
          console.log("BACKUP API: ❌ returned error:", backupData?.reason);
        }
      } catch (err) {
        console.log("BACKUP API ERROR:", err.message);
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 4️⃣  FORCE FIELD EXTRACTION (NEVER UNDEFINED)
    // ═════════════════════════════════════════════════════════════════════════
    const city = geoData?.city || geoData?.town || "unknown";
    const region = geoData?.region || geoData?.region_name || "unknown";
    const country = geoData?.country || geoData?.country_name || "unknown";
    const latitude = geoData?.latitude || geoData?.lat || null;
    const longitude = geoData?.longitude || geoData?.lon || null;
    const timezone =
      (geoData?.timezone && typeof geoData.timezone === "object")
        ? (geoData.timezone.id || "unknown")
        : (geoData?.timezone || "unknown");

    console.log("FINAL EXTRACTED DATA:", JSON.stringify({
      city,
      region,
      country,
      latitude,
      longitude,
      timezone,
    }));

    // ═════════════════════════════════════════════════════════════════════════
    // 5️⃣  VERIFY BEFORE INSERT
    // ═════════════════════════════════════════════════════════════════════════
    if (city === "unknown" && region === "unknown" && country === "unknown") {
      console.log("⚠️ ERROR: GEO DATA NOT RESOLVED — all fields are 'unknown'");
      console.log("⚠️ geoData was:", geoData ? JSON.stringify(geoData) : "null");
    } else {
      console.log("✅ GEO DATA RESOLVED SUCCESSFULLY");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 6️⃣  INSERT INTO login_logs VIA SUPABASE (replaces raw SQL)
    // ═════════════════════════════════════════════════════════════════════════
    let dbSuccess = false;

    try {
      const db = getSupabase();

      if (!db) {
        console.error("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY NOT SET — cannot insert");
      } else {
        console.log("Supabase client ready ✅");

        const insertData = {
          user_id: "arju",
          ip_address: ip,
          city,
          region,
          country,
          latitude,
          longitude,
          timezone,
          device_info,
          status,
        };

        console.log("INSERT DATA:", JSON.stringify(insertData));

        const { error } = await db
          .from('login_logs')
          .insert([insertData]);

        if (error) {
          console.error("❌ SUPABASE INSERT ERROR:", error.message);
        } else {
          dbSuccess = true;
          console.log("✅ DB INSERT SUCCESS");
        }
      }
    } catch (dbErr) {
      console.error("❌ DB INSERT ERROR:", dbErr.message);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 7️⃣  EMAIL ALERT (FAILED ONLY)
    // ═════════════════════════════════════════════════════════════════════════
    let emailSent = false;

    if (status === "FAILED") {
      emailSent = await sendFailedLoginEmail({
        ip, city, region, country, latitude, longitude, timezone, device_info, timestamp,
      });
    }

    console.log("======== DEBUG END ========");
    console.log("SUMMARY:", JSON.stringify({
      status,
      ip,
      city,
      region,
      country,
      latitude,
      longitude,
      timezone,
      dbSuccess,
      emailSent,
    }));

    // ── Response ─────────────────────────────────────────────────────────────
    return {
      statusCode: isValid ? 200 : 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: isValid,
        message: isValid ? "Login successful" : "Invalid password",
      }),
    };
  } catch (error) {
    console.error("❌ UNHANDLED ERROR:", error.message, error.stack);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Internal server error" }),
    };
  }
};
