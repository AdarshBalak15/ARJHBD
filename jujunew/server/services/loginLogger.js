import pool from '../config/db.js';

/**
 * Reusable logger function for login attempts
 * Inserts a record into the login_attempts table.
 * Never crashes the main application if logging fails.
 */
export async function logLoginAttempt(data) {
  const {
    user_id,
    ip_address,
    city,
    region,
    country,
    latitude,
    longitude,
    timezone,
    device_info,
    status,
  } = data;

  try {
    const query = `
      INSERT INTO login_attempts
        (user_id, ip_address, city, region, country, latitude, longitude, timezone, device_info, status)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;

    const values = [
      user_id || 'UNKNOWN',
      ip_address || 'unknown',
      city || 'unknown',
      region || 'unknown',
      country || 'unknown',
      latitude != null ? Number(latitude) : null,
      longitude != null ? Number(longitude) : null,
      timezone || 'unknown',
      device_info || 'unknown',
      status // 'SUCCESS' or 'FAILED'
    ];

    await pool.query(query, values);
    console.log(`[LOGIN LOGGER] Login attempt recorded: ${status} (User: ${user_id || 'UNKNOWN'})`);
    return true;
  } catch (error) {
    // NEVER crash main app if logging fails
    console.error(`[LOGIN LOGGER] ❌ DB insert failed:`, error.message);
    return false;
  }
}

/*
  -- SQL Query to create the table if it does not exist:
  
  CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    ip_address VARCHAR(50),
    city VARCHAR(100),
    region VARCHAR(100),
    country VARCHAR(100),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    timezone VARCHAR(100),
    device_info TEXT,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
*/
