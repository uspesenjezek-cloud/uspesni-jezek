"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var api = require("../api/mehka-boniteta");
var test = api._test;
var identityEvidenceContract = require("../api/_lib/identity-evidence");
var citajRacunTest = require("../api/citaj-racun")._test;

var razbraneStranke = citajRacunTest.normalizirajBonitetneStranke({ stranke: [
  { vloga: "izdajatelj", pravnoIme: "Muster Elektro GmbH", ulica: "Hauptstraße 1", postnaStevilka: "60311", kraj: "Frankfurt am Main", registerNumber: "HRB 12345", vatId: "DE123456789" },
  { vloga: "prejemnik", pravnoIme: "Patrick Mattei", poslovniNaziv: "Mattei Haustechnik", ulica: "Georg-Treser-Str. 14", postnaStevilka: "60599", kraj: "Frankfurt am Main", spletnaStran: "mattei-haustechnik.de" },
  { vloga: "drugo", pravnoIme: "Patrick Mattei" },
  { vloga: "drugo", pravnoIme: null, poslovniNaziv: null },
] });
assert.strictEqual(razbraneStranke.length, 2, "OCR mora ohraniti ločeni stranki ter odstraniti podvojene in neimenovane zapise.");
assert.strictEqual(razbraneStranke[0].registerNumber, "HRB 12345");
assert.strictEqual(razbraneStranke[1].vloga, "prejemnik");
assert.match(citajRacunTest.NAVODILO_ZA_BONITETNO_PREVERBO, /Ne združuj podatkov dveh strank/);

var testniJpeg = "data:image/jpeg;base64,QUJDRA==";
var prihodnjiPosnetek = {
  status: "captured",
  imageDataUrl: testniJpeg,
  sourceUrl: "https://example.test/impressum",
  captureVersion: "identity-evidence-v999-future-capture",
  screenshotReady: true,
  viewportOverlaysRemoved: true,
};
assert.strictEqual(identityEvidenceContract.jePosnetekPrikazljiv(prihodnjiPosnetek), true,
  "prihodnja različica se mora prikazati po semantični strežniški oznaki brez spremembe UI-ja");
assert.strictEqual(identityEvidenceContract.obogatiDokazilo({
  status: "captured", imageDataUrl: testniJpeg, sourceUrl: "https://example.test/impressum",
  captureVersion: "identity-evidence-v12-labelled-provider-page-fallback", viewportOverlaysRemoved: true,
}).screenshotReady, false, "stari avtomatski rezultat v12 se po odkritju delnih sivih slojev ne sme več prikazati");
assert.strictEqual(identityEvidenceContract.obogatiDokazilo({
  status: "captured", imageDataUrl: testniJpeg, sourceUrl: "https://example.test/impressum",
  captureVersion: "identity-evidence-v14-partial-overlay-detection", viewportOverlaysRemoved: true,
  screenshotReady: true,
}).screenshotReady, false, "rezervni skoraj prazen rezultat v14 se kljub stari oznaki ready ne sme več prikazati");
assert.strictEqual(identityEvidenceContract.obogatiDokazilo({
  status: "captured", imageDataUrl: testniJpeg, sourceUrl: "https://example.test/impressum",
  captureVersion: "identity-evidence-v10-unsafe-overlay", viewportOverlaysRemoved: true,
}).screenshotReady, false, "stari potencialno prekriti posnetki morajo ostati blokirani");
assert.strictEqual(identityEvidenceContract.jePosnetekPrikazljiv(Object.assign({}, prihodnjiPosnetek, { screenshotReady: false })), false,
  "izrecna varnostna zavrnitev mora preglasiti tudi prihodnjo številko zajema");
assert.strictEqual(identityEvidenceContract.jePosnetekPrikazljiv({
  status: "captured", imageDataUrl: testniJpeg, sourceUrl: "https://example.test/uradni-rezultat",
  evidenceMode: "user_uploaded_official_screenshot",
}), true, "uporabniško naloženo uradno dokazilo mora ostati prikazljivo");
assert.strictEqual(identityEvidenceContract.CAPTURE_VERSION, "identity-evidence-v15-visible-legal-content");
assert.strictEqual(identityEvidenceContract.CACHE_VERSION, "impressum-parser-v34-registered-merchant-impressum-evidence");

var searchFixture = [
  '<article><a href="/betriebe/andreas-deumlich-45,0,bdbdetail.html?id=3294">Andreas Deumlich</a><p>60385 Frankfurt am Main</p></article>',
  '<article><a href="/betriebe/andreas-muster-45,0,bdbdetail.html?id=9999">Andreas Muster</a><p>60385 Frankfurt am Main</p></article>',
].join("");

var kandidati = test.razcleniHwkRezultate(searchFixture, "https://hwk-rhein-main.odav.de/search");
assert.strictEqual(kandidati.length, 2, "HWK parser mora vrniti oba zadetka.");
assert.strictEqual(kandidati[0].postnaStevilka, "60385");
var kammerfinderFixture = [
  "<table><tr><td><img src='/img/ihk.png'></td><td><a href='/kammerinfos?knr=125'>Industrie- und Handelskammer Frankfurt am Main</a></td></tr>",
  "<tr><td><img src='/img/hwk.png'></td><td><a href='/kammerinfos?knr=245'>Handwerkskammer Frankfurt-Rhein-Main</a></td></tr></table>",
].join("");
assert.deepStrictEqual(test.razcleniKammerfinderRezultat(kammerfinderFixture), {
  name: "Handwerkskammer Frankfurt-Rhein-Main",
  infoUrl: "https://www.kammerfinder.de/kammerinfos?knr=245",
});
assert.strictEqual(test.razcleniKammerfinderInfo(
  "<p><b>Internet: </b><a href='https://www.hwk-rhein-main.de/'>https://www.hwk-rhein-main.de</a></p>",
  "https://www.kammerfinder.de/kammerinfos?knr=245"
), "https://www.hwk-rhein-main.de/");
assert.deepStrictEqual(test.razcleniCentralnoHwk([
  "<main><h1>Handwerkskammer Region Stuttgart</h1>",
  "<a href='https://www.hwk-stuttgart.de'>https://www.hwk-stuttgart.de</a>",
  "<a href='https://www.hwk-stuttgart.de/handwerkersuche'>Handwerkersuche</a></main>",
].join(""), "https://www.handwerkskammer.de/kontakte/zustaendige-handwerkskammer-5620,0,dazustaendig.html?plzonr=70191"), {
  name: "Handwerkskammer Region Stuttgart",
  homepage: "https://www.hwk-stuttgart.de/",
  searchUrl: "https://www.hwk-stuttgart.de/handwerkersuche",
  sourceUrl: "https://www.handwerkskammer.de/kontakte/zustaendige-handwerkskammer-5620,0,dazustaendig.html?plzonr=70191",
});
assert.strictEqual(test.najdiBdbSearchUrl(
  "<a href='/artikel/handwerker-finden.html'>Handwerker finden</a><a href='/2,0,bdbsearch.html'>Suche</a>",
  "https://hwk-dresden.odav.de/"
), "https://hwk-dresden.odav.de/2,0,bdbsearch.html");
assert.strictEqual(
  test.izberiHwkZadetek(kandidati, { ime: "Andreas Deumlich", postnaStevilka: "60385", kraj: "Frankfurt am Main" }).kandidat.ime,
  "Andreas Deumlich",
  "Izbran mora biti točen obrtnik."
);

var detailFixture = [
  "<h1>Andreas Deumlich</h1>",
  "<h5>Betrieb</h5><p>Andreas Deumlich<br>Wittelsbacherallee 181<br>D-60385 Frankfurt am Main<br>Frankfurt am Main, Stadt</p>",
  '<h5>Kontakt</h5><p>Herr Deumlich<br>Telefon 069 568 074 16<br><a href="a.deumlich--at--example.de">E-pošta</a></p>',
  "<h5>Eingetragene Berufe</h5><p>Elektrotechniker</p>",
].join("");
var subjekt = test.razcleniHwkPodrobnosti(detailFixture, "https://example.test/detail");
assert.strictEqual(subjekt.ime, "Andreas Deumlich");
assert.strictEqual(subjekt.postnaStevilka, "60385");
assert.strictEqual(subjekt.kraj, "Frankfurt am Main");
assert.deepStrictEqual(subjekt.poklici, ["Elektrotechniker"]);
assert.strictEqual(subjekt.telefon, "069 568 074 16");
assert.strictEqual(subjekt.email, "a.deumlich@example.de");

