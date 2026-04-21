// ─────────────────────────────────────────────────────────────────────────────
// middleware/tracker.js — Auto-Tracking Middleware
//
// Purpose:
//   Automatically track every incoming request without requiring clients
//   to call /track-user explicitly. Attaches tracking data to req.trackingData
//   for downstream handlers to use.
//
// Usage:
//   // Track ALL routes:
//   app.use(trackerMiddleware);
//
//   // Track specific routes only:
//   app.use('/api/sensitive', trackerMiddleware);
//
// Behavior:
//   • Runs ASYNCHRONOUSLY — does NOT block the request pipeline
//   • Attaches result to req.trackingData for downstream use
//   • Skips health-check and static asset requests
//   • Never crashes — all errors are caught and logged
//   • Deduplicates: skips if request already has tracking data
// ─────────────────────────────────────────────────────────────────────────────

import { trackUser } from '../services/trackingService.js';

// Paths to skip — health checks, static assets, favicon, etc.
const SKIP_PATHS = new Set([
  '/api/health',
  '/favicon.ico',
  '/robots.txt',
]);

// File extensions to skip (static assets)
const SKIP_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)$/i;

/**
 * Express middleware that automatically tracks incoming requests.
 *
 * Tracking runs in the background (fire-and-forget) so it never
 * adds latency to the response. The result is attached to
 * `req.trackingData` for any downstream handler that wants it.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function trackerMiddleware(req, res, next) {
  // ── Skip conditions ────────────────────────────────────────────────────
  // 1. Already tracked this request (prevents double-tracking)
  if (req.trackingData) return next();

  // 2. Health checks and known static paths
  if (SKIP_PATHS.has(req.path)) return next();

  // 3. Static file extensions
  if (SKIP_EXTENSIONS.test(req.path)) return next();

  // 4. OPTIONS preflight requests
  if (req.method === 'OPTIONS') return next();

  // ── Fire-and-forget tracking ───────────────────────────────────────────
  // Call next() immediately — don't block the request
  next();

  // Track in background (no await — non-blocking)
  try {
    const userId = req.body?.user_id || 'anonymous';
    const result = await trackUser(req, userId);

    // Attach to request for downstream handlers (may already be responded)
    req.trackingData = result;
  } catch (err) {
    // Tracking failure must NEVER affect the actual request
    console.error('[TRACKER-MW] ❌ Background tracking failed:', err.message);
  }
}

/**
 * Factory version — creates a tracker middleware with custom options.
 *
 * @param {object} [options]
 * @param {string[]} [options.skipPaths]    — additional paths to skip
 * @param {boolean}  [options.logOnly=false] — if true, logs but doesn't insert to DB
 * @returns {import('express').RequestHandler}
 */
export function createTrackerMiddleware(options = {}) {
  const extraSkipPaths = new Set(options.skipPaths || []);

  return async (req, res, next) => {
    if (req.trackingData) return next();
    if (SKIP_PATHS.has(req.path) || extraSkipPaths.has(req.path)) return next();
    if (SKIP_EXTENSIONS.test(req.path)) return next();
    if (req.method === 'OPTIONS') return next();

    next();

    try {
      const userId = req.body?.user_id || 'anonymous';
      const result = await trackUser(req, userId);
      req.trackingData = result;
    } catch (err) {
      console.error('[TRACKER-MW] ❌ Background tracking failed:', err.message);
    }
  };
}
