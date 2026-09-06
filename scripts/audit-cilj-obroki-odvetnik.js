"use strict";

const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "output", "playwright", "cilj-obroki-odvetnik-v2");
const URL = "http://localhost:8001/app/neplacila-cilj.html?app-preview=1";
const SENTENCE = "hočem da mi plača v treh obrokih če ne grem do odvetnika";

function executable() {
  return [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].find(fs.existsSync);
}

function apiResponse(requestId) {
  return {
    ok: true,
    requestId,
    referenceDate: "2026-08-31",
    engineVersion: "atena-v7",
    contractVersion: "goal-fact-v18",
    model: "gpt-5.6-luna",
    semanticPlan: { status: "OK" },
    summary: "Plačilo preostanka v treh obrokih, nato pravna presoja.",
    clarification: null,
    clarificationExhausted: false,
    goals: [1, 2, 3].map((stepNumber) => ({
        goalId: "installment_plan",
        cardId: 3,
        stepNumber,
        confidence: "high",
        goalData: { targetAmount: "72", installmentAmount: "24", installmentCount: "3" },
        derivedFields: ["installmentAmount"],
        fieldOrder: ["targetAmount", "installmentAmount", "installmentCount", "firstPaymentDate", "frequency"],
        fieldIds: [101, 301, 302, 303, 304],
        requiredFields: ["targetAmount", "installmentCount", "firstPaymentDate", "frequency"],
        missing: ["firstPaymentDate", "frequency"],
        evidence: "plača v treh obrokih",
        requiresHumanReview: true,
      })).concat([
      {
        goalId: "legal_recovery",
        cardId: 9,
        stepNumber: 4,
        confidence: "high",
        goalData: { legalOutcome: "legal_route_review", legalNote: "če ne grem do odvetnika" },
        derivedFields: [],
        fieldOrder: ["legalOutcome", "legalAmount", "legalDeadline", "legalPriority", "legalNote"],
        fieldIds: [901, 902, 903, 904, 905],
        requiredFields: ["legalOutcome"],
        missing: [],
        evidence: "če ne grem do odvetnika",
        requiresHumanReview: true,
      },
    ]),
  };
}

