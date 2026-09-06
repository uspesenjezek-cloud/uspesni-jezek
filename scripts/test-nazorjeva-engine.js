"use strict";

const assert = require("node:assert/strict");
const engine = require("../app/nazorjeva-engine");
const contract = require("../app/atena-widget-contract");
const schema = require("../app/atena-card-schema");
const promotion = require("./nazorjeva-promotion-transaction");

function candidateFrom(widget, overrides) {
  const extra = overrides || {};
  return {
    id: extra.id || `test-${widget.id}`,
    number: 900,
    title: extra.title || `Test ${widget.title}`,
    status: "test",
    lifecycleState: extra.lifecycleState || "test",
    identity: { number:900, title:extra.title || `Test ${widget.title}`, status:"test", origin:"NAZORJEVA-TEST" },
    intent: {
      purpose: widget.purpose,
      mentalModel: widget.mentalModel,
      suitable: widget.suitable,
      unsuitable: widget.unsuitable,
      examples: widget.examples,
      antiPatterns: [widget.unsuitable],
    },
    data: {
      scope: widget.scope,
      canonicalShape: widget.dataShape,
      semanticTags: extra.semanticTags || widget.semanticTags,
      allowedInteractions: extra.allowedInteractions || widget.allowedInteractions,
      allowedValues: extra.allowedValues || [],
    },
    validation: { required:false, rule:extra.validation || widget.validation, conditionalRules:extra.conditionalRules || [] },
    ui: {
      nativeTheme: widget.nativeTheme,
      nativeColorTokens: extra.nativeColorTokens,
      responsive: widget.responsive,
      monotony: widget.monotony,
    },
    persistence: { storage:"existing-draft", rule:widget.persistence },
    questionBinding: { question:widget.mentalModel },
    distinctDataBenefit: extra.distinctDataBenefit,
  };
}

assert.equal(engine.version, "nazorjeva-engine-v1");
assert.equal(engine.contextVersion, "atena-interface-context-v2");
assert.equal(contract.version, "atena-widget-contract-v3");
assert.equal(contract.contracts.length, 62);
assert.equal(contract.lunaManifest.widgets.length, 62);
assert.ok(contract.contracts.every((widget) => engine.validateContext(widget.context).ok));
assert.ok(contract.contracts.every((widget) => widget.capability && widget.questionBinding));
assert.ok(contract.contracts.every((widget) => widget.semanticTags.length > 0));
assert.equal(new Set(contract.contracts.map((widget) => widget.capability.key)).size, 62, "Migriranih 62 widgetov mora imeti 62 različnih capability podpisov.");

assert.deepEqual(engine.stableIds("ponudba", 4001, 5001, [{ id:"da", label:"Da" }], ["show-5001-when-5000"], ["choice-group"]), {
  card:"atena:card:ponudba:4001",
  field:"atena:field:ponudba:4001:5001",
  controls:[{ role:"choice-group", interfaceId:"atena:control:ponudba:4001:5001:choice-group" }],
  options:[{ id:"da", label:"Da", interfaceId:"atena:option:ponudba:4001:5001:da" }],
  relations:[{ id:"show-5001-when-5000", interfaceId:"atena:relation:ponudba:4001:show-5001-when-5000" }],
});
assert.equal(schema.idValidation.ok, true);
assert.equal(schema.idValidation.total, 582);
assert.equal(schema.controlContracts.length, 179);
assert.equal(schema.optionContracts.length, 107);
assert.equal(schema.relationContracts.length, 5);
assert.equal(engine.validateIdRegistry([{ interfaceId:"atena:widget:a" }, { interfaceId:"atena:widget:a" }]).code, "IDS_INVALID");
assert.deepEqual(engine.validateIdRegistry([{ interfaceId:"" }]).missing, [0]);

const money = contract.byId["natancen-znesek"];
const exactCopy = candidateFrom(money, { id:"test-natancen-znesek" });
assert.equal(engine.resolveCollision(exactCopy, contract.contracts).code, "EXACT_DUPLICATE");
assert.equal(engine.admitCandidate(exactCopy, contract.contracts, []).code, "EXACT_DUPLICATE");

const risk = contract.byId["matrika-tveganja"];
const overlap = candidateFrom(risk, { id:"test-matrika-tveganja", validation:risk.validation + " Dodatna besedna razlaga." });
assert.equal(engine.resolveCollision(overlap, contract.contracts).code, "FUNCTIONAL_OVERLAP");
const complementary = candidateFrom(risk, {
  id:"test-dokazano-dopolnilo",
  semanticTags:["verjetnost","strosek","dokaz"],
  validation:risk.validation + " Hrani tudi dokazani strošek.",
  distinctDataBenefit:"Doda novo canonical povezavo med verjetnostjo, stroškom in dokazilom.",
});
assert.equal(engine.resolveCollision(complementary, contract.contracts).code, "COMPLEMENTARY_VARIANT");

