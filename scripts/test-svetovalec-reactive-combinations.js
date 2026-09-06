"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var engine = require("../app/atena-card-combinations-engine");
var register = require("../app/atena-card-combinations");
var adapter = require("../app/atena-card-combinations-adapter");
var renderer = require("../app/atena-card-renderer");
var schema = require("../app/atena-card-schema");

var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "app/svetovalec-preverba.html"), "utf8");
var ui = fs.readFileSync(path.join(root, "app/svetovalec-preverba.js"), "utf8");
var schemaSource = fs.readFileSync(path.join(root, "app/atena-card-schema.js"), "utf8");

var engineScript = html.indexOf("atena-card-combinations-engine.js");
var registerScript = html.indexOf("atena-card-combinations.js");
var rendererScript = html.indexOf("atena-card-renderer.js");
var adapterScript = html.indexOf("atena-card-combinations-adapter.js");
var controllerScript = html.indexOf("svetovalec-preverba.js");
assert.ok(engineScript >= 0 && engineScript < registerScript && rendererScript < adapterScript && adapterScript < controllerScript, "reaktivni UMD odvisnosti morajo biti nalozene pred kontrolerjem");

assert.match(schemaSource, /module\.kombinacijaId/);
assert.match(schemaSource, /storage:kombinacijaId \? "reactive-draft" : "existing-draft"/);
assert.match(schemaSource, /storage:"reactive-draft", moduleId:module\.id, combinationId:kombinacijaId/);
var produkcijskeKartice = schema.catalog.filter(function (card) { return Boolean(card.kombinacijaId); });
assert.deepEqual(produkcijskeKartice.map(function (card) { return card.id; }), ["ponudba:4009"], "reaktivnost mora biti opt-in samo na prvi odobreni kartici");
assert.equal(produkcijskeKartice[0].kombinacijaId, "pogodbe-stej-ponovi-sestej");

assert.match(ui, /window\.UJAtenaCardCombinationsEngine/);
assert.match(ui, /window\.UJAtenaCardCombinations/);
assert.match(ui, /window\.UJAtenaCardCombinationsAdapter/);
assert.match(ui, /reaktivniSklopi:\{\}/);
assert.match(ui, /Array\.isArray\(obnovljeno\.reaktivniSklopi\)/);
assert.match(ui, /kartica\.kombinacijaId/);
assert.match(ui, /data-ponudba-reaktivna-napaka/);
assert.match(ui, /data-reaktivni-stevec-korak/);
assert.match(ui, /obdelajPonudbaReaktivnoSpremembo\(dogodek\.target\)/);
assert.match(ui, /posodobiStaticneOdgovore/);
assert.doesNotMatch(ui, /answers\s*\[[^\]]*(?:storageKey|atenaStorageKey)/, "namespaced kljuci ne smejo biti zapisani v answers");

var definicija = register.preberi("pogodbe-stej-ponovi-sestej");
assert.ok(definicija);
assert.equal(Object.prototype.hasOwnProperty.call(definicija, "moduleId"), false);
assert.equal(Object.prototype.hasOwnProperty.call(definicija, "serviceId"), false);

