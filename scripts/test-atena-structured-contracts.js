"use strict";

var assert = require("node:assert/strict");
var performance = require("node:perf_hooks").performance;
var fs = require("node:fs");
var path = require("node:path");
var contracts = require("../api/_lib/atena-structured-contracts");

var source = "Dolžnik bo plačal 100 € in nato še 100 €.";
var document = contracts.createDocument(source);
var firstStart = source.indexOf("100 €");
var secondStart = source.indexOf("100 €", firstStart + 1);
var first = contracts.createEvidenceSpan(document, "100 €", "clause-1");
var second = contracts.createEvidenceSpan(document, "100 €", "clause-2", secondStart);

assert.equal(first.start, firstStart);
assert.equal(second.start, secondStart);
assert.equal(contracts.verifyEvidenceSpan(document, first), true);
assert.equal(contracts.verifyEvidenceSpan(document, second), true);
assert.deepEqual(contracts.legacySourceSpan(second), { start: secondStart, end: secondStart + 5, text: "100 €" });
assert.equal(contracts.createEvidenceSpan(document, "ni v dokumentu", "clause-1"), null);
assert.equal(contracts.createEvidenceSpan(document, "", "clause-1"), null);
assert.equal(contracts.verifyEvidenceSpan(contracts.createDocument(source + " popravek"), first), false);
assert.equal(contracts.verifyEvidenceSpan(document, Object.assign({}, first, { start: first.start + 1 })), false);

var agreementSchema = contracts.agreementProposalSchema([1, 2], 5, ["agreement_kind"]);
var item = { cardId: 1, amount: 100, occurredDate: null, promisedDate: "2026-09-30", communicationChannel: "phone", description: null, evidence: "100 €" };
assert.equal(agreementSchema.safeParse({ agreements: [item], question: null, evidence: null }).success, true);
assert.equal(agreementSchema.safeParse({ agreements: [], question: "agreement_kind", evidence: "100 €" }).success, true);
assert.equal(agreementSchema.safeParse({ agreements: [], question: null, evidence: null }).success, false);
assert.equal(agreementSchema.safeParse({ agreements: [item], question: "agreement_kind", evidence: "100 €" }).success, false);
assert.equal(agreementSchema.safeParse({ agreements: [], question: "prosto vprašanje", evidence: "100 €" }).success, false);
assert.equal(agreementSchema.safeParse({ agreements: [Object.assign({}, item, { cardId: 99 })], question: null, evidence: null }).success, false);
assert.equal(agreementSchema.safeParse({ agreements: [Object.assign({}, item, { promisedDate: "2026-02-31" })], question: null, evidence: null }).success, false);

var advisorSchema = contracts.advisorBlockPlanSchema(["ponudba"], [1022], ["c1", "c2"]);
var advisorPlan = { state: "ask", actionCode: "ponudba", profileId: 1022, batchTitle: "Pogodbeni pogoji", rationale: "Preverimo ključne manjkajoče podatke.", evidence: "plačal", blockCodes: ["c1", "c2"] };
assert.equal(advisorSchema.safeParse(advisorPlan).success, true);
assert.equal(advisorSchema.safeParse(Object.assign({}, advisorPlan, { blockCodes: ["c1", "c1"] })).success, false);
assert.equal(advisorSchema.safeParse(Object.assign({}, advisorPlan, { profileId: null })).success, false);
assert.equal(advisorSchema.safeParse(Object.assign({}, advisorPlan, { state: "review", blockCodes: [] })).success, true);

var historySchema = contracts.historyProposalSchema([1, 2], [1, 2], 5);
var historyCard = { c: 1, e: "plačal 100", i: [1], v: [100], x: ["100"], r: [[]] };
assert.equal(historySchema.safeParse({ p: [historyCard], q: null, x: null, k: null }).success, true);
assert.equal(historySchema.safeParse({ p: [], q: "Koliko je plačal?", x: "plačal", k: 1 }).success, true);
assert.equal(historySchema.safeParse({ p: [], q: "300 € presega dolg 232 €.", x: "3 obroke po 100", k: 2 }).success, true);
assert.equal(historySchema.safeParse({ p: [historyCard], q: "Koliko?", x: "plačal", k: 1 }).success, false);
assert.equal(historySchema.safeParse({ p: [Object.assign({}, historyCard, { c: 99 })], q: null, x: null, k: null }).success, false);
assert.equal(historySchema.safeParse({ p: [Object.assign({}, historyCard, { i: [1, 1], v: [100, 100], x: ["100", "100"], r: [[], []] })], q: null, x: null, k: null }).success, false);

var goalSchema = contracts.goalProposalSchema([1, 2], [101, 102], [501], 5);
var goalCard = { n: 1, c: 1, k: 1, f: [{ i: 101, v: "100", o: null, e: "@2:2" }], e: "@1:2" };
assert.equal(goalSchema.safeParse({ p: [goalCard], q: null, x: "@1:2" }).success, true);
assert.equal(goalSchema.safeParse({ p: [], q: "Kaj želite doseči?", x: "@1:2" }).success, true);
assert.equal(goalSchema.safeParse({ p: [goalCard], q: "Kaj?", x: "@1:2" }).success, false);
assert.equal(goalSchema.safeParse({ p: [Object.assign({}, goalCard, { c: 99 })], q: null, x: "@1:2" }).success, false);
assert.equal(goalSchema.safeParse({ p: [Object.assign({}, goalCard, { e: "izmišljen dokaz" })], q: null, x: "@1:2" }).success, false);
var compactSchema = contracts.compactJsonSchema(require("zod").z.toJSONSchema(advisorSchema));
assert.doesNotMatch(JSON.stringify(compactSchema), /"const":/);
assert.ok(JSON.stringify(compactSchema).length < JSON.stringify(require("zod").z.toJSONSchema(advisorSchema)).length);

var handlerSource = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "razcleni-svetovalec.js"), "utf8");
assert.match(handlerSource, /require\("\.\.\/_lib\/svetovalec-luna-block-router"\)/);
assert.doesNotMatch(handlerSource, /require\([^)]*svetovalec-luna-batch-engine/);

var samples = [];
for (var index = 0; index < 5000; index += 1) {
  var started = performance.now();
  var span = contracts.createEvidenceSpan(document, "100 €", "clause-1", firstStart);
  assert.equal(contracts.verifyEvidenceSpan(document, span), true);
  samples.push(performance.now() - started);
}
samples.sort(function (a, b) { return a - b; });
function percentile(value) { return samples[Math.min(samples.length - 1, Math.floor(samples.length * value))]; }
assert.ok(percentile(0.95) < 5, "EvidenceSpan p95 mora ostati pod 5 ms.");

console.log(JSON.stringify({ ok: true, contractVersion: contracts.CONTRACT_VERSION, benchmarkMs: { p50: percentile(0.5), p95: percentile(0.95), max: samples[samples.length - 1] } }, null, 2));
