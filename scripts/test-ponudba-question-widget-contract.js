"use strict";

const assert = require("node:assert/strict");
const engine = require("../app/ponudba-moduli-engine");
const schema = require("../app/atena-card-schema");
const renderer = require("../app/atena-card-renderer");

const manifest = schema.ponudbaQuestionManifest;
assert.equal(manifest.version, "ponudba-question-widget-manifest-v1");
assert.deepEqual(manifest.counts, { categories:6, questions:25, fields:58, controls:74, options:31, relations:1 });
assert.equal(new Set(manifest.categories.flatMap((area) => area.moduleIds)).size, 25);
assert.equal(new Set(manifest.questions.map((question) => question.interfaceId)).size, 25);
assert.equal(new Set(manifest.questions.flatMap((question) => question.fields.map((field) => field.interfaceId))).size, 58);

const sourceFields = new Map(engine.fields.map((field) => [field.id, field]));
for (const question of manifest.questions) {
  assert.ok(question.question && question.widget.reasonCode && question.widget.reason);
  assert.ok(question.widget.mobile && question.widget.desktop && question.widget.rejectedAlternatives.length);
  assert.ok(question.widget.presentation && question.widget.presentation.templateId && question.widget.presentation.title);
  assert.ok(schema.canonicalTemplateIds.includes(question.widget.presentation.templateId));
  assert.match(question.widget.presentation.interfaceId, /^atena:widget:/);
  assert.ok(Number.isInteger(question.widget.presentation.number) && question.widget.presentation.number > 0);
  assert.equal(question.persistence.storage, "existing-draft");
  assert.equal(question.widget.fieldBindings.length, question.fields.length);
  if (question.widget.mode === "module-widget") {
    assert.ok(schema.canonicalTemplateIds.includes(question.widget.templateId));
    assert.equal(question.widget.capabilityMatch.eligible, true);
    assert.equal(question.widget.interfaceId, `atena:widget:${question.widget.templateId}`);
  } else {
    assert.equal(question.widget.templateId, null);
    assert.equal(question.widget.capabilityMatch.eligible, true);
  }
  for (const field of question.fields) {
    const source = sourceFields.get(field.fieldId);
    assert.ok(source, `Manjka izvorno polje ${field.fieldId}`);
    assert.equal(field.canonical.storageKey, String(source.id));
    assert.equal(field.canonical.type, source.type);
    assert.equal(field.validation.required, source.required);
    assert.deepEqual(field.canonical.allowedValues.map((option) => option.id), source.options.map((option) => option.id));
    assert.equal(field.persistence.storage, "existing-draft");
    assert.ok(schema.canonicalTemplateIds.includes(field.ui.templateId));
  }
}

assert.equal(schema.getCard("ponudba", 4001).question, "Kakšna je vloga osebe ali podjetja, ki vam je poslalo ponudbo?");
assert.match(schema.getCard("ponudba", 4022).question, /pravni ponudnik/);
assert.doesNotMatch(schema.getCard("ponudba", 4021).title, /SLA/);
assert.match(schema.getCard("ponudba", 4023).question, /podizvajalce/);
const relation = manifest.questions.find((question) => question.moduleId === 4001).fields.find((field) => field.fieldId === 5602).validation.showWhen;
assert.deepEqual({ fieldId:relation.fieldId, values:relation.values }, { fieldId:5001, values:["posrednik"] });

