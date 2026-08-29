const fs = require("fs");
const assert = require("assert");
const autocomplete = require("../app/neplacila-podjetje-autocomplete.js");

const html = fs.readFileSync("app/neplacila.html", "utf8");
const css = fs.readFileSync("app/styles.css", "utf8");
const js = fs.readFileSync("app/neplacila-podjetje-autocomplete.js", "utf8");

assert.match(html, /id="naziv-podjetja"[^>]*aria-autocomplete="list"[^>]*aria-controls="naziv-podjetja-predlogi"/);
assert.match(html, /id="naziv-podjetja-predlogi" role="listbox"/);
assert.match(html, /neplacila-podjetje-autocomplete\.js\?v=20260828-one-credit-v11/);
assert.match(html, /styles\.css\?v=20260828-company-autocomplete-v2/);
assert.match(js, /uj:boniteta:company-suggestions:v1/);
assert.match(js, /\/app\/company-index\//);
assert.match(js, /typeof supabaseKlient !== "undefined"/);
assert.doesNotMatch(js, /company_lookup|northdata_autocomplete|openRegisterApi/);
assert.match(js, /action:\s*"debtor_company_search"/);
assert.match(js, /action:\s*"debtor_company_select"/);
assert.match(js, /največ 1 kredit/i);
assert.match(html, /name="openRegisterCompanyId"/);
assert.match(css, /\.podjetje-autocomplete\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?max-height:\s*238px/);
assert.match(css, /\.podjetje-autocomplete__zadetek--register strong\s*\{[^}]*font-size:\s*11\.5px/);

assert(autocomplete.scoreName("Ime Priimek Dejavnost und Storitve GmbH & Co. KG", "Ime Priimek GmbH & Co. KG") >= 0);
assert(autocomplete.scoreName("Drugo Splošno Podjetje GmbH", "Ime Priimek") < 0);

const row = autocomplete.mapRow(["MedienOrbis GmbH", "Frankfurt am Main", "HRB", "137035", "Frankfurt am Main", true, "DE-HRB-M1201-137035"]);
assert.equal(row.name, "MedienOrbis GmbH");
assert.equal(row.registerNumber, "137035");

const profile = autocomplete.mapObject({
  company_id: "DE-1",
  legal_name: "Dolgo preverjeno podjetje za montažo in servis GmbH",
  contact: { phone: "+49 69 123456", email: "info@example.test", contact_person: "Erika Muster" },
  latest_check: { identity: { vatId: "DE123456789" } },
});
assert.deepEqual(autocomplete.availableFields(profile), ["davčna", "kontaktna oseba", "telefon", "e-pošta"]);
assert.equal(profile.vatId, "DE123456789");
assert.equal(profile.contactPerson, "Erika Muster");
assert.equal(profile.phone, "+49 69 123456");
assert.equal(profile.email, "info@example.test");

const enriched = autocomplete.enrichCandidate(row, [{
  company_id: "DE-HRB-M1201-137035",
  legal_name: "MedienOrbis GmbH",
  contact: { phone: "+49 69 123456", email: "kontakt@medienorbis.example" },
  latest_check: { identity: { vatId: "DE987654321" } },
}]);
assert.equal(enriched.name, "MedienOrbis GmbH");
assert.equal(enriched.vatId, "DE987654321");
assert.equal(enriched.phone, "+49 69 123456");
assert.equal(enriched.email, "kontakt@medienorbis.example");
const proofFirst = autocomplete.enrichCandidate({
  company_id: "DE-HRB-M1201-137035",
  name: "MedienOrbis GmbH",
  identity_proof: "signed-user-proof",
  creditsUsed: 1,
}, [{
  company_id: "DE-HRB-M1201-137035",
  legal_name: "MedienOrbis GmbH",
  identity_proof: "",
  contact: { phone: "+49 69 123456" },
}]);
assert.equal(proofFirst.identityProof, "signed-user-proof", "prazen lokalni zadetek ne sme prepisati podpisanega dokaza");
assert.equal(proofFirst.creditsUsed, 1);
assert.equal(proofFirst.phone, "+49 69 123456");
assert.match(js, /generation \+= 1;[\s\S]*?clearTimeout\(timer\);[\s\S]*?input\.dataset\.selectedCompany/);
assert.match(js, /if \(profilesPromise\) await profilesPromise;[\s\S]*?enrichCandidate\(company, profiles\.concat\(cached\)\)/);
assert.match(js, /enrichCandidate\(company, profiles\.concat\(cached\)\);\s*setCompanyIdentity\(company,/);
assert.match(js, /if \(!overwrite && text\(field\.value\)\) return false;/);
assert.match(js, /function dismiss\(\)\s*\{\s*generation \+= 1;\s*win\.clearTimeout\(timer\);\s*close\(\);/);
assert.match(js, /doc\.activeElement === input[\s\S]*?void search\(\)/);
assert.match(js, /doc\.activeElement !== input \|\| ownGeneration !== generation/);
assert.match(js, /focusout[\s\S]*?contains\(doc\.activeElement\)[\s\S]*?dismiss\(\)/);

console.log("OK: naziv podjetja uporablja skupni brezplačni imenik in izpolni samo dejansko prisotne podatke.");
