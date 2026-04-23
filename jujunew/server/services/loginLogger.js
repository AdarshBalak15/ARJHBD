import supabase from '../config/db.js';

/**
 * Reusable logger function for login attempts.
 * Inserts a record into the unified login_events table via Supabase.
 * Never crashes the main application if logging fails.
 *
 * @param {object} data — login event data
 * @param {string} [source='express'] — origin: 'express', 'netlify', or 'unlock'
 */
export async function logLoginAttempt(data, source = 'express') {
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
    anomaly_status,
    anomaly_reasons,
  } = data;

  try {
    const { error } = await supabase
      .from('login_events')
      .insert([{
        user_id:         user_id || 'UNKNOWN',
        ip_address:      ip_address || 'unknown',
        city:            city || 'unknown',
        region:          region || 'unknown',
        country:         country || 'unknown',
        latitude:        latitude != null ? Number(latitude) : null,
        longitude:       longitude != null ? Number(longitude) : null,
        timezone:        timezone || 'unknown',
        device_info:     device_info || 'unknown',
        status,          // 'SUCCESS' or 'FAILED'
        anomaly_status:  anomaly_status || 'normal',
        anomaly_reasons: anomaly_reasons || '',
        source,
      }]);

    if (error) {
      console.error(`[LOGIN LOGGER] ❌ Supabase insert failed:`, error.message);
      return false;
    }

    console.log(`[LOGIN LOGGER] ✅ Login event recorded: ${status} | source:${source} | user:${user_id || 'UNKNOWN'}`);
    return true;
  } catch (error) {
    // NEVER crash main app if logging fails
    console.error(`[LOGIN LOGGER] ❌ DB insert failed:`, error.message);
    return false;
  }
}
