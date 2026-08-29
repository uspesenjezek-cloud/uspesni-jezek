"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var api = require("../api/mehka-boniteta")._test;

var vMaster = api.razcleniImpressum([
  "<main><h1>Impressum</h1>",
  "<p>Angaben gemäß § 5 TMG</p>",
  "<p>Vladimir Tolpenko<br>Saverner Straße 1a<br>78166 Donaueschingen<br>Deutschland</p>",
  "<p>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV<br>Vladimir Tolpenko<br>Saverner Straße 1a<br>78166 Donaueschingen</p></main>",
  "<footer><p>Handwerk GmbH · Musterstraße 1 · 12345 Musterstadt · Geschäftsführer: Max Beispiel · USt-IdNr.: DE123456789</p></footer>",
].join(""), "https://www.v-master.de/impressum/", { ime: "V-Master HKS" });

assert.equal(vMaster.ime, "Vladimir Tolpenko");
assert.equal(vMaster.nosilec, "Vladimir Tolpenko");
assert.ok(!vMaster.zastopniki.includes("Max Beispiel"));

var ckFliesen = api.razcleniImpressum([
  "<main><h1>Impressum</h1>",
  "<p>Vollständiger Firmenname<br>C.K. Fliesen</p>",
  "<p>Adresse<br>Bahnhofstraße 37<br>Stadt<br>Wirges<br>PLZ<br>56422<br>Land<br>Deutschland</p>",
  "<p>Rechtsform<br>Einzelunternehmen</p>",
  "<p>Inhaber/in<br>Hakan Kurun</p>",
  "<p>Bahnhofstraße 37, 56422 Wirges</p></main>",
].join(""), "https://www.ck-fliesen.com/impressum", { ime: "C.K. Fliesen" });

assert.equal(ckFliesen.naziv, "C. K. Fliesen");
assert.equal(ckFliesen.nosilec, "Hakan Kurun");

var apiSource = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta.js"), "utf8");
assert.match(apiSource, /virNeuspelegaDokazila[\s\S]*sourceUrl:\s*virNeuspelegaDokazila\.sourceUrl/);

console.log("Top-Angebot stresne regresije: OK");
