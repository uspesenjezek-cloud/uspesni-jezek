"use strict";

// Generira NAZORJEVA-VRSTICE-GALERIJA.html iz registra NAZORJEVA-VRSTICE.js.
// Poganjaj po vsaki spremembi registra: node scripts/generate-nazorjeva-vrstice-galerija.js
//
// Datoteka je samostojna — odpre se z dvoklikom (file://), ne rabi lokalnega
// strežnika. CSS se naloži relativno iz app/atena-card-templates.css, kar pri
// file:// protokolu deluje enako kot pri http, ker gre za sosednjo mapo na disku.

const fs = require("node:fs");
const path = require("node:path");
const register = require("../NAZORJEVA-VRSTICE.js");
// Za vrstice "widget-<id>" (40-92) se primer izriše NEPOSREDNO iz prave
// body() funkcije tega NAZORJEVA widgeta — ne iz ročno prepisanega HTML-ja —
// da se izognemo napakam kot pri prejšnji različici vrstice 25 (mini-koledar).
const nazorjevaTemplates = require("../app/atena-card-templates.js");
const templateById = new Map(nazorjevaTemplates.templates.map((w) => [w.id, w]));
// CSS se VGRADI neposredno v datoteko (ne <link>), da galerija deluje ne glede
// na to, od kod je odprta (dvoklik, Downloads, USB ...) — brez odvisnosti od
// relativne poti do app/atena-card-templates.css.
const cardCss = fs.readFileSync(path.join(__dirname, "..", "app", "atena-card-templates.css"), "utf8");
/* Dodatni predlogi/različice (P1–P72, V1–V133) živijo v ločeni datoteki, ker so
   pisani ročno in ne izhajajo iz NAZORJEVA-VRSTICE.js. Vsebina se vstavi tik
   pred </body> in se izriše v Shadow DOM (lasten <style>, lastni gradniki).
   Brez tega bi vsak zagon generatorja izbrisal 205 kartic. */
const predlogiBlokPot = path.join(__dirname, "gallery-predlogi-blok.html");
const predlogiBlok = fs.existsSync(predlogiBlokPot) ? fs.readFileSync(predlogiBlokPot, "utf8") : "";
/* Dodatni galerijski stili (tipografija, odzivni razmiki, popravki prikaza),
   pisani ročno poleg generiranih. Vstavijo se na konec <head>, da lahko
   prepišejo zgoraj generirana pravila. */
const predlogiStilPot = path.join(__dirname, "gallery-predlogi-stil.html");
const predlogiStil = fs.existsSync(predlogiStilPot) ? fs.readFileSync(predlogiStilPot, "utf8") : "";
/* Dodatne skripte za KARTICE V SVETLEM DOM-u (#1–#133): poravnava oznak po
   nalaganju pisav, poenotenje odstotkovnih polj, postavitev oznak pri
   primerjavi sprememb ter logika za [data-estimate-card] in [data-bullet-card].
   Pisane ročno poleg generiranih; brez njih te kartice nehajo delovati. */
const predlogiSkriptePot = path.join(__dirname, "gallery-predlogi-skripte.html");
const predlogiSkripte = fs.existsSync(predlogiSkriptePot) ? fs.readFileSync(predlogiSkriptePot, "utf8") : "";

// Za PRAVE produkcijske Atena vrstice (27+) se app/styles.css (44.454 vrstic,
// celoten CSS aplikacije) NE vgrajuje v celoti — prevelik in tvegan glede
// konflikta z galerijsko postavitvijo. Namesto tega je tu ROČNO izluščen
// minimalen izsek, samo za prikazane primere, dobeseden prepis iz styles.css.
const productionCss = `
.ponudba-obrazec__glava { display:flex; align-items:center; gap:8px; }
.ponudba-obrazec__glava-ikona { display:grid; width:30px; height:30px; place-items:center; border:1px solid color-mix(in srgb, var(--obrazec-barva) 42%, white); border-radius:9px; background:var(--obrazec-ozadje); color:var(--obrazec-barva); }
.ponudba-obrazec__glava-ikona svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.ponudba-obrazec__glava h2 { margin:0; color:#172d43; font:750 0.82rem/1.15 Inter, sans-serif; }
.ponudba-obrazec__koraki { display:flex; }
.ponudba-obrazec__korak { display:grid; position:relative; z-index:0; flex:1 1 0; min-width:0; height:28px; padding:0; place-items:center; border:0; background:transparent; }
.ponudba-obrazec__korak::before { position:relative; z-index:2; width:25px; height:25px; border:1.5px solid color-mix(in srgb, var(--obrazec-barva) 38%, #aebcbd); border-radius:50%; background:#fbfaf7; content:""; }
.ponudba-obrazec__korak > span { position:absolute; z-index:3; color:color-mix(in srgb, var(--obrazec-barva) 68%, #5e6a6b); font:800 13px/1 Inter, sans-serif; }
.ponudba-obrazec__korak::after { position:absolute; z-index:1; top:50%; left:50%; width:100%; height:2px; border-radius:999px; background:#c9d0d2; content:""; transform:translateY(-50%); }
.ponudba-obrazec__korak:last-child::after { display:none; }
.ponudba-obrazec__korak.is-koncan::before { border-color:var(--obrazec-barva); background:var(--obrazec-barva); }
.ponudba-obrazec__moznost { display:grid; position:relative; grid-template-columns:18px minmax(0,1fr); min-height:34px; padding:5px 7px; align-items:center; gap:6px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 24%, #c8d7e6); border-radius:8px; background:#fff; color:#283b4d; font:500 13px/1.15 Inter, sans-serif; }
.ponudba-obrazec__moznost input { position:absolute; width:1px; height:1px; opacity:0; }
.ponudba-obrazec__moznost:has(input:checked) { border-color:color-mix(in srgb, var(--obrazec-barva) 54%, white); background:var(--obrazec-ozadje); }
.ponudba-obrazec__moznost input:checked + .ponudba-obrazec__krog { border-color:var(--obrazec-barva); background:var(--obrazec-barva); color:#fff; }
.ponudba-obrazec__krog { display:grid; width:18px; height:18px; place-items:center; border:1px solid color-mix(in srgb, var(--obrazec-barva) 30%, #b8c6d3); border-radius:50%; background:#fff; color:transparent; }
.ponudba-obrazec__krog svg { width:12px; height:12px; fill:none; stroke:currentColor; stroke-width:2.2; }
.ponudba-obrazec__potrditev { display:grid; grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr); min-height:34px; padding:6px 8px; align-items:center; gap:8px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 24%, #c8d7e6); border-radius:8px; background:#fff; }
.ponudba-obrazec__potrditev span { color:var(--obrazec-barva); font:700 13px/1.15 Inter, sans-serif; }
.ponudba-obrazec__potrditev strong { color:#283b4d; font:650 13px/1.2 Inter, sans-serif; text-align:right; }
.ponudba-obrazec__podrocje { display:flex; align-items:center; gap:8px; padding:9px 10px; border-radius:11px; background:var(--podrocje-ozadje); }
.ponudba-obrazec__podrocje-ikona { display:grid; width:29px; height:29px; place-items:center; border-radius:9px; background:#fff; color:var(--podrocje-barva); }
.ponudba-obrazec__podrocje-ikona svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.8; }
.ponudba-obrazec__podrocje-besedilo b { display:block; color:#172d43; font:750 13px/1.2 Inter, sans-serif; }
.ponudba-obrazec__podrocje-besedilo small { color:#5f7471; font:600 13px/1.2 Inter, sans-serif; }

.atena-polje { display:grid; min-width:0; align-content:start; gap:5px; }
.atena-polje__oznaka { color:var(--obrazec-barva); font:750 13px/1.25 Inter, sans-serif; }
.atena-polje__oznaka b { color:#bd4d45; }
.atena-polje__pomoc { color:#748784; font:600 13px/1.3 Inter, sans-serif; }
.atena-polje__napaka { margin:0; color:#b3433b; font:750 13px/1.25 Inter, sans-serif; }
.atena-polje[data-atena-error] { padding:7px; border:1px solid #d66a62; border-radius:12px; background:#fff7f6; }
.atena-izbire { display:grid; min-width:0; gap:5px; }
.stran--storitev .atena-izbira { display:grid; grid-template-columns:16.6px minmax(0,1fr); min-width:0; min-height:36.5px; padding:4.5px 6.5px; align-items:center; gap:5.8px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 34%, #c8d7e6); border-radius:10px; background:#fff; color:#2e4542; font:650 13px/1.2 Inter, sans-serif; text-align:left; }
.stran--storitev .atena-izbira[aria-pressed="true"] { border:2px solid var(--obrazec-barva); padding:3.5px 5.5px; background:color-mix(in srgb, var(--obrazec-ozadje) 72%, white); }
.stran--storitev .atena-izbira__krog { display:grid; width:16.6px; height:16.6px; place-items:center; border:1px solid color-mix(in srgb, var(--obrazec-barva) 38%, #aebfbd); border-radius:50%; color:transparent; }
.stran--storitev .atena-izbira__krog svg { width:10.8px; height:10.8px; }
.stran--storitev .atena-izbira[aria-pressed="true"] .atena-izbira__krog { border-color:var(--obrazec-barva); background:var(--obrazec-barva); color:#fff; }
.atena-znesek { display:grid; grid-template-columns:minmax(0,1fr) 42px; min-width:0; }
.atena-znesek input { height:44px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 40%, white); border-right:0; border-radius:11px 0 0 11px; padding:0 8px; box-sizing:border-box; }
.atena-znesek span { display:grid; min-height:44px; place-items:center; border:1px solid color-mix(in srgb, var(--obrazec-barva) 56%, white); border-left:0; border-radius:0 11px 11px 0; background:color-mix(in srgb, var(--obrazec-ozadje) 70%, white); color:var(--obrazec-barva); font:800 13px/1 Inter, sans-serif; }
.atena-kolicina { display:grid; grid-template-columns:44px minmax(52px,1fr) 44px minmax(92px,.9fr); min-width:0; gap:8px; }
.atena-kolicina button { min-height:44px; border-radius:11px !important; border:1px solid color-mix(in srgb, var(--obrazec-barva) 45%, white); background:color-mix(in srgb, var(--obrazec-ozadje) 64%, white); color:var(--obrazec-barva); font:800 18px/1 Inter, sans-serif; }
.atena-kolicina input { height:44px; border-radius:11px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 40%, white); text-align:center; box-sizing:border-box; }
.atena-hitre-izbire { display:grid; grid-template-columns:repeat(auto-fit, minmax(63px,1fr)); gap:5px; }
.atena-hitre-izbire button { min-height:36px; border-radius:10px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 36%, white); background:#fff; color:var(--obrazec-barva); font:700 13px/1.2 Inter, sans-serif; }
.atena-hitre-izbire button[aria-pressed="true"] { background:var(--obrazec-barva); color:#fff; }
.ponudba-obrazec .atena-lep-izbirnik { position:relative; width:100%; min-width:0; }
.ponudba-obrazec .atena-lep-izbirnik__gumb { display:grid; width:100%; min-width:0; min-height:44px; padding:0 10px 0 12px; grid-template-columns:minmax(0,1fr) 20px; align-items:center; gap:7px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 56%, white); border-radius:11px; background:linear-gradient(145deg,#fff,color-mix(in srgb, var(--obrazec-ozadje) 34%, white)); color:#263b39; font:650 14px/1.2 Inter, sans-serif; text-align:left; box-sizing:border-box; }
.ponudba-obrazec .atena-lep-izbirnik__gumb svg { width:18px; height:18px; fill:none; stroke:var(--obrazec-barva); stroke-width:2; }
.atena-dokument { display:grid; gap:7px; }
.atena-dokument__dodaj { display:grid; min-height:64px; place-items:center; border:1px dashed var(--obrazec-barva); border-radius:12px; background:color-mix(in srgb, var(--obrazec-ozadje) 40%, white); text-align:center; color:var(--obrazec-barva); font:700 13px/1.3 Inter, sans-serif; }
.atena-dokument__opomba { display:grid; gap:4px; color:var(--obrazec-barva); font:700 13px/1.2 Inter, sans-serif; }
.atena-dokument__opomba textarea { border:1px solid color-mix(in srgb, var(--obrazec-barva) 30%, white); border-radius:9px; padding:6px; font:500 13px/1.3 Inter, sans-serif; box-sizing:border-box; }
.atena-seznam { display:grid; gap:7px; }
.atena-seznam [data-atena-list-items] { display:flex; flex-wrap:wrap; gap:5px; }
.atena-seznam [data-atena-list-items] > span { display:inline-grid; grid-template-columns:minmax(0,1fr) 24px; min-height:32px; align-items:center; gap:4px; padding-left:9px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 28%, #d8e3e1); border-radius:9px; background:color-mix(in srgb, var(--obrazec-ozadje) 55%, white); color:#3b5350; font:650 13px/1.2 Inter, sans-serif; }
.atena-seznam__dodaj { display:grid; grid-template-columns:minmax(0,1fr) 64px; gap:6px; }
.atena-seznam__dodaj input { height:40px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 30%, white); border-radius:9px; padding:0 8px; box-sizing:border-box; }
.atena-seznam__dodaj button { border:1px solid var(--obrazec-barva); border-radius:9px; background:var(--obrazec-barva); color:#fff; font:700 13px/1.2 Inter, sans-serif; }
.atena-izbire--choice-grid, .atena-izbire--payment-method { grid-template-columns:repeat(2, minmax(0,1fr)); }
.atena-izbire--choice-segments { grid-template-columns:repeat(3, minmax(0,1fr)); }
.atena-izbire--choice-segments .atena-izbira { grid-template-columns:minmax(0,1fr); padding-inline:6px; text-align:center; }
.atena-izbire--choice-segments .atena-izbira__krog { display:none; }
.atena-znesek-enota { display:grid; grid-template-columns:minmax(0,1fr) auto; min-width:0; }
.atena-znesek-enota input { height:44px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 40%, white); border-radius:11px 0 0 11px; padding:0 8px; box-sizing:border-box; }
.atena-znesek-enota > div { display:grid; grid-template-columns:repeat(2, 44px); }
.atena-znesek-enota button { min-height:44px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 38%, #c8d7e6); background:#fff; color:var(--obrazec-barva); font:750 13px/1.15 Inter, sans-serif; }
.atena-znesek-enota button[aria-pressed="true"] { border-color:var(--obrazec-barva); background:var(--obrazec-barva); color:#fff; }
.atena-cas-par { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:7px; }
.atena-cas-par > label { display:grid; gap:4px; color:#516866; font:700 13px/1.2 Inter, sans-serif; }
.atena-cas-par__vnos { display:grid; grid-template-columns:minmax(0,1fr) minmax(82px,.8fr); gap:8px; }
.atena-cas-par__vnos input { height:44px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 40%, white); border-radius:11px; text-align:center; box-sizing:border-box; }
.atena-razpolozljivost { display:grid; gap:7px; }
.atena-razpolozljivost > label { display:grid; grid-template-columns:minmax(0,1fr) 62px; min-height:44px; align-items:center; gap:8px; padding:0 9px; border:1px solid color-mix(in srgb, var(--obrazec-barva) 35%, #c8d7e6); border-radius:11px; }
.atena-razpolozljivost input[type="range"] { width: 100%; height: 24px; margin: 0; appearance: none; -webkit-appearance: none; background: transparent; cursor: pointer; }
.atena-razpolozljivost input[type="range"]::-webkit-slider-runnable-track { height: 7px; border-radius: 999px; background: linear-gradient(90deg, color-mix(in srgb, var(--obrazec-barva) 22%, #fff), var(--obrazec-barva)); }
.atena-razpolozljivost input[type="range"]::-moz-range-track { height: 7px; border-radius: 999px; background: linear-gradient(90deg, color-mix(in srgb, var(--obrazec-barva) 22%, #fff), var(--obrazec-barva)); }
.atena-razpolozljivost input[type="range"]::-webkit-slider-thumb { width: 22px; height: 22px; margin-top: -7.5px; border: 3px solid #fff; border-radius: 50%; background: var(--obrazec-barva); box-shadow: 0 0 0 2px color-mix(in srgb, var(--obrazec-barva) 30%, transparent), 0 3px 8px rgba(31,105,102,.22); appearance: none; -webkit-appearance: none; }
.atena-razpolozljivost input[type="range"]::-moz-range-thumb { width: 16px; height: 16px; border: 3px solid #fff; border-radius: 50%; background: var(--obrazec-barva); box-shadow: 0 0 0 2px color-mix(in srgb, var(--obrazec-barva) 30%, transparent), 0 3px 8px rgba(31,105,102,.22); }
.atena-razpolozljivost output { color:var(--obrazec-barva); font:800 13px/1 Inter, sans-serif; text-align:right; }
`;

