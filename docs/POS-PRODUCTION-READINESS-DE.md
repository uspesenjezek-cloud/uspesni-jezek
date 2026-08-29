# Nemški POS — produkcijska pripravljenost

Ta kontrola loči obvezno jedro od neobveznih integracij. Nobena kontrola ne
izpisuje vrednosti žetonov, ključev ali webhook skrivnosti.

## Lokalni pregled

```powershell
node scripts/check-pos-production-readiness.js
node scripts/check-pos-production-readiness.js --json
node scripts/check-pos-production-readiness.js --strict
```

`--strict` vrne neuspešen izhodni status, dokler ni pripravljenih vseh osem
obveznih kontrol. Sam zagon kontrole ne kliče zunanjih ponudnikov in ničesar ne
kupi ali aktivira.

## Osem obveznih kontrol

1. Supabase strežniška in javna konfiguracija.
2. Openapi v produkcijskem načinu, z ločenim produkcijskim webhookom in odprtim
   eksplicitnim zaklepom.
3. Pri Openapi potrjena produkcijska dostava finančnih popravkov tipa 381
   (Storno in Gutschrift). Popravljena pogodba z negativnimi zneski in obveznim
   `billing_reference` mora najprej prestati oba sandbox primera in končna stanja;
   do takrat je kontrola zaprta tudi, če bi bil račun tipa 380 pripravljen.
4. AWS S3 Object Lock v Frankfurtu z vključenim produkcijskim zapisovanjem.
5. Potrjen končni nemški davčni oziroma pravni pregled.
6. Potrjen pilot z dejanskim nemškim podjetjem in prejemnikom.
7. Produkcijski finAPI onboarding, pogodbeni/regulativni model in produkcijski ključi.
8. Produkcijski gotovinski tok z nameščeno checkout migracijo, produkcijskim fiskaly
   SIGN DE/TSS, zunanjo potrditvijo DSFinV-K, prijavo sistema in ločeno pravno
   potrditvijo gotovinskega obsega. Lokalni TRAINING/mock tok je dokončan.

Okoljska kontrola arhiva ni zadnji dokaz. Tik pred zagonom mora
`pos_archive_readiness` dodatno potrditi Object Lock, ločeno kopijo in uspešen
obnovitveni preizkus. Šele nato se ročno nastavi
`POS_ARCHIVE_S3_READINESS_CONFIRMED=true` skupaj s točnim
`POS_ARCHIVE_S3_READINESS_CONFIRMED_BUCKET` in največ 24 ur starim
`POS_ARCHIVE_S3_READINESS_CONFIRMED_AT`. Brez teh treh vezanih potrditev skupni
readiness ostane fail-closed tudi, če so vsi AWS ključi že prisotni; potrdila se ne
sme kopirati med predali ali ohraniti po preteku preveritvenega okna.

## Neobvezni moduli

- Openapi večpodjetniški onboarding je pripravljen, vendar sta plačljivo
  ustvarjanje in posodabljanje konfiguracij ločeno prikazana kot `cost_locked`.
- Openapi obnova izgubljenih webhookov je pripravljena, vendar je periodični GET
  zaradi možnega obračunavanja prav tako prikazan kot `cost_locked`.
- Resend je lahko rezervna neposredna e-poštna pot; primarna e-računska pot je
  Openapi.
- Stripe je trenutno namenoma samo TEST. SEPA in preverjena ročna potrditev
  plačila ostajata na voljo.
- finAPI je trenutno sandbox in je obvezen produkcijski del; ročni uvoz bančnega
  izpiska ni zadosten končni nadomestek.
- Lokalno usklajevanje finAPI fail-closed zavrne priliv z neznanim računom,
  nasprotujočo preslikavo računa ali isti transaction ID z drugačnimi podatki;
  povsem enako ponovitev pred uvozom varno deduplicira.
- DATEV Cloud je mock/sandbox. Preverljivi EXTF izvoz ostaja na voljo. Sandbox
  povezava uporablja PKCE in svež `nonce`, povratni `state` je časovno omejen ter
  dodatno vezan na isti brskalnik z `HttpOnly`, `Secure`, `SameSite=Lax` piškotkom.
  Podpis ID žetona, issuer, audience in `nonce` se preverijo prek omejenega DATEV
  OIDC discovery/JWKS toka, preden se povezava shrani.
  Mandant se šteje za povezanega samo v istem okolju in šele po točnem ujemanju
  Berater-/Mandantennummer ter servisa in scope-a Buchungsdatenservice.
