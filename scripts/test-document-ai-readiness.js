"use strict";

var assert = require("node:assert/strict");
var policy = require("../api/_lib/atena-luna-policy");
var documentAi = require("../api/citaj-racun");

function response(status, payload, headers) {
  return new Response(
    typeof payload === "string" ? payload : JSON.stringify(payload),
    { status: status, headers: Object.assign({ "content-type": "application/json" }, headers || {}) }
  );
}

function anthropicPayload(value) {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

async function anonymousRequestFailsClosed() {
  var previousUrl = process.env.SUPABASE_URL;
  var previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-public-key";
  var statusCode = 0;
  var payload = null;
  var headers = {};
  try {
    await documentAi({ method: "POST", headers: {}, body: {} }, {
      setHeader: function (name, value) { headers[name] = value; },
      status: function (status) { statusCode = status; return this; },
      json: function (body) { payload = body; return this; },
    });
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
  }
  assert.equal(statusCode, 401, "anonimni OCR klic mora fail-closed vrniti 401");
  assert.equal(payload && payload.code, "AUTH_TOKEN_MISSING");
  assert.equal(headers["Cache-Control"], "no-store");
}

async function transportContract() {
  var calls = 0;
  var retried = await documentAi._test.requestAnthropic("secret", {}, {
    timeoutMs: 2000,
    sleepImpl: async function () {},
    fetchImpl: async function () {
      calls += 1;
      return calls === 1
        ? response(429, {}, { "retry-after": "0" })
        : response(200, anthropicPayload({ naziv: "Primer d.o.o." }));
    },
  });
  assert.equal(calls, 2, "429 sme sprožiti največ en omejen ponovni poskus");
  assert.equal(retried.attempts, 2);

  calls = 0;
  await assert.rejects(documentAi._test.requestAnthropic("secret", {}, {
    timeoutMs: 2000,
    sleepImpl: async function () {},
    fetchImpl: async function () { calls += 1; return response(400, { error: "bad request" }); },
  }), function (error) {
    return error.code === "DOCUMENT_AI_PROVIDER_ERROR" && error.retryable === false && error.attempts === 1;
  });
  assert.equal(calls, 1, "nerešljiv 400 se ne sme ponoviti");

  var timeoutStarted = Date.now();
  await assert.rejects(documentAi._test.requestAnthropic("secret", {}, {
    timeoutMs: 80,
    sleepImpl: async function () {},
    fetchImpl: function (_url, options) {
      return new Promise(function (_resolve, reject) {
        options.signal.addEventListener("abort", function () {
          var error = new Error("provider detail");
          error.name = "AbortError";
          reject(error);
        });
      });
    },
  }), function (error) {
    return error.code === "DOCUMENT_AI_TIMEOUT" && error.retryable === true && !error.message.includes("provider detail");
  });
  assert.ok(Date.now() - timeoutStarted < 1000, "injicirani timeout ne sme čakati produkcijskih 30 sekund");

  await assert.rejects(documentAi._test.requestAnthropic("secret", {}, {
    timeoutMs: 2000,
    fetchImpl: async function () { return response(200, "to ni json"); },
  }), function (error) {
    return error.code === "DOCUMENT_AI_INVALID_RESPONSE" && error.retryable === false;
  });
  assert.throws(function () {
    documentAi._test.parseAnthropicPayload({ content: [{ text: "```json\n{\"naziv\":\n```" }] }, false);
  }, function (error) { return error.code === "DOCUMENT_AI_INVALID_RESPONSE" && error.retryable === false; });
}

function documentCoordinator(admission, key, requestId, fingerprint) {
  return policy.createDistributedCoordinator({
    rpc: admission.rpc,
    key: key,
    requestId: requestId,
    kind: "document",
    contractVersion: documentAi._test.DOCUMENT_AI_CONTRACT_VERSION,
    fingerprint: fingerprint,
    messages: { busy: "Dokumenti so zasedeni." },
  });
}

function mockAdmission(maxActive) {
  var rows = new Map();
  var active = 0;
  var maxSeen = 0;
  var sequence = 0;
  var finishedPayloads = [];
  return {
    rpc: async function (name, payload) {
      if (name === "atena_begin_ai_request") {
        var existing = rows.get(payload.p_request_key);
        if (existing) {
          if (existing.fingerprint !== payload.p_fingerprint) return { action: "conflict" };
          if (existing.status === "completed") return { action: "cached", httpStatus: existing.statusCode, payload: existing.payload };
          return { action: "in_progress", retryAfterMs: 250 };
        }
        if (active >= maxActive) return { action: "busy", retryAfterMs: 250 };
        sequence += 1;
        var leaseToken = "00000000-0000-4000-8000-" + String(sequence).padStart(12, "0");
        rows.set(payload.p_request_key, { fingerprint: payload.p_fingerprint, status: "processing", leaseToken: leaseToken });
        active += 1;
        maxSeen = Math.max(maxSeen, active);
        return { action: "start", leaseToken: leaseToken };
      }
      if (name === "atena_finish_ai_request") {
        var row = rows.get(payload.p_request_key);
        assert.ok(row && row.leaseToken === payload.p_lease_token);
        row.status = "completed";
        row.statusCode = payload.p_http_status;
        row.payload = payload.p_payload;
        finishedPayloads.push(payload.p_payload);
        active -= 1;
        return { ok: true };
      }
      throw new Error("unexpected RPC");
    },
    maxSeen: function () { return maxSeen; },
    finishedPayloads: finishedPayloads,
  };
}

async function duplicateAndPrivacyContract() {
  var sourceBase64 = "SOURCE_DOCUMENT_BASE64_DO_NOT_STORE_" + "x".repeat(128);
  var fingerprint = documentAi._test.requestFingerprint("image/jpeg", sourceBase64, "invoice");
  var runtime = { users: new Map(), cache: new Map(), inflight: new Map() };
  var admission = mockAdmission(24);
  var providerCalls = 0;
  var coordinator = documentCoordinator(admission, "document:user:request-duplicate-0001", "request-duplicate-0001", fingerprint);
  var body = documentAi._test.anthropicRequestBody("image/jpeg", sourceBase64, false);
  var requests = Array.from({ length: 200 }, function () {
    return policy.executeIdempotent(runtime, {
      key: "document:user:request-duplicate-0001",
      fingerprint: fingerprint,
      coordinator: coordinator,
      fallbackMessage: "varna napaka",
    }, async function () {
      providerCalls += 1;
      var providerResult = await documentAi._test.requestAnthropic("secret", body, {
        fetchImpl: async function () { return response(200, anthropicPayload({ naziv: "Primer d.o.o.", znesek: 12.5 })); },
      });
      var parsed = documentAi._test.parseAnthropicPayload(providerResult.payload, false);
      parsed.payload.requestId = "request-duplicate-0001";
      parsed.payload.attempts = providerResult.attempts;
      return parsed;
    });
  });
  var outcomes = await Promise.all(requests);
  assert.equal(providerCalls, 1, "200 identičnih OCR zahtev mora sprožiti natanko en provider klic");
  assert.equal(outcomes.filter(function (item) { return item.statusCode === 200; }).length, 200);
  var persisted = JSON.stringify({ cache: Array.from(runtime.cache.entries()), finished: admission.finishedPayloads });
  assert.doesNotMatch(persisted, /SOURCE_DOCUMENT_BASE64_DO_NOT_STORE/);
  assert.doesNotMatch(persisted, /source[^}]+base64/i);
}

