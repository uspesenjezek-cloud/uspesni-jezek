"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const generator = require(path.join(repoRoot, "api", "_lib", "pos-xrechnung"));
const adjustmentGenerator = require(path.join(repoRoot, "api", "_lib", "pos-adjustment-xrechnung"));
const providerJson = require(path.join(repoRoot, "api", "_lib", "provider-json"));
const xrechnungHandler = require(path.join(repoRoot, "api", "pos-racun-xrechnung"))._test;
const api = fs.readFileSync(path.join(repoRoot, "api", "_handlers", "pos-racun-xrechnung.js"), "utf8");
const adjustmentApi = fs.readFileSync(path.join(repoRoot, "api", "_handlers", "pos-racun-korekcija-xrechnung.js"), "utf8");
const migration = fs.readFileSync(path.join(repoRoot, "supabase", "migrations", "20260819151900_pos_xrechnung_documents.sql"), "utf8");
const adjustmentMigrationName = fs.readdirSync(path.join(repoRoot, "supabase", "migrations"))
  .filter((name) => /pos_adjustment_xrechnung_documents\.sql$/.test(name)).sort().pop();
assert.ok(adjustmentMigrationName, "Manjka migracija strukturiranih popravkov.");
const adjustmentMigration = fs.readFileSync(path.join(repoRoot, "supabase", "migrations", adjustmentMigrationName), "utf8");
const dockerfile = fs.readFileSync(path.join(repoRoot, "services", "kosit-validator", "Dockerfile.vercel"), "utf8");
const proxy = fs.readFileSync(path.join(repoRoot, "services", "kosit-validator", "proxy.go"), "utf8");
const startup = fs.readFileSync(path.join(repoRoot, "services", "kosit-validator", "start.sh"), "utf8");
const terminalHtml = fs.readFileSync(path.join(repoRoot, "app", "pos-terminal.html"), "utf8");
const terminalJs = fs.readFileSync(path.join(repoRoot, "app", "pos-terminal.js"), "utf8");
const posRouter = fs.readFileSync(path.join(repoRoot, "api", "pos.js"), "utf8");
const vercel = fs.readFileSync(path.join(repoRoot, "vercel.json"), "utf8");
const localServer = fs.readFileSync(path.join(repoRoot, "scripts", "local-server.js"), "utf8");

function invoice(overrides) {
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    invoice_number: "RE-2026-0042", issue_date: "2026-08-19", service_date: "2026-08-18", due_date: "2026-09-02",
    customer_type: "business", tax_mode: "regular", net_cents: 20000, tax_cents: 3800, gross_cents: 23800,
    snapshot: {
      seller: {
        legalName: "Muster Handwerk GmbH", legalForm: "GmbH", representative: "Mara Muster",
        companySeat: "Berlin", registerCourt: "Amtsgericht Charlottenburg", registerNumber: "HRB 12345 B",
        street: "Musterstraße 1", postalCode: "10115", city: "Berlin", businessEmail: "rechnung@muster-handwerk.de",
        taxNumber: "12/345/67890", vatId: "DE123456789", accountHolder: "Muster Handwerk GmbH", iban: "DE02120300000000202051"
      },
      draft: {
        customer_type: "business", customer_name: "Kunde Bau GmbH", customer_street: "Baustraße 5",
        customer_postal_code: "20095", customer_city: "Hamburg", customer_email: "rechnung@kunde-bau.de",
        customer_contact: "Kai Kunde", buyer_reference: "PO-8842", seller_contact_phone: "+49 30 1234567", issue_date: "2026-08-19", service_date: "2026-08-18",
        tax_mode: "regular", items: [{ description: "Elektroinstallation", quantity_milli: 2000, unit: "Std.", unit_price_cents: 10000, tax_rate_bps: 1900, net_cents: 20000, tax_cents: 3800, gross_cents: 23800 }]
      }
    }
  };
  return Object.assign(base, overrides || {});
}

