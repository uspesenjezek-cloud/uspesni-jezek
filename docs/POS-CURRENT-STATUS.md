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

2. **Celoten Supabase CI še nima svežega dokaza.** Docker Linux pipe lokalno ni dosegljiv. [Zadnji zeleni DB CI](https://github.com/uspesenjezek-cloud/uspesni-jezek/actions/runs/33401875238/job/99519892494) je za commit `22e82bf` (31. avgust). [Novejši CI](https://github.com/uspesenjezek-cloud/uspesni-jezek/actions/runs/33427105673/job/99603238921) je padel zaradi zgoraj odpravljenih konfliktov. Native PostgreSQL 18.4 je uspešno ponovno izvedel 132 migracij, 14 Stripe snapshot primerov, 54 končnih RPC podpisov/pravic, sočasnost plačil in sedem Openapi terminalnih primerov. Uporabljene so minimalne auth/storage fixtures, zato to ne nadomesti polnega Supabase REST/CI preverjanja. Stari hash v `docs/POS-MIGRACIJE-ZA-ODOBRITEV.txt` za spremenjeno migracijo ne velja več; ni bil samodejno obnovljen kot odobritev.

3. **Produkcijski pogoji.** Potrebni so potrjeni produkcijski Openapi dostop in webhook, S3 WORM z obnovitvenim preizkusom, nemški pravni pregled, pilot, finAPI live ter gotovinski/TSE tok. Njihove aktivacije se ne sme nadomestiti z lokalnimi testi ali ročno nastavljenimi potrditvami brez dokazov.

V tem delu ni bilo produkcijske objave, namestitve migracij ali aktivacije zunanjih ponudnikov.

Spremenjene datoteke: `api/_lib/pos-delivery-providers.js`, `pos-delivery-runner.js`, `pos-delivery-worker.js`; `app/pos-terminal.js`, `app/pos-terminal.html`; `scripts/test-pos-delivery-engine.js`, `test-pos-archive.js`, `test-pos-migration-deployment.js`, novi `test-offer-migration-replay.js`; `supabase/migrations/20260829223000_offer_lego_modules_v2.sql`. Prej prisotna sprememba `scripts/test-pos-datev.js` je ohranjena.

## Nadaljevanje: strežniška uskladitev in CI

- Dodan `retrieveProductionReceipt`: samo poizvedba obstoječega SALE, preverjanje klienta, UUID, FINISHED revizije 2, podpisnih dokazil, fiskalne vrste, zneska, DDV in valute. Natančen 404 je NOT_FOUND; napake ostanejo napake. Produkcijski checkout/refund servis in UI še nista povezana; prazna cash migracija ni izvedba.
- Novi `scripts/test-pos-openapi-terminal-budget.js` in `scripts/sql/test-pos-openapi-terminal-budget.sql` sta vključena v DB CI z obveznim `POS_REQUIRE_OPENAPI_DATABASE=1`. Preizkus teče znotraj read-only transakcije.
- Ponovno potrjen lokalni vir in Auth egress. V tej fazi ni sprememb UI ali novega vizualnega dokaza.
- Vercel metadata potrjuje samo sensitive `STRIPE_SECRET_KEY` v production okolju; branje vrednosti je samodejni varnostni pregled zavrnil. Čaka izrecno uporabnikovo dovoljenje. Vrednost ni bila pridobljena; Stripe status zato še ni dokazan.
- `docs-impact: da` — dodana provider uskladitev in trajno DB CI preverjanje. Nobene zunanje finančne ali podatkovne mutacije.