var kartica = { id:"test:4009", flow:"test", moduleId:4009, kombinacijaId:definicija.id, ui:{ secondaryFieldIds:[] } };
var ponovljenoPolje = { id:5101, label:"Cena pogodbe", type:"money", required:true, help:"", interfaceId:"atena:field:test:4009:5101", ui:{ interaction:"money", fullWidth:true } };
var staticnoPolje = { id:5102, label:"DDV", type:"select", required:true, help:"", interfaceId:"atena:field:test:4009:5102", options:[{ id:"vkljucen", label:"Vključen" }], ui:{ interaction:"dropdown", fullWidth:true } };
var polja = [ponovljenoPolje, staticnoPolje];
var razdeljeno = adapter.razdeliPolja(definicija, polja);
assert.deepEqual(razdeljeno.ponovljena.map(function (polje) { return polje.id; }), [5101]);
assert.deepEqual(razdeljeno.staticna.map(function (polje) { return polje.id; }), [5102]);
var staticniHtml = renderer.moduleContentHtml(kartica, razdeljeno.staticna, { 5102:"vkljucen" });
assert.match(staticniHtml, /data-ponudba-field="5102" value="vkljucen"/, "navadno polje mešane kartice mora ostati izrisano po statični poti");
var shranjeniStaticni = adapter.posodobiStaticneOdgovore(definicija, polja, { 5101:"ne-sme-v-answers", 5102:"vkljucen" }, { 5101:"stara-flat-vrednost", 9999:"ohrani" });
assert.deepEqual(shranjeniStaticni, { 5102:"vkljucen", 9999:"ohrani" }, "navadno polje se shrani, ponovljeno pa ne v answers");

var migracija = adapter.pripraviZacetnoStanje(definicija, null, { 5101:"125,50", 5102:"vkljucen" }, "ponudba:4009:" + definicija.id);
assert.equal(migracija.ok, true);
assert.equal(migracija.stanje.stevilo, 1);
assert.equal(migracija.stanje.instance[1].cena, "125,50", "stara flat cena se mora ohraniti v prvi reaktivni instanci");
assert.deepEqual(migracija.odgovori, { 5102:"vkljucen" });
assert.deepEqual(migracija.preseljeniFieldIds, [5101]);
var brezPonovneMigracije = adapter.pripraviZacetnoStanje(definicija, migracija.stanje, { 5101:"ne-prepisi" }, "ponudba:4009:" + definicija.id);
assert.equal(brezPonovneMigracije.stanje.instance[1].cena, "125,50", "obstoječe reaktivno stanje mora imeti prednost pred starim flat ključem");
assert.deepEqual(brezPonovneMigracije.preseljeniFieldIds, []);

var scopeId = adapter.sestaviScopeId(kartica, definicija.id);
assert.equal(scopeId, "test:4009:pogodbe-stej-ponovi-sestej");

function ciljStevca(vrednost, scope) {
  var stevec = { value:String(vrednost), dataset:{ reaktivniScopeId:scope, reaktivniDefinicijaId:definicija.id } };
  return { closest:function (selector) { return selector === "[data-reaktivni-stevec]" ? stevec : null; } };
}

function ciljCanonical(scope, kljucInstance, storageKey, vrednost) {
  var korenPolja = {
    dataset:{ reaktivniScopeId:scope, reaktivniDefinicijaId:definicija.id, atenaInstanceKey:String(kljucInstance), atenaStorageKey:storageKey },
    querySelector:function (selector) { return selector === "[data-ponudba-field]" ? { value:vrednost } : null; }
  };
  return { closest:function (selector) { return selector === "[data-atena-field-root][data-atena-storage-key][data-atena-instance-key]" ? korenPolja : null; } };
}

