import { Router } from 'express';
import { logLoginAttempt } from '../services/loginLogger.js';
import { sendAlertEmail } from '../services/mailService.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH — the only place the password is defined
// ─────────────────────────────────────────────────────────────────────────────
const CORRECT_PASSWORD = 'Arju!0405';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const {
    password,
    user_id = 'arju',
    ip_address = 'unknown',
    city,
    region,
    country,
    latitude,
    longitude,
    timezone,
  } = req.body;

  // STEP 1: Capture request data
  const device_info = req.headers['user-agent'] || 'unknown';

  const logData = {
    user_id,
    ip_address,
    city,
    region,
    country,
    latitude,
    longitude,
    timezone,
    device_info,
  };

  // STEP 2: Compare password against single source of truth
  if (password !== CORRECT_PASSWORD) {
    // IF password is WRONG:
    logData.status = 'FAILED';

    // Log the FAILED attempt BEFORE returning error
    await logLoginAttempt(logData);

    // Email alert for FAILED attempts
    await sendAlertEmail({ ...logData, created_at: new Date().toISOString(), status: 'FAILED' }).catch(() => {});

    return res.status(401).json({ success: false, message: 'Invalid password' });
  }

  // IF password is CORRECT:
  logData.status = 'SUCCESS';

  // Log the SUCCESS attempt BEFORE sending response
  await logLoginAttempt(logData);

  // Send normal alert for success
  await sendAlertEmail({ ...logData, created_at: new Date().toISOString(), status: 'SUCCESS' }).catch(() => {});

  // Continue login
  return res.status(200).json({
    success: true,
    message: 'Login successful',
  });
});

export default router;
