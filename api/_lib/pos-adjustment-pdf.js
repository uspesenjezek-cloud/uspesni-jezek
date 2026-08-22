"use strict";

const { PDFDocument, rgb, degrees } = require("pdf-lib");
const { DateTime } = require("luxon");
const { safeText, money, dateDE, wrap, sellerLegalDisclosureLines, embedUnicodeFonts } = require("./pos-pdf");

const GENERATOR_VERSION = "uj-pos-adjustment-pdf-4";
const PAGE = { width: 595.28, height: 841.89, margin: 48 };
const COLORS = {
  ink: rgb(0.08, 0.19, 0.18), muted: rgb(0.38, 0.48, 0.46),
  teal: rgb(0.07, 0.57, 0.56), tealDark: rgb(0.03, 0.39, 0.39),
  pale: rgb(0.93, 0.97, 0.96), line: rgb(0.79, 0.86, 0.84),
  white: rgb(1, 1, 1), red: rgb(0.62, 0.19, 0.17)
};

const FIELD_LABELS = {
  customer_name: "Name des Leistungsempfängers",
  customer_street: "Straße und Hausnummer",
  customer_postal_code: "Postleitzahl",
  customer_city: "Ort",
  customer_vat_id: "USt-IdNr. des Empfängers",
  service_date: "Leistungsdatum",
  due_date: "Fälligkeitsdatum",
  buyer_reference: "Bestellreferenz",
  leitweg_id: "Leitweg-ID",
  work_description: "Leistungsbeschreibung"
};

function rightText(page, text, right, y, font, size, color) {
  const clean = safeText(text);
  page.drawText(clean, { x: right - font.widthOfTextAtSize(clean, size), y, font, size, color });
}

function signedMoney(cents) {
  const value = Number(cents) || 0;
  return (value < 0 ? "-" : "") + money(Math.abs(value));
}

function berlinDate(value) {
  const date = DateTime.fromISO(String(value || ""), { setZone: true });
  return date.isValid ? date.setZone("Europe/Berlin").toISODate() : "";
}

function displayValue(key, value) {
  if (key === "service_date" || key === "due_date") return dateDE(value);
  return safeText(value == null || value === "" ? "-" : value);
}

function adjustmentRows(adjustment) {
  const snapshot = adjustment && adjustment.snapshot || {};
  const previous = snapshot.previous_draft || snapshot.original_draft || {};
  const changes = snapshot.changes || adjustment.changes || {};
  return Object.keys(changes).map((key) => ({
    key,
    label: FIELD_LABELS[key] || key,
    before: displayValue(key, previous[key]),
    after: displayValue(key, changes[key])
  }));
}

