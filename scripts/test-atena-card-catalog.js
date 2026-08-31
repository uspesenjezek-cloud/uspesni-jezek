"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "atena-card-catalog-"));
const generated = spawnSync(process.execPath, [path.join(__dirname, "generate-atena-card-catalog.js"), output], {
  cwd: root,
  encoding: "utf8"
});
assert.equal(generated.status, 0, generated.stderr || generated.stdout);

const html = fs.readFileSync(path.join(output, "atena-card-catalog.html"), "utf8");
const markdown = fs.readFileSync(path.join(output, "atena-card-inventory.md"), "utf8");
const match = html.match(/const records=(\[.*?\]);const colors=/s);
assert.ok(match, "Katalog mora vsebovati serializirane zapise.");
const records = JSON.parse(match[1]);

assert.equal(records.length, 130, "Katalog mora ohraniti vseh 130 kartic.");
assert.ok(records.every((record) => Array.isArray(record.interactions) && record.interactions.length), "Vsaka kartica potrebuje namenski način vnosa.");

const interactions = new Set(records.flatMap((record) => record.interactions));
[
  "choice-grid", "choice-segments", "choice-list", "dropdown", "quantity-unit", "duration", "money",
  "date", "long-text", "list-builder", "document-upload", "availability", "confirmation"
].forEach((type) => assert.ok(interactions.has(type), `Manjka interakcijski vzorec: ${type}`));

assert.ok(records.filter((record) => record.kind === "Področna kartica").every((record) => record.interactions.length === 1 && record.interactions[0] === "long-text"), "Področje, ki je že določeno, ne sme ponujati navidezne izbire.");
assert.ok(records.filter((record) => record.kind === "Ročna kartica").every((record) => record.interactions.includes("document-upload") && record.interactions.includes("long-text")), "Ročni pregled mora omogočiti dokument in pisno vprašanje.");
assert.ok(records.some((record) => record.title === "Proračun" && record.interactions.filter((value) => value === "money").length), "Ciljni in najvišji proračun morata uporabljati natančen denarni vnos.");
assert.ok(records.some((record) => record.title === "Enkratna cena" && record.interactions.includes("money")), "Natančen znesek mora ostati namenski denarni vnos.");
assert.ok(records.filter((record) => record.kind === "Vprašalna kartica").every((record) => record.productionHtml && record.moduleReason), "Vsaka vprašalna kartica mora izhajati iz produkcijskega rendererja in imeti razlog.");

assert.match(html, /id="interaction"/, "Katalog potrebuje filter po načinu vnosa.");
assert.match(html, /catalog-production/, "Katalog mora prikazati rezultat produkcijskega rendererja.");
assert.ok(records.some((record) => /data-atena-interaction="quantity-unit"/.test(record.productionHtml || "")), "Katalog potrebuje dejanski sestavljeni vnos količine.");
assert.ok(records.some((record) => /data-atena-interaction="document-upload"/.test(record.productionHtml || "")), "Katalog potrebuje dejanski vnos dokumenta.");
assert.match(markdown, /Priporočen vnos/, "Inventar mora dokumentirati odločitev o vmesniku.");
assert.match(markdown, /Dokazljiva matrika 89 modulov/);
assert.match(markdown, /Vsebinska matrika 137 polj/);
assert.doesNotMatch(`${html}\n${markdown}`, /ČAKA|Naslednja faza|obstoječi modal/i);

console.log(`Atena card catalog: OK (${records.length} kartic, ${interactions.size} namenskih vzorcev)`);
