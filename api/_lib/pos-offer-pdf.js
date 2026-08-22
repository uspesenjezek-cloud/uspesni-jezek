"use strict";

const { PDFDocument, rgb } = require("pdf-lib");
const { safeText, money, dateDE, wrap, taxGroups, priceMode, lineDisplayAmount, taxIdentityText, sellerLegalDisclosureLines, embedUnicodeFonts } = require("./pos-pdf");

const GENERATOR_VERSION = "uj-pos-offer-pdf-2";
const PAGE = { width: 595.28, height: 841.89, margin: 48 };
const COLORS = {
  ink: rgb(0.08, 0.19, 0.18), muted: rgb(0.38, 0.48, 0.46),
  tealDark: rgb(0.03, 0.39, 0.39), pale: rgb(0.93, 0.97, 0.96),
  line: rgb(0.79, 0.86, 0.84), white: rgb(1, 1, 1)
};

function rightText(page, value, right, y, font, size, color) {
  const clean = safeText(value);
  page.drawText(clean, { x: right - font.widthOfTextAtSize(clean, size), y, font, size, color: color || COLORS.ink });
}

function normalizeOffer(workOrder) {
  const payload = workOrder && workOrder.locked_payload;
  const seller = payload && payload.seller || {};
  const items = payload && Array.isArray(payload.items) ? payload.items : [];
  const registered = ["e.K.", "eGbR", "UG (haftungsbeschränkt)", "GmbH"].includes(safeText(seller.legalForm));
  if (!workOrder || workOrder.status === "draft" || !payload || typeof payload !== "object") throw new Error("Ponudba še ni zaklenjena.");
  if (![seller.legalName, seller.legalForm, seller.representative, seller.street, seller.postalCode, seller.city].every((value) => safeText(value))) throw new Error("Ponudba nima popolnih pravnih podatkov izdajatelja.");
  if (registered && ![seller.companySeat, seller.registerCourt, seller.registerNumber].every((value) => safeText(value))) throw new Error("Ponudba nima popolnih registrskih podatkov izdajatelja.");
  if (![workOrder.offer_number, workOrder.customer_name, payload.customer_street, payload.customer_postal_code, payload.customer_city, payload.issue_date, workOrder.valid_until].every((value) => safeText(value))) throw new Error("Ponudba nima popolnih podatkov dokumenta ali naročnika.");
  if (!items.length) throw new Error("Ponudba nima postavk.");
  items.forEach((item) => {
    if (!safeText(item && item.description) || Number(item && item.quantity_milli) <= 0 || Number(item && item.gross_cents) < 0) throw new Error("Ponudba vsebuje neveljavno postavko.");
  });
  return { workOrder, payload, seller, items };
}