assert.equal(engine.transition({ id:"x", lifecycleState:"test" }, "approved", { userApproved:true, approvedWidgetId:"x", approvalEvidence:"da", testEvidence:"zeleno" }).code, "INVALID_LIFECYCLE_TRANSITION");
assert.equal(engine.transition({ id:"x", lifecycleState:"ready_for_approval" }, "approved", {}).code, "EXPLICIT_APPROVAL_REQUIRED");
assert.equal(engine.transition({ id:"x", lifecycleState:"ready_for_approval" }, "approved", { userApproved:true, approvedWidgetId:"y", approvalEvidence:"da", testEvidence:"zeleno" }).code, "EXPLICIT_APPROVAL_REQUIRED");
const authorized = engine.transition({ id:"x", lifecycleState:"ready_for_approval" }, "approved", { userApproved:true, approvedWidgetId:"x", approvalEvidence:"Uporabnik je odobril x.", testEvidence:"Vsi ciljni testi zeleni." });
assert.equal(authorized.code, "PROMOTION_AUTHORIZED");
assert.equal(engine.planPromotion({ id:"x", lifecycleState:"ready_for_approval" }, { userApproved:true, approvedWidgetId:"x", approvalEvidence:"Uporabnik je odobril x.", testEvidence:"Zeleno." }, { approvedIds:["a"], testIds:["x"] }).code, "PROMOTION_PLAN_READY");
assert.equal(engine.planPromotion({ id:"x", lifecycleState:"ready_for_approval" }, {}, { approvedIds:["a"], testIds:["x"] }).code, "EXPLICIT_APPROVAL_REQUIRED");
for (const from of Object.keys(engine.lifecycle)) {
  const attempt = engine.transition({ id:"matrix", lifecycleState:from }, "approved", { userApproved:true, approvedWidgetId:"matrix", approvalEvidence:"odobreno", testEvidence:"zeleno" });
  assert.equal(attempt.accepted, from === "ready_for_approval", `Samo ready_for_approval sme v approved, ne ${from}.`);
}

assert.equal(engine.resolveInteraction({ dataType:"enum", options:["Da","Ne"], viewportWidth:390 }).presentation, "segments");
assert.equal(engine.resolveInteraction({ dataType:"enum", options:["A","B","C","D"], viewportWidth:390 }).presentation, "clickable-grid");
assert.equal(engine.resolveInteraction({ dataType:"enum", options:Array.from({ length:6 }, (_, i) => ({ label:`Zelo dolga razložena možnost ${i}` })), viewportWidth:390 }).presentation, "scroll-list");
assert.equal(engine.resolveInteraction({ dataType:"enum", options:Array.from({ length:10 }, (_, i) => `Možnost ${i}`), viewportWidth:980 }).presentation, "searchable-dropdown");
assert.equal(engine.resolveInteraction({ dataType:"enum", options:Array.from({ length:8 }, (_, i) => `Možnost ${i}`), multiSelect:true, viewportWidth:390 }).presentation, "scroll-list");
assert.equal(engine.resolveInteraction({ dataType:"structured-object", fieldCount:3, viewportWidth:390 }).interaction, "composite");
assert.equal(engine.resolveInteraction({ dataType:"money", viewportWidth:390 }).presentation, "typed-input");
const generatedInteractions = [];
for (const viewportWidth of [320, 390, 600, 980]) {
  for (const multiSelect of [false, true]) {
    for (const optionCount of Array.from({ length:21 }, (_, index) => index + 1)) {
      for (const labelLength of [4, 24, 60, 160]) {
        const decision = engine.resolveInteraction({ dataType:"enum", viewportWidth, multiSelect, options:Array.from({ length:optionCount }, (_, index) => ({ id:`o${index}`, label:"x".repeat(labelLength) })) });
        generatedInteractions.push(decision);
        assert.ok(["choice-segments","choice-grid","choice-list","dropdown"].includes(decision.interaction));
        if (viewportWidth < 600 && labelLength >= 60) assert.ok(["scroll-list","clickable-cards","searchable-dropdown"].includes(decision.presentation));
        if (!multiSelect && optionCount > 7 && labelLength <= 24) assert.equal(decision.presentation, "searchable-dropdown");
        if (!multiSelect && optionCount > 7 && labelLength >= 60) assert.equal(decision.presentation, "scroll-list");
        if (multiSelect && optionCount > 6) assert.equal(decision.presentation, "scroll-list");
      }
    }
  }
}
assert.equal(generatedInteractions.length, 672);

