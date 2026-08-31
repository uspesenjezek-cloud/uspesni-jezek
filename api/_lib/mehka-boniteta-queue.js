"use strict";

var crypto = require("crypto");
var db = require("./supabase-server");
var identityEvidenceContract = require("./identity-evidence");
var MAX_CONCURRENCY = 30;
var MAX_INSOLVENCY_CONCURRENCY = 20;
var DEFAULT_LEASE_SECONDS = 75;
// Del ključa predpomnilnika mora napredovati, kadar se spremeni parser,
// odločanje ali zajem dokaznega posnetka. Tako star siv oziroma prekrit
// posnetek po popravku ne more znova prekriti novega pravilnega zajema.
var CACHE_VERSION = identityEvidenceContract.CACHE_VERSION;
var INSOLVENCY_CACHE_VERSION = "official-insolvency-v11-proof-required-terminal";
var NORTHDATA_ENRICHMENT_VERSION = "northdata-apify-v10-financial-invariants";
var COMPANY_IDENTITY_SEARCH_VERSION = "company-index-v1-one-credit-proof";

function razlicicaDostopaDoVirov() {
  var skrivnosti = [
    String(process.env.OPENREGISTER_API_KEY || "").trim(),
    String(process.env.APIFY_API_TOKEN || "").trim(),
  ].join("|");
  if (skrivnosti === "|") return "sources-none";
  return "sources-" + crypto.createHash("sha256").update(skrivnosti).digest("hex").slice(0, 12);
}

var globalniPomnilnik = global.__UJ_MEHKA_BONITETA_QUEUE__;
if (!globalniPomnilnik) {
  globalniPomnilnik = { jobs: new Map(), reconciliations: new Map() };
  global.__UJ_MEHKA_BONITETA_QUEUE__ = globalniPomnilnik;
}
if (!globalniPomnilnik.reconciliations) globalniPomnilnik.reconciliations = new Map();

function uporabiPomnilnik() {
  return String(process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE || "").toLowerCase() === "true";
}

function uuid() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

