# Openapi Invoice za nemške e-račune

Stanje ponudnika 24. avgusta 2026: Invoice API je aktiven, Early Access in DPA
sta potrjena. Ni aktivne naročnine in stanje denarnice je 0 €. Aktivacija sama
ni odprla produkcijskega zaklepa v POS kodi.

POS uporablja obstoječi dostavni predal in konsolidirano funkcijo
`/api/pos?handler=openapi-invoice`. Nova samostojna Vercel funkcija ni potrebna.

## Načini in okoljske spremenljivke

Sandbox:

```text
OPENAPI_INVOICE_TOKEN=<sandbox-token>
OPENAPI_INVOICE_MODE=sandbox
OPENAPI_INVOICE_WEBHOOK_SECRET=<naključna skrivnost z vsaj 32 znaki>
OPENAPI_INVOICE_WEBHOOK_URL=https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1
OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET=<ločena sandbox skrivnost z vsaj 32 znaki>
OPENAPI_INVOICE_SANDBOX_WEBHOOK_URL=https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1&sandbox=1

Za enkratno strežniško sinhronizacijo obstoječe sandbox konfiguracije se lahko začasno nastavi `OPENAPI_INVOICE_SYNC_TOKEN`; po uspešnem PATCH klicu se mora takoj odstraniti.
OPENAPI_INVOICE_SANDBOX_FISCAL_ID=<unikatna testna DE USt-IdNr. za Openapi sandbox>
```

Sandbox in produkcija namenoma nimata rezervnega skupnega webhook ključa. Za
sandbox morata obstajati obe nastavitvi z oznako `SANDBOX`; produkcijska skrivnost
se nikoli ne uporabi na sandbox URL-ju ali obratno.

`OPENAPI_INVOICE_SANDBOX_FISCAL_ID` se uporabi samo pri testnih računih v
sandbox načinu. Produkcijski način jo vedno ignorira in uporabi zaklenjeno pravno
USt-IdNr. izdajatelja iz računa. Ločena oznaka prepreči konflikt s skupnimi
primeri, kot je `DE123456789`, ki so lahko v Openapi sandboxu že registrirani.
Številka dokumenta je v sandboxu dopolnjena s stabilno interno oznako računa,
zato dva uporabnika z enako testno številko ne moreta pomotoma prevzeti istega
oddaljenega računa. Produkcijska pravna številka ostane nespremenjena.

Produkcija je namenoma zaklenjena z ločenimi neodvisnimi nastavitvami:

```text
OPENAPI_INVOICE_TOKEN=<production-token>
OPENAPI_INVOICE_TOKEN_EXPIRES_AT=2027-08-24T00:00:00Z
OPENAPI_INVOICE_MODE=production
POS_OPENAPI_INVOICE_ENABLED=true
# Zadnje ročno dovoljenje za dejansko produkcijsko oddajo; do ločene odobritve ostane false:
OPENAPI_INVOICE_SEND_ENABLED=false
OPENAPI_INVOICE_WEBHOOK_SECRET=<ločena produkcijska skrivnost z vsaj 32 znaki>
OPENAPI_INVOICE_WEBHOOK_URL=https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1
# Nastavi na true šele po svežem anonimnem preflightu, ki vrne aplikacijski 401:
OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED=false
OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL=
OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT=
# Samo po ločeni poslovni odobritvi za plačljiv konfiguracijski klic:
OPENAPI_INVOICE_ALLOW_CONFIGURATION_CREATE=false
OPENAPI_INVOICE_ALLOW_CONFIGURATION_UPDATE=false
# Samo po odobritvi periodičnih GET klicev:
OPENAPI_INVOICE_RECONCILIATION_ENABLED=false
```

Če obe produkcijski stikali, sveži javni preflight in podpisani webhook niso
popolnoma potrjeni, se produkcijska dostava ne vključi.
Žeton je samo strežniška skrivnost in ne sme biti dodan v `app/config.js`, git ali
odjemalsko kodo.

Produkcijski OAuth v2 žeton mora imeti ob vklopu še najmanj sedem dni
veljavnosti. Openapi dovoljuje največ enoletni TTL; datum poteka se zapiše v
`OPENAPI_INVOICE_TOKEN_EXPIRES_AT`. Kratkotrajnega žetona iz konzole se ne sme
uporabiti kot trajne produkcijske poverilnice.

## Podprti tok

