var sentry = require("./_lib/sentry");
"use strict";

var db = require("./_lib/supabase-server");
var core = require("./_lib/izvedba-core");

var KODA_V_STATUS = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CASE_RESOLVED: 409,
  VERSION_CONFLICT: 409,
  ACTION_ID_REUSED: 409,
  ACTION_IN_PROGRESS: 409,
  INVALID_SPOROCILA: 400,
  INCOMPLETE_RECIPIENTS: 409,
};

function jeNapakaZakljucenegaPrimera(err) {
  return [err && err.code, err && err.message, err && err.details, err && err.hint]
    .some(function (vrednost) { return String(vrednost || "").indexOf("CASE_RESOLVED") >= 0; });
}

var MAX_DOLZINA_SPOROCILA = 1600;

function preveriSporocila(sporocila) {
  if (!Array.isArray(sporocila) || !sporocila.length) {
    return { ok: false, napaka: "Ni izbranih sporočil za pošiljanje." };
  }
  var videni = {};
  for (var i = 0; i < sporocila.length; i++) {
    var vnos = sporocila[i] || {};
    var id = String(vnos.opominKorakId || "");
    var besedilo = typeof vnos.koncnoBesedilo === "string" ? vnos.koncnoBesedilo.trim() : "";
    if (!id) return { ok: false, napaka: "Manjka identifikator vrstice." };
    if (videni[id]) return { ok: false, napaka: "Podvojena vrstica v zahtevi." };
    videni[id] = true;
    if (!besedilo) return { ok: false, napaka: "Sporočilo ne sme biti prazno." };
    if (besedilo.length > MAX_DOLZINA_SPOROCILA) return { ok: false, napaka: "Sporočilo je predolgo." };
  }
  return { ok: true };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, napaka: "Samo POST." });
  }

  var cfg;
  try {
    cfg = db.konfiguracija();
  } catch (err) {
    return res.status(500).json({ ok: false, napaka: "Strežniška konfiguracija manjka." });
  }

  var auth = await db.preveriUporabnika(req, cfg);
  if (!auth.ok) {
    return res.status(auth.status).json({ ok: false, napaka: auth.napaka });
  }

  var telo = req.body && typeof req.body === "object" ? req.body : {};
  var zadevaId = String(telo.zadevaId || "");
  var stepId = String(telo.stepId || "");
  var version = telo.version != null ? String(telo.version) : "0";
  var actionId = String(telo.actionId || "");
  var sporocila = Array.isArray(telo.sporocila) ? telo.sporocila : [];

  if (!zadevaId || !stepId || !actionId) {
    return res.status(400).json({ ok: false, code: "MISSING_PARAMS", napaka: "Manjkajo obvezni podatki zahteve." });
  }

  var preverjeno = preveriSporocila(sporocila);
  if (!preverjeno.ok) {
    return res.status(400).json({ ok: false, code: "INVALID_SPOROCILA", napaka: preverjeno.napaka });
  }

  try {
    var zadeva = await db.preberiZadevo(cfg, zadevaId);
    if (!zadeva) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", napaka: "Zadeva ni najdena." });
    }
    if (zadeva.obrtnik_id !== auth.user.id) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", napaka: "Zadeva ni vaša." });
    }
    if (zadeva.status === "Rešeno") {
      return res.status(409).json({ ok: false, code: "CASE_RESOLVED", napaka: "Ta primer je že zaključen in ga ni več mogoče spreminjati." });
    }

    var kanonicnaSporocila = sporocila
      .map(function (s) { return { opominKorakId: String(s.opominKorakId), koncnoBesedilo: String(s.koncnoBesedilo).trim() }; })
      .sort(function (a, b) { return a.opominKorakId < b.opominKorakId ? -1 : a.opominKorakId > b.opominKorakId ? 1 : 0; });

    var fingerprint = core.izracunajFingerprint({
      obrtnikId: auth.user.id,
      zadevaId: zadevaId,
      stepId: stepId,
      actionType: "send_reminder",
      settings: { sporocila: kanonicnaSporocila },
    });

    var pSporocila = kanonicnaSporocila.map(function (s) {
      return { opomin_korak_id: s.opominKorakId, koncno_besedilo: s.koncnoBesedilo };
    });

    var rpcOdgovor = await db.pokliciRpc(cfg, "poslji_opomin_zdaj", {
      p_zadeva_id: zadevaId,
      p_obrtnik_id: auth.user.id,
      p_expected_version: version,
      p_action_id: actionId,
      p_fingerprint: fingerprint,
      p_step_id: stepId,
      p_sporocila: pSporocila,
    });

    if (!rpcOdgovor || rpcOdgovor.ok !== true) {
      var koda = (rpcOdgovor && rpcOdgovor.code) || "UNKNOWN_ERROR";
      var statusRpc = KODA_V_STATUS[koda] || 400;
      return res.status(statusRpc).json(rpcOdgovor || { ok: false, code: koda });
    }

    return res.json(rpcOdgovor);
  } catch (err) {
    console.error("[poslji-opomin-zdaj]", err.code || err.message, err.details || "");
    if (jeNapakaZakljucenegaPrimera(err)) {
      return res.status(409).json({ ok: false, code: "CASE_RESOLVED", napaka: "Ta primer je že zaključen in ga ni več mogoče spreminjati." });
    }
    return res.status(500).json({ ok: false, napaka: "Sporočila trenutno ni bilo mogoče poslati v vrsto." });
  }
}

module.exports = sentry.wrapHandler(handler, "/api/poslji-opomin-zdaj");
