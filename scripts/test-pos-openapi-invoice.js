"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const openapi = require(path.join(root, "api", "_lib", "pos-openapi-invoice.js"));
const providers = require(path.join(root, "api", "_lib", "pos-delivery-providers.js"));
const supabaseServer = require(path.join(root, "api", "_lib", "supabase-server.js"));
const handlerModule = require(path.join(root, "api", "_handlers", "pos-openapi-invoice.js"));
const handler = fs.readFileSync(path.join(root, "api", "_handlers", "pos-openapi-invoice.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260824092910_pos_openapi_invoice_provider.sql"), "utf8");
const webhookMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260824095123_pos_openapi_invoice_webhook.sql"), "utf8");
const webhookGuardMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260824122724_pos_openapi_invoice_webhook_mode_guard.sql"), "utf8");
const sandboxRepairMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260824124350_pos_openapi_invoice_sandbox_status_repair.sql"), "utf8");
const submissionClockMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .find((name) => /pos_openapi_webhook_submission_clock\.sql$/.test(name));
assert.ok(submissionClockMigrationName, "Manjka migracija za ločitev lokalne ure oddaje od Openapi dogodkov.");
const submissionClockMigration = fs.readFileSync(path.join(root, "supabase", "migrations", submissionClockMigrationName), "utf8");
const financialAdjustmentMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .find((name) => /pos_openapi_financial_adjustments\.sql$/.test(name));
assert.ok(financialAdjustmentMigrationName, "Manjka migracija Openapi finančnih popravkov.");
const financialAdjustmentMigration = fs.readFileSync(path.join(root, "supabase", "migrations", financialAdjustmentMigrationName), "utf8");
const succeededDeliveryMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .find((name) => /pos_openapi_succeeded_delivery_state\.sql$/.test(name));
assert.ok(succeededDeliveryMigrationName, "Manjka migracija za Openapi SENT/succeeded dostavo.");
const succeededDeliveryMigration = fs.readFileSync(path.join(root, "supabase", "migrations", succeededDeliveryMigrationName), "utf8");
const terminal = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");
const i18n = fs.readFileSync(path.join(root, "app", "pos-terminal-i18n.js"), "utf8");
const runbook = fs.readFileSync(path.join(root, "docs", "POS-OPENAPI-INVOICE-DE.md"), "utf8");
const sandboxSmoke = fs.readFileSync(path.join(root, "scripts", "smoke-pos-openapi-sandbox-live.js"), "utf8");
const deliveryRunner = fs.readFileSync(path.join(root, "api", "_lib", "pos-delivery-runner.js"), "utf8");
const deliveryRunnerModule = require(path.join(root, "api", "_lib", "pos-delivery-runner.js"));

function response(status, data) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function mockRes() {
  return {
    statusCode: 0, headers: {}, body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    end(value) { this.body = value ? JSON.parse(value) : null; return this; },
  };
}

const providerClockNow = Date.parse("2026-08-24T12:00:00.000Z");
assert.strictEqual(handlerModule._test.providerEventTime("2026-08-24T12:09:59Z", providerClockNow), "2026-08-24T12:09:59.000Z");
assert.strictEqual(handlerModule._test.providerEventTime("2026-08-24T12:10:01Z", providerClockNow), "");
assert.strictEqual(handlerModule._test.providerEventTime("2099-01-01T00:00:00Z", providerClockNow), "");
assert.deepStrictEqual(openapi.reconciliationEvent({
  id: "invoice-id", state: "SENT", updated_at: "2026-08-24T12:09:59Z",
}, providerClockNow), {
  providerReference: "invoice-id",
  state: "SENT",
  externalStatus: "sent",
  eventAt: "2026-08-24T12:09:59.000Z",
});
assert.throws(() => openapi.reconciliationEvent({
  id: "invoice-id", state: "SENT", updated_at: "2026-08-24T12:10:01Z",
}, providerClockNow), (error) => error && error.code === "OPENAPI_RECONCILIATION_STATE_INVALID");
assert.throws(() => openapi.reconciliationEvent({
  id: "invoice-id", state: "DONE", updated_at: "2099-01-01T00:00:00Z",
}, providerClockNow), (error) => error && error.code === "OPENAPI_RECONCILIATION_STATE_INVALID");
assert.strictEqual(handlerModule._test.usageRequest({ url: "/api/pos?usage=1" }), true);
assert.strictEqual(handlerModule._test.usageRequest({ url: "/api/pos" }), false);

function packageFixture() {
  const pdf = Buffer.from("%PDF-1.7 test");
  return {
    delivery: { id: "11111111-1111-4111-8111-111111111111", invoice_id: "22222222-2222-4222-8222-222222222222", user_id: "33333333-3333-4333-8333-333333333333", provider: "openapi", is_test: true, channel: "email", document_format: "xrechnung_pdf" },
    invoice: {
      id: "22222222-2222-4222-8222-222222222222", invoice_number: "TEST-2026-0001", customer_type: "business", customer_name: "Kunde GmbH",
      issue_date: "2026-08-24", due_date: "2026-09-07", tax_mode: "regular", net_cents: 10000, tax_cents: 1900, gross_cents: 11900, is_test: true,
      snapshot: {
        seller: { legalName: "Mustermann GmbH", vatId: "DE123456789", businessEmail: "rechnung@mustermann.de", street: "Hauptstraße 42", postalCode: "10115", city: "Berlin", iban: "DE89370400440532013000" },
        draft: { customer_name: "Kunde GmbH", customer_street: "Marktstraße 1", customer_postal_code: "80331", customer_city: "München", customer_vat_id: "DE987654321", customer_email: "rechnung@kunde.de", payment_method: "sepa", items: [
          { description: "Beratung", quantity_milli: 2000, unit: "Std.", net_cents: 10000, tax_cents: 1900, gross_cents: 11900, tax_rate_bps: 1900 }
        ] }
      }
    },
    adjustment: null,
    attachments: [{ kind: "invoice_pdf", filename: "TEST-2026-0001.pdf", mediaType: "application/pdf", content: pdf, byteSize: pdf.length }],
    manifestSha256: "a".repeat(64),
  };
}

function adjustmentPackage(type) {
  const fixture = packageFixture();
  const creditNote = type === "credit_note";
  const number = creditNote ? "GS-2026-0002" : type === "cancellation" ? "ST-2026-0002" : "KORR-2026-0002";
  const net = creditNote ? 5000 : type === "cancellation" ? 10000 : 0;
  const tax = creditNote ? 950 : type === "cancellation" ? 1900 : 0;
  const gross = net + tax;
  fixture.delivery.adjustment_id = "44444444-4444-4444-8444-444444444444";
  fixture.adjustment = {
    id: fixture.delivery.adjustment_id,
    adjustment_number: number,
    adjustment_type: type,
    reason: creditNote ? "Kulanznachlass" : type === "cancellation" ? "Auftrag aufgehoben" : "Anschrift berichtigt",
    issued_at: "2026-08-24T10:30:00+02:00",
    is_test: true,
    delta_net_cents: -net,
    delta_tax_cents: -tax,
    delta_gross_cents: -gross,
    snapshot: {
      seller: fixture.invoice.snapshot.seller,
      original_invoice: {
        id: fixture.invoice.id,
        invoice_number: fixture.invoice.invoice_number,
        issue_date: fixture.invoice.issue_date,
        tax_mode: fixture.invoice.tax_mode,
        net_cents: fixture.invoice.net_cents,
        tax_cents: fixture.invoice.tax_cents,
        gross_cents: fixture.invoice.gross_cents,
      },
      original_draft: fixture.invoice.snapshot.draft,
      effective_draft: fixture.invoice.snapshot.draft,
      credit_lines: creditNote ? [{ description: "Kulanznachlass", tax_rate_bps: 1900, net_cents: 5000, tax_cents: 950, gross_cents: 5950 }] : undefined,
    },
  };
  fixture.attachments = [{ kind: "adjustment_pdf", filename: number + ".pdf", mediaType: "application/pdf", content: Buffer.from("%PDF-1.7 adjustment"), byteSize: 19 }];
  return fixture;
}

