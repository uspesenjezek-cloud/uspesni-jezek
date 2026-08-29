"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.sessionStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
};
require("../app/opomin-nacrt.js");
const N = global.UJOpominNacrt;

function novPlan() {
  return N.narediNovPlan(
    { imeDolznika: "Test", znesek: 100, datumZapadlosti: "2026-08-01" },
    { izbranTonId: "friendly" }
  );
}
function korakIndex(plan) {
  return plan.steps.find((s) => s.kind === "manual_lawyer").index;
}
function filter(plan, index) {
  return N.najdiKorak(plan, index).lawyerHandoff.offerFilter;
}

let plan = novPlan();
let ix = korakIndex(plan);

/* 1. Star osnutek brez offerFilter se odpre brez napake. */
assert.equal(filter(plan, ix), null);

/* 3. Privzeto (brez filtra) je offerFilter null; UI to preslika v vse odvetnike. */
assert.equal(N.najdiKorak(plan, ix).lawyerHandoff.visibleLawyerIds, null);

/* 4. best_match dopušča več izbranih odvetnikov. */
plan = N.posodobiFilterPonudb(plan, ix, {
  mode: "best_match",
  lawyerIds: ["joze_kovac", "ana_novak", "marko_zupan"],
});
assert.equal(filter(plan, ix).mode, "best_match");
assert.deepEqual(filter(plan, ix).lawyerIds, ["joze_kovac", "ana_novak", "marko_zupan"]);
assert.equal(filter(plan, ix).singleLawyerId, null);
assert.equal(filter(plan, ix).version, 1);
assert.ok(filter(plan, ix).updatedAt);

/* Združljivostna projekcija visibleLawyerIds mora biti ista kot lawyerIds. */
assert.deepEqual(N.najdiKorak(plan, ix).lawyerHandoff.visibleLawyerIds, filter(plan, ix).lawyerIds);

/* 5. Ni mogoče potrditi nič izbranih odvetnikov. */
let prej = JSON.stringify(filter(plan, ix));
plan = N.posodobiFilterPonudb(plan, ix, { mode: "best_match", lawyerIds: [] });
assert.equal(JSON.stringify(filter(plan, ix)), prej);

/* Deduplikacija + odstranitev neveljavnih ID-jev. */
plan = N.posodobiFilterPonudb(plan, ix, {
  mode: "best_match",
  lawyerIds: ["joze_kovac", "joze_kovac", "ana_novak", "neznan_id"],
  validLawyerIds: ["joze_kovac", "ana_novak", "marko_zupan"],
});
assert.deepEqual(filter(plan, ix).lawyerIds, ["joze_kovac", "ana_novak"]);

/* 6. single_lawyer zahteva točno enega (veljavnega) odvetnika. */
prej = JSON.stringify(filter(plan, ix));
plan = N.posodobiFilterPonudb(plan, ix, { mode: "single_lawyer", lawyerIds: [], singleLawyerId: null });
assert.equal(JSON.stringify(filter(plan, ix)), prej);
plan = N.posodobiFilterPonudb(plan, ix, { mode: "single_lawyer", lawyerIds: ["joze_kovac"], singleLawyerId: "ana_novak" });
assert.equal(JSON.stringify(filter(plan, ix)), prej);
plan = N.posodobiFilterPonudb(plan, ix, { mode: "single_lawyer", lawyerIds: ["ana_novak"], singleLawyerId: "ana_novak" });
assert.equal(filter(plan, ix).mode, "single_lawyer");
assert.equal(filter(plan, ix).singleLawyerId, "ana_novak");

