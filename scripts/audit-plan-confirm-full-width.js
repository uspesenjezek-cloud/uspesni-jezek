"use strict";

const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const BASE = "http://localhost:8001/app/neplacila-posiljanje.html";
const OUTPUT = "C:\\Users\\jkjob\\Documents\\Codex\\2026-08-29\\uspesni-jezek-wizard-persistence\\outputs";
const TARGET_STEP = Number(process.argv[2] || 5);

function executable() {
  return [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].find(fs.existsSync);
}

async function prepare(page) {
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify({
      potrjena: true,
      imeDolznika: "Xjkx Jdjd",
      telefonDolznika: "994949",
      emailDolznika: "kdkd@gmail.com",
      znesek: 9446,
      datumZapadlosti: "2022-12-12",
      stevilkaRacuna: "Nsjs",
      privzetiKanali: { sms: true, email: true },
      racunDatotekePoti: [],
    }));
    sessionStorage.setItem("neplacilo-korak2-podatki", JSON.stringify({
      sporocilo: "Guten Tag, trotz Fälligkeit am 12.12.2022 und unserer bisherigen Erinnerungen ist die Rechnung Nr. Nsjs über 9.446,00 € noch offen.",
      sporociloKanali: { sms: true, email: true },
    }));
    sessionStorage.setItem("neplacilo-zgodovina-podatki", JSON.stringify({ potrjena: true, dogodki: [] }));
    sessionStorage.setItem("neplacilo-cilj-podatki", JSON.stringify({ potrjena: true, nacin: "rocno", cilj: { id: "celotno" } }));
  });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (/auth-zascita\.js(?:\?|$)/.test(request.url())) {
      request.respond({ status: 200, contentType: "application/javascript", body: "/* local visual auth bypass */" });
    } else if (/supabase-client\.js(?:\?|$)/.test(request.url())) {
      request.respond({
        status: 200,
        contentType: "application/javascript",
        body: `window.supabaseKlient={auth:{getSession:async()=>({data:{session:{user:{id:"visual-audit"}}}}),getUser:async()=>({data:{user:{id:"visual-audit"}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>({select:()=>({eq:()=>({order:async()=>({data:[],error:null}),maybeSingle:async()=>({data:null,error:null}),single:async()=>({data:null,error:null})}),order:async()=>({data:[],error:null})}),insert:async()=>({data:null,error:null}),upsert:async()=>({data:null,error:null}),update:()=>({eq:async()=>({data:null,error:null})}),delete:()=>({eq:async()=>({data:null,error:null})})})};`,
      });
    } else {
      request.continue();
    }
  });
}

async function geometry(page, selector) {
  return page.$eval(selector, (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      left: Number(rect.left.toFixed(2)),
      right: Number((innerWidth - rect.right).toFixed(2)),
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
  const results = [];
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 980, height: 900 }]) {
      const page = await browser.newPage();
      await page.setViewport(viewport);
      await prepare(page);
      await page.goto(BASE, { waitUntil: "networkidle0", timeout: 30000 });
      await page.evaluate((targetStep) => {
        const plan = JSON.parse(sessionStorage.getItem("neplacilo-korak3-nacrt") || "null");
        const targetIndex = targetStep - 1;
        if (!plan || !Array.isArray(plan.steps) || !plan.steps[targetIndex]) return;
        plan.steps.forEach((step, index) => {
          if (index < targetIndex) {
            step.status = "confirmed";
            step.confirmedAt = new Date().toISOString();
          } else if (index === targetIndex) {
            const sendAt = new Date();
            sendAt.setDate(sendAt.getDate() + 5);
            sendAt.setHours(10, 47, 0, 0);
            step.status = "needs_review";
            step.confirmedAt = null;
            step.sendAt = sendAt.toISOString();
            step.scheduledAt = sendAt.toISOString();
          }
        });
        plan.selectedStageId = plan.steps[targetIndex].id;
        sessionStorage.setItem("neplacilo-korak3-nacrt", JSON.stringify(plan));
      }, TARGET_STEP);
      await page.reload({ waitUntil: "networkidle0", timeout: 30000 });
      await page.waitForSelector(`[data-stage="${TARGET_STEP}"]`, { timeout: 15000 });
      await page.click(`[data-stage="${TARGET_STEP}"]`);
      const mainCardSelector = TARGET_STEP === 10 ? ".lp-enotni-widget" : ".step-content-card";
      await page.waitForSelector(mainCardSelector, { visible: true, timeout: 10000 });
      if (TARGET_STEP === 10) {
        await page.$eval(mainCardSelector, (element) => element.scrollIntoView({ block: "start" }));
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      const mainRoot = await geometry(page, ".opomin-nacrt__vsebina");
      const stepCard = await geometry(page, mainCardSelector);
      await page.screenshot({
        path: path.join(OUTPUT, `plan-step-${TARGET_STEP}-full-width-${viewport.width}x${viewport.height}.png`),
        fullPage: false,
      });
      if (TARGET_STEP === 10) {
        results.push({
          viewport: `${viewport.width}x${viewport.height}`,
          mainRoot,
          lawyerWidget: stepCard,
          packageCarousel: await geometry(page, ".lp-paket-carousel-ovoj"),
          packageCard: await geometry(page, ".lp-paket-kartica"),
        });
        await page.close();
        continue;
      }
      await page.waitForSelector("#opomin-nacrt-cta", { timeout: 10000 });
      await page.click("#opomin-nacrt-cta");
      await page.waitForSelector(".opomin-nacrt-potrdi__vsebina", { visible: true, timeout: 10000 });
      results.push({
        viewport: `${viewport.width}x${viewport.height}`,
        mainRoot,
        stepCard,
        root: await geometry(page, ".opomin-nacrt-potrdi__vsebina"),
        summary: await geometry(page, ".opomin-nacrt-potrdi__zlozen-povzetek"),
        message: await geometry(page, ".opomin-nacrt-potrdi__sms"),
      });
      await page.screenshot({
        path: path.join(OUTPUT, `plan-confirm-full-width-${viewport.width}x${viewport.height}.png`),
        fullPage: false,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
