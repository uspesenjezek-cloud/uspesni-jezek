"use strict";

var assert = require("node:assert/strict");
var performance = require("node:perf_hooks").performance;
var temporalEngine = require("../api/_lib/zgodovina-temporal-engine");
var paymentSequenceEngine = require("../api/_lib/zgodovina-payment-sequence-engine");
var factEngine = require("../api/_lib/zgodovina-fact-engine");
var parser = require("../api/_lib/zgodovina-naravni-vnos");
var legacyAnalyze = parser.analyze;
parser.analyze = function (text, context, options) {
  return legacyAnalyze(text, context, Object.assign({ _legacyTestMode: true }, options || {}));
};

var REFERENCE_DATE = "2026-08-28";
var DEBT = 9446;
var CONTEXT = { referenceDate: REFERENCE_DATE, originalDebt: DEBT, remainingDebt: DEBT };
var RUNS_PER_ENGINE = 100;

var WEEK_COUNTS = [
  { value: 1, numeric: "1 teden", word: "en teden" },
  { value: 2, numeric: "2 tedna", word: "dva tedna" },
  { value: 3, numeric: "3 tedne", word: "tri tedne" },
  { value: 4, numeric: "4 tedne", word: "štiri tedne" },
  { value: 5, numeric: "5 tednov", word: "pet tednov" },
];
var DAY_COUNTS = [
  { value: 1, numeric: "1 dan", word: "en dan" },
  { value: 2, numeric: "2 dni", word: "dva dni" },
  { value: 3, numeric: "3 dni", word: "tri dni" },
  { value: 4, numeric: "4 dni", word: "štiri dni" },
  { value: 5, numeric: "5 dni", word: "pet dni" },
];

