"use strict";

var assert = require("node:assert");
var handler = require("../api/_handlers/mehka-boniteta");

var html = [
  "<main><h1>Imprint</h1>",
  "<p>FIRMA: EXPRESS-HANDWERKER.DE</p>",
  "<p>ANSCHRIFT: HALLERSTRASSE 33<br>HANNOVER 30161</p>",
  "<p>INHABER: MILO IVANOVSKI</p>",
  "</main>",
].join("");

(async function () {
  var parsed = handler._test.razcleniImpressum(html, "https://www.example.de/impressum/", {});
  assert.ok(parsed, "pravni blok z obrnjenim zapisom kraja in pošte mora biti razčlenjen");
  assert.equal(parsed.nosilec, "Milo Ivanovski");
  assert.equal(parsed.naslov, "HALLERSTRASSE 33");
  assert.equal(parsed.postnaStevilka, "30161");
  assert.equal(parsed.kraj, "HANNOVER");

  var imageHtml = [
    "<main><h1>Impressum</h1>",
    "<img src='/pixel.gif' width='1' height='1' alt=''>",
    "<img src='/uploads/legal-impressum.png' width='900' height='850' alt='Impressum'>",
    "<p>Urheberrecht und Datenschutz.</p></main>",
  ].join("");
  var sourceUrl = "https://www.example.de/impressum/";
  var context = handler._test.dolociPravniKontekst(new URL(sourceUrl));
  assert.deepEqual(handler._test.najdiSlikovneImpressumKandidate(imageHtml, sourceUrl, context), [
    "https://www.example.de/uploads/legal-impressum.png",
  ]);
  var decorativeImagesHtml = [
    "<main><h1>Impressum</h1>",
    "<img src='/public/frontend/assets/images/svg/toggle-icon.svg' alt=''>",
    "<img src='/public/frontend/assets/images/svg/english-flag.svg' alt='English'>",
    "<h5>Vertreten durch:</h5><p>Liridon Rysha</p>",
    "<img src='/public/frontend/assets/images/logo.png' alt='Brand logo'>",
    "</main>",
  ].join("");
  assert.deepEqual(
    handler._test.najdiSlikovneImpressumKandidate(decorativeImagesHtml, sourceUrl, context),
    [],
    "ikone, zastave in logotip ne smejo postati slikovni Impressum kandidat"
  );
  assert.deepEqual(
    handler._test.najdiSlikovneImpressumKandidate(
      "<main><h1>Impressum</h1><img src='/uploads/scan-2026.png' width='900' height='850' alt=''></main>",
      sourceUrl,
      context
    ),
    ["https://www.example.de/uploads/scan-2026.png"],
    "velik nedekorativen raster sken mora ostati dovoljen tudi brez posebnega imena datoteke"
  );
  var parsedImage = await handler._test.razcleniPravniDokumentZRezervo({
    html: imageHtml,
    text: "Impressum Urheberrecht und Datenschutz",
    finalUrl: sourceUrl,
  }, {}, context, {
    ocrText: [
      "FIRMA: EXPRESS-HANDWERKER.DE",
      "ANSCHRIFT: HALLERSTRASSE 33",
      "HANNOVER 30161",
      "INHABER: MILO IVANOVSKI",
    ].join("\n"),
  });
  assert.ok(parsedImage, "slikovni Impressum mora uporabiti isti strogi parser");
  assert.equal(parsedImage.nosilec, "Milo Ivanovski");
  assert.equal(parsedImage.naslov, "HALLERSTRASSE 33");
  assert.equal(parsedImage.postnaStevilka, "30161");
  assert.equal(parsedImage.kraj, "HANNOVER");
  assert.equal(parsedImage.impressumImageUrl, "https://www.example.de/uploads/legal-impressum.png");

  var localOcrCalls = 0;
  var localOcrText = await handler._test.izvediImpressumImageOcr("https://www.example.de/uploads/legal-impressum.png", {
    image: { mediaType: "image/png", data: Buffer.from("test-image").toString("base64") },
    apiKey: "",
    openAiApiKey: "",
    tesseractImpl: async function (buffer, mediaType) {
      localOcrCalls += 1;
      assert.equal(buffer.toString(), "test-image");
      assert.equal(mediaType, "image/png");
      return "INHABER: ERIKA BEISPIEL";
    },
  });
  assert.equal(localOcrCalls, 1, "lokalni OCR mora biti primarni provider");
  assert.equal(localOcrText, "INHABER: ERIKA BEISPIEL");

  var invalidImageOcrCalls = 0;
  var invalidImageText = await handler._test.izvediImpressumImageOcr("https://www.example.de/uploads/legal-impressum.png", {
    image: null,
    apiKey: "",
    openAiApiKey: "",
    tesseractImpl: async function () { invalidImageOcrCalls += 1; return "ne sme se izvesti"; },
  });
  assert.equal(invalidImageText, "", "neuporabna slikovna kandidatka mora pomeniti manjkajoč OCR, ne tehnične izjeme");
  assert.equal(invalidImageOcrCalls, 0, "OCR se brez veljavnega raster payload-a ne sme zagnati");

  var drHtml = "<main><h1>Impressum</h1><h5>Vertreten durch:</h5><p>Liridon Rysha</p></main>";
  var drSourceUrl = "https://www.dr-performance.de/impressum";
  var drParsed = handler._test.razcleniImpressum(drHtml, drSourceUrl, { spletnaStran: "https://www.dr-performance.de" });
  assert.ok(drParsed, "dejanski Impressum z označeno osebo mora ostati viden pregledni kandidat");
  assert.equal(drParsed.nosilec, "Liridon Rysha");
  var drProfile = {
    status: "not_found",
    reason: "legal_identity_incomplete",
    sourceUrl: drSourceUrl,
    reviewSubject: Object.assign({}, drParsed, { sourceKind: "impressum", sourceUrl: drSourceUrl }),
  };
  var drIdentity = handler._test.sestaviNepopolnoImpressumIdentitetoZaPregled(drProfile);
  assert.equal(drIdentity.status, "impressum_review_required");
  assert.equal(drIdentity.ime, "Liridon Rysha");
  assert.equal(drIdentity.sourceUrl, drSourceUrl);
  assert.deepEqual(drIdentity.missingFields, ["legalName", "street", "postalCode", "city"]);
  assert.equal(handler._test.jeDejanskiNepopolniImpressumZaPregled("Impressum", "Vertreten durch: Liridon Rysha", drIdentity), true);
  assert.deepEqual(handler._test.preveriSkladnostIdentiteteZaInsolvenco(drIdentity), {
    status: "blocked", reason: "identity_not_verified",
  });
  var bypass = handler._test.pripraviPotrditevIdentitete({ confirmedIdentity: {
    confirmed: true, name: "Liridon Rysha", businessName: "Liridon Rysha",
    representativeName: "Liridon Rysha", street: "Musterstraße 1", postalCode: "60311", city: "Frankfurt",
  } }, drIdentity);
  assert.equal(bypass.status, "invalid");
  assert.equal(bypass.reason, "identity_unavailable", "manjkajočih polj ni dovoljeno dopolniti brez novega dokaza");

  console.log("Express Handwerker text and image Impressum regressions passed.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
