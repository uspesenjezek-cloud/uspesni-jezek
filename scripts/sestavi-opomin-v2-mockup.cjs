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
  await stran.setViewport({ width: 430, height: 900, deviceScaleFactor: 2 });
  await stran.goto("file:///" + path.resolve(koren, "sestavi-opomin-v2.html").replace(/\\/g, "/"), { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900));
  await stran.screenshot({ path: path.join(koren, "sestavi-opomin-v2.png"), fullPage: true });
  await brskalnik.close();
  console.log("OK: sestavi-opomin-v2.png");
})().catch((e) => { console.error(e.message); process.exit(1); });
