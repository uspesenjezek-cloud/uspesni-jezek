/**
 * Vizualni pregled wizard razmikov na 390px (iPhone 12 Pro širina).
 * Zaženi (serve mora teči na :8000 iz mape app):
 *   node scripts/wizard-spacing-screenshots.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "tmp-visual", "wizard-spacing");
const BASE = "http://127.0.0.1:8000";
const VIEW = { width: 390, height: 844, deviceScaleFactor: 2 };

const MOCK_K1 = {
  imeDolznika: "Demo d.o.o.",
  telefonDolznika: "041 123 456",
  emailDolznika: "demo@firma.si",
  znesek: 450,
  opisDolga: "Montaža oken",
  datumIzdajeRacuna: "2026-06-01",
  datumZapadlosti: "2026-06-15",
  stevilkaRacuna: "RA-100",
  racunDatotekePoti: [],
  shouldSendAttachment: false,
  attachmentOrigins: [],
  attachmentKanali: [],
  privzetiKanali: { sms: true, email: true },
};

async function bypassAuth(page) {
  await page.addInitScript(() => {
    const orig = window.location.href;
    Object.defineProperty(window, "__ujAuthBypass", { value: true });
    // prestrezi preusmeritve iz auth-zascita
    const desc = Object.getOwnPropertyDescriptor(window, "location");
    try {
      // no-op: bolj zanesljivo je stub getSession spodaj
    } catch (_e) {}
  });
  await page.route("**/auth-zascita.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "/* auth bypass for visual test */",
    });
  });
  await page.route("**/supabase-client.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        window.supabaseKlient = {
          auth: {
            getSession: async () => ({ data: { session: { user: { id: "viz" } } } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
          },
          from: () => ({
            select: () => ({
              eq: () => ({
                order: async () => ({ data: [], error: null }),
                maybeSingle: async () => ({ data: null, error: null }),
                single: async () => ({ data: null, error: null }),
              }),
              order: async () => ({ data: [], error: null }),
            }),
            insert: async () => ({ data: null, error: null }),
            update: () => ({ eq: async () => ({ data: null, error: null }) }),
            delete: () => ({ eq: async () => ({ data: null, error: null }) }),
            upsert: async () => ({ data: null, error: null }),
          }),
          storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
        };
      `,
    });
  });
}

async function seedSession(page, extra = {}) {
  await page.addInitScript(
    ({ k1, extra }) => {
      sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify(k1));
      if (extra.k2) {
        sessionStorage.setItem(
          "neplacilo-korak2-podatki",
          JSON.stringify(extra.k2)
        );
      }
    },
    {
      k1: MOCK_K1,
      extra,
    }
  );
}

async function measure(page, selectors) {
  return page.evaluate((sels) => {
    const out = {};
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) {
        out[sel] = null;
        continue;
      }
      const cs = getComputedStyle(el);
      out[sel] = {
        marginTop: cs.marginTop,
        marginBottom: cs.marginBottom,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        gap: cs.gap,
        height: cs.height,
        minHeight: cs.minHeight,
        overflow: cs.overflow,
        overflowY: cs.overflowY,
      };
    }
    return out;
  }, selectors);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 2,
  });

  const report = {};

  // --- Korak 1 ---
  {
    const page = await context.newPage();
    await bypassAuth(page);
    await page.goto(BASE + "/neplacila.html#obrazec", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(800);
    // poskrbi da je obrazec viden
    await page.evaluate(() => {
      document.body.className = "stran--neplacila stran--samo-obrazec stran--sporocilo";
    });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(OUT, "korak1-dolznik.png"),
      fullPage: true,
    });
    report.korak1 = await measure(page, [
      ".obrazec-razdelek",
      ".obrazec-razdelek + .obrazec-razdelek",
      ".contact-group",
      ".contact-inputs",
      ".racun-posiljanje",
      ".debt-stepper",
      ".korak-glava",
    ]);
    await page.close();
  }

  // --- Korak 2 ---
  {
    const page = await context.newPage();
    await bypassAuth(page);
    await seedSession(page, {
      k2: {
        sporocilo:
          "Pozdravljeni, prosimo za plačilo zapadlega računa v znesku 450,00 €.",
        sporociloKanali: { sms: true, email: true },
      },
    });
    await page.goto(BASE + "/neplacila-sporocilo.html", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const tone = document.getElementById("tone-recommendation-section");
      if (tone) tone.hidden = false;
      const seznam = document.getElementById("predlogi-seznam");
      if (seznam && !seznam.children.length) {
        for (let i = 1; i <= 3; i++) {
          const art = document.createElement("article");
          art.className = "predlog-kartica";
          art.innerHTML =
            '<div class="predlog-kartica__stevilka-ovoj"><span class="predlog-kartica__stevilka">' +
            i +
            "</span></div>" +
            '<p class="predlog-kartica__besedilo">Predloga ' +
            i +
            " – kratek primer besedila za preverjanje razmikov.</p>" +
            '<div class="predlog-kartica__akcije"></div>';
          seznam.appendChild(art);
        }
      }
      const ta = document.getElementById("sporocilo-besedilo");
      if (ta && !ta.value) {
        ta.value =
          "Pozdravljeni,\n\nprosimo za plačilo zapadlega računa.\nLep pozdrav";
      }
    });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, "korak2-sporocilo.png"),
      fullPage: true,
    });
    report.korak2 = await measure(page, [
      ".tone-recommendation-section",
      ".korak2-sklop--locen",
      ".korak2-textarea",
      "#predlogi-okvir",
      ".predlogi-okvir__vsebina",
      ".predlog-kartica",
      ".korak2__vsebina",
    ]);
    await page.close();
  }

  // --- Korak 3 ---
  {
    const page = await context.newPage();
    await bypassAuth(page);
    await seedSession(page, {
      k2: {
        sporocilo: "Test sporočilo",
        sporociloKanali: { sms: true, email: false },
      },
    });
    await page.goto(BASE + "/neplacila-posiljanje.html", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(1500);
    // če JS ni napolnil načrta, vstavi minimalno strukturo za merjenje
    await page.evaluate(() => {
      const root = document.getElementById("opomin-nacrt-glavni");
      if (root && !root.querySelector(".opomin-nacrt__vsebina")) {
        root.innerHTML =
          '<div class="opomin-nacrt__vsebina">' +
          '<div class="opomin-nacrt__povzetek"><p class="opomin-nacrt__povzetek-naslov">Povzetek</p><p class="opomin-nacrt__povzetek-vrednost">450,00 €</p></div>' +
          '<div class="opomin-nacrt__carousel-ovoj"><div class="opomin-nacrt__carousel">' +
          '<button type="button" class="opomin-nacrt__stage opomin-nacrt__stage--izbran"><span class="opomin-nacrt__stage-st">1</span><span class="opomin-nacrt__stage-naslov">1. opomin</span></button>' +
          '<button type="button" class="opomin-nacrt__stage"><span class="opomin-nacrt__stage-st">2</span><span class="opomin-nacrt__stage-naslov">2. opomin</span></button>' +
          '<button type="button" class="opomin-nacrt__stage"><span class="opomin-nacrt__stage-st">3</span><span class="opomin-nacrt__stage-naslov">Zadnji</span></button>' +
          "</div></div>" +
          '<div class="opomin-nacrt__cas-kartica"><p class="opomin-nacrt__sekcija-naslov">Časovnica</p></div>' +
          "</div>";
      }
    });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(OUT, "korak3-posiljanje.png"),
      fullPage: true,
    });
    report.korak3 = await measure(page, [
      ".opomin-nacrt__vsebina",
      ".opomin-nacrt__carousel",
      ".opomin-nacrt__povzetek",
      ".debt-stepper",
      ".korak2__vsebina--opomin",
    ]);
    await page.close();
  }

  fs.writeFileSync(
    path.join(OUT, "measures.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  // Preveri, da so glavni razmiki na lestvici
  const rootVars = await (async () => {
    const page = await context.newPage();
    await page.goto(BASE + "/neplacila.html", { waitUntil: "domcontentloaded" });
    const vars = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        xs: cs.getPropertyValue("--space-xs").trim(),
        sm: cs.getPropertyValue("--space-sm").trim(),
        md: cs.getPropertyValue("--space-md").trim(),
        lg: cs.getPropertyValue("--space-lg").trim(),
        xl: cs.getPropertyValue("--space-xl").trim(),
      };
    });
    await page.close();
    return vars;
  })();

  console.log("CSS tokens:", rootVars);
  console.log("Measures written to", path.join(OUT, "measures.json"));
  console.log("Screenshots:");
  console.log(" -", path.join(OUT, "korak1-dolznik.png"));
  console.log(" -", path.join(OUT, "korak2-sporocilo.png"));
  console.log(" -", path.join(OUT, "korak3-posiljanje.png"));

  // Assert tokens exist
  if (rootVars.xs !== "8px" || rootVars.lg !== "24px") {
    throw new Error("Spacing tokens niso pravilni: " + JSON.stringify(rootVars));
  }

  // Assert section separators use 24px
  const k1sep = report.korak1[".obrazec-razdelek + .obrazec-razdelek"];
  const k2sep = report.korak2[".korak2-sklop--locen"];
  if (k1sep && k1sep.marginTop !== "24px") {
    throw new Error("Korak1 section marginTop ni 24px: " + k1sep.marginTop);
  }
  if (k2sep && k2sep.marginTop !== "24px") {
    throw new Error("Korak2 sklop--locen marginTop ni 24px: " + k2sep.marginTop);
  }

  const ta = report.korak2[".korak2-textarea"];
  if (ta && Number.parseFloat(ta.minHeight) > 152) {
    throw new Error("Textarea min-height še prevelik: " + ta.minHeight);
  }
  if (ta && ta.overflowY !== "auto" && ta.overflow !== "hidden auto") {
    throw new Error("Textarea overflow-y ni auto: " + ta.overflowY);
  }

  await browser.close();
  console.log("PASS visual spacing checks");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
