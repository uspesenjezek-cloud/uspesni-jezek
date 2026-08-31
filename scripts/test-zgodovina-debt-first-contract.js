"use strict";

var assert = require("node:assert/strict");
var parser = require("../api/_lib/zgodovina-naravni-vnos");

var context = { referenceDate: "2026-08-31", originalDebt: 232, remainingDebt: 232 };
var overDebtText = "plačal je 3 obroke po 100 evrov vsak obrok je bil v razmaku tedna dni";
var validPartialText = "plačal je 2 obroka po 10 mesec dni nazaj i v razmaku 2h dneh.. potem pa je danes plačal 100";

function response(output) {
  return {
    ok: true,
    status: 200,
    headers: { get: function () { return null; } },
    json: async function () { return { output_text: JSON.stringify(output) }; },
  };
}

function assertDebtFirstRequest(text, expectedDebt) {
  var body = parser.requestBody(text, {
    referenceDate: context.referenceDate,
    originalDebt: expectedDebt,
    remainingDebt: expectedDebt,
  }, "debt-first-family");
  var input = JSON.parse(body.input);
  assert.deepEqual(Object.keys(input).slice(0, 3), ["contractVersion", "catalog", "debtEur"]);
  assert.deepEqual(input.debtEur, { original: expectedDebt, remaining: expectedDebt });
  assert.equal(input.sourceText, text);
  assert.match(body.instructions, /DEBT-FIRST HARD BOUNDARY/);
  assert.match(body.instructions, /aggregate>active debt/);
  assert.match(body.instructions, /Every aggregate<=active debt is valid partial history/);
  assert.match(body.instructions, /STRICT ONE-SIDED GREATER-THAN TEST/);
  assert.match(body.instructions, /2\*10\+100=120/);
  assert.match(body.instructions, /because 120<232, return k=null and three payment cards/);
  assert.match(body.instructions, /credit notes and compensations/);
  assert.match(body.instructions, /explicit remaining balance contradicts arithmetic/);
  return body;
}

async function main() {
  assert.equal(parser.CONTRACT_VERSION, "history-fact-v99");

  [
    [overDebtText, 232],
    ["plačal je 2 obroka po 116 evrov", 232],
    ["plačal je 2 obroka po 100 evrov", 232],
    ["plačal je 100 evrov, nato je dobil dobropis 50 evrov in kompenzacijo 25 evrov", 232],
    ["plačal je 100 evrov, ostane pa še 200 evrov", 232],
  ].forEach(function (entry) { assertDebtFirstRequest(entry[0], entry[1]); });

  var validPartial = await parser.analyze(validPartialText, context, {
    apiKey: "test-only",
    fetchImpl: async function () {
      return response({
        p: [
          { c: 3, e: "plačal je 2 obroka po 10 mesec dni nazaj i v razmaku 2h dneh", i: [1, 2, 8], v: [10, "2026-07-31", "1/2 obrok"], x: ["10", "mesec dni nazaj", "2 obroka"], r: [[652], [601, 611, 621, 631, 1, 643, null], []] },
          { c: 3, e: "plačal je 2 obroka po 10 mesec dni nazaj i v razmaku 2h dneh", i: [1, 2, 8], v: [10, "2026-08-02", "2/2 obrok"], x: ["10", "2h dneh", "2 obroka"], r: [[652], [601, 611, 622, 633, 2, 641, null], []] },
          { c: 1, e: "potem pa je danes plačal 100", i: [1, 2], v: [100, "2026-08-31"], x: ["100", "danes"], r: [[], []] },
        ],
        q: null,
        x: null,
        k: null,
      });
    },
  });
  assert.equal(validPartial.semanticPlan.status, "OK");
  assert.ok(validPartial.clarification == null, "120 EUR pri dolgu 232 EUR ne sme biti opozorilo ali podvprašanje");
  assert.deepEqual(validPartial.candidates.map(function (candidate) { return candidate.amount; }), [10, 10, 100]);
  assert.equal(validPartial.projectedRemainingDebtEur, 112);

  var calls = 0;
  var blocked = await parser.analyze(overDebtText, context, {
    apiKey: "test-only",
    fetchImpl: async function (_url, options) {
      calls += 1;
      var request = JSON.parse(options.body);
      var input = JSON.parse(request.input);
      assert.deepEqual(input.debtEur, { original: 232, remaining: 232 });
      assert.equal(input.sourceText, overDebtText);
      return response({
        p: [],
        q: "Skupaj ste navedli 300 €, trenutni dolg pa je 232 €. Popravite dolg, znesek ali število obrokov.",
        x: overDebtText,
        k: 2,
      });
    },
  });
  assert.equal(calls, 1);
  assert.equal(blocked.semanticPlan.status, "VALIDATION_WARNING");
  assert.equal(blocked.semanticPlan.reason, "luna_validation_warning");
  assert.deepEqual(blocked.candidates, []);
  assert.equal(blocked.clarification.kind, "warning");
  assert.equal(blocked.clarification.round, 0);
  assert.match(blocked.clarification.question, /300 €/);
  assert.match(blocked.clarification.question, /232 €/);

  var ambiguousText = "plačal je nekaj";
  var clarification = await parser.analyze(ambiguousText, context, {
    apiKey: "test-only",
    fetchImpl: async function () {
      return response({
        p: [],
        q: "Kolikšen znesek je plačal?",
        x: ambiguousText,
        k: 1,
      });
    },
  });
  assert.equal(clarification.semanticPlan.status, "CLARIFICATION_REQUIRED");
  assert.equal(clarification.semanticPlan.reason, "luna_clarification_requested");
  assert.equal(clarification.clarification.kind, "question");
  assert.equal(clarification.clarification.round, 1);

  var nonCompliantSource = "plačal je 300 evrov";
  var nonCompliant = await parser.analyze(nonCompliantSource, context, {
    apiKey: "test-only",
    fetchImpl: async function () {
      return response({
        p: [{
          c: 1,
          e: nonCompliantSource,
          i: [1, 2],
          v: [300, null],
          x: ["300 evrov", nonCompliantSource],
          r: [[], []],
        }],
        q: null,
        x: null,
        k: null,
      });
    },
  });
  assert.equal(nonCompliant.semanticPlan.status, "OK", "lokalni adapter ne sme postati druga semantična avtoriteta");
  assert.equal(nonCompliant.candidates.length, 1);
  assert.equal(nonCompliant.candidates[0].amount, 300);
  assert.equal(nonCompliant.candidates[0].requiresHumanReview, true);

  console.log("History debt-first v99 passed: 120 < 232 creates 3 cards, 300 > 232 remains a blocking overpayment warning, adapter remains semantic-free.");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
