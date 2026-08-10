/**
 * Vizualni test: kartica dolga pri velikih zneskih (390px).
 * node scripts/debt-summary-overlap-check.mjs
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "tmp-visual");

function pageHtml(amount, category) {
  return `<!DOCTYPE html>
<html lang="sl"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="/app/styles.css" />
<style>
  body { margin: 0; background: #e8f0ef; font-family: system-ui, sans-serif; }
  .wrap { padding: 12px; box-sizing: border-box; }
</style>
</head><body>
<div class="wrap opomin-nacrt">
  <section class="step-content-card">
    <h3 class="step-content-card__title">Vsebina koraka</h3>
    <div class="debt-summary">
      <span class="debt-summary__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
      </span>
      <div class="debt-summary__main">
        <span class="debt-summary__label">Dolg</span>
        <span class="debt-summary__amount">${amount}</span>
      </div>
      <div class="debt-summary__category">
        <span class="debt-summary__category-label">Kategorija</span>
        <span class="debt-summary__category-value">${category}</span>
      </div>
    </div>
  </section>
</div>
</body></html>`;
}

const mime = { ".css": "text/css; charset=utf-8" };
let currentHtml = pageHtml("6.767,00 €", "Zelo visok dolg");

const server = createServer(async (req, res) => {
  try {
    if (req.url === "/" || req.url.startsWith("/?")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(currentHtml);
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
const cases = [
  { amount: "6.767,00 €", category: "Zelo visok dolg", file: "dolg-6767" },
  { amount: "64.676,00 €", category: "Zelo visok dolg", file: "dolg-64676" },
  { amount: "75,64 €", category: "Nizek dolg", file: "dolg-75" },
];

const report = [];
for (const c of cases) {
  currentHtml = pageHtml(c.amount, c.category);
  const page = await browser.newPage({
    viewport: { width: 390, height: 700 },
    deviceScaleFactor: 2,
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  const metrics = await page.evaluate(() => {
    const amount = document.querySelector(".debt-summary__amount");
    const badge = document.querySelector(".debt-summary__category-value");
    const a = amount.getBoundingClientRect();
    const b = badge.getBoundingClientRect();
    const overlap =
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top;
    return {
      amount: amount.textContent.trim(),
      badge: badge.textContent.trim(),
      amountBottom: a.bottom,
      badgeTop: b.top,
      gap: b.top - a.bottom,
      overlap,
      cols: getComputedStyle(document.querySelector(".debt-summary"))
        .gridTemplateColumns,
    };
  });
  const shot = join(outDir, `${c.file}-390.png`);
  await page.locator(".debt-summary").screenshot({ path: shot });
  report.push({ ...c, ...metrics, shot, ok: !metrics.overlap && metrics.gap > 0 });
  await page.close();
}

await browser.close();
server.close();
await writeFile(join(outDir, "debt-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.some((r) => !r.ok)) process.exit(1);
