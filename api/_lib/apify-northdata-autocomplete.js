"use strict";

var crypto = require("node:crypto");
var fs = require("node:fs");
var path = require("node:path");

var ACTOR_ID = "Ja65ilbhWnUTs1Xeb";
var API_ROOT = "https://api.apify.com/v2";
var NORTH_DATA_ROOT = "https://www.northdata.com/";
var MAX_RESULTS = 3;
var MAX_TOTAL_CHARGE_USD = 0.02;
var TIMEOUT_SECONDS = 30;
var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
var PROOF_TTL_MS = 30 * 24 * 60 * 60 * 1000;
var cache = new Map();
var inFlight = new Map();
var LOCAL_CACHE_VERSION = 2;
var MAX_LOCAL_ENTRIES = 1000;
var NEGATIVE_CACHE_TTL_MS = 15 * 60 * 1000;

function clean(value, max) {
  return String(value == null ? "" : value).trim().replace(/\s+/g, " ").slice(0, max || 500);
}

function normalizeQuery(value) {
  return clean(value, 120);
}

function cacheKey(value) {
  return normalizeQuery(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE").replace(/[^a-z0-9]+/g, " ").trim();
}

function base64url(value) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64url(value) {
  var normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  return Buffer.from(normalized, "base64");
}

function signingSecret() {
  var secret = clean(process.env.NORTHDATA_SUGGESTION_PROOF_SECRET || process.env.OPENREGISTER_IDENTITY_PROOF_SECRET ||
    process.env.OPENREGISTER_API_KEY || process.env.APIFY_API_TOKEN, 5000);
  if (!secret) throw errorForStatus(401);
  return secret;
}

function signSuggestion(company, userId) {
  var payload = {
    v: 1,
    exp: Date.now() + PROOF_TTL_MS,
    uid: clean(userId, 100),
    company: { name: clean(company && company.name, 240), city: clean(company && company.city, 100) },
  };
  var encoded = base64url(JSON.stringify(payload));
  var signature = base64url(crypto.createHmac("sha256", signingSecret()).update(encoded).digest());
  return encoded + "." + signature;
}

function verifySuggestionProof(token, userId) {
  var parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  var expected = crypto.createHmac("sha256", signingSecret()).update(parts[0]).digest();
  var supplied;
  try { supplied = fromBase64url(parts[1]); } catch (_) { return null; }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  var payload;
  try { payload = JSON.parse(fromBase64url(parts[0]).toString("utf8")); } catch (_) { return null; }
  if (!payload || payload.v !== 1 || Number(payload.exp) < Date.now()) return null;
  if (clean(payload.uid, 100) !== clean(userId, 100)) return null;
  var company = payload.company && typeof payload.company === "object" ? payload.company : {};
  var name = clean(company.name, 240);
  return name ? { name: name, city: clean(company.city, 100), source: "northdata_names" } : null;
}

function safeNorthDataUrl(value) {
  try {
    var url = new URL(clean(value, 1000));
    return url.protocol === "https:" && /(^|\.)northdata\.com$/i.test(url.hostname) ? url.toString() : "";
  } catch (_) { return ""; }
}

function localCacheEnabled(options) {
  return Boolean(options && options.cacheFile) || process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE === "true";
}

function localCacheFile(options) {
  return clean(options && options.cacheFile, 2000) || clean(process.env.NORTHDATA_NAME_CACHE_FILE, 2000) ||
    path.join(process.cwd(), ".cache", "northdata-name-search-cache.json");
}

function readLocalCache(options) {
  if (!localCacheEnabled(options)) return { version: LOCAL_CACHE_VERSION, entries: {} };
  try {
    var parsed = JSON.parse(fs.readFileSync(localCacheFile(options), "utf8"));
    return parsed && parsed.version === LOCAL_CACHE_VERSION && parsed.entries && typeof parsed.entries === "object"
      ? parsed : { version: LOCAL_CACHE_VERSION, entries: {} };
  } catch (_) { return { version: LOCAL_CACHE_VERSION, entries: {} }; }
}

function writeLocalCache(store, options) {
  if (!localCacheEnabled(options)) return;
  try {
    var target = localCacheFile(options);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    var temporary = target + "." + process.pid + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(store), "utf8");
    fs.renameSync(temporary, target);
  } catch (_) {
    // Predpomnilnik je optimizacija; njegova napaka ne sme ustaviti iskanja.
  }
}

function compactResult(value) {
  var item = value && typeof value === "object" ? value : {};
  var name = clean(item.name || item.companyName || item.legalName, 240);
  if (!name) return null;
  var country = clean(item.country || item.countryCode, 30).toUpperCase();
  if (country && !/^(DE|DEU|GERMANY|DEUTSCHLAND)$/.test(country)) return null;
  return {
    company_id: "",
    name: name,
    city: clean(item.city || item.location, 100),
    register_type: "",
    register_number: "",
    register_court: "",
    source_id: safeNorthDataUrl(item.profileUrl || item.url || item.source_id || item.source_url),
    source: "northdata_names",
  };
}

function errorForStatus(status) {
  var error = new Error(status === 401 || status === 403
    ? "North Data povezava ni nastavljena."
    : status === 402
      ? "North Data dobroimetje trenutno ni na voljo."
      : status === 429
        ? "North Data je začasno omejil iskanje."
        : "Novejših imen podjetij trenutno ni mogoče poiskati.");
  error.status = status === 401 || status === 403 ? 503 : status === 402 ? 402 : status === 429 ? 503 : 502;
  error.code = status === 401 || status === 403 ? "NORTHDATA_NOT_CONFIGURED"
    : status === 402 ? "NORTHDATA_PAYMENT_REQUIRED"
      : status === 429 ? "NORTHDATA_RATE_LIMITED" : "NORTHDATA_SEARCH_FAILED";
  return error;
}

