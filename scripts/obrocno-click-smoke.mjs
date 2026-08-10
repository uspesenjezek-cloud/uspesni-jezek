/**
 * Smoke: korak 2 – Obročno kartica 10× odpre sheet + scroll na 390px.
 * node scripts/obrocno-click-smoke.mjs
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "app");
const outDir = join(root, "..", "tmp-visual", "obrocno-click");
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
  window.supabaseKlient = {
    from: function () {
      return {
        select: function () { return this; },
        then: function (r, j) {
          return Promise.resolve({ data: [], error: null }).then(r, j);
        }
      };
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
})();
`;

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/supabase-client.js") {
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    res.end(mockSupabaseJs);
    return;
  }
  if (urlPath === "/auth-zascita.js") {
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    res.end("// mock auth ok\n");
    return;
  }
  const filePath = join(root, urlPath === "/" ? "neplacila-sporocilo.html" : urlPath);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("404");
    return;
  }
  res.writeHead(200, {
    "Content-Type": mime[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(readFileSync(filePath));
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const korak1 = {
  imeDolznika: "Janez Novak",
  telefonDolznika: "040123456",
  emailDolznika: "janez@example.com",
  znesek: "350.00",
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
page.on("pageerror", (err) => report.errors.push(String(err)));

await page.addInitScript((korak1) => {
  sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify(korak1));
  sessionStorage.removeItem("neplacilo-korak2-podatki");
}, korak1);

await page.goto(base + "/neplacila-sporocilo.html", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForSelector("#dodatek-obrocno", { timeout: 30000 });

// Scroll page top→bottom several times
for (let i = 0; i < 3; i++) {
  await page.evaluate(async () => {
    const max = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 40));
    window.scrollTo(0, max);
    await new Promise((r) => setTimeout(r, 40));
    window.scrollTo(0, 0);
  });
}
step("scroll top/bottom ×3", true);

let opens = 0;
for (let i = 0; i < 10; i++) {
  await page.locator("#dodatek-obrocno").scrollIntoViewIfNeeded();
  await page.locator("#dodatek-obrocno").click();
  try {
    await page.waitForSelector("#obrocno-sheet:not([hidden])", { timeout: 2500 });
    opens += 1;
    // Zapri prek zapri gumba (dovoljeno takoj po ghost delay)
    await page.waitForTimeout(450);
    const zapri = page.locator("#obrocno-sheet-zapri");
    if (await zapri.isVisible()) {
      await zapri.click();
    } else {
      await page.evaluate(() => {
        const el = document.getElementById("obrocno-sheet");
        if (el) el.hidden = true;
        document.body.classList.remove("obrocno-sheet-odprt");
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.overflow = "";
      });
    }
    await page.waitForSelector("#obrocno-sheet[hidden]", {
      state: "attached",
      timeout: 2500,
    });
    await page.waitForTimeout(300);
  } catch (e) {
    report.errors.push("open#" + (i + 1) + ": " + e.message);
  }
}

step("obrocno odprt 10/10", opens === 10, opens + "/10");

await page.screenshot({
  path: join(outDir, "after-clicks.png"),
  fullPage: false,
});

const jsErrs = report.errors.filter(
  (e) => !String(e).includes("404") && !String(e).includes("Failed to load")
);
step("brez JS napak", jsErrs.length === 0, jsErrs.slice(0, 3).join(" | "));

writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
server.close();
process.exit(report.ok ? 0 : 1);
