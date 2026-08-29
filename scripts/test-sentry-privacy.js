"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var sentry = require("../api/_lib/sentry");

var event = {
  user: { email: "stranka@example.com" },
  request: { data: { iban: "DE001234" }, headers: { authorization: "Bearer secret" } },
  extra: { invoice: "R-2026-001" },
  breadcrumbs: [{ message: "Klik uporabnika" }],
  message: "Napaka za stranko Janez Novak",
  exception: { values: [{ type: "TypeError", value: "IBAN DE001234 ni veljaven" }] },
};

var scrubbed = sentry._test.scrubEvent(event);
assert.strictEqual(scrubbed.user, undefined);
assert.strictEqual(scrubbed.request, undefined);
assert.strictEqual(scrubbed.extra, undefined);
assert.strictEqual(scrubbed.breadcrumbs, undefined);
assert.strictEqual(scrubbed.message, "Server error");
assert.strictEqual(scrubbed.exception.values[0].value, "TypeError");
assert.strictEqual(sentry._test.cleanPath("/api/test/123456?email=a@b.si"), "/api/test/:id");
assert.strictEqual(sentry._test.cleanPath("/api/test/550e8400-e29b-41d4-a716-446655440000"), "/api/test/:id");

async function handler() { return "ok"; }
handler._test = { parser: true };
var wrapped = sentry.wrapHandler(handler, "/api/test");
assert.deepStrictEqual(wrapped._test, { parser: true });

var generator = fs.readFileSync(path.join(__dirname, "generate-config.js"), "utf8");
assert.ok(generator.includes("const SENTRY_CONFIG = globalThis.SENTRY_CONFIG"));
assert.ok(generator.includes("SENSITIVE|REDACTED"));
assert.ok(generator.includes("!/^https:\\/\\/[^\\s/]+\\.supabase\\.co"));

var browserEntry = fs.readFileSync(path.join(__dirname, "..", "app", "sentry-entry.js"), "utf8");
assert.ok(browserEntry.includes('setAttribute("data-sentry-ready", "true")'));

var exampleConfig = fs.readFileSync(path.join(__dirname, "..", "app", "config.example.js"), "utf8");
var sandbox = { globalThis: {} };
new vm.Script(exampleConfig, { filename: "config.example.js" }).runInNewContext(sandbox);
assert.ok(sandbox.globalThis.SENTRY_CONFIG);
assert.strictEqual(sandbox.globalThis.SENTRY_CONFIG.environment, "development");

console.log("Sentry privacy testi uspešni.");
