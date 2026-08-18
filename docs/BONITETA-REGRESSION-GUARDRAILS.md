# Bonitetni center — trajne regresijske varovalke

Ta dokument je obvezen kontrolni seznam za vsako spremembo ali odpravljanje napake v Bonitetnem centru. Cilj ni popraviti samo prijavljenega podjetja, ampak preprečiti celotno družino sorodnih napak.

## Nespremenljiv potek preverjanja

1. Najprej se ugotovi pravna identiteta.
2. Nato se potrdi naslov, poštna številka in kraj.
3. Pred nadaljevanjem mora obstajati prikazljivo dokazilo dejanskega vira.
4. Uporabnik potrdi podatke, kadar identiteta ni potrjena z uradnim registrom.
5. Šele nato se izvede uradna insolvenčna poizvedba.
6. Rezultat mora dokazovati, da je portal poizvedbo sprejel in vrnil prepoznaven rezultat.

Noben korak ne sme preskočiti prejšnjega. Manjkajoče dokazilo, neujemanje identitete ali neprepoznan rezultat ne sme postati zelena ocena.

## Identiteta in Impressum

- Nikoli ne ugibaj pravnega imena ali nosilca.
- Navigacija, kontaktni naslovi, spletna agencija, odgovorna oseba za vsebino in marketinški slogani niso pravna identiteta.
- Pri kapitalski družbi se uporablja kanonično pravno ime z obliko, na primer `GmbH`, `UG`, `AG`, `GbR`, `KG`, `OHG` ali `e.K.`.
- OpenRegister iskanje mora dati prednost popolni `company_id` oziroma registrski kombinaciji vrste, številke in sodišča, tudi kadar so ti podatki v ločenih poljih Impressuma. Iskanje samo po imenu je rezervna možnost. Odziv `402` pomeni izčrpane API-kredite, ne nedosegljivega registra; uporabniku pokaži točen razlog in nadaljuj z dovoljenimi rezervnimi viri.
- Naslovi strani, kot je `Pravno ime GmbH | slogan • storitev`, se morajo skrčiti na `Pravno ime GmbH`:
  - pri razčlenitvi Impressuma,
  - pri uporabnikovi potrditvi,
  - tik pred uradno poizvedbo,
  - v metapodatkih prikazanega iskanja.
- Poštna vrstica, ulica, kontakt ali druga vrstica tik pred oznako `Vertreten durch` nikoli ne sme postati poslovni naziv. Če zanesljivega ločenega naziva ni, pri samostojnem obrtniku uporabi potrjeno osebno ime nosilca.
- Pri samostojnem obrtniku je osebno ime nosilca obvezno; poslovni ali marketinški naziv ga ne sme zamenjati.
- Akademski, poklicni in častni nazivi niso del osebnega imena. Zapisi, kot so `Dipl.-Ing.`, `Dipl. Ing.`, `Dr.-Ing.`, `Prof. Dr.`, `Dipl.-Kfm.`, `M.Sc.`, `LL.M.`, `Mag.`, `Priv.-Doz.` ter enakovredne različice s pikami, vezaji ali oznako `(FH)` se odstranijo iz osebnega imena pri parserju, uporabnikovi potrditvi, obnovi starega rezultata, dokaznem zajemu in tik pred zunanjo poizvedbo. Naziv družbe ostane nespremenjen.
- Vse poti razčlenitve — običajni HTML parser, vidni brskalniški fallback, legacy fallback in vsebinska potrditev dokaznega posnetka — morajo uporabljati isti skupni slovar nemških pravnih vlog. Kopirani ločeni seznami niso dovoljeni, ker bi popravek ene poti pustil drugo na stari logiki.
- Slovar mora poleg izpisanih oznak podpirati običajne nemške kratice in ločila, med drugim `GF`, `GF:`, `GF Herr/Frau`, `HRB-Nr.`, `HRA-Nr.`, `GnR-Nr.`, `Registergericht` in `Amtsgericht`. Kratica je pravna oznaka samo znotraj preverjene strani Impressum in skupaj s popolnim nemškim naslovom; sama kratica ali naslov ne zadoščata.
- Nemška poštna predpona `D-` pred petmestno številko ni ulica. Vrstica `D-61352 Bad Homburg` mora uporabiti dejansko predhodno ulično vrstico; enako mora delovati v glavnem in vidnem rezervnem parserju.
- Za dokazilo družbe so obvezni pravno ime in naslov. Za posameznika so obvezni osebno ime in naslov.
- Če navaden HTTP-odgovor skrije vsebino, je dovoljen brskalniški zajem z običajnim brskalniškim profilom. Nikoli ne obidi omejitve `429` in za posnetek ne sprejemaj piškotkov v imenu uporabnika.
- Besedilo v DOM-u ni dokaz, da bo vidno na posnetku: preveri tudi vidnost vseh nadrejenih elementov. Če pravni blok skriva ali delno zatemni nedokončana odjemalska animacija, varno zaključi samo njen ovoj, zahtevaj končno polno vidnost, ponovno določi izrez in šele nato zajemi dokazilo.
- Prazen ali vizualno skrit pravni blok ne sme ustvariti stanja `captured`; poleg velikosti JPEG-a se preverita dejanska vsebina v osrednjem delu slike in njena navpična razporeditev. Zajem se ponovi, nato pa vrne jasno napako dokazila.
- Pasice in modalna okna za piškotke se za dokazni posnetek samo lokalno skrijejo, nikoli kliknejo. Pravilo mora prepoznati nemške in angleške gumbe ter pasice v glavnem dokumentu, okvirjih in odprtih senčnih korenih; po skritju mora obnoviti drsenje strani.

