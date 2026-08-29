"use strict";

var assert = require("node:assert/strict");
var parser = require("../api/_lib/zgodovina-naravni-vnos");
var legacyAnalyze = parser.analyze;
parser.analyze = function (text, context, options) {
  return legacyAnalyze(text, context, Object.assign({ _legacyTestMode: true }, options || {}));
};

var CONTEXT = { referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446 };

function event(type, clauseId) {
  return {
    type: type, repeat: 1, amount: null, currency: "EUR", occurredDate: null, promisedDate: null,
    paymentMethod: null, communicationChannel: null, documentReference: null, reason: null, description: null,
    confidence: "high", missing: [], evidenceClauseId: clauseId, inheritedFrom: null,
  };
}

function provider(output, onCall) {
  return async function (_url, options) {
    if (typeof onCall === "function") onCall(JSON.parse(options.body));
    return { ok: true, status: 200, json: async function () { return { output_text: output }; } };
  };
}

async function main() {
  var paymentVerbs = ["plačal", "poravnal", "nakazal"];
  var clauseBridges = [" ", " in ", ", "];
  var modalCases = [
    { phrase: "je obljubil dobropis", assertion: "proposed", eventType: "payment_promise", amount: null },
    { phrase: "je predlagal dobropis", assertion: "proposed", eventType: null, amount: null },
    { phrase: "je bil brez dobropisa", assertion: "negated", eventType: null, amount: null },
    { phrase: "je izdal dobropis 50 evrov", assertion: "positive", eventType: "credit_note", amount: 50 },
  ];
  var contactCases = [
    { phrase: "danes pa je prekinil komunikacijo", date: "2026-08-28" },
    { phrase: "včeraj pa je prekinil stik", date: "2026-08-27" },
    { phrase: "pred enim dnem je postal nedosegljiv", date: "2026-08-27" },
  ];
  var checks = 0;

  paymentVerbs.forEach(function (verb) {
    clauseBridges.forEach(function (bridge) {
      modalCases.forEach(function (modal) {
        contactCases.forEach(function (contact) {
          var text = verb + " je 200 evrov mesec dni nazaj" + bridge
            + "pred tremi dnevi " + modal.phrase + " " + contact.phrase;
          var contract = parser._test.buildFactContract(text);
          var result = parser._test.deterministicResult(text, CONTEXT);
          assert.equal(contract.version, 26, "full-text plan nadgradnja mora ohraniti modalno-časovno semantiko v internem contractu 26");
          assert.equal(contract.clauses.length, 3, "vsak časovno voden FATHER prehod mora dobiti svojo klavzulo: " + text);
          assert.deepEqual(contract.clauses.map(function (clause) { return clause.id; }), ["clause-1", "clause-2", "clause-3"]);
          assert.deepEqual(contract.clauses[0].eventTypes, ["partial_payment"]);
          assert.deepEqual(contract.clauses[1].eventTypes, modal.eventType ? [modal.eventType] : []);
          assert.deepEqual(contract.clauses[2].eventTypes, ["remaining_unpaid"]);
          var creditSignal = contract.clauses[1].signals.find(function (signal) { return signal.eventType === "credit_note"; });
          assert.ok(creditSignal, "modalni dobropis mora ostati v diagnostičnem contractu");
          assert.equal(creditSignal.assertion, modal.assertion, "assertion ne sme postati izveden dogodek: " + text);
          var modalDateFact = contract.facts.find(function (fact) {
            return fact.kind === "date_relation" && fact.clauseId === "clause-2";
          });
          assert.ok(modalDateFact, "čas modalnega dogodka mora ostati diagnostično vezan");
          assert.equal(modalDateFact.assertion, modal.eventType ? "positive" : modal.assertion);

          var expectedTypes = modal.eventType
            ? ["partial_payment", modal.eventType, "remaining_unpaid"]
            : ["partial_payment", "remaining_unpaid"];
          var expectedAmounts = modal.eventType ? [200, modal.amount, modal.eventType === "credit_note" ? 9196 : 9246] : [200, 9246];
          var expectedDates = modal.eventType
            ? ["2026-07-28", "2026-08-25", contact.date]
            : ["2026-07-28", contact.date];
          assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }), expectedTypes, "modalnost mora nadzorovati candidate plan: " + text);
          assert.deepEqual(result.candidates.map(function (candidate) { return candidate.amount; }), expectedAmounts);
          assert.deepEqual(result.candidates.map(function (candidate) { return candidate.occurredDate; }), expectedDates);
          assert.deepEqual(result.candidates.map(function (candidate) { return candidate.evidence && candidate.evidence.clauseId; }),
            modal.eventType ? ["clause-1", "clause-2", "clause-3"] : ["clause-1", "clause-3"]);
          assert.equal(result.candidates[0].paymentMethod, verb === "nakazal" ? "bank_transfer" : null,
            "metoda sme biti izpeljana samo iz izrecnega nakazila");
          assert.ok(result.candidates.slice(1).every(function (candidate) { return candidate.paymentMethod == null; }),
            "neplačilni dogodki ne smejo podedovati metode");
          assert.deepEqual(result.ledger.map(function (entry) { return entry.afterEur; }), modal.eventType === "credit_note" ? [9246, 9196, 9196] : modal.eventType ? [9246, 9246, 9246] : [9246, 9246]);
          if (modal.eventType === "payment_promise") assert.equal(result.candidates[1].description, "Dolžnik je obljubil dobropis.");
          assert.equal(result.coverage.complete, true, "coverage mora dokazati izvedeni plan brez modalnih obveznosti: " + text);
          assert.equal(result.coverage.obligations.some(function (obligation) {
            return obligation.kind === "date_relation" && obligation.clauseId === "clause-2" && !modal.eventType;
          }), false, "predlagani ali zanikani čas ni obveznost izvedenega plana");
          checks += 16;
        });
      });
    });
  });

  [
    ["obljubil dobropis", "Dolžnik je obljubil dobropis."],
    ["obljubljal kompenzacijo", "Dolžnik je obljubil pobot."],
    ["obljubil da bo račun storniran", "Dolžnik je obljubil storno računa."],
  ].forEach(function (promiseCase) {
    var text = "plačal je 200 evrov mesec dni nazaj pred tremi dnevi je " + promiseCase[0] + " danes pa je prekinil komunikacijo";
    var result = parser._test.deterministicResult(text, CONTEXT);
    assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "payment_promise", "remaining_unpaid"]);
    assert.equal(result.candidates[1].description, promiseCase[1]);
    assert.deepEqual(result.ledger.map(function (entry) { return entry.afterEur; }), [9246, 9246, 9246], "obljubljeni izid ne sme zmanjšati salda");
    assert.equal(result.coverage.complete, true);
    checks += 4;
  });
  var proposedOnly = parser._test.deterministicResult("plačal je 200 evrov mesec dni nazaj pred tremi dnevi je predlagal pobot danes pa je prekinil komunikacijo", CONTEXT);
  assert.deepEqual(proposedOnly.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "remaining_unpaid"], "predlog brez izrecne obljube ne sme ustvariti koraka obljube");
  checks += 1;

  var exactText = "plačal je 200 evrov mesec dni nazaj pred tremi dnevi je obljubil dobropis danes pa je prekinil komunikacijo";
  var exactContract = parser._test.buildFactContract(exactText);
  var exactLocal = parser._test.deterministicResult(exactText, CONTEXT);
  var calls = 0;
  var fullPlan = JSON.stringify({ plan: [
    { evidenceText: exactText, cardNumber: 1, cardId: 1, count: 1, fields: [
      { fieldId: 1, numberValue: 200, textValue: null, evidenceText: "200 evrov" },
      { fieldId: 2, numberValue: null, textValue: "2026-07-28", evidenceText: "mesec dni nazaj" },
    ] },
    { evidenceText: exactText, cardNumber: 2, cardId: 7, count: 1, fields: [
      { fieldId: 2, numberValue: null, textValue: "2026-08-25", evidenceText: "pred tremi dnevi" },
      { fieldId: 8, numberValue: null, textValue: "Dolžnik je obljubil dobropis.", evidenceText: "obljubil dobropis" },
    ] },
    { evidenceText: exactText, cardNumber: 3, cardId: 5, count: 1, fields: [
      { fieldId: 1, numberValue: 9246, textValue: null, evidenceText: "prekinil komunikacijo" },
      { fieldId: 2, numberValue: null, textValue: "2026-08-28", evidenceText: "danes" },
    ] },
  ], clarificationQuestion: null, clarificationEvidenceText: null });
  var okResult = await parser.analyze(exactText, CONTEXT, {
    apiKey: "mock-luna",
    fetchImpl: provider(fullPlan, function (request) {
      calls += 1;
      var input = JSON.parse(request.input);
      assert.equal(input.version, undefined);
      assert.equal(input.contractVersion, "history-fact-v73");
      assert.equal(input.sourceText, exactText, "Luna mora prejeti celotni izvorni opis");
      assert.match(request.instructions, /numbered cards/);
      assert.match(request.instructions, /mandatory human review/);
      assert.equal(input.catalog.cards.length, 17);
      assert.equal(Object.prototype.hasOwnProperty.call(input, "proposedPlan"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(input, "clauses"), false);
    }),
  });
  assert.equal(calls, 1, "tudi popoln plan mora imeti natanko en neposreden review");
  assert.ok(["OK", "CORRECTED"].includes(okResult.semanticPlan.status));
  assert.deepEqual(okResult.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
    ["partial_payment", 200, "2026-07-28"], ["payment_promise", null, "2026-08-25"], ["remaining_unpaid", 9246, "2026-08-28"],
  ]);
  assert.equal(okResult.candidates[1].description, "Dolžnik je obljubil dobropis.");

  var staleProposal = [
    { index: 0, clauseId: "clause-1", eventType: "partial_payment", inheritedFrom: null },
    { index: 1, clauseId: "clause-1", eventType: "partial_payment", inheritedFrom: null },
  ];
  var fullPlanJson = JSON.stringify({ plan: [
    { clauseId: "clause-1", eventType: "partial_payment", count: 1, inheritedFrom: null },
    { clauseId: "clause-2", eventType: "payment_promise", count: 1, inheritedFrom: null },
    { clauseId: "clause-3", eventType: "remaining_unpaid", count: 1, inheritedFrom: null },
  ] });
  var correctedReview = parser._test.parsePlanReview(fullPlanJson, staleProposal, exactContract);
  assert.equal(correctedReview.ok, true, "celoten plan mora zamenjati zastarel predlog");
  var corrected = parser.normalizeResult({ summary: "Popravljeno.", events: correctedReview.links.map(function (link) {
    return event(link.eventType, link.clauseId);
  }) }, CONTEXT.remainingDebt, Object.assign({ text: exactText, factContract: exactContract }, CONTEXT));
  assert.equal(corrected.coverage.complete, true, "resolver mora celoten popravek ponovno materializirati in dokazati");
  assert.deepEqual(corrected.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
    ["partial_payment", 200, "2026-07-28"], ["payment_promise", null, "2026-08-25"], ["remaining_unpaid", 9246, "2026-08-28"],
  ]);

  var modelLed = await parser.analyze(exactText, CONTEXT, {
    apiKey: "mock-luna",
    fetchImpl: provider(JSON.stringify({ plan: [
      { evidenceText: exactText, cardNumber: 1, cardId: 1, count: 1, fields: [] },
      { evidenceText: exactText, cardNumber: 2, cardId: 12, count: 1, fields: [] },
      { evidenceText: exactText, cardNumber: 3, cardId: 5, count: 1, fields: [] },
    ], clarificationQuestion: null, clarificationEvidenceText: null })),
  });
  assert.ok(["OK", "CORRECTED"].includes(modelLed.semanticPlan.status));
  assert.deepEqual(modelLed.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "credit_note", "remaining_unpaid"], "engine ne sme pomensko preglasiti Luninega oštevilčenega plana");

  var reordered = await parser.analyze(exactText, CONTEXT, {
    apiKey: "mock-luna",
    fetchImpl: provider(JSON.stringify({ plan: [
      { evidenceText: exactText, cardNumber: 1, cardId: 5, count: 1, fields: [] },
      { evidenceText: exactText, cardNumber: 2, cardId: 1, count: 1, fields: [] },
    ], clarificationQuestion: null, clarificationEvidenceText: null })),
  });
  assert.ok(["OK", "CORRECTED"].includes(reordered.semanticPlan.status));
  assert.deepEqual(reordered.candidates.map(function (candidate) { return candidate.type; }), ["remaining_unpaid", "partial_payment"], "engine mora ohraniti vrstni red Luninih kartic za človeški pregled");

  console.log("✓ modalno-časovna FATHER matrika: " + checks + " determinističnih preveritev + Luna-authoritative review");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
