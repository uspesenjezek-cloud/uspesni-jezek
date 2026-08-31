"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = "true";

const root = path.resolve(__dirname, "..");
const queue = require(path.join(root, "api", "_lib", "mehka-boniteta-queue"));
const worker = require(path.join(root, "api", "mehka-boniteta-delavec"))._test;
const projectMonitor = require(path.join(root, "api", "_lib", "projektno-spremljanje"));
const financialRecheck = require(path.join(root, "api", "_lib", "financno-ponovno-preverjanje"));

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validResult() {
  return {
    ok: true,
    insolvency: {
      status: "clear",
      officialVerification: {
        evidenceStatus: "captured",
        evidenceImage: "data:image/jpeg;base64,QUJD",
      },
    },
  };
}

async function testLeaseCasAndExpiry() {
  queue._test.ponastaviPomnilnik();
  const created = await queue.ustvari({}, "user-a", { ime: "Lease GmbH" });
  const firstClaim = (await queue.prevzemi({}, 1))[0];
  assert.equal(firstClaim.id, created.id);
  const staleClaim = { id: firstClaim.id, claim_token: firstClaim.claim_token };
  const stored = queue._test.pomnilnik.jobs.get(firstClaim.id);

  assert.equal((await queue.prevzemi({}, 1)).length, 0,
    "drugi delavec pred iztekom ne sme prevzeti istega opravila");

  stored.lease_until = new Date(Date.now() + 31000).toISOString();
  const shortLease = new Date(stored.lease_until).getTime();
  await queue.podaljsajNajem({}, firstClaim, 75);
  assert.ok(new Date(stored.lease_until).getTime() > shortLease,
    "CAS heartbeat mora veljavnemu claim tokenu podaljšati najem");
  assert.equal((await queue.prevzemi({}, 1)).length, 0,
    "podaljšan najem mora preprečiti sočasni drugi prevzem");

  stored.lease_until = new Date(Date.now() - 1000).toISOString();
  await assert.rejects(
    () => queue.podaljsajNajem({}, staleClaim, 75),
    (error) => error && error.code === "QUEUE_LEASE_LOST",
    "poteklega najema star claim token ne sme oživiti"
  );

  assert.equal((await queue.prevzemi({}, 1)).length, 0,
    "poteklo opravilo mora pred ponovnim prevzemom dobiti backoff");
  assert.equal(stored.status, "queued");
  stored.available_at = new Date(Date.now() - 1000).toISOString();
  const secondClaim = (await queue.prevzemi({}, 1))[0];
  assert.ok(secondClaim);
  assert.notEqual(secondClaim.claim_token, staleClaim.claim_token,
    "nov delavec mora po izteku dobiti nov claim token");
  await assert.rejects(
    () => queue.zakljuci({}, staleClaim, { success: true, result: validResult() }),
    /ni več v lasti/,
    "stari delavec po drugem prevzemu ne sme zaključiti opravila"
  );
}

async function testHeartbeatCleanup() {
  const originalRenew = queue.podaljsajNajem;
  let calls = 0;
  queue.podaljsajNajem = async function () { calls += 1; return { id: "job", lease_until: new Date().toISOString() }; };
  try {
    const heartbeat = worker.zacniObnavljanjeNajema({}, { id: "job", claim_token: "token" }, {
      intervalMs: 5,
      leaseSeconds: 30,
    });
    await wait(60);
    await heartbeat.ustavi();
    heartbeat.preveriLastnistvo();
    const stoppedAt = calls;
    assert.ok(stoppedAt >= 1, "testni heartbeat se mora izvesti");
    await wait(25);
    assert.equal(calls, stoppedAt, "ustavitev mora počistiti interval in preprečiti nove heartbeat klice");
  } finally {
    queue.podaljsajNajem = originalRenew;
  }
}

async function terminalJobWithTarget(target, id) {
  const created = await queue.ustvari({}, "user-a", { ime: id + " GmbH" });
  const stored = queue._test.pomnilnik.jobs.get(created.id);
  stored[target] = id;
  const claimed = (await queue.prevzemi({}, 1))[0];
  await queue.zakljuci({}, claimed, { success: true, retryable: false, result: validResult() });
  return claimed;
}

