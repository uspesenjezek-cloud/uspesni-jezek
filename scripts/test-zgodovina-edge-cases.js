"use strict";

var assert = require("node:assert");
var parser = require("../api/_lib/zgodovina-naravni-vnos");

var context = { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 };
var checks = 0;

function parse(text) {
  return parser._test.deterministicResult(text, context);
}

function assertSequence(text, first, second, remaining) {
  var result = parse(text);
  assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }), [
    "partial_payment", "partial_payment", "remaining_unpaid",
  ], "napačne kartice: " + text);
  assert.deepEqual(result.candidates.map(function (candidate) { return candidate.amount; }), [first, second, remaining], "napačni zneski: " + text);
  assert.equal(result.projectedRemainingDebtEur, remaining, "napačen ledger: " + text);
  assert.ok(result.candidates.slice(0, 2).every(function (candidate) { return candidate.paymentMethod === null; }), "izmišljen način plačila: " + text);
  checks += 4;
}

var verbs = ["plačal je", "plačala je", "poravnal je", "dal je"];
var connectors = ["nato", "potem", "zatem", "kasneje", "pozneje", "in še"];
var endings = [
  "potem pa me je skenslal",
  "in se ne javlja",
  "nato me je blokiral",
  "potem me ignorira",
  "nato nič več",
  "potem pa ni več plačal",
];

verbs.forEach(function (verb) {
  connectors.forEach(function (connector) {
    endings.forEach(function (ending) {
      assertSequence(verb + " 2000 evrov " + connector + " 1000 evrov " + ending, 2000, 1000, 6446);
    });
  });
});

[
  ["plačal je 2.000 evrov nato 1.000 evrov potem nič več", 2000, 1000, 6446],
  ["plačal je 2 000 evrov nato 1 000 evrov potem nič več", 2000, 1000, 6446],
  ["plačal je 2000,50 evra nato 1000,25 evra potem nič več", 2000.5, 1000.25, 6445.25],
].forEach(function (entry) { assertSequence(entry[0], entry[1], entry[2], entry[3]); });

var methods = parse("plačal je 2000 evrov s kartico, nato 1000 evrov v gotovini, potem se ne javlja");
assert.deepEqual(methods.candidates.slice(0, 2).map(function (candidate) { return candidate.paymentMethod; }), ["card", "cash"]);
checks += 1;

var dates = parse("plačal je 2000 evrov včeraj, nato 1000 evrov danes, potem se ne javlja");
assert.deepEqual(dates.candidates.slice(0, 2).map(function (candidate) { return candidate.occurredDate; }), ["2026-08-26", "2026-08-27"]);
checks += 1;

var creditNote = parse("plačal je 2000 evrov, nato dobropis 1000 evrov");
assert.deepEqual(creditNote.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "credit_note"]);
assert.deepEqual(creditNote.candidates.map(function (candidate) { return candidate.amount; }), [2000, 1000]);
checks += 2;

var promise = parse("plačal je 2000 evrov, nato obljubil 1000 evrov do jutri");
assert.deepEqual(promise.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "payment_promise"]);
checks += 1;

var noCurrencyContinuation = parse("plačal je 2000 evrov nato 1000 dni ni bilo odgovora");
assert.equal(noCurrencyContinuation.candidates.filter(function (candidate) { return candidate.type === "partial_payment"; }).length, 1);
checks += 1;

var ambiguousSum = parse("plačal je 2000 in 1000 evrov");
assert.ok(ambiguousSum.candidates.filter(function (candidate) { return candidate.type === "partial_payment"; }).length <= 1);
checks += 1;

var hallucinated = parser.normalizeResult({ summary: "napačno", events: [
  { type: "partial_payment", amount: 2000, paymentMethod: "card", occurredDate: "2026-08-26" },
  { type: "insolvency", description: "Izmišljeno." },
] }, 9446, Object.assign({ text: "plačal je 2000 evrov nato 1000 evrov potem pa me je skenslal" }, context));
assert.deepEqual(hallucinated.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
  ["partial_payment", 2000], ["partial_payment", 1000], ["remaining_unpaid", 6446],
]);
assert.ok(hallucinated.candidates.slice(0, 2).every(function (candidate) { return candidate.paymentMethod === null && candidate.occurredDate === null; }));
assert.ok(hallucinated.diagnostics.includes("unsupported_father_rejected:insolvency"));
checks += 3;

