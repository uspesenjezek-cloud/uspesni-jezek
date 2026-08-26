"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseScript } = require("meriyah");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
const source = fs.readFileSync(path.join(root, "app", "pos-terminal-i18n.js"), "utf8");
const posSource = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");

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

assert.match(html, /pos-terminal-i18n\.js\?v=20260826-openapi-381-v7/);
assert.ok(html.indexOf("pos-terminal-i18n.js") < html.indexOf("pos-terminal.js"), "locale layer must load before POS behavior");
assert.match(html, /<html lang="de" class="pos-page">/, "German is the default POS document language");

const sl = load("?lang=sl");
assert.equal(sl.locale, "sl");
assert.equal(sl.translate("Računi in plačila"), "Računi in plačila");

const de = load("");
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
assert.equal(de.translate("Kako bo sklenjena pogodba? *"), "Wie wird der Vertrag geschlossen? *");
assert.equal(de.translate("Izberite način sklenitve"), "Art des Vertragsschlusses auswählen");
assert.equal(de.translate("V poslovnih prostorih izvajalca"), "In den Geschäftsräumen des Auftragnehmers");
assert.equal(de.translate("Na daljavo (e-pošta, telefon, splet)"), "Im Fernabsatz (E-Mail, Telefon, online)");
assert.equal(de.translate("Zunaj poslovnih prostorov"), "Außerhalb von Geschäftsräumen");
assert.equal(de.translate("Izrecno zahtevano nujno popravilo"), "Ausdrücklich verlangte dringende Reparatur");
assert.match(de.translate("Pri pogodbi na daljavo ali zunaj poslovnih prostorov bo zaklenjeni PDF samodejno vseboval Widerrufsbelehrung, Muster-Widerrufsformular in izjavo za morebitni predčasni začetek dela."), /Fernabsatzvertrag/);
assert.equal(de.translate("Natančen obseg nujnega popravila *"), "Genauer Umfang der dringenden Reparatur *");
assert.match(de.translate("Npr. zaustavitev aktivnega iztekanja in zamenjava nujno potrebnega ventila"), /aktiven Leckage/);
assert.match(de.translate("Izjema velja samo za izrecno zahtevano nujno popravilo in nujno potrebne nadomestne dele, ne za dodatna dela."), /unbedingt erforderliche Ersatzteile/);
assert.equal(de.translate("Simulirano obvestilo"), "Simulierte Benachrichtigung");
assert.equal(de.translate("Enak odprti znesek"), "Gleicher offener Betrag");
assert.equal(de.translate("Datum ponudbe *"), "Angebotsdatum *");
assert.equal(de.translate("Sinhronizirano"), "Synchronisiert");
assert.equal(de.translate("Ni dosegljivo"), "Nicht erreichbar");
assert.equal(de.translate("Glavna navigacija aplikacije"), "Hauptnavigation der Anwendung");
assert.equal(de.translate("Začeti novo ponudbo?"), "Neues Angebot beginnen?");
assert.equal(de.translate("Dovoljeno še največ 40 %."), "Noch höchstens 40 % zulässig.");
assert.equal(de.translate("Delni računi"), "Abschläge");
assert.equal(de.translate("30 % · plačilo odprto"), "30 % · Zahlung offen");
assert.equal(de.translate("30 % · plačano"), "30 % · bezahlt");
assert.equal(de.translate("Končni račun čaka na celotno plačilo vseh delnih računov."), "Die Schlussrechnung wartet auf die vollständige Zahlung aller Abschlagsrechnungen.");
assert.equal(de.translate("Postavka 12"), "Position 12");
assert.equal(de.translate("Postavka 1 potrebuje opis."), "Position 1 benötigt eine Beschreibung.");
assert.equal(de.translate("Količina pri postavki 2 mora biti večja od 0."), "Die Menge der Position 2 muss größer als 0 sein.");
assert.equal(de.translate("Cena pri postavki 3 ne sme biti negativna."), "Der Preis der Position 3 darf nicht negativ sein.");
assert.equal(de.translate("2 postavki"), "2 Positionen");
assert.equal(de.translate("Račun TEST-2026-0001 uporablja davčno stopnjo brez nastavljenega DATEV konta."), "Rechnung TEST-2026-0001 verwendet einen Steuersatz ohne eingerichtetes DATEV-Konto.");
assert.equal(de.translate("Račun TEST-2026-0001 uporablja davčno stopnjo 19 %, ki nima DATEV konta."), "Rechnung TEST-2026-0001 verwendet den Steuersatz 19 %, für den kein DATEV-Konto eingerichtet ist.");
assert.equal(de.translate("Dobropis TEST-GS-2026-0001 uporablja davčno stopnjo 7 %, ki nima DATEV konta."), "Gutschrift TEST-GS-2026-0001 verwendet den Steuersatz 7 %, für den kein DATEV-Konto eingerichtet ist.");
assert.equal(de.translate("Dokumentni številki TEST-A in TEST-B bi imeli enak DATEV ključ."), "Die Dokumentnummern TEST-A und TEST-B würden denselben DATEV-Schlüssel erhalten.");
assert.equal(de.translate("Dokument TEST-2026-0001 nima veljavne DATEV povezave do PDF-ja."), "Dokument TEST-2026-0001 besitzt keine gültige DATEV-Verknüpfung zur PDF-Datei.");
assert.equal(de.translate("finAPI: novih 2; že znanih 3."), "finAPI: 2 neu; 3 bereits bekannt.");
assert.equal(de.translate("Uvoženo: 4; podvojeno preskočeno: 1."), "Importiert: 4; Duplikate übersprungen: 1.");
assert.equal(de.translate("60 dni"), "60 Tage");
assert.equal(de.translate("Storitev, povezana z nepremičnino"), "Leistung im Zusammenhang mit einem Grundstück");
assert.match(de.translate("Za zasebno stranko doda zakonsko opozorilo o dveletni hrambi dokazil (§ 14b UStG)."), /zweijährigen Aufbewahrung/);
assert.match(de.translate("Bauabzugsteuer po § 48 EStG velja le za poslovnega ali javnega prejemnika."), /Bauabzugsteuer/);
assert.match(de.translate("Pravi račun brez Freistellungsbescheinigung je zaklenjen, dokler POS ne podpira 15 % Bauabzugsteuer in pravilne uskladitve plačila."), /15-prozentigen Bauabzugsteuer/);
assert.match(de.translate("Handwerkerleistung po § 35a EStG je namenjena zasebnemu prejemniku."), /privaten Leistungsempfänger/);
assert.equal(de.translate("Pravna oblika in obvezni registrski podatki"), "Rechtsform und erforderliche Registerangaben");
assert.equal(de.translate("Pravna oblika *"), "Rechtsform *");
assert.equal(de.translate("Vsi lastniki / zastopniki *"), "Alle Inhaber / Vertretungsberechtigten *");
assert.equal(de.translate("Polna imena, ločena z vejico"), "Namen, mit Komma");
assert.equal(de.translate("Registrirani sedež"), "Sitz");
assert.equal(de.translate("Registrsko sodišče"), "Registergericht");
assert.equal(de.translate("Registrska številka"), "Registernummer");
assert.equal(de.translate("Pogoji za Kleinunternehmer"), "Voraussetzungen für Kleinunternehmer");
assert.equal(de.translate("Prejem strukturiranih e-računov"), "Empfang strukturierter E-Rechnungen");
assert.match(de.translate("Nalagam dejansko stanje PDF/XML izvirnikov in zaklenjenih ločenih kopij …"), /separaten Sicherungen/);
assert.equal(de.translate("Preveri arhiv zdaj"), "Archiv jetzt prüfen");
assert.equal(de.translate("Prekliči"), "Abbrechen");
assert.equal(de.translate("Storniraj projekt"), "Projekt stornieren");
assert.equal(de.translate("Strežniški ključi še niso nastavljeni"), "Serverseitige Schlüssel sind noch nicht eingerichtet");
assert.equal(de.translate("NAPAKA"), "FEHLER");
assert.equal(de.translate("Prilivi"), "Umsätze");
assert.equal(de.translate("Predlogi"), "Vorschläge");
assert.equal(de.translate("Potrjeni"), "Bestätigt");
assert.equal(de.translate("Potrdi povezavo"), "Zuordnung bestätigen");
assert.equal(de.translate("Plačilo potrjeno"), "Zahlung bestätigt");
assert.equal(de.translate("✓ Plačilo potrjeno"), "✓ Zahlung bestätigt");
assert.equal(de.translate("Sandbox povezan · brez pravih nakazil"), "Sandbox verbunden · keine echten Kontobewegungen");
assert.equal(de.translate("Prejeto na Secondary-TestAccount · DE23533700080111111102"), "Eingegangen auf Secondary-TestAccount · DE23533700080111111102");
assert.equal(de.translate("Zapadlo"), "Überfällig");
assert.equal(de.translate("Zapadlo · 1 dan"), "Überfällig · 1 Tag");
assert.equal(de.translate("Zapadlo · 4 dni"), "Überfällig · 4 Tage");
assert.equal(de.translate("Knjižbe"), "Buchungen");
assert.equal(de.translate("Promet"), "Umsatz");
assert.match(de.translate("Beraternummer mora biti med 1001 in 9999999."), /Beraternummer/);
assert.match(de.translate("Mandantennummer mora biti med 1 in 99999."), /Mandantennummer/);
assert.equal(de.translate("Nastavitve še niso potrjene"), "Einstellungen noch nicht bestätigt");
assert.match(de.translate("DATEV OAuth podatki še niso izdani"), /OAuth-Daten/);
assert.match(de.translate("Mock uporabi samo račune TEST-* in ničesar ne pošlje v pravi DATEV."), /echte DATEV-System/);
assert.equal(de.translate("Ustvari test"), "Test erstellen");
assert.equal(de.translate("Arhiviran in preverjen original"), "Archiviertes und geprüftes Original");
assert.equal(de.translate("Stripe kartica · TEST"), "Stripe-Karte · TEST");
assert.equal(de.translate("Točen odprti znesek 1,19 € se preveri na strežniku."), "Der genaue offene Betrag 1,19 € wird serverseitig geprüft.");
assert.equal(de.translate("10 / 12 preverjenih"), "10 / 12 geprüft");
assert.equal(de.translate("Ustvarjen bo popoln negativni Storno v znesku 1,19 €. Original ostane v arhivu."), "Es wird ein vollständiger negativer Storno über 1,19 € erstellt. Das Original bleibt im Archiv.");
assert.equal(de.translate("TEST-ST-2026-0001 · podatki računa bodo preneseni v nov osnutek"), "TEST-ST-2026-0001 · die Rechnungsdaten werden in einen neuen Entwurf übernommen");
assert.equal(de.translate("Uspešno: 2026-08 · 8 dokumentov · 8 knjižb"), "Erfolgreich: 2026-08 · 8 Dokumente · 8 Buchungen");
assert.equal(de.translate("Popravek TEST-ST-2026-0001 nima arhiviranega PDF-ja."), "Für die Korrektur TEST-ST-2026-0001 fehlt das archivierte PDF.");
assert.equal(de.translate("KoSIT potrjen arhivirani original"), "KoSIT-validiertes archiviertes Original");
assert.equal(de.translate("KoSIT validacija uspešna."), "KoSIT-Validierung erfolgreich.");
assert.equal(de.translate("UBL XML se varno pripravlja …"), "UBL-XML wird sicher erstellt …");
assert.equal(de.translate("Časovnica dostave"), "Versandverlauf");
assert.equal(de.translate("XRechnung + PDF · E-pošta"), "XRechnung + PDF · E-Mail");
assert.equal(de.translate("Poslano"), "Versendet");
assert.equal(de.translate("Test poslano"), "Test versendet");
assert.equal(de.translate("V vrsti"), "In Warteschlange");
assert.equal(de.translate("Preverjanje"), "Prüfung");
assert.equal(de.translate("XRechnung + berljivi PDF"), "XRechnung + lesbares PDF");
assert.equal(de.translate("Arhivirani XML je prestal uradno konfiguracijo XRechnung."), "Die archivierte XML-Datei hat die offizielle XRechnung-Konfiguration erfolgreich durchlaufen.");
assert.equal(de.translate("Arhivirani popravek XML je prestal uradno konfiguracijo XRechnung."), "Die archivierte Korrektur-XML-Datei hat die offizielle XRechnung-Konfiguration erfolgreich durchlaufen.");
assert.equal(de.translate("TEST-2026-0004 · preostanek 1,19 €. Ročna potrditev mora temeljiti na dejansko vidnem plačilu."), "TEST-2026-0004 · Restbetrag 1,19 €. Die manuelle Bestätigung muss auf einer tatsächlich sichtbaren Zahlung beruhen.");
assert.equal(de.translate("OZG-RE mock sandbox"), "OZG-RE-Mock-Sandbox");
assert.equal(de.translate("XRechnung prek OZG-RE"), "XRechnung über OZG-RE");
assert.equal(de.translate("Pred izdajo popravite:"), "Vor der Ausstellung korrigieren:");
assert.equal(de.translate("Supabase strežniška konfiguracija manjka."), "Die serverseitige Supabase-Konfiguration fehlt.");
assert.match(de.translate("Za registrirano pravno obliko manjkajo sedež, registrsko sodišče ali registrska številka."), /Registergericht/);
assert.equal(de.translate("Peppol mock sandbox"), "Peppol-Mock-Sandbox");
assert.match(de.translate("Leitweg-ID, kanal in arhivirani XML se preverijo znotraj sistema. Povezava z OZG-RE se ne vzpostavi in nič se ne prenese."), /keine Verbindung zu OZG-RE/);
assert.match(de.translate("Leitweg-ID ostane v arhiviranem XML. Peppol prejemnik in zunanja dostopna točka se samo simulirata; nič se ne prenese."), /Peppol-Empfänger/);
assert.equal(de.translate("Zaženi mock sandbox"), "Mock-Sandbox starten");

