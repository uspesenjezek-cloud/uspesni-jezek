var sentry = require("./_lib/sentry");
var crypto = require("node:crypto");
var db = require("./_lib/supabase-server");
var providerJson = require("./_lib/provider-json");
var aiPolicy = require("./_lib/atena-luna-policy");
/* ==========================================================
   api/citaj-racun.js - Vercel serverless funkcija (Node.js
   runtime). Na strežniku (kjer je ANTHROPIC_API_KEY skrit v
   Vercel environment variable, glej Project Settings ->
   Environment Variables) pokliče Claude vision API in iz
   slike/PDF-ja računa izlušči osnovne podatke za samodejno
   izpolnjevanje obrazca "Nov dolg" (glej "Naloži račun" v
   app/neplacila.html in obdelajRacunZAi v app/app.js).

   Klic na Anthropic API MORA iti prek te funkcije, ne
   neposredno iz brskalnika - drugače bi bil API ključ javno
   viden v client kodi vsakomur, ki odpre "View Source".

   POMEMBNO: ta endpoint deluje SAMO na Vercel deployu (in z
   lokalno nameščenim "vercel dev"), NE preko serve.ps1 +
   ngrok - serve.ps1 streže samo statične datoteke in nima
   pojma o /api poteh.
   ========================================================== */

// Vercel-ova trda omejitev velikosti telesa zahteve za Node.js
// serverless funkcije je ~4.5 MB - base64 zapis je ~33 % večji
// od izvirnika, zato tu pustimo dovolj rezerve. Slike se pred
// pošiljanjem na strežnik že stisnejo (glej stisniSlikoZaAi v
// app.js), za PDF (ki ga ni mogoče preprosto stisniti) pa app.js
// zavrne datoteke nad 3 MB, še preden pridejo sem.
const NAJVECJA_VELIKOST_BASE64_ZNAKOV = 6 * 1024 * 1024;

const DOVOLJENI_MEDIA_TIPI = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const DOCUMENT_AI_CONTRACT_VERSION = "document-extraction-v2-auth-admission";
const DOCUMENT_AI_TIMEOUT_MS = 45 * 1000;
const DOCUMENT_AI_ATTEMPT_TIMEOUT_MS = 30 * 1000;
const DOCUMENT_AI_MAX_ATTEMPTS = 2;
const DOCUMENT_AI_MAX_RESPONSE_BYTES = 512 * 1024;
const WINDOW_MS = 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const runtime = aiPolicy.ensureIdempotencyRuntime(globalThis.__ujDocumentAiRuntime || { users: new Map(), cache: new Map(), inflight: new Map() });
globalThis.__ujDocumentAiRuntime = runtime;

const NAVODILO_ZA_AI =
  'Iz priloženega računa/dokumenta izlušči SAMO naslednje podatke. ' +
  'POMEMBNO: pred izpolnjevanjem JSON-a PREGLEJ CELOTEN dokument - glavo (zgoraj), ' +
  'telo (sredina) in nogo/opombe (spodaj). Ne sklepaj, da podatka ni, če si preveril ' +
  'samo en očiten del dokumenta.\n\n' +
  'Polja:\n' +
  '- "naziv": naziv stranke ali podjetja oz. ime in priimek (prejemnik/dolžnik).\n' +
  '- "znesek": skupni znesek za plačilo kot število brez valute in brez ločil tisočic, z decimalno piko.\n' +
  '- "datum": datum izdaje računa v obliki LLLL-MM-DD.\n' +
  '- "rokPlacila": rok plačila / valuta (Zahlungsziel, Fälligkeitsdatum, Due date, Rok plačila) v obliki LLLL-MM-DD.\n' +
  '- "stevilkaRacuna": številka računa. Tipične oznake: "Št. računa", "Račun št.", "Številka računa", ' +
  '"Invoice no.", "Invoice number", "Rechnungsnummer", "Rechnung Nr.", "Nr.", "Belegnr.". ' +
  'Vrednost je pogosto alfanumerična (npr. "2026-0847", "R-12345", "RE2026/12") - prepiši jo TOČNO, ' +
  'vključno z vezaji/poševnicami. Išči v glavi in blizu naslova dokumenta, pa tudi v telesu.\n' +
  '- "opis": kratek opis opravljenega dela ali blaga.\n' +
  '- "telefon": telefonska številka, če je navedena (izdajatelj ali prejemnik).\n' +
  '- "email": e-poštni naslov v obliki ime@domena (npr. info@firma.si, name@firma.de). ' +
  'Lahko je kjerkoli na dokumentu (izdajatelj ALI prejemnik) - v glavi, podpisu, nogi, ' +
  'kontaktnem bloku ali opombah. POZORNO poišči znak @ po CELOTNEM dokumentu. ' +
  'Če najdeš več e-poštnih naslovov, izberi tistega, ki najbolj verjetno pripada stranki/prejemniku; ' +
  'če ni jasno, vrni prvega čitljivega.\n\n' +
  'SELF-CHECK pred odgovorom: preden nastaviš "stevilkaRacuna" ali "email" (ali katerokoli drugo polje) ' +
  'na null, še ENKRAT preglej celoten dokument. null uporabi SAMO, če podatka res ni ali ni čitljiv - ' +
  'NIKOLI si ne izmišljuj ali ne ugibaj vrednosti.\n\n' +
  'Vrni SAMO veljaven JSON objekt s točno temi osmimi ključi ' +
  '(naziv, znesek, datum, rokPlacila, stevilkaRacuna, opis, telefon, email), ' +
  'brez dodatnega besedila pred ali za njim, brez oznak kode (```).';

