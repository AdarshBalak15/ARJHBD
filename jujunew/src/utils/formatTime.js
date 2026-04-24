// ─────────────────────────────────────────────────────────────────────────────
// utils/formatTime.js — Production-Ready Timezone Conversion Utility
//
// Converts UTC timestamps from Supabase (PostgreSQL TIMESTAMPTZ) into
// user-friendly, locale-aware local time strings.
//
// DESIGN DECISIONS:
//   • Uses native Intl.DateTimeFormat — zero dependencies, tree-shakeable.
//   • Caches formatter instances per (locale + timezone + preset) combo
//     because Intl.DateTimeFormat construction is expensive (~5× slower
//     than calling .format() on a cached instance).
//   • Auto-detects browser timezone via Intl.DateTimeFormat().resolvedOptions().
//   • Graceful fallback chain: invalid input → null/fallback string.
//   • All functions are pure (except cache side-effect) and SSR-safe.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// TIMEZONE DETECTION — cached once per session
// ─────────────────────────────────────────────────────────────────────────────

/** @type {string} Detected browser timezone (e.g., "Asia/Kolkata") */
let _detectedTimezone = null;

/**
 * Detect the user's browser timezone.
 * Returns IANA timezone string (e.g., "Asia/Kolkata", "America/New_York").
 * Falls back to "UTC" if detection fails.
 *
 * @returns {string}
 */
export function detectTimezone() {
  if (_detectedTimezone) return _detectedTimezone;

  try {
    _detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    _detectedTimezone = 'UTC';
  }

  // Safeguard: some older browsers return undefined
  if (!_detectedTimezone) _detectedTimezone = 'UTC';

  return _detectedTimezone;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTER CACHE — avoids re-creating Intl.DateTimeFormat on every call
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, Intl.DateTimeFormat>} */
const _formatterCache = new Map();

/**
 * Get (or create and cache) an Intl.DateTimeFormat instance.
 *
 * @param {string} locale
 * @param {Intl.DateTimeFormatOptions} options
 * @returns {Intl.DateTimeFormat}
 */