/* 14/15. Izbrani paket/odvetnik se ob filtriranju ne spremenita. */
plan = N.posodobiIzbraniPaket(plan, ix, {
  packageId: "lawyer_demand_letter",
  priceCents: 2990,
  priceLabel: "29,90 €",
  titleSnapshot: "Odvetnik pošlje opomin",
});
plan = N.posodobiOdvetnika(plan, ix, { name: "Odvetnik Jože Kovač", officeName: "P", email: "e", phone: "p" }, "joze_kovac");
const paketPrej = JSON.stringify(N.najdiKorak(plan, ix).lawyerHandoff.selectedPackage);
const odvetnikPrej = N.najdiKorak(plan, ix).lawyerHandoff.lawyerId;
plan = N.posodobiFilterPonudb(plan, ix, {
  mode: "best_match",
  lawyerIds: ["marko_zupan"],
  validLawyerIds: ["joze_kovac", "ana_novak", "marko_zupan"],
});
assert.equal(JSON.stringify(N.najdiKorak(plan, ix).lawyerHandoff.selectedPackage), paketPrej);
assert.equal(N.najdiKorak(plan, ix).lawyerHandoff.lawyerId, odvetnikPrej);

/* 21. Lastni odvetnik brez ocene ne dobi lažne ocene. */
plan = N.posodobiFilterPonudb(plan, ix, {
  mode: "best_match",
  lawyerIds: ["joze_kovac", "custom_abc"],
  customLawyers: [{ id: "custom_abc", name: "Odvetnik Po Meri", officeName: "Pisarna PM", email: "pm@primer.si", phone: "+386 1 000 000" }],
  validLawyerIds: ["joze_kovac", "ana_novak", "marko_zupan", "custom_abc"],
});
const custom = N.najdiKorak(plan, ix).lawyerHandoff.customLawyers.find((c) => c.id === "custom_abc");
assert.ok(custom);
assert.equal(custom.name, "Odvetnik Po Meri");
assert.equal(custom.rating, undefined);

/* 2/8. Star visibleLawyerIds se normalizira v offerFilter (delegacija). */
let plan2 = novPlan();
let ix2 = korakIndex(plan2);
plan2 = N.posodobiPrikazaneOdvetnike(plan2, ix2, ["ana_novak", "marko_zupan"]);
assert.deepEqual(N.najdiKorak(plan2, ix2).lawyerHandoff.visibleLawyerIds, ["ana_novak", "marko_zupan"]);
assert.deepEqual(filter(plan2, ix2).lawyerIds, ["ana_novak", "marko_zupan"]);
assert.equal(filter(plan2, ix2).mode, "best_match");

/* 10. Uporabi filter shrani točno enkrat (helper je atomski; preverimo, da se
   updatedAt spremeni natanko enkrat na klic, brez podvajanja stanja). */
let plan3 = novPlan();
let ix3 = korakIndex(plan3);
plan3 = N.posodobiFilterPonudb(plan3, ix3, { mode: "best_match", lawyerIds: ["joze_kovac"] });
const u1 = filter(plan3, ix3).updatedAt;
const stKopij = JSON.stringify(N.najdiKorak(plan3, ix3).lawyerHandoff).split("offerFilter").length - 1;
assert.equal(stKopij, 1);
assert.ok(u1);

/* Atomičnost: zavrnjena validacija NE sme delno zapisati customLawyers. */
let planA = novPlan();
let ixA = korakIndex(planA);
planA = N.posodobiFilterPonudb(planA, ixA, { mode: "best_match", lawyerIds: ["joze_kovac"] });
const customPrejA = JSON.stringify(N.najdiKorak(planA, ixA).lawyerHandoff.customLawyers);
const filterPrejA = JSON.stringify(N.najdiKorak(planA, ixA).lawyerHandoff.offerFilter);
const zavrnjen = N.posodobiFilterPonudb(planA, ixA, {
  mode: "best_match",
  lawyerIds: [],
  customLawyers: [{ id: "custom_x", name: "Napačen" }],
});
assert.equal(JSON.stringify(N.najdiKorak(zavrnjen, ixA).lawyerHandoff.customLawyers), customPrejA);
assert.equal(JSON.stringify(N.najdiKorak(zavrnjen, ixA).lawyerHandoff.offerFilter), filterPrejA);

