"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const exporter = require("../app/pos-dsfinvk");

const checkout = {
  id: "cash-1", invoiceId: "invoice-1", invoiceNumber: "TEST-2026-0001", state: "completed",
  completedAt: "2026-08-26T12:00:02.000Z",
  receipt: {
    paymentType: "CASH", grossCents: 12970,
    items: [{ description: "Arbeitszeit", grossCents: 11900, vatRate: "19" }, { description: "Material", grossCents: 1070, vatRate: "7" }],
    totalsByVat: [{ vatRate: "19", netCents: 10000, taxCents: 1900, grossCents: 11900 }, { vatRate: "7", netCents: 1000, taxCents: 70, grossCents: 1070 }]
  },
  signature: {
    transactionId: "63f3fa9e-6c8b-4fe9-949b-534ad16132cf", fiscalType: "SALE", signatureCounter: "44",
    signatureAlgorithm: "ecdsa-plain-SHA256", tssSerialNumber: "mock-tss", clientSerialNumber: "mock-client",
    qrCodeData: "V0;MOCK", startedAt: "2026-08-26T12:00:00.000Z", finishedAt: "2026-08-26T12:00:01.000Z"
  },
  refund: {
    id: "refund-1", originalCheckoutId: "cash-1", state: "completed", completedAt: "2026-08-26T12:05:02.000Z",
    receipt: {
      paymentType: "CASH", grossCents: 12970,
      items: [{ description: "Arbeitszeit", grossCents: 11900, vatRate: "19" }, { description: "Material", grossCents: 1070, vatRate: "7" }],
      totalsByVat: [{ vatRate: "19", netCents: 10000, taxCents: 1900, grossCents: 11900 }, { vatRate: "7", netCents: 1000, taxCents: 70, grossCents: 1070 }]
    },
    signature: {
      transactionId: "7bf2b660-8a4f-44da-8a01-2cadc1d0e93c", fiscalType: "REFUND", signatureCounter: "45",
      signatureAlgorithm: "ecdsa-plain-SHA256", tssSerialNumber: "mock-tss", clientSerialNumber: "mock-client",
      qrCodeData: "V0;MOCK;REFUND", startedAt: "2026-08-26T12:05:00.000Z", finishedAt: "2026-08-26T12:05:01.000Z"
    }
  }
};

const result = exporter.buildPackage([checkout], { legalName: "Musterbetrieb GmbH", taxNumber: "12/345/67890" }, {
  createdAt: "2026-08-26T13:00:00.000Z",
  movements: [
    { type: "DEPOSIT", amountCents: 5000, occurredAt: "2026-08-26T08:00:00.000Z", reference: "START-1", reason: "Wechselgeld" },
    { type: "WITHDRAWAL", amountCents: 2000, occurredAt: "2026-08-26T18:00:00.000Z", reference: "ENT-1", reason: "Bankeinzahlung" }
  ]
});
assert.strictEqual(result.payload.manifest.version, "DSFinV-K-2.4-TRAINING-MODEL-v3");
assert.strictEqual(result.payload.manifest.environment, "TRAINING");
assert.strictEqual(result.payload.manifest.transactionCount, 4);
assert.strictEqual(result.payload.manifest.cashBalanceCents, 3000);
["cash_point_closing.csv", "transactions.csv", "payment.csv", "lines.csv", "transactions_vat.csv", "tse.csv"].forEach((name) => assert.ok(result.payload.files[name], name));
assert.match(result.payload.files["transactions.csv"], /TEST-2026-0001/);
assert.match(result.payload.files["tse.csv"], /mock-tss/);
assert.match(result.payload.files["tse.csv"], /V0;MOCK;REFUND/);
assert.match(result.payload.files["transactions.csv"], /Storno/);
assert.match(result.payload.files["payment.csv"], /refund-1;Bar;-12970;EUR/);

const unresolvedRefund = JSON.parse(JSON.stringify(checkout));
unresolvedRefund.refund.state = "recovery_required";
assert.throws(
  () => exporter.buildPackage([unresolvedRefund], {}, {}),
  (error) => error && error.code === "DSFINVK_REFUND_UNRESOLVED" && /TSE uskladitev/.test(error.message),
  "Odprta TSE uskladitev povračila mora blokirati celoten izvoz, ne pa tiho izpustiti povračila."
);

const invalidCompletedRefund = JSON.parse(JSON.stringify(checkout));
invalidCompletedRefund.refund.signature.qrCodeData = "";
assert.throws(
  () => exporter.buildPackage([invalidCompletedRefund], {}, {}),
  (error) => error && error.code === "DSFINVK_REFUND_INVALID",
  "Zaključeno povračilo brez popolnih TSE dokazil ne sme biti izpuščeno iz izvoza."
);
assert.throws(() => exporter.normalizeMovement({ type: "OTHER", amountCents: 100, reference: "x" }), /Neveljavna vrsta/);
assert.throws(() => exporter.buildPackage([], {}, {}), /ni gotovinskih dogodkov/);

const html = fs.readFileSync(path.join(__dirname, "..", "app", "pos-terminal.html"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "..", "app", "pos-terminal.js"), "utf8");
assert.match(html, /pos-dsfinvk\.js\?v=/);
assert.match(html, /data-dsfinvk-export/);
assert.match(js, /UJPosDsfinvk\.buildPackage/);
console.log("POS DSFinV-K TRAINING model, cash movements and export: OK");
