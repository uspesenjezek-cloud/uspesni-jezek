"use strict";
var assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
var model = require("../app/bauhandwerkersicherung"), service = require("../api/_lib/bauhandwerkersicherung-service");
var official = "https://www.gesetze-im-internet.de/bgb/__650f.html", now = "2026-08-26T10:00:00.000Z";

var one = model.detectChanges({ checkedAt: now, events: [{ category: "Management", date: "2026-07-01", source: "Handelsregister", sourceUrl: "https://www.handelsregister.de", description: "Nova poslovodja" }] });
assert.equal(one.status, "verified_change"); assert.equal(one.tone, "yellow"); assert.equal(one.changes[0].type, "leadership"); assert.equal(one.changes[0].checkedAt, now); assert.equal(one.changes[0].source, "Handelsregister");
assert.doesNotMatch(one.message, /insolventnost grozi|grozi insolventnost/i);
var important = model.detectChanges({ checkedAt: now, events: [{ category: "Ownership", date: "2026-06-01", source: "Register", sourceUrl: "https://register.example/1" }] });
assert.equal(important.tone, "red"); assert.match(important.message, /ročni pregled/i); assert.match(important.message, /ne pomeni insolventnosti/i);
var missing = model.detectChanges({ checkedAt: now, events: [{ category: "Legal form", date: "2026-06-01" }] });
assert.equal(missing.status, "unverifiable"); assert.equal(missing.changes.length, 0);

assert.equal(model.recommend({ constructionProject: true, projectValue: "50000", elevatedRisk: true }).eligible, true);
assert.equal(model.recommend({ constructionProject: false, projectValue: "50000", elevatedRisk: true }).eligible, false);
assert.equal(model.recommend({ constructionProject: true, projectValue: "49999.99", elevatedRisk: true }).eligible, false);
assert.equal(model.recommend({ constructionProject: true, projectValue: "50000", elevatedRisk: false }).eligible, false);

var base = { workType: "construction", customerType: "business", publicLawException: false, consumerContractType: "none", authorizedConstructionManager: false, unpaidAmount: "10000", additionalOrders: "1250.50", deadline: "2026-09-15", deadlineConfirmed: true };
var calculation = model.calculate(base); assert.deepEqual(calculation, { unpaidCents: 1000000, additionalOrdersCents: 125050, securedClaimCents: 1125050, ancillaryClaimsCents: 112505, totalSecurityCents: 1237555, ancillaryRate: 0.10 });
assert.throws(function () { model.calculate(Object.assign({}, base, { unpaidAmount: "" })); }, function (error) { return error.code === "ELIGIBILITY_INCOMPLETE"; });
assert.equal(model.eligibility(Object.assign({}, base, { customerType: "public", publicLawException: true })).code, "PUBLIC_LAW_EXCEPTION");
assert.equal(model.eligibility(Object.assign({}, base, { customerType: "consumer", consumerContractType: "verbraucherbauvertrag", authorizedConstructionManager: false })).code, "CONSUMER_CONTRACT_EXCEPTION");
assert.equal(model.eligibility(Object.assign({}, base, { customerType: "consumer", consumerContractType: "bautraegervertrag", authorizedConstructionManager: true })).eligible, true);

var identity = { status: "verified_register", locationStatus: "matched", legalName: "Bau GmbH", street: "Bauweg 1", postalCode: "10115", city: "Berlin", sourceUrl: "https://openregister.de/company/1" };
var draft = model.createDraft({ identity: identity, eligibility: base, contractor: { legalName: "Handwerk GmbH" }, contract: { reference: "V-2026-4", project: "Sanacija strehe" }, checkedAt: now });
assert.equal(draft.label, "Osnutek – ni pravno svetovanje"); assert.equal(draft.officialSourceUrl, official); assert.equal(draft.sendGate.allowed, false);
assert.throws(function () { model.sendGate(draft, { craftsmanConfirmed: true }); }, function (error) { return error.code === "LEGAL_REVIEW_REQUIRED"; });
var approved = Object.assign({}, draft, { sendGate: { legalReviewStatus: "legal_review_approved" } });
assert.throws(function () { model.sendGate(approved, { craftsmanConfirmed: true }); }, function (error) { return error.code === "SEND_TRANSPORT_NOT_CONNECTED"; });

