// ─────────────────────────────────────────────────────────────────────────────
// netlify/functions/utils/formatTime.cjs — Server-Side Timezone Utility
//
// CommonJS version for Netlify Functions (which require CJS modules).
// Mirrors the frontend utility but without browser-specific auto-detection.
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, Intl.DateTimeFormat>} */
const _formatterCache = new Map();

function getFormatter(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`;
  if (_formatterCache.has(key)) return _formatterCache.get(key);

  const formatter = new Intl.DateTimeFormat(locale, options);
  if (_formatterCache.size >= 30) {
    const firstKey = _formatterCache.keys().next().value;
    _formatterCache.delete(firstKey);
  }
  _formatterCache.set(key, formatter);
  return formatter;
}

/**
 * Safely parse a timestamp into a Date object.
 * @param {string | number | Date | null | undefined} timestamp
 * @returns {Date | null}
 */
function parseTimestamp(timestamp) {
  if (timestamp == null || timestamp === '') return null;
  if (timestamp instanceof Date) return isNaN(timestamp.getTime()) ? null : timestamp;
  if (typeof timestamp === 'number') {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof timestamp === 'string') {
    const d = new Date(timestamp.trim());
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** @type {Record<string, Intl.DateTimeFormatOptions>} */
const FORMAT_PRESETS = {
  default: {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  },
  short: {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  },
  long: {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  },
  dateOnly: {
    day: 'numeric', month: 'short', year: 'numeric',
  },
  timeOnly: {
    hour: 'numeric', minute: '2-digit', hour12: true,
  },
  full: {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
    hour12: true, timeZoneName: 'short',
  },
};

/**
 * Format a UTC timestamp for server-side use.
 * Always requires an explicit timezone since there's no browser.
 *
 * @param {string | number | Date} timestamp
 * @param {string} timezone — IANA timezone (e.g., "Asia/Kolkata")
 * @param {object} [options]
 * @param {string} [options.locale='en-IN']
 * @param {string} [options.preset='default']
 * @param {string} [options.fallback='Unknown time']
 * @returns {string}
 */
function formatTime(timestamp, timezone, options = {}) {
  const {
    locale = 'en-IN',
    preset = 'default',
    fallback = 'Unknown time',
  } = options;

  const date = parseTimestamp(timestamp);
  if (!date) return fallback;

  const tz = timezone || 'UTC';
  const formatOptions = FORMAT_PRESETS[preset] || FORMAT_PRESETS.default;
  const fullOptions = { ...formatOptions, timeZone: tz };

  try {
    const formatter = getFormatter(locale, fullOptions);
    return formatter.format(date);
  } catch (err) {
    console.warn('[formatTime] Formatting failed:', err.message);
    try {
      const utcOptions = { ...formatOptions, timeZone: 'UTC' };
      return getFormatter(locale, utcOptions).format(date) + ' (UTC)';
    } catch {
      return fallback;
    }
  }
}

module.exports = { formatTime, parseTimestamp, FORMAT_PRESETS };