var future = parser.normalizeResult({ summary: "prihodnost", events: [
  { type: "partial_payment", amount: 500, occurredDate: "2026-08-28" },
] }, 1000, { text: "plačal bo jutri 500 €", referenceDate: "2026-08-27", originalDebt: 1000, remainingDebt: 1000 });
assert.equal(future.projectedRemainingDebtEur, 1000);
assert.equal(future.candidates[0].temporalStatus, "planned");
checks += 2;

function assertPromisePaymentSequence(text, expectedPromiseAmount, expectedRemaining) {
  var result = parse(text);
  assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }), [
    "partial_payment", "payment_promise", "remaining_unpaid",
  ], "izvedeno plačilo mora biti pred obljubo in preostankom: " + text);
  assert.equal(result.candidates[0].amount, 4000, "4000 mora ostati izvedeno plačilo: " + text);
  assert.equal(result.candidates[1].amount, expectedPromiseAmount, "obljuba ne sme ukrasti zneska drugega dogodka: " + text);
  assert.equal(result.candidates[2].amount, expectedRemaining, "napačen neplačani preostanek: " + text);
  assert.equal(result.projectedRemainingDebtEur, expectedRemaining, "ledger sme zmanjšati samo izvedeno plačilo: " + text);
  checks += 5;
}

var promiseVerbs = ["rekel da bo plačal", "povedal da bo plačal", "obljubil da bo plačal"];
var remainingWords = ["ostalo", "preostanek", "preostalo"];
var failedConnectors = ["ampak ni nič potem", "vendar ni plačal", "pa nobenega plačila"];
promiseVerbs.forEach(function (promiseVerb) {
  remainingWords.forEach(function (remainingWord) {
    failedConnectors.forEach(function (failedConnector) {
      assertPromisePaymentSequence("plačal je 4000 evrov, " + remainingWord + " pa je " + promiseVerb + ", " + failedConnector, 5446, 5446);
    });
  });
});

["potem", "nato", "zatem", "na koncu"].forEach(function (connector) {
  ["obljubil je plačilo", "rekel je da bo plačal", "povedal je da bo plačal"].forEach(function (promiseText) {
    var result = parse(promiseText + ", " + connector + " je pa plačal samo 4000€");
    assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }), ["payment_promise", "partial_payment", "remaining_unpaid"], "poznejše plačilo ne sme biti zaradi display prioritete prestavljeno pred starejšo obljubo");
    assert.deepEqual(result.candidates.map(function (candidate) { return candidate.amount; }), [null, 4000, 5446]);
    assert.equal(result.projectedRemainingDebtEur, 5446);
    checks += 3;
  });
});

var onlyPayment = parse("plačal je 4000 evrov");
assert.deepEqual(onlyPayment.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment"]);
var onlyPromise = parse("obljubil je da bo plačal 4000 evrov");
assert.deepEqual(onlyPromise.candidates.map(function (candidate) { return candidate.type; }), ["payment_promise"]);
var fulfilledPromise = parse("obljubil je 4000 evrov, nato je plačal 4000 evrov");
assert.deepEqual(fulfilledPromise.candidates.map(function (candidate) { return candidate.type; }), ["payment_promise", "partial_payment"]);
assert.equal(fulfilledPromise.candidates[1].amount, 4000);
assert.equal(fulfilledPromise.projectedRemainingDebtEur, 5446);
checks += 5;

var multiplierPhrases = [
  ["2x po 2000 evrov", 2, 2000, 5446], ["2 x po 2000 EUR", 2, 2000, 5446],
  ["2-krat po 2000 evrov", 2, 2000, 5446], ["dvakrat po 2000 evrov", 2, 2000, 5446],
  ["3x po 1000 evrov", 3, 1000, 6446], ["3 x vsak po 1000 EUR", 3, 1000, 6446],
  ["trikrat po 1000 evrov", 3, 1000, 6446], ["tri obroke po 1000 evrov", 3, 1000, 6446],
];
multiplierPhrases.forEach(function (entry) {
  var result = parse("plačal je " + entry[0] + " in potem nič več");
  assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }), Array(entry[1]).fill("installment_payment").concat("remaining_unpaid"), "množitelj mora materializirati vsa plačila: " + entry[0]);
  assert.deepEqual(result.candidates.slice(0, entry[1]).map(function (candidate) { return candidate.amount; }), Array(entry[1]).fill(entry[2]));
  assert.equal(result.candidates[result.candidates.length - 1].amount, entry[3]);
  assert.equal(result.projectedRemainingDebtEur, entry[3]);
  assert.ok(result.candidates.every(function (candidate) { return candidate.paymentMethod == null && candidate.communicationChannel == null; }));
  checks += 5;
});

