"use strict";

var db = require("./supabase-server");

var QUERY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
var NEGATIVE_QUERY_TTL_MS = 15 * 60 * 1000;
var FAILED_TTL_MS = 5 * 60 * 1000;
var MAX_RESULTS = 8;
var MAX_CANDIDATES = 40;
var SEARCH_CACHE_VERSION = "v2-word-match";
var SEARCH_STOP_WORDS = new Set([
  "ag", "co", "das", "der", "die", "eg", "gbr", "gmbh", "gmbhco", "gmbh&co", "gmbhundco",
  "gnr", "hra", "hrb", "kg", "mbh", "ohg", "partg", "se", "ug", "und", "von", "zu",
]);

function clean(value, max) {
  return String(value == null ? "" : value).trim().replace(/\s+/g, " ").slice(0, max || 500);
}

function normalize(value) {
  return clean(value, 240).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE").replace(/[^a-z0-9]+/g, " ").trim();
}

function queryCacheKey(value) {
  var normalized = normalize(value);
  return normalized ? SEARCH_CACHE_VERSION + "|" + normalized : "";
}

function searchTokens(value) {
  var tokens = Array.from(new Set(normalize(value).split(" ").filter(function (token) {
    return token.length >= 2;
  })));
  var distinctive = tokens.filter(function (token) { return !SEARCH_STOP_WORDS.has(token); });
  return distinctive.length ? distinctive : tokens;
}

function candidateScore(company, query) {
  var wanted = normalize(query);
  var found = normalize(company && company.name);
  if (!wanted || !found) return -1;
  var allWantedTokens = Array.from(new Set(wanted.split(" ").filter(function (token) { return token.length >= 2; })));
  var importantTokens = searchTokens(query);
  var foundTokens = new Set(found.split(" "));
  if (importantTokens.some(function (token) { return !foundTokens.has(token); })) return -1;
  var matched = allWantedTokens.filter(function (token) { return foundTokens.has(token); }).length;
  var score = wanted === found ? 2000 : found.indexOf(wanted) >= 0 ? 1400 : 0;
  score += importantTokens.length * 250;
  score += allWantedTokens.length ? Math.round(500 * matched / allWantedTokens.length) : 0;
  var lastIndex = -1;
  var ordered = importantTokens.every(function (token) {
    var index = found.split(" ").indexOf(token, lastIndex + 1);
    if (index < 0) return false;
    lastIndex = index;
    return true;
  });
  if (ordered) score += 120;
  score -= Math.max(0, foundTokens.size - allWantedTokens.length) * 2;
  return score;
}

function safeSourceUrl(value) {
  try {
    var parsed = new URL(clean(value, 1000));
    return parsed.protocol === "https:" && /(^|\.)northdata\.com$/i.test(parsed.hostname) ? parsed.toString() : "";
  } catch (_) { return ""; }
}

function sanitizeResult(value) {
  var item = value && typeof value === "object" ? value : {};
  var name = clean(item.name || item.legal_name, 240);
  if (!name) return null;
  return {
    company_id: "",
    name: name,
    city: clean(item.city, 100),
    register_type: "",
    register_number: "",
    register_court: "",
    source_id: safeSourceUrl(item.source_id || item.source_url),
    source: "northdata_names",
  };
}

async function rest(cfg, path, options) {
  var opts = options || {};
  var extraHeaders = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  if (opts.accessToken) extraHeaders.Authorization = "Bearer " + clean(opts.accessToken, 5000);
  var response = await db.fetchZOmejitvijo(cfg.url + "/rest/v1/" + path, {
    method: opts.method || "GET",
    headers: db.serviceHeaders(cfg, extraHeaders),
    body: opts.body == null ? undefined : JSON.stringify(opts.body),
  }, 8000);
  var data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    var error = new Error("Skupnega imenika podjetij ni bilo mogoče uporabiti.");
    error.code = "COMPANY_DIRECTORY_FAILED";
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return Array.isArray(data) ? data : data || null;
}

