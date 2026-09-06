"use strict";

var assert = require("node:assert/strict");
var z = require("zod").z;
var adapter = require("../api/_lib/atena-ai-sdk");

var schema = z.object({ ok: z.boolean(), value: z.string().nullable() }).strict();

function response(status, payload, retryAfter) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    headers: { get: function (name) { return name.toLowerCase() === "retry-after" ? retryAfter || null : null; } },
    json: async function () { return payload || {}; },
  };
}

function options(fetchImpl) {
  return {
    apiKey: "test", model: "gpt-5.6-luna", instructions: "Return the requested object.", input: "test",
    schema: schema, schemaName: "atena_sdk_test", maxOutputTokens: 80, reasoningEffort: "low",
    safetyIdentifier: "atena-sdk-test", fetchImpl: fetchImpl, timeoutMs: 1000, maxAttempts: 1,
  };
}

async function main() {
  var calls = 0;
  var sentBody = null;
  var valid = await adapter.generateStructured(options(async function (_url, init) {
    calls += 1;
    sentBody = JSON.parse(init.body);
    return response(200, { output_text: JSON.stringify({ ok: true, value: "deluje" }), usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 } });
  }));
  assert.deepEqual(valid.output, { ok: true, value: "deluje" });
  assert.equal(calls, 1, "veljaven strukturiran rezultat mora porabiti natanko en modelni klic");
  assert.equal(valid.calls, 1);
  assert.deepEqual(valid.usage, { inputTokens: 11, outputTokens: 7, totalTokens: 18 });
  assert.equal(valid.adapterVersion, "atena-ai-sdk-v1");
  assert.equal(sentBody.text.format.type, "json_schema");
  assert.equal(sentBody.text.format.name, "atena_sdk_test");
  assert.equal(sentBody.store, false);
  assert.equal(sentBody.reasoning.effort, "low");

  calls = 0;
  await assert.rejects(adapter.generateStructured(options(async function () {
    calls += 1;
    return response(200, { output_text: JSON.stringify({ ok: "ni boolean", value: null }) });
  })), function (error) { return error.code === "ATENA_AI_SDK_INVALID_OUTPUT" && error.retryable === false; });
  assert.equal(calls, 1, "schema-invalid izhod se ne sme pošiljati v dodatni modelni klic");

  calls = 0;
  var retryOptions = options(async function () {
    calls += 1;
    return calls === 1 ? response(503, {}) : response(200, { output_text: JSON.stringify({ ok: true, value: null }) });
  });
  retryOptions.maxAttempts = 2;
  retryOptions.sleepImpl = async function () {};
  var recovered = await adapter.generateStructured(retryOptions);
  assert.equal(calls, 2, "le transportna 5xx napaka sme sprožiti en omejen ponovni poskus");
  assert.equal(recovered.attempts, 2);

  calls = 0;
  await assert.rejects(adapter.generateStructured(options(async function () {
    calls += 1;
    return response(400, {});
  })), function (error) { return error.code === "LUNA_PROVIDER_REJECTED" && error.retryable === false; });
  assert.equal(calls, 1, "nerešljiv 4xx se ne sme ponavljati");

  console.log("OK Atena AI SDK v1: Zod output, en klic, schema fail-closed in omejen transportni retry");
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
