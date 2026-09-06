"use strict";

var assert = require("node:assert");
var crypto = require("node:crypto");
var fs = require("node:fs");
var path = require("node:path");
var puppeteer = require("puppeteer-core");

process.env.BONITETA_RESOURCE_PROOF_SECRET = process.env.BONITETA_RESOURCE_PROOF_SECRET ||
  "local-jovanovic-ui-evidence-audit-only";
var evidenceContract = require("../api/_lib/identity-evidence");

var INPUT_URL = "https://jovanovic-motors.de/?gad_source=1&gad_campaignid=22199844681&gbraid=0AAAAA9ozzJeudm9z-TIw-5ZPwrEWTUlr1&gclid=Cj4KCQjwkt_UBhDMARItALpnOAwVUCB45wDT5IRIO75l1vRHkzmgXsu55tJLMVfMLMsR06F2TgMDI1e_GgK6wRAC8P8HAQ";
var LEGAL_URL = "https://jovanovic-motors.de/impressum/";
var JOB_ID = "11111111-2222-4333-8444-555555555555";
var OWNER_ID = "local-jovanovic-ui-owner";

function executable() {
  return [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find(fs.existsSync);
}

function createPayload(imageDataUrl) {
  var capturedAt = new Date().toISOString();
  var identity = {
    status: "probable_impressum",
    source: "impressum",
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
  };
  var binding = evidenceContract.ustvariVezavoDokazila({
    ownerId: OWNER_ID,
    evidenceJobId: JOB_ID,
    canonicalInputUrl: INPUT_URL,
    finalLegalUrl: LEGAL_URL,
    identity: identity,
    imageDataUrl: imageDataUrl,
    capturedAt: capturedAt,
  });
  var signedEvidence = evidenceContract.obogatiDokazilo({
    status: "captured",
    imageDataUrl: imageDataUrl,
    capturedAt: capturedAt,
    captureVersion: evidenceContract.CAPTURE_VERSION,
    viewportOverlaysRemoved: true,
    sourceUrl: LEGAL_URL,
    finalLegalUrl: binding.finalLegalUrl,
    canonicalInputUrl: binding.canonicalInputUrl,
    sourceLabel: "Impressum podjetja",
    contentValidationStatus: "matched",
    provenanceStatus: "same_legal_block",
    identityCompleteness: "complete",
    validatedFields: ["personName", "businessName", "representativeName", "street", "postalCode", "city", "vatId"],
    missingValidationFields: [],
    validatedIdentity: Object.assign({}, binding.identity, { identityName: "Dusan Jovanovic" }),
    evidenceRole: "impressum_identity_confirmation",
    screenshotSha256: binding.screenshotSha256,
    evidenceId: binding.evidenceId,
    evidenceJobId: binding.evidenceJobId,
    evidenceFingerprint: binding.fingerprint,
    evidenceProof: evidenceContract.podpisiVezavoDokazila(binding),
    proofStatus: "signed",
  });
  assert.equal(signedEvidence.evidenceReady, true);
  assert.equal(signedEvidence.confirmationReady, true);
  return {
    ok: true,
    checkedAt: capturedAt,
    __queueJobId: JOB_ID,
    __queueRequest: { spletnaStran: INPUT_URL },
    __requestGeneration: 0,
    confirmationRequired: true,
    identityReviewRequired: true,
    identity: identity,
    identityEvidence: signedEvidence,
    openregister: { status: "not_found", reason: "not_found", sourceUrl: "https://openregister.de" },
    northData: { status: "skipped", reason: "openregister_not_verified" },
    northDataDetails: { status: "skipped", reason: "openregister_not_verified" },
    publicProfile: { status: "found", sourceUrl: LEGAL_URL },
    locationMatch: { status: "not_checked" },
    insolvency: { status: "not_checked", reason: "user_confirmation_required" },
    result: { level: "yellow", title: "Preglejte dokaz identitete" },
  };
}

async function main() {
  var root = path.resolve(__dirname, "..");
  var imagePath = path.join(root, "output", "playwright", "boniteta-jovanovic-impressum-evidence-p0.jpg");
  var outputPath = path.join(root, "output", "playwright", "boniteta-jovanovic-evidence-review-fixed-mobile.png");
  var auditPath = path.join(root, "output", "playwright", "boniteta-jovanovic-evidence-review-fixed-mobile.json");
  var imageDataUrl = "data:image/jpeg;base64," + fs.readFileSync(imagePath).toString("base64");
  var payload = createPayload(imageDataUrl);
  var browser = await puppeteer.launch({ executablePath: executable(), headless: true, args: ["--no-sandbox"] });
  var page = await browser.newPage();
  try {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.goto("http://localhost:8001/app/bonitetna-preverba.html?app-preview=1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(function () { return typeof window.UJBonitetaAuditIzrisi === "function"; });
    await page.evaluate(function (data) { window.UJBonitetaAuditIzrisi(data); }, payload);
    await page.waitForFunction(function () {
      var image = document.getElementById("boniteta-potrditev-dokaz-slika");
      var checkbox = document.getElementById("boniteta-potrdi-checkbox");
      return image && image.complete && image.naturalWidth > 0 && checkbox && checkbox.disabled === false;
    });
    var state = await page.evaluate(function () {
      var checkbox = document.getElementById("boniteta-potrdi-checkbox");
      var button = document.getElementById("boniteta-potrditev-gumb");
      var error = document.getElementById("boniteta-potrditev-dokaz-napaka");
      var image = document.getElementById("boniteta-potrditev-dokaz-slika");
      var field = function (id) { return document.getElementById(id).value; };
      return {
        imageDisplayed: !document.getElementById("boniteta-potrditev-dokaz").hidden && image.complete && image.naturalWidth > 0,
        checkboxEnabled: checkbox.disabled === false,
        confirmationButtonDisabledBeforeCheck: button.disabled,
        retryCapture: button.dataset.identityEvidenceRetry === "true",
        evidenceErrorVisible: !error.hidden,
        evidenceErrorText: error.textContent.trim(),
        legacyScreenVisible: document.body.textContent.includes("DOKAZILA OSNOVNE PREVERBE") || document.body.textContent.includes("Uporabljeni viri"),
        fields: {
          name: field("boniteta-potrdi-ime"),
          businessName: field("boniteta-potrdi-naziv"),
          representativeName: field("boniteta-potrdi-nosilec"),
          street: field("boniteta-potrdi-naslov"),
          postalCode: field("boniteta-potrdi-posta"),
          city: field("boniteta-potrdi-kraj"),
        },
      };
    });
    assert.deepStrictEqual(state.fields, {
      name: "Dusan Jovanovic",
      businessName: "Jovanovic Motors Frankfurt",
      representativeName: "Dusan Jovanovic",
      street: "Eichenstraße 45-47",
      postalCode: "65933",
      city: "Frankfurt am Main",
    });
    assert.equal(state.imageDisplayed, true);
    assert.equal(state.checkboxEnabled, true);
    assert.equal(state.confirmationButtonDisabledBeforeCheck, true);
    assert.equal(state.retryCapture, false);
    assert.equal(state.evidenceErrorVisible, false);
    assert.equal(state.legacyScreenVisible, false);
    await page.click("#boniteta-potrdi-checkbox");
    await page.waitForFunction(function () { return document.getElementById("boniteta-potrditev-gumb").disabled === false; });
    state.confirmationButtonEnabledAfterCheck = true;
    await page.screenshot({ path: outputPath, fullPage: true });
    var audit = {
      generatedAt: new Date().toISOString(),
      canonicalInputUrl: evidenceContract.kanonizirajSpletniUrl(INPUT_URL),
      finalLegalUrl: LEGAL_URL,
      jobId: JOB_ID,
      evidenceFingerprint: payload.identityEvidence.evidenceFingerprint,
      screenshotSha256: payload.identityEvidence.screenshotSha256,
      contentValidationStatus: payload.identityEvidence.contentValidationStatus,
      provenanceStatus: payload.identityEvidence.provenanceStatus,
      identityCompleteness: payload.identityEvidence.identityCompleteness,
      evidenceReady: payload.identityEvidence.evidenceReady,
      confirmationReady: payload.identityEvidence.confirmationReady,
      ui: state,
      screenshotPath: outputPath,
    };
    fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + "\n");
    console.log(JSON.stringify({ outputPath: outputPath, auditPath: auditPath, ui: state }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
