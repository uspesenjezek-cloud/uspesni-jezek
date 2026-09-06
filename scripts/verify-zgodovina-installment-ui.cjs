"use strict";

const { chromium } = require("C:/Users/jkjob/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright");
const historyEngine = require("../api/_lib/zgodovina-naravni-vnos");

const URL = "http://localhost:8001/app/izvedba.html?zadevaId=58090d97-bedc-4061-9934-1f360aa6622c&app-preview=1";

async function main() {
  const width = Number(process.env.UJ_HISTORY_VIEW_WIDTH || 390);
  const height = Number(process.env.UJ_HISTORY_VIEW_HEIGHT || 844);
  const label = String(process.env.UJ_HISTORY_VIEW_LABEL || (width + "x" + height));
  const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const page = await browser.newPage({ viewport: { width: width, height: height } });
  const sourceText = "plačal je 4 obroke vsak obrok je bil 200 in vsak obrok je bil 2 tedna narazen";
  const compactPlan = Array.from({ length: 4 }, function (_, index) {
    return {
      n: index + 1, c: 3, e: sourceText,
      f: [
        { i: 1, v: 200, e: "200", r: [652] },
        { i: 2, v: null, e: sourceText, r: index === 0 ? [] : [601, 611, 622, 633, 2, 642, null] },
        { i: 8, v: (index + 1) + "/4 obrok", e: sourceText, r: [] },
      ],
    };
  });
  const parsedHistory = await historyEngine.analyze(sourceText, {
    referenceDate: "2026-08-30", originalDebt: 9446, remainingDebt: 9446,
  }, {
    apiKey: "ui-contract-mock",
    fetchImpl: async function () {
      return { ok: true, status: 200, json: async function () { return { output_text: JSON.stringify({ p: compactPlan, q: null, x: null }) }; } };
    },
  });
  await page.route("**/supabase-client.js", function (route) {
    return route.fulfill({
      contentType: "application/javascript",
      body: "window.supabaseKlient={auth:{getSession:async()=>({data:{session:{access_token:'local-preview',user:{id:'local-preview-user'}}}}),getUser:async()=>({data:{user:{id:'local-preview-user'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:()=>{}};",
    });
  });
  await page.route("**/api/pridobi-izvedbo**", function (route) {
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        zadeva: { id: "58090d97-bedc-4061-9934-1f360aa6622c", imeDolznika: "Xjkx Jdjd", opisDolga: "Test", status: "active", znesek: 9446, prvotniZnesek: 9446, preostaliDolg: 9446, placanoSkupaj: 0, telefonDolznika: "", emailDolznika: "", stevilkaRacuna: "", datumZapadlosti: "2022-12-12" },
        plan: { steps: [] }, steps: [], ukrepi: [], currentStepId: null, totalSteps: 0, emailNaVoljo: false,
      }),
    });
  });
  if (process.env.UJ_HISTORY_MOCK_LUNA === "1") {
    await page.route("**/api/razcleni-zgodovino", function (route) {
      var requestId = "ui-contract-mock";
      try { requestId = JSON.parse(route.request().postData() || "{}").requestId || requestId; } catch (_error) {}
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(Object.assign({ ok: true, requestId: requestId }, parsedHistory)) });
    });
  }
  page.on("console", function (message) { if (message.type() === "error") console.error("console:", message.text()); });
  page.on("pageerror", function (error) { console.error("pageerror:", error.message); });
  await page.goto(URL, { waitUntil: "networkidle" });
  console.log("loaded");
  await page.evaluate(function () {
    var debug = window.UJPoravnavaWidget;
    debug.state.assistedHistoryInputActive = false;
    debug.state.actionSheetMode = "lawyer";
    debug.state.lawyerWizard = null;
    debug.state.actionSheetOpen = true;
    debug.state.selectedSettlementType = null;
    window.UJZgodovinaNastaviPrivzetiNacin("natural");
    debug.izrisiActionSheet();
  });
  console.log("history clicked");
  await page.waitForTimeout(250);
  await page.locator("[data-ai-text]").fill(sourceText);
  await page.locator("[data-ai-analyze]").click();
  await page.locator("[data-ai-history-date]").first().waitFor({ state: "visible", timeout: 30000 });
  var metrics = await page.evaluate(function () {
    var date = document.querySelector("[data-ai-history-date]");
    var card = document.querySelector(".zgodovina-ai-vprasanje");
    return {
      bodyText: document.body.innerText.slice(0, 5000),
      dateValue: date && date.value,
      dateMax: date && date.max,
      cardTitle: card && card.querySelector("h4") && card.querySelector("h4").textContent,
      labels: Array.from(card ? card.querySelectorAll(".zgodovina-ai-vprasanje__oznaka") : []).map(function (node) { return node.textContent.trim(); }),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: innerWidth,
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: innerHeight,
      panelScrollHeight: document.querySelector(".izvedba-action-sheet__scroll").scrollHeight,
      panelClientHeight: document.querySelector(".izvedba-action-sheet__scroll").clientHeight,
    };
  });
  console.log(JSON.stringify(metrics, null, 2));
  await page.locator("[data-ai-history-date]").first().click();
  await page.waitForTimeout(100);
  console.log("date after picker open:", await page.locator("[data-ai-history-date]").first().inputValue());
  await page.screenshot({ path: "C:/Users/jkjob/Documents/Codex/2026-08-29/nadaljuj-neposredno-aktivni-popravek-v-projektu/outputs/atena-luna-authority-v91-" + label + ".png", fullPage: true });
  var scroll = await page.locator(".izvedba-action-sheet__scroll").evaluate(function (element) {
    var before = element.scrollTop;
    element.scrollTop = element.scrollHeight;
    return { before: before, after: element.scrollTop, canScroll: element.scrollHeight <= element.clientHeight || element.scrollTop > before };
  });
  console.log("panel scroll:", JSON.stringify(scroll));
  if (metrics.cardTitle !== "Dopolnite 1/4 obrok" || metrics.dateMax !== "2026-07-05" || metrics.dateValue !== "" || metrics.scrollWidth > metrics.innerWidth) process.exitCode = 1;
  if (!scroll.canScroll) process.exitCode = 1;
  await browser.close();
}

main().catch(function (error) { console.error(error); process.exit(1); });
