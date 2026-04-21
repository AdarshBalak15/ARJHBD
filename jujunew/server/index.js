import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDB } from './config/db.js';
import unlockRouter    from './routes/logUnlock.js';  // server-side geo
import logLoginRouter  from './routes/logLogin.js';   // frontend-fed data
import authRouter      from './routes/auth.js';        // true login controller
import trackUserRouter from './routes/trackUser.js';   // IP-based user tracking
import { trackUserRateLimiter } from './middleware/rateLimiter.js';

const app  = express();
const PORT = process.env.PORT || 3001;

// Trust proxy — real client IP behind Vite proxy / nginx / CDN / cloud
app.set('trust proxy', true);

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173', // Vite dev
    'http://localhost:4173', // Vite preview
  ],
  methods: ['GET', 'POST'],
}));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/unlock',     unlockRouter);                          // server-side geo (backup route)
app.use('/api/log-login',  logLoginRouter);                        // PRIMARY: frontend sends all data
app.use('/api/auth',       authRouter);                            // LOGIN CONTROLLER
app.use('/api/track-user', trackUserRateLimiter, trackUserRouter); // IP metadata tracker (rate-limited)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Test Email Route
import { sendAlertEmail } from './services/mailService.js';
app.get('/api/test-email', async (req, res) => {
  try {
    const success = await sendAlertEmail({
      user_id: 'test_user_123',
      ip_address: '127.0.0.1',
      city: 'Test City',
      region: 'Test Region',
      country: 'Test Country',
      latitude: '0.000',
      longitude: '0.000',
      timezone: 'UTC',
      device_info: 'Test Device/Browser',
      created_at: new Date().toISOString(),
    });
    
    if (success) {
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Test email failed to send' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Start AFTER DB init ───────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[SERVER] 🚀 Express running → http://localhost:${PORT}`);
    console.log(`[SERVER] 📌 Routes:`);
    console.log(`         POST /api/log-login   — primary tracking endpoint`);
    console.log(`         POST /api/unlock      — server-side geo fallback`);
    console.log(`         POST /api/track-user  — IP metadata tracker`);
    console.log(`         GET  /api/track-user  — IP metadata tracker (GET)`);
    console.log(`         GET  /api/health      — health check`);
  });
});
