import 'dotenv/config';
import nodemailer from 'nodemailer';
import { formatTime } from '../utils/formatTime.js';

// Configure Nodemailer transporter using SMTP credentials
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Verify connection
transporter.verify()
  .then(() => console.log('[MAILER] SMTP transporter initialized'))
  .catch((err) => console.error('[MAILER] SMTP verification failed:', err.message));

export async function sendAlertEmail(data) {
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

  const subject = `🚨 New Login Alert`;
  const text = `
New Login Detected

User ID: ${user_id}
IP Address: ${ip_address}
Location: ${city || 'unknown'}, ${region || 'unknown'}, ${country || 'unknown'}
Coordinates: ${latitude ?? 'unknown'}, ${longitude ?? 'unknown'}
Timezone: ${timezone || 'unknown'}
Device: ${device_info || 'unknown'}
Time: ${formatTime(created_at || new Date(), (timezone && timezone !== 'unknown') ? timezone : 'Asia/Kolkata', { preset: 'full' })}
`.trim();

  try {
    console.log('[MAILER] Sending email...');
    const info = await transporter.sendMail({
      from: `"Security Alert" <${process.env.SMTP_USER}>`,
      to: process.env.ALERT_EMAIL_TO || process.env.SMTP_USER,
      subject,
      text,
    });
    console.log(`[MAILER] Email sent successfully (Message ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error('[MAILER] Email failed:', error);
    // Don't throw so main flow isn't broken
    return false;
  }
}
