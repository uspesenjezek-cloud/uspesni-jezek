import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "app");
const bundlePath = path.join(appDir, "vendor-data.js");
const bundle = fs.readFileSync(bundlePath, "utf8");

assert.ok(bundle.length > 100_000, "Podatkovni paket je nepričakovano majhen.");
assert.match(bundle, /globalThis\.supabase=/, "Paket ne objavi globalnega Supabase API-ja.");

const htmlFiles = fs.readdirSync(appDir).filter((name) => name.endsWith(".html"));
let protectedPageCount = 0;

for (const name of htmlFiles) {
  const html = fs.readFileSync(path.join(appDir, name), "utf8");
  assert.doesNotMatch(html, /(?:cdn\.jsdelivr\.net|unpkg\.com)\/npm\/@supabase\/supabase-js/);
  if (!html.includes("supabase-client.js")) continue;
  protectedPageCount += 1;
  const sdkIndex = html.indexOf("vendor-data.js");
  const clientIndex = html.indexOf("supabase-client.js");
  assert.ok(sdkIndex >= 0 && sdkIndex < clientIndex, `${name}: lokalni SDK mora biti pred supabase-client.js.`);
}

assert.ok(protectedPageCount >= 16, "Vseh zaščitenih strani nismo preverili.");
console.log(`Lokalni Supabase paket in vrstni red skript sta preverjena na ${protectedPageCount} straneh.`);
