"use strict";

const { DateTime } = require("luxon");
const providerJson = require("./provider-json");

const SANDBOX_BASE = "https://test.invoice.openapi.com";
const PRODUCTION_BASE = "https://invoice.openapi.com";
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_PROVIDER_CLOCK_SKEW_MS = 10 * 60 * 1000;
const MIN_PRODUCTION_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PUBLIC_PREFLIGHT_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_PUBLIC_PREFLIGHT_FUTURE_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_COST_MICRO_EUR = Object.freeze({ invoicePost: 90000, invoiceGet: 1000, configurationPost: 1000000 });

class OpenapiInvoiceError extends Error {
  constructor(message, options) {
    super(message);
    this.name = "OpenapiInvoiceError";
    this.code = options && options.code || "OPENAPI_INVOICE_ERROR";
    this.retryable = Boolean(options && options.retryable);
    this.status = Number(options && options.status) || 0;
  }
}

function text(value) { return String(value == null ? "" : value).trim(); }
function integer(value) { const number = Number(value); return Number.isFinite(number) ? Math.round(number) : 0; }
function euros(cents) { return Number((integer(cents) / 100).toFixed(2)); }
function cleanVat(value) { return text(value).toUpperCase().replace(/[\s-]/g, ""); }
function enabled(value) { return text(value).toLowerCase() === "true"; }

