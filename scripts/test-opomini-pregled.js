"use strict";

/**
 * Testi: slovenska sklanjatev za modul "Potek opominov" (zgornji widget na
 * koraku "Predaja odvetniku"). N.slovenskaOblika/stevecPoslanih/stevecNacrtovanih
 * so čiste funkcije brez brskalniških odvisnosti - glej app/opomin-nacrt.js.
 */

var assert = require("assert/strict");
var fs = require("fs");
var path = require("path");
var N = require("../app/opomin-nacrt.js");

var passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (err) {
    console.error("  ✗ " + name);
    throw err;
  }
}

console.log("\nPotek opominov – slovenska sklanjatev");

test("zaklenjena testna vrstica je prisotna v vseh glavnih pogledih opozarjanja neplačila", function () {
  var koren = path.resolve(__dirname, "..");
  var strani = ["neplacila.html", "neplacila-posiljanje.html", "neplacila-sporocilo.html", "aktivni-primeri.html", "izvedba.html"];
  strani.forEach(function (ime) {
    var html = fs.readFileSync(path.join(koren, "app", ime), "utf8");
    assert.match(html, /testna-vrstica\.css\?v=[^"']+/,
      "stran mora naložiti trenutno različico zaklenjene testne vrstice");
    assert.match(html, /app-testna-vrstica-prisotna/);
    assert.match(html, /id="app-testna-vrstica"[^>]+data-locked="true"/);
    assert.match(html, /class="app-testna-vrstica-prostor"/);
  });
  var css = fs.readFileSync(path.join(koren, "app", "testna-vrstica.css"), "utf8");
  assert.match(css, /position: fixed !important/);
  assert.match(css, /html\.app-iphone-preview\s*\{[\s\S]*--app-testna-safe-bottom: 34px/);
  assert.match(css, /height: calc\(48px \+ var\(--app-testna-safe-bottom, 0px\)\)/);
  assert.match(css, /\.izvedba-sticky[\s\S]*bottom: calc\(48px \+ var\(--app-testna-safe-bottom, 0px\)\)/);
  assert.match(css, /html\.uj-modal-odprt \.app-testna-vrstica[\s\S]*visibility: hidden !important;[\s\S]*pointer-events: none !important;/);
  assert.match(css, /html\.uj-modal-odprt \.boniteta-app-testna-vrstica/);
  var skupniCss = fs.readFileSync(path.join(koren, "app", "styles.css"), "utf8");
  assert.match(skupniCss, /html\.app-iphone-preview body\.wizard-status-header::before,[\s\S]*html\.app-standalone body\.wizard-status-header::before,[\s\S]*height: 47px !important;/,
    "PC predogled in nameščeni iPhone morata uporabljati isti 47px sistemski pas");
  assert.match(skupniCss, /html\.app-iphone-preview \.debt-stepper\s*\{\s*--wizard-safe-top: 0px;/,
    "PC predogled mora za belim pasom prikazati kompaktno glavo");
  assert.match(skupniCss, /html\.app-standalone \.debt-stepper\s*\{\s*--wizard-safe-top: 0px;/,
    "Nameščena iPhone aplikacija mora uporabljati enako kompaktno glavo kot PC");

  var dolznik = fs.readFileSync(path.join(koren, "app", "neplacila.html"), "utf8");
  assert.doesNotMatch(dolznik, /document\.body\.className\s*=/, "Dolžnik ne sme prepisati razreda stalne vrstice");
  assert.match(dolznik, /classList\.add\("stran--sporocilo",\s*"stran--samo-obrazec"\)/);

  var zasciteneStrani = fs.readdirSync(path.join(koren, "app")).filter(function (ime) {
    if (!/\.html$/.test(ime)) return false;
    return /auth-zascita\.js/.test(fs.readFileSync(path.join(koren, "app", ime), "utf8"));
  });
  zasciteneStrani.forEach(function (ime) {
    var html = fs.readFileSync(path.join(koren, "app", ime), "utf8");
    assert.match(html, /testna-vrstica\.css\?v=[^"']+/, ime + " mora uporabljati skupni slog navigacije");
    assert.match(html, /testna-vrstica\.js\?v=20260819-inner-back-v4/, ime + " mora uporabljati korak-po-koraku funkcijo Nazaj/Domov");
  });

  var navigacija = fs.readFileSync(path.join(koren, "app", "testna-vrstica.js"), "utf8");
  assert.match(navigacija, /data-app-nazaj/);
  assert.match(navigacija, /ciljPrejsnjegaKoraka\(\)/);
  assert.match(navigacija, /trenutniKorak - 1/);
  assert.match(navigacija, /\.wizard-topbar__nazaj\[href\]/);
  assert.match(navigacija, /data-wizard-zacetni-zaslon/);
  assert.match(navigacija, /location\.replace\(prejsnjiKorak\)/);
  assert.match(navigacija, /history\.back\(\)/);
  assert.match(navigacija, /UJPoskusiNotranjiKorakNazaj/);
  assert.match(navigacija, /location\.assign\(DOMOV\)/);
  assert.match(navigacija, /data-app-domov[^>]+href=\\?"index\.html/);

  var dolznikHtml = fs.readFileSync(path.join(koren, "app", "neplacila.html"), "utf8");
  var sporociloHtml = fs.readFileSync(path.join(koren, "app", "neplacila-sporocilo.html"), "utf8");
  var posiljanjeHtml = fs.readFileSync(path.join(koren, "app", "neplacila-posiljanje.html"), "utf8");
  [dolznikHtml, sporociloHtml, posiljanjeHtml].forEach(function (html) {
    assert.match(html, /testna-vrstica\.js\?v=20260819-inner-back-v4/, "Koraki morajo uporabljati deterministično navigacijo Nazaj");
    assert.match(html, /data-wizard-zacetni-zaslon="zascita-posla\.html"/, "Prvi korak mora imeti določen izhod iz postopka");
  });
  [dolznikHtml, sporociloHtml, posiljanjeHtml].forEach(function (html) {
    assert.doesNotMatch(html, /class="wizard-topbar__izbrisi"/, "Izbris osnutka ne sme več ostati v zgornji vrstici");
  });
  assert.match(dolznikHtml, /class="osnutek-akcije"[\s\S]*id="gumb-izbrisi-osnutek"[\s\S]*id="gumb-naprej-korak1"/);
  assert.match(sporociloHtml, /class="osnutek-akcije"[\s\S]*id="gumb-izbrisi-osnutek"[\s\S]*id="gumb-naprej-posiljanje"/);

  var nacrtUi = fs.readFileSync(path.join(koren, "app", "opomin-nacrt-ui.js"), "utf8");
  assert.match(nacrtUi, /class=\"osnutek-akcije\"[\s\S]*id=\"gumb-izbrisi-osnutek\"[\s\S]*id=\"opomin-nacrt-cta\"/);
  var appJs = fs.readFileSync(path.join(koren, "app", "app.js"), "utf8");
  assert.match(appJs, /closest\("#gumb-izbrisi-osnutek"\)/, "Dinamični gumb mora uporabljati skupno potrjeno brisanje");
  var glavniCss = fs.readFileSync(path.join(koren, "app", "styles.css"), "utf8");
  assert.match(
    glavniCss,
    /#obrazec-neplacilo > \.osnutek-akcije \.obrazec__gumb-naprej\s*\{[\s\S]*?margin-top:\s*0;/,
    "Gumba Izbriši in Naprej morata biti zgoraj poravnana"
  );
});

test("slovenskaOblika: osnovna pravila (1/2/3-4/5+)", function () {
  var oblike = ["ena", "dve", "tri-štiri", "pet+"];
  assert.equal(N.slovenskaOblika(1, oblike), "ena");
  assert.equal(N.slovenskaOblika(2, oblike), "dve");
  assert.equal(N.slovenskaOblika(3, oblike), "tri-štiri");
  assert.equal(N.slovenskaOblika(4, oblike), "tri-štiri");
  assert.equal(N.slovenskaOblika(5, oblike), "pet+");
});

test("slovenskaOblika: 11 in 12 padeta v 'pet_in_vec', ne v ednino/dvojino", function () {
  var oblike = ["ena", "dve", "tri-štiri", "pet+"];
  assert.equal(N.slovenskaOblika(11, oblike), "pet+");
  assert.equal(N.slovenskaOblika(12, oblike), "pet+");
});

var pricakovanoPoslanih = {
  0: "0 poslanih",
  1: "1 poslan",
  2: "2 poslana",
  3: "3 poslani",
  4: "4 poslani",
  5: "5 poslanih",
  11: "11 poslanih",
  12: "12 poslanih",
};
Object.keys(pricakovanoPoslanih).forEach(function (n) {
  test("stevecPoslanih(" + n + ") = '" + pricakovanoPoslanih[n] + "'", function () {
    assert.equal(N.stevecPoslanih(Number(n)), pricakovanoPoslanih[n]);
  });
});

var pricakovanoNacrtovanih = {
  0: "0 načrtovanih",
  1: "1 načrtovan",
  2: "2 načrtovana",
  3: "3 načrtovani",
  4: "4 načrtovani",
  5: "5 načrtovanih",
  11: "11 načrtovanih",
  12: "12 načrtovanih",
};
Object.keys(pricakovanoNacrtovanih).forEach(function (n) {
  test("stevecNacrtovanih(" + n + ") = '" + pricakovanoNacrtovanih[n] + "'", function () {
    assert.equal(N.stevecNacrtovanih(Number(n)), pricakovanoNacrtovanih[n]);
  });
});

test("kombinirani primeri iz specifikacije (odsek 7)", function () {
  assert.equal(N.stevecPoslanih(0) + " · " + N.stevecNacrtovanih(9), "0 poslanih · 9 načrtovanih");
  assert.equal(N.stevecPoslanih(1) + " · " + N.stevecNacrtovanih(8), "1 poslan · 8 načrtovanih");
  assert.equal(N.stevecPoslanih(2) + " · " + N.stevecNacrtovanih(7), "2 poslana · 7 načrtovanih");
  assert.equal(N.stevecPoslanih(3) + " · " + N.stevecNacrtovanih(6), "3 poslani · 6 načrtovanih");
  assert.equal(N.stevecPoslanih(5) + " · " + N.stevecNacrtovanih(4), "5 poslanih · 4 načrtovani");
});

console.log("\n  Uspešnih: " + passed + "/" + (2 + Object.keys(pricakovanoPoslanih).length + Object.keys(pricakovanoNacrtovanih).length + 2));
console.log("Potek opominov: slovnica preverjena — vsi testi uspešni\n");