## Uradna insolvenčna poizvedba

- V polje podjetja se pošlje samo kanonično pravno ime, nikoli celoten naslov strani ali slogan.
- Za osebo se ime pravilno razdeli v polji priimek/podjetje in ime.
- Manjkajoč ali neveljaven OpenRegister ključ, izčrpani krediti, omejitev zahtev in začasna omrežna napaka OpenRegisterja ne smejo blokirati preverbe. Po že potrjeni identiteti, lokaciji in dokazilu mora sistem samodejno nadaljevati neposredno na uradni portal Insolvenzbekanntmachungen ter shraniti razlog preklopa.
- Register, sodišče, kraj in opravilna številka se dodajo samo, kadar so popolni in veljavni.
- Rdeča validacija obrazca, neprepoznana stran, timeout ali samo prikazan iskalni obrazec pomenijo `unavailable`, ne `clear`.
- `clear` je dovoljen samo po prepoznanem odgovoru portala brez objave. Morebitni zadetek mora prestati ujemanje identitete in kraja.
- Dokazni posnetek mora prikazovati dejanski rezultat poizvedbe.
- Ob posnetku mora biti vedno viden in klikljiv končni URL dejansko odprte strani. Literalni `/Impressum/` ni obvezen, ker imajo veljavne pravne strani lahko nenavadno pot, mora pa stran hkrati prestati vsebinsko preverjanje naslova `Impressum` in pravnih podatkov.
- Če so identitetni podatki na strani podvojeni v nogi, mora zajem dati prednost pravnemu bloku ob naslovu `Impressum`. Kompaktnejša noga strani ne sme premagati dejanskega pravnega bloka; kadar naslov manjka, uporabi semantično nogo samo kot rezervno možnost.

## Čakalna vrsta, čas in predpomnilnik

- Ročna uporabniška preverjanja imajo prednost pred projektnim periodičnim spremljanjem.
- Napaka projektnega razporejevalnika ne sme blokirati ročnih opravil.
- Veljaven delni rumeni rezultat se ne sme trikrat brez potrebe ponavljati.
- Zunanje klice omeji s časovno omejitvijo; uporabnik ne sme nedoločen čas gledati vrtečega kolesca.
- Ponoven klik istega uporabnika z istimi podatki med stanjem `queued` ali `processing` mora uporabiti isto opravilo. Ne sme ustvariti druge poizvedbe do zunanjega vira.
- Končan rezultat in dokazni posnetki se smejo ponovno uporabiti samo znotraj računa istega uporabnika. `cache_key` brez `user_id` ni dovoljen, ker bi razkril rezultat drugega uporabnika.
- Izbris podjetja mora odstraniti tudi njegova opravila, rezultate in dokazne posnetke iz čakalne vrste. Naslednje iskanje istega podjetja mora ustvariti novo opravilo brez oznake `cached`.
- Frontend mora delavca prebuditi brez blokiranja in nato omejeno preverjati stanje opravila.
- Ob spremembi parserja, odločanja ali oblike rezultata obvezno zvišaj različico predpomnilnika.
- Lokalni strežnik in produkcijski build ne smeta ostati na starem modulu ali starem assetu; preveri ponovno nalaganje in verzioniranje.
- Sprememba zajema dokaznega posnetka mora vedno povečati različico ključa čakalne vrste. Starega sivega, praznega ali s prekrivnim slojem zajetega JPEG-a se po popravku ne sme več vrniti iz predpomnilnika.
- Različice zajema, predpomnilnika in pogodbe dokazila imajo eno skupno izvorno točko. Vmesnik se ne sme navezati na konkretno številko zajema; prikaz dovoli samo semantična strežniška oznaka `screenshotReady`. Čakalna vrsta mora tudi že zaključene varne rezultate obogatiti s trenutno pogodbo, resnično manjkajoče dokazilo pa mora UI pojasniti z vidnim razlogom.
- Pred zajemom se poleg piškotkovnih pasic odstranijo tudi veliki fiksni pojavni ovoji (`dialog`, `modal`, `popup`, `lightbox`, `offcanvas`, EngageBox), kadar pokrivajo večino pogleda in imajo visok `z-index`. Navadnih fiksnih elementov ali pravne vsebine se ne odstranjuje.