function validEmail(value) {
  const email = text(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validDate(value) {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function berlinDate(value) {
  const parsed = DateTime.fromISO(text(value), { setZone: true });
  return parsed.isValid ? parsed.setZone("Europe/Berlin").toISODate() : "";
}

function documentNumber(row, sandbox) {
  const original = text(row && row.invoice_number);
  if (!original) throw new OpenapiInvoiceError("Za Openapi manjka številka računa.", { code: "OPENAPI_DOCUMENT_NUMBER_REQUIRED" });
  if (!sandbox) {
    if (original.length > 70) throw new OpenapiInvoiceError("Številka računa za Openapi presega 70 znakov.", { code: "OPENAPI_DOCUMENT_NUMBER_TOO_LONG" });
    return original;
  }
  const invoiceKey = text(row && row.id).replace(/[^0-9a-z]/gi, "").slice(0, 16);
  if (!invoiceKey) throw new OpenapiInvoiceError("Testni račun nima stabilne oznake za Openapi sandbox.", { code: "OPENAPI_SANDBOX_DOCUMENT_KEY_REQUIRED" });
  return ("SBX-" + invoiceKey + "-" + original).slice(0, 70);
}

function providerReason(body, status) {
  const candidates = [body && body.message, body && body.error, body && body.data];
  let reason = candidates.find((value) => typeof value === "string" && value.trim());
  if (!reason && body && (typeof body.error === "number" || typeof body.error === "boolean")) {
    reason = "koda " + String(body.error);
  }
  reason = text(reason).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").slice(0, 300);
  return reason || (status ? "HTTP " + status : "");
}

function rejectedMessage(prefix, result) {
  const reason = providerReason(result && result.body, result && result.response && result.response.status);
  return prefix + (reason ? ": " + reason : ".");
}

function readiness(env) {
  const source = env || process.env;
  const token = text(source.OPENAPI_INVOICE_TOKEN);
  const selected = text(source.OPENAPI_INVOICE_MODE).toLowerCase();
  const requestedMode = selected === "production" ? "production" : "sandbox";
  const productionEnabled = text(source.POS_OPENAPI_INVOICE_ENABLED).toLowerCase() === "true";
  const productionSendEnabled = enabled(source.OPENAPI_INVOICE_SEND_ENABLED);
  const configurationCreateEnabled = requestedMode === "sandbox" || enabled(source.OPENAPI_INVOICE_ALLOW_CONFIGURATION_CREATE);
  const configurationUpdateEnabled = requestedMode === "sandbox" || enabled(source.OPENAPI_INVOICE_ALLOW_CONFIGURATION_UPDATE);
  const reconciliationEnabled = enabled(source.OPENAPI_INVOICE_RECONCILIATION_ENABLED);
  const tokenExpiresAtText = text(source.OPENAPI_INVOICE_TOKEN_EXPIRES_AT);
  const tokenExpiresAtMs = Date.parse(tokenExpiresAtText);
  const productionTokenFresh = Number.isFinite(tokenExpiresAtMs)
    && tokenExpiresAtMs > Date.now() + MIN_PRODUCTION_TOKEN_LIFETIME_MS;
  const webhookSecret = requestedMode === "sandbox"
    ? text(source.OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET)
    : text(source.OPENAPI_INVOICE_WEBHOOK_SECRET);
  const webhookUrl = requestedMode === "sandbox"
    ? text(source.OPENAPI_INVOICE_SANDBOX_WEBHOOK_URL)
    : text(source.OPENAPI_INVOICE_WEBHOOK_URL);
  let webhookUrlValid = false;
  try {
    const parsedWebhookUrl = new URL(webhookUrl);
    const sandboxParam = parsedWebhookUrl.searchParams.get("sandbox");
    const allowedParameters = requestedMode === "sandbox"
      ? new Set(["handler", "webhook", "sandbox"])
      : new Set(["handler", "webhook"]);
    const parameterNames = Array.from(parsedWebhookUrl.searchParams.keys());
    const exactParameters = parameterNames.length === allowedParameters.size
      && new Set(parameterNames).size === allowedParameters.size
      && parameterNames.every((name) => allowedParameters.has(name));
    webhookUrlValid = parsedWebhookUrl.protocol === "https:" && !parsedWebhookUrl.username &&
      !parsedWebhookUrl.password && !parsedWebhookUrl.hash &&
      exactParameters &&
      parsedWebhookUrl.searchParams.get("handler") === "openapi-invoice" &&
      parsedWebhookUrl.searchParams.get("webhook") === "1" &&
      (requestedMode === "sandbox" ? sandboxParam === "1" : sandboxParam === null);
  } catch (_) {}
  const webhookConfigured = webhookSecret.length >= 32 && webhookUrlValid;
  const webhookPublicPreflightUrl = text(source.OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL);
  const webhookPublicPreflightAtMs = Date.parse(text(source.OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT));
  const webhookPublicPreflightConfirmed = requestedMode === "production" && webhookUrlValid &&
    enabled(source.OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED) &&
    webhookPublicPreflightUrl === webhookUrl && Number.isFinite(webhookPublicPreflightAtMs) &&
    webhookPublicPreflightAtMs >= Date.now() - MAX_PUBLIC_PREFLIGHT_AGE_MS &&
    webhookPublicPreflightAtMs <= Date.now() + MAX_PUBLIC_PREFLIGHT_FUTURE_SKEW_MS;
  const sandboxEnabled = Boolean(token) && requestedMode === "sandbox";
  const liveEnabled = Boolean(token) && requestedMode === "production" && productionEnabled && productionSendEnabled
    && productionTokenFresh && webhookConfigured && webhookPublicPreflightConfirmed;
  const financialAdjustmentsEnabled = liveEnabled;
  const blockers = [];
  if (!token) blockers.push("token_missing");
  if (requestedMode === "production" && !productionEnabled) blockers.push("production_lock_closed");
  if (requestedMode === "production" && !productionSendEnabled) blockers.push("production_send_lock_closed");
  if (requestedMode === "production" && !tokenExpiresAtText) blockers.push("production_token_expiry_missing");
  else if (requestedMode === "production" && !productionTokenFresh) blockers.push("production_token_expiring");
  if (requestedMode === "production" && !webhookConfigured) blockers.push("production_webhook_missing");
  if (requestedMode === "production" && !webhookPublicPreflightConfirmed) blockers.push("production_webhook_public_preflight_missing");
  return {
    provider: "openapi",
    configured: Boolean(token),
    sendEnabled: sandboxEnabled || liveEnabled,
    sandboxEnabled,
    liveEnabled,
    webhookConfigured,
    webhookPublicPreflightConfirmed,
    configurationCreateEnabled,
    configurationUpdateEnabled,
    reconciliationEnabled,
    multiCompanyReady: true,
    financialAdjustmentsEnabled,
    financialAdjustmentBlocker: financialAdjustmentsEnabled ? "" : requestedMode === "sandbox" ? "sandbox_probe_only" : "openapi_delivery_not_enabled",
    productionTokenFresh,
    tokenExpiresAt: productionTokenFresh ? new Date(tokenExpiresAtMs).toISOString() : "",
    webhookUrl: webhookConfigured ? webhookUrl : "",
    requestedMode,
    mode: liveEnabled ? "production" : "sandbox",
    baseUrl: liveEnabled ? PRODUCTION_BASE : SANDBOX_BASE,
    blockers,
  };
}

function priceMicroEur(value, fallback) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 1000000) : fallback;
}

function costModel(env) {
  const source = env || process.env;
  return {
    currency: "EUR",
    plan: text(source.OPENAPI_INVOICE_COST_PLAN) || "public_pay_as_you_go",
    invoicePostMicroEur: priceMicroEur(source.OPENAPI_INVOICE_POST_PRICE_EUR, DEFAULT_COST_MICRO_EUR.invoicePost),
    invoiceGetMicroEur: priceMicroEur(source.OPENAPI_INVOICE_GET_PRICE_EUR, DEFAULT_COST_MICRO_EUR.invoiceGet),
    configurationPostMicroEur: priceMicroEur(source.OPENAPI_INVOICE_CONFIGURATION_PRICE_EUR, DEFAULT_COST_MICRO_EUR.configurationPost),
  };
}

function usageSummary(rows, env) {
  const deliveries = Array.isArray(rows) ? rows : [];
  const model = costModel(env);
  const production = deliveries.filter((row) => row && row.provider === "openapi" && row.is_test === false);
  const submitted = production.filter((row) => text(row.provider_reference)).length;
  const preflightGets = submitted * 2;
  const reconciliationGets = production.reduce((sum, row) => sum + Math.max(0, integer(row.reconciliation_attempt_count)), 0);
  const estimatedMicroEur = submitted * model.invoicePostMicroEur + (preflightGets + reconciliationGets) * model.invoiceGetMicroEur;
  return {
    currency: model.currency,
    plan: model.plan,
    productionSubmissions: submitted,
    preflightGets,
    reconciliationGets,
    estimatedEur: Number((estimatedMicroEur / 1000000).toFixed(6)),
    unitPricesEur: {
      invoicePost: model.invoicePostMicroEur / 1000000,
      invoiceGet: model.invoiceGetMicroEur / 1000000,
      configurationPost: model.configurationPostMicroEur / 1000000,
    },
    configurationCreatesTracked: false,
    note: "Ocena vključuje dva običajna GET pred vsakim sprejetim POST; ne vključuje ustvarjanja ali posodabljanja konfiguracij, ki sta v produkciji privzeto zaklenjena.",
  };
}

function unitCode(unit) {
  return ({ "Std.": "HUR", h: "HUR", "m²": "MTK", m2: "MTK", "Stk.": "C62", Stk: "C62" })[text(unit)] || "C62";
}

function taxCategory(taxMode, rateBps) {
  if (taxMode === "reverse_charge") return "reverse_charge";
  if (taxMode === "small_business") return "exempt";
  return integer(rateBps) === 0 ? "zero_rated" : "standard";
}

function address(street, postalCode, city) {
  const fullStreet = text(street);
  const match = fullStreet.match(/^(.*?)\s+(\d+\s*[a-zA-ZÄÖÜäöüß]?(?:\s*[/-]\s*\d+\s*[a-zA-ZÄÖÜäöüß]?)?)$/u);
  return {
    street_address: match ? text(match[1]) : fullStreet,
    street_number: match ? text(match[2]).replace(/\s+/g, "") : "",
    zip_code: text(postalCode),
    city: text(city),
    country: "DE",
  };
}

function findPdf(deliveryPackage) {
  return (deliveryPackage.attachments || []).find((item) => item && item.mediaType === "application/pdf") || null;
}

function financialAdjustmentPackage(deliveryPackage) {
  const adjustment = deliveryPackage && deliveryPackage.adjustment;
  if (!adjustment || !["cancellation", "credit_note"].includes(text(adjustment.adjustment_type))) {
    throw new OpenapiInvoiceError("Openapi podpira samo finančni Storno ali Gutschrift (tip 381).", { code: "OPENAPI_ADJUSTMENT_TYPE_UNSUPPORTED" });
  }
  const snapshot = adjustment.snapshot || {};
  const original = snapshot.original_invoice || {};
  const originalDocumentNumber = text(original.invoice_number);
  const originalIssueDate = text(original.issue_date);
  const sourceDraft = snapshot.effective_draft || snapshot.original_draft || {};
  const creditNote = adjustment.adjustment_type === "credit_note";
  const sourceItems = creditNote ? snapshot.credit_lines : sourceDraft.items;
  if (!Array.isArray(sourceItems) || !sourceItems.length) {
    throw new OpenapiInvoiceError("Finančni popravek nima zaklenjenih postavk.", { code: "OPENAPI_ADJUSTMENT_SNAPSHOT_INVALID" });
  }
  if (!originalDocumentNumber || !validDate(originalIssueDate)) {
    throw new OpenapiInvoiceError("Finančni popravek nima veljavne številke in datuma izvirnega računa za billing_reference.", {
      code: "OPENAPI_ADJUSTMENT_BILLING_REFERENCE_INVALID",
    });
  }
  const issueDate = berlinDate(adjustment.issued_at);
  const deltaNetCents = integer(adjustment.delta_net_cents);
  const deltaTaxCents = integer(adjustment.delta_tax_cents);
  const deltaGrossCents = integer(adjustment.delta_gross_cents);
  if (deltaNetCents >= 0 || deltaTaxCents > 0 || deltaGrossCents >= 0) {
    throw new OpenapiInvoiceError("Finančni popravek nima negativnih notranjih delt.", { code: "OPENAPI_ADJUSTMENT_DELTA_SIGN_INVALID" });
  }
  const netCents = Math.abs(deltaNetCents);
  const taxCents = Math.abs(deltaTaxCents);
  const grossCents = Math.abs(deltaGrossCents);
  if (!issueDate || grossCents <= 0 || netCents + taxCents !== grossCents) {
    throw new OpenapiInvoiceError("Finančni popravek nima veljavnega datuma ali zneskov.", { code: "OPENAPI_ADJUSTMENT_TOTALS_INVALID" });
  }
  const referencePrefix = (creditNote ? "Gutschrift zu Rechnung " : "Storno zu Rechnung ") + originalDocumentNumber + ": ";
  const items = sourceItems.map(function (item, index) {
    const line = Object.assign({}, item);
    line.description = (index === 0 ? referencePrefix : "") + (text(item.description) || (creditNote ? "Gutschrift" : "Stornierte Leistung"));
    if (creditNote) {
      line.quantity_milli = 1000;
      line.unit = "Stk.";
    }
    return line;
  });
  const mappedPackage = {
    delivery: deliveryPackage.delivery,
    invoice: {
      id: adjustment.id,
      invoice_number: adjustment.adjustment_number,
      customer_type: deliveryPackage.invoice && deliveryPackage.invoice.customer_type,
      customer_name: deliveryPackage.invoice && deliveryPackage.invoice.customer_name,
      issue_date: issueDate,
      due_date: issueDate,
      tax_mode: text(original.tax_mode) || text(deliveryPackage.invoice && deliveryPackage.invoice.tax_mode),
      net_cents: netCents,
      tax_cents: taxCents,
      gross_cents: grossCents,
      is_test: Boolean(adjustment.is_test),
      snapshot: { seller: snapshot.seller || {}, draft: Object.assign({}, sourceDraft, { items }) }
    },
    adjustment: null,
    attachments: deliveryPackage.attachments || [],
    manifestSha256: deliveryPackage.manifestSha256
  };
  mappedPackage.billingReference = {
    document_number: originalDocumentNumber,
    issue_date: originalIssueDate,
  };
  mappedPackage.billingReferenceInvoiceId = text(original.id);
  return mappedPackage;
}

function adjustmentPayload(deliveryPackage, options) {
  const mappedPackage = financialAdjustmentPackage(deliveryPackage);
  const payload = invoicePayload(mappedPackage, options);
  const payloadOptions = options || {};
  const referenceDocumentNumber = payloadOptions.sandbox === true
    ? documentNumber({
      id: mappedPackage.billingReferenceInvoiceId,
      invoice_number: mappedPackage.billingReference.document_number,
    }, true)
    : mappedPackage.billingReference.document_number;
  payload.type = "381";
  payload.billing_reference = {
    document_number: referenceDocumentNumber,
    issue_date: mappedPackage.billingReference.issue_date,
  };
  payload.total_amount_excluding_tax = -Math.abs(payload.total_amount_excluding_tax);
  payload.total_amount_including_tax = -Math.abs(payload.total_amount_including_tax);
  payload.total_tax_amount = payload.total_tax_amount === 0 ? 0 : -Math.abs(payload.total_tax_amount);
  payload.invoice_lines = payload.invoice_lines.map(function (line) {
    return Object.assign({}, line, {
      unit_price: -Math.abs(line.unit_price),
      total_net_amount: -Math.abs(line.total_net_amount),
    });
  });
  payload.tax_subtotals = payload.tax_subtotals.map(function (subtotal) {
    return Object.assign({}, subtotal, {
      taxable_amount: -Math.abs(subtotal.taxable_amount),
      tax_amount: subtotal.tax_amount === 0 ? 0 : -Math.abs(subtotal.tax_amount),
    });
  });
  payload.payment_means = payload.payment_means.map(function (payment) {
    return Object.assign({}, payment, { amount: -Math.abs(payment.amount) });
  });
  delete payload.due_date;
  assertFinancialAdjustmentPayload(payload, {
    documentNumber: referenceDocumentNumber,
    issueDate: mappedPackage.billingReference.issue_date,
  });
  return payload;
}

function assertFinancialAdjustmentPayload(payload, reference) {
  const cents = function (value) { return Math.round(Number(value) * 100); };
  const lines = Array.isArray(payload && payload.invoice_lines) ? payload.invoice_lines : [];
  const subtotals = Array.isArray(payload && payload.tax_subtotals) ? payload.tax_subtotals : [];
  const payments = Array.isArray(payload && payload.payment_means) ? payload.payment_means : [];
  const billingReference = payload && payload.billing_reference || {};
  const rootsValid = payload && payload.type === "381"
    && Number(payload.total_amount_excluding_tax) < 0
    && Number(payload.total_amount_including_tax) < 0
    && Number(payload.total_tax_amount) <= 0
    && cents(payload.total_amount_excluding_tax) + cents(payload.total_tax_amount) === cents(payload.total_amount_including_tax);
  const linesValid = lines.length > 0 && lines.every(function (line) {
    return Number(line.quantity) > 0 && Number(line.unit_price) < 0 && Number(line.total_net_amount) < 0;
  });
  const subtotalsValid = subtotals.length > 0 && subtotals.every(function (subtotal) {
    return Number(subtotal.taxable_amount) < 0 && Number(subtotal.tax_amount) <= 0;
  });
  const paymentsValid = payments.length > 0 && payments.every(function (payment) {
    return Number(payment.amount) < 0;
  }) && payments.reduce(function (sum, payment) { return sum + cents(payment.amount); }, 0) === cents(payload.total_amount_including_tax);
  const sumsValid = lines.reduce(function (sum, line) { return sum + cents(line.total_net_amount); }, 0) === cents(payload.total_amount_excluding_tax)
    && subtotals.reduce(function (sum, subtotal) { return sum + cents(subtotal.taxable_amount); }, 0) === cents(payload.total_amount_excluding_tax)
    && subtotals.reduce(function (sum, subtotal) { return sum + cents(subtotal.tax_amount); }, 0) === cents(payload.total_tax_amount);
  const referenceValid = text(billingReference.document_number) === text(reference && reference.documentNumber)
    && text(billingReference.issue_date) === text(reference && reference.issueDate)
    && validDate(billingReference.issue_date);
  if (!rootsValid || !linesValid || !subtotalsValid || !paymentsValid || !sumsValid || !referenceValid) {
    throw new OpenapiInvoiceError("Finančni popravek ne ustreza pogodbi Openapi za tip 381.", {
      code: "OPENAPI_ADJUSTMENT_CONTRACT_INVALID",
    });
  }
}

function invoicePayload(deliveryPackage, options) {
  if (deliveryPackage && deliveryPackage.adjustment) return adjustmentPayload(deliveryPackage, options);
  const row = deliveryPackage && deliveryPackage.invoice;
  const snapshot = row && row.snapshot || {};
  const seller = snapshot.seller || {};
  const draft = snapshot.draft || {};
  const items = Array.isArray(draft.items) ? draft.items : [];
  const payloadOptions = options || {};
  const sourceEnv = payloadOptions.env || process.env;
  const sandboxVat = payloadOptions.sandbox === true
    ? cleanVat(sourceEnv.OPENAPI_INVOICE_SANDBOX_FISCAL_ID)
    : "";
  const sellerVat = sandboxVat || cleanVat(seller.vatId);
  if (!/^DE\d{9}$/.test(sellerVat)) {
    throw new OpenapiInvoiceError("Openapi zahteva veljavno nemško USt-IdNr. izdajatelja.", { code: "OPENAPI_SELLER_VAT_REQUIRED" });
  }
  if (!items.length) throw new OpenapiInvoiceError("Račun nima postavk za Openapi.", { code: "OPENAPI_LINES_REQUIRED" });
  if (!validDate(row.issue_date) || !validDate(row.due_date)) {
    throw new OpenapiInvoiceError("Datum izdaje ali zapadlosti za Openapi ni veljaven.", { code: "OPENAPI_DATE_INVALID" });
  }
  const rowNetCents = integer(row.net_cents);
  const rowTaxCents = integer(row.tax_cents);
  const rowGrossCents = integer(row.gross_cents);
  if (rowNetCents < 0 || rowTaxCents < 0 || rowGrossCents <= 0 || rowNetCents + rowTaxCents !== rowGrossCents) {
    throw new OpenapiInvoiceError("Skupni zneski računa za Openapi niso veljavni.", { code: "OPENAPI_TOTALS_INVALID" });
  }
  const taxMode = text(row.tax_mode);
  const taxGroups = new Map();
  const lineTotals = { net: 0, tax: 0, gross: 0 };
  const invoiceLines = items.map((item, index) => {
    const quantityMilli = integer(item.quantity_milli);
    const netCents = integer(item.net_cents);
    const taxCents = integer(item.tax_cents);
    const grossCents = integer(item.gross_cents);
    const rateBps = taxMode === "regular" ? integer(item.tax_rate_bps) : 0;
    if (!text(item.description) || quantityMilli <= 0 || netCents < 0 || taxCents < 0 || netCents + taxCents !== grossCents) {
      throw new OpenapiInvoiceError("Postavka " + (index + 1) + " ni veljavna za Openapi.", { code: "OPENAPI_LINE_INVALID" });
    }
    if (taxMode === "regular" && ![0, 700, 1900].includes(rateBps)) {
      throw new OpenapiInvoiceError("Postavka " + (index + 1) + " nima podprte nemške stopnje DDV.", { code: "OPENAPI_TAX_RATE_INVALID" });
    }
    if (taxMode === "regular" && Math.round(netCents * rateBps / 10000) !== taxCents) {
      throw new OpenapiInvoiceError("DDV postavke " + (index + 1) + " se ne ujema z neto zneskom.", { code: "OPENAPI_LINE_TAX_MISMATCH" });
    }
    lineTotals.net += netCents;
    lineTotals.tax += taxCents;
    lineTotals.gross += grossCents;
    const category = taxCategory(taxMode, rateBps);
    const key = rateBps + ":" + category;
    const group = taxGroups.get(key) || { taxable_amount: 0, tax_amount: 0, vat_rate: rateBps / 100, tax_category: category };
    group.taxable_amount = Number((group.taxable_amount + netCents / 100).toFixed(2));
    group.tax_amount = Number((group.tax_amount + taxCents / 100).toFixed(2));
    taxGroups.set(key, group);
    return {
      description: text(item.description).slice(0, 240),
      quantity: Number((quantityMilli / 1000).toFixed(3)),
      unit_price: Number((netCents * 10 / quantityMilli).toFixed(4)),
      total_net_amount: euros(netCents),
      tax_rate: rateBps / 100,
      tax_category: category,
      unit_of_measure: unitCode(item.unit),
    };
  });
  if (lineTotals.net !== rowNetCents || lineTotals.tax !== rowTaxCents || lineTotals.gross !== rowGrossCents) {
    throw new OpenapiInvoiceError("Vsota postavk se ne ujema s skupnimi zneski računa.", { code: "OPENAPI_LINE_TOTALS_MISMATCH" });
  }
  const publicRecipient = row.customer_type === "public";
  const sellerAddress = address(seller.street, seller.postalCode, seller.city);
  const recipientAddress = address(draft.customer_street, draft.customer_postal_code, draft.customer_city);
  if (!sellerAddress.street_number) {
    throw new OpenapiInvoiceError("Za Openapi manjka ločljiva hišna številka izdajatelja.", { code: "OPENAPI_SELLER_STREET_NUMBER_REQUIRED" });
  }
  if (!recipientAddress.street_number) {
    throw new OpenapiInvoiceError("Za Openapi manjka ločljiva hišna številka prejemnika.", { code: "OPENAPI_RECIPIENT_STREET_NUMBER_REQUIRED" });
  }
  if (!/^\d{5}$/.test(sellerAddress.zip_code) || !/^\d{5}$/.test(recipientAddress.zip_code)
      || sellerAddress.street_address.length > 100 || recipientAddress.street_address.length > 100
      || sellerAddress.street_number.length > 10 || recipientAddress.street_number.length > 10
      || !sellerAddress.city || !recipientAddress.city
      || sellerAddress.city.length > 60 || recipientAddress.city.length > 60) {
    throw new OpenapiInvoiceError("Nemški naslov izdajatelja ali prejemnika ni veljaven za Openapi.", { code: "OPENAPI_ADDRESS_INVALID" });
  }
  if (!text(seller.legalName) || !validEmail(seller.businessEmail)) {
    throw new OpenapiInvoiceError("Pravno ime ali e-pošta izdajatelja ni veljavna za Openapi.", { code: "OPENAPI_SELLER_IDENTITY_INVALID" });
  }
  const recipient = {
    name: text(draft.customer_name || row.customer_name),
    email: text(draft.customer_email),
    address: recipientAddress,
  };
  if (!recipient.name || (recipient.email && !validEmail(recipient.email))) {
    throw new OpenapiInvoiceError("Naziv ali e-pošta prejemnika ni veljavna za Openapi.", { code: "OPENAPI_RECIPIENT_IDENTITY_INVALID" });
  }
  const recipientVat = cleanVat(draft.customer_vat_id);
  if (recipientVat && !/^DE\d{9}$/.test(recipientVat)) {
    throw new OpenapiInvoiceError("USt-IdNr. nemškega prejemnika ni veljavna.", { code: "OPENAPI_RECIPIENT_VAT_INVALID" });
  }
  if (recipientVat) recipient.vat_number = recipientVat;
  if (publicRecipient) recipient.leitweg_id = text(draft.leitweg_id || deliveryPackage.routingReference);
  const paymentMethod = text(draft.payment_method);
  const sellerIban = text(seller.iban).toUpperCase().replace(/\s/g, "");
  const paymentMeans = {
    payment_mode: paymentMethod === "card_external" ? "card" : "sepa_credit_transfer",
    due_date: text(row.due_date),
    amount: euros(rowGrossCents),
  };
  if (paymentMeans.payment_mode === "sepa_credit_transfer") {
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(sellerIban)) {
      throw new OpenapiInvoiceError("Za SEPA plačilo manjka veljaven IBAN izdajatelja.", { code: "OPENAPI_SELLER_IBAN_REQUIRED" });
    }
    paymentMeans.financial_account = sellerIban;
  }
  const payload = {
    document_number: documentNumber(row, payloadOptions.sandbox === true),
    issue_date: text(row.issue_date),
    due_date: text(row.due_date),
    currency: "EUR",
    type: "380",
    total_amount_excluding_tax: euros(rowNetCents),
    total_amount_including_tax: euros(rowGrossCents),
    total_tax_amount: euros(rowTaxCents),
    sender: {
      name: text(seller.legalName),
      vat_number: sellerVat,
      email: text(seller.businessEmail),
      address: sellerAddress,
    },
    recipient,
    invoice_lines: invoiceLines,
    tax_subtotals: Array.from(taxGroups.values()),
    payment_means: [paymentMeans],
  };
  if (publicRecipient) {
    if (!recipient.leitweg_id) throw new OpenapiInvoiceError("Za B2G Openapi dostavo manjka Leitweg-ID.", { code: "OPENAPI_LEITWEG_REQUIRED" });
    payload.leitweg_id = recipient.leitweg_id;
    payload.buyer_reference = text(draft.buyer_reference || recipient.leitweg_id);
  } else {
    const pdf = findPdf(deliveryPackage);
    if (!pdf) throw new OpenapiInvoiceError("Za ZUGFeRD dostavo manjka arhivirani PDF.", { code: "OPENAPI_B2B_PDF_REQUIRED" });
    if (!recipient.email) throw new OpenapiInvoiceError("Za B2B Openapi dostavo manjka e-pošta prejemnika.", { code: "OPENAPI_RECIPIENT_EMAIL_REQUIRED" });
    payload.attachments = [{ document: pdf.content.toString("base64"), mime_type: "application/pdf", filename: pdf.filename }];
  }
  return payload;
}

