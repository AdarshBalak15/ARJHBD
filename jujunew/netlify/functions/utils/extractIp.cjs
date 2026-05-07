// ─────────────────────────────────────────────────────────────────────────────
// netlify/functions/utils/extractIp.cjs — Production-Grade IP Extraction (CJS)
//
// CommonJS mirror of api/utils/extractIp.js for Netlify Functions.
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

function validateIp(ip) {
  if (!ip || typeof ip !== "string") return { valid: false, version: "none", isPrivate: false };
  const trimmed = ip.trim();
  const isV4 = IPV4_REGEX.test(trimmed);
  const isV6 = IPV6_REGEX.test(trimmed) || trimmed === "::1";
  const valid = isV4 || isV6;
  const version = isV4 ? "ipv4" : isV6 ? "ipv6" : "unknown";
  const isPrivate = PRIVATE_IP_RANGES.some(function (r) { return r.test(trimmed); });
  return { valid: valid, version: version, isPrivate: isPrivate };
}

function normalizeIp(raw) {
  if (!raw) return "";
  var ip = raw.trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip.includes(":") && IPV4_REGEX.test(ip.split(":")[0])) {
    ip = ip.split(":")[0];
  }
  return ip;
}

function detectPlatform(headers) {
  if (!headers) return "unknown";
  if (headers["x-vercel-id"] || headers["x-vercel-forwarded-for"]) return "vercel";
  if (headers["x-nf-client-connection-ip"] || headers["x-nf-request-id"]) return "netlify";
  if (headers["cf-connecting-ip"] || headers["cf-ray"]) return "cloudflare";
  return "unknown";
}

function extractIp(headers) {
  var rawHeaders = {};
  var candidates = [];

  var sources = [
    { name: "cf-connecting-ip", header: "cf-connecting-ip", multi: false },
    { name: "x-nf-client-connection-ip", header: "x-nf-client-connection-ip", multi: false },
    { name: "x-vercel-forwarded-for", header: "x-vercel-forwarded-for", multi: true },
    { name: "x-real-ip", header: "x-real-ip", multi: false },
    { name: "x-forwarded-for", header: "x-forwarded-for", multi: true },
    { name: "x-client-ip", header: "x-client-ip", multi: false },
    { name: "true-client-ip", header: "true-client-ip", multi: false },
  ];

  for (var i = 0; i < sources.length; i++) {
    var src = sources[i];
    var raw = headers && headers[src.header];
    if (!raw) continue;

    rawHeaders[src.name] = raw;
    var ips = src.multi ? raw.split(",").map(function (s) { return normalizeIp(s); }) : [normalizeIp(raw)];

    for (var j = 0; j < ips.length; j++) {
      var info = validateIp(ips[j]);
      if (info.valid && !info.isPrivate) {
        candidates.push({ ip: ips[j], source: src.name, valid: info.valid, version: info.version, isPrivate: info.isPrivate });
      }
    }
  }

  var best = candidates[0] || null;

  var result = {
    ip: best ? best.ip : "",
    source: best ? best.source : "none",
    version: best ? best.version : "none",
    isPrivate: best ? best.isPrivate : false,
    raw: rawHeaders,
    candidateCount: candidates.length,
  };

  console.log("[IP] Extracted:", JSON.stringify({
    ip: result.ip || "(empty)",
    source: result.source,
    version: result.version,
    candidates: candidates.length,
    headers: Object.keys(rawHeaders),
  }));

  return result;
}

module.exports = { extractIp: extractIp, detectPlatform: detectPlatform, validateIp: validateIp };
