"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Pool } = require("pg");

const phase = String(process.argv[2] || "verify").toLowerCase();
const connectionString = String(process.env.POS_TEST_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
const userId = String(process.env.POS_TEST_USER_ID || "");
const required = /^(1|true)$/i.test(String(process.env.POS_REQUIRE_PAYMENT_CONCURRENCY || ""));
const parsed = new URL(connectionString);

if (!["seed", "verify"].includes(phase)) throw new Error("Uporabi fazo seed ali verify.");
if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
  throw new Error("Snapshot harness je zaklenjen na loopback Supabase bazo.");
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
  if (required) throw new Error("POS_TEST_USER_ID je obvezen za zahtevani snapshot gate.");
  console.log("POS stripe event snapshot: SKIP (nastavi POS_TEST_USER_ID)");
  process.exit(0);
}

const pool = new Pool({ connectionString, max: 6, connectionTimeoutMillis: 3000 });
const invoiceIds = new Set();
const LEGACY = Object.freeze({
  invoiceId: "70000000-0000-4000-8000-000000000001",
  attemptId: "70000000-0000-4000-8000-000000000002",
  sessionId: "cs_test_j2_legacy_snapshot",
  eventId: "evt_j2_legacy_snapshot",
  paymentIntentId: "pi_j2_legacy_snapshot",
  amountCents: 10000,
});
const LEGACY_SHA = crypto.createHash("sha256").update(JSON.stringify(LEGACY)).digest("hex");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function id() { return crypto.randomUUID(); }
function stripeSession() { return "cs_test_" + id().replace(/-/g, ""); }
function stripeEventId() { return "evt_" + id().replace(/-/g, ""); }
function stripeIntentId() { return "pi_" + id().replace(/-/g, ""); }
function sha256(text) { return crypto.createHash("sha256").update(text).digest("hex"); }

async function ensureTestUser() {
  const existing = await pool.query("select 1 from auth.users where id=$1", [userId]);
  if (!existing.rowCount) {
    await pool.query(
      "insert into auth.users(id,email) values ($1,$2)",
      [userId, "pos-snapshot-" + userId + "@example.invalid"]
    );
  }
  await pool.query(
    "insert into public.pos_business_profiles(user_id,invoice_prefix) values ($1,'SNAP') on conflict (user_id) do nothing",
    [userId]
  );
}

async function createInvoice(grossCents, fixedId) {
  const invoiceId = fixedId || id();
  invoiceIds.add(invoiceId);
  await pool.query(`
    insert into public.pos_invoices(
      id,user_id,invoice_number,document_status,is_test,customer_type,customer_name,
      issue_date,service_date,due_date,tax_mode,net_cents,tax_cents,gross_cents,
      eligible_35a_cents,snapshot
    ) values ($1,$2,$3,'test',true,'private','Snapshot Test',
      current_date,current_date,current_date,'small_business',$4,0,$4,0,'{}'::jsonb)
  `, [invoiceId, userId, "SNAP-" + invoiceId, grossCents]);
  return invoiceId;
}

async function registerStripe(invoiceId, amountCents, attemptId, sessionId) {
  const row = await pool.query(`select (private._pos_register_stripe_checkout(
    $1,$2,$3,$4,$5,'EUR',now(),now() + interval '30 minutes')).*`,
    [userId, invoiceId, attemptId || id(), sessionId || stripeSession(), amountCents]);
  return row.rows[0];
}

const APPLY_SQL = `select private._pos_apply_stripe_event(
  $1,'payment_intent.succeeded',now(),$2,false,$3,$4,$5,$6,$7,$8,'EUR','succeeded','',0
) as result`;

function frozenEvent(payment, over) {
  const event = Object.freeze(Object.assign({
    eventId: stripeEventId(),
    paymentIntentId: stripeIntentId(),
    amountCents: Number(payment.amount_cents),
  }, over || {}));
  return Object.freeze(Object.assign({}, event, {
    sha: sha256(JSON.stringify(event)),
  }));
}

function applyEvent(payment, invoiceId, event) {
  return pool.query(APPLY_SQL, [
    event.eventId, event.sha, userId, invoiceId, payment.provider_attempt_id,
    payment.checkout_session_id, event.paymentIntentId, event.amountCents,
  ]);
}

