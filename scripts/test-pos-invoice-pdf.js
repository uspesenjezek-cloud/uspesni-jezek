"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const pdfModule = require("../api/_lib/pos-pdf");
const adjustmentPdf = require("../api/_lib/pos-adjustment-pdf");
const endpoint = require("../api/pos-racun-pdf");
const adjustmentEndpoint = require("../api/pos-racun-korekcija");
const pdfSource = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "pos-pdf.js"), "utf8");

function sampleInvoice(replacement) {
  const items = [];
  for (let index = 0; index < 18; index += 1) {
    items.push({
      id: "item-" + index,
      description: "Ausführung einer fachgerechten Elektroinstallations- und Prüfleistung im Wohngebäude, Abschnitt " + (index + 1),
      category: index % 4 === 0 ? "material" : "labour",
      quantity_milli: 1250,
      unit: "Std.",
      unit_price_cents: 8500,
      tax_rate_bps: 1900,
      net_cents: 10625,
      tax_cents: 2019,
      gross_cents: 12644
    });
  }
  const net = items.reduce((sum, item) => sum + item.net_cents, 0);
  const tax = items.reduce((sum, item) => sum + item.tax_cents, 0);
  return {
    id: "11111111-1111-4111-8111-111111111111",
    invoice_number: "RE-2026-0001",
    is_test: false,
    customer_type: "private",
    issue_date: "2026-08-19",
    service_date: "2026-08-18",
    due_date: "2026-09-02",
    tax_mode: "regular",
    net_cents: net,
    tax_cents: tax,
    gross_cents: net + tax,
    eligible_35a_cents: items.filter((item) => item.category === "labour").reduce((sum, item) => sum + item.gross_cents, 0),
    issued_at: "2026-08-19T12:00:00.000Z",
    snapshot: {
      seller: {
        legalName: "Uspešni Ježek - POS Test Čopič",
        legalForm: "GmbH",
        representative: "Erika Beispiel",
        street: "Lange Musterstraße 123",
        postalCode: "10115",
        city: "Berlin",
        businessEmail: "rechnung@muster-elektrotechnik.de",
        taxStatus: "regular",
        taxNumber: "12/345/67890",
        vatId: "DE123456789",
        accountHolder: "Muster Elektrotechnik GmbH",
        iban: "DE02120300000000202051"
      },
      draft: Object.assign({
        customer_type: "private",
        customer_name: "Maximilian Sehrlanger-Doppelname Beispiel",
        customer_street: "Beispielallee 987",
        customer_postal_code: "20095",
        customer_city: "Hamburg",
        payment_method: "sepa",
        property_related: true,
        handwerker_35a: true,
        construction_withholding: false,
        consumer_default_notice: true,
        items
      }, replacement ? {
        replacement_original_number: "RE-2026-0001",
        replacement_cancellation_number: "ST-2026-0002"
      } : {})
    }
  };
}

function sampleAdjustment(type) {
  const invoice = sampleInvoice();
  const correction = type === "correction";
  const previous = Object.assign({}, invoice.snapshot.draft);
  const changes = correction ? { customer_street: "Neue Beispielallee 45", due_date: "2026-09-09" } : {};
  const effective = Object.assign({}, previous, changes);
  return {
    id: "22222222-2222-4222-8222-222222222222",
    original_invoice_id: invoice.id,
    adjustment_number: correction ? "KORR-2026-0002" : "ST-2026-0002",
    adjustment_type: type,
    reason: correction ? "Die Straße und das Fälligkeitsdatum waren unzutreffend." : "Der Rechnungsbetrag und die steuerliche Behandlung waren unzutreffend.",
    changes,
    delta_net_cents: correction ? 0 : -invoice.net_cents,
    delta_tax_cents: correction ? 0 : -invoice.tax_cents,
    delta_gross_cents: correction ? 0 : -invoice.gross_cents,
    is_test: false,
    issued_at: "2026-08-19T14:00:00.000Z",
    snapshot: {
      seller: invoice.snapshot.seller,
      original_invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        service_date: invoice.service_date,
        due_date: invoice.due_date,
        tax_mode: invoice.tax_mode,
        net_cents: invoice.net_cents,
        tax_cents: invoice.tax_cents,
        gross_cents: invoice.gross_cents,
        is_test: false
      },
      original_draft: invoice.snapshot.draft,
      previous_draft: previous,
      effective_draft: effective,
      changes
    }
  };
}

