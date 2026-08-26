"use strict";

const GENERATOR_VERSION = "uj-pos-xrechnung-3";
const XRECHNUNG_VERSION = "3.0.2";
const KOSIT_VALIDATOR_VERSION = "1.6.2";
const KOSIT_CONFIG_VERSION = "2026-01-31";
const CUSTOMIZATION_ID = "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0";
const PROFILE_ID = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";
const SUPPORTED_LEGAL_FORMS = ["Einzelunternehmen", "e.K.", "GbR", "eGbR", "OHG", "KG", "GmbH & Co. KG", "UG (haftungsbeschränkt)", "GmbH", "AG", "eG"];
const REGISTERED_LEGAL_FORMS = ["e.K.", "eGbR", "OHG", "KG", "GmbH & Co. KG", "UG (haftungsbeschränkt)", "GmbH", "AG", "eG"];
const TEST_SELLER = Object.freeze({
  legalName: "TEST-Unternehmen GmbH", legalForm: "GmbH", representative: "Max Mustermann",
  companySeat: "Berlin", registerCourt: "Amtsgericht Charlottenburg", registerNumber: "HRB TEST 00000 B",
  street: "Musterstraße 1", postalCode: "10115", city: "Berlin", businessEmail: "testrechnung@beispiel.de",
  taxNumber: "00/000/00000", vatId: "", accountHolder: "TEST-Unternehmen GmbH",
  iban: "DE23999999990000000000", businessPhone: "+49 30 00000000"
});

function text(value) { return String(value == null ? "" : value).trim(); }
function integer(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : 0;
}
function escapeXml(value) {
  return text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function money(cents) { return (integer(cents) / 100).toFixed(2); }
function quantity(milli) {
  return (integer(milli) / 1000).toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}
function percentage(bps) {
  return (integer(bps) / 100).toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}
function unitCode(unit) {
  const units = { "Std.": "HUR", "h": "HUR", "m²": "MTK", "m2": "MTK", "Stk.": "C62", "Stk": "C62" };
  return units[text(unit)] || "C62";
}
function cleanIban(value) { return text(value).replace(/\s+/g, "").toUpperCase(); }
function testSellerIdentity(seller) { return Object.assign({}, seller || {}, TEST_SELLER); }
function assertRequired(value, message) { if (!text(value)) throw new Error(message); }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(text(value)); }
function taxDetails(taxMode, rateBps) {
  if (taxMode === "small_business") return {
    id: "E", rateBps: 0, exemptionReason: "Steuerbefreiung für Kleinunternehmer gemäß § 19 UStG.", exemptionCode: ""
  };
  if (taxMode === "reverse_charge") return {
    id: "AE", rateBps: 0, exemptionReason: "Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.", exemptionCode: "VATEX-EU-AE"
  };
  return { id: integer(rateBps) === 0 ? "Z" : "S", rateBps: integer(rateBps), exemptionReason: "", exemptionCode: "" };
}

