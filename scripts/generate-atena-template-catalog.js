"use strict";

const fs = require("node:fs");
const path = require("node:path");
const templates = require("../app/atena-card-templates");
const father = templates.categories["2.0"];

const outputDir = process.argv[2];
if (!outputDir) throw new Error("Podajte ciljno mapo za katalog.");
fs.mkdirSync(outputDir, { recursive:true });

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "app", "atena-card-templates.css"), "utf8");
const clientSource = fs.readFileSync(path.join(root, "app", "atena-card-templates.js"), "utf8").replace(/<\/script/gi, "<\\/script");
const md = (value) => String(value == null ? "" : value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);
const totalCount = templates.templates.length;
const approvedCount = templates.templates.filter((template) => template.approved).length;
const draftCount = totalCount - approvedCount;
if (totalCount !== 61 || approvedCount !== 30 || draftCount !== 31) throw new Error(`Katalog mora vsebovati 61 zasnov (30 potrjenih + 31 novih), trenutno: ${totalCount} (${approvedCount} + ${draftCount}).`);
if (new Set(templates.templates.map((template) => template.id)).size !== totalCount) throw new Error("ID-ji zasnov kartic morajo biti enolični.");
if (father.category !== "2.0" || father.records.length !== 18) throw new Error("Kategorija FATHER 2.0 mora vsebovati 12 ciljnih in 6 pravnih kartic.");
if (new Set(father.records.map((record) => record.id)).size !== father.records.length) throw new Error("ID-ji kartic kategorije 2.0 morajo biti enolični.");
const amount = (label, value = "2.400,00") => `<div class="uj-card-field"><span class="uj-card-label">${esc(label)}</span><label class="uj-card-money"><input type="text" inputmode="decimal" value="${esc(value)}" aria-label="${esc(label)}"><b>€</b></label></div>`;
const date = (label) => `<div class="uj-card-field"><span class="uj-card-label">${esc(label)}</span><div class="uj-card-date"><input type="date" aria-label="${esc(label)}"></div></div>`;
const text = (label, placeholder) => `<label class="uj-card-field"><span class="uj-card-label">${esc(label)}</span><input type="text" placeholder="${esc(placeholder)}"></label>`;
const select = (label, value, options) => {
  const rows = (options && options.length ? options : [value]).map((option, index) => [String(index), option]);
  return `<div class="uj-card-field"><span class="uj-card-label">${esc(label)}</span><div class="uj-card-condition__select" data-condition-select><button type="button" data-condition-toggle data-condition-label="${esc(label)}" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(label)}: ${esc(value)}"><span data-condition-select-value>${esc(value)}</span><i aria-hidden="true"></i></button><div data-condition-menu role="listbox" aria-label="${esc(label)}" hidden>${rows.map((row) => `<button type="button" role="option" data-condition-choice="${row[0]}" aria-selected="${String(row[1] === value)}" class="${row[1] === value ? "is-selected" : ""}">${esc(row[1])}</button>`).join("")}</div><input type="hidden" data-condition-field value="${rows.find((row) => row[1] === value)?.[0] || "0"}"></div></div>`;
};
const area = (label, placeholder) => `<label class="uj-card-field"><span class="uj-card-label">${esc(label)}</span><textarea rows="3" placeholder="${esc(placeholder)}"></textarea></label>`;
const info = (description) => `<div class="uj-card-review"><p>${esc(description)}</p><small>Podrobnosti in dokazila boste dopolnili v koraku Odvetnik.</small></div>`;
const fatherPreview = (record) => {
  switch (record.id) {
    case "full_payment": return amount("Ciljni znesek") + select("Prednostni način poziva", "E-pošta", ["E-pošta","SMS","Telefon","Priporočena pošta","Najprimernejši kanal"]) + text("Želeni rok plačila", "Čim prej") + area("Dodatna zahteva", "Npr. brez dodatnega odloga");
    case "partial_payment_now": return amount("Znesek prvega plačila", "800,00") + date("Rok prvega plačila") + select("Kaj s preostankom?", "Razdelitev na obroke", ["Razdelitev na obroke","Nov skupni rok","Nov dogovor po prvem plačilu"]) + date("Rok za preostanek");
    case "installment_plan": return amount("Znesek posameznega obroka", "400,00") + amount("Skupni ciljni znesek") + text("Število obrokov", "6") + date("Datum prvega obroka") + select("Pogostost obrokov", "Mesečno", ["Tedensko","Mesečno","Drug dogovor"]);
    case "new_deadline": return amount("Znesek do novega roka") + date("Novi rok plačila") + select("Način potrditve roka", "Pisna potrditev", ["E-pošta","SMS","Telefon","Pisna potrditev"]) + area("Razlog novega roka", "Zakaj je novi rok sprejemljiv?");
    case "amicable_settlement": return amount("Ciljni znesek poravnave", "1.900,00") + date("Rok poravnave") + select("Način dogovora", "Vzajemno popuščanje", ["Enkratno plačilo","Plačilo v obrokih","Vzajemno popuščanje"]);
    case "dispute_resolution": return select("Predmet ugovora", "Vsebina računa", ["Kakovost izvedbe","Obseg ali količina","Vsebina računa","Pogodbeni dogovor","Drugo"]) + select("Želeni rezultat", "Popravek računa ali izvedbe", ["Potrditev celotnega dolga","Delni dogovor","Popravek računa ali izvedbe","Skupen sestanek"]) + area("Kaj je treba razrešiti?", "Na kratko opišite ugovor in svoje stališče");
    case "compensation": return amount("Znesek pobota", "1.200,00") + text("Nasprotna terjatev", "Račun ali številka dokumenta") + date("Predvideni datum pobota");
    case "payment_security": return select("Vrsta zavarovanja", "Priznanje dolga", ["Poroštvo","Zastava","Priznanje dolga","Direktna obremenitev","Drugo"]) + amount("Zavarovani znesek") + date("Rok za ureditev zavarovanja");
    case "legal_recovery": return `<div class="uj-card-decision"><p>Izberite konkretni pravni rezultat med šestimi ločenimi FATHER karticami spodaj.</p></div>`;
    case "insolvency_claim": return select("Vrsta postopka", "Stečaj", ["Stečaj","Prisilna poravnava","Ne vem"]) + text("Opravilna številka", "Npr. St 123/2026") + date("Rok za prijavo terjatve");
    case "close_without_recovery": return select("Razlog zaključka", "Terjatev ni izterljiva", ["Terjatev ni izterljiva","Izterjava ni gospodarna","Poslovna odločitev","Drug razlog"]) + amount("Znesek za zaključek") + area("Utemeljitev", "Zapišite razlog za zaključek brez izterjave");
    case "custom_goal": return area("Opišite cilj", "Kaj želite doseči s tem dolgom?") + date("Želeni rok") + text("Merilo uspeha", "Npr. podpisan dogovor");
    case "interim_protection": return info(record.description) + select("Kaj želite predvsem zaščititi?", "Premoženje ali denarna sredstva", ["Premoženje ali denarna sredstva","Poslovanje ali izvedbo pogodbe","Dokaze ali obstoječe stanje","Nekaj drugega","Naj presodi odvetnik"]);
    case "cross_border_recovery": return info(record.description) + text("Država izterjave", "Npr. Avstrija");
    case "legal_route_review": return info(record.description) + select("Kaj vam je najpomembnejše?", "Uravnotežena pot", ["Najhitrejša rešitev","Najnižji stroški","Največja verjetnost uspeha","Uravnotežena pot","Naj presodi odvetnik"]);
    default: return info(record.description);
  }
};
const fatherQuestion = {
  full_payment:"Kako želite doseči plačilo celotnega preostalega dolga?", partial_payment_now:"Kolikšno prvo plačilo želite in kaj naj se zgodi s preostankom?",
  installment_plan:"Kako naj se dolg razdeli na obroke?", new_deadline:"Kolikšen znesek mora biti plačan do novega roka?",
  amicable_settlement:"Pod katerimi pogoji želite skleniti sporazumno poravnavo?", dispute_resolution:"Kaj je predmet ugovora in kakšen izid želite?",
  compensation:"Katero nasprotno terjatev želite pobotati?", payment_security:"Kako želite zavarovati plačilo?",
  legal_recovery:"Kateri konkretni pravni rezultat želite doseči?", insolvency_claim:"V kateri insolvenčni postopek prijavljate terjatev?",
  close_without_recovery:"Zakaj želite primer zaključiti brez izterjave?", custom_goal:"Kaj želite doseči s tem dolgom?"
};
const tone = { "placano-v-celoti":["gold","199,157,0"], delno:["coral","238,91,88"], obrok:["gold","213,174,44"], "akcija-obljuba":["coral","238,91,88"], kompenzacija:["teal","41,163,162"], ugovor:["violet","121,104,191"], insolventnost:["orange","231,133,20"], storno:["coral","238,91,88"], drugo:["orange","230,126,34"], "akcija-odvetnik":["teal","41,163,162"] };
const fatherGallery = father.records.map((record, index) => {
  const palette = tone[record.tone || (record.family === "legal-outcome-father" ? "akcija-odvetnik" : "drugo")] || tone.drugo;
  const card = { id:`father-${record.id}`, title:record.title, question:fatherQuestion[record.id] || record.description, theme:palette[0], rgb:palette[1], body:() => fatherPreview(record) };
  return `<section class="uj-template-tile" data-card-category="2.0" data-father-card-id="${record.id}"><div class="uj-template-tile__meta"><span>2.0.${String(index + 1).padStart(2, "0")}</span><p><strong>${esc(record.title)}</strong><small>${record.family === "legal-outcome-father" ? "Pravni rezultat" : "Ciljni FATHER"} · dejanska vsebina kartice</small></p></div>${templates.renderTemplate(card)}</section>`;
}).join("");
const approvalParagraph = draftCount
  ? `Prvih ${approvedCount} zasnov je potrjenih in zaklenjenih. Kartice ${approvedCount + 1}–${totalCount} so novi funkcionalni osnutki za pregled; v aplikacijo se vključijo šele po potrditvi.`
  : `Vseh ${approvedCount} zasnov je potrjenih, zaklenjenih in shranjenih v skupnem kanoničnem naboru kartic.`;
