"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Cache = require("../app/storage-priloge-cache.js");

function novaShramba() {
  const podatki = new Map();
  return {
    getItem(kljuc) {
      return podatki.has(kljuc) ? podatki.get(kljuc) : null;
    },
    setItem(kljuc, vrednost) {
      podatki.set(kljuc, String(vrednost));
    },
  };
}

(async function () {
  let cas = 1_000_000;
  let podpisi = 0;
  const shramba = novaShramba();
  const ustvari = () =>
    Cache.ustvari({
      shramba,
      zdaj: () => cas,
      podpisi: async (pot, sekunde) => {
        podpisi += 1;
        await Promise.resolve();
        return "https://primer.test/" + pot + "?podpis=" + podpisi + "&velja=" + sekunde;
      },
    });

  const cache = ustvari();
  const [prvi, socasni] = await Promise.all([
    cache.pridobi("uporabnik/racun.jpg", 120),
    cache.pridobi("uporabnik/racun.jpg", 120),
  ]);
  assert.equal(podpisi, 1, "sočasna izrisa morata uporabiti en podpis");
  assert.equal(prvi.url, socasni.url);

  const ponovni = await cache.pridobi("uporabnik/racun.jpg", 120);
  assert.equal(podpisi, 1, "ponovni izris ne sme ustvariti novega podpisa");
  assert.equal(ponovni.izPredpomnilnika, true);

  const poNavigaciji = ustvari();
  const obnovljeni = await poNavigaciji.pridobi("uporabnik/racun.jpg", 120);
  assert.equal(podpisi, 1, "ista seja mora ohraniti podpis tudi po navigaciji");
  assert.equal(obnovljeni.url, prvi.url);

  cas += 14 * 60 * 1000;
  await poNavigaciji.pridobi("uporabnik/racun.jpg", 120);
  assert.equal(podpisi, 2, "pred iztekom mora nastati nov dovolj dolgo veljaven podpis");

  const appJs = fs.readFileSync(path.join(__dirname, "../app/app.js"), "utf8");
  const izvedbaApi = fs.readFileSync(path.join(__dirname, "../app/izvedba-api.js"), "utf8");
  assert.match(
    appJs,
    /const datotekaZaNalaganje = await optimizirajJpegZaStorage\(datoteka\);[\s\S]*?\.upload\(pot, datotekaZaNalaganje,/,
    "velike JPEG fotografije morajo biti optimizirane pred nalaganjem"
  );
  assert.doesNotMatch(
    izvedbaApi,
    /\.select\(["']\*["']\)/,
    "zaslon Izvedba ne sme prenašati vseh stolpcev zadeve"
  );

  ["neplacila.html", "neplacila-sporocilo.html", "neplacila-posiljanje.html"].forEach((ime) => {
    const html = fs.readFileSync(path.join(__dirname, "../app", ime), "utf8");
    const cacheIndex = html.indexOf("storage-priloge-cache.js");
    const appIndex = html.indexOf("app.js?v=");
    assert.ok(cacheIndex >= 0, ime + " mora vključiti predpomnilnik prilog");
    assert.ok(cacheIndex < appIndex, ime + " mora predpomnilnik vključiti pred app.js");
  });

  console.log("Storage egress cache: vsi testi uspešni");
})().catch((napaka) => {
  console.error(napaka);
  process.exitCode = 1;
});
