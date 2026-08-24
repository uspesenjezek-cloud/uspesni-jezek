var sentry = require("./_lib/sentry");
"use strict";

var db = require("./_lib/supabase-server");
var core = require("./_lib/izvedba-core");

var KODA_V_STATUS = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  VERSION_CONFLICT: 409,
  ACTION_ID_REUSED: 409,
  ACTION_IN_PROGRESS: 409,
  STEP_NOT_FOUND: 409,
  STEP_ALREADY_SENT: 409,
  LAWYER_STEP_NOT_FOUND: 409,
  MISSING_HANDOFF_DATA: 422,
  PAYMENT_EXCEEDS_DEBT: 400,
  ACTION_NOT_FOUND: 404,
  ACTION_NOT_REVERSIBLE: 409,
  INVALID_SETTINGS: 400,
  INVALID_PAYMENT_AMOUNT: 400,
  UNKNOWN_ACTION_TYPE: 400,
};

function korakVDto(vrstica) {
  return {
    id: vrstica.id,
    stepId: vrstica.step_id,
    stepIndex: vrstica.step_index,
    recipientIndex: vrstica.recipient_index,
    kanal: vrstica.kanal,
    status: vrstica.status,
    executionState: vrstica.execution_state,
    scheduledAt: vrstica.scheduled_at,
    sentAt: vrstica.sent_at,
    sporocilo: vrstica.sporocilo,
    prejemnik: vrstica.prejemnik,
  };
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
  var stepId = telo.stepId ? String(telo.stepId) : null;
  var version = telo.version != null ? String(telo.version) : "0";
  var actionId = String(telo.actionId || "");
  var actionType = String(telo.actionType || "");
  var settings = telo.settings && typeof telo.settings === "object" ? telo.settings : {};

  if (!zadevaId || !actionId || !actionType) {
    return res.status(400).json({ ok: false, code: "MISSING_PARAMS", napaka: "Manjkajo obvezni podatki zahteve." });
  }

  try {
    var zadeva = await db.preberiZadevo(cfg, zadevaId);
    if (!zadeva) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", napaka: "Zadeva ni najdena." });
    }
    if (zadeva.obrtnik_id !== auth.user.id) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", napaka: "Zadeva ni vaša." });
    }

    if (actionType === "undo_settlement") {
      var targetActionId = String(settings.targetActionId || "");
      if (!targetActionId) {
        return res.status(400).json({ ok: false, code: "MISSING_PARAMS", napaka: "Manjka korak za odstranitev." });
      }
      var ciljniUkrepi = await db.pridobiVrstice(
        cfg,
        "opomin_ukrepi",
        "zadeva_id=eq." + encodeURIComponent(zadevaId) +
          "&action_id=eq." + encodeURIComponent(targetActionId) +
          "&select=action_id,action_type,status&limit=1"
      );
      var ciljniUkrep = ciljniUkrepi[0];
      if (!ciljniUkrep) {
        return res.status(404).json({ ok: false, code: "ACTION_NOT_FOUND", napaka: "Korak ni več na voljo." });
      }
      if (ciljniUkrep.status !== "completed" || !["partial_payment", "partial_settlement"].includes(ciljniUkrep.action_type)) {
        return res.status(409).json({ ok: false, code: "ACTION_NOT_REVERSIBLE", napaka: "Tega koraka ni mogoče odstraniti." });
      }
      var tabelaPoravnave = ciljniUkrep.action_type === "partial_payment" ? "zadeva_placila" : "zadeva_poravnave";
      var vrsticePoravnave = await db.pridobiVrstice(
        cfg,
        tabelaPoravnave,
        "zadeva_id=eq." + encodeURIComponent(zadevaId) +
          "&action_id=eq." + encodeURIComponent(targetActionId) + "&select=znesek&limit=1"
      );
      var vrnjeniZnesek = Number(vrsticePoravnave[0] && vrsticePoravnave[0].znesek);
      if (!(vrnjeniZnesek > 0)) {
        return res.status(409).json({ ok: false, code: "ACTION_NOT_REVERSIBLE", napaka: "Finančni zapis koraka manjka." });
      }
      var korakiZaRazveljavitev = await db.pridobiVrstice(
        cfg,
        "opomin_koraki",
        "zadeva_id=eq." + encodeURIComponent(zadevaId) +
          "&select=id,step_id,step_index,recipient_index,kanal,status,execution_state,scheduled_at,sent_at,sporocilo,prejemnik"
      );
      var razveljavitev = core.izracunajRazveljavitevPoravnave({
        plan: zadeva.opomin_nacrt || {},
        koraki: korakiZaRazveljavitev.map(korakVDto),
        novPreostanek: Number(zadeva.preostali_dolg) + vrnjeniZnesek,
      });
      if (!razveljavitev.ok) {
        return res.status(400).json(razveljavitev);
      }
      var undoOdgovor = await db.pokliciRpc(cfg, "razveljavi_opomin_poravnavo", {
        p_zadeva_id: zadevaId,
        p_obrtnik_id: auth.user.id,
        p_expected_version: version,
        p_target_action_id: targetActionId,
        p_new_plan: razveljavitev.newPlan,
      });
      if (!undoOdgovor || undoOdgovor.ok !== true) {
        var undoKoda = (undoOdgovor && undoOdgovor.code) || "UNKNOWN_ERROR";
        return res.status(KODA_V_STATUS[undoKoda] || 400).json(undoOdgovor || { ok: false, code: undoKoda });
      }
      undoOdgovor.ukrepi = await db.pridobiVrstice(
        cfg,
        "opomin_ukrepi",
        "zadeva_id=eq." + encodeURIComponent(zadevaId) +
          "&select=action_id,step_id,action_type,status,settings,created_at,completed_at&order=created_at.desc&limit=20"
      );
      return res.json(undoOdgovor);
    }

    if (actionType === "undo_payment_promise") {
      var targetPromiseActionId = String(settings.targetActionId || "");
      if (!targetPromiseActionId) {
        return res.status(400).json({ ok: false, code: "MISSING_PARAMS", napaka: "Manjka korak za odstranitev." });
      }
      var ciljneObljube = await db.pridobiVrstice(
        cfg,
        "opomin_ukrepi",
        "zadeva_id=eq." + encodeURIComponent(zadevaId) +
          "&action_id=eq." + encodeURIComponent(targetPromiseActionId) +
          "&select=action_id,action_type,status&limit=1"
      );
      var ciljnaObljuba = ciljneObljube[0];
      if (!ciljnaObljuba) {
        return res.status(404).json({ ok: false, code: "ACTION_NOT_FOUND", napaka: "Korak ni več na voljo." });
      }
      if (ciljnaObljuba.status !== "completed" || ciljnaObljuba.action_type !== "payment_promised") {
        return res.status(409).json({ ok: false, code: "ACTION_NOT_REVERSIBLE", napaka: "Tega koraka ni mogoče odstraniti." });
      }
      var promiseUndoOdgovor = await db.pokliciRpc(cfg, "razveljavi_obljubo_placila", {
        p_zadeva_id: zadevaId,
        p_obrtnik_id: auth.user.id,
        p_expected_version: version,
        p_target_action_id: targetPromiseActionId,
      });
      if (!promiseUndoOdgovor || promiseUndoOdgovor.ok !== true) {
        var promiseUndoKoda = (promiseUndoOdgovor && promiseUndoOdgovor.code) || "UNKNOWN_ERROR";
        return res.status(KODA_V_STATUS[promiseUndoKoda] || 400).json(
          promiseUndoOdgovor || { ok: false, code: promiseUndoKoda }
        );
      }
      promiseUndoOdgovor.ukrepi = await db.pridobiVrstice(
        cfg,
        "opomin_ukrepi",
        "zadeva_id=eq." + encodeURIComponent(zadevaId) +
          "&select=action_id,step_id,action_type,status,settings,created_at,completed_at&order=created_at.desc&limit=20"
      );
      return res.json(promiseUndoOdgovor);
    }

    if (actionType === "undo_stop_plan") {
      var targetStopActionId = String(settings.targetActionId || "");
      if (!targetStopActionId) {
        return res.status(400).json({ ok: false, code: "MISSING_PARAMS", napaka: "Manjka ustavitev načrta za odstranitev." });
      }
      var ciljneUstavitve = await db.pridobiVrstice(
        cfg,
        "opomin_ukrepi",
        "zadeva_id=eq." + encodeURIComponent(zadevaId) +
          "&action_id=eq." + encodeURIComponent(targetStopActionId) +
          "&select=action_id,action_type,status&limit=1"
      );
      var ciljnaUstavitev = ciljneUstavitve[0];
      if (!ciljnaUstavitev) {
        return res.status(404).json({ ok: false, code: "ACTION_NOT_FOUND", napaka: "Ustavitev načrta ni več na voljo." });
      }
      if (ciljnaUstavitev.status !== "completed" || ciljnaUstavitev.action_type !== "stop_plan") {
        return res.status(409).json({ ok: false, code: "ACTION_NOT_REVERSIBLE", napaka: "Te ustavitve načrta ni mogoče odstraniti." });
      }
      var stopUndoOdgovor = await db.pokliciRpc(cfg, "razveljavi_ustavitev_opomin_nacrta", {
        p_zadeva_id: zadevaId,
        p_obrtnik_id: auth.user.id,
        p_expected_version: version,
        p_target_action_id: targetStopActionId,
      });
      if (!stopUndoOdgovor || stopUndoOdgovor.ok !== true) {
        var stopUndoKoda = (stopUndoOdgovor && stopUndoOdgovor.code) || "UNKNOWN_ERROR";
        return res.status(KODA_V_STATUS[stopUndoKoda] || 400).json(
          stopUndoOdgovor || { ok: false, code: stopUndoKoda }
        );
      }
      stopUndoOdgovor.ukrepi = await db.pridobiVrstice(
        cfg,
        "opomin_ukrepi",
        "zadeva_id=eq." + encodeURIComponent(zadevaId) +
          "&select=action_id,step_id,action_type,status,settings,created_at,completed_at&order=created_at.desc&limit=20"
      );
      return res.json(stopUndoOdgovor);
    }

    var validacija = core.validirajNastavitve(actionType, settings, { preostaliDolg: zadeva.preostali_dolg });
    if (!validacija.ok) {
      var statusNastavitve = KODA_V_STATUS[validacija.code] || 400;
      return res.status(statusNastavitve).json({ ok: false, code: validacija.code, napaka: validacija.napaka });
    }

    var korakiVrstice = await db.pridobiVrstice(
      cfg,
      "opomin_koraki",
      "zadeva_id=eq." + encodeURIComponent(zadevaId) +
        "&select=id,step_id,step_index,recipient_index,kanal,status,execution_state,scheduled_at,sent_at,sporocilo,prejemnik"
    );
    var koraki = korakiVrstice.map(korakVDto);

    var ctx = {
      plan: zadeva.opomin_nacrt || {},
      koraki: koraki,
      stepId: stepId,
      settings: validacija.settings,
      placiloZnesek: validacija.placiloZnesek,
      novPreostanek: validacija.settings ? validacija.settings.remainingAmount : undefined,
    };

    var izracun = core.izracunajUkrep(actionType, ctx);
    if (!izracun.ok) {
      var statusIzracun = KODA_V_STATUS[izracun.code] || 400;
      return res.status(statusIzracun).json({ ok: false, code: izracun.code, missing: izracun.missing, napaka: izracun.napaka });
    }

    var fingerprint = core.izracunajFingerprint({
      obrtnikId: auth.user.id,
      zadevaId: zadevaId,
      stepId: stepId,
      actionType: actionType,
      settings: validacija.settings,
    });

    var placiloVrsta = validacija.placiloVrsta || (actionType === "partial_payment" ? "partial" : (actionType === "paid_in_full" ? "full" : null));

    var rpcOdgovor = await db.pokliciRpc(cfg, "izvedi_opomin_ukrep", {
      p_zadeva_id: zadevaId,
      p_obrtnik_id: auth.user.id,
      p_expected_version: version,
      p_action_id: actionId,
      p_fingerprint: fingerprint,
      p_action_type: actionType,
      p_settings: validacija.settings,
      p_new_plan: izracun.newPlan,
      p_koraki_updates: izracun.korakiUpdates,
      p_placilo_znesek: izracun.placiloZnesek != null ? izracun.placiloZnesek : null,
      p_placilo_vrsta: placiloVrsta,
    });

    if (!rpcOdgovor || rpcOdgovor.ok !== true) {
      var koda = (rpcOdgovor && rpcOdgovor.code) || "UNKNOWN_ERROR";
      var statusRpc = KODA_V_STATUS[koda] || 400;
      return res.status(statusRpc).json(rpcOdgovor || { ok: false, code: koda });
    }

    return res.json(rpcOdgovor);
  } catch (err) {
    console.error("[izvedi-opomin-ukrep]", err.code || err.message, err.details || "");
    return res.status(500).json({ ok: false, napaka: "Ukrepa trenutno ni bilo mogoče izvesti." });
  }
}

module.exports = sentry.wrapHandler(handler, "/api/izvedi-opomin-ukrep");
