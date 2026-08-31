"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var engine = require("../api/_lib/cilj-naravni-vnos");

function response(proposal) {
  return { ok: true, json: async function () { return { output_text: JSON.stringify(proposal), usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }; } };
}
function wireField(key, value, evidence) {
  var optionId = engine._test.valueIdByFieldValue[key + ":" + value];
  return { i: engine._test.fieldIdByKey[key], v: optionId ? null : String(value), o: optionId || null, e: evidence };
}
function wireGoal(number, goalId, fields, evidence, confidence) {
  return { n: number, c: engine._test.cardIdByGoal[goalId], k: confidence || 1, f: fields || [], e: evidence };
}
function wirePlan(goals, evidence) { return { p: goals, q: null, x: evidence }; }
function wireClarification(question, evidence) { return { p: [], q: question, x: evidence }; }

(async function () {
  assert.equal(engine.ATENA_ENGINE_VERSION, "atena-v7");
  assert.equal(engine.CONTRACT_VERSION, "goal-fact-v17");
  assert.equal(engine.MODEL, "gpt-5.6-luna");
  assert.equal(engine.MAX_GOALS, 50);
  assert.equal(engine.RESPONSE_SCHEMA.properties.p.maxItems, 50);
  var body = engine.requestBody("hočem da mi plača v celoti", { remainingDebt: 434 }, "user-1");
  assert.match(body.instructions, /sole semantic interpreter/);
  assert.match(body.instructions, /v celoti/);
  assert.match(body.instructions, /Clauses that jointly describe one payment structure stay on one appropriate payment card/);
  assert.match(body.instructions, /whenever the supplied schema can represent them/);
  assert.match(body.instructions, /one independent future outcome or action per card/);
  assert.match(body.instructions, /Never merge, summarize or hide a second requested outcome/);
  assert.match(body.instructions, /HARD SEMANTIC AUTHORITY BOUNDARY \(luna-semantic-authority-v3\)/);
  assert.match(body.instructions, /HARD COMPOSITIONAL REASONING METHOD \(luna-compositional-reasoning-v1\)/);
  assert.match(body.instructions, /MUST NOT reread the source/);
  assert.match(body.instructions, /never changes Luna's semantic selection/);
  assert.match(body.instructions, /apply this rule generally across all catalog families/i);
  assert.doesNotMatch(body.instructions, /lawyer call two days later/);
  assert.equal(JSON.parse(body.input).remainingDebtEur, 434);
  assert.equal(JSON.parse(body.input).referenceDate, null);
  assert.ok(Array.isArray(JSON.parse(body.input).catalog.cards));
  assert.ok(Array.isArray(JSON.parse(body.input).catalog.fields));
  assert.ok(Array.isArray(JSON.parse(body.input).catalog.values));
  var legalOutcomes = JSON.parse(body.input).catalog.legalOutcomes;
  assert.equal(legalOutcomes.length, 6);
  assert.deepEqual(legalOutcomes.map(function (outcome) { return outcome.valueId; }), [90101, 90102, 90103, 90104, 90105, 90106]);
  assert.ok(legalOutcomes.every(function (outcome) { return outcome.useWhen && outcome.doNotUseWhen && outcome.examples.length; }));
  var guide = JSON.parse(body.input).catalog.guide;
  assert.equal(guide.length, 12);
  assert.ok(guide.every(function (card) { return Number.isInteger(card.cardId) && card.useWhen && card.doNotUseWhen && card.fieldIds.every(Number.isInteger) && card.requiredFieldIds.every(function (fieldId) { return card.fieldIds.includes(fieldId); }); }));
  var legalGuide = guide.find(function (card) { return card.cardId === 9; });
  var customGuide = guide.find(function (card) { return card.cardId === 12; });
  assert.match(legalGuide.useWhen, /lawyer|attorney|legal representative/);
  assert.match(customGuide.doNotUseWhen, /lawyer|legal representative/);
  assert.match(body.instructions, /FIRST read every entry in catalog\.guide/);
  assert.match(body.instructions, /legal_recovery cardId 9/);
  assert.match(body.instructions, /legal_notice_payment valueId 90101/);
  assert.match(body.instructions, /Every independently requested legal result is its own legal_recovery cardId 9/);
  assert.match(body.instructions, /return multiple ordered legal_recovery cards/);
  assert.match(body.instructions, /conditional legal fallback/);
  assert.match(body.instructions, /legal_route_review valueId 90106/);
  assert.equal(body.reasoning.effort, "medium");
  assert.match(body.instructions, /SETTLEMENT FORGIVENESS HARD RULE/);
  assert.match(body.instructions, /remainingDebtEur minus X/);
  assert.match(body.instructions, /settlementAmount 334 and cardId 5/);

  var forgivenessSource = "hočem da mi vse plača prirpavljen sem na 100 evrov odpustka";
  var forgiveness = engine._test.materialize(wirePlan([wireGoal(1, "amicable_settlement", [
    wireField("settlementAmount", "334", "100 evrov odpustka"),
    wireField("settlementApproach", "single_payment", "vse plača"),
  ], forgivenessSource)], forgivenessSource), { remainingDebt: 434 }, forgivenessSource);
  assert.equal(forgiveness[0].goalId, "amicable_settlement");
  assert.equal(forgiveness[0].goalData.settlementAmount, "334");
  assert.equal(forgiveness[0].goalData.settlementApproach, "single_payment");
  var wrongLunaSelection = engine._test.materialize(wirePlan([wireGoal(1, "full_payment", [
    wireField("targetAmount", "434", "vse plača"),
  ], forgivenessSource)], forgivenessSource), { remainingDebt: 434 }, forgivenessSource);
  assert.equal(wrongLunaSelection[0].goalId, "full_payment", "lokalni adapter ne sme semantično zamenjati Lunine kartice");

  var exact = await engine.analyze("hočem da mi plača v celoti", { remainingDebt: 434 }, { apiKey: "test", userId: "user-1", fetchImpl: async function () {
    return response(wirePlan([wireGoal(1, "full_payment", [wireField("targetAmount", "434", "plača v celoti")], "plača v celoti")], "plača v celoti"));
  } });
  assert.equal(exact.goals[0].goalId, "full_payment");
  assert.equal(exact.goals[0].cardId, 1);
  assert.ok(exact.goals[0].fieldIds.includes(101));
  assert.equal(exact.goals[0].goalData.targetAmount, "434");
  assert.deepEqual(exact.goals[0].missing, ["paymentDeadline", "contactChannel"]);
  assert.equal(exact.goals[0].requiresHumanReview, true);

  var ambiguousSource = "hočem da mi plača zdaj polovico jutri in pol pa do konca meseca";
  var ambiguous = await engine.analyze(ambiguousSource, { remainingDebt: 434, referenceDate: "2026-08-29" }, { apiKey: "test", userId: "user-1", fetchImpl: async function () {
    return response(wireClarification("Ali želite prvo polovico plačano danes ali jutri?", ambiguousSource));
  } });
  assert.equal(ambiguous.goals.length, 0);
  assert.equal(ambiguous.clarification.question, "Ali želite prvo polovico plačano danes ali jutri?");
  assert.equal(ambiguous.clarification.round, 1);
  assert.equal(ambiguous.semanticPlan.status, "CLARIFICATION_REQUIRED");

  var related = engine._test.materialize(wirePlan([
    wireGoal(1, "installment_plan", [wireField("installmentCount", "4", "štirje obroki")], "štirje obroki"),
    wireGoal(2, "payment_security", [wireField("securedAmount", "100", "zavarovanje")], "zavarovanje", 2),
  ], "štirje obroki in zavarovanje"), { remainingDebt: 434 }, "štirje obroki in zavarovanje");
  assert.equal(related.length, 2);
  assert.equal(related[0].goalData.installmentCount, "4");
  assert.equal(related[1].goalData.securedAmount, "100");
  var repeatedSpecialized = engine._test.materialize(wirePlan([
    wireGoal(1, "legal_recovery", [wireField("legalOutcome", "legal_notice_payment", "prvi opomin")], "prvi opomin"),
    wireGoal(2, "legal_recovery", [wireField("legalOutcome", "enforcement", "nato izvršba")], "nato izvršba"),
  ], "prvi opomin, nato izvršba"), { remainingDebt: 434 }, "prvi opomin, nato izvršba");
  assert.equal(repeatedSpecialized.length, 2, "adapter ne sme izbrisati druge Lunine kartice istega tipa");

  var normalized = engine._test.materialize(wirePlan([wireGoal(1, "new_deadline", [
    wireField("targetAmount", "434", "vse"), wireField("newDeadline", "2026-11-29", "29. novembra"), wireField("contactChannel", "phone", "po telefonu"),
  ], "vse do 29. novembra po telefonu")], "vse do 29. novembra po telefonu"), { remainingDebt: 434 }, "želim vse do 29. novembra po telefonu");
  assert.equal(normalized[0].goalData.targetAmount, "434");
  assert.equal(normalized[0].goalData.newDeadline, "2026-11-29");
  assert.equal(normalized[0].goalData.contactChannel, "phone");
  assert.deepEqual(normalized[0].missing, []);

  var splitDeadlineSource = "polovico jutri, preostanek do konca meseca";
  var splitDeadline = engine._test.materialize(wirePlan([wireGoal(1, "partial_payment_now", [
    wireField("requestedAmount", "217", "polovico"),
    wireField("paymentDeadline", "2026-08-30", "jutri"),
    wireField("remainingStrategy", "new_deadline", "do konca meseca"),
    wireField("remainingDeadline", "2026-08-31", "do konca meseca"),
  ], splitDeadlineSource)], splitDeadlineSource), { remainingDebt: 434 }, splitDeadlineSource);
  assert.equal(splitDeadline[0].goalId, "partial_payment_now");
  assert.equal(splitDeadline[0].goalData.requestedAmount, "217");
  assert.equal(splitDeadline[0].goalData.paymentDeadline, "2026-08-30");
  assert.equal(splitDeadline[0].goalData.remainingStrategy, "new_deadline");
  assert.equal(splitDeadline[0].goalData.remainingDeadline, "2026-08-31");
  assert.deepEqual(splitDeadline[0].missing, []);

  var splitDeadlineMissing = engine._test.materialize(wirePlan([wireGoal(1, "partial_payment_now", [
    wireField("requestedAmount", "217", "polovico"),
    wireField("paymentDeadline", "2026-08-30", "jutri"),
    wireField("remainingStrategy", "new_deadline", "do konca meseca"),
  ], splitDeadlineSource)], splitDeadlineSource), { remainingDebt: 434 }, splitDeadlineSource);
  assert.deepEqual(splitDeadlineMissing[0].missing, ["remainingDeadline"]);

  var smallerDebtSource = "polovico jutri, preostanek do konca meseca";
  var smallerDebt = engine._test.materialize(wirePlan([wireGoal(1, "partial_payment_now", [
    wireField("requestedAmount", "17", "polovico"),
    wireField("paymentDeadline", "2026-08-30", "jutri"),
    wireField("remainingStrategy", "new_deadline", "do konca meseca"),
    wireField("remainingDeadline", "2026-08-31", "do konca meseca"),
  ], smallerDebtSource)], smallerDebtSource), { remainingDebt: 34 }, smallerDebtSource);
  assert.equal(smallerDebt[0].goalData.requestedAmount, "17", "polovica mora slediti dejanskemu preostalemu dolgu, ne prvotnemu znesku");
  assert.deepEqual(smallerDebt[0].missing, []);

  var threeInstallmentsSource = "želim da plača vse v 3h obrokih";
  var threeInstallments = engine._test.materialize(wirePlan([1, 2, 3].map(function (number) {
    return wireGoal(number, "installment_plan", [
      wireField("targetAmount", "434", "vse"),
      wireField("installmentCount", "3", "3h obrokih"),
    ], threeInstallmentsSource);
  }), threeInstallmentsSource), { remainingDebt: 434 }, threeInstallmentsSource);
  assert.equal(threeInstallments.length, 3, "Lunini trije obročni koraki se morajo preslikati v tri pregledne korake kot v Zgodovini.");
  assert.deepEqual(threeInstallments.map(function (goal) { return goal.stepNumber; }), [1, 2, 3]);

  var fiveInstallmentsSource = "želim da plača vse v 5h obrokih";
  var fiveInstallments = engine._test.materialize(wirePlan([1, 2, 3, 4, 5].map(function (number) {
    return wireGoal(number, "installment_plan", [
      wireField("targetAmount", "434", "vse"),
      wireField("installmentAmount", "86.80", "5h obrokih"),
      wireField("installmentCount", "5", "5h obrokih"),
    ], fiveInstallmentsSource);
  }), fiveInstallmentsSource), { remainingDebt: 434 }, fiveInstallmentsSource);
  assert.equal(fiveInstallments.length, 5, "Pet obrokov se ne sme skrčiti v en ali tri korake.");
  assert.deepEqual(fiveInstallments.map(function (goal) { return goal.stepNumber; }), [1, 2, 3, 4, 5]);
  assert.ok(fiveInstallments.every(function (goal) { return goal.goalData.installmentCount === "5" && goal.goalData.installmentAmount === "86.80"; }));

  var multiGoalSource = "želim da mi vse plača jutri in da ga pokliče odvetnik čez 2 dni";
  var multiGoal = engine._test.materialize(wirePlan([
    wireGoal(1, "full_payment", [wireField("targetAmount", "434", "vse plača"), wireField("paymentDeadline", "2026-08-30", "jutri")], "vse plača jutri"),
    wireGoal(2, "legal_recovery", [wireField("legalOutcome", "legal_notice_payment", "pokliče odvetnik"), wireField("legalDeadline", "2026-08-31", "čez 2 dni"), wireField("legalNote", "odvetnik naj ga pokliče", "pokliče odvetnik")], "pokliče odvetnik čez 2 dni"),
  ], multiGoalSource), { remainingDebt: 434 }, multiGoalSource);
  assert.deepEqual(multiGoal.map(function (goal) { return goal.goalId; }), ["full_payment", "legal_recovery"], "Luninih ločenih prihodnjih namer lokalni adapter ne sme združiti.");
  assert.equal(multiGoal[0].goalData.note, undefined);
  assert.equal(multiGoal[1].goalData.legalDeadline, "2026-08-31");

  var conditionalFallbackSource = "zelim da vse da plača če ne pa naj odvetnik prevzame primer";
  var conditionalFallback = await engine.analyze(conditionalFallbackSource, { remainingDebt: 434, referenceDate: "2026-08-30" }, { apiKey: "test", fetchImpl: async function () {
    return response(wirePlan([
      wireGoal(1, "full_payment", [wireField("targetAmount", "434", "vse da plača")], "vse da plača"),
      wireGoal(2, "legal_recovery", [wireField("legalOutcome", "legal_route_review", "odvetnik prevzame primer"), wireField("legalNote", "odvetnik prevzame primer", "odvetnik prevzame primer")], "odvetnik prevzame primer"),
    ], conditionalFallbackSource));
  } });
  assert.deepEqual(conditionalFallback.goals.map(function (goal) { return goal.goalId; }), ["full_payment", "legal_recovery"]);
  assert.equal(conditionalFallback.goals[1].goalData.legalOutcome, "legal_route_review");
  assert.equal(conditionalFallback.goals[1].goalData.legalNote, "odvetnik prevzame primer");

  var relatedFallbackSource = "naj poravna celoten dolg, sicer zadevo predamo pravnemu zastopniku";
  var relatedFallback = engine._test.materialize(wirePlan([
    wireGoal(1, "full_payment", [wireField("targetAmount", "434", "poravna celoten dolg")], "poravna celoten dolg"),
    wireGoal(2, "legal_recovery", [wireField("legalOutcome", "legal_route_review", "predamo pravnemu zastopniku")], "predamo pravnemu zastopniku"),
  ], relatedFallbackSource), { remainingDebt: 434 }, relatedFallbackSource);
  assert.deepEqual(relatedFallback.map(function (goal) { return goal.goalId; }), ["full_payment", "legal_recovery"]);

  var noFallbackSource = "naj odvetnik preveri najboljšo pravno pot";
  var noFallback = engine._test.materialize(wirePlan([
    wireGoal(1, "legal_recovery", [wireField("legalOutcome", "legal_route_review", noFallbackSource)], noFallbackSource),
  ], noFallbackSource), { remainingDebt: 434 }, noFallbackSource);
  assert.deepEqual(noFallback.map(function (goal) { return goal.goalId; }), ["legal_recovery"], "samostojna pravna zahteva ne sme dobiti izmišljenega plačilnega koraka");

  var lawyerSource = "hočem da se pokliče odvetnika in da se izpolne opomin";
  var lawyer = await engine.analyze(lawyerSource, { remainingDebt: 8536, referenceDate: "2026-08-30" }, { apiKey: "test", fetchImpl: async function () {
    return response(wirePlan([wireGoal(1, "legal_recovery", [
      wireField("legalOutcome", "legal_notice_payment", lawyerSource),
      wireField("legalAmount", "8536", lawyerSource),
      wireField("legalNote", "Poklicati odvetnika in pripraviti opomin", lawyerSource),
    ], lawyerSource)], lawyerSource));
  } });
  assert.equal(lawyer.goals[0].goalId, "legal_recovery");
  assert.equal(lawyer.goals[0].cardId, 9);
  assert.equal(lawyer.goals[0].goalData.legalOutcome, "legal_notice_payment");
  assert.equal(lawyer.goals[0].goalData.legalAmount, "8536");
  assert.equal(lawyer.goals[0].goalData.goalDescription, undefined, "lokalni adapter pravne kartice ne sme spremeniti v Drugi cilj");

  var multiLegalSource = "naj odvetnik pošlje pravni opomin, nato začne izvršbo in preveri začasno sodno zaščito";
  var multiLegal = await engine.analyze(multiLegalSource, { remainingDebt: 8536, referenceDate: "2026-08-30" }, { apiKey: "test", fetchImpl: async function () {
    return response(wirePlan([
      wireGoal(1, "legal_recovery", [wireField("legalOutcome", "legal_notice_payment", "pošlje pravni opomin"), wireField("legalAmount", "8536", multiLegalSource)], "pošlje pravni opomin"),
      wireGoal(2, "legal_recovery", [wireField("legalOutcome", "enforcement", "nato začne izvršbo"), wireField("legalAmount", "8536", multiLegalSource)], "nato začne izvršbo"),
      wireGoal(3, "legal_recovery", [wireField("legalOutcome", "interim_protection", "preveri začasno sodno zaščito")], "preveri začasno sodno zaščito"),
    ], multiLegalSource));
  } });
  assert.deepEqual(multiLegal.goals.map(function (goal) { return goal.goalData.legalOutcome; }), ["legal_notice_payment", "enforcement", "interim_protection"]);
  assert.deepEqual(multiLegal.goals.map(function (goal) { return goal.stepNumber; }), [1, 2, 3]);

  var familyCases = [
    ["full_payment", "hočem celotno plačilo do 15. septembra po telefonu", [["targetAmount", "434", "celotno plačilo"], ["paymentDeadline", "2026-09-15", "15. septembra"], ["contactChannel", "phone", "po telefonu"]]],
    ["partial_payment_now", "naj takoj plača 100 evrov, preostanek pa na obroke", [["requestedAmount", "100", "100 evrov"], ["paymentDeadline", "2026-08-29", "takoj"], ["remainingStrategy", "installments", "na obroke"]]],
    ["installment_plan", "želim ves dolg v štirih mesečnih obrokih po 108,50 evra od 15. septembra", [["targetAmount", "434", "ves dolg"], ["installmentAmount", "108.50", "108,50 evra"], ["installmentCount", "4", "štirih"], ["firstPaymentDate", "2026-09-15", "15. septembra"], ["frequency", "monthly", "mesečnih"]]],
    ["new_deadline", "podaljšajmo rok za ves preostanek na 29. november po e-pošti", [["targetAmount", "434", "ves preostanek"], ["newDeadline", "2026-11-29", "29. november"], ["contactChannel", "email", "po e-pošti"]]],
    ["amicable_settlement", "sporazumno bi sprejel 300 evrov do 1. oktobra v enkratnem plačilu", [["settlementAmount", "300", "300 evrov"], ["settlementDeadline", "2026-10-01", "1. oktobra"], ["settlementApproach", "single_payment", "enkratnem plačilu"]]],
    ["dispute_resolution", "najprej rešimo ugovor o vsebini računa in dosežemo pogajanja", [["disputeTopic", "invoice", "vsebini računa"], ["desiredOutcome", "negotiation", "pogajanja"], ["disputeDescription", "ugovor o vsebini računa", "ugovor o vsebini računa"]]],
    ["compensation", "želim pobot 120 evrov z računom R-22", [["compensationAmount", "120", "120 evrov"], ["counterclaimReference", "R-22", "R-22"]]],
    ["payment_security", "zahtevam poroštvo za vseh 434 evrov do 20. septembra", [["securityType", "guarantee", "poroštvo"], ["securedAmount", "434", "434 evrov"], ["securityDeadline", "2026-09-20", "20. septembra"]]],
    ["legal_recovery", "želim izvršbo za 434 evrov", [["legalOutcome", "enforcement", "izvršbo"], ["legalAmount", "434", "434 evrov"]]],
    ["insolvency_claim", "terjatev želim prijaviti v stečaj St 22/2026", [["proceedingType", "bankruptcy", "stečaj"], ["caseReference", "St 22/2026", "St 22/2026"]]],
    ["close_without_recovery", "zaključimo vseh 434 evrov ker terjatev ni izterljiva", [["closureReason", "uncollectible", "ni izterljiva"], ["writeOffAmount", "434", "434 evrov"], ["closureNote", "terjatev ni izterljiva", "terjatev ni izterljiva"]]],
    ["custom_goal", "poleg dolga želim vrnitev izposojenega kompresorja do 31. decembra", [["goalDescription", "vrnitev izposojenega kompresorja", "vrnitev izposojenega kompresorja"], ["desiredDeadline", "2026-12-31", "31. decembra"]]],
  ];
  familyCases.forEach(function (family) {
    var fields = family[2].map(function (field) { return wireField(field[0], field[1], field[2]); });
    var result = engine._test.materialize(wirePlan([wireGoal(1, family[0], fields, family[1])], family[1]), { remainingDebt: 434 }, family[1]);
    assert.equal(result[0].goalId, family[0]);
    fields.forEach(function (field) { assert.ok(result[0].fieldIds.includes(field.i)); });
  });

  var invalidUiValues = engine._test.materialize(wirePlan([wireGoal(1, "new_deadline", [
    wireField("newDeadline", "čez tri mesece", "čez tri mesece"), wireField("contactChannel", "po telefonu", "po telefonu"),
  ], "čez tri mesece po telefonu")], "čez tri mesece po telefonu"), { remainingDebt: 434 }, "čez tri mesece po telefonu");
  assert.equal(invalidUiValues, null, "neveljaven datum ali enum mora zavrniti celoten plan");

  for (var matrixIndex = 0; matrixIndex < 220; matrixIndex += 1) {
    var debt = 100 + matrixIndex;
    var source = "celotno plačilo primer " + matrixIndex;
    var matrix = engine._test.materialize(wirePlan([wireGoal(1, "full_payment", [wireField("targetAmount", debt, source)], source, matrixIndex % 3 === 0 ? 2 : 1)], source), { remainingDebt: debt }, source);
    assert.equal(matrix[0].goalData.targetAmount, String(debt));
    assert.deepEqual(matrix[0].missing, ["paymentDeadline", "contactChannel"]);
  }

  assert.equal(engine._test.materialize({ p: [{ n: 1, c: 999, k: 1, f: [], e: "x" }], q: null, x: "x" }, { remainingDebt: 434 }, "x"), null, "stara ali izmišljena kartica mora biti zavrnjena");
  assert.equal(engine._test.materialize(wirePlan([wireGoal(1, "full_payment", [wireField("requestedAmount", "100", "x")], "x")], "x"), { remainingDebt: 434 }, "x"), null, "polje druge kartice mora fail-closed zavrniti celoten plan");
  assert.equal(engine._test.materialize(wirePlan([wireGoal(1, "full_payment", [{ i: 101, v: "434", o: null, e: "izmišljeno" }], "x")], "x"), { remainingDebt: 434 }, "x"), null, "vsako polje potrebuje lasten dobesedni dokaz");
  assert.equal(engine._test.materialize({ p: [wireGoal(1, "full_payment", [], "x")], q: "Kaj?", x: "x" }, { remainingDebt: 434 }, "x"), null, "plan in vprašanje se ne smeta pojaviti skupaj");
  assert.equal(engine._test.materialize(wirePlan([
    { n: 1, c: 999, k: 1, f: [], e: "x" },
    wireGoal(2, "full_payment", [], "x"),
  ], "x"), { remainingDebt: 434 }, "x"), null, "neveljavna prva kartica se ne sme tiho izpustiti");
  assert.equal(engine._test.materialize(wirePlan([wireGoal(1, "full_payment", [
    wireField("targetAmount", "434", "x"), wireField("targetAmount", "434", "x"),
  ], "x")], "x"), { remainingDebt: 434 }, "x"), null, "podvojen fieldId mora fail-closed zavrniti plan");
  assert.equal(engine._test.materialize(wirePlan([wireGoal(1, "full_payment", [], "x")], "X"), { remainingDebt: 434 }, "x"), null, "top-level evidence mora biti dobeseden in občutljiv na zapis");
  var exhaustedGoal = engine._test.clarificationResult(wireClarification("Kaj želite?", "x"), { clarificationRound: 2 }, "x");
  assert.equal(exhaustedGoal.clarification, null);
  assert.equal(exhaustedGoal.clarificationExhausted, true);

  await assert.rejects(engine.analyze("plačilo", { remainingDebt: 434 }, { apiKey: "test", timeoutMs: 100, fetchImpl: function (_url, options) {
    return new Promise(function (_resolve, reject) { options.signal.addEventListener("abort", function () { var error = new Error("aborted"); error.name = "AbortError"; reject(error); }); });
  } }), function (error) { return error.code === "LUNA_TIMEOUT"; });

  var ui = fs.readFileSync(path.join(__dirname, "..", "app", "neplacila-cilj.js"), "utf8");
  var server = fs.readFileSync(path.join(__dirname, "local-server.js"), "utf8");
  var mux = fs.readFileSync(path.join(__dirname, "..", "api", "izvedi-opomin-ukrep.js"), "utf8");
  assert.match(ui, /data-cilj-pripravi/);
  assert.match(ui, /fetch\("\/api\/razcleni-cilj"/);
  assert.match(ui, /function jeLokalniAtenaPredogled\(\)/);
  assert.match(ui, /return "local-preview"/);
  assert.match(ui, /X-UJ-Local-Preview/);
  assert.match(ui, /contractVersion !== "goal-fact-v17"/);
  assert.match(ui, /catch \(error\)[\s\S]*ciljAiRequestId = "";[\s\S]*ciljAiStatus = "error"/);
  assert.match(ui, /ciljAiAktivniIndeks/);
  assert.match(ui, /Dopolnite ' \+ K\.esc\(naslovKoraka\)/);
  assert.match(ui, /data-cilj-clarification-answer/);
  assert.match(ui, /data-cilj-clarification-submit/);
  assert.match(ui, /clarificationRound: ciljClarificationRound/);
  assert.match(ui, /ciljAiPhase = "clarification_exhausted"/);
  assert.match(ui, /Pojasnilo uporabnika:/);
  assert.match(ui, /ciljAiPredlogi = podatki\.goals\.slice\(0, CILJ_AI_MAX_KORAKOV\)/);
  assert.match(ui, /izracunajCiljniDolg/);
  assert.match(ui, /ciljStevilcnoPolje\("targetAmount", "Ciljni znesek"/);
  assert.match(ui, /ciljDatumPolje\("remainingDeadline", "Rok za preostanek"/);
  assert.doesNotMatch(ui, /data-cilj-prihodnja-funkcija>Pripravi možnosti/);
  assert.match(server, /pathname === "\/api\/razcleni-cilj"/);
  assert.match(mux, /parameterPoti\(req, "handler"\) === "goal-ai"/);
  console.log("Ciljni Atena/Luna engine: PASS");
})().catch(function (error) { console.error(error); process.exitCode = 1; });