const choiceField = schema.getCard("ponudba", 4001).fields[0].context;
assert.equal(engine.bindQuestion(choiceField, { question:"Katera vloga najbolje opiše ponudnika?", label:"Vloga ponudnika" }).code, "QUESTION_BINDING_ACCEPTED");
assert.equal(engine.bindQuestion(choiceField, { storage:"other-store", question:"Vprašanje" }).code, "QUESTION_BINDING_LOCKED_OVERRIDE");
assert.equal(engine.bindQuestion(choiceField, { options:[{ id:"izmisljeno", label:"Izmišljeno" }] }).code, "QUESTION_BINDING_OPTION_IDS_CHANGED");
assert.equal(engine.bindQuestion(choiceField, { question:"x".repeat(241) }).code, "QUESTION_BINDING_VALUE_TOO_LONG");

assert.throws(() => engine.materializeWidgetDefinition(candidateFrom(money, { title:"x".repeat(81) })), (error) => error.code === "VALUE_TOO_LONG");
assert.throws(() => engine.materializeWidgetDefinition(candidateFrom(money, { nativeColorTokens:["--nova-barva"] })), (error) => error.code === "NATIVE_COLOR_OVERRIDE_BLOCKED");
assert.throws(() => engine.materializeWidgetDefinition(candidateFrom(money, { conditionalRules:[{ relationId:"r", sourceId:"", values:["da"], effect:"show" }] })), (error) => error.code === "RELATION_SOURCE_MISSING");
assert.equal(engine.validateContext({ version:"atena-interface-context-v1" }).code, "CONTEXT_VERSION_STALE");
assert.equal(engine.validateContext({ version:engine.contextVersion, interfaceId:"atena:widget:x", identity:{}, intent:{}, validation:{}, ui:{}, persistence:{} }).code, "PERSISTENCE_CONTRACT_MISSING");

assert.equal(contract.evaluateLunaProposal({ widgetId:"natancen-znesek", interaction:"money", evidenceSpans:[] }, { scope:"field", canonicalShape:"number-with-unit", interaction:"money" }).code, "LUNA_EVIDENCE_REQUIRED");
assert.equal(contract.evaluateLunaProposal({ widgetId:"neodobren", interaction:"money", evidenceSpans:["500 EUR"] }, { scope:"field", canonicalShape:"number-with-unit", interaction:"money" }).code, "LUNA_WIDGET_NOT_APPROVED");
assert.equal(contract.evaluateLunaProposal({ widgetId:"natancen-znesek", interaction:"money", evidenceSpans:["500 EUR"] }, { scope:"field", canonicalShape:"string", interaction:"money" }).code, "LUNA_CANONICAL_SHAPE_MISMATCH");
assert.equal(contract.evaluateLunaProposal({ widgetId:"natancen-znesek", interaction:"money", evidenceSpans:["500 EUR"] }, { scope:"field", canonicalShape:"number-with-unit", interaction:"money" }).code, "LUNA_PROPOSAL_CONFIRMED");

const promotable = candidateFrom(money, { id:"nova-varna-kartica", lifecycleState:"ready_for_approval" });
promotable.profile = "number";
const prepared = promotion.buildPromotionArtifacts({
  candidate:promotable,
  evidence:{ userApproved:true, approvedWidgetId:promotable.id, approvalEvidence:"Uporabnik je izrecno odobril novo-varna-kartica.", testEvidence:"Adversarial matrika je zelena.", approvedAt:"2026-08-31" },
  approved:{ widgets:[{ number:1, id:"a", title:"A", approvedAt:"2026-08-30" }], ids:["a"] },
  staging:{ widgets:[promotable], ids:[promotable.id] },
  templates:{ templates:[{ id:promotable.id, approved:false, profile:"number", semanticTags:[], body() { return "<div></div>"; } }] },
  currentContracts:[],
  templateSource:'var APPROVED_TEMPLATE_IDS = Object.freeze([\n    "a"\n  ]);',
});
assert.equal(prepared.code, "PROMOTION_TRANSACTION_PREPARED");
assert.match(prepared.artifacts["NAZORJEVA.js"], /nova-varna-kartica/);
assert.doesNotMatch(prepared.artifacts["NAZORJEVA-TEST.js"], /nova-varna-kartica/);
assert.match(prepared.artifacts["app/atena-card-templates.js"], /"a", "nova-varna-kartica"/);
assert.equal(promotion.buildPromotionArtifacts({ candidate:promotable, evidence:{}, approved:{ widgets:[], ids:[] }, staging:{ widgets:[promotable], ids:[promotable.id] }, templates:{ templates:[{ id:promotable.id, approved:false, profile:"number", semanticTags:[], body() {} }] }, currentContracts:[], templateSource:'var APPROVED_TEMPLATE_IDS = Object.freeze([\n  ]);' }).code, "EXPLICIT_APPROVAL_REQUIRED");

console.log("NAZORJEVA engine adversarial: OK (lifecycle, collision, Luna, IDs, binding, interaction, context)");
