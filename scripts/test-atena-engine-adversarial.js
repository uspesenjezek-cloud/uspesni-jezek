"use strict";

var assert = require("node:assert/strict");
var performance = require("node:perf_hooks").performance;
var policy = require("../api/_lib/atena-luna-policy");
var history = require("../api/_lib/zgodovina-naravni-vnos");
var agreement = require("../api/_lib/dogovor-naravni-vnos");
var goal = require("../api/_lib/cilj-naravni-vnos");
var offer = require("../app/ponudba-moduli-engine");

function percentile(values, ratio) {
  var ordered = values.slice().sort(function (a, b) { return a - b; });
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))];
}

function goalField(key, value, evidence) {
  var optionId = goal._test.valueIdByFieldValue[key + ":" + value];
  return { i: goal._test.fieldIdByKey[key], v: optionId ? null : String(value), o: optionId || null, e: evidence };
}

function goalCard(number, goalId, fields, evidence) {
  return { n: number, c: goal._test.cardIdByGoal[goalId], k: 1, f: fields || [], e: evidence };
}

function goalPlan(cards, evidence) {
  return { p: cards, q: null, x: evidence };
}

function agreementPlan(source) {
  return {
    agreements: [{
      cardId: 1, amount: 100, occurredDate: null, promisedDate: "2026-08-31",
      communicationChannel: "unknown", description: source, evidence: source,
    }],
    question: null,
    evidence: null,
  };
}