// Za TRETJI sistem (vrstice 127-133, prava zgodovina/cilj izkušnja) je tu
// ROČNO izluščen minimalen izsek iz app/neplacila-zgodovina.css (3119
// vrstic) — enak princip kot productionCss zgoraj. Barvne --*-rgb
// spremenljivke so poenostavljene: primeri neposredno nastavijo
// --vprasanje-rgb/--povzetek-rgb/--korak-rgb prek inline style namesto
// prek ~15 posrednih --zgodovina-<tip>-rgb spremenljivk iz prave datoteke.
const zgodovinaCss = `
.zgodovina-ai__vnos textarea { display:block; width:100%; min-height:90px; padding:10px 11px; resize:none; border:1px solid #c8dcda; border-radius:12px; box-sizing:border-box; color:#263b39; background:#fff; font:500 14px/1.42 Inter, sans-serif; }
.zgodovina-ai__akcije { display:grid; grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr); gap:7px; margin-top:8px; }
.zgodovina-ai__akcije button { min-width:0; min-height:42px; border:1px solid #8dc7c2; border-radius:12px; font:700 13px/1.2 Inter, sans-serif; }
.zgodovina-ai__snemaj { position:relative; display:flex; align-items:center; justify-content:center; gap:6px; padding:0 7px; color:#137f7d; background:#f4fbfa; }
.zgodovina-ai__snemaj svg { width:17px; height:17px; flex:0 0 17px; }
.zgodovina-ai__snemaj.is-recording { padding-inline:15px 52px; border-color:#d84f49; color:#fff; background:linear-gradient(135deg,#ef665f,#cf3f3a); box-shadow:0 7px 18px rgba(207,63,58,.2); }
.zgodovina-ai__glasnost { position:absolute; right:15px; top:50%; display:inline-flex; align-items:center; justify-content:center; gap:3px; width:27px; height:22px; transform:translateY(-50%); }
.zgodovina-ai__glasnost i { display:block; width:3px; height:calc(4px + 14px * var(--voice-bar,.5)); border-radius:999px; background:rgba(255,255,255,.95); }
.zgodovina-ai__razumi { padding:0 10px; border-color:#168f91; color:#fff; background:linear-gradient(145deg,#2caaa7,#0e8a8e); }

.zgodovina-ai-napredek { position:relative; display:flex; align-items:center; justify-content:space-between; gap:5px; margin:2px 3px 5px; }
.zgodovina-ai-napredek > i { position:absolute; z-index:0; right:22px; left:22px; top:50%; height:2px; transform:translateY(-50%); border-radius:2px; background:rgba(63,153,152,.22); }
.zgodovina-ai-napredek > button { position:relative; z-index:1; display:grid; place-items:center; width:44px; height:44px; flex:0 0 44px; padding:0; border:0; border-radius:50%; background:transparent; }
.zgodovina-ai-napredek > button > span { position:relative; z-index:1; display:grid; place-items:center; width:26px; height:26px; border:1px solid rgba(var(--korak-rgb,63,153,152),.38); border-radius:50%; box-sizing:border-box; color:rgb(var(--korak-rgb,63,153,152)); background:#fff; font-size: 13px; font-weight:800; }
.zgodovina-ai-napredek > button.is-completed > span,
.zgodovina-ai-napredek > button.is-current.is-completed > span { border-color:rgb(var(--korak-rgb,63,153,152)); color:#fff; background:rgb(var(--korak-rgb,63,153,152)); }
.zgodovina-ai-napredek > button.is-current > span { box-shadow:0 0 0 2px #fff, 0 0 0 4px rgb(var(--korak-rgb,63,153,152)); }
.zgodovina-ai-napredek > button.is-tone-povzetek > span { border:0; border-radius:8px; color:rgb(var(--korak-rgb,63,153,152)); background:transparent; box-shadow:none; }
.zgodovina-ai-napredek > button.is-tone-povzetek > span svg { width:24px; height:24px; }

.zgodovina-ai-stanje-dolga { display:grid; grid-template-columns:minmax(0,1fr) 1px minmax(0,1fr); align-items:stretch; min-width:0; margin:-1px 5px 5px; }
.zgodovina-ai-stanje-dolga__stolpec { display:grid; min-width:0; justify-items:center; align-content:center; gap:3px; padding:2px 7px 3px; }
.zgodovina-ai-stanje-dolga__stolpec > span { color:#748682; font-size: 13px; font-weight:700; letter-spacing:.045em; text-transform:uppercase; white-space:nowrap; }
.zgodovina-ai-stanje-dolga__stolpec > strong { max-width:100%; color:#18201f; font-size:14px; font-weight:800; white-space:nowrap; }
.zgodovina-ai-stanje-dolga__stolpec--preostanek > strong { color:#168d8b; }
.zgodovina-ai-stanje-dolga > i { width:1px; margin:2px 0; background:#cfe0dd; }

.zgodovina-ai-pogovor__opis { position:relative; display:block; width:100%; margin:0 0 10px; min-height:44px; padding:8px 36px 8px 10px; overflow-wrap:anywhere; border:1px solid rgba(var(--vprasanje-rgb,63,153,152),.22); border-radius:11px; color:#486360; background:#f8fbfa; font-size: 13px; line-height:1.35; text-align:left; }
.zgodovina-ai-pogovor__opis-svincnik { position:absolute; top:6px; right:7px; display:grid; width:22px; height:22px; place-items:center; border-radius:7px; color:rgb(var(--vprasanje-rgb,63,153,152)); background:rgba(var(--vprasanje-rgb,63,153,152),.1); }
.zgodovina-ai-pogovor__opis-svincnik svg { width:14px; height:14px; }

.zgodovina-ai-vprasanje { --vprasanje-rgb:63,153,152; position:relative; display:grid; grid-template-columns:30px minmax(0,1fr) auto; gap:7px; padding:10px; border:1px solid rgba(var(--vprasanje-rgb),.32); border-radius:13px; background:linear-gradient(145deg, rgba(var(--vprasanje-rgb),.075), #fff 68%); }
.zgodovina-ai-vprasanje__ikona { display:grid; place-items:center; align-self:start; width:30px; height:30px; border:1px solid rgba(var(--vprasanje-rgb),.2); border-radius:10px; color:rgb(var(--vprasanje-rgb)); background:rgba(var(--vprasanje-rgb),.13); }
.zgodovina-ai-vprasanje__ikona svg { width:18px; height:18px; }
.zgodovina-ai-vprasanje h4 { margin:1px 0 2px; color:#203f3c; font-size:13px; line-height:1.25; }
.zgodovina-ai-vprasanje p { margin:0; color:#788d89; font-size: 13px; line-height:1.3; }
.zgodovina-ai-vprasanje__spremeni { align-self:start; margin-right:12px; min-height:30px; padding:0 9px; border:1px solid rgba(var(--vprasanje-rgb),.34); border-radius:9px; color:rgb(var(--vprasanje-rgb)); background:rgba(255,255,255,.88); font:750 13px/1 Inter, sans-serif; }
.zgodovina-ai-vprasanje__odstrani { position:absolute; z-index:4; top:-9px; right:2px; display:grid; width:24px; height:24px; padding:0; place-items:center; border:2px solid #8a9795; border-radius:50%; box-sizing:border-box; color:#8a9795; background:#fff; box-shadow:0 2px 6px rgba(47,55,54,.14); }
.zgodovina-ai-vprasanje__odstrani svg { width:14px; height:14px; }
.zgodovina-ai-vprasanje label { display:block; grid-column:1 / -1; min-width:0; }
.zgodovina-ai-vprasanje__polja { display:grid; grid-column:1 / -1; gap:9px; min-width:0; }
.zgodovina-ai-vprasanje__polja label { display:grid; gap:4px; }
.zgodovina-ai-vprasanje__polja--placilo-kompaktno { grid-template-columns:repeat(2, minmax(0,1fr)); column-gap:7px; }
.zgodovina-ai-vprasanje__polja--placilo-kompaktno label.is-amount { grid-column:1; grid-row:1; }
.zgodovina-ai-vprasanje__polja--placilo-kompaktno label.is-payment-method { grid-column:2; grid-row:1; }
.zgodovina-ai-vprasanje__polja--placilo-kompaktno label.is-date { grid-column:1 / -1; grid-row:2; }

.zgodovina-ai-povzetki { display:grid; gap:6px; }
.zgodovina-ai-povzetek { --povzetek-rgb:63,153,152; display:grid; grid-template-columns:27px minmax(0,1fr) auto; gap:7px; align-items:center; min-width:0; min-height:54px; padding:9px 8px; border:1px solid rgba(var(--povzetek-rgb),.25); border-radius:11px; background:linear-gradient(145deg, rgba(var(--povzetek-rgb),.07), #fff 72%); }
.zgodovina-ai-povzetek > span { display:grid; place-items:center; color:rgb(var(--povzetek-rgb)); }
.zgodovina-ai-povzetek svg { width:20px; height:20px; }
.zgodovina-ai-povzetek strong { display:block; color:#2e403e; font-size: 13px; }
.zgodovina-ai-povzetek p { margin:2px 0 0; overflow-wrap:anywhere; color:#687e7a; font-size: 13px; line-height:1.3; }
.zgodovina-ai-povzetek__akcije { display:flex !important; gap:4px; align-items:center; color:rgb(var(--povzetek-rgb)); }
.zgodovina-ai-povzetek__akcije button { min-height:28px; padding:0 8px; border:0; border-radius:9px; color:rgb(var(--povzetek-rgb)); background:rgba(var(--povzetek-rgb),.1); font:750 13px/1 Inter, sans-serif; }
.zgodovina-ai-povzetek__akcije button:last-child { width:28px; padding:0; border-radius:50%; color:#7c908d; background:rgba(86,116,111,.08); font-size:17px; }

.zgodovina-ai-pogovor__potrditev { display:grid; grid-template-columns:32px minmax(0,1fr); gap:8px; align-items:center; margin:9px 0 7px; }
.zgodovina-ai-pogovor__potrditev > span { display:grid; place-items:center; width:32px; height:32px; border-radius:11px; color:#198b80; background:#e2f5ef; }
.zgodovina-ai-pogovor__potrditev svg { width:20px; height:20px; }
.zgodovina-ai-pogovor__potrditev h4 { margin:0 0 2px; color:#214340; font-size:13px; }
.zgodovina-ai-pogovor__potrditev p { margin:0; color:#748b87; font-size: 13px; }
`;

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// Živ primer za vsako vrstico po ID-ju — dejanski HTML, ki uporablja iste
// razrede kot pravi widgeti (glej NAZORJEVA-VRSTICE.js za vir vsakega).
const PRIMERI = {
  "ikonski-krog": `<div style="display:flex;gap:10px;">
    <span class="uj-card-icon-circle is-good"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20 6 9 17l-5-5"/></svg></span>
    <span class="uj-card-icon-circle is-warning"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></span>
    <span class="uj-card-icon-circle is-bad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></span>
  </div>`,
  "statusna-znacka": `<div class="uj-card-bullet__status is-bad" data-segment="status-badge">
    <span class="uj-card-icon-circle is-bad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></span>
    <span><b>Pred podpisom razjasnite</b><small>Ta ugotovitev zahteva pisen odgovor ponudnika</small></span>
  </div>`,
  "info-okvir": `<div class="uj-card-info-box" data-segment="info-box">
    <span class="uj-card-icon-circle is-neutral"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></svg></span>
    <div class="uj-card-info-box__content"><b>Kaj smo našli</b><p>V ponudbi je zapisano: „100 % zneska plačate ob podpisu.“</p></div>
  </div>`,
  "primarni-gumb": `<button type="button" class="uj-answer-card__save is-saved"><span>Poglej vprašanje za ponudnika</span></button>`,
  "obarvana-vrstica-povzetka": `<p class="uj-card-live is-bad">Pred podpisom razjasnite pri ponudniku, kaj se zgodi, če dela ne dokonča.</p>`,
  "gumb-ponastavi": `<button type="button" class="uj-card-reset"><span>↺</span> Ponastavi</button>`,
  "krozna-ikona-v-vrstici": `<div class="uj-card-trend__hint"><span aria-hidden="true">✓</span><b>Manjši krog, ista barva teme</b></div>`,
  "vrstica-pregleda-z-urejanjem": `<div class="uj-card-review" data-review-card><div data-review-row><span>Cena</span><b data-review-value>1.342 €</b><input type="text" value="1.342 €" hidden aria-label="Uredite: Cena"><button type="button" data-review-edit>Uredi</button></div></div>`,
  "polje-z-oznako": `<div class="uj-card-field"><span class="uj-card-label">Osnovna cena</span><input type="text" value="1.342 €" style="height:40px;border:1px solid rgba(65,163,162,.3);border-radius:8px;padding:0 8px;"></div>`,
  "skupina-izbirnih-gumbov": `<div class="uj-card-choices uj-card-choices--three">
    <button type="button" class="is-selected"><span>Izvajalec</span></button>
    <button type="button"><span>Prodajalec</span></button>
    <button type="button"><span>Posrednik</span></button>
  </div>`,
  "radijski-krozec": `<div class="uj-card-choice-list"><button type="button" class="is-selected"><span class="uj-card-radio"></span><span>Naša povpraševanje</span></button><button type="button"><span class="uj-card-radio"></span><span>Priporočilo</span></button></div>`,
  "denarno-polje": `<label class="uj-card-money"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span><input type="text" value="1.342"><b>€</b></label>`,
  "stepper-nadzor": `<div class="uj-card-stepper" data-card-stepper><button type="button" data-step="-1" aria-label="Zmanjšaj">−</button><input type="number" value="4" min="0"><span style="display:grid;place-items:center;border:1px solid rgba(65,163,162,.38);border-radius:11px;font-size: 13px;">dni</span><button type="button" data-step="1" aria-label="Povečaj">+</button></div>`,
  "drsnik-z-izpisom": `<div class="uj-card-range"><output data-range-output>62 %</output><input type="range" min="0" max="100" value="62"></div>`,
  "datum-z-bliznjicami": `<div class="uj-card-date" data-card-date><input type="date" aria-label="Datum"><button type="button" data-date-mode="unknown" aria-pressed="false">Ne vem</button><button type="button" data-date-mode="approximate" aria-pressed="false">Približno</button></div><input class="uj-card-date-approx" type="text" placeholder="Npr. začetek oktobra 2026" hidden>`,
  "obmocje-nalaganja": `<div class="uj-card-upload"><label><input type="file" tabindex="-1"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 21h14"/></svg></span><b>Naložite dokazilo</b><small>PDF, JPG ali PNG</small></label></div>`,
  "iskalni-spustni-seznam": `<div class="uj-card-combobox" data-combobox><label><input type="text" value="gradbeni" data-combo-input role="combobox" aria-expanded="true" aria-autocomplete="list"></label><div data-combo-options><button type="button" role="option" aria-selected="false" data-combo-option="Gradbeni material"><span>Gradbeni material</span><small>Baustoffhandel</small></button><button type="button" role="option" aria-selected="false" data-combo-option="Gradbena kemija"><span>Gradbena kemija</span><small>Farbenhandel</small></button><p data-combo-empty hidden>Ni zadetkov. Uporabite vpisano ime.</p></div><button type="button" class="uj-card-combobox__manual" data-combo-manual hidden>Uporabi vpisano ime</button><div class="uj-card-combobox__selected" data-combo-selected hidden><span>Izbrano</span><b></b><button type="button" data-combo-clear aria-label="Odstrani izbor">×</button></div></div>`,
  "izbirni-zetoni": `<div class="uj-card-tags" data-tag-picker><div class="uj-card-tags__bank"><button type="button" data-tag-option="Lokalno" aria-pressed="true" class="is-selected">Lokalno</button><button type="button" data-tag-option="Hitro" aria-pressed="false">Hitro</button><button type="button" data-tag-option="Premium" aria-pressed="false">Premium</button></div><div class="uj-card-tags__selected" data-tag-selected><span data-tag-value="Lokalno">Lokalno<button type="button" data-tag-remove aria-label="Odstrani oznako">×</button></span></div><div class="uj-card-tags__add"><input type="text" placeholder="Vpišite svojo oznako" maxlength="24"><button type="button" data-tag-add>Dodaj</button></div></div>`,
  "kontrolni-seznam-z-napredkom": `<div class="uj-card-checklist" data-checklist><div class="uj-card-checklist__progress"><span><i data-check-progress style="display:block;height:100%;width:50%;border-radius:inherit;"></i></span><b data-check-output>2 od 4</b></div><button type="button" data-check-item class="is-done" aria-pressed="true"><i>✓</i><span>Pisna ponudba</span></button><button type="button" data-check-item aria-pressed="false"><i></i><span>Reference izvajalca</span></button></div>`,
  "razvrstitev-v-tri-skupine": `<div class="uj-card-inclusion"><div data-inclusion-row><span>Fotografija napredka</span><div>
    <button type="button" data-inclusion-choice="included" class="is-selected"><span>✓</span><b>Vključeno</b></button>
    <button type="button" data-inclusion-choice="extra"><span>✓</span><b>Doplačilo</b></button>
    <button type="button" data-inclusion-choice="excluded"><span>✓</span><b>Ni vključeno</b></button>
  </div></div></div>`,
  "spustni-meni-po-meri": `<div class="uj-card-condition__select uj-card-condition__select--simple" style="max-width:220px;" data-condition-select><button type="button" data-condition-toggle data-condition-label="Pogostost" aria-haspopup="listbox" aria-expanded="false" aria-label="Pogostost: Mesečno"><span data-condition-select-value>Mesečno</span><i aria-hidden="true"></i></button><div data-condition-menu role="listbox" aria-label="Pogostost" hidden><button type="button" role="option" data-condition-choice="tedensko" aria-selected="false">Tedensko</button><button type="button" role="option" data-condition-choice="mesecno" aria-selected="true" class="is-selected">Mesečno</button><button type="button" role="option" data-condition-choice="letno" aria-selected="false">Letno</button></div><input type="hidden" data-condition-field value="mesecno"></div>`,
  "casovnica-korakov": `<div class="uj-card-timeline" data-card-timeline>
    <button type="button" data-timeline-step class="is-done" aria-pressed="true"><i>✓</i><span>Ponudba</span><small>3. sep</small></button>
    <button type="button" data-timeline-step class="is-current" aria-pressed="true"><i>2</i><span>Pregled</span><small>danes</small></button>
    <button type="button" data-timeline-step aria-pressed="false"><i>3</i><span>Podpis</span><small>—</small></button>
    <button type="button" data-timeline-step aria-pressed="false"><i>4</i><span>Zaključek</span><small>—</small></button>
  </div>`,
  "vrstica-prioritete": `<ul class="uj-card-priority"><li><b>1</b><span>Razjasni predplačilo</span><span><button type="button">↑</button><button type="button">↓</button></span></li></ul>`,
  "ikonski-vnos": `<label class="uj-card-icon-input"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span><input type="text" value="gradbeni material" style="height:44px;width:100%;border:1px solid rgba(65,163,162,.3);border-radius:8px;box-sizing:border-box;"></label>`,
  "mini-koledar": (function () {
    var days = [27,28,29,30,31,1,2,3,4,5,6,7,8,9];
    return '<div class="uj-card-calendar" data-mini-calendar data-month-index="0"><div class="uj-card-calendar__nav"><button type="button" data-calendar-shift="-1" aria-label="Prejšnji mesec">‹</button><strong data-calendar-month>September 2026</strong><button type="button" data-calendar-shift="1" aria-label="Naslednji mesec">›</button></div><div class="uj-card-calendar__week">' + ["P","T","S","Č","P","S","N"].map(function (d) { return "<span>" + d + "</span>"; }).join("") + '</div><div class="uj-card-calendar__days">' + days.map(function (day, index) { return '<button type="button" data-calendar-day="' + day + '" aria-pressed="' + String(day === 4) + '" class="' + (index < 5 ? "is-muted " : "") + (day === 4 ? "is-selected" : "") + '">' + day + "</button>"; }).join("") + '</div><p>Izbrano: <b data-calendar-output>4. september 2026</b></p></div>';
  })(),
  "ostevilcen-korak-naslov": `<h3 style="display:flex;align-items:center;gap:8px;font-size: 13px;margin:0;"><span style="display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:rgb(65,163,162);color:#fff;font-size: 13px;font-weight:800;">1</span>Od kod je podatek?</h3>`,
  "glava-modula-produkcija": `<div class="ponudba-obrazec__glava" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;">
    <span class="ponudba-obrazec__glava-ikona"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span>
    <div class="ponudba-obrazec__glava-besedilo"><h2>Predmet ponudbe</h2></div>
  </div>`,
  "koraki-napredka-produkcija": `<div class="ponudba-obrazec__koraki" style="--obrazec-barva:#27968b;">
    <button type="button" class="ponudba-obrazec__korak is-koncan"><span>✓</span></button>
    <button type="button" class="ponudba-obrazec__korak is-koncan"><span>2</span></button>
    <button type="button" class="ponudba-obrazec__korak"><span>3</span></button>
    <button type="button" class="ponudba-obrazec__korak"><span>4</span></button>
  </div>`,
  "checkbox-moznost-produkcija": `<div style="display:grid;gap:6px;--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;">
    <label class="ponudba-obrazec__moznost"><input type="checkbox" checked><span class="ponudba-obrazec__krog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>Izvajalec</span></label>
    <label class="ponudba-obrazec__moznost"><input type="checkbox"><span class="ponudba-obrazec__krog"></span><span>Posrednik</span></label>
  </div>`,
  "vrstica-potrditve-produkcija": `<div class="ponudba-obrazec__potrditev" style="--obrazec-barva:#27968b;"><span>Cena</span><strong>1.342 €</strong></div>`,
  "okvir-podrocja-produkcija": `<div style="display:grid;gap:6px;">
    <div class="ponudba-obrazec__podrocje" style="--podrocje-barva:#c78c2c;--podrocje-ozadje:#fff8e9;"><span class="ponudba-obrazec__podrocje-ikona"><svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span><div class="ponudba-obrazec__podrocje-besedilo"><b>Cena in stroški</b><small>DDV, dodatki in realna skupna cena</small></div></div>
    <div class="ponudba-obrazec__podrocje" style="--podrocje-barva:#27968b;--podrocje-ozadje:#eef9f7;"><span class="ponudba-obrazec__podrocje-ikona"><svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/></svg></span><div class="ponudba-obrazec__podrocje-besedilo"><b>Obseg ponudbe</b><small>Kaj je vključeno in kaj morate zagotoviti vi</small></div></div>
  </div>`,
  "polje-produkcija": `<div class="atena-polje" style="--obrazec-barva:#27968b;"><span class="atena-polje__oznaka">Osnovna cena <b>*</b></span><input type="text" value="1.342 €" style="height:40px;border:1px solid #d8e3e1;border-radius:8px;padding:0 8px;box-sizing:border-box;"><small class="atena-polje__pomoc">Cena brez dodatnih stroškov</small></div>`,
  "izbirni-gumb-produkcija": `<div class="stran--storitev atena-izbire" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;grid-template-columns:1fr 1fr;">
    <button type="button" class="atena-izbira" aria-pressed="true"><span class="atena-izbira__krog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>Izvajalec</span></button>
    <button type="button" class="atena-izbira" aria-pressed="false"><span class="atena-izbira__krog"></span><span>Posrednik</span></button>
  </div>`,
  "denarni-vnos-produkcija": `<label class="atena-znesek" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><input type="text" value="1.342"><span>€</span></label>`,
  "kolicinski-nadzor-produkcija": `<div class="atena-kolicina" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><button type="button">−</button><input type="number" value="4" readonly><button type="button">+</button><div class="ponudba-obrazec atena-lep-izbirnik" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><button type="button" class="atena-lep-izbirnik__gumb"><span>dni</span><svg viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"/></svg></button></div></div>`,
  "hitre-izbire-produkcija": `<div class="atena-hitre-izbire" style="--obrazec-barva:#27968b;"><button type="button" aria-pressed="false">Ne vem</button><button type="button" aria-pressed="true">Približno</button><button type="button" aria-pressed="false">Enkratno</button></div>`,
  "lep-izbirnik-produkcija": `<div class="ponudba-obrazec" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><div class="atena-polje atena-polje--polno atena-polje--dropdown" data-atena-field-root data-atena-field-id="90037" data-atena-interaction="dropdown"><input type="hidden" data-ponudba-field="90037" value="obrok"><div class="atena-lep-izbirnik" data-atena-select><select hidden tabindex="-1" aria-hidden="true" data-atena-select-source data-atena-value aria-label="Način plačila"><option value="">Izberite možnost</option><option value="enkratno">Enkratno plačilo</option><option value="obrok" selected>Mesečni obrok</option><option value="polog">Polog + doplačilo</option></select><button type="button" class="atena-lep-izbirnik__gumb" data-atena-select-toggle role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="atena-select-90037-value" aria-label="Način plačila: Mesečni obrok"><span data-atena-select-label>Mesečni obrok</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg></button><div class="atena-lep-izbirnik__meni" id="atena-select-90037-value" data-atena-select-menu role="listbox" aria-label="Način plačila" hidden><button type="button" class="atena-lep-izbirnik__izbira" role="option" tabindex="-1" data-atena-select-option="" aria-selected="false">Izberite možnost</button><button type="button" class="atena-lep-izbirnik__izbira" role="option" tabindex="-1" data-atena-select-option="enkratno" aria-selected="false">Enkratno plačilo</button><button type="button" class="atena-lep-izbirnik__izbira is-selected" role="option" tabindex="-1" data-atena-select-option="obrok" aria-selected="true">Mesečni obrok</button><button type="button" class="atena-lep-izbirnik__izbira" role="option" tabindex="-1" data-atena-select-option="polog" aria-selected="false">Polog + doplačilo</button></div></div></div></div>`,
  "nalaganje-dokumenta-produkcija": `<div class="atena-polje atena-polje--polno atena-polje--dokument" data-atena-field-root data-atena-field-id="90038" data-atena-interaction="document-upload" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><input type="hidden" data-ponudba-field="90038" value=""><div class="atena-dokument" data-atena-composite><label class="atena-dokument__dodaj"><input type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.heic,.txt" data-atena-file-input><span><b>＋ Dodajte dokument</b><small>PDF, fotografija ali datoteka</small></span></label><div class="atena-dokument__datoteke" data-atena-file-list hidden><span data-atena-file-summary></span><button type="button" data-atena-file-remove aria-label="Odstrani dokument">Odstrani</button></div><label class="atena-dokument__opomba">Kaj dokazilo potrjuje?<textarea rows="2" data-atena-file-note placeholder="Dodajte kratko povezavo z dejstvom"></textarea></label></div></div>`,
  "seznam-zetonov-produkcija": `<div class="atena-polje atena-polje--polno atena-polje--seznam" data-atena-field-root data-atena-field-id="90039" data-atena-interaction="list-builder" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><input type="hidden" data-ponudba-field="90039" value="Dostava do 3. nadstropja"><div class="atena-seznam" data-atena-composite><div data-atena-list-items><span>Dostava do 3. nadstropja<button type="button" data-atena-list-remove="0" aria-label="Odstrani Dostava do 3. nadstropja">×</button></span></div><div class="atena-seznam__dodaj"><input type="text" data-atena-list-input placeholder="Dodajte postavko"><button type="button" data-atena-list-add>Dodaj</button></div></div></div>`,
  "korak-naslov-kompakten": `<p class="uj-card-cascade__step"><b>1</b>Kaj je narobe?</p>`,
  "postopno-odklenjena-skupina": `<div class="uj-card-cascade__guards is-locked"><button type="button" data-cascade-guard disabled><b>Pokličem dobavitelja</b></button><button type="button" data-cascade-guard disabled class="is-selected"><b>Zahtevam nov rok</b></button><button type="button" data-cascade-guard disabled><b>Poiščem drugo rešitev</b></button></div>`,
  "izbirni-gumb-z-rezultatom": `<div class="uj-card-expected__actions"><button type="button" class="is-selected"><b>Opomin</b><small>pribl. 2.200 €</small></button><button type="button"><b>Obroki</b><small>pribl. 3.416 €</small></button><button type="button"><b>Odvetnik</b><small>pribl. 3.780 €</small></button></div>`,
  "drsnik-s-tocnim-vnosom": `<div class="uj-card-expected__params" data-expected-atomic><div data-expected-param><div><b>Možnost, da uspe</b><output data-atomic-output>60 %</output></div><input type="range" min="0" max="100" value="60" data-atomic-range><label><input type="number" value="60" data-atomic-number><span>%</span></label></div></div>`,
  "oznaka-z-zivo-potrditvijo": `<div class="uj-card-field__heading"><span class="uj-card-label">Izberite ali vnesite trajanje</span><span class="uj-card-selection-note">Izbrano: <b>12 mesecev</b></span></div>`,
  "stevilcna-izbira-s-prostim-vnosom": `<div class="uj-card-choices uj-card-number-choices" data-card-choice-group><button type="button"><span>Ne vem</span></button><button type="button"><span>Brez</span></button><button type="button" class="is-selected"><span>12</span></button><button type="button"><span>24</span></button><button type="button"><span>36</span></button><label class="uj-card-number-custom"><input type="text" inputmode="decimal" maxlength="4" placeholder="Vnesi"></label></div>`,
  "denar-z-lokalnim-stikalom-enote": `<div class="uj-card-value-switch"><label class="uj-card-money"><input type="text" inputmode="decimal" value="30" readonly><b>%</b></label><div class="uj-card-choices uj-card-segment uj-card-segment--unit" data-card-choice-group><button type="button"><span>Znesek</span></button><button type="button" class="is-selected"><span>Odstotek</span></button></div></div>`,
  "prost-seznam-z-dodajanjem": `<div class="uj-card-list" data-card-list><div class="uj-card-list__items"><span>Jasen rok izvedbe<button type="button" data-list-remove aria-label="Odstrani">×</button></span></div><div class="uj-card-list__add"><input type="text" placeholder="Dodajte postavko"><button type="button" data-list-add>Dodaj</button></div></div>`,
  "pogojno-razkrito-polje": `<label class="uj-card-other">Opišite drugo možnost<input type="text" placeholder="Vpišite način prvega stika"></label>`,
  "drsnik-s-segmentno-vrstico": `<div class="uj-card-range" data-range-panel><div class="uj-card-range__readout"><span>Dogovorjena razpoložljivost</span><output data-range-output>99,5 %</output></div><div class="uj-card-range__bars" data-range-bars aria-hidden="true"><span class="is-active"></span><span class="is-active"></span><span class="is-active"></span><span class="is-active"></span><span class="is-active"></span><span class="is-active"></span><span class="is-active"></span><span class="is-active"></span><span class="is-active"></span><span class="is-active"></span><span class="is-active"></span><span></span></div><input type="range" min="90" max="100" step="0.1" value="99.5"><div class="uj-card-range__ticks"><span>90 %</span><span>95 %</span><span>100 %</span></div></div>`,
  "tedenska-mreza-terminov": `<div class="uj-card-week"><div class="uj-card-week__head"><span></span><b>Pon</b><b>Tor</b><b>Sre</b><b>Čet</b><b>Pet</b><b>Sob</b><b>Ned</b></div><div class="uj-card-week__row"><span>8–12</span><button type="button"><span class="sr-only">Pon</span></button><button type="button" class="is-selected"><span class="sr-only">Tor</span></button><button type="button"><span class="sr-only">Sre</span></button><button type="button" class="is-selected"><span class="sr-only">Čet</span></button><button type="button"><span class="sr-only">Pet</span></button><button type="button"><span class="sr-only">Sob</span></button><button type="button"><span class="sr-only">Ned</span></button></div><p>Izbrano: <b>3 termini</b></p></div>`,
  "ocenjevalni-seznam-s-povprecjem": `<div class="uj-card-score"><div class="uj-card-score__summary"><span>Skupna ocena</span><output>3,7</output><small>/ 5</small></div><div class="uj-card-score__row"><span>Cena</span><button type="button">−</button><input type="number" value="4"><button type="button">+</button></div><div class="uj-card-score__row"><span>Kakovost</span><button type="button">−</button><input type="number" value="4"><button type="button">+</button></div></div>`,
  "dvojni-drsnik-primerjave": `<div class="uj-card-change__row is-selected" data-change-row data-change-kind="price"><div class="uj-card-change__head"><b>Cena</b><span class="uj-card-change__values"><small><em>Prej</em><b data-change-from-value>1.500 €</b></small><small class="is-now"><em>Zdaj</em><strong data-change-value>1.320 €</strong></small></span></div><div class="uj-card-change__slider" style="--change-from:70%;--change-to:52%;--change-start:52%;--change-width:18%"><span aria-hidden="true"><b></b></span><input type="range" min="800" max="1800" value="1500" data-change-input data-change-role="from"><input type="range" min="800" max="1800" value="1320" data-change-input data-change-role="now" class="is-active"></div></div>`,
  "casovna-tocka-vrstica-s-podrobnostmi": `<div class="uj-card-threshold" data-threshold-card><div class="uj-card-threshold__plot" data-threshold-list><button type="button" data-threshold-point data-breach="false" data-threshold-detail="Odgovor: 3 dni, 2 dni hitreje" aria-label="Odgovor: 3 dni, 2 dni hitreje" aria-pressed="false"><span class="uj-card-threshold__date">3. 8.</span><span class="uj-card-threshold__plain"><b>Odgovor: 3 dni</b><small>2 dni hitreje</small></span></button><button type="button" data-threshold-point data-breach="true" data-threshold-detail="Odgovor: 8 dni, 3 dni prepozno" aria-label="Odgovor: 8 dni, 3 dni prepozno" aria-pressed="true" class="is-selected"><span class="uj-card-threshold__date">23. 8.</span><span class="uj-card-threshold__plain"><b>Odgovor: 8 dni</b><small>3 dni prepozno</small></span></button></div><p class="uj-card-live" data-threshold-output aria-live="polite">Odgovor: 8 dni, 3 dni prepozno</p></div>`,
  "dvostebricna-statistika": `<div class="uj-card-threshold__summary"><span><small>Zamujeni odgovori</small><b>2 od 6</b><em>sta prišla po dogovorjenem roku</em></span><span><small>Dogovorjeni rok</small><b>5 dni</b><em>dlje pomeni zamudo</em></span></div>`,
  "izbor-dni-v-tednu": `<div class="uj-card-recurrence__days"><button type="button" class="is-selected">Pon</button><button type="button">Tor</button><button type="button" class="is-selected">Sre</button><button type="button">Čet</button><button type="button">Pet</button><button type="button">Sob</button><button type="button">Ned</button></div>`,
  "drsnik-z-izhodiscem": `<div class="uj-card-sensitivity" data-sensitivity data-base="12000"><div class="uj-card-sensitivity__row is-neutral" data-sensitivity-row data-sensitivity-label="Cena materiala"><div class="uj-card-sensitivity__head"><b>Cena materiala</b><output data-sensitivity-value>0 €</output></div><div class="uj-card-sensitivity__controls"><div class="uj-card-sensitivity__track"><input type="range" min="-30" max="30" value="0" data-sensitivity-range style="--sensitivity-start:50%;--sensitivity-end:50%;--sensitivity-fill:#9aa9a6"><span aria-hidden="true">0</span></div><output data-sensitivity-number>0 %</output></div></div><p data-sensitivity-summary aria-live="polite">Cena ostane enaka · ocena 12.000 €</p></div>`,
  "dodajanje-nove-moznosti-v-skupino": `<div class="uj-card-scenario__presets" data-standalone-scenario-presets><button type="button" data-standalone-scenario-preset>Optimistično</button><button type="button" data-standalone-scenario-preset class="is-selected">Realno</button><button type="button" data-standalone-scenario-preset>Stresno</button><button type="button" data-standalone-scenario-add>+ Dodaj scenarij</button></div><div class="uj-card-scenario__new" data-standalone-scenario-form hidden><input type="text" placeholder="Ime scenarija" data-standalone-scenario-name><button type="button" data-standalone-scenario-create>Dodaj</button><button type="button" data-standalone-scenario-cancel>Prekliči</button><small>Uporabljene bodo spodnje vrednosti.</small></div>`,
  "tockovni-niz-z-visino-in-mejo": `<div class="uj-card-probability__plot" style="--threshold-ratio:50%"><i style="--day-height:20%"><span>4 dni</span></i><i style="--day-height:35%"><span>7 dni</span></i><i style="--day-height:50%"><span>10 dni</span></i><i class="is-over" style="--day-height:55%"><span>11 dni</span></i><i class="is-over" style="--day-height:80%"><span>16 dni</span></i></div>`,
  "mrezna-celica-s-tremi-pikami": `<div class="uj-card-heatmap__week"><span>T1</span><button type="button" data-standalone-heat-cell data-load="0" aria-label="Prosto. Klik spremeni stopnjo zasedenosti."><span data-heat-mark aria-hidden="true"><i></i><i></i><i></i></span></button><button type="button" data-standalone-heat-cell data-load="1" aria-label="Malo dela. Klik spremeni stopnjo zasedenosti."><span data-heat-mark aria-hidden="true"><i></i><i></i><i></i></span></button><button type="button" data-standalone-heat-cell data-load="2" aria-label="Srednje zasedeno. Klik spremeni stopnjo zasedenosti."><span data-heat-mark aria-hidden="true"><i></i><i></i><i></i></span></button><button type="button" data-standalone-heat-cell data-load="3" aria-label="Zelo zasedeno. Klik spremeni stopnjo zasedenosti."><span data-heat-mark aria-hidden="true"><i></i><i></i><i></i></span></button></div>`,
  "verizni-koraki-z-odklepanjem": `<div class="uj-card-dependencies" data-dependencies><div class="uj-card-dependencies__graph"><button type="button" data-dependency-node data-dep-id="documents" data-dep-step="1" data-dep-requires="" aria-pressed="false" aria-disabled="false" aria-current="step" class="is-current"><span>1</span><b>Dokumenti</b><small>Potrdi, ko je urejeno</small></button><button type="button" data-dependency-node data-dep-id="contact" data-dep-step="2" data-dep-requires="documents" aria-pressed="false" aria-disabled="false" class="is-future"><span>2</span><b>Kontakt</b><small>Sledi potem</small></button><button type="button" data-dependency-node data-dep-id="reminder" data-dep-step="3" data-dep-requires="contact" aria-pressed="false" aria-disabled="false" class="is-future"><span>3</span><b>Opomin</b><small>Sledi potem</small></button></div><p class="uj-card-live" data-dependency-summary aria-live="polite">Najprej uredite in potrdite: Dokumenti</p></div>`,
  "priporocilo-vrednosti": `<div class="uj-card-plane__recommendation"><span><small>Priporočen največji popust</small><b>10 %</b></span><em>plača v roku · 14 dni</em></div>`,
  "zmogljivostna-vrstica-s-trakom": `<div class="uj-card-capacity" data-capacity><div class="uj-card-capacity__step"><h3><span>1</span>Izberite delo</h3><div class="uj-card-capacity__tasks" role="group" aria-label="Izberite delo"><button type="button" data-capacity-task="assembly" data-capacity-hours="6" data-capacity-team="a" aria-pressed="false"><b>Montaža</b><small>6 h</small></button><button type="button" data-capacity-task="testing" data-capacity-hours="4" data-capacity-team="a" aria-pressed="false"><b>Testiranje</b><small>4 h</small></button><button type="button" data-capacity-task="docs" data-capacity-hours="3" data-capacity-team="b" aria-pressed="false"><b>Dokumentacija</b><small>3 h</small></button></div></div><div class="uj-card-capacity__step"><h3><span>2</span>Izberite ekipo</h3><div class="uj-card-capacity__lanes"><div data-capacity-lane="a" data-capacity-max="12"><span class="uj-card-capacity__team"><b>Ekipa A</b><small data-capacity-status>2 h prosto</small></span><i data-capacity-bar aria-hidden="true"><em style="width:83.33333333333334%"></em></i><button type="button" data-capacity-target="a" aria-label="Premakni izbrano delo v Ekipa A">Izberi</button></div><div data-capacity-lane="b" data-capacity-max="8"><span class="uj-card-capacity__team"><b>Ekipa B</b><small data-capacity-status>5 h prosto</small></span><i data-capacity-bar aria-hidden="true"><em style="width:37.5%"></em></i><button type="button" data-capacity-target="b" aria-label="Premakni izbrano delo v Ekipa B">Izberi</button></div><div data-capacity-lane="c" data-capacity-max="6"><span class="uj-card-capacity__team"><b>Ekipa C</b><small data-capacity-status>6 h prosto</small></span><i data-capacity-bar aria-hidden="true"><em style="width:0%"></em></i><button type="button" data-capacity-target="c" aria-label="Premakni izbrano delo v Ekipa C">Izberi</button></div></div></div><p class="uj-card-live" data-capacity-summary aria-live="polite">Izberite delo, nato ekipo.</p></div>`,
  "barvno-ujemanje-dveh-stolpcev": `<div class="uj-card-matching" data-matching><div class="uj-card-matching__columns"><section><h3><span>1</span>Pogoj</h3><button type="button" style="--match-rgb:231,126,0" data-match-claim="cena" data-match-label="Cena z DDV" data-match-correct="cena" data-match-tone="231,126,0" aria-pressed="false">Cena z DDV</button><button type="button" style="--match-rgb:47,136,224" data-match-claim="rok" data-match-label="Rok 21 dni" data-match-correct="rok" data-match-tone="47,136,224" aria-pressed="false">Rok 21 dni</button></section><section><h3><span>2</span>Dokazilo</h3><button type="button" style="--match-rgb:231,126,0" data-match-evidence="cena" data-match-label="Podpisana ponudba" data-match-tone="231,126,0" aria-pressed="false">Podpisana ponudba</button><button type="button" style="--match-rgb:47,136,224" data-match-evidence="rok" data-match-label="Terminski načrt" data-match-tone="47,136,224" aria-pressed="false">Terminski načrt</button></section></div><p class="uj-card-live" data-match-summary aria-live="polite">Izberite pogoj, nato pravo dokazilo.</p></div>`,
  "pogojna-vrstica-pravila": `<div class="uj-card-condition__rows"><div data-condition-row><b class="uj-card-condition__number">1</b><div class="uj-card-condition__select" data-condition-select><button type="button" data-condition-toggle data-condition-label="Kaj preverjamo" aria-haspopup="listbox" aria-expanded="false" aria-label="Kaj preverjamo: Zamuda"><span data-condition-select-value>Zamuda</span><i aria-hidden="true"></i></button><div data-condition-menu role="listbox" aria-label="Kaj preverjamo" hidden><button type="button" role="option" data-condition-choice="zamuda" aria-selected="true" class="is-selected">Zamuda</button><button type="button" role="option" data-condition-choice="znesek" aria-selected="false">Znesek</button><button type="button" role="option" data-condition-choice="odziv" aria-selected="false">Odziv</button></div><input type="hidden" data-condition-field value="zamuda"></div><div class="uj-card-condition__select" data-condition-select><button type="button" data-condition-toggle data-condition-label="Primerjava" aria-haspopup="listbox" aria-expanded="false" aria-label="Primerjava: več kot"><span data-condition-select-value>več kot</span><i aria-hidden="true"></i></button><div data-condition-menu role="listbox" aria-label="Primerjava" hidden><button type="button" role="option" data-condition-choice="nad" aria-selected="true" class="is-selected">več kot</button><button type="button" role="option" data-condition-choice="pod" aria-selected="false">manj kot</button><button type="button" role="option" data-condition-choice="enako" aria-selected="false">točno</button></div><input type="hidden" data-condition-operator value="nad"></div><label><input type="number" value="15" data-condition-value><b data-condition-unit>dni</b></label></div></div>`,
  "izbirna-mreza-produkcija": `<div class="stran--storitev atena-izbire atena-izbire--choice-grid" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><button type="button" class="atena-izbira"><span class="atena-izbira__krog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>Prva možnost</span></button><button type="button" class="atena-izbira" aria-pressed="true"><span class="atena-izbira__krog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>Druga možnost</span></button><button type="button" class="atena-izbira"><span class="atena-izbira__krog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>Tretja</span></button><button type="button" class="atena-izbira"><span class="atena-izbira__krog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>Četrta</span></button></div>`,
  "izbirni-segmenti-produkcija": `<div class="stran--storitev atena-izbire atena-izbire--choice-segments" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><button type="button" class="atena-izbira"><span class="atena-izbira__krog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>Gotovina</span></button><button type="button" class="atena-izbira" aria-pressed="true"><span class="atena-izbira__krog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>Nakazilo</span></button><button type="button" class="atena-izbira"><span class="atena-izbira__krog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>Kartica</span></button></div>`,
  "denar-ali-odstotek-produkcija": `<div class="atena-znesek-enota" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><input type="text" inputmode="decimal" value="20" placeholder="0,00"><div role="group" aria-label="Enota"><button type="button" aria-pressed="false">€</button><button type="button" aria-pressed="true">%</button></div></div>`,
  "dvojno-trajanje-produkcija": `<div class="atena-cas-par" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><label><span>Odziv</span><span class="atena-cas-par__vnos"><input type="number" value="2"><div class="ponudba-obrazec atena-lep-izbirnik" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><button type="button" class="atena-lep-izbirnik__gumb"><span>ur</span><svg viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"/></svg></button></div></span></label><label><span>Odprava</span><span class="atena-cas-par__vnos"><input type="number" value="5"><div class="ponudba-obrazec atena-lep-izbirnik" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><button type="button" class="atena-lep-izbirnik__gumb"><span>dni</span><svg viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"/></svg></button></div></span></label></div>`,
  "razpolozljivost-preklopni-nacin-produkcija": `<div class="atena-razpolozljivost" style="--obrazec-barva:#27968b;--obrazec-ozadje:#eef9f7;"><div class="atena-hitre-izbire"><button type="button" aria-pressed="true">Odstotek SLA</button><button type="button" aria-pressed="false">Delovni čas</button></div><label><input type="range" min="90" max="100" step="0.1" value="99.5"><output>99,5 %</output></label></div>`,
  "primerjalna-kartica-z-ceno": `<div class="uj-card-comparison" data-card-choice-group><button type="button" data-card-choice="offer-a" aria-pressed="true" class="is-selected"><span class="uj-card-comparison__name">Ponudba A</span><strong>1.240 €</strong><small><b>14 dni</b><em>2 leti garancije</em></small></button><button type="button" data-card-choice="offer-b" aria-pressed="false"><span class="uj-card-comparison__name">Ponudba B</span><strong>1.090 €</strong><small><b>21 dni</b><em>1 leto garancije</em></small></button></div>`,
  "segmentna-vrstica-z-vnosi": `<div class="uj-card-payment" data-payment-split><div class="uj-card-payment__bar"><i style="width:30%"></i><i style="width:40%"></i><i style="width:30%"></i></div><div class="uj-card-payment__fields"><label><span>Avans</span><span><input type="number" min="0" max="100" value="30" data-payment-part="0" aria-label="Avans v odstotkih"><b>%</b></span></label><label><span>Vmesno</span><span><input type="number" min="0" max="100" value="40" data-payment-part="1" aria-label="Vmesno v odstotkih"><b>%</b></span></label><label><span>Prevzem</span><span><input type="number" min="0" max="100" value="30" data-payment-part="2" aria-label="Prevzem v odstotkih"><b>%</b></span></label></div><p class="is-valid" data-payment-total>Skupaj: <b>100 %</b></p></div>`,
  "razvejana-druga-stopnja": `<div class="uj-card-decision"><div class="uj-card-field"><span class="uj-card-label">1. Izberite smer</span><div class="uj-card-choices uj-card-choices--three"><button type="button"><span>Nadaljuj</span></button><button type="button" class="is-selected"><span>Primerjaj</span></button><button type="button"><span>Zavrni</span></button></div></div><div class="uj-card-decision__panel"><div class="uj-card-field"><span class="uj-card-label">2. Kaj želite primerjati?</span><div class="uj-card-choices uj-card-choices--three"><button type="button" class="is-selected"><span>Ceno</span></button><button type="button"><span>Rok</span></button><button type="button"><span>Pogoje</span></button></div></div></div></div>`,
  "stolpci-obrokov": `<div class="uj-card-installments"><div class="uj-card-installments__summary"><span>Posamezni obrok</span><b>600 €</b><small>skupaj 2.400 €</small></div><div class="uj-card-installments__bars"><i><span>1</span></i><i><span>2</span></i><i><span>3</span></i><i><span>4</span></i></div><div class="uj-card-installments__stepper"><button type="button">−</button><input type="number" value="4"><span>obroki</span><button type="button">+</button></div></div>`,
  "glasovni-vnos-z-merilnikom": `<label class="zgodovina-ai__vnos"><textarea placeholder="Npr. plačal je tri obroke po 300 € …"></textarea></label><div class="zgodovina-ai__akcije"><button type="button" class="zgodovina-ai__snemaj is-recording"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg><span>Prekini snemanje</span><span class="zgodovina-ai__glasnost" style="--voice-bar:.8"><i></i><i style="--voice-bar:.3"></i><i style="--voice-bar:.9"></i><i style="--voice-bar:.5"></i><i style="--voice-bar:.2"></i></span></button><button type="button" class="zgodovina-ai__razumi" disabled>Pripravi dogodke</button></div>`,
  "korakovni-napredek-s-tonom-in-povzetkom": `<div class="zgodovina-ai-napredek"><i></i><button type="button" class="is-completed" style="--korak-rgb:230,126,0"><span>1</span></button><button type="button" class="is-current" style="--korak-rgb:47,136,224"><span>2</span></button><button type="button" style="--korak-rgb:63,153,152"><span>3</span></button><button type="button" class="is-tone-povzetek" style="--korak-rgb:63,153,152"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h12.9a2 2 0 0 0 2-1.7l1.4-9A2 2 0 0 0 18.3 9H14V4a2 2 0 0 0-2-2l-3 7"/></svg></span></button></div>`,
  "stanje-dolga-primerjava": `<div class="zgodovina-ai-stanje-dolga"><div class="zgodovina-ai-stanje-dolga__stolpec"><span>Originalni znesek</span><strong>1.500,00 €</strong></div><i></i><div class="zgodovina-ai-stanje-dolga__stolpec zgodovina-ai-stanje-dolga__stolpec--preostanek"><span>Preostali znesek</span><strong>900,00 €</strong></div></div>`,
  "urejanje-opisa-s-svincnikom": `<button type="button" class="zgodovina-ai-pogovor__opis" style="--vprasanje-rgb:63,153,152"><span>"Plačal je tri obroke po 300 € v zadnjih dveh mesecih."</span><span class="zgodovina-ai-pogovor__opis-svincnik"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg></span></button>`,
  "kartica-razjasnitve-dogodka": `<div class="zgodovina-ai-vprasanje" style="--vprasanje-rgb:230,126,0"><button type="button" class="zgodovina-ai-vprasanje__odstrani"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button><span class="zgodovina-ai-vprasanje__ikona"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg></span><div><h4>Dopolnite Delno plačilo</h4><p>Vsi manjkajoči podatki tega dogodka so združeni tukaj.</p></div><button type="button" class="zgodovina-ai-vprasanje__spremeni">Spremeni</button><div class="zgodovina-ai-vprasanje__polja zgodovina-ai-vprasanje__polja--placilo-kompaktno"><label class="is-amount"><span>Znesek</span><input type="text" value="300 €"></label><label class="is-payment-method"><span>Način</span><input type="text" value="Nakazilo"></label><label class="is-date"><span>Datum</span><input type="text" value="3. 8. 2026"></label></div></div>`,
  "povzetek-vrstica-z-uredi-izbrisi": `<div class="zgodovina-ai-povzetki"><article class="zgodovina-ai-povzetek" style="--povzetek-rgb:230,126,0"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg></span><div><strong>Delno plačilo</strong><p>300 € · 3. 8. · bančno nakazilo</p></div><span class="zgodovina-ai-povzetek__akcije"><button type="button">Uredi</button><button type="button">×</button></span></article></div>`,
  "potrditev-uvodna-znacka": `<div class="zgodovina-ai-pogovor__potrditev"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><div><h4>Če prav razumem …</h4><p>Preverite dogodke in jih potrdite.</p></div></div>`
};

