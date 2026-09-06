# Trajna pravila projekta Uspešni Ježek

## Obvezna Atena/Luna baza potrjenih napak

- Vsaka potrjena semantična napaka Lune se mora takoj zapisati v kanonični strojno berljivi register `api/_lib/atena-luna-error-knowledge.js`; zapis samo v pogovoru, poročilu ali komentarju ni dovolj.
- Vsak vnos mora vsebovati stabilni ID, datum, flow, družino napake, kontekst, opis napačne odločitve, izrecno navodilo `AVOID`, pravilno splošno pravilo `CORRECT` ter regresijo z izvornim stavkom, napačnim rezultatom in pričakovanim rezultatom.
- Register mora biti dejansko vključen v prvi Luninin prompt ustreznega flowa. Luna mora prejeti neposreden kontekst, čemu se mora izogniti in kaj mora narediti pravilno; primer je negativna lekcija za posplošitev, ne keyword pravilo.
- V bazo se zapisujejo samo potrjeni in po možnosti sintetični oziroma anonimizirani primeri brez osebnih podatkov. Ena napaka mora okrepiti celotno družino enakovrednih izrazov, ne ustvariti izjeme za en stavek.
- Ob vsakem novem vnosu je obvezen točen regresijski test, sorodna kombinatorna matrika in `npm run test:atena-error-knowledge` poleg prizadetih engine testov. Vnosa ni dovoljeno odstraniti samo zato, ker trenutni live klic uspe.

## Trajni napor za POS

- Pri vseh sedanjih in prihodnjih nalogah v POS delu projekta vedno uporabi reasoning effort `high`.
- Za POS nikoli ne uporabi reasoning effort `ultra`, tudi pri daljših ali zahtevnejših nalogah.

## Trda meja Atena/Luna: dolg vedno najprej

- To pravilo velja za vse prihodnje Codex chate in vse spremembe zgodovinskega toka Atene. V Luninem vhodu mora biti aktivni dolg `debtEur.remaining` (ter `debtEur.original` kot kontekst) vedno podan pred uporabnikovim opisom `sourceText`.
- Luna mora pred izdelavo katerekoli kartice sešteti vse dokončane dogodke, ki zmanjšujejo dolg: posamezna plačila, `N × znesek posameznega obroka`, navedene skupne zneske, dobropise in kompenzacije.
- Če skupna izvedena vsota presega aktivni dolg ali je uporabnikov izrecno navedeni preostanek računsko protisloven, mora Luna takoj vrniti samo `p=[]`, kratko slovensko opozorilo/vprašanje `q` z obema zneskoma in exact izsek `x`. Uporabnika mora prositi, naj popravi dolg, znesek ali število dogodkov. Delnih kartic ob opozorilu ne sme vrniti.
- Blokirno opozorilo o nepravilnih podatkih in pomensko podvprašanje sta različni stanji. Pri nepravilnosti Luna vrne vrsto `warning`; UI ne pokaže polja »Vaš odgovor« ali gumba »Odgovori«, skrije nadaljevanje in ponudi samo gumb »Uredi opis« čez celo širino. Vrsta `question` je dovoljena samo, kadar Luna pomena res ne razume dovolj natančno in potrebuje uporabnikov odgovor.
- Če natančnega skupnega učinka ni mogoče izračunati, mora Luna vprašati namesto ugibati. Enaka vsota in veljavna delna plačila pod dolgom niso napaka brez drugega izrecnega protislovja.
- Luna ne sme tiho omejiti, spremeniti, izpustiti ali popraviti zneska. Lokalni adapter po Luni ostaja tehničen: JSON/schema, zaprti ID-ji, neposredna preslikava in obvezni človeški pregled; ne sme postati drugi semantični razlagalec.
- Obvezna regresija za vsako prihodnjo spremembo tega toka je aktivni dolg `232 EUR` proti opisu `3 obroke po 100 EUR`: pričakovani rezultat je takojšnje opozorilo `300 EUR > 232 EUR`, brez plana in brez možnosti nadaljevanja s karticami.

## Skupni razvojni in produkcijski naslov

