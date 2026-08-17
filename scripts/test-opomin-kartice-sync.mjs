import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(root, "..", "app", "opomin-kartice-sync.js"),
  "utf8"
);

const key = "neplacilo-korak3-nacrt";
const key1 = "neplacilo-korak1-podatki";
const key2 = "neplacilo-korak2-podatki";
const storage = new Map();
const writes = [];
const draftWrites = [];
let remote = {
  vkljuceni_indeksi: [1, 2, 3, 4, 5, 6, 10],
  client_id: "iphone",
  settings_updated_at: "2026-08-13T10:00:00.000Z",
  predaja_updated_at: "2026-08-13T11:00:00.000Z",
  predaja_odvetniku: {
    title: "Predaja odvetniku",
    scheduledAt: "2026-08-20T08:00:00.000Z",
    status: "draft",
    lawyerHandoff: {
      lawyerId: "iphone-lawyer",
      lawyerSnapshot: {
        name: "Odvetnica s telefona",
        firm: "Najnovejša pisarna",
      },
      selectedPackage: { id: "paket-telefon", name: "Paket s telefona" },
      message: "Najnovejše sporočilo s telefona",
      documents: [{ id: "doc-telefon", name: "racun.pdf" }],
    },
  },
};

const localPlan = {
  _karticeUpdatedAt: "2026-08-13T09:00:00.000Z",
  _predajaUpdatedAt: "2026-08-13T09:00:00.000Z",
  steps: Array.from({ length: 10 }, (_, i) => ({
    index: i + 1,
    kind: i === 9 ? "manual_lawyer" : "sms",
    deliveryMode: i === 9 ? "manual" : "automatic",
    isExcluded: ![1, 9, 10].includes(i + 1),
    ...(i === 9
      ? {
          lawyerHandoff: {
            lawyerId: "pc-lawyer",
            lawyerSnapshot: { name: "Staro ime s PC-ja" },
          },
        }
      : {}),
  })),
};
storage.set(key, JSON.stringify(localPlan));
storage.set(key1, JSON.stringify({ imeDolznika: "Stari PC", znesek: "11" }));
storage.set(key2, JSON.stringify({ sporociloDolzniku: "Staro sporocilo" }));

const phonePlan = structuredClone(localPlan);
phonePlan.steps[9].lawyerHandoff = structuredClone(remote.predaja_odvetniku.lawyerHandoff);
let remoteDraft = {
  korak1: { imeDolznika: "Telefon Dolznik", znesek: "9446", stevilkaRacuna: "Nsjs" },
  korak2: { sporociloDolzniku: "Najnovejse sporocilo s telefona" },
  nacrt: phonePlan,
  client_id: "iphone",
  sync_updated_at: "2026-08-13T11:30:00.000Z",
};

const supabaseKlient = {
  auth: {
    async getUser() {
      return { data: { user: { id: "test-user" } } };
    },
  },
  from(table) {
    return {
      select() {
        return {
          eq() {
            return {
              async maybeSingle() {
                return {
                  data: structuredClone(
                    table === "opomin_osnutek_sync" ? remoteDraft : remote
                  ),
                  error: null,
                };
              },
            };
          },
        };
      },
    };
  },
  async rpc(name, payload) {
    if (name === "sinhroniziraj_opomin_osnutek") {
      draftWrites.push(structuredClone(payload));
      remoteDraft = {
        korak1: structuredClone(payload.p_korak1),
        korak2: structuredClone(payload.p_korak2),
        nacrt: structuredClone(payload.p_nacrt),
        client_id: payload.p_client_id,
        sync_updated_at: payload.p_sync_updated_at,
      };
      return { data: null, error: null };
    }
    assert.equal(name, "sinhroniziraj_opomin_kartice");
    writes.push(structuredClone(payload));
    const settingsWins =
      Date.parse(payload.p_settings_updated_at) >= Date.parse(remote.settings_updated_at);
    const predajaWins =
      payload.p_predaja_odvetniku &&
      Date.parse(payload.p_predaja_updated_at) >=
        Date.parse(remote.predaja_updated_at || "1970-01-01T00:00:00.000Z");
    remote = {
      ...remote,
      ...(settingsWins
        ? {
            vkljuceni_indeksi: [...payload.p_vkljuceni_indeksi],
            settings_updated_at: payload.p_settings_updated_at,
          }
        : {}),
      ...(predajaWins
        ? {
            predaja_odvetniku: structuredClone(payload.p_predaja_odvetniku),
            predaja_updated_at: payload.p_predaja_updated_at,
          }
        : {}),
      client_id: payload.p_client_id,
    };
    return { data: null, error: null };
  },
  channel() {
    return {
      on() { return this; },
      subscribe() { return this; },
    };
  },
};

const context = {
  console,
  Date,
  JSON,
  Math,
  Number,
  Promise,
  Set,
  clearTimeout,
  setTimeout,
  structuredClone,
  supabaseKlient,
  sessionStorage: {
    getItem(name) { return storage.get(name) ?? null; },
    setItem(name, value) { storage.set(name, value); },
  },
  location: { reload() {} },
};
context.window = context;

vm.runInNewContext(source, context, { filename: "opomin-kartice-sync.js" });
const sync = context.UJOpominKarticeSync;

