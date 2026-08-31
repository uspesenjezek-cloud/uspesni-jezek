# Atena: pripravljenost na 200 aktivnih uporabnikov

## Cilj in meja

Cilj je stabilno delovanje pri 200 hkrati aktivnih uporabnikih. To ne pomeni 200 sočasnih dragih AI-klicev. Statične strani in običajni podatkovni zahtevki se lahko izvajajo vzporedno, Atenini klici Lune pa imajo skupni sprejemni nadzor, da preobremenitev ne povzroči kaskadnega sesutja.

## Produkcijske varovalke

- Vse serverless instance uporabljajo isti atomski Supabase RPC za sprejem AI-zahtev.
- Največ 24 AI-zahtev je hkrati v stanju `processing`; dodatne dobijo varen `503 AI_BUSY` z `retryAfterMs`.
- Posamezni uporabnik lahko začne največ 12 AI-zahtev na minuto.
- Isti `requestId` in isti prstni odtis se med instancami izvedeta samo enkrat.
- Isti `requestId` z drugo vsebino se zavrne z `409 REQUEST_ID_REUSED`.
- 55-sekundni lease omogoči varen prevzem po sesutju instance; lease token prepreči, da bi star proces prepisal novejši rezultat.
- Uspešni in varni neuspešni odgovori se pet minut hranijo za determinističen retry.
- Tabela nima neposrednih pravic za `anon` ali `authenticated`; dostop je samo prek RPC-ja, ki lastništvo izpelje iz `auth.uid()`.

## Preverjanje

Za deterministični contract in 200-uporabniško matriko:

```powershell
npm run test:atena-readiness
```

Za 200 sočasnih zahtev na lokalno realno stran:

```powershell
node scripts/test-atena-200-user-readiness.js --url=http://localhost:8001/app/izvedba.html?app-preview=1
```

Preizkus mora potrditi največ 24 ponudniških klicev, nadzorovane `AI_BUSY` odgovore, en sam klic pri 200 podvojitvah ter 200 veljavnih HTTP odgovorov brez crasha.

## Produkcijski rollout

Migracija `20260830133746_atena_distributed_admission_control.sql` mora biti v produkcijski bazi pred objavo kode handlerjev. Če so v repozitoriju starejše neobjavljene migracije, jih je treba najprej ločeno pregledati; prepovedano je slepo uporabiti `--include-all` samo zaradi te spremembe. Po migraciji se preverijo RPC pravice, RLS, atomska omejitev in šele nato se objavi strežniška koda.

## Kaj ta meja zagotavlja

Obremenitev nad kapaciteto se degradira v kratek ponovljiv odgovor, ne v neomejeno čakanje ali množico podvojenih zunanjih klicev. Končna kapaciteta Lune, Vercelovega paketa in Supabase paketa je še vedno zunanja operativna meja, zato se po produkcijskem zagonu spremljajo p95, delež `AI_BUSY`, napake ponudnika in poraba.
