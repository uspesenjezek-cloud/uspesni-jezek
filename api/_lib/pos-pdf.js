"use strict";

const fs = require("fs");
const fontkit = require("@pdf-lib/fontkit");
const { PDFDocument, rgb, degrees } = require("pdf-lib");

const GENERATOR_VERSION = "uj-pos-pdf-6";
const FONT_REGULAR_PATH = require.resolve("./fonts/NotoSans-Regular.ttf");
const FONT_BOLD_PATH = require.resolve("./fonts/NotoSans-Bold.ttf");
const FONT_REGULAR = fs.readFileSync(FONT_REGULAR_PATH);
const FONT_BOLD = fs.readFileSync(FONT_BOLD_PATH);
const PAGE = { width: 595.28, height: 841.89, margin: 48 };
const COLORS = {
  ink: rgb(0.08, 0.20, 0.19), muted: rgb(0.37, 0.48, 0.46),
  teal: rgb(0.08, 0.50, 0.51), tealDark: rgb(0.03, 0.36, 0.37),
  pale: rgb(0.94, 0.97, 0.96), line: rgb(0.81, 0.87, 0.85), white: rgb(1, 1, 1),
  test: rgb(0.73, 0.40, 0.17)
};

function safeText(value) {
  return String(value == null ? "" : value)
    .normalize("NFKC")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function embedUnicodeFonts(pdf) {
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(FONT_REGULAR, { subset: true });
  const bold = await pdf.embedFont(FONT_BOLD, { subset: true });
  return { regular, bold };
}

function money(cents) {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(cents || 0) / 100) + " EUR";
}

function dateDE(value) {
  if (!value) return "-";
  const date = new Date(String(value).slice(0, 10) + "T12:00:00Z");
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("de-DE", { timeZone: "UTC" }).format(date);
}

function decimalMilli(value) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(Number(value || 0) / 1000);
}

function splitLongToken(token, font, size, maxWidth) {
  const parts = [];
  let current = "";
  for (const char of token) {
    const candidate = current + char;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      parts.push(current);
      current = char;
    } else current = candidate;
  }
  if (current) parts.push(current);
  return parts;
}

function wrap(text, font, size, maxWidth) {
  const source = safeText(text);
  if (!source) return [""];
  const words = source.split(" ").flatMap((word) =>
    font.widthOfTextAtSize(word, size) > maxWidth ? splitLongToken(word, font, size, maxWidth) : [word]
  );
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? line + " " + word : word;
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  });
  if (line) lines.push(line);
  return lines;
}

function drawLines(page, lines, x, y, options) {
  const size = options.size || 9;
  const lineHeight = options.lineHeight || size * 1.3;
  lines.forEach((line, index) => page.drawText(safeText(line), {
    x, y: y - index * lineHeight, size, font: options.font,
    color: options.color || COLORS.ink
  }));
  return y - lines.length * lineHeight;
}

function rightText(page, text, right, y, font, size, color) {
  const clean = safeText(text);
  page.drawText(clean, { x: right - font.widthOfTextAtSize(clean, size), y, font, size, color: color || COLORS.ink });
}

function fitSize(text, font, maxWidth, preferred, minimum) {
  const clean = safeText(text);
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(clean, size) > maxWidth) size -= 0.25;
  return size;
}

function taxGroups(items) {
  const groups = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const rate = Number(item && item.tax_rate_bps) || 0;
    const current = groups.get(rate) || { tax_rate_bps: rate, net_cents: 0, tax_cents: 0 };
    current.net_cents += Number(item && item.net_cents) || 0;
    current.tax_cents += Number(item && item.tax_cents) || 0;
    groups.set(rate, current);
  });
  return Array.from(groups.values()).sort((left, right) => left.tax_rate_bps - right.tax_rate_bps);
}

function taxIdentityText(seller) {
  const source = seller || {};
  if (safeText(source.vatId)) return "USt-IdNr.: " + safeText(source.vatId);
  if (safeText(source.taxNumber)) return "Steuernummer: " + safeText(source.taxNumber);
  return "";
}

function sellerForInvoice(invoice) {
  const source = invoice && invoice.snapshot && invoice.snapshot.seller || {};
  const identityReady = [source.legalName, source.street, source.postalCode, source.city].every((value) => safeText(value));
  const paymentReady = Boolean(safeText(source.accountHolder) && safeText(source.iban));
  const taxReady = Boolean(taxIdentityText(source));

  if (!invoice || !invoice.is_test) {
    if (!identityReady || !paymentReady || !taxReady) {
      throw new Error("Pravni račun nima popolnih podatkov izdajatelja, davčne identitete ali plačila.");
    }
    return { seller: source, testIdentity: false, testPayment: false, testTax: false };
  }

  return {
    seller: Object.assign({}, source, identityReady ? {} : {
      legalName: "TEST-Unternehmen",
      street: "Musterstraße 1",
      postalCode: "00000",
      city: "Teststadt"
    }),
    testIdentity: !identityReady,
    testPayment: !paymentReady,
    testTax: !taxReady
  };
}

