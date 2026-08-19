"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const appRoot = path.basename(__dirname).toLowerCase() === "scripts" ? path.join(root, "app") : __dirname;
const indexRoot = path.basename(__dirname).toLowerCase() === "scripts" ? path.join(root, "app") : path.join(root, "..", "app");
const indexHtml = fs.readFileSync(path.join(indexRoot, "index.html"), "utf8");
const posHtml = fs.readFileSync(path.join(appRoot, "pos-terminal.html"), "utf8");

assert.match(
  indexHtml,
  /<a class="steber-kartica" href="pos-terminal\.html">[\s\S]*?<span class="steber-kartica__naslov">POS terminal<\/span>/,
  "Začetni zaslon mora vsebovati kartico POS terminal, ki vodi na pravo stran."
);
assert.match(posHtml, /<p class="pos-header__eyebrow">POS terminal<\/p>/);
assert.match(posHtml, /<h1>Računi in plačila<\/h1>/);
assert.match(posHtml, /src="testna-vrstica\.js[^\"]*" defer/);

console.log("POS terminal je pravilno povezan z začetnim zaslonom in skupno navigacijo.");
