import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const koren = resolve("output", "playwright", "omemba-radar");
mkdirSync(koren, { recursive: true });

let brskalnik;
try {
  brskalnik = await chromium.launch({ channel: "chrome", headless: true });
} catch {
  brskalnik = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
}
const stran = await brskalnik.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await stran.goto("file:///" + resolve(koren, "mockup.html").replace(/\\/g, "/"));
await stran.waitForTimeout(1200);
await stran.screenshot({ path: resolve(koren, "omemba-radar-mockup-390.png"), fullPage: false });
await brskalnik.close();
console.log("OK: " + resolve(koren, "omemba-radar-mockup-390.png"));
