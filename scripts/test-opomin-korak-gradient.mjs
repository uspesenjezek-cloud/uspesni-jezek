import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync("app/opomin-nacrt-ui.js", "utf8");
const css = fs.readFileSync("app/styles.css", "utf8");
const html = fs.readFileSync("app/neplacila-posiljanje.html", "utf8");

assert.match(ui, /function barvniVidezKoraka\(s\)/);
assert.match(ui, /var barvniVidezAktivnegaKoraka = barvniVidezKoraka\(step\)/);
assert.match(ui, /barvniRazred: barvniVidezAktivnegaKoraka\.razred/);
assert.match(ui, /barvniSlog: barvniVidezAktivnegaKoraka\.slog/);
assert.match(ui, /replace\(" opomin-nacrt__stage--barvna", ""\)/);
assert.match(
  css,
  /\.step-content-card\.step-content-card--barvna:not\(\.step-content-card--lastni-korak\)[\s\S]*?border-color:\s*color-mix\(in srgb, var\(--stage-border[\s\S]*?var\(--stage-gradient-from[^;]*60%, white[\s\S]*?var\(--stage-gradient-to[^;]*60%, white/
);
assert.match(
  css,
  /\.step-content-card:not\(\.step-content-card--lastni-korak\) \.debt-summary--compact\s*\{[\s\S]*?background:\s*#ffffff;/
);
const velikaKarticaCss = css.match(
  /\.step-content-card\.step-content-card--barvna:not\(\.step-content-card--lastni-korak\)\s*\{([\s\S]*?)\n\}/
);
assert.ok(velikaKarticaCss, "manjka slog velike barvne kartice");
assert.doesNotMatch(velikaKarticaCss[1], /inset\s+3px\s+0\s+0/);
assert.match(html, /styles\.css\?v=20260829-korak-gradient-v4/);
assert.match(html, /opomin-nacrt-ui\.js\?v=20260829-korak-gradient-v1/);

console.log("OK: velika kartica podeduje barvni gradient aktivnega koraka");
