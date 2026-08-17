var sentry = require("./_lib/sentry");
"use strict";

var db = require("./_lib/supabase-server");

function preberiPoizvedbo(req) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    var url = new URL(req.url, "http://localhost");
    var izhod = {};
    url.searchParams.forEach(function (vrednost, kljuc) { izhod[kljuc] = vrednost; });
    return izhod;
  } catch (_) {
    return {};
  }
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, napaka: "Samo GET." });
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

  var poizvedba = preberiPoizvedbo(req);
  var zadevaId = poizvedba.zadevaId ? String(poizvedba.zadevaId) : "";
  var stepId = poizvedba.stepId ? String(poizvedba.stepId) : "";
  var executionId = poizvedba.executionId ? String(poizvedba.executionId) : "";

  try {
    if (!zadevaId && executionId) {
      var izvedbaVrstice = await db.pridobiVrstice(
        cfg,
        "opomin_koraki",
        "id=eq." + encodeURIComponent(executionId) + "&select=zadeva_id,step_id"
      );
      if (!izvedbaVrstice.length) {
        return res.status(404).json({ ok: false, code: "NOT_FOUND", napaka: "Izvedba ni najdena." });
      }
      zadevaId = izvedbaVrstice[0].zadeva_id;
      stepId = stepId || izvedbaVrstice[0].step_id;
    }

    if (!zadevaId) {
      return res.status(400).json({ ok: false, code: "MISSING_PARAMS", napaka: "Manjka zadevaId ali executionId." });
    }

    var zadeva = await db.preberiZadevo(cfg, zadevaId);
    if (!zadeva) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", napaka: "Zadeva ni najdena." });
    }
    if (zadeva.obrtnik_id !== auth.user.id) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", napaka: "Zadeva ni vaša." });
    }

    var koraki = await db.pridobiVrstice(
      cfg,
      "opomin_koraki",
      "zadeva_id=eq." + encodeURIComponent(zadevaId) +
        "&select=id,step_id,step_index,recipient_index,kanal,status,execution_state,scheduled_at,sent_at,sporocilo,prejemnik,last_error,cancel_reason,paused_until,confirmed_by_user_at" +
        "&order=step_index.asc,recipient_index.asc,kanal.asc"
    );

    var ukrepi = await db.pridobiVrstice(
      cfg,
      "opomin_ukrepi",
      "zadeva_id=eq." + encodeURIComponent(zadevaId) +
        "&select=action_id,step_id,action_type,status,created_at,completed_at&order=created_at.desc&limit=20"
    );

    var plan = zadeva.opomin_nacrt || {};
    var vkljuceniStepi = (plan.steps || []).filter(function (s) { return !s.isExcluded; });

    var trenutniStepId = stepId;
    if (!trenutniStepId) {
      var zapadli = koraki.find(function (k) { return k.execution_state === "awaiting_confirmation"; });
      var priprava = koraki.find(function (k) { return k.execution_state !== "sent" && k.execution_state !== "cancelled" && k.execution_state !== "skipped"; });
      trenutniStepId = (zapadli && zapadli.step_id) || (priprava && priprava.step_id) || (vkljuceniStepi[0] && vkljuceniStepi[0].id) || null;
    }

    return res.json({
      ok: true,
      zadeva: {
        id: zadeva.id,
        imeDolznika: zadeva.ime_dolznika,
        opisDolga: zadeva.opis_dolga,
        status: zadeva.status,
        znesek: zadeva.znesek,
        prvotniZnesek: zadeva.prvotni_znesek,
        preostaliDolg: zadeva.preostali_dolg,
        placanoSkupaj: zadeva.placano_skupaj,
        poravnanoAt: zadeva.poravnano_at,
        telefonDolznika: zadeva.telefon_dolznika,
        emailDolznika: zadeva.email_dolznika,
        stevilkaRacuna: zadeva.stevilka_racuna,
        datumZapadlosti: zadeva.datum_zapadlosti,
      },
      plan: plan,
      steps: koraki,
      ukrepi: ukrepi,
      currentStepId: trenutniStepId,
      totalSteps: vkljuceniStepi.length,
      emailNaVoljo: false,
    });
  } catch (err) {
    console.error("[pridobi-izvedbo]", err.code || err.message);
    return res.status(500).json({ ok: false, napaka: "Podatkov izvedbe ni bilo mogoče pridobiti." });
  }
}

module.exports = sentry.wrapHandler(handler, "/api/pridobi-izvedbo");
