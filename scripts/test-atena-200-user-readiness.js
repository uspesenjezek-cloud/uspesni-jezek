"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var policy = require("../api/_lib/atena-luna-policy");

function percentile(values, ratio) {
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function mockAdmission(maxActive) {
  var rows = new Map();
  var active = 0;
  var maxSeen = 0;
  var sequence = 0;
  return {
    rpc: async function (name, payload) {
      if (name === "atena_begin_ai_request") {
        var existing = rows.get(payload.p_request_key);
        if (existing) {
          if (existing.fingerprint !== payload.p_fingerprint) return { action: "conflict" };
          if (existing.status === "completed") return { action: "cached", httpStatus: existing.outcome.statusCode, payload: existing.outcome.payload };
          return { action: "in_progress", retryAfterMs: 500 };
        }
        if (active >= maxActive) return { action: "busy", retryAfterMs: 1500 };
        sequence += 1;
        var leaseToken = "00000000-0000-4000-8000-" + String(sequence).padStart(12, "0");
        rows.set(payload.p_request_key, { fingerprint: payload.p_fingerprint, status: "processing", leaseToken: leaseToken });
        active += 1;
        maxSeen = Math.max(maxSeen, active);
        return { action: "start", leaseToken: leaseToken };
      }
      if (name === "atena_finish_ai_request") {
        var row = rows.get(payload.p_request_key);
        if (!row || row.leaseToken !== payload.p_lease_token || row.fingerprint !== payload.p_fingerprint) return { ok: false };
        row.status = "completed";
        row.outcome = { statusCode: payload.p_http_status, payload: payload.p_payload };
        active -= 1;
        return { ok: true };
      }
      throw new Error("unexpected rpc");
    },
    active: function () { return active; },
    maxSeen: function () { return maxSeen; },
  };
}

function coordinator(admission, index, fingerprint) {
  return policy.createDistributedCoordinator({
    rpc: admission.rpc,
    key: "atena-v7:user-" + index + ":request-000000" + String(index).padStart(3, "0"),
    requestId: "request-000000" + String(index).padStart(3, "0"),
    kind: "history",
    contractVersion: "atena-v7-load-v1",
    fingerprint: fingerprint,
  });
}

async function twoHundredUniqueUsers() {
  var admission = mockAdmission(24);
  var release;
  var gate = new Promise(function (resolve) { release = resolve; });
  var started = [];
  var operations = 0;
  var requests = Array.from({ length: 200 }, function (_, index) {
    var startedAt = Date.now();
    var runtime = { users: new Map(), cache: new Map(), inflight: new Map() };
    var fingerprint = String(index + 1).padStart(64, "0");
    return policy.executeIdempotent(runtime, {
      key: "local:" + index,
      fingerprint: fingerprint,
      coordinator: coordinator(admission, index, fingerprint),
      fallbackMessage: "varna napaka",
    }, async function () {
      operations += 1;
      await gate;
      return { statusCode: 200, payload: { ok: true, user: index } };
    }).then(function (outcome) {
      started.push(Date.now() - startedAt);
      return outcome;
    });
  });

  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.equal(operations, 24, "ponudnik ne sme dobiti več kot 24 sočasnih AI-klicev");
  assert.equal(admission.active(), 24);
  release();
  var outcomes = await Promise.all(requests);
  assert.equal(outcomes.filter(function (item) { return item.statusCode === 200; }).length, 24);
  assert.equal(outcomes.filter(function (item) { return item.statusCode === 503 && item.payload.code === "AI_BUSY"; }).length, 176);
  assert.equal(admission.maxSeen(), 24);
  return started;
}

async function twoHundredCrossInstanceDuplicates() {
  var admission = mockAdmission(24);
  var release;
  var gate = new Promise(function (resolve) { release = resolve; });
  var operations = 0;
  var fingerprint = "a".repeat(64);
  var sharedCoordinator = policy.createDistributedCoordinator({
    rpc: admission.rpc,
    key: "atena-v7:shared-user:request-duplicate-0001",
    requestId: "request-duplicate-0001",
    kind: "goal",
    contractVersion: "atena-v7-load-v1",
    fingerprint: fingerprint,
  });
  var requests = Array.from({ length: 200 }, function () {
    return policy.executeIdempotent({ users: new Map(), cache: new Map(), inflight: new Map() }, {
      key: "same-local-key", fingerprint: fingerprint, coordinator: sharedCoordinator, fallbackMessage: "varna napaka",
    }, async function () {
      operations += 1;
      await gate;
      return { statusCode: 200, payload: { ok: true } };
    });
  });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.equal(operations, 1, "200 podvojenih zahtev čez več instanc sme sprožiti samo en AI-klic");
  release();
  var outcomes = await Promise.all(requests);
  assert.equal(outcomes.filter(function (item) { return item.statusCode === 200; }).length, 1);
  assert.equal(outcomes.filter(function (item) { return item.payload.code === "AI_REQUEST_IN_PROGRESS"; }).length, 199);
}

function migrationSecurityContract() {
  var migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260830133746_atena_distributed_admission_control.sql"), "utf8");
  assert.match(migration, /alter table public\.atena_ai_requests enable row level security/i);
  assert.match(migration, /revoke all on table public\.atena_ai_requests from public, anon, authenticated/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /auth\.uid\(\)/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /v_active_count >= 24/i);
  assert.match(migration, /v_user_count >= 12/i);
  assert.match(migration, /grant execute on function public\.atena_begin_ai_request[^;]+ to authenticated/is);
  assert.doesNotMatch(migration, /grant .*atena_ai_requests.* to (?:anon|authenticated)/i);
}

async function httpBurst(url) {
  if (!url) return null;
  var durations = [];
  var responses = await Promise.all(Array.from({ length: 200 }, async function () {
    var startedAt = Date.now();
    var response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    var body = await response.text();
    durations.push(Date.now() - startedAt);
    return { status: response.status, hasApp: /Izvedba|Uspešni Ježek/i.test(body), bytes: Buffer.byteLength(body) };
  }));
  assert.equal(responses.filter(function (item) { return item.status === 200 && item.hasApp && item.bytes > 1000; }).length, 200, "vseh 200 dejanskih HTTP zahtev mora dobiti veljavno aplikacijo");
  return durations;
}

async function main() {
  var startedAt = Date.now();
  migrationSecurityContract();
  var durations = await twoHundredUniqueUsers();
  await twoHundredCrossInstanceDuplicates();
  var urlArg = process.argv.find(function (arg) { return arg.indexOf("--url=") === 0; });
  var httpDurations = await httpBurst(urlArg ? urlArg.slice(6) : "");
  console.log(
    "Atena 200-user readiness PASS: 200 unique + 200 duplicate requests, provider concurrency max 24, " +
    "p50 " + percentile(durations, 0.50) + " ms, p95 " + percentile(durations, 0.95) + " ms, max " + Math.max.apply(null, durations) +
    " ms, total " + (Date.now() - startedAt) + " ms"
  );
  if (httpDurations) console.log("HTTP 200-user burst PASS: p50 " + percentile(httpDurations, 0.50) + " ms, p95 " + percentile(httpDurations, 0.95) + " ms, max " + Math.max.apply(null, httpDurations) + " ms");
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
