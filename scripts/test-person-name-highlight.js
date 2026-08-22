"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

["api/_handlers/mehka-boniteta.js", "api/mehka-boniteta.js"].forEach(function (file) {
  var api = source(file);
  assert.match(api, /\["firmaPriimek", "blue"\], \["ime", "blue"\]/,
    file + " mora pri osebi modro označiti priimek in ime");
  assert.match(api, /blue:\s*\[[\s\S]*nastavitve\.polja\.firmaPriimek,[\s\S]*nastavitve\.polja\.ime,[\s\S]*\]/,
    file + " mora po oddaji obrazca ločeno poiskati celici priimka in imena");
  assert.match(api, /document\.querySelector\([^\n]+\) \|\| document\.getElementById\(selektor\)/,
    file + " mora uradno polje poiskati po atributu name ali po id");
  assert.match(api, /Firma\\s\*\\\/\\s\*Nachname[\s\S]*Vorname/,
    file + " mora imeti rezervno iskanje obeh osebnih polj po uradnih oznakah");
  assert.match(api, /inset 0 0 0 3px[\s\S]*outline[\s\S]*2px solid/,
    file + " mora modri okvir ohraniti viden tudi na pomanjšanem uradnem posnetku");
  assert.match(api, /jeIskanaOseba \? "Ime in priimek" : "Ime podjetja"/,
    file + " mora pravilno poimenovati modro oznako glede na vrsto subjekta");
  assert.match(api, /official-insolvency-v8-result-person-full-name-highlight/,
    file + " mora razveljaviti staro dokazilo brez označenega imena");
});

var queue = source("api/_lib/mehka-boniteta-queue.js");
assert.match(queue, /INSOLVENCY_CACHE_VERSION = "official-insolvency-v8-result-person-full-name-highlight"/,
  "insolvenčni predpomnilnik mora napredovati skupaj z različico posnetka");
assert.match(queue, /faza === "insolvenca" \? ":" \+ INSOLVENCY_CACHE_VERSION/,
  "ključ insolvenčnega predpomnilnika mora vsebovati različico uradnega posnetka");
assert.match(queue, /uradna\.evidenceVersion === INSOLVENCY_CACHE_VERSION/,
  "starega uradnega posnetka ni dovoljeno ponovno uporabiti");

var ui = source("app/bonitetna-preverba.js");
assert.match(ui, /jeIskanaOseba \? "Ime in priimek" : "Ime podjetja"/,
  "kartica mora pri osebi prikazati Ime in priimek");

var html = source("app/bonitetna-preverba.html");
assert.match(html, /bonitetna-preverba\.js\?v=20260820-person-name-highlight-v42/,
  "brskalnik mora prenesti novo različico uporabniškega vmesnika");

console.log("Označevanje imena in priimka: OK");
