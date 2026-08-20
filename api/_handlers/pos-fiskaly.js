"use strict";

const supabase = require("../_lib/supabase-server");
const fiskaly = require("../_lib/fiskaly-sign-de");

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
  if (req.method !== "GET") return json(res, 405, { ok: false, napaka: "Dovoljen je samo GET." });
  let cfg;
  try { cfg = supabase.uporabniskaKonfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  const auth = await supabase.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  try {
    return json(res, 200, { ok: true, fiskaly: await fiskaly.connectionStatus() });
  } catch (error) {
    const status = unavailable(error);
    if (error && error.code === "FISKALY_NOT_CONFIGURED") return json(res, 200, { ok: true, fiskaly: status });
    console.error("[pos-fiskaly]", String(error && (error.code || error.name) || "UNKNOWN"));
    return json(res, 502, {
      ok: false,
      code: error && error.code || "FISKALY_UNAVAILABLE",
      napaka: "Testne povezave s fiskaly SIGN DE ni bilo mogoče preveriti.",
      fiskaly: status,
    });
  }
}

module.exports = handler;
module.exports._test = { unavailable };