async function fetchOnce(query, options) {
  var opts = options || {};
  var token = clean(opts.token != null ? opts.token : process.env.APIFY_API_TOKEN, 5000);
  if (!token) throw errorForStatus(401);
  var fetchImpl = opts.fetch || global.fetch;
  if (typeof fetchImpl !== "function") throw errorForStatus(503);
  var url = API_ROOT + "/acts/" + ACTOR_ID + "/run-sync-get-dataset-items" +
    "?timeout=" + TIMEOUT_SECONDS + "&memory=256&maxItems=" + MAX_RESULTS +
    "&maxTotalChargeUsd=" + MAX_TOTAL_CHARGE_USD + "&clean=1";
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, (TIMEOUT_SECONDS + 5) * 1000);
  try {
    // Plačljivega actorja namenoma nikoli ne ponovimo samodejno.
    var response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        searchQueries: [query], country: "DE", resultType: "companies",
        includeFinancials: false, includeOfficers: false, includeRelatedCompanies: false,
        includeEvents: false, includeNews: false, maxResults: MAX_RESULTS,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw errorForStatus(response.status);
    var items = await response.json();
    var unique = new Map();
    (Array.isArray(items) ? items : []).map(compactResult).filter(Boolean).forEach(function (company) {
      var key = cacheKey(company.name) + "|" + cacheKey(company.city);
      if (key && !unique.has(key)) unique.set(key, company);
    });
    return Array.from(unique.values()).slice(0, MAX_RESULTS);
  } catch (error) {
    if (error && error.name === "AbortError") {
      var timeout = new Error("North Data se ni odzval pravočasno.");
      timeout.status = 504;
      timeout.code = "NORTHDATA_TIMEOUT";
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function cachedResults(key, options) {
  var entry = cache.get(key);
  if (!entry && localCacheEnabled(options)) {
    var store = readLocalCache(options);
    entry = store.entries[key] || null;
    if (entry) cache.set(key, entry);
  }
  if (!entry) return null;
  var ttl = Array.isArray(entry.results) && entry.results.length ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
  if (Date.now() - entry.savedAt >= ttl) {
    cache.delete(key);
    return null;
  }
  return entry.results.map(function (company) { return Object.assign({}, company); });
}

function saveResults(key, results, options) {
  var entry = { savedAt: Date.now(), results: results.map(function (company) { return Object.assign({}, company); }) };
  cache.set(key, entry);
  if (cache.size > MAX_LOCAL_ENTRIES) cache.delete(cache.keys().next().value);
  if (!localCacheEnabled(options)) return;
  var store = readLocalCache(options);
  store.entries[key] = entry;
  var keys = Object.keys(store.entries);
  if (keys.length > MAX_LOCAL_ENTRIES) {
    keys.sort(function (a, b) { return Number(store.entries[a].savedAt || 0) - Number(store.entries[b].savedAt || 0); })
      .slice(0, keys.length - MAX_LOCAL_ENTRIES).forEach(function (oldKey) { delete store.entries[oldKey]; });
  }
  writeLocalCache(store, options);
}

function storedSearchResult(results, userId) {
  var unique = new Map();
  (Array.isArray(results) ? results : []).map(compactResult).filter(Boolean).forEach(function (company) {
    var key = cacheKey(company.name) + "|" + cacheKey(company.city);
    if (key && !unique.has(key)) unique.set(key, company);
  });
  return {
    cached: true,
    results: Array.from(unique.values()).slice(0, MAX_RESULTS).map(function (company) {
      return Object.assign({}, company, { suggestion_proof: signSuggestion(company, userId) });
    }),
    estimatedCostUsd: 0,
    sourceUrl: NORTH_DATA_ROOT,
  };
}

async function search(queryValue, userId, options) {
  var query = normalizeQuery(queryValue);
  if (query.length < 3) {
    var short = new Error("Vnesite vsaj tri znake imena podjetja.");
    short.status = 400;
    short.code = "QUERY_TOO_SHORT";
    throw short;
  }
  var key = cacheKey(query);
  var results = cachedResults(key, options);
  var cached = Boolean(results);
  if (!results) {
    var request = inFlight.get(key);
    if (!request) {
      request = fetchOnce(query, options).then(function (fresh) {
        saveResults(key, fresh, options);
        return fresh;
      });
      inFlight.set(key, request);
    } else {
      cached = true;
    }
    try { results = await request; }
    finally { if (inFlight.get(key) === request) inFlight.delete(key); }
  }
  return {
    cached: cached,
    results: results.map(function (company) {
      return Object.assign({}, company, { suggestion_proof: signSuggestion(company, userId) });
    }),
    estimatedCostUsd: cached ? 0 : Number((0.00005 + results.length * 0.004).toFixed(6)),
    sourceUrl: NORTH_DATA_ROOT,
  };
}

function resetCache() {
  cache.clear();
  inFlight.clear();
}

module.exports = {
  ACTOR_ID: ACTOR_ID,
  NORTH_DATA_ROOT: NORTH_DATA_ROOT,
  MAX_RESULTS: MAX_RESULTS,
  MAX_TOTAL_CHARGE_USD: MAX_TOTAL_CHARGE_USD,
  compactResult: compactResult,
  signSuggestion: signSuggestion,
  verifySuggestionProof: verifySuggestionProof,
  storedSearchResult: storedSearchResult,
  search: search,
  resetCache: resetCache,
  _test: { readLocalCache: readLocalCache },
};
