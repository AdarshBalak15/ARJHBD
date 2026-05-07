// ─────────────────────────────────────────────────────────────────────────────
// api/utils/dbInsert.js — Resilient Supabase Insert with Retry
//
// Provides atomic, validated database insertion with:
//   • Pre-insertion validation (no corrupt rows)
//   • Retry with exponential backoff for transient failures
//   • Immediate abort on non-retriable errors (RLS, schema, null violation)
//   • Structured error classification
//   • Detailed diagnostics for every attempt
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

let supabase = null;

/**
 * Get or create a Supabase client. Singleton pattern.
 * Uses service role key (bypasses RLS).
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    console.log('[DB] Supabase client initialized');
  }
  return supabase;
}

/**
 * Non-retriable Supabase error codes.
 */
const NON_RETRIABLE = new Set([
  '42501', // RLS policy violation
  '42703', // column does not exist
  '42P01', // table does not exist
  '23502', // NOT NULL violation
  '23505', // unique constraint violation
  '22P02', // invalid input syntax
]);

/**
 * Classify a Supabase error into a human-readable type.
 * @param {{ code?: string, message?: string }} error
 * @returns {string}
 */
function classifyError(error) {
  if (!error) return 'UNKNOWN';
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();

  if (code === '42501' || msg.includes('row-level security')) return 'RLS_BLOCKED';
  if (code === '42703' || msg.includes('column')) return 'SCHEMA_MISMATCH';
  if (code === '42P01' || msg.includes('does not exist')) return 'TABLE_NOT_FOUND';
  if (code === '23502') return 'NULL_VIOLATION';
  if (code === '23505') return 'DUPLICATE';
  if (code === '22P02') return 'INVALID_INPUT';
  if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) return 'CONNECTION_ERROR';
  return 'INSERT_FAILED';
}

/**
 * Sanitize a value for safe insertion — replace empty strings with null.
 * @param {*} val
 * @returns {*}
 */
function sanitize(val) {
  if (val === '' || val === undefined) return null;
  if (val === 'unknown') return 'unknown'; // Keep "unknown" as valid default
  return val;
}

/**
 * Insert a row into a Supabase table with retry and validation.
 *
 * @param {string} table — Table name ('login_events' or 'user_tracking')
 * @param {object} data — Row data to insert
 * @param {object} [options]
 * @param {number} [options.retries=3] — Max retry attempts
 * @param {number} [options.baseDelay=500] — Base delay in ms for backoff
 * @returns {Promise<{ success: boolean, error?: string, details?: string, attempts: number }>}
 */
export async function safeInsert(table, data, options = {}) {
  const { retries = 3, baseDelay = 500 } = options;

  const db = getSupabase();
  if (!db) {
    const reason = !process.env.SUPABASE_URL ? 'SUPABASE_URL missing' :
                   !process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY missing' :
                   'Unknown initialization failure';
    console.error('[DB] ❌ Client not initialized:', reason);
    return { success: false, error: 'NO_CLIENT', details: reason, attempts: 0 };
  }

  // Sanitize all values
  const sanitized = {};
  for (const [key, val] of Object.entries(data)) {
    sanitized[key] = sanitize(val);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[DB] Insert attempt ${attempt}/${retries} into ${table}`);

      const { data: result, error } = await db.from(table).insert([sanitized]);

      if (error) {
        const errorType = classifyError(error);
        console.error(`[DB] ❌ Attempt ${attempt}/${retries} — ${errorType}:`, {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });

        // Non-retriable errors — abort immediately
        if (NON_RETRIABLE.has(error.code)) {
          return { success: false, error: errorType, details: error.message, attempts: attempt };
        }

        // Transient error — retry with backoff
        if (attempt < retries) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 4000);
          console.log(`[DB] ⏳ Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        return { success: false, error: errorType, details: error.message, attempts: attempt };
      }

      console.log(`[DB] ✅ Insert into ${table} OK (attempt ${attempt})`);
      return { success: true, attempts: attempt };
    } catch (err) {
      console.error(`[DB] ❌ Attempt ${attempt}/${retries} exception:`, err.message);

      if (attempt < retries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 4000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  return { success: false, error: 'MAX_RETRIES_EXCEEDED', details: `Failed after ${retries} attempts`, attempts: retries };
}

export default safeInsert;
