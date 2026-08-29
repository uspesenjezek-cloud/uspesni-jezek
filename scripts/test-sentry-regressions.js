"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const boniteta = fs.readFileSync(path.join(repoRoot, "app", "bonitetna-preverba.js"), "utf8");
const bonitetaHtml = fs.readFileSync(path.join(repoRoot, "app", "bonitetna-preverba.html"), "utf8");
const bonitetaSredisce = fs.readFileSync(path.join(repoRoot, "app", "boniteta-sredisce.js"), "utf8");
const pos = fs.readFileSync(path.join(repoRoot, "app", "pos-terminal.js"), "utf8");

assert.match(
  boniteta,
  /async function nadaljujOpravilo\(jobId\) \{\s*var samoSpletniVnos = nacinVnosa === "spletna";/,
  "Nadaljevanje bonitetne preverbe mora samo določiti način vnosa."
);

const registrskiIzris = boniteta.indexOf("function izrisiRegistrskoPodjetje(podatki, identiteta)");
assert.ok(registrskiIzris > 0, "Registrski izris mora biti definiran.");
[
  "function zacetniciPodjetja(ime)",
  "function opisCasaPreverbe(vrednost)",
  "function northDataPodjetje(podatki)",
  "function starostPodjetja(vrednost)",
  "function odgovorneOsebe(company)",
  "function povzetekOdgovornihOseb(osebe)",
].forEach(function (deklaracija) {
  const mesto = boniteta.indexOf(deklaracija);
  assert.ok(mesto >= 0 && mesto < registrskiIzris,
    deklaracija + " mora biti deklarirana pred registrskim izrisom, da predogled ne sproži ReferenceError.");
});

const registrskiElementi = {
  podjetjeSklop: "boniteta-hwk-sklop",
  podjetjeGlava: "boniteta-podjetje-glava",
  podjetjePodnaslov: "boniteta-podjetje-podnaslov",
  podjetjeMonogram: "boniteta-podjetje-monogram",
  podjetjeIme: "boniteta-podjetje-ime",
  podjetjePreverjeno: "boniteta-podjetje-preverjeno",
  podjetjePregled: "boniteta-podjetje-pregled",
  podjetjeNavigacija: "boniteta-podjetje-navigacija",
  podjetjeUstanovitev: "boniteta-podjetje-ustanovitev",
  podjetjeUstanovitevDatum: "boniteta-podjetje-ustanovitev-datum",
  podjetjeUstanovitevStarost: "boniteta-podjetje-ustanovitev-starost",
  podjetjeUstanovitevLeta: "boniteta-podjetje-ustanovitev-leta",
  podjetjeUstanovitevLetaEnota: "boniteta-podjetje-ustanovitev-leta-enota",
  podjetjeUstanovitevMeseci: "boniteta-podjetje-ustanovitev-meseci",
  hwkPodatki: "boniteta-hwk-podatki",
};
Object.entries(registrskiElementi).forEach(function ([spremenljivka, id]) {
  assert.ok(boniteta.includes('var ' + spremenljivka + ' = document.getElementById("' + id + '")'),
    spremenljivka + " mora biti vezana na pravi element.");
  assert.ok(bonitetaHtml.includes('id="' + id + '"'),
    "HTML mora vsebovati #" + id + ", sicer registrski predogled sproži TypeError.");
});

assert.match(
  bonitetaSredisce,
  /function fillCompanyCardTestPreview\(\)[\s\S]*?UJBonitetaPrikaziRegistrskoPodjetje\([\s\S]*?foundingDate:"2005-01-19"[\s\S]*?corporatePurpose:/,
  "OPEN predogled mora skozi isti bogati registrski izris kot pravi rezultat."
);
assert.match(bonitetaHtml, /bonitetna-preverba\.js\?v=[^"']+/);
assert.match(bonitetaHtml, /boniteta-sredisce\.js\?v=[^"']+/);

assert.match(pos, /rezultat\.catch\(function \(error\)/,
  "Asinhrona potrditev dialoga mora obravnavati zavrnitev.");
assert.match(pos, /navigator\.clipboard\.writeText\(text\)[\s\S]*?\.catch\(function \(\) \{ openDialog\(/,
  "Neuspešno kopiranje mora odpreti varen nadomestni prikaz.");
assert.match(pos, /Promise\.resolve\(document\.fonts\.ready\)[\s\S]*?\.catch\(function \(\) \{ global\.setTimeout\(fitAllText, 0\); \}\)/,
  "Priprava pisav ne sme povzročiti neobravnavane zavrnitve.");
assert.match(pos, /loadServerState\(\)\.catch\(function \(error\)/,
  "Začetna sinhronizacija mora imeti zadnjo varnostno obravnavo.");

console.log("Sentry regresije: registrski predogled in POS terminal so zaščiteni.");
