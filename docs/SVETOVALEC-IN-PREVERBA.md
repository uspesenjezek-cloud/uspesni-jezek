# Svetovalec in preverba — Kategorija 3

Kategorija 3 na strani **Zaščita posla** je storitev **Svetovalec in preverba**.
Obrtnik lahko primer opiše Ateni z besedilom ali glasom, doda ponudbo ter nato
začne preverbo. Vsak rezultat mora pred izvedbo dejanja pregledati človek.

## Storitve

1. Preverite ponudbo.
2. Preverite naročnino.
3. Pogajajte se ali odpovejte.
4. Uredite mi ponudbe.
5. Vas kliče prodajalec?

Pri vstopu v **Preverite ponudbo** ostaneta izbrano podjetje in Atena na vrhu,
pod njima pa uporabnik izbere eno ali več področij: cena in stroški, obseg
ponudbe, plačilo in roki, pogodbeni pogoji, garancija ter tveganja. Ko uporabnik
začne pisati Ateni, se te kartice strnejo, da ostane več prostora za opis.

Iskanje delavcev in optimizacija poslovanja nista del te kategorije, ker imata
ločena produktna tokova. Odpoved, pogajanje ali drugo dejanje v imenu obrtnika
se izvede samo po njegovi izrecni potrditvi.

## Skupni tok petih storitev

`app/svetovalec-storitve-engine.js` razširi preverjeni modularni vzorec ponudbe
na naročnine, pogajanje oziroma odpoved, pridobivanje ponudb in prodajni klic.
Vsaka storitev ima lasten katalog področij, vprašanj, polj, besedil in barvno
temo, uporabniški vmesnik pa uporablja skupni večkorakovni izris, validacijo,
Atenino priporočilo, pregled odgovorov, urejanje in končno potrditev.

- naročnina: storitev in uporaba, stroški, trajanje in podaljšanje, sprememba
  ali izstop ter spremembe in dokazila;
- pogajanje ali odpoved: cilj in prioritete, trenutno izhodišče, pogajalski
  okvir, priprava odpovedi ter sporočilo in dokazila;
- pridobivanje ponudb: potreba in rezultat, obseg in zahteve, proračun in
  plačilo, rok in izvedba ter ponudniki in izbor;
- prodajni klic: klicatelj, predmet ponudbe, cilj in meje, varnost klica ter
  povratni stik.

Osnutki so ločeni po storitvah (`uj_svetovalec_<koda>_osnutek_v1`), zato
preklop med kategorijami ne prepiše odgovorov drugega toka. Barva izvorne
kartice se prenese v področja, obrazec, pregled in potrditev ter se ob izhodu
počisti.

Vprašanja zbirajo cilj, dejstva, roke, zneske, omejitve in dokazila. Ne
izbirajo prezgodaj pravnega načina izvedbe odpovedi, vročitve ali drugega
strokovnega ukrepa; to ostane odločitev strokovnjaka po pregledu pogodbe in
potrjenih odgovorov uporabnika.
# Modularni pregled ponudb

Stran »Preverite ponudbo« uporablja enoten ID-katalog iz `app/ponudba-moduli-engine.js`. Katalog je pogodba med ročnim obrazcem, podatkovno bazo in semantičnim adapterjem za Luno; oznake se lahko spremenijo, numerični ID-ji pa ostanejo stabilni. Tudi ta tok uporablja skupno metodo `luna-compositional-reasoning-v1`: celoten opis se pred izbiro ID-jev razdeli na vse samostojne pomene in njihove logične povezave, nato se preveri pokritost vsake materialne klavzule.

- družine ponudnikov: `101–116`;
- konkretni profili ponudnikov: `1001–1043`;
- oblike ponudbe oziroma pogodbe: `2001–2015`;
- prodajni kanali: `3001–3012`;
- Lego moduli pregleda: `4000–4027` (`C00–A01`, skupaj 28 enot);
- polja modulov: stabilni ID-ji `5001–5702` z namenskimi vrzelmi.

Panoga ponudnika, pogodbeni model in prodajni kanal so ločene osi. Hladni klic je zato kanal `3005`; profil telemarketing `1023` se uporabi le, kadar je telemarketing dejanski predmet ponudbe.

Šest vidnih kartic je vstop v področja, ne šest velikih obrazcev. Klik odpre zaporedje relevantnih Lego modulov kot kompaktne Father kartice; naenkrat je aktiven en korak, uporabnik pa se lahko vrne, spremeni kontekst in ponovno odpre shranjene odgovore. `sestavi()` glede na profil, pogodbeni model, kanal in izbrane module vrne deterministično urejen seznam polj. Osnutek se lokalno hrani pod ključem `uj_svetovalec_ponudba_osnutek_v1`; trajna uporabniška hramba je pripravljena v migracijah `20260829210652_ponudba_modularni_katalog.sql` in `20260829223000_offer_lego_modules_v2.sql`.

Vsako področje vsebuje samo najnujnejša preverljiva vprašanja in nikoli več kot šest korakov: cena `4`, obseg `6`, plačilo in roki `3`, pogodbeni pogoji `4`, garancija `2`, tveganja `6`. Besedilo vprašanj je del istega kanoničnega kataloga kot moduli in polja; UI nima ločenega vzporednega seznama vprašanj.

Po vprašanjih ima vsako področje še ločen zaključni korak **Potrditev**. Področje s šestimi vprašanji zato prikaže sedem kompaktnih krogov; zadnji odpre pregled zbranih odgovorov in šele nato omogoči dokončno potrditev področja.

`api/_lib/ponudba-luna-engine.js` pripravi strogo JSON-pogodbo `ponudba-luna-id-contract-v4` za `gpt-5.6-luna` in sprejme samo celovit predlog z znanimi, enoličnimi in medsebojno združljivimi ID-ji ter dejstvi z dobesednim dokaznim izsekom iz izvornega opisa. Neznan ali podvojen ID, manjkajoč modul, nepovezano ali podvojeno dejstvo ter dodatno polje zavrnejo celoten predlog; adapter ne razglasi delnega rezultata za uspeh. Vsa modelna dejstva imajo `requiresHumanReview: true`. Novi zunanji prenos uporabnikovega opisa ni samodejno vključen; adapter ima lokalni deterministični načrt, dokler ni na konkretni poti urejena privolitev in politika hrambe.