function normaliziraj(vrednost) {
  return String(vrednost || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function fazaZahteve(telo) {
  return telo && telo.confirmedIdentity && telo.confirmedIdentity.confirmed ? "insolvenca" : "identiteta";
}

function cacheKey(telo) {
  var potrjeno = telo && telo.confirmedIdentity || {};
  var faza = fazaZahteve(telo);
  var podatki = {
    cacheVersion: CACHE_VERSION + ":" + NORTHDATA_ENRICHMENT_VERSION + ":" + COMPANY_IDENTITY_SEARCH_VERSION + ":" + razlicicaDostopaDoVirov() +
      (faza === "insolvenca" ? ":" + INSOLVENCY_CACHE_VERSION : ""),
    faza: faza,
    ime: normaliziraj(telo && telo.ime),
    naslov: normaliziraj(telo && telo.naslov),
    postnaStevilka: normaliziraj(telo && telo.postnaStevilka),
    kraj: normaliziraj(telo && telo.kraj),
    spletnaStran: normaliziraj(telo && telo.spletnaStran).replace(/\/$/, ""),
    openRegisterCompanyId: normaliziraj(telo && telo.openRegisterCompanyId),
    registerNumber: normaliziraj(telo && telo.registerNumber),
    registerCourt: normaliziraj(telo && telo.registerCourt),
    companyIndexSource: normaliziraj(telo && telo.companyIndexSource),
    openregister: Boolean(telo && telo.uporabiOpenRegisterIdentiteto),
    potrjenoIme: normaliziraj(potrjeno.name),
    potrjeniNaziv: normaliziraj(potrjeno.businessName),
    potrjeniNosilec: normaliziraj(potrjeno.representativeName),
    potrjeniNaslov: normaliziraj(potrjeno.street),
    potrjenaPosta: normaliziraj(potrjeno.postalCode),
    potrjeniKraj: normaliziraj(potrjeno.city),
    companyId: normaliziraj(potrjeno.companyId),
  };
  return crypto.createHash("sha256").update(JSON.stringify(podatki)).digest("hex");
}

function cacheTtlMs(faza) {
  return faza === "insolvenca" ? 10 * 60 * 1000 : 6 * 60 * 60 * 1000;
}

function jeRezultatPrimerenZaPredpomnilnik(rezultat, faza) {
  if (!rezultat || rezultat.ok !== true) return false;
  var identiteta = rezultat.identity || {};
  var dokazilo = identityEvidenceContract.obogatiDokazilo(rezultat.identityEvidence || {});
  var identitetaJeUradna = identiteta.status === "verified_register" && dokazilo.status === "verified_api" &&
    Boolean(dokazilo.companyId || identiteta.companyId);
  var identitetaImaPosnetek = ["probable_impressum", "confirmed_impressum", "verified_directory"].includes(identiteta.status) &&
    identityEvidenceContract.jePosnetekPrikazljiv(dokazilo);
  if (!identitetaJeUradna && !identitetaImaPosnetek) return false;
  if (faza !== "insolvenca") return true;

  var insolvenca = rezultat.insolvency || {};
  var uradna = insolvenca.officialVerification || {};
  return ["clear", "possible_match"].includes(insolvenca.status) &&
    uradna.evidenceStatus === "captured" &&
    uradna.evidenceVersion === INSOLVENCY_CACHE_VERSION &&
    Boolean(uradna.evidenceImage);
}

function javniPosnetek(job, position) {
  if (!job) return null;
  var zahteva = job.request_payload || {};
  return {
    id: job.id,
    status: job.status,
    faza: job.faza,
    attempts: Number(job.attempts || 0),
    maxAttempts: Number(job.max_attempts || 3),
    position: position || 0,
    cached: Boolean(job.cached),
    reused: Boolean(job.reused),
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    request: {
      ime: String(zahteva.ime || "").slice(0, 240),
      naslov: String(zahteva.naslov || "").slice(0, 140),
      postnaStevilka: String(zahteva.postnaStevilka || "").slice(0, 5),
      spletnaStran: String(zahteva.spletnaStran || "").slice(0, 240),
      kraj: String(zahteva.kraj || "").slice(0, 100),
      registerNumber: String(zahteva.registerNumber || "").slice(0, 120),
      registerCourt: String(zahteva.registerCourt || "").slice(0, 120),
      vatId: String(zahteva.vatId || "").slice(0, 80),
      openRegisterCompanyId: String(zahteva.openRegisterCompanyId || "").slice(0, 120),
      companyIndexSource: String(zahteva.companyIndexSource || "").slice(0, 40),
      uporabiOpenRegisterIdentiteto: Boolean(zahteva.uporabiOpenRegisterIdentiteto),
    },
    result: identityEvidenceContract.obogatiRezultat(job.result_payload || null),
    error: job.last_error || "",
  };
}

async function seznamAktivnih(cfg, userId) {
  var vrstice;
  if (uporabiPomnilnik()) {
    vrstice = Array.from(globalniPomnilnik.jobs.values()).filter(function (job) {
      return job.user_id === userId && ["queued", "processing"].includes(job.status);
    });
  } else {
    var pot = "mehka_boniteta_opravila?user_id=eq." + encodeURIComponent(userId) +
      "&status=in.(queued,processing)&select=id,user_id,faza,status,attempts,max_attempts,request_payload,result_payload,last_error,created_at,updated_at&order=created_at.desc&limit=50";
    var odgovor = await rest(cfg, pot);
    vrstice = Array.isArray(odgovor.data) ? odgovor.data : [];
  }
  return Promise.all(vrstice.map(async function (job) {
    return javniPosnetek(job, await pozicija(cfg, job));
  }));
}

async function rest(cfg, pot, moznosti) {
  var dodatneGlave = Object.assign({ "Content-Type": "application/json" }, moznosti && moznosti.headers || {});
  var glave = cfg && cfg.userToken
    ? Object.assign({
      apikey: cfg.publicKey || cfg.serviceKey,
      Authorization: "Bearer " + cfg.userToken,
      Accept: "application/json",
    }, dodatneGlave)
    : db.serviceHeaders(cfg, dodatneGlave);
  var response = await db.fetchZOmejitvijo(cfg.url + "/rest/v1/" + pot, Object.assign({}, moznosti || {}, {
    headers: glave,
  }), 12000);
  var data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    var err = new Error("Čakalne vrste ni bilo mogoče posodobiti.");
    err.code = "QUEUE_DATABASE_FAILED";
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return { data: data, headers: response.headers };
}

async function najdiPredpomnjeno(cfg, userId, kljuc, faza) {
  var od = new Date(Date.now() - cacheTtlMs(faza)).toISOString();
  var pot = "mehka_boniteta_opravila?user_id=eq." + encodeURIComponent(userId) +
    "&cache_key=eq." + encodeURIComponent(kljuc) +
    "&status=eq.completed&finished_at=gte." + encodeURIComponent(od) +
    "&result_payload=not.is.null&select=result_payload,finished_at&order=finished_at.desc&limit=10";
  var odgovor = await rest(cfg, pot);
  return Array.isArray(odgovor.data) ? odgovor.data.find(function (zapis) {
    return jeRezultatPrimerenZaPredpomnilnik(zapis && zapis.result_payload, faza);
  }) || null : null;
}

async function najdiAktivno(cfg, userId, kljuc) {
  var pot = "mehka_boniteta_opravila?user_id=eq." + encodeURIComponent(userId) +
    "&cache_key=eq." + encodeURIComponent(kljuc) +
    "&status=in.(queued,processing)&select=id,user_id,faza,status,attempts,max_attempts,request_payload,result_payload,last_error,created_at,updated_at&order=created_at.asc&limit=1";
  var odgovor = await rest(cfg, pot);
  return Array.isArray(odgovor.data) && odgovor.data.length ? odgovor.data[0] : null;
}

async function ustvari(cfg, userId, telo) {
  var faza = fazaZahteve(telo);
  var kljuc = cacheKey(telo);
  var zdaj = new Date().toISOString();

  if (uporabiPomnilnik()) {
    var aktivni = Array.from(globalniPomnilnik.jobs.values()).filter(function (job) {
      return job.user_id === userId && job.cache_key === kljuc && ["queued", "processing"].includes(job.status);
    }).sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); })[0];
    if (aktivni) {
      aktivni.reused = true;
      return javniPosnetek(aktivni, izracunajPozicijoPomnilnik(aktivni));
    }
    var najden = telo && telo.recheckMode === "saved_profile" ? null : Array.from(globalniPomnilnik.jobs.values()).filter(function (job) {
      return job.user_id === userId && job.cache_key === kljuc && job.status === "completed" && job.result_payload &&
        Date.now() - new Date(job.finished_at).getTime() <= cacheTtlMs(faza) &&
        jeRezultatPrimerenZaPredpomnilnik(job.result_payload, faza);
    }).sort(function (a, b) { return new Date(b.finished_at) - new Date(a.finished_at); })[0];
    var pomnilniskiJob = {
      id: uuid(), user_id: userId, faza: faza, status: najden ? "completed" : "queued",
      cache_key: kljuc, request_payload: telo, result_payload: najden ? najden.result_payload : null,
      attempts: 0, max_attempts: 3, available_at: zdaj, lease_until: null, claim_token: null,
      last_error: null, created_at: zdaj, updated_at: zdaj,
      started_at: null, finished_at: najden ? zdaj : null, cached: Boolean(najden),
    };
    globalniPomnilnik.jobs.set(pomnilniskiJob.id, pomnilniskiJob);
    return javniPosnetek(pomnilniskiJob, najden ? 0 : izracunajPozicijoPomnilnik(pomnilniskiJob));
  }

  var aktivno = await najdiAktivno(cfg, userId, kljuc);
  if (aktivno) {
    aktivno.reused = true;
    return javniPosnetek(aktivno, await pozicija(cfg, aktivno));
  }
  var cached = telo && telo.recheckMode === "saved_profile" ? null : await najdiPredpomnjeno(cfg, userId, kljuc, faza);
  var zapis = {
    user_id: userId,
    faza: faza,
    status: cached ? "completed" : "queued",
    cache_key: kljuc,
    request_payload: telo,
    result_payload: cached ? cached.result_payload : null,
    finished_at: cached ? zdaj : null,
  };
  var odgovor;
  try {
    odgovor = await rest(cfg, "mehka_boniteta_opravila", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(zapis),
    });
  } catch (error) {
    // Delni unikatni indeks je končna atomarna varovalka. Če dve zahtevi
    // istočasno preideta predhodni SELECT, poraženec ponovno prebere vrstico
    // zmagovalca in ne ustvari drugega plačljivega opravila.
    if (error && error.details && String(error.details.code || "") === "23505") {
      var socasno = await najdiAktivno(cfg, userId, kljuc);
      if (socasno) {
        socasno.reused = true;
        return javniPosnetek(socasno, await pozicija(cfg, socasno));
      }
    }
    throw error;
  }
  var job = odgovor.data && odgovor.data[0];
  if (job) job.cached = Boolean(cached);
  return javniPosnetek(job, cached ? 0 : await pozicija(cfg, job));
}