async function runViewport(browser, viewport) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  let apiCalls = 0;
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify({
      potrjena: true,
      imeDolznika: "Vizualni test",
      znesek: 232,
      datumZapadlosti: "2022-12-21",
    }));
    sessionStorage.setItem("neplacilo-zgodovina-podatki", JSON.stringify({
      potrjena: true,
      dogodki: [{ znesek: 160, tip: "placilo" }],
    }));
    sessionStorage.removeItem("neplacilo-cilj-podatki");
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const requestUrl = request.url();
    if (/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//.test(requestUrl) || /\/favicon\.ico(?:\?|$)/.test(requestUrl)) {
      await request.respond({ status: 204, body: "" });
      return;
    }
    if (/auth-zascita\.js(?:\?|$)/.test(requestUrl)) {
      await request.respond({ status: 200, contentType: "application/javascript", body: "/* cilj audit auth bypass */" });
      return;
    }
    if (/supabase-client\.js(?:\?|$)/.test(requestUrl)) {
      await request.respond({
        status: 200,
        contentType: "application/javascript",
        body: `window.supabaseKlient={auth:{getSession:async()=>({data:{session:{access_token:"audit-token",user:{id:"cilj-audit"}}},error:null}),getUser:async()=>({data:{user:{id:"cilj-audit"}},error:null}),refreshSession:async()=>({data:{session:{access_token:"audit-token",user:{id:"cilj-audit"}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>({select(){return this},eq(){return this},order:async()=>({data:[],error:null}),maybeSingle:async()=>({data:null,error:null}),single:async()=>({data:null,error:null}),insert:async()=>({data:null,error:null}),upsert:async()=>({data:null,error:null}),update(){return this},delete(){return this}})};`,
      });
      return;
    }
    if (/\/api\/razcleni-cilj(?:\?|$)/.test(requestUrl)) {
      apiCalls += 1;
      let requestId = "";
      try {
        requestId = JSON.parse(request.postData() || "{}").requestId || "";
      } catch (_error) {}
      await request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(apiResponse(requestId)),
      });
      return;
    }
    await request.continue();
  });

  await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForSelector("[data-cilj-opis]", { visible: true, timeout: 15000 });
  await page.type("[data-cilj-opis]", SENTENCE);
  await page.click("[data-cilj-pripravi]");
  await page.waitForSelector('[data-cilj-ai-step="3"]', { visible: true, timeout: 15000 });
  await page.waitForSelector('[data-cilj-polje="installmentAmount"]', { visible: true, timeout: 15000 });

  const installment = await page.evaluate(() => ({
    target: document.querySelector('[data-cilj-polje="targetAmount"]')?.value || "",
    installmentAmount: document.querySelector('[data-cilj-polje="installmentAmount"]')?.value || "",
    installmentCount: document.querySelector('[data-cilj-polje="installmentCount"]')?.value || "",
    steps: document.querySelectorAll("[data-cilj-ai-step]").length,
    stepLabels: Array.from(document.querySelectorAll("[data-cilj-ai-step]")).map((item) => item.textContent.trim()),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    nextDisabled: Boolean(document.querySelector("[data-cilj-ai-next]")?.disabled),
  }));
  if (installment.target !== "72" || installment.installmentAmount !== "24" || installment.installmentCount !== "3") {
    throw new Error(`Napačni podatki obroka: ${JSON.stringify(installment)}`);
  }
  if (installment.steps !== 4 || installment.stepLabels.join(",") !== "1,2,3,4" || installment.overflow > 0) throw new Error(`Napačni koraki ali overflow: ${JSON.stringify(installment)}`);
  const size = `${viewport.width}x${viewport.height}`;
  await page.screenshot({ path: path.join(OUTPUT, `cilj-obroki-${size}.png`), fullPage: true });

  const installmentTitles = [];
  for (const stepIndex of [0, 1, 2]) {
    await page.click(`[data-cilj-ai-step="${stepIndex}"]`);
    installmentTitles.push(await page.$eval(".zgodovina-ai-vprasanje h4", (node) => node.textContent.trim()));
  }
  if (installmentTitles.join("|") !== "Dopolnite 1/3 obrok|Dopolnite 2/3 obrok|Dopolnite 3/3 obrok") {
    throw new Error(`Lunini obroki niso ohranjeni kot trije koraki: ${JSON.stringify(installmentTitles)}`);
  }
  await page.click('[data-cilj-ai-step="3"]');
  await page.waitForSelector(".zgodovina-ai-pogovor--akcija-odvetnik", { visible: true, timeout: 10000 });
  const legal = await page.evaluate(() => ({
    text: document.querySelector(".zgodovina-ai-pogovor--akcija-odvetnik")?.innerText || "",
    currentStep: document.querySelector('[data-cilj-ai-step="3"]')?.getAttribute("aria-current") || "",
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  if (legal.currentStep !== "step" || !/pravn|odvet/i.test(legal.text) || legal.overflow > 0) {
    throw new Error(`Pravni korak ni pravilno prikazan: ${JSON.stringify(legal)}`);
  }
  await page.screenshot({ path: path.join(OUTPUT, `cilj-odvetnik-${size}.png`), fullPage: true });
  await page.close();
  return { viewport: size, apiCalls, installment, installmentTitles, legal, consoleErrors, pageErrors };
}

(async () => {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: executable(), headless: true, args: ["--no-sandbox"] });
  try {
    const report = [];
    for (const viewport of [{ width: 390, height: 844 }, { width: 980, height: 900 }]) {
      report.push(await runViewport(browser, viewport));
    }
    if (report.some((entry) => entry.apiCalls !== 1 || entry.consoleErrors.length || entry.pageErrors.length)) {
      throw new Error(`Browser audit napake: ${JSON.stringify(report, null, 2)}`);
    }
    fs.writeFileSync(path.join(OUTPUT, "report.json"), JSON.stringify(report, null, 2));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
