import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const preberi = (pot) => readFileSync(new URL(`../${pot}`, import.meta.url), "utf8");
const html = preberi("app/neplacila-posiljanje.html");
const css = preberi("app/styles.css");
const logika = preberi("app/obrocno-sheet.js");

assert.match(
  html,
  /class="delno-resitev"[\s\S]*?Kaj se zgodi s preostankom\?[\s\S]*?data-delno-preostanek="open"[\s\S]*?data-delno-preostanek="credit_note"[\s\S]*?id="obrocno-sheet-delno-predlogi-panel"/,
  "Referenčni prikaz ravnanja s preostankom mora biti priklopljen na ohranjene kontrole."
);
assert.match(
  css,
  /\.delno-resitev__nacin[\s\S]{0,500}height:\s*60px[\s\S]*?\.delno-resitev__predlog[\s\S]{0,500}height:\s*61px/,
  "Razširjeni prikaz mora imeti približno 15 odstotkov višje kontrole in vrstice."
);
assert.match(
  css,
  /\.delno-resitev__izbira[\s\S]{0,150}gap:\s*8px[\s\S]*?\.delno-resitev__predlog-tekst strong[\s\S]{0,180}font-size:\s*0\.72rem[\s\S]*?\.delno-resitev__indikator[\s\S]{0,400}width:\s*32px/,
  "Gumba morata biti vedno ločena, besedilo berljivo in izbirni krogec večji."
);
assert.match(
  css,
  /Delno plačilo uporablja isto polno kartico priporočila[\s\S]*?\.recommendation-card__title[\s\S]{0,120}display:\s*block\s*!important[\s\S]*?\.recommendation-card__description[\s\S]{0,120}display:\s*block\s*!important[\s\S]*?\.recommendation-card__button--apply[\s\S]{0,300}min-height:\s*40px/,
  "Delno plačilo mora uporabljati polno kartico priporočila z naslovom, opisom in širokim gumbom."
);
assert.match(
  css,
  /Mobilna geometrija delnega plačila je enaka obročnemu plačilu[\s\S]*?height:\s*calc\(var\(--visual-viewport-height,[\s\S]*?0\.96\)[\s\S]*?padding:\s*0 16px[\s\S]*?\.rok-sheet__rocaj[\s\S]{0,80}display:\s*none\s*!important[\s\S]*?\.obrocno-sheet__nacin[\s\S]{0,180}padding:\s*4px[\s\S]*?gap:\s*4px/,
  "Delno plačilo mora uporabljati isto mobilno geometrijo panela in segmentne vrstice kot obročno plačilo."
);

for (const dokaz of [
  /partialRemainderMode/,
  /partialProposalType/,
  /partialProposalConfirmed/,
  /partialRemainderDueDate/,
  /var DELNO_PREDLOGI/,
  /function zvezdicaIkona\(\)/,
  /predlog\.recommended \? ' is-recommended'/,
  /class="delno-resitev__zvezdica"/,
  /closest\("\.delno-resitev__indikator\[data-delno-predlog\]"\)/,
  /\(aktiven \? kljukicaIkona\(\) : ''\)/,
  /partialProposalConfirmed = !istiPotrjeniPredlog/,
  /privzetiNasloviNacinov/,
  /potrjen && potrjeniPredlog[\s\S]{0,100}potrjeniPredlog\.title/,
  /Prvo delno plačilo poravnate do/,
  /<div class="delno-resitev__predlog/,
  /return UJ\.osveziAddon\(plan, jezikAddon\(\)\)/,
  /data-fit-text-min="7\.5"/,
  /data-fit-text-lines="2"/,
]) {
  assert.match(logika, dokaz, "Poslovna logika ravnanja s preostankom mora ostati ohranjena.");
}

console.log("✓ Referenčni prikaz je povezan z ohranjeno logiko in varnim prileganjem besedila.");
