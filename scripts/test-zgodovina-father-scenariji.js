"use strict";

var assert = require("node:assert/strict");
var factEngine = require("../api/_lib/zgodovina-fact-engine");
var parser = require("../api/_lib/zgodovina-naravni-vnos");

var FATHER_PHRASES = {
  partial: "plačal je 200 €",
  installment: "plačal je 400 € v 2 obrokih",
  unpaid_installment: "3. obrok ni plačan",
  payment_promised: "obljubil je, da bo plačal jutri",
  full: "račun je poravnan v celoti",
  payment_failed: "plačilo je bilo zavrnjeno",
  invoice_dispute: "dolžnik je vložil ugovor računu",
  credit_note: "izdan je dobropis 100 €",
  compensation: "izveden je pobot 100 €",
  cancelled_invoice: "račun je storniran",
  insolvency: "začet je stečajni postopek",
  collection_action: "pred tednom dni sem poslal opomin",
  collection_outcome: "pred tednom dni sem poslal opomin in dolžnik se ni več javil",
};

var EVENT_PHRASES = {
  partial_payment: "plačal je 200 €", paid_in_full: "račun je poravnan v celoti",
  installment_payment: "plačal je 400 € v 2 obrokih", unpaid_installment: "3. obrok ni plačan",
  remaining_unpaid: "preostanek znaša 500 €", installment_agreement: "dogovoril se je za 3 obroke",
  payment_promise: "obljubil je, da bo plačal jutri", deadline_extension: "odobren je dodatni rok",
  payment_failed: "plačilo je bilo zavrnjeno", invoice_dispute: "vložen je ugovor računu",
  insolvency: "začet je stečajni postopek", credit_note: "izdan je dobropis 100 €",
  compensation: "izveden je pobot 100 €", cancelled_invoice: "račun je storniran",
  debtor_statement: "dolžnik je rekel, da ne bo plačal", custom: "druga pomembna okoliščina",
  reminder_sent: "pred tednom dni sem poslal opomin",
};

function positiveCategories(text) {
  return factEngine.buildFactContract(text).fatherCategories;
}

function percentile(values, ratio) {
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function okReview(onCall) {
  return async function () {
    if (typeof onCall === "function") onCall();
    return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } };
  };
}

