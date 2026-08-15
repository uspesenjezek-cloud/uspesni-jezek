"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var api = require("../api/mehka-boniteta");
var test = api._test;

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
var uradniKwasnitzaRezultat = [
  "Suchergebnis - Veröffentlichungsliste",
  "Kwasnitza Heizung & Sanitär GmbH Leverkusen",
  "70g IN 269/25 Köln HRB 116572",
].join("\n");
assert.strictEqual(test.presodiUradniInsolvencniRezultat(
  uradniKwasnitzaRezultat, kwasnitzaSubjekt, test.razcleniOpravilnoStevilko("70g IN 269/25")
).status, "confirmed_match");
assert.strictEqual(test.presodiUradniInsolvencniRezultat(
  "Suchergebnis\nIhre Suche ergab zu viele Treffer. Die maximale Trefferzahl beträgt 1000.", kwasnitzaSubjekt, null
).reason, "too_many_results");
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
var dumanZAgencijo = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Köksal Duman<br>Halmstraße 2<br>60437 Frankfurt am Main</p><p>Vertretungsberechtigte Geschäftsführer: Herr Köksal Duman</p><p>Konzeption, Grafik und Text: Agentur ID GmbH</p><p>Webdesign: GO: Grafik und Konzept GmbH</p></main>",
  "https://heizungsmeisterei-duman.de/impressum",
  { ime: "Heizungsmeisterei Duman", postnaStevilka: "60437", kraj: "Frankfurt am Main" }
);
assert.strictEqual(dumanZAgencijo.ime, "Köksal Duman");
assert.strictEqual(dumanZAgencijo.naziv, "Heizungsmeisterei Duman", "Spletna agencija ne sme postati pravno ime obrtnika.");
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
  ["Vorstand: Dr. Maria Beispiel", "Dr. Maria Beispiel"],
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
assert.strictEqual(test.jeVerjetnoImeOsebe("Holger Jansen Haustechnik"), false);
assert.strictEqual(test.jeVerjetnoImeOsebe("max mustermann"), false);
assert.strictEqual(test.jeVerjetnoImeOsebe("Max Peter Paul Mustermann"), false);
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
var jansenImpressum = test.razcleniImpressum(
  "<main><h1>Impressum</h1><p>Holger Jansen Haustechnik<br>Merowinger Str. 51<br>40225 D\u00fcsseldorf</p><p>Inhaltlich verantwortlich: Holger Jansen</p></main>",
  "https://jansenhaustechnik.de/impressum",
  { ime: "Holger Jansen Haustechnik", postnaStevilka: "40225", kraj: "D\u00fcsseldorf" }
);
assert.strictEqual(jansenImpressum.ime, "Holger Jansen");
assert.strictEqual(jansenImpressum.postnaStevilka, "40225");
assert.strictEqual(jansenImpressum.kraj, "D\u00fcsseldorf");
var kerkmannImpressum = test.razcleniImpressum(
  "<title>Impressum - U.K. Udo Kerkmann e.K.</title><main><h1>Impressum</h1><p>U.K. Udo Kerkmann e.K.<br>Inhaber Stefan Krause<br>W\u00f6rthstr. 1<br>40476 D\u00fcsseldorf</p><p>Registernummer: HRA 17175<br>Registergericht: Amtsgericht D\u00fcsseldorf</p></main>",
  "https://udo-kerkmann.com/impressum/",
  { ime: "", postnaStevilka: "40476", kraj: "D\u00fcsseldorf" }
);
assert.strictEqual(kerkmannImpressum.ime, "Stefan Krause");
assert.strictEqual(kerkmannImpressum.naziv, "U.K. Udo Kerkmann e.K.");
assert.strictEqual(kerkmannImpressum.registerNumber, "HRA 17175");
assert.strictEqual(test.pocistiRegistrskoSodisce(kerkmannImpressum.registerCourt), "D\u00fcsseldorf");
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
});
assert.deepStrictEqual(test.najdiImpressumPovezave(
  '<a href="https://jshaustechnik.live-website.com/impressum/">Impressum</a>',
  "https://jshaustechnik.de/ueber-uns/"
), ["https://jshaustechnik.live-website.com/impressum/"]);
assert.deepStrictEqual(test.najdiImpressumPovezave(
  '<footer><a href="/referenzen-copy/">Impressum</a></footer>',
  "https://www.mattei-haustechnik.de/"
), ["https://www.mattei-haustechnik.de/referenzen-copy/"]);
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

