"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Pool } = require("pg");

const connectionString = String(process.env.POS_TEST_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
const userId = String(process.env.POS_TEST_USER_ID || "");
const required = /^(1|true)$/i.test(String(process.env.POS_REQUIRE_PAYMENT_CONCURRENCY || ""));
const parsed = new URL(connectionString);

if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
  throw new Error("Concurrency harness je zaklenjen na loopback Supabase bazo.");
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
  if (required) throw new Error("POS_TEST_USER_ID je obvezen za zahtevani concurrency gate.");
  console.log("POS payment concurrency: SKIP (nastavi POS_TEST_USER_ID na uporabnika iz lokalnega Supabase okolja)");
  process.exit(0);
}

const pool = new Pool({ connectionString, max: 12, connectionTimeoutMillis: 3000 });
const invoiceIds = [];
const bankImportIds = [];
let createdTestUser = false;

function id() { return crypto.randomUUID(); }
function stripeSession() { return "cs_test_" + id().replace(/-/g, ""); }
function stripeEventId() { return "evt_" + id().replace(/-/g, ""); }
function stripeIntentId() { return "pi_" + id().replace(/-/g, ""); }
function sha256(text) { return crypto.createHash("sha256").update(text).digest("hex"); }

const SNAPSHOT_KEYS = [
  "payment_id", "invoice_id", "status", "failure_code", "reconciliation_reason",
  "competing_payment_id", "competing_checkout_session_id", "competing_provider_attempt_id",
  "original_checkout_session_id", "original_provider_attempt_id",
];

function snapshotOf(result) {
  const out = {};
  SNAPSHOT_KEYS.forEach((k) => { out[k] = result[k]; });
  return out;
}

async function ensureTestUser() {
  const existing = await pool.query("select 1 from auth.users where id=$1", [userId]);
  if (existing.rowCount) return;
  await pool.query("insert into auth.users(id,email) values ($1,$2)", [userId, "pos-concurrency-" + userId + "@example.invalid"]);
  createdTestUser = true;
}

async function createInvoice(grossCents) {
  const invoiceId = id();
  invoiceIds.push(invoiceId);
  await pool.query(`
    insert into public.pos_invoices(
      id,user_id,invoice_number,document_status,is_test,customer_type,customer_name,
      issue_date,service_date,due_date,tax_mode,net_cents,tax_cents,gross_cents,
      eligible_35a_cents,snapshot
    ) values ($1,$2,$3,'test',true,'private','Concurrency Test',
      current_date,current_date,current_date,'small_business',$4,0,$4,0,'{}'::jsonb)
  `, [invoiceId, userId, "CONC-" + invoiceId, grossCents]);
  return invoiceId;
}

async function registerStripe(invoiceId, attemptId, sessionId, amountCents) {
  return pool.query(`select (private._pos_register_stripe_checkout(
    $1,$2,$3,$4,$5,'EUR',now(),now() + interval '30 minutes'
  )).*`, [userId, invoiceId, attemptId, sessionId, amountCents]);
}

async function reconcileStripe(payment, sessionStatus, paymentStatus, paymentIntentId) {
  return pool.query(`select (private._pos_reconcile_stripe_checkout(
    $1,$2,$3,$4,$5,$6,'EUR',now()
  )).*`, [
    userId, payment.checkout_session_id, sessionStatus, paymentStatus,
    paymentIntentId || payment.external_payment_id || stripeIntentId(), payment.amount_cents,
  ]);
}

const APPLY_SQL = `select private._pos_apply_stripe_event(
  $1,$2,now(),$3,false,$4,$5,$6,$7,$8,$9,'EUR',$10,$11,$12
) as result`;

function applyArgs(payload, invoiceId, payment) {
  return [
    payload.eventId, payload.eventType, payload.sha, userId, invoiceId,
    payment.provider_attempt_id, payment.checkout_session_id, payload.paymentIntentId,
    payload.amountCents, payload.paymentStatus, payload.failureCode, payload.refundedCents,
  ];
}

function makePayload(payment, over) {
  const p = Object.assign({
    eventId: stripeEventId(),
    eventType: "payment_intent.succeeded",
    paymentIntentId: stripeIntentId(),
    paymentStatus: "succeeded",
    amountCents: payment.amount_cents,
    refundedCents: 0,
    failureCode: "",
  }, over || {});
  p.sha = p.sha || sha256(JSON.stringify(p));
  return p;
}

function applyStripeEvent(payment, invoiceId, payload) {
  return pool.query(APPLY_SQL, applyArgs(payload, invoiceId, payment));
}

async function applyStripeSucceeded(payment, invoiceId, paymentIntentId) {
  return applyStripeEvent(payment, invoiceId, makePayload(payment, {
    paymentIntentId: paymentIntentId || payment.external_payment_id || stripeIntentId(),
  }));
}

