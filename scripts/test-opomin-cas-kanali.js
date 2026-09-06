const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "app", "opomin-nacrt-ui.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "styles.css"), "utf8");

assert.match(ui, /function htmlKompaktniKontaktniKanali\(ctx\)[\s\S]*data-kontakt-toggle-primarni/);
assert.match(ui, /opomin-nacrt__cas-kanal-dodaj[^\n]*data-kontakt-odpri-vnos/);
assert.match(ui, /opomin-nacrt__cas-kanal-vnos[^\n]*kontaktDodajOdprt\[vrsta\][\s\S]*data-kontakt-dodaj-vnos/);
assert.match(ui, /ctx\.kontaktiVCasu \? "" : htmlKontaktneKartice\(ctx\)/);
assert.match(ui, /customContacts:\s*step\.customContacts/);
assert.match(ui, /data-fit-text-min="8"[\s\S]*data-fit-text-container="\.opomin-nacrt__cas-kanal"/);
assert.match(ui, /casKontaktiInPreklopHtml\s*=\s*kompaktniKontaktniKanaliHtml[\s\S]*casGumbPreklopHtml/);
assert.match(ui, /kontaktiVCasu:\s*Boolean\(casPreklopObstaja\)/);
assert.doesNotMatch(ui, /opomin-nacrt__cas-kanal-vrednost[^\n]*(?:SMS|E-pošta)/);
assert.match(css, /\.opomin-nacrt__cas-kanali\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);
assert.match(css, /\.opomin-nacrt__cas-kontakti-preklop\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 82px;/);
assert.match(css, /\.opomin-nacrt__cas-kanal\s*\{[\s\S]*grid-template-columns:\s*22px minmax\(0, 1fr\) 25px 25px;/);
assert.match(css, /\.opomin-nacrt__cas-kanal-vnos\s*\{[\s\S]*margin:\s*0;/);
assert.match(css, /\.opomin-nacrt__cas-kanal-skupina\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);
assert.match(css, /\.opomin-nacrt__cas-kontakti-preklop \.opomin-nacrt__cas-podrobno-ura\s*\{[\s\S]*width:\s*24px;[\s\S]*height:\s*24px;/);
assert.match(css, /\.opomin-nacrt__cas-kontakti-preklop \.opomin-nacrt__cas-podrobno-puscica\s*\{[\s\S]*display:\s*none;/);
assert.match(css, /\.opomin-nacrt__cas-kontakti-preklop \.opomin-nacrt__cas-podrobno-preklop\[aria-expanded="true"\]\s*\{[\s\S]*border-color:\s*#159195;/);
assert.match(css, /\.opomin-nacrt__cas-kanal-vrednost\s*\{[\s\S]*white-space:\s*nowrap;/);

console.log("Načrt: kompaktna telefonska številka in e-naslov sta v kartici časa.");
