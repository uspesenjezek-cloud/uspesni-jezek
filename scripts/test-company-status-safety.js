"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var safety = require("../api/_lib/company-status-safety");
var softCheck = require("../api/_handlers/mehka-boniteta")._test;

var now = Date.parse("2026-08-31T20:00:00.000Z");
var companyId = "DE-HRA-F1103-56196";
var validEvidence = {
  registryStatusEvidence: {
    verified: true,
    version: safety.EVIDENCE_VERSION,
    status: "inactive",
    source: "openregister_company_detail",
    companyId: companyId,
    checkedAt: "2026-08-31T19:55:00.000Z",
  },
};

assert.strictEqual(safety.safeActive(true, {}, companyId, now), true);
assert.strictEqual(safety.safeActive(false, {}, companyId, now), null, "Surov false mora postati neznan status.");
assert.strictEqual(safety.safeCompanyStatus("inactive", {}, companyId, now), "unknown", "Nedokazan inactive mora postati unknown.");
assert.strictEqual(safety.safeActive(false, validEvidence, companyId, now), false, "Samo svež uradni dokaz sme ohraniti false.");
assert.strictEqual(safety.safeCompanyStatus("inactive", validEvidence, companyId, now), "inactive");
assert.strictEqual(safety.safeActive(false, validEvidence, "DE-HRA-F1103-OTHER", now), null, "Dokaz drugega podjetja ne velja.");
assert.strictEqual(safety.safeActive(false, {
  registryStatusEvidence: Object.assign({}, validEvidence.registryStatusEvidence, { source: "search_result" }),
}, companyId, now), null, "Iskalni zadetek ni zadosten dokaz.");
assert.strictEqual(safety.safeActive(false, {
  registryStatusEvidence: Object.assign({}, validEvidence.registryStatusEvidence, { checkedAt: "2026-08-29T19:55:00.000Z" }),
}, companyId, now), null, "Zastarel dokaz ne velja.");
assert.strictEqual(safety.safeImpressumRegisterNumber("RB RohrBlitz UG", "HRA 56196 B"), "", "UG ne sme prevzeti starega HRA zapisa.");
assert.strictEqual(safety.safeImpressumRegisterNumber("RB RohrBlitz UG (haftungsbeschränkt)", "HRB 229686"), "HRB 229686");
assert.strictEqual(safety.safeImpressumRegisterNumber("Muster GmbH & Co. KG", "HRA 12345"), "HRA 12345");
assert.strictEqual(safety.safeImpressumRegisterNumber("Muster KG Verwaltungsgesellschaft GmbH", "HRB 123"), "HRB 123", "KG sredi naziva ne sme preglasiti končne oblike GmbH.");
assert.strictEqual(safety.safeImpressumRegisterNumber("ND-Anlagenmechanik", "HRB 000000"), "",
  "ničelna registrska številka se ne sme širiti v OpenRegister ali uporabniški rezultat");
assert.strictEqual(safety.safeImpressumRegisterNumber("IKK, Installateur & Klempnerhandwerk Köpenick GmbH", "HRB-Nr.: 38 422"), "HRB 38422",
  "Registrska številka s presledkom za tisočice mora ostati celovita in kanonična.");

var inactiveCompany = { company_id: "DE-HRA-B1601-705145", active: false };
var inactiveDetail = { id: "DE-HRA-B1601-705145", status: "inactive" };
var inactiveStatusEvidence = softCheck.sestaviDokaziloNeaktivnegaStatusaOpenRegister(
  inactiveCompany,
  inactiveDetail,
  "2026-09-03T01:00:00.000Z"
);
assert.strictEqual(inactiveStatusEvidence.status, "inactive", "Ujemajoči detail mora ustvariti dokaz neaktivnosti.");
assert.strictEqual(inactiveStatusEvidence.source, "openregister_company_detail");
assert.strictEqual(softCheck.sestaviDokaziloNeaktivnegaStatusaOpenRegister(
  inactiveCompany,
  { id: "DE-HRA-B1601-OTHER", status: "inactive" }
), null, "Detail drugega podjetja ne sme veljati.");
assert.strictEqual(softCheck.sestaviDokaziloNeaktivnegaStatusaOpenRegister(
  inactiveCompany,
  { id: inactiveCompany.company_id, status: "active" }
), null, "Aktivni detail ne sme ustvariti negativnega dokazila.");

var convertedInactiveCompany = softCheck.pretvoriOpenRegisterPodrobnostiVPodjetje({
  id: inactiveCompany.company_id,
  status: "inactive",
  name: { name: "ARN Assekuranzmakler Rhein-Neckar e.K.", legal_form: "e.K." },
  register: { register_type: "HRA", register_number: "705145", register_court: "Mannheim" },
  address: { street: "Talhausring 22", postal_code: "68219", city: "Mannheim", country: "DE" },
  incorporated_at: "2013-08-28",
});
assert.strictEqual(convertedInactiveCompany.active, false, "V1 status inactive mora postati neaktiven status.");
assert.strictEqual(convertedInactiveCompany.registryStatusEvidence.status, "inactive", "V1 detail mora nositi uradno negativno dokazilo.");
assert.strictEqual(convertedInactiveCompany.register_number, "705145");