async function main() {
  var fathers = Object.keys(factEngine.FATHER_ONTOLOGY);
  assert.deepEqual(fathers.sort(), Object.keys(FATHER_PHRASES).sort(), "ontologija mora vsebovati vseh 13 FATHER kategorij");
  var eventTypes = new Set(["custom"]);
  fathers.forEach(function (father) {
    var rule = factEngine.FATHER_ONTOLOGY[father];
    assert.ok(rule.positive.length && rule.negative.length && rule.time.length && rule.amountRelation && Array.isArray(rule.conflicts));
    rule.eventTypes.forEach(function (type) { eventTypes.add(type); });
  });
  assert.deepEqual(Array.from(eventTypes).sort(), Object.keys(EVENT_PHRASES).sort(), "ontologija mora eksplicitno pokriti 17 event tipov");

  var checks = 0;
  Object.keys(EVENT_PHRASES).filter(function (type) { return type !== "custom"; }).forEach(function (type) {
    var expectedFather = factEngine.EVENT_TO_FATHER[type];
    [EVENT_PHRASES[type], EVENT_PHRASES[type] + ".", EVENT_PHRASES[type].toUpperCase()].forEach(function (text) {
      assert.ok(positiveCategories(text).includes(expectedFather), type + " mora odkriti " + expectedFather);
      checks += 1;
    });
  });

  for (var i = 0; i < fathers.length; i += 1) {
    for (var j = i + 1; j < fathers.length; j += 1) {
      [FATHER_PHRASES[fathers[i]] + ". Nato " + FATHER_PHRASES[fathers[j]], FATHER_PHRASES[fathers[j]] + "; potem " + FATHER_PHRASES[fathers[i]]].forEach(function (text) {
        var found = positiveCategories(text);
        assert.ok(found.includes(fathers[i]) && found.includes(fathers[j]), "pair ne sme izgubiti FATHER kategorije: " + text);
        checks += 1;
      });
    }
  }

  for (var a = 0; a < fathers.length; a += 1) {
    for (var b = a + 1; b < fathers.length; b += 1) {
      for (var c = b + 1; c < fathers.length; c += 1) {
        var multi = FATHER_PHRASES[fathers[a]] + ". Nato " + FATHER_PHRASES[fathers[b]] + "; potem " + FATHER_PHRASES[fathers[c]];
        var multiFound = positiveCategories(multi);
        assert.ok([fathers[a], fathers[b], fathers[c]].every(function (father) { return multiFound.includes(father); }), "multi-clause izguba kategorije");
        checks += 1;
      }
    }
  }

  var exactInputs = [
    "plačal je 3000 v 4ih obrokih.. in na to pa 1000 v dobropisu",
    "plačal je 3000 v 4ih obrokih nato 1000 dobropisa",
    "plačal je 3000 v 4ih obrokih in na to pa 1000 v dobropisu",
    "plačal je 3000 v 4ih obrokih potem še dobropis 1000 €",
  ];
  for (var exactIndex = 0; exactIndex < exactInputs.length; exactIndex += 1) {
    var exact = await parser.analyze(exactInputs[exactIndex], { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 }, {
      apiKey: "test-only", fetchImpl: okReview(),
    });
    assert.deepEqual(exact.candidates.map(function (event) { return [event.type, event.amount]; }), [
      ["installment_payment", 750], ["installment_payment", 750], ["installment_payment", 750], ["installment_payment", 750], ["credit_note", 1000],
    ], "clause extraction mora ohraniti štiri obroke in dobropis");
    assert.equal(exact.projectedRemainingDebtEur, 5446);
    assert.equal(exact.fieldOrder.length, 5);
    assert.equal(exact.requiredFields.length, 5);
    assert.equal(exact.missing.length, 5);
    checks += 8;
  }

  var countFormsA = ["2", "dva", "dve"];
  var countFormsB = ["2", "dva"];
  var amountFormsA = ["300", "tristo"];
  var amountFormsB = ["500", "petsto"];
  var connectors = [" potem ", " nato "];
  var firstNouns = ["", " obroka"];
  countFormsA.forEach(function (countA) {
    countFormsB.forEach(function (countB) {
      amountFormsA.forEach(function (amountA) {
        amountFormsB.forEach(function (amountB) {
          connectors.forEach(function (connector) {
            firstNouns.forEach(function (firstNoun) {
              var text = "plačal je " + countA + firstNoun + " po " + amountA + " evrov" + connector + countB + " obroka po " + amountB + " ostalo ni plačal";
              var result = parser._test.deterministicResult(text, { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
              assert.deepEqual(result.candidates.map(function (event) { return [event.type, event.amount]; }), [
                ["installment_payment", 300], ["installment_payment", 300],
                ["installment_payment", 500], ["installment_payment", 500],
                ["remaining_unpaid", 7846],
              ], "mešani zapis skupin mora ohraniti count in amount: " + text);
              assert.deepEqual(result.ledger.map(function (entry) { return entry.afterEur; }), [9146, 8846, 8346, 7846, 7846]);
              assert.equal(result.questionPlan.length, 4, "UI mora vprašati samo za manjkajoče podatke štirih plačil");
              var groupContract = factEngine.buildFactContract(text);
              assert.deepEqual(groupContract.installmentGroups.map(function (group) { return [group.count, group.amount, group.completed]; }), [[2, 300, true], [2, 500, true]]);
              checks += 4;
            });
          });
        });
      });
    });
  });

  [
    ["2", 2, true], ["2h", 2, true], ["dva", 2, true], ["dve", 2, true], ["dveh", 2, true],
    ["tristo", 300, false], ["petsto", 500, false], ["dva tisoč petsto", 2500, false],
  ].forEach(function (entry) {
    assert.equal(parser._test.parseSlovenianNumber(entry[0], { count: entry[2] }), entry[1], "številska in besedna oblika morata biti enakovredni: " + entry[0]);
    checks += 1;
  });

  var amountForms = [
    { text: "300", value: 300, family: "digit" },
    { text: "tristo", value: 300, family: "word" },
    { text: "2 tisoč 500", value: 2500, family: "mixed" },
    { text: "tristotih", value: 300, family: "inflected" },
  ];
  var fatherAmountCases = {
    partial: { type: "partial_payment", phrase: function (amount) { return "plačal je " + amount; }, effect: "subtract" },
    installment: { type: "installment_payment", phrase: function (amount) { return "plačal je 2 obroka po " + amount; }, effect: "subtract_twice" },
    unpaid_installment: { type: "remaining_unpaid", phrase: function (amount) { return "preostanek znaša " + amount; }, effect: "none" },
    payment_promised: { type: "payment_promise", phrase: function (amount) { return "obljubil je, da bo plačal " + amount; }, effect: "none" },
    full: { type: "paid_in_full", phrase: function (amount) { return "račun v vrednosti " + amount + " je poravnan v celoti"; }, effect: "full" },
    payment_failed: { type: "payment_failed", phrase: function (amount) { return "plačilo " + amount + " je bilo zavrnjeno"; }, effect: "none" },
    invoice_dispute: { type: "invoice_dispute", phrase: function (amount) { return "dolžnik ugovarja računu za " + amount; }, effect: "none" },
    credit_note: { type: "credit_note", phrase: function (amount) { return "izdan je dobropis " + amount; }, effect: "subtract" },
    compensation: { type: "compensation", phrase: function (amount) { return "izveden je pobot " + amount; }, effect: "subtract" },
    cancelled_invoice: { type: "cancelled_invoice", phrase: function (amount) { return "račun v vrednosti " + amount + " je storniran"; }, effect: "none" },
    insolvency: { type: "insolvency", phrase: function (amount) { return "za terjatev " + amount + " je začet stečajni postopek"; }, effect: "none" },
  };
  var matrixChecks = 0;
  var amountFathers = fathers.filter(function (father) { return !["collection_action", "collection_outcome"].includes(father); });
  for (var amountFatherIndex = 0; amountFatherIndex < amountFathers.length; amountFatherIndex += 1) {
    var amountFather = amountFathers[amountFatherIndex];
    var amountCase = fatherAmountCases[amountFather];
    for (var amountFormIndex = 0; amountFormIndex < amountForms.length; amountFormIndex += 1) {
      var amountForm = amountForms[amountFormIndex];
      for (var currencyIndex = 0; currencyIndex < 2; currencyIndex += 1) {
        for (var punctuationIndex = 0; punctuationIndex < 2; punctuationIndex += 1) {
          var currencySuffix = currencyIndex === 0 ? " evrov" : "";
          var punctuation = punctuationIndex === 0 ? "." : "!";
          var matrixText = amountCase.phrase(amountForm.text + currencySuffix) + punctuation;
          var matrixContract = factEngine.buildFactContract(matrixText);
          var matrixMoneyFact = matrixContract.facts.find(function (fact) {
            return fact.kind === "money" && fact.value === amountForm.value && fact.sourceSpan && fact.sourceSpan.text === amountForm.text;
          });
          assert.ok(matrixContract.fatherCategories.includes(amountFather), amountFather + " mora ostati odkrit: " + matrixText);
          assert.ok(matrixMoneyFact, amountForm.family + " znesek mora imeti enak money fact in evidence span: " + matrixText);
          assert.equal(matrixMoneyFact.currency, currencySuffix ? "EUR" : null, "izpuščena valuta mora ostati semantična, ne izmišljeno eksplicitna");
          var matrixProviderCalls = 0;
          var matrixLocal = parser._test.deterministicResult(matrixText, { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
          var expectedMatrixCalls = parser._test.shouldRequestSemanticPlan(matrixText, matrixContract, matrixLocal) ? 1 : 0;
          var matrixResult = await parser.analyze(matrixText, { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 }, {
            apiKey: "test-only", fetchImpl: okReview(function () { matrixProviderCalls += 1; }),
          });
          assert.equal(matrixProviderCalls, expectedMatrixCalls, "planner odločitev mora biti enaka za vse denarne FATHER kategorije");
          if (amountFather === "full" && amountForm.value !== 9446) {
            assert.deepEqual(matrixResult.candidates, [], "'v celoti' z zneskom, ki se ne ujema s saldom, mora zahtevati pojasnilo");
            assert.equal(matrixResult.coverage.complete, false);
            assert.equal(matrixResult.projectedRemainingDebtEur, 9446);
            matrixChecks += 9;
            continue;
          }
          assert.ok(matrixResult.candidates.some(function (event) { return event.fatherCategory === amountFather; }), "kandidat mora ohraniti FATHER kategorijo: " + matrixText);
          assert.equal(matrixResult.requiredFields.length, matrixResult.candidates.length);
          assert.equal(matrixResult.questionPlan.length, matrixResult.candidates.filter(function (event) { return event.missing.length; }).length);
          var expectedBalance = amountCase.effect === "subtract" ? 9446 - amountForm.value
            : amountCase.effect === "subtract_twice" ? 9446 - amountForm.value * 2
              : amountCase.effect === "full" ? 0 : 9446;
          assert.equal(matrixResult.projectedRemainingDebtEur, expectedBalance, "ledger učinek mora slediti kategoriji, ne obliki zapisa: " + matrixText);
          assert.ok(matrixResult.ledger.every(function (entry) { return entry.afterEur >= 0; }), "ledger ne sme postati negativen");
          matrixChecks += 9;
        }
      }
    }

    var staleText = amountCase.phrase("tristo evrov");
    var staleResult = parser.normalizeResult({ summary: "zastarel predlog", events: [{
      type: amountCase.type, repeat: 1, amount: 9999, currency: "EUR", confidence: "low",
    }] }, 9446, { text: staleText, referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
    assert.ok(staleResult.candidates.some(function (event) { return event.fatherCategory === amountFather; }), "deterministični resolver mora ohraniti pravi FATHER");
    assert.ok(!staleResult.candidates.some(function (event) { return event.amount === 9999; }), "zastarel modelski znesek mora biti zavrnjen: " + staleText);
    assert.ok(staleResult.ledger.every(function (entry) { return entry.afterEur >= 0; }), "modelski predlog ne sme prebiti ledger meje");
    matrixChecks += 3;
  }

  var numberNoise = parser._test.extractNumberExpressions("dne 27. 8. 2026, 3. opomin, ponovljeno 4-krat, račun št. 8452");
  assert.deepEqual(numberNoise.map(function (item) { return item.role; }), ["date", "date", "date", "ordinal", "count", "reference"], "datum, ordinal, ponovitev in številka računa ne smejo postati denar");
  fathers.forEach(function (father) {
    var noiseText = FATHER_PHRASES[father] + "; dne 27. 8. 2026, 3. opomin, ponovljeno 4-krat, račun št. 8452";
    var noiseContract = factEngine.buildFactContract(noiseText);
    assert.ok(!noiseContract.facts.some(function (fact) { return fact.kind === "money" && [27, 8, 2026, 3, 4, 8452].includes(fact.value); }), "numerični šum ne sme postati money fact: " + father);
    matrixChecks += 1;
  });

  var conflictText = "plačal je tristo evrov; nato dolžnik ugovarja računu za petsto evrov";
  var conflictResult = parser._test.deterministicResult(conflictText, { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.deepEqual(conflictResult.candidates.map(function (event) { return [event.type, event.amount]; }), [["partial_payment", 300], ["invoice_dispute", 500]]);
  assert.equal(conflictResult.projectedRemainingDebtEur, 9146, "ugovarjani znesek je dejstvo, vendar ne sme zmanjšati dolga");
  matrixChecks += 2;
  checks += matrixChecks;

  var futureInstallments = parser._test.deterministicResult("dogovoril se je za 2 obroka po 500 evrov", { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.ok(!futureInstallments.candidates.some(function (event) { return event.type === "installment_payment"; }), "prihodnji obročni dogovor ne sme postati izvedeno plačilo");
  assert.ok(futureInstallments.candidates.some(function (event) { return event.type === "installment_agreement"; }), "prihodnji obročni dogovor mora ostati dogovor");
  checks += 2;

  var promisedCreditInputs = [
    "3000 evrov je dal kot prvi obrok, 2000 evrov kot drugi, potem mi je obljubljal dobropis, ampak na koncu nič več.",
    "prvi obrok je bil 3000 evrov, drugi 2000 evrov; obljubil je dobropis, nato nič več",
    "3000 EUR kot prvi, 2000 EUR kot drugi obrok, dobropis je samo obljubil, na koncu nič več",
  ];
  for (var promisedCreditIndex = 0; promisedCreditIndex < promisedCreditInputs.length; promisedCreditIndex += 1) {
    var promisedCreditCalls = 0;
    var promisedCredit = await parser.analyze(promisedCreditInputs[promisedCreditIndex], { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 }, {
      apiKey: "test-only", fetchImpl: okReview(function () { promisedCreditCalls += 1; }),
    });
    assert.equal(promisedCreditCalls, 1, "večdelni ordinalni tok mora zahtevati semantični plan");
    assert.deepEqual(promisedCredit.candidates.map(function (event) { return [event.type, event.amount]; }), [
      ["installment_payment", 3000], ["installment_payment", 2000], ["payment_promise", null], ["unpaid_installment", null],
    ], "obljuba dobropisa mora biti dogodek brez vpliva na saldo, ordinalna obroka pa morata ohraniti svoja zneska");
    assert.equal(promisedCredit.candidates[2].description, "Dolžnik je obljubil dobropis.");
    assert.equal(promisedCredit.projectedRemainingDebtEur, 4446);
    var promisedCreditFact = factEngine.buildFactContract(promisedCreditInputs[promisedCreditIndex]).facts.find(function (fact) { return fact.category === "credit_note"; });
    assert.equal(promisedCreditFact && promisedCreditFact.assertion, "proposed", "dobropis v dosegu obljube mora biti označen kot predlagan, ne izveden");
    checks += 5;
  }

  var proposalMatrix = {
    partial: "obljubil je, da bo plačal 100 €",
    installment: "obljubil je prvi obrok",
    unpaid_installment: "napovedal je neplačan preostanek",
    full: "obljubil je plačilo v celoti",
    payment_failed: "banka je napovedala, da bo plačilo zavrnjeno",
    invoice_dispute: "napovedal je ugovor računu",
    credit_note: "obljubil mi je dobropis 1000 €",
    compensation: "predlagal je pobot 1000 €",
    cancelled_invoice: "napovedal je, da bo račun storniran",
    insolvency: "napovedal je stečajni postopek",
  };
  Object.keys(proposalMatrix).forEach(function (father) {
    var proposalContract = factEngine.buildFactContract(proposalMatrix[father]);
    assert.ok(proposalContract.facts.some(function (fact) { return fact.category === father && fact.assertion === "proposed" && fact.reason === "proposed_not_occurred"; }), father + " mora razlikovati napoved od izvedenega dogodka");
    assert.ok(!proposalContract.fatherCategories.includes(father), father + " v prihodnjem/predlaganem kontekstu ne sme postati izvedena kartica");
    checks += 2;
  });
  assert.ok(positiveCategories("obljubil je, da bo plačal").includes("payment_promised"), "sama dana obljuba plačila ostane dejanski dogodek obljube");
  assert.ok(positiveCategories("izdal je dobropis 1000 €").includes("credit_note"), "dejansko izdani dobropis mora ostati izveden dogodek");
  assert.ok(positiveCategories("izveden je pobot 1000 €").includes("compensation"), "dejansko izvedeni pobot mora ostati izveden dogodek");
  checks += 3;

  var unfulfilledPromiseInputs = [
    "plačal je 4000evrov nato pa obljublal non stop da bo plačal in nikoli ni",
    "plačal je 4000 evrov, nato je vedno znova obljubljal, da bo plačal, vendar nikoli ni",
    "nakazal 4000 €, potem večkrat rekel da poravna, pa ni",
    "plačal 4000, obljube ni držal",
    "poravnal je 4.000 nato trdil da bo plačal ampak nikoli ni",
  ];
  for (var promiseIndex = 0; promiseIndex < unfulfilledPromiseInputs.length; promiseIndex += 1) {
    var providerCalls = 0;
    var promiseResult = await parser.analyze(unfulfilledPromiseInputs[promiseIndex], { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 }, {
      apiKey: "test-only", fetchImpl: okReview(function () { providerCalls += 1; }),
    });
    assert.equal(providerCalls, 1, "plačilo + neizpolnjena obljuba mora zahtevati semantični plan");
    assert.deepEqual(promiseResult.candidates.map(function (event) { return event.type; }), ["partial_payment", "payment_promise", "remaining_unpaid"]);
    assert.equal(promiseResult.candidates[0].amount, 4000);
    assert.equal(promiseResult.candidates[1].amount, null, "besede, kot je 'non stop', ne smejo postati znesek obljube");
    assert.equal(promiseResult.candidates[2].amount, 5446);
    assert.equal(promiseResult.projectedRemainingDebtEur, 5446, "obljuba in neplačani preostanek ne smeta drugič zmanjšati dolga");
    checks += 6;
  }

  var fatherFastPathPhrases = Object.assign({}, FATHER_PHRASES, { payment_promised: "obljubljal je, da bo plačal" });
  for (var fatherIndex = 0; fatherIndex < fathers.length; fatherIndex += 1) {
    var expectedFather = fathers[fatherIndex];
    var fastPathCalls = 0;
    var fastPathText = fatherFastPathPhrases[expectedFather];
    var fastPathContract = factEngine.buildFactContract(fastPathText);
    var fastPathLocal = parser._test.deterministicResult(fastPathText, { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
    var expectedFastPathCalls = parser._test.shouldRequestSemanticPlan(fastPathText, fastPathContract, fastPathLocal) ? 1 : 0;
    var fastPathResult = await parser.analyze(fastPathText, { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 }, {
      apiKey: "test-only", fetchImpl: okReview(function () { fastPathCalls += 1; }),
    });
    assert.equal(fastPathCalls, expectedFastPathCalls, expectedFather + " mora slediti skupni planner odločitvi");
    assert.ok(fastPathResult.candidates.some(function (event) { return event.fatherCategory === expectedFather; }), expectedFather + " mora ohraniti svoj kandidat tudi z manjkajočimi polji");
    checks += 2;
  }

  var negatedPaymentPromise = await parser.analyze("ni plačal 4000, samo obljubljal je", { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 }, {
    apiKey: "test-only", fetchImpl: okReview(),
  });
  assert.deepEqual(negatedPaymentPromise.candidates.map(function (event) { return event.type; }), ["payment_promise"]);
  assert.equal(negatedPaymentPromise.candidates[0].amount, null, "znesek zanikanega plačila ne sme biti ukraden obljubi");
  assert.equal(negatedPaymentPromise.projectedRemainingDebtEur, 9446);
  checks += 3;

  var hallucinated = parser.normalizeResult({ summary: "staro", events: [
    { type: "installment_payment", repeat: 4, amount: 1000, confidence: "low" },
    { type: "credit_note", repeat: 1, amount: 50, confidence: "low" },
  ] }, 9446, { text: exactInputs[0], referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 });
  assert.deepEqual(hallucinated.candidates.map(function (event) { return event.amount; }), [750, 750, 750, 750, 1000], "eksplicitna span dejstva morajo popraviti zastarel modelski predlog");
  assert.equal(hallucinated.projectedRemainingDebtEur, 5446);

  var negated = parser.normalizeResult({ summary: "halucinacija", events: [{ type: "partial_payment", repeat: 1, amount: 500, confidence: "low" }] }, 1000, {
    text: "ni plačal 500 €", referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 1000,
  });
  assert.equal(negated.candidates.length, 0, "zanikano plačilo mora odstraniti modelsko halucinacijo");
  assert.equal(negated.projectedRemainingDebtEur, 1000);

  var future = parser.normalizeResult({ summary: "prihodnost", events: [{ type: "partial_payment", repeat: 1, amount: 500, occurredDate: "2026-08-28", confidence: "low" }] }, 1000, {
    text: "plačal bo jutri 500 €", referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 1000,
  });
  assert.equal(future.projectedRemainingDebtEur, 1000, "prihodnji dogodek ne sme zmanjšati salda");
  assert.equal(future.candidates[0].temporalStatus, "planned");

  var timings = [];
  for (var run = 0; run < 500; run += 1) {
    var started = performance.now();
    factEngine.buildFactContract(FATHER_PHRASES[fathers[run % fathers.length]] + ". Nato " + FATHER_PHRASES[fathers[(run + 3) % fathers.length]]);
    timings.push(performance.now() - started);
  }
  assert.ok(percentile(timings, 0.95) < 20 && Math.max.apply(Math, timings) < 100, "lokalna segmentacija mora ostati hitra");
  console.log("✓ FATHER V2 matrika: " + checks + " generiranih preveritev, 13 kategorij, 17 tipov; p95 " + percentile(timings, 0.95).toFixed(2) + " ms");
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