async function settledPair(first, second, expectedCode, expectedMessage) {
  const result = await Promise.allSettled([first(), second()]);
  assert.equal(result.filter((entry) => entry.status === "fulfilled").length, 1, JSON.stringify(result));
  assert.equal(result.filter((entry) => entry.status === "rejected").length, 1, JSON.stringify(result));
  const rejected = result.find((entry) => entry.status === "rejected");
  const expectedCodes = Array.isArray(expectedCode) ? expectedCode : [expectedCode];
  const expectedMessages = Array.isArray(expectedMessage) ? expectedMessage : [expectedMessage];
  assert.ok(expectedCodes.includes(rejected.reason && rejected.reason.code), rejected.reason && rejected.reason.stack);
  assert.ok(
    expectedMessages.some((message) => new RegExp(message).test(String(rejected.reason && rejected.reason.message || ""))),
    rejected.reason && rejected.reason.stack
  );
}

// ===================== existing coverage (unchanged) =====================

async function testStripeVsStripe() {
  const invoiceId = await createInvoice(10000);
  await settledPair(
    () => registerStripe(invoiceId, id(), stripeSession(), 10000),
    () => registerStripe(invoiceId, id(), stripeSession(), 10000),
    "23505", "POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS"
  );
  const count = await pool.query("select count(*)::int as count from public.pos_payments where invoice_id=$1 and provider='stripe' and status='pending'", [invoiceId]);
  assert.equal(count.rows[0].count, 1);
}

async function testAggregateGrossGuard() {
  const invoiceId = await createInvoice(10000);
  const insert = () => pool.query(`
    insert into public.pos_payments(
      user_id,invoice_id,amount_cents,currency,method,provider,provider_reference,paid_at,status,metadata
    ) values ($1,$2,10000,'EUR','manual','manual','concurrency',now(),'succeeded','{}'::jsonb)
  `, [userId, invoiceId]);
  await settledPair(insert, insert, "23514", "POS_INVOICE_GROSS_LIMIT_EXCEEDED");
  const total = await pool.query("select effective_paid_cents,gross_cents from private.pos_invoice_payment_totals where invoice_id=$1", [invoiceId]);
  assert.deepEqual(total.rows[0], { effective_paid_cents: "10000", gross_cents: "10000" });
}

async function testCashVsStripe() {
  const invoiceId = await createInvoice(10000);
  const receipt = {
    schema_version: 1, payment_type: "CASH", currency: "EUR", gross_cents: 10000,
    items: [{ description: "Concurrency", gross_cents: 10000, vat_rate: "0" }],
  };
  await settledPair(
    () => registerStripe(invoiceId, id(), stripeSession(), 10000),
    () => pool.query(`
      insert into public.pos_cash_checkouts(
        user_id,invoice_id,request_key,transaction_id,amount_cents,receipt_snapshot
      ) values ($1,$2,$3,$3,10000,$4::jsonb)
    `, [userId, invoiceId, id(), JSON.stringify(receipt)]),
    "23505", "POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS"
  );
  const active = await pool.query(`
    select
      (select count(*) from public.pos_payments where invoice_id=$1 and provider='stripe' and status='pending') +
      (select count(*) from public.pos_cash_checkouts where invoice_id=$1 and status in ('prepared','signed','recovery_required')) as count
  `, [invoiceId]);
  assert.equal(Number(active.rows[0].count), 1);
}

async function recordManual(invoiceId) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
    const result = await client.query("select (public.pos_record_manual_payment($1,$2,true)).*", [invoiceId, id()]);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function testManualVsStripe() {
  const invoiceId = await createInvoice(10000);
  await settledPair(
    () => registerStripe(invoiceId, id(), stripeSession(), 10000),
    () => recordManual(invoiceId),
    ["23505", "P0001"], ["POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS", "Račun je že v celoti plačan"]
  );
  const successful = await pool.query(`
    select count(*)::int as count from public.pos_payments
    where invoice_id=$1 and status in ('pending','succeeded','partially_refunded')
  `, [invoiceId]);
  assert.equal(successful.rows[0].count, 1);
}

async function testRetryableStripeAttemptStaysActive() {
  const invoiceId = await createInvoice(10000);
  const first = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const paymentId = first.rows[0].id;

  await pool.query("update public.pos_payments set status='failed', failure_code='card_declined' where id=$1", [paymentId]);
  await assert.rejects(
    registerStripe(invoiceId, id(), stripeSession(), 10000),
    (error) => error && error.code === "23505" && /POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS/.test(error.message)
  );

  await pool.query("update public.pos_payments set status='cancelled', failure_code='checkout_cancelled' where id=$1", [paymentId]);
  await assert.rejects(
    registerStripe(invoiceId, id(), stripeSession(), 10000),
    (error) => error && error.code === "23505" && /POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS/.test(error.message)
  );

  const reconciled = await pool.query(`select (private._pos_reconcile_stripe_checkout(
    $1,$2,'expired','unpaid','',10000,'EUR',now()
  )).*`, [userId, first.rows[0].checkout_session_id]);
  assert.equal(reconciled.rows[0].status, "cancelled");
  assert.equal(reconciled.rows[0].failure_code, "checkout_expired");
  const manual = await recordManual(invoiceId);
  assert.equal(manual.rows[0].status, "succeeded");
}