function normalizeInvoice(invoice) {
  const snapshot = invoice && invoice.snapshot && typeof invoice.snapshot === "object" ? invoice.snapshot : {};
  const storedSeller = snapshot.seller && typeof snapshot.seller === "object" ? snapshot.seller : {};
  const isTest = Boolean(invoice && invoice.is_test);
  const seller = isTest ? testSellerIdentity(storedSeller) : storedSeller;
  const draft = snapshot.draft && typeof snapshot.draft === "object" ? snapshot.draft : {};
  const items = Array.isArray(draft.items) ? draft.items : [];
  const workflow = draft.workflow_context && typeof draft.workflow_context === "object" ? draft.workflow_context : {};
  const deductions = (Array.isArray(workflow.final_deductions) ? workflow.final_deductions : []).map((entry) => ({
    invoiceId: text(entry && entry.invoice_id), invoiceNumber: text(entry && entry.invoice_number), issueDate: text(entry && entry.issue_date),
    netCents: integer(entry && entry.net_cents), taxCents: integer(entry && entry.tax_cents), grossCents: integer(entry && entry.gross_cents)
  }));
  const serviceNetCents = items.reduce((sum, item) => sum + integer(item && item.net_cents), 0);
  const serviceTaxCents = items.reduce((sum, item) => sum + integer(item && item.tax_cents), 0);
  const serviceGrossCents = items.reduce((sum, item) => sum + integer(item && item.gross_cents), 0);
  const deductionNetCents = deductions.reduce((sum, entry) => sum + entry.netCents, 0);
  const deductionTaxCents = deductions.reduce((sum, entry) => sum + entry.taxCents, 0);
  const deductionGrossCents = deductions.reduce((sum, entry) => sum + entry.grossCents, 0);
  const normalized = {
    id: text(invoice && invoice.id), number: text(invoice && invoice.invoice_number),
    issueDate: text(invoice && invoice.issue_date || draft.issue_date),
    serviceDate: text(invoice && invoice.service_date || draft.service_date),
    dueDate: text(invoice && invoice.due_date || draft.due_date),
    customerType: text(invoice && invoice.customer_type || draft.customer_type),
    taxMode: text(invoice && invoice.tax_mode || draft.tax_mode),
    netCents: integer(invoice && invoice.net_cents), taxCents: integer(invoice && invoice.tax_cents),
    grossCents: integer(invoice && invoice.gross_cents), isTest, seller, draft, items, deductions,
    serviceNetCents, serviceTaxCents, serviceGrossCents, deductionNetCents, deductionTaxCents, deductionGrossCents
  };
  normalized.sellerPhone = text(isTest ? TEST_SELLER.businessPhone : draft.seller_contact_phone || seller.businessPhone);
  validateInvoice(normalized);
  return normalized;
}

