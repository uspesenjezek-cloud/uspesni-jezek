"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const Core = require(path.join(root, "app", "pos-terminal.js"));
const datev = require(path.join(root, "api", "_lib", "datev-cloud.js"));
const handler = require(path.join(root, "api", "_handlers", "pos-datev.js"));
const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "pos-terminal.css"), "utf8");
const browserJs = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");
const handlerSource = fs.readFileSync(path.join(root, "api", "_handlers", "pos-datev.js"), "utf8");
const localServer = fs.readFileSync(path.join(root, "scripts", "local-server.js"), "utf8");
const datevSettingsValidationMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_datev_settings_validation\.sql$/.test(name)).sort().pop();
assert.ok(datevSettingsValidationMigrationName, "Manjka strežniška validacija DATEV nastavitev.");
const datevSettingsValidationMigration = fs.readFileSync(path.join(root, "supabase", "migrations", datevSettingsValidationMigrationName), "utf8");
const datevProviderBoundsMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_datev_provider_bounds\.sql$/.test(name)).sort().pop();
assert.ok(datevProviderBoundsMigrationName, "Manjkajo omejitve odgovorov DATEV ponudnika.");
const datevProviderBoundsMigration = fs.readFileSync(path.join(root, "supabase", "migrations", datevProviderBoundsMigrationName), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821123000_pos_datev_cloud_integration.sql"), "utf8");
const mockIsolationMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821124359_datev_mock_job_isolation.sql"), "utf8");
const repeatableMockMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821132323_datev_repeatable_mock_runs.sql"), "utf8");
const refreshLockMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260828131500_pos_datev_refresh_rotation_lock.sql"), "utf8");
const documentScopeMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260828143000_pos_datev_document_scope.sql"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

const cfg = datev.configuration({ DATEV_MODE: "mock" });
assert.strictEqual(cfg.mode, "mock");
assert.throws(() => datev.configuration({ DATEV_MODE: "sandbox" }), /nastavitve še niso izdane/i);
const sandboxEnvironment = {
  DATEV_MODE: "sandbox", DATEV_CLIENT_ID: "sandbox-client", DATEV_CLIENT_SECRET: "sandbox-secret",
  DATEV_REDIRECT_URI: "https://uspesni-jezek.vercel.app/api/pos-datev?action=callback",
  DATEV_TOKEN_ENCRYPTION_KEY: "k".repeat(32),
};
assert.strictEqual(datev.configuration(sandboxEnvironment).mode, "sandbox");
assert.throws(() => datev.configuration(Object.assign({}, sandboxEnvironment, {
  DATEV_REDIRECT_URI: "https://example.com/callback",
})), /nastavitve še niso izdane/i);
assert.throws(() => datev.configuration(Object.assign({}, sandboxEnvironment, {
  DATEV_SCOPES: "openid datev:accounting:clients",
})), /scopes niso varno konfigurirani/i);
assert.strictEqual(datev._test.validRedirectUri("https://example.com/api/pos-datev?action=callback"), true);
assert.strictEqual(datev._test.validRedirectUri("https://example.com/api/pos-datev?action=callback#fragment"), false);
assert.throws(
  () => datev.configuration({
    DATEV_MODE: "production",
    DATEV_CLIENT_ID: "live-client",
    DATEV_CLIENT_SECRET: "live-secret",
    DATEV_REDIRECT_URI: "https://uspesni-jezek.vercel.app/api/pos-datev?action=callback",
    DATEV_TOKEN_ENCRYPTION_KEY: "x".repeat(32),
  }),
  function (error) { return error && error.code === "DATEV_PRODUCTION_LOCKED" && error.status === 409; }
);
assert.throws(
  () => datev.urls("production"),
  function (error) { return error && error.code === "DATEV_PRODUCTION_LOCKED"; }
);
assert.deepStrictEqual(handler._test.requestBody({ headers: {}, body: '{"action":"status"}' }), { action: "status" });
assert.throws(() => handler._test.requestBody({ headers: {}, body: { payload: "x".repeat(handler._test.MAX_BODY_BYTES) } }), /prevelik/);
const state = datev.sealState(cfg, { userId: "11111111-1111-4111-8111-111111111111", verifier: "secret" });
assert.strictEqual(datev.openState(cfg, state).verifier, "secret");
assert.throws(() => datev.openState(cfg, state.slice(0, -2) + "aa"), /ni veljavna/i);
const authUrl = new URL(datev.authorizationUrl(cfg, { userId: "11111111-1111-4111-8111-111111111111" }));
const authState = datev.openState(cfg, authUrl.searchParams.get("state"));
assert.strictEqual(authUrl.hostname, "login.datev.de");
assert.strictEqual(authUrl.searchParams.get("code_challenge_method"), "S256");
assert.ok(authUrl.searchParams.get("code_challenge"));
assert.ok(authUrl.searchParams.get("nonce"));
assert.strictEqual(authUrl.searchParams.get("nonce"), authState.nonce);
assert.ok(authState.nonce.length >= 20);
assert.strictEqual(authUrl.searchParams.get("enableWindowsSso"), "true");
assert.match(authUrl.searchParams.get("scope"), /accounting:documents/);
assert.strictEqual(datev.normalizedClientId("29098", "55003"), "29098-55003");
assert.strictEqual(datev.hasBuchungsdatenservice(datev.mockClient("29098", "55003")), true);
assert.strictEqual(datev.hasBuchungsdatenservice({ services: [{ name: "Buchungsdatenservice", scopes: [] }] }), false);
assert.strictEqual(datev.hasBuchungsdatenservice({ services: [{ name: "Drug servis", scopes: ["datev:accounting:extf-files-import"] }] }), false);
assert.strictEqual(datev.supportsDocumentExtension({ allowed_file_extensions: ["jpg", "PDF"] }, ".pdf"), true);
assert.throws(() => datev.safeJobUrl(cfg, "https://example.com/job/1"), /neveljavno povezavo/i);
assert.strictEqual(datev._test.parseRetryAfter("0", 5), 1);
assert.strictEqual(datev._test.parseRetryAfter("999", 5), 300);
assert.strictEqual(datev._test.parseRetryAfter("neveljavno", 7), 7);
assert.strictEqual(handler._test.cookie({ headers: { cookie: "other=1; " + handler._test.DATEV_OAUTH_COOKIE + "=abc%20123" } }, handler._test.DATEV_OAUTH_COOKIE), "abc 123");
assert.strictEqual(handler._test.sameSecret(handler._test.oauthBindingHash("browser-secret"), handler._test.oauthBindingHash("browser-secret")), true);
assert.strictEqual(handler._test.sameSecret(handler._test.oauthBindingHash("browser-secret"), handler._test.oauthBindingHash("other-browser")), false);
assert.throws(() => handler._test.tokenExpiry({ access_token: "", expires_in: 600 }), /neveljavno žetonsko sejo/i);
assert.throws(() => handler._test.tokenExpiry({ access_token: "token", expires_in: Infinity }), /neveljavno žetonsko sejo/i);
assert.ok(Date.parse(handler._test.tokenExpiry({ access_token: "token", expires_in: 600 })) > Date.now());
assert.deepStrictEqual(handler._test.publicConnection(cfg, { environment: "sandbox", status: "connected", datev_client_id: "secret-client" }), {
  configured: true, environment: "mock", connected: false, status: "disconnected", clientId: "",
  consultantNumber: null, clientNumber: null, clientName: "", lastVerifiedAt: null, lastErrorCode: "",
});

const profile = Core.defaultProfile();
const draft = Core.defaultDraft(profile);
draft.issueDate = "2026-08-19";
draft.serviceDate = "2026-08-19";
draft.customerName = "DATEV Test GmbH";
draft.items[0].description = "Testleistung";
draft.items[0].unitPrice = "100,00";
const settings = Object.assign(Core.defaultDatevSettings("03"), {
  adviserNumber: "29098", clientNumber: "55003", confirmed: true,
});
assert.strictEqual(handler._test.validateTransferSettings(settings, "2026-08"), settings);
assert.throws(
  () => handler._test.validateTransferSettings(Object.assign({}, settings, { confirmed: false }), "2026-08"),
  function (error) { return error && error.code === "DATEV_SETTINGS_INCOMPLETE" && error.status === 409; }
);
const invoiceGuid = "11111111-1111-4111-8111-111111111111";
const adjustmentGuid = "22222222-2222-4222-8222-222222222222";
const invoice = {
  id: "invoice-1", number: "RE-2026-0001", dueDate: "2026-09-02", draft,
  isTest: false, documentGuid: invoiceGuid,
  adjustments: [{
    id: "adjustment-1", number: "ST-2026-0001", type: "cancellation",
    createdAt: "2026-08-20T08:00:00Z", deltaGrossCents: -11900,
    documentGuid: adjustmentGuid, draft,
  }],
};
const linked = Core.buildDatevExport([invoice], settings, "2026-08", new Date("2026-08-21T10:00:00Z"), { requireDocumentLinks: true });
assert.deepStrictEqual(linked.errors, []);
assert.strictEqual(linked.bookings.length, 2);
const rows = linked.content.trim().split("\r\n").slice(2).map((line) => line.split(";"));
assert.strictEqual(rows[0][19], '"BEDI ""11111111-1111-4111-8111-111111111111"""');
assert.strictEqual(rows[1][19], '"BEDI ""22222222-2222-4222-8222-222222222222"""');
const creditInvoice = Object.assign({}, invoice, { adjustments: [{
  id: "credit-1", number: "GS-2026-0002", type: "credit_note",
  createdAt: "2026-08-21T08:00:00Z", deltaGrossCents: -12425,
  documentGuid: adjustmentGuid,
  snapshot: { credit_tax_groups: [
    { tax_rate_bps: 700, net_cents: 5000, tax_cents: 350, gross_cents: 5350 },
    { tax_rate_bps: 1900, net_cents: 5945, tax_cents: 1130, gross_cents: 7075 }
  ] }
}] });
const creditExport = Core.buildDatevExport([creditInvoice], settings, "2026-08", new Date("2026-08-21T10:00:00Z"));
assert.deepStrictEqual(creditExport.errors, []);
assert.strictEqual(creditExport.bookings.length, 3);
assert.deepStrictEqual(creditExport.bookings.slice(1).map((booking) => [booking.amountCents, booking.side, booking.counterAccount]), [[5350, "H", "8300"], [7075, "H", "8400"]]);
const missingLink = Core.buildDatevExport([Object.assign({}, invoice, { documentGuid: "" })], settings, "2026-08", new Date(), { requireDocumentLinks: true });
assert.ok(missingLink.errors.some((message) => /nima veljavne DATEV povezave/.test(message)));
const manual = Core.buildDatevExport([Object.assign({}, invoice, { documentGuid: "", adjustments: [] })], settings, "2026-08", new Date());
assert.deepStrictEqual(manual.errors, []);
assert.strictEqual(Core.berlinDateKey("2026-08-31T22:30:00.000Z"), "2026-09-01");
const boundaryInvoice = Object.assign({}, invoice, {
  adjustments: [Object.assign({}, invoice.adjustments[0], { createdAt: "2026-08-31T22:30:00.000Z" })]
});
assert.strictEqual(Core.buildDatevExport([boundaryInvoice], settings, "2026-08", new Date()).bookings.length, 1);
assert.strictEqual(Core.buildDatevExport([boundaryInvoice], settings, "2026-09", new Date()).bookings.length, 1);

assert.strictEqual(handler._test.period("2026-02").end, "2026-02-28");
assert.strictEqual(handler._test.period("2028-02").end, "2028-02-29");
assert.deepStrictEqual(handler._test.berlinPeriodBounds(handler._test.period("2026-08")), {
  startUtc: "2026-07-31T22:00:00.000Z", endUtc: "2026-08-31T22:00:00.000Z"
});
assert.strictEqual(handler._test.berlinMonthKey("2026-08-31T22:30:00.000Z"), "2026-09");
assert.strictEqual(handler._test.berlinDate("2026-08-31T22:30:00.000Z"), "2026-09-01");
assert.strictEqual(handler._test.adjustmentLocal({ issued_at: "2026-08-31T22:30:00.000Z" }).createdAt, "2026-09-01");
assert.strictEqual(handler._test.safeFilename("RE/2026:1"), "RE_2026_1");
assert.match(migration, /create table public\.pos_datev_connections/i);
assert.match(migration, /create table public\.pos_datev_document_transfers/i);
assert.match(migration, /create table public\.pos_datev_transfer_jobs/i);
assert.match(migration, /alter table public\.pos_datev_connections enable row level security/i);
assert.match(migration, /grant all on table[\s\S]*to service_role/i);
assert.doesNotMatch(migration, /grant\s+(?:select|insert|update|delete|all)[^;]*to authenticated/i);
assert.match(migration, /unique \(user_id, request_id\)/i);
assert.match(migration, /where status in \('preparing','processing','succeeded'\)/i);
assert.ok(vercel.rewrites.some((entry) => entry.source === "/api/pos-datev" && /handler=datev/.test(entry.destination)));
assert.match(html, /data-datev-cloud/);
assert.match(html, /data-datev-connect/);
assert.match(html, /data-datev-transfer/);
assert.match(css, /\.pos-datev-cloud/);
assert.match(browserJs, /function transferDatevCloud\(/);
assert.match(browserJs, /mockTest \? "test-transfer" : "transfer"/);
assert.match(browserJs, /Preveri testni DATEV paket/);
assert.match(browserJs, /Mock uporabi samo račune TEST-\*/);
assert.match(browserJs, /connectedIdentifiers\.push\("Berater " \+ datevCloudCapability\.consultantNumber\)/);
assert.match(browserJs, /connectedIdentifiers\.push\("Mandant " \+ datevCloudCapability\.clientNumber\)/);
assert.match(browserJs, /latest\.status === "failed" && latest\.errorMessage \? " · " \+ String\(latest\.errorMessage\)/);
assert.match(handlerSource, /action === "transfer" \|\| action === "test-transfer"/);
assert.match(handlerSource, /is_test=eq\." \+ testFilter/);
assert.match(handlerSource, /issued_at=gte\." \+ encodeURIComponent\(bounds\.startUtc\)/);
assert.match(handlerSource, /berlinMonthKey\(row\.issued_at\) === selectedPeriod\.key/);
assert.match(handlerSource, /rowsForIds\(cfg, "pos_adjustment_documents", userId, "id", adjustmentDocumentIds/);
assert.match(handlerSource, /entry\.id === record\.adjustment_id/);
assert.doesNotMatch(handlerSource, /entry\.id === record\.source_id/);
assert.match(mockIsolationMigration, /user_id, period, environment/i);
assert.match(repeatableMockMigration, /environment <> 'mock'[\s\S]*preparing','processing','succeeded/i);
assert.match(repeatableMockMigration, /environment = 'mock'[\s\S]*preparing','processing'/i);
assert.doesNotMatch(repeatableMockMigration, /environment = 'mock'[\s\S]*preparing','processing','succeeded'/i);
assert.match(refreshLockMigration, /refresh_claim_id uuid/i);
assert.match(refreshLockMigration, /refresh_claimed_at < now\(\) - interval '2 minutes'/i);
assert.match(refreshLockMigration, /security definer[\s\S]*set search_path = ''/i);
assert.match(refreshLockMigration, /revoke all on function public\.claim_pos_datev_refresh\(uuid, text, uuid\) from public, anon, authenticated/i);
assert.match(refreshLockMigration, /grant execute on function public\.claim_pos_datev_refresh\(uuid, text, uuid\) to service_role/i);
assert.match(documentScopeMigration, /add column environment text/i);
assert.match(documentScopeMigration, /add column datev_client_id text/i);
assert.match(documentScopeMigration, /unique \(user_id, archive_record_id, environment, datev_client_id\)/i);
assert.match(documentScopeMigration, /unique \(user_id, request_id, environment, datev_client_id\)/i);
assert.match(documentScopeMigration, /pos_datev_transfer_jobs\(user_id, period, environment, datev_client_id\)/i);
assert.match(handlerSource, /documentTransfer\(db, userId, record, datevCfg\.mode, client\.id\)/);
assert.match(handlerSource, /createJob\(db, userId, requestId, selectedPeriod, datevCfg\.mode, connection\.datev_client_id/);
assert.match(handlerSource, /request_id=eq\." \+ encodeURIComponent\(requestId\)/);
assert.match(handlerSource, /environment=eq\." \+ encodeURIComponent\(mode\)/);
assert.match(handlerSource, /user_id=eq\." \+ encodeURIComponent\(userId\) \+ "&id=eq\." \+ encodeURIComponent\(id\)/);
assert.match(handlerSource, /rpc\/claim_pos_datev_refresh/);
assert.match(handlerSource, /refresh_claim_id=eq\." \+ encodeURIComponent\(claimId\)/);
assert.match(handlerSource, /if \(!rotatedRefresh\) throw new datev\.DatevError/);
assert.doesNotMatch(handlerSource, /tokens\.refresh_token \|\| refresh/);
assert.ok(handlerSource.indexOf("Core.buildDatevExport(pack.invoices") < handlerSource.indexOf("await datev.uploadDocument"), "EXTF preflight mora biti pred prvim DATEV dokumentnim uploadom.");
assert.match(handlerSource, /repeatableMock \? "preparing,processing" : "preparing,processing,succeeded"/);
assert.match(browserJs, /authorizationUrl\.hostname !== "login\.datev\.de"/);
assert.match(browserJs, /Mock uporabi samo račune TEST-\*/);
assert.match(browserJs, /saveButton\.textContent = "Shranjujem …"/);
assert.match(browserJs, /showToast\("DATEV nastavitve shranjujem …"\)/);
assert.match(css, /\.pos-toast[\s\S]*?z-index:\s*2147483600/);
assert.match(localServer, /posDatevModul = require\.resolve\("\.\.\/api\/_handlers\/pos-datev"\)/);
assert.match(localServer, /pathname === "\/api\/pos-datev"/);
assert.match(datevSettingsValidationMigration, /octet_length\(p_settings::text\) > 16384/i);
assert.match(datevSettingsValidationMigration, /adviserNumber[\s\S]*\^\[0-9\]\{0,7\}\$/i);
assert.match(datevSettingsValidationMigration, /clientNumber[\s\S]*\^\[0-9\]\{0,5\}\$/i);
assert.match(datevSettingsValidationMigration, /pos_business_profiles_datev_settings_values_check[\s\S]*validate constraint pos_business_profiles_datev_settings_values_check/i);
assert.match(datevSettingsValidationMigration, /immutable[\s\S]*set search_path = ''/i);
assert.match(datevSettingsValidationMigration, /grant execute on function private\.pos_datev_settings_valid\(jsonb\) to authenticated, service_role/i);
assert.match(datevProviderBoundsMigration, /octet_length\(access_token_encrypted\) <= 16384/i);
assert.match(datevProviderBoundsMigration, /octet_length\(refresh_token_encrypted\) <= 16384/i);
assert.match(localServer, /else void posredujZascitenApi\(req, res, requestUrl\.pathname \+ requestUrl\.search\)/);
assert.match(localServer, /pathname === "\/__dev-source"/);

assert.deepStrictEqual(handler._test.chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
const pollNow = Date.parse("2026-08-28T12:00:00.000Z");
assert.strictEqual(handler._test.jobPollState({ created_at: "2026-08-28T11:59:00.000Z", updated_at: "2026-08-28T11:59:58.000Z", retry_after_seconds: 5 }, pollNow), "wait");
assert.strictEqual(handler._test.jobPollState({ created_at: "2026-08-28T11:59:00.000Z", updated_at: "2026-08-28T11:59:50.000Z", retry_after_seconds: 5 }, pollNow), "poll");
assert.strictEqual(handler._test.jobPollState({ created_at: "2026-08-28T11:30:00.000Z", updated_at: "2026-08-28T11:59:59.000Z", retry_after_seconds: 5 }, pollNow), "expired");
assert.deepStrictEqual(handler._test.pollFailureChanges({ code: "DATEV_NETWORK_FAILED", message: "temporary", retryable: true }, pollNow), {
  retry_after_seconds: 30, error_code: "DATEV_NETWORK_FAILED", error_message: "temporary",
});
assert.deepStrictEqual(handler._test.pollFailureChanges({ code: "DATEV_HTTP_404", message: "terminal" }, pollNow), {
  status: "failed", completed_at: "2026-08-28T12:00:00.000Z", retry_after_seconds: 0,
  error_code: "DATEV_HTTP_404", error_message: "terminal",
});
assert.doesNotMatch(handler._test.periodPackage.toString(), /&limit=(?:500|1000|1500)/);
assert.match(handler._test.periodPackage.toString(), /pagedRows\(cfg, "pos_invoices"/);
assert.match(handler._test.periodPackage.toString(), /rowsForIds\(cfg, "pos_archive_records"/);
const scopedArchiveRecords = handler._test.recordsForPeriod([
  { id: "archive-invoice", source_table: "pos_invoice_documents", source_id: "invoice-document-1", invoice_id: "invoice-1" },
  { id: "archive-adjustment", source_table: "pos_adjustment_documents", source_id: "adjustment-document-1", invoice_id: "invoice-1" },
  { id: "archive-old-adjustment", source_table: "pos_adjustment_documents", source_id: "adjustment-document-old", invoice_id: "invoice-1" },
], [
  { id: "adjustment-document-1", adjustment_id: "adjustment-1" },
  { id: "adjustment-document-old", adjustment_id: "adjustment-old" },
], new Set(["invoice-1"]), new Set(["adjustment-1"]));
assert.deepStrictEqual(scopedArchiveRecords.map(function (record) { return [record.id, record.adjustment_id || null]; }), [
  ["archive-invoice", null], ["archive-adjustment", "adjustment-1"],
]);

void (async function verifyDatevPagination() {
  const supabase = require(path.join(root, "api", "_lib", "supabase-server.js"));
  const originalRead = supabase.pridobiVrstice;
  const originalFetch = supabase.fetchZOmejitvijo;
  const source = Array.from({ length: 1205 }, function (_, index) { return { id: index + 1 }; });
  const offsets = [];
  supabase.pridobiVrstice = async function (_, table, query) {
    assert.strictEqual(table, "datev_test_rows");
    const params = new URLSearchParams(query);
    const limit = Number(params.get("limit"));
    const offset = Number(params.get("offset"));
    offsets.push(offset);
    return source.slice(offset, offset + limit);
  };
  try {
    const normalResponse = new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
    assert.deepStrictEqual(await datev._test.responseData(normalResponse), { ok: true });
    await assert.rejects(
      () => datev._test.responseData(new Response("{}", {
        headers: { "content-type": "application/json", "content-length": String(datev._test.MAX_RESPONSE_BYTES + 1) },
      })),
      /odgovor je prevelik/i
    );
    assert.throws(() => datev.encryptSecret(cfg, "x".repeat(8193)), /žeton je prevelik/i);
    const jose = await import("jose");
    const keyPair = await jose.generateKeyPair("ES256");
    const publicJwk = await jose.exportJWK(keyPair.publicKey);
    publicJwk.kid = "datev-test-key";
    const oidcNonce = "nonce-for-datev-test-123456";
    const idToken = await new jose.SignJWT({ nonce: oidcNonce })
      .setProtectedHeader({ alg: "ES256", kid: publicJwk.kid })
      .setIssuer(datev.urls(cfg.mode).issuer)
      .setAudience(cfg.clientId)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(keyPair.privateKey);
    supabase.fetchZOmejitvijo = async function (url) {
      const data = String(url).includes(".well-known")
        ? { issuer: datev.urls(cfg.mode).issuer, jwks_uri: datev.urls(cfg.mode).issuer + "/jwks" }
        : { keys: [publicJwk] };
      return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    };
    assert.strictEqual((await datev.validateIdToken(cfg, idToken, oidcNonce)).nonce, oidcNonce);
    await assert.rejects(
      () => datev.validateIdToken(cfg, idToken, "drug-nonce-123456789012"),
      function (error) { return error && error.code === "DATEV_ID_TOKEN_INVALID" && error.status === 401; }
    );
    supabase.fetchZOmejitvijo = async function () {
      return new Response(JSON.stringify({
        id: "29098-55004", consultant_number: 29098, client_number: 55004,
        services: [{ name: "Buchungsdatenservice", scopes: ["datev:accounting:extf-files-import"] }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    await assert.rejects(
      () => datev.getClient(cfg, "token", "29098", "55003"),
      function (error) { return error && error.code === "DATEV_PERMISSION_MISSING" && error.status === 403; }
    );
    supabase.fetchZOmejitvijo = async function () {
      return new Response(JSON.stringify({ status: "processing" }), {
        status: 202,
        headers: {
          "content-type": "application/json", "retry-after": "999",
          location: "https://accounting-extf-files.api.datev.de/platform-sandbox/v3/clients/29098-55003/jobs/job-1",
        },
      });
    };
    const upload = await datev.uploadExtf(cfg, "token", "29098-55003", {
      filename: "EXTF.csv", content: "EXTF", referenceId: "request-1",
    });
    assert.strictEqual(upload.retryAfter, 300);
    assert.strictEqual(upload.jobId, "job-1");
    await assert.rejects(
      () => handler._test.archiveContent({ url: "https://database.example" }, {
        storage_bucket: "pos-invoice-originals", storage_path: "user/invoice/rechnung.pdf",
        original_media_type: "application/pdf", byte_size: handler._test.MAX_ARCHIVE_DOCUMENT_BYTES + 1,
      }),
      function (error) { return error && error.code === "DATEV_ARCHIVE_TOO_LARGE" && error.status === 409; }
    );
    supabase.fetchZOmejitvijo = async function () {
      return new Response("PDF", { status: 200, headers: { "content-length": String(handler._test.MAX_ARCHIVE_DOCUMENT_BYTES + 1) } });
    };
    await assert.rejects(
      () => handler._test.archiveContent({ url: "https://database.example", serviceKey: "test" }, {
        storage_bucket: "pos-invoice-originals", storage_path: "user/invoice/rechnung.pdf",
        original_media_type: "application/pdf", byte_size: 3, sha256: "unused",
      }),
      function (error) { return error && error.code === "DATEV_ARCHIVE_TOO_LARGE" && error.status === 409; }
    );
    supabase.fetchZOmejitvijo = originalFetch;

    const transferRows = [];
    const paginationRead = supabase.pridobiVrstice;
    supabase.pridobiVrstice = async function (_, table, query) {
      assert.strictEqual(table, "pos_datev_document_transfers");
      const params = new URLSearchParams(query);
      const filterValue = function (name) { return String(params.get(name) || "").replace(/^eq\./, ""); };
      return transferRows.filter(function (row) {
        return row.user_id === filterValue("user_id") && row.archive_record_id === filterValue("archive_record_id") &&
          row.environment === filterValue("environment") && row.datev_client_id === filterValue("datev_client_id");
      });
    };
    supabase.fetchZOmejitvijo = async function (_, options) {
      const body = JSON.parse(options.body);
      const row = Object.assign({ id: "transfer-" + (transferRows.length + 1) }, body);
      transferRows.push(row);
      return new Response(JSON.stringify([row]), { status: 201, headers: { "content-type": "application/json" } });
    };
    const archiveRecord = { id: "archive-record-1" };
    const mockTransfer = await handler._test.documentTransfer({ url: "https://database.example" }, "user-1", archiveRecord, "mock", "29098-55003");
    const sandboxTransfer = await handler._test.documentTransfer({ url: "https://database.example" }, "user-1", archiveRecord, "sandbox", "29098-55003");
    const otherClientTransfer = await handler._test.documentTransfer({ url: "https://database.example" }, "user-1", archiveRecord, "sandbox", "29098-55004");
    const repeatedSandboxTransfer = await handler._test.documentTransfer({ url: "https://database.example" }, "user-1", archiveRecord, "sandbox", "29098-55003");
    assert.deepStrictEqual([mockTransfer.id, sandboxTransfer.id, otherClientTransfer.id, repeatedSandboxTransfer.id],
      ["transfer-1", "transfer-2", "transfer-3", "transfer-2"]);
    assert.strictEqual(transferRows.length, 3, "DATEV PDF idempotency mora biti izoliran po okolju in mandantu.");

    const jobRows = [];
    supabase.pridobiVrstice = async function (_, table, query) {
      assert.strictEqual(table, "pos_datev_transfer_jobs");
      const params = new URLSearchParams(query);
      const filterValue = function (name) { return String(params.get(name) || "").replace(/^eq\./, ""); };
      return jobRows.filter(function (row) {
        return (!params.has("user_id") || row.user_id === filterValue("user_id")) &&
          (!params.has("request_id") || row.request_id === filterValue("request_id")) &&
          (!params.has("environment") || row.environment === filterValue("environment")) &&
          (!params.has("datev_client_id") || row.datev_client_id === filterValue("datev_client_id"));
      });
    };
    supabase.fetchZOmejitvijo = async function (_, options) {
      const body = JSON.parse(options.body);
      const duplicate = jobRows.some(function (row) {
        return row.user_id === body.user_id && row.request_id === body.request_id &&
          row.environment === body.environment && row.datev_client_id === body.datev_client_id;
      });
      if (duplicate) return new Response(JSON.stringify({ code: "23505" }), { status: 409, headers: { "content-type": "application/json" } });
      const row = Object.assign({ id: "job-" + (jobRows.length + 1) }, body);
      jobRows.push(row);
      return new Response(JSON.stringify([row]), { status: 201, headers: { "content-type": "application/json" } });
    };
    const requestId = "11111111-1111-4111-8111-111111111111";
    const selectedPeriod = handler._test.period("2026-08");
    const firstClientJob = await handler._test.createJob({ url: "https://database.example" }, "user-1", requestId, selectedPeriod, "sandbox", "29098-55003");
    const secondClientJob = await handler._test.createJob({ url: "https://database.example" }, "user-1", requestId, selectedPeriod, "sandbox", "29098-55004");
    const repeatedFirstClientJob = await handler._test.createJob({ url: "https://database.example" }, "user-1", requestId, selectedPeriod, "sandbox", "29098-55003");
    assert.deepStrictEqual([firstClientJob.id, secondClientJob.id, repeatedFirstClientJob.id], ["job-1", "job-2", "job-1"]);
    assert.strictEqual(jobRows.length, 2, "DATEV EXTF opravilo mora biti izolirano po mandantu.");
    supabase.pridobiVrstice = paginationRead;
    supabase.fetchZOmejitvijo = originalFetch;

    const all = await handler._test.pagedRows({}, "datev_test_rows", "select=id&order=id.asc", 500);
    assert.strictEqual(all.length, 1205);
    assert.deepStrictEqual(offsets, [0, 500, 1000]);
    assert.strictEqual(all[1204].id, 1205);

    const requestedGroups = [];
    supabase.pridobiVrstice = async function (_, table, query) {
      assert.strictEqual(table, "datev_id_rows");
      const params = new URLSearchParams(query);
      requestedGroups.push(params.get("invoice_id").slice(4, -1).split(","));
      return [];
    };
    await handler._test.rowsForIds({}, "datev_id_rows", "user-1", "invoice_id",
      Array.from({ length: 205 }, function (_, index) { return "invoice-" + index; }), "&select=id&order=id.asc");
    assert.deepStrictEqual(requestedGroups.map(function (group) { return group.length; }), [100, 100, 5]);
  } finally {
    supabase.pridobiVrstice = originalRead;
    supabase.fetchZOmejitvijo = originalFetch;
  }
  console.log("POS DATEV mock, OAuth zaščita, PDF povezave, celotno obdobje in RLS so preverjeni.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
