"use strict";

var assert = require("node:assert");
var test = require("../api/_handlers/mehka-boniteta")._test;

async function main() {
  var html = '<!doctype html><html><head><script type="application/ld+json">' +
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "KORO KFZ",
      address: "Merowingerstraße 55, 40225 Düsseldorf, Deutschland",
    }) +
    '</script></head><body><footer id="impressum"><h3>Impressum</h3><p>Die Geschäftsbezeichnung KORO KFZ wird von Deniz Köroglu für seinen Werkstattbetrieb, den er als hauptverantwortlicher Einzelunternehmer führt, verwendet.</p><p>USt-IdNr.: DE319390542</p></footer></body></html>';
  var subjekt = await test.razcleniPravniDokumentZRezervo({
    html: html,
    text: test.besediloIzHtml(html),
    finalUrl: "https://koro-kfz.de/#impressum",
  }, { spletnaStran: "https://koro-kfz.de/" }, null, { ocrText: "" });

  assert.equal(subjekt.ime, "Deniz Köroglu");
  assert.equal(subjekt.naziv, "KORO KFZ");
  assert.equal(subjekt.naslov, "Merowingerstraße 55");
  assert.equal(subjekt.postnaStevilka, "40225");
  assert.equal(subjekt.kraj, "Düsseldorf");
  assert.equal(subjekt.identityProvenance.status, "coherent");
  assert.equal(subjekt.identityProvenance.structuredAddressSource, "same_page_json_ld");

  var browser = await test.zazeniBrskalnikZaDokazilo();
  try {
    var page = await test.pripraviBrskalniskoStran(browser);
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
    await page.setContent('<!doctype html><html><head><style>body{margin:0}.bio{height:900px}.reviews{height:700px}.contact,.legal{padding:30px}</style></head><body>' +
      '<nav><a href="#impressum">IMPRESSUM</a></nav>' +
      '<section class="bio"><p>Mein Name ist Deniz Köroglu. Ich betreibe KORO KFZ.</p></section>' +
      '<section class="reviews">Kundenstimmen</section>' +
      '<section class="contact"><h2>So finden Sie uns</h2><p>KORO KFZ<br>Merowingerstraße 55<br>40225 Düsseldorf</p></section>' +
      '<section class="legal" id="impressum"><h5>Impressum</h5><p>Die Geschäftsbezeichnung KORO KFZ wird von Deniz Köroglu verwendet.</p><p>USt-IdNr.: DE319390542</p></section>' +
      '</body></html>', { waitUntil: "domcontentloaded" });
    var izrez = await test.dolociIzrezIdentitete(page, subjekt);
    assert.ok(izrez, "dokazni izrez mora obstajati");
    var vidnaVsebina = await test.preberiVidnoVsebinoIzreza(page, izrez);
    var validacija = test.validirajVsebinoPravnegaBloka(vidnaVsebina.oznake, vidnaVsebina.besedilo, subjekt);
    assert.equal(validacija.contentValidationStatus, "matched");
    assert.equal(validacija.provenanceStatus, "same_legal_block");
    assert.deepEqual(validacija.missingValidationFields, []);
    var celotnaStran = await test.zajemiCelotnoStranDokazila(page, izrez);
    assert.ok(celotnaStran.posnetek.length > 12000, "prikazano dokazilo mora vsebovati celotno stran");
    assert.ok(celotnaStran.fullPageHeight >= 1700, "celotna stran ne sme biti odrezana na validacijski izrez");
    assert.ok(celotnaStran.focusY > 0.7 && celotnaStran.focusY <= 1, "začetni fokus mora biti pri spodnjem Impressumu");
  } finally {
    await test.zapriBrskalnikZaDokazilo(browser);
  }
  console.log("✓ Impressum v sidru varno prevzame naslov istega podjetja iz JSON-LD iste strani.");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
