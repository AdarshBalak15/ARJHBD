// ─────────────────────────────────────────────────────────────────────────────
// netlify/functions/utils/dbInsert.cjs — Resilient Supabase Insert (CJS)
//
// CommonJS mirror of api/utils/dbInsert.js for Netlify Functions.
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require("@supabase/supabase-js");

let supabase = null;

function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    console.log("[DB] Supabase client initialized");
  }
  return supabase;
}

const NON_RETRIABLE = new Set([
  "42501", "42703", "42P01", "23502", "23505", "22P02",
]);

function classifyError(error) {
  if (!error) return "UNKNOWN";
  var code = error.code || "";
  var msg = (error.message || "").toLowerCase();

  if (code === "42501" || msg.includes("row-level security")) return "RLS_BLOCKED";
  if (code === "42703" || msg.includes("column")) return "SCHEMA_MISMATCH";
  if (code === "42P01" || msg.includes("does not exist")) return "TABLE_NOT_FOUND";
  if (code === "23502") return "NULL_VIOLATION";
  if (code === "23505") return "DUPLICATE";
  if (code === "22P02") return "INVALID_INPUT";
  if (msg.includes("timeout") || msg.includes("ECONNREFUSED")) return "CONNECTION_ERROR";
  return "INSERT_FAILED";
}

function sanitize(val) {
  if (val === "" || val === undefined) return null;
  if (val === "unknown") return "unknown";
  return val;
}

async function safeInsert(table, data, options) {
  if (!options) options = {};
  var retries = options.retries || 3;
  var baseDelay = options.baseDelay || 500;

  var db = getSupabase();
  if (!db) {
    var reason = !process.env.SUPABASE_URL ? "SUPABASE_URL missing" :
                 !process.env.SUPABASE_SERVICE_ROLE_KEY ? "SUPABASE_SERVICE_ROLE_KEY missing" :
                 "Unknown initialization failure";
    console.error("[DB] ❌ Client not initialized:", reason);
    return { success: false, error: "NO_CLIENT", details: reason, attempts: 0 };
  }

  var sanitized = {};
  var keys = Object.keys(data);
  for (var k = 0; k < keys.length; k++) {
    sanitized[keys[k]] = sanitize(data[keys[k]]);
  }

  for (var attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log("[DB] Insert attempt " + attempt + "/" + retries + " into " + table);
      var result = await db.from(table).insert([sanitized]);
      var insertData = result.data;
      var error = result.error;

      if (error) {
        var errorType = classifyError(error);
        console.error("[DB] ❌ Attempt " + attempt + "/" + retries + " — " + errorType + ":", JSON.stringify({
          message: error.message, code: error.code, details: error.details, hint: error.hint,
        }));

        if (NON_RETRIABLE.has(error.code)) {
          return { success: false, error: errorType, details: error.message, attempts: attempt };
        }

        if (attempt < retries) {
          var delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 4000);
          console.log("[DB] ⏳ Retrying in " + delay + "ms...");
          await new Promise(function (r) { setTimeout(r, delay); });
          continue;
        }
        return { success: false, error: errorType, details: error.message, attempts: attempt };
      }

      console.log("[DB] ✅ Insert into " + table + " OK (attempt " + attempt + ")");
      return { success: true, attempts: attempt };
    } catch (err) {
      console.error("[DB] ❌ Attempt " + attempt + "/" + retries + " exception:", err.message);
      if (attempt < retries) {
        var d = Math.min(baseDelay * Math.pow(2, attempt - 1), 4000);
        await new Promise(function (r) { setTimeout(r, d); });
      }
    }
  }

  return { success: false, error: "MAX_RETRIES_EXCEEDED", details: "Failed after " + retries + " attempts", attempts: retries };
}

module.exports = { getSupabase: getSupabase, safeInsert: safeInsert };