assert.deepStrictEqual(test.razdeliImeZaInsolvenco("Andreas Deumlich"), {
  firmaPriimek: "Deumlich", ime: "Andreas", vrsta: "person",
});
assert.deepStrictEqual(test.razdeliImeZaInsolvenco("Elektro Beispiel GmbH"), {
  firmaPriimek: "Elektro Beispiel GmbH", ime: "", vrsta: "company",
});
assert.deepStrictEqual(test.sestaviUradneImenskePogoje({ ime: "Patrick Mattei", entityType: "person" }), {
  firmaPriimek: "Mattei", ime: "Patrick", vrsta: "person",
});
assert.deepStrictEqual(test.sestaviUradneImenskePogoje({ ime: "Elektro Beispiel GmbH", entityType: "company" }), {
  firmaPriimek: "Elektro Beispiel GmbH", ime: "", vrsta: "company",
});
assert.strictEqual(test.seImeDolznikaUjema("Patrick Mattei", "Mattei, Patrick", "person"), true);
assert.strictEqual(test.seImeDolznikaUjema("Patrick Mattei", "Patrick Kovacevic", "person"), false);
assert.strictEqual(test.seImeDolznikaUjema("Patrick Mattei", "Simon Patrick Krämer", "person"), false);
assert.deepStrictEqual(test.presodiOpenRegisterInsolvencniZadetek({
  debtor_name: "Patrick Mattei", debtor_city: "Frankfurt am Main", debtor_postal_code: "60599",
}, {
  ime: "Patrick Mattei", kraj: "Frankfurt am Main", postnaStevilka: "60599", entityType: "person",
}), {
  matched: true,
  reason: "identity_and_location_match",
  debtorName: "Patrick Mattei",
  debtorCity: "Frankfurt am Main",
  debtorPostalCode: "60599",
  companyId: "",
});
assert.strictEqual(test.presodiOpenRegisterInsolvencniZadetek({
  debtor_name: "Patrick Berrang", debtor_city: "Frankfurt am Main",
}, {
  ime: "Patrick Mattei", kraj: "Frankfurt am Main", postnaStevilka: "60599", entityType: "person",
}).reason, "debtor_name_mismatch");
assert.strictEqual(test.presodiOpenRegisterInsolvencniZadetek({
  debtor_name: "Patrick Mattei", debtor_city: "Offenbach am Main",
}, {
  ime: "Patrick Mattei", kraj: "Frankfurt am Main", postnaStevilka: "60599", entityType: "person",
}).reason, "debtor_city_mismatch");
var insolvencnoIskanjeOsebe = test.sestaviOpenRegisterInsolvencnoIskanje({
  ime: "Köksal Duman", kraj: "Frankfurt am Main", entityType: "person",
});
assert.deepStrictEqual(insolvencnoIskanjeOsebe.query, { value: "Köksal Duman" });
assert.deepStrictEqual(insolvencnoIskanjeOsebe.filters, [
  { field: "city", value: "Frankfurt am Main" },
  { field: "debtor_kind", value: "natural_person" },
]);
assert.deepStrictEqual(insolvencnoIskanjeOsebe.pagination, { page: 1, per_page: 5 });
var insolvencnoIskanjeDruzbe = test.sestaviOpenRegisterInsolvencnoIskanje({
  ime: "MedienOrbis GmbH", kraj: "Frankfurt am Main", entityType: "company", companyId: "DE-HRB-M1201-137035",
});
assert.deepStrictEqual(insolvencnoIskanjeDruzbe.filters[0], { field: "company_id", value: "DE-HRB-M1201-137035" });
assert.deepStrictEqual(insolvencnoIskanjeDruzbe.filters[2], { field: "debtor_kind", value: "legal_person" });
var ocrVnos = test.pripraviVnosZaPreverbo({
  ime: "Muster Elektro GmbH", naslov: "Hauptstraße 1", postnaStevilka: "60311", kraj: "Frankfurt am Main",
  registerNumber: "HRB 12345", vatId: "DE123456789",
});
assert.strictEqual(ocrVnos.registerNumber, "HRB 12345");
assert.strictEqual(ocrVnos.vatId, "DE123456789");
assert.strictEqual(test.pripraviOpenRegisterVnosZaPotrditev({}, ocrVnos).ime, "HRB 12345");
assert.strictEqual(test.razlogOpenRegisterInsolvencneNapake(402), "insufficient_credits");
assert.strictEqual(test.razlogOpenRegisterInsolvencneNapake(429), "rate_limited");
assert.deepStrictEqual(test.razcleniOpravilnoStevilko("70g IN 269/25"), {
  oddelek: "70g", oznaka: "IN", stevilka: "269", leto: "25", celotna: "70g IN 269/25",
});
assert.strictEqual(test.razcleniOpravilnoStevilko("napačna oznaka"), null);
var kwasnitzaSubjekt = {
  ime: "Kwasnitza Heizung & Sanitär GmbH", kraj: "Leverkusen",
  registerNumber: "HRB 116572", registerCourt: "Köln",
};
assert.deepStrictEqual(test.razcleniRegistrskiVnosZaInsolvenco(kwasnitzaSubjekt), {
  court: "Köln", type: "HRB", number: "116572",
});
assert.strictEqual(test.pocistiRegistrskoSodisce("Amtsgericht Leipzig HRB 41163"), "Leipzig");
assert.strictEqual(test.pocistiRegistrskoSodisce("Registergericht: Hamburg, HRB 177670"), "Hamburg");
assert.strictEqual(test.imaPopolnRegistrskiVnos({ court: "Köln", type: "HRB", number: "116572" }), true);
assert.strictEqual(test.imaPopolnRegistrskiVnos({ court: "", type: "HRB", number: "177670" }), false);
var uradniKwasnitzaRezultat = [
  "Suchergebnis - Veröffentlichungsliste",
  "Kwasnitza Heizung & Sanitär GmbH Leverkusen",
  "70g IN 269/25 Köln HRB 116572",
].join("\n");
assert.strictEqual(test.presodiUradniInsolvencniRezultat(
  uradniKwasnitzaRezultat, kwasnitzaSubjekt, test.razcleniOpravilnoStevilko("70g IN 269/25")
).status, "confirmed_match");
assert.strictEqual(test.presodiUradniInsolvencniRezultat(
  "Suchergebnis - Veröffentlichungsliste\nMattei, Patrick\nFrankfurt am Main\n810 IN 999/26",
  { ime: "Patrick Mattei", kraj: "Frankfurt am Main", entityType: "person" },
  test.razcleniOpravilnoStevilko("810 IN 999/26")
).status, "confirmed_match");
assert.strictEqual(test.presodiUradniInsolvencniRezultat(
  "Suchergebnis\nIhre Suche ergab zu viele Treffer. Die maximale Trefferzahl beträgt 1000.", kwasnitzaSubjekt, null
).reason, "too_many_results");
assert.strictEqual(test.presodiUradniInsolvencniRezultat(
  "Fehler in Feld 'Registereintrag': Der Registereintrag muss eindeutig belegt sein!", kwasnitzaSubjekt, null
).reason, "invalid_register_filter");
var samoUradniRezultat = test.sestaviRezultatSamoUradnegaPortala({
  ime: "A+I Elektrotechnik GmbH", kraj: "Hamburg", postnaStevilka: "22113",
}, {
  status: "confirmed_match", checkedAt: "2026-08-16T00:00:00.000Z", evidenceStatus: "captured",
  evidenceImage: "data:image/jpeg;base64,AAAA", publications: [{ caseNumber: "67a IN 280/26" }],
});
assert.strictEqual(samoUradniRezultat.status, "possible_match");
assert.strictEqual(samoUradniRezultat.verificationMode, "official_portal_only");
assert.strictEqual(samoUradniRezultat.openregisterUsed, false);
assert.strictEqual(samoUradniRezultat.officialVerification.evidenceStatus, "captured");
assert.deepStrictEqual(test.sestaviPojmeDokazilaIdentitete({
  naziv: "A+I Elektrotechnik GmbH",
  ime: "Waled Adam",
  nosilec: "Waled Adam",
  naslov: "Moorfleeter Straße 15",
  postnaStevilka: "22113",
  kraj: "Hamburg",
  registerNumber: "HRB 177670",
  registerCourt: "",
}), [
  "A+I Elektrotechnik GmbH",
  "Waled Adam",
  "Moorfleeter Straße 15",
  "22113",
  "Hamburg",
  "HRB 177670",
]);
assert.deepStrictEqual(test.sestaviObveznePojmeDokazilaIdentitete({
  naziv: "Mattei Haustechnik",
  ime: "Patrick Mattei",
  nosilec: "Patrick Mattei",
  naslov: "Georg-Treser-Str. 14",
  postnaStevilka: "60599",
  kraj: "Frankfurt am Main",
}), [
  "Patrick Mattei",
  "Georg-Treser-Str. 14",
  "60599",
  "Frankfurt am Main",
]);
assert.deepStrictEqual(test.sestaviObveznePojmeDokazilaIdentitete({
  naziv: "A+I Elektrotechnik GmbH",
  ime: "A+I Elektrotechnik GmbH",
  naslov: "Moorfleeter Straße 15",
  postnaStevilka: "22113",
  kraj: "Hamburg",
}), [
  "A+I Elektrotechnik GmbH",
  "Moorfleeter Straße 15",
  "22113",
  "Hamburg",
]);
assert.strictEqual(test.jeFrankfurt("60385", ""), true);
assert.strictEqual(test.jeFrankfurt("63067", "Offenbach am Main"), true);
assert.strictEqual(test.jeFrankfurt("10115", "Berlin"), false);
assert.strictEqual(test.jeZasebenIp("127.0.0.1"), true);
assert.strictEqual(test.jeZasebenIp("192.168.1.20"), true);
assert.strictEqual(test.jeZasebenIp("8.8.8.8"), false);
var impressum = test.razcleniImpressum(
  "<h1>Impressum</h1><h2>Vertreten durch</h2><p>Mihail Poclit</p>",
  "https://ma-services24.de/impressum.html",
  { ime: "M.A.Services24", postnaStevilka: "63067", kraj: "Offenbach am Main" }
);
assert.strictEqual(impressum.ime, "Mihail Poclit");
var dumanImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><p><strong>K&ouml;ksal Duman</strong><br>Halmstraße 2<br>60437 Frankfurt am Main</p><p><strong>Telefon</strong>: 069 907 501 55</p>",
  "https://heizungsmeisterei-duman.de/impressum",
  { ime: "Heizungsmeisterei Duman", postnaStevilka: "60437", kraj: "Frankfurt am Main" }
);
assert.strictEqual(dumanImpressum.ime, "Köksal Duman");
assert.strictEqual(dumanImpressum.naslov, "Halmstraße 2");
var zacetnicaInPoklicImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Impressum www.beispiel.de<br>Beispiel Sanitär- und Heizungstechnik<br>Inhaber T.Mantel Installateur und Heizungsbau-Meister<br><br>Egenolffstraße 3<br>60316 Frankfurt am Main<br><br>HRA 44336 Amtsgericht Frankfurt am Main</p></main>",
  "https://example.test/impressum/",
  { ime: "", naslov: "Egenolffstraße 3", postnaStevilka: "60316", kraj: "Frankfurt am Main" }
);
assert.strictEqual(zacetnicaInPoklicImpressum.ime, "T. Mantel");
assert.strictEqual(zacetnicaInPoklicImpressum.naziv, "Beispiel Sanitär- und Heizungstechnik");
assert.strictEqual(zacetnicaInPoklicImpressum.registerNumber, "HRA 44336");
assert.strictEqual(zacetnicaInPoklicImpressum.registerCourt, "Frankfurt am Main");
assert.strictEqual(zacetnicaInPoklicImpressum.naslov, "Egenolffstraße 3");
var aiElektrotechnikImpressum = test.razcleniImpressum(
  '<header><p>A + I Elektrotechnik GmbH | Moorfleeter Straße 15, 22113 Hamburg</p></header>' +
  '<main><section><h1>Impressum</h1></section><section><div><b>A+I Elektrotechnik GmbH</b><br>Moorfleeter Straße 15<br>22113 Hamburg<br>Deutschland<br><br><b>Geschäftsführer:</b><br>Waled Adam<br><br><b>Kontakt:</b><br>Telefon: 040/ 238 196 77<br>E-Mail: info@ai-elektrotechnik.de<br><br><b>HandelsregisterNR:</b><br>HRB177670<br><br><b>Haftungsausschluss:</b><br>Dolgo nerelevantno besedilo</div></section></main>',
  "https://ai-elektrotechnik.de/impressum/",
  { ime: "A + I Elektrotechnik GmbH", naslov: "Moorfleeter Straße 15", postnaStevilka: "22113", kraj: "Hamburg" }
);
assert.strictEqual(aiElektrotechnikImpressum.ime, "Waled Adam");
assert.strictEqual(aiElektrotechnikImpressum.naziv, "A+I Elektrotechnik GmbH");
assert.strictEqual(aiElektrotechnikImpressum.naslov, "Moorfleeter Straße 15");
assert.strictEqual(aiElektrotechnikImpressum.postnaStevilka, "22113");
assert.strictEqual(aiElektrotechnikImpressum.kraj, "Hamburg");
assert.strictEqual(aiElektrotechnikImpressum.registerNumber, "HRB 177670");
var azHeizungsprofisImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>A-Z Heizungsprofis GmbH<br>GF David Jazvac<br>Seulberger Straße 4<br>D-61352 Bad Homburg<br>HRB-Nr.: 105826, Amtsgericht Frankfurt am Main<br>Umsatzsteuernummer 4522870368</p></main>",
  "https://a-z-heizungsprofis.de/?page_id=50",
  { ime: "A-Z Heizungsprofis GmbH", naslov: "", postnaStevilka: "", kraj: "" }
);
assert.strictEqual(azHeizungsprofisImpressum.ime, "David Jazvac");
assert.strictEqual(azHeizungsprofisImpressum.naziv, "A-Z Heizungsprofis GmbH");
assert.deepStrictEqual(azHeizungsprofisImpressum.zastopniki, ["David Jazvac"]);
assert.strictEqual(azHeizungsprofisImpressum.registerNumber, "HRB 105826");
var azHeizungsprofisVidniTekst = test.razcleniVidniImpressumTekst(
  "Impressum\nA-Z Heizungsprofis GmbH\nGF David Jazvac\nSeulberger Straße 4\nD-61352 Bad Homburg\nHRB-Nr.: 105826",
  "https://a-z-heizungsprofis.de/?page_id=50",
  { ime: "A-Z Heizungsprofis GmbH", kraj: "" }
);
assert.strictEqual(azHeizungsprofisVidniTekst.ime, "David Jazvac", "Tudi rezervni parser vidnega besedila mora poznati oznako GF.");
[
  "GF: David Jazvac",
  "GF Herr David Jazvac",
  "Geschäftsführerin: Maria Muster",
  "HRB-Nr.: 105826",
  "HRA Nr. 44336",
  "GnR-Nr.: 1234",
  "Registergericht: Frankfurt am Main",
].forEach(function (pravnaOznaka) {
  assert.strictEqual(test.jePravnaImpressumVsebina(
    "Impressum",
    "Beispiel GmbH\n" + pravnaOznaka + "\nMusterstraße 1\n60311 Frankfurt am Main"
  ), true, "Veljavna nemška pravna oznaka ne sme biti zavrnjena: " + pravnaOznaka);
});
assert.strictEqual(test.jePravnaImpressumVsebina(
  "Impressum - A-Z Heizungsprofis GmbH",
  "A-Z Heizungsprofis GmbH\nGF David Jazvac\nSeulberger Straße 4\n61352 Bad Homburg\nHRB-Nr.: 105826"
), true, "GF in HRB-Nr. sta veljavni nemški pravni oznaki za dokazni posnetek.");
assert.strictEqual(test.jePravnaImpressumVsebina(
  "Impressum",
  "Kontakt\nSeulberger Straße 4\n61352 Bad Homburg"
), false, "Sam naslov brez pravne oznake ne sme potrditi strani kot pravni Impressum.");
assert.strictEqual(test.jePravnaImpressumVsebina(
  "Impressum - Langer Parkettverlegung",
  "Valeri Langer\nBoden- und Parkettverlegung\nAnton-Günther-Weg 44\n84478 Waldkraiburg\nKontakt\nTelefon: 0170 / 35 93 427",
  ["Valeri Langer", "Anton-Günther-Weg 44", "84478", "Waldkraiburg"]
), true, "Impressum samostojnega obrtnika brez fraze Angaben gemäß mora biti veljaven, ko se ujemajo vsi podatki identitete.");
assert.strictEqual(test.jePravnaImpressumVsebina(
  "Impressum",
  "Valeri Langer\nKontakt\nJoseph-Haydn-Straße 31\n84478 Waldkraiburg",
  ["Valeri Langer", "Anton-Günther-Weg 44", "84478", "Waldkraiburg"]
), false, "Kontaktna noga z drugim naslovom ne sme biti sprejeta kot dokazni blok identitete.");
var haerningImpressum = test.razcleniImpressum(
  '<main><h2>Impressum</h2><p><strong>Angaben gemäß § 5 DDG:</strong></p><p>Richard Härning GmbH<br>Stegstraße 65<br>60594 Frankfurt am Main</p><p><strong>Vertreten durch:<br></strong>Dipl. Ing. Philipp Härning, Stegstraße 65, 60594 Frankfurt am Main</p><p><strong>Kontakt:<br></strong>Telefon: 069 - 96 1225-0<br>E-Mail: info@haerning.de</p><p><strong>Umsatzsteuer:</strong><br>DE114205618</p></main>',
  "https://www.haerning.de/impressum",
  { ime: "Richard Härning GmbH", naslov: "Stegstraße 65", postnaStevilka: "60594", kraj: "Frankfurt am Main" }
);
assert.strictEqual(haerningImpressum.ime, "Philipp Härning");
assert.strictEqual(haerningImpressum.nosilec, "Philipp Härning");
assert.strictEqual(haerningImpressum.naziv, "Richard Härning GmbH");
assert.strictEqual(haerningImpressum.naslov, "Stegstraße 65");
assert.strictEqual(haerningImpressum.postnaStevilka, "60594");
assert.strictEqual(haerningImpressum.kraj, "Frankfurt am Main");
var pravnaDruzbaBrezZastopnika = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Beispiel Elektro GmbH<br>Musterstraße 8<br>10115 Berlin</p><p>Registergericht: Berlin<br>HRB 12345</p></main>",
  "https://beispiel.test/impressum",
  { ime: "Beispiel Elektro GmbH", naslov: "", postnaStevilka: "", kraj: "" }
);
assert.strictEqual(pravnaDruzbaBrezZastopnika.ime, "Beispiel Elektro GmbH");
assert.strictEqual(pravnaDruzbaBrezZastopnika.nosilec, "");
assert.strictEqual(pravnaDruzbaBrezZastopnika.legalEntityWithoutRepresentative, true);
assert.strictEqual(pravnaDruzbaBrezZastopnika.naslov, "Musterstraße 8");
assert.strictEqual(test.sestaviIdentiteto(
  { status: "disabled" }, { status: "disabled" },
  { status: "found", subjekt: pravnaDruzbaBrezZastopnika },
  { ime: "Beispiel Elektro GmbH" }
).entityType, "company");
assert.strictEqual(test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Beispiel Haustechnik<br>Musterstraße 8<br>10115 Berlin</p></main>",
  "https://beispiel.test/impressum",
  { ime: "Beispiel Haustechnik", naslov: "", postnaStevilka: "", kraj: "" }
), null, "Obrtnik brez zanesljivega osebnega imena ne sme biti samodejno potrjen.");
assert.strictEqual(test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Musterstraße 8<br>10115 Berlin</p><p>Webdesign: Fremde Agentur GmbH</p></main>",
  "https://beispiel.test/impressum",
  { ime: "Beispiel Haustechnik", naslov: "", postnaStevilka: "", kraj: "" }
), null, "Spletna agencija za naslovom ne sme postati preverjana družba.");
assert.strictEqual(test.jeVerjetnoImeOsebe("Dr.-Ing. Maria Beispiel"), true);
assert.strictEqual(test.jeVerjetnoImeOsebe("Dipl.-Kfm. Peter Muster"), true);
[
  ["Dipl.-Ing. Elmar Lancé", "Elmar Lancé"],
  ["Dipl. Ing. Elmar Lancé", "Elmar Lancé"],
  ["Prof. Dr.-Ing. Maria Beispiel", "Maria Beispiel"],
  ["Univ.-Prof. Dr. rer. nat. Anna Muster", "Anna Muster"],
  ["Priv.-Doz. Dr. med. dent. Jana Beispiel", "Jana Beispiel"],
  ["Dipl.-Kfm. Peter Muster", "Peter Muster"],
  ["Dipl.-Wirtsch.-Ing. Max Mustermann", "Max Mustermann"],
  ["M.Sc. Julia Beispiel", "Julia Beispiel"],
  ["LL.M. Thomas Muster", "Thomas Muster"],
  ["Mag. Eva Beispiel", "Eva Beispiel"],
  ["Rechtsanwalt Dr. Hans Muster", "Hans Muster"],
  ["Elmar Lancé, Dipl.-Ing.", "Elmar Lancé"],
].forEach(function (primer) {
  assert.strictEqual(test.pocistiImeOsebe(primer[0]), primer[1], "Naziv ni del osebnega imena: " + primer[0]);
  assert.strictEqual(test.jeVerjetnoImeOsebe(primer[0]), true, "Ime z znanim nazivom mora ostati prepoznavno: " + primer[0]);
});
var aquaCcImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>AQUA-CC GmbH<br>An den Finkenweiden 57<br>52074 Aachen</p><p>Geschäftsführung:<br>Dipl.-Ing. Elmar Lancé</p><p>HRB 22216<br>UST-ID: DE319672461</p></main>",
  "https://www.watersolutions.shop/impressum",
  { ime: "AQUA-CC GmbH", naslov: "An den Finkenweiden 57", postnaStevilka: "52074", kraj: "Aachen" }
);
assert.strictEqual(aquaCcImpressum.ime, "Elmar Lancé");
assert.strictEqual(aquaCcImpressum.nosilec, "Elmar Lancé");
assert.strictEqual(aquaCcImpressum.vloge[0].ime, "Elmar Lancé");
assert.strictEqual(aquaCcImpressum.naziv, "AQUA-CC GmbH");
var obnovljenaAquaIdentiteta = test.sestaviIdentiteto({ status: "not_found" }, { status: "disabled" }, {
  status: "found", subjekt: {
    status: "probable_impressum", ime: "Dipl.-Ing. Elmar Lancé", nosilec: "Dipl.-Ing. Elmar Lancé",
    naziv: "AQUA-CC GmbH", entityType: "company", zastopniki: ["Dipl.-Ing. Elmar Lancé"],
    vloge: [{ ime: "Dipl.-Ing. Elmar Lancé", vloga: "Geschäftsführung" }],
  },
}, { ime: "AQUA-CC GmbH" });
assert.strictEqual(obnovljenaAquaIdentiteta.ime, "Elmar Lancé");
assert.strictEqual(obnovljenaAquaIdentiteta.nosilec, "Elmar Lancé");
assert.deepStrictEqual(obnovljenaAquaIdentiteta.zastopniki, ["Elmar Lancé"]);
assert.strictEqual(obnovljenaAquaIdentiteta.vloge[0].ime, "Elmar Lancé");
assert.deepStrictEqual(test.razdeliImeZaInsolvenco("Prof. Dr.-Ing. Elmar Lancé"), {
  firmaPriimek: "Lancé", ime: "Elmar", vrsta: "person",
});
assert.strictEqual(test.razdeliImeZaInsolvenco("Nord Handwerk eG").vrsta, "company");
assert.strictEqual(test.razdeliImeZaInsolvenco("Planung Partner PartG").vrsta, "company");
assert.strictEqual(test.pocistiNazivDruzbe("Anbieterkennzeichnung: Beispiel Elektro GmbH"), "Beispiel Elektro GmbH");
assert.strictEqual(test.pocistiNazivDruzbe("der Sellwerk GmbH & Co.KG mit Sitz in Nürnberg"), "Sellwerk GmbH & Co. KG");
assert.deepStrictEqual(test.sestaviObveznePojmeDokazilaIdentitete({
  naziv: "der Sellwerk GmbH & Co.KG mit Sitz in Nürnberg", ime: "Michael Oschmann", nosilec: "Michael Oschmann",
  entityType: "company", naslov: "Pretzfelder Straße 7 – 11", postnaStevilka: "90425", kraj: "Nürnberg",
}), ["Sellwerk GmbH & Co. KG", "Pretzfelder Straße 7 – 11", "90425", "Nürnberg"]);
var dumanZAgencijo = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Köksal Duman<br>Halmstraße 2<br>60437 Frankfurt am Main</p><p>Vertretungsberechtigte Geschäftsführer: Herr Köksal Duman</p><p>Konzeption, Grafik und Text: Agentur ID GmbH</p><p>Webdesign: GO: Grafik und Konzept GmbH</p></main>",
  "https://heizungsmeisterei-duman.de/impressum",
  { ime: "Heizungsmeisterei Duman", postnaStevilka: "60437", kraj: "Frankfurt am Main" }
);
assert.strictEqual(dumanZAgencijo.ime, "Köksal Duman");
assert.strictEqual(dumanZAgencijo.naziv, "Heizungsmeisterei Duman", "Spletna agencija ne sme postati pravno ime obrtnika.");
var badInHeizungZAgencijo = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>bad&amp; heizung AG<br>Oberböhringer Straße 27<br>73312 Geislingen/Steige</p><p>Vorstand: Olivier Martinez, Thomas Wagner</p><p>Projektmanagement für Konzept, Design und Technik</p><p>breeze media gmbh<br>Ansprechpartner: Hans-Peter Kuhnert</p></main>",
  "https://www.badundheizung.de/impressum",
  { ime: "bad& heizung AG", postnaStevilka: "73312", kraj: "Geislingen/Steige" }
);
assert.strictEqual(badInHeizungZAgencijo.naziv, "bad& heizung AG");
assert.deepStrictEqual(badInHeizungZAgencijo.zastopniki, ["Olivier Martinez", "Thomas Wagner"], "Kontakt spletne agencije ne sme postati zastopnik preverjane družbe.");
assert.ok(!badInHeizungZAgencijo.zastopniki.includes("Hans-Peter Kuhnert"));
var dumanBrezVnesenegaNaziva = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Köksal Duman<br>Halmstraße 2<br>60437 Frankfurt am Main</p><p>Inhaltlich verantwortlich gemäß § 6 MDStV: Köksal Duman</p><p>Vertretungsberechtigte Geschäftsführer: Herr Köksal Duman</p></main>",
  "https://heizungsmeisterei-duman.de/impressum", { ime: "", postnaStevilka: "", kraj: "" }
);
assert.strictEqual(dumanBrezVnesenegaNaziva.naziv, "Köksal Duman", "Pravna oznaka ne sme postati poslovni naziv.");
var leichumImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Leichum Heizungstechnik GmbH<br>In der Römerstadt 52<br>60439 Frankfurt am Main</p><p>Vertretungsberechtigter Geschäftsführer: Lucio Rapisarda &amp; Steffen Gärtner</p><p>Registergericht: Amtsgericht Frankfurt Registernummer: HRB 138544</p><p>Website gestaltet und programmiert von WebPartner-RheinMain und Szekeres Internetdienstleistungen</p></main>",
  "https://www.leichum-gmbh.de/impressum.htm",
  { ime: "Leichum GmbH", postnaStevilka: "60439", kraj: "Frankfurt am Main" }
);
assert.strictEqual(leichumImpressum.naziv, "Leichum Heizungstechnik GmbH");
assert.deepStrictEqual(leichumImpressum.zastopniki, ["Lucio Rapisarda", "Steffen Gärtner"]);
assert.strictEqual(leichumImpressum.registerNumber, "HRB 138544");
var matteiImpressum = test.razcleniImpressum(
  "<main><h2>Impressum</h2><p>Patrick Mattei<br>Georg-Treser-Str. 14<br>60599 Frankfurt am Main<br>Deutschland</p></main><footer><a href='/referenzen-copy/'>Impressum</a></footer>",
  "https://www.mattei-haustechnik.de/referenzen-copy/",
  { ime: "Mattei Haustechnik", postnaStevilka: "60599", kraj: "Frankfurt am Main" }
);
assert.strictEqual(matteiImpressum.ime, "Patrick Mattei");
assert.strictEqual(matteiImpressum.postnaStevilka, "60599");
assert.strictEqual(matteiImpressum.kraj, "Frankfurt am Main");
var drescherImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Dennis Drescher<br><strong>Installateur und Heizungsbauer Dennis Drescher</strong><br>Heinrich-Seliger-Str. 24<br>60528 Frankfurt am Main<br>Deutschland</p></main>",
  "https://www.drescher-shk.de/impressum/",
  { ime: "Drescher SHK", postnaStevilka: "60528", kraj: "Frankfurt am Main" }
);
assert.strictEqual(drescherImpressum.ime, "Dennis Drescher");
var drescherVidniTekst = test.razcleniVidniImpressumTekst([
  "Impressum", "Dennis Drescher", "Installateur und Heizungsbauer Dennis Drescher",
  "Heinrich-Seliger-Str. 24", "60528 Frankfurt am Main", "Deutschland",
  "Tel.: +4915568222925", "E-Mail: info@drescher-shk.de",
].join("\n"), "https://www.drescher-shk.de/impressum/", { ime: "Drescher SHK" });
assert.strictEqual(drescherVidniTekst.ime, "Dennis Drescher");
assert.strictEqual(drescherVidniTekst.naslov, "Heinrich-Seliger-Str. 24");
assert.strictEqual(drescherVidniTekst.postnaStevilka, "60528");
assert.strictEqual(drescherVidniTekst.kraj, "Frankfurt am Main");
assert.deepStrictEqual(test.razdeliImeZaInsolvenco(drescherImpressum.ime), {
  firmaPriimek: "Drescher", ime: "Dennis", vrsta: "person",
});
var staigerImpressum = test.razcleniImpressum(
  "<main><h2>Impressum</h2><div>Sanit&auml;r Staiger GbR<br>Vordere Schafstr. 11<br>70599 Stuttgart<br>Deutschland<br>Vertretungsberechtigter Gesellschafter: Stephen Staiger<br>Umsatzsteuer-Identifikationsnummer: DE275738493</div></main>",
  "https://sanitaer-staiger.de/impressum/",
  { ime: "Sanit&auml;r Staiger GbR", postnaStevilka: "70599", kraj: "Stuttgart" }
);
assert.strictEqual(staigerImpressum.ime, "Stephen Staiger");
assert.deepStrictEqual(staigerImpressum.zastopniki, ["Stephen Staiger"]);
assert.strictEqual(staigerImpressum.naziv, "Sanit\u00e4r Staiger GbR");
assert.strictEqual(staigerImpressum.vatId, "DE275738493");
assert.strictEqual(staigerImpressum.postnaStevilka, "70599");
assert.strictEqual(staigerImpressum.kraj, "Stuttgart");
var razlicneVloge = [
  ["Gesch\u00e4ftsf\u00fchrung: Anna Beispiel", "Anna Beispiel"],
  ["Gesetzlicher Vertreter: Max Mustermann", "Max Mustermann"],
  ["Pers\u00f6nlich haftender Gesellschafter: Peter Muster", "Peter Muster"],
  ["Vorstand: Dr. Maria Beispiel", "Maria Beispiel"],
  ["Komplement\u00e4r: Hans Muster", "Hans Muster"],
  ["Betriebsinhaberin: Julia Beispiel", "Julia Beispiel"],
];
razlicneVloge.forEach(function (primer) {
  var rezultatVloge = test.razcleniImpressum(
    "<main><h1>Impressum</h1><p>" + primer[0] + "</p><p>Musterweg 1<br>10115 Berlin</p></main>",
    "https://example.test/impressum",
    { ime: "Musterbetrieb", postnaStevilka: "10115", kraj: "Berlin" }
  );
  assert.strictEqual(rezultatVloge.ime, primer[1], "Prepoznana mora biti vloga: " + primer[0]);
});
var vecZastopnikov = test.razcleniImpressum(
  "<p>Gesch\u00e4ftsf\u00fchrer: Max Mustermann und Erika Musterfrau</p><p>10115 Berlin</p>",
  "https://example.test/impressum",
  { ime: "Muster GmbH", postnaStevilka: "10115", kraj: "Berlin" }
);
assert.deepStrictEqual(vecZastopnikov.zastopniki, ["Max Mustermann", "Erika Musterfrau"]);
assert.strictEqual(test.jeVerjetnoImeOsebe("Location Location"), false);
assert.strictEqual(test.jeVerjetnoImeOsebe("Max Max Mustermann"), false);
assert.strictEqual(test.jeVerjetnoImeOsebe("Über Uns"), false);
assert.strictEqual(test.jeVerjetnoImeOsebe("Menu Start"), false);
assert.strictEqual(test.jeVerjetnoImeOsebe("Kostenfrei Registrieren"), false);
assert.strictEqual(test.jeVerjetnoImeOsebe("Zum Hauptinhalt"), false);
assert.strictEqual(test.jeVerjetnoImeOsebe("Holger Jansen Haustechnik"), false);
[
  "Innenausbau Patrik",
  "Trockenbau Markus",
  "Bodenleger Stefan",
  "Parkettverlegung Thomas",
  "Gebäudereinigung Maria",
  "Hausmeisterservice Michael",
  "Montageservice Andreas",
  "Bausanierung Daniel",
  "Elektrotechnik Alexander",
  "Raumausstattung Melanie",
].forEach(function (poslovniOpis) {
  assert.strictEqual(test.jeVerjetnoImeOsebe(poslovniOpis), false, "Opis dejavnosti ne sme postati osebno ime: " + poslovniOpis);
});
assert.strictEqual(test.pocistiImeOsebe("Eszter Patrik | Holz- und Bautenschutz"), "Eszter Patrik");
assert.strictEqual(test.jeVerjetnoImeOsebe("max mustermann"), false);
assert.strictEqual(test.jeVerjetnoImeOsebe("Max Peter Paul Mustermann"), false);
var moebeltaxiImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Möbeltaxi81<br>Max-von-Laue-Str. 19<br>30966 Hemmingen</p><p>Vertreten durch: Mohammad Sadegh Bayat Poor</p></main>",
  "https://moebeltaxi81.com/impressum/", { ime: "Möbeltaxi 81" }
);
assert.strictEqual(moebeltaxiImpressum.ime, "Mohammad Sadegh Bayat Poor", "štiridelno ime je dovoljeno samo ob izrecni pravni vlogi");
assert.strictEqual(moebeltaxiImpressum.naziv, "Möbeltaxi 81");
var federalImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><h2>Anbieter</h2><p>Federal Umzüge<br>Schillerstraße 63b<br>33609 Bielefeld</p><p>Inhaber: Semih Topatan</p></main>",
  "https://www.federal-umzuege.de/impressum.php", { ime: "Federal Umzüge" }
);
assert.strictEqual(federalImpressum.ime, "Semih Topatan");
assert.strictEqual(federalImpressum.naziv, "Federal Umzüge", "splošni naslov Anbieter ni naziv podjetja");
var entruempelExpertenImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Anbieter: Ramazan Özdemir - Entrümpel Experten<br>Zachersweg 6<br>74376 Gemmrigheim</p></main>",
  "https://entruempelung-gemmrigheim.de/impressum/", { ime: "Entrümpel-Experten" }
);
assert.strictEqual(entruempelExpertenImpressum.ime, "Ramazan Özdemir");
assert.strictEqual(entruempelExpertenImpressum.naziv, "Entrümpel Experten");
var dachdeckereiBerchimImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><p>Torben Berchim<br>Dach-, Wand- und Abdichtungstechniker<br>Dachdeckerei T. Berchim<br>Bunendorp 14<br>24321 Lütjenburg</p><p>Inhaber: Torben Berchim</p>",
  "https://example.test/about/", { ime: "Dachdeckerei T. Berchim" }
);
assert.strictEqual(dachdeckereiBerchimImpressum.naziv, "Dachdeckerei T. Berchim", "osebno ime ali poklic pred nazivom ne smeta preglasiti ujemajočega se podjetja");
var kbSchrottImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><h2>Information</h2><p>KB Schrott & Buntmetallhandel<br>Kevin Buscher<br>Auf dem Damm 3<br>41189 Mönchengladbach</p>",
  "https://example.test/impressum", { ime: "KB Schrott &Buntmetalle" }
);
assert.strictEqual(kbSchrottImpressum.naziv, "KB Schrott & Buntmetallhandel", "Information ni naziv podjetja; prednost ima naziv iz pravnega bloka");
var elektroJanbeinImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><h2>Firmenname</h2><p>Elektro Janbein<br>Taleb Janbein<br>Schwenninger Str. 20/2<br>71069 Sindelfingen</p>",
  "https://example.test/impressum", { ime: "Elektro Janbein" }
);
assert.strictEqual(elektroJanbeinImpressum.naziv, "Elektro Janbein", "Firmenname je oznaka polja, ne vrednost");
var albertWalterImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><p>Rechtliche Informationen zu unserem Unternehmen.<br>Inhaber: Albert Walter<br>Einsteinstraße 28<br>49681 Garrel</p>",
  "https://www.albert-walter.de/impressum", { ime: "Albert Walter Reinigungsdienste" }
);
assert.strictEqual(albertWalterImpressum.naziv, "Albert Walter Reinigungsdienste");
var saveEnergyImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><p>SAVE Energy GmbH<br>Fritz-Lieb-Straße 4<br>88400 Biberach Vertreten durch die Gesellschafter:</p><ol><li>Joshua Huber</li><li>Furkan Soyal</li></ol><p>HRB 751439</p>",
  "https://example.test/impressum", { ime: "SAVE Energy GmbH" }
);
assert.strictEqual(saveEnergyImpressum.kraj, "Biberach", "pravna oznaka za krajem ni del kraja");
assert.deepStrictEqual(saveEnergyImpressum.zastopniki, ["Joshua Huber", "Furkan Soyal"]);
var solarBossImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><p>Walid Alhaj Hammoud<br>Installation von Photovoltaik-Anlagen<br>Bäckergasse 2A<br>86857 Hurlach</p><footer>Solar Boss - Walid Alhaj Hammoud</footer>",
  "https://solarboss-montage.de/impressum", { ime: "Solar Boss" }
);
assert.strictEqual(solarBossImpressum.naziv, "Solar Boss", "opis storitve ne sme preglasiti vidne znamke podjetja");
var dittmannImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><p>Verantwortlich im Sinne des TDG (Teledienstgesetz §6) für die Website 'stb-dittmann.de' ist: Dr. Konstantin Dittmann<br>Steuerberater, Fachberater<br>Frohmestr. 92<br>22459 Hamburg</p>",
  "https://www.stb-dittmann.de/impressum.php", { ime: "Steuerberater Dr. Konstantin Dittmann" }
);
assert.strictEqual(dittmannImpressum.ime, "Konstantin Dittmann", "pravni ponudnik po TDG se prepozna brez akademskega naziva");
assert.strictEqual(dittmannImpressum.naziv, "Konstantin Dittmann", "brez ločenega pravnega naziva se uporabi potrjeno osebno ime, ne seznam poklicev");
var ddgProviderImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><p>Verantwortlich im Sinne des DDG für dieses Angebot ist: Prof. Dr. Anna Beispiel<br>Rechtsanwältin, Fachanwältin<br>für Arbeitsrecht<br>Musterweg 7<br>10115 Berlin</p>",
  "https://example.test/impressum", { ime: "Beratungsbüro Anna Beispiel" }
);
assert.strictEqual(ddgProviderImpressum.ime, "Anna Beispiel", "enakovredna formulacija po DDG uporablja isto splošno pravilo");
assert.strictEqual(ddgProviderImpressum.naziv, "Beratungsbüro Anna Beispiel", "poklic in nadaljevalna vrstica ne smeta preglasiti ločenega vnesenega poslovnega naziva");
var buscherFahrzeugpflegeImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><h3>Angaben gemäß § 5 TMG</h3><p>Michael Buscher – FAHRZEUGPFLEGE<br>Gewerbestraße 16 a<br>D-79618 Rheinfelden</p>",
  "https://example.test/impressum", { ime: "Michael Buscher Premium Fahrzeugpflege" }
);
assert.strictEqual(buscherFahrzeugpflegeImpressum.ime, "Michael Buscher", "dejavnost po pomišljaju ni del osebnega imena");
assert.strictEqual(buscherFahrzeugpflegeImpressum.naziv, "Michael Buscher", "generični opis Fahrzeugpflege ni samostojen poslovni naziv");
assert.strictEqual(buscherFahrzeugpflegeImpressum.naslov, "Gewerbestraße 16 a");
var meisterRadImpressum = test.razcleniImpressum(
  "<h1>Anbieter dieser Website:</h1><h2>meister-ra d.de</h2><p>Anett Meister - Bismarckstraße 41 - 67655 Kaiserslautern</p><p>USt-IdNr: DE234092524</p><h3>Vertretungsberechtigter:</h3><p>Ingo - Bismarckstraße 41 - 67655 Kaiserslautern</p><nav>Hase Bikes</nav>",
  "https://www.meister-rad.de/Impressum/", { ime: "Meister Rad" }
);
assert.strictEqual(meisterRadImpressum.ime, "Anett Meister", "partner iz navigacije ne sme postati oseba pravnega ponudnika");
assert.strictEqual(meisterRadImpressum.naziv, "Meister Rad", "z domeno podprt vneseni naziv ima prednost pred razlomljenim domenskim zapisom");
assert.strictEqual(meisterRadImpressum.naslov, "Bismarckstraße 41");
assert.strictEqual(meisterRadImpressum.kraj, "Kaiserslautern");
var inlineNaslovSorodni = test.razcleniImpressum(
  "<h1>Impressum</h1><p>Anna Beispiel – Musterweg 7 – 10115 Berlin</p>",
  "https://example.test/impressum", { ime: "Beispiel Autoservice" }
);
assert.strictEqual(inlineNaslovSorodni.ime, "Anna Beispiel");
assert.strictEqual(inlineNaslovSorodni.naslov, "Musterweg 7");
var karmaNaslovImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><p>Davood Mohammadi<br>KARMA Autoservice, Industriestraße 2-4<br>22885 Barsbüttel</p>",
  "https://example.test/impressum", { ime: "Karma Autoservice" }
);
assert.strictEqual(karmaNaslovImpressum.naslov, "Industriestraße 2-4", "naziv podjetja pred vejico ni del ulice");
var roemerBiroImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><p>René Römer – RÖMER GARAGE<br>Am Schönebach 10<br>87637 Eisenberg (Büro)</p>",
  "https://example.test/impressum", { ime: "Römer Garage" }
);
assert.strictEqual(roemerBiroImpressum.kraj, "Eisenberg", "operativna oznaka Büro ni del kraja");
var autospendeImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><h2>Autospende n. e. V.</h2><p>Thorsten Feigenbaum<br>Rahlstedter Str. 140<br>22143 Hamburg</p>",
  "https://example.test/impressum", { ime: "Autospende Hamburg" }
);
assert.strictEqual(autospendeImpressum.naziv, "Autospende n. e. V.", "e.V. in n.e.V. sta pravni obliki, ne navadno besedilo");
assert.strictEqual(autospendeImpressum.ime, "Thorsten Feigenbaum");
assert.strictEqual(test.jePravnaImpressumVsebina(
  "Impressum", "Autospende n. e. V. Thorsten Feigenbaum Rahlstedter Str. 140 22143 Hamburg",
  ["Autospende n. e. V.", "Rahlstedter Str. 140", "22143", "Hamburg"], true
), true, "pravna oblika društva potrdi dokazni Impressum tudi brez registrske številke");
assert.strictEqual(test.razcleniImpressum(
  "<h1>Impressum</h1><h2>Entwicklung/IT/Webdesign</h2><p>FirmenABC Marketing GmbH<br>Karl-Hammerschmidt-Straße 1<br>85609 Aschheim</p><footer>Zur Seewiese 17<br>97851 Rothenfels</footer>",
  "https://example.test/impressum", { ime: "MM Fahrzeugaufbereitung" }
), null, "izdelovalec strani ne sme postati preverjana pravna identiteta");
var unicodeNazivImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><p>Inhaber: Mousa Muheisen<br>\u200b<br>Die Ritterwiesen 8<br>65835 Liederbach am Taunus</p>",
  "https://example.test/impressum", { ime: "MTK Abschleppdienst & Pannenhilfe" }
);
assert.notStrictEqual(unicodeNazivImpressum.naziv, "\u200b", "nevidni Unicode znak ni poslovni naziv");
var philippsGarageImpressum = test.razcleniImpressum(
  "<h1>Impressum</h1><p>Philipp H&ouml;hre<br>Philipp&rsquo;s Garage<br>Essenweinstraße 3-7<br>90443 Nürnberg</p>",
  "https://example.test/impressum", { ime: "Philipp's Garage" }
);
assert.strictEqual(philippsGarageImpressum.naziv, "Philipp’s Garage", "imenovana HTML entiteta se mora razkodirati");
assert.strictEqual(test.jeNedosegljivaNadomestnaStran("<title>Heise Homepages</title><h1>Hier entsteht eine neue Webseite</h1><p>Multifunktionaler Arbeitsplatz</p>"), true);
assert.strictEqual(test.jeNedosegljivaNadomestnaStran("<title>Example</title><h1>We're under construction.</h1><p>Please check back for an update soon.</p><a>Squarespace</a>"), true);
assert.strictEqual(test.jeNedosegljivaNadomestnaStran("<title>404 Page Not Found</title><h1>404</h1><p>The page could not be found in this application.</p>"), true);
assert.strictEqual(test.imaPopolnoImpressumIdentiteto({ ime: "M. Özkan", naslov: "", postnaStevilka: "70469", kraj: "Stuttgart" }), false);
assert.strictEqual(test.imaPopolnoImpressumIdentiteto({ ime: "M. Özkan", naslov: "Musterstraße 1", postnaStevilka: "70469", kraj: "Stuttgart" }), true);
assert.strictEqual(test.jePravnaImpressumVsebina("Impressum", "EA Solar GmbH Kalksteinweg 10 33378 Rheda-Wiedenbrück", ["EA Solar GmbH", "Kalksteinweg 10", "33378", "Rheda-Wiedenbrück"], true), false,
  "pri GmbH samo footer brez pravnih podatkov ni dokazni Impressum");
