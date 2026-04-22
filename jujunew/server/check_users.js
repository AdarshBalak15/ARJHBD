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

  // 2. Login Activity (from /api/log-login and /api/unlock)
  const { data: logins } = await sb
    .from('login_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔓 LOGIN ACTIVITY (' + (logins?.length || 0) + ' records)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (!logins?.length) {
    console.log('  (empty)\n');
  } else {
    logins.forEach(r => {
      console.log(`  #${r.id} | User: ${r.user_id} | IP: ${r.ip_address}`);
      console.log(`       | ${r.city}, ${r.region}, ${r.country} | Status: ${r.status}`);
      console.log(`       | ${r.created_at}`);
      console.log('');
    });
  }

  // 3. Login Attempts (from /api/auth)
  const { data: attempts } = await sb
    .from('login_attempts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 LOGIN ATTEMPTS (' + (attempts?.length || 0) + ' records)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (!attempts?.length) {
    console.log('  (empty)\n');
  } else {
    attempts.forEach(r => {
      const icon = r.status === 'SUCCESS' ? '✅' : '❌';
      console.log(`  ${icon} #${r.id} | User: ${r.user_id} | IP: ${r.ip_address}`);
      console.log(`       | ${r.city}, ${r.region}, ${r.country} | ${r.status}`);
      console.log(`       | ${r.created_at}`);
      console.log('');
    });
  }

  // 4. Login Logs (from Netlify function)
  const { data: logs } = await sb
    .from('login_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 LOGIN LOGS - Netlify (' + (logs?.length || 0) + ' records)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (!logs?.length) {
    console.log('  (empty)\n');
  } else {
    logs.forEach(r => {
      const icon = r.status === 'SUCCESS' ? '✅' : '❌';
      console.log(`  ${icon} #${r.id} | User: ${r.user_id} | IP: ${r.ip_address}`);
      console.log(`       | ${r.city}, ${r.region}, ${r.country} | ${r.status}`);
      console.log(`       | Device: ${(r.device_info || '').slice(0, 80)}`);
      console.log(`       | ${r.created_at}`);
      console.log('');
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Done. Run anytime: node server/check_users.js');
}

checkUsers();
