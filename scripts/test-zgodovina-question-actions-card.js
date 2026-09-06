const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const js = fs.readFileSync(path.join(root, "app", "neplacila-zgodovina.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "neplacila-zgodovina.css"), "utf8");

const renderer = js.match(/function pogovorVprasanjeHtml\(\)[\s\S]*?function virOpisHtml\(\)/)?.[0] || "";
assert.match(renderer, /zgodovina-ai-vprasanje__polja[\s\S]*?zgodovina-ai-pogovor__akcije[\s\S]*?<\/div><\/div>';/, "oba gumba morata biti znotraj kartice vprašanja");
assert.match(css, /\.zgodovina-ai-vprasanje > \.zgodovina-ai-pogovor__akcije\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*gap:\s*10px;/s, "gumba morata zapolniti kartico in imeti vmesni prostor");

console.log("✓ gumba Spremeni opis in Naprej sta z razmikom znotraj kartice");
