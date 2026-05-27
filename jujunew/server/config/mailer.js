import 'dotenv/config';
import nodemailer from 'nodemailer';
import { formatTime } from '../utils/formatTime.js';
import { escapeHtml, sanitizeEmailData, redactSecret } from '../utils/sanitize.js';
import { validateEmailEnv } from '../utils/envValidator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Email alert system — sends login notifications via Gmail SMTP.
// Requires: 2-Step Verification enabled + App Password generated
// https://myaccount.google.com/apppasswords
//
// SECURITY:
//   • Credentials loaded from process.env only (never hardcoded)
//   • TLS certificate validation enabled
//   • Email template inputs are HTML-escaped to prevent injection
//   • Secret values are never logged
// ─────────────────────────────────────────────────────────────────────────────

const emailConfig = validateEmailEnv();
let transporter = null;

if (emailConfig.configured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS, // Gmail App Password (NOT your login password)
    },
    tls: {
      rejectUnauthorized: true, // SECURITY: Validate TLS certificates
    },
    connectionTimeout: 10000, // 10s connection timeout
    greetingTimeout: 10000,   // 10s greeting timeout
    socketTimeout: 15000,     // 15s socket timeout
  });

  // Verify SMTP connection on startup (log redacted credentials)
  transporter.verify()
    .then(() => console.log(`[MAILER] ✅ Gmail SMTP verified for ${redactSecret(process.env.SMTP_USER)}`))
    .catch((err) => console.error('[MAILER] ❌ SMTP verification failed:', err.message));
} else if (!emailConfig.enabled) {
  console.log('[MAILER] ℹ️  Email alerts disabled (set ALERT_EMAIL_ENABLED=true to enable).');
}
// If enabled but not configured, validateEmailEnv already logged the error.

// ─────────────────────────────────────────────────────────────────────────────
// sendLoginAlert — called on EVERY successful login (after DB insert)
//
// SECURITY: All user-controlled inputs are HTML-escaped before template use.
// ─────────────────────────────────────────────────────────────────────────────
export async function sendLoginAlert({
  userId, ip, city, region, country,
  latitude, longitude, timezone,
  device, status, reasons, timestamp,
}) {
  if (!emailConfig.configured || !transporter) return;

  // Sanitize all user-controlled string inputs for HTML injection prevention
  const safe = sanitizeEmailData(
    { userId, ip, city, region, country, device, reasons, timezone },
  );

  const isSuspicious = status === 'suspicious';

  // Google Maps link (if lat/lon available)
  const hasCoords = latitude != null && longitude != null;
  const mapsLink  = hasCoords
    ? `https://www.google.com/maps?q=${Number(latitude)},${Number(longitude)}`
    : null;

  const subject = isSuspicious
    ? `⚠️ Suspicious Login Detected — ${safe.userId}`
    : `🔓 New Login Activity — ${safe.userId}`;

  const statusBadge = isSuspicious
    ? `<span style="background:#dc2626;color:#fff;padding:3px 10px;border-radius:12px;
                    font-size:0.8rem;font-weight:600;">⚠️ SUSPICIOUS</span>`
    : `<span style="background:#16a34a;color:#fff;padding:3px 10px;border-radius:12px;
                    font-size:0.8rem;font-weight:600;">✅ NORMAL</span>`;

  const reasonsRow = isSuspicious && safe.reasons
    ? `<tr style="background:#fef2f2;">
         <td style="padding:10px 16px;color:#6b7280;width:35%;">🚨 Reason</td>
         <td style="padding:10px 16px;color:#dc2626;font-weight:600;">${safe.reasons}</td>
       </tr>`
    : '';

  const mapsRow = mapsLink
    ? `<tr>
         <td style="padding:10px 16px;color:#6b7280;">📍 Map</td>
         <td style="padding:10px 16px;">
           <a href="${mapsLink}" target="_blank"
              style="color:#2563eb;text-decoration:underline;">
             View on Google Maps ↗
           </a>
         </td>
       </tr>`
    : '';

  const tz = (safe.timezone && safe.timezone !== 'unknown') ? timezone : 'Asia/Kolkata';
  const timeStr = formatTime(timestamp || new Date(), tz, { preset: 'full' });

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:540px;margin:0 auto;
                border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;
                box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);
                  padding:22px 28px;text-align:center;">
        <h2 style="color:#f8fafc;margin:0 0 8px;font-size:1.25rem;">
          ${isSuspicious ? '⚠️ Suspicious Login Alert' : '🔓 Login Activity Detected'}
        </h2>
        ${statusBadge}
      </div>

      <!-- Body -->
      <div style="padding:0;background:#ffffff;">
        <table style="width:100%;border-collapse:collapse;font-size:0.92rem;">
          <tr style="background:#f9fafb;">
            <td style="padding:10px 16px;color:#6b7280;width:35%;">👤 User</td>
            <td style="padding:10px 16px;color:#111827;font-weight:600;">${safe.userId}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#6b7280;">🌐 IP Address</td>
            <td style="padding:10px 16px;color:#111827;font-family:monospace;">${safe.ip}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:10px 16px;color:#6b7280;">📍 Location</td>
            <td style="padding:10px 16px;color:#111827;">${safe.city}, ${safe.region}, ${safe.country}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#6b7280;">🕐 Timezone</td>
            <td style="padding:10px 16px;color:#111827;">${safe.timezone || 'unknown'}</td>
          </tr>
          <tr style="background:#f9fafb;">
            <td style="padding:10px 16px;color:#6b7280;">💻 Device</td>
            <td style="padding:10px 16px;color:#111827;word-break:break-all;font-size:0.85rem;">
              ${safe.device?.slice(0, 150) || 'unknown'}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#6b7280;">⏰ Time</td>
            <td style="padding:10px 16px;color:#111827;font-weight:600;">${escapeHtml(timeStr)}</td>
          </tr>
          ${reasonsRow}
          ${mapsRow}
        </table>
      </div>

      <!-- Footer warning (only for suspicious) -->
      ${isSuspicious ? `
        <div style="padding:16px 24px;background:#fef2f2;
                    border-top:1px solid #fecaca;">
          <p style="margin:0;color:#991b1b;font-size:0.88rem;line-height:1.5;">
            🛑 <strong>Security Notice:</strong> A login from a new location or device was detected.
            If this was not you, please secure your account immediately by changing your password.
          </p>
        </div>
      ` : `
        <div style="padding:14px 24px;background:#f0fdf4;
                    border-top:1px solid #bbf7d0;">
          <p style="margin:0;color:#166534;font-size:0.85rem;">
            ✅ This login appears normal. No action required.
          </p>
        </div>
      `}

      <!-- Brand footer -->
      <div style="padding:12px 24px;background:#f8fafc;text-align:center;
                  border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#94a3b8;font-size:0.75rem;">
          Unlock Security System • Automated Alert
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from:    `"🔐 Login Security" <${process.env.SMTP_USER}>`,
      to:      process.env.ALERT_EMAIL_TO,
      subject,
      html,
    });
    // Log without exposing full email address
    console.log(`[MAILER] ✅ Login alert sent → ${redactSecret(process.env.ALERT_EMAIL_TO)} (${status})`);
  } catch (err) {
    console.error('[MAILER] ❌ Email send failed:', err.message);
    // Re-throw so the calling route can track email_sent accurately
    throw err;
  }
}
