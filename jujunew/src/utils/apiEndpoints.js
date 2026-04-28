// ─────────────────────────────────────────────────────────────────────────────
// src/utils/apiEndpoints.js — Platform-Aware API Routing
//
// Detects the deployment platform at BUILD TIME using environment variables
// set automatically by each platform:
//   • Vercel  → VERCEL=1
//   • Netlify → NETLIFY=true
//   • Local   → neither
//
// The platform is injected via vite.config.js `define` as __DEPLOY_TARGET__.
// This ensures the correct API endpoint is used regardless of custom domains.
// ─────────────────────────────────────────────────────────────────────────────

/* global __DEPLOY_TARGET__ */
const DEPLOY_TARGET =
  typeof __DEPLOY_TARGET__ !== 'undefined' ? __DEPLOY_TARGET__ : 'local';

/**
 * API endpoint map — resolves to the correct path based on platform.
 *
 * Vercel:  /api/login, /api/track
 * Netlify: /.netlify/functions/login, /.netlify/functions/track
 * Local:   /.netlify/functions/* (proxied to Express via vite.config.js)
 */
export const API = {
  login:
    DEPLOY_TARGET === 'vercel'
      ? '/api/login'
      : '/.netlify/functions/login',

  track:
    DEPLOY_TARGET === 'vercel'
      ? '/api/track'
      : '/.netlify/functions/track',
};

export default API;
