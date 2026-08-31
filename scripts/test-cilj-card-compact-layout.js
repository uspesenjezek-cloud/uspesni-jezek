const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "neplacila-cilj.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "neplacila-zgodovina.css"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "neplacila-cilj.html"), "utf8");

[
  "full_payment",
  "partial_payment_now",
  "installment_plan",
  "new_deadline",
  "amicable_settlement",
  "dispute_resolution",
  "compensation",
  "payment_security",
  "insolvency_claim",
  "close_without_recovery",
  "custom_goal",
].forEach((goalId) => {
  assert.match(source, new RegExp('id: "' + goalId + '"'), goalId + " mora uporabljati skupni ciljni vnosnik");
});

assert.match(css, /\.cilj-father-vnosnik__polja\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
assert.match(css, /\.atena \.zgodovina-ai-vprasanje__polja\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
assert.match(css, /label\.zgodovina-dogodek__polje--polno,[\s\S]*?label:has\(textarea\)[\s\S]*?grid-column:\s*1\s*\/\s*-1/);
assert.match(css, /cilj-father-vnosnik__polja\s*>\s*:nth-child\(odd\):has\(\+\s*\.zgodovina-dogodek__polje--polno\)[^{]*\{\s*grid-column:\s*1\s*\/\s*-1/);
assert.match(css, /cilj-father-vnosnik__polja:has\(>\s*\.zgodovina-dogodek__polje--polno\)[^{]*:last-child:nth-child\(odd\):not\(\.zgodovina-dogodek__polje--polno\)[^{]*\{\s*grid-column:\s*auto/);
assert.doesNotMatch(css, /@media \(max-width:\s*420px\)[\s\S]{0,240}cilj-father-vnosnik__polja/);
assert.match(css, /@media \(max-width:\s*330px\)[\s\S]{0,240}cilj-father-vnosnik__polja/);
assert.match(css, /zgodovina-ai-vprasanje__polja--placilo-kompaktno label\.is-payment-method \.zgodovina-ai-vprasanje__izbira-seznam\s*\{[^}]*position:\s*absolute;[^}]*width:\s*calc\(200% \+ 7px\)/s);
assert.ok(css.includes(".cilj-father-vnosnik__polja > .zgodovina-dogodek__polje:not(.zgodovina-dogodek__polje--polno)"));
assert.ok(css.includes(".cilj-pravna-vnosnik__polja > .zgodovina-dogodek__polje:not(.zgodovina-dogodek__polje--polno)"));
assert.ok(css.includes(".atena .zgodovina-ai-vprasanje__polja > label:not(.zgodovina-dogodek__polje--polno):not(:has(textarea))"));
assert.match(css, /display:\s*flex;\s*flex-direction:\s*column;\s*align-self:\s*stretch/);
assert.match(css, /margin-top:\s*auto/);
assert.match(html, /neplacila-zgodovina\.css\?v=[^"']*atena-pill-v2/);
assert.match(css, /\.zgodovina-nacina__izbira\s*\{[^}]*width:\s*100%;[^}]*padding:\s*3px;[^}]*border-radius:\s*999px;[^}]*box-shadow:/s);
assert.match(css, /\.zgodovina-nacina__izbira button\s*\{[^}]*min-height:\s*51px;[^}]*border:\s*0;[^}]*border-radius:\s*999px;[^}]*background:\s*transparent;/s);
assert.match(css, /\.zgodovina-nacina__izbira button\.is-selected\s*\{[^}]*background:\s*#dff3f0;[^}]*box-shadow:\s*0 2px 6px rgba\(35, 119, 115, \.1\);/s);
assert.doesNotMatch(css, /\.zgodovina-nacina__izbira button\.is-selected\s*\{[^}]*inset/s);

console.log("OK: vse ciljne kartice uporabljajo kompaktno mrežo, polno širino opisov in poravnane pare vnosov.");