assert.strictEqual(test.jePravnaImpressumVsebina("Impressum", "SILBER Montage UG Hohenzollernstraße 13 72419 Neufra HRB 736851", ["SILBER Montage UG", "Hohenzollernstraße 13", "72419", "Neufra"], true), true);
assert.strictEqual(test.jePravnaImpressumVsebina("Impressum", "BJN Engineering GmbH Neuer Wall 13 20354 Hamburg HRB: 167424", ["BJN Engineering GmbH", "Neuer Wall 13", "20354", "Hamburg"], true), true,
  "registrska oznaka s samostojnim dvopičjem je veljaven pravni podatek");
assert.strictEqual(test.razlogNeujemanjaIdentiteteZVnosom({
  naziv: "Legalcore AG", ime: "Legalcore AG", sourceUrl: "https://cockpit.legal/impressum/",
}, { ime: "Entrümpel-Experten", spletnaStran: "https://entruempelung-gemmrigheim.de/" }), "legal_source_context_mismatch");
assert.strictEqual(test.razlogNeujemanjaIdentiteteZVnosom({
  naziv: "JS Haustechnik", ime: "Jaweed Shinwari", sourceUrl: "https://jshaustechnik.live-website.com/impressum/",
}, { ime: "", spletnaStran: "https://jshaustechnik.de/" }), "", "legitimno gostovani zunanji Impressum ostane dovoljen ob ujemanju domene in podjetja");
assert.strictEqual(test.jeVerjetnoImeOsebe("Karl von der Linden"), true);
assert.strictEqual(test.jeImpressumDokument(
  "<main><h1>Über uns</h1><img alt='Location'><p>Location<br>70374 Stuttgart</p></main>",
  "https://jshaustechnik.de/ueber-uns/"
), false);
assert.strictEqual(test.razcleniImpressum(
  "<main><h1>Über uns</h1><p>Location Location<br>70374 Stuttgart</p></main>",
  "https://jshaustechnik.de/ueber-uns/",
  { ime: "JS Haustechnik", postnaStevilka: "70374", kraj: "Stuttgart" }
), null);
assert.strictEqual(test.jeImpressumDokument(
  "<main><h2>Impressum</h2><p>Patrick Mattei<br>60599 Frankfurt am Main</p></main><footer><a href='/referenzen-copy/'>Impressum</a></footer>",
  "https://www.mattei-haustechnik.de/referenzen-copy/"
), true);
assert.strictEqual(test.jeImpressumDokument("<p>Imprint</p>", "https://example.test/imprint"), true);
var jshImpressum = test.razcleniImpressum(
  "<title>Impressum - JS Haustechnik</title><main><p>Impressum</p><p>Gesetzliche Anbieterkennung:</p><p>Jaweed Shinwari<br>Beuthener Str. 1<br>70374 Stuttgart</p><p>Telefon: +4971125513905<br>E-Mail: kontakt@jshaustechnik.de</p></main>",
  "https://jshaustechnik.de/impressum/",
  { ime: "JS Haustechnik", postnaStevilka: "70374", kraj: "Stuttgart" }
);
assert.strictEqual(jshImpressum.ime, "Jaweed Shinwari");
assert.strictEqual(jshImpressum.email, "kontakt@jshaustechnik.de");
assert.strictEqual(jshImpressum.telefon, "+4971125513905");
var stoehrImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Angaben gemäß § 5 TMG</p><p>Gert Stöhr<br>Fabriciusstr. 32<br>65933 Frankfurt</p><p>Vertreten durch:<br>Gert Stöhr</p></main>" +
    "<footer><strong>Sanitär Stöhr</strong><br>Gert Stöhr<br>Fabriciusstr. 32<br>65933 Frankfurt</footer>",
  "https://www.sanitaer-stoehr.de/Impressum/",
  { ime: "", postnaStevilka: "65933", kraj: "Frankfurt" }
);
assert.strictEqual(stoehrImpressum.ime, "Gert Stöhr");
assert.strictEqual(stoehrImpressum.naziv, "Gert Stöhr", "poštna vrstica ne sme postati naziv podjetja");
assert.strictEqual(stoehrImpressum.naslov, "Fabriciusstr. 32");
var jansenImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Holger Jansen Haustechnik<br>Merowinger Str. 51<br>40225 D\u00fcsseldorf</p><p>Inhaltlich verantwortlich: Holger Jansen</p></main>",
  "https://jansenhaustechnik.de/impressum",
  { ime: "Holger Jansen Haustechnik", postnaStevilka: "40225", kraj: "D\u00fcsseldorf" }
);
assert.strictEqual(jansenImpressum.ime, "Holger Jansen");
assert.strictEqual(jansenImpressum.postnaStevilka, "40225");
assert.strictEqual(jansenImpressum.kraj, "D\u00fcsseldorf");
var innenausbauPatrikImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Angaben gemäß § 5 TMG</p><p>Innenausbau Patrik<br>Eszter Patrik | Holz- und Bautenschutz<br>Breitensteinstraße 20<br>83043 Bad Aibling</p>" +
    "<h2>Kontakt</h2><p>Tel +49 8061 9398337</p><h2>Angaben zur Berufshaftpflichtversicherung</h2><p>Name und Sitz des Versicherers:<br>Generali Deutschland Versicherung AG<br>90313 Nürnberg</p>" +
    "<h2>Verantwortlich für den Inhalt</h2><p>Attila Patrik<br>Breitensteinstraße 20<br>83043 Bad Aibling</p></main>",
  "https://innenausbau-patrik-muenchen.de/impressum/",
  { ime: "Innenausbau Patrik", postnaStevilka: "83043", kraj: "Bad Aibling" }
);
assert.strictEqual(innenausbauPatrikImpressum.ime, "Eszter Patrik");
assert.strictEqual(innenausbauPatrikImpressum.naziv, "Innenausbau Patrik");
assert.strictEqual(innenausbauPatrikImpressum.entityType, "person");
assert.ok(!innenausbauPatrikImpressum.businessIdentityNames.includes("Generali Deutschland Versicherung AG"));
var kerkmannImpressum = test.razcleniImpressum(
  "<title>Impressum - U.K. Udo Kerkmann e.K.</title><main><h1>Impressum</h1><p>U.K. Udo Kerkmann e.K.<br>Inhaber Stefan Krause<br>W\u00f6rthstr. 1<br>40476 D\u00fcsseldorf</p><p>Registernummer: HRA 17175<br>Registergericht: Amtsgericht D\u00fcsseldorf</p></main>",
  "https://udo-kerkmann.com/impressum/",
  { ime: "", postnaStevilka: "40476", kraj: "D\u00fcsseldorf" }
);
assert.strictEqual(kerkmannImpressum.ime, "Stefan Krause");
assert.strictEqual(kerkmannImpressum.naziv, "U.K. Udo Kerkmann e.K.");
assert.strictEqual(kerkmannImpressum.registerNumber, "HRA 17175");
assert.strictEqual(test.pocistiRegistrskoSodisce(kerkmannImpressum.registerCourt), "D\u00fcsseldorf");
var inselImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Insel Sanit\u00e4r- und Heizungstechnik e. K.<br>Eschstra\u00dfe 17<br>63069 Offenbach</p><p>Vertreten durch den Inhaber<br>Christian Wolf</p><p>Registergericht: Amtsgericht Offenbach am Main<br>HRA 42823</p></main>",
  "https://www.insel-shk.de/impressum.php",
  { ime: "", postnaStevilka: "63069", kraj: "Offenbach" }
);
assert.strictEqual(inselImpressum.naziv, "Insel Sanit\u00e4r- und Heizungstechnik e. K.");
assert.strictEqual(inselImpressum.nosilec, "Christian Wolf");
assert.deepStrictEqual(inselImpressum.vloge[0], { ime: "Christian Wolf", vloga: "Inhaber" });
var happyMaidsImpressum = test.razcleniImpressum(
  "<main><h1>Unser Impressum</h1><h2>Herausgeber dieser Website ist:</h2><p><strong>HappyMaids e.K.</strong><br>Helmut Schwind<br>Lochhamer Str. 31<br>82152 Planegg</p><p>Telefon: 089 84039565<br>E-Mail: feedback@happymaids.de<br>Handelsregister: HRA 93563</p><h2>Ihr Ansprechpartner f\u00fcr den Gro\u00dfraum M\u00fcnchen</h2><p><strong>Helmut Schwind</strong><br>Telefon: 089 84039565</p></main>",
  "https://www.happymaids.de/impressum/",
  { ime: "HappyMaids e.K.", postnaStevilka: "82152", kraj: "Planegg" }
);
assert.strictEqual(happyMaidsImpressum.naziv, "HappyMaids e.K.");
assert.strictEqual(happyMaidsImpressum.nosilec, "Helmut Schwind");
assert.deepStrictEqual(happyMaidsImpressum.vloge[0], {
  ime: "Helmut Schwind", vloga: "Inhaber", confidence: "primary_registered_merchant_block",
});
var srsNordImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Matthias Dührsen<br>Solarreinigung + Service Nord Matthias Dührsen<br>Eichkamp 20a<br>24217 Schönberg</p>" +
    "<h2>Kontakt</h2><p>Telefon: 0160 9849 4208<br>E-Mail: info@srsnord.de</p><h2>Umsatzsteuer-ID</h2><p>DE277360207</p>" +
    "<h2>Redaktionell verantwortlich</h2><p>Matthias Dührsen<br>Eichkamp 20a<br>24217 Schönberg</p></main>",
  "https://www.srsnord.de/impressum/",
  { ime: "SRS Nord", postnaStevilka: "24217", kraj: "Schönberg" }
);
assert.strictEqual(srsNordImpressum.nosilec, "Matthias Dührsen");
assert.strictEqual(srsNordImpressum.naziv, "Solarreinigung + Service Nord Matthias Dührsen");
var srsNordOpenRegister = {
  status: "found",
  company: {
    name: "Matthias Dührsen e. K. SRS Nord Solarreinigung + Service Nord",
    legal_form: "e.K.", company_id: "DE-HRA-K1101-12602", register_type: "HRA", register_number: "12602",
    register_court: "Kiel", active: true,
    address: { street: "Eichkamp 20 a", postal_code: "24217", city: "Schönberg (Holstein)" },
  },
};
var srsNordJavniProfil = { status: "found", sourceUrl: "https://www.srsnord.de/impressum/", subjekt: srsNordImpressum };
assert.strictEqual(test.potrebujeImpressumDopolnitev(srsNordOpenRegister, { spletnaStran: "https://www.srsnord.de/impressum/" }), true);
assert.deepStrictEqual(test.preveriImpressumDopolnitevRegistriranegaTrgovca(srsNordOpenRegister, srsNordJavniProfil), {
  matched: true, representative: "Matthias Dührsen",
});
var srsNordIdentiteta = test.sestaviIdentiteto(srsNordOpenRegister, { status: "disabled" }, srsNordJavniProfil, {
  postnaStevilka: "24217", kraj: "Schönberg",
});
assert.strictEqual(srsNordIdentiteta.ime, "Matthias Dührsen e. K. SRS Nord Solarreinigung + Service Nord");
assert.strictEqual(srsNordIdentiteta.nosilec, "Matthias Dührsen");
assert.strictEqual(srsNordIdentiteta.poslovniNaziv, "Solarreinigung + Service Nord Matthias Dührsen");
assert.strictEqual(srsNordIdentiteta.source, "openregister", "OpenRegister mora ostati primarni uradni vir identitete.");
var srsNordImpressumZaPosnetek = test.sestaviImpressumIdentitetoZaDopolnilniPosnetek(srsNordIdentiteta, srsNordJavniProfil);
assert.strictEqual(srsNordImpressumZaPosnetek.status, "probable_impressum");
assert.strictEqual(srsNordImpressumZaPosnetek.sourceUrl, "https://www.srsnord.de/impressum/");
assert.strictEqual(srsNordImpressumZaPosnetek.nosilec, "Matthias Dührsen",
  "Impressum, ki je dopolnil registrskega trgovca, mora dobiti svoj dokazni posnetek.");