(async function () {
  var inserted650f = null, verifiedProfile = { id: "45b98dc3-0d56-4e82-90ac-c191a1711400", legal_name: "Prava Bau GmbH", company_id: "DE-HRB-X-650", register_number: "HRB 650", register_court: "Berlin", checked_at: now, address: { street: "Prava ulica 1", postal_code: "10115", city: "Berlin" } };
  var prepared650f = await service.prepare({}, "user", { profileId: verifiedProfile.id, identity: { legalName: "Ponarejena GmbH" }, eligibility: base, contractor: { legalName: "Handwerk GmbH" }, contract: { reference: "V-2026-5", project: "Sanacija fasade" } }, { getProfile: async function () { return verifiedProfile; }, rest: async function (_cfg, _path, options) { inserted650f = options.body; return [{ id: "45b98dc3-0d56-4e82-90ac-c191a171142d" }]; } });
  assert.equal(prepared650f.draft.parties.customer.legalName, "Prava Bau GmbH", "identiteta osnutka mora priti iz lastnega preverjenega profila, ne iz body.identity");
  assert.equal(prepared650f.draft.parties.customer.sourceUrl, "https://openregister.de/company/DE-HRB-X-650");
  assert.equal(inserted650f.legal_review_status, "pending", "nov osnutek se nikoli ne sme ustvariti kot pravno odobren");
  var store = { rest: async function () { return [{ id: "45b98dc3-0d56-4e82-90ac-c191a171142c", draft_payload: draft, legal_review_status: "pending" }]; } };
  await assert.rejects(service.send({}, "user", { draftId: "45b98dc3-0d56-4e82-90ac-c191a171142c", craftsmanConfirmed: true }, store), function (error) { return error.code === "LEGAL_REVIEW_REQUIRED"; });
  store.rest = async function () { return [{ id: "45b98dc3-0d56-4e82-90ac-c191a171142c", draft_payload: draft, legal_review_status: "legal_review_approved" }]; };
  await assert.rejects(service.send({}, "user", { draftId: "45b98dc3-0d56-4e82-90ac-c191a171142c", craftsmanConfirmed: true }, store), function (error) { return error.code === "SEND_TRANSPORT_NOT_CONNECTED"; });
  var authorityMigration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260830220944_boniteta_authority_and_ownership_guards.sql"), "utf8");
  assert.match(authorityMigration, /revoke all on table public\.boniteta_650f_osnutki from public, anon, authenticated/);
  assert.match(authorityMigration, /drop policy if exists boniteta_650f_lastni_insert/);
  var html = fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-preverba.html"), "utf8"), check = fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-preverba.js"), "utf8"), center = fs.readFileSync(path.join(__dirname, "..", "app", "boniteta-sredisce.js"), "utf8"), css = fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-preverba.css"), "utf8");
  var ui = fs.readFileSync(path.join(__dirname, "..", "app", "bauhandwerkersicherung-ui.js"), "utf8");
  assert.match(check, /window\.UJBonitetaZadnjiRezultat = podatki;[\s\S]*?uj:boniteta:result-data/); assert.match(ui, /current = window\.UJBonitetaZadnjiRezultat \|\| null/); assert.match(ui, /renderRecommendation\(\);\s*updateOfferTransferAction\(\);/); assert.match(ui, /available = Boolean\(transferableIdentity\(current\)\)[\s\S]*?wrap\.hidden = false/);
  assert.doesNotMatch(html, /data-650f-changes|<h4>Vodstvo in lastništvo<\/h4>/); assert.match(html, /id="boniteta-ponudba-izbire"[\s\S]*?id="boniteta-650f"[\s\S]*?id="boniteta-spremljanje-podjetja"/); assert.match(html, /data-650f-acknowledge[^>]*aria-pressed="false"/); assert.match(html, /Zavarovanje plačila \(§650f\)/); assert.doesNotMatch(html, /id="boniteta-spremljanje-vklopi"[\s\S]*?id="boniteta-650f"/); assert.doesNotMatch(html, /Obvezni eligibility vprašalnik|data-650f-create|Pošiljanje blokirano/); assert.match(ui, /root\.dataset\.recommended\s*=\s*recommendation\.eligible/); assert.match(ui, /root\.hidden\s*=\s*false[\s\S]*?widget\.hidden\s*=\s*false/); assert.match(ui, /root\.dataset\.recommended === "true" \? "Priporočeno za dodatno preverjanje pri ponudbi\." : "Možnost lahko preverite pri pripravi ponudbe\."/); assert.match(ui, /sessionStorage\.setItem\(storageKey/); assert.match(ui, /setAttribute\("aria-pressed"/); assert.match(ui, /model\.recommend/); assert.match(center, /key:"governance",label:"Vodstvo in lastništvo"/); assert.doesNotMatch(css, /\.boniteta-650f--spremljanje/); assert.match(css, /\.boniteta-650f__izbira\[aria-pressed="true"\]/); assert.match(css, /@media \(max-width: 560px\)/);
  console.log("Bauhandwerkersicherung §650f in spremembe vodstva: OK");
})().catch(function (error) { console.error(error); process.exitCode = 1; });
