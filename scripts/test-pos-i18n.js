"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
const source = fs.readFileSync(path.join(root, "app", "pos-terminal-i18n.js"), "utf8");

function load(search) {
  const context = {
    URLSearchParams,
    location: { search },
    globalThis: null,
    module: { exports: {} },
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: "pos-terminal-i18n.js" });
  return context.module.exports;
}

assert.match(html, /pos-terminal-i18n\.js\?v=20260821-de-market-v4/);
assert.ok(html.indexOf("pos-terminal-i18n.js") < html.indexOf("pos-terminal.js"), "locale layer must load before POS behavior");
assert.match(html, /<html lang="sl" class="pos-page">/, "Slovenian remains the default document language");

const sl = load("");
assert.equal(sl.locale, "sl");
assert.equal(sl.translate("Računi in plačila"), "Računi in plačila");

const de = load("?lang=de");
assert.equal(de.locale, "de");
assert.equal(de.translate("Računi in plačila"), "Rechnungen und Zahlungen");
assert.equal(de.translate("  Nov račun  "), "  Neue Rechnung  ");
assert.equal(de.translate("14 dni"), "14 Tage");
assert.equal(de.translate("3 računi"), "3 računi");
assert.equal(de.translate("3 računov"), "3 Rechnungen");
assert.equal(de.translate("Opis postavke 4"), "Beschreibung der Position 4");
assert.equal(de.translate("Nova ponudba"), "Neues Angebot");
assert.equal(de.translate("3 projektov"), "3 Projekte");
assert.equal(de.translate("Komu pošiljate ponudbo?"), "An wen senden Sie das Angebot?");
assert.equal(de.translate("Datum ponudbe *"), "Angebotsdatum *");
assert.equal(de.translate("Sinhronizirano"), "Synchronisiert");
assert.equal(de.translate("Ni dosegljivo"), "Nicht erreichbar");
assert.equal(de.translate("Glavna navigacija aplikacije"), "Hauptnavigation der Anwendung");
assert.equal(de.translate("Začeti novo ponudbo?"), "Neues Angebot beginnen?");
assert.equal(de.translate("Dovoljeno še največ 40 %."), "Noch höchstens 40 % zulässig.");
assert.equal(de.translate("Postavka 12"), "Position 12");
assert.equal(de.translate("60 dni"), "60 Tage");

const deLocale = load("?locale=de-DE");
assert.equal(deLocale.isGerman, true);

console.log("POS German locale tests passed.");
