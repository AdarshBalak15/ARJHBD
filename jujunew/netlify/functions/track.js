const { createClient } = require("@supabase/supabase-js");

let supabase = null;
function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    console.log("[TRACK] Supabase client created");
  }
  return supabase;
}

const geoCache = new Map();
const GEO_CACHE_TTL = 10 * 60 * 1000;
function getCachedGeo(ip) { const e = geoCache.get(ip); if (!e) return null; if (Date.now() > e.expiresAt) { geoCache.delete(ip); return null; } return e.data; }
function setCachedGeo(ip, data) { if (geoCache.size >= 200) { geoCache.delete(geoCache.keys().next().value); } geoCache.set(ip, { data, expiresAt: Date.now() + GEO_CACHE_TTL }); }

async function fetchGeoData(ip) {
  const cached = getCachedGeo(ip);
  if (cached) { console.log("[TRACK] Cache HIT for", ip); return { ...cached, source: "cache" }; }
  const defaults = { city: "unknown", region: "unknown", country: "unknown", latitude: null, longitude: null, timezone: "unknown", source: "none" };

  try {
    const res = await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    if (data && data.success !== false && data.city) {
      const result = { city: data.city || "unknown", region: data.region || "unknown", country: data.country || "unknown", latitude: data.latitude || null, longitude: data.longitude || null, timezone: (data.timezone && typeof data.timezone === "object") ? (data.timezone.id || "unknown") : (data.timezone || "unknown"), source: "ipwho.is" };
      setCachedGeo(ip, result); return result;
    }
  } catch (err) { console.log("[TRACK] ipwho.is failed:", err.message); }

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(4000), headers: { Accept: "application/json", "User-Agent": "node-tracker/1.0" } });
    const data = await res.json();
    if (data && !data.error) {
      const result = { city: data.city || "unknown", region: data.region || "unknown", country: data.country_name || "unknown", latitude: data.latitude ?? null, longitude: data.longitude ?? null, timezone: data.timezone || "unknown", source: "ipapi.co" };
      setCachedGeo(ip, result); return result;
    }
  } catch (err) { console.log("[TRACK] ipapi.co failed:", err.message); }

  return defaults;
}

