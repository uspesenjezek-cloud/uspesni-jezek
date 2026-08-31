"use strict";

var fs = require("node:fs");
var path = require("node:path");
var parser = require("../api/_lib/zgodovina-naravni-vnos");

var REFERENCE_DATE = "2026-08-29";
var DEBT = 9446;
var CONTEXT = { referenceDate: REFERENCE_DATE, originalDebt: DEBT, remainingDebt: DEBT };
var args = process.argv.slice(2);
var liveApproved = args.includes("--live");
var reportArg = args.find(function (arg) { return arg.indexOf("--report=") === 0; });
var concurrencyArg = args.find(function (arg) { return arg.indexOf("--concurrency=") === 0; });
var countArg = args.find(function (arg) { return arg.indexOf("--count=") === 0; });
var offsetArg = args.find(function (arg) { return arg.indexOf("--offset=") === 0; });
var suiteArg = args.find(function (arg) { return arg.indexOf("--suite=") === 0; });
var concurrency = Math.max(1, Math.min(4, Number(concurrencyArg && concurrencyArg.split("=")[1]) || 2));
var caseCount = Math.max(1, Math.min(100, Number(countArg && countArg.split("=")[1]) || 100));
var caseOffset = Math.max(0, Number(offsetArg && offsetArg.split("=")[1]) || 0);
var suite = suiteArg ? suiteArg.split("=")[1] : "payments";

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function shiftDate(days) {
  var date = new Date(REFERENCE_DATE + "T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftMonth(months) {
  var date = new Date(REFERENCE_DATE + "T12:00:00.000Z");
  var day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  var lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

function payment(amount, date, method) {
  return { type: "partial_payment", amount: amount, occurredDate: date, paymentMethod: method || null };
}

function createCase(index) {
  var variant = index % 10;
  var round = Math.floor(index / 10);
  var first = 700 + round * 31 + variant * 7;
  var second = 300 + round * 23 + variant * 11;
  var third = 100 + round * 17 + variant * 13;
  var typo = ["zajaj", "nasaj", "nazai", "naazj", "nzaaj"][index % 5];
  var text;
  var dates;
  var methods = [null, null, null];
  if (variant === 0) {
    text = "mesec dni nazaj je placal " + first + " nato 2 tedna " + typo + " " + second + " in danes pa " + third + ".. ostalo ni placal";
    dates = [shiftMonth(-1), shiftDate(-14), REFERENCE_DATE];
  } else if (variant === 1) {
    text = "dolznik je placal mesec dni nazaj " + first + " dva tedna " + typo + " " + second + " danes pa je placal se " + third + " ostalo ni poravnal";
    dates = [shiftMonth(-1), shiftDate(-14), REFERENCE_DATE];
  } else if (variant === 2) {
    text = "placal je " + first + " mesec dni nazaj... " + second + " dva tedna " + typo + " in " + third + " danes preostanka ni placal";
    dates = [shiftMonth(-1), shiftDate(-14), REFERENCE_DATE];
  } else if (variant === 3) {
    text = "tri tedne nazaj je placal " + first + " nato 2tedna " + typo + " " + second + " vceraj pa " + third + " potem nic vec";
    dates = [shiftDate(-21), shiftDate(-14), shiftDate(-1)];
  } else if (variant === 4) {
    text = "placal je " + first + " tri tedne nazaj, dva tedna " + typo + " " + second + ", danes pa se " + third + "; vse ostalo ni placal";
    dates = [shiftDate(-21), shiftDate(-14), REFERENCE_DATE];
  } else if (variant === 5) {
    text = "pred 21 dnevi je placal " + first + " potem pred 14 dnevi " + second + " in danes " + third + " ostalo pa ni poravnal";
    dates = [shiftDate(-21), shiftDate(-14), REFERENCE_DATE];
  } else if (variant === 6) {
    text = "dolznik je placal " + first + " pred tremi tedni... pred dvema tednoma " + second + " vceraj pa se " + third + " in potem ni vec placal";
    dates = [shiftDate(-21), shiftDate(-14), shiftDate(-1)];
  } else if (variant === 7) {
    text = "3 tedne nazaj " + first + " nato 2tedna nazaj " + second + " danes pa je placal " + third + "... ostalo je ostalo neplacano";
    dates = [shiftDate(-21), shiftDate(-14), REFERENCE_DATE];
  } else if (variant === 8) {
    methods = ["bank_transfer", "card", "cash"];
    text = "mesec dni nazaj je placal " + first + " z nakazilom potem 2 tedna " + typo + " " + second + " s kartico danes pa " + third + " v gotovini ostalo ni placal";
    dates = [shiftMonth(-1), shiftDate(-14), REFERENCE_DATE];
  } else {
    text = "mesec dni nazaj " + first + "... nato dva tedna " + typo + " pa " + second + " in danes pa je placal se " + third + " eur drugo pa ni placal";
    dates = [shiftMonth(-1), shiftDate(-14), REFERENCE_DATE];
  }
  var remaining = roundMoney(DEBT - first - second - third);
  return {
    id: String(index + 1).padStart(3, "0"),
    text: text,
    events: [payment(first, dates[0], methods[0]), payment(second, dates[1], methods[1]), payment(third, dates[2], methods[2]), {
      type: "remaining_unpaid", amount: remaining, occurredDate: null, paymentMethod: null,
    }],
    ledger: [roundMoney(DEBT - first), roundMoney(DEBT - first - second), remaining, remaining],
  };
}

function createMonthOnlyCase(index) {
  var amount = 240 + index * 17;
  var phrases = [
    "prejšni mesec", "prejsni mesec", "prejšnji mesec", "prejsnji mesec", "prejšn mesec",
    "prejsn mesec", "v prejšnem mesecu", "v prejsnem mesecu", "prejšnji mesc", "prejsni mesc",
  ];
  var phrase = phrases[index % phrases.length];
  var templates = [
    phrase + " je plačal " + amount + " evrov",
    "plačal je " + amount + " EUR " + phrase,
    "dolžnik je " + phrase + " poravnal " + amount,
    phrase + " nakazal " + amount + " evrov",
    "enkrat " + phrase + " je dal " + amount + " eur",
  ];
  var method = index % 5 === 3 ? "bank_transfer" : null;
  return {
    id: "month-" + String(index + 1).padStart(3, "0"),
    text: templates[index % templates.length],
    events: [{
      type: "partial_payment", amount: amount, occurredDate: null, paymentMethod: method,
      occurredDateApproximate: true, occurredDateApproximation: "prejšnji mesec",
    }],
    ledger: [roundMoney(DEBT - amount)],
  };
}

function createLeanCase(index) {
  var family = index % 10;
  var round = Math.floor(index / 10);
  var total2 = 100 + round * 20;
  var each2 = 70 + round * 10;
  var total3 = 150 + round * 30;
  var each3 = 40 + round * 10;
  var first = 900 + round * 50;
  var second = 300 + round * 20;
  var third = 100 + round * 10;
  var text;
  var events;
  if (family === 0) {
    text = "danes je v 2 obrokih plačal " + total2 + " evrov";
    events = [payment(total2 / 2, REFERENCE_DATE), payment(total2 / 2, REFERENCE_DATE)];
  } else if (family === 1) {
    text = "danes je plačal 2 obroka po " + each2 + " evrov";
    events = [payment(each2, REFERENCE_DATE), payment(each2, REFERENCE_DATE)];
  } else if (family === 2) {
    text = "v 2h obrokih je danes poravnal skupaj " + total2 + " EUR";
    events = [payment(total2 / 2, REFERENCE_DATE), payment(total2 / 2, REFERENCE_DATE)];
  } else if (family === 3) {
    text = "danes je poravnal 2 obroka skupaj " + total2 + " evrov";
    events = [payment(total2 / 2, REFERENCE_DATE), payment(total2 / 2, REFERENCE_DATE)];
  } else if (family === 4) {
    text = "danes je v dveh obrokih plačal po " + each2 + " evrov";
    events = [payment(each2, REFERENCE_DATE), payment(each2, REFERENCE_DATE)];
  } else if (family === 5) {
    text = "plačal je " + first + " evrov 14 dni nazaj, potem pa danes v 2eh obrokih še " + total2 + " evrov";
    events = [payment(first, "2026-08-15"), payment(total2 / 2, REFERENCE_DATE), payment(total2 / 2, REFERENCE_DATE)];
  } else if (family === 6) {
    text = "danes je v 3 obrokih plačal skupaj " + total3 + " evrov";
    events = [payment(total3 / 3, REFERENCE_DATE), payment(total3 / 3, REFERENCE_DATE), payment(total3 / 3, REFERENCE_DATE)];
  } else if (family === 7) {
    text = "danes je plačal 3 obroke po " + each3 + " evrov";
    events = [payment(each3, REFERENCE_DATE), payment(each3, REFERENCE_DATE), payment(each3, REFERENCE_DATE)];
  } else if (family === 8) {
    text = "pred 14 dnevi je plačal " + first + " evrov, pred 7 dnevi " + second + " evrov in danes še " + third + " evrov";
    events = [payment(first, "2026-08-15"), payment(second, "2026-08-22"), payment(third, REFERENCE_DATE)];
  } else {
    text = "pred 14 dnevi je plačal " + first + " evrov, pred 7 dnevi " + second + " evrov in danes še " + third + " evrov, ostalo ni plačal";
    events = [payment(first, "2026-08-15"), payment(second, "2026-08-22"), payment(third, REFERENCE_DATE), {
      type: "remaining_unpaid", amount: roundMoney(DEBT - first - second - third), occurredDate: null, paymentMethod: null,
    }];
  }
  var remaining = DEBT;
  var ledger = events.map(function (event) {
    if (event.type === "partial_payment") remaining = roundMoney(remaining - event.amount);
    return remaining;
  });
  events = events.map(function (event) {
    if (event.type !== "partial_payment" || events.length < 2 || family === 8 || family === 9 || (family === 5 && event === events[0])) return event;
    return Object.assign({}, event, { type: "installment_payment" });
  });
  return { id: "lean-" + String(index + 1).padStart(3, "0"), family: "family-" + family, text: text, events: events, ledger: ledger };
}

function loadApiKey() {
  if (process.env.OPENAI_API_KEY) return String(process.env.OPENAI_API_KEY).trim();
  var file = path.join(__dirname, "..", ".env.local");
  var raw = fs.readFileSync(file, "utf8");
  var line = raw.split(/\r?\n/).find(function (item) { return /^\s*OPENAI_API_KEY\s*=/.test(item); });
  if (!line) return "";
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

function rawPlan(payload, proposal, contract) {
  try {
    var text = parser._test.responseText(payload);
    if (text.trim() === "OK") return proposal.map(function (item) {
      return { clauseId: item.clauseId || null, eventType: item.eventType || null, inheritedFrom: item.inheritedFrom || null };
    });
    var parsed = JSON.parse(text);
    if (Array.isArray(parsed.fix) || Array.isArray(parsed.plan) || Array.isArray(parsed.p)) {
      var review = parser._test.parsePlanReview(text, proposal, contract);
      if (review.ok) return review.links.map(function (item) {
        return { clauseId: item.clauseId || null, eventType: item.eventType || null, inheritedFrom: item.inheritedFrom || null };
      });
    }
    if (Array.isArray(parsed.links)) return parsed.links.map(function (item) {
      return { clauseId: item.clauseId || null, eventType: item.eventType || null, inheritedFrom: item.inheritedFrom || null };
    });
    return Array.isArray(parsed.events) ? parsed.events.map(function (item) {
      return { clauseId: item.evidenceClauseId || null, eventType: item.type || null, inheritedFrom: item.inheritedFrom || null };
    }) : [];
  } catch (_error) {
    return [];
  }
}

function compareFinal(testCase, result) {
  var issues = [];
  var candidates = result && Array.isArray(result.candidates) ? result.candidates : [];
  if (!result.semanticPlan || result.semanticPlan.requested !== true || result.semanticPlan.attempted !== true) issues.push("luna_not_attempted");
  if (!result.coverage || result.coverage.complete !== true) issues.push("coverage");
  if (candidates.length !== testCase.events.length) issues.push("event_count");
  testCase.events.forEach(function (expected, index) {
    var actual = candidates[index];
    if (!actual) return;
    if (actual.type !== expected.type) issues.push("type:" + index);
    if (roundMoney(actual.amount) !== roundMoney(expected.amount)) issues.push("amount:" + index);
    if ((actual.occurredDate || null) !== expected.occurredDate) issues.push("date:" + index);
    if (expected.occurredDateApproximate === true && actual.occurredDateApproximate !== true) issues.push("date_precision:" + index);
    if (expected.occurredDateApproximation && actual.occurredDateApproximation !== expected.occurredDateApproximation) issues.push("date_label:" + index);
    if ((actual.paymentMethod || null) !== expected.paymentMethod) issues.push("method:" + index);
  });
  var ledger = (result.ledger || []).map(function (entry) { return roundMoney(entry.afterEur); });
  if (JSON.stringify(ledger) !== JSON.stringify(testCase.ledger)) issues.push("ledger");
  if (candidates.some(function (candidate, index) { return testCase.events[index] && !testCase.events[index].paymentMethod && candidate.paymentMethod === "direct_debit"; })) issues.push("invented_direct_debit");
  return Array.from(new Set(issues));
}

function compareRaw(contract, links) {
  var issues = [];
  var expectedLinks = parser._test.expectedBareLinks(contract);
  if (links.length !== expectedLinks.length) issues.push("raw_link_count");
  expectedLinks.forEach(function (expected, index) {
    var actual = links[index];
    if (!actual) return;
    if (actual.clauseId !== expected.clauseId) issues.push("raw_clause:" + index);
    if (actual.eventType !== expected.eventType) issues.push("raw_type:" + index);
  });
  return Array.from(new Set(issues));
}

async function runCase(testCase, apiKey) {
  var captured = { status: null, payload: null, providerCalls: 0, request: null };
  var startedAt = process.hrtime.bigint();
  var result = await parser.analyze(testCase.text, CONTEXT, {
    apiKey: apiKey,
    userId: "approved-live-luna-100-" + testCase.id,
    timeoutMs: parser.MODEL_TIMEOUT_MAX_MS,
    fetchImpl: async function (url, options) {
      captured.providerCalls += 1;
      captured.request = JSON.parse(options.body);
      var response = await fetch(url, options);
      captured.status = response.status;
      captured.payload = await response.json();
      return { ok: response.ok, status: response.status, json: async function () { return captured.payload; } };
    },
  });
  var elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1000000;
  var usage = captured.payload && captured.payload.usage || {};
  var outputText = parser._test.responseText(captured.payload);
  return {
    id: testCase.id,
    text: testCase.text,
    elapsedMs: Math.round(elapsedMs * 100) / 100,
    providerStatus: captured.status,
    providerCalls: captured.providerCalls,
    semanticPlan: result.semanticPlan,
    finalIssues: compareFinal(testCase, result),
    rawIssues: result.semanticPlan && result.semanticPlan.source === "luna_compact_contract" && result.semanticPlan.status === "OK" ? [] : ["compact_contract"],
    usage: {
      inputTokens: Number(usage.input_tokens) || null,
      outputTokens: Number(usage.output_tokens) || null,
      totalTokens: Number(usage.total_tokens) || null,
      inputChars: captured.request ? String(captured.request.input || "").length : null,
      instructionChars: captured.request ? String(captured.request.instructions || "").length : null,
      outputChars: outputText.length,
    },
    modelOutput: outputText,
    finalEvents: result.candidates.map(function (item) {
      return { type: item.type, amount: item.amount, occurredDate: item.occurredDate, occurredDateApproximate: item.occurredDateApproximate, occurredDateApproximation: item.occurredDateApproximation, paymentMethod: item.paymentMethod };
    }),
    ledger: result.ledger.map(function (entry) { return entry.afterEur; }),
  };
}

function percentile(values, ratio) {
  var sorted = values.slice().sort(function (left, right) { return left - right; });
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

async function main() {
  if (!liveApproved) throw new Error("Zunanji test zahteva izrecni argument --live.");
  var apiKey = loadApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY ni nastavljen.");
  var createSelectedCase = suite === "month-only" ? createMonthOnlyCase : suite === "lean" ? createLeanCase : createCase;
  var cases = Array.from({ length: caseCount }, function (_item, index) { return createSelectedCase(index + caseOffset); });
  var results = new Array(cases.length);
  var nextIndex = 0;
  var completed = 0;
  async function worker() {
    while (true) {
      var index = nextIndex;
      nextIndex += 1;
      if (index >= cases.length) return;
      results[index] = await runCase(cases[index], apiKey);
      completed += 1;
      if (completed % 5 === 0 || completed === cases.length) console.log("Luna napredek: " + completed + "/" + cases.length);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  var sources = {};
  var reasons = {};
  var families = {};
  results.forEach(function (item) {
    var source = item.semanticPlan && item.semanticPlan.source || "missing";
    var reason = item.semanticPlan && item.semanticPlan.reason || "missing";
    var family = cases.find(function (testCase) { return testCase.id === item.id; }).family || "variant-" + ((results.indexOf(item) + caseOffset) % 10);
    sources[source] = (sources[source] || 0) + 1;
    reasons[reason] = (reasons[reason] || 0) + 1;
    if (!families[family]) families[family] = { count: 0, finalPassed: 0, rawExact: 0 };
    families[family].count += 1;
    if (!item.finalIssues.length) families[family].finalPassed += 1;
    if (!item.rawIssues.length) families[family].rawExact += 1;
  });
  var elapsed = results.map(function (item) { return item.elapsedMs; });
  function tokenSummary(key) {
    var values = results.map(function (item) { return item.usage[key]; }).filter(Number.isFinite);
    if (!values.length) return { total: null, p50: null, p95: null, max: null };
    return { total: values.reduce(function (sum, value) { return sum + value; }, 0), p50: percentile(values, 0.5), p95: percentile(values, 0.95), max: Math.max.apply(Math, values) };
  }
  var report = {
    generatedAt: new Date().toISOString(),
    model: parser.MODEL,
    contractVersion: parser.CONTRACT_VERSION,
    referenceDate: REFERENCE_DATE,
    debtEur: DEBT,
    count: results.length,
    offset: caseOffset,
    suite: suite,
    providerCalls: results.reduce(function (sum, item) { return sum + item.providerCalls; }, 0),
    finalPassed: results.filter(function (item) { return item.finalIssues.length === 0; }).length,
    rawLunaExact: results.filter(function (item) { return item.rawIssues.length === 0; }).length,
    sources: sources,
    reasons: reasons,
    families: families,
    tokens: { input: tokenSummary("inputTokens"), output: tokenSummary("outputTokens"), total: tokenSummary("totalTokens") },
    requestChars: { input: tokenSummary("inputChars"), instructions: tokenSummary("instructionChars"), output: tokenSummary("outputChars") },
    timingMs: { p50: percentile(elapsed, 0.5), p95: percentile(elapsed, 0.95), max: Math.max.apply(Math, elapsed) },
    requiredPasses: Math.ceil(results.length * 0.97),
    deviations: results.filter(function (item) { return item.finalIssues.length || item.rawIssues.length || !item.semanticPlan || item.semanticPlan.source !== "luna_compact_contract"; }),
    results: results,
  };
  if (reportArg) {
    var reportPath = path.resolve(reportArg.slice("--report=".length));
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log("Poročilo: " + reportPath);
  }
  console.log("Luna " + caseCount + ": final " + report.finalPassed + "/" + caseCount + "; raw exact " + report.rawLunaExact + "/" + caseCount + "; calls " + report.providerCalls + "; sources " + JSON.stringify(sources) + "; p50 " + report.timingMs.p50.toFixed(2) + " ms; p95 " + report.timingMs.p95.toFixed(2) + " ms; max " + report.timingMs.max.toFixed(2) + " ms");
  if (report.providerCalls !== caseCount || report.finalPassed < report.requiredPasses) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(function (error) {
    console.error(error && error.stack || error);
    process.exitCode = 1;
  });
}

module.exports = {
  REFERENCE_DATE: REFERENCE_DATE,
  DEBT: DEBT,
  CONTEXT: CONTEXT,
  createCase: createCase,
  createMonthOnlyCase: createMonthOnlyCase,
  createLeanCase: createLeanCase,
  compareFinal: compareFinal,
  compareRaw: compareRaw,
  rawPlan: rawPlan,
};
