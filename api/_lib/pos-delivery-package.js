"use strict";

const crypto = require("node:crypto");
const supabase = require("./supabase-server");
const providerJson = require("./provider-json");

const PDF_BUCKET = "pos-invoice-originals";
const XML_BUCKET = "pos-einvoice-originals";
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_XML_BYTES = 2 * 1024 * 1024;

class DeliveryPackageError extends Error {
  constructor(message, options) {
    super(message);
    this.name = "DeliveryPackageError";
    this.code = options && options.code || "DELIVERY_PACKAGE_ERROR";
    this.retryable = Boolean(options && options.retryable);
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function encodedPath(value) {
  return String(value || "").split("/").map(encodeURIComponent).join("/");
}

function safeFilename(value) {
  const cleaned = String(value || "Rechnung")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || "Rechnung";
}

function verifyAttachment(attachment) {
  if (!attachment || !Buffer.isBuffer(attachment.content)) {
    throw new DeliveryPackageError("Dostavna priloga nima veljavne vsebine.", {
      code: "DELIVERY_ATTACHMENT_INVALID",
      retryable: false,
    });
  }
  if (attachment.content.length !== Number(attachment.byteSize)) {
    throw new DeliveryPackageError("Velikost arhivirane priloge se ne ujema z evidenco.", {
      code: "DELIVERY_ATTACHMENT_SIZE_MISMATCH",
      retryable: false,
    });
  }
  if (sha256(attachment.content) !== attachment.sha256) {
    throw new DeliveryPackageError("Arhivirana priloga ni prestala preverjanja celovitosti.", {
      code: "DELIVERY_ATTACHMENT_HASH_MISMATCH",
      retryable: false,
    });
  }
  return attachment;
}

function manifestSha256(attachments) {
  const manifest = (attachments || []).map((attachment) => [
    attachment.kind,
    attachment.mediaType,
    attachment.sha256,
    String(attachment.byteSize),
  ].join(":"));
  return sha256(manifest.join("\n"));
}

async function readSingle(cfg, table, query, missingMessage) {
  const rows = await supabase.pridobiVrstice(cfg, table, query);
  if (rows.length !== 1) {
    throw new DeliveryPackageError(missingMessage, {
      code: "DELIVERY_ARCHIVE_METADATA_MISSING",
      retryable: false,
    });
  }
  return rows[0];
}

async function downloadObject(cfg, bucket, storagePath, mediaType, maxBytes) {
  const response = await supabase.fetchZOmejitvijo(
    cfg.url + "/storage/v1/object/" + bucket + "/" + encodedPath(storagePath),
    { headers: supabase.serviceHeaders(cfg, { Accept: mediaType }) },
    15000
  );
  if (response.status === 404 || response.status === 400) {
    throw new DeliveryPackageError("Arhivirana priloga ne obstaja več.", {
      code: "DELIVERY_ARCHIVE_OBJECT_MISSING",
      retryable: false,
    });
  }
  if (!response.ok) {
    throw new DeliveryPackageError("Arhivirane priloge trenutno ni mogoče prebrati.", {
      code: "DELIVERY_ARCHIVE_TEMPORARILY_UNAVAILABLE",
      retryable: response.status === 429 || response.status >= 500,
    });
  }
  try {
    return await providerJson.readBuffer(response, {
      maxBytes,
      code: "DELIVERY_ATTACHMENT_TOO_LARGE",
      message: "Arhivirana dostavna priloga presega dovoljeno velikost.",
    });
  } catch (error) {
    if (error && error.code === "DELIVERY_ATTACHMENT_TOO_LARGE") {
      throw new DeliveryPackageError(error.message, { code: error.code, retryable: false });
    }
    throw error;
  }
}

function assertOwnedPath(delivery, storagePath) {
  const expectedPrefix = delivery.adjustment_id
    ? delivery.user_id + "/adjustments/" + delivery.adjustment_id + "/"
    : delivery.user_id + "/" + delivery.invoice_id + "/";
  if (!String(storagePath || "").startsWith(expectedPrefix)) {
    throw new DeliveryPackageError("Pot arhiviranega dokumenta ni vezana na ta račun.", {
      code: "DELIVERY_ARCHIVE_PATH_INVALID",
      retryable: false,
    });
  }
}

async function pdfAttachment(cfg, delivery, baseName) {
  const adjustment = Boolean(delivery.adjustment_id);
  const metadata = await readSingle(
    cfg,
    adjustment ? "pos_adjustment_documents" : "pos_invoice_documents",
    "user_id=eq." + encodeURIComponent(delivery.user_id) +
      "&" + (adjustment ? "adjustment_id" : "invoice_id") + "=eq." +
        encodeURIComponent(adjustment ? delivery.adjustment_id : delivery.invoice_id) +
      "&document_kind=eq." + (adjustment ? "adjustment_pdf" : "invoice_pdf") +
      "&select=storage_path,sha256,byte_size,media_type",
    adjustment ? "Arhivirani PDF popravek manjka." : "Arhivirani PDF original manjka."
  );
  assertOwnedPath(delivery, metadata.storage_path);
  const content = await downloadObject(cfg, PDF_BUCKET, metadata.storage_path, "application/pdf", MAX_PDF_BYTES);
  return verifyAttachment({
    kind: adjustment ? "adjustment_pdf" : "invoice_pdf",
    filename: baseName + ".pdf",
    mediaType: metadata.media_type,
    sha256: metadata.sha256,
    byteSize: Number(metadata.byte_size),
    content,
  });
}

async function xmlAttachment(cfg, delivery, baseName) {
  const adjustment = Boolean(delivery.adjustment_id);
  const metadata = await readSingle(
    cfg,
    adjustment ? "pos_adjustment_einvoice_documents" : "pos_einvoice_documents",
    "user_id=eq." + encodeURIComponent(delivery.user_id) +
      "&" + (adjustment ? "adjustment_id" : "invoice_id") + "=eq." +
        encodeURIComponent(adjustment ? delivery.adjustment_id : delivery.invoice_id) +
      "&document_kind=eq." + (adjustment ? "adjustment_xrechnung_ubl" : "xrechnung_ubl") +
      "&select=storage_path,sha256,byte_size,media_type,validation_status",
    adjustment ? "Arhivirani strukturirani popravek manjka." : "Arhivirani XRechnung original manjka."
  );
  if (metadata.validation_status !== "validated") {
    throw new DeliveryPackageError("XRechnung pred dostavo ni KoSIT potrjen.", {
      code: "DELIVERY_XRECHNUNG_NOT_VALIDATED",
      retryable: false,
    });
  }
  assertOwnedPath(delivery, metadata.storage_path);
  const content = await downloadObject(cfg, XML_BUCKET, metadata.storage_path, "application/xml", MAX_XML_BYTES);
  return verifyAttachment({
    kind: adjustment ? "adjustment_xrechnung_ubl" : "xrechnung_ubl",
    filename: baseName + "-XRechnung.xml",
    mediaType: metadata.media_type,
    sha256: metadata.sha256,
    byteSize: Number(metadata.byte_size),
    content,
  });
}

async function buildDeliveryPackage(cfg, delivery) {
  if (!delivery || !delivery.id || !delivery.user_id || !delivery.invoice_id || typeof delivery.is_test !== "boolean") {
    throw new DeliveryPackageError("Dostava nima veljavnih podatkov za paket.", {
      code: "DELIVERY_PACKAGE_INVALID",
      retryable: false,
    });
  }
  const invoice = await readSingle(
    cfg,
    "pos_invoices",
    "id=eq." + encodeURIComponent(delivery.invoice_id) +
      "&user_id=eq." + encodeURIComponent(delivery.user_id) +
      "&select=id,invoice_number,customer_type,customer_name,issue_date,service_date,due_date,tax_mode,net_cents,tax_cents,gross_cents,is_test,snapshot",
    "Račun za dostavo ne obstaja."
  );
  let documentNumber = invoice.invoice_number;
  let adjustment = null;
  if (delivery.adjustment_id) {
    adjustment = await readSingle(
      cfg,
      "pos_invoice_adjustments",
      "id=eq." + encodeURIComponent(delivery.adjustment_id) +
        "&original_invoice_id=eq." + encodeURIComponent(delivery.invoice_id) +
        "&user_id=eq." + encodeURIComponent(delivery.user_id) +
        "&adjustment_type=in.(correction,cancellation,credit_note)&select=id,adjustment_number,adjustment_type,is_test,reason,issued_at,delta_net_cents,delta_tax_cents,delta_gross_cents,snapshot",
      "Popravek za dostavo ne obstaja."
    );
    documentNumber = adjustment.adjustment_number;
  }
  const baseName = safeFilename(documentNumber || "Rechnung");
  const attachments = [];
  if (delivery.document_format === "pdf" || delivery.document_format === "xrechnung_pdf") {
    attachments.push(await pdfAttachment(cfg, delivery, baseName));
  }
  if (delivery.document_format === "xrechnung" || delivery.document_format === "xrechnung_pdf") {
    attachments.push(await xmlAttachment(cfg, delivery, baseName));
  }
  if (!attachments.length) {
    throw new DeliveryPackageError("Izbrani format nima dostavne priloge.", {
      code: "DELIVERY_FORMAT_UNSUPPORTED",
      retryable: false,
    });
  }
  return {
    delivery,
    invoice,
    adjustment,
    invoiceNumber: documentNumber,
    recipient: delivery.recipient,
    routingReference: delivery.routing_reference,
    subject: delivery.subject,
    message: delivery.message,
    attachments,
    manifestSha256: manifestSha256(attachments),
  };
}

module.exports = {
  DeliveryPackageError,
  buildDeliveryPackage,
  encodedPath,
  manifestSha256,
  safeFilename,
  sha256,
  verifyAttachment,
  _test: { downloadObject, MAX_PDF_BYTES, MAX_XML_BYTES },
};