function percentile(values, ratio) {
  var sorted = values.slice().sort(function (left, right) { return left - right; });
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function timingSummary(values) {
  return {
    p50: percentile(values, 0.50),
    p95: percentile(values, 0.95),
    max: Math.max.apply(Math, values),
  };
}

function shiftDate(iso, amount, unit) {
  var parts = iso.split("-").map(Number);
  var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  date.setUTCDate(date.getUTCDate() + amount * (unit === "week" ? 7 : 1));
  return date.toISOString().slice(0, 10);
}

function generatedCase(index) {
  if (index === 0) {
    return {
      text: "2 tedna nazaj je plačal 300... včeraj 1000 in danes pa je plačal še 100",
      amounts: [300, 1000, 100],
      dates: ["2026-08-14", "2026-08-27", "2026-08-28"],
    };
  }
  var firstAmount = 250 + (index * 37) % 900;
  var secondAmount = 300 + (index * 53) % 1100;
  var thirdAmount = 100 + (index * 29) % 700;
  var firstCount = index % 2 ? "dva tedna" : (index % 6 === 0 ? "2tedna" : "2 tedna");
  var separator = [" ", "... ", ", ", "; "][index % 4];
  var middle = ["včeraj ", "vceraj pa ", "včeraj je poravnal ", "vceraj je placal "][index % 4];
  var last = ["in danes pa je plačal še ", "danes ", "in danes pa ", "danes je poravnal "][index % 4];
  var first = index % 3 === 0
    ? "dolznik je placal " + firstAmount + " " + firstCount + " nazaj"
    : firstCount + " nazaj je placal " + firstAmount;
  return {
    text: first + separator + middle + secondAmount + separator + last + thirdAmount,
    amounts: [firstAmount, secondAmount, thirdAmount],
    dates: ["2026-08-14", "2026-08-27", "2026-08-28"],
  };
}

function assertFinalResult(testCase, result, label) {
  assert.deepEqual(result.candidates.map(function (candidate) {
    return [candidate.type, candidate.amount, candidate.occurredDate, candidate.paymentMethod];
  }), testCase.amounts.map(function (amount, index) {
    return ["partial_payment", amount, testCase.dates[index], null];
  }), label + " mora ohraniti vse tri dogodke");
  var balance = DEBT;
  var expectedLedger = testCase.amounts.map(function (amount) { balance -= amount; return balance; });
  assert.deepEqual(result.ledger.map(function (entry) { return entry.afterEur; }), expectedLedger, label + " mora ohraniti ledger");
  assert.equal(result.coverage.complete, true, label + " mora porabiti vse dokaze natanko enkrat");
  assert.deepEqual(result.questionPlan.map(function (step) { return step.missing; }), [
    ["paymentMethod"], ["paymentMethod"], ["paymentMethod"],
  ], label + " sme vprašati samo za tri manjkajoče metode");
}

function runTemporalEngine() {
  var durations = [];
  for (var index = 0; index < RUNS_PER_ENGINE; index += 1) {
    var table = index % 2 ? WEEK_COUNTS : DAY_COUNTS;
    var count = table[index % table.length];
    var countText = index % 3 ? count.word : count.numeric;
    if (index % 10 === 0 && count.value === 2) countText = index % 2 ? "2tedna" : "2dni";
    var amount = 300 + index * 11;
    var text = index % 2
      ? "plačal je " + amount + " " + countText + " nazaj"
      : countText + " nazaj je plačal " + amount;
    var started = performance.now();
    var relations = temporalEngine.extractDateRelations(text);
    durations.push(performance.now() - started);
    assert.equal(relations.length, 1, "temporal engine mora najti natanko eno relacijo: " + text);
    assert.equal(relations[0].amount, count.value, "časovni števec se ne sme sešteti z denarjem: " + text);
    assert.equal(relations[0].unit, index % 2 ? "week" : "day", "napačna časovna enota: " + text);
    assert.ok(!relations[0].sourceSpan.text.includes(String(amount)), "časovni source span ne sme pogoltniti zneska: " + text);
  }
  return timingSummary(durations);
}

function runSequenceEngine() {
  var durations = [];
  for (var index = 0; index < RUNS_PER_ENGINE; index += 1) {
    var testCase = generatedCase(index);
    var text = factEngine.normalizeText(testCase.text);
    var relations = temporalEngine.extractDateRelations(text);
    var signals = factEngine.discoverSignals(text);
    var started = performance.now();
    var spans = paymentSequenceEngine.splitPaymentContinuations(text, [{ start: 0, end: text.length }], signals, relations);
    durations.push(performance.now() - started);
    var expressions = paymentSequenceEngine.extractPaymentExpressions(text, relations);
    var perSpan = spans.map(function (span) {
      return expressions.filter(function (expression) {
        return expression.evidence.start >= span.start && expression.evidence.start < span.end;
      }).map(function (expression) { return expression.value; });
    });
    assert.deepEqual(perSpan, testCase.amounts.map(function (amount) { return [amount]; }), "sequence engine mora izločiti tri dokazne klavzule: " + testCase.text);
  }
  return timingSummary(durations);
}

function runResolverEngine() {
  var durations = [];
  for (var index = 0; index < RUNS_PER_ENGINE; index += 1) {
    var testCase = generatedCase(index);
    var started = performance.now();
    var result = parser._test.deterministicResult(testCase.text, CONTEXT);
    durations.push(performance.now() - started);
    assertFinalResult(testCase, result, "resolver engine #" + index);
  }
  return timingSummary(durations);
}

function semanticEvent(type, amount, clauseId, occurredDate, paymentMethod) {
  return {
    type: type, repeat: 1, amount: amount, currency: "EUR", occurredDate: occurredDate,
    promisedDate: null, paymentMethod: paymentMethod, communicationChannel: null,
    documentReference: null, reason: null, description: null, confidence: "high",
    missing: [], evidenceClauseId: clauseId, inheritedFrom: null, dateRelation: null,
  };
}

async function runLunaContract() {
  var durations = [];
  var sources = {};
  for (var index = 0; index < RUNS_PER_ENGINE; index += 1) {
    var testCase = generatedCase(index);
    var contract = parser._test.buildFactContract(testCase.text);
    var correctEvents = contract.clauses.map(function (clause, clauseIndex) {
      return semanticEvent("partial_payment", testCase.amounts[clauseIndex], clause.id, testCase.dates[clauseIndex], null);
    });
    var proposedEvents;
    if (index % 3 === 0) proposedEvents = correctEvents;
    else if (index % 3 === 1) proposedEvents = correctEvents.slice(0, 1);
    else proposedEvents = contract.clauses.map(function (clause, clauseIndex) {
      return semanticEvent("partial_payment", 9000 - clauseIndex * 700, clause.id, "2030-01-0" + (clauseIndex + 1), "direct_debit");
    });
    var calls = 0;
    var started = performance.now();
    var result = await parser.analyze(testCase.text, CONTEXT, {
      apiKey: "mock-luna-only",
      fetchImpl: async function () {
        calls += 1;
        return {
          ok: true,
          status: 200,
          json: async function () {
            return { output_text: JSON.stringify({ plan: contract.clauses.map(function (clause) {
              return { clauseId: clause.id, eventType: "partial_payment", count: 1, inheritedFrom: null };
            }) }) };
          },
        };
      },
    });
    durations.push(performance.now() - started);
    assert.equal(calls, 1, "Luna contract mora biti poklican natanko enkrat: " + testCase.text);
    assertFinalResult(testCase, result, "Luna contract #" + index);
    assert.equal(result.semanticPlan.source, "validated_semantic_plan", "Luna rešitev mora skozi evidence resolver");
    sources[result.semanticPlan.source] = (sources[result.semanticPlan.source] || 0) + 1;
  }
  return { timing: timingSummary(durations), sources: sources };
}

async function main() {
  var temporal = runTemporalEngine();
  var sequence = runSequenceEngine();
  var resolver = runResolverEngine();
  var luna = await runLunaContract();
  console.log("✓ mini temporal engine: 100/100; p50 " + temporal.p50.toFixed(2) + " ms, p95 " + temporal.p95.toFixed(2) + " ms, max " + temporal.max.toFixed(2) + " ms");
  console.log("✓ mini clause-sequence engine: 100/100; p50 " + sequence.p50.toFixed(2) + " ms, p95 " + sequence.p95.toFixed(2) + " ms, max " + sequence.max.toFixed(2) + " ms");
  console.log("✓ mini evidence-ledger resolver: 100/100; p50 " + resolver.p50.toFixed(2) + " ms, p95 " + resolver.p95.toFixed(2) + " ms, max " + resolver.max.toFixed(2) + " ms");
  console.log("✓ mock-Luna contract: 100/100; p50 " + luna.timing.p50.toFixed(2) + " ms, p95 " + luna.timing.p95.toFixed(2) + " ms, max " + luna.timing.max.toFixed(2) + " ms; " + JSON.stringify(luna.sources));
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
