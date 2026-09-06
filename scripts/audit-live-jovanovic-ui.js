"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var puppeteer = require("puppeteer-core");

function executable() {
  return [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find(fs.existsSync);
}

async function main() {
  var jobArgumentIndex = process.argv.indexOf("--job");
  var existingJobId = jobArgumentIndex >= 0 ? String(process.argv[jobArgumentIndex + 1] || "").trim() : "";
  var browser = await puppeteer.launch({ executablePath: executable(), headless: true, args: ["--no-sandbox"] });
  var page = await browser.newPage();
  var apiResponses = [];
  try {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    page.on("response", function (response) {
      if (/\/api\/(?:mehka-boniteta-opravilo|mehka-boniteta-delavec)/.test(response.url())) {
        apiResponses.push({ method: response.request().method(), url: response.url(), status: response.status() });
      }
    });
    var pageUrl = "http://localhost:8001/app/bonitetna-preverba.html?app-preview=1" +
      (existingJobId ? "&job=" + encodeURIComponent(existingJobId) : "");
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    if (!existingJobId) {
      await page.type("#boniteta-hero-spletna-stran", "https://jovanovic-motors.de/impressum/");
      await page.keyboard.press("Enter");
    }
    await page.waitForFunction(function () {
      var review = document.querySelector("#boniteta-potrditev-identitete");
      var error = document.querySelector("#boniteta-hero-status");
      return review && !review.hidden || error && !error.hidden && error.classList.contains("is-error");
    }, { timeout: 90000 });

    var state = await page.evaluate(function () {
      function value(id) { var el = document.querySelector(id); return el && el.value || ""; }
      var review = document.querySelector("#boniteta-potrditev-identitete");
      var image = document.querySelector("#boniteta-potrditev-dokaz-slika");
      var error = document.querySelector("#boniteta-hero-status");
      return {
        reviewVisible: Boolean(review && !review.hidden),
        imageVisible: Boolean(image && image.getAttribute("src") && image.getBoundingClientRect().height > 40),
        error: error && !error.hidden ? error.textContent.trim() : "",
        oldFallbackPresent: Boolean(document.querySelector("#boniteta-spletna-rezerva")),
        insolvencyButtonDisabled: Boolean(document.querySelector("#boniteta-potrditev-gumb") && document.querySelector("#boniteta-potrditev-gumb").disabled),
        fields: {
          name: value("#boniteta-potrdi-ime"),
          businessName: value("#boniteta-potrdi-naziv"),
          representative: value("#boniteta-potrdi-nosilec"),
          street: value("#boniteta-potrdi-naslov"),
          postalCode: value("#boniteta-potrdi-posta"),
          city: value("#boniteta-potrdi-kraj"),
        },
      };
    });

    var output = path.join(__dirname, "..", "output", "playwright");
    fs.mkdirSync(output, { recursive: true });
    var screenshot = path.join(output, "boniteta-jovanovic-live-end-to-end-390.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    console.log(JSON.stringify({ screenshot: screenshot, state: state, apiResponses: apiResponses }, null, 2));
    assert.equal(state.reviewVisible, true, "dejanski URL ni odprl obstoječega dokaznega pregleda");
    assert.equal(state.imageVisible, true, "dejanski URL ni prikazal zajetega posnetka Impressuma");
    assert.equal(state.oldFallbackPresent, false, "stari fallback zaslon se ne sme vrniti");
    assert.equal(state.insolvencyButtonDisabled, true, "insolvenčni gumb mora biti pred uporabnikovo potrditvijo blokiran");
    assert.equal(state.fields.name, "Dusan Jovanovic");
    assert.equal(state.fields.businessName, "Jovanovic Motors Frankfurt");
    assert.equal(state.fields.street, "Eichenstraße 45-47");
    assert.equal(state.fields.postalCode, "65933");
    assert.equal(state.fields.city, "Frankfurt am Main");
  } finally {
    await browser.close();
  }
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