## Obvezna matrika preverjanja po vsakem popravku

Za prijavljeno napako preveri najmanj:

| Plast | Obvezno vprašanje |
|---|---|
| Vhod | Ali se napaka pojavi pri URL-ju, ročnem vnosu, dokumentu in obnovljenem stanju? |
| Parser | Ali splošno pravilo deluje tudi pri drugačnih ločilih, pravnih oblikah in postavitvah Impressuma? |
| Potrditev | Ali lahko uporabnik ali star rezultat ponovno vnese nečisto vrednost? |
| Zunanja poizvedba | Ali je bila oddana kanonična vrednost in ali jo je portal dejansko sprejel? |
| Čakalna vrsta | Ali prioritete, retryji in terminalna stanja ostanejo pravilni? |
| Predpomnilnik | Ali star rezultat preživi novi popravek? Če da, zvišaj različico. |
| UI | Ali prikaz po resničnem reloadu kaže isto stanje kot strežnik? |
| Dokazilo | Ali posnetek prikazuje vir in rezultat, ne napake ali praznega obrazca? |
| Regresija | Ali obstajata test prvotnega in vsaj enega sorodnega primera? |

## Trenutno zaščiteni regresijski primeri

- `Leichum GmbH`: hiter zajem identitete brez onesnaženja z vsebino spletne agencije.
- `Schreiber GmbH`: naslov strani s sloganom se pretvori v kanonično pravno ime; uradni portal prejme `Schreiber GmbH`.
- `Sanitär Stöhr`: zajem uporablja dejanski `/Impressum/` in pravni blok ob naslovu strani, ne podvojenega kontakta v nogi; `65933 Frankfurt` ne sme postati naziv.
- `bad& heizung AG`: nemški cookie dialog ne sme prekriti Impressuma; kot zastopnika se uporabita člana uprave iz pravnega bloka, ne `Ansprechpartner` spletne agencije pod naslovom projektnega vodenja.
- Več-poslovalnične strani, kot je `badundheizung.de/karben/`: neposredno vneseni Impressum je zaklenjen vir in se ob napaki, preusmeritvi ali nepopolnem parserju ne sme zamenjati s korenskim Impressumom drugega pravnega subjekta. Pot poslovalnice sme iskati samo znotraj istega URL-konteksta; neujemanje vnesenega naslova, poštne številke ali kraja kandidat zavrne še pred prikazom in pred uporabniško potrditvijo.
- `Ackermann Sanitär`: Divijev animirani ovoj z `opacity: 0` ne sme ustvariti praznega dokaznega posnetka; zajem ga zaključi samo okoli preverjenega pravnega bloka.
- `KLIMABERATUNG Rolf Nagel GmbH`: delno prosojen siv vmesni kader ne sme postati dokazilo; zajem mora počakati na popolnoma viden pravni blok in stari posnetek razveljaviti z novo različico predpomnilnika.
- Delno sivi posnetki: prekrivni sloj, ki zatemni samo levi, desni, zgornji ali spodnji del dokazila, se mora prepoznati po pasovih slike. Temen `div` s prosojnostjo, filtrom, absolutnim položajem ali oznako pojavnega okna ni naravno temno ozadje. Tak zajem se ponovi brez skript, vse avtomatske posnetke pred različico v14 pa strežnik razveljavi tudi, če so nekoč nosili `screenshotReady=true`.
- `Moradi Elektrotechnik`: Usercentrics dialog in njegovo zatemnitveno ozadje sta ločena sorojenca v zaprtem senčnem delu. Ko je dialog zanesljivo prepoznan, se v istem senčnem korenu odstrani tudi veliko prazno fiksno ozadje z visokim `z-indexom`, glavni JavaScript Impressum pa ostane izrisan. Rezervni prikaz brez skript, ki pokaže samo zgornjo fotografijo in veliko prazno belo sredino, je neveljaven; vsi avtomatski posnetki pred različico v15 se razveljavijo.
- `A-Z Heizungsprofis GmbH`: nestandardni URL `?page_id=50` je veljaven Impressum; `GF David Jazvac` se prepozna kot zastopnik, `HRB-Nr.: 105826` kot registrska številka, isti skupni slovar pa mora delovati v glavnem, vidnem in rezervnem parserju ter pri potrditvi dokaznega posnetka.
- Samostojni obrtniki, kot sta Duman in Drescher: osebno ime ostane nosilec in ni zamenjano z navigacijo ali storitvijo.
- Registrirani samostojni trgovci (`e. K.`), kot je Insel SHK: pravno ime ostane ločeno od nosilca; zveza `Vertreten durch den Inhaber` se razume kot oznaka vloge, osebno ime pa se vzame iz iste ali naslednje vsebinsko povezane vrstice. Sama oznaka `den Inhaber` nikoli ne sme postati ime osebe.
- Registrirani samostojni trgovci brez izrecne oznake vloge, kot je `HappyMaids e.K.`: oseba se lahko prepozna kot nosilec samo v primarnem pravnem bloku, kjer so skupaj naslov pravnega ponudnika, naziv `e.K.`, neposredno sledeče osebno ime, poln naslov in registrska oznaka `HRA`. Oseba iz ločenega bloka `Ansprechpartner`, vsebinska odgovorna oseba ali drug kontakt nikoli ne sme postati nosilec.
- Poslovna imena, domene in kontakti, kot so `Rode Bad`, `www.rode-bad.de`, `Homepage` ali vrednosti `name`/`legalName` poslovnega JSON-LD, se hranijo kot poslovna identiteta in nikoli ne postanejo oseba. Osebno ime mora izhajati iz skupnega slovarja pravnih vlog (tudi zapisi `Inhaber/-in`, `Inhaber/in` in `Inhaberin`) ali iz strogo omejenega primarnega bloka registriranega trgovca. Vrstica pred pravno vlogo ni samodejno naziv, neznana vrsta identitete pa mora pred uradno insolvenčno poizvedbo ostati blokirana.
- `Sawade SHK`: kadar spletno mesto nima ločene povezave Impressum, se sme uporabiti povezana pravna stran, kot je `Datenschutzerklärung`, samo če vsebuje jasno oznako ponudnika (`Verantwortlicher Anbieter … ist` ali enakovredno), pravno vlogo, poln nemški naslov in pošto s krajem. Okrajšava `Inh.` pomeni `Inhaber`. Splošna stran zasebnosti brez tega označenega pravnega bloka se ne sme sprejeti kot dokaz identitete.
- Dokazni posnetki identitete: nadgradnja zajema ne sme zahtevati ročne spremembe številke v odjemalcu. Strežnik in čakalna vrsta izračunata `screenshotReady`; Udo Däumichen in vsak prihodnji varen zajem se morata prikazati ne glede na številko zajema, nevaren ali manjkajoč posnetek pa mora ostati blokiran z razlago.
- `AQUA-CC GmbH / watersolutions.shop`: `Dipl.-Ing. Elmar Lancé` se mora v vseh osebnih poljih in uradni insolvenčni poizvedbi skrčiti na `Elmar Lancé`; pravno ime družbe ostane `AQUA-CC GmbH`. Enako mora delovati za sestavljene in drugače zapisane akademske ali poklicne nazive.
- Samostojni regulirani poklici, kot je `Steuerberater Dr. Konstantin Dittmann`: formulacije `Verantwortlich im Sinne des TDG/TMG/DDG ... ist` na preverjenem Impressumu so pravna oznaka ponudnika, akademski naziv se odstrani iz osebnega imena, seznami poklicev (`Steuerberater, Fachberater`, `Rechtsanwältin, Fachanwältin`) in nadaljevalne vrstice `für ...` pa nikoli ne postanejo poslovni naziv. Če ni zanesljivega ločenega naziva, se uporabi očiščeno potrjeno osebno ime.
- Avtomobilski obrati: oznake dejavnosti (`Fahrzeugpflege`, `Fahrzeugaufbereitung`, `Autoservice`, `Lackiererei`, `Garage`, `Bike(s)`) niso osebna imena. Pri zapisu `oseba – ulica – pošta/kraj` se deli razberejo kot ločena polja; samostojni `Meister` pa se ne odstrani, ker je lahko priimek. Nevidni Unicode znaki in imenovane HTML-entitete ne smejo ostati v nazivu.
- Zunanje agencije, prazne predloge in napake: blok za `Entwicklung/IT/Webdesign` ter poznejši partnerji niso identiteta preverjanega podjetja. Strani `under construction` in vsebinske strani `404 Page Not Found` niso veljaven Impressum, tudi če strežnik vrne HTTP 200.
- OpenRegister finančni odziv hrani letne kazalnike v polju `indicators`; `net_income` in `balance_sheet_total` se morata prikazati kot ločena časovna niza z dejanskimi leti in vrednostmi. Pozitivne in negativne vrednosti morajo ostati ločene okoli ničelne osi. Manjkajoč kazalnik ni ničla in se ne sme izrisati ali razlagati kot poslovni rezultat.
- Spletne strani z JavaScript Impressumom ali nestandardnim odzivom: varen brskalniški fallback in zajem dokazila.
- Čakalna vrsta: največ 30 skupnih in 10 insolvenčnih opravil, prednost ročnih preverjanj ter pravilna terminalna stanja.
- Ročni vnos brez prikazljivega registrskega ali Impressum vira ostane rumen in ne sme sprožiti insolvenčne poizvedbe ali projektnega spremljanja.
- Skriti gumbi, rezultati in izvozi morajo ostati skriti tudi, kadar njihov komponentni slog uporablja `flex` ali `grid`; nova stranka ne sme podedovati povezave, podatkov ali asinhronega rezultata prejšnje stranke.
- Brisanje profila v `Moja podjetja` mora zahtevati potrditev, na strežniku ponovno preveriti lastništvo ter filtrirati po `id` in `user_id`. Če obstaja plačljivo zunanje spremljanje, se odstrani pred lokalnim profilom. Pred izbrisom profila se samo za istega uporabnika odstranijo tudi ujemajoča opravila, rezultati in dokazni posnetki mehke preverbe; povezani profilni predpomnilnik, opozorila in projektna spremljanja se nato odstranijo prek preverjenih `ON DELETE CASCADE` povezav. Naslednja ista poizvedba mora biti nova.
- Nedokončana preverba, ki še ni profil v `Moja podjetja`, mora imeti lasten potrjen izbris. Izbris odstrani vse prejšnje in trenutne vrstice istega normaliziranega spletnega vnosa, rezultate ter dokazne posnetke samo za prijavljenega lastnika; druga podjetja in drugi uporabniki ostanejo nedotaknjeni. Ponovni enak vnos mora ustvariti novo opravilo.
- Popoln izbris ne sme odpovedati samo zato, ker produkcija nima `SUPABASE_SERVICE_ROLE_KEY`: ob veljavni prijavi mora uporabiti uporabnikov žeton in RLS pravili `SELECT`/`DELETE`, ki sta omejeni na `auth.uid() = user_id`. Anonimna vloga mora ostati brez pravic.
- Transportne strani z generičnimi naslovi ali besedilom soglasja: `Unternehmensinformationen`, `Name des Unternehmens`, `Verwaltung/Betriebssitz`, `Eingetragener Firmensitz`, `Nützliche Weiterleitungen`, `Alles akzeptieren` in opisne povedi niso pravno ali osebno ime. Če ni ločenega zanesljivega naziva, se uporabi samo izrecno označen nosilec; sicer identiteta ostane nerazrešena.
- Naravno temen ali siv Impressum ni samodejno pokvarjen posnetek. Aktivno prekrivno plast določa kombinacija položaja, velikosti, prosojnosti, visokega `z-indexa` in odsotnosti pravnega besedila; resnična zasnova strani se lahko zajame, kadar je pravni blok v izrezu viden in berljiv.
- Štiridelna ali podvojena osebna imena, kot sta `Mohammad Sadegh Bayat Poor` in `Hassan Hassan`, so dovoljena samo, kadar jih preverjeni Impressum izrecno poveže z močno pravno vlogo. Enako pravilo mora veljati pri parserju, uporabnikovi potrditvi in pripravi uradne insolvenčne poizvedbe; splošno podvojeno besedilo, kot `Location Location`, ostane zavrnjeno.
- Vsak dokazni brskalnik uporablja svoj začasni profil. Zaklenjen ali nedokončno odstranjen profil enega vira ne sme ustaviti naslednjih preverjanj v seriji; čiščenje je omejeno na preverjeno začasno mapo z namensko predpono.

Ko je odkrit nov temeljni vzrok, se ta seznam in avtomatski testi dopolnijo v istem popravku.