/* Zavrnjena single_lawyer validacija prav tako ne sme zapisati customLawyers. */
let planB = novPlan();
let ixB = korakIndex(planB);
const zavrnjenB = N.posodobiFilterPonudb(planB, ixB, {
  mode: "single_lawyer",
  lawyerIds: ["custom_y"],
  singleLawyerId: "custom_drug",
  customLawyers: [{ id: "custom_y", name: "Odvetnik Y" }],
});
assert.deepEqual(N.najdiKorak(zavrnjenB, ixB).lawyerHandoff.customLawyers, []);
assert.equal(N.najdiKorak(zavrnjenB, ixB).lawyerHandoff.offerFilter, null);

/* single_lawyer z lastnim odvetnikom (veljaven) se zapiše skupaj z njim. */
let planC = novPlan();
let ixC = korakIndex(planC);
planC = N.posodobiFilterPonudb(planC, ixC, {
  mode: "single_lawyer",
  lawyerIds: ["custom_ana"],
  singleLawyerId: "custom_ana",
  customLawyers: [{ id: "custom_ana", name: "Odvetnica Ana P.", officeName: "Pisarna AP", email: "ana@primer.si", phone: "+386 1 111" }],
  validLawyerIds: ["joze_kovac", "ana_novak", "marko_zupan", "custom_ana"],
});
assert.equal(filter(planC, ixC).mode, "single_lawyer");
assert.equal(filter(planC, ixC).singleLawyerId, "custom_ana");
assert.deepEqual(filter(planC, ixC).lawyerIds, ["custom_ana"]);
assert.equal(N.najdiKorak(planC, ixC).lawyerHandoff.customLawyers[0].id, "custom_ana");

/* Serializacija → ponovno nalaganje ohrani filter in lastnega odvetnika. */
N.shraniOsnutek(planC);
const ponovnoNalozen = N.naloziOsnutek();
assert.ok(ponovnoNalozen);
const ponovnoFilter = filter(ponovnoNalozen, ixC);
assert.equal(ponovnoFilter.mode, "single_lawyer");
assert.equal(ponovnoFilter.singleLawyerId, "custom_ana");
assert.deepEqual(ponovnoFilter.lawyerIds, ["custom_ana"]);
assert.equal(N.najdiKorak(ponovnoNalozen, ixC).lawyerHandoff.customLawyers[0].id, "custom_ana");
assert.equal(N.najdiKorak(ponovnoNalozen, ixC).lawyerHandoff.customLawyers[0].rating, undefined);

