const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.js"), "utf8");

assert.match(html, /<small>REGISTER<\/small><strong id="boniteta-podjetje-status-podjetja"/,
  "Aktivno mora biti jasno označeno kot registrski status.");
assert.match(html, /<strong>Uradni insolvenčni register<\/strong>[\s\S]*?<h3>Uporabljeni iskalni podatki<\/h3>/,
  "Dokaz insolvenčne poizvedbe ne sme biti predstavljen kot splošni poslovni register.");
assert.match(js, /podjetjeJeAktivno = identiteta\.active === true[\s\S]*?podjetjeStatusPodjetja\.textContent = podjetjeJeAktivno \? "Aktivno"/,
  "Registrski status mora še naprej prihajati iz potrjene identitete.");
assert.match(js, /imaWildcardIme[\s\S]*?Iskalni niz podjetja[\s\S]*?Potrjeno pravno ime/,
  "Wildcard mora biti prikazan kot iskalni niz, ločeno od pravnega imena.");
assert.match(js, /Za preverjene iskalne podatke v uradnem insolvenčnem registru ni bila najdena objava\./,
  "Rezultat brez zadetka mora biti omejen na izvedeno poizvedbo.");
assert.match(js, /Uradni insolvenčni register[\s\S]*?izidJePotrjen \? "BREZ OBJAVE"/,
  "Kartica in značka morata poimenovati dejanski izid insolvenčne poizvedbe.");
assert.doesNotMatch(js, /Insolvenčnost je preverjena\.|Identiteta podjetja je potrjena\./,
  "Insolvenčni rezultat ne sme potrjevati splošne identitete ali plačilne sposobnosti.");

console.log("✓ Registrski status in insolvenčne objave so prikazani ločeno.");
