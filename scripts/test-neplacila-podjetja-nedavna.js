const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const recent = require("../app/neplacila-podjetja-nedavna.js");

const cases = [
  {
    ime_dolznika: "Mizarstvo Kovač",
    vrsta_dolznika: "podjetje",
    openregister_company_id: "company-1",
    ustvarjeno_at: "2026-08-28T10:00:00Z",
    znesek: 2450,
    datum_zapadlosti: "2026-07-25",
    status: "Aktiven",
    legal_form: "d.o.o.",
    davcna_stevilka: "SI87654321",
    kontaktna_oseba: "Maja Kovač",
    email_dolznika: "racuni@mizarstvo.example",
  },
  {
    ime_dolznika: "Fizična Oseba",
    vrsta_dolznika: "fizicna_oseba",
    ustvarjeno_at: "2026-08-28T11:00:00Z",
  },
  {
    ime_dolznika: "Mizarstvo Kovač",
    vrsta_dolznika: "podjetje",
    openregister_company_id: "company-1",
    ustvarjeno_at: "2026-08-20T10:00:00Z",
    znesek: 900,
    datum_zapadlosti: "2026-08-01",
    status: "Rešeno",
    telefon_dolznika: "+386 40 111 222",
  },
  {
    ime_dolznika: "Žagarstvo Sever",
    vrsta_dolznika: "podjetje",
    ustvarjeno_at: "2026-08-27T10:00:00Z",
  },
  {
    ime_dolznika: "  Gradnje   Novak  ",
    ustvarjeno_at: "2026-08-26T10:00:00Z",
  },
  {
    ime_dolznika: "Gradnje Novak",
    ustvarjeno_at: "2026-08-25T10:00:00Z",
    davcna_stevilka: "SI12345678",
  },
];