var viri = test.sestaviVire(
  { status: "not_configured", sourceUrl: "https://openregister.de" },
  { status: "not_found", searchUrl: "https://hwk.example/search" },
  { status: "found", subjekt: impressum, sourceUrl: impressum.sourceUrl },
  { ime: "M.A.Services24", postnaStevilka: "63067", kraj: "Offenbach am Main", spletnaStran: "ma-services24.de" }
);
assert.deepStrictEqual(viri.map(function (vir) { return vir.id; }), ["openregister", "impressum", "gewerbe"]);
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
assert.strictEqual(test.sestaviSklep(potrjenDuman.identity, { status: "clear" }).level, "yellow");
assert.strictEqual(test.sestaviSklep(potrjenDuman.identity, { status: "possible_match" }).level, "red");
assert.strictEqual(test.sestaviSklep(dumanIdentiteta, { status: "not_checked", reason: "identity_evidence_unavailable" }).title, "Vira ni bilo mogoče prikazati");
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
var meni = fs.readFileSync(path.join(koren, "app", "zascita-posla.html"), "utf8");
var appJs = fs.readFileSync(path.join(koren, "app", "app.js"), "utf8");
var lokalniStreznik = fs.readFileSync(path.join(koren, "scripts", "local-server.js"), "utf8");
var apiSrc = fs.readFileSync(path.join(koren, "api", "mehka-boniteta.js"), "utf8");
assert.match(html, /id="boniteta-obrazec"/);
assert.match(html, /id="boniteta-viri"/);
assert.match(html, /id="boniteta-brez-spletne"/);
assert.match(html, /id="boniteta-kraj-izbira"/);
assert.doesNotMatch(html, /id="boniteta-kraj"[^>]*required/);
assert.doesNotMatch(html, /id="boniteta-naslov-podjetja"[^>]*required/);
assert.match(html, /id="boniteta-insolvenca-podatki"/);
assert.match(html, /id="boniteta-insolvenca-posnetek"/);
assert.match(html, /id="boniteta-identiteta-posnetek"/);
assert.match(html, /id="boniteta-identiteta-slika"/);
assert.match(html, /id="boniteta-potrditev-identitete"/);
assert.match(html, /id="boniteta-potrdi-ime"[^>]*data-fit-input/);
assert.match(html, /id="boniteta-potrdi-naslov"[^>]*data-fit-input/);
assert.match(html, /id="boniteta-potrditev-gumb"/);
assert.match(html, /Ročno preveri v uradnem insolvenčnem registru/);
assert.match(html, /id="boniteta-insolvenca-api-vir"/);
assert.ok(html.indexOf('id="boniteta-spletna-stran"') < html.indexOf('id="boniteta-posta"'), "Spletna stran mora biti takoj za identiteto in pred lokacijo.");
assert.match(js, /fetch\("\/api\/mehka-boniteta"/);
assert.match(js, /Vnesite spletno stran ali kliknite/);
assert.match(js, /potrjenoBrezSpletne/);
assert.match(js, /fetch\("\/api\/nemcija-posta\?postalCode="/);
assert.match(js, /Ta poštna številka ima več krajev – izberite pravilnega/);
assert.match(js, /boniteta-kraj-izbira__gumb/);
assert.match(js, /naslov: rocniNaslov/);
assert.match(js, /izrisiVire\(podatki\.sources\)/);
assert.match(js, /evidenceStatus === "verified_api"/);
assert.match(js, /insolvenca\.apiSourceUrl/);
assert.match(js, /OpenRegister Insolvency API/);
assert.match(js, /uradnaPotrditev\.evidenceImage/);
assert.match(js, /dokaziloIdentitete\.imageDataUrl/);
assert.match(js, /Neposredno prek OpenRegister API/);
assert.match(js, /confirmedIdentity/);
assert.match(js, /companyId: zadnjaOpenRegisterReferenca/);
assert.match(js, /Podatki so pravilni – preveri insolventnost/);
assert.doesNotMatch(js, /manualHwkEvidence|Nadaljuj v uradnem HWK iskanju/);
assert.match(apiSrc, /OPENREGISTER_INSOLVENCY_SEARCH/);
assert.match(apiSrc, /sestaviOpenRegisterInsolvencnoIskanje/);
assert.match(apiSrc, /pridobiOpenRegisterInsolvencnePodrobnosti/);
assert.match(apiSrc, /apiEvidence/);
assert.match(apiSrc, /preveriUradniInsolvencniPortal/);
assert.match(apiSrc, /presodiUradniInsolvencniRezultat/);
assert.match(apiSrc, /zajemiDokaziloIdentitete/);
assert.match(apiSrc, /async function sprejmiPiskotke/);
assert.match(apiSrc, /async function dolociIzrezIdentitete/);
assert.match(apiSrc, /clip: izrez/);
assert.doesNotMatch(apiSrc.slice(apiSrc.indexOf("async function zajemiDokaziloIdentitete"), apiSrc.indexOf("function sestaviOpenRegisterInsolvencnoIskanje")), /fullPage:\s*true/);
assert.match(apiSrc, /status: "verified_api"/);
assert.match(apiSrc, /confirmationRequired: true/);
assert.match(apiSrc, /reason: "temporarily_disabled"/);
assert.match(apiSrc, /pripraviPotrditevIdentitete\(telo, identiteta\)/);
assert.match(apiSrc, /pripraviOpenRegisterVnosZaPotrditev\(telo, vnos\)/);
assert.match(apiSrc, /"identity_evidence_unavailable"/);
assert.doesNotMatch(apiSrc.slice(apiSrc.indexOf("async function handler"), apiSrc.indexOf("handler._test")), /dolociPristojnoHwk|poisciPriHwk|manualHwkEvidence/);
assert.match(meni, /href="bonitetna-preverba\.html"/);
assert.match(appJs, /"\[data-fit-input\]"/);
assert.match(lokalniStreznik, /pathname === "\/api\/mehka-boniteta"/);
assert.match(lokalniStreznik, /mehkaBonitetaHandler\(req, res\)/);
assert.match(lokalniStreznik, /pathname === "\/api\/nemcija-posta"/);
assert.doesNotMatch(js, /mock|lažni rezultat|demo rezultat/i);

console.log("✓ Mehka bonitetna preverba: parserji, odločanje in povezava v meni delujejo.");
