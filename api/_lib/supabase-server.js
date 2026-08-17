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

async function preveriUporabnika(req, cfg) {
  var token = bearerToken(req);
  if (!token) {
    return { ok: false, status: 401, napaka: "Prijava je potekla. Prijavite se znova." };
  }

  var odgovor;
  try {
    odgovor = await fetchZOmejitvijo(cfg.url + "/auth/v1/user", {
      headers: {
        apikey: cfg.serviceKey,
        Authorization: "Bearer " + token,
      },
    }, 10000);
  } catch (err) {
    return {
      ok: false,
      status: err && (err.name === "TimeoutError" || err.name === "AbortError") ? 504 : 502,
      napaka: err && (err.name === "TimeoutError" || err.name === "AbortError")
        ? "Preverjanje prijave je trajalo predolgo. Poskusite ponovno."
        : "Avtorizacijski strežnik ni dosegljiv.",
    };
  }

  if (!odgovor.ok) {
    return { ok: false, status: 401, napaka: "Prijava ni več veljavna." };
  }

  var user = await odgovor.json();
  if (!user || !user.id) {
    return { ok: false, status: 401, napaka: "Uporabnik ni prepoznan." };
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
  _test: { omejenCas: omejenCas },
};
