var sentry = require("./_lib/sentry");
"use strict";

var db = require("./_lib/supabase-server");
var queue = require("./_lib/mehka-boniteta-queue");
var profileStore = require("./_lib/boniteta-pro-store");

function odgovorJson(res, status, podatki) {
  return res.status(status).json(podatki);
}

function pridobiId(req) {
  if (req.query && req.query.id) return String(req.query.id);
  try { return new URL(req.url, "http://localhost").searchParams.get("id") || ""; } catch (_) { return ""; }
}

function pridobiLokalnoDomeno(req) {
  try { return new URL(req.url, "http://localhost").searchParams.get("purgeDomain") || ""; } catch (_) { return ""; }
}

function pridobiLokalnoPreglednoDomeno(req) {
  try { return new URL(req.url, "http://localhost").searchParams.get("inspectDomain") || ""; } catch (_) { return ""; }
}

function jeLokalnaZahteva(req) {
  var naslov = String(req && req.socket && req.socket.remoteAddress || "").toLowerCase();
  return naslov === "127.0.0.1" || naslov === "::1" || naslov === "::ffff:127.0.0.1";
}

function pridobiProfileId(req) {
  if (req.query && req.query.profileId) return String(req.query.profileId);
  try { return new URL(req.url, "http://localhost").searchParams.get("profileId") || ""; } catch (_) { return ""; }
}

