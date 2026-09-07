# POS – stanje 8. septembra 2026

POS še ni potrjen za produkcijsko uporabo. Preverjanje temelji na lokalni kodi, dejanskem lokalnem uporabniškem toku in ločenih read-only preverjanjih zunanjega stanja.

## Izhodišče in izvedene spremembe

- Izhodiščni commit: `4bad4d9`.
- Odpravljen je obstali prikaz nalaganja arhiva: `archiveCapabilityView` upošteva tudi `backend.error` in pokaže napako.
- Odpravljena sta oba konflikta ponovnega teka migracije kataloga ponudbe, ki sta ustavila POS CI: začasno parkiranje samo 51 premaknjenih polj in uskladitev oznake polja 5611 z obstoječo aplikacijo. ID-ji, odgovori in tuja polja ostanejo ohranjeni.
- Dostava Resend uporablja prvi nespremenljivi dogodek rezervacije kot začetek idempotenčnega okna. Po varnostni meji 24 ur minus 60 sekund negotove oddaje ne ponovi samodejno. Preprečeno je tudi blokiranje čakalne vrste zaradi izčrpanih poskusov; diagnostika pokaže `recoveryRequired`.
- Resend hrani idempotenčne ključe 24 ur: [uradna dokumentacija](https://resend.com/docs/dashboard/emails/idempotency-keys).
- `docs-impact: da` — spremenjena sta prikaz napake arhiva in obnovitev negotove dostave.

## Dokazi in omejitve preverjanja

- `npm run test:pos`: celoten sklop je ponovno uspešen, vključno s funkcijskim proračunom 11/12. Brez DB URL štirje podatkovni preizkusi izrecno javijo SKIP; ločeni native PostgreSQL tek spodaj jih je dejansko izvedel.
- Dejanska SQL datoteka je preverjena s PostgreSQL/PGlite 0.5.8: izvirnik ponovi napako 23505, samo parkiranje ponovi konflikt oznake, celoten popravek uspe. 60 polj, 28 modulov, obstoječi odgovor ohranjen; uspe tudi dodatno tuje polje. To ne nadomesti celotnega Supabase CI.
- Lokalni brskalnik je ustvaril `TEST-2026-0001` z dolgim nemškim nazivom in izračunom 1.000 × 2,50 EUR = 2.975 EUR z 19 % DDV. Račun je ohranjen po osvežitvi in se znova odpre. Lokalni test nima strežniškega PDF izvirnika; pošiljanje in plačilni ponudniki ostanejo onemogočeni.
- Sveži interni posnetki potrjujejo popravek arhiva in prileganje dolgega nemškega besedila pri 390 × 844 ter 980 × 900. Ni vodoravnega prelivanja ali zajetih konzolnih napak. `verify:local` potrdi kanonični vir in Supabase Auth dostop.
- Lokalni readiness v17 z `.env.local`: 0/8. To ni pregled produkcijskih okoljskih spremenljivk.
- Read-only Vercel pregled: zadnja produkcija `dpl_9kQtQbyULTagVMsdXfGWxfdUAWyz` z dne 6. septembra je `READY`. To samo po sebi ne dokazuje delovanja POS.

## Dejanske blokade in naslednji koraki

1. **Manjkajoče migracije v povezani bazi.** Read-only pregled je potrdil odsotnost spodnjih POS migracij; osnovne gotovinske tabele manjkajo:

   `20260825130652`, `20260825130657`, `20260826182713`, `20260826194158`, `20260828131500`, `20260828143000`, `20260829165203`, `20260830172315`, `20260830212243`, `20260830212449`, `20260830212909`, `20260830213055`.

   Izolirani native ponovni tek je uspešen. Pred namestitvijo ostajata aktualni preflight in razjasnitev podvojenih testnih Stripe poskusov. Compatibility migracija `20260907231801` ohrani nove terminalne semantike in stare omejitve poskusov tudi pri naknadni namestitvi stare migracije.

2. **Svež podatkovni Supabase CI je uspešen.** Run `34170608186`, commit `347ef3dc1b3e83cabc5c34ccbb684fec61659c08`, job `pos-payment-concurrency` je uspešno izvedel dejanske migracije, Stripe snapshot, Openapi terminal/budget preizkuse, lint, RPC pravice in sočasnost plačil. Splošni job je padel na nepovezani Boniteta regresiji (`if (!jeLokalniAudit) void shraniZakljucenoPreverbo`); POS unit korak je bil zato preskočen. Lokalni workflow sedaj vsebuje samostojni `pos-unit` job. Prvi push je samodejni pregled zavrnil; uporabnik je nato neposredno odobril push in predajo. Nov job še čaka CI rezultat.

3. **Produkcijski pogoji.** Potrebni so potrjeni produkcijski Openapi dostop in webhook, S3 WORM z obnovitvenim preizkusom, nemški pravni pregled, pilot, finAPI live ter gotovinski/TSE tok. Njihove aktivacije se ne sme nadomestiti z lokalnimi testi ali ročno nastavljenimi potrditvami brez dokazov.

V tem delu ni bilo produkcijske objave, namestitve migracij ali aktivacije zunanjih ponudnikov.

Spremenjene datoteke: `api/_lib/pos-delivery-providers.js`, `pos-delivery-runner.js`, `pos-delivery-worker.js`; `app/pos-terminal.js`, `app/pos-terminal.html`; `scripts/test-pos-delivery-engine.js`, `test-pos-archive.js`, `test-pos-migration-deployment.js`, novi `test-offer-migration-replay.js`; `supabase/migrations/20260829223000_offer_lego_modules_v2.sql`. Prej prisotna sprememba `scripts/test-pos-datev.js` je ohranjena.

## Nadaljevanje: strežniška uskladitev in CI

- Dodan `retrieveProductionReceipt`: samo poizvedba obstoječega SALE, preverjanje klienta, UUID, FINISHED revizije 2, podpisnih dokazil, fiskalne vrste, zneska, DDV in valute. Natančen 404 je NOT_FOUND; napake ostanejo napake. Produkcijski checkout/refund servis in UI še nista povezana; prazna cash migracija ni izvedba.
- Novi `scripts/test-pos-openapi-terminal-budget.js` in `scripts/sql/test-pos-openapi-terminal-budget.sql` sta vključena v DB CI z obveznim `POS_REQUIRE_OPENAPI_DATABASE=1`. Preizkus teče znotraj read-only transakcije.
- Ponovno potrjen lokalni vir in Auth egress. V tej fazi ni sprememb UI ali novega vizualnega dokaza.
- Vercel sensitive production STRIPE_SECRET_KEY po dovoljenem read ni vrnil uporabnega sk_test_ ali sk_live_ ključa. Noben Stripe GET ni bil izveden; ponudniški dokaz ostaja odprt. Ključ ni bil prikazan ali shranjen.
- `docs-impact: da` — dodana provider uskladitev in trajno DB CI preverjanje. Nobene zunanje finančne ali podatkovne mutacije.

## Zadnji checkpoint: dodatne potrjene napake

- Neposredni produkcijski Fiskaly odgovor zdaj zahteva revizijo 2, enako kot recovery GET. Gotovinski normalizer zavrne izrecno ne-EUR valuto pred pripravo ali podpisom. Regresije uspešne.
- Ciljna osvežitev uporablja obstoječi fetchAllRows za payments/deliveries/events s stabilnim created_at+id vrstnim redom. Novi test-pos-targeted-refresh.js preveri 1001 zapis in napako druge strani vsake tabele brez delnega prepisa.
- Prazen ali nepovezan arhiv ne trdi dvojne zaščite; dodani nemški prevodi. Polno preverjanje zahteva dejanske enake pozitivne document/verified/replicated counts.
- Prekinjen, prazen ali neveljaven uspešen Resend odgovor je negotov ponovljiv izid z istim idempotency ključem. Runner razvrsti 429/5xx in znane transportne napake, tudi bounded cause verigo, kot začasne; izrecni retryable:false ostane prednosten.
- npm run test:pos po vseh spremembah PASS; 4 DB preizkusi lokalno SKIP brez DB URL. Nova poslovna SQL ni bila dodana. verify:local PASS.
- Svež CUA dejanski prikaz pri 390x844 in 980x900 kaže nedosegljiv arhiv (povezana POS baza ni pripravljena), brez DOM overflow in console warn/error. Interni screenshots zajeti; prazno/polno stanje je trenutno preverjeno s funkcijskimi testi, ne z dejanskim brskalniškim podatkovnim stanjem. Vizualna potrditev teh stanj ostaja odprta.
- Produkcijska gotovina še NI implementirana; 20260907232019_pos_production_cash_binding.sql ostaja prazna, server/UI training-only. Nobene produkcijske aktivacije.
- Uporabnik je neposredno odobril push pregledanih POS popravkov na codex/pos-recovery-ci-20260908 in prenos konteksta v novo Codex nalogo. Odobritev ne vključuje mergea v main, produkcijske objave ali finančnih mutacij.
- docs-impact: da — popravljena validacija plačil, obnova dostave in arhivski status.
