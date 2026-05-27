// ─────────────────────────────────────────────────────────────────────────────
// server/utils/sanitize.js — Input Sanitization Utilities
//
// Prevents injection attacks in email templates and log output.
// Used by mailer config and email services to sanitize user-controlled data
// before inserting into HTML email templates.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escape HTML entities to prevent XSS in email templates.
 * Handles the 5 critical characters: & < > " '
 *
 * @param {string} str — raw user input
 * @returns {string} — safe HTML string
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize a string for safe inclusion in log output.
 * Truncates long strings and removes control characters.
 *
 * @param {string} str — raw input
 * @param {number} [maxLen=200] — maximum length
 * @returns {string}
 */
export function sanitizeForLog(str, maxLen = 200) {
  if (typeof str !== 'string') return String(str ?? '');
  // Remove control characters (except newline/tab)
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '…' : cleaned;
}

/**
 * Redact a secret for safe logging.
 * Shows first 3 chars + last 2 chars with *** in between.
 *
 * @param {string} secret — the secret value
 * @returns {string} — redacted string like "abc***xy"
 */
export function redactSecret(secret) {
  if (!secret || typeof secret !== 'string') return '[empty]';
  if (secret.length <= 6) return '***';
  return secret.slice(0, 3) + '***' + secret.slice(-2);
}

/**
 * Sanitize an object's string values for use in email templates.
 * Non-string values are passed through unchanged.
 *
 * @param {object} obj — object with potentially unsafe values
 * @param {string[]} [keys] — specific keys to sanitize (default: all string keys)
 * @returns {object} — new object with sanitized string values
 */
export function sanitizeEmailData(obj, keys) {
  const result = { ...obj };
  const targetKeys = keys || Object.keys(result);

  for (const key of targetKeys) {
    if (typeof result[key] === 'string') {
      result[key] = escapeHtml(result[key]);
    }
  }

  return result;
}
