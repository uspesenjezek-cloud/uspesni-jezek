/**
 * Smoke test: TRR sheet na 390px (mock auth + Supabase).
 * Zagon: node scripts/trr-sheet-smoke.mjs
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "app");
const outDir = join(root, "..", "tmp-visual", "trr-sheet");
mkdirSync(outDir, { recursive: true });

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

const mockSupabaseJs = `
(function () {
  var store = [];
  function makeClient() {
    return {
      from: function (table) {
        var api = {
          _mode: "select",
          _data: null,
          select: function () { return this; },
          order: function () { return this; },
          insert: function (row) {
            var inserted = {
              id: "id-" + (store.length + 1),
              ime: row.ime,
              naziv_podjetja: row.naziv_podjetja,
              iban: row.iban,
              je_privzet: !!row.je_privzet,
              ustvarjeno_at: new Date().toISOString()
            };
            store.push(inserted);
            this._data = inserted;
            this._mode = "insert";
            return this;
          },
          single: function () {
            return Promise.resolve({ data: this._data, error: null });
          },
          then: function (resolve, reject) {
            if (this._mode === "insert") {
              return Promise.resolve({ data: this._data, error: null }).then(resolve, reject);
            }
            return Promise.resolve({ data: store.slice(), error: null }).then(resolve, reject);
          }
        };
        if (table !== "trr_racuni") {
          return {
            select: function () { return this; },
            then: function (r, j) {
              return Promise.resolve({ data: [], error: null }).then(r, j);
            }
          };
        }
        return api;
      },
      auth: {
        getSession: function () {
          return Promise.resolve({
            data: { session: { user: { id: "test-user" } } },
            error: null
          });
        },
        getUser: function () {
          return Promise.resolve({
            data: { user: { id: "test-user" } },
            error: null
          });
        }
      },
      storage: {
        from: function () {
          return {
            upload: function () { return Promise.resolve({ data: {}, error: null }); },
            getPublicUrl: function () { return { data: { publicUrl: "" } }; }
          };
        }
      }
    };
  }
  window.supabaseKlient = makeClient();
})();
`;

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/supabase-client.js") {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(mockSupabaseJs);
    return;
  }
  if (urlPath === "/auth-zascita.js") {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end("// mock: auth ok\n");
    return;
  }
  let filePath = join(root, urlPath === "/" ? "neplacila-sporocilo.html" : urlPath);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("404 " + urlPath);
    return;
  }
  const body = readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": mime[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(body);
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

const korak1 = {
  imeDolznika: "Janez Novak",
  telefonDolznika: "040123456",
  emailDolznika: "janez@example.com",
  znesek: "120.00",
  datumZapadlosti: "2026-07-01",
  stevilkaRacuna: "2026-001",
  privzetiKanali: { sms: true, email: true },
};

const report = { ok: true, steps: [], errors: [] };
function step(name, pass, detail) {
  report.steps.push({ name, pass, detail: detail || "" });
  if (!pass) report.ok = false;
  console.log((pass ? "OK  " : "FAIL") + " " + name + (detail ? " — " + detail : ""));
}

let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (err) => {
  report.errors.push(String(err));
  console.error("pageerror:", err);
});
page.on("console", (msg) => {
  if (msg.type() === "error") report.errors.push("console: " + msg.text());
});

await page.addInitScript((korak1) => {
  sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify(korak1));
  sessionStorage.removeItem("neplacilo-korak2-podatki");
}, korak1);

await page.goto(base + "/neplacila-sporocilo.html", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});

await page.waitForFunction(
  () =>
    location.pathname.includes("neplacila-sporocilo") &&
    typeof window.inicializirajTrrSheet === "function" &&
    document.getElementById("dodatek-trr"),
  { timeout: 30000 }
);

step(
  "stran naložena",
  await page.evaluate(
    () =>
      location.pathname.includes("neplacila-sporocilo") &&
      !!document.getElementById("dodatek-trr")
  )
);

await page.locator("#dodatek-trr").click();
await page.waitForSelector("#trr-sheet:not([hidden])", { timeout: 10000 });
step("odprt sheet", !(await page.locator("#trr-sheet").isHidden()));
step(
  "celoten meni je takoj viden",
  await page.locator("#trr-sheet-vsebina").isVisible()
);
step(
  "TRR je privzeto izklopljen",
  !(await page.locator("#trr-sheet-vkljuci").isChecked())
);

await page.locator("#trr-sheet-vkljuci").check();
step("prazno stanje", await page.locator("#trr-sheet-prazno").isVisible());

await page.locator("#trr-sheet-nov").click();
await page.locator("#trr-sheet-nov-ime").fill("Privzeti TRR");
await page.locator("#trr-sheet-nov-naziv").fill("Uspešni Jezek d.o.o.");
await page.locator("#trr-sheet-nov-iban").fill("SI56020020001234567");
await page.locator("#trr-sheet-nov-shrani").click();
await page.waitForSelector(".trr-sheet__kartica--izbrana", { timeout: 5000 });
step("nov račun", (await page.locator(".trr-sheet__kartica").count()) >= 1);

await page.locator("#trr-sheet-sklic").fill("SI002026-001");
const preview = await page.locator("#trr-sheet-preview").innerText();
step(
  "live preview",
  preview.includes("SI56") && preview.includes("SI002026-001"),
  preview
);

await page.screenshot({
  path: join(outDir, "trr-sheet-izpolnjen.png"),
  fullPage: false,
});

await page.locator("#trr-sheet-shrani").click();
await page.waitForSelector("#trr-sheet[hidden]", { state: "attached" });
let besedilo = await page.locator("#sporocilo-besedilo").inputValue();
step(
  "vrstica v textarea",
  besedilo.includes("Plačilo izvedite na TRR") && besedilo.includes("SI002026-001"),
  besedilo.slice(-140)
);
const stanje = await page.locator("#dodatek-trr-stanje").innerText();
step("pod-oznaka", /Privzeti/.test(stanje) && /4567/.test(stanje), stanje);

await page.locator("#dodatek-trr").click();
await page.waitForSelector("#trr-sheet:not([hidden])");
await page.locator("#trr-sheet-nov").click();
await page.locator("#trr-sheet-nov-ime").fill("Poslovni");
await page.locator("#trr-sheet-nov-naziv").fill("Drugo d.o.o.");
await page.locator("#trr-sheet-nov-iban").fill("SI56011001234567890");
await page.locator("#trr-sheet-nov-shrani").click();
await page.waitForTimeout(300);
await page.locator('input[name="trr-sheet-racun"]').nth(1).check();
await page.locator("#trr-sheet-sklic").fill("SI00DRUGI");
await page.locator("#trr-sheet-vkljuci").check();
await page.locator("#trr-sheet-shrani").click();
await page.waitForSelector("#trr-sheet[hidden]", { state: "attached" });
besedilo = await page.locator("#sporocilo-besedilo").inputValue();
const count = (besedilo.match(/Plačilo izvedite na TRR/g) || []).length;
step(
  "zamenjava vrstice",
  count === 1 && besedilo.includes("SI00DRUGI") && !besedilo.includes("SI002026-001"),
  "count=" + count
);

await page.locator("#dodatek-trr").click();
await page.waitForSelector("#trr-sheet:not([hidden])");
await page.locator("#trr-sheet-vkljuci").uncheck();
await page.locator("#trr-sheet-shrani").click();
await page.waitForSelector("#trr-sheet[hidden]", { state: "attached" });
besedilo = await page.locator("#sporocilo-besedilo").inputValue();
step("odstranitev", !besedilo.includes("Plačilo izvedite na TRR"));

await page.locator("#dodatek-trr").click();
await page.waitForSelector("#trr-sheet:not([hidden])");
await page.locator("#trr-sheet-vkljuci").check();
await page.locator("#trr-sheet-shrani").click();
await page.waitForSelector("#trr-sheet[hidden]", { state: "attached" });
await page.locator("#sporocilo-besedilo").evaluate((el) => {
  el.value = el.value.replace(
    /Plačilo izvedite na TRR[^\n]*/,
    "Plačilo izvedite na TRR SI56 XXXX, sklic SPREMENJENO. (ročno)"
  );
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.locator("#dodatek-trr").click();
await page.waitForSelector("#trr-sheet:not([hidden])");
await page.locator("#trr-sheet-shrani").click();
const potrdi = page.locator("#uj-potrdi-modal:not([hidden])");
await potrdi.waitFor({ timeout: 4000 }).catch(() => {});
const conflictOk = (await potrdi.count()) > 0;
step("conflict modal", conflictOk);
if (conflictOk) {
  await page.getByRole("button", { name: "Dodaj novo" }).click();
  await page.waitForSelector("#trr-sheet[hidden]", { state: "attached" });
}

await page.locator("#dodatek-trr").click();
await page.waitForSelector("#trr-sheet:not([hidden])");
await page.waitForTimeout(500);
await page.keyboard.press("Escape");
await page.waitForSelector("#trr-sheet[hidden]", { state: "attached" });
step("Escape", await page.locator("#trr-sheet").isHidden());

await page.locator("#dodatek-trr").click();
await page.waitForSelector("#trr-sheet:not([hidden])");
await page.waitForTimeout(500);
await page.locator("#trr-sheet-backdrop").evaluate((el) => el.click());
await page.waitForSelector("#trr-sheet[hidden]", { state: "attached" });
step("backdrop", await page.locator("#trr-sheet").isHidden());

await page.screenshot({
  path: join(outDir, "sporocilo-z-trr.png"),
  fullPage: false,
});

const jsErrs = report.errors.filter(
  (e) => !String(e).includes("404") && !String(e).includes("Failed to load resource")
);
step("brez JS napak", jsErrs.length === 0, jsErrs.join(" | "));

writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
server.close();
process.exit(report.ok ? 0 : 1);