assert.strictEqual(test.sestaviImpressumIdentitetoZaDopolnilniPosnetek(
  Object.assign({}, srsNordIdentiteta, { impressumSourceUrl: "" }), srsNordJavniProfil
), null, "Brez dejansko uporabljenega Impressuma se ne sme ustvariti navidezni dodatni dokaz.");
var srsNordPripravljenoDokazilo = test.pripraviDokaziloZaOdgovor({
  status: "captured",
  imageDataUrl: testniJpeg,
  capturedAt: "2026-08-18T00:00:00.000Z",
  captureVersion: identityEvidenceContract.CAPTURE_VERSION,
  viewportOverlaysRemoved: true,
  screenshotReady: true,
  sourceUrl: "https://www.srsnord.de/impressum/",
  sourceLabel: "Impressum podjetja – dopolnitev registrskih podatkov",
  evidenceRole: "registered_merchant_impressum_supplement",
});
assert.strictEqual(srsNordPripravljenoDokazilo.screenshotReady, true);
assert.strictEqual(srsNordPripravljenoDokazilo.evidenceRole, "registered_merchant_impressum_supplement");
var srsNordInsolvencnaIdentiteta = test.pripraviIdentitetoZaInsolvencnoPoizvedbo(Object.assign({}, srsNordIdentiteta, {
  userConfirmed: true,
}));
assert.strictEqual(srsNordInsolvencnaIdentiteta.entityType, "person", "e.K. se mora v insolvenčnem portalu iskati po fizični osebi nosilca.");
assert.strictEqual(srsNordInsolvencnaIdentiteta.ime, "Matthias Dührsen");
assert.strictEqual(srsNordInsolvencnaIdentiteta.companyId, "", "ID registrskega podjetja ne sme omejiti iskanja fizične osebe nosilca.");
assert.strictEqual(srsNordInsolvencnaIdentiteta.registeredBusinessName, srsNordIdentiteta.ime);
var navadnaDruzbaZaInsolvenco = { entityType: "company", ime: "Beispiel GmbH", legalForm: "GmbH", nosilec: "Erika Beispiel" };
assert.strictEqual(test.pripraviIdentitetoZaInsolvencnoPoizvedbo(navadnaDruzbaZaInsolvenco), navadnaDruzbaZaInsolvenco,
  "Navadne pravne družbe morajo še naprej ostati pravne osebe.");
