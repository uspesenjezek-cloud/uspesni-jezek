"use strict";

var assert = require("node:assert");
var crypto = require("node:crypto");
var fs = require("node:fs");
var path = require("node:path");

var test = require("../api/mehka-boniteta")._test;
var evidenceContract = require("../api/_lib/identity-evidence");

var exactInputUrl = "https://jovanovic-motors.de/?gad_source=1&gad_campaignid=22199844681&gbraid=0AAAAA9ozzJeudm9z-TIw-5ZPwrEWTUlr1&gclid=Cj4KCQjwkt_UBhDMARItALpnOAwVUCB45wDT5IRIO75l1vRHkzmgXsu55tJLMVfMLMsR06F2TgMDI1e_GgK6wRAC8P8HAQ";
var finalLegalUrl = "https://jovanovic-motors.de/impressum/";
var identity = {
  status: "probable_impressum",
  source: "impressum",
  sourceKind: "impressum",
  sourceUrl: finalLegalUrl,
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

async function main() {
  var startedAt = Date.now();
  var capture = await test.zajemiDokaziloIdentitete(
    identity,
    { status: "not_found", reason: "audit_or_miss", sourceUrl: "https://openregister.de" },
    null,
    { status: "found", sourceUrl: finalLegalUrl, acquisition: "audit_exact_legal_url", subjekt: identity }
  );
  var durationMs = Date.now() - startedAt;
  assert.ok(capture && capture.status === "captured", "Lastni capture ni vrnil posnetka.");
  assert.strictEqual(capture.contentValidationStatus, "matched");
  assert.strictEqual(capture.provenanceStatus, "same_legal_block");
  assert.strictEqual(capture.identityCompleteness, "complete");
  assert.strictEqual(evidenceContract.jePosnetekPrikazljiv(capture), true);
  assert.strictEqual(evidenceContract.kanonizirajSpletniUrl(capture.sourceUrl), finalLegalUrl);

  var match = String(capture.imageDataUrl || "").match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  assert.ok(match, "Capture ni veljaven JPEG data URL.");
  var bytes = Buffer.from(match[1], "base64");
  var outputDir = path.join(__dirname, "..", "output", "playwright");
  fs.mkdirSync(outputDir, { recursive: true });
  var imagePath = path.join(outputDir, "boniteta-jovanovic-impressum-evidence-p0.jpg");
  var summaryPath = path.join(outputDir, "boniteta-jovanovic-impressum-evidence-p0.json");
  fs.writeFileSync(imagePath, bytes);
  fs.writeFileSync(summaryPath, JSON.stringify({
    auditVersion: 1,
    originalInputUrl: exactInputUrl,
    canonicalInputUrl: evidenceContract.kanonizirajSpletniUrl(exactInputUrl),
    requestedFinalLegalUrl: finalLegalUrl,
    capturedFinalLegalUrl: evidenceContract.kanonizirajSpletniUrl(capture.sourceUrl),
    durationMs: durationMs,
    status: capture.status,
    screenshotReady: evidenceContract.jePosnetekPrikazljiv(capture),
    contentValidationStatus: capture.contentValidationStatus,
    provenanceStatus: capture.provenanceStatus,
    identityCompleteness: capture.identityCompleteness,
    evidenceRole: capture.evidenceRole,
    validatedFields: capture.validatedFields,
    missingValidationFields: capture.missingValidationFields,
    validatedIdentity: capture.validatedIdentity,
    captureVersion: capture.captureVersion,
    capturedAt: capture.capturedAt,
    screenshotSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    screenshotBytes: bytes.length,
  }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ imagePath: imagePath, summaryPath: summaryPath, durationMs: durationMs, validatedFields: capture.validatedFields }));
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
