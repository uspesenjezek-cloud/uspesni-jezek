"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var parser = require("../api/_lib/zgodovina-naravni-vnos");

async function main() {
  var text = "rekel je da bo plačal ampak šele ko bo bil zmožen plačila in to samo 100 evrov";
  var evidence = "rekel je da bo plačal ampak šele ko bo bil zmožen plačila";
  var calls = 0;
  async function fetchImpl(_url, request) {
    calls += 1;
    if (calls === 2) {
      var modelInput = JSON.parse(JSON.parse(request.body).input);
      assert.equal(modelInput.clarification.answer, "Datum dogodka, rok plačila in komunikacijski kanal niso znani oziroma določeni.");
    }
    return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({
      p: [],
      q: calls === 1 ? "Kdaj oziroma pod katerim pogojem bo dolžnik plačal 100 EUR?" : "Ali rok plačila ostaja nedoločen?",
      x: evidence,
    }) }; } };
  }

  var first = await parser.analyze(text, {
    referenceDate: "2026-08-29", originalDebt: 9446, remainingDebt: 9446,
  }, { apiKey: "test-only", fetchImpl: fetchImpl });

  assert.equal(first.semanticPlan.status, "CLARIFICATION_REQUIRED");
  assert.equal(first.clarification.clauseId, "clause-1");
  assert.match(first.clarification.clauseId, /^clause-\d+$/, "UI mora prejeti strežniško veljaven ID izvornega stavka");

  var second = await parser.analyze(text, {
    referenceDate: "2026-08-29", originalDebt: 9446, remainingDebt: 9446,
    clarification: {
      question: first.clarification.question,
      clauseId: first.clarification.clauseId,
      answer: "ne",
      round: first.clarification.round,
    },
  }, { apiKey: "test-only", fetchImpl: fetchImpl });

  assert.equal(second.semanticPlan.status, "CLARIFICATION_REQUIRED");
  assert.equal(second.semanticPlan.reason, "luna_clarification_requested");
  assert.equal(second.clarification.round, 2);
  assert.equal(second.candidates.length, 0, "lokalni parser ne sme namesto Lune ustvariti payment_promise");
  assert.equal(calls, 2);

  var lunaChoice = await parser.analyze("plačal je", {
    referenceDate: "2026-08-29", originalDebt: 9446, remainingDebt: 9446,
  }, { apiKey: "test-only", fetchImpl: async function () {
    return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({
      p: [{ n: 1, c: 7, e: "plačal je", f: [] }], q: null, x: null,
    }) }; } };
  } });
  assert.equal(lunaChoice.semanticPlan.status, "OK");
  assert.equal(lunaChoice.candidates[0].type, "payment_promise", "lokalni parser ne sme preklasificirati veljavne Lunine kartice");

  var unavailable = await parser.analyze(text, {
    referenceDate: "2026-08-29", originalDebt: 9446, remainingDebt: 9446,
  }, { apiKey: "test-only", fetchImpl: async function () { throw new Error("offline"); } });
  assert.equal(unavailable.semanticPlan.status, "FAILED");
  assert.equal(unavailable.candidates.length, 0, "ob nedosegljivi Luni lokalni parser ne sme ustvariti semantičnega rezultata");
  assert.equal(parser._test.normalizeShortClarificationAnswer("Manjkata datum dogodka in kanal komunikacije.", "ne vem"), "Datum dogodka, rok plačila in komunikacijski kanal niso znani oziroma določeni.");
  assert.equal(parser._test.normalizeShortClarificationAnswer("Ali rok ostaja nedoločen?", "ne"), "ne", "jasnega vprašanja da/ne se ne sme pomensko obrniti");

  var handlerSource = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "razcleni-zgodovino.js"), "utf8");
  assert.match(handlerSource, /\^clause-\\d\+\$/, "API meja mora sprejeti ID, ki ga vrne compact parser");
  assert.doesNotMatch(JSON.stringify(first), /luna-clarification/);
  console.log("✓ Atena clarification boundary: Lunino pojasnilo ostane avtoritativno brez lokalne prekategorizacije");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