var srsNapacenImpressum = {
  status: "found", sourceUrl: "https://directory.example/impressum", subjekt: Object.assign({}, srsNordImpressum, {
    nosilec: "Erika Beispiel", ime: "Erika Beispiel", naslov: "Druga Straße 1", postnaStevilka: "10115", kraj: "Berlin",
    vloge: [{ ime: "Erika Beispiel", vloga: "Geschäftsführung" }],
  }),
};
assert.strictEqual(test.preveriImpressumDopolnitevRegistriranegaTrgovca(srsNordOpenRegister, srsNapacenImpressum).matched, false,
  "Oseba z drugega Impressuma ali naslova se ne sme združiti z registrskim trgovcem.");
var kontaktNiNosilec = test.razcleniImpressum(
  "<main><h1>Impressum</h1><h2>Herausgeber dieser Website ist:</h2><p><strong>Beispiel Service e.K.</strong><br>Musterstra\u00dfe 7<br>10115 Berlin</p><p>Handelsregister: HRA 12345</p><h2>Ihr Ansprechpartner f\u00fcr Berlin</h2><p>Martin Kontakt<br>Telefon: 030 123456</p></main>",
  "https://example.test/impressum/",
  { ime: "Beispiel Service e.K.", postnaStevilka: "10115", kraj: "Berlin" }
);
assert.strictEqual(kontaktNiNosilec.nosilec, "", "Oseba samo iz kontaktnega bloka ne sme postati nosilec registriranega trgovca.");
assert.strictEqual(kontaktNiNosilec.legalEntityWithoutRepresentative, true);
var happyMaidsVidniTekst = test.razcleniVidniImpressumTekst([
  "Unser Impressum", "Herausgeber dieser Website ist:", "HappyMaids e.K.", "Helmut Schwind",
  "Lochhamer Str. 31", "82152 Planegg", "Handelsregister: HRA 93563",
  "Ihr Ansprechpartner f\u00fcr den Gro\u00dfraum M\u00fcnchen", "Helmut Schwind",
].join("\n"), "https://www.happymaids.de/impressum/", { ime: "HappyMaids e.K." });
assert.strictEqual(happyMaidsVidniTekst.nosilec, "Helmut Schwind");
assert.strictEqual(happyMaidsVidniTekst.registerNumber, "HRA 93563");
var napacnoOznacenaDavcnaStevilka = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>5 Designs – Ihr Raumausstatter<br>Vertreten durch: Lukas Ciui<br>Heggenkamp 9b<br>49163 Bohmte</p>" +
    "<p>Registergericht: Amtsgericht Osnabrück<br>Steuernummer: HRB 6510805026<br>Umsatzsteuer-ID: DE400516051</p></main>",
  "https://5designs.de/impressum",
  { ime: "5 Designs / Ihr Raumausstatter", postnaStevilka: "49163", kraj: "Bohmte" }
);
assert.strictEqual(napacnoOznacenaDavcnaStevilka.registerNumber, "",
  "Davčna številka, četudi vsebuje HRB, ne sme postati registrska številka.");
assert.strictEqual(test.razcleniVidniImpressumTekst([
  "Impressum", "5 Designs – Ihr Raumausstatter", "Vertreten durch: Lukas Ciui",
  "Heggenkamp 9b", "49163 Bohmte", "Steuernummer: HRB 6510805026",
].join("\n"), "https://5designs.de/impressum", { ime: "5 Designs / Ihr Raumausstatter" }).registerNumber, "");
var rodeBadImpressum = test.razcleniImpressum(
  '<html><head><script type="application/ld+json">{"@context":"http://schema.org","@type":"LocalBusiness","name":"Rode Bad","legalName":"Rode Bad","url":"www.rode-bad.de"}</script></head><body><main><article><h1>Impressum</h1><p><strong>Rode Bad<br>Bieberer Straße 180<br>63071 Offenbach</strong></p><table><tr><td>Telefon</td><td>069851224</td></tr><tr><td>Homepage</td><td>www.rode-bad.de</td></tr><tr><td>Inhaber/-in</td><td>Waldemar Rode</td></tr><tr><td>USt-IdNr.</td><td>DE188698976</td></tr></table><h2>Haftungsausschluss</h2><p>Verantwortlich für fremde Inhalte: ieQ-systems SHK GmbH &amp; Co. KG</p></article></main></body></html>',
  "https://www.rode-bad.de/recht/impressum",
  { ime: "www.rode-bad.de", postnaStevilka: "63071", kraj: "Offenbach" }
);
assert.strictEqual(rodeBadImpressum.ime, "Waldemar Rode");
assert.strictEqual(rodeBadImpressum.nosilec, "Waldemar Rode");
assert.strictEqual(rodeBadImpressum.naziv, "Rode Bad");
assert.strictEqual(rodeBadImpressum.entityType, "person");
assert.deepStrictEqual(rodeBadImpressum.vloge[0], { ime: "Waldemar Rode", vloga: "Inhaber" });
assert.deepStrictEqual(rodeBadImpressum.businessIdentityNames, ["Rode Bad"]);
assert.ok(!rodeBadImpressum.zastopniki.includes("Rode Bad"));
assert.ok(!rodeBadImpressum.zastopniki.includes("ieQ-systems SHK GmbH & Co. KG"));
var znamkaNiOseba = test.razcleniImpressum(
  '<html><head><script type="application/ld+json">{"@type":"LocalBusiness","name":"Rode Bad","legalName":"Rode Bad"}</script></head><body><main><h1>Impressum</h1><p><strong>Rode Bad<br>Bieberer Straße 180<br>63071 Offenbach</strong></p><p>Homepage: www.rode-bad.de</p></main></body></html>',
  "https://www.rode-bad.de/recht/impressum",
  { ime: "www.rode-bad.de", postnaStevilka: "63071", kraj: "Offenbach" }
);
assert.strictEqual(znamkaNiOseba, null, "Poslovna znamka, ki samo zveni kot osebno ime, ne sme postati nosilec brez pravne vloge.");
var rodeBadVidniTekst = test.razcleniVidniImpressumTekst([
  "Impressum", "Rode Bad", "Bieberer Straße 180", "63071 Offenbach",
  "Telefon", "069851224", "Homepage", "www.rode-bad.de", "Inhaber/-in", "Waldemar Rode",
].join("\n"), "https://www.rode-bad.de/recht/impressum", { ime: "www.rode-bad.de" });
assert.strictEqual(rodeBadVidniTekst.naziv, "Rode Bad");
assert.strictEqual(rodeBadVidniTekst.nosilec, "Waldemar Rode");
assert.strictEqual(rodeBadVidniTekst.vloge[0].vloga, "Inhaber");
assert.deepStrictEqual(test.sestaviUradneImenskePogoje({ ime: "Rode Bad", entityType: "unknown" }), {
  firmaPriimek: "", ime: "", vrsta: "unknown",
}, "Dvobesedna znamka brez potrjenega tipa se ne sme samodejno spremeniti v fizično osebo.");
assert.strictEqual(test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "Rode Bad", businessName: "Rode Bad", representativeName: "Rode Bad",
  street: "Bieberer Straße 180", postalCode: "63071", city: "Offenbach", confirmed: true,
} }, {
  status: "probable_impressum", ime: "Rode Bad", naziv: "Rode Bad", nosilec: "Rode Bad",
  businessIdentityNames: ["Rode Bad"], vloge: [{ ime: "Rode Bad", vloga: "Neoznačena oseba", confidence: "low" }],
}).reason, "confirmed_person_is_business_identity", "Uporabniška potrditev ne sme oživiti poslovnega naziva kot osebe.");
assert.strictEqual(test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "Waldemar Rode", businessName: "www.rode-bad.de", representativeName: "Waldemar Rode",
  street: "Bieberer Straße 180", postalCode: "63071", city: "Offenbach", confirmed: true,
} }, rodeBadImpressum).reason, "confirmed_business_name_invalid", "Domena ne sme postati poslovni naziv niti ob potrditvi.");
var kontekstDirektorice = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Beispiel Technik GmbH<br>Teststra\u00dfe 4<br>10115 Berlin</p><p>Vertreten durch die Gesch\u00e4ftsf\u00fchrerin Erika Beispiel</p></main>",
  "https://example.test/impressum",
  { ime: "", postnaStevilka: "10115", kraj: "Berlin" }
);
assert.strictEqual(kontekstDirektorice.nosilec, "Erika Beispiel");
assert.strictEqual(kontekstDirektorice.vloge[0].vloga, "Gesch\u00e4ftsf\u00fchrung");
var vlogaBrezOsebe = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Beispiel Technik GmbH<br>Teststra\u00dfe 4<br>10115 Berlin</p><p>Vertreten durch den Inhaber</p><p>Telefon: 030 123456</p></main>",
  "https://example.test/impressum",
  { ime: "", postnaStevilka: "10115", kraj: "Berlin" }
);
assert.strictEqual(vlogaBrezOsebe.nosilec, "", "oznaka vloge brez osebe ne sme postati osebno ime");
var aksImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><h2>Verantwortlich f\u00fcr den Inhalt</h2><p>Abflusskummer Servicegesellschaft M\u00fcller mbH<br>Gesch\u00e4ftsf\u00fchrer: Jascha M\u00fcller<br>Buchwiese 22<br>65510 Idstein</p><p>Handelsregister Wiesbaden HRB Nr. 31655</p><h2>Realisierung der Webseite</h2><p>Royalkomm GmbH, Wiesbaden</p></main>",
  "https://aks-abflussfrei.de/impressum/",
  { ime: "AKS Abflussfrei", postnaStevilka: "65510", kraj: "Idstein" }
);
assert.strictEqual(aksImpressum.ime, "Jascha M\u00fcller");
assert.strictEqual(aksImpressum.naziv, "Abflusskummer Servicegesellschaft M\u00fcller mbH");
assert.strictEqual(aksImpressum.registerNumber, "HRB 31655");
assert.strictEqual(aksImpressum.registerCourt, "Wiesbaden");
assert.deepStrictEqual(test.pripraviVnosZaPreverbo({
  ime: "https://udo-kerkmann.com/impressum/",
  naslov: "W\u00f6rthstr. 1",
  postnaStevilka: "40476",
  kraj: "D\u00fcsseldorf",
  spletnaStran: "https://udo-kerkmann.com/impressum/",
}), {
  ime: "",
  naslov: "W\u00f6rthstr. 1",
  postnaStevilka: "40476",
  kraj: "D\u00fcsseldorf",
  spletnaStran: "https://udo-kerkmann.com/impressum/",
  registerNumber: "",
  vatId: "",
});
assert.deepStrictEqual(test.najdiImpressumPovezave(
  '<a href="https://jshaustechnik.live-website.com/impressum/">Impressum</a>',
  "https://jshaustechnik.de/ueber-uns/"
), ["https://jshaustechnik.live-website.com/impressum/"]);
assert.deepStrictEqual(test.najdiImpressumPovezave(
  '<footer><a href="/referenzen-copy/">Impressum</a></footer>',
  "https://www.mattei-haustechnik.de/"
), ["https://www.mattei-haustechnik.de/referenzen-copy/"]);
assert.deepStrictEqual(test.najdiImpressumPovezave(
  '<footer><a href="/legal/company/">Imprint</a><a href="/anbieter/">Anbieterkennzeichnung</a></footer>',
  "https://example.test/"
), ["https://example.test/legal/company/", "https://example.test/anbieter/"]);
var sawadePravnaStranHtml = [
  '<html><body><h1>Datenschutzerklärung</h1>',
  '<h2>I. Informationen über uns als Verantwortliche</h2>',
  '<p>Verantwortlicher Anbieter dieses Internetauftritts im datenschutzrechtlichen Sinne ist:</p>',
  '<p>Sawade<br>Inh. Marcel Sawade<br>Tirschenreuther Ring 22<br>12279 Berlin<br>Telefon: 01737193968<br>Email: marcel.sawade@gmx.de</p>',
  '<h2>II. Rechte der Nutzer und Betroffenen</h2><p>Weitere Datenschutzhinweise.</p></body></html>',
].join("");
assert.deepStrictEqual(test.najdiOznacenePravnePovezave(
  '<footer><a href="/datenschutz">Datenschutzerklärung</a><a href="/kontakt">Kontakt</a></footer>',
  "https://sawade-shk.de/"
), ["https://sawade-shk.de/datenschutz"]);
assert.strictEqual(test.jeOznacenaPravnaIdentitetnaStran(sawadePravnaStranHtml, "https://sawade-shk.de/datenschutz"), true);
assert.strictEqual(test.jeOznacenaPravnaIdentitetnaStran(
  '<h1>Datenschutzerklärung</h1><p>Wir schützen Ihre Daten.</p><p>Google Ireland Limited, Gordon House, Dublin 4.</p>',
  "https://example.test/datenschutz"
), false, "splošna stran zasebnosti brez označenega ponudnika ni dokaz identitete");
var sawadePravnaIdentiteta = test.razcleniImpressum(sawadePravnaStranHtml, "https://sawade-shk.de/datenschutz", { ime: "Sawade" });
assert.strictEqual(sawadePravnaIdentiteta.nosilec, "Marcel Sawade");
assert.strictEqual(sawadePravnaIdentiteta.naziv, "Sawade");
assert.strictEqual(sawadePravnaIdentiteta.naslov, "Tirschenreuther Ring 22");
assert.strictEqual(sawadePravnaIdentiteta.postnaStevilka, "12279");
assert.strictEqual(sawadePravnaIdentiteta.kraj, "Berlin");
var karbenPravniKontekst = test.dolociPravniKontekst("https://www.badundheizung.de/karben/impressum/");
assert.strictEqual(karbenPravniKontekst.neposredniPravniUrl, true);
assert.strictEqual(karbenPravniKontekst.najemniskaPot, "/karben/");
assert.strictEqual(test.jeUrlVPravnemKontekstu("https://badundheizung.de/karben/impressum", karbenPravniKontekst), true);
assert.strictEqual(test.jeUrlVPravnemKontekstu("https://www.badundheizung.de/impressum", karbenPravniKontekst), false,
  "neposredni Impressum poslovalnice nikoli ne sme zdrsniti na osrednji Impressum drugega subjekta");
assert.deepStrictEqual(test.sestaviZacetneImpressumPoti(new URL("https://www.badundheizung.de/karben/impressum/"), karbenPravniKontekst).map(String), [
  "https://www.badundheizung.de/karben/impressum/",
]);
var poslovalnicaKontekst = test.dolociPravniKontekst("https://example.test/munchen/");
var poslovalnicaPoti = test.sestaviZacetneImpressumPoti(new URL("https://example.test/munchen/"), poslovalnicaKontekst).map(String);
assert.ok(poslovalnicaPoti.includes("https://example.test/munchen/impressum"));
assert.ok(!poslovalnicaPoti.includes("https://example.test/impressum"), "poslovalnica ne sme uporabiti korenskega Impressuma");
assert.strictEqual(test.jeUrlVPravnemKontekstu("https://example.test/impressum", poslovalnicaKontekst), false);
var navadnaStranKontekst = test.dolociPravniKontekst("https://jshaustechnik.de/ueber-uns/");
assert.strictEqual(navadnaStranKontekst.najemniskaPot, "", "običajna vsebinska pot ni poslovalnica");
assert.strictEqual(test.jeUrlVPravnemKontekstu("https://jshaustechnik.live-website.com/impressum/", navadnaStranKontekst), true,
  "izrecno povezan zunanji Impressum mora ostati dovoljen pri navadni spletni strani");