async function createBankTransaction(amountCents) {
  const importId = id();
  const transactionId = id();
  bankImportIds.push(importId);
  const sha = sha256(importId);
  await pool.query(`
    insert into public.pos_bank_imports(id,user_id,file_name,file_sha256,file_format)
    values ($1,$2,'concurrency.csv',$3,'csv')
  `, [importId, userId, sha]);
  await pool.query(`
    insert into public.pos_bank_transactions(
      id,user_id,import_id,source_key,booked_on,amount_cents,currency
    ) values ($1,$2,$3,$4,current_date,$5,'EUR')
  `, [transactionId, userId, importId, "concurrency-" + transactionId, amountCents]);
  return transactionId;
}

async function confirmBank(transactionId, invoiceId) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [userId]);
    const result = await client.query("select (public.pos_confirm_bank_transaction($1,$2,true)).*", [transactionId, invoiceId]);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function testBankCannotSettleActiveStripe() {
  const invoiceId = await createInvoice(10000);
  const transactionId = await createBankTransaction(10000);
  await registerStripe(invoiceId, id(), stripeSession(), 10000);
  await assert.rejects(
    confirmBank(transactionId, invoiceId),
    (error) => error && error.code === "23505" && /POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS/.test(error.message)
  );
}

async function testBankConfirmationRetryIdempotency() {
  const invoiceId = await createInvoice(10000);
  const otherInvoiceId = await createInvoice(10000);
  const transactionId = await createBankTransaction(10000);

  const first = await confirmBank(transactionId, invoiceId);
  const retry = await confirmBank(transactionId, invoiceId);
  assert.equal(retry.rows[0].id, first.rows[0].id, "Ponovitev mora vrniti isti confirmed_payment_id.");

  const stored = await pool.query(`
    select confirmed_invoice_id, confirmed_payment_id
    from public.pos_bank_transactions
    where id=$1
  `, [transactionId]);
  assert.equal(stored.rows[0].confirmed_invoice_id, invoiceId);
  assert.equal(stored.rows[0].confirmed_payment_id, first.rows[0].id);

  const paymentCount = await pool.query(
    "select count(*)::int as count from public.pos_payments where source_bank_transaction_id=$1",
    [transactionId]
  );
  assert.equal(paymentCount.rows[0].count, 1, "Retry ne sme ustvariti drugega plačila.");

  const auditCount = await pool.query(`
    select count(*)::int as count
    from public.pos_audit_events
    where entity_id=$1 and action='bank_payment_confirmed'
  `, [first.rows[0].id]);
  assert.equal(auditCount.rows[0].count, 1, "Retry ne sme podvojiti revizijskega dogodka.");

  await assert.rejects(
    confirmBank(transactionId, otherInvoiceId),
    (error) => error && error.code === "23514" && /POS_BANK_TRANSACTION_BINDING_CONFLICT/.test(error.message),
    "Že potrjene transakcije ni dovoljeno ponovno vezati na drug račun."
  );
}

async function testWebhookVsReconcile() {
  const invoiceId = await createInvoice(10000);
  const registered = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const payment = registered.rows[0];
  const paymentIntentId = stripeIntentId();
  const result = await Promise.allSettled([
    applyStripeSucceeded(payment, invoiceId, paymentIntentId),
    reconcileStripe(payment, "complete", "paid", paymentIntentId),
  ]);
  assert.equal(result.filter((entry) => entry.status === "rejected").length, 0, JSON.stringify(result));
  const stored = await pool.query("select status from public.pos_payments where id=$1", [payment.id]);
  assert.equal(stored.rows[0].status, "succeeded");
  const total = await pool.query("select effective_paid_cents,gross_cents from private.pos_invoice_payment_totals where invoice_id=$1", [invoiceId]);
  assert.deepEqual(total.rows[0], { effective_paid_cents: "10000", gross_cents: "10000" });
}

async function testRefundVsNewAttempt() {
  const invoiceId = await createInvoice(10000);
  const registered = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const paid = await reconcileStripe(registered.rows[0], "complete", "paid");
  const payment = paid.rows[0];
  const result = await Promise.allSettled([
    pool.query("update public.pos_payments set status='refunded', refunded_cents=amount_cents where id=$1", [payment.id]),
    registerStripe(invoiceId, id(), stripeSession(), 10000),
  ]);
  assert.equal(result[0].status, "fulfilled", JSON.stringify(result));
  if (result[1].status === "rejected") {
    assert.equal(result[1].reason && result[1].reason.code, "P0001", result[1].reason && result[1].reason.stack);
    assert.match(String(result[1].reason && result[1].reason.message || ""), /Račun je že v celoti plačan/);
  }
  const total = await pool.query("select effective_paid_cents,gross_cents from private.pos_invoice_payment_totals where invoice_id=$1", [invoiceId]);
  assert.ok(Number(total.rows[0].effective_paid_cents) <= Number(total.rows[0].gross_cents));
}

