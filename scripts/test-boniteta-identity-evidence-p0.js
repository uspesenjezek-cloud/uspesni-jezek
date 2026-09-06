"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var root = path.resolve(__dirname, "..");
var prejsnjaSkrivnost = process.env.BONITETA_RESOURCE_PROOF_SECRET;
process.env.BONITETA_RESOURCE_PROOF_SECRET = "local-p0-identity-evidence-contract-test-only";

var evidence = require("../api/_lib/identity-evidence");
var queue = require("../api/_lib/mehka-boniteta-queue");
var mehka = require("../api/mehka-boniteta")._test;
var bonitetaPro = require("../api/_handlers/boniteta-pro")._test;

var TRACKING_URL = "https://jovanovic-motors.de/?gad_source=1&gad_campaignid=22199844681&gbraid=0AAAAA9ozzJeudm9z-TIw-5ZPwrEWTUlr1&gclid=Cj4KCQjwkt_UBhDMARItALpnOAwVUCB45wDT5IRIO75l1vRHkzmgXsu55tJLMVfMLMsR06F2TgMDI1e_GgK6wRAC8P8HAQ";
var LEGAL_URL = "https://jovanovic-motors.de/impressum/";
var JPEG = "data:image/jpeg;base64,QUJDRA==";

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function functionSource(sourceText, name) {
  var match = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(").exec(sourceText);
  assert.ok(match, "Manjka funkcija " + name + ".");
  var start = match.index;
  var openingBrace = sourceText.indexOf("{", start);
  var depth = 0;
  var quote = "";
  var escaped = false;
  var lineComment = false;
  var blockComment = false;
  for (var index = openingBrace; index < sourceText.length; index += 1) {
    var current = sourceText[index];
    var next = sourceText[index + 1];
    if (lineComment) { if (current === "\n") lineComment = false; continue; }
    if (blockComment) { if (current === "*" && next === "/") { blockComment = false; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === quote) quote = "";
      continue;
    }
    if (current === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (current === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (current === '"' || current === "'" || current === "`") { quote = current; continue; }
    if (current === "{") depth += 1;
    else if (current === "}") {
      depth -= 1;
      if (depth === 0) return sourceText.slice(start, index + 1);
    }
  }
  assert.fail("Telesa funkcije " + name + " ni bilo mogoče zaključiti.");
}

function loadFunction(sourceText, name, sandbox) {
  sandbox.globalThis = sandbox;
  vm.runInNewContext(functionSource(sourceText, name) + "\nglobalThis.__tested = " + name + ";", sandbox);
  return sandbox.__tested;
}

function deferred() {
  var resolve;
  var promise = new Promise(function (ok) { resolve = ok; });
  return { promise: promise, resolve: resolve };
}

function jovanovicIdentity() {
  return {
    status: "probable_impressum",
    source: "impressum",
    sourceKind: "impressum",
    sourceUrl: LEGAL_URL,
    entityType: "person",
    ime: "Dusan Jovanovic",
    naziv: "Jovanovic Motors Frankfurt",
    poslovniNaziv: "Jovanovic Motors Frankfurt",
    nosilec: "Dusan Jovanovic",
    naslov: "Eichenstraße 45-47",
    postnaStevilka: "65933",
    kraj: "Frankfurt am Main",
    vatId: "DE182010362",
    identityProvenance: { status: "coherent" },
  };
}

function confirmedJovanovic(overrides) {
  return Object.assign({
    name: "Dusan Jovanovic",
    businessName: "Jovanovic Motors Frankfurt",
    representativeName: "Dusan Jovanovic",
    street: "Eichenstraße 45-47",
    postalCode: "65933",
    city: "Frankfurt am Main",
    entityType: "person",
    registerNumber: "",
    registerCourt: "",
    vatId: "DE182010362",
    confirmed: true,
  }, overrides || {});
}

function pripraviJovanovicDokazilo() {
  var identiteta = jovanovicIdentity();
  var besedilo = [
    "Impressum", "Information according to § 5 TMG", "Jovanovic Motors Frankfurt",
    "Eichenstraße 45-47", "65933 Frankfurt am Main", "Represented by: Dusan Jovanovic",
    "VAT ID: DE182010362",
  ].join("\n");
  var validacija = mehka.validirajVsebinoPravnegaBloka("Impressum", besedilo, identiteta);
  assert.strictEqual(validacija.contentValidationStatus, "matched");
  assert.strictEqual(validacija.provenanceStatus, "same_legal_block");
  var imeniskaValidacija = mehka.validirajVsebinoPravnegaBloka("Javni poslovni profil",
    "Udo Hammes Kfz-Werkstatt Rosmarin Str. 31 40235 Düsseldorf 0211 7308892", {
      sourceKind: "verified_directory_profile", entityType: "person", ime: "Udo Hammes", nosilec: "Udo Hammes",
      naziv: "Udo Hammes Kfz-Werkstatt", naslov: "Rosmarin Str. 31", postnaStevilka: "40235", kraj: "Düsseldorf",
    });
  assert.strictEqual(imeniskaValidacija.contentValidationStatus, "matched");
  assert.strictEqual(imeniskaValidacija.provenanceStatus, "same_legal_block");
  assert.strictEqual(imeniskaValidacija.evidenceRole, "public_directory_identity_confirmation");
  var imeniskaRazlicicaUlice = mehka.validirajVsebinoPravnegaBloka("Javni poslovni profil",
    "Udo Hammes Kfz-Werkstatt Rosmarinstraße 31 40235 Düsseldorf 0211 7308892", {
      sourceKind: "verified_directory_profile", entityType: "person", ime: "Udo Hammes", nosilec: "Udo Hammes",
      naziv: "Udo Hammes Kfz-Werkstatt", naslov: "Rosmarin Str. 31", postnaStevilka: "40235", kraj: "Düsseldorf",
    });
  assert.strictEqual(imeniskaRazlicicaUlice.contentValidationStatus, "matched",
    "Rosmarinstraße in Rosmarin Str. morata veljati kot isti nemški naslov");
  assert.strictEqual(validacija.identityCompleteness, "complete");
  assert.deepStrictEqual(validacija.missingValidationFields, []);
  ["personName", "businessName", "street", "postalCode", "city", "vatId"].forEach(function (field) {
    assert.ok(validacija.validatedFields.includes(field), "Jovanovic pravni blok mora potrditi " + field + ".");
  });
  var pripravljeno = mehka.pripraviDokaziloZaOdgovor(Object.assign({
    status: "captured",
    imageDataUrl: JPEG,
    capturedAt: "2026-09-02T08:00:00.000Z",
    captureVersion: evidence.CAPTURE_VERSION,
    viewportOverlaysRemoved: true,
    screenshotReady: true,
    sourceUrl: LEGAL_URL,
    sourceLabel: "Impressum podjetja",
  }, validacija), identiteta, {
    id: "job-jovanovic-evidence",
    userId: "owner-a",
    requestPayload: { spletnaStran: TRACKING_URL },
  });
  assert.strictEqual(pripravljeno.screenshotReady, true);
  assert.strictEqual(pripravljeno.evidenceReady, true);
  assert.strictEqual(pripravljeno.confirmationReady, true);
  assert.strictEqual(pripravljeno.proofStatus, "signed");
  assert.strictEqual(pripravljeno.canonicalInputUrl, "https://jovanovic-motors.de/");
  assert.strictEqual(pripravljeno.finalLegalUrl, LEGAL_URL);
  assert.match(pripravljeno.evidenceFingerprint, /^[a-f0-9]{64}$/);
  assert.match(pripravljeno.screenshotSha256, /^[a-f0-9]{64}$/);
  var imeniskoPripravljeno = evidence.obogatiDokazilo(Object.assign({}, pripravljeno, {
    evidenceRole: "public_directory_identity_confirmation",
  }));
  assert.strictEqual(imeniskoPripravljeno.confirmationReady, true,
    "podpisan in vsebinsko ujemajoč javni profil mora dovoliti potrditveni korak");
  return pripravljeno;
}

function verifyEvidenceChain(pripravljeno) {
  function preveri(overrides) {
    return evidence.preveriDokaziloZaPotrditev(pripravljeno.evidenceProof, Object.assign({
      ownerId: "owner-a",
      evidenceJobId: "job-jovanovic-evidence",
      fingerprint: pripravljeno.evidenceFingerprint,
      screenshotSha256: pripravljeno.screenshotSha256,
      canonicalInputUrl: TRACKING_URL,
      finalLegalUrl: LEGAL_URL,
      evidenceShown: true,
      confirmedIdentity: confirmedJovanovic(),
      currentIdentity: jovanovicIdentity(),
    }, overrides || {}));
  }
  assert.strictEqual(preveri().ok, true, "isti owner/job/URL/hash/polja in prikazan posnetek morajo dovoliti potrditev");
  assert.strictEqual(preveri({ ownerId: "owner-b" }).reason, "owner_mismatch");
  assert.strictEqual(preveri({ evidenceJobId: "job-kuzey-evidence" }).reason, "job_mismatch");
  assert.strictEqual(preveri({ screenshotSha256: "0".repeat(64) }).reason, "screenshot_hash_mismatch");
  assert.strictEqual(preveri({ finalLegalUrl: "https://autowerk-frankfurt.de/impressum/" }).reason, "legal_url_mismatch");
  assert.strictEqual(preveri({ evidenceShown: false }).reason, "evidence_not_shown");
  assert.strictEqual(preveri({ confirmedIdentity: confirmedJovanovic({ street: "Eichenstraße 46" }) }).reason, "confirmed_fields_mismatch");
  assert.strictEqual(preveri({ currentIdentity: {
    entityType: "person", ime: "Dietmar Flucke", nosilec: "Dietmar Flucke",
    naziv: "Autowerk Frankfurt", naslov: "Basaltstraße 21", postnaStevilka: "60487", kraj: "Frankfurt am Main",
  } }).reason, "current_identity_mismatch");
}

function verifyConcreteIdentityBlocks() {
  var jovanovic = jovanovicIdentity();
  var kuzey = {
    status: "probable_impressum", sourceKind: "impressum", entityType: "person",
    ime: "Gülhan Kama", nosilec: "Gülhan Kama", naziv: "Kuzey Automobile Kfz-Meisterwerkstatt",
    poslovniNaziv: "Kuzey Automobile Kfz-Meisterwerkstatt", naslov: "Mainzer Landstr. 250 H",
    postnaStevilka: "60326", kraj: "Frankfurt", identityProvenance: { status: "coherent" },
  };
  var kuzeyBlock = "Impressum\nKuzey Automobile Kfz-Meisterwerkstatt\nGülhan Kama\nMainzer Landstr. 250 H\n60326 Frankfurt";
  var kuzeyValidation = mehka.validirajVsebinoPravnegaBloka("Impressum", kuzeyBlock, kuzey);
  assert.strictEqual(kuzeyValidation.contentValidationStatus, "matched");
  assert.strictEqual(kuzeyValidation.provenanceStatus, "same_legal_block");
  assert.strictEqual(kuzeyValidation.identityCompleteness, "complete");

  var autowerk = {
    status: "probable_impressum", sourceKind: "impressum", entityType: "person",
    ime: "Dietmar Flucke", nosilec: "Dietmar Flucke", naziv: "Autowerk Frankfurt",
    poslovniNaziv: "Autowerk Frankfurt", naslov: "Basaltstraße 21",
    postnaStevilka: "60487", kraj: "Frankfurt am Main", identityProvenance: { status: "coherent" },
  };
  var autowerkBlock = "Impressum\nAutowerk Frankfurt\nDietmar Flucke\nBasaltstraße 21\n60487 Frankfurt am Main";
  assert.strictEqual(mehka.validirajVsebinoPravnegaBloka("Impressum", autowerkBlock, autowerk).contentValidationStatus, "matched");
  assert.strictEqual(mehka.validirajVsebinoPravnegaBloka("Impressum", kuzeyBlock, autowerk).contentValidationStatus, "mismatch",
    "Autowerk request ne sme sprejeti Kuzey/Gülhan pravnega bloka");
  assert.strictEqual(mehka.validirajVsebinoPravnegaBloka("Impressum", autowerkBlock, jovanovic).contentValidationStatus, "mismatch",
    "Jovanovic request ne sme sprejeti Autowerk/Dietmar pravnega bloka");
}

function verifyIncompleteReview() {
  var dr = {
    status: "impressum_review_required", source: "impressum", sourceKind: "impressum",
    sourceUrl: "https://dr-performance.de/impressum", entityType: "person",
    ime: "Liridon Rysha", nosilec: "Liridon Rysha", naziv: "", poslovniNaziv: "",
    naslov: "", postnaStevilka: "", kraj: "", identityProvenance: { status: "coherent" },
  };
  var validacija = mehka.validirajVsebinoPravnegaBloka("Impressum", "Impressum\nLiridon Rysha", dr);
  assert.strictEqual(validacija.contentValidationStatus, "matched");
  assert.strictEqual(validacija.identityCompleteness, "incomplete");
  assert.strictEqual(validacija.evidenceRole, "incomplete_impressum_review");
  var pripravljeno = mehka.pripraviDokaziloZaOdgovor(Object.assign({
    status: "captured", imageDataUrl: JPEG, capturedAt: "2026-09-02T08:01:00.000Z",
    captureVersion: evidence.CAPTURE_VERSION, viewportOverlaysRemoved: true, screenshotReady: true,
    sourceUrl: dr.sourceUrl, sourceLabel: "Dejanski Impressum – nepopolna identiteta",
  }, validacija), dr, {
    id: "job-dr-performance", userId: "owner-a", requestPayload: { spletnaStran: "https://dr-performance.de/" },
  });
  assert.strictEqual(pripravljeno.screenshotReady, true, "nepopoln dejanski Impressum mora biti viden za pregled");
  assert.strictEqual(pripravljeno.confirmationReady, false, "nepopoln Impressum ne sme omogočiti potrditve");
  assert.strictEqual(pripravljeno.evidenceReady, false);
  assert.strictEqual(evidence.jePosnetekPrikazljiv({
    status: "captured", imageDataUrl: JPEG, sourceUrl: LEGAL_URL,
    captureVersion: evidence.CAPTURE_VERSION, viewportOverlaysRemoved: true, screenshotReady: true,
  }), false, "JPEG brez vsebinske/provenance validacije ni dokaz");
}

function verifyCacheAndPersistence(pripravljeno) {
  assert.strictEqual(evidence.kanonizirajSpletniUrl(TRACKING_URL), "https://jovanovic-motors.de/");
  assert.strictEqual(queue._test.kanonicniSpletniKljuc(TRACKING_URL), "https://jovanovic-motors.de/");
  assert.strictEqual(queue._test.kanonicniSpletniKljuc(TRACKING_URL), queue._test.kanonicniSpletniKljuc("https://jovanovic-motors.de/"));
  assert.strictEqual(queue._test.jeRezultatPrimerenZaPredpomnilnik({
    ok: true,
    identity: { status: "probable_impressum", entityType: "person", ime: "Dusan Jovanovic" },
    identityEvidence: pripravljeno,
  }, "identiteta"), false, "OR-miss evidence rezultata ni dovoljeno prenesti v sintetični cached job");
  assert.strictEqual(queue._test.jeRezultatPrimerenZaPredpomnilnik({
    ok: true,
    identity: { status: "verified_register", entityType: "company", companyId: "DE-HRB-F1103-12345", ime: "Primer GmbH" },
    identityEvidence: {
      status: "verified_api", sourceUrl: "https://openregister.de/company/DE-HRB-F1103-12345",
      companyId: "DE-HRB-F1103-12345", officialName: "Primer GmbH", officialStreet: "Musterstraße 1",
      officialPostalCode: "60311", officialCity: "Frankfurt am Main", registerNumber: "HRB 12345",
    },
  }, "identiteta"), true, "uradno registrsko potrjen rezultat sme ostati v lastniško vezanem cacheu");

  var reference = {
    status: "validated_reference",
    serverProofVerified: true,
    proofStatus: "verified",
    evidenceId: pripravljeno.evidenceId,
    evidenceJobId: pripravljeno.evidenceJobId,
    evidenceFingerprint: pripravljeno.evidenceFingerprint,
    screenshotSha256: pripravljeno.screenshotSha256,
    canonicalInputUrl: pripravljeno.canonicalInputUrl,
    finalLegalUrl: pripravljeno.finalLegalUrl,
    sourceUrl: pripravljeno.finalLegalUrl,
  };
  var job = {
    id: "job-jovanovic-confirmation",
    status: "completed",
    request: {
      spletnaStran: TRACKING_URL,
      evidenceJobId: pripravljeno.evidenceJobId,
      evidenceFingerprint: pripravljeno.evidenceFingerprint,
      evidenceScreenshotSha256: pripravljeno.screenshotSha256,
      evidenceFinalLegalUrl: pripravljeno.finalLegalUrl,
      evidenceShown: true,
    },
    result: {
      checkedAt: "2026-09-02T08:02:00.000Z",
      identity: {
        status: "confirmed_impressum", entityType: "person", ime: "Dusan Jovanovic",
        naziv: "Jovanovic Motors Frankfurt", naslov: "Eichenstraße 45-47",
        postnaStevilka: "65933", kraj: "Frankfurt am Main",
      },
      identityEvidence: reference,
      insolvency: {
        status: "clear",
        officialVerification: { evidenceStatus: "captured", evidenceImage: JPEG },
      },
    },
  };
  var profil = bonitetaPro.profileFromCompletedJob(job);
  assert.strictEqual(profil.legalName, "Jovanovic Motors Frankfurt");
  assert.strictEqual(profil.latestCheck.identityEvidence.serverProofVerified, true);
  assert.throws(function () {
    bonitetaPro.profileFromCompletedJob(Object.assign({}, job, {
      result: Object.assign({}, job.result, { identityEvidence: Object.assign({}, reference, { serverProofVerified: false }) }),
    }));
  }, function (error) { return error && error.code === "IDENTITY_EVIDENCE_REQUIRED"; },
  "normalen non-OR profil brez strežniško validirane evidence reference mora biti zavrnjen");
  assert.throws(function () {
    bonitetaPro.profileFromCompletedJob(Object.assign({}, job, {
      request: Object.assign({}, job.request, { evidenceJobId: "job-kuzey-evidence" }),
    }));
  }, function (error) { return error && error.code === "IDENTITY_EVIDENCE_REQUIRED"; },
  "profil ne sme sprejeti evidence drugega joba");
}

async function verifyFrontendGenerationAndRestore() {
  var frontend = source("app/bonitetna-preverba.js");
  var sandbox = {
    URL: URL,
    aktivnaZahtevaGeneracija: 0,
    ponastaviAktivnoDokaziloPotrditve: function () {},
  };
  sandbox.kanonizirajUrlIdentitete = loadFunction(frontend, "kanonizirajUrlIdentitete", sandbox);
  var zacni = loadFunction(frontend, "zacniKontekstAktivneZahteve", sandbox);
  var jeAktiven = loadFunction(frontend, "jeKontekstAktiven", sandbox);
  var preveriJob = loadFunction(frontend, "preveriPovezavoOpravilaZVnosom", sandbox);

  var prva = deferred();
  var druga = deferred();
  var prikazano = [];
  var prviKontekst = zacni({ spletnaStran: "https://www.autoteam-plus.de/kuzey-automobile/" }, false);
  var prviRender = prva.promise.then(function (vrednost) { if (jeAktiven(prviKontekst)) prikazano.push(vrednost); });
  var drugiKontekst = zacni({ spletnaStran: "https://autowerk-frankfurt.de/" }, false);
  var drugiRender = druga.promise.then(function (vrednost) { if (jeAktiven(drugiKontekst)) prikazano.push(vrednost); });
  druga.resolve("Autowerk/Dietmar");
  await drugiRender;
  prva.resolve("Kuzey/Gülhan");
  await prviRender;
  assert.deepStrictEqual(prikazano, ["Autowerk/Dietmar"], "obrnjeni vrstni red async odgovorov ne sme prepisati aktivnega URL-ja");
  assert.throws(function () {
    preveriJob({ request: { spletnaStran: "https://www.autoteam-plus.de/kuzey-automobile/" } }, drugiKontekst);
  }, /drug spletni naslov/, "Autowerk kontekst mora zavrniti Kuzey queue payload");

  var waitBody = functionSource(frontend, "pocakajNaOpravilo");
  assert.match(waitBody, /await fetchSPonovnimPoskusom[\s\S]*?if \(!jeKontekstAktiven\(kontekst\)\) return null;[\s\S]*?job = podatki && podatki\.job/,
    "queue poll mora preveriti generation pred sprejemom asinhronega job odgovora");
  var renderBody = functionSource(frontend, "izrisi");
  assert.match(renderBody, /__requestGeneration[\s\S]*?!== aktivnaZahtevaGeneracija\) return;/,
    "renderer mora zavrniti pozen rezultat tudi na zadnji meji");
  assert.match(renderBody, /\[\s*"verified_register", "probable_impressum", "confirmed_impressum",\s*\]\.includes\(identiteta\.status\)/,
    "razbrani podatki morajo najprej dobiti normalen profil pred uporabnikovo potrditvijo");
  assert.match(frontend, /if \(jeDokazniPregled && identiteta\.status !== "probable_impressum"\) \{[\s\S]*?podjetjeSklop\.hidden = true/,
    "samo blokiran dokazni pregled sme neposredno skriti profil; probable Impressum mora počakati na klik uporabnika");
  assert.match(renderBody, /potrditevDokazSlika\.onload[\s\S]*?dokaznoStanjeObNastavitvi\.shown = true/,
    "shown_to_user sme nastati šele po uspešnem loadu iste slike");
  var evidenceUiState = loadFunction(frontend, "stanjeDokazilaZaPotrditev", {});
  assert.strictEqual(evidenceUiState(true, true, { shown: false, fieldsMatch: true }), "display_pending",
    "vidna in podpisana slika med image loadom ni capture failure");
  assert.strictEqual(evidenceUiState(true, true, { shown: true, fieldsMatch: true }), "ready",
    "prikazana matched/same-block/complete slika z enakimi polji mora omogočiti uporabnikov pregled");
  assert.strictEqual(evidenceUiState(true, false, null), "stale_contract",
    "vidna slika brez podpisane job vezave mora dobiti specifično stanje stare pogodbe");
  assert.ok(frontend.includes('if (stanjeDokazila === "display_pending") {') &&
    frontend.includes("potrditevDokazNapaka.hidden = true;") &&
    frontend.includes('} else if (stanjeDokazila === "fields_mismatch") {'),
    "image load race ne sme prikazati evidence-unavailable ali retry-capture stanja");
  assert.match(frontend, /stanjePoPrikazu === "ready"[\s\S]*?delete potrditevGumb\.dataset\.identityEvidenceRetry[\s\S]*?potrditevCheckbox\.disabled = false/,
    "uspešen prikaz iste podpisane slike mora odstraniti retry in šele nato omogočiti checkbox");
  assert.match(frontend, /Dokaz je iz stare različice – osvežite dokaz/,
    "stari payload brez podpisa mora biti razločen od capture failure");
  assert.match(functionSource(frontend, "posodobiPotrditevIdentitete"), /identityEvidenceRetry[\s\S]*?potrditevGumb\.disabled = potrditevGumb\.classList\.contains\("is-loading"\)/,
    "capture failure mora ponuditi delujoč retry, ne potrditve");
  var restoreBody = functionSource(frontend, "rezultatIzShranjengaProfila");
  assert.match(restoreBody, /status === "validated_reference"[\s\S]*?serverProofVerified === true[\s\S]*?proofStatus === "verified"/,
    "reload starega profila mora zahtevati strežniško vezano evidence reference");
  assert.match(restoreBody, /: "evidence_review_blocked"/);
  assert.match(restoreBody, /blokiranShranjeniImpressum \? null : latest\.northData/,
    "blokiran restore ne sme prenesti North Data ali Plus poti");
}

function verifyLinearServerFlow() {
  var handlerSource = source("api/_handlers/mehka-boniteta.js");
  var handler = handlerSource.slice(handlerSource.indexOf("async function handler(req, res)"), handlerSource.indexOf("handler._test"));
  assert.strictEqual((handler.match(/pridobiApifyImpressumProfil\(vnos\.spletnaStran\)/g) || []).length, 0,
    "uporabniški handler ne sme čakati Impressum actorja; agent potrjuje šele po trajnem zaključku joba");
  assert.strictEqual((handler.match(/zacniNorthDataPoOpenRegisterju\(/g) || []).length, 1,
    "linearni handler sme imeti eno ND1+ND2 zagonsko točko");
  var proofBranchStart = handler.indexOf("if (telo.confirmedIdentity && telo.evidenceProof)");
  var discoveryStart = handler.indexOf("var openregisterOsnovniVnos");
  assert.ok(proofBranchStart >= 0 && proofBranchStart < discoveryStart,
    "podpisana potrditev mora biti preverjena pred vsakim Apify/OR/capture klicem");
  var proofBranch = handler.slice(proofBranchStart, discoveryStart);
  assert.match(proofBranch, /var northDataZacetek = null/,
    "OR-miss potrditev ne sme zagnati nobenega North Data actorja");
  assert.doesNotMatch(proofBranch, /findLegalNotice|poisciOpenRegisterNajvecEnkrat|zajemiDokaziloIdentitete/);
  var ndFunction = functionSource(handlerSource, "zacniNorthDataPoOpenRegisterju");
  assert.match(ndFunction, /openregister\.status !== "found"[\s\S]*?return null/);
  assert.match(ndFunction, /detailsPromise = northDataDetailsClient\.startVerifiedIdentity[\s\S]*?primaryPromise = northDataClient\.startVerifiedIdentity/,
    "OR found mora ND1 in ND2 začeti brez zaporednega await-a");
  assert.doesNotMatch(ndFunction, /await /);

  var workerSource = source("api/mehka-boniteta-delavec.js");
  var completion = workerSource.indexOf("await queue.zakljuci(cfg, job");
  var agentConfirmation = workerSource.indexOf("await mehkaBoniteta.potrdiImpressumZAgentom");
  assert.ok(completion >= 0 && agentConfirmation > completion,
    "actor sme steči šele po trajnem zaključku primarnega lokalnega rezultata");

  var detailsHandler = source("api/_handlers/mehka-boniteta-podrobnosti.js");
  assert.match(detailsHandler, /completeStartedRun/,
    "Plus mora prebrati isti že začeti ND2 run");
  assert.doesNotMatch(detailsHandler, /startVerifiedIdentity|enrichVerifiedIdentity/,
    "Plus ne sme ustvariti novega plačljivega actor runa");
}

async function main() {
  try {
    var pripravljeno = pripraviJovanovicDokazilo();
    verifyEvidenceChain(pripravljeno);
    verifyConcreteIdentityBlocks();
    verifyIncompleteReview();
    verifyCacheAndPersistence(pripravljeno);
    await verifyFrontendGenerationAndRestore();
    verifyLinearServerFlow();
    console.log("✓ P0 evidence veriga: isti owner/job/URL/legal block/hash/polja/shown in field-edit invalidacija.");
    console.log("✓ Jovanovic, Kuzey, Autowerk in dr-performance regresije so fail-closed.");
    console.log("✓ Async out-of-order, cache/restore in profil persistence ne morejo zamenjati identitete.");
    console.log("✓ OR found ima eno vzporedno ND1+ND2 točko; OR miss nima ND; Plus bere isti ND2 run.");
  } finally {
    if (prejsnjaSkrivnost == null) delete process.env.BONITETA_RESOURCE_PROOF_SECRET;
    else process.env.BONITETA_RESOURCE_PROOF_SECRET = prejsnjaSkrivnost;
  }
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
