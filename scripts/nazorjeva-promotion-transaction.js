"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const engine = require("../app/nazorjeva-engine");

function js(value) { return JSON.stringify(value, null, 2); }
function registryWidget(record, status, approvedAt) {
  const base = {
    number:Number(record.number), id:String(record.id), title:String(record.title), status,
  };
  if (status === "approved") base.approvedAt = approvedAt;
  return base;
}
function serializeApproved(widgets) {
  const rows = widgets.map((record) => {
    const row = registryWidget(record, "approved", record.approvedAt);
    return `  widget(${row.number}, ${JSON.stringify(row.id)}, ${JSON.stringify(row.title)}, ${JSON.stringify(row.approvedAt)})`;
  }).join(",\n");
  return `"use strict";\n\n// Generirani kanonični register. Spreminja ga samo preverjena NAZORJEVA promocijska transakcija.\nfunction widget(number, id, title, approvedAt) {\n  return Object.freeze({ number, id, title, status:"approved", approvedAt });\n}\n\nconst WIDGETS = Object.freeze([\n${rows}\n]);\n\nmodule.exports = Object.freeze({\n  version:"nazorjeva-v2",\n  name:"NAZORJEVA",\n  status:"approved",\n  widgets:WIDGETS,\n  ids:Object.freeze(WIDGETS.map((entry) => entry.id))\n});\n`;
}
function serializeTest(widgets) {
  const rows = widgets.map((record) => `  Object.freeze(${js(Object.assign({}, record, { status:"test", approved:false, approvedAt:undefined }))})`).join(",\n");
  return `"use strict";\n\n// Generirani TEST register. Kandidat ostane tu do izrecne uporabnikove odobritve.\nconst WIDGETS = Object.freeze([\n${rows}\n]);\n\nmodule.exports = Object.freeze({\n  version:"nazorjeva-test-v2",\n  name:"NAZORJEVA-TEST",\n  status:"test",\n  widgets:WIDGETS,\n  ids:Object.freeze(WIDGETS.map((entry) => entry.id))\n});\n`;
}
function updateApprovedTemplateIds(source, ids) {
  const marker = /var APPROVED_TEMPLATE_IDS = Object\.freeze\(\[[\s\S]*?\n  \]\);/;
  if (!marker.test(source)) throw Object.assign(new Error("NAZORJEVA: approvedTemplateIds blok ni najden."), { code:"APPROVED_TEMPLATE_BLOCK_MISSING" });
  const lines = [];
  for (let index = 0; index < ids.length; index += 5) lines.push("    " + ids.slice(index, index + 5).map(JSON.stringify).join(", "));
  return source.replace(marker, `var APPROVED_TEMPLATE_IDS = Object.freeze([\n${lines.join(",\n")}\n  ]);`);
}

