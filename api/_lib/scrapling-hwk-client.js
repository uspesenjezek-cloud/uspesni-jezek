"use strict";

var providerJson = require("./provider-json");

var RESPONSE_LIMIT_BYTES = 8 * 1024 * 1024;
var MAX_HTML_CHARS = 5 * 1024 * 1024;
var MAX_TEXT_CHARS = 1024 * 1024;
var MAX_BATCH_SIZE = 20;
var POSITIVE_TTL_MS = 10 * 60 * 1000;
var NEGATIVE_TTL_MS = 60 * 1000;
var cache = globalThis.__ujScraplingHwkCache || (globalThis.__ujScraplingHwkCache = new Map());
var inFlight = globalThis.__ujScraplingHwkInFlight || (globalThis.__ujScraplingHwkInFlight = new Map());
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

function normalizeResponse(payload) {
  if (!payload || typeof payload !== "object") return { status: "unavailable", reason: "invalid_response" };
  var status = String(payload.status || "");
  if (status === "robots_disallowed") return { status: status, reason: status, robots: payload.robots || null };
  if (status === "rate_limited") return { status: status, reason: status, httpStatus: 429 };
  if (status === "busy") return { status: status, reason: String(payload.reason || "queue_full") };
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

async function requestHwk(url, config) {
  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, 50000);
  try {
    var endpoint = new URL("/v1/hwk/fetch", config.url);
    var fetchFn = fetchImplementation || fetch;
    var response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + config.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ url: url, purpose: "public_hwk_directory" }),
      signal: controller.signal,
    });
    var payload = await providerJson.readJson(response, {
      maxBytes: RESPONSE_LIMIT_BYTES,
      code: "SCRAPLING_HWK_RESPONSE_TOO_LARGE",
      message: "Odgovor HWK storitve je prevelik.",
    });
    if (response.status === 429 || payload && payload.status === "rate_limited") {
      return { status: "rate_limited", reason: "rate_limited", httpStatus: 429 };
    }
    if (response.status === 503 && payload && payload.status === "busy") {
      return { status: "busy", reason: String(payload.reason || "queue_full") };
    }
    if (!response.ok) return { status: "unavailable", reason: "service_http_" + response.status };
    return normalizeResponse(payload);
  } catch (error) {
    return { status: "unavailable", reason: error && error.name === "AbortError" ? "timeout" : "service_unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHwk(url) {
  var config = settings();
  if (!config.enabled) return { status: config.reason, reason: config.reason };
  var key = cacheKey(url);
  var existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value;
  if (existing) cache.delete(key);
  if (inFlight.has(key)) return inFlight.get(key);
  var promise = requestHwk(url, config).then(function (result) {
    var cacheable = !["rate_limited", "busy", "unavailable"].includes(result.status);
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

async function fetchHwkBatch(urls) {
  if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAX_BATCH_SIZE) {
    return { status: "invalid_request", reason: "batch_size_must_be_1_to_20", results: [] };
  }
  var unique = Array.from(new Set(urls.map(String)));
  var values = await Promise.all(unique.map(fetchHwk));
  var byUrl = new Map(unique.map(function (url, index) { return [url, values[index]]; }));
  return { status: "completed", results: urls.map(function (url) { return byUrl.get(String(url)); }) };
}

function resetForTests() {
  cache.clear();
  inFlight.clear();
  fetchImplementation = null;
}

module.exports = {
  fetchHwk: fetchHwk,
  fetchHwkBatch: fetchHwkBatch,
  settings: settings,
  _test: {
    MAX_BATCH_SIZE: MAX_BATCH_SIZE,
    normalizeResponse: normalizeResponse,
    reset: resetForTests,
    setFetch: function (value) { fetchImplementation = value; },
  },
};
