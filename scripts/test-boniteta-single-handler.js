"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
var compatibilityPath = path.join(root, "api", "mehka-boniteta.js");
var canonicalPath = path.join(root, "api", "_handlers", "mehka-boniteta.js");
var workerPath = path.join(root, "api", "mehka-boniteta-delavec.js");
var routerPath = path.join(root, "api", "boniteta.js");

var compatibilitySource = fs.readFileSync(compatibilityPath, "utf8");
var canonicalSource = fs.readFileSync(canonicalPath, "utf8");
var workerSource = fs.readFileSync(workerPath, "utf8");
var routerSource = fs.readFileSync(routerPath, "utf8");

assert.match(compatibilitySource, /module\.exports\s*=\s*require\("\.\/_handlers\/mehka-boniteta"\)/,
  "stara pot mora biti samo preusmeritev na kanonični handler");
assert.doesNotMatch(compatibilitySource, /async function handler|function oceniOpenRegisterZadetek|function poisciVImpressumu/,
  "združljivostna pot ne sme ponovno vsebovati poslovne logike");
assert.match(workerSource, /require\("\.\/_handlers\/mehka-boniteta"\)/,
  "delavec mora neposredno uporabljati kanonični handler");
assert.match(routerSource, /soft:\s*require\("\.\/_handlers\/mehka-boniteta"\)/,
  "ročni API mora uporabljati isti kanonični handler");
assert.match(canonicalSource, /function oceniVarnoUjemanjeNaziva/,
  "kanonični handler mora ohraniti varno splošno ujemanje imen");
assert.match(canonicalSource, /purpose: typeof podjetje\.purpose === "string" \? podjetje\.purpose\.trim\(\) : ""/,
  "kanonični handler mora ohraniti namen podjetja iz uradnega vira");

var compatibility = require(compatibilityPath);
var canonical = require(canonicalPath);
assert.strictEqual(compatibility, canonical,
  "obe poti morata izvoziti isti primerek handlerja in iste testne funkcije");
assert.strictEqual(compatibility._test, canonical._test,
  "testna pogodba ne sme imeti druge kopije poslovne logike");

console.log("Boniteta uporablja en sam kanonični handler: OK");