// ===================== FIXED: over-cap (review point 6) =====================
// The direct SQL INSERT below is deliberately a legacy/out-of-band fixture,
// NOT today's user-facing path — production always goes through the guarded
// RPCs, which would never allow this combination to arise on their own.
async function testWebhookOverCapPersistsReconciliation() {
  const invoiceId = await createInvoice(10000);
  const registered = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const payment = registered.rows[0];
  const paymentIntentId = stripeIntentId();

  const legacy = await pool.query(`
    insert into public.pos_payments(
      user_id,invoice_id,amount_cents,currency,method,provider,provider_reference,paid_at,status,metadata
    ) values ($1,$2,10000,'EUR','manual','manual','legacy-overcap',now(),'succeeded','{}'::jsonb)
    returning id
  `, [userId, invoiceId]);
  const legacyPaymentId = legacy.rows[0].id;

  const payload = makePayload(payment, { paymentIntentId });
  const applied = await applyStripeEvent(payment, invoiceId, payload);
  const result = applied.rows[0].result;

  assert.equal(result.matched, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.status, "pending");
  assert.equal(result.failure_code, "paid_requires_reconciliation");
  assert.equal(result.reconciliation_reason, "invoice_gross_limit");
  assert.equal(result.original_checkout_session_id, payment.checkout_session_id);
  assert.equal(result.original_provider_attempt_id, payment.provider_attempt_id);

  const stored = await pool.query("select status,failure_code from public.pos_payments where id=$1", [payment.id]);
  assert.equal(stored.rows[0].status, "pending");
  assert.equal(stored.rows[0].failure_code, "paid_requires_reconciliation");

  const eventCount = await pool.query(
    "select count(*)::int as count from public.pos_payment_events where payment_id=$1", [payment.id]);
  assert.equal(eventCount.rows[0].count, 1);

  const auditCount = await pool.query(
    "select count(*)::int as count from public.pos_audit_events where entity_id=$1 and action='stripe_payment_paid_requires_reconciliation'",
    [payment.id]);
  assert.equal(auditCount.rows[0].count, 1);

  // Same event_id again -> duplicate:true, identical snapshot, no new rows.
  const retried = await applyStripeEvent(payment, invoiceId, payload);
  assert.equal(retried.rows[0].result.duplicate, true);
  assert.deepEqual(snapshotOf(retried.rows[0].result), snapshotOf(result));
  const eventCount2 = await pool.query(
    "select count(*)::int as count from public.pos_payment_events where payment_id=$1", [payment.id]);
  assert.equal(eventCount2.rows[0].count, 1);
  const auditCount2 = await pool.query(
    "select count(*)::int as count from public.pos_audit_events where entity_id=$1 and action='stripe_payment_paid_requires_reconciliation'",
    [payment.id]);
  assert.equal(auditCount2.rows[0].count, 1);

  // ACTUALLY release the conflict: refund the legacy fixture payment so it
  // stops counting toward effective_paid_cents. (Refund rather than delete:
  // the row stays auditable and the totals trigger does the work.)
  await pool.query(
    "update public.pos_payments set status='refunded', refunded_cents=amount_cents where id=$1",
    [legacyPaymentId]
  );
  const afterRelease = await pool.query(
    "select effective_paid_cents,gross_cents from private.pos_invoice_payment_totals where invoice_id=$1", [invoiceId]);
  assert.equal(afterRelease.rows[0].effective_paid_cents, "0", "Konflikt mora biti dejansko odstranjen, preden pričakujemo succeeded.");

  const reconciled = await reconcileStripe(payment, "complete", "paid", paymentIntentId);
  assert.equal(reconciled.rows[0].status, "succeeded");
  assert.equal(reconciled.rows[0].failure_code, "");

  const finalTotal = await pool.query(
    "select effective_paid_cents,gross_cents from private.pos_invoice_payment_totals where invoice_id=$1", [invoiceId]);
  assert.ok(Number(finalTotal.rows[0].effective_paid_cents) <= Number(finalTotal.rows[0].gross_cents));
}

