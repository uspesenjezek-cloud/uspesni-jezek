const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-preverba.js"), "utf8");
const cssSource = fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-podjetje-grafike.css"), "utf8");

function functionSource(name, nextName) {
  const start = source.indexOf("  function " + name + "(");
  const end = source.indexOf("  function " + nextName + "(", start + 1);
  assert.ok(start >= 0 && end > start, "Manjka funkcija " + name);
  return source.slice(start, end);
}

const testedSource = [
  functionSource("odstotekSpremembe", "lepKorakMerila"),
  functionSource("datumDogodka", "izrisiPot"),
  functionSource("scenarijIzstopa", "polozajDogodkaNaGrafu"),
  functionSource("polozajDogodkaNaGrafu", "primerjavaHtml"),
  functionSource("financnaCrtaHtml", "izrisiIzstopa")
].join("\n") + "\nthis.api={odstotekSpremembe,scenarijIzstopa,polozajDogodkaNaGrafu,financnaCrtaHtml};";

const context = { Array, Date, Math, Number, Object };
vm.runInNewContext(testedSource, context);
const { odstotekSpremembe, scenarijIzstopa, polozajDogodkaNaGrafu, financnaCrtaHtml } = context.api;

assert.match(source, /if \(signali\.length < 2\) return '<div class="boniteta-signali__seznam">'/, "ena kartica mora ostati brez vrtiljaka");
assert.match(source, /data-signal-carousel-button/, "več ugotovitev mora dobiti oštevilčeno navigacijo");
assert.match(source, /sled\.scrollTo\(\{ left: kartice\[indeks\]\.offsetLeft, behavior: "smooth" \}\)/, "klik številke mora gladko premakniti kartico");
assert.match(source, /document\.querySelectorAll\("\[data-financial-recheck-status\]"\)/, "potrjeni datum mora biti usklajen med vsemi karticami");
assert.match(source, /Preverba je že nastavljena za/, "druga kartica mora jasno povedati, da je preverba že nastavljena");
assert.match(cssSource, /scroll-snap-type:x mandatory/, "kartice morajo podpirati zanesljiv vodoravni poteg");
assert.match(cssSource, /\.boniteta-signali__slide \{ flex:0 0 100%/, "v kadru mora biti vedno ena cela kartica");
assert.match(source, /sled\.style\.height = kartice\[aktivniIndeks\]\.offsetHeight \+ "px"/, "vrtiljak mora odstraniti prazen prostor krajše kartice");

function series(previous, current) {
  return [{ year: 2023, value: previous }, { year: 2024, value: current }];
}

assert.equal(scenarijIzstopa(series(17088, -28763), "earnings").status, "Prehod v izgubo");
assert.equal(scenarijIzstopa(series(-12000, 24000), "earnings").status, "Povratek v dobiček");
assert.equal(scenarijIzstopa(series(-30000, -12000), "earnings").status, "Izguba se zmanjšuje");
assert.equal(scenarijIzstopa(series(-12000, -30000), "earnings").status, "Izguba se povečuje");
assert.equal(scenarijIzstopa(series(40000, 61000), "earnings").status, "Rezultat se izboljšuje");
assert.equal(scenarijIzstopa(series(61000, 40000), "earnings").status, "Rezultat se slabša");
assert.equal(scenarijIzstopa(series(61000, 60900), "earnings").status, "Rezultat je stabilen");
assert.equal(scenarijIzstopa(series(700000, 760000), "assets").status, "Bilančna vsota raste");
assert.equal(scenarijIzstopa(series(760000, 700000), "assets").status, "Bilančna vsota se zmanjšuje");
assert.equal(scenarijIzstopa([{ year: 2024, value: 10 }], "earnings"), null);

const marker = polozajDogodkaNaGrafu({ date: "2024-01-23" }, series(1, 2));
assert.ok(marker > 50 && marker < 56, "dogodek januarja 2024 mora biti časovno postavljen okoli sredine obdobja 2023–2024");
assert.equal(polozajDogodkaNaGrafu({ date: "2021-01-01" }, series(1, 2)), null);
assert.equal(odstotekSpremembe({ value: 0 }, { value: 10 }), null);

const recoveryScenario = scenarijIzstopa(series(-12000, 24000), "earnings");
const recoveryChart = financnaCrtaHtml(series(-12000, 24000), 53, recoveryScenario);
assert.equal(recoveryChart.markerX, 53);
assert.match(recoveryChart.html, /#1aa653/);
assert.match(financnaCrtaHtml(series(17088, -28763), 53, scenarijIzstopa(series(17088, -28763), "earnings")).html, /#f04435/);

console.log("✓ Dinamični scenariji kartice Kaj izstopa so preverjeni.");

const signali = require(path.join(__dirname, "..", "app", "bonitetna-signali.js"));
assert.equal(signali.odstotek({ value: -100 }, { value: 100 }), null, "odstotek čez ničlo je pomensko neveljaven");

function ids(company, context) {
  return signali.izpelji(company, context).signals.map((signal) => signal.id);
}

function finance(metric, values) {
  return { metric, values: values.map(([year, value]) => ({ year, value })) };
}

function signalById(financials, id) {
  return signali.izpelji({ financials }).allSignals.find((signal) => signal.id === id);
}

function assertFinancialCaution(id, financials, expectedLevel) {
  const signal = signalById(financials, id);
  assert.ok(signal, "manjka pričakovani finančni signal " + id);
  assert.equal(signal.financialCaution, true, id + " mora biti finančni heads-up");
  assert.equal(signal.financialCautionLevel, expectedLevel, id + " mora dobiti pravilno stopnjo opozorila");
  assert.equal(signal.recheckReason, expectedLevel === "extreme" ? "financial_caution" : undefined, "ponovna preverba mora biti na voljo samo pri resni stopnji");
}

assert.equal(signali.izpelji({}).empty, true, "brez podatkov mora biti prikazano mirno prazno stanje");
assert.deepEqual(ids({ financials: [finance("Earnings", [[2023, 84200], [2024, -31600]])] }), ["profit_to_loss"]);
assert.deepEqual(ids({ financials: [finance("Earnings", [[2023, -18400], [2024, 62900]])] }), ["loss_to_profit"]);
assert.deepEqual(ids({ financials: [finance("Earnings", [[2022, 121200], [2023, 98000], [2024, 51100]])] }), ["profit_drop"]);
const povecanaIzguba = signali.izpelji({ financials: [finance("Earnings", [[2022, 7490], [2023, -23992], [2024, -164903]])] }).signals[0];
assert.equal(povecanaIzguba.id, "profit_drop");
assert.equal(povecanaIzguba.title, "Izguba se je povečala");
assert.equal(povecanaIzguba.changeKind, "loss");
assert.ok(povecanaIzguba.lossRatio > 6.8 && povecanaIzguba.lossRatio < 6.9);
assert.deepEqual(povecanaIzguba.lossYears, [2023, 2024], "seštevek izgube mora zajeti samo prikazana negativna leta");
assert.equal(povecanaIzguba.lossTotal, 188895, "prikazani izgubi morata biti sešteti");
const zmanjsanaIzguba = signali.izpelji({ financials: [finance("Earnings", [[2023, -30000], [2024, -12000]])] }).signals[0];
assert.equal(zmanjsanaIzguba.title, "Izguba se je zmanjšala");
assert.deepEqual(ids({ financials: [finance("Earnings", [[2023, 100000], [2024, 95000]])] }), [], "majhen premik ne sme postati signal");
const materialniPadecKapitala = signali.izpelji({ financials: [finance("Equity", [[2024, 184000], [2025, 141680]])] });
assert.equal(materialniPadecKapitala.signals[0].id, "equity_decline_material", "23-odstotni in vsaj 5.000 € padec pozitivnega kapitala mora sprožiti alarm");
assert.equal(materialniPadecKapitala.signals[0].financialCaution, true, "materialni padec kapitala mora dobiti previdnostni heads-up");
assert.equal(materialniPadecKapitala.signals[0].financialCautionLevel, "notice", "običajen materialni padec mora ostati kompaktno opozorilo");
assert.equal(materialniPadecKapitala.signals[0].recheckReason, undefined, "običajno opozorilo ne sme ponuditi plačljive ponovne preverbe");
assert.equal(materialniPadecKapitala.signals[0].change, -23);
assert.deepEqual(ids({ financials: [finance("Equity", [[2024, 100000], [2025, 80100]])] }), [], "padec za 19,9 % ne sme sprožiti alarma");
assert.deepEqual(ids({ financials: [finance("Equity", [[2024, 20000], [2025, 15500]])] }), [], "absolutni padec pod 5.000 € ne sme sprožiti alarma");
assert.deepEqual(ids({ financials: [finance("Equity", [[2024, 25000], [2025, -18000]])] }), ["negative_equity"], "prehod v negativni kapital mora ostati en sam kritični signal");
assertFinancialCaution("profit_to_loss", [finance("Earnings", [[2023, 30000], [2024, -12000]])], "notice");
assertFinancialCaution("profit_to_loss", [finance("Earnings", [[2023, 84200], [2024, -31600]])], "extreme");
assertFinancialCaution("profit_drop", [finance("Earnings", [[2023, -10000], [2024, -18000]])], "notice");
assertFinancialCaution("profit_drop", [finance("Earnings", [[2023, -23992], [2024, -164903]])], "extreme");
assertFinancialCaution("profit_decline_multi", [finance("Earnings", [[2022, 100000], [2023, 80000], [2024, 65000]])], "notice");
assertFinancialCaution("profit_decline_multi", [finance("Earnings", [[2022, 200000], [2023, 140000], [2024, 100000]])], "extreme");
assertFinancialCaution("liquidity_weaker", [finance("Cash", [[2023, 100000], [2024, 42000]]), finance("Liabilities", [[2023, 200000], [2024, 248000]])], "notice");
assertFinancialCaution("liquidity_weaker", [finance("Cash", [[2023, 100000], [2024, 20000]]), finance("Liabilities", [[2023, 100000], [2024, 150000]])], "extreme");
assertFinancialCaution("negative_equity", [finance("Equity", [[2023, 25000], [2024, -18000]])], "notice");
assertFinancialCaution("negative_equity", [finance("Equity", [[2023, 80000], [2024, -40000]])], "extreme");
assertFinancialCaution("equity_decline_material", [finance("Equity", [[2024, 184000], [2025, 141680]])], "notice");
assertFinancialCaution("equity_decline_material", [finance("Equity", [[2024, 200000], [2025, 100000]])], "extreme");
assertFinancialCaution("assets_change", [finance("Total assets", [[2023, 7706991], [2024, 4901980]])], "notice");
assertFinancialCaution("assets_change", [finance("Total assets", [[2023, 1000000], [2024, 400000]])], "extreme");
const triletnoOkrevanje = signali.izpelji({ financials: [finance("Earnings", [[2023, 183116], [2024, 50156], [2025, 125389]])] }).signals[0];
assert.equal(triletnoOkrevanje.id, "profit_growth");
assert.equal(triletnoOkrevanje.tone, "warning", "delno okrevanje, ki še ni doseglo prvega leta, mora ostati rumeno");
assert.equal(triletnoOkrevanje.title, "Dobiček je po padcu okreval");
assert.equal(triletnoOkrevanje.summary, "Dobiček je leta 2024 močno padel, leta 2025 pa je ponovno močno zrasel.");
assert.equal(triletnoOkrevanje.changeLabel, "2024 padec · 2025 rast");
assert.deepEqual(triletnoOkrevanje.series.map((vrednost) => vrednost.year), [2023, 2024, 2025], "razlaga in graf morata vedno ohraniti vse tri prikazane letnike");
const triletniObratNavzdol = signali.izpelji({ financials: [finance("Earnings", [[2023, 50000], [2024, 140000], [2025, 70000]])] }).signals[0];
assert.equal(triletniObratNavzdol.title, "Dobiček je po rasti znova padel");
assert.equal(triletniObratNavzdol.tone, "warning");
assert.match(triletniObratNavzdol.summary, /leta 2024 močno zrasel, leta 2025 pa je močno padel/);
const dietrovZgodovinskiSkok = signali.izpelji({ financials: [finance("Earnings", [[2020, 20286], [2021, 56422], [2022, 46642], [2023, 56494], [2024, 47669]])] }).signals[0];
assert.equal(dietrovZgodovinskiSkok.id, "profit_growth", "skok +178 % mora biti prikazan v Kaj izstopa");
assert.equal(dietrovZgodovinskiSkok.title, "Poslovni rezultat je močno zrasel");
assert.equal(dietrovZgodovinskiSkok.changeLabel, "2020 → 2021 · +178 %");
assert.deepEqual(dietrovZgodovinskiSkok.series.map((vrednost) => vrednost.year), [2020, 2021], "kartica mora jasno pokazati leti materialnega skoka");
assert.match(dietrovZgodovinskiSkok.summary, /povečal za 178 %/);
assert.deepEqual(ids({ financials: [finance("Total assets", [[2023, 7706991], [2024, 4901980]])] }), ["assets_change"]);
assert.deepEqual(ids({ financials: [finance("Cash", [[2023, 100000], [2024, 42000]]), finance("Liabilities", [[2023, 200000], [2024, 248000]])] }), ["liquidity_weaker"]);
assert.deepEqual(ids({ financials: [finance("Equity", [[2023, 25000], [2024, 100000]])] }), ["capital_stronger"]);
assert.deepEqual(ids({ financials: [finance("Equity", [[2024, -10000]])] }), ["negative_equity"]);
assert.deepEqual(ids({ status: "in liquidation" }), [], "likvidacijska kartica se ne sme več ustvariti");
assert.deepEqual(ids({ active: false }), [], "neaktivnost ne sme ustvariti odstranjene likvidacijske kartice");
assert.deepEqual(ids({ status: "active", active: false }), [], "potrjen aktivni status mora preprečiti protisloven signal likvidacije");
assert.deepEqual(ids({ status: "Aktiv", events: [{ category: "Liquidation", date: "2020-01-01", title: "Historical liquidation entry" }] }), [], "aktiven trenutni status mora preglasiti star zgodovinski dogodek");
assert.ok(ids({ events: [
  { category: "Management", date: "2024-01-01", title: "Director changed" },
  { category: "Management", date: "2024-08-01", title: "Director changed" },
  { category: "Management", date: "2025-04-01", title: "Director changed" }
] }).includes("leadership_turnover"));
const turnoverZImeni = signali.izpelji({
  events: [
    { category: "Management", date: "2024-01-12", title: "Management change" },
    { category: "Management", date: "2024-09-18", title: "Management change" },
    { category: "Management", date: "2025-06-20", title: "Management change" }
  ],
  officers: [
    { name: "Michael Weber", endDate: "2024-01-12" },
    { name: "Thomas Berger", startDate: "2024-01-12", endDate: "2024-09-18" },
    { name: "Anna Keller", startDate: "2024-09-18", endDate: "2025-06-20" },
    { name: "Daniel Roth", startDate: "2025-06-20" }
  ]
}).signals.find((signal) => signal.id === "leadership_turnover");
assert.deepEqual(turnoverZImeni.changes[0].departed, ["Michael Weber"]);
assert.deepEqual(turnoverZImeni.changes[0].appointed, ["Thomas Berger"]);
assert.deepEqual(turnoverZImeni.changes[2].appointed, ["Daniel Roth"]);
assert.ok(ids({ events: [
  { category: "Management", date: "2024-01-01", title: "Director changed" },
  { category: "Address", date: "2024-03-01", title: "Seat changed" },
  { category: "Purpose", date: "2024-05-01", title: "Purpose changed" }
] }).includes("reorganization"));
assert.ok(ids({ events: [{ category: "Legal form", date: "2024-05-01", title: "UG changed to GmbH" }] }).includes("ug_to_gmbh"));
const pravnaOblikaSignal = signali.izpelji({ events: [{ category: "Legal form", date: "2024-05-01", title: "UG changed to GmbH" }] }).signals[0];
assert.equal(pravnaOblikaSignal.summary, "Družba je spremenila pravno obliko iz UG v GmbH.");
assert.ok(ids({ owners: [{ name: "Novi lastnik", ownership_history: [{ document_date: "2023-01-01", percentage_shares: 35 }, { document_date: "2024-01-01", percentage_shares: 82 }] }] }).includes("majority_owner"));
assert.ok(ids({ events: [{ category: "Register court", date: "2025-01-01", title: "Register court moved" }] }).includes("court_change"));
const novoPodjetjeSignal = signali.izpelji({ foundingDate: "2026-01-01" }).signals.find((signal) => signal.id === "new_company");
assert.ok(novoPodjetjeSignal);
assert.ok(Number.isInteger(novoPodjetjeSignal.ageMonths) && novoPodjetjeSignal.ageMonths >= 0 && novoPodjetjeSignal.ageMonths < 24);
assert.ok(ids({ officers: [{ name: "Hans Gruber", status: "current", startDate: "2014-01-01" }] }).includes("stable_management"));
assert.deepEqual(ids({}, { locationStatus: "mismatch" }), ["contact_mismatch"]);
assert.ok(!ids({ totalAssets: [{ year: 2023, value: 100000 }, { year: 2024, value: 102000 }] }).includes("limited_finance"), "omejeni finančni podatki ne smejo ustvariti kartice");
assert.ok(ids({ filingGap: { officiallyChecked: true, years: [2022, 2024] } }).includes("filing_gap"));
assert.ok(!ids({ filingGap: { officiallyChecked: true, years: [2022, 2023, 2024] } }).includes("filing_gap"), "neprekinjena časovnica ne sme ustvariti lažnega opozorila");
assert.ok(!ids({ totalAssets: [{ year: 2023, value: -100000 }, { year: 2024, value: 100000 }] }).includes("assets_change"), "negativna bilančna vsota je neveljaven vhod");
assert.ok(!ids({ financials: [finance("Cash", [[2023, -100000], [2024, 42000]]), finance("Liabilities", [[2023, 200000], [2024, 248000]])] }).includes("liquidity_weaker"), "negativna denarna sredstva ne smejo ustvariti odstotkov likvidnosti");
assert.ok(!ids({ owners: [{ name: "Napačen delež", ownership_history: [{ document_date: "2023-01-01", percentage_shares: 20 }, { document_date: "2024-01-01", percentage_shares: 140 }] }] }).includes("majority_owner"), "delež zunaj intervala 0–100 ne sme ustvariti kartice");
const kapitalCezNiclo = signali.izpelji({ financials: [finance("Equity", [[2023, -25000], [2024, 100000]])] }).signals.find((signal) => signal.id === "capital_stronger");
assert.equal(kapitalCezNiclo.title, "Kapital je ponovno pozitiven");
assert.equal(kapitalCezNiclo.change, undefined, "prehod kapitala čez ničlo ne sme prikazati navadnega odstotka");
const omrezjeDirektorjaSignal = signali.izpelji({ officerNetwork: { activeCompanies: 8, liquidatingCompanies: 2 } }).signals.find((signal) => signal.id === "director_network");
assert.equal(omrezjeDirektorjaSignal.activeCompanies, 8);
assert.equal(omrezjeDirektorjaSignal.liquidatingCompanies, 2);
assert.match(omrezjeDirektorjaSignal.summary, /sama po sebi ni negativen signal/);
const povezaveModel = signali.izpelji({
  relatedCompanies: [
    { name: "Benjamin Klotz", type: "person", city: "Berlin", relationships: ["Geschäftsführer", "Inhaber"] },
    { name: "Helmut KLOTZ OHG (i. L.)", type: "company", city: "Berlin", registerKey: "1114057033031", relationships: ["Inhaber"] }
  ],
  financials: [finance("Total assets", [[2024, 278254]])]
});
assert.ok(!povezaveModel.allSignals.some((signal) => signal.id === "related_owners"), "splošni seznam povezav ne sodi med ugotovitve Kaj izstopa");
assert.deepEqual(povezaveModel.allSignals.map((signal) => signal.id), [], "omejeni finančni podatki in splošne povezave ne smejo ustvariti ugotovitve");
assert.ok(!signali._test.hardOrder.includes("related_owners"), "odstranjena kartica ne sme ostati v poslovnem vrstnem redu");

const samoVodstvoModel = signali.izpelji({
  relatedCompanies: [
    { name: "Roger Seemeyer", type: "person", city: "Schwabach", relationships: ["Director"] },
    { name: "Lutz Welling", type: "person", city: "München", relationships: ["Director", "Prokurist"] },
    { name: "Steffen Dick", type: "person", city: "Backnang", relationships: ["Director"] }
  ]
});
assert.ok(!samoVodstvoModel.allSignals.some((signal) => signal.id === "related_owners"), "običajen seznam direktorjev in prokuristov ne sodi med ugotovitve Kaj izstopa");
assert.equal(samoVodstvoModel.empty, true, "samo vodstvene osebe morajo pustiti stanje brez pomembnih odstopanj");

const samoLastnistvoModel = signali.izpelji({
  relatedCompanies: [{ name: "Primer Lastnik", type: "person", relationships: ["Inhaber"] }]
});
assert.equal(samoLastnistvoModel.empty, true, "tudi lastniška povezava sama po sebi ni ugotovitev Kaj izstopa");

const pozniLastnikModel = signali.izpelji({
  relatedCompanies: [
    { name: "Direktor A", type: "person", relationships: ["Director"] },
    { name: "Direktor B", type: "person", relationships: ["Director"] },
    { name: "Prokurist C", type: "person", relationships: ["Prokurist"] },
    { name: "Lastnik D", type: "person", relationships: ["Inhaber"] }
  ]
});
assert.ok(!pozniLastnikModel.allSignals.some((signal) => signal.id === "related_owners"), "povezave ostanejo v namenskem pogledu Dodatno, ne v Kaj izstopa");

const mesaniVhod = {
  relatedCompanies: [{ name: "Povezana oseba", type: "person", relationships: ["Inhaber"] }],
  officerNetwork: { activeCompanies: 8, liquidatingCompanies: 0 },
  foundingDate: "2026-01-01",
  financials: [finance("Total assets", [[2024, 278254]])]
};
assert.deepEqual(signali.izpelji(mesaniVhod).allSignals.map((signal) => signal.id), ["director_network", "new_company"], "znane kartice morajo imeti nespremenljiv poslovni vrstni red");
assert.deepEqual(
  signali.izpelji(Object.assign({}, mesaniVhod, { relatedCompanies: mesaniVhod.relatedCompanies.slice().reverse(), financials: mesaniVhod.financials.slice().reverse() })).allSignals.map((signal) => signal.id),
  ["director_network", "new_company"],
  "vrstni red kartic ne sme biti odvisen od vrstnega reda vhodnih podatkov"
);

const prednost = signali.izpelji({
  status: "in liquidation",
  foundingDate: "2026-01-01",
  officerNetwork: { activeCompanies: 8, liquidatingCompanies: 2 },
  financials: [finance("Earnings", [[2023, 84200], [2024, -31600]])]
}, { locationStatus: "mismatch" });
assert.equal(prednost.signals.length, 3, "v prikazu smejo biti največ tri prednostne ugotovitve");
assert.deepEqual(prednost.signals.map((signal) => signal.id), ["contact_mismatch", "profit_to_loss", "director_network"], "odstranjena likvidacijska kartica ne sme zasedati mesta med prednostnimi ugotovitvami");
assert.ok(prednost.allSignals.length > prednost.signals.length, "model mora ohraniti tudi sled manj prednostnih dokazov");

const sovpadanje = signali.izpelji({
  events: [{ category: "Management", date: "2024-07-01", title: "Director changed" }],
  financials: [finance("Earnings", [[2023, 84200], [2024, -31600]])]
});
assert.equal(sovpadanje.signals[0].relatedEvent.type, "leadership");
assert.match(sovpadanje.signals[0].summary, /ne dokazuje vzroka/);

const html = fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-preverba.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-podjetje-grafike.css"), "utf8");
const centerSource = fs.readFileSync(path.join(__dirname, "..", "app", "boniteta-sredisce.js"), "utf8");
assert.ok(html.indexOf("bonitetna-signali.js") < html.indexOf("bonitetna-preverba.js"), "signalni model se mora naložiti pred prikaznim modulom");
assert.match(css, /\.boniteta-signal__ikona\s*\{[\s\S]*?width:44px;[\s\S]*?height:44px;/, "vse kartice morajo uporabljati enako velik krog z ikono");
assert.match(css, /\.boniteta-signal h5\s*\{[\s\S]*?font:780 1rem/, "naslovi kartic morajo imeti skupno, berljivo tipografsko merilo");
assert.match(source, /boniteta-signal__compare-bars-layout/, "primerjalni zneski in stolpci morajo biti v isti poravnani mreži");
assert.match(source, /razmerjeIzgube[\s\S]*?× večja izguba/, "povečane izgube ne smemo prikazati kot zavajajoč negativen odstotek dobička");
assert.match(css, /boniteta-signal__stolpci\.is-trend[^}]*justify-content:stretch/, "leta finančnega trenda morajo biti razporejena v enotne poravnane stolpce");
assert.match(centerSource, /variant==="bilanca"[\s\S]*?557074[\s\S]*?278254/, "prijavljeni bilančni prikaz mora ostati dosegljiv v pravem testnem toku");
assert.match(centerSource, /variant==="signal"/, "pravi rezultat mora omogočiti test posamezne signalne kartice");
assert.match(centerSource, /profit_drop_extreme:\{financials:\[finance\("Earnings",\[\{year:2022,value:25000000\}/, "vizualni stresni primer mora preveriti zelo visok prvi pozitivni znesek");
assert.match(centerSource, /UJBonitetaSignalneTestneKartice/, "testni način mora ponuditi pregled vseh signalnih kartic");
assert.match(source, /data-vse-signalne-kartice/, "ob naslovu Kaj izstopa mora biti testni gumb za vse grafike");
assert.doesNotMatch(source, /data-odpri-testno-preverbo|data-testna-preverba|Preveri …/, "odstranjeni začasni preverjevalnik ne sme ostati v pogledu Kaj izstopa");
assert.match(source, /signalniApi\.primerjajSignale[\s\S]*?model\.signals \|\| \[\][\s\S]*?sort\(primerjajSignale\)/, "prikaz mora uporabiti isti trdi poslovni vrstni red kot signalni model");
assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-signali.js"), "utf8"), /related_owners|Lastniške in vodstvene povezave/, "odstranjena splošna kartica ne sme ostati v signalnem modelu");
assert.match(source, /model\.allSignals \|\| prednostniSignali[\s\S]*?dejanskiSignali\.map\(karticaSignalaHtml\)/, "gumb Vse grafike mora za pravo podjetje najprej prikazati vse njegove dejanske signale");
assert.match(source, /manjkajociSignali\.map\(niPodatkovSignalHtml\)/, "za manjkajoče vrste grafik mora galerija prikazati jasna nevtralna stanja");
assert.match(source, /dejanskeKartice \+ manjkajociSignali\.map/, "dejanske ugotovitve morajo biti v hierarhiji pred karticami brez podatkov");
assert.match(source, /var steviloGalerije = testnaGalerija \? testneKartice\.length : dejanskiSignali\.length \+ manjkajociSignali\.length/, "števec gumba mora pri pravi preverbi zajeti vse prikazane vrste grafik");
assert.match(source, /grafPrehodaSignala\.zaporedje = \(grafPrehodaSignala\.zaporedje \|\| 0\) \+ 1/, "vsak prehodni graf mora dobiti svoje notranje SVG oznake");
assert.match(source, /var grafId = esc\(signal\.id\) \+ "-" \+ grafPrehodaSignala\.zaporedje/, "ponovljene kartice ne smejo deliti gradientov SVG");
assert.match(source, /testniModel\.allSignals[\s\S]*?fixture\.id/, "galerija mora uporabiti dejanski prednostni model in poiskati točno testirano kartico");
assert.match(source, /document\.body\.classList\.contains\("boniteta-test-mode"\)/, "galerija testnih podatkov ne sme biti vidna zunaj testnega načina");
assert.match(source, /razlicicaTestneGalerije === "vse"/, "predogled posameznega podjetja mora pokazati tudi prava stanja brez podatkov");
assert.match(css, /boniteta-signali__galerija\[hidden\][^}]*display:none/, "zaprta galerija ne sme zasedati prostora");
assert.match(css, /\.boniteta-signali__galerija \{[^}]*margin-top:17px;[^}]*gap:12px;/, "odprtje galerije ne sme premakniti prve kartice");
assert.match(source, /if \(odprto\) \{[\s\S]*?privzeto\.hidden = false[\s\S]*?vse\.hidden = true[\s\S]*?\} else \{[\s\S]*?vse\.hidden = false[\s\S]*?privzeto\.hidden = true/, "preklop mora najprej pokazati novi pogled in šele nato skriti starega, da stran ne poskoči");
assert.match(source, /zacetniPolozajGumba = gumbVseh\.getBoundingClientRect\(\)\.top[\s\S]*?window\.requestAnimationFrame\(ohraniPolozajGumba\)/, "preklop galerije mora ohraniti gumb na istem položaju tudi po preračunu postavitve");
assert.match(css, /\.boniteta-signali__privzeto,\.boniteta-signali__galerija \{ overflow-anchor:none; \}/, "brskalnik ne sme samodejno sidrati preklapljajoče se galerije");
assert.match(source, /Ni dovolj podatkov za prikaz/, "manjkajoča grafika mora jasno povedati, da nima dovolj podatkov");
assert.match(css, /\.boniteta-signal--missing \{[^}]*--signal:#6d8784/, "kartice brez podatkov morajo biti vizualno nevtralne");
[
  "profit_to_loss", "loss_to_profit", "profit_drop", "profit_growth", "assets_change",
  "liquidity_weaker", "negative_equity", "equity_decline_material", "capital_stronger",
  "leadership_turnover", "reorganization", "ug_to_gmbh", "majority_owner", "court_change",
  "stable_management", "new_company", "contact_mismatch", "director_network", "filing_gap",
  "empty"
].forEach(function (fixture) {
  assert.match(centerSource, new RegExp(fixture), "manjka testni primer signalne kartice: " + fixture);
});
assert.match(source, /signal\.layout === "stable" \? ""/, "stabilno vodstvo ne sme dvakrat izpisati trajanja");
assert.match(source, /prejsnjeSodisce[\s\S]*?novoSodisce/, "kartica sodišča mora pokazati obe lokaciji");
assert.match(css, /boniteta-signal__lastnistvo[^}]*padding-bottom:18px/, "oznake lastništva morajo imeti prostor nad opisom");
assert.match(css, /boniteta-signal--mismatch h5[^}]*white-space:normal/, "daljši naslov neskladja se mora prelomiti brez drobnega besedila");
assert.match(source, /--liquidity-bar:/, "likvidnostna kartica mora spremembi prikazati s primerjalnima merilnima črtama");
assert.match(source, /boniteta-signal__stolpec-os/, "finančni trend mora imeti skupno ničelno os");
assert.match(source, /Math\.max\(12, Math\.min\(56,[\s\S]*?prostorNadNiclo[\s\S]*?prostorPodNiclo[\s\S]*?Math\.min\(prostorNadNiclo \/ pozitivniMaksimum, prostorPodNiclo \/ negativniMaksimum\)/, "ničelna os mora pri skrajno različnih zneskih rezervirati prostor za oba predznaka");
assert.match(source, /is-near-zero/, "pozitiven rezultat blizu ničle mora dobiti rumen stolpec");
assert.match(css, /i\.is-profit\.is-near-zero[^}]*#f6ca68[^}]*#d79a21/, "rumeni stolpec blizu ničle mora uporabljati opozorilni barvni sistem");
assert.match(source, /skupna objavljena izguba znašala/, "kartica izgube mora pod grafom pojasniti skupno izgubo prikazanih let");
assert.match(source, /To je heads-up iz zadnjih objavljenih poslovnih podatkov, ne napoved prihodnosti/, "finančna opozorilna kartica mora jasno omejiti pomen starejših podatkov");
assert.match(source, /signal\.financialCautionLevel === "extreme"/, "razširjeni nasvet in ponovna preverba morata biti omejena na resno finančno opozorilo");
assert.match(source, /reason: kartica\.dataset\.financialRecheckReason \|\| "financial_caution"/, "vse previdnostne kartice morajo shraniti skupno enkratno finančno preverbo");
assert.match(source, /steviloKriticnihOpozoril = \(signalniModel\.allSignals \|\| \[\]\)\.filter\(function \(signal\) \{ return signal\.tone === "critical"; \}\)\.length/, "števec in animacija morata upoštevati samo rdeča kritična opozorila");
assert.match(source, /classList\.toggle\("has-material-alert", steviloKriticnihOpozoril > 0\)/, "utrip mora delovati samo pri kritičnem opozorilu");
assert.match(source, /znacka\.hidden = steviloKriticnihOpozoril === 0; znacka\.textContent = String\(steviloKriticnihOpozoril\)/, "rumeno opozorilo ne sme prikazati številčne značke");
assert.doesNotMatch(source, /if \(pogled === "izstopa"\) sproziUtripFinancnegaOpozorila/, "klik na Kaj izstopa ne sme sprožiti utripa");
assert.match(source, /nastaviPodjetjePogled\("kljucni"\);[\s\S]*?setTimeout\(function \(\) \{[\s\S]*?sproziUtripFinancnegaOpozorila/, "utrip se mora sprožiti ob prikazu celotnega novega ali obnovljenega profila");
assert.match(css, /button\.has-material-alert\.is-alert-pulsing::before[\s\S]*?radial-gradient[\s\S]*?opacity:0;[\s\S]*?will-change:opacity;[\s\S]*?animation:boniteta-izstopa-alert 5\.2s ease-in-out 1 both;/, "oba ambientna utripa morata teči kot ena sama zvezna in počasna ease-in-out animacija");
assert.match(css, /@keyframes boniteta-izstopa-alert \{[\s\S]*?0%,100% \{ opacity:0; \}[\s\S]*?25%,75% \{ opacity:\.78; \}[\s\S]*?50% \{ opacity:\.1; \}/, "med dvema mehkima vrhovoma mora ostati komaj viden ambientni sij, da drugi utrip ne začne z novim trdim vklopom");
assert.doesNotMatch(css, /@keyframes boniteta-izstopa-alert[\s\S]*?transform:scale/, "utrip ne sme sunkovito povečevati gumba");
assert.doesNotMatch(source, /setTimeout\(function \(\) \{ gumb\.classList\.remove\("is-alert-pulsing"\)/, "zaključka animacije ne sme spremljati zakasnjena odstranitev razreda in zadnji blisk");
assert.match(source, /function nastaviPodjetjePogled\(pogled, fokus\)[\s\S]*?querySelectorAll\("\.is-alert-pulsing"\)[\s\S]*?classList\.remove\("is-alert-pulsing"\)/, "ugasnjeni ambientni sloj se mora brez vmesnega izrisa odstraniti ob naslednji uporabnikovi izbiri");
assert.match(css, /boniteta-podjetje-navigacija__opozorila \{[\s\S]*?top:-1px;[\s\S]*?right:1px;[\s\S]*?min-width:18px;/, "števec opozoril mora biti v zgornjem desnem kotu zavihka");
assert.match(css, /boniteta-identiteta-nadaljuj:not\(\[hidden\]\) \{[\s\S]*?padding: 9px 10px;[\s\S]*?grid-template-columns: 42px minmax\(0, 1fr\) 42px;[\s\S]*?column-gap: 8px;/, "CTA mora sredinskemu besedilu prepustiti največjo razpoložljivo širino med enako velikima stranskima elementoma");
assert.match(css, /boniteta-identiteta-nadaljuj__ikona \{[\s\S]*?grid-row: 1;[\s\S]*?width: 42px;[\s\S]*?height: 42px;[\s\S]*?border: 0;[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;/, "ščit CTA nikoli ne sme biti zaprt v dodatnem krožnem mehurčku ali raztegnjen čez dve vrstici");
assert.match(css, /boniteta-identiteta-nadaljuj__ikona-cta \{[\s\S]*?width: 38px;[\s\S]*?height: 38px;/, "samostojni ščit mora biti velik in jasno viden");
assert.match(css, /boniteta-identiteta-nadaljuj__vsebina \{[\s\S]*?grid-template-rows: 1fr auto 1fr;[\s\S]*?width: 100%;[\s\S]*?align-self: stretch;[\s\S]*?justify-items: stretch;[\s\S]*?text-align: center;/, "vse tri vrstice besedila morajo zapolniti celotno sredinsko območje CTA");
assert.match(css, /boniteta-identiteta-nadaljuj__vsebina > small \{[\s\S]*?grid-column: 1 !important;[\s\S]*?boniteta-identiteta-nadaljuj__vsebina > strong \{[\s\S]*?grid-column: 1 !important;[\s\S]*?boniteta-identiteta-nadaljuj__vsebina > span \{[\s\S]*?grid-column: 1 !important;/, "vse tri vrstice morajo ostati v edinem polnem sredinskem stolpcu in ne smejo ustvariti zamaknjenega implicitnega stolpca");
assert.match(css, /boniteta-identiteta-nadaljuj__vsebina > strong \{[\s\S]*?font: 820 1\.08rem\/1\.1/, "glavni tekst CTA mora biti opazno večji in sorazmeren razširjeni sredini");
assert.match(css, /boniteta-identiteta-nadaljuj__puscica \{[\s\S]*?grid-column: 3;[\s\S]*?grid-row: 1;[\s\S]*?width: 42px;[\s\S]*?height: 42px;/, "desni krožni gumb mora biti v isti mrežni vrstici in na isti višini kot ščit");
assert.match(source, /rezultat\.classList\.toggle\("is-company-signal-focus", pogled === "izstopa" && izstopaImaEkstremniFokus\)/, "samo resni aktivni pogled Kaj izstopa sme postati samostojen fokus");
assert.match(source, /prikazaniPrednostniSignali = prednostniSignali/, "več resnih opozoril mora ostati dosegljivih v skupnem vrtiljaku");
assert.match(source, /classList\.toggle\("has-extreme-alert", steviloKriticnihOpozoril > 0\)/, "zavihek mora kritično značko in utrip omejiti na rdeče opozorilo");
assert.match(css, /is-company-signal-focus #boniteta-razsiritve \{ display:none; \}/, "pod opozorilnim widgetom v fokusu ne sme ostati PRO vsebina");
assert.match(css, /data-pogled="izstopa"[^}]*boniteta-podjetje-podrobnosti \{\s*padding:18px 10px 12px;/, "opozorilni widget mora uporabiti več razpoložljive širine");
assert.match(css, /boniteta-financni-alarm__urejevalnik \{ grid-template-columns:auto minmax\(86px,.78fr\) minmax\(139px,1.25fr\);gap:5px;/, "korak in tri enote morajo na telefonu ostati v eni kompaktni vrstici");
assert.match(css, /boniteta-signal__stolpec-os::before[^}]*top:var\(--signal-zero\)/, "ničelna črta mora slediti dejanskemu razponu vrednosti");
assert.match(css, /i\.is-loss \{ top:calc\(var\(--signal-zero\) \+ 1px\)[^}]*#ed2638/, "izguba mora viseti navzdol od ničelne črte in biti rdeča");
assert.doesNotMatch(source, /boniteta-signal__likvidnost[^;]*<svg/, "likvidnostna kartica ne sme uporabljati nepovezane ilustracije kovancev");
assert.match(css, /boniteta-signal--liquidity \.boniteta-signal__vsebina > header \{ min-height:42px; \}/, "ikona likvidnosti mora imeti rezervirano višino in ne sme prekriti primerjalnih polj");
assert.match(source, /boniteta-signal__ploscice is-three[\s\S]*?Spremenjeno/, "reorganizacija mora uporabiti svetle podatkovne ploščice namesto abstraktnih krogov");
assert.match(source, /layout === "ownership"[^\n]*boniteta-signal__ploscice/, "sprememba lastništva mora uporabiti enotne svetle podatkovne ploščice");
assert.doesNotMatch(source, /layout === "relationships"|boniteta-signal__povezave/, "odstranjena splošna kartica ne sme imeti več prikazne predloge");
assert.doesNotMatch(css, /boniteta-signal--relationships|boniteta-signal__povezave/, "odstranjena splošna kartica ne sme ohraniti mrtvih slogov");
assert.match(source, /layout === "stable"[^\n]*boniteta-signal__ploscice/, "stabilno vodstvo mora uporabiti enotne svetle podatkovne ploščice");
assert.match(source, /layout === "filing-gap"[\s\S]*?manjkajoceLeto[\s\S]*?boniteta-signal__ploscice is-three/, "manjkajoča objava mora uporabiti dejanska leta v enotnih podatkovnih ploščicah");
assert.doesNotMatch(source, /layout === "filing-gap"[^}]*<small>2022<\/small>/, "leta časovnice objav ne smejo biti hardkodirana v prikazu");
assert.match(source, /function signalImaVarnePodatke[\s\S]*?layout === "transition"[\s\S]*?layout === "filing-gap"/, "vsaka vrsta grafike mora skozi skupno preverjanje obveznih podatkov");
assert.match(source, /if \(!signalImaVarnePodatke\(signal\)\) return niPodatkovSignalHtml/, "neveljavna kartica mora varno pasti v stanje brez podatkov");
assert.match(source, /title: signal && signal\.title \|\| "Podatka ni mogoče zanesljivo prikazati"/, "tudi popolnoma poškodovan signal mora dobiti razumljiv nadomestni naslov");
assert.doesNotMatch(source, /layout === "limited"|limited_finance/, "odstranjena kartica omejenih financ ne sme ostati v prikazu");
assert.match(css, /boniteta-signal__ploscice > span \{[^}]*background:color-mix\(in srgb,var\(--tile-soft,var\(--signal-soft\)\) 78%,#fff\)/, "podatkovne ploščice morajo ohraniti svetlo, nežno obarvano podlago");
assert.match(css, /boniteta-signal--network \.boniteta-signal__vsebina > header,[\s\S]*?boniteta-signal--filing-gap \.boniteta-signal__vsebina > header \{ min-height:41px; \}/, "vse kartice s polji morajo rezervirati višino zgornje ikone");
assert.match(css, /boniteta-signal__ploscice > span \{[^}]*min-height:62px;[^}]*padding:8px;/, "svetle podatkovne ploščice morajo biti dovolj kompaktne za varen razmik");
assert.match(css, /boniteta-signal__omrezje > span \{[^}]*min-height:62px;[^}]*padding:8px 12px;/, "polja mreže družb morajo biti dovolj kompaktna za varen razmik");
assert.match(css, /boniteta-signal__kapital span \{[^}]*min-height:60px;/, "obe polji kapitala morata imeti enako višino");
assert.doesNotMatch(css, /boniteta-signal__kapital span\.is-now \{[^}]*min-height:/, "trenutna vrednost kapitala ne sme biti višja od prejšnje");
assert.match(source, /boniteta-signal--empty"><div class="boniteta-signal__vsebina"><header>/, "prazna kartica ne sme podvajati ščita z dodatno levo ikono");
assert.match(source, /boniteta-signal__pokritost[\s\S]*?<small>[\s\S]*?<b>/, "stanja pokritosti morajo biti prikazana kot jasne podatkovne ploščice");
assert.match(css, /boniteta-signal--empty \.boniteta-signal__vsebina > header \{[^}]*justify-content:center;/, "naslov prazne kartice mora biti centriran");
assert.match(css, /boniteta-signal__pokritost span \{[^}]*min-height:58px;/, "statusne ploščice prazne kartice morajo imeti enako višino");
assert.match(css, /boniteta-signal__scit::before \{[^}]*width:98px;[^}]*height:98px;[^}]*border-radius:50%;/, "ozadje ščita mora biti pravi krog, ki se ne odreže na robovih");
assert.doesNotMatch(css, /boniteta-signal__scit \{[^}]*radial-gradient/, "krog za ščit ne sme uporabljati gradienta, ki preseže višino območja");
assert.match(source, /negative_equity:[^\n]*M8 12l10 9 7-5 11 16M30 32h6v-6/, "ikona negativnega kapitala mora kazati navzdol");
assert.doesNotMatch(source, /liquidation:\s*'<svg|layout === "liquidation"|boniteta-signal__likvidacija/, "likvidacijska kartica ne sme imeti prikazne predloge");
assert.doesNotMatch(css, /boniteta-signal--liquidation|boniteta-signal__likvidacija/, "slogi odstranjene likvidacijske kartice morajo biti izbrisani");
assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-signali.js"), "utf8"), /signal\("liquidation"/, "signalni model ne sme več ustvarjati likvidacijske kartice");
assert.doesNotMatch(centerSource, /liquidation:\{active:false|"capital_stronger","liquidation"/, "testni katalog ne sme več ponujati odstranjene kartice");
assert.match(centerSource, /name=signalFixtureTestNames\.includes\(name\)\?name:"empty"/, "odstranjeno ime kartice se tudi v lokalnem predogledu ne sme več prikazati");
assert.match(source, /Prikazane so največ tri prednostne ugotovitve/, "uporabniku mora biti jasno, zakaj niso prikazane vse tehnične ugotovitve");
assert.match(source, /boniteta-signal__menjave-vodstva[\s\S]*?sprememba\.appointed[\s\S]*?sprememba\.departed/, "kartica menjav vodstva mora pokazati osebe, ne samo datumov");
assert.match(css, /boniteta-signal__menjave-vodstva[^}]*width:calc\(100% \+ 58px\)/, "seznam oseb mora biti poravnan čez širino kartice");
assert.match(source, /Prejšnja oblika[\s\S]*?<strong>UG<\/strong>[\s\S]*?Nova oblika[\s\S]*?<strong>GmbH<\/strong>/, "sprememba pravne oblike mora biti prikazana kot jasna primerjava prej in zdaj");
assert.doesNotMatch(source, /signal\.layout === "legal-form"[^\n]*zgradbaSignala/, "kartica pravne oblike ne sme uporabljati nepovezanih ilustracij stavb");
assert.match(source, /Prejšnje sodišče[\s\S]*?boniteta-signal__sodisce-pot[\s\S]*?Novo sodišče/, "sprememba sodišča mora uporabiti pojasnjeni lokaciji in povezovalno pot");
assert.doesNotMatch(source, /boniteta-signal__sodisce[^\n]*>●</, "lokaciji sodišča ne smeta biti prikazani kot navadna krogca");
assert.match(source, /signal\.ageMonths[\s\S]*?Ustanovljeno[\s\S]*?Starost podjetja/, "kartica novega podjetja mora pokazati datum ustanovitve in dejansko starost");
assert.match(source, /layout === "new-company"[\s\S]*?boniteta-signal__ploscice is-two/, "kartica novega podjetja mora uporabljati isti sistem podatkovnih ploščic kot druge ugotovitve");
assert.doesNotMatch(source, /boniteta-signal__novo/, "kartica novega podjetja ne sme imeti ločene vizualne predloge");
assert.match(css, /boniteta-signal--reorganization,\s*\.boniteta-signal--new-company \{ min-height:184px; \}/, "sorodni registrski kartici morata imeti enako osnovno višino");
assert.match(css, /boniteta-signal--reorganization \{ --signal:#d76a17;--signal-soft:#fff4e9;[^}]*background:linear-gradient\(145deg,#fffdfb,#fff 72%\)/, "reorganizacija mora ohraniti oranžen pomen brez premočne oranžne podlage");
assert.match(css, /boniteta-signal--reorganization \.boniteta-signal__ploscice > span \{[^}]*background:rgba\(255,255,255,\.84\)/, "polja reorganizacije morajo ustvariti svetel kontrast kot primerjalna polja likvidnosti");
assert.match(css, /boniteta-signal--reorganization p \{[^}]*width:calc\(100% \+ 58px\);[^}]*margin:10px 0 0 -58px;[^}]*text-align:left;/, "povzetek reorganizacije se mora začeti levo na celotni širini kot pri naslednji kartici");
assert.match(css, /boniteta-signal--new-company \{ --signal:#0b8294;--signal-soft:#e7f4f7;/, "novo podjetje mora biti enotno modro kot informativna kartica");
assert.doesNotMatch(source, /var barve = \{/, "posamezna polja iste kartice ne smejo uporabljati naključne mavrice");
assert.doesNotMatch(source, /signal\.layout === "new-company"[^\n]*zgradbaSignala/, "kartica novega podjetja ne sme uporabljati naključne ilustracije hiše");
const financialRecheck = require(path.join(__dirname, "..", "api", "_lib", "financno-ponovno-preverjanje.js"));
[1, 2, 60, 90, 364, 365].forEach((days) => assert.equal(financialRecheck._test.intervalDays(days), days));
[0, 366, 1.5, "tri"].forEach((days) => assert.throws(() => financialRecheck._test.intervalDays(days), (error) => error.code === "INVALID_FINANCIAL_RECHECK_INTERVAL", "API mora zavrniti interval zunaj razpona 1–365 celih dni"));
assert.match(source, /data-financial-recheck-unit[\s\S]*data-financial-recheck-value/, "skupni izbirnik mora omogočiti enoto in celoštevilsko vrednost");
assert.match(source, /days: \{ factor: 1, max: 365[\s\S]*weeks: \{ factor: 7, max: 52[\s\S]*months: \{ factor: 30, max: 12/, "UI mora enote pretvoriti v dni z dogovorjenimi omejitvami");
assert.match(source, /Priporočeno[\s\S]*Ročno[\s\S]*Izklopljeno/, "vse razširjene kartice morajo imeti skupni drsni izbirnik načina");
assert.match(source, /data-financial-recheck-step="-1"[\s\S]*data-financial-recheck-step="1"/, "ročno obdobje mora imeti gumba minus in plus");
assert.match(source, /financial_recheck_delete/, "izbira Izklopljeno mora uporabljati obstoječo varno pot za odstranitev nastavitve");
assert.doesNotMatch(source, /Priporočeno: 3 mesece/, "ročni način ne sme prikazovati kontradiktornega priporočila pod izbrano vrednostjo");
assert.match(css, /boniteta-financni-alarm__nacini::before[^}]*transition:transform \.2s ease/, "zgornji izbirnik mora imeti premičen aktivni gumb v barvi kartice");
assert.match(css, /boniteta-financni-alarm__enote\[data-active="weeks"\]::before \{ transform:translateX\(100%\); \}/, "izbirnik enote mora aktivni gumb premakniti na izbrano enoto");
assert.equal(financialRecheck._test.reason("financial_caution"), "financial_caution");
assert.throws(() => financialRecheck._test.reason("profit_to_loss"), (error) => error.code === "INVALID_FINANCIAL_RECHECK_REASON", "posamezne kartice ne smejo ustvariti podvojenih plačljivih ponovitev");
const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260825214742_financial_rechecks.sql"), "utf8");
const cautionMigration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260825222124_general_financial_caution_rechecks.sql"), "utf8");
const customIntervalMigration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260825232704_allow_custom_financial_recheck_intervals.sql"), "utf8");
assert.match(migration, /alter table public\.boniteta_ponovne_preverbe enable row level security/);
assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\) with check \(\(select auth\.uid\(\)\) = user_id\)/);
assert.match(migration, /security definer[\s\S]*?set search_path = ''/);
assert.match(migration, /revoke all on function public\.razporedi_zapadlo_financno_ponovno_preverbo\(\) from public, anon, authenticated/);
assert.match(migration, /grant execute on function[\s\S]*?to service_role/);
assert.match(migration, /source in \('user', 'project_monitor', 'financial_recheck'\)/);
assert.match(migration, /add column financial_recheck_id uuid references public\.boniteta_ponovne_preverbe/);
assert.match(cautionMigration, /update public\.boniteta_ponovne_preverbe[\s\S]*?financial_caution/, "obstoječa nastavitev kapitala se mora varno preseliti v skupno finančno opozorilo");
assert.match(cautionMigration, /check \(reason in \('financial_caution'\)\)/, "baza mora sprejeti samo skupni razlog enkratne finančne ponovitve");
assert.match(customIntervalMigration, /drop constraint boniteta_ponovne_preverbe_interval_days_check[\s\S]*check \(interval_days between 1 and 365\)/, "nova lokalna migracija mora dovoliti vse cele intervale 1–365 dni");
["api/boniteta-pro.js", "api/_handlers/boniteta-pro.js"].forEach((relative) => {
  const apiSource = fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
  ["financial_recheck_get", "financial_recheck_save", "financial_recheck_delete"].forEach((action) => assert.match(apiSource, new RegExp(action), relative + " mora podpirati " + action));
});
const workerSource = fs.readFileSync(path.join(__dirname, "..", "api", "mehka-boniteta-delavec.js"), "utf8");
assert.match(workerSource, /financialRecheck\.schedule\(cfg\)/, "delavec mora razporediti zapadle enkratne preverbe");
assert.match(workerSource, /financialRecheck\.finish\(cfg, job, success, payload\)/, "delavec mora terminalno zaključiti enkratno preverbo");
assert.match(source, /Aktivne družbe[\s\S]*?V likvidaciji[\s\S]*?--network-share/, "omrežje direktorja mora pokazati dejanske statuse in njihovo razmerje");
assert.doesNotMatch(source, /signal\.layout === "network"[^\n]*[●○]/, "omrežje direktorja ne sme uporabljati naključnih mehurčkov");

console.log("✓ Celotni prednostni signalni model in enotni sistem kartic sta preverjena.");