const headerParagraph = draftCount
  ? `Prvih ${approvedCount} kartic ostaja potrjenih in nespremenjenih. Dodanih je ${draftCount} novih interaktivnih razporeditev za pregled; po potrditvi jih lahko varno vključimo v nabor za vprašanja.`
  : `Vseh ${approvedCount} kartic je potrjenih in shranjenih v istem skupnem naboru. Njihov videz in vedenje ostajata zaklenjena za nadaljnje razporejanje vprašanj.`;
const headerRule = draftCount ? `${approvedCount} potrjenih · ${draftCount} novih osnutkov` : `${approvedCount} potrjenih · skupni kanonični nabor`;

const markdown = `# Atena — ${totalCount} zasnov kartic

Te zasnove izhajajo iz obstoječih kartic **Pretekle zamude**, **Neplačan obrok**, **Ugovor / reklamacija**, **Dobropis / nota** in sorodnih produkcijskih kartic zgodovine plačil.

${approvalParagraph}

## Skupna pogodba kartice

- naslov levo in krožni chevron desno;
- eno jasno vprašanje in en glavni način odgovora;
- mehka barvna tema, tanek rob, nežen gradient in 16 px zunanji radij;
- vse aktivne površine najmanj 44 px;
- širok gumb **Shrani podatke** na dnu;
- brez generičnega koraka »Dopolnite X/Y« in brez gumba »Spremeni« v glavi;
- kartica raste samo, kadar vsebina to dejansko zahteva.

## Seznam zasnov

| # | Status | ID | Zasnova | Primer vprašanja | Pokritje |
|---:|---|---|---|---|---|
${templates.templates.map((template) => `| ${template.number} | ${template.approved ? "Potrjeno" : "Nov osnutek"} | ${md(template.id)} | **${md(template.title)}** | ${md(template.question)} | ${md(template.coverage)} |`).join("\n")}

## Kategorija 2.0 — ciljni FATHER

Kategorija 2.0 vsebuje **${father.records.length} vsebinsko različnih produkcijskih FATHER kartic**: ${father.goals.length} glavnih ciljev in ${father.legalOutcomes.length} pravnih rezultatov. Vsaka kartica prikazuje lastna vprašanja in polja iz toka Cilj.

| Oznaka | Vrsta | ID | Kartica |
|---|---|---|---|
${father.records.map((record, index) => `| 2.0.${index + 1} | ${record.family === "legal-outcome-father" ? "Pravni rezultat" : "Ciljni FATHER"} | ${md(record.id)} | **${md(record.title)}** |`).join("\n")}
`;