// ============ FIXED: deterministic duplicate race (review point 5) ============
async function testConcurrentDuplicateWebhookDeterministic() {
  const invoiceId = await createInvoice(10000);
  const registered = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const payment = registered.rows[0];
  const payload = makePayload(payment);

  const blocker = await pool.connect();
  let released = false;
  const releaseBlocker = async () => {
    if (released) return;
    released = true;
    try { await blocker.query("rollback"); } catch (_) {}
    blocker.release();
  };

  try {
    await blocker.query("set lock_timeout = '20000'");
    await blocker.query("begin");
    // Lock the INVOICE row: the function takes the invoice lock first, so
    // both callers queue here on the same relation.
    await blocker.query("select id from public.pos_invoices where id=$1 for update", [invoiceId]);

    async function spawnCaller() {
      const client = await pool.connect();
      await client.query("set lock_timeout = '20000'");
      await client.query("set statement_timeout = '20000'");
      const pidRow = await client.query("select pg_backend_pid()::int as pid");
      const pid = pidRow.rows[0].pid;
      const promise = client
        .query(APPLY_SQL, applyArgs(payload, invoiceId, payment))
        .finally(() => client.release());
      return { pid, promise };
    }

    const a = await spawnCaller();
    const b = await spawnCaller();
    const pending = Promise.allSettled([a.promise, b.promise]);

    // Prove BOTH specific backends are actually blocked before releasing.
    const deadline = Date.now() + 8000;
    let blocked = 0;
    while (Date.now() < deadline) {
      const check = await pool.query(
        `select count(*)::int as blocked
           from pg_stat_activity
          where pid = any($1::int[])
            and cardinality(pg_blocking_pids(pid)) > 0`,
        [[a.pid, b.pid]]
      );
      blocked = check.rows[0].blocked;
      if (blocked >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(blocked, 2, "Oba klica bi morala biti dokazano blokirana (blocked=" + blocked + ").");

    await releaseBlocker();

    const settled = await pending;
    assert.equal(settled.filter((e) => e.status === "rejected").length, 0, JSON.stringify(settled));

    const results = settled.map((e) => e.value.rows[0].result);
    const originals = results.filter((r) => r.duplicate === false);
    const duplicates = results.filter((r) => r.duplicate === true);
    assert.equal(originals.length, 1, "Natanko en klic sme biti nov dogodek.");
    assert.equal(duplicates.length, 1, "Natanko en klic mora biti duplicate.");
    assert.equal(originals[0].status, "succeeded");
    // Compare the SNAPSHOT, not the whole object: `duplicate` differs by
    // definition, so deepEqual on the full result could never pass.
    assert.deepEqual(snapshotOf(duplicates[0]), snapshotOf(originals[0]));

    const eventCount = await pool.query(
      "select count(*)::int as count from public.pos_payment_events where provider='stripe' and external_event_id=$1",
      [payload.eventId]
    );
    assert.equal(eventCount.rows[0].count, 1);
  } finally {
    await releaseBlocker();
  }
}

async function testWebhookVsExplicitReconcileNeverOvercommits() {
  const invoiceId = await createInvoice(10000);
  const registered = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const payment = registered.rows[0];
  const paymentIntentId = stripeIntentId();
  const settled = await Promise.allSettled([
    applyStripeSucceeded(payment, invoiceId, paymentIntentId),
    reconcileStripe(payment, "complete", "paid", paymentIntentId),
  ]);
  assert.equal(settled.filter((e) => e.status === "rejected").length, 0, JSON.stringify(settled));
  const stored = await pool.query("select status from public.pos_payments where id=$1", [payment.id]);
  assert.equal(stored.rows[0].status, "succeeded");
  const total = await pool.query("select effective_paid_cents,gross_cents from private.pos_invoice_payment_totals where invoice_id=$1", [invoiceId]);
  assert.ok(Number(total.rows[0].effective_paid_cents) <= Number(total.rows[0].gross_cents));
}

async function testExpiredOldSessionNewPendingDelayedPaidWebhook() {
  const invoiceId = await createInvoice(10000);
  const oldRegistered = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const oldPayment = oldRegistered.rows[0];
  const expired = await reconcileStripe(oldPayment, "expired", "unpaid");
  assert.equal(expired.rows[0].status, "cancelled");
  assert.equal(expired.rows[0].failure_code, "checkout_expired");

  const newRegistered = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const newPayment = newRegistered.rows[0];
  assert.equal(newPayment.status, "pending");

  const applied = await applyStripeEvent(oldPayment, invoiceId, makePayload(oldPayment));
  const result = applied.rows[0].result;

  assert.equal(result.status, "pending");
  assert.equal(result.failure_code, "paid_requires_reconciliation");
  assert.equal(result.reconciliation_reason, "payment_not_pending");
  assert.equal(result.competing_payment_id, newPayment.id);
  assert.equal(result.competing_checkout_session_id, newPayment.checkout_session_id);
  assert.equal(result.competing_provider_attempt_id, newPayment.provider_attempt_id);
  assert.equal(result.original_checkout_session_id, oldPayment.checkout_session_id);
  assert.equal(result.original_provider_attempt_id, oldPayment.provider_attempt_id);

  const newAfter = await pool.query("select status,failure_code from public.pos_payments where id=$1", [newPayment.id]);
  assert.equal(newAfter.rows[0].status, "pending");
  assert.equal(newAfter.rows[0].failure_code, "");

  await assert.rejects(
    registerStripe(invoiceId, id(), stripeSession(), 10000),
    (error) => error && error.code === "23505" && /POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS/.test(error.message)
  );
  await assert.rejects(
    recordManual(invoiceId),
    (error) => error && (error.code === "23505" || error.code === "P0001")
  );
}

async function testReusedEventIdDifferentPayloadRejected() {
  const invoiceId = await createInvoice(10000);
  const registered = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const payment = registered.rows[0];
  const payload = makePayload(payment);
  const first = await applyStripeEvent(payment, invoiceId, payload);
  assert.equal(first.rows[0].result.duplicate, false);

  const tampered = Object.assign({}, payload, { sha: sha256(payload.sha + ":tampered") });
  await assert.rejects(
    applyStripeEvent(payment, invoiceId, tampered),
    (error) => error && error.code === "23514" && /POS_STRIPE_EVENT_ID_PAYLOAD_MISMATCH/.test(error.message)
  );

  const eventCount = await pool.query(
    "select count(*)::int as count from public.pos_payment_events where provider='stripe' and external_event_id=$1",
    [payload.eventId]);
  assert.equal(eventCount.rows[0].count, 1);
}

async function testRetryAfterPaymentMutationReturnsOriginalSnapshot() {
  const invoiceId = await createInvoice(10000);
  const oldRegistered = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const oldPayment = oldRegistered.rows[0];
  await reconcileStripe(oldPayment, "expired", "unpaid");
  const newRegistered = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const newPayment = newRegistered.rows[0];

  const payload = makePayload(oldPayment);
  const first = await applyStripeEvent(oldPayment, invoiceId, payload);
  const firstResult = first.rows[0].result;
  assert.equal(firstResult.status, "pending");
  assert.equal(firstResult.competing_payment_id, newPayment.id);

  await pool.query(
    "update public.pos_payments set status='succeeded', paid_at=now(), failure_code='' where id=$1",
    [oldPayment.id]
  );

  const retry = await applyStripeEvent(oldPayment, invoiceId, payload);
  assert.equal(retry.rows[0].result.duplicate, true);
  assert.deepEqual(snapshotOf(retry.rows[0].result), snapshotOf(firstResult),
    "Retry mora vrniti prvotni event snapshot, ne trenutne (mutirane) vrstice.");
  assert.equal(retry.rows[0].result.status, "pending");
}

// ============ NEW: legacy pre-v6 events (review point 1) ============

// Strip the retry-stable snapshot keys to recreate a genuine pre-v6 summary shape.
const STRIP_SQL = `
update public.pos_payment_events
set summary = summary
  - 'outcome_version' - 'backfilled' - 'payment_id' - 'invoice_id' - 'status'
  - 'failure_code' - 'reconciliation_reason' - 'competing_payment_id'
  - 'competing_checkout_session_id' - 'competing_provider_attempt_id'
  - 'original_checkout_session_id' - 'original_provider_attempt_id'
where provider = 'stripe' and external_event_id = $1
`;

async function testLegacyEventWithoutSnapshotFailsClosed() {
  const invoiceId = await createInvoice(10000);
  const registered = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const payment = registered.rows[0];
  const payload = makePayload(payment);
  await applyStripeEvent(payment, invoiceId, payload);

  await pool.query(STRIP_SQL, [payload.eventId]);

  await assert.rejects(
    applyStripeEvent(payment, invoiceId, payload),
    (error) => error && error.code === "22023" && /POS_STRIPE_EVENT_SNAPSHOT_MISSING/.test(error.message),
    "Dogodek brez snapshot-a mora fail-closed, ne vrniti matched:true s praznimi polji."
  );
}

// ============ preflight tests (forward + rollback) ============

const OVERCAP_PREFLIGHT_SQL = `
do $$
begin
  if exists (
    select 1
    from public.pos_payments stripe_payment
    join private.pos_invoice_payment_totals totals
      on totals.invoice_id = stripe_payment.invoice_id
     and totals.user_id = stripe_payment.user_id
    where stripe_payment.provider = 'stripe'
      and (
        stripe_payment.status in ('pending','failed')
        or (stripe_payment.status = 'cancelled' and coalesce(stripe_payment.failure_code,'') <> 'checkout_expired')
      )
      and totals.effective_paid_cents + stripe_payment.amount_cents > totals.gross_cents
  ) then
    raise exception using errcode='23514', message='POS_STRIPE_EVENT_PREFLIGHT_OVERCAP_CONFLICT';
  end if;
end;
$$;`;

const INDEX_SWAP_PREFLIGHT_SQL = `
do $$
begin
  if exists (
    select 1 from public.pos_payments
    where provider = 'stripe'
      and (
        (status = 'pending' and coalesce(failure_code,'') <> 'paid_requires_reconciliation')
        or status = 'failed'
        or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
      )
    group by invoice_id having count(*) > 1
  ) then
    raise exception using errcode='23505', message='POS_STRIPE_EVENT_PREFLIGHT_INDEX_SWAP_CONFLICT';
  end if;
end;
$$;`;

// Exactly the OLD index predicate (review point 2).
const ROLLBACK_PREFLIGHT_SQL = `
do $$
begin
  if exists (
    select 1 from public.pos_payments
    where provider = 'stripe'
      and (
        status in ('pending','failed')
        or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
      )
    group by invoice_id having count(*) > 1
  ) then
    raise exception using errcode='23505', message='POS_STRIPE_EVENT_ROLLBACK_INDEX_RESTORE_CONFLICT';
  end if;
end;
$$;`;

async function testForwardPreflightsBlockAndPass() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const invoiceId = id();
    await client.query(`
      insert into public.pos_invoices(
        id,user_id,invoice_number,document_status,is_test,customer_type,customer_name,
        issue_date,service_date,due_date,tax_mode,net_cents,tax_cents,gross_cents,
        eligible_35a_cents,snapshot
      ) values ($1,$2,$3,'test',true,'private','Preflight',
        current_date,current_date,current_date,'small_business',10000,0,10000,0,'{}'::jsonb)
    `, [invoiceId, userId, "PFCONC-" + invoiceId]);
    await client.query(`select (private._pos_register_stripe_checkout(
      $1,$2,$3,$4,10000,'EUR',now(),now() + interval '30 minutes')).*`,
      [userId, invoiceId, id(), stripeSession()]);
    await client.query(`
      insert into public.pos_payments(
        user_id,invoice_id,amount_cents,currency,method,provider,provider_reference,paid_at,status,metadata
      ) values ($1,$2,5000,'EUR','manual','manual','legacy-preflight',now(),'succeeded','{}'::jsonb)
    `, [userId, invoiceId]);
    await assert.rejects(
      client.query(OVERCAP_PREFLIGHT_SQL),
      (error) => error && error.code === "23514" && /POS_STRIPE_EVENT_PREFLIGHT_OVERCAP_CONFLICT/.test(error.message)
    );
  } finally {
    await client.query("rollback");
    client.release();
  }

  const clean = await pool.connect();
  try {
    await clean.query("begin");
    const invoiceId = id();
    await clean.query(`
      insert into public.pos_invoices(
        id,user_id,invoice_number,document_status,is_test,customer_type,customer_name,
        issue_date,service_date,due_date,tax_mode,net_cents,tax_cents,gross_cents,
        eligible_35a_cents,snapshot
      ) values ($1,$2,$3,'test',true,'private','Preflight OK',
        current_date,current_date,current_date,'small_business',10000,0,10000,0,'{}'::jsonb)
    `, [invoiceId, userId, "PFCONCOK-" + invoiceId]);
    await clean.query(`select (private._pos_register_stripe_checkout(
      $1,$2,$3,$4,10000,'EUR',now(),now() + interval '30 minutes')).*`,
      [userId, invoiceId, id(), stripeSession()]);
    await clean.query(OVERCAP_PREFLIGHT_SQL);
    await clean.query(INDEX_SWAP_PREFLIGHT_SQL);
    await clean.query(ROLLBACK_PREFLIGHT_SQL);
  } finally {
    await clean.query("rollback");
    clean.release();
  }
}

