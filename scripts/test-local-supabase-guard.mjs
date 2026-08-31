import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app", "supabase-client.js"), "utf8");
const syncSource = fs.readFileSync(path.join(root, "app", "opomin-kartice-sync.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app", "app.js"), "utf8");
const zamenjave = [];
const context = vm.createContext({
  SUPABASE_CONFIG: { url: "[SENSITIVE]", anonKey: "[SENSITIVE]" },
  supabase: { createClient() { throw new Error("ne sme biti poklicano"); } },
  console: { warn() {} },
  URL,
  URLSearchParams,
  window: {
    location: {
      hostname: "localhost",
      href: "http://localhost:8001/app/neplacila-posiljanje.html",
      replace(url) { zamenjave.push(String(url)); },
    },
  },
});

assert.doesNotThrow(() => vm.runInContext(source, context));
assert.equal(vm.runInContext("supabaseKlient", context), null);
assert.equal(zamenjave.length, 1);
assert.match(zamenjave[0], /app-preview=1/);
assert.match(source, /let supabaseKlient = null/);
assert.match(source, /\["localhost", "127\.0\.0\.1", "::1"\]/);
assert.match(source, /UJ_LOKALNI_PREDOGLED_BREZ_SUPABASE = jeLoopback/);
assert.doesNotMatch(source, /\^192\\\.168/);

let prejetiArgumenti = null;
const veljavenContext = vm.createContext({
  SUPABASE_CONFIG: { url: "https://primer.supabase.co", anonKey: "test-anon-key" },
  supabase: {
    createClient(...argumenti) {
      prejetiArgumenti = argumenti;
      return { auth: {} };
    },
  },
  console: { warn() {} },
  URL,
  URLSearchParams,
  window: {
    location: {
      hostname: "app.uspesni-jezek.si",
      href: "https://app.uspesni-jezek.si/neplacila.html",
      replace() {},
    },
  },
});

assert.doesNotThrow(() => vm.runInContext(source, veljavenContext));
assert.deepEqual(prejetiArgumenti, [
  "https://primer.supabase.co",
  "test-anon-key",
]);
assert.doesNotMatch(source, /lock\s*:\s*async/);
assert.match(syncSource, /typeof supabaseKlient === "undefined"\s*\|\|\s*!supabaseKlient\s*\|\|/);
assert.match(appSource, /typeof supabaseKlient !== "undefined"\s*&&\s*supabaseKlient\s*&&\s*supabaseKlient\.auth/);

console.log("OK: lokalni predogled ostane varen, Supabase Auth pa uporablja privzeto zaklepanje med zavihki");