function izracunajPozicijoPomnilnik(job) {
  if (!job || job.status !== "queued") return 0;
  return Array.from(globalniPomnilnik.jobs.values()).filter(function (vrstica) {
    return vrstica.status === "queued" && new Date(vrstica.created_at) <= new Date(job.created_at);
  }).length;
}

async function pozicija(cfg, job) {
  if (!job || job.status !== "queued") return 0;
  if (uporabiPomnilnik()) return izracunajPozicijoPomnilnik(job);
  var pot = "mehka_boniteta_opravila?status=eq.queued&created_at=lte." +
    encodeURIComponent(job.created_at) + "&select=id";
  var odgovor = await rest(cfg, pot, { headers: { Prefer: "count=exact", Range: "0-0" } });
  var range = String(odgovor.headers.get("content-range") || "");
  var match = range.match(/\/(\d+)$/);
  return match ? Number(match[1]) : 1;
}

async function pridobi(cfg, userId, id) {
  var job;
  if (uporabiPomnilnik()) {
    job = globalniPomnilnik.jobs.get(id) || null;
    if (!job || job.user_id !== userId) return null;
  } else {
    var pot = "mehka_boniteta_opravila?id=eq." + encodeURIComponent(id) +
      "&user_id=eq." + encodeURIComponent(userId) +
      "&select=id,user_id,faza,status,attempts,max_attempts,request_payload,result_payload,last_error,created_at,updated_at";
    var odgovor = await rest(cfg, pot);
    job = Array.isArray(odgovor.data) && odgovor.data.length === 1 ? odgovor.data[0] : null;
  }
  return javniPosnetek(job, await pozicija(cfg, job));
}

async function dopolniNorthDataPodrobnosti(cfg, userId, id, requestProof, northData, details, source) {
  var job;
  if (uporabiPomnilnik()) {
    job = globalniPomnilnik.jobs.get(id) || null;
  } else {
    var prebrano = await rest(cfg, "mehka_boniteta_opravila?id=eq." + encodeURIComponent(id) +
      "&user_id=eq." + encodeURIComponent(userId) +
      "&status=eq.completed&select=id,user_id,faza,status,attempts,max_attempts,request_payload,result_payload,last_error,created_at,updated_at,finished_at&limit=1");
    job = Array.isArray(prebrano.data) && prebrano.data.length === 1 ? prebrano.data[0] : null;
  }
  var result = job && job.result_payload;
  var request = result && result.northDataDetailsRequest;
  if (!job || job.user_id !== userId || job.status !== "completed" || !result ||
      !request || request.status !== "pending" || request.proof !== requestProof) {
    throw Object.assign(new Error("Dopolnilni podatki niso vezani na veljavno zaključeno preverbo."), {
      status: 409,
      code: "NORTHDATA_DETAILS_JOB_MISMATCH",
    });
  }
  var updatedAt = new Date().toISOString();
  var merged = Object.assign({}, result, {
    northData: northData,
    northDataDetails: details,
    northDataDetailsRequest: {
      status: details && details.status === "found" ? "completed" : "unavailable",
      completedAt: updatedAt,
      expiresAt: request.expiresAt || null,
    },
    sources: (Array.isArray(result.sources) ? result.sources : []).filter(function (entry) {
      return entry && entry.id !== "northdata" && entry.id !== "northdata_details";
    }).concat([
      Array.isArray(result.sources) && result.sources.find(function (entry) { return entry && entry.id === "northdata"; }) || null,
      source || null,
    ]).filter(Boolean),
  });
  if (uporabiPomnilnik()) {
    job.result_payload = merged;
    job.updated_at = updatedAt;
  } else {
    var zapis = await rest(cfg, "mehka_boniteta_opravila?id=eq." + encodeURIComponent(id) +
      "&user_id=eq." + encodeURIComponent(userId) + "&status=eq.completed", {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ result_payload: merged, updated_at: updatedAt }),
    });
    job = Array.isArray(zapis.data) && zapis.data.length === 1 ? zapis.data[0] : Object.assign({}, job, {
      result_payload: merged,
      updated_at: updatedAt,
    });
  }
  return javniPosnetek(job, 0);
}

function imaVeljavenUradniInsolvencniRezultat(rezultat) {
  var insolvenca = rezultat && rezultat.insolvency || {};
  var uradna = insolvenca.officialVerification || {};
  return ["clear", "possible_match"].includes(insolvenca.status) &&
    uradna.evidenceStatus === "captured" && Boolean(uradna.evidenceImage);
}

