import { Router } from 'express';
import supabase from '../config/db.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Simple session guard — tracks IPs that already logged in this server session.
// Prevents duplicate rows if the button is double-clicked.
// Resets on server restart (in-memory only — no Redis needed for this scale).
// ─────────────────────────────────────────────────────────────────────────────
const loggedSessions = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// GET REAL CLIENT IP
// Works behind Vite proxy, nginx, CDN, cloud (trust proxy must be set on app)
// ─────────────────────────────────────────────────────────────────────────────
function resolveClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim(); // First IP in chain = real client
  }
  return req.socket?.remoteAddress || 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH GEOLOCATION SERVER-SIDE (never exposed to frontend)
// Uses ipapi.co free tier — no API key needed
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGeoData(ip) {
  const defaults = {
    city: 'unknown', region: 'unknown', country_name: 'unknown',
    latitude: null,  longitude: null,   timezone: 'unknown',
  };

  try {
    // For localhost/private IPs use the caller's own public IP
    const lookupIP = (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127'))
      ? '' // blank = ipapi.co uses the caller's public IP automatically
      : ip;

    const res = await fetch(`https://ipapi.co/${lookupIP}json/`, {
      signal: AbortSignal.timeout(3000), // 3 s hard timeout — never stall
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) return defaults;
    const data = await res.json();
    return {
      city:         data.city         || 'unknown',
      region:       data.region       || 'unknown',
      country_name: data.country_name || 'unknown',
      latitude:     data.latitude     ?? null,
      longitude:    data.longitude    ?? null,
      timezone:     data.timezone     || 'unknown',
    };
  } catch {
    return defaults; // Geo failure is non-fatal
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/unlock
// Triggered ONLY when Unlock button is clicked after successful authentication.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // ✅ Always respond immediately — UI must never be blocked
  res.status(200).json({ message: 'Unlock successful' });

  // ── Run logging asynchronously AFTER responding ───────────────────────────
  try {
    const ip       = resolveClientIP(req);
    const userId   = req.body?.userId || 'guest';
    const deviceInfo = req.headers['user-agent'] || 'unknown';

    // Session-level deduplication (same IP + same userId = skip)
    const sessionKey = `${ip}::${userId}`;
    if (loggedSessions.has(sessionKey)) {
      console.log(`[LOG] ⏭ Skipped duplicate unlock log for ${sessionKey}`);
      return;
    }
    loggedSessions.add(sessionKey);

    // Fetch geo from ipapi.co (server-side — never touches frontend)
    const geo = await fetchGeoData(ip);

    // Insert using Supabase — SQL injection safe by design
    const { data: row, error } = await supabase
      .from('login_activity')
      .insert([{
        user_id:    userId,
        ip_address: ip,
        city:       geo.city,
        region:     geo.region,
        country:    geo.country_name,
        latitude:   geo.latitude,
        longitude:  geo.longitude,
        timezone:   geo.timezone,
        device_info: deviceInfo,
      }])
      .select('id, created_at')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    console.log(
      `[LOG] ✅ Unlock activity recorded — id:${row.id} | ip:${ip} | ` +
      `${geo.city}, ${geo.region}, ${geo.country_name} | user:${userId}`
    );
  } catch (err) {
    // Errors are backend-only — UI already got its 200 OK
    console.error('[LOG] ❌ DB insert failed:', err.message);
  }
});

export default router;