function jeLokalniPredogled(req) {
  return process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE === "true" && jeLokalnaZahteva(req) &&
    String(req && req.headers && req.headers["x-uj-local-preview"] || "") === "1" &&
    /^Bearer\s+local-preview$/i.test(String(req && req.headers && req.headers.authorization || ""));
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["POST", "GET", "DELETE"].includes(req.method)) {
    return odgovorJson(res, 405, { ok: false, napaka: "Dovoljeni so POST, GET ali DELETE." });
  }

  // Nikoli ni dosegljivo v produkciji: lokalni strežnik izrecno uporablja
  // pomnilniško vrsto, klic pa mora priti z istega računalnika. Tako lahko
  // odstranimo pokvarjen rezultat brez profila in brez ugibanja njegovega ID-ja.
  var lokalnaDomena = req.method === "DELETE" ? pridobiLokalnoDomeno(req) : "";
  if (lokalnaDomena && process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE === "true" && jeLokalnaZahteva(req)) {
    var lokalnoIzbrisanih = queue.izbrisiLokalnaOpravilaPoDomeni(lokalnaDomena);
    return odgovorJson(res, 200, { ok: true, deleted: { domain: lokalnaDomena, checks: lokalnoIzbrisanih } });
  }
  var lokalnaPreglednaDomena = req.method === "GET" ? pridobiLokalnoPreglednoDomeno(req) : "";
  if (lokalnaPreglednaDomena && process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE === "true" && jeLokalnaZahteva(req)) {
    return odgovorJson(res, 200, {
      ok: true,
      domain: lokalnaPreglednaDomena,
      jobs: queue.pridobiLokalnaOpravilaPoDomeni(lokalnaPreglednaDomena),
    });
  }

  var cfg;
  try {
    cfg = db.konfiguracija();
  } catch (_) {
    var lokalniUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
    var lokalniAnonKljuc = String(process.env.SUPABASE_ANON_KEY || "");
    if (!lokalniUrl || !lokalniAnonKljuc) {
      return odgovorJson(res, 500, { ok: false, napaka: "Strežniška konfiguracija manjka." });
    }
    cfg = { url: lokalniUrl, serviceKey: lokalniAnonKljuc };
  }

  var auth = jeLokalniPredogled(req)
    ? { ok: true, token: "", user: { id: "00000000-0000-0000-0000-000000000001" } }
    : await db.preveriUporabnika(req, cfg);
  if (!auth.ok) return odgovorJson(res, auth.status, {
    ok: false,
    code: auth.code || "AUTH_FAILED",
    retryable: auth.retryable === true,
    napaka: auth.napaka,
  });

  try {
    if (req.method === "DELETE") {
      var deleteId = pridobiId(req);
      if (!/^[0-9a-f-]{32,36}$/i.test(deleteId)) {
        return odgovorJson(res, 400, { ok: false, napaka: "Manjka veljaven ID preverjanja." });
      }
      // Brez service-role ključa uporabimo prijavno sejo. RLS dovoljuje
      // brisanje izključno vrstice, kjer je auth.uid() enak user_id.
      var deleteCfg = cfg.isService === true ? cfg : Object.assign({}, cfg, {
        publicKey: String(process.env.SUPABASE_ANON_KEY || cfg.serviceKey || ""),
        userToken: auth.token,
        isService: false,
      });
      var deletedCount = await queue.izbrisiOpravilo(deleteCfg, auth.user.id, deleteId);
      return deletedCount > 0
        ? odgovorJson(res, 200, { ok: true, deleted: { id: deleteId, checks: deletedCount } })
        : odgovorJson(res, 404, { ok: false, napaka: "Preverjanje ni bilo najdeno ali ni vaše." });
    }
    if (req.method === "POST") {
      var telo = req.body && typeof req.body === "object" ? req.body : {};
      var job = await queue.ustvari(cfg, auth.user.id, telo);
      return odgovorJson(res, job.status === "completed" ? 200 : 202, { ok: true, job: job });
    }

    var id = pridobiId(req);
    var profileId = pridobiProfileId(req);
    if (!id && profileId) {
      if (!/^[0-9a-f-]{36}$/i.test(profileId)) {
        return odgovorJson(res, 400, { ok: false, napaka: "Manjka veljaven profil preverjanja." });
      }
      var profileCfg = cfg.isService === true ? cfg : Object.assign({}, cfg, {
        publicKey: String(process.env.SUPABASE_ANON_KEY || cfg.publicKey || cfg.serviceKey || ""),
        userToken: auth.token,
        isService: false,
        forceRemoteQueue: process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE !== "true",
      });
      var profile = await profileStore.getProfile(profileCfg, auth.user.id, profileId);
      if (!profile) return odgovorJson(res, 404, { ok: false, napaka: "Profil ni bil najden." });
      var profileJob = await queue.pridobiNajnovejseZaProfil(profileCfg, auth.user.id, profile);
      if (!profileJob) return odgovorJson(res, 404, { ok: false, napaka: "Veljavno dokazno preverjanje za ta profil ni bilo najdeno." });
      return odgovorJson(res, 200, { ok: true, job: profileJob });
    }
    if (!id) {
      var aktivnaOpravila = await queue.seznamAktivnih(cfg, auth.user.id);
      return odgovorJson(res, 200, { ok: true, jobs: aktivnaOpravila });
    }
    if (!/^[0-9a-f-]{32,36}$/i.test(id)) {
      return odgovorJson(res, 400, { ok: false, napaka: "Manjka veljaven ID preverjanja." });
    }
    var najden = await queue.pridobi(cfg, auth.user.id, id);
    if (!najden) return odgovorJson(res, 404, { ok: false, napaka: "Preverjanje ni bilo najdeno." });
    return odgovorJson(res, 200, { ok: true, job: najden });
  } catch (err) {
    console.error("[mehka-boniteta-opravilo]", err.code || err.message);
    return odgovorJson(res, 503, {
      ok: false,
      code: err.code || "QUEUE_UNAVAILABLE",
      napaka: "Čakalna vrsta trenutno ni dosegljiva. Poskusite ponovno čez nekaj trenutkov.",
    });
  }
}

module.exports = sentry.wrapHandler(handler, "/api/mehka-boniteta-opravilo");
module.exports._test = {
  pridobiId: pridobiId,
  pridobiProfileId: pridobiProfileId,
  pridobiLokalnoDomeno: pridobiLokalnoDomeno,
  pridobiLokalnoPreglednoDomeno: pridobiLokalnoPreglednoDomeno,
  jeLokalnaZahteva: jeLokalnaZahteva,
  jeLokalniPredogled: jeLokalniPredogled,
};