["model X2000 je bil dobavljen", "poslal je 2x opomin", "račun x po pošti 2000 evrov"].forEach(function (text) {
  assert.equal(parser._test.inferInstallmentBreakdown(text), null, "x brez lokalnega 'po znesku' ni množitelj: " + text);
  checks += 1;
});

var mixedInstallments = parse("plačal je najprej 2 obroka po 300 evrov nato pa še en obrok 1000 evrov in potem nič več");
assert.deepEqual(mixedInstallments.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
  ["installment_payment", 300], ["installment_payment", 300], ["installment_payment", 1000], ["remaining_unpaid", 7846],
]);
assert.deepEqual(mixedInstallments.ledger.map(function (entry) { return entry.afterEur; }), [9146, 8846, 7846, 7846]);
assert.equal(mixedInstallments.questionPlan.length, 3);
checks += 3;

[
  ["čez 2 meseca", 1, 2, "month"],
  ["čez mesec dni", 1, 1, "month"],
  ["čez teden dni", 1, 1, "week"],
  ["dva meseca kasneje", 1, 2, "month"],
  ["mesec kasneje", 1, 1, "month"],
  ["tri tedne pozneje", 1, 3, "week"],
  ["10 dni po tem", 1, 10, "day"],
  ["po štirih letih", 1, 4, "year"],
  ["po mesecu dni", 1, 1, "month"],
  ["en mesec prej", -1, 1, "month"],
  ["mesec prej", -1, 1, "month"],
  ["dva tedna pred tem", -1, 2, "week"],
  ["teden dni pred tem", -1, 1, "week"],
  ["za pet dni nazaj", -1, 5, "day"],
  ["za leto dni nazaj", -1, 1, "year"],
].forEach(function (entry) {
  var text = "plačal je 100 evrov potem pa " + entry[0] + " je plačal 200 evrov";
  var contract = parser._test.buildFactContract(text);
  var result = parse(text);
  var relationFact = contract.facts.find(function (fact) { return fact.kind === "date_relation"; });
  assert.ok(relationFact, "manjka date_relation fact: " + entry[0]);
  assert.deepEqual([relationFact.relation.direction, relationFact.relation.amount, relationFact.relation.unit], entry.slice(1));
  assert.ok(!contract.facts.some(function (fact) { return fact.kind === "money" && fact.value === entry[2]; }), "časovni števec ne sme biti money fact: " + entry[0]);
  assert.deepEqual(result.candidates.map(function (candidate) { return candidate.amount; }), [100, 200]);
  assert.deepEqual([result.candidates[1].dateRelation.direction, result.candidates[1].dateRelation.amount, result.candidates[1].dateRelation.unit], entry.slice(1));
  checks += 5;
});

[
  ["2 mesca nazaj", 2], ["dva mesca nazaj", 2], ["3 mesce nazaj", 3],
  ["štiri mesce nazaj", 4], ["5 mescov nazaj", 5], ["6 mescih nazaj", 6],
].forEach(function (entry) {
  var text = entry[0] + " je plačal 3000";
  var contract = parser._test.buildFactContract(text);
  var relation = contract.facts.find(function (fact) { return fact.kind === "date_relation"; });
  assert.ok(relation, "pogovorna oblika meseca mora ostati časovni dokaz: " + text);
  assert.deepEqual([relation.relation.direction, relation.relation.amount, relation.relation.unit], [-1, entry[1], "month"]);
  assert.deepEqual(contract.facts.filter(function (fact) { return fact.kind === "money"; }).map(function (fact) { return fact.value; }), [3000]);
  var result = parse(text);
  assert.equal(result.candidates[0].amount, 3000);
  assert.equal(result.coverage.complete, true);
  checks += 5;
});

