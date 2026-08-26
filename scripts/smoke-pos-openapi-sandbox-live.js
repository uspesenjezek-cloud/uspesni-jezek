"use strict";

// Explicit live sandbox smoke test. It is intentionally excluded from the
// automatic test-pos-* regression loop because it creates a remote test record.

const assert = require("node:assert");
const crypto = require("node:crypto");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const openapi = require("../api/_lib/pos-openapi-invoice");
const { verifySandboxWebhook } = require("./pos-openapi-sandbox-webhook-preflight");

function isoDate(offsetDays) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function finalReconciliationState(providerReference, options) {
  const settings = options || {};
  const maxAttempts = Number.isInteger(settings.maxAttempts) && settings.maxAttempts > 0 ? settings.maxAttempts : 24;
  const waitMilliseconds = Number.isFinite(settings.waitMilliseconds) && settings.waitMilliseconds >= 0 ? settings.waitMilliseconds : 5000;
  const requestOptions = { env: settings.env || process.env };
  if (settings.fetch) requestOptions.fetch = settings.fetch;
  let latest = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const entry = await openapi.fetchInvoice(providerReference, requestOptions);
    latest = openapi.reconciliationEvent(entry);
    if (openapi.reconciliationSucceeded(latest)) return latest;
    if (latest.state === "ERROR") {
      const error = new Error("Openapi sandbox document reached ERROR: " + latest.externalStatus);
      error.code = "OPENAPI_SANDBOX_FINAL_ERROR";
      throw error;
    }
    if (attempt < maxAttempts) await wait(waitMilliseconds);
  }
  const error = new Error("Openapi sandbox document did not reach a final state; last state: " + (latest && latest.state || "unknown"));
  error.code = "OPENAPI_SANDBOX_FINAL_STATE_TIMEOUT";
  throw error;
}

async function pdfFixture() {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([595, 842]);
  page.drawText("Openapi Germany sandbox integration test", {
    x: 48, y: 780, size: 14, font, color: rgb(0.1, 0.1, 0.1),
  });
  return Buffer.from(await document.save());
}

function invoicePackage(runId, suffix, pdf) {
  const invoiceId = crypto.randomUUID();
  const invoiceNumber = "TEST-LIVE-" + suffix + "-" + runId;
  return {
    delivery: {
      id: crypto.randomUUID(),
      invoice_id: invoiceId,
      user_id: crypto.randomUUID(),
      provider: "openapi",
      is_test: true,
      channel: "email",
      document_format: "xrechnung_pdf",
    },
    invoice: {
      id: invoiceId,
      invoice_number: invoiceNumber,
      customer_type: "business",
      customer_name: "Sandbox Kunde GmbH",
      issue_date: isoDate(0),
      due_date: isoDate(14),
      tax_mode: "regular",
      net_cents: 100,
      tax_cents: 19,
      gross_cents: 119,
      is_test: true,
      snapshot: {
        seller: {
          legalName: "Uspešni Ježek Sandbox",
          vatId: "DE123456789",
          businessEmail: "sender@example.com",
          street: "Hauptstraße 42",
          postalCode: "10115",
          city: "Berlin",
          iban: "DE89370400440532013000",
        },
        draft: {
          customer_name: "Sandbox Kunde GmbH",
          customer_street: "Marktstraße 1",
          customer_postal_code: "80331",
          customer_city: "München",
          customer_vat_id: "DE987654321",
          customer_email: "recipient@example.com",
          payment_method: "sepa",
          items: [{
            description: "Sandbox Integrationsprüfung",
            quantity_milli: 1000,
            unit: "Std.",
            net_cents: 100,
            tax_cents: 19,
            gross_cents: 119,
            tax_rate_bps: 1900,
          }],
        },
      },
    },
    adjustment: null,
    attachments: [{
      kind: "invoice_pdf",
      filename: invoiceNumber + ".pdf",
      mediaType: "application/pdf",
      content: pdf,
      byteSize: pdf.length,
    }],
    manifestSha256: "live-sandbox-test",
  };
}

