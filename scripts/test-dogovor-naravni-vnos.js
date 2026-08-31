"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var parser = require("../api/_lib/dogovor-naravni-vnos");

var context = { referenceDate: "2026-08-29", originalDebt: 9446, remainingDebt: 9446 };
function lunaResponse(agreements, question, evidence) {
  return async function () {
    return { ok: true, json: async function () { return { output_text: JSON.stringify({ agreements: agreements || [], question: question || null, evidence: evidence || null }) }; } };
  };
}
function agreement(type, amount, promisedDate, channel, description) {
  var ids = { payment_promise: 1, installment_agreement: 2, deadline_extension: 3, invoice_dispute: 4, debtor_statement: 5, custom: 6 };
  return { cardId: ids[type], amount: amount, occurredDate: null, promisedDate: promisedDate, communicationChannel: channel, description: description || null, evidence: "celoten uporabnikov opis" };
}
async function analyzeWith(text, item, extraContext) {
  return parser.analyze(text, Object.assign({}, context, extraContext || {}), { apiKey: "test", fetchImpl: lunaResponse([Object.assign({}, item, { evidence: text })], null) });
}
function assertSafeCard(result, expected) {
  assert.equal(result.semanticPlan.source, "luna_agreement_catalog_adapter");
  assert.equal(result.semanticPlan.status, "OK");
  assert.equal(result.candidates[0].type, expected.type);
  assert.equal(result.candidates[0].amount, expected.amount);
  assert.equal(result.candidates[0].promisedDate, expected.date);
  assert.equal(result.candidates[0].communicationChannel, expected.channel);
  assert.equal(result.candidates[0].requiresHumanReview, true);
  assert.equal(result.candidates[0].evidence.reason, "luna_agreement_catalog_adapter");
  assert.equal(result.ledger[0].effectEur, 0);
  assert.equal(result.projectedRemainingDebtEur, 9446);
}