[
  ["dolznik je plačal prvi obrok 100 nato je plačal čez 2 tedna 300 nato pa čez mesec dni še 5000", [100, 300, 5000], [[2, "week"], [1, "month"]]],
  ["plačal je obrok 100 potem čez dan za 200 za tem čez teden dni 300", [100, 200, 300], [[1, "day"], [1, "week"]]],
  ["nakazal je 100 evrov in nato čez dva dni še 200 nato mesec kasneje za 300", [100, 200, 300], [[2, "day"], [1, "month"]]],
  ["plačal je prvi obrok sto nato pa čez mesec dni obrok za dvesto nato pa čez dva tedna za tristo", [100, 200, 300], [[1, "month"], [2, "week"]]],
  ["plačal je 100 evrov nato mesec prej še 200 potem teden dni pozneje za 300", [100, 200, 300], [[1, "month"], [1, "week"]]],
].forEach(function (entry) {
  var result = parse(entry[0]);
  assert.deepEqual(result.candidates.map(function (candidate) { return candidate.amount; }), entry[1], "vsaka eliptična plačilna klavzula mora ostati dogodek: " + entry[0]);
  assert.deepEqual(result.candidates.slice(1).map(function (candidate) { return [candidate.dateRelation.amount, candidate.dateRelation.unit]; }), entry[2], "vsaka eliptična klavzula mora ohraniti časovno relacijo: " + entry[0]);
  checks += 2;
});

[
  "plačal je 100 evrov nato čez 2 tedna ni plačal 6000",
  "plačal je 100 evrov nato račun 6000",
  "plačal je 100 evrov nato čez 2 tedna račun 6000",
  "plačal je 100 evrov nato obljubil 6000",
  "plačal je 1 obrok za 4000 nato čez 2 tedna 2. obrok ni bil plačan 6000",
].forEach(function (text) {
  var contract = parser._test.buildFactContract(text);
  var result = parse(text);
  var executed = result && result.candidates ? result.candidates.filter(function (candidate) {
    return ["partial_payment", "installment_payment", "paid_in_full"].includes(candidate.type);
  }) : [];
  assert.ok(!executed.some(function (candidate) { return candidate.amount === 6000; }), "zanikanje ali druga FATHER kategorija ne sme podedovati izvedenega plačila: " + text);
  assert.ok(!contract.facts.some(function (fact) { return fact.kind === "money" && fact.value === 2; }), "časovni/count/ordinal šum ne sme postati denar: " + text);
  checks += 2;
});

var countOrdinalNoise = parser._test.buildFactContract("plačal je 1 obrok za 4000 nato čez 2 tedna 2. obrok za 200");
assert.deepEqual(countOrdinalNoise.facts.filter(function (fact) { return fact.kind === "money"; }).map(function (fact) { return fact.value; }), [4000, 200]);
checks += 1;

[
  "ostalo pa ni poravnal",
  "potem nič več",
  "nato pa ničesar več",
].forEach(function (text) {
  var result = parse(text);
  assert.ok(!result || !result.candidates || !result.candidates.some(function (candidate) { return candidate.type === "remaining_unpaid"; }), "brez izvedenega plačila zaključek ne sme ustvariti preostanka: " + text);
  checks += 1;
});

[
  "plačal je 300 evrov potem nič več",
  "plačal je 300 evrov nato pa ničesar več",
  "plačal je 300 evrov zatem ni plačal nič več",
  "plačal je 300 evrov od takrat ni več nakazal",
].forEach(function (text) {
  var result = parse(text);
  assert.deepEqual(result.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [["partial_payment", 300], ["remaining_unpaid", 9146]], "jasen zaključek po izvedenem plačilu mora ohraniti preostanek: " + text);
  checks += 1;
});

var chainedDates = parse("pred 45 dnevi je plačal 400 z nakazilom potem pa čez 2tedna je plačal 400 s kartico nato čez mesec dni je plačal 100 v gotovini");
assert.deepEqual(chainedDates.candidates.map(function (candidate) { return candidate.occurredDate; }), ["2026-07-13", "2026-07-27", "2026-08-27"]);
assert.deepEqual(chainedDates.candidates.map(function (candidate) { return candidate.paymentMethod; }), ["bank_transfer", "card", "cash"]);
assert.deepEqual(chainedDates.ledger.map(function (entry) { return entry.afterEur; }), [9046, 8646, 8546]);
checks += 3;

