/*
 * Lokalni razvojni strežnik.
 *
 * - statične datoteke streže iz korena projekta;
 * - POST /api/citaj-racun posreduje produkcijski Vercelovi funkciji,
 *   zato lokalno ne potrebujemo ANTHROPIC_API_KEY.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const portArgument = process.argv.indexOf("--port");
const port = portArgument >= 0 ? Number(process.argv[portArgument + 1]) : 8000;
const apiOrigin = (process.env.LOCAL_OCR_API_ORIGIN || "https://uspesni-jezek.vercel.app").replace(/\/$/, "");
const maxRequestBytes = 8 * 1024 * 1024;

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

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(datoteka).toLowerCase()] || "application/octet-stream",
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
    void posredujBranjeRacuna(req, res);
    return;
  }
  postreziDatoteko(req, res);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Lokalna aplikacija: http://localhost:${port}`);
  console.log(`Telefon v istem omrežju: http://IP-RACUNALNIKA:${port}`);
  console.log(`Branje računov je povezano z: ${apiOrigin}/api/citaj-racun`);
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
