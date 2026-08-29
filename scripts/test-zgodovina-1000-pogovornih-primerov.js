"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var parser = require("../api/_lib/zgodovina-naravni-vnos");
var legacyAnalyze = parser.analyze;
parser.analyze = function (text, context, options) {
  return legacyAnalyze(text, context, Object.assign({ _legacyTestMode: true }, options || {}));
};

var SEED = 0x5eed17;
var REFERENCE_DATE = "2026-08-28";
var DEBT = 9446;
var CONTEXT = { referenceDate: REFERENCE_DATE, originalDebt: DEBT, remainingDebt: DEBT };
var CONTRACT_VERSION = "history-fact-v74";
var cases = [];
var randomState = SEED >>> 0;

function random() {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return (randomState >>> 0) / 4294967296;
}

function pick(values) {
  return values[Math.floor(random() * values.length)];
}

function integer(min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function shiftDate(iso, amount, unit) {
  var parts = iso.split("-").map(Number);
  var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (unit === "day") date.setUTCDate(date.getUTCDate() + amount);
  else if (unit === "week") date.setUTCDate(date.getUTCDate() + amount * 7);
  else if (unit === "month") {
    var day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + amount);
    var lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return date.toISOString().slice(0, 10);
}

function event(type, amount, occurredDate, extras) {
  return Object.assign({
    type: type,
    amount: amount == null ? null : roundMoney(amount),
    occurredDate: occurredDate == null ? null : occurredDate,
    paymentMethod: null,
    promisedDate: null,
    communicationChannel: null,
  }, extras || {});
}

function ledgerFor(events) {
  var balance = DEBT;
  return events.map(function (item) {
    if (["partial_payment", "paid_in_full", "installment_payment", "credit_note", "compensation"].includes(item.type) && item.amount != null) {
      balance = roundMoney(Math.max(0, balance - item.amount));
    }
    return balance;
  });
}

function add(family, text, events, options) {
  options = options || {};
  cases.push({
    id: String(cases.length + 1).padStart(4, "0"),
    family: family,
    text: text,
    oracle: {
      events: events,
      ledger: options.ledger || ledgerFor(events),
      coverageComplete: options.coverageComplete !== false,
      semanticClarification: options.semanticClarification === true,
      questionCount: Number.isInteger(options.questionCount) ? options.questionCount : 0,
      missingFields: options.missingFields || null,
      forbiddenMoneyValues: options.forbiddenMoneyValues || [],
    },
  });
}

var METHODS = [
  { text: "z nakazilom", value: "bank_transfer" },
  { text: "v gotovini", value: "cash" },
  { text: "s kartico", value: "card" },
];
var CURRENCIES = ["", " eur", "€", " evrov"];
var SEPARATORS = ["; ", ", ", " .. ", " "];

for (var referenceIndex = 0; referenceIndex < 100; referenceIndex += 1) {
  var agoFirst = integer(5, 12);
  var agoSecond = integer(1, agoFirst - 1);
  var referenceAmounts = [integer(2, 15) * 100, integer(1, 9) * 50, integer(1, 12) * 100];
  var referenceMethods = [pick(METHODS), pick(METHODS), pick(METHODS)];
  var firstDuration = String(agoFirst) + (referenceIndex % 2 ? "dni" : " dni");
  var referenceText = firstDuration + " nazaj je plačal " + referenceAmounts[0] + pick(CURRENCIES) + " " + referenceMethods[0].text
    + pick(SEPARATORS) + agoSecond + " dni nazaj je poravnal " + referenceAmounts[1] + pick(CURRENCIES) + " " + referenceMethods[1].text
    + pick([" potem pa ", " nato ", " zatem "]) + "danes še " + referenceAmounts[2] + pick(CURRENCIES) + " " + referenceMethods[2].text;
  var referenceEvents = referenceAmounts.map(function (amount, index) {
    return event("partial_payment", amount, index === 0 ? shiftDate(REFERENCE_DATE, -agoFirst, "day") : index === 1 ? shiftDate(REFERENCE_DATE, -agoSecond, "day") : REFERENCE_DATE, {
      paymentMethod: referenceMethods[index].value,
    });
  });
  add("referenčni-datumi-zlepljeno", referenceText, referenceEvents, {
    forbiddenMoneyValues: [agoFirst, agoSecond],
  });
}

for (var weekReferenceIndex = 0; weekReferenceIndex < 20; weekReferenceIndex += 1) {
  var weekText;
  var weekAmounts;
  var weekDates;
  var weekHasRemaining = false;
  if (weekReferenceIndex === 0) {
    weekText = "dolznik je placal 300 tri tedne nazaj... 2tedna nazaj je placal 1000 danes pa 1399";
    weekAmounts = [300, 1000, 1399];
    weekDates = ["2026-08-07", "2026-08-14", REFERENCE_DATE];
  } else if (weekReferenceIndex === 1) {
    weekText = "dolznik je plačal 3 tedne nazaj 1222 dva tedna nazaj 1000 1 teden nazaj pa 100";
    weekAmounts = [1222, 1000, 100];
    weekDates = ["2026-08-07", "2026-08-14", "2026-08-21"];
  } else if (weekReferenceIndex === 2) {
    weekText = "2 tedna nazaj je plačal 300... včeraj 1000 in danes pa je plačal še 100";
    weekAmounts = [300, 1000, 100];
    weekDates = ["2026-08-14", "2026-08-27", REFERENCE_DATE];
  } else if (weekReferenceIndex === 3) {
    weekText = "mesec dni nazaj je plačal 1000 nato 2 tedna zajaj 300 in danes pa 2000.. ostalo ni plačal";
    weekAmounts = [1000, 300, 2000];
    weekDates = ["2026-07-28", "2026-08-14", REFERENCE_DATE];
    weekHasRemaining = true;
  } else {
    weekAmounts = [800 + weekReferenceIndex * 17, 500 + weekReferenceIndex * 13, 100 + weekReferenceIndex * 7];
    var wordCounts = weekReferenceIndex % 2 === 1;
    var firstWeekCount = wordCounts ? "tri" : "3";
    var secondWeekCount = wordCounts ? "dva tedna" : (weekReferenceIndex % 6 === 0 ? "2tedna" : "2 tedna");
    var lastWeekCount = wordCounts ? "en" : "1";
    var weekSeparator = [", ", " ... ", " "][weekReferenceIndex % 3];
    var weekPa = weekReferenceIndex % 4 < 2 ? " pa" : "";
    var repeatedPaymentVerb = weekReferenceIndex % 5 === 0 ? " je placal" : "";
    if (weekReferenceIndex % 2 === 0) {
      weekText = "dolznik je placal " + weekAmounts[0] + " " + firstWeekCount + " tedne nazaj" + weekSeparator
        + secondWeekCount + " nazaj" + repeatedPaymentVerb + " " + weekAmounts[1] + weekSeparator
        + "danes" + weekPa + " " + weekAmounts[2];
      weekDates = ["2026-08-07", "2026-08-14", REFERENCE_DATE];
    } else {
      weekText = "dolznik je placal " + firstWeekCount + " tedne nazaj " + weekAmounts[0] + weekSeparator
        + secondWeekCount + " nazaj" + repeatedPaymentVerb + " " + weekAmounts[1] + weekSeparator
        + lastWeekCount + " teden nazaj" + weekPa + " " + weekAmounts[2];
      weekDates = ["2026-08-07", "2026-08-14", "2026-08-21"];
    }
  }
  var weekEvents = weekAmounts.map(function (amount, index) {
    return event("partial_payment", amount, weekDates[index]);
  });
  if (weekHasRemaining) weekEvents.push(event("remaining_unpaid", 6146, null));
  add("referenčni-tedni-elipsa", weekText, weekEvents, {
    questionCount: 3,
    missingFields: weekHasRemaining
      ? [["paymentMethod"], ["paymentMethod"], ["paymentMethod"], []]
      : [["paymentMethod"], ["paymentMethod"], ["paymentMethod"]],
    forbiddenMoneyValues: [3, 2, 1],
  });
}

for (var namedIndex = 0; namedIndex < 100; namedIndex += 1) {
  var namedFirst = integer(2, 12) * 100;
  var namedSecond = integer(1, 10) * 50;
  var namedMethods = [pick(METHODS), pick(METHODS)];
  var namedPair = namedIndex % 2 === 0
    ? { first: "predvčerajšnjim", second: "včeraj", firstDate: shiftDate(REFERENCE_DATE, -2, "day"), secondDate: shiftDate(REFERENCE_DATE, -1, "day") }
    : { first: "včeraj", second: "danes", firstDate: shiftDate(REFERENCE_DATE, -1, "day"), secondDate: REFERENCE_DATE };
  var namedText = namedPair.first + " je " + pick(["plačal", "poravnal"]) + " " + namedFirst + pick(CURRENCIES) + " " + namedMethods[0].text
    + pick([" nato ", " potem ", ", "]) + namedPair.second + " pa še " + namedSecond + pick(CURRENCIES) + " " + namedMethods[1].text;
  add("danes-včeraj-elipsa", namedText, [
    event("partial_payment", namedFirst, namedPair.firstDate, { paymentMethod: namedMethods[0].value }),
    event("partial_payment", namedSecond, namedPair.secondDate, { paymentMethod: namedMethods[1].value }),
  ]);
}

for (var chainIndex = 0; chainIndex < 80; chainIndex += 1) {
  var chainAmounts = [integer(1, 8) * 100, integer(1, 7) * 100, integer(1, 6) * 100];
  var chainMethods = [pick(METHODS), pick(METHODS), pick(METHODS)];
  var firstOffset = integer(55, 75);
  var relationOne = chainIndex % 2 === 0
    ? { amount: integer(1, 2), unit: "week", text: function (joined) { return "čez " + relationOne.amount + (joined ? "tedna" : " tedna"); } }
    : { amount: integer(2, 8), unit: "day", text: function (joined) { return "čez " + relationOne.amount + (joined ? "dni" : " dni"); } };
  var relationTwo = chainIndex % 3 === 0
    ? { amount: 1, unit: "month", text: "čez mesec dni" }
    : { amount: integer(1, 6), unit: "day", text: "čez " + integer(1, 6) + " dni" };
  if (relationTwo.unit === "day") relationTwo.text = "čez " + relationTwo.amount + (chainIndex % 2 ? "dni" : " dni");
  var firstDate = shiftDate(REFERENCE_DATE, -firstOffset, "day");
  var secondDate = shiftDate(firstDate, relationOne.amount, relationOne.unit);
  var thirdDate = shiftDate(secondDate, relationTwo.amount, relationTwo.unit);
  var relationOneText = relationOne.text(chainIndex % 4 === 0);
  var chainText = "pred " + firstOffset + " dnevi je plačal " + chainAmounts[0] + " " + chainMethods[0].text
    + " potem pa " + relationOneText + " je plačal " + chainAmounts[1] + " " + chainMethods[1].text
    + " nato " + relationTwo.text + " je plačal " + chainAmounts[2] + " " + chainMethods[2].text;
  add("verige-prejšnji-dogodek", chainText, [
    event("partial_payment", chainAmounts[0], firstDate, { paymentMethod: chainMethods[0].value }),
    event("partial_payment", chainAmounts[1], secondDate, { paymentMethod: chainMethods[1].value }),
    event("partial_payment", chainAmounts[2], thirdDate, { paymentMethod: chainMethods[2].value }),
  ], { forbiddenMoneyValues: [firstOffset, relationOne.amount, relationTwo.amount] });
}

for (var remainingIndex = 0; remainingIndex < 100; remainingIndex += 1) {
  var remainingFirst = integer(2, 16) * 100;
  var remainingSecond = integer(1, 10) * 50;
  var remainingMethods = [pick(METHODS), pick(METHODS)];
  var remainingConclusion = pick([", potem pa nič več", " nato ničesar več", " od takrat ni več plačal"]);
  var remainingText = "včeraj je plačal " + remainingFirst + pick(CURRENCIES) + " " + remainingMethods[0].text
    + pick([", nato je ", " potem je ", "; zatem je "]) + "danes plačal " + remainingSecond + pick(CURRENCIES) + " " + remainingMethods[1].text
    + remainingConclusion;
  var outstanding = roundMoney(DEBT - remainingFirst - remainingSecond);
  add("zaporedje-in-preostanek", remainingText, [
    event("partial_payment", remainingFirst, shiftDate(REFERENCE_DATE, -1, "day"), { paymentMethod: remainingMethods[0].value }),
    event("partial_payment", remainingSecond, REFERENCE_DATE, { paymentMethod: remainingMethods[1].value }),
    event("remaining_unpaid", outstanding, remainingConclusion.indexOf("od takrat") >= 0 ? REFERENCE_DATE : null),
  ], { questionCount: 0 });
}

for (var installmentIndex = 0; installmentIndex < 100; installmentIndex += 1) {
  var installmentCount = integer(2, 4);
  var installmentAmount = integer(1, 9) * 100;
  var installmentMethod = pick(METHODS);
  var countText = installmentCount === 2 && installmentIndex % 3 === 0 ? "dva" : installmentCount === 3 && installmentIndex % 3 === 0 ? "tri" : String(installmentCount);
  var installmentText = pick(["včeraj je plačal ", "včeraj poravnal "]) + countText + " obroke po " + installmentAmount + pick(CURRENCIES) + " " + installmentMethod.text;
  var installmentEvents = Array.from({ length: installmentCount }, function () {
    return event("installment_payment", installmentAmount, shiftDate(REFERENCE_DATE, -1, "day"), { paymentMethod: installmentMethod.value });
  });
  add("več-plačanih-obrokov", installmentText, installmentEvents);
}

for (var settlementIndex = 0; settlementIndex < 100; settlementIndex += 1) {
  var settlementAmount = integer(1, 15) * 50;
  var settlementDateWord = settlementIndex % 2 ? "danes" : "včeraj";
  var settlementDate = settlementIndex % 2 ? REFERENCE_DATE : shiftDate(REFERENCE_DATE, -1, "day");
  if (settlementIndex % 2 === 0) {
    add("dobropis-in-pobot", settlementDateWord + " sem izdal dobropis za " + settlementAmount + pick(CURRENCIES), [event("credit_note", settlementAmount, settlementDate)]);
  } else {
    add("dobropis-in-pobot", settlementDateWord + " smo naredili " + pick(["kompenzacijo", "pobot"]) + " za " + settlementAmount + pick(CURRENCIES), [event("compensation", settlementAmount, settlementDate)]);
  }
}

for (var balanceIndex = 0; balanceIndex < 80; balanceIndex += 1) {
  var balanceMethod = pick(METHODS);
  if (balanceIndex % 2 === 0) {
    add("celota-odstotki", "danes je " + pick(["plačal vse", "poravnal celoten dolg", "poravnal račun v celoti"]) + " " + balanceMethod.text, [
      event("paid_in_full", DEBT, REFERENCE_DATE, { paymentMethod: balanceMethod.value }),
    ]);
  } else {
    var percent = pick([10, 20, 25, 40, 50, 75]);
    var percentAmount = roundMoney(DEBT * percent / 100);
    add("celota-odstotki", "danes je plačal " + percent + " odstotkov dolga " + balanceMethod.text, [
      event("partial_payment", percentAmount, REFERENCE_DATE, { paymentMethod: balanceMethod.value }),
    ], { forbiddenMoneyValues: [percent] });
  }
}

for (var promiseIndex = 0; promiseIndex < 100; promiseIndex += 1) {
  if (promiseIndex < 60) {
    var channel = pick([
      { text: "po telefonu", value: "phone" },
      { text: "po emailu", value: "email" },
      { text: "v sms", value: "sms" },
    ]);
    var promisedOffset = integer(1, 9);
    var promisedText = promisedOffset === 1 ? "jutri" : promisedOffset === 2 && promiseIndex % 2 ? "pojutrišnjem" : "čez " + promisedOffset + " dni";
    add("obljube-roki-dogovori", "danes je " + channel.text + " obljubil da bo plačal " + promisedText, [
      event("payment_promise", null, REFERENCE_DATE, { promisedDate: shiftDate(REFERENCE_DATE, promisedOffset, "day"), communicationChannel: channel.value }),
    ], { forbiddenMoneyValues: promisedOffset > 2 ? [promisedOffset] : [] });
  } else if (promiseIndex < 80) {
    var dueDay = integer(1, 20);
    var dueDate = "2026-09-" + String(dueDay).padStart(2, "0");
    add("obljube-roki-dogovori", "danes je po telefonu prosil za nov rok plačila do " + dueDay + ". 9. 2026", [
      event("deadline_extension", null, REFERENCE_DATE, { promisedDate: dueDate, communicationChannel: "phone" }),
    ]);
  } else {
    var agreementCount = integer(2, 6);
    add("obljube-roki-dogovori", "danes smo se dogovorili za " + agreementCount + " obroke", [
      event("installment_agreement", null, REFERENCE_DATE),
    ], { forbiddenMoneyValues: [agreementCount] });
  }
}

for (var statusIndex = 0; statusIndex < 120; statusIndex += 1) {
  var statusDateWord = statusIndex % 2 ? "danes" : "včeraj";
  var statusDate = statusIndex % 2 ? REFERENCE_DATE : shiftDate(REFERENCE_DATE, -1, "day");
  var statusKind = statusIndex % 7;
  if (statusKind === 0) add("statusi-ugovori-zanikanja", statusDateWord + " je banka zavrnila plačilo s kartico", [event("payment_failed", null, statusDate, { paymentMethod: "card" })]);
  if (statusKind === 1) add("statusi-ugovori-zanikanja", statusDateWord + " je po telefonu ugovarjal računu", [event("invoice_dispute", null, statusDate, { communicationChannel: "phone" })]);
  if (statusKind === 2) add("statusi-ugovori-zanikanja", statusDateWord + " smo izvedeli da je firma v stečaju", [event("insolvency", null, statusDate)]);
  if (statusKind === 3) add("statusi-ugovori-zanikanja", statusDateWord + " sem račun storniral", [event("cancelled_invoice", null, statusDate)]);
  if (statusKind === 4) add("statusi-ugovori-zanikanja", statusDateWord + " je po telefonu rekel da ne bo plačal", [event("debtor_statement", null, statusDate, { communicationChannel: "phone" })]);
  if (statusKind === 5) add("statusi-ugovori-zanikanja", statusDateWord + " " + integer(2, 9) + ". obrok ni plačan", [event("unpaid_installment", null, statusDate)]);
  if (statusKind === 6) add("statusi-ugovori-zanikanja", statusDateWord + " smo se dogovorili za " + integer(2, 6) + " obroke", [event("installment_agreement", null, statusDate)]);
}

var NEGATIVE_TEMPLATES = [
  function (amount) { return "danes ni plačal " + amount + " eur"; },
  function () { return "dolžnik ni v stečaju"; },
  function () { return "račun ni storniran"; },
  function () { return "banka plačila ni zavrnila"; },
  function () { return "stranka ne ugovarja računu"; },
];
for (var negativeIndex = 0; negativeIndex < 100; negativeIndex += 1) {
  var negativeAmount = integer(1, 18) * 100;
  add("negativni-varnostni-primeri", NEGATIVE_TEMPLATES[negativeIndex % NEGATIVE_TEMPLATES.length](negativeAmount), [], {
    ledger: [], coverageComplete: false, semanticClarification: true, questionCount: 0,
  });
}

assert.equal(cases.length, 1000, "Corpus mora vsebovati natanko 1000 primerov.");

function sameMoney(left, right) {
  if (left == null || right == null) return left == null && right == null;
  return Math.abs(Number(left) - Number(right)) < 0.009;
}

function simplifyCandidate(candidate) {
  return {
    type: candidate && candidate.type || null,
    amount: candidate && candidate.amount == null ? null : candidate.amount,
    occurredDate: candidate && candidate.occurredDate || null,
    promisedDate: candidate && candidate.promisedDate || null,
    paymentMethod: candidate && candidate.paymentMethod || null,
    communicationChannel: candidate && candidate.communicationChannel || null,
    missing: candidate && candidate.missing || [],
    evidence: candidate && candidate.evidence || null,
    dateRelation: candidate && candidate.dateRelation || null,
  };
}

function failureEvidence(testCase, contract, result) {
  return {
    id: testCase.id,
    family: testCase.family,
    text: testCase.text,
    oracle: testCase.oracle,
    contract: {
      clauses: contract.clauses.map(function (clause) {
        return { id: clause.id, text: clause.text, fatherCategories: clause.fatherCategories, eventTypes: clause.eventTypes, values: clause.values, dateRelations: clause.dateRelations };
      }),
      moneyFacts: contract.facts.filter(function (fact) { return fact.kind === "money"; }),
      dateRelations: contract.facts.filter(function (fact) { return fact.kind === "date_relation"; }),
    },
    actual: {
      candidates: (result.candidates || []).map(simplifyCandidate),
      ledger: result.ledger || [],
      projectedRemainingDebtEur: result.projectedRemainingDebtEur,
      coverage: result.coverage || null,
      questionPlan: result.questionPlan || [],
      semanticPlan: result.semanticPlan || null,
      diagnostics: result.diagnostics || [],
    },
  };
}

function validate(testCase, contract, result) {
  var issues = [];
  var expected = testCase.oracle;
  var actualEvents = Array.isArray(result.candidates) ? result.candidates : [];
  if (result.contractVersion !== CONTRACT_VERSION) issues.push("contract_version");
  if (actualEvents.length !== expected.events.length) issues.push("event_count");
  expected.events.forEach(function (expectedEvent, index) {
    var actual = actualEvents[index];
    if (!actual) return;
    if (actual.type !== expectedEvent.type) issues.push("event_type:" + index);
    if (!sameMoney(actual.amount, expectedEvent.amount)) issues.push("amount:" + index);
    if ((actual.occurredDate || null) !== expectedEvent.occurredDate) issues.push("occurred_date:" + index);
    if ((actual.promisedDate || null) !== expectedEvent.promisedDate) issues.push("promised_date:" + index);
    if ((actual.paymentMethod || null) !== expectedEvent.paymentMethod) issues.push("payment_method:" + index);
    if ((actual.communicationChannel || null) !== expectedEvent.communicationChannel) issues.push("communication_channel:" + index);
  });
  var actualLedger = (result.ledger || []).map(function (entry) { return entry.afterEur; });
  if (actualLedger.length !== expected.ledger.length || actualLedger.some(function (value, index) { return !sameMoney(value, expected.ledger[index]); })) issues.push("ledger");
  if (Boolean(result.coverage && result.coverage.complete) !== expected.coverageComplete) issues.push("coverage");
  if ((result.questionPlan || []).length !== expected.questionCount) issues.push("question_plan");
  if (expected.missingFields) {
    var actualMissingFields = actualEvents.map(function (candidate) { return (candidate.missing || []).slice().sort(); });
    var expectedMissingFields = expected.missingFields.map(function (fields) { return fields.slice().sort(); });
    if (JSON.stringify(actualMissingFields) !== JSON.stringify(expectedMissingFields)) issues.push("missing_fields");
    var plannedMissingFields = (result.questionPlan || []).map(function (step) { return (step.missing || []).slice().sort(); });
    var expectedQuestionMissingFields = expectedMissingFields.filter(function (fields) { return fields.length > 0; });
    if (JSON.stringify(plannedMissingFields) !== JSON.stringify(expectedQuestionMissingFields)) issues.push("question_missing_fields");
  }
  var actualClarification = Boolean(result.semanticPlan && result.semanticPlan.source === "clarification" && actualEvents.length === 0);
  if (actualClarification !== expected.semanticClarification) issues.push("clarification");
  if (!expected.semanticClarification && actualEvents.length && ((result.fieldOrder || []).length !== actualEvents.length || (result.requiredFields || []).length !== actualEvents.length)) issues.push("stepper_shape");
  expected.forbiddenMoneyValues.forEach(function (value) {
    if (contract.facts.some(function (fact) { return fact.kind === "money" && sameMoney(fact.value, value); })) issues.push("temporal_count_as_money:" + value);
  });
  return Array.from(new Set(issues));
}

function percentile(values, ratio) {
  var sorted = values.slice().sort(function (left, right) { return left - right; });
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

async function verifyMockLuna() {
  var testCase = cases.find(function (item) { return item.family === "referenčni-tedni-elipsa"; });
  var contract = parser._test.buildFactContract(testCase.text);
  var calls = 0;
  var result = await parser.analyze(testCase.text, CONTEXT, {
    apiKey: "mock-only",
    fetchImpl: async function () {
      calls += 1;
      return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } };
    },
  });
  var actualAmounts = result.candidates.map(function (candidate) { return candidate.amount; });
  var actualDates = result.candidates.map(function (candidate) { return candidate.occurredDate; });
  var actualMethods = result.candidates.map(function (candidate) { return candidate.paymentMethod; });
  var expectedAmounts = testCase.oracle.events.map(function (item) { return item.amount; });
  var expectedDates = testCase.oracle.events.map(function (item) { return item.occurredDate; });
  var expectedMethods = testCase.oracle.events.map(function (item) { return item.paymentMethod; });
  var issues = [];
  if (calls !== 1) issues.push("provider_calls");
  if (JSON.stringify(actualAmounts) !== JSON.stringify(expectedAmounts)) issues.push("amounts_not_corrected");
  if (JSON.stringify(actualDates) !== JSON.stringify(expectedDates)) issues.push("dates_not_corrected");
  if (JSON.stringify(actualMethods) !== JSON.stringify(expectedMethods)) issues.push("hallucinated_methods_not_rejected");
  if (result.semanticPlan.source !== "validated_semantic_plan" || result.semanticPlan.reason !== "luna_review_ok") issues.push("review_result");
  return { passed: issues.length === 0, issues: issues, calls: calls, source: result.semanticPlan.source, amounts: actualAmounts, dates: actualDates, methods: actualMethods };
}