const evidence = "Ponudnik je posrednik in cena je 100 EUR.";
const base = { contextVersion:manifest.contextVersion, interfaceId:"atena:field:ponudba:4009:5101", widgetId:"natancen-znesek", interaction:"money", evidenceSpans:["100 EUR"] };
assert.equal(schema.resolvePonudbaQuestionProposal(base, evidence).code, "QUESTION_WIDGET_CONFIRMED");
assert.equal(schema.resolvePonudbaQuestionProposal({ ...base, widgetId:"stevilcna-lestvica" }, evidence).code, "QUESTION_WIDGET_TRANSFORMED", "Združljiv, vendar manj primeren predlog se mora preoblikovati v canonical widget.");
assert.equal(schema.resolvePonudbaQuestionProposal({ ...base, widgetId:"datum-z-gotovostjo" }, evidence).accepted, false, "Napačen widget za tip mora biti zavrnjen.");
assert.equal(schema.resolvePonudbaQuestionProposal({ ...base, widgetId:"neodobren-widget" }, evidence).code, "LUNA_WIDGET_NOT_APPROVED");
assert.equal(schema.resolvePonudbaQuestionProposal({ ...base, evidenceSpans:[] }, evidence).code, "LUNA_EVIDENCE_REQUIRED");
assert.equal(schema.resolvePonudbaQuestionProposal({ ...base, evidenceSpans:["izmišljeno"] }, evidence).code, "LUNA_EVIDENCE_REQUIRED");
assert.equal(schema.resolvePonudbaQuestionProposal({ ...base, contextVersion:"atena-interface-context-v1" }, evidence).code, "CONTEXT_VERSION_STALE");
assert.equal(schema.resolvePonudbaQuestionProposal({ ...base, interfaceId:"atena:field:ponudba:4009:9999" }, evidence).code, "QUESTION_INTERFACE_ID_UNKNOWN");
assert.equal(schema.resolvePonudbaQuestionProposal({ ...base, interaction:"choice-grid" }, evidence).code, "QUESTION_WIDGET_CONFIRMED", "Interaction mismatch se varno preoblikuje na canonical money interaction.");
assert.equal(schema.resolvePonudbaQuestionProposal({ ...base, extra:true }, evidence).code, "QUESTION_PROPOSAL_SHAPE_INVALID");

const moduleProposal = { contextVersion:manifest.contextVersion, interfaceId:"atena:card:ponudba:4001", widgetId:"odlocitvena-pot", interaction:null, evidenceSpans:["posrednik"] };
const moduleDecision = schema.resolvePonudbaQuestionProposal(moduleProposal, evidence);
assert.equal(moduleDecision.code, "QUESTION_WIDGET_CONFIRMED");
assert.equal(moduleDecision.fieldBindings.length, 2, "Module widget ne sme obiti field-level contracta.");
assert.equal(schema.resolvePonudbaQuestionProposal({ ...moduleProposal, widgetId:"mreza-izbir" }, evidence).accepted, false, "Field widget ne sme obiti module contracta.");
assert.equal(schema.resolvePonudbaQuestionProposal({ ...moduleProposal, interfaceId:"atena:card:ponudba:4009", widgetId:"natancen-znesek", evidenceSpans:["100 EUR"] }, evidence).code, "MODULE_FIELD_COMPOSITION_REQUIRED");

const collaborationCard = schema.getCard("ponudba", 4003);
assert.equal(collaborationCard.fields.length, 4, "Oblika sodelovanja mora ločiti osnovni odnos, pogodbeni režim, najem in obračun.");
assert.deepEqual(collaborationCard.fields.map((field) => field.id), [5003, 5004, 5005, 5006]);
assert.deepEqual(collaborationCard.fields[0].options.map((option) => option.id), ["nakup", "projekt", "redno"]);
assert.ok(collaborationCard.fields.every((field) => field.ui.interaction === "choice-segments"));
assert.match(collaborationCard.questionWidget.reason, /tri neodvisne osi/);
assert.doesNotMatch(collaborationCard.questionWidget.reason, /medsebojno izključujočih možnosti/);
const collaborationHtml = renderer.moduleContentHtml(collaborationCard, collaborationCard.fields, { 5003:"redno", 5004:"da", 5005:"ne", 5006:"da" });
assert.match(collaborationHtml, /data-atena-field-id="5003"[\s\S]*?data-atena-choice="redno"[^>]*aria-pressed="true"/, "Osnovni odnos mora obnoviti redno sodelovanje.");
assert.match(collaborationHtml, /data-atena-field-id="5004"[\s\S]*?data-atena-choice="da"[^>]*aria-pressed="true"/, "Naročnina mora ostati ločena pritrdilna vrednost.");
assert.match(collaborationHtml, /data-atena-field-id="5005"[\s\S]*?data-atena-choice="ne"[^>]*aria-pressed="true"/, "Najem mora ostati ločena nikalna vrednost.");
assert.match(collaborationHtml, /data-atena-field-id="5006"[\s\S]*?data-atena-choice="da"[^>]*aria-pressed="true"/, "Obračun po porabi mora ostati ločena pritrdilna vrednost.");
assert.ok(manifest.questions.every((question) => question.question.length <= 160));
assert.equal(new Set(manifest.questions.map((question) => question.question.toLocaleLowerCase("sl-SI"))).size, 25, "Vprašanja se ne smejo podvajati.");

