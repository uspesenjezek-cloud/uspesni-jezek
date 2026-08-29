"use strict";

var assert = require("node:assert/strict");
var parser = require("../api/_lib/zgodovina-naravni-vnos");
var legacyAnalyze = parser.analyze;
parser.analyze = function (text, context, options) {
  return legacyAnalyze(text, context, Object.assign({ _legacyTestMode: true }, options || {}));
};

function percentile(values, ratio) {
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

async function main() {
  var samples = [
    "plačal je 3000 v 4ih obrokih.. in na to pa 1000 v dobropisu",
    "delno je poravnal račun plačal je pred enim mesecom 4000 potem pred dvema tednoma pa 2000",
    "plačal je 300 nato 500 nato pred tednom dni pa 5000 drugo pa ni plačal",
    "plačal je 2 obroka po 300 evrov potem 2 obroka po 500 evrov preostalo je dolžan",
    "plačal je dva po 300 evrov potem 2 obroka po 500 ostalo ni plačal",
    "včeraj je nakazal 500 eur",
    "3. obrok ni plačan",
    "obljubil je, da bo plačal jutri po telefonu",
    "izdan je dobropis 250 € nato pobot 100 €",
  ];
  var durations = [];
  for (var i = 0; i < 250; i += 1) {
    var started = performance.now();
    await parser.analyze(samples[i % samples.length], { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 }, {
      apiKey: false, fetchImpl: async function () { throw new Error("no-key path ne sme poklicati ponudnika"); },
    });
    durations.push(performance.now() - started);
  }
  var p50 = percentile(durations, 0.50);
  var p95 = percentile(durations, 0.95);
  var max = Math.max.apply(Math, durations);
  assert.ok(p50 < 20 && p95 < 60 && max < 250, "deterministični no-key path je presegel stabilen lokalni budget");

  var providerCalls = 0;
  var reportedSentenceStarted = performance.now();
  var reportedSentence = await parser.analyze("delno je poravnal račun plačal je pred enim mesecom 4000 potem pred dvema tednoma pa 2000", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only",
    fetchImpl: async function () { providerCalls += 1; return { ok: true, status: 200, json: async function () { return { output_text: "OK" }; } }; },
  });
  var reportedSentenceMs = performance.now() - reportedSentenceStarted;
  assert.equal(providerCalls, 1, "sestavljeni prijavljeni vnos mora poskusiti semantični plan");
  assert.equal(reportedSentence.semanticPlan.reason, "luna_review_ok");
  assert.ok(reportedSentenceMs < 250, "mock-OK review mora odgovoriti znotraj lokalnega testnega budgeta");
  assert.deepEqual(reportedSentence.candidates.map(function (candidate) { return candidate.amount; }), [4000, 2000]);

  var timeoutStarted = performance.now();
  var timeoutResult = await parser.analyze("nejasna druga okoliščina brez razpoznavnega dogodka", {
    referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "test-only", timeoutMs: 140,
    fetchImpl: function (_url, options) {
      return new Promise(function (_resolve, reject) {
        options.signal.addEventListener("abort", function () { var error = new Error("aborted"); error.name = "AbortError"; reject(error); }, { once: true });
      });
    },
  });
  var timeoutMs = performance.now() - timeoutStarted;
  assert.deepEqual(timeoutResult.candidates, [], "timeout pri nepopolnem lokalnem planu ne sme prikazati delnih kartic");
  assert.equal(timeoutResult.needsClarification, true);
  assert.equal(timeoutResult.semanticPlan.reason, "luna_review_timeout");
  assert.ok(timeoutMs < 3000, "provider timeout mora ostati pod hard deadline 3 s");
  console.log("✓ history benchmark: no-key p50 " + p50.toFixed(2) + " ms, p95 " + p95.toFixed(2) + " ms, max " + max.toFixed(2) + " ms, mock-OK review " + reportedSentenceMs.toFixed(2) + " ms, timeout fallback " + timeoutMs.toFixed(2) + " ms");
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
