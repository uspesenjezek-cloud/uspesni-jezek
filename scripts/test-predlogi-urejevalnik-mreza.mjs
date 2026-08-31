/* Samostojen Node.js test za izracunajVelikostMreze – brez DOM, brez odvisnosti.
   Poganjaj: node scripts/test-predlogi-urejevalnik-mreza.mjs */

import { izracunajVelikostMreze, premakniPredlogoPoPrioriteti } from "../app/predlogi-urejevalnik.js";
import { readFileSync } from "node:fs";

let napake = 0;

function testiraj(steviloObstojecih, jeNova, pricakovano) {
  const rezultat = izracunajVelikostMreze(steviloObstojecih, jeNova);
  if (rezultat !== pricakovano) {
    console.error(
      `✗ NAPAKA: izracunajVelikostMreze(${steviloObstojecih}, ${jeNova}) = ${rezultat}, pričakovano ${pricakovano}`
    );
    napake++;
  } else {
    console.log(`✓ OK: izracunajVelikostMreze(${steviloObstojecih}, ${jeNova}) = ${rezultat}`);
  }
}

// 3 obstoječe + urejanje obstoječe => 3
testiraj(3, false, 3);

// 3 obstoječe + dodajanje nove => 4
testiraj(3, true, 4);

// 12 obstoječih => omejeno na 9
testiraj(12, false, 9);

// 12 obstoječih + nova => omejeno na 9
testiraj(12, true, 9);

// 0 obstoječih + nova => 1
testiraj(0, true, 1);

// 0 obstoječih + urejanje => 1 (min 1)
testiraj(0, false, 1);

// 8 obstoječih + nova => 9
testiraj(8, true, 9);

// 8 obstoječih + urejanje => 8
testiraj(8, false, 8);

const prestavljenoNavzgor = premakniPredlogoPoPrioriteti(["1", "2", "3", "4", "5"], "4", "2", false);
if (prestavljenoNavzgor.join(",") !== "1,4,2,3,5") {
  console.error(`✗ NAPAKA: premik predloge navzgor = ${prestavljenoNavzgor.join(",")}`);
  napake++;
} else {
  console.log("✓ OK: predloga se vstavi nad ciljno prioriteto");
}

const prestavljenoNavzdol = premakniPredlogoPoPrioriteti(["1", "2", "3", "4", "5"], "2", "4", true);
if (prestavljenoNavzdol.join(",") !== "1,3,4,2,5") {
  console.error(`✗ NAPAKA: premik predloge navzdol = ${prestavljenoNavzdol.join(",")}`);
  napake++;
} else {
  console.log("✓ OK: predloga se vstavi pod ciljno prioriteto");
}

const urejevalnikVir = readFileSync(new URL("../app/predlogi-urejevalnik.js", import.meta.url), "utf8");
if (!/kartica\.addEventListener\("pointerdown"/.test(urejevalnikVir)) {
  console.error("✗ NAPAKA: vlečenje ni vezano na celotno kartico");
  napake++;
} else if (!/event\.target\.closest\("\.preview-button, \.predlog-gumb--uporabi"\)/.test(urejevalnikVir)) {
  console.error("✗ NAPAKA: akcijska gumba nista izvzeta iz vlečenja kartice");
  napake++;
} else {
  console.log("✓ OK: celotna kartica je območje vlečenja, akcijska gumba ostaneta klikljiva");
}

if (!/DOLGI_PRITISK_MS = 300/.test(urejevalnikVir) || !/stanje\.pripravljen = true/.test(urejevalnikVir)) {
  console.error("✗ NAPAKA: mobilno vlečenje nima zakasnitve dolgega pritiska");
  napake++;
} else {
  console.log("✓ OK: mobilno vlečenje se aktivira šele po 300 ms dolgem pritisku");
}

if (!/zacni\(\{ clientX: stanje\.zadnjiX, clientY: stanje\.zadnjiY \}\)/.test(urejevalnikVir)
  || !/kartica\.setPointerCapture\(stanje\.pointerId\)/.test(urejevalnikVir)) {
  console.error("✗ NAPAKA: dolg pritisk kartice ne prime takoj in ne zadrži kazalca");
  napake++;
} else {
  console.log("✓ OK: dolg pritisk kartico takoj prime in zadrži kazalec za vlečenje");
}

if (!/addEventListener\("touchmove", zadrziDotikMedVlecenjem, \{ passive: false \}\)/.test(urejevalnikVir)
  || !/if \(!stanje \|\| !stanje\.aktivno \|\| !event\.cancelable\) return;\s*event\.preventDefault\(\)/.test(urejevalnikVir)) {
  console.error("✗ NAPAKA: aktivno mobilno vlečenje ne ustavi prevzema geste za pomikanje");
  napake++;
} else {
  console.log("✓ OK: po dolgem pritisku brskalnik geste ne prevzame za pomikanje");
}

if (!/requestAnimationFrame\(izrisiVlecenje\)/.test(urejevalnikVir)
  || !/--predlog-ghost-x/.test(urejevalnikVir)
  || /stanje\.ghost\.style\.left = event\.clientX/.test(urejevalnikVir)) {
  console.error("✗ NAPAKA: premik kartice ni usklajen z osveževanjem zaslona");
  napake++;
} else {
  console.log("✓ OK: vlečenje je omejeno na en GPU-premik na osvežitev zaslona");
}

if (napake === 0) {
  console.log("\n✓ Vsi testi uspešni.");
  process.exit(0);
} else {
  console.error(`\n✗ ${napake} napak.`);
  process.exit(1);
}
