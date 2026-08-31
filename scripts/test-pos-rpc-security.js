"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260824181038_pos_public_rpc_invoker_hardening.sql"
);
const migration = fs.readFileSync(migrationPath, "utf8");
const paymentSafety = fs.readFileSync(path.join(
  root, "supabase", "migrations", "20260829165203_pos_payment_safety_v2.sql"
), "utf8");

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

const paymentServiceWrappers = [
  "pos_reconcile_stripe_checkout",
  "pos_record_training_cash_signature_service",
  "pos_mark_training_cash_recovery_service",
  "pos_complete_training_cash_checkout_service",
  "pos_record_training_cash_refund_signature_service",
  "pos_mark_training_cash_refund_recovery_service",
  "pos_complete_training_cash_refund_service",
];
for (const name of paymentServiceWrappers) {
  const start = paymentSafety.search(new RegExp(`create\\s+function\\s+public\\.${name}\\s*\\(`, "i"));
  assert.notEqual(start, -1, `${name} mora obstajati`);
  const end = paymentSafety.indexOf("$$;", start);
  const definition = paymentSafety.slice(start, end + 3);
  assert.match(definition, /security\s+invoker/i, `${name} mora ostati SECURITY INVOKER`);
  assert.match(definition, /set\s+search_path\s*=\s*''/i, `${name} mora imeti prazen search_path`);
  assert.match(paymentSafety, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${name}`, "i"));
  assert.match(paymentSafety, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}[\\s\\S]{0,220}?to\\s+service_role`, "i"));
}
assert.match(paymentSafety, /create function private\._pos_reconcile_stripe_checkout[\s\S]*security definer[\s\S]*set search_path = ''/i);
assert.match(paymentSafety, /revoke all on function private\._pos_reconcile_stripe_checkout[\s\S]*from public, anon, authenticated/i);
assert.match(paymentSafety, /revoke execute on function public\.pos_cancel_stripe_checkout[\s\S]*from service_role/i);

// The assertions above retain the focused regression checks for the original
// hardening migrations.  The manifest below additionally reconstructs the
// final state across every migration in lexical order.  A later CREATE OR
// REPLACE, ALTER, GRANT or REVOKE therefore cannot hide behind an older safe
// definition.

