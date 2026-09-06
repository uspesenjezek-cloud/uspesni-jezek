const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const izvedbaJs = fs.readFileSync(path.join(__dirname, "..", "app", "izvedba.js"), "utf8");
const izvedbaCss = fs.readFileSync(path.join(__dirname, "..", "app", "izvedba.css"), "utf8");
const skupniCss = fs.readFileSync(path.join(__dirname, "..", "app", "styles.css"), "utf8");
const zgodovinaCss = fs.readFileSync(path.join(__dirname, "..", "app", "neplacila-zgodovina.css"), "utf8");

assert.match(skupniCss, /\.obrocno-sheet__stevilka\s*\{[^}]*width:\s*50px;[^}]*height:\s*50px;[^}]*border-radius:\s*50%;[^}]*aspect-ratio:\s*1;/s);
assert.match(izvedbaCss, /\.izvedba-obrok-planer__stevilo-pill\s*\{[^}]*width:\s*34px;[^}]*height:\s*34px;[^}]*border-radius:\s*50%;[^}]*aspect-ratio:\s*1;/s);

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
assert.match(izvedbaJs, /class="izvedba-obrok-planer__akcije"[\s\S]*?>\+ Dodaj obrok<\/button>[\s\S]*?data-obrok-planer-dodaj-vse[\s\S]*?>Shrani obroke<\/button>/);
assert.doesNotMatch(izvedbaJs, /Vsota obrokov:/);
assert.match(izvedbaJs, /zgodovina-dogodek__polje--par' \+ \(!vrednost \? ' is-obvezno-manjka' : ''\)/);
assert.match(izvedbaJs, /izvedba-obrok-planer__razmik' \+ \(!planer\.razmik \? ' is-obvezno-manjka' : ''\)/);
assert.match(izvedbaCss, /\.izvedba-obrok-planer__akcije\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
assert.match(zgodovinaCss, /\.izvedba-obrok-planer__akcije \.izvedba-obrok-planer__dodaj,[\s\S]*?\.izvedba-obrok-planer__akcije \.izvedba-poravnava-dodaj-korak\s*\{[^}]*margin-top:\s*0;/s);
assert.match(zgodovinaCss, /@keyframes zgodovina-obvezno-pulz[\s\S]*?2\.6s ease-in-out infinite/);
assert.match(izvedbaJs, /zgodovina-kontrolnik__select' \+ \(vrednost \? ' has-value' : ''\)/);
assert.match(zgodovinaCss, /\.zgodovina-kontrolnik__select-seznam button\.is-selected\s*\{[^}]*color:\s*rgb\(var\(--action-rgb\)\);[^}]*background:\s*linear-gradient/s);
assert.match(zgodovinaCss, /\.zgodovina-dogodek__polje:has\(\.zgodovina-kontrolnik__select\)\s*\{\s*grid-column:\s*1 \/ -1;/);
assert.match(zgodovinaCss, /\.stran--neplacila-zgodovina \.atena__panel\s*\{[^}]*height:\s*auto;[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/s);
assert.match(zgodovinaCss, /\.atena__panel > \.izvedba-action-sheet__scroll\s*\{[^}]*overflow-y:\s*visible;/s);
assert.match(zgodovinaCss, /\.izvedba-obrok-planer__akcije\s*\{[^}]*position:\s*relative;[^}]*padding-top:\s*10px;/s);
assert.match(zgodovinaCss, /\.izvedba-obrok-planer__akcije::before\s*\{[^}]*left:\s*0;[^}]*width:\s*100%;[^}]*height:\s*2px;[^}]*background:\s*linear-gradient\(90deg,[^}]*0%[^}]*16%[^}]*84%[^}]*100%\);/s);
assert.match(zgodovinaCss, /\.izvedba-obrok-planer__akcije \.izvedba-obrok-planer__dodaj,[\s\S]*?\.izvedba-obrok-planer__akcije \.izvedba-poravnava-dodaj-korak\s*\{[^}]*height:\s*48px;[^}]*min-height:\s*48px;/s);

console.log("Obročni planer: vse vrstice ostanejo razširjene, skupni način plačila pa se prenese na vsak obrok.");
