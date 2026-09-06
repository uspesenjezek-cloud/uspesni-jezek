"use strict";

const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const BASE = "http://localhost:8001/app/";
const OUTPUT = "C:\\Users\\jkjob\\Documents\\Codex\\2026-08-29\\uspesni-jezek-wizard-persistence\\outputs";
const pages = [
  ["index.html", "main.app__vsebina", "home"],
  ["zascita-posla.html", "main.app__vsebina", "zascita"],
  ["rast-priloznosti.html", "main.app__vsebina", "rast"],
  ["skrb-stranke-delavci.html", "main.app__vsebina", "skrb"],
  ["ugled-optimizacija.html", "main.app__vsebina", "ugled"],
  ["skupnost-obrtnikov.html", "main.app__vsebina", "skupnost"],
  ["svetovalec-preverba.html", "main.storitev-vsebina", "svetovalec"],
  ["bonitetna-preverba.html", "main.app__vsebina", "boniteta"],
  ["bonitetna-preverba.html", ".boniteta-zajem", "boniteta-zajem"],
  ["bonitetna-preverba.html", ".crif-flow-picker", "boniteta-picker"],
  ["bonitetna-preverba.html", "#boniteta-center-active", "boniteta-active"],
  ["bonitetna-preverba.html", "#boniteta-center-workspace", "boniteta-profiles"],
  ["aktivni-primeri.html", "main.aktivni-primeri-stran", "aktivni"],
  ["koncani-primeri.html", "main.koncani-primeri-stran", "koncani"],
  ["izvedba.html", ".izvedba-integrirana > .zo-sledi > .zo-sledi__vsebina", "izvedba"],
  ["zacasno-obvestila.html", "main.zacasno-obvestila", "obvestila"],
  ["pos-terminal.html", "main.pos-main", "pos"],
  ["slovenski-prepis.html", ".prepis-widget", "prepis"],
  ["prijava.html", "main.app__vsebina", "prijava"],
  ["neplacila.html#obrazec", "main.korak2__vsebina", "dolznik"],
  ["neplacila-zgodovina.html", "main.zgodovina-vsebina", "zgodovina"],
  ["neplacila-cilj.html", "main.zgodovina-vsebina", "cilj"],
  ["neplacila-posiljanje.html", "main.korak2__vsebina", "nacrt"],
];
const onlySlug = process.argv[2] || "";
const auditPages = onlySlug ? pages.filter((entry) => entry[2] === onlySlug) : pages;

function executable() {
  return [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].find(fs.existsSync);
}