(async function run() {
  assert.strictEqual(pdfModule.safeText("Uspešni Ježek – Čopič"), "Uspešni Ježek - Čopič");
  assert.strictEqual(pdfModule.taxIdentityText({}), "");
  assert.strictEqual(pdfModule.taxIdentityText({ taxNumber: "12/345/67890" }), "Steuernummer: 12/345/67890");
  assert.strictEqual(pdfModule.taxIdentityText({ taxNumber: "12/345/67890", vatId: "DE123456789" }), "USt-IdNr.: DE123456789");
  assert.match(pdfModule.propertyRetentionNote({ customer_type: "private", property_related: true }), /zwei Jahre aufzubewahren \(§ 14b Abs\. 1 UStG\)/);
  assert.strictEqual(pdfModule.propertyRetentionNote({ customer_type: "business", property_related: true }), "");
  assert.strictEqual(pdfModule.propertyRetentionNote({ customer_type: "private", property_related: false, handwerker_35a: false }), "");
  assert.strictEqual(pdfModule.constructionWithholdingNote({ construction_withholding: false }), "");
  assert.match(pdfModule.constructionWithholdingNote({ construction_withholding: true, exemption_certificate: "valid" }), /Freistellungsbescheinigung: gültig/);
  assert.match(pdfModule.constructionWithholdingNote({ construction_withholding: true, exemption_certificate: "missing" }), /nicht vorgelegt/);
  const incompleteTestInvoice = sampleInvoice();
  incompleteTestInvoice.invoice_number = "TEST-2026-0001";
  incompleteTestInvoice.is_test = true;
  incompleteTestInvoice.snapshot.seller = { legalName: "   " };
  const testSeller = pdfModule.sellerForInvoice(incompleteTestInvoice);
  assert.strictEqual(testSeller.seller.legalName, "TEST-Unternehmen");
  assert.strictEqual(testSeller.seller.street, "Musterstraße 1");
  assert.strictEqual(testSeller.testPayment, true);
  assert.strictEqual(testSeller.testTax, true);
  assert.throws(() => pdfModule.sellerForInvoice(Object.assign({}, incompleteTestInvoice, { is_test: false })), /Pravni račun nima popolnih podatkov/);
  assert.strictEqual(endpoint._test.objectPath("u", "i"), "u/i/rechnung.pdf");
  assert.strictEqual(endpoint._test.encodedPath("a b/c"), "a%20b/c");
  assert.strictEqual(endpoint._test.uuid("not-a-uuid"), "");
  assert.strictEqual(adjustmentEndpoint._test.objectPath("u", "a"), "u/adjustments/a/korrektur.pdf");
  assert.deepStrictEqual(pdfModule.taxGroups([
    { tax_rate_bps: 1900, net_cents: 10000, tax_cents: 1900 },
    { tax_rate_bps: 700, net_cents: 5000, tax_cents: 350 },
    { tax_rate_bps: 1900, net_cents: 2000, tax_cents: 380 }
  ]), [
    { tax_rate_bps: 700, net_cents: 5000, tax_cents: 350 },
    { tax_rate_bps: 1900, net_cents: 12000, tax_cents: 2280 }
  ]);

  const buffer = await pdfModule.ustvariRacunPdf(sampleInvoice());
  assert.ok(buffer.length > 5000, "PDF ne sme biti prazen ali očitno nepopoln.");
  assert.strictEqual(buffer.subarray(0, 4).toString("ascii"), "%PDF");
  const pdf = await PDFDocument.load(buffer);
  assert.ok(pdf.getPageCount() >= 2, "Dolg realističen račun mora pravilno nadaljevati na novo stran.");
  assert.strictEqual(pdf.getTitle(), "Rechnung RE-2026-0001");
  assert.strictEqual(pdf.getCreator(), pdfModule.GENERATOR_VERSION);
  assert.strictEqual(pdfModule.GENERATOR_VERSION, "uj-pos-pdf-6");

  const incompleteTestBuffer = await pdfModule.ustvariRacunPdf(incompleteTestInvoice);
  const incompleteTestPdf = await PDFDocument.load(incompleteTestBuffer);
  assert.strictEqual(incompleteTestPdf.getCreator(), "uj-pos-pdf-6");

  const replacementBuffer = await pdfModule.ustvariRacunPdf(sampleInvoice(true));
  const replacementPdf = await PDFDocument.load(replacementBuffer);
  assert.strictEqual(replacementPdf.getPageCount(), pdf.getPageCount());
  assert.strictEqual(replacementPdf.getCreator(), "uj-pos-pdf-6");

  const finalInvoice = sampleInvoice();
  finalInvoice.snapshot.draft.workflow_context = {
    work_order_id: "33333333-3333-4333-8333-333333333333",
    invoice_kind: "final",
    final_deductions: [{
      invoice_id: "22222222-2222-4222-8222-222222222222", invoice_number: "RE-2026-0007", issue_date: "2026-07-15",
      net_cents: 10000, tax_cents: 1900, gross_cents: 11900
    }]
  };
  finalInvoice.net_cents -= 10000;
  finalInvoice.tax_cents -= 1900;
  finalInvoice.gross_cents -= 11900;
  const finalBuffer = await pdfModule.ustvariRacunPdf(finalInvoice);
  const finalPdf = await PDFDocument.load(finalBuffer);
  assert.strictEqual(finalPdf.getCreator(), "uj-pos-pdf-6");
  assert.match(pdfSource, /Auftragssumme brutto/);
  assert.match(pdfSource, /Noch zu zahlen/);
  assert.match(pdfSource, /§ 14 Abs\. 5 UStG/);

  const correctionBuffer = await adjustmentPdf.ustvariKorekcijskiPdf(sampleAdjustment("correction"));
  const correctionPdf = await PDFDocument.load(correctionBuffer);
  assert.strictEqual(correctionPdf.getPageCount(), 1);
  assert.strictEqual(correctionPdf.getTitle(), "Rechnungsberichtigung KORR-2026-0002");
  assert.deepStrictEqual(adjustmentPdf.adjustmentRows(sampleAdjustment("correction")).map((row) => row.key), ["customer_street", "due_date"]);

  const cancellationBuffer = await adjustmentPdf.ustvariKorekcijskiPdf(sampleAdjustment("cancellation"));
  const cancellationPdf = await PDFDocument.load(cancellationBuffer);
  assert.ok(cancellationPdf.getPageCount() >= 2, "Dolg Storno mora nadaljevati tabelo na novo stran.");
  assert.strictEqual(cancellationPdf.getTitle(), "Stornorechnung ST-2026-0002");
  assert.strictEqual(cancellationPdf.getCreator(), adjustmentPdf.GENERATOR_VERSION);
  assert.strictEqual(adjustmentPdf.GENERATOR_VERSION, "uj-pos-adjustment-pdf-2");

  if (process.env.POS_PDF_SAMPLE_OUTPUT) {
    const output = path.resolve(process.env.POS_PDF_SAMPLE_OUTPUT);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, buffer);
  }
  if (process.env.POS_ADJUSTMENT_PDF_SAMPLE_OUTPUT) {
    const output = path.resolve(process.env.POS_ADJUSTMENT_PDF_SAMPLE_OUTPUT);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, cancellationBuffer);
  }
  if (process.env.POS_REPLACEMENT_PDF_SAMPLE_OUTPUT) {
    const output = path.resolve(process.env.POS_REPLACEMENT_PDF_SAMPLE_OUTPUT);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, replacementBuffer);
  }
  if (process.env.POS_TEST_PDF_SAMPLE_OUTPUT) {
    const output = path.resolve(process.env.POS_TEST_PDF_SAMPLE_OUTPUT);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, incompleteTestBuffer);
  }
  console.log("POS PDF: račun, Rechnungsberichtigung in večstranski Storno so preverjeni.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
