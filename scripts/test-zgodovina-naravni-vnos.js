"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var parser = require("../api/_lib/zgodovina-naravni-vnos");
var runtimeAnalyze = parser.analyze;
parser.analyze = function (text, context, options) {
  return runtimeAnalyze(text, context, Object.assign({ _legacyTestMode: true }, options || {}));
};
var factEngine = require("../api/_lib/zgodovina-fact-engine");
var relativeDates = require("../app/neplacila-zgodovina-relativni-datumi");
var db = require("../api/_lib/supabase-server");
var handler = require("../api/_handlers/razcleni-zgodovino");
require("../app/handy-canary-client.js");

function source(relative) {
  return fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader: function (key, value) { this.headers[key] = value; },
    status: function (code) { this.statusCode = code; return this; },
    json: function (payload) { this.payload = payload; return this; },
  };
}

async function runHandler(body) {
  var res = responseRecorder();
  await handler({ method: "POST", headers: { authorization: "Bearer test" }, body: body }, res);
  return res;
}

async function main() {
  var clientSource = source("app/neplacila-zgodovina.js");
  assert.match(clientSource, /supabaseKlient\.auth\.refreshSession\(\)/, "Atena mora znati osvežiti prijavno sejo");
  assert.match(clientSource, /AUTH_SERVER_UNAVAILABLE/, "začasno nedosegljiva prijava mora sprožiti ponovni poskus");
  assert.match(clientSource, /AUTH_SESSION_REFRESH_REQUIRED/, "zastarela seja mora sprožiti osvežitev žetona");
  assert.match(clientSource, /for \(var authPoskus = 0; authPoskus < 3;/, "Atena mora prijavo poskusiti največ trikrat");
  assert.doesNotMatch(clientSource, /\[atena-api\]/, "začasna lokalna diagnostika ne sme ostati v odjemalcu");
  assert.equal(globalThis.UJHandyCanary._test.appendText("Prej.", "Nato."), "Prej. Nato.");
  var downsampled = globalThis.UJHandyCanary._test.createDownsampler(16000).process(new Float32Array([0.25, -0.25]));
  assert.deepEqual(Array.from(downsampled), [0.25, -0.25]);
  assert.equal(globalThis.UJHandyCanary._test.audioLevel(new Float32Array([0, 0])), 0);
  assert.ok(Math.abs(globalThis.UJHandyCanary._test.audioLevel(new Float32Array([0.1, -0.1])) - 0.8) < 0.0001);
  assert.equal(globalThis.UJHandyCanary._test.audioLevel(new Float32Array([0.5, -0.5])), 1);

  var body = parser.requestBody("Včeraj je nakazal 100 EUR.", {
    referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 700,
  }, "user-123");
  assert.equal(body.model, "gpt-5.6-luna");
  assert.equal(body.store, false);
  assert.deepEqual(body.reasoning, { effort: "low" });
  assert.equal(body.max_output_tokens, 2600, "kanonični plan do 20 korakov ne sme biti odrezan");
  assert.equal(parser.MODEL_TIMEOUT_MS, 18000, "direktni Luna review mora imeti dovolj časa za običajen odziv");
  assert.equal(parser.MODEL_TIMEOUT_MAX_MS, 25000, "trda Luna meja mora preprečiti neskončno čakanje");
  assert.equal(body.text.format.schema.required[0], "p", "Luna-first protokol mora zahtevati kompaktni strukturirani celotni plan");
  assert.ok(body.text.format.schema.required.includes("q"), "Luna mora ob resnični dvoumnosti vrniti eno strukturirano vprašanje");
  assert.ok(body.text.format.schema.required.includes("x"), "pojasnilo mora prinesti lasten izvorni dokaz");
  assert.match(body.instructions, /numbered cards/);
  assert.match(body.instructions, /typos, colloquial language/);
  assert.match(body.instructions, /One card is one real event/);
  assert.match(body.instructions, /start\+frequency\+end/);
  assert.match(body.instructions, /c=card ID/);
  assert.ok(body.text.format.schema.properties.p.items.required.includes("n"));
  assert.ok(body.text.format.schema.properties.p.items.required.includes("f"));
  assert.ok(body.text.format.schema.properties.p.items.required.includes("c"));
  assert.equal(body.text.format.schema.properties.p.items.properties.f.items.properties.i.minimum, 1);
  assert.ok(body.text.format.schema.properties.p.items.properties.f.items.required.includes("v"));
  assert.ok(body.text.format.schema.properties.p.items.properties.f.items.required.includes("r"));
  assert.equal(body.tools, undefined, "zaprta ekstrakcija ne sme omogočiti orodij ali spleta");
  assert.ok(!JSON.stringify(body).includes("OPENAI_API_KEY"));
  assert.equal(body.previous_response_id, undefined, "vsaka prošnja mora začeti nov stateless Luna klic");
  assert.ok(!body.input.includes("invoiceIssueDate") && !body.input.includes("dueDate"), "datumi računa ne smejo v zunanjo AI zahtevo");
  var bodyInput = JSON.parse(body.input);
  assert.equal(Object.prototype.hasOwnProperty.call(bodyInput, "clauses"), false, "pred Luno ne sme biti parserjevih klavzul");
  assert.equal(Object.prototype.hasOwnProperty.call(bodyInput, "facts"), false, "pred Luno ne sme biti extractorjevih dejstev");
  assert.equal(bodyInput.sourceText, "Včeraj je nakazal 100 EUR.");
  assert.equal(bodyInput.contractVersion, "history-fact-v73");
  assert.equal(bodyInput.catalog.cards.length, 17);
  assert.equal(bodyInput.catalog.fields.length, 8);
  assert.equal(bodyInput.catalog.wire.length, 16, "vsaka wire spremenljivka mora imeti stabilen ID");
  assert.ok(bodyInput.catalog.values.some(function (row) { return row[0] === 406 && row[2] === "unknown"; }), "Ne vem za način plačila mora imeti ID");
  assert.ok(bodyInput.catalog.values.some(function (row) { return row[0] === 612 && row[2] === "approximate"; }), "Približno mora imeti ID");
  assert.ok(bodyInput.catalog.values.some(function (row) { return row[0] === 642 && row[2] === "week"; }), "tedenski interval mora imeti ID");
  assert.equal(Object.prototype.hasOwnProperty.call(bodyInput, "proposedPlan"), false, "lokalni plan ne sme biti vhod v prvo Lunino presojo");
  var freshBody = parser.requestBody("Popolnoma nova prošnja.", {
    referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 700,
  }, "user-123");
  assert.equal(freshBody.store, false);
  assert.equal(freshBody.previous_response_id, undefined);
  assert.doesNotMatch(freshBody.input, /Včeraj je nakazal 100 EUR/, "nov klic ne sme vsebovati prejšnje prošnje ali odgovora");
  var privacyBody = parser.requestBody("Janez Novak je plačal 3000 EUR v treh obrokih po 1000 EUR, janez@example.com, +386 40 123 456.", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  }, "user-123");
  assert.equal(JSON.parse(privacyBody.input).sourceText, "Janez Novak je plačal 3000 EUR v treh obrokih po 1000 EUR, janez@example.com, +386 40 123 456.", "Luna mora pod pogodbeno reguliranim tokom dobiti celotni kontekst");
  assert.doesNotMatch(privacyBody.input, /allowedEventTypes/);
  assert.match(privacyBody.input, /debtEur/);
  assert.doesNotMatch(privacyBody.input, /proposedPlan/);
  assert.equal(privacyBody.store, false, "celotni opis se ne sme shranjevati pri ponudniku");

  var lunaRequestStarted = false;
  var originalBuildFactContract = factEngine.buildFactContract;
  factEngine.buildFactContract = function () {
    assert.equal(lunaRequestStarted, true, "fact parser se ne sme zagnati pred začetkom Luninega klica");
    return originalBuildFactContract.apply(factEngine, arguments);
  };
  var literalLunaFirst;
  try {
    literalLunaFirst = await parser.analyze("Včeraj je nakazal 100 EUR.", {
      referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 700,
    }, {
      apiKey: "test-only",
      fetchImpl: async function (_url, request) {
        lunaRequestStarted = true;
        var rawInput = JSON.parse(JSON.parse(request.body).input);
        assert.deepEqual(Object.keys(rawInput).sort(), ["clarification", "contractVersion", "debtEur", "referenceDate", "sourceText", "catalog"].sort());
        assert.equal(rawInput.sourceText, "Včeraj je nakazal 100 EUR.");
        return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({
          plan: [{ evidenceText: "Včeraj je nakazal 100 EUR", eventType: "partial_payment", count: 1, inheritedFromEvidenceText: null }],
          clarificationQuestion: null,
          clarificationEvidenceText: null,
        }) }; } };
      },
    });
  } finally {
    factEngine.buildFactContract = originalBuildFactContract;
  }
  assert.equal(literalLunaFirst.semanticPlan.status, "CORRECTED");
  assert.deepEqual(literalLunaFirst.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
    ["partial_payment", 100, "2026-08-26"],
  ]);

  var clarificationResult = await parser.analyze("Govorila sva o računu, nato je plačal 100 EUR.", {
    referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only",
    fetchImpl: async function () {
      return { ok: true, json: async function () { return { output_text: JSON.stringify({
        plan: [], clarificationQuestion: "Kaj sta se dogovorila glede plačila računa?", clarificationEvidenceText: "Govorila sva o računu",
      }) }; } };
    },
  });
  assert.equal(clarificationResult.semanticPlan.status, "CLARIFICATION_REQUIRED");
  assert.deepEqual(clarificationResult.candidates, [], "pred odgovorom se ne sme prikazati delnih kartic");
  assert.equal(clarificationResult.clarification.question, "Kaj sta se dogovorila glede plačila računa?");
  assert.equal(clarificationResult.clarification.clauseId, "clause-1");
  assert.equal(clarificationResult.clarification.round, 1);

  var silentOmission = await parser.analyze("Govorila sva o računu, nato je plačal 100 EUR.", {
    referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only",
    fetchImpl: async function () {
      return { ok: true, json: async function () { return { output_text: JSON.stringify({
        plan: [{ clauseId: "clause-2", eventType: "partial_payment", count: 1, inheritedFrom: null }],
        clarificationQuestion: null,
        clarificationClauseId: null,
      }) }; } };
    },
  });
  assert.equal(silentOmission.semanticPlan.status, "CLARIFICATION_REQUIRED", "Luna ne sme tiho izpustiti materialno nejasne klavzule");
  assert.equal(silentOmission.semanticPlan.reason, "neutral_clause_unresolved");
  assert.deepEqual(silentOmission.candidates, []);
  assert.equal(silentOmission.clarification.clauseId, "clause-1");

  var clarifiedResult = await parser.analyze("Govorila sva o računu, nato je plačal 100 EUR.", {
    referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
    clarification: { question: clarificationResult.clarification.question, clauseId: "clause-1", answer: "Po telefonu sem ga pozval k plačilu dolga.", round: 1 },
  }, {
    apiKey: "test-only",
    fetchImpl: async function (_url, request) {
      var requestInput = JSON.parse(JSON.parse(request.body).input);
      assert.equal(requestInput.sourceText, "Govorila sva o računu, nato je plačal 100 EUR.", "Luna mora tudi pri pojasnilu najprej dobiti nespremenjen original");
      assert.equal(requestInput.clarification.answer, "Po telefonu sem ga pozval k plačilu dolga.");
      return { ok: true, json: async function () { return { output_text: JSON.stringify({
        plan: [
          { clauseId: "clause-2", eventType: "reminder_sent", count: 1, inheritedFrom: null },
          { clauseId: "clause-4", eventType: "partial_payment", count: 1, inheritedFrom: null },
        ],
        clarificationQuestion: null,
        clarificationClauseId: null,
      }) }; } };
    },
  });
  assert.equal(clarifiedResult.semanticPlan.status, "CORRECTED");
  assert.deepEqual(clarifiedResult.candidates.map(function (candidate) { return candidate.type; }), ["reminder_sent", "partial_payment"]);
  assert.equal(clarifiedResult.projectedRemainingDebtEur, 9346);
  var clarifiedRetrySuppressed = await parser.analyze("mesec dni nazaj sva govorila o računu potem je danes plačal 100", {
    referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
    clarification: { question: "Kaj se je zgodilo?", clauseId: "clause-1", answer: "Po telefonu sem ga pozval k plačilu dolga.", round: 1 },
  }, {
    apiKey: "test-only",
    fetchImpl: async function () {
      return { ok: true, json: async function () { return { output_text: JSON.stringify({ plan: [], clarificationQuestion: "Ali lahko še enkrat pojasnite?", clarificationClauseId: "clause-1" }) }; } };
    },
  });
  assert.equal(clarifiedRetrySuppressed.semanticPlan.status, "CORRECTED", "dokazno popoln odgovor ne sme sprožiti neskončnega vprašanja");
  assert.equal(clarifiedRetrySuppressed.semanticPlan.reason, "clarification_answer_applied");
  assert.deepEqual(clarifiedRetrySuppressed.candidates.map(function (candidate) { return candidate.type; }), ["reminder_sent", "partial_payment"]);
  assert.equal(parser.MAX_LUNA_CALLS_PER_DESCRIPTION, 3, "za isti opis so dovoljeni začetni klic in največ dva odgovora");
  var clarificationCalls = 0;
  async function unresolvedClarificationFetch() {
    clarificationCalls += 1;
    return { ok: true, json: async function () { return { output_text: JSON.stringify({ plan: [], clarificationQuestion: "Kaj se je zgodilo pri pogovoru o računu?", clarificationClauseId: "clause-1" }) }; } };
  }
  var cappedInitial = await parser.analyze("Mesec dni nazaj sva govorila o računu, danes je plačal 100 EUR.", {
    referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
  }, { apiKey: "test-only", fetchImpl: unresolvedClarificationFetch });
  var cappedSecond = await parser.analyze("Mesec dni nazaj sva govorila o računu, danes je plačal 100 EUR.", {
    referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
    clarification: { question: cappedInitial.clarification.question, clauseId: cappedInitial.clarification.clauseId, answer: "Ne vem natančno.", round: 1 },
  }, { apiKey: "test-only", fetchImpl: unresolvedClarificationFetch });
  var cappedThird = await parser.analyze("Mesec dni nazaj sva govorila o računu, danes je plačal 100 EUR.", {
    referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
    clarification: { question: cappedSecond.clarification.question, clauseId: cappedSecond.clarification.clauseId, answer: "Še vedno nisem prepričan.", round: 2 },
  }, { apiKey: "test-only", fetchImpl: unresolvedClarificationFetch });
  assert.equal(clarificationCalls, 3, "celoten nejasen tok sme porabiti največ tri Lunine klice");
  assert.equal(cappedSecond.clarification.round, 2);
  assert.equal(cappedThird.semanticPlan.status, "CLARIFICATION_EXHAUSTED");
  assert.equal(cappedThird.clarification, null, "po drugem odgovoru ne sme obstajati gumb za četrti klic");
  assert.equal(cappedThird.clarificationExhausted, true);
  assert.deepEqual(cappedThird.candidates, []);
  assert.match(cappedThird.summary, /raje dodajte ročno/);
  var vagueAnswerOmission = await parser.analyze("mesec dni nazaj sva govorila o računu potem je danes plačal 100", {
    referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
    clarification: { question: "Kaj se je zgodilo pri pogovoru?", clauseId: "clause-1", answer: "Ne vem natančno, samo govorila sva.", round: 1 },
  }, {
    apiKey: "test-only",
    fetchImpl: async function () { return { ok: true, json: async function () { return { output_text: JSON.stringify({
      plan: [{ clauseId: "clause-2", eventType: "partial_payment", count: 1, inheritedFrom: null }],
      clarificationQuestion: null,
      clarificationClauseId: null,
    }) }; } }; },
  });
  assert.equal(vagueAnswerOmission.semanticPlan.status, "CLARIFICATION_REQUIRED", "Luna po odgovoru »ne vem« ne sme tiho izpustiti prvotno nejasne klavzule");
  assert.equal(vagueAnswerOmission.clarification.round, 2);
  assert.deepEqual(vagueAnswerOmission.candidates, []);
  var uncertaintyMisreadAsDebtor = await parser.analyze("mesec dni nazaj sva govorila o računu potem je danes plačal 100", {
    referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
    clarification: { question: "Kaj se je zgodilo pri pogovoru?", clauseId: "clause-1", answer: "Še vedno nisem prepričan.", round: 2 },
  }, {
    apiKey: "test-only",
    fetchImpl: async function () { return { ok: true, json: async function () { return { output_text: JSON.stringify({
      plan: [
        { clauseId: "clause-1", eventType: "debtor_statement", count: 1, inheritedFrom: null },
        { clauseId: "clause-2", eventType: "partial_payment", count: 1, inheritedFrom: null },
      ],
      clarificationQuestion: null,
      clarificationClauseId: null,
    }) }; } }; },
  });
  assert.equal(uncertaintyMisreadAsDebtor.semanticPlan.status, "CLARIFICATION_EXHAUSTED", "uporabnikova negotovost ne sme postati dolžnikova izjava");
  assert.equal(uncertaintyMisreadAsDebtor.clarificationExhausted, true);
  assert.deepEqual(uncertaintyMisreadAsDebtor.candidates, []);
  var forbiddenFourthCalls = 0;
  await assert.rejects(function () {
    return parser.analyze("Mesec dni nazaj sva govorila o računu, danes je plačal 100 EUR.", {
      referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
      clarification: { question: "Kaj se je zgodilo?", clauseId: "clause-1", answer: "Ne vem.", round: 3 },
    }, { apiKey: "test-only", fetchImpl: async function () { forbiddenFourthCalls += 1; } });
  }, /Vpišite kratek odgovor/, "četrti Lunini klic mora biti zavrnjen pred ponudnikom");
  assert.equal(forbiddenFourthCalls, 0);
  await assert.rejects(function () {
    return parser.analyze("Govorila sva o računu.", {
      referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
      clarification: { question: "Kaj se je zgodilo?", clauseId: "clause-999", answer: "Ne vem.", round: 1 },
    }, { apiKey: "test-only" });
  }, /Vpišite kratek odgovor/, "ponarejena clause povezava ne sme postati dokaz");
  await assert.rejects(function () {
    return parser.analyze("Govorila sva o računu.", {
      referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
      clarification: { question: "Kaj se je zgodilo?", clauseId: "clause-1", answer: "", round: 1 },
    }, { apiKey: "test-only" });
  }, /Vpišite kratek odgovor/, "prazen odgovor mora biti zavrnjen pred modelskim klicem");

  var normalized = parser.normalizeResult({
    summary: "Trije obroki.", needsClarification: false,
    events: [{
      type: "installment_payment", repeat: 3, amount: null, currency: "EUR",
      occurredDate: null, promisedDate: null, reason: null, description: null,
      confidence: "high", missing: ["amount", "occurredDate"],
    }],
  }, 700);
  assert.equal(normalized.candidates.length, 3, "tri obroke mora razširiti v tri ločene osnutke");
  normalized.candidates.forEach(function (candidate, index) {
    assert.equal(candidate.type, "installment_payment");
    assert.equal(candidate.amount, null, "manjkajočega zneska ne sme izmišljati");
    assert.equal(candidate.occurredDate, null, "manjkajočega datuma ne sme izmišljati");
    assert.deepEqual(candidate.missing, ["amount", "occurredDate", "paymentMethod"]);
    assert.equal(candidate.candidateId, "candidate-" + (index + 1));
  });

  var unpaidInstallment = parser.normalizeResult({ summary: "Dva plačana, tretji neplačan.", needsClarification: false, events: [{
    type: "installment_payment", repeat: 2, amount: 12, currency: "EUR", occurredDate: null,
    promisedDate: null, paymentMethod: null, communicationChannel: null, documentReference: null,
    reason: null, description: null, confidence: "high", missing: [],
  }] }, 9446, { text: "Plačal je 3 obroke. Dva je plačal, tretjega pa še ni.", referenceDate: "2026-08-27", remainingDebt: 9446 });
  assert.deepEqual(unpaidInstallment.candidates.map(function (candidate) { return candidate.type; }), ["installment_payment", "installment_payment", "unpaid_installment"]);
  assert.equal(unpaidInstallment.candidates[2].description, "3. obrok ni plačan");
  assert.deepEqual(unpaidInstallment.candidates[2].missing, ["occurredDate"]);

  var paidThenStopped = parser._test.deterministicResult("prva dva obroka je poravnal potem pa ni več nič plačal", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(paidThenStopped.candidates.map(function (candidate) { return candidate.type; }), ["installment_payment", "installment_payment", "unpaid_installment"], "prva dva plačana obroka in ustavitev morajo postati trije zaporedni dogodki");
  assert.equal(paidThenStopped.candidates[2].description, "3. obrok ni plačan", "N plačanih obrokov pomeni, da je prvi neplačani N+1");
  assert.equal(paidThenStopped.candidates[2].amount, null, "brez dogovorjenega zneska obroka engine ne sme izmišljati zneska");
  assert.equal(paidThenStopped.candidates[2].occurredDate, null, "brez roka obroka engine ne sme izmišljati datuma");

  var dvakratPoDvaTisoc = parser._test.deterministicResult("plačal je 2x po 2000 evrov in potem nič več", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(dvakratPoDvaTisoc.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 2000], ["installment_payment", 2000], ["remaining_unpaid", 5446],
  ], "2x po 2000 mora materializirati obe plačili in pravilen preostanek");
  assert.equal(dvakratPoDvaTisoc.projectedRemainingDebtEur, 5446);
  assert.deepEqual(dvakratPoDvaTisoc.ledger.map(function (entry) { return entry.afterEur; }), [7446, 5446, 5446]);

  var casovnoLoceniPlaciliText = "delno je poravnal račun plačal je pred enim mesecom 4000 potem pred dvema tednoma pa 2000";
  var casovnoLoceniPlacili = parser._test.deterministicResult(casovnoLoceniPlaciliText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(casovnoLoceniPlacili.candidates.map(function (candidate) {
    return [candidate.type, candidate.amount, candidate.occurredDate];
  }), [
    ["partial_payment", 4000, "2026-07-27"],
    ["partial_payment", 2000, "2026-08-13"],
  ], "časovni nadaljevalni del mora podedovati plačilo ter ohraniti svoj znesek in datum");
  assert.equal(casovnoLoceniPlacili.projectedRemainingDebtEur, 3446);
  assert.deepEqual(casovnoLoceniPlacili.candidates.map(function (candidate) { return candidate.evidence && candidate.evidence.clauseId; }), ["clause-1", "clause-2"], "vsako plačilo mora ohraniti dokaz svojega pomenskega dela");
  var casovnoLoceniKlici = 0;
  var casovnoLoceniFast = await parser.analyze(casovnoLoceniPlaciliText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only",
    fetchImpl: async function () { casovnoLoceniKlici += 1; throw new Error("modelski klic ni dovoljen"); },
  });
  assert.equal(casovnoLoceniKlici, 1, "sestavljeni plačili morata zahtevati Lunino preverjanje natanko enkrat");
  assert.deepEqual(casovnoLoceniFast.candidates, [], "brez Lunine rešitve se lokalni plan ne sme prikazati");
  assert.equal(casovnoLoceniFast.projectedRemainingDebtEur, 9446);
  assert.equal(casovnoLoceniFast.semanticPlan.reason, "luna_review_unavailable");

  [
    ["plačal je pred enim mesecem 4000 €, potem pred dvema tednoma 2000 €", [[4000, "2026-07-27"], [2000, "2026-08-13"]]],
    ["plačal je pred 1 mesecem 4000 nato pred 14 dnevi še 2000", [[4000, "2026-07-27"], [2000, "2026-08-13"]]],
    ["včeraj je plačal 4000 potem danes še 2000", [[4000, "2026-08-26"], [2000, "2026-08-27"]]],
  ].forEach(function (entry) {
    var result = parser._test.deterministicResult(entry[0], { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
    assert.deepEqual(result.candidates.map(function (candidate) { return [candidate.amount, candidate.occurredDate]; }), entry[1], "časovna varianta mora ostati na istem sistemskem pravilu: " + entry[0]);
  });

  var triZaporednaPlacilaText = "plačal je 300 nato 500 nato pred tednom dni pa 5000 drugo pa ni plačal";
  var triZaporednaPlacila = parser._test.deterministicResult(triZaporednaPlacilaText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(triZaporednaPlacila.candidates.map(function (candidate) {
    return [candidate.type, candidate.amount, candidate.occurredDate];
  }), [
    ["partial_payment", 300, null],
    ["partial_payment", 500, null],
    ["partial_payment", 5000, "2026-08-20"],
    ["remaining_unpaid", 3646, null],
  ], "trije zaporedni zneski morajo ostati tri plačila tudi s pogovornim časovnim vložkom");
  assert.deepEqual(triZaporednaPlacila.ledger.map(function (entry) { return entry.afterEur; }), [9146, 8646, 3646, 3646]);
  assert.equal(triZaporednaPlacila.projectedRemainingDebtEur, 3646);
  var triZaporednaKlici = 0;
  await parser.analyze(triZaporednaPlacilaText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only",
    fetchImpl: async function () { triZaporednaKlici += 1; return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } }; },
  });
  assert.equal(triZaporednaKlici, 1, "tri zaporedna plačila morajo zahtevati semantični plan");

  [
    "plačal je 300 nato 500 potem pred tednom dni 5000 ostalo pa ni plačal",
    "plačal je 300, potem 500, zatem pred enim tednom pa 5000, preostanka ni poravnal",
    "plačal je 300 nato 500 nato pred mesecem dni pa 5000 drugo pa ni plačal",
  ].forEach(function (opis) {
    var rezultat = parser._test.deterministicResult(opis, { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
    assert.deepEqual(rezultat.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
      ["partial_payment", 300], ["partial_payment", 500], ["partial_payment", 5000], ["remaining_unpaid", 3646],
    ], "pogovorna časovna varianta mora ohraniti vsa tri plačila: " + opis);
  });

  var vecObrocnihSkupinText = "plačal je 2 obroka po 300 evrov potem 2 obroka po 500 evrov preostalo je dolžan";
  var vecObrocnihSkupin = parser._test.deterministicResult(vecObrocnihSkupinText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(vecObrocnihSkupin.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 300], ["installment_payment", 300],
    ["installment_payment", 500], ["installment_payment", 500],
    ["remaining_unpaid", 7846],
  ], "vsaka eksplicitna obročna skupina mora ohraniti lastno ponovitev in znesek");
  assert.deepEqual(vecObrocnihSkupin.ledger.map(function (entry) { return entry.afterEur; }), [9146, 8846, 8346, 7846, 7846]);
  var vecObrocnihSkupinContract = parser._test.buildFactContract(vecObrocnihSkupinText);
  assert.deepEqual(vecObrocnihSkupinContract.installmentGroups.map(function (group) { return [group.count, group.amount, group.completed]; }), [[2, 300, true], [2, 500, true]]);
  assert.ok(vecObrocnihSkupinContract.facts.every(function (fact) {
    return fact.kind !== "money" || fact.value !== 2;
  }), "število ponovitev se ne sme pretvoriti v denarni znesek");

  var mesaniZapisiText = "plačal je dva po 300 evrov potem 2 obroka po 500 ostalo ni plačal";
  var mesaniZapisi = parser._test.deterministicResult(mesaniZapisiText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(mesaniZapisi.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 300], ["installment_payment", 300],
    ["installment_payment", 500], ["installment_payment", 500],
    ["remaining_unpaid", 7846],
  ], "številke, besedne številke in izpuščena beseda obrok morajo uporabljati isti contract");
  assert.equal(parser._test.requiresModelReasoning(mesaniZapisiText), true, "večdelni mešani zapis mora zahtevati preverjen semantični plan");
  var mesaniKlici = 0;
  await parser.analyze(mesaniZapisiText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  }, { apiKey: "test-only", fetchImpl: async function () { mesaniKlici += 1; return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } }; } });
  assert.equal(mesaniKlici, 1, "mešane obročne skupine morajo poskusiti pridobiti semantični plan");

  var zastarelSkupinskiPredlog = parser.normalizeResult({ summary: "zastarel", events: [
    { type: "installment_payment", repeat: 2, amount: 300, confidence: "low" },
  ] }, 9446, { text: mesaniZapisiText, referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.deepEqual(zastarelSkupinskiPredlog.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 300], ["installment_payment", 300],
    ["installment_payment", 500], ["installment_payment", 500],
    ["remaining_unpaid", 7846],
  ], "deterministične skupine morajo popraviti nepopoln ali zastarel modelski predlog");

  var besedniTisocText = "plačal je prve tri obroke po tisoč evrov potem pa nič več";
  var besedniTisoc = parser._test.deterministicResult(besedniTisocText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(parser._test.inferInstallmentBreakdown(besedniTisocText), {
    repeat: 3, amount: 1000, amounts: null, total: 3000,
  }, "beseda tisoč mora biti veljaven znesek posameznega obroka");
  assert.deepEqual(besedniTisoc.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 1000], ["installment_payment", 1000], ["installment_payment", 1000], ["remaining_unpaid", 6446],
  ], "tri plačani obroki in kratki zaključek nič več morajo postati štirje zaporedni dogodki");
  assert.equal(besedniTisoc.candidates[3].description, null, "kratek zaključek brez dolžnikove izjave ne sme izmišljati opisa");
  assert.equal(parser._test.requiresModelReasoning(besedniTisocText), true, "plačila in zaključek preostanka morajo skozi semantični plan");
  var besedniTisocKlici = 0;
  var besedniTisocFast = await parser.analyze(besedniTisocText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  }, { apiKey: "test-only", fetchImpl: async function () { besedniTisocKlici += 1; return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } }; } });
  assert.equal(besedniTisocKlici, 1, "besedna tisočica in zaključek morata zahtevati semantični plan");
  assert.equal(besedniTisocFast.candidates.length, 4);
  var sorodniBesedniTisoc = parser._test.deterministicResult("poravnal je prvih dveh obrokih po tisočaka nato nič več", {
    referenceDate: "2026-08-27", originalDebt: 5000, remainingDebt: 5000,
  });
  assert.deepEqual(sorodniBesedniTisoc.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 1000], ["installment_payment", 1000], ["remaining_unpaid", 3000],
  ], "isto pravilo mora pokriti tudi sklanjano število in pogovorno tisočico");

  var razdeljeniObrokiText = "plačal je 3000 evrov v treh obrokov 1000 evrov dobropisa ostalo pa ni poravnal";
  var razdeljeniObroki = parser._test.deterministicResult(razdeljeniObrokiText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.equal(razdeljeniObroki.candidates.length, 5, "trije obroki, dobropis in izrecni neplačani preostanek morajo ostati ločeni");
  assert.deepEqual(razdeljeniObroki.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.fatherCategory]; }), [
    ["installment_payment", 1000, "installment"], ["installment_payment", 1000, "installment"], ["installment_payment", 1000, "installment"], ["credit_note", 1000, "credit_note"], ["remaining_unpaid", 5446, "unpaid_installment"],
  ], "vsak pomenski del mora biti namenjen svoji FATHER kategoriji");
  assert.equal(razdeljeniObroki.projectedRemainingDebtEur, 5446, "ledger mora odšteti tri obroke in ločen dobropis natanko enkrat");
  var locenaSkupnaVsotaInDobropisText = "plačal je 2000 evrov v 4ih obrokih in dal sem mu 1000evrov dobropisa";
  var locenaSkupnaVsotaInDobropis = parser._test.deterministicResult(locenaSkupnaVsotaInDobropisText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(parser._test.inferInstallmentBreakdown(locenaSkupnaVsotaInDobropisText), {
    repeat: 4, amount: null, amounts: [500, 500, 500, 500], total: 2000,
  }, "znesek poznejšega dobropisa ne sme postati znesek posameznega obroka");
  assert.deepEqual(locenaSkupnaVsotaInDobropis.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 500], ["installment_payment", 500], ["installment_payment", 500], ["installment_payment", 500], ["credit_note", 1000],
  ], "2000 EUR v štirih obrokih in 1000 EUR dobropisa mora ustvariti 4 × 500 EUR ter ločen dobropis");
  assert.equal(locenaSkupnaVsotaInDobropis.projectedRemainingDebtEur, 6446, "ledger mora odšteti 2000 EUR plačil in 1000 EUR dobropisa natanko enkrat");
  var locenaSkupnaVsotaKlici = 0;
  var locenaSkupnaVsotaFast = await parser.analyze(locenaSkupnaVsotaInDobropisText, { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 }, {
    apiKey: "test-only", fetchImpl: async function () { locenaSkupnaVsotaKlici += 1; return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } }; },
  });
  assert.equal(locenaSkupnaVsotaKlici, 1, "skupna vsota in ločen dobropis morata zahtevati semantični plan");
  assert.equal(locenaSkupnaVsotaFast.candidates[4].amount, 1000, "hitri rezultat mora ohraniti ločen dobropis 1000 EUR");
  var brezValuteText = "plačal je 3000 v 4ih obrokih.. in nato pa 1000 v dobropisu";
  var brezValute = parser._test.deterministicResult(brezValuteText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(parser._test.inferInstallmentBreakdown(brezValuteText), {
    repeat: 4, amount: null, amounts: [750, 750, 750, 750], total: 3000,
  }, "struktura znesek v N obrokih mora pomeniti EUR tudi brez ponovljene valute");
  assert.equal(parser._test.inferCreditNoteAmount(brezValuteText, { remainingDebt: 9446 }), 1000, "znesek v FATHER odseku dobropisa mora delovati brez besede evrov");
  assert.deepEqual(brezValute.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 750], ["installment_payment", 750], ["installment_payment", 750], ["installment_payment", 750], ["credit_note", 1000],
  ], "točen uporabnikov stavek mora postati 4 × 750 EUR in ločen dobropis 1000 EUR");
  assert.equal(brezValute.projectedRemainingDebtEur, 5446, "plačila 3000 EUR in dobropis 1000 EUR morajo biti odšteti natanko enkrat");
  var brezValuteKlici = 0;
  var brezValuteFast = await parser.analyze(brezValuteText, { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 }, {
    apiKey: "test-only", fetchImpl: async function () { brezValuteKlici += 1; return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } }; },
  });
  assert.equal(brezValuteKlici, 1, "večdelni vnos brez valute mora zahtevati semantični plan");
  assert.equal(brezValuteFast.candidates.length, 5, "hitri lokalni rezultat mora vsebovati vseh pet FATHER kartic");
  [
    ["poravnala je 3000 skupaj v štirih obrokih", 4, 3000],
    ["nakazal je 1200 na 3 obroke", 3, 1200],
    ["plačano 2500 razdeljeno v pet obrokov", 5, 2500],
  ].forEach(function (primer) {
    var razrez = parser._test.inferInstallmentBreakdown(primer[0]);
    assert.equal(razrez.repeat, primer[1], "enota obrokov mora biti vezana na svojo strukturo: " + primer[0]);
    assert.equal(razrez.total, primer[2], "skupna vsota brez valute mora ostati v svojem odseku: " + primer[0]);
    assert.equal(razrez.amounts.reduce(function (sum, amount) { return sum + amount; }, 0), primer[2], "centna delitev mora ohraniti vsoto: " + primer[0]);
  });
  [
    "1000 v dobropisu", "1000 kot dobropis", "1000 sem mu dal v dobropisu", "nato pa 1000 v obliki dobropisa", "dobropis v vrednosti 1000",
  ].forEach(function (opis) {
    assert.equal(parser._test.inferCreditNoteAmount(opis, { remainingDebt: 9446 }), 1000, "FATHER odsek mora obdržati svoj znesek: " + opis);
  });
  assert.equal(parser._test.inferCreditNoteAmount("plačal je 3000 v 4ih obrokih in dobropis brez zneska", { remainingDebt: 9446 }), null, "dobropis brez zneska ne sme ukrasti števila obrokov ali skupnega plačila");
  var popravljenaLuna = parser.normalizeResult({ summary: "Plačilo 3000 EUR.", needsClarification: false, events: [{
    type: "partial_payment", repeat: 1, amount: 3000, currency: "EUR", occurredDate: null,
    promisedDate: null, paymentMethod: null, communicationChannel: null, documentReference: null,
    reason: null, description: null, confidence: "medium", missing: [],
  }] }, 9446, { text: razdeljeniObrokiText, referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.deepEqual(popravljenaLuna.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 1000], ["installment_payment", 1000], ["installment_payment", 1000], ["credit_note", 1000], ["remaining_unpaid", 5446],
  ], "strežniško preverjanje mora iz napačno združenega modelskega rezultata obnoviti vse FATHER dogodke");
  assert.deepEqual(parser._test.detectFatherCategories(razdeljeniObrokiText), ["installment", "unpaid_installment", "credit_note"], "vseh 13 FATHER detektorjev se oceni neodvisno");
  assert.equal(parser._test.inferCreditNoteAmount("dobropis v višini 275 evrov", { remainingDebt: 9446 }), 275, "dobropis mora delovati tudi, ko je kategorija pred zneskom");
  assert.equal(parser._test.inferCreditNoteAmount("nato 1000 dobropisa", { remainingDebt: 9446 }), 1000, "znesek neposredno ob kategoriji mora veljati tudi brez ponovljene valute");
  var modelBrezZneskaDobropisa = parser.normalizeResult({ summary: "Model je izpustil znesek.", needsClarification: true, events: [
    { type: "installment_payment", repeat: 5, amount: 500, currency: "EUR", occurredDate: null, paymentMethod: null },
    { type: "credit_note", repeat: 1, amount: null, currency: "EUR", occurredDate: null },
  ] }, 9446, { text: "5 obrokov prvih po 500 evrov je plačal potem pa se ni več oglasil 1000 evrov dobropisa", referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.deepEqual(modelBrezZneskaDobropisa.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 500], ["installment_payment", 500], ["installment_payment", 500], ["installment_payment", 500], ["installment_payment", 500], ["credit_note", 1000], ["remaining_unpaid", 5946],
  ], "thinking engine mora ohraniti dobropis in novi FATHER neodziva brez dvojnega zmanjšanja salda");
  assert.deepEqual(modelBrezZneskaDobropisa.candidates[5].missing, ["occurredDate"], "pri jasnem dobropisu sme manjkati datum, ne znesek");
  assert.equal(modelBrezZneskaDobropisa.candidates[6].fatherCategory, "collection_outcome", "neodziv po plačilu mora ohraniti svoj FATHER");
  assert.equal(parser._test.requiresModelReasoning(razdeljeniObrokiText), true, "več FATHER kategorij mora zahtevati semantični plan");
  var fatherProviderCalls = 0;
  var fatherFastResult = await parser.analyze(razdeljeniObrokiText, { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 }, {
    apiKey: "test-only", fetchImpl: async function () { fatherProviderCalls += 1; return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } }; },
  });
  assert.equal(fatherProviderCalls, 1, "jasno razdeljene FATHER kategorije morajo zahtevati preverjen semantični plan");
  assert.deepEqual(fatherFastResult.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 1000], ["installment_payment", 1000], ["installment_payment", 1000], ["credit_note", 1000], ["remaining_unpaid", 5446],
  ], "izrecni zaključek 'ostalo pa ni poravnal' mora ohraniti preverjen preostanek");
  assert.equal(fatherFastResult.coverage.complete, true);
  assert.equal(fatherFastResult.coverage.unconsumed.length, 0);

  var uporabnikovTipkarskiPrimer = "plačal je 4000 evrov v 3h obrokih nato 1000 dobropisa potem pa je prekinil stlk";
  var tipkarskiRezultat = parser._test.deterministicResult(uporabnikovTipkarskiPrimer, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(parser._test.inferInstallmentBreakdown(uporabnikovTipkarskiPrimer), {
    repeat: 3, amount: null, amounts: [1333.33, 1333.33, 1333.34], total: 4000,
  }, "skupna vsota v zapisu 3h obrokih se mora varno razdeliti na tri obroke");
  assert.deepEqual(tipkarskiRezultat.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.fatherCategory]; }), [
    ["installment_payment", 1333.33, "installment"], ["installment_payment", 1333.33, "installment"], ["installment_payment", 1333.34, "installment"],
    ["credit_note", 1000, "credit_note"], ["remaining_unpaid", 4446, "collection_outcome"],
  ], "vsak pomenski del tipkarskega stavka mora dobiti svojo FATHER kartico");
  assert.equal(tipkarskiRezultat.projectedRemainingDebtEur, 4446, "prekinitev stika ne sme dodatno odšteti dolga");
  assert.deepEqual(parser._test.detectFatherCategories(uporabnikovTipkarskiPrimer), ["installment", "credit_note", "collection_outcome"]);
  assert.equal(parser._test.requiresModelReasoning(uporabnikovTipkarskiPrimer), true, "večdelni tipkarski primer mora zahtevati semantični plan");
  var sorodniTipkarskiPrimer = parser._test.deterministicResult("plačala je 900 evrov v 2h obrokih nato 100 dobropisa, zatem se ni več odzivala", {
    referenceDate: "2026-08-27", originalDebt: 2000, remainingDebt: 2000,
  });
  assert.deepEqual(sorodniTipkarskiPrimer.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 450], ["installment_payment", 450], ["credit_note", 100], ["remaining_unpaid", 1000],
  ], "isti razred napake mora delovati tudi z drugo vsoto, številom obrokov in zapisom nedosegljivosti");

  var vagueUnpaidCorrected = parser.normalizeResult({ summary: "Dva plačana, naslednji neplačan.", needsClarification: false, events: [{
    type: "installment_payment", repeat: 2, amount: null, currency: "EUR", occurredDate: null, paymentMethod: null,
  }, {
    type: "unpaid_installment", repeat: 1, amount: null, currency: "EUR", occurredDate: null,
    description: "Naslednji obrok ni plačan.", confidence: "high",
  }] }, 9446, { text: "prva dva obroka je poravnal potem pa ni več nič plačal", referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.equal(vagueUnpaidCorrected.candidates[2].description, "3. obrok ni plačan", "strežniški kalkulator mora popraviti tudi nejasen Luna opis");

  var unsafe = parser.normalizeResult({
    summary: "", needsClarification: false,
    events: [{
      type: "partial_payment", repeat: 1, amount: 900, currency: "EUR",
      occurredDate: "2026-02-30", promisedDate: null, reason: null, description: null,
      confidence: "high", missing: [],
    }],
  }, 700).candidates[0];
  assert.equal(unsafe.amount, null, "znesek nad preostalim dolgom mora nazaj v dopolnitev");
  assert.equal(unsafe.occurredDate, null, "neobstoječ datum mora biti zavrnjen");
  assert.deepEqual(unsafe.missing.sort(), ["amount", "occurredDate", "paymentMethod"].sort());

  var percentage = parser._test.deterministicResult("Plačal je 90 procentov, dolžan je še 10.", {
    referenceDate: "2026-08-27", originalDebt: 1200, remainingDebt: 1200,
  });
  assert.equal(percentage.candidates[0].amount, 1080, "odstotek plačila mora uporabiti dejanski preostali dolg");
  assert.equal(percentage.candidates[0].occurredDate, null, "datum brez izrecne navedbe mora ostati vprašanje");
  assert.deepEqual(percentage.candidates[0].missing, ["occurredDate", "paymentMethod"]);
  var installments = parser._test.deterministicResult("Plačal je 3 obroke po 300 €.", {
    referenceDate: "2026-08-27", originalDebt: 2000, remainingDebt: 2000,
  });
  assert.equal(installments.candidates.length, 3, "trije opisani obroki morajo postati trije ločeni dogodki");
  assert.deepEqual(installments.candidates.map(function (candidate) { return candidate.amount; }), [300, 300, 300]);
  assert.ok(installments.candidates.every(function (candidate) { return candidate.missing.includes("occurredDate") && candidate.missing.includes("paymentMethod"); }));
  assert.equal(parser._test.inferAmountFromText("Poravnal je devetdeset odstotkov.", { remainingDebt: 700 }).amount, 630);
  assert.equal(parser._test.inferAmountFromText("Plačala je 12,5 % dolga.", { remainingDebt: 800 }).amount, 100);
  assert.equal(parser._test.inferAmountFromText("Dolguje še 10 %.", { remainingDebt: 1000 }).amount, 900);
  assert.equal(parser._test.inferAmountFromText("Po plačilu je ostalo še 120 EUR.", { remainingDebt: 1000 }).amount, 880);
  assert.equal(parser._test.inferAmountFromText("Vse je plačal, dolžan je pa še 1.000 €.", { remainingDebt: 9446 }).amount, 8446);
  assert.equal(parser._test.inferAmountFromText("Vse je plačal, dolžan je pa še 1.000 €.", { remainingDebt: 9446 }).remainingAmount, 1000);
  assert.equal(parser._test.inferAmountFromText("Plačal je 8 446 €, ostalo mu je 1.000 €.", { remainingDebt: 9446 }).ambiguous, false);
  assert.equal(parser._test.inferAmountFromText("Plačal je 90 %, ostalo je 20 %.", { remainingDebt: 1000 }).ambiguous, true, "nasprotujočih navedb ne sme samodejno razrešiti");
  assert.equal(parser._test.inferOccurredDate("Plačal je včeraj.", "2026-03-01"), "2026-02-28");
  assert.equal(parser._test.inferOccurredDate("Plačal je 31. 12.", "2026-01-02"), "2025-12-31");
  assert.equal(parser._test.inferOccurredDate("Plačal je, datum ni znan.", "2026-08-27"), null, "izrecno neznan datum mora ostati prazen");
  assert.equal(parser._test.inferOccurredDate("Plačal je 90 odstotkov.", "2026-08-27"), null, "odsoten datum se ne sme samodejno izpolniti");
  assert.equal(parser._test.inferPromisedDate("Obljubil je plačilo čez tri dni.", "2026-08-27"), "2026-08-30");
  assert.equal(parser._test.inferPromisedDate("Poravnal bo do 3. 1.", "2026-12-30"), "2027-01-03");

  var promise = parser._test.deterministicResult("Obljubil je, da bo jutri plačal 250 EUR.", {
    referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 700,
  });
  assert.equal(promise.candidates[0].type, "payment_promise");
  assert.equal(promise.candidates[0].amount, 250);
  assert.equal(promise.candidates[0].occurredDate, null);
  assert.equal(promise.candidates[0].promisedDate, "2026-08-28");
  assert.deepEqual(promise.candidates[0].missing, ["occurredDate", "communicationChannel"]);

  var refusal = parser._test.deterministicResult("Dolžnik je plačal 90 procentov dolga, za ostalo je rekel, da ne bo plačal.", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.equal(refusal.candidates.length, 3, "plačilo, izjava dolžnika in dokazni preostanek morajo postati ločeni dogodki");
  assert.deepEqual(refusal.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "debtor_statement", "remaining_unpaid"]);
  assert.ok(refusal.candidates.every(function (candidate) { return candidate.type !== "cancelled_invoice"; }), "zavrnitev dolžnika ni odpis");
  assert.equal(refusal.candidates[0].occurredDate, null);
  assert.ok(refusal.candidates[0].missing.includes("paymentMethod"));
  assert.ok(refusal.candidates[1].missing.includes("communicationChannel"));
  assert.equal(refusal.candidates[2].amount, 944.6);
  assert.deepEqual(refusal.candidates[2].missing, []);

  var stopped = parser._test.deterministicResult("Dolžan mi je bil za račun in je plačal 500 evrov, potem pa nič več ni plačal.", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(stopped.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "remaining_unpaid"], "delno plačilo in neplačan preostanek morata biti dva ločena dogodka");
  assert.equal(stopped.candidates[0].amount, 500, "navedeni znesek mora ostati v popravljivem polju");
  assert.deepEqual(stopped.candidates[0].missing, ["occurredDate", "paymentMethod"]);
  assert.equal(stopped.candidates[1].amount, 8946, "neplačani preostanek se mora izračunati iz dolga po plačilu");
  assert.deepEqual(stopped.candidates[1].missing, []);

  var statedBalance = parser._test.deterministicResult("vse je plačal dolžan je pa še 1000€", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(statedBalance.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "remaining_unpaid"]);
  assert.deepEqual(statedBalance.candidates.map(function (candidate) { return candidate.amount; }), [8446, 1000], "navedeni preostanek pomeni plačilo razlike, ne plačila istega zneska");
  assert.deepEqual(statedBalance.candidates[0].missing, ["occurredDate", "paymentMethod"]);
  assert.deepEqual(statedBalance.candidates[1].missing, []);

  ["dovzan", "dolzan", "douzan", "dovžan"].forEach(function (typo) {
    var typoBalance = parser._test.deterministicResult("vse je plačal " + typo + " je pa še 1000 evrov", {
      referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
    });
    assert.deepEqual(typoBalance.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "remaining_unpaid"], "tipkarski zapis " + typo + " mora ohraniti pomen preostanka");
    assert.deepEqual(typoBalance.candidates.map(function (candidate) { return candidate.amount; }), [8446, 1000]);
  });

  var lunaCorrected = parser.normalizeResult({ summary: "Plačano v celoti.", needsClarification: false, events: [{
    type: "paid_in_full", repeat: 1, amount: 9446, currency: "EUR", occurredDate: null,
    promisedDate: null, paymentMethod: null, communicationChannel: null, documentReference: null,
    reason: null, description: null, confidence: "high", missing: [],
  }] }, 9446, { text: "vse je plačal dovzan je pa še 1000 evrov", referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.deepEqual(lunaCorrected.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "remaining_unpaid"], "strežniški engine mora popraviti tudi napačen Luna paid_in_full odgovor");
  assert.deepEqual(lunaCorrected.candidates.map(function (candidate) { return candidate.amount; }), [8446, 1000]);
  assert.equal(JSON.parse(body.input).sourceText, "Včeraj je nakazal 100 EUR.", "Luna mora dobiti celotni izvorni opis");
  assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(body.input), "clauses"), false, "Luna mora biti pred normalizacijo klavzul");

  var excusePayment = parser._test.deterministicResult("začel se je izgovarjati da ne more plačati in zato je poravnal samo 3000 evrov", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(excusePayment.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "remaining_unpaid"], "delno plačilo z izgovorom mora ustvariti plačilo in neplačani preostanek");
  assert.deepEqual(excusePayment.candidates.map(function (candidate) { return candidate.amount; }), [3000, 6446], "engine mora neplačani preostanek izračunati iz trenutnega dolga");
  assert.equal(excusePayment.candidates[1].description, null, "izgovor brez izrecnega odgovora ne sme napolniti polja Kaj vam je povedal");
  assert.deepEqual(excusePayment.candidates[1].missing, [], "stanje neplačanega salda ne sme zahtevati izmišljenega stika z dolžnikom");

  var excuseLunaCorrected = parser.normalizeResult({ summary: "Delno plačilo.", needsClarification: false, events: [{
    type: "partial_payment", repeat: 1, amount: 3000, currency: "EUR", occurredDate: null,
    promisedDate: null, paymentMethod: null, communicationChannel: null, documentReference: null,
    reason: null, description: null, confidence: "high", missing: [],
  }] }, 9446, { text: "začel se je izgovarjati da ne more plačati in zato je poravnal samo 3000 evrov", referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.deepEqual(excuseLunaCorrected.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "remaining_unpaid"], "strežniški engine mora dopolniti tudi nepopoln Luna odgovor");
  assert.deepEqual(excuseLunaCorrected.candidates.map(function (candidate) { return candidate.amount; }), [3000, 6446]);
  assert.equal(excuseLunaCorrected.candidates[1].description, null);
  assert.doesNotMatch(body.instructions, /description ostati null|izgovarja/i, "kratka naloga ne sme vsebovati starega dolgega parser prompta");

  var explicitResponse = parser._test.deterministicResult("poravnal je samo 3000 evrov in po telefonu povedal, da nima denarja", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.equal(explicitResponse.candidates[1].description, "Nima denarja.", "jasno naveden dolžnikov odgovor se sme prenesti v polje");
  assert.equal(explicitResponse.candidates[1].communicationChannel, "phone");

  var hallucinatedResponse = parser.normalizeResult({ summary: "Delno plačilo.", needsClarification: false, events: [{
    type: "partial_payment", repeat: 1, amount: 2000, currency: "EUR", occurredDate: null, paymentMethod: null,
  }, {
    type: "remaining_unpaid", repeat: 1, amount: 7446, currency: "EUR", occurredDate: null, communicationChannel: "email",
    description: "Po plačilu 2.000 EUR ostaja neplačan preostanek 7.446 EUR.", confidence: "high",
  }] }, 9446, { text: "plačal je samo 2000 evrov", referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.equal(hallucinatedResponse.candidates[1].description, null, "Lunin povzetek ali izračun se ne sme pretvarjati v dolžnikov odgovor");
  assert.deepEqual(hallucinatedResponse.candidates[1].missing, []);

  var conflictingBalance = parser._test.deterministicResult("Plačal je 600 €, dolguje pa še 1.000 €.", {
    referenceDate: "2026-08-27", originalDebt: 1500, remainingDebt: 1500,
  });
  assert.equal(conflictingBalance.candidates[0].amount, null, "pri neskladnih zneskih sistem ne sme ugibati plačila");
  assert.ok(conflictingBalance.candidates[0].missing.includes("amount"));
  assert.equal(conflictingBalance.candidates[1].amount, 1000, "izrecno navedeni preostanek mora ostati znan");

  var onlyBalance = parser._test.deterministicResult("Nič ni plačal, dolguje pa še 1.000 €.", {
    referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 1000,
  });
  assert.deepEqual(onlyBalance.candidates.map(function (candidate) { return candidate.type; }), ["remaining_unpaid"], "zanikano plačilo ne sme ustvariti lažnega plačilnega dogodka");
  assert.equal(onlyBalance.candidates[0].amount, 1000);

  var paidEverything = parser._test.deterministicResult("Vse je plačal.", {
    referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 1000,
  });
  assert.equal(paidEverything.candidates[0].type, "paid_in_full");
  assert.equal(paidEverything.candidates[0].amount, 1000);

  var percentBalance = parser._test.deterministicResult("Plačal je, dolguje pa še 10 %.", {
    referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 1000,
  });
  assert.deepEqual(percentBalance.candidates.map(function (candidate) { return candidate.amount; }), [900, 100]);

  var guardedRefusal = parser.normalizeResult({ summary: "", needsClarification: false, events: [{
    type: "cancelled_invoice", repeat: 1, occurredDate: null, reason: "Ne bo plačal", description: null, confidence: "medium",
  }] }, 9446, { text: "Dolžnik je rekel, da ne bo plačal.", referenceDate: "2026-08-27", remainingDebt: 9446 });
  assert.equal(guardedRefusal.candidates[0].type, "debtor_statement", "tudi napačen modelski odpis mora biti popravljen v izjavo");
  assert.equal(parser._test.eventTypeFromText("Račun smo odpisali."), "cancelled_invoice");
  assert.equal(parser._test.eventTypeFromText("Račun občini je bil preklican."), "cancelled_invoice");

  var noviPrimeri = [
    ["Montaža je danes z nakazilom plačala celoten dolg 9.446 €.", "paid_in_full"],
    ["Direktna obremenitev podjetja je bila zavrnjena zaradi premalo sredstev.", "payment_failed"],
    ["Investitor ugovarja računu, ker dela niso dokončana.", "invoice_dispute"],
    ["Prevozništvo prosi za podaljšanje roka plačila do 15. 9. 2026.", "deadline_extension"],
    ["Dogovorili smo se za plačilo v treh mesečnih obrokih.", "installment_agreement"],
    ["Za dolžnika je bil začet stečajni postopek.", "insolvency"],
    ["Elektro Partner je dolg poravnal s pobotom 430 €.", "compensation"],
  ];
  noviPrimeri.forEach(function (primer) {
    var rezultat = parser._test.deterministicResult(primer[0], { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
    assert.ok(rezultat && rezultat.candidates.length, "primer mora biti lokalno prepoznan: " + primer[0]);
    assert.equal(rezultat.candidates[0].type, primer[1]);
  });
  var celotno = parser._test.deterministicResult("Račun je bil poravnan v celoti.", { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.equal(celotno.candidates[0].amount, 9446, "izrecno celotno plačilo uporabi dejanski preostali dolg");

  var credit = parser._test.deterministicResult("Danes je bil izdan dobropis za 125,50 EUR.", {
    referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 700,
  });
  assert.equal(credit.candidates[0].type, "credit_note");
  assert.equal(credit.candidates[0].amount, 125.5);

  var cumulative = parser.normalizeResult({ summary: "", needsClarification: false, events: [
    { type: "partial_payment", repeat: 1, amount: 600, occurredDate: "2026-08-20", confidence: "high" },
    { type: "credit_note", repeat: 1, amount: 200, occurredDate: "2026-08-21", confidence: "high" },
  ] }, 700);
  assert.equal(cumulative.candidates[0].amount, 600);
  assert.equal(cumulative.candidates[1].amount, null, "vsota več dogodkov ne sme preseči preostalega dolga");
  assert.ok(cumulative.candidates[1].missing.includes("amount"));

  var noKeyCalls = 0;
  var noKey = await parser.analyze("Nakazal je polovico dolga danes.", {
    referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 700,
  }, {
    apiKey: false,
    fetchImpl: async function () { noKeyCalls += 1; throw new Error("modelski klic brez ključa ni dovoljen"); },
  });
  assert.equal(noKeyCalls, 0, "brez ključa ne sme biti zunanjega klica");
  assert.deepEqual(noKey.candidates, [], "brez Luninega pregleda se kartice ne smejo prikazati");
  assert.equal(noKey.semanticPlan.requested, true);
  assert.equal(noKey.semanticPlan.attempted, false);
  assert.equal(noKey.semanticPlan.source, "clarification");
  assert.equal(noKey.semanticPlan.reason, "luna_review_not_configured");
  assert.equal(noKey.semanticPlan.status, "NOT_ATTEMPTED");

  var simpleReviewCalls = 0;
  var simpleReviewed = await parser.analyze("Nakazal je polovico dolga danes.", {
    referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 700,
  }, {
    apiKey: "mock-luna",
    fetchImpl: async function () { simpleReviewCalls += 1; return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } }; },
  });
  assert.equal(simpleReviewCalls, 1, "tudi jasen enodogodkovni plan mora ob ključu poklicati Luno natanko enkrat");
  assert.equal(simpleReviewed.semanticPlan.requested, true);
  assert.equal(simpleReviewed.semanticPlan.attempted, true);
  assert.equal(simpleReviewed.semanticPlan.source, "validated_semantic_plan");
  assert.equal(simpleReviewed.semanticPlan.reason, "luna_review_ok");
  assert.equal(simpleReviewed.semanticPlan.status, "OK");
  assert.equal(simpleReviewed.candidates[0].amount, 350);

  var complexProviderCalls = 0;
  var complexAnalyzed = await parser.analyze("Janez Novak je plačal 3000 evrov v treh obrokov 1000 evrov, ostalo je še dolžan", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only",
    userId: "user-123",
    fetchImpl: async function (_url, options) {
      complexProviderCalls += 1;
      var sent = JSON.parse(options.body);
      assert.equal(sent.model, "gpt-5.6-luna");
      assert.equal(JSON.parse(sent.input).sourceText, "Janez Novak je plačal 3000 evrov v treh obrokov 1000 evrov, ostalo je še dolžan", "kompleksni vnos mora do Lune priti v celotnem kontekstu");
      return {
        ok: true,
        json: async function () { return { output_text: "OK" }; },
      };
    },
  });
  assert.equal(complexProviderCalls, 1, "sestavljena obročna razdelitev mora zahtevati semantični plan");
  assert.deepEqual(complexAnalyzed.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 1000], ["installment_payment", 1000], ["installment_payment", 1000],
  ], "varnostni izračun mora modelski rezultat razdeliti na pravilne obroke");

  var fallbackStarted = Date.now();
  var timeoutFallback = await parser.analyze("plačal je 3000 evrov v treh obrokov 1000 evrov ostalo je še dolžan", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only",
    timeoutMs: 120,
    fetchImpl: function (_url, options) {
      return new Promise(function (_resolve, reject) {
        options.signal.addEventListener("abort", function () {
          var error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    },
  });
  assert.ok(Date.now() - fallbackStarted < 500, "počasen model mora zaključiti pri nadzorovanem testnem roku");
  assert.deepEqual(timeoutFallback.candidates, [], "timeout ne sme prikazati nepreverjenih kartic");
  assert.equal(timeoutFallback.semanticPlan.reason, "luna_review_timeout");

  var providerCalls = 0;
  var analyzed = await parser.analyze("Prejel sem obvestilo o poravnavi računa.", {
    referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 700,
  }, {
    apiKey: "test-only",
    userId: "user-123",
    fetchImpl: async function (url, options) {
      providerCalls += 1;
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.match(options.headers.Authorization, /^Bearer test-only$/);
      return {
        ok: true,
        json: async function () { return { output_text: "OK" }; },
      };
    },
  });
  assert.equal(providerCalls, 1, "ena uporabnikova razčlenitev sme sprožiti največ en modelski klic");
  assert.deepEqual(analyzed.candidates, [], "modelski dogodek brez deterministične dokazne klavzule ne sme postati kartica");
  assert.equal(analyzed.needsClarification, true);
  assert.equal(analyzed.coverage.complete, false);
  assert.equal(analyzed.projectedRemainingDebtEur, 700);
  assert.ok(Array.isArray(analyzed.questionPlan), "parser mora vrniti enoten vprašalni plan");

  var oldConfig = db.uporabniskaKonfiguracija;
  var oldAuth = db.preveriUporabnika;
  var oldAnalyze = parser.analyze;
  var oldPosMocks = process.env.POS_LOCAL_MOCKS_ENABLED;
  try {
    process.env.POS_LOCAL_MOCKS_ENABLED = "true";
    db.uporabniskaKonfiguracija = function () { return { ok: true }; };
    db.preveriUporabnika = async function () { return { ok: false, status: 502, code: "AUTH_SERVER_UNAVAILABLE", retryable: true, napaka: "Prijava začasno ni dosegljiva." }; };
    var unauthorized = await runHandler({ requestId: "history-request-auth", text: "Opis", originalDebt: 500, remainingDebt: 450 });
    assert.equal(unauthorized.statusCode, 502, "strežniška razčlenitev mora ohraniti dejanski status prijavne plasti");
    assert.equal(unauthorized.payload.code, "AUTH_SERVER_UNAVAILABLE", "odjemalec mora dobiti natančno kodo za varen ponovni poskus");
    assert.equal(unauthorized.payload.retryable, true, "začasna prijavna napaka mora biti označena kot ponovljiva");
    db.preveriUporabnika = async function () { return { ok: true, user: { id: "auth-user" } }; };
    var endpointCalls = 0;
    var endpointContext = null;
    var endpointOptions = null;
    parser.analyze = async function (_text, context, options) {
      endpointCalls += 1;
      endpointContext = context;
      endpointOptions = options;
      return {
        summary: "Pripravljeno.", needsClarification: false,
        semanticPlan: { requested: true, attempted: false, source: "clarification", reason: "luna_review_not_configured", status: "NOT_ATTEMPTED" },
        candidates: [{ candidateId: "candidate-1", type: "partial_payment", amount: 50, occurredDate: "2026-08-26", missing: [] }],
        projectedRemainingDebtEur: 400,
        questionPlan: [{ candidateIndex: 0, fields: ["paymentMethod"], missing: ["paymentMethod"] }],
        ledger: [{ candidateIndex: 0, type: "partial_payment", beforeEur: 450, effectEur: -50, afterEur: 400 }],
      };
    };
    handler._test.runtime.cache.clear();
    handler._test.runtime.users.clear();
    var request = { requestId: "history-request-0001", text: "Plačal je 50 EUR.", referenceDate: "2026-08-28", originalDebt: 500, remainingDebt: 450 };
    var first = await runHandler(request);
    var retry = await runHandler(request);
    assert.equal(first.statusCode, 200);
    assert.equal(first.payload.contractVersion, parser.CONTRACT_VERSION, "API mora razkriti različico avtoritativnega contracta");
    assert.equal(Object.prototype.hasOwnProperty.call(endpointOptions, "apiKey"), false, "handler mora Luni vedno prepustiti strežniški OPENAI_API_KEY");
    assert.equal(first.payload.semanticPlan.requested, true);
    assert.equal(first.payload.semanticPlan.attempted, false, "API mora razkriti, da Luna ni bila poskušena");
    assert.equal(first.payload.semanticPlan.source, "clarification");
    assert.equal(first.payload.semanticPlan.reason, "luna_review_not_configured");
    assert.equal(first.payload.clarificationExhausted, false, "API mora izrecno razlikovati običajen rezultat od izčrpane razjasnitve");
    assert.equal(first.payload.referenceDate, "2026-08-28", "API mora ohraniti lokalni koledarski dan uporabnika");
    assert.equal(endpointContext.referenceDate, "2026-08-28", "parser mora prejeti isti lokalni referenčni datum");
    assert.equal(first.payload.projectedRemainingDebtEur, 400, "handler mora izpostaviti predvideni dolg");
    assert.deepEqual(first.payload.questionPlan[0].missing, ["paymentMethod"], "handler mora izpostaviti vprašalni plan");
    assert.equal(first.payload.ledger[0].afterEur, 400, "handler mora izpostaviti avtoritativni ledger");
    assert.equal(retry.payload.projectedRemainingDebtEur, first.payload.projectedRemainingDebtEur, "cache revalidacija mora ohraniti finančni rezultat");
    assert.deepEqual(retry.payload.candidates[0].requiredFields, ["amount", "occurredDate", "paymentMethod"], "cache kandidat se mora ponovno validirati skozi aktualni contract");
    assert.deepEqual(retry.payload.missing[0].fields, ["occurredDate", "paymentMethod"]);
    assert.equal(retry.payload.needsClarification, true, "ponovno validiran cache mora izpostaviti res manjkajoča polja");
    assert.equal(endpointCalls, 1, "ponovitev iste zahteve mora uporabiti idempotentni odgovor");
    process.env.POS_LOCAL_MOCKS_ENABLED = "false";
    var outsidePos = await runHandler({ requestId: "history-request-always-luna", text: "Plačal je 50 EUR.", referenceDate: "2026-08-28", originalDebt: 500, remainingDebt: 450 });
    assert.equal(outsidePos.statusCode, 200);
    assert.equal(Object.prototype.hasOwnProperty.call(endpointOptions, "apiKey"), false, "handler ne sme zunanjega Luna klica izklopiti niti zunaj POS mock načina");
    process.env.POS_LOCAL_MOCKS_ENABLED = "true";
    var alwaysLive = await runHandler({ requestId: "history-request-always-live", text: "Plačal je 50 EUR.", referenceDate: "2026-08-28", originalDebt: 500, remainingDebt: 450 });
    assert.equal(alwaysLive.statusCode, 200);
    assert.equal(Object.prototype.hasOwnProperty.call(endpointOptions, "apiKey"), false, "vsak prijavljen zahtevek mora uporabiti svež Luna-first tok tudi ob POS mock načinu");
    var reused = await runHandler(Object.assign({}, request, { text: "Drug opis." }));
    assert.equal(reused.statusCode, 409);
    assert.equal(reused.payload.code, "REQUEST_ID_REUSED");
    var changedReferenceDate = await runHandler(Object.assign({}, request, { referenceDate: "2026-08-27" }));
    assert.equal(changedReferenceDate.statusCode, 409, "idempotentni cache ne sme ponovno uporabiti rezultata za drug referenčni dan");
    var invalidReferenceDate = await runHandler(Object.assign({}, request, { requestId: "history-request-invalid-date", referenceDate: "2026-02-30" }));
    assert.equal(invalidReferenceDate.statusCode, 400, "neveljaven lokalni datum mora biti zavrnjen");
    var forbiddenFourthRound = await runHandler(Object.assign({}, request, {
      requestId: "history-request-fourth-round",
      clarification: { question: "Kaj se je zgodilo?", clauseId: "clause-1", answer: "Ne vem.", round: 3 },
    }));
    assert.equal(forbiddenFourthRound.statusCode, 400, "API mora četrti Lunini klic zavrniti pred parserjem");
    assert.equal(handler._test.todayInLjubljana(new Date("2026-08-27T22:30:00.000Z")), "2026-08-28", "strežniški fallback mora ob polnoči uporabiti slovenski in ne UTC-dan");
    assert.notEqual(
      handler._test.requestFingerprint("Opis", 500, 450, "2026-08-28", { clauseId: "clause-1", question: "Kaj?", answer: "Prvi odgovor", round: 1 }),
      handler._test.requestFingerprint("Opis", 500, 450, "2026-08-28", { clauseId: "clause-1", question: "Kaj?", answer: "Drugi odgovor", round: 1 }),
      "različna pojasnila ne smejo deliti idempotentnega rezultata"
    );
    var canonicalEndpointCalls = 0;
    parser.analyze = async function () {
      canonicalEndpointCalls += 1;
      return {
        summary: "Kanonični plan.", needsClarification: true,
        semanticPlan: { requested: true, attempted: true, source: "validated_canonical_plan", reason: "luna_canonical_plan_applied", status: "OK" },
        candidates: [{ candidateId: "candidate-1", type: "partial_payment", amount: 1000, occurredDate: "2026-07-21", paymentMethod: null, requiredFields: ["amount", "occurredDate", "paymentMethod"], missing: ["paymentMethod"] }],
        projectedRemainingDebtEur: 8446,
        questionPlan: [{ candidateIndex: 0, fields: ["amount", "occurredDate", "paymentMethod"], missing: ["paymentMethod"] }],
        ledger: [{ candidateIndex: 0, type: "partial_payment", beforeEur: 9446, effectEur: -1000, afterEur: 8446 }],
        fieldOrder: [{ candidateIndex: 0, fields: ["amount", "occurredDate", "paymentMethod"] }],
        requiredFields: [{ candidateIndex: 0, fields: ["amount", "occurredDate", "paymentMethod"] }],
        missing: [{ candidateIndex: 0, fields: ["paymentMethod"] }],
      };
    };
    var canonicalRequest = { requestId: "history-request-canonical-cache", text: "plačal je 1000 evrov 21ga prejšni mesec", referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446 };
    var canonicalFirst = await runHandler(canonicalRequest);
    var canonicalRetry = await runHandler(canonicalRequest);
    assert.equal(canonicalEndpointCalls, 1, "idempotentni canonical retry ne sme ponovno klicati Lune");
    assert.equal(canonicalRetry.payload.semanticPlan.source, "validated_canonical_plan");
    assert.equal(canonicalRetry.payload.candidates[0].occurredDate, "2026-07-21", "cache ne sme canonical vrednosti poslati nazaj skozi lokalni leksikalni parser");
    assert.deepEqual(canonicalRetry.payload, canonicalFirst.payload, "canonical cache mora ohraniti že validiran rezultat");
    handler._test.runtime.users.clear();
    for (var rateIndex = 0; rateIndex < 12; rateIndex += 1) assert.equal(handler._test.reserve("rate-user", 1000), true);
    assert.equal(handler._test.reserve("rate-user", 1000), false, "trinajsta zahteva v minuti mora biti zavrnjena");
  } finally {
    db.uporabniskaKonfiguracija = oldConfig;
    db.preveriUporabnika = oldAuth;
    parser.analyze = oldAnalyze;
    if (oldPosMocks == null) delete process.env.POS_LOCAL_MOCKS_ENABLED;
    else process.env.POS_LOCAL_MOCKS_ENABLED = oldPosMocks;
    handler._test.runtime.cache.clear();
    handler._test.runtime.users.clear();
  }

  var zaporednaPlacilaText = "plačal je 2000 evrov nato 1000 evrov potem pa me je skenslal";
  var zaporednaPlacila = parser._test.deterministicResult(zaporednaPlacilaText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(zaporednaPlacila.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["partial_payment", 2000], ["partial_payment", 1000], ["remaining_unpaid", 6446],
  ], "vsak zaporedno naveden plačani znesek mora postati svoj dogodek");
  assert.ok(zaporednaPlacila.candidates.slice(0, 2).every(function (candidate) { return candidate.paymentMethod === null; }), "engine ne sme izmišljati načina plačila");
  assert.equal(zaporednaPlacila.candidates[2].description, "Dolžnik je prekinil stik.");

  var skupinskiDatumText = "plačal je 4 obroke po 1000 evrov 1mesec dni nazaj in danes pa je plačal še 1000";
  var skupinskiDatumContext = { referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446 };
  var skupinskiDatumContract = parser._test.buildFactContract(skupinskiDatumText);
  var skupinskiDatumLocal = parser._test.deterministicResult(skupinskiDatumText, skupinskiDatumContext);
  assert.equal(skupinskiDatumContract.version, 26);
  assert.deepEqual(skupinskiDatumContract.clauses.map(function (clause) { return clause.eventTypes; }), [
    ["installment_payment"], ["partial_payment"],
  ], "časovni prehod 'in danes' mora ustvariti ločeno plačilno klavzulo");
  assert.equal(skupinskiDatumContract.facts.find(function (fact) { return fact.kind === "date_relation"; }).groupId, "installment-group-1", "datum zaključene obročne skupine mora biti vezan na skupino");
  assert.deepEqual(skupinskiDatumLocal.candidates.map(function (candidate) {
    return [candidate.type, candidate.amount, candidate.occurredDate];
  }), [
    ["installment_payment", 1000, "2026-07-28"],
    ["installment_payment", 1000, "2026-07-28"],
    ["installment_payment", 1000, "2026-07-28"],
    ["installment_payment", 1000, "2026-07-28"],
    ["partial_payment", 1000, "2026-08-28"],
  ], "štirje obroki morajo ostati na skupnem preteklem datumu, današnje plačilo pa mora biti peti dogodek");
  assert.deepEqual(skupinskiDatumLocal.ledger.map(function (entry) { return entry.afterEur; }), [8446, 7446, 6446, 5446, 4446]);
  assert.equal(skupinskiDatumLocal.coverage.complete, true);
  assert.equal(skupinskiDatumLocal.coverage.obligations.find(function (item) { return item.kind === "date_relation"; }).expectedCount, 4);

  [
    "plačal je 4 obroke po 1000 evrov 1mesec dni nazaj",
    "1mesec dni nazaj je plačal 4 obroke po 1000 evrov",
    "plačal je štiri obroke po 1000 evrov mesec dni nazaj",
  ].forEach(function (input) {
    var result = parser._test.deterministicResult(input, skupinskiDatumContext);
    assert.deepEqual(result.candidates.map(function (candidate) { return candidate.occurredDate; }), [
      "2026-07-28", "2026-07-28", "2026-07-28", "2026-07-28",
    ], "skupinski datum mora veljati za vse zapisne različice: " + input);
    assert.equal(result.coverage.complete, true, "coverage mora ostati popoln: " + input);
  });

  var skupinskiDatumLunaCalls = 0;
  var skupinskiDatumReviewed = await parser.analyze(skupinskiDatumText, skupinskiDatumContext, {
    apiKey: "mock-luna",
    fetchImpl: async function (_url, options) {
      skupinskiDatumLunaCalls += 1;
      var reviewBody = JSON.parse(options.body);
      var bareFacts = JSON.parse(reviewBody.input);
      assert.equal(Object.prototype.hasOwnProperty.call(bareFacts, "clauses"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(bareFacts, "proposedPlan"), false);
      assert.equal(bareFacts.sourceText, skupinskiDatumText);
      return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } };
    },
  });
  assert.equal(skupinskiDatumLunaCalls, 1, "tudi dokazno popoln skupinski plan mora Luno poklicati natanko enkrat");
  assert.equal(skupinskiDatumReviewed.semanticPlan.requested, true);
  assert.equal(skupinskiDatumReviewed.semanticPlan.attempted, true);
  assert.equal(skupinskiDatumReviewed.semanticPlan.source, "validated_semantic_plan");
  assert.equal(skupinskiDatumReviewed.semanticPlan.reason, "luna_review_ok");
  assert.deepEqual(skupinskiDatumReviewed.candidates.map(function (candidate) { return candidate.occurredDate; }), [
    "2026-07-28", "2026-07-28", "2026-07-28", "2026-07-28", "2026-08-28",
  ]);

  var relativniZnesekText = "prvi mesec je plačal 1000 naslednji teden 100 več kot prvi mesec in danes pa 1000";
  var relativniZnesekContract = parser._test.buildFactContract(relativniZnesekText);
  var relativniZnesekLocal = parser._test.deterministicResult(relativniZnesekText, skupinskiDatumContext);
  assert.deepEqual(relativniZnesekContract.clauses.map(function (clause) { return clause.text; }), [
    "prvi mesec je plačal 1000", "naslednji teden 100 več kot prvi mesec in", "danes pa 1000",
  ], "relativni znesek in današnje plačilo morata postati ločena koraka");
  var relativniZnesekFact = relativniZnesekContract.facts.find(function (fact) { return fact.kind === "amount_relation"; });
  assert.deepEqual([relativniZnesekFact.value, relativniZnesekFact.relation.direction, relativniZnesekFact.relation.anchor, relativniZnesekFact.relation.anchorIndex], [100, 1, "event_index", 0]);
  assert.deepEqual(relativniZnesekLocal.candidates.map(function (candidate) { return [candidate.amount, candidate.occurredDate]; }), [
    [1000, null], [1100, null], [1000, "2026-08-28"],
  ]);
  assert.deepEqual(relativniZnesekLocal.ledger.map(function (entry) { return entry.afterEur; }), [8446, 7346, 6346]);
  assert.equal(relativniZnesekLocal.coverage.complete, true);

  var prijavljeniRelativniText = "plačal je mesec dni nazaj 4000 potem čez 2 tedna 100 več kot prvi obrok in nato čez tri tedne 3000";
  var prijavljeniRelativniLocal = parser._test.deterministicResult(prijavljeniRelativniText, skupinskiDatumContext);
  assert.deepEqual(prijavljeniRelativniLocal.candidates.map(function (candidate) { return [candidate.amount, candidate.occurredDate]; }), [
    [4000, "2026-07-28"], [4100, "2026-08-11"], [3000, "2026-09-01"],
  ], "delta 100 mora povečati prvi obrok, ne postati obrok 100");
  assert.equal(prijavljeniRelativniLocal.coverage.complete, true);
  assert.deepEqual(prijavljeniRelativniLocal.coverage.consumed.filter(function (item) { return item.kind === "amount_relation"; }).map(function (item) {
    return [item.anchorCandidateIndex, item.resolvedAmount];
  }), [[0, 4100]]);

  var lunaSolutionCalls = 0;
  var lunaSolution = await parser.analyze(prijavljeniRelativniText, skupinskiDatumContext, {
    apiKey: "mock-luna",
    fetchImpl: async function (_url, options) {
      lunaSolutionCalls += 1;
      var sentBody = JSON.parse(options.body);
      var sentFacts = JSON.parse(sentBody.input);
      assert.equal(Object.prototype.hasOwnProperty.call(sentFacts, "clauses"), false, "relativni znesek mora Luna razbrati iz surovega teksta");
      assert.equal(sentFacts.sourceText, prijavljeniRelativniText, "Luna mora dobiti celotni izvorni opis");
      return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({ plan: [
        { clauseId: "clause-1", eventType: "partial_payment", count: 1 },
        { clauseId: "clause-2", eventType: "installment_payment", count: 1 },
        { clauseId: "clause-3", eventType: "installment_payment", count: 1 },
      ] }) }; } };
    },
  });
  assert.equal(lunaSolutionCalls, 1);
  assert.equal(lunaSolution.semanticPlan.status, "CORRECTED");
  assert.equal(lunaSolution.semanticPlan.reason, "luna_review_solution_applied");
  assert.deepEqual(lunaSolution.candidates.map(function (candidate) { return [candidate.amount, candidate.occurredDate]; }), [
    [4000, "2026-07-28"], [4100, "2026-08-11"], [3000, "2026-09-01"],
  ]);

  var lunaVednoExactText = "plačaj je 1 mesec dni nazaj 1000 nato čez dva tedna 100 več nato čez 1 teden 200 več in danes je pa plačal v dveh obrokih 100";
  var lunaVednoExactContract = parser._test.buildFactContract(lunaVednoExactText);
  var lunaVednoExactLocal = parser._test.deterministicResult(lunaVednoExactText, skupinskiDatumContext);
  assert.equal(lunaVednoExactContract.clauses.length, 4, "pogovorni zapis mora ohraniti štiri pomenske klavzule");
  assert.deepEqual(lunaVednoExactContract.clauses.slice(1, 3).map(function (clause) {
    return clause.values.filter(function (value) { return value.kind === "amount_relation"; }).map(function (value) {
      return [value.relation.deltaEur, value.relation.direction, value.relation.anchor];
    });
  }), [[[100, 1, "previous_event"]], [[200, 1, "previous_event"]]], "gola zapisa 100 več in 200 več morata biti relativna na prejšnji korak");
  assert.deepEqual(lunaVednoExactContract.installmentGroups.map(function (group) {
    return [group.count, group.amount, group.completed];
  }), [[2, 100, true]], "v dveh obrokih 100 pomeni dva zaključena obroka po 100");
  assert.deepEqual(lunaVednoExactLocal.candidates.map(function (candidate) {
    return [candidate.type, candidate.amount, candidate.occurredDate];
  }), [
    ["partial_payment", 1000, "2026-07-28"],
    ["partial_payment", 1100, "2026-08-11"],
    ["partial_payment", 1300, "2026-08-18"],
    ["installment_payment", 100, "2026-08-28"],
    ["installment_payment", 100, "2026-08-28"],
  ]);
  assert.deepEqual(lunaVednoExactLocal.ledger.map(function (entry) { return entry.afterEur; }), [8446, 7346, 6046, 5946, 5846]);
  assert.equal(lunaVednoExactLocal.coverage.complete, true);
  assert.deepEqual(lunaVednoExactLocal.coverage.unconsumed, []);

  var lunaVednoExactCalls = 0;
  var lunaVednoExact = await parser.analyze(lunaVednoExactText, skupinskiDatumContext, {
    apiKey: "mock-luna",
    fetchImpl: async function (_url, options) {
      lunaVednoExactCalls += 1;
      var body = JSON.parse(options.body);
      var facts = JSON.parse(body.input);
      assert.equal(Object.prototype.hasOwnProperty.call(facts, "proposedPlan"), false);
      assert.equal(facts.sourceText, lunaVednoExactText, "Luna mora celoten tekst presojati v kontekstu");
      return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } };
    },
  });
  assert.equal(lunaVednoExactCalls, 1, "Luna mora tudi za popoln deterministični plan biti poklicana natanko enkrat");
  assert.deepEqual([lunaVednoExact.semanticPlan.requested, lunaVednoExact.semanticPlan.attempted, lunaVednoExact.semanticPlan.status, lunaVednoExact.semanticPlan.reason], [true, true, "OK", "luna_review_ok"]);
  assert.deepEqual(lunaVednoExact.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), lunaVednoExactLocal.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }));

  [
    ["plačala je 1200 evrov, zatem 800 evrov, pozneje pa me je blokirala", [1200, 800, 7446]],
    ["plačal je 500 EUR in še 300 EUR potem pa se ne javlja", [500, 300, 8646]],
    ["poravnal je 700 evrov, kasneje 200 evrov, zdaj ga ignorira", [700, 200, 8546]],
    ["nakazal je 400 evrov potem plačal 100 evrov nato nič več", [400, 100, 8946]],
  ].forEach(function (primer) {
    var result = parser._test.deterministicResult(primer[0], {
      referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
    });
    assert.deepEqual(result.candidates.map(function (candidate) { return candidate.amount; }), primer[1], "zaporedna plačila morajo ostati ločena: " + primer[0]);
  });

  var modelZNapako = parser.normalizeResult({ summary: "Napačen model.", needsClarification: false, events: [
    { type: "partial_payment", repeat: 1, amount: 2000, paymentMethod: "card", occurredDate: "2026-08-26" },
    { type: "insolvency", repeat: 1, amount: null, occurredDate: null, description: "Izmišljeno." },
  ] }, 9446, {
    text: zaporednaPlacilaText, referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(modelZNapako.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["partial_payment", 2000], ["partial_payment", 1000], ["remaining_unpaid", 6446],
  ], "normalizator mora obnoviti izpuščeno plačilo in zavrniti nepodprt dogodek");
  assert.equal(modelZNapako.candidates[0].paymentMethod, null);
  assert.equal(modelZNapako.candidates[0].occurredDate, null);
  assert.ok(modelZNapako.diagnostics.includes("unsupported_payment_method_rejected:0"));
  assert.ok(modelZNapako.diagnostics.includes("unsupported_father_rejected:insolvency"));
  assert.ok(modelZNapako.diagnostics.includes("explicit_payment_sequence_rebuilt"));

  var relativeText = "plačal je en obrok po 1999 potem pa čez 2 meseca je plačal 2999";
  var relativeContract = parser._test.buildFactContract(relativeText);
  var relativeResult = parser._test.deterministicResult(relativeText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.equal(relativeContract.version, 26, "always-review full-text contract mora uporabljati interni fact contract 26");
  assert.deepEqual(relativeContract.facts.filter(function (fact) { return fact.kind === "money"; }).map(function (fact) { return fact.value; }), [1999, 2999], "časovni števec ne sme postati denar");
  assert.deepEqual(relativeContract.facts.filter(function (fact) { return fact.kind === "date_relation"; }).map(function (fact) {
    return [fact.relation.anchor, fact.relation.direction, fact.relation.amount, fact.relation.unit];
  }), [["previous_event", 1, 2, "month"]]);
  assert.deepEqual(relativeResult.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [["installment_payment", 1999], ["partial_payment", 2999]]);
  assert.equal(relativeResult.candidates[1].dateRelation.anchorCandidateId, relativeResult.candidates[0].candidateId);
  assert.ok(relativeResult.candidates[1].missing.includes("occurredDate"), "relacija brez sidrnega datuma še ne sme izmišljati datuma");
  assert.ok(relativeResult.questionPlan[1].missing.includes("occurredDate"));
  assert.deepEqual(relativeResult.ledger.map(function (entry) { return entry.afterEur; }), [7447, 4448]);

  var staleRelativeModel = parser.normalizeResult({ summary: "zastarel datum", events: [
    { type: "installment_payment", amount: 1999, occurredDate: "2026-01-31", confidence: "low" },
    { type: "partial_payment", amount: 2999, occurredDate: "2026-02-01", confidence: "low" },
  ] }, 9446, { text: relativeText, referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.equal(staleRelativeModel.candidates[1].occurredDate, null, "modelski datum ne sme premagati deterministične relacije");
  assert.equal(staleRelativeModel.candidates[1].dateRelation.amount, 2);
  assert.ok(staleRelativeModel.diagnostics.includes("unsupported_occurred_date_rejected:1"));

  var relativeProviderCalls = 0;
  var relativeFastPath = await parser.analyze(relativeText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  }, { apiKey: "test-only", fetchImpl: async function () { relativeProviderCalls += 1; return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } }; } });
  assert.equal(relativeProviderCalls, 1);
  assert.equal(relativeFastPath.candidates[1].dateRelation.unit, "month");

  var previousMonthDayText = "plačal je 2000 evrov 21ga prejšnji mesec nato je 2 tedna nazaj plačal 2999.. danes 1000 in je rekel da ne bo več";
  var previousMonthDayContext = { referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446 };
  var previousMonthDayContract = parser._test.buildFactContract(previousMonthDayText);
  var previousMonthDayResult = parser._test.deterministicResult(previousMonthDayText, previousMonthDayContext);
  assert.deepEqual(previousMonthDayContract.facts.filter(function (fact) { return fact.kind === "date_relation"; }).map(function (fact) {
    return [fact.relation.reason, fact.relation.dayOfMonth || null, fact.relation.direction, fact.relation.amount, fact.relation.unit, fact.sourceSpan.text];
  }), [
    ["relative_previous_month_day", 21, -1, 1, "month", "21ga prejšnji mesec"],
    ["relative_before_reference", null, -1, 2, "week", "2 tedna nazaj"],
  ], "exact zapis iz UI mora ohraniti oba časovna dokaza");
  assert.deepEqual(previousMonthDayResult.candidates.slice(0, 3).map(function (candidate) {
    return [candidate.amount, candidate.occurredDate, candidate.missing];
  }), [
    [2000, "2026-07-21", ["paymentMethod"]],
    [2999, "2026-08-14", ["paymentMethod"]],
    [1000, "2026-08-28", ["paymentMethod"]],
  ], "21ga prejšnji mesec mora biti izračunan datum, ne manjkajoče vprašanje");
  assert.deepEqual(previousMonthDayResult.ledger.map(function (entry) { return entry.afterEur; }), [7446, 4447, 3447]);
  assert.equal(previousMonthDayResult.coverage.complete, true);

  [
    "21ga prejšnji mesec",
    "21ega prejšnji mesec",
    "21-ga prejšnji mesec",
    "21. prejšnji mesec",
    "21. v prejšnjem mesecu",
    "21ega prejšnjega meseca",
    "prejšnji mesec 21ga",
    "v prejsnjem mesecu 21.",
  ].forEach(function (datePhrase) {
    var text = "plačal je 2000 evrov " + datePhrase;
    var contract = parser._test.buildFactContract(text);
    var result = parser._test.deterministicResult(text, previousMonthDayContext);
    var relation = contract.facts.find(function (fact) { return fact.kind === "date_relation"; });
    assert.deepEqual([relation && relation.relation.dayOfMonth, relation && relation.relation.anchor], [21, "reference_date"], "pogovorna oblika mora ostati dokaz: " + text);
    assert.equal(result.candidates[0].occurredDate, "2026-07-21", "pogovorna oblika mora dati 21. 7. 2026: " + text);
    assert.deepEqual(result.candidates[0].missing, ["paymentMethod"], "datum ne sme ostati med manjkajočimi polji: " + text);
    assert.equal(result.coverage.complete, true, "časovni dokaz mora biti porabljen natanko enkrat: " + text);
  });
  var impossiblePreviousMonthDay = parser._test.deterministicResult("plačal je 2000 evrov 31ga prejšnji mesec", {
    referenceDate: "2026-03-28", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.equal(impossiblePreviousMonthDay.candidates[0].occurredDate, null, "neobstoječi 31. februar se ne sme izmišljati");
  assert.ok(impossiblePreviousMonthDay.candidates[0].missing.includes("occurredDate"));

  var exactThreeDaysText = "plačal je 1 obrok po 1000 v mesecu potem pa je še 3 dni nazaj poravnal 400 in je bilo to to";
  var exactThreeDays = parser._test.deterministicResult(exactThreeDaysText, {
    referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(exactThreeDays.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
    ["installment_payment", 1000, null], ["partial_payment", 400, "2026-08-25"],
  ], "3 dni nazaj od 28. 8. mora biti 25. 8., ne 24. 8.");
  assert.deepEqual([exactThreeDays.candidates[1].dateRelation.anchor, exactThreeDays.candidates[1].dateRelation.direction, exactThreeDays.candidates[1].dateRelation.amount, exactThreeDays.candidates[1].dateRelation.unit], ["reference_date", -1, 3, "day"]);
  assert.equal(exactThreeDays.coverage.complete, true);

  var adjacentDateCountText = "placal je 2000 4 dni nazaj...vceraj pa še 1000 danes pa 400";
  var adjacentDateCountContext = { referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446 };
  var adjacentDateCountContract = parser._test.buildFactContract(adjacentDateCountText);
  var adjacentDateCount = parser._test.deterministicResult(adjacentDateCountText, adjacentDateCountContext);
  var adjacentMoneyFacts = adjacentDateCountContract.facts.filter(function (fact) { return fact.kind === "money"; });
  var adjacentRelationFacts = adjacentDateCountContract.facts.filter(function (fact) { return fact.kind === "date_relation"; });
  assert.deepEqual(adjacentDateCountContract.clauses.map(function (clause) { return clause.text; }), [
    "plačal je 2000 4 dni nazaj", "včeraj pa še 1000", "danes pa 400",
  ], "accentless imenovani dnevi in tri pike morajo ohraniti tri plačilne klavzule");
  assert.deepEqual(adjacentMoneyFacts.map(function (fact) { return [fact.value, fact.sourceSpan.text, fact.clauseId]; }), [
    [2000, "2000", "clause-1"], [1000, "1000", "clause-2"], [400, "400", "clause-3"],
  ], "znesek pred časovnim številom mora ostati samostojen money dokaz");
  assert.equal(adjacentRelationFacts.length, 1);
  assert.deepEqual([
    adjacentRelationFacts[0].relation.amount,
    adjacentRelationFacts[0].relation.unit,
    adjacentRelationFacts[0].relation.countSpan.text,
    adjacentRelationFacts[0].relation.sourceSpan.text,
  ], [4, "day", "4", "4 dni nazaj"], "časovni dokaz ne sme pogoltniti sosednjega zneska");
  assert.ok(adjacentMoneyFacts[0].sourceSpan.end <= adjacentRelationFacts[0].relation.sourceSpan.start, "money in časovni span se ne smeta prekrivati");
  assert.deepEqual(adjacentDateCount.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
    ["partial_payment", 2000, "2026-08-24"],
    ["partial_payment", 1000, "2026-08-27"],
    ["partial_payment", 400, "2026-08-28"],
  ]);
  assert.deepEqual(adjacentDateCount.ledger.map(function (entry) { return entry.afterEur; }), [7446, 6446, 6046]);
  assert.equal(adjacentDateCount.coverage.complete, true);
  assert.deepEqual(["event_clause", "money", "date_relation"].map(function (kind) {
    return adjacentDateCount.coverage.consumed.filter(function (entry) { return entry.kind === kind; }).length;
  }), [3, 3, 1], "vsak dogodek, znesek in časovni dokaz mora biti porabljen natanko enkrat");
  assert.equal(adjacentDateCount.coverage.unconsumed.length, 0);
  assert.equal(adjacentDateCount.coverage.duplicates.length, 0);
  assert.equal(adjacentDateCount.coverage.unsupportedCandidates.length, 0);

  var adjacentLocalCalls = 0;
  var adjacentLocal = await parser.analyze(adjacentDateCountText, adjacentDateCountContext, {
    apiKey: "", fetchImpl: async function () { adjacentLocalCalls += 1; throw new Error("popoln lokalni contract ne sme klicati modela brez konfiguracije"); },
  });
  assert.equal(adjacentLocalCalls, 0);
  assert.equal(adjacentLocal.semanticPlan.source, "clarification");
  assert.equal(adjacentLocal.coverage.complete, true);
  assert.deepEqual(adjacentLocal.candidates, [], "brez Lune tudi popoln lokalni plan ne sme prikazati kartic");
  assert.equal(adjacentLocal.semanticPlan.status, "NOT_ATTEMPTED");

  [
    "plačal je 2000 4 dni nazaj, včeraj pa še 1000, danes pa 400",
    "plačal je 2000 4 dni nazaj; včeraj pa še 1000; danes pa 400",
    "plačal je 2000 4 dni nazaj...včeraj pa še 1000 danes pa 400",
  ].forEach(function (input) {
    var plan = parser._test.deterministicResult(input, adjacentDateCountContext);
    assert.deepEqual(plan.candidates.map(function (candidate) { return [candidate.amount, candidate.occurredDate]; }), [
      [2000, "2026-08-24"], [1000, "2026-08-27"], [400, "2026-08-28"],
    ], "ločila in vezniki morajo ohraniti tri datirana plačila: " + input);
    assert.equal(plan.coverage.complete, true);
  });

  var fourteenDaysContract = parser._test.buildFactContract("plačal je 2000 14 dni nazaj");
  var fourteenDays = parser._test.deterministicResult("plačal je 2000 14 dni nazaj", adjacentDateCountContext);
  assert.deepEqual(fourteenDaysContract.facts.filter(function (fact) { return fact.kind === "money"; }).map(function (fact) { return fact.value; }), [2000]);
  assert.deepEqual(fourteenDaysContract.facts.filter(function (fact) { return fact.kind === "date_relation"; }).map(function (fact) {
    return [fact.relation.amount, fact.relation.countSpan.text, fact.relation.sourceSpan.text];
  }), [[14, "14", "14 dni nazaj"]], "2000 in 14 ne smeta postati 2014 dni");
  assert.deepEqual(fourteenDays.candidates.map(function (candidate) { return [candidate.amount, candidate.occurredDate]; }), [[2000, "2026-08-14"]]);
  assert.equal(fourteenDays.coverage.complete, true);

  var declinedWordDate = parser._test.deterministicResult("plačal je štirih dneh nazaj 2000, včeraj pa še 1000, danes pa 400", adjacentDateCountContext);
  assert.deepEqual(declinedWordDate.candidates.map(function (candidate) { return [candidate.amount, candidate.occurredDate]; }), [
    [2000, "2026-08-24"], [1000, "2026-08-27"], [400, "2026-08-28"],
  ], "sklanjana besedna časovna količina mora ostati podprta");
  assert.equal(declinedWordDate.coverage.complete, true);
  assert.equal(parser._test.parseSlovenianNumber("2 tisoč 500"), 2500, "mešani number-engine zapis ne sme regresirati");

  var chainedReferenceText = "4 dni nazaj je plačal 2000 2 dni nazaj 200.. danes pa še 1000";
  var chainedReferenceContract = parser._test.buildFactContract(chainedReferenceText);
  var chainedReference = parser._test.deterministicResult(chainedReferenceText, adjacentDateCountContext);
  assert.deepEqual(chainedReferenceContract.clauses.map(function (clause) { return clause.text; }), [
    "4 dni nazaj je plačal 2000", "2 dni nazaj 200", "danes pa še 1000",
  ], "vsaka nova reference-relative časovna zveza med zneskoma mora začeti nov dogodek");
  assert.deepEqual(chainedReferenceContract.facts.filter(function (fact) { return fact.kind === "money"; }).map(function (fact) {
    return [fact.value, fact.sourceSpan.text, fact.clauseId];
  }), [[2000, "2000", "clause-1"], [200, "200", "clause-2"], [1000, "1000", "clause-3"]]);
  assert.deepEqual(chainedReferenceContract.facts.filter(function (fact) { return fact.kind === "date_relation"; }).map(function (fact) {
    return [fact.relation.amount, fact.relation.unit, fact.relation.sourceSpan.text, fact.clauseId];
  }), [[4, "day", "4 dni nazaj", "clause-1"], [2, "day", "2 dni nazaj", "clause-2"]]);
  assert.deepEqual(chainedReference.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
    ["partial_payment", 2000, "2026-08-24"],
    ["partial_payment", 200, "2026-08-26"],
    ["partial_payment", 1000, "2026-08-28"],
  ]);
  assert.deepEqual(chainedReference.ledger.map(function (entry) { return entry.afterEur; }), [7446, 7246, 6246]);
  assert.equal(chainedReference.coverage.complete, true);
  assert.deepEqual(["event_clause", "money", "date_relation"].map(function (kind) {
    return chainedReference.coverage.consumed.filter(function (entry) { return entry.kind === kind; }).length;
  }), [3, 3, 2]);
  assert.equal(chainedReference.coverage.unconsumed.length, 0);
  assert.equal(chainedReference.coverage.duplicates.length, 0);
  assert.equal(chainedReference.coverage.unsupportedCandidates.length, 0);
  assert.equal(chainedReference.questionPlan.length, 3);

  var chainedReferenceCalls = 0;
  var chainedReferenceLocal = await parser.analyze(chainedReferenceText, adjacentDateCountContext, {
    apiKey: "", fetchImpl: async function () { chainedReferenceCalls += 1; throw new Error("popolna lokalna časovna veriga ne sme klicati modela brez konfiguracije"); },
  });
  assert.equal(chainedReferenceCalls, 0);
  assert.equal(chainedReferenceLocal.semanticPlan.source, "clarification");
  assert.equal(chainedReferenceLocal.coverage.complete, true);
  assert.deepEqual(chainedReferenceLocal.candidates, []);

  [
    "4 dni nazaj je plačal 2000, 2 dni nazaj je plačal 200, danes pa 1000",
    "4 dni nazaj je poravnal 2000; 2 dni nazaj 200; danes še 1000",
    "4 dni nazaj je plačal 2000 2 dni nazaj pa še 200 danes 1000",
  ].forEach(function (input) {
    var plan = parser._test.deterministicResult(input, adjacentDateCountContext);
    assert.deepEqual(plan.candidates.map(function (candidate) { return [candidate.amount, candidate.occurredDate]; }), [
      [2000, "2026-08-24"], [200, "2026-08-26"], [1000, "2026-08-28"],
    ], "časovno označeni nadaljevalni zneski morajo ostati ločeni: " + input);
    assert.equal(plan.coverage.complete, true);
  });
  var sameEventDate = parser._test.deterministicResult("plačal je 2000 2 dni nazaj", adjacentDateCountContext);
  assert.deepEqual(sameEventDate.candidates.map(function (candidate) { return [candidate.amount, candidate.occurredDate]; }), [[2000, "2026-08-26"]], "časovna zveza brez naslednjega zneska mora ostati pri istem dogodku");

  var joinedDayText = "plačal je 2000 6dni nazaj 3 dni nazaj je plačal 200 potem pa danes še 1000";
  var joinedDayContract = parser._test.buildFactContract(joinedDayText);
  var joinedDayResult = parser._test.deterministicResult(joinedDayText, adjacentDateCountContext);
  assert.deepEqual(joinedDayContract.clauses.map(function (clause) { return clause.text; }), [
    "plačal je 2000 6dni nazaj", "3 dni nazaj je plačal 200", "danes še 1000",
  ], "zlepljena časovna enota mora ostati v klavzuli pripadajočega plačila");
  assert.deepEqual(joinedDayContract.facts.filter(function (fact) { return fact.kind === "date_relation"; }).map(function (fact) {
    return [fact.relation.amount, fact.relation.unit, fact.relation.countSpan.text, fact.relation.sourceSpan.text, fact.clauseId];
  }), [
    [6, "day", "6", "6dni nazaj", "clause-1"],
    [3, "day", "3", "3 dni nazaj", "clause-2"],
  ], "6dni mora postati preverljivo časovno dejstvo, ne manjkajoči datum");
  assert.deepEqual(joinedDayResult.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
    ["partial_payment", 2000, "2026-08-22"],
    ["partial_payment", 200, "2026-08-25"],
    ["partial_payment", 1000, "2026-08-28"],
  ]);
  assert.deepEqual(joinedDayResult.ledger.map(function (entry) { return entry.afterEur; }), [7446, 7246, 6246]);
  assert.equal(joinedDayResult.coverage.complete, true);
  assert.equal(joinedDayResult.candidates.some(function (candidate) { return candidate.missing.includes("occurredDate"); }), false);

  [
    ["plačal je 500 1dan nazaj", "2026-08-27"],
    ["plačal je 500 2dneva nazaj", "2026-08-26"],
    ["plačal je 500 3dni nazaj", "2026-08-25"],
    ["plačal je 500 4dneh nazaj", "2026-08-24"],
    ["plačal je 500 2tedna nazaj", "2026-08-14"],
    ["plačal je 500 1mesec nazaj", "2026-07-28"],
    ["plačal je 500 1leto nazaj", "2025-08-28"],
  ].forEach(function (primer) {
    var rezultat = parser._test.deterministicResult(primer[0], adjacentDateCountContext);
    assert.deepEqual(rezultat.candidates.map(function (candidate) { return [candidate.amount, candidate.occurredDate]; }), [[500, primer[1]]], "zlepljena časovna enota mora delovati splošno: " + primer[0]);
    assert.equal(rezultat.coverage.complete, true);
  });
  var joinedWithoutDirection = parser._test.deterministicResult("plačal je 500 6dni", adjacentDateCountContext);
  assert.deepEqual(joinedWithoutDirection.candidates.map(function (candidate) { return candidate.occurredDate; }), [null], "sama zlepljena enota brez časovne smeri ne sme izmišljati datuma");

  var joinedDayLunaCalls = 0;
  var joinedDayLuna = await parser.analyze(joinedDayText, adjacentDateCountContext, {
    apiKey: "mock-luna",
    fetchImpl: async function (_url, options) {
      joinedDayLunaCalls += 1;
      var request = JSON.parse(options.body);
      assert.equal(request.model, "gpt-5.6-luna");
      var modelInput = JSON.parse(request.input);
      assert.equal(Object.prototype.hasOwnProperty.call(modelInput, "clauses"), false);
      assert.equal(modelInput.sourceText, joinedDayText);
      return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } };
    },
  });
  assert.equal(joinedDayLunaCalls, 1, "sestavljeni vnos mora uporabiti mock Luno kot semantičnega predlagatelja");
  assert.equal(joinedDayLuna.semanticPlan.source, "validated_semantic_plan");
  assert.deepEqual(joinedDayLuna.candidates.map(function (candidate) { return [candidate.amount, candidate.occurredDate]; }), [
    [2000, "2026-08-22"], [200, "2026-08-25"], [1000, "2026-08-28"],
  ], "deterministične časovne relacije morajo popraviti napačen Lunin datum");
  assert.equal(joinedDayLuna.coverage.complete, true);
  assert.ok(joinedDayLuna.diagnostics.some(function (entry) { return entry === "deterministic_date_relation_applied:0"; }));
  assert.ok(joinedDayLuna.diagnostics.some(function (entry) { return entry === "deterministic_date_relation_applied:1"; }));

  var ellipticalText = "dolžnik je plačal 1 obrok za 4000 nato pa čez mesec dni obrok za 200 nato pa čez 2 tedna za 6000";
  var ellipticalContract = parser._test.buildFactContract(ellipticalText);
  var ellipticalResult = parser._test.deterministicResult(ellipticalText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.equal(ellipticalContract.clauses.length, 3, "vsak koordinirani izvedeni obrok mora dobiti svojo klavzulo");
  assert.deepEqual(ellipticalContract.clauses.map(function (clause) { return clause.eventTypes; }), [
    ["installment_payment"], ["installment_payment"], ["installment_payment"],
  ]);
  assert.deepEqual(ellipticalContract.facts.filter(function (fact) { return fact.kind === "money"; }).map(function (fact) { return fact.value; }), [4000, 200, 6000], "count in časovni števec ne smeta postati denar");
  assert.deepEqual(ellipticalContract.facts.filter(function (fact) { return fact.kind === "date_relation"; }).map(function (fact) {
    return [fact.relation.direction, fact.relation.amount, fact.relation.unit];
  }), [[1, 1, "month"], [1, 2, "week"]]);
  assert.deepEqual(ellipticalResult.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 4000], ["installment_payment", 200], ["installment_payment", 6000],
  ]);
  assert.match(ellipticalResult.candidates[2].evidence.sourceSpan.text, /6000/, "tretji znesek mora ohraniti neposredni dokaz");
  assert.equal(ellipticalResult.candidates[2].evidence.explicitAmountEur, 6000, "UI mora razlikovati dokazani presežek od ročno ali modelsko izmišljenega");
  assert.deepEqual(ellipticalResult.candidates.slice(1).map(function (candidate) {
    return [candidate.dateRelation.anchorCandidateId, candidate.dateRelation.amount, candidate.dateRelation.unit];
  }), [[ellipticalResult.candidates[0].candidateId, 1, "month"], [ellipticalResult.candidates[1].candidateId, 2, "week"]]);
  assert.deepEqual(ellipticalResult.ledger.map(function (entry) { return entry.afterEur; }), [5446, 5246, 0]);
  assert.equal(ellipticalResult.projectedRemainingDebtEur, 0);
  assert.equal(ellipticalResult.questionPlan.length, 3);
  assert.ok(ellipticalResult.requiredFields.every(function (entry) { return entry.fields.includes("amount") && entry.fields.includes("occurredDate") && entry.fields.includes("paymentMethod"); }));
  assert.ok(ellipticalResult.diagnostics.includes("explicit_amount_exceeds_balance_clamped:2"));

  var staleEllipticalModel = parser.normalizeResult({ summary: "izgubljen tretji obrok", events: [
    { type: "installment_payment", amount: 4000, occurredDate: "2026-08-04" },
    { type: "installment_payment", amount: 200, occurredDate: "2026-08-05" },
  ] }, 9446, { text: ellipticalText, referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.deepEqual(staleEllipticalModel.candidates.map(function (candidate) { return candidate.amount; }), [4000, 200, 6000], "deterministična sekvenca mora obnoviti modelsko izpuščeni tretji dogodek");
  assert.equal(staleEllipticalModel.candidates[1].occurredDate, null);
  assert.equal(staleEllipticalModel.candidates[2].dateRelation.unit, "week");
  var ellipticalProviderCalls = 0;
  var ellipticalFastPath = await parser.analyze(ellipticalText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  }, { apiKey: "test-only", fetchImpl: async function () { ellipticalProviderCalls += 1; return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } }; } });
  assert.equal(ellipticalProviderCalls, 1);
  assert.deepEqual(ellipticalFastPath.candidates.map(function (candidate) { return candidate.amount; }), [4000, 200, 6000]);

  var screenshotSentence = parser._test.deterministicResult("dolznik je plačal prvi obrok 100 nato je plačal čez 2 tedna 300 nato pa čez mesec dni še 5000", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(screenshotSentence.candidates.map(function (candidate) { return candidate.amount; }), [100, 300, 5000], "uporabnikov posnetek mora ustvariti tri plačilne korake");
  assert.deepEqual(screenshotSentence.candidates.slice(1).map(function (candidate) { return [candidate.dateRelation.amount, candidate.dateRelation.unit]; }), [[2, "week"], [1, "month"]]);

  var referenceChainText = "dolznik je plačal 100 evrov mesec dni nazaj 3 tedna kasneje je placal 400evrov in nato čez teden dni pa 100";
  var referenceChainContext = { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 };
  var referenceChainContract = parser._test.buildFactContract(referenceChainText);
  var referenceChain = parser._test.deterministicResult(referenceChainText, referenceChainContext);
  assert.equal(referenceChainContract.clauses.length, 3, "vsako od treh izvedenih plačil mora imeti svojo aktivno klavzulo");
  assert.deepEqual(referenceChainContract.facts.filter(function (fact) { return fact.kind === "money"; }).map(function (fact) {
    return [fact.value, fact.clauseId];
  }), [[100, "clause-1"], [400, "clause-2"], [100, "clause-3"]], "glued valuta in zadnja elipsa morata ostati ločena money dokaza");
  assert.deepEqual(referenceChainContract.facts.filter(function (fact) { return fact.kind === "date_relation"; }).map(function (fact) {
    return [fact.relation.anchor, fact.relation.direction, fact.relation.amount, fact.relation.unit, fact.clauseId];
  }), [
    ["reference_date", -1, 1, "month", "clause-1"],
    ["previous_event", 1, 3, "week", "clause-2"],
    ["previous_event", 1, 1, "week", "clause-3"],
  ], "časovne zveze se morajo vezati na pravi dogodek in sidro");
  assert.deepEqual(referenceChain.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["partial_payment", 100], ["partial_payment", 400], ["partial_payment", 100],
  ], "exact uporabnikov vnos mora ustvariti tri plačilne korake");
  assert.deepEqual(referenceChain.ledger.map(function (entry) { return entry.afterEur; }), [9346, 8946, 8846]);
  assert.equal(referenceChain.coverage.complete, true);
  assert.deepEqual(["event_clause", "money", "date_relation"].map(function (kind) {
    return referenceChain.coverage.consumed.filter(function (entry) { return entry.kind === kind; }).length;
  }), [3, 3, 3], "coverage mora natanko enkrat porabiti tri klavzule, tri zneske in tri časovne zveze");
  assert.equal(referenceChain.coverage.unconsumed.length, 0);
  assert.equal(referenceChain.coverage.duplicates.length, 0);
  assert.equal(referenceChain.coverage.unsupportedCandidates.length, 0);
  assert.equal(referenceChain.candidates[0].occurredDate, "2026-07-27", "reference-relative datum se sme deterministično izračunati");
  relativeDates.razresiDatume(referenceChain.candidates);
  assert.deepEqual(referenceChain.candidates.map(function (candidate) { return candidate.occurredDate; }), ["2026-07-27", "2026-08-17", "2026-08-24"]);
  assert.equal(referenceChain.questionPlan.length, 3);
  assert.ok(referenceChain.requiredFields.every(function (entry) { return entry.fields.includes("amount") && entry.fields.includes("occurredDate") && entry.fields.includes("paymentMethod"); }));
  assert.equal(parser._test.shouldRequestSemanticPlan(referenceChainText, referenceChainContract, referenceChain), true);
  var referencePlannerCalls = 0;
  var referencePlannerFallback = await parser.analyze(referenceChainText, referenceChainContext, {
    apiKey: "mock-luna",
    fetchImpl: async function () { referencePlannerCalls += 1; throw new Error("mock semantic planner unavailable"); },
  });
  assert.equal(referencePlannerCalls, 1, "sestavljeni exact vnos mora zahtevati Luna semantic plan");
  assert.deepEqual(referencePlannerFallback.candidates, [], "brez Lunine rešitve se tudi 100-% pokrit lokalni plan ne sme prikazati");
  assert.equal(referencePlannerFallback.coverage.complete, true);

  var staleReferencePlan = parser.normalizeResult({ summary: "model je izpustil zadnjo elipso", events: [
    { type: "partial_payment", amount: 100, occurredDate: "2026-08-01", dateRelation: { anchor: "previous_event", field: "occurredDate", direction: 1, amount: 1, unit: "day" } },
    { type: "partial_payment", amount: 400, occurredDate: null },
  ] }, 9446, Object.assign({ text: referenceChainText, factContract: referenceChainContract }, referenceChainContext));
  assert.deepEqual(staleReferencePlan.candidates.map(function (candidate) { return candidate.amount; }), [100, 400, 100], "deterministični validator mora obnoviti modelsko izpuščeni tretji dogodek");
  assert.deepEqual(staleReferencePlan.candidates.map(function (candidate) { return candidate.dateRelation && candidate.dateRelation.anchor; }), ["reference_date", "previous_event", "previous_event"]);
  assert.equal(staleReferencePlan.coverage.complete, true);

  var mixedInstallmentsText = "plačal je najprej 2 obroka po 300 evrov nato pa še en obrok 1000 evrov in potem nič več";
  var mixedInstallments = parser._test.deterministicResult(mixedInstallmentsText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  });
  assert.deepEqual(mixedInstallments.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 300], ["installment_payment", 300], ["installment_payment", 1000], ["remaining_unpaid", 7846],
  ]);
  assert.deepEqual(mixedInstallments.ledger.map(function (entry) { return entry.afterEur; }), [9146, 8846, 7846, 7846]);
  assert.equal(mixedInstallments.projectedRemainingDebtEur, 7846);
  assert.equal(mixedInstallments.questionPlan.length, 3, "vprašanja so potrebna samo za tri izvedena plačila");
  var mixedProviderCalls = 0;
  var mixedFastPath = await parser.analyze(mixedInstallmentsText, {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  }, { apiKey: "test-only", fetchImpl: async function () { mixedProviderCalls += 1; return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } }; } });
  assert.equal(mixedProviderCalls, 1);
  assert.deepEqual(mixedFastPath.candidates.map(function (candidate) { return candidate.amount; }), [300, 300, 1000, 7846]);

  var unfulfilledInstallmentsText = "plačal je 3 obroke po 1000 v 3h mesecih sedaj je pa obljubil da bo plačal ostalo ampak ni nič naredil";
  var unfulfilledInstallmentsContext = { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 };
  var unfulfilledInstallmentsContract = parser._test.buildFactContract(unfulfilledInstallmentsText);
  var unfulfilledInstallments = parser._test.deterministicResult(unfulfilledInstallmentsText, unfulfilledInstallmentsContext);
  assert.deepEqual(unfulfilledInstallmentsContract.clauses.map(function (clause) { return clause.eventTypes; }), [
    ["installment_payment"], ["payment_promise"], ["remaining_unpaid"],
  ], "izvedeni obroki, obljuba in njena neizpolnitev morajo biti tri ločene semantične klavzule");
  assert.deepEqual(unfulfilledInstallmentsContract.facts.filter(function (fact) {
    return fact.kind === "category" && fact.assertion === "positive";
  }).map(function (fact) { return fact.eventType; }), ["installment_payment", "payment_promise", "payment_promise", "remaining_unpaid"]);
  assert.deepEqual(unfulfilledInstallmentsContract.facts.filter(function (fact) { return fact.kind === "money"; }).map(function (fact) { return fact.value; }), [1000], "časovna in ničelna števila ne smejo postati denar");
  assert.deepEqual(unfulfilledInstallments.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 1000], ["installment_payment", 1000], ["installment_payment", 1000],
    ["payment_promise", 6446], ["remaining_unpaid", 6446],
  ]);
  assert.deepEqual(unfulfilledInstallments.ledger.map(function (entry) { return entry.afterEur; }), [8446, 7446, 6446, 6446, 6446]);
  assert.equal(unfulfilledInstallments.projectedRemainingDebtEur, 6446);
  assert.equal(unfulfilledInstallments.coverage.complete, true);
  assert.equal(unfulfilledInstallments.coverage.unconsumed.length, 0);
  assert.equal(unfulfilledInstallments.questionPlan.length, 4);
  assert.equal(parser._test.shouldRequestSemanticPlan(unfulfilledInstallmentsText, unfulfilledInstallmentsContract, unfulfilledInstallments), true);
  assert.equal(unfulfilledInstallmentsContract.installmentGroups.length, 1);
  assert.deepEqual(unfulfilledInstallmentsContract.installmentGroups.map(function (group) {
    return [group.count, group.amount, group.completed];
  }), [[3, 1000, true]]);
  assert.equal(unfulfilledInstallmentsContract.installmentCadences.length, 1);
  assert.equal(unfulfilledInstallmentsContract.installmentCadences[0].sourceSpan.text, "v 3h mesecih");
  assert.deepEqual(unfulfilledInstallments.candidates.slice(0, 3).map(function (candidate) {
    var relation = candidate.dateRelation;
    return relation ? [relation.anchor, relation.amount, relation.unit, relation.anchorCandidateId] : null;
  }), [null, ["previous_event", 1, "month", unfulfilledInstallments.candidates[0].candidateId], ["previous_event", 1, "month", unfulfilledInstallments.candidates[1].candidateId]]);
  var unfulfilledCadenceCoverage = unfulfilledInstallments.coverage.consumed.filter(function (entry) { return entry.kind === "installment_cadence"; });
  assert.equal(unfulfilledCadenceCoverage.length, 1, "cadence source span mora biti porabljen natanko enkrat");
  assert.deepEqual(unfulfilledCadenceCoverage[0].candidateIndexes, [1, 2]);
  assert.equal(unfulfilledInstallments.coverage.duplicates.filter(function (entry) { return entry.kind === "installment_cadence"; }).length, 0);
  assert.ok(unfulfilledInstallments.requiredFields.every(function (entry) { return Array.isArray(entry.fields); }));

  var staleCadenceModel = parser.normalizeResult({ summary: "Zastarel cadence.", needsClarification: false, events: [
    { type: "installment_payment", amount: 1000, occurredDate: "2026-01-31" },
    { type: "installment_payment", amount: 1000, occurredDate: "2026-02-01", dateRelation: { anchor: "previous_event", field: "occurredDate", direction: 1, amount: 2, unit: "week" } },
    { type: "installment_payment", amount: 1000, occurredDate: null },
    { type: "payment_promise", amount: 6446 },
    { type: "remaining_unpaid", amount: 6446 },
  ] }, 9446, Object.assign({ text: unfulfilledInstallmentsText, factContract: unfulfilledInstallmentsContract }, unfulfilledInstallmentsContext));
  assert.deepEqual(staleCadenceModel.candidates.slice(0, 3).map(function (candidate) {
    return candidate.dateRelation ? [candidate.dateRelation.amount, candidate.dateRelation.unit] : null;
  }), [null, [1, "month"], [1, "month"]], "deterministični cadence mora preglasiti napačen ali manjkajoč modelski plan");
  assert.equal(staleCadenceModel.candidates[1].occurredDate, null, "napačen modelski absolutni datum mora izgubiti proti cadence relaciji");
  assert.equal(staleCadenceModel.coverage.complete, true);

  var exactStopText = "plačal je 2 obroka v 2h mesecih po 1000 potem pa nič več";
  var exactStopContract = parser._test.buildFactContract(exactStopText);
  var exactStop = parser._test.deterministicResult(exactStopText, unfulfilledInstallmentsContext);
  assert.deepEqual(exactStopContract.clauses.map(function (clause) { return clause.eventTypes; }), [["installment_payment"], ["remaining_unpaid"]]);
  assert.deepEqual(exactStopContract.installmentGroups.map(function (group) { return [group.count, group.amount, group.completed]; }), [[2, 1000, true]]);
  assert.deepEqual(exactStopContract.facts.filter(function (fact) { return fact.kind === "money"; }).map(function (fact) { return fact.value; }), [1000], "2h ne sme postati money fact");
  assert.deepEqual(exactStop.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 1000], ["installment_payment", 1000], ["remaining_unpaid", 7446],
  ]);
  assert.equal(exactStop.candidates.some(function (candidate) { return candidate.type === "unpaid_installment"; }), false, "zaključek ne sme postati izmišljeni 3. obrok");
  assert.deepEqual(exactStop.candidates.slice(0, 2).map(function (candidate) {
    return candidate.dateRelation ? [candidate.dateRelation.anchor, candidate.dateRelation.amount, candidate.dateRelation.unit] : null;
  }), [null, ["previous_event", 1, "month"]]);
  assert.deepEqual(exactStop.ledger.map(function (entry) { return entry.afterEur; }), [8446, 7446, 7446]);
  assert.equal(exactStop.projectedRemainingDebtEur, 7446);
  assert.equal(exactStop.coverage.complete, true);
  assert.equal(exactStop.coverage.consumed.filter(function (entry) { return entry.kind === "installment_cadence"; }).length, 1);
  assert.equal(exactStop.questionPlan.length, 2);

  var exactStopLocal = await parser.analyze(exactStopText, unfulfilledInstallmentsContext, { apiKey: false });
  assert.equal(exactStopLocal.semanticPlan.source, "clarification");
  assert.equal(exactStopLocal.semanticPlan.attempted, false);
  assert.deepEqual(exactStopLocal.candidates, []);

  [
    ["plačal je 2 obroka po 1000 v 2 dneh potem nič več", "day"],
    ["plačal je 2 obroka po 1000 v 2 tednih potem nič več", "week"],
    ["plačal je dva obroka po 1000 v dveh mesecih potem nič več", "month"],
    ["plačal je 2 obroka po 1000 v 2 letih potem nič več", "year"],
  ].forEach(function (entry) {
    var cadencePlan = parser._test.deterministicResult(entry[0], unfulfilledInstallmentsContext);
    assert.equal(cadencePlan.candidates[0].dateRelation, null, "prvi obrok mora ostati sidro: " + entry[0]);
    assert.deepEqual([cadencePlan.candidates[1].dateRelation.amount, cadencePlan.candidates[1].dateRelation.unit], [1, entry[1]], "enak count/duration mora dati ritem ene enote: " + entry[0]);
    assert.equal(cadencePlan.coverage.complete, true);
  });
  [
    ["plačal je 3 obroke po 1000 vsak dan potem nič več", "day"],
    ["plačal je 3 obroke po 1000 tedensko potem nič več", "week"],
    ["plačal je 3 obroke po 1000 vsak mesec potem nič več", "month"],
    ["plačal je 3 obroke po 1000 letno potem nič več", "year"],
  ].forEach(function (entry) {
    var recurringPlan = parser._test.deterministicResult(entry[0], unfulfilledInstallmentsContext);
    assert.deepEqual(recurringPlan.candidates.slice(1, 3).map(function (candidate) { return [candidate.dateRelation.amount, candidate.dateRelation.unit]; }), [[1, entry[1]], [1, entry[1]]]);
    assert.equal(recurringPlan.coverage.complete, true);
  });

  var cadenceConflictText = "plačal je 3 obroke po 1000 v 6 mesecih potem nič več";
  var cadenceConflictContract = parser._test.buildFactContract(cadenceConflictText);
  var cadenceConflict = parser._test.deterministicResult(cadenceConflictText, unfulfilledInstallmentsContext);
  assert.equal(cadenceConflictContract.installmentCadences[0].conflict, "installment_duration_count_mismatch");
  assert.ok(cadenceConflict.candidates.slice(0, 3).every(function (candidate) { return candidate.dateRelation == null; }), "fractionalnega ritma ni dovoljeno ugibati");
  assert.equal(cadenceConflict.coverage.complete, false);
  var cadenceConflictResponse = await parser.analyze(cadenceConflictText, unfulfilledInstallmentsContext, { apiKey: false });
  assert.equal(cadenceConflictResponse.needsClarification, true);
  assert.deepEqual(cadenceConflictResponse.candidates, []);

  [
    "obljubil je 2 obroka po 1000 v 2 mesecih",
    "ni plačal 2 obrokov po 1000 v 2 mesecih",
    "poskusil je plačati 2 obroka po 1000 v 2 mesecih vendar plačilo ni uspelo",
    "ugovarjal je računu 2 obroka po 1000 v 2 mesecih",
  ].forEach(function (input) {
    assert.equal(parser._test.buildFactContract(input).installmentCadences.length, 0, "neizvedeni dogodek ne sme podedovati cadence: " + input);
  });
  [
    "nič več ni dolžan", "ni rekel nič več", "nič več",
    "obljubil je 1000 potem nič več", "izdal je račun 1000 potem nič več", "ugovarjal je računu 1000 potem nič več",
    "ni plačal 2 obrokov po 1000 potem nič več",
  ].forEach(function (input) {
    var stopContract = parser._test.buildFactContract(input);
    assert.equal(stopContract.facts.some(function (fact) { return fact.kind === "category" && fact.eventType === "remaining_unpaid" && fact.assertion === "positive"; }), false, "brez jasnih predhodnih izvedenih plačil ne sme nastati remaining: " + input);
  });
  [
    "plačal je 2 obroka po 1000 nato ni plačal ničesar več",
    "plačal je 2 obroka po 1000 zatem nič več",
    "plačal je 3 obroke po 1000 potem nič več",
  ].forEach(function (input) {
    var clearStopPlan = parser._test.deterministicResult(input, unfulfilledInstallmentsContext);
    var paidGroupCount = /3 obroke/u.test(input) ? 3 : 2;
    assert.equal(clearStopPlan.candidates.filter(function (candidate) { return candidate.type === "installment_payment"; }).length, paidGroupCount);
    assert.equal(clearStopPlan.candidates.filter(function (candidate) { return candidate.type === "remaining_unpaid"; }).length, 1);
    assert.equal(clearStopPlan.candidates.some(function (candidate) { return candidate.type === "unpaid_installment"; }), false);
  });

  var unfulfilledPlannerCalls = 0;
  var unfulfilledPlannerFallback = await parser.analyze(unfulfilledInstallmentsText, unfulfilledInstallmentsContext, {
    apiKey: "mock-luna",
    fetchImpl: async function (_url, options) {
      unfulfilledPlannerCalls += 1;
      return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({
        plan: [
          { clauseId: "clause-1", eventType: "installment_payment", count: 3, inheritedFrom: null },
          { clauseId: "clause-2", eventType: "payment_promise", count: 1, inheritedFrom: null },
          { clauseId: "clause-3", eventType: "remaining_unpaid", count: 1, inheritedFrom: null },
        ],
      }) }; } };
    },
  });
  assert.equal(unfulfilledPlannerCalls, 1, "več FATHER dogodkov mora zahtevati Luna semantic plan");
  assert.equal(unfulfilledPlannerFallback.semanticPlan.source, "validated_semantic_plan");
  assert.equal(unfulfilledPlannerFallback.semanticPlan.reason, "luna_review_solution_applied");
  assert.deepEqual(unfulfilledPlannerFallback.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["installment_payment", 1000], ["installment_payment", 1000], ["installment_payment", 1000],
    ["payment_promise", 6446], ["remaining_unpaid", 6446],
  ]);
  assert.equal(unfulfilledPlannerFallback.coverage.complete, true);
  var explicitLocalCalls = 0;
  var previousOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-that-must-not-be-used";
  try {
    var explicitLocalFallback = await parser.analyze(unfulfilledInstallmentsText, unfulfilledInstallmentsContext, {
      apiKey: false,
      fetchImpl: async function () { explicitLocalCalls += 1; throw new Error("lokalni fallback ne sme poklicati ponudnika"); },
    });
    assert.equal(explicitLocalCalls, 0, "eksplicitni lokalni način mora preglasiti tudi podedovani modelski ključ");
    assert.equal(explicitLocalFallback.semanticPlan.source, "clarification");
    assert.equal(explicitLocalFallback.semanticPlan.attempted, false);
    assert.deepEqual(explicitLocalFallback.candidates, []);
  } finally {
    if (previousOpenAiKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  }

  [
    "plačal je 3 obroke po 1000 zdaj je obljubil da bo plačal ostalo vendar ni nič storil",
    "plačal je 3 obroke po 1000 trenutno pa je obljubil da bo poravnal preostalo toda obljube ni izpolnil",
  ].forEach(function (input) {
    var familyResult = parser._test.deterministicResult(input, unfulfilledInstallmentsContext);
    assert.deepEqual(familyResult.candidates.map(function (candidate) { return candidate.type; }), [
      "installment_payment", "installment_payment", "installment_payment", "payment_promise", "remaining_unpaid",
    ], "diskurzivni prehodi in neizpolnjena obljuba morajo ohraniti celoten plan: " + input);
    assert.deepEqual(familyResult.ledger.map(function (entry) { return entry.afterEur; }), [8446, 7446, 6446, 6446, 6446]);
    assert.equal(familyResult.coverage.complete, true);
  });
  [
    "ni nič naredil",
    "ni obljubil, da bo plačal, ampak ni nič naredil",
  ].forEach(function (input) {
    var negativeContract = parser._test.buildFactContract(input);
    assert.equal(negativeContract.facts.some(function (fact) {
      return fact.kind === "category" && fact.assertion === "positive" && ["payment_promise", "remaining_unpaid"].includes(fact.eventType);
    }), false, "brez pozitivne obljube se ne sme ustvariti obljuba ali neplačani preostanek: " + input);
  });
  var unrelatedFailure = parser._test.deterministicResult("plačal je 1000 evrov ampak ni nič naredil glede reklamacije", unfulfilledInstallmentsContext);
  assert.deepEqual(unrelatedFailure.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "invoice_dispute"], "neuspeh druge FATHER kategorije ne sme postati neizpolnjena obljuba");
  var crossFatherTransition = parser._test.deterministicResult("plačal je 1000 evrov sedaj je pa izdal dobropis 400 evrov", unfulfilledInstallmentsContext);
  assert.deepEqual(crossFatherTransition.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["partial_payment", 1000], ["credit_note", 400],
  ], "časovni diskurzivni prehod mora ločiti tudi neplačilno FATHER kategorijo");
  assert.equal(crossFatherTransition.coverage.complete, true);

  var semanticPlanText = "plačal je najprej 5000 evrov nato čez 2 tedna 100 evrov in potem pa še zadnji obrok 1000evrov mesec dni kasneje";
  var semanticPlanContext = { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 };
  var semanticPlanContract = parser._test.buildFactContract(semanticPlanText);
  var semanticPlanLocal = parser._test.deterministicResult(semanticPlanText, semanticPlanContext);
  assert.equal(parser.CONTRACT_VERSION, "history-fact-v73");
  assert.deepEqual(semanticPlanContract.facts.filter(function (fact) { return fact.kind === "money"; }).map(function (fact) { return fact.value; }), [5000, 100, 1000]);
  assert.deepEqual(semanticPlanLocal.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["partial_payment", 5000], ["partial_payment", 100], ["installment_payment", 1000],
  ]);
  assert.deepEqual(semanticPlanLocal.candidates.slice(1).map(function (candidate) {
    return [candidate.dateRelation.direction, candidate.dateRelation.amount, candidate.dateRelation.unit];
  }), [[1, 2, "week"], [1, 1, "month"]]);
  assert.deepEqual(semanticPlanLocal.ledger.map(function (entry) { return entry.afterEur; }), [4446, 4346, 3346]);
  assert.equal(semanticPlanLocal.coverage.complete, true);
  assert.equal(semanticPlanLocal.coverage.unconsumed.length, 0);
  assert.equal(semanticPlanLocal.coverage.duplicates.length, 0);
  assert.equal(parser._test.shouldRequestSemanticPlan(semanticPlanText, semanticPlanContract, semanticPlanLocal), true);

  function semanticEvent(type, amount, clauseId, inheritedFrom, dateRelation) {
    return {
      type: type, repeat: 1, amount: amount, currency: "EUR", occurredDate: null, promisedDate: null,
      paymentMethod: null, communicationChannel: null, documentReference: null, reason: null, description: null,
      confidence: "high", missing: [], evidenceClauseId: clauseId, inheritedFrom: inheritedFrom || null,
      dateRelation: dateRelation || null,
    };
  }
  var semanticCalls = 0;
  var validatedSemanticPlan = await parser.analyze(semanticPlanText, semanticPlanContext, {
    apiKey: "mock-luna",
    fetchImpl: async function (_url, options) {
      semanticCalls += 1;
      var request = JSON.parse(options.body);
      var facts = JSON.parse(request.input);
      assert.equal(Object.prototype.hasOwnProperty.call(facts, "clauses"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(facts, "facts"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(facts, "proposedPlan"), false, "Luna mora plan ustvariti sama");
      return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } };
    },
  });
  assert.equal(semanticCalls, 1, "sestavljeni vnos mora poklicati mock Luno natanko enkrat");
  assert.equal(validatedSemanticPlan.semanticPlan.source, "validated_semantic_plan");
  assert.equal(validatedSemanticPlan.semanticPlan.reason, "luna_review_ok");
  assert.equal(validatedSemanticPlan.coverage.complete, true);
  assert.deepEqual(validatedSemanticPlan.candidates.map(function (candidate) { return candidate.amount; }), [5000, 100, 1000]);

  var fixedSemanticPlan = await parser.analyze(semanticPlanText, semanticPlanContext, {
    apiKey: "mock-luna",
    fetchImpl: async function () { return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({
      plan: [
        { clauseId: "clause-1", eventType: "partial_payment", count: 1, inheritedFrom: null },
        { clauseId: "clause-2", eventType: "partial_payment", count: 1, inheritedFrom: null },
        { clauseId: "clause-3", eventType: "installment_payment", count: 1, inheritedFrom: null },
      ],
    }) }; } }; },
  });
  assert.equal(fixedSemanticPlan.semanticPlan.reason, "luna_review_solution_applied");
  assert.equal(fixedSemanticPlan.semanticPlan.source, "validated_semantic_plan");
  assert.equal(fixedSemanticPlan.coverage.complete, true, "Lunin celotni plan mora prestati coverage");
  assert.deepEqual(fixedSemanticPlan.candidates.map(function (candidate) { return candidate.amount; }), [5000, 100, 1000]);

  var neutralSemanticCases = [
    { text: "pred dvema tednoma mi je odštel 1000 evrov", type: "partial_payment", amount: 1000, date: "2026-08-13", balance: 8446 },
    { text: "včeraj mi je izročil jurja", type: "partial_payment", amount: null, date: "2026-08-26", balance: 9446 },
    { text: "pred tremi dnevi sem ga pisno dregnil za plačilo", type: "reminder_sent", amount: null, date: "2026-08-24", balance: 9446 },
    { text: "danes mi je zabrusil, da denarja ne bom videl", type: "debtor_statement", amount: null, date: "2026-08-27", balance: 9446 },
    { text: "pred tednom dni je odbil 400 evrov od računa", type: "credit_note", amount: 400, date: "2026-08-20", balance: 9046 },
    { text: "danes sva s terjatvami zaprla 500 evrov", type: "compensation", amount: 500, date: "2026-08-27", balance: 8946 },
  ];
  for (var neutralIndex = 0; neutralIndex < neutralSemanticCases.length; neutralIndex += 1) {
    var neutralCase = neutralSemanticCases[neutralIndex];
    var neutralContract = parser._test.buildFactContract(neutralCase.text);
    assert.equal(neutralContract.version, 26);
    assert.ok(neutralContract.clauses.length >= 1, "vsak neprazen vir mora dobiti nevtralni clause: " + neutralCase.text);
    assert.ok(neutralContract.clauses.some(function (clause) { return clause.semanticStatus === "neutral"; }), "neznana zveza ne sme izginiti: " + neutralCase.text);
    var neutralResult = await parser.analyze(neutralCase.text, {
      referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
    }, {
      apiKey: "mock-luna",
      fetchImpl: async function (_url, options) {
        var input = JSON.parse(JSON.parse(options.body).input);
        assert.equal(input.sourceText, neutralCase.text);
        assert.equal(Object.prototype.hasOwnProperty.call(input, "clauses"), false);
        return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({ plan: [
          { clauseId: neutralContract.clauses[0].id, eventType: neutralCase.type, count: 1, inheritedFrom: null },
        ] }) }; } };
      },
    });
    assert.equal(neutralResult.semanticPlan.status, "CORRECTED", neutralCase.text);
    assert.deepEqual(neutralResult.candidates.map(function (candidate) { return candidate.type; }), [neutralCase.type], neutralCase.text);
    assert.equal(neutralResult.candidates[0].amount, neutralCase.amount, neutralCase.text);
    assert.equal(neutralResult.candidates[0].occurredDate, neutralCase.date, neutralCase.text);
    assert.equal(neutralResult.ledger[0].afterEur, neutralCase.balance, neutralCase.text);
    assert.equal(neutralResult.coverage.complete, true, neutralCase.text);
  }

  var neutralSequenceText = "plačal je 3000 evrov. potem sem ga pisno dregnil. danes je plačal 1000 evrov";
  var neutralSequenceContract = parser._test.buildFactContract(neutralSequenceText);
  assert.deepEqual(neutralSequenceContract.clauses.map(function (clause) { return clause.semanticStatus; }), ["recognized", "neutral", "recognized"]);
  var neutralSequenceResult = await parser.analyze(neutralSequenceText, semanticPlanContext, {
    apiKey: "mock-luna",
    fetchImpl: async function () { return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({ plan: [
      { clauseId: "clause-1", eventType: "partial_payment", count: 1, inheritedFrom: null },
      { clauseId: "clause-2", eventType: "reminder_sent", count: 1, inheritedFrom: null },
      { clauseId: "clause-3", eventType: "partial_payment", count: 1, inheritedFrom: null },
    ] }) }; } }; },
  });
  assert.deepEqual(neutralSequenceResult.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "reminder_sent", "partial_payment"]);
  assert.deepEqual(neutralSequenceResult.ledger.map(function (entry) { return entry.afterEur; }), [6446, 6446, 5446]);
  assert.equal(neutralSequenceResult.coverage.complete, true);

  [
    { text: "ni plačal 1000 evrov", type: "partial_payment" },
    { text: "predlagal je pobot 500 evrov", type: "compensation" },
    { text: "ugovarja računu", type: "debtor_statement" },
  ].forEach(function (contradiction) {
    var contradictionContract = parser._test.buildFactContract(contradiction.text);
    var contradictionReview = parser._test.parsePlanReview(JSON.stringify({ plan: [
      { clauseId: contradictionContract.clauses[0].id, eventType: contradiction.type, count: 1, inheritedFrom: null },
    ] }), [], contradictionContract);
    assert.equal(contradictionReview.ok, false, "lokalno dokazano nasprotje mora ostati fail-closed: " + contradiction.text);
    assert.equal(contradictionReview.reason, "luna_review_semantic_contradiction", contradiction.text);
  });

  var invalidClauseReview = await parser.analyze(semanticPlanText, semanticPlanContext, {
    apiKey: "mock-luna",
    fetchImpl: async function () { return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({
      plan: [{ clauseId: "clause-999", eventType: "partial_payment", count: 1, inheritedFrom: null }],
    }) }; } }; },
  });
  assert.equal(invalidClauseReview.semanticPlan.reason, "luna_review_unknown_clause");
  assert.deepEqual(invalidClauseReview.candidates, [], "haluciniran clause ne sme postati dogodek");

  var invalidTypeReview = await parser.analyze(semanticPlanText, semanticPlanContext, {
    apiKey: "mock-luna",
    fetchImpl: async function () { return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({
      plan: [{ clauseId: "clause-1", eventType: "alien_event", count: 1, inheritedFrom: null }],
    }) }; } }; },
  });
  assert.equal(invalidTypeReview.semanticPlan.reason, "luna_review_unsupported_type");
  assert.deepEqual(invalidTypeReview.candidates, [], "tip zunaj stroge sheme ne sme postati dogodek");

  var legacyEventsReview = await parser.analyze(semanticPlanText, semanticPlanContext, {
    apiKey: "mock-luna",
    fetchImpl: async function () { return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({ events: [
      semanticEvent("partial_payment", 5000, "clause-1", null, null),
    ] }) }; } }; },
  });
  assert.equal(legacyEventsReview.semanticPlan.reason, "luna_review_legacy_response_rejected");
  assert.equal(legacyEventsReview.semanticPlan.status, "FAILED");
  assert.deepEqual(legacyEventsReview.candidates, [], "stari events/links odgovor ne sme več odpreti kartic");

  var partialCoverage = parser._test.assessCoverage(semanticPlanContract, { candidates: semanticPlanLocal.candidates.slice(0, 2) }, {
    installmentBreakdown: parser._test.inferInstallmentBreakdown(semanticPlanText),
  });
  assert.equal(partialCoverage.complete, false, "delni plan ne sme skozi coverage gate");
  assert.ok(partialCoverage.unconsumed.some(function (item) { return item.clauseId === "clause-3"; }));

  var adversarialPlan = parser.normalizeResult({ summary: "zastarel in podvojen plan", needsClarification: false, events: [
    semanticEvent("partial_payment", 9999, "clause-1", null, null),
    semanticEvent("partial_payment", 100, "clause-2", "clause-1", { anchor: "previous_event", field: "occurredDate", direction: 1, amount: 3, unit: "month" }),
    semanticEvent("partial_payment", 100, "clause-2", "clause-1", null),
    semanticEvent("insolvency", null, "clause-3", null, null),
  ] }, 9446, Object.assign({ text: semanticPlanText, factContract: semanticPlanContract }, semanticPlanContext));
  var adversarialCoverage = parser._test.assessCoverage(semanticPlanContract, adversarialPlan, {
    installmentBreakdown: parser._test.inferInstallmentBreakdown(semanticPlanText), requireClauseEvidence: true,
  });
  assert.deepEqual(adversarialPlan.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["partial_payment", 5000], ["partial_payment", 100], ["installment_payment", 1000],
  ], "deterministična avtoriteta mora popraviti spremenjen, podvojen in manjkajoč modelski plan");
  assert.deepEqual(adversarialPlan.candidates.slice(1).map(function (candidate) { return [candidate.dateRelation.amount, candidate.dateRelation.unit]; }), [[2, "week"], [1, "month"]]);
  assert.equal(adversarialCoverage.complete, true);
  assert.ok(adversarialPlan.diagnostics.some(function (item) { return /unsupported_amount|unsupported_father|explicit_payment_sequence_rebuilt/.test(item); }));

  [
    ["plačal je 100 evrov nato čez 2 dni 200EUR potem tri tedne pozneje 300 evrov in nato mesec dni kasneje še 400evrov", [100, 200, 300, 400]],
    ["plačal je 100 evrov nato čez 2 dni 200EUR potem čez 3 tedne 300 evrov in nato čez mesec dni še 400evrov nato pa čez eno leto 500 EUR", [100, 200, 300, 400, 500]],
    ["plačal je 500 evrov nato dva tedna prej 400 evrov potem en mesec pred tem 300 evrov", [500, 400, 300]],
  ].forEach(function (entry) {
    var matrixPlan = parser._test.deterministicResult(entry[0], { referenceDate: "2026-08-27", originalDebt: 10000, remainingDebt: 10000 });
    assert.deepEqual(matrixPlan.candidates.map(function (candidate) { return candidate.amount; }), entry[1], "3–5 dogodkov mora ostati popolnoma pokritih: " + entry[0]);
    assert.equal(matrixPlan.coverage.complete, true);
  });
  assert.deepEqual(parser._test.buildFactContract("čez 2 tedna ni plačal 6000").fatherCategories, [], "zanikanje ne sme podedovati izvedenega plačila");
  assert.equal(parser._test.deterministicResult("čez 2 tedna ni plačal 6000", semanticPlanContext), null);
  assert.equal(parser._test.buildFactContract("račun 6000").facts.some(function (fact) { return fact.kind === "money"; }), false, "številka računa ne sme postati money fact");
  assert.deepEqual(parser._test.deterministicResult("obljubil 6000", semanticPlanContext).candidates.map(function (candidate) { return candidate.type; }), ["payment_promise"]);

  function canonicalItem(overrides) {
    return Object.assign({
      evidenceText: "", eventType: "partial_payment", count: 1, inheritedFromEvidenceText: null,
      amountEur: null, amountEvidenceText: null, amountRelation: null,
      occurredDate: null, occurredDateEvidenceText: null, occurredDateRelation: null, occurredDatePrecision: null,
      promisedDate: null, promisedDateEvidenceText: null, promisedDateRelation: null, promisedDatePrecision: null,
      paymentMethod: null, paymentMethodEvidenceText: null,
      communicationChannel: null, communicationChannelEvidenceText: null,
      documentReference: null, documentReferenceEvidenceText: null,
      reason: null, reasonEvidenceText: null, description: null, descriptionEvidenceText: null,
    }, overrides || {});
  }
  function relativeDate(anchor, direction, amount, unit, dayOfMonth) {
    return { anchor: anchor, direction: direction, amount: amount, unit: unit, dayOfMonth: dayOfMonth == null ? null : dayOfMonth };
  }
  function canonicalWireItem(item, itemIndex) {
    var fields = [];
    var fieldNames = ["amountEur", "occurredDate", "promisedDate", "paymentMethod", "communicationChannel", "documentReference", "reason", "description"];
    var valueIds = { bank_transfer: 401, cash: 402, card: 403, direct_debit: 404, other: 405, unknown: 406, phone: 501, email: 502, sms: 503, in_person: 504, letter: 505 };
    var precisionIds = { exact: 601, month: 602, year: 603 };
    var anchorIds = { reference_date: 621, previous_event: 622 };
    var directionIds = { "-1": 631, "0": 632, "1": 633 };
    var unitIds = { day: 641, week: 642, month: 643, year: 644 };
    fieldNames.forEach(function (name, fieldIndex) {
      if (item[name] == null) return;
      fields.push({
        fieldId: fieldIndex + 1,
        numberValue: name === "amountEur" ? item[name] : null,
        textValue: name === "amountEur" || name === "paymentMethod" || name === "communicationChannel" ? null : item[name],
        valueId: name === "paymentMethod" || name === "communicationChannel" ? valueIds[item[name]] || null : null,
        evidenceText: item[name === "amountEur" ? "amountEvidenceText" : name + "EvidenceText"],
        datePrecisionId: name === "occurredDate" || name === "promisedDate" ? precisionIds[item[name + "Precision"] || (/^\d{4}-\d{2}-\d{2}$/.test(String(item[name] || "")) ? "exact" : item[name + "Relation"] && item[name + "Relation"].unit === "year" ? "year" : "month")] : null,
        dateStatusId: name === "occurredDate" || name === "promisedDate" ? (item[name + "Unknown"] ? 613 : item[name + "Approximate"] ? 612 : 611) : null,
        relationAnchorId: item[name + "Relation"] ? anchorIds[item[name + "Relation"].anchor] || null : null,
        relationDirectionId: item[name + "Relation"] && item[name + "Relation"].direction != null ? directionIds[String(item[name + "Relation"].direction)] : null,
        relationAmount: item[name + "Relation"] && item[name + "Relation"].amount != null ? item[name + "Relation"].amount : null,
        relationUnitId: item[name + "Relation"] ? unitIds[item[name + "Relation"].unit] || null : null,
        relationDayOfMonth: item[name + "Relation"] && item[name + "Relation"].dayOfMonth != null ? item[name + "Relation"].dayOfMonth : null,
        amountRelationId: name === "amountEur" && item.amountRelation === "total" ? 651 : name === "amountEur" && item.amountRelation === "each" ? 652 : null,
      });
    });
    return {
      cardNumber: itemIndex + 1, evidenceText: item.evidenceText, cardId: parser.ALLOWED_TYPES.indexOf(item.eventType) + 1, count: 1,
      inheritedFromEvidenceText: item.inheritedFromEvidenceText, fields: fields,
    };
  }
  async function canonicalAnalyze(text, plan, context) {
    var expandedPlan = [];
    plan.forEach(function (item) {
      for (var itemRepeat = 0; itemRepeat < Math.max(1, Number(item.count) || 1); itemRepeat += 1) expandedPlan.push(Object.assign({}, item, { count: 1 }));
    });
    return parser.analyze(text, context || { referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446 }, {
      apiKey: "mock-luna-canonical",
      fetchImpl: async function (_url, options) {
        var request = JSON.parse(options.body);
        var input = JSON.parse(request.input);
        assert.equal(Object.prototype.hasOwnProperty.call(input, "facts"), false);
        assert.equal(Object.prototype.hasOwnProperty.call(input, "clauses"), false);
        assert.equal(Object.prototype.hasOwnProperty.call(input, "proposedPlan"), false);
        assert.ok(Buffer.byteLength(options.body, "utf8") < 7500, "polni ID katalog mora ostati pod 7,5 KB");
        return { ok: true, status: 200, json: async function () { return {
          output_text: JSON.stringify({ plan: expandedPlan.map(canonicalWireItem), clarificationQuestion: null, clarificationEvidenceText: null }),
          usage: { input_tokens: 1200, output_tokens: 900, total_tokens: 2100 },
        }; } };
      },
    });
  }

  var typoText = "plačal je 1000 evrov 21ga prejšni mesec nato je 2 tedna nazaj plačal 2999.. danes 1000 in je rekel da ne bo več";
  var typoPlan = [
    canonicalItem({ evidenceText: "plačal je 1000 evrov 21ga prejšni mesec", amountEur: 1000, amountEvidenceText: "1000 evrov", occurredDate: "2026-07-21", occurredDateEvidenceText: "21ga prejšni mesec", occurredDateRelation: relativeDate("reference_date", -1, 1, "month", 21) }),
    canonicalItem({ evidenceText: "nato je 2 tedna nazaj plačal 2999", amountEur: 2999, amountEvidenceText: "2999", occurredDate: "2026-08-14", occurredDateEvidenceText: "2 tedna nazaj", occurredDateRelation: relativeDate("reference_date", -1, 2, "week") }),
    canonicalItem({ evidenceText: "danes 1000", amountEur: 1000, amountEvidenceText: "1000", occurredDate: "2026-08-28", occurredDateEvidenceText: "danes", occurredDateRelation: relativeDate("reference_date", 0, 0, "day") }),
    canonicalItem({ evidenceText: "je rekel da ne bo več", eventType: "debtor_statement", occurredDate: "2026-08-28", occurredDateEvidenceText: "je rekel da ne bo več", occurredDateRelation: relativeDate("reference_date", 0, 0, "day"), description: "je rekel da ne bo več", descriptionEvidenceText: "je rekel da ne bo več" }),
  ];
  var typoCanonical = await canonicalAnalyze(typoText, typoPlan);
  assert.equal(typoCanonical.semanticPlan.source, "validated_canonical_plan");
  assert.equal(typoCanonical.semanticPlan.reason, "luna_canonical_plan_applied");
  assert.deepEqual(typoCanonical.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
    ["partial_payment", 1000, "2026-07-21"], ["partial_payment", 2999, "2026-08-14"],
    ["partial_payment", 1000, "2026-08-28"], ["debtor_statement", null, "2026-08-28"],
  ]);
  assert.deepEqual(typoCanonical.questionPlan[0].missing, ["paymentMethod"], "prvi kartici z dokazanim datumom sme manjkati samo način plačila");
  assert.equal(typoCanonical.projectedRemainingDebtEur, 4447, "9446 - 1000 - 2999 - 1000 mora ostati aritmetično 4447");
  assert.deepEqual(typoCanonical.semanticPlan.usage, { inputTokens: 1200, outputTokens: 900, totalTokens: 2100 });
  assert.ok(typoCanonical.semanticPlan.requestBytes > 6500 && typoCanonical.semanticPlan.requestBytes < 6900);

  var compactWireText = "včeraj je plačal 300 evrov";
  var compactWire = await parser.analyze(compactWireText, {
    referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only",
    fetchImpl: async function () { return { ok: true, status: 200, json: async function () { return {
      output_text: JSON.stringify({
        p: [{ n: 1, c: 1, e: compactWireText, f: [
          { i: 1, v: 300, e: "300 evrov", r: [] },
          { i: 2, v: "2026-08-27", e: "včeraj", r: [601, 611, 621, 631, 1, 641, null] },
        ] }], q: null, x: null,
      }),
      usage: { input_tokens: 500, output_tokens: 100, total_tokens: 600 },
    }; } }; },
  });
  assert.equal(compactWire.semanticPlan.source, "luna_compact_contract");
  assert.deepEqual(compactWire.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
    ["partial_payment", 300, "2026-08-27"],
  ]);

  var monthOnlyCanonical = await canonicalAnalyze("prejšni mesec je plačal 500 evrov", [
    canonicalItem({
      evidenceText: "prejšni mesec je plačal 500 evrov", amountEur: 500, amountEvidenceText: "500 evrov",
      occurredDate: "prejšnji mesec", occurredDateEvidenceText: "prejšni mesec",
      occurredDateRelation: relativeDate("reference_date", -1, 1, "month"),
    }),
  ]);
  assert.deepEqual([
    monthOnlyCanonical.candidates[0].occurredDate,
    monthOnlyCanonical.candidates[0].occurredDateApproximate,
    monthOnlyCanonical.candidates[0].occurredDateApproximation,
  ], [null, true, "prejšnji mesec"], "splošen mesec mora ostati mesečna oznaka brez izmišljenega dneva");
  assert.deepEqual(monthOnlyCanonical.questionPlan[0].missing, ["paymentMethod"], "mesečna oznaka mora šteti kot izpolnjen datum");

  var incompleteMiddleCanonical = await canonicalAnalyze("plačal je 3 mesece nazaj 3000 prejšnji mesec in 2000 pa danes", [
    canonicalItem({
      evidenceText: "plačal je 3 mesece nazaj 3000", amountEur: 3000, amountEvidenceText: "3000",
      occurredDate: "pred 3 meseci", occurredDateEvidenceText: "3 mesece nazaj",
      occurredDateRelation: relativeDate("reference_date", -1, 3, "month"), occurredDatePrecision: "month",
    }),
    canonicalItem({
      evidenceText: "prejšnji mesec", occurredDate: "prejšnji mesec", occurredDateEvidenceText: "prejšnji mesec",
      occurredDateRelation: relativeDate("reference_date", -1, 1, "month"), occurredDatePrecision: "month",
    }),
    canonicalItem({
      evidenceText: "2000 pa danes", amountEur: 2000, amountEvidenceText: "2000",
      occurredDate: "2026-08-28", occurredDateEvidenceText: "danes",
      occurredDateRelation: relativeDate("reference_date", 0, 0, "day"), occurredDatePrecision: "exact",
    }),
  ]);
  assert.equal(incompleteMiddleCanonical.candidates.length, 3, "nepopolna srednja časovna točka mora ostati kartica");
  assert.deepEqual(incompleteMiddleCanonical.candidates.map(function (candidate) { return candidate.occurredDateApproximation || candidate.occurredDate; }), ["pred 3 meseci", "prejšnji mesec", "2026-08-28"]);
  assert.deepEqual(incompleteMiddleCanonical.questionPlan.map(function (question) { return question.missing; }), [["paymentMethod"], ["amount", "paymentMethod"], ["paymentMethod"]]);

  var risingInstallmentsText = "plačal je 4 obroke prvi obrok 100 potem vsak obrok 10 višje";
  var risingInstallments = await canonicalAnalyze(risingInstallmentsText, [100, 110, 120, 130].map(function (amount) { return canonicalItem({
    evidenceText: risingInstallmentsText, eventType: "installment_payment", amountEur: amount, amountEvidenceText: risingInstallmentsText,
  }); }));
  assert.deepEqual(risingInstallments.candidates.map(function (candidate) { return candidate.amount; }), [100, 110, 120, 130], "naraščajoči obroki se morajo iz prvega zneska in koraka razširiti po karticah");
  assert.equal(risingInstallments.projectedRemainingDebtEur, 8986, "ledger mora odšteti vsoto 460 samo enkrat");

  var weeklyGrowthText = "plačal je 300 evrov en mesec nazaj in nato vsak teden 10 evrov več do danes";
  var weeklyGrowthDates = ["2026-07-28", "2026-08-04", "2026-08-11", "2026-08-18", "2026-08-25"];
  var weeklyGrowth = await canonicalAnalyze(weeklyGrowthText, weeklyGrowthDates.map(function (date, index) { return canonicalItem({
    evidenceText: weeklyGrowthText,
    eventType: "partial_payment",
    amountEur: 300 + index * 10,
    amountEvidenceText: weeklyGrowthText,
    occurredDate: date,
    occurredDateEvidenceText: index === 0 ? "en mesec nazaj" : "vsak teden 10 evrov več do danes",
    occurredDatePrecision: "exact",
    occurredDateRelation: index === 0 ? relativeDate("reference_date", -1, 1, "month") : relativeDate("previous_event", 1, 1, "week"),
  }); }));
  assert.deepEqual(weeklyGrowth.candidates.map(function (candidate) { return [candidate.amount, candidate.occurredDate, candidate.occurredDateApproximate]; }), [
    [300, "2026-07-28", false], [310, "2026-08-04", false], [320, "2026-08-11", false], [330, "2026-08-18", false], [340, "2026-08-25", false],
  ], "začetek + tedenski interval + zneskovni korak + konec mora postati pet konkretnih kartic");
  assert.deepEqual(weeklyGrowth.questionPlan.map(function (question) { return question.missing; }), [["paymentMethod"], ["paymentMethod"], ["paymentMethod"], ["paymentMethod"], ["paymentMethod"]]);
  assert.equal(weeklyGrowth.projectedRemainingDebtEur, 7846, "ledger mora odšteti 300+310+320+330+340");

  var fallingInstallmentsText = "plačal je 3 obroke prvi je bil 400 nato vsak naslednji 50 manj";
  var fallingInstallments = await canonicalAnalyze(fallingInstallmentsText, [400, 350, 300].map(function (amount) { return canonicalItem({
    evidenceText: fallingInstallmentsText, eventType: "installment_payment", amountEur: amount, amountEvidenceText: fallingInstallmentsText,
  }); }));
  assert.deepEqual(fallingInstallments.candidates.map(function (candidate) { return candidate.amount; }), [400, 350, 300], "padajoči obroki morajo uporabiti podpisani korak");

  assert.deepEqual(risingInstallments.candidates.map(function (candidate) { return [candidate.cardNumber, candidate.cardTypeId, candidate.fieldIds]; }), [
    [1, 3, [1, 2, 4]], [2, 3, [1, 2, 4]], [3, 3, [1, 2, 4]], [4, 3, [1, 2, 4]],
  ], "vsaka Lunina kartica mora imeti svojo zaporedno identifikacijo, tip in polja");

  var simpleGroupText = "plačal je 2 meseca nazaj v dveh obrokih po 1000 prvi račun nato pa je veraj plačal še 1002 in to je to";
  var simpleGroupPlan = [
    canonicalItem({
      evidenceText: "plačal je 2 meseca nazaj v dveh obrokih po 1000 prvi račun", eventType: "installment_payment", count: 2,
      amountEur: 1000, amountEvidenceText: "1000", amountRelation: "each", occurredDate: "2026-06-28", occurredDateEvidenceText: "2 meseca nazaj",
      occurredDateRelation: relativeDate("reference_date", -1, 2, "month"),
    }),
    canonicalItem({
      evidenceText: "nato pa je veraj plačal še 1002", eventType: "partial_payment", amountEur: 1002, amountEvidenceText: "1002",
      occurredDate: "2026-08-27", occurredDateEvidenceText: "veraj", occurredDateRelation: relativeDate("reference_date", -1, 1, "day"),
    }),
  ];
  var simpleGroupCanonical = await canonicalAnalyze(simpleGroupText, simpleGroupPlan);
  assert.deepEqual(simpleGroupCanonical.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
    ["installment_payment", 1000, "2026-06-28"], ["installment_payment", 1000, "2026-06-28"], ["partial_payment", 1002, "2026-08-27"],
  ]);
  assert.equal(simpleGroupCanonical.projectedRemainingDebtEur, 6444);
  assert.equal(simpleGroupCanonical.semanticPlan.reason, "luna_canonical_plan_applied");
  assert.deepEqual(simpleGroupCanonical.candidates.map(function (candidate) { return [candidate.cardNumber, candidate.cardTypeId, candidate.fieldIds]; }), [
    [1, 3, [1, 2, 4]], [2, 3, [1, 2, 4]], [3, 1, [1, 2, 4]],
  ]);
  assert.deepEqual(simpleGroupCanonical.questionPlan.map(function (question) { return question.missing; }), [["paymentMethod"], ["paymentMethod"], ["paymentMethod"]]);
  assert.deepEqual(simpleGroupCanonical.questionPlan.map(function (question) { return [question.cardNumber, question.missingFieldIds]; }), [[1, [4]], [2, [4]], [3, [4]]]);

  var nullAmountField = await parser.analyze("ostalo ni plačal", {
    referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "mock-luna-null-field",
    fetchImpl: async function () {
      return { ok: true, status: 200, json: async function () { return {
        output_text: JSON.stringify({
          plan: [{
            cardNumber: 1, evidenceText: "ostalo ni plačal", cardId: 5, count: 1, inheritedFromEvidenceText: null,
            fields: [{
              fieldId: 1, numberValue: null, textValue: null, evidenceText: "ostalo",
              relationAnchor: null, relationDirection: null, relationAmount: null, relationUnit: null, relationDayOfMonth: null,
            }],
          }],
          clarificationQuestion: null, clarificationEvidenceText: null,
        }),
      }; } };
    },
  });
  assert.equal(nullAmountField.semanticPlan.reason, "luna_canonical_plan_applied");
  assert.equal(nullAmountField.candidates.length, 1);
  assert.equal(nullAmountField.candidates[0].type, "remaining_unpaid");
  assert.equal(nullAmountField.candidates[0].requiresHumanReview, true);

  var wordNumberCases = [
    ["plačal je dva obroka po tisoč evrov", 2, 1000],
    ["poravnal je tri obroke po petsto evrov", 3, 500],
    ["nakazal je štiri obroke po dvesto petdeset evrov", 4, 250],
  ];
  for (var wordNumberIndex = 0; wordNumberIndex < wordNumberCases.length; wordNumberIndex += 1) {
    var wordNumberCase = wordNumberCases[wordNumberIndex];
    var wordNumberResult = await canonicalAnalyze(wordNumberCase[0], [canonicalItem({
      evidenceText: wordNumberCase[0], eventType: "installment_payment",
      count: wordNumberCase[1], amountEur: wordNumberCase[2], amountEvidenceText: wordNumberCase[0], amountRelation: "each",
    })]);
    assert.equal(wordNumberResult.candidates.length, wordNumberCase[1]);
    assert.ok(wordNumberResult.candidates.every(function (candidate) { return candidate.amount === wordNumberCase[2]; }));
  }

  var splitGroupPlan = [
    Object.assign({}, simpleGroupPlan[0], { count: 1 }),
    Object.assign({}, simpleGroupPlan[0], { count: 1 }),
    simpleGroupPlan[1],
  ];
  var splitGroupCanonical = await canonicalAnalyze(simpleGroupText, splitGroupPlan);
  assert.deepEqual(splitGroupCanonical.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
    ["installment_payment", 1000, "2026-06-28"], ["installment_payment", 1000, "2026-06-28"], ["partial_payment", 1002, "2026-08-27"],
  ], "Luna sme dokazano skupino vrniti kot dve že razširjeni kartici");
  assert.equal(splitGroupCanonical.projectedRemainingDebtEur, 6444);
  assert.equal(splitGroupCanonical.semanticPlan.reason, "luna_canonical_plan_applied");

  var normalizedEventQuotePlan = simpleGroupPlan.map(function (item) { return Object.assign({}, item); });
  normalizedEventQuotePlan[0] = Object.assign({}, normalizedEventQuotePlan[0], {
    evidenceText: "v dveh obrokih po 1000 prvi račun",
    occurredDateEvidenceText: "pred dvema mesecema",
  });
  normalizedEventQuotePlan[1] = Object.assign({}, normalizedEventQuotePlan[1], {
    evidenceText: "nato pa je včeraj plačal še 1002",
    occurredDateEvidenceText: "včeraj",
  });
  var normalizedEventQuote = await canonicalAnalyze(simpleGroupText, normalizedEventQuotePlan);
  assert.deepEqual(normalizedEventQuote.candidates.map(function (candidate) { return candidate.amount; }), [1000, 1000, 1002],
    "popravljen tipkarski zapis v Luninem dogodkovnem citatu ne sme zavreči kartic, kadar so materialna polja exact");

  var yesterdayTypos = ["včeri", "učer", "včer"];
  for (var yesterdayTypoIndex = 0; yesterdayTypoIndex < yesterdayTypos.length; yesterdayTypoIndex += 1) {
    var yesterdayTypo = yesterdayTypos[yesterdayTypoIndex];
    var variantText = simpleGroupText.replace("veraj", yesterdayTypo);
    var variantPlan = simpleGroupPlan.map(function (item) { return Object.assign({}, item); });
    variantPlan[1] = Object.assign({}, variantPlan[1], { evidenceText: variantPlan[1].evidenceText.replace("veraj", yesterdayTypo), occurredDateEvidenceText: yesterdayTypo });
    var variantResult = await canonicalAnalyze(variantText, variantPlan);
    assert.deepEqual(variantResult.candidates.map(function (candidate) { return candidate.amount; }), [1000, 1000, 1002]);
  }

  var unknownCanonicalCases = [
    { text: "pred dvema tednoma mi je odštel jurja", amount: 1000, amountEvidence: "jurja", date: "2026-08-14", dateEvidence: "dvema tednoma", relation: relativeDate("reference_date", -1, 2, "week") },
    { text: "učeri je kapnu petstotak", amount: 500, amountEvidence: "petstotak", date: "2026-08-27", dateEvidence: "učeri", relation: relativeDate("reference_date", -1, 1, "day") },
    { text: "dans je prletu keš 700", amount: 700, amountEvidence: "700", date: "2026-08-28", dateEvidence: "dans", relation: relativeDate("reference_date", 0, 0, "day"), method: "cash", methodEvidence: "keš" },
  ];
  for (var canonicalCaseIndex = 0; canonicalCaseIndex < unknownCanonicalCases.length; canonicalCaseIndex += 1) {
    var canonicalCase = unknownCanonicalCases[canonicalCaseIndex];
    assert.deepEqual(parser._test.buildFactContract(canonicalCase.text).fatherCategories, [], "lokalni leksikon namerno ne sme poznati nove fraze: " + canonicalCase.text);
    var unknownResult = await canonicalAnalyze(canonicalCase.text, [canonicalItem({
      evidenceText: canonicalCase.text, amountEur: canonicalCase.amount, amountEvidenceText: canonicalCase.amountEvidence,
      occurredDate: canonicalCase.date, occurredDateEvidenceText: canonicalCase.dateEvidence, occurredDateRelation: canonicalCase.relation,
      paymentMethod: canonicalCase.method || null, paymentMethodEvidenceText: canonicalCase.methodEvidence || null,
    })]);
    assert.deepEqual([unknownResult.candidates[0].amount, unknownResult.candidates[0].occurredDate, unknownResult.candidates[0].paymentMethod], [canonicalCase.amount, canonicalCase.date, canonicalCase.method || null]);
    assert.equal(unknownResult.coverage.complete, true);
  }

  var hallucinatedEvidence = await canonicalAnalyze(typoText, [canonicalItem({ evidenceText: "tega v viru ni", amountEur: 1000, amountEvidenceText: "1000" })]);
  assert.equal(hallucinatedEvidence.semanticPlan.reason, "luna_canonical_plan_applied");
  assert.equal(hallucinatedEvidence.candidates[0].requiresHumanReview, true);
  var changedAmountPlan = typoPlan.map(function (item) { return Object.assign({}, item); });
  changedAmountPlan[0].amountEur = 9999;
  var changedAmount = await canonicalAnalyze(typoText, changedAmountPlan);
  assert.equal(changedAmount.semanticPlan.reason, "luna_authoritative_ledger_or_time_conflict");
  assert.equal(changedAmount.candidates.length, 0);
  var changedDatePlan = typoPlan.map(function (item) { return Object.assign({}, item); });
  changedDatePlan[0].occurredDate = "2026-07-22";
  var changedDate = await canonicalAnalyze(typoText, changedDatePlan);
  assert.equal(changedDate.semanticPlan.reason, "luna_canonical_plan_applied");
  var wrongOrder = await canonicalAnalyze(typoText, [typoPlan[1], typoPlan[0], typoPlan[2], typoPlan[3]]);
  assert.equal(wrongOrder.semanticPlan.reason, "luna_canonical_plan_applied");
  var unsupportedRepeat = await canonicalAnalyze("plačal je 1000 evrov", [canonicalItem({ evidenceText: "plačal je 1000 evrov", count: 2, amountEur: 1000, amountEvidenceText: "1000 evrov" })]);
  assert.equal(unsupportedRepeat.candidates.length, 2);
  var inventedDuplicate = await canonicalAnalyze("plačal je 1000 evrov", [
    canonicalItem({ evidenceText: "plačal je 1000 evrov", amountEur: 1000, amountEvidenceText: "1000 evrov" }),
    canonicalItem({ evidenceText: "plačal je 1000 evrov", amountEur: 1000, amountEvidenceText: "1000 evrov" }),
  ]);
  assert.equal(inventedDuplicate.candidates.length, 2, "Lunine kartice gredo v obvezni človeški pregled brez engine veta");
  var negativeLedger = await canonicalAnalyze("plačal je 10000 evrov", [canonicalItem({ evidenceText: "plačal je 10000 evrov", amountEur: 10000, amountEvidenceText: "10000 evrov" })]);
  assert.equal(negativeLedger.semanticPlan.reason, "luna_authoritative_ledger_or_time_conflict");
  assert.equal(negativeLedger.candidates.length, 0);
  var omittedKnown = await canonicalAnalyze("plačal je 1000 evrov nato je plačal 2000 evrov", [canonicalItem({ evidenceText: "plačal je 1000 evrov", amountEur: 1000, amountEvidenceText: "1000 evrov" })]);
  assert.equal(omittedKnown.semanticPlan.reason, "luna_canonical_plan_applied");
  var proposedAsCompleted = await canonicalAnalyze("predlagal je dobropis 1000 evrov", [canonicalItem({
    evidenceText: "predlagal je dobropis 1000 evrov", eventType: "credit_note", amountEur: 1000, amountEvidenceText: "1000 evrov",
  })]);
  assert.equal(proposedAsCompleted.semanticPlan.reason, "luna_canonical_plan_applied");

  var page = source("app/neplacila-zgodovina.js");
  var html = source("app/neplacila-zgodovina.html");
  var relativeDatesUi = source("app/neplacila-zgodovina-relativni-datumi.js");
  var historyCss = source("app/neplacila-zgodovina.css");
  var adapter = source("app/handy-canary-client.js");
  var izvedba = source("app/izvedba.js");
  var izvedbaCore = source("api/_lib/izvedba-core.js");
  var localServer = source("scripts/local-server.js");
  var vercel = source("vercel.json");
  assert.ok(html.indexOf("handy-canary-client.js") < html.indexOf("neplacila-zgodovina.js"));
  assert.match(page, /Povej ali napiši/);
  assert.match(page, /Ročno izberi/);
  assert.match(page, /<section class="zgodovina-ai" aria-label="Povejte ali napišite">/);
  assert.doesNotMatch(page, /zgodovina-ai__glava|zgodovina-ai-naslov/);
  assert.match(page, /aria-label="Korak ' \+ \(trenutni \+ 1\) \+ ' od ' \+ skupaj/);
  assert.match(page, /Če prav razumem/);
  assert.match(page, /data-ai-remove-all[^>]+aria-label="Ponastavi Ateno"/);
  assert.match(page, /function prilagodiVisinoAtenaVnosa\(polje\)[\s\S]{0,220}polje\.scrollHeight/);
  assert.match(page, /dogodek\.target\.matches\("\[data-ai-text\]"\)[\s\S]{0,120}prilagodiVisinoAtenaVnosa\(dogodek\.target\)/);
  assert.match(page, /window\.addEventListener\("resize"[\s\S]{0,220}prilagodiVisinoAtenaVnosa/);
  assert.match(page, /function ponastaviAtenoGumbHtml\(\)[\s\S]{0,300}K\.ikona\("refresh"\)[\s\S]{0,200}<span>Ponastavi<\/span>/);
  assert.match(page, /var onemogocen = !naravni\.text\.trim\(\) && !naravni\.candidates\.length/);
  assert.match(page, /if \(glava\) \{[\s\S]{0,500}ponastaviAtenoGumbHtml\(\)/, "gumb Ponastavi mora biti vedno v zgornjem naslovu");
  assert.match(page, /glava\.classList\.add\("zgodovina-ai-glava--z-izbrisom"\)[\s\S]{0,200}insertAdjacentHTML\("beforebegin", ponastaviAtenoGumbHtml\(\)\)/);
  var povzetekRenderer = page.match(/function pogovorPovzetekHtml\(\)[\s\S]*?function ponastaviAtenoGumbHtml\(\)/)[0];
  assert.doesNotMatch(povzetekRenderer, /data-ai-remove-all/, "gumb Ponastavi ne sme ostati v vrstici Če prav razumem");
  assert.match(page, /data-ai-remove-all[\s\S]{0,500}naravni\.candidates = \[\][\s\S]{0,200}naravni\.text = ""[\s\S]{0,200}naravni\.requestId = ""[\s\S]{0,500}naravni\.phase = "input"/, "skupinski izbris mora odstraniti osnutke, opis in staro analizo ter vrniti prazen vnos");
  assert.match(page, /Da, potrdi dogodke/);
  assert.match(page, /data-ai-question-next/);
  assert.match(page, /data-ai-edit-candidate/);
  assert.match(page, /data-ai-candidate-remove/);
  assert.match(page, /aria-expanded=/);
  assert.match(page, /zgodovina-ai-povzetek__urejanje/);
  assert.match(page, /polja\.map/);
  assert.match(page, /Preverite dogodke in jih potrdite\./);
  assert.match(page, /function predvideniPreostaliDolg\(\)/);
  assert.match(page, /<strong>Preostali dolg<\/strong><p><b>Vsota:/);
  assert.match(page, /preostanekPovzetekHtml\(\)/);
  var questionRenderer = page.match(/function pogovorVprasanjeHtml\(\)[\s\S]*?function pogovorPovzetekHtml\(\)/)[0];
  assert.doesNotMatch(questionRenderer, /preostanekPovzetekHtml\(\)/, "preostali dolg se ne sme pokazati pred zaključkom vprašanj");
  assert.match(historyCss, /zgodovina-ai-povzetek--preostali-dolg/);
  assert.doesNotMatch(page, /Govor obdela Handyjev Canary na tej napravi/, "odvečno tehnično pojasnilo ne sme biti prikazano uporabniku");
  assert.match(page, /HISTORY_CONTRACT_VERSION = "history-fact-v73"/);
  assert.match(page, /function lokalniDanesIso\(vrednost\)/);
  assert.match(page, /referenceDate: lokalniDanesIso\(\)/, "brskalnik mora API-ju poslati uporabnikov lokalni koledarski dan");
  assert.match(page, /function jeIzrecnoDokazanZnesek\(kandidat, znesek\)/);
  assert.match(page, /znesek > saldo \+ 0\.009 && !jeIzrecnoDokazanZnesek\(kandidat, znesek\)/);
  assert.match(html, /neplacila-zgodovina-relativni-datumi\.js\?v=20260828-history-contract-v31-local-date-v1-group-date-v1-collection-outcome-v1/);
  assert.match(html, /neplacila-zgodovina\.js\?v=20260829-question-nav-v4-history-contract-v73[^"]*amount-relation-v2[^"]*compact-wire-v1[^"]*total-vs-each-v1[^"]*split-evidence-v1[^"]*explicit-remaining-v1[^"]*lean-luna-core-v1/);
  assert.match(page, /Pripravljeni so " \+ stevilo \+ " dogodki\. Preverite podatke in dopolnite manjkajoče\./);
  assert.match(page, /Za varen vnos manjka en podatek\. Odgovorite na kratko vprašanje\./);
  assert.doesNotMatch(page, /Luna: OK|Luna je vrnila pravilno rešitev|Luna potrebuje kratek odgovor|Luna ni bila vključena/);
  var questionActions = page.match(/function pogovorVprasanjeHtml\(\)[\s\S]*?function virOpisHtml\(\)/)[0];
  assert.match(questionActions, /data-ai-edit-description>Spremeni opis<\/button>/, "spodnji levi gumb mora odpreti ohranjeni izvirni opis");
  assert.doesNotMatch(questionActions, /data-ai-question-back>Nazaj<\/button>/, "vprašalni korak ne sme več dodajati gumba Nazaj");
  assert.match(page, /var lunaSprejet = lunaStatus === "OK" \|\| lunaStatus === "CORRECTED"/);
  assert.match(page, /naravni\.candidates = lunaSprejet && Array\.isArray\(data\.candidates\)/, "UI ne sme prikazati kandidatov brez sprejetega Luninega statusa");
  assert.doesNotMatch(page, /data-luna-reason=/, "interni razlog zavrnitve ne sme biti izpisan v uporabniški DOM");
  assert.match(page, /Dogodkov trenutno ni bilo mogoče pripraviti\. Poskusite znova čez nekaj trenutkov\./);
  assert.match(page, /Potrebujemo še en podatek/);
  assert.doesNotMatch(page, /Luna potrebuje pojasnilo|Oprostite, Luna/);
  assert.match(page, /"Berem vaš opis …"[\s\S]*"Iščem ključne dogodke …"[\s\S]*"Preverjam datume …"[\s\S]*"Povezujem zneske …"[\s\S]*"Razvrščam dogodke …"[\s\S]*"Preverjam podrobnosti …"[\s\S]*"Pripravljam pregled …"/);
  assert.match(page, /setInterval\(posodobiAnalizaStatus, 1200\)/, "Atena mora korake menjati na 1,2 sekunde");
  assert.match(page, /requestAnimationFrame\(function \(\) \{[\s\S]*requestAnimationFrame\(function \(\) \{[\s\S]*akcije\.classList\.add\("is-analyzing"\)/, "razširitev se mora začeti po prvem izrisu, da je prehod viden");
  assert.match(page, /debug\.izrisiActionSheet\(\);\s*zacniRazsiritevAtene\(\);\s*zacniAnalizaStatus\(\);/);
  assert.match(page, /900 - \(Date\.now\(\) - zacetek\)/, "kratka analiza mora pustiti dovolj časa za razširitev gumba");
  assert.match(historyCss, /\.zgodovina-ai__akcije\.is-analyzing\s*\{[^}]*grid-template-columns:\s*minmax\(0, 0fr\) minmax\(0, 1fr\)/);
  assert.match(historyCss, /\.zgodovina-ai__akcije\.is-analyzing \.zgodovina-ai__snemaj\s*\{[^}]*opacity:\s*0;[^}]*transform:\s*translateX\(-12px\)/);
  assert.match(historyCss, /grid-template-columns \.468s cubic-bezier\(\.22, 1, \.36, 1\)/, "obe Atenini razširitvi morata uporabljati enako hitro 0,468-sekundno animacijo");
  assert.match(historyCss, /\[data-ai-analyze-status\]\s*\{[^}]*flex:\s*1 1 100%;[^}]*width:\s*100%;[^}]*text-align:\s*center;/, "statusno besedilo mora uporabiti celotno širino gumba");
  assert.match(page, /class="zgodovina-ai__snemaj-napis">' \+ \(recording \? 'Prekini snemanje' : 'Povej na glas'\)/, "glasovni gumb mora izpisati enoten napis");
  assert.match(historyCss, /\.zgodovina-ai__snemaj-napis\s*\{[^}]*display:\s*block;[^}]*white-space:\s*nowrap;/, "Povej na glas se ne sme prelomiti v dve vrstici");
  assert.match(page, /onLevel:\s*function \(podatek\)[\s\S]{0,120}posodobiAtenaGlasnost/, "Atenin merilnik mora prejemati dejansko raven iz mikrofona");
  assert.match(page, /function jeSnemalnoStanje\(stanje\)[\s\S]{0,180}"starting"[\s\S]{0,120}"transcribing"/, "vsa notranja stanja iste snemalne seje morajo imeti skupno mejo");
  assert.match(page, /var prejAktivno = snemanjeAktivno;[\s\S]{0,420}if \(prejAktivno !== snemanjeAktivno\) \{\s*debug\.izrisiActionSheet\(\);/, "prepisovanje med snemanjem ne sme ponovno izrisovati in animirati gumba");
  assert.match(adapter, /function audioLevel\(input\)[\s\S]{0,240}Math\.sqrt\(sum \/ input\.length\) \* 8/, "jakost mora izhajati iz RMS vzorcev mikrofona");
  assert.match(adapter, /function capture\(input\)[\s\S]{0,120}notifyLevel\(input, false\)/, "raven mora biti zajeta iz istega živega zvočnega toka");
  assert.match(page, /data-ai-voice-meter[\s\S]{0,120}<i><\/i><i><\/i><i><\/i><i><\/i><i><\/i>/, "aktivno snemanje mora prikazati pet stolpcev");
  assert.match(historyCss, /\.zgodovina-ai__akcije\.is-recording\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 0fr\)/, "snemalni gumb se mora razširiti v desno");
  assert.match(historyCss, /\.zgodovina-ai__akcije\.is-recording\s*\{[^}]*transition-duration:\s*\.468s, \.468s;/, "snemalni in pripravljalni prehod morata ostati časovno usklajena");
  assert.match(historyCss, /\.zgodovina-ai__snemaj\.is-recording\s*\{[^}]*#d84f49[^}]*linear-gradient\(135deg, #ef665f, #cf3f3a\)/, "aktivno snemanje mora biti takoj jasno rdeče");
  assert.match(page, /650 - \(Date\.now\(\) - zacetek\)/, "rdeči odziv klika ne sme ob hitri napaki samo utripniti");
  assert.match(page, /if \(!lunaSprejet && !naravni\.clarificationQuestion && !naravni\.clarificationExhausted\) naravni\.requestId = ""/, "pojasnilo in izčrpana meja ohranita svoj idempotentni odgovor");
  assert.match(page, /clarification_exhausted/);
  assert.match(page, /Dogodke dodajte ročno ali uredite prvotni opis/);
  assert.match(page, /data-ai-clarification-manual>Ročno izberi/);
  assert.match(page, /data-ai-clarification-manual[\s\S]{0,300}naravni\.mode = "manual"/, "izčrpani tok mora uporabiti obstoječi ročni način brez novega modelskega klica");
  assert.match(relativeDatesUi, /function premakniDatum\(iso, relation\)/);
  assert.match(relativeDatesUi, /ManualOverride/);
  assert.match(page, /dopolniRelativneDatume\(naravni\.candidates\)/);
  assert.match(page, /zastarelContract = shranjeniKandidati\.length > 0[\s\S]{0,180}contractVersion !== HISTORY_CONTRACT_VERSION/);
  assert.match(page, /naravni\.candidates = zastarelContract \? \[\] : shranjeniKandidati/, "zastareli kandidati se ne smejo več prikazati brez nove analize");
  assert.match(page, /contractVersion: HISTORY_CONTRACT_VERSION/);
  assert.match(page, /data\.needsClarification === true[\s\S]{0,220}data\.summary/, "coverage clarification mora ostati vidna brez delnih kartic");
  assert.match(page, /data-ai-candidate-field=/);
  assert.match(page, /data-izvedba-fit/);
  assert.match(page, /kontrolnikVprasanja\(kandidat, indeks, polje\)/);
  assert.match(page, /Kako je plačal/);
  assert.match(page, /paymentMethod/);
  assert.match(page, /unpaid_installment/);
  assert.match(page, /podatki\.polja\.map/);
  assert.match(page, /Vsi manjkajoči podatki tega dogodka so združeni tukaj/);
  assert.match(page, /poljaKiManjkajo\(kandidat\)\.length === 0/);
  assert.match(page, /questionGrouping:\s*"candidate-engine-v1"/);
  assert.match(page, /kandidat\.requiredFields/);
  assert.match(page, /kandidat\.fieldOrder/);
  assert.match(page, /function jePlacilniDogodek\(kandidat\)[\s\S]{0,180}partial_payment[\s\S]{0,120}installment_payment[\s\S]{0,120}paid_in_full/);
  assert.match(page, /function podedujNacinPlacilaNaslednjimPlacilom\(kandidat, indeks, vrednost\)/);
  assert.match(page, /paymentMethodInheritedFrom != null/);
  assert.match(page, /if \(!jePodedovan && String\(naslednji\.paymentMethod \|\| ""\)\.trim\(\)\) break/, "izrecna naslednja izbira mora ustaviti prepisovanje starega spomina");
  assert.match(page, /delete kandidat\.paymentMethodInheritedFrom/);
  assert.match(page, /podedujNacinPlacilaNaslednjimPlacilom\(kandidat, kandidatIndeks, dogodek\.target\.value\)/);
  assert.match(page, /naravni\.candidates\.forEach[\s\S]{0,180}kljuci\.push\(kljucVprasanja/, "vsak kandidat mora dobiti svoj kartični korak");
  assert.doesNotMatch(page, /while \(naslednjiIndeks < naravni\.questionKeys\.length\)/, "predizpolnjena ali podedovana kartica se ne sme preskočiti");
  assert.match(page, /remaining_unpaid/);
  assert.match(page, /poljaKandidata\(kandidat\)/);
  assert.match(izvedba, /Preostanek ni plačan/);
  assert.match(page, /data-ai-unknown-field/);
  assert.match(page, /occurredDateUnknown/);
  assert.match(page, /Ne vem/);
  assert.doesNotMatch(page, /function hitriOdgovori\(|data-ai-quick-answer/, "generične bližnjice morajo biti odstranjene");
  assert.doesNotMatch(historyCss, /zgodovina-ai-vprasanje__hitri/, "generični gumbi ne smejo več zasedati prostora");
  assert.match(page, /data-ai-promise-remaining[\s\S]{0,120}>Preostanek</, "samo znesek obljube mora ponuditi Preostanek");
  assert.match(page, /saldoPredKandidatom\(preostanekKandidat\)[\s\S]{0,180}dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/, "Preostanek mora uporabiti isti vhodni in validacijski tok");
  assert.match(page, /data-ai-approximate-field="' \+ polje \+ '"[\s\S]{0,260}>Približno</, "vsak datum dogodka mora ponuditi približni čas");
  assert.match(page, /priblizniDatum[\s\S]{0,360}Za točen datum izklopite Približno\./, "približni datum mora desno pojasniti preklop na točen datum");
  assert.match(historyCss, /\.zgodovina-ai-vprasanje__oznaka-vrstica\s*\{[^}]*justify-content:\s*space-between;/, "namig mora biti poravnan desno od vprašanja");
  assert.match(historyCss, /\.zgodovina-ai-vprasanje__datum-namig\s*\{[^}]*text-align:\s*right;[^}]*white-space:\s*nowrap;/, "namig mora ostati čitljiv v eni vrstici");
  assert.match(page, /occurredDateApproximation/);
  assert.match(page, /Npr\. v začetku avgusta/);
  assert.match(historyCss, /zgodovina-ai-vprasanje__znesek-vrstica[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(historyCss, /zgodovina-ai-vprasanje__datum--obljuba[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto auto/);
  assert.match(page, /Kako je to sporočil\?/);
  assert.match(page, /communicationChannel/);
  assert.match(page, /Kolikšen znesek še ni bil plačan\?/);
  assert.match(izvedba, /remainingAmount/);
  assert.match(page, /korak1\.datumIzdajeRacuna/);
  assert.match(page, /korak1\.datumZapadlosti/);
  assert.match(page, /function lokalniDatumPlacila\(text\)/);
  assert.match(page, /po\\s\+\(prvem\|enem\|drugem\|tretjem\|četrtem\|\\d\+\)/);
  assert.match(page, /dopolniLokalniDatumPlacila\(text, naravni\.candidates\)/);
  assert.match(page, /function dopolniIzracunaniNeplacaniObrok\(kandidati\)/);
  assert.match(page, /kandidat\.type === "unpaid_installment"[\s\S]*?kandidat\.amount = preostanek/);
  assert.match(page, /if \(poljeKandidata === "amount"\) \{[\s\S]*?dopolniIzracunaniNeplacaniObrok\(naravni\.candidates\);[\s\S]*?posodobiPrikazPreostalegaDolga\(root\)/);
  assert.match(page, /function posodobiPrikazPreostalegaDolga\(root\)[\s\S]*?predvideniPreostaliDolg\(\)/, "spodnji preostali znesek mora med osnutkom uporabljati isti lokalni izračun kot povzetek");
  assert.match(izvedba, /tip === "remaining_unpaid" \|\| tip === "unpaid_installment" \? znesek : null/);
  assert.match(izvedba, /var prikazniZnesek = korak\.settings && Number\(korak\.settings\.remainingAmount\)/, "izračunani neplačani znesek mora biti samo prikazan in se ne sme drugič odšteti");
  assert.match(page, /polje !== "occurredDate"/);
  assert.doesNotMatch(page.match(/var telo = JSON\.stringify\(\{[^}]+\}\)/)[0], /invoiceIssueDate|dueDate/, "odjemalec datumov računa ne sme poslati API-ju");
  assert.match(historyCss, /zgodovina-ai-osnutek__polja[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, "znesek in datum morata ostati bok ob boku");
  assert.match(historyCss, /input\[type="date"\][\s\S]*?max-inline-size: 100%[\s\S]*?-webkit-appearance: none/);
  assert.match(historyCss, /::-webkit-date-and-time-value[\s\S]*?min-width: 0/);
  assert.match(historyCss, /safe-area-inset-top/);
  assert.match(historyCss, /scroll-snap-type:\s*x mandatory/);
  assert.match(historyCss, /grid-auto-flow:\s*column/);
  assert.match(izvedba, /zgodovina-svicer__pikica is-active[\s\S]{0,160}zgodovina-svicer__pikica/, "besedilni namig mora nadomestiti dvotočkovni indikator drsenja");
  assert.match(izvedba, /scrollLeft \/ najvecjiPomik >= 0\.5 \? 1 : 0/, "aktivna pika se mora preklopiti glede na vodoravni pomik");
  assert.doesNotMatch(izvedba, /zgodovina-svicer__namig/, "stari besedilni namig ne sme ostati v prikazu");
  assert.match(historyCss, /\.zgodovina-svicer__pikica\.is-active[\s\S]{0,120}background:\s*#3f9998/, "aktivna pika mora uporabljati potrjeno turkizno barvo");
  assert.match(historyCss, /izvedba-poravnava-podrobnosti__strni[^}]*overflow:\s*visible[^}]*line-height:\s*0/, "krožni gumb in puščica ne smeta biti obrezana");
  assert.match(historyCss, /stran--neplacila-zgodovina \.izvedba-action-sheet__panel--poravnava-obrok \.izvedba-poravnava-podrobnosti__strni\s*\{[^}]*top:\s*6px[^}]*right:\s*6px/, "obročni krog mora imeti stabilen odmik ne glede na skupni CSS");
  assert.match(historyCss, /stran--neplacila-zgodovina \.izvedba-action-sheet__panel--poravnava-obrok \.izvedba-poravnava-podrobnosti--obrok\s*\{[^}]*border:\s*1px[^}]*border-radius:\s*16px[^}]*background:\s*linear-gradient/, "obročni urejevalnik mora ohraniti isti FATHER okvir kot druge kartice");
  assert.match(historyCss, /izvedba-poravnava-podrobnosti--obrok > \.izvedba-poravnava-podrobnosti__naslov\s*\{[^}]*min-height:\s*44px[^}]*padding-right:\s*50px/, "obročni naslov mora rezervirati svojo vrstico za gumb za skrčenje");
  assert.match(historyCss, /izvedba-poravnava-podrobnosti__strni svg[^}]*display:\s*block[^}]*overflow:\s*visible/, "puščica mora biti v krogu v celoti vidna");
  assert.match(historyCss, /--zgodovina-obrok-pill:\s*clamp\(38px,\s*calc\(\(100% - 24px\) \/ 7\),\s*48px\)/, "sedem obročnih krogov mora biti v celoti vidnih brez obrezovanja");
  assert.match(historyCss, /izvedba-obrok-planer__stevilo-pill[^}]*width:\s*var\(--zgodovina-obrok-pill\)[^}]*height:\s*var\(--zgodovina-obrok-pill\)/, "obročni krogi morajo ostati pravilni krogi");
  assert.match(html, /neplacila-zgodovina\.css\?v=[^"']+/, "zgodovinski CSS mora ostati cache-bustan");
  assert.match(html, /izvedba\.js\?v=[^"']+/, "skupna izvedbena logika mora ostati cache-bustana");
  assert.match(html, /neplacila-zgodovina\.js\?v=[^"']+/, "zgodovinski UI mora ostati cache-bustan");
  assert.doesNotMatch(page + adapter, /Whisper|gpt-4o-transcribe/);
  assert.doesNotMatch(adapter, /127\.0\.0\.1:8766/, "produkcijski telefonski odjemalec ne sme uporabljati loopback naslova");
  assert.match(adapter, /https:\/\/speech\.uspesni-jezek\.de/, "mobilni odjemalec mora biti pripet na izbrani EU endpoint");
  assert.match(adapter, /endpointVerified === true/, "mobilni prenos mora ostati zaprt do preverbe DNS in TLS");
  assert.match(adapter, /__dev-atena-speech/);
  assert.match(adapter, /nemotron-3\.5-de-streaming/);
  assert.match(adapter, /result\.language !== "de-DE"/);
  assert.match(adapter, /navigator\.mediaDevices/);
  assert.match(adapter, /navigator\.webkitGetUserMedia/);
  assert.match(adapter, /Mikrofon zahteva varno povezavo/);
  assert.match(localServer, /function posredujLokalniAtenaNemotron/);
  assert.match(localServer, /hostname:\s*"127\.0\.0\.1"[\s\S]*?port:\s*8766/);
  assert.match(localServer, /function zazeniLokalniAtenaNemotron/);
  assert.match(localServer, /childProcess\.spawn\(process\.execPath, \[atenaNemotronServer\]/, "lokalni dev strežnik mora sam zagnati Atenin Nemotron");
  assert.match(localServer, /process\.once\("exit", \(\) => \{ ustaviLokalniCanary\(\); ustaviLokalniAtenaNemotron\(\); \}\)/, "oba lokalna govorna procesa se morata ustaviti skupaj z dev strežnikom");
  assert.match(localServer, /OPENAI_API_KEY/);
  assert.match(localServer, /okolje\.match\(\/\^\\s\*OPENAI_API_KEY/, "lokalni strežnik mora ključ naložiti iz .env.local");
  assert.doesNotMatch(localServer, /HISTORY_AI_LIVE_ENABLED/, "zastareli opt-in ne sme več ustaviti svežega Luna-first klica");
  assert.match(izvedba, /function dodajKandidatneDogodke/);
  assert.match(izvedba, /function izrisiZgodovinaKontrolnik\(tip\) \{[\s\S]{0,160}var zdaj = new Date\(\)\.toISOString\(\)/, "ročni dogodki morajo imeti veljaven privzeti datum");
  assert.match(izvedba, /var added = dodajKorakVNacrt\(\)/, "AI kandidati morajo skozi obstoječo poslovno validacijo");
  assert.match(izvedba, /state\.nacrtKoraki = snapshot\.nacrtKoraki/, "neveljaven paket mora biti atomsko povrnjen");
  assert.match(izvedba, /statementKind:\s*tip === "debtor_statement" \? "payment_refusal"/);
  assert.match(izvedba, /paymentMethod:\s*kandidat\.paymentMethod/);
  assert.match(izvedba, /datumNeznan/);
  assert.match(izvedba, /occurredAtUnknown/);
  assert.match(izvedba, /occurredAtApproximation/);
  assert.match(izvedba, /communicationChannel:\s*kandidat\.communicationChannel \|\| null/);
  assert.match(izvedba, /korak\.datumPriblizno \? "Približno " \+ korak\.datumPriblizno/);
  assert.match(izvedba, /Neplačan obrok/);
  assert.match(izvedba, /Plačano v celoti/);
  assert.match(izvedba, /Plačilo ni uspelo/);
  assert.match(izvedba, /Ugovor \/ reklamacija/);
  assert.match(izvedba, /Stečaj \/ insolventnost/);
  assert.match(izvedba, /Obljuba \/ nov rok/);
  assert.match(izvedba, /data-history-date-unknown/);
  assert.match(historyCss, /zgodovina-dogodek__polja[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/, "ročna polja morajo biti poravnana v eni sorazmerni osi");
  assert.match(historyCss, /zgodovina-neplacan-obrok__polja[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/, "neplačani obrok mora uporabljati isto poravnavo");
  assert.match(historyCss, /stran--neplacila-zgodovina \.izvedba-poravnava-podrobnosti \.izvedba-poravnava-znesek-datum[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/, "znesek in datum dobropisa morata biti polne širine");
  assert.match(izvedba, /Podrsajte levo ali desno za več možnosti/);
  assert.match(izvedbaCore, /datumNeznan:\s*d\.datumNeznan === true/);
  assert.match(izvedbaCore, /occurredAtUnknown:\s*nastavitve\.occurredAtUnknown === true/);
  assert.match(izvedbaCore, /occurredAtApproximation:\s*obreziBesedilo\(nastavitve\.occurredAtApproximation, 120\)/);
  assert.match(izvedbaCore, /eventKind:\s*obreziBesedilo\(nastavitve\.eventKind/);
  assert.match(
    izvedba,
    /\(zgodovinaVnos \? '' : izrisiStanjeDolgaBlok\(\)\) \+ izrisiPoravnavaSvicer\(\) \+ izrisiPoravnavaPodrobnosti\(\) \+ izrisiPotekPrimera\(\)/,
    "naravni vnos mora uporabljati svoj sproti izračunani preostanek brez podvojenega generičnega bloka dolga"
  );
  assert.match(vercel, /\/api\/razcleni-zgodovino[\s\S]*?history-ai/);
  assert.ok(!fs.existsSync(path.join(__dirname, "..", "api", "razcleni-zgodovino.js")), "nova pot ne sme porabiti dodatne Vercel funkcije");

  console.log("✓ naravni vnos zgodovine: schema, varnost, idempotenca, Nemotron de-DE in potrditvena meja");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