- DATEV refresh žetoni so enkratni. Atomski, tenant-omejen DB claim serializira
  rotacijo; ob negotovem neuspehu se lokalna seja fail-closed prekine in zahteva
  novo povezavo. Polling EXTF opravila spoštuje ponudnikov `Retry-After`, preveri
  varno job URL, začasne napake obnovi z omejenim odmikom in po 30 minutah brez
  končnega stanja opravilo zaključi kot napako. Celoten DATEV kontni/EXTF preflight
  se izvede pred prvim zunanjim uploadom PDF-ja, zato napačne nastavitve ne morejo
  povzročiti delnega provider prenosa. Evidenci prenesenega PDF-ja in EXTF opravila
  sta vezani na točno okolje in DATEV client ID; mock ali drug mandant zato ne more
  povzročiti napačnega preskoka dejanskega prenosa. Redirect URL in obvezni scopes so preverjeni
  ob zagonu konfiguracije. POS pri aktivni povezavi pokaže Berater-/Mandantennummer,
  pri neuspelem zadnjem prenosu pa tudi omejeno ponudnikovo sporočilo napake.
  To so lokalne varovalke, ne dokaz DATEV sandbox ali produkcijske odobritve.
- fiskaly SIGN DE je TRAINING. Lokalni fail-closed checkout, mock TSE, Kassenbon,
  ločeno TSE-podpisano povračilo, pologi/dvigi in DSFinV-K model so pripravljeni in testirani. Migracija
  za checkout in podpisana povračila nista produkcijsko nameščeni, SIGN DE/TSS ni produkcijsko aktiviran, DSFinV-K model
  pa nima zunanje potrditve; zato gotovina ostaja obvezna, a blokirana produkcijska kontrola.

## Varni vrstni red aktivacije

1. Prejeti odgovor Openapi podpore iz `POS-OPENAPI-DE-381-SUPPORT-TICKET.md`
   preveriti z namenskim sandbox-only preizkusom: popolni Storno in delni dobropis
   morata sprejeti negativne zneske, pozitivno količino in `billing_reference` ter doseči končno
   uspešno stanje. Preizkus ne odpre produkcijske poti.
   Sprejemni skript končni stanji obeh dokumentov `381` preveri pri vsakem
   nadzorovanem teku, ne samo v ločenem reconciliation načinu.
2. Pridobiti produkcijski Openapi dostop brez spreminjanja kode.
3. Nastaviti samo produkcijske Openapi spremenljivke in pustiti sandbox
   skrivnosti ločene.
4. Potrditi AWS Object Lock in obnovitveni preizkus.
5. Izvesti en nadzorovan produkcijski račun z znanim prejemnikom.
6. Šele po pravnem pregledu in pilotu nastaviti ročni potrditvi
   `POS_DE_LEGAL_REVIEW_CONFIRMED=true` in `POS_DE_PILOT_ACCEPTED=true`. Vsaka mora
   imeti tudi čas potrditve (`..._CONFIRMED_AT` oziroma `..._ACCEPTED_AT`) in varno
   interno auditno referenco brez osebnih podatkov (`..._REFERENCE`). Goli boolean
   se ne šteje več kot dokaz.

Produkcijski zaklepi se ne odpirajo samo zato, ker so spremenljivke prisotne.
Vsaka zunanja aktivacija zahteva ločeno poslovno odločitev.

## Trenutni pregled Vercel Production (24. avgust 2026)

Pregled je preveril samo prisotnost imen nastavitev, ne njihovih skritih
vrednosti, in ni ničesar spremenil:

- Supabase jedro: tri zahtevana imena so prisotna.
- Openapi račun: Invoice API je bil 24. avgusta 2026 aktiviran; Early Access in
  DPA sta potrjena za podpisnika Bojan Dimic. Dobroimetje je ostalo 0 € in ni
  aktivne naročnine.
