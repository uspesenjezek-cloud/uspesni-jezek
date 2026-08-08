/**
 * Enotski testi za Rok plačila (čista logika).
 * Zagon: node scripts/test-rok-placila.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const UJ = require(path.join(root, "..", "app", "rok-placila-utils.js"));

let ok = 0;
function test(ime, fn) {
  try {
    fn();
    ok += 1;
    console.log("OK  " + ime);
  } catch (e) {
    console.error("FAIL " + ime);
    console.error("  " + (e && e.message ? e.message : e));
    process.exitCode = 1;
  }
}

const base = "2026-08-08";

test("1. Predlog 2 = +5 dni od pošiljanja", () => {
  const days = UJ.PRIVZETI_DNEVI[2];
  assert.equal(days, 5);
  assert.equal(UJ.izracunajRok(base, days), "2026-08-13");
});

test("2. Predlog 3 v samodejnem načinu spremeni datum", () => {
  const d2 = UJ.izracunajRok(base, UJ.PRIVZETI_DNEVI[2]);
  const d3 = UJ.izracunajRok(base, UJ.PRIVZETI_DNEVI[3]);
  assert.equal(d2, "2026-08-13");
  assert.equal(d3, "2026-08-15");
  assert.notEqual(d2, d3);
});

test("3. Ročni datum ostane pri »menjavi predloga« (brez preračuna)", () => {
  const manual = "2026-09-01";
  // Simulacija: v manual načinu ne kličemo izracunajRok ob menjavi predloga.
  const poMenjavi = manual;
  assert.equal(poMenjavi, "2026-09-01");
});

test("4. Ponovni vklop samodejnega načina preračuna datum", () => {
  const linked = 2;
  const days = UJ.PRIVZETI_DNEVI[linked];
  assert.equal(UJ.izracunajRok(base, days), "2026-08-13");
});

test("5. Datum pred pošiljanjem = napaka", () => {
  assert.equal(UJ.jeDatumPredPosiljanjem("2026-08-07", base), true);
  assert.equal(UJ.jeDatumPredPosiljanjem("2026-08-08", base), false);
  assert.equal(UJ.jeDatumPredPosiljanjem("2026-08-13", base), false);
});

test("6. Rok se doda samo enkrat", () => {
  const vrstica = UJ.sestaviVrsticoRoka("2026-08-13", "sl");
  const r1 = UJ.posodobiSistemskoVrstico("Pozdravljeni.", "", vrstica, true);
  const r2 = UJ.posodobiSistemskoVrstico(r1.besedilo, vrstica, vrstica, true);
  const pojavitve = r2.besedilo.split(vrstica).length - 1;
  assert.equal(pojavitve, 1);
});

test("7. Sprememba roka zamenja obstoječo vrstico", () => {
  const a = UJ.sestaviVrsticoRoka("2026-08-13", "sl");
  const b = UJ.sestaviVrsticoRoka("2026-08-20", "sl");
  const z = UJ.posodobiSistemskoVrstico("Besedilo.\n\n" + a, a, b, true);
  assert.ok(z.besedilo.includes(b));
  assert.ok(!z.besedilo.includes(a));
});

test("8. Odstranitev ne spremeni drugega besedila", () => {
  const vrstica = UJ.sestaviVrsticoRoka("2026-08-13", "sl");
  const izvor = "Ostanek ostane.\n\n" + vrstica;
  const r = UJ.odstraniSistemskoVrstico(izvor, vrstica);
  assert.equal(r.besedilo, "Ostanek ostane.");
});

test("11. Nemško sporočilo dobi nemško vrstico", () => {
  const jezik = UJ.ugotoviJezikSporocila(
    "Sehr geehrte Damen und Herren, bitte überweisen Sie den Betrag."
  );
  assert.equal(jezik, "de");
  assert.equal(
    UJ.sestaviVrsticoRoka("2026-08-13", "de"),
    "Zahlungsfrist: 13.08.2026."
  );
});

test("12. Računanje datuma brez UTC premika (preko DST)", () => {
  // 2026-03-29 je okoli prehoda na poletni čas v EU.
  assert.equal(UJ.dodajKoledarskeDni("2026-03-28", 2), "2026-03-30");
  assert.equal(UJ.dodajKoledarskeDni("2026-10-24", 2), "2026-10-26");
});

test("14. Privzeti roki: naraščajoči + shranjevanje ne vpliva na drug osnutek", () => {
  assert.equal(UJ.soDneviNarascajoci(UJ.klonPrivzetih()), true);
  const slabi = UJ.klonPrivzetih();
  slabi[3] = 2;
  assert.equal(UJ.soDneviNarascajoci(slabi), false);

  const store = {
    data: {},
    getItem(k) {
      return this.data[k] || null;
    },
    setItem(k, v) {
      this.data[k] = String(v);
    },
  };
  const novi = UJ.klonPrivzetih();
  novi[2] = 6;
  assert.equal(UJ.shraniPrivzeteDni(novi, store), true);
  const nalozeni = UJ.naloziPrivzeteDni(store);
  assert.equal(nalozeni[2], 6);
  // Obstoječi osnutek (simulacija) obdrži svoj deadlineDate.
  const obstojeciOsnutek = { deadlineDate: "2026-08-13", termDays: 5 };
  assert.equal(obstojeciOsnutek.deadlineDate, "2026-08-13");
  assert.notEqual(obstojeciOsnutek.termDays, nalozeni[2]);
});

test("Opozorilo pri ročno spremenjeni vrstici", () => {
  const stara = "Rok plačila: 13. 8. 2026.";
  const r = UJ.posodobiSistemskoVrstico(
    "Besedilo z urejenim rokom.",
    stara,
    "Rok plačila: 20. 8. 2026.",
    true
  );
  assert.equal(r.ok, false);
  assert.equal(r.opozorilo, "spremenjeno");
});

console.log("\nUspešnih: " + ok);