const NAVODILO_ZA_BONITETNO_PREVERBO =
  'Preberi priloženi račun, ponudbo, predračun ali drug poslovni dokument in prepoznaj vse glavne pogodbene stranke. ' +
  'Najpogosteje sta to IZDAJATELJ in PREJEMNIK. Ne zamenjaj ju z banko, računovodskim servisom, dostavno službo, ' +
  'izdelovalcem dokumenta ali ponudnikom programske opreme. Preglej glavo, naslovne bloke, telo, nogo in drobni tisk.\n\n' +
  'Za vsako dejansko stranko vrni:\n' +
  '- "vloga": samo "izdajatelj", "prejemnik" ali "drugo";\n' +
  '- "pravnoIme": uradno pravno ime ali ime in priimek samostojnega podjetnika;\n' +
  '- "poslovniNaziv": blagovna znamka oziroma poslovni naziv, če se razlikuje od pravnega imena;\n' +
  '- "ulica": ulica in hišna številka;\n' +
  '- "postnaStevilka": poštna številka;\n' +
  '- "kraj": kraj;\n' +
  '- "spletnaStran": neposredno zapisana spletna stran ali jasno zapisana poslovna domena;\n' +
  '- "registerNumber": registrska oznaka in številka, npr. HRB 12345, HRA 123 ali matična številka;\n' +
  '- "vatId": davčna oziroma DDV številka, npr. DE123456789.\n\n' +
  'Ne združuj podatkov dveh strank. Če je posamezen podatek nejasen ali ga ni, vrni null. ' +
  'Ne ugibaj spletne strani samo iz splošnega e-poštnega naslova (gmail, hotmail, outlook ipd.). ' +
  'Ne dodajaj stranke brez prepoznavnega imena. Podvojene zapise združi. ' +
  'Vrni SAMO veljaven JSON objekt oblike {"stranke":[...]} brez dodatnega besedila in brez oznak kode.';

function varnoPoljeStranke(vrednost, najvec) {
  return typeof vrednost === "string" ? vrednost.trim().replace(/\s+/g, " ").slice(0, najvec) || null : null;
}

function normalizirajBonitetnoStranko(stranka) {
  var vloga = ["izdajatelj", "prejemnik", "drugo"].includes(stranka && stranka.vloga)
    ? stranka.vloga
    : "drugo";
  var pravnoIme = varnoPoljeStranke(stranka && stranka.pravnoIme, 240);
  var poslovniNaziv = varnoPoljeStranke(stranka && stranka.poslovniNaziv, 240);
  if (!pravnoIme && !poslovniNaziv) return null;
  return {
    vloga: vloga,
    pravnoIme: pravnoIme,
    poslovniNaziv: poslovniNaziv,
    ulica: varnoPoljeStranke(stranka && stranka.ulica, 140),
    postnaStevilka: varnoPoljeStranke(stranka && stranka.postnaStevilka, 12),
    kraj: varnoPoljeStranke(stranka && stranka.kraj, 80),
    spletnaStran: varnoPoljeStranke(stranka && stranka.spletnaStran, 240),
    registerNumber: varnoPoljeStranke(stranka && stranka.registerNumber, 120),
    vatId: varnoPoljeStranke(stranka && stranka.vatId, 80),
  };
}

