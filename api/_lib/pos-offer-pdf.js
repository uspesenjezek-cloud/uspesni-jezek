"use strict";

const { PDFDocument, rgb } = require("pdf-lib");
const { safeText, money, dateDE, wrap, fitSize, drawHeaderSeller, taxGroups, priceMode, lineDisplayAmount, taxIdentityText, sellerLegalDisclosureLines, embedUnicodeFonts } = require("./pos-pdf");

const GENERATOR_VERSION = "uj-pos-offer-pdf-6";
const CONTRACT_CONFIRMATION_GENERATOR_VERSION = "uj-pos-contract-confirmation-pdf-4";
const PAGE = { width: 595.28, height: 841.89, margin: 48 };
const COLORS = {
  ink: rgb(0.08, 0.19, 0.18), muted: rgb(0.38, 0.48, 0.46),
  tealDark: rgb(0.03, 0.39, 0.39), pale: rgb(0.93, 0.97, 0.96),
  line: rgb(0.79, 0.86, 0.84), white: rgb(1, 1, 1)
};
const REGISTERED_LEGAL_FORMS = ["e.K.", "eGbR", "OHG", "KG", "GmbH & Co. KG", "UG (haftungsbeschränkt)", "GmbH", "AG", "eG"];

function rightText(page, value, right, y, font, size, color) {
  const clean = safeText(value);
  page.drawText(clean, { x: right - font.widthOfTextAtSize(clean, size), y, font, size, color: color || COLORS.ink });
}