await sync.naloziPredZagonom();
assert.equal(writes.length, 0, "Osvezitev ne sme zapisati starega lokalnega stanja");
assert.equal(draftWrites.length, 0, "PC ob osvezitvi ne sme prepisati telefonskega osnutka");
let plan = JSON.parse(storage.get(key));
assert.equal(JSON.parse(storage.get(key1)).imeDolznika, "Telefon Dolznik");
assert.equal(JSON.parse(storage.get(key1)).znesek, "9446");
assert.equal(
  JSON.parse(storage.get(key2)).sporociloDolzniku,
  "Najnovejse sporocilo s telefona"
);
assert.deepEqual(
  plan.steps.filter((step) => !step.isExcluded).map((step) => step.index),
  [1, 2, 3, 4, 5, 6, 10],
  "Ob osvezitvi mora zmagati stanje iz baze"
);
assert.equal(
  plan.steps[9].lawyerHandoff.lawyerSnapshot.name,
  "Odvetnica s telefona",
  "Novejse ime odvetnika s telefona se mora prikazati tudi na PC-ju"
);
assert.equal(plan.steps[9].lawyerHandoff.selectedPackage.name, "Paket s telefona");
assert.equal(plan.steps[9].lawyerHandoff.message, "Najnovejše sporočilo s telefona");
assert.deepEqual(
  plan.steps[9].lawyerHandoff.documents.map((document) => document.name),
  ["racun.pdf"]
);

plan.steps[6].isExcluded = false;
await sync.narociShranjevanje(plan);
assert.deepEqual(writes.at(-1).p_vkljuceni_indeksi, [1, 2, 3, 4, 5, 6, 7, 10]);
assert.equal(draftWrites.at(-1).p_korak1.imeDolznika, "Telefon Dolznik");
assert.equal(draftWrites.at(-1).p_nacrt.steps[6].isExcluded, false);

plan.steps[1].isExcluded = true;
const prviZapis = sync.narociShranjevanje(plan);
plan.steps[2].isExcluded = true;
const zadnjiZapis = sync.narociShranjevanje(plan);
await Promise.all([prviZapis, zadnjiZapis]);
assert.deepEqual(
  writes.at(-1).p_vkljuceni_indeksi,
  [1, 4, 5, 6, 7, 10],
  "Pri hitrih klikih mora zadnja izbira ostati zadnja tudi v bazi"
);

plan.steps[9].lawyerHandoff.lawyerSnapshot.name = "Nova izbira na PC-ju";
await sync.narociShranjevanje(plan);
assert.equal(
  writes.at(-1).p_predaja_odvetniku.lawyerHandoff.lawyerSnapshot.name,
  "Nova izbira na PC-ju",
  "Sprememba odvetnika mora v skupno stanje poslati celotno predajo"
);

plan.steps[9].lawyerHandoff.lawyerSnapshot.name = "";
await sync.narociShranjevanje(plan);
assert.equal(
  writes.at(-1).p_predaja_odvetniku,
  null,
  "Prazna kartica ne sme izbrisati veljavnega odvetnika z druge naprave"
);

// Regresija: potrditve vseh kartic morajo v skupnem osnutku preglasiti
// morebitni tik pred tem uvrsceni zapis z njihovim starim stanjem.
plan.steps.forEach((step) => {
  step.status = "draft";
  step.confirmedAt = null;
});
const staroStanjePredPotrditvijo = sync.narociShranjevanje(plan);
plan.steps.forEach((step, index) => {
  step.status = "confirmed";
  step.confirmedAt = `2026-08-14T12:${String(index).padStart(2, "0")}:00.000Z`;
});
const potrjenoStanjeVsehKartic = sync.narociShranjevanje(plan);
await Promise.all([staroStanjePredPotrditvijo, potrjenoStanjeVsehKartic]);
assert.deepEqual(
  remoteDraft.nacrt.steps.map((step) => step.status),
  Array.from({ length: 10 }, () => "confirmed"),
  "Po osvezitvi mora vseh 10 kartic ostati potrjenih"
);
assert.equal(
  remoteDraft.nacrt.steps[2].confirmedAt,
  "2026-08-14T12:02:00.000Z",
  "Tretja kartica mora ohraniti potrditev"
);
assert.equal(
  remoteDraft.nacrt.steps[8].confirmedAt,
  "2026-08-14T12:08:00.000Z",
  "Deveta kartica mora ohraniti potrditev"
);

const iphoneStorage = new Map([
  [key, JSON.stringify(phonePlan)],
  [key1, JSON.stringify({ imeDolznika: "iPhone je prvi vir", znesek: "9446" })],
  [key2, JSON.stringify({ sporociloDolzniku: "Telefon" })],
]);
const iphoneDraftWrites = [];
const iphoneSupabase = {
  auth: supabaseKlient.auth,
  from(table) {
    return {
      select() {
        return {
          eq() {
            return {
              async maybeSingle() {
                return {
                  data: table === "opomin_osnutek_sync" ? null : structuredClone(remote),
                  error: null,
                };
              },
            };
          },
        };
      },
    };
  },
  async rpc(name, payload) {
    if (name === "sinhroniziraj_opomin_osnutek") {
      iphoneDraftWrites.push(structuredClone(payload));
    }
    return { data: null, error: null };
  },
  channel: supabaseKlient.channel,
};
const iphoneContext = {
  ...context,
  supabaseKlient: iphoneSupabase,
  navigator: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" },
  sessionStorage: {
    getItem(name) { return iphoneStorage.get(name) ?? null; },
    setItem(name, value) { iphoneStorage.set(name, value); },
  },
};
iphoneContext.window = iphoneContext;
vm.runInNewContext(source, iphoneContext, { filename: "opomin-kartice-sync-iphone.js" });
await iphoneContext.UJOpominKarticeSync.naloziPredZagonom();
assert.equal(iphoneDraftWrites.length, 1, "Prazen skupni osnutek mora prvi napolniti iPhone");
assert.equal(iphoneDraftWrites[0].p_korak1.imeDolznika, "iPhone je prvi vir");

console.log("Sinhronizacija kartic med napravami: vsi testi uspesni");
