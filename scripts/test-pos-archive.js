"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821093000_pos_gobd_archive.sql"), "utf8");
const hardeningMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821102000_pos_archive_private_readiness.sql"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const archive = require(path.join(root, "api", "_lib", "pos-archive"));
const handler = require(path.join(root, "api", "_handlers", "pos-arhiv"));

assert.strictEqual(archive.hash(Buffer.from("original")), "0682c5f2076f099c34cfdd15a9e063849ed437a49677e6fcc5b4198c76575be5");
assert.match(migration, /create table public\.pos_archive_records/i);
assert.match(migration, /create table public\.pos_archive_integrity_events/i);
assert.match(migration, /retention_years smallint not null default 8/i);
assert.match(migration, /make_date\([^\n]+ \+ 8, 12, 31\)/i);
assert.match(migration, /pos_archive_records_immutable[\s\S]*pos_archive_integrity_events_immutable[\s\S]*pos_audit_events_immutable/i);
assert.match(migration, /after insert on public\.pos_invoice_documents[\s\S]*after insert on public\.pos_einvoice_documents[\s\S]*after insert on public\.pos_adjustment_documents/i);
assert.match(migration, /pos_invoices_require_archive_for_live[\s\S]*private\.pos_require_archive_before_live_invoice/i);
assert.match(migration, /independent_backup_ready[\s\S]*recovery_tested_at/i);
assert.match(migration, /alter table public\.pos_archive_records enable row level security/i);
assert.match(migration, /revoke all on function public\.pos_archive_integrity_batch\(integer\) from public, anon, authenticated/i);
assert.doesNotMatch(migration, /delete from public\.pos_archive_records/i);
assert.match(hardeningMigration, /private\.pos_archive_readiness\(\)[\s\S]*security definer/i);
assert.match(hardeningMigration, /public\.pos_archive_readiness\(\)[\s\S]*security invoker/i);
assert.match(hardeningMigration, /revoke all on function private\.pos_archive_readiness\(\) from public, anon/i);

const summary = handler._test.publicSummary(
  { retentionYears: 8, productionReady: false, independentBackupReady: false },
  [
    { id: "a", invoice_id: "i", document_kind: "invoice_pdf", original_media_type: "application/pdf", archived_at: "2026-01-01", retention_not_before: "2034-12-31" },
    { id: "b", invoice_id: "i", document_kind: "xrechnung_ubl", original_media_type: "application/xml", archived_at: "2026-01-02", retention_not_before: "2034-12-31" }
  ],
  [{ archive_record_id: "a", result: "verified", checked_at: "2026-02-01" }]
);
assert.strictEqual(summary.documentCount, 2);
assert.strictEqual(summary.verifiedCount, 1);
assert.strictEqual(summary.uncheckedCount, 1);
assert.strictEqual(summary.productionReady, false);
assert.strictEqual(summary.earliestRetentionNotBefore, "2034-12-31");

assert.match(html, /GoBD arhiv/);
assert.match(html, /data-archive-verify/);
assert.match(js, /function productionReady\(\)[\s\S]*archiveCapability\.productionReady/);
assert.match(js, /function loadArchiveCapability\([\s\S]*await apiSessionToken\(\)/);
assert.doesNotMatch(js, /currentSessionToken/);
assert.match(js, /Produkcijska izdaja čaka potrjeno ločeno arhivsko kopijo/);
assert.ok(vercel.rewrites.some((entry) => entry.source === "/api/pos-arhiv"));
assert.ok(vercel.crons.some((entry) => entry.path === "/api/pos-arhiv-delavec" && entry.schedule === "23 4 1 * *"));

console.log("POS archive tests passed.");
