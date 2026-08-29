"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

["api/_handlers/mehka-boniteta.js"].forEach(function (file) {
  var api = source(file);
  assert.match(api, /\["firmaPriimek", "blue"\], \["ime", "blue"\]/,
    file + " mora pred oddajo modro označiti priimek in ime");
  assert.match(api, /blue:\s*\[[\s\S]*nastavitve\.polja\.firmaPriimek,[\s\S]*nastavitve\.polja\.ime,[\s\S]*\]/,
    file + " mora po oddaji ločeno poiskati celici priimka in imena");
  assert.match(api, /inset 0 0 0 3px[\s\S]*outline[\s\S]*2px solid/,
    file + " mora moder okvir ohraniti viden tudi na pomanjšanem posnetku");
  assert.match(api, /official-insolvency-v11-proof-required-terminal/,
    file + " mora razveljaviti staro dokazilo brez označenega imena");
});

var queue = source("api/_lib/mehka-boniteta-queue.js");
assert.match(queue, /INSOLVENCY_CACHE_VERSION = "official-insolvency-v11-proof-required-terminal"/,
  "insolvenčni predpomnilnik mora napredovati skupaj z različico posnetka");
assert.match(queue, /faza === "insolvenca" \? ":" \+ INSOLVENCY_CACHE_VERSION/,
  "ključ insolvenčnega predpomnilnika mora vsebovati različico uradnega posnetka");
assert.match(queue, /uradna\.evidenceVersion === INSOLVENCY_CACHE_VERSION/,
  "starega uradnega posnetka ni dovoljeno ponovno uporabiti");

console.log("Označevanje imena in priimka: OK");