- Vsi Codex chati aktivno delo izvajajo samo v kanoničnem projektu `C:\Users\jkjob\Desktop\uspesen jezik git`; ne ustvarjaj ali uporabljaj ločene kopije oziroma worktreeja.
- Pred vsakim lokalnim preverjanjem v kanonični mapi zaženi `npm run verify:local`.
- Za razvoj, klike, vizualne primerjave in sveže posnetke uporabljaj `http://localhost:8001`. Računalniški iPhone predogled uporablja `http://localhost:8001/app/index.html?app-preview=1`.
- Ohrani vse obstoječe in tuje lokalne spremembe ter popravljaj najmanjši odgovorni sloj.
- Izvedi povezane teste in dejanski prizadeti tok preveri na `8001`. Nepovezan neuspešen test drugega agenta ne blokira lokalnega zaključka, vendar ga jasno zabeleži in ne posegaj v tuje delo.
- Localhost je dogovorjeni delovni predogled, ne končni javni naslov.
- Končni produkcijski naslov ostaja `https://uspesni-jezek.vercel.app/app/index.html`. Ko je produkcijska objava varno mogoča, objavi na istem obstoječem projektu in preveri produkcijo.
- Ne čakaj z razvojem zaradi Vercelove omejitve. Ne ustvarjaj novega Vercel projekta, novega URL-ja ali začasne `trycloudflare.com` povezave.
- Trenutno ugotovljena produkcijska blokada je omejitev največ 12 Serverless Functions na Vercel Hobby paketu, ne omejitev 100 objav v 24 urah. Pred naslednjo objavo mora biti število funkcij varno preverjeno.

## Obvezna končna preverba s svežim posnetkom zaslona

- To pravilo velja za vse agente in vse prihodnje pogovore, ki delajo na projektu Uspešni Ježek.
- Po vsaki uporabniško vidni izdelavi ali spremembi odpri točen prizadeti URL povsem na novo; že odprt zavihek, ohranjeno stanje, predpomnjena stran ali posnetek izpred zadnje spremembe niso dokaz.
- Pred odpiranjem za lokalno preverjanje zaženi `npm run verify:local`. Po zadnji spremembi kode ga zaženi znova.
- V sveže odprtem stanju ponovi uporabnikov dejanski tok in naredi nov posnetek zaslona končnega stanja.
- Posnetek obvezno vizualno primerjaj z uporabnikovo referenčno sliko in besednim navodilom: vsebina, stanje, postavitev, mere, poravnave, vidnost, prelivanje in odziv na klik.
- Če se rezultat ne ujema ali je kaj odrezano, skrito, staro, nedelujoče ali drugače postavljeno, nadaljuj s popravljanjem in ponovi celoten cikel. Naloga še ni končana.
- Agent ne sme napisati, da je sprememba narejena, popravljena ali preverjena brez novega posnetka po zadnji spremembi in brez opravljene primerjave.
- Če dejanskega posnetka zaradi tehnične ovire ni mogoče narediti, tega ne prikrivaj in naloge ne označi kot vizualno potrjene.

## Obvezno samodejno prilagajanje besedila

- Vsak omejen UI-element z besedilom ali številko mora ohraniti svojo dogovorjeno širino in višino.
- Če je vnesena ali prikazana vrednost predolga, se mora velikost pisave samodejno in sproti zmanjšati, dokler celotna vrednost ne paše v polje.
- To velja povsod: imena, priimki, podjetja, kontaktni podatki, zneski, številke računov, datumi, časi, naslovi kartic, gumbi, izbirna polja in vse prihodnje komponente.
- Pri vnosnih poljih mora prilagajanje delovati v živo ob vsaki vneseni črki ali številki, ne šele po shranjevanju ali osvežitvi.
- Preračun mora delovati tudi po programskem ali AI-izpolnjevanju, obnovi shranjenih podatkov, nalaganju pisav, spremembi širine zaslona in spremembi vsebine.
- Obstoječi CSS, tudi pravila z `!important`, ne sme preglasiti samodejno izračunane velikosti pisave.
- Besedilo se ne sme prekrivati, rezati, lomiti sredi vrednosti, širiti okvirja ali premikati sosednjih elementov.
- Ob vsakem posegu v omejeno polje preveri kratko in namerno dolgo realistično vrednost na telefonu in računalniku ter dodaj ali posodobi regresijski test.

To je privzeto pravilo za vse prihodnje UI-spremembe in ga ni treba znova potrjevati z uporabnikom.

## Obvezno odpravljanje celotne družine napak

