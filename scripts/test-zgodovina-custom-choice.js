"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const js = fs.readFileSync(path.join(root, "app", "neplacila-zgodovina.js"), "utf8");
const izvedbaJs = fs.readFileSync(path.join(root, "app", "izvedba.js"), "utf8");
const izvedbaCss = fs.readFileSync(path.join(root, "app", "izvedba.css"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "neplacila-zgodovina.css"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "neplacila-zgodovina.html"), "utf8");

assert.doesNotThrow(() => new Function(js));
assert.doesNotThrow(() => new Function(izvedbaJs));
assert.match(js, /function izbiraVprasanjaHtml/);
assert.match(js, /data-ai-choice-toggle/);
assert.match(js, /data-ai-choice-option/);
assert.doesNotMatch(js, /if \(polje === "communicationChannel"\) return '<select/);
assert.doesNotMatch(js, /if \(polje === "paymentMethod"\) return '<select/);
assert.match(js, /dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/);
assert.match(css, /\.zgodovina-ai-vprasanje__izbira-seznam \{[\s\S]*?position:\s*absolute;[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /button\.is-selected/);
assert.match(js, /is-tone-' \+ esc\(tonKoraka\)/);
assert.match(css, /button\.is-tone-akcija-obljuba \{ --korak-rgb: var\(--zgodovina-obljuba-rgb\); \}/);
assert.match(css, /button\.is-tone-akcija-opomin \{ --korak-rgb: var\(--zgodovina-opomin-rgb\); \}/);
assert.match(css, /button\.is-tone-neplacan-obrok \{ --korak-rgb: var\(--zgodovina-neplacan-obrok-rgb\); \}/);
assert.match(css, /button\.is-tone-povzetek \{ --korak-rgb: 63, 153, 152; \}/);
assert.match(js, /remaining_unpaid: \{ naslov: "Preostanek ni plačan", razred: "preostanek"/);
assert.match(js, /installment_agreement: \{ naslov: "Dogovor o obrokih", razred: "dogovor-obroki"/);
assert.match(js, /deadline_extension: \{ naslov: "Nov rok plačila", razred: "podaljsanje"/);
assert.match(js, /reminder_sent: \{ naslov: "Poslan opomin", razred: "akcija-opomin"/);
assert.match(js, /debtor_statement: \{ naslov: "Ugovor \/ zavrnitev", razred: "izjava"/);
const eventToneNames = [
  "delno", "placano-v-celoti", "obrok", "dogovor-obroki", "neplacan-obrok", "preostanek",
  "obljuba", "podaljsanje", "opomin", "dobropis", "kompenzacija", "storno",
  "neuspesno-placilo", "ugovor", "izjava", "insolventnost", "drugo",
];
const eventToneValues = eventToneNames.map((name) => {
  const match = css.match(new RegExp("--zgodovina-" + name + "-rgb:\\s*([^;]+);"));
  assert.ok(match, "manjka barvni token dogodka " + name);
  return match[1].replace(/\s+/g, "");
});
assert.strictEqual(new Set(eventToneValues).size, eventToneValues.length, "različne vrste dogodkov ne smejo deliti iste barve");
assert.match(css, /\.zgodovina-ai-napredek > button \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/);
assert.match(css, /\.zgodovina-ai-napredek > i \{[\s\S]*?background: rgba\(63, 153, 152, \.22\);/);
assert.match(izvedbaJs, /data-history-select-toggle/);
assert.match(izvedbaJs, /menijskeMoznosti = moznosti\.filter/);
assert.match(izvedbaJs, /izvedba-obrok-planer__nacin/);
assert.match(izvedbaJs, /izRisiZgodovinaSelect|izrisiZgodovinaSelect\("installment", "paymentMethod"/);
assert.match(izvedbaJs, /jeVnosZgodovine\(\) && nastavitve\.historyMode === "agreement"/);
assert.match(izvedbaCss, /\.izvedba-obrok-planer__nacin[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /\.zgodovina-kontrolnik__select-seznam \{/);
assert.doesNotMatch(css, /@media \(hover: hover\) and \(pointer: fine\)/);
assert.match(html, /neplacila-zgodovina\.css\?v=20260829-zgodovina-svicer-pikice-v6-replacement-v24-event-tone-v1[^\"]*atena-v15-synced-action-speed-v1[^\"]*full-action-label-v1/);
assert.match(html, /izvedba\.js\?v=20260828-zgodovina-svicer-pikice-v1-replacement-v3-reminder-event-v1/);
assert.match(html, /neplacila-zgodovina\.js\?v=20260828-question-nav-v2/);

console.log("Zgodovina: prilagojena izbira brez sistemskega select menija je pripravljena.");