async function cleanup(ids) {
  const values = Array.from(ids || invoiceIds);
  if (!values.length) return;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from public.pos_payment_events where payment_id in (select id from public.pos_payments where invoice_id = any($1::uuid[]))", [values]);
    await client.query("alter table public.pos_audit_events disable trigger pos_audit_events_immutable");
    await client.query("delete from public.pos_audit_events where details->>'invoice_id' = any($1::text[])", [values]);
    await client.query("alter table public.pos_audit_events enable trigger pos_audit_events_immutable");
    await client.query("delete from public.pos_payments where invoice_id = any($1::uuid[])", [values]);
    await client.query("delete from private.pos_invoice_payment_totals where invoice_id = any($1::uuid[])", [values]);
    await client.query("alter table public.pos_invoices disable trigger pos_invoices_immutable");
    await client.query("delete from public.pos_invoices where id = any($1::uuid[])", [values]);
    await client.query("alter table public.pos_invoices enable trigger pos_invoices_immutable");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function seedLegacyFixture() {
  await ensureTestUser();
  await cleanup([LEGACY.invoiceId]);
  const invoiceId = await createInvoice(LEGACY.amountCents, LEGACY.invoiceId);
  const payment = await registerStripe(invoiceId, LEGACY.amountCents, LEGACY.attemptId, LEGACY.sessionId);
  await applyEvent(payment, invoiceId, Object.freeze({
    eventId: LEGACY.eventId,
    sha: LEGACY_SHA,
    paymentIntentId: LEGACY.paymentIntentId,
    amountCents: LEGACY.amountCents,
  }));
  const stored = await pool.query(
    "select summary from public.pos_payment_events where provider='stripe' and external_event_id=$1",
    [LEGACY.eventId]
  );
  assert.equal(stored.rowCount, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(stored.rows[0].summary, "outcome_version"), false,
    "Fixture mora biti ustvarjen pred J.2 in zato še ne sme imeti outcome snapshot-a.");
  console.log("POS stripe event snapshot seed: OK (legacy fixture pred J.2)");
}

function validSnapshot(over) {
  return Object.assign({
    outcome_version: 1,
    backfilled: false,
    payment_id: id(),
    invoice_id: id(),
    status: "succeeded",
    failure_code: "",
    reconciliation_reason: "",
    competing_payment_id: "",
    competing_checkout_session_id: "",
    competing_provider_attempt_id: "",
    original_checkout_session_id: stripeSession(),
    original_provider_attempt_id: id(),
  }, over || {});
}

async function validatorSays(snapshot) {
  const res = await pool.query(
    "select private._pos_stripe_event_snapshot_ok($1::jsonb) as ok",
    [JSON.stringify(snapshot)]
  );
  return res.rows[0].ok;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("dejanska migracija popravi pred-J.2 legacy snapshot", async () => {
  invoiceIds.add(LEGACY.invoiceId);
  const row = await pool.query(`
    select e.summary, private._pos_stripe_event_snapshot_ok(e.summary) as ok,
           p.id::text as payment_id
      from public.pos_payment_events e
      join public.pos_payments p on p.id=e.payment_id
     where e.provider='stripe' and e.external_event_id=$1
  `, [LEGACY.eventId]);
  assert.equal(row.rowCount, 1, "Manjka legacy fixture iz seed faze.");
  assert.equal(row.rows[0].ok, true);
  assert.equal(row.rows[0].summary.backfilled, true);
  assert.equal(row.rows[0].summary.payment_id, row.rows[0].payment_id);
  assert.equal(row.rows[0].summary.invoice_id, LEGACY.invoiceId);
  assert.equal(row.rows[0].summary.original_checkout_session_id, LEGACY.sessionId);
  assert.equal(row.rows[0].summary.original_provider_attempt_id, LEGACY.attemptId);
});

test("outcome_version zavrne string, objekt, array, null in boolean brez 22P02", async () => {
  for (const value of ["1", "abc", { a: 1 }, [1], null, true]) {
    assert.equal(await validatorSays(validSnapshot({ outcome_version: value })), false);
  }
});

test("outcome_version 0 zavrne; 1 in 2 sprejme", async () => {
  assert.equal(await validatorSays(validSnapshot({ outcome_version: 0 })), false);
  assert.equal(await validatorSays(validSnapshot({ outcome_version: 1 })), true);
  assert.equal(await validatorSays(validSnapshot({ outcome_version: 2 })), true);
});

test("neobjektni summary zavrne", async () => {
  for (const value of [[], "x", null]) {
    assert.equal(await validatorSays(value), false);
  }
});

test("vsako contract polje mora obstajati", async () => {
  const keys = [
    "payment_id", "invoice_id", "status", "failure_code", "reconciliation_reason",
    "competing_payment_id", "competing_checkout_session_id", "competing_provider_attempt_id",
    "original_checkout_session_id", "original_provider_attempt_id",
  ];
  for (const key of keys) {
    const snapshot = validSnapshot();
    delete snapshot[key];
    assert.equal(await validatorSays(snapshot), false, "Manjkajoč ključ: " + key);
  }
});

test("failure_code JSON null ali objekt ne more obiti reconciliation follow-upa", async () => {
  assert.equal(await validatorSays(validSnapshot({ failure_code: null })), false);
  assert.equal(await validatorSays(validSnapshot({ failure_code: { code: "paid_requires_reconciliation" } })), false);
});

test("vsa tekstovna contract polja zahtevajo JSON string", async () => {
  const keys = [
    "payment_id", "invoice_id", "status", "failure_code", "reconciliation_reason",
    "competing_payment_id", "competing_checkout_session_id", "competing_provider_attempt_id",
    "original_checkout_session_id", "original_provider_attempt_id",
  ];
  for (const key of keys) {
    assert.equal(await validatorSays(validSnapshot({ [key]: { invalid: true } })), false, "Napačen tip: " + key);
  }
});

test("status mora biti dovoljeno stanje plačila", async () => {
  assert.equal(await validatorSays(validSnapshot({ status: "unknown" })), false);
});

test("payment in invoice identiteta morata biti UUID", async () => {
  assert.equal(await validatorSays(validSnapshot({ payment_id: "not-a-uuid" })), false);
  assert.equal(await validatorSays(validSnapshot({ invoice_id: "not-a-uuid" })), false);
});

test("originalna Stripe identiteta mora biti veljavna in neprazna", async () => {
  assert.equal(await validatorSays(validSnapshot({ original_checkout_session_id: "" })), false);
  assert.equal(await validatorSays(validSnapshot({ original_checkout_session_id: "cs_live_x" })), false);
  assert.equal(await validatorSays(validSnapshot({ original_provider_attempt_id: "" })), false);
  assert.equal(await validatorSays(validSnapshot({ original_provider_attempt_id: "not-a-uuid" })), false);
});

test("competing tuple je lahko v celoti prazen", async () => {
  assert.equal(await validatorSays(validSnapshot()), true);
});

test("competing tuple mora biti popoln, tipno varen in reconciliation-only", async () => {
  const tuple = {
    failure_code: "paid_requires_reconciliation",
    competing_payment_id: id(),
    competing_checkout_session_id: stripeSession(),
    competing_provider_attempt_id: id(),
  };
  assert.equal(await validatorSays(validSnapshot(tuple)), true);
  assert.equal(await validatorSays(validSnapshot(Object.assign({}, tuple, { competing_payment_id: "" }))), false);
  assert.equal(await validatorSays(validSnapshot(Object.assign({}, tuple, { competing_checkout_session_id: 123 }))), false);
  assert.equal(await validatorSays(validSnapshot(Object.assign({}, tuple, { competing_provider_attempt_id: "bad" }))), false);
  assert.equal(await validatorSays(validSnapshot(Object.assign({}, tuple, { failure_code: "" }))), false);
});

test("retry uporablja isti zamrznjen payload in vrne isti snapshot", async () => {
  const invoiceId = await createInvoice(10000);
  const payment = await registerStripe(invoiceId, 10000);
  const event = frozenEvent(payment);
  const first = (await applyEvent(payment, invoiceId, event)).rows[0].result;
  const retry = (await applyEvent(payment, invoiceId, event)).rows[0].result;
  assert.equal(first.duplicate, false);
  assert.equal(retry.duplicate, true);
  const withoutDuplicate = (value) => Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "duplicate")
  );
  assert.deepEqual(withoutDuplicate(retry), withoutDuplicate(first));
});

