"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var js = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.js"), "utf8");
var css = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.css"), "utf8");
var center = fs.readFileSync(path.join(root, "app", "boniteta-sredisce.js"), "utf8");
var insolvencyPreviewStart = center.indexOf("function fillInsolvencyResultTestPreview");
var insolvencyPreviewEnd = center.indexOf("\n  function ", insolvencyPreviewStart);
var insolvencyPreview = center.slice(insolvencyPreviewStart, insolvencyPreviewEnd > insolvencyPreviewStart ? insolvencyPreviewEnd : undefined);

assert.match(js, /identitetaImaKompaktniPrikaz[\s\S]*?"manual_input", "confirmed_manual"[\s\S]*?UJBonitetaPrikaziRegistrskoPodjetje\(podatki\)/,
  "potrjena oseba ne sme več pasti v stari rezultat Identiteta");
assert.doesNotMatch(js, /identitetaNaslov\.textContent = "Ročno vneseni podatki"/,
  "stara ročna kartica mora biti odstranjena iz izrisa");
assert.match(js, /jeOseba \? "Podatki osebe" : "Podatki podjetja"/,
  "enotni rezultat mora imeti pravilno osebno oznako");
assert.match(js, /jeOseba \? "Naslov" : "Sedež"/,
  "oseba mora imeti naslov namesto sedeža podjetja");
assert.match(js, /if \(identiteta\.registerNumber \|\| \(!jeOseba && pravnaOblika\)\)/,
  "osebni rezultat ne sme prikazati praznega registra");
assert.match(css, /boniteta-register-result[\s\S]*?\.boniteta-preverjeni-viri[\s\S]*?display: none !important/,
  "stari seznam uporabljenih virov mora biti odstranjen iz kompaktnega rezultata");
assert.match(css, /boniteta-register-result[\s\S]*?#boniteta-rezultat > \.boniteta-ponovi[\s\S]*?display: none !important/,
  "stari gumb Preveri drugo stranko ne sme biti del kompaktnega rezultata");
assert.match(center, /location\.hostname==="localhost"[\s\S]*?person-preview[\s\S]*?fillPersonCardTestPreview/,
  "osebni vizualni predogled mora biti omejen na localhost");
assert.match(center, /fillPersonCardTestPreview\(\)[\s\S]*?fillInsolvencyResultTestPreview\(false,true\)/,
  "osebni tok mora pripraviti isti uradni dokazni posnetek kot insolvenčni rezultat");
assert.match(insolvencyPreview, /Identiteta osebe je potrjena[\s\S]*?officialSvg[\s\S]*?boniteta-insolvenca-posnetek"\)\.hidden=false/,
  "osebni insolvenčni rezultat mora vsebovati posnetek in osebno besedilo");

console.log("✓ Osebna preverba uporablja enotni kompaktni rezultat.");
