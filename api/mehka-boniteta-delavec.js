var sentry = require("./_lib/sentry");
"use strict";

var crypto = require("crypto");
var db = require("./_lib/supabase-server");
var queue = require("./_lib/mehka-boniteta-queue");
var mehkaBoniteta = require("./_handlers/mehka-boniteta");
var projectMonitor = require("./_lib/projektno-spremljanje");
var financialRecheck = require("./_lib/financno-ponovno-preverjanje");
var debtorCompanyIdentity = require("./_lib/debtor-company-identity");
var LEASE_HEARTBEAT_INTERVAL_MS = 20000;
var LEASE_EXTENSION_SECONDS = 75;

function varnoEnako(a, b) {
  var aa = Buffer.from(String(a || ""));
  var bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
}

function bearer(req) {
  var match = String(req.headers && req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function jeLokalnaZahteva(req) {
  var naslov = String(req && req.socket && req.socket.remoteAddress || "").toLowerCase();
  return naslov === "127.0.0.1" || naslov === "::1" || naslov === "::ffff:127.0.0.1";
}

function jeLokalniPredogled(req) {
  return process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE === "true" && jeLokalnaZahteva(req) &&
    String(req && req.headers && req.headers["x-uj-local-preview"] || "") === "1" &&
    bearer(req) === "local-preview";
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

function jeNedokoncanaUradnaInsolvencnaPreverba(payload) {
  var insolvenca = payload && payload.insolvency || {};
  var uradna = insolvenca.officialVerification || {};
  if (!insolvenca.status) return false;
  if (projectMonitor.jeNedokoncanaUradnaPreverba(payload)) return true;
  if (!["clear", "possible_match"].includes(insolvenca.status)) return false;
  return uradna.evidenceStatus !== "captured" || !uradna.evidenceImage;
}

function prehodnaNapaka(status, payload, job) {
  if (status >= 500) return true;
  if (!payload || !payload.ok) return false;
  // Brez zajetega rezultata uradnega portala preverba ni zaključena. Enako
  // velja za ročno preverbo in spremljanje: delni rezultat se ponovi in se ne
  // sme shraniti kot zadnja uspešna preverba. Pri prvi fazi identitete pa je
  // rezultat brez insolvenčnega dokazila pričakovan (uporabnik mora identiteto
  // šele pregledati ali dopolniti), zato ga ne smemo trikrat ponavljati in nato
  // napačno označiti kot nedosegljiv vir.
  var zahtevaZakljucenoInsolvenco = !job || job.faza === "insolvenca" ||
    Boolean(job.project_monitor_id || job.financial_recheck_id) ||
    Boolean(job.request_payload && job.request_payload.confirmedIdentity);
  if (zahtevaZakljucenoInsolvenco && jeNedokoncanaUradnaInsolvencnaPreverba(payload)) return true;
  return payload.retryable === true;
}

function vrsticaZakljucka(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

async function varnoZakljuciSpremljanje(cfg, job, success, payload) {
  if (!job || (!job.project_monitor_id && !job.financial_recheck_id)) return;
  try {
    if (job.project_monitor_id) await projectMonitor.finish(cfg, job, success, payload);
    if (job.financial_recheck_id) await financialRecheck.finish(cfg, job, success, payload);
  } catch (err) {
    // Rezultat preverbe je že varno shranjen v čakalni vrsti. Napaka pri
    // posodobitvi projektnega urnika ga ne sme spremeniti v neuspešno opravilo
    // ali povzročiti drugega zaključevanja z že porabljenim claim tokenom.
    console.error("[mehka-boniteta-delavec:project-finish]", err.code || err.message);
  }
}

function zacniObnavljanjeNajema(cfg, job, options) {
  var intervalMs = Math.max(5, Number(options && options.intervalMs) || LEASE_HEARTBEAT_INTERVAL_MS);
  var leaseSeconds = Math.min(Math.max(Number(options && options.leaseSeconds) || LEASE_EXTENSION_SECONDS, 30), 180);
  var ustavljeno = false;
  var vTeKu = null;
  var izgubaNajema = null;

  function obnovi() {
    if (ustavljeno || vTeKu || izgubaNajema) return;
    vTeKu = Promise.resolve().then(function () {
      return queue.podaljsajNajem(cfg, job, leaseSeconds);
    }).catch(function (err) {
      if (err && err.code === "QUEUE_LEASE_LOST") izgubaNajema = err;
      console.error("[mehka-boniteta-delavec:lease-heartbeat]", err && (err.code || err.message) || "UNKNOWN");
    }).finally(function () {
      vTeKu = null;
    });
  }

  var timer = setInterval(obnovi, intervalMs);
  if (timer && typeof timer.unref === "function") timer.unref();
  return {
    ustavi: async function () {
      if (!ustavljeno) {
        ustavljeno = true;
        clearInterval(timer);
      }
      if (vTeKu) await vTeKu;
    },
    preveriLastnistvo: function () {
      if (izgubaNajema) throw izgubaNajema;
    },
  };
}

function jobIzUskladitve(entry) {
  return {
    id: entry.job_id,
    request_payload: entry.request_payload || {},
    project_monitor_id: entry.project_monitor_id || null,
    financial_recheck_id: entry.financial_recheck_id || null,
  };
}

async function izvediZakljucekUskladitve(cfg, entry) {
  var job = jobIzUskladitve(entry);
  var prepared;
  if (entry.kind === "project_monitor") {
    prepared = projectMonitor.pripraviZakljucek(job, entry.success, entry.result_payload || null);
  } else if (entry.kind === "financial_recheck") {
    prepared = financialRecheck.pripraviZakljucek(entry.success, entry.result_payload || null);
  } else {
    throw Object.assign(new Error("Neznana vrsta uskladitve zaključka."), { code: "QUEUE_RECONCILIATION_KIND_INVALID" });
  }
  if (!prepared) throw Object.assign(new Error("Uskladitev nima veljavnega ciljnega urnika."), { code: "QUEUE_RECONCILIATION_TARGET_INVALID" });
  return queue.izvediUskladitev(cfg, entry, prepared.success, prepared.result);
}

async function uskladiZakljucek(cfg, jobId) {
  var entries = await queue.prevzemiZakljuckeZaUskladitev(cfg, 1, jobId || null);
  var entry = entries && entries[0];
  if (!entry) return null;
  try {
    await izvediZakljucekUskladitve(cfg, entry);
    return { id: entry.id, jobId: entry.job_id, kind: entry.kind, success: true };
  } catch (err) {
    try {
      await queue.zakljuciUskladitev(cfg, entry, false, err && err.message || "Uskladitev zaključka ni uspela.");
    } catch (retryError) {
      console.error("[mehka-boniteta-delavec:finish-reconciliation-requeue]", retryError.code || retryError.message);
      if (retryError && retryError.code === "QUEUE_LEASE_LOST") {
        return { id: entry.id, jobId: entry.job_id, kind: entry.kind, success: false, ownershipResolvedElsewhere: true };
      }
      throw retryError;
    }
    console.error("[mehka-boniteta-delavec:finish-reconciliation]", err && (err.code || err.message) || "UNKNOWN");
    return { id: entry.id, jobId: entry.job_id, kind: entry.kind, success: false, retryScheduled: true };
  }
}

async function izvediJob(cfg, job) {
  var res = navidezniOdgovor();
  var rezultatPridobljen = false;
  var obnavljanjeNajema = zacniObnavljanjeNajema(cfg, job);
  var najemUstavljen = false;
  async function ustaviNajemInPreveri() {
    if (!najemUstavljen) {
      najemUstavljen = true;
      await obnavljanjeNajema.ustavi();
    }
    obnavljanjeNajema.preveriLastnistvo();
  }
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
    var retryable = prehodnaNapaka(status, payload, job);
    var success = status >= 200 && status < 300 && !retryable;
    rezultatPridobljen = true;
    await ustaviNajemInPreveri();
    var zakljucek = vrsticaZakljucka(await queue.zakljuci(cfg, job, {
      success: success,
      retryable: retryable,
      result: payload,
      error: success ? null : payload.napaka || "Vir je bil začasno nedosegljiv.",
    }));
    // Projektni urnik premaknemo šele, ko je opravilo res terminalno. Pri
    // ponovnem poskusu status ostane queued in iste preverbe ne štejemo kot
    // že opravljene.
    if (zakljucek && ["completed", "failed"].includes(zakljucek.status) &&
        (job.project_monitor_id || job.financial_recheck_id)) {
      await uskladiZakljucek(cfg, job.id);
    }
    return { id: job.id, success: success, retryable: retryable, status: status };
  } catch (err) {
    if (!najemUstavljen) {
      najemUstavljen = true;
      await obnavljanjeNajema.ustavi();
    }
    obnavljanjeNajema.preveriLastnistvo();
    // Če je spodletelo samo podatkovno zaključevanje, istega claim tokena ne
    // poskušamo porabiti še enkrat. Lease bo opravilo varno vrnil v vrsto.
    if (rezultatPridobljen) throw err;
    var neuspesniZakljucek = vrsticaZakljucka(await queue.zakljuci(cfg, job, {
      success: false,
      retryable: true,
      error: err && err.message || "Nepričakovana napaka delavca.",
    }));
    if (neuspesniZakljucek && ["completed", "failed"].includes(neuspesniZakljucek.status) &&
        (job.project_monitor_id || job.financial_recheck_id)) {
      await uskladiZakljucek(cfg, job.id);
    }
    return { id: job.id, success: false, retryable: true, status: 500 };
  } finally {
    await obnavljanjeNajema.ustavi();
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

  var cronRequest = ujemanjeCron(req);
  var lokalniPredogled = jeLokalniPredogled(req);
  var claimUserId = null;
  if (!cronRequest && !lokalniPredogled) {
    var auth = await db.preveriUporabnika(req, cfg);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, napaka: auth.napaka });
    claimUserId = auth.user.id;
  }

  try {
    if (cronRequest && req.body && req.body.source === "debtor-company-identity-heartbeat") {
      var debtorRefresh = await debtorCompanyIdentity.refreshDue();
      return res.json({ ok: true, processed: debtorRefresh ? 1 : 0, debtorCompany: debtorRefresh });
    }
    if (!claimUserId) {
      var uskladitev = await uskladiZakljucek(cfg, null);
      if (uskladitev) return res.json({ ok: true, processed: 0, reconciled: 1, reconciliation: uskladitev });
    }
    // Ena funkcija požene eno težko brskalniško preverbo. Več funkcij se lahko
    // zažene hkrati; baza globalno dovoli 30 opravil, od tega največ 20
    // insolvenčnih poizvedb na uradni portal.
    var jobs = await queue.prevzemi(cfg, 1, claimUserId);
    // Uporabniški wake-up je omejen na njegove jobe. Globalna cron oziroma
    // lokalna interna pot lahko ob prazni vrsti sproži še razporejevalnika;
    // njuna napaka ne sme blokirati običajne preverbe podjetja.
    if (!jobs.length && !claimUserId) {
      try {
        await projectMonitor.schedule(cfg);
      } catch (scheduleError) {
        console.error("[mehka-boniteta-delavec:schedule]", scheduleError.code || scheduleError.message);
      }
      try {
        await financialRecheck.schedule(cfg);
      } catch (financialScheduleError) {
        console.error("[mehka-boniteta-delavec:financial-recheck-schedule]", financialScheduleError.code || financialScheduleError.message);
      }
      jobs = await queue.prevzemi(cfg, 1, claimUserId);
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
  jeNedokoncanaUradnaInsolvencnaPreverba: jeNedokoncanaUradnaInsolvencnaPreverba,
  navidezniOdgovor: navidezniOdgovor,
  izvediJob: izvediJob,
  vrsticaZakljucka: vrsticaZakljucka,
  varnoZakljuciSpremljanje: varnoZakljuciSpremljanje,
  zacniObnavljanjeNajema: zacniObnavljanjeNajema,
  izvediZakljucekUskladitve: izvediZakljucekUskladitve,
  uskladiZakljucek: uskladiZakljucek,
  jeLokalniPredogled: jeLokalniPredogled,
  LEASE_HEARTBEAT_INTERVAL_MS: LEASE_HEARTBEAT_INTERVAL_MS,
  LEASE_EXTENSION_SECONDS: LEASE_EXTENSION_SECONDS,
};