- Pred vsakim popravkom ponavljajoče se napake ali regresije najprej razišči relevantno zgodovino zadnjih dni: povezane Codex pogovore, Git zgodovino in reflog, trenutno delovno drevo ter že opravljene teste. Rekonstruiraj zaporedje prvotnega simptoma, neuspešnih posegov, dejanskega temeljnega vzroka in nazadnje potrjenega pravilnega vedenja. Starega commita ne razglasi za pravilno stanje, če so bili poznejši potrjeni popravki še necommitani.
- Pred prvo spremembo kode obvezno zapiši: (1) zasnovo najmanjšega odgovornega popravka, (2) preverljivo hipotezo vzroka in rešitve ter (3) testno matriko, ki lahko hipotezo potrdi ali ovrže. Šele po teh treh korakih je dovoljeno urejanje kode.
- Prikazani simptom ni dovolj: pri vsaki napaki najprej določi temeljni vzrok in vse poti, po katerih lahko ista vrsta napačnega podatka ali stanja pride do rezultata.
- Popravek mora biti postavljen na vseh potrebnih mejah: ob zajemu/razčlenitvi, ob uporabnikovi potrditvi ali obnovi, pred zunanjo poizvedbo oziroma zapisom ter ob prikazu rezultata.
- Vedno preveri sorodne primere, ne samo prijavljene domene ali konkretne vrednosti. Prepovedani so popravki, vezani na eno podjetje, URL, ime ali posnetek.
- Obvezno preveri: predpomnilnik in njegovo različico, čakalno vrsto, ponovitve in časovne omejitve, delne rezultate, staro stanje strežnika, ponovno odprtje strani ter razliko med lokalnim in produkcijskim tokom.
- Napaka zunanjega vira mora biti ločena od napake naše aplikacije. Uspeh pomeni, da je zunanji obrazec poizvedbo dejansko sprejel in vrnil prepoznaven rezultat; prikazan ali posnet obrazec sam po sebi ni uspeh.
- Za vsak temeljni vzrok dodaj regresijski test prvotnega primera in najmanj en soroden/splošen primer. Nato izvedi celoten testni sklop prizadetega modula in, kadar je varno, dejanski end-to-end preizkus z javnim virom.
- Naloge ne označi kot končane, če je popravljen samo UI, mockup ali ena funkcija, medtem ko lahko produkcijska pot še uporablja staro kodo, star predpomnilnik ali drug vhod.
- Pri delu na Bonitetnem centru je obvezno prebrati in upoštevati `docs/BONITETA-REGRESSION-GUARDRAILS.md`.

To je trajno navodilo projekta za vse prihodnje odpravljanje napak in ga ni treba znova potrjevati z uporabnikom.

## Obvezno splošno iskanje podjetij

- Iskalnika podjetij nikoli ne popravljaj z izjemo za eno ime, domeno, kraj ali registrsko številko. Vsak popravek mora reševati celoten razred enakovrednih poizvedb.
- Odkrivanje kandidatov mora biti mehko: pomembne besede se lahko ujemajo tudi, kadar ima uradno ime dodatne vmesne besede, drugačna ločila ali zapis pravne oblike. Pravne oblike in vezniki niso razlikovalni del imena.
- Preverjanje izbranega kandidata mora ostati strogo: pred uporabo bonitetnih ali insolvenčnih podatkov se morajo ujemati registrska oznaka oziroma dovolj močna kombinacija pravnega imena, naslova, pošte in kraja.
- Mehko iskanje in stroga potrditev sta ločeni plasti. Varnostnega pravila iz potrditve se ne sme prenesti v autocomplete tako, da bi uporabnik izgubil veljavne predloge; mehko iskanje pa ne sme samodejno potrditi pravne identitete.
- Pozitiven skupni predpomnilnik imen je dolgoročen in zmanjšuje stroške. Prazen rezultat je kratkotrajen ter se mora po spremembi iskalne logike ali vira razveljaviti z novo različico predpomnilnika.
- Regresijski test mora vedno vsebovati najmanj: skrajšano ime z manjkajočimi vmesnimi besedami, drugo poljubno podjetje z enako obliko problema, napačnega kandidata s podobnimi splošnimi besedami ter zastarel prazen predpomnilnik.

To je trajno pravilo za vse sedanje in prihodnje vire imen podjetij.

## Bonitetna identiteta brez HWK

