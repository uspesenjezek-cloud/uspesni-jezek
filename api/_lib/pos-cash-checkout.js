"use strict";

const crypto = require("node:crypto");

const STATES = Object.freeze({
  PREPARED: "prepared",
  SIGNED: "signed",
  COMPLETED: "completed",
  RECOVERY_REQUIRED: "recovery_required",
  CANCELLED: "cancelled",
});

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function text(value) {
  return String(value == null ? "" : value).trim();
}

function uuid(value) {
  const normalized = text(value).toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : "";
}

function normalizeCashReceipt(input) {
  const receipt = input && typeof input === "object" ? input : {};
  const grossCents = Number(receipt.grossCents);
  if (text(receipt.paymentType).toUpperCase() !== "CASH") fail("CASH_PAYMENT_REQUIRED", "Gotovinski checkout zahteva način plačila CASH.");
  if (!Number.isSafeInteger(grossCents) || grossCents <= 0 || grossCents > 100000000000) {
    fail("CASH_AMOUNT_INVALID", "Znesek gotovinskega checkouta ni veljaven.");
  }
  if (!Array.isArray(receipt.items) || receipt.items.length < 1 || receipt.items.length > 100) {
    fail("CASH_ITEMS_INVALID", "Gotovinski checkout mora vsebovati od 1 do 100 postavk.");
  }
  const normalizedItems = receipt.items.map(function (item) {
    const description = text(item && item.description);
    const gross = Number(item && item.grossCents);
    const vatRate = text(item && item.vatRate);
    if (!description || description.length > 240) fail("CASH_ITEM_INVALID", "Postavka gotovinskega checkouta nima veljavnega opisa.");
    if (!Number.isSafeInteger(gross) || gross < 0) fail("CASH_ITEM_INVALID", "Postavka gotovinskega checkouta nima veljavnega zneska.");
    if (!["0", "7", "19"].includes(vatRate)) fail("CASH_ITEM_INVALID", "Postavka uporablja nedovoljeno nemško stopnjo DDV.");
    return { description, grossCents: gross, vatRate };
  });
  if (normalizedItems.reduce((sum, item) => sum + item.grossCents, 0) !== grossCents) {
    fail("CASH_TOTAL_MISMATCH", "Vsota postavk se ne ujema z gotovinskim zneskom.");
  }
  return {
    schemaVersion: 1,
    paymentType: "CASH",
    currency: "EUR",
    grossCents,
    items: normalizedItems,
  };
}

function validateSignature(signature, checkout, expectedFiscalType) {
  const value = signature && typeof signature === "object" ? signature : {};
  const fiscalType = text(expectedFiscalType || "SALE").toUpperCase();
  if (text(value.state).toUpperCase() !== "FINISHED") fail("TSE_SIGNATURE_INCOMPLETE", "TSE podpis ni zaključen.");
  if (uuid(value.transactionId) !== checkout.transactionId) fail("TSE_SIGNATURE_MISMATCH", "TSE podpis ne pripada temu checkoutu.");
  ["signatureCounter", "signatureAlgorithm", "tssSerialNumber", "clientSerialNumber", "qrCodeData"].forEach(function (name) {
    if (!text(value[name])) fail("TSE_SIGNATURE_INCOMPLETE", "TSE podpis nima vseh obveznih dokazil.");
  });
  const limits = { signatureCounter: 120, signatureAlgorithm: 120, tssSerialNumber: 512, clientSerialNumber: 512, qrCodeData: 8192 };
  Object.keys(limits).forEach(function (name) {
    if (text(value[name]).length > limits[name]) fail("TSE_SIGNATURE_INVALID", "TSE podpis vsebuje predolgo dokazilo.");
  });
  const startedAt = new Date(text(value.startedAt));
  const finishedAt = new Date(text(value.finishedAt));
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(finishedAt.getTime()) || finishedAt < startedAt) {
    fail("TSE_SIGNATURE_INCOMPLETE", "TSE podpis nima veljavnega časovnega intervala.");
  }
  if (text(value.paymentType).toUpperCase() !== "CASH" || text(value.currency).toUpperCase() !== "EUR") {
    fail("TSE_SIGNATURE_MISMATCH", "TSE podpis nima pričakovanega gotovinskega plačila v EUR.");
  }
  const signedCents = Math.round(Number(value.amount) * 100);
  if (!Number.isSafeInteger(signedCents) || signedCents !== checkout.receipt.grossCents) {
    fail("TSE_SIGNATURE_MISMATCH", "Znesek TSE podpisa se ne ujema s checkoutom.");
  }
  if (text(value.fiscalType).toUpperCase() !== fiscalType) fail("TSE_SIGNATURE_MISMATCH", "TSE podpis nima pričakovane vrste gotovinskega dogodka.");
  return Object.freeze({
    transactionId: checkout.transactionId,
    fiscalType,
    signatureCounter: text(value.signatureCounter),
    signatureAlgorithm: text(value.signatureAlgorithm),
    tssSerialNumber: text(value.tssSerialNumber),
    clientSerialNumber: text(value.clientSerialNumber),
    qrCodeData: text(value.qrCodeData),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  });
}

