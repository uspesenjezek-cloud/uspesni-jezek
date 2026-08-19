"use strict";

const crypto = require("node:crypto");

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAX_RAW_ATTACHMENT_BYTES = 28 * 1024 * 1024;

class DeliveryProviderError extends Error {
  constructor(message, options) {
    super(message);
    this.name = "DeliveryProviderError";
    this.code = options && options.code || "DELIVERY_PROVIDER_ERROR";
    this.retryable = Boolean(options && options.retryable);
  }
}

function deliveryReadiness(env) {
  const source = env || process.env;
  const configured = Boolean(String(source.RESEND_API_KEY || "").trim() && String(source.POS_EMAIL_FROM || "").trim());
  const requested = String(source.POS_EMAIL_DELIVERY_ENABLED || "").trim().toLowerCase() === "true";
  return {
    provider: "resend",
    configured,
    liveEnabled: configured && requested,
    webhookConfigured: Boolean(String(source.RESEND_WEBHOOK_SECRET || "").trim()),
    mode: configured && requested ? "production" : "sandbox",
  };
}

function sandboxReference(deliveryPackage) {
  const delivery = deliveryPackage.delivery;
  const source = [delivery.id, delivery.invoice_id, delivery.attempt_count, deliveryPackage.manifestSha256].join(":");
  return "sandbox-" + crypto.createHash("sha256").update(source).digest("hex").slice(0, 24);
}

function sandboxProvider() {
  return {
    name: "sandbox",
    async deliver(deliveryPackage) {
      const delivery = deliveryPackage && deliveryPackage.delivery;
      if (!delivery || !delivery.id || !delivery.invoice_id || !Array.isArray(deliveryPackage.attachments)) {
        throw new DeliveryProviderError("Sandboxu manjkajo podatki dostave.", { code: "SANDBOX_PAYLOAD_INVALID", retryable: false });
      }
      if (!delivery.is_test) {
        throw new DeliveryProviderError("Sandbox ne sme obdelati prave dostave.", { code: "SANDBOX_LIVE_DELIVERY_BLOCKED", retryable: false });
      }
      if (!deliveryPackage.attachments.length || deliveryPackage.attachments.some((attachment) => !Buffer.isBuffer(attachment.content))) {
        throw new DeliveryProviderError("Sandbox ni prejel preverjenih arhiviranih prilog.", { code: "SANDBOX_ATTACHMENTS_MISSING", retryable: false });
      }
      return {
        provider: "sandbox",
        providerReference: sandboxReference(deliveryPackage),
        status: "test_completed",
        sent: false,
        delivered: false,
      };
    },
  };
}

function validEmail(value) {
  const text = String(value || "").trim();
  return text.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) && !/[\r\n]/.test(text);
}

function resendIdempotencyKey(deliveryPackage) {
  return ["invoice-delivery", deliveryPackage.delivery.id, deliveryPackage.manifestSha256.slice(0, 32)].join("/");
}

function resendProvider(options) {
  const settings = options || {};
  const env = settings.env || process.env;
  const readiness = deliveryReadiness(env);
  const fetchFn = settings.fetch || fetch;
  if (!readiness.liveEnabled) {
    throw new DeliveryProviderError("Produkcijsko e-poštno pošiljanje ni vključeno.", {
      code: readiness.configured ? "EMAIL_DELIVERY_DISABLED" : "EMAIL_PROVIDER_NOT_CONFIGURED",
      retryable: false,
    });
  }
  return {
    name: "resend",
    async deliver(deliveryPackage) {
      const delivery = deliveryPackage && deliveryPackage.delivery;
      const attachments = deliveryPackage && deliveryPackage.attachments;
      if (!delivery || delivery.is_test || delivery.provider !== "resend" || delivery.channel !== "email") {
        throw new DeliveryProviderError("Resend sme obdelati samo potrjeno pravo e-poštno dostavo.", { code: "RESEND_DELIVERY_MODE_INVALID", retryable: false });
      }
      if (!validEmail(deliveryPackage.recipient)) {
        throw new DeliveryProviderError("E-poštni naslov prejemnika ni veljaven.", { code: "RESEND_RECIPIENT_INVALID", retryable: false });
      }
      if (!Array.isArray(attachments) || !attachments.length || attachments.some((item) => !Buffer.isBuffer(item.content))) {
        throw new DeliveryProviderError("Za e-pošto manjkajo preverjene arhivirane priloge.", { code: "RESEND_ATTACHMENTS_MISSING", retryable: false });
      }
      const totalBytes = attachments.reduce((sum, item) => sum + item.content.length, 0);
      if (totalBytes > MAX_RAW_ATTACHMENT_BYTES) {
        throw new DeliveryProviderError("Priloge so prevelike za varno e-poštno pošiljanje.", { code: "RESEND_ATTACHMENTS_TOO_LARGE", retryable: false });
      }
      const payload = {
        from: String(env.POS_EMAIL_FROM).trim(),
        to: [String(deliveryPackage.recipient).trim()],
        subject: String(deliveryPackage.subject || ("Rechnung " + deliveryPackage.invoiceNumber)).trim().slice(0, 240),
        text: String(deliveryPackage.message || "Im Anhang erhalten Sie Ihre Rechnung.").slice(0, 4000),
        attachments: attachments.map((item) => ({ filename: item.filename, content: item.content.toString("base64") })),
      };
      const replyTo = String(env.POS_EMAIL_REPLY_TO || "").trim();
      if (validEmail(replyTo)) payload.reply_to = replyTo;
      let response;
      try {
        response = await fetchFn(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + String(env.RESEND_API_KEY).trim(),
            "Content-Type": "application/json",
            "Idempotency-Key": resendIdempotencyKey(deliveryPackage),
          },
          body: JSON.stringify(payload),
          signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
        });
      } catch (_) {
        throw new DeliveryProviderError("E-poštni ponudnik trenutno ni dosegljiv.", { code: "RESEND_NETWORK_ERROR", retryable: true });
      }
      let body = null;
      try { body = await response.json(); } catch (_) {}
      if (!response.ok || !body || !body.id) {
        const retryable = response.status === 408 || response.status === 409 || response.status === 425 || response.status === 429 || response.status >= 500;
        throw new DeliveryProviderError(retryable ? "E-poštni ponudnik je začasno zavrnil pošiljanje." : "E-poštni ponudnik je zavrnil podatke pošiljanja.", {
          code: "RESEND_HTTP_" + response.status,
          retryable,
        });
      }
      return {
        provider: "resend",
        providerReference: String(body.id).slice(0, 240),
        status: "sent",
        sent: true,
        delivered: false,
      };
    },
  };
}

function providerFor(name, options) {
  if (name === "sandbox") return sandboxProvider();
  if (name === "resend") return resendProvider(options);
  throw new DeliveryProviderError("Ponudnik dostave še ni konfiguriran.", { code: "DELIVERY_PROVIDER_NOT_CONFIGURED", retryable: false });
}

module.exports = {
  DeliveryProviderError,
  MAX_RAW_ATTACHMENT_BYTES,
  deliveryReadiness,
  providerFor,
  resendIdempotencyKey,
  resendProvider,
  sandboxReference,
  validEmail,
};