var inactiveIdentity = {
  status: "verified_register",
  entityType: "company",
  active: false,
  companyId: inactiveCompany.company_id,
  ime: "ARN Assekuranzmakler Rhein-Neckar e.K.",
  naslov: "Talhausring 22",
  postnaStevilka: "68219",
  kraj: "Mannheim",
  registerNumber: "HRA 705145",
};
assert.strictEqual(softCheck.pripraviSamodejnoRegistrskoPotrditev(inactiveIdentity, {
  evidenceReady: true,
  evidenceKind: "structured_api",
}, null).reason, "company_inactive", "Neaktivno podjetje ne sme mimo samodejnega gatea.");
assert.strictEqual(softCheck.preveriSkladnostIdentiteteZaInsolvenco(inactiveIdentity).reason, "company_inactive",
  "Neposredni strežniški insolvenčni klic mora biti blokiran.");
assert.strictEqual(softCheck.sestaviSklep(inactiveIdentity, { status: "not_checked", reason: "company_inactive" }).level, "red",
  "Neaktivnost mora sprožiti opozorilo.");

function source(relative) {
  return fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
}

var resultUi = source("app/bonitetna-preverba.js");
var resultCss = source("app/bonitetna-preverba.css");
var centerUi = source("app/boniteta-sredisce.js");
var profileUi = source("app/boniteta-profil.js");
var autocompleteUi = source("app/neplacila-podjetje-autocomplete.js");
var softCheckHandler = source("api/_handlers/mehka-boniteta.js");

assert(resultUi.includes("podatki = nevtralizirajNedokazanNegativniStatus(podatki);"), "Glavni rezultat mora pred izrisom nevtralizirati nedokazan status.");
assert(resultUi.includes('identiteta.active === true &&'), "Samodejna insolvenčna pot zahteva potrjeno aktiven status.");
assert(resultUi.includes('opozoriloNaslov.textContent = "Podjetje ni aktivno"'), "Neaktivno podjetje mora prikazati opozorilo namesto CTA-ja.");
assert(resultUi.includes('identiteta.active === false ? "Neaktivno"'), "Registrski prikaz mora ločiti neaktivno od neznanega stanja.");
assert(resultCss.includes(".boniteta-identiteta-nadaljuj.is-inactive-warning"), "Neaktivno opozorilo mora imeti lasten rdeč prikaz.");
assert.match(resultCss, /\.boniteta-podatki--identiteta\.is-state-yellow\s*\{\s*background:\s*#fff;/,
  "Nepotrjen status mora ostati bel.");
assert(!resultUi.includes("register kaže neaktivno podjetje"), "UI ne sme podati nevarne trditve iz surovega statusa.");
assert(centerUi.includes('statusNiPotrjen=Boolean(p&&p.company_status==="inactive")'), "Kartice morajo prepoznati stare inactive zapise.");
assert(centerUi.includes('Status ni potrjen</span>'), "Kartice morajo nedokazan status prikazati nevtralno.");
assert(!centerUi.includes("Podjetje je v registru označeno kot neaktivno."), "Središče ne sme ponavljati nedokazane negativne trditve.");
assert(profileUi.includes('inactive:"Status ni potrjen"'), "Profil mora stari inactive prikazati nevtralno.");
assert(autocompleteUi.includes('active: x.active === true || x.company_status === "active" ? true : null'), "Autocomplete ne sme manjkajočega statusa pretvoriti v false.");
assert(softCheckHandler.includes('await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" })'), "Produkcijski Chromium mora razrešiti asinhrone privzete argumente.");
assert(softCheckHandler.includes("companyStatusSafety.safeImpressumRegisterNumber"), "Impressum register mora skozi preverjanje pravne oblike.");
assert(!softCheckHandler.includes('/v1/company/'),
  "Mehka preverba ne sme porabiti kredita za podrobni OpenRegister Company zapis.");
assert(softCheckHandler.includes("phase: \"local_company_index_candidate_validation\""),
  "Izbrani zapis iz naše baze mora ostati samo lokalni kandidat.");
assert(softCheckHandler.includes("inputSource: \"validated_local_company_index_candidate\""),
  "Preverjanje izbrane lokalne kartice mora nadaljevati s svežim OpenRegister Search klicem.");
assert(softCheckHandler.includes("openregister = await poisciOpenRegisterNajvecEnkrat(lokalniOpenRegisterVnos, { forceFresh: true })"),
  "OpenRegister mora izbrano lokalno kartico vedno dejansko preveriti.");

console.log("Company-status legal safety: OK");
