const { Pool } = require("pg");
const nodemailer = require("nodemailer");

/**
 * Netlify Function: login
 *
 * Production-ready login handler with full IP geolocation:
 *   1. Validates password
 *   2. Extracts real client IP using Netlify-safe headers
 *   3. Fetches geolocation via ipwho.is (no API key, no rate limits)
 *   4. Inserts EVERY attempt (SUCCESS + FAILED) into Neon PostgreSQL
 *   5. Sends email alert ONLY on FAILED attempts
 *   6. Returns JSON response — never crashes
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
// Persistent connection pool (reused across warm Netlify invocations)
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
// Auto-create login_logs table + index (once per cold start)
// ─────────────────────────────────────────────────────────────────────────────
let tableReady = false;

async function ensureTable(db) {
  if (tableReady) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS login_logs (
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

    // Index on ip_address for faster queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_login_logs_ip
        ON login_logs (ip_address);
    `);

    tableReady = true;
    console.log("[LOGIN] Table 'login_logs' + index ready");
  } catch (err) {
    console.error("[LOGIN] Table creation error (non-fatal):", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1️⃣  EXTRACT REAL USER IP (Netlify-safe priority chain)
// ─────────────────────────────────────────────────────────────────────────────
function resolveIP(headers) {
  // x-nf-client-connection-ip = Netlify's own header (most reliable)
  const nfIP = (headers["x-nf-client-connection-ip"] || "").trim();
  if (nfIP) return nfIP;

  // x-forwarded-for = standard proxy header (take first IP if comma-separated)
  const xff = (headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (xff) return xff;

  // client-ip = fallback
  const clientIP = (headers["client-ip"] || "").trim();
  if (clientIP) return clientIP;

  // Ultimate fallback — Google DNS IP (ensures geo API doesn't break)
  return "8.8.8.8";
}

// ─────────────────────────────────────────────────────────────────────────────
// Check if IP is local/private
// ─────────────────────────────────────────────────────────────────────────────
function isLocalIP(ip) {
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("::ffff:127.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip === "localhost"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2️⃣  IP GEOLOCATION CACHE (avoid repeated API calls on warm invocations)
// ─────────────────────────────────────────────────────────────────────────────
const geoCache = new Map();
const GEO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const GEO_CACHE_MAX = 100;            // Max cached entries

// ─────────────────────────────────────────────────────────────────────────────
// 3️⃣  FETCH GEOLOCATION via ipwho.is (no API key, no rate limits)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGeo(ip) {
  const LOCAL_RESULT = {
    city: "local",
    region: "local",
    country: "local",
    latitude: null,
    longitude: null,
    timezone: "local",
  };

  const UNKNOWN_RESULT = {
    city: "unknown",
    region: "unknown",
    country: "unknown",
    latitude: null,
    longitude: null,
    timezone: "unknown",
  };

  // ── Handle local/private IPs ───────────────────────────────────────────
  if (isLocalIP(ip)) {
    console.log("[GEO] Local IP detected — marking as 'local'");
    return LOCAL_RESULT;
  }

  // ── Check cache first ──────────────────────────────────────────────────
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.ts < GEO_CACHE_TTL) {
    console.log("[GEO] Cache hit for", ip);
    return cached.data;
  }

  // ── Fetch from ipwho.is ────────────────────────────────────────────────
  try {
    const res = await fetch(`https://ipwho.is/${ip}`, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.error("[GEO] API returned HTTP", res.status);
      return UNKNOWN_RESULT;
    }

    const data = await res.json();

    // ipwho.is returns { success: false } on invalid IPs
    if (data.success === false) {
      console.error("[GEO] API returned success=false:", data.message);
      return UNKNOWN_RESULT;
    }

    const result = {
      city:      data.city      || "unknown",
      region:    data.region    || "unknown",
      country:   data.country   || "unknown",
      latitude:  data.latitude  || null,
      longitude: data.longitude || null,
      timezone:  (data.timezone && data.timezone.id) || "unknown",
    };

    // ── Store in cache (evict oldest if full) ────────────────────────────
    if (geoCache.size >= GEO_CACHE_MAX) {
      const oldestKey = geoCache.keys().next().value;
      geoCache.delete(oldestKey);
    }
    geoCache.set(ip, { data: result, ts: Date.now() });

    console.log(`[GEO] ✅ ${ip} → ${result.city}, ${result.region}, ${result.country}`);
    return result;
  } catch (err) {
    // Geo failure is NEVER fatal — login continues
    console.error("[GEO] ❌ Fetch failed (non-fatal):", err.message);
    return UNKNOWN_RESULT;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 📩 SEND EMAIL ALERT (ONLY for FAILED login attempts)
// ─────────────────────────────────────────────────────────────────────────────
async function sendFailedLoginEmail({ ip, city, region, country, latitude, longitude, timezone, device_info, timestamp }) {
  if (process.env.ALERT_EMAIL_ENABLED !== "true") {
    console.log("[EMAIL] Alerts disabled — skipping");
    return false;
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("[EMAIL] SMTP credentials missing — skipping");
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

    // Google Maps link if coordinates available
    const hasCoords = latitude != null && longitude != null;
    const mapsLink = hasCoords
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : null;

    const mapsRow = mapsLink
      ? `<tr>
           <td style="padding:10px 16px;color:#6b7280;">📍 Map</td>
           <td style="padding:10px 16px;">
             <a href="${mapsLink}" target="_blank" style="color:#2563eb;text-decoration:underline;">
               View on Google Maps ↗
             </a>
           </td>
         </tr>`
      : "";

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
            ${mapsRow}
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

    console.log("[EMAIL] ✅ Alert sent to", process.env.ALERT_EMAIL_TO);
    return true;
  } catch (err) {
    console.error("[EMAIL] ❌ Send failed:", err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 NETLIFY FUNCTION HANDLER
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

    // ── 1️⃣ Extract real client IP (Netlify-safe) ─────────────────────────
    const ip = resolveIP(event.headers);
    const device_info = event.headers["user-agent"] || "unknown";
    const timestamp = new Date().toISOString();

    console.log(`[LOGIN] Attempt: status=${status} | ip=${ip}`);

    // ── 2️⃣ Fetch geolocation (server-side, non-blocking on failure) ─────
    const geo = await fetchGeo(ip);
    console.log(`[LOGIN] Geo: ${geo.city}, ${geo.region}, ${geo.country} | tz=${geo.timezone}`);

    // ── 3️⃣ Safe data extraction (never undefined) ───────────────────────
    const city      = geo.city      || "unknown";
    const region    = geo.region    || "unknown";
    const country   = geo.country   || "unknown";
    const latitude  = geo.latitude  != null ? Number(geo.latitude)  : null;
    const longitude = geo.longitude != null ? Number(geo.longitude) : null;
    const timezone  = geo.timezone  || "unknown";

    // ── 4️⃣ Insert into PostgreSQL (login_logs table) ────────────────────
    let dbSuccess = false;

    try {
      const db = getPool();

      if (!db) {
        console.error("[LOGIN] ❌ DATABASE_URL not set — skipping DB insert");
      } else {
        await ensureTable(db);
        console.log("[LOGIN] DB Connected");

        await db.query(
          `INSERT INTO login_logs
            (user_id, ip_address, city, region, country, latitude, longitude, timezone, device_info, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
          [
            "arju",
            ip,
            city,
            region,
            country,
            latitude,
            longitude,
            timezone,
            device_info,
            status,
          ]
        );

        dbSuccess = true;
        console.log("[LOGIN] ✅ Insert Success — status:", status, "| ip:", ip);
      }
    } catch (dbErr) {
      // DB failure is non-fatal — login response still works
      console.error("[LOGIN] ❌ DB Error:", dbErr.message);
    }

    // ── 5️⃣ Send email alert ONLY for FAILED attempts ────────────────────
    let emailSent = false;

    if (status === "FAILED") {
      emailSent = await sendFailedLoginEmail({
        ip,
        city,
        region,
        country,
        latitude,
        longitude,
        timezone,
        device_info,
        timestamp,
      });
    }

    // ── Return response (login is never delayed) ─────────────────────────
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
