// ─────────────────────────────────────────────────────────────────────────────
// api/utils/extractIp.js — Production-Grade IP Extraction
//
// Reliably extracts the real client IP from any deployment environment:
//   • Vercel (x-forwarded-for, x-real-ip, x-vercel-forwarded-for)
//   • Netlify (x-nf-client-connection-ip)
//   • Cloudflare (cf-connecting-ip)
//   • Reverse proxies (x-forwarded-for chain)
//   • Direct connections (remoteAddress)
//
// Returns structured result with diagnostics for debugging.
// ─────────────────────────────────────────────────────────────────────────────

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fd/i,
  /^fe80:/i,
  /^::1$/,
  /^::ffff:127\./,
  /^0\.0\.0\.0$/,
];

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const IPV6_REGEX = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;

/**
 * Validate and classify an IP address.
 * @param {string} ip
 * @returns {{ valid: boolean, version: string, isPrivate: boolean }}
 */
export function validateIp(ip) {
  if (!ip || typeof ip !== 'string') return { valid: false, version: 'none', isPrivate: false };

  const trimmed = ip.trim();
  const isV4 = IPV4_REGEX.test(trimmed);
  const isV6 = IPV6_REGEX.test(trimmed) || trimmed === '::1';
  const valid = isV4 || isV6;
  const version = isV4 ? 'ipv4' : isV6 ? 'ipv6' : 'unknown';
  const isPrivate = PRIVATE_IP_RANGES.some(r => r.test(trimmed));

  return { valid, version, isPrivate };
}

/**
 * Clean and normalize an IP string.
 * Strips ::ffff: prefix, trims whitespace.
 * @param {string} raw
 * @returns {string}
 */
function normalizeIp(raw) {
  if (!raw) return '';
  let ip = raw.trim();
  // Strip IPv4-mapped IPv6 prefix
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  // Strip port from IPv4:port
  if (ip.includes(':') && IPV4_REGEX.test(ip.split(':')[0])) {
    ip = ip.split(':')[0];
  }
  return ip;
}

/**
 * Detect the hosting platform from request headers.
 * @param {object} headers — lowercased header object
 * @returns {string} 'vercel' | 'netlify' | 'cloudflare' | 'unknown'
 */
export function detectPlatform(headers) {
  if (!headers) return 'unknown';
  if (headers['x-vercel-id'] || headers['x-vercel-forwarded-for']) return 'vercel';
  if (headers['x-nf-client-connection-ip'] || headers['x-nf-request-id']) return 'netlify';
  if (headers['cf-connecting-ip'] || headers['cf-ray']) return 'cloudflare';
  return 'unknown';
}

/**
 * Extract the real client IP from request headers.
 *
 * Priority order (most reliable → least reliable):
 *   1. cf-connecting-ip (Cloudflare — single, always correct)
 *   2. x-nf-client-connection-ip (Netlify — single, always correct)
 *   3. x-vercel-forwarded-for (Vercel — client IP, reliable)
 *   4. x-real-ip (nginx/load balancers — single IP)
 *   5. x-forwarded-for (standard — first IP is client, rest are proxies)
 *   6. x-client-ip (Azure, some load balancers)
 *   7. req.socket.remoteAddress (direct connection fallback)
 *
 * @param {object} headers — lowercased request headers
 * @param {object} [req] — optional request object for socket fallback
 * @returns {{ ip: string, source: string, version: string, isPrivate: boolean, raw: object }}
 */
export function extractIp(headers, req) {
  const rawHeaders = {};
  const candidates = [];

  // Ordered extraction sources — platform-specific first, then generic
  const sources = [
    { name: 'cf-connecting-ip', header: 'cf-connecting-ip', multi: false },
    { name: 'x-nf-client-connection-ip', header: 'x-nf-client-connection-ip', multi: false },
    { name: 'x-vercel-forwarded-for', header: 'x-vercel-forwarded-for', multi: true },
    { name: 'x-real-ip', header: 'x-real-ip', multi: false },
    { name: 'x-forwarded-for', header: 'x-forwarded-for', multi: true },
    { name: 'x-client-ip', header: 'x-client-ip', multi: false },
    { name: 'true-client-ip', header: 'true-client-ip', multi: false },
  ];

  for (const src of sources) {
    const raw = headers?.[src.header];
    if (!raw) continue;

    rawHeaders[src.name] = raw;

    // For multi-IP headers (x-forwarded-for), take the first (client) IP
    const ips = src.multi ? raw.split(',').map(s => normalizeIp(s)) : [normalizeIp(raw)];

    for (const ip of ips) {
      const info = validateIp(ip);
      if (info.valid && !info.isPrivate) {
        candidates.push({ ip, source: src.name, ...info });
      }
    }
  }

  // Socket fallback
  if (req?.socket?.remoteAddress) {
    const ip = normalizeIp(req.socket.remoteAddress);
    rawHeaders['socket.remoteAddress'] = req.socket.remoteAddress;
    const info = validateIp(ip);
    if (info.valid && !info.isPrivate) {
      candidates.push({ ip, source: 'socket', ...info });
    }
  }

  // Also check req.ip (Express sets this)
  if (req?.ip) {
    const ip = normalizeIp(req.ip);
    rawHeaders['req.ip'] = req.ip;
    const info = validateIp(ip);
    if (info.valid && !info.isPrivate) {
      candidates.push({ ip, source: 'req.ip', ...info });
    }
  }

  // Pick the best candidate (first in priority order, which is how we built the list)
  const best = candidates[0] || null;

  const result = {
    ip: best?.ip || '',
    source: best?.source || 'none',
    version: best?.version || 'none',
    isPrivate: best?.isPrivate || false,
    raw: rawHeaders,
    candidateCount: candidates.length,
  };

  console.log('[IP] Extracted:', JSON.stringify({
    ip: result.ip || '(empty)',
    source: result.source,
    version: result.version,
    candidates: candidates.length,
    headers: Object.keys(rawHeaders),
  }));

  return result;
}

export default extractIp;
