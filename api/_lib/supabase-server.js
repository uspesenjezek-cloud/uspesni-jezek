"use strict";

var authJwksPoUrl = new Map();
var josePromise = null;

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

function naloziJose() {
  if (!josePromise) josePromise = import("jose");
  return josePromise;
}

async function pridobiAuthJwks(cfg, jose) {
  if (cfg.authJwks) return cfg.authJwks;
  var jwksUrl = cfg.url + "/auth/v1/.well-known/jwks.json";
  if (!authJwksPoUrl.has(jwksUrl)) {
    authJwksPoUrl.set(jwksUrl, jose.createRemoteJWKSet(new URL(jwksUrl), {
      timeoutDuration: 3000,
      cooldownDuration: 30000,
      cacheMaxAge: 10 * 60 * 1000,
    }));
  }
  return authJwksPoUrl.get(jwksUrl);
}

function jeNeveljavnaJwtNapaka(err) {
  return Boolean(err && [
    "ERR_JOSE_ALG_NOT_ALLOWED",
    "ERR_JWS_INVALID",
    "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
    "ERR_JWT_CLAIM_VALIDATION_FAILED",
    "ERR_JWT_EXPIRED",
    "ERR_JWT_INVALID",
    "ERR_JWKS_NO_MATCHING_KEY",
    "ERR_JWKS_MULTIPLE_MATCHING_KEYS",
  ].includes(err.code));
}

async function preveriJwtLokalno(token, cfg) {
  var jose = await naloziJose();
  var glava = jose.decodeProtectedHeader(token);
  if (glava.alg === "HS256") {
    var legacyErr = new Error("Stari simetrično podpisani JWT potrebuje osvežitev seje.");
    legacyErr.code = "AUTH_LEGACY_TOKEN";
    throw legacyErr;
  }
  var jwks = await pridobiAuthJwks(cfg, jose);
  var preverjeno = await jose.jwtVerify(token, jwks, {
    issuer: cfg.url + "/auth/v1",
    audience: "authenticated",
    algorithms: ["ES256"],
    clockTolerance: 30,
  });
  var payload = preverjeno && preverjeno.payload || {};
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(payload.sub || ""))) {
    var err = new Error("JWT nima veljavnega uporabniškega identifikatorja.");
    err.code = "ERR_JWT_INVALID";
    throw err;
  }
  return {
    id: payload.sub,
    email: typeof payload.email === "string" ? payload.email : "",
    role: payload.role,
    app_metadata: payload.app_metadata && typeof payload.app_metadata === "object" ? payload.app_metadata : {},
  };
}

async function preveriUporabnika(req, cfg) {
  var token = bearerToken(req);
  if (!token) {
    return { ok: false, status: 401, code: "AUTH_TOKEN_MISSING", retryable: false, napaka: "Prijava je potekla. Prijavite se znova." };
  }

  // Projekt uporablja asimetrični ES256 podpis. Podpis, izdajatelja, občinstvo
  // in čas veljavnosti zato preverimo lokalno z uradnim javnim JWKS ključem.
  // Tako vsak klik ni odvisen od odzivnosti oddaljenega /auth/v1/user.
  if (cfg.authVerificationMode !== "remote") {
    try {
      var lokalniUser = await preveriJwtLokalno(token, cfg);
      return { ok: true, user: lokalniUser, token: token, verification: "local_jwks" };
    } catch (lokalnaNapaka) {
      if (lokalnaNapaka && lokalnaNapaka.code === "AUTH_LEGACY_TOKEN") {
        return {
          ok: false,
          status: 401,
          code: "AUTH_SESSION_REFRESH_REQUIRED",
          retryable: true,
          napaka: "Prijavno sejo je treba osvežiti. Osvežite stran ali se prijavite znova.",
        };
      }
      if (jeNeveljavnaJwtNapaka(lokalnaNapaka)) {
        return { ok: false, status: 401, code: "AUTH_SESSION_INVALID", retryable: false, napaka: "Prijava ni več veljavna." };
      }
      console.warn("[auth-local-fallback]", String(lokalnaNapaka && (lokalnaNapaka.code || lokalnaNapaka.name) || "UNKNOWN"));
      // Če javnega ključa ob hladnem zagonu začasno ni mogoče pridobiti,
      // ohranimo varno rezervno preverjanje neposredno pri Auth strežniku.
    }
  }

  // Rezervna oddaljena pot ima znotraj 30-sekundne funkcije dovolj časa za
  // tri resnične poskuse in nato še za varen zapis opravila v čakalno vrsto.
  var zamiki = Array.isArray(cfg.authRetryDelays) ? cfg.authRetryDelays : [300, 900];
  var timeoutPoskusa = Number.isFinite(Number(cfg.authAttemptTimeoutMs))
    ? omejenCas(cfg.authAttemptTimeoutMs, 5000)
    : 5000;
  var zadnjaNapaka = null;
  var odgovor = null;
  for (var poskus = 0; poskus <= zamiki.length; poskus += 1) {
    try {
      odgovor = await fetchZOmejitvijo(cfg.url + "/auth/v1/user", {
        headers: {
          apikey: cfg.serviceKey,
          Authorization: "Bearer " + token,
        },
      }, timeoutPoskusa);
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

async function pokliciRpcKotUporabnik(cfg, token, ime, telo) {
  var publicKey = String(cfg.publicKey || cfg.serviceKey || "");
  var accessToken = String(token || "");
  if (!publicKey || !accessToken) {
    var configError = new Error("Uporabniška podatkovna seja manjka.");
    configError.code = "AUTH_TOKEN_MISSING";
    throw configError;
  }
  var response = await fetchZOmejitvijo(cfg.url + "/rest/v1/rpc/" + encodeURIComponent(ime), {
    method: "POST",
    headers: {
      apikey: publicKey,
      Authorization: "Bearer " + accessToken,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
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
  pokliciRpcKotUporabnik: pokliciRpcKotUporabnik,
  fetchZOmejitvijo: fetchZOmejitvijo,
  _test: {
    omejenCas: omejenCas,
    jePrehodniAuthStatus: jePrehodniAuthStatus,
    jeTimeoutNapaka: jeTimeoutNapaka,
    jeNeveljavnaJwtNapaka: jeNeveljavnaJwtNapaka,
    preveriJwtLokalno: preveriJwtLokalno,
  },
};
