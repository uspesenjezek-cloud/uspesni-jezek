"use strict";

var providerJson = require("./provider-json");

var MAX_HTML_CHARS = 5 * 1024 * 1024;
var MAX_TEXT_CHARS = 1024 * 1024;
var RESPONSE_LIMIT_BYTES = 8 * 1024 * 1024;
var POSITIVE_TTL_MS = 15 * 60 * 1000;
var NEGATIVE_TTL_MS = 2 * 60 * 1000;
var REQUEST_TIMEOUT_MS = 8000;
var cache = globalThis.__ujScraplingImpressumCache || (globalThis.__ujScraplingImpressumCache = new Map());
var inFlight = globalThis.__ujScraplingImpressumInFlight || (globalThis.__ujScraplingImpressumInFlight = new Map());
var fetchImplementation = null;

function settings() {
  var rawUrl = String(process.env.SCRAPLING_IMPRESSUM_URL || "").trim();
  var token = String(process.env.SCRAPLING_IMPRESSUM_TOKEN || "").trim();
  if (!rawUrl || !token) return { enabled: false, reason: "not_configured" };
  if (token.length < 32) return { enabled: false, reason: "invalid_configuration" };
  var url;
  try { url = new URL(rawUrl); } catch (_) { return { enabled: false, reason: "invalid_configuration" }; }
  var loopback = /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    return { enabled: false, reason: "invalid_configuration" };
  }
  if (url.username || url.password || url.search || url.hash) {
    return { enabled: false, reason: "invalid_configuration" };
  }
  return { enabled: true, url: url, token: token };
}

function cacheKey(url) {
  try {
    var parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch (_) {
    return String(url || "");
  }
}

function normalizirajOdgovor(payload) {
  if (!payload || typeof payload !== "object") return { status: "unavailable", reason: "invalid_response" };
  var status = String(payload.status || "");
  if (status === "robots_disallowed") return { status: status, reason: status, robots: payload.robots || null };
  if (status === "rate_limited") return { status: status, reason: status, httpStatus: 429 };
  if (status !== "fetched" || payload.ok !== true) {
    return { status: "unavailable", reason: String(payload.reason || status || "fetch_failed") };
  }
  var html = String(payload.html || "");
  var text = String(payload.text || "");
  var finalUrl = String(payload.final_url || "");
  if (!/^https?:\/\//i.test(finalUrl) || html.length > MAX_HTML_CHARS || text.length > MAX_TEXT_CHARS) {
    return { status: "unavailable", reason: "invalid_response" };
  }
  return {
    status: "found",
    html: html,
    text: text,
    finalUrl: finalUrl,
    mode: payload.mode === "dynamic" ? "dynamic" : "static",
    httpStatus: Number(payload.http_status) || 200,
    robots: payload.robots || null,
  };
}

async function izvediZajem(url, config) {
  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
  try {
    var endpoint = new URL("/v1/impressum/fetch", config.url);
    var fetchFn = fetchImplementation || fetch;
    var response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + config.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ url: url, purpose: "legal_impressum_fallback" }),
      signal: controller.signal,
    });
    var payload = await providerJson.readJson(response, {
      maxBytes: RESPONSE_LIMIT_BYTES,
      code: "SCRAPLING_RESPONSE_TOO_LARGE",
      message: "Odgovor Scrapling storitve je prevelik.",
    });
    if (response.status === 429 || payload && payload.status === "rate_limited") {
      return { status: "rate_limited", reason: "rate_limited", httpStatus: 429 };
    }
    if (!response.ok) return { status: "unavailable", reason: "service_http_" + response.status };
    return normalizirajOdgovor(payload);
  } catch (error) {
    return { status: "unavailable", reason: error && error.name === "AbortError" ? "timeout" : "service_unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchImpressum(url) {
  var config = settings();
  if (!config.enabled) return { status: config.reason, reason: config.reason };
  var key = cacheKey(url);
  var existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value;
  if (existing) cache.delete(key);
  if (inFlight.has(key)) return inFlight.get(key);
  var promise = izvediZajem(url, config).then(function (result) {
    var cacheable = result.status !== "rate_limited" && result.status !== "unavailable";
    if (cacheable) {
      cache.set(key, {
        value: result,
        expiresAt: Date.now() + (result.status === "found" ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
      });
    }
    return result;
  }).finally(function () { inFlight.delete(key); });
  inFlight.set(key, promise);
  return promise;
}

function resetForTests() {
  cache.clear();
  inFlight.clear();
  fetchImplementation = null;
}

module.exports = {
  fetchImpressum: fetchImpressum,
  settings: settings,
  _test: {
    normalizirajOdgovor: normalizirajOdgovor,
    reset: resetForTests,
    setFetch: function (value) { fetchImplementation = value; },
    timeoutMs: REQUEST_TIMEOUT_MS,
  },
};