- HWK, Handwerksrolle, Kammerfinder in ODAV se ne uporabljajo v samodejnem ali ročnem toku bonitetne preverbe.
- Identiteto potrdita samo aktualni OpenRegister ali veljaven pravni Impressum. Če nobeden ne uspe, mora rezultat ostati nepreverjen in insolvenčna poizvedba se ne sme sprožiti.
- API ne sme vračati polja `hwk`, uporabniški vmesnik pa HWK ne sme prikazovati kot vir ali rezervno možnost.

To je trajna odločitev produkta in je ni dovoljeno razveljaviti z lokalno izjemo.

## Trdo pravilo za OpenRegister

- Za vsak prihodnji OpenRegister API klic uporabi izključno novi uporabnikov račun, katerega veljavni ključ je shranjen v lokalni oziroma Vercel skrivnosti `OPENREGISTER_API_KEY`.
- Ključev starega ali izbrisanega OpenRegister računa ne uporabi, tudi če ostanejo v starih lokalnih datotekah, predajah ali okoljih.
- Ključa nikoli ne zapiši v Git, navodila, klepet, dnevnike ali odjemalsko kodo. Če veljavna povezava manjka, uporabnika usmeri v njegov novi račun OpenRegister.
- Pred plačljivim preverjanjem potrdi, da API novega računa odgovarja, ter ne zamenjaj tehnične napake, manjkajoče kvote ali omejitve dostopa z rezultatom `not_found`.

## Nespremenljivi OpenRegister insolvenčni UI-kontrakt

- To je trdo, non-negotiable pravilo za vse prihodnje Codex pogovore in vse znane pravne osebe z varno potrjeno OpenRegister identiteto; ni dovoljeno uvajati drugega vmesnega, loading, result ali failure zaslona.
- Samodejni zagon je dovoljen izključno za `identity.status === "verified_register"`, `entityType === "company"`, popolno pravno ime in naslov z veljavno 5-mestno poštno številko, `companyId`, `identityEvidence.status === "verified_api"`, `evidenceReady === true`, `evidenceKind === "structured_api"`, ujemajoči se evidence `companyId` ter `locationMatch.status === "matched"`. Vse druge identitete in mismatch/unverifiable ostanejo za varnostnimi prehodi brez samodejnega POST-a.
- Med samodejnim preverjanjem mora uporabnik ostati na normalnem profilu podjetja. Realni loading/spinner se pokaže samo v obstoječi kompaktni vrstici `#boniteta-identiteta-nadaljuj`; `#boniteta-insolvenca-okno` in razred `boniteta-insolvenca-je-okno` se med loadingom ne smeta odpreti.
- Po uspehu mora profil ostati odprt in kompaktna vrstica pokazati dejanski izid, npr. »Brez zaznanih objav« ter »V uradnem viru ni najdenih objav.« Kanonična vizualna referenca je `output/playwright/boniteta-register-in-insolvenca-loceno-350.png`.
- Samo izrecni uporabnikov klik na zaključeno kompaktno vrstico sme odpreti `#boniteta-insolvenca-okno` z obstoječim starim podrobnim rezultatom: dejanski izid, uradni dokazni posnetek, uporabljeni iskalni podatki in uradni vir. Kanonična referenca je `output/playwright/boniteta-insolvenca-popravljeno-350.png`.
- Timeout, failed, malformed ali completed-without-result mora zapreti/skriti `#boniteta-insolvenca-okno`, odstraniti `boniteta-insolvenca-je-okno` in pustiti normalen profil z vidno vrstico »Preveri insolventnost znova« ter konkretnim razlogom. Generični »Rezultat preverbe / Preverjanje ni uspelo«, zeleni failure card, badge »PREVERITE« in prazna result stran so prepovedani.
- Samodejni queue POST mora biti exact-once skozi rerender oziroma asinhrono hidracijo; izrecni retry po napaki je nova dovoljena izvedba. Regresijski guard mora preveriti safe auto, brez podvojenega POST-a, negativne gate, profilni loading/success/error ter odpiranje starega detaila samo na klik.

Tega kontrakta ni dovoljeno spreminjati brez nove izrecne uporabnikove odobritve.

## Trajni jezik rednih UI-ikon

