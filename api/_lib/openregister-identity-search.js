"use strict";

var crypto = require("node:crypto");

var SEARCH_URL = "https://api.openregister.de/v0/search/company";
var WEB_URL = "https://openregister.de";
var CACHE_TTL_MS = 5 * 60 * 1000;
var PROOF_TTL_MS = 2 * 60 * 60 * 1000;
var cache = new Map();
var inFlight = new Map();

function clean(value, limit) {
  return String(value == null ? "" : value).trim().replace(/\s+/g, " ").slice(0, limit);
}

function normalizeQuery(value) {
  return clean(value, 160);
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
  var secret = String(process.env.OPENREGISTER_IDENTITY_PROOF_SECRET || process.env.OPENREGISTER_API_KEY || "").trim();
  if (!secret) {
    var err = new Error("OpenRegister strežniška konfiguracija manjka.");
    err.code = "OPENREGISTER_NOT_CONFIGURED";
    err.status = 503;
    throw err;
  }
  return secret;
}

function openRegisterApiKey() {
  var key = String(process.env.OPENREGISTER_API_KEY || "").trim();
  if (!key) {
    var err = new Error("OpenRegister strežniška konfiguracija manjka.");
    err.code = "OPENREGISTER_NOT_CONFIGURED";
    err.status = 503;
    throw err;
  }
  return key;
}

function compactAddress(value) {
  var address = value && typeof value === "object" ? value : {};
  return {
    street: clean(address.street || address.address, 160),
    postal_code: clean(address.postal_code || address.postalCode, 12),
    city: clean(address.city, 100),
  };
}

function compactCompany(value) {
  var company = value && typeof value === "object" ? value : {};
  return {
    company_id: clean(company.company_id || company.id, 140),
    name: clean(company.name && typeof company.name === "object" ? company.name.name : company.name, 240),
    register_type: clean(company.register_type, 12),
    register_number: clean(company.register_number, 60),
    register_court: clean(company.register_court, 120),
    legal_form: clean(company.legal_form, 80),
    active: company.active !== false,
    address: compactAddress(company.address),
  };
}

function signCompany(company, userId) {
  var payload = {
    v: 1,
    exp: Date.now() + PROOF_TTL_MS,
    uid: clean(userId, 80),
    company: compactCompany(company),
  };
  var encoded = base64url(JSON.stringify(payload));
  var signature = base64url(crypto.createHmac("sha256", signingSecret()).update(encoded).digest());
  return encoded + "." + signature;
}

function verifyCompanyProof(token, userId) {
  var parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  var expected = crypto.createHmac("sha256", signingSecret()).update(parts[0]).digest();
  var supplied;
  try { supplied = fromBase64url(parts[1]); } catch (_) { return null; }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  var payload;
  try { payload = JSON.parse(fromBase64url(parts[0]).toString("utf8")); } catch (_) { return null; }
  if (!payload || payload.v !== 1 || Number(payload.exp) < Date.now()) return null;
  if (clean(payload.uid, 80) !== clean(userId, 80)) return null;
  var company = compactCompany(payload.company);
  return company.company_id && company.name ? company : null;
}

function errorForStatus(status) {
  var err = new Error(status === 402
    ? "OpenRegister nima dovolj kreditov."
    : status === 429
      ? "OpenRegister je začasno omejil število zahtev."
      : "Podjetij trenutno ni mogoče poiskati.");
  err.status = status === 402 ? 402 : status === 429 ? 503 : 502;
  err.code = status === 402 ? "OPENREGISTER_CREDITS_EXHAUSTED" : status === 429 ? "OPENREGISTER_RATE_LIMITED" : "OPENREGISTER_SEARCH_FAILED";
  return err;
}

async function fetchOnce(query) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 12000);
  try {
    var url = new URL(SEARCH_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "10");
    var response = await fetch(url, {
      headers: {
        Authorization: "Bearer " + openRegisterApiKey(),
        Accept: "application/json",
        "User-Agent": "UspesniJezek/1.0 company-identity-search",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw errorForStatus(response.status);
    var data = await response.json();
    return (Array.isArray(data.results) ? data.results : []).map(compactCompany).filter(function (company) {
      return company.company_id && company.name;
    }).slice(0, 10);
  } catch (err) {
    if (err && (err.name === "AbortError" || err.name === "TimeoutError")) {
      var timeout = new Error("OpenRegister se ni odzval pravočasno.");
      timeout.status = 504;
      timeout.code = "OPENREGISTER_TIMEOUT";
      throw timeout;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function cachedResults(key) {
  var entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt >= CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.results.map(compactCompany);
}

async function search(queryValue, userId) {
  var query = normalizeQuery(queryValue);
  if (query.length < 3) {
    var short = new Error("Vnesite vsaj tri znake imena podjetja.");
    short.status = 400;
    short.code = "QUERY_TOO_SHORT";
    throw short;
  }
  var key = query.toLocaleLowerCase("de-DE");
  var results = cachedResults(key);
  var cached = Boolean(results);
  if (!results) {
    var request = inFlight.get(key);
    if (!request) {
      request = fetchOnce(query).then(function (fresh) {
        cache.set(key, { savedAt: Date.now(), results: fresh.map(compactCompany) });
        if (cache.size > 400) cache.delete(cache.keys().next().value);
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
      return Object.assign({}, compactCompany(company), {
        identity_proof: signCompany(company, userId),
        source: "openregister_verified_search",
      });
    }),
  };
}

function resetCache() {
  cache.clear();
  inFlight.clear();
}

module.exports = {
  SEARCH_URL: SEARCH_URL,
  WEB_URL: WEB_URL,
  search: search,
  signCompany: signCompany,
  verifyCompanyProof: verifyCompanyProof,
  compactCompany: compactCompany,
  resetCache: resetCache,
};
