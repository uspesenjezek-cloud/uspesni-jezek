"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_delivery_dispatch_engine\.sql$/.test(name)).sort().pop();
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", migrationName), "utf8");
const securityMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_delivery_queue_security_wrapper\.sql$/.test(name)).sort().pop();
const securityMigration = fs.readFileSync(path.join(root, "supabase", "migrations", securityMigrationName), "utf8");
const liveMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_resend_delivery_activation\.sql$/.test(name)).sort().pop();
const liveMigration = fs.readFileSync(path.join(root, "supabase", "migrations", liveMigrationName), "utf8");
const safeTestMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_resend_safe_test_mode\.sql$/.test(name)).sort().pop();
const safeTestMigration = fs.readFileSync(path.join(root, "supabase", "migrations", safeTestMigrationName), "utf8");
const einvoiceExemptionsMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_einvoice_delivery_exemptions\.sql$/.test(name)).sort().pop();
const einvoiceExemptionsMigration = fs.readFileSync(path.join(root, "supabase", "migrations", einvoiceExemptionsMigrationName), "utf8");
const deliveryLimitsMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_delivery_field_limits\.sql$/.test(name)).sort().pop();
const deliveryLimitsMigration = fs.readFileSync(path.join(root, "supabase", "migrations", deliveryLimitsMigrationName), "utf8");
const lifecycleMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_delivery_lifecycle_invariants\.sql$/.test(name)).sort().pop();
assert.ok(lifecycleMigrationName, "Manjkajo invariante življenjskega cikla dostave.");
const lifecycleMigration = fs.readFileSync(path.join(root, "supabase", "migrations", lifecycleMigrationName), "utf8");
const api = fs.readFileSync(path.join(root, "api", "_handlers", "pos-dostava-sandbox.js"), "utf8");
const providerSource = fs.readFileSync(path.join(root, "api", "_lib", "pos-delivery-providers.js"), "utf8");
const packageSource = fs.readFileSync(path.join(root, "api", "_lib", "pos-delivery-package.js"), "utf8");
const runnerSource = fs.readFileSync(path.join(root, "api", "_lib", "pos-delivery-runner.js"), "utf8");
const workerSource = fs.readFileSync(path.join(root, "api", "_lib", "pos-delivery-worker.js"), "utf8");
const emailEndpointSource = fs.readFileSync(path.join(root, "api", "_handlers", "pos-dostava-email.js"), "utf8");
const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
const providers = require(path.join(root, "api", "_lib", "pos-delivery-providers.js"));
const packages = require(path.join(root, "api", "_lib", "pos-delivery-package.js"));
const runner = require(path.join(root, "api", "_lib", "pos-delivery-runner.js"));
const worker = require(path.join(root, "api", "pos-dostava-delavec.js"));
const endpoint = require(path.join(root, "api", "pos-dostava-sandbox.js"));

