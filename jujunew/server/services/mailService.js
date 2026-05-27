import 'dotenv/config';
import nodemailer from 'nodemailer';
import { formatTime } from '../utils/formatTime.js';
import { escapeHtml, redactSecret } from '../utils/sanitize.js';
import { validateEmailEnv } from '../utils/envValidator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mail Service — secondary email sender used by Express routes
//
// SECURITY:
//   • Lazy transporter initialization (only when first email is sent)
//   • Environment variables validated before creating transporter
//   • TLS certificate validation enabled
//   • Credentials never logged in plaintext
// ─────────────────────────────────────────────────────────────────────────────

let transporter = null;
let transporterVerified = false;

/**
 * Get or create the Nodemailer transporter (lazy singleton).
 * Returns null if email is not configured.
 */
function getTransporter() {
  if (transporter) return transporter;

  const emailConfig = validateEmailEnv();
  if (!emailConfig.configured) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: true, // SECURITY: Validate TLS certificates
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporter;
}

/**
 * Verify SMTP connection (called once on first use).
 */
async function ensureVerified() {
  if (transporterVerified) return true;
  const t = getTransporter();
  if (!t) return false;

  try {
    await t.verify();
    transporterVerified = true;
    console.log(`[MAILER] ✅ SMTP verified for ${redactSecret(process.env.SMTP_USER)}`);
    return true;
  } catch (err) {
    console.error('[MAILER] ❌ SMTP verification failed:', err.message);
    return false;
  }
}

export async function sendAlertEmail(data) {
  const t = getTransporter();
  if (!t) {
    console.log('[MAILER] ℹ️  Email skipped (not configured)');
    return false;
  }

  await ensureVerified();

  const {
    user_id,
    ip_address,
    city,
    region,
    country,
    latitude,
    longitude,
    timezone,
    device_info,
    created_at,
  } = data;

  // Sanitize user-controlled inputs for safe HTML rendering
  const safeUserId = escapeHtml(user_id);
  const safeIp = escapeHtml(ip_address);
  const safeCity = escapeHtml(city || 'unknown');
  const safeRegion = escapeHtml(region || 'unknown');
  const safeCountry = escapeHtml(country || 'unknown');
  const safeTz = escapeHtml(timezone || 'unknown');
  const safeDevice = escapeHtml(device_info || 'unknown');

  const tz = (timezone && timezone !== 'unknown') ? timezone : 'Asia/Kolkata';
  const timeStr = formatTime(created_at || new Date(), tz, { preset: 'full' });

  const subject = `🚨 New Login Alert`;
  const text = `
New Login Detected

User ID: ${safeUserId}
IP Address: ${safeIp}
Location: ${safeCity}, ${safeRegion}, ${safeCountry}
Coordinates: ${latitude ?? 'unknown'}, ${longitude ?? 'unknown'}
Timezone: ${safeTz}
Device: ${safeDevice}
Time: ${escapeHtml(timeStr)}
`.trim();

  try {
    const info = await t.sendMail({
      from: `"Security Alert" <${process.env.SMTP_USER}>`,
      to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
      subject,
      text,
    });
    console.log(`[MAILER] ✅ Email sent (Message ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error('[MAILER] ❌ Email failed:', error.message);
    // Don't throw so main flow isn't broken
    return false;
  }
}