function getFormatter(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`;

  if (_formatterCache.has(key)) {
    return _formatterCache.get(key);
  }

  const formatter = new Intl.DateTimeFormat(locale, options);

  // Cap cache size to prevent memory leaks in long-running tabs
  if (_formatterCache.size >= 50) {
    const firstKey = _formatterCache.keys().next().value;
    _formatterCache.delete(firstKey);
  }

  _formatterCache.set(key, formatter);
  return formatter;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT VALIDATION — ensures safe Date parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely parse a timestamp into a Date object.
 * Accepts: ISO string, Unix ms, Date instance, or any valid Date() input.
 * Returns null if the input is invalid/null/undefined.
 *
 * @param {string | number | Date | null | undefined} timestamp
 * @returns {Date | null}
 */
export function parseTimestamp(timestamp) {
  // Guard: null, undefined, empty string
  if (timestamp == null || timestamp === '') return null;

  // Already a Date
  if (timestamp instanceof Date) {
    return isNaN(timestamp.getTime()) ? null : timestamp;
  }

  // Unix milliseconds (number)
  if (typeof timestamp === 'number') {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? null : d;
  }

  // String — try parsing
  if (typeof timestamp === 'string') {
    const trimmed = timestamp.trim();
    if (!trimmed) return null;

    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT PRESETS — common formatting patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'default' | 'short' | 'long' | 'dateOnly' | 'timeOnly' | 'relative' | 'full'} FormatPreset
 */

/** @type {Record<string, Intl.DateTimeFormatOptions>} */
const FORMAT_PRESETS = {
  // "23 Apr 2026, 3:12 PM"
  default: {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  },

  // "23/04/2026, 3:12 PM"
  short: {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  },

  // "Thursday, 23 April 2026 at 3:12:45 PM"
  long: {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  },

  // "23 Apr 2026"
  dateOnly: {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  },

  // "3:12 PM"
  timeOnly: {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  },

  // "23 April 2026, 3:12:45 PM IST"
  full: {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE API — formatTime()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a UTC timestamp to a formatted local time string.
 *
 * @param {string | number | Date | null | undefined} timestamp
 *   The UTC timestamp to format. Accepts ISO strings from Supabase
 *   (e.g., "2026-04-23T09:42:21.615321+00:00"), Unix ms, or Date objects.
 *
 * @param {object} [options]
 * @param {string} [options.timezone]
 *   IANA timezone to convert to (e.g., "Asia/Kolkata", "America/New_York").
 *   Defaults to auto-detected browser timezone.
 * @param {string} [options.locale='en-IN']
 *   BCP 47 locale tag for formatting (e.g., "en-US", "en-IN", "hi-IN").
 * @param {FormatPreset} [options.preset='default']
 *   Named formatting preset. See FORMAT_PRESETS above.
 * @param {Intl.DateTimeFormatOptions} [options.custom]
 *   Custom Intl.DateTimeFormat options. Overrides preset if provided.
 * @param {string} [options.fallback='—']
 *   String to return if the timestamp is invalid/null.
 *
 * @returns {string} Formatted time string, or fallback on invalid input.
 *
 * @example
 *   // Auto-detect timezone (browser)
 *   formatTime("2026-04-23T09:42:21.615321+00:00")
 *   // → "23 Apr 2026, 3:12 PM"  (if user is in IST)
 *
 *   // Force specific timezone
 *   formatTime("2026-04-23T09:42:21+00:00", { timezone: "America/New_York" })
 *   // → "23 Apr 2026, 5:42 AM"
 *
 *   // Use a preset
 *   formatTime("2026-04-23T09:42:21+00:00", { preset: "dateOnly" })
 *   // → "23 Apr 2026"
 *
 *   // Custom format
 *   formatTime("2026-04-23T09:42:21+00:00", {
 *     custom: { weekday: 'short', month: 'short', day: 'numeric' }
 *   })
 *   // → "Thu, Apr 23"
 */
export function formatTime(timestamp, options = {}) {
  const {
    timezone,
    locale = 'en-IN',
    preset = 'default',
    custom,
    fallback = '—',
  } = options;

  // 1. Parse input
  const date = parseTimestamp(timestamp);
  if (!date) return fallback;

  // 2. Resolve timezone
  const tz = timezone || detectTimezone();

  // 3. Build format options
  const formatOptions = custom || FORMAT_PRESETS[preset] || FORMAT_PRESETS.default;

  // 4. Merge timezone into options
  const fullOptions = { ...formatOptions, timeZone: tz };

  try {
    // 5. Get cached formatter and format
    const formatter = getFormatter(locale, fullOptions);
    return formatter.format(date);
  } catch (err) {
    // Fallback: if the timezone is invalid or formatter fails,
    // try once more with UTC
    console.warn('[formatTime] Formatting failed, falling back to UTC:', err.message);
    try {
      const utcOptions = { ...formatOptions, timeZone: 'UTC' };
      const utcFormatter = getFormatter(locale, utcOptions);
      return utcFormatter.format(date) + ' (UTC)';
    } catch {
      return fallback;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format as date only: "23 Apr 2026"
 * @param {string | number | Date | null | undefined} timestamp
 * @param {object} [options] — same as formatTime options (minus preset)
 * @returns {string}
 */
export function formatDateOnly(timestamp, options = {}) {
  return formatTime(timestamp, { ...options, preset: 'dateOnly' });
}

/**
 * Format as time only: "3:12 PM"
 * @param {string | number | Date | null | undefined} timestamp
 * @param {object} [options]
 * @returns {string}
 */
export function formatTimeOnly(timestamp, options = {}) {
  return formatTime(timestamp, { ...options, preset: 'timeOnly' });
}

/**
 * Format with timezone label: "23 April 2026, 3:12:45 PM IST"
 * @param {string | number | Date | null | undefined} timestamp
 * @param {object} [options]
 * @returns {string}
 */
export function formatFullTime(timestamp, options = {}) {
  return formatTime(timestamp, { ...options, preset: 'full' });
}

/**
 * Get a relative time description: "2 hours ago", "in 3 days", "just now"
 * Uses Intl.RelativeTimeFormat for locale-aware output.
 *
 * @param {string | number | Date | null | undefined} timestamp
 * @param {object} [options]
 * @param {string} [options.locale='en-IN']
 * @param {string} [options.fallback='—']
 * @returns {string}
 */
export function formatRelativeTime(timestamp, options = {}) {
  const { locale = 'en-IN', fallback = '—' } = options;

  const date = parseTimestamp(timestamp);
  if (!date) return fallback;

  const now = Date.now();
  const diffMs = date.getTime() - now;
  const absDiffMs = Math.abs(diffMs);

  // Determine the best unit
  const seconds = Math.round(absDiffMs / 1000);
  const minutes = Math.round(absDiffMs / 60000);
  const hours = Math.round(absDiffMs / 3600000);
  const days = Math.round(absDiffMs / 86400000);
  const weeks = Math.round(absDiffMs / 604800000);
  const months = Math.round(absDiffMs / 2592000000);
  const years = Math.round(absDiffMs / 31536000000);

  /** @type {[number, Intl.RelativeTimeFormatUnit]} */
  let unit;

  if (seconds < 10) return 'just now';
  else if (seconds < 60) unit = [seconds, 'second'];
  else if (minutes < 60) unit = [minutes, 'minute'];
  else if (hours < 24) unit = [hours, 'hour'];
  else if (days < 7) unit = [days, 'day'];
  else if (weeks < 5) unit = [weeks, 'week'];
  else if (months < 12) unit = [months, 'month'];
  else unit = [years, 'year'];

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const value = diffMs < 0 ? -unit[0] : unit[0];
    return rtf.format(value, unit[1]);
  } catch {
    // Fallback for browsers without RelativeTimeFormat
    const value = unit[0];
    const unitStr = unit[1] + (value !== 1 ? 's' : '');
    return diffMs < 0 ? `${value} ${unitStr} ago` : `in ${value} ${unitStr}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER-SIDE HELPER — for Netlify functions / Express (Node.js)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a UTC timestamp for server-side use (e.g., email alerts).
 * Unlike formatTime(), this always requires an explicit timezone parameter
 * since there's no browser to auto-detect from.
 *
 * @param {string | number | Date} timestamp
 * @param {string} timezone — IANA timezone (e.g., "Asia/Kolkata")
 * @param {object} [options]
 * @param {string} [options.locale='en-IN']
 * @param {FormatPreset} [options.preset='full']
 * @returns {string}
 */
export function formatTimeServer(timestamp, timezone, options = {}) {
  const { locale = 'en-IN', preset = 'full' } = options;
  return formatTime(timestamp, { timezone, locale, preset, fallback: 'Unknown time' });
}