- B2B: arhivirani PDF in podatki računa se oddajo Openapi za nemški ZUGFeRD tok.
- B2G: KoSIT potrjeni XRechnung podatki in Leitweg-ID se oddajo Openapi.
- En Openapi račun lahko uporablja več nemških pravnih oseb; konfiguracija se
  preveri po nemški USt-IdNr. izdajatelja. V sandboxu se lahko ustvari samodejno.
  V produkciji sta ustvarjanje in posodabljanje privzeto zaklenjena; vsako stikalo
  se odpre samo po ločeni poslovni odobritvi. Neujemanje nespremenljive e-pošte
  vedno ustavi dostavo, namesto da bi povezalo napačno pravno osebo.
- Pred oddajo in po nejasnem odgovoru se po številki dokumenta ter USt-IdNr.
  preveri, ali račun pri ponudniku že obstaja.
- Podpisani callback vsebuje tudi strogo ločen sandbox/production kontekst.
  Starejši dogodki ne morejo prepisati novejšega stanja, sandbox dogodki pa ne
  ustvarijo produkcijskih oznak `sent` ali `delivered`.
- Lokalni čas uspešne oddaje ni ponudnikov časovni žig. Prvi pravi callback zato
  vedno vzpostavi Openapi časovno mejo; tudi callback, ustvarjen tik pred lokalnim
  zapisom oddaje in prejet nekaj trenutkov pozneje, se pravilno obdela.
- Če je `OPENAPI_INVOICE_RECONCILIATION_ENABLED=true`, isti dnevni dostavni cron
  preveri največ tri stare oddaje skupaj z običajnimi opravili. Posamezno dostavo
  preveri največ sedemkrat, med preverjanji počaka najmanj šest ur in po `DONE`
  ali `ERROR` preneha. S tem se izgubljeni callback obnovi, število plačljivih GET
  klicev pa je omejeno in zapisano v dostavi. Tudi neuspešen omrežni ali providerjev
  GET porabi enega od sedmih poskusov in dobi auditni zapis, zato trajna zunanja
  napaka ne more povzročiti neomejenega pollinga. Poskus se atomsko rezervira pred
  providerjevim GET-om; `FOR UPDATE SKIP LOCKED` in šesturni lease preprečita, da bi
  dva sočasna workerja porabila isti proračunski poskus z dvema zunanjima klicema.

Storno in delni dobropis sta lokalno preslikana kot Openapi tip `381`. POS ju gradi
iz nespremenljivega arhiviranega dokumenta, z ločeno številko in jasno referenco na
izvirni račun v prvi postavki. Izvirna referenca je dodatno zapisana v arhiviranem
UBL XML/PDF dokumentu. Po odgovoru podpore 25. avgusta 2026 vsebuje zunanji payload
tipa `381` tudi korenski objekt `billing_reference` z `document_number` in
`issue_date` iz `snapshot.original_invoice`; če katera vrednost manjka ali datum ni
veljaven `YYYY-MM-DD`, preslikava odpove pred omrežnim klicem. Po popravku, ki ga je
ponudnik potrdil 26. avgusta 2026, so korenske vsote, vrstični `unit_price` in
`total_net_amount` ter zneski v `tax_subtotals` negativni; količina ostane pozitivna.
Pri davčni ničli ostane matematična ničla `0`. Nemška davčna preslikava ostane
nespremenjena. Zaklenjene notranje delte za Storno in dobropis morajo biti že
negativne (davek sme biti `0`); adapter napačnega pozitivnega notranjega dokumenta
ne normalizira, ampak ga zavrne pred omrežjem. V
sandboxu se referenčna številka pretvori z isto stabilno predpono `SBX-…` kot
dejansko oddani original; v produkciji ostane pravna številka nespremenjena.

Podpora je sporočila, da je javni OAS usklajen z novim pogojnim pravilom predznaka
in dokumentira `billing_reference`. Lokalni adapter tega ne šteje za zunanji dokaz:
običajna oddaja tipa `381` in vsa produkcijska uporaba ostajata fail-closed; dovoljen
je samo ozko potrjen
sandbox-only capability probe, ki mora posebej dokazati popolni Storno in delni
dobropis ter njuni končni stanji.

