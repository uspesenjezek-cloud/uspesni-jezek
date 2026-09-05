"use strict";

// Register IZLUŠČENIH, ponovno uporabljivih VRSTIC (gradnikov) iz obstoječih
// kartic v aplikaciji — po vzoru NAZORJEVA.js, a za manjše gradbene kocke,
// ne za cele kartice.
//
// VIRI KARTIC v aplikaciji (glej app/atena-question-lab-catalog.js):
//   - 63 NAZORJEVA zasnov (app/atena-card-templates.js, renderer: renderTemplate)
//   - 35 debtor-form kartic — zgodovina + cilji (isti renderer, categories 1.0/2.0)
//   - 89 pravih Ateninih kartic — produkcijski vprašalni moduli
//     (app/atena-card-schema.js + app/atena-card-renderer.js, renderer: questionShellHtml)
//   SKUPAJ: 187 kartic, 2 ločena rendererja.
//
// TA REGISTER JE RASTOČ, NE POPOLN. Ne trdim, da je spodnji seznam že
// izčrpna razčlenitev vseh 187 kartic — vsebuje samo vrstice, ki so bile
// dejansko pregledane in ponovno uporabljene. Ko se doda nova vrstica, se
// najprej preveri, ali že obstaja tukaj, preden se izumi nova.
//
// Implementacija gradnikov: app/atena-card-segments.js.
//
// STANJE NAZORJEVA DELA (63 kartic): vrstice 1-26 pokrivajo vse ponovljive
// vzorce, ki so bili najdeni med sistematičnim pregledom CSS razredov
// app/atena-card-templates.css (~65 družin skupno). PREOSTALIH ~39 družin
// (npr. .uj-card-breakeven, .uj-card-price-bridge, .uj-card-expected,
// .uj-card-waterfall, .uj-card-tree, .uj-card-funnel, .uj-card-heatmap,
// .uj-card-scenario ...) NISO bile dodane, ker so pri pregledu ocenjene kot
// SESTAVLJENE VIZUALIZACIJE ENEGA KONKRETNEGA WIDGETA (grafi, izračuni po
// korakih), ne kot ponovljive vrstice — vsaka se pojavi samo enkrat, v enem
// samem widgetu. To je presoja, ne dokazano dejstvo; če se v prihodnje najde
// ponovna uporaba katere od njih, jo je treba dodati sem.
//
// STANJE VSEH TREH VIROV (2026-09-03, konec prvega polnega kroga):
//   - NAZORJEVA (63): POKRITO — vrstice 1-26 (glej opombo zgoraj o ~39
//     neponovljivih widget-specifičnih vizualizacijah, ki so bile namenoma
//     izpuščene).
//   - Debtor-form (35): PREVERJENO, DODATNE VRSTICE NISO POTREBNE — glej
//     opombo na koncu datoteke; vsaka kartica se sklicuje na templateId
//     ene od že katalogiziranih 62 NAZORJEVA predlog, brez novega vzorca.
//   - Prave Atenine produkcijske kartice (89): DELNO POKRITO — vrstice
//     27-31 (splošno ogrodje: glava, koraki, checkbox-izbira, potrditev,
//     barvno področje) in 32-39 (renderer polj: atena-polje/izbira/znesek/
//     kolicina/hitre-izbire/lep-izbirnik/dokument/seznam, iz
//     app/atena-card-renderer.js fieldHtml()). NEPREGLEDANO OSTAJA:
//     specialModuleContentHtml() podrobno (C00/A01 povzetki), in celoten
//     app/atena-question-lab-engine.js/atena-question-lab.js (ločen
//     predogledni sistem, ni bil odprt).
//
// PREJŠNJA OPOMBA (zdaj zastarela, ohranjena za sled): "NASLEDNJI VIRI, ŠE
// NEPREGLEDANI: 35 debtor-form kartic (zgodovina + cilji), 89 pravih
// Ateninih produkcijskih kartic (app/atena-card-renderer.js +
// app/styles.css) — glej opozorilo pri vrstici 3 o ločenem stilskem viru.

function vrstica(number, id, title, ton, viriKartic, opis) {
  return Object.freeze({ number, id, title, ton: ton || null, viriKartic: Object.freeze(viriKartic.slice()), opis, status: "extracted" });
}