assert.deepStrictEqual(openapi.readiness({}), { provider: "openapi", configured: false, sendEnabled: false, sandboxEnabled: false, liveEnabled: false, webhookConfigured: false, webhookPublicPreflightConfirmed: false, configurationCreateEnabled: true, configurationUpdateEnabled: true, reconciliationEnabled: false, multiCompanyReady: true, financialAdjustmentsEnabled: false, financialAdjustmentBlocker: "sandbox_probe_only", productionTokenFresh: false, tokenExpiresAt: "", webhookUrl: "", requestedMode: "sandbox", mode: "sandbox", baseUrl: openapi.SANDBOX_BASE, blockers: ["token_missing"] });
assert.strictEqual(openapi.readiness({ OPENAPI_INVOICE_TOKEN: "test", OPENAPI_INVOICE_MODE: "sandbox" }).sandboxEnabled, true);
const sandboxWebhookReadiness = openapi.readiness({
  OPENAPI_INVOICE_TOKEN: "test", OPENAPI_INVOICE_MODE: "sandbox",
  OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET: "s".repeat(32),
  OPENAPI_INVOICE_SANDBOX_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1&sandbox=1"
});
assert.strictEqual(sandboxWebhookReadiness.webhookConfigured, true);
assert.match(sandboxWebhookReadiness.webhookUrl, /sandbox=1/);
assert.strictEqual(openapi.readiness({
  OPENAPI_INVOICE_TOKEN: "test", OPENAPI_INVOICE_MODE: "sandbox",
  OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET: "s".repeat(32),
  OPENAPI_INVOICE_SANDBOX_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1&sandbox=1&x-vercel-protection-bypass=temporary",
}).webhookConfigured, false, "Sandbox callback ne sme ohraniti začasnega Preview bypass parametra.");
assert.strictEqual(openapi.readiness({
  OPENAPI_INVOICE_TOKEN: "live", OPENAPI_INVOICE_MODE: "production",
  OPENAPI_INVOICE_WEBHOOK_SECRET: "p".repeat(32),
  OPENAPI_INVOICE_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1&webhook=1",
}).webhookConfigured, false, "Podvojeni callback parametri morajo biti zavrnjeni.");
const sandboxProbeEnv = {
  OPENAPI_INVOICE_TOKEN: "test",
  OPENAPI_INVOICE_MODE: "sandbox",
  OPENAPI_INVOICE_SANDBOX_SMOKE_CONFIRMED: "true",
  OPENAPI_INVOICE_SANDBOX_381_PROBE_CONFIRMED: "true",
  OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET: "s".repeat(32),
  OPENAPI_INVOICE_SANDBOX_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1&sandbox=1",
};
const sandboxProbeState = openapi.readiness(sandboxProbeEnv);
assert.strictEqual(openapi.sandboxFinancialAdjustmentProbeAllowed(sandboxProbeState, {
  env: sandboxProbeEnv,
  allowSandboxFinancialAdjustmentProbe: true,
  sandboxWebhookPreflightConfirmed: true,
}), true);
assert.strictEqual(openapi.sandboxFinancialAdjustmentProbeAllowed(sandboxProbeState, {
  env: sandboxProbeEnv,
  allowSandboxFinancialAdjustmentProbe: true,
}), false);
assert.strictEqual(openapi.sandboxFinancialAdjustmentProbeAllowed(openapi.readiness(Object.assign({}, sandboxProbeEnv, {
  OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET: "",
})), {
  env: Object.assign({}, sandboxProbeEnv, { OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET: "" }),
  allowSandboxFinancialAdjustmentProbe: true,
  sandboxWebhookPreflightConfirmed: true,
}), false);
const crossedSandboxReadiness = openapi.readiness({
  OPENAPI_INVOICE_TOKEN: "test", OPENAPI_INVOICE_MODE: "sandbox",
  OPENAPI_INVOICE_WEBHOOK_SECRET: "p".repeat(32),
  OPENAPI_INVOICE_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
});
assert.strictEqual(crossedSandboxReadiness.webhookConfigured, false);
assert.strictEqual(crossedSandboxReadiness.webhookUrl, "");
assert.strictEqual(openapi.readiness({ OPENAPI_INVOICE_TOKEN: "live", OPENAPI_INVOICE_MODE: "production" }).liveEnabled, false);
assert.strictEqual(openapi.readiness({ OPENAPI_INVOICE_TOKEN: "live", OPENAPI_INVOICE_MODE: "production", POS_OPENAPI_INVOICE_ENABLED: "true" }).liveEnabled, false);
assert.deepStrictEqual(openapi.readiness({ OPENAPI_INVOICE_TOKEN: "live", OPENAPI_INVOICE_MODE: "production" }).blockers, ["production_lock_closed", "production_send_lock_closed", "production_token_expiry_missing", "production_webhook_missing", "production_webhook_public_preflight_missing"]);
assert.ok(openapi.readiness({
  OPENAPI_INVOICE_TOKEN: "live", OPENAPI_INVOICE_MODE: "production", POS_OPENAPI_INVOICE_ENABLED: "true",
  OPENAPI_INVOICE_TOKEN_EXPIRES_AT: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  OPENAPI_INVOICE_WEBHOOK_SECRET: "x".repeat(32),
  OPENAPI_INVOICE_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1"
}).blockers.includes("production_token_expiring"));
assert.strictEqual(openapi.readiness({
  OPENAPI_INVOICE_TOKEN: "live", OPENAPI_INVOICE_MODE: "production", POS_OPENAPI_INVOICE_ENABLED: "true",
  OPENAPI_INVOICE_TOKEN_EXPIRES_AT: "2099-12-31T23:59:59Z",
  OPENAPI_INVOICE_WEBHOOK_SECRET: "x".repeat(32),
  OPENAPI_INVOICE_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED: "true",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT: new Date().toISOString(),
}).liveEnabled, false, "produkcijski Openapi mora ostati zaprt brez ločenega send stikala");
assert.strictEqual(openapi.readiness({
  OPENAPI_INVOICE_TOKEN: "live", OPENAPI_INVOICE_MODE: "production", POS_OPENAPI_INVOICE_ENABLED: "true",
  OPENAPI_INVOICE_SEND_ENABLED: "true",
  OPENAPI_INVOICE_TOKEN_EXPIRES_AT: "2099-12-31T23:59:59Z",
  OPENAPI_INVOICE_WEBHOOK_SECRET: "x".repeat(32),
  OPENAPI_INVOICE_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED: "true",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT: new Date().toISOString(),
}).liveEnabled, true);
assert.strictEqual(openapi.readiness({
  OPENAPI_INVOICE_TOKEN: "live", OPENAPI_INVOICE_MODE: "production", POS_OPENAPI_INVOICE_ENABLED: "true",
  OPENAPI_INVOICE_SEND_ENABLED: "true", OPENAPI_INVOICE_TOKEN_EXPIRES_AT: "2099-12-31T23:59:59Z",
  OPENAPI_INVOICE_WEBHOOK_SECRET: "x".repeat(32),
  OPENAPI_INVOICE_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED: "true",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL: "https://old.example.test/api/pos?handler=openapi-invoice&webhook=1",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT: new Date().toISOString(),
}).liveEnabled, false, "Preflight drugega callback URL-ja ne sme odpreti produkcije.");
assert.strictEqual(openapi.readiness({
  OPENAPI_INVOICE_TOKEN: "live", OPENAPI_INVOICE_MODE: "production", POS_OPENAPI_INVOICE_ENABLED: "true",
  OPENAPI_INVOICE_SEND_ENABLED: "true", OPENAPI_INVOICE_TOKEN_EXPIRES_AT: "2099-12-31T23:59:59Z",
  OPENAPI_INVOICE_WEBHOOK_SECRET: "x".repeat(32),
  OPENAPI_INVOICE_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED: "true",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
}).liveEnabled, false, "Preflight, starejši od 24 ur, ne sme odpreti produkcije.");
assert.strictEqual(openapi.readiness({
  OPENAPI_INVOICE_TOKEN: "live", OPENAPI_INVOICE_MODE: "production", POS_OPENAPI_INVOICE_ENABLED: "true",
  OPENAPI_INVOICE_SEND_ENABLED: "true",
  OPENAPI_INVOICE_TOKEN_EXPIRES_AT: "2099-12-31T23:59:59Z",
  OPENAPI_INVOICE_WEBHOOK_SECRET: "x".repeat(32),
  OPENAPI_INVOICE_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1&temporary=1",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED: "true",
}).liveEnabled, false, "Produkcijski callback z dodatnim parametrom mora ostati zaprt.");
assert.strictEqual(openapi.readiness({ OPENAPI_INVOICE_MODE: "production" }).configurationCreateEnabled, false);
assert.strictEqual(openapi.readiness({ OPENAPI_INVOICE_MODE: "production", OPENAPI_INVOICE_ALLOW_CONFIGURATION_CREATE: "true" }).configurationCreateEnabled, true);
assert.strictEqual(openapi.readiness({ OPENAPI_INVOICE_RECONCILIATION_ENABLED: "true" }).reconciliationEnabled, true);

