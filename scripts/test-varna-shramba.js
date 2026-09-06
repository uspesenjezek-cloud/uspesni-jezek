"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

function nalozi(sejaDela, trajnaDela) {
  const pomnilnik = { seja: {}, trajna: {} };
  function mk(store, dela) {
    return {
      getItem(k) { if (!dela) throw new Error("denied"); return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { if (!dela) throw new Error("denied"); store[k] = String(v); },
      removeItem(k) { if (!dela) throw new Error("denied"); delete store[k]; }
    };
  }
  global.sessionStorage = mk(pomnilnik.seja, sejaDela);
  global.localStorage = mk(pomnilnik.trajna, trajnaDela);
  delete require.cache[require.resolve(path.join(__dirname, "..", "app", "varna-shramba.js"))];
  return { api: require(path.join(__dirname, "..", "app", "varna-shramba.js")), pomnilnik };
}

// 1. Obicajno delovanje: brez rezerve se pise samo v sessionStorage.
{
  const { api, pomnilnik } = nalozi(true, true);
  assert.equal(api.zapisi("a", "1"), true);
  assert.equal(api.preberi("a"), "1");
  assert.equal(pomnilnik.seja.a, "1");
  assert.equal(pomnilnik.trajna.a, undefined, "brez izrecne zahteve se trajnost ne sme razsiriti");
}

// 2. Z rezervo pristane v obeh in prezivi izpad sessionStorage.
{
  const { api, pomnilnik } = nalozi(true, true);
  assert.equal(api.zapisi("b", "2", true), true);
  assert.equal(pomnilnik.seja.b, "2");
  assert.equal(pomnilnik.trajna.b, "2");
}

// 3. Zavrnjena sessionStorage: nic ne vrze, pisanje pošteno pove, da ni uspelo.
{
  const { api } = nalozi(false, false);
  assert.doesNotThrow(() => api.preberi("c"));
  assert.doesNotThrow(() => api.odstrani("c"));
  assert.equal(api.preberi("c"), null);
  assert.equal(api.zapisi("c", "3"), false, "klicatelj mora izvedeti, da vrednost ni shranjena");
  assert.equal(api.naVoljo(), false);
}

// 4. Zavrnjena sessionStorage, localStorage dela: rezerva prevzame.
{
  const { api, pomnilnik } = nalozi(false, true);
  assert.equal(api.zapisi("d", "4", true), true);
  assert.equal(pomnilnik.trajna.d, "4");
  assert.equal(api.preberi("d", true), "4");
}

// 5. JSON: pokvarjen zapis se obravnava kot da ga ni, ne kot napaka.
{
  const { api, pomnilnik } = nalozi(true, true);
  pomnilnik.seja.e = "{ni veljaven json";
  assert.doesNotThrow(() => api.preberiJson("e"));
  assert.equal(api.preberiJson("e"), null);
  assert.equal(api.zapisiJson("f", { x: 1 }), true);
  assert.deepEqual(api.preberiJson("f"), { x: 1 });
}

// 6. Ciklicna struktura ne sme vreci iz zapisiJson.
{
  const { api } = nalozi(true, true);
  const ciklicna = {}; ciklicna.self = ciklicna;
  assert.doesNotThrow(() => api.zapisiJson("g", ciklicna));
  assert.equal(api.zapisiJson("g", ciklicna), false);
}

console.log("Varna shramba: vsi primeri uspeli.");
