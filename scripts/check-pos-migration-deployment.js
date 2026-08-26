"use strict";

const { spawnSync } = require("node:child_process");

const POS_MIGRATION_ALLOWLIST = new Set([
  "20260824172000_pos_openapi_webhook_submission_clock.sql",
  "20260824173301_pos_manual_payment_retry_idempotency.sql",
  "20260824173649_pos_archive_durable_document_recovery.sql",
  "20260824181038_pos_public_rpc_invoker_hardening.sql",
  "20260824181626_pos_database_lint_cleanup.sql",
  "20260824182529_pos_openapi_reconciliation_tracking.sql",
]);

// Read-only catalog verification on 2026-08-24 confirmed that the remote
// schema already contains these migrations' effects, although their versions
// are absent from supabase_migrations.schema_migrations. They must stay
// blocked: replaying them is unsafe and repairing remote history requires an
// explicit production write approval.
const VERIFIED_SCHEMA_HISTORY_GAPS = new Set([
  "20260822231500_sinhronizacija_mojih_korakov.sql",
  "20260823150000_nedenarne_poravnave.sql",
  "20260824090000_delna_nedenarna_poravnava.sql",
]);

function parseDryRunOutput(output) {
  const clean = String(output || "").replace(/\u001b\[[0-9;]*m/g, "");
  const lines = clean.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!lines[index].startsWith("{")) continue;
    try {
      const payload = JSON.parse(lines[index]);
      if (Array.isArray(payload.migrations)) return payload.migrations;
    } catch (_error) {
      // Earlier CLI status lines can contain braces; only the final JSON result matters.
    }
  }

  throw new Error("Supabase dry-run ni vrnil strojno berljivega seznama migracij.");
}

function evaluatePendingMigrations(migrations) {
  const pending = [...new Set(migrations.map((name) => String(name).trim()))].sort();
  const historyGaps = pending.filter((name) => VERIFIED_SCHEMA_HISTORY_GAPS.has(name));
  const blocked = pending.filter(
    (name) => !POS_MIGRATION_ALLOWLIST.has(name) && !VERIFIED_SCHEMA_HISTORY_GAPS.has(name)
  );
  const allowed = pending.filter((name) => POS_MIGRATION_ALLOWLIST.has(name));
  return {
    pending,
    allowed,
    historyGaps,
    blocked,
    safe: blocked.length === 0 && historyGaps.length === 0,
  };
}

function inspectLinkedMigrations() {
  const result = spawnSync(
    "supabase",
    ["db", "push", "--linked", "--dry-run", "--include-all", "--yes", "--output-format", "json"],
    { cwd: process.cwd(), encoding: "utf8", shell: false }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Supabase dry-run ni uspel.${details ? `\n${details}` : ""}`);
  }

  return parseDryRunOutput([result.stdout, result.stderr].filter(Boolean).join("\n"));
}

function main() {
  const assessment = evaluatePendingMigrations(inspectLinkedMigrations());

  if (assessment.allowed.length) {
    console.log("Dovoljene čakajoče POS migracije:");
    assessment.allowed.forEach((name) => console.log(`  - ${name}`));
  }

  if (assessment.historyGaps.length) {
    console.error("\nBLOKIRANO: oddaljena shema vsebuje učinke, zgodovina migracij pa nima različic:");
    assessment.historyGaps.forEach((name) => console.error(`  - ${name}`));
    console.error("Teh migracij ni varno ponovno izvesti; potreben je ločeno odobren popravek zgodovine.");
  }

  if (assessment.blocked.length) {
    console.error("\nBLOKIRANO: v Supabase čakalni vrsti so tudi neodobrene migracije:");
    assessment.blocked.forEach((name) => console.error(`  - ${name}`));
  }

  if (assessment.historyGaps.length || assessment.blocked.length) {
    console.error("\nVarovalka je izvedla samo --dry-run. Nobena migracija ni bila objavljena.");
    process.exitCode = 1;
    return;
  }

  if (!assessment.pending.length) {
    console.log("Supabase nima čakajočih migracij.");
  } else {
    console.log("\nPASS: čakalna vrsta vsebuje samo dovoljene POS migracije.");
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = {
  POS_MIGRATION_ALLOWLIST,
  VERIFIED_SCHEMA_HISTORY_GAPS,
  evaluatePendingMigrations,
  parseDryRunOutput,
};