function configurationPayload(invoicePayloadValue, options) {
  const sourceEnv = options && options.env || process.env;
  const state = readiness(sourceEnv);
  const webhookSecret = state.sandboxEnabled
    ? text(sourceEnv.OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET)
    : text(sourceEnv.OPENAPI_INVOICE_WEBHOOK_SECRET);
  const payload = {
    fiscal_id: invoicePayloadValue.sender.vat_number,
    name: invoicePayloadValue.sender.name,
    email: invoicePayloadValue.sender.email,
    customer_invoice: true,
    supplier_invoice: false,
    address: invoicePayloadValue.sender.address,
  };
  if (state.webhookConfigured) {
    payload.api_configurations = [{
      event: "customer-invoice",
      callback: {
        method: "JSON",
        url: state.webhookUrl,
        retry: 5,
        headers: { Authorization: "Bearer " + webhookSecret },
      },
    }];
  }
  return payload;
}

function webhookConfiguration(options) {
  const sourceEnv = options && options.env || process.env;
  const state = readiness(sourceEnv);
  const webhookSecret = state.sandboxEnabled
    ? text(sourceEnv.OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET)
    : text(sourceEnv.OPENAPI_INVOICE_WEBHOOK_SECRET);
  if (!state.webhookConfigured || webhookSecret.length < 32) {
    throw new OpenapiInvoiceError("Openapi webhook ni varno nastavljen.", { code: "OPENAPI_WEBHOOK_NOT_CONFIGURED" });
  }
  return [{
    event: "customer-invoice",
    callback: { method: "JSON", url: state.webhookUrl, retry: 5, headers: { Authorization: "Bearer " + webhookSecret } },
  }];
}