// Rollback preflight must catch BOTH shapes the restored broad index rejects.
async function testRollbackPreflightBlocksActivePlusReconciliation() {
  const invoiceId = await createInvoice(10000);
  const oldRegistered = await registerStripe(invoiceId, id(), stripeSession(), 10000);
  const oldPayment = oldRegistered.rows[0];
  await reconcileStripe(oldPayment, "expired", "unpaid");
  await registerStripe(invoiceId, id(), stripeSession(), 10000);
  await applyStripeEvent(oldPayment, invoiceId, makePayload(oldPayment));

  const after = await pool.query("select status,failure_code from public.pos_payments where id=$1", [oldPayment.id]);
  assert.equal(after.rows[0].status, "pending");
  assert.equal(after.rows[0].failure_code, "paid_requires_reconciliation");

  const client = await pool.connect();
  try {
    await client.query("begin");
    await assert.rejects(
      client.query(ROLLBACK_PREFLIGHT_SQL),
      (error) => error && error.code === "23505" && /POS_STRIPE_EVENT_ROLLBACK_INDEX_RESTORE_CONFLICT/.test(error.message)
    );
  } finally {
    await client.query("rollback");
    client.release();
  }
}

// The case v5's rollback preflight missed entirely: TWO reconciliation rows
// and NO ordinary-active row. The narrowed index allows it; the restored
// broad index does not.
async function testRollbackPreflightBlocksTwoReconciliationRows() {
  const invoiceId = await createInvoice(10000);
  const client = await pool.connect();
  try {
    await client.query("begin");
    // Two pending + paid_requires_reconciliation Stripe rows on one invoice.
    for (let i = 0; i < 2; i += 1) {
      await client.query(`
        insert into public.pos_payments(
          user_id,invoice_id,amount_cents,currency,method,provider,provider_attempt_id,
          checkout_session_id,status,failure_code,provider_reference,paid_at,metadata
        ) values ($1,$2,1,'EUR','stripe_card','stripe',$3,$4,'pending','paid_requires_reconciliation',$4,null,'{}'::jsonb)
      `, [userId, invoiceId, id(), stripeSession()]);
    }
    const active = await client.query(`
      select count(*)::int as count from public.pos_payments
      where invoice_id=$1 and provider='stripe'
        and status='pending' and coalesce(failure_code,'') <> 'paid_requires_reconciliation'
    `, [invoiceId]);
    assert.equal(active.rows[0].count, 0, "Predpogoj: brez običajne aktivne vrstice.");

    await assert.rejects(
      client.query(ROLLBACK_PREFLIGHT_SQL),
      (error) => error && error.code === "23505" && /POS_STRIPE_EVENT_ROLLBACK_INDEX_RESTORE_CONFLICT/.test(error.message),
      "Dve reconciliation vrstici morata prav tako blokirati rollback."
    );
  } finally {
    await client.query("rollback");
    client.release();
  }
}

