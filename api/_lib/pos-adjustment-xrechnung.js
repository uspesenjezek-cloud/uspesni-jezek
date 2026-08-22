"use strict";

const { DateTime } = require("luxon");
const xrechnung = require("./pos-xrechnung");

const GENERATOR_VERSION = "uj-pos-adjustment-xrechnung-2";

function text(value) {
  return String(value == null ? "" : value).trim();
}

function berlinDate(value) {
  const parsed = DateTime.fromISO(String(value || ""), { setZone: true });
  return parsed.isValid ? parsed.setZone("Europe/Berlin").toISODate() : "";
}

function billingReferenceXml(original) {
  const issueDate = /^\d{4}-\d{2}-\d{2}$/.test(text(original.issue_date))
    ? "<cbc:IssueDate>" + text(original.issue_date) + "</cbc:IssueDate>"
    : "";
  return "  <cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>" +
    xrechnung._test.escapeXml(original.invoice_number) + "</cbc:ID>" + issueDate +
    "</cac:InvoiceDocumentReference></cac:BillingReference>";
}

function normalizedSource(adjustment) {
  if (!adjustment || !adjustment.snapshot) throw new Error("Manjka zaklenjen posnetek popravka.");
  if (!["correction", "cancellation"].includes(adjustment.adjustment_type)) {
    throw new Error("Strukturirani popravek je dovoljen samo za Rechnungsberichtigung ali Storno.");
  }
  const snapshot = adjustment.snapshot;
  const original = snapshot.original_invoice || {};
  const draft = snapshot.effective_draft || snapshot.original_draft || {};
  if (!text(original.invoice_number)) throw new Error("Popravek nima reference na izvirni račun.");
  const documentDate = berlinDate(adjustment.issued_at);
  if (!documentDate) throw new Error("Datum popravka ni veljaven.");
  return {
    original,
    row: {
      id: adjustment.id,
      invoice_number: adjustment.adjustment_number,
      issue_date: documentDate,
      service_date: draft.service_date || original.service_date,
      due_date: draft.due_date || documentDate,
      customer_type: draft.customer_type,
      tax_mode: original.tax_mode || draft.tax_mode,
      net_cents: original.net_cents,
      tax_cents: original.tax_cents,
      gross_cents: original.gross_cents,
      snapshot: { seller: snapshot.seller || {}, draft }
    }
  };
}

function addReference(xml, original) {
  const marker = /(^  <cbc:BuyerReference>[^\n]+$)/m;
  if (!marker.test(xml)) throw new Error("XRechnung nima BuyerReference za navezavo popravka.");
  return xml.replace(marker, "$1\n" + billingReferenceXml(original));
}

function asCorrectionInvoice(xml, adjustment) {
  return xml
    .replace("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>", "<cbc:InvoiceTypeCode>384</cbc:InvoiceTypeCode>")
    .replace(/(<cbc:InvoiceTypeCode>384<\/cbc:InvoiceTypeCode>)/, "$1\n  <cbc:Note>Rechnungsberichtigung: " + xrechnung._test.escapeXml(adjustment.reason) + "</cbc:Note>");
}

function asCreditNote(xml, adjustment) {
  return xml
    .replace("<ubl:Invoice xmlns:ubl=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"", "<ubl:CreditNote xmlns:ubl=\"urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2\"")
    .replace("</ubl:Invoice>", "</ubl:CreditNote>")
    .replace(/^  <cbc:DueDate>[^\n]+\n/m, "")
    .replace("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>", "<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>\n  <cbc:Note>Stornierung: " + xrechnung._test.escapeXml(adjustment.reason) + "</cbc:Note>")
    .replace(/<cac:InvoiceLine>/g, "<cac:CreditNoteLine>")
    .replace(/<\/cac:InvoiceLine>/g, "</cac:CreditNoteLine>")
    .replace(/<cbc:InvoicedQuantity/g, "<cbc:CreditedQuantity")
    .replace(/<\/cbc:InvoicedQuantity>/g, "</cbc:CreditedQuantity>");
}

function buildAdjustmentXRechnung(adjustment) {
  const source = normalizedSource(adjustment);
  let xml = xrechnung.buildXRechnung(source.row).toString("utf8");
  xml = addReference(xml, source.original);
  xml = adjustment.adjustment_type === "cancellation"
    ? asCreditNote(xml, adjustment)
    : asCorrectionInvoice(xml, adjustment);
  return Buffer.from(xml, "utf8");
}

module.exports = {
  GENERATOR_VERSION,
  XRECHNUNG_VERSION: xrechnung.XRECHNUNG_VERSION,
  buildAdjustmentXRechnung,
  _test: { berlinDate, billingReferenceXml, normalizedSource, addReference, asCorrectionInvoice, asCreditNote }
};