Nefinančna Rechnungsberichtigung (UBL tip `384`) ni poslana prek Openapi, ker
ponudnikov model trenutno sprejme samo tipa `380` in `381`. Tak popravek ostane v
obstoječem KoSIT-validiranem dostavnem toku. Če je potreben nov finančni dokument,
se uporabi Storno in nadomestni račun; POS ne sme popravka tipa `384` lažno poslati
kot nov račun tipa `380`.

Prejeti računi (`supplier_invoice` in dogodek `supplier-invoice`) so ponudnikova
ločena funkcija za nabavno knjigovodstvo. Namenoma niso vključeni v prodajni POS
tok; pred vklopom potrebujejo ločen vhodni arhiv, preverjanje priponk, tenant
izolacijo in računovodski potrditveni postopek.

Integracija ne vsebuje nobenega klica za nakup, naročnino, polnjenje denarnice ali
potrditev plačila pri Openapi. Aktivacija in obračunavanje sta vedno zunaj kode POS.

## Stroški in pogodbeni nadzor

Prijavljeni uporabnik lahko prebere oceno lastne porabe z
`GET /api/pos?handler=openapi-invoice&usage=1`. Ocena šteje samo produkcijske
oddaje z referenco, dva običajna predhodna GET klica na sprejeto oddajo in dejansko
izvedena usklajevalna preverjanja. Privzete cene so
javni pay-as-you-go zneski (POST račun 0,09 EUR, GET račun 0,001 EUR in ustvarjanje
konfiguracije 1 EUR); prilagodijo se lahko z `OPENAPI_INVOICE_POST_PRICE_EUR`,
`OPENAPI_INVOICE_GET_PRICE_EUR`, `OPENAPI_INVOICE_CONFIGURATION_PRICE_EUR` in
`OPENAPI_INVOICE_COST_PLAN`. Ustvarjanje konfiguracij v oceno namenoma ni vključeno,
ker ga trenutna dostavna vrstica ne meri in je v produkciji privzeto zaklenjeno.

`npm run check:openapi-contract` prenese uradni OAS in semantično preveri uporabljene
DE operacije, obvezna polja, tipa `380/381`, obe B2G usmerjevalni polji ter
callback `customer-invoice`. Watchdog razreši tudi lokalne OAS `$ref` in sestavljene
`allOf`/`oneOf`/`anyOf` sheme. Diagnostično loči pozitivni contract tipa `380` od
negativnih korenskih, vrstičnih in davčnih zneskov tipa `381`, pozitivne količine ter
pogojno obveznega `billing_reference.document_number` + `issue_date`. Starejša
strežena OAS oblika ostane označena kot `legacy_or_undocumented`; tudi popolnoma
zaznana nova oblika vrne `providerUnlockEligible: false`, dokler manjkata uspešna
nadzorovana sandbox dokumenta in njuni končni stanji. Watchdog zato ne more sam
odpreti providerja. Enako preverjanje teče v CI in nezdružljiva delno objavljena
pogodba povzroči fail-closed napako.

## Stanje sprejemnega preizkusa

Lokalni regresijski preizkus preslikave `380/381` je uspešen. Openapi sandbox je
24. avgusta 2026 sprejel dva testna originala tipa `380`: `TEST-2026-0010` in
`TEST-2026-0011`. Pri drugem je POS zabeležil celoten tok `prepared`, `queued`,
`processing`, `completed` ter končno stanje »Sandbox abgeschlossen«; prejemnik
ni prejel pravnega računa. S tem je potrjena dejanska povezava POS, ponudnika in
povratnega stanja za tip `380`.

Za `TEST-2026-0011` je izdan tudi `TEST-ST-2026-0003`; njegov PDF in XML sta
arhivirana, XML je uspešno prestal KoSIT. Pri ponovnem nalaganju računa je bila
odkrita in regresijsko odpravljena izguba rezervne vrednosti `customer_type`,
zaradi katere je odjemalec za finančni popravek napačno ponudil e-poštni test.
Nadzorovani zunanji preizkus je nato odkril ponudniško blokado. Openapi sandbox je
popolni Storno `TEST-ST-2026-0003` tipa `381` s pozitivnim zneskom `1,19 EUR`
zavrnil z odgovorom HTTP `422`, da tega tipa ni dovoljeno poslati za pozitiven
znesek. Enako je zavrnil ločen delni dobropis tipa `381` za `0,60 EUR`. Poskus z
negativnim skupnim zneskom je prav tako vrnil HTTP `422`, ker uradna DE shema
zahteva, da je `total_amount_including_tax` večji od nič. Za noben zavrnjeni
dokument tipa `381` ni nastal ponudnikov zapis.

