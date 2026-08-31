"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var parser = require("../api/_lib/zgodovina-naravni-vnos");
var legacyAnalyze = parser.analyze;
parser.analyze = function (text, context, options) {
  return legacyAnalyze(text, context, Object.assign({ _legacyTestMode: true }, options || {}));
};

var context = { referenceDate: "2026-08-28", originalDebt: 9446, remainingDebt: 9446 };
var times = [
  ["danes", "2026-08-28"],
  ["včeraj", "2026-08-27"],
  ["pred tremi dnevi", "2026-08-25"],
  ["pred tednom dni", "2026-08-21"],
  ["mesec dni nazaj", "2026-07-28"],
];
var reminders = [
  "sem mu poslal opomin",
  "smo dolžniku poslali plačilni opomin",
  "sem posredoval poziv za plačilo",
  "opomin sem mu vročil",
  "opomin je bil poslan",
];
var connectors = [" ", " nato ", ", potem "];
var noResponses = [" in nič ni odgovoril", " in ni odgovoril", " vendar se ni odzval", " brez odgovora"];

function response(output, onCall) {
  return async function (_url, request) {
    if (typeof onCall === "function") onCall(JSON.parse(request.body));
    return { ok: true, status: 200, json: async function () { return { output_text: output }; } };
  };
}

function candidateTuple(candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }

async function main() {
  var checks = 0;
  var repeatedInstallmentText = "plačal je 4000 2 meseca nazaj.. potem je plačal pa 2 obroka po 1000 in danes pa še 100";
  var repeatedInstallmentLocal = parser._test.deterministicResult(repeatedInstallmentText, context);
  assert.deepEqual(repeatedInstallmentLocal.candidates.map(function (candidate) {
    return [candidate.type, candidate.amount, candidate.description, candidate.occurredDate];
  }), [
    ["partial_payment", 4000, null, "2026-06-28"],
    ["installment_payment", 1000, "1/2 obrok", null],
    ["installment_payment", 1000, "2/2 obrok", null],
    ["partial_payment", 100, null, "2026-08-28"],
  ], "točen uporabnikov primer mora razširiti obročno skupino in omejiti njen pomenski obseg");
  assert.deepEqual(repeatedInstallmentLocal.ledger.map(function (entry) { return entry.afterEur; }), [5446, 4446, 3446, 3346]);
  assert.equal(repeatedInstallmentLocal.projectedRemainingDebtEur, 3346);
  assert.equal(repeatedInstallmentLocal.coverage.complete, true);
  checks += 4;

  ["2", "dva"].forEach(function (countWord) {
    ["plačal", "poravnal", "nakazal"].forEach(function (verb) {
      [" potem ", ", nato ", "... zatem "].forEach(function (connector) {
        ["danes pa še 100", "včeraj pa dodatnih 100"].forEach(function (tail) {
          var text = verb + " je 4000 pred dvema mesecema" + connector + verb + " je " + countWord + " obroka po 1000 in " + tail;
          var result = parser._test.deterministicResult(text, context);
          assert.deepEqual(result.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
            ["partial_payment", 4000], ["installment_payment", 1000], ["installment_payment", 1000], ["partial_payment", 100],
          ], "ločilo, glagol ali sklon ne sme razširiti obročne skupine na poznejše plačilo: " + text);
          assert.deepEqual(result.candidates.slice(1, 3).map(function (candidate) { return candidate.description; }), ["1/2 obrok", "2/2 obrok"]);
          assert.equal(result.candidates[1].occurredDate, null, "poznejši poimenovani dan ne sme uiti v obročno skupino: " + text);
          assert.equal(result.candidates[2].occurredDate, null, "poznejši poimenovani dan ne sme uiti v drugi obrok: " + text);
          assert.equal(result.candidates[3].occurredDate, tail.indexOf("danes") === 0 ? "2026-08-28" : "2026-08-27");
          assert.equal(result.projectedRemainingDebtEur, 3346);
          checks += 6;
        });
      });
    });
  });

  var repeatedInstallmentLuna = await parser.analyze(repeatedInstallmentText, context, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({
      plan: [
        { evidenceText: "plačal je 4000 2 meseca nazaj", eventType: "partial_payment", count: 1, inheritedFromEvidenceText: null },
        { evidenceText: "2 obroka po 1000", eventType: "installment_payment", count: 2, inheritedFromEvidenceText: null },
        { evidenceText: "danes pa še 100", eventType: "installment_payment", count: 1, inheritedFromEvidenceText: "plačal pa 2 obroka po 1000" },
      ], clarificationQuestion: null, clarificationEvidenceText: null,
    }), function (body) {
      var input = JSON.parse(body.input);
      assert.equal(input.sourceText, repeatedInstallmentText, "Luna mora kot prvi korak prejeti nespremenjeni original");
      assert.equal(Object.prototype.hasOwnProperty.call(input, "proposedPlan"), false);
    }),
  });
  assert.equal(repeatedInstallmentLuna.semanticPlan.status, "CORRECTED");
  assert.deepEqual(repeatedInstallmentLuna.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.description]; }), [
    ["partial_payment", 4000, null], ["installment_payment", 1000, "1/2 obrok"],
    ["installment_payment", 1000, "2/2 obrok"], ["partial_payment", 100, null],
  ], "resolver mora znotraj plačilne družine kanonizirati poznejši samostojni znesek");
  assert.equal(repeatedInstallmentLuna.projectedRemainingDebtEur, 3346);
  assert.equal(repeatedInstallmentLuna.coverage.complete, true);
  checks += 6;

  var incompleteRepeatedInstallmentLuna = await parser.analyze(repeatedInstallmentText, context, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({
      plan: [
        { evidenceText: "plačal je 4000 2 meseca nazaj", eventType: "partial_payment", count: 1, inheritedFromEvidenceText: null },
        { evidenceText: "2 obroka po 1000", eventType: "installment_payment", count: 1, inheritedFromEvidenceText: null },
        { evidenceText: "danes pa še 100", eventType: "partial_payment", count: 1, inheritedFromEvidenceText: "plačal pa 2 obroka po 1000" },
      ], clarificationQuestion: null, clarificationEvidenceText: null,
    })),
  });
  assert.equal(incompleteRepeatedInstallmentLuna.semanticPlan.reason, "luna_review_solution_applied");
  assert.deepEqual(incompleteRepeatedInstallmentLuna.candidates.map(function (candidate) { return candidate.amount; }), [4000, 1000, 1000, 100]);
  assert.equal(incompleteRepeatedInstallmentLuna.projectedRemainingDebtEur, 3346);
  checks += 3;

  var ambiguousContactText = "dolznik je poravnal 2 obroka v prejšnjem mesecu potem sem ga kontaktiral 2 tedna nazaj in danes je plačal 1000 evrov preostalo ni plačal še";
  var ambiguousContactContract = parser._test.buildFactContract(ambiguousContactText);
  var ambiguousContactLocal = parser._test.deterministicResult(ambiguousContactText, context);
  assert.equal(ambiguousContactContract.version, 28);
  assert.deepEqual(ambiguousContactContract.clauses.map(function (clause) { return [clause.eventTypes, clause.semanticStatus]; }), [
    [["installment_payment"], "recognized"], [[], "neutral"], [["partial_payment"], "recognized"], [["remaining_unpaid"], "recognized"],
  ], "nejasen kontakt in današnje plačilo morata ostati ločena dokazna odseka");
  assert.deepEqual(ambiguousContactContract.facts.filter(function (fact) { return fact.kind === "repeat"; }).map(function (fact) {
    return [fact.eventType, fact.value, fact.clauseId];
  }), [["installment_payment", 2, "clause-1"]], "dva izvedena obroka morata zahtevati dve dokazni kartici");
  assert.deepEqual(ambiguousContactLocal.candidates.map(function (candidate) { return [candidate.type, candidate.occurredDate]; }), [
    ["installment_payment", null], ["installment_payment", null], ["partial_payment", "2026-08-28"], ["remaining_unpaid", null],
  ], "datum kontakta se ne sme pripeti obrokom ali današnjemu plačilu");
  assert.equal(ambiguousContactLocal.coverage.reason, "explicit_evidence_unconsumed");
  assert.equal(ambiguousContactLocal.coverage.duplicates.length, 0, "drugi obrok ni podvojen dokaz");

  var clarificationResult = await parser.analyze(ambiguousContactText, context, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({
      plan: [], clarificationQuestion: "Kaj je pomenilo, da ste ga kontaktirali?", clarificationClauseId: "clause-2",
    })),
  });
  assert.equal(clarificationResult.semanticPlan.status, "CLARIFICATION_REQUIRED");
  assert.equal(clarificationResult.clarification.clauseId, "clause-2");
  assert.deepEqual(clarificationResult.candidates, [], "pred pojasnilom se ne sme prikazati delnih kartic");

  var clarifiedContext = Object.assign({}, context, { clarification: {
    question: "Kaj je pomenilo, da ste ga kontaktirali?", answer: "Poslal sem mu opomin za plačilo.", clauseId: "clause-2", round: 1,
  } });
  var clarifiedResult = await parser.analyze(ambiguousContactText, clarifiedContext, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({
      plan: [
        { clauseId: "clause-1", eventType: "installment_payment", count: 2, inheritedFrom: null },
        { clauseId: "clause-2", eventType: "reminder_sent", count: 1, inheritedFrom: null },
        { clauseId: "clause-3", eventType: "partial_payment", count: 1, inheritedFrom: null },
        { clauseId: "clause-4", eventType: "remaining_unpaid", count: 1, inheritedFrom: null },
      ], clarificationQuestion: null, clarificationClauseId: null,
    })),
  });
  assert.equal(clarifiedResult.semanticPlan.status, "CORRECTED");
  assert.deepEqual(clarifiedResult.candidates.map(candidateTuple), [
    ["installment_payment", null, null], ["installment_payment", null, null], ["reminder_sent", null, "2026-08-14"],
    ["partial_payment", 1000, "2026-08-28"], ["remaining_unpaid", 8446, null],
  ]);
  assert.deepEqual(clarifiedResult.ledger.map(function (entry) { return entry.afterEur; }), [9446, 9446, 9446, 8446, 8446]);
  assert.equal(clarifiedResult.coverage.complete, true);
  checks += 13;

  [["2 obroka", 2], ["dva obroka", 2], ["3 obroke", 3]].forEach(function (repeatCase) {
    ["sem ga kontaktiral", "sem ga poklical", "sem mu pisal", "sem z njim govoril"].forEach(function (contactPhrase) {
      [" in ", " potem pa ", " nato "].forEach(function (connector) {
        ["plačal", "poravnal", "nakazal"].forEach(function (paymentVerb) {
          var text = "dolžnik je poravnal " + repeatCase[0] + " prejšnji mesec potem " + contactPhrase
            + " 2 tedna nazaj" + connector + "danes je " + paymentVerb + " 1000 evrov preostalo ni plačal";
          var contract = parser._test.buildFactContract(text);
          var neutralIndex = contract.clauses.findIndex(function (clause) { return clause.semanticStatus === "neutral"; });
          var paymentIndex = contract.clauses.findIndex(function (clause) { return clause.eventTypes.includes("partial_payment"); });
          var repeatFact = contract.facts.find(function (fact) { return fact.kind === "repeat" && fact.eventType === "installment_payment"; });
          assert.ok(neutralIndex >= 0 && paymentIndex === neutralIndex + 1, "kontakt in današnje plačilo morata ostati zaporedna ločena odseka: " + text);
          assert.equal(repeatFact && repeatFact.value, repeatCase[1], "število obrokov mora biti dokazna ponovitev: " + text);
          var result = parser._test.deterministicResult(text, context);
          assert.equal(result.candidates.filter(function (candidate) { return candidate.type === "installment_payment"; }).length, repeatCase[1]);
          assert.equal(result.candidates.find(function (candidate) { return candidate.type === "partial_payment"; }).occurredDate, "2026-08-28");
          assert.equal(result.candidates.filter(function (candidate) { return candidate.dateRelation && candidate.dateRelation.clauseId === contract.clauses[neutralIndex].id; }).length, 0,
            "datum nevtralnega kontakta se ne sme preseliti na drug dogodek: " + text);
          assert.equal(result.coverage.duplicates.length, 0);
          checks += 6;
        });
      });
    });
  });

  var clearRefusalText = "dolznik je plačal samo 3000 evrov tri tedne nazaj... po opominu včeraj je danes poravnal 1000 in rekel da več ne bo plačal";
  var clearRefusalContract = parser._test.buildFactContract(clearRefusalText);
  var clearRefusalLocal = parser._test.deterministicResult(clearRefusalText, context);
  assert.deepEqual(clearRefusalContract.clauses.map(function (clause) { return [clause.eventTypes, clause.semanticStatus]; }), [
    [["partial_payment"], "recognized"],
    [["reminder_sent"], "recognized"],
    [["partial_payment", "remaining_unpaid", "debtor_statement"], "recognized"],
  ], "jasen retrospektivni opomin mora ostati skupaj z lastnim datumom");
  assert.deepEqual(clearRefusalLocal.candidates.map(candidateTuple), [
    ["partial_payment", 3000, "2026-08-07"],
    ["reminder_sent", null, "2026-08-27"],
    ["partial_payment", 1000, "2026-08-28"],
    ["debtor_statement", null, "2026-08-28"],
    ["remaining_unpaid", 5446, "2026-08-28"],
  ]);
  assert.deepEqual(clearRefusalLocal.ledger.map(function (entry) { return entry.afterEur; }), [6446, 6446, 5446, 5446, 5446]);
  assert.equal(clearRefusalLocal.coverage.complete, true);
  assert.equal(clearRefusalContract.clauses.some(function (clause) { return clause.semanticStatus === "neutral"; }), false);

  var unnecessaryClarification = await parser.analyze(clearRefusalText, context, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({
      plan: [], clarificationQuestion: "Kaj ste mislili pri delu po opominu?", clarificationClauseId: "clause-2",
    })),
  });
  assert.equal(unnecessaryClarification.semanticPlan.status, "CORRECTED");
  assert.equal(unnecessaryClarification.semanticPlan.reason, "luna_clarification_not_needed");
  assert.equal(unnecessaryClarification.clarification, undefined);
  assert.deepEqual(unnecessaryClarification.candidates.map(candidateTuple), clearRefusalLocal.candidates.map(candidateTuple));
  assert.deepEqual(unnecessaryClarification.questionPlan.map(function (step) {
    return unnecessaryClarification.candidates[step.candidateIndex].type;
  }), ["partial_payment", "reminder_sent", "partial_payment", "debtor_statement"]);
  assert.equal(unnecessaryClarification.projectedRemainingDebtEur, 5446);
  checks += 11;

  var retrospectiveReminders = ["po opominu", "po poslanem opominu", "po vročenem pozivu za plačilo"];
  var reminderDays = [["včeraj", "2026-08-27"], ["predvčerajšnjim", "2026-08-26"]];
  var laterPaymentVerbs = ["plačal", "poravnal", "nakazal"];
  var refusalVariants = [
    "rekel da več ne bo plačal",
    "povedal da ne bo ničesar več poravnal",
    "sporočil da noče več plačati",
  ];
  var narrativeConnectors = ["... ", ". ", " potem "];
  retrospectiveReminders.forEach(function (reminderPhrase) {
    reminderDays.forEach(function (reminderDay) {
      laterPaymentVerbs.forEach(function (paymentVerb) {
        refusalVariants.forEach(function (refusal) {
          narrativeConnectors.forEach(function (connector) {
            var text = "dolžnik je plačal 3000 evrov tri tedne nazaj" + connector + reminderPhrase + " " + reminderDay[0]
              + " je danes " + paymentVerb + " 1000 in " + refusal;
            var contract = parser._test.buildFactContract(text);
            var result = parser._test.deterministicResult(text, context);
            assert.equal(contract.clauses.some(function (clause) { return clause.semanticStatus === "neutral"; }), false,
              "popolnoma dokazni stavek ne sme ustvariti nevtralnega odseka: " + text);
            assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }),
              ["partial_payment", "reminder_sent", "partial_payment", "debtor_statement", "remaining_unpaid"], text);
            assert.deepEqual(result.candidates.map(function (candidate) { return candidate.occurredDate; }),
              ["2026-08-07", reminderDay[1], "2026-08-28", "2026-08-28", "2026-08-28"], text);
            assert.deepEqual(result.ledger.map(function (entry) { return entry.afterEur; }), [6446, 6446, 5446, 5446, 5446], text);
            assert.equal(result.projectedRemainingDebtEur, 5446, text);
            assert.equal(result.coverage.complete, true, text);
            assert.equal(result.coverage.duplicates.length, 0, text);
            checks += 7;
          });
        });
      });
    });
  });

  var screenshotText = "2 mesca nazaj mi je plačal 2000 potem en mesec dni nazaj sem ga klical da vrne denar in ni nič... potem pa mi je danes plačal še 100";
  var screenshotContract = parser._test.buildFactContract(screenshotText);
  assert.deepEqual(screenshotContract.clauses.map(function (clause) { return clause.eventTypes; }), [
    ["partial_payment"], ["reminder_sent"], [], ["partial_payment"],
  ], "telefonski poziv k vračilu mora biti izvedeni opomin, ne nevtralni del");
  var screenshotPlan = await parser.analyze(screenshotText, context, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({
      plan: [
        { clauseId: "clause-1", eventType: "partial_payment", count: 1, inheritedFrom: null },
        { clauseId: "clause-2", eventType: "reminder_sent", count: 1, inheritedFrom: null },
        { clauseId: "clause-3", eventType: "remaining_unpaid", count: 1, inheritedFrom: null },
        { clauseId: "clause-4", eventType: "partial_payment", count: 1, inheritedFrom: null },
      ],
      clarificationQuestion: null,
      clarificationClauseId: null,
    })),
  });
  assert.deepEqual(screenshotPlan.candidates.map(candidateTuple), [
    ["partial_payment", 2000, "2026-06-28"],
    ["reminder_sent", null, "2026-07-28"],
    ["partial_payment", 100, "2026-08-28"],
    ["remaining_unpaid", 7346, null],
  ]);
  assert.deepEqual(screenshotPlan.ledger.map(function (entry) { return entry.afterEur; }), [7446, 7446, 7346, 7346]);
  checks += 3;

  var refusalScreenshotText = "dolznik je plačal račun najprej za 2000 potem me je ignoriral 2 meseca in danes je pa rekel da ne bo nič več plačal";
  var refusalScreenshotContract = parser._test.buildFactContract(refusalScreenshotText);
  assert.deepEqual(refusalScreenshotContract.clauses.map(function (clause) { return clause.eventTypes; }), [
    ["partial_payment"], ["remaining_unpaid", "debtor_statement"],
  ], "zavrnjeno prihodnje plačilo ne sme postati pozitivna obljuba");
  assert.equal(refusalScreenshotContract.facts.some(function (fact) {
    return fact.kind === "category" && fact.eventType === "payment_promise" && fact.assertion === "positive";
  }), false);
  var refusalScreenshotPlan = await parser.analyze(refusalScreenshotText, context, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({
      plan: [
        { clauseId: "clause-1", eventType: "partial_payment", count: 1, inheritedFrom: null },
        { clauseId: "clause-2", eventType: "remaining_unpaid", count: 1, inheritedFrom: null },
        { clauseId: "clause-2", eventType: "debtor_statement", count: 1, inheritedFrom: null },
      ],
      clarificationQuestion: null,
      clarificationClauseId: null,
    })),
  });
  assert.equal(refusalScreenshotPlan.semanticPlan.status, "CORRECTED");
  assert.deepEqual(refusalScreenshotPlan.candidates.map(candidateTuple), [
    ["partial_payment", 2000, null],
    ["debtor_statement", null, "2026-08-28"],
    ["remaining_unpaid", 7446, "2026-08-28"],
  ]);
  assert.deepEqual(refusalScreenshotPlan.ledger.map(function (entry) { return entry.afterEur; }), [7446, 7446, 7446]);
  assert.deepEqual(refusalScreenshotPlan.questionPlan.map(function (step) {
    return refusalScreenshotPlan.candidates[step.candidateIndex].type;
  }), ["partial_payment", "debtor_statement"]);
  assert.equal(refusalScreenshotPlan.coverage.complete, true);
  checks += 7;

  [
    "rekel da ne bo nič več plačal",
    "povedal je da ne bo več poravnal",
    "sporočil da ne bo nakazal ničesar več",
    "rekel da noče več plačati",
    "povedal da ne želi ničesar več poravnati",
  ].forEach(function (refusal) {
    [" in danes je pa ", ". Danes je "].forEach(function (connector) {
      var text = "plačal je 2000 potem me je ignoriral 2 meseca" + connector + refusal;
      var contract = parser._test.buildFactContract(text);
      assert.equal(contract.facts.some(function (fact) {
        return fact.kind === "category" && fact.eventType === "payment_promise" && fact.assertion === "positive";
      }), false, "zavrnitev ni obljuba: " + text);
      var result = parser._test.deterministicResult(text, context);
      assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }), [
        "partial_payment", "debtor_statement", "remaining_unpaid",
      ], "glagol ali ločilo ne sme spremeniti zavrnitve v obljubo: " + text);
      assert.equal(result.projectedRemainingDebtEur, 7446);
      assert.equal(result.coverage.complete, true);
      checks += 4;
    });
  });

  [
    "sem ga klical da vrne denar",
    "sem ga poklical naj plača dolg",
    "po telefonu sem ga pozval k plačilu",
    "smo jim telefonirali, da poravnajo dolg",
  ].forEach(function (phrase) {
    var contract = parser._test.buildFactContract("mesec dni nazaj " + phrase);
    assert.deepEqual(contract.clauses.flatMap(function (clause) { return clause.eventTypes; }), ["reminder_sent"], "telefonski izvedeni poziv: " + phrase);
    checks += 1;
  });
  reminders.forEach(function (reminder) {
    connectors.forEach(function (connector) {
      times.forEach(function (time) {
        noResponses.forEach(function (noResponse) {
          var text = "plačal je 1000" + connector + time[0] + " " + reminder + noResponse;
          var contract = parser._test.buildFactContract(text);
          assert.equal(contract.version, 28, "collection-action zahteva interni contract 28: " + text);
          assert.deepEqual(contract.clauses.map(function (clause) { return clause.eventTypes; }), [
            ["partial_payment"], ["reminder_sent"], ["remaining_unpaid"],
          ], "plačilo, izvedeni opomin in neodziv morajo biti tri klavzule: " + text);
          var reminderFact = contract.facts.find(function (fact) {
            return fact.kind === "category" && fact.eventType === "reminder_sent" && fact.assertion === "positive";
          });
          assert.ok(reminderFact && reminderFact.category === "collection_action", "opomin mora biti FATHER collection_action: " + text);
          assert.equal(contract.clauses.find(function (clause) { return clause.id === reminderFact.clauseId; }).text.includes(time[0]), true, "časovni uvod mora ostati v klavzuli opomina: " + text);
          var result = parser._test.deterministicResult(text, context);
          assert.deepEqual(result.candidates.map(candidateTuple), [
            ["partial_payment", 1000, null], ["reminder_sent", null, time[1]], ["remaining_unpaid", 8446, null],
          ], "resolver mora ohraniti vsa tri dejstva: " + text);
          assert.deepEqual(result.ledger.map(function (entry) { return [entry.type, entry.effectEur, entry.afterEur]; }), [
            ["partial_payment", -1000, 8446], ["reminder_sent", 0, 8446], ["remaining_unpaid", 0, 8446],
          ], "opomin in neodziv ne smeta zmanjšati salda: " + text);
          assert.equal(result.coverage && result.coverage.complete, true, "coverage mora porabiti vsako dokazilo: " + text);
          checks += 8;
        });
      });
    });
  });

  [
    ["danes bom mu poslal opomin", "proposed"],
    ["danes bomo poslali poziv za plačilo", "proposed"],
    ["včeraj nisem poslal opomina", "negated"],
    ["včeraj opomin ni bil poslan", "negated"],
  ].forEach(function (variant) {
    var text = "plačal je 1000 " + variant[0];
    var contract = parser._test.buildFactContract(text);
    var signal = contract.facts.find(function (fact) { return fact.kind === "category" && fact.eventType === "reminder_sent"; });
    assert.ok(signal, "modalni ali zanikani opomin mora ostati v diagnostiki: " + text);
    assert.equal(signal.assertion, variant[1], "assertion mora slediti modalnosti: " + text);
    assert.equal(contract.fatherCategories.includes("collection_action"), false, "neizvedeni opomin ni aktivna FATHER kategorija: " + text);
    var result = parser._test.deterministicResult(text, context);
    assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment"], "neizvedeni opomin ne sme postati kartica: " + text);
    assert.equal(result.coverage && result.coverage.complete, true, "modalni datum ne sme biti coverage obveznost: " + text);
    checks += 5;
  });

  [
    "pred tednom dni sem poslal opomin in dolžnik je odgovoril",
    "včeraj smo poslali poziv za plačilo, odgovor smo prejeli danes",
  ].forEach(function (text) {
    var result = parser._test.deterministicResult(text, context);
    assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }), ["reminder_sent"], "odziv ne sme postati lažni preostanek: " + text);
    assert.equal(result.coverage && result.coverage.complete, true);
    checks += 2;
  });

  var screenshotText = "prvi mesec je plačal 1000 naslednji teden 100 več kot prvi mesec pred tednom dni sem mu poslal opomin in nič ni odgovoril";
  var screenshotResult = parser._test.deterministicResult(screenshotText, context);
  assert.deepEqual(screenshotResult.candidates.map(candidateTuple), [
    ["partial_payment", 1000, null],
    ["partial_payment", 1100, null],
    ["reminder_sent", null, "2026-08-21"],
    ["remaining_unpaid", 7346, null],
  ], "točni uporabnikov primer mora dobiti tudi opomin in neodziv v pravilnem vrstnem redu");
  assert.deepEqual(screenshotResult.ledger.map(function (entry) { return entry.afterEur; }), [8446, 7346, 7346, 7346]);
  assert.equal(screenshotResult.coverage.complete, true);
  checks += 3;

  var evidenceOrderText = "plačal je mesec dni nazaj 3000 2 tedna kasneje sem mu poslal opomin in danes je plačal 1000 ostalo ni poravnal";
  var evidenceOrderContract = parser._test.buildFactContract(evidenceOrderText);
  assert.deepEqual(evidenceOrderContract.clauses.map(function (clause) { return clause.eventTypes; }), [
    ["partial_payment"], ["reminder_sent"], ["partial_payment"], ["remaining_unpaid"],
  ], "točni screenshot mora imeti štiri dokazne klavzule v narativnem vrstnem redu");
  var evidenceOrderResult = parser._test.deterministicResult(evidenceOrderText, context);
  assert.deepEqual(evidenceOrderResult.candidates.map(candidateTuple), [
    ["partial_payment", 3000, "2026-07-28"],
    ["reminder_sent", null, "2026-08-11"],
    ["partial_payment", 1000, "2026-08-28"],
    ["remaining_unpaid", 5446, null],
  ], "display prioriteta ne sme prestaviti opomina za poznejše plačilo");
  assert.deepEqual(evidenceOrderResult.questionPlan.map(function (step) {
    return [evidenceOrderResult.candidates[step.candidateIndex].type, step.missing];
  }), [
    ["partial_payment", ["paymentMethod"]],
    ["reminder_sent", ["communicationChannel"]],
    ["partial_payment", ["paymentMethod"]],
  ], "vprašalni koraki morajo slediti dokaznemu vrstnemu redu; display-only preostanek ne potrebuje vprašanja");
  assert.deepEqual(evidenceOrderResult.ledger.map(function (entry) { return [entry.type, entry.afterEur]; }), [
    ["partial_payment", 6446], ["reminder_sent", 6446], ["partial_payment", 5446], ["remaining_unpaid", 5446],
  ]);
  assert.equal(evidenceOrderResult.projectedRemainingDebtEur, 5446);
  checks += 5;

  var retrospectiveText = "plačal mi je pred mesecom dni 3000 po opominu mi je plačal še 200 nato pa nič več";
  var retrospectiveContract = parser._test.buildFactContract(retrospectiveText);
  assert.deepEqual(retrospectiveContract.clauses.map(function (clause) { return clause.eventTypes; }), [
    ["partial_payment"], ["reminder_sent"], ["partial_payment"], ["remaining_unpaid"],
  ], "retrospektivni opomin mora biti samostojen dokazni span med plačiloma");
  assert.deepEqual(retrospectiveContract.clauses.map(function (clause) { return clause.text; }), [
    "plačal mi je pred mesecom dni 3000", "po opominu", "mi je plačal še 200", "nič več",
  ]);
  var retrospectiveResult = parser._test.deterministicResult(retrospectiveText, context);
  assert.deepEqual(retrospectiveResult.candidates.map(candidateTuple), [
    ["partial_payment", 3000, "2026-07-28"],
    ["reminder_sent", null, null],
    ["partial_payment", 200, null],
    ["remaining_unpaid", 6246, null],
  ]);
  assert.deepEqual(retrospectiveResult.questionPlan.map(function (step) {
    return retrospectiveResult.candidates[step.candidateIndex].type;
  }), ["partial_payment", "reminder_sent", "partial_payment"]);
  assert.deepEqual(retrospectiveResult.ledger.map(function (entry) { return entry.afterEur; }), [6446, 6446, 6246, 6246]);
  assert.equal(retrospectiveResult.coverage.complete, true);
  var retrospectiveReviewed = await parser.analyze(retrospectiveText, context, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({ plan: [
      { clauseId: "clause-1", eventType: "partial_payment", count: 1, inheritedFrom: null },
      { clauseId: "clause-2", eventType: "reminder_sent", count: 1, inheritedFrom: null },
      { clauseId: "clause-3", eventType: "partial_payment", count: 1, inheritedFrom: null },
      { clauseId: "clause-4", eventType: "remaining_unpaid", count: 1, inheritedFrom: null },
    ] })),
  });
  assert.equal(retrospectiveReviewed.semanticPlan.status, "CORRECTED");
  assert.deepEqual(retrospectiveReviewed.candidates.map(function (candidate) { return candidate.type; }), [
    "partial_payment", "reminder_sent", "partial_payment", "remaining_unpaid",
  ]);
  assert.equal(retrospectiveReviewed.projectedRemainingDebtEur, 6246);
  assert.equal(retrospectiveReviewed.coverage.complete, true);
  checks += 10;

  [
    "po opominu",
    "po plačilnem opominu",
    "po poslanem opominu",
    "po vročenem pozivu za plačilo",
    "po zahtevku za plačilo",
  ].forEach(function (retrospectiveReminder) {
    ["plačal", "nakazal", "poravnal"].forEach(function (paymentVerb) {
      var text = paymentVerb + " mi je pred mesecem dni 3000 " + retrospectiveReminder
        + " mi je " + paymentVerb + " še 200 nato pa nič več";
      var result = parser._test.deterministicResult(text, context);
      assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }), [
        "partial_payment", "reminder_sent", "partial_payment", "remaining_unpaid",
      ], "retrospektivni opomin mora ohraniti dokazni vrstni red: " + text);
      assert.deepEqual(result.candidates.filter(function (candidate) {
        return candidate.type === "partial_payment";
      }).map(function (candidate) { return candidate.amount; }), [3000, 200]);
      assert.equal(result.projectedRemainingDebtEur, 6246);
      assert.equal(result.coverage.complete, true);
      checks += 4;
    });
  });

  [
    "plačal je 3000 pred opominom nato je plačal 200",
    "plačal je 3000 brez opomina nato je plačal 200",
    "plačal je 3000 po opominu bo plačal 200",
  ].forEach(function (text) {
    var contract = parser._test.buildFactContract(text);
    assert.equal(contract.facts.some(function (fact) {
      return fact.kind === "category" && fact.eventType === "reminder_sent" && fact.assertion === "positive";
    }), false, "predlagani ali nedokazani opomin ne sme postati izvedeno dejstvo: " + text);
    var result = parser._test.deterministicResult(text, context);
    assert.equal(Boolean(result && result.candidates.some(function (candidate) {
      return candidate.type === "reminder_sent";
    })), false, "predlagani ali nedokazani opomin ne sme postati izvedena kartica: " + text);
    checks += 2;
  });

  var lunaFirstSlangText = "2 mesca nazaj je plačal 3000 nato nič več...poslal sem mu opomin in danes je plačal 1000 ostalo je rekel da ne bo plačal";
  var lunaFirstSlangContract = parser._test.buildFactContract(lunaFirstSlangText);
  assert.deepEqual(lunaFirstSlangContract.facts.filter(function (fact) { return fact.kind === "money"; }).map(function (fact) { return fact.value; }), [3000, 1000], "časovni števec v '2 mesca nazaj' ne sme postati 2 €");
  assert.deepEqual(lunaFirstSlangContract.facts.filter(function (fact) { return fact.kind === "date_relation"; }).map(function (fact) {
    return [fact.relation.direction, fact.relation.amount, fact.relation.unit];
  }), [[-1, 2, "month"]]);
  var lunaFirstSlangLocal = parser._test.deterministicResult(lunaFirstSlangText, context);
  assert.deepEqual(lunaFirstSlangLocal.candidates.map(function (candidate) { return [candidate.type, candidate.amount, candidate.occurredDate]; }), [
    ["partial_payment", 3000, "2026-06-28"],
    ["reminder_sent", null, null],
    ["partial_payment", 1000, "2026-08-28"],
    ["debtor_statement", null, null],
    ["remaining_unpaid", 5446, null],
  ]);
  assert.equal(lunaFirstSlangLocal.coverage.complete, true);
  assert.deepEqual(lunaFirstSlangLocal.ledger.map(function (entry) { return entry.afterEur; }), [6446, 6446, 5446, 5446, 5446]);
  checks += 5;

  ["plačal", "nakazal", "poravnal"].forEach(function (paymentVerb) {
    ["sem mu poslal opomin", "sem mu posredoval poziv za plačilo", "sem mu vročil plačilni opomin", "opomin je bil poslan"].forEach(function (reminder) {
      [" ", ", ", "; potem "].forEach(function (separator) {
        var text = paymentVerb + " je mesec dni nazaj 3000" + separator + "2 tedna kasneje " + reminder + separator + "in danes je " + paymentVerb + " 1000 ostalo ni poravnal";
        var result = parser._test.deterministicResult(text, context);
        assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }), [
          "partial_payment", "reminder_sent", "partial_payment", "remaining_unpaid",
        ], "glagol, ločilo ali veznik ne sme spremeniti dokaznega vrstnega reda: " + text);
        assert.deepEqual(result.candidates.map(function (candidate) { return candidate.occurredDate; }).slice(0, 3), ["2026-07-28", "2026-08-11", "2026-08-28"]);
        assert.equal(result.projectedRemainingDebtEur, 5446);
        assert.equal(result.coverage.complete, true);
        checks += 4;
      });
    });
  });

  [
    "plačal je mesec dni nazaj 3000 2 tedna kasneje bom poslal opomin in danes je plačal 1000 ostalo ni poravnal",
    "plačal je mesec dni nazaj 3000 2 tedna kasneje opomin ni bil poslan in danes je plačal 1000 ostalo ni poravnal",
  ].forEach(function (text) {
    var result = parser._test.deterministicResult(text, context);
    assert.equal(result.candidates.some(function (candidate) { return candidate.type === "reminder_sent"; }), false, "predlagan ali zanikan opomin ne sme postati izvedena kartica: " + text);
    assert.deepEqual(result.candidates.filter(function (candidate) { return candidate.type === "partial_payment"; }).map(function (candidate) { return candidate.amount; }), [3000, 1000]);
    assert.equal(result.projectedRemainingDebtEur, 5446);
    checks += 3;
  });

  var noisyUserText = "plačalje mesec dni nazaj 1000 pred dvem tednoma sem mu poslal opomin in ga ni plačal daneps pa se ni več javil na telefon..";
  var noisyContract = parser._test.buildFactContract(noisyUserText);
  assert.equal(noisyContract.version, 28);
  assert.deepEqual(noisyContract.clauses.map(function (clause) { return clause.eventTypes; }), [
    ["partial_payment"], ["reminder_sent"], ["remaining_unpaid"],
  ], "časovni tipkarski šum mora še vedno ustvariti tri dokazne klavzule");
  assert.ok(noisyContract.fatherCategories.includes("collection_outcome"), "neplačilo in prekinjen stik po opominu morata dobiti lasten FATHER collection_outcome");
  var noisyResult = parser._test.deterministicResult(noisyUserText, context);
  assert.deepEqual(noisyResult.candidates.map(candidateTuple), [
    ["partial_payment", 1000, "2026-07-28"],
    ["reminder_sent", null, "2026-08-14"],
    ["remaining_unpaid", 8446, "2026-08-28"],
  ], "točni novi uporabnikov primer mora biti dokazno veljaven brez literarne izjeme");
  assert.deepEqual(noisyResult.ledger.map(function (entry) { return [entry.type, entry.effectEur, entry.afterEur]; }), [
    ["partial_payment", -1000, 8446], ["reminder_sent", 0, 8446], ["remaining_unpaid", 0, 8446],
  ]);
  assert.equal(noisyResult.coverage.complete, true);
  assert.equal(noisyResult.candidates[2].fatherCategory, "collection_outcome");
  checks += 7;

  [
    "plačal je mesec dni nazaj 1000 pred dvema tednoma sem poslal poziv in ga ni poravnal danes pa se ni več oglasil",
    "nakazal je pred enim mesecem 1000 pred 2 tednoma smo mu vročili opomin potem ni plačal in danes ni dvignil telefona",
    "poravnal je 1000 mesec nazaj pred dvem tednoma je bil opomin poslan danes pa se ni več javil",
  ].forEach(function (text) {
    var result = parser._test.deterministicResult(text, context);
    assert.deepEqual(result.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "reminder_sent", "remaining_unpaid"], "skloni, sinonimi in tipkarske oblike morajo slediti istemu FATHER toku: " + text);
    assert.equal(result.candidates[2].fatherCategory, "collection_outcome");
    assert.equal(result.projectedRemainingDebtEur, 8446);
    assert.equal(result.coverage.complete, true);
    checks += 4;
  });

  ["dolžnik se ni več javil", "danes ni dvignil telefona", "ni odgovoril"].forEach(function (text) {
    var contract = parser._test.buildFactContract(text);
    assert.equal(contract.fatherCategories.includes("collection_outcome"), false, "brez predhodnega plačila ali opomina neodziv ne sme dokazovati neplačanega salda: " + text);
    checks += 1;
  });

  var reviewText = "plačal je 1000 pred tednom dni sem mu poslal opomin in nič ni odgovoril";
  var calls = 0;
  var ok = await parser.analyze(reviewText, context, {
    apiKey: "test-only",
    fetchImpl: response("OK", function (body) {
      calls += 1;
      var input = JSON.parse(body.input);
      assert.equal(Object.prototype.hasOwnProperty.call(input, "proposedPlan"), false, "Luna mora plan izdelati prva");
      assert.equal(input.sourceText, reviewText, "Luna mora prejeti celotni izvorni opis");
      assert.equal(body.store, false, "celotni opis se pri ponudniku ne sme shranjevati");
    }),
  });
  assert.equal(calls, 1, "always-review sme narediti natanko en provider klic");
  assert.equal(ok.semanticPlan.status, "OK");
  assert.deepEqual(ok.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "reminder_sent", "remaining_unpaid"]);
  assert.equal(ok.coverage.complete, true);
  checks += 7;

  var noisyOk = await parser.analyze(noisyUserText, context, {
    apiKey: "test-only",
    fetchImpl: response("OK"),
  });
  assert.equal(noisyOk.semanticPlan.status, "OK");
  assert.deepEqual(noisyOk.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "reminder_sent", "remaining_unpaid"]);
  assert.equal(noisyOk.coverage.complete, true);
  checks += 3;

  var corrected = await parser.analyze(reviewText, context, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({ plan: [
      { clauseId: "clause-1", eventType: "partial_payment", count: 1, inheritedFrom: null },
      { clauseId: "clause-2", eventType: "reminder_sent", count: 1, inheritedFrom: null },
      { clauseId: "clause-3", eventType: "remaining_unpaid", count: 1, inheritedFrom: null },
    ] })),
  });
  assert.equal(corrected.semanticPlan.status, "CORRECTED");
  assert.deepEqual(corrected.candidates.map(function (candidate) { return candidate.type; }), ["partial_payment", "reminder_sent", "remaining_unpaid"]);
  assert.equal(corrected.coverage.complete, true);
  checks += 3;

  var evidenceOrderMock = await parser.analyze(evidenceOrderText, context, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({ plan: [
      { clauseId: "clause-1", eventType: "partial_payment", count: 1, inheritedFrom: null },
      { clauseId: "clause-2", eventType: "reminder_sent", count: 1, inheritedFrom: null },
      { clauseId: "clause-3", eventType: "partial_payment", count: 1, inheritedFrom: null },
      { clauseId: "clause-4", eventType: "remaining_unpaid", count: 1, inheritedFrom: null },
    ] })),
  });
  assert.equal(evidenceOrderMock.semanticPlan.status, "CORRECTED");
  assert.deepEqual(evidenceOrderMock.candidates.map(function (candidate) { return candidate.type; }), [
    "partial_payment", "reminder_sent", "partial_payment", "remaining_unpaid",
  ], "mock full-plan Luna pot mora ohraniti dokazni vrstni red");
  assert.deepEqual(evidenceOrderMock.ledger.map(function (entry) { return entry.afterEur; }), [6446, 6446, 5446, 5446]);
  checks += 3;

  var lunaFirstSlangMock = await parser.analyze(lunaFirstSlangText, context, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({ plan: [
      { clauseId: "clause-1", eventType: "partial_payment", count: 1, inheritedFrom: null },
      { clauseId: "clause-2", eventType: "remaining_unpaid", count: 1, inheritedFrom: null },
      { clauseId: "clause-3", eventType: "reminder_sent", count: 1, inheritedFrom: null },
      { clauseId: "clause-4", eventType: "partial_payment", count: 1, inheritedFrom: null },
      { clauseId: "clause-5", eventType: "debtor_statement", count: 1, inheritedFrom: null },
    ] }), function (body) {
      var input = JSON.parse(body.input);
      assert.equal(input.sourceText, lunaFirstSlangText);
      assert.equal(Object.prototype.hasOwnProperty.call(input, "proposedPlan"), false, "lokalni parser ne sme Luni vnaprej pripraviti plana");
      assert.equal(body.text.format.schema.required[0], "p");
    }),
  });
  assert.equal(lunaFirstSlangMock.semanticPlan.status, "CORRECTED");
  assert.deepEqual(lunaFirstSlangMock.candidates.map(function (candidate) { return [candidate.type, candidate.amount]; }), [
    ["partial_payment", 3000], ["reminder_sent", null], ["partial_payment", 1000], ["debtor_statement", null], ["remaining_unpaid", 5446],
  ]);
  assert.equal(lunaFirstSlangMock.coverage.complete, true);
  checks += 6;

  var evidenceOrderInvalid = await parser.analyze(evidenceOrderText, context, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({ plan: [
      { clauseId: "clause-1", eventType: "partial_payment", count: 1, inheritedFrom: null },
      { clauseId: "clause-3", eventType: "partial_payment", count: 1, inheritedFrom: null },
      { clauseId: "clause-2", eventType: "reminder_sent", count: 1, inheritedFrom: null },
      { clauseId: "clause-4", eventType: "remaining_unpaid", count: 1, inheritedFrom: null },
    ] })),
  });
  assert.equal(evidenceOrderInvalid.semanticPlan.status, "FAILED");
  assert.deepEqual(evidenceOrderInvalid.candidates, [], "Lunin plan, ki prestavi opomin za poznejše plačilo, mora ostati fail-closed");
  checks += 2;

  var invalid = await parser.analyze(reviewText, context, {
    apiKey: "test-only",
    fetchImpl: response(JSON.stringify({ plan: [
      { clauseId: "clause-1", eventType: "partial_payment", count: 1, inheritedFrom: null },
      { clauseId: "clause-2", eventType: "insolvency", count: 1, inheritedFrom: null },
    ] })),
  });
  assert.equal(invalid.semanticPlan.status, "FAILED");
  assert.deepEqual(invalid.candidates, [], "neveljaven plan mora ostati fail-closed");
  checks += 2;

  var ui = fs.readFileSync(path.join(__dirname, "../app/neplacila-zgodovina.js"), "utf8");
  assert.match(ui, /reminder_sent:\s*\{\s*naslov:\s*"Poslan opomin"/);
  assert.match(ui, /kandidat\.type === "reminder_sent"[\s\S]{0,120}\["occurredDate", "communicationChannel"\]/);
  checks += 2;

  console.log("✓ collection-action matrika: " + checks + " preveritev; opomin, modalnost, neodziv, ledger in Luna fail-closed");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