async function main() {
  var familyStats = {};
  var failures = [];
  var durations = [];
  for (var index = 0; index < cases.length; index += 1) {
    var testCase = cases[index];
    var contract = parser._test.buildFactContract(testCase.text);
    var started = performance.now();
    var result = await parser.analyze(testCase.text, CONTEXT, {
      apiKey: "mock-only",
      fetchImpl: async function () {
        return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } };
      },
    });
    durations.push(performance.now() - started);
    var issues = validate(testCase, contract, result);
    if (!familyStats[testCase.family]) familyStats[testCase.family] = { total: 0, passed: 0, failed: 0, causes: {} };
    familyStats[testCase.family].total += 1;
    if (!issues.length) familyStats[testCase.family].passed += 1;
    else {
      familyStats[testCase.family].failed += 1;
      issues.forEach(function (issue) { familyStats[testCase.family].causes[issue] = (familyStats[testCase.family].causes[issue] || 0) + 1; });
      failures.push(Object.assign(failureEvidence(testCase, contract, result), { issues: issues }));
    }
  }
  var mockLuna = await verifyMockLuna();
  var summary = {
    seed: SEED,
    referenceDate: REFERENCE_DATE,
    contractVersion: parser.CONTRACT_VERSION,
    total: cases.length,
    passed: cases.length - failures.length,
    failed: failures.length,
    families: familyStats,
    timingMs: { p50: percentile(durations, 0.50), p95: percentile(durations, 0.95), max: Math.max.apply(Math, durations) },
    mockLuna: mockLuna,
  };
  Object.keys(familyStats).forEach(function (family) {
    var stat = familyStats[family];
    console.log((stat.failed ? "✗" : "✓") + " " + family + ": " + stat.passed + "/" + stat.total + (stat.failed ? " " + JSON.stringify(stat.causes) : ""));
  });
  console.log("Skupaj " + summary.passed + "/" + summary.total + "; p50 " + summary.timingMs.p50.toFixed(2) + " ms, p95 " + summary.timingMs.p95.toFixed(2) + " ms, max " + summary.timingMs.max.toFixed(2) + " ms; mock-Luna " + (mockLuna.passed ? "✓ " : "✗ ") + mockLuna.source + (mockLuna.issues.length ? " " + mockLuna.issues.join(",") : "") + ".");
  failures.slice(0, 12).forEach(function (failure) {
    console.log("FAIL " + failure.id + " [" + failure.family + "] " + failure.issues.join(", ") + " :: " + failure.text);
    console.log(JSON.stringify({ clauses: failure.contract.clauses, moneyFacts: failure.contract.moneyFacts, dateRelations: failure.contract.dateRelations, candidates: failure.actual.candidates, ledger: failure.actual.ledger, coverage: failure.actual.coverage, questionPlan: failure.actual.questionPlan }));
  });
  var reportArg = process.argv.find(function (argument) { return argument.indexOf("--report=") === 0; });
  if (reportArg) {
    var reportPath = path.resolve(process.cwd(), reportArg.slice("--report=".length));
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ summary: summary, corpus: cases, failures: failures }, null, 2) + "\n", "utf8");
    console.log("Poročilo: " + reportPath);
  }
  if ((failures.length || !mockLuna.passed) && !process.argv.includes("--baseline")) assert.fail(failures.length + " od 1000 primerov ni prestalo oracle preverjanja; mock-Luna " + (mockLuna.passed ? "uspešen" : mockLuna.issues.join(", ")) + ".");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
