// ─────────────────────────────────────────────────────────────────────────────
// utils/uaParser.js — User-Agent String Parser
//
// Lightweight, zero-dependency user-agent parser that extracts:
//   • Browser name + version
//   • Operating system + version
//   • Device type (desktop / mobile / tablet / bot)
//
// No external packages needed — regex-based extraction covers 95%+ of traffic.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a User-Agent string into structured device metadata.
 *
 * @param {string} uaString — raw User-Agent header value
 * @returns {{
 *   raw:          string,
 *   browser:      string,
 *   browserVersion: string,
 *   os:           string,
 *   osVersion:    string,
 *   deviceType:   'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown',
 * }}
 */
export function parseUserAgent(uaString) {
  const ua = uaString || 'unknown';

  return {
    raw:            ua,
    browser:        detectBrowser(ua),
    browserVersion: detectBrowserVersion(ua),
    os:             detectOS(ua),
    osVersion:      detectOSVersion(ua),
    deviceType:     detectDeviceType(ua),
  };
}

// ── Browser Detection ────────────────────────────────────────────────────────
// Order matters: more specific tokens first (Edge before Chrome, etc.)

function detectBrowser(ua) {
  if (/Edg\//i.test(ua))         return 'Microsoft Edge';
  if (/OPR\//i.test(ua))         return 'Opera';
  if (/Brave/i.test(ua))         return 'Brave';
  if (/Vivaldi/i.test(ua))       return 'Vivaldi';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/UCBrowser/i.test(ua))     return 'UC Browser';
  if (/YaBrowser/i.test(ua))     return 'Yandex Browser';
  if (/Firefox/i.test(ua))       return 'Firefox';
  if (/CriOS/i.test(ua))        return 'Chrome (iOS)';
  if (/Chrome/i.test(ua))       return 'Chrome';
  if (/Safari/i.test(ua))       return 'Safari';
  if (/MSIE|Trident/i.test(ua)) return 'Internet Explorer';
  return 'unknown';
}

function detectBrowserVersion(ua) {
  // Match browser token followed by /version or space+version
  const patterns = [
    /Edg\/(\d+[\d.]*)/i,
    /OPR\/(\d+[\d.]*)/i,
    /Vivaldi\/(\d+[\d.]*)/i,
    /SamsungBrowser\/(\d+[\d.]*)/i,
    /UCBrowser\/(\d+[\d.]*)/i,
    /YaBrowser\/(\d+[\d.]*)/i,
    /Firefox\/(\d+[\d.]*)/i,
    /CriOS\/(\d+[\d.]*)/i,
    /Chrome\/(\d+[\d.]*)/i,
    /Version\/(\d+[\d.]*)/i,  // Safari uses "Version/x.y"
    /MSIE (\d+[\d.]*)/i,
    /rv:(\d+[\d.]*)/i,        // IE 11
  ];

  for (const pattern of patterns) {
    const match = ua.match(pattern);
    if (match) return match[1];
  }

  return 'unknown';
}

// ── OS Detection ─────────────────────────────────────────────────────────────

function detectOS(ua) {
  if (/Windows/i.test(ua))                       return 'Windows';
  if (/Mac OS X|macOS/i.test(ua))                return 'macOS';
  if (/CrOS/i.test(ua))                          return 'Chrome OS';
  if (/Android/i.test(ua))                        return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua))               return 'iOS';
  if (/Linux/i.test(ua))                          return 'Linux';
  if (/Ubuntu/i.test(ua))                         return 'Ubuntu';
  if (/Fedora/i.test(ua))                         return 'Fedora';
  return 'unknown';
}

function detectOSVersion(ua) {
  const patterns = [
    /Windows NT (\d+[\d.]*)/i,
    /Mac OS X (\d+[_.\d]*)/i,
    /Android (\d+[\d.]*)/i,
    /iPhone OS (\d+[_.\d]*)/i,
    /iPad.*?OS (\d+[_.\d]*)/i,
    /CrOS \w+ (\d+[\d.]*)/i,
  ];

  for (const pattern of patterns) {
    const match = ua.match(pattern);
    if (match) return match[1].replace(/_/g, '.'); // iOS uses _ instead of .
  }

  return 'unknown';
}

// ── Device Type Detection ────────────────────────────────────────────────────

function detectDeviceType(ua) {
  // Bot detection first
  if (/bot|crawl|spider|slurp|mediapartners/i.test(ua)) return 'bot';

  // Tablet detection (check before mobile — tablets also match some mobile tokens)
  if (/iPad|tablet|playbook|silk/i.test(ua)) return 'tablet';
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet'; // Android without "Mobile" = tablet

  // Mobile detection
  if (/Mobile|iPhone|iPod|IEMobile|Opera Mini|BB10|webOS/i.test(ua)) return 'mobile';

  // Fallback — everything else is desktop
  return 'desktop';
}