assert.match(migration, /document_format in \('pdf','xrechnung_pdf'\)[\s\S]*pos_invoice_documents/);
assert.match(migration, /document_format in \('xrechnung','xrechnung_pdf'\)[\s\S]*validation_status[\s\S]*<> 'validated'/);
assert.match(migration, /for update skip locked/i);
assert.match(migration, /status = 'queued' and v_delivery\.provider = 'sandbox'[\s\S]*return v_delivery/);
assert.match(migration, /where status = 'queued'/);
assert.match(migration, /locked_at < now\(\) - interval '2 minutes'/);
assert.match(migration, /status = 'test_completed'/);
assert.match(migration, /sent_at = null[\s\S]*delivered_at = null/);
assert.match(migration, /retry_scheduled/);
assert.match(migration, /attempt_count < max_attempts/);
assert.match(migration, /revoke all on function private\._pos_claim_invoice_delivery[\s\S]*authenticated/);
assert.match(migration, /grant execute on function public\.pos_claim_invoice_delivery[\s\S]*service_role/);
assert.doesNotMatch(migration, /grant execute on function public\.pos_claim_invoice_delivery[\s\S]*to authenticated/);
assert.match(securityMigration, /set schema private/);
assert.match(securityMigration, /public\.pos_queue_invoice_delivery[\s\S]*security invoker/);
assert.match(securityMigration, /private\._pos_queue_invoice_delivery/);
assert.match(liveMigration, /private\._pos_queue_live_invoice_delivery/);
assert.match(liveMigration, /public\.pos_queue_live_invoice_delivery[\s\S]*security invoker/);
assert.match(liveMigration, /revoke all on function public\.pos_queue_live_invoice_delivery\(uuid,uuid,boolean\) from public, anon, authenticated/);
assert.match(liveMigration, /grant execute on function public\.pos_queue_live_invoice_delivery\(uuid,uuid,boolean\) to service_role/);
assert.match(liveMigration, /is_test = false and provider = 'resend'/);
assert.match(liveMigration, /v_event := case when v_delivery\.is_test then 'test_completed' else 'sent' end/);
assert.match(safeTestMigration, /public\.pos_queue_resend_test_invoice_delivery[\s\S]*security invoker/);
assert.match(safeTestMigration, /is_test = true[\s\S]*provider = 'resend'[\s\S]*channel = 'email'/);
assert.match(safeTestMigration, /status = 'test_completed'[\s\S]*sent_at = null[\s\S]*delivered_at = null/);
assert.match(safeTestMigration, /recipient_locked', true/);
assert.match(safeTestMigration, /public\.pos_apply_resend_test_webhook_event/);
assert.match(safeTestMigration, /revoke all on function public\.pos_queue_resend_test_invoice_delivery\(uuid,uuid,boolean\) from public, anon, authenticated/);
assert.match(safeTestMigration, /grant execute on function public\.pos_queue_resend_test_invoice_delivery\(uuid,uuid,boolean\) to service_role/);
assert.doesNotMatch(safeTestMigration, /grant execute on function public\.pos_queue_resend_test_invoice_delivery[\s\S]*to authenticated/);
assert.match(einvoiceExemptionsMigration, /invoice\.service_date < date '2027-01-01'/i);
assert.match(einvoiceExemptionsMigration, /invoice\.gross_cents <= 25000 and invoice\.tax_mode <> 'reverse_charge'/i);
assert.match(einvoiceExemptionsMigration, /invoice\.tax_mode = 'small_business'/i);
assert.match(einvoiceExemptionsMigration, /previous_year_turnover_band = 'lte_800k'/i);
assert.match(einvoiceExemptionsMigration, /before insert or update of document_format, status, provider, is_test/i);
assert.match(einvoiceExemptionsMigration, /not private\.pos_invoice_pdf_delivery_allowed\(v_invoice\.id, v_user\)/i);
assert.match(deliveryLimitsMigration, /char_length\(recipient\) <= 320[\s\S]*recipient !~ E'\[\\\\r\\\\n\]'/i);
assert.match(deliveryLimitsMigration, /char_length\(subject\) <= 240[\s\S]*subject !~ E'\[\\\\r\\\\n\]'/i);
assert.match(deliveryLimitsMigration, /char_length\(message\) <= 4000/i);
assert.match(deliveryLimitsMigration, /octet_length\(details::text\) <= 65536/i);
assert.match(deliveryLimitsMigration, /validate constraint pos_invoice_delivery_events_details_check/i);
assert.match(lifecycleMigration, /pos_invoice_deliveries_lifecycle_check/i);
assert.match(lifecycleMigration, /\(status = 'processing'\) = \(locked_at is not null\)/i);
assert.match(lifecycleMigration, /status not in \('sent','delivered','delivery_delayed','bounced','complained','suppressed'\)[\s\S]*last_provider_event_at is not null/i);
assert.match(lifecycleMigration, /new\.status = 'test_prepared' and new\.provider = 'not_connected'/i);
assert.match(lifecycleMigration, /new\.is_test <> v_invoice_is_test/i);
assert.match(lifecycleMigration, /before insert or update of invoice_id, user_id, status, provider, is_test/i);
assert.match(lifecycleMigration, /revoke all on function private\.pos_validate_delivery_invoice_mode\(\) from public, anon, authenticated/i);
assert.match(lifecycleMigration, /validate constraint pos_invoice_deliveries_lifecycle_check/i);

assert.match(api, /supabase\.preveriUporabnika/);
assert.match(api, /p_user_id: auth\.user\.id/);
assert.match(api, /pos_claim_invoice_delivery/);
assert.match(api, /processClaimed/);
assert.match(api, /sent: false/);
assert.match(api, /delivered: false/);
assert.match(providerSource, /https:\/\/api\.resend\.com\/emails/);
assert.match(providerSource, /Idempotency-Key/);
assert.match(providerSource, /POS_EMAIL_DELIVERY_ENABLED/);
assert.match(providerSource, /POS_EMAIL_DELIVERY_MODE/);
assert.match(providerSource, /POS_EMAIL_TEST_RECIPIENT/);
assert.match(providerSource, /MAX_RAW_ATTACHMENT_BYTES/);
assert.match(packageSource, /pos_invoice_documents/);
assert.match(packageSource, /pos_einvoice_documents/);
assert.match(packageSource, /validation_status !== "validated"/);
assert.match(packageSource, /DELIVERY_ATTACHMENT_HASH_MISMATCH/);
assert.match(packageSource, /pos-invoice-originals/);
assert.match(packageSource, /pos-einvoice-originals/);
assert.match(runnerSource, /pos_finish_invoice_delivery/);
assert.match(workerSource, /CRON_SECRET/);
assert.match(runnerSource, /pos_finish_resend_test_invoice_delivery/);
assert.match(workerSource, /pos_claim_invoice_delivery/);
assert.match(workerSource, /candidateQuery\("queued"/);
assert.match(workerSource, /candidateQuery\("processing"/);
assert.match(workerSource, /provider, isTest/);
assert.match(emailEndpointSource, /EMAIL_DELIVERY_NOT_ENABLED/);
assert.match(workerSource, /readiness\.testEnabled/);
assert.match(workerSource, /pos_claim_resend_test_invoice_delivery/);
assert.match(emailEndpointSource, /pos_queue_live_invoice_delivery/);
assert.match(emailEndpointSource, /confirmed === true/);
assert.match(vercel, /"\/api\/pos-dostava-delavec"[\s\S]*"31 3 \* \* \*"/);
assert.match(emailEndpointSource, /pos_queue_resend_test_invoice_delivery/);

assert.strictEqual(endpoint._test.uuid("cbcb9da5-9c5a-4f58-a8db-06c314fefb93"), "cbcb9da5-9c5a-4f58-a8db-06c314fefb93");
assert.strictEqual(endpoint._test.uuid("not-a-uuid"), "");
assert.deepStrictEqual(runner.rpcRow([{ id: "a" }]), { id: "a" });
assert.match(worker._test.candidateQuery("queued", "2026-08-19T12:00:00.000Z", 3, "sandbox", true), /next_attempt_at=lte\./);
assert.match(worker._test.candidateQuery("processing", "2026-08-19T12:00:00.000Z", 3, "resend", false), /provider=eq\.resend[\s\S]*is_test=eq\.false[\s\S]*locked_at=lt\./);
assert.strictEqual(worker._test.safeEqual("1234567890123456", "1234567890123456"), true);
assert.strictEqual(worker._test.safeEqual("a", "b"), false);
assert.match(worker._test.candidateQuery("queued", "2026-08-19T12:00:00.000Z", 3, "resend", true), /provider=eq\.resend[\s\S]*is_test=eq\.true/);

(async function () {
  const content = Buffer.from("archived invoice bytes");
  const attachment = packages.verifyAttachment({
    kind: "invoice_pdf",
    filename: "RE-2026-1.pdf",
    mediaType: "application/pdf",
    sha256: packages.sha256(content),
    byteSize: content.length,
    content,
  });
  const deliveryPackage = {
    delivery: {
      id: "cbcb9da5-9c5a-4f58-a8db-06c314fefb93",
      invoice_id: "5d286b15-6d18-4cf6-8fe0-b151456e5a40",
      attempt_count: 1,
      is_test: true,
    },
    attachments: [attachment],
    manifestSha256: packages.manifestSha256([attachment]),
  };
  const provider = providers.providerFor("sandbox");
  const result = await provider.deliver(deliveryPackage);
  assert.strictEqual(result.status, "test_completed");
  assert.strictEqual(result.sent, false);
  assert.strictEqual(result.delivered, false);
  assert.match(result.providerReference, /^sandbox-[0-9a-f]{24}$/);
  assert.throws(() => providers.providerFor("email"), /ni konfiguriran/);
  assert.deepStrictEqual(providers.deliveryReadiness({}), {
    provider: "resend", configured: false, sendEnabled: false, testEnabled: false,
    liveEnabled: false, recipientLocked: false, testRecipientConfigured: false,
    webhookConfigured: false, mode: "sandbox"
  });
  assert.deepStrictEqual(providers.deliveryReadiness({
    RESEND_API_KEY: "re_test", POS_EMAIL_FROM: "Firma <rechnung@example.de>",
    POS_EMAIL_DELIVERY_MODE: "test", POS_EMAIL_TEST_RECIPIENT: "qa@example.de"
  }), {
    provider: "resend", configured: true, sendEnabled: true, testEnabled: true,
    liveEnabled: false, recipientLocked: true, testRecipientConfigured: true,
    webhookConfigured: false, mode: "test"
  });
  assert.strictEqual(providers.deliveryReadiness({
    RESEND_API_KEY: "re_test", POS_EMAIL_FROM: "rechnung@example.de",
    POS_EMAIL_DELIVERY_MODE: "test", POS_EMAIL_TEST_RECIPIENT: "ni-naslov"
  }).sendEnabled, false);
  assert.strictEqual(providers.deliveryReadiness({
    RESEND_API_KEY: "re_test", POS_EMAIL_FROM: "rechnung@example.de", POS_EMAIL_DELIVERY_ENABLED: "true"
  }).liveEnabled, false, "staro stikalo brez izrecnega production načina ne sme vključiti pošiljanja");
  assert.strictEqual(providers.deliveryReadiness({
    RESEND_API_KEY: "re_test", POS_EMAIL_FROM: "rechnung@example.de",
    POS_EMAIL_DELIVERY_MODE: "production", POS_EMAIL_DELIVERY_ENABLED: "true"
  }).liveEnabled, true);
  assert.strictEqual(providers.validEmail("rechnung@example.de"), true);
  assert.strictEqual(providers.validEmail("bad\n@example.de"), false);
  assert.throws(() => packages.verifyAttachment(Object.assign({}, attachment, { sha256: "0".repeat(64) })), /celovitosti/);
  await assert.rejects(
    () => provider.deliver({
      delivery: { id: "x", invoice_id: "y", is_test: false },
      attachments: [attachment],
      manifestSha256: deliveryPackage.manifestSha256,
    }),
    /ne sme obdelati prave dostave/
  );
  const requests = [];
  const livePackage = {
    delivery: {
      id: "cbcb9da5-9c5a-4f58-a8db-06c314fefb93",
      invoice_id: "5d286b15-6d18-4cf6-8fe0-b151456e5a40",
      attempt_count: 1,
      is_test: false,
      provider: "resend",
      channel: "email",
    },
    invoiceNumber: "RE-2026-1",
    recipient: "kunde@example.de",
    subject: "Rechnung RE-2026-1",
    message: "Guten Tag, anbei erhalten Sie Ihre Rechnung.",
    attachments: [attachment],
    manifestSha256: packages.manifestSha256([attachment]),
  };
  const resend = providers.providerFor("resend", {
    env: { RESEND_API_KEY: "re_test", POS_EMAIL_FROM: "Firma <rechnung@example.de>", POS_EMAIL_DELIVERY_MODE: "production", POS_EMAIL_DELIVERY_ENABLED: "true" },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, status: 200, json: async () => ({ id: "email-provider-id" }) }; },
  });
  const sent = await resend.deliver(livePackage);
  assert.strictEqual(sent.status, "sent");
  assert.strictEqual(sent.sent, true);
  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0].url, "https://api.resend.com/emails");
  assert.match(requests[0].options.headers["Idempotency-Key"], /^invoice-delivery\//);
  const resendPayload = JSON.parse(requests[0].options.body);
  assert.deepStrictEqual(resendPayload.to, ["kunde@example.de"]);
  assert.strictEqual(resendPayload.attachments[0].content, content.toString("base64"));
  const oversizedResponseProvider = providers.providerFor("resend", {
    env: { RESEND_API_KEY: "re_test", POS_EMAIL_FROM: "Firma <rechnung@example.de>", POS_EMAIL_DELIVERY_MODE: "production", POS_EMAIL_DELIVERY_ENABLED: "true" },
    fetch: async () => new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json", "content-length": String(providers.MAX_PROVIDER_RESPONSE_BYTES + 1) },
    }),
  });
  await assert.rejects(
    () => oversizedResponseProvider.deliver(livePackage),
    function (error) { return error && error.code === "RESEND_RESPONSE_TOO_LARGE" && error.retryable === true; }
  );
  const testRequests = [];
  const safeTest = providers.providerFor("resend", {
    env: {
      RESEND_API_KEY: "re_test", POS_EMAIL_FROM: "Firma <rechnung@example.de>",
      POS_EMAIL_DELIVERY_MODE: "test", POS_EMAIL_TEST_RECIPIENT: "qa-allowlist@example.de"
    },
    fetch: async (url, options) => { testRequests.push({ url, options }); return { ok: true, status: 200, json: async () => ({ id: "email-test-id" }) }; },
  });
  const safeResult = await safeTest.deliver(Object.assign({}, livePackage, {
    delivery: Object.assign({}, livePackage.delivery, { is_test: true })
  }));
  assert.strictEqual(safeResult.testMode, true);
  assert.strictEqual(testRequests.length, 1);
  const safePayload = JSON.parse(testRequests[0].options.body);
  assert.deepStrictEqual(safePayload.to, ["qa-allowlist@example.de"]);
  assert.notStrictEqual(safePayload.to[0], livePackage.recipient, "uporabnikov naslov ne sme obiti strežniškega allowlista");
  await assert.rejects(
    () => safeTest.deliver(Object.assign({}, livePackage, {
      delivery: Object.assign({}, livePackage.delivery, { is_test: false })
    })),
    /izbranem načinu/
  );
  assert.throws(() => providers.providerFor("resend", { env: { RESEND_API_KEY: "re_test", POS_EMAIL_FROM: "a@b.de" } }), /ni vključeno/);
  console.log("POS delivery engine tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
