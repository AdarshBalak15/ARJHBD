// ─────────────────────────────────────────────────────────────────────────────
// api/utils/deviceParser.js — User-Agent Parser
//
// Parses browser, OS, version, and device type from User-Agent strings.
// No external dependencies — pure regex-based parsing.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} DeviceInfo
 * @property {string} browser
 * @property {string} browser_version
 * @property {string} os
 * @property {string} os_version
 * @property {string} device_type — 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
 */

/**
 * Extract version string from a regex match.
 * @param {string} ua
 * @param {RegExp} regex — must have a capture group for version
 * @returns {string}
 */
function extractVersion(ua, regex) {
  const match = ua.match(regex);
  return match?.[1]?.replace(/_/g, '.') || 'unknown';
}

/**
 * Parse User-Agent into structured device information.
 * @param {string} ua
 * @returns {DeviceInfo}
 */
export function parseDevice(ua) {
  const defaults = {
    browser: 'unknown',
    browser_version: 'unknown',
    os: 'unknown',
    os_version: 'unknown',
    device_type: 'unknown',
  };

  if (!ua || typeof ua !== 'string') return defaults;

  // ── Browser detection (order matters — most specific first) ──
  let browser = 'unknown';
  let browser_version = 'unknown';

  if (/Edg\//i.test(ua)) {
    browser = 'Edge';
    browser_version = extractVersion(ua, /Edg\/(\S+)/i);
  } else if (/OPR\//i.test(ua)) {
    browser = 'Opera';
    browser_version = extractVersion(ua, /OPR\/(\S+)/i);
  } else if (/Vivaldi/i.test(ua)) {
    browser = 'Vivaldi';
    browser_version = extractVersion(ua, /Vivaldi\/(\S+)/i);
  } else if (/Brave/i.test(ua)) {
    browser = 'Brave';
    browser_version = extractVersion(ua, /Brave\/(\S+)/i);
  } else if (/SamsungBrowser/i.test(ua)) {
    browser = 'Samsung Internet';
    browser_version = extractVersion(ua, /SamsungBrowser\/(\S+)/i);
  } else if (/UCBrowser|UCWEB/i.test(ua)) {
    browser = 'UC Browser';
    browser_version = extractVersion(ua, /UCBrowser\/(\S+)/i);
  } else if (/Firefox/i.test(ua)) {
    browser = 'Firefox';
    browser_version = extractVersion(ua, /Firefox\/(\S+)/i);
  } else if (/FxiOS/i.test(ua)) {
    browser = 'Firefox (iOS)';
    browser_version = extractVersion(ua, /FxiOS\/(\S+)/i);
  } else if (/CriOS/i.test(ua)) {
    browser = 'Chrome (iOS)';
    browser_version = extractVersion(ua, /CriOS\/(\S+)/i);
  } else if (/Chrome/i.test(ua)) {
    browser = 'Chrome';
    browser_version = extractVersion(ua, /Chrome\/(\S+)/i);
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
    browser_version = extractVersion(ua, /Version\/(\S+)/i);
  } else if (/MSIE|Trident/i.test(ua)) {
    browser = 'Internet Explorer';
    browser_version = extractVersion(ua, /(?:MSIE |rv:)(\S+)/i);
  }

  // ── OS detection ──
  let os = 'unknown';
  let os_version = 'unknown';

  if (/Windows NT/i.test(ua)) {
    os = 'Windows';
    const verMap = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.1': 'XP' };
    const ntVer = ua.match(/Windows NT (\d+\.\d+)/i)?.[1];
    os_version = verMap[ntVer] || ntVer || 'unknown';
  } else if (/Mac OS X|macOS/i.test(ua)) {
    os = 'macOS';
    os_version = extractVersion(ua, /Mac OS X (\d+[._]\d+[._]?\d*)/i);
  } else if (/CrOS/i.test(ua)) {
    os = 'Chrome OS';
    os_version = extractVersion(ua, /CrOS \S+ (\S+)/i);
  } else if (/Android/i.test(ua)) {
    os = 'Android';
    os_version = extractVersion(ua, /Android (\d+[\.\d]*)/i);
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS';
    os_version = extractVersion(ua, /OS (\d+[._]\d+[._]?\d*)/i);
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
    os_version = 'unknown';
  }

  // ── Device type ──
  let device_type = 'desktop';
  if (/bot|crawl|spider|slurp|mediapartners|facebookexternalhit|bingpreview/i.test(ua)) {
    device_type = 'bot';
  } else if (/iPad|tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    device_type = 'tablet';
  } else if (/Mobile|iPhone|iPod|Opera Mini|IEMobile|wpdesktop/i.test(ua)) {
    device_type = 'mobile';
  }

  return { browser, browser_version, os, os_version, device_type };
}

export default parseDevice;