function adjustmentPackage(originalPackage, type, runId, pdf) {
  const creditNote = type === "credit_note";
  const adjustmentId = crypto.randomUUID();
  const adjustmentNumber = (creditNote ? "TEST-GS-" : "TEST-ST-") + runId;
  const netCents = creditNote ? 50 : 100;
  const taxCents = creditNote ? 10 : 19;
  const grossCents = netCents + taxCents;
  const original = originalPackage.invoice;
  return {
    delivery: Object.assign({}, originalPackage.delivery, {
      id: crypto.randomUUID(),
      adjustment_id: adjustmentId,
    }),
    invoice: original,
    adjustment: {
      id: adjustmentId,
      adjustment_number: adjustmentNumber,
      adjustment_type: type,
      reason: creditNote ? "Sandbox Kulanznachlass" : "Sandbox Vollstorno",
      issued_at: new Date().toISOString(),
      is_test: true,
      delta_net_cents: -netCents,
      delta_tax_cents: -taxCents,
      delta_gross_cents: -grossCents,
      snapshot: {
        seller: original.snapshot.seller,
        original_invoice: {
          id: original.id,
          invoice_number: original.invoice_number,
          issue_date: original.issue_date,
          service_date: original.snapshot.draft.service_date || original.issue_date,
          due_date: original.due_date,
          tax_mode: original.tax_mode,
          net_cents: original.net_cents,
          tax_cents: original.tax_cents,
          gross_cents: original.gross_cents,
        },
        original_draft: original.snapshot.draft,
        effective_draft: original.snapshot.draft,
        credit_lines: creditNote ? [{
          description: "Sandbox Kulanznachlass",
          tax_rate_bps: 1900,
          net_cents: netCents,
          tax_cents: taxCents,
          gross_cents: grossCents,
        }] : undefined,
      },
    },
    attachments: [{
      kind: "adjustment_pdf",
      filename: adjustmentNumber + ".pdf",
      mediaType: "application/pdf",
      content: pdf,
      byteSize: pdf.length,
    }],
    manifestSha256: "live-sandbox-adjustment-test",
  };
}

function publicInvoicePackage(runId, pdf) {
  const result = invoicePackage(runId, "B2G", pdf);
  result.delivery.document_format = "xrechnung_xml";
  result.invoice.customer_type = "public";
  result.invoice.customer_name = "Sandbox Vergabestelle";
  Object.assign(result.invoice.snapshot.draft, {
    customer_name: "Sandbox Vergabestelle",
    customer_street: "Invalidenstraße 44",
    customer_postal_code: "10115",
    customer_city: "Berlin",
    customer_vat_id: "",
    customer_email: "",
    leitweg_id: "10101010-STO-10",
    buyer_reference: "10101010-STO-10",
  });
  return result;
}

function resumeSandboxOriginal(invoicePackageValue, existingDocumentNumber) {
  const value = String(existingDocumentNumber || "");
  const match = value.match(/^SBX-([0-9a-f]{16})-(TEST-LIVE-STORNO-(\d+))$/i);
  assert.ok(match, "Existing sandbox original document number is not a recognized smoke fixture.");
  const key = match[1].toLowerCase();
  const invoiceId = key.slice(0, 8) + "-" + key.slice(8, 12) + "-" + key.slice(12, 16) + "-8000-000000000000";
  invoicePackageValue.invoice.id = invoiceId;
  invoicePackageValue.invoice.invoice_number = match[2];
  invoicePackageValue.delivery.invoice_id = invoiceId;
  assert.strictEqual(openapi.documentNumber(invoicePackageValue.invoice, true), value);
  return match[3];
}

function assertFinancialAdjustmentPayloads(cancellationPayload, creditPayload, cancellationInvoice, creditInvoice) {
  assert.strictEqual(cancellationPayload.total_amount_including_tax, -1.19);
  assert.strictEqual(creditPayload.total_amount_including_tax, -0.6);
  assert.deepStrictEqual(cancellationPayload.billing_reference, {
    document_number: openapi.documentNumber(cancellationInvoice.invoice, true),
    issue_date: cancellationInvoice.invoice.issue_date,
  });
  assert.deepStrictEqual(creditPayload.billing_reference, {
    document_number: openapi.documentNumber(creditInvoice.invoice, true),
    issue_date: creditInvoice.invoice.issue_date,
  });
  assert.match(cancellationPayload.invoice_lines[0].description, /^Storno zu Rechnung /);
  assert.match(creditPayload.invoice_lines[0].description, /^Gutschrift zu Rechnung /);
  [cancellationPayload, creditPayload].forEach((item) => {
    assert.ok(item.total_amount_excluding_tax < 0);
    assert.ok(item.total_tax_amount < 0);
    assert.ok(item.invoice_lines.every((line) => line.quantity > 0 && line.unit_price < 0 && line.total_net_amount < 0));
    assert.ok(item.tax_subtotals.every((subtotal) => subtotal.taxable_amount < 0 && subtotal.tax_amount <= 0));
    assert.ok(item.payment_means.every((payment) => payment.amount < 0));
  });
}

