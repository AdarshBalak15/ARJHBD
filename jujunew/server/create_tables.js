import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = `
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

  CREATE TABLE IF NOT EXISTS login_activity (
    id          SERIAL PRIMARY KEY,
    user_id     VARCHAR(255),
    ip_address  VARCHAR(50),
    city        VARCHAR(100),
    region      VARCHAR(100),
    country     VARCHAR(100),
    latitude    DECIMAL(10, 6),
    longitude   DECIMAL(10, 6),
    timezone    VARCHAR(100),
    device_info TEXT,
    status      VARCHAR(50) DEFAULT 'normal',
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id           SERIAL PRIMARY KEY,
    user_id      VARCHAR(255),
    ip_address   VARCHAR(50),
    city         VARCHAR(100),
    region       VARCHAR(100),
    country      VARCHAR(100),
    latitude     DECIMAL(10, 6),
    longitude    DECIMAL(10, 6),
    timezone     VARCHAR(100),
    device_info  TEXT,
    status       VARCHAR(20),
    created_at   TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS login_logs (
    id          SERIAL PRIMARY KEY,
    user_id     VARCHAR(255),
    ip_address  VARCHAR(50),
    city        VARCHAR(100),
    region      VARCHAR(100),
    country     VARCHAR(100),
    latitude    DECIMAL(10, 6),
    longitude   DECIMAL(10, 6),
    timezone    VARCHAR(100),
    device_info TEXT,
    status      VARCHAR(20),
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_login_logs_ip ON login_logs (ip_address);
  CREATE INDEX IF NOT EXISTS idx_user_tracking_ip ON user_tracking (ip_address);
  CREATE INDEX IF NOT EXISTS idx_login_activity_user ON login_activity (user_id);
`;

async function createTables() {
  console.log('[SETUP] Creating tables in Supabase...');
  console.log('[SETUP] URL:', SUPABASE_URL);

  try {
    // Supabase exposes a SQL endpoint via the management API
    // We'll use the pg endpoint through the REST SQL interface
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    // The REST API doesn't support raw SQL — we need to use the dashboard
    // Let's verify by trying to query the tables and report status
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const tables = ['user_tracking', 'login_activity', 'login_attempts', 'login_logs'];
    
    console.log('\n[SETUP] Checking table status:\n');
    for (const table of tables) {
      const { error } = await sb.from(table).select('id').limit(1);
      if (error) {
        console.log(`  ${table}: ❌ NOT FOUND`);
      } else {
        console.log(`  ${table}: ✅ EXISTS`);
      }
    }

    console.log('\n[SETUP] ⚠️  If tables are NOT FOUND, you need to run the SQL in Supabase Dashboard.');
    console.log('[SETUP] Go to: https://app.supabase.com → SQL Editor → paste the SQL from migration_report.md');
    console.log('\n[SETUP] Alternatively, copy the SQL below and run it in the SQL Editor:\n');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));

  } catch (err) {
    console.error('[SETUP] ❌ Error:', err.message);
  }
}

createTables();
