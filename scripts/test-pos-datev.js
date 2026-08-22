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
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

const cfg = datev.configuration({ DATEV_MODE: "mock" });
assert.strictEqual(cfg.mode, "mock");
assert.throws(() => datev.configuration({ DATEV_MODE: "sandbox" }), /nastavitve še niso izdane/i);
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
assert.strictEqual(authUrl.hostname, "login.datev.de");
assert.strictEqual(authUrl.searchParams.get("code_challenge_method"), "S256");
assert.ok(authUrl.searchParams.get("code_challenge"));
assert.ok(authUrl.searchParams.get("nonce"));
assert.strictEqual(authUrl.searchParams.get("enableWindowsSso"), "true");
assert.match(authUrl.searchParams.get("scope"), /accounting:documents/);
assert.strictEqual(datev.normalizedClientId("29098", "55003"), "29098-55003");
assert.strictEqual(datev.hasBuchungsdatenservice(datev.mockClient("29098", "55003")), true);
assert.strictEqual(datev.supportsDocumentExtension({ allowed_file_extensions: ["jpg", "PDF"] }, ".pdf"), true);
assert.throws(() => datev.safeJobUrl(cfg, "https://example.com/job/1"), /neveljavno povezavo/i);

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
assert.match(handlerSource, /action === "transfer" \|\| action === "test-transfer"/);
assert.match(handlerSource, /is_test=eq\." \+ testFilter/);
assert.match(handlerSource, /issued_at=gte\." \+ encodeURIComponent\(bounds\.startUtc\)/);
assert.match(handlerSource, /berlinMonthKey\(row\.issued_at\) === selectedPeriod\.key/);
assert.match(mockIsolationMigration, /user_id, period, environment/i);
assert.match(repeatableMockMigration, /environment <> 'mock'[\s\S]*preparing','processing','succeeded/i);
assert.match(repeatableMockMigration, /environment = 'mock'[\s\S]*preparing','processing'/i);
assert.doesNotMatch(repeatableMockMigration, /environment = 'mock'[\s\S]*preparing','processing','succeeded'/i);
assert.match(handlerSource, /request_id=eq\." \+ encodeURIComponent\(requestId\)/);
assert.match(handlerSource, /environment=eq\." \+ encodeURIComponent\(mode\)/);
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
assert.doesNotMatch(handler._test.periodPackage.toString(), /&limit=(?:500|1000|1500)/);
assert.match(handler._test.periodPackage.toString(), /pagedRows\(cfg, "pos_invoices"/);
assert.match(handler._test.periodPackage.toString(), /rowsForIds\(cfg, "pos_archive_records"/);

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
