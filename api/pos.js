"use strict";

const handlers = Object.freeze({
  "invoice-pdf": require("./_handlers/pos-racun-pdf"),
  "invoice-adjustment": require("./_handlers/pos-racun-korekcija"),
  "invoice-xrechnung": require("./_handlers/pos-racun-xrechnung"),
  "delivery-sandbox": require("./_handlers/pos-dostava-sandbox"),
  "delivery-worker": require("./_handlers/pos-dostava-delavec"),
  "delivery-email": require("./_handlers/pos-dostava-email"),
  "delivery-webhook": require("./_handlers/pos-dostava-webhook"),
  "fiskaly-sign": require("./_handlers/pos-fiskaly"),
  "finapi-bank": require("./_handlers/pos-finapi"),
  "stripe-checkout": require("./_handlers/pos-stripe-checkout"),
  "stripe-webhook": require("./_handlers/pos-stripe-webhook"),
  "archive": require("./_handlers/pos-arhiv"),
});

function route(req) {
  try { return new URL(req && req.url || "/", "http://localhost").searchParams.get("handler") || ""; }
  catch (_) { return ""; }
}

module.exports = function handler(req, res) {
  const selected = handlers[route(req)];
  if (!selected) return res.status(404).json({ ok: false, napaka: "Neznana POS pot." });
  return selected(req, res);
};

module.exports._test = { route };
