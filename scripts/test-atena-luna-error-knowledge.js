"use strict";

var assert = require("node:assert/strict");
var knowledge = require("../api/_lib/atena-luna-error-knowledge");
var history = require("../api/_lib/zgodovina-naravni-vnos");
var goal = require("../api/_lib/cilj-naravni-vnos");
var temporalEngine = require("../api/_lib/zgodovina-temporal-engine");

assert.equal(knowledge.ERROR_KNOWLEDGE_VERSION, "atena-luna-error-knowledge-v1");
assert.ok(knowledge.ERROR_KNOWLEDGE.length >= 15);
assert.equal(new Set(knowledge.ERROR_KNOWLEDGE.map(function (entry) { return entry.id; })).size, knowledge.ERROR_KNOWLEDGE.length, "ID-ji napak morajo biti enolični");
knowledge.ERROR_KNOWLEDGE.forEach(function (entry) {
  ["id", "flow", "discoveredAt", "family", "context", "mistake", "avoid", "correct", "promptLesson"].forEach(function (key) {
    assert.ok(String(entry[key] || "").trim(), entry.id + " potrebuje " + key);
  });
  assert.ok(entry.regression && entry.regression.source && entry.regression.wrong && entry.regression.expected, entry.id + " potrebuje izvršljiv regresijski zapis");
});

var historyPrompt = history.requestBody(
  "mesec dni nazaj je placal 700 nato 2 tedna zajaj 300 in danes pa 100.. ostalo ni placal",
  { referenceDate: "2026-08-29", originalDebt: 9446, remainingDebt: 9446 },
  "error-knowledge-history"
).instructions;
var goalPrompt = goal.requestBody(
  "hočem da mi plača v treh obrokih če ne grem do odvetnika",
  { referenceDate: "2026-08-29", remainingDebt: 72 },
  "error-knowledge-goal"
).instructions;

[historyPrompt, goalPrompt].forEach(function (prompt) {
  assert.match(prompt, /KNOWN LUNA ERROR MEMORY \(atena-luna-error-knowledge-v1\)/);
  assert.match(prompt, /MISTAKE:/);
  assert.match(prompt, /AVOID:/);
  assert.match(prompt, /CORRECT:/);
  assert.match(prompt, /WRONG:/);
  assert.match(prompt, /EXPECTED:/);
});
assert.match(historyPrompt, /history-retrospective-reference-anchor-20260901/);
assert.match(historyPrompt, /nato\/potem\/zatem/);
assert.match(historyPrompt, /2 tedna zajaj/);
assert.match(historyPrompt, /history-sequential-payments-are-not-installments-20260901/);
assert.match(historyPrompt, /history-derived-remaining-balance-arithmetic-20260901/);
assert.match(historyPrompt, /history-compact-columns-and-response-state-20260901/);
assert.match(historyPrompt, /history-relative-month-preserves-known-calendar-part-20260901/);
assert.match(historyPrompt, /known YYYY-MM, missing dayOfMonth only/);
assert.doesNotMatch(historyPrompt, /goal-installments-legal-fallback-coverage-20260831/);
assert.match(goalPrompt, /goal-installments-legal-fallback-coverage-20260831/);
assert.match(goalPrompt, /goal-multistep-cardinality-evidence-audit-20260901/);
assert.match(goalPrompt, /goal-residual-strategy-is-not-empty-plan-20260901/);
assert.match(goalPrompt, /same exact source span may support shared facts/);
assert.match(goalPrompt, /existing n value as its distinct ordinal/);
assert.match(goalPrompt, /bare residual instruction/);
assert.match(goalPrompt, /top-level x is one non-empty @firstId:lastId range/);
assert.match(goalPrompt, /LOSSLESS EVIDENCE WIRE/);
assert.match(goalPrompt, /exact evidence is represented only by @firstTokenId:lastTokenId references/);
assert.match(goalPrompt, /hočem da mi plača v treh obrokih če ne grem do odvetnika/);
assert.match(goalPrompt, /three ordered installment_plan cards/);
assert.match(goalPrompt, /one legal_recovery card/);
assert.match(goalPrompt, /goal-explicit-option-id-serialization-20260901/);
assert.match(goalPrompt, /goal-reference-and-evidence-verbatim-20260901/);
assert.match(goalPrompt, /goal-lawyer-call-is-concrete-not-review-20260901/);
assert.match(goalPrompt, /goal-explicit-deadline-card-association-20260901/);
assert.match(goalPrompt, /securityDeadline 2026-09-05/);
assert.match(goalPrompt, /goal-evidence-token-range-bounds-20260901/);
assert.match(goalPrompt, /sourceTokenCount 21/);
assert.match(goalPrompt, /goal-option-id-must-belong-to-field-20260901/);
assert.match(goalPrompt, /i=603,o=60102/);
assert.match(goalPrompt, /goal-forward-deadline-belongs-to-following-action-20260901/);
assert.match(goalPrompt, /securityDeadline=2026-09-22/);
assert.match(goalPrompt, /goal-material-evidence-requires-material-value-20260901/);
assert.match(goalPrompt, /i=301,v=null,o=null,e=@5:6/);
assert.doesNotMatch(goalPrompt, /history-retrospective-reference-anchor-20260901/);

[
  ["nato 2 tedna nazaj", 2, "week"],
  ["nato 2 tedna zajaj", 2, "week"],
  ["potem dva tedna nasaj", 2, "week"],
  ["zatem dva tedna nazai", 2, "week"],
  ["pred 14 dnevi", 14, "day"],
  ["nato pred štirimi dnevi", 4, "day"],
].forEach(function (testCase) {
  var relations = temporalEngine.extractDateRelations(testCase[0]);
  assert.equal(relations.length, 1, "pričakovana je ena časovna relacija: " + testCase[0]);
  assert.equal(relations[0].anchor, "reference_date", testCase[0] + " mora ostati vezan na referenceDate");
  assert.equal(relations[0].direction, -1);
  assert.equal(relations[0].amount, testCase[1]);
  assert.equal(relations[0].unit, testCase[2]);
});

var forward = temporalEngine.extractDateRelations("nato čez 2 tedna");
assert.equal(forward.length, 1);
assert.equal(forward[0].anchor, "previous_event");
assert.equal(forward[0].direction, 1);
assert.equal(forward[0].amount, 2);
assert.equal(forward[0].unit, "week");

console.log("Atena/Luna error knowledge passed: 16 confirmed lessons, flow-specific prompt injection and temporal anchor matrix.");
