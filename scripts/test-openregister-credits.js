"use strict";

var assert = require("node:assert");
var client = require("../api/_lib/openregister-pro-client");

async function run() {
  assert.deepStrictEqual(client.kreditnoStanje({
    used: 1234,
    included: 5000,
    remaining: 3766,
    overage: 0,
    period_end: "2026-09-01T00:00:00Z",
  }), {
    included: 5000,
    used: 1234,
    remaining: 3766,
    overage: 0,
    periodEnd: "2026-09-01T00:00:00Z",
    detailedChecksAvailable: 376,
    premiumChecksAvailable: 150,
  });

  assert.strictEqual(client.kreditnoStanje({ credits: { included_credits: 100, used_credits: 35 } }).remaining, 65);
  assert.strictEqual(client.kreditnoStanje({}).detailedChecksAvailable, null);

  var previousKey = process.env.OPENREGISTER_API_KEY;
  var previousFetch = global.fetch;
  var call;
  process.env.OPENREGISTER_API_KEY = "test-key";
  global.fetch = async function (url, options) {
    call = { url: String(url), options: options };
    return { ok: true, status: 200, json: async function () { return { used: 20, included: 100, remaining: 80 }; } };
  };
  try {
    var result = await client.credits();
    assert.ok(call.url.endsWith("/v1/credits"));
    assert.strictEqual(call.options.method, "GET");
    assert.strictEqual(result.detailedChecksAvailable, 8);
  } finally {
    global.fetch = previousFetch;
    if (previousKey == null) delete process.env.OPENREGISTER_API_KEY;
    else process.env.OPENREGISTER_API_KEY = previousKey;
  }

  console.log("✓ Stanje OpenRegister kreditov je varno normalizirano.");
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
