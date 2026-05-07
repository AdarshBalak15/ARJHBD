// ─────────────────────────────────────────────────────────────────────────────
// netlify/functions/track.js — Production-Grade Visitor Tracking (Netlify)
//
// Same pipeline as api/track.js but using CommonJS for Netlify compatibility.
// ─────────────────────────────────────────────────────────────────────────────

const { extractIp, detectPlatform } = require("./utils/extractIp.cjs");
const { geoLookup } = require("./utils/geoLookup.cjs");
const { parseDevice } = require("./utils/deviceParser.cjs");
const { safeInsert } = require("./utils/dbInsert.cjs");

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };

  try {
    var t0 = Date.now();
    var platform = detectPlatform(event.headers);
    console.log("======== TRACK START (Netlify) ========");
    console.log("[TRACK] Platform:", platform);

    // ── 1. Env diagnostics ──
    var hasUrl = !!process.env.SUPABASE_URL;
    var hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log("[TRACK] ENV — SUPABASE_URL:", hasUrl, "| SERVICE_ROLE_KEY:", hasKey);

    if (!hasUrl || !hasKey) {
      console.error("[TRACK] ❌ Missing environment variables — cannot insert");
    }

    // ── 2. IP extraction (production-safe) ──
    var ipResult = extractIp(event.headers);
    var ip = ipResult.ip || null;

    if (!ip) {
      console.warn("[TRACK] ⚠️ Could not extract client IP");
      console.warn("[TRACK] Raw headers:", JSON.stringify(ipResult.raw));
    }

    // ── 3. Geo lookup (retry + multi-provider) ──
    var geo = await geoLookup(ip);
    console.log("[TRACK] Geo:", JSON.stringify({
      city: geo.city, country: geo.country,
      status: geo.lookup_status, source: geo.geo_source,
      failure: geo.failure_reason,
    }));

    // ── 4. Device parsing ──
    var userAgent = event.headers["user-agent"] || "unknown";
    var device = parseDevice(userAgent);

    // ── 5. Body ──
    var body = {};
    try { body = JSON.parse(event.body || "{}"); } catch (_e) { body = {}; }
    var userId = body.user_id || "visitor";
    var trigger = body.trigger || "page_load";
    var status = trigger === "unlock" ? "unlock" : "active";

    // ── 6. Build DB payload ──
    var insertData = {
      user_id: userId,
      ip_address: ip || "unknown",
      city: geo.city || "unknown",
      region: geo.region || "unknown",
      country: geo.country || "unknown",
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezone: geo.timezone || "unknown",
      isp: geo.isp || "unknown",
      org: geo.org || "unknown",
      device_info: userAgent.slice(0, 500),
      browser: device.browser,
      browser_version: device.browser_version,
      os: device.os,
      os_version: device.os_version,
      device_type: device.device_type,
      ip_type: ipResult.isPrivate ? "private" : "public",
      is_proxy: false,
      proxy_indicators: "",
      status: status,
    };

    console.log("[TRACK] Payload:", JSON.stringify(insertData));

    // ── 7. Insert with retry ──
    var dbResult = await safeInsert("user_tracking", insertData);

    // ── 8. Response ──
    var elapsed = Date.now() - t0;
    console.log("[TRACK] Result:", JSON.stringify({
      dbSuccess: dbResult.success, dbError: dbResult.error || null,
      attempts: dbResult.attempts, ms: elapsed,
    }));
    console.log("======== TRACK END ========");

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        tracked: dbResult.success,
        db_error: dbResult.success ? null : (dbResult.error || "unknown"),
        db_details: dbResult.success ? null : (dbResult.details || null),
        ip: ip || "unknown",
        city: geo.city || "unknown",
        region: geo.region || "unknown",
        country: geo.country || "unknown",
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezone || "unknown",
        device_info: userAgent.slice(0, 100),
        status: status,
        elapsed_ms: elapsed,
        platform: platform || "netlify",
        geo_source: geo.geo_source,
        lookup_status: geo.lookup_status,
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
