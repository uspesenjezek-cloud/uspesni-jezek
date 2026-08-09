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
const mockSupabase = `window.supabaseKlient={from:()=>({select(){return this;},then(r){return Promise.resolve({data:[],error:null}).then(r);}}),auth:{getSession:()=>Promise.resolve({data:{session:{user:{id:1}}},error:null}),getUser:()=>Promise.resolve({data:{user:{id:1}},error:null})},storage:{from:()=>({upload:()=>Promise.resolve({data:{},error:null}),getPublicUrl:()=>({data:{publicUrl:""}})})}};`;

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

  // Zagotovi da je stran dovolj visoka za scroll.
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.id = "scroll-test-spacer";
    spacer.style.height = "1200px";
    document.body.appendChild(spacer);
  });

  let okCount = 0;
  const rounds = 10;
  for (let i = 0; i < rounds; i++) {
    await page.locator("#sporocilo-besedilo").click();
    await page.locator("#sporocilo-besedilo").fill(
      "Test sporočilo " + i + "\n".repeat(8) + "konec"
    );
    // Klik ven (naslov sklopa).
    await page.locator("#sporocilo-naslov").click({ force: true });
    await page.waitForTimeout(400);

    const state = await page.evaluate(async () => {
      const body = document.body;
      const locked =
        body.classList.contains("obrocno-sheet-odprt") ||
        body.classList.contains("rok-sheet-odprt") ||
        body.classList.contains("template-editor-odprt") ||
        body.classList.contains("uj-modal-odprt") ||
        body.style.position === "fixed" ||
        body.style.overflow === "hidden" ||
        body.style.touchAction === "none";

      const before = window.scrollY;
      window.scrollTo(0, before + 180);
      await new Promise((r) => setTimeout(r, 50));
      const after = window.scrollY;
      window.scrollTo(0, 0);
      return {
        locked,
        scrolled: after > before + 20,
        before,
        after,
        overflowY: getComputedStyle(document.getElementById("sporocilo-besedilo")).overflowY,
        bodyPosition: body.style.position,
        bodyOverflow: body.style.overflow,
        bodyTouch: body.style.touchAction,
        classes: body.className,
      };
    });

    if (!state.locked && state.scrolled) okCount++;
    else console.log("FAIL round", i + 1, state);
  }

  console.log("scroll-ok:", okCount + "/" + rounds, "errs:", errs.join("|") || "none");
  await browser.close();
  server.close();
  if (okCount !== rounds || errs.length) process.exit(1);
})();
