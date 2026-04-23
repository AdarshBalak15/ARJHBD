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
// Checks the two remaining tables:
//   1. login_events  (unified: replaces login_logs + login_attempts + login_activity)
//   2. user_tracking (unchanged — deep visitor metadata)
// ─────────────────────────────────────────────────────────────────────────────
export async function initDB() {
  try {
    // Check login_events (unified table)
    const { error: eventsErr } = await supabase
      .from('login_events')
      .select('id')
      .limit(1);

    if (eventsErr && (eventsErr.code === '42P01' || eventsErr.message?.includes('does not exist'))) {
      console.warn(
        '[DB] ⚠️  Table "login_events" not found. Please run the migration SQL in Supabase Dashboard.\n' +
        '[DB]    This table replaces: login_logs, login_attempts, login_activity'
      );
    } else if (eventsErr) {
      console.warn(`[DB] ⚠️  login_events query warning: ${eventsErr.message}`);
    } else {
      console.log('[DB] ✅ Table "login_events" is ready.');
    }

    // Check user_tracking table
    const { error: trackingErr } = await supabase
      .from('user_tracking')
      .select('id')
      .limit(1);

    if (trackingErr && (trackingErr.code === '42P01' || trackingErr.message?.includes('does not exist'))) {
      console.warn('[DB] ⚠️  Table "user_tracking" not found — create it in Supabase dashboard.');
    } else if (trackingErr) {
      console.warn(`[DB] ⚠️  user_tracking query warning: ${trackingErr.message}`);
    } else {
      console.log('[DB] ✅ Table "user_tracking" is ready.');
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
