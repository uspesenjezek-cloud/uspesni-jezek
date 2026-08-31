"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var father = require("../app/atena-card-templates").categories["2.0"];

var source = fs.readFileSync(path.join(__dirname, "..", "app", "neplacila-cilj.js"), "utf8");
var izvedbaSource = fs.readFileSync(path.join(__dirname, "..", "app", "izvedba.js"), "utf8");
assert.match(source, /var nacin = "natural";/,
  "Atena mora imeti Povej ali napiši kot osnovni način cilja.");
assert.match(source, /var shranjeniCilj = preberiCiljSejo\(\);\s*nacin = "natural";/,
  "ponovni vstop v Cilj ne sme obnoviti starega ročnega načina.");
var css = fs.readFileSync(path.join(__dirname, "..", "app", "neplacila-zgodovina.css"), "utf8");
var ids = [
  "full_payment", "partial_payment_now", "installment_plan", "new_deadline",
  "amicable_settlement", "dispute_resolution", "compensation", "payment_security",
  "legal_recovery", "insolvency_claim", "close_without_recovery", "custom_goal",
];

ids.forEach(function (id) {
  assert.ok(father.goals.some(function (card) { return card.id === id; }), "Manjka FATHER cilj " + id);
});
assert.equal(new Set(ids).size, 12);
assert.equal(father.category, "2.0", "Ciljni FATHER mora biti v kanonični kategoriji 2.0.");
assert.match(source, /data-cilj-father/);
assert.equal(father.goals.find(function (card) { return card.id === "full_payment"; }).manualVisible, false, "Stara ročna grafika Celotno plačilo mora ostati skrita, Luna pa lahko še vedno uporabi semantični cilj.");
assert.match(source, /CILJ_FATHER_KARTICE\.filter\(function \(kartica\) \{ return kartica\.rocno !== false; \}\)\.map/, "Ročni katalog ne sme izrisati skritih starih kartic.");
assert.match(source, /if \(kartica\.id === ciljOsnutekId\) \{[\s\S]*?ciljOsnutekId = null;[\s\S]*?debug\.izrisiActionSheet\(\);[\s\S]*?return;/,
  "Drugi klik izbrane FATHER kartice mora vedno zapreti vnosnik in odstraniti izbor.");
assert.match(source, /if \(rezultat\.id === pravnaOsnutekId\) \{[\s\S]*?pravnaOsnutekId = null;[\s\S]*?debug\.izrisiActionSheet\(\);[\s\S]*?return;/,
  "Drugi klik izbrane pravne kartice mora vedno odstraniti izbor.");
assert.doesNotMatch(source, /kartica\.id === ciljOsnutekId \|\| izbraniIds\.includes/,
  "Že dodan korak ne sme pustiti FATHER kartice navidezno aktivne.");
assert.match(source, /actionType:\s*"goal_selection"/);
assert.match(source, /state\.nacrtKoraki\.push\(\{/,
  "Vsak potrjeni vnos mora dodati nov korak in ohraniti prejšnje korake.");
assert.match(source, /if \(nacin === "manual"\) \{\s*ciljOsnutekId = null;\s*ciljOsnutekPodatki = \{\};\s*\}/,
  "Po uspešnem ročnem dodajanju mora biti trenutni FATHER osnutek počiščen, dodani koraki pa ohranjeni.");
assert.match(source, /pravnaNapaka = "";\s*pravnaOsnutekId = null;\s*pravnaOsnutekPodatki = \{\};/,
  "Po uspešnem pravnem dodajanju izbira ne sme ostati navidezno aktivna.");
assert.match(source, /<small>Obstoječe kartice<\/small>/);
assert.match(source, /classList\.add\("atena"\)/, "Tretji korak mora uporabljati isti Atena v7 korenski FATHER.");
assert.match(source, /data-engine-version", "atena-v7"/, "Ciljni gostitelj mora označiti kanonično različico Atene.");
assert.match(source, /zgodovina-ai-pogovor__opis[\s\S]*?zgodovina-ai-napredek[\s\S]*?zgodovina-ai-stanje-dolga[\s\S]*?zgodovina-ai-vprasanje/,
  "Naravni cilj mora ohraniti FATHER zaporedje opis, napredek, dolg in vprašalna kartica.");
assert.match(source, /function ciljAtenaPojasniloHtml[\s\S]*?ciljAtenaVirOpisHtml\(\)[\s\S]*?ciljAtenaNapredekHtml\(false\)[\s\S]*?ciljAtenaStanjeDolgaHtml\(\)[\s\S]*?data-cilj-clarification-answer[\s\S]*?data-cilj-clarification-submit/,
  "Pojasnilo mora ohraniti isti FATHER opis, napredek, denarno stanje in odzivni kartični tok.");
assert.match(source, /data-cilj-snemaj[\s\S]*?UJHandyCanary\.create/,
  "Glasovni gumb cilja mora uporabljati isti Handy\/Canary vhod kot Atena.");
assert.match(source, /classList\.add\(razred\)[\s\S]*?"is-analyzing"[\s\S]*?"is-recording"/,
  "Ciljna Atena mora ohraniti FATHER animirano razširitev aktivnega gumba čez celo vrstico.");
assert.match(source, /data-ai-analyze-status[\s\S]*?CILJ_ANALIZA_STATUS_BESEDILA[\s\S]*?setInterval\(posodobiCiljAnalizaStatus, 1200\)/,
  "Ciljna Atena mora uporabljati isti animirani status priprave kot zgodovinski FATHER.");
assert.match(source, /data-cilj-voice-meter[\s\S]*?onLevel:[\s\S]*?posodobiCiljGlasnost/,
  "Glasovni način mora prikazati isti živi merilnik kot zgodovinski FATHER.");
assert.match(source, /zgodovina-ai-vprasanje__izbira-gumb[\s\S]*?zgodovina-ai-vprasanje__izbira-seznam[\s\S]*?data-cilj-choice-option/,
  "Ciljna polja morajo uporabljati FATHER izbirnik z enako animacijo, ne native selecta.");
assert.doesNotMatch(source, /<select\b|<option\b/, "Nobena ciljna ali pravna kartica ne sme več odpirati native sistemskega izbirnika.");
assert.match(source, /function pravnoSelectPolje[\s\S]*?data-cilj-choice[\s\S]*?data-cilj-pravno-polje[\s\S]*?zgodovina-ai-vprasanje__izbira-seznam/,
  "Vse pravne kartice morajo uporabljati isti Atenin FATHER izbirnik.");
assert.match(source, /function pravnoSelectPolje[\s\S]*?cilj-pravna-izbira[\s\S]*?data-cilj-pravno-polje/,
  "Pravni FATHER izbirnik mora uporabiti enoten Atenin izbirnik.");
assert.match(css, /\.wizard-goal-page \.cilj-pravna-izbira \.zgodovina-ai-vprasanje__izbira-seznam\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s,
  "Pravni FATHER meni mora uporabljati enako dvostolpčno mrežo kot drugi Atenini izbirniki.");
assert.match(css, /\.wizard-goal-page \.cilj-pravna-izbira \.zgodovina-ai-vprasanje__izbira-seznam button:last-child:nth-child\(odd\)\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*min-height:\s*48px;/s,
  "Zadnja liha pravna možnost mora zapolniti celo vrstico.");
assert.match(source, /querySelector\("\[data-cilj-polje\], \[data-cilj-pravno-polje\]"\)/,
  "Skupni FATHER izbirnik mora shranjevati tako ciljna kot pravna polja.");
assert.match(css, /\.wizard-goal-page \.atena \.zgodovina-ai-vprasanje__polja--placilo-kompaktno label\.is-payment-method \.zgodovina-ai-vprasanje__izbira-seznam\s*\{[^}]*position:\s*absolute;/s,
  "Odprti ciljni izbirnik mora uporabljati Atenin plavajoči mrežni meni.");
assert.match(css, /\.wizard-goal-page \.cilj-father-vnosnik\s*\{[^}]*--vprasanje-rgb:\s*var\(--action-rgb\);/s,
  "Vsaka ročna ciljna kartica mora iz svoje barve podedovati FATHER obrobe menija in posameznih možnosti.");
assert.match(css, /\.wizard-goal-page \.zgodovina-ai-vprasanje__izbira:not\(\.cilj-pravna-izbira\) \.zgodovina-ai-vprasanje__izbira-seznam button:last-child:nth-child\(odd\)\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*min-height:\s*48px;/s,
  "Zadnja liha možnost mora v ročnih in Ateninih ciljnih menijih zapolniti prazno polovico.");
assert.match(source, /zgodovina-ai-vprasanje__polja--placilo-kompaktno/,
  "Primerljiva ciljna kartica mora uporabiti isti kompaktni FATHER razpored in animirani meni kot plačilna kartica Zgodovine.");
assert.match(source, /prilagodiVisinoCiljnegaVnosa\(dogodek\.target\)/,
  "Ciljni opis se mora v živo višinsko prilagajati enako kot v koraku Zgodovina.");
assert.match(source, /Ponastavi Ateno[\s\S]*?K\.ikona\("refresh"\)[\s\S]*?<span>Ponastavi<\/span>/,
  "Zgornja Atenina akcija mora ostati Ponastavi z ikono ponovitve.");
assert.match(source, /Pripravljeni cilji/, "Spodnji FATHER razdelek mora prikazati pripravljene cilje.");
assert.match(source, /potek\.hidden = state\.nacrtKoraki\.length === 0;/,
  "Prazen razdelek Pripravljeni cilji mora biti umaknjen.");
assert.match(source, /nadaljuj\.textContent = brezCilja \? "Nadaljuj brez cilja" : "Nadaljuj";/,
  "Prazen cilj mora ponuditi jasno nadaljevanje brez cilja.");
assert.match(source, /if \(brezCilja && panel\) \{[\s\S]*?panel\.insertAdjacentElement\("afterend", nadaljuj\);[\s\S]*?if \(praznaNoga && !praznaNoga\.children\.length\) praznaNoga\.remove\(\);/,
  "Nadaljuj brez cilja mora biti premaknjen pod glavni panel, prazna noga pa odstranjena.");
assert.match(source, /function dokoncajCiljInNadaljuj\(\)\s*\{\s*shraniCilj\(true\);\s*window\.location\.href = "neplacila-posiljanje\.html";/,
  "Nadaljuj brez cilja mora biti omogočen in shraniti zaključen tretji korak.");
assert.match(source, /var potrdiAteninCilj = nacin === "natural" && ciljAiPhase === "review";[\s\S]*?if \(potrdiAteninCilj\) \{\s*dokoncajCiljInNadaljuj\(\);\s*return;/,
  "Atenin gumb Da, potrdi cilj mora po varnem zapisu neposredno odpreti naslednji korak.");
assert.match(source, /dogodek\.target\.closest\(SELECTOR_NADALJUJ\)[\s\S]*?dokoncajCiljInNadaljuj\(\)/,
  "Spodnji Nadaljuj in Atenina potrditev morata uporabljati isto končno navigacijsko mejo.");
assert.match(source, /zgodovina-ai-pogovor__akcije zgodovina-ai-pogovor__akcije--potrditev-cilja/,
  "Končna Atenina gumba morata imeti namenski skupni razred.");
assert.match(css, /\.wizard-goal-page \.zgodovina-ai-pogovor__akcije--potrditev-cilja button\s*\{[^}]*min-height:\s*48px;[^}]*font-size:\s*11px;/s,
  "Gumba Popravi opis in Da, potrdi cilj morata biti večja od navadnih Ateninih akcij.");
assert.doesNotMatch(source, /id:\s*"(?:unpaid_installment|payment_failed)"/,
  "Zgodovinska dogodka ne sodita v ciljni FATHER katalog.");

[
  "legal_notice_payment", "enforcement", "payment_order_or_claim",
  "interim_protection", "cross_border_recovery", "legal_route_review",
].forEach(function (id) {
  assert.ok(father.legalOutcomes.some(function (card) { return card.id === id; }), "Manjka pravni rezultat " + id);
});
assert.match(source, /settings:\s*\{\s*goalId:\s*"legal_recovery",\s*legalRecoveryOutcome:\s*izbraniRezultat\.id,\s*legalRecoveryData:\s*shranjeniPravniPodatki\s*\}/);
assert.match(source, /Odvetnika, paket in dokumente boste določili šele na koncu načrta/);
assert.doesNotMatch(source, /if \(!state\.nacrtKoraki\.length\) return;[\s\S]{0,120}?shraniCilj\(true\)/,
  "Prazen cilj ne sme blokirati izrecne poti Nadaljuj brez cilja.");
assert.match(source, /data-cilj-drsnik/);
assert.match(source, /return '<div class="izvedba-poravnava-svicer" data-cilj-drsnik[\s\S]*?zgodovina-svicer__pikice[\s\S]*?ciljAiPredlogiHtml\(\) \+ ciljniVnosnikHtml\(\);/,
  "Izbira več Luninih ciljev mora biti pod katalogom kartic in tik pred odprtim widgetom.");
assert.doesNotMatch(source, /return ciljAiPredlogiHtml\(\) \+ '<div class="izvedba-poravnava-svicer" data-cilj-drsnik/,
  "Izbira več Luninih ciljev ne sme biti nad katalogom kartic.");
assert.match(source, /data-cilj-stran="0"/);
assert.match(source, /data-cilj-stran="1"/);
assert.match(source, /drsnik\.scrollTo\(\{\s*left:/,
  "Pikici morata dejansko odpreti prvo oziroma drugo stran kartic.");
assert.match(source, /drsnik\.addEventListener\("scroll"/,
  "Aktivna pikica mora slediti tudi ročnemu podrsavanju.");
assert.match(source, /data-cilj-pravno-polje/);
assert.match(source, /data-cilj-pravna-potrdi/);
assert.match(source, /var pravnaIzbiraIzLune = false;/,
  "UI mora hraniti provenienco, da je pravni rezultat izbrala Luna.");
assert.match(source, /if \(ciljAiPhase === "questions" && pravnaIzbiraIzLune && pravnaOsnutekId\) return ciljAtenaPravnoVprasanjeHtml\(\);/,
  "Lunin pravni rezultat mora odpreti neposredni Atena widget v naravnem toku.");
assert.match(source, /function ciljAtenaPravnoVprasanjeHtml[\s\S]*?data-cilj-ai-next[\s\S]*?Pokaži povzetek/,
  "Lunin pravni widget mora uporabljati isto večkorakovno navigacijo kot ostali Atena cilji.");
assert.match(css, /\.zgodovina-ai-vprasanje--akcija-odvetnik\s*\{\s*--vprasanje-rgb:\s*105,\s*65,\s*180;/,
  "Lunin pravni widget mora uporabljati vijolični odvetniški barvni sistem.");
assert.match(css, /\.zgodovina-ai-napredek > button\.is-tone-akcija-odvetnik\s*\{\s*--korak-rgb:\s*105,\s*65,\s*180;/,
  "Pravni korak v indikatorju mora biti vijoličen.");
assert.match(css, /\.zgodovina-ai-povzetek--akcija-odvetnik\s*\{\s*--povzetek-rgb:\s*105,\s*65,\s*180;/,
  "Pravni cilj mora ostati vijoličen tudi v povzetku.");
assert.match(source, /function shraniAktivniLuninCilj[\s\S]*?goalId === "legal_recovery"[\s\S]*?goalDataIzPravnihPodatkov/,
  "Vsak urejeni pravni widget se mora shraniti nazaj v svoj Lunin korak.");
assert.match(source, /data-cilj-pravno-polje[\s\S]*?naslednjiPravniKorak\.disabled = Boolean\(preveriPravniVnos\(\)\)/,
  "Neobvezna pravna usmeritev se mora sproti shraniti, nadaljevanje pa ostati omogočeno.");
assert.match(source, /function prviNeveljavniLuninKorak[\s\S]*?predlog\.goalId === "legal_recovery"[\s\S]*?preveriPravniVnos\(\)/,
  "Skupni pregled mora preveriti vsakega od več pravnih korakov.");
assert.match(source, /if \(kartica\.id === "legal_recovery"\) \{[\s\S]*?ciljAiPhase = "questions";[\s\S]*?pravnaIzbiraIzLune = PRAVNA_IZTERJAVA_REZULTATI\.some/,
  "Veljavni Lunin legalOutcome mora označiti neposredni pravni tok.");
var uporabiLuninCiljTelo = source.match(/function uporabiLuninCilj\([\s\S]*?\n  async function pripraviCiljneMoznosti/)[0];
assert.doesNotMatch(uporabiLuninCiljTelo, /if \(kartica\.id === "legal_recovery"\) \{(?:(?!\n    \} else \{)[\s\S])*?ciljAiPredlogi = \[\];/,
  "Prehod z dveh obrokov na tretji pravni cilj ne sme izbrisati Luninih korakov.");
assert.doesNotMatch(source, /if \(kartica\.id === "legal_recovery"\) \{\s*nacin = "manual";/,
  "Lunin pravni rezultat ne sme preklopiti Atene v ročni način.");
assert.match(source, /function pravnaIzterjavaHtml\(state\) \{\s*if \(pravnaIzbiraIzLune && pravnaOsnutekId\) \{[\s\S]*?pravniVnosnikHtml\(\)[\s\S]*?\}\s*var gumbi = PRAVNA_IZTERJAVA_REZULTATI\.map/,
  "Lunin tok mora vrniti neposredni widget še pred izrisom ročnega kataloga šestih kartic.");
assert.match(source, /var pravnaResitev = dogodek\.target\.closest\("\[data-cilj-pravna-resitev\]"\);[\s\S]*?pravnaIzbiraIzLune = false;/,
  "Ročna pravna izbira mora počistiti Lunino provenienco.");
assert.match(source, /var ciljAiKorak = dogodek\.target\.closest\("\[data-cilj-ai-step\]"\);[\s\S]*?shraniAktivniLuninCilj\(\);[\s\S]*?uporabiLuninCilj\(ciljAiPredlogi\[ciljAiIndeks\], true, ciljAiIndeks\);/,
  "Klik tretjega indikatorja mora ohraniti prejšnji urejeni korak in odpreti točen Lunin predlog v naravnem toku.");
assert.match(source, /legalRecoveryData:\s*shranjeniPravniPodatki/,
  "Potrjeni pravni cilj mora ohraniti strukturirane podatke vnosnika.");
assert.match(source, /korakiZaPotrditev\.forEach[\s\S]*?legalRecoveryOutcome:\s*pravniRezultat\.id[\s\S]*?legalRecoveryData:/,
  "Več Luninih pravnih rešitev se mora potrditi kot več ločenih strukturiranih korakov.");
var pravnaPoljaContract = father.legalFields;
assert.deepEqual(pravnaPoljaContract.legal_notice_payment, [],
  "Pravni opomin v ciljni fazi ne sme zahtevati zneska, roka ali vročitve.");
assert.deepEqual(pravnaPoljaContract.enforcement, [],
  "Izvršba v ciljni fazi ne sme zahtevati izvedbenih podatkov.");
assert.deepEqual(pravnaPoljaContract.payment_order_or_claim, [],
  "Plačilni nalog ali tožba v ciljni fazi ne sme zahtevati procesnih podrobnosti.");
assert.deepEqual(pravnaPoljaContract.interim_protection.map(function (field) { return field.name; }), ["protectionFocus"],
  "Začasna zaščita sme vprašati samo po splošnem predmetu zaščite.");
assert.deepEqual(pravnaPoljaContract.cross_border_recovery.map(function (field) { return field.name; }), ["debtorCountry"],
  "Čezmejna izterjava sme vprašati samo po državi.");
assert.deepEqual(pravnaPoljaContract.legal_route_review.map(function (field) { return field.name; }), ["priority"],
  "Ocena poti sme vprašati samo po splošni prioriteti.");
[
  "deliveryChannel", "paymentDeadline", "claimBasis", "assetsNote", "disputeStatus",
  "claimSummary", "protectionTarget", "neededBy", "riskReason", "debtorAddress",
  "maxBudget", "reviewNote",
].forEach(function (ime) {
  assert.ok(!Object.values(pravnaPoljaContract).flat().some(function (field) { return field.name === ime; }),
    "Operativno pravno polje " + ime + " sodi v korak Odvetnik, ne v Cilj.");
});
assert.match(source, /function ocistiPravneCiljnePodatke[\s\S]*?PRAVNA_CILJNA_POLJA\[rezultatId\]/,
  "Pravni podatki morajo biti omejeni z dovoljenim seznamom za izbrani rezultat.");
assert.match(source, /pravnaOsnutekPodatki = shranjeniCilj[\s\S]*?ocistiPravneCiljnePodatke\(pravnaOsnutekId, shranjeniCilj\.pravnaOsnutekPodatki\)/,
  "Tudi obnovljena seja mora odstraniti stare podrobne pravne podatke.");
assert.match(source, /legalRecoveryData:\s*pravniPodatkiIzGoalData\(predlog\.goalData\)/,
  "Potrditev Luninih pravnih ciljev ne sme obiti čiščenja starih podrobnosti.");
assert.match(css, /\.wizard-goal-page \.cilj-pravna-usmeritev\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*font-size:\s*10px;/s,
  "Pravni cilj brez dodatnih polj mora uporabniku jasno pojasniti poznejši korak Odvetnik.");
assert.match(css, /\.wizard-goal-page \.cilj-pravna-podizbira__kartice \.izvedba-poravnava-svicer__gumb\s*\{[^}]*height:\s*74px;[^}]*box-sizing:\s*border-box;/s,
  "Vseh šest pravnih kartic mora imeti enotno varno višino za večvrstične naslove.");
assert.match(css, /\.wizard-goal-page \.cilj-pravna-podizbira__kartice \.izvedba-poravnava-svicer__gumb span:last-child\s*\{[^}]*flex:\s*0 0 auto;[^}]*line-height:\s*10px;[^}]*overflow:\s*visible;/s,
  "Naslovi pravnih kartic se ne smejo stisniti ali obrezati za del slikovne pike.");
assert.match(css, /\.wizard-goal-page \.cilj-pravna-vnosnik \.izvedba-poravnava-podrobnosti__opis\s*\{[^}]*padding-bottom:\s*1px;/s,
  "Opis izbranega pravnega cilja mora ohraniti spodnji prostor za celoten izris črk.");
assert.match(source, /data-cilj-polje/);
assert.match(source, /data-cilj-potrdi/);
assert.match(source, /ciljStevilcnoPolje\("targetAmount", "Ciljni znesek"[\s\S]*?ciljSelectPolje\("contactChannel", "Prednostni način poziva"[\s\S]*?ciljRokSHitroIzbiroPolje\("paymentDeadline", "Želeni rok plačila"/,
  "Celotno plačilo mora imeti znesek in način poziva v prvi vrstici, rok pa v naslednji.");
assert.match(source, /data-cilj-rok-hitri="Čim prej"/);
assert.match(source, /data-cilj-rok-hitri="Drugo"/);
assert.match(source, /data-cilj-rok-hitri="Čim prej" aria-pressed=/,
  "Hitra izbira roka mora dostopno sporočati izbrano stanje.");
assert.match(source, /ciljRokPolje\.value = ciljRokPolje\.value === ciljRokVrednost \? "" : ciljRokVrednost;/,
  "Ponovni klik istega hitrega roka mora počistiti izbiro.");
assert.match(source, /ciljOsnutekPodatki\.paymentDeadline = ciljRokPolje\.value;/,
  "Hitra izbira roka mora zapisati v obstoječe stanje paymentDeadline.");
assert.match(source, /ciljChoiceInput\.value = ciljChoiceInput\.value === ciljChoiceVrednost \? "" : ciljChoiceVrednost;/,
  "Ponovni klik iste možnosti ciljnega ali pravnega izbirnika mora počistiti vrednost.");
assert.match(css, /\.wizard-goal-page \.atena \.zgodovina-ai-vprasanje__polja--placilo-kompaktno > \.cilj-rok-hitri\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto auto;/s);
assert.match(css, /\.wizard-goal-page \.atena \.cilj-rok-hitri__polje input\s*\{[^}]*border-color:\s*rgba\(22, 138, 98, \.56\);[^}]*background:\s*#f1faf6;/s);
assert.match(css, /\.wizard-goal-page \.atena \.cilj-rok-hitri__polje\s*\{[^}]*grid-column:\s*auto;/s,
  "Polje roka mora ostati v isti vrstici kot hitra gumba.");
assert.match(source, /if \(ciljId === "installment_plan"\) \{[\s\S]*?ciljStevilcnoPolje\("installmentAmount", "Znesek posameznega obroka"[\s\S]*?ciljStevilcnoPolje\("targetAmount", "Skupni ciljni znesek"/,
  "Pri obrokih mora biti levo znesek posameznega obroka, desno pa skupni ciljni znesek.");
assert.match(source, /function ciljCeloStevilcnoPolje[\s\S]*?step="1"[\s\S]*?inputmode="numeric"/,
  "Število obrokov mora uporabljati celoštevilski gradnik brez denarne pripone.");
assert.match(source, /ciljCeloStevilcnoPolje\("installmentCount", "Število obrokov", "", 2, 36\)/);
assert.match(source, /korakiZaPotrditev\.forEach[\s\S]*?var settingsKoraka[\s\S]*?goalData:\s*normalizirajCiljnePodatke\(predlog\.goalData\)[\s\S]*?settings:\s*settingsKoraka/,
  "Vsak Luninin pregledani cilj mora strukturirane podatke zapisati šele po skupni potrditvi.");
assert.match(source, /ciljAiAktivniIndeks[\s\S]*?data-cilj-ai-step[\s\S]*?ciljAiPredlogi\[ciljAiIndeks\][\s\S]*?uporabiLuninCilj/,
  "Več Luninih korakov mora uporabljati isto navigacijo kandidatov kot Zgodovina.");
assert.match(source, /if \(skupaj <= 8\)[\s\S]*?trenutni - 2[\s\S]*?trenutni \+ 2[\s\S]*?is-gap/,
  "Daljši ciljni tok mora uporabljati isti stisnjeni prikaz korakov kot Zgodovina.");
assert.match(source, /CILJ_AI_MAX_KORAKOV = 20/,
  "Ciljni tok mora tako kot Zgodovina podpirati dinamično število do 20 korakov.");
assert.match(source, /enakiObroki\.length > 1[\s\S]*?\/" \+ enakiObroki\.length \+ " obrok/,
  "Obroki morajo biti dinamično označeni kot 1/N, 2/N in naprej.");
[
  "full_payment", "partial_payment_now", "installment_plan", "new_deadline",
  "amicable_settlement", "dispute_resolution", "compensation", "payment_security",
  "insolvency_claim", "close_without_recovery", "custom_goal",
].forEach(function (id) {
  assert.ok(Array.isArray(father.goals.find(function (card) { return card.id === id; }).required), "Manjka validacijski contract vnosnika za " + id);
});
assert.match(source, /function osredotociPrvoNapacnoCiljnoPolje[\s\S]*?aria-invalid[\s\S]*?\.focus\(/,
  "Neveljaven cilj mora označiti in fokusirati prvo manjkajoče polje.");
assert.match(source, /function osredotociPrvoNapacnoCiljnoPolje[\s\S]*?vrednost > ciljniDolg[\s\S]*?installmentCount/,
  "Fokus prve napake mora pokriti tudi neveljaven znesek in necelo število obrokov.");
assert.match(source, /root\.addEventListener\("keydown"[\s\S]*?ArrowDown[\s\S]*?ArrowUp[\s\S]*?Home[\s\S]*?End[\s\S]*?Escape/,
  "FATHER izbirnik mora podpirati tipkovnico in Escape.");
assert.match(source, /if \(dogodek\.key === "Escape"\)[\s\S]*?gumbIzbire\.focus\(\)/,
  "Escape mora zapreti samo izbirnik in vrniti fokus na njegov gumb.");
assert.match(source, /dogodek\.stopImmediatePropagation\(\)/,
  "Tipkovniški dogodek izbirnika ne sme zapreti celotnega FATHER panela.");
assert.match(source, /\+ Dodaj korak/);
assert.match(source, /cilji:\s*state\.nacrtKoraki/,
  "Vsi dodani koraki se morajo ohraniti ob osvežitvi.");
assert.match(source, /state\.nacrtKoraki\.splice\(odstraniIndeks, 1\)/,
  "Odstranitev mora izbrisati samo izbrani korak.");
assert.match(source, /indeks === 0 \? "Glavni cilj" : "Korak " \+ \(indeks \+ 1\)/,
  "Drugi in naslednji vnosi morajo biti označeni kot koraki, ne dogodki.");
assert.match(izvedbaSource, /window\.UJIzvedbaStanjeDolgaHtml[\s\S]*?izrisiStanjeDolga\(prvotniZnesek, preostaliZnesek\)/,
  "Cilj mora ponovno uporabiti skupni FATHER prikaz denarnega toka.");
assert.match(izvedbaSource, /\(\(prvotni - preostali\) \/ prvotni\) \* 100/,
  "Napredek mora temeljiti na originalnem in dejansko preostalem dolgu.");
assert.match(source, /nacin === "manual"[\s\S]*?ciljAtenaStanjeDolgaHtml\(\)/,
  "Ročni cilj mora prikazati isti kompaktni denarni FATHER kot korak Zgodovina.");
assert.doesNotMatch(source, /nacin === "manual"[\s\S]{0,180}?UJIzvedbaStanjeDolgaHtml/,
  "Ročni cilj ne sme uporabljati večjega izvedbenega prikaza dolga.");
assert.match(source, /zgodovina\.potrjena !== true[\s\S]*?return prvotni/,
  "Nepotrjena zgodovina in prihodnji cilj ne smeta zmanjšati preostalega dolga.");

function napredek(prvotni, preostali) {
  return Math.max(0, Math.min(100, ((prvotni - preostali) / prvotni) * 100));
}
assert.equal(napredek(434, 434), 0, "Brez potrjenega plačila mora biti napredek 0 %.");
assert.equal(Number(napredek(434, 334).toFixed(2)), 23.04, "Plačilo 100 od 434 mora prikazati 23,04 %.");

console.log("OK cilj FATHER: 12 ciljnih kartic in 6 ločenih rezultatov pravne izterjave");