function normalizirajBonitetneStranke(vrednost) {
  var stranke = vrednost && Array.isArray(vrednost.stranke) ? vrednost.stranke : [];
  var videnaImena = new Set();
  return stranke.map(normalizirajBonitetnoStranko).filter(Boolean).filter(function (stranka) {
    var kljuc = String(stranka.pravnoIme || stranka.poslovniNaziv).toLowerCase().replace(/[^a-z0-9äöüß]+/gi, " ").trim();
    if (!kljuc || videnaImena.has(kljuc)) return false;
    videnaImena.add(kljuc);
    return true;
  }).slice(0, 4);
}

function cleanRuntime(now) {
  runtime.cache.forEach(function (entry, key) {
    if (now - entry.createdAt > CACHE_TTL_MS) runtime.cache.delete(key);
  });
  runtime.users.forEach(function (entry, key) {
    if (now - entry.startedAt > WINDOW_MS * 2) runtime.users.delete(key);
  });
}

function validRequestId(value) {
  return /^[a-zA-Z0-9][a-zA-Z0-9:_-]{15,99}$/.test(String(value || ""));
}

function requestFingerprint(mediaType, data, purpose) {
  return crypto.createHash("sha256").update(DOCUMENT_AI_CONTRACT_VERSION).update("\0")
    .update(String(purpose || "invoice")).update("\0").update(String(mediaType || "")).update("\0")
    .update(String(data || "")).digest("hex");
}

function documentTransportError(code, message, retryable, status, attempts) {
  var error = new Error(message);
  error.code = code;
  error.status = status || 503;
  error.retryable = retryable === true;
  error.attempts = attempts;
  return error;
}

function retryAfterMs(response) {
  var raw = response && response.headers && response.headers.get("retry-after");
  if (!raw) return null;
  var seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  var date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

async function requestAnthropic(apiKey, body, options) {
  options = options || {};
  var fetchImpl = options.fetchImpl || fetch;
  var sleepImpl = options.sleepImpl || function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
  var startedAt = Date.now();
  var deadline = startedAt + (Number(options.timeoutMs) || DOCUMENT_AI_TIMEOUT_MS);
  var lastError = null;
  for (var attempt = 1; attempt <= DOCUMENT_AI_MAX_ATTEMPTS; attempt += 1) {
    var remaining = deadline - Date.now();
    if (remaining <= 0) break;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, Math.min(DOCUMENT_AI_ATTEMPT_TIMEOUT_MS, remaining));
    var response = null;
    try {
      response = await fetchImpl("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      var payload = await providerJson.readJson(response, {
        maxBytes: DOCUMENT_AI_MAX_RESPONSE_BYTES,
        code: "DOCUMENT_AI_INVALID_RESPONSE",
        message: "AI je vrnil prevelik odgovor.",
      });
      if (response.ok && payload) return { payload: payload, attempts: attempt, elapsedMs: Date.now() - startedAt };
      if (response.ok) {
        lastError = documentTransportError("DOCUMENT_AI_INVALID_RESPONSE", "AI je vrnil neveljaven odgovor.", false, 502, attempt);
      } else if (response.status === 429) {
        lastError = documentTransportError("DOCUMENT_AI_RATE_LIMITED", "Branje dokumentov je trenutno omejeno. Poskusite znova čez trenutek.", true, 503, attempt);
      } else if (response.status >= 500) {
        lastError = documentTransportError("DOCUMENT_AI_PROVIDER_ERROR", "Branje dokumentov trenutno ni dosegljivo.", true, 503, attempt);
      } else {
        lastError = documentTransportError("DOCUMENT_AI_PROVIDER_ERROR", "AI zahteve ni sprejel.", false, 502, attempt);
      }
    } catch (error) {
      if (error && (error.name === "AbortError" || error.name === "TimeoutError")) {
        lastError = documentTransportError("DOCUMENT_AI_TIMEOUT", "Branje dokumenta je trajalo predolgo.", true, 504, attempt);
      } else if (error && error.code === "DOCUMENT_AI_INVALID_RESPONSE") {
        lastError = documentTransportError(error.code, error.message, true, 502, attempt);
      } else {
        lastError = documentTransportError("DOCUMENT_AI_UNAVAILABLE", "Branje dokumentov trenutno ni dosegljivo.", true, 503, attempt);
      }
    } finally {
      clearTimeout(timer);
    }
    if (!lastError.retryable || attempt >= DOCUMENT_AI_MAX_ATTEMPTS) break;
    var delay = retryAfterMs(response);
    if (!Number.isFinite(delay)) delay = 250 * attempt;
    delay = Math.max(0, Math.min(1500, delay));
    if (Date.now() + delay >= deadline) break;
    await sleepImpl(delay);
  }
  throw lastError || documentTransportError("DOCUMENT_AI_TIMEOUT", "Branje dokumenta je trajalo predolgo.", true, 504, DOCUMENT_AI_MAX_ATTEMPTS);
}

