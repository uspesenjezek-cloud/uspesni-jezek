"use strict";

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
  var target = String(process.argv[2] || "").trim();
  var suffix = String(process.argv[3] || "url-evidence").replace(/[^a-z0-9-]/gi, "-");
  var viewportWidth = Number(process.argv[4] || 390);
  var viewportHeight = Number(process.argv[5] || (viewportWidth >= 800 ? 900 : 844));
  var additionalWidth = Number(process.argv[6] || 0);
  var additionalHeight = Number(process.argv[7] || (additionalWidth >= 800 ? 900 : 844));
  if (!/^https?:\/\//i.test(target)) throw new Error("Podajte polni javni URL.");
  if (!Number.isFinite(viewportWidth) || viewportWidth < 320 || viewportWidth > 1600 ||
      !Number.isFinite(viewportHeight) || viewportHeight < 568 || viewportHeight > 1400) {
    throw new Error("Podajte veljavno širino in višino predogleda.");
  }
  if (additionalWidth && (!Number.isFinite(additionalWidth) || additionalWidth < 320 || additionalWidth > 1600 ||
      !Number.isFinite(additionalHeight) || additionalHeight < 568 || additionalHeight > 1400)) {
    throw new Error("Podajte veljavno dodatno širino in višino predogleda.");
  }
  var browser = await puppeteer.launch({ executablePath: executable(), headless: true, args: ["--no-sandbox"] });
  var page = await browser.newPage();
  var apiResponses = [];
  var latestJob = null;
  try {
    await page.setViewport({ width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1 });
    page.on("response", async function (response) {
      if (/\/api\/(?:mehka-boniteta-opravilo|mehka-boniteta-delavec)/.test(response.url())) {
        apiResponses.push({ method: response.request().method(), url: response.url(), status: response.status() });
        if (response.request().method() === "GET" && /\/api\/mehka-boniteta-opravilo/.test(response.url())) {
          try {
            var payload = await response.json();
            if (payload && payload.job) latestJob = payload.job;
          } catch (_) {}
        }
      }
    });
    await page.goto("http://localhost:8001/app/bonitetna-preverba.html?_dev=1788383653344&app-preview=1#new", { waitUntil: "domcontentloaded" });
    await page.type("#boniteta-hero-spletna-stran", target);
    await page.keyboard.press("Enter");
    await page.waitForFunction(function () {
      var review = document.querySelector("#boniteta-potrditev-identitete");
      var error = document.querySelector("#boniteta-hero-status");
      return review && !review.hidden || error && !error.hidden && error.classList.contains("is-error");
    }, { timeout: 100000 });
    await new Promise(function (resolve) { setTimeout(resolve, 750); });
    var state = await page.evaluate(function () {
      function element(selector) { return document.querySelector(selector); }
      function value(selector) { var input = element(selector); return input && input.value || ""; }
      var image = element("#boniteta-potrditev-dokaz-slika");
      return {
        reviewVisible: Boolean(element("#boniteta-potrditev-identitete") && !element("#boniteta-potrditev-identitete").hidden),
        imageVisible: Boolean(image && image.getAttribute("src") && image.getBoundingClientRect().height > 40),
        imageSourceLength: String(image && image.getAttribute("src") || "").length,
        name: value("#boniteta-potrdi-ime"),
        businessName: value("#boniteta-potrdi-naziv"),
        representative: value("#boniteta-potrdi-nosilec"),
        street: value("#boniteta-potrdi-naslov"),
        postalCode: value("#boniteta-potrdi-posta"),
        city: value("#boniteta-potrdi-kraj"),
        evidenceError: element("#boniteta-potrditev-dokaz-napaka") && element("#boniteta-potrditev-dokaz-napaka").textContent.trim() || "",
      };
    });
    var output = path.join(__dirname, "..", "output", "playwright");
    fs.mkdirSync(output, { recursive: true });
    var screenshot = path.join(output, "boniteta-" + suffix + "-" + viewportWidth + ".png");
    await page.screenshot({ path: screenshot, fullPage: true });
    var screenshots = [screenshot];
    var responsiveStates = [{
      width: viewportWidth,
      height: viewportHeight,
      horizontalOverflow: await page.evaluate(function () { return document.documentElement.scrollWidth > window.innerWidth; }),
    }];
    var responsesBeforeConfirmation = apiResponses.length;
    await page.evaluate(function () {
      var checkbox = document.querySelector("#boniteta-potrdi-checkbox");
      if (checkbox) checkbox.scrollIntoView({ block: "center", inline: "nearest" });
    });
    await page.click("#boniteta-potrdi-checkbox");
    await new Promise(function (resolve) { setTimeout(resolve, 250); });
    var confirmationState = await page.evaluate(function () {
      var checkbox = document.querySelector("#boniteta-potrdi-checkbox");
      var button = document.querySelector("#boniteta-potrditev-gumb");
      return {
        checked: Boolean(checkbox && checkbox.checked),
        buttonDisabled: Boolean(button && button.disabled),
        buttonText: String(button && button.textContent || "").replace(/\s+/g, " ").trim(),
      };
    });
    confirmationState.apiResponsesTriggered = apiResponses.length - responsesBeforeConfirmation;
    var readyScreenshot = path.join(output, "boniteta-" + suffix + "-ready-" + viewportWidth + ".png");
    await page.screenshot({ path: readyScreenshot, fullPage: true });
    screenshots.push(readyScreenshot);
    if (additionalWidth) {
      await page.setViewport({ width: additionalWidth, height: additionalHeight, deviceScaleFactor: 1 });
      await new Promise(function (resolve) { setTimeout(resolve, 250); });
      await page.evaluate(function () {
        var checkbox = document.querySelector("#boniteta-potrdi-checkbox");
        if (checkbox) checkbox.scrollIntoView({ block: "center", inline: "nearest" });
      });
      await new Promise(function (resolve) { setTimeout(resolve, 150); });
      var additionalScreenshot = path.join(output, "boniteta-" + suffix + "-" + additionalWidth + ".png");
      await page.screenshot({ path: additionalScreenshot, fullPage: true });
      screenshots.push(additionalScreenshot);
      responsiveStates.push({
        width: additionalWidth,
        height: additionalHeight,
        horizontalOverflow: await page.evaluate(function () { return document.documentElement.scrollWidth > window.innerWidth; }),
      });
    }
    var rezultat = latestJob && latestJob.result || {};
    var dokazilo = rezultat.identityEvidence || {};
    var jobDiagnostics = latestJob ? {
      id: latestJob.id,
      status: latestJob.status,
      lastError: latestJob.last_error || latestJob.lastError || "",
      identityStatus: rezultat.identity && rezultat.identity.status || "",
      evidence: {
        status: dokazilo.status || "",
        code: dokazilo.code || dokazilo.errorCode || "",
        reason: dokazilo.reason || dokazilo.error || "",
        sourceUrl: dokazilo.sourceUrl || "",
        contentValidationStatus: dokazilo.contentValidationStatus || "",
        provenanceStatus: dokazilo.provenanceStatus || "",
        identityCompleteness: dokazilo.identityCompleteness || "",
        missingValidationFields: dokazilo.missingValidationFields || [],
        screenshotReady: dokazilo.screenshotReady === true,
        evidenceReady: dokazilo.evidenceReady === true,
        imageSourceLength: String(dokazilo.imageDataUrl || dokazilo.evidenceImage || "").length,
      },
    } : null;
    console.log(JSON.stringify({ screenshot: screenshot, screenshots: screenshots, responsiveStates: responsiveStates, state: state, confirmationState: confirmationState, jobDiagnostics: jobDiagnostics, apiResponses: apiResponses }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
