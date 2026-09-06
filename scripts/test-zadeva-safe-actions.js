"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app", "app.js"), "utf8");
const page = fs.readFileSync(path.join(root, "app", "zascita-posla.html"), "utf8");

assert.match(app, /async function izbrisiZadevo\(zadeva\)[\s\S]*?await potrdiVprasanje\(\{[\s\S]*?stil: "nevarno"/);
assert.match(app, /if \(!potrjeno\) return;[\s\S]*?\.from\("zadeve"\)[\s\S]*?\.delete\(\)[\s\S]*?\.eq\("id", zadeva\.id\)/);
assert.doesNotMatch(app, /function posljiOpomin\(/,
  "seznam zadev ne sme mimo revizijske poti neposredno premikati statusa");
assert.doesNotMatch(app, /\.update\(\{ status: naslednjiStatus\(/);
assert.doesNotMatch(app, /Pošlji naslednji opomin/,
  "gumb ne sme trditi, da je poslal opomin, če je samo spremenil status");
assert.match(app, /izvedba\.html\?zadevaId=/,
  "aktivirana zadeva mora ohraniti povezavo na varno Izvedbo");
assert.match(page, /app\.js\?v=20260829-safe-case-actions-v1/);

console.log("OK: izbris zahteva potrditev, neposredni obhod revizijske poti pa je odstranjen.");

