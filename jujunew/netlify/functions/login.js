const { Pool } = require("pg");
const nodemailer = require("nodemailer");

/**
 * Netlify Function: login
 *
 * Production-ready login handler:
 *   1. Validates password
 *   2. Fetches geolocation server-side from client IP
 *   3. Inserts EVERY attempt (success + failed) into Neon PostgreSQL
 *   4. Sends email alert ONLY on FAILED attempts
 *   5. Returns JSON response — never crashes
 *
 * Required Netlify env vars:
 *   DATABASE_URL          — Neon PostgreSQL connection string
 *   SMTP_USER             — Gmail address
 *   SMTP_PASS             — Gmail App Password (16-char)
 *   ALERT_EMAIL_TO        — Recipient email
 *   ALERT_EMAIL_ENABLED   — "true" to enable emails
 */

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth — password
// ─────────────────────────────────────────────────────────────────────────────
const CORRECT_PASSWORD = "Arju!0405";

// ─────────────────────────────────────────────────────────────────────────────
// Persistent connection pool (reused across warm invocations)
// ─────────────────────────────────────────────────────────────────────────────
let pool = null;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
    console.log("[LOGIN] Pool created for DATABASE_URL");
  }
  return pool;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-create table if it doesn't exist
// ─────────────────────────────────────────────────────────────────────────────
let tableReady = false;