const VRSTICE = Object.freeze([
  vrstica(
    1, "ikonski-krog", "Velik barvni ikonski krog (34px) na levi strani vrstice",
    "is-good | is-warning | is-bad | is-neutral",
    [
      "nazorjeva:trend-odzivnosti — .uj-card-trend__hint span (izvorni vzorec kroga, vedno teal)",
      "nazorjeva:pregled-odgovorov — .uj-card-review > p span (isti vzorec, druga kartica)"
    ],
    "Barve is-good/is-warning/is-bad so prenesene iz obstoječih besedilnih tonov " +
    "(.uj-card-bullet__status, .uj-card-live) na ozadje kroga. Implementirano kot " +
    "samostojen razred .uj-card-icon-circle, ker noben od izvorov ni bil dovolj " +
    "splošen za dobesedno ponovno uporabo brez spremembe layouta."
  ),
  vrstica(
    2, "statusna-znacka", "Značka z naslovom in kratko podrobnostjo, obarvana po tonu",
    "is-good | is-warning | is-bad",
    ["nazorjeva:trend-odzivnosti — .uj-card-bullet__status (obroba, ozadje, padding — dobesedno)"],
    "Ogrodje (obroba/ozadje/radij) je nespremenjena ponovna uporaba .uj-card-bullet__status. " +
    "Postavitev v vrstico z ikonskim krogom (namesto privzetega grid-stack) je dodana " +
    "samo za [data-segment=\"status-badge\"], zato izvirna uporaba pri widgetu 32 ni prizadeta."
  ),
  vrstica(
    3, "info-okvir", "Okvir z ikonskim krogom, malo naslovno oznako in besedilom",
    null,
    ["POZOR: mogoč konflikt vira — glej opis"],
    "Nov, namenoma splošen gradnik iz atena-card-templates.css (galerijski slog). " +
    "OPOZORILO: v pravi produkcijski kodi (app/styles.css:2123) obstaja sorodna, a NE " +
    "identična vrstica '.ponudba-obrazec__potrditev' (label + kratka vrednost, brez ikone, " +
    "uporabljena v resničnih Ateninih karticah C00/A01). Ta vrstica ni bila zamenjana z njo, " +
    "ker moj info-okvir nosi daljšo razlago z ikono, ne kratek par label:vrednost — namen " +
    "je različen. ODPRTO VPRAŠANJE: če ta kartica kdaj pristane v pravem toku (ne samo v " +
    "NAZORJEVA galeriji), je treba odločiti, kateri stilski vir (atena-card-templates.css " +
    "ali app/styles.css) tam dejansko velja, preden se karkoli poveže."
  ),
  vrstica(
    4, "primarni-gumb", "Poln obarvan akcijski gumb čez celo širino, z lastnim besedilom",
    null,
    ["nazorjeva: vseh 62 odobrenih widgetov — .uj-answer-card__save.is-saved (dobesedno, samo drug label/ikona)"],
    "Popolnoma nespremenjen obstoječi razred; edina razlika od privzete rabe je besedilo " +
    "gumba in podatkovni atribut namesto data-card-save."
  ),
  vrstica(
    5, "obarvana-vrstica-povzetka", "Ena tanka vrstica z besedilom, obarvana po tonu (tanjša od statusne značke)",
    "is-good | is-warning | is-bad",
    ["nazorjeva: provenance, breakeven, matching, capacity, cascade in drugi — .uj-card-live (data-*-summary)"],
    "Dobesedna ponovna uporaba. Uporabi se namesto statusne značke (vrstica 2), kadar je " +
    "sporočilo kratko in ne potrebuje ločenega naslova/podrobnosti — samo ena poved."
  ),
  vrstica(
    6, "gumb-ponastavi", "Obrobljen (črtkan) gumb čez celo širino, parni z Reagon primarnim gumbom",
    null,
    ["nazorjeva: vseh widgetov z večkoračnim stanjem — .uj-card-reset"],
    "Dobesedna ponovna uporaba. V .uj-answer-card__actions se .uj-card-reset in " +
    ".uj-answer-card__save prikažeta drug ob drugem (grid 7fr/13fr)."
  ),
  vrstica(
    7, "krozna-ikona-v-vrstici", "Manjši (22px) obarvan krog z ikono, znotraj ene tanke vrstice besedila",
    null,
    [
      "nazorjeva:pregled-odgovorov — .uj-card-review > p span",
      "nazorjeva:trend-odzivnosti — .uj-card-trend__hint span"
    ],
    "POMEMBNO: to je manjša različica vrstice 1 (ikonski-krog, 34px). Ta manjši vzorec " +
    "(22px, vedno teal .uj-card-live tone) se v izvorni kodi pojavi na VSAJ dveh neodvisnih " +
    "mestih — to je najmočnejši dokaz, da je 'obarvan krog + ikona' resnično ponavljajoč se " +
    "vzorec v celotnem sistemu, ne moja iznajdba. Vrstica 1 (34px) je njegova povečana varianta."
  ),
  vrstica(
    8, "vrstica-pregleda-z-urejanjem", "Vrstica label + vrednost + gumb 'Uredi', za pregled pred potrditvijo",
    null,
    ["nazorjeva:pregled-odgovorov — .uj-card-review [data-review-row]"],
    "Dobesedna ponovna uporaba. Blizu produkcijskemu vzorcu app/styles.css:2123 " +
    "(.ponudba-obrazec__potrditev), a ta ima dodatno tretjo kolono za urejanje — glej " +
    "opozorilo pri vrstici 3 o dveh ločenih stilskih virih."
  ),
  vrstica(
    9, "polje-z-oznako", "Splošen ovoj: majhna oznaka (label) nad poljubno vsebino polja",
    null,
    ["nazorjeva: praktično vsi widgeti z vnosom — .uj-card-field + .uj-card-label"],
    "Najpogosteje ponovljen gradnik v celotnem NAZORJEVA katalogu — osnovni ovoj za vsako " +
    "polje. Namenjen VNOSU (input), ne izpisu — drugačen namen kot info-okvir (vrstica 3), " +
    "ki je samo za branje."
  ),
  vrstica(
    10, "skupina-izbirnih-gumbov", "Vrstica 2-3 gumbov za izbiro ene možnosti (segment/mreža/seznam)",
    null,
    ["nazorjeva: choice profil (na desetine widgetov) — .uj-card-choices / .uj-card-segment / .uj-card-choice-grid / .uj-card-choice-list"],
    "Štiri različice istega vzorca (v vrstici, mreži 2×2, navpičnem seznamu, spojene v " +
    "segment) delijo isto osnovno stanje gumba (.is-selected). Najbolj razvejan reciklirani " +
    "vzorec v katalogu — glej app/atena-widget-contract.js PROFILES.choice."
  ),
  vrstica(
    11, "radijski-krozec", "Majhen (16.6px) obarvan krožec kot indikator izbire",
    null,
    ["nazorjeva: choice-list widgeti — .uj-card-radio"],
    "Dobesedna ponovna uporaba. Uporablja se znotraj vrstice 10 (choice-list različica), ne " +
    "samostojno."
  ),
  vrstica(
    12, "denarno-polje", "Vnosno polje z ikonskim krogom, besedilom na sredini in valuto/enoto",
    null,
    ["nazorjeva: money/money-or-percent profil — .uj-card-money"],
    "Ikonski krog na levi (24px, manjši od vrstice 1) + osrednji vnos + oznaka enote na desni. " +
    "Ima različico 'unit-only' (.uj-card-money--unit-only), kjer je ikonski krog izpuščen."
  ),
  vrstica(
    13, "stepper-nadzor", "Minus / vrednost / plus vodoravni kontrolnik",
    null,
    ["nazorjeva: duration/quantity profil — .uj-card-stepper"],
    "4-stolpčna vrstica (gumb−, vnos, enota/select, gumb+), vsi stolpci enake višine 44px."
  ),
  vrstica(
    14, "drsnik-z-izpisom", "Velik številčni izpis nad drsnikom (range slider)",
    null,
    ["nazorjeva: rate/availability profil — .uj-card-range"],
    "Obarvan okvir, znotraj njega velik (25px) izpis trenutne vrednosti nad native input[range]."
  ),
  vrstica(
    15, "datum-z-bliznjicami", "Vnos datuma + gumba 'Ne vem' / 'Približno' ob strani",
    null,
    ["nazorjeva: date/deadline profil — .uj-card-date"],
    "3-stolpčna vrstica: polje za datum + dve kratki bližnjici, ki nadomestita natančen vnos, " +
    "kadar uporabnik datuma ne pozna natančno."
  ),
  vrstica(
    16, "obmocje-nalaganja", "Črtkano obrobljeno področje za nalaganje datoteke, z ikono in opisom",
    null,
    ["nazorjeva: document profil — .uj-card-upload > label:first-child"],
    "Dobesedna ponovna uporaba. Skrit native input[type=file] prekriva celotno območje."
  ),
  vrstica(
    17, "iskalni-spustni-seznam", "Vnosno polje z rezultati iskanja spodaj (combobox)",
    null,
    ["nazorjeva:iskalni-izbirnik — .uj-card-combobox"],
    "Vsak zadetek je vrstica z naslovom (span) in podrobnostjo (small); prazno stanje ima " +
    "ločeno sporočilo [data-combo-empty]."
  ),
  vrstica(
    18, "izbirni-zetoni", "Banka gumbov-oznak + izbrani žetoni z X za odstranitev + dodajanje svojega",
    null,
    ["nazorjeva:izbirnik-oznak — .uj-card-tags"],
    "Tri vrstice druga pod drugo: banka možnosti (pill gumbi), izbrani žetoni (obarvani, z " +
    "gumbom × za odstranitev), vnos za lasten dodaten žeton."
  ),
  vrstica(
    19, "kontrolni-seznam-z-napredkom", "Vrstica napredka (progress bar) + seznam odkljukljivih vrstic",
    null,
    ["nazorjeva:kontrolni-seznam-dokazil — .uj-card-checklist"],
    "Napredek se izračuna iz razmerja odkljukanih/vseh; vsaka vrstica je gumb s kvadratkom " +
    "levo (kljukica ob is-done) in besedilom desno."
  ),
  vrstica(
    20, "razvrstitev-v-tri-skupine", "Vrstica z naslovom + 3 gumbi za razvrstitev (npr. vključeno/dodatno/izključeno)",
    null,
    ["nazorjeva:matrika-vkljucenosti — .uj-card-inclusion [data-inclusion-row]"],
    "Tri stanja imajo LASTNE barve (privzeta tema / zlata #c79d00 / koralna #ee5b58) — edini " +
    "najden primer, kjer ena vrstica hkrati uporablja tri različne barve stanja namesto ene teme."
  ),
  vrstica(
    21, "spustni-meni-po-meri", "Gumb, ki odpre mrežo možnosti navzgor (custom select brez native <select>)",
    null,
    ["nazorjeva: uporabljeno v desetinah widgetov prek pomožnih funkcij cardSelect()/conditionSelect() — .uj-card-condition__select"],
    "NAJBOLJ PONOVLJEN interakcijski vzorec v celotnem katalogu za 'izberi eno od več' zunaj " +
    "choice-button skupine (vrstica 10) — uporabljen povsod, kjer bi native <select> pokvaril " +
    "postavitev. Glej tudi test-nazorjeva-native-select-audit.js, ki prav to preverja."
  ),
  vrstica(
    22, "casovnica-korakov", "4 oštevilčeni/obkljukani krogi v vrstici, povezani s črto",
    null,
    ["nazorjeva:casovnica-mejnikov — .uj-card-timeline"],
    "Vsak krog ima naslov + podrobnost pod seboj; stanji is-done/is-current obarvata krog."
  ),
  vrstica(
    23, "vrstica-prioritete", "Oštevilčena vrstica z besedilom in gumboma gor/dol za premik",
    null,
    ["nazorjeva:razvrscanje-prioritet — .uj-card-priority li"],
    "Oštevilčen krog na levi (postane countera), besedilo na sredini, dva kvadratna gumba " +
    "(gor/dol) na desni."
  ),
  vrstica(
    24, "ikonski-vnos", "Vnosno polje z majhnim ikonskim krogom, vgrajenim v levi rob polja",
    null,
    ["nazorjeva: več widgetov z besedilnim/iskalnim vnosom — .uj-card-icon-input"],
    "Ikona je absolutno pozicionirana nad poljem (position:relative na ovoju), padding-left " +
    "polja se poveča, da besedilo ne prekriva ikone."
  ),
  vrstica(
    25, "mini-koledar", "Mesečni koledar z navigacijo prejšnji/naslednji mesec in mrežo dni",
    null,
    ["nazorjeva:mini-koledar — .uj-card-calendar"],
    "Glava z dvema puščicama in imenom meseca, spodaj mreža dni tedna + gumbi za vsak dan " +
    "(is-selected/is-muted stanje)."
  ),
  vrstica(
    26, "ostevilcen-korak-naslov", "Majhen oštevilčen krog + naslov koraka, kot glava enega od več korakov",
    null,
    [
      "nazorjeva:sled-izvora-podatka — <h3><span>1</span>Od kod je podatek?",
      "nazorjeva:gradnik-pravila-eskalacije — <h3><span>1</span>...",
      "nazorjeva:ujemanje-pogojev-dokazil — <h3><span>1</span>Pogoj"
    ],
    "Uporablja se pri vseh večkoračnih widgetih (2-3 zaporedni koraki na eni kartici) kot " +
    "glava vsakega koraka — ločeno od cele ogrodja koraka."
  ),

  // ============================================================
  // OD TU NAPREJ: PRAVE PRODUKCIJSKE ATENINE KARTICE (89 kartic),
  // vir app/styles.css (44.454 vrstic — CELOTEN CSS aplikacije, NE
  // samo kartic). To je LOČEN vizualni sistem od NAZORJEVA galerije
  // zgoraj — različen razred za skoraj vsak enak namen (glej opozorilo
  // pri vrstici 3). CSS se v galeriji NE vgrajuje v celoti (prevelik,
  // tvegan), temveč se za vsak primer ročno izloči samo potrebno pravilo.
  // ============================================================

  vrstica(
    27, "glava-modula-produkcija", "PRAVA glava kartice: kvadratna ikona + naslov (ne krog kot v NAZORJEVA)",
    null,
    ["atena produkcija — .ponudba-obrazec__glava + __glava-ikona (app/styles.css:1908)"],
    "Ikona je v ZAOBLJENEM KVADRATU (9px radij), ne v krogu kot vrstica 1/7 iz NAZORJEVA " +
    "galerije — to je konkretna, dokazana razlika med galerijskim in produkcijskim slogom."
  ),
  vrstica(
    28, "koraki-napredka-produkcija", "PRAVI korakovni indikator: krogi, povezani s črto, aktivni obarvani po temi",
    null,
    ["atena produkcija — .ponudba-obrazec__korak (app/styles.css:1848)"],
    "Konceptualno podoben vrstici 22 (časovnica) iz NAZORJEVA, a manjši (25px krog, ne 44px), " +
    "brez besedila pod krogom — samo številka. Barva teme prihaja iz --obrazec-barva, ne iz " +
    "--card-rgb kot v NAZORJEVA."
  ),
  vrstica(
    29, "checkbox-moznost-produkcija", "PRAVA izbirna vrstica: checkbox skrit, viden krog z barvo teme ob izbiri",
    null,
    ["atena produkcija — .ponudba-obrazec__moznost + __krog (app/styles.css:2063)"],
    "Uporablja CSS :has(input:checked) namesto JS is-selected razreda kot v NAZORJEVA " +
    "(vrstica 10/11) — cela vrstica je <label>, native checkbox je samo skrit, ne odstranjen."
  ),
  vrstica(
    30, "vrstica-potrditve-produkcija", "PRAVA vrstica pregleda: oznaka levo, vrednost desno, brez ikone",
    null,
    ["atena produkcija — .ponudba-obrazec__potrditev (app/styles.css:2123)", "uporabljena v C00/A01 modulih"],
    "To je PRAVI vir za vrstico 8 (vrstica-pregleda-z-urejanjem) in delno za vrstico 3 " +
    "(info-okvir) — glej odprto vprašanje pri vrstici 3. Ta je enostavnejša: samo 2 stolpca " +
    "(label + vrednost), brez tretjega stolpca za urejanje in brez ikone."
  ),
  vrstica(
    31, "okvir-podrocja-produkcija", "PRAVA barvna kartica področja (Cena/Obseg/Plačilo ...), z ikono, naslovom in napredkom",
    null,
    ["atena produkcija — .ponudba-obrazec__podrocje + variante --cena/--obseg/--placilo (app/styles.css:1562)"],
    "Vsako področje ima SVOJO barvo prek --podrocje-barva/--podrocje-ozadje (cena=zlata, " +
    "obseg=teal, plačilo=modra ...). To je neposredno v NASPROTJU z uporabnikovim pravilom " +
    "'ena barva, ne multi-hue' za ponudba-obrazec tok (glej memory " +
    "feedback_kategorije_ena_barva) — ODPRTO VPRAŠANJE, ali je to zastarelo ali namerna izjema."
  ),

  vrstica(
    32, "polje-produkcija", "PRAVI ovoj vnosnega polja: majhna oznaka (barva teme) + zvezdica za obvezno + pomoč/napaka spodaj",
    null,
    ["atena produkcija — .atena-polje + __oznaka/__pomoc/__napaka (app/styles.css:2361, fieldOpen/fieldClose v atena-card-renderer.js)"],
    "Tretja različica istega namena kot vrstica 9 (NAZORJEVA) — tu je oznaka pobarvana po " +
    "--obrazec-barva (ne siva), obvezno polje ima rdečo zvezdico, napaka pa spremeni cel ovoj " +
    "(padding+border+background), ne samo doda besedilo."
  ),
  vrstica(
    33, "izbirni-gumb-produkcija", "PRAVI gumb izbire: krog s kljukico levo, besedilo desno, odebeljena obroba ob izbiri",
    null,
    ["atena produkcija — .atena-izbira + __krog (app/styles.css:2382, SCOPED na .stran--storitev)"],
    "Ob izbiri se border poveča na 2px in PADDING SE ZMANJŠA za enako vrednost (kompenzacija), " +
    "da se gumb ne premakne — bolj izpiljena podrobnost kot v NAZORJEVA galeriji."
  ),
  vrstica(
    34, "denarni-vnos-produkcija", "PRAVO denarno polje: samo vnos + pripeta enota € desno (brez ikonskega kroga)",
    null,
    ["atena produkcija — .atena-znesek (app/styles.css:2410)"],
    "Enostavnejši od vrstice 12 (NAZORJEVA denarno polje) — ni ikone, samo 2 stolpca (vnos + " +
    "pripeta enota z lastnim ozadjem)."
  ),
  vrstica(
    35, "kolicinski-nadzor-produkcija", "PRAVI stepper: minus/vnos/plus/spustni-izbirnik-enote v eni vrstici",
    null,
    ["atena produkcija — .atena-kolicina (app/styles.css:2403)"],
    "4 stolpci (44/fleksibilno/44/~92px), zadnji stolpec je poln 'lep-izbirnik' (vrstica 37), " +
    "ne native select — bogatejši od vrstice 13 (NAZORJEVA stepper), ki uporablja native select."
  ),
  vrstica(
    36, "hitre-izbire-produkcija", "Vrstica kratkih 'bližnjica' gumbov (npr. Ne vem / Približno / Enkratno)",
    null,
    ["atena produkcija — .atena-hitre-izbire (app/styles.css:2424)"],
    "Ponovi se v VSAJ 5 različnih poljih (datum, rok, termin, trajanje, razpoložljivost) kot " +
    "nadomestilo za natančen vnos, kadar uporabnik podatka ne pozna natančno."
  ),
  vrstica(
    37, "lep-izbirnik-produkcija", "PRAV custom spustni meni: gumb z gradientnim ozadjem, meni FIKSNO pozicioniran (position:fixed)",
    null,
    ["atena produkcija — .atena-lep-izbirnik (app/styles.css:2295, SCOPED na .ponudba-obrazec)"],
    "Za razliko od vrstice 21 (NAZORJEVA), tukaj je [data-atena-select-menu] position:fixed " +
    "z visokim z-index (3300) — namenoma se dvigne NAD celotno kartico, da ga ne obreže overflow. " +
    "OPAŽENA NEDOSLEDNOST: eno pravilo tu (box-shadow gumba) pomotoma uporablja var(--card-rgb) " +
    "namesto barve teme --obrazec-barva — v produkciji ta spremenljivka ni definirana, torej " +
    "senca verjetno tiho izgine. Nisem tega popravljal (izven obsega te naloge)."
  ),
  vrstica(
    38, "nalaganje-dokumenta-produkcija", "PRAVO nalaganje: gumb 'Dodajte dokument' + seznam datotek + polje za opombo",
    null,
    ["atena produkcija — .atena-dokument (app/styles.css:2436)"],
    "Razlika od vrstice 16 (NAZORJEVA): tu je dodano OBVEZNO polje za opombo ('Kaj dokazilo " +
    "potrjuje?') pod nalaganjem — neposredno povezano z vrstico E01 iz ponudba-moduli-engine.js."
  ),
  vrstica(
    39, "seznam-zetonov-produkcija", "PRAVI seznam: vsaka postavka kot žeton z × za odstranitev + vrstica za dodajanje",
    null,
    ["atena produkcija — .atena-seznam (app/styles.css:2444)"],
    "Konceptualno podobno vrstici 18 (izbirni-žetoni), a tu ni 'banke' vnaprej ponujenih " +
    "možnosti — uporabnik vpiše vsako postavko sam (prosti seznam, ne izbira iz nabora)."
  )
,

  // ============================================================
  // OD TU NAPREJ (40-92): PREOSTALIH 53 NAZORJEVA WIDGETOV, ki jih dosedanji
  // pregled ni obravnaval kot ponovljive VRSTICE, ker je vsak svoja lastna,
  // widgetu specifična celotna vizualizacija (graf, izračun, interaktivni
  // mehanizem) — glej opombo na vrhu datoteke. Na uporabnikovo izrecno
  // zahtevo po CELOVITEM registru so dodani KOT CELE KARTICE, ne razstavljeni
  // na manjše gradnike. Primer vsake je avtomatsko izrisan iz PRAVE body()
  // funkcije tega widgeta (ne ročno prepisan), da se izognemo napakam kot
  // pri prejšnji različici vrstice 25 (mini-koledar).
  // ============================================================
  vrstica(
    40, "widget-da-ne-ne-vem", "Posrednik ali izvajalec",
    null,
    ["nazorjeva:" + "da-ne-ne-vem" + " (widget #" + 1 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Da / ne / ne vem · kratka enojna izbira" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    41, "widget-stevilcna-lestvica", "Trajanje vezave",
    null,
    ["nazorjeva:" + "stevilcna-lestvica" + " (widget #" + 2 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Vodoravna lestvica · 5–10 kratkih možnosti" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    42, "widget-dvojni-segment", "Način obračuna",
    null,
    ["nazorjeva:" + "dvojni-segment" + " (widget #" + 3 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Dva velika segmenta · medsebojno izključujoča" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    43, "widget-mreza-izbir", "Vloga ponudnika",
    null,
    ["nazorjeva:" + "mreza-izbir" + " (widget #" + 4 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Tap-mreža 2 × 2 · daljše, razločljive možnosti" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    44, "widget-navpicni-izbor", "Vir ponudbe",
    null,
    ["nazorjeva:" + "navpicni-izbor" + " (widget #" + 5 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Navpični izbor · možnost »Drugo« z dopolnitvijo" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    45, "widget-spustni-seznam", "Način plačila",
    null,
    ["nazorjeva:" + "spustni-seznam" + " (widget #" + 6 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Spustni seznam · daljši ali stabilen nabor možnosti" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    46, "widget-besedilni-vnos", "Predmet ponudbe",
    null,
    ["nazorjeva:" + "besedilni-vnos" + " (widget #" + 7 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Besedilo · kratka ali večvrstična različica istega vzorca" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    47, "widget-natancen-znesek", "Osnovna cena",
    null,
    ["nazorjeva:" + "natancen-znesek" + " (widget #" + 8 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Natančen znesek · valuta in kratka dodatna izbira" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    48, "widget-znesek-ali-odstotek", "Predplačilo",
    null,
    ["nazorjeva:" + "znesek-ali-odstotek" + " (widget #" + 9 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Znesek ali odstotek · preklop enote brez ugibanja" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    49, "widget-kolicina-in-enota", "Količina in enota",
    null,
    ["nazorjeva:" + "kolicina-in-enota" + " (widget #" + 10 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Stepper + enota · količina, trajanje ali število" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    50, "widget-drsnik-razpona", "Merilo dogovora",
    null,
    ["nazorjeva:" + "drsnik-razpona" + " (widget #" + 11 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Izbira merila → grafični drsnik z neposrednim prikazom vrednosti" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    51, "widget-datum-z-gotovostjo", "Predviden začetek",
    null,
    ["nazorjeva:" + "datum-z-gotovostjo" + " (widget #" + 12 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Datum · natančen, neznan ali približen" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    52, "widget-termin-in-pogostost", "Termin izvedbe",
    null,
    ["nazorjeva:" + "termin-in-pogostost" + " (widget #" + 13 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Prosti termin + hitre bližnjice" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    53, "widget-seznam-postavk", "Najpomembnejši pogoji",
    null,
    ["nazorjeva:" + "seznam-postavk" + " (widget #" + 14 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Ponovljiv seznam · dodajanje in odstranjevanje postavk" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    54, "widget-dokazilo", "Dokazilo",
    null,
    ["nazorjeva:" + "dokazilo" + " (widget #" + 15 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Dokument · izbor, stanje datoteke, odstranitev in opomba" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    55, "widget-razdelitev-proracuna", "Razdelitev proračuna",
    null,
    ["nazorjeva:" + "razdelitev-proracuna" + " (widget #" + 16 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Krožni prikaz + drsnik · dve vrednosti s skupno vsoto 100 %" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    56, "widget-primerjava-moznosti", "Primerjava možnosti",
    null,
    ["nazorjeva:" + "primerjava-moznosti" + " (widget #" + 17 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Vzporedna primerjava · cena, rok in poudarjene razlike" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    57, "widget-tedenski-termini", "Tedenski termini",
    null,
    ["nazorjeva:" + "tedenski-termini" + " (widget #" + 20 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Tedenska mreža · večizbor dopoldanskih in popoldanskih terminov" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    58, "widget-ocenjevalna-matrika", "Ocenjevalna matrika",
    null,
    ["nazorjeva:" + "ocenjevalna-matrika" + " (widget #" + 21 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Več meril + ocena · sproten izračun povprečja" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    59, "widget-dvojni-razpon", "Proračunski razpon",
    null,
    ["nazorjeva:" + "dvojni-razpon" + " (widget #" + 22 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Dvojni drsnik + histogram · jasno označena spodnja in zgornja meja" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    60, "widget-pogojna-garancija", "Garancija in kritje",
    null,
    ["nazorjeva:" + "pogojna-garancija" + " (widget #" + 23 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Pogojno razkritje · dodatna polja se pokažejo šele po izbiri" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    61, "widget-matrika-tveganja", "Matrika tveganja",
    null,
    ["nazorjeva:" + "matrika-tveganja" + " (widget #" + 26 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Matrika 3 × 3 · verjetnost in vpliv v enem dotiku" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    62, "widget-placilni-razrez", "Plačilni razrez",
    null,
    ["nazorjeva:" + "placilni-razrez" + " (widget #" + 28 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Sestavljeni stolpec + tri vrednosti · takojšen nadzor vsote" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    63, "widget-trenutno-proti-cilju", "Trenutno proti cilju",
    null,
    ["nazorjeva:" + "trenutno-proti-cilju" + " (widget #" + 29 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Dvojni merilnik + drsnik · razlika med stanjem in ciljem" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    64, "widget-odlocitvena-pot", "Naslednji korak",
    null,
    ["nazorjeva:" + "odlocitvena-pot" + " (widget #" + 30 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Dvostopenjska odločitev · naslednja izbira se prilagodi prvi" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    65, "widget-cenovni-most", "Kako nastane končna cena?",
    null,
    ["nazorjeva:" + "cenovni-most" + " (widget #" + 31 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Preprost račun po korakih · od začetne do končne cene" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    66, "widget-ciljni-pas", "Ciljni pas",
    null,
    ["nazorjeva:" + "ciljni-pas" + " (widget #" + 33 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Ciljni pas + natančen vnos · dejanska vrednost, cilj in jasen status" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    67, "widget-ocena-z-negotovostjo", "Ocena z negotovostjo",
    null,
    ["nazorjeva:" + "ocena-z-negotovostjo" + " (widget #" + 34 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Point-and-range · spodnja meja, osrednja ocena in zgornja meja" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    68, "widget-primerjava-sprememb", "Prej in zdaj",
    null,
    ["nazorjeva:" + "primerjava-sprememb" + " (widget #" + 35 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Interaktivna primerjava · obe vrednosti Prej in Zdaj sta neposredno drsni" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    69, "widget-prekoracitve-praga", "Kateri odgovori so zamujali?",
    null,
    ["nazorjeva:" + "prekoracitve-praga" + " (widget #" + 36 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Preprost seznam · takoj vidite, kateri odgovori so zamujali" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    70, "widget-hierarhicni-izbor", "Obseg storitve",
    null,
    ["nazorjeva:" + "hierarhicni-izbor" + " (widget #" + 37 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Hierarhični drill-down · en nivo naenkrat brez širokega drevesa" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    71, "widget-pravilo-ponavljanja", "Pravilo ponavljanja",
    null,
    ["nazorjeva:" + "pravilo-ponavljanja" + " (widget #" + 39 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Recurrence builder · interval, enota, dnevi in sproten opis pravila" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    72, "widget-relativni-rok", "Relativni rok",
    null,
    ["nazorjeva:" + "relativni-rok" + " (widget #" + 40 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Dogodek + odmik · razumljiv stavek namesto izračunavanja datuma" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    73, "widget-lokacija-in-doseg", "Lokacija in doseg",
    null,
    ["nazorjeva:" + "lokacija-in-doseg" + " (widget #" + 41 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Lokacija + radij · prostorski doseg z besedilno vrednostjo" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    74, "widget-obrocni-nacrt", "Obročni načrt",
    null,
    ["nazorjeva:" + "obrocni-nacrt" + " (widget #" + 42 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Stepper + dinamični stolpci · število obrokov in znesek posameznega obroka" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    75, "widget-parna-primerjava", "Parna primerjava",
    null,
    ["nazorjeva:" + "parna-primerjava" + " (widget #" + 44 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Prilagodljivo število kratkih primerjav · vprašanja določi dejanska uporaba" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    76, "widget-obcutljivost-izida", "Kaj najbolj spremeni ceno?",
    null,
    ["nazorjeva:" + "obcutljivost-izida" + " (widget #" + 46 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Trije vplivi · spremenite vrednost in takoj vidite razliko" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    77, "widget-mesalnik-scenarija", "Koliko denarja potrebujete v rezervi?",
    null,
    ["nazorjeva:" + "mesalnik-scenarija" + " (widget #" + 47 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Tri preproste nastavitve · takojšen izračun potrebne rezerve" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    78, "widget-prag-verjetnosti-zamude", "Koliko zamude še sprejmete?",
    null,
    ["nazorjeva:" + "prag-verjetnosti-zamude" + " (widget #" + 48 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "20 primerov zamude · izberete mejo in takoj vidite, koliko primerov jo preseže" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    79, "widget-toplotni-koledar", "Zasedenost po dnevih",
    null,
    ["nazorjeva:" + "toplotni-koledar" + " (widget #" + 49 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "4 tedni × 7 dni · preproste barvne stopnje brez številk" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    80, "widget-lijak-izterjave", "Od računa do plačila",
    null,
    ["nazorjeva:" + "lijak-izterjave" + " (widget #" + 50 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "4 preprosti koraki · zneski in koliko denarja je odpadlo med koraki" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    81, "widget-mreza-odvisnosti", "Kaj urediti najprej?",
    null,
    ["nazorjeva:" + "mreza-odvisnosti" + " (widget #" + 51 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Štirje kratki koraki · jasno je, kaj uredite zdaj in kaj sledi" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    82, "widget-pogajalski-prostor", "Dogovor o popustu",
    null,
    ["nazorjeva:" + "pogajalski-prostor" + " (widget #" + 52 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Preprost izbor načina plačevanja · popust in jasno priporočilo" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    83, "widget-skupine-odstopanj", "Pregled spornih pogojev",
    null,
    ["nazorjeva:" + "skupine-odstopanj" + " (widget #" + 53 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Vsak pogoj ima svoj jasen izbor · brez skritega prestavljanja med skupinami" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    84, "widget-pasovi-zmogljivosti", "Kam lahko prestavite delo?",
    null,
    ["nazorjeva:" + "pasovi-zmogljivosti" + " (widget #" + 54 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Izberete delo in ekipo · takoj vidite proste ure" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    85, "widget-ujemanje-pogojev-dokazil", "Povežite dogovor z dokazilom",
    null,
    ["nazorjeva:" + "ujemanje-pogojev-dokazil" + " (widget #" + 55 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Najprej izberete dogovor, nato pravi dokument" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    86, "widget-gradnik-pravila-eskalacije", "Kdaj naredimo naslednji korak?",
    null,
    ["nazorjeva:" + "gradnik-pravila-eskalacije" + " (widget #" + 56 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Izberete preproste pogoje in dejanje, ki naj sledi" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    87, "widget-sled-izvora-podatka", "Ali lahko podatku zaupate?",
    null,
    ["nazorjeva:" + "sled-izvora-podatka" + " (widget #" + 57 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Od kod je podatek, kako star je in ali je potrjen" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    88, "widget-prag-rentabilnosti", "Kdaj so stroški pokriti?",
    null,
    ["nazorjeva:" + "prag-rentabilnosti" + " (widget #" + 58 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Cena, strošek in stalni stroški · obe črti ter cilj se takoj preračunajo" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    89, "widget-drevo-pricakovane-vrednosti", "Kako najlažje do plačila?",
    null,
    ["nazorjeva:" + "drevo-pricakovane-vrednosti" + " (widget #" + 59 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Tri možnosti · ocene vsake možnosti ostanejo shranjene med primerjavo" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    90, "widget-kaskada-krsitve", "Kaj naredite, ko nastane težava?",
    null,
    ["nazorjeva:" + "kaskada-krsitve" + " (widget #" + 60 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "3 preprosti koraki · težava, prvi ukrep in rezervni korak" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    91, "widget-graficni-cenovni-most", "Cenovni most",
    null,
    ["nazorjeva:" + "graficni-cenovni-most" + " (widget #" + 61 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Pravi cenovni most · začetna cena, odbitek, dodatki, DDV in končni seštevek" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),
  vrstica(
    92, "widget-sprememba-in-potrditev", "Sprememba in potrditev",
    null,
    ["nazorjeva:" + "sprememba-in-potrditev" + " (widget #" + 62 + ") — celotna vizualizacija, avtomatsko izrisana iz prave body() funkcije"],
    "Vrsta spremembe, vpliv na znesek in rok ter jasna stopnja potrditve" + " Cela kartica (ne samo ena vrstica) je dodana zaradi celovitosti registra na uporabnikovo zahtevo — vizualizacija je specifična za ta widget, ni nujno ponovljiva drugje."
  ),

  // ============================================================
  // RAZČLENITEV kartice #90 (widget-kaskada-krsitve) NA POLJA — prvi primer
  // metode "vzemi celo kartico in jo razstavi na manjše vrstice", ki jo je
  // uporabnik zahteval. Kartica ima 5 delov: 2 sta NOVA vzorca (dodana
  // spodaj), 3 se ujemajo z že obstoječimi vrsticami (#10 skupina izbirnih
  // gumbov, #5 obarvana vrstica povzetka, #6 gumb ponastavi — niso podvojena).
  // ============================================================

  vrstica(
    93, "korak-naslov-kompakten", "Majhen (18px) krog s številko + besedilo, VSE V ENI VRSTICI (ne v <h3>)",
    null,
    ["nazorjeva:kaskada-krsitve (widget #60) — .uj-card-cascade__step"],
    "Manjša, kompaktnejša različica vrstice 26 (ostevilcen-korak-naslov, 22px, znotraj <h3>). " +
    "Ta je navaden <p> z manjšim krogom (18px) — uporabna, kadar je prostora manj ali je " +
    "korakov več kot 2-3."
  ),
  vrstica(
    94, "postopno-odklenjena-skupina", "Skupina 3 gumbov, ki so ZAKLENJENI (zatemnjeni, disabled), dokler prejšnji korak ni odgovorjen",
    null,
    ["nazorjeva:kaskada-krsitve (widget #60) — .uj-card-cascade__guards/__outcomes + .is-locked"],
    "NOV vzorec, ni bil najden nikjer prej v pregledu: enak izgled kot skupina izbirnih gumbov " +
    "(vrstica 10), a z dodatnim stanjem .is-locked (opacity .46, gumbi disabled), ki se odklene " +
    "šele, ko je prejšnji korak izbran. Izbran gumb dobi kljukico (::before) namesto samo " +
    "obarvane obrobe."
  ),

  // ============================================================
  // RAZČLENITEV kartice #89 (widget-drevo-pricakovane-vrednosti) NA POLJA.
  // Korak-naslov se ujema z vrstico 93 (isti 18px krog + <p>), zato ni
  // podvojen. Obarvana vrstica povzetka (#5) in gumb ponastavi (#6) se prav
  // tako ne podvajata.
  // ============================================================

  vrstica(
    95, "izbirni-gumb-z-rezultatom", "Izbirni gumb z DVEMA vrsticama besedila: glavna oznaka + manjša izračunana vrednost pod njo",
    null,
    ["nazorjeva:drevo-pricakovane-vrednosti (widget #59) — .uj-card-expected__actions button"],
    "NOV vzorec: razlikuje se od skupine izbirnih gumbov (vrstica 10), ker vsak gumb nosi " +
    "DRUGO vrstico ('small') z izračunanim rezultatom te izbire (npr. 'pribl. 2.200 €'), ki se " +
    "ob izbiri gumba prebarva na belo."
  ),
  vrstica(
    96, "drsnik-s-tocnim-vnosom", "Vrstica parametra: oznaka + izpis vrednosti zgoraj, drsnik in natančen številčni vnos DRUG OB DRUGEM",
    null,
    ["nazorjeva:drevo-pricakovane-vrednosti (widget #59) — .uj-card-expected__params [data-expected-param]"],
    "NOV vzorec, drugačen od vrstice 14 (drsnik-z-izpisom): tu je poleg drsnika (grid stolpec " +
    "1fr) dodan še ločen input[type=number] (90px) za natančen ročni vnos iste vrednosti — " +
    "uporabno, kadar je približen drsnik premalo natančen."
  ),

  // --- Razčlenitev widgetov #1-58, 61-62 (60 preostalih po nalogi "razčleni
  // čisto vsako kartico"): večina (npr. sled-izvora-podatka, sprememba-in-
  // potrditev, matrika-tveganja, toplotni-koledar, lijak-izterjave, prag-
  // rentabilnosti ...) je PREVERJENIH in so v celoti sestavljene iz že
  // obstoječih vrstic zgoraj (1-26) ALI so ena sama, nedeljiva vizualizacija,
  // ki je že v celoti zajeta kot cela kartica (widget-* vnosi 40-92) — glej
  // zaključno opombo pod registrom. Spodnje 4 vrstice so EDINE genuine nove
  // atomarne podvzorce, ki so se pri tej razčlenitvi pokazale:

  vrstica(
    97, "oznaka-z-zivo-potrditvijo", "Glava polja: oznaka na levi + majhno besedilo 'Izbrano: X' na desni, ki se posodablja ob izbiri",
    null,
    ["nazorjeva:stevilcna-lestvica (widget #2) — .uj-card-field__heading + .uj-card-selection-note"],
    "NOV vzorec: drugačen od vrstice 5 (živa-vrstica-povzetka), ker ni ločena vrstica pod " +
    "skupino, temveč del glave POLJA, poravnan v isti vrstici z oznako (label levo, potrditev " +
    "desno) — uporabno, ko je treba izbiro potrditi takoj ob oznaki, ne šele na dnu kartice."
  ),
  vrstica(
    98, "stevilcna-izbira-s-prostim-vnosom", "Skupina številčnih izbirnih gumbov (npr. 12/24/36) PLUS ločeno polje za ročni vnos druge vrednosti",
    null,
    ["nazorjeva:stevilcna-lestvica (widget #2) — .uj-card-number-choices + [data-number-custom]"],
    "NOV vzorec: razlikuje se od skupine izbirnih gumbov (vrstica 10), ker skupini dodaja " +
    "'ubežni ventil' — ozko besedilno polje ob koncu vrstice gumbov za primer, ko nobena " +
    "ponujena vrednost ne ustreza."
  ),
  vrstica(
    99, "denar-z-lokalnim-stikalom-enote", "Denarno polje, ki mu je neposredno pripeto majhno dvojno stikalo za preklop enote (Znesek / Odstotek)",
    null,
    ["nazorjeva:znesek-ali-odstotek (widget #4) — .uj-card-value-switch"],
    "NOV vzorec: kombinira denarno polje (vrstica 12) in skupino izbirnih gumbov (vrstica 10), " +
    "a stikalo NI ločena vrstica pod poljem, temveč lokalno pripeto POD samim vnosnim poljem " +
    "znotraj istega ovoja — spremeni pomen (in prikazano enoto: € ali %) istega vnosa."
  ),
  vrstica(
    100, "prost-seznam-z-dodajanjem", "Seznam prostih besedilnih postavk z gumbom '×' za odstranitev vsake, in ločeno vrstico spodaj za dodajanje nove",
    null,
    ["nazorjeva:seznam-postavk (widget #10) — .uj-card-list"],
    "NOV vzorec: drugačen od vrstice 18 (izbirni-žetoni), ker tu ni 'banke' vnaprej ponujenih " +
    "možnosti niti oblike žetona/tablete — je preprost seznam vrstic s prostim besedilom, " +
    "vsaka s svojim gumbom za brisanje, plus en sam vnosni gumb 'Dodaj' na dnu."
  ),

  // --- Uporabnik je izrecno zahteval, naj DEJANSKO razčlenim (ne le v enem
  // zbirnem komentarju označim kot "brez novih vzorcev") naslednjih 18
  // widgetov: 44, 50, 57, 58, 68, 69, 71, 76, 77, 78, 79, 81, 82, 83, 84, 85,
  // 86, 87. Spodaj je vsak od njih dejansko razstavljen; kjer je pregled
  // pokazal genuine nov pod-vzorec, je dodana nova vrstica.

  vrstica(
    101, "pogojno-razkrito-polje", "Besedilno polje, ki je SKRITO in se prikaže šele, ko uporabnik izbere ustrezno možnost (npr. 'Drugo') v skupini zgoraj",
    null,
    ["nazorjeva:navpicni-izbor (widget #5) — label.uj-card-other[hidden]"],
    "NOV vzorec: element obstaja v markupu ves čas, a je `hidden`, dokler ni izbrana možnost, " +
    "ki ga zahteva — šele takrat postane viden in obvezen. Isti mehanizem se ponovi tudi v " +
    "widgetu pravilo-ponavljanja (#71, datum konca ponavljanja, glej vrstico 108)."
  ),
  vrstica(
    102, "drsnik-s-segmentno-vrstico", "Drsnik parametra, kateremu je nad njim dodan izpis vrednosti, POD njim pa vrstica kratkih segmentov (kot signal/baterija) in oznake skrajnih točk",
    null,
    ["nazorjeva:drsnik-razpona (widget #11) — .uj-card-range__bars + input[type=range] + .uj-card-range__ticks"],
    "NOV vzorec, drugačen od vrstice 14 (drsnik-z-izpisom): segmentna vrstica (12 kratkih " +
    "črtic, del jih `is-active`) daje grob vizualni občutek 'napolnjenosti' NAD samim drsnikom, " +
    "spodaj pa so dodane še oznake skrajnih in srednjih vrednosti (90 % / 95 % / 100 %)."
  ),
  vrstica(
    103, "tedenska-mreza-terminov", "Tedenska mreža: glava z dnevi v tednu (Pon-Ned), pod njo vrstice časovnih pasov, v vsaki celici gumb za preklop zasedenosti tistega termina",
    null,
    ["nazorjeva:tedenski-termini (widget #20) — .uj-card-week"],
    "NOV vzorec: drugačen od mini-koledarja (vrstica 25, ki prikazuje DNI v mesecu), ker so " +
    "tu stolpci DNEVI V TEDNU, vrstice pa ČASOVNI PASOVI (npr. 8-12, 12-16) — mreža torej " +
    "predstavlja tedenski urnik, ne koledarski mesec. Zaključi jo živa vrstica 'Izbrano: N " +
    "termini' (vrstica 5)."
  ),
  vrstica(
    104, "ocenjevalni-seznam-s-povprecjem", "Seznam meril za oceno: zgoraj povzetek 'Skupna ocena X/5', pod njim za vsako merilo vrstica z oznako in minus/vnos/plus kontrolnikom",
    null,
    ["nazorjeva:ocenjevalna-matrika (widget #21) — .uj-card-score"],
    "NOV vzorec: sam minus/vnos/plus kontrolnik je enak vrstici 13 (stepper-nadzor), a tu je " +
    "PONOVLJEN v seznamu (eno merilo na vrstico: Cena, Kakovost, Rok ...), rezultati pa se " +
    "seštevajo v povzetek na vrhu — kombinacija seznama ocen in izračunanega povprečja je nova."
  ),
  vrstica(
    105, "dvojni-drsnik-primerjave", "Vrstica primerjave 'Prej/Zdaj': glava z obema vrednostma druga ob drugi, pod njo EN drsnik z DVEMA ročicama (prejšnja in trenutna vrednost) in obarvanim pasom med njima",
    null,
    ["nazorjeva:primerjava-sprememb (widget #35) — .uj-card-change__row + .uj-card-change__slider"],
    "NOV vzorec: dva prekrivajoča se input[type=range] na isti progi, položaj vsakega pa " +
    "dodatno riše obarvan pas med njima (CSS spremenljivke --change-from/--change-to) — " +
    "vizualno takoj pokaže SMER in VELIKOST spremembe, ne le končno vrednost."
  ),
  vrstica(
    106, "casovna-tocka-vrstica-s-podrobnostmi", "Vodoravna vrsta klikljivih 'točk' ob časovni osi (vsaka s prikazanim datumom in kratkim rezultatom), nekatere označene kot izjema/prekoračitev",
    null,
    ["nazorjeva:prekoracitve-praga (widget #36) — .uj-card-threshold__plot"],
    "NOV vzorec: vsaka točka je gumb z lastnim datumom in dvovrstičnim besedilom (rezultat + " +
    "kontekst), s stanjem `data-breach` za vizualno izjemo — drugačno od časovnice-mejnikov " +
    "(vrstica 22, ki je navpičen potek dogodkov), ker gre tu za VODORAVNO razpršene meritve."
  ),
  vrstica(
    107, "dvostebricna-statistika", "Dva statistična bloka drug ob drugem: majhna oznaka, velika vrednost, kratek pojasnjevalni pripis pod njo",
    null,
    ["nazorjeva:prekoracitve-praga (widget #36) — .uj-card-threshold__summary", "nazorjeva:prag-verjetnosti-zamude (widget #48) — .uj-card-probability__stats"],
    "NOV vzorec: ponovi se dobesedno enako v DVEH različnih widgetih (#36 in #48) — zanesljivo " +
    "ponovljiv gradnik za prikaz dveh povezanih številk (npr. 'število primerov' + 'odstotek') " +
    "na vrhu kartice, preden se prikaže podrobnejša vizualizacija."
  ),
  vrstica(
    108, "izbor-dni-v-tednu", "Vodoravna vrsta 7 gumbov s kraticami dni (Pon-Ned) za izbiro, kateri dnevi v tednu veljajo",
    null,
    ["nazorjeva:pravilo-ponavljanja (widget #39) — .uj-card-recurrence__days"],
    "NOV vzorec: preprostejši od tedenske mreže (vrstica 103, ki ima tudi časovne pasove) — " +
    "tu je le ENA vrsta 7 gumbov, uporabljena za izbiro dni ponavljanja pravila, ne terminov."
  ),
  vrstica(
    109, "drsnik-z-izhodiscem", "Drsnik parametra, ki je USREDINJEN na izhodišče (0): polnilo se širi LEVO ali DESNO od sredine glede na predznak vrednosti, barva polnila pa se ujema s smerjo",
    null,
    ["nazorjeva:obcutljivost-izida (widget #46) — .uj-card-sensitivity__track"],
    "NOV vzorec: drugačen od vrstice 14 (drsnik-z-izpisom, ki polni OD ROBA) in vrstice 96 " +
    "(drsnik-s-tocnim-vnosom) — tu polnilo NIMA fiksnega začetka, temveč se širi iz SREDINE " +
    "proge navzven, kar ustrezno predstavi vrednosti, ki so lahko negativne ali pozitivne."
  ),
  vrstica(
    110, "dodajanje-nove-moznosti-v-skupino", "Skupina prednastavljenih izbirnih gumbov, ki se konča z gumbom '+ Dodaj ...' — ta ob kliku odpre skrit obrazec (ime + Dodaj/Prekliči) za ustvarjanje NOVE možnosti v isti skupini",
    null,
    ["nazorjeva:mesalnik-scenarija (widget #47) — .uj-card-scenario__presets + .uj-card-scenario__new"],
    "NOV vzorec: drugačen od prostega seznama (vrstica 100, ki dodaja VRSTICE), ker tu " +
    "uporabnik dodaja NOVO PREDNASTAVITEV znotraj skupine izbirnih gumbov (vrstica 10) — " +
    "obrazec za ime je privzeto skrit in se prikaže šele ob kliku na '+ Dodaj'."
  ),
  vrstica(
    111, "tockovni-niz-z-visino-in-mejo", "Vodoraven niz mnogih drobnih 'stolpičkov' različnih višin (vsak ena meritev), ki so obarvani drugače, če presežejo izbrano mejo",
    null,
    ["nazorjeva:prag-verjetnosti-zamude (widget #48) — .uj-card-probability__plot"],
    "NOV vzorec: drugačen od časovne-točke-vrstice (vrstica 106, kjer je vsaka točka celoten " +
    "gumb z besedilom) — tu so točke ZELO drobne (samo višina šteje, brez besedila v mirovanju), " +
    "kar omogoča prikaz desetin meritev hkrati kot 'porazdelitev' okrog izbranega praga."
  ),
  vrstica(
    112, "mrezna-celica-s-tremi-pikami", "Kvadratna celica v mreži, ki namesto besedila prikazuje 1-3 majhne pikice kot kazalnik stopnje zasedenosti/intenzivnosti",
    null,
    ["nazorjeva:toplotni-koledar (widget #49) — .uj-card-heatmap__week button[data-load] [data-heat-mark]"],
    "NOV vzorec: število vidnih pik (0-3) je določeno s CSS-selektorjem glede na `data-load`, " +
    "ozadje celice pa se hkrati potemni (rgba(--card-rgb) v naraščajoči prosojnosti) — dvojno " +
    "kodiranje iste vrednosti (pike + barva ozadja) za lažjo berljivost. Celotna mreža (dnevi " +
    "v tednu × tedni) je sicer strukturno enaka tedenski mreži (vrstica 103), le celice so tu " +
    "namenjene intenzivnosti, ne preklopu da/ne."
  ),
  vrstica(
    113, "verizni-koraki-z-odklepanjem", "Veriga oštevilčenih 'vozlišč' (številka + naslov + kratek opis), kjer je trenutni korak poudarjen, prihodnji pa vidno zaklenjeni/sivi, dokler ni prejšnji opravljen",
    null,
    ["nazorjeva:mreza-odvisnosti (widget #51) — .uj-card-dependencies__graph"],
    "NOV vzorec: bogatejši od postopno-odklenjene-skupine (vrstica 94, ki je preprost seznam " +
    "gumbov brez oštevilčenja) — tu ima vsako vozlišče lastno številko IN dvovrstično besedilo " +
    "(naslov + status 'Sledi potem'/'Potrdi, ko je urejeno'), kar bolj spominja na verigo korakov."
  ),
  vrstica(
    114, "priporocilo-vrednosti", "Majhen blok: drobna oznaka, pod njo poudarjena priporočena vrednost, pod njo ležeč pojasnjevalni pripis",
    null,
    ["nazorjeva:pogajalski-prostor (widget #52) — .uj-card-plane__recommendation"],
    "NOV vzorec: drugačen od žive-vrstice-povzetka (vrstica 5, ki je celovrstično sporočilo " +
    "'kaj se je zgodilo') — ta blok je namenoma manjši in stranski, namenjen izključno prikazu " +
    "ENE priporočene/izračunane vrednosti (npr. 'Priporočen največji popust: 10 %') poleg " +
    "kontrolnikov, ne kot zaključni povzetek kartice."
  ),
  vrstica(
    115, "zmogljivostna-vrstica-s-trakom", "Vrstica 'zmogljivosti': oznaka ekipe/vira + status besedilo, vodoravni trak zapolnjenosti, in gumb za dodelitev na desni",
    null,
    ["nazorjeva:pasovi-zmogljivosti (widget #54) — .uj-card-capacity__lanes"],
    "NOV vzorec: kombinira oznako z drobnim statusom ('2 h prosto'), preprost trak brez " +
    "številčnega izpisa nad njim (drugače od vrstice 14) in akcijski gumb ('Izberi') na koncu " +
    "iste vrstice — namenjen dodeljevanju izbrane postavke enemu izmed več vzporednih virov."
  ),
  vrstica(
    116, "barvno-ujemanje-dveh-stolpcev", "Dva stolpca gumbov drug ob drugem (npr. 'Pogoj' in 'Dokazilo'); gumbi, ki spadajo skupaj, imajo isto barvo obrobe/poudarka preko lokalne CSS spremenljivke",
    null,
    ["nazorjeva:ujemanje-pogojev-dokazil (widget #55) — .uj-card-matching__columns (--match-rgb)"],
    "NOV vzorec: vsak gumb nosi inline `style=\"--match-rgb:R,G,B\"`, tako da pravi PAR (en v " +
    "vsakem stolpcu) deli isto barvo že PREDEN je karkoli izbrano — uporabnik lahko poveže " +
    "trditev z dokazilom po vsebini ALI po barvi. Stolpci sami uporabljajo oštevilčen-korak-" +
    "naslov (vrstica 26) za glavo."
  ),
  vrstica(
    117, "pogojna-vrstica-pravila", "Ena vrstica 'če-potem' pravila: okrogla številka na levi, DVA spustna menija drug ob drugem (kaj preverjamo / kako primerjamo), nato številčni vnos z enoto",
    null,
    ["nazorjeva:gradnik-pravila-eskalacije (widget #56) — .uj-card-condition__rows [data-condition-row]"],
    "NOV vzorec: sestavljen iz že znanih delov (spustni-meni-po-meri, vrstica 21, in denarno/" +
    "številčno polje z enoto), a njihova RAZPOREDITEV V ENI VODORAVNI VRSTICI (številka + " +
    "2 menija + vrednost) kot gradnik pravila je nova kombinacija, ki se ne pojavi drugje."
  ),

  // --- Uporabnik je opozoril, da register ni pokrival vseh 187 kartic v
  // "Laboratoriju vprašanj" (63 Nazorjeva + 35 Atena-zgodovina/cilji + 89
  // pravih Atena kartic) — samo 63 je bilo dejansko razčlenjenih. Spodaj je
  // prvi del popravka: PRAVE Atena kartice (schema.catalog, 89 skupaj) se
  // izrišejo prek app/atena-card-renderer.js, ki ima ~16 tipsko-specifičnih
  // funkcij za "field-composition" način (81 od 89) in prek NEPOSREDNEGA
  // klica na NAZORJEVA template.body() za "module-widget" način (8 od 89 —
  // ti torej NE uvajajo NIČ novega, koda to zagotavlja, ne le domneva).
  // Od preostalih 81 "field-composition" kartic je bilo že 13 produkcijskih
  // vzorcev ujetih v vrsticah 27-39 (glava, koraki, checkbox-izbira,
  // potrditev, področje, polje, izbirni-gumb, denar, količina, hitre-izbire,
  // lep-izbirnik, dokument, seznam) — te pokrivajo interakcije: short-text,
  // choice-list, money, quantity-unit, duration, rate, schedule, deadline,
  // document-upload, list-builder (preverjeno prek app/atena-card-schema.js,
  // ki šteje, kolikokrat se vsak `interaction` tip pojavi med 81 kartic).
  // Spodnjih 5 vrstic ujame preostale interakcijske tipe, ki jih vrstice
  // 27-39 NISO zajemale — vse ustvarjeno z DEJANSKIM klicem
  // renderer.fieldHtml(), ne ročnim prepisom.

  vrstica(
    118, "izbirna-mreza-produkcija", "PRAVA izbirna mreža: iste izbirne vrstice kot vrstica 33, a razporejene v 2 STOLPCA namesto v en navpičen seznam",
    null,
    ["atena produkcija — .atena-izbire--choice-grid, .atena-izbire--payment-method (app/styles.css:2380)"],
    "NOV vzorec: sam gumb je enak vrstici 33 (izbirni-gumb-produkcija), a `interaction: choice-grid` " +
    "in `payment-method` obe uporabita `grid-template-columns: repeat(2, ...)` namesto enega " +
    "stolpca — uporabno, ko je možnosti več in bi navpičen seznam predolg."
  ),
  vrstica(
    119, "izbirni-segmenti-produkcija", "PRAVI 'zavihkasti' izbor: 3 stolpci, brez kljukičnega kroga, besedilo poravnano na sredino — bolj podoben zavihkom/segmentom kot seznamu možnosti",
    null,
    ["atena produkcija — .atena-izbire--choice-segments (app/styles.css:2470, mobilna @media do 520px — primarna oblika za to mobilno-prvo aplikacijo)"],
    "NOV vzorec: za razliko od vrstice 33/118 tu je `.atena-izbira__krog` (kljukičen krog) " +
    "NAMENOMA skrit (`display:none`) — brez ikone je videti kot 3 enakovredni zavihki/segmenti, " +
    "ne kot seznam možnosti s kljukico. Uporablja se npr. za način plačila."
  ),
  vrstica(
    120, "denar-ali-odstotek-produkcija", "PRAVO sestavljeno denarno polje: vnos + DVA kvadratna 44×44 gumba (€/%) ob strani, namesto povezanega pill-stikala",
    null,
    ["atena produkcija — .atena-znesek-enota (app/styles.css:2413)"],
    "NOV vzorec: konceptualno isto kot vrstica 99 (NAZORJEVA denar-z-lokalnim-stikalom-enote), " +
    "a produkcijska različica namesto povezanega pill-stikala uporabi DVA LOČENA kvadratna " +
    "gumba (44×44 px vsak, isti razred kot atena-hitre-izbire gumbi) desno od vnosa."
  ),
  vrstica(
    121, "dvojno-trajanje-produkcija", "Dve vzporedni, ločeno označeni polji 'količina + enota' druga ob drugi pod skupnim poljem (npr. 'Odziv' in 'Odprava')",
    null,
    ["atena produkcija — .atena-cas-par (app/styles.css:2430)"],
    "NOV vzorec: vsak stolpec je sicer PONOVITEV že znanega para število+lep-izbirnik-enota " +
    "(vrstica 35), a tu sta DVE TAKI PARI prikazani vzporedno pod eno skupno oznako polja — " +
    "namenjeno vprašanjem, ki zahtevajo dve povezani trajanji hkrati (npr. odzivni + reševalni čas)."
  ),
  vrstica(
    122, "razpolozljivost-preklopni-nacin-produkcija", "Preklopna vrstica NAD poljem (npr. 'Odstotek SLA' / 'Delovni čas'), ki NE le prikaže/skrije dodatno polje, temveč POPOLNOMA ZAMENJA vrsto kontrolnika za isti podatek (drsnik z izpisom ALI prosto besedilo)",
    null,
    ["atena produkcija — .atena-razpolozljivost (app/styles.css:2433)"],
    "NOV vzorec: drugačen od pogojno-razkritega-polja (vrstica 101, ki doda DODATNO polje) — " +
    "tu preklop ne doda, temveč ZAMENJA GLAVNI kontrolnik za isto vprašanje: 'Odstotek SLA' " +
    "pokaže drsnik 90-100 % z izpisom, 'Delovni čas' pa namesto njega prosto besedilno polje. " +
    "OPAŽENA NEDOSLEDNOST: `input[data-atena-range]` v app/styles.css nima NOBENEGA lastnega " +
    "CSS pravila (preverjeno z iskanjem po celotni datoteki) — v pravi aplikaciji se torej " +
    "prikaže NEOBLIKOVAN, native brskalnikov drsnik (edini tak primer v celotni produkciji), " +
    "medtem ko imajo vsi drugi drsniki v aplikaciji lastno teal oblikovanje. Nisem popravljal " +
    "(izven obsega te naloge), primer v galeriji to zvesto prikaže."
  ),

  // --- Preverba, ali so vse 35 debtor-form kartice (Atena · Zgodovina in
  // cilji, glej "Laboratorij vprašanj") res pokrite: vsak zapis ima
  // templateId, ki je bil PROGRAMSKO preverjen (0 neujemanj) proti seznamu
  // 63 NAZORJEVA predlog. Od 16 uporabljenih templateId-jev jih je bilo v
  // prejšnjih krogih dejansko razčlenjenih le 6 (kaskada-krsitve, navpicni-
  // izbor, pogajalski-prostor, skupine-odstopanj, znesek-ali-odstotek + En
  // dodatna preverba za sled-izvora-podatka ni relevantna tu). Preostalih 10
  // (besedilni-vnos, datum-z-gotovostjo, dokazilo, natancen-znesek,
  // obrocni-nacrt, odlocitvena-pot, placilni-razrez, pogojna-garancija,
  // primerjava-moznosti, relativni-rok) je bilo doslej samo CELA KARTICA
  // brez lastne razčlenitve. Zdaj dejansko preverjeno:
  // - besedilni-vnos, datum-z-gotovostjo, dokazilo, natancen-znesek: PREPROSTA
  //   POLJA, v celoti pokrita z vrsticami 9-17 (preverjeno že v prvem krogu).
  // - relativni-rok: sestavljen iz že znanih delov (spustni-meni-po-meri #21,
  //   stepper #13, 2-gumbovsko stikalo #10, živa-vrstica-besedila) — BREZ
  //   novih vzorcev.
  // - pogojna-garancija: skupina izbirnih gumbov (#10) sproži PRIKAZ CELEGA
  //   PODPANELA (stepper+enota+polje) — isti mehanizem skrivanja/prikaza kot
  //   pogojno-razkrito-polje (vrstica 101), le da tu razkrije VEČ kontrolnikov
  //   naenkrat, ne le enega polja — BREZ nove vrstice, a vreden navzkrižnega
  //   sklica.
  // - primerjava-moznosti, placilni-razrez, odlocitvena-pot, obrocni-nacrt:
  //   RAZKRILI so 4 genuine nove vzorce, dodane spodaj kot vrstice 123-126.

  vrstica(
    123, "primerjalna-kartica-z-ceno", "Gumb primerjave: ime možnosti zgoraj, POD njim velika izpostavljena cena, pod njo dvovrstični drobni podatki (npr. rok + garancija)",
    null,
    ["nazorjeva:primerjava-moznosti (widget #17) — .uj-card-comparison"],
    "NOV vzorec: dva (ali več) taka gumba drug ob drugem v 2-stolpčni mreži, uporabnik izbere " +
    "enega. Drugačen od izbirnega-gumba-z-rezultatom (vrstica 95), ker tu je CENA glavni, " +
    "največji element kartice (19px), ne stranska pripomba k oznaki."
  ),
  vrstica(
    124, "segmentna-vrstica-z-vnosi", "Vodoravna barvna vrstica, sestavljena iz N zaporednih odsekov (širina = delež), POD njo N ustreznih oznaka+vnos+% polj, na dnu skupni preverjen seštevek",
    null,
    ["nazorjeva:placilni-razrez (widget #28) — .uj-card-payment__bar + .uj-card-payment__fields"],
    "NOV vzorec: vrstica samih odsekov (brez vnosa) prikaže RAZMERJE, spodnja polja pa " +
    "omogočajo NATANČNO nastavitev vsakega deleža — z živim preverjanjem, da vsota ostane " +
    "100 % ('Skupaj: 100 %'). Drugačen od drsnika-s-segmentno-vrstico (vrstica 102), ker tu " +
    "ni drsnika — vsak odsek ima svoje ločeno številčno polje."
  ),
  vrstica(
    125, "razvejana-druga-stopnja", "Dvokoračna odločitev: 1. korak izbere SMER, glede na izbrano smer pa se prikaže EN OD VEČ možnih 2. korakov, vsak s svojo, DRUGAČNO skupino izbirnih gumbov",
    null,
    ["nazorjeva:odlocitvena-pot (widget #30) — .uj-card-decision__panel[hidden]"],
    "NOV vzorec: drugačen od preklopnega-načina (vrstica 122, ki zamenja EN kontrolnik med 2 " +
    "možnostma) — tu prvi korak razveji na VEČ (3+) popolnoma različnih 2. korakov, vsak s " +
    "svojimi, tematsko drugačnimi možnostmi (npr. če 'Primerjaj', vprašaj Ceno/Rok/Pogoje; če " +
    "'Zavrni', vprašaj Ceno/Tveganje/Drugo) — pravo razvejano drevo, ne le preklop enega polja."
  ),
  vrstica(
    126, "stolpci-obrokov", "Vrstica N enako širokih, oštevilčenih navpičnih stolpcev (1, 2, 3 ...), ki ponazarjajo izbrano število obrokov, s stepper kontrolnikom pod njimi za spreminjanje N",
    null,
    ["nazorjeva:obrocni-nacrt (widget #42) — .uj-card-installments__bars"],
    "NOV vzorec: za razliko od korakov-napredka (vrstica 28, krogi povezani s črto, korak " +
    "poteka) so ti stolpci ENAKE višine (ne napredek), služijo zgolj ŠTETJU/PONAZARJANJU " +
    "izbranega števila enot (obrokov) — spremenijo se v številu (ne barvi/stanju), ko " +
    "uporabnik prilagodi stepper pod njimi."
  ),

  // --- TRETJI, LOČEN vizualni sistem: prava produkcijska izkušnja za vseh
  // 35 "Atena · Zgodovina in cilji" scenarijev (glej app/neplacila-
  // zgodovina.js + app/neplacila-cilj.js + app/neplacila-zgodovina.css,
  // 2447+3119 vrstic). To NI isto, kar prikaže "Laboratorij vprašanj" (ta
  // prikazuje templateId-referenco na eno od 63 NAZORJEVA predlog, kar je
  // uporabno za KATALOGIZACIJO, a ni dejanska uporabniška izkušnja). V živi
  // aplikaciji uporabnik NE izbira med predlogami — namesto tega vpiše ali
  // pove (glasovno) prost opis dogodkov, Atena (AI) jih razčleni v sezname
  // "kandidatov", uporabnik jih dopolni po enem, nato potrdi. Razredi
  // ".zgodovina-ai-*" so bili pregledani (46 unikatnih razredov v datoteki);
  // spodnjih 7 vrstic zajema genuine, ponovljive gradnike te izkušnje —
  // primeri so ROČNO PREPISANI iz dejanske izvorne kode (funkcije so
  // zaprtja, ne izvozene čiste funkcije, zato ni bilo mogoče avtomatsko
  // izrisati kot pri atena-card-templates.js/atena-card-renderer.js), zato
  // je bil vsak primer po izdelavi posebej vizualno preverjen.

  vrstica(
    127, "glasovni-vnos-z-merilnikom", "Veliko besedilno polje za prost opis + spodaj DVA gumba (Povej na glas / Pripravi dogodke), ki si med snemanjem/analizo izmenično 'stisneta' širino, in majhen merilnik glasnosti (5 črtic) nad snemalnim gumbom med snemanjem",
    null,
    ["zgodovina · neplacila-zgodovina.js:1141-1148 — .zgodovina-ai__vnos + .zgodovina-ai__akcije + .zgodovina-ai__snemaj + .zgodovina-ai__glasnost"],
    "NOV vzorec, edinstven v celotni aplikaciji: mikrofonska ikona v gumbu, ki se ob snemanju " +
    "obarva rdeče in razširi (drugi gumb se hkrati skrči na širino 0 z animacijo), plus 5 " +
    "kratkih navpičnih črtic, ki v živo poskakujejo z glasnostjo (CSS spremenljivka --voice-bar). " +
    "Namenjeno hitremu, prostemu opisu dogodkov namesto izpolnjevanja fiksnega obrazca."
  ),
  vrstica(
    128, "korakovni-napredek-s-tonom-in-povzetkom", "Vrstica majhnih oštevilčenih krogov (napredek), kjer je barva OBROBE vsakega kroga odvisna od TIPA dogodka na tem koraku (ne le stanja korak/opravljeno), zadnji krog pa namesto številke prikaže ikono (palec gor) za 'povzetek'",
    null,
    ["zgodovina · neplacila-zgodovina.js:806-833 — .zgodovina-ai-napredek (is-tone-*, is-tone-povzetek)"],
    "NOV vzorec: drugačen od korakov-napredka (vrstica 28, ki ima ENOTNO barvo za vse korake) " +
    "— tu ima VSAK korog svojo barvo glede na vrsto dogodka (npr. oranžna za 'delno plačilo', " +
    "vijolična za 'odvetnik'), kar uporabniku že na prvi pogled pokaže naravo vsakega koraka."
  ),
  vrstica(
    129, "stanje-dolga-primerjava", "Dva stolpca ločena z navpično črto: 'Originalni znesek' levo, 'Preostali znesek' desno (obarvan), oba z majhno oznako zgoraj in velikim zneskom spodaj",
    null,
    ["zgodovina · neplacila-zgodovina.js:872-882 — .zgodovina-ai-stanje-dolga"],
    "NOV vzorec: preprostejši od dvostebrične-statistike (vrstica 107, ki ima dodaten " +
    "pojasnjevalni pripis pod vsako številko) — tu je le oznaka+znesek, ločnica pa je tanka " +
    "navpična črta, ne prazen prostor. Namenjeno stalnemu, kompaktnemu prikazu stanja dolga " +
    "nad vsakim vprašanjem v celotnem pogovoru."
  ),
  vrstica(
    130, "urejanje-opisa-s-svincnikom", "Besedilo v narekovajih, prikazano kot gumb — klik nanj ga spremeni v urejevalno polje; v mirovanju je v vogalu majhna kvadratna ikona svinčnika, ki nakaže da je besedilo klikljivo",
    null,
    ["zgodovina · neplacila-zgodovina.js:949-955 — .zgodovina-ai-pogovor__opis + __opis-svincnik"],
    "NOV vzorec: ikona svinčnika je absolutno pozicionirana v zgornjem desnem kotu CELOTNEGA " +
    "besedila (ne poleg njega), kar iz navadnega odstavka naredi jasno 'uredljivo kartico' brez " +
    "dodatnega gumba 'Uredi' — sam citat JE gumb."
  ),
  vrstica(
    131, "kartica-razjasnitve-dogodka", "Kartica enega 'dogodka za dopolnitev': ikona + naslov + podnaslov v glavi, gumb 'Spremeni' desno od naslova, okrogel gumb '×' PRIPET NA ROB kartice zgoraj desno (napol izven kartice), spodaj dinamičen niz polj (za plačilne dogodke posebej strnjen v 2 stolpca: znesek+datum v 1. vrstici, celoten datum v 2.)",
    null,
    ["zgodovina · neplacila-zgodovina.js:929-946 — .zgodovina-ai-vprasanje + __odstrani + __spremeni + __polja--placilo-kompaktno"],
    "NOV vzorec: gumb za brisanje (__odstrani) je edini element v celotni aplikaciji, ki je " +
    "pozicioniran NAPOL ZUNAJ zgornjega roba svoje kartice (top:-9px), z belo obrobo in senco, " +
    "kot 'pripeta značka' — ne notranji gumb kot povsod drugod. Barva celotne kartice " +
    "(--vprasanje-rgb) se spreminja glede na vrsto dogodka, enako kot pri koraku napredka " +
    "(vrstica 128)."
  ),
  vrstica(
    132, "povzetek-vrstica-z-uredi-izbrisi", "Vodoravna vrstica: ikona v barvi tipa dogodka + naslov + kratek opisni niz (npr. '300 € · 3. 8. · bančno nakazilo'), na desni PAR gumbov 'Uredi' (pill) in '×' (okrogel)",
    null,
    ["zgodovina · neplacila-zgodovina.js:909-927 — .zgodovina-ai-povzetek + __akcije"],
    "NOV vzorec: kompaktnejši od kartice-razjasnitve-dogodka (vrstica 131, ki je polna " +
    "kartica s polji) — ta je SAMO vrstica za PREGLED že vnesenih dogodkov v seznamu, z dvema " +
    "majhnima akcijskima gumboma tik drug ob drugem na desnem robu."
  ),
  vrstica(
    133, "potrditev-uvodna-znacka", "Uvodna vrstica pred seznamom za potrditev: kvadratna (ne okrogla) ikona v obarvanem okvirju + naslov ('Če prav razumem …') + podnaslov, brez gumbov — samo napoved tega, kar sledi spodaj",
    null,
    ["zgodovina · neplacila-zgodovina.js:963-964 — .zgodovina-ai-pogovor__potrditev"],
    "NOV vzorec: drugačen od statusne-značke (vrstica 1, segment engine), ker ikona ni v " +
    "okroglem krogu temveč v ZAOKROŽENEM KVADRATU (11px radius na 32×32), in ni namenjena " +
    "opozorilu/statusu, temveč zgolj UVODU v naslednji blok vsebine (seznam povzetkov)."
  )
]);

// ============================================================
// ZAKLJUČEK RAZČLENITVE preostalih 60 widgetov (na uporabnikovo zahtevo
// "sedaj pa to delaj čisto za vsako kartico na točno tak način"):
//
// Za vsakega od widgetov #1-58, #61, #62 (izključujoč tiste, ki so že bili
// v celoti razčlenjeni prej: #59 drevo-pričakovane-vrednosti → vrstici
// 95-96, #60 kaskada-kršitve → vrstici 93-94) je bila telo body() funkcije
// pregledano in primerjano z že obstoječimi vrsticami. Ugotovitev:
//
// - Widgeti, ki so PREPROSTA POLJA (npr. da-ne-ne-vem, spustni-seznam,
//   besedilni-vnos, natančen-znesek, kolicina-in-enota, datum-z-gotovostjo,
//   dvojni-segment) so v CELOTI sestavljeni iz že obstoječih vrstic 9-17 in
//   21 — brez novih vzorcev.
// - stevilcna-lestvica (#2), znesek-ali-odstotek (#4) in seznam-postavk
//   (#10) so razkrili nove atomarne pod-vzorce → vrstice 97-100.
// - Prvi krog (34 preprostih widgetov) je bil torej ustrezno zaključen brez
//   novih vzorcev, RESNIČNO preverjen field-za-field.
//
// DRUGI KROG — uporabnik je 2026-09-03 izrecno opozoril, da naslednjih 18
// widgetov (44, 50, 57, 58, 68, 69, 71, 76, 77, 78, 79, 81, 82, 83, 84, 85,
// 86, 87) ni bilo dejansko razčlenjenih, temveč so bili v prvem krogu
// preuranjeno označeni kot "ena sama nedeljiva vizualizacija". Po tem
// opozorilu je bil vsak od teh 18 dejansko razstavljen na sestavne dele:
//
// - navpicni-izbor (#44) → vrstica 101 (pogojno razkrito polje)
// - drsnik-razpona (#50) → vrstica 102 (drsnik s segmentno vrstico)
// - tedenski-termini (#57) → vrstica 103 (tedenska mreža terminov)
// - ocenjevalna-matrika (#58) → vrstica 104 (ocenjevalni seznam s povprečjem)
// - primerjava-sprememb (#68) → vrstica 105 (dvojni drsnik primerjave)
// - prekoracitve-praga (#69) → vrstici 106, 107 (časovna točka-vrstica,
//   dvostebrična statistika)
// - pravilo-ponavljanja (#71) → vrstica 108 (izbor dni v tednu) + reuse
//   vrstice 101 (pogojno razkrito polje za konec ponavljanja)
// - obcutljivost-izida (#76) → vrstica 109 (drsnik z izhodiščem)
// - mesalnik-scenarija (#77) → vrstica 110 (dodajanje nove možnosti v
//   skupino) + reuse vrstice 96 (drsnik-s-točnim-vnosom za parametre)
// - prag-verjetnosti-zamude (#78) → vrstica 111 (točkovni niz z višino in
//   mejo) + reuse vrstic 96 in 107 (drsnik-s-točnim-vnosom, dvostebrična
//   statistika)
// - toplotni-koledar (#79) → vrstica 112 (mrežna celica s tremi pikami),
//   celotna mreža je sicer varianta tedenske-mreže-terminov (vrstica 103)
// - mreza-odvisnosti (#81) → vrstica 113 (verižni koraki z odklepanjem)
// - pogajalski-prostor (#82) → vrstica 114 (priporočilo vrednosti) + reuse
//   vrstice 10 (skupina izbirnih gumbov) in 96 (drsnik-s-točnim-vnosom)
// - skupine-odstopanj (#83) → PREVERJENO, BREZ NOVIH VZORCEV: vsaka vrstica
//   je le oznaka (vrstica 9) + custom spustni meni (vrstica 21, s 4
//   možnostmi namesto običajnih), zaključi žive-vrstice-povzetka (5) +
//   gumb-ponastavi (6)
// - pasovi-zmogljivosti (#84) → vrstica 115 (zmogljivostna vrstica s
//   trakom) + reuse vrstice 26 (oštevilčen-korak-naslov) in vrstice 95
//   (izbirni-gumb-z-rezultatom, za dvovrstične gumbe nalog)
// - ujemanje-pogojev-dokazil (#85) → vrstica 116 (barvno ujemanje dveh
//   stolpcev) + reuse vrstice 26 (oštevilčen-korak-naslov)
// - gradnik-pravila-eskalacije (#86) → vrstica 117 (pogojna vrstica
//   pravila) + reuse vrstic 10 in 21
// - sled-izvora-podatka (#87) → PREVERJENO, BREZ NOVIH VZORCEV: v celoti
//   zgrajen iz vrstic 26 (oštevilčen-korak-naslov), 10 (skupina izbirnih
//   gumbov), 96 (drsnik-s-točnim-vnosom), 5 (živa-vrstica-povzetka) in 6
//   (gumb-ponastavi) — enako kot sprememba-in-potrditev (#62)
//
// Register je s tem POPOLN glede na trenutno stanje app/atena-card-
// templates.js: vsak od 63 widgetov (62 odobrenih + 1 osnutek) je DEJANSKO
// razčlenjen na atomarne vrstice, ne le pavšalno omenjen.
// ============================================================

// ============================================================
// UGOTOVITEV O DEBTOR-FORM KARTICAH (35 kartic: 17 zgodovina + 18 FATHER
// cilji, categories "1.0"/"2.0" v atena-card-templates.js) — PREVERJENO,
// vrstic NAMENOMA NE DODAJAM:
//
// Vsak zapis (npr. HISTORY_FORM_CARDS "full_payment", "paid_in_full" ...
// in FATHER cilji "full_payment", "insolvency_claim" ...) ima polje
// templateId, ki kaže na eno od ŽE OBSTOJEČIH 62 NAZORJEVA predlog
// (npr. "natancen-znesek", "obrocni-nacrt", "kaskada-krsitve",
// "relativni-rok", "znesek-ali-odstotek"). Debtor-form kartice torej NE
// uvajajo nobenega novega vizualnega vzorca — so ista predloga z drugim
// naslovom/vprašanjem/vsebino. Vse vrstice, ki bi jih te kartice
// potrebovale, so že zajete v vrsticah 1-26 zgoraj.
// ============================================================

module.exports = Object.freeze({
  version: "nazorjeva-vrstice-v1",
  name: "NAZORJEVA-VRSTICE",
  status: "133 vrstic — 63 NAZORJEVA widgetov DEJANSKO razčlenjenih (2 kroga) + 5 iz 89 pravih Atena kartic + 4 iz preverbe vseh 35 debtor-form templateId-jev (0 neujemanj, 16 templateId-jev preverjenih) + 7 iz resnične '.zgodovina-ai-*' produkcijske izkušnje (ločen sistem v neplacila-zgodovina.js/neplacila-cilj.js), vrstice 127-133 — vsi trije viri so zdaj razčlenjeni",
  vrstice: VRSTICE,
  ids: Object.freeze(VRSTICE.map((entry) => entry.id))
});