async function testDurableFinishReconciliation() {
  queue._test.ponastaviPomnilnik();
  const financialJob = await terminalJobWithTarget("financial_recheck_id", "financial-1");
  assert.equal(queue._test.pomnilnik.reconciliations.size, 1,
    "terminalni queue prehod mora atomsko ustvariti trajno obveznost uskladitve");
  queue._test.pomnilnik.jobs.delete(financialJob.id);
  assert.equal(queue._test.pomnilnik.reconciliations.size, 1,
    "izbris zaključenega source joba ne sme izbrisati outbox obveznosti");

  const originalAtomicFinish = queue.izvediUskladitev;
  const originalFinancialPrepare = financialRecheck.pripraviZakljucek;
  const originalProjectPrepare = projectMonitor.pripraviZakljucek;
  const originalConsoleError = console.error;
  let financialCalls = 0;
  let projectCalls = 0;
  let atomicCalls = 0;
  queue.izvediUskladitev = async function (cfg, entry, success, result) {
    atomicCalls += 1;
    if (atomicCalls === 1) throw Object.assign(new Error("začasni RPC timeout"), { code: "DATABASE_RPC_FAILED" });
    return originalAtomicFinish(cfg, entry, success, result);
  };
  financialRecheck.pripraviZakljucek = function (success, result) {
    financialCalls += 1;
    return originalFinancialPrepare(success, result);
  };
  projectMonitor.pripraviZakljucek = function (job, success, result) {
    projectCalls += 1;
    return originalProjectPrepare(job, success, result);
  };
  console.error = function () {};
  try {
    const first = await worker.uskladiZakljucek({}, financialJob.id);
    assert.equal(first.retryScheduled, true, "prehodna finish napaka mora razporediti trajni retry");
    const financialEntry = Array.from(queue._test.pomnilnik.reconciliations.values())[0];
    assert.equal(financialEntry.user_id, "user-a", "outbox mora ohraniti lastnika tudi brez source joba");
    assert.equal(financialEntry.status, "pending");
    assert.match(financialEntry.last_error, /začasni RPC timeout/);
    financialEntry.available_at = new Date(Date.now() - 1000).toISOString();

    const second = await worker.uskladiZakljucek({}, financialJob.id);
    assert.equal(second.success, true, "poznejša uskladitev mora zaključiti finančni urnik");
    assert.equal(financialEntry.status, "completed");
    assert.equal(financialEntry.result_payload, null, "uspešen outbox ne sme trajno hraniti velikega rezultata");
    assert.deepEqual(financialEntry.request_payload, {}, "uspešen outbox ne sme trajno hraniti zahteve");
    assert.equal(financialCalls, 2);

    const projectJob = await terminalJobWithTarget("project_monitor_id", "project-1");
    const project = await worker.uskladiZakljucek({}, projectJob.id);
    assert.equal(project.kind, "project_monitor");
    assert.equal(project.success, true);
    assert.equal(projectCalls, 1, "isti outbox mora pokrivati tudi projektno spremljanje");
  } finally {
    queue.izvediUskladitev = originalAtomicFinish;
    financialRecheck.pripraviZakljucek = originalFinancialPrepare;
    projectMonitor.pripraviZakljucek = originalProjectPrepare;
    console.error = originalConsoleError;
  }
}

