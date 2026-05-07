-- ═══════════════════════════════════════════════════════════════════════════
-- ARJHBD — Fix user_tracking RLS Policies
--
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- This fixes the production issue where user_tracking inserts fail silently.
--
-- ⚠️  IMPORTANT: Run ALL steps in order.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: Diagnostic — Check current RLS status for both tables
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  tablename,
  rowsecurity AS "RLS Enabled"
FROM pg_tables
WHERE tablename IN ('login_events', 'user_tracking')
  AND schemaname = 'public';


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Diagnostic — Check existing policies
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('login_events', 'user_tracking')
  AND schemaname = 'public';


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Enable RLS on user_tracking (safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.user_tracking ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Drop any existing restrictive policies (clean slate)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'user_tracking' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_tracking', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: Create permissive policies for user_tracking
-- ═══════════════════════════════════════════════════════════════════════════

-- Allow inserts from ALL roles (service_role, authenticated, anon)
CREATE POLICY "user_tracking_insert_all"
ON public.user_tracking
FOR INSERT
TO anon, authenticated, service_role
WITH CHECK (true);

-- Allow service_role full read/write (needed for .select() after .insert())
CREATE POLICY "user_tracking_service_role_all"
ON public.user_tracking
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6: Ensure login_events also has proper policies (consistency)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

-- Only create if not exists (safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'login_events' AND policyname = 'login_events_insert_all'
  ) THEN
    EXECUTE 'CREATE POLICY "login_events_insert_all" ON public.login_events FOR INSERT TO anon, authenticated, service_role WITH CHECK (true)';
    RAISE NOTICE 'Created login_events INSERT policy';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'login_events' AND policyname = 'login_events_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY "login_events_service_role_all" ON public.login_events FOR ALL TO service_role USING (true) WITH CHECK (true)';
    RAISE NOTICE 'Created login_events service_role policy';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 7: Verify — Show final policy state
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('login_events', 'user_tracking')
  AND schemaname = 'public'
ORDER BY tablename, policyname;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 8: Quick insert test (optional — verify it works)
-- ═══════════════════════════════════════════════════════════════════════════
-- Uncomment and run to test:
--
-- INSERT INTO public.user_tracking (
--   user_id, ip_address, city, region, country,
--   browser, os, device_type, status
-- ) VALUES (
--   'rls_test', '0.0.0.0', 'Test', 'Test', 'Test',
--   'Test', 'Test', 'desktop', 'test'
-- );
--
-- SELECT * FROM public.user_tracking WHERE user_id = 'rls_test';
--
-- DELETE FROM public.user_tracking WHERE user_id = 'rls_test';
