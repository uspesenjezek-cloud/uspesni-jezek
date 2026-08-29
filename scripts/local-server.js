/*
 * Lokalni razvojni strežnik.
 *
 * - statične datoteke streže iz korena projekta;
 * - POST /api/citaj-racun uporabi lokalno funkcijo, kadar je v .env.local
 *   nastavljen ANTHROPIC_API_KEY, sicer ohrani produkcijski nadomestni vir;
 * - POST /api/aktiviraj-nacrt potrdi lokalni predogled aktivacije brez
 *   dejanskega razporejanja ali pošiljanja SMS-ov.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const citajRacunModul = require.resolve("../api/citaj-racun");
const mehkaBonitetaModul = require.resolve("../api/mehka-boniteta");
const mehkaBonitetaOpraviloModul = require.resolve("../api/mehka-boniteta-opravilo");
const mehkaBonitetaDelavecModul = require.resolve("../api/mehka-boniteta-delavec");
const bonitetaProModul = require.resolve("../api/boniteta-pro");
const posRacunPdfModul = require.resolve("../api/pos-racun-pdf");
const posRacunKorekcijaModul = require.resolve("../api/pos-racun-korekcija");
const posRacunKorekcijaXrechnungModul = require.resolve("../api/_handlers/pos-racun-korekcija-xrechnung");
const posRacunXrechnungModul = require.resolve("../api/pos-racun-xrechnung");
const posDostavaSandboxModul = require.resolve("../api/pos-dostava-sandbox");
const posDostavaDelavecModul = require.resolve("../api/pos-dostava-delavec");
const posDostavaEmailModul = require.resolve("../api/_handlers/pos-dostava-email");
const posDostavaWebhookModul = require.resolve("../api/_handlers/pos-dostava-webhook");
const posFiskalyModul = require.resolve("../api/_handlers/pos-fiskaly");
const posFinapiModul = require.resolve("../api/_handlers/pos-finapi");
const posStripeCheckoutModul = require.resolve("../api/_handlers/pos-stripe-checkout");
const posStripeWebhookModul = require.resolve("../api/_handlers/pos-stripe-webhook");
const posArhivModul = require.resolve("../api/_handlers/pos-arhiv");
const posVerfahrensdokumentationModul = require.resolve("../api/_handlers/pos-verfahrensdokumentation-pdf");
const posDatevModul = require.resolve("../api/_handlers/pos-datev");
const pridobiIzvedboModul = require.resolve("../api/pridobi-izvedbo");
const izvediOpominUkrepModul = require.resolve("../api/izvedi-opomin-ukrep");
  const razcleniZgodovinoModul = require.resolve("../api/_handlers/razcleni-zgodovino");
const nemcijaPostaHandler = require("../api/nemcija-posta");

// Lokalno uporabljamo isti vrstni red, omejitev in ponovitve, le da opravila
// hranimo v pomnilniku procesa, zato razvoj ne zahteva že izvedene migracije.
process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = "true";
process.env.POS_LOCAL_MOCKS_ENABLED = "true";

const root = path.resolve(__dirname, "..");
const apiRoot = path.join(root, "api") + path.sep;
const canaryDataRoot = process.env.UJ_SPEECH_HOME || path.join(process.env.LOCALAPPDATA || "", "UspesniJezek", "speech");
const canaryModel = path.join(canaryDataRoot, "model", "canary-1b-v2-Q5_K_M.gguf");
const canaryServer = path.join(root, "tools", "slovenski-live-prepis", "canary-progressive-server.js");
const atenaNemotronModel = path.join(canaryDataRoot, "model", "nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf");
const atenaNemotronServer = path.join(root, "tools", "slovenski-live-prepis", "streaming-server.js");
let nalozenaApiRazlicica = "";
let lokalniCanaryProces = null;
let lokalniCanaryPreverjen = false;
let lokalniAtenaNemotronProces = null;
let lokalniAtenaNemotronPreverjen = false;
const portArgument = process.argv.indexOf("--port");
const port = portArgument >= 0 ? Number(process.argv[portArgument + 1]) : 8001;
const apiOrigin = (process.env.LOCAL_OCR_API_ORIGIN || "https://uspesni-jezek.vercel.app").replace(/\/$/, "");
const izvedbaApiOrigin = (process.env.LOCAL_IZVEDBA_API_ORIGIN || "https://uspesni-jezek.vercel.app").replace(/\/$/, "");
const izvedbaApiPoti = new Set([
  "/api/pridobi-izvedbo",
  "/api/izvedi-opomin-ukrep",
  "/api/poslji-opomin-zdaj",
]);
const maxRequestBytes = 8 * 1024 * 1024;
const versionSyncOznaka = '<script src="/app/version-sync.js?v=20260825-localhost-live-v4"></script>';
const serverStartedAt = new Date().toISOString();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

function posljiJson(res, status, podatki) {
  const telo = Buffer.from(JSON.stringify(podatki));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": telo.length,
    "Cache-Control": "no-store",
  });
  res.end(telo);
}

function zazeniLokalniCanary() {
  if (lokalniCanaryPreverjen || process.env.UJ_DISABLE_AUTO_CANARY === "true") return;
  lokalniCanaryPreverjen = true;
  if (!fs.existsSync(canaryModel) || !fs.existsSync(canaryServer)) {
    console.warn("Lokalni govor ni nameščen. Po potrebi zaženite: npm run setup:slovenski-prepis");
    return;
  }
  const preveri = http.get({ hostname: "127.0.0.1", port: 8765, path: "/health", timeout: 1000 }, (odziv) => {
    odziv.resume();
    console.log("Lokalni Handy/Canary je že zagnan.");
  });
  preveri.on("timeout", () => preveri.destroy());
  preveri.on("error", () => {
    lokalniCanaryProces = childProcess.spawn(process.execPath, [canaryServer], {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    });
    lokalniCanaryProces.once("error", (napaka) => {
      console.warn("Lokalnega Handy/Canary servisa ni bilo mogoče zagnati:", napaka.message);
    });
    lokalniCanaryProces.once("exit", (koda) => {
      if (koda && process.exitCode == null) console.warn(`Lokalni Handy/Canary se je ustavil (koda ${koda}).`);
      lokalniCanaryProces = null;
    });
    console.log("Zaganjam lokalni Handy/Canary za samostojni slovenski prepis …");
  });
}

function ustaviLokalniCanary() {
  if (lokalniCanaryProces && !lokalniCanaryProces.killed) lokalniCanaryProces.kill();
}

function zazeniLokalniAtenaNemotron() {
  if (lokalniAtenaNemotronPreverjen || process.env.UJ_DISABLE_AUTO_NEMOTRON === "true") return;
  lokalniAtenaNemotronPreverjen = true;
  if (!fs.existsSync(atenaNemotronModel) || !fs.existsSync(atenaNemotronServer)) {
    console.warn("Atenin nemški Nemotron 3.5 ni nameščen. Zaženite: npm run setup:slovenski-prepis");
    return;
  }
  const preveri = http.get({ hostname: "127.0.0.1", port: 8766, path: "/health", timeout: 1000 }, (odziv) => {
    odziv.resume();
    console.log("Atenin nemški Nemotron 3.5 je že zagnan.");
  });
  preveri.on("timeout", () => preveri.destroy());
  preveri.on("error", () => {
    lokalniAtenaNemotronProces = childProcess.spawn(process.execPath, [atenaNemotronServer], {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    });
    lokalniAtenaNemotronProces.once("error", (napaka) => {
      console.warn("Ateninega Nemotron servisa ni bilo mogoče zagnati:", napaka.message);
    });
    lokalniAtenaNemotronProces.once("exit", (koda) => {
      if (koda && process.exitCode == null) console.warn(`Atenin Nemotron se je ustavil (koda ${koda}).`);
      lokalniAtenaNemotronProces = null;
    });
    console.log("Zaganjam Nemotron 3.5 za Atenin nemški prepis v živo …");
  });
}

function ustaviLokalniAtenaNemotron() {
  if (lokalniAtenaNemotronProces && !lokalniAtenaNemotronProces.killed) lokalniAtenaNemotronProces.kill();
}

function preberiLokalnoOkolje(pot) {
  try {
    return fs.readFileSync(pot, "utf8");
  } catch (_) {
    return "";
  }
}

function imaVeljavenServiceRole() {
  const vrednost = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return Boolean(vrednost && !/^\[(?:SENSITIVE|REDACTED)\]$/i.test(vrednost));
}

function naloziLokalnoSupabaseKonfiguracijo() {
  try {
    if (!process.env.SUPABASE_URL || (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY)) {
      const vir = preberiLokalnoOkolje(path.join(root, "app", "config.js"));
      const url = vir.match(/url:\s*["']([^"']+)["']/);
      const anonKey = vir.match(/anonKey:\s*["']([^"']+)["']/);
      if (url && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = url[1];
      if (anonKey && !process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = anonKey[1];
    }
    if (!process.env.OPENREGISTER_API_KEY || !process.env.APIFY_API_TOKEN || !process.env.ANTHROPIC_API_KEY || !process.env.OPENAI_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENREGISTER_WEBHOOK_SECRET || !process.env.RESEND_WEBHOOK_SECRET || !process.env.FISKALY_API_KEY_TEST || !process.env.FISKALY_API_SECRET_TEST) {
      const okolje = preberiLokalnoOkolje(path.join(root, ".env.local"));
      const openregister = okolje.match(/^\s*OPENREGISTER_API_KEY\s*=\s*["']?([^\r\n"']+)/m);
      if (openregister && !process.env.OPENREGISTER_API_KEY) process.env.OPENREGISTER_API_KEY = openregister[1].trim();
      const apify = okolje.match(/^\s*APIFY_API_TOKEN\s*=\s*["']?([^\r\n"']+)/m);
      if (apify && !process.env.APIFY_API_TOKEN) process.env.APIFY_API_TOKEN = apify[1].trim();
      const anthropic = okolje.match(/^\s*ANTHROPIC_API_KEY\s*=\s*["']?([^\r\n"']+)/m);
      if (anthropic && !process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = anthropic[1].trim();
      const openai = okolje.match(/^\s*OPENAI_API_KEY\s*=\s*["']?([^\r\n"']+)/m);
      if (openai && !process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = openai[1].trim();
      const serviceRole = okolje.match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?([^\r\n"']+)/m);
      if (serviceRole && !process.env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRole[1].trim();
      const webhookSecret = okolje.match(/^\s*OPENREGISTER_WEBHOOK_SECRET\s*=\s*["']?([^\r\n"']+)/m);
      if (webhookSecret && !process.env.OPENREGISTER_WEBHOOK_SECRET) process.env.OPENREGISTER_WEBHOOK_SECRET = webhookSecret[1].trim();
      const resendWebhookSecret = okolje.match(/^\s*RESEND_WEBHOOK_SECRET\s*=\s*["']?([^\r\n"']+)/m);
      if (resendWebhookSecret && !process.env.RESEND_WEBHOOK_SECRET) process.env.RESEND_WEBHOOK_SECRET = resendWebhookSecret[1].trim();
      const cronSecret = okolje.match(/^\s*CRON_SECRET\s*=\s*["']?([^\r\n"']+)/m);
      if (cronSecret && !process.env.CRON_SECRET) process.env.CRON_SECRET = cronSecret[1].trim();
      const fiskalyKey = okolje.match(/^\s*FISKALY_API_KEY_TEST\s*=\s*["']?([^\r\n"']+)/m);
      if (fiskalyKey && !process.env.FISKALY_API_KEY_TEST) process.env.FISKALY_API_KEY_TEST = fiskalyKey[1].trim();
      const fiskalySecret = okolje.match(/^\s*FISKALY_API_SECRET_TEST\s*=\s*["']?([^\r\n"']+)/m);
      if (fiskalySecret && !process.env.FISKALY_API_SECRET_TEST) process.env.FISKALY_API_SECRET_TEST = fiskalySecret[1].trim();
      const fiskalyMode = okolje.match(/^\s*FISKALY_SIGN_DE_MODE\s*=\s*["']?([^\r\n"']+)/m);
      if (fiskalyMode && !process.env.FISKALY_SIGN_DE_MODE) process.env.FISKALY_SIGN_DE_MODE = fiskalyMode[1].trim();
      const fiskalyTss = okolje.match(/^\s*FISKALY_TSS_ID_TEST\s*=\s*["']?([^\r\n"']+)/m);
      if (fiskalyTss && !process.env.FISKALY_TSS_ID_TEST) process.env.FISKALY_TSS_ID_TEST = fiskalyTss[1].trim();
      const fiskalyClient = okolje.match(/^\s*FISKALY_CLIENT_ID_TEST\s*=\s*["']?([^\r\n"']+)/m);
      if (fiskalyClient && !process.env.FISKALY_CLIENT_ID_TEST) process.env.FISKALY_CLIENT_ID_TEST = fiskalyClient[1].trim();
    }
    if (!imaVeljavenServiceRole()) {
      const vercelOkolje = preberiLokalnoOkolje(path.join(root, ".vercel", ".env.production.local"));
      const serviceRole = vercelOkolje.match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?([^\r\n"']+)/m);
      if (serviceRole && !/^\[(?:SENSITIVE|REDACTED)\]$/i.test(serviceRole[1].trim())) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRole[1].trim();
      }
    }
  } catch (_) {
    // API bo vrnil jasno konfiguracijsko napako.
  }
}

async function izvediLokalniApi(req, res, modul) {
  try {
    const surovoTelo = await preberiTelo(req);
    req.rawBody = surovoTelo.toString("utf8");
    try {
      req.body = surovoTelo.length ? JSON.parse(surovoTelo.toString("utf8")) : {};
    } catch (_) {
      posljiJson(res, 400, { ok: false, napaka: "Vneseni podatki niso veljavni." });
      return;
    }

    naloziLokalnoSupabaseKonfiguracijo();
    res.status = function (status) {
      res.statusCode = status;
      return res;
    };
    res.json = function (podatki) {
      const telo = Buffer.from(JSON.stringify(podatki));
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Length", telo.length);
      }
      res.end(telo);
      return res;
    };
    osveziApiCeJeSpremenjen();
    const apiHandler = require(modul);
    await apiHandler(req, res);
  } catch (napaka) {
    console.error("[lokalna-mehka-boniteta]", napaka && napaka.message);
    if (!res.headersSent) posljiJson(res, 500, { ok: false, napaka: "Lokalno preverjanje ni uspelo." });
    else res.end();
  }
}

function izracunajApiRazlicico() {
  let zadnjaSprememba = 0;
  let skupnaVelikost = 0;
  let steviloDatotek = 0;
  function preglej(mapa) {
    for (const vnos of fs.readdirSync(mapa, { withFileTypes: true })) {
      const polnaPot = path.join(mapa, vnos.name);
      if (vnos.isDirectory()) preglej(polnaPot);
      else if (vnos.isFile() && path.extname(vnos.name).toLowerCase() === ".js") {
        const stat = fs.statSync(polnaPot);
        zadnjaSprememba = Math.max(zadnjaSprememba, Math.floor(stat.mtimeMs));
        skupnaVelikost += stat.size;
        steviloDatotek += 1;
      }
    }
  }
  preglej(path.join(root, "api"));
  return [zadnjaSprememba, skupnaVelikost, steviloDatotek].join("-");
}

function osveziApiCeJeSpremenjen() {
  const novaRazlicica = izracunajApiRazlicico();
  if (novaRazlicica === nalozenaApiRazlicica) return false;
  // Različico označimo pred sinhronim ponovnim nalaganjem, da dva skoraj
  // sočasna klica iste spremembe ne osvežita dvakrat.
  nalozenaApiRazlicica = novaRazlicica;
  Object.keys(require.cache).forEach(function (datoteka) {
    if (datoteka.startsWith(apiRoot)) delete require.cache[datoteka];
  });
  return true;
}

async function preberiTelo(req) {
  const deli = [];
  let velikost = 0;

  for await (const del of req) {
    velikost += del.length;
    if (velikost > maxRequestBytes) {
      const napaka = new Error("Datoteka je prevelika za lokalni prenos.");
      napaka.status = 413;
      throw napaka;
    }
    deli.push(del);
  }

  return Buffer.concat(deli);
}

async function posredujBranjeRacuna(req, res) {
  if (req.method !== "POST") {
    posljiJson(res, 405, { ok: false, napaka: "Metoda ni dovoljena, uporabi POST." });
    return;
  }

  try {
    const telo = await preberiTelo(req);
    const odgovor = await fetch(`${apiOrigin}/api/citaj-racun`, {
      method: "POST",
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
      },
      body: telo,
      signal: AbortSignal.timeout(60000),
    });

    const rezultat = Buffer.from(await odgovor.arrayBuffer());
    res.writeHead(odgovor.status, {
      "Content-Type": odgovor.headers.get("content-type") || "application/json; charset=utf-8",
      "Content-Length": rezultat.length,
      "Cache-Control": "no-store",
    });
    res.end(rezultat);
  } catch (napaka) {
    const jeTimeout = napaka && (napaka.name === "TimeoutError" || napaka.name === "AbortError");
    posljiJson(res, napaka.status || 502, {
      ok: false,
      napaka: jeTimeout
        ? "Branje računa je trajalo predolgo. Poskusite znova."
        : "Lokalna povezava z bralnikom računa ni uspela. Preverite internetno povezavo.",
    });
  }
}

function potrdiLokalniPredogledAktivacije(req, res) {
  if (req.method !== "POST") {
    posljiJson(res, 405, { ok: false, napaka: "Metoda ni dovoljena, uporabi POST." });
    return;
  }

  posljiJson(res, 200, {
    ok: true,
    localPreview: true,
    scheduledCount: 0,
  });
}

function izracunajRazlicicoAplikacije() {
  let zadnjaSprememba = 0;
  let skupnaVelikost = 0;
  let steviloDatotek = 0;

  function preglejMapa(mapa) {
    for (const vnos of fs.readdirSync(mapa, { withFileTypes: true })) {
      const polnaPot = path.join(mapa, vnos.name);
      if (vnos.isDirectory()) {
        preglejMapa(polnaPot);
      } else if (vnos.isFile()) {
        const stat = fs.statSync(polnaPot);
        zadnjaSprememba = Math.max(zadnjaSprememba, Math.floor(stat.mtimeMs));
        skupnaVelikost += stat.size;
        steviloDatotek += 1;
      }
    }
  }

  preglejMapa(path.join(root, "app"));
  return [zadnjaSprememba, skupnaVelikost, steviloDatotek].join("-");
}

function izracunajRazlicicoSredstev(sredstva) {
  const appMapa = path.resolve(root, "app");
  const podpisi = [];

  for (const sredstvo of sredstva) {
    try {
      const pathname = decodeURIComponent(new URL(sredstvo, "http://localhost").pathname);
      const datoteka = path.resolve(root, `.${pathname}`);
      if (datoteka !== appMapa && !datoteka.startsWith(`${appMapa}${path.sep}`)) continue;
      const stat = fs.statSync(datoteka);
      if (!stat.isFile()) continue;
      podpisi.push([pathname, Math.floor(stat.mtimeMs), stat.size].join(":"));
    } catch (_) {
      // Neveljavno ali izbrisano sredstvo ne sme sesuti lokalnega predogleda.
    }
  }

  podpisi.sort();
  return crypto.createHash("sha256").update(podpisi.join("\n")).digest("hex").slice(0, 20);
}

function posljiRazlicicoAplikacije(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    posljiJson(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
    return;
  }
  const requestUrl = new URL(req.url, "http://localhost");
  const sredstva = requestUrl.searchParams.getAll("asset");
  const razlicica = sredstva.length
    ? izracunajRazlicicoSredstev(sredstva)
    : izracunajRazlicicoAplikacije();
  posljiJson(res, 200, { ok: true, version: razlicica });
}

async function posredujZascitenApi(req, res, ciljnaPot) {
  try {
    const telo = ["GET", "HEAD"].includes(req.method) ? null : await preberiTelo(req);
    const headers = {
      Accept: req.headers.accept || "application/json",
      Authorization: req.headers.authorization || "",
    };
    if (telo && telo.length) headers["Content-Type"] = req.headers["content-type"] || "application/json";
    const odgovor = await fetch(`${apiOrigin}${ciljnaPot}`, {
      method: req.method,
      headers,
      body: telo && telo.length ? telo : undefined,
      signal: AbortSignal.timeout(60000),
    });
    const rezultat = Buffer.from(await odgovor.arrayBuffer());
    res.writeHead(odgovor.status, {
      "Content-Type": odgovor.headers.get("content-type") || "application/json; charset=utf-8",
      "Content-Length": rezultat.length,
      "Cache-Control": "no-store",
    });
    res.end(rezultat);
  } catch (napaka) {
    const jeTimeout = napaka && (napaka.name === "TimeoutError" || napaka.name === "AbortError");
    posljiJson(res, 502, { ok: false, napaka: jeTimeout ? "Strežniški DATEV preizkus je trajal predolgo." : "Zaščitenega DATEV API-ja ni bilo mogoče doseči." });
  }
}

function varniPrstniOdtisMape(mapa) {
  const resenaPot = fs.realpathSync(mapa);
  const kanonicnaPot = process.platform === "win32" ? resenaPot.toLowerCase() : resenaPot;
  return crypto.createHash("sha256").update(kanonicnaPot).digest("hex").slice(0, 16);
}

function gitVrednost(argumenti) {
  try {
    return childProcess.execFileSync("git", argumenti, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch (_) { return ""; }
}

function identitetaLokalnegaVira() {
  return {
    workspaceName: path.basename(root), workspaceHash: varniPrstniOdtisMape(root),
    branch: gitVrednost(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown",
    commit: gitVrednost(["rev-parse", "--short=12", "HEAD"]) || "unknown",
    dirty: Boolean(gitVrednost(["status", "--porcelain"])),
    appVersion: izracunajRazlicicoAplikacije(), apiVersion: izracunajApiRazlicico(), serverStartedAt,
  };
}

function posljiIdentitetoLokalnegaVira(req, res) {
  if (req.method !== "GET") { posljiJson(res, 405, { ok: false, napaka: "Metoda ni dovoljena." }); return; }
  posljiJson(res, 200, { ok: true, localSource: identitetaLokalnegaVira() });
}

function posredujLokalniCanary(req, res, requestUrl) {
  const dovoljenaPot = requestUrl.pathname.replace(/^\/__dev-handy-canary/, "");
  if (!["/health", "/session/start", "/session/audio", "/session/stop"].includes(dovoljenaPot)) {
    posljiJson(res, 404, { ok: false, error: "Canary pot ne obstaja." });
    return;
  }
  const dovoljeneMetode = dovoljenaPot === "/health" ? ["GET"] : ["POST"];
  if (!dovoljeneMetode.includes(req.method)) {
    posljiJson(res, 405, { ok: false, error: "Metoda ni dovoljena." });
    return;
  }
  const headers = {};
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
  if (req.headers["content-length"]) headers["content-length"] = req.headers["content-length"];
  if (req.headers["x-uj-prepis-session"]) headers["x-uj-prepis-session"] = req.headers["x-uj-prepis-session"];
  const proxy = http.request({
    hostname: "127.0.0.1",
    port: 8765,
    path: dovoljenaPot + requestUrl.search,
    method: req.method,
    headers,
    timeout: 15000,
  }, (canaryRes) => {
    res.writeHead(canaryRes.statusCode || 502, {
      "Content-Type": canaryRes.headers["content-type"] || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    canaryRes.pipe(res);
  });
  proxy.on("timeout", () => proxy.destroy(new Error("Canary timeout")));
  proxy.on("error", () => {
    if (!res.headersSent) posljiJson(res, 503, { ok: false, error: "Lokalni slovenski Handy/Canary ni zagnan." });
    else res.destroy();
  });
  req.pipe(proxy);
}

function posredujLokalniAtenaNemotron(req, res, requestUrl) {
  const dovoljenaPot = requestUrl.pathname.replace(/^\/__dev-atena-speech/, "");
  if (!["/health", "/session/start", "/session/audio", "/session/stop"].includes(dovoljenaPot)) {
    posljiJson(res, 404, { ok: false, error: "Atenina govorna pot ne obstaja." });
    return;
  }
  const dovoljeneMetode = dovoljenaPot === "/health" ? ["GET"] : ["POST"];
  if (!dovoljeneMetode.includes(req.method)) {
    posljiJson(res, 405, { ok: false, error: "Metoda ni dovoljena." });
    return;
  }
  const headers = {};
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
  if (req.headers["content-length"]) headers["content-length"] = req.headers["content-length"];
  if (req.headers["x-uj-prepis-session"]) headers["x-uj-prepis-session"] = req.headers["x-uj-prepis-session"];
  const proxy = http.request({
    hostname: "127.0.0.1",
    port: 8766,
    path: dovoljenaPot + requestUrl.search,
    method: req.method,
    headers,
    timeout: 300000,
  }, (nemotronRes) => {
    res.writeHead(nemotronRes.statusCode || 502, {
      "Content-Type": nemotronRes.headers["content-type"] || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    nemotronRes.pipe(res);
  });
  proxy.on("timeout", () => proxy.destroy(new Error("Nemotron timeout")));
  proxy.on("error", () => {
    if (!res.headersSent) posljiJson(res, 503, { ok: false, error: "Atenin lokalni nemški prepis ni zagnan." });
    else res.destroy();
  });
  req.pipe(proxy);
}

async function posredujIzvedbaApi(req, res, requestUrl) {
  if (req.method !== "GET" && req.method !== "POST") {
    posljiJson(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
    return;
  }

  try {
    const imaTelo = req.method === "POST";
    const telo = imaTelo ? await preberiTelo(req) : null;
    const glave = { Accept: "application/json" };
    if (req.headers.authorization) glave.Authorization = req.headers.authorization;
    if (imaTelo) glave["Content-Type"] = req.headers["content-type"] || "application/json";

    const cilj = new URL(requestUrl.pathname + requestUrl.search, izvedbaApiOrigin);
    const odgovor = await fetch(cilj, {
      method: req.method,
      headers: glave,
      body: imaTelo ? telo : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const rezultat = Buffer.from(await odgovor.arrayBuffer());
    res.writeHead(odgovor.status, {
      "Content-Type": odgovor.headers.get("content-type") || "application/json; charset=utf-8",
      "Content-Length": rezultat.length,
      "Cache-Control": "no-store",
    });
    res.end(rezultat);
  } catch (napaka) {
    const jeTimeout = napaka && (napaka.name === "TimeoutError" || napaka.name === "AbortError");
    posljiJson(res, jeTimeout ? 504 : 502, {
      ok: false,
      code: jeTimeout ? "REMOTE_API_TIMEOUT" : "REMOTE_API_UNAVAILABLE",
      napaka: jeTimeout
        ? "Potrditev je trajala predolgo. Poskusite znova; dvojni zapis je preprečen."
        : "Povezava s sistemom za zaključek primera trenutno ni uspela. Poskusite znova.",
    });
  }
}

function varniPrstniOdtisMape(mapa) {
  const resenaPot = fs.realpathSync(mapa);
  const kanonicnaPot = process.platform === "win32" ? resenaPot.toLowerCase() : resenaPot;
  return crypto.createHash("sha256").update(kanonicnaPot).digest("hex").slice(0, 16);
}

function gitVrednost(argumenti) {
  try {
    return childProcess.execFileSync("git", argumenti, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (_) {
    return "";
  }
}

function identitetaLokalnegaVira() {
  return {
    workspaceName: path.basename(root),
    workspaceHash: varniPrstniOdtisMape(root),
    branch: gitVrednost(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown",
    commit: gitVrednost(["rev-parse", "--short=12", "HEAD"]) || "unknown",
    dirty: Boolean(gitVrednost(["status", "--porcelain"])),
    appVersion: izracunajRazlicicoAplikacije(),
    apiVersion: izracunajApiRazlicico(),
    serverStartedAt: serverStartedAt,
  };
}

function posljiIdentitetoLokalnegaVira(req, res) {
  if (req.method !== "GET") {
    posljiJson(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
    return;
  }
  posljiJson(res, 200, { ok: true, localSource: identitetaLokalnegaVira() });
}


function postreziDatoteko(req, res) {
  let zahtevanaPot;
  try {
    zahtevanaPot = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Napačen naslov.");
    return;
  }

  if (zahtevanaPot === "/") zahtevanaPot = "/index.html";
  const relativnaPot = zahtevanaPot.replace(/^[/\\]+/, "");
  const datoteka = path.resolve(root, relativnaPot);

  if (datoteka !== root && !datoteka.startsWith(root + path.sep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Dostop ni dovoljen.");
    return;
  }

  fs.stat(datoteka, (napaka, stat) => {
    if (napaka || !stat.isFile()) {
      const telo = Buffer.from(`404 Not Found: ${zahtevanaPot}`);
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": telo.length,
      });
      res.end(telo);
      return;
    }

    const jeStisnjenIndeks = /[\\/]app[\\/]company-index[\\/][^\\/]+\.json\.gz$/i.test(datoteka);
    const tipVsebine = jeStisnjenIndeks
      ? "application/json; charset=utf-8"
      : mimeTypes[path.extname(datoteka).toLowerCase()] || "application/octet-stream";
    if (path.extname(datoteka).toLowerCase() === ".html") {
      fs.readFile(datoteka, "utf8", (napakaBranja, html) => {
        if (napakaBranja) {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Strani ni bilo mogoče prebrati.");
          return;
        }
        const osvezenHtml = html.includes("/app/version-sync.js")
          ? html
          : html.replace(/<\/head>/i, versionSyncOznaka + "\n  </head>");
        const telo = Buffer.from(osvezenHtml);
        res.writeHead(200, {
          "Content-Type": tipVsebine,
          "Content-Length": telo.length,
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Permissions-Policy": "camera=(self)",
          Pragma: "no-cache",
        });
        res.end(telo);
      });
      return;
    }

    res.writeHead(200, Object.assign({
      "Content-Type": tipVsebine,
      "Content-Length": stat.size,
      "Cache-Control": jeStisnjenIndeks ? "public, max-age=31536000, immutable" : "no-store, no-cache, must-revalidate",
      "Permissions-Policy": "camera=(self)",
    }, jeStisnjenIndeks ? { "Content-Encoding": "gzip" } : { Pragma: "no-cache" }));
    fs.createReadStream(datoteka).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, "http://localhost");
  const pathname = requestUrl.pathname;
  req.query = Object.fromEntries(requestUrl.searchParams.entries());
  if (pathname.startsWith("/__dev-handy-canary/")) {
    posredujLokalniCanary(req, res, requestUrl);
    return;
  }
  if (pathname.startsWith("/__dev-atena-speech/")) {
    posredujLokalniAtenaNemotron(req, res, requestUrl);
    return;
  }
  if (!process.env.LOCAL_IZVEDBA_API_ORIGIN && (pathname === "/api/pridobi-izvedbo" || pathname === "/api/izvedi-opomin-ukrep")) {
    naloziLokalnoSupabaseKonfiguracijo();
    const lokalniModul = pathname === "/api/pridobi-izvedbo" ? pridobiIzvedboModul : izvediOpominUkrepModul;
    if (imaVeljavenServiceRole()) void izvediLokalniApi(req, res, lokalniModul);
    else void posredujIzvedbaApi(req, res, requestUrl);
    return;
  }
  if (izvedbaApiPoti.has(pathname)) {
    void posredujIzvedbaApi(req, res, requestUrl);
    return;
  }
  if (pathname === "/api/razcleni-zgodovino") {
    naloziLokalnoSupabaseKonfiguracijo();
    void izvediLokalniApi(req, res, razcleniZgodovinoModul);
    return;
  }
  if (pathname === "/api/citaj-racun") {
    naloziLokalnoSupabaseKonfiguracijo();
    if (process.env.ANTHROPIC_API_KEY) void izvediLokalniApi(req, res, citajRacunModul);
    else void posredujBranjeRacuna(req, res);
    return;
  }
  if (pathname === "/api/aktiviraj-nacrt") {
    potrdiLokalniPredogledAktivacije(req, res);
    return;
  }
  if (pathname === "/api/mehka-boniteta") {
    void izvediLokalniApi(req, res, mehkaBonitetaModul);
    return;
  }
  if (pathname === "/api/mehka-boniteta-opravilo") {
    void izvediLokalniApi(req, res, mehkaBonitetaOpraviloModul);
    return;
  }
  if (pathname === "/api/mehka-boniteta-delavec") {
    void izvediLokalniApi(req, res, mehkaBonitetaDelavecModul);
    return;
  }
  if (pathname === "/api/boniteta-profili") {
    void izvediLokalniApi(req, res, bonitetaProModul);
    return;
  }
  if (pathname === "/api/openregister-pro") {
    void izvediLokalniApi(req, res, bonitetaProModul);
    return;
  }
  if (pathname === "/api/boniteta-pro") {
    void izvediLokalniApi(req, res, bonitetaProModul);
    return;
  }
  if (pathname === "/api/nemcija-posta") {
    void nemcijaPostaHandler(req, res);
    return;
  }
  if (pathname === "/api/pos-racun-pdf") {
    void izvediLokalniApi(req, res, posRacunPdfModul);
    return;
  }
  if (pathname === "/api/pos-racun-korekcija") {
    void izvediLokalniApi(req, res, posRacunKorekcijaModul);
    return;
  }
  if (pathname === "/api/pos-racun-xrechnung") {
    void izvediLokalniApi(req, res, posRacunXrechnungModul);
    return;
  }
  if (pathname === "/api/pos-racun-korekcija-xrechnung") {
    void izvediLokalniApi(req, res, posRacunKorekcijaXrechnungModul);
    return;
  }
  if (pathname === "/api/pos-dostava-sandbox") {
    void izvediLokalniApi(req, res, posDostavaSandboxModul);
    return;
  }
  if (pathname === "/api/pos-dostava-delavec") {
    void izvediLokalniApi(req, res, posDostavaDelavecModul);
    return;
  }
  if (pathname === "/api/pos-dostava-email") {
    void izvediLokalniApi(req, res, posDostavaEmailModul);
    return;
  }
  if (pathname === "/api/pos-dostava-webhook") {
    void izvediLokalniApi(req, res, posDostavaWebhookModul);
    return;
  }
  if (pathname === "/api/pos-fiskaly") {
    void izvediLokalniApi(req, res, posFiskalyModul);
    return;
  }
  if (pathname === "/api/pos-finapi") {
    void izvediLokalniApi(req, res, posFinapiModul);
    return;
  }
  if (pathname === "/api/pos-stripe-checkout") {
    void izvediLokalniApi(req, res, posStripeCheckoutModul);
    return;
  }
  if (pathname === "/api/pos-stripe-webhook") {
    void izvediLokalniApi(req, res, posStripeWebhookModul);
    return;
  }
  if (pathname === "/api/pos-arhiv") {
    void izvediLokalniApi(req, res, posArhivModul);
    return;
  }
  if (pathname === "/api/pos-verfahrensdokumentation-pdf") {
    void izvediLokalniApi(req, res, posVerfahrensdokumentationModul);
    return;
  }
  if (pathname === "/api/pos-datev") {
    naloziLokalnoSupabaseKonfiguracijo();
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) void izvediLokalniApi(req, res, posDatevModul);
    else void posredujZascitenApi(req, res, requestUrl.pathname + requestUrl.search);
    return;
  }
  if (pathname === "/__app-version") {
    posljiRazlicicoAplikacije(req, res);
    return;
  }
  if (pathname === "/__dev-source") {
    posljiIdentitetoLokalnegaVira(req, res);
    return;
  }
  postreziDatoteko(req, res);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Lokalna aplikacija: http://localhost:${port}`);
  const lokalniVir = identitetaLokalnegaVira();
  console.log(`Vir: ${lokalniVir.workspaceName} · ${lokalniVir.branch} · ${lokalniVir.commit} · ${lokalniVir.workspaceHash}`);
  console.log(`Telefon v istem omrežju: http://IP-RACUNALNIKA:${port}`);
  naloziLokalnoSupabaseKonfiguracijo();
  console.log(process.env.ANTHROPIC_API_KEY
    ? "Branje dokumentov uporablja lokalno API-funkcijo."
    : `Branje računov je povezano z: ${apiOrigin}/api/citaj-racun`);
  zazeniLokalniCanary();
  zazeniLokalniAtenaNemotron();
  console.log("Za ustavitev pritisnite Ctrl+C.");
});

process.once("exit", () => { ustaviLokalniCanary(); ustaviLokalniAtenaNemotron(); });
process.once("SIGINT", () => {
  ustaviLokalniCanary();
  ustaviLokalniAtenaNemotron();
  server.close(() => process.exit(0));
});
process.once("SIGTERM", () => {
  ustaviLokalniCanary();
  ustaviLokalniAtenaNemotron();
  server.close(() => process.exit(0));
});

server.on("error", (napaka) => {
  if (napaka.code === "EADDRINUSE") {
    console.error(`Vrata ${port} so že zasedena. Ustavite stari strežnik ali izberite druga vrata.`);
  } else {
    console.error("Strežnika ni bilo mogoče zagnati:", napaka.message);
  }
  process.exitCode = 1;
});

module.exports = server;