const html = `<!doctype html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no">
  <meta name="color-scheme" content="light only">
  <title>Atena — ${totalCount} zasnov kartic</title>
  <style>${css}</style>
</head>
<body class="atena-template-page">
  <header class="uj-template-header">
    <h1>${totalCount} zasnov kartic</h1>
    <p>${headerParagraph} Kategorija 2.0 vsebuje še ${father.records.length} dejanskih, vsebinsko različnih FATHER kartic.</p>
    <span class="uj-template-header__rule">${headerRule} · ${father.records.length} FATHER kartic v 2.0</span>
  </header>
  <main>
    <section class="uj-template-gallery" data-template-gallery aria-label="${totalCount} zasnov Ateninih kartic"></section>
    <header class="uj-template-header"><h2>Kategorija 2.0 — ciljni FATHER</h2><p>Vsaka kartica prikazuje svoje produkcijsko vprašanje in svoja polja iz toka Cilj.</p></header>
    <section class="uj-template-gallery" data-father-gallery aria-label="${father.records.length} FATHER kartic kategorije 2.0">${fatherGallery}</section>
  </main>
  <script>${clientSource}</script>
  <script>
    (function () {
      var gallery = document.querySelector("[data-template-gallery]");
      gallery.innerHTML = window.UJAtenaCardTemplates.renderGallery();
      window.UJAtenaCardTemplates.bind(gallery);
      window.UJAtenaCardTemplates.bind(document.querySelector("[data-father-gallery]"));
    })();
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(outputDir, "atena-card-inventory.md"), markdown, "utf8");
fs.writeFileSync(path.join(outputDir, "atena-card-catalog.html"), html, "utf8");
console.log(`Katalog ustvarjen: ${totalCount} zasnov kartic (${approvedCount} potrjenih, ${draftCount} novih).`);
