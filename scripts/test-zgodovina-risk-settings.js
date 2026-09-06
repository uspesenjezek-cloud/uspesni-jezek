const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const strani = ["neplacila-zgodovina.html", "neplacila-cilj.html", "neplacila-posiljanje.html"];
const htmlji = strani.map((ime) => fs.readFileSync(path.join(root, "app", ime), "utf8"));
const css = fs.readFileSync(path.join(root, "app", "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app", "app.js"), "utf8");
const logic = fs.readFileSync(path.join(root, "app", "ocena-tveganja.js"), "utf8");

assert.match(app, /wizard-debt-summary__risk-settings[\s\S]*data-odpri-oceno-tveganja[\s\S]*Nastavitve ocene tveganja/);
htmlji.forEach((html, index) => {
  assert.match(html, /data-kompaktni-povzetek-dolga/, `${strani[index]} nima povzetka dolga`);
  assert.match(html, /id="ocena-dolg-sheet"[\s\S]*data-ocena-preklop="dolg"[\s\S]*data-ocena-preklop="zamuda"/);
  assert.match(html, /id="ocena-zamuda-sheet"[\s\S]*data-ocena-preklop="dolg"[\s\S]*data-ocena-preklop="zamuda"/);
  assert.match(html, /ocena-tveganja\.js/);
});
assert.match(logic, /pregledGumb\.addEventListener\("click"[\s\S]*odpriNastavitveOcene\("dolg"\)/);
assert.match(logic, /preklopiOcene[\s\S]*odpriNastavitveOcene\(this\.getAttribute\("data-ocena-preklop"\)\)/);
assert.match(css, /\.wizard-debt-summary__risk-settings\s*\{[\s\S]*width:\s*30px;[\s\S]*height:\s*30px;[\s\S]*min-height:\s*30px;/);

console.log("Ocena tveganja: zobnik je povezan na vseh korakih s povzetkom dolga.");