const mapped = openapi.invoicePayload(packageFixture());
const configuredCompany = Object.assign({ id: "company-id" }, openapi.configurationPayload(mapped, { env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" } }));
assert.strictEqual(mapped.type, "380");
assert.strictEqual(Object.prototype.hasOwnProperty.call(mapped, "billing_reference"), false);
assert.strictEqual(mapped.sender.vat_number, "DE123456789");
assert.deepStrictEqual(mapped.sender.address, { street_address: "Hauptstraße", street_number: "42", zip_code: "10115", city: "Berlin", country: "DE" });
assert.strictEqual(mapped.recipient.vat_number, "DE987654321");
assert.deepStrictEqual(mapped.recipient.address, { street_address: "Marktstraße", street_number: "1", zip_code: "80331", city: "München", country: "DE" });
assert.strictEqual(mapped.invoice_lines[0].quantity, 2);
assert.strictEqual(mapped.invoice_lines[0].unit_price, 50);
assert.strictEqual(mapped.invoice_lines[0].unit_of_measure, "HUR");
assert.strictEqual(mapped.total_amount_including_tax, 119);
assert.strictEqual(mapped.tax_subtotals[0].vat_rate, 19);
assert.strictEqual(Object.prototype.hasOwnProperty.call(mapped.tax_subtotals[0], "tax_rate"), false);
assert.strictEqual(mapped.attachments[0].document, packageFixture().attachments[0].content.toString("base64"));
const publicPackage = packageFixture();
publicPackage.invoice.customer_type = "public";
publicPackage.invoice.snapshot.draft.customer_name = "Bundesbehörde Test";
publicPackage.invoice.snapshot.draft.customer_email = "";
publicPackage.invoice.snapshot.draft.customer_vat_id = "";
publicPackage.invoice.snapshot.draft.leitweg_id = "991-TEST-00";
publicPackage.invoice.snapshot.draft.buyer_reference = "991-TEST-00";
const publicMapped = openapi.invoicePayload(publicPackage);
assert.strictEqual(publicMapped.type, "380");
assert.strictEqual(publicMapped.leitweg_id, "991-TEST-00");
assert.strictEqual(publicMapped.buyer_reference, "991-TEST-00");
assert.strictEqual(publicMapped.recipient.leitweg_id, "991-TEST-00");
assert.strictEqual(Object.prototype.hasOwnProperty.call(publicMapped, "attachments"), false);
const publicWithoutLeitweg = packageFixture();
publicWithoutLeitweg.invoice.customer_type = "public";
assert.throws(() => openapi.invoicePayload(publicWithoutLeitweg), (error) => error && error.code === "OPENAPI_LEITWEG_REQUIRED");
const sandboxMapped = openapi.invoicePayload(packageFixture(), { sandbox: true, env: { OPENAPI_INVOICE_SANDBOX_FISCAL_ID: "DE116977919" } });
assert.strictEqual(sandboxMapped.sender.vat_number, "DE116977919");
assert.strictEqual(sandboxMapped.document_number, "SBX-2222222222224222-TEST-2026-0001");
const productionMapped = openapi.invoicePayload(packageFixture(), { sandbox: false, env: { OPENAPI_INVOICE_SANDBOX_FISCAL_ID: "DE116977919" } });
assert.strictEqual(productionMapped.sender.vat_number, "DE123456789");
assert.strictEqual(productionMapped.document_number, "TEST-2026-0001");
assert.throws(() => openapi.invoicePayload(Object.assign(packageFixture(), { invoice: Object.assign({}, packageFixture().invoice, { snapshot: { seller: { vatId: "123" }, draft: { items: [] } } }) })), /USt-IdNr/);
assert.deepStrictEqual(openapi.address("Unter den Linden 12 A", "10117", "Berlin"), { street_address: "Unter den Linden", street_number: "12A", zip_code: "10117", city: "Berlin", country: "DE" });
const noSellerNumber = packageFixture();
noSellerNumber.invoice.snapshot.seller.street = "Hauptstraße";
assert.throws(() => openapi.invoicePayload(noSellerNumber), /hišna številka izdajatelja/);
const mismatchedTotals = packageFixture();
mismatchedTotals.invoice.net_cents += 1;
mismatchedTotals.invoice.gross_cents += 1;
assert.throws(() => openapi.invoicePayload(mismatchedTotals), /Vsota postavk/);
const invalidLineTax = packageFixture();
invalidLineTax.invoice.snapshot.draft.items[0].tax_cents = 1899;
invalidLineTax.invoice.snapshot.draft.items[0].gross_cents = 11899;
invalidLineTax.invoice.tax_cents = 1899;
invalidLineTax.invoice.gross_cents = 11899;
assert.throws(() => openapi.invoicePayload(invalidLineTax), /DDV postavke/);
const cardPayment = packageFixture();
cardPayment.invoice.snapshot.draft.payment_method = "card_external";
const cardPayload = openapi.invoicePayload(cardPayment);
assert.strictEqual(cardPayload.payment_means[0].payment_mode, "card");
assert.strictEqual(Object.prototype.hasOwnProperty.call(cardPayload.payment_means[0], "financial_account"), false);
const adjustmentSandboxOptions = { sandbox: true, env: { OPENAPI_INVOICE_SANDBOX_FISCAL_ID: "DE116977919" } };
const cancellationPayload = openapi.invoicePayload(adjustmentPackage("cancellation"), adjustmentSandboxOptions);
assert.strictEqual(cancellationPayload.type, "381");
assert.strictEqual(cancellationPayload.document_number, "SBX-4444444444444444-ST-2026-0002");
assert.strictEqual(cancellationPayload.total_amount_excluding_tax, -100);
assert.strictEqual(cancellationPayload.total_tax_amount, -19);
assert.strictEqual(cancellationPayload.total_amount_including_tax, -119);
assert.deepStrictEqual(cancellationPayload.billing_reference, { document_number: "SBX-2222222222224222-TEST-2026-0001", issue_date: "2026-08-24" });
assert.match(cancellationPayload.invoice_lines[0].description, /^Storno zu Rechnung TEST-2026-0001:/);
assert.strictEqual(cancellationPayload.invoice_lines[0].quantity, 2);
assert.strictEqual(cancellationPayload.invoice_lines[0].unit_price, -50);
assert.strictEqual(cancellationPayload.invoice_lines[0].total_net_amount, -100);
assert.strictEqual(cancellationPayload.tax_subtotals[0].taxable_amount, -100);
assert.strictEqual(cancellationPayload.tax_subtotals[0].tax_amount, -19);
assert.strictEqual(Object.prototype.hasOwnProperty.call(cancellationPayload, "due_date"), false);
assert.strictEqual(cancellationPayload.payment_means[0].amount, -119);
assert.strictEqual(cancellationPayload.payment_means[0].payment_mode, "sepa_credit_transfer");
const creditNotePayload = openapi.invoicePayload(adjustmentPackage("credit_note"), adjustmentSandboxOptions);
assert.strictEqual(creditNotePayload.type, "381");
assert.strictEqual(creditNotePayload.total_amount_excluding_tax, -50);
assert.strictEqual(creditNotePayload.total_tax_amount, -9.5);
assert.strictEqual(creditNotePayload.total_amount_including_tax, -59.5);
assert.deepStrictEqual(creditNotePayload.billing_reference, { document_number: "SBX-2222222222224222-TEST-2026-0001", issue_date: "2026-08-24" });
assert.strictEqual(creditNotePayload.invoice_lines[0].quantity, 1);
assert.strictEqual(creditNotePayload.invoice_lines[0].unit_price, -50);
assert.strictEqual(creditNotePayload.invoice_lines[0].total_net_amount, -50);
assert.strictEqual(creditNotePayload.tax_subtotals[0].taxable_amount, -50);
assert.strictEqual(creditNotePayload.tax_subtotals[0].tax_amount, -9.5);
assert.strictEqual(creditNotePayload.payment_means[0].amount, -59.5);
assert.strictEqual(creditNotePayload.invoice_lines[0].unit_of_measure, "C62");
assert.match(creditNotePayload.invoice_lines[0].description, /^Gutschrift zu Rechnung TEST-2026-0001:/);
const missingOriginalNumber = adjustmentPackage("cancellation");
delete missingOriginalNumber.adjustment.snapshot.original_invoice.invoice_number;
assert.throws(
  () => openapi.invoicePayload(missingOriginalNumber, adjustmentSandboxOptions),
  (error) => error && error.code === "OPENAPI_ADJUSTMENT_BILLING_REFERENCE_INVALID"
);
const missingOriginalIssueDate = adjustmentPackage("credit_note");
delete missingOriginalIssueDate.adjustment.snapshot.original_invoice.issue_date;
assert.throws(
  () => openapi.invoicePayload(missingOriginalIssueDate, adjustmentSandboxOptions),
  (error) => error && error.code === "OPENAPI_ADJUSTMENT_BILLING_REFERENCE_INVALID"
);
const missingSandboxOriginalId = adjustmentPackage("cancellation");
delete missingSandboxOriginalId.adjustment.snapshot.original_invoice.id;
assert.throws(
  () => openapi.invoicePayload(missingSandboxOriginalId, adjustmentSandboxOptions),
  (error) => error && error.code === "OPENAPI_SANDBOX_DOCUMENT_KEY_REQUIRED"
);
const positiveDeltaAdjustment = adjustmentPackage("cancellation");
positiveDeltaAdjustment.adjustment.delta_net_cents = 10000;
positiveDeltaAdjustment.adjustment.delta_tax_cents = 1900;
positiveDeltaAdjustment.adjustment.delta_gross_cents = 11900;
assert.throws(
  () => openapi.invoicePayload(positiveDeltaAdjustment, adjustmentSandboxOptions),
  (error) => error && error.code === "OPENAPI_ADJUSTMENT_DELTA_SIGN_INVALID"
);
const productionAdjustmentReference = openapi.invoicePayload(adjustmentPackage("cancellation"), { sandbox: false, env: {} });
assert.deepStrictEqual(productionAdjustmentReference.billing_reference, { document_number: "TEST-2026-0001", issue_date: "2026-08-24" });
assert.strictEqual(productionAdjustmentReference.total_amount_including_tax, -119);
const zeroVatAdjustment = adjustmentPackage("cancellation");
zeroVatAdjustment.invoice.tax_mode = "reverse_charge";
zeroVatAdjustment.invoice.tax_cents = 0;
zeroVatAdjustment.invoice.gross_cents = 10000;
zeroVatAdjustment.invoice.snapshot.draft.items[0].tax_rate_bps = 0;
zeroVatAdjustment.invoice.snapshot.draft.items[0].tax_cents = 0;
zeroVatAdjustment.invoice.snapshot.draft.items[0].gross_cents = 10000;
zeroVatAdjustment.adjustment.delta_tax_cents = 0;
zeroVatAdjustment.adjustment.delta_gross_cents = -10000;
zeroVatAdjustment.adjustment.snapshot.original_invoice.tax_mode = "reverse_charge";
zeroVatAdjustment.adjustment.snapshot.original_invoice.tax_cents = 0;
zeroVatAdjustment.adjustment.snapshot.original_invoice.gross_cents = 10000;
zeroVatAdjustment.adjustment.snapshot.original_draft = zeroVatAdjustment.invoice.snapshot.draft;
zeroVatAdjustment.adjustment.snapshot.effective_draft = zeroVatAdjustment.invoice.snapshot.draft;
const zeroVatAdjustmentPayload = openapi.invoicePayload(zeroVatAdjustment, adjustmentSandboxOptions);
assert.strictEqual(zeroVatAdjustmentPayload.total_amount_excluding_tax, -100);
assert.strictEqual(zeroVatAdjustmentPayload.total_tax_amount, 0);
assert.strictEqual(zeroVatAdjustmentPayload.total_amount_including_tax, -100);
assert.strictEqual(zeroVatAdjustmentPayload.tax_subtotals[0].taxable_amount, -100);
assert.strictEqual(zeroVatAdjustmentPayload.tax_subtotals[0].tax_amount, 0);
const multiRateAdjustment = adjustmentPackage("cancellation");
multiRateAdjustment.invoice.snapshot.draft.items.push({
  description: "Dokumentation",
  quantity_milli: 1000,
  unit: "Stk.",
  net_cents: 5000,
  tax_cents: 350,
  gross_cents: 5350,
  tax_rate_bps: 700,
});
multiRateAdjustment.invoice.net_cents = 15000;
multiRateAdjustment.invoice.tax_cents = 2250;
multiRateAdjustment.invoice.gross_cents = 17250;
multiRateAdjustment.adjustment.delta_net_cents = -15000;
multiRateAdjustment.adjustment.delta_tax_cents = -2250;
multiRateAdjustment.adjustment.delta_gross_cents = -17250;
multiRateAdjustment.adjustment.snapshot.original_invoice.net_cents = 15000;
multiRateAdjustment.adjustment.snapshot.original_invoice.tax_cents = 2250;
multiRateAdjustment.adjustment.snapshot.original_invoice.gross_cents = 17250;
const multiRateAdjustmentPayload = openapi.invoicePayload(multiRateAdjustment, adjustmentSandboxOptions);
assert.strictEqual(multiRateAdjustmentPayload.total_amount_excluding_tax, -150);
assert.strictEqual(multiRateAdjustmentPayload.total_tax_amount, -22.5);
assert.strictEqual(multiRateAdjustmentPayload.total_amount_including_tax, -172.5);
assert.deepStrictEqual(multiRateAdjustmentPayload.invoice_lines.map((line) => line.total_net_amount), [-100, -50]);
assert.deepStrictEqual(multiRateAdjustmentPayload.tax_subtotals.map((subtotal) => subtotal.vat_rate).sort((a, b) => a - b), [7, 19]);
assert.deepStrictEqual(multiRateAdjustmentPayload.tax_subtotals.map((subtotal) => subtotal.taxable_amount).sort((a, b) => a - b), [-100, -50]);
assert.deepStrictEqual(multiRateAdjustmentPayload.tax_subtotals.map((subtotal) => subtotal.tax_amount).sort((a, b) => a - b), [-19, -3.5]);
assert.throws(() => openapi.invoicePayload(adjustmentPackage("correction"), adjustmentSandboxOptions), (error) => error && error.code === "OPENAPI_ADJUSTMENT_TYPE_UNSUPPORTED");
assert.throws(() => openapi.acceptedResult({ id: "invoice-id", state: "RECEIVED" }, false), /neznano stanje/);
assert.deepStrictEqual(openapi.acceptedResult({
  id: "invoice-succeeded", state: "SENT", details: { external_status: "succeeded" },
}, false), {
  provider: "openapi", providerReference: "invoice-succeeded", status: "sent", sent: true,
  delivered: true, remoteState: "SENT", externalStatus: "succeeded", testMode: false,
});
assert.strictEqual(openapi.providerReason({ message: "  Invalid address\nfield  " }, 422), "Invalid address field");
assert.strictEqual(openapi.providerReason({ error: 117 }, 422), "koda 117");
assert.strictEqual(openapi.providerReason(null, 503), "HTTP 503");
assert.deepStrictEqual(openapi.webhookConfiguration({ env: {
  OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox",
  OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET: "s".repeat(32),
  OPENAPI_INVOICE_SANDBOX_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1&sandbox=1",
} })[0].callback.headers, { Authorization: "Bearer " + "s".repeat(32) });
assert.strictEqual(openapi.configurationPatch(configuredCompany, configuredCompany), null);
assert.deepStrictEqual(openapi.configurationPatch(Object.assign({}, configuredCompany, { name: "Alt" }), configuredCompany), { name: configuredCompany.name });
assert.throws(() => openapi.configurationPatch(Object.assign({}, configuredCompany, { email: "other@example.de" }), configuredCompany), (error) => error.code === "OPENAPI_CONFIGURATION_EMAIL_MISMATCH");
assert.deepStrictEqual(openapi.reconciliationEvent({ id: "remote-1", state: "DONE", updated_at: "2026-08-24T10:00:00Z" }), {
  providerReference: "remote-1", state: "DONE", externalStatus: "done", eventAt: "2026-08-24T10:00:00.000Z"
});
assert.throws(() => openapi.reconciliationEvent({ id: "remote-1", state: "UNKNOWN" }), (error) => error.code === "OPENAPI_RECONCILIATION_STATE_INVALID");
assert.deepStrictEqual(openapi.usageSummary([
  { provider: "openapi", is_test: false, status: "sent", provider_reference: "a", reconciliation_attempt_count: 2 },
  { provider: "openapi", is_test: true, status: "test_completed", provider_reference: "b", reconciliation_attempt_count: 5 },
], {}), {
  currency: "EUR", plan: "public_pay_as_you_go", productionSubmissions: 1, preflightGets: 2, reconciliationGets: 2, estimatedEur: 0.094,
  unitPricesEur: { invoicePost: 0.09, invoiceGet: 0.001, configurationPost: 1 }, configurationCreatesTracked: false,
  note: "Ocena vključuje dva običajna GET pred vsakim sprejetim POST; ne vključuje ustvarjanja ali posodabljanja konfiguracij, ki sta v produkciji privzeto zaklenjena."
});

assert.match(handler, /pos_queue_openapi_invoice_delivery/);
assert.match(handler, /pos_apply_openapi_invoice_event/);
assert.match(handler, /timingSafeEqual/);
assert.match(handler, /body\.confirmed !== true/);
assert.match(handler, /user_id=eq\." \+ encodeURIComponent\(auth\.user\.id\)/);
assert.match(handler, /reconciliation_attempt_count/);
assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
assert.match(migration, /v_invoice\.is_test <> coalesce\(p_sandbox, true\)/i);
assert.match(migration, /provider = 'openapi'/i);
assert.match(migration, /unique index pos_invoice_deliveries_one_openapi_per_invoice_uidx/i);
assert.match(migration, /unique index pos_invoice_deliveries_openapi_reference_uidx/i);
assert.match(migration, /revoke all on function public\.pos_queue_openapi_invoice_delivery[\s\S]*authenticated/i);
assert.match(migration, /grant execute on function public\.pos_queue_openapi_invoice_delivery[\s\S]*service_role/i);
assert.match(financialAdjustmentMigration, /unique index if not exists pos_invoice_deliveries_one_openapi_per_adjustment_uidx/i);
assert.match(financialAdjustmentMigration, /new\.adjustment_id is null and new\.status in/i);
assert.match(financialAdjustmentMigration, /adjustment_type not in \('cancellation','credit_note'\)/i);
assert.match(financialAdjustmentMigration, /Openapi podpira samo finančni Storno ali Gutschrift \(tip 381\)/i);
assert.match(financialAdjustmentMigration, /grant execute on function private\._pos_queue_openapi_invoice_delivery[\s\S]*to service_role/i);
assert.match(terminal, /handler=openapi-invoice/);
assert.match(terminal, /openapiDeliveryEnabled/);
assert.match(terminal, /\["cancellation", "credit_note"\]\.indexOf\(adjustment\.type\)/);
assert.match(terminal, /financialOpenapiBlocked = Boolean\(openapiEligibleAdjustment && structuredInvoice && !openapiCapability\.financialAdjustmentsEnabled\)/);
assert.doesNotMatch(terminal, /financialOpenapiBlocked = Boolean\([^\n]+openapiCapability\.sendEnabled/);
assert.match(terminal, /Openapi tip 381 čaka produkcijsko aktivacijo/);
assert.match(i18n, /Openapi-Typ 381 wartet auf die Produktionsaktivierung/);
assert.doesNotMatch(terminal, /Openapi DE trenutno protislovno zavrača tip 381/);
assert.match(i18n, /Openapi-Invoice-Sandbox/);
assert.match(runbook, /POS_OPENAPI_INVOICE_ENABLED=true/);
assert.match(runbook, /OPENAPI_INVOICE_WEBHOOK_SECRET/);
assert.match(runbook, /Storno in delni dobropis sta lokalno preslikana kot Openapi tip `381`/);
assert.match(runbook, /Rechnungsberichtigung.*tip `384`[\s\S]*ni poslana prek Openapi/);
assert.match(runbook, /sprejel dva testna originala tipa `380`/);
assert.match(runbook, /TEST-2026-0010[\s\S]*TEST-2026-0011/);
assert.match(runbook, /Nadzorovani zunanji preizkus je nato odkril ponudniško blokado/);
assert.match(runbook, /Za noben zavrnjeni\s+dokument tipa `381` ni nastal ponudnikov zapis/);
assert.match(runbook, /V tej zgodovinski fazi je POS običajno zunanjo oddajo zavrnil pred omrežnim klicem[\s\S]*ni preklopil na drugega ponudnika/);
assert.match(runbook, /billing_reference[\s\S]*document_number[\s\S]*issue_date/);
assert.match(runbook, /Podpora je sporočila, da je javni OAS usklajen[\s\S]*billing_reference/);
assert.match(runbook, /billing_reference[\s\S]*cannot send this type for a positive amount/);
assert.match(runbook, /delnim dobropisom[\s\S]*ni bil poslan/);
assert.match(runbook, /Drugi odgovor podpore 26\. avgusta 2026[\s\S]*tip `381` pa negativne korenske, vrstične in davčne zneske/);
assert.match(sandboxSmoke, /adjustmentPackage\(cancellationInvoice, "cancellation"/);
assert.match(sandboxSmoke, /adjustmentPackage\(creditInvoice, "credit_note"/);
assert.match(sandboxSmoke, /publicInvoicePackage\(runId, pdf\)/);
assert.match(sandboxSmoke, /OPENAPI_INVOICE_SANDBOX_RECONCILIATION_ONLY_CONFIRMED/);
assert.match(sandboxSmoke, /finalReconciliationState/);
assert.match(sandboxSmoke, /\["380", "381", "380", "381"\]/);
assert.match(sandboxSmoke, /\["380", "381", "380", "381", "380"\]/);
assert.match(sandboxSmoke, /publicPayload\.leitweg_id/);
assert.match(sandboxSmoke, /OPENAPI_INVOICE_SANDBOX_SMOKE_CONFIRMED/);
assert.match(sandboxSmoke, /OPENAPI_INVOICE_SANDBOX_381_PROBE_CONFIRMED/);
assert.match(sandboxSmoke, /allowSandboxFinancialAdjustmentProbe: true/);
assert.match(sandboxSmoke, /sandboxWebhookPreflightConfirmed/);
assert.match(sandboxSmoke, /syncConfigurationWebhook[\s\S]*ensureConfiguration/);
assert.match(sandboxSmoke, /await verifySandboxWebhook\(/);
assert.ok(sandboxSmoke.indexOf("await verifySandboxWebhook(") < sandboxSmoke.indexOf("await openapi.ensureConfiguration("));
assert.match(sandboxSmoke, /requireExistingConfigurationMatch: true/);
assert.doesNotMatch(handler, /allowSandboxFinancialAdjustmentProbe/);
assert.doesNotMatch(deliveryRunner, /allowSandboxFinancialAdjustmentProbe/);

(async function () {
  const productionEnv = {
    OPENAPI_INVOICE_TOKEN: "production-token",
    OPENAPI_INVOICE_MODE: "production",
    POS_OPENAPI_INVOICE_ENABLED: "true",
    OPENAPI_INVOICE_SEND_ENABLED: "true",
    OPENAPI_INVOICE_TOKEN_EXPIRES_AT: "2099-12-31T23:59:59Z",
    OPENAPI_INVOICE_WEBHOOK_SECRET: "p".repeat(32),
    OPENAPI_INVOICE_WEBHOOK_URL: "https://example.test/api/pos?handler=openapi-invoice&webhook=1",
    OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED: "true",
    OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL: "https://example.test/api/pos?handler=openapi-invoice&webhook=1",
    OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT: new Date().toISOString(),
  };
  const productionWithoutPublicPreflight = Object.assign({}, productionEnv);
  delete productionWithoutPublicPreflight.OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED;
  let preflightBypassCalls = 0;
  assert.throws(
    () => providers.providerFor("openapi", {
      env: productionWithoutPublicPreflight,
      fetch: async function () { preflightBypassCalls += 1; return response(200, { data: [] }); },
    }),
    (error) => error && error.code === "OPENAPI_NOT_ENABLED"
  );
  assert.strictEqual(preflightBypassCalls, 0, "manjkajoč javni preflight se mora ustaviti pred provider klicem");
  const productionWithoutSendApproval = Object.assign({}, productionEnv);
  delete productionWithoutSendApproval.OPENAPI_INVOICE_SEND_ENABLED;
  let sendApprovalBypassCalls = 0;
  assert.throws(
    () => providers.providerFor("openapi", {
      env: productionWithoutSendApproval,
      fetch: async function () { sendApprovalBypassCalls += 1; return response(200, { data: [] }); },
    }),
    (error) => error && error.code === "OPENAPI_NOT_ENABLED"
  );
  assert.strictEqual(sendApprovalBypassCalls, 0, "manjkajoče produkcijsko send dovoljenje se mora ustaviti pred provider klicem");
  let gatedConfigurationPosts = 0;
  await assert.rejects(
    () => openapi.ensureConfiguration(mapped, {
      env: productionEnv,
      fetch: async function (url, options) {
        if (options.method === "POST") gatedConfigurationPosts += 1;
        return response(404, { success: false });
      },
    }),
    (error) => error && error.code === "OPENAPI_CONFIGURATION_CREATE_NOT_APPROVED"
  );
  assert.strictEqual(gatedConfigurationPosts, 0, "zaklep ne sme izvesti plačljivega POST konfiguracije");
  let gatedConfigurationPatches = 0;
  const productionConfiguration = openapi.configurationPayload(mapped, { env: productionEnv });
  await assert.rejects(
    () => openapi.ensureConfiguration(mapped, {
      env: productionEnv,
      fetch: async function (_url, options) {
        if (options.method === "PATCH") gatedConfigurationPatches += 1;
        return response(200, { data: Object.assign({}, productionConfiguration, { name: "Staro ime" }) });
      },
    }),
    (error) => error && error.code === "OPENAPI_CONFIGURATION_UPDATE_NOT_APPROVED"
  );
  assert.strictEqual(gatedConfigurationPatches, 0, "zaklep ne sme izvesti plačljivega PATCH konfiguracije");
  let protectedProbeConfigurationMutations = 0;
  await assert.rejects(
    () => openapi.ensureConfiguration(mapped, {
      env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
      requireExistingConfigurationMatch: true,
      fetch: async function (_url, options) {
        if (options.method === "PATCH" || options.method === "POST") protectedProbeConfigurationMutations += 1;
        return response(200, { data: Object.assign({}, configuredCompany, { name: "Staro ime" }) });
      },
    }),
    (error) => error && error.code === "OPENAPI_CONFIGURATION_MUTATION_NOT_APPROVED"
  );
  assert.strictEqual(protectedProbeConfigurationMutations, 0, "sandbox probe ne sme spremeniti konfiguracije");

  const fetchedInvoice = await openapi.fetchInvoice("remote-id", {
    env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
    fetch: async function (url) {
      assert.match(url, /\/DE-invoices\/remote-id$/);
      return response(200, { data: { id: "remote-id", state: "SENT" } });
    },
  });
  assert.strictEqual(fetchedInvoice.id, "remote-id");
  let productionSyncCalls = 0;
  await assert.rejects(
    () => openapi.syncConfigurationWebhook("DE123456789", {
      env: productionEnv,
      fetch: async function () { productionSyncCalls += 1; return response(200, {}); },
    }),
    (error) => error && error.code === "OPENAPI_PRODUCTION_CONFIGURATION_SYNC_NOT_APPROVED"
  );
  assert.strictEqual(productionSyncCalls, 0, "produkcijska sync pot se mora ustaviti pred omrežnim klicem");

  const calls = [];
  const fetchMock = async function (url, options) {
    calls.push({ url, options });
    if (url.includes("/DE-invoices?")) return response(200, { data: [] });
    if (url.endsWith("/DE-configurations/DE123456789")) return response(404, { success: false });
    if (url.endsWith("/DE-configurations")) return response(200, { data: { id: "company-id" } });
    if (url.endsWith("/DE-invoices")) return response(200, { data: { id: "invoice-id", state: "NEW" } });
    throw new Error("unexpected " + url);
  };
  const provider = providers.providerFor("openapi", { env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" }, fetch: fetchMock });
  const result = await provider.deliver(packageFixture());
  assert.strictEqual(result.providerReference, "invoice-id");
  assert.strictEqual(result.testMode, true);
  assert.strictEqual(result.sent, false);
  assert.strictEqual(calls.filter((call) => call.url.endsWith("/DE-invoices") && call.options.method === "POST").length, 1);
  assert.ok(calls.every((call) => call.options.headers.Authorization === "Bearer sandbox-token"));
  const posted = JSON.parse(calls.find((call) => call.url.endsWith("/DE-invoices") && call.options.method === "POST").options.body);
  assert.strictEqual(posted.document_number, "SBX-2222222222224222-TEST-2026-0001");
  assert.strictEqual(posted.attachments[0].filename, "TEST-2026-0001.pdf");
  assert.strictEqual(posted.tax_subtotals[0].vat_rate, 19);

  const adjustmentCalls = [];
  const adjustmentProvider = providers.providerFor("openapi", {
    env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
    fetch: async function (url, options) {
      adjustmentCalls.push({ url, options });
      if (url.includes("/DE-invoices?")) return response(200, { data: [] });
      if (url.endsWith("/DE-configurations/DE123456789")) return response(200, { data: configuredCompany });
      if (url.endsWith("/DE-invoices")) return response(200, { data: { id: "credit-note-id", state: "NEW" } });
      throw new Error("unexpected " + url);
    }
  });
  await assert.rejects(
    adjustmentProvider.deliver(adjustmentPackage("credit_note")),
    (error) => error && error.code === "OPENAPI_DE_381_PROVIDER_CONFLICT"
  );
  assert.strictEqual(adjustmentCalls.length, 0);

  const unconfirmedProbeCalls = [];
  const unconfirmedProbe = providers.providerFor("openapi", {
    env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
    allowSandboxFinancialAdjustmentProbe: true,
    fetch: async function (url, options) {
      unconfirmedProbeCalls.push({ url, options });
      return response(200, { data: [] });
    },
  });
  await assert.rejects(
    unconfirmedProbe.deliver(adjustmentPackage("cancellation")),
    (error) => error && error.code === "OPENAPI_DE_381_PROVIDER_CONFLICT"
  );
  assert.strictEqual(unconfirmedProbeCalls.length, 0);

  const confirmedProbeCalls = [];
  const confirmedProbe = providers.providerFor("openapi", {
    env: {
      OPENAPI_INVOICE_TOKEN: "sandbox-token",
      OPENAPI_INVOICE_MODE: "sandbox",
      OPENAPI_INVOICE_SANDBOX_SMOKE_CONFIRMED: "true",
      OPENAPI_INVOICE_SANDBOX_381_PROBE_CONFIRMED: "true",
      OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET: "s".repeat(32),
      OPENAPI_INVOICE_SANDBOX_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1&sandbox=1",
    },
    allowSandboxFinancialAdjustmentProbe: true,
    sandboxWebhookPreflightConfirmed: true,
    fetch: async function (url, options) {
      confirmedProbeCalls.push({ url, options });
      if (url.includes("/DE-invoices?")) return response(200, { data: [] });
      if (url.endsWith("/DE-configurations/DE123456789")) return response(200, { data: configuredCompany });
      if (url.endsWith("/DE-invoices")) return response(200, { data: { id: "probe-credit-note-id", state: "NEW" } });
      throw new Error("unexpected " + url);
    },
  });
  const confirmedProbeResult = await confirmedProbe.deliver(adjustmentPackage("credit_note"));
  assert.strictEqual(confirmedProbeResult.providerReference, "probe-credit-note-id");
  assert.strictEqual(confirmedProbeResult.testMode, true);
  const confirmedProbePost = confirmedProbeCalls.find((call) => call.url.endsWith("/DE-invoices") && call.options.method === "POST");
  assert.ok(confirmedProbePost);
  const confirmedProbePayload = JSON.parse(confirmedProbePost.options.body);
  assert.strictEqual(confirmedProbePayload.type, "381");
  assert.deepStrictEqual(confirmedProbePayload.billing_reference, { document_number: "SBX-2222222222224222-TEST-2026-0001", issue_date: "2026-08-24" });
  assert.strictEqual(confirmedProbePayload.total_amount_including_tax, -59.5);
  assert.strictEqual(confirmedProbePayload.invoice_lines[0].quantity, 1);
  assert.strictEqual(confirmedProbePayload.invoice_lines[0].unit_price, -50);
  assert.strictEqual(confirmedProbePayload.invoice_lines[0].total_net_amount, -50);
  assert.strictEqual(confirmedProbePayload.tax_subtotals[0].taxable_amount, -50);
  assert.strictEqual(confirmedProbePayload.tax_subtotals[0].tax_amount, -9.5);

  const rejectedProbeCalls = [];
  const rejectedProbe = providers.providerFor("openapi", {
    env: {
      OPENAPI_INVOICE_TOKEN: "sandbox-token",
      OPENAPI_INVOICE_MODE: "sandbox",
      OPENAPI_INVOICE_SANDBOX_SMOKE_CONFIRMED: "true",
      OPENAPI_INVOICE_SANDBOX_381_PROBE_CONFIRMED: "true",
      OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET: "s".repeat(32),
      OPENAPI_INVOICE_SANDBOX_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1&sandbox=1",
    },
    allowSandboxFinancialAdjustmentProbe: true,
    sandboxWebhookPreflightConfirmed: true,
    fetch: async function (url, options) {
      rejectedProbeCalls.push({ url, options });
      if (url.includes("/DE-invoices?")) return response(200, { data: [] });
      if (url.endsWith("/DE-configurations/DE123456789")) return response(200, { data: configuredCompany });
      if (url.endsWith("/DE-invoices")) {
        return response(422, {
          success: false,
          message: "Service error: [:preferredInvoiceType]: cannot send this type for a positive amount",
          error: 422,
          data: null,
        });
      }
      throw new Error("unexpected " + url);
    },
  });
  await assert.rejects(
    rejectedProbe.deliver(adjustmentPackage("cancellation")),
    (error) => error
      && error.code === "OPENAPI_HTTP_422"
      && error.status === 422
      && error.retryable === false
      && /cannot send this type for a positive amount/.test(error.message)
  );
  assert.strictEqual(
    rejectedProbeCalls.filter((call) => call.url.endsWith("/DE-invoices") && call.options.method === "POST").length,
    1,
    "ponudnikov HTTP 422 ne sme samodejno ponoviti oddaje tipa 381"
  );
  assert.strictEqual(
    rejectedProbeCalls.filter((call) => call.url.includes("/DE-invoices?")).length,
    2,
    "po HTTP 422 je dovoljena samo začetna in zaključna idempotentna poizvedba"
  );

  const productionProbeCalls = [];
  const productionProbe = providers.providerFor("openapi", {
    env: {
      OPENAPI_INVOICE_TOKEN: "production-token",
      OPENAPI_INVOICE_MODE: "production",
      POS_OPENAPI_INVOICE_ENABLED: "true",
      OPENAPI_INVOICE_SEND_ENABLED: "true",
      OPENAPI_INVOICE_TOKEN_EXPIRES_AT: "2099-12-31T23:59:59Z",
      OPENAPI_INVOICE_WEBHOOK_SECRET: "x".repeat(32),
      OPENAPI_INVOICE_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
      OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED: "true",
      OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
      OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT: new Date().toISOString(),
      OPENAPI_INVOICE_SANDBOX_381_PROBE_CONFIRMED: "true",
    },
    allowSandboxFinancialAdjustmentProbe: true,
    fetch: async function (url, options) {
      productionProbeCalls.push({ url, options });
      if (url.includes("/DE-invoices?")) return response(200, { data: [] });
      if (url.endsWith("/DE-configurations/DE123456789")) return response(200, { data: Object.assign({}, configuredCompany, {
        api_configurations: [{ event: "customer-invoice", callback: { url: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1", retry: 5 } }],
      }) });
      if (url.endsWith("/DE-invoices")) return response(200, { data: { id: "production-cancellation-id", state: "NEW" } });
      throw new Error("unexpected " + url);
    },
  });
  const productionAdjustment = adjustmentPackage("cancellation");
  productionAdjustment.delivery.is_test = false;
  productionAdjustment.invoice.is_test = false;
  productionAdjustment.adjustment.is_test = false;
  const productionAdjustmentResult = await productionProbe.deliver(productionAdjustment);
  assert.strictEqual(productionAdjustmentResult.providerReference, "production-cancellation-id");
  assert.strictEqual(productionAdjustmentResult.testMode, false);
  assert.strictEqual(productionProbeCalls.filter((call) => call.url.endsWith("/DE-invoices") && call.options.method === "POST").length, 1);
  const productionPayload = JSON.parse(productionProbeCalls.find((call) => call.url.endsWith("/DE-invoices") && call.options.method === "POST").options.body);
  assert.strictEqual(productionPayload.type, "381");
  assert.strictEqual(productionPayload.total_amount_including_tax, -119);
  assert.deepStrictEqual(productionPayload.billing_reference, { document_number: "TEST-2026-0001", issue_date: "2026-08-24" });

  let productionLockedFetches = 0;
  assert.throws(
    () => providers.providerFor("openapi", {
      env: {
        OPENAPI_INVOICE_TOKEN: "production-token",
        OPENAPI_INVOICE_MODE: "production",
        POS_OPENAPI_INVOICE_ENABLED: "true",
        OPENAPI_INVOICE_TOKEN_EXPIRES_AT: "2099-12-31T23:59:59Z",
      },
      fetch: async function () { productionLockedFetches += 1; return response(500, {}); },
    }),
    (error) => error && error.code === "OPENAPI_NOT_ENABLED"
  );
  assert.strictEqual(productionLockedFetches, 0, "Zaprt splošni produkcijski gate mora preprečiti vsak provider klic.");

  const existingProvider = providers.providerFor("openapi", {
    env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
    fetch: async function (url) {
      if (url.includes("/DE-invoices?")) return response(200, { data: [{ id: "existing-id", document_number: "SBX-2222222222224222-TEST-2026-0001", state: "SENT" }] });
      throw new Error("Idempotent lookup should avoid writes");
    }
  });
  const existing = await existingProvider.deliver(packageFixture());
  assert.strictEqual(existing.providerReference, "existing-id");

  for (const idempotencyStatus of [401, 503]) {
    const idempotencyFailureCalls = [];
    const idempotencyFailureProvider = providers.providerFor("openapi", {
      env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
      fetch: async function (url, options) {
        idempotencyFailureCalls.push({ url, options });
        return response(idempotencyStatus, { success: false });
      },
    });
    await assert.rejects(
      () => idempotencyFailureProvider.deliver(packageFixture()),
      (error) => error && error.code === "OPENAPI_IDEMPOTENCY_CHECK_FAILED"
        && error.status === idempotencyStatus
        && error.retryable === (idempotencyStatus >= 500)
    );
    assert.strictEqual(idempotencyFailureCalls.length, 1, "neuspešen idempotentni GET mora ustaviti dostavo");
    assert.strictEqual(idempotencyFailureCalls[0].options.method, "GET");
  }

  const duplicateConfigurationProvider = providers.providerFor("openapi", {
    env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
    fetch: async function (url) {
      if (url.includes("/DE-invoices?")) return response(200, { data: [] });
      if (url.endsWith("/DE-configurations/DE123456789")) return response(404, { success: false });
      if (url.endsWith("/DE-configurations")) return response(422, { success: false, message: "This fiscal_id is already registered" });
      if (url.endsWith("/DE-invoices")) return response(200, { data: { id: "duplicate-config-invoice-id", state: "NEW" } });
      throw new Error("unexpected " + url);
    }
  });
  const duplicateConfiguration = await duplicateConfigurationProvider.deliver(packageFixture());
  assert.strictEqual(duplicateConfiguration.providerReference, "duplicate-config-invoice-id");

  const conflictingConfigurationCalls = [];
  const conflictingConfigurationProvider = providers.providerFor("openapi", {
    env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
    fetch: async function (url, options) {
      conflictingConfigurationCalls.push({ url, options });
      if (url.includes("/DE-invoices?")) return response(200, { data: [] });
      if (url.endsWith("/DE-configurations/DE123456789")) return response(404, { success: false });
      if (url.endsWith("/DE-configurations")) return response(409, { success: false, message: "Configuration conflict" });
      throw new Error("unexpected write after rejected configuration " + url);
    },
  });
  await assert.rejects(
    () => conflictingConfigurationProvider.deliver(packageFixture()),
    (error) => error && error.code === "OPENAPI_CONFIGURATION_REJECTED" && error.status === 409
  );
  assert.strictEqual(
    conflictingConfigurationCalls.filter((call) => call.url.endsWith("/DE-invoices") && call.options.method === "POST").length,
    0,
    "neznan konfiguracijski konflikt ne sme nadaljevati do POST računa"
  );

  const rejectedProvider = providers.providerFor("openapi", {
    env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
    fetch: async function (url) {
      if (url.includes("/DE-invoices?")) return response(200, { data: [] });
      if (url.endsWith("/DE-configurations/DE123456789")) return response(404, { success: false });
      if (url.endsWith("/DE-configurations")) return response(422, { success: false, message: "Invalid German address" });
      throw new Error("unexpected " + url);
    }
  });
  await assert.rejects(() => rejectedProvider.deliver(packageFixture()), /Invalid German address/);

  const networkProvider = providers.providerFor("openapi", {
    env: { OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox" },
    fetch: async function () { throw new Error("network unavailable"); }
  });
  await assert.rejects(
    () => networkProvider.deliver(packageFixture()),
    (error) => error && error.code === "OPENAPI_NETWORK_ERROR" && error.retryable === true
  );

  const syncCalls = [];
  const synced = await openapi.syncConfigurationWebhook("DE116977919", {
    env: {
      OPENAPI_INVOICE_TOKEN: "sandbox-token", OPENAPI_INVOICE_MODE: "sandbox",
      OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET: "s".repeat(32),
      OPENAPI_INVOICE_SANDBOX_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1&sandbox=1",
    },
    fetch: async function (url, options) {
      syncCalls.push({ url, options });
      if (!options || options.method === "GET") return response(200, { data: { id: "company-id" } });
      return response(200, { data: { id: "company-id" } });
    },
  });
  assert.strictEqual(synced.id, "company-id");
  const patchCall = syncCalls.find((call) => call.options && call.options.method === "PATCH");
  assert.ok(patchCall);
  assert.match(JSON.parse(patchCall.options.body).api_configurations[0].callback.url, /sandbox=1/);

  const originalConfiguration = supabaseServer.konfiguracija;
  const originalRpc = supabaseServer.pokliciRpc;
  const originalWebhookSecret = process.env.OPENAPI_INVOICE_WEBHOOK_SECRET;
  const originalSandboxWebhookSecret = process.env.OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET;
  let webhookRpc = null;
  let webhookRpcResult = { id: "delivery-id", status: "delivered" };
  try {
    process.env.OPENAPI_INVOICE_WEBHOOK_SECRET = "w".repeat(32);
    supabaseServer.konfiguracija = () => ({ url: "https://db.example", serviceRoleKey: "service" });
    supabaseServer.pokliciRpc = async (_cfg, name, args) => {
      webhookRpc = { name, args };
      return webhookRpcResult;
    };
    const webhookRes = mockRes();
    await handlerModule._test.handleWebhook({
      method: "POST", url: "/api/pos?handler=openapi-invoice&webhook=1",
      headers: { authorization: "Bearer " + "w".repeat(32) },
      body: { data: { id: "invoice-id", state: "DONE", updated_at: "2026-08-24T09:45:00Z", details: { external_status: "accepted" } } },
    }, webhookRes, { webhookConfigured: true });
    assert.strictEqual(webhookRes.statusCode, 200);
    assert.strictEqual(webhookRes.body.matched, true);
    assert.strictEqual(webhookRpc.name, "pos_apply_openapi_invoice_event");
    assert.strictEqual(webhookRpc.args.p_external_status, "accepted");
    assert.strictEqual(webhookRpc.args.p_sandbox, false);
    assert.strictEqual(webhookRpc.args.p_event_at, "2026-08-24T09:45:00.000Z");

    webhookRpcResult = null;
    const earlyWebhookRes = mockRes();
    await handlerModule._test.handleWebhook({
      method: "POST", url: "/api/pos?handler=openapi-invoice&webhook=1",
      headers: { authorization: "Bearer " + "w".repeat(32) },
      body: { data: { id: "invoice-before-local-commit", state: "DONE", updated_at: "2026-08-24T09:45:01Z" } },
    }, earlyWebhookRes, { webhookConfigured: true });
    assert.strictEqual(earlyWebhookRes.statusCode, 503);
    assert.strictEqual(earlyWebhookRes.body.code, "OPENAPI_DELIVERY_NOT_READY");
    webhookRpcResult = { id: "delivery-id", status: "test_completed" };

    process.env.OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET = "s".repeat(32);
    const sandboxWebhookRes = mockRes();
    await handlerModule._test.handleWebhook({
      method: "POST", url: "/api/pos?handler=openapi-invoice&webhook=1&sandbox=1",
      headers: { authorization: "Bearer " + "s".repeat(32) },
      body: { id: "invoice-id", state: "SENT", details: { external_status: "succeeded" } },
    }, sandboxWebhookRes, { webhookConfigured: false });
    assert.strictEqual(sandboxWebhookRes.statusCode, 200);
    assert.strictEqual(webhookRpc.args.p_state, "SENT");
    assert.strictEqual(webhookRpc.args.p_sandbox, true);

    const invalidTimeRes = mockRes();
    await handlerModule._test.handleWebhook({
      method: "POST", url: "/api/pos?handler=openapi-invoice&webhook=1&sandbox=1",
      headers: { authorization: "Bearer " + "s".repeat(32) },
      body: { id: "invoice-id", state: "SENT", updated_at: "not-a-date" },
    }, invalidTimeRes, { webhookConfigured: false });
    assert.strictEqual(invalidTimeRes.statusCode, 400);

    const crossedSecretsRes = mockRes();
    await handlerModule._test.handleWebhook({
      method: "POST", url: "/api/pos?handler=openapi-invoice&webhook=1&sandbox=1",
      headers: { authorization: "Bearer " + "w".repeat(32) },
      body: { id: "invoice-id", state: "SENT" },
    }, crossedSecretsRes, { webhookConfigured: true });
    assert.strictEqual(crossedSecretsRes.statusCode, 401);
  } finally {
    supabaseServer.konfiguracija = originalConfiguration;
    supabaseServer.pokliciRpc = originalRpc;
    if (originalWebhookSecret === undefined) delete process.env.OPENAPI_INVOICE_WEBHOOK_SECRET;
    else process.env.OPENAPI_INVOICE_WEBHOOK_SECRET = originalWebhookSecret;
    if (originalSandboxWebhookSecret === undefined) delete process.env.OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET;
    else process.env.OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET = originalSandboxWebhookSecret;
  }
  assert.match(webhookMigration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(webhookMigration, /provider='openapi' and provider_reference=/i);
  assert.match(webhookMigration, /revoke all on function public\.pos_apply_openapi_invoice_event[\s\S]*authenticated/i);
  assert.match(webhookGuardMigration, /and is_test=p_sandbox/i);
  assert.match(webhookGuardMigration, /v_event_at < v_delivery\.last_provider_event_at/i);
  assert.match(webhookGuardMigration, /when p_sandbox then null[\s\S]*sent_at/i);
  assert.match(webhookGuardMigration, /status=v_status/i);
  assert.match(webhookGuardMigration, /revoke all on function public\.pos_apply_openapi_invoice_event\(text,text,text,timestamptz,boolean\)[\s\S]*authenticated/i);
  assert.match(sandboxRepairMigration, /provider='openapi' and is_test=true and status in \('sent','delivered'\)/i);
  assert.match(sandboxRepairMigration, /event_type,provider_event_at,details[\s\S]*'test_completed'[\s\S]*sandbox_status_repair/i);
  assert.match(sandboxRepairMigration, /delivery_openapi_test_status_repaired/i);
  assert.match(submissionClockMigration, /last_provider_event_at=null,[\s\S]*last_provider_event_type=''/i);
  assert.match(submissionClockMigration, /provider in \('openapi','resend'\) and is_test=false and status='sent'[\s\S]*last_provider_event_type='submitted'/i);
  assert.match(submissionClockMigration, /last_provider_event_at=null,[\s\S]*last_provider_event_type=''/i);
  assert.match(submissionClockMigration, /submission_clock_not_provider_watermark/i);
  assert.match(submissionClockMigration, /'delivery_'\|\|v_delivery\.provider\|\|'_provider_clock_reset'/i);
  assert.match(submissionClockMigration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(submissionClockMigration, /revoke all on function private\._pos_finish_invoice_delivery\(uuid,uuid,uuid,boolean,text,text,boolean\)[\s\S]*authenticated/i);
  assert.match(succeededDeliveryMigration, /when v_state='DONE' or \(v_state='SENT' and v_external='succeeded'\) then 'delivered'/i);
  assert.match(succeededDeliveryMigration, /if p_sandbox then[\s\S]*'test_completed'[\s\S]*else[\s\S]*v_external='succeeded'/i);
  assert.match(succeededDeliveryMigration, /v_terminal :=[\s\S]*p_state[\s\S]*'DONE'[\s\S]*'ERROR'[\s\S]*p_state[\s\S]*'SENT'[\s\S]*p_external_status[\s\S]*'succeeded'/i);
  assert.match(succeededDeliveryMigration, /reconcile_after = case[\s\S]*when v_terminal[\s\S]*then null/i);
  assert.match(succeededDeliveryMigration, /revoke all on function private\._pos_apply_openapi_invoice_event\(text,text,text,timestamptz,boolean\)[\s\S]*authenticated/i);
  assert.doesNotMatch(succeededDeliveryMigration, /grant execute[\s\S]*(?:anon|authenticated)/i);
  const immediateRpcCalls = [];
  const immediate = await deliveryRunnerModule.applyImmediateOpenapiResult(
    { serviceRole: true },
    { is_test: false },
    { id: "delivery-id", status: "sent" },
    { provider: "openapi", providerReference: "invoice-succeeded", delivered: true, remoteState: "SENT", externalStatus: "succeeded" },
    async function (cfg, name, args) {
      immediateRpcCalls.push({ cfg, name, args });
      return { id: "delivery-id", status: "delivered" };
    }
  );
  assert.strictEqual(immediate.status, "delivered");
  assert.strictEqual(immediateRpcCalls.length, 1);
  assert.strictEqual(immediateRpcCalls[0].name, "pos_apply_openapi_invoice_event");
  assert.deepStrictEqual(immediateRpcCalls[0].args, {
    p_provider_reference: "invoice-succeeded",
    p_state: "SENT",
    p_external_status: "succeeded",
    p_event_at: null,
    p_sandbox: false,
  });
  const notDelivered = { id: "delivery-id", status: "sent" };
  assert.strictEqual(await deliveryRunnerModule.applyImmediateOpenapiResult(
    {}, { is_test: false }, notDelivered,
    { provider: "openapi", delivered: false },
    async function () { throw new Error("RPC ne sme biti poklican."); }
  ), notDelivered);
  console.log("POS Openapi Invoice tests passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
