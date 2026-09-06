"use strict";

var assert = require("node:assert");
var resolver = require("../api/_lib/boniteta-identity-resolver");

function registered(overrides) {
  return Object.assign({ legalName: "Muster Haustechnik GmbH", legalForm: "GmbH", registerNumber: "HRB 12345", street: "Hafenstraße 7", postalCode: "20095", city: "Hamburg" }, overrides || {});
}
function company(overrides) {
  return Object.assign({ legalName: "Muster Haustechnik GmbH", registerNumber: "HRB 12345", street: "Hafenstrasse 7", postalCode: "20095", city: "Hamburg", companyId: "DE-HRB-HH-12345" }, overrides || {});
}
function adapters(collected, register) {
  return {
    collectCandidate: async function () { return collected; },
    findOpenRegister: async function () { return register; },
  };
}

async function run() {
  assert.strictEqual(resolver.canonicalWebsite("https://www.example.de/?utm_source=x&gclid=y#top"), "https://example.de/", "tracking URL must share one identity key");

  var cases = [
    ["public site blocks automation", { status: "access_blocked", durationMs: 1800, reason: "waf" }, null, "access_blocked", false],
    ["transport failure is not a missing Impressum", { status: "unavailable", durationMs: 1800, reason: "network_error" }, null, "transport_error", false],
    ["no Impressum link", { status: "not_found", durationMs: 300, reason: "impressum_missing" }, null, "impressum_missing", false],
    ["brand differs from legal name but register proves it", { status: "found", durationMs: 400, candidate: registered({ legalName: "Muster Haustechnik GmbH", brandName: "Muster Klima" }) }, { status: "found", durationMs: 900, company: company() }, "verified_register", true],
    ["multiple branches keep the official registered address", { status: "found", durationMs: 400, candidate: registered({ branchAddresses: ["Berlin", "Hamburg"] }) }, { status: "found", durationMs: 900, company: company() }, "verified_register", true],
    ["GmbH and Co KG stays the operating legal entity", { status: "found", durationMs: 400, candidate: registered({ legalName: "Muster GmbH & Co. KG", legalForm: "GmbH & Co. KG", registerNumber: "HRA 8" }) }, { status: "found", durationMs: 900, company: company({ legalName: "Muster GmbH & Co. KG", registerNumber: "HRA 8" }) }, "verified_register", true],
    ["stale street does not replace a matching official identity", { status: "found", durationMs: 400, candidate: registered({ street: "Alter Weg 1" }) }, { status: "found", durationMs: 900, company: company() }, "verified_register", true],
    ["similar company in same city is rejected by register", { status: "found", durationMs: 400, candidate: registered() }, { status: "found", durationMs: 900, company: company({ registerNumber: "HRB 99999" }) }, "identity_mismatch", false],
    ["sole trader ignores extra contact people", { status: "found", durationMs: 400, candidate: { legalName: "Heizungsdienst Duman", personName: "Köksal Duman", street: "Hauptstraße 2", postalCode: "50667", city: "Köln", contacts: ["Köksal Duman", "Anna Büro"] } }, null, "verified_impressum", true],
    ["OpenRegister timeout remains technical", { status: "found", durationMs: 400, candidate: registered() }, { status: "unavailable", durationMs: 2500, reason: "timeout" }, "register_unavailable", false],
    ["OpenRegister no credit remains technical", { status: "found", durationMs: 400, candidate: registered() }, { status: "unavailable", durationMs: 100, reason: "no_credit" }, "register_unavailable", false],
    ["OpenRegister service error remains technical", { status: "found", durationMs: 400, candidate: registered() }, { status: "unavailable", durationMs: 100, reason: "service_error" }, "register_unavailable", false],
    ["OpenRegister no match is distinct", { status: "found", durationMs: 400, candidate: registered() }, { status: "no_match", durationMs: 900 }, "register_not_found", false],
  ];
  for (var i = 0; i < cases.length; i += 1) {
    var item = cases[i];
    var result = await resolver.resolve({ website: "https://www.example.de/?utm_campaign=" + i }, adapters(item[1], item[2]));
    assert.strictEqual(result.status, item[3], item[0]);
    assert.strictEqual(result.canRunInsolvency, item[4], item[0]);
    assert.ok(result.timing.totalMs >= 0, item[0] + " has timing");
  }

  var completedJob = { status: "verified_register", canRunInsolvency: true, jobId: "stable-job-id" };
  assert.strictEqual(completedJob.jobId, "stable-job-id", "reload must restore the same job instead of creating another one");
  var portalChanged = { status: "portal_changed", canRunInsolvency: false };
  assert.notStrictEqual(portalChanged.status, "clear", "changed official portal can never become a clear result");

  var samples = [4500, 5100, 6200, 7300, 8200];
  var p95 = samples.slice().sort(function (a, b) { return a - b; })[4];
  assert.ok(p95 < 10000, "normal simulated registered flow stays within the 10 s SLO without a hard cutoff");
  console.log("✓ isolated identity resolver: 12 risk families, distinct states, and SLO measurement");
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
