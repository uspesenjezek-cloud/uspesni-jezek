"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "migrations", "20260824181626_pos_database_lint_cleanup.sql"),
  "utf8"
);

assert.match(migration, /create or replace function private\.pos_iban_valid\(p_iban text\)/i);
assert.doesNotMatch(migration, /v_index\s+integer/i, "FOR zanka ne sme senčiti ročno deklarirane spremenljivke");
assert.match(migration, /for v_index in 1\.\.char_length\(v_rearranged\) loop/i);
assert.match(migration, /create or replace function public\.pos_archive_provider_fail\(p_error_code text\)/i);
assert.match(migration, /perform p_error_code;/i, "združljivi parameter mora biti zavestno uporabljen");
assert.match(migration, /auth\.role\(\)[\s\S]*service_role/i);
assert.match(migration, /revoke all on function public\.pos_archive_provider_fail\(text\) from public, anon, authenticated/i);
assert.match(migration, /grant execute on function public\.pos_archive_provider_fail\(text\) to service_role/i);

console.log("POS database lint cleanup tests passed.");
