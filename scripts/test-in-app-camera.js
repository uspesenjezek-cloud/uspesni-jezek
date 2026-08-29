"use strict";

var assert = require("assert/strict");
var fs = require("fs");
var path = require("path");

var koren = path.resolve(__dirname, "..");
var kamera = fs.readFileSync(path.join(koren, "app", "in-app-camera.js"), "utf8");
var slog = fs.readFileSync(path.join(koren, "app", "in-app-camera.css"), "utf8");
var zascita = fs.readFileSync(path.join(koren, "app", "auth-zascita.js"), "utf8");
var lokalniStreznik = fs.readFileSync(path.join(koren, "scripts", "local-server.js"), "utf8");
var vercel = fs.readFileSync(path.join(koren, "vercel.json"), "utf8");
var appMapa = path.join(koren, "app");
var zasciteneStrani = fs.readdirSync(appMapa).filter(function (ime) {
  return /\.html$/.test(ime) && /auth-zascita\.js/.test(fs.readFileSync(path.join(appMapa, ime), "utf8"));
});

assert.match(kamera, /input\[type="file"\]\[capture\]/,
  "skupna kamera mora prestreči vse sedanje in dinamično dodane foto-vnose");
assert.match(kamera, /mediaDevices\.getUserMedia/);
assert.match(kamera, /facingMode:\s*\{ ideal: "environment" \}/,
  "za dokument mora imeti prednost zadnja kamera");
assert.match(kamera, /webkit-playsinline/,
  "iPhone mora ohraniti video kamere znotraj aplikacijske kartice");
assert.match(kamera, /new DataTransfer\(\)[\s\S]*dispatchEvent\(new Event\("change"/,
  "posnetek mora nadaljevati skozi obstoječi change tok za OCR in priloge");
assert.match(kamera, /getTracks\(\)\.forEach[\s\S]*\.stop\(\)/,
  "kamera se mora ob zaprtju vedno ugasniti");
assert.match(kamera, /video\.play\(\)[\s\S]*\.catch\(function \(\) \{\}\)/,
  "iOS zavrnitev samodejnega predvajanja ne sme skriti že pridobljenega toka kamere");
assert.doesNotMatch(kamera, /uj-kamera__sistemski|odpriSistemskiZajem/,
  "foto-gumb ne sme odpreti ločene sistemske kamere");
assert.match(kamera, /elementi\.poskusi\.addEventListener\("click"[\s\S]*zacniPredogled/,
  "ponovni poskus mora znova zahtevati živo kamero v aplikaciji");
assert.match(kamera, /try \{[\s\S]*permissions\.query\(\{ name: "camera" \}\)[\s\S]*catch \(_napakaDovoljenja\)/,
  "nepodprta poizvedba dovoljenja v Chromu ne sme ustaviti nalaganja kamere");
assert.match(kamera, />Ponovi</);
assert.match(kamera, />Uporabi sliko</);
assert.match(kamera, /uj-kamera__galerija[\s\S]*<i><\/i><i><\/i><i><\/i>/,
  "spodnja vrstica mora imeti diskreten meni s tremi pikami");
assert.match(slog, /\.uj-kamera__list[\s\S]*bottom:\s*calc\(10px \+ env\(safe-area-inset-bottom, 0px\)\)[\s\S]*height:\s*min\(78\.12dvh, 870px\)/,
  "kamera mora biti plavajoča spodnja kartica in ne celozaslonski zeleni pogled");
assert.match(slog, /\.uj-kamera__sprozi span[\s\S]*background:\s*#f4f4f5/,
  "glavni sprožilec mora biti velik bel krog kot v referenci");
assert.match(slog, /html\.uj-kamera-odprta[\s\S]*overflow:\s*hidden !important/);
assert.match(zascita, /in-app-camera\.css\?v=20260821-inline-static-v5/);
assert.match(zascita, /in-app-camera\.js\?v=20260821-iphone-inline-v11/);
assert.doesNotMatch(kamera, /\/__camera-diagnostic/,
  "začasna diagnostika kamere po preverjanju ne sme ostati v aplikaciji");
assert.match(lokalniStreznik, /"Permissions-Policy": "camera=\(self\)"/);
assert.equal(JSON.parse(vercel).headers[0].headers[0].value, "camera=(self)");

zasciteneStrani.forEach(function (ime) {
  var html = fs.readFileSync(path.join(appMapa, ime), "utf8");
  assert.match(html, /in-app-camera\.css\?v=20260821-inline-static-v5/,
    ime + " mora kamero naložiti neposredno in ne šele po dinamičnem vstavljanju");
  assert.match(html, /in-app-camera\.js\?v=20260821-iphone-inline-v11/);
  assert.ok(html.indexOf("in-app-camera.js?v=20260821-iphone-inline-v11") < html.indexOf("auth-zascita.js"),
    ime + " mora skupno kamero registrirati pred zaščito in logiko strani");
  assert.match(html, /auth-zascita\.js\?v=20260822-preview-touch-v16/,
    ime + " mora naložiti skupno kamero brez stare predpomnjene zaščite");
});

console.log("Kamera v aplikaciji: OK (" + zasciteneStrani.length + " zaščitenih strani)");