function parseDevice(ua) {
  if (!ua) return { browser: "unknown", os: "unknown", device_type: "unknown" };
  let browser = "unknown";
  if (/Edg\//i.test(ua)) browser = "Edge"; else if (/OPR\//i.test(ua)) browser = "Opera"; else if (/Firefox/i.test(ua)) browser = "Firefox"; else if (/CriOS/i.test(ua)) browser = "Chrome (iOS)"; else if (/Chrome/i.test(ua)) browser = "Chrome"; else if (/Safari/i.test(ua)) browser = "Safari";
  let os = "unknown";
  if (/Windows/i.test(ua)) os = "Windows"; else if (/Mac OS X|macOS/i.test(ua)) os = "macOS"; else if (/Android/i.test(ua)) os = "Android"; else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS"; else if (/Linux/i.test(ua)) os = "Linux";
  let device_type = "desktop";
  if (/bot|crawl|spider/i.test(ua)) device_type = "bot"; else if (/iPad|tablet/i.test(ua)) device_type = "tablet"; else if (/Mobile|iPhone|iPod/i.test(ua)) device_type = "mobile"; else if (/Android/i.test(ua) && !/Mobile/i.test(ua)) device_type = "tablet";
  return { browser, os, device_type };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resilient DB insert with retry + detailed diagnostics
// ─────────────────────────────────────────────────────────────────────────────
async function safeInsert(db, insertData, retries) {
  if (retries === undefined) retries = 3;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await db.from("user_tracking").insert([insertData]);

      if (error) {
        console.error("[TRACK] ❌ Insert attempt " + attempt + "/" + retries + " failed:", JSON.stringify({
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          status: error.status,
        }));

        // Don't retry on permission/schema errors — they won't self-resolve
        if (error.code === "42501" || (error.message && error.message.includes("row-level security"))) {
          console.error("[TRACK] ❌ RLS POLICY BLOCKING INSERT — run the RLS fix SQL in Supabase Dashboard");
          return { success: false, error: "RLS_BLOCKED", details: error.message };
        }
        if (error.code === "42703" || (error.message && error.message.includes("column"))) {
          console.error("[TRACK] ❌ SCHEMA MISMATCH — column missing or renamed");
          return { success: false, error: "SCHEMA_MISMATCH", details: error.message };
        }
        if (error.code === "23502") {
          console.error("[TRACK] ❌ NOT NULL VIOLATION — required column is null");
          return { success: false, error: "NULL_VIOLATION", details: error.message };
        }

        // Transient error — retry with backoff
        if (attempt < retries) {
          const delay = Math.min(500 * Math.pow(2, attempt - 1), 3000);
          console.log("[TRACK] ⏳ Retrying in " + delay + "ms...");
          await new Promise(function(r) { setTimeout(r, delay); });
          continue;
        }
        return { success: false, error: "INSERT_FAILED", details: error.message };
      }

      console.log("[TRACK] ✅ Insert OK (attempt " + attempt + ")");
      return { success: true, data: data };
    } catch (err) {
      console.error("[TRACK] ❌ Insert attempt " + attempt + "/" + retries + " exception:", err.message);
      if (attempt < retries) {
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 3000);
        await new Promise(function(r) { setTimeout(r, delay); });
      }
    }
  }
  return { success: false, error: "MAX_RETRIES_EXCEEDED" };
}

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };

  try {
    const t0 = Date.now();
    console.log("======== TRACK START (Netlify) ========");

    // 1. Env diagnostics
    const hasUrl = !!process.env.SUPABASE_URL;
    const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log("[TRACK] ENV — SUPABASE_URL:", hasUrl, "| SERVICE_ROLE_KEY:", hasKey);

    // 2. IP
    let ip = event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"] || event.headers["client-ip"] || "";
    if (ip.includes(",")) ip = ip.split(",")[0].trim();
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);
    if (!ip || ip === "::1" || ip === "127.0.0.1") ip = "";
    console.log("[TRACK] IP:", ip || "(auto-detect)");

    // 3. Geo
    const geo = await fetchGeoData(ip || "check");
    console.log("[TRACK] Geo:", JSON.stringify(geo));

    // 4. Device
    const userAgent = event.headers["user-agent"] || "unknown";
    const device = parseDevice(userAgent);

    // 5. Body
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch (_e) { body = {}; }
    const userId = body.user_id || "visitor";
    const trigger = body.trigger || "page_load";
    const status = trigger === "unlock" ? "unlock" : "active";

    // 6. DB insert with retry
    const db = getSupabase();
    let dbResult = { success: false, error: "NO_CLIENT" };

    if (db) {
      const insertData = {
        user_id: userId,
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
        status: status,
      };

      console.log("[TRACK] Payload:", JSON.stringify(insertData));
      dbResult = await safeInsert(db, insertData);
    } else {
      console.error("[TRACK] ❌ Supabase not initialized — SUPABASE_URL:", hasUrl, "| KEY:", hasKey);
    }

    const elapsed = Date.now() - t0;
    console.log("[TRACK] Result:", JSON.stringify(dbResult));
    console.log("[TRACK] Done in", elapsed, "ms");
    console.log("======== TRACK END ========");

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        tracked: dbResult.success,
        db_error: dbResult.success ? null : (dbResult.error || "unknown"),
        db_details: dbResult.success ? null : (dbResult.details || null),
        ip: ip || "auto",
        city: geo.city,
        region: geo.region,
        country: geo.country,
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezone,
        device_info: userAgent.slice(0, 100),
        status: status,
        elapsed_ms: elapsed,
        platform: "netlify",
      }),
    };
  } catch (error) {
    console.error("[TRACK] ❌ Unhandled:", error.message, error.stack);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        tracked: false,
        db_error: "UNHANDLED_EXCEPTION",
        db_details: error.message,
        error: "Tracking failed",
        platform: "netlify",
      }),
    };
  }
};