const card = schema.getCard("ponudba", 4001);
const html = renderer.questionShellHtml({ interfaceId:card.interfaceId, questionWidget:card.questionWidget, title:card.title, question:card.question, contentHtml:renderer.moduleContentHtml(card, card.fields, {}), step:1, total:2 });
assert.match(html, /data-atena-module-template-id="odlocitvena-pot"/);
assert.match(html, /data-nazorjeva-question-card/);
assert.match(html, /data-answer-card/);
assert.match(html, /data-template-card="odlocitvena-pot"/);
assert.doesNotMatch(html, /Nazorjeva kartica|#30 · Naslednji korak/, "Tehnična identiteta widgeta ne sme biti vidna uporabniku.");
assert.match(html, /data-atena-module-reason-code="MODULE_CONDITIONAL_BENEFIT"/);
assert.match(html, /data-atena-interface-id="atena:field:ponudba:4001:5001"/);
assert.match(html, /data-atena-relation-ids="atena:relation:ponudba:4001:show-5602-when-5001"/);
let customSelectCount = 0;
for (const question of manifest.questions) {
  const questionCard = schema.getCard("ponudba", question.moduleId);
  const rendered = renderer.questionShellHtml({ interfaceId:questionCard.interfaceId, questionWidget:questionCard.questionWidget, title:questionCard.title, question:questionCard.question, contentHtml:renderer.moduleContentHtml(questionCard, questionCard.fields, {}), step:1, total:25 });
  assert.match(rendered, /data-nazorjeva-question-card/, `Vprašanje ${question.moduleId} ni izrisano kot Nazorjeva kartica.`);
  assert.doesNotMatch(rendered, /Nazorjeva kartica|#[0-9]{2}\s*·/, `Vprašanje ${question.moduleId} uporabniku kaže interno identiteto kartice.`);
  assert.match(rendered, new RegExp(`data-template-card="${question.widget.presentation.templateId}"`));
  assert.match(rendered, new RegExp(`data-atena-interface-id="${question.interfaceId}"`));
  const nativeSelects = rendered.match(/<select\b/g) || [];
  const customSelects = rendered.match(/data-atena-select-source/g) || [];
  const toggles = rendered.match(/data-atena-select-toggle/g) || [];
  assert.equal(nativeSelects.length, customSelects.length, `Vprašanje ${question.moduleId} vsebuje viden native select.`);
  assert.equal(customSelects.length, toggles.length, `Vprašanje ${question.moduleId} nima custom sprožilca za vsak select.`);
  assert.doesNotMatch(rendered, /<select(?![^>]*\bhidden\b)[^>]*>/, `Vprašanje ${question.moduleId} vsebuje uporabniku viden native select.`);
  customSelectCount += customSelects.length;
  for (const field of question.fields) assert.match(rendered, new RegExp(`data-atena-interface-id="${field.interfaceId}"`));
}
assert.equal(customSelectCount, 10, "Vseh deset select kontrol v osmih karticah mora uporabljati skupni custom izbirnik.");
const uiSource = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "app", "svetovalec-preverba.js"), "utf8");
const rendererSource = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "app", "atena-card-renderer.js"), "utf8");
const sharedCss = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "app", "styles.css"), "utf8");
const nazorjevaCss = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "app", "atena-card-templates.css"), "utf8");
assert.match(sharedCss, /\.atena-cas-par__vnos\s*\{[^}]*gap:\s*8px;/, "Odziv in odprava morata imeti razmik med vrednostjo in enoto.");
assert.match(sharedCss, /\.atena-kolicina\s*\{[^}]*gap:\s*8px;/, "Stepper količine mora ločiti minus, vrednost, plus in enoto.");
assert.match(sharedCss, /\.atena-izbira\s*\{[^}]*min-height:\s*36\.5px;[^}]*padding:\s*4\.5px\s+6\.5px;/, "Nazorjevi izbirni gumbi morajo biti prostorsko varčni in 17 % nižji od prejšnjih 44 px.");
assert.match(nazorjevaCss, /\.uj-card-choices button,[\s\S]*?min-height:\s*36\.5px;[\s\S]*?padding:\s*5\.8px\s+6\.6px;/, "Vse kanonične Nazorjeve choice predloge morajo uporabljati 17 % kompaktnejše gumbe.");
assert.match(sharedCss, /\.atena-kolicina\s*\{[^}]*minmax\(92px,\s*\.9fr\)/, "Izbor enote mora imeti dovolj prostora za celotno besedo in puščico.");
assert.match(sharedCss, /\.atena-kolicina\s*>\s*:first-child,[\s\S]*?border-radius:\s*11px\s*!important;/, "Vsaka zunanja kontrola stepperja mora imeti lasten zaobljen rob.");
assert.match(sharedCss, /\.ponudba-obrazec__polja\s*\{[^}]*scrollbar-width:\s*none;/, "Kartica se med vprašanji ne sme zožiti zaradi stranskega drsnika.");
assert.match(sharedCss, /\.ponudba-obrazec \.atena-vprasanje-kartica__zapri\s*\{[^}]*margin:\s*0;/, "Gumb za zapiranje mora biti poravnan z gumbom Uredi.");
assert.match(sharedCss, /html:has\(body\.is-ponudba-obrazec-odprt\)\s*\{[^}]*overflow:\s*hidden;[^}]*scrollbar-width:\s*none;/, "Odprt obrazec ne sme kazati zunanjega stranskega drsnika.");
assert.match(sharedCss, /\.ponudba-obrazec \.atena-lep-izbirnik__meni\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*3300;/, "Custom select meni mora ostati nad kartico brez clippinga.");
assert.match(rendererSource, /menu\.style\.maxHeight\s*=\s*naturalHeight\s*\+\s*"px"/, "Custom select meni mora ostati omejen na 220 px in ne sme prekriti cele kartice.");
assert.match(rendererSource, /source\.value\s*=\s*option\.dataset\.atenaSelectOption;[\s\S]*?dispatchEvent\(new Event\("change"[\s\S]*?setCanonical\(root,\s*source\.value\)/, "Izbira v custom meniju mora po obstoječem change toku dokončno zapisati canonical vrednost.");
assert.match(rendererSource, /input\.value\s*=\s*canonicalValue;[\s\S]*?input\.setAttribute\("value",\s*canonicalValue\)/, "Canonical vrednost mora preživeti ponovni izris in branje hidden inputa.");
assert.match(rendererSource, /\["choice-segments","choice-grid","choice-list","payment-method"\]\.includes\(root\.dataset\.atenaInteraction\)[\s\S]*?data-atena-choice\]\[aria-pressed="true"\]/, "Choice kontrola mora canonical vrednost varno prebrati tudi neposredno iz izbranega gumba.");
assert.match(rendererSource, /root\.dataset\.atenaInteraction\s*===\s*"dropdown"\s*\?\s*root\.querySelector\("\[data-atena-select-source\]"\)/, "Dropdown mora za validacijo in persistence brati dejansko vrednost skritega select vira.");
assert.match(sharedCss, /\.atena-dodatna-polja\s*\{[^}]*border:\s*0;/, "Odprt razdelek dodatnih pogojev ne sme risati stranske črte.");
assert.match(sharedCss, /\.atena-dodatna-polja__vsebina\s*\{[^}]*padding:\s*0;/, "Dodatna polja ne smejo biti ožja od primarnih polj.");
assert.match(sharedCss, /\.atena-dodatna-polja\s*>\s*summary span\s*\{[^}]*width:\s*28px;[^}]*font:\s*800 18px/, "Plus za dodatna polja mora biti jasen 28 px kontrolni znak.");
assert.match(nazorjevaCss, /\.uj-card-stepper\s*\{[^}]*gap:\s*6px;/, "Kanonični Nazorjeva količinski widget ne sme imeti stikajočih se kontrol.");
assert.match(uiSource, /ponudbaEngine\.areas\.reduce\([\s\S]*?area\.moduleIds/, "Tok »Potrdi izbrane« mora uporabiti natančno unijo šestih kategorij.");
assert.doesNotMatch(uiSource, /function ponudbaVsiModuli\(\) \{\s*return ponudbaEngine \? ponudbaEngine\.modules/, "Podporni moduli se ne smejo znova vriniti med kategorijska vprašanja.");

console.log("Ponudba question/widget contract: OK (6 kategorij, 25 vprašanj, 58 polj; logical axes/type/duplicate/mobile/required/options/persistence/evidence/approval/context/overflow/contract bypass)");
