const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const izvedbaJs = fs.readFileSync(path.join(__dirname, "..", "app", "izvedba.js"), "utf8");

const obnovitev = izvedbaJs.match(/function obnoviPlanerObroke\(\) \{[\s\S]*?\n  \}/);
assert.ok(obnovitev, "Funkcija za obnovitev obrokov mora obstajati.");
assert.match(obnovitev[0], /razsirjen:\s*true/);
assert.doesNotMatch(obnovitev[0], /i\s*===\s*0|obstojec\.razsirjen/);

const dodajanje = izvedbaJs.match(/var planerDodaj = event\.target\.closest\("\[data-obrok-planer-dodaj\]"\);[\s\S]*?\n        \}/);
assert.ok(dodajanje, "Tok za dodajanje obroka mora obstajati.");
assert.doesNotMatch(dodajanje[0], /razsirjen\s*=\s*false/);

assert.match(izvedbaJs, /preklopVrstica\.razsirjen = preklopVrstica\.razsirjen === false/);
assert.doesNotMatch(izvedbaJs, /aria-hidden="true">⌄<\/span>/);

const paketnoDodajanje = izvedbaJs.match(/function dodajVsePlaniraneObroke\(\) \{[\s\S]*?\n  \}/);
assert.ok(paketnoDodajanje, "Paketno dodajanje obrokov mora obstajati.");
assert.match(paketnoDodajanje[0], /var skupniNacinPlacila = nastavitve\.paymentMethod/);
assert.match(paketnoDodajanje[0], /var aktivneNastavitve = state\.settlementSettings\.installment/);
assert.match(paketnoDodajanje[0], /aktivneNastavitve\.paymentMethod = skupniNacinPlacila/);
assert.match(izvedbaJs, /var presegaPreostaliDolg = znesekVneseno > dolg \+ 0\.009/);

console.log("Obročni planer: vse vrstice ostanejo razširjene, skupni način plačila pa se prenese na vsak obrok.");