function normalizeOffer(workOrder) {
  const payload = workOrder && workOrder.locked_payload;
  const seller = payload && payload.seller || {};
  const items = payload && Array.isArray(payload.items) ? payload.items : [];
  const registered = REGISTERED_LEGAL_FORMS.includes(safeText(seller.legalForm));
  if (!workOrder || workOrder.status === "draft" || !payload || typeof payload !== "object") throw new Error("Ponudba še ni zaklenjena.");
  if (![seller.legalName, seller.legalForm, seller.representative, seller.street, seller.postalCode, seller.city].every((value) => safeText(value))) throw new Error("Ponudba nima popolnih pravnih podatkov izdajatelja.");
  if (registered && ![seller.companySeat, seller.registerCourt, seller.registerNumber].every((value) => safeText(value))) throw new Error("Ponudba nima popolnih registrskih podatkov izdajatelja.");
  if (![workOrder.offer_number, workOrder.customer_name, payload.customer_street, payload.customer_postal_code, payload.customer_city, payload.issue_date, workOrder.valid_until].every((value) => safeText(value))) throw new Error("Ponudba nima popolnih podatkov dokumenta ali naročnika.");
  if (!items.length) throw new Error("Ponudba nima postavk.");
  items.forEach((item) => {
    if (!safeText(item && item.description) || Number(item && item.quantity_milli) <= 0 || Number(item && item.gross_cents) < 0) throw new Error("Ponudba vsebuje neveljavno postavko.");
  });
  if (payload.customer_type === "private") {
    const context = safeText(payload.consumer_contract_context);
    if (!["business_premises", "distance", "off_premises", "urgent_repair"].includes(context)) throw new Error("Ponudba nima veljavnega načina sklenitve potrošniške pogodbe.");
    if (["distance", "off_premises"].includes(context) && ![seller.businessEmail, seller.businessPhone].every((value) => safeText(value))) throw new Error("Widerrufsbelehrung zahteva poslovni e-poštni naslov in telefon.");
    if (context === "urgent_repair" && safeText(payload.urgent_repair_scope).length < 5) throw new Error("Nujno popravilo nima dovolj natančnega obsega.");
  }
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

  function addPage(continuation, headerLabel) {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: PAGE.height - 88, width: PAGE.width, height: 88, color: COLORS.tealDark });
    drawHeaderSeller(page, seller.legalName, bold, {
      x: PAGE.margin, baseline: PAGE.height - 48, maxWidth: 278,
      preferred: 15, minimum: 8.5, color: COLORS.white
    });
    rightText(page, headerLabel || (continuation ? "ANGEBOT - FORTSETZUNG" : "ANGEBOT"), PAGE.width - PAGE.margin, PAGE.height - 48, bold, 13, COLORS.white);
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
  drawLines(
    [seller.legalName, seller.street, [seller.postalCode, seller.city].filter(Boolean).join(" ")]
      .flatMap((line) => wrap(line, regular, 8.8, 250)),
    PAGE.margin, 8.8, 11.5, regular
  );
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
  drawLines(
    [workOrder.customer_name, payload.customer_street, [payload.customer_postal_code, payload.customer_city].filter(Boolean).join(" ")]
      .flatMap((line) => wrap(line, regular, 9.5, 250)),
    PAGE.margin, 9.5, 12.5, regular
  );
  y = Math.min(y - 7, metaY - 100);
  drawLines(wrap(workOrder.title, bold, 12, PAGE.width - PAGE.margin * 2), PAGE.margin, 12, 15.5, bold, COLORS.tealDark);
  y -= 4.5;
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
  if (seller.businessEmail) {
    const emailSize = fitSize(seller.businessEmail, regular, 245, 7.6, 5.5);
    rightText(page, seller.businessEmail, PAGE.width - PAGE.margin, y, regular, emailSize, COLORS.muted);
  }

  function drawWrappedParagraph(text, options) {
    const settings = options || {};
    const size = settings.size || 8.3;
    const lineHeight = settings.lineHeight || 11.2;
    const x = settings.x || PAGE.margin;
    const width = settings.width || PAGE.width - PAGE.margin * 2;
    wrap(text, settings.font || regular, size, width).forEach((line) => {
      page.drawText(line, { x, y, font: settings.font || regular, size, color: settings.color || COLORS.ink });
      y -= lineHeight;
    });
    y -= settings.after == null ? 8 : settings.after;
  }

  function addConsumerPage(title) {
    addPage(false, "VERBRAUCHERINFORMATION");
    page.drawText(title, { x: PAGE.margin, y, font: bold, size: 15, color: COLORS.tealDark });
    y -= 24;
  }

  const consumerContext = payload.customer_type === "private" ? safeText(payload.consumer_contract_context) : "";
  if (["distance", "off_premises"].includes(consumerContext)) {
    addConsumerPage("Widerrufsbelehrung");
    page.drawText("Widerrufsrecht", { x: PAGE.margin, y, font: bold, size: 10, color: COLORS.ink });
    y -= 16;
    drawWrappedParagraph("Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.");
    drawWrappedParagraph("Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.");
    drawWrappedParagraph("Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (" + safeText(seller.legalName) + ", " + safeText(seller.street) + ", " + safeText(seller.postalCode) + " " + safeText(seller.city) + ", Telefon: " + safeText(seller.businessPhone) + ", E-Mail: " + safeText(seller.businessEmail) + ") mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.");
    drawWrappedParagraph("Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.");
    page.drawText("Folgen des Widerrufs", { x: PAGE.margin, y, font: bold, size: 10, color: COLORS.ink });
    y -= 16;
    drawWrappedParagraph("Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist.");
    drawWrappedParagraph("Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.");
    drawWrappedParagraph("Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.");
    page.drawText("Muster nach Anlage 1 zu Artikel 246a § 1 Absatz 2 Satz 2 EGBGB.", { x: PAGE.margin, y, font: regular, size: 6.8, color: COLORS.muted });

    addConsumerPage("Muster-Widerrufsformular");
    drawWrappedParagraph("Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.");
    drawWrappedParagraph("An: " + safeText(seller.legalName) + ", " + safeText(seller.street) + ", " + safeText(seller.postalCode) + " " + safeText(seller.city) + ", E-Mail: " + safeText(seller.businessEmail), { font: bold });
    drawWrappedParagraph("Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*):");
    drawWrappedParagraph("Angebot: " + safeText(workOrder.offer_number) + " · " + safeText(workOrder.title));
    drawWrappedParagraph("Bestellt am (*): ______________________________________________");
    drawWrappedParagraph("Name des/der Verbraucher(s): __________________________________");
    drawWrappedParagraph("Anschrift des/der Verbraucher(s): ______________________________");
    drawWrappedParagraph("Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):");
    drawWrappedParagraph("________________________________________________________________");
    drawWrappedParagraph("Datum: ______________________       (*) Unzutreffendes streichen.", { after: 18 });
    page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.width - PAGE.margin, y }, thickness: 0.8, color: COLORS.line });
    y -= 23;
    page.drawText("Ausdrückliches Verlangen zum vorzeitigen Beginn", { x: PAGE.margin, y, font: bold, size: 10, color: COLORS.tealDark });
    y -= 17;
    drawWrappedParagraph("[  ] Ich verlange ausdrücklich, dass der Unternehmer vor Ablauf der vierzehntägigen Widerrufsfrist mit der angebotenen Dienstleistung beginnt. Mir ist bekannt, dass ich bei einem Widerruf Wertersatz für die bis zum Widerruf erbrachten Leistungen schulde. Mir ist außerdem bekannt, dass mein Widerrufsrecht bei vollständiger Vertragserfüllung erlischt, wenn die gesetzlichen Voraussetzungen erfüllt sind.", { size: 8, lineHeight: 10.7 });
    drawWrappedParagraph("Ort, Datum: ____________________   Unterschrift: ____________________", { after: 2 });
    page.drawText("Diese Erklärung nur abgeben, wenn ein Beginn vor Ablauf der Widerrufsfrist gewünscht ist.", { x: PAGE.margin, y, font: regular, size: 6.8, color: COLORS.muted });
  } else if (consumerContext === "urgent_repair") {
    addConsumerPage("Ausdrücklich verlangte dringende Reparatur");
    drawWrappedParagraph("Die Ausnahme vom Widerrufsrecht nach § 312g Absatz 2 Nummer 11 BGB gilt nur für ausdrücklich verlangte dringende Reparatur- oder Instandhaltungsarbeiten und unbedingt benötigte Ersatzteile. Weitere, nicht ausdrücklich verlangte Dienstleistungen oder nicht unbedingt benötigte Waren sind davon nicht umfasst.");
    page.drawText("Genau beauftragter dringender Umfang", { x: PAGE.margin, y, font: bold, size: 10, color: COLORS.ink });
    y -= 17;
    drawWrappedParagraph(safeText(payload.urgent_repair_scope), { font: bold, size: 9, lineHeight: 12, after: 18 });
    page.drawRectangle({ x: PAGE.margin, y: y - 108, width: PAGE.width - PAGE.margin * 2, height: 116, color: COLORS.pale, borderColor: COLORS.line, borderWidth: 0.8 });
    y -= 18;
    drawWrappedParagraph("[  ] Ich habe den Unternehmer ausdrücklich aufgefordert, mich zur Ausführung der oben bezeichneten dringenden Reparatur- oder Instandhaltungsarbeiten aufzusuchen. Mir ist bekannt, dass die Ausnahme nur den ausdrücklich verlangten Umfang und unbedingt erforderliche Ersatzteile erfasst.", { x: PAGE.margin + 12, width: PAGE.width - PAGE.margin * 2 - 24, size: 8, lineHeight: 10.8, after: 14 });
    page.drawText("Ort, Datum: ____________________   Unterschrift: ____________________", { x: PAGE.margin + 12, y, font: regular, size: 8, color: COLORS.ink });
  }

  pages.forEach((current, index) => {
    current.drawLine({ start: { x: PAGE.margin, y: 50 }, end: { x: PAGE.width - PAGE.margin, y: 50 }, thickness: 0.5, color: COLORS.line });
    current.drawText("Unveränderliches Angebotsdokument - " + GENERATOR_VERSION, { x: PAGE.margin, y: 34, font: regular, size: 6.7, color: COLORS.muted });
    rightText(current, "Seite " + (index + 1) + " / " + pages.length, PAGE.width - PAGE.margin, 34, regular, 6.7, COLORS.muted);
  });

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

