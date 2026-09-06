"use strict";

const handlers = Object.freeze({
  "invoice-pdf": require("./_handlers/pos-racun-pdf"),
  "offer-pdf": require("./_handlers/pos-angebot-pdf"),
  "contract-confirmation-pdf": require("./_handlers/pos-pogodba-pdf"),
  "invoice-adjustment": require("./_handlers/pos-racun-korekcija"),
  "adjustment-xrechnung": require("./_handlers/pos-racun-korekcija-xrechnung"),
  "invoice-xrechnung": require("./_handlers/pos-racun-xrechnung"),
  "delivery-sandbox": require("./_handlers/pos-dostava-sandbox"),
  "delivery-worker": require("./_handlers/pos-dostava-delavec"),
  "archive-worker": require("./_handlers/pos-arhiv-delavec"),
  "procedure-documentation-pdf": require("./_handlers/pos-verfahrensdokumentation-pdf"),
  "delivery-email": require("./_handlers/pos-dostava-email"),
  "delivery-webhook": require("./_handlers/pos-dostava-webhook"),
  "openapi-invoice": require("./_handlers/pos-openapi-invoice"),
  "fiskaly-sign": require("./_handlers/pos-fiskaly"),
  "finapi-bank": require("./_handlers/pos-finapi"),
  "stripe-checkout": require("./_handlers/pos-stripe-checkout"),
  "stripe-webhook": require("./_handlers/pos-stripe-webhook"),
  "archive": require("./_handlers/pos-arhiv"),
  "datev": require("./_handlers/pos-datev"),
});

function route(req) {
  try { return new URL(req && req.url || "/", "http://localhost").searchParams.get("handler") || ""; }
  catch (_) { return ""; }
}

module.exports = function handler(req, res) {
  // Brez lastnostne preverbe bi ?handler=constructor / toString / __proto__
  // nasel podedovano lastnost z Object.prototype in jo poskusil poklicati
  // kot rokovalnik. Zahteva ostane brez odgovora, namesto da vrne 404.
  const pot = route(req);
  const selected = Object.prototype.hasOwnProperty.call(handlers, pot) ? handlers[pot] : null;
  if (typeof selected !== "function") return res.status(404).json({ ok: false, napaka: "Neznana POS pot." });
  return selected(req, res);
};

module.exports._test = { route };
