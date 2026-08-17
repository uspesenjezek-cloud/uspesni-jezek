"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
global.sessionStorage = { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); }, removeItem(k) { delete this._data[k]; } };
require("../app/opomin-nacrt.js");
const N = global.UJOpominNacrt;
let plan = N.narediNovPlan({ imeDolznika: "Test", znesek: 100, datumZapadlosti: "2026-08-01" }, { izbranTonId: "friendly" });
const korak = plan.steps.find((s) => s.kind === "manual_lawyer");
const snapshot = {
  packageId: "custom_lawyer_services",
  priceCents: 9970,
  priceLabel: "99,70 €",
  titleSnapshot: "Paket odvetniških storitev",
  services: [
    { serviceId: "lawyer_demand_letter", priceCents: 2990 },
    { serviceId: "lawyer_phone_call", priceCents: 4990 },
    { serviceId: "case_review", priceCents: 1990 },
  ],
};
plan = N.posodobiIzbraniPaket(plan, korak.index, snapshot);
const shranjeno = N.najdiKorak(plan, korak.index).lawyerHandoff.selectedPackage;
assert.equal(shranjeno.packageId, "custom_lawyer_services");
assert.equal(shranjeno.services.length, 3);
assert.equal(shranjeno.priceCents, 9970);
plan = N.posodobiOdvetnika(plan, korak.index, {
  name: "Odvetnik Jože Kovač",
  officeName: "Odvetniška pisarna Kovač",
  email: "joze.kovac@primer.si",
  phone: "+386 1 555 01 10",
}, "joze_kovac");
const izbranOdvetnik = N.najdiKorak(plan, korak.index).lawyerHandoff;
assert.equal(izbranOdvetnik.lawyerId, "joze_kovac");
plan = N.posodobiPrikazaneOdvetnike(plan, korak.index, ["ana_novak", "marko_zupan"]);
assert.deepEqual(N.najdiKorak(plan, korak.index).lawyerHandoff.visibleLawyerIds, ["ana_novak", "marko_zupan"]);
assert.equal(izbranOdvetnik.lawyerSnapshot.name, "Odvetnik Jože Kovač");
const uiSource = fs.readFileSync(path.join(__dirname, "../app/opomin-nacrt-ui.js"), "utf8");
const cssSource = fs.readFileSync(path.join(__dirname, "../app/styles.css"), "utf8");
assert.match(uiSource, /id: "payment_agreement"/);
assert.match(uiSource, /id: "asset_check"/);
assert.match(uiSource, /id="lp-custom-paket-drsnik"/);
assert.doesNotMatch(uiSource, /data-custom-stran/);
assert.match(cssSource, /scroll-snap-type: y proximity/);
assert.match(cssSource, /touch-action: pan-y/);
assert.match(cssSource, /height: min\(96dvh, 900px\)/);
assert.match(uiSource, /id="lp-custom-paket-predogled-panel"/);
assert.match(uiSource, /id="lp-custom-predogled-nazaj"/);
assert.match(uiSource, /id="lp-custom-paket-izberi"/);
assert.match(uiSource, /function lpPokaziCustomPredogled/);
assert.match(uiSource, /customPotrdi[\s\S]*lpPokaziCustomPredogled\(\)/);
assert.match(uiSource, /data-custom-predogled-storitev/);
assert.match(uiSource, /Preglej in izberi/);
assert.match(uiSource, /Izberi storitev/);
assert.match(uiSource, /lp-custom-kartica__stevilo-storitev/);
assert.match(uiSource, /lp-custom-kartica__skupna-cena/);
assert.match(uiSource, /formatirajCente\(p\.totalCents\)/);
assert.match(cssSource, /\.lp-custom-kartica__povzetek \{[\s\S]*?display: flex;[\s\S]*?justify-content: space-between;/);
assert.match(cssSource, /\.lp-custom-kartica__skupna-cena \{[\s\S]*?flex: 0 0 auto;[\s\S]*?white-space: nowrap;[\s\S]*?text-align: right;/);
assert.doesNotMatch(uiSource, /data-custom-storitev=/);
assert.match(cssSource, /\.lp-sestavljalnik\[hidden\] \{ display: none !important; \}/);
assert.match(cssSource, /\.lp-storitev__znacka \{ position: static;/);
assert.match(cssSource, /\.lp-opomini-pregled__vsi::before/);
assert.match(cssSource, /\.lp-opomini-pregled__vsi \{[\s\S]*?background: transparent;/);
assert.match(uiSource, /var LAWYER_PROFILES = \[/);
assert.match(uiSource, /PACKAGE_BEST_LAWYER/);
assert.match(uiSource, /id="lp-izberi-odvetnika"/);
assert.match(uiSource, /id="lp-odvetniki-ovoj"/);
assert.match(uiSource, /data-odvetnik-profil/);
assert.match(uiSource, /data-odvetnik-vidnost/);
assert.match(uiSource, /role="switch"/);
assert.match(uiSource, /Prikaži v seznamu/);
assert.match(uiSource, />Poglej\/izberi<\/button>/);
const dejanjaZacetek = uiSource.indexOf('<div class="lp-odvetnik-izbira__dejanja">');
const dejanjaKonec = uiSource.indexOf("</div></article>", dejanjaZacetek);
const dejanjaHtml = uiSource.slice(dejanjaZacetek, dejanjaKonec);
assert.ok(dejanjaHtml.indexOf("lp-odvetnik-izbira__switch") < dejanjaHtml.indexOf("lp-odvetnik-izbira__poglej"));
assert.match(uiSource, /Storitve za podjetnike/);
assert.match(uiSource, /N\.posodobiOdvetnika\(plan, step\.index/);
assert.match(cssSource, /\.lp-paket-kartica__odvetnik \{/);
assert.match(cssSource, /\.lp-odvetnik-profil\[hidden\]/);
assert.match(cssSource, /\.lp-odvetnik-izbira__switch\[aria-checked="true"\]/);
assert.match(cssSource, /\.lp-odvetnik-izbira__kartica--skrita/);
assert.match(uiSource, /korakiEl\.innerHTML =[\s\S]*?htmlKorakOdvetnik\(pkg, step\)/);
assert.doesNotMatch(uiSource, /korakiEl\.innerHTML =[\s\S]*?"Pregled paketa"/);
assert.match(uiSource, /lpOdvetnikKoraki\.addEventListener\("click"/);
assert.match(cssSource, /\.lp-paket-kartica--priporocena \{[\s\S]*?border-width: 1px;[\s\S]*?box-shadow: 0 1px 4px/);
assert.match(uiSource, /lp-paket-kartica__znacka--priporoceno"><span aria-hidden="true">★<\/span><span>Priporočeno<\/span>/);
assert.match(cssSource, /\.lp-paket-kartica__znacka--priporoceno \{[\s\S]*?top: -10px;[\s\S]*?left: auto;[\s\S]*?right: 14px;[\s\S]*?display: inline-flex;[\s\S]*?gap: 4px;[\s\S]*?padding: 4px 8px;[\s\S]*?border-radius: 8px;[\s\S]*?background: var\(--gold-button-surface, #fcebb9\);[\s\S]*?color: #8a6412;[\s\S]*?font-size: 9px;[\s\S]*?line-height: 1;/);
assert.match(cssSource, /\.lp-paket-kartica--izbrana \{[\s\S]*?border-width: 2px;/);
assert.match(uiSource, /htmlKorak\(2,[\s\S]*?nazivIzbranegaPaketa\(pkg\), "", false, "data-lp-korak-paket"\)/);
assert.doesNotMatch(uiSource, /htmlKorak\(2,[^\n]*"Izbrani paket"/);
assert.doesNotMatch(uiSource, /lp-paket-izbran-vrstica/);
assert.doesNotMatch(uiSource, /Izbran paket: /);
assert.match(uiSource, /function razlogPriporocenegaPaketa\(plan\)/);
assert.match(uiSource, /Zakaj priporočamo:<\/strong>/);
assert.match(uiSource, /htmlFilterPonudbVrstica\(plan, step\)/);
assert.match(uiSource, /"Začetek postopka"[\s\S]*?"data-lp-korak-postopek"/);
assert.doesNotMatch(uiSource, /lp-korak__spremeni/);
assert.doesNotMatch(uiSource, /Sledi po vaši potrditvi/);
assert.doesNotMatch(uiSource, /izberete v sestavljalniku/);
assert.match(uiSource, /lp-korak__besedilo/);
assert.match(cssSource, /\.lp-korak__besedilo \{[\s\S]*?min-height: 27px;[\s\S]*?max-height: 27px;[\s\S]*?overflow: hidden;/);
assert.match(cssSource, /\.lp-korak__opis \{[\s\S]*?font-weight: 600;[\s\S]*?color: var\(--text-primary, #183a3a\);/);
assert.match(uiSource, /lpOdpriPredogledniPopup\(aktivniPkg\)/);
assert.match(uiSource, /function htmlIkonaVecInformacij\(\)/);
assert.match(uiSource, /activeFlowStep/);
assert.match(uiSource, /function lpPonastaviAktivniKorak\(\)/);
assert.match(uiSource, /Promise\.resolve\(opts\.potrdiVprasanje[\s\S]*?\.then\(lpPonastaviAktivniKorak, lpPonastaviAktivniKorak\)/);
assert.match(uiSource, /function lpZapriPopupe\(\)[\s\S]*?lpPonastaviAktivniKorak\(\)/);
assert.match(cssSource, /\.lp-korak__vec-info \{/);
assert.match(cssSource, /\.lp-korak--aktiven \.lp-korak__ikona \{[\s\S]*?border: 2px solid #087f83;/);
assert.match(cssSource, /\.lp-koraki \{[\s\S]*?margin-top: 10px;[\s\S]*?padding: 9px 4px 0;/);
assert.match(cssSource, /\.lp-koraki__vrstica \{[\s\S]*?min-height: 104px;/);
assert.match(cssSource, /\.lp-korak__ikona \{[\s\S]*?width: 54px;[\s\S]*?height: 54px;/);
assert.match(cssSource, /\.lp-korak__ikona svg \{[\s\S]*?width: 46px;[\s\S]*?height: 46px;/);
assert.match(cssSource, /\.lp-koraki__puscica \{[\s\S]*?color: #087f83;[\s\S]*?margin: 20px 2px 0;/);
console.log("Peta swipeable kartica: sestavljeni paket se varno shrani — uspešno");
