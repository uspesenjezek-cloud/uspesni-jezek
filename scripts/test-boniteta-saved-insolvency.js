"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var root = path.join(__dirname, "..");
var preverba = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.js"), "utf8");
var profil = fs.readFileSync(path.join(root, "app", "boniteta-profil.js"), "utf8");
var sredisce = fs.readFileSync(path.join(root, "app", "boniteta-sredisce.js"), "utf8");
var html = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.html"), "utf8");
var opraviloHandler = fs.readFileSync(path.join(root, "api", "_handlers", "mehka-boniteta-opravilo.js"), "utf8");
var lokalnoOpravilo = fs.readFileSync(path.join(root, "api", "mehka-boniteta-opravilo.js"), "utf8");
var hramba = require(path.join(root, "app", "boniteta-dokazna-hramba.js"));
var mehkaBonitetaTest = require(path.join(root, "api", "_handlers", "mehka-boniteta.js"))._test;

assert.match(preverba, /queueJobId:\s*zadnjiJobId/, "Zaključena preverba mora shraniti varno referenco na dokazno opravilo.");
assert.match(preverba, /entityType:\s*identiteta\.entityType/, "Vrsta identitete mora ostati shranjena tudi za osebe.");
assert.match(preverba, /mehka-boniteta-opravilo\?profileId=/, "Stari profili morajo imeti varen fallback za iskanje lastnega dokazila.");
assert.match(preverba, /kandidat\.status === "completed"/, "Ponovno odpiranje sme uporabiti samo zaključeno opravilo.");
assert.match(preverba, /imaUradniInsolvencniPosnetek\(kandidat\.result\)/, "Obnovljeni rezultat mora vsebovati dejanski uradni posnetek.");
assert.match(preverba, /section === "insolvency" && imaUradniInsolvencniPosnetek\(rezultatZDokazilom\)\) nastaviInsolvencnoOkno\(true, true\)/, "Zgodovinska insolvenčna pot sme odpreti dokazni pogled samo z uradnim posnetkom.");
assert.match(preverba, /izidJePotrjen \? "BREZ OBJAVE"/);
assert.match(preverba, /shranjenaUradnaPolja\.ime[\s\S]*?\? "person"/, "Stari profil mora osebno identiteto rekonstruirati iz uradno preverjenega ločenega imena.");
assert.match(preverba, /shranjenoOsebnoIme = \[shranjenaUradnaPolja\.ime, shranjenaUradnaPolja\.firmaPriimek\]/, "Ime in priimek morata v podatkovni logiki ostati ločena, za prikaz pa se smeta združiti.");
assert.match(preverba, /var entityType = companyId \|\| imaPravnoOblikoDruzbe[\s\S]*?\? "company"/, "Stari profil z OpenRegister ID-jem ali pravno obliko družbe se mora vedno odpreti kot podjetje.");
assert.match(preverba, /var identityStatus = companyId[\s\S]*?\? "verified_register"/, "OpenRegister ID mora preglasiti zastareli status starega profila.");
assert.match(preverba, /openRegisterCompanyId:\s*profile\.company_id \|\| ""[\s\S]*?uporabiOpenRegisterIdentiteto:\s*Boolean\(profile\.company_id\)/, "Obnovljen registrski profil mora ohraniti uradni ID tudi za naslednjo poizvedbo.");
assert.match(preverba, /generacijaNeposredneZahteve !== generacijaNeposredneInsolvence\) return/, "Pozen odgovor prejšnjega profila ne sme prepisati trenutno odprtega profila.");
assert.match(preverba, /mojaGeneracijaOdpiranja !== generacijaOdpiranjaShranjengaProfila\) return/, "Počasnejše odpiranje starega profila ne sme prepisati novejšega izbora.");
assert.match(preverba, /if \(fallback\.identity && fallback\.identity\.companyId\)[\s\S]*?Object\.assign\(\{\}, job\.result\.identity \|\| \{\}, fallback\.identity\)/, "Staro opravilo sme obnoviti dokaz, ne sme pa prepisati uradne identitete shranjenega podjetja.");
assert.match(preverba, /if \(zacetnoIme && heroSpletnaPolje\)[\s\S]*?heroSpletnaPolje\.value = zacetnoIme/, "Ponovitev po imenu mora predizpolniti zgornje iskalno polje.");
assert.doesNotMatch(preverba, /if \(zacetnoIme[^}]*nastaviNacinVnosa\("rocno"\)/, "Osvežitev ne sme samodejno odpreti ročnega vnosa.");
assert.match(preverba, /imaWildcardIme && potrjenoPravnoIme && normalizirajAutocompleteBesede\(potrjenoPravnoIme\) !== normalizirajAutocompleteBesede\(prikazanoIskalnoIme\)/, "Obnovljeni profil mora wildcard in potrjeno ime primerjati z obstoječo skupno normalizacijo.");
assert.doesNotMatch(preverba, /(^|[^\w])normaliziraj\(/, "Izris shranjenega profila ne sme klicati neobstoječe funkcije normaliziraj.");
assert.match(profil, /shranjeniSection=initialSection\|\|params\.get\("section"\)\|\|"overview"[\s\S]*?await window\.UJBonitetaPrikaziShranjeniProfil\(profile,shranjeniSection,shranjeniOptions\)/, "Splošni profil mora ostati privzeti cilj povezave brez izrecnega sklopa.");
assert.match(profil, /init\(profileId,params\.get\("section"\)\|\|"overview"\)/, "Začetni nalagalnik mora neposredno profilno povezavo odpreti v pregledu.");
assert.match(html, /bonitetna-preverba\.js\?v=[^"']+-v\d+/);
assert.match(html, /boniteta-profil\.js\?v=[^"']+-v\d+/);
assert.match(sredisce, /saved-preview/);
assert.match(sredisce, /UJBonitetaPrikaziShranjeniProfil[\s\S]*?"insolvency"/);
assert.match(sredisce, /insolvencyHref=profileHref\.replace\("#new","&section=insolvency#new"\)/, "Zgodovinska akcija v Podjetjih mora v URL zapisati insolvenčni sklop.");
assert.match(sredisce, /function companyCard\(p\)[\s\S]*?&section=overview#new[\s\S]*?Preveri zadnje stanje/, "Preveri zadnje stanje mora odpreti splošni profil.");
assert.match(sredisce, /function monitoringResultHtml[\s\S]*?overviewHref=profileHref\.replace\("#new","&section=overview#new"\)[\s\S]*?currentHref=overviewHref[\s\S]*?previousHref=overviewHref/, "Trenutni in prejšnji monitoring posnetek morata odpreti profilni pregled.");
assert.match(sredisce, /section=target\.searchParams\.get\("section"\)\|\|"overview"[\s\S]*?UJBonitetaOdpriProfil\(id,section\)/, "Klikovni handler mora ohraniti izrecno preslikavo akcije in privzeti pregled.");
assert.match(sredisce, /function jeNedokoncanaInsolvencnaZgodovina[\s\S]*?Preveri insolventnost[\s\S]*?Manjka uradni dokazni posnetek/, "Podjetje brez uradnega posnetka ne sme ponujati lažne zgodovinske strani.");
assert.match(html, /boniteta-sredisce\.js\?v=[^"']+-v\d+/, "Središče mora ohraniti cache-busting različico brez vezave testa na tujo spremembo.");
assert.match(preverba, /UJBonitetaDokaznaHramba\.shrani\(uporabnikZaDokaz\.id,\s*shranjeno\.profile\.id,\s*podatki\.insolvency\)/, "Dejanski uradni posnetek se mora po shranitvi profila zapisati v trajno lokalno hrambo.");
assert.match(preverba, /UJBonitetaDokaznaHramba\.preberi\(uporabnikZaDokaz\.id,\s*profile\.id\)/, "Ponovno odprt profil mora najprej preveriti trajno lokalno dokazilo istega uporabnika.");
assert.match(preverba, /UJBonitetaDokaznaHramba\.shrani\(uporabnikPoVrsti\.id,\s*profile\.id,\s*polniRezultat\.insolvency\)/, "Oddaljeno obnovljeno dokazilo se mora shraniti tudi kot lokalna trajna rezerva.");
assert.match(sredisce, /UJBonitetaDokaznaHramba\.izbrisi\(uporabnik\.id,\s*button\.dataset\.deleteProfile\)/, "Izbris profila mora odstraniti tudi lokalni dokaz istega uporabnika.");
assert.match(html, /boniteta-dokazna-hramba\.js\?v=[^"']+[\s\S]*bonitetna-preverba\.js/, "Dokazna hramba mora biti naložena pred glavnim tokom preverbe.");
assert.match(preverba, /function prikazljivUradniInsolvencniPosnetek\(official\)[\s\S]*?jpeg\|png\|webp/, "Renderer mora vse varne rastrske formate preveriti v enem skupnem helperju.");
assert.match(preverba, /var prikazljivPosnetek = prikazljivUradniInsolvencniPosnetek\(uradnaPotrditev\)/, "Prikaz posnetka mora uporabiti skupni strogi helper.");
assert.match(preverba, /function imaUradniInsolvencniPosnetek\(podatki\)[\s\S]*?prikazljivUradniInsolvencniPosnetek\(official\)/, "Hidracija ne sme sprejeti dokazila, ki ga renderer ne more prikazati.");
assert.match(preverba, /function uskladiCasZUradnimInsolvencnimDokazom[\s\S]*?podatki\.checkedAt = official\.checkedAt/, "Čas profila mora po obnovi kazati čas dejanskega uradnega posnetka, ne novejšega neuspelega poskusa.");
assert.match(preverba, /\["clear", "possible_match"\]\.includes\(zLokalnimDokazom\.insolvency\.status\)[\s\S]*?imaUradniInsolvencniPosnetek\(zLokalnimDokazom\)/, "Neuspešen lokalni zapis ne sme prekriti starejšega veljavnega rezultata iz vrste.");
assert.match(preverba, /var jeZakljucenShranjeniRezultat = jeZakljucenShranjeniInsolvencniRezultat\(podatki\)/, "Glavni izris mora uporabljati eno strogo pravilo za zaključen shranjeni rezultat.");
assert.match(preverba, /imaPrikazljivUradniPosnetek \|\| jeZakljucenShranjeniRezultat/, "Živi rezultat mora še vedno zahtevati dokazni posnetek, shranjeni terminalni rezultat pa svojo dokazano časovno sled.");
assert.match(preverba, /izrisi\(rezultatZDokazilom\);\s*uveljaviZakljucenShranjeniInsolvencniRezultat\(rezultatZDokazilom\)/, "Po vsakem izrisu shranjenega profila se mora ponovno uveljaviti terminalni rezultat.");
assert.match(preverba, /function uveljaviZakljucenShranjeniInsolvencniRezultat[\s\S]*?zadnjiInsolvencniRezultatPripravljen = true;[\s\S]*?nastaviKarticoInsolvenceZakljuceno\(podatki\)/, "Runtime varovalka mora obnoviti stanje in zaključeno kartico.");
assert.match(preverba, /options && options\.monitoring[\s\S]*?boniteta-eno-spremljaj[\s\S]*?hidden = true/, "Že spremljani profil ne sme znova ponujati gumba Spremljaj podjetje.");
assert.doesNotMatch(preverba, /insolvencniStatus === "unavailable" \|\|/, "Unavailable ne sme več postati zaključen insolvenčni rezultat.");
assert.match(preverba, /if \(job\.status === "failed"\) \{\s*throw new Error/, "Neuspešno opravilo tudi z delnim payloadom ne sme nadaljevati v shranjevanje rezultata.");
assert.match(preverba, /function nastaviKarticoInsolvenceNedokoncano[\s\S]*?manjka uradni dokazni posnetek/, "Nedokončana preverba mora ostati razložena v profilu brez posebne rezultatne strani.");
assert.match(preverba, /Uradni posnetek ni na voljo[\s\S]*?Rezultat brez prikazljivega uradnega posnetka ni dokončan\. Preverjanje ponovite\./, "Manjkajoče dokazilo mora ustvariti jasno rumeno opozorilo za ponovitev.");
assert.strictEqual(hramba._test.kljuc("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"), "11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222");
assert.strictEqual(hramba._test.kljuc("neveljaven", "22222222-2222-4222-8222-222222222222"), "", "Dokaz se ne sme shraniti brez veljavne uporabniške izolacije.");
assert.ok(hramba._test.podatkiSlike("data:image/jpeg;base64,QUJD"), "Veljaven JPEG data URL mora biti sprejet.");
assert.strictEqual(hramba._test.podatkiSlike("data:image/jpeg;base64,QUJD").mimeType, "image/jpeg");
assert.strictEqual(hramba._test.podatkiSlike("data:image/png;base64,QUJD").mimeType, "image/png", "Veljaven PNG mora ohraniti svoj MIME tip.");
assert.strictEqual(hramba._test.podatkiSlike("data:image/webp;base64,QUJD").mimeType, "image/webp", "Veljaven WebP mora ohraniti svoj MIME tip.");
assert.strictEqual(hramba._test.podatkiSlike("data:image/svg+xml;base64,QUJD"), null, "SVG ne sme postati uradno dokazilo.");
assert.strictEqual(hramba._test.podatkiSlike("data:image/png;base64,ni veljavno"), null, "Sintaktično neveljaven base64 mora biti zavrnjen.");
assert.strictEqual(mehkaBonitetaTest.razlogNapakeUradnegaInsolvencnegaPortala(new Error("Navigation timeout of 25000 ms exceeded")), "official_portal_timeout");
assert.strictEqual(mehkaBonitetaTest.razlogNapakeUradnegaInsolvencnegaPortala(new Error("Failed to launch the browser process")), "browser_launch_failed");
assert.strictEqual(mehkaBonitetaTest.razlogNapakeUradnegaInsolvencnegaPortala(new Error("Page screenshot failed")), "evidence_capture_failed");
assert.match(opraviloHandler, /userToken:\s*auth\.token/, "Fallback mora Supabase brati z isto prijavljeno uporabniško sejo.");
assert.match(opraviloHandler, /forceRemoteQueue:\s*true/, "Lokalni fallback mora preveriti trajno uporabniško vrsto, ne praznega pomnilnika po ponovnem zagonu.");
assert.match(lokalnoOpravilo, /forceRemoteQueue:\s*process\.env\.MEHKA_BONITETA_IN_MEMORY_QUEUE !== "true"/, "Lokalni strežnik mora pred ponovnim zagonom prebrati svoj še živi pomnilniški rezultat.");

var guardSource = preverba.match(/function jeZakljucenShranjeniInsolvencniRezultat\(podatki\) \{[\s\S]*?\n  \}/);
assert(guardSource, "Stroga varovalka za shranjeni insolvenčni rezultat mora obstajati.");
var guardContext = {};
vm.runInNewContext(guardSource[0] + "; this.guard = jeZakljucenShranjeniInsolvencniRezultat;", guardContext);
var guardCases = [
  ["clear/top-level čas", { __shranjeniProfil: true, checkedAt: "2026-08-27T10:00:00Z", insolvency: { status: "clear" } }, true],
  ["clear/čas insolvence", { __shranjeniProfil: true, insolvency: { status: "clear", checkedAt: "2026-08-27T10:00:00Z" } }, true],
  ["clear/čas uradnega dokaza", { __shranjeniProfil: true, insolvency: { status: "clear", officialVerification: { checkedAt: "2026-08-27T10:00:00Z" } } }, true],
  ["possible_match/top-level čas", { __shranjeniProfil: true, checkedAt: "2026-08-27T10:00:00Z", insolvency: { status: "possible_match" } }, true],
  ["possible_match/čas insolvence", { __shranjeniProfil: true, insolvency: { status: "possible_match", checkedAt: "2026-08-27T10:00:00Z" } }, true],
  ["possible_match/čas uradnega dokaza", { __shranjeniProfil: true, insolvency: { status: "possible_match", officialVerification: { checkedAt: "2026-08-27T10:00:00Z" } } }, true],
  ["živ clear rezultat", { checkedAt: "2026-08-27T10:00:00Z", insolvency: { status: "clear" } }, false],
  ["shranjeni clear brez časa", { __shranjeniProfil: true, insolvency: { status: "clear" } }, false],
  ["zahtevana potrditev", { __shranjeniProfil: true, confirmationRequired: true, checkedAt: "2026-08-27T10:00:00Z", insolvency: { status: "clear" } }, false],
  ["unavailable", { __shranjeniProfil: true, checkedAt: "2026-08-27T10:00:00Z", insolvency: { status: "unavailable" } }, false],
  ["failed", { __shranjeniProfil: true, checkedAt: "2026-08-27T10:00:00Z", insolvency: { status: "failed" } }, false],
  ["error", { __shranjeniProfil: true, checkedAt: "2026-08-27T10:00:00Z", insolvency: { status: "error" } }, false],
  ["not_checked", { __shranjeniProfil: true, checkedAt: "2026-08-27T10:00:00Z", insolvency: { status: "not_checked" } }, false],
  ["prazen status", { __shranjeniProfil: true, checkedAt: "2026-08-27T10:00:00Z", insolvency: {} }, false],
];
guardCases.forEach(function (testCase) {
  assert.strictEqual(Boolean(guardContext.guard(testCase[1])), testCase[2], "Varovalka: " + testCase[0]);
});

var stariKlopZapis = mehkaBonitetaTest.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "Klop GmbH", businessName: "Klop GmbH", representativeName: "Klop, Teunis",
  street: "Am Burgacker 37", postalCode: "47051", city: "Duisburg", confirmed: true,
} }, {
  status: "verified_register", entityType: "company", ime: "Klop GmbH", naziv: "Klop GmbH",
  naslov: "Am Burgacker 37", postnaStevilka: "47051", kraj: "Duisburg",
  companyId: "DE-HRB-R1202-23150", vloge: [{ ime: "Klop, Teunis", vloga: "Managing Director" }],
  zastopniki: ["Klop, Teunis"],
});
assert.strictEqual(stariKlopZapis.status, "valid", "Stari registrski zapis Priimek, Ime ne sme blokirati družbe.");
var stariSplosniZapis = mehkaBonitetaTest.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "Musterbau GmbH", businessName: "Musterbau GmbH", representativeName: "Mustermann, Erika",
  street: "Musterstraße 12", postalCode: "10115", city: "Berlin", confirmed: true,
} }, {
  status: "verified_register", entityType: "company", ime: "Musterbau GmbH", naziv: "Musterbau GmbH",
  naslov: "Musterstraße 12", postnaStevilka: "10115", kraj: "Berlin",
  companyId: "DE-HRB-F1103-123456", vloge: [{ ime: "Mustermann, Erika", vloga: "Geschäftsführung" }],
});
assert.strictEqual(stariSplosniZapis.status, "valid", "Varovalka mora delovati za vse primerljive stare zapise, ne samo za Klop GmbH.");

var strukturiranoDokazilo = { evidenceReady: true, evidenceKind: "structured_api" };
var trenutnaZiegIdentiteta = {
  status: "verified_register", entityType: "company",
  ime: "Zieg & Liphardt GmbH & Co. KG", naziv: "Zieg & Liphardt GmbH & Co. KG",
  naslov: "Neuhofstraße 43", postnaStevilka: "60318", kraj: "Frankfurt am Main",
  companyId: "DE-HRA-F1103-19176", legalForm: "GmbH & Co. KG",
  registerNumber: "HRA 19176",
};
var stariZiegProfil = mehkaBonitetaTest.pripraviPotrditevIdentiteteZaZahtevo({
  openRegisterCompanyId: "DE-HRA-F1103-19176",
  confirmedIdentity: {
    companyId: "DE-HRA-F1103-19176", confirmed: true,
    name: "Zieg &amp; Liphardt GmbH &amp; Co KG",
    businessName: "Zieg &amp; Liphardt GmbH &amp; Co KG",
    street: "Neuhofstr. 43", postalCode: "60318", city: "Frankfurt",
  },
}, trenutnaZiegIdentiteta, strukturiranoDokazilo, null);
assert.strictEqual(stariZiegProfil.status, "valid", "Stari Zieg profil z istim companyId mora uporabiti aktualno uradno identiteto.");
assert.strictEqual(stariZiegProfil.identity.ime, "Zieg & Liphardt GmbH & Co. KG", "V poizvedbo mora iti sveži uradni naziv, ne stari HTML zapis.");
assert.strictEqual(stariZiegProfil.identity.naslov, "Neuhofstraße 43", "V poizvedbo mora iti sveži uradni naslov.");
assert.strictEqual(stariZiegProfil.identity.verificationMode, "openregister_automatic");

var stariSplosniProfilZIstimId = mehkaBonitetaTest.pripraviPotrditevIdentiteteZaZahtevo({
  openRegisterCompanyId: "DE-HRB-B1101-654321",
  confirmedIdentity: {
    companyId: "DE-HRB-B1101-654321", confirmed: true,
    name: "Altbau GmbH", businessName: "Altbau GmbH",
    street: "Stara ulica 1", postalCode: "10115", city: "Berlin",
  },
}, {
  status: "verified_register", entityType: "company", ime: "Musterbau GmbH", naziv: "Musterbau GmbH",
  naslov: "Neue Straße 12", postnaStevilka: "10117", kraj: "Berlin",
  companyId: "DE-HRB-B1101-654321", legalForm: "GmbH", registerNumber: "HRB 654321",
}, strukturiranoDokazilo, null);
assert.strictEqual(stariSplosniProfilZIstimId.status, "valid", "Vsak stari profil z istim companyId mora prevzeti aktualno strukturirano registrsko identiteto.");
assert.strictEqual(stariSplosniProfilZIstimId.identity.ime, "Musterbau GmbH");

var napacenCompanyId = mehkaBonitetaTest.pripraviPotrditevIdentiteteZaZahtevo({
  openRegisterCompanyId: "DE-HRB-B1101-999999",
  confirmedIdentity: {
    companyId: "DE-HRB-B1101-999999", confirmed: true,
    name: "Musterbau GmbH", businessName: "Musterbau GmbH",
    street: "Neue Straße 12", postalCode: "10117", city: "Berlin",
  },
}, stariSplosniProfilZIstimId.identity, strukturiranoDokazilo, null);
assert.deepStrictEqual(napacenCompanyId, {
  status: "invalid", reason: "official_company_id_mismatch",
}, "Drug companyId mora ostati zavrnjen in fail-closed.");

process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = "true";
var queue = require(path.join(root, "api", "_lib", "mehka-boniteta-queue"));
queue._test.ponastaviPomnilnik();

var userId = "00000000-0000-0000-0000-000000000001";
var profile = {
  id: "11111111-1111-1111-1111-111111111111",
  legal_name: "Einzelunternehmen",
  address: { postal_code: "14057", city: "Berlin" },
  latest_check: {
    insolvency: {
      searchedPostalCode: "14057",
      officialVerification: {
        inputVerification: { fields: { ime: "Fahrudin", firmaPriimek: "Klee", kraj: "Berlin", postnaStevilka: "14057" } },
      },
    },
  },
};
var evidenceImage = "data:image/png;base64,QUJDREVGRw==";
queue._test.pomnilnik.jobs.set("22222222-2222-2222-2222-222222222222", {
  id: "22222222-2222-2222-2222-222222222222",
  user_id: userId,
  faza: "insolvenca",
  status: "completed",
  request_payload: { ime: "Fahrudin Klee", postnaStevilka: "14057", kraj: "Berlin" },
  result_payload: {
    identity: { ime: "Fahrudin Klee", entityType: "natural_person" },
    insolvency: { status: "clear", officialVerification: { evidenceStatus: "captured", evidenceImage: evidenceImage } },
  },
  created_at: "2026-08-25T08:00:00.000Z",
  updated_at: "2026-08-25T08:01:00.000Z",
  finished_at: "2026-08-25T08:01:00.000Z",
});
queue._test.pomnilnik.jobs.set("33333333-3333-3333-3333-333333333333", {
  id: "33333333-3333-3333-3333-333333333333",
  user_id: "99999999-9999-9999-9999-999999999999",
  status: "completed",
  request_payload: { ime: "Fahrudin Klee", postnaStevilka: "14057" },
  result_payload: { insolvency: { officialVerification: { evidenceImage: "data:image/png;base64,napacen-uporabnik" } } },
  finished_at: "2026-08-25T09:00:00.000Z",
});
queue._test.pomnilnik.jobs.set("44444444-4444-4444-4444-444444444444", {
  id: "44444444-4444-4444-4444-444444444444",
  user_id: userId,
  faza: "insolvenca",
  status: "completed",
  request_payload: { ime: "Fahrudin Klee", postnaStevilka: "14057", kraj: "Berlin" },
  result_payload: { ok: true, identity: { ime: "Fahrudin Klee" }, insolvency: { status: "unavailable", reason: "capture_or_search_failed" } },
  created_at: "2026-08-25T10:00:00.000Z",
  updated_at: "2026-08-25T10:01:00.000Z",
  finished_at: "2026-08-25T10:01:00.000Z",
});

(async function () {
  var job = await queue.pridobiNajnovejseZaProfil(null, userId, profile);
  assert(job, "Za stari profil mora biti najdeno pripadajoče zaključeno opravilo.");
  assert.strictEqual(job.id, "22222222-2222-2222-2222-222222222222");
  assert.notStrictEqual(job.id, "44444444-4444-4444-4444-444444444444", "Novejši tehnični neuspeh ne sme prekriti zadnjega veljavnega uradnega dokazila.");
  assert.strictEqual(job.result.insolvency.officialVerification.evidenceImage, evidenceImage);
  assert.strictEqual(await queue.pridobiNajnovejseZaProfil(null, "88888888-8888-8888-8888-888888888888", profile), null, "Dokazila drugega uporabnika ne smemo vrniti.");
  queue._test.ponastaviPomnilnik();
  console.log("Ponovno odpiranje insolvenčnega dokazila: OK");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