async function uniqueAdmissionContract() {
  var admission = mockAdmission(24);
  var release;
  var gate = new Promise(function (resolve) { release = resolve; });
  var providerCalls = 0;
  var requests = Array.from({ length: 200 }, function (_, index) {
    var fingerprint = String(index + 1).padStart(64, "0");
    var requestId = "document-request-" + String(index).padStart(4, "0");
    var key = "document:user-" + index + ":" + requestId;
    return policy.executeIdempotent({ users: new Map(), cache: new Map(), inflight: new Map() }, {
      key: key,
      fingerprint: fingerprint,
      coordinator: documentCoordinator(admission, key, requestId, fingerprint),
      fallbackMessage: "varna napaka",
    }, async function () {
      providerCalls += 1;
      await gate;
      return { statusCode: 200, payload: { ok: true, requestId: requestId } };
    });
  });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.equal(providerCalls, 24, "document admission mora omejiti provider na 24 sočasnih klicev");
  release();
  var outcomes = await Promise.all(requests);
  assert.equal(outcomes.filter(function (item) { return item.statusCode === 200; }).length, 24);
  assert.equal(outcomes.filter(function (item) { return item.statusCode === 503 && item.payload.code === "AI_BUSY"; }).length, 176);
  assert.equal(admission.maxSeen(), 24);
}

async function main() {
  var startedAt = Date.now();
  assert.equal(documentAi._test.validRequestId("document:12345678"), true);
  ["", "short", " space-not-valid-0001", "document:too.long."].forEach(function (value) {
    assert.equal(documentAi._test.validRequestId(value), false, "neveljaven requestId: " + value);
  });
  await anonymousRequestFailsClosed();
  await transportContract();
  await duplicateAndPrivacyContract();
  await uniqueAdmissionContract();
  console.log("Document AI readiness PASS: auth, requestId, bounded retry/timeout, invalid JSON fail-closed, 200 duplicates = 1 provider call, 200 unique = max 24 in " + (Date.now() - startedAt) + " ms");
}

main().catch(function (error) { console.error(error && error.stack || error); process.exitCode = 1; });
