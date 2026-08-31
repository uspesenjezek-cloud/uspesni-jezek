"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { performance } = require("node:perf_hooks");
const catalog = require("../app/svetovalec-storitve-engine");

assert.equal(catalog.version, "svetovalec-storitve-v1");
assert.deepEqual(catalog.services.map((service) => service.code), ["narocnina", "pogajanje", "ponudbe", "klic"]);

const expected = {
  narocnina: { accent:"#318fdd", areas:5, modules:15, required:[16101,16102,16104,16105,16107,16108,16111,16113,16116,16120,16121,16122] },
  pogajanje: { accent:"#855bd1", areas:5, modules:15, required:[16201,16202,16203,16204,16205,16206,16207,16208,16215,16216,16217] },
  ponudbe: { accent:"#159f9b", areas:5, modules:16, required:[16301,16302,16304,16305,16309,16313,16315,16317,16318,16319,16320] },
  klic: { accent:"#159f9b", areas:5, modules:15, required:[16401,16403,16406,16409,16410,16411,16412,16413,16415,16416,16419] }
};

const allIds = new Set();
catalog.services.forEach((service) => {
  const exp = expected[service.code];
  assert.equal(service.accent, exp.accent);
  assert.equal(service.areas.length, exp.areas);
  assert.equal(service.modules.length, exp.modules);
  assert.ok(service.areas.every((area) => area.moduleIds.length >= 3 && area.moduleIds.length <= 4));
  service.modules.forEach((module) => {
    assert.ok(module.question.endsWith("?"), service.code + "/" + module.code + " mora biti vprašanje");
    assert.ok(!allIds.has(module.id), "ID modula mora biti globalno enoličen: " + module.id);
    allIds.add(module.id);
  });
  service.fields.forEach((field) => {
    assert.ok(service.modules.some((module) => module.id === field.moduleId), "polje mora pripadati modulu");
    assert.ok(!allIds.has(field.id), "ID polja mora biti globalno enoličen: " + field.id);
    allIds.add(field.id);
    if (field.type === "select") assert.ok(field.options.length >= 3, "izbira potrebuje smiselne možnosti");
  });
  exp.required.forEach((id) => assert.equal(service.fields.find((field) => field.id === id)?.required, true, "manjka obvezno polje " + id));
  const schema = service.sestavi({ moduleIds:[service.modules[0].id] });
  assert.equal(schema.modules.length, 1);
  assert.equal(schema.modules[0].fields.length, service.fields.filter((field) => field.moduleId === service.modules[0].id).length);
  assert.equal(schema.contractVersion, "svetovalec-" + service.code + "-contract-v1");
});

const narocnina = catalog.get("narocnina");
assert.equal(narocnina.areas.find((area) => area.code === "trajanje").moduleIds.length, 3);
assert.ok(narocnina.modules.some((module) => /samodejno podaljšuje/.test(module.question)));
assert.ok(narocnina.fields.some((field) => field.id === 16115 && !field.required), "znani odpovedni rok ne sme blokirati zgodnjega toka");

const pogajanje = catalog.get("pogajanje");
assert.ok(pogajanje.fields.some((field) => field.id === 16212 && /strokovnjak/.test(field.help)), "pravni način izvedbe mora ostati strokovna odločitev");
assert.ok(!pogajanje.fields.some((field) => /vročit/i.test(field.label + " " + field.help)), "zgodnji tok ne sme zahtevati načina vročitve");

const ponudbe = catalog.get("ponudbe");
assert.ok(ponudbe.modules.some((module) => /koliko ponudb/i.test(module.question)));
assert.ok(ponudbe.fields.some((field) => field.id === 16319 && field.required), "deljenje podatkov mora biti izrecno pregledano");

const klic = catalog.get("klic");
assert.deepEqual(klic.fields.find((field) => field.id === 16416).options.map((option) => option.label), ["E-pošta", "SMS", "Telefon", "Priporočena pošta"]);
assert.ok(klic.fields.some((field) => field.id === 16417 && field.type === "date"));
assert.ok(klic.fields.some((field) => field.id === 16412 && /brez potrditve/.test(field.label + " " + field.help)));

assert.equal(catalog.get("ne-obstaja"), null);

const html = fs.readFileSync(require.resolve("../app/svetovalec-preverba.html"), "utf8");
const ui = fs.readFileSync(require.resolve("../app/svetovalec-preverba.js"), "utf8");
const css = fs.readFileSync(require.resolve("../app/styles.css"), "utf8");
["ponudba", "narocnina", "pogajanje", "ponudbe", "klic"].forEach((code) => assert.match(html, new RegExp('data-storitev="' + code + '"')));
assert.ok(html.indexOf("svetovalec-storitve-engine.js") < html.indexOf("svetovalec-preverba.js"));
assert.match(ui, /function nastaviAktivnoStoritev\(koda\)/);
assert.match(ui, /area \? area\.label : aktivnaStoritevMeta\.summaryTitle/);
assert.match(ui, /Uredite vsa vprašanja po korakih in nato potrdite zbrane odgovore\./);
assert.match(ui, /PONUDBA_OSNUTEK_SHRAMBA = novaKoda === "ponudba"/);
assert.match(ui, /odpriPonudbaNacin\("klic"\)/);
assert.match(css, /body\[data-storitev-tema\]:not\(\[data-storitev-tema="ponudba"\]\) \.ponudba-obrazec/);
assert.match(ui, /<select data-ponudba-field/);
assert.match(css, /\.atena-vprasanje-kartica/);
assert.match(css, /\.atena-vprasanje-kartica__spremeni/);

const timings = [];
for (let i = 0; i < 2000; i += 1) {
  const service = catalog.services[i % catalog.services.length];
  const started = performance.now();
  service.sestavi({ profileId:9001, offerModelIds:[9101], salesChannelIds:[9201], moduleIds:[service.modules[i % service.modules.length].id] });
  timings.push(performance.now() - started);
}
timings.sort((a, b) => a - b);
const p50 = timings[Math.floor(timings.length * .5)];
const p95 = timings[Math.floor(timings.length * .95)];
const max = timings[timings.length - 1];
assert.ok(p95 < 5, "p95 mora biti pod 5 ms");
console.log("Svetovalec storitve engine: OK (p50 " + p50.toFixed(3) + " ms, p95 " + p95.toFixed(3) + " ms, max " + max.toFixed(3) + " ms)");
