"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var client = require("../api/_lib/scrapling-impressum-client");
assert.equal(client._test.timeoutMs, 8000,
  "nedelujoč zbiralnik mora vrniti ločeno stanje vira brez dolge zaporedne verige");

var previousUrl = process.env.SCRAPLING_IMPRESSUM_URL;
var previousToken = process.env.SCRAPLING_IMPRESSUM_TOKEN;

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status: status || 200,
    headers: { "content-type": "application/json" },
  });
}

(async function () {
  try {
    delete process.env.SCRAPLING_IMPRESSUM_URL;
    delete process.env.SCRAPLING_IMPRESSUM_TOKEN;
    client._test.reset();
    assert.strictEqual((await client.fetchImpressum("https://example.com/impressum")).status, "not_configured");

    process.env.SCRAPLING_IMPRESSUM_URL = "http://127.0.0.1:8766";
    process.env.SCRAPLING_IMPRESSUM_TOKEN = "t".repeat(32);
    var calls = 0;
    client._test.setFetch(async function (_url, options) {
      calls += 1;
      assert.strictEqual(options.headers.Authorization, "Bearer " + "t".repeat(32));
      assert.deepStrictEqual(JSON.parse(options.body), {
        url: "https://example.com/impressum",
        purpose: "legal_impressum_fallback",
      });
      await new Promise(function (resolve) { setTimeout(resolve, 5); });
      return jsonResponse({
        ok: true, status: "fetched", final_url: "https://example.com/impressum",
        http_status: 200, mode: "dynamic", html: "<html><body>Impressum</body></html>", text: "Impressum",
      });
    });
    var results = await Promise.all([
      client.fetchImpressum("https://example.com/impressum"),
      client.fetchImpressum("https://example.com/impressum"),
    ]);
    assert.strictEqual(calls, 1, "sočasna enaka zahtevka morata uporabiti isti zajem");
    assert.strictEqual(results[0].status, "found");
    assert.strictEqual(results[0].mode, "dynamic");

    client._test.reset();
    client._test.setFetch(async function () { calls += 1; return jsonResponse({ ok: false, status: "rate_limited" }, 429); });
    calls = 0;
    assert.strictEqual((await client.fetchImpressum("https://example.com/limited")).status, "rate_limited");
    assert.strictEqual(calls, 1, "429 se ne sme samodejno ponoviti");

    client._test.reset();
    client._test.setFetch(async function () { return jsonResponse({ ok: false, status: "robots_disallowed", robots: { allowed: false } }); });
    assert.strictEqual((await client.fetchImpressum("https://example.com/robots")).status, "robots_disallowed");

    var handlerSource = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta.js"), "utf8");
    assert.doesNotMatch(handlerSource, /scrapling-impressum-client|poisciImpressumSScrapling/,
      "ločeni Scrapling odjemalec ne sme biti več veja aktivnega identitetnega handlerja");

    client._test.reset();
    calls = 0;
    client._test.setFetch(async function () {
      calls += 1;
      if (calls === 1) throw new Error("Kratek izpad zbiralnika.");
      return jsonResponse({
        ok: true, status: "fetched", final_url: "https://example.com/impressum", http_status: 200,
        html: "<html><body>Impressum</body></html>", text: "Impressum",
      });
    });
    var retried = await client.fetchImpressum("https://example.com/impressum");
    assert.strictEqual(retried.status, "found", "hiter prehoden izpad mora dobiti en omejen ponovni poskus");
    assert.strictEqual(calls, 2, "samo en ponovni poskus je dovoljen");
    console.log("Scrapling Impressum client tests passed.");
  } finally {
    client._test.reset();
    if (previousUrl === undefined) delete process.env.SCRAPLING_IMPRESSUM_URL; else process.env.SCRAPLING_IMPRESSUM_URL = previousUrl;
    if (previousToken === undefined) delete process.env.SCRAPLING_IMPRESSUM_TOKEN; else process.env.SCRAPLING_IMPRESSUM_TOKEN = previousToken;
  }
})().catch(function (error) { console.error(error); process.exitCode = 1; });
