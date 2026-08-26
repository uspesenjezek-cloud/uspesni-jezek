"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PDFDocument } = require("pdf-lib");
const generator = require("../api/_lib/pos-procedure-documentation-pdf");
const handler = require("../api/_handlers/pos-verfahrensdokumentation-pdf");
const supabase = require("../api/_lib/supabase-server");

const root = path.resolve(__dirname, "..");

async function run() {
  assert.equal(generator.GENERATOR_VERSION, "uj-pos-verfahrensdokumentation-1");
  assert.equal(handler._test.safeFilename("Müller & Söhne GmbH"), "Mu-ller-So-hne-GmbH");
  assert.equal(handler._test.uuid("22222222-2222-4222-8222-222222222222"), "22222222-2222-4222-8222-222222222222");
  assert.equal(handler._test.uuid("not-a-version"), "");
  assert.equal(handler._test.stableJson({ z: 1, a: { y: 2, x: 3 } }), '{"a":{"x":3,"y":2},"z":1}');
  const input = {
    generatedAt: "2026-08-23T10:00:00.000Z",
    environment: "production",
    profile: {
      legal_name: "Müller & Söhne GmbH", legal_form: "GmbH", representative: "Maximilian Müller",
      street: "Handwerkerstraße 123", postal_code: "10115", city: "Berlin", vat_id: "DE123456789",
      tax_status: "standard", previous_year_turnover_band: "lte_800k"
    },
    archive: {
      retentionYears: 8, documentCount: 42, verifiedCount: 42, failureCount: 0,
      independentBackupReady: true, productionReady: true, wormProvider: "aws_s3_object_lock",
      objectLockMode: "COMPLIANCE", recoveryTestedAt: "2026-08-20T12:00:00Z"
    }
  };
  const model = generator.documentModel(input);
  assert.equal(model.environment, "Produktion");
  assert.equal(model.archive.retentionYears, 8);
  assert.equal(model.profile.turnoverBand, "bis 800.000 EUR");
  const fingerprintModel = {
    profile: input.profile, archive: input.archive, environment: input.environment,
    appVersion: generator.GENERATOR_VERSION
  };
  const fingerprint = handler._test.sourceFingerprint(fingerprintModel);
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(handler._test.objectPath("123", fingerprint), "123/" + fingerprint + ".pdf");
  const buffer = await generator.createProcedureDocumentationPdf(input);
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
  assert.ok(buffer.length > 30000 && buffer.length < 2000000);
  const pdf = await PDFDocument.load(buffer);
  assert.ok(pdf.getPageCount() >= 4, "Verfahrensdokumentation mora imeti najmanj štiri strani.");
  assert.match(pdf.getTitle(), /Verfahrensdokumentation/);
  assert.equal(pdf.getCreator(), generator.GENERATOR_VERSION);

  if (process.env.POS_WRITE_PDF_ARTIFACT === "1") {
    const outputDir = path.join(root, "output", "pdf");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "pos-verfahrensdokumentation-muster.pdf"), buffer);
  }

  const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");
  const localServer = fs.readFileSync(path.join(root, "scripts", "local-server.js"), "utf8");
  const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260823112822_pos_procedure_document_versions.sql"), "utf8");
  const rpcHardeningMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260823114342_pos_procedure_document_rpc_invoker.sql"), "utf8");
  assert.match(html, /data-procedure-documentation/);
  assert.match(js, /posFetch\("\/api\/pos-verfahrensdokumentation-pdf"[\s\S]*Authorization: "Bearer " \+ token/);
  assert.match(js, /mode=list/);
  assert.match(js, /data-procedure-version-id/);
  assert.match(html, /data-procedure-versions/);
  assert.match(localServer, /pathname === "\/api\/pos-verfahrensdokumentation-pdf"/);
  assert.match(js, /X-UJ-Document-Version/);
  assert.match(migration, /create table public\.pos_procedure_document_versions/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /for select to authenticated[\s\S]*\(select auth\.uid\(\)\) = user_id/);
  assert.match(migration, /pos_procedure_document_versions_immutable/);
  assert.match(migration, /values \('pos-procedure-documents', 'pos-procedure-documents', false/);
  assert.match(migration, /retention_years smallint not null default 10/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /revoke all on function public\.pos_archive_procedure_document_version[\s\S]*from public, anon, authenticated/);
  assert.match(rpcHardeningMigration, /security invoker/);
  assert.doesNotMatch(rpcHardeningMigration, /auth\.role\(\)/);
  assert.match(rpcHardeningMigration, /revoke all on function public\.pos_archive_procedure_document_version[\s\S]*from public, anon, authenticated/);
  const handlerSource = fs.readFileSync(path.join(root, "api", "_handlers", "pos-verfahrensdokumentation-pdf.js"), "utf8");
  assert.match(handlerSource, /"x-upsert": "false"/);
  assert.match(handlerSource, /X-UJ-Document-SHA256/);
  assert.match(handlerSource, /mode \|\| ""\) === "list"/);
  assert.match(handlerSource, /"id=eq\."/);

  const originals = {
    pridobiVrstice: supabase.pridobiVrstice,
    pokliciRpc: supabase.pokliciRpc,
    fetchZOmejitvijo: supabase.fetchZOmejitvijo
  };
  let storedVersion = null;
  let storedPdf = null;
  let uploadCount = 0;
  let rpcCount = 0;
  const userId = "11111111-1111-4111-8111-111111111111";
  try {
    supabase.pridobiVrstice = async function (cfg, table) {
      assert.equal(table, "pos_procedure_document_versions");
      return storedVersion ? [storedVersion] : [];
    };
    supabase.fetchZOmejitvijo = async function (url, options) {
      if (options && options.method === "POST") {
        uploadCount += 1;
        storedPdf = Buffer.from(options.body);
        return new Response("", { status: 200 });
      }
      return storedPdf
        ? new Response(storedPdf, { status: 200, headers: { "Content-Type": "application/pdf", "Content-Length": String(storedPdf.length) } })
        : new Response("", { status: 404 });
    };
    supabase.pokliciRpc = async function (cfg, name, body) {
      rpcCount += 1;
      assert.equal(name, "pos_archive_procedure_document_version");
      assert.equal(body.p_user_id, userId);
      assert.match(body.p_source_fingerprint, /^[0-9a-f]{64}$/);
      assert.equal(body.p_sha256, handler._test.sha256(storedPdf));
      storedVersion = {
        id: "22222222-2222-4222-8222-222222222222", user_id: userId, version_number: 1,
        source_fingerprint: body.p_source_fingerprint, storage_path: body.p_storage_path,
        sha256: body.p_sha256, byte_size: body.p_byte_size,
        retention_not_before: "2036-12-31"
      };
      return storedVersion;
    };
    const archived = await handler._test.ensureVersion({ url: "https://example.supabase.co", serviceKey: "test" }, userId, input);
    assert.equal(archived.version.version_number, 1);
    assert.equal(handler._test.sha256(archived.pdf), storedVersion.sha256);
    assert.equal(uploadCount, 1);
    assert.equal(rpcCount, 1);
    const reused = await handler._test.ensureVersion({ url: "https://example.supabase.co", serviceKey: "test" }, userId, input);
    assert.equal(reused.version.id, storedVersion.id);
    assert.equal(uploadCount, 1, "Ista vsebina ne sme ustvariti novega objekta.");
    assert.equal(rpcCount, 1, "Ista vsebina ne sme ustvariti nove različice.");
  } finally {
    supabase.pridobiVrstice = originals.pridobiVrstice;
    supabase.pokliciRpc = originals.pokliciRpc;
    supabase.fetchZOmejitvijo = originals.fetchZOmejitvijo;
  }
  console.log("POS GoBD Verfahrensdokumentation PDF tests passed.");
}

run().catch(function (error) { console.error(error); process.exit(1); });
