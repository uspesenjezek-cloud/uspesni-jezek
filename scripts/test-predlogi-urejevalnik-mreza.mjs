/* Samostojen Node.js test za izracunajVelikostMreze – brez DOM, brez odvisnosti.
   Poganjaj: node scripts/test-predlogi-urejevalnik-mreza.mjs */

import { izracunajVelikostMreze } from "../app/predlogi-urejevalnik.js";

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

if (napake === 0) {
  console.log("\n✓ Vsi testi uspešni.");
  process.exit(0);
} else {
  console.error(`\n✗ ${napake} napak.`);
  process.exit(1);
}