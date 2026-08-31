"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const HANDLER_PATH = process.env.HANDLER_PATH
  ? path.resolve(process.env.HANDLER_PATH)
  : path.join(__dirname, "..", "api", "_handlers", "pos-stripe-webhook.js");

const { reconcileSessionState, reconcileCompetingAndOriginal, isTerminalSession, needsReconciliationFollowUp } =
  require(HANDLER_PATH)._test;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
const COMPETING_SESSION = "cs_test_competing";
const ORIGINAL_SESSION = "cs_test_original";
const COMPETING_ATTEMPT = "33333333-3333-4333-8333-333333333333";
const ORIGINAL_ATTEMPT = "44444444-4444-4444-8444-444444444444";

function session(id, status, paymentStatus, attemptId, over) {
  return Object.assign({
    id,
    status,
    payment_status: paymentStatus,
    livemode: false,
    amount_total: 10000,
    currency: "eur",
    payment_intent: "pi_" + id,
    metadata: {
      test_mode: "true",
      user_id: USER_ID,
      invoice_id: INVOICE_ID,
      provider_attempt_id: attemptId,
    },
  }, over || {});
}

// Fake Stripe. `script` maps sessionId -> array of sessions returned by
// successive retrieve() calls, so a test can model "open before expire,
// expired after expire".
function fakeStripe(script, failures) {
  const calls = { retrieve: [], expire: [] };
  const cursors = {};
  const fails = failures || {};
  return {
    calls,
    checkout: {
      sessions: {
        async retrieve(id) {
          calls.retrieve.push(id);
          if (fails.retrieve && fails.retrieve[id]) throw new Error(fails.retrieve[id]);
          const seq = script[id];
          if (!seq) throw new Error("Neznana seja: " + id);
          const index = Math.min(cursors[id] || 0, seq.length - 1);
          cursors[id] = (cursors[id] || 0) + 1;
          return seq[index];
        },
        async expire(id) {
          calls.expire.push(id);
          if (fails.expire && fails.expire[id]) throw new Error(fails.expire[id]);
          return { id, status: "expired" };
        },
      },
    },
  };
}

function fakeRpc(failures) {
  const calls = [];
  const fails = failures || {};
  const fn = async function (name, args) {
    calls.push({ name, sessionId: args && args.p_checkout_session_id, args });
    const key = args && args.p_checkout_session_id;
    if (fails[key]) throw new Error(fails[key]);
    return { ok: true };
  };
  fn.calls = calls;
  return fn;
}

function baseResult(over) {
  return Object.assign({
    matched: true,
    duplicate: false,
    status: "pending",
    failure_code: "paid_requires_reconciliation",
    invoice_id: INVOICE_ID,
    competing_checkout_session_id: COMPETING_SESSION,
    competing_provider_attempt_id: COMPETING_ATTEMPT,
    original_checkout_session_id: ORIGINAL_SESSION,
    original_provider_attempt_id: ORIGINAL_ATTEMPT,
  }, over || {});
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------

test("competitor open+unpaid -> expire, re-retrieve terminal, reconcile both", async () => {
  const stripe = fakeStripe({
    [COMPETING_SESSION]: [
      session(COMPETING_SESSION, "open", "unpaid", COMPETING_ATTEMPT),
      session(COMPETING_SESSION, "expired", "unpaid", COMPETING_ATTEMPT),
    ],
    [ORIGINAL_SESSION]: [session(ORIGINAL_SESSION, "complete", "paid", ORIGINAL_ATTEMPT)],
  });
  const rpc = fakeRpc();
  await reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult());

  assert.deepEqual(stripe.calls.expire, [COMPETING_SESSION], "Expire samo za konkurenta.");
  assert.deepEqual(
    rpc.calls.map((c) => c.sessionId),
    [COMPETING_SESSION, ORIGINAL_SESSION],
    "Najprej konkurent, nato prvotna seja."
  );
  assert.equal(rpc.calls[0].args.p_session_status, "expired");
  assert.equal(rpc.calls[1].args.p_payment_status, "paid");
});

test("competitor already expired -> no expire, reconcile both", async () => {
  const stripe = fakeStripe({
    [COMPETING_SESSION]: [session(COMPETING_SESSION, "expired", "unpaid", COMPETING_ATTEMPT)],
    [ORIGINAL_SESSION]: [session(ORIGINAL_SESSION, "complete", "paid", ORIGINAL_ATTEMPT)],
  });
  const rpc = fakeRpc();
  await reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult());

  assert.deepEqual(stripe.calls.expire, [], "Potekle seje ne smemo znova expire-ati.");
  assert.deepEqual(rpc.calls.map((c) => c.sessionId), [COMPETING_SESSION, ORIGINAL_SESSION]);
});

