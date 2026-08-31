"use strict";

var assert = require("node:assert/strict");
var dbPath = require.resolve("../api/_lib/supabase-server");
var handlerPath = require.resolve("../api/_handlers/razcleni-dogovor");
var originalDb = require.cache[dbPath];
var originalFetch = global.fetch;
var originalApiKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = "boundary-test";
global.fetch = async function (_url, options) {
  var request = JSON.parse(options.body);
  var input = JSON.parse(request.input);
  var isUnknown = /100 EUR ko bo zmogel/.test(input.sourceText);
  var item = { cardId: 1, amount: isUnknown ? 100 : 9446, occurredDate: null, promisedDate: isUnknown ? null : "2026-11-29", communicationChannel: "unknown", description: input.sourceText, evidence: input.sourceText };
  return { ok: true, json: async function () { return { output_text: JSON.stringify({ agreements: [item], question: null, evidence: null }) }; } };
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  uporabniskaKonfiguracija: function () { return {}; },
  preveriUporabnika: async function () { return { ok: true, user: { id: "agreement-boundary-user" } }; },
} };
delete require.cache[handlerPath];
var handler = require(handlerPath);

function response() {
  return { statusCode: 200, payload: null, headers: {}, setHeader: function (key, value) { this.headers[key] = value; }, status: function (code) { this.statusCode = code; return this; }, json: function (payload) { this.payload = payload; return this; } };
}
async function call(body, method) {
  var res = response();
  await handler({ method: method || "POST", body: body, headers: {} }, res);
  return res;
}
async function main() {
  handler._test.runtime.cache.clear(); handler._test.runtime.users.clear();
  var body = { requestId: "agreement:boundary:0001", text: "rekel je da bo vse plačal čez 3 mesece", referenceDate: "2026-08-29", originalDebt: 9446, remainingDebt: 9446 };
  var ok = await call(body);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.payload.contractVersion, "agreement-fact-v7");
  assert.equal(ok.payload.candidates[0].type, "payment_promise");
  assert.equal(ok.payload.ledger[0].effectEur, 0);
  assert.equal(ok.payload.projectedRemainingDebtEur, 9446);
  assert.equal(ok.payload.semanticPlan.attempted, true);
  var reused = await call(Object.assign({}, body, { text: "rekel je da bo plačal 100 EUR" }));
  assert.equal(reused.statusCode, 409);
  var clarification = await call({ requestId: "agreement:boundary:0002", text: "rekel je da bo plačal 100 EUR ko bo zmogel", referenceDate: "2026-08-29", originalDebt: 9446, remainingDebt: 9446, clarification: { question: "Kdaj bo plačal?", answer: "ne", clauseId: "clause-1", round: 1 } });
  assert.equal(clarification.statusCode, 200);
  assert.equal(clarification.payload.candidates[0].promisedDateUnknown, true);
  assert.equal(clarification.payload.needsClarification, false);
  var invalid = await call(Object.assign({}, body, { requestId: "short" }));
  assert.equal(invalid.statusCode, 400);
  var wrongMethod = await call({}, "GET");
  assert.equal(wrongMethod.statusCode, 405);
  console.log("OK agreement handler boundary: Luna pot je stubana na API robu; 200/409/400/405 in clarification brez zanke");
}
main().finally(function () {
  global.fetch = originalFetch;
  if (originalApiKey == null) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalApiKey;
  if (originalDb) require.cache[dbPath] = originalDb; else delete require.cache[dbPath];
}).catch(function (error) { console.error(error); process.exitCode = 1; });
