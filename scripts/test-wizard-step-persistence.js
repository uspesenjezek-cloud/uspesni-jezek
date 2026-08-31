const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app", "app.js"), "utf8");
const cilj = fs.readFileSync(path.join(root, "app", "neplacila-cilj.js"), "utf8");
const zgodovina = fs.readFileSync(path.join(root, "app", "neplacila-zgodovina.js"), "utf8");
const karticeSync = fs.readFileSync(path.join(root, "app", "opomin-kartice-sync.js"), "utf8");
const pages = [
  "neplacila.html",
  "neplacila-zgodovina.html",
  "neplacila-cilj.html",
  "neplacila-posiljanje.html",
  "neplacila-sporocilo.html",
].map((name) => fs.readFileSync(path.join(root, "app", name), "utf8"));

assert.match(app, /const KLJUC_SEJE_CILJ = "neplacilo-cilj-podatki";/);
assert.match(app, /function jeKorak1Potrjen\(\)[\s\S]*?korak1\.potrjena === true[\s\S]*?korak1\.potrjena === false[\s\S]*?preberiKorak1Fingerprint/);
assert.match(app, /function ugotoviMaxDosezenKorak\(\)[\s\S]*?cilj\.potrjena === true\) return 4;[\s\S]*?zgodovina\.potrjena === true\) return 3;[\s\S]*?jeKorak1Potrjen\(\)\) return 2;/);
assert.match(app, /if \(stevilka === 3\)[\s\S]*?cilj\.potrjena === true/);
assert.match(app, /function shraniOsnutekKorak1Lokalno\(\)[\s\S]*?potrjena: false/);
assert.match(app, /const noviKorak1 = \{\s*potrjena: true,/);
assert.ok((app.match(/removeItem\(KLJUC_SEJE_CILJ\)/g) || []).length >= 3, "cilj manjka v družinskih cleanupih");
assert.match(app, /const ohraniLokalniPostopek = Boolean\([\s\S]*?lokalnaZgodovinaPredSync\.potrjena === true[\s\S]*?lokalniCiljPredSync\.potrjena === true[\s\S]*?naloziPredZagonom\(\{\s*ohraniLokalniPostopek,/,
  "Potrjen novi postopek mora biti zaščiten pred oddaljenim osnutkom druge zadeve.");
assert.match(app, /preostaliDolgPredNacrtom = Number\.isFinite[\s\S]*?osveziKompaktniPovzetekDolga\(\{[\s\S]*?znesek: podatkiKorak1\.preostaliDolgPredNacrtom,/,
  "Povzetek načrta mora prikazati preostali dolg po potrjeni zgodovini.");
assert.match(karticeSync, /if \(moznosti\.ohraniLokalniPostopek === true\) \{[\s\S]*?dovoljenoShranjevanjeOsnutka = true;[\s\S]*?\} else \{\s*await naloziCelotenOsnutek\(uid, plan\);/,
  "Sinhronizacija ne sme prepisati aktivnega lokalnega postopka s starim oddaljenim osnutkom.");

assert.match(cilj, /var KLJUC_SEJE_CILJ = "neplacilo-cilj-podatki";/);
assert.match(cilj, /var shranjeniCilj = preberiCiljSejo\(\);[\s\S]*?state\.nacrtKoraki = shranjeniCilj/);
assert.match(cilj, /function shraniCilj\(potrjena\)[\s\S]*?potrjena: potrjena === true[\s\S]*?naravniOpis:[\s\S]*?cilj:[\s\S]*?odprtaPodizbira:/);
assert.match(cilj, /shraniCilj\(true\);\s*window\.location\.href = "neplacila-posiljanje\.html"/);
assert.ok((cilj.match(/shraniCilj\(false\)/g) || []).length >= 8, "vse spremembe cilja morajo razveljaviti potrditev");
assert.match(zgodovina, /var zgodovinaPotrjena = shranjeno\.potrjena === true;/);
assert.match(zgodovina, /data-ai-confirm-candidates[\s\S]*?if \(!jeVgrajenaZgodovina\) \{[\s\S]*?shrani\(true\);[\s\S]*?window\.location\.href = "neplacila-cilj\.html";[\s\S]*?return;/, "potrditev pripravljenih dogodkov mora neposredno odpreti korak Cilj");
assert.match(zgodovina, /window\.UJZgodovinaPoIzrisu[\s\S]*?shrani\(zgodovinaPotrjena\);/);
assert.doesNotMatch(zgodovina, /window\.UJZgodovinaPoIzrisu[\s\S]*?shrani\(false\);\s*\};/);
assert.match(zgodovina, /var praznaZgodovina = !\(_state\.nacrtKoraki \|\| \[\]\)\.length;[\s\S]*?pripravljeniDogodki\.hidden = praznaZgodovina;/,
  "Prazen razdelek Pripravljeni dogodki mora biti umaknjen.");
assert.match(zgodovina, /nadaljujBrezZgodovine\.textContent = "Nadaljuj brez zgodovine";/,
  "Prazen drugi korak mora jasno ponuditi nadaljevanje brez zgodovine.");
assert.match(fs.readFileSync(path.join(root, "app", "izvedba.js"), "utf8"), /data-zgodovina-izbrisi-vse>Zbriši vse<\/button>[\s\S]*?Shrani in nadaljuj/,
  "Pripravljeni dogodki morajo imeti manjši gumb za brisanje vseh in glavno dejanje za nadaljevanje.");
assert.match(fs.readFileSync(path.join(root, "app", "izvedba.js"), "utf8"), /var zgodovinaIzbrisiVse = event\.target\.closest\("\[data-zgodovina-izbrisi-vse\]"\);[\s\S]*?state\.nacrtKoraki = \[\];/,
  "Gumb Zbriši vse mora odstraniti vse pripravljene dogodke.");

pages.forEach((html) => assert.match(html, /app\.js\?v=[^"\s]+/));
assert.match(pages[2], /neplacila-cilj\.js\?v=[^"\s]+/);
assert.match(pages[1], /neplacila-zgodovina\.js\?v=[^"\s]+/);

console.log("OK: koraka 1 in 3 ohranita vsebino ter ločujeta osnutek od potrditve.");