async function pridobiNajnovejseZaProfil(cfg, userId, profile) {
  var jobs;
  if (uporabiPomnilnik() && !(cfg && cfg.forceRemoteQueue)) {
    jobs = Array.from(globalniPomnilnik.jobs.values()).filter(function (job) {
      return job.user_id === userId && job.status === "completed" && job.result_payload &&
        opraviloPripadaProfilu(job, profile) && imaVeljavenUradniInsolvencniRezultat(job.result_payload);
    });
  } else {
    var pot = "mehka_boniteta_opravila?user_id=eq." + encodeURIComponent(userId) +
      "&status=eq.completed&result_payload=not.is.null&select=id,user_id,faza,status,attempts,max_attempts,request_payload,result_payload,last_error,created_at,updated_at,finished_at&order=finished_at.desc&limit=500";
    var odgovor = await rest(cfg, pot);
    jobs = (Array.isArray(odgovor.data) ? odgovor.data : []).filter(function (job) {
      return opraviloPripadaProfilu(job, profile) && imaVeljavenUradniInsolvencniRezultat(job.result_payload);
    });
  }
  jobs.sort(function (a, b) {
    return new Date(b.finished_at || b.updated_at || b.created_at).getTime() - new Date(a.finished_at || a.updated_at || a.created_at).getTime();
  });
  return jobs.length ? javniPosnetek(jobs[0], 0) : null;
}

async function prevzemi(cfg, limit, userId) {
  if (!uporabiPomnilnik()) {
    var rpc = userId
      ? "prevzemi_mehka_boniteta_opravila_za_uporabnika"
      : "prevzemi_mehka_boniteta_opravila";
    var parametri = {
      p_limit: Math.min(Math.max(Number(limit) || 1, 1), MAX_CONCURRENCY),
      p_lease_seconds: DEFAULT_LEASE_SECONDS,
    };
    if (userId) parametri.p_user_id = userId;
    var rows = await db.pokliciRpc(cfg, rpc, parametri);
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }

  var zdaj = Date.now();
  Array.from(globalniPomnilnik.jobs.values()).forEach(function (job) {
    if (job.status === "processing" && new Date(job.lease_until).getTime() < zdaj) {
      var izcrpano = job.attempts >= job.max_attempts;
      job.status = izcrpano ? "failed" : "queued";
      job.available_at = izcrpano ? job.available_at : new Date(zdaj + Math.min(120000, 10000 * Math.pow(2, Math.max(0, job.attempts - 1)))).toISOString();
      job.claim_token = null;
      job.lease_until = null;
      job.last_error = job.last_error || "Čas obdelave je potekel.";
      job.finished_at = izcrpano ? new Date(zdaj).toISOString() : null;
      job.updated_at = new Date().toISOString();
      if (izcrpano) ustvariUskladitvePomnilnik(job, false, job.result_payload);
    }
  });
  var aktivneVrstice = Array.from(globalniPomnilnik.jobs.values()).filter(function (job) {
    return job.status === "processing" && new Date(job.lease_until).getTime() >= zdaj;
  });
  var aktivna = aktivneVrstice.length;
  var aktivnaInsolvenca = aktivneVrstice.filter(function (job) { return job.faza === "insolvenca"; }).length;
  var st = Math.min(Math.max(Number(limit) || 1, 1), MAX_CONCURRENCY, Math.max(0, MAX_CONCURRENCY - aktivna));
  var kandidati = Array.from(globalniPomnilnik.jobs.values()).filter(function (job) {
    return job.status === "queued" && new Date(job.available_at).getTime() <= zdaj &&
      (!userId || job.user_id === userId);
  }).sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
  var izbrana = [];
  var izbranaInsolvenca = 0;
  kandidati.some(function (job) {
    if (izbrana.length >= st) return true;
    if (job.faza === "insolvenca" && aktivnaInsolvenca + izbranaInsolvenca >= MAX_INSOLVENCY_CONCURRENCY) return false;
    izbrana.push(job);
    if (job.faza === "insolvenca") izbranaInsolvenca += 1;
    return false;
  });
  izbrana.forEach(function (job) {
    job.status = "processing";
    job.attempts += 1;
    job.claim_token = uuid();
    job.lease_until = new Date(zdaj + DEFAULT_LEASE_SECONDS * 1000).toISOString();
    job.started_at = job.started_at || new Date().toISOString();
    job.updated_at = new Date().toISOString();
  });
  return izbrana;
}

function napakaIzgubljenegaNajema() {
  var err = new Error("Opravilo ni več v lasti tega delavca.");
  err.code = "QUEUE_LEASE_LOST";
  return err;
}