function sameAddress(left, right) {
  const keys = ["street_address", "street_number", "zip_code", "city", "country"];
  return keys.every((key) => text(left && left[key]) === text(right && right[key]));
}

function callbackConfigured(current, desired) {
  const expected = desired && desired[0];
  if (!expected) return true;
  const rows = Array.isArray(current) ? current : [];
  return rows.some((entry) => text(entry && entry.event) === text(expected.event)
    && text(entry && entry.callback && entry.callback.url) === text(expected.callback && expected.callback.url)
    && Number(entry && entry.callback && entry.callback.retry) === Number(expected.callback && expected.callback.retry));
}

function configurationPatch(current, desired) {
  const row = current || {};
  if (text(row.email).toLowerCase() !== text(desired.email).toLowerCase()) {
    throw new OpenapiInvoiceError("E-pošta obstoječe Openapi konfiguracije se ne ujema s podjetjem in je ni varno samodejno spremeniti.", {
      code: "OPENAPI_CONFIGURATION_EMAIL_MISMATCH",
      status: 409,
    });
  }
  const patch = {};
  if (text(row.name) !== text(desired.name)) patch.name = desired.name;
  if (row.customer_invoice !== true) patch.customer_invoice = true;
  if (row.supplier_invoice !== false) patch.supplier_invoice = false;
  if (!sameAddress(row.address, desired.address)) patch.address = desired.address;
  if (desired.api_configurations && !callbackConfigured(row.api_configurations, desired.api_configurations)) {
    patch.api_configurations = desired.api_configurations;
  }
  return Object.keys(patch).length ? patch : null;
}

