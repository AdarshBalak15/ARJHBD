// ─────────────────────────────────────────────────────────────────────────────
// hooks/useFormattedTime.js — React Hook for Timezone-Aware Timestamps
//
// Provides memoized, reactive timestamp formatting for React components.
// Uses the formatTime utility internally, with React-optimized caching
// to prevent unnecessary re-renders.
//
// PERFORMANCE NOTES:
//   • useMemo ensures formatting only recalculates when inputs change.
//   • Stable reference: the returned object identity only changes when
//     the formatted string actually changes.
//   • For lists of timestamps, prefer the batch hook useFormattedTimes().
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useCallback } from 'react';
import {
  formatTime,
  formatDateOnly,
  formatTimeOnly,
  formatFullTime,
  formatRelativeTime,
  detectTimezone,
  parseTimestamp,
} from '../utils/formatTime';

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE TIMESTAMP HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook to format a single UTC timestamp into a local time string.
 *
 * @param {string | number | Date | null | undefined} timestamp
 *   UTC timestamp from Supabase (e.g., "2026-04-23T09:42:21.615321+00:00")
 *
 * @param {object} [options]
 * @param {string} [options.timezone]     — Force specific IANA timezone
 * @param {string} [options.locale]       — BCP 47 locale (default: 'en-IN')
 * @param {string} [options.preset]       — Format preset name
 * @param {object} [options.custom]       — Custom Intl.DateTimeFormat options
 * @param {string} [options.fallback]     — Fallback for invalid timestamps
 *
 * @returns {{
 *   formatted:  string,
 *   dateOnly:   string,
 *   timeOnly:   string,
 *   full:       string,
 *   relative:   string,
 *   isValid:    boolean,
 *   date:       Date | null,
 *   timezone:   string,
 * }}
 *
 * @example
 *   function LoginEvent({ event }) {
 *     const { formatted, relative, isValid } = useFormattedTime(event.created_at);
 *
 *     return (
 *       <div>
 *         <span>{formatted}</span>
 *         <small>{relative}</small>
 *       </div>
 *     );
 *   }
 */
export function useFormattedTime(timestamp, options = {}) {
  const {
    timezone,
    locale = 'en-IN',
    preset = 'default',
    custom,
    fallback = '—',
  } = options;

  // Memoize the entire result — only recalculates when inputs change
  return useMemo(() => {
    const date = parseTimestamp(timestamp);
    const tz = timezone || detectTimezone();
    const baseOpts = { timezone: tz, locale, fallback };

    return {
      /** "23 Apr 2026, 3:12 PM" */
      formatted: formatTime(timestamp, { ...baseOpts, preset, custom }),

      /** "23 Apr 2026" */
      dateOnly: formatDateOnly(timestamp, baseOpts),

      /** "3:12 PM" */
      timeOnly: formatTimeOnly(timestamp, baseOpts),

      /** "23 April 2026, 3:12:45 PM IST" */
      full: formatFullTime(timestamp, baseOpts),

      /** "2 hours ago" */
      relative: formatRelativeTime(timestamp, { locale, fallback }),

      /** Whether the timestamp parsed successfully */
      isValid: date !== null,

      /** Parsed Date object (null if invalid) */
      date,

      /** Resolved timezone used for formatting */
      timezone: tz,
    };
  }, [timestamp, timezone, locale, preset, custom, fallback]);
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH TIMESTAMPS HOOK — for lists (tables, logs, activity feeds)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook to format an array of UTC timestamps efficiently.
 * Ideal for rendering tables/lists of events from Supabase.
 *
 * @param {Array<string | number | Date | null | undefined>} timestamps
 * @param {object} [options] — same as useFormattedTime options
 *
 * @returns {Array<{
 *   formatted: string,
 *   dateOnly:  string,
 *   timeOnly:  string,
 *   relative:  string,
 *   isValid:   boolean,
 * }>}
 *
 * @example
 *   function EventLog({ events }) {
 *     const timestamps = events.map(e => e.created_at);
 *     const formatted = useFormattedTimes(timestamps);
 *
 *     return (
 *       <ul>
 *         {events.map((event, i) => (
 *           <li key={event.id}>
 *             {event.status} — {formatted[i].formatted}
 *             <small>{formatted[i].relative}</small>
 *           </li>
 *         ))}
 *       </ul>
 *     );
 *   }
 */
export function useFormattedTimes(timestamps, options = {}) {
  const {
    timezone,
    locale = 'en-IN',
    preset = 'default',
    fallback = '—',
  } = options;

  // Stringify timestamps array for stable dependency comparison
  const timestampsKey = JSON.stringify(timestamps);

  return useMemo(() => {
    if (!Array.isArray(timestamps)) return [];

    const tz = timezone || detectTimezone();
    const baseOpts = { timezone: tz, locale, fallback };

    return timestamps.map((ts) => ({
      formatted: formatTime(ts, { ...baseOpts, preset }),
      dateOnly: formatDateOnly(ts, baseOpts),
      timeOnly: formatTimeOnly(ts, baseOpts),
      relative: formatRelativeTime(ts, { locale, fallback }),
      isValid: parseTimestamp(ts) !== null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timestampsKey, timezone, locale, preset, fallback]);
}

// ─────────────────────────────────────────────────────────────────────────────
// ON-DEMAND FORMATTER HOOK — returns a stable formatting function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook that returns a stable, memoized formatting function.
 * Use when you need to format timestamps inside event handlers,
 * callbacks, or conditional rendering without declaring the timestamp
 * upfront.
 *
 * @param {object} [options] — default formatting options
 * @returns {(timestamp: string | number | Date) => string}
 *
 * @example
 *   function TrackingDashboard() {
 *     const format = useTimeFormatter({ preset: 'short' });
 *
 *     const handleExport = (events) => {
 *       const csv = events.map(e => `${e.ip},${format(e.created_at)}`);
 *       // ...
 *     };
 *   }
 */
export function useTimeFormatter(options = {}) {
  const {
    timezone,
    locale = 'en-IN',
    preset = 'default',
    custom,
    fallback = '—',
  } = options;

  return useCallback(
    (timestamp) =>
      formatTime(timestamp, { timezone, locale, preset, custom, fallback }),
    [timezone, locale, preset, custom, fallback]
  );
}

// Default export for convenience
export default useFormattedTime;
