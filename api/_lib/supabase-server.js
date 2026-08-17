"use strict";

function omejenCas(value, fallback) {
  var number = Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(number, 1000), 30000) : fallback;
}

async function fetchZOmejitvijo(url, options, timeoutMs) {
  var opts = Object.assign({}, options || {});
  if (!opts.signal && typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    opts.signal = AbortSignal.timeout(omejenCas(timeoutMs, 12000));
  }
  return fetch(url, opts);
}

function konfiguracija() {
  var url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  var serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !serviceKey) {
    var err = new Error("Supabase strežniška konfiguracija manjka.");
    err.code = "SERVER_NOT_CONFIGURED";
    throw err;
  }
  return { url: url, serviceKey: serviceKey, isService: true };
}

function uporabniskaKonfiguracija() {
  var url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  var publicKey = String(process.env.SUPABASE_ANON_KEY || "");
  if (!url || !publicKey) {
    var err = new Error("Supabase javna strežniška konfiguracija manjka.");
    err.code = "SERVER_NOT_CONFIGURED";
    throw err;
  }
  return { url: url, serviceKey: publicKey, publicKey: publicKey, isService: false };
}

function serviceHeaders(cfg, dodatno) {
  return Object.assign({
    apikey: cfg.serviceKey,
    Authorization: "Bearer " + cfg.serviceKey,
    Accept: "application/json",
  }, dodatno || {});
}

function bearerToken(req) {
  var header = String((req.headers && req.headers.authorization) || "");
  var match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function pocakaj(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function jePrehodniAuthStatus(status) {
  return status === 429 || status >= 500;
}

function jeTimeoutNapaka(err) {
  return Boolean(err && (err.name === "TimeoutError" || err.name === "AbortError"));
}

async function preveriUporabnika(req, cfg) {
  var token = bearerToken(req);
  if (!token) {
    return { ok: false, status: 401, code: "AUTH_TOKEN_MISSING", retryable: false, napaka: "Prijava je potekla. Prijavite se znova." };
  }

  var zamiki = Array.isArray(cfg.authRetryDelays) ? cfg.authRetryDelays : [250, 750];
  var zadnjaNapaka = null;
  var odgovor = null;
  for (var poskus = 0; poskus <= zamiki.length; poskus += 1) {
    try {
      odgovor = await fetchZOmejitvijo(cfg.url + "/auth/v1/user", {
        headers: {
          apikey: cfg.serviceKey,
          Authorization: "Bearer " + token,
        },
      }, 10000);
      if (!jePrehodniAuthStatus(odgovor.status) || poskus === zamiki.length) break;
    } catch (err) {
      zadnjaNapaka = err;
      odgovor = null;
      if (poskus === zamiki.length) break;
    }
    await pocakaj(zamiki[poskus]);
  }

  if (!odgovor) {
    var timeout = jeTimeoutNapaka(zadnjaNapaka);
    return {
      ok: false,
      status: timeout ? 504 : 502,
      code: timeout ? "AUTH_TIMEOUT" : "AUTH_SERVER_UNAVAILABLE",
      retryable: true,
      napaka: "Povezava s prijavnim strežnikom je začasno prekinjena. Sistem je poskusil ponovno; poskusite še enkrat čez nekaj trenutkov.",
    };
  }

  if (!odgovor.ok) {
    if (jePrehodniAuthStatus(odgovor.status)) {
      return {
        ok: false,
        status: odgovor.status === 429 ? 503 : 502,
        code: "AUTH_SERVER_UNAVAILABLE",
        retryable: true,
        napaka: "Povezava s prijavnim strežnikom je začasno prekinjena. Sistem je poskusil ponovno; poskusite še enkrat čez nekaj trenutkov.",
      };
    }
    return { ok: false, status: 401, code: "AUTH_SESSION_INVALID", retryable: false, napaka: "Prijava ni več veljavna." };
  }

  var user = await odgovor.json();
  if (!user || !user.id) {
    return { ok: false, status: 401, code: "AUTH_USER_INVALID", retryable: false, napaka: "Uporabnik ni prepoznan." };
  }
  return { ok: true, user: user, token: token };
}

async function preberiZadevo(cfg, zadevaId) {
  var url = cfg.url + "/rest/v1/zadeve?id=eq." + encodeURIComponent(zadevaId) +
    "&select=id,obrtnik_id,telefon_dolznika,ime_dolznika,opis_dolga,status," +
    "znesek,prvotni_znesek,preostali_dolg,placano_skupaj,poravnano_at," +
    "email_dolznika,stevilka_racuna,datum_zapadlosti,opomin_nacrt";
  var response = await fetchZOmejitvijo(url, { headers: serviceHeaders(cfg) }, 12000);
  if (!response.ok) {
    var err = new Error("Zadeve ni bilo mogoče prebrati.");
    err.code = "DATABASE_READ_FAILED";
    throw err;
  }
  var rows = await response.json();
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

async function pridobiVrstice(cfg, tabela, poizvedbaQS) {
  var url = cfg.url + "/rest/v1/" + tabela + "?" + poizvedbaQS;
  var response = await fetchZOmejitvijo(url, { headers: serviceHeaders(cfg) }, 12000);
  if (!response.ok) {
    var err = new Error("Podatkov iz " + tabela + " ni bilo mogoče prebrati.");
    err.code = "DATABASE_READ_FAILED";
    err.status = response.status;
    throw err;
  }
  var rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function pokliciRpc(cfg, ime, telo) {
  var response = await fetchZOmejitvijo(cfg.url + "/rest/v1/rpc/" + encodeURIComponent(ime), {
    method: "POST",
    headers: serviceHeaders(cfg, { "Content-Type": "application/json" }),
    body: JSON.stringify(telo || {}),
  }, 12000);
  var data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    var err = new Error("Podatkovna operacija ni uspela.");
    err.code = "DATABASE_RPC_FAILED";
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return data;
}

module.exports = {
  konfiguracija: konfiguracija,
  uporabniskaKonfiguracija: uporabniskaKonfiguracija,
  serviceHeaders: serviceHeaders,
  bearerToken: bearerToken,
  preveriUporabnika: preveriUporabnika,
  preberiZadevo: preberiZadevo,
  pridobiVrstice: pridobiVrstice,
  pokliciRpc: pokliciRpc,
  fetchZOmejitvijo: fetchZOmejitvijo,
  _test: {
    omejenCas: omejenCas,
    jePrehodniAuthStatus: jePrehodniAuthStatus,
    jeTimeoutNapaka: jeTimeoutNapaka,
  },
};
