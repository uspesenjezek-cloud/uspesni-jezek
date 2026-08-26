"use strict";

const { PDFDocument, rgb } = require("pdf-lib");
const { embedUnicodeFonts, safeText, wrap, dateDE } = require("./pos-pdf");

const GENERATOR_VERSION = "uj-pos-verfahrensdokumentation-1";
const PAGE = { width: 595.28, height: 841.89, margin: 48 };
const COLORS = {
  ink: rgb(0.08, 0.20, 0.19), muted: rgb(0.37, 0.48, 0.46),
  teal: rgb(0.08, 0.50, 0.51), tealDark: rgb(0.03, 0.36, 0.37),
  pale: rgb(0.94, 0.97, 0.96), line: rgb(0.81, 0.87, 0.85), white: rgb(1, 1, 1)
};

function yesNo(value) {
  return value ? "Ja" : "Nein";
}

function value(value, fallback) {
  return safeText(value) || fallback || "Nicht hinterlegt";
}

function profileView(profile) {
  const source = profile || {};
  return {
    legalName: value(source.legal_name || source.legalName, "Unternehmen nicht hinterlegt"),
    legalForm: value(source.legal_form || source.legalForm),
    representative: value(source.representative),
    address: [source.street, [source.postal_code || source.postalCode, source.city].filter(Boolean).join(" ")].filter(Boolean).map(safeText).join(", ") || "Nicht hinterlegt",
    taxIdentity: value(source.vat_id || source.vatId) !== "Nicht hinterlegt"
      ? "USt-IdNr. " + value(source.vat_id || source.vatId)
      : "Steuernummer " + value(source.tax_number || source.taxNumber),
    taxStatus: (source.tax_status || source.taxStatus) === "small_business" ? "Kleinunternehmer nach § 19 UStG" : "Regelbesteuerung",
    turnoverBand: ({ lte_800k: "bis 800.000 EUR", gt_800k: "über 800.000 EUR" })[source.previous_year_turnover_band || source.previousYearTurnoverBand] || "noch nicht festgelegt"
  };
}

function archiveView(archive) {
  const source = archive || {};
  return {
    retentionYears: Math.max(8, Number(source.retentionYears || source.retention_years || 8)),
    documentCount: Math.max(0, Number(source.documentCount || source.document_count || 0)),
    verifiedCount: Math.max(0, Number(source.verifiedCount || source.verified_count || 0)),
    failureCount: Math.max(0, Number(source.failureCount || source.failure_count || 0)),
    independentBackupReady: Boolean(source.independentBackupReady || source.independent_backup_ready),
    productionReady: Boolean(source.productionReady || source.production_ready),
    wormProvider: value(source.wormProvider || source.worm_provider, "AWS S3 Object Lock"),
    objectLockMode: value(source.objectLockMode || source.object_lock_mode, "nicht aktiviert"),
    recoveryTestedAt: source.recoveryTestedAt || source.recovery_tested_at || null
  };
}

function documentModel(input) {
  const source = input || {};
  const generatedAt = new Date(source.generatedAt || Date.now());
  return {
    generatedAt: Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt,
    environment: source.environment === "production" ? "Produktion" : "Test-/Vorbereitungsbetrieb",
    appVersion: value(source.appVersion, GENERATOR_VERSION),
    profile: profileView(source.profile),
    archive: archiveView(source.archive)
  };
}