Openapi podpora je 25. avgusta 2026 pojasnila, da so bili pozitivni zahtevki
zavrnjeni zaradi manjkajoče obvezne reference, in poslala obliko
`billing_reference.document_number` + `billing_reference.issue_date`. Odgovor je
prejet in lokalno regresijsko podprt, vendar aktualni OAS polja ne vsebuje.

Ponovni nadzorovani sandbox preizkus 25. avgusta 2026 je poslal pozitiven popolni
Storno tipa `381` z zahtevanim `billing_reference`, pozitivnimi korenskimi in
vrstičnimi zneski ter 19-odstotnim DDV. Predhodni original tipa `380` je bil sprejet
z HTTP `200`; pri končni ponovitvi je bila referenčna številka enaka njegovemu
dejansko sprejetemu sandbox `document_number`. Openapi je Storno kljub temu znova
zavrnil z HTTP `422` in razlogom
`cannot send this type for a positive amount`. Za zavrnjeni Storno ni nastal
ponudnikov zapis. Preizkus se je fail-closed ustavil pred drugim originalom in
delnim dobropisom, zato delni primer po prejetem navodilu ni bil poslan.

Drugi odgovor podpore 26. avgusta 2026 je potrdil ponudniško napako: shema je prej
zahtevala pozitivni total, spodnji validator pa je za tip `381` zavračal pozitiven
znesek. Ponudnik je po navedbah podpore popravil pogodbo tako, da tip `380` uporablja
pozitivne, tip `381` pa negativne korenske, vrstične in davčne zneske. Za `381` je
zdaj obvezen `billing_reference.document_number` skupaj z `issue_date`; številka se
mora ujemati z `document_number` oddanega originala. Lokalna preslikava in regresije
so usklajene s tem pravilom.

V tej zgodovinski fazi je POS običajno zunanjo oddajo zavrnil pred omrežnim klicem
in ni preklopil na drugega ponudnika; lokalni davčni dokument, KoSIT dokaz in arhiv
so ostali nespremenjeni. Zahtevani poznejši nadzorovani sandbox dokaz je opisan v
razdelku »Nadzorovani sandbox dokaz po ponudnikovem popravku (26. avgust 2026)«.

## Vklop

1. Pridobi sandbox žeton v Openapi računu in ga dodaj samo v Preview/Development.
2. Nastavi `OPENAPI_INVOICE_MODE=sandbox`; produkcijski zaklep pusti izključen.
3. Izdaj testni B2B in testni B2G račun ter preveri referenco in stanje v Openapi.
   Sprejemni skript `scripts/smoke-pos-openapi-sandbox-live.js` dodatno ustvari
   dva ločena B2B testna originala, njuna Storno in delni dobropis ter ločen B2G
   testni račun z Leitweg-ID. Pred vsakim
   zunanjim zapisom zahteva sandbox način, zaprt live način in ločen sandbox
   webhook; pričakovano zaporedje tipov je `380, 381, 380, 381, 380`. B2G dokaz
   dodatno preveri korenski `leitweg_id`, `buyer_reference`, prejemnikov
   `leitweg_id` in odsotnost B2B PDF priponke. Oba payload-a tipa `381` morata
   vsebovati točno referenco številke in datuma svojega izvirnega računa. Za vsak
   posamezen tek mora biti izrecno nastavljeno še
   `OPENAPI_INVOICE_SANDBOX_SMOKE_CONFIRMED=true` in zaradi trenutno blokiranega
   tipa 381 tudi `OPENAPI_INVOICE_SANDBOX_381_PROBE_CONFIRMED=true`. Diagnostični
   prehod se vključi samo neposredno v tem skriptu, zahteva sandbox gostitelja in
   zaprt produkcijski način; običajni API handler ter izvajalnik dostave do njega
   nimata dostopa. Nastavitvi nista trajna okoljska konfiguracija in se po
   preizkusu odstranita. Pred prvim ponudnikovim zapisom skript pošlje še
   neavtenticiran in namenoma nepopoln callback na nastavljeni sandbox webhook.
   Nadaljuje samo ob točnem aplikacijskem HTTP 401; Vercel SSO preusmeritev,
   napačna pot ali nedosegljivost ustavijo tek, preden nastane katerikoli
   oddaljeni testni račun. Preflight ne pošlje žetona ali webhook skrivnosti.
   Tudi posebni knjižnični probe gate zahteva obe izrecni potrditvi, veljaven
   ločeni sandbox webhook in uspešno potrjen preflight; manjkajoč posamezen pogoj
   blokira tip `381` pred prvo providerjevo poizvedbo.
   Po sprejetih POST-ih skript omejeno preverja obe ponudnikovi referenci tipa
   `381` in uspeh izpiše samo, če popolni Storno in delni dobropis oba dosežeta
   stanje `DONE`. `ERROR`, neznano stanje ali iztek omejenega pollinga prekinejo
   tek z napako in ne odprejo produkcijske poti.
