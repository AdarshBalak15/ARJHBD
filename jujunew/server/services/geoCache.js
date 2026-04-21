// ─────────────────────────────────────────────────────────────────────────────
// services/geoCache.js — In-Memory Geo-Lookup Cache (LRU-style with TTL)
//
// Purpose:
//   Avoid redundant API calls to ipapi.co / ipinfo.io for the same IP address
//   within a configurable time window. This dramatically reduces API usage
//   and speeds up repeated requests.
//
// Design:
//   • Map<ip, { data, expiresAt }> with TTL-based expiry
//   • Max capacity with LRU eviction (oldest entry removed when full)
//   • Thread-safe for single-process Node (no locks needed)
//   • Automatic cleanup of stale entries via periodic sweep
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS   = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_SIZE = 500;             // Max cached IPs
const CLEANUP_INTERVAL = 5 * 60 * 1000;  // Sweep every 5 minutes

class GeoCache {
  /**
   * @param {object} [options]
   * @param {number} [options.ttlMs=600000]    — cache entry lifetime in ms
   * @param {number} [options.maxSize=500]     — max entries before eviction
   */
  constructor(options = {}) {
    this.ttlMs   = options.ttlMs   || DEFAULT_TTL_MS;
    this.maxSize = options.maxSize || DEFAULT_MAX_SIZE;

    /** @type {Map<string, { data: object, expiresAt: number }>} */
    this.cache = new Map();

    // Periodic stale-entry cleanup (unrefs so it doesn't prevent process exit)
    this._cleanupTimer = setInterval(() => this._sweep(), CLEANUP_INTERVAL);
    if (this._cleanupTimer.unref) this._cleanupTimer.unref();
  }

  /**
   * Retrieve cached geo data for an IP if still valid.
   *
   * @param {string} ip
   * @returns {object | null} — cached geo data, or null if miss/expired
   */
  get(ip) {
    const entry = this.cache.get(ip);
    if (!entry) return null;

    // Expired → remove and return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(ip);
      return null;
    }

    return entry.data;
  }

  /**
   * Store geo data for an IP with TTL.
   *
   * @param {string} ip
   * @param {object} data — geo data to cache
   */
  set(ip, data) {
    // Evict oldest entry if at capacity (Map preserves insertion order)
    if (this.cache.size >= this.maxSize && !this.cache.has(ip)) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    // Re-insert to move to end (most recently used)
    this.cache.delete(ip);
    this.cache.set(ip, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Check if a valid (non-expired) entry exists.
   *
   * @param {string} ip
   * @returns {boolean}
   */
  has(ip) {
    return this.get(ip) !== null;
  }

  /**
   * Remove all entries.
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Current number of valid entries.
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Remove all expired entries.
   * Called automatically on interval.
   */
  _sweep() {
    const now = Date.now();
    let swept = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        swept++;
      }
    }

    if (swept > 0) {
      console.log(`[GEO-CACHE] 🧹 Swept ${swept} expired entries (${this.cache.size} remain)`);
    }
  }

  /**
   * Destroy the cache and stop the cleanup timer.
   * Call on graceful shutdown.
   */
  destroy() {
    clearInterval(this._cleanupTimer);
    this.cache.clear();
  }
}

// Export a singleton instance — shared across all services
const geoCache = new GeoCache();
export default geoCache;
