(function (global) {
  "use strict";

  var STORAGE_KEY = "uj-pos-terminal-v1";
  var DATE_LOCALE = "de-DE";
  var CURRENCY = "EUR";

  function integer(value, fallback) {
    var parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : (fallback || 0);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function roundDivide(numerator, denominator) {
    if (!denominator) return 0;
    return Math.round(numerator / denominator);
  }

  function parseMoneyToCents(value) {
    if (typeof value === "number") return Math.round(value * 100);
    var normalized = String(value == null ? "" : value)
      .trim()
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "");
    var number = Number.parseFloat(normalized);
    return Number.isFinite(number) ? Math.round(number * 100) : 0;
  }

  function parseQuantityMilli(value) {
    var normalized = String(value == null ? "" : value).trim().replace(",", ".");
    var number = Number.parseFloat(normalized);
    return Number.isFinite(number) ? Math.max(0, Math.round(number * 1000)) : 0;
  }

  function formatMoney(cents) {
    return new Intl.NumberFormat(DATE_LOCALE, {
      style: "currency",
      currency: CURRENCY,
      minimumFractionDigits: 2
    }).format((integer(cents, 0)) / 100);
  }

  function formatDecimalMilli(milli) {
    return new Intl.NumberFormat(DATE_LOCALE, { maximumFractionDigits: 3 }).format(milli / 1000);
  }

  function isoToday() {
    var now = new Date();
    var local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function addDays(iso, days) {
    var date = new Date(String(iso || isoToday()) + "T12:00:00");
    date.setDate(date.getDate() + integer(days, 0));
    return date.toISOString().slice(0, 10);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    var date = new Date(iso + "T12:00:00");
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(DATE_LOCALE).format(date);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeXml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function uid(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === "function") return prefix + "-" + global.crypto.randomUUID();
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function randomUuid() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") return global.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (character) {
      var random = Math.random() * 16 | 0;
      return (character === "x" ? random : random & 3 | 8).toString(16);
    });
  }

  function defaultProfile() {
    return {
      legalName: "",
      legalForm: "",
      representative: "",
      street: "",
      postalCode: "",
      city: "",
      businessEmail: "",
      businessPhone: "",
      taxStatus: "regular",
      taxNumber: "",
      vatId: "",
      previousYearTurnoverBand: "unknown",
      accountHolder: "",
      iban: "",
      invoicePrefix: "RE-" + new Date().getFullYear() + "-",
      defaultDueDays: "14",
      legalConfirmed: false
    };
  }

  function defaultItem() {
    return {
      id: uid("item"),
      description: "",
      category: "labour",
      quantity: "1",
      unit: "Std.",
      unitPrice: "0,00",
      taxRate: "19"
    };
  }

  function normalizeReplacementContext(source) {
    var root = source && typeof source === "object" ? source : {};
    var context = root.replacement_context && typeof root.replacement_context === "object"
      ? root.replacement_context
      : root.replacementContext && typeof root.replacementContext === "object"
        ? root.replacementContext
        : root;
    var normalized = {
      originalInvoiceId: String(context.original_invoice_id || context.originalInvoiceId || root.replacement_original_invoice_id || ""),
      originalInvoiceNumber: String(context.original_invoice_number || context.originalInvoiceNumber || root.replacement_original_number || ""),
      cancellationAdjustmentId: String(context.cancellation_adjustment_id || context.cancellationAdjustmentId || root.replacement_cancellation_adjustment_id || ""),
      cancellationNumber: String(context.cancellation_number || context.cancellationNumber || root.replacement_cancellation_number || "")
    };
    return normalized.originalInvoiceId && normalized.cancellationAdjustmentId ? normalized : null;
  }

  function defaultDraft(profile) {
    var today = isoToday();
    var taxMode = profile && profile.taxStatus === "small_business" ? "small_business" : "regular";
    return {
      id: uid("draft"),
      serverId: null,
      createdAt: new Date().toISOString(),
      customerType: "private",
      customerName: "",
      customerStreet: "",
      customerPostalCode: "",
      customerCity: "",
      customerVatId: "",
      customerContact: "",
      customerEmail: "",
      customerPhone: "",
      leitwegId: "",
      buyerReference: "",
      issueDate: today,
      serviceDate: today,
      projectName: "",
      workDescription: "",
      priceMode: "net",
      items: [defaultItem()],
      taxMode: taxMode,
      reverseChargeConfirmed: false,
      handwerker35a: false,
      constructionWithholding: false,
      exemptionCertificate: "unknown",
      dueDays: String(profile && profile.defaultDueDays || 14),
      paymentMethod: "sepa",
      consumerDefaultNotice: false,
      einvoiceValidated: false,
      finalConfirmed: false,
      replacementContext: null
    };
  }

  function replacementDraftFromInvoice(invoice, cancellation, profile) {
    if (!invoice || !cancellation || cancellation.type !== "cancellation") return null;
    var original = JSON.parse(JSON.stringify(invoice.draft || {}));
    var draft = Object.assign(defaultDraft(profile), original, {
      id: uid("draft"),
      serverId: null,
      createdAt: new Date().toISOString(),
      issueDate: isoToday(),
      serviceDate: original.serviceDate || isoToday(),
      dueDays: String(profile && profile.defaultDueDays || original.dueDays || 14),
      finalConfirmed: false,
      einvoiceValidated: false,
      replacementContext: {
        originalInvoiceId: invoice.id,
        originalInvoiceNumber: invoice.number,
        cancellationAdjustmentId: cancellation.id,
        cancellationNumber: cancellation.number
      }
    });
    draft.items = (original.items || []).map(function (item) {
      return Object.assign({}, item, { id: uid("item") });
    });
    if (!draft.items.length) draft.items = [defaultItem()];
    return draft;
  }

  function profileToDatabase(profile, userId) {
    return {
      user_id: userId,
      legal_name: String(profile.legalName || "").trim(),
      legal_form: String(profile.legalForm || "").trim(),
      representative: String(profile.representative || "").trim(),
      street: String(profile.street || "").trim(),
      postal_code: String(profile.postalCode || "").trim(),
      city: String(profile.city || "").trim(),
      business_email: String(profile.businessEmail || "").trim(),
      business_phone: String(profile.businessPhone || "").trim(),
      tax_status: profile.taxStatus === "small_business" ? "small_business" : "regular",
      tax_number: String(profile.taxNumber || "").trim(),
      vat_id: String(profile.vatId || "").trim().toUpperCase(),
      previous_year_turnover_band: ["lte_800k", "gt_800k"].indexOf(profile.previousYearTurnoverBand) !== -1 ? profile.previousYearTurnoverBand : "unknown",
      account_holder: String(profile.accountHolder || "").trim(),
      iban: cleanIban(profile.iban),
      invoice_prefix: String(profile.invoicePrefix || "").trim(),
      default_due_days: clamp(integer(profile.defaultDueDays, 14), 0, 365),
      legal_confirmed: Boolean(profile.legalConfirmed)
    };
  }

  function profileFromDatabase(row) {
    if (!row) return defaultProfile();
    return Object.assign(defaultProfile(), {
      legalName: row.legal_name,
      legalForm: row.legal_form,
      representative: row.representative,
      street: row.street,
      postalCode: row.postal_code,
      city: row.city,
      businessEmail: row.business_email,
      businessPhone: row.business_phone,
      taxStatus: row.tax_status,
      taxNumber: row.tax_number,
      vatId: row.vat_id,
      previousYearTurnoverBand: row.previous_year_turnover_band || "unknown",
      accountHolder: row.account_holder,
      iban: row.iban,
      invoicePrefix: row.invoice_prefix,
      defaultDueDays: String(row.default_due_days),
      legalConfirmed: Boolean(row.legal_confirmed)
    });
  }

  function draftToDatabasePayload(draft) {
    var replacement = normalizeReplacementContext(draft);
    return {
      customer_type: draft.customerType,
      customer_name: String(draft.customerName || "").trim(),
      customer_street: String(draft.customerStreet || "").trim(),
      customer_postal_code: String(draft.customerPostalCode || "").trim(),
      customer_city: String(draft.customerCity || "").trim(),
      customer_vat_id: String(draft.customerVatId || "").trim(),
      customer_contact: String(draft.customerContact || "").trim(),
      customer_email: String(draft.customerEmail || "").trim(),
      customer_phone: String(draft.customerPhone || "").trim(),
      leitweg_id: String(draft.leitwegId || "").trim(),
      buyer_reference: String(draft.buyerReference || "").trim(),
      issue_date: draft.issueDate,
      service_date: draft.serviceDate,
      project_name: String(draft.projectName || "").trim(),
      work_description: String(draft.workDescription || "").trim(),
      price_mode: draft.priceMode,
      items: (draft.items || []).map(function (item) {
        return {
          id: item.id,
          description: String(item.description || "").trim(),
          category: item.category,
          quantity_milli: parseQuantityMilli(item.quantity),
          unit: item.unit,
          unit_price_cents: parseMoneyToCents(item.unitPrice),
          tax_rate_bps: draft.taxMode === "regular" ? clamp(integer(item.taxRate, 0), 0, 100) * 100 : 0
        };
      }),
      tax_mode: draft.taxMode,
      reverse_charge_confirmed: Boolean(draft.reverseChargeConfirmed),
      handwerker_35a: Boolean(draft.handwerker35a),
      construction_withholding: Boolean(draft.constructionWithholding),
      exemption_certificate: draft.exemptionCertificate,
      due_days: clamp(integer(draft.dueDays, 14), 0, 365),
      payment_method: draft.paymentMethod,
      consumer_default_notice: Boolean(draft.consumerDefaultNotice),
      replacement_context: replacement ? {
        original_invoice_id: replacement.originalInvoiceId,
        original_invoice_number: replacement.originalInvoiceNumber,
        cancellation_adjustment_id: replacement.cancellationAdjustmentId,
        cancellation_number: replacement.cancellationNumber
      } : null
    };
  }

  function draftFromDatabasePayload(payload, issued) {
    var draft = defaultDraft();
    var source = payload || {};
    return Object.assign(draft, {
      customerType: source.customer_type,
      customerName: source.customer_name,
      customerStreet: source.customer_street,
      customerPostalCode: source.customer_postal_code,
      customerCity: source.customer_city,
      customerVatId: source.customer_vat_id,
      customerContact: source.customer_contact,
      customerEmail: source.customer_email,
      customerPhone: source.customer_phone,
      leitwegId: source.leitweg_id,
      buyerReference: source.buyer_reference,
      issueDate: source.issue_date,
      serviceDate: source.service_date,
      projectName: source.project_name,
      workDescription: source.work_description,
      priceMode: source.price_mode,
      items: (source.items || []).map(function (item) {
        return {
          id: item.id || uid("item"), description: item.description || "", category: item.category || "other",
          quantity: String((integer(item.quantity_milli, 0) / 1000)).replace(".", ","),
          unit: item.unit || "Std.", unitPrice: (integer(item.unit_price_cents, 0) / 100).toFixed(2).replace(".", ","),
          taxRate: String(integer(item.tax_rate_bps, 0) / 100)
        };
      }),
      taxMode: source.tax_mode,
      reverseChargeConfirmed: Boolean(source.reverse_charge_confirmed),
      handwerker35a: Boolean(source.handwerker_35a),
      constructionWithholding: Boolean(source.construction_withholding),
      exemptionCertificate: source.exemption_certificate,
      dueDays: String(source.due_days == null ? 14 : source.due_days),
      paymentMethod: source.payment_method,
      consumerDefaultNotice: Boolean(source.consumer_default_notice),
      finalConfirmed: Boolean(issued),
      replacementContext: normalizeReplacementContext(source)
    });
  }

  function buildAdjustmentChanges(invoice, values) {
    var draft = invoice && invoice.draft || {};
    var current = {
      customer_name: draft.customerName || "",
      customer_street: draft.customerStreet || "",
      customer_postal_code: draft.customerPostalCode || "",
      customer_city: draft.customerCity || "",
      service_date: draft.serviceDate || "",
      due_date: invoice && invoice.dueDate || ""
    };
    var changes = {};
    Object.keys(current).forEach(function (key) {
      var value = String(values && values[key] == null ? "" : values[key]).trim();
      if (value !== String(current[key] || "").trim()) changes[key] = value;
    });
    return changes;
  }

  function calculateItem(item, priceMode, taxMode) {
    var quantityMilli = parseQuantityMilli(item.quantity);
    var enteredUnitCents = parseMoneyToCents(item.unitPrice);
    var enteredTotalCents = roundDivide(enteredUnitCents * quantityMilli, 1000);
    var rateBps = taxMode === "regular" ? clamp(integer(item.taxRate, 19), 0, 100) * 100 : 0;
    var netCents;
    var taxCents;
    var grossCents;

    if (priceMode === "gross" && rateBps > 0) {
      grossCents = enteredTotalCents;
      netCents = roundDivide(grossCents * 10000, 10000 + rateBps);
      taxCents = grossCents - netCents;
    } else {
      netCents = enteredTotalCents;
      taxCents = roundDivide(netCents * rateBps, 10000);
      grossCents = netCents + taxCents;
    }

    return {
      quantityMilli: quantityMilli,
      unitPriceCents: enteredUnitCents,
      netCents: netCents,
      taxCents: taxCents,
      grossCents: grossCents,
      rateBps: rateBps
    };
  }

  function calculateTotals(draft) {
    var totals = { netCents: 0, taxCents: 0, grossCents: 0, eligible35aCents: 0, byRate: {} };
    (draft.items || []).forEach(function (item) {
      var calculated = calculateItem(item, draft.priceMode, draft.taxMode);
      totals.netCents += calculated.netCents;
      totals.taxCents += calculated.taxCents;
      totals.grossCents += calculated.grossCents;
      var rateKey = String(calculated.rateBps);
      if (!totals.byRate[rateKey]) totals.byRate[rateKey] = { netCents: 0, taxCents: 0, rateBps: calculated.rateBps };
      totals.byRate[rateKey].netCents += calculated.netCents;
      totals.byRate[rateKey].taxCents += calculated.taxCents;
      if (["labour", "travel", "machine"].indexOf(item.category) !== -1) totals.eligible35aCents += calculated.grossCents;
    });
    return totals;
  }

  function cleanIban(value) {
    return String(value || "").replace(/\s/g, "").toUpperCase();
  }

  function profileReadiness(profile) {
    var checks = [
      { key: "identity", label: "Pravno ime in naslov", done: Boolean(profile.legalName && profile.street && profile.postalCode && profile.city) },
      { key: "tax", label: "Davčna številka", done: Boolean(profile.taxNumber || profile.vatId) },
      { key: "bank", label: "IBAN in imetnik računa", done: Boolean(cleanIban(profile.iban).length >= 15 && profile.accountHolder) },
      { key: "numbering", label: "Številčenje računov", done: Boolean(profile.invoicePrefix) },
      { key: "confirmation", label: "Potrditev resničnih podatkov", done: Boolean(profile.legalConfirmed) }
    ];
    var done = checks.filter(function (check) { return check.done; }).length;
    return { checks: checks, percent: Math.round(done / checks.length * 100), live: done === checks.length };
  }

  function validateStep(draft, profile, step) {
    var errors = [];
    function required(value, message) { if (!String(value || "").trim()) errors.push(message); }

    if (step === 1 || step === 4) {
      required(draft.customerName, "Vnesite ime oziroma naziv prejemnika.");
      required(draft.customerStreet, "Vnesite naslov prejemnika.");
      required(draft.customerPostalCode, "Vnesite poštno številko prejemnika.");
      required(draft.customerCity, "Vnesite kraj prejemnika.");
      if (draft.customerType === "public") required(draft.leitwegId, "Za javnega naročnika je potrebna Leitweg-ID.");
      if (draft.customerType === "business" || draft.customerType === "public") required(draft.buyerReference || draft.leitwegId, "Za XRechnung vnesite Bestellnummer / Buyer reference.");
      if (draft.customerType === "business") required(draft.customerEmail, "Za XRechnung vnesite e-poštni naslov poslovnega prejemnika.");
      if (draft.customerType === "business" || draft.customerType === "public") required(profile.businessEmail, "Za XRechnung v nastavitvah dodajte poslovni e-poštni naslov izdajatelja.");
      if (draft.customerType === "business" || draft.customerType === "public") required(profile.businessPhone, "Za XRechnung v nastavitvah dodajte poslovni telefon izdajatelja.");
    }

    if (step === 2 || step === 4) {
      required(draft.issueDate, "Vnesite datum izdaje.");
      required(draft.serviceDate, "Vnesite datum izvedbe storitve.");
      if (!draft.items || !draft.items.length) errors.push("Račun mora imeti najmanj eno postavko.");
      (draft.items || []).forEach(function (item, index) {
        if (!String(item.description || "").trim()) errors.push("Postavka " + (index + 1) + " potrebuje opis.");
        if (parseQuantityMilli(item.quantity) <= 0) errors.push("Količina pri postavki " + (index + 1) + " mora biti večja od 0.");
        if (parseMoneyToCents(item.unitPrice) < 0) errors.push("Cena pri postavki " + (index + 1) + " ne sme biti negativna.");
      });
    }

    if (step === 3 || step === 4) {
      if (profile.taxStatus === "small_business" && draft.taxMode !== "small_business") errors.push("Podjetje je nastavljeno kot Kleinunternehmer; DDV ali reverse charge tu ni dovoljen brez spremembe davčnega statusa.");
      if (profile.taxStatus !== "small_business" && draft.taxMode === "small_business") errors.push("Oprostitev § 19 UStG se ne sme izbrati samo za posamezen račun.");
      if (draft.taxMode === "reverse_charge") {
        if (draft.customerType === "private") errors.push("Reverse charge ni dovoljen za fizično osebo.");
        if (!String(draft.customerVatId || "").trim()) errors.push("Reverse charge zahteva USt-IdNr. prejemnika.");
        if (!draft.reverseChargeConfirmed) errors.push("Potrdite, da so bili preverjeni pogoji § 13b UStG.");
      }
      if (draft.constructionWithholding && draft.exemptionCertificate === "unknown") errors.push("Pri Bauleistung izberite stanje Freistellungsbescheinigung.");
    }

    if (step === 4) {
      var readiness = profileReadiness(profile);
      if (readiness.live && !draft.finalConfirmed) errors.push("Pred pravno izdajo potrdite končni pregled.");
      if (!readiness.live && !draft.finalConfirmed) errors.push("Pred izdelavo testnega dokumenta potrdite končni pregled.");
    }
    return errors;
  }

  function taxNote(draft) {
    if (draft.taxMode === "small_business") return "Steuerbefreiung für Kleinunternehmer gemäß § 19 UStG.";
    if (draft.taxMode === "reverse_charge") return "Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.";
    return "";
  }

  function defaultNotice(draft) {
    if (draft.customerType !== "private" || !draft.consumerDefaultNotice) return "";
    return "Sie geraten spätestens 30 Tage nach Fälligkeit und Zugang dieser Rechnung in Verzug (§ 286 Abs. 3 BGB).";
  }

  function deliveryRecommendation(invoice, profile) {
    var draft = invoice && invoice.draft || {};
    var type = draft.customerType || "private";
    var issueDate = String(draft.issueDate || "");
    var turnoverBand = profile && profile.previousYearTurnoverBand || "unknown";
    if (type === "public") {
      return {
        channel: "ozg_re", documentFormat: "xrechnung", structuredRequired: true,
        pdfAllowed: false, pdfConsentRequired: false, needsTurnoverDecision: false,
        title: "XRechnung prek OZG-RE", copy: "Leitweg-ID usmeri račun javnemu naročniku.", badge: "XML"
      };
    }
    if (type === "business") {
      var year = integer(issueDate.slice(0, 4), new Date().getFullYear());
      var pdfAllowed = year <= 2026 || (year === 2027 && turnoverBand === "lte_800k");
      var needsTurnoverDecision = year === 2027 && turnoverBand === "unknown";
      return {
        channel: "email", documentFormat: "xrechnung_pdf", structuredRequired: !pdfAllowed,
        pdfAllowed: pdfAllowed, pdfConsentRequired: true, needsTurnoverDecision: needsTurnoverDecision,
        title: "XRechnung + berljivi PDF", copy: pdfAllowed ? "Strukturirani XML je pripravljen za prihodnja pravila." : "Za ta datum je potreben strukturirani e-račun.", badge: "XML + PDF"
      };
    }
    return {
      channel: "email", documentFormat: "pdf", structuredRequired: false,
      pdfAllowed: true, pdfConsentRequired: true, needsTurnoverDecision: false,
      title: "PDF po e-pošti", copy: "Primerno za fizično osebo.", badge: "PDF"
    };
  }

  function buildPaymentText(invoice, profile) {
    return [
      "Empfänger: " + (profile.accountHolder || profile.legalName || "—"),
      "IBAN: " + (cleanIban(profile.iban) || "—"),
      "Betrag: " + formatMoney(invoice.totals.grossCents),
      "Verwendungszweck: " + invoice.number
    ].join("\n");
  }

  function buildEpcPayload(invoice, profile) {
    var iban = cleanIban(profile.iban);
    var amount = (invoice.totals.grossCents / 100).toFixed(2);
    return ["BCD", "002", "1", "SCT", "", profile.accountHolder || profile.legalName, iban, "EUR" + amount, "", "", invoice.number, ""].join("\n");
  }

  function buildXRechnungXml(invoice, profile) {
    var draft = invoice.draft;
    var totals = invoice.totals;
    var exemption = taxNote(draft);
    var supplierTaxScheme = draft.taxMode === "regular" ? "VAT" : "OTH";
    var buyerReference = draft.buyerReference || draft.leitwegId;
    if (!buyerReference || !profile.businessEmail || !draft.customerEmail) throw new Error("XRechnung nima vseh obveznih elektronskih naslovov in Buyer reference.");
    var lines = draft.items.map(function (item, index) {
      var calc = calculateItem(item, draft.priceMode, draft.taxMode);
      var unitCode = item.unit === "Std." ? "HUR" : item.unit === "m²" ? "MTK" : item.unit === "Stk." ? "C62" : "C62";
      return [
        "  <cac:InvoiceLine>",
        "    <cbc:ID>" + (index + 1) + "</cbc:ID>",
        "    <cbc:InvoicedQuantity unitCode=\"" + unitCode + "\">" + (calc.quantityMilli / 1000).toFixed(3) + "</cbc:InvoicedQuantity>",
        "    <cbc:LineExtensionAmount currencyID=\"EUR\">" + (calc.netCents / 100).toFixed(2) + "</cbc:LineExtensionAmount>",
        "    <cac:Item><cbc:Name>" + escapeXml(item.description) + "</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>" + (draft.taxMode === "regular" ? "S" : "E") + "</cbc:ID><cbc:Percent>" + (calc.rateBps / 100).toFixed(2) + "</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>",
        "    <cac:Price><cbc:PriceAmount currencyID=\"EUR\">" + (calc.netCents / Math.max(1, calc.quantityMilli) * 10).toFixed(4) + "</cbc:PriceAmount></cac:Price>",
        "  </cac:InvoiceLine>"
      ].join("\n");
    }).join("\n");
    var taxSubtotals = Object.keys(totals.byRate).map(function (key) {
      var rate = totals.byRate[key];
      return "<cac:TaxSubtotal><cbc:TaxableAmount currencyID=\"EUR\">" + (rate.netCents / 100).toFixed(2) + "</cbc:TaxableAmount><cbc:TaxAmount currencyID=\"EUR\">" + (rate.taxCents / 100).toFixed(2) + "</cbc:TaxAmount><cac:TaxCategory><cbc:ID>" + (draft.taxMode === "regular" ? "S" : "E") + "</cbc:ID><cbc:Percent>" + (rate.rateBps / 100).toFixed(2) + "</cbc:Percent>" + (exemption ? "<cbc:TaxExemptionReason>" + escapeXml(exemption) + "</cbc:TaxExemptionReason>" : "") + "<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>";
    }).join("");
    return [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\" xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\" xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">",
      "  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>",
      "  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>",
      "  <cbc:ID>" + escapeXml(invoice.number) + "</cbc:ID>",
      "  <cbc:IssueDate>" + escapeXml(draft.issueDate) + "</cbc:IssueDate>",
      "  <cbc:DueDate>" + escapeXml(invoice.dueDate) + "</cbc:DueDate>",
      "  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>",
      "  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>",
      "  <cbc:BuyerReference>" + escapeXml(buyerReference) + "</cbc:BuyerReference>",
      "  <cac:AccountingSupplierParty><cac:Party><cbc:EndpointID schemeID=\"EM\">" + escapeXml(profile.businessEmail) + "</cbc:EndpointID><cac:PostalAddress><cbc:StreetName>" + escapeXml(profile.street) + "</cbc:StreetName><cbc:CityName>" + escapeXml(profile.city) + "</cbc:CityName><cbc:PostalZone>" + escapeXml(profile.postalCode) + "</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress><cac:PartyTaxScheme><cbc:CompanyID>" + escapeXml(profile.vatId || profile.taxNumber) + "</cbc:CompanyID><cac:TaxScheme><cbc:ID>" + supplierTaxScheme + "</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>" + escapeXml(profile.legalName) + "</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>",
      "  <cac:AccountingCustomerParty><cac:Party><cbc:EndpointID schemeID=\"EM\">" + escapeXml(draft.customerEmail) + "</cbc:EndpointID><cac:PostalAddress><cbc:StreetName>" + escapeXml(draft.customerStreet) + "</cbc:StreetName><cbc:CityName>" + escapeXml(draft.customerCity) + "</cbc:CityName><cbc:PostalZone>" + escapeXml(draft.customerPostalCode) + "</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress><cac:PartyLegalEntity><cbc:RegistrationName>" + escapeXml(draft.customerName) + "</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>",
      "  <cac:Delivery><cbc:ActualDeliveryDate>" + escapeXml(draft.serviceDate) + "</cbc:ActualDeliveryDate></cac:Delivery>",
      "  <cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cbc:PaymentID>" + escapeXml(invoice.number) + "</cbc:PaymentID><cac:PayeeFinancialAccount><cbc:ID>" + escapeXml(cleanIban(profile.iban)) + "</cbc:ID><cbc:Name>" + escapeXml(profile.accountHolder || profile.legalName) + "</cbc:Name></cac:PayeeFinancialAccount></cac:PaymentMeans>",
      "  <cac:TaxTotal><cbc:TaxAmount currencyID=\"EUR\">" + (totals.taxCents / 100).toFixed(2) + "</cbc:TaxAmount>" + taxSubtotals + "</cac:TaxTotal>",
      "  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID=\"EUR\">" + (totals.netCents / 100).toFixed(2) + "</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID=\"EUR\">" + (totals.netCents / 100).toFixed(2) + "</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID=\"EUR\">" + (totals.grossCents / 100).toFixed(2) + "</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID=\"EUR\">" + (totals.grossCents / 100).toFixed(2) + "</cbc:PayableAmount></cac:LegalMonetaryTotal>",
      lines,
      "</Invoice>"
    ].join("\n");
  }

  var Core = {
    parseMoneyToCents: parseMoneyToCents,
    parseQuantityMilli: parseQuantityMilli,
    calculateItem: calculateItem,
    calculateTotals: calculateTotals,
    profileReadiness: profileReadiness,
    validateStep: validateStep,
    buildEpcPayload: buildEpcPayload,
    buildXRechnungXml: buildXRechnungXml,
    deliveryRecommendation: deliveryRecommendation,
    profileToDatabase: profileToDatabase,
    profileFromDatabase: profileFromDatabase,
    draftToDatabasePayload: draftToDatabasePayload,
    draftFromDatabasePayload: draftFromDatabasePayload,
    buildAdjustmentChanges: buildAdjustmentChanges,
    normalizeReplacementContext: normalizeReplacementContext,
    replacementDraftFromInvoice: replacementDraftFromInvoice,
    defaultProfile: defaultProfile,
    defaultDraft: defaultDraft
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Core;
  global.UJPosTerminalCore = Core;
  if (!global.document) return;

  var document = global.document;
  var state = loadState();
  var backend = {
    client: global.supabaseKlient && global.supabaseKlient.auth ? global.supabaseKlient : null,
    userId: null,
    ready: false,
    syncing: false,
    error: ""
  };
  var currentView = "home";
  var currentStep = 1;
  var activeInvoiceId = null;
  var adjustmentInvoiceId = null;
  var adjustmentSubmitting = false;
  var deliveryInvoiceId = null;
  var deliveryRequestKey = null;
  var deliverySubmitting = false;
  var deliveryCapability = { provider: "resend", configured: false, sendEnabled: false, testEnabled: false, liveEnabled: false, mode: "sandbox" };
  var toastTimer = 0;
  var dialogCallback = null;

  function loadState() {
    var initial = { profile: defaultProfile(), invoices: [], draft: null, sequence: 0 };
    try {
      var saved = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return initial;
      return {
        profile: Object.assign(defaultProfile(), saved.profile || {}),
        invoices: Array.isArray(saved.invoices) ? saved.invoices : [],
        draft: saved.draft && typeof saved.draft === "object" ? saved.draft : null,
        sequence: integer(saved.sequence, 0)
      };
    } catch (_error) {
      return initial;
    }
  }

  function persist() {
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_error) { /* lokalni fallback ni obvezen */ }
  }

  function backendMessage(message, kind) {
    backend.error = kind === "error" ? message : "";
    var element = query("[data-sync-state]");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("is-ready", kind === "ready");
    element.classList.toggle("is-error", kind === "error");
  }

  function databaseErrorMessage(error) {
    var code = String(error && error.code || "");
    if (["42P01", "42883", "PGRST202", "PGRST205"].indexOf(code) !== -1) return "POS baza še ni nameščena – ostaja Testbetrieb.";
    return "Povezava z varno hrambo trenutno ni na voljo – ostaja Testbetrieb.";
  }

  async function getBackendUser() {
    if (!backend.client) return null;
    var result = await backend.client.auth.getUser();
    if (result.error) throw result.error;
    backend.userId = result.data && result.data.user && result.data.user.id || null;
    return backend.userId;
  }

  async function saveProfileToServer() {
    if (!backend.client || !backend.userId) throw new Error("Varna hramba ni povezana.");
    var result = await backend.client.from("pos_business_profiles")
      .upsert(profileToDatabase(state.profile, backend.userId), { onConflict: "user_id" })
      .select("user_id").single();
    if (result.error) throw result.error;
    backend.ready = true;
    backendMessage("Sinhronizirano", "ready");
  }

  async function saveDraftToServer() {
    if (!backend.client || !backend.userId || !backend.ready) throw new Error("Varna hramba ni povezana.");
    syncDraftFromForm();
    var row = { user_id: backend.userId, payload: draftToDatabasePayload(state.draft) };
    var request;
    if (state.draft.serverId) {
      request = backend.client.from("pos_invoice_drafts").update(row).eq("id", state.draft.serverId).select("id").single();
    } else {
      request = backend.client.from("pos_invoice_drafts").insert(row).select("id").single();
    }
    var result = await request;
    if (result.error) throw result.error;
    state.draft.serverId = result.data.id;
    persist();
    backendMessage("Osnutek je varno shranjen", "ready");
    return result.data.id;
  }

  function adjustmentFromServer(row, documentsByAdjustment) {
    return {
      id: row.id,
      number: row.adjustment_number,
      type: row.adjustment_type,
      reason: row.reason,
      changes: row.changes || {},
      deltaNetCents: integer(row.delta_net_cents, 0),
      deltaTaxCents: integer(row.delta_tax_cents, 0),
      deltaGrossCents: integer(row.delta_gross_cents, 0),
      createdAt: row.issued_at,
      snapshot: row.snapshot || {},
      documentReady: Boolean(documentsByAdjustment && documentsByAdjustment[row.id]),
      document: documentsByAdjustment && documentsByAdjustment[row.id] || null
    };
  }

  function deliveryFromServer(row, eventsByDelivery) {
    return {
      id: row.id,
      channel: row.channel,
      documentFormat: row.document_format,
      validationStatus: row.validation_status,
      recipient: row.recipient,
      routingReference: row.routing_reference,
      subject: row.subject,
      status: row.status,
      provider: row.provider,
      isTest: Boolean(row.is_test),
      attemptCount: integer(row.attempt_count, 0),
      maxAttempts: integer(row.max_attempts, 3),
      nextAttemptAt: row.next_attempt_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      deliveredAt: row.delivered_at,
      lastProviderEventAt: row.last_provider_event_at,
      lastProviderEventType: row.last_provider_event_type,
      lastError: row.last_error,
      events: eventsByDelivery && eventsByDelivery[row.id] || []
    };
  }

  function serverInvoiceToLocal(row, paidByInvoice, documentsByInvoice, adjustmentsByInvoice, deliveriesByInvoice, einvoiceDocumentsByInvoice) {
    var snapshot = row.snapshot || {};
    var adjustments = adjustmentsByInvoice && adjustmentsByInvoice[row.id] || [];
    var corrections = adjustments.filter(function (entry) { return entry.type === "correction"; });
    var latestCorrection = corrections[corrections.length - 1];
    var effectivePayload = latestCorrection && latestCorrection.snapshot && latestCorrection.snapshot.effective_draft || snapshot.draft || {};
    var draft = draftFromDatabasePayload(effectivePayload, true);
    var paid = integer(paidByInvoice && paidByInvoice[row.id], 0) >= integer(row.gross_cents, 0);
    var cancelled = adjustments.some(function (entry) { return entry.type === "cancellation"; });
    return {
      id: row.id,
      number: row.invoice_number,
      dueDate: effectivePayload.due_date || row.due_date,
      totals: {
        netCents: integer(row.net_cents, 0), taxCents: integer(row.tax_cents, 0),
        grossCents: integer(row.gross_cents, 0), eligible35aCents: integer(row.eligible_35a_cents, 0), byRate: {}
      },
      draft: draft,
      seller: snapshot.seller || null,
      isTest: Boolean(row.is_test),
      status: cancelled ? "cancelled" : paid ? "paid" : "open",
      corrected: corrections.length > 0,
      adjustments: adjustments,
      deliveries: deliveriesByInvoice && deliveriesByInvoice[row.id] || [],
      replacement: null,
      replacementOf: null,
      createdAt: row.issued_at,
      serverStored: true,
      documentReady: Boolean(documentsByInvoice && documentsByInvoice[row.id]),
      document: documentsByInvoice && documentsByInvoice[row.id] || null,
      einvoiceDocumentReady: Boolean(einvoiceDocumentsByInvoice && einvoiceDocumentsByInvoice[row.id]),
      einvoiceDocument: einvoiceDocumentsByInvoice && einvoiceDocumentsByInvoice[row.id] || null
    };
  }

  async function loadServerState() {
    if (!backend.client || backend.syncing) return;
    backend.syncing = true;
    backendMessage("Povezujem varno hrambo …", "loading");
    try {
      var userId = await getBackendUser();
      if (!userId) return;
      var responses = await Promise.all([
        backend.client.from("pos_business_profiles").select("*").eq("user_id", userId).maybeSingle(),
        backend.client.from("pos_invoice_drafts").select("id,payload,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1),
        backend.client.from("pos_invoices").select("*").eq("user_id", userId).order("issued_at", { ascending: false }).limit(100),
        backend.client.from("pos_payments").select("invoice_id,amount_cents").eq("user_id", userId),
        backend.client.from("pos_invoice_documents").select("invoice_id,sha256,byte_size,created_at,generator_version").eq("user_id", userId),
        backend.client.from("pos_invoice_adjustments").select("*").eq("user_id", userId).order("issued_at", { ascending: true }),
        backend.client.from("pos_adjustment_documents").select("adjustment_id,sha256,byte_size,created_at,generator_version").eq("user_id", userId),
        backend.client.from("pos_invoice_replacements").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        backend.client.from("pos_invoice_deliveries").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        backend.client.from("pos_invoice_delivery_events").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        backend.client.from("pos_einvoice_documents").select("invoice_id,sha256,byte_size,created_at,generator_version,xrechnung_version,validation_status,validator_version,validator_config_version,validated_at").eq("user_id", userId)
      ]);
      var firstError = responses.map(function (entry) { return entry.error; }).filter(Boolean)[0];
      if (firstError) throw firstError;
      backend.ready = true;
      if (responses[0].data) state.profile = profileFromDatabase(responses[0].data);
      var paidByInvoice = {};
      (responses[3].data || []).forEach(function (payment) { paidByInvoice[payment.invoice_id] = integer(paidByInvoice[payment.invoice_id], 0) + integer(payment.amount_cents, 0); });
      var documentsByInvoice = {};
      (responses[4].data || []).forEach(function (entry) { documentsByInvoice[entry.invoice_id] = entry; });
      var einvoiceDocumentsByInvoice = {};
      (responses[10].data || []).forEach(function (entry) { einvoiceDocumentsByInvoice[entry.invoice_id] = entry; });
      var documentsByAdjustment = {};
      (responses[6].data || []).forEach(function (entry) { documentsByAdjustment[entry.adjustment_id] = entry; });
      var adjustmentsByInvoice = {};
      (responses[5].data || []).forEach(function (row) {
        if (!adjustmentsByInvoice[row.original_invoice_id]) adjustmentsByInvoice[row.original_invoice_id] = [];
        adjustmentsByInvoice[row.original_invoice_id].push(adjustmentFromServer(row, documentsByAdjustment));
      });
      var eventsByDelivery = {};
      (responses[9].data || []).forEach(function (row) {
        if (!eventsByDelivery[row.delivery_id]) eventsByDelivery[row.delivery_id] = [];
        eventsByDelivery[row.delivery_id].push(row);
      });
      var deliveriesByInvoice = {};
      (responses[8].data || []).forEach(function (row) {
        if (!deliveriesByInvoice[row.invoice_id]) deliveriesByInvoice[row.invoice_id] = [];
        deliveriesByInvoice[row.invoice_id].push(deliveryFromServer(row, eventsByDelivery));
      });
      var serverInvoices = (responses[2].data || []).map(function (row) { return serverInvoiceToLocal(row, paidByInvoice, documentsByInvoice, adjustmentsByInvoice, deliveriesByInvoice, einvoiceDocumentsByInvoice); });
      var invoicesById = {};
      var adjustmentsById = {};
      serverInvoices.forEach(function (invoice) {
        invoicesById[invoice.id] = invoice;
        (invoice.adjustments || []).forEach(function (adjustment) { adjustmentsById[adjustment.id] = adjustment; });
      });
      (responses[7].data || []).forEach(function (relation) {
        var original = invoicesById[relation.original_invoice_id];
        var replacement = invoicesById[relation.replacement_invoice_id];
        var cancellation = adjustmentsById[relation.cancellation_adjustment_id] || null;
        if (!original || !replacement || !cancellation) return;
        original.replacement = {
          invoiceId: replacement.id,
          invoiceNumber: replacement.number,
          adjustmentId: cancellation.id,
          cancellationNumber: cancellation.number,
          adjustment: cancellation,
          createdAt: relation.created_at
        };
        replacement.replacementOf = {
          invoiceId: original.id,
          invoiceNumber: original.number,
          adjustmentId: cancellation.id,
          cancellationNumber: cancellation.number,
          adjustment: cancellation,
          createdAt: relation.created_at
        };
        replacement.draft.replacementContext = {
          originalInvoiceId: original.id,
          originalInvoiceNumber: original.number,
          cancellationAdjustmentId: cancellation.id,
          cancellationNumber: cancellation.number
        };
      });
      var localTests = state.invoices.filter(function (invoice) { return !invoice.serverStored && invoice.isTest; });
      state.invoices = serverInvoices.concat(localTests);
      if (responses[1].data && responses[1].data[0]) {
        state.draft = draftFromDatabasePayload(responses[1].data[0].payload, false);
        state.draft.serverId = responses[1].data[0].id;
      }
      persist();
      backendMessage("Sinhronizirano", "ready");
      renderHome();
    } catch (error) {
      backend.ready = false;
      backendMessage(databaseErrorMessage(error), "error");
      renderHome();
    } finally {
      backend.syncing = false;
    }
  }

  function query(selector, root) { return (root || document).querySelector(selector); }
  function queryAll(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function showToast(message) {
    var toast = query("[data-toast]");
    toast.textContent = message;
    toast.classList.add("is-visible");
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () { toast.classList.remove("is-visible"); }, 2600);
  }

  function openDialog(title, copy, options) {
    var backdrop = query("[data-dialog-backdrop]");
    query("[data-dialog-title]").textContent = title;
    query("[data-dialog-copy]").textContent = copy;
    query("[data-dialog-cancel]").hidden = Boolean(options && options.cancel === false);
    query("[data-dialog-confirm]").textContent = options && options.confirmText || "V redu";
    dialogCallback = options && options.onConfirm || null;
    backdrop.hidden = false;
    document.documentElement.classList.add("uj-modal-odprt");
    document.body.classList.add("uj-modal-odprt");
    query("[data-dialog-confirm]").focus();
  }

  function closeDialog(confirmed) {
    query("[data-dialog-backdrop]").hidden = true;
    document.documentElement.classList.remove("uj-modal-odprt");
    document.body.classList.remove("uj-modal-odprt");
    var callback = dialogCallback;
    dialogCallback = null;
    if (confirmed && callback) callback();
  }

  function fillForm(form, values) {
    queryAll("[name]", form).forEach(function (field) {
      var value = values[field.name];
      if (field.type === "radio") field.checked = String(field.value) === String(value);
      else if (field.type === "checkbox") field.checked = Boolean(value);
      else if (value != null) field.value = value;
    });
  }

  function readForm(form, target) {
    var result = Object.assign({}, target || {});
    queryAll("[name]", form).forEach(function (field) {
      if (field.closest("[data-item-id]")) return;
      if (field.type === "radio") { if (field.checked) result[field.name] = field.value; }
      else if (field.type === "checkbox") result[field.name] = field.checked;
      else result[field.name] = field.value;
    });
    return result;
  }

  function showView(name) {
    currentView = name;
    queryAll("[data-view]").forEach(function (view) { view.classList.toggle("is-active", view.getAttribute("data-view") === name); });
    var editorActions = query(".pos-editor-actions");
    if (editorActions) editorActions.hidden = name !== "invoice";
    if (name === "home") renderHome();
    if (name === "settings") fillForm(query("#pos-profile-form"), state.profile);
    if (name === "invoice") renderEditor();
    if (name === "invoice-detail") renderInvoiceDetail(activeInvoiceId);
    global.scrollTo({ top: 0, behavior: "auto" });
    fitAllText();
  }

  function renderHome() {
    var readiness = profileReadiness(state.profile);
    query("[data-profile-progress]").textContent = readiness.percent + " %";
    query("[data-profile-progress-bar]").style.width = readiness.percent + "%";
    query("[data-readiness-list]").innerHTML = readiness.checks.map(function (check) {
      return "<li class=\"" + (check.done ? "is-done" : "") + "\">" + escapeHtml(check.label) + "</li>";
    }).join("");
    var mode = query(".pos-mode");
    var live = readiness.live && backend.ready;
    mode.classList.toggle("is-live", live);
    query("[data-mode-title]").textContent = live ? "Produktion" : "Testbetrieb";
    query("[data-mode-copy]").textContent = live ? "Varna izdaja je omogočena" : readiness.live ? "Čaka varna povezava z bazo" : "Pravni računi so zaklenjeni";
    renderInvoiceList();
  }

  function renderInvoiceList() {
    var list = query("[data-invoice-list]");
    if (!state.invoices.length) {
      list.innerHTML = "<div class=\"pos-empty\"><strong>Računov še ni</strong><p>Prvi osnutek ustvarite z gumbom »Nov račun«.</p></div>";
      return;
    }
    list.innerHTML = state.invoices.slice(0, 5).map(function (invoice) {
      var status = invoice.status === "cancelled" ? "Stornirano" : invoice.status === "paid" ? "Plačano" : invoice.corrected ? "Popravljeno" : invoice.isTest ? "Test" : "Odprto";
      var disabled = invoice.status === "cancelled" ? " disabled aria-label=\"Storniran račun\"" : "";
      return "<article class=\"pos-invoice-row\" data-invoice-id=\"" + escapeHtml(invoice.id) + "\" data-open-invoice=\"" + escapeHtml(invoice.id) + "\" tabindex=\"0\"><span class=\"pos-invoice-row__icon\"><svg><use href=\"#i-receipt\"/></svg></span><div class=\"pos-invoice-row__main\"><strong data-fit-text>" + escapeHtml(invoice.draft.customerName || "Brez prejemnika") + "</strong><small data-fit-text>" + escapeHtml(invoice.number) + " · " + escapeHtml(formatDate(invoice.draft.issueDate)) + "</small></div><button class=\"pos-invoice-row__amount pos-text-button\" type=\"button\" data-record-payment=\"" + escapeHtml(invoice.id) + "\"" + disabled + "><strong data-fit-text>" + escapeHtml(formatMoney(invoice.totals.grossCents)) + "</strong><small>" + status + "</small></button></article>";
    }).join("");
    queryAll("[data-open-invoice]", list).forEach(function (row) {
      function open() { openInvoiceDetail(row.getAttribute("data-open-invoice")); }
      row.addEventListener("click", function (event) { if (!event.target.closest("[data-record-payment]")) open(); });
      row.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    });
    queryAll("[data-record-payment]", list).forEach(function (button) {
      button.addEventListener("click", function (event) { event.stopPropagation(); requestPayment(button.getAttribute("data-record-payment")); });
    });
    fitAllText();
  }

  function findInvoice(id) {
    return state.invoices.filter(function (entry) { return entry.id === id; })[0] || null;
  }

  function openInvoiceDetail(id) {
    if (!findInvoice(id)) return;
    activeInvoiceId = id;
    showView("invoice-detail");
  }

  function paymentMethodLabel(method) {
    if (method === "already_paid") return "Bereits bezahlt";
    if (method === "card_external") return "Externe Karte";
    return "Überweisung";
  }

  function setDocumentState(invoice, kind, text) {
    var copy = query("[data-detail-document-state]");
    var mark = query("[data-detail-document-check]");
    var download = query("[data-detail-download]");
    copy.textContent = text;
    mark.classList.toggle("is-ready", kind === "ready");
    mark.classList.toggle("is-error", kind === "error");
    mark.textContent = kind === "ready" ? "✓" : kind === "error" ? "!" : "•••";
    download.disabled = kind === "loading" || !invoice.serverStored;
  }

  function setEinvoiceState(invoice, kind, text) {
    var section = query("[data-detail-einvoice]");
    var copy = query("[data-detail-einvoice-state]");
    var mark = query("[data-detail-einvoice-check]");
    var action = query("[data-detail-einvoice-action]");
    var structured = invoice && (invoice.draft.customerType === "business" || invoice.draft.customerType === "public");
    section.hidden = !structured;
    if (!structured) return;
    copy.textContent = text;
    mark.classList.toggle("is-ready", kind === "ready");
    mark.classList.toggle("is-error", kind === "error");
    mark.textContent = kind === "ready" ? "✓" : kind === "error" ? "!" : "•••";
    action.disabled = kind === "loading" || !invoice.serverStored;
    var status = invoice.einvoiceDocument && (invoice.einvoiceDocument.validation_status || invoice.einvoiceDocument.validationStatus) || "pending";
    action.querySelector("span").textContent = !invoice.einvoiceDocumentReady ? "Pripravi in preveri" : status === "validated" ? "XRechnung herunterladen" : "Preveri in prenesi";
  }

  function renderAdjustmentList(invoice) {
    var section = query("[data-detail-adjustments-section]");
    var list = query("[data-detail-adjustments-list]");
    var adjustments = invoice.adjustments || [];
    var replacement = invoice.replacement || null;
    var replacementOf = invoice.replacementOf || null;
    var linkedCount = adjustments.length + (replacement ? 1 : 0) + (replacementOf ? 2 : 0);
    var cancellation = adjustments.filter(function (entry) { return entry.type === "cancellation"; })[0] || null;
    var replacementAction = query("[data-detail-replacement-action]");
    section.hidden = linkedCount === 0;
    query("[data-detail-adjustments-count]").textContent = String(linkedCount);
    replacementAction.hidden = !(cancellation && !replacement);
    if (replacementAction.hidden === false) {
      query("[data-detail-replacement-copy]").textContent = cancellation.number + " · podatki računa bodo preneseni v nov osnutek";
    }
    var rows = [];
    var downloadable = adjustments.slice();
    if (replacementOf) {
      rows.push("<article class=\"pos-adjustment-row is-origin\"><span class=\"pos-adjustment-row__icon\"><svg><use href=\"#i-receipt\"/></svg></span><div class=\"pos-adjustment-row__copy\"><strong data-fit-text data-fit-max=\"11\">Prvotni račun · " + escapeHtml(replacementOf.invoiceNumber) + "</strong><small data-fit-text data-fit-max=\"9\">Za ogled izvornega dokumenta odprite račun</small></div><button type=\"button\" data-open-linked-invoice=\"" + escapeHtml(replacementOf.invoiceId) + "\">Odpri</button></article>");
      if (replacementOf.adjustment) {
        downloadable.push(replacementOf.adjustment);
        rows.push(adjustmentRowHtml(replacementOf.adjustment));
      }
    }
    adjustments.slice().reverse().forEach(function (entry) { rows.push(adjustmentRowHtml(entry)); });
    if (replacement) {
      rows.push("<article class=\"pos-adjustment-row is-replacement\"><span class=\"pos-adjustment-row__icon\"><svg><use href=\"#i-receipt\"/></svg></span><div class=\"pos-adjustment-row__copy\"><strong data-fit-text data-fit-max=\"11\">Nadomestni račun · " + escapeHtml(replacement.invoiceNumber) + "</strong><small data-fit-text data-fit-max=\"9\">Nov račun po popolnem Stornu</small></div><button type=\"button\" data-open-linked-invoice=\"" + escapeHtml(replacement.invoiceId) + "\">Odpri</button></article>");
    }
    list.innerHTML = rows.join("");

    function adjustmentRowHtml(entry) {
      var cancellation = entry.type === "cancellation";
      var title = cancellation ? "Stornorechnung" : "Rechnungsberichtigung";
      var stateCopy = entry.documentReady ? "PDF" : "Pripravi PDF";
      return "<article class=\"pos-adjustment-row " + (cancellation ? "is-cancellation" : "") + "\"><span class=\"pos-adjustment-row__icon\"><svg><use href=\"#" + (cancellation ? "i-trash" : "i-info") + "\"/></svg></span><div class=\"pos-adjustment-row__copy\"><strong data-fit-text data-fit-max=\"11\">" + escapeHtml(title + " · " + entry.number) + "</strong><small data-fit-text data-fit-max=\"9\">" + escapeHtml(formatDate(String(entry.createdAt || "").slice(0, 10)) + " · " + entry.reason) + "</small></div><button type=\"button\" data-download-adjustment=\"" + escapeHtml(entry.id) + "\">" + stateCopy + "</button></article>";
    }
    queryAll("[data-download-adjustment]", list).forEach(function (button) {
      button.addEventListener("click", async function () {
        var entry = downloadable.filter(function (item) { return item.id === button.getAttribute("data-download-adjustment"); })[0];
        if (!entry) return;
        button.disabled = true;
        button.textContent = "Preverjam …";
        try { await downloadAdjustmentPdf(entry); button.textContent = "PDF"; showToast("Arhivirani popravek je prenesen."); }
        catch (error) { button.textContent = "Poskusi znova"; showToast(error.message || "Popravka ni bilo mogoče prenesti."); }
        finally { button.disabled = false; }
      });
    });
    queryAll("[data-open-linked-invoice]", list).forEach(function (button) {
      button.addEventListener("click", function () { openInvoiceDetail(button.getAttribute("data-open-linked-invoice")); });
    });
  }

  function deliveryFormatLabel(format) {
    if (format === "xrechnung") return "XRechnung XML";
    if (format === "xrechnung_pdf") return "XRechnung + PDF";
    return "PDF";
  }

  function deliveryChannelLabel(channel) {
    if (channel === "ozg_re") return "OZG-RE";
    if (channel === "peppol") return "Peppol";
    return "E-pošta";
  }

  function deliveryStatusLabel(status, entry) {
    var testEmail = Boolean(entry && entry.isTest && entry.provider === "resend");
    if (testEmail && (status === "test_completed" || status === "sent")) return "Test poslano";
    if (status === "delivery_delayed") return "Zakasnjeno";
    if (status === "bounced") return "Zavrnjeno";
    if (status === "complained") return "Prijavljeno";
    if (status === "suppressed") return "Zadržano";
    if (status === "queued") return "V čakalni vrsti";
    if (status === "processing") return "Preverjam";
    if (status === "test_completed") return "Sandbox končan";
    if (status === "sent") return "Poslano";
    if (status === "delivered") return testEmail ? "Test dostavljeno" : "Dostavljeno";
    if (status === "failed") return "Napaka";
    return "Testno pripravljeno";
  }

  function deliveryEventLabel(type, entry) {
    var testEmail = Boolean(entry && entry.isTest && entry.provider === "resend");
    if (testEmail && (type === "test_completed" || type === "sent")) return "Test poslano";
    if (type === "delivery_delayed") return "Zakasnjeno";
    if (type === "bounced") return "Zavrnjeno";
    if (type === "complained") return "Neželena pošta";
    if (type === "suppressed") return "Zadržano";
    if (type === "opened") return "Odprto";
    if (type === "clicked") return "Kliknjeno";
    if (type === "prepared") return "Pripravljeno";
    if (type === "queued") return "V vrsti";
    if (type === "processing") return "Preverjanje";
    if (type === "retry_scheduled") return "Ponovitev";
    if (type === "test_completed") return "Končano";
    if (type === "sent") return "Poslano";
    if (type === "delivered") return testEmail ? "Test dostavljeno" : "Dostavljeno";
    return "Napaka";
  }

  function deliveryTimeline(entry) {
    var events = (entry.events || []).slice().sort(function (left, right) {
      return Date.parse(left.provider_event_at || left.created_at || 0) - Date.parse(right.provider_event_at || right.created_at || 0);
    }).slice(-5);
    if (!events.length) return "";
    return "<ol class=\"pos-delivery-timeline\" aria-label=\"Časovnica dostave\">" + events.map(function (event, index) {
      var type = String(event.event_type || "failed");
      var eventTime = event.provider_event_at || event.created_at; var time = eventTime ? new Date(eventTime).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" }) : "";
      return "<li class=\"pos-delivery-timeline__step is-" + escapeHtml(type) + (index === events.length - 1 ? " is-current" : "") + "\" title=\"" + escapeHtml(time) + "\"><i></i><span>" + escapeHtml(deliveryEventLabel(type, entry)) + "</span></li>";
    }).join("") + "</ol>";
  }

  function renderDeliveryList(invoice) {
    var section = query("[data-detail-deliveries-section]");
    var list = query("[data-detail-deliveries-list]");
    var deliveries = (invoice.deliveries || []).slice().reverse();
    section.hidden = !deliveries.length;
    query("[data-detail-deliveries-count]").textContent = String(deliveries.length);
    list.innerHTML = deliveries.map(function (entry) {
      var target = entry.isTest && entry.provider === "resend" ? "dovoljeni testni naslov" : entry.recipient || entry.routingReference || "Sandbox";
      var validation = entry.validationStatus === "pending" ? " · čaka KoSIT" : "";
      var retry = entry.status === "failed" && entry.attemptCount < entry.maxAttempts
        ? "<button type=\"button\" class=\"pos-delivery-row__retry\" data-retry-delivery=\"" + escapeHtml(entry.id) + "\" data-email=\"" + (entry.provider === "resend" ? "true" : "false") + "\">Ponovi</button>"
        : "";
      return "<article class=\"pos-delivery-row\"><span class=\"pos-delivery-row__icon\"><svg><use href=\"#i-export\"/></svg></span><div class=\"pos-delivery-row__copy\"><strong data-fit-text data-fit-max=\"11\">" + escapeHtml(deliveryFormatLabel(entry.documentFormat) + " · " + deliveryChannelLabel(entry.channel)) + "</strong><small data-fit-text data-fit-max=\"9\">" + escapeHtml(formatDate(String(entry.createdAt || "").slice(0, 10)) + " · " + target + validation) + "</small></div><div class=\"pos-delivery-row__actions\"><span class=\"pos-delivery-row__status is-" + escapeHtml(entry.status) + "\">" + escapeHtml(deliveryStatusLabel(entry.status, entry)) + "</span>" + retry + "</div>" + deliveryTimeline(entry) + "</article>";
    }).join("");
    queryAll("[data-retry-delivery]", list).forEach(function (button) {
      button.addEventListener("click", async function () {
        button.disabled = true;
        button.textContent = "Čakaj …";
        try {
          if (button.getAttribute("data-email") === "true") await posDeliveryEmailRequest(button.getAttribute("data-retry-delivery"));
          else await queueAndRunSandbox(button.getAttribute("data-retry-delivery"));
          await loadServerState();
          activeInvoiceId = invoice.id;
          showView("invoice-detail");
          showToast(button.getAttribute("data-email") === "true" ? "E-poštna dostava je ponovno zagnana." : "Sandbox preizkus je končan. Nič ni bilo poslano.");
        } catch (error) {
          button.disabled = false;
          button.textContent = "Ponovi";
          showToast(error && error.message || "Ponovni sandbox preizkus ni uspel.");
        }
      });
    });
  }

  function syncDeliveryMode() {
    var invoice = findInvoice(deliveryInvoiceId);
    if (!invoice) return;
    var form = query("#pos-delivery-form");
    var recommendation = deliveryRecommendation(invoice, state.profile);
    var channel = form.elements.deliveryChannel;
    var format = form.elements.deliveryFormat;
    var type = invoice.draft.customerType || "private";
    queryAll("option", channel).forEach(function (option) {
      option.disabled = type === "public" ? option.value === "email" : option.value !== "email";
    });
    queryAll("option", format).forEach(function (option) {
      if (type === "private") option.disabled = option.value !== "pdf";
      else if (type === "public") option.disabled = option.value !== "xrechnung";
      else option.disabled = option.value === "pdf" && !recommendation.pdfAllowed;
    });
    if (channel.options[channel.selectedIndex] && channel.options[channel.selectedIndex].disabled) channel.value = recommendation.channel;
    if (format.options[format.selectedIndex] && format.options[format.selectedIndex].disabled) format.value = recommendation.documentFormat;
    channel.disabled = type !== "public";
    format.disabled = type === "private" || type === "public";

    var selectedFormat = format.value;
    var isPublic = type === "public";
    var isStructured = selectedFormat !== "pdf";
    query("[data-delivery-email-fields]").hidden = isPublic;
    query("[data-delivery-public-fields]").hidden = !isPublic;
    query("[data-delivery-consent]").hidden = isStructured || !recommendation.pdfConsentRequired;
    query("[data-delivery-recommendation]").textContent = selectedFormat === recommendation.documentFormat ? recommendation.title : "PDF po e-pošti";
    query("[data-delivery-recommendation-copy]").textContent = selectedFormat === recommendation.documentFormat ? recommendation.copy : "Dovoljeno samo s soglasjem prejemnika.";
    query("[data-delivery-format-badge]").textContent = selectedFormat === "pdf" ? "PDF" : selectedFormat === "xrechnung" ? "XML" : "XML + PDF";

    var validation = query("[data-delivery-validation]");
    var einvoiceStatus = invoice.einvoiceDocument && (invoice.einvoiceDocument.validation_status || invoice.einvoiceDocument.validationStatus) || "pending";
    validation.classList.toggle("is-pending", isStructured && einvoiceStatus !== "validated");
    query("[data-delivery-validation-title]").textContent = !isStructured ? "PDF je pripravljen" : einvoiceStatus === "validated" ? "KoSIT validacija uspešna" : einvoiceStatus === "failed" ? "KoSIT je našel napake" : "KoSIT validacija še čaka";
    query("[data-delivery-validation-copy]").textContent = !isStructured
      ? "Za PDF KoSIT validacija ni potrebna."
      : einvoiceStatus === "validated" ? "Arhivirani XML je prestal uradno konfiguracijo XRechnung."
        : einvoiceStatus === "failed" ? "Dokumenta ni dovoljeno poslati, dokler napake niso odpravljene."
          : (deliveryCapability.liveEnabled ? "Pošiljanje je dovoljeno šele po uspešni KoSIT validaciji." : "Sandbox se lahko zažene šele po uspešni KoSIT validaciji.");
    syncDeliveryCapabilityUi();
  }

  function syncDeliveryCapabilityUi() {
    var send = Boolean(deliveryCapability && deliveryCapability.sendEnabled);
    var test = Boolean(deliveryCapability && deliveryCapability.testEnabled);
    var live = Boolean(deliveryCapability && deliveryCapability.liveEnabled);
    var note = query("[data-delivery-mode-note]");
    if (!note) return;
    note.classList.toggle("is-live", send);
    note.classList.toggle("is-test", test);
    query("[data-delivery-mode-title]").textContent = test ? "Varni e-poštni test" : live ? "Pravo e-poštno pošiljanje" : "Varen sandbox";
    query("[data-delivery-mode-copy]").textContent = test
      ? "Račun bo dejansko poslan samo na strežniško določen testni naslov. Stranka ga ne bo prejela."
      : live ? "Po potrditvi bo račun z izbranimi prilogami dejansko poslan prejemniku."
      : "Preverimo celoten potek, vendar račun ne zapusti sistema in ni dejansko poslan.";
    query("[data-delivery-confirm-copy]").textContent = test
      ? "S potrditvijo dovolim testno pošiljanje samo na dovoljeni testni naslov."
      : live ? "S potrditvijo dovolim dejansko pošiljanje na prikazani e-poštni naslov."
      : "Sandbox zabeleži preizkus, brez zunanjega pošiljanja.";
    var submit = query("[data-delivery-submit]");
    if (submit && !deliverySubmitting) submit.textContent = test ? "Pošlji test" : live ? "Pošlji račun" : "Zaženi sandbox";
  }

  async function loadDeliveryCapability() {
    var previous = Boolean(deliveryCapability.sendEnabled);
    try {
      var token = await apiSessionToken();
      var response = await fetch("/api/pos-dostava-email", { method: "GET", headers: { Authorization: "Bearer " + token } });
      var body = null;
      try { body = await response.json(); } catch (_error) {}
      if (!response.ok || !body || !body.delivery) throw new Error("Stanje e-poštnega ponudnika ni dosegljivo.");
      deliveryCapability = {
        provider: body.delivery.provider === "resend" ? "resend" : "resend",
        configured: Boolean(body.delivery.configured),
        sendEnabled: Boolean(body.delivery.sendEnabled),
        testEnabled: Boolean(body.delivery.testEnabled),
        liveEnabled: Boolean(body.delivery.liveEnabled),
        mode: String(body.delivery.mode || "sandbox")
      };
    } catch (_error) {
      deliveryCapability = { provider: "resend", configured: false, sendEnabled: false, testEnabled: false, liveEnabled: false, mode: "sandbox" };
    }
    if (!previous && deliveryCapability.sendEnabled) {
      var form = query("#pos-delivery-form");
      if (form) form.elements.deliveryConfirmed.checked = false;
    }
    syncDeliveryCapabilityUi();
    return deliveryCapability;
  }

  async function posDeliverySandboxRequest(deliveryId) {
    var token = await apiSessionToken();
    var response = await fetch("/api/pos-dostava-sandbox", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId: deliveryId })
    });
    var body = null;
    try { body = await response.json(); } catch (_error) {}
    if (!response.ok) throw new Error(body && body.napaka || "Sandbox dostave ni bilo mogoče izvesti.");
    return body;
  }

  async function posDeliveryEmailRequest(deliveryId) {
    var token = await apiSessionToken();
    var response = await fetch("/api/pos-dostava-email", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId: deliveryId, confirmed: true })
    });
    var body = null;
    try { body = await response.json(); } catch (_error) {}
    if (!response.ok) throw new Error(body && body.napaka || "E-poštnega računa ni bilo mogoče poslati.");
    return body;
  }

  async function queueAndRunSandbox(deliveryId) {
    var queued = await backend.client.rpc("pos_queue_invoice_delivery", {
      p_delivery_id: deliveryId,
      p_confirmed: true
    });
    if (queued.error) throw queued.error;
    return posDeliverySandboxRequest(deliveryId);
  }

  function openDeliverySheet(invoice) {
    if (!invoice || invoice.status === "cancelled") { showToast("Storniranega računa ni dovoljeno poslati."); return; }
    if (!invoice.serverStored || !backend.ready) { showToast("Pošiljanje potrebuje varno shranjen račun."); return; }
    deliveryInvoiceId = invoice.id;
    deliveryRequestKey = randomUuid();
    var form = query("#pos-delivery-form");
    form.reset();
    var recommendation = deliveryRecommendation(invoice, state.profile);
    form.elements.deliveryChannel.value = recommendation.channel;
    form.elements.deliveryFormat.value = recommendation.documentFormat;
    form.elements.deliveryRecipient.value = invoice.draft.customerEmail || "";
    form.elements.deliveryRoutingReference.value = invoice.draft.leitwegId || "";
    form.elements.deliverySubject.value = "Rechnung " + invoice.number;
    form.elements.deliveryMessage.value = "Guten Tag,\n\nanbei erhalten Sie die Rechnung " + invoice.number + ".\n\nMit freundlichen Grüßen\n" + (state.profile.legalName || "");
    query("[data-delivery-invoice-reference]").textContent = invoice.number + " · " + formatMoney(invoice.totals.grossCents);
    query("[data-delivery-backdrop]").hidden = false;
    document.documentElement.classList.add("uj-modal-odprt");
    document.body.classList.add("uj-modal-odprt");
    syncDeliveryMode();
    loadDeliveryCapability().then(function () { if (deliveryInvoiceId === invoice.id) syncDeliveryMode(); });
    if (recommendation.documentFormat !== "pdf" && !invoice.einvoiceDocumentReady) {
      ensureEinvoiceDocument(invoice).then(function () { if (deliveryInvoiceId === invoice.id) syncDeliveryMode(); })
        .catch(function (error) { if (deliveryInvoiceId === invoice.id) { syncDeliveryMode(); showToast(error.message || "XRechnung še ni pripravljen."); } });
    }
    fitAllText();
  }

  function closeDeliverySheet() {
    if (deliverySubmitting) return;
    query("[data-delivery-backdrop]").hidden = true;
    document.documentElement.classList.remove("uj-modal-odprt");
    document.body.classList.remove("uj-modal-odprt");
    deliveryInvoiceId = null;
    deliveryRequestKey = null;
  }

  async function submitDelivery(event) {
    event.preventDefault();
    if (deliverySubmitting) return;
    var invoice = findInvoice(deliveryInvoiceId);
    if (!invoice || !backend.ready || !backend.userId) { showToast("Varna hramba ni povezana."); return; }
    var form = event.currentTarget;
    var confirmed = form.elements.deliveryConfirmed.checked;
    if (!confirmed) { showToast("Pred pripravo potrdite prejemnika, kanal in dokument."); return; }
    var recommendation = deliveryRecommendation(invoice, state.profile);
    var format = form.elements.deliveryFormat.value;
    var consent = form.elements.deliveryRecipientConsent.checked;
    if (format === "pdf" && recommendation.pdfConsentRequired && !consent) { showToast("Za elektronski PDF potrdite soglasje prejemnika."); return; }
    if (invoice.draft.customerType !== "public" && !String(form.elements.deliveryRecipient.value || "").trim()) { showToast("Vnesite e-poštni naslov prejemnika."); return; }
    deliverySubmitting = true;
    var submit = query("[data-delivery-submit]");
    submit.disabled = true;
    submit.textContent = "Preverjam …";
    try {
      if ((format === "pdf" || format === "xrechnung_pdf") && !invoice.documentReady) {
        await ensureInvoiceDocument(invoice);
      }
      if (format !== "pdf") {
        var documentStatus = invoice.einvoiceDocument && (invoice.einvoiceDocument.validation_status || invoice.einvoiceDocument.validationStatus);
        if (documentStatus !== "validated") {
          await ensureEinvoiceDocument(invoice, true);
          documentStatus = invoice.einvoiceDocument && (invoice.einvoiceDocument.validation_status || invoice.einvoiceDocument.validationStatus);
        }
        if (documentStatus !== "validated") throw new Error("Strukturirani račun še ni prestal KoSIT validacije.");
      }
      var result = await backend.client.rpc("pos_prepare_invoice_delivery", {
        p_invoice_id: invoice.id,
        p_request_key: deliveryRequestKey,
        p_channel: form.elements.deliveryChannel.value,
        p_document_format: format,
        p_recipient: invoice.draft.customerType === "public" ? "" : String(form.elements.deliveryRecipient.value || "").trim(),
        p_routing_reference: invoice.draft.customerType === "public" ? String(form.elements.deliveryRoutingReference.value || "").trim() : "",
        p_subject: invoice.draft.customerType === "public" ? "" : String(form.elements.deliverySubject.value || "").trim(),
        p_message: invoice.draft.customerType === "public" ? "" : String(form.elements.deliveryMessage.value || ""),
        p_recipient_consent: consent,
        p_confirmed: confirmed
      });
      if (result.error) throw result.error;
      var prepared = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!prepared || !prepared.id) throw new Error("Pripravljena dostava nima veljavne oznake.");
      submit.textContent = deliveryCapability.testEnabled ? "Pošiljam test …" : deliveryCapability.liveEnabled ? "Pošiljam …" : "Sandbox …";
      var deliveryResult = deliveryCapability.sendEnabled
        ? await posDeliveryEmailRequest(prepared.id)
        : await queueAndRunSandbox(prepared.id);
      deliverySubmitting = false;
      submit.disabled = false;
      submit.textContent = deliveryCapability.testEnabled ? "Pošlji test" : deliveryCapability.liveEnabled ? "Pošlji račun" : "Zaženi sandbox";
      closeDeliverySheet();
      await loadServerState();
      activeInvoiceId = invoice.id;
      showView("invoice-detail");
      showToast(deliveryCapability.testEnabled
        ? "Testni račun je poslan samo na dovoljeni testni naslov."
        : deliveryCapability.liveEnabled
        ? (deliveryResult && deliveryResult.sent ? "Račun je oddan e-poštnemu ponudniku." : "Račun čaka na varno pošiljanje.")
        : "Sandbox preizkus je končan. Nič ni bilo poslano.");
    } catch (error) {
      deliverySubmitting = false;
      submit.disabled = false;
      submit.textContent = "Poskusi znova";
      showToast(error && error.message || "Pošiljanja ni bilo mogoče pripraviti.");
    }
  }

  function renderInvoiceDetail(id) {
    var invoice = findInvoice(id);
    if (!invoice) { showView("home"); return; }
    query("[data-detail-number]").textContent = invoice.number;
    query("[data-detail-customer]").textContent = invoice.draft.customerName || "Brez prejemnika";
    query("[data-detail-date]").textContent = "Ausgestellt am " + formatDate(invoice.draft.issueDate);
    query("[data-detail-amount]").textContent = formatMoney(invoice.totals.grossCents);
    query("[data-detail-issued]").textContent = formatDate(invoice.draft.issueDate);
    query("[data-detail-due]").textContent = formatDate(invoice.dueDate);
    query("[data-detail-method]").textContent = paymentMethodLabel(invoice.draft.paymentMethod);
    query("[data-detail-payment-status]").textContent = invoice.status === "cancelled" ? "Storniert" : invoice.status === "paid" ? "Bezahlt" : "Offen";
    var status = query("[data-detail-status]");
    status.classList.toggle("is-paid", invoice.status === "paid");
    status.classList.toggle("is-test", invoice.isTest && invoice.status !== "paid");
    status.classList.toggle("is-cancelled", invoice.status === "cancelled");
    status.classList.toggle("is-corrected", invoice.corrected && invoice.status === "open");
    status.textContent = invoice.status === "cancelled" ? "Stornirano" : invoice.status === "paid" ? "Plačano" : invoice.corrected ? "Popravljeno" : invoice.isTest ? "Test" : "Odprto";
    query("[data-detail-payment]").disabled = invoice.status === "cancelled";
    query("[data-detail-copy]").disabled = invoice.status === "cancelled";
    query("[data-detail-correction]").disabled = invoice.status === "cancelled" || !invoice.serverStored;
    query("[data-detail-send]").disabled = invoice.status === "cancelled" || !invoice.serverStored;
    if (!invoice.serverStored) setDocumentState(invoice, "error", "Lokalni test nima strežniškega PDF originala.");
    else if (invoice.documentReady) setDocumentState(invoice, "ready", "Arhiviran in preverjen original");
    else {
      setDocumentState(invoice, "loading", "Dokument se varno pripravlja …");
      ensureInvoiceDocument(invoice).then(function () { if (activeInvoiceId === invoice.id) renderInvoiceDetail(invoice.id); })
        .catch(function (error) { if (activeInvoiceId === invoice.id) setDocumentState(invoice, "error", error.message || "PDF ni pripravljen."); });
    }
    if (invoice.draft.customerType === "business" || invoice.draft.customerType === "public") {
      var einvoiceStatus = invoice.einvoiceDocument && (invoice.einvoiceDocument.validation_status || invoice.einvoiceDocument.validationStatus) || "pending";
      if (invoice.einvoiceDocumentReady) {
        setEinvoiceState(invoice, einvoiceStatus === "validated" ? "ready" : einvoiceStatus === "failed" ? "error" : "pending",
          einvoiceStatus === "validated" ? "KoSIT potrjen arhivirani original" : einvoiceStatus === "failed" ? "KoSIT je našel napake" : "Arhiviran · validator še ni povezan");
      } else if (!invoice.serverStored) setEinvoiceState(invoice, "error", "Lokalni test nima arhiviranega XRechnung originala.");
      else {
        setEinvoiceState(invoice, "loading", "UBL XML se varno pripravlja …");
        ensureEinvoiceDocument(invoice).then(function () { if (activeInvoiceId === invoice.id) renderInvoiceDetail(invoice.id); })
          .catch(function (error) { if (activeInvoiceId === invoice.id) setEinvoiceState(invoice, "error", error.message || "XRechnung ni pripravljen."); });
      }
    } else setEinvoiceState(invoice, "pending", "");
    renderAdjustmentList(invoice);
    renderDeliveryList(invoice);
    fitAllText();
  }

  async function apiSessionToken() {
    if (!backend.client) throw new Error("Prijava ni povezana.");
    var result = await backend.client.auth.getSession();
    var session = result.data && result.data.session;
    if (!session || !session.access_token) throw new Error("Prijava je potekla.");
    return session.access_token;
  }

  async function posPdfRequest(invoiceId, mode) {
    var token = await apiSessionToken();
    var response = await fetch("/api/pos-racun-pdf?invoiceId=" + encodeURIComponent(invoiceId) + "&mode=" + encodeURIComponent(mode || "download"), {
      method: mode === "metadata" ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) {
      var body = null;
      try { body = await response.json(); } catch (_error) {}
      throw new Error(body && body.napaka || "PDF dokumenta ni bilo mogoče pripraviti.");
    }
    return response;
  }

  async function ensureInvoiceDocument(invoice) {
    if (!invoice || !invoice.serverStored) throw new Error("Za lokalni test strežniški PDF ni na voljo.");
    var response = await posPdfRequest(invoice.id, "metadata");
    var body = await response.json();
    invoice.documentReady = true;
    invoice.document = body.document;
    persist();
    return body.document;
  }

  async function posEinvoiceRequest(invoiceId, mode) {
    var token = await apiSessionToken();
    var action = mode || "download";
    var response = await fetch("/api/pos-racun-xrechnung?invoiceId=" + encodeURIComponent(invoiceId) + "&mode=" + encodeURIComponent(action), {
      method: action === "metadata" || action === "validate" ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) {
      var body = null;
      try { body = await response.json(); } catch (_error) {}
      throw new Error(body && body.napaka || "XRechnung dokumenta ni bilo mogoče pripraviti.");
    }
    return response;
  }

  async function ensureEinvoiceDocument(invoice, retryValidation) {
    if (!invoice || !invoice.serverStored) throw new Error("Za lokalni test strežniški XRechnung ni na voljo.");
    var response = await posEinvoiceRequest(invoice.id, retryValidation ? "validate" : "metadata");
    var body = await response.json();
    invoice.einvoiceDocumentReady = true;
    invoice.einvoiceDocument = body.document;
    persist();
    return body.document;
  }

  async function downloadInvoiceEinvoice(invoice) {
    if (!invoice || !invoice.serverStored) throw new Error("XRechnung je na voljo po varni strežniški izdaji.");
    var status = invoice.einvoiceDocument && (invoice.einvoiceDocument.validation_status || invoice.einvoiceDocument.validationStatus) || "pending";
    if (!invoice.einvoiceDocumentReady || status !== "validated") await ensureEinvoiceDocument(invoice, invoice.einvoiceDocumentReady);
    var response = await posEinvoiceRequest(invoice.id, "download");
    var blob = await response.blob();
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = invoice.number.replace(/[^A-Za-z0-9._-]+/g, "-") + "-XRechnung.xml";
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  async function downloadInvoicePdf(invoice) {
    if (!invoice || !invoice.serverStored) throw new Error("PDF je na voljo po varni strežniški izdaji.");
    setDocumentState(invoice, "loading", "Preverjam arhivirani original …");
    var response = await posPdfRequest(invoice.id, "download");
    var blob = await response.blob();
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = invoice.number.replace(/[^A-Za-z0-9._-]+/g, "-") + ".pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    invoice.documentReady = true;
    setDocumentState(invoice, "ready", "Arhiviran in preverjen original");
  }

  async function adjustmentPdfRequest(adjustmentId, mode) {
    var token = await apiSessionToken();
    var response = await fetch("/api/pos-racun-korekcija?adjustmentId=" + encodeURIComponent(adjustmentId) + "&mode=" + encodeURIComponent(mode || "download"), {
      method: mode === "metadata" ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) {
      var body = null;
      try { body = await response.json(); } catch (_error) {}
      throw new Error(body && body.napaka || "Korekcijskega dokumenta ni bilo mogoče pripraviti.");
    }
    return response;
  }

  async function ensureAdjustmentDocument(adjustment) {
    var response = await adjustmentPdfRequest(adjustment.id, "metadata");
    var body = await response.json();
    adjustment.documentReady = true;
    adjustment.document = body.document;
    persist();
    return body.document;
  }

  async function downloadAdjustmentPdf(adjustment) {
    if (!adjustment.documentReady) await ensureAdjustmentDocument(adjustment);
    var response = await adjustmentPdfRequest(adjustment.id, "download");
    var blob = await response.blob();
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = adjustment.number.replace(/[^A-Za-z0-9._-]+/g, "-") + ".pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function syncAdjustmentMode() {
    var form = query("#pos-adjustment-form");
    var type = query("[name=adjustmentType]:checked", form).value;
    var cancellation = type === "cancellation";
    query("[data-adjustment-fields]").hidden = cancellation;
    var warning = query("[data-adjustment-warning]");
    warning.classList.toggle("is-cancellation", cancellation);
    var invoice = findInvoice(adjustmentInvoiceId);
    warning.querySelector("p").textContent = cancellation
      ? "Ustvarjen bo popoln negativni Storno v znesku " + formatMoney(invoice ? invoice.totals.grossCents : 0) + ". Original ostane v arhivu." + (invoice && invoice.status === "paid" ? " Že prejeto plačilo ostane posebej evidentirano in ga je treba po potrebi povrniti." : "")
      : "Popravek se bo jasno skliceval na original. Originalni PDF ostane nespremenjen.";
    query("[data-adjustment-confirm-copy]").textContent = cancellation
      ? "Storno razveljavi celotni račun; pozneje plačila ni več mogoče knjižiti."
      : "Ustvarjen bo nov nespremenljiv dokument samo s spremenjenimi podatki.";
    query("[data-adjustment-submit]").textContent = cancellation ? "Ustvari Storno" : "Ustvari popravek";
  }

  function openAdjustmentSheet(invoice) {
    if (!invoice || !invoice.serverStored) { showToast("Popravek je na voljo po varni strežniški izdaji."); return; }
    if (invoice.status === "cancelled") { showToast("Storniranega računa ni mogoče ponovno popraviti."); return; }
    adjustmentInvoiceId = invoice.id;
    var form = query("#pos-adjustment-form");
    form.reset();
    query("[name=adjustmentType][value=correction]", form).checked = true;
    var values = {
      customer_name: invoice.draft.customerName,
      customer_street: invoice.draft.customerStreet,
      customer_postal_code: invoice.draft.customerPostalCode,
      customer_city: invoice.draft.customerCity,
      service_date: invoice.draft.serviceDate,
      due_date: invoice.dueDate
    };
    Object.keys(values).forEach(function (key) { query("[name=" + key + "]", form).value = values[key] || ""; });
    query("[data-adjustment-invoice-reference]").textContent = invoice.number + " · " + formatMoney(invoice.totals.grossCents);
    query("[data-adjustment-backdrop]").hidden = false;
    document.documentElement.classList.add("uj-modal-odprt");
    document.body.classList.add("uj-modal-odprt");
    syncAdjustmentMode();
    global.setTimeout(function () { query("[name=reason]", form).focus(); }, 20);
  }

  function closeAdjustmentSheet() {
    if (adjustmentSubmitting) return;
    query("[data-adjustment-backdrop]").hidden = true;
    document.documentElement.classList.remove("uj-modal-odprt");
    document.body.classList.remove("uj-modal-odprt");
    adjustmentInvoiceId = null;
  }

  async function submitAdjustment(event) {
    event.preventDefault();
    if (adjustmentSubmitting) return;
    var invoice = findInvoice(adjustmentInvoiceId);
    var form = event.currentTarget;
    if (!invoice || !backend.client || !backend.ready) { showToast("Varna hramba popravkov ni povezana."); return; }
    var type = query("[name=adjustmentType]:checked", form).value;
    var reason = String(query("[name=reason]", form).value || "").trim();
    var confirmed = query("[name=confirmed]", form).checked;
    if (reason.length < 5) { showToast("Razlog naj vsebuje najmanj 5 znakov."); return; }
    if (!confirmed) { showToast("Potrdite vrsto in vsebino popravka."); return; }
    var fieldValues = {};
    queryAll("[data-adjustment-fields] [name]", form).forEach(function (field) { fieldValues[field.name] = field.value; });
    var changes = type === "correction" ? buildAdjustmentChanges(invoice, fieldValues) : {};
    if (type === "correction" && !Object.keys(changes).length) { showToast("Spremenite najmanj en podatek."); return; }

    adjustmentSubmitting = true;
    var submit = query("[data-adjustment-submit]");
    submit.disabled = true;
    submit.textContent = "Varno shranjujem …";
    try {
      var result = await backend.client.rpc("pos_create_invoice_adjustment", {
        p_invoice_id: invoice.id,
        p_adjustment_type: type,
        p_reason: reason,
        p_changes: changes,
        p_confirmed: true
      }).single();
      if (result.error) throw result.error;
      var adjustment = adjustmentFromServer(result.data, {});
      var documentReady = true;
      try { await ensureAdjustmentDocument(adjustment); }
      catch (_pdfError) { documentReady = false; }
      adjustmentSubmitting = false;
      submit.disabled = false;
      closeAdjustmentSheet();
      await loadServerState();
      activeInvoiceId = invoice.id;
      showView("invoice-detail");
      showToast(type === "cancellation"
        ? (documentReady ? "Storno in njegov PDF sta varno izdana." : "Storno je izdan; PDF se pripravi ob prenosu.")
        : (documentReady ? "Popravek in njegov PDF sta varno izdana." : "Popravek je izdan; PDF se pripravi ob prenosu."));
    } catch (error) {
      adjustmentSubmitting = false;
      submit.disabled = false;
      syncAdjustmentMode();
      showToast(error && error.message || "Popravka ni bilo mogoče ustvariti.");
    }
  }

  function startInvoice() {
    if (!state.draft) state.draft = defaultDraft(state.profile);
    currentStep = 1;
    persist();
    showView("invoice");
  }

  function openReplacementDraft(invoice, cancellation) {
    var existingServerId = state.draft && state.draft.serverId || null;
    var draft = replacementDraftFromInvoice(invoice, cancellation, state.profile);
    if (!draft) { showToast("Za nadomestni račun je potreben veljaven Storno."); return; }
    draft.serverId = existingServerId;
    state.draft = draft;
    currentStep = 1;
    activeInvoiceId = null;
    persist();
    showView("invoice");
    showToast("Podatki so preneseni. Popravite znesek ali DDV in račun ponovno preverite.");
  }

  function startReplacementInvoice(invoice) {
    if (!invoice || invoice.status !== "cancelled" || invoice.replacement) {
      showToast(invoice && invoice.replacement ? "Nadomestni račun za ta Storno že obstaja." : "Najprej je potreben popoln Storno računa.");
      return;
    }
    var cancellation = (invoice.adjustments || []).filter(function (entry) { return entry.type === "cancellation"; })[0];
    if (!cancellation) { showToast("Povezani Storno ni na voljo."); return; }
    var existingReplacement = normalizeReplacementContext(state.draft);
    if (state.draft && existingReplacement && existingReplacement.cancellationAdjustmentId === cancellation.id) {
      currentStep = 1;
      activeInvoiceId = null;
      showView("invoice");
      showToast("Nadaljujete že pripravljeni nadomestni račun.");
      return;
    }
    if (state.draft && (!existingReplacement || existingReplacement.cancellationAdjustmentId !== cancellation.id)) {
      openDialog(
        "Zamenjati trenutni osnutek?",
        "Trenutni osnutek bo zamenjan. Za nadomestni račun bomo prenesli podatke iz " + invoice.number + ".",
        { confirmText: "Ustvari nadomestni račun", onConfirm: function () { openReplacementDraft(invoice, cancellation); } }
      );
      return;
    }
    openReplacementDraft(invoice, cancellation);
  }

  function closeEditor() {
    syncDraftFromForm();
    persist();
    showView("home");
  }

  function syncDraftFromForm() {
    var form = query("#pos-invoice-form");
    if (!state.draft || !form) return;
    state.draft = readForm(form, state.draft);
    state.draft.items = readItems();
  }

  function readItems() {
    return queryAll("[data-item-id]").map(function (row) {
      var item = { id: row.getAttribute("data-item-id") };
      queryAll("[name]", row).forEach(function (field) { item[field.name] = field.value; });
      return item;
    });
  }

  function renderEditor() {
    if (!state.draft) state.draft = defaultDraft(state.profile);
    fillForm(query("#pos-invoice-form"), state.draft);
    var replacement = normalizeReplacementContext(state.draft);
    var banner = query("[data-replacement-banner]");
    banner.hidden = !replacement;
    if (replacement) {
      query("[data-replacement-title]").textContent = "Nadomestni račun za " + (replacement.cancellationNumber || "Storno");
      query("[data-replacement-copy]").textContent = "Prvotni račun " + (replacement.originalInvoiceNumber || "—") + " · vsi podatki morajo biti ponovno potrjeni";
    }
    renderItems();
    syncCustomerFields();
    syncTaxFields();
    setStep(currentStep, false);
  }

  function itemTemplate(item, index) {
    var calc = calculateItem(item, state.draft.priceMode, state.draft.taxMode);
    return "<article class=\"pos-item\" data-item-id=\"" + escapeHtml(item.id) + "\"><div class=\"pos-item__head\"><strong>Postavka " + (index + 1) + "</strong><button class=\"pos-item__remove\" type=\"button\" data-remove-item aria-label=\"Odstrani postavko\"><svg><use href=\"#i-trash\"/></svg></button></div><div class=\"pos-item__grid\"><label class=\"pos-field\"><span>Opis *</span><input name=\"description\" value=\"" + escapeHtml(item.description) + "\" data-fit-input maxlength=\"240\" /></label><label class=\"pos-field\"><span>Vrsta</span><select name=\"category\"><option value=\"labour\">Delo</option><option value=\"travel\">Vožnja</option><option value=\"machine\">Stroj</option><option value=\"material\">Material</option><option value=\"goods\">Blago</option><option value=\"other\">Drugo</option></select></label></div><div class=\"pos-item__numbers\"><label class=\"pos-field\"><span>Količina</span><input name=\"quantity\" inputmode=\"decimal\" value=\"" + escapeHtml(item.quantity) + "\" /></label><label class=\"pos-field\"><span>Cena</span><input name=\"unitPrice\" inputmode=\"decimal\" value=\"" + escapeHtml(item.unitPrice) + "\" data-fit-input /></label><label class=\"pos-field\"><span>DDV</span><select name=\"taxRate\"><option value=\"19\">19 %</option><option value=\"7\">7 %</option><option value=\"0\">0 %</option></select></label></div><div class=\"pos-item__sum\"><span>Znesek postavke</span><strong data-item-total>" + escapeHtml(formatMoney(calc.grossCents)) + "</strong></div></article>";
  }

  function renderItems() {
    var root = query("[data-items]");
    root.innerHTML = (state.draft.items || []).map(itemTemplate).join("");
    queryAll("[data-item-id]", root).forEach(function (row, index) {
      var item = state.draft.items[index];
      query("[name=category]", row).value = item.category;
      query("[name=taxRate]", row).value = item.taxRate;
      query("[data-remove-item]", row).addEventListener("click", function () {
        if (state.draft.items.length === 1) { showToast("Račun mora imeti najmanj eno postavko."); return; }
        state.draft.items = state.draft.items.filter(function (entry) { return entry.id !== item.id; });
        renderItems();
        persist();
      });
      queryAll("input,select", row).forEach(function (field) {
        field.addEventListener("input", function () {
          state.draft.items = readItems();
          var fresh = state.draft.items.filter(function (entry) { return entry.id === item.id; })[0];
          query("[data-item-total]", row).textContent = formatMoney(calculateItem(fresh, state.draft.priceMode, state.draft.taxMode).grossCents);
          fitInput(field);
        });
      });
    });
    applyTaxRateAvailability();
    fitAllText();
  }

  function applyTaxRateAvailability() {
    var taxable = state.draft.taxMode === "regular";
    queryAll("[data-item-id] [name=taxRate]").forEach(function (select) { select.disabled = !taxable; if (!taxable) select.value = "0"; });
  }

  function addItem() {
    syncDraftFromForm();
    state.draft.items.push(defaultItem());
    renderItems();
    persist();
  }

  function syncCustomerFields() {
    syncDraftFromForm();
    var business = state.draft.customerType === "business" || state.draft.customerType === "public";
    query("[data-business-fields]").hidden = !business;
    query("[data-public-fields]").hidden = state.draft.customerType !== "public";
    query("[data-structured-buyer-reference]").hidden = !business;
    query("[data-customer-name-label]").textContent = state.draft.customerType === "private" ? "Ime in priimek *" : "Naziv organizacije *";
  }

  function syncTaxFields() {
    syncDraftFromForm();
    var small = state.profile.taxStatus === "small_business";
    queryAll("[name=taxMode]").forEach(function (radio) {
      if (small) radio.disabled = radio.value !== "small_business";
      else radio.disabled = radio.value === "small_business";
    });
    if (small) {
      state.draft.taxMode = "small_business";
      query("[name=taxMode][value=small_business]").checked = true;
    } else if (state.draft.taxMode === "small_business") {
      state.draft.taxMode = "regular";
      query("[name=taxMode][value=regular]").checked = true;
    }
    query("[data-reverse-charge]").hidden = state.draft.taxMode !== "reverse_charge";
    query("[data-bauabzug]").hidden = !state.draft.constructionWithholding;
    applyTaxRateAvailability();
  }

  function markInvalid(step, errors) {
    queryAll(".is-invalid").forEach(function (field) { field.classList.remove("is-invalid"); });
    if (!errors.length) return;
    var panel = query("[data-step-panel=\"" + step + "\"]");
    if (!panel) return;
    var firstEmpty = query("input:invalid, input[name=customerName], textarea[name=workDescription]", panel);
    if (firstEmpty) firstEmpty.classList.add("is-invalid");
  }

  function setStep(step, validateCurrent) {
    syncDraftFromForm();
    if (validateCurrent) {
      var errors = validateStep(state.draft, state.profile, currentStep);
      if (errors.length) {
        markInvalid(currentStep, errors);
        showToast(errors[0]);
        return false;
      }
    }
    currentStep = clamp(integer(step, 1), 1, 4);
    queryAll("[data-step-panel]").forEach(function (panel) { panel.classList.toggle("is-active", integer(panel.getAttribute("data-step-panel"), 0) === currentStep); });
    queryAll("[data-steps] li").forEach(function (li, index) {
      li.classList.toggle("is-active", index + 1 === currentStep);
      li.classList.toggle("is-complete", index + 1 < currentStep);
    });
    query("[data-editor-back]").textContent = currentStep === 1 ? "Zapri" : "Prejšnji korak";
    query("[data-editor-next]").hidden = currentStep === 4;
    query("[data-issue-invoice]").hidden = currentStep !== 4;
    if (currentStep === 4) renderPreview();
    persist();
    global.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }

  function nextStep() { setStep(currentStep + 1, true); }
  function previousStep() { if (currentStep === 1) closeEditor(); else setStep(currentStep - 1, false); }

  function nextInvoiceNumber(isTest) {
    var next = state.sequence + 1;
    var year = new Date().getFullYear();
    var prefix = isTest ? "TEST-" + year + "-" : (state.profile.invoicePrefix || "RE-" + year + "-");
    return prefix + String(next).padStart(4, "0");
  }

  function currentInvoiceSnapshot(number) {
    syncDraftFromForm();
    var live = profileReadiness(state.profile).live && backend.ready;
    return {
      id: uid("invoice"),
      number: number || nextInvoiceNumber(!live),
      dueDate: addDays(state.draft.issueDate, state.draft.dueDays),
      totals: calculateTotals(state.draft),
      draft: JSON.parse(JSON.stringify(state.draft)),
      isTest: !live,
      status: "open",
      createdAt: new Date().toISOString()
    };
  }

  function renderPreview() {
    syncDraftFromForm();
    var invoice = currentInvoiceSnapshot();
    var draft = invoice.draft;
    var profile = state.profile;
    var errors = validateStep(draft, profile, 4);
    var validation = query("[data-validation-summary]");
    validation.innerHTML = errors.length
      ? "<div class=\"pos-validation__errors\"><strong>Pred izdajo popravite:</strong><ul>" + errors.map(function (error) { return "<li>" + escapeHtml(error) + "</li>"; }).join("") + "</ul></div>"
      : "<div class=\"pos-validation__ok\"><strong>Osnovni zakonski podatki so izpolnjeni.</strong> Pred produkcijsko e-izdajo mora XML prestati še KoSIT validacijo.</div>";
    var items = draft.items.map(function (item) {
      var calc = calculateItem(item, draft.priceMode, draft.taxMode);
      return "<tr><td>" + escapeHtml(item.description || "—") + "</td><td>" + escapeHtml(formatDecimalMilli(calc.quantityMilli)) + "</td><td>" + escapeHtml(formatMoney(calc.grossCents)) + "</td></tr>";
    }).join("");
    var noteParts = [taxNote(draft), defaultNotice(draft)];
    var replacement = normalizeReplacementContext(draft);
    if (replacement) noteParts.unshift("Nadomestni račun za " + replacement.cancellationNumber + "; prvotni račun " + replacement.originalInvoiceNumber + ".");
    if (draft.handwerker35a) noteParts.push("Davčno upravičeni stroški dela, vožnje in strojev: " + formatMoney(invoice.totals.eligible35aCents) + ". Končno upravičenost preveri Finanzamt.");
    if (draft.constructionWithholding) noteParts.push("Bauleistung: stanje Freistellungsbescheinigung – " + draft.exemptionCertificate + ".");
    var preview = query("[data-invoice-preview]");
    preview.classList.toggle("is-test", invoice.isTest);
    preview.innerHTML = "<div class=\"pos-preview__head\"><div class=\"pos-preview__seller\"><strong data-fit-text>" + escapeHtml(profile.legalName || "Vaše podjetje") + "</strong><small data-fit-text>" + escapeHtml([profile.street, profile.postalCode, profile.city].filter(Boolean).join(", ") || "Podatki podjetja še niso popolni") + "</small></div><span class=\"pos-preview__badge\">" + (invoice.isTest ? "TESTRECHNUNG" : "RECHNUNG") + "</span></div><h4 class=\"pos-preview__title\">Rechnung</h4><div class=\"pos-preview__number\">" + escapeHtml(invoice.number) + "</div><div class=\"pos-preview__meta\"><div><small>Ausstellungsdatum</small><strong>" + escapeHtml(formatDate(draft.issueDate)) + "</strong></div><div><small>Leistungsdatum</small><strong>" + escapeHtml(formatDate(draft.serviceDate)) + "</strong></div><div><small>Fällig am</small><strong>" + escapeHtml(formatDate(invoice.dueDate)) + "</strong></div><div><small>Zahlungsart</small><strong>" + escapeHtml(draft.paymentMethod === "sepa" ? "Überweisung" : draft.paymentMethod === "already_paid" ? "Bereits bezahlt" : "Externe Karte") + "</strong></div></div><div class=\"pos-preview__customer\"><small>Rechnung an</small><strong data-fit-text>" + escapeHtml(draft.customerName || "—") + "</strong><span data-fit-text>" + escapeHtml([draft.customerStreet, draft.customerPostalCode, draft.customerCity].filter(Boolean).join(", ") || "—") + "</span></div><table class=\"pos-preview__table\"><thead><tr><th>Leistung</th><th>Menge</th><th>Betrag</th></tr></thead><tbody>" + items + "</tbody></table><div class=\"pos-preview__totals\"><div class=\"pos-preview__total-row\"><span>Netto</span><span>" + escapeHtml(formatMoney(invoice.totals.netCents)) + "</span></div><div class=\"pos-preview__total-row\"><span>Umsatzsteuer</span><span>" + escapeHtml(formatMoney(invoice.totals.taxCents)) + "</span></div><div class=\"pos-preview__total-row pos-preview__total-row--final\"><span>Gesamtbetrag</span><span>" + escapeHtml(formatMoney(invoice.totals.grossCents)) + "</span></div></div><p class=\"pos-preview__note\">" + escapeHtml(noteParts.filter(Boolean).join(" ") || "Bitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer.") + "</p>";
    query("[data-issue-invoice]").textContent = invoice.isTest ? "Ustvari testni račun" : "Pravno izdaj račun";
    query("[data-issue-invoice]").disabled = errors.length > 0;
    renderQr(invoice);
    fitAllText();
  }

  function renderQr(invoice) {
    var old = query(".pos-preview__qr", query("[data-invoice-preview]"));
    if (old) old.remove();
    if (!state.profile.iban || !invoice.totals.grossCents) return;
    var canvas = document.createElement("canvas");
    canvas.className = "pos-preview__qr";
    canvas.width = 82;
    canvas.height = 82;
    canvas.setAttribute("aria-label", "EPC QR za plačilo");
    query("[data-invoice-preview]").appendChild(canvas);
    if (global.QRCode && typeof global.QRCode.toCanvas === "function") {
      global.QRCode.toCanvas(canvas, buildEpcPayload(invoice, state.profile), { width: 82, margin: 1, errorCorrectionLevel: "M" }, function () {});
    } else {
      canvas.remove();
    }
  }

  async function issueOnServer() {
    if (!backend.ready || !backend.client || !backend.userId) throw new Error("Varna strežniška izdaja ni na voljo.");
    await saveProfileToServer();
    var draftId = await saveDraftToServer();
    var replacement = normalizeReplacementContext(state.draft);
    var rpcName = replacement ? "pos_issue_replacement_invoice" : "pos_issue_invoice";
    var rpcPayload = {
      p_draft_id: draftId,
      p_payload: draftToDatabasePayload(state.draft),
      p_final_confirmed: Boolean(state.draft.finalConfirmed),
      p_einvoice_validated: false
    };
    if (replacement) rpcPayload.p_cancellation_adjustment_id = replacement.cancellationAdjustmentId;
    var result = await backend.client.rpc(rpcName, rpcPayload);
    if (result.error) throw result.error;
    var row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row || !row.id) throw new Error("Strežnik ni vrnil izdanega računa.");
    var invoice = serverInvoiceToLocal(row, {}, {});
    try { await ensureInvoiceDocument(invoice); }
    catch (error) { invoice.documentError = error && error.message || "PDF še ni pripravljen."; }
    return invoice;
  }

  function issueInvoice() {
    syncDraftFromForm();
    var errors = validateStep(state.draft, state.profile, 4);
    if (errors.length) { renderPreview(); showToast(errors[0]); return; }
    var readiness = profileReadiness(state.profile);
    var live = readiness.live && backend.ready;
    var replacement = normalizeReplacementContext(state.draft);
    if (replacement && !backend.ready) { showToast("Nadomestni račun potrebuje varno strežniško povezavo."); return; }
    var invoice = currentInvoiceSnapshot(nextInvoiceNumber(!live));
    openDialog(
      replacement ? "Izdati nadomestni račun?" : live ? "Pravno izdati račun?" : "Ustvariti testni račun?",
      replacement
        ? "Nastala bo nova številka računa, povezana s " + replacement.cancellationNumber + " in " + replacement.originalInvoiceNumber + ". Vsi podatki bodo ponovno zaklenjeni."
        : live ? "Po izdaji vsebine ne bo mogoče spreminjati. Morebitni popravek bo nov dokument." : "Dokument bo jasno označen kot TESTRECHNUNG in ni primeren za pravo poslovno uporabo.",
      {
        confirmText: replacement ? "Izdaj nadomestni račun" : live ? "Izdaj račun" : "Ustvari test",
        onConfirm: async function () {
          try {
            if (backend.ready) invoice = await issueOnServer();
            else {
              if (readiness.live) throw new Error("Pravnega računa brez varne strežniške izdaje ni mogoče ustvariti.");
              state.sequence += 1;
            }
            state.draft = null;
            persist();
            if (invoice.serverStored) {
              await loadServerState();
              openInvoiceDetail(invoice.id);
            } else {
              state.invoices.unshift(invoice);
              persist();
              showView("home");
            }
            showToast(replacement
              ? (invoice.documentReady ? "Nadomestni račun in PDF sta varno izdana." : "Nadomestni račun je izdan; PDF se pripravi v podrobnostih.")
              : live ? (invoice.documentReady ? "Račun in PDF original sta varno izdana." : "Račun je izdan; PDF se bo pripravil v podrobnostih.") : backend.ready ? "Testni račun in PDF sta varno shranjena." : "Lokalni testni račun je ustvarjen.");
          } catch (error) {
            backendMessage(databaseErrorMessage(error), "error");
            showToast(error && error.message || "Izdaja ni uspela.");
          }
        }
      }
    );
  }

  function downloadFile(filename, content, type) {
    var blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadXml() {
    showToast("Točen XRechnung nastane iz zaklenjenih podatkov po izdaji in se nato preveri s KoSIT.");
  }

  function copyPayment() {
    var invoice = currentInvoiceSnapshot();
    copyPaymentForInvoice(invoice);
  }

  function copyPaymentForInvoice(invoice) {
    var text = buildPaymentText(invoice, invoice.seller || state.profile);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { showToast("Plačilni podatki so kopirani."); });
    else openDialog("Plačilni podatki", text, { cancel: false });
  }

  function requestPayment(id) {
    var invoice = state.invoices.filter(function (entry) { return entry.id === id; })[0];
    if (!invoice) return;
    if (invoice.status === "cancelled") { showToast("Storniranega računa ni mogoče označiti kot plačanega."); return; }
    if (invoice.status === "paid") { showToast("Ta račun je že označen kot plačan."); return; }
    openDialog("Označiti kot plačano?", invoice.number + " · " + formatMoney(invoice.totals.grossCents) + ". Ročna potrditev mora temeljiti na dejansko vidnem plačilu.", {
      confirmText: "Potrdi plačilo",
      onConfirm: async function () {
        try {
          var paidAt = new Date().toISOString();
          if (invoice.serverStored) {
            if (!backend.ready || !backend.userId) throw new Error("Varna hramba plačil ni povezana.");
            var result = await backend.client.from("pos_payments").insert({
              user_id: backend.userId, invoice_id: invoice.id, amount_cents: invoice.totals.grossCents,
              currency: "EUR", method: "manual", provider_reference: "Ročno potrjeno v POS", paid_at: paidAt
            }).select("id").single();
            if (result.error) throw result.error;
          }
          invoice.status = "paid";
          invoice.paidAt = paidAt;
          persist();
          if (currentView === "invoice-detail") renderInvoiceDetail(invoice.id); else renderHome();
          showToast("Plačilo je zabeleženo ločeno od računa.");
        } catch (error) { showToast(error && error.message || "Plačila ni bilo mogoče shraniti."); }
      }
    });
  }

  function requestLatestPayment() {
    var invoice = state.invoices.filter(function (entry) { return entry.status === "open"; })[0];
    if (!invoice) { showToast("Ni odprtega računa za plačilo."); return; }
    requestPayment(invoice.id);
  }

  function importBankFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || "");
      var isCamt = /<BkToCstmrStmt|<camt\.053/i.test(text);
      var isCsv = /[;,].+\r?\n/.test(text);
      if (!isCamt && !isCsv) { showToast("Datoteka ni prepoznana kot camt.053 ali CSV."); return; }
      var count = isCamt ? (text.match(/<Ntry>/g) || []).length : Math.max(0, text.trim().split(/\r?\n/).length - 1);
      openDialog("Bančna datoteka prebrana", "Prepoznan format: " + (isCamt ? "camt.053" : "CSV") + ". Najdenih zapisov: " + count + ". V testnem načinu uvoz ne spreminja statusa računov brez vaše potrditve.", { cancel: false });
    };
    reader.readAsText(file);
  }

  function exportDatev() {
    if (!state.invoices.length) { showToast("Za izvoz še ni računov."); return; }
    var rows = ["Rechnungsnummer;Datum;Kunde;Netto;Steuer;Brutto;Status"];
    state.invoices.forEach(function (invoice) {
      rows.push([invoice.number, invoice.draft.issueDate, invoice.draft.customerName.replace(/;/g, ","), (invoice.totals.netCents / 100).toFixed(2), (invoice.totals.taxCents / 100).toFixed(2), (invoice.totals.grossCents / 100).toFixed(2), invoice.status].join(";"));
      (invoice.adjustments || []).forEach(function (adjustment) {
        rows.push([adjustment.number, String(adjustment.createdAt || "").slice(0, 10), invoice.draft.customerName.replace(/;/g, ","), (adjustment.deltaNetCents / 100).toFixed(2), (adjustment.deltaTaxCents / 100).toFixed(2), (adjustment.deltaGrossCents / 100).toFixed(2), adjustment.type === "cancellation" ? "Storno" : "Korrektur"].join(";"));
      });
    });
    downloadFile("DATEV-VORPRUEFUNG-TEST.csv", "\ufeff" + rows.join("\r\n"), "text/csv;charset=utf-8");
    showToast("Testni računovodski CSV je prenesen; to še ni potrjen DATEV Buchungsstapel.");
  }

  function fitInput(field) {
    if (!field || !field.value || field.offsetWidth <= 0) return;
    var style = global.getComputedStyle(field);
    var max = 16;
    var min = 11;
    var available = field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 4;
    var canvas = fitInput.canvas || (fitInput.canvas = document.createElement("canvas"));
    var context = canvas.getContext("2d");
    var size = max;
    while (size > min) {
      context.font = style.fontWeight + " " + size + "px " + style.fontFamily;
      if (context.measureText(field.value).width <= available) break;
      size -= .5;
    }
    field.style.setProperty("font-size", size + "px", "important");
  }

  function fitText(element) {
    if (!element || element.offsetWidth <= 0) return;
    var preferred = Number.parseFloat(element.getAttribute("data-fit-max"));
    var size = Number.isFinite(preferred) ? preferred : 16;
    var min = Math.min(9, Math.max(7, size - 3));
    element.style.setProperty("font-size", size + "px", "important");
    while (size > min && (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight + 1)) {
      size -= .5;
      element.style.setProperty("font-size", size + "px", "important");
    }
  }

  function fitAllText() {
    queryAll("[data-fit-input]").forEach(fitInput);
    queryAll("[data-fit-text]").forEach(fitText);
  }

  function bindEvents() {
    queryAll("[data-open-view]").forEach(function (button) { button.addEventListener("click", function () { showView(button.getAttribute("data-open-view")); }); });
    queryAll("[data-new-invoice]").forEach(function (button) { button.addEventListener("click", startInvoice); });
    query("[data-close-editor]").addEventListener("click", closeEditor);
    query("[data-save-draft]").addEventListener("click", async function () {
      syncDraftFromForm(); persist();
      if (!backend.ready) { showToast("Osnutek je lokalno shranjen; varna hramba ni povezana."); return; }
      try { await saveDraftToServer(); showToast("Osnutek je varno shranjen in sinhroniziran."); }
      catch (error) { showToast(error && error.message || "Osnutek je ostal shranjen samo lokalno."); }
    });
    query("[data-editor-next]").addEventListener("click", nextStep);
    query("[data-editor-back]").addEventListener("click", previousStep);
    query("[data-issue-invoice]").addEventListener("click", issueInvoice);
    queryAll("[data-step]").forEach(function (button) { button.addEventListener("click", function () { var target = integer(button.getAttribute("data-step"), 1); if (target <= currentStep) setStep(target, false); else setStep(target, true); }); });
    query("[data-add-item]").addEventListener("click", addItem);
    queryAll("[name=customerType]").forEach(function (radio) { radio.addEventListener("change", syncCustomerFields); });
    queryAll("[name=taxMode]").forEach(function (radio) { radio.addEventListener("change", function () { state.draft.taxMode = radio.value; syncTaxFields(); renderItems(); }); });
    query("[name=constructionWithholding]").addEventListener("change", syncTaxFields);
    queryAll("[name=priceMode]").forEach(function (radio) { radio.addEventListener("change", function () { syncDraftFromForm(); renderItems(); }); });
    query("#pos-invoice-form").addEventListener("input", function (event) { if (event.target.matches("[data-fit-input]")) fitInput(event.target); });
    query("#pos-profile-form").addEventListener("input", function (event) { if (event.target.matches("[data-fit-input]")) fitInput(event.target); });
    query("#pos-profile-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      state.profile = readForm(event.currentTarget, state.profile);
      state.profile.iban = cleanIban(state.profile.iban);
      var readiness = profileReadiness(state.profile);
      persist();
      if (backend.client) {
        try {
          if (!backend.userId) await getBackendUser();
          await saveProfileToServer();
        } catch (error) {
          backend.ready = false;
          backendMessage(databaseErrorMessage(error), "error");
        }
      }
      renderHome();
      showToast(readiness.live && backend.ready ? "Produkcijski način je pripravljen." : readiness.live ? "Podatki so lokalno shranjeni; produkcija čaka varno bazo." : "Nastavitve so shranjene; Testbetrieb ostaja aktiven.");
      showView("home");
    });
    query("[data-preview-print]").addEventListener("click", function () { global.print(); });
    query("[data-download-xml]").addEventListener("click", downloadXml);
    query("[data-copy-payment]").addEventListener("click", copyPayment);
    query("[data-open-payment]").addEventListener("click", requestLatestPayment);
    query("[data-import-bank]").addEventListener("click", function () { query("[data-bank-file]").click(); });
    query("[data-bank-file]").addEventListener("change", function (event) { importBankFile(event.target.files[0]); event.target.value = ""; });
    query("[data-datev-export]").addEventListener("click", exportDatev);
    query("[data-show-all]").addEventListener("click", function () { showToast(state.invoices.length ? "Prikazanih je zadnjih " + Math.min(5, state.invoices.length) + " računov." : "Računov še ni."); });
    query("[data-detail-back]").addEventListener("click", function () { activeInvoiceId = null; showView("home"); });
    query("[data-detail-download]").addEventListener("click", async function () {
      var invoice = findInvoice(activeInvoiceId);
      if (!invoice) return;
      try { await downloadInvoicePdf(invoice); showToast("Arhivirani PDF je prenesen."); }
      catch (error) { setDocumentState(invoice, "error", error.message || "PDF ni na voljo."); showToast(error.message || "PDF ni na voljo."); }
    });
    query("[data-detail-einvoice-action]").addEventListener("click", async function () {
      var invoice = findInvoice(activeInvoiceId);
      if (!invoice) return;
      try {
        setEinvoiceState(invoice, "loading", "Preverjam arhivirani XRechnung …");
        await downloadInvoiceEinvoice(invoice);
        renderInvoiceDetail(invoice.id);
        showToast("Arhivirani XRechnung XML je prenesen.");
      } catch (error) {
        setEinvoiceState(invoice, "error", error.message || "XRechnung ni na voljo.");
        showToast(error.message || "XRechnung ni na voljo.");
      }
    });
    query("[data-detail-send]").addEventListener("click", function () {
      var invoice = findInvoice(activeInvoiceId);
      if (invoice) openDeliverySheet(invoice);
    });
    query("[data-detail-copy]").addEventListener("click", function () { var invoice = findInvoice(activeInvoiceId); if (invoice) copyPaymentForInvoice(invoice); });
    query("[data-detail-payment]").addEventListener("click", function () { var invoice = findInvoice(activeInvoiceId); if (invoice) requestPayment(invoice.id); });
    query("[data-detail-correction]").addEventListener("click", function () {
      var invoice = findInvoice(activeInvoiceId);
      if (invoice) openAdjustmentSheet(invoice);
    });
    query("[data-detail-replacement]").addEventListener("click", function () {
      var invoice = findInvoice(activeInvoiceId);
      if (invoice) startReplacementInvoice(invoice);
    });
    queryAll("[name=adjustmentType]").forEach(function (radio) { radio.addEventListener("change", syncAdjustmentMode); });
    query("#pos-adjustment-form").addEventListener("submit", submitAdjustment);
    query("#pos-adjustment-form").addEventListener("input", function (event) { if (event.target.matches("[data-fit-input]")) fitInput(event.target); });
    query("[data-adjustment-close]").addEventListener("click", closeAdjustmentSheet);
    query("[data-adjustment-cancel]").addEventListener("click", closeAdjustmentSheet);
    query("[data-adjustment-backdrop]").addEventListener("click", function (event) { if (event.target === event.currentTarget) closeAdjustmentSheet(); });
    query("#pos-delivery-form").addEventListener("submit", submitDelivery);
    query("#pos-delivery-form").addEventListener("input", function (event) { if (event.target.matches("[data-fit-input]")) fitInput(event.target); });
    query("[name=deliveryFormat]").addEventListener("change", syncDeliveryMode);
    query("[name=deliveryChannel]").addEventListener("change", syncDeliveryMode);
    query("[data-delivery-close]").addEventListener("click", closeDeliverySheet);
    query("[data-delivery-cancel]").addEventListener("click", closeDeliverySheet);
    query("[data-delivery-backdrop]").addEventListener("click", function (event) { if (event.target === event.currentTarget) closeDeliverySheet(); });
    query("[data-dialog-confirm]").addEventListener("click", function () { closeDialog(true); });
    query("[data-dialog-cancel]").addEventListener("click", function () { closeDialog(false); });
    query("[data-dialog-backdrop]").addEventListener("click", function (event) { if (event.target === event.currentTarget) closeDialog(false); });
    global.addEventListener("resize", fitAllText);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAllText);
    if (global.ResizeObserver) {
      var observer = new ResizeObserver(function () { fitAllText(); });
      observer.observe(document.body);
    }
  }

  global.UJPoskusiNotranjiKorakNazaj = function () {
    if (!query("[data-delivery-backdrop]").hidden) { closeDeliverySheet(); return true; }
    if (!query("[data-adjustment-backdrop]").hidden) { closeAdjustmentSheet(); return true; }
    if (currentView === "invoice") { previousStep(); return true; }
    if (currentView === "settings") { showView("home"); return true; }
    if (currentView === "invoice-detail") { activeInvoiceId = null; showView("home"); return true; }
    return false;
  };

  function init() {
    bindEvents();
    renderHome();
    showView("home");
    loadServerState();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(typeof window !== "undefined" ? window : globalThis);
