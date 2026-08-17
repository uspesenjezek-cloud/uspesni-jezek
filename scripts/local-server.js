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
const citajRacunModul = require.resolve("../api/citaj-racun");
const mehkaBonitetaModul = require.resolve("../api/mehka-boniteta");
const mehkaBonitetaOpraviloModul = require.resolve("../api/mehka-boniteta-opravilo");
const mehkaBonitetaDelavecModul = require.resolve("../api/mehka-boniteta-delavec");
const bonitetaProModul = require.resolve("../api/boniteta-pro");
const nemcijaPostaHandler = require("../api/nemcija-posta");

// Lokalno uporabljamo isti vrstni red, omejitev in ponovitve, le da opravila
// hranimo v pomnilniku procesa, zato razvoj ne zahteva že izvedene migracije.
process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = "true";

const root = path.resolve(__dirname, "..");
const apiRoot = path.join(root, "api") + path.sep;
let nalozenaApiRazlicica = "";
const portArgument = process.argv.indexOf("--port");
const port = portArgument >= 0 ? Number(process.argv[portArgument + 1]) : 8001;
const apiOrigin = (process.env.LOCAL_OCR_API_ORIGIN || "https://uspesni-jezek.vercel.app").replace(/\/$/, "");
const maxRequestBytes = 8 * 1024 * 1024;
const versionSyncOznaka = '<script src="/app/version-sync.js?v=20260814-device-sync-v1"></script>';

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

function naloziLokalnoSupabaseKonfiguracijo() {
  try {
    if (!process.env.SUPABASE_URL || (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY)) {
      const vir = fs.readFileSync(path.join(root, "app", "config.js"), "utf8");
      const url = vir.match(/url:\s*["']([^"']+)["']/);
      const anonKey = vir.match(/anonKey:\s*["']([^"']+)["']/);
      if (url && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = url[1];
      if (anonKey && !process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = anonKey[1];
    }
    if (!process.env.OPENREGISTER_API_KEY || !process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENREGISTER_WEBHOOK_SECRET) {
      const okolje = fs.readFileSync(path.join(root, ".env.local"), "utf8");
      const openregister = okolje.match(/^\s*OPENREGISTER_API_KEY\s*=\s*["']?([^\r\n"']+)/m);
      if (openregister && !process.env.OPENREGISTER_API_KEY) process.env.OPENREGISTER_API_KEY = openregister[1].trim();
      const anthropic = okolje.match(/^\s*ANTHROPIC_API_KEY\s*=\s*["']?([^\r\n"']+)/m);
      if (anthropic && !process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = anthropic[1].trim();
      const serviceRole = okolje.match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?([^\r\n"']+)/m);
      if (serviceRole && !process.env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRole[1].trim();
      const webhookSecret = okolje.match(/^\s*OPENREGISTER_WEBHOOK_SECRET\s*=\s*["']?([^\r\n"']+)/m);
      if (webhookSecret && !process.env.OPENREGISTER_WEBHOOK_SECRET) process.env.OPENREGISTER_WEBHOOK_SECRET = webhookSecret[1].trim();
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

function posljiRazlicicoAplikacije(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    posljiJson(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
    return;
  }
  posljiJson(res, 200, { ok: true, version: izracunajRazlicicoAplikacije() });
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

    const tipVsebine = mimeTypes[path.extname(datoteka).toLowerCase()] || "application/octet-stream";
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
          Pragma: "no-cache",
        });
        res.end(telo);
      });
      return;
    }

    res.writeHead(200, {
      "Content-Type": tipVsebine,
      "Content-Length": stat.size,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    });
    fs.createReadStream(datoteka).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
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
  if (pathname === "/__app-version") {
    posljiRazlicicoAplikacije(req, res);
    return;
  }
  postreziDatoteko(req, res);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Lokalna aplikacija: http://localhost:${port}`);
  console.log(`Telefon v istem omrežju: http://IP-RACUNALNIKA:${port}`);
  naloziLokalnoSupabaseKonfiguracijo();
  console.log(process.env.ANTHROPIC_API_KEY
    ? "Branje dokumentov uporablja lokalno API-funkcijo."
    : `Branje računov je povezano z: ${apiOrigin}/api/citaj-racun`);
  console.log("Za ustavitev pritisnite Ctrl+C.");
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
