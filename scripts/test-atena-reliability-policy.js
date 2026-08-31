"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");
var policy = require("../api/_lib/atena-luna-policy");
var history = require("../api/_lib/zgodovina-naravni-vnos");
var agreement = require("../api/_lib/dogovor-naravni-vnos");
var goal = require("../api/_lib/cilj-naravni-vnos");

function response(status, payload, retryAfter) {
  return {
    ok: status >= 200 && status < 300, status: status,
    headers: { get: function (name) { return name === "retry-after" ? retryAfter || null : null; } },
    json: async function () { return payload == null ? {} : payload; },
  };
}

function percentile(values, ratio) {
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function transportFaults() {
  var calls = 0;
  await assert.rejects(policy.requestOpenAi({ apiKey: "x", body: "{}", timeoutMs: 2000, sleepImpl: async function () {}, randomImpl: function () { return 0; }, fetchImpl: async function () {
    calls += 1; var error = new Error("getaddrinfo ENOTFOUND secret-host"); error.code = "ENOTFOUND"; throw error;
  } }), function (error) { return error.code === "LUNA_UNAVAILABLE" && error.retryable === true && error.attempts === 2 && !error.message.includes("secret-host"); });
  assert.equal(calls, 2, "DNS/network napaka mora uporabiti omejen retry");

  calls = 0;
  await assert.rejects(policy.requestOpenAi({ apiKey: "x", body: "{}", timeoutMs: 2000, sleepImpl: async function () {}, fetchImpl: async function () {
    calls += 1; var error = new Error("aborted"); error.name = "AbortError"; throw error;
  } }), function (error) { return error.code === "LUNA_TIMEOUT" && error.retryable === true && error.attempts === 2; });
  assert.equal(calls, 2);

  calls = 0;
  var limited = await policy.requestOpenAi({ apiKey: "x", body: "{}", timeoutMs: 2000, sleepImpl: async function () {}, fetchImpl: async function () {
    calls += 1; return calls === 1 ? response(429, {}, "0") : response(200, { output_text: "{}" });
  } });
  assert.equal(limited.attempts, 2);

  calls = 0;
  var provider = await policy.requestOpenAi({ apiKey: "x", body: "{}", timeoutMs: 2000, sleepImpl: async function () {}, fetchImpl: async function () {
    calls += 1; return calls === 1 ? response(503, {}) : response(200, { output_text: "{}" });
  } });
  assert.equal(provider.attempts, 2);

  calls = 0;
  await assert.rejects(policy.requestOpenAi({ apiKey: "x", body: "{}", timeoutMs: 2000, sleepImpl: async function () {}, fetchImpl: async function () {
    calls += 1; return response(400, {});
  } }), function (error) { return error.code === "LUNA_PROVIDER_REJECTED" && error.retryable === false && error.attempts === 1; });
  assert.equal(calls, 1, "nerešljiv 4xx se ne sme ponavljati");

  var rateLimitedError = new Error("Luna je trenutno preobremenjena.");
  rateLimitedError.code = "LUNA_RATE_LIMITED";
  rateLimitedError.status = 503;
  rateLimitedError.retryable = true;
  rateLimitedError.retryAfterMs = 4321;
  assert.equal(policy.errorOutcome(rateLimitedError, "Varna napaka.").payload.retryAfterMs, 4321, "Retry-After se mora ohraniti do odjemalca");

  var timeoutDurations = [];
  for (var timeoutIndex = 0; timeoutIndex < 5; timeoutIndex += 1) {
    var timeoutStarted = Date.now();
    await assert.rejects(policy.requestOpenAi({ apiKey: "x", body: "{}", timeoutMs: 100, fetchImpl: function (_url, options) {
      return new Promise(function (_resolve, reject) { options.signal.addEventListener("abort", function () { var error = new Error("aborted"); error.name = "AbortError"; reject(error); }); });
    } }), function (error) { return error.code === "LUNA_TIMEOUT" && error.retryable === true; });
    timeoutDurations.push(Date.now() - timeoutStarted);
  }
  console.log("Timeout fallback: p50 " + percentile(timeoutDurations, 0.5) + " ms, p95 " + percentile(timeoutDurations, 0.95) + " ms, max " + Math.max.apply(null, timeoutDurations) + " ms");
}

async function malformedAndEvidenceFaults() {
  var malformed = async function () { return response(200, { output_text: "{" }); };
  await assert.rejects(agreement.analyze("rekel je, da bo plačal", { originalDebt: 434, remainingDebt: 434 }, { apiKey: "x", fetchImpl: malformed }), function (error) { return error.code === "LUNA_INVALID_AGREEMENT_PLAN" && error.retryable !== true; });
  await assert.rejects(goal.analyze("hočem plačilo", { remainingDebt: 434 }, { apiKey: "x", fetchImpl: malformed }), function (error) { return error.code === "LUNA_INVALID_GOAL_PLAN" && error.retryable !== true; });
  var blockedHistory = await history.analyze("plačal je 100 EUR", { referenceDate: "2026-08-30", originalDebt: 434, remainingDebt: 434 }, { apiKey: "x", fetchImpl: malformed });
  assert.equal(blockedHistory.semanticPlan.status, "FAILED");
  assert.equal(blockedHistory.candidates.length, 0);
  var emptyHistory = await history.analyze("plačal je 100 EUR", { referenceDate: "2026-08-30", originalDebt: 434, remainingDebt: 434 }, { apiKey: "x", fetchImpl: async function () { return response(200, { output_text: "" }); } });
  assert.equal(emptyHistory.semanticPlan.reason, "luna_compact_invalid_json");

  var source = "hočem celotno plačilo";
  var cardId = goal._test.cardIdByGoal.full_payment;
  var fieldId = goal._test.fieldIdByKey.targetAmount;
  var exactField = goal._test.materialize({ p: [{ n: 1, c: cardId, k: 1, e: source, f: [{ i: fieldId, v: "434", o: null, e: "celotno plačilo" }] }], q: null, x: source }, { remainingDebt: 434 }, source);
  assert.equal(exactField.length, 1, "vsak dobesedni dokaz mora preživeti strogo mejo");
  var paraphrasedField = goal._test.materialize({ p: [{ n: 1, c: cardId, k: 1, e: source, f: [{ i: fieldId, v: "434", o: null, e: "celotni dolg" }] }], q: null, x: source }, { remainingDebt: 434 }, source);
  assert.equal(paraphrasedField, null, "parafraziran field evidence mora fail-closed");
  var unlinked = goal._test.materialize({ p: [{ n: 1, c: cardId, k: 1, e: "izmišljeno", f: [{ i: fieldId, v: "434", o: null, e: "tudi izmišljeno" }] }], q: null, x: source }, { remainingDebt: 434 }, source);
  assert.equal(unlinked, null, "popolnoma nepovezan evidence mora fail-closed");
  assert.equal(policy.evidenceIsLinked(source, "HOČEM"), false, "dokaz mora biti res dobeseden, ne le normalizirano podoben");
  assert.throws(function () {
    policy.assertPortableResponseSchema({ type: "array", maxItems: 2, uniqueItems: true, items: { type: "string" } });
  }, function (error) { return error.code === "ATENA_UNSUPPORTED_RESPONSE_SCHEMA_KEY"; });
  await assert.rejects(policy.requestOpenAi({ apiKey: "x", body: "x".repeat(policy.MAX_REQUEST_BODY_BYTES + 1), fetchImpl: async function () {
    throw new Error("fetch se ne sme izvesti");
  } }), function (error) { return error.code === "LUNA_INVALID_REQUEST" && error.retryable === false; });
}

async function idempotencyAndConcurrency() {
  var runtime = { cache: new Map(), inflight: new Map() };
  var operations = 0;
  var release;
  var gate = new Promise(function (resolve) { release = resolve; });
  function execute(fingerprint) {
    return policy.executeIdempotent(runtime, { key: "history:user:req-00000001", fingerprint: fingerprint, fallbackMessage: "varno" }, async function () {
      operations += 1; await gate; return { statusCode: 200, payload: { ok: true, requestId: "req-00000001", value: 1 } };
    });
  }
  var first = execute("same-content");
  var duplicate = execute("same-content");
  var conflict = await execute("different-content");
  assert.equal(conflict.statusCode, 409);
  release();
  var outcomes = await Promise.all([first, duplicate]);
  assert.equal(operations, 1, "sočasna enaka requestId/vsebina mora deliti en klic");
  assert.deepEqual(outcomes[0], outcomes[1]);
  assert.deepEqual(await execute("same-content"), outcomes[0], "končan rezultat mora biti deterministično ponovljiv");

  var failedOperations = 0;
  async function failedExecute() {
    return policy.executeIdempotent(runtime, { key: "goal:user:req-00000002", fingerprint: "same-failure", fallbackMessage: "Varna ponovljiva napaka." }, async function () {
      failedOperations += 1; throw new Error("upstream secret detail");
    });
  }
  var firstFailure = await failedExecute();
  var repeatedFailure = await failedExecute();
  assert.equal(failedOperations, 1);
  assert.deepEqual(repeatedFailure, firstFailure);
  assert.equal(firstFailure.payload.napaka, "Varna ponovljiva napaka.");
  assert.doesNotMatch(JSON.stringify(firstFailure), /secret detail/);

  var transientOperations = 0;
  async function transientExecute() {
    return policy.executeIdempotent(runtime, { key: "goal:user:req-00000003", fingerprint: "same-transient", fallbackMessage: "Začasna napaka." }, async function () {
      transientOperations += 1;
      if (transientOperations === 1) {
        var transientError = new Error("Luna trenutno ni dosegljiva.");
        transientError.code = "LUNA_UNAVAILABLE";
        transientError.status = 503;
        transientError.retryable = true;
        throw transientError;
      }
      return { statusCode: 200, payload: { ok: true, requestId: "req-00000003" } };
    });
  }
  var transientFailure = await transientExecute();
  var recoveredOutcome = await transientExecute();
  var cachedRecovery = await transientExecute();
  assert.equal(transientFailure.statusCode, 503);
  assert.equal(transientFailure.payload.retryable, true);
  assert.equal(transientOperations, 2, "retryable rezultat se ne sme predvajati iz idempotency cachea");
  assert.equal(recoveredOutcome.statusCode, 200);
  assert.deepEqual(cachedRecovery, recoveredOutcome, "uspešen ponovni poskus mora ostati cachean");

  var distributedRuntime = { cache: new Map(), inflight: new Map() };
  var distributedOperations = 0;
  var finishedOutcomes = [];
  var coordinator = {
    begin: async function () { return { leaseToken: "00000000-0000-4000-8000-000000000001" }; },
    finish: async function (_leaseToken, outcome) { finishedOutcomes.push(outcome); },
  };
  async function distributedExecute() {
    return policy.executeIdempotent(distributedRuntime, { key: "history:user:req-00000004", fingerprint: "same-distributed-transient", fallbackMessage: "Začasna napaka.", coordinator: coordinator }, async function () {
      distributedOperations += 1;
      if (distributedOperations === 1) return { statusCode: 503, payload: { ok: false, code: "LUNA_TIMEOUT", retryable: true } };
      return { statusCode: 200, payload: { ok: true, requestId: "req-00000004" } };
    });
  }
  await distributedExecute();
  await distributedExecute();
  await distributedExecute();
  assert.equal(distributedOperations, 2, "distribuirani retryable zaključek mora dovoliti nov poskus, uspeh pa se cachea");
  assert.deepEqual(finishedOutcomes.map(function (outcome) { return outcome.statusCode; }), [503, 200]);

  var finishRpcCalls = 0;
  var finishCoordinator = policy.createDistributedCoordinator({
    key: "goal:user:req-00000006", requestId: "req-000000000006", kind: "goal",
    contractVersion: "goal-fact-v17", fingerprint: "a".repeat(64),
    rpc: async function (name) {
      if (name === "atena_begin_ai_request") return { action: "start", leaseToken: "00000000-0000-4000-8000-000000000006" };
      finishRpcCalls += 1;
      return finishRpcCalls === 1 ? { ok: false } : { ok: true };
    },
  });
  var finishAdmission = await finishCoordinator.begin();
  await finishCoordinator.finish(finishAdmission.leaseToken, { statusCode: 200, payload: { ok: true } });
  assert.equal(finishRpcCalls, 2, "logični finish RPC neuspeh se mora enkrat varno ponoviti");

  var failedFinishRuntime = { cache: new Map(), inflight: new Map() };
  var failedFinishOutcome = await policy.executeIdempotent(failedFinishRuntime, {
    key: "goal:user:req-00000007", fingerprint: "finish-persistence-failure", fallbackMessage: "Varna napaka.",
    coordinator: {
      begin: async function () { return { leaseToken: "00000000-0000-4000-8000-000000000007" }; },
      finish: async function () { var error = new Error("rpc unavailable"); error.code = "AI_ADMISSION_FINISH_FAILED"; throw error; },
    },
  }, async function () { return { statusCode: 200, payload: { ok: true, requestId: "req-00000007" } }; });
  assert.equal(failedFinishOutcome.statusCode, 200);
  assert.equal(failedFinishRuntime.cache.size, 0, "uspeh se lokalno ne sme cacheati, če distributed finish ni potrjen");

  var admissionSql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260830133746_atena_distributed_admission_control.sql"), "utf8");
  assert.match(admissionSql, /p_payload @> '\{"retryable": true\}'::jsonb[\s\S]*delete from public\.atena_ai_requests/, "retryable distribuirani outcome mora sprostiti lease, ne postati completed");
  assert.match(admissionSql, /status = 'completed'[\s\S]*response_payload @> '\{"retryable": true\}'::jsonb[\s\S]*delete from public\.atena_ai_requests/, "stari retryable completed zapis se mora ob naslednjem begin klicu samozdraviti");

  var historyPlanRuntime = { cache: new Map(), inflight: new Map() };
  var historyPlanOutcome = await policy.executeIdempotent(historyPlanRuntime, { key: "history:user:req-00000005", fingerprint: "invalid-history-plan", fallbackMessage: "Varna napaka." }, async function () {
    var invalidPlan = new Error("Lunin odgovor ni skladen z zgodovinskim katalogom.");
    invalidPlan.code = "LUNA_INVALID_HISTORY_PLAN";
    invalidPlan.status = 503;
    invalidPlan.retryable = false;
    throw invalidPlan;
  });
  assert.equal(historyPlanOutcome.payload.code, "LUNA_INVALID_HISTORY_PLAN", "history-specific invalid-plan koda ne sme pasti v generični AI_UNAVAILABLE mapping");

  var users = new Map();
  assert.equal(policy.reserveRateLimit(users, "u", 0, 60000, 2), true);
  assert.equal(policy.reserveRateLimit(users, "u", 1, 60000, 2), true);
  assert.equal(policy.reserveRateLimit(users, "u", 2, 60000, 2), false);
  assert.equal(policy.reserveRateLimit(users, "u", 60000, 60000, 2), true);
}

async function ledgerAndStaleResponseInvariants() {
  var historyText = "29. avgusta je plačal 100 EUR";
  var historyResult = history.normalizeResult({ summary: "x", events: [{ type: "partial_payment", amount: 100, currency: "EUR", occurredDate: "2026-08-29", description: historyText, confidence: "high", evidence: { sourceSpan: { start: 0, end: historyText.length, text: historyText } } }] }, 434, { text: historyText, referenceDate: "2026-08-30", originalDebt: 434, remainingDebt: 434 });
  assert.equal(historyResult.ledger[0].effectEur, -100);
  assert.equal(historyResult.projectedRemainingDebtEur, 334);

  var agreementText = "rekel je, da bo plačal 100 EUR jutri";
  var agreementResult = await agreement.analyze(agreementText, { referenceDate: "2026-08-30", originalDebt: 434, remainingDebt: 434 }, { apiKey: "x", fetchImpl: async function () {
    return response(200, { output_text: JSON.stringify({ agreements: [{ cardId: 1, amount: 100, occurredDate: null, promisedDate: "2026-08-31", communicationChannel: "unknown", description: agreementText, evidence: agreementText }], question: null, evidence: null }) });
  } });
  assert.equal(agreementResult.ledger[0].effectEur, 0);
  assert.equal(agreementResult.projectedRemainingDebtEur, 434);

  var goalSource = "hočem celotno plačilo";
  var goalResult = await goal.analyze(goalSource, { remainingDebt: 434 }, { apiKey: "x", fetchImpl: async function () {
    return response(200, { output_text: JSON.stringify({ p: [{ n: 1, c: goal._test.cardIdByGoal.full_payment, k: 1, e: goalSource, f: [{ i: goal._test.fieldIdByKey.targetAmount, v: "434", o: null, e: goalSource }] }], q: null, x: goalSource }) });
  } });
  assert.equal(goalResult.goals[0].goalData.targetAmount, "434");
  assert.equal(Object.prototype.hasOwnProperty.call(goalResult, "ledger"), false, "cilj ne sme mutirati dolga");

  var historyUi = fs.readFileSync(path.join(__dirname, "..", "app", "neplacila-zgodovina.js"), "utf8");
  var goalUi = fs.readFileSync(path.join(__dirname, "..", "app", "neplacila-cilj.js"), "utf8");
  assert.match(historyUi, /var mojRequestId = naravni\.requestId;/, "history mora zajeti nespremenljiv requestId posameznega poskusa");
  assert.match(historyUi, /mojaGeneracija !== analizaGeneracija \|\| mojRequestId !== naravni\.requestId/);
  assert.match(historyUi, /data\.requestId !== mojRequestId/, "history uspeh mora pripadati zajetemu requestId");
  assert.match(historyUi, /catch \(error\) \{\s*if \(mojaGeneracija !== analizaGeneracija \|\| mojRequestId !== naravni\.requestId\) return;/, "zastarela history napaka ne sme spreminjati novejšega stanja");
  assert.match(goalUi, /mojaGeneracija !== ciljAiGeneracija \|\| mojRequestId !== ciljAiRequestId/);
  assert.match(historyUi, /data-ai-text[^>]*' \+ \(naravni\.status === "analyzing" \? ' disabled' : ''\) \+ '>/, "history textarea mora biti med analizo onemogočen");
  assert.match(goalUi, /data-cilj-opis[^>]*' \+ \(pripravlja \? ' disabled' : ''\) \+ '>/, "goal textarea mora biti med analizo onemogočen");

  var timeoutCallback = null;
  var clearedTimer = null;
  var clientContext = {
    AbortController: AbortController,
    Object: Object,
    setTimeout: function (callback) { timeoutCallback = callback; return 77; },
    clearTimeout: function (timer) { clearedTimer = timer; },
  };
  clientContext.globalThis = clientContext;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "app", "atena-request.js"), "utf8"), clientContext);
  var requestGuard = clientContext.UJAtenaRequest.create();
  assert.equal(requestGuard.signal.aborted, false);
  timeoutCallback();
  assert.equal(requestGuard.signal.aborted, true);
  assert.equal(requestGuard.timedOut(), true);
  requestGuard.dispose();
  assert.equal(clearedTimer, 77);
  var applicationTypeError = new TypeError("pokvarjen že prejet odgovor");
  assert.equal(clientContext.UJAtenaRequest.isRetryable(applicationTypeError), false, "programski TypeError ne sme zakleniti requestId na pokvarjen odgovor");
  var fetchTypeError = clientContext.UJAtenaRequest.networkError(new TypeError("Failed to fetch"));
  assert.equal(fetchTypeError.code, "NETWORK_ERROR");
  assert.equal(clientContext.UJAtenaRequest.isRetryable(fetchTypeError), true);
  assert.match(historyUi, /UJAtenaRequest\.networkError\(error\)/);
  assert.match(goalUi, /UJAtenaRequest\.networkError\(error\)/);
  assert.match(historyUi, /UJAtenaRequest\.create\(\)/);
  assert.match(goalUi, /UJAtenaRequest\.create\(\)/);
  assert.match(historyUi, /if \(!window\.UJAtenaRequest\.isRetryable\(error\)\) naravni\.requestId = "";/, "history/agreement mora pri retryable ali izgubljenem odgovoru ohraniti requestId");
  assert.match(goalUi, /if \(!window\.UJAtenaRequest\.isRetryable\(error\)\) ciljAiRequestId = "";/, "goal mora pri retryable ali izgubljenem odgovoru ohraniti requestId");
  assert.match(goalUi, /if \(mojaGeneracija === ciljAiGeneracija\) \{[\s\S]*ustaviCiljAnalizaStatus\(\)/, "ciljni status timer se mora ustaviti tudi po resetu requestId ob napaki");
  assert.match(historyUi, /function prekiniAktivnoAnalizo\(\)[\s\S]*analizaGeneracija \+= 1;[\s\S]*analizaAbort\.abort\(\);[\s\S]*analizaAbort\.dispose\(\);/, "History\/Agreement mora imeti skupno prekinitev aktivne analize");
  assert.match(historyUi, /window\.UJZgodovinaPonastaviVgrajeniVnos = function[\s\S]*prekiniAktivnoAnalizo\(\);[\s\S]*naravni\.candidates = \[\];[\s\S]*naravni\.requestId = "";/, "zaprtje vgrajene Atene mora prekiniti request in počistiti osnutek");
  assert.match(goalUi, /function prekiniCiljAnalizo\(\)[\s\S]*ciljAiGeneracija \+= 1;[\s\S]*ciljAnalizaAbort\.abort\(\);[\s\S]*ciljAnalizaAbort\.dispose\(\);/, "Goal mora ob ponastavitvi prekiniti aktivno analizo");
  assert.match(goalUi, /data-cilj-izbrisi[\s\S]*prekiniCiljAnalizo\(\);/, "Goal Ponastavi mora uporabiti skupno prekinitev");

  var izvedbaUi = fs.readFileSync(path.join(__dirname, "..", "app", "izvedba.js"), "utf8");
  assert.match(izvedbaUi, /function zapriActionSheet\(\)[\s\S]*actionSheetMode === "payment"[\s\S]*UJZgodovinaPonastaviVgrajeniVnos/, "zaprtje Agreement sheeta mora invalidirati aktivni Atena request");

  var vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));
  var consolidatedFunction = vercelConfig.functions && vercelConfig.functions["api/izvedi-opomin-ukrep.js"];
  var requiredDurationSeconds = Math.ceil(policy.MODEL_TIMEOUT_MAX_MS / 1000) + 10;
  assert.ok(consolidatedFunction && Number(consolidatedFunction.maxDuration) >= requiredDurationSeconds, "konsolidirana Atena funkcija potrebuje model timeout in vsaj 10 s varnostne rezerve");
}

async function main() {
  var startedAt = Date.now();
  await transportFaults();
  await malformedAndEvidenceFaults();
  await idempotencyAndConcurrency();
  await ledgerAndStaleResponseInvariants();
  console.log("Atena reliability policy PASS: transport faults, bounded retry, schema/evidence fail-closed, idempotency/concurrency, rate limit, stale response and ledger invariants in " + (Date.now() - startedAt) + " ms");
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
