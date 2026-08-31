"use strict";

var parser = require("../api/_lib/dogovor-naravni-vnos");
var corpus = require("./dogovor-100x20-corpus");
var actualHttpAttempts = 0;

function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
async function countedFetch(url, options) { actualHttpAttempts += 1; return fetch(url, options); }

function sameNullableAmount(actual, expected) {
  if (expected == null) return actual == null;
  return Number.isFinite(Number(actual)) && Math.abs(Number(actual) - expected) < 0.009;
}
function assess(testCase, result, durationMs) {
  var candidate = result && Array.isArray(result.candidates) ? result.candidates[0] : null;
  var ledger = result && Array.isArray(result.ledger) ? result.ledger[0] : null;
  var errors = [];
  if (!result || result.needsClarification === true) errors.push("clarification");
  if (!candidate || candidate.type !== testCase.expected.type) errors.push("type");
  if (!candidate || !sameNullableAmount(candidate.amount, testCase.expected.amount)) errors.push("amount");
  if (!candidate || (candidate.promisedDate || null) !== testCase.expected.date) errors.push("date");
  if (!candidate || candidate.communicationChannel !== testCase.expected.channel) errors.push("channel");
  if (!ledger || Number(ledger.effectEur) !== 0) errors.push("ledger");
  if (!result || Number(result.projectedRemainingDebtEur) !== corpus.REMAINING_DEBT) errors.push("remaining");
  if (!result || !result.semanticPlan || result.semanticPlan.attempted !== true) errors.push("not_actual_luna_call");
  return {
    ok: errors.length === 0, baseIntentId: testCase.baseIntentId, paraphraseId: testCase.paraphraseId,
    family: testCase.family, text: testCase.text, errors: errors, durationMs: durationMs,
    status: result && result.semanticPlan && result.semanticPlan.status || "missing",
    reason: result && result.semanticPlan && result.semanticPlan.reason || "missing",
    attempted: result && result.semanticPlan && result.semanticPlan.attempted === true,
    actual: candidate ? { type: candidate.type, amount: candidate.amount, date: candidate.promisedDate, channel: candidate.communicationChannel } : null,
  };
}
async function runOne(testCase) {
  var started = Date.now();
  for (var attempt = 0; attempt < 9; attempt += 1) {
    try {
      var result = await parser.analyze(testCase.text, {
        referenceDate: corpus.REFERENCE_DATE, originalDebt: corpus.REMAINING_DEBT, remainingDebt: corpus.REMAINING_DEBT,
      }, { apiKey: process.env.OPENAI_API_KEY, userId: "atena-real-luna-100x10", timeoutMs: 25000, fetchImpl: countedFetch });
      return assess(testCase, result, Date.now() - started);
    } catch (error) {
      if (error && error.code === "LUNA_RATE_LIMITED" && attempt < 8) {
        await wait(Math.min(30000, 3000 * (attempt + 1)) + Math.floor(Math.random() * 1000));
        continue;
      }
      return {
        ok: false, baseIntentId: testCase.baseIntentId, paraphraseId: testCase.paraphraseId, family: testCase.family,
        text: testCase.text, errors: ["exception"], durationMs: Date.now() - started, status: "exception",
        reason: error && (error.code || error.name || error.message) || "unknown", attempted: true, actual: null,
      };
    }
  }
}
function counts(results, field) {
  return results.reduce(function (all, item) {
    var key = item[field] || "missing";
    all[key] = (all[key] || 0) + 1;
    return all;
  }, {});
}
async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manjka; resnični Luna test ni bil izveden.");
  if (corpus.BASES.length !== 100 || corpus.CASES.length !== 1000) throw new Error("Korpus mora biti natanko 100 različnih pomenov × 10 parafraz.");
  corpus.BASES.forEach(function (base) {
    if (base.variants.length < 10 || new Set(base.variants.slice(0, 10)).size !== 10) throw new Error(base.id + " nima 10 različnih parafraz.");
  });
  if (new Set(corpus.CASES.map(function (item) { return item.text; })).size !== 1000) throw new Error("Besedila v korpusu niso vsa različna.");

  var results = new Array(corpus.CASES.length);
  var nextIndex = 0, completed = 0;
  var concurrency = Math.max(1, Math.min(6, Number(process.env.DOGOVOR_REAL_CONCURRENCY) || 3));
  var workers = Array.from({ length: concurrency }, async function () {
    while (true) {
      var index = nextIndex++;
      if (index >= corpus.CASES.length) return;
      results[index] = await runOne(corpus.CASES[index]);
      completed += 1;
      if (completed % 100 === 0 || completed === corpus.CASES.length) {
        console.log("REAL_LUNA_100X10_PROGRESS " + completed + "/" + corpus.CASES.length + " pravilnih=" + results.filter(function (item) { return item && item.ok; }).length);
      }
    }
  });
  await Promise.all(workers);

  var passed = results.filter(function (item) { return item.ok; }).length;
  var durations = results.map(function (item) { return item.durationMs; }).sort(function (a, b) { return a - b; });
  function percentile(value) { return durations[Math.min(durations.length - 1, Math.floor((durations.length - 1) * value))]; }
  var baseFailures = results.filter(function (item) { return !item.ok; }).reduce(function (all, item) {
    all[item.baseIntentId] = (all[item.baseIntentId] || 0) + 1;
    return all;
  }, {});
  var report = {
    baseIntents: corpus.BASES.length, paraphrasesPerIntent: 10, requestedCases: corpus.CASES.length,
    realLunaCases: results.filter(function (item) { return item.attempted; }).length, actualHttpAttempts: actualHttpAttempts,
    passed: passed, failed: results.length - passed, familyCounts: counts(results, "family"),
    statusCounts: counts(results, "status"), reasonCounts: counts(results, "reason"), baseFailureCounts: baseFailures,
    latencyMs: { p50: percentile(0.5), p95: percentile(0.95), max: durations[durations.length - 1] },
    semanticFailures: results.filter(function (item) { return !item.ok && item.reason !== "LUNA_RATE_LIMITED" && item.reason !== "LUNA_TIMEOUT"; }).slice(0, 50),
    infrastructureFailures: results.filter(function (item) { return !item.ok && (item.reason === "LUNA_RATE_LIMITED" || item.reason === "LUNA_TIMEOUT"); }).slice(0, 20),
  };
  console.log("REAL_LUNA_100X10_RESULT " + JSON.stringify(report));
  if (passed !== results.length) process.exitCode = 1;
}
main().catch(function (error) {
  console.error("REAL_LUNA_100X10_FATAL " + String(error && error.message || error));
  process.exitCode = 1;
});