async function ustvariPonudboPdf(workOrder) {
  const { payload, seller, items } = normalizeOffer(workOrder);
  const displayedPriceMode = priceMode(payload.price_mode);
  const priceSuffix = displayedPriceMode === "gross" ? "brutto" : "netto";
  const pdf = await PDFDocument.create();
  pdf.setTitle("Angebot " + safeText(workOrder.offer_number));
  pdf.setAuthor("Uspešni Ježek POS");
  pdf.setSubject("Angebot");
  pdf.setCreator(GENERATOR_VERSION);
  pdf.setProducer(GENERATOR_VERSION);
  pdf.setCreationDate(new Date(workOrder.offered_at || Date.now()));
  pdf.setModificationDate(new Date(workOrder.offered_at || Date.now()));
  const { regular, bold } = await embedUnicodeFonts(pdf);
  const pages = [];
  let page;
  let y;

  function addPage(continuation) {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: PAGE.height - 88, width: PAGE.width, height: 88, color: COLORS.tealDark });
    page.drawText(safeText(seller.legalName), { x: PAGE.margin, y: PAGE.height - 48, font: bold, size: 15, color: COLORS.white });
    rightText(page, continuation ? "ANGEBOT - FORTSETZUNG" : "ANGEBOT", PAGE.width - PAGE.margin, PAGE.height - 48, bold, 13, COLORS.white);
    rightText(page, workOrder.offer_number, PAGE.width - PAGE.margin, PAGE.height - 65, regular, 8, COLORS.white);
    y = PAGE.height - 116;
  }

  function drawLines(lines, x, size, lineHeight, font, color) {
    (lines || []).forEach((line) => {
      page.drawText(safeText(line), { x, y, font: font || regular, size, color: color || COLORS.ink });
      y -= lineHeight;
    });
  }

  function ensureSpace(height, withTableHeader) {
    if (y - height < 72) {
      addPage(true);
      if (withTableHeader) drawTableHeader();
    }
  }

  function drawTableHeader() {
    page.drawRectangle({ x: PAGE.margin, y: y - 5, width: PAGE.width - PAGE.margin * 2, height: 22, color: COLORS.pale });
    page.drawText("Leistung", { x: PAGE.margin + 7, y: y + 3, font: bold, size: 7.5, color: COLORS.tealDark });
    rightText(page, "Menge", 340, y + 3, bold, 7.3, COLORS.tealDark);
    rightText(page, "E-Preis " + priceSuffix, 425, y + 3, bold, 7, COLORS.tealDark);
    rightText(page, "USt.", 468, y + 3, bold, 7.3, COLORS.tealDark);
    rightText(page, "Gesamt " + priceSuffix, PAGE.width - PAGE.margin, y + 3, bold, 7, COLORS.tealDark);
    y -= 17;
  }

  addPage(false);
  page.drawText("Anbieter", { x: PAGE.margin, y, font: bold, size: 7.5, color: COLORS.muted });
  y -= 15;
  drawLines([seller.legalName, seller.street, [seller.postalCode, seller.city].filter(Boolean).join(" ")], PAGE.margin, 8.8, 11.5, regular);
  sellerLegalDisclosureLines(seller).flatMap((line) => wrap(line, regular, 7.1, 250)).forEach((line) => {
    page.drawText(line, { x: PAGE.margin, y, font: regular, size: 7.1, color: COLORS.muted });
    y -= 8.8;
  });
  y -= 5;

  const metaX = 332;
  const metaY = PAGE.height - 125;
  page.drawRectangle({ x: metaX, y: metaY - 78, width: 215, height: 84, color: COLORS.pale, borderColor: COLORS.line, borderWidth: 0.7 });
  [["Angebotsdatum", dateDE(payload.issue_date)], ["Voraussichtliche Leistung", dateDE(payload.service_date)], ["Gültig bis", dateDE(workOrder.valid_until)]].forEach((entry, index) => {
    const yy = metaY - 18 - index * 21;
    page.drawText(entry[0], { x: metaX + 12, y: yy, font: regular, size: 7.3, color: COLORS.muted });
    rightText(page, entry[1], metaX + 203, yy, bold, 8.2, COLORS.ink);
  });

  page.drawText("Angebot für", { x: PAGE.margin, y, font: bold, size: 7.5, color: COLORS.muted });
  y -= 15;
  drawLines([workOrder.customer_name, payload.customer_street, [payload.customer_postal_code, payload.customer_city].filter(Boolean).join(" ")], PAGE.margin, 9.5, 12.5, regular);
  y = Math.min(y - 7, metaY - 100);
  page.drawText(safeText(workOrder.title), { x: PAGE.margin, y, font: bold, size: 12, color: COLORS.tealDark });
  y -= 20;
  if (safeText(payload.work_description)) {
    drawLines(wrap(payload.work_description, regular, 8.5, PAGE.width - PAGE.margin * 2), PAGE.margin, 8.5, 11, regular);
    y -= 7;
  }

  drawTableHeader();
  items.forEach((item) => {
    const lines = wrap(item.description, regular, 8.2, 220);
    const height = Math.max(28, lines.length * 10 + 12);
    ensureSpace(height + 6, true);
    lines.forEach((line, index) => page.drawText(line, { x: PAGE.margin + 7, y: y - 9 - index * 10, font: regular, size: 8.2, color: COLORS.ink }));
    rightText(page, String(Number(item.quantity_milli) / 1000).replace(".", ",") + " " + safeText(item.unit || ""), 340, y - 9, regular, 7.8, COLORS.ink);
    rightText(page, money(item.unit_price_cents), 425, y - 9, regular, 7.8, COLORS.ink);
    rightText(page, (Number(item.tax_rate_bps || 0) / 100) + " %", 468, y - 9, regular, 7.8, COLORS.ink);
    rightText(page, money(lineDisplayAmount(item, displayedPriceMode)), PAGE.width - PAGE.margin, y - 9, bold, 8.1, COLORS.ink);
    y -= height;
    page.drawLine({ start: { x: PAGE.margin, y: y + 5 }, end: { x: PAGE.width - PAGE.margin, y: y + 5 }, thickness: 0.5, color: COLORS.line });
  });

  const grouped = taxGroups(items);
  const summaryRows = [["Nettobetrag", workOrder.net_cents]].concat(
    grouped.map((group) => ["USt. " + (group.tax_rate_bps / 100) + " %", group.tax_cents])
  );
  if (!grouped.length) summaryRows.push(["Umsatzsteuer", workOrder.tax_cents]);
  ensureSpace(112 + summaryRows.length * 18);
  const totalX = 330;
  summaryRows.forEach((entry) => {
    page.drawText(entry[0], { x: totalX, y, font: regular, size: 9, color: COLORS.muted });
    rightText(page, money(entry[1]), PAGE.width - PAGE.margin, y, regular, 9, COLORS.ink);
    y -= 18;
  });
  page.drawLine({ start: { x: totalX, y: y + 10 }, end: { x: PAGE.width - PAGE.margin, y: y + 10 }, thickness: 1, color: COLORS.tealDark });
  page.drawText("Angebotssumme", { x: totalX, y: y - 3, font: bold, size: 11, color: COLORS.tealDark });
  rightText(page, money(workOrder.gross_cents), PAGE.width - PAGE.margin, y - 3, bold, 12, COLORS.tealDark);
  y -= 47;

  const notes = [
    "Positionspreise und -beträge sind " + priceSuffix + " ausgewiesen.",
    "An dieses Angebot halten wir uns bis zum " + dateDE(workOrder.valid_until) + ". Der Vertrag kommt durch Annahme zustande."
  ];
  if (payload.tax_mode === "small_business") notes.push("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.");
  if (payload.tax_mode === "reverse_charge") notes.push("Vorgesehene Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.");
  if (grouped.length > 1) notes.push("Die Umsatzsteuer ist in der Summe je Steuersatz ausgewiesen.");
  drawLines(notes.flatMap((note) => wrap(note, regular, 8, PAGE.width - PAGE.margin * 2)), PAGE.margin, 8, 10.5, regular);
  y -= 8;
  const taxIdentity = taxIdentityText(seller);
  if (taxIdentity) page.drawText(taxIdentity, { x: PAGE.margin, y, font: regular, size: 7.6, color: COLORS.muted });
  if (seller.businessEmail) rightText(page, seller.businessEmail, PAGE.width - PAGE.margin, y, regular, 7.6, COLORS.muted);

  pages.forEach((current, index) => {
    current.drawLine({ start: { x: PAGE.margin, y: 50 }, end: { x: PAGE.width - PAGE.margin, y: 50 }, thickness: 0.5, color: COLORS.line });
    current.drawText("Unveränderliches Angebotsdokument - " + GENERATOR_VERSION, { x: PAGE.margin, y: 34, font: regular, size: 6.7, color: COLORS.muted });
    rightText(current, "Seite " + (index + 1) + " / " + pages.length, PAGE.width - PAGE.margin, 34, regular, 6.7, COLORS.muted);
  });

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

module.exports = { GENERATOR_VERSION, normalizeOffer, ustvariPonudboPdf };
