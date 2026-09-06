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
  await stran.setViewport({ width: 420, height: 150, deviceScaleFactor: 3 });
  await stran.goto("file:///" + path.resolve(koren, "split-cta-cisto.html").replace(/\\/g, "/"), { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));
  await stran.screenshot({ path: path.join(koren, "split-cta-cisto.png") });
  await brskalnik.close();
  console.log("OK: split-cta-cisto.png");
})().catch((e) => { console.error(e.message); process.exit(1); });
