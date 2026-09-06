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
  fs.mkdirSync(koren, { recursive: true });
  const brskalnik = await puppeteer.launch({ executablePath: executable(), headless: true, args: ["--no-sandbox"] });
  const stran = await brskalnik.newPage();
  await stran.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const razlicice = [
    ["mockup-a.html", "omemba-radar-mockup-A.png"],
    ["mockup-b.html", "omemba-radar-mockup-B.png"],
    ["mockup-hitri-a.html", "hitri-odgovori-mockup-A.png"],
    ["mockup-hitri-b.html", "hitri-odgovori-mockup-B.png"],
    ["mockup-hitri-v1.html", "hitri-odgovori-V1-bento.png"],
    ["mockup-hitri-v2.html", "hitri-odgovori-V2-tema.png"],
    ["mockup-hitri-v3.html", "hitri-odgovori-V3-minimalna.png"],
    ["mockup-hitri-v4.html", "hitri-odgovori-V4-fitnes.png"],
    ["mockup-hitri-v5.html", "hitri-odgovori-V5-airbnb.png"],
    ["mockup-hitri-v6.html", "hitri-odgovori-V6-sportni.png"],
    ["mockup-hitri-v7.html", "hitri-odgovori-V7-obrt.png"],
  ];
  for (const [vir, slika] of razlicice) {
    await stran.goto("file:///" + path.resolve(koren, vir).replace(/\\/g, "/"), { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 700));
    await stran.screenshot({ path: path.join(koren, slika) });
    console.log("OK: " + slika);
  }
  await brskalnik.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