function prvaVrstica(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

async function podaljsajNajem(cfg, job, leaseSeconds) {
  var sekunde = Math.min(Math.max(Number(leaseSeconds) || DEFAULT_LEASE_SECONDS, 30), 180);
  if (!job || !job.id || !job.claim_token) throw napakaIzgubljenegaNajema();
  if (!uporabiPomnilnik()) {
    var remote = prvaVrstica(await db.pokliciRpc(cfg, "podaljsaj_mehka_boniteta_najem", {
      p_id: job.id,
      p_claim_token: job.claim_token,
      p_lease_seconds: sekunde,
    }));
    if (!remote || !remote.id) throw napakaIzgubljenegaNajema();
    job.lease_until = remote.lease_until;
    return remote;
  }
  var shranjen = globalniPomnilnik.jobs.get(job.id);
  var zdaj = Date.now();
  if (!shranjen || shranjen.status !== "processing" || shranjen.claim_token !== job.claim_token ||
      !shranjen.lease_until || new Date(shranjen.lease_until).getTime() < zdaj) {
    throw napakaIzgubljenegaNajema();
  }
  shranjen.lease_until = new Date(zdaj + sekunde * 1000).toISOString();
  shranjen.updated_at = new Date(zdaj).toISOString();
  job.lease_until = shranjen.lease_until;
  return shranjen;
}

function ustvariUskladitvePomnilnik(job, success, result) {
  if (!job || !["completed", "failed"].includes(job.status)) return;
  [
    { kind: "project_monitor", target: job.project_monitor_id },
    { kind: "financial_recheck", target: job.financial_recheck_id },
  ].forEach(function (entry) {
    if (!entry.target) return;
    var key = job.id + ":" + entry.kind;
    if (globalniPomnilnik.reconciliations.has(key)) return;
    var zdaj = new Date().toISOString();
    globalniPomnilnik.reconciliations.set(key, {
      id: uuid(), job_id: job.id, user_id: job.user_id, kind: entry.kind, success: Boolean(success),
      result_payload: result || null, request_payload: job.request_payload || {},
      project_monitor_id: job.project_monitor_id || null,
      financial_recheck_id: job.financial_recheck_id || null,
      status: "pending", attempts: 0, available_at: zdaj, lease_until: null,
      claim_token: null, last_error: null, created_at: zdaj, updated_at: zdaj,
      finished_at: null,
    });
  });
}

async function zakljuci(cfg, job, moznosti) {
  if (!uporabiPomnilnik()) {
    return db.pokliciRpc(cfg, "zakljuci_mehka_boniteta_opravilo", {
      p_id: job.id,
      p_claim_token: job.claim_token,
      p_success: Boolean(moznosti.success),
      p_result: moznosti.result || null,
      p_error: moznosti.error || null,
      p_retryable: Boolean(moznosti.retryable),
    });
  }
  var shranjen = globalniPomnilnik.jobs.get(job.id);
  if (!shranjen || shranjen.claim_token !== job.claim_token || shranjen.status !== "processing") {
    throw new Error("Opravilo ni več v lasti tega delavca.");
  }
  var ponovi = !moznosti.success && moznosti.retryable && shranjen.attempts < shranjen.max_attempts;
  shranjen.status = moznosti.success ? "completed" : ponovi ? "queued" : "failed";
  shranjen.result_payload = moznosti.result || shranjen.result_payload;
  shranjen.last_error = moznosti.error || null;
  shranjen.available_at = ponovi
    ? new Date(Date.now() + Math.min(120000, 10000 * Math.pow(2, Math.max(0, shranjen.attempts - 1)))).toISOString()
    : shranjen.available_at;
  shranjen.lease_until = null;
  shranjen.claim_token = null;
  shranjen.finished_at = ponovi ? null : new Date().toISOString();
  shranjen.updated_at = new Date().toISOString();
  if (!ponovi) ustvariUskladitvePomnilnik(shranjen, shranjen.status === "completed", shranjen.result_payload);
  return shranjen;
}

async function prevzemiZakljuckeZaUskladitev(cfg, limit, jobId) {
  var omejitev = Math.min(Math.max(Number(limit) || 1, 1), 10);
  if (!uporabiPomnilnik()) {
    var rows = await db.pokliciRpc(cfg, "prevzemi_boniteta_zakljucke_za_uskladitev", {
      p_limit: omejitev,
      p_lease_seconds: 60,
      p_job_id: jobId || null,
    });
    return Array.isArray(rows) ? rows : rows ? [rows] : [];
  }
  var zdaj = Date.now();
  Array.from(globalniPomnilnik.reconciliations.values()).forEach(function (entry) {
    if (entry.status === "processing" && new Date(entry.lease_until).getTime() < zdaj) {
      entry.status = "pending";
      entry.available_at = new Date(zdaj).toISOString();
      entry.lease_until = null;
      entry.claim_token = null;
      entry.updated_at = new Date(zdaj).toISOString();
    }
  });
  var kandidati = Array.from(globalniPomnilnik.reconciliations.values()).filter(function (entry) {
    return entry.status === "pending" && new Date(entry.available_at).getTime() <= zdaj &&
      (!jobId || entry.job_id === jobId);
  }).sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); }).slice(0, omejitev);
  kandidati.forEach(function (entry) {
    entry.status = "processing";
    entry.attempts += 1;
    entry.claim_token = uuid();
    entry.lease_until = new Date(zdaj + 60000).toISOString();
    entry.updated_at = new Date(zdaj).toISOString();
  });
  return kandidati;
}

async function zakljuciUskladitev(cfg, entry, success, error) {
  if (!entry || !entry.id || !entry.claim_token) throw napakaIzgubljenegaNajema();
  if (!uporabiPomnilnik()) {
    var remote = prvaVrstica(await db.pokliciRpc(cfg, "zakljuci_boniteta_uskladitev", {
      p_id: entry.id,
      p_claim_token: entry.claim_token,
      p_success: Boolean(success),
      p_error: error || null,
    }));
    if (!remote || !remote.id) throw napakaIzgubljenegaNajema();
    return remote;
  }
  var shranjen = Array.from(globalniPomnilnik.reconciliations.values()).find(function (candidate) {
    return candidate.id === entry.id;
  });
  if (!shranjen || shranjen.status !== "processing" || shranjen.claim_token !== entry.claim_token) {
    throw napakaIzgubljenegaNajema();
  }
  var zdaj = Date.now();
  shranjen.status = success ? "completed" : "pending";
  shranjen.available_at = success ? shranjen.available_at : new Date(zdaj + Math.min(900000, 10000 * Math.pow(2, Math.min(6, Math.max(0, shranjen.attempts - 1))))).toISOString();
  shranjen.lease_until = null;
  shranjen.claim_token = null;
  shranjen.last_error = success ? null : String(error || "Uskladitev ni uspela.").slice(0, 500);
  if (success) {
    shranjen.result_payload = null;
    shranjen.request_payload = {};
  }
  shranjen.finished_at = success ? new Date(zdaj).toISOString() : null;
  shranjen.updated_at = new Date(zdaj).toISOString();
  return shranjen;
}

async function izvediUskladitev(cfg, entry, finishSuccess, finishResult) {
  if (!entry || !entry.id || !entry.claim_token) throw napakaIzgubljenegaNajema();
  if (uporabiPomnilnik()) return zakljuciUskladitev(cfg, entry, true, null);
  var remote = prvaVrstica(await db.pokliciRpc(cfg, "izvedi_boniteta_uskladitev", {
    p_id: entry.id,
    p_claim_token: entry.claim_token,
    p_success: Boolean(finishSuccess),
    p_result: finishResult || null,
  }));
  if (!remote || !remote.id) throw napakaIzgubljenegaNajema();
  return remote;
}

