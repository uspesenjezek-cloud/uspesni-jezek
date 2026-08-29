const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'app', 'bonitetna-preverba.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'app', 'bonitetna-preverba.html'), 'utf8');

assert.match(html, /id="boniteta-dodatni-podatki"/, 'Manjka vsebnik dodatnih podatkov.');
assert.match(
  css,
  /\.is-rocni-popup #boniteta-dodatni-podatki\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
  'Spodnji polji morata imeti enako širino.'
);
assert.match(
  css,
  /#boniteta-dodatni-podatki \.boniteta-polje\s*\{[^}]*grid-template-rows:\s*auto 50px;[^}]*align-content:\s*end/s,
  'Spodnja vnosa morata biti poravnana na isto vodoravno linijo.'
);
assert.match(
  css,
  /@media \(max-width:\s*520px\)[\s\S]*?#boniteta-dodatni-podatki \.boniteta-polje__neobvezno\s*\{[^}]*display:\s*none/s,
  'Na telefonu se ponovljeni neobvezni pripis ne sme lomiti in zamakniti polj.'
);
assert.match(
  html,
  /bonitetna-preverba\.css\?v=20260825-manual-fields-align-v68/,
  'Različica CSS mora preprečiti prikaz starega predpomnjenega dizajna.'
);

console.log('PASS: polji za registrsko in davčno številko sta enako široki in poravnani.');
