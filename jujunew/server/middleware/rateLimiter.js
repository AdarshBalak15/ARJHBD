// ─────────────────────────────────────────────────────────────────────────────
// middleware/rateLimiter.js — Sliding Window Rate Limiter
//
// Purpose:
//   Protect external API usage (ipapi.co, ipinfo.io) and prevent abuse
//   of the /track-user endpoint by limiting requests per IP.
//
// Design:
//   • In-memory sliding window counter per IP
//   • Configurable: window size (ms) and max requests per window
//   • Automatic cleanup of expired windows
//   • Returns 429 Too Many Requests when limit exceeded
//   • Non-blocking — does not affect other routes
// ─────────────────────────────────────────────────────────────────────────────

import { extractClientIP } from '../utils/ipUtils.js';

/**
 * Creates a rate-limiting middleware.
 *
 * @param {object} [options]
 * @param {number} [options.windowMs=60000]   — time window in milliseconds (default: 1 min)
 * @param {number} [options.maxRequests=30]   — max requests per window per IP (default: 30)
 * @param {string} [options.message]          — custom error message
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter(options = {}) {
  const windowMs   = options.windowMs   || 60 * 1000; // 1 minute default
  const maxRequests = options.maxRequests || 30;
  const message    = options.message    || 'Too many requests. Please try again later.';

  /**
   * Map<ip, { count: number, windowStart: number }>
   * @type {Map<string, { count: number, windowStart: number }>}
   */
  const clients = new Map();

  // Periodic cleanup of expired windows (every 2 minutes)
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [ip, record] of clients) {
      if (now - record.windowStart > windowMs) {
        clients.delete(ip);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[RATE-LIMIT] 🧹 Cleaned ${cleaned} expired rate-limit records`);
    }
  }, 2 * 60 * 1000);

  // Don't prevent process exit
  if (cleanupTimer.unref) cleanupTimer.unref();

  // The actual middleware
  return (req, res, next) => {
    const ip  = extractClientIP(req);
    const now = Date.now();

    let record = clients.get(ip);

    // New client or expired window — start fresh
    if (!record || (now - record.windowStart > windowMs)) {
      record = { count: 1, windowStart: now };
      clients.set(ip, record);
      return next();
    }

    // Within window — increment counter
    record.count++;

    if (record.count > maxRequests) {
      const retryAfterSec = Math.ceil((record.windowStart + windowMs - now) / 1000);

      console.warn(
        `[RATE-LIMIT] 🚫 IP ${ip} exceeded ${maxRequests} requests in ` +
        `${windowMs / 1000}s window (count: ${record.count})`
      );

      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        error:   'rate_limit_exceeded',
        message,
        retry_after_seconds: retryAfterSec,
      });
    }

    next();
  };
}

// Export a pre-configured instance for the /track-user route
// 30 requests per minute per IP — generous for normal use, blocks abuse
export const trackUserRateLimiter = createRateLimiter({
  windowMs:   60 * 1000,  // 1 minute
  maxRequests: 30,
  message:    'Tracking rate limit exceeded. Please wait before retrying.',
});