function propertyRetentionNote(draft) {
  const source = draft || {};
  if (source.customer_type !== "private" || (!source.property_related && !source.handwerker_35a)) return "";
  return "Der Leistungsempfänger ist verpflichtet, diese Rechnung, einen Zahlungsbeleg oder eine andere beweiskräftige Unterlage zwei Jahre aufzubewahren (§ 14b Abs. 1 UStG).";
}

function constructionWithholdingNote(draft) {
  const source = draft || {};
  if (!source.construction_withholding) return "";
  const labels = {
    valid: "gültig",
    missing: "nicht vorgelegt",
    not_applicable: "nicht relevant",
    unknown: "noch nicht geprüft"
  };
  return "Bauleistung nach § 48 EStG. Freistellungsbescheinigung: " + (labels[source.exemption_certificate] || labels.unknown) + ".";
}

function drawTestWatermark(page, bold) {
  page.drawText("TESTRECHNUNG", {
    x: 103, y: 365, size: 48, font: bold, color: rgb(0.93, 0.84, 0.78),
    rotate: degrees(28), opacity: 0.25
  });
}

async function ustvariRacunPdf(invoice) {
  if (!invoice || !invoice.snapshot) throw new Error("Manjka zaklenjen posnetek računa.");
  const pdf = await PDFDocument.create();
  pdf.setTitle("Rechnung " + safeText(invoice.invoice_number));
  pdf.setAuthor("Uspešni Ježek POS");
  pdf.setSubject(invoice.is_test ? "Testrechnung" : "Rechnung");
  pdf.setCreator(GENERATOR_VERSION);
  pdf.setProducer(GENERATOR_VERSION);
  pdf.setCreationDate(new Date(invoice.issued_at || Date.now()));
  pdf.setModificationDate(new Date(invoice.issued_at || Date.now()));

  const { regular, bold } = await embedUnicodeFonts(pdf);
  const sellerInfo = sellerForInvoice(invoice);
  const seller = sellerInfo.seller;
  const draft = invoice.snapshot.draft || {};
  const items = Array.isArray(draft.items) ? draft.items : [];
  const pages = [];
  let page;
  let y;

  function addPage(continuation) {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    if (invoice.is_test) drawTestWatermark(page, bold);
    page.drawRectangle({ x: 0, y: PAGE.height - 88, width: PAGE.width, height: 88, color: COLORS.tealDark });
    const sellerName = safeText(seller.legalName || "Unternehmen");
    const sellerSize = fitSize(sellerName, bold, 300, 16, 10.5);
    page.drawText(sellerName, { x: PAGE.margin, y: PAGE.height - 48, font: bold, size: sellerSize, color: COLORS.white });
    const headerTitle = continuation ? "Rechnung - Fortsetzung" : (invoice.is_test ? "TESTRECHNUNG" : "RECHNUNG");
    rightText(page, headerTitle, PAGE.width - PAGE.margin, PAGE.height - 48, bold, 13, COLORS.white);
    rightText(page, invoice.invoice_number, PAGE.width - PAGE.margin, PAGE.height - 65, regular, 8, COLORS.white);
    y = PAGE.height - 116;
    return page;
  }

  function ensureSpace(required, continuation) {
    if (y - required < 70) addPage(continuation !== false);
  }

  addPage(false);

  const sellerAddress = [seller.street, [seller.postalCode, seller.city].filter(Boolean).join(" ")].filter(Boolean).map(safeText);
  page.drawText("Absender", { x: PAGE.margin, y, font: bold, size: 7.5, color: COLORS.muted });
  y = drawLines(page, [seller.legalName].concat(sellerAddress), PAGE.margin, y - 15, { font: regular, size: 9, lineHeight: 12 }) - 8;

  const customer = [draft.customer_name, draft.customer_street, [draft.customer_postal_code, draft.customer_city].filter(Boolean).join(" ")].filter(Boolean);
  page.drawText("Rechnung an", { x: PAGE.margin, y, font: bold, size: 7.5, color: COLORS.muted });
  y = drawLines(page, customer, PAGE.margin, y - 15, { font: customer.length ? regular : bold, size: 10, lineHeight: 13 }) - 8;

  const metaX = 332;
  const metaY = PAGE.height - 125;
  page.drawRectangle({ x: metaX, y: metaY - 100, width: 215, height: 106, color: COLORS.pale, borderColor: COLORS.line, borderWidth: 0.7 });
  const meta = [
    ["Rechnungsnummer", invoice.invoice_number],
    ["Ausstellungsdatum", dateDE(invoice.issue_date)],
    ["Leistungsdatum", dateDE(invoice.service_date)],
    ["Fällig am", dateDE(invoice.due_date)]
  ];
  meta.forEach((entry, index) => {
    const yy = metaY - 18 - index * 21;
    page.drawText(entry[0], { x: metaX + 12, y: yy, font: regular, size: 7.5, color: COLORS.muted });
    rightText(page, entry[1], metaX + 203, yy, bold, 8.5, COLORS.ink);
  });

  y = Math.min(y, metaY - 122);
  page.drawText("Leistungen", { x: PAGE.margin, y, font: bold, size: 12, color: COLORS.tealDark });
  y -= 18;

  const columns = { desc: PAGE.margin, qty: 306, unit: 369, tax: 445, total: 547 };
  function tableHeader() {
    page.drawRectangle({ x: PAGE.margin, y: y - 5, width: PAGE.width - PAGE.margin * 2, height: 22, color: COLORS.pale });
    page.drawText("Beschreibung", { x: columns.desc + 7, y: y + 3, font: bold, size: 7.5, color: COLORS.tealDark });
    rightText(page, "Menge", columns.qty + 43, y + 3, bold, 7.5, COLORS.tealDark);
    rightText(page, "Einzelpreis", columns.unit + 63, y + 3, bold, 7.5, COLORS.tealDark);
    rightText(page, "USt.", columns.tax + 38, y + 3, bold, 7.5, COLORS.tealDark);
    rightText(page, "Betrag", columns.total, y + 3, bold, 7.5, COLORS.tealDark);
    y -= 14;
  }
  tableHeader();

  items.forEach((item, index) => {
    const lines = wrap(item.description || "Leistung", regular, 8.5, 235);
    const rowHeight = Math.max(28, lines.length * 11 + 12);
    if (y - rowHeight < 98) { addPage(true); page.drawText("Leistungen (Fortsetzung)", { x: PAGE.margin, y, font: bold, size: 11, color: COLORS.tealDark }); y -= 19; tableHeader(); }
    page.drawLine({ start: { x: PAGE.margin, y: y - rowHeight + 6 }, end: { x: PAGE.width - PAGE.margin, y: y - rowHeight + 6 }, thickness: 0.5, color: COLORS.line });
    drawLines(page, lines, columns.desc + 7, y - 9, { font: regular, size: 8.5, lineHeight: 11 });
    const qty = decimalMilli(item.quantity_milli) + " " + safeText(item.unit || "");
    rightText(page, qty, columns.qty + 43, y - 9, regular, 8, COLORS.ink);
    rightText(page, money(item.unit_price_cents), columns.unit + 63, y - 9, regular, 8, COLORS.ink);
    rightText(page, (Number(item.tax_rate_bps || 0) / 100) + " %", columns.tax + 38, y - 9, regular, 8, COLORS.ink);
    rightText(page, money(item.gross_cents), columns.total, y - 9, bold, 8.3, COLORS.ink);
    y -= rowHeight;
  });

  const vatRows = taxGroups(items);
  const workflow = draft.workflow_context && typeof draft.workflow_context === "object" ? draft.workflow_context : {};
  const deductions = Array.isArray(workflow.final_deductions) ? workflow.final_deductions : [];
  const serviceNetCents = items.reduce((sum, item) => sum + (Number(item && item.net_cents) || 0), 0);
  const serviceTaxCents = items.reduce((sum, item) => sum + (Number(item && item.tax_cents) || 0), 0);
  const serviceGrossCents = serviceNetCents + serviceTaxCents;
  const summaryRows = [["Nettobetrag", serviceNetCents]].concat(
    vatRows.map((group) => ["USt. " + (group.tax_rate_bps / 100) + " %", group.tax_cents])
  );
  if (!vatRows.length) summaryRows.push(["Umsatzsteuer", serviceTaxCents]);
  if (deductions.length) {
    summaryRows.push(["Auftragssumme brutto", serviceGrossCents]);
    deductions.forEach((entry) => {
      summaryRows.push([
        "Abschlag " + safeText(entry.invoice_number || entry.invoice_id) + " (Netto " + money(entry.net_cents) + ", USt. " + money(entry.tax_cents) + ")",
        -(Number(entry.gross_cents) || 0)
      ]);
    });
  }
  ensureSpace(130 + summaryRows.length * 18);
  const totalX = 335;
  const totalWidth = 212;
  y -= 5;
  summaryRows.forEach((entry) => {
    const labelSize = fitSize(entry[0], regular, 145, 9, 6.5);
    page.drawText(entry[0], { x: totalX, y, font: regular, size: labelSize, color: COLORS.muted });
    rightText(page, money(entry[1]), totalX + totalWidth, y, regular, 9, COLORS.ink);
    y -= 18;
  });
  page.drawLine({ start: { x: totalX, y: y + 10 }, end: { x: totalX + totalWidth, y: y + 10 }, thickness: 1, color: COLORS.teal });
  page.drawText(deductions.length ? "Noch zu zahlen" : "Gesamtbetrag", { x: totalX, y: y - 3, font: bold, size: 11, color: COLORS.tealDark });
  rightText(page, money(invoice.gross_cents), totalX + totalWidth, y - 3, bold, 12, COLORS.tealDark);
  y -= 42;

  const notes = [];
  if (draft.replacement_cancellation_number && draft.replacement_original_number) {
    notes.push("Ersatzrechnung zur Stornorechnung " + safeText(draft.replacement_cancellation_number) + "; ursprüngliche Rechnung " + safeText(draft.replacement_original_number) + ".");
  }
  if (invoice.tax_mode === "small_business") notes.push("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.");
  if (invoice.tax_mode === "reverse_charge") notes.push("Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.");
  if (deductions.length) notes.push("Vereinnahmte Teilentgelte und die darauf entfallende Umsatzsteuer wurden gemäß § 14 Abs. 5 UStG abgesetzt.");
  if (draft.handwerker_35a) notes.push("Begünstigte Arbeits-, Fahrt- und Maschinenkosten nach § 35a EStG: " + money(invoice.eligible_35a_cents) + ". Die steuerliche Anerkennung prüft das Finanzamt.");
  const constructionNote = constructionWithholdingNote(draft);
  if (constructionNote) notes.push(constructionNote);
  if (draft.consumer_default_notice && draft.customer_type === "private") notes.push("Sie geraten spätestens 30 Tage nach Fälligkeit und Zugang dieser Rechnung in Verzug (§ 286 Abs. 3 BGB).");
  const retentionNote = propertyRetentionNote(draft);
  if (retentionNote) notes.push(retentionNote);
  if (invoice.is_test) notes.unshift("Dieses Dokument ist eine TESTRECHNUNG und nicht für den Rechts- oder Geschäftsverkehr bestimmt.");
  if (notes.length) {
    const noteLines = notes.flatMap((note) => wrap(note, regular, 8, PAGE.width - PAGE.margin * 2 - 18));
    const noteHeight = noteLines.length * 10.5 + 20;
    ensureSpace(noteHeight + 12);
    page.drawRectangle({ x: PAGE.margin, y: y - noteHeight + 6, width: PAGE.width - PAGE.margin * 2, height: noteHeight, color: COLORS.pale });
    drawLines(page, noteLines, PAGE.margin + 9, y - 8, { font: regular, size: 8, lineHeight: 10.5, color: COLORS.ink });
    y -= noteHeight + 10;
  }

  const paymentLines = sellerInfo.testPayment ? [
    "Keine Zahlung - TESTDOKUMENT",
    "Kontoinhaber: TEST - kein echter Zahlungsempfänger",
    "IBAN: NICHT VORHANDEN",
    "Verwendungszweck: " + safeText(invoice.invoice_number)
  ] : [
    "Zahlung per Überweisung",
    "Kontoinhaber: " + safeText(seller.accountHolder || seller.legalName),
    "IBAN: " + safeText(seller.iban),
    "Verwendungszweck: " + safeText(invoice.invoice_number)
  ];
  ensureSpace(86);
  page.drawText(paymentLines[0], { x: PAGE.margin, y, font: bold, size: 9.5, color: COLORS.tealDark });
  drawLines(page, paymentLines.slice(1), PAGE.margin, y - 16, { font: regular, size: 8.5, lineHeight: 12, color: COLORS.ink });
  const taxIdentity = taxIdentityText(seller) || (sellerInfo.testTax ? "Steuerdaten: TEST - nicht vorhanden" : "");
  if (taxIdentity) rightText(page, taxIdentity, PAGE.width - PAGE.margin, y - 16, regular, 8.2, COLORS.muted);
  if (seller.businessEmail) rightText(page, safeText(seller.businessEmail), PAGE.width - PAGE.margin, y - 30, regular, 8.2, COLORS.muted);

  pages.forEach((current, index) => {
    current.drawLine({ start: { x: PAGE.margin, y: 50 }, end: { x: PAGE.width - PAGE.margin, y: 50 }, thickness: 0.5, color: COLORS.line });
    current.drawText("Unveränderliches Rechnungsdokument - " + GENERATOR_VERSION, { x: PAGE.margin, y: 34, font: regular, size: 6.7, color: COLORS.muted });
    rightText(current, "Seite " + (index + 1) + " / " + pages.length, PAGE.width - PAGE.margin, 34, regular, 6.7, COLORS.muted);
  });

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

module.exports = { GENERATOR_VERSION, safeText, money, dateDE, wrap, taxGroups, taxIdentityText, sellerForInvoice, propertyRetentionNote, constructionWithholdingNote, embedUnicodeFonts, ustvariRacunPdf };