var referenceWeekContext = { referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446 };
function assertReferenceWeekPayments(text, expectedAmounts, expectedDates) {
  var contract = parser._test.buildFactContract(text);
  var result = parser._test.deterministicResult(text, referenceWeekContext);
  assert.deepEqual(contract.clauses.map(function (clause) { return clause.values.filter(function (value) { return value.kind === "money"; }).map(function (value) { return value.value; }); }), expectedAmounts.map(function (amount) { return [amount]; }), "vsak časovno določen znesek mora ostati v lastni klavzuli: " + text);
  assert.deepEqual(result.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), expectedAmounts.map(function (amount, index) { return ["partial_payment", amount, expectedDates[index]]; }), "napačna časovno-plačilna veriga: " + text);
  assert.deepEqual(result.ledger.map(function (entry) { return entry.afterEur; }), expectedAmounts.reduce(function (ledger, amount) { ledger.push(ledger.length ? ledger[ledger.length - 1] - amount : 9446 - amount); return ledger; }, []), "napačen ledger: " + text);
  assert.equal(result.coverage.complete, true, "vsi dokazni span-i morajo biti porabljeni natanko enkrat: " + text);
  assert.deepEqual(result.questionPlan.map(function (step) { return step.missing; }), [["paymentMethod"], ["paymentMethod"], ["paymentMethod"]], "vprašalnik mora zahtevati samo manjkajočo metodo: " + text);
  assert.ok(result.candidates.every(function (candidate) { return candidate.paymentMethod === null; }), "engine ne sme izmisliti direktne obremenitve ali druge metode: " + text);
  checks += 6;
}

assertReferenceWeekPayments("dolznik je placal 300 tri tedne nazaj... 2tedna nazaj je placal 1000 danes pa 1399", [300, 1000, 1399], ["2026-08-07", "2026-08-14", "2026-08-28"]);
assertReferenceWeekPayments("dolznik je plačal 3 tedne nazaj 1222 dva tedna nazaj 1000 1 teden nazaj pa 100", [1222, 1000, 100], ["2026-08-07", "2026-08-14", "2026-08-21"]);
assertReferenceWeekPayments("2 tedna nazaj je plačal 300... včeraj 1000 in danes pa je plačal še 100", [300, 1000, 100], ["2026-08-14", "2026-08-27", "2026-08-28"]);

var exactLunaTypoText = "mesec dni nazaj je plačal 1000 nato 2 tedna zajaj 300 in danes pa 2000.. ostalo ni plačal";
var exactLunaTypo = parser._test.deterministicResult(exactLunaTypoText, referenceWeekContext);
assert.deepEqual(exactLunaTypo.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
  ["partial_payment", 1000, "2026-07-28"],
  ["partial_payment", 300, "2026-08-14"],
  ["partial_payment", 2000, "2026-08-28"],
  ["remaining_unpaid", 6146, null],
], "uporabnikov tipkarski zapis mora ohraniti tri plačila in neplačani preostanek");
assert.deepEqual(exactLunaTypo.ledger.map(function (entry) { return entry.afterEur; }), [8446, 8146, 6146, 6146]);
assert.equal(exactLunaTypo.coverage.complete, true);
assert.ok(exactLunaTypo.candidates.every(function (candidate) { return candidate.paymentMethod == null; }), "tipkarski popravek ne sme izmisliti metode");
checks += 4;

[2, 3, 4].forEach(function (installmentCount) {
  [100, 500, 1000].forEach(function (amount) {
    ["mesec dni nazaj", "1mesec dni nazaj"].forEach(function (datePhrase) {
      [false, true].forEach(function (dateFirst) {
        var groupText = installmentCount + " obroke po " + amount + " evrov";
        var input = (dateFirst ? datePhrase + " je plačal " + groupText : "plačal je " + groupText + " " + datePhrase)
          + " in danes pa je plačal še " + amount;
        var result = parser._test.deterministicResult(input, referenceWeekContext);
        assert.equal(result.candidates.length, installmentCount + 1, "skupina in današnje plačilo morata ostati ločena: " + input);
        assert.deepEqual(result.candidates.slice(0, installmentCount).map(function (candidate) {
          return [candidate.type, candidate.amount, candidate.occurredDate];
        }), Array(installmentCount).fill(["installment_payment", amount, "2026-07-28"]), "datum skupine mora veljati za vsak obrok: " + input);
        assert.deepEqual([result.candidates[installmentCount].type, result.candidates[installmentCount].amount, result.candidates[installmentCount].occurredDate], ["partial_payment", amount, "2026-08-28"], "današnji znesek mora postati dodaten dogodek: " + input);
        assert.equal(result.coverage.complete, true, "money in date evidence morata biti porabljena natanko enkrat: " + input);
        checks += 4;
      });
    });
  });
});