var stanje = engine.ustvari(definicija).stanje;
var prehodStevca = adapter.izvediSpremembo(definicija, scopeId, stanje, ciljStevca(2, scopeId));
assert.equal(prehodStevca.ok, true);
assert.equal(prehodStevca.pogled.instance.length, 2, "izvršljiv seam mora po spremembi števca ustvariti dve ponovitvi");
stanje = prehodStevca.stanje;
var ponovitve = adapter.ponovitveHtml(definicija, scopeId, prehodStevca.pogled, polja);
assert.equal(ponovitve.ok, true);
assert.equal((ponovitve.html.match(/data-reaktivni-instanca=/g) || []).length, 2);
var storageKljuci = Array.from(new Set(Array.from(ponovitve.html.matchAll(/data-atena-storage-key="([^"]+)"/g)).map(function (ujemanje) { return ujemanje[1]; })));
assert.deepEqual(storageKljuci, [scopeId + ".1.cena", scopeId + ".2.cena"], "DOM ponovitvi morata vsebovati runtime scoped canonical ključa");

var prvaSprememba = adapter.izvediSpremembo(definicija, scopeId, stanje, ciljCanonical(scopeId, 1, storageKljuci[0], "10,10"));
assert.equal(prvaSprememba.stanje.instance[1].cena, "10,10");
assert.match(adapter.povzetkiHtml(definicija, prvaSprememba.pogled), /10,10 EUR[\s\S]*Manjka vnos pri mestu 2/);
var drugaSprememba = adapter.izvediSpremembo(definicija, scopeId, prvaSprememba.stanje, ciljCanonical(scopeId, 2, storageKljuci[1], "20,20"));
assert.equal(drugaSprememba.pogled.agregati[0].valueMinor, 3030);
assert.match(adapter.povzetkiHtml(definicija, drugaSprememba.pogled), /30,30 EUR/);

var overflowStanje = engine.spremeni(definicija, engine.ustvari(definicija).stanje, { vrsta:"nastavi-stevilo", value:2 }, scopeId).stanje;
overflowStanje = engine.spremeni(definicija, overflowStanje, { vrsta:"nastavi-vrednost", instance:1, fieldKey:"cena", value:"45035996273704.96" }, scopeId).stanje;
var overflowPogled = engine.spremeni(definicija, overflowStanje, { vrsta:"nastavi-vrednost", instance:2, fieldKey:"cena", value:"45035996273704.96" }, scopeId).pogled;
assert.match(adapter.povzetkiHtml(definicija, overflowPogled), /Vsota presega varno mejo izračuna/);

var drugaKartica = { id:"test:4010", flow:"test", moduleId:4010, kombinacijaId:definicija.id };
var drugiScopeId = adapter.sestaviScopeId(drugaKartica, definicija.id);
var drugaUporaba = adapter.izvediSpremembo(definicija, drugiScopeId, engine.ustvari(definicija).stanje, ciljStevca(1, drugiScopeId));
drugaUporaba = adapter.izvediSpremembo(definicija, drugiScopeId, drugaUporaba.stanje, ciljCanonical(drugiScopeId, 1, drugiScopeId + ".1.cena", "99,00"));
assert.notEqual(scopeId, drugiScopeId);
assert.equal(drugaSprememba.stanje.instance[1].cena, "10,10");
assert.equal(drugaUporaba.stanje.instance[1].cena, "99,00", "dve uporabi iste definicije morata imeti ločeno stanje");

var stariOsnutek = { answers:{ 5102:"stara staticna vrednost" }, completedModuleIds:[4001] };
var osnutek = Object.assign({ answers:{}, reaktivniSklopi:{} }, JSON.parse(JSON.stringify(stariOsnutek)));
if (!osnutek.answers || typeof osnutek.answers !== "object" || Array.isArray(osnutek.answers)) osnutek.answers = {};
if (!osnutek.reaktivniSklopi || typeof osnutek.reaktivniSklopi !== "object" || Array.isArray(osnutek.reaktivniSklopi)) osnutek.reaktivniSklopi = {};
osnutek.reaktivniSklopi[scopeId] = drugaSprememba.stanje;
osnutek.reaktivniSklopi[drugiScopeId] = drugaUporaba.stanje;

var roundtrip = JSON.parse(JSON.stringify(osnutek));
assert.deepEqual(roundtrip.answers, stariOsnutek.answers, "reaktivni tok ne sme spremeniti starega answers stanja");
assert.equal(roundtrip.reaktivniSklopi[scopeId].instance[1].cena, "10,10");
assert.equal(engine.preberiPogled(definicija, roundtrip.reaktivniSklopi[scopeId], scopeId).agregati[0].valueMinor, 3030);
assert.equal(Object.prototype.hasOwnProperty.call(roundtrip.reaktivniSklopi[scopeId], "agregati"), false, "izpeljani agregati se ne smejo shraniti");

console.log("Svetovalec reactive combinations: OK (production P01 binding, migration, executable adapter, mixed static fields, runtime scopes)");
