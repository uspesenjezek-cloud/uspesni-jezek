"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = "true";

const root = path.resolve(__dirname, "..");
const queue = require(path.join(root, "api", "_lib", "mehka-boniteta-queue"));

async function main() {
  queue._test.ponastaviPomnilnik();
  const tuje = await queue.ustvari({}, "user-b", { ime: "Tuje podjetje GmbH" });
  const lastno = await queue.ustvari({}, "user-a", { ime: "Lastno podjetje GmbH" });

  const uporabniskiPrevzem = await queue.prevzemi({}, 1, "user-a");
  assert.equal(uporabniskiPrevzem.length, 1);
  assert.equal(uporabniskiPrevzem[0].id, lastno.id,
    "prijavljen uporabnik sme prevzeti samo svoje opravilo");
  assert.equal(queue._test.pomnilnik.jobs.get(tuje.id).status, "queued",
    "tuje opravilo mora ostati v vrsti");

  const cronPrevzem = await queue.prevzemi({}, 1);
  assert.equal(cronPrevzem.length, 1);
  assert.equal(cronPrevzem[0].id, tuje.id,
    "globalni cron mora še naprej prevzeti katerokoli čakajoče opravilo");

  const worker = fs.readFileSync(path.join(root, "api", "mehka-boniteta-delavec.js"), "utf8");
  const queueSource = fs.readFileSync(path.join(root, "api", "_lib", "mehka-boniteta-queue.js"), "utf8");
  const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260829210500_mehka_boniteta_worker_user_scope.sql"), "utf8");

  assert.match(worker, /claimUserId = auth\.user\.id/);
  assert.match(worker, /queue\.prevzemi\(cfg, 1, claimUserId\)/);
  assert.match(worker, /if \(!jobs\.length && !claimUserId\)/,
    "uporabniški wake-up ne sme sprožati globalnih schedulerjev");
  assert.match(queueSource, /prevzemi_mehka_boniteta_opravila_za_uporabnika/);
  assert.match(migration, /user_id = p_user_id/i);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /revoke all[\s\S]*authenticated/i);
  assert.match(migration, /grant execute[\s\S]*service_role/i);

  console.log("OK: uporabniški worker prevzema samo lastna opravila, cron pa ostaja globalen.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

