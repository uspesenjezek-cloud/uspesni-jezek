const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.html"), "utf8");
const source = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "bonitetna-podjetje-grafike.css"), "utf8");

assert.match(css, /boniteta-identiteta-nadaljuj:not\(\.is-loading\):not\(\.is-auto-warning\):not\(\.is-complete\) \.boniteta-identiteta-nadaljuj__puscica \{[\s\S]*?background: linear-gradient\(135deg, #25a7a0, #087f83\);[\s\S]*?color: #fff;[\s\S]*?box-shadow: 0 5px 12px rgba\(7, 126, 129, \.17\);/,
  "gumb Preveri mora biti turkizno-zelen kot aktivni zavihek Pregled");
assert.doesNotMatch(css, /boniteta-preveri-obhod|is-preveri-obhod/,
  "odstranjena animacija ne sme ostati v CSS-u");
assert.doesNotMatch(source, /zazeniPreveriObhod|is-preveri-obhod/,
  "odstranjena animacija ne sme ostati v logiki gumba");
assert.match(html, /bonitetna-podjetje-grafike\.css\?v=20260904-preveri-aktiven-v1/);

console.log("✓ Gumb Preveri je statično zelen in nima obhodne animacije.");