function spletniKljuc(vrednost) {
  var raw = String(vrednost || "").trim();
  if (!raw) return "";
  try {
    var parsed = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
    var host = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    var pathname = String(parsed.pathname || "").replace(/\/+$/, "");
    return host + pathname.toLowerCase();
  } catch (_) {
    return normaliziraj(raw).replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[?#]/)[0].replace(/\/+$/, "");
  }
}

function spletniGostitelj(vrednost) {
  var raw = String(vrednost || "").trim();
  if (!raw) return "";
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw)
      .hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch (_) {
    return spletniKljuc(raw).split("/")[0];
  }
}

// To je namenoma samo lokalno razvojno čistilo. Omogoča, da po popravku
// zajema odstranimo že izrisan star posnetek tudi takrat, ko uporabnik še ni
// potrdil podjetja in zato zanj še ne obstaja profil v zavihku »Moja podjetja«.
function izbrisiLokalnaOpravilaPoDomeni(vrednost) {
  if (!uporabiPomnilnik()) return 0;
  var gostitelj = spletniGostitelj(vrednost);
  if (!gostitelj) return 0;
  var izbrisanih = 0;
  Array.from(globalniPomnilnik.jobs.entries()).forEach(function (entry) {
    var job = entry[1] || {};
    var request = job.request_payload || {};
    var result = job.result_payload || {};
    var identity = result.identity || {};
    var evidence = result.identityEvidence || {};
    var profile = result.publicProfile || {};
    var kandidati = [request.spletnaStran, identity.sourceUrl, evidence.sourceUrl, profile.sourceUrl];
    if (kandidati.some(function (url) { return spletniGostitelj(url) === gostitelj; })) {
      globalniPomnilnik.jobs.delete(entry[0]);
      izbrisanih += 1;
    }
  });
  return izbrisanih;
}

function pridobiLokalnaOpravilaPoDomeni(vrednost) {
  if (!uporabiPomnilnik()) return [];
  var gostitelj = spletniGostitelj(vrednost);
  if (!gostitelj) return [];
  return Array.from(globalniPomnilnik.jobs.values()).filter(function (job) {
    var request = job && job.request_payload || {};
    var result = job && job.result_payload || {};
    var identity = result.identity || {};
    var evidence = result.identityEvidence || {};
    var profile = result.publicProfile || {};
    return [request.spletnaStran, identity.sourceUrl, evidence.sourceUrl, profile.sourceUrl]
      .some(function (url) { return spletniGostitelj(url) === gostitelj; });
  }).map(function (job) {
    var request = job && job.request_payload || {};
    return {
      id: job.id,
      status: job.status,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      requestWebsite: String(request.spletnaStran || ""),
      requestOpenRegister: request.uporabiOpenRegisterIdentiteto !== false,
      result: job.result_payload || null,
    };
  });
}

function vrednosti(source, keys) {
  var object = source && typeof source === "object" ? source : {};
  return keys.map(function (key) { return normaliziraj(object[key]); }).filter(Boolean);
}

function registrskaIdentiteta(vrednost) {
  var besedilo = normaliziraj(vrednost);
  if (!besedilo) return null;
  var ujemanje = besedilo.match(/\b(hra|hrb|gnr|pr|vr)\s*[-.:]?\s*([a-z0-9][a-z0-9\s./-]*)/i);
  var vrsta = ujemanje ? ujemanje[1] : "";
  var stevilka = (ujemanje ? ujemanje[2] : besedilo).replace(/[^a-z0-9]/g, "");
  return stevilka ? { vrsta: vrsta, stevilka: stevilka } : null;
}

function registrskeIdentitete(sources) {
  return sources.reduce(function (seznam, source) {
    vrednosti(source, ["registerNumber", "register_number"]).forEach(function (vrednost) {
      var identiteta = registrskaIdentiteta(vrednost);
      if (identiteta) seznam.push(identiteta);
    });
    return seznam;
  }, []);
}

function enakaRegistrskaIdentiteta(prva, druga) {
  return prva.stevilka === druga.stevilka && (!prva.vrsta || !druga.vrsta || prva.vrsta === druga.vrsta);
}

