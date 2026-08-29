# Trajna pravila projekta Uspešni Ježek

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

## Trajni jezik rednih UI-ikon

- Za redne in ponavljajoče se ikone uporabi obstoječi kanonični register oziroma najbližji potrjeni FATHER; ne ustvarjaj vzporednega sistema ikon.
- Osnovna geometrija je `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap="round"` in `stroke-linejoin="round"`. Prikazna velikost se lahko prilagodi komponenti.
- Potrjeni FATHER za kljukico je pot `M20 6 9 17l-5-5`; potrjeni FATHER za desni chevron je pot `m9 18 6-6-6-6`.
- Posebni CTA-gumbi, statusni znaki, ilustracije in namensko drugačni vizualni sklopi niso samodejno predmet poenotenja. Kadar namen odstopanja ni nedvoumen, pred spremembo vprašaj uporabnika.
- Nova redna ikona mora slediti temu jeziku tudi, če še ni bila ročno razvrščena v katalogu.

To je trajna oblikovna odločitev za vse prihodnje redne UI-ikone.

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

## Atena v6 — univerzalni vnosni engine

- `Atena` je kanonično ime skupnega enginea, njegova trenutna sistemska različica pa je `atena-v6`. Z njim obrtnik dogodke opiše z besedilom ali glasom, jih po potrebi izbere ročno, pregleda pripravljene strukturirane dogodke in jih šele nato varno potrdi.
- Atena je ena skupna implementacija, ki se vgrajuje v različne tokove (med drugim zgodovina računa, predaja odvetniku in »Bo plačal«); ne izdeluj ločenih kopij ali vzporednih različic.
- Privzeti način je »Povej ali napiši«, »Ročno izberi« je enakovreden rezervni način. »Povej na glas« je jasen samostojen sekundarni gumb, »Pripravi dogodke« pa primarni turkizni gumb.
- Zgornja akcija se imenuje »Ponastavi« in uporablja ikono krožne ponovitve, ne koša. Razdelek pod vnosom se imenuje »Pripravljeni dogodki« in je brez praznega telesa kompakten; razširi se šele, ko dogodki obstajajo.
- Prazen zaključni prehod je vizualno sekundaren in se v zgodovinskem toku glasi »Nadaljuj brez zgodovine →«. Ko dogodki obstajajo, lahko gostiteljski tok uporabi močnejši kontekstni CTA.
- Gostiteljski tok določa naslov, dovoljene kartice in končno dejanje, Atena pa povsod ohrani isti vizualni jezik, izolirano stanje posamezne vgradnje ter varen pregled pred zapisom.

To je trajna produktna in oblikovna definicija za vse prihodnje pogovore v tem projektu; izraz `Atena` vedno pomeni zgornji skupni engine.
