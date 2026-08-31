"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const templates = require("../app/atena-card-templates");
const father = templates.categories["2.0"];

const root = path.resolve(__dirname, "..");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "atena-template-catalog-"));
const generated = spawnSync(process.execPath, [path.join(__dirname, "generate-atena-template-catalog.js"), output], { cwd:root, encoding:"utf8" });
assert.equal(generated.status, 0, generated.stderr || generated.stdout);

const html = fs.readFileSync(path.join(output, "atena-card-catalog.html"), "utf8");
const markdown = fs.readFileSync(path.join(output, "atena-card-inventory.md"), "utf8");
const gallery = templates.renderGallery();

assert.equal(templates.version, "atena-card-templates-v2");
assert.equal(templates.templates.length, 61, "Katalog mora imeti 30 potrjenih in 31 novih zasnov.");
assert.equal(templates.approvedTemplateIds.length, 30, "Vseh 30 zasnov mora biti v zaklenjenem kanoničnem naboru.");
assert.ok(templates.templates.slice(0, 30).every((template) => template.approved && template.approvedVersion === "2026-08-30"));
assert.ok(templates.templates.slice(30).every((template) => !template.approved && template.approvedVersion === null));
assert.equal(new Set(templates.templates.map((template) => template.id)).size, 61, "ID-ji zasnov morajo biti enolični.");
assert.ok(templates.templates.every((template) => template.title && template.question && template.coverage && template.rgb));
assert.deepEqual(templates.templates.map((template) => template.number), Array.from({ length:61 }, (_, index) => index + 1));
assert.equal((gallery.match(/data-template-id=/g) || []).length, 61);
assert.equal((gallery.match(/data-template-card=/g) || []).length, 61);
assert.equal((gallery.match(/Shrani podatke/g) || []).length, 61);
assert.equal((gallery.match(/Nov osnutek/g) || []).length, 31);
assert.equal(father.version, "atena-card-category-2.0-v1");
assert.equal(father.category, "2.0");
assert.equal(father.goals.length, 12);
assert.equal(father.legalOutcomes.length, 6);
assert.equal(father.records.length, 18);
assert.equal(new Set(father.records.map((record) => record.id)).size, 18, "Kategorija 2.0 ne sme podvojiti podatkovnih ID-jev.");
assert.ok(father.records.every((record) => templates.templates.some((template) => template.id === record.templateId)), "Vsak FATHER mora uporabljati eno od kanoničnih zasnov.");
assert.equal((html.match(/data-card-category="2\.0"/g) || []).length, 18);
assert.equal((html.match(/data-father-card-id=/g) || []).length, 18);
assert.equal(new Set(Array.from(html.matchAll(/data-template-card="father-([^"]+)"/g), (match) => match[1])).size, 18, "Vsaka FATHER kartica mora imeti lasten prikaz, ne kopije generične zasnove.");
assert.doesNotMatch(html, /Pravni rezultat · uporablja zasnovo/, "Pravni FATHER rezultati ne smejo biti le preimenovane generične kartice.");
assert.match(html, /Plačilo po pravnem opominu[\s\S]*Želite, da odvetnik oceni in pripravi pravni poziv za plačilo/);
assert.match(html, /Izvršba[\s\S]*Želite začeti prisilno izterjavo/);
assert.match(html, /Plačilni nalog \/ tožba[\s\S]*Želite sodno uveljaviti terjatev/);
assert.match(markdown, /Kategorija 2\.0 — ciljni FATHER/);
assert.match(html, /\.uj-card-recurrence__days\s*\{[^}]*grid-template-columns:\s*repeat\(7,/);

const weeklyCard = gallery.match(/<article[^>]*data-template-card="tedenski-termini"[\s\S]*?<\/article>/)?.[0] || "";
assert.match(weeklyCard, />Pon<[\s\S]*>Tor<[\s\S]*>Sre<[\s\S]*>Čet<[\s\S]*>Pet<[\s\S]*>Sob<[\s\S]*>Ned</, "Tedenski termini morajo prikazati vseh sedem dni.");
assert.equal((weeklyCard.match(/data-slot=/g) || []).length, 14, "Tedenski termini morajo ponuditi dopoldanski in popoldanski izbor za vseh sedem dni.");
assert.match(html, /\.uj-card-week__row\s*\{[^}]*grid-template-columns:\s*34px repeat\(7,/, "Tedenska mreža mora imeti sedem enakomernih dnevnih stolpcev.");
assert.match(html, /UJAtenaCardTemplates\.bind\(gallery\)/, "Interakcije tedenske mreže morajo biti vezane na dejansko galerijo.");

const durationCard = gallery.match(/<article[^>]*data-template-card="stevilcna-lestvica"[\s\S]*?<\/article>/)?.[0] || "";
assert.match(durationCard, /Izbrano:\s*<b data-number-confirmation>12 mesecev<\/b>/, "Trajanje vezave mora nad možnostmi vedno pokazati trenutno izbiro.");
assert.match(html, /\.uj-card-selection-note\s*\{[^}]*font-size:\s*8px[^}]*white-space:\s*nowrap/, "Potrditev izbire mora ostati majhna in v eni vrstici.");
assert.match(fs.readFileSync(path.join(root, "app", "atena-card-templates.js"), "utf8"), /updateNumberChoiceConfirmation\(numberGroup, choice\.dataset\.cardChoice\)[\s\S]*updateNumberChoiceConfirmation\(customGroup, event\.target\.value\)/, "Potrditev mora slediti tako hitri izbiri kot ročnemu vnosu.");

[
  "da-ne-ne-vem", "stevilcna-lestvica", "dvojni-segment", "mreza-izbir", "navpicni-izbor",
  "spustni-seznam", "besedilni-vnos", "natancen-znesek", "znesek-ali-odstotek", "kolicina-in-enota",
  "drsnik-razpona", "datum-z-gotovostjo", "termin-in-pogostost", "seznam-postavk", "dokazilo",
  "razdelitev-proracuna", "primerjava-moznosti", "casovnica-mejnikov", "razvrscanje-prioritet", "tedenski-termini",
  "ocenjevalna-matrika", "dvojni-razpon", "pogojna-garancija", "mini-koledar", "kontrolni-seznam-dokazil",
  "matrika-tveganja", "izbirnik-oznak", "placilni-razrez", "trenutno-proti-cilju", "odlocitvena-pot",
  "cenovni-most", "trend-odzivnosti", "ciljni-pas", "ocena-z-negotovostjo", "primerjava-sprememb",
  "prekoracitve-praga", "hierarhicni-izbor", "iskalni-izbirnik", "pravilo-ponavljanja", "relativni-rok",
  "lokacija-in-doseg", "obrocni-nacrt", "matrika-vkljucenosti", "parna-primerjava", "pregled-odgovorov",
  "obcutljivost-izida", "mesalnik-scenarija", "prag-verjetnosti-zamude", "toplotni-koledar", "lijak-izterjave",
  "mreza-odvisnosti", "pogajalski-prostor", "skupine-odstopanj", "pasovi-zmogljivosti", "ujemanje-pogojev-dokazil",
  "gradnik-pravila-eskalacije", "sled-izvora-podatka", "prag-rentabilnosti", "drevo-pricakovane-vrednosti", "kaskada-krsitve", "graficni-cenovni-most"
].forEach((id) => assert.match(gallery, new RegExp(`data-template-id="${id}"`)));

const newTemplateIds = [
  "obcutljivost-izida", "mesalnik-scenarija", "prag-verjetnosti-zamude", "toplotni-koledar", "lijak-izterjave",
  "mreza-odvisnosti", "pogajalski-prostor", "skupine-odstopanj", "pasovi-zmogljivosti", "ujemanje-pogojev-dokazil",
  "gradnik-pravila-eskalacije", "sled-izvora-podatka", "prag-rentabilnosti", "drevo-pricakovane-vrednosti", "kaskada-krsitve"
];
const newCards = Object.fromEntries(newTemplateIds.map((id) => {
  const match = gallery.match(new RegExp(`<article[^>]*data-template-card="${id}"[\\s\\S]*?<\\/article>`));
  assert.ok(match, `Nova kartica ${id} mora biti izrisana v galeriji.`);
  return [id, match[0]];
}));
const newCardsHtml = newTemplateIds.map((id) => newCards[id]).join("");
const newCardContracts = {
  "obcutljivost-izida": [/data-sensitivity(?:\s|>)/, /data-sensitivity-range/, /data-sensitivity-number/, /data-sensitivity-summary/],
  "mesalnik-scenarija": [/data-scenario-mixer/, /data-scenario-preset/, /data-scenario-range/, /data-scenario-number/, /data-scenario-save-criteria/, /data-scenario-add/, /data-scenario-name/, /data-scenario-summary/],
  "prag-verjetnosti-zamude": [/data-probability(?:\s|>)/, /data-probability-range/, /data-probability-number/, /data-probability-count/, /data-probability-percent/, /data-probability-summary/],
  "toplotni-koledar": [/data-heatmap/, /data-heat-cell/, /data-heat-day="nedelja"/, /data-heat-mark/, /data-heat-summary/],
  "lijak-izterjave": [/data-funnel(?:\s|>)/, /data-funnel-base/, /data-funnel-paid/, /data-funnel-rate/, /data-funnel-input/, /data-funnel-summary/],
  "mreza-odvisnosti": [/data-dependencies/, /data-dependency-node/, /data-dependency-summary/],
  "pogajalski-prostor": [/data-plane(?:\s|>)/, /data-plane-payment/, /data-plane-detail-range/, /data-plane-detail-number/, /data-plane-discount-range/, /data-plane-discount-number/, /data-plane-recommended/, /data-plane-summary/],
  "skupine-odstopanj": [/data-clause-grouping/, /data-clause-item/, /data-clause-choice/, /data-clause-summary/],
  "pasovi-zmogljivosti": [/data-capacity(?:\s|>)/, /data-capacity-task/, /data-capacity-team/, /data-capacity-target/, /data-capacity-summary/],
  "ujemanje-pogojev-dokazil": [/data-matching/, /data-match-claim/, /data-match-correct/, /data-match-evidence/, /data-match-summary/],
  "gradnik-pravila-eskalacije": [/data-condition-builder/, /data-condition-join/, /data-condition-value/, /data-condition-action/, /data-condition-summary/],
  "sled-izvora-podatka": [/data-provenance(?:\s|>)/, /data-provenance-source/, /data-provenance-answer/, /data-provenance-age-range/, /data-provenance-age-number/, /data-provenance-summary/],
  "prag-rentabilnosti": [/data-breakeven(?:\s|>)/, /data-breakeven-progress/, /data-breakeven-target/, /data-breakeven-current/, /data-breakeven-range/, /data-breakeven-number/, /data-breakeven-summary/],
  "drevo-pricakovane-vrednosti": [/data-expected-value/, /data-expected-action/, /data-expected-action-result/, /data-expected-range/, /data-expected-number/, /data-expected-summary/],
  "kaskada-krsitve": [/data-cascade(?:\s|>)/, /data-cascade-event/, /data-cascade-action/, /data-cascade-guard/, /data-cascade-outcome/, /data-cascade-summary/]
};
Object.entries(newCardContracts).forEach(([id, patterns]) => {
  patterns.forEach((pattern) => assert.match(newCards[id], pattern, `Kartici ${id} manjka zahtevani koren, kontrola ali povzetek: ${pattern}.`));
  assert.match(newCards[id], /data-card-reset/, `Kartica ${id} mora imeti lastno ponastavitev.`);
});
assert.equal((newCardsHtml.match(/data-card-reset/g) || []).length, 15, "Vsaka nova kartica 46–60 mora imeti natanko eno ponastavitev.");
assert.equal((newCardsHtml.match(/class="uj-answer-card__actions"/g) || []).length, 15, "Kartice 46–60 morajo imeti skupno vrstico dejanj.");
Object.entries(newCards).forEach(([id, card]) => assert.match(card, /uj-answer-card__actions[\s\S]*data-card-reset[\s\S]*data-card-save/, `Kartica ${id} mora imeti Ponastavi levo in Shrani podatke desno.`));
assert.equal((newCards["obcutljivost-izida"].match(/data-sensitivity-row(?:\s|>)/g) || []).length, 3, "Občutljivost mora imeti tri dejavnike.");
assert.equal((newCards["obcutljivost-izida"].match(/type="range" min="-30" max="30" step="1" value="0" data-sensitivity-range/g) || []).length, 3, "Vsi vplivi morajo imeti nevtralen razpon od −30 do +30 odstotkov.");
assert.equal((newCards["obcutljivost-izida"].match(/<output data-sensitivity-number/g) || []).length, 3, "Predznačena vrednost vpliva mora biti v neodrezanem izpisu.");
assert.doesNotMatch(newCards["obcutljivost-izida"], /input type="number"[^>]*data-sensitivity-number/, "Premica mora biti edina interaktivna kontrola vpliva.");
assert.match(newCards["obcutljivost-izida"], /Cena ostane enaka · ocena 12\.000 €/, "Vsi nevtralni vplivi morajo ohraniti osnovno ceno.");
assert.match(newCards["mesalnik-scenarija"], /Koliko denarja potrebujete na računu, da lahko delo normalno dokončate\?/, "Vprašanje o rezervi mora biti neposredno in razumljivo obrtniku.");
assert.match(newCards["mesalnik-scenarija"], /Obseg projekta[\s\S]*Predplačilo kupca[\s\S]*Zamuda plačila/, "Parametri scenarija morajo slediti vrstnemu redu izračuna.");
assert.match(newCards["mesalnik-scenarija"], /Realno · potrebna rezerva 11\.760 €/, "Privzeti realni scenarij mora prikazati logično izračunano rezervo.");
assert.match(newCards["mesalnik-scenarija"], /Stresno<\/button><button type="button" data-scenario-add>\+ Dodaj scenarij<\/button>[\s\S]*Shrani nove kriterije[\s\S]*Ime scenarija[\s\S]*Uporabljene bodo spodnje vrednosti/, "Dodaj scenarij mora biti kompaktna četrta ploščica ob privzetih scenarijih.");
assert.doesNotMatch(newCards["mesalnik-scenarija"], />Po meri</, "Nejasno stanje Po meri mora nadomestiti dejanski gumb za dodajanje scenarija.");
assert.equal((newCards["prag-verjetnosti-zamude"].match(/data-probability-dot(?:\s|>)/g) || []).length, 20, "Prag zamude mora prikazati vseh 20 izidov.");
assert.match(newCards["prag-verjetnosti-zamude"], /Majhna možnost · 5 od 20 primerov traja dlje kot 10 dni/, "Prag zamude mora uporabljati preprost jezik.");
assert.match(html, /\.uj-card-probability__plot::after\s*\{[^}]*border-top:\s*2px dashed #26302e/, "Meja zamude mora biti jasno vidna s črno črtkano črto.");
assert.doesNotMatch(html, /content:\s*["']meja["']/, "Graf ne sme prikazovati drobnega napisa meja.");
assert.equal((newCards["toplotni-koledar"].match(/data-heat-cell(?:\s|>)/g) || []).length, 28, "Koledar mora imeti 4 tedne po vseh 7 dnevih.");
assert.equal((newCards["toplotni-koledar"].match(/button type="button" data-heat-mode=/g) || []).length, 2, "Toplotni koledar mora imeti jasna gumba za povečanje in zmanjšanje zasedenosti.");
assert.equal((newCards["toplotni-koledar"].match(/data-heat-mark/g) || []).length, 28, "Vsaka celica mora imeti grafični nivo brez številke.");
assert.equal((newCards["toplotni-koledar"].match(/<button type="button" data-heat-cell[^>]*><span data-heat-mark aria-hidden="true"><i><\/i><i><\/i><i><\/i><\/span><\/button>/g) || []).length, 28, "V celicah morajo biti prvotne tri preproste črtice brez številk.");
assert.equal((newCards["toplotni-koledar"].match(/data-level="[0-3]"/g) || []).length, 4, "Legenda mora prikazati štiri grafične stopnje.");
assert.equal((newCards["toplotni-koledar"].match(/data-heat-cell(?:\s|>)/g) || []).length, 28, "Koledar mora imeti štiri tedne od ponedeljka do nedelje.");
assert.match(newCards["toplotni-koledar"], />Pon<[\s\S]*>Tor<[\s\S]*>Sre<[\s\S]*>Čet<[\s\S]*>Pet<[\s\S]*>Sob<[\s\S]*>Ned</, "Koledar mora prikazati vseh sedem dni.");
assert.match(newCards["toplotni-koledar"], /data-heat-day="sobota"/, "Koledar mora vključiti soboto.");
assert.match(newCards["toplotni-koledar"], /data-heat-day="nedelja"/, "Koledar mora vključiti nedeljo.");
assert.equal((newCards["toplotni-koledar"].match(/<i><\/i><i><\/i><i><\/i>/g) || []).length, 28, "Vsaka stopnja mora uporabljati tri preproste črtice brez številk.");
assert.doesNotMatch(newCards["toplotni-koledar"], /data-heat-total=/, "Toplotni koledar ne sme prikazovati številčnih vsot.");
assert.match(newCards["toplotni-koledar"], /Najbolj zaseden dan: sreda/, "Koledar mora preprosto povedati, kateri dan je najbolj zaseden.");
assert.match(newCards["toplotni-koledar"], /data-heat-mode="remove"[\s\S]*Zmanjšaj[\s\S]*data-heat-mode="add"[\s\S]*Povečaj/, "Načina zmanjšanja in povečanja morata biti jasna in v logičnem vrstnem redu.");
assert.equal((newCards["lijak-izterjave"].match(/data-funnel-stage(?:\s|>)/g) || []).length, 4, "Lijak mora imeti štiri stopnje.");
assert.match(newCards["lijak-izterjave"], /Prejeli ste 6\.200 € od 18\.000 €/, "Koraki plačila morajo uporabljati preprost jezik.");
assert.equal((newCards["mreza-odvisnosti"].match(/data-dependency-node(?:\s|>)/g) || []).length, 4, "Mreža odvisnosti mora imeti štiri vozlišča.");
assert.equal((newCards["mreza-odvisnosti"].match(/data-dep-step=/g) || []).length, 4, "Vsak korak mora imeti svojo zaporedno številko.");
assert.doesNotMatch(newCards["mreza-odvisnosti"], /blokirano|>×</, "Kartica ne sme uporabniku kazati tehničnega stanja blokirano ali križcev.");
assert.doesNotMatch(newCards["mreza-odvisnosti"], /aria-disabled="true"/, "Vsi koraki morajo biti klikljivi za izvedbo ali jasno razlago.");
assert.match(newCards["mreza-odvisnosti"], /Najprej uredite in potrdite: Dokumenti/, "Kartica mora začeti pri prvem koraku in jasno zahtevati potrditev.");
assert.match(newCards["mreza-odvisnosti"], /data-dep-id="documents"[\s\S]*aria-current="step"[\s\S]*Potrdi, ko je urejeno/, "Dokumenti morajo biti prvi aktivni korak z jasnim navodilom za potrditev.");
assert.doesNotMatch(newCards["mreza-odvisnosti"], /class="is-done"/, "Noben korak ne sme biti vnaprej označen kot urejen.");
assert.match(html, /\.uj-card-dependencies__graph > button\.is-current\s*\{[^}]*background:\s*#fff/, "Trenutni, še nepotrjeni korak mora imeti belo notranjost in zelen okvir.");
assert.equal((newCards["mesalnik-scenarija"].match(/data-scenario-add/g) || []).length, 1, "Ročne nastavitve morajo imeti en jasen gumb za dodajanje scenarija.");
assert.match(html, /\.uj-card-scenario__presets\s*\{[^}]*grid-template-columns:\s*repeat\(4,/, "Štirje vidni scenarijski gumbi morajo enakomerno zapolniti celo vrstico, dodatni pa se prestavijo v novo vrstico.");
assert.match(fs.readFileSync(path.join(root, "app", "atena-card-templates.js"), "utf8"), /dataset\.scenarioDelete[\s\S]*deleteScenarioPreset/, "Vsak dodani scenarij mora imeti lasten gumb za brisanje.");
assert.equal((newCards["skupine-odstopanj"].match(/data-clause-item=/g) || []).length, 4, "Razvrstitev mora imeti štiri pogodbena odstopanja.");
assert.equal((newCards["skupine-odstopanj"].match(/data-clause-toggle/g) || []).length, 4, "Vsak sporni pogoj mora imeti svoj izbirnik.");
assert.equal((newCards["skupine-odstopanj"].match(/data-clause-choice=/g) || []).length, 16, "Vsak izbirnik mora ponuditi štiri jasne možnosti.");
assert.doesNotMatch(newCards["skupine-odstopanj"], /<select|<option/, "Kartica ne sme uporabljati zastarelega sistemskega spustnega seznama.");
assert.match(html, /\.uj-card-grouping__select \[data-clause-menu\]\s*\{[^}]*position:\s*absolute/, "Meni spornih pogojev mora biti plavajoč in ne sme raztegniti kartice.");
assert.equal((newCards["pasovi-zmogljivosti"].match(/data-capacity-lane=/g) || []).length, 3, "Zmogljivost mora imeti tri ekipne pasove.");
assert.equal((newCards["pasovi-zmogljivosti"].match(/data-capacity-team=/g) || []).length, 3, "Vsako delo mora hraniti trenutno ekipo.");
assert.match(newCards["pasovi-zmogljivosti"], /1<\/span>Izberite delo[\s\S]*2<\/span>Izberite ekipo/, "Premik dela mora imeti dva kratka in jasna koraka.");
assert.doesNotMatch(newCards["pasovi-zmogljivosti"], /Premakni sem/, "Ekipne vrstice ne smejo uporabljati visokih gumbov Premakni sem.");
assert.equal((newCards["ujemanje-pogojev-dokazil"].match(/data-match-correct=/g) || []).length, 3, "Vsak pogoj mora poznati svoje pravilno dokazilo.");
assert.equal((newCards["ujemanje-pogojev-dokazil"].match(/data-match-tone=/g) || []).length, 6, "Vsak pogoj in pripadajoče dokazilo morata imeti isto prepoznavno barvo.");
assert.doesNotMatch(newCards["ujemanje-pogojev-dokazil"], /data-match-pairs/, "Podvojena vrstica že ustvarjenih parov mora biti odstranjena.");
assert.match(html, /classList\.add\("is-wrong"\)[\s\S]*Ne ustreza\. Poskusite drugo dokazilo\./, "Napačno dokazilo mora ostati popravljivo brez ponovne izbire pogoja.");
assert.match(html, /nextMatchClaim[\s\S]*Zdaj izberite dokazilo za:/, "Po pravilni povezavi se mora samodejno pripraviti naslednji nepovezani pogoj.");
assert.match(newCards["gradnik-pravila-eskalacije"], /Vsaj en pogoj \(ALI\)/, "Izbira pogojev mora uporabljati preprost in pravilen izraz ALI.");
assert.doesNotMatch(newCards["gradnik-pravila-eskalacije"], /\bALL\b/, "Kartica pogojev ne sme mešati napačnega angleškega izraza ALL.");
assert.equal((newCards["gradnik-pravila-eskalacije"].match(/data-condition-index=/g) || []).length, 2, "Pogoja morata biti prikazana kot dve jasni oštevilčeni vrstici.");
assert.doesNotMatch(newCards["gradnik-pravila-eskalacije"], /<select|<option/, "Gradnik pravila ne sme uporabljati zastarelih sistemskih spustnih seznamov.");
assert.equal((newCards["gradnik-pravila-eskalacije"].match(/data-condition-select(?:\s|>)/g) || []).length, 5, "Vseh pet izbir mora uporabljati enoten plavajoči meni.");
assert.match(html, /\.uj-card-condition__select \[data-condition-menu\]\s*\{[^}]*position:\s*absolute/, "Meniji gradnika pravila morajo plavati nad kartico in je ne smejo raztegniti.");
assert.match(html, /\.uj-card-condition__select \[data-condition-menu\]\s*\{[^}]*bottom:\s*calc\(100% \+ 6px\)[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/, "Vsi preprosti kartični meniji morajo uporabljati potrjeno Atenino mrežo in se odpreti navzgor.");
assert.match(html, /\.uj-card-condition__select \[data-condition-choice\]:last-child:nth-child\(odd\)\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*min-height:\s*48px/, "Zadnja liha možnost mora zapolniti celo vrstico.");
assert.doesNotMatch(gallery, /<select\b|<option\b/, "Nobena kartica ne sme več uporabljati sistemskega spustnega menija.");
assert.equal((newCards["ujemanje-pogojev-dokazil"].match(/data-match-(?:claim|evidence)=/g) || []).length, 6, "Ujemanje mora ponuditi tri pogoje in tri dokazila.");
assert.equal((newCards["gradnik-pravila-eskalacije"].match(/data-condition-row(?:\s|>)/g) || []).length, 2, "Gradnik pravila mora imeti dve pogojni vrstici.");
assert.equal((newCards["pogajalski-prostor"].match(/data-plane-payment=/g) || []).length, 4, "Dogovor o popustu mora ponuditi štiri preproste načine plačevanja.");
assert.equal((newCards["pogajalski-prostor"].match(/data-plane-detail-label=/g) || []).length, 4, "Vsak način plačila mora določati svoje prilagojeno vprašanje.");
assert.match(newCards["pogajalski-prostor"], /<span data-plane-detail-question>/, "Izbrano vprašanje se mora prikazati nad drsnikom brez prepisovanja gumbov.");
assert.match(newCards["pogajalski-prostor"], /Pogosto zamuja[\s\S]*Včasih zamuja[\s\S]*Plača v roku[\s\S]*Plača vnaprej/, "Štirje načini plačila morajo ostati jasni in v logičnem vrstnem redu.");
assert.match(newCards["pogajalski-prostor"], /Koliko dni po roku običajno plača\?[\s\S]*Kolikokrat na leto zamudi\?[\s\S]*V koliko dneh plača račun\?[\s\S]*Koliko računa plača vnaprej\?/, "Vsak način mora imeti jasno vsebinsko drugačno vprašanje.");
assert.match(newCards["pogajalski-prostor"], /data-plane-detail-unit="dni"[\s\S]*data-plane-detail-unit="krat"[\s\S]*data-plane-detail-unit="dni"[\s\S]*data-plane-detail-unit="%"/, "Vprašanja morajo uporabljati pravilne enote dni, krat in odstotek.");
assert.equal((newCards["pogajalski-prostor"].match(/data-plane-detail-unit-label/g) || []).length, 1, "Dinamična enota mora imeti svoj element in ne sme prepisati besedila gumba.");
assert.match(html, /uj-card-plane\[data-plane-index="3"\][\s\S]*translate\(calc\(100% \+ 4px\), calc\(100% \+ 4px\)\)/, "Izbrano polje mora imeti drseč indikator za vse štiri položaje.");
assert.doesNotMatch(newCards["pogajalski-prostor"], /data-plane-handle/, "Dogovor o popustu ne sme uporabljati zapletenega 2D grafa.");
assert.equal((newCards["sled-izvora-podatka"].match(/data-provenance-answer=/g) || []).length, 2, "Potrditev podatka mora imeti dve medsebojno izključujoči možnosti.");
assert.match(newCards["sled-izvora-podatka"], /Od kod je podatek\?[\s\S]*Kako star je\?[\s\S]*Je podatek potrjen\?/, "Zaupanje podatku mora biti razdeljeno na tri vsakdanja vprašanja.");
assert.match(newCards["sled-izvora-podatka"], /Da, potrjen je[\s\S]*Ne, podatki se ne ujemajo/, "Odgovora o potrditvi morata biti jasna.");
assert.match(newCards["prag-rentabilnosti"], /Za pokritje potrebujete[\s\S]*data-breakeven-threshold>60 poslov/, "Cilj mora jasno povedati potrebno število poslov.");
assert.match(newCards["prag-rentabilnosti"], /Do pokritja manjka 1 posel\. Zdaj ste 60 € v minusu\./, "Začetno stanje mora povedati, kaj še manjka.");
assert.match(newCards["prag-rentabilnosti"], /data-breakeven-price[\s\S]*data-breakeven-variable[\s\S]*data-breakeven-fixed/, "Obrtnik mora lahko spremeniti ceno posla, strošek posla in stalne stroške.");
assert.match(newCards["prag-rentabilnosti"], /graf se premakne takoj[\s\S]*data-breakeven-plot[\s\S]*data-breakeven-revenue-line[\s\S]*data-breakeven-cost-line[\s\S]*data-breakeven-target-marker[\s\S]*data-breakeven-marker/, "Graf mora imeti obe živi črti, označeno pokritje in premično trenutno število.");
assert.doesNotMatch(newCards["prag-rentabilnosti"], /Prag rentabilnosti|\benot\b|data-breakeven-handle/, "Kartica stroškov ne sme uporabljati računovodskega žargona ali ločene navidezne ročice.");
assert.equal((newCards["drevo-pricakovane-vrednosti"].match(/data-expected-action=/g) || []).length, 3, "Drevo pričakovane vrednosti mora ponuditi tri ukrepe.");
assert.equal((newCards["drevo-pricakovane-vrednosti"].match(/data-expected-action-result/g) || []).length, 3, "Vsak ukrep mora že na izbiri pokazati pričakovani znesek.");
assert.doesNotMatch(newCards["drevo-pricakovane-vrednosti"], /Izterjani delež|pričakovani neto izid/, "Primerjava ukrepov mora uporabljati preprost jezik.");
assert.equal((newCards["kaskada-krsitve"].match(/data-cascade-event=/g) || []).length, 3, "Kaskada mora ponuditi tri začetne dogodke.");
assert.equal((newCards["kaskada-krsitve"].match(/data-cascade-guard=/g) || []).length, 3, "Kartica mora ponuditi tri jasne ukrepe.");
assert.equal((newCards["kaskada-krsitve"].match(/data-cascade-action(?:\s|>)/g) || []).length, 3, "Vsaka izbira mora pokazati konkreten ukrep.");
assert.equal((newCards["kaskada-krsitve"].match(/data-cascade-outcome=/g) || []).length, 3, "Uporabnik mora izbrati enega od treh rezervnih korakov.");
assert.match(newCards["kaskada-krsitve"], /Kaj je narobe\?[\s\S]*Kaj naredite najprej\?[\s\S]*Če to ne pomaga\?/, "Potek mora imeti tri preproste in jasne korake.");
assert.match(newCards["kaskada-krsitve"], /data-cascade-guard[^>]*disabled[\s\S]*data-cascade-outcome[^>]*disabled/, "Naslednja koraka morata počakati na predhodno izbiro.");
assert.doesNotMatch(newCards["kaskada-krsitve"], /class="is-selected"[^>]*data-cascade-event|Kako se je končalo|Kaskada|Varovalka|eskalacija|Končni izid|Prekinitev|Ustavi tukaj/, "Kartica ne sme vnaprej izbrati težave ali uporabljati tehničnega oziroma nelogičnega jezika.");

assert.match(gallery, /input type="range"/);
assert.match(gallery, /data-range-mode-group/);
assert.match(gallery, /data-range-bars/);
assert.match(gallery, /Rok plačila/);
assert.doesNotMatch(gallery.match(/data-template-card="drsnik-razpona"[\s\S]*?<\/article>/)?.[0] || "", /Hitra izbira|data-range-presets/, "Kartica 11 mora uporabljati samo neposredni drsnik.");
assert.equal((gallery.match(/data-number-custom/g) || []).length, 1, "Številčna izbira kartice 2 mora ponuditi lasten vnos.");
assert.equal((gallery.match(/placeholder="Vnesi"/g) || []).length, 1);
assert.match(gallery, /data-card-stepper/);
assert.match(gallery, /data-card-date/);
assert.match(gallery, /data-card-list/);
assert.match(gallery, /data-card-upload/);
assert.match(gallery, /data-card-allocation/);
assert.match(gallery, /uj-card-comparison/);
assert.match(gallery, /data-card-timeline/);
assert.match(gallery, /data-priority-list/);
assert.match(gallery, /data-slot-grid/);
assert.match(gallery, /data-score-card/);
assert.match(gallery, /data-dual-range/);
assert.match(gallery, /data-warranty-panel/);
assert.match(gallery, /data-mini-calendar/);
assert.match(gallery, /data-checklist/);
assert.match(gallery, /data-risk-matrix/);
assert.match(gallery, /data-tag-picker/);
assert.match(gallery, /data-payment-split/);
assert.match(gallery, /data-goal-card/);
assert.match(gallery, /data-decision-card/);
const simplePriceCard = gallery.match(/<article[^>]*data-template-card="cenovni-most"[\s\S]*?<\/article>/)[0];
const graphicPriceCard = gallery.match(/<article[^>]*data-template-card="graficni-cenovni-most"[\s\S]*?<\/article>/)[0];
assert.match(simplePriceCard, /data-waterfall/);
assert.equal((simplePriceCard.match(/data-waterfall-total=/g) || []).length, 5, "Preprosta cena mora hraniti vseh pet tekočih seštevkov.");
assert.match(simplePriceCard, /data-waterfall-total="880"/);
assert.match(simplePriceCard, /data-waterfall-total="1100"/);
assert.match(simplePriceCard, /data-waterfall-total="1342"/);
assert.match(simplePriceCard, /Kako nastane končna cena\?[\s\S]*Osnovna cena[\s\S]*Popust[\s\S]*Dodatna dela[\s\S]*DDV[\s\S]*Končna cena/, "Preprosta različica mora ostati nespremenjena in berljiva kot račun.");
assert.doesNotMatch(simplePriceCard, /Cenovni most|Waterfall graf|waterfall-bottom|waterfall-height|waterfall-end/, "Preprosta različica ne sme znova postati graf s stolpci.");
assert.match(graphicPriceCard, /Cenovni most[\s\S]*data-price-bridge[\s\S]*Osnovna cena[\s\S]*Popust[\s\S]*Dodatna dela[\s\S]*DDV 22 %[\s\S]*Končna cena/, "Kartica 61 mora vrniti grafični cenovni most z jasnimi oznakami.");
assert.equal((graphicPriceCard.match(/data-price-bridge-step/g) || []).length, 5, "Grafični cenovni most mora imeti pet zaporednih klikljivih korakov.");
assert.match(graphicPriceCard, /1\.000 €[\s\S]*− 120 €[\s\S]*\+ 220 €[\s\S]*\+ 242 €[\s\S]*1\.342 €/, "Pod grafom mora biti izpisan celoten račun.");
assert.match(graphicPriceCard, /data-bridge-start="0" data-bridge-end="1000"[\s\S]*data-bridge-start="1000" data-bridge-end="880"[\s\S]*data-bridge-start="880" data-bridge-end="1100"[\s\S]*data-bridge-start="1100" data-bridge-end="1342"[\s\S]*data-bridge-start="0" data-bridge-end="1342"/, "Cenovni most mora slediti pravilni kumulativni poti 1.000 → 880 → 1.100 → 1.342.");
assert.match(graphicPriceCard, /skupaj 1\.000 €[\s\S]*ostane 880 €[\s\S]*skupaj 1\.100 €[\s\S]*skupaj 1\.342 €[\s\S]*za plačilo/, "Vsak korak mora jasno pokazati tekoči seštevek.");
assert.equal((graphicPriceCard.match(/data-bridge-segment="base"/g) || []).length, 5, "Osnovni del mora biti viden v vsakem stolpcu.");
assert.equal((graphicPriceCard.match(/data-bridge-segment="discount"/g) || []).length, 1, "Popust mora biti kot črtasti odvzeti del nad osnovo.");
assert.equal((graphicPriceCard.match(/data-bridge-segment="work"/g) || []).length, 3, "Dodatna dela morajo ostati vidna v vseh naslednjih stolpcih.");
assert.equal((graphicPriceCard.match(/data-bridge-segment="tax"/g) || []).length, 2, "DDV mora biti viden v DDV in končnem stolpcu.");
assert.match(html, /\.uj-card-price-bridge__chart\s*\{[^}]*grid-template-columns:\s*repeat\(5,/, "Cenovni most mora prikazati pet zaporednih stolpcev.");
assert.match(html, /\.uj-card-price-bridge__stack i\.is-base\s*\{[^}]*#eab56a[\s\S]*\.uj-card-price-bridge__stack i\.is-discount\s*\{[^}]*#c94f4a[\s\S]*\.uj-card-price-bridge__stack i\.is-work\s*\{[^}]*#e98d28[\s\S]*\.uj-card-price-bridge__stack i\.is-tax\s*\{[^}]*#9e5b1f/, "Osnova, popust, dodatna dela in DDV morajo imeti jasno različne barve.");
assert.match(html, /button\.is-negative \.uj-card-price-bridge__label b,[\s\S]*#b83e39[\s\S]*button\.is-positive \.uj-card-price-bridge__label b,[\s\S]*#c66d08[\s\S]*button\.is-tax \.uj-card-price-bridge__label b,[\s\S]*#824514/, "Ime in vrednost vsakega koraka morata uporabiti barvo svojega segmenta.");
assert.doesNotMatch(html, /button\.is-tax \.uj-card-price-bridge__visual\s*\{[^}]*box-shadow/, "DDV ne sme imeti praznega okvirja čez celoten stolpec.");
assert.match(gallery, /data-trend-card/);
assert.match(gallery, /data-trend-selected-label/);
assert.match(gallery, /data-trend-period="3m" class="is-selected"/);
assert.match(gallery, /1 mesec/);
assert.match(gallery, /data-trend-scale/);
assert.match(gallery, /Merilo odziva/);
assert.match(gallery, /Povlecite krogce gor ali dol/);
assert.equal((gallery.match(/data-trend-input/g) || []).length, 6, "Trend mora ponuditi šest podprtih vlečljivih časovnih točk.");
assert.match(gallery, /data-bullet-card/);
assert.match(gallery, /data-bullet-marker-value/);
assert.match(gallery, /data-bullet-status-title/);
assert.match(gallery, /data-bullet-step="-0\.1"/);
assert.match(gallery, /data-bullet-input[^>]*aria-valuetext="4,2 dneva"/);
assert.match(gallery, /V cilju/);
assert.match(gallery, /Opozorilo/);
assert.match(gallery, /Kršitev/);
assert.match(gallery, /data-estimate-card/);
assert.match(gallery, /data-estimate-summary/);
assert.match(gallery, /data-estimate-marker/);
assert.match(gallery, /data-estimate-width/);
assert.match(gallery, /Meji razpona/);
assert.match(gallery, /data-change-card/);
assert.equal((gallery.match(/data-change-input/g) || []).length, 6, "Vsaka vrstica primerjave mora imeti drsnika Prej in Zdaj.");
assert.equal((gallery.match(/data-change-role="from"/g) || []).length, 3);
assert.equal((gallery.match(/data-change-role="now"/g) || []).length, 3);
assert.match(gallery, /data-change-from-value/);
assert.match(gallery, />Prej</);
assert.match(gallery, />Zdaj</);
assert.match(gallery, /data-threshold-card/);
assert.match(gallery, /data-threshold-summary/);
assert.match(gallery, /data-threshold-list/);
assert.match(gallery, /Dogovorjeni rok[\s\S]*5 dni/);
assert.match(gallery, /Vsi odgovori/);
assert.match(gallery, /Samo zamujeni[\s\S]*Odgovor: 7 dni[\s\S]*2 dni prepozno/, "Kartica mora brez grafa neposredno povedati, kateri odgovor je zamujal in za koliko dni.");
assert.doesNotMatch(gallery, /Prekoračitve praga|nad mejo|pod mejo|Threshold timeline|uj-card-threshold__bar|data-threshold-scale/, "Kartica zamujenih odgovorov ne sme uporabljati finančnega žargona ali nejasnega grafa.");
assert.match(gallery, /data-tree-card/);
assert.match(gallery, /data-combobox/);
assert.match(gallery, /data-recurrence/);
assert.match(gallery, /data-relative-deadline/);
assert.match(
  fs.readFileSync(path.join(root, "app", "atena-card-templates.js"), "utf8"),
  /conditionControl\.matches\("\[data-recurrence-unit\], \[data-recurrence-end\]"\)[\s\S]*recurrenceText\([\s\S]*conditionControl\.matches\("\[data-relative-anchor\]"\)[\s\S]*relativeDeadlineText\(/,
  "Izbira v poenotenem meniju mora takoj osvežiti pravilo ponavljanja in relativni rok."
);
assert.match(gallery, /data-radius-card/);
assert.match(gallery, /data-radius-range[^>]*aria-valuetext="25 km"/);
assert.match(gallery, /data-installments/);
assert.match(gallery, /step="1"[^>]*data-installment-count/);
assert.match(gallery, /data-inclusion-card/);
assert.doesNotMatch(gallery, /uj-card-inclusion__legend/);
assert.doesNotMatch(gallery, /data-inclusion-summary/);
assert.equal((gallery.match(/data-inclusion-choice=/g) || []).length, 9);
assert.equal((gallery.match(/<b>Vključeno<\/b>/g) || []).length, 3);
assert.equal((gallery.match(/<b>Doplačilo<\/b>/g) || []).length, 3);
assert.equal((gallery.match(/<b>Ni vključeno<\/b>/g) || []).length, 3);
assert.match(gallery, /data-inclusion-included/);
assert.match(gallery, /data-inclusion-extra/);
assert.match(gallery, /data-inclusion-excluded/);
assert.match(gallery, /data-pairwise/);
assert.match(gallery, /data-pairings=/);
assert.match(gallery, /data-pair-prompt/);
assert.match(gallery, /1 od 4/);
assert.match(html, /\.uj-card-pairwise__options b\s*\{[^}]*font-size:\s*15px/);
const pairwiseMarkup = templates.templates.find((template) => template.id === "parna-primerjava").body();
const pairings = JSON.parse(decodeURIComponent(pairwiseMarkup.match(/data-pairings="([^"]+)"/)[1]));
assert.equal(pairings.length, 4);
assert.equal(pairings[1][0], "Pri izvedbi dela: kaj je pomembnejše?");
assert.match(gallery, /data-review-card/);
assert.match(html, /atena-card-templates-v2/);
assert.match(html, /grid-template-columns:\s*repeat\(3/);
assert.match(html, /min-height:\s*44px/);
assert.match(html, /\[data-combo-options\]\[hidden\]\s*\{\s*display:\s*none;/);
assert.match(markdown, /61 zasnov kartic/);
assert.match(markdown, /Prvih 30 zasnov je potrjenih in zaklenjenih/);
assert.match(markdown, /Kartice 31–61 so novi funkcionalni osnutki/);
assert.equal((markdown.match(/Nov osnutek/g) || []).length, 31);
assert.doesNotMatch(gallery, /Dopolnite \d+\/\d+|>Spremeni</);

console.log("Atena card templates: OK (30 potrjenih + 31 novih zasnov)");
