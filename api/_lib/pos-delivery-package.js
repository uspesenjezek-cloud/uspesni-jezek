"use strict";

const crypto = require("node:crypto");
const supabase = require("./supabase-server");

const PDF_BUCKET = "pos-invoice-originals";
const XML_BUCKET = "pos-einvoice-originals";

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

async function downloadObject(cfg, bucket, storagePath, mediaType) {
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
  return Buffer.from(await response.arrayBuffer());
}

function assertOwnedPath(delivery, storagePath) {
  const expectedPrefix = delivery.user_id + "/" + delivery.invoice_id + "/";
  if (!String(storagePath || "").startsWith(expectedPrefix)) {
    throw new DeliveryPackageError("Pot arhiviranega dokumenta ni vezana na ta račun.", {
      code: "DELIVERY_ARCHIVE_PATH_INVALID",
      retryable: false,
    });
  }
}

async function pdfAttachment(cfg, delivery, baseName) {
  const metadata = await readSingle(
    cfg,
    "pos_invoice_documents",
    "user_id=eq." + encodeURIComponent(delivery.user_id) +
      "&invoice_id=eq." + encodeURIComponent(delivery.invoice_id) +
      "&document_kind=eq.invoice_pdf&select=storage_path,sha256,byte_size,media_type",
    "Arhivirani PDF original manjka."
  );
  assertOwnedPath(delivery, metadata.storage_path);
  const content = await downloadObject(cfg, PDF_BUCKET, metadata.storage_path, "application/pdf");
  return verifyAttachment({
    kind: "invoice_pdf",
    filename: baseName + ".pdf",
    mediaType: metadata.media_type,
    sha256: metadata.sha256,
    byteSize: Number(metadata.byte_size),
    content,
  });
}

async function xmlAttachment(cfg, delivery, baseName) {
  const metadata = await readSingle(
    cfg,
    "pos_einvoice_documents",
    "user_id=eq." + encodeURIComponent(delivery.user_id) +
      "&invoice_id=eq." + encodeURIComponent(delivery.invoice_id) +
      "&document_kind=eq.xrechnung_ubl&select=storage_path,sha256,byte_size,media_type,validation_status",
    "Arhivirani XRechnung original manjka."
  );
  if (metadata.validation_status !== "validated") {
    throw new DeliveryPackageError("XRechnung pred dostavo ni KoSIT potrjen.", {
      code: "DELIVERY_XRECHNUNG_NOT_VALIDATED",
      retryable: false,
    });
  }
  assertOwnedPath(delivery, metadata.storage_path);
  const content = await downloadObject(cfg, XML_BUCKET, metadata.storage_path, "application/xml");
  return verifyAttachment({
    kind: "xrechnung_ubl",
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
      "&select=id,invoice_number",
    "Račun za dostavo ne obstaja."
  );
  const baseName = safeFilename(invoice.invoice_number || "Rechnung");
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
    invoiceNumber: invoice.invoice_number,
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
};
