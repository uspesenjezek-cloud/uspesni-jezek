"use strict";

var assert = require("node:assert/strict");
var parser = require("../api/_lib/zgodovina-naravni-vnos");
var corpus = require("./test-zgodovina-live-luna-100");

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

var familyResults = {};
for (var index = 0; index < 100; index += 1) {
  var testCase = corpus.createCase(index);
  var contract = parser._test.buildFactContract(testCase.text);
  var result = parser._test.deterministicResult(testCase.text, corpus.CONTEXT);
  var family = "variant-" + (index % 10);
  familyResults[family] = (familyResults[family] || 0) + 1;

  assert.equal(result.coverage.complete, true, testCase.id + " mora imeti popoln evidence coverage");
  assert.equal(result.candidates.length, testCase.events.length, testCase.id + " ima napačno število dogodkov");
  testCase.events.forEach(function (expected, eventIndex) {
    var actual = result.candidates[eventIndex];
    assert.equal(actual.type, expected.type, testCase.id + " napačen tip #" + eventIndex);
    assert.equal(roundMoney(actual.amount), roundMoney(expected.amount), testCase.id + " napačen znesek #" + eventIndex);
    assert.equal(actual.occurredDate || null, expected.occurredDate, testCase.id + " napačen datum #" + eventIndex);
    assert.equal(actual.paymentMethod || null, expected.paymentMethod, testCase.id + " napačna metoda #" + eventIndex);
  });
  assert.deepEqual(result.ledger.map(function (entry) { return roundMoney(entry.afterEur); }), testCase.ledger, testCase.id + " napačen ledger");
  assert.equal(parser._test.shouldRequestSemanticPlan(testCase.text, contract, result), true, testCase.id + " mora zahtevati Luna plan v izrecnem testu");
}

assert.deepEqual(Object.values(familyResults), Array(10).fill(10));
console.log("✓ Luna full-text-plan lokalni corpus: 100/100; 10 družin × 10; brez zunanjih klicev");
