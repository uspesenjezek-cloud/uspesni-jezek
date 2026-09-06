"use strict";

const assert = require("node:assert");
const fs = require("node:fs");

const app = fs.readFileSync("app/app.js", "utf8");
const css = fs.readFileSync("app/styles.css", "utf8");
const zgodovinaCss = fs.readFileSync("app/neplacila-zgodovina.css", "utf8");
const zgodovina = fs.readFileSync("app/neplacila-zgodovina.html", "utf8");
const cilj = fs.readFileSync("app/neplacila-cilj.html", "utf8");
const ciljJs = fs.readFileSync("app/neplacila-cilj.js", "utf8");
const posiljanje = fs.readFileSync("app/neplacila-posiljanje.html", "utf8");
const zgodovinaJs = fs.readFileSync("app/neplacila-zgodovina.js", "utf8");

assert.match(zgodovina, /data-wizard-progress-header[\s\S]*?data-kompaktni-povzetek-dolga[\s\S]*?<main class="zgodovina-vsebina">/);
assert.match(cilj, /data-wizard-progress-header data-korak="3"[\s\S]*?data-kompaktni-povzetek-dolga[\s\S]*?<main class="zgodovina-vsebina wizard-goal-placeholder" aria-label="Cilj za dolg">/);
assert.match(cilj, /id="izvedba-action-sheet" hidden[\s\S]*?id="izvedba-swipe"[\s\S]*?id="izvedba-kartice"/);
assert.match(cilj, /<script src="izvedba\.js\?[^"']+"><\/script>[\s\S]*?<script src="neplacila-cilj\.js\?[^"']+"><\/script>/);
assert.doesNotMatch(cilj, /<script src="neplacila-zgodovina\.js/);
assert.match(ciljJs, /data-cilj-nacin="manual"/);
assert.match(cilj, /class="zgodovina-ai__snemaj" aria-label="Povej na glas"[\s\S]*?zgodovina-ai__snemaj-napis[\s\S]*?<span>Povej<\/span><span>na glas<\/span>/);
assert.match(ciljJs, /data-cilj-prihodnja-funkcija aria-label="Povej na glas"[\s\S]*?zgodovina-ai__snemaj-napis[\s\S]*?<span>Povej<\/span><span>na glas<\/span>/);
assert.match(zgodovinaJs, /aria-label="' \+ \(recording \? 'Ustavi prepis' : 'Povej na glas'\)[\s\S]*?recording \? '<span>Ustavi<\/span><span>prepis<\/span>' : '<span>Povej<\/span><span>na glas<\/span>'/);
assert.match(zgodovinaCss, /\.zgodovina-ai__snemaj-napis[\s\S]*?display:\s*grid[\s\S]*?overflow:\s*visible[\s\S]*?white-space:\s*normal/);
assert.match(ciljJs, /debug\.izrisiActionSheet\(\)/);
assert.match(ciljJs, /state\.nacrtKoraki = \[\]/);
assert.doesNotMatch(ciljJs, /sessionStorage\.setItem|UJIzvedbaApi\.|fetch\(/);
assert.match(ciljJs, /var SELECTOR_NADALJUJ = "\[data-zgodovina-nadaljuj\], \[data-action-sheet-confirm\]";/);
assert.match(ciljJs, /vsebnik\.querySelector\(SELECTOR_NADALJUJ\)/);
assert.match(ciljJs, /dogodek\.target\.closest\(SELECTOR_NADALJUJ\)[\s\S]*?window\.location\.href = "neplacila-posiljanje\.html";/);
assert.match(cilj, /<html lang="sl" class="wizard-status-page wizard-goal-page">/);
assert.match(zgodovinaCss, /html\.wizard-goal-page\s*\{[^}]*background-color:\s*#fbfcfb;/s);
assert.match(cilj, /neplacila-cilj\.js\?v=20260828-goal-next-v3/);
assert.match(posiljanje, /data-wizard-progress-header[\s\S]*?data-kompaktni-povzetek-dolga[\s\S]*?<main class="korak2__vsebina/);
assert.match(posiljanje, /data-kompaktni-povzetek-dolga[\s\S]*?class="priporocilo-widget__ocena-gumb wizard-plan-risk-button"[\s\S]*?data-odpri-oceno-tveganja[\s\S]*?Ocena tveganja/);
assert.doesNotMatch(posiljanje, /id="tone-recommendation-section"/);
assert.doesNotMatch(posiljanje, /<script src="priporocilo-widget\.js/);
assert.match(app, /function osveziKompaktniPovzetekDolga\(podatkiVhod\)/);
assert.match(app, /sessionStorage\.getItem\(KLJUC_SEJE_KORAK1_PODATKI\)/);
assert.match(app, /data-povzetek-dolznik/);
/* Zasnova "asimetrična utež": ime dolžnika je v glavi z inicialko, zamuda je
   vizualni hero (edini podatek, ki zahteva ukrep), dolg in zapadlost pa
   podredni sklad. Vse vrednosti se še vedno samodejno pomanjšajo (data-fit-text),
   da daljše ime ali večji znesek ne razširita okvirja. */
assert.match(app, /data-povzetek-inicialke/);
assert.match(app, /class="wds__ime" data-povzetek-dolznik data-fit-text/);
assert.doesNotMatch(app, /data-povzetek-pretekle/);
assert.match(app, /dniZamude === 1 \? " dan" : " dni"/);
assert.match(app, /class="wds__hero' \+ zamudaRazred/);
assert.match(app, /class="wds__hero-vrednost" data-povzetek-zamuda data-fit-text/);
assert.match(app, /<span class="wds__oznaka">Dolg<\/span><span[^>]*data-povzetek-dolg data-fit-text/);
assert.match(app, /<span class="wds__oznaka">Zapadlost<\/span><span[^>]*data-povzetek-zapadlost data-fit-text/);
/* Glava nosi izključno identiteto dolžnika - noben znesek ne sme uiti vanjo. */
const glavaPovzetka = app.slice(app.indexOf('wds__glava'), app.indexOf('wds__telo'));
assert.ok(glavaPovzetka.length > 0, "Glave povzetka (wds__glava -> wds__telo) ni bilo mogoče najti.");
assert.doesNotMatch(glavaPovzetka, /data-povzetek-dolg|data-povzetek-zamuda/);
assert.doesNotMatch(app, /Xjkx Jdjd/);
assert.doesNotMatch(app, /9446,00/);
assert.match(app, /3:\s*"neplacila-cilj\.html"/);
assert.match(app, /4:\s*"neplacila-posiljanje\.html"/);
assert.match(app, /shortLabel:\s*"Cilj"/);
assert.match(app, /shortLabel:\s*"Načrt"/);
assert.match(app, /inicializirajWizardProgressHeader\(4\)/);
assert.match(zgodovinaJs, /window\.location\.href = "neplacila-cilj\.html"/);
assert.match(css, /\.wizard-debt-summary \{[^}]*border-radius:\s*22px;/s);
assert.match(css, /\.wizard-debt-summary \{[^}]*overflow:\s*hidden;/s);
assert.match(css, /\.wizard-debt-summary \.debt-summary \{[^}]*min-height:\s*38px;/s);
assert.match(css, /\.wizard-debt-summary \.debt-summary--vrstica-1 \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
assert.match(css, /\.wizard-debt-summary \.debt-summary--vrstica-2 \{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
assert.match(css, /\.wizard-debt-summary \.wizard-debt-summary__status \{[^}]*border-radius:\s*12px;/s);
assert.match(css, /\.wizard-debt-summary \.wizard-debt-summary__status--zamuda\.is-alert \{[^}]*background:\s*rgba\(214, 92, 78, \.055\)/s);
assert.match(css, /\.debt-stepper \{[^}]*grid-template-columns:\s*repeat\(4,/s);
assert.match(css, /\[data-wizard-progress-header\]\[data-korak="4"\] \.debt-stepper__selection \{[\s\S]*?translate3d\(calc\(300% \+ 9px\), 0, 0\)/);
assert.match(css, /\/\* Povezani koraki:[\s\S]*?\.debt-stepper::before \{[\s\S]*?right: 12\.5%;[\s\S]*?left: 12\.5%;/);
assert.match(css, /\[data-wizard-progress-header\]\[data-korak="4"\] \.debt-stepper__selection \{[\s\S]*?width: 75%;[\s\S]*?transform: none;/);
assert.match(css, /\.debt-step--active \.debt-step__number,[\s\S]*?background: linear-gradient\(145deg, #4aa7a3, #258f8e\);/);
assert.match(css, /#neplacila-obrazec \.ai-zajem \{[\s\S]*?margin-inline: -10px;[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/);
assert.match(zgodovina, /styles\.css\?v=20260829-connected-stepper-v5/);
assert.match(cilj, /styles\.css\?v=20260829-connected-stepper-v5/);
assert.match(posiljanje, /styles\.css\?v=20260829-connected-stepper-v5/);
assert.match(zgodovina, /app\.js\?v=20260827-wizard-four-step-v1-debt-summary-v4/);
assert.match(cilj, /app\.js\?v=20260827-wizard-four-step-v1-debt-summary-v4/);
assert.match(posiljanje, /app\.js\?v=20260827-wizard-four-step-v1-debt-summary-v4/);

console.log("OK: 3. korak ponovno uporablja delujoče kartice v ločenem pomnilniškem stanju brez oddaje ali zapisa zgodovine.");
