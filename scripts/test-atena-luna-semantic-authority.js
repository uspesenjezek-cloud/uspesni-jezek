"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var policy = require("../api/_lib/atena-luna-policy");
var history = require("../api/_lib/zgodovina-naravni-vnos");
var agreement = require("../api/_lib/dogovor-naravni-vnos");
var goal = require("../api/_lib/cilj-naravni-vnos");
var offer = require("../api/_lib/ponudba-luna-engine");

assert.equal(policy.SEMANTIC_AUTHORITY_VERSION, "luna-semantic-authority-v3");
assert.equal(policy.REASONING_METHOD_VERSION, "luna-compositional-reasoning-v1");
assert.equal(policy.assertAdapterOperations(policy.ADAPTER_OPERATIONS), true);
assert.throws(function () {
  policy.assertAdapterOperations(["semantic_source_reinterpretation"]);
}, function (error) {
  return error && error.code === "ATENA_FORBIDDEN_POST_LUNA_OPERATION";
});

[
  agreement.requestBody("rekel je, da bo plačal jutri", { referenceDate: "2026-08-30", remainingDebt: 434 }, "test").instructions,
  goal.requestBody("hočem plačilo v celoti", { referenceDate: "2026-08-30", remainingDebt: 434 }, "test").instructions,
  offer.contract().instructions.join(" "),
].forEach(function (instructions) {
  assert.match(instructions, /HARD COMPOSITIONAL REASONING METHOD \(luna-compositional-reasoning-v1\)/);
  ["condition", "fallback", "alternative", "exception", "negation", "sequence", "repetition", "ownership"].forEach(function (relation) {
    assert.match(instructions, new RegExp(relation), "vsak Lunin tok mora poznati relacijo " + relation);
  });
  assert.match(instructions, /audit the whole source clause by clause/i);
  assert.match(instructions, /examples are demonstrations, never keyword rules/);
});
var historyInstructions = history.requestBody("včeraj je plačal 100", { referenceDate: "2026-08-30", remainingDebt: 434 }, "test").instructions;
assert.match(historyInstructions, /only semantic authority/);
assert.match(historyInstructions, /Read the whole source/);
assert.match(historyInstructions, /choose all card IDs, field IDs and values/);
assert.match(historyInstructions, /source order, all completed repeats expanded/);
assert.match(historyInstructions, /meaning map, not a keyword list/);
assert.match(historyInstructions, /material meaning is ambiguous/);
[
  agreement.requestBody("rekel je, da bo plačal jutri", { referenceDate: "2026-08-30", remainingDebt: 434 }, "test").instructions,
  goal.requestBody("hočem plačilo v celoti", { referenceDate: "2026-08-30", remainingDebt: 434 }, "test").instructions,
].forEach(function (instructions) {
  assert.match(instructions, /HARD SEMANTIC AUTHORITY BOUNDARY \(luna-semantic-authority-v3\)/);
  assert.match(instructions, /MUST NOT reread the source/);
  assert.match(instructions, /MUST NOT replace a card/);
});
assert.match(historyInstructions, /only validates JSON and closed IDs/);
assert.match(historyInstructions, /never checks or repairs semantics, evidence, amounts, dates, order, installments, coverage or debt/);
assert.match(historyInstructions, /DEBT-FIRST HARD BOUNDARY/);
assert.match(historyInstructions, /Sum every completed reduction/);
assert.match(historyInstructions, /N\*each installment, stated group totals, credit notes and compensations/);
assert.match(historyInstructions, /return p=\[\],k=2/);
assert.match(historyInstructions, /q naming aggregate and debt/);
assert.match(historyInstructions, /no answer, partial cards/);
assert.match(historyInstructions, /capping, altering or dropping/);

var debtFirstRequest = history.requestBody(
  "plačal je 3 obroke po 100 evrov vsak obrok je bil v razmaku tedna dni",
  { referenceDate: "2026-08-31", originalDebt: 232, remainingDebt: 232 },
  "debt-first-regression"
);
var debtFirstInput = JSON.parse(debtFirstRequest.input);
assert.deepEqual(Object.keys(debtFirstInput).slice(0, 3), ["contractVersion", "catalog", "debtEur"]);
assert.deepEqual(debtFirstInput.debtEur, { original: 232, remaining: 232 });
assert.equal(debtFirstInput.sourceText, "plačal je 3 obroke po 100 evrov vsak obrok je bil v razmaku tedna dni");

var goalPlan = {
  p: [{ n: 1, c: goal._test.cardIdByGoal.full_payment, k: 1, e: "vse plača", f: [
    { i: goal._test.fieldIdByKey.targetAmount, v: "434", o: null, e: "vse plača" },
  ] }], q: null, x: "vse plača",
};
var mappedGoal = goal._test.materialize(goalPlan, { remainingDebt: 434 }, "vse plača, odpustim 100 evrov");
assert.equal(mappedGoal[0].goalId, "full_payment", "adapter ne sme zamenjati Lunine kartice z lokalnim branjem vira");

var root = path.join(__dirname, "..");
var historySource = fs.readFileSync(path.join(root, "api", "_lib", "zgodovina-naravni-vnos.js"), "utf8");
var historyAdapter = historySource.slice(historySource.indexOf("function materializeLunaFieldPlan"), historySource.indexOf("function expandCompactPlanResponse"));
assert.doesNotMatch(historyAdapter, /validateLean|validateLuna|canonicalDateFromRelation|canonicalRelationNumbersSupported|numberEngine|installmentEngine|evidenceIsLinked|semanticRetries|repairReason/);
assert.match(historyAdapter, /\["schema_validation", "catalog_id_mapping", "human_review_projection"\]/);
var goalSource = fs.readFileSync(path.join(root, "api", "_lib", "cilj-naravni-vnos.js"), "utf8");
var goalAdapter = goalSource.slice(goalSource.indexOf("function materialize("), goalSource.indexOf("function aiError"));
assert.doesNotMatch(goalAdapter, /applySettlementDiscountInvariant|explicitSettlementDiscount|odpust|odpis|popust/);

assert.equal(history.CONTRACT_VERSION, "history-fact-v99");
assert.equal(agreement.CONTRACT_VERSION, "agreement-fact-v7");
assert.equal(goal.CONTRACT_VERSION, "goal-fact-v17");

console.log("Atena semantic authority passed: history locally maps only schema/IDs into mandatory human review; Luna owns meaning.");
