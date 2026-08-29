"use strict";

var assert = require("node:assert");
var client = require("../api/_lib/scrapling-hwk-client");

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
    process.env.SCRAPLING_IMPRESSUM_URL = "http://127.0.0.1:8766";
    process.env.SCRAPLING_IMPRESSUM_TOKEN = "h".repeat(32);
    client._test.reset();

    var calls = 0;
    var requested = [];
    client._test.setFetch(async function (endpoint, options) {
      calls += 1;
      assert.strictEqual(new URL(endpoint).pathname, "/v1/hwk/fetch");
      assert.strictEqual(options.headers.Authorization, "Bearer " + "h".repeat(32));
      var body = JSON.parse(options.body);
      assert.strictEqual(body.purpose, "public_hwk_directory");
      requested.push(body.url);
      await new Promise(function (resolve) { setTimeout(resolve, 5); });
      return jsonResponse({
        ok: true,
        status: "fetched",
        final_url: body.url,
        http_status: 200,
        mode: "static",
        html: "<html><body><article>HWK result</article></body></html>",
        text: "HWK result",
      });
    });

    var urls = Array.from({ length: 20 }, function (_, index) {
      return "https://hwk-rhein-main.odav.de/search?name=person-" + index;
    });
    var batch = await client.fetchHwkBatch(urls);
    assert.strictEqual(batch.status, "completed");
    assert.strictEqual(batch.results.length, 20);
    assert.strictEqual(calls, 20, "20 unikatnih iskanj mora biti poslanih brez izgube");
    assert.deepStrictEqual(requested.sort(), urls.slice().sort());
    assert.ok(batch.results.every(function (result) { return result.status === "found"; }));

    client._test.reset();
    calls = 0;
    client._test.setFetch(async function (_endpoint, options) {
      calls += 1;
      var body = JSON.parse(options.body);
      await new Promise(function (resolve) { setTimeout(resolve, 10); });
      return jsonResponse({
        ok: true, status: "fetched", final_url: body.url, http_status: 200,
        mode: "static", html: "<html></html>", text: "one shared result",
      });
    });
    var sameUrl = "https://www.hwk-berlin.de/search?name=same-person";
    var duplicates = await Promise.all(Array.from({ length: 20 }, function () { return client.fetchHwk(sameUrl); }));
    assert.strictEqual(calls, 1, "20 enakih sočasnih zahtevkov mora deliti isti zajem");
    assert.ok(duplicates.every(function (result) { return result.status === "found"; }));

    client._test.reset();
    calls = 0;
    client._test.setFetch(async function () {
      calls += 1;
      return jsonResponse({ ok: false, status: "busy", reason: "queue_full" }, 503);
    });
    assert.strictEqual((await client.fetchHwk("https://www.hwk-berlin.de/busy-1")).status, "busy");
    assert.strictEqual((await client.fetchHwk("https://www.hwk-berlin.de/busy-1")).status, "busy");
    assert.strictEqual(calls, 2, "busy odgovor se ne sme shraniti v predpomnilnik");

    var tooMany = await client.fetchHwkBatch(Array.from({ length: 21 }, function (_, index) { return "https://example.com/" + index; }));
    assert.strictEqual(tooMany.status, "invalid_request");
    assert.strictEqual(tooMany.reason, "batch_size_must_be_1_to_20");

    console.log("Scrapling HWK client concurrency tests passed.");
  } finally {
    client._test.reset();
    if (previousUrl === undefined) delete process.env.SCRAPLING_IMPRESSUM_URL; else process.env.SCRAPLING_IMPRESSUM_URL = previousUrl;
    if (previousToken === undefined) delete process.env.SCRAPLING_IMPRESSUM_TOKEN; else process.env.SCRAPLING_IMPRESSUM_TOKEN = previousToken;
  }
})().catch(function (error) { console.error(error); process.exitCode = 1; });