function opraviloPripadaProfilu(job, profile) {
  var request = job && job.request_payload || {};
  var result = job && job.result_payload || {};
  var confirmed = request.confirmedIdentity || {};
  var identity = result.identity || {};
  var evidence = result.identityEvidence || {};
  var address = profile && profile.address || {};
  var contact = profile && profile.contact || {};
  var latest = profile && profile.latest_check || {};
  var profileInsolvency = latest.insolvency || {};
  var profileOfficial = profileInsolvency.officialVerification || {};
  var profileFields = profileOfficial.inputVerification && profileOfficial.inputVerification.fields || {};
  var jobInsolvency = result.insolvency || {};
  var jobOfficial = jobInsolvency.officialVerification || {};
  var jobFields = jobOfficial.inputVerification && jobOfficial.inputVerification.fields || {};
  var knownJobIds = [].concat(latest.queueJobIds || [], latest.queue_job_ids || [], latest.queueJobId || [], latest.queue_job_id || [])
    .map(String).filter(Boolean);

  var profileCompanyId = normaliziraj(profile && profile.company_id);
  var jobCompanyIds = vrednosti(confirmed, ["companyId", "company_id"])
    .concat(vrednosti(identity, ["companyId", "company_id"]))
    .concat(vrednosti(evidence, ["companyId", "company_id"]))
    .concat(vrednosti(result, ["companyId", "company_id"]));
  if (profileCompanyId && jobCompanyIds.length && !jobCompanyIds.includes(profileCompanyId)) return false;

  var profileRegisters = registrskeIdentitete([profile, profileInsolvency, profileOfficial]);
  var jobRegisters = registrskeIdentitete([request, confirmed, identity, evidence, result, jobInsolvency, jobOfficial]);
  if (!(profileCompanyId && jobCompanyIds.length) && profileRegisters.length && jobRegisters.length &&
      !profileRegisters.some(function (profileRegister) {
        return jobRegisters.some(function (jobRegister) { return enakaRegistrskaIdentiteta(profileRegister, jobRegister); });
      })) return false;

  if (knownJobIds.includes(String(job && job.id || ""))) return true;
  if (profileCompanyId && jobCompanyIds.includes(profileCompanyId)) return true;

  var profileDomain = spletniKljuc(contact.website);
  var jobDomains = [request.spletnaStran, confirmed.website, identity.website, evidence.website]
    .map(spletniKljuc).filter(Boolean);
  if (profileDomain && jobDomains.includes(profileDomain)) return true;

  var profileNames = vrednosti(profile, ["legal_name"])
    .concat(vrednosti(profileInsolvency, ["searchedName", "searched_name"]))
    .concat(vrednosti(profileOfficial, ["searchedName", "searched_name"]))
    .concat([
      normaliziraj([profileFields.ime, profileFields.firmaPriimek].filter(Boolean).join(" ")),
      normaliziraj([profileFields.firmaPriimek, profileFields.ime].filter(Boolean).join(" ")),
    ]).filter(Boolean);
  if (!profileNames.length) return false;
  var jobNames = vrednosti(request, ["ime", "legalName", "legal_name"])
    .concat(vrednosti(confirmed, ["name", "businessName", "legalName", "legal_name"]))
    .concat(vrednosti(identity, ["ime", "naziv", "name", "legalName", "legal_name"]))
    .concat(vrednosti(evidence, ["ime", "naziv", "name", "legalName", "legal_name"]))
    .concat(vrednosti(jobInsolvency, ["searchedName", "searched_name"]))
    .concat(vrednosti(jobOfficial, ["searchedName", "searched_name"]))
    .concat([
      normaliziraj([jobFields.ime, jobFields.firmaPriimek].filter(Boolean).join(" ")),
      normaliziraj([jobFields.firmaPriimek, jobFields.ime].filter(Boolean).join(" ")),
    ]).filter(Boolean);
  if (!profileNames.some(function (name) { return jobNames.includes(name); })) return false;

  var profilePostal = normaliziraj(address.postal_code || address.postalCode || profileInsolvency.searchedPostalCode || profileFields.postnaStevilka);
  var jobPostals = vrednosti(request, ["postnaStevilka", "postalCode", "postal_code"])
    .concat(vrednosti(confirmed, ["postalCode", "postal_code"]))
    .concat(vrednosti(identity, ["postnaStevilka", "postalCode", "postal_code"]))
    .concat(vrednosti(evidence, ["postnaStevilka", "postalCode", "postal_code"]))
    .concat(vrednosti(jobInsolvency, ["searchedPostalCode", "searched_postal_code"]))
    .concat(vrednosti(jobFields, ["postnaStevilka", "postalCode", "postal_code"]));
  if (profilePostal && jobPostals.includes(profilePostal)) return true;

  var profileStreet = normaliziraj(address.street || address.address);
  var jobStreets = vrednosti(request, ["naslov", "street", "address"])
    .concat(vrednosti(confirmed, ["street", "address"]))
    .concat(vrednosti(identity, ["naslov", "street", "address"]))
    .concat(vrednosti(evidence, ["naslov", "street", "address"]));
  return profileStreet.length >= 5 && jobStreets.includes(profileStreet);
}

