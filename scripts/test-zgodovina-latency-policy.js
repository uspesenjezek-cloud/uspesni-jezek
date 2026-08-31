"use strict";

var assert = require("node:assert/strict");
var parser = require("../api/_lib/zgodovina-naravni-vnos");
var policy = require("../api/_lib/atena-luna-policy");

var context = { referenceDate: "2026-08-30", originalDebt: 232, remainingDebt: 232 };
var simpleText = "plačal je 100 evrov razdrobljeno na 4 obroke prvi obrok je plačal mesec dni nazaj";
var complexText = "plačal je 220 prvi obrok in nato 3 obroke vsak teden dni narazen v vrednosti 10 prvi obrok je plačal mesec dni nazaj";

function response(output) {
  return {
    ok: true,
    status: 200,
    headers: { get: function () { return null; } },
    json: async function () { return { output_text: JSON.stringify(output) }; },
  };
}

function columnarCard(cardId, evidence, fields) {
  return {
    c: cardId,
    e: evidence,
    i: fields.map(function (field) { return field.i; }),
    v: fields.map(function (field) { return field.v; }),
    x: fields.map(function (field) { return field.e; }),
    r: fields.map(function (field) { return field.r; }),
  };
}

function percentile(values, ratio) {
  var ordered = values.slice().sort(function (left, right) { return left - right; });
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))];
}

