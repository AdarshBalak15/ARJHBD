import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Unified schema: 2 tables instead of 4
//
// login_events    — replaces login_logs + login_attempts + login_activity
// user_tracking   — unchanged (deep visitor metadata)
// ─────────────────────────────────────────────────────────────────────────────

const sql = `
  -- ═══════════════════════════════════════════════════════════════════════════
  -- TABLE 1: login_events (unified)
  -- Replaces: login_logs, login_attempts, login_activity
  -- ═══════════════════════════════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS login_events (
    id               SERIAL PRIMARY KEY,
    user_id          VARCHAR(255) DEFAULT 'anonymous',
    ip_address       VARCHAR(50),
    city             VARCHAR(100) DEFAULT 'unknown',
    region           VARCHAR(100) DEFAULT 'unknown',
    country          VARCHAR(100) DEFAULT 'unknown',
    latitude         DECIMAL(10, 6),
    longitude        DECIMAL(10, 6),
    timezone         VARCHAR(100) DEFAULT 'unknown',
    device_info      TEXT,
    status           VARCHAR(20) NOT NULL,
    anomaly_status   VARCHAR(20) DEFAULT 'normal',
    anomaly_reasons  TEXT DEFAULT '',
    source           VARCHAR(20) DEFAULT 'express',
    created_at       TIMESTAMPTZ  DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_login_events_ip      ON login_events (ip_address);
  CREATE INDEX IF NOT EXISTS idx_login_events_user    ON login_events (user_id);
  CREATE INDEX IF NOT EXISTS idx_login_events_status  ON login_events (status);
  CREATE INDEX IF NOT EXISTS idx_login_events_created ON login_events (created_at DESC);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TABLE 2: user_tracking (unchanged)
  -- Deep visitor metadata: ISP, proxy detection, parsed browser/OS
  -- ═══════════════════════════════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS user_tracking (
    id               SERIAL PRIMARY KEY,
    user_id          VARCHAR(255) DEFAULT 'anonymous',
    ip_address       VARCHAR(50),
    city             VARCHAR(100) DEFAULT 'unknown',
    region           VARCHAR(100) DEFAULT 'unknown',
    country          VARCHAR(100) DEFAULT 'unknown',
    latitude         DECIMAL(10, 6),
    longitude        DECIMAL(10, 6),
    timezone         VARCHAR(100) DEFAULT 'unknown',
    isp              VARCHAR(255) DEFAULT 'unknown',
    org              VARCHAR(255) DEFAULT 'unknown',
    device_info      TEXT,
    browser          VARCHAR(100) DEFAULT 'unknown',
    browser_version  VARCHAR(50)  DEFAULT 'unknown',
    os               VARCHAR(100) DEFAULT 'unknown',
    os_version       VARCHAR(50)  DEFAULT 'unknown',
    device_type      VARCHAR(20)  DEFAULT 'unknown',
    ip_type          VARCHAR(20)  DEFAULT 'public',
    is_proxy         BOOLEAN      DEFAULT false,
    proxy_indicators TEXT         DEFAULT '',
    status           VARCHAR(50)  DEFAULT 'active',
    created_at       TIMESTAMPTZ  DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_user_tracking_ip ON user_tracking (ip_address);
`;

// ─────────────────────────────────────────────────────────────────────────────
// Migration SQL — run AFTER creating login_events to move old data
// ─────────────────────────────────────────────────────────────────────────────
const migrationSql = `
  -- ═══════════════════════════════════════════════════════════════════════════
  -- MIGRATION: Move data from old tables into login_events
  -- Run this ONCE in Supabase SQL Editor after creating login_events
  -- ═══════════════════════════════════════════════════════════════════════════

  -- From login_logs (Netlify production data)
  INSERT INTO login_events (user_id, ip_address, city, region, country, latitude, longitude, timezone, device_info, status, anomaly_status, anomaly_reasons, source, created_at)
  SELECT user_id, ip_address, city, region, country, latitude, longitude, timezone, device_info,
         COALESCE(status, 'SUCCESS'), 'normal', '', 'netlify', created_at
  FROM login_logs;

  -- From login_attempts (Express dev data)
  INSERT INTO login_events (user_id, ip_address, city, region, country, latitude, longitude, timezone, device_info, status, anomaly_status, anomaly_reasons, source, created_at)
  SELECT user_id, ip_address, city, region, country, latitude, longitude, timezone, device_info,
         COALESCE(status, 'SUCCESS'), 'normal', '', 'express', created_at
  FROM login_attempts;

  -- From login_activity (anomaly-detected data)
  INSERT INTO login_events (user_id, ip_address, city, region, country, latitude, longitude, timezone, device_info, status, anomaly_status, anomaly_reasons, source, created_at)
  SELECT user_id, ip_address, city, region, country, latitude, longitude, timezone, device_info,
         'SUCCESS', COALESCE(status, 'normal'), '', 'express', created_at
  FROM login_activity;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- VERIFY: Check row counts match before dropping old tables
  -- ═══════════════════════════════════════════════════════════════════════════
  -- SELECT 'login_events' AS tbl, COUNT(*) FROM login_events
  -- UNION ALL SELECT 'login_logs', COUNT(*) FROM login_logs
  -- UNION ALL SELECT 'login_attempts', COUNT(*) FROM login_attempts
  -- UNION ALL SELECT 'login_activity', COUNT(*) FROM login_activity;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- DROP OLD TABLES (uncomment ONLY after verifying counts above)
  -- ═══════════════════════════════════════════════════════════════════════════
  -- DROP TABLE IF EXISTS login_logs;
  -- DROP TABLE IF EXISTS login_attempts;
  -- DROP TABLE IF EXISTS login_activity;
`;

async function createTables() {
  console.log('[SETUP] Creating tables in Supabase...');
  console.log('[SETUP] URL:', SUPABASE_URL);

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check new unified table
    const tables = ['login_events', 'user_tracking'];
    
    console.log('\n[SETUP] Checking table status:\n');
    for (const table of tables) {
      const { error } = await sb.from(table).select('id').limit(1);
      if (error) {
        console.log(`  ${table}: ❌ NOT FOUND`);
      } else {
        console.log(`  ${table}: ✅ EXISTS`);
      }
    }

    // Also check old tables (for migration status)
    const oldTables = ['login_logs', 'login_attempts', 'login_activity'];
    console.log('\n[SETUP] Old tables (to be migrated/dropped):\n');
    for (const table of oldTables) {
      const { error } = await sb.from(table).select('id').limit(1);
      if (error) {
        console.log(`  ${table}: ✅ Already removed or not found`);
      } else {
        console.log(`  ${table}: ⚠️  Still exists — run migration SQL to move data`);
      }
    }

    console.log('\n[SETUP] ═══════════════════════════════════════════════════');
    console.log('[SETUP] 📋 STEP 1: Create login_events table');
    console.log('[SETUP]    Copy the CREATE TABLE SQL below into Supabase SQL Editor');
    console.log('[SETUP] ═══════════════════════════════════════════════════\n');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));

    console.log('\n[SETUP] ═══════════════════════════════════════════════════');
    console.log('[SETUP] 📋 STEP 2: Migrate old data (run AFTER step 1)');
    console.log('[SETUP] ═══════════════════════════════════════════════════\n');
    console.log('─'.repeat(60));
    console.log(migrationSql);
    console.log('─'.repeat(60));

  } catch (err) {
    console.error('[SETUP] ❌ Error:', err.message);
  }
}

createTables();
