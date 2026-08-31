"use strict";

var assert = require("node:assert");
var dns = require("node:dns").promises;
var EventEmitter = require("node:events");
var https = require("node:https");
var client = require("../api/_lib/scrapling-impressum-client");
var handler = require("../api/_handlers/mehka-boniteta");
var test = handler._test;
assert.ok(client._test.timeoutMs <= 8000, "Scrapling fallback ne sme preseči osemtisočmilisekundnega roka");

var previousUrl = process.env.SCRAPLING_IMPRESSUM_URL;
var previousToken = process.env.SCRAPLING_IMPRESSUM_TOKEN;
var originalLookup = dns.lookup;
var originalHttpsRequest = https.request;

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

    dns.lookup = async function () { return [{ address: "93.184.216.34", family: 4 }]; };
    client._test.reset();
    client._test.setFetch(async function () {
      return jsonResponse({
        ok: true, status: "fetched", final_url: "https://example.com/impressum", http_status: 200, mode: "dynamic",
        html: "<html><body><h1>Impressum</h1><p>Heizungsmeisterei Duman</p><p>Inhaber: Köksal Duman</p><p>Halmstraße 2</p><p>60437 Frankfurt am Main</p></body></html>",
        text: "Impressum\nHeizungsmeisterei Duman\nInhaber: Köksal Duman\nHalmstraße 2\n60437 Frankfurt am Main",
      });
    });
    var context = test.dolociPravniKontekst(new URL("https://example.com/impressum"));
    var found = await test.poisciImpressumSScrapling(["https://example.com/impressum"], {
      ime: "Heizungsmeisterei Duman", spletnaStran: "https://example.com/impressum", naslov: "Halmstraße 2",
      postnaStevilka: "60437", kraj: "Frankfurt am Main",
    }, context);
    assert.strictEqual(found.status, "found");
    assert.strictEqual(found.subjekt.nosilec, "Köksal Duman");
    assert.strictEqual(found.subjekt.acquisition, "scrapling_dynamic");

    client._test.reset();
    client._test.setFetch(async function () { return jsonResponse({ ok: false, status: "robots_disallowed" }); });
    var blocked = await test.poisciImpressumSScrapling(["https://example.com/impressum"], {}, context);
    assert.strictEqual(blocked.status, "blocked");
    assert.strictEqual(blocked.reason, "robots_disallowed");

    client._test.reset();
    client._test.setFetch(async function () { throw new Error("Scrapling se po 429 ne sme poklicati."); });
    var directCalls = 0;
    https.request = function (_url, _options, callback) {
      directCalls += 1;
      var request = new EventEmitter();
      request.destroy = function (error) {
        if (error) setImmediate(function () { request.emit("error", error); });
      };
      request.end = function () {
        var response = new EventEmitter();
        response.statusCode = 429;
        response.headers = { "content-type": "text/html" };
        response.destroy = function () {};
        callback(response);
        setImmediate(function () {
          response.emit("data", Buffer.from("rate limited"));
          response.emit("end");
        });
      };
      return request;
    };
    var limited = await test.poisciVImpressumu({ spletnaStran: "https://example.com/impressum" });
    assert.strictEqual(limited.status, "unavailable");
    assert.strictEqual(limited.reason, "website_rate_limited");
    assert.strictEqual(directCalls, 1, "429 se ne sme ponoviti z drugim User-Agentom ali brskalnikom");
    console.log("Scrapling Impressum client tests passed.");
  } finally {
    dns.lookup = originalLookup;
    https.request = originalHttpsRequest;
    client._test.reset();
    if (previousUrl === undefined) delete process.env.SCRAPLING_IMPRESSUM_URL; else process.env.SCRAPLING_IMPRESSUM_URL = previousUrl;
    if (previousToken === undefined) delete process.env.SCRAPLING_IMPRESSUM_TOKEN; else process.env.SCRAPLING_IMPRESSUM_TOKEN = previousToken;
  }
})().catch(function (error) { console.error(error); process.exitCode = 1; });