test("pokvarjen failure_code JSON null na retryju fail-closed z 22023", async () => {
  const invoiceId = await createInvoice(10000);
  const payment = await registerStripe(invoiceId, 10000);
  const event = frozenEvent(payment);
  await applyEvent(payment, invoiceId, event);
  await pool.query(
    `update public.pos_payment_events
        set summary = jsonb_set(summary, '{failure_code}', 'null'::jsonb)
      where provider='stripe' and external_event_id=$1`,
    [event.eventId]
  );
  await assert.rejects(
    applyEvent(payment, invoiceId, event),
    (error) => error && error.code === "22023" && /POS_STRIPE_EVENT_SNAPSHOT_MISSING/.test(error.message)
  );
});

async function verifyMigrationAndValidator() {
  await ensureTestUser();
  let failed = 0;
  try {
    for (const current of tests) {
      try {
        await current.fn();
        console.log("  ok   " + current.name);
      } catch (error) {
        failed += 1;
        console.error("  FAIL " + current.name);
        console.error("       " + String(error && error.message || error));
      }
    }
  } finally {
    await cleanup();
  }
  if (failed) throw new Error("POS stripe event snapshot: " + failed + " of " + tests.length + " failed");
  console.log("\nPOS stripe event snapshot: OK (" + tests.length + " tests)");
}

(async function run() {
  try {
    await pool.query("select 1");
    if (phase === "seed") await seedLegacyFixture();
    else await verifyMigrationAndValidator();
  } finally {
    await pool.end();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
