// ─────────────────────────────────────────────────────────────────────────────
// netlify/functions/utils/deviceParser.cjs — User-Agent Parser (CJS)
//
// CommonJS mirror of api/utils/deviceParser.js for Netlify Functions.
// ─────────────────────────────────────────────────────────────────────────────

function extractVersion(ua, regex) {
  var match = ua.match(regex);
  return (match && match[1]) ? match[1].replace(/_/g, ".") : "unknown";
}

function parseDevice(ua) {
  var defaults = { browser: "unknown", browser_version: "unknown", os: "unknown", os_version: "unknown", device_type: "unknown" };
  if (!ua || typeof ua !== "string") return defaults;

  // Browser
  var browser = "unknown";
  var browser_version = "unknown";

  if (/Edg\//i.test(ua)) { browser = "Edge"; browser_version = extractVersion(ua, /Edg\/(\S+)/i); }
  else if (/OPR\//i.test(ua)) { browser = "Opera"; browser_version = extractVersion(ua, /OPR\/(\S+)/i); }
  else if (/Vivaldi/i.test(ua)) { browser = "Vivaldi"; browser_version = extractVersion(ua, /Vivaldi\/(\S+)/i); }
  else if (/SamsungBrowser/i.test(ua)) { browser = "Samsung Internet"; browser_version = extractVersion(ua, /SamsungBrowser\/(\S+)/i); }
  else if (/UCBrowser|UCWEB/i.test(ua)) { browser = "UC Browser"; browser_version = extractVersion(ua, /UCBrowser\/(\S+)/i); }
  else if (/Firefox/i.test(ua)) { browser = "Firefox"; browser_version = extractVersion(ua, /Firefox\/(\S+)/i); }
  else if (/FxiOS/i.test(ua)) { browser = "Firefox (iOS)"; browser_version = extractVersion(ua, /FxiOS\/(\S+)/i); }
  else if (/CriOS/i.test(ua)) { browser = "Chrome (iOS)"; browser_version = extractVersion(ua, /CriOS\/(\S+)/i); }
  else if (/Chrome/i.test(ua)) { browser = "Chrome"; browser_version = extractVersion(ua, /Chrome\/(\S+)/i); }
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) { browser = "Safari"; browser_version = extractVersion(ua, /Version\/(\S+)/i); }
  else if (/MSIE|Trident/i.test(ua)) { browser = "Internet Explorer"; browser_version = extractVersion(ua, /(?:MSIE |rv:)(\S+)/i); }

  // OS
  var os = "unknown";
  var os_version = "unknown";

  if (/Windows NT/i.test(ua)) {
    os = "Windows";
    var verMap = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7", "6.0": "Vista", "5.1": "XP" };
    var ntMatch = ua.match(/Windows NT (\d+\.\d+)/i);
    var ntVer = ntMatch ? ntMatch[1] : null;
    os_version = (ntVer && verMap[ntVer]) || ntVer || "unknown";
  } else if (/Mac OS X|macOS/i.test(ua)) {
    os = "macOS";
    os_version = extractVersion(ua, /Mac OS X (\d+[._]\d+[._]?\d*)/i);
  } else if (/CrOS/i.test(ua)) {
    os = "Chrome OS";
    os_version = extractVersion(ua, /CrOS \S+ (\S+)/i);
  } else if (/Android/i.test(ua)) {
    os = "Android";
    os_version = extractVersion(ua, /Android (\d+[\.\d]*)/i);
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = "iOS";
    os_version = extractVersion(ua, /OS (\d+[._]\d+[._]?\d*)/i);
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  // Device type
  var device_type = "desktop";
  if (/bot|crawl|spider|slurp|mediapartners|facebookexternalhit|bingpreview/i.test(ua)) {
    device_type = "bot";
  } else if (/iPad|tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    device_type = "tablet";
  } else if (/Mobile|iPhone|iPod|Opera Mini|IEMobile|wpdesktop/i.test(ua)) {
    device_type = "mobile";
  }

  return { browser: browser, browser_version: browser_version, os: os, os_version: os_version, device_type: device_type };
}

module.exports = { parseDevice: parseDevice };
