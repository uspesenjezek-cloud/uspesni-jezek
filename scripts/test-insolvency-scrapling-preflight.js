"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var source = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta.js"), "utf8");
var start = source.indexOf("async function preveriUradniInsolvencniPortalEnkrat");
var end = source.indexOf("async function preveriUradniInsolvencniPortal(", start);
var body = source.slice(start, end);
var preflightPosition = body.indexOf("preflightOfficialInsolvencyPortal");
var browserPosition = body.indexOf("zazeniBrskalnikZaDokazilo");

assert.ok(preflightPosition >= 0 && browserPosition > preflightPosition,
  "Scrapling zdravstveni predpregled se mora začeti pred uradnim obrazcem");
assert.match(body, /void scraplingInsolvency\.preflightOfficialInsolvencyPortal\(\)\.then/,
  "zdravstveni predpregled mora teči neblokirajoče");
assert.doesNotMatch(body, /await scraplingInsolvency\.preflightOfficialInsolvencyPortal/,
  "uradna transakcija ne sme čakati na Scrapling");
assert.doesNotMatch(body, /official_portal_automation_not_permitted|predpregled\.status !==/,
  "Scrapling zdravstveni signal ne sme preklopiti dovoljene transakcije na ročni pregled");
assert.match(body, /automationPreflight:[\s\S]*?transactionMode/,
  "zdravstveni signal mora ostati sledljiv v dokaznem rezultatu");

console.log("Insolvency Scrapling non-blocking health preflight tests passed.");
