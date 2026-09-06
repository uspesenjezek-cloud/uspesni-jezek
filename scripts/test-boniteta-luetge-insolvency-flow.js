"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var puppeteer = require("puppeteer-core");

function executable() {
  return [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find(fs.existsSync);
}

function identityPayload(status) {
  var checkedAt = new Date().toISOString();
  return {
    ok: true,
    checkedAt: checkedAt,
    confirmationRequired: false,
    result: { level: status === "clear" ? "green" : "yellow", title: status === "clear" ? "Ni najdenih insolvenčnih objav" : "Uradna preverba ni dokončana" },
    identity: {
      status: "verified_register", entityType: "company", ime: "LÜTGE HAUSTECHNIK GmbH", naziv: "LÜTGE HAUSTECHNIK GmbH",
      naslov: "Orchideenring 11b", postnaStevilka: "22607", kraj: "Hamburg", companyId: "DE-HRB-K1101-176347",
      registerNumber: "HRB 176347", registerCourt: "Amtsgericht Hamburg", legalForm: "GmbH", active: true,
    },
    identityEvidence: {
      status: "verified_api", evidenceReady: true, evidenceKind: "structured_api", companyId: "DE-HRB-K1101-176347",
      officialName: "LÜTGE HAUSTECHNIK GmbH", officialStreet: "Orchideenring 11b", officialPostalCode: "22607", officialCity: "Hamburg",
      registerNumber: "HRB 176347", registerCourt: "Amtsgericht Hamburg", sourceUrl: "https://openregister.de",
    },
    locationMatch: { status: "matched", official: { postalCode: "22607", city: "Hamburg" } },
    insolvency: status === "clear" ? {
      status: "clear", source: "official_insolvency_portal", sourceLabel: "Insolvenzbekanntmachungen", verificationMode: "official_portal_only",
      searchedName: "LÜTGE HAUSTECHNIK GmbH", searchedCity: "Hamburg", searchedPostalCode: "22607",
      officialVerification: {
        status: "clear", reason: "no_publication_found", source: "official_insolvency_portal", sourceLabel: "Insolvenzbekanntmachungen",
        checkedAt: checkedAt, evidenceStatus: "captured", evidenceVersion: "official-insolvency-v11-proof-required-terminal",
        evidenceImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7R0AAAAASUVORK5CYII=",
        inputVerification: { status: "matched", fields: { firmaPriimek: "LÜTGE HAUSTECHNIK GmbH", kraj: "Hamburg", postnaStevilka: "22607", registrskoSodisce: "Amtsgericht Hamburg", vrstaRegistra: "HRB", registrskaStevilka: "176347" } },
      },
    } : { status: "not_checked" },
  };
}

async function main() {
  var browser = await puppeteer.launch({ executablePath: executable(), headless: true, args: ["--no-sandbox"] });
  var page = await browser.newPage();
  var posts = 0;
  var gets = 0;
  var failureMode = false;
  var jobId = "11111111-1111-4111-8111-111111111111";
  try {
    await page.setViewport({ width: 390, height: 844 });
    await page.setRequestInterception(true);
    page.on("request", async function (request) {
      var url = request.url();
      if (/\/api\/mehka-boniteta-opravilo(?:\?|$)/.test(url)) {
        if (request.method() === "POST") {
          posts += 1;
          return request.respond({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true, job: { id: jobId, faza: "insolvenca", status: "queued", attempts: 0, maxAttempts: 2 } }) });
        }
        gets += 1;
        await new Promise(function (resolve) { setTimeout(resolve, 160); });
        if (failureMode && gets >= 3) return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, job: {
          id: jobId, faza: "insolvenca", status: "failed", attempts: 2, maxAttempts: 2,
          error: "Vir je bil začasno nedosegljiv.", result: { insolvency: { status: "unavailable", source: "official_insolvency_portal", sourceLabel: "Insolvenzbekanntmachungen", verificationMode: "official_portal_only", officialVerification: { reason: "official_portal_timeout", source: "official_insolvency_portal", sourceLabel: "Insolvenzbekanntmachungen" } } },
        } }) });
        if (!failureMode && gets >= 4) return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, job: { id: jobId, faza: "insolvenca", status: "completed", attempts: 2, maxAttempts: 2, result: identityPayload("clear") } }) });
        return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, job: { id: jobId, faza: "insolvenca", status: gets === 2 ? "queued" : "processing", attempts: gets >= 2 ? 1 : 0, maxAttempts: 2 } }) });
      }
      if (/\/api\/mehka-boniteta-delavec(?:\?|$)/.test(url)) return request.respond({ status: 202, contentType: "application/json", body: "{\"ok\":true}" });
      return request.continue();
    });

    await page.goto("http://localhost:8001/app/bonitetna-preverba.html?app-preview=1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(function () { return typeof window.UJBonitetaAuditIzrisi === "function"; });
    await page.evaluate(function (payload) { window.UJBonitetaAuditIzrisi(payload); }, identityPayload("not_checked"));
    // Pregled Impressuma glavno kartico začasno skrije. Simuliraj to stanje,
    // da mora končni rezultat kartico izrecno vrniti in ne pustiti praznega
    // zaslona samo z akcijskimi gumbi.
    await page.$eval("#boniteta-hwk-sklop", function (element) { element.hidden = true; });
    await page.waitForFunction(function () { return document.querySelector("#boniteta-identiteta-nadaljuj").classList.contains("is-loading"); });
    assert.equal(await page.$eval("#boniteta-insolvenca-okno", function (el) { return el.hidden; }), true, "loading mora ostati na profilu");
    await page.waitForFunction(function () { return document.querySelector("#boniteta-identiteta-nadaljuj strong").textContent.includes("Brez zaznanih objav"); }, { timeout: 10000 });
    assert.equal(posts, 1, "samodejna worker ponovitev ne sme ustvariti drugega uporabnikovega POST-a");
    assert.equal(await page.$eval("#boniteta-insolvenca-okno", function (el) { return el.hidden; }), true, "compact success mora ostati na profilu do izrecnega klika");
    assert.equal(await page.$eval("#boniteta-hwk-sklop", function (el) { return el.hidden; }), false,
      "zaključen rezultat mora po dokaznem pregledu znova prikazati kartico podjetja");
    assert.equal(await page.$eval("#boniteta-podjetje-pregled", function (el) { return el.hidden; }), false,
      "profil podjetja ne sme ostati prazen samo z akcijskimi gumbi");
    await page.screenshot({ path: "output/playwright/boniteta-profile-restored-after-evidence-390.png", fullPage: true });
    if (process.argv.includes("--profile-restore-only")) {
      console.log("Profil po dokaznem pregledu: kartica in podatki so znova vidni, praznega zaslona ni.");
      return;
    }
    assert.equal(await page.evaluate(function () { return document.body.textContent.includes("Preverjanje ni uspelo"); }), false, "generični failure zaslon se ne sme prikazati");
    await page.click("#boniteta-identiteta-nadaljuj");
    await page.waitForFunction(function () { return !document.querySelector("#boniteta-insolvenca-okno").hidden; });
    assert.equal(posts, 1, "odpiranje podrobnosti ne sme ponovno POST-ati");
    assert.equal(await page.$eval("body", function (el) { return el.classList.contains("boniteta-insolvenca-je-okno"); }), true,
      "zaključen rezultat mora odpreti ločen uradni insolvenčni izid");
    assert.equal(await page.$eval("#boniteta-hwk-sklop", function (el) { return el.getBoundingClientRect().height; }), 0,
      "North Data profil ne sme ostati nad uradnim dokazom");
    assert.equal(await page.$eval(".boniteta-insolvenca-okno__glava", function (el) { return el.hidden; }), false,
      "glava 2. KORAK / Uradni insolvenčni izid mora biti prikazana");
    assert.equal(await page.$eval("#boniteta-insolvenca-okno", function (el) { return el.classList.contains("is-inline-result"); }), false,
      "uradni dokaz se ne sme več razpreti znotraj profila");
    await page.screenshot({ path: "output/playwright/boniteta-dedicated-insolvency-proof-390.png", fullPage: true });
    await page.setViewport({ width: 980, height: 900 });
    assert.equal(await page.evaluate(function () { return document.documentElement.scrollWidth <= document.documentElement.clientWidth; }), true,
      "enotni profil z razprtim dokazom na namizju ne sme povzročiti vodoravnega premika");
    await page.screenshot({ path: "output/playwright/boniteta-dedicated-insolvency-proof-980.png", fullPage: true });
    await page.setViewport({ width: 390, height: 844 });

    failureMode = true;
    posts = 0;
    gets = 0;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(function () { return typeof window.UJBonitetaAuditIzrisi === "function"; });
    await page.evaluate(function (payload) { window.UJBonitetaAuditIzrisi(payload); }, identityPayload("not_checked"));
    await new Promise(function (resolve) { setTimeout(resolve, 6000); });
    var failureText = await page.$eval("#boniteta-identiteta-nadaljuj", function (el) { return el.innerText; });
    assert.match(failureText, /Preveri insolventnost znova/,
      "terminalni UI razlog manjka; POST=" + posts + ", GET=" + gets + ", prikaz=" + failureText);
    assert.equal(posts, 1, "terminalni failure po dveh worker poskusih še vedno uporablja eno exact-once opravilo");
    assert.equal(await page.$eval("#boniteta-insolvenca-okno", function (el) { return el.hidden; }), true, "terminalni failure mora ostati na profilu z retry vrstico");
    var retryPostavitev = await page.$eval("#boniteta-identiteta-nadaljuj", function (el) {
      var cta = el.querySelector(".boniteta-identiteta-nadaljuj__puscica");
      var okvir = el.getBoundingClientRect();
      var gumb = cta.getBoundingClientRect();
      return {
        width: gumb.width,
        height: gumb.height,
        centerDelta: Math.abs((gumb.left + gumb.width / 2) - (okvir.left + okvir.width / 2)),
      };
    });
    assert.ok(retryPostavitev.width >= 80, "retry CTA mora ohraniti enotno širino desne akcije");
    assert.ok(retryPostavitev.height >= 32, "retry CTA mora ohraniti enotno višino desne akcije");

    failureMode = false;
    gets = 0;
    await page.click("#boniteta-identiteta-nadaljuj");
    await page.waitForFunction(function () { return document.querySelector("#boniteta-identiteta-nadaljuj").classList.contains("is-loading"); });
    await page.waitForFunction(function () { return document.querySelector("#boniteta-identiteta-nadaljuj strong").textContent.includes("Brez zaznanih objav"); }, { timeout: 10000 });
    assert.equal(posts, 2, "izrecni klik po nedosegljivem viru mora ustvariti natanko eno novo opravilo");
    console.log("Lütge insolvenčni tok: worker retry, exact-once POST, compact success in terminalni source failure: OK");
  } finally {
    await browser.close();
  }
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
