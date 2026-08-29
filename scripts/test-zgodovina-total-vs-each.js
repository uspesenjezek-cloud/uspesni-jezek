"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var parser = require("../api/_lib/zgodovina-naravni-vnos");
var factEngine = require("../api/_lib/zgodovina-fact-engine");
var thinkingEngine = require("../api/_lib/zgodovina-thinking-engine");
var coverageEngine = require("../api/_lib/zgodovina-coverage-engine");

function amountField(value, evidence, relationId) {
  return { i: 1, v: value, e: evidence, r: relationId == null ? [] : [relationId] };
}

function dateField(value, evidence, relation) {
  return { i: 2, v: value, e: evidence, r: relation };
}

function installmentCards(count, amountValue, amountEvidence, relationId, groupEvidence, date) {
  return Array.from({ length: count }, function (_, index) {
    var fields = [amountField(amountValue, amountEvidence, relationId)];
    if (date) fields.push(dateField(date.value, date.evidence, date.relation));
    return { n: index + 1, c: 3, e: groupEvidence, f: fields };
  });
}

async function analyzeCompact(text, cards, debt) {
  return parser.analyze(text, {
    referenceDate: "2026-08-29", originalDebt: debt || 9446, remainingDebt: debt || 9446,
  }, {
    apiKey: "test-only",
    fetchImpl: async function () {
      return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({ p: cards, q: null, x: null }) }; } };
    },
  });
}