async function syncConfigurationWebhook(fiscalId, options) {
  const settings = options || {};
  const state = readiness(settings.env);
  if (!state.sandboxEnabled && !(settings.allowProductionConfigurationSync === true && state.configurationUpdateEnabled)) {
    throw new OpenapiInvoiceError("Produkcijska sinhronizacija Openapi konfiguracije ni izrecno odobrena.", {
      code: "OPENAPI_PRODUCTION_CONFIGURATION_SYNC_NOT_APPROVED",
      status: 409,
    });
  }
  const cleanFiscalId = cleanVat(fiscalId);
  if (!/^DE\d{9}$/.test(cleanFiscalId)) {
    throw new OpenapiInvoiceError("Openapi sandbox davčna številka ni veljavna.", { code: "OPENAPI_FISCAL_ID_INVALID" });
  }
  const current = await request("/DE-configurations/" + encodeURIComponent(cleanFiscalId), settings);
  if (!current.response.ok) {
    throw new OpenapiInvoiceError("Openapi konfiguracije za sinhronizacijo ni mogoče prebrati.", { code: "OPENAPI_CONFIGURATION_SYNC_READ_FAILED", status: current.response.status });
  }
  const patched = await request("/DE-configurations/" + encodeURIComponent(cleanFiscalId), Object.assign({}, settings, {
    method: "PATCH",
    body: { api_configurations: webhookConfiguration(settings) },
  }));
  if (!patched.response.ok) {
    throw new OpenapiInvoiceError(rejectedMessage("Openapi callback konfiguracije ni mogoče posodobiti", patched), { code: "OPENAPI_CONFIGURATION_SYNC_FAILED", status: patched.response.status });
  }
  return patched.body && patched.body.data || null;
}