function buildPromotionArtifacts(input) {
  const candidate = input.candidate;
  const evidence = input.evidence || {};
  const approved = input.approved;
  const staging = input.staging;
  const templates = input.templates;
  const currentContracts = input.currentContracts || [];
  const templateSource = String(input.templateSource || "");
  if (!candidate || !candidate.id) return { accepted:false, code:"CANDIDATE_MISSING" };
  const stagedRecord = (staging.widgets || []).find((record) => record.id === candidate.id);
  if (!stagedRecord) return { accepted:false, code:"CANDIDATE_NOT_IN_TEST" };
  const implementation = (templates.templates || []).find((template) => template.id === candidate.id);
  if (!implementation || typeof implementation.body !== "function") return { accepted:false, code:"RENDERER_IMPLEMENTATION_MISSING" };
  if (implementation.approved) return { accepted:false, code:"ALREADY_APPROVED" };
  if (!implementation.profile || !Array.isArray(implementation.semanticTags)) return { accepted:false, code:"TEMPLATE_CAPABILITY_METADATA_MISSING" };
  let definition;
  try { definition = engine.materializeWidgetDefinition(candidate); }
  catch (error) { return { accepted:false, code:error.code || "DEFINITION_INVALID", reason:error.message }; }
  const contextValidation = engine.validateContext(definition.context);
  if (!contextValidation.ok) return Object.assign({ accepted:false }, contextValidation);
  const collision = engine.resolveCollision(candidate, currentContracts);
  if (collision.blocking) return Object.freeze({ accepted:false, code:collision.code, collision });
  const plan = engine.planPromotion(Object.assign({}, candidate, { lifecycleState:candidate.lifecycleState || stagedRecord.lifecycleState || "test" }), evidence, { approvedIds:approved.ids, testIds:staging.ids });
  if (!plan.accepted) return plan;
  const approvedAt = String(evidence.approvedAt || new Date().toISOString().slice(0, 10));
  const approvedWidgets = (approved.widgets || []).concat(registryWidget(candidate, "approved", approvedAt));
  const testWidgets = (staging.widgets || []).filter((record) => record.id !== candidate.id);
  const approvedIds = approvedWidgets.map((record) => record.id);
  return Object.freeze({
    accepted:true, code:"PROMOTION_TRANSACTION_PREPARED", plan,
    artifacts:Object.freeze({
      "NAZORJEVA.js":serializeApproved(approvedWidgets),
      "NAZORJEVA-TEST.js":serializeTest(testWidgets),
      "app/atena-card-templates.js":updateApprovedTemplateIds(templateSource, approvedIds),
    }),
    verifyCommands:Object.freeze([
      Object.freeze(["scripts/generate-atena-widget-guide.js"]),
      Object.freeze(["scripts/test-nazorjeva.js"]),
      Object.freeze(["scripts/test-nazorjeva-engine.js"]),
      Object.freeze(["scripts/test-atena-widget-contract.js"]),
      Object.freeze(["scripts/test-atena-card-templates.js"]),
      Object.freeze(["scripts/test-atena-card-schema.js"]),
      Object.freeze(["scripts/test-svetovalec-preverba.js"]),
    ]),
  });
}

function commitAtomically(root, prepared) {
  if (!prepared || !prepared.accepted) throw Object.assign(new Error("NAZORJEVA: transakcija ni pripravljena."), { code:"TRANSACTION_NOT_PREPARED" });
  const token = crypto.randomBytes(8).toString("hex");
  const records = Object.entries(prepared.artifacts).map(([relative, content]) => {
    const target = path.join(root, relative);
    return { target, temporary:`${target}.${token}.next`, backup:`${target}.${token}.bak`, content };
  });
  records.forEach((record) => fs.writeFileSync(record.temporary, record.content, "utf8"));
  const replaced = [];
  try {
    records.forEach((record) => {
      fs.renameSync(record.target, record.backup);
      fs.renameSync(record.temporary, record.target);
      replaced.push(record);
    });
    prepared.verifyCommands.forEach((args) => childProcess.execFileSync(process.execPath, args, { cwd:root, stdio:"inherit" }));
    replaced.forEach((record) => fs.unlinkSync(record.backup));
    return Object.freeze({ ok:true, code:"PROMOTION_COMMITTED", files:Object.freeze(records.map((record) => path.relative(root, record.target))) });
  } catch (error) {
    replaced.slice().reverse().forEach((record) => {
      if (fs.existsSync(record.target)) fs.unlinkSync(record.target);
      if (fs.existsSync(record.backup)) fs.renameSync(record.backup, record.target);
    });
    records.forEach((record) => { if (fs.existsSync(record.temporary)) fs.unlinkSync(record.temporary); });
    throw Object.assign(new Error("NAZORJEVA: promocija je bila povrnjena po neuspehu preverjanja: " + error.message), { code:"PROMOTION_ROLLED_BACK", cause:error });
  }
}

module.exports = { serializeApproved, serializeTest, updateApprovedTemplateIds, buildPromotionArtifacts, commitAtomically };