async function ustvariPogodbenoPotrdiloPdf(workOrder, acceptance, archivedOfferPdf) {
  const { payload, seller } = normalizeOffer(workOrder);
  const acceptedOn = safeText(workOrder.accepted_on || acceptance && acceptance.accepted_on);
  if (!safeText(workOrder.order_number) || !acceptedOn || !acceptance || !safeText(acceptance.offer_sha256)) {
    throw new Error("Pogodbeno potrdilo zahteva naročilo, dejanski datum sprejema in dokaz arhivirane ponudbe.");
  }
  if (!["accepted", "in_progress", "completed", "invoiced", "withdrawn"].includes(safeText(workOrder.status))) {
    throw new Error("Pogodbeno potrdilo je na voljo šele po sprejemu ponudbe.");
  }
  const sourceBytes = Buffer.isBuffer(archivedOfferPdf) ? archivedOfferPdf : Buffer.from(archivedOfferPdf || []);
  if (sourceBytes.length < 4 || sourceBytes.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new Error("Arhivirani PDF ponudbe ni veljaven.");
  }

  const source = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  const pdf = await PDFDocument.create();
  pdf.setTitle("Vertragsbestätigung " + safeText(workOrder.order_number));
  pdf.setAuthor("Uspešni Ježek POS");
  pdf.setSubject("Vertragsbestätigung gemäß § 312f BGB");
  pdf.setCreator(CONTRACT_CONFIRMATION_GENERATOR_VERSION);
  pdf.setProducer(CONTRACT_CONFIRMATION_GENERATOR_VERSION);
  const createdAt = new Date(acceptance.recorded_at || acceptance.accepted_at || Date.now());
  pdf.setCreationDate(createdAt);
  pdf.setModificationDate(createdAt);
  const { regular, bold } = await embedUnicodeFonts(pdf);
  const cover = pdf.addPage([PAGE.width, PAGE.height]);
  cover.drawRectangle({ x: 0, y: PAGE.height - 110, width: PAGE.width, height: 110, color: COLORS.tealDark });
  drawHeaderSeller(cover, seller.legalName, bold, {
    x: PAGE.margin, baseline: PAGE.height - 52, maxWidth: 278,
    preferred: 15, minimum: 8.5, color: COLORS.white
  });
  rightText(cover, "VERTRAGSBESTÄTIGUNG", PAGE.width - PAGE.margin, PAGE.height - 52, bold, 12, COLORS.white);
  rightText(cover, workOrder.order_number, PAGE.width - PAGE.margin, PAGE.height - 72, regular, 8, COLORS.white);

  let y = PAGE.height - 154;
  cover.drawText("Bestätigung des geschlossenen Vertrags", { x: PAGE.margin, y, font: bold, size: 17, color: COLORS.tealDark });
  y -= 36;
  const rows = [
    ["Auftragsnummer", workOrder.order_number],
    ["Angebotsnummer", workOrder.offer_number],
    ["Vertrag geschlossen am", dateDE(acceptedOn)],
    ["Auftraggeber", workOrder.customer_name],
    ["Projekt", workOrder.title]
  ];
  rows.forEach(([label, value]) => {
    cover.drawText(label, { x: PAGE.margin, y, font: regular, size: 8, color: COLORS.muted });
    const valueLines = wrap(value, bold, 9, PAGE.width - PAGE.margin - 205);
    valueLines.forEach((line, index) => {
      cover.drawText(line, { x: 205, y: y - index * 11, font: bold, size: 9, color: COLORS.ink });
    });
    y -= Math.max(25, valueLines.length * 11 + 5);
  });
  y -= 12;
  const paragraphs = [
    "Dieses Dokument bestätigt den am " + dateDE(acceptedOn) + " geschlossenen Vertrag. Die folgenden Seiten geben den vereinbarten Vertragsinhalt einschließlich Leistungsbeschreibung, Preisen und der bei Vertragsschluss bereitgestellten Verbraucherinformationen wieder.",
    "Die nachfolgenden Seiten sind die unveränderte, archivierte Angebotsfassung, auf die sich die Annahme bezieht. Angebotsnummer und SHA-256-Prüfsumme verbinden diese Bestätigung mit genau diesem Dokument.",
    "SHA-256 des angenommenen Angebots: " + safeText(acceptance.offer_sha256)
  ];
  paragraphs.forEach((paragraph, index) => {
    wrap(paragraph, index === 2 ? regular : regular, index === 2 ? 7.2 : 9, PAGE.width - PAGE.margin * 2).forEach((line) => {
      cover.drawText(line, { x: PAGE.margin, y, font: regular, size: index === 2 ? 7.2 : 9, color: index === 2 ? COLORS.muted : COLORS.ink });
      y -= index === 2 ? 9 : 12.5;
    });
    y -= 12;
  });
  cover.drawRectangle({ x: PAGE.margin, y: 112, width: PAGE.width - PAGE.margin * 2, height: 62, color: COLORS.pale, borderColor: COLORS.line, borderWidth: 0.7 });
  cover.drawText("Dauerhafter Datenträger", { x: PAGE.margin + 14, y: 150, font: bold, size: 9, color: COLORS.tealDark });
  wrap("Diese PDF-Datei ist zur unveränderten Aufbewahrung und Weitergabe bestimmt. Bitte stellen Sie sie dem Verbraucher entsprechend § 312f BGB auf Papier oder einem zulässigen dauerhaften Datenträger zur Verfügung.", regular, 7.8, PAGE.width - PAGE.margin * 2 - 28).forEach((line, index) => {
    cover.drawText(line, { x: PAGE.margin + 14, y: 133 - index * 10, font: regular, size: 7.8, color: COLORS.ink });
  });
  cover.drawLine({ start: { x: PAGE.margin, y: 50 }, end: { x: PAGE.width - PAGE.margin, y: 50 }, thickness: 0.5, color: COLORS.line });
  cover.drawText("Unveränderliche Vertragsbestätigung - " + CONTRACT_CONFIRMATION_GENERATOR_VERSION, { x: PAGE.margin, y: 34, font: regular, size: 6.7, color: COLORS.muted });
  rightText(cover, "Seite 1 / " + (source.getPageCount() + 1), PAGE.width - PAGE.margin, 34, regular, 6.7, COLORS.muted);

  const copiedPages = await pdf.copyPages(source, source.getPageIndices());
  copiedPages.forEach((copiedPage) => pdf.addPage(copiedPage));
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

module.exports = {
  GENERATOR_VERSION,
  CONTRACT_CONFIRMATION_GENERATOR_VERSION,
  normalizeOffer,
  ustvariPonudboPdf,
  ustvariPogodbenoPotrdiloPdf
};