- Openapi integracija: produkcijska webhook skrivnost je prisotna; manjkajo
  dolgoročni produkcijski žeton, njegov datum poteka, `OPENAPI_INVOICE_MODE`,
  `POS_OPENAPI_INVOICE_ENABLED`, `OPENAPI_INVOICE_SEND_ENABLED`,
  `OPENAPI_INVOICE_WEBHOOK_URL` in potrjen javni
  callback preflight. Produkcijska dostava zato ostaja zaprta.
- Openapi konzola: read-only pregled je potrdil aktiven Invoice API in
  dobroimetje 0 EUR. Obstoječi namenski sandbox žeton je veljaven do
  24. novembra 2026. Vercel Preview ga že ima kot zaščiteno spremenljivko
  skupaj s sandbox načinom, testno fiskalno oznako ter ločenima webhook URL-jema
  in skrivnostma; produkcijsko okolje žetona nima. Dva vidna produkcijska žetona
  sta kratkotrajna in potečeta 25. avgusta 2026, zato nista primerna za
  strežniško integracijo. Privzeti konzolni seznam konfiguracij podjetij je
  prazen. Pri pregledu žetoni niso bili razkriti, kopirani ali posredovani.
- Openapi finančni popravki: podpora je 26. avgusta 2026 potrdila in po svojih
  navedbah odpravila nasprotje validatorjev za tip 381. Popravljena pogodba zahteva
  negativne zneske, pozitivno količino in korenski `billing_reference`. Nadzorovani
  sandbox preizkus je nato potrdil popolni Storno in delni dobropis v stanju
  `SENT / succeeded`. Posebni provider-conflict zaklep je odstranjen, produkcijski
  tip 381 pa ostaja zaprt skupaj z vsemi splošnimi Openapi produkcijskimi varovalkami.
- Openapi večpodjetniški onboarding in usklajevanje izgubljenih callbackov sta
  implementirana, vendar njuni plačljivi stikali ostajata izključeni in ju
  poročilo jasno označi kot `cost_locked`.
- WORM arhiv: produkcijska S3/Object Lock imena še niso prisotna.
- Resend: osnovna imena in webhook so prisotni, vendar produkcijski vklop ni
  nastavljen. Ta pot ostaja neobvezna.
- Pravna potrditev in sprejet pilot še nista označena kot zaključena.

To je varen položaj pred produkcijskim zagonom: obstoječi sandboxi delujejo,
plačljivi oziroma živi zunanji moduli pa niso samodejno vključeni.

## Zaključni tehnični deployment Openapi (24. avgust 2026)

- šest čakajočih POS migracij, vključno s sledljivostjo Openapi usklajevanja, je
  izvedenih v povezani Supabase bazi; čakalna vrsta migracij je prazna;
- Vercel Preview deployment `dpl_4mbo2J6FqZE4b3HsHpBm7Cd9Kpqc` je `READY` in
  stalni testni naslov `https://uspesni-jezek-openapi-test.vercel.app` kaže nanj;
- produkcijski deployment in produkcijski naslov nista bila spremenjena;
- testni naslov vrne POS HTML z HTTP 200, zaščiten Openapi handler pa brez
  uporabniškega žetona pravilno vrne HTTP 401;
- v namestitvi je 11 funkcij, zaključni Vercel error-log pa je prazen.
- uradni OAS nadzor dodatno preverja obe B2G polji (`leitweg_id` in
  `buyer_reference`) ter diagnostično spremlja pravilo pozitivnega zneska in
  status `billing_reference` (`documented` ali `support_only_undocumented`);
- namenski sandbox sprejemni skript je razširjen z ločenim B2G računom tipa 380,
  zato je pripravljen za ponovni zunanji preizkus B2B, B2G, Storna in delnega
  dobropisa takoj po odgovoru ponudnika.

Tehnična integracija ter varni sandbox/Preview tok sta s tem zaključena. Celoten
produkcijski zagon ostaja namenoma ločena faza zaradi dolgoročnih produkcijskih
poverilnic, javnega callback preflighta, WORM Object Locka, pravnega pregleda in
pilotne potrditve. Posebna ponudnikova blokada tipa 381 je bila po spodaj opisanem
sandbox dokazu odstranjena; splošnih produkcijskih varovalk to ne spremeni.

## Naknadna kontrola javne dosegljivosti (24. avgust 2026)

