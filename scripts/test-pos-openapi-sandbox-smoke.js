"use strict";

const assert = require("node:assert/strict");
const openapi = require("../api/_lib/pos-openapi-invoice");
const smoke = require("./smoke-pos-openapi-sandbox-live");

const pdf = Buffer.from("local dry fixture");
const cancellationInvoice = smoke.invoicePackage("LOCAL-STORNO", "STORNO", pdf);
const creditInvoice = smoke.invoicePackage("LOCAL-GUTSCHRIFT", "GUTSCHRIFT", pdf);
const cancellation = smoke.adjustmentPackage(cancellationInvoice, "cancellation", "LOCAL-STORNO", pdf);
const creditNote = smoke.adjustmentPackage(creditInvoice, "credit_note", "LOCAL-GUTSCHRIFT", pdf);
const resumedInvoice = smoke.invoicePackage("NEW-RUN", "STORNO", pdf);
const resumedRunId = smoke.resumeSandboxOriginal(resumedInvoice, "SBX-1687e1c2364b44ff-TEST-LIVE-STORNO-1787745223265");
assert.equal(resumedRunId, "1787745223265");
assert.equal(openapi.documentNumber(resumedInvoice.invoice, true), "SBX-1687e1c2364b44ff-TEST-LIVE-STORNO-1787745223265");
const options = { sandbox: true, env: { OPENAPI_INVOICE_SANDBOX_FISCAL_ID: "DE123456789" } };
const publicPayload = openapi.invoicePayload(smoke.publicInvoicePackage("LOCAL-B2G", pdf), options);
assert.equal(publicPayload.leitweg_id, "10101010-STO-10");
assert.equal(publicPayload.recipient.leitweg_id, "10101010-STO-10");
const cancellationPayload = openapi.invoicePayload(cancellation, options);
const creditPayload = openapi.invoicePayload(creditNote, options);

smoke.assertFinancialAdjustmentPayloads(cancellationPayload, creditPayload, cancellationInvoice, creditInvoice);
assert.equal(cancellationPayload.type, "381");
assert.equal(creditPayload.type, "381");
assert.match(cancellationPayload.billing_reference.document_number, /^SBX-/);
assert.match(creditPayload.billing_reference.document_number, /^SBX-/);

const evidenceReport = smoke.controlledSandboxEvidenceReport(
  [cancellationPayload, creditPayload],
  [cancellation, creditNote],
  [{ providerReference: "a".repeat(24) }, { providerReference: "b".repeat(24) }],
  {
    0: { state: "SENT", externalStatus: "succeeded", eventAt: "2026-08-26T12:52:15.000Z" },
    1: { state: "SENT", externalStatus: "succeeded", eventAt: "2026-08-26T12:52:16.000Z" },
  },
  [0, 1]
);
assert.equal(evidenceReport.version, 1);
assert.equal(evidenceReport.observedOn, "2026-08-26");
assert.deepStrictEqual(evidenceReport.cases.map((entry) => entry.kind), ["cancellation", "credit_note"]);
assert.equal(evidenceReport.cases[0].originalDocumentNumber, cancellationPayload.billing_reference.document_number);
assert.equal(evidenceReport.cases[1].billingReferenceDocumentNumber, creditPayload.billing_reference.document_number);

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get() { return null; } },
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

async function reconciliationRegressions() {
  let reads = 0;
  const done = await smoke.finalReconciliationState("adjustment-done", {
    env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
    maxAttempts: 2,
    waitMilliseconds: 0,
    fetch: async () => {
      reads += 1;
      return response(200, { data: { id: "adjustment-done", state: reads === 1 ? "SENT" : "DONE" } });
    },
  });
  assert.equal(done.state, "DONE");
  assert.equal(reads, 2);

  const delivered = await smoke.finalReconciliationState("adjustment-succeeded", {
    env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
    maxAttempts: 1,
    waitMilliseconds: 0,
    fetch: async () => response(200, { data: { id: "adjustment-succeeded", state: "SENT", details: { external_status: "succeeded" } } }),
  });
  assert.equal(delivered.state, "SENT");
  assert.equal(delivered.externalStatus, "succeeded");
  assert.equal(openapi.reconciliationSucceeded(delivered), true);
  assert.equal(openapi.reconciliationSucceeded({ state: "SENT", externalStatus: "in_process" }), false);

  await assert.rejects(
    smoke.finalReconciliationState("adjustment-error", {
      env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
      maxAttempts: 1,
      waitMilliseconds: 0,
      fetch: async () => response(200, { data: { id: "adjustment-error", state: "ERROR", details: { external_status: "rejected" } } }),
    }),
    (error) => error && error.code === "OPENAPI_SANDBOX_FINAL_ERROR"
  );

  await assert.rejects(
    smoke.finalReconciliationState("adjustment-pending", {
      env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
      maxAttempts: 2,
      waitMilliseconds: 0,
      fetch: async () => response(200, { data: { id: "adjustment-pending", state: "SENT" } }),
    }),
    (error) => error && error.code === "OPENAPI_SANDBOX_FINAL_STATE_TIMEOUT"
  );
}

async function authorizationRegressions() {
  let configurationReads = 0;
  const originalFetchConfiguration = openapi.fetchConfiguration;
  openapi.fetchConfiguration = async () => {
    configurationReads += 1;
    throw new Error("Sandbox smoke must not reach Openapi before every explicit confirmation.");
  };
  try {
    await assert.rejects(
      smoke.runSandboxSmoke({ env: {}, log: false }),
      /OPENAPI_INVOICE_SANDBOX_SMOKE_CONFIRMED/
    );
    await assert.rejects(
      smoke.runSandboxSmoke({
        env: {
          OPENAPI_INVOICE_TOKEN: "sandbox-token",
          OPENAPI_INVOICE_MODE: "sandbox",
          OPENAPI_INVOICE_SANDBOX_SMOKE_CONFIRMED: "true",
          OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET: "s".repeat(32),
          OPENAPI_INVOICE_SANDBOX_WEBHOOK_URL: "https://example.test/api/pos?handler=openapi-invoice&webhook=1&sandbox=1",
          OPENAPI_INVOICE_SANDBOX_FISCAL_ID: "DE123456789",
        },
        log: false,
      }),
      /OPENAPI_INVOICE_SANDBOX_381_PROBE_CONFIRMED/
    );
  } finally {
    openapi.fetchConfiguration = originalFetchConfiguration;
  }
  assert.equal(configurationReads, 0, "Unconfirmed smoke must perform zero Openapi configuration reads.");
}

authorizationRegressions().then(reconciliationRegressions).then(() => {
  console.log("POS Openapi sandbox smoke dry-payload and final-state tests passed.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