var korenskiDokumentKontekst = test.dolociPravniKontekst("https://amtrockenbau.example/index.html");
assert.strictEqual(korenskiDokumentKontekst.korenskiDokument, true);
assert.strictEqual(korenskiDokumentKontekst.najemniskaPot, "", "index.html je korenski dokument, ne poslovalnica");
assert.strictEqual(test.jeUrlVPravnemKontekstu(
  "https://amtrockenbau.example/Impressum.html",
  korenskiDokumentKontekst
), true, "sosednja datoteka Impressum mora biti dovoljena tudi ob drugačni velikosti črk");
assert.deepStrictEqual(test.najdiImpressumPovezave(
  '<footer><a href="Impressum.html">Impressum</a></footer>',
  "https://amtrockenbau.example/index.html"
), ["https://amtrockenbau.example/Impressum.html"]);
var amTrockenbauImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><h2>Angaben gemäß § 5 TMG</h2><p>Agon Mazreku<br>A+M Akustik &amp; Trockenbau<br>Petzetstraße 17,<br>81245 München</p><h2>Kontakt</h2><p>Telefon: 01702029325<br>E-Mail: agronmazreku@hotmail.de</p></main>",
  "https://amtrockenbau.example/Impressum.html",
  { ime: "", naslov: "", postnaStevilka: "", kraj: "" }
);
assert.strictEqual(amTrockenbauImpressum.ime, "Agon Mazreku");
assert.strictEqual(amTrockenbauImpressum.naziv, "A+M Akustik & Trockenbau");
assert.strictEqual(amTrockenbauImpressum.entityType, "person");
var imenikProfilKontekst = test.dolociPravniKontekst("https://directory.example/firmenprofil/bodenleger-mario-sauer");
assert.strictEqual(imenikProfilKontekst.imeninskiProfil, true);
assert.deepStrictEqual(test.sestaviZacetneImpressumPoti(
  new URL("https://directory.example/firmenprofil/bodenleger-mario-sauer"), imenikProfilKontekst
).map(String), ["https://directory.example/firmenprofil/bodenleger-mario-sauer"]);
assert.strictEqual(test.jeUrlVPravnemKontekstu("https://directory.example/firmenprofil/impressum", imenikProfilKontekst), false,
  "sosednji profil z imenom Impressum ne sme postati pravni vir preverjanega podjetja");
assert.strictEqual(test.jeUrlVPravnemKontekstu("https://directory.example/firmenprofil/bodenleger-mario-sauer/impressum", imenikProfilKontekst), true,
  "izrecna pravna podstran znotraj istega profilnega zapisa mora ostati dovoljena");
assert.strictEqual(test.razlogNeujemanjaIdentiteteZVnosom(
  { naslov: "Oberböhringer Straße 27", postnaStevilka: "73312", kraj: "Geislingen/Steige" },
  { naslov: "Dieselstraße 26A", postnaStevilka: "61184", kraj: "Karben" }
), "entered_postal_context_mismatch");
assert.strictEqual(test.jeImpressumDokument(
  "<h1>Anbieterkennzeichnung</h1>", "https://example.test/anbieterkennzeichnung"
), true);
assert.deepStrictEqual(test.sestaviHwkIskanja(
  { ime: "Heizungsmeisterei Duman", postnaStevilka: "60437", kraj: "Frankfurt am Main" },
  { status: "found", subjekt: dumanImpressum }
).map(function (iskanje) { return iskanje.ime; }), ["Heizungsmeisterei Duman", "Köksal Duman"]);
var registerIzbor = test.izberiOpenRegisterZadetek([
  { company_id: "DE-HRB-1", name: "Elektro Beispiel GmbH", active: true, register_type: "HRB", register_number: "123" },
  { company_id: "DE-HRB-2", name: "Drugo Podjetje GmbH", active: true },
], { ime: "Elektro Beispiel GmbH" });
assert.strictEqual(registerIzbor.status, "found");
assert.strictEqual(registerIzbor.company.company_id, "DE-HRB-1");
assert.deepStrictEqual(test.razcleniOpenRegisterVnos("https://openregister.de/company/DE-HRB-M1201-137035"), {
  companyId: "DE-HRB-M1201-137035", registerType: "HRB", registerNumber: "137035",
});
var registerPoPovezavi = test.izberiOpenRegisterZadetek([
  { company_id: "DE-HRB-M1201-137035", name: "MedienOrbis GmbH", register_type: "HRB", register_number: "137035" },
], { ime: "https://openregister.de/company/DE-HRB-M1201-137035", postnaStevilka: "60325", kraj: "Frankfurt am Main" });
assert.strictEqual(registerPoPovezavi.status, "found");
var registerPoSodiscu = test.izberiOpenRegisterZadetek([
  { company_id: "DE-HRA-R2402-17175", name: "BHKW Ruhrauenpark GmbH & Co. KG", register_type: "HRA", register_number: "17175", register_court: "Essen" },
  { company_id: "DE-HRA-R1101-17175", name: "U.K. Udo Kerkmann e.K. Inhaber Stefan Krause", register_type: "HRA", register_number: "17175", register_court: "D\u00fcsseldorf" },
], { ime: "HRA 17175", registerCourt: "Amtsgericht D\u00fcsseldorf" });
assert.strictEqual(registerPoSodiscu.status, "found");
assert.strictEqual(registerPoSodiscu.company.company_id, "DE-HRA-R1101-17175");

var identitetaRegister = test.sestaviIdentiteto(registerIzbor, { status: "not_found" }, { status: "not_found" }, {
  ime: "Elektro Beispiel GmbH", postnaStevilka: "60385", kraj: "Frankfurt am Main",
});
assert.strictEqual(identitetaRegister.status, "verified_register");
assert.strictEqual(identitetaRegister.entityType, "company");
var apiDokazilo = test.sestaviApiDokaziloIdentitete(identitetaRegister, {
  sourceUrl: "https://openregister.de/company/DE-HRB-1",
});
assert.strictEqual(apiDokazilo.status, "verified_api");
assert.strictEqual(apiDokazilo.sourceLabel, "OpenRegister API");
assert.strictEqual(apiDokazilo.companyId, "DE-HRB-1");
assert.strictEqual(apiDokazilo.imageDataUrl, undefined, "API dokaz ne sme ustvariti screenshota.");
var identitetaZNaslovom = test.sestaviIdentiteto({ status: "found", company: {
  company_id: "DE-HRB-M1201-137035", name: "MedienOrbis GmbH", register_type: "HRB", register_number: "137035",
  address: { street: "Bettinastraße 62", postal_code: "60325", city: "Frankfurt am Main" },
} }, { status: "not_found" }, { status: "not_found" }, { ime: "MedienOrbis GmbH", postnaStevilka: "", kraj: "" });
assert.strictEqual(identitetaZNaslovom.naslov, "Bettinastraße 62");
assert.strictEqual(identitetaZNaslovom.postnaStevilka, "60325");
assert.strictEqual(identitetaZNaslovom.kraj, "Frankfurt am Main");
var ujemanjeNaslova = test.preveriUjemanjeLokacije({
  naslov: "Bettinastr. 62", postnaStevilka: "60325", kraj: "Frankfurt am Main",
}, identitetaZNaslovom);
assert.strictEqual(ujemanjeNaslova.status, "matched");
assert.strictEqual(test.preveriUjemanjeLokacije({
  naslov: "Druga ulica 1", postnaStevilka: "60325", kraj: "Frankfurt am Main",
}, identitetaZNaslovom).status, "mismatch");
assert.strictEqual(test.preveriUjemanjeLokacije({
  naslov: "Bettinastraße 62", postnaStevilka: "60325", kraj: "Frankfurt am Main",
}, { postnaStevilka: "60325", kraj: "Frankfurt am Main", naslov: "" }).status, "unverifiable");

var identitetaImpressum = test.sestaviIdentiteto({ status: "not_found" }, { status: "not_found" }, {
  status: "found", subjekt: impressum,
}, { ime: "M.A.Services24", postnaStevilka: "63067", kraj: "Offenbach am Main" });
assert.strictEqual(identitetaImpressum.status, "probable_impressum");
assert.strictEqual(test.sestaviSklep(identitetaImpressum, { status: "not_checked" }).level, "yellow");
assert.deepStrictEqual(test.dolociVirDokazilaIdentitete(identitetaRegister, {
  sourceUrl: "https://openregister.de/company/DE-HRB-1",
}, {}), {
  sourceUrl: "https://openregister.de/company/DE-HRB-1",
  sourceLabel: "OpenRegister",
});
assert.strictEqual(identitetaImpressum.ime, "Mihail Poclit");
assert.strictEqual(test.sestaviSklep(identitetaRegister, {
  status: "clear", officialVerification: { status: "clear" },
}).level, "green");
assert.strictEqual(test.sestaviSklep(identitetaRegister, {
  status: "possible_match", officialVerification: { status: "confirmed_match" },
}).title, "Insolvenčna objava je potrjena v dveh virih");
assert.strictEqual(test.sestaviSklep(identitetaImpressum, { status: "possible_match" }).level, "yellow");
assert.strictEqual(test.sestaviSklep({ status: "unresolved" }, { status: "not_checked" }).level, "yellow");
var rocnaIdentiteta = test.sestaviRocnoIdentiteto({
  ime: "CSC Elektro GmbH", naslov: "Am Bahnhof 15", postnaStevilka: "04838", kraj: "Laußig",
});
assert.strictEqual(rocnaIdentiteta.status, "manual_input");
assert.strictEqual(rocnaIdentiteta.entityType, "company");
assert.strictEqual(test.sestaviRocnoIdentiteto({
  ime: "Location Location", naslov: "Am Bahnhof 15", postnaStevilka: "04838", kraj: "Laußig",
}), null);
var potrjenaRocnaIdentiteta = test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "CSC Elektro GmbH", businessName: "CSC Elektro GmbH", street: "Am Bahnhof 15",
  postalCode: "04838", city: "Laußig", confirmed: true,
} }, rocnaIdentiteta);
assert.strictEqual(potrjenaRocnaIdentiteta.status, "valid");
assert.strictEqual(potrjenaRocnaIdentiteta.identity.status, "confirmed_manual");
assert.strictEqual(potrjenaRocnaIdentiteta.identity.verificationMode, "user_confirmed_manual");
assert.strictEqual(test.sestaviSklep(rocnaIdentiteta, { status: "not_checked" }).title, "Ročni podatki nimajo preverljivega vira");
assert.strictEqual(test.sestaviSklep(potrjenaRocnaIdentiteta.identity, {
  status: "clear", officialVerification: { status: "clear" },
}).level, "yellow");

