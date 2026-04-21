import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// ─────────────────────────────────────────────────────────────────────────────
// Connection pool
// ─────────────────────────────────────────────────────────────────────────────
const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port:     Number(process.env.DB_PORT),
  max:      10,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 2000,
});

// ─────────────────────────────────────────────────────────────────────────────
// initDB — connection test + auto-create / migrate table on startup
// ─────────────────────────────────────────────────────────────────────────────
export async function initDB() {
  try {
    const { rows } = await pool.query('SELECT NOW()');
    console.log('[DB] ✅ PostgreSQL connected at:', rows[0].now);

    // Create table if it doesn't exist (includes status column)
    await pool.query(`
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
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Safe migration — adds status column if table already existed without it
    await pool.query(`
      ALTER TABLE login_activity
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'normal';
    `);

    console.log('[DB] ✅ Table "login_activity" is ready (with status column).');

    // ── user_tracking table — used by /api/track-user ──────────────────────
    await pool.query(`
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
        created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('[DB] ✅ Table "user_tracking" is ready.');

    // ── login_attempts table — used by /api/auth ───────────────────────────
    await pool.query(`
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
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('[DB] ✅ Table "login_attempts" is ready.');
  } catch (err) {
    console.error('[DB] ❌ Connection / init error:', err.message);
    // Graceful — server still runs if DB is temporarily unavailable
  }
}

export default pool;
