"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const approved = require("../NAZORJEVA");
const staging = require("../NAZORJEVA-TEST");
const templates = require("../app/atena-card-templates");

assert.equal(approved.name, "NAZORJEVA");
assert.equal(approved.status, "approved");
assert.equal(approved.widgets.length, 62, "NAZORJEVA mora vsebovati vseh 62 uporabniško odobrenih widgetov.");
assert.equal(new Set(approved.ids).size, approved.ids.length, "NAZORJEVA ne sme vsebovati podvojenih ID-jev.");
assert.deepEqual(approved.ids, templates.templates.filter((widget) => widget.approved).map((widget) => widget.id), "Vrstni red in ID-ji NAZORJEVA morajo ostati enaki odobrenemu delu rendererja.");
assert.deepEqual(approved.widgets.map(({ number, id, title }) => ({ number, id, title })), templates.templates.filter((widget) => widget.approved).map(({ number, id, title }) => ({ number, id, title })), "NAZORJEVA mora zakleniti številko, ID in naslov vsakega odobrenega widgeta.");
assert.deepEqual(templates.approvedTemplateIds, approved.ids, "Produkcijski register sme odobriti samo widgete iz NAZORJEVA.");
assert.ok(templates.templates.slice(0, 62).every((widget) => widget.approved), "Vseh 62 widgetov NAZORJEVA mora biti označenih kot potrjenih.");

assert.equal(staging.name, "NAZORJEVA-TEST");
assert.equal(staging.status, "test");
assert.equal(staging.widgets.length, 1, "NAZORJEVA-TEST trenutno vsebuje en osnutek (widget 63), ki čaka izrecno uporabnikovo odobritev.");
assert.deepEqual(staging.widgets[0], { number:63, id:"ugotovitev-preverbe", title:"Kaj smo ugotovili in kaj naj naredite?", status:"test", approved:false }, "Osnutek widgeta 63 mora ostati v natanko tej obliki, dokler ni izrecno odobren.");
assert.equal(new Set(staging.ids).size, staging.ids.length, "NAZORJEVA-TEST ne sme vsebovati podvojenih ID-jev.");
assert.ok(staging.widgets.every((widget) => widget.status === "test" && widget.approved !== true), "Testni widget ne sme biti označen kot odobren.");
assert.deepEqual(staging.ids.filter((id) => approved.ids.includes(id)), [], "Isti widget ne sme biti hkrati v NAZORJEVA in NAZORJEVA-TEST.");
assert.deepEqual(staging.ids, templates.templates.filter((widget) => !widget.approved).map((widget) => widget.id), "Vsak neodobren rendererjev widget mora biti v NAZORJEVA-TEST.");
assert.deepEqual(templates.templates.map((widget) => widget.id).filter((id) => !approved.ids.includes(id) && !staging.ids.includes(id)), [], "Vsak rendererjev widget mora biti evidentiran v odobrenem ali testnem registru.");
assert.deepEqual(approved.widgets.at(-1), { number:62, id:"sprememba-in-potrditev", title:"Sprememba in potrditev", status:"approved", approvedAt:"2026-08-31" }, "Kartica 62 mora biti zadnji odobreni widget registra NAZORJEVA.");

const agents = fs.readFileSync(path.join(__dirname, "..", "AGENTS.md"), "utf8");
assert.match(agents, /NAZORJEVA-TEST\.js/);
assert.match(agents, /izrecni uporabnikovi odobritvi/);
assert.match(agents, /NAZORJEVA\.js/);

console.log("NAZORJEVA: OK (62 odobrenih, 1 v testu)");