function normalizeType(value) {
  return String(value || "")
    .replace(/"/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\btimestamptz\b/g, "timestamp with time zone")
    .replace(/\bbool\b/g, "boolean")
    .replace(/\bint8\b/g, "bigint")
    .replace(/\bint4\b/g, "integer");
}

function functionKey(schema, name, argTypes) {
  return `${schema.toLowerCase()}.${name.toLowerCase()}(${argTypes.map(normalizeType).join(",")})`;
}

function target(schema, name, argTypes, security, roles, bodyChecks) {
  return {
    schema,
    name,
    argTypes: argTypes.map(normalizeType),
    key: functionKey(schema, name, argTypes),
    security,
    roles: roles.slice().sort(),
    bodyChecks: bodyChecks || [],
  };
}

const stripeEventArgs = [
  "text", "text", "timestamptz", "text", "boolean", "uuid", "uuid", "uuid",
  "text", "text", "bigint", "text", "text", "text", "bigint",
];
const stripeReconcileArgs = ["uuid", "text", "text", "text", "text", "bigint", "text", "timestamptz"];

const finalTargets = [
  target("private", "_pos_cancel_work_order", ["uuid", "text"], "definer", ["authenticated", "service_role"], [/auth\.uid\(\)/i, /for\s+update/i]),
  target("public", "pos_cancel_work_order", ["uuid", "text"], "invoker", ["authenticated", "service_role"]),
  target("private", "_pos_accept_work_order", ["uuid", "text", "date"], "definer", ["authenticated", "service_role"], [/auth\.uid\(\)/i, /for\s+update/i]),
  target("private", "_pos_accept_work_order", ["uuid", "text"], "definer", ["service_role"]),
  target("public", "pos_accept_work_order", ["uuid", "text", "date"], "invoker", ["authenticated", "service_role"]),
  target("public", "pos_accept_work_order", ["uuid", "text"], "invoker", ["authenticated", "service_role"]),
  target(
    "private", "_pos_record_consumer_withdrawal", ["uuid", "date", "text"],
    "definer", ["authenticated", "service_role"], [/auth\.uid\(\)/i, /for\s+update/i]
  ),
  target("public", "pos_record_consumer_withdrawal", ["uuid", "date", "text"], "invoker", ["authenticated", "service_role"]),
  target(
    "private", "_pos_record_contract_confirmation_delivery", ["uuid", "text", "text", "date", "text"],
    "definer", ["authenticated", "service_role"], [/auth\.uid\(\)/i, /for\s+update/i]
  ),
  target(
    "public", "pos_record_contract_confirmation_delivery", ["uuid", "text", "text", "date", "text"],
    "invoker", ["authenticated", "service_role"]
  ),
  target(
    "private", "_pos_start_work_order", ["uuid", "text", "boolean", "boolean", "boolean"],
    "definer", ["authenticated", "service_role"], [/auth\.uid\(\)/i, /for\s+update/i]
  ),
  target("private", "_pos_start_work_order", ["uuid", "text"], "definer", ["service_role"]),
  target(
    "public", "pos_start_work_order", ["uuid", "text", "boolean", "boolean", "boolean"],
    "invoker", ["authenticated", "service_role"]
  ),
  target("public", "pos_start_work_order", ["uuid", "text"], "invoker", ["authenticated", "service_role"]),
  target(
    "private", "_pos_assess_consumer_withdrawal_settlement", ["uuid", "bigint", "text", "text", "text"],
    "definer", ["authenticated", "service_role"], [/auth\.uid\(\)/i, /for\s+update/i]
  ),
  target(
    "public", "pos_assess_consumer_withdrawal_settlement", ["uuid", "bigint", "text", "text", "text"],
    "invoker", ["authenticated", "service_role"]
  ),
  target(
    "private", "_pos_record_consumer_withdrawal_refund", ["uuid", "bigint", "text", "text", "text", "date"],
    "definer", ["authenticated", "service_role"], [/auth\.uid\(\)/i, /for\s+update/i]
  ),
  target(
    "public", "pos_record_consumer_withdrawal_refund", ["uuid", "bigint", "text", "text", "text", "date"],
    "invoker", ["authenticated", "service_role"]
  ),
  target(
    "private", "_pos_create_withdrawal_tax_credit_notes", ["uuid", "boolean"],
    "definer", ["authenticated", "service_role"], [/auth\.uid\(\)/i, /for\s+update/i]
  ),
  target("public", "pos_create_withdrawal_tax_credit_notes", ["uuid", "boolean"], "invoker", ["authenticated", "service_role"]),
  target(
    "private", "_pos_create_invoice_adjustment_idempotent", ["uuid", "uuid", "text", "text", "jsonb", "boolean"],
    "definer", ["authenticated", "service_role"], [/auth\.uid\(\)/i, /for\s+update/i]
  ),
  target(
    "public", "pos_create_invoice_adjustment", ["uuid", "text", "text", "jsonb", "boolean"],
    "definer", ["service_role"]
  ),
  target(
    "public", "pos_create_invoice_adjustment", ["uuid", "uuid", "text", "text", "jsonb", "boolean"],
    "invoker", ["authenticated", "service_role"]
  ),
  target("private", "_pos_record_manual_payment", ["uuid", "boolean"], "definer", ["service_role"]),
  target("public", "pos_record_manual_payment", ["uuid", "boolean"], "definer", ["service_role"]),
  target(
    "private", "_pos_record_manual_payment_idempotent", ["uuid", "uuid", "boolean"],
    "definer", ["authenticated", "service_role"],
    [/private\.pos_manual_payment_requests/i, /auth\.uid\(\)/i, /for\s+update/i]
  ),
  target("public", "pos_record_manual_payment", ["uuid", "uuid", "boolean"], "invoker", ["authenticated", "service_role"]),
  target(
    "private", "_pos_confirm_bank_transaction", ["uuid", "uuid", "boolean"],
    "definer", ["service_role"],
    [
      /auth\.uid\(\)/i,
      /v_transaction\.status\s*=\s*'confirmed'[\s\S]*confirmed_invoice_id[\s\S]*confirmed_payment_id[\s\S]*return\s+v_payment/i,
      /POS_BANK_TRANSACTION_BINDING_CONFLICT/i,
    ]
  ),
  target("public", "pos_confirm_bank_transaction", ["uuid", "uuid", "boolean"], "definer", ["authenticated", "service_role"]),
  target("private", "_pos_apply_stripe_event", stripeEventArgs, "definer", ["service_role"], [/for\s+update/i, /on\s+conflict/i]),
  target("public", "pos_apply_stripe_event", stripeEventArgs, "invoker", ["service_role"]),
  target("private", "_pos_reconcile_stripe_checkout", stripeReconcileArgs, "definer", ["service_role"]),
  target("public", "pos_reconcile_stripe_checkout", stripeReconcileArgs, "invoker", ["service_role"]),
  target(
    "private", "_pos_prepare_stripe_refund", ["uuid", "uuid", "uuid", "uuid", "bigint"],
    "definer", ["service_role"]
  ),
  target(
    "public", "pos_prepare_stripe_refund", ["uuid", "uuid", "uuid", "uuid", "bigint"],
    "invoker", ["service_role"]
  ),
  target(
    "private", "_pos_reconcile_stripe_refund",
    ["uuid", "uuid", "uuid", "uuid", "text", "text", "text", "bigint", "text", "bigint", "timestamptz"],
    "definer", ["service_role"]
  ),
  target(
    "public", "pos_reconcile_stripe_refund",
    ["uuid", "uuid", "uuid", "uuid", "text", "text", "text", "bigint", "text", "bigint", "timestamptz"],
    "invoker", ["service_role"]
  ),
  target(
    "private", "_pos_reconcile_training_cash_checkout",
    ["uuid", "uuid", "text", "text", "text", "text", "text", "text", "timestamptz", "timestamptz", "timestamptz"],
    "definer", ["service_role"]
  ),
  target(
    "public", "pos_reconcile_training_cash_checkout_service",
    ["uuid", "uuid", "text", "text", "text", "text", "text", "text", "timestamptz", "timestamptz", "timestamptz"],
    "invoker", ["service_role"]
  ),
  target(
    "private", "_pos_reconcile_training_cash_refund",
    ["uuid", "uuid", "text", "text", "text", "text", "text", "text", "timestamptz", "timestamptz", "timestamptz"],
    "definer", ["service_role"]
  ),
  target(
    "public", "pos_reconcile_training_cash_refund_service",
    ["uuid", "uuid", "text", "text", "text", "text", "text", "text", "timestamptz", "timestamptz", "timestamptz"],
    "invoker", ["service_role"]
  ),
  target("private", "_pos_complete_training_cash_checkout", ["uuid", "uuid"], "definer", ["service_role"]),
  target(
    "private", "_pos_prepare_training_cash_refund", ["uuid", "uuid", "uuid", "jsonb", "boolean"],
    "definer", ["authenticated", "service_role"]
  ),
  target("private", "_pos_complete_training_cash_refund", ["uuid", "uuid"], "definer", ["service_role"]),
  target(
    "public", "pos_record_training_cash_signature_service",
    ["uuid", "uuid", "text", "text", "text", "text", "text", "timestamptz", "timestamptz"],
    "invoker", ["service_role"]
  ),
  target("public", "pos_mark_training_cash_recovery_service", ["uuid", "uuid", "text"], "invoker", ["service_role"]),
  target("public", "pos_complete_training_cash_checkout_service", ["uuid", "uuid"], "invoker", ["service_role"]),
  target(
    "public", "pos_record_training_cash_refund_signature_service",
    ["uuid", "uuid", "text", "text", "text", "text", "text", "timestamptz", "timestamptz"],
    "invoker", ["service_role"]
  ),
  target("public", "pos_mark_training_cash_refund_recovery_service", ["uuid", "uuid", "text"], "invoker", ["service_role"]),
  target("public", "pos_complete_training_cash_refund_service", ["uuid", "uuid"], "invoker", ["service_role"]),
  target("public", "pos_archive_primary_recovery_batch", ["integer"], "definer", ["service_role"]),
  target(
    "public", "pos_archive_primary_recovery_complete", ["uuid", "uuid", "uuid", "text"],
    "definer", ["service_role"]
  ),
  target("public", "pos_archive_primary_recovery_fail", ["uuid", "text"], "definer", ["service_role"]),
  target("private", "pos_archive_production_ready", [], "definer", ["service_role"]),
];

const targetByKey = new Map(finalTargets.map((entry) => [entry.key, entry]));
const targetBareNames = new Set(finalTargets.map((entry) => entry.name.toLowerCase()));

function splitSqlStatements(sql) {
  const statements = [];
  let start = 0;
  let state = "normal";
  let dollarTag = "";
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (state === "line-comment") {
      if (ch === "\n") state = "normal";
      continue;
    }
    if (state === "block-comment") {
      if (ch === "*" && next === "/") { state = "normal"; i += 1; }
      continue;
    }
    if (state === "single") {
      if (ch === "'" && next === "'") { i += 1; continue; }
      if (ch === "'") state = "normal";
      continue;
    }
    if (state === "double") {
      if (ch === '"' && next === '"') { i += 1; continue; }
      if (ch === '"') state = "normal";
      continue;
    }
    if (state === "dollar") {
      if (sql.startsWith(dollarTag, i)) {
        i += dollarTag.length - 1;
        state = "normal";
        dollarTag = "";
      }
      continue;
    }
    if (ch === "-" && next === "-") { state = "line-comment"; i += 1; continue; }
    if (ch === "/" && next === "*") { state = "block-comment"; i += 1; continue; }
    if (ch === "'") { state = "single"; continue; }
    if (ch === '"') { state = "double"; continue; }
    if (ch === "$") {
      const match = sql.slice(i).match(/^(?:\$\$|\$[A-Za-z_][A-Za-z0-9_]*\$)/);
      if (match) {
        dollarTag = match[0];
        state = "dollar";
        i += dollarTag.length - 1;
        continue;
      }
    }
    if (ch === ";") {
      statements.push(sql.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (sql.slice(start).trim()) statements.push(sql.slice(start));
  return statements;
}

function stripLeadingComments(value) {
  let text = value;
  while (true) {
    text = text.replace(/^\s+/, "");
    if (text.startsWith("--")) {
      const newline = text.indexOf("\n");
      text = newline === -1 ? "" : text.slice(newline + 1);
      continue;
    }
    if (text.startsWith("/*")) {
      const end = text.indexOf("*/", 2);
      if (end === -1) throw new Error("Nezaključen SQL komentar v migracijski verigi.");
      text = text.slice(end + 2);
      continue;
    }
    return text.trim();
  }
}

function findMatchingParen(text, openAt) {
  let depth = 0;
  let state = "normal";
  for (let i = openAt; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (state === "single") {
      if (ch === "'" && next === "'") { i += 1; continue; }
      if (ch === "'") state = "normal";
      continue;
    }
    if (state === "double") {
      if (ch === '"' && next === '"') { i += 1; continue; }
      if (ch === '"') state = "normal";
      continue;
    }
    if (ch === "'") { state = "single"; continue; }
    if (ch === '"') { state = "double"; continue; }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error("Nezaključen seznam argumentov SQL funkcije.");
}

function splitTopLevel(value) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let state = "normal";
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const next = value[i + 1];
    if (state === "single") {
      if (ch === "'" && next === "'") { i += 1; continue; }
      if (ch === "'") state = "normal";
      continue;
    }
    if (state === "double") {
      if (ch === '"' && next === '"') { i += 1; continue; }
      if (ch === '"') state = "normal";
      continue;
    }
    if (ch === "'") { state = "single"; continue; }
    if (ch === '"') { state = "double"; continue; }
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === "," && depth === 0) { parts.push(value.slice(start, i)); start = i + 1; }
  }
  if (value.slice(start).trim()) parts.push(value.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function declarationTypes(argumentText) {
  if (!argumentText.trim()) return [];
  return splitTopLevel(argumentText).map((argument) => {
    let declaration = argument.replace(/\s+default\s+[\s\S]*$/i, "").trim();
    declaration = declaration.replace(/^(?:inout|in|out|variadic)\s+/i, "");
    const named = declaration.match(/^(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)\s+([\s\S]+)$/);
    assert.ok(named, `Argument funkcije nima deterministično prepoznavne deklaracije: ${argument}`);
    return normalizeType(named[1]);
  });
}

function identityTypes(argumentText) {
  if (!argumentText.trim()) return [];
  return splitTopLevel(argumentText).map(normalizeType);
}

function parseQualifiedName(value) {
  const parts = value.replace(/"/g, "").split(".");
  assert.equal(parts.length, 2, `Funkcija mora imeti eksplicitno shemo: ${value}`);
  return { schema: parts[0].toLowerCase(), name: parts[1].toLowerCase() };
}

function parseFunctionHead(text, expression, declaration) {
  const match = text.match(expression);
  if (!match) return null;
  const openAt = text.indexOf("(", match.index + match[0].length - 1);
  const closeAt = findMatchingParen(text, openAt);
  const name = parseQualifiedName(match[1]);
  const args = declaration
    ? declarationTypes(text.slice(openAt + 1, closeAt))
    : identityTypes(text.slice(openAt + 1, closeAt));
  return { ...name, args, key: functionKey(name.schema, name.name, args), openAt, closeAt };
}

function parseCreate(text) {
  const parsed = parseFunctionHead(
    text,
    /^create\s+(?:or\s+replace\s+)?function\s+((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)\.(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*))\s*\(/i,
    true
  );
  if (!parsed) return null;
  const tail = text.slice(parsed.closeAt + 1);
  const asMatch = tail.match(/\bas\s+(?:\$\$|\$[A-Za-z_][A-Za-z0-9_]*\$)/i);
  assert.ok(asMatch, `${parsed.key} nima deterministično prepoznavnega telesa.`);
  const attributes = tail.slice(0, asMatch.index);
  const security = attributes.match(/\bsecurity\s+(definer|invoker)\b/i);
  const hasSearchPath = /\bset\s+search_path\s*(?:=|to)\s*/i.test(attributes);
  const emptySearchPath = /\bset\s+search_path\s*(?:=|to)\s*''/i.test(attributes);
  return {
    ...parsed,
    orReplace: /^create\s+or\s+replace\s+function/i.test(text),
    security: security ? security[1].toLowerCase() : "invoker",
    explicitSecurity: Boolean(security),
    searchPath: emptySearchPath ? "" : (hasSearchPath ? "nonempty" : null),
    definition: text,
  };
}

function parseReference(text, keyword) {
  return parseFunctionHead(
    text,
    new RegExp(`^${keyword}\\s+((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)\\.(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*))\\s*\\(`, "i"),
    false
  );
}

function parseAclReferences(text) {
  const head = text.match(/^(?:grant\s+(?:all|execute)|revoke\s+(?:all|execute))\s+on\s+function\s+/i);
  if (!head) return null;
  const isGrant = /^grant\b/i.test(text);
  const roleKeyword = isGrant ? "to" : "from";
  const remainder = text.slice(head[0].length);
  const roleMarker = remainder.match(new RegExp(`\\s+${roleKeyword}\\s+`, "i"));
  assert.ok(roleMarker, `Manjka ${roleKeyword.toUpperCase()} v ACL stavku: ${text}`);
  const referenceList = remainder.slice(0, roleMarker.index).trim();
  const references = splitTopLevel(referenceList).map((reference) => {
    const parsed = parseFunctionHead(
      reference,
      /^((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)\.(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*))\s*\(/i,
      false
    );
    assert.ok(parsed, `Neprepoznana funkcijska referenca v ACL stavku: ${reference}`);
    assert.equal(
      reference.slice(parsed.closeAt + 1).trim(),
      "",
      `Nepričakovana pripona funkcijske reference v ACL stavku: ${reference}`
    );
    return parsed;
  });
  assert.ok(references.length > 0, `ACL stavek nima funkcijskih referenc: ${text}`);
  return { isGrant, references, roles: rolesAfter(text, roleKeyword) };
}

function rolesAfter(text, keyword) {
  const match = text.match(new RegExp(`\\b${keyword}\\s+([^;]+)`, "i"));
  assert.ok(match, `Manjka seznam vlog v SQL stavku: ${text}`);
  return match[1].split(",").map((role) => role.trim().replace(/"/g, "").toLowerCase()).filter(Boolean);
}

function applyMigrationChain() {
  const states = new Map();
  const migrationDir = path.join(root, "supabase", "migrations");
  const files = fs.readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort();
  const allSql = files.map((name) => fs.readFileSync(path.join(migrationDir, name), "utf8")).join("\n");
  assert.doesNotMatch(
    allSql,
    /alter\s+default\s+privileges[\s\S]{0,300}?\bon\s+functions\b/i,
    "Final-state analizator zahteva dopolnitev, če migracije spremenijo privzeti ACL funkcij."
  );
  assert.doesNotMatch(
    allSql,
    /(?:grant|revoke)[^;]*\bon\s+all\s+functions\s+in\s+schema\b/i,
    "Final-state analizator zahteva dopolnitev, če migracije množično spremenijo ACL funkcij."
  );

  for (const fileName of files) {
    const sql = fs.readFileSync(path.join(migrationDir, fileName), "utf8");
    for (const rawStatement of splitSqlStatements(sql)) {
      const statement = stripLeadingComments(rawStatement);
      if (!statement) continue;
      let parsed = parseCreate(statement);
      if (parsed) {
        if (targetBareNames.has(parsed.name)) {
          assert.ok(targetByKey.has(parsed.key), `Nepričakovan overload varovane funkcije ${parsed.key} (${fileName}).`);
        }
        if (!targetByKey.has(parsed.key)) continue;
        const previous = states.get(parsed.key);
        states.set(parsed.key, {
          definition: parsed.definition,
          explicitSecurity: parsed.explicitSecurity,
          security: parsed.security,
          searchPath: parsed.searchPath,
          acl: previous && parsed.orReplace ? new Set(previous.acl) : new Set(["public"]),
          definitionFile: fileName,
          lastMutationFile: fileName,
        });
        continue;
      }

      parsed = parseReference(statement, "alter\\s+function");
      if (parsed) {
        if (targetBareNames.has(parsed.name)) {
          assert.ok(targetByKey.has(parsed.key), `ALTER uporablja neznan overload varovane funkcije ${parsed.key} (${fileName}).`);
        }
        if (!targetByKey.has(parsed.key)) continue;
        const state = states.get(parsed.key);
        assert.ok(state, `ALTER je pred CREATE za ${parsed.key} (${fileName}).`);
        assert.doesNotMatch(
          statement,
          /\b(?:owner\s+to|rename\s+to|set\s+schema)\b/i,
          `${parsed.key}: sprememba lastnika, imena ali sheme zahteva eksplicitno modeliranje analizatorja.`
        );
        const security = statement.match(/\bsecurity\s+(definer|invoker)\b/i);
        if (security) state.security = security[1].toLowerCase();
        if (/\breset\s+(?:all|search_path)\b/i.test(statement)) state.searchPath = null;
        else if (/\bset\s+search_path\s*(?:=|to)\s*''/i.test(statement)) state.searchPath = "";
        else if (/\bset\s+search_path\s*(?:=|to)\s*/i.test(statement)) state.searchPath = "nonempty";
        state.lastMutationFile = fileName;
        continue;
      }

      const aclMutation = parseAclReferences(statement);
      if (aclMutation) {
        for (const aclReference of aclMutation.references) {
          if (targetBareNames.has(aclReference.name)) {
            assert.ok(targetByKey.has(aclReference.key), `ACL uporablja neznan overload varovane funkcije ${aclReference.key} (${fileName}).`);
          }
          if (!targetByKey.has(aclReference.key)) continue;
          const state = states.get(aclReference.key);
          assert.ok(state, `ACL sprememba je pred CREATE za ${aclReference.key} (${fileName}).`);
          aclMutation.roles.forEach((role) => (
            aclMutation.isGrant ? state.acl.add(role) : state.acl.delete(role)
          ));
          state.lastMutationFile = fileName;
        }
        continue;
      }

      parsed = parseReference(statement, "drop\\s+function(?:\\s+if\\s+exists)?");
      if (parsed) {
        if (targetBareNames.has(parsed.name)) {
          assert.ok(targetByKey.has(parsed.key), `DROP uporablja neznan overload varovane funkcije ${parsed.key} (${fileName}).`);
        }
        if (targetByKey.has(parsed.key)) states.delete(parsed.key);
        continue;
      }

      if (/^(?:create(?:\s+or\s+replace)?|alter|drop)\s+(?:function|routine)\b|^(?:grant|revoke)\b[\s\S]*?\bon\s+(?:function|routine)\b/i.test(statement)) {
        const lower = statement.toLowerCase();
        const relevant = Array.from(targetBareNames).find((name) => new RegExp(`\\b${escapeRegex(name)}\\s*\\(`, "i").test(lower));
        assert.equal(relevant, undefined, `Neprepoznan DDL za varovano funkcijo ${relevant} (${fileName}).`);
      }
    }
  }
  return states;
}

const finalStates = applyMigrationChain();
for (const expected of finalTargets) {
  const state = finalStates.get(expected.key);
  assert.ok(state, `Migracijska veriga nima končne definicije ${expected.key}.`);
  assert.equal(state.explicitSecurity, true, `${expected.key} mora eksplicitno določiti SECURITY.`);
  assert.equal(state.security, expected.security, `${expected.key} ima napačen končni SECURITY način (${state.lastMutationFile}).`);
  assert.equal(state.searchPath, "", `${expected.key} mora imeti končni prazen search_path (${state.lastMutationFile}).`);
  assert.deepEqual(Array.from(state.acl).sort(), expected.roles, `${expected.key} ima napačen končni EXECUTE ACL.`);
  expected.bodyChecks.forEach((pattern) => assert.match(
    state.definition,
    pattern,
    `${expected.key} v ${state.definitionFile} ne izpolni končne varnostne invarianti ${pattern}.`
  ));
}

const bankState = finalStates.get(functionKey("private", "_pos_confirm_bank_transaction", ["uuid", "uuid", "boolean"]));
const invoiceLockAt = bankState.definition.search(/select\s+\*\s+into\s+v_invoice[\s\S]*?for\s+update/i);
const transactionLockAt = bankState.definition.search(/select\s+\*\s+into\s+v_transaction[\s\S]*?for\s+update/i);
assert.ok(invoiceLockAt >= 0 && transactionLockAt > invoiceLockAt, "Bančna pot mora zakleniti račun pred bančno transakcijo.");

function isLoopback(hostname) {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(String(hostname || "").toLowerCase());
}

async function verifyLiveCatalog() {
  const explicitUrl = Boolean(process.env.POS_TEST_DATABASE_URL);
  const required = /^(?:1|true)$/i.test(String(process.env.POS_REQUIRE_RPC_CATALOG || ""));
  const connectionString = String(
    process.env.POS_TEST_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  );
  const parsedUrl = new URL(connectionString);
  if (!isLoopback(parsedUrl.hostname)) {
    throw new Error("POS RPC catalog test je zaklenjen na lokalno loopback Supabase bazo.");
  }

  const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 2000 });
  let rows;
  try {
    const schemas = Array.from(new Set(finalTargets.map((entry) => entry.schema)));
    const names = Array.from(new Set(finalTargets.map((entry) => entry.name)));
    const result = await pool.query(`
      select n.nspname as schema_name,
             p.proname as function_name,
             oidvectortypes(p.proargtypes) as identity_args,
             p.prosecdef,
             p.proconfig,
             p.proacl::text as proacl,
             pg_get_userbyid(p.proowner) as owner_name,
             acl_state.execute_roles
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        left join lateral (
          select coalesce(
                   array_agg(distinct coalesce(role.rolname::text, 'public'))
                     filter (where expanded.privilege_type = 'EXECUTE'),
                   array[]::text[]
                 ) as execute_roles
            from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) expanded
            left join pg_roles role on role.oid = expanded.grantee
        ) acl_state on true
       where n.nspname = any($1::text[])
         and p.proname = any($2::text[])
       order by n.nspname, p.proname, oidvectortypes(p.proargtypes)
    `, [schemas, names]);
    rows = result.rows;
  } catch (error) {
    if (!explicitUrl && !required && ["ECONNREFUSED", "ETIMEDOUT"].includes(error && error.code)) {
      console.log("POS RPC pg_proc catalog: SKIP (lokalna Supabase baza ni dosegljiva na 127.0.0.1:54322)");
      return;
    }
    throw error;
  } finally {
    await pool.end();
  }

  const rowsByKey = new Map();
  rows.forEach((row) => {
    const args = identityTypes(String(row.identity_args || ""));
    const key = functionKey(row.schema_name, row.function_name, args);
    if (targetBareNames.has(String(row.function_name || "").toLowerCase())) {
      assert.ok(targetByKey.has(key), `pg_proc vsebuje neznan overload varovane funkcije ${key}.`);
    }
    if (targetByKey.has(key)) {
      assert.equal(rowsByKey.has(key), false, `pg_proc vsebuje podvojeno identiteto ${key}.`);
      rowsByKey.set(key, row);
    }
  });

  for (const expected of finalTargets) {
    const row = rowsByKey.get(expected.key);
    assert.ok(row, `pg_proc nima končne signature ${expected.key}; lokalna baza nima celotne migracijske verige.`);
    assert.equal(Boolean(row.prosecdef), expected.security === "definer", `${expected.key}: napačen pg_proc.prosecdef.`);
    assert.ok(Array.isArray(row.proconfig), `${expected.key}: pg_proc.proconfig ne sme biti NULL.`);
    const searchPathSettings = row.proconfig.filter((entry) => /^search_path=/i.test(String(entry)));
    assert.equal(searchPathSettings.length, 1, `${expected.key}: pg_proc.proconfig mora vsebovati natanko en search_path.`);
    assert.match(String(searchPathSettings[0]), /^search_path=(?:""|)$/i, `${expected.key}: search_path mora biti prazen.`);
    assert.notEqual(row.proacl, null, `${expected.key}: pg_proc.proacl mora biti eksplicitno omejen.`);
    const executeRoles = (row.execute_roles || [])
      .map((role) => String(role).toLowerCase())
      .filter((role) => role !== String(row.owner_name || "").toLowerCase())
      .sort();
    assert.deepEqual(executeRoles, expected.roles, `${expected.key}: napačen efektivni pg_proc.proacl.`);
  }
  console.log(`POS RPC pg_proc catalog: OK (${finalTargets.length} končnih podpisov)`);
}

verifyLiveCatalog()
  .then(() => console.log(`POS RPC security hardening tests passed (${finalTargets.length} final migration-chain signatures verified).`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