const cards = register.vrstice.map((v) => {
  let primer;
  if (v.id.indexOf("widget-") === 0) {
    const realId = v.id.slice("widget-".length);
    const template = templateById.get(realId);
    const bodyHtml = template ? template.body() : '<p style="color:#a66e00;font-size: 13px;">Widget "' + esc(realId) + '" ni najden v atena-card-templates.js.</p>';
    /* [data-card-reset] kliče resetTemplateCard(), ki zahteva prednika
       [data-template-card="<id>"], nato PONOVNO izriše samo .uj-answer-card__body
       (glej renderTemplateBody() v atena-card-templates.js, ki iz telesa
       odstrani gumb 'Ponastavi', ker ta v pravi kartici živi ZUNAJ telesa,
       v sosednjem .uj-answer-card__actions — natanko kot renderTemplate()).
       Brez te iste dvodelne strukture bi gumb po prvem kliku izginil
       (ker bi bil del zamenjanega telesa) ali pa sploh ne bi deloval
       (če ovoja [data-template-card] ni). */
    const RESET_BUTTON_HTML = '<button type="button" class="uj-card-reset" data-card-reset><span aria-hidden="true">↺</span> Ponastavi</button>';
    const hasReset = bodyHtml.indexOf("data-card-reset") !== -1;
    primer = template && hasReset
      ? '<div data-template-card="' + esc(realId) + '"><div class="uj-answer-card__body">' + bodyHtml.split(RESET_BUTTON_HTML).join("") + '</div><div class="uj-answer-card__actions">' + RESET_BUTTON_HTML + '</div></div>'
      : bodyHtml;
  } else {
    primer = PRIMERI[v.id] || '<p style="color:#a66e00;font-size: 13px;">Primer še ni pripravljen za ta ID.</p>';
  }
  const viri = v.viriKartic.map((vir) => `<li>${esc(vir)}</li>`).join("");
  const locnica = v.number === 27 ? `<div class="vrstica-locnica">↓ Od tu naprej: PRAVE produkcijske Atenine kartice, ogrodje (vir app/styles.css: ponudba-obrazec__*) — ločen vizualni sistem od NAZORJEVA galerije zgoraj ↓</div>`
    : v.number === 32 ? `<div class="vrstica-locnica">↓ Od tu naprej: PRAVI renderer vnosnih polj (vir app/styles.css: atena-* + atena-card-renderer.js) — TRETJI ločen sistem, uporabljen znotraj ogrodja zgoraj ↓</div>`
    : v.number === 40 ? `<div class="vrstica-locnica">↓ Od tu naprej: preostalih 53 NAZORJEVA widgetov kot CELE kartice (ne razstavljene na vrstice) — vsaka je svoja specifična vizualizacija, samodejno izrisana iz prave kode ↓</div>`
    : "";
  return `${locnica}<article class="vrstica-kartica">
    <header><span class="vrstica-stevilka">#${v.number}</span><h2>${esc(v.title)}</h2>${v.ton ? `<span class="vrstica-ton">${esc(v.ton)}</span>` : ""}</header>
    <div class="vrstica-primer" data-answer-card>${primer}</div>
    <details>
      <summary>Vir in opis</summary>
      <ul class="vrstica-viri">${viri}</ul>
      <p class="vrstica-opis">${esc(v.opis)}</p>
    </details>
  </article>`;
}).join("\n");