async function izbrisiPodatkeProfila(cfg, userId, profile) {
  if (!userId || !profile) throw Object.assign(new Error("Manjkajo podatki za popoln izbris preverbe."), { status: 400 });
  if (uporabiPomnilnik()) {
    var removed = 0;
    Array.from(globalniPomnilnik.jobs.entries()).forEach(function (entry) {
      var job = entry[1];
      if (job.user_id === userId && opraviloPripadaProfilu(job, profile)) {
        globalniPomnilnik.jobs.delete(entry[0]);
        removed += 1;
      }
    });
    return removed;
  }
  if (!cfg || (!cfg.userToken && cfg.isService !== true)) {
    throw Object.assign(new Error("Popoln izbris preverbe zahteva veljavno uporabniško ali strežniško povezavo."), { status: 503, code: "SERVER_NOT_CONFIGURED" });
  }

  var jobs = [];
  var offset = 0;
  var pageSize = 1000;
  while (true) {
    var pot = "mehka_boniteta_opravila?user_id=eq." + encodeURIComponent(userId) +
      "&select=id,user_id,request_payload,result_payload&order=created_at.desc&limit=" + pageSize + "&offset=" + offset;
    var page = await rest(cfg, pot);
    var rows = Array.isArray(page.data) ? page.data : [];
    jobs = jobs.concat(rows.filter(function (job) { return opraviloPripadaProfilu(job, profile); }));
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  for (var start = 0; start < jobs.length; start += 100) {
    var ids = jobs.slice(start, start + 100).map(function (job) { return job.id; });
    await rest(cfg, "mehka_boniteta_opravila?user_id=eq." + encodeURIComponent(userId) +
      "&id=in.(" + ids.map(encodeURIComponent).join(",") + ")", {
      method: "DELETE", headers: { Prefer: "return=minimal" },
    });
  }
  return jobs.length;
}

async function izbrisiOpravilo(cfg, userId, id) {
  if (!userId || !/^[0-9a-f-]{32,36}$/i.test(String(id || ""))) {
    throw Object.assign(new Error("Manjka veljavno preverjanje za izbris."), { status: 400 });
  }
  if (uporabiPomnilnik()) {
    var job = globalniPomnilnik.jobs.get(String(id)) || null;
    if (!job || job.user_id !== userId) return 0;
    var izbrisanih = 0;
    Array.from(globalniPomnilnik.jobs.entries()).forEach(function (entry) {
      var kandidat = entry[1];
      if (kandidat.user_id === userId && opraviloImaEnakVnos(kandidat, job)) {
        globalniPomnilnik.jobs.delete(entry[0]);
        izbrisanih += 1;
      }
    });
    return izbrisanih;
  }
  if (!cfg || (!cfg.userToken && cfg.isService !== true)) {
    throw Object.assign(new Error("Izbris preverbe zahteva veljavno uporabniško ali strežniško povezavo."), { status: 503, code: "SERVER_NOT_CONFIGURED" });
  }
  var ciljOdgovor = await rest(cfg, "mehka_boniteta_opravila?id=eq." + encodeURIComponent(id) +
    "&user_id=eq." + encodeURIComponent(userId) + "&select=id,user_id,request_payload&limit=1");
  var cilj = Array.isArray(ciljOdgovor.data) && ciljOdgovor.data.length === 1 ? ciljOdgovor.data[0] : null;
  if (!cilj) return 0;
  var vseVrstice = [];
  var offset = 0;
  while (true) {
    var vse = await rest(cfg, "mehka_boniteta_opravila?user_id=eq." + encodeURIComponent(userId) +
      "&select=id,user_id,request_payload&order=created_at.desc&limit=1000&offset=" + offset);
    var stranVrstic = Array.isArray(vse.data) ? vse.data : [];
    vseVrstice = vseVrstice.concat(stranVrstic);
    if (stranVrstic.length < 1000) break;
    offset += 1000;
  }
  var ids = vseVrstice.filter(function (kandidat) {
    return opraviloImaEnakVnos(kandidat, cilj);
  }).map(function (kandidat) { return kandidat.id; });
  for (var start = 0; start < ids.length; start += 100) {
    await rest(cfg, "mehka_boniteta_opravila?user_id=eq." + encodeURIComponent(userId) +
      "&id=in.(" + ids.slice(start, start + 100).map(encodeURIComponent).join(",") + ")", {
      method: "DELETE", headers: { Prefer: "return=minimal" },
    });
  }
  return ids.length;
}

function opraviloImaEnakVnos(a, b) {
  var prvi = a && a.request_payload || {};
  var drugi = b && b.request_payload || {};
  var prviRegisterId = normaliziraj(prvi.openRegisterCompanyId);
  var drugiRegisterId = normaliziraj(drugi.openRegisterCompanyId);
  if (prviRegisterId || drugiRegisterId) return Boolean(prviRegisterId && drugiRegisterId && prviRegisterId === drugiRegisterId);
  var prviRegister = [prvi.registerNumber, prvi.registerCourt].map(normaliziraj).join("|");
  var drugiRegister = [drugi.registerNumber, drugi.registerCourt].map(normaliziraj).join("|");
  if (prviRegister !== "|" || drugiRegister !== "|") return prviRegister !== "|" && prviRegister === drugiRegister;
  var prviUrl = spletniKljuc(prvi.spletnaStran);
  var drugiUrl = spletniKljuc(drugi.spletnaStran);
  if (prviUrl || drugiUrl) return Boolean(prviUrl && drugiUrl && prviUrl === drugiUrl);
  return ["ime", "naslov", "postnaStevilka", "kraj"].every(function (kljuc) {
    return normaliziraj(prvi[kljuc]) === normaliziraj(drugi[kljuc]);
  });
}

function ponastaviPomnilnik() {
  globalniPomnilnik.jobs.clear();
  globalniPomnilnik.reconciliations.clear();
}

module.exports = {
  fazaZahteve: fazaZahteve,
  cacheKey: cacheKey,
  ustvari: ustvari,
  pridobi: pridobi,
  dopolniNorthDataPodrobnosti: dopolniNorthDataPodrobnosti,
  pridobiNajnovejseZaProfil: pridobiNajnovejseZaProfil,
  seznamAktivnih: seznamAktivnih,
  prevzemi: prevzemi,
  podaljsajNajem: podaljsajNajem,
  zakljuci: zakljuci,
  prevzemiZakljuckeZaUskladitev: prevzemiZakljuckeZaUskladitev,
  izvediUskladitev: izvediUskladitev,
  zakljuciUskladitev: zakljuciUskladitev,
  izbrisiOpravilo: izbrisiOpravilo,
  izbrisiPodatkeProfila: izbrisiPodatkeProfila,
  izbrisiLokalnaOpravilaPoDomeni: izbrisiLokalnaOpravilaPoDomeni,
  pridobiLokalnaOpravilaPoDomeni: pridobiLokalnaOpravilaPoDomeni,
  _test: {
    CACHE_VERSION: CACHE_VERSION,
    INSOLVENCY_CACHE_VERSION: INSOLVENCY_CACHE_VERSION,
    NORTHDATA_ENRICHMENT_VERSION: NORTHDATA_ENRICHMENT_VERSION,
    razlicicaDostopaDoVirov: razlicicaDostopaDoVirov,
    MAX_CONCURRENCY: MAX_CONCURRENCY,
    MAX_INSOLVENCY_CONCURRENCY: MAX_INSOLVENCY_CONCURRENCY,
    DEFAULT_LEASE_SECONDS: DEFAULT_LEASE_SECONDS,
    ponastaviPomnilnik: ponastaviPomnilnik,
    pomnilnik: globalniPomnilnik,
    izracunajPozicijoPomnilnik: izracunajPozicijoPomnilnik,
    najdiAktivno: najdiAktivno,
    opraviloPripadaProfilu: opraviloPripadaProfilu,
    imaVeljavenUradniInsolvencniRezultat: imaVeljavenUradniInsolvencniRezultat,
    opraviloImaEnakVnos: opraviloImaEnakVnos,
    jeRezultatPrimerenZaPredpomnilnik: jeRezultatPrimerenZaPredpomnilnik,
    spletniGostitelj: spletniGostitelj,
    napakaIzgubljenegaNajema: napakaIzgubljenegaNajema,
  },
};
