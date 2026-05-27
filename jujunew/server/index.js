import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDB } from './config/db.js';
import { validateEnv } from './utils/envValidator.js';
import unlockRouter    from './routes/logUnlock.js';  // server-side geo
import logLoginRouter  from './routes/logLogin.js';   // frontend-fed data
import authRouter      from './routes/auth.js';        // true login controller
import trackUserRouter from './routes/trackUser.js';   // IP-based user tracking
import { trackUserRateLimiter, loginRateLimiter } from './middleware/rateLimiter.js';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Environment Validation ────────────────────────────────────────────────
// Validates all required/optional env vars at startup (never logs secrets)
validateEnv();

// Trust proxy — real client IP behind Vite proxy / nginx / CDN / cloud
app.set('trust proxy', true);

// ── Security Hardening ────────────────────────────────────────────────────
// Suppress X-Powered-By header to reduce fingerprinting surface
app.disable('x-powered-by');

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173', // Vite dev
    'http://localhost:4173', // Vite preview
    /\.vercel\.app$/,       // All Vercel preview/production URLs
    /\.netlify\.app$/,      // All Netlify preview/production URLs
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}));

// Limit request body size to prevent abuse (100KB max)
app.use(express.json({ limit: '100kb' }));

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/unlock',     unlockRouter);                          // server-side geo (backup route)
app.use('/api/log-login',  logLoginRouter);                        // PRIMARY: frontend sends all data
app.use('/api/auth',       loginRateLimiter, authRouter);           // LOGIN CONTROLLER (rate-limited)
app.use('/api/track-user', trackUserRateLimiter, trackUserRouter); // IP metadata tracker (rate-limited)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Test Email Route (protected — only available in development) ──────────
// SECURITY: This route is disabled in production to prevent abuse.
if (process.env.NODE_ENV !== 'production') {
  const { sendAlertEmail } = await import('./services/mailService.js');
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
  console.log('[SERVER] ℹ️  /api/test-email enabled (dev mode only)');
}

// ── Start AFTER DB init ───────────────────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[SERVER] 🚀 Express running → http://localhost:${PORT}`);
      console.log(`[SERVER] 📌 Routes:`);
      console.log(`         POST /api/log-login   — primary tracking endpoint`);
      console.log(`         POST /api/unlock      — server-side geo fallback`);
      console.log(`         POST /api/track-user  — IP metadata tracker`);
      console.log(`         GET  /api/track-user  — IP metadata tracker (GET)`);
      console.log(`         GET  /api/health      — health check`);
    });
  })
  .catch((err) => {
    console.error('[SERVER] ❌ Failed to initialize DB:', err.message);
    // Start server anyway — some routes may work without DB
    app.listen(PORT, () => {
      console.log(`[SERVER] 🚀 Express running (DB init failed) → http://localhost:${PORT}`);
    });
  });