async function ustvariKorekcijskiPdf(adjustment) {
  if (!adjustment || !adjustment.snapshot) throw new Error("Manjka zaklenjen posnetek popravka.");
  const cancellation = adjustment.adjustment_type === "cancellation";
  const creditNote = adjustment.adjustment_type === "credit_note";
  const financial = cancellation || creditNote;
  const pdf = await PDFDocument.create();
  const title = cancellation ? "Stornorechnung " : creditNote ? "Gutschrift " : "Rechnungsberichtigung ";
  pdf.setTitle(title + safeText(adjustment.adjustment_number));
  pdf.setAuthor("Uspešni Ježek POS");
  pdf.setSubject(cancellation ? "Stornorechnung" : creditNote ? "Gutschrift" : "Rechnungsberichtigung");
  pdf.setCreator(GENERATOR_VERSION);
  pdf.setProducer(GENERATOR_VERSION);
  pdf.setCreationDate(new Date(adjustment.issued_at || Date.now()));
  pdf.setModificationDate(new Date(adjustment.issued_at || Date.now()));

  const { regular, bold } = await embedUnicodeFonts(pdf);
  const snapshot = adjustment.snapshot;
  const seller = snapshot.seller || {};
  const original = snapshot.original_invoice || {};
  const draft = snapshot.effective_draft || snapshot.original_draft || {};
  const pages = [];
  let page;
  let y;

  function addPage(continuation) {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    if (adjustment.is_test) page.drawText("TESTDOKUMENT", { x: 116, y: 375, size: 46, font: bold, color: rgb(.93,.84,.78), rotate: degrees(28), opacity: .25 });
    page.drawRectangle({ x: 0, y: PAGE.height - 92, width: PAGE.width, height: 92, color: financial ? COLORS.red : COLORS.tealDark });
    page.drawText(safeText(seller.legalName || "Unternehmen"), { x: PAGE.margin, y: PAGE.height - 49, font: bold, size: 14, color: COLORS.white });
    rightText(page, continuation ? "Fortsetzung" : (cancellation ? "STORNORECHNUNG" : creditNote ? "GUTSCHRIFT" : "RECHNUNGSBERICHTIGUNG"), PAGE.width - PAGE.margin, PAGE.height - 48, bold, 12, COLORS.white);
    rightText(page, adjustment.adjustment_number, PAGE.width - PAGE.margin, PAGE.height - 66, regular, 8, COLORS.white);
    y = PAGE.height - 122;
  }

  function ensureSpace(height) {
    if (y - height < 72) addPage(true);
  }

  function drawWrapped(text, x, maxWidth, size, lineHeight, font, color) {
    const lines = wrap(text, font || regular, size, maxWidth);
    lines.forEach((line) => { page.drawText(line, { x, y, font: font || regular, size, color: color || COLORS.ink }); y -= lineHeight; });
  }

  addPage(false);
  page.drawText("Aussteller", { x: PAGE.margin, y, font: bold, size: 8, color: COLORS.muted });
  y -= 16;
  [seller.legalName, seller.street, [seller.postalCode, seller.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .forEach((line) => drawWrapped(line, PAGE.margin, PAGE.width - PAGE.margin * 2, 8.5, 11, regular));
  sellerLegalDisclosureLines(seller)
    .forEach((line) => drawWrapped(line, PAGE.margin, PAGE.width - PAGE.margin * 2, 7.2, 9.5, regular, COLORS.muted));
  y -= 8;
  page.drawText("Bezug zur ursprünglichen Rechnung", { x: PAGE.margin, y, font: bold, size: 8, color: COLORS.muted });
  y -= 18;
  page.drawRectangle({ x: PAGE.margin, y: y - 65, width: PAGE.width - PAGE.margin * 2, height: 70, color: COLORS.pale, borderColor: COLORS.line, borderWidth: .7 });
  page.drawText("Rechnungsnummer", { x: PAGE.margin + 13, y: y - 16, font: regular, size: 7.5, color: COLORS.muted });
  page.drawText(safeText(original.invoice_number), { x: PAGE.margin + 13, y: y - 34, font: bold, size: 10.5, color: COLORS.ink });
  rightText(page, "Ausgestellt: " + dateDE(original.issue_date), PAGE.width - PAGE.margin - 13, y - 16, regular, 8, COLORS.muted);
  rightText(page, "Dokumentdatum: " + dateDE(berlinDate(adjustment.issued_at)), PAGE.width - PAGE.margin - 13, y - 34, bold, 8.5, COLORS.ink);
  y -= 86;

  page.drawText("Empfänger", { x: PAGE.margin, y, font: bold, size: 8, color: COLORS.muted });
  y -= 16;
  drawWrapped([draft.customer_name, draft.customer_street, [draft.customer_postal_code, draft.customer_city].filter(Boolean).join(" ")].filter(Boolean).join(", "), PAGE.margin, PAGE.width - PAGE.margin * 2, 9, 12, regular);
  y -= 9;

  page.drawText("Grund", { x: PAGE.margin, y, font: bold, size: 8, color: COLORS.muted });
  y -= 16;
  drawWrapped(adjustment.reason, PAGE.margin, PAGE.width - PAGE.margin * 2, 9, 12, regular);
  y -= 13;

  if (!financial) {
    const rows = adjustmentRows(adjustment);
    page.drawText("Berichtigte Angaben", { x: PAGE.margin, y, font: bold, size: 12, color: COLORS.tealDark });
    y -= 21;
    rows.forEach((row) => {
      const before = wrap(row.before, regular, 8.2, 205);
      const after = wrap(row.after, regular, 8.2, 205);
      const height = Math.max(52, 31 + Math.max(before.length, after.length) * 10);
      ensureSpace(height + 8);
      page.drawRectangle({ x: PAGE.margin, y: y - height + 6, width: PAGE.width - PAGE.margin * 2, height, color: COLORS.white, borderColor: COLORS.line, borderWidth: .6 });
      page.drawText(safeText(row.label), { x: PAGE.margin + 10, y: y - 10, font: bold, size: 7.6, color: COLORS.tealDark });
      page.drawText("Bisher", { x: PAGE.margin + 10, y: y - 27, font: regular, size: 6.8, color: COLORS.muted });
      page.drawText("Neu", { x: PAGE.margin + 257, y: y - 27, font: regular, size: 6.8, color: COLORS.muted });
      before.forEach((line, i) => page.drawText(line, { x: PAGE.margin + 10, y: y - 40 - i * 10, font: regular, size: 8.2, color: COLORS.ink }));
      after.forEach((line, i) => page.drawText(line, { x: PAGE.margin + 257, y: y - 40 - i * 10, font: bold, size: 8.2, color: COLORS.ink }));
      y -= height + 7;
    });
    ensureSpace(66);
    page.drawRectangle({ x: PAGE.margin, y: y - 48, width: PAGE.width - PAGE.margin * 2, height: 54, color: COLORS.pale });
    y -= 13;
    drawWrapped("Dieses Dokument berichtigt ausschließlich die oben genannten Angaben der Rechnung " + safeText(original.invoice_number) + ". Alle übrigen Rechnungsangaben bleiben unverändert (§ 31 Abs. 5 UStDV).", PAGE.margin + 10, PAGE.width - PAGE.margin * 2 - 20, 8, 10.5, regular);
  } else {
    const items = creditNote ? (Array.isArray(snapshot.credit_lines) ? snapshot.credit_lines : []) : (Array.isArray(draft.items) ? draft.items : []);
    const cols = { desc: PAGE.margin, qty: 318, tax: 425, total: PAGE.width - PAGE.margin };
    function header() {
      page.drawRectangle({ x: PAGE.margin, y: y - 5, width: PAGE.width - PAGE.margin * 2, height: 22, color: COLORS.pale });
      page.drawText(creditNote ? "Gutgeschriebene Leistung" : "Stornierte Leistung", { x: cols.desc + 7, y: y + 3, font: bold, size: 7.5, color: COLORS.tealDark });
      rightText(page, "Menge", cols.qty + 40, y + 3, bold, 7.5, COLORS.tealDark);
      rightText(page, "USt.", cols.tax + 35, y + 3, bold, 7.5, COLORS.tealDark);
      rightText(page, "Betrag", cols.total, y + 3, bold, 7.5, COLORS.tealDark);
      y -= 15;
    }
    page.drawText(creditNote ? "Teilweise Entgeltminderung" : "Vollständige Stornierung", { x: PAGE.margin, y, font: bold, size: 12, color: COLORS.red });
    y -= 21;
    header();
    items.forEach((item) => {
      const lines = wrap(item.description || "Leistung", regular, 8.2, 244);
      const height = Math.max(27, lines.length * 10 + 11);
      if (y - height < 135) { addPage(true); page.drawText(creditNote ? "Teilweise Entgeltminderung (Fortsetzung)" : "Vollständige Stornierung (Fortsetzung)", { x: PAGE.margin, y, font: bold, size: 11, color: COLORS.red }); y -= 20; header(); }
      lines.forEach((line, i) => page.drawText(line, { x: cols.desc + 7, y: y - 9 - i * 10, font: regular, size: 8.2, color: COLORS.ink }));
      rightText(page, creditNote ? "1" : String((Number(item.quantity_milli) || 0) / 1000).replace(".", ",") + " " + safeText(item.unit || ""), cols.qty + 40, y - 9, regular, 8, COLORS.ink);
      rightText(page, (Number(item.tax_rate_bps || 0) / 100) + " %", cols.tax + 35, y - 9, regular, 8, COLORS.ink);
      rightText(page, signedMoney(-(Number(item.gross_cents) || 0)), cols.total, y - 9, bold, 8.3, COLORS.red);
      y -= height;
      page.drawLine({ start: { x: PAGE.margin, y: y + 5 }, end: { x: PAGE.width - PAGE.margin, y: y + 5 }, thickness: .5, color: COLORS.line });
    });
    ensureSpace(120);
    const totalX = 330;
    [["Nettobetrag", adjustment.delta_net_cents], ["Umsatzsteuer", adjustment.delta_tax_cents]].forEach((entry) => {
      page.drawText(entry[0], { x: totalX, y, font: regular, size: 9, color: COLORS.muted });
      rightText(page, signedMoney(entry[1]), PAGE.width - PAGE.margin, y, regular, 9, COLORS.ink);
      y -= 18;
    });
    page.drawLine({ start: { x: totalX, y: y + 10 }, end: { x: PAGE.width - PAGE.margin, y: y + 10 }, thickness: 1, color: COLORS.red });
    page.drawText(creditNote ? "Gutschriftsbetrag" : "Stornobetrag", { x: totalX, y: y - 3, font: bold, size: 11, color: COLORS.red });
    rightText(page, signedMoney(adjustment.delta_gross_cents), PAGE.width - PAGE.margin, y - 3, bold, 12, COLORS.red);
    y -= 48;
    drawWrapped(creditNote
      ? "Das Entgelt der Rechnung " + safeText(original.invoice_number) + " wird nach dem Verbraucherwiderruf teilweise gemindert. Der anerkannte Wertersatz bleibt steuerpflichtig. Die Umsatzsteuerkorrektur ist im maßgeblichen Besteuerungszeitraum zu berücksichtigen (§ 17 UStG)."
      : "Die Rechnung " + safeText(original.invoice_number) + " wird vollständig aufgehoben. Die Umsatzsteuerkorrektur ist im maßgeblichen Besteuerungszeitraum zu berücksichtigen (§ 17 UStG).", PAGE.margin, PAGE.width - PAGE.margin * 2, 8, 10.5, regular);
  }

  pages.forEach((current, index) => {
    current.drawLine({ start: { x: PAGE.margin, y: 50 }, end: { x: PAGE.width - PAGE.margin, y: 50 }, thickness: .5, color: COLORS.line });
    current.drawText("Unveränderliches Korrekturdokument - " + GENERATOR_VERSION, { x: PAGE.margin, y: 34, font: regular, size: 6.7, color: COLORS.muted });
    rightText(current, "Seite " + (index + 1) + " / " + pages.length, PAGE.width - PAGE.margin, 34, regular, 6.7, COLORS.muted);
  });

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

module.exports = { GENERATOR_VERSION, FIELD_LABELS, adjustmentRows, berlinDate, signedMoney, ustvariKorekcijskiPdf };