async function fetchConfiguration(fiscalId, options) {
  const cleanFiscalId = cleanVat(fiscalId);
  if (!/^DE\d{9}$/.test(cleanFiscalId)) {
    throw new OpenapiInvoiceError("Openapi sandbox davčna številka ni veljavna.", { code: "OPENAPI_FISCAL_ID_INVALID" });
  }
  const current = await request("/DE-configurations/" + encodeURIComponent(cleanFiscalId), options || {});
  if (!current.response.ok) {
    throw new OpenapiInvoiceError("Openapi konfiguracije ni mogoče prebrati.", {
      code: "OPENAPI_CONFIGURATION_CHECK_FAILED",
      status: current.response.status,
    });
  }
  return current.body && current.body.data || null;
}

async function request(path, options) {
  const settings = options || {};
  const state = readiness(settings.env);
  if (!state.sendEnabled) {
    throw new OpenapiInvoiceError("Openapi Invoice ni varno vključen.", { code: state.configured ? "OPENAPI_DISABLED" : "OPENAPI_NOT_CONFIGURED" });
  }
  let response;
  try {
    response = await (settings.fetch || fetch)(state.baseUrl + path, {
      method: settings.method || "GET",
      headers: { Authorization: "Bearer " + text((settings.env || process.env).OPENAPI_INVOICE_TOKEN), Accept: "application/json", "Content-Type": "application/json" },
      body: settings.body === undefined ? undefined : JSON.stringify(settings.body),
      signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
    });
  } catch (error) {
    throw new OpenapiInvoiceError("Openapi Invoice trenutno ni dosegljiv.", { code: "OPENAPI_NETWORK_ERROR", retryable: true });
  }
  const body = await providerJson.readJson(response, { maxBytes: MAX_RESPONSE_BYTES, code: "OPENAPI_RESPONSE_TOO_LARGE", message: "Openapi je vrnil prevelik odgovor." });
  return { response, body, state };
}

