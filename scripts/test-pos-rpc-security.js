"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260824181038_pos_public_rpc_invoker_hardening.sql"
);
const migration = fs.readFileSync(migrationPath, "utf8");

const wrappers = [
  ["pos_cancel_work_order", 1],
  ["pos_accept_work_order", 2],
  ["pos_record_consumer_withdrawal", 1],
  ["pos_record_contract_confirmation_delivery", 1],
  ["pos_start_work_order", 2],
  ["pos_assess_consumer_withdrawal_settlement", 1],
  ["pos_record_consumer_withdrawal_refund", 1],
  ["pos_create_withdrawal_tax_credit_notes", 1],
  ["pos_create_invoice_adjustment", 1],
  ["pos_record_manual_payment", 1],
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const [name, expectedCount] of wrappers) {
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${escapeRegex(name)}\\s*\\([\\s\\S]*?\\)\\s*returns[\\s\\S]*?as\\s+\\$\\$`,
    "gi"
  );
  const definitions = migration.match(pattern) || [];
  assert.equal(definitions.length, expectedCount, `${name} mora imeti vse pričakovane overload definicije`);
  definitions.forEach((definition) => {
    assert.match(definition, /security\s+invoker/i, `${name} mora biti SECURITY INVOKER`);
    assert.match(definition, /set\s+search_path\s*=\s*''/i, `${name} mora imeti prazen search_path`);
    assert.doesNotMatch(definition, /security\s+definer/i, `${name} ne sme biti SECURITY DEFINER`);
  });
}

assert.doesNotMatch(
  migration,
  /function\s+public\.pos_[\s\S]{0,500}?security\s+definer/i,
  "utrjevalna migracija ne sme ustvariti javnega POS SECURITY DEFINER RPC-ja"
);

const helperGrants = [
  "_pos_cancel_work_order(uuid,text)",
  "_pos_accept_work_order(uuid,text,date)",
  "_pos_record_consumer_withdrawal(uuid,date,text)",
  "_pos_record_contract_confirmation_delivery(uuid,text,text,date,text)",
  "_pos_start_work_order(uuid,text,boolean,boolean,boolean)",
  "_pos_assess_consumer_withdrawal_settlement(uuid,bigint,text,text,text)",
  "_pos_record_consumer_withdrawal_refund(uuid,bigint,text,text,text,date)",
  "_pos_create_withdrawal_tax_credit_notes(uuid,boolean)",
  "_pos_create_invoice_adjustment_idempotent(uuid,uuid,text,text,jsonb,boolean)",
  "_pos_record_manual_payment_idempotent(uuid,uuid,boolean)",
];

for (const signature of helperGrants) {
  const escaped = escapeRegex(signature).replace(/\\ /g, "\\s*");
  assert.match(
    migration,
    new RegExp(`revoke\\s+all\\s+on\\s+function\\s+private\\.${escaped}\\s+from\\s+public,\\s*anon`, "i"),
    `${signature} mora izrecno preklicati javni in anonimni dostop`
  );
  assert.match(
    migration,
    new RegExp(`grant\\s+execute\\s+on\\s+function\\s+private\\.${escaped}\\s+to\\s+authenticated,\\s*service_role`, "i"),
    `${signature} mora dovoliti samo prijavljenemu uporabniku in service_role`
  );
}

const helperSources = [
  ["20260822052352_pos_offer_cancellation_evidence.sql", "_pos_cancel_work_order"],
  ["20260822062024_pos_offer_acceptance_effective_date.sql", "_pos_accept_work_order"],
  ["20260822091051_pos_consumer_service_completion_withdrawal.sql", "_pos_record_consumer_withdrawal"],
  ["20260822084942_pos_consumer_contract_confirmation.sql", "_pos_record_contract_confirmation_delivery"],
  ["20260822091051_pos_consumer_service_completion_withdrawal.sql", "_pos_start_work_order"],
  ["20260822092637_pos_consumer_withdrawal_settlement.sql", "_pos_assess_consumer_withdrawal_settlement"],
  ["20260822092637_pos_consumer_withdrawal_settlement.sql", "_pos_record_consumer_withdrawal_refund"],
  ["20260822100114_pos_withdrawal_tax_credit_notes.sql", "_pos_create_withdrawal_tax_credit_notes"],
  ["20260823144616_pos_adjustment_retry_idempotency.sql", "_pos_create_invoice_adjustment_idempotent"],
  ["20260824173301_pos_manual_payment_retry_idempotency.sql", "_pos_record_manual_payment_idempotent"],
];

for (const [fileName, helperName] of helperSources) {
  const source = fs.readFileSync(path.join(root, "supabase", "migrations", fileName), "utf8");
  const start = source.search(new RegExp(`create(?:\\s+or\\s+replace)?\\s+function\\s+private\\.${escapeRegex(helperName)}\\s*\\(`, "i"));
  assert.notEqual(start, -1, `${helperName} mora obstajati`);
  const end = source.indexOf("$$;", start);
  assert.notEqual(end, -1, `${helperName} mora imeti zaključeno telo`);
  const definition = source.slice(start, end + 3);
  assert.match(definition, /security\s+definer/i, `${helperName} mora biti omejeni zasebni izvajalec`);
  assert.match(definition, /set\s+search_path\s*=\s*''/i, `${helperName} mora imeti prazen search_path`);
  assert.match(definition, /auth\.uid\(\)/i, `${helperName} mora preveriti identiteto klicatelja`);
  assert.match(definition, /for\s+update/i, `${helperName} mora zakleniti poslovno vrstico`);
}

console.log("POS RPC security hardening tests passed.");