async function main() {
  assert.equal(parser.CONTRACT_VERSION, "agreement-fact-v7");
  var request = parser.requestBody("rekel je da bo plačal", context, "test-user");
  var requestCatalog = JSON.parse(request.input).catalog;
  assert.equal(requestCatalog.guide.length, 6);
  assert.ok(requestCatalog.guide.every(function (card) { return Number.isInteger(card.cardId) && card.useWhen && card.doNotUseWhen && card.fieldIds.every(Number.isInteger) && card.requiredFieldIds.every(function (fieldId) { return card.fieldIds.includes(fieldId); }); }));
  assert.match(request.instructions, /FIRST read every entry in catalog\.guide/);
  assert.match(request.instructions, /Choose and return cardId yourself/);
  var exact = "rekel je da bo vse plačal cel dolg..ampak šele po 3h mesecih od danes";
  assertSafeCard(await analyzeWith(exact, agreement("payment_promise", 9446, "2026-11-29", "unknown")), { type: "payment_promise", amount: 9446, date: "2026-11-29", channel: "unknown" });
  var unknown = "rekel je da bo plačal ampak šele ko bo bil zmožen plačila in to samo 100 evrov";
  var afterNo = await analyzeWith(unknown, agreement("payment_promise", 100, null, "unknown"), { clarification: { question: "Kdaj bo plačal in po katerem kanalu?", answer: "ne", clauseId: "clause-1", round: 1 } });
  assertSafeCard(afterNo, { type: "payment_promise", amount: 100, date: null, channel: "unknown" });
  assert.equal(afterNo.needsClarification, false);

  // Luna je semantična avtoriteta: adapter veljaven predlog preslika, ne popravlja ga z lokalnimi pravili.
  var direct = await analyzeWith(exact, agreement("deadline_extension", null, "2027-01-01", "email"));
  assert.equal(direct.candidates[0].type, "deadline_extension");
  assert.equal(direct.candidates[0].promisedDate, "2027-01-01");

  var structurallyInvalid = lunaResponse([{ cardId: 99, amount: 9446, occurredDate: null, promisedDate: null, communicationChannel: "unknown", description: null, evidence: "izmišljeno" }], null);
  await assert.rejects(parser.analyze(exact, context, { apiKey: "test", fetchImpl: structurallyInvalid }), function (error) { return error.code === "LUNA_INVALID_AGREEMENT_PLAN" && error.status === 503; });
  await assert.rejects(parser.analyze(exact, context, { apiKey: "test", timeoutMs: 100, fetchImpl: async function () { var error = new Error("timeout"); error.name = "AbortError"; throw error; } }), function (error) { return error.code === "LUNA_TIMEOUT" && error.status === 503; });
  await assert.rejects(parser.analyze(exact, context, { apiKey: null }), function (error) { return error.code === "LUNA_NOT_CONFIGURED"; });

  var clarification = await parser.analyze("dogovor ni dovolj jasen", context, { apiKey: "test", fetchImpl: lunaResponse([], "Kaj je dolžnik sprejel?", "dogovor ni dovolj jasen") });
  assert.equal(clarification.needsClarification, true);
  assert.equal(clarification.clarification.clauseId, "clause-1");
  assert.equal(clarification.clarification.round, 1);
  assert.equal(parser._test.materializeLunaProposal({ agreements: [agreement("payment_promise", 100, null, "unknown")], question: null, evidence: null }, context, "drug vir"), null, "nepovezan card evidence mora fail-closed");
  assert.equal(parser._test.materializeLunaProposal({ agreements: [Object.assign({}, agreement("payment_promise", 100, null, "unknown"), { evidence: "x" })], question: "Kaj?", evidence: "x" }, context, "x"), null, "plan in vprašanje se ne smeta pojaviti skupaj");
  var exhausted = parser._test.clarificationResult({ agreements: [], question: "Kaj?", evidence: "x" }, { remainingDebt: 9446, clarification: { round: 2 } }, "x");
  assert.equal(exhausted.clarification, null);
  assert.equal(exhausted.clarificationExhausted, true);

  var ui = fs.readFileSync(path.join(__dirname, "..", "app", "neplacila-zgodovina.js"), "utf8");
  assert.match(ui, /function aktivniRazcleniEndpoint\(\)[\s\S]{0,180}\/api\/razcleni-dogovor[\s\S]{0,120}\/api\/razcleni-zgodovino/);
  assert.match(ui, /fetch\(aktivniRazcleniEndpoint\(\)/);
  var history = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "zgodovina-naravni-vnos.js"), "utf8");
  assert.doesNotMatch(history, /FUTURE DEBTOR AGREEMENT flow/);
  assert.match(history, /Atena history's only semantic interpreter/);
  var dispatcher = fs.readFileSync(path.join(__dirname, "..", "api", "izvedi-opomin-ukrep.js"), "utf8");
  var vercel = fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8");
  assert.match(dispatcher, /parameterPoti\(req, "handler"\) === "agreement-ai"[\s\S]{0,100}razcleniDogovor/);
  assert.match(vercel, /"source": "\/api\/razcleni-dogovor"[\s\S]{0,120}handler=agreement-ai/);
  var source = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "dogovor-naravni-vnos.js"), "utf8");
  assert.doesNotMatch(source, /require\([^)]*zgodovina/);
  assert.doesNotMatch(source, /require\([^)]*fact-engine/);
  assert.doesNotMatch(source, /function\s+(?:inferAmount|inferPromisedDate|inferChannel|agreementType|resolveAgreement)\b/);
  assert.doesNotMatch(source, /deterministic_agreement_resolver|validated_by_source_contract/);
  assert.match(source, /luna_only_semantics/);
  assert.match(source, /local_id_mapping_only/);
  console.log("OK agreement-fact-v7 Luna-first: strict evidence, exclusive plan/question, max 2 clarification rounds, zero ledger and UI routing");
}
main().catch(function (error) { console.error(error); process.exitCode = 1; });