/* UI vir – ključni gradniki filtra. */
const uiSource = fs.readFileSync(path.join(__dirname, "../app/opomin-nacrt-ui.js"), "utf8");
const cssSource = fs.readFileSync(path.join(__dirname, "../app/styles.css"), "utf8");
assert.match(uiSource, /id="lp-filter-ponudb-nacin"/);
assert.match(uiSource, /id="lp-filter-ponudb-odpri"/);
assert.match(uiSource, /id="lp-filter-ponudb-ovoj"/);
assert.match(uiSource, /id="lp-filter-ponudb-uporabi"/);
assert.match(uiSource, /function pridobiFilterPonudb/);
assert.match(uiSource, /function ponudbeZaPrikaz/);
assert.match(uiSource, /function htmlFilterPonudbPopup/);
assert.match(uiSource, /function lpPotrdiFilterPonudb/);
assert.match(uiSource, /N\.posodobiFilterPonudb\(plan, step\.index/);
assert.match(uiSource, /role="radiogroup"/);
assert.match(uiSource, /data-lp-filter-odvetnik/);
assert.match(cssSource, /\.lp-filter-ponudb__orodna-vrstica/);
assert.match(cssSource, /\.lp-filter-ponudb__uporabi/);

/* Vedénjski gradniki, ki jih UI uporablja za takojšnji prikaz in lastnega
   odvetnika v načinu "Samo en odvetnik". */
assert.match(uiSource, /vsiOdvetnikiFiltra\(step, draft\.customLawyers\)/);
assert.match(uiSource, /function ustvariFokusniTrap/);
assert.match(uiSource, /isCustom/);
assert.match(uiSource, /Po dogovoru/);
assert.match(uiSource, /Vaš odvetnik/);
assert.match(uiSource, /lp-popup-ovoj--zaprt/);

/* ========== Vedénjski testi (ne regex) ========== */

/* Dodajanje odvetnika v draft: single_lawyer → nov postane edini izbran. */
const draftSingle = { mode: "single_lawyer", lawyerIds: ["joze_kovac"], singleLawyerId: "joze_kovac", customLawyers: [] };
const s1 = N.dodajOdvetnikaVDraftStanje(draftSingle, "custom_x");
assert.deepEqual(s1.lawyerIds, ["custom_x"]);
assert.equal(s1.singleLawyerId, "custom_x");
assert.deepEqual(draftSingle.lawyerIds, ["joze_kovac"], "vhoda ne smemo mutirati");

/* best_match: dodaj brez podvajanja; singleLawyerId ostane null. */
const draftBest = { mode: "best_match", lawyerIds: ["joze_kovac", "custom_x"], singleLawyerId: null };
const s2 = N.dodajOdvetnikaVDraftStanje(draftBest, "custom_x");
assert.deepEqual(s2.lawyerIds, ["joze_kovac", "custom_x"]);
assert.equal(s2.singleLawyerId, null);
const s3 = N.dodajOdvetnikaVDraftStanje(draftBest, "custom_y");
assert.deepEqual(s3.lawyerIds, ["joze_kovac", "custom_x", "custom_y"]);

/* Celoten tok: single_lawyer → dodaj odvetnika → shrani → naloži → isto stanje. */
let planD = novPlan();
let ixD = korakIndex(planD);
planD = N.posodobiFilterPonudb(planD, ixD, { mode: "single_lawyer", lawyerIds: ["joze_kovac"], singleLawyerId: "joze_kovac" });
const draftD = { mode: "single_lawyer", lawyerIds: ["joze_kovac"], singleLawyerId: "joze_kovac" };
const stanjeD = N.dodajOdvetnikaVDraftStanje(draftD, "custom_nov");
planD = N.posodobiFilterPonudb(planD, ixD, {
  mode: "single_lawyer",
  lawyerIds: stanjeD.lawyerIds,
  singleLawyerId: stanjeD.singleLawyerId,
  customLawyers: [{ id: "custom_nov", name: "Odvetnik Nov", email: "nov@primer.si" }],
  validLawyerIds: ["joze_kovac", "ana_novak", "marko_zupan", "custom_nov"],
});
assert.deepEqual(filter(planD, ixD).lawyerIds, ["custom_nov"]);
assert.equal(filter(planD, ixD).singleLawyerId, "custom_nov");
N.shraniOsnutek(planD);
const nalozenD = N.naloziOsnutek();
assert.deepEqual(filter(nalozenD, ixD).lawyerIds, ["custom_nov"]);
assert.equal(filter(nalozenD, ixD).singleLawyerId, "custom_nov");

/* ========== Fokusni trap: odpri → zapri → ponovno odpri ========== */
const UI = require("../app/opomin-nacrt-ui.js");

function fakeFocusable(name) {
  return { name: name, disabled: false, offsetParent: {}, focus: function () { global.__focused = name; } };
}
function fakePanel(children) {
  const listeners = {};
  const attrs = {};
  return {
    hasAttribute: function (a) { return Object.prototype.hasOwnProperty.call(attrs, a); },
    setAttribute: function (a, v) { attrs[a] = v; },
    addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: function (t, fn) {
      const arr = listeners[t] || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    querySelectorAll: function () { return children; },
    parentElement: null,
    _listeners: listeners,
    _keydownCount: function () { return (listeners.keydown || []).length; },
  };
}
function fakeOvoj() {
  const klasa = new Set();
  return { hidden: false, classList: { contains: function (c) { return klasa.has(c); } }, _klasa: klasa };
}
function fakeMO() {
  const instances = [];
  function F(cb) { this.cb = cb; this.disconnected = false; instances.push(this); }
  F.prototype.observe = function () {};
  F.prototype.disconnect = function () { this.disconnected = true; };
  F.instances = instances;
  return F;
}

const children = [fakeFocusable("a"), fakeFocusable("b"), fakeFocusable("c")];
const panel = fakePanel(children);
const ovoj = fakeOvoj();
panel.parentElement = ovoj;
const MO = fakeMO();
const doc = { activeElement: null };

const trap = UI.ustvariFokusniTrap(panel, { document: doc, MutationObserver: MO });

function pritisniTab(shiftKey) {
  const kd = panel._listeners.keydown || [];
  assert.ok(kd.length >= 1, "keydown listener mora obstajati");
  let prepreceno = false;
  kd[kd.length - 1]({ key: "Tab", shiftKey: shiftKey, preventDefault: function () { prepreceno = true; } });
  return prepreceno;
}

/* 1. odprtje */
trap.priklopi();
assert.equal(panel._keydownCount(), 1);
doc.activeElement = children[2];
pritisniTab(false);
assert.equal(global.__focused, "a");
doc.activeElement = children[0];
pritisniTab(true);
assert.equal(global.__focused, "c");

/* Panel je ob odprtju fokusiran z tabindex=-1. Tudi od tam Tab/Shift+Tab ne
   smeta pobegniti v ozadje strani. */
doc.activeElement = panel;
pritisniTab(false);
assert.equal(global.__focused, "a");
doc.activeElement = panel;
pritisniTab(true);
assert.equal(global.__focused, "c");

/* zaprtje prek MutationObserver (ovoj.hidden = true) */
ovoj.hidden = true;
MO.instances[MO.instances.length - 1].cb();
assert.equal(panel._keydownCount(), 0, "ob zaprtju se listener odstrani");

/* 2. ponovno odprtje – listener je spet natanko eden in Tab kroži */
ovoj.hidden = false;
trap.priklopi();
assert.equal(panel._keydownCount(), 1, "ob ponovnem odprtju natanko en listener");
doc.activeElement = children[2];
pritisniTab(false);
assert.equal(global.__focused, "a");

/* 3. tretje odprtje brez zaprtja – brez podvojenih listenerjev */
trap.priklopi();
assert.equal(panel._keydownCount(), 1, "brez podvojenih listenerjev");
doc.activeElement = children[0];
pritisniTab(true);
assert.equal(global.__focused, "c");

/* Tovarniški helper ostane varen tudi brez ovoja (uporabno pri samostojnem
   testu ali če se struktura panela pozneje spremeni). */
const panelBrezOvoja = fakePanel(children);
const trapBrezOvoja = UI.ustvariFokusniTrap(panelBrezOvoja, { document: doc, MutationObserver: MO });
assert.doesNotThrow(function () { trapBrezOvoja.priklopi(); });
trapBrezOvoja.pospravi();

/* V obrazcu za novega odvetnika je viden samo njegov CTA; globalni gumb
   "Uporabi filter" se skrije in se ob vrnitvi v glavni pogled spet pokaže. */
assert.match(uiSource, /function lpPokaziDodajOdvetnika\([\s\S]*?noga\.hidden = true;/);
assert.match(uiSource, /function lpNazajIzDodajOdvetnika\([\s\S]*?noga\.hidden = false;/);

console.log("Filter odvetniških ponudb — vsi testi uspešni");
