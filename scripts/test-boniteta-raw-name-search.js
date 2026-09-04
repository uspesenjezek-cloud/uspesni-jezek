"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
var source = fs.readFileSync(path.join(root, "api/_handlers/mehka-boniteta.js"), "utf8");
var activeFlow = source.slice(source.indexOf("async function handler"), source.indexOf("handler._test"));

// 1. The INVALID_INPUT guard must let a flagged bare name through.
assert.match(activeFlow, /surovoImeIskanje\s*=\s*Boolean\(telo\.rawNameIdentitySearch === true/,
  "backend mora prepoznati izrecno označeno surovo ime brez naslova");
assert.match(activeFlow, /!izbranoRegistrskoPodjetje\s*&&\s*!surovoImeIskanje\)\s*\{[\s\S]{0,200}INVALID_INPUT/,
  "prazen vnos brez spletne strani, naslova ali kandidata mora ostati zavrnjen tudi za novo pot");

// 2. The raw-name OpenRegister branch must force a fresh call when this flag is set.
assert.match(activeFlow, /openregisterOsnovniVnos\.ime\)\s*\{[\s\S]{0,220}poisciOpenRegisterNajvecEnkrat\(openregisterOsnovniVnos,\s*\{\s*forceFresh:\s*surovoImeIskanje\s*\}\)/,
  "surovo ime brez naslova mora vedno sprožiti sveže OpenRegister iskanje, ne predpomnjenega");

// 3. Mutual exclusivity: rawNameIdentitySearch must not combine with any pre-resolved candidate/proof field.
assert.match(activeFlow, /rawNameIdentitySearch[\s\S]{0,500}RAW_NAME_SEARCH_CONFLICT/,
  "surovo ime ne sme sobivati z lokalno kartico, podpisanim predlogom ali eksplicitnim companyId");

console.log("✓ Backend raw-name identity search: guard, forceFresh in izključnost so ožičeni.");