async function main() {
  var exactText = "plačal je 2000evrov 14dni nazaj potem je pa v 2h obrokih plačal 100 evrov danes";
  var exactGroup = "v 2h obrokih plačal 100 evrov danes";
  var exactCards = [{
    n: 1, c: 1, e: "plačal je 2000evrov 14dni nazaj", f: [
      amountField(2000, "2000evrov"),
      dateField("2026-08-15", "14dni nazaj", [601, 611, 621, 631, 14, 641, null]),
    ],
  }].concat(installmentCards(2, 100, "100 evrov", 651, exactGroup, {
    value: "2026-08-29", evidence: "danes", relation: [601, 611, 621, 632, 0, 641, null],
  }).map(function (card, index) { return Object.assign({}, card, { n: index + 2 }); }));
  var originalFactBuild = factEngine.buildFactContract;
  var originalThinkingFinalize = thinkingEngine.finalizeCandidates;
  var originalCoverageAssess = coverageEngine.assessCoverage;
  factEngine.buildFactContract = function () { throw new Error("fact engine ne sme teči na lean Luna poti"); };
  thinkingEngine.finalizeCandidates = function () { throw new Error("thinking engine ne sme teči na lean Luna poti"); };
  coverageEngine.assessCoverage = function () { throw new Error("coverage engine ne sme teči na lean Luna poti"); };
  var exact;
  try {
    exact = await analyzeCompact(exactText, exactCards);
  } finally {
    factEngine.buildFactContract = originalFactBuild;
    thinkingEngine.finalizeCandidates = originalThinkingFinalize;
    coverageEngine.assessCoverage = originalCoverageAssess;
  }
  assert.equal(exact.semanticPlan.status, "OK");
  assert.deepEqual(exact.enginePath, ["luna", "compact_schema", "exact_evidence", "numeric_date_ledger", "human_review"]);
  assert.deepEqual(exact.candidates.map(function (candidate) { return candidate.amount; }), [2000, 50, 50]);
  assert.deepEqual(exact.candidates.map(function (candidate) { return candidate.occurredDate; }), ["2026-08-15", "2026-08-29", "2026-08-29"]);
  assert.deepEqual(exact.candidates.slice(1).map(function (candidate) { return candidate.description; }), ["1/2 obrok", "2/2 obrok"]);
  assert.deepEqual(exact.questionPlan.map(function (question) { return question.cardNumber; }), [1, 2, 3]);
  assert.equal(exact.projectedRemainingDebtEur, 7346);
  assert.deepEqual(exact.ledger.map(function (row) { return row.afterEur; }), [7446, 7396, 7346]);

  var eachText = "plačal je 2000 evrov 14 dni nazaj potem pa 2 obroka po 100 evrov danes";
  var eachCards = exactCards.map(function (card, index) {
    if (index === 0) return Object.assign({}, card, { e: "plačal je 2000 evrov 14 dni nazaj", f: [amountField(2000, "2000 evrov"), dateField("2026-08-15", "14 dni nazaj", [601, 611, 621, 631, 14, 641, null])] });
    return Object.assign({}, card, { e: "2 obroka po 100 evrov danes", f: [amountField(100, "100 evrov", 652), dateField("2026-08-29", "danes", [601, 611, 621, 632, 0, 641, null])] });
  });
  var each = await analyzeCompact(eachText, eachCards);
  assert.equal(each.semanticPlan.status, "OK", each.semanticPlan.reason);
  assert.deepEqual(each.candidates.map(function (candidate) { return candidate.amount; }), [2000, 100, 100]);
  assert.equal(each.projectedRemainingDebtEur, 7246);

  var screenshotText = "plačal sem 2 tedna nazaj 1000 potem 1 teden nazaj pa 2 obroka po 100. danes pa še 1000";
  var screenshotCards = [{
    n: 1, c: 1, e: "plačal sem 2 tedna nazaj 1000", f: [
      amountField(1000, "1000"), dateField("2026-08-15", "2 tedna nazaj", [601, 611, 621, 631, 2, 642, null]),
    ],
  }, {
    n: 2, c: 3, e: "1 teden nazaj pa 2 obroka po 100", f: [
      amountField(100, "100", 652), dateField("2026-08-22", "1 teden nazaj", [601, 611, 621, 631, 1, 642, null]),
    ],
  }, {
    n: 3, c: 3, e: "2 obroka po 100", f: [
      amountField(100, "100", 652), dateField("2026-08-22", "1 teden nazaj", [601, 611, 621, 631, 1, 642, null]),
    ],
  }, {
    n: 4, c: 1, e: "danes pa še 1000", f: [
      amountField(1000, "1000"), dateField("2026-08-29", "danes", [601, 611, 621, 632, 0, 641, null]),
    ],
  }];
  var screenshotResult = await analyzeCompact(screenshotText, screenshotCards);
  assert.deepEqual(screenshotResult.candidates.map(function (candidate) { return candidate.amount; }), [1000, 100, 100, 1000]);
  assert.deepEqual(screenshotResult.candidates.map(function (candidate) { return candidate.occurredDate; }), ["2026-08-15", "2026-08-22", "2026-08-22", "2026-08-29"]);
  assert.deepEqual(screenshotResult.candidates.slice(1, 3).map(function (candidate) { return candidate.description; }), ["1/2 obrok", "2/2 obrok"]);
  assert.deepEqual(screenshotResult.questionPlan.map(function (question) { return question.cardNumber; }), [1, 2, 3, 4]);
  assert.equal(screenshotResult.projectedRemainingDebtEur, 7246);

  var totalCases = [
    "v 2 obrokih plačal 100 €", "2 obroka skupaj 100 €", "v 2h obrokih plačal 100 evrov danes",
    "danes je v 2eh obrokih plačal 100 evrov", "dveh obrokih skupaj 100 evrov danes",
  ];
  for (var totalText of totalCases) {
    var totalResult = await analyzeCompact(totalText, installmentCards(2, 100, /€/.test(totalText) ? "100 €" : "100 evrov", 651, totalText, /danes/.test(totalText) ? {
      value: "2026-08-29", evidence: "danes", relation: [601, 611, 621, 632, 0, 641, null],
    } : null), 1000);
    assert.deepEqual(totalResult.candidates.map(function (candidate) { return candidate.amount; }), [50, 50], totalText);
    assert.equal(totalResult.projectedRemainingDebtEur, 900, totalText);
  }

  var eachCases = ["2 obroka po 100 €", "dveh obrokih po 100 evrov", "danes je plačal 2h obroka po 100 evrov"];
  for (var perUnitText of eachCases) {
    var eachResult = await analyzeCompact(perUnitText, installmentCards(2, 100, /€/.test(perUnitText) ? "100 €" : "100 evrov", 652, perUnitText, /danes/.test(perUnitText) ? {
      value: "2026-08-29", evidence: "danes", relation: [601, 611, 621, 632, 0, 641, null],
    } : null), 1000);
    assert.deepEqual(eachResult.candidates.map(function (candidate) { return candidate.amount; }), [100, 100], perUnitText);
    assert.equal(eachResult.projectedRemainingDebtEur, 800, perUnitText);
  }

  var missingRelation = await analyzeCompact("v 2 obrokih plačal 100 €", installmentCards(2, 100, "100 €", null, "v 2 obrokih plačal 100 €"), 1000);
  assert.equal(missingRelation.semanticPlan.reason, "luna_canonical_installment_amount_relation_missing");
  assert.equal(missingRelation.candidates.length, 0);

  var conflictCards = installmentCards(2, 100, "100 €", 651, "2 obroka skupaj 100 €");
  conflictCards[1].f[0].r = [652];
  var conflict = await analyzeCompact("2 obroka skupaj 100 €", conflictCards, 1000);
  assert.equal(conflict.candidates.length, 0);
  assert.match(conflict.semanticPlan.reason, /installment_group_count|total_each_conflict/);

  var duplicate = await analyzeCompact("v 2 obrokih plačal 100 €", installmentCards(3, 100, "100 €", 651, "v 2 obrokih plačal 100 €"), 1000);
  assert.equal(duplicate.candidates.length, 0);
  assert.equal(duplicate.semanticPlan.reason, "luna_compact_duplicate_event");

  var indivisible = await analyzeCompact("v 3 obrokih plačal 100 €", installmentCards(3, 100, "100 €", 651, "v 3 obrokih plačal 100 €"), 1000);
  assert.equal(indivisible.candidates.length, 0);
  assert.equal(indivisible.semanticPlan.reason, "luna_canonical_total_amount_not_divisible");

  var hallucinatedEvent = await analyzeCompact("plačal je 100 evrov", [{ n: 1, c: 1, e: "tega v viru ni", f: [amountField(100, "100 evrov")] }], 1000);
  assert.equal(hallucinatedEvent.semanticPlan.reason, "luna_compact_event_evidence");
  var hallucinatedField = await analyzeCompact("plačal je 100 evrov", [{ n: 1, c: 1, e: "plačal je 100 evrov", f: [amountField(100, "999 evrov")] }], 1000);
  assert.equal(hallucinatedField.semanticPlan.reason, "luna_compact_field_evidence");
  var duplicatePayment = await analyzeCompact("plačal je 100 evrov", [
    { n: 1, c: 1, e: "plačal je 100 evrov", f: [amountField(100, "100 evrov")] },
    { n: 2, c: 1, e: "plačal je 100 evrov", f: [amountField(100, "100 evrov")] },
  ], 1000);
  assert.equal(duplicatePayment.semanticPlan.reason, "luna_compact_duplicate_event");

  var request = parser.requestBody("v 2 obrokih plačal 100 €", { referenceDate: "2026-08-29", originalDebt: 1000, remainingDebt: 1000 }, "test");
  assert.match(request.instructions, /r=\[651\].*TOTAL/);
  assert.match(request.instructions, /r=\[652\].*EACH/);
  assert.ok(JSON.parse(request.input).catalog.values.some(function (row) { return row[0] === 651 && row[2] === "total"; }));
  assert.match(request.instructions, /Never add remaining_unpaid merely because a balance remains/);
  assert.equal(parser.CONTRACT_VERSION, "history-fact-v73");

  var ui = fs.readFileSync(path.join(__dirname, "..", "app", "neplacila-zgodovina.js"), "utf8");
  assert.match(ui, /naravni\.candidates\.forEach[\s\S]{0,180}kljuci\.push\(kljucVprasanja/);
  assert.doesNotMatch(ui, /return (?:manjka|kandidat\.missing)\.length \? \{ candidateIndex/);
  assert.doesNotMatch(ui, /while \(naslednjiIndeks < naravni\.questionKeys\.length\)/);
  console.log("OK: total-vs-each contract, ledger in tri ločene kartice");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