async function main() {
  var exactSource = "Plačal je 100 EUR";
  assert.deepEqual(policy.exactEvidenceSpan(exactSource, "100 EUR"), { start: 10, end: 17, text: "100 EUR" });
  assert.equal(policy.evidenceIsLinked(exactSource, "100 eur"), false);
  assert.equal(policy.evidenceIsLinked("dve  besedi", "dve besedi"), false);
  assert.equal(policy.responseText({ output: [{ content: [{ text: "{\"a\":" }, { text: "1}" }] }] }), "{\"a\":1}");

  [history.RESPONSE_SCHEMA, agreement.RESPONSE_SCHEMA, goal.RESPONSE_SCHEMA].forEach(function (schema) {
    assert.equal(policy.assertPortableResponseSchema(schema), true);
  });

  var historyPlan = {
    p: [{ c: 1, e: exactSource, i: [1], v: [100], x: ["100 EUR"], r: [[]] }],
    q: null,
    x: null,
  };
  assert.equal(history._test.parseLeanCompactPlan(JSON.stringify(historyPlan), exactSource).verdict, "solution");
  assert.equal(history._test.parseLeanCompactPlan(JSON.stringify(Object.assign({ extra: true }, historyPlan)), exactSource).ok, false);
  var legacyHistoryCard = { n: 1, c: 1, e: exactSource, f: [{ i: 1, v: 100, e: "100 EUR", r: [] }] };
  assert.equal(history._test.parseLeanCompactPlan(JSON.stringify({ p: [legacyHistoryCard], q: null, x: null }), exactSource).verdict, "solution");
  assert.equal(history._test.parseLeanCompactPlan(JSON.stringify({
    p: [Object.assign({ extra: true }, legacyHistoryCard)], q: null, x: null,
  }), exactSource).reason, "luna_compact_card_shape");
  assert.equal(history._test.parseLeanCompactPlan(JSON.stringify({
    p: [{ c: 1, e: exactSource, i: [1, 1], v: [100, 100], x: ["100 EUR", "100 EUR"], r: [[], []] }], q: null, x: null,
  }), exactSource).reason, "luna_compact_field_duplicate");
  var surfaceAlignedHistory = history._test.parseLeanCompactPlan(JSON.stringify({
    p: [{ c: 1, e: "plačal je 100 EUR", i: [1], v: [100], x: ["100 EUR"], r: [[]] }], q: null, x: null,
  }), exactSource);
  assert.equal(surfaceAlignedHistory.verdict, "solution");
  assert.equal(surfaceAlignedHistory.items[0].evidenceText, "plačal je 100 EUR", "history adapter ne sme popravljati Luninega evidence");
  assert.equal(history._test.parseLeanCompactPlan(JSON.stringify({ p: [], q: "Koliko?", x: "100 EUR" }), exactSource).verdict, "clarification");
  assert.equal(history._test.parseLeanCompactPlan(JSON.stringify({ p: [], q: "Koliko?", x: "100 eur" }), exactSource).evidenceText, "100 eur");

  var agreementSource = "rekel je, da bo plačal 100 EUR jutri";
  var validAgreement = agreement._test.materializeLunaProposal(agreementPlan(agreementSource), { remainingDebt: 434 }, agreementSource);
  assert.equal(validAgreement.candidates.length, 1);
  assert.equal(validAgreement.ledger[0].effectEur, 0);
  assert.equal(validAgreement.candidates[0].evidence.sourceSpan.text, agreementSource);
  var mixedAgreement = agreementPlan(agreementSource);
  mixedAgreement.question = "Kdaj?";
  assert.equal(agreement._test.materializeLunaProposal(mixedAgreement, { remainingDebt: 434 }, agreementSource), null);
  var unlinkedAgreement = agreementPlan(agreementSource);
  unlinkedAgreement.agreements[0].evidence = "izmišljeno";
  assert.equal(agreement._test.materializeLunaProposal(unlinkedAgreement, { remainingDebt: 434 }, agreementSource), null);
  var stringAmountAgreement = agreementPlan(agreementSource);
  stringAmountAgreement.agreements[0].amount = "100";
  assert.equal(agreement._test.materializeLunaProposal(stringAmountAgreement, { remainingDebt: 434 }, agreementSource), null);
  var extraAgreement = agreementPlan(agreementSource);
  extraAgreement.agreements[0].extra = true;
  assert.equal(agreement._test.materializeLunaProposal(extraAgreement, { remainingDebt: 434 }, agreementSource), null);
  var exhaustedAgreement = agreement._test.clarificationResult(
    { agreements: [], question: "Kaj je sprejel?", evidence: "rekel je" },
    { remainingDebt: 434, clarification: { round: 2 } },
    agreementSource
  );
  assert.equal(exhaustedAgreement.clarification, null);
  assert.equal(exhaustedAgreement.clarificationExhausted, true);

  var goalSource = "hočem celotno plačilo";
  var validGoalPlan = goalPlan([goalCard(1, "full_payment", [goalField("targetAmount", "434", "celotno plačilo")], goalSource)], goalSource);
  assert.equal(goal._test.materialize(validGoalPlan, { remainingDebt: 434 }, goalSource).length, 1);
  var mixedGoal = goalPlan([goalCard(1, "full_payment", [], goalSource)], goalSource);
  mixedGoal.q = "Kaj?";
  assert.equal(goal._test.materialize(mixedGoal, { remainingDebt: 434 }, goalSource), null);
  assert.equal(goal._test.materialize(goalPlan([
    { n: 1, c: 999, k: 1, f: [], e: goalSource },
    goalCard(2, "full_payment", [], goalSource),
  ], goalSource), { remainingDebt: 434 }, goalSource), null);
  assert.equal(goal._test.materialize(goalPlan([goalCard(1, "full_payment", [
    goalField("targetAmount", "434", goalSource),
    goalField("targetAmount", "434", goalSource),
  ], goalSource)], goalSource), { remainingDebt: 434 }, goalSource), null);
  assert.equal(goal._test.materialize(goalPlan([goalCard(1, "full_payment", [
    goalField("targetAmount", "1e3", goalSource),
  ], goalSource)], goalSource), { remainingDebt: 434 }, goalSource), null);
  assert.equal(goal._test.materialize(goalPlan([goalCard(1, "new_deadline", [
    goalField("newDeadline", "čez tri mesece", goalSource),
  ], goalSource)], goalSource), { remainingDebt: 434 }, goalSource), null);
  assert.equal(goal._test.clarificationResult({ p: [], q: "Kaj želite?", x: goalSource }, { clarificationRound: 2 }, goalSource).clarificationExhausted, true);
  assert.equal(goal._test.clarificationResult({ p: [], q: "Kaj želite?", x: "HOČEM" }, { clarificationRound: 0 }, goalSource), null);

  var offerSource = "Paket stane 39 EUR mesečno.";
  var validOffer = {
    profileId: 1014, offerModelIds: [2005], salesChannelIds: [3005], moduleIds: [4010],
    facts: [{ fieldId: 5106, value: "39 EUR mesečno", evidence: "39 EUR mesečno" }],
  };
  assert.equal(offer.validateLunaProposal(validOffer, offerSource).facts.length, 1);
  assert.equal(offer.validateLunaProposal(Object.assign({}, validOffer, { moduleIds: [4010, 4010] }), offerSource), null);
  assert.equal(offer.validateLunaProposal(Object.assign({}, validOffer, { moduleIds: [9999] }), offerSource), null);
  assert.equal(offer.validateLunaProposal(Object.assign({}, validOffer, { moduleIds: [] }), offerSource), null);
  assert.equal(offer.validateLunaProposal(Object.assign({}, validOffer, { facts: [
    validOffer.facts[0], validOffer.facts[0],
  ] }), offerSource), null);
  assert.equal(offer.validateLunaProposal(Object.assign({}, validOffer, { extra: true }), offerSource), null);

  var invalidOutcomeRuntime = { cache: new Map(), inflight: new Map() };
  var invalidOutcome = await policy.executeIdempotent(invalidOutcomeRuntime, {
    key: "goal:test:invalid-outcome", fingerprint: "same", fallbackMessage: "Varna napaka.",
  }, async function () { return { statusCode: 200, payload: null }; });
  assert.equal(invalidOutcome.statusCode, 503);
  assert.equal(invalidOutcome.payload.retryable, true);
  assert.equal(invalidOutcomeRuntime.cache.size, 0);

  var timings = [];
  for (var index = 0; index < 2000; index += 1) {
    var startedAt = performance.now();
    goal._test.materialize(validGoalPlan, { remainingDebt: 434 }, goalSource);
    agreement._test.materializeLunaProposal(agreementPlan(agreementSource), { remainingDebt: 434 }, agreementSource);
    offer.validateLunaProposal(validOffer, offerSource);
    timings.push(performance.now() - startedAt);
  }
  var p50 = percentile(timings, 0.5);
  var p95 = percentile(timings, 0.95);
  var max = Math.max.apply(null, timings);
  assert.ok(p95 < 15, "strogi adapterji morajo ostati interaktivni, p95=" + p95.toFixed(3) + " ms");
  console.log("Atena/Luna adversarial PASS: strict schema/IDs, history Luna passthrough, exclusive plan vs clarification, max rounds, zero-ledger agreement; p50 " + p50.toFixed(3) + " ms, p95 " + p95.toFixed(3) + " ms, max " + max.toFixed(3) + " ms");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