test("competitor already paid -> no expire, reconcile both (gross invariant left to DB)", async () => {
  const stripe = fakeStripe({
    [COMPETING_SESSION]: [session(COMPETING_SESSION, "complete", "paid", COMPETING_ATTEMPT)],
    [ORIGINAL_SESSION]: [session(ORIGINAL_SESSION, "complete", "paid", ORIGINAL_ATTEMPT)],
  });
  const rpc = fakeRpc();
  await reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult());

  assert.deepEqual(stripe.calls.expire, [], "Plačane seje ne smemo expire-ati.");
  assert.deepEqual(
    rpc.calls.map((c) => c.sessionId),
    [COMPETING_SESSION, ORIGINAL_SESSION],
    "Dejansko prejeti denar konkurenta mora biti vseeno usklajen."
  );
  assert.equal(rpc.calls[0].args.p_payment_status, "paid");
});

test("expire succeeds but session still open+unpaid -> throw, original NOT reconciled", async () => {
  const stripe = fakeStripe({
    [COMPETING_SESSION]: [
      session(COMPETING_SESSION, "open", "unpaid", COMPETING_ATTEMPT),
      session(COMPETING_SESSION, "open", "unpaid", COMPETING_ATTEMPT),
    ],
    [ORIGINAL_SESSION]: [session(ORIGINAL_SESSION, "complete", "paid", ORIGINAL_ATTEMPT)],
  });
  const rpc = fakeRpc();
  await assert.rejects(
    () => reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult()),
    (error) => error && error.code === "STRIPE_SESSION_STILL_OPEN"
  );
  assert.deepEqual(stripe.calls.expire, [COMPETING_SESSION]);
  assert.deepEqual(rpc.calls, [], "Ob nedokazanem zaprtju se ne sme uskladiti niti konkurent niti prvotna seja.");
});

test("competitor retrieve fails -> throw, nothing reconciled", async () => {
  const stripe = fakeStripe(
    { [COMPETING_SESSION]: [session(COMPETING_SESSION, "open", "unpaid", COMPETING_ATTEMPT)] },
    { retrieve: { [COMPETING_SESSION]: "network down" } }
  );
  const rpc = fakeRpc();
  await assert.rejects(() => reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult()));
  assert.deepEqual(rpc.calls, []);
});

test("expire call fails -> throw, nothing reconciled", async () => {
  const stripe = fakeStripe(
    { [COMPETING_SESSION]: [session(COMPETING_SESSION, "open", "unpaid", COMPETING_ATTEMPT)] },
    { expire: { [COMPETING_SESSION]: "stripe 500" } }
  );
  const rpc = fakeRpc();
  await assert.rejects(() => reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult()));
  assert.deepEqual(rpc.calls, []);
});

test("competitor RPC fails -> throw, original NOT reconciled", async () => {
  const stripe = fakeStripe({
    [COMPETING_SESSION]: [session(COMPETING_SESSION, "expired", "unpaid", COMPETING_ATTEMPT)],
    [ORIGINAL_SESSION]: [session(ORIGINAL_SESSION, "complete", "paid", ORIGINAL_ATTEMPT)],
  });
  const rpc = fakeRpc({ [COMPETING_SESSION]: "db unavailable" });
  await assert.rejects(() => reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult()));
  assert.deepEqual(rpc.calls.map((c) => c.sessionId), [COMPETING_SESSION], "Prvotna seja se ne sme uskladiti.");
});

test("original RPC fails -> throw; competitor write already committed is safe and retryable", async () => {
  const stripe = fakeStripe({
    [COMPETING_SESSION]: [session(COMPETING_SESSION, "expired", "unpaid", COMPETING_ATTEMPT)],
    [ORIGINAL_SESSION]: [session(ORIGINAL_SESSION, "complete", "paid", ORIGINAL_ATTEMPT)],
  });
  const rpc = fakeRpc({ [ORIGINAL_SESSION]: "db unavailable" });
  await assert.rejects(() => reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult()));
  // The partial state is explicit and intended: competitor synced, original untouched.
  assert.deepEqual(rpc.calls.map((c) => c.sessionId), [COMPETING_SESSION, ORIGINAL_SESSION]);
});

test("retry after partially successful competitor reconcile is idempotent", async () => {
  // Second delivery of the same event: competitor is now already expired,
  // so no expire happens, both reconciles run, and the end state matches a
  // clean first run.
  const stripe = fakeStripe({
    [COMPETING_SESSION]: [session(COMPETING_SESSION, "expired", "unpaid", COMPETING_ATTEMPT)],
    [ORIGINAL_SESSION]: [session(ORIGINAL_SESSION, "complete", "paid", ORIGINAL_ATTEMPT)],
  });
  const rpc = fakeRpc();
  await reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult({ duplicate: true }));
  assert.deepEqual(stripe.calls.expire, []);
  assert.deepEqual(rpc.calls.map((c) => c.sessionId), [COMPETING_SESSION, ORIGINAL_SESSION]);
});