- Za običajne UI-ikone uporabljaj obstoječi kanonični register/FATHER; ne uvajaj vzporednega sistema.
- Geometrija: 24x24, fill="none", stroke="currentColor", stroke-width="2", stroke-linecap="round", stroke-linejoin="round".
- Kljukica: M20 6 9 17l-5-5. Desna puščica: m9 18 6-6-6-6.
- Posebne CTA/statusne/ilustrativne ikone so lahko izjeme.
- Nove redne ikone morajo slediti temu jeziku.

## Trajni oblikovni jezik rednega uporabniškega vmesnika

- To je privzeti oblikovni standard za vse prihodnje Codex pogovore in vse nove redne komponente projekta. Pred izdelavo novega UI-ja najprej ponovno uporabi obstoječe tokene, registre in komponente; nov vzporedni vizualni sistem ni dovoljen.
- Videz je Apple-like čist, mehak, zadržan in kompakten: dovolj praznega prostora, jasna hierarhija, tanke barvne obrobe, nežni gradienti oziroma fading ter brez težkih senc ali vizualnega hrupa.
- Osnovna barva besedila je praviloma `#2f3736`. Native turkizna je `#3f9998`; modro-siva za »Drugo / opiši sam« je `#567392`; vijolična `#6941b4` je rezervirana samo za odvetnika.
- Kartice uporabljajo dosledne radije iz obstoječih komponent, praviloma 11, 16 ali 18 px. Izbrana kartica mora imeti jasen 2 px okvir svoje lastne barve brez spremembe zunanjih mer ali premika postavitve.
- Barva izbirne kartice, odprtih podrobnosti, pripadajoče ikone in dodanega dogodka mora biti popolnoma usklajena. Številke razdelkov so native turkizne; številčni krogi dogodkov uporabljajo nežno barvo svoje kartice.
- Redne ikone sledijo zgornjemu trajnemu jeziku ikon: 24×24, `fill="none"`, `currentColor`, 2 px in zaobljeni zaključki. Brez polnega krožnega ozadja, razen kadar krog nosi jasen statusni pomen.
- Pri vsaki novi ali spremenjeni komponenti ohrani obstoječe zunanje mere, padding, `gap`, poravnave, odzivnost in razmerje med ikono ter besedilom. Vizualno poenotenje ne sme premakniti sosednjih elementov ali spremeniti funkcionalnosti.
- Pred uvedbo nove barve, radija, debeline linije, vrste kartice ali načina izbranega stanja preveri `app/ui-katalog.html` in dejanske skupne CSS tokene. Če ustrezen vzorec obstaja, ga ponovno uporabi.
- Posebni hero/CTA-gumbi, statusne značke, ilustracije, odvetniški sklopi in namensko drugačni vizualni tokovi so dovoljene izjeme. Izjema mora ostati omejena na svoj kontekst in ne sme postati nov privzeti slog; pri dvomu pred spremembo vprašaj uporabnika.
- Pred zaključkom uporabniško vidne spremembe preveri dejanski zaslon najmanj pri 390×844 in 980×900: brez vodoravnega prelivanja, odrezanih kartic, prekrivanja, premaknjenih kontrol ali console error/warn.

Namen tega pravila je, da se nove funkcije že prvič izdelajo v obstoječem oblikovnem jeziku in ne zahtevajo naknadnega redizajna.

## Atena v7 — univerzalni vnosni engine