function testMigrationSecurityAndWakeup() {
  const migration = fs.readFileSync(path.join(
    root, "supabase", "migrations",
    "20260830225126_mehka_boniteta_lease_heartbeat_and_finish_outbox.sql"
  ), "utf8");
  assert.match(migration, /create table if not exists public\.boniteta_zakljucki_za_uskladitev/i);
  assert.match(migration, /job_id uuid not null,\s*(?:--[^\n]*\s*)*user_id uuid not null references auth\.users\(id\)/i,
    "outbox mora ohraniti korelacijski job ID in lastnika");
  assert.doesNotMatch(migration, /job_id uuid[^,\n]*references public\.mehka_boniteta_opravila/i,
    "source job FK ne sme s cascade izbrisati trajne outbox obveznosti");
  assert.match(migration, /alter table public\.boniteta_zakljucki_za_uskladitev enable row level security/i);
  assert.match(migration, /create or replace function public\.podaljsaj_mehka_boniteta_najem[\s\S]*claim_token = p_claim_token[\s\S]*lease_until >= now\(\)/i);
  assert.match(migration, /create trigger mehka_boniteta_terminal_finish_outbox[\s\S]*after update of status[\s\S]*zabelezi_boniteta_zakljucek_za_uskladitev/i,
    "vsak terminalni queue prehod mora v isti transakciji sprožiti outbox zapis");
  const schedulerStart = migration.indexOf("create or replace function public.razporedi_zapadlo_projektno_spremljanje()");
  const schedulerEnd = migration.indexOf("$$;", schedulerStart);
  assert.ok(schedulerStart >= 0 && schedulerEnd > schedulerStart, "outbox migracija mora utrditi projektni scheduler");
  const scheduler = migration.slice(schedulerStart, schedulerEnd + 3);
  assert.match(scheduler, /from public\.boniteta_zakljucki_za_uskladitev r[\s\S]*r\.project_monitor_id = m\.id[\s\S]*r\.status in \('pending', 'processing'\)/i,
    "scheduler ne sme ustvariti novega joba, dokler prejšnji finish outbox še ni usklajen");
  assert.match(migration, /where j\.status in \('completed', 'failed'\)[\s\S]*on conflict \(job_id, kind\) do nothing/i,
    "migracija mora v outbox varno prenesti tudi že obstale terminalne vrstice");
  assert.match(migration, /prevzemi_boniteta_zakljucke_za_uskladitev[\s\S]*for update skip locked/i);
  assert.match(migration, /izvedi_boniteta_uskladitev[\s\S]*zakljuci_projektno_spremljanje_cilj\([\s\S]*v_entry\.project_monitor_id[\s\S]*v_entry\.user_id/i,
    "projektna uskladitev mora uporabiti shranjeni cilj in lastnika, ne source job vrstice");
  assert.match(migration, /izvedi_boniteta_uskladitev[\s\S]*zakljuci_financno_ponovno_preverbo_cilj\([\s\S]*v_entry\.financial_recheck_id[\s\S]*v_entry\.user_id/i,
    "finančna uskladitev mora uporabiti shranjeni cilj in lastnika");
  assert.match(migration, /set status = 'completed'[\s\S]*result_payload = null[\s\S]*request_payload = '\{\}'::jsonb/i,
    "uspešna atomska uskladitev mora počistiti oba velika payloada");
  assert.match(migration, /result_payload = case when p_success then null else result_payload end[\s\S]*request_payload = case when p_success then '\{\}'::jsonb else request_payload end/i,
    "tudi ločeni success ACK mora počistiti payload, retry pa ga ohraniti");
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /revoke all on table public\.boniteta_zakljucki_za_uskladitev from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.podaljsaj_mehka_boniteta_najem\(uuid, uuid, integer\) to service_role/i);
  assert.doesNotMatch(migration, /grant execute[^;]+to authenticated/i,
    "authenticated ne sme dobiti nobene nove service RPC funkcije");
  assert.match(migration, /uj-boniteta-finish-reconciliation[\s\S]*boniteta-finish-reconciliation/i,
    "outbox potrebuje neodvisen minutni wake-up tudi brez novih queue opravil");
}

async function main() {
  await testLeaseCasAndExpiry();
  await testHeartbeatCleanup();
  await testDurableFinishReconciliation();
  testMigrationSecurityAndWakeup();
  console.log("OK: CAS lease heartbeat prepreči dvojni prevzem in počisti interval.");
  console.log("OK: terminalni project/financial zaključki imajo trajni outbox in retry po prehodni RPC napaki.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
