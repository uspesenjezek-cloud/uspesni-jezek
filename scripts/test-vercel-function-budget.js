"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const apiDir = path.join(root, "api");
const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const ignoreLines = fs.readFileSync(path.join(root, ".vercelignore"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
const ignored = new Set(ignoreLines.filter((line) => /^api\/[^/]+\.js$/.test(line)));
const deployedFunctions = fs.readdirSync(apiDir)
  .filter((name) => name.endsWith(".js"))
  .map((name) => "api/" + name)
  .filter((name) => !ignored.has(name));

assert.ok(
  deployedFunctions.length <= 11,
  "POS združevanje mora ohraniti vsaj eno prosto mesto v omejitvi 12 funkcij; trenutno bi jih bilo " + deployedFunctions.length + "."
);

const expectedRoutes = {
  "/api/pos-racun-pdf": "/api/pos?handler=invoice-pdf",
  "/api/pos-angebot-pdf": "/api/pos?handler=offer-pdf",
  "/api/pos-pogodba-pdf": "/api/pos?handler=contract-confirmation-pdf",
  "/api/pos-racun-korekcija": "/api/pos?handler=invoice-adjustment",
  "/api/pos-racun-xrechnung": "/api/pos?handler=invoice-xrechnung",
  "/api/pos-dostava-sandbox": "/api/pos?handler=delivery-sandbox",
  "/api/pos-dostava-delavec": "/api/pos?handler=delivery-worker",
  "/api/pos-arhiv-delavec": "/api/pos?handler=archive-worker",
  "/api/pos-verfahrensdokumentation-pdf": "/api/pos?handler=procedure-documentation-pdf"
};
const rewrites = new Map((config.rewrites || []).map((entry) => [entry.source, entry.destination]));
for (const [source, destination] of Object.entries(expectedRoutes)) {
  assert.equal(rewrites.get(source), destination, source + " mora ostati usmerjen skozi združeni POS vhod.");
}

const posRouter = fs.readFileSync(path.join(apiDir, "pos.js"), "utf8");
for (const handler of ["invoice-pdf", "offer-pdf", "contract-confirmation-pdf", "invoice-adjustment", "invoice-xrechnung", "delivery-sandbox", "delivery-worker", "archive-worker", "procedure-documentation-pdf"]) {
  assert.match(posRouter, new RegExp('"' + handler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"\\s*:'), handler + " mora biti registriran v api/pos.js.");
}

console.log("Vercel funkcijski proračun in združene POS poti: OK (" + deployedFunctions.length + "/12).\n");
