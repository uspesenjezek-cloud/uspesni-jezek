const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const css = read("app", "styles.css");
const cache = "20260904-globalni-rob-13-v2";

assert.match(css, /--odmik-roba:\s*13px;/, "skupni rob aplikacije mora ostati 13 px");
assert.match(css, /--odmik-roba-glave:\s*3px;/, "zgornje glave morajo ohraniti prvotni 3 px rob");

assert.match(
  css,
  /body > main\.app__vsebina,[\s\S]*?body\.stran--storitev > main\.storitev-vsebina,[\s\S]*?\.aktivni-primeri-shell > main\.aktivni-primeri-stran\s*\{[\s\S]*?max-width:\s*var\(--sirina-vsebine\);[\s\S]*?padding-inline:\s*var\(--odmik-roba\);/,
  "glavne kategorije, podmeniji in aktivni primeri morajo uporabljati skupni zunanji rob",
);

const stylesPages = [
  "aktivni-primeri.html", "bonitetna-preverba.html", "index.html", "izvedba.html",
  "koncani-primeri.html", "neplacila-cilj.html", "neplacila-posiljanje.html",
  "neplacila-sporocilo.html", "neplacila-zgodovina.html", "neplacila.html",
  "pos-terminal.html", "prijava.html", "rast-priloznosti.html", "skrb-stranke-delavci.html",
  "skupnost-obrtnikov.html", "svetovalec-preverba.html", "ugled-optimizacija.html",
  "zacasno-obvestila.html", "zascita-posla.html",
];

stylesPages.forEach((page) => {
  assert.match(read("app", page), new RegExp(`styles\\.css\\?v=${cache}`), `${page} mora naložiti svež skupni CSS`);
});

assert.match(read("app", "koncani-primeri.css"), /\.koncani-primeri-stran\s*\{\s*padding:\s*23px var\(--odmik-roba\) 28px;/);
assert.match(read("app", "koncani-primeri.css"), /\.koncani-primeri-uvod\s*\{\s*margin:\s*0 calc\(var\(--odmik-roba-glave\) - var\(--odmik-roba\)\) 16px;/);
assert.match(read("app", "zacasno-obvestila.css"), /\.zacasno-obvestila\s*\{[\s\S]*?padding:\s*calc\(14px[^;]+\) 0 calc\(30px/);
assert.match(read("app", "pos-terminal.css"), /\.pos-main\s*\{[\s\S]*?padding-inline:\s*var\(--odmik-roba\);/);
assert.match(read("app", "bonitetna-preverba.css"), /\.stran--bonitetna \.boniteta-vsebina\s*\{[\s\S]*?padding-right:\s*var\(--odmik-roba\);[\s\S]*?padding-left:\s*var\(--odmik-roba\);/);
assert.match(read("app", "bonitetna-preverba.css"), /\.stran--bonitetna \.boniteta-vsebina > \.boniteta-obrazec > \.boniteta-hero\s*\{[\s\S]*?margin-right:\s*calc\(var\(--odmik-roba-glave\) - var\(--odmik-roba\)\);[\s\S]*?margin-left:\s*calc\(var\(--odmik-roba-glave\) - var\(--odmik-roba\)\);/);
assert.match(read("app", "bonitetna-preverba.css"), /\.stran--bonitetna \.boniteta-zajem,[\s\S]*?\.stran--bonitetna \.crif-flow-picker\s*\{[\s\S]*?margin-right:\s*0;[\s\S]*?margin-left:\s*0;/);
assert.match(read("app", "bonitetna-preverba.css"), /boniteta-insolvenca-je-okno \.boniteta-vsebina\s*\{[\s\S]*?padding-right:\s*var\(--odmik-roba\);[\s\S]*?padding-left:\s*var\(--odmik-roba\);/);
assert.match(read("app", "bonitetna-preverba.css"), /boniteta-register-result #boniteta-hwk-sklop\.is-register-card\s*\{[\s\S]*?padding-right:\s*0;[\s\S]*?padding-left:\s*0;/);
assert.match(read("app", "boniteta-pro.css"), /\.bp-main\s*\{[^}]*width:min\(var\(--sirina-vsebine,480px\),100%\);[^}]*padding:26px var\(--odmik-roba,3px\) 64px;/);
assert.match(read("app", "bonitetna-preverba.html"), /bonitetna-preverba\.css\?v=20260904-wide-page-headers-v1/);
assert.match(read("app", "bonitetna-preverba.html"), /boniteta-pro\.css\?v=20260830-boniteta-full-width-v1/);
assert.match(read("app", "izvedba.css"), /\.izvedba-integrirana > \.zo-sledi > \.zo-sledi__vsebina\s*\{[\s\S]*?padding-right:\s*0;[\s\S]*?padding-left:\s*0;/);
assert.match(read("app", "izvedba.html"), /izvedba\.css\?v=20260831-readonly-v1/);
assert.match(read("app", "slovenski-prepis.css"), /--odmik-roba:\s*13px;/);
assert.match(read("app", "slovenski-prepis.css"), /@media \(max-width: 620px\)[\s\S]*?right:\s*var\(--odmik-roba\);[\s\S]*?width:\s*calc\(100vw - \(2 \* var\(--odmik-roba\)\)\);/);
assert.match(read("app", "slovenski-prepis.css"), /@media \(max-width: 520px\)[\s\S]*?inset:[^;]*var\(--odmik-roba\)/);

[
  ["koncani-primeri.html", "koncani-primeri.css", "20260904-compact-cards-v1"],
  ["izvedba.html", "zacasno-obvestila.css", "20260830-global-full-width-v1"],
  ["zacasno-obvestila.html", "zacasno-obvestila.css", "20260830-global-full-width-v1"],
  ["pos-terminal.html", "pos-terminal.css", "20260830-global-full-width-v1"],
  ["slovenski-prepis.html", "slovenski-prepis.css", "20260904-globalni-rob-13-v1"],
].forEach(([page, stylesheet, stylesheetCache]) => {
  assert.match(read("app", page), new RegExp(`${stylesheet.replace(".", "\\.")}\\?v=${stylesheetCache}`), `${page} mora osvežiti ${stylesheet}`);
});

console.log("OK: vse uporabniške kategorije in podmeniji uporabljajo skupni rob ter svež CSS cache.");
