const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const engine = require("../app/dejavnosti-engine.js");

assert.equal(engine.version, "dejavnosti-v1");
assert.ok(engine.katalog.length >= 450, "Katalog mora vsebovati najmanj 450 različnih dejavnosti.");
assert.ok(engine.skupine.length >= 18, "Katalog mora ostati večnivojski.");
assert.equal(new Set(engine.katalog.map((zapis) => zapis.ime)).size, engine.katalog.length);

const primeri = [
  ["ne vem kaj je seo, hočem da me najdejo na googlu", "SEO"],
  ["delajo oglase na googlu", "Google Ads"],
  ["polaga ploščice v kopalnici", "Polaganje keramike"],
  ["popravlja pipe in odmaši odtoke", "Vodovodne inštalacije"],
  ["električar montira vtičnice", "Elektroinštalacije"],
  ["delajo in popravljajo strehe", "Krovska dela"],
  ["vodi knjige in dela bilance", "Računovodstvo"],
  ["striže lase in barva lase", "Frizerski salon"],
  ["menjava gum na avtu", "Vulkanizerstvo"],
  ["izdeluje omare in pohištvo po meri", "Mizarstvo"],
  ["montira sončne panele", "Sončne elektrarne"],
  ["snema videe za podjetja", "Video produkcija"],
];

primeri.forEach(([vnos, pricakovano]) => {
  const rezultat = engine.razvrsti(vnos);
  assert.equal(rezultat.glavni && rezultat.glavni.ime, pricakovano, vnos);
  assert.equal(rezultat.zahtevaPotrditev, true);
});

[
  { pricakovano: "SEO", jedra: ["da me najdejo na googlu", "hočem višje na googlu"] },
  { pricakovano: "Polaganje keramike", jedra: ["polaga ploščice", "keramičar za kopalnico"] },
  { pricakovano: "Vodovodne inštalacije", jedra: ["popravlja pipe", "odmaši odtok"] },
  { pricakovano: "Avtoservis", jedra: ["popravlja avtomobile", "avtomehanik"] },
].forEach(({ pricakovano, jedra }) => {
  ["", "to podjetje ", "obrtnik "].forEach((predpona) => {
    jedra.forEach((jedro) => assert.equal(engine.razvrsti(predpona + jedro).glavni.ime, pricakovano));
  });
});

assert.equal(engine.predlagaj("ploscice", { limit: 5 })[0].ime, "Polaganje keramike");
assert.equal(engine.predlagaj("racunovodtvo", { limit: 5 })[0].ime, "Računovodstvo");
assert.equal(engine.predlagaj("", { limit: 8 }).length, 8);
assert.ok(!engine.predlagaj("splet", { limit: 12, izloci: ["Izdelava spletnih strani"] }).some((zapis) => zapis.ime === "Izdelava spletnih strani"));
assert.equal(engine.razvrsti("nekaj povsem nerazumljivega qxz").zaupanje, "ni_zadetka");

const meritve = [];
for (let ponovitev = 0; ponovitev < 250; ponovitev += 1) {
  const zacetek = performance.now();
  primeri.forEach(([vnos]) => engine.predlagaj(vnos, { limit: 12 }));
  meritve.push(performance.now() - zacetek);
}
meritve.sort((a, b) => a - b);
const p50 = meritve[Math.floor(meritve.length * 0.5)];
const p95 = meritve[Math.floor(meritve.length * 0.95)];
const max = meritve[meritve.length - 1];
assert.ok(p95 < 80, `p95 je previsok: ${p95.toFixed(2)} ms`);

console.log(`Dejavnosti engine: ${engine.katalog.length} dejavnosti, ${engine.skupine.length} skupin, p50=${p50.toFixed(2)} ms, p95=${p95.toFixed(2)} ms, max=${max.toFixed(2)} ms`);
