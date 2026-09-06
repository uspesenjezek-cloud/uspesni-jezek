"use strict";

var assert = require("node:assert");
var collector = require("../api/_lib/boniteta-impressum-collector");

function adapters(fetchResult, parseResult) {
  return {
    fetchImpressum: async function () { return fetchResult; },
    parseLegalDocument: async function () { return parseResult; },
  };
}

async function check(label, fetchResult, parseResult, expected) {
  var result = await collector.collect({ website: "https://www.example.de/" }, adapters(fetchResult, parseResult));
  assert.strictEqual(result.status, expected, label);
  assert.ok(result.timing.totalMs >= 0, label + " must include timing");
  return result;
}

async function main() {
  await check("crawler yields a legal candidate", {
    status: "found", durationMs: 740, html: "<html>Impressum</html>", text: "Impressum", finalUrl: "https://example.de/impressum",
  }, { status: "found", durationMs: 10, value: { legalName: "Beispiel GmbH", postalCode: "20095", city: "Hamburg" } }, "found");
  await check("crawler result without a legal identity is not a company", {
    status: "found", durationMs: 740, html: "<html>Kontakt</html>", text: "Kontakt", finalUrl: "https://example.de/kontakt",
  }, { status: "not_found", durationMs: 10, reason: "legal_identity_missing" }, "impressum_missing");
  await check("robots denial is not a missing Impressum", { status: "robots_disallowed", durationMs: 20, reason: "robots_disallowed" }, null, "access_blocked");
  await check("rate limit is not a missing Impressum", { status: "rate_limited", durationMs: 20, reason: "rate_limited" }, null, "access_blocked");
  await check("crawler outage is a transport error", { status: "unavailable", durationMs: 8000, reason: "service_unavailable" }, null, "transport_error");
  await check("unconfigured crawler is a transport error", { status: "not_configured", durationMs: 0, reason: "not_configured" }, null, "transport_error");
  console.log("✓ crawler-first collector preserves source-specific outcomes without a legacy retry cascade");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
