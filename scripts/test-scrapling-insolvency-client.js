"use strict";

var assert = require("node:assert/strict");
var client = require("../api/_lib/scrapling-insolvency-client");

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
    var missing = await client.preflightOfficialInsolvencyPortal();
    assert.equal(missing.status, "unavailable");
    assert.equal(missing.reason, "not_configured");

    process.env.SCRAPLING_IMPRESSUM_URL = "http://127.0.0.1:8766";
    process.env.SCRAPLING_IMPRESSUM_TOKEN = "i".repeat(32);
    var calls = 0;
    client._test.reset();
    client._test.setFetch(async function (url, options) {
      calls += 1;
      assert.equal(String(url), "http://127.0.0.1:8766/v1/insolvency/preflight");
      assert.equal(options.headers.Authorization, "Bearer " + "i".repeat(32));
      assert.deepEqual(JSON.parse(options.body), { purpose: "official_insolvency_preflight" });
      await new Promise(function (resolve) { setTimeout(resolve, 5); });
      return jsonResponse({
        ok: true,
        status: "ready",
        reason: "",
        portal_reachable: true,
        transaction_ready: true,
        transaction_mode: "authorized_form_submission",
        landing_url: "https://neu.insolvenzbekanntmachungen.de/ap/index.jsf",
        search_url: "https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf",
        service_version: "scrapling-acquisition-v4",
      });
    });
    var ready = await Promise.all([
      client.preflightOfficialInsolvencyPortal(),
      client.preflightOfficialInsolvencyPortal(),
    ]);
    assert.equal(calls, 1, "sočasna predpregleda morata souporabiti isti zahtevek");
    await client.preflightOfficialInsolvencyPortal();
    assert.equal(calls, 1, "dosegljivost vstopne strani mora priti iz kratkega predpomnilnika");
    assert.ok(client._test.timeoutMs <= 5000, "predpregled ne sme čakati dlje kot pet sekund");
    assert.equal(ready[0].status, "ready");
    assert.equal(ready[0].portalReachable, true);
    assert.equal(ready[0].transactionMode, "authorized_form_submission");

    client._test.reset();
    client._test.setFetch(async function () {
      return jsonResponse({
        ok: true,
        status: "ready",
        portal_reachable: true,
        transaction_ready: true,
        transaction_mode: "authorized_form_submission",
        landing_url: "https://neu.insolvenzbekanntmachungen.de/ap/index.jsf",
        search_url: "https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf",
      });
    });
    assert.equal((await client.preflightOfficialInsolvencyPortal()).status, "ready");

    client._test.reset();
    client._test.setFetch(async function () {
      return jsonResponse({ ok: true, status: "ready", portal_reachable: false, transaction_ready: true });
    });
    var invalidReady = await client.preflightOfficialInsolvencyPortal();
    assert.equal(invalidReady.status, "unavailable", "nedosegljiva vstopna stran ne sme biti označena kot pripravljena");
    console.log("Scrapling insolvency preflight client tests passed.");
  } finally {
    client._test.reset();
    if (previousUrl === undefined) delete process.env.SCRAPLING_IMPRESSUM_URL; else process.env.SCRAPLING_IMPRESSUM_URL = previousUrl;
    if (previousToken === undefined) delete process.env.SCRAPLING_IMPRESSUM_TOKEN; else process.env.SCRAPLING_IMPRESSUM_TOKEN = previousToken;
  }
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
