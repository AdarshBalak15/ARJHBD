import { Router } from 'express';
import supabase from '../config/db.js';
import { sendAlertEmail } from '../services/mailService.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Validate required fields
// ─────────────────────────────────────────────────────────────────────────────
function validate(body) {
  const required = ['user_id', 'ip_address', 'device_info'];
  for (const field of required) {
    if (!body[field] || typeof body[field] !== 'string' || !body[field].trim())
      return { valid: false, reason: `Missing or invalid field: ${field}` };
  }
  if (body.latitude  != null && isNaN(Number(body.latitude)))
    return { valid: false, reason: 'latitude must be a number' };
  if (body.longitude != null && isNaN(Number(body.longitude)))
    return { valid: false, reason: 'longitude must be a number' };
  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Anomaly detection — compares with last login for same user_id
// ─────────────────────────────────────────────────────────────────────────────
async function detectAnomaly(userId, city, deviceInfo) {
  try {
    const { data: rows, error } = await supabase
      .from('login_activity')
      .select('city, device_info')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !rows || rows.length === 0) {
      return { status: 'normal', reasons: [] };
    }

    const last    = rows[0];
    const reasons = [];

    if (last.city && city && last.city.toLowerCase() !== city.toLowerCase()) {
      reasons.push(`New city: "${city}" (was "${last.city}")`);
    }

    if (last.device_info && deviceInfo && last.device_info !== deviceInfo) {
      reasons.push('New device / browser detected');
    }

    return {
      status:  reasons.length > 0 ? 'suspicious' : 'normal',
      reasons,
    };
  } catch (err) {
    console.error('[ANOMALY] Detection error (non-fatal):', err.message);
    return { status: 'normal', reasons: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/log-login
// Full verification pipeline:
//   Step 1 → Validate input
//   Step 2 → Anomaly detection
//   Step 3 → INSERT into Supabase (login_activity)
//   Step 4 → Send email alert (only if DB succeeded)
//   Step 5 → Return verification flags
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    user_id, ip_address, city, region,
    country, latitude, longitude, timezone, device_info,
  } = req.body;

  // ── Step 1: Validation ─────────────────────────────────────────────────────
  const check = validate(req.body);
  if (!check.valid) {
    console.warn('[LOG-LOGIN] ⚠️  Validation failed:', check.reason);
    return res.status(200).json({
      success:     false,
      db_inserted: false,
      email_sent:  false,
      message:     check.reason,
    });
  }

  // ── Step 2: Anomaly detection ──────────────────────────────────────────────
  const { status, reasons } = await detectAnomaly(
    user_id.trim(),
    city || '',
    device_info.trim()
  );

  if (status === 'suspicious') {
    console.warn(`[LOG-LOGIN] 🚨 Suspicious login for "${user_id}":`, reasons.join(' | '));
  }

  // ── Step 3: INSERT into Supabase (login_activity) ──────────────────────────
  let dbRecord  = null;
  let dbSuccess = false;

  try {
    const { data: row, error } = await supabase
      .from('login_activity')
      .insert([{
        user_id:    user_id.trim()                    || 'unknown',
        ip_address: ip_address.trim()                 || 'unknown',
        city:       (city      || 'unknown').trim(),
        region:     (region    || 'unknown').trim(),
        country:    (country   || 'unknown').trim(),
        latitude:   latitude  != null ? Number(latitude)  : null,
        longitude:  longitude != null ? Number(longitude) : null,
        timezone:   (timezone  || 'unknown').trim(),
        device_info: device_info.trim()               || 'unknown',
        status,
      }])
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    dbRecord  = row;
    dbSuccess = true;

    console.log(
      `[LOG-LOGIN] ✅ DB INSERT SUCCESS — id:${dbRecord.id} | user:${user_id} | ` +
      `ip:${ip_address} | ${city}, ${region}, ${country} | ` +
      `status:${dbRecord.status} | ${dbRecord.created_at}`
    );
  } catch (err) {
    console.error('[LOG-LOGIN] ❌ DB INSERT FAILED:', err.message);
    // DB failed → do NOT send email → return immediately
    return res.status(200).json({
      success:     false,
      db_inserted: false,
      email_sent:  false,
      message:     'Database insertion failed',
    });
  }

  // ── Step 4: Send email alert (only if DB succeeded) ────────────────────────
  let emailSent = false;

  try {
    await sendAlertEmail({
      user_id:   user_id,
      ip_address: ip_address,
      city:      city      || 'unknown',
      region:    region    || 'unknown',
      country:   country   || 'unknown',
      latitude:  latitude  ?? null,
      longitude: longitude ?? null,
      timezone:  timezone  || 'unknown',
      device_info: device_info,
      created_at: dbRecord.created_at,
    });

    emailSent = true;
  } catch (err) {
    console.error('[LOG-LOGIN] 📧 EMAIL FAILED (non-fatal):', err.message);
    // Email failure is non-fatal — DB record is safe
  }

  // ── Step 5: Return full verification response ─────────────────────────────
  return res.status(200).json({
    success:     true,
    db_inserted: dbSuccess,
    email_sent:  emailSent,
    message:     emailSent
      ? 'Login logged + email sent'
      : 'Login logged (email not sent)',
    db_record: {
      id:         dbRecord.id,
      user_id:    dbRecord.user_id,
      ip_address: dbRecord.ip_address,
      city:       dbRecord.city,
      region:     dbRecord.region,
      country:    dbRecord.country,
      status:     dbRecord.status,
      created_at: dbRecord.created_at,
    },
  });
});

export default router;