[
  "Izberite bančni izpisek.",
  "E-poštni naslov prejemnika ni veljaven.",
  "Za javnega naročnika je potrebna Leitweg-ID.",
  "Izberite, kako bo sklenjena potrošniška pogodba.",
  "Pred pravno izdajo potrdite končni pregled.",
  "Stripe TEST plačilo je potrjeno s podpisanim webhookom.",
  "Zabeleži potrošnikov odstop?",
  "Dokaz izvedenega vračila",
  "Izročitev pogodbenega potrdila je nespremenljivo zapisana.",
  "Plačilo ni uspelo",
  "Pošiljanje je dovoljeno šele po uspešni KoSIT validaciji.",
  "Stanje e-poštnega ponudnika ni dosegljivo.",
  "Strukturirani račun še ni prestal KoSIT validacije.",
  "Storno razveljavi celotni račun; pozneje plačila ni več mogoče knjižiti.",
  "Za nadomestni račun je potreben veljaven Storno.",
  "Pravno izdati račun?",
  "Označiti kot plačano?",
  "DATEV nastavitve shranjujem …",
  "Povrniti Stripe TEST plačilo?",
  "Produkcijski način je pripravljen."
].forEach((text) => {
  assert.notEqual(de.translate(text), text, `missing German POS translation: ${text}`);
  assert.doesNotMatch(de.translate(text), /[čšžČŠŽ]/, `Slovenian characters remain in German POS translation: ${text}`);
});