async function reconcileProviderRecord(record, store, tse, fiscalType, lookupInput) {
  if (!tse || typeof tse.lookup !== "function" || !store || typeof store.reconcile !== "function") {
    fail("CASH_RECOVERY_UNAVAILABLE", "Gotovinski zapis čaka na avtoritativno TSE uskladitev.");
  }
  let provider;
  try {
    provider = await tse.lookup(Object.assign({
      transactionId: record.transactionId,
      receipt: record.receipt,
      fiscalType,
    }, lookupInput || {}));
  } catch (cause) {
    const error = new Error("TSE stanja trenutno ni mogoče avtoritativno preveriti.");
    error.code = "CASH_RECOVERY_REQUIRED";
    error.record = record;
    error.cause = cause;
    throw error;
  }
  const providerState = text(provider && provider.state).toUpperCase();
  if (uuid(provider && provider.transactionId) !== record.transactionId
      || !["ACTIVE", "FINISHED", "CANCELLED", "NOT_FOUND"].includes(providerState)) {
    fail("CASH_PROVIDER_STATE_INVALID", "TSE je vrnil drugo ali nepodprto stanje transakcije.");
  }
  const observation = {
    providerState,
    observedAt: text(provider.observedAt) || new Date().toISOString(),
    signature: null,
  };
  if (providerState === "FINISHED") observation.signature = validateSignature(provider, record, fiscalType);
  const reconciled = await store.reconcile(record.id, observation);
  if (!reconciled || reconciled.id !== record.id || reconciled.transactionId !== record.transactionId) {
    fail("CASH_STATE_INVALID", "Shranjena TSE uskladitev se ne ujema z gotovinskim zapisom.");
  }
  if (providerState === "FINISHED" && reconciled.state !== STATES.SIGNED && reconciled.state !== STATES.COMPLETED) {
    fail("CASH_STATE_INVALID", "FINISHED TSE uskladitev ni varno shranila podpisa.");
  }
  if (providerState === "NOT_FOUND" && reconciled.state === STATES.PREPARED) {
    const error = new Error("TSE transakcija še ni varno ograjena; nadaljujte isti pripravljeni poskus z istim transaction ID.");
    error.code = "CASH_RETRY_REQUIRED";
    error.record = reconciled;
    throw error;
  }
  if (providerState === "CANCELLED" && reconciled.state !== STATES.CANCELLED) {
    fail("CASH_STATE_INVALID", "Avtoritativni preklic TSE transakcije ni bil varno shranjen.");
  }
  if (providerState === "NOT_FOUND" && reconciled.state !== STATES.CANCELLED) {
    fail("CASH_STATE_INVALID", "Avtoritativni manjkajoči TSE zapis ni bil varno usklajen.");
  }
  if (providerState === "ACTIVE") {
    const error = new Error("TSE transakcija je še aktivna in zahteva nadaljnjo uskladitev.");
    error.code = "CASH_RECOVERY_REQUIRED";
    error.record = reconciled;
    throw error;
  }
  return reconciled;
}