async function ensureTable(db) {
  if (tableReady) return; // Skip on warm invocations
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id          SERIAL PRIMARY KEY,
        user_id     VARCHAR(255),
        ip_address  VARCHAR(50),
        city        VARCHAR(100),
        region      VARCHAR(100),
        country     VARCHAR(100),
        latitude    DECIMAL(10, 6),
        longitude   DECIMAL(10, 6),
        timezone    VARCHAR(100),
        device_info TEXT,
        status      VARCHAR(20),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    tableReady = true;
    console.log("[LOGIN] Table 'login_attempts' is ready");
  } catch (err) {
    console.error("[LOGIN] Table creation error (non-fatal):", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch geolocation from IP (server-side — never exposed to frontend)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGeo(ip) {
  const defaults = {
    city: "unknown",
    region: "unknown",
    country_name: "unknown",
    latitude: null,
    longitude: null,
    timezone: "unknown",
  };

  try {
    // For localhost/private IPs, let ipapi.co auto-detect
    const isLocal =
      ip === "::1" || ip === "127.0.0.1" || ip.startsWith("::ffff:127");
    const lookupIP = isLocal ? "" : ip;

    const res = await fetch(`https://ipapi.co/${lookupIP}/json/`, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return defaults;
    const data = await res.json();

    // ipapi.co sometimes returns error JSON
    if (data.error) return defaults;

    return {
      city: data.city || "unknown",
      region: data.region || "unknown",
      country_name: data.country_name || "unknown",
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      timezone: data.timezone || "unknown",
    };
  } catch (_) {
    // Geo failure is non-fatal
    return defaults;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Send email alert (ONLY for failed login attempts)
// ─────────────────────────────────────────────────────────────────────────────
async function sendFailedLoginEmail({ ip, city, region, country, timezone, device_info, timestamp }) {
  // Guard: only send if enabled
  if (process.env.ALERT_EMAIL_ENABLED !== "true") {
    console.log("[LOGIN] Email alerts disabled — skipping");
    return false;
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("[LOGIN] SMTP credentials missing — skipping email");
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    const timeStr = new Date(timestamp).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:540px;margin:0 auto;
                  border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;
                  box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#dc2626 0%,#991b1b 100%);
                    padding:22px 28px;text-align:center;">
          <h2 style="color:#fff;margin:0 0 8px;font-size:1.25rem;">
            ⚠️ Failed Login Attempt Detected
          </h2>
          <span style="background:rgba(255,255,255,0.2);color:#fff;padding:3px 10px;border-radius:12px;
                       font-size:0.8rem;font-weight:600;">❌ FAILED</span>
        </div>
        <div style="padding:0;background:#fff;">
          <table style="width:100%;border-collapse:collapse;font-size:0.92rem;">
            <tr style="background:#f9fafb;">
              <td style="padding:10px 16px;color:#6b7280;width:35%;">🌐 IP Address</td>
              <td style="padding:10px 16px;color:#111827;font-family:monospace;">${ip}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;color:#6b7280;">📍 Location</td>
              <td style="padding:10px 16px;color:#111827;">${city}, ${region}, ${country}</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 16px;color:#6b7280;">🕐 Timezone</td>
              <td style="padding:10px 16px;color:#111827;">${timezone}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;color:#6b7280;">💻 Device</td>
              <td style="padding:10px 16px;color:#111827;word-break:break-all;font-size:0.85rem;">
                ${(device_info || "unknown").slice(0, 150)}
              </td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 16px;color:#6b7280;">⏰ Time (IST)</td>
              <td style="padding:10px 16px;color:#111827;font-weight:600;">${timeStr}</td>
            </tr>
          </table>
        </div>
        <div style="padding:16px 24px;background:#fef2f2;border-top:1px solid #fecaca;">
          <p style="margin:0;color:#991b1b;font-size:0.88rem;line-height:1.5;">
            🛑 <strong>Security Notice:</strong> Someone tried to log in with an incorrect password.
            If this was not expected, please monitor your account.
          </p>
        </div>
        <div style="padding:12px 24px;background:#f8fafc;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#94a3b8;font-size:0.75rem;">
            ARJHBD Security System • Automated Alert
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"🔐 Login Security" <${process.env.SMTP_USER}>`,
      to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
      subject: `⚠️ Failed Login Attempt — ARJHBD`,
      html,
    });

    console.log("[LOGIN] ✅ Alert email sent to", process.env.ALERT_EMAIL_TO);
    return true;
  } catch (err) {
    console.error("[LOGIN] ❌ Email send failed:", err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NETLIFY FUNCTION HANDLER
// ─────────────────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Method Not Allowed" }),
    };
  }

  try {
    // ── Parse request ──────────────────────────────────────────────────────
    const body = JSON.parse(event.body || "{}");
    const password = body.password || "";
    const isValid = password === CORRECT_PASSWORD;
    const status = isValid ? "SUCCESS" : "FAILED";

    // ── Resolve client IP ──────────────────────────────────────────────────
    const ip =
      (event.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      event.headers["client-ip"] ||
      "unknown";

    const device_info = event.headers["user-agent"] || "unknown";
    const timestamp = new Date().toISOString();

    console.log(`[LOGIN] Attempt: status=${status} | ip=${ip}`);

    // ── Fetch geolocation (server-side) ────────────────────────────────────
    const geo = await fetchGeo(ip);
    console.log(`[LOGIN] Geo: ${geo.city}, ${geo.region}, ${geo.country_name}`);

    // ── Insert into PostgreSQL ─────────────────────────────────────────────
    let dbSuccess = false;

    try {
      const db = getPool();

      if (!db) {
        console.error("[LOGIN] ❌ DATABASE_URL not set — skipping DB insert");
      } else {
        // Test connection + ensure table exists
        await ensureTable(db);
        console.log("[LOGIN] DB Connected");

        await db.query(
          `INSERT INTO login_attempts
            (user_id, ip_address, city, region, country, latitude, longitude, timezone, device_info, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            "arju",
            ip,
            geo.city || "unknown",
            geo.region || "unknown",
            geo.country_name || "unknown",
            geo.latitude != null ? Number(geo.latitude) : null,
            geo.longitude != null ? Number(geo.longitude) : null,
            geo.timezone || "unknown",
            device_info,
            status,
          ]
        );

        dbSuccess = true;
        console.log("[LOGIN] ✅ Insert Success — status:", status);
      }
    } catch (dbErr) {
      // DB failure is non-fatal — login still works
      console.error("[LOGIN] ❌ DB Error:", dbErr.message);
    }

    // ── Send email alert ONLY for FAILED attempts ──────────────────────────
    let emailSent = false;

    if (status === "FAILED") {
      emailSent = await sendFailedLoginEmail({
        ip,
        city: geo.city || "unknown",
        region: geo.region || "unknown",
        country: geo.country_name || "unknown",
        timezone: geo.timezone || "unknown",
        device_info,
        timestamp,
      });
    }

    // ── Return response ────────────────────────────────────────────────────
    return {
      statusCode: isValid ? 200 : 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: isValid,
        message: isValid ? "Login successful" : "Invalid password",
      }),
    };
  } catch (error) {
    console.error("[LOGIN] ❌ Unhandled error:", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, message: "Internal server error" }),
    };
  }
};
