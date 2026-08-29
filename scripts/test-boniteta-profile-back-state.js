"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

var check = source("app/bonitetna-preverba.js");
var profile = source("app/boniteta-profil.js");
var center = source("app/boniteta-sredisce.js");
var html = source("app/bonitetna-preverba.html");

assert.ok(
  !check.includes("osveziOpenRegisterPreklop();"),
  "reset ne sme odpovedati na odstranjenem starem preklopu OpenRegister"
);

assert.ok(
  check.includes("function ponastaviNovoPreverbo()") &&
    check.includes("izbranoOpenRegisterPodjetje = null") &&
    check.includes('nastaviHeroPodjetje("")') &&
    check.includes('heroSpletnaPolje.value = ""'),
  "vrnitev iz profila mora počistiti izbrano podjetje in oba vidna vhoda"
);
assert.ok(
  ["profile", "id", "section", "northdataRun", "ime", "job"].every(function (parameter) {
    return check.includes('"' + parameter + '"');
  }) && check.includes('novaPot.hash = "new"'),
  "nov tok ne sme obdržati profilnih, ponovitvenih ali opravilnih URL-parametrov"
);
assert.ok(
  check.includes("window.UJBonitetaZapriProfil") &&
    profile.includes("mojaGeneracija!==initGeneration") &&
    profile.includes("window.UJBonitetaZapriProfil=zapriProfil"),
  "zakasnjen odgovor starega profila po vrnitvi ne sme ponovno prikazati podjetja"
);
assert.ok(
  center.includes("if(!event.isTrusted)return") &&
    center.includes("window.UJBonitetaPonastaviNovoPreverbo") &&
    profile.includes("if(window.UJBonitetaPonastaviNovoPreverbo)"),
  "uporabniški preklop in križec profila morata uporabljati isto kanonično čiščenje"
);

assert.ok(
  center.includes('singleResultReturnView=link.closest("#boniteta-center-active")?"active":link.closest("#boniteta-center-workspace")?"profiles":"new"') &&
    center.includes('function closeSingleResult()') &&
    center.includes('showCenter(returnView)'),
  "Zapri mora shranjeni rezultat vrniti v seznam, iz katerega je bil odprt"
);
assert.ok(
  /bonitetna-preverba\.js\?v=[^"']+-v\d+/.test(html) &&
    /boniteta-profil\.js\?v=[^"']+-v\d+/.test(html) &&
    /boniteta-sredisce\.js\?v=[^"']+-v\d+/.test(html),
  "vsi spremenjeni skripti morajo dobiti svežo različico predpomnilnika"
);

console.log("Boniteta — vrnitev iz profila brez starega podjetja: OK");