var viri = test.sestaviVire(
  { status: "not_configured", sourceUrl: "https://openregister.de" },
  { status: "not_found", searchUrl: "https://hwk.example/search" },
  { status: "found", subjekt: impressum, sourceUrl: impressum.sourceUrl },
  { ime: "M.A.Services24", postnaStevilka: "63067", kraj: "Offenbach am Main", spletnaStran: "ma-services24.de" }
);
assert.deepStrictEqual(viri.map(function (vir) { return vir.id; }), ["openregister", "impressum", "gewerbe"]);
[
  ["website_not_public", "ni veljaven javni spletni naslov"],
  ["website_redirect_failed", "verigo preusmeritev"],
  ["website_not_html", "HTML spletne strani"],
  ["website_too_large", "prevelika"],
  ["website_unreachable", "ni odzvala"],
  ["website_server_error", "Spletni strežnik podjetja"],
  ["website_rate_limited", "začasno omejuje dostop"],
  ["legal_source_context_mismatch", "druge poslovalnice"],
  ["entered_postal_context_mismatch", "druge poslovalnice"],
  ["legal_identity_incomplete", "manjka zanesljivo pravno ime"],
  ["holder_not_reliably_identified", "nosilca ni bilo mogoče"],
  ["impressum_not_found", "neposredni URL"],
].forEach(function (primer) {
  var virNapake = test.sestaviVire(
    { status: "disabled" }, { status: "disabled" },
    { status: "not_found", reason: primer[0], sourceUrl: "https://example.test/" },
    { spletnaStran: "https://example.test/", kraj: "Berlin", postnaStevilka: "10115" }
  ).find(function (vir) { return vir.id === "impressum"; });
  assert.ok(virNapake.message.includes(primer[1]), "Jasno sporočilo za: " + primer[0]);
  assert.ok(test.sestaviSklep(
    { status: "unresolved" }, null, { reason: primer[0] }
  ).message.includes(primer[1]), "Jasen glavni problem za: " + primer[0]);
});
assert.strictEqual(test.razlogNapakeBranjaSpletneStrani("WEBSITE_SERVER_ERROR_502"), "website_server_error");
assert.strictEqual(test.httpStatusNapakeSpletneStrani("WEBSITE_SERVER_ERROR_502"), 502);
assert.strictEqual(test.razlogNapakeBranjaSpletneStrani("WEBSITE_RATE_LIMITED_429"), "website_rate_limited");
assert.strictEqual(test.httpStatusNapakeSpletneStrani("WEBSITE_RATE_LIMITED_429"), 429);
assert.strictEqual(test.jeNedosegljivaNadomestnaStran(
  "<html><head><title>STRATO - Domain not available</title></head><body>" +
  "This website is currently not available. Please try again later. Powered by STRATO</body></html>"
), true, "Deaktivirana domena z lažnim HTTP 200 mora biti obravnavana kot nedosegljiva.");
assert.strictEqual(test.jeNedosegljivaNadomestnaStran(
  "<html><head><title>Impressum</title></head><body>Unsere Website ist derzeit verfügbar.</body></html>"
), false);
var dumanIdentiteta = test.sestaviIdentiteto({ status: "not_found" }, { status: "disabled" }, {
  status: "found", subjekt: dumanImpressum,
}, { ime: "Heizungsmeisterei Duman" });
assert.strictEqual(test.pripraviPotrditevIdentitete({}, dumanIdentiteta).status, "not_provided");
var potrjenDuman = test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "Köksal Duman",
  businessName: "Heizungsmeisterei Duman",
  street: "Halmstraße 2",
  postalCode: "60437",
  city: "Frankfurt am Main",
  confirmed: true,
} }, dumanIdentiteta);
assert.strictEqual(potrjenDuman.status, "valid");
assert.strictEqual(potrjenDuman.identity.status, "confirmed_impressum");
assert.strictEqual(potrjenDuman.identity.verificationMode, "user_confirmed_impressum");
var potrjenaAiDruzba = test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "A+I Elektrotechnik GmbH",
  businessName: "A+I Elektrotechnik GmbH",
  representativeName: "Waled Adam",
  street: "Moorfleeter Straße 15",
  postalCode: "22113",
  city: "Hamburg",
  confirmed: true,
} }, {
  status: "probable_impressum", ime: "Waled Adam", naziv: "A+I Elektrotechnik GmbH",
  naslov: "Moorfleeter Straße 15", postnaStevilka: "22113", kraj: "Hamburg", source: "impressum",
});
assert.strictEqual(potrjenaAiDruzba.status, "valid");
assert.strictEqual(potrjenaAiDruzba.identity.entityType, "company");
assert.strictEqual(potrjenaAiDruzba.identity.ime, "A+I Elektrotechnik GmbH");
assert.strictEqual(potrjenaAiDruzba.identity.nosilec, "Waled Adam");
assert.strictEqual(potrjenaAiDruzba.identity.vloge[0].ime, "Waled Adam");
var potrjenaAquaCc = test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "Dipl.-Ing. Elmar Lancé", businessName: "AQUA-CC GmbH",
  representativeName: "Prof. Dr.-Ing. Elmar Lancé", street: "An den Finkenweiden 57",
  postalCode: "52074", city: "Aachen", confirmed: true,
} }, {
  status: "probable_impressum", ime: "Dipl.-Ing. Elmar Lancé", nosilec: "Dipl.-Ing. Elmar Lancé",
  naziv: "AQUA-CC GmbH", entityType: "company", naslov: "An den Finkenweiden 57",
  postnaStevilka: "52074", kraj: "Aachen", source: "impressum",
  vloge: [{ ime: "Dipl.-Ing. Elmar Lancé", vloga: "Geschäftsführung" }],
});
assert.strictEqual(potrjenaAquaCc.status, "valid");
assert.strictEqual(potrjenaAquaCc.identity.nosilec, "Elmar Lancé");
assert.strictEqual(potrjenaAquaCc.identity.vloge[0].ime, "Elmar Lancé");
assert.deepStrictEqual(test.sestaviUradneImenskePogoje({
  ime: "Prof. Dr.-Ing. Elmar Lancé", entityType: "person",
}), { firmaPriimek: "Lancé", ime: "Elmar", vrsta: "person" });
assert.strictEqual(test.sestaviOpenRegisterInsolvencnoIskanje({
  ime: "Dipl.-Ing. Elmar Lancé", entityType: "person", kraj: "Aachen",
}).query.value, "Elmar Lancé");
assert.strictEqual(test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "A+I Elektrotechnik GmbH", businessName: "A+I Elektrotechnik GmbH",
  representativeName: "den Inhaber", street: "Moorfleeter Stra\u00dfe 15",
  postalCode: "22113", city: "Hamburg", confirmed: true,
} }, {
  status: "probable_impressum", ime: "Waled Adam", nosilec: "Waled Adam",
  naziv: "A+I Elektrotechnik GmbH", naslov: "Moorfleeter Straße 15",
  postnaStevilka: "22113", kraj: "Hamburg", source: "impressum",
}).reason, "confirmed_representative_invalid");
assert.strictEqual(test.sestaviSklep(potrjenDuman.identity, { status: "clear" }).level, "yellow");
assert.strictEqual(test.sestaviSklep(potrjenDuman.identity, { status: "possible_match" }).level, "red");
assert.strictEqual(test.sestaviSklep(dumanIdentiteta, { status: "not_checked", reason: "identity_evidence_unavailable" }).title, "Vira ni bilo mogoče prikazati");
assert.strictEqual(test.skrajsajNazivZaDokazilo("Schreiber GmbH | Sanitär • Heizung • Energie"), "Schreiber GmbH");
assert.deepStrictEqual(test.sestaviUradneImenskePogoje({
  ime: "Schreiber GmbH | Sanitär • Heizung • Energie", entityType: "company",
}), { firmaPriimek: "Schreiber GmbH", ime: "", vrsta: "company" }, "uradnemu portalu se ne sme poslati slogan");
var potrjenSchreiber = test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "Fabian Schreiber", businessName: "Schreiber GmbH | Sanitär • Heizung • Energie",
  street: "Mauritiusstraße 4", postalCode: "60529", city: "Frankfurt am Main", confirmed: true,
} }, {
  status: "probable_impressum", ime: "Fabian Schreiber", naziv: "Schreiber GmbH | Sanitär • Heizung • Energie",
  naslov: "Mauritiusstraße 4", postnaStevilka: "60529", kraj: "Frankfurt am Main", source: "impressum",
});
assert.strictEqual(potrjenSchreiber.status, "valid");
assert.strictEqual(potrjenSchreiber.identity.ime, "Schreiber GmbH");
assert.strictEqual(potrjenSchreiber.identity.naziv, "Schreiber GmbH");
assert.ok(test.sestaviPojmeDokazilaIdentitete({
  naziv: "Schreiber GmbH | Sanitär • Heizung • Energie", ime: "Fabian Schreiber",
  nosilec: "Fabian Schreiber", naslov: "Mauritiusstraße 4", postnaStevilka: "60529", kraj: "Frankfurt am Main",
}).includes("Schreiber GmbH"), "dokazilo mora iskati pravno ime brez slogana");
assert.ok(!test.sestaviObveznePojmeDokazilaIdentitete({
  naziv: "Schreiber GmbH | Sanitär • Heizung • Energie", ime: "Fabian Schreiber", entityType: "company",
  nosilec: "Fabian Schreiber", naslov: "Mauritiusstraße 4", postnaStevilka: "60529", kraj: "Frankfurt am Main",
}).includes("Schreiber GmbH | Sanitär • Heizung • Energie"), "slogan ne sme biti obvezni dokazni pojem");
assert.deepStrictEqual(test.sestaviObveznePojmeDokazilaIdentitete({
  naziv: "Heizungsmeisterei Duman", ime: "Köksal Duman", nosilec: "Köksal Duman", entityType: "person",
  naslov: "Halmstraße 2", postnaStevilka: "60437", kraj: "Frankfurt am Main",
}), ["Köksal Duman", "Halmstraße 2", "60437", "Frankfurt am Main"], "pri samostojnem obrtniku marketinški naziv ne sme blokirati dokazila");
assert.deepStrictEqual(test.sestaviObveznePojmeDokazilaIdentitete({
  naziv: "Schreiber GmbH | Sanitär • Heizung • Energie", ime: "Fabian Schreiber", nosilec: "Fabian Schreiber", entityType: "company",
  naslov: "Mauritiusstraße 4", postnaStevilka: "60529", kraj: "Frankfurt am Main",
}), ["Schreiber GmbH", "Mauritiusstraße 4", "60529", "Frankfurt am Main"], "pri družbi je obvezno pravno ime, ne osebno ime zastopnika");
var dokaziloVir = fs.readFileSync(path.join(__dirname, "..", "api", "mehka-boniteta.js"), "utf8");
assert.strictEqual((dokaziloVir.match(/var LEGAL_ROLE_LABEL_SOURCE/g) || []).length, 1, "Vsi parserji morajo uporabljati en skupni slovar pravnih vlog.");
assert.match(dokaziloVir, /razcleniVidniImpressumTekst[\s\S]*LEGAL_ROLE_LABEL_SOURCE/, "Rezervni parser ne sme imeti starega lastnega seznama pravnih oznak.");
assert.match(dokaziloVir, /async function pocakajNaIzrezIdentitete/);
assert.match(dokaziloVir, /async function pripraviZakasnjenoVsebinoDokazila/);
assert.match(dokaziloVir, /trenutni = trenutni\.parentElement/, "vidnost dokazila mora preveriti tudi animirane nadrejene elemente");
assert.match(dokaziloVir, /Number\(slog\.opacity \|\| 1\) < 0\.98/, "delno prosojen vmesni kader ne sme postati dokazni posnetek");
assert.match(dokaziloVir, /document\.getAnimations\(\)/, "zajem mora zaključiti odjemalske animacije pravnega bloka");
assert.match(dokaziloVir, /jeAnimacijskiOvoj[\s\S]*jeVizualnoSkrit/, "razkriti se sme samo skrit animacijski ovoj pravnega bloka");
assert.strictEqual(test.jePosnetekDokazilaUporaben("A".repeat(9000), { width: 800, height: 700 }), false, "velik skoraj prazen zajem ne sme postati dokazilo");
assert.strictEqual(test.jePosnetekDokazilaUporaben("A".repeat(100000), { width: 800, height: 700 }), true, "vsebinski dokazni zajem mora prestati varovalko");
assert.match(dokaziloVir, /var BROWSER_USER_AGENT = "Mozilla\/5\.0/);
assert.match(dokaziloVir, /async function poisciImpressumZBrskalnikom/);
assert.match(dokaziloVir, /httpPoskus === 0 \? USER_AGENT : BROWSER_USER_AGENT/);
assert.match(dokaziloVir, /\^accept\$\/i/, "angleška pasica z gumbom Accept ne sme prekriti dokazila");
assert.match(dokaziloVir, /alle akzeptieren/i, "nemška pasica z gumbom Alle akzeptieren ne sme prekriti dokazila");
assert.match(dokaziloVir, /ablehnen/i, "nemška pasica z gumbom Ablehnen ne sme prekriti dokazila");
assert.match(dokaziloVir, /auswahl speichern/i, "nemška pasica z gumbom za shranjevanje izbire ne sme prekriti dokazila");
assert.match(dokaziloVir, /stran\.frames\(\)/, "pasice v okvirjih morajo biti lokalno odstranjene iz dokazila");
assert.match(dokaziloVir, /jeCelozaslonskiPojavniSloj/, "dokazilo mora odstraniti tudi splošne celozaslonske pojavne ovoje");
assert.match(dokaziloVir, /uj-dokazilo-brez-prekrivanj/, "varovalo mora ostati aktivno tudi po ponovni izdelavi pojavnega ovoja");
assert.match(dokaziloVir, /IDENTITY_SCREENSHOT_OVERLAY_ACTIVE/, "aktiven prekrivni sloj mora preprečiti nastanek JPEG-a");
assert.match(dokaziloVir, /IDENTITY_SCREENSHOT_DIMMED_OVERLAY/, "slikovno zaznana sivina mora preprečiti prikaz pokvarjenega JPEG-a");
assert.match(dokaziloVir, /ponovnoZajemiImpressumBrezSkript/, "siv Impressum mora samodejno dobiti drugi zajem brez skript strani");
assert.match(dokaziloVir, /setJavaScriptEnabled\(false\)/, "rezervni zajem ne sme zagnati pojavnega vtičnika");
assert.match(dokaziloVir, /eb-popup\|eb-\\d\+-open/, "stanje pojavnega vtičnika mora biti odstranjeno tudi s korenskega elementa");
assert.strictEqual(test.jePosnetekZatemnjenZaradiSloja({ povprecnaSvetlost: 128, delezSive: 0.91, delezBele: 0.04 }), true);
assert.strictEqual(test.jePosnetekZatemnjenZaradiSloja({ povprecnaSvetlost: 238, delezSive: 0.04, delezBele: 0.82 }), false);
assert.strictEqual(test.jePosnetekZatemnjenZaradiSloja({
  povprecnaSvetlost: 195, delezSive: 0.46, delezBele: 0.28,
  delezMocnoSivihStolpcev: 0.625, razponSvetlostiStolpcev: 96,
  delezMocnoSivihVrstic: 0, razponSvetlostiVrstic: 18,
}), true, "delno siv navpični prekrivni sloj ne sme postati dokazilo");
assert.strictEqual(test.jePosnetekZatemnjenZaradiSloja({
  povprecnaSvetlost: 116, delezSive: 0.92, delezBele: 0.02,
  delezMocnoSivihStolpcev: 1, razponSvetlostiStolpcev: 8,
  delezMocnoSivihVrstic: 1, razponSvetlostiVrstic: 7,
}), true, "enakomerno zatemnjena slika mora ostati zavrnjena");
assert.strictEqual(test.jePosnetekSkorajPrazen({
  delezBele: 0.75, delezVsebineVJedru: 0.03, delezVsebinskihVrsticVJedru: 0.25,
}), true, "bel rezervni izris z vsebino samo v ozkem zgornjem pasu ne sme postati dokazilo");
assert.strictEqual(test.jePosnetekSkorajPrazen({
  delezBele: 0.86, delezVsebineVJedru: 0.09, delezVsebinskihVrsticVJedru: 0.75,
}), false, "bel Impressum z razporejenim temnim besedilom mora ostati veljaven");
assert.strictEqual(test.jePosnetekSkorajPrazen({
  delezBele: 0.28, delezVsebineVJedru: 0.2, delezVsebinskihVrsticVJedru: 0.75,
}), false, "vsebinski barvni ali temni Impressum ne sme biti lažno zavrnjen");
assert.match(dokaziloVir, /querySelectorAll\("main, article, section, \[role='main'\]"\)/,
  "temen pojavni div se ne sme več razglasiti za naravno ozadje strani");
assert.match(dokaziloVir, /IDENTITY_SCREENSHOT_OVERLAY_ACTIVE.*includes|includes\(napakaPrvegaPosnetka\.message\)/s,
  "tudi DOM-zaznan prekrivni sloj mora sprožiti rezervni zajem brez skript");
assert.match(dokaziloVir, /eb-\(\?:inst\|dialog\)/, "EngageBox ovoj ne sme ostati siv nad dokaznim posnetkom");
assert.match(dokaziloVir, /pravokotnik\.width >= window\.innerWidth \* 0\.6/, "odstranitev mora biti omejena na velike prekrivne plasti");
assert.match(dokaziloVir, /zIndex >= 100/, "navadni fiksni deli strani ne smejo biti pomotoma odstranjeni");
assert.match(dokaziloVir, /koren === document/, "neopisano CMP-ozadje se sme odstraniti samo znotraj istega senčnega korena");
assert.match(dokaziloVir, /IDENTITY_SCREENSHOT_BLANK_CONTENT/, "skoraj prazen rezervni izris mora biti izrecno zavrnjen");
var zajemOdsek = dokaziloVir.slice(dokaziloVir.indexOf("async function zajemiDokaziloIdentitete"), dokaziloVir.indexOf("function sestaviOpenRegisterInsolvencnoIskanje"));
assert.match(zajemOdsek, /skrijPiskotkovnoPasicoZaPosnetek/);
assert.match(zajemOdsek, /EMPTY_IDENTITY_SCREENSHOT/, "prazen posnetek mora po ponovnem poskusu vrniti jasno napako");
assert.match(zajemOdsek, /captureVersion:\s*IDENTITY_EVIDENCE_VERSION/, "nov dokazni posnetek mora nositi različico, da ga ni mogoče zamenjati s starim sivim zajemom");
assert.match(zajemOdsek, /viewportOverlaysRemoved:\s*true/, "nov dokazni posnetek mora potrditi odstranitev celozaslonskih prekrivnih plasti");
assert.match(dokaziloVir, /celotenKompletIzvenNoge/, "dokazilo mora dati prednost pravnemu bloku pred podvojenim footerjem");
assert.match(dokaziloVir, /razdaljaDoImpressuma/, "dokazilo mora dati prednost podatkom ob naslovu Impressum");
assert.match(dokaziloVir, /IMPRINT_PAGE_NOT_CONFIRMED/, "dokazilo se ne sme zajeti brez potrjene pravne Impressum strani");
assert.doesNotMatch(zajemOdsek, /await sprejmiPiskotke/, "dokazni zajem ne sme spreminjati soglasja na tuji strani");
assert.match(zajemOdsek, /setUserAgent\(BROWSER_USER_AGENT\)/, "dokazni brskalnik mora uporabljati brskalniški profil");
assert.doesNotMatch(zajemOdsek, /setUserAgent\(USER_AGENT\)/, "API-identifikator ne sme skriti pravne vsebine v brskalniku");
assert.strictEqual(test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "Location Location", street: "Halmstraße 2", postalCode: "60437", city: "Frankfurt am Main", confirmed: true,
} }, dumanIdentiteta).reason, "confirmed_data_incomplete");
var potrjenRegister = test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "MedienOrbis GmbH", businessName: "MedienOrbis GmbH", street: "Bettinastr. 62", postalCode: "60325", city: "Frankfurt am Main", confirmed: true,
} }, identitetaZNaslovom);
assert.strictEqual(potrjenRegister.status, "valid");
assert.strictEqual(potrjenRegister.identity.verificationMode, "openregister_confirmed");
var juanRegister = {
  status: "verified_register", ime: "Juan Munoz e.K.", naziv: "Juan Munoz e.K.",
  naslov: "Egenolffstraße 3", postnaStevilka: "60316", kraj: "Frankfurt am Main",
  companyId: "DE-HRA-F1103-44336",
};
var juanPotrditev = test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "Juan Munoz e.K.", businessName: "Juan Munoz e.K.", street: "Egenolffstraße 3",
  postalCode: "60316", city: "Frankfurt am Main", companyId: "DE-HRA-F1103-44336", confirmed: true,
} }, juanRegister);
assert.strictEqual(juanPotrditev.status, "valid");
assert.strictEqual(test.pripraviOpenRegisterVnosZaPotrditev({ confirmedIdentity: {
  companyId: "DE-HRA-F1103-44336",
} }, { ime: "Juan Muñoz", spletnaStran: "https://juan-munoz.de/" }).ime, "DE-HRA-F1103-44336");
assert.strictEqual(test.pripraviOpenRegisterVnosZaPotrditev({ confirmedIdentity: {
  companyId: "ni-veljaven-id",
} }, { ime: "Juan Muñoz" }).ime, "Juan Muñoz");
assert.strictEqual(test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "MedienOrbis GmbH", street: "Druga ulica 1", postalCode: "60325", city: "Frankfurt am Main", confirmed: true,
} }, identitetaZNaslovom).reason, "official_data_mismatch");