const highConfidenceSlovenianUi = /\b(?:izberite|kako|pri|velja|samo|brez|lahko|mora|morajo|podatki|račun|ponudba|plačilo|stranka|nastavitve|shrani|prekliči|zapri|potrdi|uvozi|znesek|datum|storitev|davek|pregled|postavka|podjetje|nazaj|naprej|poslano)\b/i;
const ignoredInternalLiterals = new Set([
  "bančni-izpisek",
  "ZNESEK",
  "DATUM",
  "KOST-Datum",
  "Datum Zuord. Steuerperiode",
  "Dieses Angebot ist bis zum genannten Datum gültig. Leistungsumfang und Preise werden erst mit Annahme verbindlich."
]);
const literalTexts = [];
const visit = (node) => {
  if (!node || typeof node !== "object") return;
  if (node.type === "Literal" && typeof node.value === "string") literalTexts.push(node.value);
  Object.keys(node).forEach((key) => {
    if (key === "parent") return;
    const value = node[key];
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") visit(value);
  });
};
visit(parseScript(posSource, { next: true, webcompat: true }));

const missingGermanLiterals = [];
for (const text of new Set(literalTexts)) {
  if (
    ignoredInternalLiterals.has(text) ||
    text.length < 4 ||
    text.length > 220 ||
    /[<>=\\]/.test(text) ||
    /^\s|\s$/.test(text) ||
    !/[čšžČŠŽ]/.test(text) &&
    !highConfidenceSlovenianUi.test(text)
  ) continue;
  if (de.translate(text) === text) missingGermanLiterals.push(text);
}
assert.deepEqual(missingGermanLiterals, [], `untranslated German POS UI literals:\n${missingGermanLiterals.join("\n")}`);

for (const match of html.matchAll(/>([^<>]+)</g)) {
  const text = match[1].replace(/\s+/g, " ").trim();
  if (!text || !highConfidenceSlovenianUi.test(text)) continue;
  assert.notEqual(de.translate(text), text, `untranslated German POS HTML text: ${text}`);
}

for (const match of html.matchAll(/\b(?:aria-label|placeholder|title)="([^"]+)"/g)) {
  const text = match[1].replace(/\s+/g, " ").trim();
  if (!text || !highConfidenceSlovenianUi.test(text)) continue;
  assert.notEqual(de.translate(text), text, `untranslated German POS HTML attribute: ${text}`);
}

const dictionaryKeys = [...source.matchAll(/^\s*"((?:\\.|[^"\\])*)":/gm)].map((match) => match[1]);
const duplicateDictionaryKeys = dictionaryKeys.filter((key, index) => dictionaryKeys.indexOf(key) !== index);
assert.deepEqual(duplicateDictionaryKeys, [], "German POS dictionary must not contain duplicate keys");

const deLocale = load("?locale=de-DE");
assert.equal(deLocale.isGerman, true);

console.log("POS German locale tests passed.");
