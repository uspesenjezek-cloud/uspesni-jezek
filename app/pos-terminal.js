(function (global) {
  "use strict";

  var STORAGE_KEY = "uj-pos-terminal-v1";
  var DATE_LOCALE = "de-DE";
  var CURRENCY = "EUR";
  var MAX_BANK_IMPORT_BYTES = 5 * 1024 * 1024;

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

  function validateRefundAmountInput(value, refundableCents) {
    var amountCents = parseMoneyToCents(value);
    var maximumCents = Math.max(0, integer(refundableCents, 0));
    if (amountCents <= 0) return { amountCents: amountCents, error: "Vnesite znesek povračila, večji od 0 €." };
    if (amountCents > maximumCents) return { amountCents: amountCents, error: "Najvišje možno TEST povračilo je " + formatMoney(maximumCents) + "." };
    return { amountCents: amountCents, error: "" };
  }

  function formatDecimalMilli(milli) {
    return new Intl.NumberFormat(DATE_LOCALE, { maximumFractionDigits: 3 }).format(milli / 1000);
  }

  function isoToday(now) {
    var value = now == null ? new Date() : new Date(now);
    if (Number.isNaN(value.getTime())) value = new Date();
    return berlinDateKey(value) || value.toISOString().slice(0, 10);
  }

  function addDays(iso, days) {
    var value = String(iso || isoToday());
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    var date = match ? new Date(Date.UTC(integer(match[1]), integer(match[2]) - 1, integer(match[3]))) : null;
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) date = new Date(isoToday() + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + integer(days, 0));
    return date.toISOString().slice(0, 10);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    var date = new Date(iso + "T12:00:00");
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(DATE_LOCALE).format(date);
  }

  function formatGermanTimestampDate(iso) {
    if (!iso) return "—";
    var date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(DATE_LOCALE, { timeZone: "Europe/Berlin" }).format(date);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

  function defaultProfile(now) {
    var businessYear = isoToday(now).slice(0, 4);
    return {
      legalName: "",
      legalForm: "",
      representative: "",
      companySeat: "",
      registerCourt: "",
      registerNumber: "",
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
      invoicePrefix: "RE-" + businessYear + "-",
      defaultDueDays: "14",
      legalConfirmed: false,
      datevSettings: defaultDatevSettings("03")
    };
  }

  function defaultDatevSettings(framework) {
    var skr = String(framework || "03") === "04" ? "04" : "03";
    return {
      framework: skr,
      adviserNumber: "",
      clientNumber: "",
      fiscalYearStart: "01-01",
      accountLength: "4",
      initials: "UJ",
      receivableAccount: skr === "04" ? "1210" : "1410",
      revenue19Account: skr === "04" ? "4400" : "8400",
      revenue7Account: skr === "04" ? "4300" : "8300",
      smallBusinessAccount: skr === "04" ? "4195" : "8195",
      reverseChargeAccount: skr === "04" ? "4337" : "8337",
      confirmed: false
    };
  }

  function normalizeDatevSettings(value) {
    var input = value && typeof value === "object" ? value : {};
    var defaults = defaultDatevSettings(input.framework);
    return {
      framework: String(input.framework || defaults.framework) === "04" ? "04" : "03",
      adviserNumber: String(input.adviserNumber || input.adviser_number || "").replace(/\D/g, "").slice(0, 7),
      clientNumber: String(input.clientNumber || input.client_number || "").replace(/\D/g, "").slice(0, 5),
      fiscalYearStart: String(input.fiscalYearStart || input.fiscal_year_start || defaults.fiscalYearStart),
      accountLength: String(clamp(integer(input.accountLength || input.account_length, 4), 4, 8)),
      initials: String(input.initials || defaults.initials).replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4),
      receivableAccount: String(input.receivableAccount || input.receivable_account || defaults.receivableAccount).replace(/\D/g, "").slice(0, 9),
      revenue19Account: String(input.revenue19Account || input.revenue_19_account || defaults.revenue19Account).replace(/\D/g, "").slice(0, 9),
      revenue7Account: String(input.revenue7Account || input.revenue_7_account || defaults.revenue7Account).replace(/\D/g, "").slice(0, 9),
      smallBusinessAccount: String(input.smallBusinessAccount || input.small_business_account || defaults.smallBusinessAccount).replace(/\D/g, "").slice(0, 9),
      reverseChargeAccount: String(input.reverseChargeAccount || input.reverse_charge_account || defaults.reverseChargeAccount).replace(/\D/g, "").slice(0, 9),
      confirmed: Boolean(input.confirmed)
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
      propertyRelated: false,
      handwerker35a: false,
      constructionWithholding: false,
      exemptionCertificate: "unknown",
      dueDays: String(profile && profile.defaultDueDays || 14),
      paymentMethod: "sepa",
      consumerDefaultNotice: false,
      consumerContractContext: "unknown",
      urgentRepairScope: "",
      einvoiceValidated: false,
      finalConfirmed: false,
      replacementContext: null,
      workflowMode: "invoice",
      offerValidDays: "14",
      workflowContext: null
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
      company_seat: String(profile.companySeat || "").trim(),
      register_court: String(profile.registerCourt || "").trim(),
      register_number: String(profile.registerNumber || "").trim(),
      street: String(profile.street || "").trim(),
      postal_code: String(profile.postalCode || "").trim(),
      city: String(profile.city || "").trim(),
      business_email: String(profile.businessEmail || "").trim(),
      business_phone: String(profile.businessPhone || "").trim(),
      tax_status: profile.taxStatus === "small_business" ? "small_business" : "regular",
      tax_number: String(profile.taxNumber || "").trim(),
      vat_id: cleanVatId(profile.vatId),
      previous_year_turnover_band: ["lte_800k", "gt_800k"].indexOf(profile.previousYearTurnoverBand) !== -1 ? profile.previousYearTurnoverBand : "unknown",
      account_holder: String(profile.accountHolder || "").trim(),
      iban: cleanIban(profile.iban),
      invoice_prefix: String(profile.invoicePrefix || "").trim(),
      default_due_days: clamp(integer(profile.defaultDueDays, 14), 0, 365),
      legal_confirmed: Boolean(profile.legalConfirmed),
      datev_settings: normalizeDatevSettings(profile.datevSettings)
    };
  }

  function profileFromDatabase(row) {
    if (!row) return defaultProfile();
    return Object.assign(defaultProfile(), {
      legalName: row.legal_name,
      legalForm: row.legal_form,
      representative: row.representative,
      companySeat: row.company_seat,
      registerCourt: row.register_court,
      registerNumber: row.register_number,
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
      legalConfirmed: Boolean(row.legal_confirmed),
      datevSettings: normalizeDatevSettings(row.datev_settings)
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
      customer_vat_id: cleanVatId(draft.customerVatId),
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
      property_related: Boolean(draft.propertyRelated),
      handwerker_35a: Boolean(draft.handwerker35a),
      construction_withholding: Boolean(draft.constructionWithholding),
      exemption_certificate: draft.exemptionCertificate,
      due_days: clamp(integer(draft.dueDays, 14), 0, 365),
      payment_method: draft.paymentMethod,
      consumer_default_notice: Boolean(draft.consumerDefaultNotice),
      consumer_contract_context: draft.customerType === "private"
        ? (["business_premises", "distance", "off_premises", "urgent_repair"].indexOf(draft.consumerContractContext) !== -1 ? draft.consumerContractContext : "unknown")
        : "not_applicable",
      urgent_repair_scope: draft.customerType === "private" && draft.consumerContractContext === "urgent_repair"
        ? String(draft.urgentRepairScope || "").trim()
        : "",
      replacement_context: replacement ? {
        original_invoice_id: replacement.originalInvoiceId,
        original_invoice_number: replacement.originalInvoiceNumber,
        cancellation_adjustment_id: replacement.cancellationAdjustmentId,
        cancellation_number: replacement.cancellationNumber
      } : null,
      workflow_context: draft.workflowContext && draft.workflowContext.workOrderId ? {
        work_order_id: String(draft.workflowContext.workOrderId),
        offer_number: String(draft.workflowContext.offerNumber || ""),
        order_number: String(draft.workflowContext.orderNumber || ""),
        invoice_kind: draft.workflowContext.invoiceKind === "progress" ? "progress" : "final",
        progress_percent: draft.workflowContext.invoiceKind === "progress" ? integer(draft.workflowContext.progressPercent, 0) : null,
        final_deductions: draft.workflowContext.invoiceKind === "final" ? normalizeFinalDeductions(draft.workflowContext.finalDeductions).map(function (entry) {
          return {
            invoice_id: entry.invoiceId,
            invoice_number: entry.invoiceNumber,
            issue_date: entry.issueDate,
            net_cents: entry.netCents,
            tax_cents: entry.taxCents,
            gross_cents: entry.grossCents
          };
        }) : []
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
      propertyRelated: Boolean(source.property_related),
      handwerker35a: Boolean(source.handwerker_35a),
      constructionWithholding: Boolean(source.construction_withholding),
      exemptionCertificate: source.exemption_certificate,
      dueDays: String(source.due_days == null ? 14 : source.due_days),
      paymentMethod: source.payment_method,
      consumerDefaultNotice: Boolean(source.consumer_default_notice),
      consumerContractContext: source.consumer_contract_context || "unknown",
      urgentRepairScope: source.urgent_repair_scope || "",
      finalConfirmed: Boolean(issued),
      replacementContext: normalizeReplacementContext(source),
      workflowMode: "invoice",
      offerValidDays: "14",
      workflowContext: source.workflow_context ? {
        workOrderId: source.workflow_context.work_order_id || "",
        offerNumber: source.workflow_context.offer_number || "",
        orderNumber: source.workflow_context.order_number || "",
        invoiceKind: source.workflow_context.invoice_kind === "progress" ? "progress" : "final",
        progressPercent: integer(source.workflow_context.progress_percent, 0),
        finalDeductions: normalizeFinalDeductions(source.workflow_context.final_deductions)
      } : null
    });
  }

  function workOrderPayloadFromDraft(draft) {
    var payload = draftToDatabasePayload(draft);
    payload.valid_until = addDays(draft.issueDate || isoToday(), clamp(integer(draft.offerValidDays, 14), 1, 180));
    return payload;
  }

  function workOrderFromServer(row, links, acceptance, cancellation, earlyStart, withdrawal, contractDocument, contractDelivery, withdrawalSettlement, withdrawalRefunds) {
    return {
      id: row.id,
      offerNumber: row.offer_number,
      orderNumber: row.order_number || "",
      status: row.status,
      title: row.title,
      customerName: row.customer_name,
      customerEmail: row.customer_email || "",
      validUntil: row.valid_until,
      netCents: integer(row.net_cents, 0),
      taxCents: integer(row.tax_cents, 0),
      grossCents: integer(row.gross_cents, 0),
      payload: row.payload || {},
      lockedPayload: row.locked_payload || null,
      offeredAt: row.offered_at || null,
      acceptedAt: row.accepted_at || null,
      acceptedOn: row.accepted_on || acceptance && acceptance.accepted_on || "",
      startedAt: row.started_at || null,
      completedAt: row.completed_at || null,
      cancelledAt: row.cancelled_at || null,
      withdrawnAt: row.withdrawn_at || null,
      acceptanceEvidence: acceptance && acceptance.evidence || "",
      acceptanceOfferSha256: acceptance && acceptance.offer_sha256 || "",
      cancellationReason: cancellation && cancellation.reason || "",
      cancellationStatusBefore: cancellation && cancellation.status_before || "",
      earlyStartEvidence: earlyStart && earlyStart.evidence || "",
      earlyStartRecordedAt: earlyStart && earlyStart.recorded_at || "",
      valueCompensationInformed: Boolean(earlyStart && earlyStart.value_compensation_informed),
      rightExpiryAcknowledged: Boolean(earlyStart && earlyStart.right_expiry_acknowledged),
      earlyStartRequestOnDurableMedium: Boolean(earlyStart && earlyStart.request_on_durable_medium),
      withdrawalDeclaredOn: withdrawal && withdrawal.declared_on || "",
      withdrawalEvidence: withdrawal && withdrawal.evidence || "",
      withdrawalStatusBefore: withdrawal && withdrawal.status_before || "",
      withdrawalReceivedAt: withdrawal && withdrawal.received_at || "",
      valueCompensationReviewRequired: Boolean(withdrawal && withdrawal.value_compensation_review_required),
      contractConfirmationDocumentId: contractDocument && contractDocument.id || "",
      contractConfirmationSha256: contractDocument && contractDocument.sha256 || "",
      contractConfirmationCreatedAt: contractDocument && contractDocument.created_at || "",
      contractConfirmationDeliveryChannel: contractDelivery && contractDelivery.channel || "",
      contractConfirmationDeliveryRecipient: contractDelivery && contractDelivery.recipient || "",
      contractConfirmationDeliveryEvidence: contractDelivery && contractDelivery.evidence || "",
      contractConfirmationDeliveredOn: contractDelivery && contractDelivery.delivered_on || "",
      contractConfirmationElectronicConsent: contractDelivery && contractDelivery.electronic_consent_evidence || "",
      withdrawalSettlementId: withdrawalSettlement && withdrawalSettlement.id || "",
      withdrawalGrossReceivedCents: integer(withdrawalSettlement && withdrawalSettlement.gross_received_cents, 0),
      withdrawalAlreadyRefundedCents: integer(withdrawalSettlement && withdrawalSettlement.already_refunded_cents, 0),
      withdrawalRetainedPaymentCents: integer(withdrawalSettlement && withdrawalSettlement.retained_payment_cents, 0),
      withdrawalValueCompensationCents: integer(withdrawalSettlement && withdrawalSettlement.value_compensation_cents, 0),
      withdrawalRefundDueCents: integer(withdrawalSettlement && withdrawalSettlement.refund_due_cents, 0),
      withdrawalConsumerBalanceReviewCents: integer(withdrawalSettlement && withdrawalSettlement.consumer_balance_review_cents, 0),
      withdrawalRefundMethod: withdrawalSettlement && withdrawalSettlement.refund_method || "",
      withdrawalRefundDueOn: withdrawalSettlement && withdrawalSettlement.refund_due_on || "",
      withdrawalSettlementAssessedAt: withdrawalSettlement && withdrawalSettlement.assessed_at || "",
      withdrawalRefundRecords: withdrawalRefunds || [],
      updatedAt: row.updated_at,
      invoiceLinks: links || []
    };
  }

  function normalizeFinalDeductions(value) {
    return (Array.isArray(value) ? value : []).map(function (entry) {
      var source = entry || {};
      return {
        invoiceId: String(source.invoiceId || source.invoice_id || ""),
        invoiceNumber: String(source.invoiceNumber || source.invoice_number || ""),
        issueDate: String(source.issueDate || source.issue_date || ""),
        netCents: Math.max(0, integer(source.netCents == null ? source.net_cents : source.netCents, 0)),
        taxCents: Math.max(0, integer(source.taxCents == null ? source.tax_cents : source.taxCents, 0)),
        grossCents: Math.max(0, integer(source.grossCents == null ? source.gross_cents : source.grossCents, 0))
      };
    }).filter(function (entry) { return entry.invoiceId && entry.grossCents > 0; });
  }

  function workOrderFinalState(workOrder, targetIsTest) {
    var progressLinks = (workOrder && workOrder.invoiceLinks || []).filter(function (link) {
      return link.invoice_kind === "progress" && !(link.invoice && link.invoice.status === "cancelled");
    });
    var deductions = progressLinks.map(function (link) {
      var invoice = link.invoice || null;
      var totals = invoice && invoice.totals || {};
      return {
        invoiceId: String(link.invoice_id || invoice && invoice.id || ""),
        invoiceNumber: String(link.invoice_number || invoice && invoice.number || ""),
        issueDate: String(link.issue_date || invoice && invoice.draft && invoice.draft.issueDate || ""),
        netCents: integer(link.net_cents == null ? totals.netCents : link.net_cents, 0),
        taxCents: integer(link.tax_cents == null ? totals.taxCents : link.tax_cents, 0),
        grossCents: integer(link.gross_cents == null ? totals.grossCents : link.gross_cents, 0),
        paidCents: integer(link.paid_cents == null ? invoice && invoice.paidCents : link.paid_cents, 0),
        cancelled: Boolean(invoice && invoice.status === "cancelled"),
        testMismatch: typeof targetIsTest === "boolean" && invoice ? Boolean(invoice.isTest) !== targetIsTest : false
      };
    });
    var blocked = deductions.some(function (entry) {
      return entry.cancelled || entry.testMismatch || entry.grossCents <= 0 || entry.paidCents < entry.grossCents;
    });
    return {
      progressLinks: progressLinks,
      deductions: normalizeFinalDeductions(deductions),
      blocked: blocked,
      progressPercent: progressLinks.reduce(function (sum, link) { return sum + integer(link.progress_percent, 0); }, 0)
    };
  }

  function requiresEarlyStartEvidence(order, now) {
    var source = order && (order.lockedPayload || order.payload) || {};
    if (source.customer_type !== "private") return false;
    var context = source.consumer_contract_context;
    if (context === "urgent_repair") return true;
    if (["distance", "off_premises"].indexOf(context) === -1 || !(order.acceptedOn || order.acceptedAt)) return false;
    var acceptedDay = order.acceptedOn || berlinDateKey(order.acceptedAt);
    var currentDay = berlinDateKey(now || new Date());
    return Boolean(acceptedDay && currentDay && currentDay <= addDays(acceptedDay, 14));
  }

  function requiresContractConfirmation(order) {
    var source = order && (order.lockedPayload || order.payload) || {};
    return source.customer_type === "private" && ["distance", "off_premises", "urgent_repair"].indexOf(source.consumer_contract_context) !== -1;
  }

  function consumerServiceRightExpired(order) {
    var source = order && (order.lockedPayload || order.payload) || {};
    if (!order || !order.completedAt || source.customer_type !== "private" || ["distance", "off_premises"].indexOf(source.consumer_contract_context) === -1) return false;
    return Boolean(
      order.valueCompensationInformed
      && order.rightExpiryAcknowledged
      && (source.consumer_contract_context !== "off_premises" || order.earlyStartRequestOnDurableMedium)
    );
  }

  function consumerWithdrawalAvailable(order, now) {
    var source = order && (order.lockedPayload || order.payload) || {};
    if (!order || source.customer_type !== "private" || ["distance", "off_premises"].indexOf(source.consumer_contract_context) === -1) return false;
    if (["accepted", "in_progress", "completed", "invoiced"].indexOf(order.status) === -1 || consumerServiceRightExpired(order)) return false;
    var acceptedOn = order.acceptedOn || berlinDateKey(order.acceptedAt);
    var today = berlinDateKey(now || new Date());
    return Boolean(acceptedOn && today && today <= addDays(acceptedOn, 14));
  }

  function withdrawalTaxCorrectionState(order) {
    if (!order || order.status !== "withdrawn" || !order.withdrawalSettlementId) return { required: false, kind: "none", invoice: null, reductionCents: 0 };
    var activeInvoices = (order.invoiceLinks || []).map(function (link) { return link && link.invoice; }).filter(function (invoice) {
      return invoice && invoice.status !== "cancelled";
    });
    var activeGross = activeInvoices.reduce(function (sum, invoice) {
      var credited = (invoice.adjustments || []).filter(function (entry) { return entry.type === "credit_note"; })
        .reduce(function (amount, entry) { return amount + integer(entry.deltaGrossCents, 0); }, 0);
      return sum + Math.max(0, integer(invoice.totals && invoice.totals.grossCents, 0) + credited);
    }, 0);
    var reduction = Math.max(0, activeGross - integer(order.withdrawalValueCompensationCents, 0));
    if (!activeInvoices.length || !reduction) return { required: false, kind: "none", invoice: null, reductionCents: 0 };
    if (!order.withdrawalValueCompensationCents) {
      return { required: true, kind: "full_cancellation", invoice: activeInvoices[0], reductionCents: reduction };
    }
    return { required: true, kind: "partial_correction", invoice: activeInvoices[0], reductionCents: reduction };
  }

  function createWithdrawalTaxCredit(order) {
    var correction = withdrawalTaxCorrectionState(order);
    if (!order || correction.kind !== "partial_correction" || !backend.client || !backend.ready) {
      showToast("Davčni dobropis trenutno ni potreben ali varna hramba ni povezana.");
      return;
    }
    openDialog("Izdati delni davčni dobropis?", "POS bo iz zaklenjenih postavk računov sam izračunal neto in DDV za zmanjšanje " + formatMoney(correction.reductionCents) + ". Priznani Wertersatz " + formatMoney(order.withdrawalValueCompensationCents) + " ostane obdavčljiv. Dobropis bo nespremenljiv in ne bo sprožil vračila denarja.", {
      confirmText: "Izdaj dobropis",
      onConfirm: async function () {
        try {
          var result = await backend.client.rpc("pos_create_withdrawal_tax_credit_notes", {
            p_work_order_id: order.id,
            p_confirmed: true
          });
          if (result.error) throw result.error;
          var adjustments = (result.data || []).map(function (row) { return adjustmentFromServer(row, {}); });
          var documentsReady = true;
          for (var index = 0; index < adjustments.length; index += 1) {
            try { await ensureAdjustmentDocument(adjustments[index]); }
            catch (_pdfError) { documentsReady = false; }
          }
          await loadServerState("invoices");
          showView("work-orders");
          showToast(documentsReady
            ? "Davčni dobropis in PDF sta nespremenljivo izdana; denar ni bil premaknjen."
            : "Davčni dobropis je izdan; PDF se varno pripravi ob prenosu.");
        } catch (error) {
          showToast(error && error.message || "Davčnega dobropisa ni bilo mogoče izdati.");
        }
      }
    });
  }

  function workOrderActions(orderOrStatus) {
    var order = orderOrStatus && typeof orderOrStatus === "object" ? orderOrStatus : null;
    var status = order ? order.status : orderOrStatus;
    var source = order && (order.lockedPayload || order.payload) || {};
    var consumerWithdrawal = order && consumerWithdrawalAvailable(order);
    if (status === "draft") return ["edit", "offer", "cancel"];
    if (status === "offered") return ["pdf", "accept", "cancel"];
    var confirmation = order && requiresContractConfirmation(order);
    var confirmationActions = confirmation ? ["contract_pdf"].concat(order.contractConfirmationDeliveryEvidence ? [] : ["contract_delivery"]) : [];
    if (status === "accepted") return ["pdf"].concat(confirmationActions, ["start", "progress"], consumerWithdrawal ? ["withdraw"] : []);
    if (status === "in_progress") return ["pdf"].concat(confirmationActions, ["complete", "progress"], consumerWithdrawal ? ["withdraw"] : []);
    if (status === "completed") return ["pdf"].concat(confirmationActions, ["final", "progress"], consumerWithdrawal ? ["withdraw"] : []);
    if (status === "invoiced") return ["pdf"].concat(confirmationActions, consumerWithdrawal ? ["withdraw"] : []);
    if (status === "cancelled" && order && order.offeredAt) return ["pdf"];
    if (status === "withdrawn") {
      var refundRecorded = order ? (order.withdrawalRefundRecords || []).reduce(function (sum, entry) { return sum + integer(entry.amount_cents, 0); }, 0) : 0;
      var taxCorrection = withdrawalTaxCorrectionState(order);
      var settlementActions = order && !order.withdrawalSettlementId ? ["withdrawal_settlement"]
        : order && refundRecorded < order.withdrawalRefundDueCents ? ["withdrawal_refund"] : [];
      var taxActions = taxCorrection.kind === "full_cancellation" ? ["withdrawal_tax_correction"]
        : taxCorrection.kind === "partial_correction" ? ["withdrawal_tax_credit"] : [];
      return ["pdf"].concat(confirmationActions, settlementActions, taxActions);
    }
    return [];
  }

  function prepareWorkOrderInvoiceDraft(workOrder, profile, invoiceKind, progressPercent) {
    if (!workOrder || ["accepted", "in_progress", "completed"].indexOf(workOrder.status) === -1) return null;
    var kind = invoiceKind === "progress" ? "progress" : "final";
    if (kind === "final" && workOrder.status !== "completed") return null;
    var finalState = workOrderFinalState(workOrder, !profileReadiness(profile).live);
    if (kind === "final" && finalState.blocked) return null;
    var percent = kind === "progress" ? clamp(integer(progressPercent, 0), 1, 99) : 100;
    var source = draftFromDatabasePayload(workOrder.lockedPayload || workOrder.payload, false);
    var draft = Object.assign(defaultDraft(profile), source, {
      id: uid("draft"), serverId: null, createdAt: new Date().toISOString(),
      issueDate: isoToday(), serviceDate: isoToday(), finalConfirmed: false, einvoiceValidated: false,
      workflowMode: "invoice",
      workflowContext: {
        workOrderId: workOrder.id,
        offerNumber: workOrder.offerNumber,
        orderNumber: workOrder.orderNumber,
        invoiceKind: kind,
        progressPercent: kind === "progress" ? percent : 0,
        finalDeductions: kind === "final" ? finalState.deductions : []
      }
    });
    if (kind === "progress") {
      draft.items = (source.items || []).map(function (item) {
        var cents = Math.round(parseMoneyToCents(item.unitPrice) * percent / 100);
        return Object.assign({}, item, {
          id: uid("item"),
          description: "Abschlag " + percent + " % · " + String(item.description || "Leistung"),
          unitPrice: (cents / 100).toFixed(2).replace(".", ",")
        });
      });
      draft.workDescription = "Abschlagsrechnung über " + percent + " % gemäß dokumentiertem Leistungsstand zu " + workOrder.orderNumber + ".";
    } else {
      draft.items = (source.items || []).map(function (item) { return Object.assign({}, item, { id: uid("item") }); });
      draft.workDescription = "Schlussrechnung zu " + workOrder.orderNumber + (finalState.deductions.length ? " unter Abzug der vereinnahmten Abschlagszahlungen." : ".");
    }
    if (!draft.items.length) draft.items = [defaultItem()];
    return draft;
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
    totals.serviceNetCents = totals.netCents;
    totals.serviceTaxCents = totals.taxCents;
    totals.serviceGrossCents = totals.grossCents;
    var deductions = normalizeFinalDeductions(draft && draft.workflowContext && draft.workflowContext.finalDeductions);
    totals.deductions = deductions;
    totals.deductionNetCents = deductions.reduce(function (sum, entry) { return sum + entry.netCents; }, 0);
    totals.deductionTaxCents = deductions.reduce(function (sum, entry) { return sum + entry.taxCents; }, 0);
    totals.deductionGrossCents = deductions.reduce(function (sum, entry) { return sum + entry.grossCents; }, 0);
    if (deductions.length) {
      totals.netCents = Math.max(0, totals.serviceNetCents - totals.deductionNetCents);
      totals.taxCents = Math.max(0, totals.serviceTaxCents - totals.deductionTaxCents);
      totals.grossCents = Math.max(0, totals.serviceGrossCents - totals.deductionGrossCents);
      totals.eligible35aCents = Math.max(0, Math.round(totals.eligible35aCents * totals.grossCents / Math.max(1, totals.serviceGrossCents)));
    }
    return totals;
  }

  function cleanIban(value) {
    return String(value || "").replace(/\s/g, "").toUpperCase();
  }

  function validIban(value) {
    var iban = cleanIban(value);
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
    var rearranged = iban.slice(4) + iban.slice(0, 4);
    var remainder = 0;
    for (var index = 0; index < rearranged.length; index += 1) {
      var character = rearranged[index];
      var digits = /[0-9]/.test(character) ? character : String(character.charCodeAt(0) - 55);
      for (var digitIndex = 0; digitIndex < digits.length; digitIndex += 1) {
        remainder = (remainder * 10 + Number(digits[digitIndex])) % 97;
      }
    }
    return remainder === 1;
  }

  function cleanVatId(value) {
    return String(value || "").replace(/[\s-]/g, "").toUpperCase();
  }

  function validGermanTaxNumber(value) {
    var text = String(value || "").trim();
    var digits = text.replace(/[^0-9]/g, "");
    return /^[0-9 /-]+$/.test(text) && [10, 11, 13].indexOf(digits.length) !== -1;
  }

  function profileValidationError(profile) {
    function present(value) { return Boolean(String(value || "").trim()); }
    var supportedForms = ["Einzelunternehmen", "e.K.", "GbR", "eGbR", "UG (haftungsbeschränkt)", "GmbH"];
    var registeredForms = ["e.K.", "eGbR", "UG (haftungsbeschränkt)", "GmbH"];
    if (present(profile.postalCode) && !/^[0-9]{5}$/.test(String(profile.postalCode).trim())) return "PLZ mora imeti točno 5 številk.";
    if (present(profile.businessEmail) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(profile.businessEmail).trim())) return "Poslovni e-poštni naslov ni veljaven.";
    if (present(profile.businessPhone) && !/^\+?[0-9][0-9 ()/.-]{5,59}$/.test(String(profile.businessPhone).trim())) return "Poslovni telefon ni veljaven.";
    if (present(profile.taxNumber) && !validGermanTaxNumber(profile.taxNumber)) return "Steuernummer mora ustrezati nemškemu 10-, 11- ali 13-mestnemu formatu.";
    if (present(profile.vatId) && !/^DE[0-9]{9}$/.test(cleanVatId(profile.vatId))) return "USt-IdNr. mora biti DE in 9 številk.";
    if (present(profile.iban) && !validIban(profile.iban)) return "IBAN ni veljaven; preverite številko in kontrolni mesti.";
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(String(profile.invoicePrefix || ""))) return "Predpona računa lahko vsebuje le črke, številke, piko, vezaj, podčrtaj ali /.";
    if (profile.legalConfirmed && supportedForms.indexOf(String(profile.legalForm || "")) === -1) return "Za produkcijo izberite podprto nemško pravno obliko podjetja.";
    if (profile.legalConfirmed && !present(profile.representative)) return "Vnesite vse lastnike, družbenike ali zastopnike, ki morajo biti navedeni na poslovnih dokumentih.";
    if (profile.legalConfirmed && registeredForms.indexOf(profile.legalForm) !== -1 && ![profile.companySeat, profile.registerCourt, profile.registerNumber].every(present)) return "Za registrirano pravno obliko vnesite sedež, registrsko sodišče in registrsko številko.";
    if (profile.legalConfirmed && ![profile.legalName, profile.street, profile.postalCode, profile.city, profile.accountHolder, profile.iban].every(present)) return "Pred potrditvijo izpolnite vse obvezne podatke podjetja in plačila.";
    if (profile.legalConfirmed && !present(profile.taxNumber) && !present(profile.vatId)) return "Pred potrditvijo vnesite Steuernummer ali USt-IdNr.";
    return "";
  }

  function profileChangeRequiresConfirmation(fieldName) {
    return [
      "legalName", "legalForm", "representative", "companySeat", "registerCourt", "registerNumber", "street", "postalCode", "city",
      "businessEmail", "businessPhone", "taxStatus", "taxNumber", "vatId",
      "previousYearTurnoverBand", "accountHolder", "iban"
    ].indexOf(String(fieldName || "")) !== -1;
  }

  function profileReadiness(profile) {
    function present(value) { return Boolean(String(value || "").trim()); }
    var supportedForms = ["Einzelunternehmen", "e.K.", "GbR", "eGbR", "UG (haftungsbeschränkt)", "GmbH"];
    var registeredForms = ["e.K.", "eGbR", "UG (haftungsbeschränkt)", "GmbH"];
    var legalFormReady = supportedForms.indexOf(String(profile.legalForm || "")) !== -1
      && present(profile.representative)
      && (registeredForms.indexOf(profile.legalForm) === -1 || [profile.companySeat, profile.registerCourt, profile.registerNumber].every(present));
    var checks = [
      { key: "identity", label: "Pravna oblika in obvezni registrski podatki", done: [profile.legalName, profile.street, profile.postalCode, profile.city].every(present) && /^[0-9]{5}$/.test(String(profile.postalCode || "").trim()) && legalFormReady },
      { key: "tax", label: "Davčna številka", done: Boolean((present(profile.taxNumber) && validGermanTaxNumber(profile.taxNumber)) || (present(profile.vatId) && /^DE[0-9]{9}$/.test(cleanVatId(profile.vatId)))) },
      { key: "bank", label: "IBAN in imetnik računa", done: Boolean(validIban(profile.iban) && present(profile.accountHolder)) },
      { key: "numbering", label: "Številčenje računov", done: /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(String(profile.invoicePrefix || "")) },
      { key: "confirmation", label: "Potrditev resničnih podatkov", done: Boolean(profile.legalConfirmed) }
    ];
    var done = checks.filter(function (check) { return check.done; }).length;
    return { checks: checks, percent: Math.round(done / checks.length * 100), live: done === checks.length };
  }

  function normalizeBankText(value) {
    return String(value == null ? "" : value).replace(/ß/g, "ss").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function parseBankDate(value) {
    var text = String(value || "").trim();
    var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
    var german = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if (!german) return "";
    return german[3] + "-" + String(german[2]).padStart(2, "0") + "-" + String(german[1]).padStart(2, "0");
  }

  function parseDelimitedLine(line, delimiter) {
    var values = [];
    var value = "";
    var quoted = false;
    for (var index = 0; index < line.length; index += 1) {
      var character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
        else quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        values.push(value.trim()); value = "";
      } else value += character;
    }
    values.push(value.trim());
    return values;
  }

  function firstBankValue(row, aliases) {
    for (var index = 0; index < aliases.length; index += 1) {
      var key = aliases[index];
      if (row[key] != null && String(row[key]).trim() !== "") return String(row[key]).trim();
    }
    return "";
  }

  function parseBankCsv(text) {
    var lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(function (line) { return line.trim(); });
    if (lines.length < 2) return [];
    var delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ";" : ",";
    var headers = parseDelimitedLine(lines[0], delimiter).map(normalizeBankText);
    return lines.slice(1).map(function (line) {
      var cells = parseDelimitedLine(line, delimiter);
      var row = {};
      headers.forEach(function (header, index) { row[header] = cells[index] || ""; });
      var amountText = firstBankValue(row, ["BETRAG", "UMSATZ", "AMOUNT", "ZNESEK"]);
      var amountCents = parseMoneyToCents(amountText);
      var direction = normalizeBankText(firstBankValue(row, ["SOLLHABEN", "CREDITDEBIT", "CDTDBTIND", "TIP"]));
      if (direction === "DBIT" || direction === "SOLL" || direction === "DEBIT" || direction === "S") amountCents = -Math.abs(amountCents);
      var bookedOn = parseBankDate(firstBankValue(row, ["BUCHUNGSTAG", "BUCHUNGSDATUM", "BOOKINGDATE", "DATUM"]));
      return {
        external_reference: firstBankValue(row, ["KUNDENREFERENZ", "BANKREFERENZ", "REFERENZ", "ENDTOENDID", "TRANSACTIONID"]),
        booked_on: bookedOn,
        amount_cents: amountCents,
        currency: (firstBankValue(row, ["WAHRUNG", "CURRENCY", "VALUTA"]) || "EUR").toUpperCase(),
        counterparty_name: firstBankValue(row, ["NAMEZAHLUNGSBETEILIGTER", "AUFTRAGGEBERBEGUNSTIGTER", "ZAHLUNGSPFLICHTIGER", "COUNTERPARTY", "NAME"]),
        counterparty_iban: firstBankValue(row, ["IBANZAHLUNGSBETEILIGTER", "IBAN", "COUNTERPARTYIBAN"]).replace(/\s/g, "").toUpperCase(),
        remittance_info: firstBankValue(row, ["VERWENDUNGSZWECK", "BUCHUNGSTEXT", "REMITTANCEINFORMATION", "PURPOSE", "NAMEN"])
      };
    }).filter(function (entry) { return entry.booked_on && entry.amount_cents > 0 && entry.currency === "EUR"; });
  }

  function decodeXmlText(value) {
    return String(value || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
  }

  function xmlTag(block, tag) {
    var match = String(block || "").match(new RegExp("<(?:[A-Za-z0-9_]+:)?" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?" + tag + ">", "i"));
    return match ? decodeXmlText(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")) : "";
  }

  function xmlBlock(block, tag) {
    var match = String(block || "").match(new RegExp("<(?:[A-Za-z0-9_]+:)?" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?" + tag + ">", "i"));
    return match ? match[1] : "";
  }

  function parseCamt053(text) {
    var entries = String(text || "").match(/<(?:[A-Za-z0-9_]+:)?Ntry(?:\s[^>]*)?>[\s\S]*?<\/(?:[A-Za-z0-9_]+:)?Ntry>/gi) || [];
    return entries.map(function (entry) {
      var amountMatch = entry.match(/<(?:[A-Za-z0-9_]+:)?Amt(?:\s+[^>]*Ccy=["']([^"']+)["'][^>]*)?>([^<]+)</i);
      var amountCents = parseMoneyToCents(amountMatch && amountMatch[2]);
      if (normalizeBankText(xmlTag(entry, "CdtDbtInd")) === "DBIT") amountCents = -Math.abs(amountCents);
      var bookingBlock = entry.match(/<(?:[A-Za-z0-9_]+:)?BookgDt[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?BookgDt>/i);
      var bookedOn = parseBankDate(xmlTag(bookingBlock && bookingBlock[1], "Dt") || xmlTag(bookingBlock && bookingBlock[1], "DtTm"));
      var remittanceParts = [];
      var remittancePattern = /<(?:[A-Za-z0-9_]+:)?Ustrd(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?Ustrd>/gi;
      var remittanceMatch;
      while ((remittanceMatch = remittancePattern.exec(entry))) remittanceParts.push(decodeXmlText(remittanceMatch[1].replace(/<[^>]+>/g, " ")));
      var debtorBlock = xmlBlock(entry, "Dbtr");
      var debtorAccountBlock = xmlBlock(entry, "DbtrAcct");
      return {
        external_reference: xmlTag(entry, "AcctSvcrRef") || xmlTag(entry, "NtryRef") || xmlTag(entry, "EndToEndId"),
        booked_on: bookedOn,
        amount_cents: amountCents,
        currency: (amountMatch && amountMatch[1] || "EUR").toUpperCase(),
        counterparty_name: xmlTag(debtorBlock, "Nm") || xmlTag(entry, "Nm"),
        counterparty_iban: (xmlTag(debtorAccountBlock, "IBAN") || xmlTag(entry, "IBAN")).replace(/\s/g, "").toUpperCase(),
        remittance_info: remittanceParts.join(" ") || xmlTag(entry, "AddtlNtryInf")
      };
    }).filter(function (entry) { return entry.booked_on && entry.amount_cents > 0 && entry.currency === "EUR"; });
  }

  function parseBankStatement(text, fileName) {
    var isCamt = /<(?:[A-Za-z0-9_]+:)?BkToCstmrStmt|<(?:[A-Za-z0-9_]+:)?Ntry/i.test(String(text || ""));
    var isCsv = /[;,].+\r?\n/.test(String(text || ""));
    if (!isCamt && !isCsv) return { format: "", transactions: [] };
    return { format: isCamt ? "camt053" : "csv", transactions: isCamt ? parseCamt053(text) : parseBankCsv(text), fileName: String(fileName || "bančni-izpisek") };
  }

  function matchBankTransaction(transaction, invoices) {
    if (!transaction || transaction.status === "confirmed" || integer(transaction.amountCents || transaction.amount_cents, 0) <= 0) return null;
    var amount = integer(transaction.amountCents || transaction.amount_cents, 0);
    var searchText = normalizeBankText((transaction.remittanceInfo || transaction.remittance_info || "") + " " + (transaction.counterpartyName || transaction.counterparty_name || ""));
    var candidates = (Array.isArray(invoices) ? invoices : []).filter(function (invoice) {
      var outstanding = invoiceOutstandingCents(invoice);
      return invoice.serverStored && !invoice.hasCreditNote && invoice.status !== "cancelled" && outstanding >= amount && outstanding > 0;
    }).map(function (invoice) {
      var outstanding = invoiceOutstandingCents(invoice);
      var numberMatch = searchText.indexOf(normalizeBankText(invoice.number)) !== -1;
      var payerName = normalizeBankText(transaction.counterpartyName || transaction.counterparty_name || "");
      var customerName = normalizeBankText(invoice.draft && invoice.draft.customerName || "");
      var nameMatch = Boolean(payerName && customerName && (payerName.indexOf(customerName) !== -1 || customerName.indexOf(payerName) !== -1));
      var exactAmount = outstanding === amount;
      var score = numberMatch ? (exactAmount ? 100 : 92) : exactAmount && nameMatch ? 84 : exactAmount ? 64 : 0;
      return { invoice: invoice, score: score, exactAmount: exactAmount, reason: numberMatch ? "Številka računa" + (exactAmount ? " in znesek" : "") : exactAmount && nameMatch ? "Znesek in plačnik" : exactAmount ? "Enak odprti znesek" : "" };
    }).filter(function (entry) { return entry.score > 0; }).sort(function (left, right) { return right.score - left.score; });
    if (!candidates.length) return null;
    if (candidates[0].score === 64 && candidates[1] && candidates[1].score === 64) return null;
    return candidates[0];
  }

  function invoiceOutstandingCents(invoice) {
    if (!invoice || invoice.status === "cancelled" || invoice.status === "credited") return 0;
    var receivable = invoice.adjustedGrossCents == null
      ? integer(invoice.totals && invoice.totals.grossCents, 0)
      : integer(invoice.adjustedGrossCents, 0);
    return Math.max(0, receivable - integer(invoice.paidCents, 0));
  }

  function bankImportFileError(file) {
    if (!file) return "Izberite bančni izpisek.";
    var size = Number(file.size);
    if (!Number.isFinite(size) || size <= 0) return "Bančni izpisek je prazen ali ga ni mogoče prebrati.";
    if (size > MAX_BANK_IMPORT_BYTES) return "Bančni izpisek je prevelik. Največja dovoljena velikost je 5 MB.";
    return "";
  }

  function latestManualPaymentCandidate(invoices) {
    return (invoices || []).filter(function (invoice) {
      return invoice && invoice.status !== "paid" && invoice.status !== "cancelled" && invoiceOutstandingCents(invoice) > 0;
    })[0] || null;
  }

  function invoiceDaysOverdue(invoice, today) {
    if (!invoice || invoice.isTest || invoice.status === "paid" || invoice.status === "cancelled" || invoiceOutstandingCents(invoice) <= 0) return 0;
    var due = Date.parse(String(invoice.dueDate || "") + "T12:00:00Z");
    var reference = Date.parse(String(today || isoToday()) + "T12:00:00Z");
    if (!Number.isFinite(due) || !Number.isFinite(reference) || due >= reference) return 0;
    return Math.max(1, Math.floor((reference - due) / 86400000));
  }

  function filterInvoices(invoices, filter, term, today) {
    var selected = ["all", "open", "overdue", "paid"].indexOf(filter) >= 0 ? filter : "all";
    var queryText = String(term || "").trim().toLocaleLowerCase("sl-SI");
    return (invoices || []).filter(function (invoice) {
      var overdue = invoiceDaysOverdue(invoice, today) > 0;
      var open = !invoice.isTest && invoice.status !== "paid" && invoice.status !== "cancelled" && invoiceOutstandingCents(invoice) > 0;
      if (selected === "open" && !open) return false;
      if (selected === "overdue" && !overdue) return false;
      if (selected === "paid" && invoice.status !== "paid") return false;
      if (!queryText) return true;
      var haystack = [invoice.number, invoice.draft && invoice.draft.customerName, invoice.draft && invoice.draft.customerEmail].join(" ").toLocaleLowerCase("sl-SI");
      return haystack.indexOf(queryText) >= 0;
    });
  }

  function invoiceOverview(invoices, today) {
    return (invoices || []).reduce(function (summary, invoice) {
      if (invoice.isTest || invoice.status === "cancelled") return summary;
      var outstanding = invoiceOutstandingCents(invoice);
      if (outstanding > 0) summary.openCents += outstanding;
      if (invoiceDaysOverdue(invoice, today) > 0) summary.overdueCents += outstanding;
      if (invoice.status === "paid") summary.paidCount += 1;
      return summary;
    }, { openCents: 0, overdueCents: 0, paidCount: 0 });
  }

  function bankDateOrdinal(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
    if (!match) return null;
    return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
  }

  function resolveBankMatches(transactions, invoices) {
    var suggestions = {};
    var ambiguities = {};
    var byInvoice = {};
    (Array.isArray(transactions) ? transactions : []).forEach(function (transaction, index) {
      var match = matchBankTransaction(transaction, invoices);
      if (!match) return;
      var transactionKey = String(transaction.id || index);
      var bookedDay = bankDateOrdinal(transaction.bookedOn || transaction.booked_on);
      var issueDay = bankDateOrdinal(match.invoice && match.invoice.draft && (match.invoice.draft.issueDate || match.invoice.draft.issue_date));
      var dueDay = bankDateOrdinal(match.invoice && (match.invoice.dueDate || match.invoice.due_date));
      if (match.score < 92 && bookedDay !== null && issueDay !== null) {
        var latestDay = dueDay === null ? issueDay + 90 : dueDay + 90;
        if (bookedDay < issueDay - 14 || bookedDay > latestDay) return;
      }
      var sellerIban = cleanIban(match.invoice && match.invoice.seller && match.invoice.seller.iban);
      var sourceIban = cleanIban(transaction.sourceAccountIban || transaction.source_account_iban);
      var destinationMatch = Boolean(sellerIban && sourceIban && sellerIban === sourceIban);
      var entry = Object.assign({}, match, {
        transaction: transaction,
        transactionKey: transactionKey,
        dateDistance: bookedDay === null || issueDay === null ? 999999 : Math.abs(bookedDay - issueDay),
        destinationMatch: destinationMatch,
        rank: match.score + (destinationMatch ? 8 : 0)
      });
      var invoiceKey = String(match.invoice.id);
      if (!byInvoice[invoiceKey]) byInvoice[invoiceKey] = [];
      byInvoice[invoiceKey].push(entry);
    });
    Object.keys(byInvoice).forEach(function (invoiceKey) {
      var entries = byInvoice[invoiceKey].sort(function (left, right) {
        if (right.rank !== left.rank) return right.rank - left.rank;
        return left.dateDistance - right.dateDistance;
      });
      var best = entries[0];
      var tied = entries.filter(function (entry) {
        return entry.rank === best.rank && entry.dateDistance === best.dateDistance;
      });
      if (tied.length === 1) {
        suggestions[best.transactionKey] = best;
        return;
      }
      tied.forEach(function (entry) {
        ambiguities[entry.transactionKey] = "Več enako primernih prilivov – preverite izvorni račun.";
      });
    });
    return { suggestions: suggestions, ambiguities: ambiguities };
  }

  function profileForPreview(profile, isTest) {
    var source = Object.assign({}, profile || {});
    var identityReady = [source.legalName, source.street, source.postalCode, source.city]
      .every(function (value) { return Boolean(String(value || "").trim()); });
    if (!isTest || identityReady) return source;
    return Object.assign(source, {
      legalName: "TEST-Unternehmen",
      street: "Musterstraße 1",
      postalCode: "00000",
      city: "Teststadt"
    });
  }

  function invoiceFingerprint(invoice) {
    var draft = invoice && invoice.draft || {};
    var totals = invoice && invoice.totals || {};
    var items = (draft.items || []).map(function (item) {
      return [
        String(item.description || "").trim(), item.category || "other",
        parseQuantityMilli(item.quantity), String(item.unit || "").trim(),
        parseMoneyToCents(item.unitPrice), integer(item.taxRate, 0)
      ];
    });
    return JSON.stringify([
      String(invoice && invoice.number || "").trim(), Boolean(invoice && invoice.isTest),
      draft.customerType || "", String(draft.customerName || "").trim(),
      String(draft.customerStreet || "").trim(), String(draft.customerPostalCode || "").trim(),
      String(draft.customerCity || "").trim(), draft.issueDate || "", draft.serviceDate || "",
      draft.taxMode || "", draft.priceMode || "", draft.paymentMethod || "",
      integer(totals.netCents, 0), integer(totals.taxCents, 0), integer(totals.grossCents, 0), items
    ]);
  }

  function mergeInvoiceSources(serverInvoices, localInvoices) {
    var authoritative = Array.isArray(serverInvoices) ? serverInvoices : [];
    var local = Array.isArray(localInvoices) ? localInvoices : [];
    var seen = Object.create(null);
    var seenNumbers = Object.create(null);
    authoritative.forEach(function (invoice) {
      seen[invoiceFingerprint(invoice)] = true;
      var number = String(invoice && invoice.number || "").trim();
      if (number) seenNumbers[(invoice.isTest ? "test:" : "live:") + number] = true;
    });
    return authoritative.concat(local.filter(function (invoice) {
      var number = String(invoice && invoice.number || "").trim();
      var numberKey = number ? (invoice.isTest ? "test:" : "live:") + number : "";
      if (numberKey && seenNumbers[numberKey]) return false;
      var fingerprint = invoiceFingerprint(invoice);
      if (seen[fingerprint]) return false;
      seen[fingerprint] = true;
      if (numberKey) seenNumbers[numberKey] = true;
      return true;
    }));
  }

  function validateStep(draft, profile, step) {
    var errors = [];
    function required(value, message) { if (!String(value || "").trim()) errors.push(message); }

    if (step === 1 || step === 4) {
      required(draft.customerName, "Vnesite ime oziroma naziv prejemnika.");
      required(draft.customerStreet, "Vnesite naslov prejemnika.");
      required(draft.customerPostalCode, "Vnesite poštno številko prejemnika.");
      required(draft.customerCity, "Vnesite kraj prejemnika.");
      if (String(draft.customerPostalCode || "") && !/^\d{5}$/.test(String(draft.customerPostalCode))) errors.push("PLZ prejemnika mora imeti točno 5 številk.");
      if (String(draft.customerEmail || "") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(draft.customerEmail))) errors.push("E-poštni naslov prejemnika ni veljaven.");
      if (String(draft.customerPhone || "") && !/^\+?[0-9][0-9 ()/.\-]{5,59}$/.test(String(draft.customerPhone))) errors.push("Telefon prejemnika ni veljaven.");
      var normalizedCustomerVatId = String(draft.customerVatId || "").toUpperCase().replace(/[\s-]/g, "");
      if (normalizedCustomerVatId && !/^[A-Z]{2}[A-Z0-9]{2,14}$/.test(normalizedCustomerVatId)) errors.push("USt-IdNr. prejemnika ni veljavna.");
      if ([draft.customerName, draft.customerStreet, draft.customerCity, draft.customerEmail, draft.customerPhone, draft.customerVatId, draft.leitwegId, draft.buyerReference].some(function (value) { return /[\r\n]/.test(String(value || "")); })) errors.push("Podatki prejemnika ne smejo vsebovati preloma vrstice.");
      if (draft.customerType === "public") required(draft.leitwegId, "Za javnega naročnika je potrebna Leitweg-ID.");
      if (draft.customerType === "business" || draft.customerType === "public") required(draft.buyerReference || draft.leitwegId, "Za XRechnung vnesite Bestellnummer / Buyer reference.");
      if (draft.customerType === "business") required(draft.customerEmail, "Za XRechnung vnesite e-poštni naslov poslovnega prejemnika.");
      if (draft.customerType === "business" || draft.customerType === "public") required(profile.businessEmail, "Za XRechnung v nastavitvah dodajte poslovni e-poštni naslov izdajatelja.");
      if (draft.customerType === "business" || draft.customerType === "public") required(profile.businessPhone, "Za XRechnung v nastavitvah dodajte poslovni telefon izdajatelja.");
      if (draft.workflowMode === "offer" && draft.customerType === "private") {
        if (["business_premises", "distance", "off_premises", "urgent_repair"].indexOf(draft.consumerContractContext) === -1) {
          errors.push("Izberite, kako bo sklenjena potrošniška pogodba.");
        }
        if (["distance", "off_premises"].indexOf(draft.consumerContractContext) !== -1) {
          required(profile.businessEmail, "Za Widerrufsbelehrung v nastavitvah dodajte poslovni e-poštni naslov.");
          required(profile.businessPhone, "Za Widerrufsbelehrung v nastavitvah dodajte poslovni telefon.");
        }
        if (draft.consumerContractContext === "urgent_repair") {
          var urgentScopeLength = String(draft.urgentRepairScope || "").trim().length;
          if (urgentScopeLength < 5 || urgentScopeLength > 500) errors.push("Natančno opišite nujno popravilo (od 5 do 500 znakov).");
        }
      }
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
      if (calculateTotals(draft).grossCents <= 0) errors.push("Skupni znesek računa mora biti večji od 0,00 €.");
    }

    if (step === 3 || step === 4) {
      if (profile.taxStatus === "small_business" && draft.taxMode !== "small_business") errors.push("Podjetje je nastavljeno kot Kleinunternehmer; DDV ali reverse charge tu ni dovoljen brez spremembe davčnega statusa.");
      if (profile.taxStatus !== "small_business" && draft.taxMode === "small_business") errors.push("Oprostitev § 19 UStG se ne sme izbrati samo za posamezen račun.");
      if (draft.taxMode === "reverse_charge") {
        if (draft.customerType === "private") errors.push("Reverse charge ni dovoljen za fizično osebo.");
        if (!String(draft.customerVatId || "").trim()) errors.push("Reverse charge zahteva USt-IdNr. prejemnika.");
        if (!draft.reverseChargeConfirmed) errors.push("Potrdite, da so bili preverjeni pogoji § 13b UStG.");
      }
      if (draft.constructionWithholding && draft.customerType === "private") errors.push("Bauabzugsteuer po § 48 EStG velja le za poslovnega ali javnega prejemnika.");
      if (draft.constructionWithholding && draft.exemptionCertificate === "unknown") errors.push("Pri Bauleistung izberite stanje Freistellungsbescheinigung.");
      if (draft.handwerker35a && draft.customerType !== "private") errors.push("Handwerkerleistung po § 35a EStG je namenjena zasebnemu prejemniku.");
      if (draft.consumerDefaultNotice && draft.customerType !== "private") errors.push("30-dnevno potrošniško opozorilo je dovoljeno le za zasebnega prejemnika.");
    }

    if (step === 4) {
      var readiness = profileReadiness(profile);
      if (readiness.live && !draft.finalConfirmed) errors.push("Pred pravno izdajo potrdite končni pregled.");
      if (!readiness.live && !draft.finalConfirmed) errors.push("Pred izdelavo testnega dokumenta potrdite končni pregled.");
      var withholdingError = readiness.live ? liveConstructionWithholdingError(draft) : "";
      if (withholdingError) errors.push(withholdingError);
    }
    return errors;
  }

  function liveInvoiceDateError(draft, today) {
    var source = draft || {};
    var businessToday = String(today || isoToday());
    if (String(source.issueDate || "") !== businessToday) {
      return "Datum izdaje pravega računa mora biti današnji nemški poslovni datum.";
    }
    if (String(source.serviceDate || "") > String(source.issueDate || "")) {
      return "Datum izvedbe pravega računa ne sme biti v prihodnosti.";
    }
    return "";
  }

  function liveConstructionWithholdingError(draft) {
    var source = draft || {};
    if (source.constructionWithholding && source.exemptionCertificate === "missing") {
      return "Pravi račun brez Freistellungsbescheinigung je zaklenjen, dokler POS ne podpira 15 % Bauabzugsteuer in pravilne uskladitve plačila.";
    }
    return "";
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

  function propertyRetentionNotice(draft) {
    if (!draft || draft.customerType !== "private" || (!draft.propertyRelated && !draft.handwerker35a)) return "";
    return "Der Leistungsempfänger ist verpflichtet, diese Rechnung, einen Zahlungsbeleg oder eine andere beweiskräftige Unterlage zwei Jahre aufzubewahren (§ 14b Abs. 1 UStG).";
  }

  function deliveryRecommendation(invoice, profile) {
    var draft = invoice && invoice.draft || {};
    var type = draft.customerType || "private";
    var serviceDate = String(draft.serviceDate || draft.issueDate || "");
    var turnoverBand = profile && profile.previousYearTurnoverBand || "unknown";
    if (type === "public") {
      return {
        channel: "ozg_re", documentFormat: "xrechnung", structuredRequired: true,
        pdfAllowed: false, pdfConsentRequired: false, needsTurnoverDecision: false,
        title: "XRechnung prek OZG-RE", copy: "Leitweg-ID usmeri račun javnemu naročniku.", badge: "XML"
      };
    }
    if (type === "business") {
      var totals = invoice && invoice.totals || calculateTotals(draft);
      var grossCents = Math.max(0, integer(totals && totals.grossCents, 0));
      var taxMode = draft.taxMode || (profile && profile.taxStatus === "small_business" ? "small_business" : "regular");
      var smallBusiness = taxMode === "small_business" || Boolean(profile && profile.taxStatus === "small_business");
      var smallAmount = grossCents <= 25000 && taxMode !== "reverse_charge";
      var exempt = smallBusiness || smallAmount;
      var year = integer(serviceDate.slice(0, 4), integer(isoToday().slice(0, 4), new Date().getUTCFullYear()));
      var pdfAllowed = exempt || year <= 2026 || (year === 2027 && turnoverBand === "lte_800k");
      var needsTurnoverDecision = !exempt && year === 2027 && turnoverBand === "unknown";
      var copy = smallBusiness
        ? "Kot Kleinunternehmer lahko izdate PDF; strukturirani XML ostaja pripravljen."
        : smallAmount ? "Za račun do 250 EUR je PDF dovoljen; strukturirani XML ostaja pripravljen."
          : pdfAllowed ? "Strukturirani XML je pripravljen za prihodnja pravila." : "Za datum opravljene storitve je potreben strukturirani e-račun.";
      return {
        channel: "email", documentFormat: "xrechnung_pdf", structuredRequired: !pdfAllowed,
        pdfAllowed: pdfAllowed, pdfConsentRequired: true, needsTurnoverDecision: needsTurnoverDecision,
        title: "XRechnung + berljivi PDF", copy: copy, badge: "XML + PDF"
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

  var DATEV_BOOKING_HEADERS = (function () {
    var headers = [
      "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz", "Konto", "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext", "Postensperre", "Diverse Adressnummer", "Geschäftspartnerbank", "Sachverhalt", "Zinssperre", "Beleglink",
      "Beleginfo - Art 1", "Beleginfo - Inhalt 1", "Beleginfo - Art 2", "Beleginfo - Inhalt 2", "Beleginfo - Art 3", "Beleginfo - Inhalt 3", "Beleginfo - Art 4", "Beleginfo - Inhalt 4", "Beleginfo - Art 5", "Beleginfo - Inhalt 5", "Beleginfo - Art 6", "Beleginfo - Inhalt 6", "Beleginfo - Art 7", "Beleginfo - Inhalt 7", "Beleginfo - Art 8", "Beleginfo - Inhalt 8", "KOST1 - Kostenstelle", "KOST2 - Kostenstelle", "Kost-Menge", "EU-Land u. UStID (Bestimmung)", "EU-Steuersatz (Bestimmung)", "Abw. Versteuerungsart", "Sachverhalt L+L", "Funktionsergänzung L+L", "BU 49 Hauptfunktionstyp", "BU 49 Hauptfunktionsnummer", "BU 49 Funktionsergänzung"
    ];
    for (var index = 1; index <= 20; index += 1) {
      headers.push("Zusatzinformation - Art " + index, "Zusatzinformation- Inhalt " + index);
    }
    return headers.concat([
      "Stück", "Gewicht", "Zahlweise", "Forderungsart", "Veranlagungsjahr", "Zugeordnete Fälligkeit", "Skontotyp", "Auftragsnummer", "Buchungstyp", "USt-Schlüssel (Anzahlungen)", "EU-Land (Anzahlungen)", "Sachverhalt L+L (Anzahlungen)", "EU-Steuersatz (Anzahlungen)", "Erlöskonto (Anzahlungen)", "Herkunft-Kz", "Buchungs GUID", "KOST-Datum", "SEPA-Mandatsreferenz", "Skontosperre", "Gesellschaftername", "Beteiligtennummer", "Identifikationsnummer", "Zeichnernummer", "Postensperre bis", "Bezeichnung SoBil-Sachverhalt", "Kennzeichen SoBil-Buchung", "Festschreibung", "Leistungsdatum", "Datum Zuord. Steuerperiode", "Fälligkeit", "Generalumkehr (GU)", "Steuersatz", "Land", "Abrechnungsreferenz", "BVV-Position", "EU-Land u. UStID (Ursprung)", "EU-Steuersatz (Ursprung)", "Abw. Skontokonto"
    ]);
  })();

  function datevText(value) {
    return "\"" + String(value == null ? "" : value).replace(/[\r\n\t]/g, " ").replace(/\"/g, "\"\"") + "\"";
  }

  function datevAmount(cents) {
    return (Math.abs(integer(cents, 0)) / 100).toFixed(2).replace(".", ",");
  }

  function datevCompactDate(iso, includeYear) {
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return match ? match[3] + match[2] + (includeYear ? match[1] : "") : "";
  }

  function datevDocumentNumber(value) {
    return String(value || "")
      .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9_$&%*+\-/]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 36);
  }

  function datevTimestamp(value) {
    var date = value instanceof Date ? value : new Date(value || Date.now());
    function pad(number, length) { return String(number).padStart(length || 2, "0"); }
    if (Number.isNaN(date.getTime())) date = new Date();
    try {
      var parts = new Intl.DateTimeFormat("en", {
        timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
      }).formatToParts(date);
      var values = {};
      parts.forEach(function (part) { values[part.type] = part.value; });
      if (values.year && values.month && values.day && values.hour && values.minute && values.second) {
        return values.year + values.month + values.day + values.hour + values.minute + values.second + pad(date.getUTCMilliseconds(), 3);
      }
    } catch (_) {}
    return date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) + pad(date.getUTCHours()) + pad(date.getUTCMinutes()) + pad(date.getUTCSeconds()) + pad(date.getUTCMilliseconds(), 3);
  }

  function datevPeriod(value) {
    var match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    var year = integer(match[1], 0);
    var month = integer(match[2], 0);
    if (year < 2000 || year > 2099 || month < 1 || month > 12) return null;
    var end = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { key: match[0], year: year, month: month, start: match[1] + match[2] + "01", end: match[1] + match[2] + String(end).padStart(2, "0") };
  }

  function datevFiscalStart(period, monthDay) {
    var match = /^(\d{2})-(\d{2})$/.exec(String(monthDay || ""));
    if (!period || !match) return "";
    var month = integer(match[1], 0);
    var day = integer(match[2], 0);
    if (month < 1 || month > 12 || day < 1 || day > 31) return "";
    var year = period.year - (period.month < month ? 1 : 0);
    var candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return "";
    return String(year) + String(month).padStart(2, "0") + String(day).padStart(2, "0");
  }

  function validateDatevSettings(settings, periodValue) {
    var value = normalizeDatevSettings(settings);
    var period = datevPeriod(periodValue);
    var errors = [];
    var adviser = integer(value.adviserNumber, 0);
    var client = integer(value.clientNumber, 0);
    var accountLength = integer(value.accountLength, 4);
    if (!period) errors.push("Izberite veljaven obračunski mesec.");
    if (adviser < 1001 || adviser > 9999999) errors.push("Beraternummer mora biti med 1001 in 9999999.");
    if (client < 1 || client > 99999) errors.push("Mandantennummer mora biti med 1 in 99999.");
    if (!datevFiscalStart(period, value.fiscalYearStart)) errors.push("Začetek poslovnega leta vnesite kot MM-DD.");
    if (!/^[A-Z]{2,4}$/.test(value.initials)) errors.push("Diktatkürzel mora imeti 2–4 velike črke.");
    ["receivableAccount", "revenue19Account", "revenue7Account", "smallBusinessAccount", "reverseChargeAccount"].forEach(function (key) {
      var account = value[key];
      var maximumLength = key === "receivableAccount" ? accountLength + 1 : accountLength;
      if (!/^\d+$/.test(account) || account === "0" || account.length > maximumLength) errors.push("Preverite vse DATEV konte in dolžino kontov.");
    });
    if (!value.confirmed) errors.push("Potrdite, da je konte pregledal računovodja ali davčni svetovalec.");
    return errors.filter(function (message, index) { return errors.indexOf(message) === index; });
  }

  function datevRevenueAccount(draft, rateBps, settings) {
    if (draft.taxMode === "small_business") return settings.smallBusinessAccount;
    if (draft.taxMode === "reverse_charge") return settings.reverseChargeAccount;
    if (integer(rateBps, 0) === 1900) return settings.revenue19Account;
    if (integer(rateBps, 0) === 700) return settings.revenue7Account;
    return "";
  }

  function datevBookingRow(booking) {
    var fields = new Array(DATEV_BOOKING_HEADERS.length).fill("");
    fields[0] = datevAmount(booking.amountCents);
    fields[1] = datevText(booking.side);
    fields[2] = datevText("EUR");
    fields[6] = String(booking.account);
    fields[7] = String(booking.counterAccount);
    fields[8] = datevText("");
    fields[9] = datevCompactDate(booking.date, false);
    fields[10] = datevText(datevDocumentNumber(booking.documentNumber));
    var dueDate = datevCompactDate(booking.dueDate, true);
    fields[11] = datevText(dueDate ? dueDate.slice(0, 4) + dueDate.slice(6, 8) : "");
    fields[13] = datevText(String(booking.text || "").replace(/[\r\n\t]/g, " ").slice(0, 60));
    fields[14] = "0";
    if (booking.documentGuid) fields[19] = datevText('BEDI "' + String(booking.documentGuid).toUpperCase() + '"');
    return fields.join(";");
  }

  function berlinDateKey(value) {
    var text = String(value || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    var date = new Date(text);
    if (Number.isNaN(date.getTime())) return "";
    try {
      var parts = new Intl.DateTimeFormat("en", {
        timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(date);
      var values = {};
      parts.forEach(function (part) { values[part.type] = part.value; });
      return values.year && values.month && values.day ? values.year + "-" + values.month + "-" + values.day : "";
    } catch (_) { return ""; }
  }

  function buildDatevExport(invoices, inputSettings, periodValue, now, options) {
    options = options || {};
    var settings = normalizeDatevSettings(inputSettings);
    var period = datevPeriod(periodValue);
    var errors = validateDatevSettings(settings, periodValue);
    var bookings = [];
    var warnings = [];
    function inPeriod(iso) { return period && berlinDateKey(iso).slice(0, 7) === period.key; }
    function appendParts(invoice, date, documentNumber, side, text, centsOverride, documentGuid) {
      var draft = invoice.draft || {};
      var totals = calculateTotals(draft);
      var keys = Object.keys(totals.byRate);
      if (centsOverride != null) {
        var dominant = keys.sort(function (left, right) {
          var a = totals.byRate[left]; var b = totals.byRate[right];
          return (b.netCents + b.taxCents) - (a.netCents + a.taxCents);
        })[0] || "0";
        var overrideAccount = datevRevenueAccount(draft, integer(dominant, 0), settings);
        if (!overrideAccount) errors.push("Račun " + invoice.number + " uporablja davčno stopnjo brez nastavljenega DATEV konta.");
        else if (Math.abs(integer(centsOverride, 0)) > 0) bookings.push({ amountCents: Math.abs(integer(centsOverride, 0)), side: side, account: settings.receivableAccount, counterAccount: overrideAccount, date: date, dueDate: invoice.dueDate, documentNumber: documentNumber, text: text, documentGuid: documentGuid });
        return;
      }
      keys.forEach(function (key) {
        var part = totals.byRate[key];
        var gross = part.netCents + part.taxCents;
        if (!gross) return;
        var revenueAccount = datevRevenueAccount(draft, part.rateBps, settings);
        if (!revenueAccount) {
          errors.push("Račun " + invoice.number + " uporablja davčno stopnjo " + (part.rateBps / 100) + " %, ki nima DATEV konta.");
          return;
        }
        bookings.push({ amountCents: gross, side: side, account: settings.receivableAccount, counterAccount: revenueAccount, date: date, dueDate: invoice.dueDate, documentNumber: documentNumber, text: text, documentGuid: documentGuid });
      });
    }
    (invoices || []).forEach(function (invoice) {
      if (!invoice || invoice.isTest) return;
      var draft = invoice.draft || {};
      if (inPeriod(draft.issueDate)) appendParts(invoice, draft.issueDate, invoice.number, "S", "Ausgangsrechnung " + (draft.customerName || invoice.number), null, invoice.documentGuid);
      (invoice.adjustments || []).forEach(function (adjustment) {
        var date = berlinDateKey(adjustment.createdAt);
        if (!inPeriod(date)) return;
        var adjustmentInvoice = adjustment.draft ? Object.assign({}, invoice, { draft: adjustment.draft }) : invoice;
        if (adjustment.type === "cancellation") appendParts(adjustmentInvoice, date, adjustment.number, "H", "Storno zu " + invoice.number, null, adjustment.documentGuid);
        else if (adjustment.type === "credit_note") {
          var groups = adjustment.snapshot && adjustment.snapshot.credit_tax_groups || [];
          groups.forEach(function (group) {
            var rate = integer(group.tax_rate_bps, 0);
            var gross = integer(group.gross_cents, 0);
            var revenueAccount = datevRevenueAccount(draft, rate, settings);
            if (!revenueAccount) errors.push("Dobropis " + adjustment.number + " uporablja davčno stopnjo " + (rate / 100) + " %, ki nima DATEV konta.");
            else if (gross > 0) bookings.push({ amountCents: gross, side: "H", account: settings.receivableAccount, counterAccount: revenueAccount, date: date, dueDate: invoice.dueDate, documentNumber: adjustment.number, text: "Gutschrift zu " + invoice.number, documentGuid: adjustment.documentGuid });
          });
        }
        else if (integer(adjustment.deltaGrossCents, 0) !== 0) appendParts(adjustmentInvoice, date, adjustment.number, adjustment.deltaGrossCents < 0 ? "H" : "S", "Korrektur zu " + invoice.number, adjustment.deltaGrossCents, adjustment.documentGuid);
      });
    });
    var documentNumbers = {};
    bookings.forEach(function (booking) {
      var normalizedNumber = datevDocumentNumber(booking.documentNumber);
      var originalNumber = String(booking.documentNumber || "");
      if (documentNumbers[normalizedNumber] && documentNumbers[normalizedNumber] !== originalNumber) errors.push("Dokumentni številki " + documentNumbers[normalizedNumber] + " in " + originalNumber + " bi imeli enak DATEV ključ.");
      else documentNumbers[normalizedNumber] = originalNumber;
      if (options.requireDocumentLinks && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(booking.documentGuid || ""))) errors.push("Dokument " + originalNumber + " nima veljavne DATEV povezave do PDF-ja.");
    });
    errors = errors.filter(function (message, index) { return errors.indexOf(message) === index; });
    if (!bookings.length && !errors.length) warnings.push("V tem mesecu ni pravnih računov ali finančnih popravkov. Testni računi so namenoma izločeni.");
    if (!period) return { errors: errors, warnings: warnings, bookings: [], content: "", filename: "" };
    var fiscalStart = datevFiscalStart(period, settings.fiscalYearStart);
    var header = [datevText("EXTF"), "700", "21", datevText("Buchungsstapel"), "13", datevTimestamp(now), "", datevText(settings.initials), datevText(""), datevText(""), String(integer(settings.adviserNumber, 0)), String(integer(settings.clientNumber, 0)), fiscalStart, settings.accountLength, period.start, period.end, datevText("Ausgangsrechnungen " + period.key), datevText(settings.initials), "1", "0", "0", datevText("EUR"), "", datevText(""), "", "", datevText(settings.framework), "", "", datevText(""), datevText("")].join(";");
    var lines = [header, DATEV_BOOKING_HEADERS.join(";")].concat(bookings.map(datevBookingRow));
    return {
      errors: errors,
      warnings: warnings,
      bookings: bookings,
      content: lines.join("\r\n") + "\r\n",
      filename: "EXTF_Buchungsstapel_" + period.key.replace("-", "") + ".csv",
      totalCents: bookings.reduce(function (sum, booking) { return sum + booking.amountCents; }, 0)
    };
  }

  var POS_REFRESH_SCOPE_KEYS = ["profile", "draft", "invoices", "payments", "deliveries", "bank"];

  function normalizePosRefreshScopes(requested) {
    var scopes = {};
    var values = requested == null
      ? ["profile", "draft", "invoices", "bank"]
      : (Array.isArray(requested) ? requested : [requested]);
    values.forEach(function (value) {
      if (POS_REFRESH_SCOPE_KEYS.indexOf(value) !== -1) scopes[value] = true;
    });
    if (scopes.invoices) {
      delete scopes.payments;
      delete scopes.deliveries;
    }
    return scopes;
  }

  function mergePosRefreshScopes(target, requested) {
    var merged = Object.assign({}, target || {}, normalizePosRefreshScopes(requested));
    if (merged.invoices) {
      delete merged.payments;
      delete merged.deliveries;
    }
    return merged;
  }

  async function fetchAllRows(buildQuery, pageSize) {
    var size = Math.min(Math.max(integer(pageSize, 500), 1), 1000);
    var rows = [];
    var offset = 0;
    while (true) {
      var result = await buildQuery().range(offset, offset + size - 1);
      if (result.error) return { data: null, error: result.error };
      var page = result.data || [];
      rows = rows.concat(page);
      if (page.length < size) return { data: rows, error: null };
      offset += size;
    }
  }

  function localStateSnapshot(current, connected, ownerUserId) {
    var source = current || {};
    var invoices = Array.isArray(source.invoices) ? source.invoices : [];
    var localInvoices = invoices.filter(function (invoice) { return !invoice.serverStored; });
    return Object.assign({}, source, {
      profile: connected ? defaultProfile() : Object.assign(defaultProfile(), source.profile || {}),
      invoices: localInvoices,
      workOrders: [],
      bankTransactions: [],
      storageOwnerUserId: connected ? String(ownerUserId || source.storageOwnerUserId || "") : ""
    });
  }

  function mergeBankTransactionRows(unmatchedRows, confirmedRows) {
    var seen = Object.create(null);
    return (unmatchedRows || []).concat(confirmedRows || []).filter(function (row) {
      var id = String(row && row.id || "");
      if (!id || seen[id]) return false;
      seen[id] = true;
      return true;
    }).sort(function (left, right) {
      var dateOrder = String(right.booked_on || "").localeCompare(String(left.booked_on || ""));
      return dateOrder || String(right.id || "").localeCompare(String(left.id || ""));
    });
  }

  function archiveCapabilityView(capability) {
    var archive = capability || {};
    var failed = Number(archive.failureCount || 0) > 0 || Number(archive.replicaFailureCount || 0) > 0;
    var unavailable = Boolean(archive.error);
    var pending = Boolean(archive.loading || (!archive.loaded && !unavailable));
    var allVerified = Boolean(archive.loaded && !unavailable && !failed &&
      Number(archive.uncheckedCount || 0) === 0 && Number(archive.replicaPendingCount || 0) === 0);
    var documentCount = Number(archive.documentCount || 0);
    var verifiedCount = Number(archive.verifiedCount || 0);
    var replicatedCount = Number(archive.replicatedCount || 0);
    return {
      failed: failed,
      unavailable: unavailable,
      pending: pending,
      allVerified: allVerified,
      badgeText: pending ? "Preverjam" : unavailable ? "Ni dosegljivo" : failed ? "Potrebna pozornost" : allVerified ? "Dvojno zaščiten" : "Kopiranje čaka",
      integrityText: pending || unavailable ? "—" : documentCount ? verifiedCount + " / " + documentCount + " preverjenih" : "ni izvirnikov",
      backupText: pending ? "preverjam" : unavailable ? "ni dosegljivo" : archive.wormProviderReady
        ? "AWS Object Lock: " + replicatedCount + " / " + documentCount
        : "AWS Object Lock še ni povezan",
      copyText: pending
        ? "Nalagam dejansko stanje PDF/XML izvirnikov in zaklenjenih ločenih kopij …"
        : unavailable
          ? "Stanja arhiva trenutno ni mogoče prebrati. Produkcija ostaja varno zaklenjena."
          : failed
            ? "Najmanj en izvirnik ali njegova AWS kopija ni prestala preverjanja. Produkcija ostaja zaklenjena."
            : archive.productionReady
              ? "PDF/XML izvirniki imajo preverjeno SHA-256 sled in ločeno AWS različico z 8-letnim Compliance zaklepom."
              : allVerified
                ? "Vsi trenutni izvirniki imajo preverjeno ločeno AWS Object Lock kopijo. Produkcija čaka poslovni AWS račun in Compliance način."
                : "Izvirniki ostajajo v Supabase; ločene AWS Object Lock kopije se še pripravljajo. Produkcija ostaja zaklenjena."
    };
  }

  function stripeReturnMessage(status) {
    if (status === "succeeded") return "Stripe TEST plačilo je potrjeno s podpisanim webhookom.";
    if (status === "partially_refunded") return "Stripe TEST plačilo je potrjeno; del zneska je že povrnjen.";
    if (status === "refunded") return "Stripe TEST plačilo je potrjeno in v celoti povrnjeno.";
    if (status === "cancelled") return "Stripe TEST plačilo je preklicano.";
    if (status === "failed") return "Stripe TEST plačilo ni uspelo.";
    return "Stripe TEST plačilo še čaka na podpisano potrditev.";
  }

  var Core = {
    isoToday: isoToday,
    addDays: addDays,
    parseMoneyToCents: parseMoneyToCents,
    validateRefundAmountInput: validateRefundAmountInput,
    parseQuantityMilli: parseQuantityMilli,
    calculateItem: calculateItem,
    calculateTotals: calculateTotals,
    profileReadiness: profileReadiness,
    validIban: validIban,
    profileValidationError: profileValidationError,
    profileChangeRequiresConfirmation: profileChangeRequiresConfirmation,
    profileForPreview: profileForPreview,
    validateStep: validateStep,
    liveInvoiceDateError: liveInvoiceDateError,
    liveConstructionWithholdingError: liveConstructionWithholdingError,
    propertyRetentionNotice: propertyRetentionNotice,
    buildEpcPayload: buildEpcPayload,
    deliveryRecommendation: deliveryRecommendation,
    defaultDatevSettings: defaultDatevSettings,
    normalizeDatevSettings: normalizeDatevSettings,
    validateDatevSettings: validateDatevSettings,
    buildDatevExport: buildDatevExport,
    berlinDateKey: berlinDateKey,
    datevTimestamp: datevTimestamp,
    datevDocumentNumber: datevDocumentNumber,
    DATEV_BOOKING_HEADERS: DATEV_BOOKING_HEADERS,
    profileToDatabase: profileToDatabase,
    profileFromDatabase: profileFromDatabase,
    draftToDatabasePayload: draftToDatabasePayload,
    draftFromDatabasePayload: draftFromDatabasePayload,
    invoiceFingerprint: invoiceFingerprint,
    mergeInvoiceSources: mergeInvoiceSources,
    parseBankCsv: parseBankCsv,
    parseCamt053: parseCamt053,
    parseBankStatement: parseBankStatement,
    bankImportFileError: bankImportFileError,
    MAX_BANK_IMPORT_BYTES: MAX_BANK_IMPORT_BYTES,
    matchBankTransaction: matchBankTransaction,
    resolveBankMatches: resolveBankMatches,
    invoiceOutstandingCents: invoiceOutstandingCents,
    latestManualPaymentCandidate: latestManualPaymentCandidate,
    invoiceDaysOverdue: invoiceDaysOverdue,
    filterInvoices: filterInvoices,
    invoiceOverview: invoiceOverview,
    normalizePosRefreshScopes: normalizePosRefreshScopes,
    mergePosRefreshScopes: mergePosRefreshScopes,
    fetchAllRows: fetchAllRows,
    localStateSnapshot: localStateSnapshot,
    mergeBankTransactionRows: mergeBankTransactionRows,
    archiveCapabilityView: archiveCapabilityView,
    stripeReturnMessage: stripeReturnMessage,
    paymentFromServer: paymentFromServer,
    paymentSummary: paymentSummary,
    serverInvoiceToLocal: serverInvoiceToLocal,
    buildAdjustmentChanges: buildAdjustmentChanges,
    normalizeReplacementContext: normalizeReplacementContext,
    replacementDraftFromInvoice: replacementDraftFromInvoice,
    workOrderPayloadFromDraft: workOrderPayloadFromDraft,
    workOrderFromServer: workOrderFromServer,
    requiresEarlyStartEvidence: requiresEarlyStartEvidence,
    requiresContractConfirmation: requiresContractConfirmation,
    consumerServiceRightExpired: consumerServiceRightExpired,
    consumerWithdrawalAvailable: consumerWithdrawalAvailable,
    workOrderActions: workOrderActions,
    withdrawalTaxCorrectionState: withdrawalTaxCorrectionState,
    workOrderFinalState: workOrderFinalState,
    prepareWorkOrderInvoiceDraft: prepareWorkOrderInvoiceDraft,
    defaultProfile: defaultProfile,
    defaultDraft: defaultDraft
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Core;
  global.UJPosTerminalCore = Core;
  if (!global.document) return;

  var document = global.document;
  var state = loadState();
  var backend = {
    client: typeof supabaseKlient !== "undefined" && supabaseKlient && supabaseKlient.auth ? supabaseKlient : null,
    userId: null,
    ready: false,
    serverStateLoaded: false,
    bankReady: false,
    syncing: false,
    pendingRefreshScopes: {},
    refreshPromise: null,
    error: ""
  };
  var currentView = "home";
  var currentStep = 1;
  var activeInvoiceId = null;
  var invoiceDetailReturnView = "home";
  var invoiceOverviewFilter = "all";
  var invoiceOverviewQuery = "";
  var adjustmentInvoiceId = null;
  var adjustmentSubmitting = false;
  var deliveryInvoiceId = null;
  var deliveryRequestKey = null;
  var deliverySubmitting = false;
  var deliveryCapability = { provider: "resend", configured: false, sendEnabled: false, testEnabled: false, liveEnabled: false, mode: "sandbox" };
  var fiskalyCapability = { configured: false, connected: false, integrationReady: false, environment: "test", tssCount: 0, tssState: "", clientState: "", cashModuleEnabled: false };
  var fiskalyTestRunning = false;
  var FISKALY_TRAINING_ID_KEY = "uj_pos_fiskaly_training_id";
  var FISKALY_TRAINING_RECEIPT_KEY = "uj_pos_fiskaly_training_receipt";
  var fiskalyTestRequestId = null;
  try { fiskalyTestRequestId = global.sessionStorage.getItem(FISKALY_TRAINING_ID_KEY) || null; } catch (_error) {}
  var fiskalyReceiptItems = [
    { id: uid("fiskaly-item"), description: "Arbeitszeit (Test)", quantityMilli: 1000, unitGrossCents: 11900, vatRate: "19" },
    { id: uid("fiskaly-item"), description: "Testmaterial", quantityMilli: 1000, unitGrossCents: 1070, vatRate: "7" }
  ];
  var finapiBankCapability = { loaded: false, loading: false, syncing: false, configured: false, connected: false, pending: false, environment: "sandbox", bankName: "", lastError: false };
  var archiveCapability = { loaded: false, loading: false, error: "", productionReady: false, documentCount: 0, verifiedCount: 0, uncheckedCount: 0, failureCount: 0, replicatedCount: 0, replicaPendingCount: 0, replicaFailureCount: 0, retentionYears: 8, independentBackupReady: false, wormProviderReady: false, wormEnvironment: "not_configured", objectLockMode: null };
  var datevCloudCapability = { loaded: false, loading: false, working: false, configured: false, connected: false, environment: "mock", clientName: "", latestTransfer: null, lastError: "" };
  var toastTimer = 0;
  var dialogCallback = null;
  var dialogValidator = null;

  function loadState() {
    var initial = { profile: defaultProfile(), invoices: [], workOrders: [], bankTransactions: [], draft: null, sequence: 0, storageOwnerUserId: "" };
    try {
      var saved = JSON.parse(global.sessionStorage.getItem(STORAGE_KEY) || global.localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return initial;
      return {
        profile: Object.assign(defaultProfile(), saved.profile || {}),
        invoices: Array.isArray(saved.invoices) ? saved.invoices : [],
        workOrders: Array.isArray(saved.workOrders) ? saved.workOrders : [],
        bankTransactions: Array.isArray(saved.bankTransactions) ? saved.bankTransactions : [],
        draft: saved.draft && typeof saved.draft === "object" ? saved.draft : null,
        sequence: integer(saved.sequence, 0),
        storageOwnerUserId: String(saved.storageOwnerUserId || "")
      };
    } catch (_error) {
      return initial;
    }
  }

  function persist() {
    try {
      var ownerUserId = backend.userId || state.storageOwnerUserId || "";
      var connected = Boolean(backend.serverStateLoaded || ownerUserId);
      var localSnapshot = localStateSnapshot(state, connected, ownerUserId);
      if (connected) {
        global.localStorage.removeItem(STORAGE_KEY);
        global.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(localSnapshot));
      } else {
        global.sessionStorage.removeItem(STORAGE_KEY);
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(localSnapshot));
      }
    } catch (_error) { /* lokalni fallback ni obvezen */ }
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
    var nextUserId = result.data && result.data.user && result.data.user.id || null;
    if (nextUserId && state.storageOwnerUserId && state.storageOwnerUserId !== nextUserId) {
      state = { profile: defaultProfile(), invoices: [], workOrders: [], bankTransactions: [], draft: null, sequence: 0, storageOwnerUserId: "" };
      try { global.sessionStorage.removeItem(STORAGE_KEY); } catch (_error) {}
    }
    backend.userId = nextUserId;
    if (nextUserId) state.storageOwnerUserId = nextUserId;
    return backend.userId;
  }

  async function saveProfileToServer() {
    if (!backend.client || !backend.userId) throw new Error("Varna hramba ni povezana.");
    var result = await backend.client.from("pos_business_profiles")
      .upsert(profileToDatabase(state.profile, backend.userId), { onConflict: "user_id" })
      .select("user_id").single();
    if (result.error) throw result.error;
    backend.ready = true;
    backend.serverStateLoaded = true;
    persist();
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
    backend.serverStateLoaded = true;
    persist();
    backendMessage("Osnutek je varno shranjen", "ready");
    return result.data.id;
  }

  function adjustmentFromServer(row, documentsByAdjustment, einvoiceDocumentsByAdjustment) {
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
      document: documentsByAdjustment && documentsByAdjustment[row.id] || null,
      einvoiceDocumentReady: Boolean(einvoiceDocumentsByAdjustment && einvoiceDocumentsByAdjustment[row.id]),
      einvoiceDocument: einvoiceDocumentsByAdjustment && einvoiceDocumentsByAdjustment[row.id] || null
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

  function bankTransactionFromServer(row) {
    return {
      id: row.id,
      bookedOn: row.booked_on,
      amountCents: integer(row.amount_cents, 0),
      currency: row.currency || "EUR",
      externalReference: row.external_reference || "",
      counterpartyName: row.counterparty_name || "",
      counterpartyIban: row.counterparty_iban || "",
      remittanceInfo: row.remittance_info || "",
      sourceAccountId: row.source_account_id || "",
      sourceAccountName: row.source_account_name || "",
      sourceAccountIban: row.source_account_iban || "",
      status: row.status || "unmatched",
      confirmedInvoiceId: row.confirmed_invoice_id || null,
      confirmedPaymentId: row.confirmed_payment_id || null,
      confirmedAt: row.confirmed_at || null
    };
  }

  function paymentFromServer(row) {
    return {
      id: row.id,
      invoiceId: row.invoice_id,
      amountCents: integer(row.amount_cents, 0),
      currency: row.currency || "EUR",
      method: row.method || "manual",
      provider: row.provider || (row.source_bank_transaction_id ? "finapi" : "manual"),
      providerReference: row.provider_reference || "",
      paidAt: row.paid_at || null,
      sourceBankTransactionId: row.source_bank_transaction_id || null,
      status: row.status || "succeeded",
      refundedCents: integer(row.refunded_cents, 0),
      failureCode: row.failure_code || "",
      checkoutSessionId: row.checkout_session_id || null,
      externalPaymentId: row.external_payment_id || null,
      expiresAt: row.expires_at || null,
      createdAt: row.created_at || row.paid_at || null
    };
  }

  function paymentSummary(payments, grossCents, currentStatus) {
    var paidCents = (payments || []).reduce(function (sum, payment) {
      if (["succeeded", "partially_refunded"].indexOf(payment.status || "succeeded") === -1) return sum;
      return sum + Math.max(0, integer(payment.amountCents, 0) - integer(payment.refundedCents, 0));
    }, 0);
    return {
      paidCents: paidCents,
      status: currentStatus === "cancelled" ? "cancelled" : currentStatus === "credited" ? "credited" : paidCents >= integer(grossCents, 0) ? "paid" : paidCents > 0 ? "partial" : "open"
    };
  }

  function serverInvoiceToLocal(row, paymentsByInvoice, documentsByInvoice, adjustmentsByInvoice, deliveriesByInvoice, einvoiceDocumentsByInvoice) {
    var snapshot = row.snapshot || {};
    var adjustments = adjustmentsByInvoice && adjustmentsByInvoice[row.id] || [];
    var corrections = adjustments.filter(function (entry) { return entry.type === "correction"; });
    var latestCorrection = corrections[corrections.length - 1];
    var effectivePayload = latestCorrection && latestCorrection.snapshot && latestCorrection.snapshot.effective_draft || snapshot.draft || {};
    var draft = draftFromDatabasePayload(effectivePayload, true);
    var payments = paymentsByInvoice && paymentsByInvoice[row.id] || [];
    var cancelled = adjustments.some(function (entry) { return entry.type === "cancellation"; });
    var creditDelta = adjustments.filter(function (entry) { return entry.type === "credit_note"; })
      .reduce(function (sum, entry) { return sum + integer(entry.deltaGrossCents, 0); }, 0);
    var adjustedGrossCents = Math.max(0, integer(row.gross_cents, 0) + creditDelta);
    var hasCreditNote = creditDelta < 0;
    var paymentState = paymentSummary(payments, adjustedGrossCents, cancelled ? "cancelled" : hasCreditNote && adjustedGrossCents === 0 ? "credited" : "open");
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
      status: paymentState.status,
      paidCents: paymentState.paidCents,
      adjustedGrossCents: adjustedGrossCents,
      hasCreditNote: hasCreditNote,
      payments: payments,
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

  function applyPaymentRefresh(rows) {
    var paymentsByInvoice = {};
    (rows || []).forEach(function (row) {
      var payment = paymentFromServer(row);
      if (!paymentsByInvoice[payment.invoiceId]) paymentsByInvoice[payment.invoiceId] = [];
      paymentsByInvoice[payment.invoiceId].push(payment);
    });
    state.invoices.forEach(function (invoice) {
      if (!invoice.serverStored) return;
      invoice.payments = paymentsByInvoice[invoice.id] || [];
      var lockedStatus = invoice.status === "cancelled" ? "cancelled" : invoice.hasCreditNote && !invoice.adjustedGrossCents ? "credited" : "open";
      var paymentState = paymentSummary(invoice.payments, invoice.adjustedGrossCents == null ? invoice.totals && invoice.totals.grossCents : invoice.adjustedGrossCents, lockedStatus);
      invoice.paidCents = paymentState.paidCents;
      invoice.status = paymentState.status;
    });
  }

  function applyDeliveryRefresh(deliveryRows, eventRows) {
    var eventsByDelivery = {};
    (eventRows || []).forEach(function (row) {
      if (!eventsByDelivery[row.delivery_id]) eventsByDelivery[row.delivery_id] = [];
      eventsByDelivery[row.delivery_id].push(row);
    });
    var deliveriesByInvoice = {};
    (deliveryRows || []).forEach(function (row) {
      if (!deliveriesByInvoice[row.invoice_id]) deliveriesByInvoice[row.invoice_id] = [];
      deliveriesByInvoice[row.invoice_id].push(deliveryFromServer(row, eventsByDelivery));
    });
    state.invoices.forEach(function (invoice) {
      if (invoice.serverStored) invoice.deliveries = deliveriesByInvoice[invoice.id] || [];
    });
  }

  async function loadBankTransactionRows(userId) {
    var columns = "id,booked_on,amount_cents,currency,external_reference,counterparty_name,counterparty_iban,remittance_info,source_account_id,source_account_name,source_account_iban,status,confirmed_invoice_id,confirmed_payment_id,confirmed_at";
    var responses = await Promise.all([
      fetchAllRows(function () {
        return backend.client.from("pos_bank_transactions").select(columns).eq("user_id", userId).eq("status", "unmatched").order("booked_on", { ascending: false }).order("id", { ascending: false });
      }),
      fetchAllRows(function () {
        return backend.client.from("pos_bank_transactions").select(columns).eq("user_id", userId).eq("status", "confirmed").order("booked_on", { ascending: false }).order("id", { ascending: false });
      })
    ]);
    var error = responses.map(function (entry) { return entry.error; }).filter(Boolean)[0] || null;
    return { data: error ? null : mergeBankTransactionRows(responses[0].data, responses[1].data), error: error };
  }

  async function loadFullServerState(scopes) {
    if (!backend.client || backend.syncing) return;
    backend.syncing = true;
    backendMessage("Povezujem varno hrambo …", "loading");
    try {
      var userId = backend.userId || await getBackendUser();
      if (!userId) return;
      var skipped = function () { return Promise.resolve({ data: null, error: null }); };
      var responses = await Promise.all([
        scopes.profile ? backend.client.from("pos_business_profiles").select("*").eq("user_id", userId).maybeSingle() : skipped(),
        scopes.draft ? backend.client.from("pos_invoice_drafts").select("id,payload,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1) : skipped(),
        fetchAllRows(function () { return backend.client.from("pos_invoices").select("*").eq("user_id", userId).order("issued_at", { ascending: false }).order("id", { ascending: false }); }),
        fetchAllRows(function () { return backend.client.from("pos_payments").select("id,invoice_id,amount_cents,currency,method,provider,provider_reference,paid_at,source_bank_transaction_id,status,refunded_cents,failure_code,checkout_session_id,external_payment_id,expires_at,created_at").eq("user_id", userId).order("created_at", { ascending: true }).order("id", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_invoice_documents").select("invoice_id,sha256,byte_size,created_at,generator_version").eq("user_id", userId).order("invoice_id", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_invoice_adjustments").select("*").eq("user_id", userId).order("issued_at", { ascending: true }).order("id", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_adjustment_documents").select("adjustment_id,sha256,byte_size,created_at,generator_version").eq("user_id", userId).order("adjustment_id", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_invoice_replacements").select("*").eq("user_id", userId).order("created_at", { ascending: true }).order("replacement_invoice_id", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_invoice_deliveries").select("*").eq("user_id", userId).order("created_at", { ascending: true }).order("id", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_invoice_delivery_events").select("*").eq("user_id", userId).order("created_at", { ascending: true }).order("id", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_einvoice_documents").select("invoice_id,sha256,byte_size,created_at,generator_version,xrechnung_version,validation_status,validator_version,validator_config_version,validated_at").eq("user_id", userId).order("invoice_id", { ascending: true }); }),
        scopes.bank ? loadBankTransactionRows(userId) : skipped(),
        fetchAllRows(function () { return backend.client.from("pos_work_orders").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).order("id", { ascending: false }); }),
        fetchAllRows(function () { return backend.client.from("pos_work_order_invoices").select("work_order_id,invoice_id,invoice_kind,progress_percent,net_cents,tax_cents,gross_cents,created_at").eq("user_id", userId).order("created_at", { ascending: true }).order("invoice_id", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_work_order_acceptances").select("work_order_id,offer_document_id,offer_sha256,evidence,accepted_at,accepted_on,recorded_at").eq("user_id", userId).order("recorded_at", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_work_order_cancellations").select("work_order_id,status_before,reason,offer_document_id,offer_sha256,cancelled_at,recorded_at").eq("user_id", userId).order("recorded_at", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_work_order_early_start_evidence").select("work_order_id,contract_context,evidence,offer_document_id,offer_sha256,started_at,value_compensation_informed,right_expiry_acknowledged,request_on_durable_medium,recorded_at").eq("user_id", userId).order("recorded_at", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_work_order_withdrawals").select("work_order_id,status_before,declared_on,evidence,value_compensation_review_required,received_at,recorded_at").eq("user_id", userId).order("recorded_at", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_contract_confirmation_documents").select("id,work_order_id,offer_sha256,accepted_on,sha256,byte_size,generator_version,created_at").eq("user_id", userId).order("created_at", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_contract_confirmation_deliveries").select("work_order_id,confirmation_document_id,channel,recipient,evidence,electronic_consent_evidence,delivered_on,recorded_at").eq("user_id", userId).order("recorded_at", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_consumer_withdrawal_settlements").select("*").eq("user_id", userId).order("assessed_at", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_consumer_withdrawal_refund_records").select("*").eq("user_id", userId).order("recorded_at", { ascending: true }); }),
        fetchAllRows(function () { return backend.client.from("pos_adjustment_einvoice_documents").select("adjustment_id,sha256,byte_size,created_at,generator_version,xrechnung_version,validation_status,validator_version,validator_config_version,validated_at").eq("user_id", userId).order("adjustment_id", { ascending: true }); })
      ]);
      var firstError = responses.slice(0, 23).map(function (entry) { return entry.error; }).filter(Boolean)[0];
      if (firstError) throw firstError;
      backend.ready = true;
      backend.serverStateLoaded = true;
      if (responses[0].data) state.profile = profileFromDatabase(responses[0].data);
      var paymentsByInvoice = {};
      (responses[3].data || []).forEach(function (row) {
        var payment = paymentFromServer(row);
        if (!paymentsByInvoice[payment.invoiceId]) paymentsByInvoice[payment.invoiceId] = [];
        paymentsByInvoice[payment.invoiceId].push(payment);
      });
      var documentsByInvoice = {};
      (responses[4].data || []).forEach(function (entry) { documentsByInvoice[entry.invoice_id] = entry; });
      var einvoiceDocumentsByInvoice = {};
      (responses[10].data || []).forEach(function (entry) { einvoiceDocumentsByInvoice[entry.invoice_id] = entry; });
      var documentsByAdjustment = {};
      (responses[6].data || []).forEach(function (entry) { documentsByAdjustment[entry.adjustment_id] = entry; });
      var einvoiceDocumentsByAdjustment = {};
      (responses[22].data || []).forEach(function (entry) { einvoiceDocumentsByAdjustment[entry.adjustment_id] = entry; });
      var adjustmentsByInvoice = {};
      (responses[5].data || []).forEach(function (row) {
        if (!adjustmentsByInvoice[row.original_invoice_id]) adjustmentsByInvoice[row.original_invoice_id] = [];
        adjustmentsByInvoice[row.original_invoice_id].push(adjustmentFromServer(row, documentsByAdjustment, einvoiceDocumentsByAdjustment));
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
      var serverInvoices = (responses[2].data || []).map(function (row) { return serverInvoiceToLocal(row, paymentsByInvoice, documentsByInvoice, adjustmentsByInvoice, deliveriesByInvoice, einvoiceDocumentsByInvoice); });
      var linksByWorkOrder = {};
      (responses[13].data || []).forEach(function (link) {
        if (!linksByWorkOrder[link.work_order_id]) linksByWorkOrder[link.work_order_id] = [];
        linksByWorkOrder[link.work_order_id].push(link);
      });
      var acceptanceByWorkOrder = {};
      (responses[14].data || []).forEach(function (acceptance) { acceptanceByWorkOrder[acceptance.work_order_id] = acceptance; });
      var cancellationByWorkOrder = {};
      (responses[15].data || []).forEach(function (cancellation) { cancellationByWorkOrder[cancellation.work_order_id] = cancellation; });
      var earlyStartByWorkOrder = {};
      (responses[16].data || []).forEach(function (entry) { earlyStartByWorkOrder[entry.work_order_id] = entry; });
      var withdrawalByWorkOrder = {};
      (responses[17].data || []).forEach(function (entry) { withdrawalByWorkOrder[entry.work_order_id] = entry; });
      var contractDocumentByWorkOrder = {};
      (responses[18].data || []).forEach(function (entry) { contractDocumentByWorkOrder[entry.work_order_id] = entry; });
      var contractDeliveryByWorkOrder = {};
      (responses[19].data || []).forEach(function (entry) { contractDeliveryByWorkOrder[entry.work_order_id] = entry; });
      var withdrawalSettlementByWorkOrder = {};
      (responses[20].data || []).forEach(function (entry) { withdrawalSettlementByWorkOrder[entry.work_order_id] = entry; });
      var withdrawalRefundsByWorkOrder = {};
      (responses[21].data || []).forEach(function (entry) {
        if (!withdrawalRefundsByWorkOrder[entry.work_order_id]) withdrawalRefundsByWorkOrder[entry.work_order_id] = [];
        withdrawalRefundsByWorkOrder[entry.work_order_id].push(entry);
      });
      if (scopes.bank) {
        backend.bankReady = !responses[11].error;
        state.bankTransactions = backend.bankReady ? (responses[11].data || []).map(bankTransactionFromServer) : [];
      }
      var invoicesById = {};
      var adjustmentsById = {};
      serverInvoices.forEach(function (invoice) {
        invoicesById[invoice.id] = invoice;
        (invoice.adjustments || []).forEach(function (adjustment) { adjustmentsById[adjustment.id] = adjustment; });
      });
      Object.keys(linksByWorkOrder).forEach(function (workOrderId) {
        linksByWorkOrder[workOrderId].forEach(function (link) {
          var linkedInvoice = invoicesById[link.invoice_id] || null;
          link.invoice = linkedInvoice;
          link.invoice_number = linkedInvoice && linkedInvoice.number || "";
          link.issue_date = linkedInvoice && linkedInvoice.draft && linkedInvoice.draft.issueDate || "";
          link.paid_cents = linkedInvoice ? linkedInvoice.paidCents : 0;
        });
      });
      state.workOrders = (responses[12].data || []).map(function (row) {
        return workOrderFromServer(
          row,
          linksByWorkOrder[row.id] || [],
          acceptanceByWorkOrder[row.id] || null,
          cancellationByWorkOrder[row.id] || null,
          earlyStartByWorkOrder[row.id] || null,
          withdrawalByWorkOrder[row.id] || null,
          contractDocumentByWorkOrder[row.id] || null,
          contractDeliveryByWorkOrder[row.id] || null,
          withdrawalSettlementByWorkOrder[row.id] || null,
          withdrawalRefundsByWorkOrder[row.id] || []
        );
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
      state.invoices = mergeInvoiceSources(serverInvoices, localTests);
      if (responses[1].data && responses[1].data[0]) {
        state.draft = draftFromDatabasePayload(responses[1].data[0].payload, false);
        state.draft.serverId = responses[1].data[0].id;
      }
      persist();
      backendMessage("Sinhronizirano", "ready");
      renderHome();
      await loadArchiveCapability(false, false);
    } catch (error) {
      backend.ready = false;
      backend.bankReady = false;
      backendMessage(databaseErrorMessage(error), "error");
      renderHome();
    } finally {
      backend.syncing = false;
      var bankBackdrop = query("[data-bank-backdrop]");
      if (bankBackdrop && !bankBackdrop.hidden) renderBankSheet();
    }
  }

  async function loadTargetedServerState(scopes) {
    if (!backend.client) return;
    backend.syncing = true;
    backendMessage("Osvežujem spremenjene POS podatke …", "loading");
    try {
      var userId = backend.userId || await getBackendUser();
      if (!userId) return;
      var requests = [];
      var keys = [];
      function add(key, request) { keys.push(key); requests.push(request); }
      if (scopes.payments) add("payments", backend.client.from("pos_payments").select("id,invoice_id,amount_cents,currency,method,provider,provider_reference,paid_at,source_bank_transaction_id,status,refunded_cents,failure_code,checkout_session_id,external_payment_id,expires_at,created_at").eq("user_id", userId).order("created_at", { ascending: true }));
      if (scopes.deliveries) {
        add("deliveries", backend.client.from("pos_invoice_deliveries").select("*").eq("user_id", userId).order("created_at", { ascending: true }));
        add("deliveryEvents", backend.client.from("pos_invoice_delivery_events").select("*").eq("user_id", userId).order("created_at", { ascending: true }));
      }
      if (scopes.bank) add("bank", loadBankTransactionRows(userId));
      var values = await Promise.all(requests);
      var responses = {};
      keys.forEach(function (key, index) { responses[key] = values[index]; });
      var firstCoreError = [responses.payments, responses.deliveries, responses.deliveryEvents].filter(Boolean).map(function (entry) { return entry.error; }).filter(Boolean)[0];
      if (firstCoreError) throw firstCoreError;
      if (responses.payments) applyPaymentRefresh(responses.payments.data || []);
      if (responses.deliveries) applyDeliveryRefresh(responses.deliveries.data || [], responses.deliveryEvents.data || []);
      if (responses.bank) {
        backend.bankReady = !responses.bank.error;
        state.bankTransactions = backend.bankReady ? (responses.bank.data || []).map(bankTransactionFromServer) : [];
      }
      persist();
      backendMessage("Sinhronizirano", "ready");
      renderHome();
      await loadArchiveCapability(false, false);
    } catch (error) {
      backend.ready = false;
      backendMessage(databaseErrorMessage(error), "error");
      renderHome();
    } finally {
      backend.syncing = false;
      var bankBackdrop = query("[data-bank-backdrop]");
      if (bankBackdrop && !bankBackdrop.hidden) renderBankSheet();
    }
  }

  async function runServerRefreshQueue() {
    try {
      while (Object.keys(backend.pendingRefreshScopes).length) {
        var scopes = backend.pendingRefreshScopes;
        backend.pendingRefreshScopes = {};
        if (scopes.profile || scopes.draft || scopes.invoices) await loadFullServerState(scopes);
        else await loadTargetedServerState(scopes);
      }
    } finally {
      backend.refreshPromise = null;
    }
  }

  function loadServerState(requestedScopes) {
    if (!backend.client) return Promise.resolve();
    backend.pendingRefreshScopes = mergePosRefreshScopes(backend.pendingRefreshScopes, requestedScopes);
    if (!backend.refreshPromise) backend.refreshPromise = runServerRefreshQueue();
    return backend.refreshPromise;
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
    var field = query("[data-dialog-field]");
    var input = query("[data-dialog-input]");
    var select = query("[data-dialog-select]");
    var inputOptions = options && options.input;
    var usesSelect = Boolean(inputOptions && Array.isArray(inputOptions.options));
    var control = usesSelect ? select : input;
    query("[data-dialog-title]").textContent = title;
    query("[data-dialog-copy]").textContent = copy;
    query("[data-dialog-cancel]").hidden = Boolean(options && options.cancel === false);
    query("[data-dialog-confirm]").textContent = options && options.confirmText || "V redu";
    dialogCallback = options && options.onConfirm || null;
    dialogValidator = options && options.validate || null;
    field.hidden = !inputOptions;
    input.hidden = usesSelect;
    select.hidden = !usesSelect;
    select.innerHTML = usesSelect ? inputOptions.options.map(function (option) {
      return "<option value=\"" + escapeHtml(option.value) + "\">" + escapeHtml(option.label) + "</option>";
    }).join("") : "";
    input.type = inputOptions && inputOptions.type || "text";
    input.inputMode = inputOptions && inputOptions.inputMode || (input.type === "date" ? "" : "text");
    input.min = inputOptions && inputOptions.min || "";
    input.max = inputOptions && inputOptions.max || "";
    control.value = inputOptions && inputOptions.value || "";
    input.placeholder = inputOptions && inputOptions.placeholder || "";
    input.maxLength = inputOptions && inputOptions.maxLength || 524288;
    query("[data-dialog-field-label]").textContent = inputOptions && inputOptions.label || "Znesek";
    query("[data-dialog-field-hint]").textContent = inputOptions && inputOptions.hint || "";
    backdrop.hidden = false;
    document.documentElement.classList.add("uj-modal-odprt");
    document.body.classList.add("uj-modal-odprt");
    (inputOptions ? control : query("[data-dialog-confirm]")).focus();
    if (inputOptions && !usesSelect && input.type !== "date") input.select();
  }

  function closeDialog(confirmed) {
    var input = query("[data-dialog-input]");
    var select = query("[data-dialog-select]");
    var control = select.hidden ? input : select;
    var inputValue = control.value;
    if (confirmed && dialogValidator) {
      var validationMessage = dialogValidator(inputValue);
      if (validationMessage) {
        showToast(validationMessage);
        control.focus();
        if (control === input && input.type !== "date") input.select();
        return;
      }
    }
    query("[data-dialog-backdrop]").hidden = true;
    document.documentElement.classList.remove("uj-modal-odprt");
    document.body.classList.remove("uj-modal-odprt");
    var callback = dialogCallback;
    dialogCallback = null;
    dialogValidator = null;
    if (!query("[data-bank-backdrop]").hidden || !query("[data-adjustment-backdrop]").hidden || !query("[data-delivery-backdrop]").hidden || !query("[data-datev-backdrop]").hidden) {
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
    }
    if (confirmed && callback) callback(inputValue);
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
    if (name === "invoices") renderInvoiceOverview();
    if (name === "work-orders") renderWorkOrders();
    if (name === "settings") {
      fillForm(query("#pos-profile-form"), state.profile);
      loadFiskalyCapability(false);
    }
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
    var live = productionReady();
    mode.classList.toggle("is-live", live);
    query("[data-mode-title]").textContent = live ? "Produktion" : "Testbetrieb";
    query("[data-mode-copy]").textContent = live ? "Varna izdaja je omogočena" : readiness.live && backend.ready ? "Čaka potrjena arhivska kopija" : readiness.live ? "Čaka varna povezava z bazo" : "Pravni računi so zaklenjeni";
    renderArchiveCapability();
    renderInvoiceList();
  }

  function workOrderStatusLabel(status) {
    return {
      draft: "Osnutek ponudbe", offered: "Ponudba zaklenjena", accepted: "Naročilo sprejeto",
      in_progress: "Delo poteka", completed: "Delo zaključeno", invoiced: "Zaključni račun izdan", cancelled: "Preklicano",
      withdrawn: "Potrošnikov odstop"
    }[status] || status;
  }

  function workOrderActionLabel(action) {
    return {
      edit: "Uredi ponudbo", offer: "Zakleni ponudbo", pdf: "Ponudba PDF", contract_pdf: "Potrdilo pogodbe PDF", contract_delivery: "Zabeleži izročitev", accept: "Potrdi sprejem", start: "Začni delo", complete: "Zaključi delo",
      progress: "Abschlagsrechnung", final: "Schlussrechnung", cancel: "Prekliči", withdraw: "Zabeleži odstop",
      withdrawal_settlement: "Denarni pregled odstopa", withdrawal_refund: "Zabeleži vračilo",
      withdrawal_tax_correction: "Uredi davčni Storno",
      withdrawal_tax_credit: "Izdaj davčni dobropis"
    }[action] || action;
  }

  function renderWorkOrders() {
    var root = query("[data-work-order-list]");
    if (!root) return;
    var rows = state.workOrders || [];
    query("[data-work-order-count]").textContent = rows.length ? rows.length + (rows.length === 1 ? " projekt" : " projektov") : "Ni projektov";
    if (!rows.length) {
      root.innerHTML = "<div class=\"pos-empty\"><span><svg><use href=\"#i-building\"/></svg></span><strong>Pripravite prvo ponudbo</strong><p>Po sprejemu se ponudba spremeni v naročilo, nato pa vodi do Abschlags- ali Schlussrechnung.</p></div>";
      return;
    }
    root.innerHTML = rows.map(function (order) {
      var actions = workOrderActions(order);
      var finalState = workOrderFinalState(order, !profileReadiness(state.profile).live);
      var progressTotal = finalState.progressPercent;
      var actionHtml = actions.map(function (action) {
        var blockedFinal = action === "final" && finalState.blocked;
        return "<button type=\"button\" data-work-order-action=\"" + action + "\" data-work-order-id=\"" + escapeHtml(order.id) + "\"" + (blockedFinal ? " title=\"Končni račun je na voljo, ko so vsi delni računi v celoti plačani.\"" : "") + ">" + escapeHtml(workOrderActionLabel(action)) + "</button>";
      }).join("");
      var progressCopy = progressTotal ? progressTotal + " %" + (finalState.blocked ? " · plačilo odprto" : " · plačano") : "";
      var acceptanceCopy = order.acceptanceEvidence ? (order.acceptedOn ? formatDate(order.acceptedOn) : formatGermanTimestampDate(order.acceptedAt)) + " · " + order.acceptanceEvidence : "";
      var cancellationCopy = order.cancellationReason ? formatGermanTimestampDate(order.cancelledAt) + " · " + order.cancellationReason : "";
      var earlyStartCopy = order.earlyStartEvidence ? formatGermanTimestampDate(order.earlyStartRecordedAt) + " · " + order.earlyStartEvidence : "";
      var withdrawalCopy = order.withdrawalEvidence ? formatDate(order.withdrawalDeclaredOn) + " · " + order.withdrawalEvidence : "";
      var contractDeliveryCopy = order.contractConfirmationDeliveryEvidence ? formatDate(order.contractConfirmationDeliveredOn) + " · " + (order.contractConfirmationDeliveryChannel === "paper" ? "papir" : "elektronsko") + " · " + order.contractConfirmationDeliveryEvidence : "";
      var contractWarning = order.status === "accepted" && requiresContractConfirmation(order) && !order.contractConfirmationDeliveryEvidence ? "Pred začetkom dela ustvarite pogodbeno potrdilo PDF in dokazljivo zabeležite njegovo izročitev potrošniku na trajnem nosilcu." : "";
      var withdrawalRefundRecorded = (order.withdrawalRefundRecords || []).reduce(function (sum, entry) { return sum + integer(entry.amount_cents, 0); }, 0);
      var withdrawalRefundRemaining = Math.max(0, order.withdrawalRefundDueCents - withdrawalRefundRecorded);
      var taxCorrection = withdrawalTaxCorrectionState(order);
      var settlementCopy = order.withdrawalSettlementId ? "Vračilo " + formatMoney(order.withdrawalRefundDueCents) + " · Wertersatz " + formatMoney(order.withdrawalValueCompensationCents) + " · rok " + formatDate(order.withdrawalRefundDueOn) : "";
      var refundCopy = withdrawalRefundRecorded ? formatMoney(withdrawalRefundRecorded) + " od " + formatMoney(order.withdrawalRefundDueCents) : "";
      var withdrawalWarning = "";
      if (order.status === "withdrawn" && !order.withdrawalSettlementId) withdrawalWarning = "Nadaljnje delo in novi računi so ustavljeni. Zdaj nespremenljivo ocenite plačila, morebitni Wertersatz in vračilo; nobeno plačilo se ne bo sprožilo samodejno.";
      else if (order.status === "withdrawn" && withdrawalRefundRemaining > 0) withdrawalWarning = "Dokaz vračila še manjka za " + formatMoney(withdrawalRefundRemaining) + ". Zakonski rok: " + formatDate(order.withdrawalRefundDueOn) + ". Vračilo ni bilo samodejno izvedeno.";
      else if (order.status === "withdrawn" && order.withdrawalConsumerBalanceReviewCents > 0) withdrawalWarning = "Wertersatz presega zadržano plačilo za " + formatMoney(order.withdrawalConsumerBalanceReviewCents) + ". POS ni ustvaril terjatve; potreben je ločen pravni in davčni pregled.";
      else if (order.status === "withdrawn" && taxCorrection.kind === "full_cancellation") withdrawalWarning = "Vračilo je denarno urejeno, vendar aktivni račun še vedno izkazuje previsoko davčno osnovo. Po § 17 UStG izdajte nespremenljiv Storno; original ostane v arhivu.";
      else if (order.status === "withdrawn" && taxCorrection.kind === "partial_correction") withdrawalWarning = "Potrebno je delno zmanjšanje davčne osnove za " + formatMoney(taxCorrection.reductionCents) + ". Izdajte nespremenljiv dobropis; priznani Wertersatz ostane obdavčljiv.";
      else if (order.status === "withdrawn" && order.withdrawalSettlementId) withdrawalWarning = "Denarne posledice odstopa so ocenjene, zahtevano vračilo je dokazano oziroma ni potrebno in odprta davčna korekcija ni zaznana. POS ni samodejno premaknil denarja.";
      return "<article class=\"pos-work-order pos-work-order--" + escapeHtml(order.status) + "\"><div class=\"pos-work-order__top\"><div><small data-fit-text>" + escapeHtml(order.orderNumber || order.offerNumber) + "</small><strong data-fit-text data-fit-max=\"15\">" + escapeHtml(order.title) + "</strong></div><span>" + escapeHtml(workOrderStatusLabel(order.status)) + "</span></div><div class=\"pos-work-order__facts\"><div><small>Naročnik</small><b data-fit-text>" + escapeHtml(order.customerName) + "</b></div><div><small>Vrednost</small><b>" + escapeHtml(formatMoney(order.grossCents)) + "</b></div><div><small>Velja do</small><b>" + escapeHtml(formatDate(order.validUntil)) + "</b></div>" + (acceptanceCopy ? "<div><small>Dokaz sprejema</small><b data-fit-text title=\"" + escapeHtml(acceptanceCopy) + "\">" + escapeHtml(acceptanceCopy) + "</b></div>" : "") + (contractDeliveryCopy ? "<div><small>Potrdilo pogodbe izročeno</small><b data-fit-text title=\"" + escapeHtml(contractDeliveryCopy) + "\">" + escapeHtml(contractDeliveryCopy) + "</b></div>" : "") + (earlyStartCopy ? "<div><small>Predčasni začetek</small><b data-fit-text title=\"" + escapeHtml(earlyStartCopy) + "\">" + escapeHtml(earlyStartCopy) + "</b></div>" : "") + (withdrawalCopy ? "<div><small>Dokaz odstopa</small><b data-fit-text title=\"" + escapeHtml(withdrawalCopy) + "\">" + escapeHtml(withdrawalCopy) + "</b></div>" : "") + (settlementCopy ? "<div><small>Denarni pregled</small><b data-fit-text title=\"" + escapeHtml(settlementCopy) + "\">" + escapeHtml(settlementCopy) + "</b></div>" : "") + (refundCopy ? "<div><small>Dokazano vračilo</small><b data-fit-text>" + escapeHtml(refundCopy) + "</b></div>" : "") + (cancellationCopy ? "<div><small>Razlog preklica</small><b data-fit-text title=\"" + escapeHtml(cancellationCopy) + "\">" + escapeHtml(cancellationCopy) + "</b></div>" : "") + (progressTotal ? "<div><small>Delni računi</small><b data-fit-text>" + escapeHtml(progressCopy) + "</b></div>" : "") + "</div>" + (finalState.blocked ? "<p class=\"pos-work-order__warning\">Končni račun čaka na celotno plačilo vseh delnih računov.</p>" : "") + (contractWarning ? "<p class=\"pos-work-order__warning\">" + escapeHtml(contractWarning) + "</p>" : "") + (withdrawalWarning ? "<p class=\"pos-work-order__warning\">" + escapeHtml(withdrawalWarning) + "</p>" : "") + (actionHtml ? "<div class=\"pos-work-order__actions\">" + actionHtml + "</div>" : "") + "</article>";
    }).join("");
    queryAll("[data-work-order-action]", root).forEach(function (button) {
      button.addEventListener("click", function () {
        var order = rows.filter(function (entry) { return entry.id === button.getAttribute("data-work-order-id"); })[0];
        var action = button.getAttribute("data-work-order-action");
        if (action === "edit") openWorkOrderForEdit(order);
        else if (action === "pdf") downloadOfferPdf(order).then(function () { showToast("Nespremenljivi PDF ponudbe je prenesen."); }).catch(function (error) { showToast(error && error.message || "PDF ponudbe ni na voljo."); });
        else if (action === "contract_pdf") downloadContractConfirmationPdf(order).then(function () { showToast("Nespremenljivo pogodbeno potrdilo je preneseno."); }).catch(function (error) { showToast(error && error.message || "Pogodbeno potrdilo ni na voljo."); });
        else if (action === "contract_delivery") recordContractConfirmationDelivery(order);
        else if (action === "withdrawal_settlement") assessConsumerWithdrawalSettlement(order);
        else if (action === "withdrawal_refund") recordConsumerWithdrawalRefund(order);
        else if (action === "withdrawal_tax_correction") {
          var correction = withdrawalTaxCorrectionState(order);
          if (correction.invoice) openAdjustmentSheet(correction.invoice, "cancellation");
        }
        else if (action === "withdrawal_tax_credit") createWithdrawalTaxCredit(order);
        else if (action === "progress" || action === "final") startWorkOrderInvoice(order, action);
        else transitionWorkOrder(order, action);
      });
    });
    fitAllText();
  }

  function recordWorkOrderAcceptance(order) {
    var offeredOn = berlinDateKey(order.offeredAt) || isoToday();
    var today = berlinDateKey(new Date()) || isoToday();
    openDialog("Kdaj je naročnik sprejel ponudbo?", "Vnesite dejanski nemški koledarski datum sprejema. Od tega datuma teče potrošnikov 14-dnevni rok; čas vnosa v POS se hrani ločeno.", {
      confirmText: "Naprej",
      input: {
        type: "date",
        label: "Datum sprejema",
        hint: "Datum ne sme biti pred zaklepom ponudbe, v prihodnosti ali po izteku veljavnosti.",
        value: today,
        min: offeredOn,
        max: today
      },
      validate: function (value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "Vpišite veljaven datum sprejema.";
        if (value < offeredOn || value > today || value > order.validUntil) return "Datum sprejema ni v dovoljenem obdobju ponudbe.";
        return "";
      },
      onConfirm: function (acceptedOn) {
        openDialog("Dokaz sprejema", "Potrdite le, če je naročnik ponudbo dejansko sprejel. Dokaz bo vezan na nespremenljivi PDF ponudbe.", {
          confirmText: "Potrdi sprejem",
          input: {
            label: "Dokaz sprejema",
            hint: "Vpišite način, osebo in referenco sprejema.",
            placeholder: "E-pošta · Max Mustermann · sporočilo 22. 8. 2026",
            maxLength: 500
          },
          validate: function (value) {
            var length = String(value || "").trim().length;
            return length < 5 || length > 500 ? "Vpišite dokaz sprejema (od 5 do 500 znakov)." : "";
          },
          onConfirm: async function (evidence) {
            try {
              var result = await backend.client.rpc("pos_accept_work_order", {
                p_work_order_id: order.id,
                p_evidence: String(evidence || "").trim(),
                p_accepted_on: acceptedOn
              }).single();
              if (result.error) throw result.error;
              var contractPdfError = "";
              if (requiresContractConfirmation(order)) {
                try { await ensureContractConfirmationDocument(order.id); }
                catch (documentError) { contractPdfError = documentError && documentError.message || "Pogodbeno potrdilo še ni pripravljeno."; }
              }
              await loadServerState("invoices");
              showView("work-orders");
              showToast(contractPdfError ? "Sprejem je zapisan; pogodbeno potrdilo znova pripravite z njegovim gumbom PDF." : "Sprejem, datum in pogodbeno potrdilo so varno zapisani.");
            } catch (error) { showToast(error && error.message || "Sprejema ni bilo mogoče zapisati."); }
          }
        });
      }
    });
  }

  function recordConsumerWithdrawal(order) {
    var acceptedOn = order.acceptedOn || berlinDateKey(order.acceptedAt);
    var today = berlinDateKey(new Date()) || isoToday();
    var deadline = acceptedOn && addDays(acceptedOn, 14) || today;
    var latest = deadline < today ? deadline : today;
    openDialog("Datum potrošnikove izjave", "Vnesite datum, ko je potrošnik izjavo poslal. Za pravočasnost zadošča pravočasna odpošiljka, zato je ta datum lahko pred datumom prejema.", {
      confirmText: "Naprej",
      input: {
        type: "date",
        label: "Datum izjave o odstopu",
        hint: "Dovoljen je datum od sprejema pogodbe do konca 14. dne, vendar ne v prihodnosti.",
        value: latest,
        min: acceptedOn,
        max: latest
      },
      validate: function (value) {
        if (!acceptedOn || !/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "Vpišite veljaven datum izjave o odstopu.";
        if (value < acceptedOn || value > latest) return "Datum izjave ni znotraj dovoljenega 14-dnevnega obdobja.";
        return "";
      },
      onConfirm: function (declaredOn) {
        openDialog("Zabeleži potrošnikov odstop?", "S tem takoj ustavite nadaljnje delo in nove račune. Obstoječi računi, plačila in morebitni Wertersatz se ne spremenijo samodejno in zahtevajo ločen pregled.", {
          confirmText: "Zabeleži odstop",
          input: {
            label: "Dokaz prejete izjave",
            hint: "Vpišite kanal, osebo in referenco jasne izjave o odstopu.",
            placeholder: "E-pošta · Max Mustermann · sporočilo 25. 8. 2026",
            maxLength: 500
          },
          validate: function (value) {
            var length = String(value || "").trim().length;
            return length < 5 || length > 500 ? "Vpišite dokaz prejete izjave (od 5 do 500 znakov)." : "";
          },
          onConfirm: async function (evidence) {
            try {
              var result = await backend.client.rpc("pos_record_consumer_withdrawal", {
                p_work_order_id: order.id,
                p_declared_on: declaredOn,
                p_evidence: String(evidence || "").trim()
              }).single();
              if (result.error) throw result.error;
              await loadServerState("invoices");
              showView("work-orders");
              showToast("Odstop je nespremenljivo zapisan; delo in novi računi so ustavljeni.");
            } catch (error) { showToast(error && error.message || "Odstopa ni bilo mogoče zapisati."); }
          }
        });
      }
    });
  }

  function retainedWorkOrderPaymentCents(order) {
    return (order && order.invoiceLinks || []).reduce(function (total, link) {
      var invoice = link && link.invoice;
      if (!invoice) return total;
      return total + (invoice.payments || []).reduce(function (sum, payment) {
        if (["succeeded", "partially_refunded", "refunded"].indexOf(payment.status) === -1) return sum;
        return sum + Math.max(0, integer(payment.amountCents, 0) - integer(payment.refundedCents, 0));
      }, 0);
    }, 0);
  }

  function assessConsumerWithdrawalSettlement(order) {
    if (!order || order.status !== "withdrawn" || order.withdrawalSettlementId) return;
    var retained = retainedWorkOrderPaymentCents(order);
    var submit = async function (valueCompensationCents, refundMethod, alternativeEvidence, reason) {
      try {
        var result = await backend.client.rpc("pos_assess_consumer_withdrawal_settlement", {
          p_work_order_id: order.id,
          p_value_compensation_cents: valueCompensationCents,
          p_refund_method: refundMethod,
          p_alternative_agreement_evidence: alternativeEvidence || null,
          p_value_compensation_reason: reason || null
        }).single();
        if (result.error) throw result.error;
        await loadServerState("invoices");
        showView("work-orders");
        showToast("Denarne posledice odstopa so nespremenljivo ocenjene; denar ni bil premaknjen.");
      } catch (error) { showToast(error && error.message || "Denarnega pregleda ni bilo mogoče zapisati."); }
    };
    var chooseMethod = function (valueCompensationCents, reason) {
      var estimatedRefund = Math.max(0, retained - valueCompensationCents);
      if (!estimatedRefund) { submit(valueCompensationCents, "not_required", "", reason); return; }
      openDialog("Način vračila", "Ocenjeno preostalo vračilo je " + formatMoney(estimatedRefund) + ". Po § 357 BGB uporabite isti način plačila, razen če je potrošnik izrecno in brez stroškov pristal na drugega.", {
        confirmText: "Naprej",
        input: {
          label: "Način vračila",
          value: "original",
          options: [
            { value: "original", label: "Prvotni način plačila" },
            { value: "agreed_alternative", label: "Dogovorjena alternativa" }
          ]
        },
        onConfirm: function (method) {
          if (method === "original") { submit(valueCompensationCents, method, "", reason); return; }
          openDialog("Dokaz dogovorjene alternative", "Vpišite dokaz, da je potrošnik izrecno pristal na drug način vračila in da zaradi tega nima stroškov.", {
            confirmText: "Zaključi pregled",
            input: { label: "Dokaz dogovora", placeholder: "E-pošta · Max Mustermann · dogovorjen IBAN · brez stroškov", maxLength: 500 },
            validate: function (value) { var length = String(value || "").trim().length; return length < 5 || length > 500 ? "Vpišite dokaz dogovora (od 5 do 500 znakov)." : ""; },
            onConfirm: function (evidence) { submit(valueCompensationCents, method, String(evidence || "").trim(), reason); }
          });
        }
      });
    };
    var explainValueCompensation = function (valueCompensationCents) {
      if (!valueCompensationCents) { chooseMethod(0, ""); return; }
      openDialog("Utemeljitev Wertersatz", "Utemeljite sorazmerni znesek glede na dejansko opravljeno storitev in dogovorjeno skupno ceno. POS terjatve ne bo samodejno ustvaril.", {
        confirmText: "Naprej",
        input: { label: "Dokazljiva utemeljitev", placeholder: "Opravljenih 3 od 10 dogovorjenih ur · delovni zapisnik …", maxLength: 500 },
        validate: function (value) { var length = String(value || "").trim().length; return length < 5 || length > 500 ? "Vpišite utemeljitev Wertersatz (od 5 do 500 znakov)." : ""; },
        onConfirm: function (reason) { chooseMethod(valueCompensationCents, String(reason || "").trim()); }
      });
    };
    if (!order.valueCompensationReviewRequired) { explainValueCompensation(0); return; }
    openDialog("Ocena Wertersatz", "Vpišite 0,00 €, če Wertersatz ni utemeljen. Najvišja dovoljena osnova je pogodbena bruto vrednost " + formatMoney(order.grossCents) + ".", {
      confirmText: "Naprej",
      input: { label: "Wertersatz", hint: "Znesek ne sme presegati pogodbene bruto vrednosti.", value: "0,00", inputMode: "decimal", maxLength: 20 },
      validate: function (value) {
        var cents = parseMoneyToCents(value);
        if (cents < 0 || cents > order.grossCents) return "Wertersatz mora biti med 0,00 € in " + formatMoney(order.grossCents) + ".";
        return "";
      },
      onConfirm: function (value) { explainValueCompensation(parseMoneyToCents(value)); }
    });
  }

  function originalRefundProvider(order) {
    var providers = [];
    (order && order.invoiceLinks || []).forEach(function (link) {
      var invoice = link && link.invoice;
      (invoice && invoice.payments || []).forEach(function (payment) {
        if (["succeeded", "partially_refunded", "refunded"].indexOf(payment.status) === -1) return;
        var provider = payment.provider === "stripe" ? "stripe"
          : payment.method === "bank_transfer" || payment.provider === "finapi" ? "bank_transfer" : "other";
        if (providers.indexOf(provider) === -1) providers.push(provider);
      });
    });
    return providers[0] || "bank_transfer";
  }

  function recordConsumerWithdrawalRefund(order) {
    if (!order || !order.withdrawalSettlementId) return;
    var recorded = (order.withdrawalRefundRecords || []).reduce(function (sum, entry) { return sum + integer(entry.amount_cents, 0); }, 0);
    var remaining = Math.max(0, order.withdrawalRefundDueCents - recorded);
    if (!remaining) return;
    openDialog("Znesek izvedenega vračila", "Zabeležite samo že dejansko izvedeno vračilo. Ta postopek ne sproži Stripe, banke ali nakazila. Preostalo za dokazovanje: " + formatMoney(remaining) + ".", {
      confirmText: "Naprej",
      input: { label: "Izvedeni znesek", value: (remaining / 100).toFixed(2).replace(".", ","), inputMode: "decimal", maxLength: 20 },
      validate: function (value) {
        var cents = parseMoneyToCents(value);
        if (cents <= 0 || cents > remaining) return "Znesek mora biti med 0,01 € in " + formatMoney(remaining) + ".";
        return "";
      },
      onConfirm: function (amountText) {
        var amountCents = parseMoneyToCents(amountText);
        var today = berlinDateKey(new Date()) || isoToday();
        openDialog("Datum izvedenega vračila", "Vpišite datum, ko je bilo vračilo dejansko izvedeno.", {
          confirmText: "Naprej",
          input: { type: "date", label: "Datum vračila", value: today, max: today },
          validate: function (value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && value <= today ? "" : "Vpišite veljaven datum vračila."; },
          onConfirm: function (executedOn) {
            openDialog("Kje je bilo vračilo izvedeno?", "Izberite dejanski kanal. Zapis je samo dokaz in ne bo sprožil zunanje transakcije.", {
              confirmText: "Naprej",
              input: { label: "Kanal vračila", value: order.withdrawalRefundMethod === "original" ? originalRefundProvider(order) : "bank_transfer", options: [
                { value: "bank_transfer", label: "Bančno nakazilo" },
                { value: "stripe", label: "Stripe" },
                { value: "other", label: "Drugo" }
              ] },
              onConfirm: function (provider) {
                openDialog("Referenca vračila", "Vpišite bančno referenco, Stripe refund ID ali drugo enolično oznako izvedene transakcije.", {
                  confirmText: "Naprej",
                  input: { label: "Referenca", placeholder: "Npr. RF-2026-0042 ali re_…", maxLength: 200 },
                  validate: function (value) { var length = String(value || "").trim().length; return length < 3 || length > 200 ? "Vpišite veljavno referenco (od 3 do 200 znakov)." : ""; },
                  onConfirm: function (reference) {
                    openDialog("Dokaz izvedenega vračila", "Vpišite preverljivo evidenco, na primer bančni izpisek ali Stripe dogodek. Zapis bo nespremenljiv.", {
                      confirmText: "Zabeleži dokaz",
                      input: { label: "Dokaz", placeholder: "Bančni izpisek · vrstica 42 · 5. 9. 2026", maxLength: 500 },
                      validate: function (value) { var length = String(value || "").trim().length; return length < 5 || length > 500 ? "Vpišite dokaz (od 5 do 500 znakov)." : ""; },
                      onConfirm: async function (evidence) {
                        try {
                          var result = await backend.client.rpc("pos_record_consumer_withdrawal_refund", {
                            p_work_order_id: order.id,
                            p_amount_cents: amountCents,
                            p_provider: provider,
                            p_provider_reference: String(reference || "").trim(),
                            p_evidence: String(evidence || "").trim(),
                            p_executed_on: executedOn
                          }).single();
                          if (result.error) throw result.error;
                          await loadServerState("invoices"); showView("work-orders");
                          showToast("Dokaz izvedenega vračila je nespremenljivo zapisan; nobena transakcija ni bila sprožena.");
                        } catch (error) { showToast(error && error.message || "Dokaza vračila ni bilo mogoče zapisati."); }
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  async function recordContractConfirmationDelivery(order) {
    try {
      await ensureContractConfirmationDocument(order.id);
    } catch (error) {
      showToast(error && error.message || "Najprej je treba pripraviti pogodbeno potrdilo PDF.");
      return;
    }
    var acceptedOn = order.acceptedOn || berlinDateKey(order.acceptedAt);
    var today = berlinDateKey(new Date()) || isoToday();
    var context = (order.lockedPayload || order.payload || {}).consumer_contract_context;
    openDialog("Kako je bilo potrdilo izročeno?", "Izberite dejanski trajni nosilec, na katerem je potrošnik prejel nespremenljivo pogodbeno potrdilo.", {
      confirmText: "Naprej",
      input: {
        label: "Način izročitve",
        hint: "Papir ali elektronski trajni nosilec, na primer priponka PDF v e-pošti.",
        value: "paper",
        options: [
          { value: "paper", label: "Papir" },
          { value: "electronic", label: "Elektronsko (PDF)" }
        ]
      },
      onConfirm: function (channel) {
        openDialog("Kdaj je bilo potrdilo izročeno?", "Vpišite dejanski nemški koledarski datum izročitve. Ta datum mora biti po sklenitvi pogodbe in pred začetkom dela.", {
          confirmText: "Naprej",
          input: {
            type: "date",
            label: "Datum izročitve",
            hint: "Datum ne sme biti pred datumom sprejema ali v prihodnosti.",
            value: today,
            min: acceptedOn,
            max: today
          },
          validate: function (value) {
            if (!acceptedOn || !/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "Vpišite veljaven datum izročitve.";
            return value < acceptedOn || value > today ? "Datum izročitve ni v dovoljenem obdobju." : "";
          },
          onConfirm: function (deliveredOn) {
            openDialog("Dokaz izročitve", "Vpišite preverljivo referenco, ki dokazuje, da je potrošnik potrdilo dejansko prejel.", {
              confirmText: "Naprej",
              input: {
                label: "Dokaz izročitve",
                hint: "Na primer podpisana kopija ali ID poslane e-pošte s PDF-priponko.",
                placeholder: channel === "paper" ? "Podpisana papirna kopija · Max Mustermann · 22. 8. 2026" : "E-pošta s PDF-priponko · Message-ID …",
                maxLength: 500
              },
              validate: function (value) {
                var length = String(value || "").trim().length;
                return length < 5 || length > 500 ? "Vpišite dokaz izročitve (od 5 do 500 znakov)." : "";
              },
              onConfirm: function (evidence) {
                var save = function (consentEvidence) {
                  backend.client.rpc("pos_record_contract_confirmation_delivery", {
                    p_work_order_id: order.id,
                    p_channel: channel,
                    p_evidence: String(evidence || "").trim(),
                    p_delivered_on: deliveredOn,
                    p_electronic_consent_evidence: consentEvidence || null
                  }).single().then(async function (result) {
                    if (result.error) throw result.error;
                    await loadServerState("invoices");
                    showView("work-orders");
                    showToast("Izročitev pogodbenega potrdila je nespremenljivo zapisana.");
                  }).catch(function (error) { showToast(error && error.message || "Izročitve ni bilo mogoče zapisati."); });
                };
                if (channel !== "electronic" || ["off_premises", "urgent_repair"].indexOf(context) === -1) { save(""); return; }
                openDialog("Soglasje za elektronski nosilec", "Pri pogodbi zunaj poslovnih prostorov je namesto papirja potreben dokaz, da je potrošnik soglašal z drugim trajnim nosilcem.", {
                  confirmText: "Zabeleži izročitev",
                  input: {
                    label: "Dokaz soglasja",
                    hint: "Vpišite podpisano izjavo, e-pošto ali drugo preverljivo referenco soglasja.",
                    placeholder: "Podpisano soglasje · Max Mustermann · 22. 8. 2026",
                    maxLength: 500
                  },
                  validate: function (value) {
                    var length = String(value || "").trim().length;
                    return length < 5 || length > 500 ? "Vpišite dokaz soglasja (od 5 do 500 znakov)." : "";
                  },
                  onConfirm: function (consentEvidence) { save(String(consentEvidence || "").trim()); }
                });
              }
            });
          }
        });
      }
    });
  }

  function transitionWorkOrder(order, action) {
    if (!order || !backend.ready) { showToast("Varna hramba naročil ni povezana."); return; }
    if (action === "accept") { recordWorkOrderAcceptance(order); return; }
    if (action === "withdraw") { recordConsumerWithdrawal(order); return; }
    if (action === "start" && requiresContractConfirmation(order) && !order.contractConfirmationDeliveryEvidence) {
      showToast("Pred začetkom dela zabeležite izročitev pogodbenega potrdila potrošniku.");
      return;
    }
    if (action === "offer" && !profileReadiness(state.profile).live) { showToast("Pravno ponudbo lahko pošljete šele po potrditvi popolnih podatkov podjetja in registra."); return; }
    var earlyEvidenceRequired = action === "start" && requiresEarlyStartEvidence(order);
    var copy = action === "offer" ? "Ponudba se bo zaklenila in dobila nespremenljiv PDF. Po prenosu jo pošljite naročniku."
      : earlyEvidenceRequired ? "Pred iztekom 14 dni oziroma pri nujnem popravilu je potreben dokaz izrecne zahteve potrošnika za začetek dela."
        : action === "cancel" ? "Preklic ostane zapisan v sled dogodkov."
          : "Prehod se bo zapisal v sled projekta.";
    openDialog(workOrderActionLabel(action) + "?", copy, {
      confirmText: workOrderActionLabel(action),
      input: action === "cancel" ? {
        label: "Razlog preklica",
        hint: "Razlog ostane nespremenljivo zapisan v sledi ponudbe.",
        placeholder: "Npr. naročnik ni sprejel ponudbe v roku",
        maxLength: 500
      } : earlyEvidenceRequired ? {
        label: "Dokaz zahteve za predčasni začetek",
        hint: "Vpišite podpisano izjavo, e-pošto ali drugo referenco potrošnikove izrecne zahteve.",
        placeholder: "Podpisana izjava iz PDF · Max Mustermann · 22. 8. 2026",
        maxLength: 500
      } : null,
      validate: action === "cancel" || earlyEvidenceRequired ? function (value) {
        var length = String(value || "").trim().length;
        var label = action === "cancel" ? "Vpišite razlog preklica" : "Vpišite dokaz zahteve za predčasni začetek";
        return length < 5 || length > 500 ? label + " (od 5 do 500 znakov)." : "";
      } : null,
      onConfirm: function (acceptanceEvidence) {
        var execute = async function (acknowledgements) {
          var facts = acknowledgements || {};
          try {
            var request = action === "cancel"
                ? backend.client.rpc("pos_cancel_work_order", { p_work_order_id: order.id, p_reason: String(acceptanceEvidence || "").trim() })
              : action === "start"
                ? backend.client.rpc("pos_start_work_order", {
                    p_work_order_id: order.id,
                    p_evidence: String(acceptanceEvidence || "").trim(),
                    p_value_compensation_informed: Boolean(facts.valueCompensationInformed),
                    p_right_expiry_acknowledged: Boolean(facts.rightExpiryAcknowledged),
                    p_request_on_durable_medium: Boolean(facts.requestOnDurableMedium)
                  })
                : backend.client.rpc("pos_transition_work_order", { p_work_order_id: order.id, p_action: action });
            var result = await request.single();
            if (result.error) throw result.error;
            var offerPdfError = "";
            if (action === "offer") {
              try { await ensureOfferDocument(result.data && result.data.id || order.id); }
              catch (documentError) { offerPdfError = documentError && documentError.message || "PDF ponudbe še ni pripravljen."; }
            }
            await loadServerState("invoices");
            showView("work-orders");
            showToast(offerPdfError ? "Ponudba je zaklenjena; PDF lahko znova pripravite z gumbom Ponudba PDF." : action === "offer" ? "Ponudba je zaklenjena in njen PDF original je pripravljen." : "Status projekta je varno posodobljen.");
          } catch (error) { showToast(error && error.message || "Statusa ni bilo mogoče posodobiti."); }
        };
        var context = (order.lockedPayload || order.payload || {}).consumer_contract_context;
        if (action === "start" && earlyEvidenceRequired && ["distance", "off_premises"].indexOf(context) !== -1) {
          openDialog("Potrdite vsebino izjave", "Nadaljujte samo, če navedeni dokaz potrjuje, da je potrošnik izrecno zahteval predčasni začetek, prejel obvestilo o Wertersatz in potrdil, da pravica do odstopa po popolni izvedbi preneha." + (context === "off_premises" ? " Izjava mora biti na papirju ali drugem trajnem nosilcu." : ""), {
            confirmText: "Izjava je potrjena",
            onConfirm: function () {
              execute({
                valueCompensationInformed: true,
                rightExpiryAcknowledged: true,
                requestOnDurableMedium: context === "off_premises"
              });
            }
          });
        } else execute({});
      }
    });
  }

  function openWorkOrderInvoiceDraft(order, kind, percent) {
    var draft = prepareWorkOrderInvoiceDraft(order, state.profile, kind, percent);
    if (!draft) {
      var finalState = kind === "final" ? workOrderFinalState(order, !profileReadiness(state.profile).live) : null;
      showToast(finalState && finalState.blocked ? "Končni račun je varno omogočen šele, ko so vsi delni računi v celoti plačani." : "Naročilo še ni v pravilnem stanju za ta račun.");
      return;
    }
    state.draft = draft;
    currentStep = 1;
    persist();
    showView("invoice");
    showToast(kind === "progress" ? "Abschlagsrechnung je pripravljena za preverjanje." : "Schlussrechnung je pripravljena za preverjanje.");
  }

  function openWorkOrderForEdit(order) {
    if (!order || order.status !== "draft") { showToast("Samo neposlana ponudba je še spremenljiva."); return; }
    var draft = draftFromDatabasePayload(order.payload, false);
    draft.id = uid("draft");
    draft.serverId = null;
    draft.createdAt = new Date().toISOString();
    draft.workflowMode = "offer";
    draft.offerValidDays = String(Math.max(1, Math.round((Date.parse(order.validUntil + "T12:00:00Z") - Date.parse(isoToday() + "T12:00:00Z")) / 86400000)));
    draft.workflowContext = { workOrderId: order.id, offerNumber: order.offerNumber };
    draft.finalConfirmed = false;
    state.draft = draft;
    currentStep = 1;
    persist();
    showView("invoice");
  }

  function startWorkOrderInvoice(order, action) {
    if (!order) return;
    var replace = function (kind, percent) {
      if (!state.draft) { openWorkOrderInvoiceDraft(order, kind, percent); return; }
      openDialog("Zamenjati trenutni osnutek?", "Trenutni osnutek bo zamenjan z računom za " + (order.orderNumber || order.offerNumber) + ".", {
        confirmText: "Pripravi račun", onConfirm: function () { openWorkOrderInvoiceDraft(order, kind, percent); }
      });
    };
    if (action === "final") { replace("final", 0); return; }
    var used = workOrderFinalState(order).progressPercent;
    var maximum = Math.max(1, 99 - used);
    openDialog("Pripraviti Abschlagsrechnung?", "Vnesite odstotek dejansko dokumentiranega Leistungsstand. Doslej izdano: " + used + " %.", {
      confirmText: "Pripravi Abschlag",
      input: { label: "Leistungsstand v %", value: String(Math.min(30, maximum)), hint: "Dovoljeno še največ " + maximum + " %." },
      validate: function (value) { var percent = integer(value, 0); return percent < 1 || percent > maximum ? "Vnesite odstotek med 1 in " + maximum + "." : ""; },
      onConfirm: function (value) { replace("progress", integer(value, 0)); }
    });
  }

  function productionReady() {
    return profileReadiness(state.profile).live && backend.ready && archiveCapability.productionReady;
  }

  function renderArchiveCapability() {
    var badge = query("[data-archive-badge]");
    if (!badge) return;
    var view = archiveCapabilityView(archiveCapability);
    badge.classList.toggle("is-ready", view.allVerified && archiveCapability.independentBackupReady);
    badge.classList.toggle("is-error", view.failed || view.unavailable);
    badge.textContent = view.badgeText;
    query("[data-archive-retention]").textContent = "najmanj " + integer(archiveCapability.retentionYears, 8) + " let";
    query("[data-archive-integrity]").textContent = view.integrityText;
    query("[data-archive-backup]").textContent = view.backupText;
    query("[data-archive-copy]").textContent = view.copyText;
    query("[data-archive-verify]").disabled = archiveCapability.loading || !backend.ready;
  }

  async function loadArchiveCapability(showFeedback, verify) {
    if (!backend.ready) { renderArchiveCapability(); return archiveCapability; }
    archiveCapability.loading = true;
    archiveCapability.error = "";
    renderArchiveCapability();
    try {
      var token = await apiSessionToken();
      var response = await fetch("/api/pos-arhiv", {
        method: verify ? "POST" : "GET",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: verify ? JSON.stringify({ action: "verify-all" }) : undefined
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.ok) throw new Error(data.napaka || "Arhiva ni bilo mogoče preveriti.");
      archiveCapability = Object.assign({}, archiveCapability, data.archive || {}, { loaded: true, loading: false, error: "" });
      if (showFeedback) {
        if (archiveCapability.failureCount) showToast("Arhiv potrebuje pozornost.");
        else if (archiveCapability.uncheckedCount) showToast("Paket je preverjen; preostanek arhiva bo preverjen v naslednjih paketih.");
        else showToast("Vsi arhivirani izvirniki so preverjeni.");
      }
    } catch (error) {
      archiveCapability.loading = false;
      archiveCapability.loaded = true;
      archiveCapability.error = error && error.message || "Arhiva ni bilo mogoče preveriti.";
      archiveCapability.productionReady = false;
      if (showFeedback) showToast(error && error.message || "Arhiva ni bilo mogoče preveriti.");
    }
    renderHome();
    return archiveCapability;
  }

  function invoiceStatusLabel(invoice, today) {
    var overdueDays = invoiceDaysOverdue(invoice, today);
    if (overdueDays) return "Zapadlo · " + overdueDays + (overdueDays === 1 ? " dan" : " dni");
    if (invoice.status === "cancelled") return "Stornirano";
    if (invoice.status === "credited") return "V celoti dobropisano";
    if (invoice.status === "paid") return "Plačano";
    if (invoice.status === "partial") return "Delno plačano";
    if (invoice.corrected) return "Popravljeno";
    if (invoice.isTest) return "Test";
    return "Odprto";
  }

  function invoiceRowHtml(invoice, today) {
    var overdue = invoiceDaysOverdue(invoice, today) > 0;
    var rowClass = overdue ? " is-overdue" : invoice.status === "paid" ? " is-paid" : invoice.status === "cancelled" || invoice.status === "credited" ? " is-cancelled" : "";
    var disabled = invoice.status === "cancelled" || invoice.hasCreditNote ? " disabled aria-label=\"Finančno popravljen račun\"" : "";
    return "<article class=\"pos-invoice-row" + rowClass + "\" data-invoice-id=\"" + escapeHtml(invoice.id) + "\" data-open-invoice=\"" + escapeHtml(invoice.id) + "\" tabindex=\"0\"><span class=\"pos-invoice-row__icon\"><svg><use href=\"#i-receipt\"/></svg></span><div class=\"pos-invoice-row__main\"><strong data-fit-text>" + escapeHtml(invoice.draft.customerName || "Brez prejemnika") + "</strong><small data-fit-text>" + escapeHtml(invoice.number) + " · " + escapeHtml(formatDate(invoice.draft.issueDate)) + "</small></div><button class=\"pos-invoice-row__amount pos-text-button\" type=\"button\" data-record-payment=\"" + escapeHtml(invoice.id) + "\"" + disabled + "><strong data-fit-text>" + escapeHtml(formatMoney(invoice.totals.grossCents)) + "</strong><small>" + escapeHtml(invoiceStatusLabel(invoice, today)) + "</small></button></article>";
  }

  function bindInvoiceRows(list, returnView) {
    queryAll("[data-open-invoice]", list).forEach(function (row) {
      function open() { openInvoiceDetail(row.getAttribute("data-open-invoice"), returnView); }
      row.addEventListener("click", function (event) { if (!event.target.closest("[data-record-payment]")) open(); });
      row.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    });
    queryAll("[data-record-payment]", list).forEach(function (button) {
      button.addEventListener("click", function (event) { event.stopPropagation(); requestPayment(button.getAttribute("data-record-payment")); });
    });
  }

  function renderInvoiceList() {
    var list = query("[data-invoice-list]");
    if (!state.invoices.length) {
      list.innerHTML = "<div class=\"pos-empty\"><strong>Računov še ni</strong><p>Prvi osnutek ustvarite z gumbom »Nov račun«.</p></div>";
      return;
    }
    list.innerHTML = state.invoices.slice(0, 5).map(function (invoice) { return invoiceRowHtml(invoice, isoToday()); }).join("");
    bindInvoiceRows(list, "home");
    fitAllText();
  }

  function renderInvoiceOverview() {
    var today = isoToday();
    var summary = invoiceOverview(state.invoices, today);
    var filtered = filterInvoices(state.invoices, invoiceOverviewFilter, invoiceOverviewQuery, today);
    query("[data-invoice-overview-summary]").innerHTML = [
      "<article><small>Odprto</small><strong data-fit-text data-fit-max=\"11\">" + escapeHtml(formatMoney(summary.openCents)) + "</strong></article>",
      "<article class=\"is-overdue\"><small>Zapadlo</small><strong data-fit-text data-fit-max=\"11\">" + escapeHtml(formatMoney(summary.overdueCents)) + "</strong></article>",
      "<article><small>Plačani</small><strong>" + summary.paidCount + "</strong></article>"
    ].join("");
    queryAll("[data-invoice-filter]").forEach(function (button) { button.classList.toggle("is-active", button.getAttribute("data-invoice-filter") === invoiceOverviewFilter); });
    var count = query("[data-invoice-overview-count]");
    count.textContent = filtered.length === 1 ? "1 račun" : filtered.length + " računov";
    var list = query("[data-invoice-overview-list]");
    list.innerHTML = filtered.length
      ? filtered.map(function (invoice) { return invoiceRowHtml(invoice, today); }).join("")
      : "<div class=\"pos-empty\"><strong>Ni ustreznih računov</strong><p>Spremenite filter ali iskalni izraz.</p></div>";
    bindInvoiceRows(list, "invoices");
    fitAllText();
  }

  function findInvoice(id) {
    return state.invoices.filter(function (entry) { return entry.id === id; })[0] || null;
  }

  function openInvoiceDetail(id, returnView) {
    if (!findInvoice(id)) return;
    activeInvoiceId = id;
    invoiceDetailReturnView = returnView === "invoices" ? "invoices" : "home";
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
      var creditNote = entry.type === "credit_note";
      var financial = cancellation || creditNote;
      var title = cancellation ? "Stornorechnung" : creditNote ? "Gutschrift" : "Rechnungsberichtigung";
      var stateCopy = entry.documentReady ? "PDF" : "Pripravi PDF";
      var structured = !creditNote && (invoice.draft.customerType === "business" || invoice.draft.customerType === "public");
      var einvoiceStatus = entry.einvoiceDocument && (entry.einvoiceDocument.validation_status || entry.einvoiceDocument.validationStatus) || "pending";
      var xmlCopy = entry.einvoiceDocumentReady && einvoiceStatus === "validated" ? "XML" : "Pripravi XML";
      return "<article class=\"pos-adjustment-row " + (financial ? "is-cancellation" : "") + (creditNote ? " is-credit-note" : "") + "\"><span class=\"pos-adjustment-row__icon\"><svg><use href=\"#" + (cancellation ? "i-trash" : creditNote ? "i-receipt" : "i-info") + "\"/></svg></span><div class=\"pos-adjustment-row__copy\"><strong data-fit-text data-fit-max=\"11\">" + escapeHtml(title + " · " + entry.number) + "</strong><small data-fit-text data-fit-max=\"9\">" + escapeHtml(formatDate(berlinDateKey(entry.createdAt)) + " · " + entry.reason) + "</small></div><div class=\"pos-adjustment-row__actions\"><button type=\"button\" data-download-adjustment=\"" + escapeHtml(entry.id) + "\">" + stateCopy + "</button>" + (structured ? "<button type=\"button\" data-download-adjustment-xrechnung=\"" + escapeHtml(entry.id) + "\">" + xmlCopy + "</button>" : "") + "</div></article>";
    }
    queryAll("[data-download-adjustment]", list).forEach(function (button) {
      button.addEventListener("click", async function () {
        var entry = downloadable.filter(function (item) { return item.id === button.getAttribute("data-download-adjustment"); })[0];
        if (!entry) return;
        button.disabled = true;
        button.textContent = "Preverjam …";
        try { await downloadAdjustmentPdf(entry); button.textContent = "PDF"; showToast("Arhivirani računovodski dokument je prenesen."); }
        catch (error) { button.textContent = "Poskusi znova"; showToast(error.message || "Popravka ni bilo mogoče prenesti."); }
        finally { button.disabled = false; }
      });
    });
    queryAll("[data-download-adjustment-xrechnung]", list).forEach(function (button) {
      button.addEventListener("click", async function () {
        var entry = downloadable.filter(function (item) { return item.id === button.getAttribute("data-download-adjustment-xrechnung"); })[0];
        if (!entry) return;
        button.disabled = true;
        button.textContent = "KoSIT …";
        try { await downloadAdjustmentEinvoice(entry); button.textContent = "XML"; showToast("Arhivirani strukturirani popravek je prenesen."); }
        catch (error) { button.textContent = "Poskusi znova"; showToast(error.message || "Strukturiranega popravka ni bilo mogoče prenesti."); }
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
      return "<article class=\"pos-delivery-row\"><span class=\"pos-delivery-row__icon\"><svg><use href=\"#i-export\"/></svg></span><div class=\"pos-delivery-row__copy\"><strong data-fit-text data-fit-max=\"11\">" + escapeHtml(deliveryFormatLabel(entry.documentFormat) + " · " + deliveryChannelLabel(entry.channel)) + "</strong><small data-fit-text data-fit-max=\"9\">" + escapeHtml(formatDate(berlinDateKey(entry.createdAt)) + " · " + target + validation) + "</small></div><div class=\"pos-delivery-row__actions\"><span class=\"pos-delivery-row__status is-" + escapeHtml(entry.status) + "\">" + escapeHtml(deliveryStatusLabel(entry.status, entry)) + "</span>" + retry + "</div>" + deliveryTimeline(entry) + "</article>";
    }).join("");
    queryAll("[data-retry-delivery]", list).forEach(function (button) {
      button.addEventListener("click", async function () {
        button.disabled = true;
        button.textContent = "Čakaj …";
        try {
          if (button.getAttribute("data-email") === "true") await posDeliveryEmailRequest(button.getAttribute("data-retry-delivery"));
          else await queueAndRunSandbox(button.getAttribute("data-retry-delivery"));
          await loadServerState("deliveries");
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

  function paymentSourceLabel(payment) {
    if (payment.provider === "stripe" || payment.method === "stripe_card") return "Stripe kartica · TEST";
    if (payment.sourceBankTransactionId || payment.method === "bank_transfer") return "Bančno nakazilo";
    if (payment.method === "external_card") return "Zunanja kartica";
    return "Ročna potrditev";
  }

  function paymentStatusLabel(payment) {
    var status = payment && payment.status || "succeeded";
    if (status === "pending") return "Čaka na plačilo";
    if (status === "failed") return "Plačilo ni uspelo";
    if (status === "cancelled") return "Preklicano";
    if (status === "refunded") return "V celoti povrnjeno";
    if (status === "partially_refunded") return "Delno povrnjeno";
    return "Plačano";
  }

  function latestStripePayment(invoice) {
    var stripePayments = (invoice && invoice.payments || []).filter(function (payment) {
      return payment.provider === "stripe" || payment.method === "stripe_card";
    });
    return stripePayments[stripePayments.length - 1] || null;
  }

  function latestRefundableStripePayment(invoice) {
    var stripePayments = (invoice && invoice.payments || []).filter(function (payment) {
      var remaining = integer(payment.amountCents, 0) - integer(payment.refundedCents, 0);
      return (payment.provider === "stripe" || payment.method === "stripe_card") &&
        ["succeeded", "partially_refunded"].indexOf(payment.status) !== -1 && remaining > 0;
    });
    return stripePayments[stripePayments.length - 1] || null;
  }

  function renderStripePayment(invoice) {
    var panel = query("[data-stripe-payment-panel]");
    var button = query("[data-stripe-payment]");
    var refundButton = query("[data-stripe-refund]");
    var buttonCopy = button && query("span", button);
    var payment = latestStripePayment(invoice);
    var refundablePayment = latestRefundableStripePayment(invoice);
    var status = payment && payment.status || "ready";
    ["paid", "pending", "failed", "cancelled", "refunded", "partially_refunded"].forEach(function (name) {
      panel.classList.toggle("is-" + name, status === name || name === "paid" && status === "succeeded");
    });
    panel.hidden = !invoice.isTest;
    if (!invoice.isTest) return;
    var outstanding = invoiceOutstandingCents(invoice);
    var title = "Stripe testno plačilo";
    var copy = "Točen odprti znesek " + formatMoney(outstanding) + " se preveri na strežniku.";
    var label = "Plačaj s kartico – TEST";
    if (status === "pending") { title = "Čaka na plačilo"; copy = "Stripe Checkout je odprt; račun še ni označen kot plačan."; label = "Nadaljuj plačilo – TEST"; }
    if (status === "succeeded") { title = "Plačano"; copy = "Podpisan Stripe webhook je potrdil testno kartično plačilo."; label = "Plačano · TEST"; }
    if (status === "failed") { title = "Plačilo ni uspelo"; copy = "Poskus je varno zabeležen. Uporabite nov Stripe TEST poskus."; label = "Poskusi znova – TEST"; }
    if (status === "cancelled") { title = "Preklicano"; copy = "Stripe TEST seja je bila varno zaprta brez plačila."; label = "Začni novo plačilo – TEST"; }
    if (status === "refunded") { title = "Plačilo povrnjeno"; copy = "Povračilo je odprlo celotni znesek računa."; label = "Plačaj znova – TEST"; }
    if (status === "partially_refunded") { title = "Delno povrnjeno"; copy = "Odprti znesek po povračilu: " + formatMoney(outstanding) + "."; label = "Plačaj preostanek – TEST"; }
    query("[data-stripe-payment-title]").textContent = title;
    query("[data-stripe-payment-copy]").textContent = copy;
    buttonCopy.textContent = label;
    button.disabled = !invoice.serverStored || !backend.ready || invoice.status === "cancelled" || invoice.status === "credited" || invoice.status === "paid" || invoice.hasCreditNote;
    refundButton.hidden = !refundablePayment;
    refundButton.disabled = !invoice.serverStored || !backend.ready;
    if (refundablePayment) {
      query("span", refundButton).textContent = "Vrni " + formatMoney(integer(refundablePayment.amountCents, 0) - integer(refundablePayment.refundedCents, 0)) + " – TEST";
    }
  }

  function renderPaymentList(invoice) {
    var section = query("[data-detail-payments-section]");
    var list = query("[data-detail-payments-list]");
    var payments = invoice.payments || [];
    section.hidden = payments.length === 0;
    if (!payments.length) { list.innerHTML = ""; return; }
    query("[data-detail-payments-count]").textContent = String(payments.length);
    list.innerHTML = payments.map(function (payment) {
      var transaction = payment.sourceBankTransactionId && (state.bankTransactions || []).filter(function (entry) {
        return entry.id === payment.sourceBankTransactionId;
      })[0];
      var bankSource = transaction && (transaction.counterpartyName || transaction.sourceAccountName || transaction.sourceAccountIban);
      var reference = bankSource || payment.providerReference || (payment.provider === "stripe" ? "Stripe Sandbox" : "Potrjeno v POS");
      var dateSource = payment.paidAt || payment.createdAt;
      var date = dateSource ? formatDate(berlinDateKey(dateSource)) : "Datum ni naveden";
      var isBank = Boolean(payment.sourceBankTransactionId || payment.method === "bank_transfer");
      var status = payment.status || "succeeded";
      var effective = Math.max(0, integer(payment.amountCents, 0) - integer(payment.refundedCents, 0));
      return "<article class=\"pos-payment-row\"><span class=\"pos-payment-row__icon" + (isBank ? "" : " is-manual") + "\"><svg><use href=\"#" + (isBank ? "i-bank" : payment.provider === "stripe" ? "i-card" : "i-check") + "\"/></svg></span><div class=\"pos-payment-row__copy\"><strong data-fit-text data-fit-max=\"11\">" + escapeHtml(paymentSourceLabel(payment)) + "</strong><small data-fit-text data-fit-max=\"9\">" + escapeHtml(date + " · " + reference) + "</small><span class=\"pos-payment-row__status is-" + escapeHtml(status) + "\">" + escapeHtml(paymentStatusLabel(payment)) + "</span></div><strong class=\"pos-payment-row__amount\" data-fit-text data-fit-max=\"11\">" + escapeHtml(formatMoney(status === "refunded" ? 0 : effective || payment.amountCents)) + "</strong></article>";
    }).join("");
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

  function renderFiskalyCapability() {
    var badge = query("[data-fiskaly-badge]");
    var status = query("[data-fiskaly-status]");
    var copy = query("[data-fiskaly-copy]");
    var stateBox = query(".pos-fiskaly-state");
    var testButton = query("[data-fiskaly-test]");
    if (!badge || !status || !copy || !stateBox) return;
    var ready = Boolean(fiskalyCapability.configured && fiskalyCapability.connected);
    var failed = Boolean(fiskalyCapability.configured && !fiskalyCapability.connected);
    badge.classList.toggle("is-ready", ready);
    badge.classList.toggle("is-error", failed);
    stateBox.classList.toggle("is-ready", ready);
    stateBox.classList.toggle("is-error", failed);
    badge.textContent = ready ? "TEST povezan" : failed ? "Napaka" : "Ni nastavljeno";
    status.textContent = ready ? "Testna povezava je pripravljena" : failed ? "Povezava trenutno ni dosegljiva" : "Testna povezava še ni nastavljena";
    copy.textContent = ready
      ? (fiskalyCapability.integrationReady ? "TSS inicializirana · odjemalec registriran · gotovina izključena" : "SIGN DE · " + fiskalyCapability.tssCount + " testnih TSS · gotovina izključena")
      : failed ? "Poskusite ponovno; izdaja računov ostaja varno ločena." : "Ključi se nastavijo samo na varnem strežniku.";
    if (testButton) {
      testButton.disabled = !fiskalyCapability.integrationReady || fiskalyTestRunning;
      if (testButton.firstChild) testButton.firstChild.nodeValue = fiskalyTestRunning ? "Podpisujem … " : "Testni Kassenbon ";
    }
  }

  async function loadFiskalyCapability(showFeedback) {
    try {
      var token = await apiSessionToken();
      var response = await fetch("/api/pos-fiskaly", { method: "GET", headers: { Authorization: "Bearer " + token } });
      var body = null;
      try { body = await response.json(); } catch (_error) {}
      if (!response.ok || !body || !body.fiskaly) throw new Error("Povezave ni bilo mogoče preveriti.");
      fiskalyCapability = {
        configured: Boolean(body.fiskaly.configured),
        connected: Boolean(body.fiskaly.connected),
        integrationReady: Boolean(body.fiskaly.integrationReady),
        environment: "test",
        tssCount: Math.max(0, integer(body.fiskaly.tssCount, 0)),
        tssState: String(body.fiskaly.tssState || ""),
        clientState: String(body.fiskaly.clientState || ""),
        cashModuleEnabled: false
      };
    } catch (_error) {
      fiskalyCapability = { configured: true, connected: false, integrationReady: false, environment: "test", tssCount: 0, tssState: "", clientState: "", cashModuleEnabled: false };
    }
    renderFiskalyCapability();
    if (showFeedback) showToast(fiskalyCapability.connected ? "fiskaly TEST povezava deluje." : "fiskaly TEST povezava trenutno ni dosegljiva.");
    return fiskalyCapability;
  }

  function fiskalyReceiptTotals() {
    var rows = { "19": { net: 0, tax: 0, gross: 0 }, "7": { net: 0, tax: 0, gross: 0 }, "0": { net: 0, tax: 0, gross: 0 } };
    fiskalyReceiptItems.forEach(function (item) {
      var gross = Math.round(integer(item.unitGrossCents, 0) * integer(item.quantityMilli, 0) / 1000);
      var rate = integer(item.vatRate, 0);
      var net = rate ? Math.round(gross * 100 / (100 + rate)) : gross;
      rows[String(rate)].gross += gross;
      rows[String(rate)].net += net;
      rows[String(rate)].tax += gross - net;
    });
    return {
      rows: rows,
      gross: fiskalyReceiptItems.reduce(function (sum, item) { return sum + Math.round(integer(item.unitGrossCents, 0) * integer(item.quantityMilli, 0) / 1000); }, 0),
      net: Object.keys(rows).reduce(function (sum, key) { return sum + rows[key].net; }, 0),
      tax: Object.keys(rows).reduce(function (sum, key) { return sum + rows[key].tax; }, 0)
    };
  }

  function renderFiskalyCartSummary() {
    var totals = fiskalyReceiptTotals();
    query("[data-fiskaly-cart-summary]").innerHTML = "<div><span>Netto</span><strong>" + escapeHtml(formatMoney(totals.net)) + "</strong></div><div><span>Umsatzsteuer</span><strong>" + escapeHtml(formatMoney(totals.tax)) + "</strong></div><div><span>Gesamtbetrag</span><strong>" + escapeHtml(formatMoney(totals.gross)) + "</strong></div>";
    queryAll("[data-fiskaly-line-total]").forEach(function (element) {
      var item = fiskalyReceiptItems.filter(function (entry) { return entry.id === element.getAttribute("data-fiskaly-line-total"); })[0];
      if (item) element.textContent = formatMoney(Math.round(item.unitGrossCents * item.quantityMilli / 1000));
    });
  }

  function fiskalyCountLabel(count) {
    return count === 1 ? "1 postavka" : count === 2 ? "2 postavki" : count + " postavk";
  }

  function renderFiskalyCart() {
    var cart = query("[data-fiskaly-cart]");
    cart.innerHTML = fiskalyReceiptItems.map(function (item, index) {
      return "<article class=\"pos-fiskaly-cart-item\" data-fiskaly-item=\"" + escapeHtml(item.id) + "\"><div class=\"pos-fiskaly-cart-item__description\"><label class=\"pos-field\"><span>Opis postavke " + (index + 1) + "</span><input name=\"fiskalyDescription\" maxlength=\"160\" value=\"" + escapeHtml(item.description) + "\" /></label><button class=\"pos-fiskaly-cart-item__remove\" type=\"button\" data-fiskaly-remove=\"" + escapeHtml(item.id) + "\" aria-label=\"Odstrani postavko\"" + (fiskalyReceiptItems.length === 1 ? " disabled" : "") + "><svg><use href=\"#i-trash\"/></svg></button></div><div class=\"pos-fiskaly-cart-item__values\"><label class=\"pos-field\"><span>Količina</span><input name=\"fiskalyQuantity\" inputmode=\"decimal\" value=\"" + escapeHtml(formatDecimalMilli(item.quantityMilli)) + "\" /></label><label class=\"pos-field\"><span>Bruto / enoto</span><input name=\"fiskalyUnitPrice\" inputmode=\"decimal\" value=\"" + escapeHtml((item.unitGrossCents / 100).toFixed(2).replace(".", ",")) + "\" /></label><label class=\"pos-field\"><span>DDV</span><select name=\"fiskalyVatRate\"><option value=\"19\"" + (item.vatRate === "19" ? " selected" : "") + ">19 %</option><option value=\"7\"" + (item.vatRate === "7" ? " selected" : "") + ">7 %</option><option value=\"0\"" + (item.vatRate === "0" ? " selected" : "") + ">0 %</option></select></label></div><div class=\"pos-fiskaly-cart-item__line\"><span>Bruto znesek postavke</span><strong data-fiskaly-line-total=\"" + escapeHtml(item.id) + "\">" + escapeHtml(formatMoney(Math.round(item.unitGrossCents * item.quantityMilli / 1000))) + "</strong></div></article>";
    }).join("");
    query("[data-fiskaly-cart-count]").textContent = fiskalyCountLabel(fiskalyReceiptItems.length);
    query("[data-fiskaly-add-item]").disabled = fiskalyReceiptItems.length >= 5;
    renderFiskalyCartSummary();
  }

  function openFiskalyReceiptSheet() {
    if (!fiskalyCapability.integrationReady) { showToast("Najprej mora biti pripravljena fiskaly TEST povezava."); return; }
    var retryReceipt = storedFiskalyTrainingReceipt();
    if (fiskalyTestRequestId && retryReceipt && Array.isArray(retryReceipt.items) && retryReceipt.items.length) {
      fiskalyReceiptItems = retryReceipt.items.map(function (item) {
        return { id: uid("fiskaly-item"), description: item.description, quantityMilli: item.quantityMilli, unitGrossCents: item.unitGrossCents, vatRate: String(item.vatRate) };
      });
      var retryPayment = query("[name=fiskalyPaymentType][value=" + (retryReceipt.paymentType === "CASH" ? "CASH" : "NON_CASH") + "]");
      if (retryPayment) retryPayment.checked = true;
    }
    query("#pos-fiskaly-receipt-form").hidden = false;
    query("[data-fiskaly-signed]").hidden = true;
    query("#pos-fiskaly-receipt-form").elements.fiskalyConfirmed.checked = false;
    renderFiskalyCart();
    query("[data-fiskaly-receipt-backdrop]").hidden = false;
  }

  function closeFiskalyReceiptSheet() {
    query("[data-fiskaly-receipt-backdrop]").hidden = true;
  }

  function resetFiskalyReceiptSheet() {
    query("[data-fiskaly-signed]").hidden = true;
    query("#pos-fiskaly-receipt-form").hidden = false;
    query("#pos-fiskaly-receipt-form").elements.fiskalyConfirmed.checked = false;
    renderFiskalyCart();
  }

  function formatFiskalyTimestamp(value) {
    var text = String(value || "");
    var numeric = Number(text);
    var date = Number.isFinite(numeric) && numeric > 0 ? new Date(numeric > 100000000000 ? numeric : numeric * 1000) : new Date(text);
    return Number.isNaN(date.getTime()) ? "–" : new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "medium" }).format(date);
  }

  function storedFiskalyTrainingReceipt() {
    try {
      var stored = JSON.parse(global.sessionStorage.getItem(FISKALY_TRAINING_RECEIPT_KEY) || "null");
      return stored && typeof stored === "object" ? stored : null;
    } catch (_error) { return null; }
  }

  function clearFiskalyTrainingRetry() {
    fiskalyTestRequestId = null;
    try {
      global.sessionStorage.removeItem(FISKALY_TRAINING_ID_KEY);
      global.sessionStorage.removeItem(FISKALY_TRAINING_RECEIPT_KEY);
    } catch (_error) {}
  }

  function renderSignedKassenbon(transaction) {
    var receipt = transaction.receipt || { items: [], totalsByVat: [], grossCents: 0 };
    var profileName = String(state.profile.legalName || "WerkTech Lab – Testbetrieb");
    var profileAddress = [state.profile.street, [state.profile.postalCode, state.profile.city].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "Geschäftsanschrift noch nicht hinterlegt";
    query("[data-kassenbon-company]").textContent = profileName;
    query("[data-kassenbon-address]").textContent = profileAddress;
    query("[data-kassenbon-date]").textContent = formatFiskalyTimestamp(transaction.finishedAt);
    query("[data-kassenbon-number]").textContent = String(transaction.transactionNumber || "–");
    query("[data-kassenbon-lines]").innerHTML = (receipt.items || []).map(function (item) {
      var vatLabel = String(item.vatRate) === "0" ? "Steuerfrei / 0 % (Test)" : "USt. " + item.vatRate + " %";
      return "<div class=\"pos-kassenbon-line\"><strong>" + escapeHtml(item.description) + "</strong><b>" + escapeHtml(formatMoney(item.grossCents)) + "</b><small>" + escapeHtml(formatDecimalMilli(item.quantityMilli) + " × " + formatMoney(item.unitGrossCents) + " · " + vatLabel) + "</small></div>";
    }).join("");
    query("[data-kassenbon-taxes]").innerHTML = (receipt.totalsByVat || []).map(function (row) {
      var vatLabel = String(row.vatRate) === "0" ? "Steuerfrei / 0 % (Test)" : "USt. " + row.vatRate + " %";
      return "<div class=\"pos-kassenbon-tax\"><span>" + escapeHtml(vatLabel) + "</span><span>Netto " + escapeHtml(formatMoney(row.netCents)) + "</span><span>USt. " + escapeHtml(formatMoney(row.taxCents)) + "</span><strong>Brutto " + escapeHtml(formatMoney(row.grossCents)) + "</strong></div>";
    }).join("");
    query("[data-kassenbon-total]").textContent = formatMoney(receipt.grossCents);
    query("[data-kassenbon-payment]").textContent = transaction.paymentType === "CASH" ? "Zahlungsart: Bar (TRAINING)" : "Zahlungsart: Karte / unbar (TRAINING)";
    query("[data-kassenbon-start]").textContent = formatFiskalyTimestamp(transaction.startedAt);
    query("[data-kassenbon-end]").textContent = formatFiskalyTimestamp(transaction.finishedAt);
    query("[data-kassenbon-client]").textContent = String(transaction.clientSerialNumber || "–");
    query("[data-kassenbon-tss]").textContent = String(transaction.tssSerialNumber || "–");
    query("[data-kassenbon-counter]").textContent = String(transaction.signatureCounter || "–");
    query("[data-kassenbon-algorithm]").textContent = String(transaction.signatureAlgorithm || "–");
    var canvas = query("[data-kassenbon-qr]");
    if (canvas && typeof canvas.getContext === "function") {
      var context = canvas.getContext("2d");
      if (context) context.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (canvas && transaction.qrCodeData && global.QRCode && typeof global.QRCode.toCanvas === "function") {
      global.QRCode.toCanvas(canvas, transaction.qrCodeData, { width: 132, margin: 1, errorCorrectionLevel: "M" }, function () {});
    }
    query("#pos-fiskaly-receipt-form").hidden = true;
    query("[data-fiskaly-signed]").hidden = false;
    var sheet = query(".pos-fiskaly-receipt-sheet");
    if (sheet) sheet.scrollTop = 0;
    fitAllText();
  }

  async function submitFiskalyTrainingReceipt(event) {
    event.preventDefault();
    var form = event.currentTarget;
    if (fiskalyTestRunning || !fiskalyCapability.integrationReady) return;
    if (!form.elements.fiskalyConfirmed.checked) { showToast("Potrdite, da razumete TRAINING način."); return; }
    var invalid = fiskalyReceiptItems.some(function (item) { return !String(item.description || "").trim() || item.quantityMilli < 1 || item.unitGrossCents < 0; });
    if (invalid || fiskalyReceiptTotals().gross <= 0) { showToast("Preverite opise, količine in cene testnih postavk."); return; }
    fiskalyTestRunning = true;
    renderFiskalyCapability();
    var submit = query("[data-fiskaly-receipt-submit]");
    submit.disabled = true;
    submit.textContent = "Podpisujem …";
    try {
      var token = await apiSessionToken();
      var transactionId = fiskalyTestRequestId || randomUuid();
      var payment = query("[name=fiskalyPaymentType]:checked");
      var currentReceipt = {
        paymentType: payment ? payment.value : "NON_CASH",
        items: fiskalyReceiptItems.map(function (item) {
          return { description: item.description, quantityMilli: item.quantityMilli, unitGrossCents: item.unitGrossCents, vatRate: item.vatRate };
        })
      };
      var receiptPayload = fiskalyTestRequestId && storedFiskalyTrainingReceipt() || currentReceipt;
      fiskalyTestRequestId = transactionId;
      try {
        global.sessionStorage.setItem(FISKALY_TRAINING_ID_KEY, transactionId);
        global.sessionStorage.setItem(FISKALY_TRAINING_RECEIPT_KEY, JSON.stringify(receiptPayload));
      } catch (_error) {}
      var response;
      try {
        response = await fetch("/api/pos-fiskaly", {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "training-receipt", transactionId: transactionId, receipt: receiptPayload })
        });
      } catch (networkError) {
        networkError.fiskalyRetryable = true;
        throw networkError;
      }
      var body = null;
      try { body = await response.json(); } catch (_error) {}
      if (!response.ok || !body || !body.transaction) {
        var responseError = new Error(body && body.napaka || "Testnega Kassenbona ni bilo mogoče podpisati.");
        responseError.fiskalyRetryable = [502, 503, 504].indexOf(response.status) !== -1;
        throw responseError;
      }
      renderSignedKassenbon(body.transaction);
      var copy = query("[data-fiskaly-result-copy]");
      if (copy) copy.textContent = "TRAINING · Kassenbon podpis #" + String(body.transaction.signatureCounter || "–");
      query("[data-fiskaly-result]").hidden = false;
      clearFiskalyTrainingRetry();
      showToast("Testni Kassenbon je podpisan v fiskaly SIGN DE.");
    } catch (error) {
      if (!error || !error.fiskalyRetryable) clearFiskalyTrainingRetry();
      showToast(error && error.message || "fiskaly test trenutno ni uspel.");
    } finally {
      fiskalyTestRunning = false;
      submit.disabled = false;
      submit.textContent = "Podpiši testni bon";
      renderFiskalyCapability();
    }
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
    if (!invoice || invoice.status === "cancelled" || invoice.hasCreditNote) { showToast("Izvirnega računa po Stornu ali dobropisu ni dovoljeno ponovno poslati."); return; }
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
      await loadServerState("deliveries");
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
    query("[data-detail-payment-status]").textContent = invoice.status === "cancelled" ? "Storniert" : invoice.status === "credited" ? "Gutgeschrieben" : invoice.status === "paid" ? "Bezahlt" : invoice.status === "partial" ? "Teilbezahlt" : "Offen";
    var status = query("[data-detail-status]");
    status.classList.toggle("is-paid", invoice.status === "paid");
    status.classList.toggle("is-test", invoice.isTest && invoice.status !== "paid");
    status.classList.toggle("is-cancelled", invoice.status === "cancelled" || invoice.status === "credited");
    status.classList.toggle("is-corrected", invoice.corrected && invoice.status === "open");
    status.textContent = invoice.status === "cancelled" ? "Stornirano" : invoice.status === "credited" ? "Dobropisano" : invoice.status === "paid" ? "Plačano" : invoice.status === "partial" ? "Delno plačano" : invoice.corrected ? "Popravljeno" : invoice.isTest ? "Test" : "Odprto";
    query("[data-detail-payment]").disabled = invoice.status === "cancelled" || invoice.hasCreditNote;
    query("[data-detail-copy]").disabled = invoice.status === "cancelled" || invoice.hasCreditNote;
    query("[data-detail-correction]").disabled = invoice.status === "cancelled" || !invoice.serverStored;
    query("[data-detail-send]").disabled = invoice.status === "cancelled" || invoice.hasCreditNote || !invoice.serverStored;
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
        var validationMessage = invoice.einvoiceDocument && invoice.einvoiceDocument.validationMessage;
        setEinvoiceState(invoice, einvoiceStatus === "validated" ? "ready" : einvoiceStatus === "failed" ? "error" : "pending",
          validationMessage || (einvoiceStatus === "validated" ? "KoSIT potrjen arhivirani original" : einvoiceStatus === "failed" ? "KoSIT je našel napake" : "Arhiviran · KoSIT validacija še čaka"));
      } else if (!invoice.serverStored) setEinvoiceState(invoice, "error", "Lokalni test nima arhiviranega XRechnung originala.");
      else {
        setEinvoiceState(invoice, "loading", "UBL XML se varno pripravlja …");
        ensureEinvoiceDocument(invoice).then(function () { if (activeInvoiceId === invoice.id) renderInvoiceDetail(invoice.id); })
          .catch(function (error) { if (activeInvoiceId === invoice.id) setEinvoiceState(invoice, "error", error.message || "XRechnung ni pripravljen."); });
      }
    } else setEinvoiceState(invoice, "pending", "");
    renderPaymentList(invoice);
    renderStripePayment(invoice);
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

  async function stripeCheckoutRequest(action, values) {
    var token = await apiSessionToken();
    var body = Object.assign({ action: action }, values || {});
    var response = await fetch("/api/pos-stripe-checkout", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    var result = null;
    try { result = await response.json(); } catch (_error) {}
    if (!response.ok || !result || !result.ok) throw new Error(result && result.napaka || "Stripe TEST plačilo trenutno ni na voljo.");
    return result;
  }

  async function startStripeCheckout(invoice) {
    if (!invoice || !invoice.isTest || !invoice.serverStored || !backend.ready) {
      showToast("Stripe TEST potrebuje varno shranjen testni račun.");
      return;
    }
    if (invoice.status === "cancelled" || invoice.status === "credited" || invoice.status === "paid" || invoice.hasCreditNote) {
      showToast(invoice.hasCreditNote ? "Po dobropisu novih plačil na izvirni račun ni dovoljeno sprejeti." : invoice.status === "paid" ? "Račun je že plačan." : "Storniranega računa ni mogoče plačati.");
      return;
    }
    var button = query("[data-stripe-payment]");
    button.disabled = true;
    query("span", button).textContent = "Pripravljam Stripe TEST …";
    try {
      var pending = latestStripePayment(invoice);
      var result = pending && pending.status === "pending" && pending.checkoutSessionId
        ? await stripeCheckoutRequest("resume", { sessionId: pending.checkoutSessionId })
        : await stripeCheckoutRequest("create", { invoiceId: invoice.id, requestId: randomUuid() });
      var checkoutUrl = new URL(result.url);
      if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") throw new Error("Stripe ni vrnil varnega Checkout naslova.");
      global.location.assign(checkoutUrl.toString());
    } catch (error) {
      button.disabled = false;
      renderStripePayment(invoice);
      showToast(error && error.message || "Stripe TEST plačila ni bilo mogoče pripraviti.");
    }
  }

  function waitMs(ms) { return new Promise(function (resolve) { global.setTimeout(resolve, ms); }); }

  async function handleStripeReturn(returnState) {
    if (!returnState || !returnState.invoiceId || (returnState.state !== "cancelled" && !returnState.sessionId)) return;
    try {
      var result;
      if (returnState.state === "cancelled") {
        var returnedInvoice = findInvoice(returnState.invoiceId);
        var pendingPayment = latestStripePayment(returnedInvoice);
        var cancelSessionId = String(returnState.sessionId || "").indexOf("cs_test_") === 0
          ? returnState.sessionId
          : pendingPayment && pendingPayment.status === "pending" ? pendingPayment.checkoutSessionId : "";
        if (!cancelSessionId) throw new Error("Odprte Stripe TEST seje za preklic ni mogoče najti.");
        result = await stripeCheckoutRequest("cancel", { sessionId: cancelSessionId });
      } else {
        for (var attempt = 0; attempt < 6; attempt += 1) {
          result = await stripeCheckoutRequest("status", { sessionId: returnState.sessionId });
          if (result.payment && ["succeeded", "failed", "cancelled", "partially_refunded", "refunded"].indexOf(result.payment.status) !== -1) break;
          await waitMs(700 + attempt * 450);
        }
      }
      await loadServerState("payments");
      var invoice = findInvoice(returnState.invoiceId);
      if (invoice) openInvoiceDetail(invoice.id);
      var status = result && result.payment && result.payment.status || "pending";
      showToast(stripeReturnMessage(status));
    } catch (error) {
      showToast(error && error.message || "Stripe TEST rezultata ni bilo mogoče preveriti.");
    }
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

  function openAdjustmentSheet(invoice, initialType) {
    if (!invoice || !invoice.serverStored) { showToast("Popravek je na voljo po varni strežniški izdaji."); return; }
    if (invoice.status === "cancelled") { showToast("Storniranega računa ni mogoče ponovno popraviti."); return; }
    adjustmentInvoiceId = invoice.id;
    var form = query("#pos-adjustment-form");
    form.reset();
    query("[name=adjustmentType][value=" + (initialType === "cancellation" ? "cancellation" : "correction") + "]", form).checked = true;
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
      await loadServerState("invoices");
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
    var open = function () { state.draft = defaultDraft(state.profile); currentStep = 1; persist(); showView("invoice"); };
    if (!state.draft) { open(); return; }
    if (state.draft.workflowMode === "offer") {
      openDialog("Zamenjati osnutek ponudbe?", "Trenutni osnutek ponudbe bo zamenjan z novim računom.", { confirmText: "Nov račun", onConfirm: open });
      return;
    }
    currentStep = 1;
    showView("invoice");
  }

  function startOffer() {
    var create = function () {
      state.draft = defaultDraft(state.profile);
      state.draft.workflowMode = "offer";
      state.draft.offerValidDays = "14";
      currentStep = 1;
      persist();
      showView("invoice");
    };
    if (!state.draft) { create(); return; }
    openDialog("Začeti novo ponudbo?", "Trenutni osnutek bo zamenjan z novo ponudbo.", { confirmText: "Nova ponudba", onConfirm: create });
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
    var offerMode = state.draft.workflowMode === "offer";
    var workflow = state.draft.workflowContext || {};
    query("[data-close-editor]").setAttribute("aria-label", offerMode ? "Zapri ponudbo" : "Zapri račun");
    query("[data-editor-steps-label]").setAttribute("aria-label", offerMode ? "Koraki ponudbe" : "Koraki računa");
    query("[data-customer-step-label]").textContent = offerMode ? "Naročnik" : "Stranka";
    query("[data-customer-step-title]").textContent = offerMode ? "Komu pošiljate ponudbo?" : "Komu izdajate račun?";
    query("[data-issue-date-label]").textContent = offerMode ? "Datum ponudbe *" : "Datum izdaje *";
    query("[data-service-date-label]").textContent = offerMode ? "Predvideni datum izvedbe *" : "Datum storitve *";
    query("[data-draft-label]").textContent = offerMode ? (workflow.offerNumber ? "Urejanje " + workflow.offerNumber : "Nova ponudba") : workflow.invoiceKind === "progress" ? "Abschlagsrechnung · " + (workflow.orderNumber || "Auftrag") : workflow.invoiceKind === "final" ? "Schlussrechnung · " + (workflow.orderNumber || "Auftrag") : "Nov osnutek";
    query("#invoice-title").textContent = offerMode ? "Pripravi ponudbo" : workflow.invoiceKind === "progress" ? "Pripravi Abschlagsrechnung" : workflow.invoiceKind === "final" ? "Pripravi Schlussrechnung" : "Izstavi račun";
    query("[data-offer-validity]").hidden = !offerMode;
    query("[data-final-confirm-title]").textContent = offerMode ? "Preveril sem ponudbo in vse dogovorjene postavke." : "Preveril sem podatke in davčno obravnavo.";
    query("[data-final-confirm-copy]").textContent = offerMode ? "Po označitvi kot poslano se ponudba zaklene." : "Pri Testbetrieb bo dokument jasno označen kot testni in ni pravni račun.";
    query("[data-service-step-title]").textContent = offerMode ? "Kaj ponujate?" : "Kaj je bilo opravljeno?";
    query("[data-service-step-copy]").textContent = offerMode ? "Obseg, postavke in predvideni termin naj bodo razumljivi naročniku." : "Datumi, opis in postavke morajo jasno opisati izvedeno delo.";
    query("[data-items-title]").textContent = offerMode ? "Postavke ponudbe" : "Postavke računa";
    query("[data-items-copy]").textContent = offerMode ? "Cene in količine postanejo osnova naročila." : "Cene lahko vnašate neto ali bruto.";
    query("[data-tax-step-title]").textContent = offerMode ? "Kako bo ponudba davčno obračunana?" : "Kako se račun davčno obravnava?";
    query("[data-review-step-copy]").textContent = offerMode ? "Osnutek lahko še spreminjate; po označitvi kot poslano se zaklene." : "Po pravni izdaji vsebine ne bo mogoče prepisati; popravek bo nov dokument.";
    queryAll("[data-invoice-only-output]").forEach(function (element) { element.hidden = offerMode; });
    query("[data-issue-invoice]").textContent = offerMode ? (workflow.workOrderId ? "Posodobi ponudbo" : "Ustvari ponudbo") : "Ustvari testni račun";
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
    var consumerOffer = state.draft.workflowMode === "offer" && state.draft.customerType === "private";
    query("[data-business-fields]").hidden = !business;
    query("[data-public-fields]").hidden = state.draft.customerType !== "public";
    query("[data-structured-buyer-reference]").hidden = !business;
    query("[data-consumer-contract]").hidden = !consumerOffer;
    query("[data-consumer-withdrawal-note]").hidden = !consumerOffer || ["unknown", "distance", "off_premises"].indexOf(state.draft.consumerContractContext) === -1;
    query("[data-urgent-repair]").hidden = !consumerOffer || state.draft.consumerContractContext !== "urgent_repair";
    query("[data-customer-name-label]").textContent = state.draft.customerType === "private" ? "Ime in priimek *" : "Naziv organizacije *";
    fitAllText();
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
    var year = isoToday().slice(0, 4);
    var prefix = isTest ? "TEST-" + year + "-" : (state.profile.invoicePrefix || "RE-" + year + "-");
    return prefix + String(next).padStart(4, "0");
  }

  function currentInvoiceSnapshot(number) {
    syncDraftFromForm();
    var live = productionReady();
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
    var offerMode = draft.workflowMode === "offer";
    if (offerMode) {
      invoice.number = draft.workflowContext && draft.workflowContext.offerNumber || "ANG-" + isoToday().slice(0, 4) + "-····";
      invoice.dueDate = addDays(draft.issueDate, draft.offerValidDays);
    }
    var profile = state.profile;
    var displayProfile = profileForPreview(profile, invoice.isTest);
    var errors = validateStep(draft, profile, 4);
    if (offerMode && (integer(draft.offerValidDays, 0) < 1 || integer(draft.offerValidDays, 0) > 180)) errors.push("Veljavnost ponudbe mora biti med 1 in 180 dni.");
    var validation = query("[data-validation-summary]");
    validation.innerHTML = errors.length
      ? "<div class=\"pos-validation__errors\"><strong>Pred izdajo popravite:</strong><ul>" + errors.map(function (error) { return "<li>" + escapeHtml(error) + "</li>"; }).join("") + "</ul></div>"
      : "<div class=\"pos-validation__ok\"><strong>Osnovni zakonski podatki so izpolnjeni.</strong> Pred produkcijsko e-izdajo mora XML prestati še KoSIT validacijo.</div>";
    var items = draft.items.map(function (item) {
      var calc = calculateItem(item, draft.priceMode, draft.taxMode);
      return "<tr><td>" + escapeHtml(item.description || "—") + "</td><td>" + escapeHtml(formatDecimalMilli(calc.quantityMilli)) + "</td><td>" + escapeHtml(formatMoney(calc.grossCents)) + "</td></tr>";
    }).join("");
    var noteParts = [taxNote(draft), defaultNotice(draft), propertyRetentionNotice(draft)];
    var replacement = normalizeReplacementContext(draft);
    if (replacement) noteParts.unshift("Nadomestni račun za " + replacement.cancellationNumber + "; prvotni račun " + replacement.originalInvoiceNumber + ".");
    if (draft.handwerker35a) noteParts.push("Davčno upravičeni stroški dela, vožnje in strojev: " + formatMoney(invoice.totals.eligible35aCents) + ". Končno upravičenost preveri Finanzamt.");
    if (draft.constructionWithholding) noteParts.push("Bauleistung: stanje Freistellungsbescheinigung – " + draft.exemptionCertificate + ".");
    var deductions = invoice.totals.deductions || [];
    if (deductions.length) noteParts.push("Vereinnahmte Teilentgelte und die darauf entfallende Umsatzsteuer sind gemäß § 14 Abs. 5 UStG abgesetzt.");
    var totalsHtml = deductions.length
      ? "<div class=\"pos-preview__total-row\"><span>Leistungswert netto</span><span>" + escapeHtml(formatMoney(invoice.totals.serviceNetCents)) + "</span></div><div class=\"pos-preview__total-row\"><span>Umsatzsteuer gesamt</span><span>" + escapeHtml(formatMoney(invoice.totals.serviceTaxCents)) + "</span></div><div class=\"pos-preview__total-row\"><span>Auftragssumme brutto</span><span>" + escapeHtml(formatMoney(invoice.totals.serviceGrossCents)) + "</span></div>" + deductions.map(function (entry) { return "<div class=\"pos-preview__total-row\"><span>Abschlag " + escapeHtml(entry.invoiceNumber || entry.invoiceId) + " · Netto " + escapeHtml(formatMoney(entry.netCents)) + " · USt. " + escapeHtml(formatMoney(entry.taxCents)) + "</span><span>− " + escapeHtml(formatMoney(entry.grossCents)) + "</span></div>"; }).join("") + "<div class=\"pos-preview__total-row pos-preview__total-row--final\"><span>Noch zu zahlen</span><span>" + escapeHtml(formatMoney(invoice.totals.grossCents)) + "</span></div>"
      : "<div class=\"pos-preview__total-row\"><span>Netto</span><span>" + escapeHtml(formatMoney(invoice.totals.netCents)) + "</span></div><div class=\"pos-preview__total-row\"><span>Umsatzsteuer</span><span>" + escapeHtml(formatMoney(invoice.totals.taxCents)) + "</span></div><div class=\"pos-preview__total-row pos-preview__total-row--final\"><span>Gesamtbetrag</span><span>" + escapeHtml(formatMoney(invoice.totals.grossCents)) + "</span></div>";
    var preview = query("[data-invoice-preview]");
    preview.classList.toggle("is-test", invoice.isTest && !offerMode);
    preview.innerHTML = "<div class=\"pos-preview__head\"><div class=\"pos-preview__seller\"><strong data-fit-text>" + escapeHtml(displayProfile.legalName || "Vaše podjetje") + "</strong><small data-fit-text>" + escapeHtml([displayProfile.street, displayProfile.postalCode, displayProfile.city].filter(Boolean).join(", ") || "Podatki podjetja še niso popolni") + "</small></div><span class=\"pos-preview__badge\">" + (offerMode ? "ANGEBOT" : invoice.isTest ? "TESTRECHNUNG" : "RECHNUNG") + "</span></div><h4 class=\"pos-preview__title\">" + (offerMode ? "Angebot" : "Rechnung") + "</h4><div class=\"pos-preview__number\">" + escapeHtml(invoice.number) + "</div><div class=\"pos-preview__meta\"><div><small>Ausstellungsdatum</small><strong>" + escapeHtml(formatDate(draft.issueDate)) + "</strong></div><div><small>Leistungsdatum</small><strong>" + escapeHtml(formatDate(draft.serviceDate)) + "</strong></div><div><small>" + (offerMode ? "Gültig bis" : "Fällig am") + "</small><strong>" + escapeHtml(formatDate(invoice.dueDate)) + "</strong></div><div><small>" + (offerMode ? "Status" : "Zahlungsart") + "</small><strong>" + escapeHtml(offerMode ? "Unverbindlich bis Annahme" : draft.paymentMethod === "sepa" ? "Überweisung" : draft.paymentMethod === "already_paid" ? "Bereits bezahlt" : "Externe Karte") + "</strong></div></div><div class=\"pos-preview__customer\"><small>" + (offerMode ? "Angebot für" : "Rechnung an") + "</small><strong data-fit-text>" + escapeHtml(draft.customerName || "—") + "</strong><span data-fit-text>" + escapeHtml([draft.customerStreet, draft.customerPostalCode, draft.customerCity].filter(Boolean).join(", ") || "—") + "</span></div><table class=\"pos-preview__table\"><thead><tr><th>Leistung</th><th>Menge</th><th>Betrag</th></tr></thead><tbody>" + items + "</tbody></table><div class=\"pos-preview__totals\">" + totalsHtml + "</div><p class=\"pos-preview__note\">" + escapeHtml(offerMode ? "Dieses Angebot ist bis zum genannten Datum gültig. Leistungsumfang und Preise werden erst mit Annahme verbindlich." : noteParts.filter(Boolean).join(" ") || "Bitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer.") + "</p>";
    query("[data-issue-invoice]").textContent = offerMode ? (draft.workflowContext && draft.workflowContext.workOrderId ? "Posodobi ponudbo" : "Ustvari ponudbo") : invoice.isTest ? "Ustvari testni račun" : "Pravno izdaj račun";
    query("[data-issue-invoice]").disabled = errors.length > 0;
    if (offerMode) {
      var oldQr = query(".pos-preview__qr", preview);
      if (oldQr) oldQr.remove();
    } else renderQr(invoice);
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
    if (state.draft && state.draft.workflowMode === "offer") { issueOffer(); return; }
    var errors = validateStep(state.draft, state.profile, 4);
    if (errors.length) { renderPreview(); showToast(errors[0]); return; }
    var readiness = profileReadiness(state.profile);
    var live = productionReady();
    var calendarError = live ? liveInvoiceDateError(state.draft, isoToday()) : "";
    if (calendarError) { showToast(calendarError); return; }
    var withholdingError = live ? liveConstructionWithholdingError(state.draft) : "";
    if (withholdingError) { showToast(withholdingError); return; }
    var replacement = normalizeReplacementContext(state.draft);
    if (readiness.live && backend.ready && !archiveCapability.productionReady) {
      showToast("Produkcijska izdaja čaka potrjeno ločeno arhivsko kopijo in preizkus obnove.");
      return;
    }
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
              await loadServerState("invoices");
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

  function issueOffer() {
    syncDraftFromForm();
    var errors = validateStep(state.draft, state.profile, 4);
    var validDays = integer(state.draft.offerValidDays, 0);
    if (validDays < 1 || validDays > 180) errors.push("Veljavnost ponudbe mora biti med 1 in 180 dni.");
    if (errors.length) { renderPreview(); showToast(errors[0]); return; }
    if (!backend.ready || !backend.client) { showToast("Ponudba potrebuje varno strežniško hrambo in številčenje."); return; }
    var existingId = state.draft.workflowContext && state.draft.workflowContext.workOrderId || null;
    openDialog(existingId ? "Posodobiti ponudbo?" : "Ustvariti ponudbo?", existingId ? "Spremembe bodo shranjene v osnutek. Poslana ponudba ostane nespremenljiva." : "Ponudba dobi zaporedno številko. Zaklene se šele, ko jo označite kot poslano.", {
      confirmText: existingId ? "Posodobi" : "Ustvari ponudbo",
      onConfirm: async function () {
        try {
          var result = await backend.client.rpc("pos_save_work_order", { p_work_order_id: existingId, p_payload: workOrderPayloadFromDraft(state.draft) }).single();
          if (result.error) throw result.error;
          state.draft = null;
          persist();
          await loadServerState("invoices");
          showView("work-orders");
          showToast(existingId ? "Osnutek ponudbe je posodobljen." : "Ponudba je varno ustvarjena.");
        } catch (error) { showToast(error && error.message || "Ponudbe ni bilo mogoče shraniti."); }
      }
    });
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
    if (invoice.hasCreditNote) { showToast("Po dobropisu novih plačil na izvirni račun ni dovoljeno sprejeti."); return; }
    if (invoice.status === "paid") { showToast("Ta račun je že označen kot plačan."); return; }
    var outstandingCents = invoiceOutstandingCents(invoice);
    openDialog("Označiti kot plačano?", invoice.number + " · preostanek " + formatMoney(outstandingCents) + ". Ročna potrditev mora temeljiti na dejansko vidnem plačilu.", {
      confirmText: "Potrdi plačilo",
      onConfirm: async function () {
        try {
          var paidAt = new Date().toISOString();
          var savedPayment = null;
          if (invoice.serverStored) {
            if (!backend.ready || !backend.userId) throw new Error("Varna hramba plačil ni povezana.");
            var result = await backend.client.rpc("pos_record_manual_payment", {
              p_invoice_id: invoice.id,
              p_confirmed: true
            });
            if (result.error) throw result.error;
            var paymentRow = Array.isArray(result.data) ? result.data[0] : result.data;
            if (!paymentRow || !paymentRow.id) throw new Error("Strežnik ni vrnil potrjenega plačila.");
            savedPayment = paymentFromServer(paymentRow);
          }
          if (!savedPayment) savedPayment = paymentFromServer({
            id: "local-" + Date.now(), invoice_id: invoice.id,
            amount_cents: invoiceOutstandingCents(invoice), currency: "EUR",
            method: "manual", provider_reference: "Ročno potrjeno v POS", paid_at: paidAt
          });
          invoice.payments = (invoice.payments || []).concat([savedPayment]);
          invoice.paidCents = invoice.adjustedGrossCents == null ? invoice.totals.grossCents : invoice.adjustedGrossCents;
          invoice.status = "paid";
          invoice.paidAt = paidAt;
          persist();
          if (currentView === "invoice-detail") renderInvoiceDetail(invoice.id);
          else if (currentView === "invoices") renderInvoiceOverview();
          else renderHome();
          showToast("Plačilo je zabeleženo ločeno od računa.");
        } catch (error) { showToast(error && error.message || "Plačila ni bilo mogoče shraniti."); }
      }
    });
  }

  function requestLatestPayment() {
    var invoice = latestManualPaymentCandidate(state.invoices);
    if (!invoice) { showToast("Ni odprtega računa za plačilo."); return; }
    requestPayment(invoice.id);
  }

  async function posOfferPdfRequest(workOrderId, mode) {
    var token = await apiSessionToken();
    var action = mode || "download";
    var response = await fetch("/api/pos-angebot-pdf?workOrderId=" + encodeURIComponent(workOrderId) + "&mode=" + encodeURIComponent(action), {
      method: action === "metadata" ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) {
      var body = null;
      try { body = await response.json(); } catch (_error) {}
      throw new Error(body && body.napaka || "PDF ponudbe ni bilo mogoče pripraviti.");
    }
    return response;
  }

  async function ensureOfferDocument(workOrderId) {
    var response = await posOfferPdfRequest(workOrderId, "metadata");
    var body = await response.json();
    return body.document;
  }

  async function downloadOfferPdf(order) {
    if (!order || !order.id || order.status === "draft") throw new Error("PDF je na voljo šele po zaklepu ponudbe.");
    var response = await posOfferPdfRequest(order.id, "download");
    var blob = await response.blob();
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = String(order.offerNumber || "Angebot").replace(/[^A-Za-z0-9._-]+/g, "-") + ".pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  async function adjustmentEinvoiceRequest(adjustmentId, mode) {
    var token = await apiSessionToken();
    var response = await fetch("/api/pos-racun-korekcija-xrechnung?adjustmentId=" + encodeURIComponent(adjustmentId) + "&mode=" + encodeURIComponent(mode || "download"), {
      method: mode === "download" ? "GET" : "POST", headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) {
      var body = null;
      try { body = await response.json(); } catch (_error) {}
      throw new Error(body && body.napaka || "Strukturiranega popravka ni bilo mogoče pripraviti.");
    }
    return response;
  }

  async function downloadAdjustmentEinvoice(adjustment) {
    var status = adjustment.einvoiceDocument && (adjustment.einvoiceDocument.validation_status || adjustment.einvoiceDocument.validationStatus) || "pending";
    if (!adjustment.einvoiceDocumentReady || status !== "validated") {
      var metadataResponse = await adjustmentEinvoiceRequest(adjustment.id, "validate");
      var metadata = await metadataResponse.json();
      adjustment.einvoiceDocumentReady = true;
      adjustment.einvoiceDocument = metadata.document;
      status = metadata.document && (metadata.document.validation_status || metadata.document.validationStatus) || "pending";
      if (status === "failed") throw new Error(metadata.document.validationMessage || "KoSIT je strukturirani popravek zavrnil.");
    }
    var response = await adjustmentEinvoiceRequest(adjustment.id, "download");
    var blob = await response.blob();
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = adjustment.number.replace(/[^A-Za-z0-9._-]+/g, "-") + "-XRechnung.xml";
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  async function posContractConfirmationPdfRequest(workOrderId, mode) {
    var token = await apiSessionToken();
    var action = mode || "download";
    var response = await fetch("/api/pos-pogodba-pdf?workOrderId=" + encodeURIComponent(workOrderId) + "&mode=" + encodeURIComponent(action), {
      method: action === "metadata" ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) {
      var body = null;
      try { body = await response.json(); } catch (_error) {}
      throw new Error(body && body.napaka || "PDF pogodbenega potrdila ni bilo mogoče pripraviti.");
    }
    return response;
  }

  async function ensureContractConfirmationDocument(workOrderId) {
    var response = await posContractConfirmationPdfRequest(workOrderId, "metadata");
    var body = await response.json();
    return body.document;
  }

  async function downloadContractConfirmationPdf(order) {
    if (!order || !order.id || !requiresContractConfirmation(order) || ["draft", "offered"].indexOf(order.status) !== -1) {
      throw new Error("Pogodbeno potrdilo je na voljo po sprejemu potrošniške ponudbe.");
    }
    var response = await posContractConfirmationPdfRequest(order.id, "download");
    var blob = await response.blob();
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = String(order.orderNumber || "Vertragsbestaetigung").replace(/[^A-Za-z0-9._-]+/g, "-") + "-Vertragsbestaetigung.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  async function sha256Hex(text) {
    if (!global.crypto || !global.crypto.subtle || !global.TextEncoder) throw new Error("Ta brskalnik ne podpira varnega prstnega odtisa datoteke.");
    var bytes = new global.TextEncoder().encode(String(text || ""));
    var digest = await global.crypto.subtle.digest("SHA-256", bytes);
    return Array.prototype.map.call(new Uint8Array(digest), function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
  }

  function updateFinapiBankCapability(value) {
    var next = value || {};
    finapiBankCapability.loaded = true;
    finapiBankCapability.configured = Boolean(next.configured);
    finapiBankCapability.connected = Boolean(next.connected);
    finapiBankCapability.pending = Boolean(next.pending);
    finapiBankCapability.environment = "sandbox";
    finapiBankCapability.bankName = String(next.bankName || "");
    finapiBankCapability.lastError = false;
  }

  function renderFinapiBankControl() {
    var box = query("[data-finapi-bank]");
    var title = query("[data-finapi-bank-title]");
    var status = query("[data-finapi-bank-status]");
    var badge = query("[data-finapi-bank-badge]");
    var button = query("[data-finapi-bank-sync]");
    if (!box || !title || !status || !badge || !button) return;
    var busy = finapiBankCapability.loading || finapiBankCapability.syncing;
    box.classList.toggle("is-ready", finapiBankCapability.connected);
    box.classList.toggle("is-error", finapiBankCapability.lastError);
    title.textContent = finapiBankCapability.bankName || "finAPI testna banka";
    badge.textContent = finapiBankCapability.lastError ? "NAPAKA" : "TEST";
    status.textContent = finapiBankCapability.loading ? "Preverjam varno povezavo …"
      : finapiBankCapability.syncing ? "Prenašam testne prilive …"
        : finapiBankCapability.pending ? "Banka še pripravlja testne prilive"
          : finapiBankCapability.connected ? "Sandbox povezan · brez pravih nakazil"
            : finapiBankCapability.configured ? "Pripravljeno za varen test"
              : "Strežniški ključi še niso nastavljeni";
    button.textContent = finapiBankCapability.syncing ? "Sinhroniziram …"
      : finapiBankCapability.connected ? "Osveži prilive" : "Poveži testno banko";
    button.disabled = busy || !finapiBankCapability.configured || !backend.bankReady;
  }

  async function loadFinapiBankStatus(showFeedback) {
    if (finapiBankCapability.loading) return finapiBankCapability;
    finapiBankCapability.loading = true;
    renderFinapiBankControl();
    try {
      var token = await apiSessionToken();
      var response = await fetch("/api/pos-finapi", { method: "GET", headers: { Authorization: "Bearer " + token } });
      var body = null;
      try { body = await response.json(); } catch (_error) {}
      if (!response.ok || !body || !body.finapi) throw new Error(body && body.napaka || "finAPI stanja ni bilo mogoče preveriti.");
      updateFinapiBankCapability(body.finapi);
      if (showFeedback) showToast(finapiBankCapability.connected ? "finAPI testna banka je povezana." : finapiBankCapability.configured ? "finAPI je pripravljen za testno povezavo." : "finAPI ključi še niso nastavljeni.");
    } catch (error) {
      finapiBankCapability.loaded = true;
      finapiBankCapability.lastError = true;
      if (showFeedback) showToast(error && error.message || "finAPI stanja ni bilo mogoče preveriti.");
    } finally {
      finapiBankCapability.loading = false;
      renderFinapiBankControl();
    }
    return finapiBankCapability;
  }

  async function syncFinapiBank() {
    if (finapiBankCapability.syncing) return;
    finapiBankCapability.syncing = true;
    finapiBankCapability.lastError = false;
    renderFinapiBankControl();
    try {
      if (!backend.ready || !backend.userId) throw new Error("Za finAPI je potrebna varna prijavljena hramba.");
      if (!backend.bankReady) throw new Error("Bančni modul še ni aktiviran.");
      var token = await apiSessionToken();
      var action = finapiBankCapability.connected ? "sync" : "connect";
      var response = await fetch("/api/pos-finapi", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ action: action })
      });
      var body = null;
      try { body = await response.json(); } catch (_error) {}
      if (action === "connect" && response.ok && body && body.webForm && body.webForm.url) {
        var webFormUrl = new URL(body.webForm.url);
        if (webFormUrl.protocol !== "https:" || webFormUrl.hostname !== "webform-sandbox.finapi.io") throw new Error("finAPI ni vrnil varnega testnega obrazca.");
        var returnUrl = new URL(global.location.href);
        returnUrl.search = "";
        returnUrl.hash = "";
        var errorReturnUrl = new URL(returnUrl.toString());
        var abortReturnUrl = new URL(returnUrl.toString());
        returnUrl.searchParams.set("finapi", "complete");
        errorReturnUrl.searchParams.set("finapi", "error");
        abortReturnUrl.searchParams.set("finapi", "abort");
        webFormUrl.searchParams.set("redirectUrl", returnUrl.toString());
        webFormUrl.searchParams.set("errorRedirectUrl", errorReturnUrl.toString());
        webFormUrl.searchParams.set("abortRedirectUrl", abortReturnUrl.toString());
        webFormUrl.searchParams.set("language", "de");
        webFormUrl.searchParams.set("colorMode", "light");
        global.location.assign(webFormUrl.toString());
        return;
      }
      if (!response.ok || !body || !body.finapi) throw new Error(body && body.napaka || "Testnih prilivov ni bilo mogoče sinhronizirati.");
      updateFinapiBankCapability(body.finapi);
      var transactions = Array.isArray(body.transactions) ? body.transactions : [];
      var summary = { inserted_count: 0, duplicate_count: 0 };
      if (transactions.length) {
        var fingerprint = await sha256Hex(JSON.stringify(transactions));
        var result = await backend.client.rpc("pos_import_finapi_transactions", {
          p_batch_sha256: fingerprint,
          p_transactions: transactions
        });
        if (result.error) throw result.error;
        summary = result.data || summary;
        await loadServerState("bank");
      }
      renderBankSheet();
      if (!transactions.length && finapiBankCapability.pending) showToast("Testna banka še pripravlja prilive. Čez nekaj trenutkov pritisnite Osveži prilive.");
      else if (!transactions.length) showToast("finAPI testna banka trenutno nima novih EUR prilivov.");
      else showToast("finAPI: novih " + integer(summary.inserted_count, 0) + "; že znanih " + integer(summary.duplicate_count, 0) + ".");
    } catch (error) {
      finapiBankCapability.lastError = true;
      showToast(error && error.message || "finAPI sinhronizacija ni uspela.");
    } finally {
      finapiBankCapability.syncing = false;
      renderFinapiBankControl();
    }
  }

  function closeBankSheet() {
    query("[data-bank-backdrop]").hidden = true;
    document.documentElement.classList.remove("uj-modal-odprt");
    document.body.classList.remove("uj-modal-odprt");
  }

  function renderBankSheet() {
    renderFinapiBankControl();
    var transactions = state.bankTransactions || [];
    var confirmed = transactions.filter(function (entry) { return entry.status === "confirmed"; }).length;
    var resolvedMatches = resolveBankMatches(transactions, state.invoices);
    var suggested = Object.keys(resolvedMatches.suggestions).length;
    query("[data-bank-summary]").innerHTML = [
      [transactions.length, "Prilivi"], [suggested, "Predlogi"], [confirmed, "Potrjeni"]
    ].map(function (entry) { return "<div><strong>" + entry[0] + "</strong><small>" + entry[1] + "</small></div>"; }).join("");
    var list = query("[data-bank-list]");
    if (!transactions.length) {
      list.innerHTML = backend.syncing
        ? "<div class=\"pos-empty\"><strong>Nalagam bančne podatke …</strong><p>Preverjam povezavo in zadnje prilive.</p></div>"
        : backend.bankReady
        ? "<div class=\"pos-empty\"><strong>Ni prejetih prilivov</strong><p>Sinhronizirajte finAPI testno banko ali uvozite CSV oziroma camt.053.</p></div>"
        : "<div class=\"pos-empty\"><strong>Bančni modul še ni aktiviran</strong><p>Obstoječi POS deluje normalno; uvoz bo na voljo po varni nadgradnji baze.</p></div>";
      query("[data-bank-import-another]").disabled = !backend.bankReady;
      return;
    }
    query("[data-bank-import-another]").disabled = false;
    list.innerHTML = transactions.map(function (transaction) {
      var suggestion = resolvedMatches.suggestions[String(transaction.id)] || null;
      var ambiguity = resolvedMatches.ambiguities[String(transaction.id)] || "";
      var confirmedInvoice = transaction.confirmedInvoiceId && findInvoice(transaction.confirmedInvoiceId);
      var options = state.invoices.filter(function (invoice) {
        var outstanding = invoiceOutstandingCents(invoice);
        return invoice.serverStored && !invoice.hasCreditNote && invoice.status !== "cancelled" && outstanding >= transaction.amountCents && outstanding > 0;
      });
      if (suggestion) options.sort(function (left, right) {
        if (left.id === suggestion.invoice.id) return -1;
        if (right.id === suggestion.invoice.id) return 1;
        return 0;
      });
      var optionHtml = options.length ? (suggestion ? "" : "<option value=\"\" selected disabled>Izberite račun …</option>") + options.map(function (invoice) {
        var selected = suggestion && suggestion.invoice.id === invoice.id ? " selected" : "";
        var outstanding = invoiceOutstandingCents(invoice);
        return "<option value=\"" + escapeHtml(invoice.id) + "\"" + selected + ">" + escapeHtml(invoice.number + " · " + invoice.draft.customerName + " · " + formatMoney(outstanding)) + "</option>";
      }).join("") : "<option value=\"\">Ni primernega odprtega računa</option>";
      var bottom = transaction.status === "confirmed"
        ? "<div class=\"pos-bank-entry__confirmed\"><span>✓ Plačilo potrjeno</span><span>" + escapeHtml(confirmedInvoice ? confirmedInvoice.number : "Račun") + "</span></div>"
        : "<div class=\"pos-bank-match\"><label>" + (suggestion ? "Predlagan račun" : "Izberite račun") + "<select data-bank-invoice=\"" + escapeHtml(transaction.id) + "\">" + optionHtml + "</select>" + (suggestion ? "<span class=\"pos-bank-match__reason\">" + escapeHtml(suggestion.reason) + " · " + suggestion.score + " %</span>" : ambiguity ? "<span class=\"pos-bank-match__reason is-warning\">" + escapeHtml(ambiguity) + "</span>" : "") + "</label><button class=\"pos-primary\" type=\"button\" data-bank-confirm=\"" + escapeHtml(transaction.id) + "\"" + (suggestion && options.length ? "" : " disabled") + ">Potrdi povezavo</button></div>";
      var sourceAccount = transaction.sourceAccountName || transaction.sourceAccountIban || transaction.sourceAccountId;
      var sourceAccountHtml = sourceAccount
        ? "<p class=\"pos-bank-entry__source\">Prejeto na " + escapeHtml(transaction.sourceAccountName || "bančni račun") + (transaction.sourceAccountIban ? " · " + escapeHtml(transaction.sourceAccountIban) : "") + "</p>"
        : "";
      return "<article class=\"pos-bank-entry " + (transaction.status === "confirmed" ? "is-confirmed" : "") + "\"><div class=\"pos-bank-entry__top\"><div><strong data-fit-text>" + escapeHtml(transaction.counterpartyName || "Neznani plačnik") + "</strong><small>" + escapeHtml(formatDate(transaction.bookedOn)) + (transaction.counterpartyIban ? " · " + escapeHtml(transaction.counterpartyIban) : "") + "</small></div><b class=\"pos-bank-entry__amount\">" + escapeHtml(formatMoney(transaction.amountCents)) + "</b></div><p class=\"pos-bank-entry__purpose\">" + escapeHtml(transaction.remittanceInfo || transaction.externalReference || "Brez namena plačila") + "</p>" + sourceAccountHtml + bottom + "</article>";
    }).join("");
    queryAll("[data-bank-confirm]", list).forEach(function (button) {
      button.addEventListener("click", function () { requestBankConfirmation(button.getAttribute("data-bank-confirm")); });
    });
    queryAll("[data-bank-invoice]", list).forEach(function (select) {
      select.addEventListener("change", function () {
        var button = query("[data-bank-confirm=\"" + select.getAttribute("data-bank-invoice") + "\"]", list);
        if (button) button.disabled = !select.value;
      });
    });
    fitAllText();
  }

  function openBankSheet() {
    renderBankSheet();
    query("[data-bank-backdrop]").hidden = false;
    document.documentElement.classList.add("uj-modal-odprt");
    document.body.classList.add("uj-modal-odprt");
    loadFinapiBankStatus(false);
  }

  function requestBankConfirmation(transactionId) {
    var transaction = (state.bankTransactions || []).filter(function (entry) { return entry.id === transactionId; })[0];
    var select = query("[data-bank-invoice=\"" + transactionId + "\"]");
    var invoice = select && findInvoice(select.value);
    if (!transaction || !invoice) { showToast("Najprej izberite odprti račun."); return; }
    openDialog("Potrditi bančno plačilo?", formatMoney(transaction.amountCents) + " bo povezano z računom " + invoice.number + ". Bančni zapis in račun ostaneta sledljiva.", {
      confirmText: "Potrdi plačilo",
      onConfirm: async function () {
        try {
          if (!backend.ready) throw new Error("Varna bančna hramba ni povezana.");
          var result = await backend.client.rpc("pos_confirm_bank_transaction", {
            p_transaction_id: transaction.id, p_invoice_id: invoice.id, p_confirmed: true
          });
          if (result.error) throw result.error;
          await loadServerState(["payments", "bank"]);
          renderBankSheet();
          showToast("Bančno plačilo je potrjeno in povezano z računom.");
        } catch (error) { showToast(error && error.message || "Plačila ni bilo mogoče potrditi."); }
      }
    });
  }

  function importBankFile(file) {
    if (!file) return;
    var fileError = bankImportFileError(file);
    if (fileError) { showToast(fileError); return; }
    var reader = new FileReader();
    reader.onerror = function () { showToast("Bančnega izpiska ni bilo mogoče prebrati."); };
    reader.onload = async function () {
      try {
        if (!backend.ready || !backend.userId) throw new Error("Za bančni uvoz je potrebna varna prijavljena hramba.");
        if (!backend.bankReady) throw new Error("Bančni modul še ni aktiviran.");
        var text = String(reader.result || "");
        var parsed = parseBankStatement(text, file.name);
        if (!parsed.format) throw new Error("Datoteka ni prepoznana kot camt.053 ali CSV.");
        if (!parsed.transactions.length) throw new Error("V datoteki ni veljavnih EUR prilivov.");
        var fingerprint = await sha256Hex(text);
        var result = await backend.client.rpc("pos_import_bank_transactions", {
          p_file_name: file.name,
          p_file_sha256: fingerprint,
          p_file_format: parsed.format,
          p_transactions: parsed.transactions
        });
        if (result.error) throw result.error;
        await loadServerState("bank");
        openBankSheet();
        var summary = result.data || {};
        showToast("Uvoženo: " + integer(summary.inserted_count, 0) + "; podvojeno preskočeno: " + integer(summary.duplicate_count, 0) + ".");
      } catch (error) { showToast(error && error.message || "Bančnega izpiska ni bilo mogoče uvoziti."); }
    };
    reader.readAsText(file);
  }

  function currentMonthKey() {
    return isoToday().slice(0, 7);
  }

  function fillDatevForm(settings) {
    var value = normalizeDatevSettings(settings);
    queryAll("[name=datevFramework]").forEach(function (field) { field.checked = field.value === value.framework; });
    query("[name=datevAdviserNumber]").value = value.adviserNumber;
    query("[name=datevClientNumber]").value = value.clientNumber;
    query("[name=datevFiscalYearStart]").value = value.fiscalYearStart;
    query("[name=datevInitials]").value = value.initials;
    query("[name=datevReceivableAccount]").value = value.receivableAccount;
    query("[name=datevRevenue19Account]").value = value.revenue19Account;
    query("[name=datevRevenue7Account]").value = value.revenue7Account;
    query("[name=datevSmallBusinessAccount]").value = value.smallBusinessAccount;
    query("[name=datevReverseChargeAccount]").value = value.reverseChargeAccount;
    query("[name=datevConfirmed]").checked = value.confirmed;
  }

  function readDatevForm() {
    var checked = query("[name=datevFramework]:checked");
    return normalizeDatevSettings({
      framework: checked ? checked.value : "03",
      adviserNumber: query("[name=datevAdviserNumber]").value,
      clientNumber: query("[name=datevClientNumber]").value,
      fiscalYearStart: query("[name=datevFiscalYearStart]").value,
      initials: query("[name=datevInitials]").value,
      receivableAccount: query("[name=datevReceivableAccount]").value,
      revenue19Account: query("[name=datevRevenue19Account]").value,
      revenue7Account: query("[name=datevRevenue7Account]").value,
      smallBusinessAccount: query("[name=datevSmallBusinessAccount]").value,
      reverseChargeAccount: query("[name=datevReverseChargeAccount]").value,
      confirmed: query("[name=datevConfirmed]").checked
    });
  }

  function renderDatevSheet() {
    var settings = readDatevForm();
    var period = query("[name=datevPeriod]").value || currentMonthKey();
    var result = buildDatevExport(state.invoices, settings, period, new Date());
    query("[data-datev-skr]").textContent = "SKR" + settings.framework;
    query("[data-datev-settings-state]").textContent = result.errors.length ? "Nastavitve še niso potrjene" : "Pripravljeno · SKR" + settings.framework;
    var invoiceNumbers = {};
    result.bookings.forEach(function (booking) { invoiceNumbers[booking.documentNumber] = true; });
    query("[data-datev-summary]").innerHTML = [
      [Object.keys(invoiceNumbers).length, "Dokumenti"],
      [result.bookings.length, "Knjižbe"],
      [formatMoney(result.totalCents || 0), "Promet"]
    ].map(function (entry) { return "<div><strong>" + escapeHtml(entry[0]) + "</strong><small>" + escapeHtml(entry[1]) + "</small></div>"; }).join("");
    query("[data-datev-validation]").innerHTML = result.errors.map(function (message) { return "<p>" + escapeHtml(message) + "</p>"; }).concat(result.warnings.map(function (message) { return "<p class=\"is-warning\">" + escapeHtml(message) + "</p>"; })).join("");
    query("[data-datev-download]").disabled = Boolean(result.errors.length || !result.bookings.length);
    var cloudTransfer = query("[data-datev-transfer]");
    if (cloudTransfer) cloudTransfer.disabled = datevCloudCapability.loading || datevCloudCapability.working || !datevCloudCapability.connected || !backend.ready || Boolean(result.errors.length || !result.bookings.length);
    return result;
  }

  function openDatevSheet() {
    var periodField = query("[name=datevPeriod]");
    if (!periodField.value) periodField.value = currentMonthKey();
    fillDatevForm(state.profile.datevSettings);
    var result = renderDatevSheet();
    query("[data-datev-settings]").open = Boolean(result.errors.length);
    query("[data-datev-backdrop]").hidden = false;
    document.documentElement.classList.add("uj-modal-odprt");
    document.body.classList.add("uj-modal-odprt");
    renderDatevCloud();
    loadDatevCloudStatus(false);
  }

  function closeDatevSheet() {
    query("[data-datev-backdrop]").hidden = true;
    document.documentElement.classList.remove("uj-modal-odprt");
    document.body.classList.remove("uj-modal-odprt");
  }

  async function saveDatevSettings() {
    var saveButton = query("[data-datev-save]");
    var originalLabel = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.setAttribute("aria-busy", "true");
    saveButton.textContent = "Shranjujem …";
    state.profile.datevSettings = readDatevForm();
    persist();
    renderDatevSheet();
    showToast("DATEV nastavitve shranjujem …");
    try {
      if (backend.client) {
        if (!backend.userId) await getBackendUser();
        await saveProfileToServer();
      }
      showToast(backend.ready ? "DATEV nastavitve so varno shranjene." : "DATEV nastavitve so shranjene na tej napravi.");
    } catch (error) {
      backend.ready = false;
      backendMessage(databaseErrorMessage(error), "error");
      showToast("Nastavitve so lokalno shranjene; varna baza še ni nadgrajena.");
    } finally {
      saveButton.disabled = false;
      saveButton.removeAttribute("aria-busy");
      saveButton.textContent = originalLabel;
    }
  }

  function refundStripePayment(invoice) {
    var payment = latestRefundableStripePayment(invoice);
    if (!invoice || !invoice.isTest || !payment || !invoice.serverStored || !backend.ready) {
      showToast("Za ta račun ni povračljivega Stripe TEST plačila.");
      return;
    }
    var refundableCents = integer(payment.amountCents, 0) - integer(payment.refundedCents, 0);
    openDialog(
      "Povrniti Stripe TEST plačilo?",
      "Vnesite celotni ali delni znesek. Pravi denar se ne premakne; podpisani webhook bo posodobil plačilno sled.",
      {
        confirmText: "Povrni – TEST",
        input: {
          label: "Znesek povračila",
          value: (refundableCents / 100).toFixed(2).replace(".", ","),
          hint: "Največ " + formatMoney(refundableCents) + ". Uporabite lahko tudi delni znesek."
        },
        validate: function (value) {
          return validateRefundAmountInput(value, refundableCents).error;
        },
        onConfirm: async function (value) {
          var amountCents = validateRefundAmountInput(value, refundableCents).amountCents;
          var button = query("[data-stripe-refund]");
          button.disabled = true;
          query("span", button).textContent = "Povračilo se pripravlja …";
          try {
            await stripeCheckoutRequest("refund", {
              invoiceId: invoice.id,
              paymentId: payment.id,
              amountCents: amountCents,
              confirmed: true,
              requestId: randomUuid()
            });
            for (var attempt = 0; attempt < 7; attempt += 1) {
              await waitMs(650 + attempt * 300);
              await loadServerState("payments");
              var refreshed = findInvoice(invoice.id);
              var refreshedPayment = refreshed && (refreshed.payments || []).filter(function (entry) { return entry.id === payment.id; })[0];
              if (refreshedPayment && integer(refreshedPayment.refundedCents, 0) >= integer(payment.refundedCents, 0) + amountCents) break;
            }
            var updatedInvoice = findInvoice(invoice.id);
            if (updatedInvoice) renderInvoiceDetail(updatedInvoice.id);
            showToast("Stripe TEST povračilo je poslano; plačilno sled potrdi podpisani webhook.");
          } catch (error) {
            renderStripePayment(findInvoice(invoice.id) || invoice);
            showToast(error && error.message || "Stripe TEST povračila ni bilo mogoče izvesti.");
          }
        }
      }
    );
  }

  function exportDatev() {
    var result = renderDatevSheet();
    if (result.errors.length) { query("[data-datev-settings]").open = true; showToast("Najprej dokončajte DATEV nastavitve."); return; }
    if (!result.bookings.length) { showToast("V izbranem mesecu ni pravnih dokumentov za izvoz."); return; }
    downloadFile(result.filename, "\ufeff" + result.content, "text/csv;charset=utf-8");
    showToast("DATEV Buchungsstapel je prenesen za izbrani mesec.");
  }

  async function datevCloudRequest(action, values, method) {
    var token = await apiSessionToken();
    var requestMethod = method || "POST";
    var target = "/api/pos-datev";
    var options = { method: requestMethod, headers: { Authorization: "Bearer " + token } };
    if (requestMethod === "GET") target += "?action=" + encodeURIComponent(action);
    else {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(Object.assign({ action: action }, values || {}));
    }
    var response = await fetch(target, options);
    var result = null;
    try { result = await response.json(); } catch (_error) {}
    if (!response.ok || !result || !result.ok) throw new Error(result && result.napaka || "DATEV povezava trenutno ni na voljo.");
    return result;
  }

  function updateDatevCloudCapability(result) {
    var connection = result && result.datev || {};
    datevCloudCapability.loaded = true;
    datevCloudCapability.configured = Boolean(connection.configured);
    datevCloudCapability.connected = Boolean(connection.connected);
    datevCloudCapability.environment = String(connection.environment || "mock");
    datevCloudCapability.clientName = String(connection.clientName || "");
    if (Object.prototype.hasOwnProperty.call(result || {}, "latestTransfer")) datevCloudCapability.latestTransfer = result.latestTransfer;
    if (Object.prototype.hasOwnProperty.call(result || {}, "transfer")) datevCloudCapability.latestTransfer = result.transfer;
    datevCloudCapability.lastError = "";
  }

  function renderDatevCloud() {
    var box = query("[data-datev-cloud]");
    if (!box) return;
    var connectionButton = query("[data-datev-connect]");
    var transferButton = query("[data-datev-transfer]");
    var latest = datevCloudCapability.latestTransfer;
    var busy = datevCloudCapability.loading || datevCloudCapability.working;
    var exportResult = renderDatevSheet();
    var mockTest = datevCloudCapability.environment === "mock" && !exportResult.errors.length && !exportResult.bookings.length;
    box.classList.toggle("is-ready", datevCloudCapability.connected && !datevCloudCapability.lastError);
    box.classList.toggle("is-error", Boolean(datevCloudCapability.lastError));
    query("[data-datev-cloud-title]").textContent = datevCloudCapability.clientName || "DATEV Buchungsdatenservice";
    query("[data-datev-cloud-badge]").textContent = datevCloudCapability.lastError ? "NAPAKA" : datevCloudCapability.environment.toUpperCase();
    query("[data-datev-cloud-status]").textContent = datevCloudCapability.loading ? "Preverjam varno povezavo …"
      : datevCloudCapability.working ? "Varno izvajam DATEV opravilo …"
        : datevCloudCapability.lastError || (datevCloudCapability.connected ? "Povezano · pripravljeno za prenos" : datevCloudCapability.configured ? "Pripravljeno za povezavo" : "DATEV OAuth podatki še niso izdani");
    connectionButton.textContent = datevCloudCapability.connected ? "Prekini DATEV povezavo" : datevCloudCapability.environment === "mock" ? "Poveži mock okolje" : "Poveži DATEV sandbox";
    connectionButton.disabled = busy || !datevCloudCapability.configured || !backend.ready;
    transferButton.textContent = datevCloudCapability.working ? "Prenašam …" : mockTest ? "Preveri testni DATEV paket" : "Pošlji dokumente in knjižbe";
    transferButton.disabled = busy || !datevCloudCapability.connected || !backend.ready || Boolean(exportResult.errors.length || (!exportResult.bookings.length && !mockTest));
    query("[data-datev-cloud-latest]").textContent = latest
      ? (latest.status === "succeeded" ? "Uspešno: " : latest.status === "processing" ? "DATEV še obdeluje: " : latest.status === "failed" ? "Neuspešno: " : "Priprava: ") + latest.period + " · " + Number(latest.documentCount || 0) + " dokumentov · " + Number(latest.bookingCount || 0) + " knjižb"
      : datevCloudCapability.environment === "mock" ? "Mock uporabi samo račune TEST-* in ničesar ne pošlje v pravi DATEV." : "Prenos vključuje arhivirane PDF-je in povezane EXTF knjižbe.";
  }

  async function loadDatevCloudStatus(showFeedback) {
    if (datevCloudCapability.loading || !backend.ready) { renderDatevCloud(); return; }
    datevCloudCapability.loading = true;
    renderDatevCloud();
    try {
      updateDatevCloudCapability(await datevCloudRequest("status", null, "GET"));
      if (showFeedback) showToast(datevCloudCapability.connected ? "DATEV povezava je pripravljena." : "DATEV povezava še ni aktivna.");
    } catch (error) {
      datevCloudCapability.loaded = true;
      datevCloudCapability.lastError = error && error.message || "DATEV stanja ni mogoče preveriti.";
      if (showFeedback) showToast(datevCloudCapability.lastError);
    } finally {
      datevCloudCapability.loading = false;
      renderDatevCloud();
    }
  }

  async function connectDatevCloud() {
    if (datevCloudCapability.working) return;
    datevCloudCapability.working = true;
    renderDatevCloud();
    try {
      state.profile.datevSettings = readDatevForm();
      persist();
      await saveProfileToServer();
      var wasConnected = datevCloudCapability.connected;
      var result = await datevCloudRequest(wasConnected ? "disconnect" : "connect");
      if (result.authorizationUrl) {
        var authorizationUrl = new URL(result.authorizationUrl);
        if (authorizationUrl.protocol !== "https:" || authorizationUrl.hostname !== "login.datev.de") throw new Error("DATEV ni vrnil varne prijavne strani.");
        global.location.assign(authorizationUrl.toString());
        return;
      }
      updateDatevCloudCapability(result);
      showToast(wasConnected ? "DATEV povezava je varno prekinjena." : "DATEV mock okolje je povezano.");
    } catch (error) {
      datevCloudCapability.lastError = error && error.message || "DATEV povezave ni bilo mogoče vzpostaviti.";
      showToast(datevCloudCapability.lastError);
    } finally {
      datevCloudCapability.working = false;
      renderDatevCloud();
    }
  }

  async function transferDatevCloud() {
    if (datevCloudCapability.working) return;
    var result = renderDatevSheet();
    var mockTest = datevCloudCapability.environment === "mock" && !result.errors.length && !result.bookings.length;
    if (result.errors.length || (!result.bookings.length && !mockTest)) { showToast("Najprej preverite DATEV nastavitve in obračunski mesec."); return; }
    datevCloudCapability.working = true;
    datevCloudCapability.lastError = "";
    renderDatevCloud();
    try {
      var response = await datevCloudRequest(mockTest ? "test-transfer" : "transfer", { period: query("[name=datevPeriod]").value, requestId: randomUuid() });
      updateDatevCloudCapability(response);
      showToast(response.transfer && response.transfer.status === "succeeded" ? "DATEV mock prenos je uspešno preverjen." : "DATEV je sprejel prenos in ga obdeluje.");
      if (response.transfer && response.transfer.status === "processing") setTimeout(function () { loadDatevCloudStatus(false); }, Math.max(2, Number(response.transfer.retryAfterSeconds || 5)) * 1000);
    } catch (error) {
      datevCloudCapability.lastError = error && error.message || "DATEV prenosa ni bilo mogoče dokončati.";
      showToast(datevCloudCapability.lastError);
    } finally {
      datevCloudCapability.working = false;
      renderDatevCloud();
    }
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
    queryAll("[data-new-offer]").forEach(function (button) { button.addEventListener("click", startOffer); });
    query("[data-close-editor]").addEventListener("click", closeEditor);
    query("[data-save-draft]").addEventListener("click", async function () {
      syncDraftFromForm(); persist();
      if (state.draft && state.draft.workflowMode === "offer") { showToast("Osnutek ponudbe je shranjen na tej napravi. Številko dobi ob ustvarjanju."); return; }
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
    query("[name=consumerContractContext]").addEventListener("change", syncCustomerFields);
    queryAll("[name=taxMode]").forEach(function (radio) { radio.addEventListener("change", function () { state.draft.taxMode = radio.value; syncTaxFields(); renderItems(); }); });
    query("[name=constructionWithholding]").addEventListener("change", syncTaxFields);
    queryAll("[name=priceMode]").forEach(function (radio) { radio.addEventListener("change", function () { syncDraftFromForm(); renderItems(); }); });
    query("[name=finalConfirmed]").addEventListener("change", function () {
      syncDraftFromForm();
      renderPreview();
      persist();
    });
    query("#pos-invoice-form").addEventListener("input", function (event) { if (event.target.matches("[data-fit-input]")) fitInput(event.target); });
    query("#pos-profile-form").addEventListener("input", function (event) {
      if (event.target.matches("[data-fit-input]")) fitInput(event.target);
      if (profileChangeRequiresConfirmation(event.target.name)) query("[name=legalConfirmed]", event.currentTarget).checked = false;
    });
    query("#pos-profile-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      state.profile = readForm(event.currentTarget, state.profile);
      state.profile.iban = cleanIban(state.profile.iban);
      state.profile.vatId = cleanVatId(state.profile.vatId);
      var profileError = profileValidationError(state.profile);
      if (profileError) { showToast(profileError); return; }
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
      showToast(productionReady() ? "Produkcijski način je pripravljen." : readiness.live && backend.ready ? "Podatki so shranjeni; produkcija čaka potrjeno arhivsko kopijo." : readiness.live ? "Podatki so lokalno shranjeni; produkcija čaka varno bazo." : "Nastavitve so shranjene; Testbetrieb ostaja aktiven.");
      showView("home");
    });
    query("[data-fiskaly-refresh]").addEventListener("click", function () { loadFiskalyCapability(true); });
    query("[data-fiskaly-test]").addEventListener("click", openFiskalyReceiptSheet);
    query("#pos-fiskaly-receipt-form").addEventListener("submit", submitFiskalyTrainingReceipt);
    query("[data-fiskaly-add-item]").addEventListener("click", function () {
      if (fiskalyReceiptItems.length >= 5) return;
      fiskalyReceiptItems.push({ id: uid("fiskaly-item"), description: "Neue Testleistung", quantityMilli: 1000, unitGrossCents: 1190, vatRate: "19" });
      renderFiskalyCart();
    });
    query("[data-fiskaly-cart]").addEventListener("click", function (event) {
      var remove = event.target.closest("[data-fiskaly-remove]");
      if (!remove || fiskalyReceiptItems.length === 1) return;
      var removeId = remove.getAttribute("data-fiskaly-remove");
      fiskalyReceiptItems = fiskalyReceiptItems.filter(function (item) { return item.id !== removeId; });
      renderFiskalyCart();
    });
    function syncFiskalyCartInput(event) {
      var article = event.target.closest("[data-fiskaly-item]");
      if (!article) return;
      var item = fiskalyReceiptItems.filter(function (entry) { return entry.id === article.getAttribute("data-fiskaly-item"); })[0];
      if (!item) return;
      if (event.target.name === "fiskalyDescription") item.description = event.target.value.slice(0, 160);
      if (event.target.name === "fiskalyQuantity") item.quantityMilli = parseQuantityMilli(event.target.value);
      if (event.target.name === "fiskalyUnitPrice") item.unitGrossCents = Math.max(0, parseMoneyToCents(event.target.value));
      if (event.target.name === "fiskalyVatRate") item.vatRate = event.target.value;
      renderFiskalyCartSummary();
    }
    query("[data-fiskaly-cart]").addEventListener("input", syncFiskalyCartInput);
    query("[data-fiskaly-cart]").addEventListener("change", syncFiskalyCartInput);
    query("[data-fiskaly-receipt-close]").addEventListener("click", closeFiskalyReceiptSheet);
    query("[data-fiskaly-receipt-cancel]").addEventListener("click", closeFiskalyReceiptSheet);
    query("[data-fiskaly-receipt-done]").addEventListener("click", closeFiskalyReceiptSheet);
    query("[data-fiskaly-receipt-new]").addEventListener("click", resetFiskalyReceiptSheet);
    query("[data-fiskaly-receipt-backdrop]").addEventListener("click", function (event) { if (event.target === event.currentTarget) closeFiskalyReceiptSheet(); });
    query("[data-preview-print]").addEventListener("click", function () { global.print(); });
    query("[data-download-xml]").addEventListener("click", downloadXml);
    query("[data-copy-payment]").addEventListener("click", copyPayment);
    query("[data-open-payment]").addEventListener("click", requestLatestPayment);
    query("[data-import-bank]").addEventListener("click", openBankSheet);
    query("[data-finapi-bank-sync]").addEventListener("click", syncFinapiBank);
    query("[data-bank-file]").addEventListener("change", function (event) { importBankFile(event.target.files[0]); event.target.value = ""; });
    query("[data-bank-close]").addEventListener("click", closeBankSheet);
    query("[data-bank-cancel]").addEventListener("click", closeBankSheet);
    query("[data-bank-import-another]").addEventListener("click", function () { query("[data-bank-file]").click(); });
    query("[data-bank-backdrop]").addEventListener("click", function (event) { if (event.target === event.currentTarget) closeBankSheet(); });
    query("[data-datev-export]").addEventListener("click", openDatevSheet);
    query("[data-archive-verify]").addEventListener("click", function () { loadArchiveCapability(true, true); });
    query("[name=datevPeriod]").addEventListener("change", renderDatevSheet);
    query("#pos-datev-form").addEventListener("input", renderDatevSheet);
    queryAll("[name=datevFramework]").forEach(function (radio) {
      radio.addEventListener("change", function () {
        var previous = readDatevForm();
        var defaults = defaultDatevSettings(radio.value);
        defaults.adviserNumber = previous.adviserNumber;
        defaults.clientNumber = previous.clientNumber;
        defaults.fiscalYearStart = previous.fiscalYearStart;
        defaults.initials = previous.initials;
        fillDatevForm(defaults);
        renderDatevSheet();
      });
    });
    query("[data-datev-save]").addEventListener("click", saveDatevSettings);
    query("[data-datev-connect]").addEventListener("click", connectDatevCloud);
    query("[data-datev-transfer]").addEventListener("click", transferDatevCloud);
    query("[data-datev-download]").addEventListener("click", exportDatev);
    query("[data-datev-close]").addEventListener("click", closeDatevSheet);
    query("[data-datev-cancel]").addEventListener("click", closeDatevSheet);
    query("[data-datev-backdrop]").addEventListener("click", function (event) { if (event.target === event.currentTarget) closeDatevSheet(); });
    query("[data-show-all]").addEventListener("click", function () { showView("invoices"); });
    query("[data-invoice-search]").addEventListener("input", function (event) { invoiceOverviewQuery = event.target.value; renderInvoiceOverview(); });
    queryAll("[data-invoice-filter]").forEach(function (button) {
      button.addEventListener("click", function () { invoiceOverviewFilter = button.getAttribute("data-invoice-filter"); renderInvoiceOverview(); });
    });
    query("[data-detail-back]").addEventListener("click", function () { activeInvoiceId = null; showView(invoiceDetailReturnView); });
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
    query("[data-stripe-payment]").addEventListener("click", function () { var invoice = findInvoice(activeInvoiceId); if (invoice) startStripeCheckout(invoice); });
    query("[data-stripe-refund]").addEventListener("click", function () { var invoice = findInvoice(activeInvoiceId); if (invoice) refundStripePayment(invoice); });
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
    query("[data-dialog-input]").addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); closeDialog(true); } });
    query("[data-dialog-select]").addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); closeDialog(true); } });
    query("[data-dialog-backdrop]").addEventListener("click", function (event) { if (event.target === event.currentTarget) closeDialog(false); });
    global.addEventListener("resize", fitAllText);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAllText);
    if (global.ResizeObserver) {
      var observer = new ResizeObserver(function () { fitAllText(); });
      observer.observe(document.body);
    }
  }

  global.UJPoskusiNotranjiKorakNazaj = function () {
    if (!query("[data-fiskaly-receipt-backdrop]").hidden) { closeFiskalyReceiptSheet(); return true; }
    if (!query("[data-datev-backdrop]").hidden) { closeDatevSheet(); return true; }
    if (!query("[data-bank-backdrop]").hidden) { closeBankSheet(); return true; }
    if (!query("[data-delivery-backdrop]").hidden) { closeDeliverySheet(); return true; }
    if (!query("[data-adjustment-backdrop]").hidden) { closeAdjustmentSheet(); return true; }
    if (currentView === "invoice") { previousStep(); return true; }
    if (currentView === "settings") { showView("home"); return true; }
    if (currentView === "invoices") { showView("home"); return true; }
    if (currentView === "work-orders") { showView("home"); return true; }
    if (currentView === "invoice-detail") { activeInvoiceId = null; showView(invoiceDetailReturnView); return true; }
    return false;
  };

  function init() {
    bindEvents();
    renderFiskalyCapability();
    renderHome();
    showView("home");
    var returnParams = new URLSearchParams(global.location.search);
    var finapiReturn = returnParams.get("finapi");
    var datevReturn = returnParams.get("datev");
    var stripeReturn = returnParams.get("stripe");
    var stripeSessionId = returnParams.get("stripe_session_id");
    var stripeInvoiceId = returnParams.get("invoice_id");
    var initialLoad = loadServerState();
    if (finapiReturn) {
      var cleanReturnUrl = new URL(global.location.href);
      cleanReturnUrl.searchParams.delete("finapi");
      global.history.replaceState(null, "", cleanReturnUrl.pathname + cleanReturnUrl.search + cleanReturnUrl.hash);
      setTimeout(function () {
        openBankSheet();
        showToast(finapiReturn === "complete"
          ? "finAPI obrazec je zaključen. Preverite povezavo in osvežite prilive."
          : finapiReturn === "abort" ? "Povezovanje testne banke je bilo prekinjeno." : "finAPI obrazca ni bilo mogoče zaključiti.");
      }, 0);
    }
    if (datevReturn) {
      var cleanDatevUrl = new URL(global.location.href);
      cleanDatevUrl.searchParams.delete("datev");
      cleanDatevUrl.searchParams.delete("datev_code");
      global.history.replaceState(null, "", cleanDatevUrl.pathname + cleanDatevUrl.search + cleanDatevUrl.hash);
      initialLoad.then(function () {
        openDatevSheet();
        showToast(datevReturn === "connected" ? "DATEV sandbox je uspešno povezan." : "DATEV povezave ni bilo mogoče zaključiti.");
      });
    }
    if (stripeReturn && stripeInvoiceId && (stripeSessionId || stripeReturn === "cancelled")) {
      var cleanStripeUrl = new URL(global.location.href);
      ["stripe", "stripe_session_id", "invoice_id"].forEach(function (key) { cleanStripeUrl.searchParams.delete(key); });
      global.history.replaceState(null, "", cleanStripeUrl.pathname + cleanStripeUrl.search + cleanStripeUrl.hash);
      initialLoad.then(function () {
        return handleStripeReturn({ state: stripeReturn, sessionId: stripeSessionId, invoiceId: stripeInvoiceId });
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(typeof window !== "undefined" ? window : globalThis);

