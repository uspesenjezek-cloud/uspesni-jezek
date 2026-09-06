"use strict";

const { performance } = require("node:perf_hooks");
const engine = require("../app/nazorjeva-engine");
const contract = require("../app/atena-widget-contract");
const schema = require("../app/atena-card-schema");

function stats(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const at = (percentile) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))];
  return { p50:at(0.50), p95:at(0.95), max:sorted.at(-1) };
}
function sample(rounds, operation) {
  const values = [];
  for (let index = 0; index < rounds; index += 1) {
    const started = performance.now();
    operation();
    values.push(performance.now() - started);
  }
  return stats(values);
}
function format(result) { return `p50 ${result.p50.toFixed(3)} ms, p95 ${result.p95.toFixed(3)} ms, max ${result.max.toFixed(3)} ms`; }

const fieldIds = schema.fieldContracts.map((field) => field.interfaceId);
const lookup = sample(1000, () => fieldIds.forEach((id) => schema.getFieldContract(id)));
const decision = sample(1000, () => {
  contract.contracts.forEach((widget) => contract.evaluate(widget.id, {
    scope:widget.scope,
    interaction:widget.allowedInteractions[0],
    semanticTags:widget.semanticTags,
    canonicalShape:widget.dataShape,
  }));
  engine.resolveInteraction({ dataType:"enum", options:Array.from({ length:12 }, (_, index) => ({ id:`o${index}`, label:`Možnost ${index}` })), viewportWidth:390 });
});
const offerSource = "Ponudnik je posrednik in cena je 100 EUR.";
const offerProposal = { contextVersion:schema.ponudbaQuestionManifest.contextVersion, interfaceId:"atena:field:ponudba:4009:5101", widgetId:"natancen-znesek", interaction:"money", evidenceSpans:["100 EUR"] };
const offerDecision = sample(1000, () => {
  schema.ponudbaQuestionManifest.questions.forEach((question) => schema.getCard("ponudba", question.moduleId));
  schema.resolvePonudbaQuestionProposal(offerProposal, offerSource);
});

console.log(`NAZORJEVA benchmark lookup 137 fields × 1000: ${format(lookup)}`);
console.log(`NAZORJEVA benchmark 62 decisions + resolver × 1000: ${format(decision)}`);
console.log(`NAZORJEVA benchmark ponudba manifest 25 + resolver × 1000: ${format(offerDecision)}`);
