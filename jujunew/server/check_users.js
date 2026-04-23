import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUsers() {
  console.log('\n🔍 Checking all user access data...\n');

  // 1. User Tracking (from /api/track-user)
  const { data: tracking } = await sb
    .from('user_tracking')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 USER TRACKING (' + (tracking?.length || 0) + ' records)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (!tracking?.length) {
    console.log('  (empty)\n');
  } else {
    tracking.forEach(r => {
      console.log(`  #${r.id} | ${r.ip_address} | ${r.city}, ${r.region}, ${r.country}`);
      console.log(`       | ${r.browser} on ${r.os} (${r.device_type})`);
      console.log(`       | Proxy: ${r.is_proxy} | Status: ${r.status} | ${r.created_at}`);
      console.log('');
    });
  }

  // 2. Login Events (unified — replaces login_activity, login_attempts, login_logs)
  const { data: events } = await sb
    .from('login_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 LOGIN EVENTS (' + (events?.length || 0) + ' records)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (!events?.length) {
    console.log('  (empty)\n');
  } else {
    events.forEach(r => {
      const icon = r.status === 'SUCCESS' ? '✅' : '❌';
      const anomaly = r.anomaly_status === 'suspicious' ? ' 🚨 SUSPICIOUS' : '';
      console.log(`  ${icon} #${r.id} | User: ${r.user_id} | IP: ${r.ip_address} | Source: ${r.source}`);
      console.log(`       | ${r.city}, ${r.region}, ${r.country} | ${r.status}${anomaly}`);
      if (r.anomaly_reasons) {
        console.log(`       | Anomaly: ${r.anomaly_reasons}`);
      }
      console.log(`       | ${r.created_at}`);
      console.log('');
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Done. Run anytime: node server/check_users.js');
}

checkUsers();