function controlledSandboxEvidenceReport(payloads, packages, results, finalStates, indexes) {
  const cases = indexes.map((index) => {
    const payload = payloads[index] || {};
    const deliveryPackage = packages[index] || {};
    const result = results[index] || {};
    const finalState = finalStates[index] || {};
    assert.ok(deliveryPackage.adjustment, "Controlled evidence requires a financial adjustment package.");
    assert.ok(finalState.eventAt, "Controlled evidence requires the provider event timestamp.");
    return {
      kind: deliveryPackage.adjustment.adjustment_type,
      type: payload.type,
      providerReference: result.providerReference,
      documentNumber: payload.document_number,
      originalDocumentNumber: payload.billing_reference && payload.billing_reference.document_number,
      billingReferenceDocumentNumber: payload.billing_reference && payload.billing_reference.document_number,
      state: finalState.state,
      externalStatus: finalState.externalStatus,
      providerEventAt: finalState.eventAt,
    };
  });
  const observedDays = new Set(cases.map((entry) => entry.providerEventAt.slice(0, 10)));
  assert.strictEqual(observedDays.size, 1, "Controlled evidence provider events must share one UTC day.");
  return { version: 1, observedOn: cases[0].providerEventAt.slice(0, 10), cases };
}

async function runSandboxSmoke(options) {
  const settings = options || {};
  const env = settings.env || process.env;
  const state = openapi.readiness(env);
  const reconciliationOnly = String(env.OPENAPI_INVOICE_SANDBOX_RECONCILIATION_ONLY_CONFIRMED || "").toLowerCase() === "true";
  assert.strictEqual(
    String(env.OPENAPI_INVOICE_SANDBOX_SMOKE_CONFIRMED || "").toLowerCase(),
    "true",
    "Set OPENAPI_INVOICE_SANDBOX_SMOKE_CONFIRMED=true for this one sandbox run."
  );
  assert.strictEqual(state.sandboxEnabled, true, "Openapi sandbox must be enabled.");
  assert.strictEqual(state.liveEnabled, false, "Live Openapi must stay disabled.");
  assert.strictEqual(state.baseUrl, openapi.SANDBOX_BASE, "Only the Openapi sandbox host is allowed.");
  assert.strictEqual(state.webhookConfigured, true, "A separate sandbox webhook must be configured.");
  assert.strictEqual(
    String(env.OPENAPI_INVOICE_SANDBOX_381_PROBE_CONFIRMED || "").toLowerCase(),
    "true",
    "Set OPENAPI_INVOICE_SANDBOX_381_PROBE_CONFIRMED=true for this one type 381 capability probe."
  );
  assert.strictEqual(state.financialAdjustmentsEnabled, false, "Normal POS type 381 delivery must remain provider-blocked during the probe.");
  assert.match(String(env.OPENAPI_INVOICE_SANDBOX_FISCAL_ID || ""), /^DE\d{9}$/);
  let sandboxWebhookPreflightConfirmed = false;
  if (reconciliationOnly) {
    assert.strictEqual(
      String(env.OPENAPI_INVOICE_SANDBOX_CALLBACK_ROUTE_PREFLIGHT_CONFIRMED || "").toLowerCase(),
      "true",
      "Confirm the protected callback route preflight before a reconciliation-only probe."
    );
    assert.strictEqual(state.reconciliationEnabled, true, "Reconciliation must be explicitly enabled for this probe.");
    sandboxWebhookPreflightConfirmed = true;
  } else {
    await verifySandboxWebhook({ url: state.webhookUrl });
    sandboxWebhookPreflightConfirmed = true;
  }

  let runId = Date.now();
  const pdf = await pdfFixture();
  let cancellationInvoice = invoicePackage(runId, "STORNO", pdf);
  const resumedOriginal = Boolean(settings.resumeOriginalDocumentNumber);
  if (resumedOriginal) {
    runId = resumeSandboxOriginal(cancellationInvoice, settings.resumeOriginalDocumentNumber);
  }
  const creditInvoice = invoicePackage(runId, "GUTSCHRIFT", pdf);
  const publicInvoice = publicInvoicePackage(runId, pdf);
  const cancellation = adjustmentPackage(cancellationInvoice, "cancellation", runId, pdf);
  const creditNote = adjustmentPackage(creditInvoice, "credit_note", runId, pdf);
  const fiscalId = String(env.OPENAPI_INVOICE_SANDBOX_FISCAL_ID || "");
  const currentConfiguration = await openapi.fetchConfiguration(fiscalId, { env });
  const currentAddress = currentConfiguration && currentConfiguration.address || {};
  const configuredSeller = {
    legalName: String(currentConfiguration && currentConfiguration.name || ""),
    businessEmail: String(currentConfiguration && currentConfiguration.email || ""),
    street: String(currentAddress.street_address || "") + " " + String(currentAddress.street_number || ""),
    postalCode: String(currentAddress.zip_code || ""),
    city: String(currentAddress.city || ""),
  };
  assert.match(configuredSeller.businessEmail, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.ok(configuredSeller.legalName && configuredSeller.street.trim() && configuredSeller.postalCode && configuredSeller.city);
  [cancellationInvoice, creditInvoice, publicInvoice].forEach((item) => {
    Object.assign(item.invoice.snapshot.seller, configuredSeller);
  });
  const payload = openapi.invoicePayload(cancellationInvoice, { sandbox: true, env });
  if (!reconciliationOnly && settings.skipWebhookSync !== true) {
    await openapi.syncConfigurationWebhook(payload.sender.vat_number, { env });
  }
  await openapi.ensureConfiguration(payload, { env, requireExistingConfigurationMatch: true });
  const provider = openapi.provider({
    env,
    allowSandboxFinancialAdjustmentProbe: true,
    sandboxWebhookPreflightConfirmed,
    requireExistingConfigurationMatch: true,
  });
  const onlyB2g = settings.onlyB2g === true;
  const packages = onlyB2g
    ? [publicInvoice]
    : reconciliationOnly
    ? [cancellationInvoice, cancellation, creditInvoice, creditNote]
    : resumedOriginal
      ? [cancellation, creditInvoice, creditNote, publicInvoice]
      : [cancellationInvoice, cancellation, creditInvoice, creditNote, publicInvoice];
  const payloads = packages.map((item) => openapi.invoicePayload(item, { sandbox: true, env }));
  const expectedTypes = onlyB2g
    ? ["380"]
    : reconciliationOnly
    ? ["380", "381", "380", "381"]
    : resumedOriginal
      ? ["381", "380", "381", "380"]
      : ["380", "381", "380", "381", "380"];
  assert.deepStrictEqual(payloads.map((item) => item.type), expectedTypes);
  const cancellationIndex = onlyB2g ? -1 : resumedOriginal ? 0 : 1;
  const creditNoteIndex = onlyB2g ? -1 : resumedOriginal ? 2 : 3;
  if (!onlyB2g) {
    assertFinancialAdjustmentPayloads(payloads[cancellationIndex], payloads[creditNoteIndex], cancellationInvoice, creditInvoice);
  }
  if (!reconciliationOnly || onlyB2g) {
    const publicPayload = payloads[payloads.length - 1];
    assert.strictEqual(publicPayload.leitweg_id, "10101010-STO-10");
    assert.strictEqual(publicPayload.buyer_reference, "10101010-STO-10");
    assert.strictEqual(publicPayload.recipient.leitweg_id, "10101010-STO-10");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(publicPayload, "attachments"), false);
  }

  const results = [];
  for (const item of packages) {
    const result = await provider.deliver(item);
    assert.strictEqual(result.provider, "openapi");
    assert.strictEqual(result.testMode, true);
    assert.strictEqual(result.sent, false);
    assert.ok(result.providerReference);
    results.push(result);
  }
  const finalStates = {};
  const reconciliationIndexes = onlyB2g ? [] : [cancellationIndex, creditNoteIndex];
  await Promise.all(reconciliationIndexes.map(async (index) => {
    finalStates[index] = await finalReconciliationState(results[index].providerReference, { env });
  }));
  const report = {
    ok: true,
    sandbox: true,
    webhookConfigured: state.webhookConfigured,
    documents: payloads.map((item, index) => ({
      type: item.type,
      documentNumber: item.document_number,
      providerReference: results[index].providerReference,
      remoteState: finalStates[index] ? finalStates[index].state : results[index].remoteState,
      externalStatus: finalStates[index] ? finalStates[index].externalStatus : null,
    })),
  };
  if (!onlyB2g) {
    report.controlledSandboxEvidence = controlledSandboxEvidenceReport(
      payloads,
      packages,
      results,
      finalStates,
      [cancellationIndex, creditNoteIndex]
    );
  }
  if (settings.log !== false) console.log(JSON.stringify(report));
  return report;
}

async function main() {
  return runSandboxSmoke({ env: process.env, log: true });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      code: String(error && error.code || "OPENAPI_SANDBOX_TEST_FAILED"),
      message: String(error && error.message || "Openapi sandbox test failed."),
    }));
    process.exitCode = 1;
  });
}

module.exports = { adjustmentPackage, assertFinancialAdjustmentPayloads, controlledSandboxEvidenceReport, finalReconciliationState, invoicePackage, publicInvoicePackage, resumeSandboxOriginal, runSandboxSmoke };