async function main() {
  var profile = policy.requestProfile("history");
  assert.deepEqual(profile, {
    reasoningEffort: "low", maxOutputTokens: 1600, timeoutMs: 18000, timeoutMaxMs: 25000,
  });
  assert.equal(parser.MODEL_TIMEOUT_MS, 18000);
  assert.equal(parser.MODEL_TIMEOUT_MAX_MS, 25000);
  assert.equal(parser.MAX_CLARIFICATION_ROUNDS, 2);
  assert.equal(parser.MAX_LUNA_CALLS_PER_DESCRIPTION, 3);

  var body = parser.requestBody(complexText, context, "history-latency-regression");
  var input = JSON.parse(body.input);
  assert.equal(body.reasoning.effort, "low");
  assert.equal(body.max_output_tokens, 1600);
  assert.equal(body.prompt_cache_key, "atena-history:" + parser.CONTRACT_VERSION + ":" + body.model);
  assert.deepEqual(body.prompt_cache_options, { mode: "implicit", ttl: "30m" });
  assert.doesNotMatch(body.prompt_cache_key, /history-latency-regression|plačal|232/, "stabilni cache ključ ne sme vsebovati uporabniškega ali dinamičnega konteksta");
  assert.ok(body.input.indexOf('"catalog"') < body.input.indexOf('"debtEur"'), "stabilni katalog mora biti pred dinamičnim dolgom");
  assert.ok(body.input.indexOf('"catalog"') < body.input.indexOf('"sourceText"'), "stabilni katalog mora biti pred dinamičnim opisom");
  assert.ok(Buffer.byteLength(JSON.stringify(body), "utf8") < 16500, "kratek zgodovinski opis z debt-first mejo mora ostati pod 16,5 KB");
  assert.equal(input.catalog.guide.length, 17);
  assert.equal(input.catalog.languagePolicy, undefined);
  assert.deepEqual(input.catalog.guideColumns, ["cardId", "key", "title", "useWhen", "doNotUseWhen", "aliases", "examples"]);
  assert.ok(input.catalog.guide.every(function (card) {
    return Array.isArray(card) && card[3] && card[4] && Array.isArray(card[5]) && card[5].length >= 4 && Array.isArray(card[6]) && card.languageProfile === undefined;
  }), "Luna mora ohraniti pomenske meje in bogate sopomenke v kompaktnih vrsticah");

  var timeoutCalls = 0;
  var timeoutStarted = Date.now();
  var timedOut = await parser.analyze(complexText, context, {
    apiKey: "test-only",
    timeoutMs: 100,
    fetchImpl: function (_url, options) {
      timeoutCalls += 1;
      return new Promise(function (_resolve, reject) {
        options.signal.addEventListener("abort", function () {
          var error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    },
  });
  assert.equal(timeoutCalls, 1, "hard timeout ne sme sprožiti drugega dolgega modelnega poskusa");
  assert.equal(timedOut.semanticPlan.reason, "luna_timeout");
  assert.equal(timedOut.semanticPlan.transport.attempts, 1);
  assert.ok(Date.now() - timeoutStarted < 1000);

  var directClarificationCalls = 0;
  var clarification = await parser.analyze(complexText, context, {
    apiKey: "test-only",
    fetchImpl: async function () {
      directClarificationCalls += 1;
      return response({
        p: [],
        q: "Ali je bil prvi obrok 220 €, nato pa so sledili trije obroki po 10 €?",
        x: "220 prvi obrok in nato 3 obroke",
      });
    },
  });
  assert.equal(clarification.semanticPlan.status, "CLARIFICATION_REQUIRED");
  assert.equal(clarification.semanticPlan.reason, "luna_clarification_requested");
  assert.equal(clarification.clarification.clauseId, "clause-1");
  assert.equal(directClarificationCalls, 1, "neposredno Lunino vprašanje ne sme sprožiti repair klica");

  var simple = await parser.analyze(simpleText, context, {
    apiKey: "test-only",
    fetchImpl: async function () {
      return response({
        p: [{
          n: 1,
          c: 3,
          e: simpleText,
          f: [
            { i: 1, v: 25, e: "100 evrov razdrobljeno na 4 obroke", r: [651] },
            { i: 2, v: "2026-07-30", e: "mesec dni nazaj", r: [601, 611, 621, 631, 1, 643, null] },
            { i: 8, v: "1/4 obrok", e: "prvi obrok", r: [] },
          ],
        }],
        q: null,
        x: null,
      });
    },
  });
  assert.equal(simple.semanticPlan.status, "OK");
  assert.equal(simple.candidates.length, 1);
  assert.equal(simple.candidates[0].type, "installment_payment");
  assert.equal(simple.candidates[0].amount, 25);
  assert.equal(simple.candidates[0].description, "1/4 obrok");
  assert.equal(simple.candidates[0].paymentMethod, null);
  assert.deepEqual(simple.candidates[0].missing, []);
  assert.equal(simple.projectedRemainingDebtEur, 207);

  function fivePaymentTypoCards(text, dateEvidence, repeatEvidence) {
    return Array.from({ length: 5 }, function (_, index) {
      var first = index === 0;
      var occurredDate = ["2026-07-30", "2026-08-06", "2026-08-13", "2026-08-20", "2026-08-27"][index];
      return {
        n: index + 1,
        c: 3,
        e: text,
        f: [
          { i: 1, v: first ? 40 : 10, e: first ? "40" : "10", r: [] },
          { i: 2, v: occurredDate, e: first ? dateEvidence : "vsak teden dni narazen", r: first
            ? [601, 611, 621, 631, 1, 643, null]
            : [601, 611, 622, 633, 1, 642, null] },
          { i: 8, v: (index + 1) + "/5 obrok", e: first ? "prvi obrok" : repeatEvidence, r: [] },
        ],
      };
    });
  }

  async function assertFivePaymentTypoCase(text, dateEvidence, repeatEvidence) {
    var result = await parser.analyze(text, context, {
      apiKey: "test-only",
      fetchImpl: async function () {
        return response({ p: fivePaymentTypoCards(text, dateEvidence, repeatEvidence), q: null, x: null });
      },
    });
    assert.equal(result.semanticPlan.status, "OK", result.semanticPlan.reason);
    assert.equal(result.needsClarification, false);
    assert.equal(result.clarification || null, null);
    assert.deepEqual(result.candidates.map(function (candidate) { return candidate.amount; }), [40, 10, 10, 10, 10]);
    assert.deepEqual(result.candidates.map(function (candidate) { return candidate.occurredDate; }), ["2026-07-30", "2026-08-06", "2026-08-13", "2026-08-20", "2026-08-27"]);
    assert.deepEqual(result.candidates.map(function (candidate) { return candidate.description; }), ["1/5 obrok", "2/5 obrok", "3/5 obrok", "4/5 obrok", "5/5 obrok"]);
    assert.equal(result.projectedRemainingDebtEur, 152);
    assert.equal(result.ledger.reduce(function (sum, row) { return sum - row.effectEur; }, 0), 80);
  }

  await assertFivePaymentTypoCase(
    "plačal je 40 prvi obrok in nato 4obroke vsak teden dni narazen v vrednosti 10 prvi obrok je plačal mesec dn nazaj",
    "mesec dn nazaj",
    "4obroke vsak teden dni narazen v vrednosti 10"
  );
  await assertFivePaymentTypoCase(
    "plačal je 40 prvi obrok in nato 4 obroke vsak teden dni narazen v vrednosti 10 prvi obrok je plačal mesec dni nazaj",
    "mesec dni nazaj",
    "4 obroke vsak teden dni narazen v vrednosti 10"
  );

  var exactTypoText = "plačal je 40 prvi obrok in nato 4obroke vsak teden dni narazen v vrednosti 10 prvi obrok je plačal mesec dn nazaj";
  var validTypoCards = fivePaymentTypoCards(exactTypoText, "mesec dn nazaj", "4obroke vsak teden dni narazen v vrednosti 10");
  var invalidOrdinalCards = JSON.parse(JSON.stringify(validTypoCards));
  invalidOrdinalCards.forEach(function (card, index) {
    card.f.find(function (field) { return field.i === 8; }).v = index === 0 ? "1/1 obrok" : index + "/4 obrok";
  });
  var ordinalRepairCalls = 0;
  var repairedOrdinal = await parser.analyze(exactTypoText, context, {
    apiKey: "test-only",
    fetchImpl: async function () {
      ordinalRepairCalls += 1;
      return response({ p: invalidOrdinalCards, q: null, x: null });
    },
  });
  assert.equal(ordinalRepairCalls, 1, "lokalni adapter ne sme ponovno presojati Luninih ordinalov");
  assert.equal(repairedOrdinal.semanticPlan.status, "OK");
  assert.equal(repairedOrdinal.semanticPlan.transport.semanticRetries, undefined);
  assert.equal(repairedOrdinal.semanticPlan.transport.repairReason, undefined);
  assert.deepEqual(repairedOrdinal.candidates.map(function (candidate) { return candidate.description; }), ["1/1 obrok", "1/4 obrok", "2/4 obrok", "3/4 obrok", "4/4 obrok"]);

  var partialAnchoredCadenceCards = JSON.parse(JSON.stringify(validTypoCards));
  partialAnchoredCadenceCards[2].f.find(function (field) { return field.i === 2; }).r = [];
  var anchoredCadenceRepairCalls = 0;
  var repairedAnchoredCadence = await parser.analyze(exactTypoText, context, {
    apiKey: "test-only",
    fetchImpl: async function () {
      anchoredCadenceRepairCalls += 1;
      return response({ p: partialAnchoredCadenceCards, q: null, x: null });
    },
  });
  assert.equal(anchoredCadenceRepairCalls, 1, "manjkajoča relacija se ne sme lokalno popravljati");
  assert.equal(repairedAnchoredCadence.semanticPlan.status, "OK");
  assert.equal(repairedAnchoredCadence.semanticPlan.transport.repairReason, undefined);
  assert.equal(repairedAnchoredCadence.candidates[2].dateRelation, null);

  var dateOnlyTypoCards = JSON.parse(JSON.stringify(validTypoCards));
  dateOnlyTypoCards.forEach(function (card) {
    card.f.find(function (field) { return field.i === 2; }).r = [];
  });
  var dateOnlyCadenceReviewCalls = 0;
  var repairedDateOnlyCadence = await parser.analyze(exactTypoText, context, {
    apiKey: "test-only",
    fetchImpl: async function () {
      dateOnlyCadenceReviewCalls += 1;
      return response({ p: dateOnlyTypoCards, q: null, x: null });
    },
  });
  assert.equal(dateOnlyCadenceReviewCalls, 1, "lokalni adapter ne sme zahtevati kadence");
  assert.equal(repairedDateOnlyCadence.semanticPlan.status, "OK");
  assert.ok(repairedDateOnlyCadence.candidates.every(function (candidate) { return candidate.dateRelation == null; }));

  var jsonRepairCalls = 0;
  var repairedJson = await parser.analyze(exactTypoText, context, {
    apiKey: "test-only",
    fetchImpl: async function () {
      jsonRepairCalls += 1;
      return { ok: true, status: 200, headers: { get: function () { return null; } }, json: async function () { return { output_text: "{" }; } };
    },
  });
  assert.equal(jsonRepairCalls, 1, "odrezan JSON je tehnična napaka brez semantičnega repair klica");
  assert.equal(repairedJson.semanticPlan.status, "FAILED");
  assert.equal(repairedJson.semanticPlan.reason, "luna_compact_invalid_json");
  assert.equal(repairedJson.semanticPlan.transport.repairReason, undefined);

  var approximateTypoCards = JSON.parse(JSON.stringify(validTypoCards));
  approximateTypoCards.forEach(function (card) {
    var dateField = card.f.find(function (field) { return field.i === 2; });
    dateField.r[1] = 612;
  });
  var precisionReviewCalls = 0;
  var repairedPrecision = await parser.analyze(exactTypoText, context, {
    apiKey: "test-only",
    fetchImpl: async function () {
      precisionReviewCalls += 1;
      return response({ p: approximateTypoCards, q: null, x: null });
    },
  });
  assert.equal(precisionReviewCalls, 1, "Lunina oznaka približnosti gre neposredno v pregled");
  assert.equal(repairedPrecision.semanticPlan.status, "OK");
  assert.equal(repairedPrecision.semanticPlan.transport.repairReason, undefined);
  assert.ok(repairedPrecision.candidates.every(function (candidate) { return candidate.occurredDateApproximate === true; }));

  function unanchoredCadenceCards(withCadence, sourceText) {
    return Array.from({ length: 4 }, function (_, index) {
      var fields = [
        { i: 1, v: 100, e: "100", r: [652] },
        { i: 8, v: (index + 1) + "/4 obrok", e: "4 obroke", r: [] },
      ];
      if (withCadence && index > 0) fields.push({ i: 2, v: null, e: "2tedna narazen", r: [601, 611, 622, 633, 2, 642, null] });
      return { n: index + 1, c: 3, e: sourceText, f: fields };
    });
  }

  var cadenceReviewText = "plačal je 4 obroke vsak obrok po 100 in vsak obrok 2tedna narazen";
  var cadenceReviewCalls = 0;
  var reviewedCadence = await parser.analyze(cadenceReviewText, {
    referenceDate: "2026-08-30", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only",
    fetchImpl: async function () {
      cadenceReviewCalls += 1;
      return response({ p: unanchoredCadenceCards(false, cadenceReviewText), q: null, x: null });
    },
  });
  assert.equal(cadenceReviewCalls, 1, "več obrokov brez relacij ne sme sprožiti lokalne ponovne presoje");
  assert.equal(reviewedCadence.semanticPlan.status, "OK");
  assert.ok(reviewedCadence.candidates.every(function (candidate) { return candidate.dateRelation == null; }));

  var firstRelationCards = unanchoredCadenceCards(true, cadenceReviewText);
  firstRelationCards[0].f.push({ i: 2, v: null, e: "2tedna narazen", r: [601, 611, 622, 633, 2, 642, null] });
  var firstRelationRepairCalls = 0;
  var repairedFirstRelation = await parser.analyze(cadenceReviewText, {
    referenceDate: "2026-08-30", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only",
    fetchImpl: async function () {
      firstRelationRepairCalls += 1;
      return response({ p: firstRelationCards, q: null, x: null });
    },
  });
  assert.equal(firstRelationRepairCalls, 1);
  assert.equal(repairedFirstRelation.semanticPlan.status, "OK");
  assert.equal(repairedFirstRelation.candidates[0].dateRelation.anchor, "previous_event");
  assert.equal(repairedFirstRelation.semanticPlan.transport.repairReason, undefined);

  var noCadenceReviewCalls = 0;
  var noCadenceText = "plačal je 4 obroke vsak obrok po 100, datumov se ne spomnim";
  var reviewedNoCadence = await parser.analyze(noCadenceText, {
    referenceDate: "2026-08-30", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only",
    fetchImpl: async function () {
      noCadenceReviewCalls += 1;
      return response({ p: unanchoredCadenceCards(false, noCadenceText), q: null, x: null });
    },
  });
  assert.equal(noCadenceReviewCalls, 1, "vir brez časovne kadence ne potrebuje drugega semantičnega klica");
  assert.equal(reviewedNoCadence.semanticPlan.status, "OK");
  assert.equal(reviewedNoCadence.semanticPlan.transport.repairReason, undefined);
  assert.ok(reviewedNoCadence.candidates.every(function (candidate) { return candidate.dateRelation == null; }), "Luna-only samopreverba ne sme izmišljati kadence, ki je v viru ni");

  var wordCadenceText = "plačal je 4 obroke vsak obrok po 100 na dva tedna";
  var wrongCadenceCards = unanchoredCadenceCards(true, wordCadenceText);
  var correctedWordCadenceCards = unanchoredCadenceCards(true, wordCadenceText);
  wrongCadenceCards.slice(1).forEach(function (card) {
    var dateField = card.f.find(function (field) { return field.i === 2; });
    dateField.e = "dva tedna";
    dateField.r[4] = 14;
  });
  correctedWordCadenceCards.slice(1).forEach(function (card) {
    card.f.find(function (field) { return field.i === 2; }).e = "dva tedna";
  });
  var cadenceNumberRepairCalls = 0;
  var repairedCadenceNumber = await parser.analyze(wordCadenceText, {
    referenceDate: "2026-08-30", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only",
    fetchImpl: async function () {
      cadenceNumberRepairCalls += 1;
      return response({ p: wrongCadenceCards, q: null, x: null });
    },
  });
  assert.equal(cadenceNumberRepairCalls, 1, "lokalna koda ne sme primerjati Lunine relacije z besedilom");
  assert.equal(repairedCadenceNumber.semanticPlan.status, "OK");
  assert.equal(repairedCadenceNumber.semanticPlan.transport.repairReason, undefined);
  assert.deepEqual(repairedCadenceNumber.candidates.slice(1).map(function (candidate) {
    return [candidate.dateRelation.amount, candidate.dateRelation.unit];
  }), [[14, "week"], [14, "week"], [14, "week"]]);

  function compactCard(number, cardId, evidence, amount, description) {
    var fields = [{ i: 1, v: amount, e: evidence, r: [] }];
    if (description) fields.push({ i: 8, v: description, e: evidence, r: [] });
    return { n: number, c: cardId, e: evidence, f: fields };
  }

  async function analyzeCompact(text, plan) {
    return parser.analyze(text, context, {
      apiKey: "test-only",
      fetchImpl: async function () { return response({ p: plan, q: null, x: null }); },
    });
  }

  var overpaid = await analyzeCompact(complexText, [
    compactCard(1, 3, complexText, 220, "1/4 obrok"),
    compactCard(2, 3, complexText, 10, "2/4 obrok"),
    compactCard(3, 3, complexText, 10, "3/4 obrok"),
    compactCard(4, 3, complexText, 10, "4/4 obrok"),
  ]);
  assert.equal(overpaid.semanticPlan.status, "OK");
  assert.equal(overpaid.semanticPlan.reason, "luna_compact_plan_applied");
  assert.equal(overpaid.candidates.length, 4, "Lunin znesek nad dolgom mora ostati v karticah za človeški pregled");
  assert.equal(overpaid.candidates.reduce(function (sum, candidate) { return sum + candidate.amount; }, 0), 250);
  assert.ok(overpaid.candidates.every(function (candidate) { return candidate.requiresHumanReview === true; }));
  assert.equal(overpaid.projectedRemainingDebtEur, 0);
  assert.equal(overpaid.clarification || null, null);

  var exactText = "plačal je 220 € in nato še 12 €";
  var exact = await analyzeCompact(exactText, [
    compactCard(1, 1, "plačal je 220 €", 220), compactCard(2, 1, "nato še 12 €", 12),
  ]);
  assert.equal(exact.semanticPlan.status, "OK");
  assert.equal(exact.candidates.length, 2);
  assert.equal(exact.projectedRemainingDebtEur, 0);

  var underText = "plačal je 220 € in nato še 10 €";
  var under = await analyzeCompact(underText, [
    compactCard(1, 1, "plačal je 220 €", 220), compactCard(2, 1, "nato še 10 €", 10),
  ]);
  assert.equal(under.semanticPlan.status, "OK");
  assert.equal(under.projectedRemainingDebtEur, 2);

  var centsText = "plačal je 231,99 € in nato še 0,01 €";
  var cents = await analyzeCompact(centsText, [
    compactCard(1, 1, "plačal je 231,99 €", 231.99), compactCard(2, 1, "nato še 0,01 €", 0.01),
  ]);
  assert.equal(cents.semanticPlan.status, "OK");
  assert.equal(cents.projectedRemainingDebtEur, 0, "seštevanje mora uporabljati cele cente brez floating-point ostanka");

  var missingAmountText = "plačal je 60 prvi obrok in nato 4obroke vsak teden";
  function hallucinatedMissingAmountCards(copiedEvidence) {
    return Array.from({ length: 5 }, function (_, index) {
      var first = index === 0;
      return {
        n: index + 1,
        c: 3,
        e: first ? "plačal je 60 prvi obrok" : "4obroke vsak teden",
        f: [
          { i: 1, v: first ? 60 : 25000, e: first || copiedEvidence ? "60" : "vsak teden", r: [] },
          { i: 8, v: (index + 1) + "/5 obrok", e: first ? "prvi obrok" : "4obroke", r: [] },
        ],
      };
    });
  }

  var fakeTotalCalls = 0;
  var fakeTotal = await parser.analyze(missingAmountText, context, {
    apiKey: "test-only",
    fetchImpl: async function () {
      fakeTotalCalls += 1;
      return response({ p: hallucinatedMissingAmountCards(false), q: null, x: null });
    },
  });
  assert.equal(fakeTotalCalls, 1, "lokalni adapter ne sme preverjati zneska proti evidence");
  assert.equal(fakeTotal.semanticPlan.status, "OK");
  assert.deepEqual(fakeTotal.candidates.map(function (candidate) { return candidate.amount; }), [60, 25000, 25000, 25000, 25000]);
  assert.ok(fakeTotal.candidates.every(function (candidate) { return candidate.requiresHumanReview === true; }));

  var copiedAmountCalls = 0;
  var copiedAmount = await parser.analyze(missingAmountText, context, {
    apiKey: "test-only",
    fetchImpl: async function () {
      copiedAmountCalls += 1;
      return response({ p: hallucinatedMissingAmountCards(true), q: null, x: null });
    },
  });
  assert.equal(copiedAmountCalls, 1);
  assert.equal(copiedAmount.semanticPlan.status, "OK");
  assert.deepEqual(copiedAmount.candidates.map(function (candidate) { return candidate.amount; }), [60, 25000, 25000, 25000, 25000]);

  var exhaustedCalls = 0;
  var exhausted = await parser.analyze(missingAmountText, {
    referenceDate: "2026-08-30", originalDebt: 232, remainingDebt: 232,
    clarification: {
      question: "Kolikšen je bil znesek vsakega od naslednjih štirih obrokov?",
      answer: "tega zneska ne vem",
      clauseId: "clause-1",
      round: 2,
    },
  }, {
    apiKey: "test-only",
    fetchImpl: async function () {
      exhaustedCalls += 1;
      return response({ p: [], q: "Ali lahko znesek še enkrat preverite?", x: "4obroke vsak teden" });
    },
  });
  assert.equal(exhaustedCalls, 1, "po drugem krogu ne sme biti tretjega modelskega nadaljevanja ali repair klica");
  assert.equal(exhausted.semanticPlan.status, "CLARIFICATION_EXHAUSTED");
  assert.equal(exhausted.clarification, null);

  var columnarPlan = [
    columnarCard(1, "plačal je 220 €", [{ i: 1, v: 220, e: "plačal je 220 €", r: [] }]),
    columnarCard(1, "nato še 12 €", [{ i: 1, v: 12, e: "nato še 12 €", r: [] }]),
  ];
  var columnar = await analyzeCompact(exactText, columnarPlan);
  assert.equal(columnar.semanticPlan.status, "OK");
  assert.deepEqual(columnar.candidates.map(function (candidate) { return candidate.cardNumber; }), [1, 2], "v98 inferira številke kartic iz vrstnega reda p");

  var unequalColumns = JSON.stringify({ p: [{ c: 1, e: "220 €", i: [1], v: [220], x: [], r: [[]] }], q: null, x: null });
  assert.equal(parser._test.parseLeanCompactPlan(unequalColumns, exactText).reason, "luna_compact_column_lengths");
  var duplicateColumns = JSON.stringify({ p: [{ c: 1, e: "220 €", i: [1, 1], v: [220, 220], x: ["220 €", "220 €"], r: [[], []] }], q: null, x: null });
  assert.equal(parser._test.parseLeanCompactPlan(duplicateColumns, exactText).reason, "luna_compact_field_duplicate");

  var sizeFields = [
    { i: 1, v: 10, e: "10", r: [] },
    { i: 2, v: "2026-08-01", e: "datum", r: [601, 611, 621, 631, 1, 642, null] },
    { i: 3, v: "2026-09-01", e: "rok", r: [601, 611, 621, 633, 1, 643, null] },
    { i: 4, v: 401, e: "nakazilo", r: [] },
    { i: 5, v: 501, e: "telefon", r: [] },
    { i: 6, v: "R-1", e: "R-1", r: [] },
    { i: 7, v: "razlog", e: "razlog", r: [] },
    { i: 8, v: "1/5 obrok", e: "obrok", r: [] },
  ];
  var legacyFive = { p: Array.from({ length: 5 }, function (_, index) { return { n: index + 1, c: 3, e: "kartica " + (index + 1), f: sizeFields }; }), q: null, x: null };
  var columnarFive = {
    p: legacyFive.p.map(function (card) { return columnarCard(card.c, card.e, card.f); }),
    q: null,
    x: null,
  };
  var legacyBytes = Buffer.byteLength(JSON.stringify(legacyFive), "utf8");
  var columnarBytes = Buffer.byteLength(JSON.stringify(columnarFive), "utf8");
  assert.ok(columnarBytes <= legacyBytes * 0.75, "v98 mora pet kartic zmanjšati vsaj za 25 %: " + legacyBytes + " -> " + columnarBytes);

  var benchmarkOutput = JSON.stringify({ p: columnarPlan, q: null, x: null });
  var adapterMs = [];
  for (var benchmarkIndex = 0; benchmarkIndex < 500; benchmarkIndex += 1) {
    var started = process.hrtime.bigint();
    var parsedPlan = parser._test.parseLeanCompactPlan(benchmarkOutput, exactText);
    var materializedPlan = parser._test.materializeLunaFieldPlan(parsedPlan, context, exactText, null);
    adapterMs.push(Number(process.hrtime.bigint() - started) / 1e6);
    assert.equal(materializedPlan.ok, true);
  }
  var adapterP50 = percentile(adapterMs, 0.50);
  var adapterP95 = percentile(adapterMs, 0.95);
  var adapterMax = Math.max.apply(Math, adapterMs);
  assert.ok(adapterP95 < 20 && adapterMax < 100, "lokalni v98 ID-adapter mora ostati hiter");

  console.log("PASS zgodovina latency policy: <16.5 KB z debt-first opozorilom, 1600-token rezerva, maxRounds=2, brez lokalnega semantičnega repaira, v98 " + legacyBytes + "->" + columnarBytes + " B, adapter p50=" + adapterP50.toFixed(3) + " ms p95=" + adapterP95.toFixed(3) + " ms max=" + adapterMax.toFixed(3) + " ms.");
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});