Stalni Openapi Preview alias še kaže na deployment `dpl_4mbo2J6FqZE4b3HsHpBm7Cd9Kpqc`,
vendar neavtenticiran GET trenutno vrne Vercel SSO preusmeritev (HTTP 302), POST
preflight pa JSON 401 `Protected deployment`. Prijavljeni Vercel konektor zato ni
zadosten dokaz za zunanji webhook. Produkcijski URL je javen, a njegov novejši
deployment za `handler=openapi-invoice` vrača HTTP 404; produkcije se zaradi tega
ne spreminja in se je ne uporablja kot obvoz.

Sandbox sprejemni skript zdaj pred kakršnimkoli ponudnikovim zapisom zahteva
javno callback pot in pričakovano aplikacijsko zavrnitev neavtenticiranega,
namerno nepopolnega dogodka. Preflight ne pošlje nobene poverilnice. Dokler ne
uspe, je ponovni zunanji tek 380/381/B2G dodatno fail-closed. Nobeno produkcijsko
ali plačljivo stikalo zaradi te ugotovitve ni bilo odprto.

## Odgovor podpore in lokalni popravek (25. avgust 2026)

Podpora je zahtevala pozitivne korenske vsote, pozitivne postavke in cene ter za
tip `381` korenski `billing_reference` s številko in datumom izvirnega računa.
Lokalni adapter polje zdaj doda samo tipu `381` iz zaklenjenega snapshot-a in ob
manjkajoči ali neveljavni vrednosti odpove pred omrežnim klicem. Tip `380`, nemška
19-odstotna davčna preslikava in produkcijski zaklep niso spremenjeni.

Uradni OAS URL je pri neposrednem preverjanju vračal cache/legacy pogodbo `1.1.0`
brez `billing_reference` in s starim pozitivnim pravilom. Nova pogojna oblika zato
ni neodvisno dokazana z javnim OAS; temelji na odgovoru podpore in nadzorovanem
sandbox dokazu.

Ponovni sandbox preizkus 25. avgusta 2026 je najprej uspešno sprejel pripadajoči
original tipa `380` (HTTP `200`; pozneje `SENT` / `succeeded`). Pozitiven popolni
Storno tipa `381` z `billing_reference`, pozitivnimi vrsticami in 19-odstotnim DDV
je tudi po uskladitvi reference z dejansko sprejetim sandbox `document_number`
vrnil HTTP `422`: `cannot send this type for a positive amount`. Zavrnjeni
`381` ni ustvaril ponudnikovega zapisa; preizkus se je varno ustavil pred delnim
dobropisom. Produkcijski zaklep je zato na tej zgodovinski točki ostal zaprt do
novega nadzorovanega preizkusa.

## Drugi odgovor podpore in popravljena pogodba (26. avgust 2026)

Podpora je potrdila, da je bil konflikt napaka na njihovi strani. Po popravku tip
`380` uporablja pozitivne zneske, tip `381` pa negativne korenske vsote, negativna
`unit_price` in `total_net_amount` ter negativne zneske `tax_subtotals`; `quantity`
ostane pozitivna. `billing_reference.document_number` in `issue_date` sta za tip
`381` obvezna, številka pa se mora ujemati z `document_number` oddanega originala.
Po navedbah podpore sandbox in produkcija uporabljata isto aplikacijsko pogodbo.

Adapter je bil lokalno usklajen in pred izdelavo zahtevka preveri predznake, vsote
ter ujemanje reference. To samo po sebi ni bilo dovoljenje za zunanji klic: pred
poznejšim uspešnim dokazom z 26. avgusta 2026 sta običajna in produkcijska pot tipa
`381` ostali fail-closed.

Ločen
callback preflight na stalnem Previewu še vedno zahteva javno dosegljiv aplikacijski
HTTP 401; dokler ga Vercel deployment protection blokira, smoke test ne sme ustvariti
novega oddaljenega dokumenta.

## Lokalna utrditev dostave in usklajevanja (25. avgust 2026)

- Nova migracija popravi lifecycle invariant: status `sent` ima po uspešnem provider
  POST-u veljavno referenco, prvi providerjev čas dogodka pa sme ostati prazen do
  callbacka. S tem zaključna funkcija Openapi/Resend ne trči več ob starejšo omejitev.
