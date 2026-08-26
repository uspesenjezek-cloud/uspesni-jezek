"use strict";

const supabase = require("../_lib/supabase-server");
const fiskaly = require("../_lib/fiskaly-sign-de");
const requestJson = require("../_lib/pos-request-json");
const MAX_BODY_BYTES = 64 * 1024;

function json(res, status, body) {
  res.status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0")
    .end(JSON.stringify(body));
}

function unavailable(error) {
  return {
    configured: Boolean(error && error.code !== "FISKALY_NOT_CONFIGURED"),
    connected: false,
    environment: "test",
    country: "DE",
    tssCount: 0,
    tssState: "",
    clientState: "",
    integrationReady: false,
    cashModuleEnabled: false,
  };
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Dovoljena sta samo GET in POST." });
  let cfg;
  try { cfg = supabase.uporabniskaKonfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  const auth = await supabase.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  let body = {};
  if (req.method === "POST") {
    try { body = requestJson(req, MAX_BODY_BYTES); }
    catch (error) { return json(res, error.status || 400, { ok: false, code: error.code, napaka: error.message }); }
  }
  try {
    if (req.method === "POST") {
      const action = String(body.action || "");
      if (!["training-transaction", "training-receipt"].includes(action)) return json(res, 400, { ok: false, napaka: "Neznano fiskaly opravilo." });
      const transaction = action === "training-receipt"
        ? await fiskaly.runTrainingReceipt(process.env, body.transactionId, body.receipt)
        : await fiskaly.runTrainingTransaction(process.env, body.transactionId);
      return json(res, 201, { ok: true, sandbox: true, live: false, cashModuleEnabled: false, transaction });
    }
    return json(res, 200, { ok: true, fiskaly: await fiskaly.connectionStatus() });
  } catch (error) {
    const status = unavailable(error);
    if (error && error.code === "FISKALY_NOT_CONFIGURED" && req.method === "GET") return json(res, 200, { ok: true, fiskaly: status });
    if (error && error.code === "FISKALY_TX_ID_INVALID") return json(res, 400, { ok: false, code: error.code, napaka: "Neveljaven identifikator testnega podpisa." });
    if (error && error.code === "FISKALY_RECEIPT_INVALID") return json(res, 400, { ok: false, code: error.code, napaka: error.message });
    if (error && ["FISKALY_NOT_CONFIGURED", "FISKALY_RESOURCES_NOT_CONFIGURED", "FISKALY_RESOURCES_NOT_READY"].includes(error.code)) {
      return json(res, 409, { ok: false, code: error.code, napaka: "fiskaly TEST okolje še ni pripravljeno za podpis." });
    }
    console.error("[pos-fiskaly]", String(error && (error.code || error.name) || "UNKNOWN"));
    return json(res, error && error.retryable ? 503 : 502, {
      ok: false,
      code: error && error.code || "FISKALY_UNAVAILABLE",
      napaka: req.method === "POST"
        ? "Varnega fiskaly SIGN DE preizkusa ni bilo mogoče zaključiti."
        : "Testne povezave s fiskaly SIGN DE ni bilo mogoče preveriti.",
      fiskaly: status,
    });
  }
}

module.exports = handler;
module.exports._test = { unavailable, MAX_BODY_BYTES };