["zajaj", "nasaj", "nazai", "naazj", "nzaaj"].forEach(function (backTypo) {
  var typoText = "mesec dni nazaj je plačal 1000 nato 2 tedna " + backTypo + " 300 in danes pa 2000 ostalo ni plačal";
  var typoResult = parser._test.deterministicResult(typoText, referenceWeekContext);
  assert.deepEqual(typoResult.candidates.slice(0, 3).map(function (candidate) { return [candidate.amount, candidate.occurredDate]; }), [
    [1000, "2026-07-28"], [300, "2026-08-14"], [2000, "2026-08-28"],
  ], "varna tipkarska družina besede nazaj mora uporabiti isti časovni contract: " + backTypo);
  assert.equal(typoResult.projectedRemainingDebtEur, 6146);
  checks += 2;
});

var referenceWeekMatrixIndex = 0;
["3", "tri"].forEach(function (firstCount) {
  ["2 tedna", "dva tedna"].forEach(function (secondCount) {
    [", ", " "].forEach(function (separator) {
      [false, true].forEach(function (dateThenAmount) {
        var withPa = referenceWeekMatrixIndex % 2 === 0 ? " pa" : "";
        var text = dateThenAmount
          ? "dolznik je placal " + firstCount + " tedne nazaj 1222" + separator + secondCount + " nazaj 1000" + separator + "1 teden nazaj" + withPa + " 100"
          : "dolznik je placal 1222 " + firstCount + " tedne nazaj" + separator + secondCount + " nazaj 1000" + separator + "danes" + withPa + " 100";
        assertReferenceWeekPayments(text, [1222, 1000, 100], dateThenAmount ? ["2026-08-07", "2026-08-14", "2026-08-21"] : ["2026-08-07", "2026-08-14", "2026-08-28"]);
        referenceWeekMatrixIndex += 1;
      });
    });
  });
});

[500, 1000].forEach(function (baseAmount) {
  [50, 100].forEach(function (delta) {
    [["več", 1], ["manj", -1]].forEach(function (direction) {
      ["prvi obrok", "prejšnji obrok"].forEach(function (anchorPhrase) {
        var input = "plačal je mesec dni nazaj " + baseAmount + " potem naslednji teden " + delta + " " + direction[0] + " kot " + anchorPhrase + " in danes pa 300";
        var contract = parser._test.buildFactContract(input);
        var result = parser._test.deterministicResult(input, referenceWeekContext);
        var amountRelation = contract.facts.find(function (fact) { return fact.kind === "amount_relation"; });
        assert.ok(amountRelation, "relativni znesek mora ostati strukturirana relacija: " + input);
        assert.equal(amountRelation.relation.direction, direction[1], "napačna smer relativnega zneska: " + input);
        assert.deepEqual(result.candidates.map(function (candidate) { return candidate.amount; }), [baseAmount, baseAmount + direction[1] * delta, 300], "delta ne sme postati samostojno plačilo: " + input);
        assert.equal(result.coverage.complete, true, "relativni znesek mora prestati evidence coverage: " + input);
        checks += 4;
      });
    });
  });
});

var repeatedInstallments = parse("včeraj je plačal 4 obroke po 200 evrov v gotovini");
assert.deepEqual(repeatedInstallments.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate, candidate.paymentMethod]; }), Array(4).fill(["installment_payment", 200, "2026-08-26", "cash"]));
assert.equal(repeatedInstallments.questionPlan.length, 0);
checks += 2;

var tomorrowPromise = parse("danes je po telefonu obljubil da bo plačal jutri");
assert.deepEqual([tomorrowPromise.candidates[0].amount, tomorrowPromise.candidates[0].occurredDate, tomorrowPromise.candidates[0].promisedDate], [null, "2026-08-27", "2026-08-28"]);
checks += 1;

var negatedCancellation = parser._test.buildFactContract("račun ni storniran");
assert.ok(negatedCancellation.facts.some(function (fact) { return fact.eventType === "cancelled_invoice" && fact.assertion === "negated"; }));
assert.ok(!negatedCancellation.fatherCategories.includes("cancelled_invoice"));
checks += 2;

console.log("✓ history edge cases: " + checks + " preveritev zaporedij, dokazov, metod, datumov in ledgerja");
