var sentry = require("./_lib/sentry");
"use strict";

var crypto = require("crypto");
var db = require("./_lib/supabase-server");
var queue = require("./_lib/mehka-boniteta-queue");
var mehkaBoniteta = require("./mehka-boniteta");
var projectMonitor = require("./_lib/projektno-spremljanje");

function varnoEnako(a, b) {
  var aa = Buffer.from(String(a || ""));
  var bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
}

function bearer(req) {
  var match = String(req.headers && req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function ujemanjeCron(req) {
  var skrivnost = String(process.env.CRON_SECRET || "");
  return skrivnost.length >= 16 && varnoEnako(bearer(req), skrivnost);
}

function navidezniOdgovor() {
  var stanje = { status: 200, payload: null };
  return {
    state: stanje,
    setHeader: function () {},
    status: function (status) { stanje.status = status; return this; },
    json: function (payload) { stanje.payload = payload; return this; },
  };
}

function prehodnaNapaka(status, payload) {
  if (status >= 500) return true;
  if (!payload || !payload.ok) return false;
  // Uspešen odgovor z nedosegljivim virom je veljaven rumen rezultat, ne
  // tehnična napaka. Uporabniku ga pokažemo takoj in iste dolge preverbe ne
  // ponavljamo trikrat. Ponovimo le izrecno označeno prehodno napako.
  return payload.retryable === true;
}

function vrsticaZakljucka(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

async function varnoZakljuciSpremljanje(cfg, job, success, payload) {
  if (!job || !job.project_monitor_id) return;
  try {
    await projectMonitor.finish(cfg, job, success, payload);
  } catch (err) {
    // Rezultat preverbe je že varno shranjen v čakalni vrsti. Napaka pri
    // posodobitvi projektnega urnika ga ne sme spremeniti v neuspešno opravilo
    // ali povzročiti drugega zaključevanja z že porabljenim claim tokenom.
    console.error("[mehka-boniteta-delavec:project-finish]", err.code || err.message);
  }
}

async function izvediJob(cfg, job) {
  var res = navidezniOdgovor();
  var rezultatPridobljen = false;
  var req = {
    method: "POST",
    headers: {},
    body: job.request_payload || {},
    _mehkaBonitetaInternalUser: { id: job.user_id },
  };
  try {
    await mehkaBoniteta(req, res);
    var status = Number(res.state.status || 500);
    var payload = res.state.payload || { ok: false, napaka: "Preverjanje ni vrnilo rezultata." };
    var retryable = prehodnaNapaka(status, payload);
    var success = status >= 200 && status < 300 && !retryable;
    rezultatPridobljen = true;
    var zakljucek = vrsticaZakljucka(await queue.zakljuci(cfg, job, {
      success: success,
      retryable: retryable,
      result: payload,
      error: success ? null : payload.napaka || "Vir je bil začasno nedosegljiv.",
    }));
    // Projektni urnik premaknemo šele, ko je opravilo res terminalno. Pri
    // ponovnem poskusu status ostane queued in iste preverbe ne štejemo kot
    // že opravljene.
    if (zakljucek && ["completed", "failed"].includes(zakljucek.status)) {
      await varnoZakljuciSpremljanje(cfg, job, success, payload);
    }
    return { id: job.id, success: success, retryable: retryable, status: status };
  } catch (err) {
    // Če je spodletelo samo podatkovno zaključevanje, istega claim tokena ne
    // poskušamo porabiti še enkrat. Lease bo opravilo varno vrnil v vrsto.
    if (rezultatPridobljen) throw err;
    var neuspesniZakljucek = vrsticaZakljucka(await queue.zakljuci(cfg, job, {
      success: false,
      retryable: true,
      error: err && err.message || "Nepričakovana napaka delavca.",
    }));
    if (neuspesniZakljucek && ["completed", "failed"].includes(neuspesniZakljucek.status)) {
      await varnoZakljuciSpremljanje(cfg, job, false, null);
    }
    return { id: job.id, success: false, retryable: true, status: 500 };
  }
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, napaka: "Samo POST ali GET." });
  }

  var cfg;
  try {
    cfg = db.konfiguracija();
  } catch (_) {
    var lokalniUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
    var lokalniAnonKljuc = String(process.env.SUPABASE_ANON_KEY || "");
    if (!lokalniUrl || !lokalniAnonKljuc) {
      return res.status(500).json({ ok: false, napaka: "Strežniška konfiguracija manjka." });
    }
    cfg = { url: lokalniUrl, serviceKey: lokalniAnonKljuc };
  }

  if (!ujemanjeCron(req)) {
    var auth = await db.preveriUporabnika(req, cfg);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, napaka: auth.napaka });
  }

  try {
    // Ena funkcija požene eno težko brskalniško preverbo. Več funkcij se lahko
    // zažene hkrati; baza globalno dovoli 30 opravil, od tega največ 10
    // insolvenčnih poizvedb na uradni portal.
    var jobs = await queue.prevzemi(cfg, 1);
    // Ročna uporabniška preverba ima vedno prednost. Projektni razporejevalnik
    // zaženemo samo, ko ni že čakajočega opravila, njegova napaka pa ne sme
    // blokirati običajne preverbe podjetja.
    if (!jobs.length) {
      try {
        await projectMonitor.schedule(cfg);
      } catch (scheduleError) {
        console.error("[mehka-boniteta-delavec:schedule]", scheduleError.code || scheduleError.message);
      }
      jobs = await queue.prevzemi(cfg, 1);
    }
    if (!jobs.length) return res.json({ ok: true, processed: 0, busy: true });
    var rezultat = await izvediJob(cfg, jobs[0]);
    return res.json({ ok: true, processed: 1, result: rezultat });
  } catch (err) {
    console.error("[mehka-boniteta-delavec]", err.code || err.message);
    return res.status(503).json({ ok: false, napaka: "Delavec čakalne vrste trenutno ni dosegljiv." });
  }
}

module.exports = sentry.wrapHandler(handler, "/api/mehka-boniteta-delavec");
module.exports._test = {
  varnoEnako: varnoEnako,
  prehodnaNapaka: prehodnaNapaka,
  navidezniOdgovor: navidezniOdgovor,
  izvediJob: izvediJob,
  vrsticaZakljucka: vrsticaZakljucka,
  varnoZakljuciSpremljanje: varnoZakljuciSpremljanje,
};
