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
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821123000_pos_datev_cloud_integration.sql"), "utf8");
const mockIsolationMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821124125_datev_mock_job_isolation.sql"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

const cfg = datev.configuration({ DATEV_MODE: "mock" });
assert.strictEqual(cfg.mode, "mock");
assert.throws(() => datev.configuration({ DATEV_MODE: "sandbox" }), /nastavitve še niso izdane/i);
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
const missingLink = Core.buildDatevExport([Object.assign({}, invoice, { documentGuid: "" })], settings, "2026-08", new Date(), { requireDocumentLinks: true });
assert.ok(missingLink.errors.some((message) => /nima veljavne DATEV povezave/.test(message)));
const manual = Core.buildDatevExport([Object.assign({}, invoice, { documentGuid: "", adjustments: [] })], settings, "2026-08", new Date());
assert.deepStrictEqual(manual.errors, []);

assert.strictEqual(handler._test.period("2026-02").end, "2026-02-28");
assert.strictEqual(handler._test.period("2028-02").end, "2028-02-29");
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
assert.match(mockIsolationMigration, /user_id, period, environment/i);
assert.match(browserJs, /authorizationUrl\.hostname !== "login\.datev\.de"/);
assert.match(browserJs, /Mock uporabi samo račune TEST-\*/);
assert.match(browserJs, /saveButton\.textContent = "Shranjujem …"/);
assert.match(browserJs, /showToast\("DATEV nastavitve shranjujem …"\)/);
assert.match(css, /\.pos-toast[\s\S]*?z-index:\s*2147483600/);
assert.match(localServer, /posDatevModul = require\.resolve\("\.\.\/api\/_handlers\/pos-datev"\)/);
assert.match(localServer, /pathname === "\/api\/pos-datev"/);
assert.match(localServer, /else void posredujZascitenApi\(req, res, requestUrl\.pathname \+ requestUrl\.search\)/);
assert.match(localServer, /pathname === "\/__dev-source"/);

console.log("POS DATEV mock, OAuth zaščita, PDF povezave in RLS so preverjeni.");
