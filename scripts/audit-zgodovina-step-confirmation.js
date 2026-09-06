"use strict";

const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "output", "playwright", "zgodovina-step-confirmation");
const URL = "http://localhost:8001/app/neplacila-zgodovina.html?app-preview=1";

function executable() {
  return [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].find(fs.existsSync);
}

function candidate(index) {
  return {
    candidateId: `candidate-${index + 1}`,
    type: "installment_payment",
    amount: 23,
    occurredDate: "2026-05-14",
    occurredDateUnknown: false,
    occurredDateApproximate: false,
    occurredDateApproximation: "",
    paymentMethod: "unknown",
    description: `${index + 1}/4 obrok`,
    fieldOrder: ["amount", "paymentMethod", "occurredDate"],
    requiredFields: ["amount", "paymentMethod", "occurredDate"],
    missing: [],
  };
}

function seedState() {
  const questionKeys = [0, 1, 2, 3].map((index) => `${index}:amount,paymentMethod,occurredDate`);
  return {
    step1: {
      potrjena: true,
      imeDolznika: "Vizualni test",
      znesek: 232,
      datumZapadlosti: "2022-12-21",
    },
    history: {
      potrjena: false,
      dogodki: [],
      naravniVnos: {
        engineVersion: "atena-v7",
        contractVersion: "history-fact-v99",
        mode: "natural",
        text: "plačal je štiri obroke po 23 evrov",
        requestId: "history:visual-step-confirmation",
        candidates: [0, 1, 2, 3].map(candidate),
        phase: "questions",
        questionIndex: 0,
        questionKeys,
        questionPlan: [],
        confirmedCandidateIds: [],
        questionGrouping: "candidate-engine-v1",
      },
    },
  };
}

async function stepState(page) {
  return page.evaluate(() => ({
    steps: Array.from(document.querySelectorAll("[data-ai-question-step]")).map((button) => ({
      label: button.textContent.trim(),
      current: button.classList.contains("is-current"),
      completed: button.classList.contains("is-completed"),
      upcoming: button.classList.contains("is-upcoming"),
      aria: button.getAttribute("aria-label"),
    })),
    title: document.querySelector(".zgodovina-ai-vprasanje h4")?.textContent.trim() || "",
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
}

function expectState(actual, expected, label) {
  const compact = actual.steps.slice(0, 4).map((step) => `${step.current ? "C" : "-"}${step.completed ? "D" : "-"}${step.upcoming ? "U" : "-"}`).join("|");
  if (compact !== expected || actual.overflow > 0) throw new Error(`${label}: ${compact}; overflow=${actual.overflow}`);
}

async function runViewport(browser, viewport) {
  const page = await browser.newPage();
  const errors = [];
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument((seed) => {
    if (!sessionStorage.getItem("neplacilo-korak1-podatki")) sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify(seed.step1));
    if (!sessionStorage.getItem("neplacilo-zgodovina-podatki")) sessionStorage.setItem("neplacilo-zgodovina-podatki", JSON.stringify(seed.history));
  }, seedState());
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const requestUrl = request.url();
    if (/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//.test(requestUrl) || /\/favicon\.ico(?:\?|$)/.test(requestUrl)) {
      await request.respond({ status: 204, body: "" });
      return;
    }
    if (/auth-zascita\.js(?:\?|$)/.test(requestUrl)) {
      await request.respond({ status: 200, contentType: "application/javascript", body: "/* history step audit auth bypass */" });
      return;
    }
    if (/supabase-client\.js(?:\?|$)/.test(requestUrl)) {
      await request.respond({
        status: 200,
        contentType: "application/javascript",
        body: "window.supabaseKlient={auth:{getSession:async()=>({data:{session:{access_token:'audit',user:{id:'audit'}}}}),getUser:async()=>({data:{user:{id:'audit'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};",
      });
      return;
    }
    await request.continue();
  });

  await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
  await page.waitForSelector('[data-ai-question-step="3"]', { visible: true, timeout: 15000 });
  const size = `${viewport.width}x${viewport.height}`;
  const initial = await stepState(page);
  expectState(initial, "C--|--U|--U|--U", "začetno stanje");
  await page.screenshot({ path: path.join(OUTPUT, `zgodovina-korak-1-${size}.png`), fullPage: true });

  await page.click("[data-ai-question-next]");
  await page.waitForFunction(() => document.querySelector('[data-ai-question-step="1"]')?.classList.contains("is-current"));
  const afterFirst = await stepState(page);
  expectState(afterFirst, "-D-|C--|--U|--U", "po potrditvi prvega");
  await page.screenshot({ path: path.join(OUTPUT, `zgodovina-korak-2-${size}.png`), fullPage: true });

  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector('[data-ai-question-step="1"].is-current', { visible: true, timeout: 15000 });
  const afterReload = await stepState(page);
  expectState(afterReload, "-D-|C--|--U|--U", "po osvežitvi");

  await page.click("[data-ai-question-next]");
  await page.waitForFunction(() => document.querySelector('[data-ai-question-step="2"]')?.classList.contains("is-current"));
  const afterSecond = await stepState(page);
  expectState(afterSecond, "-D-|-D-|C--|--U", "po potrditvi drugega");

  await page.click("[data-ai-question-next]");
  await page.waitForFunction(() => document.querySelector('[data-ai-question-step="3"]')?.classList.contains("is-current"));
  const afterThird = await stepState(page);
  expectState(afterThird, "-D-|-D-|-D-|C--", "po potrditvi tretjega");
  await page.screenshot({ path: path.join(OUTPUT, `zgodovina-korak-4-${size}.png`), fullPage: true });

  await page.click("[data-ai-question-next]");
  await page.waitForSelector("[data-ai-confirm-candidates]", { visible: true, timeout: 15000 });
  const review = await stepState(page);
  expectState(review, "-D-|-D-|-D-|-D-", "na povzetku");

  await page.click('[data-ai-question-step="0"]');
  const amount = await page.$('[data-ai-candidate-field="amount"]');
  await amount.click({ clickCount: 3 });
  await amount.type("24");
  const afterEdit = await stepState(page);
  expectState(afterEdit, "C--|-D-|-D-|-D-", "po spremembi potrjenega koraka");

  await page.close();
  if (errors.length) throw new Error(`${size} browser napake: ${errors.join(" | ")}`);
  return { viewport: size, initial, afterFirst, afterReload, afterSecond, afterThird, review, afterEdit };
}

(async () => {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: executable(), headless: true, args: ["--no-sandbox"] });
  try {
    const report = [];
    for (const viewport of [{ width: 390, height: 844 }, { width: 980, height: 900 }]) report.push(await runViewport(browser, viewport));
    fs.writeFileSync(path.join(OUTPUT, "report.json"), JSON.stringify(report, null, 2));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