function createService(dependencies) {
  const store = dependencies && dependencies.store;
  const tse = dependencies && dependencies.tse;
  if (!store || !tse) fail("CASH_DEPENDENCY_MISSING", "Gotovinski checkout nima vseh lokalnih adapterjev.");
  if (!["mock", "training"].includes(text(tse.environment).toLowerCase())) {
    fail("CASH_PRODUCTION_LOCKED", "Produkcijski gotovinski checkout ostaja zaklenjen.");
  }

  return async function checkout(input) {
    const request = input && typeof input === "object" ? input : {};
    if (request.confirmed !== true) fail("CASH_CONFIRMATION_REQUIRED", "Izrecna potrditev gotovinskega plačila je obvezna.");
    const requestKey = uuid(request.requestKey);
    const invoiceId = uuid(request.invoiceId);
    if (!requestKey || !invoiceId) fail("CASH_REQUEST_INVALID", "Gotovinski checkout nima veljavnega računa ali ključa ponovitve.");
    const receipt = normalizeCashReceipt(request.receipt);
    const transactionId = uuid(request.transactionId) || requestKey;
    let record = await store.prepare({ requestKey, invoiceId, transactionId, receipt });
    if (!record || record.requestKey !== requestKey || record.invoiceId !== invoiceId
      || record.transactionId !== transactionId || JSON.stringify(record.receipt) !== JSON.stringify(receipt)) {
      fail("CASH_STATE_INVALID", "Shranjeno stanje checkouta se ne ujema z zahtevo.");
    }
    if (record.state === STATES.COMPLETED) return record;
    if (record.state === STATES.CANCELLED) return record;
    if (record.state === STATES.RECOVERY_REQUIRED || request.reconcileOnly === true) {
      record = await reconcileProviderRecord(record, store, tse, "SALE");
      if (record.state === STATES.COMPLETED || record.state === STATES.CANCELLED) return record;
    }

    if (record.state === STATES.PREPARED) {
      try {
        const signature = validateSignature(await tse.sign({ transactionId, receipt, fiscalType: "SALE" }), record, "SALE");
        record = await store.markSigned(record.id, signature);
      } catch (error) {
        try { record = await store.markRecoveryRequired(record.id, text(error && error.code) || "TSE_RESULT_UNCERTAIN"); }
        catch (_) {}
        const wrapped = new Error("Gotovinsko plačilo ni zabeleženo, dokler TSE stanje ni varno usklajeno.");
        wrapped.code = "CASH_RECOVERY_REQUIRED";
        wrapped.record = record;
        wrapped.cause = error;
        throw wrapped;
      }
    }
    if (!record || record.state !== STATES.SIGNED || !record.signature) fail("CASH_STATE_INVALID", "Checkout brez popolnega TSE podpisa ne sme ustvariti plačila.");
    return store.complete(record.id);
  };
}

