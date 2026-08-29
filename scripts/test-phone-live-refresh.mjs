import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app", "version-sync.js"), "utf8");
const server = fs.readFileSync(path.join(root, "scripts", "local-server.js"), "utf8");

assert.match(server, /server\.listen\(port, "0\.0\.0\.0"/);
assert.match(server, /"Cache-Control": "no-store, no-cache, must-revalidate"/);
assert.match(server, /version-sync\.js/);
assert.match(source, /lokalniAliZasebniNaslov/);
assert.match(source, /host === "localhost"/);
assert.match(source, /host === "127\.0\.0\.1"/);
assert.match(source, /\^192\\\.168\\\./);
assert.match(source, /\^10\\\./);
assert.match(source, /\^172\\\.\(1\[6-9\]\|2\\d\|3\[01\]\)\\\./);
assert.match(source, /lokalniAliZasebniNaslov\s*\|\|[\s\S]*app-auto-refresh/);
assert.match(source, /searchParams\.set\("_dev"/);
assert.match(source, /window\.location\.replace/);
assert.match(source, /setInterval\(preveriRazlicico, 2000\)/);
assert.match(source, /querySelectorAll\('link\[rel="stylesheet"\]\[href\], script\[src\]'/);
assert.match(source, /searchParams\.append\("asset", sredstvo\)/);
assert.match(server, /function izracunajRazlicicoSredstev\(sredstva\)/);
assert.match(server, /searchParams\.getAll\("asset"\)/);
assert.match(server, /version-sync\.js\?v=20260825-localhost-live-v4/);

console.log("OK: telefon osveži le ob spremembi sredstev odprte strani");
