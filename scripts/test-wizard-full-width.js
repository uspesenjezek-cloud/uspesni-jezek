const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "app", "styles.css"), "utf8");
const pages = [
  "neplacila.html",
  "neplacila-zgodovina.html",
  "neplacila-cilj.html",
  "neplacila-posiljanje.html",
];

assert.match(css, /body\.wizard-status-header \.korak2__vsebina\s*\{\s*padding-inline:\s*0;/);
assert.match(css, /\.korak2-ovoj,\s*\.wizard-shell\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*var\(--sirina-vsebine\);/);
assert.match(css, /body\.wizard-status-header \.korak2__vsebina--opomin \.opomin-nacrt__vsebina,[\s\S]*?\.opomin-nacrt-potrdi__vsebina\s*\{[\s\S]*?padding-right:\s*0;[\s\S]*?padding-left:\s*0;/);
assert.match(css, /body\.wizard-status-header \.korak2__vsebina--opomin > \.tone-recommendation-section\s*\{[\s\S]*?width:\s*100%;[\s\S]*?margin-right:\s*0;[\s\S]*?margin-left:\s*0;/);

pages.forEach((page) => {
  const html = fs.readFileSync(path.join(root, "app", page), "utf8");
  assert.match(html, /class="[^"]*wizard-shell[^"]*"/, `${page} mora uporabljati skupni wizard-shell`);
  const cache = page === "neplacila-posiljanje.html"
    ? "20260830-plan-inner-full-width-v1"
    : "20260830-global-full-width-v1";
  assert.match(html, new RegExp(`styles\\.css\\?v=${cache}`), `${page} mora naložiti svežo širino`);
});

console.log("OK: vsi štirje koraki uporabljajo isti polni wizard rob in svež CSS cache.");