- Druga migracija vsak reconciliation poskus atomsko rezervira pred provider GET-om,
  zato sočasni workerji istega plačljivega poskusa ne morejo podvojiti. Ohranijo se
  šesturni razmik, zgornja meja sedmih poskusov in service-role-only auditni zapis
  tudi ob omrežni ali providerjevi napaki.
- Obe migraciji sta pripravljeni samo lokalno in še nista nameščeni v povezano bazo;
  produkcija, Openapi konfiguracija in plačljiva reconciliation stikala ostajajo
  nespremenjeni oziroma zaprti.
- Celoten `npm run test:pos` je po spremembah uspešen; Vercel funkcijski proračun
  ostaja 11/12.
- `liveEnabled` zdaj dodatno zahteva
  `OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED=true`. Trenutni produkcijski
  404 in Preview protection tega potrdila ne izpolnjujeta, zato ni nastavljeno.
  Potrdilo je vezano na natančen callback URL in velja največ 24 ur.

## Rezultat nadzorovanega sandbox preizkusa (26. avgust 2026)

Openapi sandbox je sprejel popolni Storno in delni dobropis tipa `381` z
negativnimi korenskimi, vrstičnimi, davčnimi in plačilnimi zneski, pozitivno
`quantity` ter natančnim `billing_reference`. Oba sta dobila ponudnikovi referenci.
Poznejši omejeni read-only pregled je pri obeh vrnil `SENT / succeeded`. Po uradnem
ponudnikovem statusu in lokalno preverjeni preslikavi `succeeded` pomeni uspešno
dostavo ter namenoma ostane v makro stanju `SENT`, zato sandbox dokaz ne čaka več
na `DONE`.

Pet odobrenih testnih zapisov je bilo ustvarjenih samo v sandboxu. B2G primer je
bil po uskladitvi z uradnim OAS Leitweg-ID prav tako sprejet. Po izrecni odobritvi
je posebni Type 381 provider-conflict blocker odstranjen iz produkcijske poti.
`financialAdjustmentsEnabled` postane `true` samo skupaj z `liveEnabled`, zato tip
`381` še vedno zahteva vsa splošna produkcijska stikala, svež žeton, veljaven
webhook in javni webhook preflight. Začasni Preview bypass, probe handler in probe
env spremenljivki so odstranjeni oziroma preklicani. Nobeno produkcijsko stikalo
ni bilo odprto in produkcija ni bila objavljena.

Podatkovna plast ima migracijo za končni status
`SENT / succeeded`: v produkcijskem načinu ga preslika v `delivered`, v sandboxu
pa ohrani `test_completed`. Enaka pot ustavi nadaljnje plačljive reconciliation
poskuse in deluje tudi ob neposrednem končnem odgovoru ponudnika. Po izrecni
odobritvi 26. avgusta 2026 je bila samo migracija `20260826131305` nameščena v
povezano Supabase bazo in zabeležena v oddaljeni zgodovini. Njeni funkciji sta bili
read-only preverjeni, vključno s prepovedjo izvajanja za `anon` in `authenticated`
ter dovoljenjem za `service_role`. Pet drugih čakajočih migracij je ostalo
nedotaknjenih in jih deployment varovalka še vedno blokira.

Read-only contract watchdog preveri osnovno strukturo trenutno vrnjenega javnega
OAS, vendar cache/legacy `1.1.0` ni dokaz novega pogojnega Type 381 contracta.
Ločeni kontrolirani sandbox dokaz je `complete: true` in `successful: true`,
avtomatsko odklepanje iz samega javnega OAS pa ostaja onemogočeno. Readiness v9
dodatno preveri nespremenjen SHA-256
dokaza, identiteto dveh različnih `381` primerov, skupni smoke-run ID in časovno
bližino ponudnikovih dogodkov. Spremenjena ali ročno sestavljena fixture se ne šteje
več kot uspešen provider dokaz in vrne `controlled_sandbox_381_evidence_invalid`.

Readiness v10 pri prisotnem, vendar prekratko veljavnem produkcijskem žetonu ter
starem ali prihodnjem javnem webhook preflightu dodatno navede točno neveljavno
časovno okoljsko polje. Produkcijski zaklep je bil že prej fail-closed; sprememba
izboljša operativno diagnostiko in ne odpira nobene dostavne poti.
