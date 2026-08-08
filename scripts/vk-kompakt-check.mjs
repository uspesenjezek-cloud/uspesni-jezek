/**
 * Vizualni/computed check: SMS + priloge (kompakt).
 * node scripts/vk-kompakt-check.mjs
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "tmp-visual");

const pageHtml = `<!DOCTYPE html>
<html lang="sl"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<link rel="stylesheet" href="/app/styles.css" />
<style>
  body { margin: 0; background: #e8f0ef; font-family: "Figtree", system-ui, sans-serif; }
  .wrap { padding: 12px; box-sizing: border-box; max-width: 480px; }
</style>
</head><body>
<div class="wrap opomin-nacrt">
  <section class="step-content-card">
    <h3 class="step-content-card__title">Vsebina koraka</h3>
    <div class="vk-sporocilo-priloge">
      <div class="sms-preview">
        <div class="sms-preview__header">
          <span class="sms-preview__title">SMS</span>
          <span class="sms-preview__meta">319 znakov · 5 delov</span>
        </div>
        <div class="sms-preview__okno">
          <div class="sms-preview__viewport" tabindex="0">Pozdravljeni,

obveščamo vas, da račun št. R-2026-TEST-001 z dne 12. 3. 2026 v znesku 246,00 EUR še ni poravnan.

Prosimo, da znesek poravnate v 7 dneh.

Račune lahko varno pregledate tukaj: uj.link/r/demo123

Lep pozdrav,
Uspešni Jezek
</div>
        </div>
        <p class="sms-preview__caption">Celotno sporočilo uredite pri pregledu koraka.</p>
      </div>
      <div class="vk-dodaj-racun" role="group" aria-label="Dodaj račun">
        <span class="vk-dodaj-racun__ikona" aria-hidden="true">📎</span>
        <span class="vk-dodaj-racun__naslov">Dodaj račun</span>
        <button type="button" class="vk-dodaj-racun__gumb">Slikaj</button>
        <button type="button" class="vk-dodaj-racun__gumb">Uvozi</button>
      </div>
      <div class="vk-priloge-glava">
        <p class="vk-priloge-glava__naslov">Priloženi računi</p>
        <span class="vk-priloge-glava__stevilo">2</span>
      </div>
      <div class="vk-priloge-seznam" id="vk-priloge-seznam" role="list" style="height:81px;max-height:81px">
        <div class="vk-priloga-vrstica" role="listitem">
          <span class="vk-priloga-vrstica__ikona">📄</span>
          <div class="vk-priloga-vrstica__meta">
            <p class="vk-priloga-vrstica__ime">Racun-R-2026-TEST-001.pdf</p>
            <p class="vk-priloga-vrstica__velikost">246 KB</p>
          </div>
          <div class="vk-priloga-kanali">
            <button type="button" class="vk-kanal-gumb vk-kanal-gumb--sms-on" data-kanal="sms">✓ SMS</button>
            <button type="button" class="vk-kanal-gumb vk-kanal-gumb--email-on" data-kanal="email">✓ E-pošta</button>
          </div>
          <button type="button" class="vk-priloga-vrstica__odstrani">×</button>
        </div>
        <div class="vk-priloga-vrstica" role="listitem">
          <span class="vk-priloga-vrstica__ikona">📄</span>
          <div class="vk-priloga-vrstica__meta">
            <p class="vk-priloga-vrstica__ime">178622158-scan.jpg</p>
            <p class="vk-priloga-vrstica__velikost">1,2 MB</p>
          </div>
          <div class="vk-priloga-kanali">
            <button type="button" class="vk-kanal-gumb" data-kanal="sms">SMS</button>
            <button type="button" class="vk-kanal-gumb vk-kanal-gumb--email-on" data-kanal="email">✓ E-pošta</button>
          </div>
          <button type="button" class="vk-priloga-vrstica__odstrani">×</button>
        </div>
      </div>
    </div>
  </section>
</div>
</body></html>`;

const mime = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    if (req.url === "/" || req.url.startsWith("/?")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(pageHtml);
      return;
    }
    const p = join(root, decodeURIComponent(req.url.split("?")[0]));
    const data = await readFile(p);
    const ext = p.slice(p.lastIndexOf("."));
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("nf");
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const viewports = [
  { w: 320, h: 568 },
  { w: 375, h: 812 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
];

const report = [];
for (const vp of viewports) {
  const page = await browser.newPage({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 2,
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  const metrics = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const cs = (el) => getComputedStyle(el);
    const h = (el) => Math.round(el.getBoundingClientRect().height);
    const okno = q(".sms-preview__okno");
    const gumb = q(".vk-dodaj-racun__gumb");
    const kanal = q(".vk-kanal-gumb");
    const vrstica = q(".vk-priloga-vrstica");
    const seznam = q(".vk-priloge-seznam");
    const dodaj = q(".vk-dodaj-racun");
    const block = q(".vk-sporocilo-priloge");
    const view = q(".sms-preview__viewport");
    return {
      oknoH: h(okno),
      smsFont: cs(view).fontSize,
      smsFw: cs(view).fontWeight,
      dodajH: h(dodaj),
      gumbH: h(gumb),
      gumbMinH: cs(gumb).minHeight,
      gumbFs: cs(gumb).fontSize,
      gumbW: cs(gumb).width,
      kanalH: h(kanal),
      kanalMinH: cs(kanal).minHeight,
      kanalFs: cs(kanal).fontSize,
      vrsticaH: h(vrstica),
      seznamH: h(seznam),
      blockH: h(block),
      pageScrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    };
  });

  const file = `vk-kompakt-${vp.w}.png`;
  await page.locator(".vk-sporocilo-priloge").screenshot({
    path: join(outDir, file),
  });

  const checks = {
    oknoH: metrics.oknoH >= 170 && metrics.oknoH <= 192,
    smsFont: metrics.smsFont === "14px",
    dodajH: metrics.dodajH === 48,
    gumbH: metrics.gumbH === 32,
    gumbMinH: metrics.gumbMinH === "32px",
    kanalH: metrics.kanalH === 24,
    kanalMinH: metrics.kanalMinH === "24px",
    vrsticaH: metrics.vrsticaH === 54,
    seznamH: metrics.seznamH === 81,
    noHScroll: metrics.pageScrollW <= metrics.clientW + 1,
    blockUnder450: metrics.blockH <= 450,
  };
  const ok = Object.values(checks).every(Boolean);
  report.push({ viewport: vp.w, ok, metrics, checks, file });
  await page.close();
}

await writeFile(join(outDir, "vk-kompakt-report.json"), JSON.stringify(report, null, 2));
await browser.close();
server.close();

const failed = report.filter((r) => !r.ok);
console.log(JSON.stringify(report, null, 2));
if (failed.length) {
  console.error("FAIL", failed.map((f) => f.viewport));
  process.exit(1);
}
console.log("OK all viewports");