4. Šele po pogodbeni in računovodski potrditvi dodaj produkcijski žeton z
   enoletnim TTL in njegov datum poteka, spremeni način na `production` ter
   posebej nastavi `POS_OPENAPI_INVOICE_ENABLED=true`. Zadnje stikalo
   `OPENAPI_INVOICE_SEND_ENABLED=true` nastavi samo z ločeno odobritvijo za
   dejansko produkcijsko oddajo. Produkcijsko potrdilo
   `OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED=true` nastavi šele po
   svežem anonimnem preflightu na istem javnem callback URL-ju, ki vrne točen
   aplikacijski HTTP 401; preusmeritev, Vercel protection ali aplikacijski 404
   potrdila ne dovolijo. Produkcijski URL sme vsebovati samo
   `handler=openapi-invoice` in `webhook=1`; sandbox dodatno samo `sandbox=1`.
   Začasni Preview bypass ali drug query parameter readiness zavrne. Potrdilo mora
   vsebovati isti URL v `OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL` in čas
   uspešnega preverjanja v `OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT`; po 24 urah
   ali po spremembi URL-ja samodejno preneha veljati.

Produkcijskega žetona ni varno ponovno uporabiti v lokalnem ali Preview okolju.

## Zadnja Preview namestitev

Openapi integracija je bila 24. avgusta 2026 nameščena v obstoječe Vercel
Preview okolje. Stalni testni naslov je
`https://uspesni-jezek-openapi-test.vercel.app`; produkcijski naslov ni bil
spremenjen. Namestitev je v stanju `READY`, POS stran vrne HTTP 200, Openapi
handler brez prijave pravilno vrne HTTP 401, Vercel pa je ustvaril 11 od največ
12 funkcij. Po prvih preverjanjih v dnevniku nove namestitve ni bilo napak.

Povezana Supabase migracija za obnovo izgubljenih Openapi callbackov je izvedena
in preverjena. Plačljivi stikali za produkcijsko ustvarjanje konfiguracij ter
periodično usklajevanje ostajata zaprti; nobena naročnina, dobroimetje ali
produkcijska dostava ni bila vključena.

Naknadni zunanji pregled 24. avgusta 2026 je pokazal, da stalni Preview alias in
neposredni Preview deployment za neavtenticiran GET trenutno vrneta Vercel SSO
preusmeritev (302), neavtenticiran POST preflight pa JSON 401 `Protected deployment`,
čeprav prijavljeni Vercel pregled stran odpre. Alias še vedno kaže na zgoraj
navedeni READY deployment. Novi preflight zato naslednji sandbox sprejemni tek
pravilno ustavi pred oddajo, dokler callback ni javno dosegljiv.
Aktualni produkcijski URL sicer ostaja javno dosegljiv, vendar njegov trenutni
deployment za Openapi handler vrača 404 in ni varen nadomestek za sandbox callback.
Anonimni preflight ta primera loči: manjkajoči aplikacijski handler vrne
`OPENAPI_SANDBOX_WEBHOOK_ROUTE_MISSING`, zaščiten Preview deployment pa
`OPENAPI_SANDBOX_WEBHOOK_DEPLOYMENT_PROTECTED`.

## Nadzorovani sandbox dokaz po ponudnikovem popravku (26. avgust 2026)

Odobreni Preview-only preizkus je ustvaril natanko pet sandbox zapisov: dva B2B
originala tipa `380`, popolni Storno `381`, delni dobropis `381` in B2G račun
`380`. Oba dokumenta `381` sta bila sprejeta in sta dobila ponudnikovi referenci;
po dveh omejenih polling ciklih sta ostala v stanju `SENT` in nista prešla v
`ERROR` ali končno `DONE`.