var koren = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(koren, "app", "bonitetna-preverba.html"), "utf8");
var js = fs.readFileSync(path.join(koren, "app", "bonitetna-preverba.js"), "utf8");
var centerJs = fs.readFileSync(path.join(koren, "app", "boniteta-sredisce.js"), "utf8");
var bonitetaCss = fs.readFileSync(path.join(koren, "app", "bonitetna-preverba.css"), "utf8");
var meni = fs.readFileSync(path.join(koren, "app", "zascita-posla.html"), "utf8");
var meniJs = fs.readFileSync(path.join(koren, "app", "zascita-posla.js"), "utf8");
var lokalniStreznik = fs.readFileSync(path.join(koren, "scripts", "local-server.js"), "utf8");
var appJs = fs.readFileSync(path.join(koren, "app", "app.js"), "utf8");
var lokalniStreznik = fs.readFileSync(path.join(koren, "scripts", "local-server.js"), "utf8");
var apiSrc = fs.readFileSync(path.join(koren, "api", "mehka-boniteta.js"), "utf8");
var packageJson = fs.readFileSync(path.join(koren, "package.json"), "utf8");
assert.match(html, /id="boniteta-obrazec"/);
assert.match(html, /id="boniteta-viri"/);
assert.match(html, /id="boniteta-brez-spletne"/);
assert.match(html, /id="boniteta-openregister-identiteta"[^>]*role="switch"/);
assert.match(html, /id="boniteta-openregister-identiteta"[^>]*checked/);
assert.match(html, /celoten OpenRegister preskočimo/);
assert.match(html, /id="boniteta-kraj-izbira"/);
assert.match(html, /id="boniteta-potrdi-nosilec"/);
assert.match(js, /representativeName:\s*potrjeniNosilec/);
assert.doesNotMatch(html, /id="boniteta-kraj"[^>]*required/);
assert.doesNotMatch(html, /id="boniteta-naslov-podjetja"[^>]*required/);
assert.match(html, /id="boniteta-insolvenca-podatki"/);
assert.match(html, /id="boniteta-insolvenca-posnetek"/);
assert.match(html, /id="boniteta-objave-gumb"/);
assert.match(html, /id="boniteta-objave-seznam"/);
assert.match(html, /bonitetna-preverba\.css\?v=20260817-temp-back-v5/);
assert.match(html, /class="crif-flow-picker__visual"/);
assert.match(bonitetaCss, /\.stran--bonitetna \.crif-flow-picker__options button \+ button \{ border-left:/);
assert.match(bonitetaCss, /\.stran--bonitetna \.boniteta-hero \{ min-height: 160px;/);
assert.match(bonitetaCss, /\.boniteta-hero__status \{ min-height: 18px; margin: 6px 72px 0 2px;/);
assert.match(bonitetaCss, /\.boniteta-zajem__nacin \{ min-height: 98px;/);
assert.match(bonitetaCss, /\.boniteta-hero > label \{ margin-top: 0; font-size: \.76rem; \}/);
assert.match(bonitetaCss, /\.stran--bonitetna \.boniteta-zajem \{ gap: 8px; margin: -22px 10px 0;/);
assert.match(bonitetaCss, /\.stran--bonitetna \.crif-flow-picker__options \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
assert.match(html, /bonitetna-preverba\.js\?v=20260818-ek-impressum-evidence-v26/);
assert.match(js, /Iščemo podjetje in posodabljamo podatke obrtnika …/);
assert.match(html, /boniteta-sredisce\.js\?v=20260817-reference-flow-v10/);
assert.match(html, /id="boniteta-flow-start"/);
assert.match(bonitetaCss, /\.stran--bonitetna \.crif-flow-picker__start \{[\s\S]*?min-height: 46px;[\s\S]*?border-radius: 11px;[\s\S]*?background: linear-gradient\(135deg, #57b6b0, #2f8480\);/);
assert.match(bonitetaCss, /\.stran--bonitetna \.crif-flow-picker__start b \{ position: static;/);
assert.match(html, /boniteta-pro\.css\?v=20260816-profiles-delete-v6/);
assert.match(html, /data-boniteta-center-view="new"/);
assert.match(html, /data-boniteta-center-view="profiles"/);
assert.doesNotMatch(html, /id="boniteta-crif-toggle"/);
assert.strictEqual((html.match(/data-crif-element/g) || []).length, 3);
assert.match(bonitetaCss, /\.crif-elements-hidden \[data-crif-element\]/);
assert.match(centerJs, /uj:boniteta:crif-elements-visible/);
assert.match(centerJs, /classList\.toggle\("crif-elements-hidden",!visible\)/);
assert.match(centerJs, /if\(!visible\)selectFlow\("soft"\)/);
assert.match(html, /id="boniteta-identiteta-posnetek"/);
assert.match(html, /id="boniteta-identiteta-slika"/);
assert.match(html, /id="boniteta-identiteta-dokazilo-status"[^>]*role="status"[^>]*hidden/);
assert.match(js, /prikazanoDokaziloIdentitete\.screenshotReady === true/);
assert.match(js, /podatki\.impressumEvidence/);
assert.match(js, /prikazanoDokaziloIdentitete/);
assert.doesNotMatch(js, /identity-evidence-v\d+/);
assert.doesNotMatch(js, /razlicicaOciscanegaPosnetka/);
assert.match(js, /Dokazni posnetek ni na voljo/);
assert.strictEqual((html.match(/data-posnetek-povecava/g) || []).length, 2);
assert.strictEqual((html.match(/data-posnetek-pomanjsaj/g) || []).length, 2);
assert.strictEqual((html.match(/data-posnetek-povecaj/g) || []).length, 2);
assert.strictEqual((html.match(/data-posnetek-prilagodi/g) || []).length, 2);
assert.match(html, /id="boniteta-potrditev-identitete"/);
assert.match(html, /id="boniteta-potrdi-ime"[^>]*data-fit-input/);
assert.match(html, /id="boniteta-potrdi-naslov"[^>]*data-fit-input/);
assert.match(html, /id="boniteta-potrditev-gumb"/);
assert.match(html, /id="boniteta-potrditev-opis"/);
assert.match(html, /id="boniteta-potrditev-kljukica"/);
assert.match(html, /Ročno preveri v uradnem insolvenčnem registru/);
assert.match(html, /id="boniteta-insolvenca-api-vir"/);
assert.ok(html.indexOf('id="boniteta-spletna-stran"') < html.indexOf('id="boniteta-posta"'), "Spletna stran mora biti takoj za identiteto in pred lokacijo.");
assert.match(js, /fetchSPonovnimPoskusom\("\/api\/mehka-boniteta-opravilo"/);
assert.match(js, /function fetchSPonovnimPoskusom\(url, moznosti\)/);
assert.match(js, /supabaseKlient\.auth\.refreshSession\(\)/, "odjemalec mora znati sam osvežiti prijavno sejo");
assert.match(js, /AUTH_SERVER_UNAVAILABLE/, "odjemalec mora samodejno ponoviti začasno nedosegljivo avtorizacijo");
assert.match(js, /AUTH_SESSION_INVALID/, "neveljavna seja mora sprožiti en nadzorovan osvežitveni poskus");
assert.match(js, /AUTH_SESSION_REFRESH_REQUIRED/, "stari HS256 žeton mora sprožiti nadzorovano nadgradnjo seje");
assert.match(js, /failed to fetch\|networkerror\|network request failed\|load failed/i);
assert.match(js, /Povezava z aplikacijskim strežnikom je prekinjena/);
assert.match(html, /id="boniteta-izbrisi-preverbo"[^>]*hidden/);
assert.match(js, /method:\s*"DELETE"/);
assert.match(js, /zadnjiJobId/);
assert.match(js, /Izbriši vse podatke tega preverjanja/);
assert.match(js, /fetch\("\/api\/mehka-boniteta-delavec"/);
assert.match(js, /Vnesite spletno stran ali kliknite/);
assert.match(js, /potrjenoBrezSpletne/);
assert.match(js, /uporabiOpenRegisterIdentiteto: Boolean/);
assert.match(js, /verificationMode === "official_portal_only"/);
assert.match(js, /fetch\("\/api\/nemcija-posta\?postalCode="/);
assert.match(js, /Ta poštna številka ima več krajev – izberite pravilnega/);
assert.match(js, /boniteta-kraj-izbira__gumb/);
assert.match(js, /naslov: rocniNaslov/);
assert.match(js, /izrisiVire\(podatki\.sources\)/);
assert.match(js, /evidenceStatus === "verified_api"/);
assert.match(js, /insolvenca\.apiSourceUrl/);
assert.match(js, /OpenRegister Insolvency API/);
assert.match(js, /uradnaPotrditev\.evidenceImage/);
assert.match(js, /uradnaPotrditev\.publications/);
assert.match(js, /function vzpostaviPovecavoPosnetkov\(\)/);
assert.match(js, /\[50, 75, 100, 125, 150, 200, 250, 300, 400\]/);
assert.match(js, /dogodek\.key === "0"/);
assert.match(js, /ponastaviPovecavoPosnetka\(identitetaSlika\)/);
assert.match(js, /ponastaviPovecavoPosnetka\(insolvencaSlika\)/);
assert.match(js, /Preglej vseh/);
assert.match(bonitetaCss, /\.boniteta-objave__gumb/);
assert.match(bonitetaCss, /\.boniteta-posnetek-povecava__okno/);
assert.match(bonitetaCss, /touch-action:\s*pan-x pan-y/);
assert.match(bonitetaCss, /\.boniteta-insolvenca-viri \[hidden\][\s\S]*display:\s*none\s*!important/);
assert.match(bonitetaCss, /overflow-wrap:\s*anywhere/);
assert.match(js, /prikazanoDokaziloIdentitete\.imageDataUrl/);
assert.match(js, /prikazanoDokaziloIdentitete\.screenshotReady === true/, "UI mora zaupati enotni semantični strežniški pogodbi dokazila");
assert.match(js, /Neposredno prek OpenRegister API/);
assert.match(js, /confirmedIdentity/);
assert.match(html, /id="boniteta-identiteta-url"/, "ob dokazilu mora biti viden končni URL vira");
assert.match(js, /prikazanoDokaziloIdentitete\.sourceUrl/, "UI mora prikazati končni URL zajetega vira");
assert.match(js, /manual_input/);
assert.match(js, /!\["verified_register", "confirmed_impressum"\]\.includes\(identiteta\.status\)/, "nepreverjen ročni vnos se ne sme shraniti med preverjena podjetja");
assert.match(js, /Ročno vneseni podatki niso preverljiv pravni vir/, "omejitev rezultata mora opisati dejanski uporabljeni vir");
assert.match(js, /identiteta ni uradno potrjena/);
assert.match(js, /companyId: zadnjaOpenRegisterReferenca/);
assert.match(js, /Podatki so pravilni – preveri insolventnost/);
assert.match(html, /Ali dodajate stranko drugače/);
assert.match(html, />Slikaj</);
assert.match(html, />Uvozi PDF</);
assert.match(html, /id="boniteta-hero-spletna-stran"/);
assert.match(html, /Koga želite preveriti\?/);
assert.match(html, /id="boniteta-register"/);
assert.match(html, /id="boniteta-davcna"/);
assert.match(html, /id="boniteta-nacin-slikaj"[\s\S]*data-fit-text/);
assert.match(html, /id="boniteta-ime"[^>]*data-fit-input/);
assert.match(js, /namen: "bonitetna_preverba"/);
assert.match(js, /izberiRazbranoStranko/);
assert.match(bonitetaCss, /\.boniteta-izbira-stranke__kartica[\s\S]*min-height:\s*76px/);
assert.doesNotMatch(js, /manualHwkEvidence|Nadaljuj v uradnem HWK iskanju/);
assert.match(apiSrc, /OPENREGISTER_INSOLVENCY_SEARCH/);
assert.match(apiSrc, /sestaviOpenRegisterInsolvencnoIskanje/);
assert.match(apiSrc, /pridobiOpenRegisterInsolvencnePodrobnosti/);
assert.match(apiSrc, /apiEvidence/);
assert.match(apiSrc, /preveriUradniInsolvencniPortal/);
assert.match(apiSrc, /presodiUradniInsolvencniRezultat/);
assert.match(apiSrc, /presodiOpenRegisterInsolvencniZadetek/);
assert.match(apiSrc, /var zadetki = presojeZadetkov\.filter/);
assert.match(apiSrc, /matchAssessment: presojeZadetkov/);
assert.match(apiSrc, /litx_firmaNachName:text", imenskiPogoji\.firmaPriimek/);
assert.match(apiSrc, /litx_vorname:text", imenskiPogoji\.ime/);
assert.match(apiSrc, /Veröffentlichungstext anzeigen/);
assert.match(apiSrc, /publications:\s*uradneObjave/);
assert.match(apiSrc, /zajemiDokaziloIdentitete/);
assert.match(apiSrc, /viewportOverlaysRemoved:\s*dokazilo\.viewportOverlaysRemoved === true/, "oznaka očiščenega posnetka mora priti do odjemalca");
assert.match(apiSrc, /async function sprejmiPiskotke/);
assert.match(apiSrc, /async function dolociIzrezIdentitete/);
assert.match(apiSrc, /function sestaviPojmeDokazilaIdentitete/);
assert.match(apiSrc, /function sestaviObveznePojmeDokazilaIdentitete/);
assert.match(apiSrc, /var zgornjiOdmik = 140/);
assert.match(apiSrc, /var spodnjiOdmik = 320/);
assert.match(apiSrc, /var sidrniIndex = obvezniIndeksi\[0\]/);
assert.match(apiSrc, /pojem === normaliziraniOsebniPojem && \/@\|https\?:\|www\\\.\//);
assert.match(apiSrc, /var zelenaVisina = Math\.max\(700,/);
assert.doesNotMatch(apiSrc, /Math\.min\(spodaj - zgoraj[\s\S]*?, 1500\)/);
assert.match(apiSrc, /var sodisceIzbrano = await izberiPoBesedilu/);
assert.match(apiSrc, /if \(sodisceIzbrano && vrstaIzbrana\)/);
assert.match(apiSrc, /async function preveriUradniInsolvencniPortalEnkrat/);
assert.match(apiSrc, /for \(var poskus = 0; poskus < 2; poskus \+= 1\)/);
assert.match(apiSrc, /clip: izrez/);
assert.doesNotMatch(apiSrc.slice(apiSrc.indexOf("async function zajemiDokaziloIdentitete"), apiSrc.indexOf("function sestaviOpenRegisterInsolvencnoIskanje")), /fullPage:\s*true/);
assert.match(apiSrc, /status: "verified_api"/);
assert.match(apiSrc, /confirmationRequired: true/);
assert.ok(
  apiSrc.indexOf("await poisciOpenRegister(openregisterOsnovniVnos)") < apiSrc.indexOf("await poisciVImpressumu(vnos)"),
  "OpenRegister mora biti preverjen pred spletnim Impressumom."
);
assert.match(apiSrc, /status: "confirmed_manual"/);
assert.match(apiSrc, /reason: "identity_source_required"/, "ročno vneseni podatki brez vira ne smejo sprožiti insolvenčne poizvedbe");
assert.match(apiSrc, /reason: "temporarily_disabled"/);
assert.match(apiSrc, /pripraviPotrditevIdentitete\(telo, identiteta\)/);
assert.match(apiSrc, /pripraviOpenRegisterVnosZaPotrditev\(telo, vnos\)/);
assert.strictEqual(test.uporabiOpenRegisterZaIdentiteto({}), true);
assert.strictEqual(test.uporabiOpenRegisterZaIdentiteto({ uporabiOpenRegisterIdentiteto: true }), true);
assert.strictEqual(test.uporabiOpenRegisterZaIdentiteto({ uporabiOpenRegisterIdentiteto: false }), false);
var openregisterIzklopljen = { status: "disabled", reason: "user_disabled_identity_lookup" };
var identitetaSamoImpressum = test.sestaviIdentiteto(openregisterIzklopljen, { status: "disabled" }, {
  status: "found",
  subjekt: Object.assign({}, dumanImpressum, { sourceUrl: "https://example.test/impressum" }),
}, { ime: "", postnaStevilka: "", kraj: "" });
assert.strictEqual(identitetaSamoImpressum.status, "probable_impressum");
assert.strictEqual(identitetaSamoImpressum.source, "impressum");
assert.strictEqual(identitetaSamoImpressum.companyId, undefined);
assert.strictEqual(test.sestaviApiDokaziloIdentitete(identitetaSamoImpressum, openregisterIzklopljen), null);
assert.deepStrictEqual(test.dolociVirDokazilaIdentitete(identitetaSamoImpressum, openregisterIzklopljen, { status: "disabled" }, {
  sourceUrl: "https://example.test/impressum",
}), { sourceUrl: "https://example.test/impressum", sourceLabel: "Impressum podjetja" });
assert.match(apiSrc, /openregisterIdentitetaVklopljena && openregister\.status !== "found"/);
assert.match(apiSrc, /user_disabled_identity_lookup/);
assert.match(apiSrc, /uporabiOpenRegister: openregisterIdentitetaVklopljena/);
assert.match(apiSrc, /if \(!uporabiOpenRegister\)/);
assert.match(apiSrc, /"identity_evidence_unavailable"/);
assert.doesNotMatch(apiSrc.slice(apiSrc.indexOf("async function handler"), apiSrc.indexOf("handler._test")), /dolociPristojnoHwk|poisciPriHwk|manualHwkEvidence/);
assert.match(meni, /href="bonitetna-preverba\.html"/);
assert.match(meni, />Odpri bonitetni center</);
assert.match(meni, /id="boniteta-crif-toggle"[^>]*role="switch"[^>]*aria-checked="true"/);
assert.match(meni, /zascita-posla\.js\?v=20260817-crif-toggle-v1/);
assert.match(meniJs, /uj:boniteta:crif-elements-visible/);
assert.match(meniJs, /localStorage\.setItem/);
assert.doesNotMatch(meni, /href="boniteta-sredisce\.html"/);
assert.match(lokalniStreznik, /function osveziApiCeJeSpremenjen\(\)/);
assert.match(lokalniStreznik, /novaRazlicica === nalozenaApiRazlicica/);
assert.match(lokalniStreznik, /datoteka\.startsWith\(apiRoot\)[\s\S]*delete require\.cache\[datoteka\]/);
assert.match(lokalniStreznik, /const apiHandler = require\(modul\)/);
assert.match(appJs, /"\[data-fit-input\]"/);
assert.match(bonitetaCss, /\.stran--bonitetna \[hidden\][\s\S]*?display:\s*none !important/, "hidden mora ostati skrit tudi pri flex in grid komponentah");
assert.match(lokalniStreznik, /pathname === "\/api\/mehka-boniteta"/);
assert.match(lokalniStreznik, /apiHandler\(req, res\)/);
assert.match(lokalniStreznik, /pathname === "\/api\/mehka-boniteta-opravilo"/);
assert.match(lokalniStreznik, /pathname === "\/api\/mehka-boniteta-delavec"/);
assert.match(lokalniStreznik, /pathname === "\/api\/nemcija-posta"/);
assert.match(lokalniStreznik, /:\s*8001;/, "Lokalni strežnik mora privzeto uporabljati naslov aplikacije na vratih 8001.");
assert.match(packageJson, /"dev":\s*"node scripts\/local-server\.js --port 8001"/);
assert.match(lokalniStreznik, /const citajRacunModul = require\.resolve\("\.\.\/api\/citaj-racun"\)/);
assert.match(lokalniStreznik, /process\.env\.ANTHROPIC_API_KEY[\s\S]*izvediLokalniApi\(req, res, citajRacunModul\)/);
assert.doesNotMatch(js, /mock|lažni rezultat|demo rezultat/i);

console.log("✓ Mehka bonitetna preverba: parserji, odločanje in povezava v meni delujejo.");
