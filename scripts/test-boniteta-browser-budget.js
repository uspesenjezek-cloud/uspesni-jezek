"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var handler = require("../api/_handlers/mehka-boniteta");
var queue = require("../api/_lib/mehka-boniteta-queue");
var test = handler._test;

async function main() {
  var budget = test.BROWSER_BUDGET;
  assert.ok(budget.SELECTOR <= budget.NAVIGATION);
  assert.ok(budget.NAVIGATION < budget.PROTOCOL);
  assert.ok(budget.PROTOCOL < budget.IDENTITY_EVIDENCE_TOTAL);
  assert.ok(budget.IDENTITY_EVIDENCE_TOTAL + budget.CLEANUP_RESERVE < budget.MAX_DURATION);
  assert.strictEqual(queue._test.MAX_INSOLVENCY_CONCURRENCY, 20,
    "PLAN-31AVGUST mora ohraniti 20 sočasnih insolvenčnih opravil");
  assert.strictEqual(queue._test.MAX_INSOLVENCY_ATTEMPTS, 2);
  assert.strictEqual(queue._test.INSOLVENCY_RETRY_DELAY_MS, 3000);

  var potekKlican = 0;
  await assert.rejects(
    test.izvediZRokom(new Promise(function () {}), 20, "TEST_BROWSER_TIMEOUT", function () {
      potekKlican += 1;
    }),
    function (napaka) {
      return napaka && napaka.name === "TimeoutError" && napaka.code === "TEST_BROWSER_TIMEOUT";
    }
  );
  assert.strictEqual(potekKlican, 1, "timeout mora sprožiti natanko en aktivni cleanup");

  var pageSettings = {};
  var fakePage = {
    setDefaultNavigationTimeout: function (value) { pageSettings.navigation = value; },
    setDefaultTimeout: function (value) { pageSettings.operation = value; },
  };
  var prepared = await test.pripraviBrskalniskoStran({
    newPage: async function () { return fakePage; },
  });
  assert.strictEqual(prepared, fakePage);
  assert.deepStrictEqual(pageSettings, { navigation: 12000, operation: 8000 });

  var killed = 0;
  await test.zapriBrskalnikZaDokazilo({
    close: async function () { throw new Error("close failed"); },
    process: function () {
      return { killed: false, kill: function (signal) { assert.strictEqual(signal, "SIGKILL"); killed += 1; } };
    },
  });
  assert.strictEqual(killed, 1, "neuspešen close mora prisilno ustaviti samo lastni browser proces");

  assert.strictEqual(test.razvrstiBrskalniskoNapako({ name: "TimeoutError" }).degradable, true);
  assert.strictEqual(test.razvrstiBrskalniskoNapako({ name: "ProtocolError", message: "Target closed" }).degradable, false);
  assert.strictEqual(test.razvrstiBrskalniskoNapako({ message: "PUPPETEER_CONNECT_TARGET_BLOCKED" }).retryable, false);
  assert.strictEqual(test.razvrstiBrskalniskoNapako({ message: "EMPTY_IDENTITY_SCREENSHOT" }).degradable, false);

  var source = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta.js"), "utf8");
  assert.doesNotMatch(source, /timeout:\s*25000/);
  assert.doesNotMatch(source, /stran\.evaluate\(["']1["']\)/,
    "po ProtocolError ne smemo ustvariti novega visečega CDP ukaza");
  assert.strictEqual((source.match(/await pripraviBrskalniskoStran\(browser/g) || []).length, 4);
  var officialWrapper = source.slice(
    source.indexOf("async function preveriUradniInsolvencniPortal(subjekt"),
    source.indexOf("function razlogNapakeUradnegaInsolvencnegaPortala")
  );
  assert.doesNotMatch(officialWrapper, /for \(var poskus/,
    "en job ne sme več sam izvesti dveh uradnih browser-poskusov");

  var migration = fs.readFileSync(path.join(
    __dirname, "..", "supabase", "migrations", "20260831195905_boniteta_single_controlled_retry.sql"
  ), "utf8");
  assert.match(migration, /new\.max_attempts := least\(coalesce\(new\.max_attempts, 2\), 2\)/);
  assert.match(migration, /when faza = 'insolvenca' then interval '3 seconds'/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all on function public\.omeji_poskuse_mehka_boniteta_insolvenca\(\)/);

  console.log("OK: PLAN-31AVGUST browser budget, cleanup, 20 slotov in en kontroliran retry so preverjeni.");
}

main().catch(function (napaka) {
  console.error(napaka);
  process.exitCode = 1;
});
