"use strict";

const fs = require("node:fs");
const path = require("node:path");
const engine = require("../app/nazorjeva-engine");
const contract = require("../app/atena-widget-contract");
const schema = require("../app/atena-card-schema");

const root = path.resolve(__dirname, "..");
const docs = path.join(root, "docs");
const clean = (value) => String(value == null ? "" : value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const list = (values) => values && values.length ? values.map((value) => `\`${value}\``).join(", ") : "sestavljeni modul; brez neposredne zamenjave enega polja";

let guide = `# Vodnik po ${contract.contracts.length} odobrenih widgetih NAZORJEVA

Ta dokument je generiran iz \`app/nazorjeva-engine.js\` in \`app/atena-widget-contract.js\`. Register \`NAZORJEVA.js\` določa, kateri widgeti so odobreni; strojni contract pa določa, kdaj jih sme Atena uporabiti. Model lahko predlaga widget, toda \`evaluateWidget\` ga mora deterministično potrditi.

## Skupne invariante

- Pomen vprašanja, canonical vrednost, required/conditional pravila, validacija in obstoječi osnutek imajo prednost pred obliko.
- \`field\` widget sme zamenjati samo predstavitev združljivega polja. \`module\` widget zahteva vsa povezana vhodna polja. \`review\` ne zajema novega dejstva. \`workflow\` zahteva resnična stanja ali odvisnosti.
- Native barvo poda gostitelj z \`--obrazec-barva\` in \`--obrazec-ozadje\`; varen adapter jo prenese v \`--card-rgb\`. Lastna demonstracijska barva iz kataloga ni produkcijska tema.
- Na telefonu 390 × 844 se dolge kontrole zložijo, na 980 × 900 so dovoljeni samo vsebinsko naravni pari. Vrednosti se prilagajajo brez clippinga ali horizontalnega overflowa.
- Napredni widget ni nagrada za monotonost. Uporabi se samo, kadar njegova struktura zmanjša miselno delo in ohrani podatkovno pogodbo.
- Vsak kandidat začne v \`NAZORJEVA-TEST\`; prehod \`ready_for_approval → approved\` zahteva izrecno odobritev konkretnega ID-ja in svež dokaz testov.

## Widgeti

`;

for (const widget of contract.contracts) {
  guide += `### ${widget.number}. ${widget.title} (\`${widget.id}\`)

- Trajni interface ID in contract: \`${widget.interfaceId}\`; \`${widget.context.version}\`.
- Capability podpis: \`${clean(widget.capability.key)}\`.
- Namen in mentalni model: ${widget.purpose}. ${widget.mentalModel}
- Raven in canonical oblika: \`${widget.scope}\`; \`${widget.dataShape}\`.
- Dovoljene interaction variante: ${list(widget.allowedInteractions)}.
- Primerno: ${widget.suitable}
- Realna primera: ${widget.examples.join("; ")}
- Neprimerno / anti-pattern: ${widget.unsuitable}
- Validacija in conditional pravila: ${widget.validation} Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: ${widget.responsive}
- Native barva: ${widget.nativeTheme}
- Monotonost: ${widget.monotony}
- Shranjevanje: ${widget.persistence}

`;
}

const fields = schema.catalog.flatMap((card) => card.fields.map((field) => ({ card, field })));
const offerManifest = schema.ponudbaQuestionManifest;
let matrix = `# Matrika vprašanj in ${fields.length} vprašalnih polj → widget

Ta matrika je generirana iz dejanske skupne sheme. Najprej prikazuje vseh 25 dejanskih ponudbenih vprašanj v šestih kategorijah, nato vseh ${fields.length} field-level contractov. Napredni večpoljni widget je izbran samo ob dokazani podatkovni koristi; sicer vprašanje ostane varna kompozicija potrjenih field widgetov.

## Preverite ponudbo — 25 vprašanj

| Card interface ID | Kategorija | Modul | Vprašanje | Način | Kanonični widget(i) | Reason code | Capability in razlog | Zavrnjene alternative | Mobile | Desktop |
|---|---|---:|---|---|---|---|---|---|---|---|
`;
for (const question of offerManifest.questions) {
  const widgets = question.widget.mode === "module-widget" ? [question.widget.templateId] : question.widget.fieldBindings.map((binding) => binding.templateId);
  matrix += `| \`${question.interfaceId}\` | ${clean(question.category)} | ${question.moduleId} | ${clean(question.question)} | \`${question.widget.mode}\` | ${list([...new Set(widgets)])} | \`${question.widget.reasonCode}\` | ${clean(question.widget.reason)} | ${clean(question.widget.rejectedAlternatives.join("; "))} | ${clean(question.widget.mobile)} | ${clean(question.widget.desktop)} |\n`;
}

matrix += `
## Vsa vprašalna polja

| Interface ID | Tok | Modul | Vprašanje | Polje | Podatkovni tip | Trenutni interaction | Priporočeni template | Sprememba | Razlog |
|---|---|---:|---|---|---|---|---|---|---|
`;
for (const { card, field } of fields) {
  const selection = field.ui.selection;
  matrix += `| \`${field.interfaceId}\` | ${clean(card.flowLabel)} | ${card.moduleId} | ${clean(card.question)} | ${field.id} · ${clean(field.label)} | \`${clean(field.type)}\` | \`${field.ui.interaction}\` | \`${selection.templateId}\` | Ne | ${clean(field.ui.reason)} ${clean(selection.reason)} |\n`;
}

matrix += `
## Rezultat presoje

- Pregledanih modulov: ${schema.matrixReport().reviewedModules}/${schema.matrixReport().modules}.
- Pregledanih polj: ${schema.matrixReport().reviewedFields}/${schema.matrixReport().fields}.
- Manjkajočih preslikav: ${schema.matrixReport().missingTemplateBindings.length}.
- Odobrenih widget contractov: ${contract.contracts.length}.
- Produkcijski selection sprejme samo widgete, ki so trenutno odobreni v registru NAZORJEVA.
- Ponudbeni manifest: ${offerManifest.counts.categories} kategorij, ${offerManifest.counts.questions} vprašanj, ${offerManifest.counts.fields} polj, ${offerManifest.counts.controls} kontrol, ${offerManifest.counts.options} možnosti in ${offerManifest.counts.relations} relacija.
`;

fs.writeFileSync(path.join(docs, "NAZORJEVA-WIDGET-GUIDE.md"), guide, "utf8");
fs.writeFileSync(path.join(docs, "ATENA-QUESTION-WIDGET-MATRIX.md"), matrix, "utf8");
let interfaces = `# Obširni kontekst vseh Ateninih kartic in vnosnih vrstic

Ta dokument je generiran iz strojnega contracta \`${engine.contextVersion}\`. Vsak spodnji ID je stabilen in se izriše tudi v DOM-u. Context določa pomen, canonical podatke, validacijo, UI, native temo, responsive vedenje in persistence.

`;
for (const card of schema.catalog) {
  interfaces += `## ${card.title} — \`${card.interfaceId}\`

- Tok in področje: ${card.flowLabel} · ${card.areaLabel}.
- Vprašanje in namen: ${card.question} ${card.description}
- Podatkovna oblika: ${card.context.data.answerType}; ${card.fields.length} vnosnih vrstic.
- Validacija: ${card.context.validation.rule} Obvezna polja: ${card.context.validation.requiredFieldIds.length ? card.context.validation.requiredFieldIds.join(", ") : "ni novih podatkov"}.
- UI in native tema: ${card.context.ui.layout}; templatei ${card.context.ui.templateIds.join(", ") || "potrditev"}; question-level način ${card.questionWidget.mode}${card.questionWidget.templateId ? ` → ${card.questionWidget.templateId}` : ""}; reason code ${card.questionWidget.reasonCode}; tokeni ${card.context.ui.nativeColorTokens.join(", ")}.
- Persistence in izvor: ${card.context.persistence.rule} Vir: ${card.context.source.engine}, modul ${card.moduleId}.

`;
  for (const field of card.fields) {
    const ctx = field.context;
    const options = ctx.canonical.allowedValues.length ? ctx.canonical.allowedValues.map((item) => `${item.id} = ${item.label}`).join("; ") : "prosta tipizirana canonical vrednost";
    interfaces += `### ${field.label} — \`${field.interfaceId}\`

- Identiteta: tok \`${ctx.identity.flow}\`, modul \`${ctx.identity.moduleId}\`, polje \`${ctx.identity.fieldId}\`, koda \`${ctx.identity.fieldCode || "brez-kode"}\`.
- Uporabniški namen: ${ctx.intent.purpose} Osnovno vprašanje: ${ctx.intent.question}
- Canonical contract: tip \`${ctx.canonical.type}\`, storage key \`${ctx.canonical.storageKey}\`; ${ctx.canonical.valueRule}
- Dovoljene vrednosti: ${options}.
- Kontrole: ${ctx.controls.map((item) => `\`${item.interfaceId}\``).join(", ")}.
- Možnosti: ${ctx.options.length ? ctx.options.map((item) => `\`${item.interfaceId}\``).join(", ") : "ni zaprtih možnosti"}.
- Relacije: ${ctx.relations.length ? ctx.relations.map((item) => `\`${item.interfaceId}\``).join(", ") : "ni conditional relacij"}.
- Validacija in vidnost: ${ctx.validation.rule} ${ctx.validation.showWhen ? `Prikaže se, ko polje ${ctx.validation.showWhen.fieldId} vsebuje ${ctx.validation.showWhen.values.join(", ")}.` : "Polje nima dodatnega showWhen pogoja."}
- Interaction in template: \`${ctx.ui.interaction}\` → \`${ctx.ui.templateId}\`. ${ctx.ui.selectionReason}
- Native, responsive in auto-fit: ${ctx.ui.nativeColorTokens.join(", ")}. ${ctx.ui.responsive} ${ctx.ui.autoFit}
- Persistence: ${ctx.persistence.storage}, modul ${ctx.persistence.moduleId}, polje ${ctx.persistence.fieldId}. ${ctx.persistence.hiddenRule}
- Anti-pattern: ${ctx.intent.antiPattern}
- Izvor: ${ctx.source.engine}, modul ${ctx.source.moduleId}, polje ${ctx.source.fieldId}.

`;
  }
}
fs.writeFileSync(path.join(docs, "ATENA-INTERFACE-CONTEXTS.md"), interfaces, "utf8");
const lifecycle = `# NAZORJEVA engine

- Engine: \`${engine.version}\`.
- Widget definition: \`${engine.definitionVersion}\`.
- Capability signature: \`${engine.capabilityVersion}\`.
- Interface context: \`${engine.contextVersion}\`.
- Question binding: \`${engine.questionBindingVersion}\`.
- Luna manifest: \`${engine.lunaManifestVersion}\`.

## Admission in promocija

\`draft → test → iterating → ready_for_approval → approved\`. Kandidat se lahko zavrne; approved widget se lahko vrne v TEST samo kot nova iteracija. Neposredni \`test → approved\` je blokiran. Promocijska transakcija zahteva ID kandidata, izrecno uporabniško odobritev, dokaz testov, renderer implementacijo, veljaven deep context in neboleč capability resolver. Ob neuspehu preverjanja se vsi registrski zapisi povrnejo.

## Capability collision

- \`EXACT_DUPLICATE\`: enak canonical capability podpis; blokirano.
- \`FUNCTIONAL_OVERLAP\`: isti scope in canonical oblika z vsebinskim prekrivanjem; blokirano.
- \`COMPLEMENTARY_VARIANT\`: dovoljeno le z dokazano novo podatkovno koristjo.
- \`INCOMPATIBLE\`: ni blokirne kolizije, vendar mora kandidat še vedno prestati celoten admission.

## Luna decision boundary

Luna prejme generirani manifest in sme predlagati odobreni widget samo z evidence spani. Deterministični engine preveri status, scope, canonical obliko, semantične oznake in interaction. Predlog nato potrdi, preoblikuje na varno kanonično izbiro ali zavrne z reason kodo; Luna ne spreminja poslovnega pomena, required pravil ali persistence.

## ID pokritje

- Widgeti: ${contract.contracts.length}.
- Kartice: ${schema.cardContracts.length}.
- Polja: ${schema.fieldContracts.length}.
- Kontrole: ${schema.controlContracts.length}.
- Možnosti: ${schema.optionContracts.length}.
- Relacije: ${schema.relationContracts.length}.
- Skupno preverjenih globalnih ID-jev: ${schema.idValidation.total}; rezultat \`${schema.idValidation.code}\`.
`;
fs.writeFileSync(path.join(docs, "NAZORJEVA-ENGINE.md"), lifecycle, "utf8");
fs.writeFileSync(path.join(docs, "NAZORJEVA-LUNA-MANIFEST.json"), JSON.stringify(Object.assign({}, contract.lunaManifest, { ponudbaQuestions:offerManifest }), null, 2) + "\n", "utf8");
console.log(`Atena widget guide: OK (${contract.contracts.length} widgetov, ${fields.length} polj)`);
