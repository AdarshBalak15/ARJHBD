// ─────────────────────────────────────────────────────────────────────────────
// utils/ipUtils.js — IP Address Extraction & Classification Utilities
//
// Responsibilities:
//   1. Extract the real client IP from request headers (proxy-aware)
//   2. Detect localhost / loopback addresses
//   3. Detect private (RFC 1918) IP ranges
//   4. Detect likely VPN/proxy connections (heuristic)
//   5. Normalize IPv6-mapped IPv4 addresses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes IPv6-mapped IPv4 addresses back to plain IPv4.
 * e.g. "::ffff:192.168.1.1" → "192.168.1.1"
 *
 * @param {string} ip — raw IP string
 * @returns {string} — cleaned IP
 */
export function normalizeIP(ip) {
  if (!ip || typeof ip !== 'string') return 'unknown';

  let cleaned = ip.trim();

  // Strip IPv6-mapped IPv4 prefix
  if (cleaned.startsWith('::ffff:')) {
    cleaned = cleaned.slice(7);
  }

  return cleaned || 'unknown';
}

/**
 * Extracts the real client IP address from an incoming HTTP request.
 *
 * Priority order:
 *   1. x-forwarded-for (first IP in comma-separated list = original client)
 *   2. x-real-ip (Nginx convention)
 *   3. cf-connecting-ip (Cloudflare)
 *   4. x-client-ip (some CDNs)
 *   5. req.ip (Express built-in, respects 'trust proxy')
 *   6. req.socket.remoteAddress (raw TCP socket — last resort)
 *
 * @param {import('express').Request} req
 * @returns {string} — best-guess client IP
 */
export function extractClientIP(req) {
  // x-forwarded-for: "client, proxy1, proxy2" — first entry is the real client
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0];
    return normalizeIP(first);
  }

  // Nginx: x-real-ip
  const realIp = req.headers['x-real-ip'];
  if (realIp) return normalizeIP(realIp);

  // Cloudflare: cf-connecting-ip
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return normalizeIP(cfIp);

  // Generic CDN: x-client-ip
  const clientIp = req.headers['x-client-ip'];
  if (clientIp) return normalizeIP(clientIp);

  // Express built-in (uses 'trust proxy' setting)
  if (req.ip) return normalizeIP(req.ip);

  // Raw socket — last resort
  return normalizeIP(req.socket?.remoteAddress) || 'unknown';
}

/**
 * Returns true if the IP is a loopback / localhost address.
 *
 * @param {string} ip — normalized IP
 * @returns {boolean}
 */
export function isLocalhost(ip) {
  if (!ip) return false;
  const normalized = normalizeIP(ip);
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === 'localhost' ||
    normalized.startsWith('::ffff:127.')
  );
}

/**
 * Returns true if the IP belongs to a private (RFC 1918) range.
 * These IPs never appear on the public internet.
 *
 *   10.0.0.0/8       — Class A private
 *   172.16.0.0/12    — Class B private
 *   192.168.0.0/16   — Class C private
 *   169.254.0.0/16   — Link-local (APIPA)
 *   fc00::/7          — IPv6 unique local
 *
 * @param {string} ip — normalized IP
 * @returns {boolean}
 */
export function isPrivateIP(ip) {
  if (!ip) return false;
  const normalized = normalizeIP(ip);

  // IPv4 private ranges
  if (normalized.startsWith('10.')) return true;
  if (normalized.startsWith('192.168.')) return true;
  if (normalized.startsWith('169.254.')) return true;

  // 172.16.0.0 – 172.31.255.255
  if (normalized.startsWith('172.')) {
    const secondOctet = parseInt(normalized.split('.')[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  // IPv6 unique local (fc00::/7)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  return false;
}

/**
 * Heuristic check for VPN/proxy indicators in request headers.
 * Not definitive — just a flag for the response payload.
 *
 * @param {import('express').Request} req
 * @returns {{ isLikelyProxy: boolean, indicators: string[] }}
 */
export function detectProxyIndicators(req) {
  const indicators = [];

  // Multiple IPs in x-forwarded-for = at least one proxy in chain
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && forwarded.includes(',')) {
    indicators.push('Multiple IPs in x-forwarded-for (proxy chain detected)');
  }

  // Via header is set by proxies
  if (req.headers['via']) {
    indicators.push(`Via header present: ${req.headers['via']}`);
  }

  // X-Proxy-ID or similar headers
  if (req.headers['x-proxy-id']) {
    indicators.push('X-Proxy-ID header present');
  }

  // Forwarded (RFC 7239 standard)
  if (req.headers['forwarded']) {
    indicators.push('Forwarded (RFC 7239) header present');
  }

  return {
    isLikelyProxy: indicators.length > 0,
    indicators,
  };
}

/**
 * Classifies an IP address into a human-readable type.
 *
 * @param {string} ip
 * @returns {'localhost' | 'private' | 'public'}
 */
export function classifyIP(ip) {
  if (isLocalhost(ip)) return 'localhost';
  if (isPrivateIP(ip)) return 'private';
  return 'public';
}
