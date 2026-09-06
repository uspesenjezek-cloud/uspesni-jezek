"use strict";

var fs = require("node:fs");
var path = require("node:path");
var engine = require("../api/_lib/cilj-naravni-vnos");
var args = process.argv.slice(2);
var countArg = args.find(function (arg) { return arg.indexOf("--count=") === 0; });
var offsetArg = args.find(function (arg) { return arg.indexOf("--offset=") === 0; });
var reportArg = args.find(function (arg) { return arg.indexOf("--report=") === 0; });
var concurrencyArg = args.find(function (arg) { return arg.indexOf("--concurrency=") === 0; });
var style100 = args.includes("--style-100");
var holdout100 = args.includes("--holdout-100");
if (holdout100) style100 = true;
var requestedCount = Math.max(1, Number(countArg && countArg.split("=")[1]) || Number.MAX_SAFE_INTEGER);
var requestedOffset = Math.max(0, Number(offsetArg && offsetArg.split("=")[1]) || 0);
var concurrency = Math.max(1, Math.min(3, Number(concurrencyArg && concurrencyArg.split("=")[1]) || 3));

if (!process.env.OPENAI_API_KEY) {
  var lokalnoOkolje = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  var openai = lokalnoOkolje.match(/^\s*OPENAI_API_KEY\s*=\s*["']?([^\r\n"']+)/m);
  if (openai) process.env.OPENAI_API_KEY = openai[1].trim();
}

function installmentSteps(count, fields) {
  return Array.from({ length: count }, function () { return { id: "installment_plan", fields: Object.assign({}, fields) }; });
}

var cases = [
  ["full_payment", "hočem da mi plača v celoti po telefonu do 15. septembra 2026", { targetAmount: "434", paymentDeadline: "2026-09-15", contactChannel: "phone" }],
  ["partial_payment_now", "naj mi takoj nakaže 100 evrov, ostalo pa bova razdelila na obroke", { requestedAmount: "100", remainingStrategy: "installments" }],
  ["clarification", "hočem da mi plača zdaj polovico jutri in pol pa do konca meseca", { questionIncludes: ["jutri"], questionOneOf: ["danes", "zdaj"] }, "split-deadline"],
  ["partial_payment_now", "polovico jutri, preostanek do konca meseca", { requestedAmount: "217", paymentDeadline: "2026-08-30", remainingStrategy: "new_deadline", remainingDeadline: "2026-08-31" }, "split-deadline"],
  ["multi_goal_steps", "želim da plača vse v 3h obrokih", { steps: installmentSteps(3, { installmentCount: "3", targetAmount: "434" }) }, "three-installments"],
  ["multi_goal_steps", "želim da plača vse v 5h obrokih", { steps: installmentSteps(5, { installmentCount: "5", targetAmount: "434" }) }, "five-installments"],
  ["multi_goal_steps", "hočem da mi plača v treh obrokih če ne grem do odvetnika", { steps: installmentSteps(3, { targetAmount: "72", installmentAmount: "24", installmentCount: "3" }).concat([{ id: "legal_recovery", fields: { legalOutcome: "legal_route_review" } }]) }, "reported-installment-lawyer", { remainingDebt: 72 }],
  ["multi_goal_steps", "naj mi dolg plača v 3 obrokih, sicer zadevo predam pravnemu zastopniku", { steps: installmentSteps(3, { targetAmount: "72", installmentAmount: "24", installmentCount: "3" }).concat([{ id: "legal_recovery", fields: { legalOutcome: "legal_route_review" } }]) }, "reported-installment-lawyer", { remainingDebt: 72 }],
  ["multi_goal_steps", "če trije obroki ne uspejo grem do odvetnika, najprej pa naj plača vseh 72 evrov v treh obrokih", { steps: installmentSteps(3, { targetAmount: "72", installmentAmount: "24", installmentCount: "3" }).concat([{ id: "legal_recovery", fields: { legalOutcome: "legal_route_review" } }]) }, "reported-installment-lawyer", { remainingDebt: 72 }],
  ["multi_goal_steps", "hočem tri obroke brez odvetnika", { steps: installmentSteps(3, { installmentCount: "3" }) }, "reported-installment-lawyer", { remainingDebt: 72 }],
  ["multi_goal_steps", "odvetnik je že klical, zdaj hočem da mi plača v treh obrokih", { steps: installmentSteps(3, { targetAmount: "72", installmentAmount: "24", installmentCount: "3" }) }, "reported-installment-lawyer", { remainingDebt: 72 }],
  ["multi_goal_steps", "želim da mi vse plača jutri... in da ga pokliče odvetnik čez 2 dni", { steps: [{ id: "full_payment", fields: { paymentDeadline: "2026-08-30" } }, { id: "legal_recovery", fields: { legalOutcome: "legal_notice_payment", legalDeadline: "2026-08-31" } }] }, "multi-goal-family"],
  ["multi_goal_steps", "čez dva dni naj ga pokliče odvetnik, jutri pa naj poravna ves dolg", { steps: [{ id: "legal_recovery", fields: { legalOutcome: "legal_notice_payment", legalDeadline: "2026-08-31" } }, { id: "full_payment", fields: { paymentDeadline: "2026-08-30" } }] }, "multi-goal-family"],
  ["multi_goal_steps", "najprej naj se s pogajanji reši ugovor glede računa, nato naj ves dolg plača do 1. oktobra", { steps: [{ id: "dispute_resolution", fields: { desiredOutcome: "negotiation" } }, { id: "full_payment", fields: { paymentDeadline: "2026-10-01" } }] }, "multi-goal-family"],
  ["multi_goal_steps", "jutri naj plača 100 evrov, preostanek pa na obroke, poleg tega naj do 20. septembra uredi poroštvo", { steps: [{ id: "partial_payment_now", fields: { requestedAmount: "100", paymentDeadline: "2026-08-30", remainingStrategy: "installments" } }, { id: "payment_security", fields: { securityType: "guarantee", securityDeadline: "2026-09-20" } }] }, "multi-goal-family"],
  ["multi_goal_steps", "želim ves dolg v štirih mesečnih obrokih po 108,50 evra, prvi 15. septembra", { steps: installmentSteps(4, { targetAmount: "434", installmentAmount: "108.5", installmentCount: "4", frequency: "monthly" }) }],
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

var holdoutCases = [
  ["full_payment", "ves odprti znesek 612 evrov naj nakaže do 7. septembra in potrdi po e-pošti", { targetAmount: "612", paymentDeadline: "2026-09-07", contactChannel: "email" }, null, { remainingDebt: 612 }],
  ["full_payment", "jutri pričakujem vseh 725 EUR, obvesti naj me z SMS-om", { targetAmount: "725", paymentDeadline: "2026-08-30", contactChannel: "sms" }, null, { remainingDebt: 725 }],
  ["partial_payment_now", "danes naj poravna 135 evrov, preostanek bova uredila z obroki", { requestedAmount: "135", paymentDeadline: "2026-08-29", remainingStrategy: "installments" }, null, { remainingDebt: 635 }],
  ["partial_payment_now", "jutri 220 evrov, razliko pa naj plača do 30. septembra", { requestedAmount: "220", paymentDeadline: "2026-08-30", remainingStrategy: "new_deadline", remainingDeadline: "2026-09-30" }, null, { remainingDebt: 820 }],
  ["multi_goal_steps", "celih 460 evrov hočem v dveh enakih obrokih", { steps: installmentSteps(2, { targetAmount: "460", installmentAmount: "230", installmentCount: "2" }) }, null, { remainingDebt: 460 }],
  ["multi_goal_steps", "700 EUR naj razdeli na štiri mesečna plačila po 175, prvo 10. septembra", { steps: installmentSteps(4, { targetAmount: "700", installmentAmount: "175", installmentCount: "4", firstPaymentDate: "2026-09-10", frequency: "monthly" }) }, null, { remainingDebt: 700 }],
  ["multi_goal_steps", "preostalih 333 evrov naj poravna v treh obrokih po 111", { steps: installmentSteps(3, { targetAmount: "333", installmentAmount: "111", installmentCount: "3" }) }, null, { remainingDebt: 333 }],
  ["multi_goal_steps", "naj plača 360 v treh obrokih po 120, če ne uspe pa primer predam pravniku", { steps: installmentSteps(3, { targetAmount: "360", installmentAmount: "120", installmentCount: "3" }).concat([{ id: "legal_recovery", fields: { legalOutcome: "legal_route_review" } }]) }, null, { remainingDebt: 360 }],
  ["multi_goal_steps", "če obroki odpovejo naj pravnica izbere nadaljnjo pot, prej pa dva obroka po 205", { steps: installmentSteps(2, { targetAmount: "410", installmentAmount: "205", installmentCount: "2" }).concat([{ id: "legal_recovery", fields: { legalOutcome: "legal_route_review" } }]) }, null, { remainingDebt: 410 }],
  ["multi_goal_steps", "do jutri naj plača vseh 590, čez štiri dni pa naj ga odvetnik pokliče glede plačila", { steps: [{ id: "full_payment", fields: { targetAmount: "590", paymentDeadline: "2026-08-30" } }, { id: "legal_recovery", fields: { legalOutcome: "legal_notice_payment", legalDeadline: "2026-09-02" } }] }, null, { remainingDebt: 590 }],
  ["multi_goal_steps", "najprej naj s pogajanji rešita spor o količini, potem do 12. oktobra poravna vseh 680", { steps: [{ id: "dispute_resolution", fields: { disputeTopic: "quantity", desiredOutcome: "negotiation" } }, { id: "full_payment", fields: { targetAmount: "680", paymentDeadline: "2026-10-12" } }] }, null, { remainingDebt: 680 }],
  ["payment_security", "za odprtih 905 evrov naj do 18. septembra zagotovi poroštvo", { securityType: "guarantee", securedAmount: "905", securityDeadline: "2026-09-18" }, null, { remainingDebt: 905 }],
  ["legal_recovery", "za 777 evrov začni izvršbo", { legalOutcome: "enforcement", legalAmount: "777" }, null, { remainingDebt: 777 }],
  ["legal_recovery", "odvetnica naj do 6. septembra pokliče dolžnika in zahteva plačilo 540 evrov", { legalOutcome: "legal_notice_payment", legalAmount: "540", legalDeadline: "2026-09-06" }, null, { remainingDebt: 540 }],
  ["legal_recovery", "pravnik naj oceni katera pravna pot je najboljša za 860 evrov", { legalOutcome: "legal_route_review", legalAmount: "860" }, null, { remainingDebt: 860 }],
  ["compensation", "pobotaj 145 evrov z nasprotno terjatvijo P-84", { compensationAmount: "145", counterclaimReference: "P-84" }],
  ["insolvency_claim", "prijavi terjatev v stečaj pod opravilno številko St 77/2026", { proceedingType: "bankruptcy", caseReference: "St 77/2026" }],
  ["new_deadline", "za vseh 488 evrov postavi nov rok 23. novembra in zahtevaj pisno potrditev", { targetAmount: "488", newDeadline: "2026-11-23", contactChannel: "written" }, null, { remainingDebt: 488 }],
  ["amicable_settlement", "sporazumno sprejmem 350 evrov do 9. oktobra v enem plačilu", { settlementAmount: "350", settlementDeadline: "2026-10-09", settlementApproach: "single_payment" }, null, { remainingDebt: 500 }],
  ["close_without_recovery", "odpišimo 275 evrov ker izterjava ni gospodarna", { closureReason: "uneconomical", writeOffAmount: "275" }, null, { remainingDebt: 275 }],
  ["custom_goal", "do 20. decembra naj vrne izposojeni laserski merilnik", { desiredDeadline: "2026-12-20" }],
  ["multi_goal_steps", "danes naj nakaže 160 evrov, ostalo na obroke, do 14. septembra pa podpiše priznanje dolga", { steps: [{ id: "partial_payment_now", fields: { requestedAmount: "160", paymentDeadline: "2026-08-29", remainingStrategy: "installments" } }, { id: "payment_security", fields: { securityType: "debt_acknowledgment", securityDeadline: "2026-09-14" } }] }, null, { remainingDebt: 760 }],
  ["multi_goal_steps", "čez tri dni naj odvetnik zahteva plačilo, jutri pa naj dolžnik poravna vseh 640 evrov", { steps: [{ id: "legal_recovery", fields: { legalOutcome: "legal_notice_payment", legalDeadline: "2026-09-01" } }, { id: "full_payment", fields: { targetAmount: "640", paymentDeadline: "2026-08-30" } }] }, null, { remainingDebt: 640 }],
  ["legal_recovery", "vloži plačilni nalog za 930 evrov", { legalOutcome: "payment_order_or_claim", legalAmount: "930" }, null, { remainingDebt: 930 }],
  ["legal_recovery", "izterjaj 815 evrov od dolžnika v Avstriji po čezmejni poti", { legalOutcome: "cross_border_recovery", legalAmount: "815" }, null, { remainingDebt: 815 }],
];

if (holdout100) cases = holdoutCases;

function brezSumnikov(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slogovneRazlicice(text) {
  var brez = brezSumnikov(text).toLowerCase();
  var kratko = brez
    .replace(/\bhočem\b/g, "hocm")
    .replace(/\bželim\b/g, "zelim")
    .replace(/\bnaj\b/g, "nej")
    .replace(/\bplača\b/g, "placa")
    .replace(/\bplačilo\b/g, "placilo")
    .replace(/\bpotem\b/g, "pol")
    .replace(/,(?=\s)/g, "")
    .replace(/\.(?=\s|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  var pogovorno = String(text || "")
    .replace(/\bželim\b/gi, "jst bi")
    .replace(/\bhočem\b/gi, "hocm")
    .replace(/\bnaj\b/gi, "nej")
    .replace(/\bpotem\b/gi, "pol")
    .replace(/\bplača\b/gi, "placa")
    .replace(/\bplačilo\b/gi, "placilo");
  return [
    String(text || ""),
    kratko + "...",
    "lej " + pogovorno + " .. tko bi",
    "nočem komplicirat: " + brez.replace(/\s+/g, " ").trim() + " ... to je to",
  ];
}

function exactReferenceFromSource(source, expected) {
  var needle = String(expected || "");
  var start = String(source || "").toLocaleLowerCase("sl").indexOf(needle.toLocaleLowerCase("sl"));
  return start < 0 ? expected : String(source).slice(start, start + needle.length);
}

function prilagodiExactReference(expected, source) {
  var copy = JSON.parse(JSON.stringify(expected));
  function adjust(fields) {
    ["counterclaimReference", "caseReference"].forEach(function (key) {
      if (fields && fields[key]) fields[key] = exactReferenceFromSource(source, fields[key]);
    });
  }
  if (copy && Array.isArray(copy.steps)) copy.steps.forEach(function (step) { adjust(step.fields); });
  else adjust(copy);
  return copy;
}

if (style100) {
  cases = cases.reduce(function (vsi, item, baseIndex) {
    return vsi.concat(slogovneRazlicice(item[1]).map(function (besedilo, slogIndex) {
      var kopija = item.slice();
      kopija[1] = besedilo;
      kopija[2] = prilagodiExactReference(item[2], besedilo);
      kopija[5] = { baseIndex: baseIndex, styleIndex: slogIndex };
      return kopija;
    }));
  }, []);
}
if (process.argv.includes("--split-deadline")) cases = cases.filter(function (item) { return item[3] === "split-deadline"; });
if (process.argv.includes("--three-installments")) cases = cases.filter(function (item) { return item[3] === "three-installments"; });
if (process.argv.includes("--five-installments")) cases = cases.filter(function (item) { return item[3] === "five-installments"; });
if (process.argv.includes("--multi-goal-family") || process.argv.includes("--payment-and-lawyer-call")) cases = cases.filter(function (item) { return item[3] === "multi-goal-family"; });
if (process.argv.includes("--reported-installment-lawyer")) cases = cases.filter(function (item) { return item[3] === "reported-installment-lawyer"; });
if (process.argv.includes("--reported-exact")) cases = cases.filter(function (item) { return item[1] === "hočem da mi plača v treh obrokih če ne grem do odvetnika"; });
if (process.argv.includes("--reported-sicer")) cases = cases.filter(function (item) { return item[1] === "naj mi dolg plača v 3 obrokih, sicer zadevo predam pravnemu zastopniku"; });
cases = cases.slice(requestedOffset, requestedOffset + requestedCount);

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
function sameField(field, expected, actual) {
  return /(?:Amount|amount)$/.test(field) ? sameAmount(expected, actual) : same(expected, actual);
}
async function run(item, index) {
  var started = Date.now();
  var rawOutput = "";
  var providerCalls = 0;
  try {
    var result = await engine.analyze(item[1], { remainingDebt: item[4] && item[4].remainingDebt || 434, referenceDate: "2026-08-29" }, { userId: "goal-v7-real-" + index, maxAttempts: 1, fetchImpl: async function (url, options) {
      providerCalls += 1;
      var response = await fetch(url, options);
      var payload = await response.clone().json().catch(function () { return {}; });
      var outputParts = [];
      (payload && Array.isArray(payload.output) ? payload.output : []).forEach(function (entry) {
        (entry && Array.isArray(entry.content) ? entry.content : []).forEach(function (content) {
          if (content && typeof content.text === "string") outputParts.push(content.text);
        });
      });
      rawOutput = String(payload && payload.output_text || outputParts.join("") || "").slice(0, 4000);
      return response;
    } });
    if (item[0] === "clarification") {
      var question = String(result.clarification && result.clarification.question || "").toLowerCase();
      var missingWords = item[2].questionIncludes.filter(function (word) { return !question.includes(word); });
      if (item[2].questionOneOf && !item[2].questionOneOf.some(function (word) { return question.includes(word); })) missingWords.push("danes/zdaj");
      return { ok: Boolean(result.goals && result.goals.length === 0 && question && missingWords.length === 0), ms: Date.now() - started, providerCalls: providerCalls, family: item[0], style: item[5] || null, source: item[1], mismatches: missingWords, actual: result.clarification || null };
    }
    if (item[0] === "multi_goal_steps") {
      var multiGoals = Array.isArray(result.goals) ? result.goals : [];
      var multiMismatch = multiGoals.length !== item[2].steps.length || multiGoals.some(function (goal, goalIndex) {
        var expectedStep = item[2].steps[goalIndex];
        if (!expectedStep || goal.goalId !== expectedStep.id || goal.stepNumber !== goalIndex + 1) return true;
        return Object.keys(expectedStep.fields || {}).some(function (field) { return !sameField(field, expectedStep.fields[field], goal.goalData[field]); });
      });
      if (!multiMismatch) multiMismatch = multiGoals.some(function (goal) { return Boolean(goal.goalData.note && item[2].steps.length > 1); });
      return { ok: !multiMismatch, ms: Date.now() - started, providerCalls: providerCalls, family: item[0], style: item[5] || null, source: item[1], mismatches: multiMismatch ? ["separate_future_intents"] : [], actual: multiGoals };
    }
    var goal = result.goals[0];
    var mismatches = [];
    if (!goal || goal.goalId !== item[0]) mismatches.push("goalId");
    Object.keys(item[2]).forEach(function (key) { if (!goal || !sameField(key, item[2][key], goal.goalData[key])) mismatches.push(key); });
    return { ok: mismatches.length === 0, ms: Date.now() - started, providerCalls: providerCalls, family: item[0], style: item[5] || null, source: item[1], mismatches: mismatches, actual: goal || null };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, providerCalls: providerCalls, family: item[0], style: item[5] || null, source: item[1], error: error.code || error.message, rawOutput: rawOutput || undefined };
  }
}

(async function () {
  var results = [];
  for (var offset = 0; offset < cases.length; offset += concurrency) {
    var batch = await Promise.all(cases.slice(offset, offset + concurrency).map(function (item, index) { return run(item, offset + index); }));
    results = results.concat(batch);
  }
  var times = results.map(function (item) { return item.ms; });
  var failed = results.filter(function (item) { return !item.ok; });
  var providerCalls = results.reduce(function (sum, item) { return sum + Number(item.providerCalls || 0); }, 0);
  var report = { generatedAt: new Date().toISOString(), contract: engine.CONTRACT_VERSION, model: engine.MODEL, cases: results.length, providerCalls: providerCalls, passed: results.length - failed.length, failed: failed.length, p50Ms: percentile(times, .5), p95Ms: percentile(times, .95), maxMs: Math.max.apply(Math, times), results: results, failures: failed };
  if (reportArg) {
    var reportPath = path.resolve(reportArg.slice("--report=".length));
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log("Poročilo: " + reportPath);
  }
  console.log(JSON.stringify(report, null, 2));
  if (failed.length || providerCalls !== results.length) process.exitCode = 1;
})().catch(function (error) { console.error(error); process.exitCode = 1; });
