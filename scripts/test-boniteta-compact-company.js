"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.html"), "utf8");
var js = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.js"), "utf8");
var center = fs.readFileSync(path.join(root, "app", "boniteta-sredisce.js"), "utf8");
var css = fs.readFileSync(path.join(root, "app", "bonitetna-podjetje-grafike.css"), "utf8");

assert.match(html, /boniteta-podjetje-navigacije[\s\S]*?boniteta-podjetje-navigacija--glavna[\s\S]*?>Pregled<\/b>[\s\S]*?>Finance<\/b>[\s\S]*?>Kaj izstopa<\/b>[\s\S]*?<\/nav>[\s\S]*?boniteta-podjetje-navigacija--sekundarna[\s\S]*?>Pot<\/b>[\s\S]*?>Dodatno<\/b>[\s\S]*?>Plus<\/b>[\s\S]*?<\/nav>[\s\S]*?<\/div>[\s\S]*?boniteta-podjetje-pogledi/,
  "Pregled, Finance in Kaj izstopa morajo biti v glavni vrstici, Pot, Dodatno in Plus pa v istem ovoju nad podatki");
assert.match(html, /data-podjetje-pogled="pot"[\s\S]*?<svg[\s\S]*?data-podjetje-pogled="dodatno"[\s\S]*?<svg[\s\S]*?data-podjetje-pogled="plus"[\s\S]*?<svg/,
  "sekundarni trije pogledi morajo imeti razlikovalne ikone");
assert.match(html, /data-podjetje-pogled="kljucni"[\s\S]*?<svg[\s\S]*?data-podjetje-pogled="finance"[\s\S]*?<svg[\s\S]*?data-podjetje-pogled="izstopa"[\s\S]*?<svg/,
  "vseh šest pogledov mora uporabljati medsebojno usklajene črtne ikone");
assert.match(html, /<h4>Na kratko<\/h4>[\s\S]*?boniteta-podjetje-status-podjetja/,
  "kompaktni povzetek mora biti prisoten");
assert.match(html, /boniteta-podjetje-zgornji-povzetek[\s\S]*?boniteta-podjetje-glava[\s\S]*?data-fit-text-lines="3"[\s\S]*?boniteta-identiteta-nadaljuj/,
  "nova zgornja kartica mora združiti večvrstično ime podjetja in rezultat insolvenčnosti");
assert.doesNotMatch(html, /boniteta-podjetje-vsi-podatki|Prikaži vse podatke/,
  "pregled ne sme ponujati zavajajočega gumba, ki uporabnika preusmeri v widgete");
assert.match(js, /dodajSkupinoKljucnihPodatkov\("seznam", "Podatki"\)[\s\S]*?\[pravnaOblika, identiteta\.registerNumber\][\s\S]*?join\(" · "\)/,
  "pravna oblika in register morata biti združena v eno pregledno vrstico");
assert.match(js, /podjetjeJeAktivno = identiteta\.active === true[\s\S]*?podjetjeJeNeaktivno = identiteta\.active === false[\s\S]*?classList\.toggle\("is-active", podjetjeJeAktivno\)[\s\S]*?classList\.toggle\("is-inactive", podjetjeJeNeaktivno\)/,
  "aktiven status mora biti zelen, neaktiven pa rdeč in določen iz dejanskih podatkov");