Sandbox je dodatno pokazal, da nemška izvedba zahteva `payment_means` tudi za tip
`381`. Adapter zato ohrani plačilno vrstico in njen `amount` uskladi z negativnim
bruto zneskom popravka. B2G fixture uporablja uradni OAS primer Leitweg-ID
`10101010-STO-10`. Uradni OAS URL je pri neposrednem preverjanju vračal
cache/legacy pogodbo `1.1.0` s starim pozitivnim pravilom in ni neodvisen dokaz nove
oblike za tip `381`; watchdog zato ostaja diagnostičen in ne more odpreti produkcije.

Poznejši omejeni read-only pregled istih dveh provider referenc je pri obeh vrnil
`state: SENT` in `details.external_status: succeeded`. Lokalna pogodba ponudnikov
status `succeeded` obravnava kot uspešno dostavo in ga namenoma preslika v makro
stanje `SENT`; zato `DONE` za ta dostavni dokaz ni potreben. Adapter in smoke
regresije kot uspeh prepoznajo `DONE` ali natančno kombinacijo
`SENT / succeeded`, ne pa vmesnih stanj `cleared`, `acknowledged` ali `in_process`.

Začasni Preview probe handler in njegove env spremenljivke so po preverjanju
odstranjeni. Bypass žeton, uporabljen v callback URL-ju, je preklican, callback URL
pa obnovljen brez bypass parametra. Sandbox dokaz tipa `381` je zaključen.
Posebni provider-conflict zaklep je odstranjen iz produkcijske poti, vendar je tip
`381` omogočen samo, kadar so hkrati izpolnjene vse splošne Openapi produkcijske
varovalke (`POS_OPENAPI_INVOICE_ENABLED`, `OPENAPI_INVOICE_SEND_ENABLED`, svež
produkcijski žeton, veljaven webhook in javni webhook preflight). Nobeno od teh
produkcijskih stikal ni bilo nastavljeno in produkcija ni bila objavljena.

Migracija `pos_openapi_succeeded_delivery_state` uskladi isti contract še
v podatkovni plasti: produkcijski `SENT / succeeded` se shrani kot `delivered`,
ustavi nadaljnje reconciliation poskuse ter zapiše obstoječo dostavno in auditno
sled. Sandbox ostane `test_completed`. Če že neposredni odgovor na oddajo vsebuje
`SENT / succeeded`, delivery runner uporabi isti service-role RPC, zato ni odvisen
samo od poznejšega callbacka. Po izrecni odobritvi 26. avgusta 2026 je bila ta ena
migracija nameščena v povezano Supabase bazo in njena različica `20260826131305`
zabeležena v zgodovini migracij. Pet drugih čakajočih, nepovezanih migracij ni bilo
nameščenih; varovalka jih še vedno blokira.

Pogodbeni watchdog zdaj naloži ozko lokalno evidence fixture za oba nadzorovana
primera. Preveri osnovne operacije, tipa `380/381` in callback dogodke v trenutno
vrnjenem dokumentu, vendar cache/legacy OAS `1.1.0` ni neodvisen dokaz nove pogojne
oblike. Fixture ločeno potrdi popolni Storno in delni dobropis kot
`SENT / succeeded` ter pri vsakem zahteva natančno
ujemanje `billing_reference.document_number` s številko oddanega originala. Fixture
je dodatno vezan na potrjeni SHA-256, isti smoke-run ID, dve različni referenci in
originala ter ponudnikova dogodka v istem kratkem časovnem oknu. Ročno spremenjen,
časovno nepovezan ali identitetno podvojen dokaz zato fail-closed blokira tudi
produkcijski readiness za tip `381`. Javni OAS še vedno ne objavlja
pogojnih predznakov ali `billing_reference`, zato watchdog tega ne zamenja za
samodejno produkcijsko dovoljenje.

Namenski sandbox smoke po uspešni končni uskladitvi zdaj izpiše tudi celoten
`controlledSandboxEvidence` z vrstama primera, provider referencama, dokumentoma,
izvirnima `billing_reference` številkama in časoma provider dogodkov. S tem naslednja
odobrena ponovitev ne zahteva ročnega prepisovanja dokaznih polj; pred zamenjavo
fixture in njenega pripetega SHA-256 je še vedno potreben namenski pregled rezultata.
