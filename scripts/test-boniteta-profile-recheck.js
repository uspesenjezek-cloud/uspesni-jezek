"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = "true";

var root = path.resolve(__dirname, "..");
var queue = require("../api/_lib/mehka-boniteta-queue");

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

async function main() {
  var center = source("app/boniteta-sredisce.js");
  var check = source("app/bonitetna-preverba.js");
  var handler = source("api/_handlers/mehka-boniteta.js");

  assert.match(center, /data-new-profile-check/);
  assert.match(center, /await window\.UJBonitetaPonovnoPreveriProfil\(profile\);showCenter\("new"\)/,
    "pogled z rezultatom se sme odpreti šele po pripravljeni ponovni preverbi");
  assert.match(center, /steps=\["Preverjam register …","Preverjam sedež …","Preverjam status …","Preverjam finance …","Preverjam vodstvo …","Preverjam povezave …","Preverjam insolventnost …","Primerjam podatke …","Sestavljam rezultat …"\][\s\S]*step>=steps\.length[\s\S]*window\.setTimeout\(showStep,1500\)/,
    "med čakanjem se mora devet različnih korakov menjati na 1,5 sekunde brez ponavljanja");
  assert.doesNotMatch(center, /newCheckHref="bonitetna-preverba\.html\?ime=/,
    "kartica ne sme več odpreti praznega začetnega iskalnika z vnaprej izpolnjenim imenom");
  assert.match(check, /latest\.identityStatus \|\| latest\.identity_status \|\| identity\.status \|\| ""/,
    "nova preverba mora prebrati dejansko gnezdeno identiteto produkcijskega profila");
  assert.match(check, /Boolean\(companyId\) && \(identityStatus === "verified_register" \|\| Boolean\(registerNumber && registerCourt\)\)/);
  assert.match(check, /identityStatus === "confirmed_impressum" && Boolean\(website\)/);
  assert.match(check, /confirmedIdentity:[\s\S]*companyId: companyId,[\s\S]*confirmed: true/,
    "ponovna preverba mora ohraniti strogi identitetni prehod");
  assert.match(handler, /forceFresh: telo\.monitoringMode === "internal_recheck" \|\| telo\.recheckMode === "saved_profile"/,
    "ročna nova preverba shranjenega profila mora izvesti sveže registrsko iskanje");
  assert.match(handler, /var svezaNorthDataPreverba = telo\.recheckMode === "saved_profile" \|\| telo\.monitoringMode === "internal_recheck"/,
    "ročna in monitoring ponovna preverba morata obiti North Data predpomnilnik");
  assert.match(handler, /enrichVerifiedIdentity\(openregister, identiteta, \{[\s\S]*?disableCache: svezaNorthDataPreverba/,
    "izrecna nova preverba mora sveže zagnati osnovnega North Data agenta");
  assert.match(handler, /enrichAfterPrimary\([\s\S]*?\{ disableCache: svezaNorthDataPreverba \}/,
    "po uspešnem osnovnem ujemanju mora izrecna nova preverba sveže zagnati tudi dopolnilnega North Data agenta");

  var functionStart = check.indexOf("  function vnosZaPonovnoPreverboProfila(profile) {");
  var functionEnd = check.indexOf("\n  window.UJBonitetaPonovnoPreveriProfil", functionStart);
  assert.ok(functionStart >= 0 && functionEnd > functionStart, "funkcija za payload ponovne preverbe mora obstajati");
  var sandbox = {};
  var productionShape = {
    company_id: "DE-HRB-F1103-58650",
    legal_name: "Primer GmbH",
    register_number: "HRB 58650",
    register_court: "Berlin (Charlottenburg)",
    address: { street: "Musterstraße 18", postal_code: "10589", city: "Berlin" },
    contact: { website: "" },
    latest_check: {
      identity: {
        status: "verified_register",
        companyId: "DE-HRB-F1103-58650",
        ime: "Primer GmbH",
        naziv: "Primer GmbH",
      },
      locationMatch: { status: "matched" },
    },
  };
  sandbox.profile = productionShape;
  vm.runInNewContext(check.slice(functionStart, functionEnd) + "\nresult = vnosZaPonovnoPreverboProfila(profile);", sandbox, {
    filename: "bonitetna-profile-recheck-production-shape.js",
  });
  assert.equal(sandbox.result.recheckMode, "saved_profile");
  assert.equal(sandbox.result.openRegisterCompanyId, productionShape.company_id);
  assert.equal(sandbox.result.confirmedIdentity.confirmed, true);

  var staleOfficialProfile = {
    company_id: "DE-HRA-M1201-19176",
    legal_name: "Stari registrski profil GmbH & Co. KG",
    register_number: "HRA 19176",
    register_court: "Frankfurt am Main",
    address: { street: "Neuhofstraße 43", postal_code: "60318", city: "Frankfurt am Main" },
    contact: { website: "" },
    latest_check: { identity: { status: "manual_input" } },
  };
  sandbox.profile = staleOfficialProfile;
  vm.runInNewContext(check.slice(functionStart, functionEnd) + "\nresult = vnosZaPonovnoPreverboProfila(profile);", sandbox, {
    filename: "bonitetna-profile-recheck-stale-official-snapshot.js",
  });
  assert.equal(sandbox.result.openRegisterCompanyId, staleOfficialProfile.company_id);
  assert.equal(sandbox.result.registerNumber, staleOfficialProfile.register_number);

  queue._test.ponastaviPomnilnik();
  var request = {
    ime: "Primer GmbH",
    openRegisterCompanyId: "DE-HRB-123",
    uporabiOpenRegisterIdentiteto: true,
    recheckMode: "saved_profile",
    confirmedIdentity: { confirmed: true, companyId: "DE-HRB-123", name: "Primer GmbH" },
  };
  var first = await queue.ustvari({}, "profile-recheck-user", request);
  var repeatedWhileActive = await queue.ustvari({}, "profile-recheck-user", request);
  assert.equal(repeatedWhileActive.id, first.id, "ponovljen klik med delom mora uporabiti isto aktivno opravilo");
  assert.equal(repeatedWhileActive.reused, true);

  var completed = queue._test.pomnilnik.jobs.get(first.id);
  completed.status = "completed";
  completed.finished_at = new Date().toISOString();
  completed.result_payload = {
    ok: true,
    identity: { status: "verified_register", companyId: "DE-HRB-123" },
    identityEvidence: { status: "verified_api", companyId: "DE-HRB-123" },
  };
  var freshAfterCompletion = await queue.ustvari({}, "profile-recheck-user", request);
  assert.notEqual(freshAfterCompletion.id, first.id, "nov uporabniški klik mora po zaključku ustvariti svežo preverbo");
  assert.equal(freshAfterCompletion.status, "queued");
  assert.equal(freshAfterCompletion.cached, false);

  console.log("Neposredna nova preverba shranjenega profila: OK");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
