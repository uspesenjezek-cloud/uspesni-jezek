"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

var sourceHtml = read("app/bonitetna-preverba.html");
var sourceCss = read("app/bonitetna-preverba.css");
var sourceJs = read("app/bauhandwerkersicherung-ui.js");
var centerJs = read("app/boniteta-sredisce.js");
var offerHtml = read("app/pos-terminal.html");
var offerJs = read("app/pos-terminal.js");

assert.match(sourceHtml, /id="boniteta-prenesi-v-ponudbo"[^>]*>Prenesi v ponudbo<[\s\S]*?id="boniteta-eno-spremljaj"[^>]*>Spremljaj podjetje</);
assert.match(sourceJs, /\["verified_register", "confirmed_impressum"\]\.indexOf\(status\)/);
assert.match(sourceJs, /!\/\^\\d\{5\}\$\/\.test\(postalCode\)/);
assert.match(sourceJs, /sessionStorage\.setItem\(offerTransferKey, JSON\.stringify\(payload\)\)/);
assert.match(sourceJs, /location\.href = "pos-terminal\.html\?from=boniteta"/);
assert.match(sourceJs, /uj:boniteta:open-offer-transfer/);
assert.match(sourceJs, /uj:boniteta:offer-transfer-confirmed/);
var transferAction = sourceJs.slice(sourceJs.indexOf("function updateOfferTransferAction"), sourceJs.indexOf("function transferToOffer"));
assert.match(transferAction, /if \(wrap\) wrap\.hidden = false/);
assert.doesNotMatch(transferAction, /monitor\.hidden|boniteta-eno-spremljaj/, "prikaz prenosa v ponudbo ne sme več skrivati neodvisnega gumba Spremljaj");
assert.doesNotMatch(sourceJs.slice(sourceJs.indexOf("function offerTransferPayload"), sourceJs.indexOf("function updateOfferTransferAction")), /northData|raw/i);
assert.match(sourceHtml, /id="boniteta-ponudba-spremljanje"[^>]*checked/);
assert.match(sourceHtml, /id="boniteta-spremljanje-opis"[^>]*hidden>V ponudbo se prenesejo varnostna in plačilna priporočila glede na trenutno stanje podjetja\.<\/p>/);
assert.match(centerJs, /el\("boniteta-spremljanje-opis"\)\.hidden=!monitoringOfferTransfer/);
assert.match(sourceHtml, /id="boniteta-spremljanje-glava-ikona"[\s\S]*?<svg viewBox="0 0 24 24">/);
assert.match(centerJs, /el\("boniteta-spremljanje-glava-ikona"\)\.hidden=!monitoringOfferTransfer/);
assert.match(sourceHtml, /data-offer-company-choice="0"[\s\S]*?boniteta-ponudba-podjetja__izbrano[\s\S]*?data-offer-company-choice="1"[\s\S]*?data-offer-company-choice="both"[\s\S]*?Primerjalni povzetek obeh[\s\S]*?Priporočeno/);
assert.match(sourceHtml, /data-offer-company-choice="0"[^>]*>[\s\S]*?data-fit-text-lines="2" data-fit-text-container="button"[\s\S]*?data-offer-company-choice="1"[^>]*>[\s\S]*?data-fit-text-lines="2" data-fit-text-container="button"/);
assert.match(sourceCss, /\.boniteta-ponudba-podjetja__izbire \{[^}]*display: grid;[^}]*gap: 8px;/);
assert.match(sourceCss, /\.boniteta-ponudba-podjetja__izbire button > strong \{[^}]*overflow: visible;[^}]*overflow-wrap: anywhere;[^}]*white-space: normal;/);
assert.match(sourceCss, /\.boniteta-ponudba-podjetja__izbire \.boniteta-ponudba-podjetja__obe \{[^}]*grid-template-columns: 36px minmax\(0,1fr\) auto 26px;[^}]*background: linear-gradient/);
assert.match(sourceCss, /button\[aria-pressed="true"\] \.boniteta-ponudba-podjetja__izbrano \{[^}]*background: #087f87;[^}]*color: #fff;/);
assert.match(sourceHtml, /id="boniteta-ponudba-izbire"[\s\S]*?id="boniteta-650f"[\s\S]*?id="boniteta-spremljanje-podjetja"/);
assert.match(sourceCss, /\.boniteta-ponudba-izbire \.boniteta-650f__widget \{[^}]*padding: 0;[^}]*border: 0;[^}]*background: transparent/);
assert.match(sourceCss, /\.boniteta-spremljanje-nastavitev__zakljucek \{[^}]*padding: 0;[^}]*border: 0;[^}]*background: transparent/);
assert.match(sourceCss, /#boniteta-spremljanje-vklopi \{[^}]*width: 100%;[^}]*max-width: none/);
assert.match(sourceHtml, /id="boniteta-spremljanje-obdobje"[\s\S]*?id="boniteta-spremljanje-od"[^>]*type="date"[^>]*required[\s\S]*?id="boniteta-spremljanje-do"[^>]*type="date"[^>]*required[\s\S]*?Priporočena prva poizvedba se začne[\s\S]*?id="boniteta-spremljanje-zacetek"[^>]*type="date"[^>]*required[\s\S]*?id="boniteta-spremljanje-ura"[^>]*type="time"/);
assert.match(sourceHtml, /boniteta-spremljanje-obdobje__locnica[\s\S]*?id="boniteta-spremljanje-prva-naslov">Priporočena prva poizvedba se začne<\/strong>/);
assert.match(centerJs, /boniteta-spremljanje-prva-naslov"\)\.textContent=recommended\?"Priporočena prva poizvedba se začne":"Prva poizvedba se začne"/);
assert.match(sourceCss, /boniteta-spremljanje-obdobje__locnica::before,[\s\S]*?background: #c5e2dd;/);
assert.match(sourceCss, /boniteta-spremljanje-obdobje__prva-poizvedba \{[^}]*border-radius: 13px;[^}]*background: linear-gradient\(135deg,#f5fbf9,#eaf7f3\)/);
var recommendationSection = sourceHtml.match(/<section class="boniteta-spremljanje-priporocilo"[\s\S]*?<\/section>/)[0];
assert.doesNotMatch(recommendationSection, /id="boniteta-spremljanje-(?:zacetek|ura)"/);
assert.match(sourceCss, /\.boniteta-spremljanje-obdobje__prva-poizvedba > div:last-child \{[^}]*grid-template-columns: minmax\(0,1fr\) 98px/);
assert.match(centerJs, /offerTransfer:true,reason:detail\.reason/);
assert.match(centerJs, /monitoringOfferTransfer&&!monitorSelected[\s\S]*?finishOfferTransfer\(status,button\)/);
assert.match(centerJs, /monitoringOfferTransfer\?"Prenesi v ponudbo":monitoringEditProfileId\?"Shrani spremembe":"Vklopi spremljanje"/);
assert.match(centerJs, /el\("boniteta-spremljanje-obdobje"\)\.hidden=!monitorSelected\|\|!detailsOpen/);
assert.match(centerJs, /el\("boniteta-spremljanje-strosek"\)\.hidden=!detailsOpen/);
assert.match(centerJs, /el\("boniteta-spremljanje-od"\)\.value=existing&&existing\.projectStartDate\|\|""[\s\S]*?el\("boniteta-spremljanje-do"\)\.value=existing&&existing\.projectEndDate\|\|""[\s\S]*?el\("boniteta-spremljanje-zacetek"\)\.value=existing&&existing\.monitoringStartDate\|\|monitoringToday\(\)/);
assert.match(centerJs, /var schedule=validateMonitoringSchedule\(\)[\s\S]*?if\(!schedule\.valid\)/);
assert.match(centerJs, /projectStartDate:schedule\.projectStartDate,projectEndDate:schedule\.projectEndDate,monitoringStartDate:schedule\.monitoringStartDate,checkTime:schedule\.checkTime,startImmediately:schedule\.startImmediately/);
assert.match(centerJs, /1 kredit ob izvedenem preverjanju/);
assert.match(centerJs, /Vklop: 0 kreditov/);
assert.match(centerJs, /value:"daily",label:"Dnevno"/);
assert.doesNotMatch(centerJs, /value:"daily",label:"Takoj"/);
assert.match(centerJs, /function monitoringFrequency\(company\)[\s\S]*?return"monthly"/);
assert.match(centerJs, /boniteta-spremljanje-od"\)\.addEventListener\("input",updateMonitoringSummary\)[\s\S]*?boniteta-spremljanje-do"\)\.addEventListener\("input",updateMonitoringSummary\)[\s\S]*?boniteta-spremljanje-zacetek"\)\.addEventListener\("input",updateMonitoringSummary\)[\s\S]*?boniteta-spremljanje-ura"\)\.addEventListener\("input",updateMonitoringSummary\)/);
assert.doesNotMatch(sourceHtml, /id="boniteta-spremljanje-takoj"/);
assert.doesNotMatch(centerJs, /el\("boniteta-spremljanje-takoj"\)/);
assert.match(centerJs, /async function confirmOfferTransfer\(\)[\s\S]*?api\("\/api\/boniteta-profili\?id="\+encodeURIComponent\(company\.profileId\)\)/);
assert.match(sourceJs, /function profileTransferData\(profile\)[\s\S]*?companyId \? "verified_register"/);
assert.match(sourceJs, /return \{ version: 2,[\s\S]*?companies: list \}/);

assert.match(offerHtml, /data-boniteta-transfer[^>]*hidden/);
assert.match(offerHtml, /Preneseno iz bonitetne preverbe/);
assert.match(offerJs, /function normalizeBonitetaContext/);
assert.match(offerJs, /normalizeBonitetaContext\(JSON\.parse\([\s\S]*?\), true\)/);
assert.match(offerJs, /boniteta_context: normalizeBonitetaContext\(draft\.bonitetaContext\)/);
assert.match(offerJs, /customerType = "business"/);
assert.match(offerJs, /customerName = context\.company\.name/);
assert.match(offerJs, /customerStreet = context\.company\.street/);
assert.match(offerJs, /customerPostalCode = context\.company\.postalCode/);
assert.match(offerJs, /customerCity = context\.company\.city/);
assert.match(offerJs, /Prenesti podjetje v novo ponudbo\?/);
assert.match(offerJs, /Prenesti obe podjetji v novo ponudbo\?/);
assert.match(offerJs, /version !== 1 && version !== 2/);
assert.match(offerJs, /companies\.length === 1[\s\S]*?draft\.customerName = context\.company\.name/);
assert.match(offerJs, /Primerjava obeh podjetij je prenesena\. Izberite prejemnika ponudbe\./);
assert.match(offerJs, /if \(bonitetaReturn\) initialLoad\.then\(importBonitetaOfferTransfer\)/);
assert.match(offerJs, /§650f je označen za preverjanje pri ponudbi/);
assert.doesNotMatch(offerJs, /legal_review_approved[\s\S]{0,200}importBonitetaOfferTransfer|importBonitetaOfferTransfer[\s\S]{0,200}legal_review_approved/);

var normalizerSource = offerJs.slice(
  offerJs.indexOf("function normalizeBonitetaItem"),
  offerJs.indexOf("function defaultDraft")
);
var normalizerContext = {
  BONITETA_OFFER_TRANSFER_MAX_AGE_MS: 24 * 60 * 60 * 1000,
  BONITETA_OFFER_TRANSFER_FUTURE_SKEW_MS: 5 * 60 * 1000,
};
vm.runInNewContext(normalizerSource + "\nthis.normalizeBonitetaContext = normalizeBonitetaContext;", normalizerContext);

var now = Date.now();
var validTransfer = {
  version: 1,
  transferredAt: new Date(now - 60 * 1000).toISOString(),
  expiresAt: new Date(now + 23 * 60 * 60 * 1000).toISOString(),
  company: {
    name: "Musterbau GmbH",
    street: "Werkstraße 12",
    postalCode: "10115",
    city: "Berlin",
    identityStatus: "verified_register",
  },
  verification: { identityStatus: "verified_register" },
};
assert.ok(normalizerContext.normalizeBonitetaContext(validTransfer, true), "Svež 24-urni prenos mora biti sprejet.");
var validComparisonTransfer = {
  version: 2,
  transferredAt: validTransfer.transferredAt,
  expiresAt: validTransfer.expiresAt,
  companies: [
    validTransfer,
    Object.assign({}, validTransfer, {
      company: Object.assign({}, validTransfer.company, { name: "Zweite Bau GmbH", city: "Hamburg", postalCode: "20095" }),
    }),
  ],
};
assert.equal(normalizerContext.normalizeBonitetaContext(validComparisonTransfer, true).companies.length, 2, "Primerjalni prenos mora ohraniti obe preverjeni podjetji.");
assert.equal(normalizerContext.normalizeBonitetaContext(Object.assign({}, validComparisonTransfer, {
  companies: [validTransfer, Object.assign({}, validTransfer, {
    company: Object.assign({}, validTransfer.company, { identityStatus: "unverified" }),
    verification: { identityStatus: "unverified" },
  })],
}), true), null, "Primerjalni prenos mora biti zavrnjen, če identiteta enega podjetja ni potrjena.");
assert.equal(normalizerContext.normalizeBonitetaContext(Object.assign({}, validTransfer, { expiresAt: "" }), true), null, "Prenos brez roka veljavnosti mora biti zavrnjen.");
assert.equal(normalizerContext.normalizeBonitetaContext(Object.assign({}, validTransfer, { expiresAt: new Date(now - 1).toISOString() }), true), null, "Pretečen prenos mora biti zavrnjen.");
assert.equal(normalizerContext.normalizeBonitetaContext(Object.assign({}, validTransfer, { transferredAt: new Date(now + 6 * 60 * 1000).toISOString() }), true), null, "Prenos iz prihodnosti mora biti zavrnjen.");
assert.equal(normalizerContext.normalizeBonitetaContext(Object.assign({}, validTransfer, { expiresAt: new Date(now + 25 * 60 * 60 * 1000).toISOString() }), true), null, "Predolg rok prenosa mora biti zavrnjen.");

console.log("Boniteta prenos v ponudbo: OK");
