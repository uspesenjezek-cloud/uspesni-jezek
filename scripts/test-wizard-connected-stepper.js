const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "app", "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app", "app.js"), "utf8");
const pageNames = [
  "neplacila.html",
  "neplacila-zgodovina.html",
  "neplacila-cilj.html",
  "neplacila-posiljanje.html",
  "neplacila-sporocilo.html",
];

const redesign = css.slice(css.indexOf("/* Povezani koraki:"));
assert.ok(redesign.length > 0, "manjka slog povezanih korakov");
assert.match(redesign, /\.debt-stepper::before\s*\{\s*display:\s*none;/);
assert.match(redesign, /\.debt-stepper\s*\{[\s\S]*?--wizard-track-top:\s*calc\(var\(--wizard-safe-top\) \+ 20px\);[\s\S]*?--wizard-progress:\s*0%;/);
assert.match(redesign, /\.debt-stepper__selection\s*\{\s*display:\s*none;/);
assert.match(redesign, /\.debt-step__content::before\s*\{[\s\S]*?top:\s*12px;[\s\S]*?left:\s*50%;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*4px;/);
assert.match(redesign, /\.debt-step:last-child \.debt-step__content::before\s*\{\s*display:\s*none;/);
assert.match(redesign, /\.debt-step--complete \.debt-step__content::before\s*\{[\s\S]*?background:\s*#3f9998;/);
assert.doesNotMatch(redesign, /\.debt-step--complete \.debt-step__content::before,\s*\.debt-step--active/);
assert.match(redesign, /\.debt-step--complete:has\(\+ \.debt-step--active\) \.debt-step__content::before\s*\{[\s\S]*?background:\s*#3f9998;/);
assert.match(redesign, /@media \(max-width: 430px\)\s*\{[\s\S]*?\.debt-stepper \.debt-step__content::before\s*\{[\s\S]*?top:\s*10px;/);
assert.match(redesign, /@media \(max-width: 370px\)\s*\{[\s\S]*?\.debt-step__content::before\s*\{[\s\S]*?top:\s*10px;/);
assert.match(redesign, /\.debt-step__content\s*\{[\s\S]*?flex-direction:\s*column;/);
assert.match(redesign, /\.debt-step__icon\s*\{\s*display:\s*none;/);
assert.match(redesign, /\.debt-step--complete \.debt-step__number\s*\{[\s\S]*?background:\s*#3f9998;[\s\S]*?color:\s*#ffffff;/);
assert.match(redesign, /\.debt-step--active:not\(\.debt-step--complete\) \.debt-step__number,[\s\S]*?border:\s*2px solid #3f9998;[\s\S]*?background:\s*#fbfaf7;[\s\S]*?color:\s*#2d8582;/);
assert.match(redesign, /\.debt-step--upcoming \.debt-step__number\s*\{[\s\S]*?border-color:\s*#b7c4c4;/);
assert.match(redesign, /\.debt-step__number::before\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*28px;[\s\S]*?data:image\/svg\+xml/);
assert.match(redesign, /\.debt-step--complete \.debt-step__number::before\s*\{\s*opacity:\s*1;/);
assert.doesNotMatch(redesign, /\.debt-step--complete \.debt-step__number::before,\s*\.debt-step--active/);
assert.match(redesign, /\.debt-step:first-of-type \.debt-step__number::before\s*\{[\s\S]*?clip-path:\s*inset\(0 0 0 50%\);/);
assert.match(redesign, /\.debt-step:last-child \.debt-step__number::before\s*\{[\s\S]*?clip-path:\s*inset\(0 50% 0 0\);/);
assert.match(app, /SVG_WIZARD_KLJUKICA[\s\S]*?<path d="M20 6 9 17l-5-5"\/>/);
assert.match(app, /const jeTrenutni = n === trenutniKorak;[\s\S]*?const jeIzpolnjen = jeKorakIzpolnjen\(n\);/);
assert.match(app, /if \(jeIzpolnjen\) \{[\s\S]*?el\.classList\.add\("debt-step--complete"\);/);
assert.match(app, /const stanje = jeIzpolnjen \? "complete" : jeTrenutni \? "active" : "upcoming";/);
assert.match(redesign, /#neplacila-obrazec \.ai-zajem\s*\{[\s\S]*?margin-inline:\s*-10px;[\s\S]*?border:\s*0;[\s\S]*?box-shadow:\s*none;/);

pageNames.forEach((name) => {
  const html = fs.readFileSync(path.join(root, "app", name), "utf8");
  const cache = name === "neplacila-posiljanje.html"
    ? "20260830-plan-inner-full-width-v1"
    : "20260830-global-full-width-v1";
  assert.match(html, new RegExp(`styles\\.css\\?v=${cache}`));
});

console.log("OK: povezani koraki in brezokvirni uvod prve strani so prisotni na vseh korakih postopka.");