const html = `<!doctype html>
<html lang="sl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NAZORJEVA-VRSTICE — galerija (${register.vrstice.length} vrstic)</title>
<style>
/* Osnovni reset za gola input/textarea/select polja. V pravi aplikaciji to
   priskrbi skupni app/styles.css (naložen PRED atena-card-templates.css), ki
   ga ta samostojna galerija namenoma NE vključi v celoti (44.454 vrstic).
   Brez tega bi gola polja (tista brez lastnega NAZORJEVA/produkcijskega
   razreda za velikost) padla na native brskalnikov videz namesto na 44px
   zaokroženo obliko, ki jo uporablja preostala aplikacija. */
input:not([type="range"]):not([type="checkbox"]):not([type="radio"]),
textarea, select {
  box-sizing: border-box; width: 100%; min-height: 44px; padding: 0 10px;
  border: 1px solid #c8dcda; border-radius: 11px; background: #fff;
  color: #263b39; font: 500 13px/1.3 Figtree, Inter, sans-serif;
}
textarea { min-height: 60px; padding-top: 8px; resize: vertical; }
button { font-family: Figtree, Inter, sans-serif; }
/* Enoten fokus-obroč za VSE galerijske primere (glej isto pravilo v
   app/atena-card-templates.css) — brez tega brskalnikov privzeti outline
   trči ob zaokroženo obrobo polja in ustvari "okno v oknu". */
.vrstica-primer input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):focus,
.vrstica-primer textarea:focus,
.vrstica-primer select:focus { outline: none !important; box-shadow: inset 0 0 0 2px rgb(var(--card-rgb, 41, 163, 162)) !important; }
.vrstica-primer [style*="--obrazec-barva"] input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):focus,
.vrstica-primer [style*="--obrazec-barva"] textarea:focus,
.vrstica-primer [style*="--obrazec-barva"] select:focus { box-shadow: inset 0 0 0 2px var(--obrazec-barva) !important; }
/* Enoten videz drsnikov v galeriji (kartice niso znotraj .uj-answer-card). */
.vrstica-primer input[type="range"] { -webkit-appearance:none; appearance:none; width:100%; height:22px; margin:0; background:transparent; cursor:pointer; }
.vrstica-primer input[type="range"]::-webkit-slider-runnable-track { height:5px; border-radius:999px; background:rgba(var(--card-rgb,41,163,162),.18); }
.vrstica-primer input[type="range"]::-webkit-slider-thumb { -webkit-appearance:none; width:20px; height:20px; margin-top:-7.5px; border-radius:50%; background:#fff; border:2px solid rgb(var(--card-rgb,41,163,162)); box-shadow:0 2px 6px rgba(47,55,54,.22); }
.vrstica-primer input[type="range"]::-moz-range-track { height:5px; border-radius:999px; background:rgba(var(--card-rgb,41,163,162),.18); }
.vrstica-primer input[type="range"]::-moz-range-progress { height:5px; border-radius:999px; background:rgb(var(--card-rgb,41,163,162)); }
.vrstica-primer input[type="range"]::-moz-range-thumb { width:16px; height:16px; border-radius:50%; background:#fff; border:2px solid rgb(var(--card-rgb,41,163,162)); box-shadow:0 2px 6px rgba(47,55,54,.22); }
/* Prava vrednost v produkciji je font-size: 13px (44px gumb, telefonska
   širina) — tu v širši galeriji je za berljivost povečan na 13px. */
.uj-card-calendar__days button { font-size: 13px; }
/* Prava vrednost je font-size: 13px/9px (44px vrstica, telefonska širina) —
   tu povečano na 15px/12px za berljivost, obenem poravnano isto na vseh 3. */
.uj-card-payment__fields input[type="number"] { font-size: 15px; font-weight: 700; }
.uj-card-payment__fields b { font-size: 13px; }
.uj-card-payment__fields label > span:last-child { grid-template-columns: minmax(0,1fr) 26px; }
${cardCss}
${productionCss}
${zgodovinaCss}
  body { margin:0; padding:24px; background:#fbfaf7; font-family:system-ui,sans-serif; color:#173b5f; }
  .glava { max-width:960px; margin:0 auto 20px; }
  .glava h1 { font-size:20px; margin:0 0 4px; }
  .glava p { font-size:13px; color:#5f7471; margin:0; }
  .glava .status { display:inline-block; margin-top:8px; padding:4px 10px; border-radius:8px; background:#fff3d5; color:#a66e00; font-size: 13px; font-weight:700; }
  .mreza { max-width:960px; margin:0 auto; display:grid; gap:16px; --card-rgb:41,163,162; }
  .vrstica-kartica { background:#fff; border:1px solid #e3e9e6; border-radius:14px; padding:14px 16px; }
  .vrstica-kartica header { display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
  .vrstica-stevilka { font:800 13px system-ui; color:#fff; background:#41a3a2; border-radius:6px; padding:2px 7px; }
  .vrstica-kartica h2 { font-size:14px; margin:0; flex:1 1 auto; min-width:0; }
  .vrstica-ton { font-size: 13px; font-weight:700; color:#607572; }
  .vrstica-primer { padding:12px; border:1px dashed #d8e2df; border-radius:10px; background:#fbfdfc; }
  details { margin-top:10px; font-size: 13px; }
  summary { cursor:pointer; color:#41a3a2; font-weight:700; }
  .vrstica-viri { margin:8px 0; padding-left:18px; color:#405956; }
  .vrstica-opis { color:#5f7471; line-height:1.5; }
  .vrstica-locnica { max-width:960px; margin:8px auto; padding:8px 12px; border-radius:9px; background:#fff3d5; color:#a66e00; font-size: 13px; font-weight:700; text-align:center; }
</style>
${predlogiStil}
</head>
<body>
  <div class="glava">
    <h1>NAZORJEVA-VRSTICE — galerija gradnikov</h1>
    <p>Register izluščenih, ponovno uporabljivih vrstic iz obstoječih kartic. Generirano iz NAZORJEVA-VRSTICE.js.</p>
    <span class="status">${esc(register.status)}</span>
  </div>
  <div class="mreza">
${cards}
  </div>
<script>
/* GALERIJSKA LOGIKA 2026-09-04: samo predogled (produkcija: app/atena-card-templates.js).
   #59 proračunski razpon, #62 plačilni razrez, #122 razpoložljivost. */
(function () {
  "use strict";
  function eur(v) { return Number(v || 0).toLocaleString("sl-SI") + " €"; }
  document.querySelectorAll("[data-dual-range]").forEach(function (root) {
    var minI = root.querySelector("[data-dual-min]");
    var maxI = root.querySelector("[data-dual-max]");
    if (!minI || !maxI) return;
    var outMin = root.querySelector("[data-dual-min-output]");
    var outMax = root.querySelector("[data-dual-max-output]");
    var bars = Array.prototype.slice.call(root.querySelectorAll(".uj-card-dual-range__chart i"));
    function paint(changed) {
      if (Number(minI.value) > Number(maxI.value)) {
        if (changed === minI) maxI.value = minI.value; else minI.value = maxI.value;
      }
      var min = Number(minI.value), max = Number(maxI.value);
      if (outMin) outMin.textContent = eur(min);
      if (outMax) outMax.textContent = eur(max);
      bars.forEach(function (bar, i) {
        var v = (i + 0.5) / bars.length * Number(minI.max);
        bar.classList.toggle("is-active", v >= min && v <= max);
      });
    }
    minI.addEventListener("input", function () { paint(minI); });
    maxI.addEventListener("input", function () { paint(maxI); });
    paint(null);
  });
  document.querySelectorAll("[data-payment-split]").forEach(function (root) {
    var inputs = Array.prototype.slice.call(root.querySelectorAll("[data-payment-part]"));
    var bars = root.querySelectorAll(".uj-card-payment__bar i");
    var total = root.querySelector("[data-payment-total]");
    function paint() {
      var vals = inputs.map(function (el) { return Math.max(0, Math.min(100, Number(el.value) || 0)); });
      bars.forEach(function (bar, i) { bar.style.width = (vals[i] || 0) + "%"; });
      var sum = vals.reduce(function (a, b) { return a + b; }, 0);
      if (total) {
        total.classList.toggle("is-valid", sum === 100);
        total.classList.toggle("is-invalid", sum !== 100);
        total.innerHTML = (sum === 100 ? "Skupaj: " : "Vsota mora biti 100 % · trenutno: ") + "<b>" + sum + " %</b>";
      }
    }
    inputs.forEach(function (el) { el.addEventListener("input", paint); });
    paint();
  });
  document.querySelectorAll(".atena-razpolozljivost > label input[type=\\"range\\"]").forEach(function (range) {
    var out = range.closest("label").querySelector("output");
    function paint() {
      var min = Number(range.min || 0), max = Number(range.max || 100);
      var p = max === min ? 100 : (Number(range.value) - min) / (max - min) * 100;
      range.style.setProperty("--rzp", p.toFixed(1) + "%");
      if (out) out.textContent = Number(range.value).toLocaleString("sl-SI") + " %";
    }
    range.addEventListener("input", paint);
    paint();
  });
})();
</script>
<script src="app/atena-card-segments.js"></script>
<script src="app/atena-card-templates.js"></script>
<script src="app/atena-card-renderer.js"></script>
<script>
(function () {
  "use strict";
  if (window.UJAtenaCardTemplates && typeof window.UJAtenaCardTemplates.bind === "function") {
    window.UJAtenaCardTemplates.bind(document.body);
  }
  var renderer = window.UJAtenaCardRenderer || null;
  if (renderer && typeof renderer.hydrate === "function") {
    renderer.hydrate(document.body);
  }
  if (renderer) {
    document.body.addEventListener("click", function (dogodek) {
      if (renderer.handleClick) renderer.handleClick(dogodek, document.body);
    });
    document.body.addEventListener("input", function (dogodek) {
      if (renderer.handleInput) renderer.handleInput(dogodek, document.body);
    });
    document.body.addEventListener("change", function (dogodek) {
      if (renderer.handleChange) renderer.handleChange(dogodek, document.body);
    });
  }
})();
</script>
<script>
"use strict";
/* DOPOLNILO 2026-09-05: pokrije vzorce, ki jih app/atena-card-templates.js
   bind() namenoma NE pozna, ker pripadajo drugemu sistemu (.atena-izbira,
   real production produkcija) ali so čisto generične NAZORJEVA ilustracije
   brez data-atributov (npr. vrstica 10, 20). Nikoli se ne dotika ničesar,
   kar že ima data-card-choice/data-step/data-condition-* ipd. — to je
   izključno last app/atena-card-templates.js bind(), da ne pride do
   podvojenega/nasprotujočega si preklapljanja. */
(function () {
  "use strict";

  function enojnaIzbira(gumb, sorojenci) {
    sorojenci.forEach(function (g) {
      g.classList.remove("is-selected");
      g.setAttribute("aria-pressed", "false");
    });
    gumb.classList.add("is-selected");
    gumb.setAttribute("aria-pressed", "true");
  }

  function terminskoBesedilo(n) {
    if (n === 1) return n + " termin";
    if (n === 2) return n + " termina";
    if (n >= 3 && n <= 4) return n + " termini";
    return n + " terminov";
  }

  function osveziSkupnoOceno(kartica) {
    if (!kartica) return;
    var ocenaVnosi = Array.prototype.slice.call(kartica.querySelectorAll(".uj-card-score__row input[type=number]"));
    if (!ocenaVnosi.length) return;
    var povprecje = ocenaVnosi.reduce(function (sum, el) { return sum + (Number(el.value) || 0); }, 0) / ocenaVnosi.length;
    var izpisOcene = kartica.querySelector(".uj-card-score__summary output");
    if (izpisOcene) izpisOcene.textContent = povprecje.toFixed(1).replace(".", ",");
  }

  function osveziObroke(kartica, stevilo) {
    if (!kartica) return;
    var SKUPNA_VSOTA_OBROKOV = 2400;
    var posamezniObrok = Math.round(SKUPNA_VSOTA_OBROKOV / stevilo);
    var izpisPosameznega = kartica.querySelector(".uj-card-installments__summary b");
    if (izpisPosameznega) izpisPosameznega.textContent = posamezniObrok.toLocaleString("sl-SI") + " €";
    var stolpciOvoj = kartica.querySelector(".uj-card-installments__bars");
    if (stolpciOvoj) {
      stolpciOvoj.innerHTML = "";
      for (var i = 1; i <= stevilo; i += 1) {
        var stolpec = document.createElement("i");
        var stevilka = document.createElement("span");
        stevilka.textContent = String(i);
        stolpec.appendChild(stevilka);
        stolpciOvoj.appendChild(stolpec);
      }
    }
  }

  /* Atomarni primer drsnik+natančen vnos brez polnega realnega konteksta
     (npr. vrstica 96) — preprost, varen sinhron sync namesto klica prave,
     a za samostojen kontekst prestroge funkcije iz bind(). */
  document.addEventListener("input", function (dogodek) {
    var vnos = dogodek.target;
    if (!vnos || vnos.tagName !== "INPUT") return;
    var ovoj = vnos.closest("[data-expected-atomic] [data-expected-param]");
    if (!ovoj) return;
    var range = ovoj.querySelector("[data-atomic-range]");
    var number = ovoj.querySelector("[data-atomic-number]");
    var output = ovoj.querySelector("[data-atomic-output]");
    if (!range || !number || !output) return;
    var vrednost = Math.max(Number(range.min), Math.min(Number(range.max), Number(vnos.value) || 0));
    range.value = String(vrednost);
    number.value = String(vrednost);
    var enota = output.textContent.trim().slice(-1) === "€" ? " €" : " %";
    output.textContent = vrednost + enota;
  });

  document.addEventListener("click", function (dogodek) {
    var gumb = dogodek.target.closest ? dogodek.target.closest("button") : null;
    if (!gumb) return;

    /* .atena-izbira: prava produkcijska izbira, ločen sistem od NAZORJEVA.
       Vse doslej pregledane resnične rabe (vloga, način plačila, da/ne ...)
       so enojna izbira — en gumb je izbran naenkrat. */
    if (gumb.classList.contains("atena-izbira") && !gumb.hasAttribute("data-atena-choice")) {
      var izbire = gumb.closest(".atena-izbire");
      if (!izbire) return;
      enojnaIzbira(gumb, Array.prototype.slice.call(izbire.querySelectorAll(".atena-izbira")));
      return;
    }

    /* Gole NAZORJEVA izbire brez data-card-choice (npr. vrstica 10, generični primeri) */
    if (gumb.hasAttribute("data-card-choice") || gumb.hasAttribute("data-step") || gumb.hasAttribute("data-condition-toggle") || gumb.hasAttribute("data-condition-choice")) return;
    var goliStarsi = gumb.parentElement;
    if (goliStarsi && goliStarsi.matches(".uj-card-choices, .uj-card-segment, .uj-card-choice-grid, .uj-card-choice-list")) {
      var goliSorojenci = Array.prototype.filter.call(goliStarsi.children, function (el) { return el.tagName === "BUTTON"; });
      enojnaIzbira(gumb, goliSorojenci);
      return;
    }

    /* Dnevi ponavljanja brez data-recurrence-day: večizbira */
    if (gumb.parentElement && gumb.parentElement.classList.contains("uj-card-recurrence__days") && !gumb.hasAttribute("data-recurrence-day")) {
      gumb.classList.toggle("is-selected");
      return;
    }

    /* .atena-kolicina: prava produkcijska količina/stepper, ločen sistem od NAZORJEVA .uj-card-stepper */
    if ((gumb.textContent.trim() === "+" || gumb.textContent.trim() === "−" || gumb.textContent.trim() === "-") && gumb.closest(".atena-kolicina") && !gumb.hasAttribute("data-atena-step")) {
      var kolicinaOvoj = gumb.closest(".atena-kolicina");
      var kolicinaVnos = kolicinaOvoj.querySelector('input[type="number"]');
      if (!kolicinaVnos) return;
      var kolicinaDelta = gumb.textContent.trim() === "+" ? 1 : -1;
      var kolicinaMin = kolicinaVnos.min !== "" ? Number(kolicinaVnos.min) : 0;
      var kolicinaNovo = Math.max(kolicinaMin, (Number(kolicinaVnos.value) || 0) + kolicinaDelta);
      kolicinaVnos.value = String(kolicinaNovo);
      return;
    }

    /* .atena-hitre-izbire: prave produkcijske bližnjice — enojna izbira */
    if (gumb.parentElement && gumb.parentElement.classList.contains("atena-hitre-izbire") && !gumb.hasAttribute("data-atena-quick-value") && !gumb.hasAttribute("data-atena-mode-button") && !gumb.hasAttribute("data-atena-date-mode") && !gumb.hasAttribute("data-atena-deadline-mode")) {
      var hitreSorojenci = Array.prototype.filter.call(gumb.parentElement.children, function (el) { return el.tagName === "BUTTON"; });
      hitreSorojenci.forEach(function (g) { g.setAttribute("aria-pressed", "false"); });
      gumb.setAttribute("aria-pressed", "true");
      return;
    }

    /* Atomarni primer ukrepnih gumbov brez polnega realnega konteksta (vrstica
       95: .uj-card-expected__actions brez data-expected-value/debt starsa) —
       enak razlog kot pri vrstici 96: prava applyExpectedAction() zahteva
       [data-expected-value] prednika, ki ga samostojen primer nima. */
    if (gumb.parentElement && gumb.parentElement.classList.contains("uj-card-expected__actions") && !gumb.hasAttribute("data-expected-action")) {
      var pricakovaniSorojenci = Array.prototype.filter.call(gumb.parentElement.children, function (el) { return el.tagName === "BUTTON"; });
      enojnaIzbira(gumb, pricakovaniSorojenci);
      return;
    }

    /* Samostojna legenda 4 stopenj zasedenosti (vrstica 112) brez pravega
       dneva/tedna konteksta — vsak gumb je neodvisen krogotok 0→3→0, prava
       updateHeatmap() bi tu padla (cell.dataset.heatDay je undefined). */
    if (gumb.hasAttribute("data-standalone-heat-cell")) {
      var trenutnaStopnja = (Number(gumb.dataset.load) + 1) % 4;
      gumb.dataset.load = String(trenutnaStopnja);
      var stopnjeOznake = ["Prosto", "Malo dela", "Srednje zasedeno", "Zelo zasedeno"];
      gumb.setAttribute("aria-label", stopnjeOznake[trenutnaStopnja] + ". Klik spremeni stopnjo zasedenosti.");
      return;
    }

    /* Tedenska mreža terminov (vrstica 103): golo, večizbirno preklapljanje
       + prešteje izbrane termine v spodnjem povzetku. */
    if (gumb.closest(".uj-card-week__row") && !gumb.hasAttribute("data-slot")) {
      gumb.classList.toggle("is-selected");
      var tedenskaKartica = gumb.closest(".uj-card-week");
      var izbraniTermini = tedenskaKartica ? tedenskaKartica.querySelectorAll(".uj-card-week__row button.is-selected").length : 0;
      var terminiIzpis = tedenskaKartica && tedenskaKartica.querySelector("p b");
      if (terminiIzpis) terminiIzpis.textContent = terminskoBesedilo(izbraniTermini);
      return;
    }

    /* Ocenjevalni seznam s povprečjem (vrstica 104): minus/plus na oceno
       vsakega merila (1–5), zgornji povzetek je njihovo povprečje. */
    if ((gumb.textContent.trim() === "+" || gumb.textContent.trim() === "−") && gumb.closest(".uj-card-score__row") && !gumb.hasAttribute("data-score-step")) {
      var ocenaVrstica = gumb.closest(".uj-card-score__row");
      var ocenaVnos = ocenaVrstica.querySelector('input[type="number"]');
      if (!ocenaVnos) return;
      var ocenaDelta = gumb.textContent.trim() === "+" ? 1 : -1;
      var novaOcena = Math.max(1, Math.min(5, (Number(ocenaVnos.value) || 0) + ocenaDelta));
      ocenaVnos.value = String(novaOcena);
      osveziSkupnoOceno(ocenaVrstica.closest(".uj-card-score"));
      return;
    }

    /* Dodajanje novega scenarija v skupino (vrstica 110): samostojen, varen
       podnabor prave scenarioPreset logike — brez drsnikov/parametrov, ki jih
       ta atomarni primer nima. */
    if (gumb.hasAttribute("data-standalone-scenario-preset")) {
      var predlogeSorojenci = Array.prototype.slice.call(gumb.parentElement.querySelectorAll("[data-standalone-scenario-preset]"));
      enojnaIzbira(gumb, predlogeSorojenci);
      return;
    }
    if (gumb.hasAttribute("data-standalone-scenario-add")) {
      var ovojDodaj = gumb.closest(".vrstica-primer");
      var obrazecDodaj = ovojDodaj && ovojDodaj.querySelector("[data-standalone-scenario-form]");
      if (obrazecDodaj) { obrazecDodaj.hidden = false; var imeVnosDodaj = obrazecDodaj.querySelector("[data-standalone-scenario-name]"); if (imeVnosDodaj) imeVnosDodaj.focus(); }
      return;
    }
    if (gumb.hasAttribute("data-standalone-scenario-cancel")) {
      var obrazecPreklici = gumb.closest("[data-standalone-scenario-form]");
      if (obrazecPreklici) { obrazecPreklici.hidden = true; var vnosPreklici = obrazecPreklici.querySelector("[data-standalone-scenario-name]"); if (vnosPreklici) vnosPreklici.value = ""; }
      return;
    }
    if (gumb.hasAttribute("data-standalone-scenario-create")) {
      var obrazecUstvari = gumb.closest("[data-standalone-scenario-form]");
      var vnosUstvari = obrazecUstvari && obrazecUstvari.querySelector("[data-standalone-scenario-name]");
      var imeScenarija = vnosUstvari ? vnosUstvari.value.trim() : "";
      var ovojUstvari = gumb.closest(".vrstica-primer");
      var predlogeVrstica = ovojUstvari && ovojUstvari.querySelector("[data-standalone-scenario-presets]");
      if (imeScenarija && predlogeVrstica) {
        var novScenarijGumb = document.createElement("button");
        novScenarijGumb.type = "button";
        novScenarijGumb.setAttribute("data-standalone-scenario-preset", "");
        novScenarijGumb.textContent = imeScenarija;
        predlogeVrstica.insertBefore(novScenarijGumb, predlogeVrstica.querySelector("[data-standalone-scenario-add]"));
        enojnaIzbira(novScenarijGumb, Array.prototype.slice.call(predlogeVrstica.querySelectorAll("[data-standalone-scenario-preset]")));
      }
      if (obrazecUstvari) { obrazecUstvari.hidden = true; if (vnosUstvari) vnosUstvari.value = ""; }
      return;
    }

    /* Denar ali odstotek (vrstica 120): atomaren preklop enote brez
       spremljajočega drsnika/vnosa, ki bi ga prava moneyPercentHtml() zahtevala. */
    if (gumb.closest(".atena-znesek-enota") && gumb.parentElement && gumb.parentElement.getAttribute("role") === "group" && !gumb.hasAttribute("data-atena-unit-button")) {
      Array.prototype.filter.call(gumb.parentElement.children, function (el) { return el.tagName === "BUTTON"; }).forEach(function (g) { g.setAttribute("aria-pressed", String(g === gumb)); });
      return;
    }

    /* Stolpci obrokov (vrstica 126): minus/plus spremeni število obrokov,
       preračuna posamezni obrok (fiksna skupna vsota 2.400 €) in prerise
       ustrezno število stolpičkov. */
    if ((gumb.textContent.trim() === "+" || gumb.textContent.trim() === "−") && gumb.closest(".uj-card-installments__stepper") && !gumb.hasAttribute("data-installment-step")) {
      var obrokKartica = gumb.closest(".uj-card-installments");
      var obrokVnos = obrokKartica && obrokKartica.querySelector(".uj-card-installments__stepper input");
      if (!obrokVnos) return;
      var obrokDelta = gumb.textContent.trim() === "+" ? 1 : -1;
      var novoSteviloObrokov = Math.max(1, Math.min(12, (Number(obrokVnos.value) || 0) + obrokDelta));
      obrokVnos.value = String(novoSteviloObrokov);
      osveziObroke(obrokKartica, novoSteviloObrokov);
      return;
    }

    /* Glasovni vnos z merilnikom (vrstica 127): preklop med snemanjem in
       mirovanjem — v mirovanju se sprosti gumb 'Pripravi dogodke'. */
    if (gumb.classList.contains("zgodovina-ai__snemaj")) {
      var snemaZdaj = gumb.classList.toggle("is-recording");
      var oznakaSnemanja = gumb.querySelector("span:not(.zgodovina-ai__glasnost)");
      if (oznakaSnemanja) oznakaSnemanja.textContent = snemaZdaj ? "Prekini snemanje" : "Povej na glas";
      var pripraviGumb = gumb.parentElement && gumb.parentElement.querySelector(".zgodovina-ai__razumi");
      if (pripraviGumb) pripraviGumb.disabled = snemaZdaj;
      return;
    }

    /* Urejanje opisa s svinčnikom (vrstica 130): klik spremeni prikazano
       besedilo v urejevalno polje, kot pravi opis vrstice zahteva. */
    if (gumb.classList.contains("zgodovina-ai-pogovor__opis")) {
      var opisSpan = gumb.querySelector("span:first-child");
      var trenutnoBesedilo = opisSpan ? opisSpan.textContent.replace(/^"|"$/g, "") : "";
      var poljeUrejanja = document.createElement("textarea");
      poljeUrejanja.className = "zgodovina-ai-pogovor__opis-urejanje";
      poljeUrejanja.rows = 2;
      poljeUrejanja.style.width = "100%";
      poljeUrejanja.style.boxSizing = "border-box";
      poljeUrejanja.value = trenutnoBesedilo;
      var opisStars = gumb.parentElement;
      opisStars.replaceChild(poljeUrejanja, gumb);
      poljeUrejanja.focus();
      poljeUrejanja.setSelectionRange(poljeUrejanja.value.length, poljeUrejanja.value.length);
      poljeUrejanja.addEventListener("blur", function zapriUrejanjeOpisa() {
        if (opisSpan) opisSpan.textContent = '"' + poljeUrejanja.value.trim() + '"';
        opisStars.replaceChild(gumb, poljeUrejanja);
      }, { once:true });
      return;
    }

    /* Kartica razjasnitve dogodka (vrstica 131): gumb '×' odstrani celotno
       kartico dogodka, kot njen aria-label/namen narekuje. */
    if (gumb.classList.contains("zgodovina-ai-vprasanje__odstrani")) {
      var vprasanjeKartica = gumb.closest(".zgodovina-ai-vprasanje");
      if (vprasanjeKartica) vprasanjeKartica.remove();
      return;
    }

    /* Povzetek vrstica z uredi/izbriši (vrstica 132): gumb '×' odstrani
       povzetek vrstice. */
    if (gumb.parentElement && gumb.parentElement.classList.contains("zgodovina-ai-povzetek__akcije") && gumb.textContent.trim() === "×") {
      var povzetekVrstica = gumb.closest(".zgodovina-ai-povzetek");
      if (povzetekVrstica) povzetekVrstica.remove();
      return;
    }
  });
})();

</script>
${predlogiSkripte}
${predlogiBlok}
</body>
</html>
`;

const outPath = path.join(__dirname, "..", "NAZORJEVA-VRSTICE-GALERIJA.html");
fs.writeFileSync(outPath, html, "utf8");
console.log("Galerija generirana: " + outPath + " (" + register.vrstice.length + " vrstic)");