assert.match(js, /return \{ kljucni: true, izstopa: true,/,
  "pogled Kaj izstopa mora ostati dostopen tudi brez pomembne ugotovitve");
assert.match(js, /classList\.toggle\("is-empty-result", pogled === "izstopa" && niPomembnihUgotovitev\)/,
  "gumb Kaj izstopa mora ob praznem rezultatu dobiti nevtralno stanje");
assert.match(css, /button\.is-empty-result \{ color: #6f8582; \}[\s\S]*?button\.is-empty-result::before \{[\s\S]*?background: #f1f5f4;/,
  "gumb brez ugotovitev mora biti siv pred klikom in po njem");
assert.match(css, /boniteta-podjetje-navigacije \{[\s\S]*?overflow: hidden;[\s\S]*?boniteta-podjetje-navigacija--glavna[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)[\s\S]*?boniteta-podjetje-navigacija--sekundarna[\s\S]*?border-top: 1px solid/,
  "končna CSS plast mora obe vrstici združiti v eno kartico in sekundarno jasno ločiti");
assert.match(css, /boniteta-podjetje-navigacija--glavna button\[data-podjetje-pogled\],[\s\S]*?boniteta-podjetje-navigacija--sekundarna button\[data-podjetje-pogled\][\s\S]*?grid-column: auto;[\s\S]*?grid-row: auto;/,
  "stare dvovrstične koordinate ne smejo porušiti enakih širin v ločenih navigacijah");
assert.match(css, /boniteta-podjetje-navigacija--sekundarna \{[\s\S]*?min-height: 61px;[\s\S]*?boniteta-podjetje-navigacija button > span \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?button > span svg \{[\s\S]*?width: 18px;[\s\S]*?button\[aria-selected="true"\][\s\S]*?color: #fff;[\s\S]*?linear-gradient\(145deg, #18aaa3, #087f83\)/,
  "vseh šest gumbov mora imeti enako postavitev ikon in enak aktiven turkizen slog");
assert.match(css, /boniteta-podjetje-navigacija--sekundarna button > span svg \{[\s\S]*?width: 18px;[\s\S]*?height: 18px;/,
  "zgornje in spodnje ikone morajo biti enake velikosti 18 krat 18 pik");
assert.match(css, /boniteta-podjetje-navigacija button > span \{[\s\S]*?position: relative;[\s\S]*?padding: 0 26px;[\s\S]*?button > span svg \{[\s\S]*?position: absolute;[\s\S]*?left: 5px;[\s\S]*?translateY\(-50%\)[\s\S]*?button > span b \{[\s\S]*?width: min-content;[\s\S]*?text-align: center;[\s\S]*?white-space: normal;/,
  "ikone morajo biti skrajno levo in navpično centrirane, enobesedni ter večbesedni naslovi pa centrirani brez rezanja");
assert.match(html, /data-podjetje-pogled="(?:kljucni|izstopa|plus|finance|pot|dodatno)"[\s\S]*?data-fit-text-min=/,
  "navigacijske oznake morajo uporabljati dinamično prilagajanje besedila");
assert.match(js, /function izrisiFinance\(company, vrsta\)[\s\S]*?boniteta-pogled__opomba[\s\S]*?function izrisiPlus\(\)/,
  "Finance morajo ostati samostojen grafični pogled");
assert.match(js, /function izrisiPlus\(\)[\s\S]*?dopolnilniVpogledHtml\(northDataPodrobnosti\(zadnjiRegistrskiPodatki\)\)/,
  "dopolnilni bilančni podatki morajo biti prikazani samo v pogledu Plus");
assert.match(css, /data-pogled="plus"\] \.boniteta-finance-details \{[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/,
  "pogled Plus mora vsebino prikazati neposredno na ozadju brez dodatnega widgeta znotraj widgeta");
assert.match(css, /boniteta-podjetje-kartica--dejavnost \{ min-height: 66px; \}[\s\S]*?boniteta-podjetje-kartica\.is-interactive::after[\s\S]*?right: 7px;/,
  "dolga dejavnost mora imeti dovolj prostora, puščica pa sme biti prikazana samo pri dejansko interaktivni vrstici");
assert.match(css, /boniteta-podjetje-ustanovitev__starost \{[\s\S]*?top: 42px;/,
  "starost mora biti poravnana z drugima stolpcema in ostati znotraj povzetka");
assert.match(html, /boniteta-podjetje-ustanovitev__starost-vrednost" data-fit-text[\s\S]*?boniteta-podjetje-ustanovitev-meseci"[\s\S]*?boniteta-podjetje-ustanovitev-meseci-enota"/,
  "celotna starost mora ostati v enem samodejno prilagojenem bloku");
assert.match(js, /podjetjeUstanovitevMeseci\.textContent = "in " \+ starost\.meseci;[\s\S]*?podjetjeUstanovitevMeseciEnota\.textContent = starost\.meseciEnota;/,
  "starost mora mesece prikazati kot 'in N' ter enoto v ločeni vrstici");
assert.match(css, /boniteta-podjetje-ustanovitev__starost-vrednost \{[\s\S]*?display: grid;[\s\S]*?grid-template-rows: auto auto;[\s\S]*?starost-vrednost > small \{[\s\S]*?grid-row: 2;[\s\S]*?strong\.is-active \{ color: #15955f; \}[\s\S]*?strong\.is-inactive \{ color: #cf514b; \}/,
  "leta morajo biti manjša v prvi vrstici, meseci pod njimi, status pa zelen oziroma rdeč");
assert.match(css, /starost > \.boniteta-podjetje-ustanovitev__starost-vrednost > strong \{[\s\S]*?font-size: 1\.55em;[\s\S]*?starost-vrednost > small \{[\s\S]*?text-transform: none;/,
  "leta morajo biti kompaktnejša, zapis mesecev pod njimi pa mora ostati pravilno izpisan z malimi črkami");
assert.match(css, /boniteta-podjetje-ustanovitev \{[\s\S]*?min-height: 105px;[\s\S]*?boniteta-podjetje-ustanovitev__opis \{[\s\S]*?align-content: center;[\s\S]*?place-items: center;[\s\S]*?boniteta-podjetje-ustanovitev__starost \{[\s\S]*?height: 50px;[\s\S]*?justify-items: center;[\s\S]*?boniteta-podjetje-ustanovitev__status \{[\s\S]*?place-items: center;/,
  "14 odstotkov višja vrstica mora vse tri podatkovne stolpce centrirati vodoravno in navpično");
assert.match(css, /boniteta-podjetje-kartica \+ \.boniteta-podjetje-kartica::before \{[\s\S]*?height: 1px;[\s\S]*?background: rgba\(9, 99, 96, \.11\);/,
  "Sedež, dejavnost, osebe in register morajo ločevati enake nežne črte kot zgornji povzetek");
assert.match(css, /boniteta-podatki--identiteta \.boniteta-kljucni-skupina--seznam \.boniteta-podjetje-kartica--register:not\(\.is-interactive\)::after \{[\s\S]*?content: none;/,
  "staro navpično ločilo desno od vrstice Register mora biti odstranjeno");
assert.match(css, /boniteta-podjetje-zgornji-povzetek \{[\s\S]*?min-height: 0;[\s\S]*?padding: 12px;[\s\S]*?grid-template-rows: auto 55px;[\s\S]*?gap: 8px;/,
  "zgornja kartica mora imeti dinamično višino brez belega praznega prostora pri kratkem imenu");
assert.match(css, /boniteta-podjetje-zgornji-povzetek > \.boniteta-rezultat__sklop-glava \{[\s\S]*?height: auto !important;[\s\S]*?min-height: 38px !important;[\s\S]*?boniteta-podjetje-zgornji-povzetek \.boniteta-podjetje-glava \{[\s\S]*?height: auto;[\s\S]*?min-height: 38px !important;/,
  "glava se mora skrčiti pri kratkem imenu in zrasti pri večvrstičnem imenu");
assert.match(css, /boniteta-podjetje-zgornji-povzetek[\s\S]*?#boniteta-hwk-status \{ display: none !important; \}[\s\S]*?boniteta-podjetje-glava__monogram[\s\S]*?width: 38px !important;[\s\S]*?height: 38px !important;/,
  "nova glava ne sme prikazati stare statusne značke, monogram pa mora ostati v referenčni velikosti");
assert.match(js, /function nastaviKarticoInsolvenceZakljuceno\(podatki\)[\s\S]*?identitetaNadaljuj\.disabled = false;[\s\S]*?naslov\.textContent = status[\s\S]*?V uradnem viru ni najdenih objav\./,
  "zaključena kartica mora prikazati omejen rezultat uradne poizvedbe in ostati dostopna");
assert.match(html, /boniteta-identiteta-nadaljuj__ikona-cta[\s\S]*?boniteta-identiteta-nadaljuj__ikona-rezultat[\s\S]*?>2\. KORAK<[\s\S]*?>Preveri insolventnost<[\s\S]*?boniteta-identiteta-nadaljuj__puscica/,
  "CTA mora imeti svojo ikono, jasen naslov drugega koraka in ločeno krožno puščico");
assert.match(js, /function nastaviKarticoInsolvenceZaNadaljevanje\(podatki\)[\s\S]*?"2\. KORAK"[\s\S]*?"Preveri insolventnost"[\s\S]*?"Preverjanje uradnih objav"[\s\S]*?"Podatki podjetja so potrjeni"/,
  "ponovni prikaz mora varno obnoviti poziv k insolvenčni preverbi in potrjeno stanje podjetja");
assert.match(css, /Enotna glava podjetja:[\s\S]*?boniteta-podjetje-zgornji-povzetek \{[\s\S]*?gap: 0;[\s\S]*?padding: 0;[\s\S]*?overflow: hidden;[\s\S]*?linear-gradient\(135deg, #07898c[\s\S]*?boniteta-identiteta-nadaljuj\.is-complete:not\(\[hidden\]\)[\s\S]*?linear-gradient\(135deg, #f4fcf7/,
  "glava in dejanje morata biti ena kartica z močnim CTA ter mirnim zaključenim stanjem");
assert.match(js, /if \(zadnjiInsolvencniRezultatPripravljen \|\| identitetaNadaljuj\.classList\.contains\("is-complete"\)\) \{[\s\S]*?nastaviInsolvencnoOkno\(true, true\);[\s\S]*?return;/,
  "puščica zaključene kartice mora odpreti dejanski rezultat preverbe");
assert.match(js, /function dopolniPraznaPotrditvenaPoljaIzRegistra\(\)[\s\S]*?if \(!imaRegistrskiVir\)[\s\S]*?return;[\s\S]*?if \(!polje\.value\.trim\(\)[\s\S]*?identiteta\.naslov \|\| zadnji\.naslov[\s\S]*?identiteta\.postnaStevilka \|\| zadnji\.postnaStevilka[\s\S]*?posodobiPotrditevIdentitete\(\);/,
  "pred insolvenčno potrditvijo se morajo prazna polja znova napolniti iz registra, obstoječi uporabnikovi popravki pa ostanejo nedotaknjeni");
assert.match(js, /function zacniInsolvencnoPreverboBrezPonovnegaPotrjevanja\(\)[\s\S]*?identiteta\.status !== "verified_register"[\s\S]*?potrditevCheckbox\.checked = true;[\s\S]*?potrditevGumb\.click\(\);[\s\S]*?return true;/,
  "OpenRegister potrjeno podjetje mora neposredno začeti insolvenčno preverbo brez podvojenega obrazca");
assert.match(js, /var companyId = identiteta\.companyId \|\|[\s\S]*?if \(!companyId\) return false;[\s\S]*?openRegisterCompanyId: companyId,[\s\S]*?uporabiOpenRegisterIdentiteto: true/,
  "neposredna poizvedba mora ohraniti OpenRegister identiteto in ne sme pasti v stari ročni rezultat");
assert.match(js, /var podatki = await izvediPrekoCakalneVrste\(telo, token\);[\s\S]*?generacijaNeposredneZahteve !== generacijaNeposredneInsolvence\) return;[\s\S]*?if \(jeNeposrednaZahteva && !jeUporabenNeposredniInsolvencniRezultat\(podatki\)\)[\s\S]*?izrisi\(podatki\);\s*if \(jeNeposrednaZahteva\) nastaviInsolvencnoOkno\(true, true\);/,
  "neposredna poizvedba mora po zaključku odpreti novi insolvenčni rezultat, ne starega splošnega zaslona");
assert.match(js, /function jeUporabenNeposredniInsolvencniRezultat\(podatki\)[\s\S]*?if \(!imaIdentiteto\) return false;[\s\S]*?imaUradniInsolvencniPosnetek\(podatki\)/,
  "nepopoln odgovor brez potrjene identitete in uradnega rezultata ne sme odpreti starega zaslona");
assert.doesNotMatch(js, /Noben avtomatski vir ni vrnil dovolj zanesljive identitete\.|identitetaNaslov\.textContent = "Identiteta"/,
  "stari splošni rezultat identitete mora biti odstranjen iz izvajalne poti");
assert.match(js, /var potrjeniNosilec = document\.getElementById\("boniteta-potrdi-nosilec"\)\.value\.trim\(\);[\s\S]*?jeNeposrednaZahteva && zadnjaRegistrskaIdentiteta && zadnjaRegistrskaIdentiteta\.entityType === "company"[\s\S]*?potrjeniNosilec = "";/,
  "registrsko potrjena družba ne sme biti zavrnjena zaradi stare oblike zapisa zastopnika Priimek, Ime");
assert.match(js, /if \(zacniInsolvencnoPreverboBrezPonovnegaPotrjevanja\(\)\) return;[\s\S]*?dopolniPraznaPotrditvenaPoljaIzRegistra\(\);[\s\S]*?nastaviInsolvencnoOkno\(true, false\);/,
  "potrditveni obrazec mora ostati samo kot varna rezerva za nejasne ali ročne podatke");
assert.match(center, /location\.hostname==="localhost"[\s\S]*?company-preview[\s\S]*?compact[\s\S]*?cta[\s\S]*?UJBonitetaNastaviKarticoInsolvenceZaNadaljevanje/,
  "vizualna predogleda rezultata in CTA morata biti omejena samo na lokalno okolje");
assert.match(center, /variant==="financna-varovalka"[\s\S]*?117255\.6[\s\S]*?Equity[\s\S]*?-62632\.89[\s\S]*?Liabilities[\s\S]*?117255\.6/,
  "lokalni predogled mora ohraniti regresijski primer zamenjave bilančne vsote in obveznosti");
assert.match(js, /function kratkiUvidHtml\(naslov, kratko\)[\s\S]*?<span>NA KRATKO<\/span>[\s\S]*?<p>' \+ esc\(kratko\) \+ '<\/p>/,
  "vsak podatkovni pogled mora dobiti skupni vedno kratki uvid");
assert.doesNotMatch(js, /data-kratki-uvid-nacin|poveziKratkiUvid|Obseg povzetka|>Podrobno<\/button>/,
  "kratki uvid ne sme več prikazovati preklopa Na kratko oziroma Podrobno");
assert.match(js, /function izrisiFinance[\s\S]*?kratkiUvidHtml\(financniNaslov[\s\S]*?function izrisiPlus[\s\S]*?kratkiUvidHtml\([\s\S]*?function izrisiPot[\s\S]*?kratkiUvidHtml\(potNaslov[\s\S]*?function izrisiIzstopa[\s\S]*?kratkiUvidHtml\(signalNaslov[\s\S]*?function izrisiDodatno[\s\S]*?kratkiUvidHtml\(dodatnoNaslov/,
  "Finance, Plus, Pot, Kaj izstopa in Dodatno morajo povzetek graditi iz svojih dejanskih podatkov");
assert.match(js, /function izrisiRegistrskoPodjetje[\s\S]*?pregledNaslov = identiteta\.active[\s\S]*?kratkiUvidHtml\(pregledNaslov, pregledKratko, pregledPodrobno\)/,
  "Pregled mora povzetek izpeljati iz statusa in dejansko prikazanih registrskih polj");
assert.match(js, /var podatkiSeznam = dodajSkupinoKljucnihPodatkov\("seznam", "Podatki"\);[\s\S]*?podatkiSeznam\.insertAdjacentHTML\("afterbegin", kratkiUvidHtml\(pregledNaslov, pregledKratko, pregledPodrobno\)\)[\s\S]*?dodajKarticoPodjetja\(podatkiSeznam, "sedez"/,
  "povzetek Pregleda mora biti polno široka glava widgeta Podatki pred vsemi vrsticami");
assert.match(css, /\.boniteta-kratki-uvid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?boniteta-kljucni-skupina--seznam > \.boniteta-kratki-uvid \{ width:100%;margin:0;[\s\S]*?border-radius:16px 16px 0 0;/,
  "kratki uvid mora brez notranjih gumbov tvoriti polno široko zgornjo glavo widgeta");
assert.match(css, /boniteta-podjetje-podrobnosti > \.boniteta-kratki-uvid \{ width:calc\(100% \+ 56px\);margin:-25px -28px 18px;/,
  "povzetek drugih pogledov mora segati od roba do roba podatkovnega widgeta");

console.log("✓ Združena dvonivojska navigacija podjetja je preverjena.");
