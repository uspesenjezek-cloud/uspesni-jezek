"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
var admission = require("../api/_lib/openregister-paid-admission");

function source(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

var userId = "00000000-0000-4000-8000-000000000101";
var profileId = "00000000-0000-4000-8000-000000000201";
var key = "00000000-0000-4000-8000-000000000301";
var lease = "00000000-0000-4000-8000-000000000401";

function options(overrides) {
  return Object.assign({
    userId: userId,
    profileId: profileId,
    idempotencyKey: key,
    action: "document_realtime",
    binding: "realtime-document:DE-HRB-7:current_printout",
    credits: 10,
    env: {
      BONITETA_OPENREGISTER_DAILY_CREDIT_LIMIT: "75",
      BONITETA_OPENREGISTER_CONCURRENT_LIMIT: "2",
    },
  }, overrides || {});
}

async function run() {
  assert.equal(admission.fingerprint({ action: "x", profileId: profileId, binding: "y", credits: 10 }).length, 64);
  assert.equal(admission.fingerprint({ action: "x", profileId: profileId, binding: "y", credits: 10 }), admission.fingerprint({ action: "x", profileId: profileId, binding: "y", credits: 10 }));
  assert.throws(function () { admission.normalizedKey("short"); }, function (error) { return error.code === "IDEMPOTENCY_KEY_REQUIRED" && error.status === 400; });
  assert.deepEqual(admission.limits({ BONITETA_OPENREGISTER_DAILY_CREDIT_LIMIT: "1", BONITETA_OPENREGISTER_CONCURRENT_LIMIT: "99" }), { dailyCredits: 25, concurrent: 4 });
  assert.deepEqual(admission.limits({ BONITETA_OPENREGISTER_DAILY_CREDIT_LIMIT: "no", BONITETA_OPENREGISTER_CONCURRENT_LIMIT: "no" }), { dailyCredits: 100, concurrent: 1 });

  var stored = null;
  var providerCalls = 0;
  var rpcCalls = [];
  async function durableRpc(name, payload) {
    rpcCalls.push({ name: name, payload: payload });
    if (name === "sprejmi_boniteta_openregister_zahtevo") {
      if (stored) return { action: "replay", httpStatus: stored.statusCode, responsePayload: stored.payload };
      return { action: "start", leaseToken: lease };
    }
    stored = { statusCode: payload.p_http_status, payload: payload.p_response_payload };
    return { ok: true };
  }
  var first = await admission.execute(options({ rpc: durableRpc }), async function () {
    providerCalls += 1;
    return { ok: true, document: { id: "doc-1" }, creditsUsed: 10 };
  });
  assert.equal(first.statusCode, 200);
  assert.equal(first.replayed, false);
  assert.equal(providerCalls, 1);
  assert.equal(rpcCalls[0].payload.p_daily_credit_limit, 75);
  assert.equal(rpcCalls[0].payload.p_concurrent_limit, 2);
  assert.match(rpcCalls[0].payload.p_fingerprint, /^[0-9a-f]{64}$/);

  var replay = await admission.execute(options({ rpc: durableRpc }), async function () {
    providerCalls += 1;
    throw new Error("provider must not run for a replay");
  });
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.payload, first.payload);
  assert.equal(providerCalls, 1, "zaključen odgovor mora biti predvajan brez novega nakupa");

  await assert.rejects(admission.execute(options({
    rpc: async function () {
      return { action: "reject", statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED", retryable: false, napaka: "conflict" };
    },
  }), async function () {
    throw new Error("provider must not run after conflict");
  }), function (error) {
    return error.code === "IDEMPOTENCY_KEY_REUSED" && error.status === 409 && error.retryable === false;
  });

  await assert.rejects(admission.execute(options({
    rpc: async function () {
      return { action: "reject", statusCode: 429, code: "PAID_ACTION_DAILY_QUOTA_EXCEEDED", retryable: false, napaka: "quota" };
    },
  }), async function () {
    throw new Error("provider must not run after quota rejection");
  }), function (error) {
    return error.code === "PAID_ACTION_DAILY_QUOTA_EXCEEDED" && error.status === 429;
  });

  var persistedFailure;
  var failed = await admission.execute(options({
    rpc: async function (name, payload) {
      if (name === "sprejmi_boniteta_openregister_zahtevo") return { action: "start", leaseToken: lease };
      persistedFailure = payload;
      return { ok: true };
    },
  }), async function () {
    throw Object.assign(new Error("Ponudnik je zavrnil zahtevo."), { status: 402, code: "OPENREGISTER_PLAN_REQUIRED" });
  });
  assert.equal(failed.statusCode, 402);
  assert.equal(failed.payload.code, "OPENREGISTER_PLAN_REQUIRED");
  assert.equal(persistedFailure.p_http_status, 402, "tudi neuspešen ponudnikov odziv mora postati trajno ponovljiv");

  await assert.rejects(admission.execute(options({
    rpc: async function (name) {
      if (name === "sprejmi_boniteta_openregister_zahtevo") return { action: "start", leaseToken: lease };
      throw new Error("database unavailable after provider response");
    },
  }), async function () {
    return { ok: true, creditsUsed: 10 };
  }), function (error) {
    return error.code === "PAID_ACTION_PERSISTENCE_UNCERTAIN" && error.retryable === false && error.status === 503;
  });

  var sql = source("supabase/migrations/20260830225030_boniteta_openregister_paid_admission.sql");
  assert.match(sql, /unique \(user_id, idempotency_key\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.boniteta_openregister_paid_requests from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.boniteta_openregister_paid_requests to service_role/i);
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /PAID_ACTION_DAILY_QUOTA_EXCEEDED/i);
  assert.match(sql, /PAID_ACTION_CONCURRENCY_LIMIT/i);
  assert.match(sql, /PAID_ACTION_RECOVERY_REQUIRED/i, "potekla negotova zahteva se ne sme skrito znova zagnati");
  assert.match(sql, /revoke all on function public\.sprejmi_boniteta_openregister_zahtevo[\s\S]*authenticated/i);
  assert.match(sql, /grant execute on function public\.sprejmi_boniteta_openregister_zahtevo[\s\S]*to service_role/i);

  var handler = source("api/_handlers/boniteta-pro.js");
  assert.match(handler, /paidAdmission\.execute/);
  ["company_lookup", "document", "document_realtime", "transparency_order"].forEach(function (action) {
    assert.match(handler, new RegExp('action === "' + action + '"[\\s\\S]{0,1200}paidOpenRegister'), action + " mora skozi trajni admission");
  });
  assert.match(handler, /sectionConfig[\s\S]{0,900}paidOpenRegister/, "tudi cache miss oziroma refresh sklopa mora skozi admission");

  console.log("OpenRegister paid admission/idempotency tests passed.");
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