function anthropicRequestBody(mediaType, data, isCreditCheck) {
  var contentBlock = mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mediaType, data: data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: data } };
  return {
    model: "claude-sonnet-5",
    max_tokens: 1024,
    thinking: { type: "disabled" },
    messages: [{
      role: "user",
      content: [contentBlock, { type: "text", text: isCreditCheck ? NAVODILO_ZA_BONITETNO_PREVERBO : NAVODILO_ZA_AI }],
    }],
  };
}

function parseAnthropicPayload(responseBody, isCreditCheck) {
  var text = responseBody && Array.isArray(responseBody.content) && responseBody.content[0] &&
    typeof responseBody.content[0].text === "string" ? responseBody.content[0].text.trim() : "";
  var parsed;
  try {
    parsed = JSON.parse(text.trim().replace(/^```(json)?\s*/i, "").replace(/\s*```$/i, "").trim());
  } catch (_) {
    throw documentTransportError("DOCUMENT_AI_INVALID_RESPONSE", "AI odgovora ni bilo mogoče razumeti kot JSON.", false, 502, 1);
  }
  if (isCreditCheck) {
    var parties = normalizirajBonitetneStranke(parsed);
    if (!parties.length) return { statusCode: 422, payload: { ok: false, code: "NO_RELIABLE_PARTIES", retryable: false, napaka: "Na dokumentu ni bilo mogoče zanesljivo prepoznati nobene stranke." } };
    return { statusCode: 200, payload: { ok: true, stranke: parties } };
  }
  return { statusCode: 200, payload: {
    ok: true,
    podatki: {
      naziv: typeof parsed.naziv === "string" ? parsed.naziv.trim() : null,
      znesek: parsed.znesek !== null && parsed.znesek !== undefined && Number.isFinite(Number(parsed.znesek)) ? Number(parsed.znesek) : null,
      datum: typeof parsed.datum === "string" ? parsed.datum.trim() : null,
      rokPlacila: typeof parsed.rokPlacila === "string" ? parsed.rokPlacila.trim() : null,
      stevilkaRacuna: typeof parsed.stevilkaRacuna === "string" ? parsed.stevilkaRacuna.trim() : null,
      opis: typeof parsed.opis === "string" ? parsed.opis.trim() : null,
      telefon: typeof parsed.telefon === "string" ? parsed.telefon.trim() : null,
      email: typeof parsed.email === "string" ? parsed.email.trim() : null,
    },
  } };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", napaka: "Metoda ni dovoljena, uporabi POST." });
  }

  var cfg;
  try { cfg = db.uporabniskaKonfiguracija(); }
  catch (_) { return res.status(500).json({ ok: false, code: "SERVER_CONFIGURATION", napaka: "Strežniška konfiguracija manjka." }); }

  var auth = await db.preveriUporabnika(req, cfg);
  if (!auth.ok) return res.status(auth.status || 401).json({ ok: false, code: auth.code || "AUTH_REQUIRED", retryable: auth.retryable === true, napaka: auth.napaka });

  const apiKljuc = process.env.ANTHROPIC_API_KEY;
  if (!apiKljuc) {
    return res.status(503).json({ ok: false, code: "DOCUMENT_AI_NOT_CONFIGURED", retryable: false, napaka: "Branje dokumentov trenutno ni konfigurirano." });
  }

  const telo = req.body || {};
  const mediaType = telo.mediaType;
  const podatki = telo.podatki;
  const jeBonitetnaPreverba = telo.namen === "bonitetna_preverba";
  const requestId = String(telo.requestId || "");

  if (!validRequestId(requestId) || !podatki || typeof podatki !== "string") return res.status(400).json({ ok: false, code: "INVALID_INPUT", napaka: "Manjkajo ali niso veljavni podatki zahteve." });

  if (podatki.length > NAJVECJA_VELIKOST_BASE64_ZNAKOV) return res.status(413).json({ ok: false, code: "DOCUMENT_TOO_LARGE", napaka: "Datoteka je prevelika za samodejno branje." });

  if (!DOVOLJENI_MEDIA_TIPI.includes(mediaType)) return res.status(400).json({ ok: false, code: "UNSUPPORTED_MEDIA_TYPE", napaka: "Nepodprt tip datoteke." });

  const now = Date.now();
  cleanRuntime(now);
  const purpose = jeBonitetnaPreverba ? "credit-check" : "invoice";
  const fingerprint = requestFingerprint(mediaType, podatki, purpose);
  const cacheKey = DOCUMENT_AI_CONTRACT_VERSION + ":" + auth.user.id + ":" + requestId;
  const coordinator = aiPolicy.createDistributedCoordinator({
    enabled: Boolean(auth.token),
    rpc: function (name, payload) { return db.pokliciRpcKotUporabnik(cfg, auth.token, name, payload); },
    key: cacheKey,
    requestId: requestId,
    kind: "document",
    contractVersion: DOCUMENT_AI_CONTRACT_VERSION,
    fingerprint: fingerprint,
    unavailableMessage: "Sprejemnik za branje dokumentov trenutno ni dosegljiv.",
    messages: {
      unavailable: "Branje dokumentov trenutno ni dosegljivo.",
      inProgress: "Ta dokument se že obdeluje. Poskusite znova čez trenutek.",
      busy: "Branje dokumentov je trenutno zasedeno. Poskusite znova čez trenutek.",
    },
  });
  const outcome = await aiPolicy.executeIdempotent(runtime, {
    key: cacheKey,
    fingerprint: fingerprint,
    coordinator: coordinator,
    fallbackMessage: "Dokumenta trenutno ni bilo mogoče prebrati.",
    beforeStart: function () {
      return aiPolicy.reserveRateLimit(runtime.users, auth.user.id, now, WINDOW_MS, aiPolicy.REQUESTS_PER_MINUTE)
        ? null
        : { statusCode: 429, payload: { ok: false, code: "RATE_LIMITED", retryable: true, retryAfterMs: 60000, napaka: "Preveč zaporednih zahtev. Poskusite znova čez minuto." } };
    },
  }, async function () {
    const providerResult = await requestAnthropic(apiKljuc, anthropicRequestBody(mediaType, podatki, jeBonitetnaPreverba));
    const parsed = parseAnthropicPayload(providerResult.payload, jeBonitetnaPreverba);
    parsed.payload.requestId = requestId;
    parsed.payload.attempts = providerResult.attempts;
    return parsed;
  });
  return res.status(outcome.statusCode).json(outcome.payload);
}

module.exports = sentry.wrapHandler(handler, "/api/citaj-racun");

module.exports._test = {
  normalizirajBonitetnoStranko,
  normalizirajBonitetneStranke,
  NAVODILO_ZA_BONITETNO_PREVERBO,
  validRequestId,
  requestFingerprint,
  requestAnthropic,
  anthropicRequestBody,
  parseAnthropicPayload,
  runtime,
  DOCUMENT_AI_CONTRACT_VERSION,
};
