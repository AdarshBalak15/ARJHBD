const { Client } = require("pg");

/**
 * Netlify Function: login
 *
 * Validates password, logs ALL attempts (success + failure) to PostgreSQL
 * with full geolocation + device info. Geo data fetched server-side from
 * the user's IP — no client-side geo needed.
 *
 * Environment variable required in Netlify dashboard:
 *   DATABASE_URL — PostgreSQL connection string
 *
 * Optional env vars (for email alerts):
 *   SMTP_USER, SMTP_PASS, ALERT_EMAIL_TO
 */

const CORRECT_PASSWORD = "Arju!0405";

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const password = body.password || "";
    const isValid = password === CORRECT_PASSWORD;

    // ── Get user IP ──
    const ip =
      (event.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      event.headers["client-ip"] ||
      "unknown";

    // ── Fetch geo data (server-side, from IP) ──
    let geo = {};
    try {
      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, {
        signal: AbortSignal.timeout(4000),
      });
      if (geoRes.ok) {
        geo = await geoRes.json();
      }
    } catch (_) {
      // Geo API failure is non-fatal — use fallback values
      geo = {};
    }

    const device_info = event.headers["user-agent"] || "unknown";
    const status = isValid ? "SUCCESS" : "FAILED";

    // ── Insert into PostgreSQL ──
    let dbSuccess = false;
    try {
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });

      await client.connect();

      await client.query(
        `INSERT INTO login_attempts
          (user_id, ip_address, city, region, country, latitude, longitude, timezone, device_info, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          "arju",
          ip,
          geo.city || "unknown",
          geo.region || "unknown",
          geo.country_name || "unknown",
          geo.latitude != null ? Number(geo.latitude) : 0,
          geo.longitude != null ? Number(geo.longitude) : 0,
          geo.timezone || "unknown",
          device_info,
          status,
        ]
      );

      await client.end();
      dbSuccess = true;
    } catch (dbErr) {
      // DB failure is non-fatal — login still works
      console.error("[LOGIN] DB insert failed:", dbErr.message);
    }

    // ── Send email alert (optional, non-blocking) ──
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        // Dynamic import for nodemailer (only if env vars exist)
        const nodemailer = require("nodemailer");
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

        await transporter.sendMail({
          from: `"Security Alert" <${process.env.SMTP_USER}>`,
          to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
          subject: `🚨 Login ${status} — ARJHBD`,
          text: [
            `Login ${status}`,
            ``,
            `User ID: arju`,
            `IP: ${ip}`,
            `Location: ${geo.city || "unknown"}, ${geo.region || "unknown"}, ${geo.country_name || "unknown"}`,
            `Coordinates: ${geo.latitude ?? "unknown"}, ${geo.longitude ?? "unknown"}`,
            `Timezone: ${geo.timezone || "unknown"}`,
            `Device: ${device_info}`,
            `Time: ${new Date().toISOString()}`,
          ].join("\n"),
        });
      } catch (_) {
        // Email failure is non-fatal
      }
    }

    return {
      statusCode: isValid ? 200 : 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: isValid,
        message: isValid ? "Login successful" : "Invalid password",
      }),
    };
  } catch (error) {
    console.error("[LOGIN] Unhandled error:", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
