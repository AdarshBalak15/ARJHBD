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
  } catch (err) {
    console.error('[DB] ❌ Connection / init error:', err.message);
    // Graceful — server still runs if DB is temporarily unavailable
  }
}

export default pool;
