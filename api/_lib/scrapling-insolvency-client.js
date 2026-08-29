"use strict";

var providerJson = require("./provider-json");

var RESPONSE_LIMIT_BYTES = 64 * 1024;
var PREFLIGHT_TIMEOUT_MS = 5000;
var READY_TTL_MS = 5 * 60 * 1000;
var cache = globalThis.__ujScraplingInsolvencyPreflightCache ||
  (globalThis.__ujScraplingInsolvencyPreflightCache = new Map());
var inFlight = globalThis.__ujScraplingInsolvencyPreflightInFlight ||
  (globalThis.__ujScraplingInsolvencyPreflightInFlight = new Map());
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

function boundedRobots(value) {
  if (!value || typeof value !== "object") return null;
  return {
    url: String(value.url || "").slice(0, 500),
    status: value.status === null || value.status === undefined
      ? null
      : (Number.isFinite(Number(value.status)) ? Number(value.status) : null),
    allowed: value.allowed === true,
    reason: String(value.reason || "").slice(0, 80),
  };
}

function normalizirajOdgovor(payload) {
  if (!payload || typeof payload !== "object") {
    return { status: "unavailable", reason: "invalid_response" };
  }
  var status = String(payload.status || "");
  var common = {
    portalReachable: payload.portal_reachable === true,
    transactionReady: payload.transaction_ready === true,
    transactionMode: String(payload.transaction_mode || "").slice(0, 80),
    landingUrl: String(payload.landing_url || "").slice(0, 500),
    searchUrl: String(payload.search_url || "").slice(0, 500),
    landingRobots: boundedRobots(payload.landing_robots),
    searchRobots: boundedRobots(payload.search_robots),
    serviceVersion: String(payload.service_version || "").slice(0, 80),
  };
  if (status === "ready" && payload.ok === true && common.transactionReady && common.portalReachable) {
    return Object.assign({ status: "ready", reason: "" }, common);
  }
  return Object.assign({
    status: "unavailable",
    reason: String(payload.reason || status || "preflight_failed").slice(0, 80),
  }, common);
}

async function izvediPredpregled(config) {
  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, PREFLIGHT_TIMEOUT_MS);
  try {
    var endpoint = new URL("/v1/insolvency/preflight", config.url);
    var fetchFn = fetchImplementation || fetch;
    var response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + config.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ purpose: "official_insolvency_preflight" }),
      signal: controller.signal,
    });
    var payload = await providerJson.readJson(response, {
      maxBytes: RESPONSE_LIMIT_BYTES,
      code: "SCRAPLING_INSOLVENCY_RESPONSE_TOO_LARGE",
      message: "Odgovor Scrapling predpregleda je prevelik.",
    });
    if (!response.ok) {
      return { status: "unavailable", reason: "service_http_" + response.status };
    }
    return normalizirajOdgovor(payload);
  } catch (error) {
    return {
      status: "unavailable",
      reason: error && error.name === "AbortError" ? "timeout" : "service_unavailable",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function preflightOfficialInsolvencyPortal() {
  var config = settings();
  if (!config.enabled) return { status: "unavailable", reason: config.reason };
  var key = "official-insolvency-preflight";
  var existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value;
  if (existing) cache.delete(key);
  if (inFlight.has(key)) return inFlight.get(key);
  var promise = izvediPredpregled(config).then(function (result) {
    if (result.status === "ready") {
      cache.set(key, {
        value: result,
        expiresAt: Date.now() + READY_TTL_MS,
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
  preflightOfficialInsolvencyPortal: preflightOfficialInsolvencyPortal,
  settings: settings,
  _test: {
    normalizirajOdgovor: normalizirajOdgovor,
    reset: resetForTests,
    setFetch: function (value) { fetchImplementation = value; },
    timeoutMs: PREFLIGHT_TIMEOUT_MS,
  },
};
