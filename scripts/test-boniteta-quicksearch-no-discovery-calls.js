"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
var source = fs.readFileSync(path.join(root, "app/bonitetna-preverba.js"), "utf8");
var iskanje = source.slice(
  source.indexOf("async function izvediUniverzalnoIskanje"),
  source.indexOf("function odpriAutocomplete")
);

assert.doesNotMatch(iskanje, /poisciNorthDataPodjetja\(\)/,
  "izvediUniverzalnoIskanje ne sme več avtomatsko klicati plačljivega North Data autocompleta");
assert.doesNotMatch(iskanje, /poisciAutocompletePodjetja\(\)/,
  "izvediUniverzalnoIskanje ne sme več avtomatsko klicati plačljivega OpenRegister identity_search");
assert.match(iskanje, /nacinVnosa = "surovo_ime"/,
  "brez enolične lokalne kartice mora surovo ime iti neposredno v eno samo pravo preverbo");
assert.match(iskanje, /await izvediBonitetnoPreverbo\(\)/,
  "surovo ime mora iti skozi isto čakalno vrsto kot vsaka druga dejanska preverba");

var preverba = source.slice(
  source.indexOf("async function izvediBonitetnoPreverbo"),
  source.indexOf("obrazec.addEventListener(\"submit\"")
);
assert.match(preverba, /surovoImeVnos = nacinVnosa === "surovo_ime"/,
  "izvediBonitetnoPreverbo mora prepoznati novi način vnosa surovega imena");
assert.match(preverba, /rawNameIdentitySearch:\s*surovoImeVnos/,
  "payload mora backend izrecno obvestiti, da gre za surovo iskanje po imenu");
assert.match(preverba, /!samoSpletniVnos && !registrskiVnos && !surovoImeVnos && !obrazec\.reportValidity\(\)/,
  "surovo ime ne sme zahtevati izpolnjenega ročnega naslovnega obrazca");

assert.match(source, /"Podjetja »" \+ .*?\+ "« v registru nismo našli\./,
  "sporočilo ob registrskem missu mora poimensko pokazati iskano ime, ne le generičnega besedila");
assert.match(preverba, /podatki\.openregister && podatki\.openregister\.status === "ambiguous"/,
  "surovo ime mora znati prikazati OpenRegistrove lastne kandidate ob dvoumnem zadetku, brez novega plačljivega klica");

console.log("✓ Quicksearch nima več plačljivih discovery klicev; surovo ime gre v eno pravo preverbo.");