async function measure(page, selector) {
  return page.$eval(selector, (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const left = rect.left + parseFloat(style.paddingLeft || 0);
    const right = innerWidth - (rect.right - parseFloat(style.paddingRight || 0));
    return {
      boxLeft: Number(rect.left.toFixed(2)),
      boxRight: Number((innerWidth - rect.right).toFixed(2)),
      contentLeft: Number(left.toFixed(2)),
      contentRight: Number(right.toFixed(2)),
      width: Number(rect.width.toFixed(2)),
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

(async () => {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: executable(), headless: true, args: ["--no-sandbox"] });
  const report = [];
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 980, height: 900 }]) {
      for (const [url, selector, slug] of auditPages) {
        const page = await browser.newPage();
        const consoleErrors = [];
        await page.setViewport(viewport);
        await page.evaluateOnNewDocument(() => {
          sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify({ potrjena: true, imeDolznika: "Vizualni test", znesek: 434, datumZapadlosti: "2026-01-01" }));
          sessionStorage.setItem("neplacilo-zgodovina-podatki", JSON.stringify({ potrjena: true, dogodki: [] }));
          sessionStorage.setItem("neplacilo-cilj-podatki", JSON.stringify({ potrjena: true, nacin: "rocno", cilj: { id: "celotno" } }));
        });
        page.on("console", (message) => {
          if (["error", "warning"].includes(message.type())) consoleErrors.push(`${message.type()}: ${message.text()}`);
        });
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (/auth-zascita\.js(?:\?|$)/.test(request.url())) {
            request.respond({ status: 200, contentType: "application/javascript", body: "/* visual audit auth bypass */" });
          } else if (/supabase-client\.js(?:\?|$)/.test(request.url())) {
            request.respond({
              status: 200,
              contentType: "application/javascript",
              body: `window.supabaseKlient={auth:{getSession:async()=>({data:{session:{user:{id:"visual-audit"}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>({select:()=>({eq:()=>({order:async()=>({data:[],error:null}),maybeSingle:async()=>({data:null,error:null}),single:async()=>({data:null,error:null})}),order:async()=>({data:[],error:null})}),insert:async()=>({data:null,error:null}),upsert:async()=>({data:null,error:null}),update:()=>({eq:async()=>({data:null,error:null})}),delete:()=>({eq:async()=>({data:null,error:null})})})};`,
            });
          } else {
            request.continue();
          }
        });
        await page.goto(`${BASE}${url}`, { waitUntil: "networkidle0", timeout: 30000 });
        await page.waitForSelector(selector, { timeout: 10000 });
        if (slug === "boniteta-active" || slug === "boniteta-profiles") {
          const view = slug === "boniteta-active" ? "active" : "profiles";
          await page.click(`[data-boniteta-center-view="${view}"]`);
          await page.waitForSelector(selector, { visible: true, timeout: 10000 });
        }
        if (slug === "izvedba") {
          await page.evaluate(() => {
            const article = document.querySelector(".izvedba-integrirana > .zo-sledi");
            const header = article && article.querySelector(".zo-sledi__glava");
            const content = article && article.querySelector(".zo-sledi__vsebina");
            if (!article || !header || !content) return;
            article.hidden = false;
            article.style.setProperty("--zo-accent", "#6cae90");
            article.style.setProperty("--zo-accent-rgb", "108,174,144");
            const error = document.getElementById("izvedba-napaka");
            if (error) error.hidden = true;
            header.innerHTML = '<span class="zo-sledi__ikona-krog" aria-hidden="true"></span><div><p class="zo-sledi__eyebrow">1. KORAK — Termin še ni določen</p><h1 class="zo-sledi__naslov">Čas je za prijazen opomin</h1></div>';
            content.innerHTML = '<div class="zo-sledi__povzetek"><span class="zo-sledi__povzetek-ikona"></span><p>Dolžniku bo poslan prijazen prvi opomin z jasnim pozivom k plačilu.</p></div><div class="zo-kapsula"><div class="zo-kapsula__polje"><span class="zo-kapsula__label">Dolžnik</span><strong class="zo-kapsula__vrednost">Vizualni test</strong></div></div><div class="izvedba-kontakti izvedba-kontakti--1"><div class="izvedba-kontakt"><span class="izvedba-kontakt__ikona"></span><span class="izvedba-kontakt__besedilo"><span class="izvedba-kontakt__label">E-pošta</span><strong class="izvedba-kontakt__vrednost">test@example.com</strong></span></div></div><div class="zo-sporocilo"><h2 class="zo-sporocilo__naslov">Celotno sporočilo dolžniku</h2><div class="zo-sporocilo__telo">To je lokalni vizualni pregled dejanskega produkcijskega ovoja kartic.</div></div>';
          });
        }
        const geometry = await measure(page, selector);
        report.push({ viewport: `${viewport.width}x${viewport.height}`, url, selector, geometry, consoleErrors });
        if (viewport.width === 390 && ["home", "boniteta", "boniteta-zajem", "boniteta-picker", "boniteta-active", "boniteta-profiles", "aktivni", "koncani", "izvedba", "obvestila", "pos", "prepis", "cilj"].includes(slug)) {
          await page.screenshot({ path: path.join(OUTPUT, `global-${slug}-${viewport.width}x${viewport.height}.png`), fullPage: false });
        }
        if (viewport.width === 980 && ["home", "boniteta", "boniteta-zajem", "boniteta-picker", "boniteta-active", "boniteta-profiles", "izvedba", "cilj"].includes(slug)) {
          await page.screenshot({ path: path.join(OUTPUT, `global-${slug}-${viewport.width}x${viewport.height}.png`), fullPage: false });
        }
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  const reportName = onlySlug ? `global-page-edge-audit-${onlySlug}.json` : "global-page-edge-audit.json";
  fs.writeFileSync(path.join(OUTPUT, reportName), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
