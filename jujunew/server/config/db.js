import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Client — replaces pg/Pool for all database operations
//
// Uses service_role key (server-side only) to bypass RLS when needed.
// NEVER expose service_role key to the frontend.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[DB] ❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.\n' +
    '[DB]    Set them in your .env file:\n' +
    '[DB]    SUPABASE_URL=https://your-project.supabase.co\n' +
    '[DB]    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key'
  );
}

const supabase = createClient(
  SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    // Use service_role to bypass RLS for server-side operations
    db: {
      schema: 'public',
    },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// initDB — verify Supabase connectivity on startup
//
// Unlike the old pg/Pool approach, Supabase handles table creation via
// the dashboard or migrations. This function just verifies connectivity
// and logs the status.
// ─────────────────────────────────────────────────────────────────────────────
export async function initDB() {
  try {
    // Quick connectivity test — try to select from a known table
    // If the table doesn't exist yet, we'll get a specific error we can handle
    const { data, error } = await supabase
      .from('user_tracking')
      .select('id')
      .limit(1);

    if (error) {
      // Table might not exist yet — this is expected on first deploy
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn(
          '[DB] ⚠️  Tables not found in Supabase. Please run the SQL migration.\n' +
          '[DB]    See the migration artifact for required SQL statements.'
        );
      } else {
        console.warn(`[DB] ⚠️  Supabase query warning: ${error.message}`);
      }
    } else {
      console.log('[DB] ✅ Supabase connected — user_tracking table ready.');
    }

    // Also check login_activity table
    const { error: loginErr } = await supabase
      .from('login_activity')
      .select('id')
      .limit(1);

    if (loginErr && loginErr.code === '42P01') {
      console.warn('[DB] ⚠️  Table "login_activity" not found — create it in Supabase dashboard.');
    } else if (!loginErr) {
      console.log('[DB] ✅ Table "login_activity" is ready.');
    }

    // Check login_attempts table
    const { error: attemptsErr } = await supabase
      .from('login_attempts')
      .select('id')
      .limit(1);

    if (attemptsErr && attemptsErr.code === '42P01') {
      console.warn('[DB] ⚠️  Table "login_attempts" not found — create it in Supabase dashboard.');
    } else if (!attemptsErr) {
      console.log('[DB] ✅ Table "login_attempts" is ready.');
    }

    // Check login_logs table (used by Netlify function)
    const { error: logsErr } = await supabase
      .from('login_logs')
      .select('id')
      .limit(1);

    if (logsErr && logsErr.code === '42P01') {
      console.warn('[DB] ⚠️  Table "login_logs" not found — create it in Supabase dashboard.');
    } else if (!logsErr) {
      console.log('[DB] ✅ Table "login_logs" is ready.');
    }

  } catch (err) {
    console.error('[DB] ❌ Supabase connection error:', err.message);
    // Graceful — server still runs if DB is temporarily unavailable
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export supabase as the primary database interface
// Also export as default for backward compatibility
// ─────────────────────────────────────────────────────────────────────────────
export { supabase };
export default supabase;
