"use strict";

var assert = require("node:assert/strict");
var goal = require("../api/_lib/cilj-naravni-vnos");
var agreement = require("../api/_lib/dogovor-naravni-vnos");
var history = require("../api/_lib/zgodovina-naravni-vnos");
var policy = require("../api/_lib/atena-luna-policy");

function assertComplete(engine, text, context, expectedVersion, expectedCards) {
  var body = engine.requestBody(text, context, "catalog-test-user");
  var input = JSON.parse(body.input);
  assert.equal(input.contractVersion, expectedVersion);
  assert.equal(input.catalog.guide.length, expectedCards);
  if (Array.isArray(input.catalog.guideColumns)) {
    assert.match(body.instructions, /Read catalog\.guide rows by catalog\.guideColumns/);
    assert.deepEqual(input.catalog.guideColumns, ["cardId", "key", "title", "useWhen", "doNotUseWhen", "aliases", "examples"]);
    input.catalog.guide.forEach(function (card) {
      assert.ok(Array.isArray(card) && Number.isInteger(card[0]));
      assert.ok(card[1] && card[2] && card[3] && card[4]);
      assert.ok(Array.isArray(card[5]) && card[5].length >= 4);
      assert.ok(Array.isArray(card[6]) && card[6].length > 0);
    });
    input.catalog.cards.forEach(function (card) {
      assert.ok(Array.isArray(card[2]) && Array.isArray(card[3]));
      card[2].forEach(function (fieldId) { assert.ok(Number.isInteger(fieldId)); });
      card[3].forEach(function (fieldId) { assert.ok(card[2].includes(fieldId)); });
    });
  } else {
    assert.match(body.instructions, /FIRST read every entry in catalog\.guide/);
    input.catalog.guide.forEach(function (card) {
      assert.ok(Number.isInteger(card.cardId));
      assert.ok(card.key && card.title && card.useWhen && card.doNotUseWhen);
      assert.ok(Array.isArray(card.examples) && card.examples.length > 0);
      assert.ok(card.languageProfile && card.languageProfile.context);
      assert.ok(Array.isArray(card.languageProfile.synonyms) && card.languageProfile.synonyms.length >= 4);
      assert.ok(Array.isArray(card.languageProfile.colloquial) && card.languageProfile.colloquial.length >= 2);
      assert.ok(Array.isArray(card.languageProfile.semanticSignals) && card.languageProfile.semanticSignals.length >= 3);
      assert.ok(Array.isArray(card.languageProfile.confusableWith) && card.languageProfile.confusableWith.length >= 2);
      assert.ok(Array.isArray(card.fieldIds) && Array.isArray(card.requiredFieldIds));
      card.fieldIds.forEach(function (fieldId) { assert.ok(Number.isInteger(fieldId)); });
      card.requiredFieldIds.forEach(function (fieldId) { assert.ok(card.fieldIds.includes(fieldId)); });
    });
  }
  return { body: body, input: input };
}

var goalContract = assertComplete(goal, "hočem da se pokliče odvetnika in da se izpolne opomin", { remainingDebt: 8536, referenceDate: "2026-08-30" }, "goal-fact-v17", 12);
var legal = goalContract.input.catalog.guide.find(function (card) { return card.cardId === 9; });
var custom = goalContract.input.catalog.guide.find(function (card) { return card.cardId === 12; });
assert.equal(legal.key, "legal_recovery");
assert.match(legal.useWhen, /lawyer|attorney|legal representative/);
assert.ok(goalContract.input.catalog.values.find(function (value) { return value[0] === 90101; }));
assert.match(custom.doNotUseWhen, /lawyer|legal representative/);
assert.match(goalContract.body.instructions, /legal_recovery cardId 9/);
assert.match(goalContract.body.instructions, /legal_notice_payment valueId 90101/);

var agreementContract = assertComplete(agreement, "rekel je da bo vse plačal čez tri mesece", { originalDebt: 9446, remainingDebt: 9446, referenceDate: "2026-08-30" }, "agreement-fact-v7", 6);
assert.match(agreementContract.body.instructions, /Choose and return cardId yourself/);
assert.ok(agreement.RESPONSE_SCHEMA.properties.agreements.items.required.includes("cardId"));
assert.equal(agreement.RESPONSE_SCHEMA.properties.agreements.items.properties.type, undefined);

var historyContract = assertComplete(history, "včeraj je plačal 100 EUR", { originalDebt: 9446, remainingDebt: 9446, referenceDate: "2026-08-30" }, "history-fact-v99", 17);

[goalContract.input, agreementContract.input].forEach(function (input) {
  assert.equal(input.catalog.lexiconVersion, "atena-semantic-lexicon-v1");
  assert.equal(input.catalog.languagePolicy.aliasesAreExamplesNotKeywords, true);
  assert.equal(input.catalog.languagePolicy.research.queryScope, "isolated_non_identifying_term_only");
});
assert.equal(historyContract.input.catalog.lexiconVersion, "atena-semantic-lexicon-v1");
assert.equal(historyContract.input.catalog.languagePolicy, undefined, "history mora obdržati sopomenke brez podvojenega languagePolicy bloka");

[goalContract.body, agreementContract.body].forEach(function (body) {
  assert.equal(body.model, policy.MODEL);
  assert.equal(body.max_output_tokens, policy.MAX_OUTPUT_TOKENS);
  assert.equal(body.store, false);
  assert.match(body.instructions, /HARD SEMANTIC LANGUAGE RULE/);
  assert.match(body.instructions, /Never choose custom merely because one word is unfamiliar/);
});
assert.equal(historyContract.body.model, policy.MODEL);
assert.equal(historyContract.body.max_output_tokens, 1600);
assert.equal(historyContract.body.store, false);
assert.match(historyContract.body.instructions, /meaning map, not a keyword list/);
assert.match(historyContract.body.instructions, /custom is last resort/);
assert.deepEqual(goalContract.body.reasoning, { effort: "medium" }, "ciljni pregled mora ostati znotraj interaktivnega časovnega okna");
assert.deepEqual(agreementContract.body.reasoning, { effort: policy.REASONING_EFFORT });
assert.deepEqual(historyContract.body.reasoning, { effort: "low" });
assert.equal(goal.MAX_TEXT_LENGTH, policy.MAX_SOURCE_TEXT_LENGTH);
assert.equal(agreement.MAX_TEXT_LENGTH, policy.MAX_SOURCE_TEXT_LENGTH);
assert.equal(history.MAX_TEXT_LENGTH, policy.MAX_SOURCE_TEXT_LENGTH);
assert.equal(goal.MODEL_TIMEOUT_MS, policy.MODEL_TIMEOUT_MS);
assert.equal(agreement.MODEL_TIMEOUT_MS, policy.MODEL_TIMEOUT_MS);
assert.equal(history.MODEL_TIMEOUT_MS, 18000);
assert.equal(history.MODEL_TIMEOUT_MAX_MS, 25000);

console.log("OK Atena complete Luna catalog + shared policy: goal 12, agreement 6, history 17; numeric cardId, context, fields and values");
