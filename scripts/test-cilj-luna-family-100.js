"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var engine = require("../api/_lib/cilj-naravni-vnos");

var args = process.argv.slice(2);
function argValue(name, fallback) {
  var prefix = "--" + name + "=";
  var found = args.find(function (arg) { return arg.indexOf(prefix) === 0; });
  return found ? found.slice(prefix.length) : fallback;
}
var live = args.includes("--live");
var family = argValue("family", "goal-multi-step");
var seed = Math.max(0, Math.trunc(Number(argValue("seed", "0")) || 0));
var requestedCount = Math.max(1, Math.min(100, Math.trunc(Number(argValue("count", "100")) || 100)));
var concurrency = Math.max(1, Math.min(2, Math.trunc(Number(argValue("concurrency", "2")) || 2)));
var minStartGapMs = Math.max(0, Math.min(10000, Math.trunc(Number(argValue("min-start-gap-ms", "0")) || 0)));
var transportMaxAttempts = Math.max(1, Math.min(2, Math.trunc(Number(argValue("transport-max-attempts", "2")) || 2)));
var reportArg = argValue("report", "");

if (!process.env.OPENAI_API_KEY) {
  var envPath = path.join(__dirname, "..", ".env.local");
  var localEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  var match = localEnv.match(/^\s*OPENAI_API_KEY\s*=\s*["']?([^\r\n"']+)/m);
  if (match) process.env.OPENAI_API_KEY = match[1].trim();
}

function installmentSteps(count, fields) {
  return Array.from({ length: count }, function () {
    return { id: "installment_plan", fields: Object.assign({}, fields) };
  });
}

function style(text, index) {
  if (index % 5 === 0) return text;
  if (index % 5 === 1) return text.replace(/naj/g, "nej").replace(/plača/g, "placa").replace(/č/g, "c") + "...";
  if (index % 5 === 2) return "lej " + text.replace(/naj/g, "nej") + " .. tko bi";
  if (index % 5 === 3) return "nočem komplicirat: " + text + " ... to je to";
  return text.replace(/, /g, " pa ").replace(/potem/g, "pol");
}

function isoSeptember(day) { return "2026-09-" + String(day).padStart(2, "0"); }

function createGoalMultiStepCase(index, selectedSeed) {
  var archetype = index % 5;
  var variant = Math.floor(index / 5);
  var count = 2 + ((variant + selectedSeed) % 4);
  var each = 70 + selectedSeed * 101 + index * 3;
  var total = each * count;
  var day = 5 + ((index + selectedSeed * 3) % 20);
  var deadline = isoSeptember(day);
  var text;
  var steps;
  var debt = total;

  if (archetype === 0) {
    text = [
      "celih " + total + " evrov naj poravna v " + count + " obrokih po " + each,
      total + " EUR naj razdeli na " + count + " mesečnih obrokov po " + each,
      "preostali dolg " + total + " hočem v " + count + " enakih plačilih po " + each,
      "naj dolg " + total + " plača po delih: " + count + " obrokov, vsak " + each,
    ][variant % 4];
    steps = installmentSteps(count, { targetAmount: String(total), installmentAmount: String(each), installmentCount: String(count) });
  } else if (archetype === 1) {
    text = [
      "naj plača " + total + " v " + count + " obrokih po " + each + ", če ne uspe pa pravnica izbere nadaljnjo pravno pot",
      "če " + count + " obroki po " + each + " odpovejo, naj pravnik oceni najboljšo pot; dolg je " + total,
      "najprej " + count + " plačil po " + each + " za vseh " + total + ", sicer primer predam odvetniku v presojo",
      "za dolg " + total + " zahtevam " + count + " obrokov po " + each + ", kot rezervo pa pravno oceno poti",
    ][variant % 4];
    steps = installmentSteps(count, { targetAmount: String(total), installmentAmount: String(each), installmentCount: String(count) })
      .concat([{ id: "legal_recovery", fields: { legalOutcome: "legal_route_review" } }]);
  } else if (archetype === 2) {
    var lawyerFirst = variant % 2 === 1;
    text = lawyerFirst
      ? "do " + day + ". septembra naj odvetnica pokliče dolžnika glede plačila, nato naj poravna vseh " + total
      : "naj poravna vseh " + total + ", nato naj ga do " + day + ". septembra odvetnik pokliče glede plačila";
    var full = { id: "full_payment", fields: { targetAmount: String(total) } };
    var legal = { id: "legal_recovery", fields: { legalOutcome: "legal_notice_payment", legalDeadline: deadline } };
    steps = lawyerFirst ? [legal, full] : [full, legal];
  } else if (archetype === 3) {
    var disputeFirst = variant % 2 === 0;
    text = disputeFirst
      ? "najprej naj s pogajanji rešita spor o količini, potem naj poravna vseh " + total
      : "naj poravna vseh " + total + ", pred tem pa naj s pogajanji rešita spor o količini";
    var dispute = { id: "dispute_resolution", fields: { disputeTopic: "quantity", desiredOutcome: "negotiation" } };
    var payment = { id: "full_payment", fields: { targetAmount: String(total) } };
    steps = [dispute, payment];
  } else {
    var partial = 40 + selectedSeed * 17 + index;
    debt = partial + 500 + index * 5;
    text = "danes naj nakaže " + partial + " evrov, ostalo na obroke, do " + day + ". septembra pa podpiše priznanje dolga";
    steps = [
      { id: "partial_payment_now", fields: { requestedAmount: String(partial), paymentDeadline: "2026-08-29", remainingStrategy: "installments" } },
      { id: "payment_security", fields: { securityType: "debt_acknowledgment", securityDeadline: deadline } },
    ];
  }
  text = style(text, variant + selectedSeed);
  return { id: family + "-s" + selectedSeed + "-" + String(index + 1).padStart(3, "0"), family: family, seed: selectedSeed, source: text, remainingDebt: debt, steps: steps };
}

function createGoalEnumScalarCase(index, selectedSeed) {
  var archetype = index % 5;
  var variant = Math.floor(index / 5);
  var amount = 180 + selectedSeed * 137 + index * 7;
  var day = 5 + ((index + selectedSeed * 5) % 20);
  var deadline = isoSeptember(day);
  var text;
  var fields;
  var goalId;
  var debt = amount + 500 + index;

  if (archetype === 0) {
    var securities = [
      ["guarantee", "poroštvo"],
      ["collateral", "zastavo opreme"],
      ["debt_acknowledgment", "podpis priznanja dolga"],
      ["direct_debit", "SEPA direktno bremenitev"],
      ["other", "drugo obliko zavarovanja plačila"],
    ];
    var security = securities[(variant + selectedSeed) % securities.length];
    goalId = "payment_security";
    text = "do " + day + ". septembra naj zagotovi " + security[1] + " za " + amount + " evrov";
    fields = { securityType: security[0], securedAmount: String(amount), securityDeadline: deadline };
  } else if (archetype === 1) {
    var outcomes = [
      ["legal_notice_payment", "odvetnik pošlje pravni opomin za plačilo"],
      ["enforcement", "odvetnik začne izvršbo"],
      ["payment_order_or_claim", "odvetnik vloži plačilni nalog oziroma tožbo"],
      ["interim_protection", "odvetnik zahteva začasno sodno zaščito"],
      ["cross_border_recovery", "odvetnik začne čezmejno izterjavo v Avstriji"],
      ["legal_route_review", "odvetnik oceni najboljšo pravno pot"],
    ];
    var priorities = [["speed", "najhitreje"], ["cost", "z najnižjimi stroški"], ["success", "z največjo možnostjo uspeha"], ["balanced", "uravnoteženo glede časa in stroškov"]];
    var outcome = outcomes[(variant + selectedSeed) % outcomes.length];
    var priority = priorities[(variant * 3 + selectedSeed) % priorities.length];
    goalId = "legal_recovery";
    text = "za " + amount + " evrov naj " + outcome[1] + ", prednost je " + priority[1];
    fields = { legalOutcome: outcome[0], legalAmount: String(amount), legalPriority: priority[0] };
  } else if (archetype === 2) {
    var topics = [["quality", "kakovosti izvedbe"], ["quantity", "količini del"], ["invoice", "vsebini računa"], ["contract", "pogodbenih določilih"], ["other", "drugem odprtem ugovoru"]];
    var resolutions = [["full_payment", "potrdita celoten dolg"], ["partial_agreement", "dosežeta delni dogovor"], ["correction", "popravita račun"], ["negotiation", "zadevo rešita s pogajanji"]];
    var topic = topics[(variant + selectedSeed) % topics.length];
    var resolution = resolutions[(variant * 2 + selectedSeed) % resolutions.length];
    goalId = "dispute_resolution";
    text = "pri računu R-" + (selectedSeed + 1) + "-" + (index + 10) + " naj rešita spor o " + topic[1] + " tako da " + resolution[1];
    fields = { disputeTopic: topic[0], desiredOutcome: resolution[0] };
  } else if (archetype === 3) {
    var strategies = ["installments", "new_deadline", "later_agreement"];
    var strategy = strategies[(variant + selectedSeed) % strategies.length];
    goalId = "partial_payment_now";
    if (strategy === "installments") text = "danes naj plača " + amount + " evrov, preostanek pa na obroke";
    else if (strategy === "new_deadline") text = "danes naj plača " + amount + " evrov, preostanek pa do " + day + ". septembra";
    else text = "danes naj plača " + amount + " evrov, za preostanek se dogovorimo kasneje";
    fields = { requestedAmount: String(amount), paymentDeadline: "2026-08-29", remainingStrategy: strategy };
    if (strategy === "new_deadline") fields.remainingDeadline = deadline;
  } else {
    var approaches = [["single_payment", "v enem plačilu"], ["installments", "v obrokih"], ["mutual_concession", "z vzajemnimi popustitvami"]];
    var approach = approaches[(variant + selectedSeed) % approaches.length];
    goalId = "amicable_settlement";
    text = "sporazumno sprejmem " + amount + " evrov do " + day + ". septembra " + approach[1];
    fields = { settlementAmount: String(amount), settlementDeadline: deadline, settlementApproach: approach[0] };
  }
  text = style(text, variant + selectedSeed);
  return { id: "goal-enum-scalar-s" + selectedSeed + "-" + String(index + 1).padStart(3, "0"), family: "goal-enum-scalar", seed: selectedSeed, source: text, remainingDebt: debt, steps: [{ id: goalId, fields: fields }] };
}

function createCases() {
  var creator = family === "goal-multi-step" ? createGoalMultiStepCase : family === "goal-enum-scalar" ? createGoalEnumScalarCase : null;
  if (!creator) throw new Error("Unsupported family: " + family);
  return Array.from({ length: requestedCount }, function (_, index) { return creator(index, seed); });
}

function sameField(field, expected, actual) {
  if (/(?:Amount|amount)$/.test(field)) {
    var left = Number(expected);
    var right = Number(actual);
    return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 0.005;
  }
  return String(actual == null ? "" : actual) === String(expected);
}

function validateOracle(cases) {
  assert.equal(new Set(cases.map(function (item) { return item.id; })).size, cases.length, "duplicate case ID");
  assert.equal(new Set(cases.map(function (item) { return item.source; })).size, cases.length, "duplicate source");
  cases.forEach(function (item) {
    assert.ok(item.steps.length >= 1 && item.steps.length <= 6, item.id + " invalid step count");
    assert.ok(item.remainingDebt > 0, item.id + " invalid debt");
    item.steps.forEach(function (step) {
      assert.ok(step.id && step.fields, item.id + " incomplete oracle");
      var catalogGoal = engine._test.catalog.find(function (goal) { return goal.id === step.id; });
      assert.ok(catalogGoal, item.id + " unknown oracle goal " + step.id);
      Object.keys(step.fields).forEach(function (field) {
        assert.ok(catalogGoal.fields.includes(field), item.id + " incompatible oracle field " + field);
        var optionKey = field + ":" + step.fields[field];
        var knownEnumValues = Object.keys(engine._test.valueIdByFieldValue).filter(function (key) { return key.indexOf(field + ":") === 0; });
        if (knownEnumValues.length) assert.ok(engine._test.valueIdByFieldValue[optionKey], item.id + " unknown oracle enum " + optionKey);
      });
    });
  });
  return true;
}

function percentile(values, ratio) {
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] || 0;
}

function responseText(payload) {
  if (payload && typeof payload.output_text === "string") return payload.output_text;
  var pieces = [];
  (payload && Array.isArray(payload.output) ? payload.output : []).forEach(function (entry) {
    (entry && Array.isArray(entry.content) ? entry.content : []).forEach(function (content) {
      if (content && typeof content.text === "string") pieces.push(content.text);
    });
  });
  return pieces.join("");
}

var providerAdmission = Promise.resolve();
var nextProviderStartAt = 0;
function waitForProviderSlot() {
  if (!minStartGapMs) return Promise.resolve();
  var reservation = providerAdmission.then(async function () {
    var delayMs = Math.max(0, nextProviderStartAt - Date.now());
    if (delayMs) await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
    nextProviderStartAt = Date.now() + minStartGapMs;
  });
  providerAdmission = reservation.catch(function () {});
  return reservation;
}

async function runCase(item, index) {
  var started = Date.now();
  var rawOutput = "";
  var rawProviderPayload = "";
  var retryAfter = "";
  var providerCalls = 0;
  try {
    var result = await engine.analyze(item.source, { remainingDebt: item.remainingDebt, referenceDate: "2026-08-29" }, {
      userId: "goal-family-" + seed + "-" + index,
      maxAttempts: transportMaxAttempts,
      fetchImpl: async function (url, options) {
        await waitForProviderSlot();
        providerCalls += 1;
        var response = await fetch(url, options);
        var payload = await response.clone().json().catch(function () { return {}; });
        rawProviderPayload = JSON.stringify(payload).slice(0, 5000);
        retryAfter = response.headers && response.headers.get ? String(response.headers.get("retry-after") || "") : "";
        rawOutput = responseText(payload).slice(0, 5000);
        return response;
      },
    });
    var goals = Array.isArray(result.goals) ? result.goals : [];
    var mismatch = goals.length !== item.steps.length || goals.some(function (goal, goalIndex) {
      var expected = item.steps[goalIndex];
      if (!expected || goal.goalId !== expected.id || goal.stepNumber !== goalIndex + 1) return true;
      return Object.keys(expected.fields).some(function (field) { return !sameField(field, expected.fields[field], goal.goalData[field]); });
    });
    return { ok: !mismatch, id: item.id, source: item.source, ms: Date.now() - started, providerCalls: providerCalls, expected: item.steps, actual: goals, wireOutput: rawOutput, semanticPlan: result.semanticPlan || null };
  } catch (error) {
    return { ok: false, id: item.id, source: item.source, ms: Date.now() - started, providerCalls: providerCalls, expected: item.steps, error: error && error.code || error && error.message || String(error), retryAfter: retryAfter, rawOutput: rawOutput, rawProviderPayload: rawProviderPayload };
  }
}

async function main() {
  var cases = createCases();
  validateOracle(cases);
  var corpus = { family: family, seed: seed, count: cases.length, uniqueIds: new Set(cases.map(function (item) { return item.id; })).size, uniqueSources: new Set(cases.map(function (item) { return item.source; })).size, cases: cases };
  if (!live) {
    console.log(JSON.stringify({ family: corpus.family, seed: corpus.seed, count: corpus.count, uniqueIds: corpus.uniqueIds, uniqueSources: corpus.uniqueSources, oracle: "PASS" }, null, 2));
    return;
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  var results = new Array(cases.length);
  var cursor = 0;
  async function worker() {
    while (cursor < cases.length) {
      var index = cursor++;
      results[index] = await runCase(cases[index], index);
      if ((index + 1) % 5 === 0) console.log("Luna " + family + " seed " + seed + ": " + (index + 1) + "/" + cases.length);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  var times = results.map(function (item) { return item.ms; });
  var failures = results.filter(function (item) { return !item.ok; });
  var providerCalls = results.reduce(function (sum, item) { return sum + item.providerCalls; }, 0);
  var responseRetries = results.reduce(function (sum, item) { return sum + Number(item.semanticPlan && item.semanticPlan.transport && item.semanticPlan.transport.responseRetries || 0); }, 0);
  var report = { generatedAt: new Date().toISOString(), contract: engine.CONTRACT_VERSION, model: engine.MODEL, family: family, seed: seed, count: results.length, uniqueSources: corpus.uniqueSources, concurrency: concurrency, minStartGapMs: minStartGapMs, transportMaxAttempts: transportMaxAttempts, providerCalls: providerCalls, responseRetries: responseRetries, transportRetries: Math.max(0, providerCalls - results.length - responseRetries), passed: results.length - failures.length, failed: failures.length, p50Ms: percentile(times, .5), p95Ms: percentile(times, .95), maxMs: Math.max.apply(Math, times), failures: failures, results: results };
  if (reportArg) {
    var reportPath = path.resolve(reportArg);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    console.log("Poročilo: " + reportPath);
  }
  console.log("Goal family " + family + " seed " + seed + ": " + report.passed + "/" + report.count + "; p50 " + report.p50Ms + " ms; p95 " + report.p95Ms + " ms; max " + report.maxMs + " ms");
  if (report.failed || report.providerCalls < report.count) process.exitCode = 1;
}

main().catch(function (error) { console.error(error); process.exit(1); });

module.exports = { createGoalMultiStepCase: createGoalMultiStepCase, createGoalEnumScalarCase: createGoalEnumScalarCase, validateOracle: validateOracle };
