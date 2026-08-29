(function (global) {
  "use strict";

  var VERSION = "DSFinV-K-2.4-TRAINING-MODEL-v3";
  var MOVEMENT_TYPES = ["SALE", "REFUND", "DEPOSIT", "WITHDRAWAL"];

  function text(value) { return String(value == null ? "" : value).trim(); }
  function integer(value) { var parsed = Number(value); return Number.isSafeInteger(parsed) ? parsed : 0; }
  function csv(value) {
    var output = String(value == null ? "" : value);
    return /[;"\r\n]/.test(output) ? '"' + output.replace(/"/g, '""') + '"' : output;
  }
  function rows(header, values) {
    return [header].concat(values).map(function (row) { return row.map(csv).join(";"); }).join("\r\n") + "\r\n";
  }
  function fail(code, message) { var error = new Error(message); error.code = code; throw error; }

  function normalizeMovement(input) {
    var value = input && typeof input === "object" ? input : {};
    var type = text(value.type).toUpperCase();
    var amountCents = integer(value.amountCents);
    if (MOVEMENT_TYPES.indexOf(type) === -1) fail("DSFINVK_MOVEMENT_INVALID", "Neveljavna vrsta gotovinskega dogodka.");
    if (amountCents <= 0) fail("DSFINVK_MOVEMENT_INVALID", "Gotovinski dogodek potrebuje pozitiven znesek.");
    if (["REFUND", "WITHDRAWAL"].indexOf(type) !== -1) amountCents = -amountCents;
    var occurredAt = new Date(value.occurredAt || Date.now());
    if (Number.isNaN(occurredAt.getTime())) fail("DSFINVK_MOVEMENT_INVALID", "Gotovinski dogodek nima veljavnega časa.");
    var reference = text(value.reference);
    if (!reference || reference.length > 120) fail("DSFINVK_MOVEMENT_INVALID", "Gotovinski dogodek potrebuje veljavno referenco.");
    return { type: type, amountCents: amountCents, occurredAt: occurredAt.toISOString(), reference: reference, reason: text(value.reason).slice(0, 240) };
  }

  function validCheckout(entry) {
    return entry && entry.state === "completed" && entry.signature && entry.receipt
      && text(entry.receipt.paymentType).toUpperCase() === "CASH"
      && integer(entry.receipt.grossCents) > 0
      && text(entry.signature.transactionId) && text(entry.signature.signatureCounter)
      && text(entry.signature.tssSerialNumber) && text(entry.signature.clientSerialNumber)
      && text(entry.signature.qrCodeData);
  }

  function validSignedRefund(entry) {
    var refund = entry && entry.refund;
    return refund && refund.state === "completed" && refund.signature && refund.receipt
      && text(refund.originalCheckoutId) === text(entry.id)
      && text(refund.signature.fiscalType).toUpperCase() === "REFUND"
      && integer(refund.receipt.grossCents) === integer(entry.receipt && entry.receipt.grossCents)
      && text(refund.signature.transactionId) && text(refund.signature.signatureCounter)
      && text(refund.signature.tssSerialNumber) && text(refund.signature.clientSerialNumber)
      && text(refund.signature.qrCodeData);
  }

  function buildPackage(checkouts, profile, options) {
    var settings = options || {};
    var candidates = Array.isArray(checkouts) ? checkouts : [];
    candidates.forEach(function (entry) {
      if (!entry || !entry.refund) return;
      if (entry.refund.state !== "completed") {
        fail("DSFINVK_REFUND_UNRESOLVED", "Povračilo ni zabeleženo – potrebna je ročna TSE uskladitev.");
      }
      if (!validCheckout(entry) || !validSignedRefund(entry)) {
        fail("DSFINVK_REFUND_INVALID", "DSFinV-K TEST izvoza ni bilo mogoče pripraviti.");
      }
    });
    var entries = candidates.filter(validCheckout);
    var movements = (Array.isArray(settings.movements) ? settings.movements : []).map(normalizeMovement);
    if (!entries.length && !movements.length) fail("DSFINVK_EMPTY", "Za DSFinV-K TEST izvoz ni gotovinskih dogodkov.");
    var seller = profile && typeof profile === "object" ? profile : {};
    var cashRegisterId = text(settings.cashRegisterId || "UJ-LOCAL-TRAINING-1");
    var createdAt = new Date(settings.createdAt || Date.now());
    if (Number.isNaN(createdAt.getTime())) fail("DSFINVK_DATE_INVALID", "Čas izvoza ni veljaven.");
    var transactionRows = [];
    var paymentRows = [];
    var lineRows = [];
    var vatRows = [];
    var tseRows = [];
    var cashBalance = 0;

    entries.forEach(function (entry, index) {
      var id = text(entry.id || entry.requestKey || entry.signature.transactionId);
      var receipt = entry.receipt;
      var finishedAt = text(entry.signature.finishedAt || entry.completedAt || createdAt.toISOString());
      transactionRows.push([cashRegisterId, id, index + 1, finishedAt, "Beleg", entry.invoiceNumber || entry.invoiceId || "TRAINING", integer(receipt.grossCents), "EUR"]);
      paymentRows.push([id, "Bar", integer(receipt.grossCents), "EUR"]);
      cashBalance += integer(receipt.grossCents);
      (receipt.items || []).forEach(function (item, itemIndex) {
        lineRows.push([id, itemIndex + 1, text(item.description), integer(item.grossCents), text(item.vatRate), "EUR"]);
      });
      (receipt.totalsByVat || []).forEach(function (vat) {
        vatRows.push([id, text(vat.vatRate), integer(vat.netCents), integer(vat.taxCents), integer(vat.grossCents), "EUR"]);
      });
      tseRows.push([id, entry.signature.transactionId, entry.signature.signatureCounter, entry.signature.tssSerialNumber, entry.signature.clientSerialNumber, entry.signature.signatureAlgorithm || "", entry.signature.startedAt || "", finishedAt, entry.signature.qrCodeData]);
      if (validSignedRefund(entry)) {
        var refund = entry.refund;
        var refundId = text(refund.id || refund.requestKey || refund.signature.transactionId);
        var refundFinishedAt = text(refund.signature.finishedAt || refund.completedAt || createdAt.toISOString());
        var negativeGross = -integer(refund.receipt.grossCents);
        transactionRows.push([cashRegisterId, refundId, transactionRows.length + 1, refundFinishedAt, "Storno", entry.invoiceNumber || entry.invoiceId || "TRAINING", negativeGross, "EUR"]);
        paymentRows.push([refundId, "Bar", negativeGross, "EUR"]);
        cashBalance += negativeGross;
        (refund.receipt.items || []).forEach(function (item, itemIndex) {
          lineRows.push([refundId, itemIndex + 1, text(item.description), -integer(item.grossCents), text(item.vatRate), "EUR"]);
        });
        (refund.receipt.totalsByVat || []).forEach(function (vat) {
          vatRows.push([refundId, text(vat.vatRate), -integer(vat.netCents), -integer(vat.taxCents), -integer(vat.grossCents), "EUR"]);
        });
        tseRows.push([refundId, refund.signature.transactionId, refund.signature.signatureCounter, refund.signature.tssSerialNumber, refund.signature.clientSerialNumber, refund.signature.signatureAlgorithm || "", refund.signature.startedAt || "", refundFinishedAt, refund.signature.qrCodeData]);
      }
    });

    movements.forEach(function (movement, index) {
      cashBalance += movement.amountCents;
      transactionRows.push([cashRegisterId, "movement-" + (index + 1), transactionRows.length + 1, movement.occurredAt, movement.type, movement.reference, movement.amountCents, "EUR"]);
      paymentRows.push(["movement-" + (index + 1), "Bar", movement.amountCents, "EUR"]);
      lineRows.push(["movement-" + (index + 1), 1, movement.reason || movement.type, movement.amountCents, "0", "EUR"]);
    });

    var files = {
      "cash_point_closing.csv": rows(["KASSE_ID", "ERSTELLUNG", "UNTERNEHMEN", "STEUERNUMMER", "WAEHRUNG", "BAR_ENDBESTAND"], [[cashRegisterId, createdAt.toISOString(), text(seller.legalName || "TRAINING"), text(seller.taxNumber || seller.vatId || "TEST"), "EUR", cashBalance]]),
      "transactions.csv": rows(["KASSE_ID", "BON_ID", "BON_NR", "BON_ZEIT", "BON_TYP", "BON_NAME", "BRUTTO_CENT", "WAEHRUNG"], transactionRows),
      "payment.csv": rows(["BON_ID", "ZAHLART", "BETRAG_CENT", "WAEHRUNG"], paymentRows),
      "lines.csv": rows(["BON_ID", "POS_ZEILE", "ARTIKELTEXT", "BRUTTO_CENT", "UST_SATZ", "WAEHRUNG"], lineRows),
      "transactions_vat.csv": rows(["BON_ID", "UST_SATZ", "NETTO_CENT", "UST_CENT", "BRUTTO_CENT", "WAEHRUNG"], vatRows),
      "tse.csv": rows(["BON_ID", "TSE_TRANSAKTION", "SIGNATURZAEHLER", "TSE_SERIENNUMMER", "CLIENT_SERIENNUMMER", "ALGORITHMUS", "START", "ENDE", "QR_DATEN"], tseRows)
    };
    var payload = {
      manifest: {
        version: VERSION,
        environment: "TRAINING",
        conformance: "local_model_requires_external_certification",
        createdAt: createdAt.toISOString(),
        cashRegisterId: cashRegisterId,
        transactionCount: transactionRows.length,
        cashBalanceCents: cashBalance,
        files: Object.keys(files)
      },
      files: files
    };
    return { filename: "DSFinV-K-TRAINING-" + createdAt.toISOString().slice(0, 10) + ".json", content: JSON.stringify(payload, null, 2), payload: payload };
  }

  var api = { VERSION: VERSION, MOVEMENT_TYPES: MOVEMENT_TYPES, normalizeMovement: normalizeMovement, buildPackage: buildPackage };
  global.UJPosDsfinvk = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