const xml = generator.buildXRechnung(invoice()).toString("utf8");
assert.match(xml, /<cbc:CustomizationID>urn:cen\.eu:en16931:2017#compliant#urn:xeinkauf\.de:kosit:xrechnung_3\.0<\/cbc:CustomizationID>/);
assert.match(xml, /<cbc:ProfileID>urn:fdc:peppol\.eu:2017:poacc:billing:01:1\.0<\/cbc:ProfileID>/);
assert.match(xml, /<cbc:BuyerReference>PO-8842<\/cbc:BuyerReference>/);
assert.match(xml, /<cbc:EndpointID schemeID="EM">rechnung@kunde-bau\.de<\/cbc:EndpointID>/);
assert.match(xml, /<cbc:Telephone>\+49 30 1234567<\/cbc:Telephone>/);
assert.match(xml, /<cbc:CompanyID>HRB 12345 B<\/cbc:CompanyID>/);
assert.match(xml, /<cbc:CompanyLegalForm>GmbH; Sitz: Berlin; Registergericht: Amtsgericht Charlottenburg<\/cbc:CompanyLegalForm>/);
assert.throws(() => generator.buildXRechnung(invoice({
  snapshot: {
    seller: Object.assign({}, invoice().snapshot.seller, { registerNumber: "" }),
    draft: invoice().snapshot.draft
  }
})), /registrirano pravno obliko/);
assert.match(xml, /<cbc:PaymentMeansCode name="SEPA-Überweisung">58<\/cbc:PaymentMeansCode>/);
assert.match(xml, /<cbc:TaxAmount currencyID="EUR">38\.00<\/cbc:TaxAmount>/);
assert.match(xml, /<cbc:PayableAmount currencyID="EUR">238\.00<\/cbc:PayableAmount>/);
assert.match(xml, /<cbc:PriceAmount currencyID="EUR">100\.0000<\/cbc:PriceAmount>/);
assert.doesNotMatch(xml, /example\.invalid|>NA</);

const publicInvoice = invoice({
  customer_type: "public", tax_mode: "small_business", net_cents: 15000, tax_cents: 0, gross_cents: 15000,
  snapshot: {
    seller: Object.assign({}, invoice().snapshot.seller, { vatId: "", taxStatus: "small_business" }),
    draft: Object.assign({}, invoice().snapshot.draft, {
      customer_type: "public", customer_name: "Bundesbehörde Beispiel", customer_email: "",
      leitweg_id: "991-12345-06", buyer_reference: "991-12345-06", tax_mode: "small_business",
      items: [{ description: "Wartungsleistung", quantity_milli: 1000, unit: "Stk.", unit_price_cents: 15000, tax_rate_bps: 0, net_cents: 15000, tax_cents: 0, gross_cents: 15000 }]
    })
  }
});
const publicXml = generator.buildXRechnung(publicInvoice).toString("utf8");
assert.match(publicXml, /<cbc:EndpointID schemeID="0204">991-12345-06<\/cbc:EndpointID>/);
assert.match(publicXml, /<cbc:ID>E<\/cbc:ID><cbc:Percent>0<\/cbc:Percent>/);
assert.match(publicXml, /Steuerbefreiung für Kleinunternehmer gemäß § 19 UStG\./);
assert.match(publicXml, /<cbc:ID>FC<\/cbc:ID>/);

const reverseInvoice = invoice({
  tax_mode: "reverse_charge", net_cents: 20000, tax_cents: 0, gross_cents: 20000,
  snapshot: {
    seller: invoice().snapshot.seller,
    draft: Object.assign({}, invoice().snapshot.draft, {
      tax_mode: "reverse_charge", customer_vat_id: "DE987654321",
      items: [{ description: "Bauleistung", quantity_milli: 2000, unit: "Std.", unit_price_cents: 10000, tax_rate_bps: 0, net_cents: 20000, tax_cents: 0, gross_cents: 20000 }]
    })
  }
});
const reverseXml = generator.buildXRechnung(reverseInvoice).toString("utf8");
assert.match(reverseXml, /<cbc:ID>AE<\/cbc:ID>/);
assert.match(reverseXml, /<cbc:TaxExemptionReasonCode>VATEX-EU-AE<\/cbc:TaxExemptionReasonCode>/);

const alreadyPaidInvoice = invoice({
  snapshot: {
    seller: invoice().snapshot.seller,
    draft: Object.assign({}, invoice().snapshot.draft, { payment_method: "already_paid" })
  }
});
const alreadyPaidXml = generator.buildXRechnung(alreadyPaidInvoice).toString("utf8");
assert.match(alreadyPaidXml, /<cbc:PaymentMeansCode name="Bereits bezahlt">1<\/cbc:PaymentMeansCode>/);
assert.match(alreadyPaidXml, /<cbc:PrepaidAmount currencyID="EUR">238\.00<\/cbc:PrepaidAmount>/);
assert.match(alreadyPaidXml, /<cbc:PayableAmount currencyID="EUR">0\.00<\/cbc:PayableAmount>/);
assert.doesNotMatch(alreadyPaidXml, /<cac:PayeeFinancialAccount>/);

const finalInvoice = invoice({
  net_cents: 15000, tax_cents: 2850, gross_cents: 17850,
  snapshot: {
    seller: invoice().snapshot.seller,
    draft: Object.assign({}, invoice().snapshot.draft, {
      workflow_context: {
        work_order_id: "33333333-3333-4333-8333-333333333333",
        invoice_kind: "final",
        final_deductions: [{
          invoice_id: "22222222-2222-4222-8222-222222222222", invoice_number: "RE-2026-0039", issue_date: "2026-07-15",
          net_cents: 5000, tax_cents: 950, gross_cents: 5950
        }]
      }
    })
  }
});
const finalXml = generator.buildXRechnung(finalInvoice).toString("utf8");
assert.match(finalXml, /<cbc:TaxInclusiveAmount currencyID="EUR">238\.00<\/cbc:TaxInclusiveAmount>/);
assert.match(finalXml, /<cbc:PrepaidAmount currencyID="EUR">59\.50<\/cbc:PrepaidAmount>/);
assert.match(finalXml, /<cbc:PayableAmount currencyID="EUR">178\.50<\/cbc:PayableAmount>/);
assert.match(finalXml, /<cac:BillingReference>[\s\S]*<cbc:ID>RE-2026-0039<\/cbc:ID>/);
assert.match(finalXml, /§ 14 Abs\. 5 UStG/);

const broken = invoice({ gross_cents: 999 });
assert.throws(() => generator.buildXRechnung(broken), /seštevki računa/i);
assert.throws(() => generator.buildXRechnung(Object.assign(invoice(), { customer_type: "private" })), /podjetju ali javnemu/);

function adjustment(type, overrides) {
  const original = invoice();
  return Object.assign({
    id: "22222222-2222-4222-8222-222222222222",
    adjustment_number: type === "cancellation" ? "ST-2026-0043" : "KORR-2026-0043",
    adjustment_type: type,
    reason: type === "cancellation" ? "Auftrag vollständig aufgehoben" : "Empfängeranschrift berichtigt",
    issued_at: "2026-08-22T00:30:00+02:00",
    snapshot: {
      seller: original.snapshot.seller,
      original_invoice: {
        id: original.id, invoice_number: original.invoice_number, issue_date: original.issue_date,
        service_date: original.service_date, due_date: original.due_date, tax_mode: original.tax_mode,
        net_cents: original.net_cents, tax_cents: original.tax_cents, gross_cents: original.gross_cents
      },
      original_draft: original.snapshot.draft,
      effective_draft: original.snapshot.draft
    }
  }, overrides || {});
}

const correctionXml = adjustmentGenerator.buildAdjustmentXRechnung(adjustment("correction")).toString("utf8");
assert.match(correctionXml, /<ubl:Invoice[^>]+Invoice-2/);
assert.match(correctionXml, /<cbc:ID>KORR-2026-0043<\/cbc:ID>/);
assert.match(correctionXml, /<cbc:InvoiceTypeCode>384<\/cbc:InvoiceTypeCode>/);
assert.match(correctionXml, /<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>RE-2026-0042<\/cbc:ID><cbc:IssueDate>2026-08-19<\/cbc:IssueDate>/);
assert.match(correctionXml, /Rechnungsberichtigung: Empfängeranschrift berichtigt/);

const cancellationXml = adjustmentGenerator.buildAdjustmentXRechnung(adjustment("cancellation")).toString("utf8");
assert.match(cancellationXml, /<ubl:CreditNote[^>]+CreditNote-2/);
assert.match(cancellationXml, /<cbc:ID>ST-2026-0043<\/cbc:ID>/);
assert.match(cancellationXml, /<cbc:CreditNoteTypeCode>381<\/cbc:CreditNoteTypeCode>/);
assert.match(cancellationXml, /<cac:CreditNoteLine>[\s\S]*<cbc:CreditedQuantity unitCode="HUR">2<\/cbc:CreditedQuantity>/);
assert.doesNotMatch(cancellationXml, /InvoiceLine|InvoicedQuantity|DueDate/);
assert.match(cancellationXml, /<cac:PaymentMeans>[\s\S]*<cbc:PaymentMeansCode name="SEPA-Überweisung">58<\/cbc:PaymentMeansCode>/);
assert.match(cancellationXml, /<cac:PaymentTerms>[\s\S]*Zahlbar sofort ohne Abzug\./);
assert.match(cancellationXml, /<cbc:PayableAmount currencyID="EUR">238\.00<\/cbc:PayableAmount>/);
assert.strictEqual(adjustmentGenerator._test.berlinDate("2026-12-31T23:30:00Z"), "2027-01-01");
assert.throws(() => adjustmentGenerator.buildAdjustmentXRechnung(adjustment("credit_note")), /samo za Rechnungsberichtigung ali Storno/);

assert.match(api, /preveriUporabnika\(req, cfg\)/);
assert.match(api, /user_id=eq\." \+ encodeURIComponent\(userId\)/);
assert.match(api, /"x-upsert": "false"/);
assert.match(api, /sha256\(xml\) !== document\.sha256/);
assert.match(api, /response\.status === 200/);
assert.match(api, /response\.status === 406/);
assert.match(api, /KOSIT_VALIDATOR_URL/);
assert.match(api, /validation_status !== "validated"/);
assert.doesNotMatch(api, /invoiceIsCancelled|Storniranega računa ni dovoljeno pripraviti/);
assert.match(api, /A cancellation does not replace or erase the issued structured original/);
assert.match(api, /Cache-Control", "private, no-store, max-age=0"/);
assert.strictEqual(xrechnungHandler.validatorSettings({}).configured, false);
assert.strictEqual(xrechnungHandler.validatorSettings({ KOSIT_VALIDATOR_URL: "http://validator.example", KOSIT_VALIDATOR_TOKEN: "x".repeat(32) }).configured, false);
assert.strictEqual(xrechnungHandler.validatorSettings({ KOSIT_VALIDATOR_URL: "https://validator.example", KOSIT_VALIDATOR_TOKEN: "short" }).configured, false);
assert.strictEqual(xrechnungHandler.validatorSettings({ KOSIT_VALIDATOR_URL: "https://validator.example", KOSIT_VALIDATOR_TOKEN: "x".repeat(32) }).configured, true);
assert.strictEqual(xrechnungHandler.validatorSettings({ KOSIT_VALIDATOR_URL: "http://127.0.0.1:8080", KOSIT_VALIDATOR_TOKEN: "x".repeat(32) }).configured, true);

["pos_einvoice_documents", "pos_einvoice_validation_events"].forEach((table) => {
  assert.match(migration, new RegExp("alter table public\\." + table + " enable row level security", "i"));
  assert.match(migration, new RegExp("revoke all on table[\\s\\S]*public\\." + table + "[\\s\\S]*from public, anon, authenticated", "i"));
});
assert.match(migration, /grant select on table public\.pos_einvoice_documents, public\.pos_einvoice_validation_events to authenticated/i);
assert.doesNotMatch(migration, /grant\s+(?:all|insert|update|delete)[^;]*pos_einvoice_documents[^;]*to authenticated/i);
assert.match(migration, /create trigger pos_einvoice_documents_protected/i);
assert.match(migration, /'pos-einvoice-originals'[\s\S]*false/i);
assert.match(migration, /select private\._pos_issue_invoice\([\s\S]*seller_contact_phone[\s\S]*p_final_confirmed,[\s\S]*true/i);
assert.match(migration, /private\._pos_issue_replacement_invoice\([\s\S]*seller_contact_phone[\s\S]*p_final_confirmed,[\s\S]*true,[\s\S]*p_cancellation_adjustment_id/i);

assert.match(dockerfile, /validator-1\.6\.2-standalone\.jar/);
assert.match(dockerfile, /xrechnung-3\.0\.2-validator-configuration-2026-01-31\.zip/);
assert.match(dockerfile, /244978514ad48f67c7573acfffc8f4fd73d81feda6f276710033f9913579857e/);
assert.match(dockerfile, /6a5a5911a421b25fbc423f62f93f894df7b236f5d73ca4f84bb222a945082704/);
assert.match(dockerfile, /sha256sum -c/);
assert.match(dockerfile, /COPY --from=proxy-build \/out\/kosit-proxy/);
assert.match(proxy, /subtle\.ConstantTimeCompare/);
assert.match(proxy, /maxBodyBytes = 2 \* 1024 \* 1024/);
assert.match(proxy, /mediaType == "application\/xml"/);
assert.match(proxy, /r\.URL\.Path == "\/health"/);
assert.match(proxy, /validatorReady\(40 \* time\.Second\)/);
assert.match(api, /AbortSignal\.timeout\(50000\)/);
assert.match(api, /providerJson\.readText\(response,[\s\S]*KOSIT_RESPONSE_TOO_LARGE/);
assert.match(api, /providerJson\.readBuffer\(response,[\s\S]*MAX_XML_BYTES/);
assert.match(api, /POS_XRECHNUNG_ORIGINAL_TOO_LARGE/);
assert.match(startup, /-H 127\.0\.0\.1 -P 8081/);
assert.match(startup, /\/opt\/java\/openjdk\/bin\/java -jar/);
assert.match(terminalHtml, /pos-terminal\.js\?v=20260822-adjustment-xrechnung-v33/);
assert.match(terminalJs, /validationMessage/);
assert.match(terminalJs, /pos_adjustment_einvoice_documents/);
assert.match(terminalJs, /data-download-adjustment-xrechnung/);
assert.match(terminalJs, /\/api\/pos-racun-korekcija-xrechnung\?adjustmentId=/);
assert.match(adjustmentApi, /preveriUporabnika\(req, cfg\)/);
assert.match(adjustmentApi, /user_id=eq\." \+ encodeURIComponent\(userId\)/);
assert.match(adjustmentApi, /"x-upsert": "false"/);
assert.match(adjustmentApi, /sha256\(xml\) !== document\.sha256/);
assert.match(adjustmentApi, /validateWithKosit/);
assert.match(adjustmentApi, /Cache-Control", "private, no-store, max-age=0"/);
assert.match(adjustmentMigration, /create table public\.pos_adjustment_einvoice_documents/i);
assert.match(adjustmentMigration, /create table public\.pos_adjustment_einvoice_validation_events/i);
assert.match(adjustmentMigration, /alter table public\.pos_adjustment_einvoice_documents enable row level security/i);
assert.match(adjustmentMigration, /revoke all on table[\s\S]*pos_adjustment_einvoice_documents[\s\S]*from public,anon,authenticated/i);
assert.match(adjustmentMigration, /using \(\(select auth\.uid\(\)\) is not null and \(select auth\.uid\(\)\) = user_id\)/i);
assert.match(adjustmentMigration, /pos_adjustment_einvoice_documents_protected/i);
assert.match(adjustmentMigration, /source_table='pos_adjustment_einvoice_documents'[\s\S]*storage_bucket='pos-einvoice-originals'/i);
assert.match(adjustmentMigration, /make_date\(extract\(year from \(a\.issued_at at time zone 'Europe\/Berlin'\)\)::integer\+8,12,31\)/i);
assert.match(posRouter, /"adjustment-xrechnung": require\("\.\/_handlers\/pos-racun-korekcija-xrechnung"\)/);
assert.match(vercel, /\/api\/pos-racun-korekcija-xrechnung[\s\S]*handler=adjustment-xrechnung/);
assert.match(localServer, /pathname === "\/api\/pos-racun-korekcija-xrechnung"[\s\S]*posRacunKorekcijaXrechnungModul/);

void (async function verifyBoundedKositResponse() {
  assert.strictEqual(await providerJson.readText(new Response("bericht"), { maxBytes: 1024 }), "bericht");
  await assert.rejects(
    () => providerJson.readText(new Response("x".repeat(1025)), { maxBytes: 1024, code: "KOSIT_RESPONSE_TOO_LARGE" }),
    function (error) { return error && error.code === "KOSIT_RESPONSE_TOO_LARGE"; }
  );
  assert.strictEqual((await providerJson.readBuffer(new Response("original"), { maxBytes: 1024 })).toString("utf8"), "original");
  await assert.rejects(
    () => providerJson.readBuffer(new Response("x".repeat(1025)), { maxBytes: 1024, code: "POS_ORIGINAL_TOO_LARGE" }),
    function (error) { return error && error.code === "POS_ORIGINAL_TOO_LARGE"; }
  );
  console.log("POS XRechnung: račun, strukturirani popravek/Storno, arhiv, KoSIT adapter in RLS so preverjeni.");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});

module.exports = { invoice, publicInvoice, reverseInvoice };