test("missing original_checkout_session_id -> broken contract, nothing touched", async () => {
  const stripe = fakeStripe({
    [COMPETING_SESSION]: [session(COMPETING_SESSION, "expired", "unpaid", COMPETING_ATTEMPT)],
  });
  const rpc = fakeRpc();
  await assert.rejects(
    () => reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult({ original_checkout_session_id: "" })),
    (error) => error && error.code === "STRIPE_RECONCILIATION_CONTRACT_BROKEN"
  );
  assert.deepEqual(rpc.calls, []);
  assert.deepEqual(stripe.calls.retrieve, [], "Brez veljavne pogodbe ne sme klicati Stripa.");
});

test("missing invoice_id -> broken contract", async () => {
  const stripe = fakeStripe({});
  const rpc = fakeRpc();
  await assert.rejects(
    () => reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult({ invoice_id: "" })),
    (error) => error && error.code === "STRIPE_RECONCILIATION_CONTRACT_BROKEN"
  );
  assert.deepEqual(rpc.calls, []);
});

test("missing competing attempt id -> broken contract before Stripe", async () => {
  const stripe = fakeStripe({});
  const rpc = fakeRpc();
  await assert.rejects(
    () => reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult({ competing_provider_attempt_id: null })),
    (error) => error && error.code === "STRIPE_RECONCILIATION_CONTRACT_BROKEN"
  );
  assert.deepEqual(stripe.calls.retrieve, []);
  assert.deepEqual(rpc.calls, []);
});

test("session identity is validated: wrong invoice metadata is rejected", async () => {
  const bad = session(COMPETING_SESSION, "expired", "unpaid", COMPETING_ATTEMPT);
  bad.metadata.invoice_id = "99999999-9999-4999-8999-999999999999";
  const stripe = fakeStripe({ [COMPETING_SESSION]: [bad] });
  const rpc = fakeRpc();
  await assert.rejects(
    () => reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult()),
    (error) => error && error.code === "STRIPE_SESSION_MISMATCH"
  );
  assert.deepEqual(rpc.calls, []);
});

test("session identity is validated: livemode session is rejected", async () => {
  const bad = session(COMPETING_SESSION, "expired", "unpaid", COMPETING_ATTEMPT, { livemode: true });
  const stripe = fakeStripe({ [COMPETING_SESSION]: [bad] });
  const rpc = fakeRpc();
  await assert.rejects(
    () => reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult()),
    (error) => error && error.code === "STRIPE_LIVE_SESSION_REJECTED"
  );
  assert.deepEqual(rpc.calls, []);
});

test("session identity is validated: wrong provider_attempt_id is rejected", async () => {
  const bad = session(COMPETING_SESSION, "expired", "unpaid", "55555555-5555-4555-8555-555555555555");
  const stripe = fakeStripe({ [COMPETING_SESSION]: [bad] });
  const rpc = fakeRpc();
  await assert.rejects(
    () => reconcileCompetingAndOriginal(stripe, rpc, USER_ID, baseResult()),
    (error) => error && error.code === "STRIPE_SESSION_MISMATCH"
  );
  assert.deepEqual(rpc.calls, []);
});

test("isTerminalSession / needsReconciliationFollowUp behave as documented", () => {
  assert.equal(isTerminalSession({ status: "open", payment_status: "unpaid" }), false);
  assert.equal(isTerminalSession({ status: "open", payment_status: "paid" }), true);
  assert.equal(isTerminalSession({ status: "expired", payment_status: "unpaid" }), true);
  assert.equal(isTerminalSession({ status: "complete", payment_status: "paid" }), true);

  assert.equal(needsReconciliationFollowUp(null), false);
  assert.equal(needsReconciliationFollowUp({ failure_code: "", competing_checkout_session_id: "cs_test_x" }), false);
  assert.equal(needsReconciliationFollowUp({ failure_code: "paid_requires_reconciliation", competing_checkout_session_id: "" }), false);
  assert.equal(needsReconciliationFollowUp({ failure_code: "paid_requires_reconciliation", competing_checkout_session_id: "cs_test_x" }), true);
  assert.equal(needsReconciliationFollowUp({ failure_code: "paid_requires_reconciliation", competing_checkout_session_id: null }), true);
  assert.equal(needsReconciliationFollowUp({ failure_code: "paid_requires_reconciliation", competing_checkout_session_id: {} }), true);
});

// ---------------------------------------------------------------------

(async function run() {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log("  ok   " + t.name);
    } catch (error) {
      failed += 1;
      console.error("  FAIL " + t.name);
      console.error("       " + String(error && error.message || error));
    }
  }
  if (failed) {
    console.error("\nPOS stripe webhook handler (mocked): " + failed + " of " + tests.length + " failed");
    process.exitCode = 1;
  } else {
    console.log("\nPOS stripe webhook handler (mocked): OK (" + tests.length + " tests)");
  }
})();