function addUtcDays(dateText, days) {
  if (!validDate(dateText)) return "";
  const date = new Date(dateText + "T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + integer(days));
  return date.toISOString().slice(0, 10);
}

function preflightInvoice(profile, payload, draftId) {
  const draft = payload && typeof payload === "object" ? JSON.parse(JSON.stringify(payload)) : {};
  const taxMode = text(draft.tax_mode);
  const priceMode = text(draft.price_mode);
  const items = (Array.isArray(draft.items) ? draft.items : []).map((item) => {
    const quantityMilli = integer(item && item.quantity_milli);
    const unitPriceCents = integer(item && item.unit_price_cents);
    const rateBps = taxMode === "regular" ? integer(item && item.tax_rate_bps) : 0;
    const enteredCents = Math.round(unitPriceCents * quantityMilli / 1000);
    const grossPrice = priceMode === "gross" && rateBps > 0;
    const netCents = grossPrice ? Math.round(enteredCents * 10000 / (10000 + rateBps)) : enteredCents;
    const taxCents = grossPrice ? enteredCents - netCents : Math.round(netCents * rateBps / 10000);
    return Object.assign({}, item, {
      quantity_milli: quantityMilli, unit_price_cents: unitPriceCents, tax_rate_bps: rateBps,
      net_cents: netCents, tax_cents: taxCents, gross_cents: netCents + taxCents
    });
  });
  const workflow = draft.workflow_context && typeof draft.workflow_context === "object" ? draft.workflow_context : {};
  const deductions = Array.isArray(workflow.final_deductions) ? workflow.final_deductions : [];
  const serviceNet = items.reduce((sum, item) => sum + integer(item.net_cents), 0);
  const serviceTax = items.reduce((sum, item) => sum + integer(item.tax_cents), 0);
  const serviceGross = items.reduce((sum, item) => sum + integer(item.gross_cents), 0);
  const deductionNet = deductions.reduce((sum, item) => sum + integer(item && item.net_cents), 0);
  const deductionTax = deductions.reduce((sum, item) => sum + integer(item && item.tax_cents), 0);
  const deductionGross = deductions.reduce((sum, item) => sum + integer(item && item.gross_cents), 0);
  draft.items = items;
  draft.seller_contact_phone = text(profile && profile.business_phone);
  const seller = {
    legalName: text(profile && profile.legal_name), legalForm: text(profile && profile.legal_form),
    representative: text(profile && profile.representative), companySeat: text(profile && profile.company_seat),
    registerCourt: text(profile && profile.register_court), registerNumber: text(profile && profile.register_number),
    street: text(profile && profile.street), postalCode: text(profile && profile.postal_code), city: text(profile && profile.city),
    businessEmail: text(profile && profile.business_email), businessPhone: text(profile && profile.business_phone),
    taxStatus: text(profile && profile.tax_status), taxNumber: text(profile && profile.tax_number), vatId: text(profile && profile.vat_id),
    accountHolder: text(profile && profile.account_holder), iban: text(profile && profile.iban)
  };
  return {
    id: text(draftId), invoice_number: "PREFLIGHT-" + text(draftId).slice(0, 12).toUpperCase(),
    issue_date: text(draft.issue_date), service_date: text(draft.service_date),
    due_date: addUtcDays(text(draft.issue_date), integer(draft.due_days)),
    customer_type: text(draft.customer_type), tax_mode: taxMode,
    net_cents: serviceNet - deductionNet, tax_cents: serviceTax - deductionTax,
    gross_cents: serviceGross - deductionGross, is_test: false,
    snapshot: { schema_version: 1, seller, draft, totals: {
      netCents: serviceNet - deductionNet, taxCents: serviceTax - deductionTax, grossCents: serviceGross - deductionGross
    } }
  };
}

function validateInvoice(invoice) {
  assertRequired(invoice.number, "Račun nima številke.");
  if (!validDate(invoice.issueDate) || !validDate(invoice.serviceDate) || !validDate(invoice.dueDate)) throw new Error("Datumi računa niso veljavni.");
  if (!['business', 'public'].includes(invoice.customerType)) throw new Error("XRechnung je namenjen podjetju ali javnemu naročniku.");
  if (!['regular', 'small_business', 'reverse_charge'].includes(invoice.taxMode)) throw new Error("Davčna obravnava za XRechnung ni veljavna.");
  const seller = invoice.seller;
  [seller.legalName, seller.street, seller.postalCode, seller.city, seller.businessEmail].forEach((value, index) => {
    if (!text(value)) throw new Error(["Manjka naziv izdajatelja.", "Manjka ulica izdajatelja.", "Manjka PLZ izdajatelja.", "Manjka kraj izdajatelja.", "Za XRechnung manjka poslovna e-pošta izdajatelja."][index]);
  });
  if (!text(seller.vatId) && !text(seller.taxNumber)) throw new Error("Za XRechnung manjka davčna številka izdajatelja.");
  if (!SUPPORTED_LEGAL_FORMS.includes(text(seller.legalForm)) || !text(seller.representative)) {
    throw new Error("Za XRechnung manjkajo pravna oblika in obvezni zastopniki izdajatelja.");
  }
  if (REGISTERED_LEGAL_FORMS.includes(text(seller.legalForm))
    && ![seller.companySeat, seller.registerCourt, seller.registerNumber].every((value) => text(value))) {
    throw new Error("Za registrirano pravno obliko manjkajo sedež, registrsko sodišče ali registrska številka.");
  }
  if (!/^\D*(?:\d\D*){3,}$/.test(invoice.sellerPhone)) throw new Error("Za XRechnung manjka veljavna telefonska številka izdajatelja.");
  if (!cleanIban(seller.iban) || !text(seller.accountHolder)) throw new Error("Za XRechnung manjkajo podatki za nakazilo.");
  const draft = invoice.draft;
  [draft.customer_name, draft.customer_street, draft.customer_postal_code, draft.customer_city].forEach((value, index) => {
    if (!text(value)) throw new Error(["Manjka naziv prejemnika.", "Manjka ulica prejemnika.", "Manjka PLZ prejemnika.", "Manjka kraj prejemnika."][index]);
  });
  assertRequired(draft.buyer_reference || draft.leitweg_id, "Za XRechnung manjka Buyer reference.");
  if (invoice.customerType === "public") assertRequired(draft.leitweg_id, "Za javnega naročnika manjka Leitweg-ID.");
  else assertRequired(draft.customer_email, "Za poslovnega prejemnika manjka e-poštni naslov.");
  if (invoice.taxMode === "reverse_charge") assertRequired(draft.customer_vat_id, "Za reverse charge XRechnung manjka VAT ID prejemnika.");
  if (!invoice.items.length) throw new Error("XRechnung nima postavk.");
  let net = 0, tax = 0, gross = 0;
  invoice.items.forEach((item, index) => {
    assertRequired(item.description, "Postavka " + (index + 1) + " nima opisa.");
    if (integer(item.quantity_milli) <= 0) throw new Error("Postavka " + (index + 1) + " nima veljavne količine.");
    if (integer(item.net_cents) < 0 || integer(item.tax_cents) < 0 || integer(item.gross_cents) < 0) throw new Error("Postavka " + (index + 1) + " nima veljavnih zneskov.");
    if (integer(item.net_cents) + integer(item.tax_cents) !== integer(item.gross_cents)) throw new Error("Seštevek postavke " + (index + 1) + " ni pravilen.");
    net += integer(item.net_cents); tax += integer(item.tax_cents); gross += integer(item.gross_cents);
  });
  invoice.deductions.forEach((entry, index) => {
    if (!entry.invoiceId || !entry.invoiceNumber) throw new Error("Odbitek Abschlagsrechnung " + (index + 1) + " nima veljavne reference.");
    if (entry.netCents < 0 || entry.taxCents < 0 || entry.grossCents <= 0 || entry.netCents + entry.taxCents !== entry.grossCents) throw new Error("Odbitek Abschlagsrechnung " + (index + 1) + " nima veljavnih zneskov.");
  });
  const expectedNet = net - invoice.deductionNetCents;
  const expectedTax = tax - invoice.deductionTaxCents;
  const expectedGross = gross - invoice.deductionGrossCents;
  if (expectedNet < 0 || expectedTax < 0 || expectedGross < 0 || expectedNet + expectedTax !== expectedGross || expectedNet !== invoice.netCents || expectedTax !== invoice.taxCents || expectedGross !== invoice.grossCents || net + tax !== gross) throw new Error("Zaklenjeni seštevki računa niso skladni s postavkami in odbitki.");
}

function element(name, value, attributes) {
  const attrs = Object.entries(attributes || {}).map(([key, val]) => " " + key + "=\"" + escapeXml(val) + "\"").join("");
  return "<" + name + attrs + ">" + escapeXml(value) + "</" + name + ">";
}
function taxCategoryXml(details, includeExemption) {
  return [
    element("cbc:ID", details.id), element("cbc:Percent", percentage(details.rateBps)),
    includeExemption && details.exemptionCode ? element("cbc:TaxExemptionReasonCode", details.exemptionCode) : "",
    includeExemption && details.exemptionReason ? element("cbc:TaxExemptionReason", details.exemptionReason) : "",
    "<cac:TaxScheme>" + element("cbc:ID", "VAT") + "</cac:TaxScheme>"
  ].filter(Boolean).join("");
}

function paymentDetails(invoice) {
  const method = text(invoice && invoice.draft && invoice.draft.payment_method) || "sepa";
  if (method === "already_paid") return {
    code: "1", name: "Bereits bezahlt", note: "Der Rechnungsbetrag wurde bereits vollständig bezahlt.",
    includeAccount: false, prepaidCents: invoice.serviceGrossCents, payableCents: 0
  };
  if (method === "card_external") return {
    code: "48", name: "Kartenzahlung", note: "Zahlung über ein externes Kartenterminal.",
    includeAccount: false, prepaidCents: invoice.deductionGrossCents, payableCents: invoice.grossCents
  };
  return {
    code: "58", name: "SEPA-Überweisung",
    note: invoice.dueDate === invoice.issueDate ? "Zahlbar sofort ohne Abzug." : "Zahlbar bis " + invoice.dueDate + " ohne Abzug.",
    includeAccount: true, prepaidCents: invoice.deductionGrossCents, payableCents: invoice.grossCents
  };
}

function buildXRechnung(invoiceRow) {
  const invoice = normalizeInvoice(invoiceRow);
  const seller = invoice.seller, draft = invoice.draft;
  const buyerReference = text(draft.buyer_reference || draft.leitweg_id);
  const buyerEndpoint = invoice.customerType === "public" ? text(draft.leitweg_id) : text(draft.customer_email);
  const buyerScheme = invoice.customerType === "public" ? "0204" : "EM";
  const taxGroups = new Map();
  const lineXml = invoice.items.map((item, index) => {
    const details = taxDetails(invoice.taxMode, item.tax_rate_bps);
    const key = details.id + ":" + details.rateBps;
    const group = taxGroups.get(key) || { details, netCents: 0, taxCents: 0 };
    group.netCents += integer(item.net_cents); group.taxCents += integer(item.tax_cents); taxGroups.set(key, group);
    const netUnitPrice = integer(item.net_cents) * 10 / integer(item.quantity_milli);
    return [
      "  <cac:InvoiceLine>", "    " + element("cbc:ID", index + 1),
      "    " + element("cbc:InvoicedQuantity", quantity(item.quantity_milli), { unitCode: unitCode(item.unit) }),
      "    " + element("cbc:LineExtensionAmount", money(item.net_cents), { currencyID: "EUR" }),
      "    <cac:Item>", "      " + element("cbc:Name", item.description),
      "      <cac:ClassifiedTaxCategory>" + taxCategoryXml(details, false) + "</cac:ClassifiedTaxCategory>", "    </cac:Item>",
      "    <cac:Price>" + element("cbc:PriceAmount", netUnitPrice.toFixed(4), { currencyID: "EUR" }) + "</cac:Price>",
      "  </cac:InvoiceLine>"
    ].join("\n");
  }).join("\n");
  const taxXml = Array.from(taxGroups.values()).map((group) => [
    "    <cac:TaxSubtotal>",
    "      " + element("cbc:TaxableAmount", money(group.netCents), { currencyID: "EUR" }),
    "      " + element("cbc:TaxAmount", money(group.taxCents), { currencyID: "EUR" }),
    "      <cac:TaxCategory>" + taxCategoryXml(group.details, true) + "</cac:TaxCategory>",
    "    </cac:TaxSubtotal>"
  ].join("\n")).join("\n");
  const sellerTax = [];
  if (text(seller.vatId)) sellerTax.push("      <cac:PartyTaxScheme>" + element("cbc:CompanyID", seller.vatId) + "<cac:TaxScheme>" + element("cbc:ID", "VAT") + "</cac:TaxScheme></cac:PartyTaxScheme>");
  if (text(seller.taxNumber)) sellerTax.push("      <cac:PartyTaxScheme>" + element("cbc:CompanyID", seller.taxNumber) + "<cac:TaxScheme>" + element("cbc:ID", "FC") + "</cac:TaxScheme></cac:PartyTaxScheme>");
  const payment = paymentDetails(invoice);
  const paymentAccount = payment.includeAccount
    ? "<cac:PayeeFinancialAccount>" + element("cbc:ID", cleanIban(seller.iban)) + element("cbc:Name", seller.accountHolder) + "</cac:PayeeFinancialAccount>"
    : "";
  const billingReferences = invoice.deductions.map((entry) => "  <cac:BillingReference><cac:InvoiceDocumentReference>" + element("cbc:ID", entry.invoiceNumber) + (validDate(entry.issueDate) ? element("cbc:IssueDate", entry.issueDate) : "") + "</cac:InvoiceDocumentReference></cac:BillingReference>").join("\n");
  const xml = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<ubl:Invoice xmlns:ubl=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\" xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\" xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">",
    "  " + element("cbc:CustomizationID", CUSTOMIZATION_ID), "  " + element("cbc:ProfileID", PROFILE_ID),
    "  " + element("cbc:ID", invoice.number), "  " + element("cbc:IssueDate", invoice.issueDate),
    "  " + element("cbc:DueDate", invoice.dueDate), "  " + element("cbc:InvoiceTypeCode", "380"),
    invoice.deductions.length ? "  " + element("cbc:Note", "Vereinnahmte Abschlagszahlungen einschließlich der darauf entfallenden Umsatzsteuer wurden gemäß § 14 Abs. 5 UStG abgesetzt.") : "",
    "  " + element("cbc:DocumentCurrencyCode", "EUR"), "  " + element("cbc:BuyerReference", buyerReference),
    billingReferences,
    "  <cac:AccountingSupplierParty>", "    <cac:Party>",
    "      " + element("cbc:EndpointID", seller.businessEmail, { schemeID: "EM" }),
    "      <cac:PartyIdentification>" + element("cbc:ID", seller.vatId || seller.taxNumber) + "</cac:PartyIdentification>",
    "      <cac:PartyName>" + element("cbc:Name", seller.legalName) + "</cac:PartyName>",
    "      <cac:PostalAddress>" + element("cbc:StreetName", seller.street) + element("cbc:CityName", seller.city) + element("cbc:PostalZone", seller.postalCode) + "<cac:Country>" + element("cbc:IdentificationCode", "DE") + "</cac:Country></cac:PostalAddress>",
    sellerTax.join("\n"),
    "      <cac:PartyLegalEntity>" + element("cbc:RegistrationName", seller.legalName) + (text(seller.registerNumber) ? element("cbc:CompanyID", seller.registerNumber) : "") + (text(seller.legalForm) ? element("cbc:CompanyLegalForm", seller.legalForm + (text(seller.companySeat) ? "; Sitz: " + seller.companySeat : "") + (text(seller.registerCourt) ? "; Registergericht: " + seller.registerCourt : "")) : "") + "</cac:PartyLegalEntity>",
    "      <cac:Contact>" + (text(seller.representative) ? element("cbc:Name", seller.representative) : "") + element("cbc:Telephone", invoice.sellerPhone) + element("cbc:ElectronicMail", seller.businessEmail) + "</cac:Contact>",
    "    </cac:Party>", "  </cac:AccountingSupplierParty>",
    "  <cac:AccountingCustomerParty>", "    <cac:Party>",
    "      " + element("cbc:EndpointID", buyerEndpoint, { schemeID: buyerScheme }),
    "      <cac:PostalAddress>" + element("cbc:StreetName", draft.customer_street) + element("cbc:CityName", draft.customer_city) + element("cbc:PostalZone", draft.customer_postal_code) + "<cac:Country>" + element("cbc:IdentificationCode", "DE") + "</cac:Country></cac:PostalAddress>",
    text(draft.customer_vat_id) ? "      <cac:PartyTaxScheme>" + element("cbc:CompanyID", draft.customer_vat_id) + "<cac:TaxScheme>" + element("cbc:ID", "VAT") + "</cac:TaxScheme></cac:PartyTaxScheme>" : "",
    "      <cac:PartyLegalEntity>" + element("cbc:RegistrationName", draft.customer_name) + "</cac:PartyLegalEntity>",
    text(draft.customer_contact) || text(draft.customer_email) ? "      <cac:Contact>" + (text(draft.customer_contact) ? element("cbc:Name", draft.customer_contact) : "") + (text(draft.customer_email) ? element("cbc:ElectronicMail", draft.customer_email) : "") + "</cac:Contact>" : "",
    "    </cac:Party>", "  </cac:AccountingCustomerParty>",
    "  <cac:Delivery>" + element("cbc:ActualDeliveryDate", invoice.serviceDate) + "</cac:Delivery>",
    "  <cac:PaymentMeans>" + element("cbc:PaymentMeansCode", payment.code, { name: payment.name }) + element("cbc:PaymentID", invoice.number) + paymentAccount + "</cac:PaymentMeans>",
    "  <cac:PaymentTerms>" + element("cbc:Note", payment.note) + "</cac:PaymentTerms>",
    "  <cac:TaxTotal>", "    " + element("cbc:TaxAmount", money(invoice.serviceTaxCents), { currencyID: "EUR" }), taxXml, "  </cac:TaxTotal>",
    "  <cac:LegalMonetaryTotal>",
    "    " + element("cbc:LineExtensionAmount", money(invoice.serviceNetCents), { currencyID: "EUR" }),
    "    " + element("cbc:TaxExclusiveAmount", money(invoice.serviceNetCents), { currencyID: "EUR" }),
    "    " + element("cbc:TaxInclusiveAmount", money(invoice.serviceGrossCents), { currencyID: "EUR" }),
    payment.prepaidCents ? "    " + element("cbc:PrepaidAmount", money(payment.prepaidCents), { currencyID: "EUR" }) : "",
    "    " + element("cbc:PayableAmount", money(payment.payableCents), { currencyID: "EUR" }),
    "  </cac:LegalMonetaryTotal>", lineXml, "</ubl:Invoice>"
  ].filter(Boolean).join("\n");
  return Buffer.from(xml, "utf8");
}

module.exports = {
  GENERATOR_VERSION, XRECHNUNG_VERSION, KOSIT_VALIDATOR_VERSION, KOSIT_CONFIG_VERSION,
  CUSTOMIZATION_ID, PROFILE_ID, buildXRechnung, preflightInvoice,
  _test: { TEST_SELLER, escapeXml, money, quantity, percentage, unitCode, taxDetails, paymentDetails, testSellerIdentity, normalizeInvoice, validateInvoice, addUtcDays, preflightInvoice }
};
