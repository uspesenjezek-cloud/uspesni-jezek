"use strict";

var fs = require("node:fs");
var assert = require("node:assert/strict");

var css = fs.readFileSync("app/neplacila-zgodovina.css", "utf8");
var html = fs.readFileSync("app/neplacila-zgodovina.html", "utf8");

assert.match(css, /\.stran--neplacila-zgodovina \.atena__panel\s*\{[^}]*display:\s*block;[^}]*height:\s*auto;[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/s,
  "Samostojna zgodovina mora uporabljati en sam drsnik celotne strani.");
assert.match(css, /@supports \(height:\s*100dvh\)[\s\S]*?\.stran--neplacila-zgodovina \.atena__panel\s*\{[^}]*height:\s*auto;[^}]*max-height:\s*none;/s,
  "Mobilni viewport ne sme ponovno omejiti samostojnega panela.");
assert.match(css, /\.stran--neplacila-zgodovina \.atena__panel > \.izvedba-action-sheet__scroll\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*visible;[^}]*touch-action:\s*pan-y;/s,
  "Notranje telo mora prepustiti navpično potezo enotnemu page scrollu.");
assert.match(css, /body\.app-testna-vrstica-prisotna\.stran--neplacila-zgodovina[\s\S]*?\.zgodovina-shell\s*\{[^}]*padding-bottom:\s*calc\(100px \+ var\(--app-testna-safe-bottom/s,
  "Konec strani mora ostati nad stalno vrstico Nazaj/Home.");
assert.match(html, /neplacila-zgodovina\.css\?v=202608\d{2}-[^"\s]+/,
  "Zgodovinski zaslon mora zahtevati svežo CSS različico.");

console.log("OK: zgodovinski Atena panel uporablja enoten dosegljiv page scroll do potrditve.");
