/**
 * Smoke: korak 2 – scroll lock sirote + open/close sheetov.
 * node scripts/scroll-lock-smoke.mjs
 */
import { chromium } from "playwright-core";
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";

const root = join(process.cwd(), "app");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};
const mockSupabase = `window.supabaseKlient={from:()=>({select(){return this;},eq(){return this;},order(){return this;},insert(){return this;},update(){return this;},delete(){return this;},then(r){return Promise.resolve({data:[],error:null}).then(r);}}),auth:{getSession:()=>Promise.resolve({data:{session:{user:{id:1}}},error:null}),getUser:()=>Promise.resolve({data:{user:{id:1}},error:null})},storage:{from:()=>({upload:()=>Promise.resolve({data:{},error:null}),getPublicUrl:()=>({data:{publicUrl:""}})})}};`;

const server = createServer((req, res) => {
  const p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p === "/supabase-client.js") {
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end(mockSupabase);
    return;
  }
  if (p === "/auth-zascita.js") {
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end("//ok");
    return;
  }
  const fp = join(root, p === "/" ? "neplacila-sporocilo.html" : p);
  if (!existsSync(fp)) {
    res.writeHead(404);
    res.end("404 " + p);
    return;
  }
  res.writeHead(200, { "Content-Type": mime[extname(fp)] || "text/plain" });
  res.end(readFileSync(fp));
});

async function canScroll(page) {
  return page.evaluate(async () => {
    const spacer = document.getElementById("scroll-test-spacer");
    if (!spacer) {
      const d = document.createElement("div");
      d.id = "scroll-test-spacer";
      d.style.height = "1400px";
      document.body.appendChild(d);
    }
    const before = window.scrollY;
    window.scrollTo(0, before + 200);
    await new Promise((r) => setTimeout(r, 40));
    const after = window.scrollY;
    window.scrollTo(0, 0);
    const locked =
      document.body.classList.contains("obrocno-sheet-odprt") ||
      document.body.classList.contains("rok-sheet-odprt") ||
      document.body.classList.contains("template-editor-odprt") ||
      document.body.classList.contains("uj-modal-odprt") ||
      document.body.style.position === "fixed" ||
      document.body.style.overflow === "hidden" ||
      document.body.style.touchAction === "none";
    return { scrolled: after > before + 40, locked, after, before };
  });
}

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 700 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));

  await page.addInitScript(() => {
    sessionStorage.setItem(
      "neplacilo-korak1-podatki",
      JSON.stringify({
        imeDolznika: "Janez",
        telefonDolznika: "040",
        emailDolznika: "a@b.c",
        znesek: "100",
        datumZapadlosti: "2026-07-01",
        stevilkaRacuna: "1",
        privzetiKanali: { sms: true, email: true },
      })
    );
  });

  await page.goto("http://127.0.0.1:" + port + "/neplacila-sporocilo.html", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("#sporocilo-besedilo", { timeout: 20000 });
  await page.waitForFunction(() => typeof window.UJSprostiGlavniScroll === "function");

  // 1) Umetna sirota locka → sprosti ob pointerdown
  await page.evaluate(() => {
    document.body.classList.add("rok-sheet-odprt", "obrocno-sheet-odprt");
    document.body.style.position = "fixed";
    document.body.style.top = "-120px";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    const ob = document.getElementById("obrocno-sheet");
    const rok = document.getElementById("rok-sheet");
    if (ob) ob.hidden = true;
    if (rok) rok.hidden = true;
  });
  await page.locator("#sporocilo-naslov").click({ force: true });
  await page.waitForTimeout(100);
  let r = await canScroll(page);
  console.log("sirota-after-gesture:", r);
  if (r.locked || !r.scrolled) {
    console.error("FAIL: sirota ni sproščena");
    process.exitCode = 1;
  }

  // 2) Odpri/zapri Obročno 5×
  let openCloseOk = 0;
  for (let i = 0; i < 5; i++) {
    await page.locator("#dodatek-obrocno").click();
    await page.waitForSelector("#obrocno-sheet:not([hidden])", { timeout: 3000 });
    await page.waitForTimeout(500);
    await page.locator("#obrocno-sheet-preklici").click();
    await page.waitForFunction(() => {
      const el = document.getElementById("obrocno-sheet");
      return el && el.hidden;
    }, null, { timeout: 3000 });
    await page.waitForTimeout(350);
    r = await canScroll(page);
    if (!r.locked && r.scrolled) openCloseOk++;
    else console.log("FAIL obrocno round", i + 1, r);
  }
  console.log("obrocno-open-close:", openCloseOk + "/5");

  // 3) Odpri/zapri Rok 5×
  let rokOk = 0;
  for (let i = 0; i < 5; i++) {
    await page.locator("#dodatek-rok").click();
    await page.waitForSelector("#rok-sheet:not([hidden])", { timeout: 3000 });
    await page.waitForTimeout(500);
    await page.locator("#rok-sheet-preklici").click();
    await page.waitForFunction(() => {
      const el = document.getElementById("rok-sheet");
      return el && el.hidden;
    }, null, { timeout: 3000 });
    await page.waitForTimeout(350);
    r = await canScroll(page);
    if (!r.locked && r.scrolled) rokOk++;
    else console.log("FAIL rok round", i + 1, r);
  }
  console.log("rok-open-close:", rokOk + "/5");

  // 4) Textarea focus/blur 5×
  let taOk = 0;
  for (let i = 0; i < 5; i++) {
    await page.locator("#sporocilo-besedilo").click();
    await page.locator("#sporocilo-besedilo").fill("x".repeat(80) + "\n" + i);
    await page.locator("#sporocilo-naslov").click({ force: true });
    await page.waitForTimeout(400);
    r = await canScroll(page);
    if (!r.locked && r.scrolled) taOk++;
    else console.log("FAIL textarea round", i + 1, r);
  }
  console.log("textarea-blur:", taOk + "/5");
  console.log("errs:", errs.join("|") || "none");

  await browser.close();
  server.close();
  if (openCloseOk !== 5 || rokOk !== 5 || taOk !== 5 || errs.length) {
    process.exit(1);
  }
})();
