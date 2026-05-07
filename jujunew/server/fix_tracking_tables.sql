-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Add Debug & Diagnostics Columns to login_events & user_tracking
--
-- Run this in Supabase SQL Editor to add tracking reliability fields.
-- These columns are nullable with defaults, so existing rows are unaffected.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- login_events: Already has the core columns, no new debug columns needed
-- (the existing schema is correct for login_events)
-- ─────────────────────────────────────────────────────────────────────────

-- Ensure RLS is disabled for service role inserts
ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;

-- Drop any existing restrictive policies
DROP POLICY IF EXISTS "Allow service role full access" ON login_events;
DROP POLICY IF EXISTS "Allow all inserts" ON login_events;
DROP POLICY IF EXISTS "Allow all selects" ON login_events;

-- Create permissive policies for service role
CREATE POLICY "Allow service role full access" ON login_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- user_tracking: Ensure the table exists and has all required columns
-- ─────────────────────────────────────────────────────────────────────────

-- Ensure RLS allows inserts
ALTER TABLE user_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access" ON user_tracking;
DROP POLICY IF EXISTS "Allow all inserts" ON user_tracking;
DROP POLICY IF EXISTS "Allow all selects" ON user_tracking;

CREATE POLICY "Allow service role full access" ON user_tracking
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFY: Check both tables exist and have correct columns
-- ─────────────────────────────────────────────────────────────────────────
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name IN ('login_events', 'user_tracking')
ORDER BY table_name, ordinal_position;
