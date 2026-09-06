"use strict";

var fs = require("node:fs");
var assert = require("node:assert/strict");

var css = fs.readFileSync("app/neplacila-zgodovina.css", "utf8");
var standalone = fs.readFileSync("app/neplacila-zgodovina.html", "utf8");
var embedded = fs.readFileSync("app/izvedba.html", "utf8");

assert.match(css, /\.zgodovina-ai-povzetki\s*\{[^}]*max-height:\s*clamp\(150px, 27dvh, 300px\);[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior-y:\s*contain;/s);
assert.match(css, /\.stran--neplacila-zgodovina \.zgodovina-ai-povzetki\s*\{[^}]*max-height:\s*clamp\(110px, calc\(100dvh - 694px\), 300px\);/s);
assert.match(css, /\.stran--neplacila-zgodovina \.atena__panel > \.izvedba-action-sheet__scroll\s*\{[^}]*overflow-y:\s*visible;[^}]*overscroll-behavior-y:\s*auto;[^}]*touch-action:\s*pan-y;/s);
assert.match(css, /\.zgodovina-ai-povzetki::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*rgba\(63, 153, 152, \.36\);/s);
assert.match(standalone, /neplacila-zgodovina\.css\?v=202608\d{2}-[^"\s]+/);
assert.match(embedded, /neplacila-zgodovina\.css\?v=[^"\s]*summary-scroll-v2/);

console.log("OK: kartice povzetka imajo notranji navpični drsnik in svežo CSS različico.");
