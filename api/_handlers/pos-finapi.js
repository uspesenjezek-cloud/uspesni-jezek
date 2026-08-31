"use strict";

const supabase = require("../_lib/supabase-server");
const finapi = require("../_lib/finapi-access");
const requestJson = require("../_lib/pos-request-json");
const MAX_BODY_BYTES = 16 * 1024;

function json(res, status, body) {
  res.status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0")
    .end(JSON.stringify(body));
}

function unavailable(error) {
  const environment = String(process.env.FINAPI_MODE || "sandbox").toLowerCase() === "production"
    ? "production"
    : "sandbox";
  return {
    configured: Boolean(error && error.code !== "FINAPI_NOT_CONFIGURED"),
    connected: false,
    pending: false,
    environment,
    bankName: "",
  };
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Dovoljena sta samo GET in POST." });
  let cfg;
  try { cfg = supabase.uporabniskaKonfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  const auth = await supabase.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });

  try {
    if (req.method === "GET") {
      return json(res, 200, { ok: true, finapi: await finapi.statusForUser(auth.user.id) });
    }
    let body;
    try { body = requestJson(req, MAX_BODY_BYTES); }
    catch (error) { return json(res, error.status || 400, { ok: false, code: error.code, napaka: error.message }); }
    const action = String(body.action || "sync");
    if (action === "connect") {
      const webForm = await finapi.createBankWebForm(auth.user.id);
      return json(res, 201, { ok: true, webForm });
    }
    if (action !== "sync") return json(res, 400, { ok: false, napaka: "Neznano finAPI opravilo." });
    const result = await finapi.syncTransactions(auth.user.id);
    return json(res, 200, { ok: true, finapi: result.status, transactions: result.transactions, syncedAt: result.syncedAt });
  } catch (error) {
    if (error && error.code === "FINAPI_NOT_CONFIGURED") {
      return json(res, 200, { ok: true, finapi: unavailable(error), transactions: [] });
    }
    if (error && error.code === "FINAPI_WEBFORM_REQUIRED") {
      return json(res, 409, {
        ok: false,
        code: error.code,
        napaka: "Najprej zaključite varen finAPI bančni obrazec.",
        finapi: unavailable(error),
      });
    }
    if (error && error.code === "FINAPI_LIVE_LOCKED") {
      return json(res, 409, { ok: false, code: error.code, napaka: error.message, finapi: unavailable(error) });
    }
    console.error("[pos-finapi]", String(error && (error.code || error.name) || "UNKNOWN"));
    return json(res, error && error.retryable ? 503 : 502, {
      ok: false,
      code: error && error.code || "FINAPI_UNAVAILABLE",
      napaka: error && error.retryable
        ? "finAPI je začasno nedosegljiv. Poskusite znova čez nekaj trenutkov."
        : "Banke trenutno ni bilo mogoče sinhronizirati.",
      finapi: unavailable(error),
    });
  }
}

module.exports = handler;
module.exports._test = { unavailable, MAX_BODY_BYTES };