async function fetchInvoice(providerReference, options) {
  const reference = text(providerReference);
  if (!reference || reference.length > 240 || /[\r\n]/.test(reference)) {
    throw new OpenapiInvoiceError("Openapi referenca za usklajevanje ni veljavna.", { code: "OPENAPI_REFERENCE_INVALID" });
  }
  const result = await request("/DE-invoices/" + encodeURIComponent(reference), options);
  if (!result.response.ok) {
    throw new OpenapiInvoiceError(rejectedMessage("Openapi računa za usklajevanje ni mogoče prebrati", result), {
      code: "OPENAPI_RECONCILIATION_READ_FAILED",
      retryable: result.response.status === 429 || result.response.status >= 500,
      status: result.response.status,
    });
  }
  return result.body && result.body.data || null;
}

function reconciliationEvent(entry, nowMs) {
  const providerReference = text(entry && entry.id);
  const state = text(entry && entry.state).toUpperCase();
  const externalStatus = text(entry && entry.details && entry.details.external_status || state).toLowerCase();
  const rawEventAt = text(entry && (entry.updated_at || entry.update_at || entry.create_at));
  const parsed = rawEventAt ? new Date(rawEventAt) : null;
  const currentMs = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  if (!providerReference || providerReference.length > 240 || !["NEW", "SENT", "DONE", "ERROR"].includes(state)
      || externalStatus.length > 120 || (parsed && (Number.isNaN(parsed.getTime())
        || parsed.getTime() > currentMs + MAX_PROVIDER_CLOCK_SKEW_MS))) {
    throw new OpenapiInvoiceError("Openapi je za usklajevanje vrnil neveljavno stanje.", { code: "OPENAPI_RECONCILIATION_STATE_INVALID" });
  }
  return {
    providerReference,
    state,
    externalStatus,
    eventAt: parsed ? parsed.toISOString() : null,
  };
}

function reconciliationSucceeded(event) {
  const state = text(event && event.state).toUpperCase();
  const externalStatus = text(event && event.externalStatus).toLowerCase();
  return state === "DONE" || (state === "SENT" && externalStatus === "succeeded");
}

async function findExisting(payload, options) {
  const query = "?fiscal_id=" + encodeURIComponent(payload.sender.vat_number) + "&document_number=" + encodeURIComponent(payload.document_number) + "&direction=outgoing&limit=1";
  const result = await request("/DE-invoices" + query, options);
  if (!result.response.ok) {
    const status = result.response.status;
    throw new OpenapiInvoiceError("Openapi obstoječega računa ni mogoče varno preveriti.", {
      code: "OPENAPI_IDEMPOTENCY_CHECK_FAILED",
      retryable: status === 408 || status === 425 || status === 429 || status >= 500,
      status,
    });
  }
  const rows = result.body && Array.isArray(result.body.data) ? result.body.data : [];
  return rows.find((entry) => text(entry.document_number) === payload.document_number) || null;
}

async function ensureConfiguration(payload, options) {
  const fiscalId = payload.sender.vat_number;
  const current = await request("/DE-configurations/" + encodeURIComponent(fiscalId), options);
  const desired = configurationPayload(payload, options);
  const state = readiness(options && options.env);
  if (current.response.ok) {
    const currentData = current.body && current.body.data || null;
    const patch = configurationPatch(currentData, desired);
    if (!patch) return currentData;
    if (options && options.requireExistingConfigurationMatch === true) {
      throw new OpenapiInvoiceError("Obstoječa Openapi konfiguracija se razlikuje; sandbox probe je ne sme spreminjati.", {
        code: "OPENAPI_CONFIGURATION_MUTATION_NOT_APPROVED",
        status: 409,
      });
    }
    if (!state.configurationUpdateEnabled) {
      throw new OpenapiInvoiceError("Openapi konfiguracija podjetja se razlikuje, samodejna plačljiva posodobitev pa ni odobrena.", {
        code: "OPENAPI_CONFIGURATION_UPDATE_NOT_APPROVED",
        status: 409,
      });
    }
    const updated = await request("/DE-configurations/" + encodeURIComponent(fiscalId), Object.assign({}, options, { method: "PATCH", body: patch }));
    if (updated.response.ok) return updated.body && updated.body.data || currentData;
    throw new OpenapiInvoiceError(rejectedMessage("Openapi konfiguracije podjetja ni mogoče posodobiti", updated), {
      code: "OPENAPI_CONFIGURATION_UPDATE_REJECTED",
      retryable: updated.response.status === 429 || updated.response.status >= 500,
      status: updated.response.status,
    });
  }
  if (current.response.status !== 404) {
    throw new OpenapiInvoiceError("Openapi konfiguracije podjetja ni mogoče preveriti.", { code: "OPENAPI_CONFIGURATION_CHECK_FAILED", retryable: current.response.status === 429 || current.response.status >= 500, status: current.response.status });
  }
  if (options && options.requireExistingConfigurationMatch === true) {
    throw new OpenapiInvoiceError("Openapi konfiguracija podjetja še ne obstaja; sandbox probe je ne sme ustvariti.", {
      code: "OPENAPI_CONFIGURATION_MUTATION_NOT_APPROVED",
      status: 409,
    });
  }
  if (!state.configurationCreateEnabled) {
    throw new OpenapiInvoiceError("Openapi konfiguracija podjetja še ne obstaja; samodejno plačljivo ustvarjanje ni odobreno.", {
      code: "OPENAPI_CONFIGURATION_CREATE_NOT_APPROVED",
      status: 409,
    });
  }
  const created = await request("/DE-configurations", Object.assign({}, options, { method: "POST", body: desired }));
  const duplicateReason = providerReason(created.body, created.response.status);
  const alreadyRegistered = [400, 409, 422].includes(created.response.status)
    && /fiscal[_\s-]*id\s+is\s+already\s+registered/i.test(duplicateReason);
  if (created.response.ok || alreadyRegistered) return created.body && created.body.data || null;
  throw new OpenapiInvoiceError(rejectedMessage("Openapi ni sprejel konfiguracije podjetja", created), { code: "OPENAPI_CONFIGURATION_REJECTED", retryable: created.response.status === 429 || created.response.status >= 500, status: created.response.status });
}

