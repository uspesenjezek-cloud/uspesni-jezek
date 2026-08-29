"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const ciljHtml = fs.readFileSync("app/neplacila-cilj.html", "utf8");
const ciljJs = fs.readFileSync("app/neplacila-cilj.js", "utf8");
const zgodovinaJs = fs.readFileSync("app/neplacila-zgodovina.js", "utf8");
const css = fs.readFileSync("app/neplacila-zgodovina.css", "utf8");

const dveVrstici = /zgodovina-ai__snemaj-napis[\s\S]*?<span>Povej<\/span><span>na glas<\/span>/;
assert.match(ciljHtml, /aria-label="Povej na glas"/);
assert.match(ciljHtml, dveVrstici);
assert.match(ciljJs, /aria-label="Povej na glas"/);
assert.match(ciljJs, dveVrstici);
assert.match(zgodovinaJs, /recording \? 'Prekini snemanje' : 'Povej na glas'/);
assert.match(zgodovinaJs, /data-ai-voice-meter[^']*<i><\/i><i><\/i><i><\/i><i><\/i><i><\/i>/);
assert.match(zgodovinaJs, /function jeSnemalnoStanje\(stanje\)[\s\S]{0,180}"starting"[\s\S]{0,120}"transcribing"/);
assert.match(zgodovinaJs, /var prejAktivno = snemanjeAktivno;[\s\S]{0,420}if \(prejAktivno !== snemanjeAktivno\) \{\s*debug\.izrisiActionSheet\(\);/);
const snemalniOnState = zgodovinaJs.match(/onState: function \(podatek\) \{[\s\S]*?\n\s*\},\n\s*onLevel:/)[0];
assert.doesNotMatch(snemalniOnState, /debug\.izrisiActionSheet\(\);[\s\S]*debug\.izrisiActionSheet\(\);/);
assert.match(css, /\.zgodovina-ai__snemaj-napis[\s\S]*?display:\s*block[\s\S]*?white-space:\s*nowrap/);
assert.doesNotMatch(css, /\.zgodovina-ai__snemaj-napis[^}]*text-overflow:\s*ellipsis/);
assert.match(css, /\.zgodovina-ai__akcije\.is-recording \.zgodovina-ai__snemaj \{ font-size: 14px; \}/);
assert.match(css, /\.zgodovina-ai__akcije\.is-analyzing \.zgodovina-ai__razumi \{ font-size: 14px; \}/);

console.log("✓ Povej na glas: stabilna enkratna animacija, enovrstični napis in pet živih stolpcev");
