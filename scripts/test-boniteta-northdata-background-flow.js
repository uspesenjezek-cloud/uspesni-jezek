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

async function main() {
  var browser = await puppeteer.launch({ executablePath: executable(), headless: true, args: ["--no-sandbox"] });
  var page = await browser.newPage();
  var jobId = "22222222-2222-4222-8222-222222222222";
  var proof = "local-proof-for-network-test";
  var detailsPosts = [];
  var primaryPosts = 0;
  try {
    await page.setRequestInterception(true);
    page.on("request", async function (request) {
      if (/\/api\/mehka-boniteta-podrobnosti(?:\?|$)/.test(request.url())) {
        var posted = JSON.parse(request.postData() || "{}");
        detailsPosts.push(posted);
        if (posted.source === "primary") primaryPosts += 1;
        var delni = posted.source === "details"
          ? {
              ok: true, partial: "details", allDone: false, jobId: jobId,
              northDataDetails: { status: "found", company: { name: "Test GmbH", registerNumber: "HRB 123", financials: [] } },
              source: { id: "northdata_details", status: "found" },
            }
          : posted.source === "primary"
            ? primaryPosts === 1 ? {
                ok: true, partial: "primary", allDone: false, jobId: jobId,
                northData: { status: "pending_background", reason: "run_still_running" },
              } : {
                ok: true, partial: "primary", allDone: false, jobId: jobId,
                identity: { status: "verified_register", entityType: "company", ime: "Test GmbH", naziv: "Test GmbH", companyId: "DE-HRB-TEST-123", registerNumber: "HRB 123", purpose: "Testne storitve" },
                northData: { status: "found", company: { name: "Test GmbH", registerNumber: "HRB 123", sourceUrl: "https://www.northdata.com/Test+GmbH/HRB+123" } },
                primarySource: { id: "northdata", status: "found" },
              }
            : {
                ok: true, allDone: true, jobId: jobId,
                identity: { status: "verified_register", entityType: "company", ime: "Test GmbH", naziv: "Test GmbH", companyId: "DE-HRB-TEST-123", registerNumber: "HRB 123", purpose: "Testne storitve" },
                northData: { status: "found", company: { name: "Test GmbH", registerNumber: "HRB 123", sourceUrl: "https://www.northdata.com/Test+GmbH/HRB+123" } },
                northDataDetails: { status: "found", company: { name: "Test GmbH", registerNumber: "HRB 123", financials: [] } },
                source: { id: "northdata_details", status: "found" },
              };
        return request.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(delni),
        });
      }
      return request.continue();
    });
    await page.goto("http://localhost:8001/app/bonitetna-preverba.html?app-preview=1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(function () { return typeof window.UJBonitetaAuditSproziNorthDataPodrobnosti === "function"; });
    await page.evaluate(function (payload, id) {
      window.UJBonitetaAuditIzrisi(payload);
      window.__northDataProgressiveTest = window.UJBonitetaAuditSproziNorthDataPodrobnosti(payload, id);
      return true;
    }, {
      identity: { status: "verified_register", entityType: "company", ime: "Test GmbH", naziv: "Test GmbH", companyId: "DE-HRB-TEST-123", registerNumber: "HRB 123" },
      openregister: { status: "found" },
      northData: { status: "pending_background" },
      northDataDetails: { status: "pending_background" },
      northDataDetailsRequest: { status: "pending", proof: proof, endpoint: "/api/mehka-boniteta-podrobnosti" },
      sources: [],
    }, jobId);
    await page.evaluate(function () { return window.__northDataProgressiveTest; });
    var prazniOpisi = await page.$$eval("[data-podjetje-pogled]", function (nodes) {
      return nodes.reduce(function (rezultat, node) {
        var opis = node.querySelector("small");
        rezultat[node.dataset.podjetjePogled] = opis ? opis.textContent : "";
        return rezultat;
      }, {});
    });
    assert.equal(prazniOpisi.finance, "Ni podatkov");
    assert.equal(prazniOpisi.pot, "Ni podatkov");
    assert.equal(prazniOpisi.dodatno, "Ni podatkov");
    assert.equal(prazniOpisi.plus, "Ni dodatnih info");
    assert.deepStrictEqual(detailsPosts.map(function (entry) { return entry.source; }), ["primary", "details", "primary", "finalize"],
      "frontend mora oba vira začeti vzporedno, tekoči prvi vir ponovno preveriti in ju šele nato finalizirati");
    var prisli = await page.$$eval("[data-podjetje-pogled].is-data-arrived", function (nodes) { return nodes.map(function (node) { return node.dataset.podjetjePogled; }); });
    assert.ok(!prisli.includes("izstopa"), "če nič pomembnega ne izstopa, gumb ne sme dobiti opozorilnega poudarka");
    console.log("✓ Frontend po praznem rezultatu ne opozarja uporabnika, naj odpre pogled Kaj izstopa.");
  } finally {
    await browser.close();
  }
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