async function createProcedureDocumentationPdf(input) {
  const model = documentModel(input);
  const pdf = await PDFDocument.create();
  pdf.setTitle("Verfahrensdokumentation - " + model.profile.legalName);
  pdf.setAuthor("Uspešni Ježek POS");
  pdf.setSubject("GoBD-Verfahrensdokumentation des POS-Verfahrens");
  pdf.setCreator(GENERATOR_VERSION);
  pdf.setProducer(GENERATOR_VERSION);
  pdf.setCreationDate(model.generatedAt);
  pdf.setModificationDate(model.generatedAt);
  const { regular, bold } = await embedUnicodeFonts(pdf);
  const pages = [];
  let page;
  let y;

  function addPage() {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: PAGE.height - 76, width: PAGE.width, height: 76, color: COLORS.tealDark });
    page.drawText("VERFAHRENSDOKUMENTATION", { x: PAGE.margin, y: PAGE.height - 45, font: bold, size: 15, color: COLORS.white });
    page.drawText(model.profile.legalName, { x: PAGE.margin, y: PAGE.height - 62, font: regular, size: 8, color: COLORS.white });
    y = PAGE.height - 104;
  }

  function ensureSpace(height) {
    if (y - height < 68) addPage();
  }

  function heading(text) {
    ensureSpace(36);
    page.drawText(safeText(text), { x: PAGE.margin, y, font: bold, size: 12, color: COLORS.tealDark });
    y -= 20;
  }

  function paragraph(text, options) {
    const opts = options || {};
    const size = opts.size || 8.5;
    const lineHeight = opts.lineHeight || 12;
    const lines = wrap(text, opts.bold ? bold : regular, size, PAGE.width - PAGE.margin * 2 - (opts.inset || 0));
    ensureSpace(lines.length * lineHeight + 8);
    lines.forEach(function (line) {
      page.drawText(line, { x: PAGE.margin + (opts.inset || 0), y, font: opts.bold ? bold : regular, size, color: opts.color || COLORS.ink });
      y -= lineHeight;
    });
    y -= opts.after == null ? 7 : opts.after;
  }

  function note(text) {
    const lines = wrap(text, regular, 8, PAGE.width - PAGE.margin * 2 - 22);
    const height = lines.length * 11 + 18;
    ensureSpace(height + 8);
    page.drawRectangle({ x: PAGE.margin, y: y - height + 6, width: PAGE.width - PAGE.margin * 2, height, color: COLORS.pale, borderColor: COLORS.line, borderWidth: 0.7 });
    lines.forEach(function (line, index) {
      page.drawText(line, { x: PAGE.margin + 11, y: y - 8 - index * 11, font: regular, size: 8, color: COLORS.ink });
    });
    y -= height + 10;
  }

  function facts(rows) {
    (rows || []).forEach(function (row) {
      const labelLines = wrap(row[0], bold, 7.5, 145);
      const valueLines = wrap(row[1], regular, 8, 330);
      const count = Math.max(labelLines.length, valueLines.length);
      const height = count * 11 + 10;
      ensureSpace(height);
      page.drawRectangle({ x: PAGE.margin, y: y - height + 5, width: PAGE.width - PAGE.margin * 2, height, color: COLORS.pale });
      labelLines.forEach(function (line, index) { page.drawText(line, { x: PAGE.margin + 8, y: y - 7 - index * 11, font: bold, size: 7.5, color: COLORS.tealDark }); });
      valueLines.forEach(function (line, index) { page.drawText(line, { x: PAGE.margin + 165, y: y - 7 - index * 11, font: regular, size: 8, color: COLORS.ink }); });
      y -= height + 3;
    });
    y -= 6;
  }

  function bullets(items) {
    (items || []).forEach(function (item) {
      const lines = wrap(item, regular, 8.3, PAGE.width - PAGE.margin * 2 - 18);
      ensureSpace(lines.length * 11 + 5);
      page.drawCircle({ x: PAGE.margin + 3, y: y + 2, size: 1.8, color: COLORS.teal });
      lines.forEach(function (line, index) { page.drawText(line, { x: PAGE.margin + 13, y: y - index * 11, font: regular, size: 8.3, color: COLORS.ink }); });
      y -= lines.length * 11 + 5;
    });
    y -= 4;
  }

  addPage();
  paragraph("Systembeschreibung nach den GoBD für die Erfassung, Verarbeitung, Ausgabe und Aufbewahrung von Angeboten, Aufträgen, Rechnungen, Rechnungskorrekturen, Zahlungen und Exportdaten.", { bold: true, size: 10, lineHeight: 14 });
  facts([
    ["Dokumentstand", dateDE(model.generatedAt.toISOString())],
    ["System", "Uspešni Ježek POS / WerkTech"],
    ["Systemversion", model.appVersion],
    ["Betriebsart", model.environment],
    ["Unternehmen", model.profile.legalName],
    ["Rechtsform / Vertretung", model.profile.legalForm + " / " + model.profile.representative],
    ["Anschrift", model.profile.address],
    ["Steuerliche Identität", model.profile.taxIdentity]
  ]);
  note("Wichtiger Hinweis: Dieses Dokument beschreibt den technischen Teil des eingesetzten Verfahrens. Das Unternehmen muss Zuständigkeiten, Arbeitsanweisungen, Vertretungsregeln, Belegwege und tatsächliche betriebliche Kontrollen ergänzen und jede freigegebene Fassung nachvollziehbar aufbewahren.");

  heading("1. Zweck und Geltungsbereich");
  paragraph("Die Dokumentation macht Inhalt, Aufbau, Ablauf und Ergebnisse des DV-Verfahrens nachvollziehbar. Sie gilt für die im POS verarbeiteten Ausgangsbelege und die damit verknüpften Geschäftsvorfälle. Rechtsgrundlage sind insbesondere §§ 145 bis 147 AO, § 14b UStG sowie die GoBD in der jeweils geltenden Fassung.");

  heading("2. Verantwortlichkeiten");
  bullets([
    "Die Unternehmensleitung bleibt für Ordnungsmäßigkeit, Vollständigkeit und Aufbewahrung verantwortlich.",
    "Berechtigte Benutzer erfassen Stammdaten, Leistungen und Nachweise; Freigaben dürfen nicht durch gemeinsam genutzte Konten erfolgen.",
    "Steuerliche Kontierung, Sonderfälle und die periodische DATEV-Übergabe sind mit der steuerlichen Beratung abzustimmen.",
    "Technische Störungen, fehlgeschlagene Integritätsprüfungen und Wiederherstellungstests sind zeitnah zu bearbeiten und zu dokumentieren."
  ]);

  heading("3. Stammdaten und steuerliche Konfiguration");
  facts([
    ["Steuerstatus", model.profile.taxStatus],
    ["Vorjahresumsatz E-Rechnung", model.profile.turnoverBand],
    ["Rechnungsidentität", "Rechtlicher Name, Anschrift, Steuernummer/USt-IdNr., Bankverbindung und Nummernkreis werden vor einer rechtsverbindlichen Ausgabe geprüft."],
    ["Änderungen", "Änderungen an Stammdaten wirken nur auf neue Belege; bereits ausgestellte Belege verwenden ihren gesperrten Datenstand."]
  ]);

  addPage();
  heading("4. Beleg- und Auftragsablauf");
  bullets([
    "Angebot: Entwurf, Plausibilitätsprüfung, Sperrung und Ausgabe eines unveränderlichen PDF-Originals.",
    "Annahme: Nachweis der Annahme, Auftragsnummer und - bei Verbraucherverträgen - Vertragsbestätigung mit Widerrufsinformationen.",
    "Leistung: Status- und Leistungsnachweise, Abschlags- oder Schlussrechnung sowie Verknüpfung bereits berechneter Teilentgelte.",
    "Rechnung: serverseitige Nummernvergabe, gesperrter Snapshot, PDF und bei strukturierten Rechnungen XRechnung-XML mit KoSIT-Prüfstatus.",
    "Korrektur: Das Original bleibt unverändert. Storno, Rechnungsberichtigung und Gutschrift werden als eigene, nachvollziehbar verknüpfte Belege erzeugt.",
    "Zahlung: Überweisung, externer Kartennachweis oder sichere Provider-Rückmeldung werden getrennt vom Beleg erfasst; keine nachträgliche Überschreibung des Rechnungsoriginals."
  ]);

  heading("5. Vollständigkeit, Richtigkeit und Zeitnähe");
  bullets([
    "Pflichtfelder, Datumsgrenzen, Beträge, Steuersätze und Empfängerart werden vor der Ausgabe validiert.",
    "Produktive Rechnungen erhalten Nummern ausschließlich in einer transaktional gesicherten Serverfunktion.",
    "Wiederholte Anforderungen verwenden Idempotenzschlüssel und dürfen keinen zweiten Rechtsbeleg erzeugen.",
    "Fehlgeschlagene Ausgaben oder Zustellungen bleiben als Status beziehungsweise Ereignis nachvollziehbar."
  ]);

  heading("6. Unveränderbarkeit und Protokollierung");
  bullets([
    "Ausgestellte Dokumente basieren auf einem gesperrten Snapshot. Direkte Änderung oder Löschung rechtsrelevanter Originale ist technisch eingeschränkt.",
    "Dokumente erhalten einen SHA-256-Prüfwert; Integritätsprüfungen erzeugen eine separate Ereignisspur.",
    "Korrekturen ersetzen das Original nicht, sondern referenzieren es mit eigenem Dokument, Grund, Zeitpunkt und Benutzerbezug.",
    "Mandantentrennung und Row Level Security begrenzen Datenzugriffe auf den angemeldeten Unternehmensaccount."
  ]);

  addPage();
  heading("7. Aufbewahrung und Wiederherstellung");
  facts([
    ["Aufbewahrungsdauer", "Mindestens " + model.archive.retentionYears + " Jahre; Fristbeginn nach dem Schluss des maßgeblichen Kalenderjahres."],
    ["Archivierte Dokumente", String(model.archive.documentCount)],
    ["Integrität bestätigt", String(model.archive.verifiedCount)],
    ["Integritätsfehler", String(model.archive.failureCount)],
    ["Unabhängige Kopie", yesNo(model.archive.independentBackupReady)],
    ["WORM-Anbieter", model.archive.wormProvider],
    ["Object-Lock-Modus", model.archive.objectLockMode],
    ["Wiederherstellung getestet", model.archive.recoveryTestedAt ? dateDE(model.archive.recoveryTestedAt) : "Noch nicht bestätigt"],
    ["Produktionsreife Archiv", yesNo(model.archive.productionReady)]
  ]);
  paragraph("Elektronische Originale müssen während der gesamten Frist verfügbar, unverzüglich lesbar und - soweit erforderlich - maschinell auswertbar bleiben. Ein bestätigter Wiederherstellungstest ist Teil der betrieblichen Kontrolle.");

  heading("8. E-Rechnung und Zustellung");
  bullets([
    "Für B2B- und Behördenfälle wird die Pflicht beziehungsweise Übergangsregel anhand Leistungsdatum, Empfängerart, Betrag, Steuerfall und dokumentiertem Vorjahresumsatz bestimmt.",
    "XRechnung-XML darf erst nach erfolgreicher Validierung als strukturierter Beleg zugestellt werden.",
    "E-Mail-, Test- und künftige Peppol/OZG-RE-Zustellungen verwenden einen serverseitigen Ausgangskorb mit Status-, Wiederholungs- und Fehlerereignissen.",
    "Testbetrieb, Sandbox und Produktion sind getrennt; Testbelege und Testzahlungen dürfen keine echten Geschäftsvorfälle vortäuschen."
  ]);

  addPage();
  heading("9. Datenzugriff und Auswertbarkeit");
  bullets([
    "Belege bleiben als PDF und - soweit vorhanden - als strukturiertes XML abrufbar.",
    "DATEV-Export und zugehörige Metadaten unterstützen die Übergabe an die steuerliche Beratung; die fachliche Prüfung bleibt erforderlich.",
    "Bei einer Außenprüfung sind die relevanten Daten, Strukturinformationen und diese Systemdokumentation in einem abgestimmten, maschinell auswertbaren Umfang bereitzustellen.",
    "Zugriffe auf geschützte API-Wege benötigen eine gültige Benutzersitzung; Hintergrundaufgaben zusätzlich ein getrenntes Cron-Geheimnis."
  ]);

  heading("10. Änderungen und Versionsführung");
  paragraph("Jede wesentliche Änderung an Beleglogik, Nummernvergabe, Steuerregeln, Archivierung, Schnittstellen oder Berechtigungen erfordert eine neue Fassung dieser Dokumentation. Alte Fassungen dürfen nicht überschrieben werden. Freigabedatum, verantwortliche Person, Änderungsgrund und Einsatzzeitraum sind im Unternehmen zu ergänzen.");

  heading("11. Betriebliche Ergänzungen vor Freigabe");
  bullets([
    "Verantwortliche Person und Vertretung für Rechnungsstellung, Korrektur, Zahlungsabgleich und Export eintragen.",
    "Belegeingang, Belegprüfung, Freigabegrenzen und Umgang mit Papier- beziehungsweise Fremdbelegen beschreiben.",
    "Benutzeranlage, Rollenprüfung, Ausscheiden von Mitarbeitern und regelmäßige Berechtigungsprüfung dokumentieren.",
    "Datensicherung, Wiederherstellungstest, Störungsbearbeitung und Notbetrieb mit Termin und Verantwortlichem festlegen.",
    "Aktuelle Fassung mit Steuerberatung prüfen, freigeben, datieren und zusammen mit früheren Fassungen aufbewahren."
  ]);

  note("Diese automatisch erzeugte Fassung ist keine Rechts- oder Steuerberatung und keine pauschale GoBD-Zertifizierung. Ordnungsmäßigkeit hängt auch von der tatsächlichen Nutzung und den betrieblichen Kontrollen ab.");

  pages.forEach(function (current, index) {
    current.drawLine({ start: { x: PAGE.margin, y: 50 }, end: { x: PAGE.width - PAGE.margin, y: 50 }, thickness: 0.5, color: COLORS.line });
    current.drawText("Uspešni Ježek POS - " + GENERATOR_VERSION, { x: PAGE.margin, y: 34, font: regular, size: 6.7, color: COLORS.muted });
    const pageText = "Seite " + (index + 1) + " / " + pages.length;
    current.drawText(pageText, { x: PAGE.width - PAGE.margin - regular.widthOfTextAtSize(pageText, 6.7), y: 34, font: regular, size: 6.7, color: COLORS.muted });
  });
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

module.exports = { GENERATOR_VERSION, profileView, archiveView, documentModel, createProcedureDocumentationPdf };