function acceptedResult(entry, sandbox) {
  const state = text(entry && entry.state).toUpperCase();
  const externalStatus = text(entry && entry.details && entry.details.external_status).toLowerCase();
  if (state === "ERROR") throw new OpenapiInvoiceError("Openapi je račun označil kot neuspešen.", { code: "OPENAPI_REMOTE_ERROR" });
  if (!["NEW", "SENT", "DONE"].includes(state)) {
    throw new OpenapiInvoiceError("Openapi je vrnil neznano stanje računa.", { code: "OPENAPI_REMOTE_STATE_INVALID" });
  }
  const id = text(entry && entry.id);
  if (!id) throw new OpenapiInvoiceError("Openapi ni vrnil oznake računa.", { code: "OPENAPI_REFERENCE_MISSING" });
  const delivered = reconciliationSucceeded({ state, externalStatus });
  return { provider: "openapi", providerReference: id, status: sandbox ? "test_completed" : "sent", sent: !sandbox, delivered, remoteState: state || "NEW", externalStatus, testMode: sandbox };
}

function sandboxFinancialAdjustmentProbeAllowed(state, options) {
  const settings = options || {};
  const env = settings.env || process.env;
  return settings.allowSandboxFinancialAdjustmentProbe === true
    && settings.sandboxWebhookPreflightConfirmed === true
    && state.sandboxEnabled === true
    && state.liveEnabled === false
    && state.baseUrl === SANDBOX_BASE
    && state.webhookConfigured === true
    && text(env.OPENAPI_INVOICE_SANDBOX_SMOKE_CONFIRMED).toLowerCase() === "true"
    && text(env.OPENAPI_INVOICE_SANDBOX_381_PROBE_CONFIRMED).toLowerCase() === "true";
}

function provider(options) {
  const settings = options || {};
  const state = readiness(settings.env);
  if (!state.sendEnabled) throw new OpenapiInvoiceError("Openapi Invoice ni vključen.", { code: "OPENAPI_NOT_ENABLED" });
  return {
    name: "openapi",
    async deliver(deliveryPackage) {
      const delivery = deliveryPackage && deliveryPackage.delivery;
      if (!delivery || delivery.provider !== "openapi" || Boolean(delivery.is_test) !== Boolean(state.sandboxEnabled)) {
        throw new OpenapiInvoiceError("Način Openapi dostave se ne ujema z računom.", { code: "OPENAPI_MODE_MISMATCH" });
      }
      if (deliveryPackage && deliveryPackage.adjustment && !state.financialAdjustmentsEnabled && !sandboxFinancialAdjustmentProbeAllowed(state, settings)) {
        throw new OpenapiInvoiceError("Openapi tip 381 je v sandboxu dovoljen samo v izrecno potrjenem nadzorovanem preizkusu; produkcija zahteva vse produkcijske varovalke.", {
          code: "OPENAPI_DE_381_PROVIDER_CONFLICT",
          status: 409,
        });
      }
      const payload = invoicePayload(deliveryPackage, { sandbox: state.sandboxEnabled, env: settings.env });
      const existing = await findExisting(payload, settings);
      if (existing) return acceptedResult(existing, state.sandboxEnabled);
      await ensureConfiguration(payload, settings);
      let result;
      try {
        result = await request("/DE-invoices", Object.assign({}, settings, { method: "POST", body: payload }));
      } catch (error) {
        const reconciled = await findExisting(payload, settings).catch(function () { return null; });
        if (reconciled) return acceptedResult(reconciled, state.sandboxEnabled);
        throw error;
      }
      if (!result.response.ok) {
        const reconciled = await findExisting(payload, settings).catch(function () { return null; });
        if (reconciled) return acceptedResult(reconciled, state.sandboxEnabled);
        const retryable = result.response.status === 408 || result.response.status === 425 || result.response.status === 429 || result.response.status >= 500;
        throw new OpenapiInvoiceError(rejectedMessage(retryable ? "Openapi je začasno zavrnil račun" : "Openapi ni sprejel podatkov računa", result), { code: "OPENAPI_HTTP_" + result.response.status, retryable, status: result.response.status });
      }
      return acceptedResult(result.body && result.body.data, state.sandboxEnabled);
    },
  };
}

module.exports = {
  MAX_PROVIDER_CLOCK_SKEW_MS,
  MAX_RESPONSE_BYTES,
  OpenapiInvoiceError,
  PRODUCTION_BASE,
  SANDBOX_BASE,
  acceptedResult,
  address,
  adjustmentPayload,
  berlinDate,
  configurationPatch,
  configurationPayload,
  costModel,
  documentNumber,
  ensureConfiguration,
  fetchConfiguration,
  fetchInvoice,
  findExisting,
  financialAdjustmentPackage,
  invoicePayload,
  providerReason,
  provider,
  readiness,
  reconciliationEvent,
  reconciliationSucceeded,
  sandboxFinancialAdjustmentProbeAllowed,
  syncConfigurationWebhook,
  unitCode,
  usageSummary,
  validDate,
  validEmail,
  webhookConfiguration,
};