function createRefundService(dependencies) {
  const store = dependencies && dependencies.store;
  const tse = dependencies && dependencies.tse;
  const lookupCheckout = dependencies && dependencies.lookupCheckout;
  if (!store || !tse || typeof lookupCheckout !== "function") fail("CASH_DEPENDENCY_MISSING", "Gotovinsko povračilo nima vseh lokalnih adapterjev.");
  if (!["mock", "training"].includes(text(tse.environment).toLowerCase())) fail("CASH_PRODUCTION_LOCKED", "Produkcijsko gotovinsko povračilo ostaja zaklenjeno.");

  return async function refund(input) {
    const request = input && typeof input === "object" ? input : {};
    if (request.confirmed !== true) fail("CASH_CONFIRMATION_REQUIRED", "Izrecna potrditev gotovinskega povračila je obvezna.");
    const requestKey = uuid(request.requestKey);
    const invoiceId = uuid(request.invoiceId);
    const originalCheckoutId = text(request.originalCheckoutId);
    if (!requestKey || !invoiceId || !originalCheckoutId || originalCheckoutId.length > 120) fail("CASH_REQUEST_INVALID", "Gotovinsko povračilo nima veljavnega računa, checkouta ali ključa ponovitve.");
    const receipt = normalizeCashReceipt(request.receipt);
    const original = await lookupCheckout(originalCheckoutId);
    if (!original || original.state !== STATES.COMPLETED || original.invoiceId !== invoiceId || JSON.stringify(original.receipt) !== JSON.stringify(receipt)) {
      fail("CASH_ORIGINAL_CHECKOUT_INVALID", "Gotovinsko povračilo ne pripada zaključenemu izvirnemu checkoutu.");
    }
    const transactionId = uuid(request.transactionId) || requestKey;
    let record = await store.prepare({ requestKey, invoiceId, originalCheckoutId, transactionId, receipt });
    if (!record || record.requestKey !== requestKey || record.invoiceId !== invoiceId || record.originalCheckoutId !== originalCheckoutId
      || record.transactionId !== transactionId || JSON.stringify(record.receipt) !== JSON.stringify(receipt)) {
      fail("CASH_STATE_INVALID", "Shranjeno stanje povračila se ne ujema z zahtevo.");
    }
    if (record.state === STATES.COMPLETED) return record;
    if (record.state === STATES.CANCELLED) return record;
    if (record.state === STATES.RECOVERY_REQUIRED || request.reconcileOnly === true) {
      record = await reconcileProviderRecord(record, store, tse, "REFUND", { originalCheckoutId });
      if (record.state === STATES.COMPLETED || record.state === STATES.CANCELLED) return record;
    }
    if (record.state === STATES.PREPARED) {
      try {
        const signature = validateSignature(await tse.sign({ transactionId, receipt, fiscalType: "REFUND", originalCheckoutId }), record, "REFUND");
        record = await store.markSigned(record.id, signature);
      } catch (error) {
        try { record = await store.markRecoveryRequired(record.id, text(error && error.code) || "TSE_RESULT_UNCERTAIN"); } catch (_) {}
        const wrapped = new Error("Gotovinsko povračilo ni zabeleženo, dokler TSE stanje ni varno usklajeno.");
        wrapped.code = "CASH_RECOVERY_REQUIRED";
        wrapped.record = record;
        wrapped.cause = error;
        throw wrapped;
      }
    }
    if (!record || record.state !== STATES.SIGNED || !record.signature) fail("CASH_STATE_INVALID", "Povračilo brez popolnega TSE podpisa ne sme biti zaključeno.");
    return store.complete(record.id);
  };
}

function mockTseAdapter(options) {
  const settings = options || {};
  const transactions = new Map();
  return {
    environment: "mock",
    async sign(input) {
      if (settings.fail) fail("MOCK_TSE_FAILED", "Mock TSE podpis ni uspel.");
      const digest = crypto.createHash("sha256").update(JSON.stringify({ transactionId: input.transactionId, fiscalType: input.fiscalType || "SALE", receipt: input.receipt })).digest("hex");
      const result = {
        state: "FINISHED",
        transactionId: input.transactionId,
        fiscalType: text(input.fiscalType || "SALE").toUpperCase(),
        signatureCounter: text(settings.signatureCounter || String(parseInt(digest.slice(0, 8), 16))),
        signatureAlgorithm: "ecdsa-plain-SHA256",
        tssSerialNumber: "mock-tss",
        clientSerialNumber: "mock-client",
        qrCodeData: "V0;MOCK;" + digest.slice(0, 24),
        paymentType: "CASH",
        currency: "EUR",
        amount: (input.receipt.grossCents / 100).toFixed(2),
        startedAt: "2026-08-26T00:00:00.000Z",
        finishedAt: "2026-08-26T00:00:01.000Z",
      };
      transactions.set(input.transactionId, result);
      if (settings.failAfterCommit) fail("MOCK_TSE_RESULT_LOST", "Mock TSE odgovor je bil izgubljen po podpisu.");
      return result;
    },
    async lookup(input) {
      if (settings.lookupError) fail("MOCK_TSE_LOOKUP_FAILED", "Mock TSE lookup ni dosegljiv.");
      if (transactions.has(input.transactionId)) {
        return Object.assign({ observedAt: "2026-08-26T00:00:02.000Z" }, transactions.get(input.transactionId));
      }
      const state = text(settings.lookupState || "NOT_FOUND").toUpperCase();
      return {
        state,
        transactionId: input.transactionId,
        observedAt: "2026-08-26T00:00:02.000Z",
        paymentType: "CASH",
        currency: "EUR",
        amount: (input.receipt.grossCents / 100).toFixed(2),
        fiscalType: text(input.fiscalType || "SALE").toUpperCase(),
      };
    },
  };
}

module.exports = { STATES, createService, createRefundService, mockTseAdapter, normalizeCashReceipt, reconcileProviderRecord, validateSignature };