async function cleanup() {
  if (!invoiceIds.length) return;
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (bankImportIds.length) {
      await client.query(`
        update public.pos_bank_transactions
        set status='unmatched', confirmed_invoice_id=null, confirmed_payment_id=null, confirmed_at=null
        where import_id = any($1::uuid[])
      `, [bankImportIds]);
    }
    await client.query("delete from public.pos_cash_refunds where invoice_id = any($1::uuid[])", [invoiceIds]);
    await client.query("delete from public.pos_cash_checkouts where invoice_id = any($1::uuid[])", [invoiceIds]);
    await client.query("delete from public.pos_payment_events where payment_id in (select id from public.pos_payments where invoice_id = any($1::uuid[]))", [invoiceIds]);
    await client.query("delete from private.pos_manual_payment_requests where invoice_id = any($1::uuid[])", [invoiceIds]);
    await client.query("alter table public.pos_audit_events disable trigger pos_audit_events_immutable");
    await client.query("delete from public.pos_audit_events where details->>'invoice_id' = any($1::text[])", [invoiceIds]);
    await client.query("alter table public.pos_audit_events enable trigger pos_audit_events_immutable");
    await client.query("delete from public.pos_payments where invoice_id = any($1::uuid[])", [invoiceIds]);
    if (bankImportIds.length) {
      await client.query("delete from public.pos_bank_transactions where import_id = any($1::uuid[])", [bankImportIds]);
      await client.query("delete from public.pos_bank_imports where id = any($1::uuid[])", [bankImportIds]);
    }
    await client.query("delete from private.pos_invoice_payment_totals where invoice_id = any($1::uuid[])", [invoiceIds]);
    await client.query("alter table public.pos_invoices disable trigger pos_invoices_immutable");
    await client.query("delete from public.pos_invoices where id = any($1::uuid[])", [invoiceIds]);
    await client.query("alter table public.pos_invoices enable trigger pos_invoices_immutable");
    if (createdTestUser) await client.query("delete from auth.users where id=$1", [userId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

(async function run() {
  try {
    await pool.query("select 1");
    await ensureTestUser();
    await testStripeVsStripe();
    await testAggregateGrossGuard();
    await testCashVsStripe();
    await testManualVsStripe();
    await testRetryableStripeAttemptStaysActive();
    await testBankCannotSettleActiveStripe();
    await testBankConfirmationRetryIdempotency();
    await testWebhookVsReconcile();
    await testRefundVsNewAttempt();
    await testWebhookOverCapPersistsReconciliation();
    await testConcurrentDuplicateWebhookDeterministic();
    await testWebhookVsExplicitReconcileNeverOvercommits();
    await testExpiredOldSessionNewPendingDelayedPaidWebhook();
    await testReusedEventIdDifferentPayloadRejected();
    await testRetryAfterPaymentMutationReturnsOriginalSnapshot();
    await testLegacyEventWithoutSnapshotFailsClosed();
    await testForwardPreflightsBlockAndPass();
    await testRollbackPreflightBlocksActivePlusReconciliation();
    await testRollbackPreflightBlocksTwoReconciliationRows();
    console.log("POS payment concurrency (local Supabase): OK");
  } finally {
    await cleanup();
    await pool.end();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
