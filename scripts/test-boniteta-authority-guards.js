"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
function source(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function sqlFunction(sql, name) {
  var start = sql.indexOf("create or replace function public." + name + "(");
  assert.notEqual(start, -1, name + " mora obstajati v migraciji");
  var bodyStart = sql.indexOf("as $$", start);
  var end = sql.indexOf("$$;", bodyStart);
  assert.ok(bodyStart > start && end > bodyStart, name + " mora imeti zaključeno SQL telo");
  return sql.slice(start, end + 3);
}

process.env.BONITETA_RESOURCE_PROOF_SECRET = "authority-guard-test-secret-with-enough-entropy";

var resourceProof = require("../api/_lib/boniteta-resource-proof");
var projectMonitor = require("../api/_lib/projektno-spremljanje");
var store = require("../api/_lib/boniteta-pro-store");
var db = require("../api/_lib/supabase-server");
var pro = require("../api/_handlers/boniteta-pro")._test;

async function run() {
  var userId = "00000000-0000-4000-8000-000000000101";
  var otherUserId = "00000000-0000-4000-8000-000000000102";
  var profileId = "00000000-0000-4000-8000-000000000201";
  var proof = resourceProof.sign(userId, profileId, "transparency_extract", "extract-17", 1000);
  assert.equal(resourceProof.verify(proof, userId, profileId, "transparency_extract", "extract-17", 2000), true);
  assert.equal(resourceProof.verify(proof, otherUserId, profileId, "transparency_extract", "extract-17", 2000), false, "izpis ne sme preiti k drugemu uporabniku");
  assert.equal(resourceProof.verify(proof, userId, "00000000-0000-4000-8000-000000000202", "transparency_extract", "extract-17", 2000), false, "izpis ne sme preiti na drug profil");
  assert.equal(resourceProof.verify(proof, userId, profileId, "transparency_extract", "extract-18", 2000), false, "dokazilo ne sme veljati za drug ID");
  assert.equal(resourceProof.verify(proof.slice(0, -1) + "x", userId, profileId, "transparency_extract", "extract-17", 2000), false, "spremenjen podpis mora biti zavrnjen");
  assert.equal(resourceProof.verify(proof, userId, profileId, "transparency_extract", "extract-17", 1000 + resourceProof.TTL_MS + 1), false, "poteklo dokazilo mora biti zavrnjeno");

  var official = { status: "clear", evidenceStatus: "captured", evidenceImage: "data:image/jpeg;base64,QUJD" };
  var completed = {
    id: "00000000-0000-4000-8000-000000000301",
    status: "completed",
    updatedAt: "2026-08-30T20:00:00.000Z",
    request: { spletnaStran: "https://primer.de", openRegisterCompanyId: "DE-HRB-X-77", registerNumber: "HRB 77", registerCourt: "Berlin" },
    result: {
      checkedAt: "2026-08-30T19:59:00.000Z",
      identity: { status: "verified_register", companyId: "DE-HRB-X-77", naziv: "Primer GmbH", registerNumber: "HRB 77", registerCourt: "Berlin", active: true, naslov: "Musterstraße 1", postnaStevilka: "10115", kraj: "Berlin" },
      insolvency: { status: "clear", officialVerification: official },
      result: { level: "green", title: "Brez posebnosti" },
    },
  };
  var profile = pro.profileFromCompletedJob(completed);
  assert.equal(profile.companyId, "DE-HRB-X-77");
  assert.equal(profile.legalName, "Primer GmbH");
  assert.equal(profile.latestCheck.queueJobId, completed.id);
  assert.equal(profile.latestCheck.insolvency.officialVerification.evidenceStatus, "captured");
  assert.equal(profile.latestCheck.insolvency.officialVerification.serverEvidenceVerified, true);
  var markerOnlyCompleted = JSON.parse(JSON.stringify(completed));
  delete markerOnlyCompleted.result.insolvency.officialVerification.evidenceImage;
  markerOnlyCompleted.result.insolvency.officialVerification.serverEvidenceVerified = true;
  assert.equal(store.imaPopolnUradniInsolvencniRezultat(markerOnlyCompleted.result), false,
    "svež queue rezultat mora vsebovati dejanski dokazni posnetek, ne le markerja");
  assert.throws(function () { pro.profileFromCompletedJob(markerOnlyCompleted); }, function (error) {
    return error.code === "INSOLVENCY_EVIDENCE_INCOMPLETE";
  }, "marker-only persisted payload se ne sme oprati v svež completed job");
  assert.throws(function () { pro.profileFromCompletedJob(Object.assign({}, completed, { status: "processing" })); }, function (error) { return error.code === "COMPLETED_CHECK_REQUIRED"; });
  assert.throws(function () { pro.profileFromCompletedJob(Object.assign({}, completed, { result: Object.assign({}, completed.result, { insolvency: { status: "clear" } }) })); }, function (error) { return error.code === "INSOLVENCY_EVIDENCE_INCOMPLETE"; });

  assert.equal(pro.containsResourceId({ documents: [{ document_id: "doc-owned" }] }, "doc-owned", 0), true);
  assert.equal(pro.containsResourceId({ unrelated: { id: "doc-other" } }, "doc-owned", 0), false);

  var baselineProfile = { id: profileId, legal_name: "Primer GmbH", company_id: "DE-HRB-X-77", register_number: "HRB 77", register_court: "Berlin", address: { street: "Musterstraße 1", postal_code: "10115", city: "Berlin" }, latest_check: profile.latestCheck };
  var imageOnlyLatestCheck = JSON.parse(JSON.stringify(profile.latestCheck));
  delete imageOnlyLatestCheck.insolvency.officialVerification.serverEvidenceVerified;
  assert.equal(store.imaStrezniskoPotrjenoUradnoOsnovo(imageOnlyLatestCheck), false,
    "stara odjemalsko zapisljiva slika sama ne sme biti persisted authority");
  var legacyHistory = store._test.izberiVarnoNajnovejsoPreverbo(
    { checked_at: "2026-08-30T19:59:00.000Z", latest_check: imageOnlyLatestCheck },
    { source: "openregister_verified_search", identityStatus: "verified_register" },
    "2026-08-30T20:05:00.000Z"
  );
  assert.equal(legacyHistory.preserved, true, "plitki upsert mora ohraniti legacy dokazno zgodovino");
  assert.equal(legacyHistory.latestCheck.insolvency.officialVerification.evidenceImage, official.evidenceImage,
    "ohranitev zgodovine ne sme tiho odstraniti stare slike");
  assert.equal(store.imaStrezniskoPotrjenoUradnoOsnovo(legacyHistory.latestCheck), false,
    "ohranjena legacy zgodovina kljub sliki ne sme postati authority");
  assert.equal(store.imaStrezniskoPotrjenoUradnoOsnovo(profile.latestCheck), true,
    "strežniško ustvarjen marker mora dovoliti novo spremljanje");
  assert.throws(function () {
    projectMonitor._test.request(Object.assign({}, baselineProfile, { latest_check: imageOnlyLatestCheck }));
  }, function (error) { return error.code === "MONITORING_BASELINE_INCOMPLETE"; },
  "profil samo z legacy evidenceImage ne sme ustvariti svežega service-role urnika");
  assert.equal(projectMonitor._test.request(baselineProfile).openRegisterCompanyId, "DE-HRB-X-77");
  assert.equal(projectMonitor._test.request(Object.assign({}, baselineProfile, { latest_check: store.compactJson(profile.latestCheck) })).openRegisterCompanyId, "DE-HRB-X-77", "profil mora ostati primeren za spremljanje tudi po ločenem shranjevanju velike slike");
  assert.throws(function () { projectMonitor._test.request(Object.assign({}, baselineProfile, { latest_check: Object.assign({}, profile.latestCheck, { insolvency: { status: "clear" } }) })); }, function (error) { return error.code === "MONITORING_BASELINE_INCOMPLETE"; });
  assert.throws(function () { projectMonitor._test.zonedDateTime("2026-03-29", "02:30", "Europe/Ljubljana"); }, function (error) { return error.code === "MONITORING_LOCAL_TIME_INVALID"; });
  assert.equal(projectMonitor._test.zonedDateTime("2026-03-29", "03:30", "Europe/Ljubljana").toISOString(), "2026-03-29T01:30:00.000Z");

  var originalFetch = db.fetchZOmejitvijo;
  db.fetchZOmejitvijo = async function () { return { ok: true, status: 200, json: async function () { return []; }, headers: new Headers() }; };
  try {
    await assert.rejects(store.markAlertRead({ url: "https://db.example", serviceKey: "service" }, userId, "00000000-0000-4000-8000-000000000401"), function (error) { return error.code === "ALERT_NOT_FOUND" && error.status === 404; });
  } finally { db.fetchZOmejitvijo = originalFetch; }

  var migration = source("supabase/migrations/20260830220944_boniteta_authority_and_ownership_guards.sql");
  assert.match(migration, /foreign key \(profile_id, user_id\) references public\.boniteta_profili\(id, user_id\)/i);
  assert.match(migration, /revoke all on table public\.boniteta_profili from public, anon, authenticated/i);
  assert.doesNotMatch(migration, /grant\s+[^;]*(?:insert|update)[^;]*\s+to authenticated/gi, "authenticated ne sme dobiti neposrednega write granta za avtoritativne Boniteta podatke");
  assert.match(migration, /boniteta_profili_lastni_select[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /boniteta_monitorji_lastni_delete[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /pg_catalog\.pg_constraint[\s\S]*boniteta_profili_id_user_key/i, "ponovna ali delna izvedba migracije ne sme podvojiti constraintov");
  assert.match(migration, /drop policy if exists boniteta_profili_lastni_select/i, "ponovna ali delna izvedba migracije ne sme podvojiti policyja");
  assert.match(migration, /mehka_boniteta_one_active_user_cache_idx[\s\S]*where status in \('queued', 'processing'\)/i);
  [
    "boniteta_pro_cache_profile_owner_fkey",
    "boniteta_monitorji_profile_owner_fkey",
    "boniteta_opozorila_profile_owner_fkey",
    "boniteta_projektna_profile_owner_fkey",
    "boniteta_ponovne_profile_owner_fkey",
    "boniteta_650f_profile_owner_fkey",
  ].forEach(function (constraint) {
    assert.match(migration, new RegExp("validate constraint " + constraint, "i"), constraint + " mora biti potrjen v isti transakciji");
  });
  assert.match(migration, /join public\.mehka_boniteta_opravila j[\s\S]*j\.project_monitor_id = m\.id and j\.user_id = m\.user_id/i);
  assert.match(migration, /join public\.mehka_boniteta_opravila j[\s\S]*j\.financial_recheck_id = r\.id and j\.user_id = r\.user_id/i);
  assert.match(migration, /where id = v_monitor\.profile_id and user_id = v_monitor\.user_id/i);
  assert.match(migration, /where id = v_recheck\.profile_id and user_id = v_recheck\.user_id/i);
  assert.match(migration, /evidenceStatus' = 'captured'/i);
  var legacyNeutralization = migration.slice(
    migration.indexOf("-- Vsi markerji iz obdobja"),
    migration.indexOf("-- 4. Dve sočasni")
  );
  assert.match(legacyNeutralization, /serverEvidenceVerified\}',\s*'false'::jsonb/i,
    "vsi markerji iz client-write obdobja morajo postati neavtoritativni");
  assert.match(legacyNeutralization, /monitoringMode'\s*=\s*'internal_recheck'/i,
    "stari internal recheck urniki morajo biti izrecno nevtralizirani");
  assert.doesNotMatch(legacyNeutralization, /evidenceImage[^\n]*<>/i,
    "legacy slika v profilu ali baseline ne sme biti authority pogoj");
  var projectTarget = sqlFunction(migration, "zakljuci_projektno_spremljanje_cilj");
  var financialTarget = sqlFunction(migration, "zakljuci_financno_ponovno_preverbo_cilj");
  assert.match(projectTarget, /#- '\{insolvency,officialVerification,evidenceImage\}'[\s\S]*serverEvidenceVerified\}',\s*'true'::jsonb/i,
    "service-only projektni finish mora odstraniti veliko sliko in sam dodati marker");
  assert.match(financialTarget, /#- '\{insolvency,officialVerification,evidenceImage\}'[\s\S]*serverEvidenceVerified\}',\s*'true'::jsonb/i,
    "service-only finančni finish mora odstraniti veliko sliko in sam dodati marker");
  assert.match(projectTarget, /if v_monitor\.id is null then[\s\S]*?raise exception 'Projektni cilj uskladitve/i,
    "manjkajoči ali tuji projektni cilj mora prekiniti outbox transakcijo");
  assert.match(financialTarget, /if v_recheck\.id is null then[\s\S]*?raise exception 'Finančni cilj uskladitve/i,
    "manjkajoči ali tuji finančni cilj mora prekiniti outbox transakcijo");
  assert.match(projectTarget, /last_reconciled_job_id\s*=\s*p_job_id/i,
    "projektni target mora atomsko zapisati idempotency marker");
  assert.match(projectTarget, /last_job_id is not null and v_monitor\.last_job_id <> p_job_id then return/i,
    "starejši projektni job ne sme prepisati novejšega");
  assert.match(financialTarget, /last_reconciled_job_id\s*=\s*p_job_id/i,
    "finančni target mora atomsko zapisati idempotency marker");
  assert.match(financialTarget, /last_job_id is not null and v_recheck\.last_job_id <> p_job_id then return/i,
    "starejši finančni job ne sme prepisati novejšega");
  assert.equal((migration.match(/create or replace function public\.zakljuci_projektno_spremljanje\(/gi) || []).length, 1,
    "migracija ne sme vsebovati stare podvojene projektne finish funkcije");
  assert.equal((migration.match(/create or replace function public\.zakljuci_financno_ponovno_preverbo\(/gi) || []).length, 1,
    "migracija ne sme vsebovati stare podvojene finančne finish funkcije");
  assert.match(migration, /grant execute on function public\.zakljuci_projektno_spremljanje_cilj\(uuid, uuid, uuid, boolean, jsonb\) to service_role/i);
  assert.match(migration, /grant execute on function public\.zakljuci_financno_ponovno_preverbo_cilj\(uuid, uuid, uuid, boolean, jsonb\) to service_role/i);
  assert.match(migration, /revoke all on function public\.zakljuci_projektno_spremljanje[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /revoke all on function public\.zakljuci_financno_ponovno_preverbo[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.zakljuci_projektno_spremljanje[\s\S]*to service_role/i);
  assert.match(migration, /function public\.zakljuci_financno_ponovno_preverbo[\s\S]*?security invoker/i);

  var migration650f = source("supabase/migrations/20260826193000_boniteta_650f_osnutki.sql");
  assert.match(migration650f, /revoke all on public\.boniteta_650f_osnutki from public, anon/i);
  assert.match(migration650f, /boniteta_650f_osnutki_owner_profile_idx[\s\S]*\(user_id, profile_id\)/i);

  var queueSource = source("api/_lib/mehka-boniteta-queue.js");
  assert.match(queueSource, /error\.details[\s\S]*23505[\s\S]*najdiAktivno/);
  var uiSource = source("app/bonitetna-preverba.js");
  assert.match(uiSource, /action: "save_check",\s*jobId: zadnjiJobId/);
  assert.doesNotMatch(uiSource.slice(uiSource.indexOf('action: "save_check"'), uiSource.indexOf('action: "save_check"') + 350), /profile\s*:/, "odjemalec ne sme več poslati avtoritativnega profila");
  assert.equal(require("../api/boniteta-pro"), require("../api/_handlers/boniteta-pro"), "lokalni in produkcijski handler morata biti isti modul");

  console.log("Boniteta authority/ownership guard tests passed.");
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
