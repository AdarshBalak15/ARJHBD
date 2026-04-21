// ─────────────────────────────────────────────────────────────────────────────
// routes/trackUser.js — /track-user API Endpoint
//
// POST /api/track-user
//   Body (optional): { user_id: "some-user-id" }
//
// This route is the public-facing entry point for the tracking system.
// It delegates ALL logic to the trackingService orchestrator.
//
// Response: Structured JSON with all collected metadata.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { trackUser } from '../services/trackingService.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/track-user
//
// Accepts an optional user_id in the request body.
// Everything else (IP, geo, device) is extracted server-side from the request.
//
// Returns:
//   200 — always (even on partial failure — see success flag)
//   {
//     success:     boolean,
//     db_inserted: boolean,
//     data: {
//       id, user_id, ip_address, ip_type, is_proxy, proxy_indicators,
//       geo: { city, region, country, latitude, longitude, timezone, isp, org, source },
//       device: { raw, browser, browser_version, os, os_version, device_type },
//       status, timestamp
//     },
//     timestamp: ISO string
//   }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    // Extract optional user_id from body (defaults to 'anonymous')
    const userId = req.body?.user_id || 'anonymous';

    // Delegate all work to the tracking service
    const result = await trackUser(req, userId);

    // Always return 200 — the `success` flag tells the client what happened
    return res.status(200).json(result);
  } catch (err) {
    // This should never happen (trackUser catches everything), but just in case
    console.error('[TRACK-USER] ❌ Unhandled route error:', err.message);
    return res.status(200).json({
      success:     false,
      db_inserted: false,
      data:        null,
      timestamp:   new Date().toISOString(),
      error:       'Internal server error',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/track-user
//
// Convenience endpoint — same tracking, no body needed.
// Useful for simple browser visits, health-check bots, etc.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await trackUser(req, 'anonymous');
    return res.status(200).json(result);
  } catch (err) {
    console.error('[TRACK-USER] ❌ Unhandled GET error:', err.message);
    return res.status(200).json({
      success:     false,
      db_inserted: false,
      data:        null,
      timestamp:   new Date().toISOString(),
      error:       'Internal server error',
    });
  }
});

export default router;
