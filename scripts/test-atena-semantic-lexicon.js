"use strict";

var assert = require("node:assert/strict");
var lexicon = require("../api/_lib/atena-luna-semantic-lexicon");
var contract = require("../api/_lib/atena-luna-catalog-contract");

var EXPECTED = Object.freeze({ goal: 12, agreement: 6, history: 17 });
var total = 0;

assert.equal(lexicon.VERSION, "atena-semantic-lexicon-v1");
Object.keys(EXPECTED).forEach(function (flow) {
  var profiles = lexicon.PROFILES[flow];
  assert.ok(profiles, "manjka tok " + flow);
  assert.equal(Object.keys(profiles).length, EXPECTED[flow], "napačno število profilov za " + flow);
  Object.entries(profiles).forEach(function (entry) {
    var key = entry[0];
    var value = entry[1];
    assert.ok(value.context.length >= 70, flow + "." + key + " potrebuje jasen kontekst");
    assert.ok(value.synonyms.length >= 4, flow + "." + key + " potrebuje široke sopomenke");
    assert.ok(value.colloquial.length >= 2, flow + "." + key + " potrebuje pogovorne oblike");
    assert.ok(value.semanticSignals.length >= 3, flow + "." + key + " potrebuje pomenske signale");
    assert.ok(value.confusableWith.length >= 2, flow + "." + key + " potrebuje meje do podobnih kartic");
    total += 1;
  });
});
assert.equal(total, 35);

[lexicon.PROFILES.goal.custom_goal, lexicon.PROFILES.agreement.custom, lexicon.PROFILES.history.custom].forEach(function (value) {
  assert.match(value.confusableWith.join(" "), /neznan|neznano|neznane/i, "custom ne sme biti rešitev za neznano besedo");
});

var policy = lexicon.languagePolicy();
assert.equal(policy.aliasesAreExamplesNotKeywords, true);
assert.equal(policy.research.maxSearches, 1);
assert.equal(policy.research.queryScope, "isolated_non_identifying_term_only");
assert.match(policy.rules.join(" "), /Never search the full user sentence/);
assert.match(lexicon.semanticInstructions(), /whole clause/);
assert.match(lexicon.semanticInstructions(), /Never choose custom merely because one word is unfamiliar/);

assert.throws(function () {
  contract.buildCardGuide([{ cardId: 999, key: "missing", title: "Missing", fieldIds: [] }], [], [], { flow: "goal" });
}, /ATENA_LANGUAGE_PROFILE_MISSING:goal:missing/);

console.log("OK Atena semantic lexicon: 35/35 kartic ima kontekst, sopomenke, pogovorne oblike, signale in meje");
