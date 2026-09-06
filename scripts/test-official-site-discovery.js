"use strict";

var assert = require("node:assert");
var discovery = require("../api/_lib/official-site-discovery");

(async function () {
  discovery._test.reset();
  var calls = 0;
  var signals = { name: "Kfz-Techniker Miszewski", phone: "+49 208 8821948", postalCode: "45481", city: "Mülheim an der Ruhr" };
  var result = await discovery.findCandidates(signals, {
    apiKey: "test-key",
    fetch: async function (url, options) {
      calls += 1;
      if (url.indexOf("search.brave.com") >= 0) {
        assert.strictEqual(options.method, "GET");
        return new Response('<div class="result"><a href="https://www.auto-werkstatt.de/example">Profil</a><p>0208 8821948 · info@example.invalid · schilling.go1a.de · Autowerkstatt</p></div>', { status: 200 });
      }
      var body = JSON.parse(options.body);
      assert.strictEqual(body.model, "gpt-5.6-luna");
      assert.strictEqual(body.reasoning.effort, "none");
      assert.strictEqual(body.tools[0].type, "web_search");
      assert.strictEqual(body.tools[0].search_context_size, "low");
      return new Response(JSON.stringify({ output: [{ type: "message", content: [{
        type: "output_text",
        text: JSON.stringify({ urls: ["http://www.schilling.go1a.de", "https://www.auto-werkstatt.de/example"] }),
      }] }] }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.strictEqual(result.status, "found");
  assert(result.urls.includes("https://schilling.go1a.de/"));
  assert(result.urls.some(function (url) { return /auto-werkstatt\.de/.test(url); }));
  assert.strictEqual((await discovery.findCandidates(signals, {
    apiKey: "test-key", fetch: async function () { throw new Error("cache expected"); },
  })).cached, true);
  assert.strictEqual(calls, 1);
  assert.strictEqual((await discovery.findCandidates({ name: "Premalo", phone: "", postalCode: "45481" }, { apiKey: "test-key" })).status, "insufficient_signals");


  assert(discovery._test.braveUrls(
    '<html><head><title>0211 7308892</title><link href="https://app.yu8nxcoa.css"></head><body><p>0211 7308892 · kfz-scharfenberg-hammes.de · <a class="result-title l1" href="https://www.auto-werkstatt.de/duesseldorf/udo-hammes">Profil</a></p></body></html>',
    "2117308892"
  ).includes("https://kfz-scharfenberg-hammes.de/"), "nemška številka brez začetne ničle mora najti domeno ob lokalni obliki");
  assert(!discovery._test.braveUrls(
    '<html><head><title>0211 7308892</title><link href="https://app.yu8nxcoa.css"></head><body><p>Ni zadetkov</p></body></html>',
    "2117308892"
  ).some(function (url) { return /yu8nxcoa|\.css/.test(url); }), "iskalnikovi asseti ne smejo postati poslovni kandidati");

  discovery._test.reset();
  calls = 0;
  var lunaFallback = await discovery.findCandidates(signals, {
    apiKey: "test-key",
    fetch: async function (url, options) {
      calls += 1;
      if (url.indexOf("search.brave.com") >= 0) return new Response("", { status: 503 });
      var body = JSON.parse(options.body);
      assert.strictEqual(body.model, "gpt-5.6-luna");
      return new Response(JSON.stringify({ output: [{ type: "message", content: [{
        type: "output_text", text: JSON.stringify({ urls: ["https://official.example/impressum"] }),
      }] }] }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.deepStrictEqual(lunaFallback.urls, ["https://official.example/impressum"]);
  assert.strictEqual(calls, 2);
  console.log("Official site discovery tests passed.");
})().catch(function (error) { console.error(error); process.exitCode = 1; });
