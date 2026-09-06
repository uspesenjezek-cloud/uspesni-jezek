"use strict";

const assert = require("node:assert/strict");
const schema = require("../app/atena-card-schema");
const renderer = require("../app/atena-card-renderer");
const templates = require("../app/atena-card-templates");

const moduleRenders = schema.catalog.map((card) => ({
  card,
  html:renderer.questionShellHtml({
    ariaLabel:card.ariaLabel,
    title:card.title,
    description:card.description,
    question:card.question,
    step:1,
    total:1,
    contentHtml:renderer.moduleContentHtml(card, card.fields, {})
  })
}));
const productionHtml = moduleRenders.map((entry) => entry.html).join("\n");
const sourceSelects = productionHtml.match(/<select\b[^>]*>/g) || [];
const customTriggers = productionHtml.match(/data-atena-select-toggle\b/g) || [];
const selectModules = moduleRenders.filter((entry) => /<select\b/.test(entry.html));

assert.equal(schema.catalog.length, 89, "Audit mora pregledati vseh 89 Nazorjevih vprašalnih modulov.");
assert.equal(schema.catalog.flatMap((card) => card.fields).length, 140, "Audit mora pregledati vseh 140 Nazorjevih polj.");
assert.equal(selectModules.length, 12, "Custom izbirniki so pričakovani v 12 Nazorjevih modulih.");
assert.equal(sourceSelects.length, 15, "V celotnem produkcijskem katalogu je 15 izvornih select kontrol.");
assert.equal(customTriggers.length, sourceSelects.length, "Vsak izvorni select potrebuje svoj vidni custom combobox.");
sourceSelects.forEach((tag, index) => {
  assert.match(tag, /\bhidden\b/, `Izvorni select ${index + 1} mora biti skrit.`);
  assert.match(tag, /\btabindex="-1"/, `Izvorni select ${index + 1} ne sme ostati v zaporedju fokusa.`);
  assert.match(tag, /\baria-hidden="true"/, `Izvorni select ${index + 1} mora biti skrit bralnikom zaslona.`);
  assert.match(tag, /\bdata-atena-select-source\b/, `Izvorni select ${index + 1} mora biti povezan s custom izbirnikom.`);
});
assert.doesNotMatch(productionHtml, /<select(?![^>]*\bhidden\b)[^>]*>/, "Nazorjevi produkcijski izrisi ne smejo vsebovati uporabniku vidnega native selecta.");

const templateSurfaces = [
  ["kanonične predloge", templates.renderGallery()],
  ["FATHER kartice 2.0", templates.renderGallery("2.0")],
  ["Atenini widgeti 3.0", templates.renderGallery("3.0")]
];
const approvedTemplateCount = templates.templates.filter((template) => template.approved).length;
assert.equal(approvedTemplateCount, 62, "Audit mora vključiti vseh 62 kanoničnih Nazorjevih predlog.");
assert.equal(templates.categories["2.0"].records.length, 18, "Audit mora vključiti vseh 18 FATHER kartic.");
assert.equal(templates.categories["3.0"].records.length, templates.templates.length, "Kategorija 3.0 mora vključiti vse widget kartice, vključno z osnutki iz NAZORJEVA-TEST.");
templateSurfaces.forEach(([label, html]) => {
  assert.doesNotMatch(html, /<select\b|<option\b/, `${label} ne smejo vsebovati native sistemskega izbirnika.`);
});

console.log(`Nazorjeva native select audit: OK (${schema.catalog.length} modulov, 140 polj, ${sourceSelects.length} custom izbirnikov, 0 vidnih native selectov; 62 predlog + 18 FATHER variant)`);
