"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  POS_MIGRATION_ALLOWLIST,
  VERIFIED_SCHEMA_HISTORY_GAPS,
  evaluatePendingMigrations,
  parseDryRunOutput,
} = require("./check-pos-migration-deployment");

const allowed = [...POS_MIGRATION_ALLOWLIST];
const parsed = parseDryRunOutput([
  "DRY RUN: migrations will *not* be pushed to the database.",
  JSON.stringify({ dryRun: true, migrations: allowed }),
].join("\n"));
assert.deepEqual(parsed, allowed, "dry-run JSON mora ostati strojno berljiv");

const safe = evaluatePendingMigrations([allowed[0], allowed[0], allowed[1]]);
assert.equal(safe.safe, true, "podmnožica dovoljene POS vrste mora biti varna");
assert.deepEqual(safe.blocked, []);
assert.deepEqual(safe.historyGaps, []);
assert.equal(safe.pending.length, 2, "podvojene migracije se morajo odstraniti");

const historyGapName = [...VERIFIED_SCHEMA_HISTORY_GAPS][0];
const historyGap = evaluatePendingMigrations([
  allowed[0],
  historyGapName,
]);
assert.equal(historyGap.safe, false, "manjkajoči zapis zgodovine mora blokirati POS deployment");
assert.deepEqual(historyGap.historyGaps, [historyGapName]);
assert.deepEqual(historyGap.blocked, []);

const unrelatedName = "20990101000000_unapproved_feature.sql";
const mixed = evaluatePendingMigrations([allowed[0], unrelatedName]);
assert.equal(mixed.safe, false, "neodobrena migracija mora blokirati POS deployment");
assert.deepEqual(mixed.blocked, [unrelatedName]);
assert.deepEqual(mixed.historyGaps, []);

const succeededStateMigration = fs.readdirSync(path.join(__dirname, "..", "supabase", "migrations"))
  .find((name) => /pos_openapi_succeeded_delivery_state\.sql$/.test(name));
assert.ok(succeededStateMigration, "Manjka SENT/succeeded migracija.");
const unexpectedlyPending = evaluatePendingMigrations([succeededStateMigration]);
assert.equal(unexpectedlyPending.safe, false, "Že nameščena Openapi migracija mora ob ponovnem pojavu v čakalni vrsti odpovedati varno.");
assert.deepEqual(unexpectedlyPending.blocked, [succeededStateMigration]);

assert.throws(
  () => parseDryRunOutput("Would push these migrations, but JSON is missing"),
  /strojno berljivega/,
  "neznan CLI izhod mora odpovedati varno"
);

console.log("POS migration deployment guard tests passed.");