async function findNames(cfg, query, options) {
  var term = normalize(query);
  if (term.length < 3) return [];
  var tokens = searchTokens(term).sort(function (a, b) { return b.length - a.length; }).slice(0, 3);
  var filters = tokens.map(function (token) { return "normalized_name.like.*" + token + "*"; });
  var tokenFilter = filters.length === 1
    ? "&normalized_name=like." + encodeURIComponent("*" + tokens[0] + "*")
    : "&and=" + encodeURIComponent("(" + filters.join(",") + ")");
  var rows = await rest(cfg, "company_name_directory?select=legal_name,city,source_url" + tokenFilter +
    "&order=last_seen_at.desc&limit=" + MAX_CANDIDATES, options);
  return (Array.isArray(rows) ? rows : []).map(sanitizeResult).filter(Boolean).map(function (company) {
    return { company: company, score: candidateScore(company, term) };
  }).filter(function (entry) { return entry.score >= 0; })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, MAX_RESULTS).map(function (entry) { return entry.company; });
}

async function getReadyQuery(cfg, query) {
  var key = queryCacheKey(query);
  if (!key) return null;
  var rows = await rest(cfg, "company_name_search_cache?select=results,searched_at,expires_at" +
    "&normalized_query=eq." + encodeURIComponent(key) + "&status=eq.ready" +
    "&expires_at=gt." + encodeURIComponent(new Date().toISOString()) + "&limit=1");
  if (!Array.isArray(rows) || !rows[0]) return null;
  var cachedResults = Array.isArray(rows[0].results) ? rows[0].results : [];
  var searchedAt = new Date(rows[0].searched_at || 0).getTime();
  if (!cachedResults.length && (!searchedAt || Date.now() - searchedAt >= NEGATIVE_QUERY_TTL_MS)) {
    await rest(cfg, "company_name_search_cache?normalized_query=eq." + encodeURIComponent(key), {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: { expires_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    });
    return null;
  }
  return {
    results: cachedResults.map(sanitizeResult).filter(Boolean).slice(0, MAX_RESULTS),
    searchedAt: rows[0].searched_at || "",
    expiresAt: rows[0].expires_at || "",
  };
}

async function claim(cfg, query) {
  return Boolean(await db.pokliciRpc(cfg, "claim_company_name_search", {
    p_normalized_query: queryCacheKey(query),
    p_display_query: clean(query, 120),
    p_lock_seconds: 45,
  }));
}

async function saveReady(cfg, query, results) {
  var now = new Date();
  var sanitized = (Array.isArray(results) ? results : []).map(sanitizeResult).filter(Boolean).slice(0, MAX_RESULTS);
  if (sanitized.length) {
    await rest(cfg, "company_name_directory?on_conflict=normalized_name,normalized_city", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: sanitized.map(function (company) {
        return {
          normalized_name: normalize(company.name),
          legal_name: company.name,
          normalized_city: normalize(company.city),
          city: company.city,
          source: "northdata_names",
          source_url: company.source_id || null,
          last_seen_at: now.toISOString(),
        };
      }),
    });
  }
  await rest(cfg, "company_name_search_cache?normalized_query=eq." + encodeURIComponent(queryCacheKey(query)), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: {
      status: "ready",
      results: sanitized,
      searched_at: now.toISOString(),
      expires_at: new Date(now.getTime() + (sanitized.length ? QUERY_TTL_MS : NEGATIVE_QUERY_TTL_MS)).toISOString(),
      lock_until: null,
      updated_at: now.toISOString(),
    },
  });
  return sanitized;
}

async function markFailed(cfg, query) {
  var now = new Date();
  await rest(cfg, "company_name_search_cache?normalized_query=eq." + encodeURIComponent(queryCacheKey(query)), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: {
      status: "failed",
      results: [],
      expires_at: new Date(now.getTime() + FAILED_TTL_MS).toISOString(),
      lock_until: null,
      updated_at: now.toISOString(),
    },
  });
}

function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

async function waitForReady(cfg, query, timeoutMs) {
  var until = Date.now() + Math.max(0, Number(timeoutMs) || 0);
  while (Date.now() < until) {
    await wait(400);
    var ready = await getReadyQuery(cfg, query);
    if (ready) return ready;
  }
  return null;
}

module.exports = {
  normalize: normalize,
  queryCacheKey: queryCacheKey,
  searchTokens: searchTokens,
  candidateScore: candidateScore,
  sanitizeResult: sanitizeResult,
  findNames: findNames,
  getReadyQuery: getReadyQuery,
  claim: claim,
  saveReady: saveReady,
  markFailed: markFailed,
  waitForReady: waitForReady,
  _test: { rest: rest },
};