- `Atena` je kanonično ime skupnega enginea, njegova trenutna sistemska različica pa je `atena-v7`. Z njim obrtnik dogodke opiše z besedilom ali glasom, jih po potrebi izbere ročno, pregleda pripravljene strukturirane dogodke in jih šele nato varno potrdi.
- **TRDI OBLIKOVNI FATHER:** kjerkoli se v aplikaciji, predlogu, mockupu ali sliki pojavi Atena engine, mora biti oblikovno izpeljan neposredno iz kanoničnega Atena v7 UI-ja. Brez uporabnikove izrecne zahteve ni dovoljeno spreminjati njegovega vizualnega jezika, hierarhije, barv, tipografije, radijev, obrob, senc, ikon, gostote, razmikov, razmerij kontrol ali načina prikaza kartic.
- Nova vgradnja sme prilagoditi samo gostiteljski naslov, dovoljene vsebinske kartice, pojasnila in končno kontekstno dejanje. Osrednji Atenin vnos, glasovni način, primarni gumb, pripravljene kartice, pregled in varnostna potrditev morajo ostati prepoznavno isti FATHER ter uporabljati skupne komponente, ne približne kopije.
- Če nove potrebe ni mogoče izraziti z obstoječim Atena FATHER-jem, agent ne sme sam izumiti novega videza. Najprej mora pokazati konkretno nujno odstopanje in pridobiti uporabnikovo izrecno oblikovno odobritev.
- Atena je ena skupna implementacija, ki se vgrajuje v različne tokove (med drugim zgodovina računa, predaja odvetniku in »Bo plačal«); ne izdeluj ločenih kopij ali vzporednih različic.
- Privzeti način je »Povej ali napiši«, »Ročno izberi« je enakovreden rezervni način. »Povej na glas« je jasen samostojen sekundarni gumb, »Pripravi dogodke« pa primarni turkizni gumb.
- Zgornja akcija se imenuje »Ponastavi« in uporablja ikono krožne ponovitve, ne koša. Razdelek pod vnosom se imenuje »Pripravljeni dogodki« in je brez praznega telesa kompakten; razširi se šele, ko dogodki obstajajo.
- Prazen zaključni prehod je vizualno sekundaren in se v zgodovinskem toku glasi »Nadaljuj brez zgodovine →«. Ko dogodki obstajajo, lahko gostiteljski tok uporabi močnejši kontekstni CTA.
- Gostiteljski tok določa naslov, dovoljene kartice in končno dejanje, Atena pa povsod ohrani isti vizualni jezik, izolirano stanje posamezne vgradnje ter varen pregled pred zapisom.

To je trajna produktna in oblikovna definicija za vse prihodnje pogovore v tem projektu; izraz `Atena` vedno pomeni zgornji skupni engine.

## Trajni register widgetov NAZORJEVA

- `NAZORJEVA.js` je edini kanonični register uporabniško odobrenih widgetov. Prisotnost v tej datoteki pomeni, da je widget dovoljen za ponovno uporabo v produkcijskih vprašalnikih.
- `NAZORJEVA-TEST.js` je edino dovoljeno čakalno mesto za vsak nov ali preoblikovan widget. Tam se widget testira, vizualno popravlja in primerja, vendar še ni produkcijsko odobren.
- Nov widget se mora najprej dodati v `NAZORJEVA-TEST.js`. Ne sme se ga hkrati dodati v `NAZORJEVA.js`, `approvedTemplateIds`, produkcijsko shemo ali produkcijski vprašalnik.
- Promocija iz `NAZORJEVA-TEST.js` v `NAZORJEVA.js` je dovoljena samo po izrecni uporabnikovi odobritvi konkretnega widgeta. Ob promociji ga odstrani iz TEST registra, dodaj v kanonični register in posodobi povezane teste ter produkcijski seznam.
- Noben agent ali prihodnji Codex pogovor ne sme samodejno sklepati, da vizualno dokončan ali tehnično uspešen widget že pomeni odobren widget.
- Ob vsaki spremembi registra zaženi `node scripts/test-nazorjeva.js`. Test mora preprečiti podvojitve, neevidentirane widgete in neposredno preskakovanje testnega koraka.

To je trajni projektni spomin za vse sedanje in prihodnje pogovore. Trenutni odobreni nabor je zaklenjen v `NAZORJEVA.js`; prihodnji kandidati vedno začnejo v `NAZORJEVA-TEST.js`.

## Trajni ID in obširni kontekst vsake kartice ter vnosne vrstice

- Vsak odobren widget, vsaka vprašalna kartica oziroma modul in vsaka posamezna vnosna vrstica morajo imeti lasten stabilen, globalno enoličen strojni `interfaceId`. ID se po objavi ne spreminja zaradi besedila, vrstnega reda, barve ali postavitve.
- Kanonični vzorec je `atena:widget:<template-id>`, `atena:card:<flow>:<module-id>` in `atena:field:<flow>:<module-id>:<field-id>`. Novi vmesniki morajo slediti isti hierarhiji ali jasno dokumentirani enakovredni shemi.
- Ob ID-ju mora obstajati obširen strojno berljiv kontekst: identiteta in izvor, uporabniški namen in vprašanje, canonical podatkovni tip in dovoljene vrednosti, required/conditional validacija, interaction in template, razlog izbire, native barvni tokeni, mobilno/namizno vedenje, auto-fit, persistence ter anti-patterni.
- Kontekst ni samo dokumentacija. Skupna shema ga mora izvoziti, renderer pa mora `interfaceId` in različico contracta izpisati v DOM prek `data-atena-interface-id` in `data-atena-context-version`.
- Model sme predlagati novo kartico ali preslikavo, vendar deterministični contract preveri ID, odobritev, raven, podatkovni pomen in dovoljeno interakcijo. Manjkajoč, podvojen ali preskočen ID ter prazen kontekst so blokirna napaka testa.
- Ob vsaki novi ali spremenjeni kartici oziroma vrstici posodobi generirani vodnik in matriko ter zaženi contract test, ki mora dokazati popolno pokritje vseh widgetov, kartic in polj.

