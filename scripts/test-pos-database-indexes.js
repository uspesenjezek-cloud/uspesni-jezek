"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260823115149_pos_missing_foreign_key_indexes.sql"
);
const sql = fs.readFileSync(migrationPath, "utf8");

const expectedIndexes = [
  ["pos_withdrawal_settlements_order_user_idx", "pos_consumer_withdrawal_settlements", "work_order_id, user_id"],
  ["pos_invoice_adjustments_work_order_user_idx", "pos_invoice_adjustments", "work_order_id, user_id"],
  ["pos_invoice_deliveries_adjustment_user_idx", "pos_invoice_deliveries", "adjustment_id, user_id"],
  ["pos_work_order_acceptances_offer_document_user_idx", "pos_work_order_acceptances", "offer_document_id, user_id"],
  ["pos_work_order_acceptances_order_user_idx", "pos_work_order_acceptances", "work_order_id, user_id"],
  ["pos_work_order_cancellations_offer_document_user_idx", "pos_work_order_cancellations", "offer_document_id, user_id"],
  ["pos_work_order_cancellations_order_user_idx", "pos_work_order_cancellations", "work_order_id, user_id"]
];

for (const [indexName, tableName, columns] of expectedIndexes) {
  const escapedColumns = columns.replace(/, /g, "\\s*,\\s*");
  const expression = new RegExp(
    `create\\s+index\\s+if\\s+not\\s+exists\\s+${indexName}\\s+on\\s+public\\.${tableName}\\s*\\(\\s*${escapedColumns}\\s*\\)`,
    "i"
  );
  assert.match(sql, expression, `${indexName} mora pokriti celoten tuji ključ v pravilnem vrstnem redu.`);
}

assert.doesNotMatch(sql, /\b(drop|truncate|delete|alter\s+table\s+\S+\s+disable)\b/i);
assert.equal((sql.match(/create\s+index\s+if\s+not\s+exists/gi) || []).length, expectedIndexes.length);

console.log(`POS database index checks passed (${expectedIndexes.length} covering indexes).`);
