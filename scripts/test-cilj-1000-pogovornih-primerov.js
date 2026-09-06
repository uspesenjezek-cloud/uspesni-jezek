"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var engine = require("../api/_lib/cilj-naravni-vnos");

var SEED = 0xc11a1000;
var REFERENCE_DATE = "2026-09-01";
var cases = [];
var randomState = SEED >>> 0;
var externalCalls = 0;
var originalFetch = global.fetch;

global.fetch = async function () {
  externalCalls += 1;
  throw new Error("Zunanji klic je v offline testu prepovedan.");
};

function random() {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return (randomState >>> 0) / 4294967296;
}

function integer(min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function pick(values) {
  return values[Math.floor(random() * values.length)];
}

function isoDay(offset) {
  var date = new Date(REFERENCE_DATE + "T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function wireField(key, value, evidence) {
  var optionId = engine._test.valueIdByFieldValue[key + ":" + value];
  return {
    i: engine._test.fieldIdByKey[key],
    v: optionId ? null : String(value),
    o: optionId || null,
    e: evidence,
  };
}

function wireGoal(number, goalId, fields, evidence, confidence) {
  return {
    n: number,
    c: engine._test.cardIdByGoal[goalId],
    k: confidence || 1,
    f: fields || [],
    e: evidence,
  };
}

function wirePlan(goals, evidence) {
  return { p: goals, q: null, x: evidence };
}

function addValid(family, source, goals, expectedGoalIds, checks) {
  cases.push({
    id: String(cases.length + 1).padStart(4, "0"),
    family: family,
    kind: "valid",
    source: source,
    context: { remainingDebt: 2400 + integer(0, 60) * 10, referenceDate: REFERENCE_DATE },
    proposal: wirePlan(goals, source),
    expectedGoalIds: expectedGoalIds,
    checks: checks || {},
  });
}

function addClarification(index) {
  var source = "Želim urediti dolg, vendar še ne vem ali takoj ali po delih " + (index + 1);
  cases.push({
    id: String(cases.length + 1).padStart(4, "0"),
    family: "pojasnilo",
    kind: "clarification",
    source: source,
    context: { remainingDebt: 2400, referenceDate: REFERENCE_DATE, clarificationRound: index % 2 },
    proposal: { p: [], q: "Ali želite enkratno plačilo ali obroke?", x: source },
  });
}

function addInvalid(family, source, proposal, expectedReason) {
  cases.push({
    id: String(cases.length + 1).padStart(4, "0"),
    family: family,
    kind: "invalid",
    source: source,
    context: { remainingDebt: 2400, referenceDate: REFERENCE_DATE },
    proposal: proposal,
    expectedReason: expectedReason,
  });
}

for (var fullIndex = 0; fullIndex < 80; fullIndex += 1) {
  var fullAmount = 900 + integer(1, 90) * 10;
  var fullSource = "Plačilo celotnega dolga " + fullAmount + " EUR do " + isoDay(2 + fullIndex % 20) + " po e-pošti.";
  addValid("celotno-plačilo", fullSource, [wireGoal(1, "full_payment", [
    wireField("targetAmount", fullAmount, fullSource),
    wireField("paymentDeadline", isoDay(2 + fullIndex % 20), fullSource),
    wireField("contactChannel", "email", fullSource),
  ], fullSource)], ["full_payment"]);
}

for (var partialIndex = 0; partialIndex < 80; partialIndex += 1) {
  var partialAmount = 100 + integer(1, 40) * 10;
  var remainderMode = partialIndex % 3 === 0 ? "new_deadline" : partialIndex % 3 === 1 ? "installments" : "later_agreement";
  var partialSource = "Najprej " + partialAmount + " EUR do " + isoDay(1) + ", preostanek uredimo pozneje, primer " + (partialIndex + 1) + ".";
  var partialFields = [
    wireField("requestedAmount", partialAmount, partialSource),
    wireField("paymentDeadline", isoDay(1), partialSource),
    wireField("remainingStrategy", remainderMode, partialSource),
  ];
  if (remainderMode === "new_deadline") partialFields.push(wireField("remainingDeadline", isoDay(20), partialSource));
  addValid("delno-plačilo", partialSource, [wireGoal(1, "partial_payment_now", partialFields, partialSource)], ["partial_payment_now"]);
}

for (var installmentIndex = 0; installmentIndex < 150; installmentIndex += 1) {
  var installmentCount = 2 + installmentIndex % 4;
  var installmentAmount = 20 + integer(1, 80);
  var installmentTarget = installmentCount * installmentAmount;
  var installmentSource = "Dolg " + installmentTarget + " EUR naj plača v " + installmentCount + " mesečnih obrokih; če ne, primer preda odvetniku " + (installmentIndex + 1) + ".";
  var installmentGoals = [];
  for (var installmentStep = 1; installmentStep <= installmentCount; installmentStep += 1) {
    installmentGoals.push(wireGoal(installmentStep, "installment_plan", [
      wireField("targetAmount", installmentTarget, installmentSource),
      wireField("installmentCount", installmentCount, installmentSource),
      wireField("firstPaymentDate", isoDay(7), installmentSource),
      wireField("frequency", "monthly", installmentSource),
    ], installmentSource));
  }
  var installmentIds = Array(installmentCount).fill("installment_plan");
  if (installmentIndex % 5 === 0) {
    installmentGoals.push(wireGoal(installmentGoals.length + 1, "legal_recovery", [
      wireField("legalOutcome", "legal_route_review", installmentSource),
      wireField("legalNote", "preda odvetniku", installmentSource),
    ], installmentSource));
    installmentIds.push("legal_recovery");
  }
  addValid("obroki-in-pravni-fallback", installmentSource, installmentGoals, installmentIds, {
    installmentAmount: String(installmentAmount),
    installmentCount: installmentCount,
  });
}

for (var deadlineIndex = 0; deadlineIndex < 70; deadlineIndex += 1) {
  var deadlineAmount = 1000 + integer(1, 100) * 10;
  var deadlineSource = "Podaljšaj rok za vseh " + deadlineAmount + " EUR do " + isoDay(10 + deadlineIndex % 20) + ", obvestilo po SMS.";
  addValid("nov-rok", deadlineSource, [wireGoal(1, "new_deadline", [
    wireField("targetAmount", deadlineAmount, deadlineSource),
    wireField("newDeadline", isoDay(10 + deadlineIndex % 20), deadlineSource),
    wireField("contactChannel", "sms", deadlineSource),
  ], deadlineSource)], ["new_deadline"]);
}

for (var settlementIndex = 0; settlementIndex < 70; settlementIndex += 1) {
  var debt = 1800 + integer(1, 80) * 10;
  var forgiveness = 50 + (settlementIndex % 8) * 25;
  var settlementAmount = debt - forgiveness;
  var settlementSource = "Od dolga " + debt + " EUR odpustim " + forgiveness + " EUR, če " + settlementAmount + " EUR poravna do " + isoDay(14) + ".";
  addValid("poravnava-z-odpustkom", settlementSource, [wireGoal(1, "amicable_settlement", [
    wireField("settlementAmount", settlementAmount, settlementSource),
    wireField("settlementDeadline", isoDay(14), settlementSource),
    wireField("settlementApproach", "single_payment", settlementSource),
  ], settlementSource)], ["amicable_settlement"], { settlementAmount: String(settlementAmount) });
}

for (var disputeIndex = 0; disputeIndex < 60; disputeIndex += 1) {
  var disputeTopic = pick(["quality", "quantity", "invoice", "contract", "other"]);
  var disputeOutcome = pick(["full_payment", "partial_agreement", "correction", "negotiation"]);
  var disputeSource = "Najprej rešimo ugovor glede računa in dosežemo dogovor, primer " + (disputeIndex + 1) + ".";
  addValid("rešitev-ugovora", disputeSource, [wireGoal(1, "dispute_resolution", [
    wireField("disputeTopic", disputeTopic, disputeSource),
    wireField("desiredOutcome", disputeOutcome, disputeSource),
    wireField("disputeDescription", "ugovor glede računa", disputeSource),
  ], disputeSource)], ["dispute_resolution"]);
}

for (var compensationIndex = 0; compensationIndex < 60; compensationIndex += 1) {
  var compensationAmount = 100 + integer(1, 100) * 10;
  var compensationSource = "Pobotaj " + compensationAmount + " EUR z nasprotno terjatvijo R-" + (100 + compensationIndex) + ".";
  addValid("pobot", compensationSource, [wireGoal(1, "compensation", [
    wireField("compensationAmount", compensationAmount, compensationSource),
    wireField("counterclaimReference", "R-" + (100 + compensationIndex), compensationSource),
  ], compensationSource)], ["compensation"]);
}

for (var securityIndex = 0; securityIndex < 60; securityIndex += 1) {
  var securityType = pick(["guarantee", "collateral", "debt_acknowledgment", "direct_debit", "other"]);
  var securedAmount = 500 + integer(1, 100) * 10;
  var securitySource = "Zavaruj plačilo " + securedAmount + " EUR do " + isoDay(12) + ", primer " + (securityIndex + 1) + ".";
  addValid("zavarovanje-plačila", securitySource, [wireGoal(1, "payment_security", [
    wireField("securityType", securityType, securitySource),
    wireField("securedAmount", securedAmount, securitySource),
    wireField("securityDeadline", isoDay(12), securitySource),
  ], securitySource)], ["payment_security"]);
}

var legalOutcomes = ["legal_notice_payment", "enforcement", "payment_order_or_claim", "interim_protection", "cross_border_recovery", "legal_route_review"];
for (var legalIndex = 0; legalIndex < 100; legalIndex += 1) {
  var legalSource = "Odvetnik naj izvede pravni korak za izterjavo, primer " + (legalIndex + 1) + ".";
  var legalGoalCount = legalIndex % 10 === 0 ? 3 : 1;
  var legalGoals = [];
  var legalIds = [];
  for (var legalStep = 0; legalStep < legalGoalCount; legalStep += 1) {
    legalGoals.push(wireGoal(legalStep + 1, "legal_recovery", [
      wireField("legalOutcome", legalOutcomes[(legalIndex + legalStep) % legalOutcomes.length], legalSource),
      wireField("legalPriority", pick(["speed", "cost", "success", "balanced"]), legalSource),
      wireField("legalNote", "pravni korak za izterjavo", legalSource),
    ], legalSource));
    legalIds.push("legal_recovery");
  }
  addValid("pravna-izterjava", legalSource, legalGoals, legalIds);
}

for (var insolvencyIndex = 0; insolvencyIndex < 60; insolvencyIndex += 1) {
  var proceedingType = pick(["bankruptcy", "compulsory_settlement", "unknown"]);
  var insolvencySource = "Prijavi terjatev v insolvenčni postopek pod opravilno številko St " + (10 + insolvencyIndex) + "/2026.";
  addValid("insolvenčna-prijava", insolvencySource, [wireGoal(1, "insolvency_claim", [
    wireField("proceedingType", proceedingType, insolvencySource),
    wireField("caseReference", "St " + (10 + insolvencyIndex) + "/2026", insolvencySource),
  ], insolvencySource)], ["insolvency_claim"]);
}

for (var closeIndex = 0; closeIndex < 60; closeIndex += 1) {
  var closeAmount = 200 + integer(1, 100) * 10;
  var closeReason = pick(["uncollectible", "uneconomical", "business_decision", "other"]);
  var closeSource = "Zapri terjatev " + closeAmount + " EUR brez izterjave zaradi poslovne odločitve, primer " + (closeIndex + 1) + ".";
  addValid("zaključek-brez-izterjave", closeSource, [wireGoal(1, "close_without_recovery", [
    wireField("closureReason", closeReason, closeSource),
    wireField("writeOffAmount", closeAmount, closeSource),
    wireField("closureNote", "poslovne odločitve", closeSource),
  ], closeSource)], ["close_without_recovery"]);
}

for (var customIndex = 0; customIndex < 30; customIndex += 1) {
  var customSource = "Dolžnik naj vrne izposojeni stroj št. " + (customIndex + 1) + ".";
  addValid("drugi-cilj", customSource, [wireGoal(1, "custom_goal", [
    wireField("goalDescription", "vrne izposojeni stroj", customSource),
  ], customSource)], ["custom_goal"]);
}

for (var clarificationIndex = 0; clarificationIndex < 20; clarificationIndex += 1) addClarification(clarificationIndex);

var invalidSource = "veljaven dokaz v viru";
for (var invalidIndex = 0; invalidIndex < 100; invalidIndex += 1) {
  var invalidKind = invalidIndex % 10;
  var validFullGoal = wireGoal(1, "full_payment", [wireField("targetAmount", "2400", invalidSource)], invalidSource);
  if (invalidKind === 0) {
    addInvalid("zavrnitev-neznana-kartica", invalidSource, { p: [{ n: 1, c: 999, k: 1, f: [], e: invalidSource }], q: null, x: invalidSource }, "goal_card_id_unknown");
  } else if (invalidKind === 1) {
    addInvalid("zavrnitev-napačen-vrstni-red", invalidSource, wirePlan([Object.assign({}, validFullGoal, { n: 2 })], invalidSource), "goal_card_order");
  } else if (invalidKind === 2) {
    addInvalid("zavrnitev-nezdružljivo-polje", invalidSource, wirePlan([wireGoal(1, "full_payment", [wireField("requestedAmount", "100", invalidSource)], invalidSource)], invalidSource), "goal_field_incompatible");
  } else if (invalidKind === 3) {
    var duplicate = wireField("targetAmount", "2400", invalidSource);
    addInvalid("zavrnitev-podvojeno-polje", invalidSource, wirePlan([wireGoal(1, "full_payment", [duplicate, Object.assign({}, duplicate)], invalidSource)], invalidSource), "goal_field_duplicate");
  } else if (invalidKind === 4) {
    addInvalid("zavrnitev-nepovezan-dokaz-polja", invalidSource, wirePlan([wireGoal(1, "full_payment", [{ i: 101, v: "2400", o: null, e: "ni v viru" }], invalidSource)], invalidSource), "goal_field_evidence_unlinked");
  } else if (invalidKind === 5) {
    addInvalid("zavrnitev-nepovezan-vrhnji-dokaz", invalidSource, wirePlan([validFullGoal], "ni v viru"), "goal_top_evidence_unlinked");
  } else if (invalidKind === 6) {
    addInvalid("zavrnitev-neveljaven-enum", invalidSource, wirePlan([wireGoal(1, "full_payment", [{ i: 103, v: "golob", o: null, e: invalidSource }], invalidSource)], invalidSource), "goal_field_value_invalid:contactChannel");
  } else if (invalidKind === 7) {
    addInvalid("zavrnitev-neveljaven-znesek", invalidSource, wirePlan([wireGoal(1, "full_payment", [{ i: 101, v: "1e3", o: null, e: invalidSource }], invalidSource)], invalidSource), "goal_field_value_invalid:targetAmount");
  } else if (invalidKind === 8) {
    addInvalid("zavrnitev-plan-in-vprašanje", invalidSource, { p: [validFullGoal], q: "Kaj želite?", x: invalidSource }, "goal_plan_question_mixed");
  } else {
    addInvalid("zavrnitev-preveč-kartic", invalidSource, wirePlan(Array.from({ length: 51 }, function (_, index) {
      return wireGoal(index + 1, "full_payment", [], invalidSource);
    }), invalidSource), "goal_plan_count");
  }
}

assert.equal(cases.length, 1000, "Corpus mora vsebovati natanko 1000 primerov.");

function percentile(values, ratio) {
  var sorted = values.slice().sort(function (left, right) { return left - right; });
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function validateValid(testCase, result) {
  var issues = [];
  if (!Array.isArray(result)) return ["plan_rejected"];
  if (JSON.stringify(result.map(function (goal) { return goal.goalId; })) !== JSON.stringify(testCase.expectedGoalIds)) issues.push("goal_ids_or_order");
  if (result.some(function (goal, index) { return goal.stepNumber !== index + 1; })) issues.push("step_numbers");
  if (result.some(function (goal) { return goal.requiresHumanReview !== true; })) issues.push("human_review_boundary");
  if (result.some(function (goal) { return !Array.isArray(goal.fieldOrder) || !Array.isArray(goal.requiredFields) || !Array.isArray(goal.missing); })) issues.push("father_projection_shape");
  if (result.some(function (goal) { return goal.missing.length !== 0; })) issues.push("unexpected_missing_fields");
  if (testCase.checks.installmentAmount) {
    var installmentGoals = result.filter(function (goal) { return goal.goalId === "installment_plan"; });
    if (installmentGoals.length !== testCase.checks.installmentCount) issues.push("installment_card_count");
    if (installmentGoals.some(function (goal) { return goal.goalData.installmentAmount !== testCase.checks.installmentAmount || !goal.derivedFields.includes("installmentAmount"); })) issues.push("installment_arithmetic");
  }
  if (testCase.checks.settlementAmount && result[0].goalData.settlementAmount !== testCase.checks.settlementAmount) issues.push("settlement_amount");
  return issues;
}

function runCase(testCase) {
  var diagnostics = {};
  if (testCase.kind === "clarification") {
    var clarification = engine._test.clarificationResult(testCase.proposal, testCase.context, testCase.source);
    return clarification && clarification.clarification && clarification.goals.length === 0 ? [] : ["clarification_rejected"];
  }
  var result = engine._test.materialize(testCase.proposal, testCase.context, testCase.source, diagnostics);
  if (testCase.kind === "valid") return validateValid(testCase, result);
  if (result !== null) return ["invalid_plan_accepted"];
  if (diagnostics.reason !== testCase.expectedReason) return ["wrong_rejection_reason:" + (diagnostics.reason || "none")];
  return [];
}

function main() {
  var familyStats = {};
  var failures = [];
  var durations = [];
  cases.forEach(function (testCase) {
    var started = performance.now();
    var issues = runCase(testCase);
    durations.push(performance.now() - started);
    if (!familyStats[testCase.family]) familyStats[testCase.family] = { total: 0, passed: 0, failed: 0, causes: {} };
    familyStats[testCase.family].total += 1;
    if (!issues.length) familyStats[testCase.family].passed += 1;
    else {
      familyStats[testCase.family].failed += 1;
      issues.forEach(function (issue) {
        familyStats[testCase.family].causes[issue] = (familyStats[testCase.family].causes[issue] || 0) + 1;
      });
      failures.push({ id: testCase.id, family: testCase.family, source: testCase.source, issues: issues });
    }
  });

  var summary = {
    seed: SEED,
    referenceDate: REFERENCE_DATE,
    engineVersion: engine.ATENA_ENGINE_VERSION,
    contractVersion: engine.CONTRACT_VERSION,
    total: cases.length,
    passed: cases.length - failures.length,
    failed: failures.length,
    acceptedValidPlans: cases.filter(function (item) { return item.kind === "valid"; }).length,
    acceptedClarifications: cases.filter(function (item) { return item.kind === "clarification"; }).length,
    rejectedInvalidPlans: cases.filter(function (item) { return item.kind === "invalid"; }).length,
    externalCalls: externalCalls,
    families: familyStats,
    timingMs: {
      p50: percentile(durations, 0.50),
      p95: percentile(durations, 0.95),
      max: Math.max.apply(Math, durations),
    },
  };

  Object.keys(familyStats).forEach(function (family) {
    var stat = familyStats[family];
    console.log((stat.failed ? "✗" : "✓") + " " + family + ": " + stat.passed + "/" + stat.total + (stat.failed ? " " + JSON.stringify(stat.causes) : ""));
  });
  console.log("Skupaj " + summary.passed + "/" + summary.total + "; veljavni " + summary.acceptedValidPlans + ", pojasnila " + summary.acceptedClarifications + ", zavrnitve " + summary.rejectedInvalidPlans + "; p95 " + summary.timingMs.p95.toFixed(3) + " ms; zunanji klici " + summary.externalCalls + ".");

  var reportArg = process.argv.find(function (argument) { return argument.indexOf("--report=") === 0; });
  if (reportArg) {
    var reportPath = path.resolve(process.cwd(), reportArg.slice("--report=".length));
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ summary: summary, failures: failures }, null, 2) + "\n", "utf8");
    console.log("Poročilo: " + reportPath);
  }

  assert.equal(externalCalls, 0, "Offline test ne sme izvesti zunanjega klica.");
  assert.ok(summary.timingMs.p95 <= 10, "Cilji p95 je presegel varni lokalni proračun 10 ms.");
  assert.ok(summary.timingMs.max <= 500, "Cilji so v enem primeru presegli varni lokalni proračun 500 ms.");
  if (failures.length) assert.fail(failures.length + " od 1000 ciljnih primerov ni prestalo preverjanja.");
}

try {
  main();
} finally {
  global.fetch = originalFetch;
}
