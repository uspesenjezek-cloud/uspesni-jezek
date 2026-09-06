"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var client = require("../api/_lib/apify-impressum-client");
var handler = require("../api/_handlers/mehka-boniteta")._test;

(async function () {
  var normalized = client.normalizeItem({
    companyName: "HKH Hanse Klempner GmbH",
    managingDirector: "Matthias Ehnts",
    address: "Wendenstraße 379, 20537 Hamburg",
    registrationNumber: "HRB 81625",
    registerCourt: "Amtsgericht Hamburg",
    vatId: "DE217908427",
    legalPageUrl: "https://www.hanse-klempner.de/impressum",
  });
  assert.deepStrictEqual(normalized, {
    legalName: "HKH Hanse Klempner GmbH", owner: "Matthias Ehnts", street: "Wendenstraße 379",
    postalCode: "20537", city: "Hamburg", sourceUrl: "https://www.hanse-klempner.de/impressum",
    registerNumber: "HRB 81625", registerCourt: "Amtsgericht Hamburg", vatId: "DE217908427",
  });
  var subject = handler.sestaviApifyImpressumSubjekt(normalized);
  assert.strictEqual(subject.entityType, "company");
  assert.strictEqual(subject.nosilec, "Matthias Ehnts");
  assert.strictEqual(subject.identityProvenance.status, "coherent");

  var mikuleckyAgent = handler.sestaviApifyImpressumSubjekt({
    owner: "Achim Mikulecky", street: "Lahnstr. 7", postalCode: "60326", city: "Frankfurt",
    sourceUrl: "https://autohaus-mikulecky.de/impressum/", vatId: "DE220287703",
  });
  var mikuleckyLocal = {
    entityType: "person", ime: "Achim Mikulecky", nosilec: "Achim Mikulecky",
    naslov: "Lahnstraße 7", postnaStevilka: "60326", kraj: "Frankfurt",
  };
  assert.strictEqual(handler.primerjajImpressumSubjekta(mikuleckyLocal, mikuleckyAgent).status, "matched",
    "lokalni parser in Impressum actor morata potrditi enak Mikulecky subjekt");
  assert.deepStrictEqual(handler.primerjajImpressumSubjekta(mikuleckyLocal,
    Object.assign({}, mikuleckyAgent, { naslov: "Druga ulica 9" })).mismatchedFields, ["street"],
  "različen actorjev naslov mora ostati jasno označen kot neujemanje");

  var soleTrader = client.normalizeItem({
    managingDirector: "Michael Wunderlich (Einzelunternehmer)", address: { street: "Julius-Vosseler-Straße 73D", postalCode: "22527", city: "Hamburg" },
    legalPageUrl: "https://example.test/impressum",
  });
  assert.strictEqual(soleTrader.street, "Julius-Vosseler-Straße 73D");
  assert.strictEqual(handler.sestaviApifyImpressumSubjekt(soleTrader).entityType, "person");

  var incompleteCandidate = client.normalizeItem({
    representative: "Liridon Rysha",
    legalPageUrl: "https://www.dr-performance.de/impressum",
  });
  assert.strictEqual(incompleteCandidate.owner, "Liridon Rysha");
  assert.strictEqual(incompleteCandidate.street, "");
  assert.strictEqual(incompleteCandidate.sourceUrl, "https://www.dr-performance.de/impressum");

  assert.strictEqual(client.normalizeItem({ companyName: "Test GmbH", address: "Teststraße 1, 20095 Hamburg" }), null, "brez pravega URL vira actorjev rezultat ni dokaz");
  assert.strictEqual(client.domainFromWebsite("https://www.example.de/angebot"), "example.de");
  assert.strictEqual(client.normalizedWebsiteUrl("https://www.example.de/angebot"), "https://www.example.de/angebot");
  assert.strictEqual(client._test.timeoutMs, 130000, "HTTP klic mora actorju pustiti celotni 120-sekundni čas");

  client._test.reset();
  var calls = 0;
  var paidCalls = 0;
  client._test.setFetch(async function (_url, options) {
    calls += 1;
    if (_url.includes("/users/me")) {
      assert.strictEqual(options.method, "GET");
      return new Response(JSON.stringify({ data: { username: "ruly_caviar_jhh" } }), { status: 200 });
    }
    paidCalls += 1;
    assert.match(_url, /timeout=120/, "Apify actor mora dobiti dovolj časa za kontaktni fallback");
    assert.match(_url, /memory=1024/, "actor mora uporabiti svojo privzeto količino pomnilnika");
    assert.match(options.body, /"domains":\["https:\/\/www\.example\.de\/"\]/,
      "actor mora dobiti celoten URL, ker je ta vhod v Web zagonu bistveno hitrejši od gole domene");
    assert.match(options.body, /"contactPageFallback":true/,
      "actor mora vedno imeti vključen uporabnikov kontaktni fallback");
    assert.match(options.body, /"maxItems":1/,
      "actor mora vedno vrniti največ en rezultat");
    assert.match(options.body, /"maxConcurrency":2/,
      "actor mora vedno uporabljati uporabnikovo hitrost 2");
    assert.match(options.body, /"useApifyProxy":false/,
      "hitri potrditveni tok ne sme prisilno uporabljati počasnega proxyja");
    return new Response(JSON.stringify([{ legalName: "Beispiel GmbH", address: "Musterstraße 1, 20095 Hamburg", legalPageUrl: "https://example.de/impressum" }]), { status: 200 });
  });
  var found = await client.findLegalNotice("https://www.example.de", { token: "apify_api_test" });
  assert.strictEqual(found.status, "found");
  assert.strictEqual((await client.findLegalNotice("https://example.de/andere-pot", { token: "apify_api_test" })).status, "found");
  assert.strictEqual(calls, 2, "pred enim plačljivim klicem se mora račun enkrat preveriti");
  assert.strictEqual(paidCalls, 1, "ista domena mora uporabiti kratek pozitiven cache");
  client._test.reset();

  var contactOnly = await client.findLegalNotice("https://repair.ivof.com/kfz-techniker-miszewski/", {
    token: "apify_api_test",
    fetch: async function (url) {
      if (url.includes("/users/me")) {
        return new Response(JSON.stringify({ data: { username: "ruly_caviar_jhh" } }), { status: 200 });
      }
      return new Response(JSON.stringify([{
        domain: "repair.ivof.com",
        companyName: "",
        address: "",
        legalPageUrl: "https://repair.ivof.com/kontakt",
        legalPageType: "contact",
        error: "page found but no fields extracted (may be JS-rendered)",
      }]), { status: 200 });
    },
  });
  assert.strictEqual(contactOnly.status, "not_found");
  assert.strictEqual(contactOnly.reason, "contact_page_only",
    "tehnično uspešen run s prazno kontaktno stranjo ne sme postati uspešen Impressum");
  assert.strictEqual(contactOnly.sourceUrl, "https://repair.ivof.com/kontakt");
  client._test.reset();

  var listingSignals = handler.razcleniJavnePoslovneSignale(
    "<title>Kfz-Techniker Miszewski – Repair</title><p>Mintarder Strasse 12, 45481 Mülheim an der Ruhr, DE</p><p>+492088821948</p>",
    "https://repair.ivof.com/kfz-techniker-miszewski/"
  );
  assert.strictEqual(listingSignals.name, "Kfz-Techniker Miszewski");
  assert.strictEqual(listingSignals.phoneKey, "8821948");
  assert.strictEqual(listingSignals.postalCode, "45481");
  assert.strictEqual(handler.odkritoUradnoUjemanje({
    entityType: "person", ime: "Norman Miszewski", naziv: "Norman Miszewski", nosilec: "Norman Miszewski",
    naslov: "Mintarder Straße 12a", postnaStevilka: "45481", kraj: "Mülheim", telefon: "02 08/88 21 948",
    identityProvenance: { status: "coherent" },
  }, listingSignals), true, "odkrit uradni Impressum mora ujemati telefon, pošto in razlikovalno ime");
  assert.strictEqual(handler.odkritoUradnoUjemanje({
    entityType: "person", ime: "Druga Oseba", naziv: "Druga Oseba", nosilec: "Druga Oseba",
    naslov: "Mintarder Straße 12a", postnaStevilka: "45481", kraj: "Mülheim", telefon: "02 08/88 21 948",
    identityProvenance: { status: "coherent" },
  }, listingSignals), false, "ista številka in naslov brez imenskega ujemanja ne smeta potrditi napačne osebe");

  var hammesSignals = handler.razcleniJavnePoslovneSignale(
    '<title>Udo Hammes Automotive Technician Workshop – Repair</title><p>Rosmarinstraße 31, 40235 Düsseldorf</p><p>2117308892</p>',
    'https://repair.ivof.com/kfz-techniker-werkstatt-udo-hammes/'
  );
  var hammesJsonLd = handler.razcleniJavnePoslovneSignale(
    '<title>Udo Hammes Kfz-Werkstatt</title><script type="application/ld+json">{"@type":"AutoRepair","name":"Udo Hammes Kfz-Werkstatt","telephone":"+492117308892","address":{"streetAddress":"Rosmarin Str. 31","postalCode":"40235","addressLocality":"Düsseldorf"}}</script>',
    'https://www.auto-werkstatt.de/duesseldorf/udo-hammes'
  );
  assert.strictEqual(hammesJsonLd.street, 'Rosmarin Str. 31');
  assert.strictEqual(handler.odkritoImeniskoUjemanje(hammesJsonLd, hammesSignals), true,
    'točen telefon, pošta, naslov in razlikovalno ime morajo potrditi imenik');
  var hammesTelefonbuch = handler.razcleniJavnePoslovneSignale([
    '<title>Scharfenberg Hammes KFZ-Meisterwerkstatt</title>',
    '<script>const entry = { generic: { name: "Scharfenberg Hammes KFZ-Meisterwerkstatt",',
    'street: "Rosmarinstr. 31", zip: "40235", city: "Düsseldorf",',
    'phones: ["+49 211 7308892"] }, trp: { param1: "new_U" } };</script>',
    '<span itemprop="telephone">0211 7 30 8<span style="display:none">&hellip;</span></span>8 92',
  ].join('\n'), 'https://adresse.dastelefonbuch.de/example');
  assert.strictEqual(hammesTelefonbuch.phoneKey, '7308892');
  assert.strictEqual(hammesTelefonbuch.street, 'Rosmarinstr. 31');
  assert.strictEqual(handler.odkritoImeniskoUjemanje(hammesTelefonbuch, hammesSignals), true,
    'razdeljen prikaz telefona v imeniku mora uporabiti njegov označeni poslovni blok');
  var hammesConsensus = handler.sestaviUjemajociImenikProfil([
    hammesJsonLd,
    Object.assign({}, hammesJsonLd, { sourceUrl: 'https://mobil.dasoertliche.de/Themen/Hammes' }),
  ], hammesSignals);
  assert(hammesConsensus && hammesConsensus.status === 'found');
  assert.strictEqual(hammesConsensus.subjekt.ime, 'Udo Hammes');
  assert.strictEqual(hammesConsensus.subjekt.sourceKind, 'verified_directory_profile');
  assert.strictEqual(handler.pripraviOpenRegisterVnosIzImpressuma({}, hammesConsensus.subjekt), null,
    'imeniski profil ne sme sprožiti fuzzy registrskega iskanja druge družbe');
  assert.strictEqual(handler.sestaviUjemajociImenikProfil([hammesJsonLd], hammesSignals), null,
    'en sam imenik nikoli ne sme zadostovati');

  var mismatchPaidCalls = 0;
  var mismatch = await client.findLegalNotice("https://mismatch.example", {
    token: "old-account-token",
    fetch: async function (url) {
      if (url.includes("/users/me")) {
        return new Response(JSON.stringify({ data: { username: "old_account" } }), { status: 200 });
      }
      mismatchPaidCalls += 1;
      return new Response("[]", { status: 200 });
    },
  });
  assert.strictEqual(mismatch.status, "unavailable");
  assert.strictEqual(mismatch.reason, "account_mismatch");
  assert.strictEqual(mismatchPaidCalls, 0, "napačen račun mora biti zavrnjen pred plačljivim POST-om");
  client._test.reset();

  var source = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta.js"), "utf8");
  assert.strictEqual((source.match(/apifyImpressum\.findLegalNotice\(/g) || []).length, 1,
    "Impressum actor mora imeti eno samo orkestracijsko točko");
  assert.match(source, /async function pridobiApifyImpressumProfil[\s\S]*apifyImpressum\.findLegalNotice\(spletnaStran\)/);
  assert.match(source, /async function potrdiImpressumZAgentom[\s\S]*agentovCilj = javniProfil\.sourceUrl \|\| spletnaStran[\s\S]*pridobiApifyImpressumProfil\(agentovCilj\)/,
    "naknadni actor mora potrditi že odkrit javni vir");
  assert.match(source, /id: "impressum_agent"[\s\S]*neodvisno razbral enako ime in celoten naslov/,
    "ujemanje actorja mora biti vidno kot ločen vir rezultata");
  var handlerFlow = source.slice(source.indexOf("async function handler(req, res)"), source.indexOf("handler._test"));
  assert.doesNotMatch(handlerFlow, /pridobiApifyImpressumProfil\(vnos\.spletnaStran\)/,
    "primarni uporabniški tok ne sme čakati actorja");
  assert.doesNotMatch(handlerFlow, /javniProfil\.subjekt && javniProfil\.subjekt\.sourceKind === "verified_directory_profile"\)\) \{/,
    "imenik ne sme biti izločen iz naknadne agentove potrditve");
  var workerSource = fs.readFileSync(path.join(__dirname, "..", "api", "mehka-boniteta-delavec.js"), "utf8");
  assert.ok(workerSource.indexOf("await queue.zakljuci(cfg, job") < workerSource.indexOf("await mehkaBoniteta.potrdiImpressumZAgentom"),
    "actor mora potrjevati šele po trajnem zaključku lokalnega rezultata");
  assert.doesNotMatch(workerSource, /sourceKind === "verified_directory_profile"/,
    "worker mora actor zagnati tudi za dvojno potrjen javni imenik");
  var jedro = source.slice(source.indexOf("async function poisciVImpressumuJedro"), source.indexOf("function frankfurtskaPosta"));
  assert.doesNotMatch(jedro, /crawler|scrapling|apifyImpressum|poisciImpressumZBrskalnikom/,
    "dejanski dokaz po OR miss ne sme ponovno odpreti starega fallback drevesa");
  var frontend = fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-preverba.js"), "utf8");
  assert.match(frontend, /contact_page_only:[^\n]*kontaktno stran brez pravnega imena in naslova/,
    "prazen kontaktni rezultat actorja mora biti pojasnjen kratko in brez izmišljene klasifikacije URL-ja");
  console.log("Apify Impressum client tests passed.");
})().catch(function (error) { console.error(error); process.exitCode = 1; });
