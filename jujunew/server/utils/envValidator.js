// ─────────────────────────────────────────────────────────────────────────────
// server/utils/envValidator.js — Environment Variable Validator
//
// Validates required and optional environment variables at startup.
// Never logs actual secret values — only reports presence/absence.
// ─────────────────────────────────────────────────────────────────────────────

import { redactSecret } from './sanitize.js';

/**
 * Required environment variables — server will warn if missing.
 * Format: { name, description, category }
 */
const REQUIRED_VARS = [
  { name: 'SUPABASE_URL',              desc: 'Supabase project URL',         category: 'Database' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY',  desc: 'Supabase service role key',    category: 'Database' },
  { name: 'HASHED_PASSWORD',            desc: 'Bcrypt-hashed login password', category: 'Auth' },
];

/**
 * Optional environment variables — server works without them but with reduced functionality.
 */
const OPTIONAL_VARS = [
  { name: 'ALERT_EMAIL_ENABLED', desc: 'Enable email alerts (true/false)',  category: 'Email' },
  { name: 'SMTP_USER',           desc: 'Gmail address for sending alerts',  category: 'Email' },
  { name: 'SMTP_PASS',           desc: 'Gmail App Password (16 chars)',     category: 'Email' },
  { name: 'ALERT_EMAIL_TO',      desc: 'Email recipient for alerts',        category: 'Email' },
  { name: 'SMTP_HOST',           desc: 'SMTP host (default: smtp.gmail.com)', category: 'Email' },
  { name: 'SMTP_PORT',           desc: 'SMTP port (default: 587)',          category: 'Email' },
  { name: 'PORT',                desc: 'Server port (default: 3001)',       category: 'Server' },
];

/**
 * Validate all environment variables and log a startup report.
 * Never logs actual secret values.
 *
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateEnv() {
  console.log('\n[ENV] ─── Environment Variable Check ───────────────────────────');

  const missing = [];
  let hasWarnings = false;

  // Check required vars
  for (const { name, desc, category } of REQUIRED_VARS) {
    const value = process.env[name];
    if (!value) {
      missing.push(name);
      console.error(`[ENV] ❌ MISSING  ${name} (${category}) — ${desc}`);
    } else {
      console.log(`[ENV] ✅ SET      ${name} (${category}) — ${redactSecret(value)}`);
    }
  }

  // Check optional vars
  for (const { name, desc, category } of OPTIONAL_VARS) {
    const value = process.env[name];
    if (!value) {
      hasWarnings = true;
      console.warn(`[ENV] ⚠️  UNSET   ${name} (${category}) — ${desc}`);
    } else {
      // Don't redact non-sensitive values like booleans/ports
      const isSensitive = ['SMTP_PASS', 'SMTP_USER'].includes(name);
      const display = isSensitive ? redactSecret(value) : value;
      console.log(`[ENV] ✅ SET      ${name} (${category}) — ${display}`);
    }
  }

  // Email system coherence check
  if (process.env.ALERT_EMAIL_ENABLED === 'true') {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error(
        '[ENV] ❌ ALERT_EMAIL_ENABLED=true but SMTP_USER or SMTP_PASS is missing.\n' +
        '[ENV]    Email alerts will NOT work. Set both or disable with ALERT_EMAIL_ENABLED=false.'
      );
    }
  }

  console.log('[ENV] ─────────────────────────────────────────────────────────\n');

  if (missing.length > 0) {
    console.error(`[ENV] ⚠️  ${missing.length} required variable(s) missing: ${missing.join(', ')}`);
    console.error('[ENV]    Copy .env.example → .env and fill in your values.\n');
  }

  return { valid: missing.length === 0, missing, hasWarnings };
}

/**
 * Validate that email-specific env vars are set.
 * Used by mailer modules to check before creating transporters.
 *
 * @returns {{ enabled: boolean, configured: boolean, user: string|null }}
 */
export function validateEmailEnv() {
  const enabled = process.env.ALERT_EMAIL_ENABLED === 'true';
  const hasUser = !!process.env.SMTP_USER;
  const hasPass = !!process.env.SMTP_PASS;
  const configured = hasUser && hasPass;

  if (enabled && !configured) {
    console.error(
      '[MAILER] ❌ Email alerts enabled but SMTP credentials are missing.\n' +
      '[MAILER]    Set SMTP_USER and SMTP_PASS in your environment variables.\n' +
      '[MAILER]    Emails will be silently skipped until configured.'
    );
  }

  return {
    enabled,
    configured: enabled && configured,
    user: hasUser ? process.env.SMTP_USER : null,
  };
}

export default validateEnv;
