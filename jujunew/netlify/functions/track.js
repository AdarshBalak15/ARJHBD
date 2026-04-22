const { createClient } = require("@supabase/supabase-js");

/**
 * Netlify Function: track
 * 
 * Automatically tracks every visitor — called on page load from frontend.
 * Extracts IP from Netlify headers, fetches geolocation, stores in Supabase.
 * 
 * Endpoint: /.netlify/functions/track  (POST or GET)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Client (persistent across warm invocations)
// ─────────────────────────────────────────────────────────────────────────────
let supabase = null;

function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    console.log("[TRACK] Supabase client created");
  }
  return supabase;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory geo cache (persists across warm Netlify invocations)
// ─────────────────────────────────────────────────────────────────────────────
const geoCache = new Map();
const GEO_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCachedGeo(ip) {
  const entry = geoCache.get(ip);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    geoCache.delete(ip);
    return null;
  }
  return entry.data;
}

function setCachedGeo(ip, data) {
  // Cap cache size at 200 entries
  if (geoCache.size >= 200) {
    const oldest = geoCache.keys().next().value;
    geoCache.delete(oldest);
  }
  geoCache.set(ip, { data, expiresAt: Date.now() + GEO_CACHE_TTL });
}

// ─────────────────────────────────────────────────────────────────────────────
// Geolocation fetcher with fallback
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGeoData(ip) {
  // Check cache first
  const cached = getCachedGeo(ip);
  if (cached) {
    console.log("[TRACK] Cache HIT for", ip);
    return { ...cached, source: "cache" };
  }

  const defaults = {
    city: "unknown",
    region: "unknown",
    country: "unknown",
    latitude: null,
    longitude: null,
    timezone: "unknown",
    source: "none",
  };

  // Primary: ipwho.is
  try {
    const res = await fetch(`https://ipwho.is/${ip}`, {
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();

    if (data && data.success !== false && data.city) {
      const result = {
        city: data.city || "unknown",
        region: data.region || "unknown",
        country: data.country || "unknown",
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        timezone:
          data.timezone && typeof data.timezone === "object"
            ? data.timezone.id || "unknown"
            : data.timezone || "unknown",
        source: "ipwho.is",
      };
      setCachedGeo(ip, result);
      return result;
    }
  } catch (err) {
    console.log("[TRACK] ipwho.is failed:", err.message);
  }

  // Fallback: ipapi.co
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json", "User-Agent": "node-tracker/1.0" },
    });
    const data = await res.json();

    if (data && !data.error) {
      const result = {
        city: data.city || "unknown",
        region: data.region || "unknown",
        country: data.country_name || "unknown",
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        timezone: data.timezone || "unknown",
        source: "ipapi.co",
      };
      setCachedGeo(ip, result);
      return result;
    }
  } catch (err) {
    console.log("[TRACK] ipapi.co failed:", err.message);
  }

  return defaults;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple UA parser
// ─────────────────────────────────────────────────────────────────────────────
function parseDevice(ua) {
  if (!ua) return { browser: "unknown", os: "unknown", device_type: "unknown" };

  let browser = "unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/CriOS/i.test(ua)) browser = "Chrome (iOS)";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua)) browser = "Safari";

  let os = "unknown";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|macOS/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let device_type = "desktop";
  if (/bot|crawl|spider/i.test(ua)) device_type = "bot";
  else if (/iPad|tablet/i.test(ua)) device_type = "tablet";
  else if (/Mobile|iPhone|iPod/i.test(ua)) device_type = "mobile";
  else if (/Android/i.test(ua) && !/Mobile/i.test(ua)) device_type = "tablet";

  return { browser, os, device_type };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 NETLIFY FUNCTION HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  // Allow both GET and POST
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    console.log("======== TRACK START ========");

    // 1️⃣  Extract IP
    let ip =
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["x-forwarded-for"] ||
      event.headers["client-ip"] ||
      "";

    if (ip.includes(",")) {
      ip = ip.split(",")[0].trim();
    }

    // Strip IPv6-mapped IPv4
    if (ip.startsWith("::ffff:")) {
      ip = ip.slice(7);
    }

    if (!ip || ip === "::1" || ip === "127.0.0.1") {
      ip = ""; // Let geo API detect server's public IP
    }

    console.log("[TRACK] IP:", ip || "(auto-detect)");

    // 2️⃣  Fetch geolocation
    const geo = await fetchGeoData(ip || "check");
    console.log("[TRACK] Geo:", JSON.stringify(geo));

    // 3️⃣  Parse device info
    const userAgent = event.headers["user-agent"] || "unknown";
    const device = parseDevice(userAgent);

    // 4️⃣  Insert into Supabase
    const db = getSupabase();
    let dbSuccess = false;

    if (db) {
      const insertData = {
        user_id: "visitor",
        ip_address: ip || "auto",
        city: geo.city,
        region: geo.region,
        country: geo.country,
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezone,
        isp: "unknown",
        org: "unknown",
        device_info: userAgent.slice(0, 500),
        browser: device.browser,
        browser_version: "unknown",
        os: device.os,
        os_version: "unknown",
        device_type: device.device_type,
        ip_type: "public",
        is_proxy: false,
        proxy_indicators: "",
        status: "active",
      };

      console.log("[TRACK] Inserting:", JSON.stringify(insertData));

      const { error } = await db.from("user_tracking").insert([insertData]);

      if (error) {
        console.error("[TRACK] ❌ Supabase insert error:", error.message);
      } else {
        dbSuccess = true;
        console.log("[TRACK] ✅ Insert SUCCESS");
      }
    } else {
      console.error("[TRACK] ❌ Supabase not initialized — check env vars");
    }

    console.log("======== TRACK END ========");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        tracked: dbSuccess,
        ip: ip || "auto",
        city: geo.city,
        region: geo.region,
        country: geo.country,
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezone,
        device_info: userAgent.slice(0, 100),
        status: "active",
      }),
    };
  } catch (error) {
    console.error("[TRACK] ❌ Unhandled error:", error.message, error.stack);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        tracked: false,
        error: "Tracking failed",
      }),
    };
  }
};
