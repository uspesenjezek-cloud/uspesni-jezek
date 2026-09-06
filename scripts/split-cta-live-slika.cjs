const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

function executable() {
  return [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].find(fs.existsSync);
}

(async () => {
  const koren = path.resolve("output", "playwright", "omemba-radar");
  const brskalnik = await puppeteer.launch({ executablePath: executable(), headless: true, args: ["--no-sandbox"] });
  const stran = await brskalnik.newPage();
  await stran.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await stran.goto("http://localhost:8001/app/neplacila.html?app-preview=1", { waitUntil: "networkidle2", timeout: 45000 });
  await stran.waitForSelector(".osnutek-akcije .obrazec__split-cta", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1200));
  const tarca = await stran.$(".osnutek-akcije");
  await tarca.scrollIntoView();
  await new Promise((r) => setTimeout(r, 400));
  await stran.screenshot({ path: path.join(koren, "split-cta-live-390.png") });
  const okvir = await stran.$(".osnutek-akcije");
  await okvir.screenshot({ path: path.join(koren, "split-cta-live-narlozeno.png") });
  await stran.click("#gumb-shrani-stik");
  await new Promise((r) => setTimeout(r, 500));
  await okvir.screenshot({ path: path.join(koren, "split-cta-live-pritisnjeno.png") });
  await stran.click("#gumb-shrani-stik");
  await new Promise((r) => setTimeout(r, 300));
  await stran.type("#naziv-podjetja", "Test d.o.o.");
  await new Promise((r) => setTimeout(r, 300));
  await stran.click("#gumb-shrani-stik");
  await new Promise((r) => setTimeout(r, 600));
  await okvir.screenshot({ path: path.join(koren, "split-cta-live-pritisnjeno.png") });
  await stran.type("#naziv-podjetja", "Test d.o.o.");
  await new Promise((r) => setTimeout(r, 300));
  await stran.click("#gumb-shrani-stik");
  await new Promise((r) => setTimeout(r, 600));
  await okvir.screenshot({ path: path.join(koren, "split-cta-live-izbrano.png") });
  const izbranoPritisnjeno = await stran.$eval("#gumb-shrani-stik", (el) => el.getAttribute("aria-pressed"));
  const izbranoNapis = await stran.$eval(".obrazec__shrani-stik-napis", (el) => el.textContent);
  const shranjeniPred = await stran.evaluate(() => localStorage.length);
  await stran.click("#gumb-shrani-stik");
  await new Promise((r) => setTimeout(r, 300));
  const poOdjavi = await stran.$eval("#gumb-shrani-stik", (el) => el.getAttribute("aria-pressed"));
  await stran.evaluate(() => { const el = document.getElementById("naziv-podjetja"); if (el) el.value = ""; });
  await brskalnik.close();
  console.log("IZBRANO: aria-pressed=" + izbranoPritisnjeno + ", napis='" + izbranoNapis + "' | po drugem kliku aria-pressed=" + poOdjavi + " | localStorage dolzina=" + shranjeniPred);
})().catch((e) => { console.error(e.message); process.exit(1); });
