"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var test = require("../api/mehka-boniteta")._test;

assert.strictEqual(test.najdiOpenRegisterNazivNaDomaciStrani(
  "<html><title>Sanitär in Frankfurt</title><p>IHRE ALFONS DRESCH GMBH</p></html>",
  "https://alfonsdresch.de/"
), "ALFONS DRESCH GMBH", "zanesljiv pravni naziv iz URL-konteksta mora neposredno v OpenRegister");
assert.strictEqual(test.najdiOpenRegisterNazivNaDomaciStrani(
  "<html><p>Partner Siemens AG</p><p>Webdesign Fremde Agentur GmbH</p></html>",
  "https://beispiel-handwerk.de/"
), "", "tuja družba ali izdelovalec strani ne sme postati OpenRegister kandidat");

var source = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta.js"), "utf8");
var handler = source.slice(source.indexOf("async function handler(req, res)"), source.indexOf("var wrappedHandler"));
assert.match(handler, /pripraviHitriOpenRegisterVnosIzSpletneStrani\(vnos\)[\s\S]*?openregisterOsnovniVnos\.ime[\s\S]*?poisciOpenRegisterNajvecEnkrat\(openregisterOsnovniVnos\)/,
  "zanesljiv URL-kontekst mora v en OpenRegister klic brez Impressum actorja");
assert.match(source, /pripraviHitriOpenRegisterVnosIzSpletneStrani[\s\S]*?!pravnaPovezava[\s\S]*?new URL\("impressum", pravniKoren\)/,
  "hitri tok mora ob manjkajoči povezavi poskusiti varen kanonični Impressum v istem pravnem kontekstu");
assert.match(handler, /else if \(vnos\.spletnaStran\)[\s\S]*?apifyImpressum\.findLegalNotice\(vnos\.spletnaStran\)[\s\S]*?poisciOpenRegisterNajvecEnkrat\(apifyOpenRegisterVnos\)/,
  "brez zanesljivega naziva sme actor pripraviti samo kandidata za isti enkratni OpenRegister korak");
assert.doesNotMatch(source, /scrapling-impressum-client|boniteta-impressum-collector|poisciImpressumZBrskalnikom/,
  "stare počasne identitetne veje morajo biti odstranjene");
assert.match(handler, /var northDataZacetek = zacniNorthDataPoOpenRegisterju\(openregister, zacasnaIdentiteta, svezaNorthDataPreverba\)/,
  "oba North Data runa se smeta začeti samo na eni točki po OpenRegister odločitvi");

console.log("✓ Impressum identitetni tok je omejen, linearen in brez starega fan-outa.");
