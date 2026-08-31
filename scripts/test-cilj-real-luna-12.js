"use strict";

var fs = require("node:fs");
var path = require("node:path");
var engine = require("../api/_lib/cilj-naravni-vnos");

if (!process.env.OPENAI_API_KEY) {
  var lokalnoOkolje = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  var openai = lokalnoOkolje.match(/^\s*OPENAI_API_KEY\s*=\s*["']?([^\r\n"']+)/m);
  if (openai) process.env.OPENAI_API_KEY = openai[1].trim();
}

var cases = [
  ["full_payment", "hočem da mi plača v celoti po telefonu do 15. septembra 2026", { targetAmount: "434", paymentDeadline: "2026-09-15", contactChannel: "phone" }],
  ["partial_payment_now", "naj mi takoj nakaže 100 evrov, ostalo pa bova razdelila na obroke", { requestedAmount: "100", remainingStrategy: "installments" }],
  ["clarification", "hočem da mi plača zdaj polovico jutri in pol pa do konca meseca", { questionIncludes: ["jutri"], questionOneOf: ["danes", "zdaj"] }, "split-deadline"],
  ["partial_payment_now", "polovico jutri, preostanek do konca meseca", { requestedAmount: "217", paymentDeadline: "2026-08-30", remainingStrategy: "new_deadline", remainingDeadline: "2026-08-31" }, "split-deadline"],
  ["installment_steps", "želim da plača vse v 3h obrokih", { count: 3, installmentCount: "3", targetAmount: "434" }, "three-installments"],
  ["installment_steps", "želim da plača vse v 5h obrokih", { count: 5, installmentCount: "5", targetAmount: "434" }, "five-installments"],
  ["multi_goal_steps", "želim da mi vse plača jutri... in da ga pokliče odvetnik čez 2 dni", { steps: [{ id: "full_payment", fields: { paymentDeadline: "2026-08-30" } }, { id: "custom_goal", fields: { desiredDeadline: "2026-08-31" } }] }, "multi-goal-family"],
  ["multi_goal_steps", "čez dva dni naj ga pokliče odvetnik, jutri pa naj poravna ves dolg", { steps: [{ id: "custom_goal", fields: { desiredDeadline: "2026-08-31" } }, { id: "full_payment", fields: { paymentDeadline: "2026-08-30" } }] }, "multi-goal-family"],
  ["multi_goal_steps", "najprej naj se s pogajanji reši ugovor glede računa, nato naj ves dolg plača do 1. oktobra", { steps: [{ id: "dispute_resolution", fields: { desiredOutcome: "negotiation" } }, { id: "full_payment", fields: { paymentDeadline: "2026-10-01" } }] }, "multi-goal-family"],
  ["multi_goal_steps", "jutri naj plača 100 evrov, preostanek pa na obroke, poleg tega naj do 20. septembra uredi poroštvo", { steps: [{ id: "partial_payment_now", fields: { requestedAmount: "100", paymentDeadline: "2026-08-30", remainingStrategy: "installments" } }, { id: "payment_security", fields: { securityType: "guarantee", securityDeadline: "2026-09-20" } }] }, "multi-goal-family"],
  ["installment_plan", "želim ves dolg v štirih mesečnih obrokih po 108,50 evra, prvi 15. septembra", { targetAmount: "434", installmentAmount: "108.5", installmentCount: "4", frequency: "monthly" }],
  ["new_deadline", "podaljšajmo rok za ves preostanek na 29. november, novi rok naj potrdi po e-pošti", { targetAmount: "434", newDeadline: "2026-11-29", contactChannel: "email" }],
  ["amicable_settlement", "sporazumno bi sprejel 300 evrov do prvega oktobra v enem plačilu", { settlementAmount: "300", settlementDeadline: "2026-10-01", settlementApproach: "single_payment" }],
  ["dispute_resolution", "najprej rešimo njegov ugovor glede vsebine računa s pogajanji", { disputeTopic: "invoice", desiredOutcome: "negotiation" }],
  ["compensation", "cilj je pobot 120 evrov z nasprotno terjatvijo R-22", { compensationAmount: "120", counterclaimReference: "R-22" }],
  ["payment_security", "za celoten dolg zahtevam poroštvo urejeno do 20. septembra", { securityType: "guarantee", securedAmount: "434", securityDeadline: "2026-09-20" }],
  ["legal_recovery", "želim izvršbo za vseh 434 evrov", { legalOutcome: "enforcement", legalAmount: "434" }],
  ["insolvency_claim", "terjatev želim prijaviti v stečaj z opravilno številko St 22/2026", { proceedingType: "bankruptcy", caseReference: "St 22/2026" }],
  ["close_without_recovery", "zaključimo vseh 434 evrov, ker terjatev ni izterljiva", { closureReason: "uncollectible", writeOffAmount: "434" }],
  ["custom_goal", "poleg dolga želim, da mi do 31. decembra vrne izposojeni kompresor", { desiredDeadline: "2026-12-31" }],
];
if (process.argv.includes("--split-deadline")) cases = cases.filter(function (item) { return item[3] === "split-deadline"; });
if (process.argv.includes("--three-installments")) cases = cases.filter(function (item) { return item[3] === "three-installments"; });
if (process.argv.includes("--five-installments")) cases = cases.filter(function (item) { return item[3] === "five-installments"; });
if (process.argv.includes("--multi-goal-family") || process.argv.includes("--payment-and-lawyer-call")) cases = cases.filter(function (item) { return item[3] === "multi-goal-family"; });

function percentile(values, ratio) {
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] || 0;
}
function same(expected, actual) { return String(actual == null ? "" : actual) === String(expected); }
function sameAmount(expected, actual) {
  var expectedNumber = Number(expected);
  var actualNumber = Number(actual);
  return Number.isFinite(expectedNumber) && Number.isFinite(actualNumber) && Math.abs(expectedNumber - actualNumber) < 0.005;
}
async function run(item, index) {
  var started = Date.now();
  try {
    var result = await engine.analyze(item[1], { remainingDebt: 434, referenceDate: "2026-08-29" }, { userId: "goal-v6-real-" + index });
    if (item[0] === "clarification") {
      var question = String(result.clarification && result.clarification.question || "").toLowerCase();
      var missingWords = item[2].questionIncludes.filter(function (word) { return !question.includes(word); });
      if (item[2].questionOneOf && !item[2].questionOneOf.some(function (word) { return question.includes(word); })) missingWords.push("danes/zdaj");
      return { ok: Boolean(result.goals && result.goals.length === 0 && question && missingWords.length === 0), ms: Date.now() - started, family: item[0], mismatches: missingWords, actual: result.clarification || null };
    }
    if (item[0] === "installment_steps") {
      var installmentGoals = Array.isArray(result.goals) ? result.goals : [];
      var installmentAmounts = installmentGoals.map(function (goal) {
        return goal && goal.goalData && goal.goalData.installmentAmount;
      }).filter(function (value) { return value !== undefined && value !== null && value !== ""; });
      var installmentSum = installmentAmounts.reduce(function (sum, value) { return sum + Number(value); }, 0);
      var invalidInstallmentSum = installmentAmounts.length === installmentGoals.length && !sameAmount(item[2].targetAmount, installmentSum);
      var installmentMismatch = installmentGoals.length !== item[2].count || invalidInstallmentSum || installmentGoals.some(function (goal, goalIndex) {
        return goal.goalId !== "installment_plan" || goal.stepNumber !== goalIndex + 1 || !same(item[2].installmentCount, goal.goalData.installmentCount) || !sameAmount(item[2].targetAmount, goal.goalData.targetAmount);
      });
      return { ok: !installmentMismatch, ms: Date.now() - started, family: item[0], mismatches: installmentMismatch ? ["ordered_installment_steps"] : [], actual: installmentGoals };
    }
    if (item[0] === "multi_goal_steps") {
      var multiGoals = Array.isArray(result.goals) ? result.goals : [];
      var multiMismatch = multiGoals.length !== item[2].steps.length || multiGoals.some(function (goal, goalIndex) {
        var expectedStep = item[2].steps[goalIndex];
        if (!expectedStep || goal.goalId !== expectedStep.id || goal.stepNumber !== goalIndex + 1) return true;
        return Object.keys(expectedStep.fields || {}).some(function (field) { return !same(expectedStep.fields[field], goal.goalData[field]); });
      });
      if (!multiMismatch) multiMismatch = multiGoals.some(function (goal) { return Boolean(goal.goalData.note && item[2].steps.length > 1); });
      return { ok: !multiMismatch, ms: Date.now() - started, family: item[0], mismatches: multiMismatch ? ["separate_future_intents"] : [], actual: multiGoals };
    }
    var goal = result.goals[0];
    var mismatches = [];
    if (!goal || goal.goalId !== item[0]) mismatches.push("goalId");
    Object.keys(item[2]).forEach(function (key) { if (!goal || !same(item[2][key], goal.goalData[key])) mismatches.push(key); });
    return { ok: mismatches.length === 0, ms: Date.now() - started, family: item[0], mismatches: mismatches, actual: goal || null };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, family: item[0], error: error.code || error.message };
  }
}

(async function () {
  var results = [];
  for (var offset = 0; offset < cases.length; offset += 3) {
    var batch = await Promise.all(cases.slice(offset, offset + 3).map(function (item, index) { return run(item, offset + index); }));
    results = results.concat(batch);
  }
  var times = results.map(function (item) { return item.ms; });
  var failed = results.filter(function (item) { return !item.ok; });
  console.log(JSON.stringify({ contract: engine.CONTRACT_VERSION, model: engine.MODEL, actualAttempts: results.length, passed: results.length - failed.length, failed: failed.length, p50Ms: percentile(times, .5), p95Ms: percentile(times, .95), maxMs: Math.max.apply(Math, times), failures: failed }, null, 2));
  if (failed.length) process.exitCode = 1;
})().catch(function (error) { console.error(error); process.exitCode = 1; });