const companies = recent.podjetjaIzZadev(cases);
assert.equal(companies.length, 3, "fizične osebe in podvojena podjetja se ne smejo prikazati");
assert.deepEqual(
  companies.map((company) => company.name),
  ["Mizarstvo Kovač", "Žagarstvo Sever", "Gradnje   Novak"],
  "privzeti vrstni red mora slediti zadnji uporabi"
);
assert.equal(companies[0].phone, "+386 40 111 222", "starejši dopolnilni kontakt se mora ohraniti");
assert.equal(companies[0].cases.length, 2, "vsi primeri istega podjetja se morajo ohraniti v zgodovini");
assert.equal(companies[0].cases.filter((caseItem) => caseItem.status !== "Rešeno").length, 1, "aktiven primer se mora ohraniti");
assert.equal(companies[0].contactPerson, "Maja Kovač", "identiteta in kontakt se morata ohraniti");
assert.deepEqual(
  recent.sistemskaOcena(companies[0], "2026-08-28T12:00:00Z"),
  { score: 77, label: "Spremljaj" },
  "interna ocena mora biti deterministična glede na zgodovino in podani datum"
);
assert.match(
  recent.povzetekZgodovine(companies[0], "2026-08-28T12:00:00Z"),
  /2 pretekla primera • Zadnjič dolžnik 28\. 8\. 2026 • Aktiven 2\.450 € \/ 34 dni/,
  "zgodovina mora ostati ena kratka vsebinska vrstica"
);
assert.match(
  recent.razlagaSpremljanja(companies[0], "2026-08-28T12:00:00Z"),
  /Podjetje ima 2 pretekla primera\. Aktivna obveznost znaša 2\.450 € in je odprta že 34 dni, zato je priporočeno redno spremljanje plačil\./,
  "razširjena kartica mora pojasniti zgodovino in aktivno obveznost brez podvajanja statusnega naslova"
);
assert.equal(companies[2].vatId, "SI12345678", "podvojeni zapis mora dopolniti manjkajoče podatke");
const companiesWithSavedContact = recent.zdruziPodjetjaSStiki(companies, {
  "nova stranka": {
    name: "Nova stranka",
    phone: "+386 40 555 555",
    email: "nova@example.si",
    usedAt: "2026-08-30T12:00:00Z",
  },
});
assert.equal(companiesWithSavedContact.length, 4, "ročno shranjen stik mora biti viden tudi brez ustvarjene zadeve");
assert.equal(companiesWithSavedContact[3].name, "Nova stranka");
assert.deepEqual(companiesWithSavedContact[3].cases, [], "nov stik še nima zgodovine zadev");
assert.deepEqual(
  recent.razvrstiPodjetja(companies, "az").map((company) => recent.normalizirajIme(company.name)),
  ["gradnje novak", "mizarstvo kovac", "zagarstvo sever"],
  "razvrščanje A–Ž mora biti slovensko in neobčutljivo na šumnike"
);
assert.deepEqual(
  recent.filtrirajPodjetja(companies, "zagarstvo").map((company) => recent.normalizirajIme(company.name)),
  ["zagarstvo sever"],
  "iskalnik mora biti neobčutljiv na šumnike"
);
assert.deepEqual(
  recent.filtrirajPodjetja(companies, "SI12345678").map((company) => recent.normalizirajIme(company.name)),
  ["gradnje novak"],
  "iskalnik mora najti podjetje tudi po davčni številki"
);
const categories = recent.normalizirajKategorije([
  { id: "stranke", name: " Stranke ", companyKeys: ["company-1", "company-1", ""] },
  { id: "stranke", name: "Dobavitelji", companyKeys: ["zagarstvo sever"] },
]);
assert.equal(categories.length, 2, "veljavne uporabniške kategorije se morajo ohraniti");
assert.notEqual(categories[0].id, categories[1].id, "ID-ji kategorij morajo biti enolični");
assert.deepEqual(categories[0].companyKeys, ["company-1"], "podvojena podjetja v kategoriji se morajo odstraniti");
assert.equal(categories[0].color, "#469c98", "stara kategorija mora varno dobiti privzeto barvo");
assert.equal(categories[0].defaultView, "critical", "stara kategorija mora varno dobiti kritični privzeti pogled");
const configuredCategory = recent.normalizirajKategorije([{ name: "Barvna", color: "#d96f5f", defaultView: "highest_debt" }])[0];
assert.equal(configuredCategory.color, "#d96f5f");
assert.equal(configuredCategory.defaultView, "highest_debt");
const quickCompanies = recent.podjetjaIzZadev([
  { ime_dolznika: "Kritični", ustvarjeno_at: "2026-08-20", znesek: 900, datum_zapadlosti: "2026-01-01", status: "Predano odvetniku", telefon_dolznika: "1", email_dolznika: "a@a.si" },
  { ime_dolznika: "Visoki dolg", ustvarjeno_at: "2026-08-28", znesek: 5000, datum_zapadlosti: "2026-08-20", status: "Aktiven", telefon_dolznika: "1" },
]);
assert.equal(recent.uporabiHitriPogled(quickCompanies, "highest_debt")[0].name, "Visoki dolg");
assert.equal(recent.uporabiHitriPogled(quickCompanies, "oldest")[0].name, "Kritični");
assert.deepEqual(recent.uporabiHitriPogled(quickCompanies, "missing_contact").map((company) => company.name), ["Visoki dolg"]);
assert.equal(recent.uporabiHitriPogled(quickCompanies, "critical")[0].name, "Kritični");
assert.deepEqual(
  recent.razvrstiKategorijePoId(categories, [categories[1].id, categories[0].id]).map((category) => category.name),
  ["Dobavitelji", "Stranke"],
  "uporabniško premaknjen vrstni red kategorij se mora ohraniti"
);
assert.deepEqual(
  recent.premakniKategorijo(categories, categories[1].id, -1).map((category) => category.name),
  ["Dobavitelji", "Stranke"],
  "kategorijo mora biti mogoče premakniti za eno mesto"
);
assert.deepEqual(
  recent.premakniKategorijoNaMesto(categories, categories[1].id, categories[0].id).map((category) => category.name),
  ["Dobavitelji", "Stranke"],
  "kategorijo mora biti mogoče povleči na drugo mesto"
);
assert.deepEqual(
  recent.premakniKategorijoNaMesto(categories, categories[0].id, categories[1].id).map((category) => category.name),
  ["Dobavitelji", "Stranke"],
  "povlek naprej mora kategorijo postaviti za ciljno kategorijo"
);
assert.deepEqual(
  recent.zamenjajKategoriji(categories, categories[0].id, categories[1].id).map((category) => category.name),
  ["Dobavitelji", "Stranke"],
  "vlečenje mora kategoriji zamenjati mesti"
);
assert.deepEqual(
  recent.zamenjajKljuca(["prvo", "drugo", "tretje"], "prvo", "tretje"),
  ["tretje", "drugo", "prvo"],
  "vlečenje kartice mora karticama zamenjati mesti"
);
assert.deepEqual(
  recent.razdeliKategorijeNaStrani(Array.from({ length: 14 }, (_, index) => ({ id: String(index) })), 6).map((page) => page.length),
  [6, 6, 2],
  "spodnji dve vrstici se morata razdeliti na strani s šestimi premičnimi mesti"
);

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app", "neplacila.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "styles.css"), "utf8");
const clientJs = fs.readFileSync(path.join(root, "app", "neplacila-podjetja-nedavna.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app", "app.js"), "utf8");
assert.match(html, /id="nedavna-podjetja-trak"/);
assert.match(html, /id="gumb-shrani-stik"[^>]+aria-pressed="false"[^>]+aria-label="Shrani podjetje med stike"/);
assert.match(html, /obrazec__shrani-stik-napis">Shrani stik<\/span>/);
assert.match(html, /Sestavi opomin\s*<span class="btn__puscica"/);
assert.doesNotMatch(html, /Naprej: sestavi opomin/);
assert.match(css, /\.obrazec__shrani-stik\[aria-pressed="true"\]/);
assert.match(css, /\.obrazec__shrani-stik\s*\{[\s\S]*?border:\s*1px solid rgba\(255, 255, 255, 0\.78\)[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.08\)[\s\S]*?color:\s*#ffffff/);
assert.match(css, /\.obrazec__shrani-stik-ikona\s*\{[\s\S]*?border-radius:\s*50%/);
assert.match(html, /id="nedavna-podjetja-vec"[^>]+aria-controls="podjetja-sheet"/);
assert.match(html, /id="podjetja-sheet-iskanje"[^>]+placeholder="Išči podjetje"/);
assert.match(html, /id="podjetja-sheet-nedavna"[^>]*>Nedavno<\/button>/);
assert.match(html, /class="podjetja-sheet__seznam-uvod" hidden>[\s\S]*?id="podjetja-sheet-seznam-naslov">Nedavno uporabljena podjetja<\/p>[\s\S]*?id="podjetja-sheet-dodaj-v-kategorije"[^>]*>Dodaj v kategorije<\/button>/);
assert.match(html, /id="podjetja-sheet-dodaj-navodilo">Izberite podjetje spodaj in kategorijo zgoraj\.<\/p>[\s\S]*?id="podjetja-sheet-dodaj-preklici">Prekliči<\/button>[\s\S]*?id="podjetja-sheet-dodaj-potrdi"[^>]*disabled>Dodaj<\/button>/);
assert.match(html, /class="podjetja-sheet__kategorije-dok"[\s\S]*?id="podjetja-sheet-kategorija-vse"[\s\S]*?<span>Vse<\/span>[\s\S]*?id="podjetja-sheet-nedavna"[^>]*>Nedavno<\/button>[\s\S]*?id="podjetja-sheet-nova-kategorija"[^>]*aria-label="Nova kategorija">\+<\/button>[\s\S]*?id="podjetja-sheet-kategorija-izbira"[^>]*aria-expanded="false"[\s\S]*?id="podjetja-sheet-kategorije-viewport"[^>]*hidden[\s\S]*?id="podjetja-sheet-kategorije-seznam"/);
assert.match(html, /class="ocena-sheet__naslov sr-only" id="podjetja-sheet-naslov"[^>]*>Podjetja<\/h2>/);
assert.doesNotMatch(html, /podjetja-sheet-kategorije-(?:levo|desno)/);
assert.match(html, /class="podjetja-sheet__orodja"[\s\S]*?id="podjetja-sheet-iskanje"[\s\S]*?<\/label>\s*<\/div>\s*<section class="podjetja-sheet__kategorije"/);
assert.match(html, /id="podjetja-sheet-kategorije-pikice"[^>]*hidden/);
assert.match(html, /id="podjetja-sheet-kategorije-uredi"[^>]*hidden>Uredi<\/button>/);
assert.match(html, /id="podjetja-sheet-kategorija-obrazec"/);
assert.match(html, /id="podjetja-sheet-kategorija-nastavitve"[^>]*hidden[\s\S]*?Nastavitve kategorije[\s\S]*?id="podjetja-sheet-kategorija-povzetek">0 podjetij<[\s\S]*?id="podjetja-sheet-kategorija-uredi-ime"[^>]*maxlength="40"[^>]*required[\s\S]*?pridržite in povlecite[\s\S]*?id="podjetja-sheet-kategorija-izbrisi">Izbriši<[\s\S]*?>Shrani spremembe<\/button>/);
assert.match(html, /id="podjetja-sheet-hitri-pogledi"[\s\S]*?data-podjetja-hitri-pogled="critical">Kritični<[\s\S]*?data-podjetja-hitri-pogled="highest_debt">Najvišji dolg<[\s\S]*?id="podjetja-sheet-hitri-vec"[^>]*>Več<[\s\S]*?id="podjetja-sheet-hitri-vec-meni"[^>]*hidden/);
assert.doesNotMatch(html, /podjetja-sheet__hitri-pogledi-oznaka/);
assert.ok(html.indexOf('id="podjetja-sheet-seznam"') < html.indexOf('id="podjetja-sheet-hitri-pogledi"'), "hitri pogledi morajo biti pod seznamom podjetij");
assert.match(css, /\.podjetja-sheet__hitri-pogledi[\s\S]*?padding:\s*0;[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent/);
assert.match(html, /name="podjetja-kategorija-barva"[\s\S]*?id="podjetja-sheet-kategorija-privzeti-gumb"[\s\S]*?id="podjetja-sheet-kategorija-privzeti-meni"[^>]*role="listbox"[^>]*hidden[\s\S]*?data-podjetja-privzeti-pogled="critical">Najbolj kritične/);
assert.doesNotMatch(html, /<select id="podjetja-sheet-kategorija-privzeti-pogled"/);
assert.match(css, /podjetja-sheet__kategorija-privzeti-meni[\s\S]*?border-radius:\s*12px[\s\S]*?box-shadow:/);
assert.match(clientJs, /function nastaviPrivzetiPogled[\s\S]*?aria-selected/);
assert.match(clientJs, /function odpriPrivzetiMeni[\s\S]*?podjetja-sheet__kategorija-privzeti-meni--gor/);
assert.match(css, /--kategorija-barva/);
assert.match(clientJs, /aktivniHitriPogled/);
assert.match(html, /id="podjetja-sheet-kategorije-seznam"/);
assert.match(html, /podjetja-sheet__kategorije-namig[\s\S]*?Pridržite in povlecite kategorijo za razporejanje\./);
assert.doesNotMatch(html, /data-podjetja-razvrsti="az"/);
assert.ok(
  html.indexOf('id="nedavna-podjetja"') < html.indexOf('id="sklop-podjetje"'),
  "vrstica mora ostati vidna tudi pri izbrani fizični osebi"
);
assert.doesNotMatch(clientJs, /indeks < 3/);
assert.doesNotMatch(clientJs, /<span>Podjetje<\/span>/);
assert.doesNotMatch(clientJs, /nedavna-podjetja__pill--placeholder/);
assert.match(clientJs, /sklop\.hidden = false/);
assert.match(clientJs, /podjetjeGumb\.click\(\)/);
assert.match(clientJs, /data-fit-text-lines", "2"/);
assert.match(clientJs, /nedavna-podjetja__pill--izbran/);
assert.match(clientJs, /setAttribute\("aria-pressed", izbran \? "true" : "false"\)/);
assert.match(clientJs, /setAttribute\("aria-label", "Izberi podjetje " \+ podjetje\.name\)/);
assert.match(clientJs, /uj_neplacila_podjetja_kategorije_v1/);
assert.match(clientJs, /uj_neplacila_podjetja_opombe_v1/);
assert.match(clientJs, /uj_neplacila_podjetja_podatki_v1/);
assert.match(appJs, /aria-pressed"\) === "true"[\s\S]*?odstraniTrenutnoPodjetjeIzStikov\(\)/);
assert.match(appJs, /async function shraniTrenutnoPodjetjeMedStike\(opcije\)/);
assert.match(appJs, /soPodatkiSpremenjeni[\s\S]*?Kako želite shraniti spremembe\?[\s\S]*?dvaIzbira: true[\s\S]*?Posodobi isti stik[\s\S]*?Shrani kot nov stik/);
assert.match(appJs, /if \(!izbira\) return false/);
assert.match(appJs, /if \(izbira === "nov"\)[\s\S]*?prostKljucStika\(shranjeni, stik\.key\)/);
assert.match(appJs, /if \(izbira === "isti" && prejsnjiKljuc[\s\S]*?delete shranjeni\[prejsnjiKljuc\]/);
assert.match(appJs, /gumbShraniStik\.addEventListener\("click", async \(\) =>[\s\S]*?await shraniTrenutnoPodjetjeMedStike\(\)/);
assert.match(appJs, /const stikJeShranjen = await shraniTrenutnoPodjetjeMedStike\(\{ tiho: true \}\);[\s\S]*?if \(!stikJeShranjen\) return;/);
assert.match(appJs, /modal\.classList\.toggle\("osnutek-modal--sprememba-podatkov", dvaIzbira\)/);
assert.match(clientJs, /uj:podjetje-odstranjeno-iz-stikov/);
assert.match(clientJs, /localStorage\.setItem\(KATEGORIJE_SHRAMBA/);
assert.match(clientJs, /localStorage\.setItem\(OPOMBE_SHRAMBA/);
assert.match(clientJs, /localStorage\.setItem\(PODATKI_SHRAMBA/);
assert.match(clientJs, /podjetja-sheet__podjetje--bogato/);
assert.doesNotMatch(clientJs, /Podatki pripravljeni/);
assert.match(clientJs, /razsiri\.setAttribute\("aria-expanded", "false"\)/);
assert.match(clientJs, /podrobnosti\.hidden = true/);
assert.match(clientJs, /podjetja-sheet__podjetje--razsirjeno/);
assert.match(clientJs, /razsiri\.setAttribute\("aria-expanded", razsirjena \? "true" : "false"\)/);
assert.match(clientJs, /podjetja-sheet__zgodovina/);
assert.doesNotMatch(clientJs, /podjetja-sheet__interna-ocena/);
assert.doesNotMatch(clientJs, /querySelector\("b"\)\.textContent = String\(ocena\.score\)/);
assert.match(clientJs, /Potrebno spremljanje/);
assert.match(clientJs, /podjetja-sheet__status/);
assert.match(clientJs, /podjetja-sheet__kontaktni-podatki/);
assert.match(clientJs, /phone", label: "Telefon"[\s\S]*?email", label: "E-pošta"[\s\S]*?vatId", label: "Davčna številka"[\s\S]*?contactPerson", label: "Kontaktna oseba"/);
assert.match(clientJs, /podjetja-sheet__razlaga[\s\S]*?razlagaSpremljanja\(podjetje\)/);
assert.doesNotMatch(clientJs, /podjetja-sheet__podjetje-kategorije-napis/);
assert.match(clientJs, /podjetja-sheet__uporabi-podatke/);
assert.match(clientJs, /Moja opomba/);
assert.doesNotMatch(clientJs, /podatkiNaslov/);
assert.doesNotMatch(clientJs, /key: "name", label: "Naziv podjetja"/);
assert.match(clientJs, /var podatkovnaPolja = \[[\s\S]*?Davčna številka[\s\S]*?Kontaktna oseba[\s\S]*?Telefon[\s\S]*?E-pošta/);
assert.match(clientJs, /vnosPolja\.placeholder = "Ni podatka"/);
assert.match(clientJs, /urediPodatke\.textContent = "Uredi podatke"/);
assert.match(clientJs, /urediPodatke\.textContent = urejanjePodatkov \? "Shrani podatke" : "Uredi podatke"/);
assert.match(clientJs, /vnos\.value = vrednost[\s\S]*?shraniPodatkePodjetja\(kljuc, podjetje\)[\s\S]*?bogatoIme\.textContent = podjetje\.name/);
assert.match(clientJs, /naslov\.appendChild\(status\)[\s\S]*?naslov\.appendChild\(bogatoIme\)[\s\S]*?glava\.appendChild\(naslov\)[\s\S]*?glava\.appendChild\(razsiri\)/);
assert.doesNotMatch(clientJs, /datumUporabe/);
assert.match(clientJs, /nog[a]?\.appendChild\(urediPodatke\)[\s\S]*?nog[a]?\.appendChild\(opombaOvoj\)/);
assert.match(clientJs, /dodajGumb\.textContent = dodano \? "Dodano" : "Dodaj"/);
assert.match(clientJs, /Nastavitve kategorije " \+ kategorija\.name/);
assert.match(clientJs, /function razvrstiKategorijePoId/);
assert.match(clientJs, /function premakniKategorijo/);
assert.match(clientJs, /function premakniKategorijoNaMesto/);
assert.match(clientJs, /function zamenjajKategoriji/);
assert.match(clientJs, /function razdeliKategorijeNaStrani/);
assert.match(clientJs, /urejanjeKategorij = !urejanjeKategorij/);
assert.match(clientJs, /kategorijeUrediGumb\.innerHTML = urejanjeKategorij[\s\S]*?<span>Končano<\/span>[\s\S]*?<span>Uredi<\/span>/);
assert.match(clientJs, /if \(urejanjeKategorij\) \{[\s\S]*?odpriNastavitveKategorije\(kategorija\)/);
assert.match(clientJs, /podjetja-sheet__kategorija-nastavitve-gumb[\s\S]*?<svg/);
assert.match(clientJs, /function odpriNastavitveKategorije[\s\S]*?kategorijaUrediIme\.value = kategorija\.name[\s\S]*?kategorija\.companyKeys\.length/);
assert.match(clientJs, /function predogledBarveKategorije[\s\S]*?--kategorija-barva[\s\S]*?--kategorija-barva-mehka/);
assert.match(clientJs, /podjetja-sheet__kategorija-element--barva-predogled/);
assert.match(css, /\.podjetja-sheet__kategorija-element--barva-predogled[\s\S]*?background: var\(--kategorija-barva/);
assert.match(clientJs, /kategorijaBarve\.forEach[\s\S]*?addEventListener\("change"[\s\S]*?predogledBarveKategorije\(izbira\.value\)/);
assert.match(clientJs, /kategorijaNastavitve\.addEventListener\("submit"[\s\S]*?Vnesite ime kategorije\.[\s\S]*?moznost\.id !== kategorija\.id[\s\S]*?Kategorija s tem imenom že obstaja\.[\s\S]*?kategorija\.name = ime\.slice\(0, 40\)[\s\S]*?shraniKategorije\(\)/);
assert.match(clientJs, /kategorijaIzbrisi\.addEventListener\("click"[\s\S]*?kategorije = kategorije\.filter[\s\S]*?aktivnaKategorijaId = VSE_KATEGORIJE_ID[\s\S]*?ciljnaKategorijaId = ""[\s\S]*?shraniKategorije\(\)/);
assert.match(clientJs, /urejanjeKategorij = false;[\s\S]*?zapriNastavitveKategorije\(\);[\s\S]*?dodajanjeVKategorijo = true/);
assert.match(clientJs, /kategorijeUrediGumb\.disabled = dodajanjeVKategorijo/);
assert.match(clientJs, /win\.addEventListener\("pointermove", medPremikanjem/);
assert.match(clientJs, /predogledKategorij = zamenjajKategoriji\(predogledKategorij/);
assert.match(clientJs, /function zamenjajVidniMesti/);
assert.match(clientJs, /podjetja-sheet__kategorija-element--duh/);
assert.match(clientJs, /aktivnaKategorijaId = VSE_KATEGORIJE_ID/);
assert.match(clientJs, /kategorijeViewport\.scrollTo/);
assert.doesNotMatch(clientJs, /kategorije(?:Levo|Desno)|posodobiSmeriKategorij/);
assert.match(clientJs, /kategorijaIme\.addEventListener\("input"[\s\S]*?setCustomValidity\(""\)/);
assert.match(clientJs, /nedavnaGumb\.addEventListener\("click"[\s\S]*?iskalniNiz = "";[\s\S]*?iskanje\.value = "";/);
assert.match(clientJs, /dodajVKategorijeGumb\.addEventListener\("click"[\s\S]*?if \(dodajanjeVKategorijo\)[\s\S]*?prekliciDodajanjeVKategorijo\(\)[\s\S]*?dodajanjeVKategorijo = true/);
assert.match(clientJs, /function potrdiDodajanjeVKategorijo\(\)[\s\S]*?izbraniKljuciZaKategorijo\.forEach[\s\S]*?kategorija\.companyKeys\.push\(kljuc\)[\s\S]*?shraniKategorije\(\)/);
assert.match(clientJs, /izbraniKljuciZaKategorijo\.delete\(kljuc\)[\s\S]*?izbraniKljuciZaKategorijo\.add\(kljuc\)/);
assert.match(clientJs, /function prekliciDodajanjeVKategorijo\(\)[\s\S]*?dodajanjeVKategorijo = false[\s\S]*?izbraniKljuciZaKategorijo\.clear\(\)[\s\S]*?dodajPrekliciGumb\.addEventListener\("click", prekliciDodajanjeVKategorijo\)/);
assert.match(clientJs, /puscica\.textContent = izbranZaKategorijo \? "●" : "○"/);
assert.match(clientJs, /ciljnaKategorijaId = kategorija\.id[\s\S]*?posodobiDodajanjeVKategorijo\(\)/);
assert.match(clientJs, /if \(!dodajanjeVKategorijo\) omogociPremikanjeKategorije\(element, kategorija\)/);
assert.match(clientJs, /Izberite še kategorijo zgoraj\./);
assert.doesNotMatch(clientJs, /gumb\.title\s*=/);
assert.doesNotMatch(clientJs, /nedavna-podjetja__pill--prvi/);
assert.match(appJs, /function uskladiJezikNedavnihDolznikov\(vrsta\)/);
assert.match(appJs, /vrsta === "fizicna_oseba"[\s\S]*?"Nedavne osebe" : "Nedavna podjetja"[\s\S]*?"Več oseb" : "Več podjetij"/);
assert.match(appJs, /drsnik\.setAttribute\([\s\S]*?"aria-label"[\s\S]*?podrsajte levo ali desno/);
assert.match(appJs, /vecNapis\.classList\.toggle\([\s\S]*?"nedavna-podjetja__vec-napis--osebe"[\s\S]*?jeFizicnaOseba/);
assert.match(appJs, /vecGumb\.setAttribute\("aria-label", vecBesedilo\)/);
assert.match(appJs, /uskladiJezikNedavnihDolznikov\(nova\);[\s\S]*?if \(aktivnaVrstaDolznika === nova\)/);
assert.match(html, /<div class="dolznik-izbira-kartica">[\s\S]*?Kdo vam dolguje\?[\s\S]*?class="nedavna-podjetja"/);
assert.match(html, /<\/section>\s*<\/div>\s*<div class="dolznik-podatki-kartica">\s*<div class="vsebina-vrste-dolznika" id="sklop-podjetje">/);
assert.match(css, /\.dolznik-izbira-kartica[\s\S]*?column-gap:\s*10px[\s\S]*?row-gap:\s*6px[\s\S]*?padding:\s*10px 12px 11px[\s\S]*?border:\s*1px solid var\(--korak1-rob\)[\s\S]*?background:\s*linear-gradient/);
assert.match(css, /\.dolznik-izbira-kartica > \.obrazec-razdelek__naslov[\s\S]*?min-height:\s*40px[\s\S]*?align-self:\s*stretch[\s\S]*?align-items:\s*center/);
assert.match(css, /\.dolznik-izbira-kartica > \.tip-dolznika-preklop[\s\S]*?min-height:\s*36px[\s\S]*?height:\s*36px[\s\S]*?align-self:\s*center[\s\S]*?gap:\s*3px[\s\S]*?border:\s*1px solid rgba\(70, 156, 152, 0\.24\)[\s\S]*?background:\s*#f2f7f6/);
assert.match(css, /#obrazec-neplacilo \.tip-dolznika-preklop__gumb\s*\{[\s\S]*?min-height:\s*28px[\s\S]*?border-radius:\s*8px[\s\S]*?white-space:\s*nowrap/);
assert.match(css, /#obrazec-neplacilo \.tip-dolznika-preklop__gumb--aktiven[\s\S]*?background:\s*#469c98[\s\S]*?font-weight:\s*600/);
assert.match(css, /\.dolznik-podatki-kartica[\s\S]*?gap:\s*10px[\s\S]*?padding:\s*12px[\s\S]*?border:\s*1px solid var\(--korak1-rob\)[\s\S]*?background:\s*linear-gradient/);
assert.match(html, /<section class="stalna-stranka"[\s\S]*?<\/section>\s*<\/div>\s*<\/div>\s*<div class="obrazec-razdelek obrazec-razdelek--dolg">/);
assert.match(css, /\.obrazec-razdelek--dolznik[\s\S]*?border:\s*0[\s\S]*?background:\s*transparent[\s\S]*?box-shadow:\s*none/);
assert.match(css, /\.nedavna-podjetja[\s\S]*?margin:\s*0/);
assert.match(css, /\.nedavna-podjetja__naslov[\s\S]*?margin:\s*0 0 3px[\s\S]*?color:\s*#2f3736[\s\S]*?font-size:\s*11\.5px[\s\S]*?font-weight:\s*600/);
assert.match(css, /\.nedavna-podjetja__vrstica[\s\S]*?width:\s*100%[\s\S]*?height:\s*44px[\s\S]*?border:\s*0[\s\S]*?background-color:\s*#469c98[\s\S]*?background-image:\s*linear-gradient/);
assert.match(css, /\.nedavna-podjetja__vrstica[\s\S]*?--nedavna-cta-sirina:\s*clamp\(76px, 22\.4%, 92px\)/);
assert.match(css, /\.nedavna-podjetja__vrstica[\s\S]*?inset 0 1px 0 rgba\(255, 255, 255, 0\.24\)[\s\S]*?0 3px 10px rgba\(23, 54, 51, 0\.14\)/);
assert.doesNotMatch(css, /\.nedavna-podjetja__vrstica::before/);
assert.doesNotMatch(css, /\.nedavna-podjetja__vrstica::after/);
assert.match(css, /\.nedavna-podjetja__drsnik[\s\S]*?inset:\s*0 auto 0 5px[\s\S]*?width:\s*calc\(100% - 5px\)/);
assert.match(css, /\.nedavna-podjetja__drsnik[\s\S]*?border-radius:\s*18px 22px 22px 18px[\s\S]*?scroll-padding-inline-start:\s*0[\s\S]*?scroll-snap-type:\s*x mandatory/);
assert.doesNotMatch(css, /\.nedavna-podjetja__drsnik[^}]*?(?:-webkit-)?mask-image/);
assert.match(css, /\.nedavna-podjetja__trak[\s\S]*?align-items:\s*center[\s\S]*?height:\s*100%[\s\S]*?padding:\s*0 calc\(var\(--nedavna-cta-sirina\) \+ 8px\) 0 0/);
assert.match(css, /\.nedavna-podjetja__pill[\s\S]*?height:\s*36px[\s\S]*?border-radius:\s*18px/);
assert.match(css, /\.nedavna-podjetja__pill[\s\S]*?scroll-snap-align:\s*start[\s\S]*?scroll-snap-stop:\s*always/);
assert.match(css, /\.nedavna-podjetja__pill[\s\S]*?flex:\s*0 0 clamp\(147\.2px, 39\.1vw, 195\.5px\)[\s\S]*?width:\s*clamp\(147\.2px, 39\.1vw, 195\.5px\)/);
assert.match(css, /\.nedavna-podjetja__pill[\s\S]*?background:\s*#ffffff[\s\S]*?color:\s*#327f7c[\s\S]*?0 4px 9px rgba\(23, 54, 51, 0\.18\)/);
assert.match(css, /\.nedavna-podjetja__pill--izbran[\s\S]*?border-color:\s*#327f7c[\s\S]*?0 0 0 2px rgba\(255, 255, 255, 0\.82\)[\s\S]*?0 5px 10px rgba\(23, 54, 51, 0\.2\)/);
assert.match(css, /\.nedavna-podjetja__pill > span[\s\S]*?-webkit-line-clamp:\s*2/);
assert.match(css, /\.nedavna-podjetja__vec[\s\S]*?top:\s*0[\s\S]*?right:\s*0[\s\S]*?width:\s*var\(--nedavna-cta-sirina\)[\s\S]*?height:\s*44px/);
assert.match(css, /\.nedavna-podjetja__vec[\s\S]*?display:\s*grid[\s\S]*?place-items:\s*center[\s\S]*?padding:\s*0 4px 0 16px/);
assert.match(css, /\.nedavna-podjetja__vec[\s\S]*?box-sizing:\s*border-box[\s\S]*?border:\s*0[\s\S]*?border-radius:\s*0 22px 22px 0[\s\S]*?background:\s*#469c98/);
assert.match(css, /\.nedavna-podjetja__vec[\s\S]*?font-size:\s*11px/);
assert.match(css, /\.nedavna-podjetja__vec[\s\S]*?box-shadow:\s*none[\s\S]*?line-height:\s*1\.05[\s\S]*?text-align:\s*center[\s\S]*?white-space:\s*normal/);
assert.match(css, /\.nedavna-podjetja__vec[\s\S]*?mask-image:\s*radial-gradient\(circle 20px at 0 50%, transparent 19px, #000 20px\)/);
assert.match(css, /\.nedavna-podjetja__vec::before[\s\S]*?inset:\s*4px 3px 4px 2px[\s\S]*?border:\s*1px solid rgba\(255, 255, 255, 0\.48\)[\s\S]*?border-left:\s*0[\s\S]*?border-radius:\s*0 18px 18px 0[\s\S]*?rgba\(0, 0, 0, 0\.82\) 10%[\s\S]*?#000 18%/);
assert.match(css, /\.nedavna-podjetja__vec-napis[\s\S]*?max-width:\s*54px[\s\S]*?max-height:\s*2\.1em[\s\S]*?white-space:\s*normal/);
assert.match(css, /\.nedavna-podjetja__vec-napis--osebe[\s\S]*?max-width:\s*30px/);
assert.match(html, /class="nedavna-podjetja__vec-napis" data-fit-text data-fit-text-lines="2" data-fit-text-min="9">Več podjetij<\/span>/);
assert.match(css, /\.podjetja-sheet \.ocena-sheet__panel[\s\S]*?grid-template-rows:\s*auto auto minmax\(0, 1fr\)[\s\S]*?height:\s*min\(92dvh, 820px\)/);
assert.match(css, /@media \(min-width: 641px\)[\s\S]*?\.podjetja-sheet \.ocena-sheet__panel[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)/);
assert.match(css, /\.podjetja-sheet \.podjetja-sheet__telo[\s\S]*?display:\s*grid[\s\S]*?grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto/);
assert.match(css, /\.podjetja-sheet__orodja\s*\{[\s\S]*?display:\s*block/);
assert.match(css, /\.podjetja-sheet__iskanje input[\s\S]*?min-height:\s*44px[\s\S]*?border-radius:\s*13px/);
assert.match(css, /\.podjetja-sheet__kategorije[\s\S]*?border:\s*0[\s\S]*?background:\s*transparent/);
assert.match(css, /\.podjetja-sheet__kategorije-dok[\s\S]*?height:\s*99px[\s\S]*?background:\s*transparent/);
assert.doesNotMatch(css, /\.podjetja-sheet__kategorije-dok::before/);
assert.match(css, /\.podjetja-sheet__kategorije-viewport[\s\S]*?top:\s*99px[\s\S]*?padding:\s*8px 0[\s\S]*?overflow-x:\s*auto[\s\S]*?scroll-snap-type:\s*x mandatory/);
assert.match(css, /\.podjetja-sheet__kategorija-izbira[\s\S]*?top:\s*55px[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto 20px/);
assert.match(clientJs, /kategorijaIzbiraGumb\.addEventListener\("click"[\s\S]*?kategorijeViewport\.hidden = odprto/);
assert.match(css, /\.podjetja-sheet__kategorije-viewport[\s\S]*?background:\s*linear-gradient\(135deg, #f2faf8 0%, #ffffff 48%, #edf7f5 100%\)/);
assert.match(css, /\.podjetja-sheet__seznam-glava[\s\S]*?justify-content:\s*space-between/);
assert.match(css, /\.podjetja-sheet__dodaj-v-kategorije--aktivno:disabled[\s\S]*?border-color:\s*#469c98[\s\S]*?background:\s*#ffffff/);
assert.match(css, /\.podjetja-sheet__seznam-akcije[\s\S]*?gap:\s*6px/);
assert.match(css, /\.podjetja-sheet__dodaj-preklici[\s\S]*?border:\s*1px solid #9bcac6[\s\S]*?background:\s*#ffffff/);
assert.match(css, /\.podjetja-sheet__dodaj-navodilo[\s\S]*?border-left:\s*2px solid #469c98/);
assert.match(css, /\.podjetja-sheet__podjetje--izbrano[\s\S]*?linear-gradient\(135deg, #f0faf8 0%, #ffffff 72%\)/);
assert.match(css, /\.podjetja-sheet__kategorije-seznam[\s\S]*?min-height:\s*91px/);
assert.match(css, /\.podjetja-sheet__kategorije-stran[\s\S]*?padding:\s*0 8px[\s\S]*?grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)[\s\S]*?grid-template-rows:\s*repeat\(2, 42px\)/);
assert.match(css, /\.podjetja-sheet__kategorije-dok > \.podjetja-sheet__nedavna-gumb[\s\S]*?width:\s*var\(--podjetja-filter-sirina\)[\s\S]*?border-radius:\s*12px/);
assert.match(css, /\.podjetja-sheet__kategorija-obrazec input:focus,[\s\S]*?outline:\s*0[\s\S]*?box-shadow:\s*inset 0 0 0 1px rgba\(70, 156, 152, 0\.16\)/);
assert.match(css, /\.podjetja-sheet__kategorija-element[\s\S]*?border-radius:\s*12px[\s\S]*?touch-action:\s*pan-x pan-y/);
assert.match(clientJs, /DOLGI_PRITISK_MS = 300[\s\S]*?podjetja-sheet__kategorija-element--dolg-pritisk/);
assert.match(clientJs, /target\.closest\("button:not\(\.podjetja-sheet__kategorija-gumb\)"\)/);
assert.match(css, /\.podjetja-sheet__kategorija-element--duh[\s\S]*?position:\s*fixed !important[\s\S]*?translate3d\(var\(--kategorija-duh-x[\s\S]*?scale\(1\.045\)/);
assert.match(css, /\.podjetja-sheet__kategorija-element--duh\.podjetja-sheet__kategorija-element--spuscena[\s\S]*?transition:\s*transform 165ms/);
assert.match(css, /\.podjetja-sheet__kategorija-element:has\(\.podjetja-sheet__kategorija-gumb--aktiven\)[\s\S]*?background:\s*#ffffff/);
assert.match(css, /\.podjetja-sheet__kategorija-gumb--aktiven\s*\{[\s\S]*?color:\s*#4c6965/);
assert.match(css, /\.podjetja-sheet__kategorije-dok[\s\S]*?--podjetja-filter-sirina:\s*calc\(\(100% - 52px\) \/ 2\)/);
assert.match(css, /\.podjetja-sheet__kategorija-vse[\s\S]*?top:\s*7px[\s\S]*?left:\s*0[\s\S]*?width:\s*var\(--podjetja-filter-sirina\)[\s\S]*?border-radius:\s*12px/);
assert.match(css, /\.podjetja-sheet__kategorija-vse\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto[\s\S]*?padding:\s*6px 6px 6px 9px/);
assert.match(css, /\.podjetja-sheet__kategorija-gumb\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto[\s\S]*?padding:\s*6px 6px 6px 8px/);
assert.match(css, /\.podjetja-sheet__nova-kategorija[\s\S]*?right:\s*0[\s\S]*?width:\s*36px[\s\S]*?border-radius:\s*50%/);
assert.doesNotMatch(css, /\.podjetja-sheet__kategorije-smer/);
assert.match(css, /\.podjetja-sheet__kategorije-pikica--aktivna[\s\S]*?width:\s*17px/);
assert.match(css, /\.podjetja-sheet__kategorija-premakni[\s\S]*?width:\s*24px/);
assert.match(css, /\.podjetja-sheet__kategorije-uredi[\s\S]*?min-height:\s*34px[\s\S]*?border:\s*1px solid[\s\S]*?border-radius:\s*10px[\s\S]*?background:\s*#f6fbfa/);
assert.match(css, /\.podjetja-sheet__kategorije-uredi--aktivno[\s\S]*?background:\s*#469c98[\s\S]*?color:\s*#ffffff/);
assert.match(clientJs, /requestAnimationFrame\(izrisiPremikanje\)/);
assert.match(clientJs, /setProperty\("--kategorija-duh-x"/);
assert.match(clientJs, /function omogociPremikanjePodjetja[\s\S]*?DOLGI_PRITISK_MS = 300/);
assert.match(clientJs, /PODJETJA_VRSTNI_RED_SHRAMBA[\s\S]*?localStorage\.setItem\(PODJETJA_VRSTNI_RED_SHRAMBA/);
assert.match(clientJs, /Pridržite in povlecite kartico za razporejanje\./);
assert.match(css, /\.podjetja-sheet__podjetje-vrstica--duh[\s\S]*?position:\s*fixed !important[\s\S]*?translate3d\(var\(--podjetje-duh-x/);
assert.doesNotMatch(clientJs, /duh\.style\.left = \(zacetniOkvir\.left \+ dogodek\.clientX/);
assert.match(clientJs, /vrstniRedSpremenjen = true[\s\S]*?if \(vrstniRedSpremenjen\) \{[\s\S]*?shraniKategorije\(\)/);
assert.match(clientJs, /kategorijeUrediGumb\.innerHTML[\s\S]*?<svg[\s\S]*?<span>Uredi<\/span>/);
assert.match(css, /\.podjetja-sheet__kategorija-nastavitve[\s\S]*?background:\s*linear-gradient[\s\S]*?box-shadow/);
assert.match(css, /\.podjetja-sheet__kategorija-nastavitve input:focus,[\s\S]*?input:focus-visible[\s\S]*?outline:\s*0/);
assert.match(css, /\.podjetja-sheet__kategorija-nastavitve-gumb[\s\S]*?width:\s*30px[\s\S]*?color:\s*#3f8e8a/);
assert.match(clientJs, /dodajPotrdiGumb\.disabled = !pripravljeno/);
assert.match(clientJs, /dodajPotrdiGumb\.addEventListener\("click", potrdiDodajanjeVKategorijo\)/);
assert.match(clientJs, /dodajVKategorijeGumb\.textContent = "Dodaj v kategorije"/);
assert.match(css, /\.podjetja-sheet__podjetje--izbira[\s\S]*?grid-template-columns:\s*46px minmax\(0, 1fr\) 30px/);
assert.match(css, /\.podjetja-sheet__podjetje-puscica--izbira[\s\S]*?width:\s*30px[\s\S]*?height:\s*30px[\s\S]*?font-size:\s*0/);
assert.match(css, /\.podjetja-sheet__podjetje-puscica--izbira::before[\s\S]*?width:\s*18px[\s\S]*?height:\s*18px[\s\S]*?border:\s*1\.5px solid #78908c/);
assert.match(css, /\.podjetja-sheet__podjetje--izbrano \.podjetja-sheet__podjetje-puscica--izbira::before[\s\S]*?background:\s*#2f8b86/);
assert.match(css, /\.podjetja-sheet__dodaj-navodilo-vrstica[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto auto/);
assert.match(css, /\.podjetja-sheet__dodaj-potrdi[\s\S]*?background:\s*#469c98[\s\S]*?color:\s*#ffffff/);
assert.match(css, /\.podjetja-sheet__podjetje[\s\S]*?min-height:\s*78px[\s\S]*?grid-template-columns:\s*46px minmax\(0, 1fr\) 18px/);
assert.match(css, /Podjetja: zložljiva kartica po potrjeni mobilni referenci[\s\S]*?\.podjetja-sheet__podjetje-vrstica:has\(\.podjetja-sheet__podjetje--bogato\)[\s\S]*?min-height:\s*136px[\s\S]*?linear-gradient\(180deg, #ffffff 0%, #ffffff 65%/);
assert.match(css, /\.podjetja-sheet__podjetje-glava[\s\S]*?min-height:\s*56px[\s\S]*?grid-template-columns:\s*38px minmax\(0, 1fr\) 30px 30px/);
assert.match(clientJs, /podjetja-sheet__podjetje-izbrisi[\s\S]*?Izbriši podjetje[\s\S]*?<path d="M3 6h18"/);
assert.match(clientJs, /win\.confirm\("Ali želite podjetje " \+ podjetje\.name[\s\S]*?izbrisaniKljuciPodjetij\.add\(kljuc\)[\s\S]*?podjetja = podjetja\.filter/);
assert.match(clientJs, /IZBRISANA_PODJETJA_SHRAMBA[\s\S]*?localStorage\.setItem\(IZBRISANA_PODJETJA_SHRAMBA/);
assert.match(css, /\.podjetja-sheet__podjetje-izbrisi\s*\{[\s\S]*?width:\s*30px[\s\S]*?border-radius:\s*50%[\s\S]*?color:\s*#df3f35/);
assert.match(css, /\.podjetja-sheet__kontaktni-podatek\s*\{[\s\S]*?min-height:\s*34px[\s\S]*?padding:\s*2px 6px/);
assert.match(css, /\.podjetja-sheet__podjetje--razsirjeno[\s\S]*?min-height:\s*0[\s\S]*?height:\s*auto/);
assert.match(css, /\.podjetja-sheet__podjetje-vrstica:has\(\.podjetja-sheet__podjetje--razsirjeno\)[\s\S]*?height:\s*max-content[\s\S]*?grid-template-rows:\s*max-content/);
assert.match(css, /\.podjetja-sheet__podjetje-naslov strong[\s\S]*?color:\s*#667b79[\s\S]*?font-size:\s*13px[\s\S]*?font-weight:\s*540/);
assert.match(clientJs, /bogatoIme\.title = podjetje\.name[\s\S]*?data-fit-text-min", "8"/);
assert.match(clientJs, /ikona\.classList\.add\("podjetja-sheet__podjetje-ikona--status"[\s\S]*?ikona\.innerHTML = ikoneStatusa\[statusPodjetja\.razred\]/);
assert.match(clientJs, /dobra:[\s\S]*?srednja:[\s\S]*?nizka:/);
assert.doesNotMatch(clientJs, /podjetja-sheet__status-ikona/);
assert.match(css, /\.podjetja-sheet__podjetje--bogato \.podjetja-sheet__podjetje-ikona--status-srednja[\s\S]*?color:\s*#e89400/);
assert.match(css, /\.podjetja-sheet__status\s*\{[\s\S]*?flex-direction:\s*row[\s\S]*?gap:\s*0/);
assert.match(css, /\.podjetja-sheet__kontaktni-podatki[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)[\s\S]*?gap:\s*4px[\s\S]*?padding:\s*0 8px 8px/);
assert.match(css, /\.podjetja-sheet__kontaktni-podatek-besedilo strong\.je-prazno[\s\S]*?font-size:\s*9\.45px/);
assert.match(css, /\.podjetja-sheet__osnovni-podatek input::placeholder[\s\S]*?font-size:\s*9\.8px/);
assert.match(css, /\.podjetja-sheet__podjetje--razsirjeno \.podjetja-sheet__kontaktni-podatki[\s\S]*?display:\s*none/);
assert.match(css, /\.podjetja-sheet__osnovni-podatki-mreza[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /\.podjetja-sheet__osnovni-podatek--sirina[\s\S]*?grid-column:\s*1 \/ -1/);
assert.match(css, /\.podjetja-sheet__osnovni-podatki--urejanje[\s\S]*?border-color:\s*#88c5c0/);
assert.match(css, /\.podjetja-sheet__podjetje-noga[\s\S]*?grid-template-columns:\s*minmax\(0, \.9fr\) minmax\(0, 1\.1fr\)/);
assert.match(css, /\.podjetja-sheet__uredi-podatke--shrani[\s\S]*?background:\s*#278f8a[\s\S]*?color:\s*#ffffff/);
assert.match(css, /\.podjetja-sheet__podjetje-podrobnosti\[hidden\][\s\S]*?display:\s*none !important/);
assert.match(css, /\.podjetja-sheet__podjetje-podrobnosti\s*\{[\s\S]*?gap:\s*8px[\s\S]*?padding:\s*5px 12px/);
assert.match(css, /\.podjetja-sheet__zgodovina\s*\{[\s\S]*?background:\s*transparent/);
assert.doesNotMatch(css, /podjetja-sheet__zgodovina[^}]*background:\s*#(?:f|e|d|c)/i);
assert.match(css, /\.podjetja-sheet__razlaga\s*\{[\s\S]*?grid-template-columns:\s*25px minmax\(0, 1fr\)/);
assert.match(clientJs, /zgodovinaBesedilo\.setAttribute\("data-fit-text-lines", "2"\)/);
assert.match(css, /\.podjetja-sheet__uporabi-podatke[\s\S]*?background:\s*linear-gradient/);
assert.match(appJs, /vrsta_dolznika[\s\S]*?openregister_company_id[\s\S]*?davcna_stevilka[\s\S]*?telefon_dolznika[\s\S]*?email_dolznika/);
assert.match(appJs, /razsirjenaPoljaZadev[\s\S]*?rezultat\.error[\s\S]*?schema cache[\s\S]*?select\(osnovnaPoljaZadev\)/);
assert.match(css, /\.podjetja-sheet__kategorija-toggle[\s\S]*?min-width:\s*68px/);
assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*?body\.app-testna-vrstica-prisotna \.podjetja-sheet \.ocena-sheet__panel[\s\S]*?height:\s*calc\(100dvh - 48px - var\(--app-testna-safe-bottom, env\(safe-area-inset-bottom, 0px\)\)\)[\s\S]*?border-radius:\s*0/,
  "Mobilni panel podjetij mora segati do vrha in se končati nad nespremenjeno 48px navigacijo.");

console.log("✓ nedavna podjetja: iskanje, kategorije, podatki in potrjeni vizualni kontrakt");