To je trajna arhitekturna invarianta za vse sedanje in prihodnje Atenine vmesnike in je ni dovoljeno obiti z lokalnim DOM-ID-jem ali pogovornim opisom.

## TRDO PRAVILO — potrjena grafika ostane nedotaknjena

- Ko uporabnik potrdi grafiko ali izrazi zadovoljstvo z njo, je zaklenjena za vse prihodnje agente in pogovore.
- Pri popravkih okoliškega vmesnika (gumbi, krogci, kljukice, barve, besedilo, kontakti, razmiki) NIKOLI ne regeneriraj, zamenjaj, retuširaj, prebarvaj ali drugače spremeni potrjene grafike.
- Zaklenjeni so tudi njena izvorna datoteka, velikost, razmerje stranic, izrez, položaj, transformacije in način izrisa. Tudi navidezna izboljšava ozadja, ostrine ali anatomije ni dovoljena brez izrecne uporabnikove zahteve za spremembo te grafike.
- Spremeni samo zahtevani okoliški element. Po spremembi vizualno preveri, da sta grafika in njena postavitev ostali enaki potrjeni referenci.
- To pravilo obvezno posreduj podagentom in v predajah. Odobritev sprememb drugih elementov ni odobritev spremembe grafike.

Prodajni ščit: uporabnik je 4. 9. 2026 izrecno zahteval vrnitev grafike app/assets/jezomir-slusalke-v1.png (SHA256: 50E5AE760862237CFFEBB50DA8A54E0D7391AA4070EC14B312866CE1A8D8F798). Zaklenjena CSS postavitev .zascita-hero__slika: width 150px, left -15px, bottom -40px; od 440px width 165px, bottom -44px; brez mix-blend-mode. Ne zamenjaj z v2 in ne odstranjuj ozadja. Poznejše potrjene možnosti in dodajanje kontaktov ostanejo.
`nDopolnitev po izrecni uporabnikovi zahtevi: kvadratno ozadje v1 se skrije z zunanjo CSS masko assets/jezomir-slusalke-mask.svg. Izvirna PNG datoteka, velikost in položaj ostanejo nespremenjeni. To je dovoljena izjema samo za odstranitev ozadja, ne dovoljenje za regeneracijo lika.

## TRDO PRAVILO — brez pošiljanja grafik in posnetkov
- Uporabniku NE prikazuj in NE pošiljaj grafik, slik, mockupov ali posnetkov zaslona, razen če jih v aktualni zahtevi izrecno zahteva. Velja za vse agente in predaje.
- Interno preverjanje je dovoljeno; rezultat sporoči kratko v besedilu. Ne prikazuj slik prek emitImage, Markdown vdelav ali drugih uporabniku vidnih predogledov samo zaradi dokazovanja izvedbe.

## Lokalni predogled: obvezen omrežni dostop
- Strežnika na 8001 nikoli ne zaženi iz omejenega Codex sandboxa. Uporabi odobren require_escalated klic in Start-Process -WindowStyle Hidden v kanoničnem projektu. Ne spreminjaj varnostnih nastavitev.
- Zdrav strežnik ohrani. Ob EGRESS_UNAVAILABLE preveri identiteto vira in PID, ustavi samo potrjeni local-server.js tega projekta in ga ponovno zaženi z omrežnim dostopom. Nato zaženi npm run verify:local.
- Opozorilo ali blokada zagona nista popravek omrežnih pravic procesa.
- Za zgornji postopek uporabi scripts/start-local-preview.ps1 z require_escalated. Skripta ohrani zdrav proces in obnovi pokvarjenega.
