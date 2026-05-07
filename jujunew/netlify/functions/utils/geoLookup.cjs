// ─────────────────────────────────────────────────────────────────────────────
// netlify/functions/utils/geoLookup.cjs — Production-Grade Geo Lookup (CJS)
//
// CommonJS mirror of api/utils/geoLookup.js for Netlify Functions.
// ─────────────────────────────────────────────────────────────────────────────

var geoCache = new Map();
var GEO_CACHE_TTL = 15 * 60 * 1000;
var GEO_CACHE_MAX = 300;

function getCached(ip) {
  var entry = geoCache.get(ip);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { geoCache.delete(ip); return null; }
  return entry.data;
}

function setCache(ip, data) {
  if (geoCache.size >= GEO_CACHE_MAX) {
    var oldest = geoCache.keys().next().value;
    geoCache.delete(oldest);
  }
  geoCache.set(ip, { data: data, expiresAt: Date.now() + GEO_CACHE_TTL });
}

function validateLat(val) {
  if (val == null || val === "") return null;
  var n = Number(val);
  if (isNaN(n) || n < -90 || n > 90) return null;
  return n;
}

function validateLon(val) {
  if (val == null || val === "") return null;
  var n = Number(val);
  if (isNaN(n) || n < -180 || n > 180) return null;
  return n;
}

function validateTimezone(val) {
  if (!val || typeof val !== "string") return null;
  if (/^[A-Z][a-zA-Z0-9_+-]+\/[A-Za-z0-9_+-/]+$/.test(val)) return val;
  if (val === "UTC" || val === "GMT") return val;
  return null;
}

function safeStr(val) {
  if (!val || typeof val !== "string" || val.trim() === "") return null;
  return val.trim();
}

var PROVIDERS = [
  {
    name: "ipwho.is",
    url: function (ip) { return "https://ipwho.is/" + ip; },
    timeout: 5000,
    headers: {},
    validate: function (data) { return data && data.success !== false && (data.city || data.country); },
    extract: function (data) {
      return {
        city: safeStr(data.city),
        region: safeStr(data.region),
        country: safeStr(data.country),
        latitude: validateLat(data.latitude),
        longitude: validateLon(data.longitude),
        timezone: (data.timezone && typeof data.timezone === "object")
          ? validateTimezone(data.timezone.id)
          : validateTimezone(data.timezone),
        isp: safeStr(data.connection && data.connection.isp),
        org: safeStr(data.connection && data.connection.org),
      };
    },
  },
  {
    name: "ipapi.co",
    url: function (ip) { return "https://ipapi.co/" + ip + "/json/"; },
    timeout: 5000,
    headers: { Accept: "application/json", "User-Agent": "node-tracker/2.0" },
    validate: function (data) { return data && !data.error && !data.reason && (data.city || data.country_name); },
    extract: function (data) {
      return {
        city: safeStr(data.city),
        region: safeStr(data.region),
        country: safeStr(data.country_name),
        latitude: validateLat(data.latitude),
        longitude: validateLon(data.longitude),
        timezone: validateTimezone(data.timezone),
        isp: safeStr(data.org),
        org: safeStr(data.org),
      };
    },
  },
  {
    name: "ip-api.com",
    url: function (ip) { return "http://ip-api.com/json/" + ip + "?fields=status,message,country,regionName,city,lat,lon,timezone,isp,org"; },
    timeout: 5000,
    headers: {},
    validate: function (data) { return data && data.status === "success"; },
    extract: function (data) {
      return {
        city: safeStr(data.city),
        region: safeStr(data.regionName),
        country: safeStr(data.country),
        latitude: validateLat(data.lat),
        longitude: validateLon(data.lon),
        timezone: validateTimezone(data.timezone),
        isp: safeStr(data.isp),
        org: safeStr(data.org),
      };
    },
  },
];

async function fetchWithRetry(url, headers, timeout, retries) {
  if (retries === undefined) retries = 2;
  for (var attempt = 1; attempt <= retries; attempt++) {
    try {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, timeout);
      var res = await fetch(url, { headers: headers, signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        console.log("[GEO] HTTP " + res.status + " from " + url + " (attempt " + attempt + "/" + retries + ")");
        if (res.status === 429) { console.log("[GEO] Rate limited — skipping provider"); return null; }
        if (attempt < retries) { await new Promise(function (r) { setTimeout(r, 500 * attempt); }); continue; }
        return null;
      }
      return await res.json();
    } catch (err) {
      var reason = err.name === "AbortError" ? "timeout" : err.message;
      console.log("[GEO] Fetch failed: " + url + " — " + reason + " (attempt " + attempt + "/" + retries + ")");
      if (attempt < retries) { await new Promise(function (r) { setTimeout(r, 500 * attempt); }); }
    }
  }
  return null;
}

async function geoLookup(ip) {
  var defaults = {
    city: null, region: null, country: null,
    latitude: null, longitude: null, timezone: null,
    isp: null, org: null,
    lookup_status: "failed", failure_reason: null,
    geo_source: "none", geo_raw: null,
  };

  if (!ip || ip === "check" || ip === "auto") {
    console.log("[GEO] ⚠️ No valid IP for geo lookup");
    return Object.assign({}, defaults, { failure_reason: "no_valid_ip" });
  }

  var cached = getCached(ip);
  if (cached) {
    console.log("[GEO] Cache HIT for", ip);
    return Object.assign({}, cached, { geo_source: "cache", lookup_status: "success", failure_reason: null });
  }

  var errors = [];

  for (var i = 0; i < PROVIDERS.length; i++) {
    var provider = PROVIDERS[i];
    try {
      var url = provider.url(ip);
      console.log("[GEO] Trying " + provider.name + ": " + url);

      var rawData = await fetchWithRetry(url, provider.headers, provider.timeout);
      if (!rawData) { errors.push(provider.name + ": no_response"); continue; }
      if (!provider.validate(rawData)) {
        errors.push(provider.name + ": invalid_response");
        console.log("[GEO] " + provider.name + " returned invalid data:", JSON.stringify(rawData).slice(0, 300));
        continue;
      }

      var extracted = provider.extract(rawData);
      var hasLocation = !!(extracted.city || extracted.country);
      var hasCoords = extracted.latitude !== null && extracted.longitude !== null;
      var hasTz = extracted.timezone !== null;

      var lookup_status = "success";
      var failure_reason = null;

      if (!hasLocation && !hasCoords) { errors.push(provider.name + ": no_location_data"); continue; }
      if (!hasLocation || !hasCoords || !hasTz) {
        lookup_status = "partial";
        var missing = [];
        if (!hasLocation) missing.push("location");
        if (!hasCoords) missing.push("coordinates");
        if (!hasTz) missing.push("timezone");
        failure_reason = "partial: missing " + missing.join(", ");
      }

      var result = Object.assign({}, extracted, {
        lookup_status: lookup_status,
        failure_reason: failure_reason,
        geo_source: provider.name,
        geo_raw: rawData,
      });

      setCache(ip, result);
      console.log("[GEO] ✅ Success from", provider.name, JSON.stringify({
        city: result.city, country: result.country,
        lat: result.latitude, lon: result.longitude,
        tz: result.timezone, status: lookup_status,
      }));
      return result;
    } catch (err) {
      errors.push(provider.name + ": " + err.message);
      console.error("[GEO] ❌ " + provider.name + " exception:", err.message);
    }
  }

  var failureReason = errors.join(" | ");
  console.error("[GEO] ❌ All providers failed:", failureReason);
  return Object.assign({}, defaults, { failure_reason: failureReason });
}

module.exports = { geoLookup: geoLookup };
