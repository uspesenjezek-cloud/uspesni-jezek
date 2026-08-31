# Celotni sistem: pripravljenost na 200 sočasno aktivnih uporabnikov

Stanje: **varnostni contract in statična obremenitev sta produkcijsko potrjena; zunanje kvote in prava DB-sočasnost še niso v celoti potrjene**.

Ta contract pomeni nadzorovano sočasnost, varen backpressure, idempotentne ponovitve, omejene timeoute in atomske zapise. Ne pomeni, da bo 200 plačljivih zunanjih operacij končanih hkrati.

## Matrika kritičnih poti

| Sloj | Timeout / retry | Idempotentnost in atomskost | Backpressure | Lokalni dokaz | Stanje |
|---|---|---|---|---|---|
| Statične strani | 10 s meja v readiness burstu | samo branje | strežnik/CDN | 200/200 HTTP 200; p50 212 ms, p95 221 ms, max 250 ms | lokalno PASS |
| Supabase auth | lokalni ES256/JWKS; JWKS 3 s; oddaljeni fallback 5 s × največ 3 | JWT uporabnik | ponudnik vrne varen retryable odgovor | contract testi v `supabase-server.js` | lokalno PASS |
| Običajni Supabase read/RPC | skupni 12 s timeout | lastništvo/RLS; write RPC-ji | PostgREST/DB | source contract + obstoječi integration testi | lokalno PASS, produkcijska kapaciteta ni izmerjena |
| `potrdi-korak` | skupni lokalni JWKS auth; DB klici 12 s | optimistic version patch | omejeni DB klici, conflict fail-closed | shared-auth/timeout source contract v sistemskem readiness testu | produkcijsko objavljeno; contract PASS |
| Atena | 30–45 s, največ 2 poskusa | procesna + porazdeljena idempotentnost | 12/uporabnika/min, največ 24 globalno | 200 unique + 200 duplicate PASS; produkcijski RLS/privilegiji/lint/advisor PASS | produkcijsko objavljeno |
| AI-branje dokumenta | 45 s skupaj, 30 s/poskus, največ 2 poskusa | JWT + requestId/fingerprint; 5-minutni cache samo izvlečenega JSON-a | 12/uporabnika/min, največ 24 globalno prek Ateninega admission RPC-ja | anon 401; 200 duplikatov → 1 provider klic; 200 unique → 24 sprejetih in 176 varnih 503; izvorni base64 ni shranjen | produkcijsko objavljeno; anon 401 preverjen |
| Izvedba ukrepov | skupni auth/DB timeout | namenski atomski RPC in verzije | DB conflict/fail-closed | prizadeti integration testi | lokalno PASS |
| POS in plačila | ponudniki imajo omejene request meje | RPC/unikatni ključi, Stripe idempotency, webhook dedupe | delivery outbox in claim worker | celoten `npm run test:pos` PASS | lokalno PASS; pravi DB concurrency test SKIP |
| PDF-ji | vsi storage/DB klici omejeni | storage `x-upsert:false`, unikaten dokument; novi singleflight | največ 2 generiranji/proces, vrsta 32, varen 503 | 200 duplicates → 1 izvedba; 200 unique → omejena sočasnost in varen presežek | lokalno PASS |
| Boniteta | zunanji viri imajo timeout/preflight | cache key, lastništvo in job claim token | največ 30 skupaj, 20 insolvenčnih | 200 zahtev → 30 claimov, od tega 20 insolvenčnih; celoten sklop PASS | lokalno PASS |
| SMS/opomini | SMS 10 s | provider `Idempotency-Key`, DB claim/finalize token | worker največ 5 | 200 opravil, max active 5 | lokalno PASS |
| POS/background workerji | posamezen run omejen na majhne batche | DB claim tokeni in retry stanje | POS delivery 3/run; arhiv 10/run | POS worker/regresijski testi PASS | lokalno PASS |
| Observability | Sentry wrapperji na kritičnih handlerjih | kode napak brez skrivnosti | ni admission sloj | obstoječi privacy/regression contracti | pregledano, ne load-testirano |

## Sveže meritve

Ukaz:

```text
SYSTEM_READINESS_HTTP_URL=http://localhost:8001/app/index.html?app-preview=1 npm run test:system-readiness
```

- statični read: 200/200 HTTP 200, p50 198 ms, p95 208 ms, max 228 ms;
- PDF duplicate: 200 zahtev, 1 izvedba, p50/p95/max 17/17/17 ms;
- PDF unique: največ 4 aktivne v testnem gateu, 176 varno zavrnjenih, p50 1 ms, p95 123 ms, max 187 ms;
- splošni worker: 200 opravil, največ 5 aktivnih, skupno 532 ms;
- boniteta: 200 zahtev, 30 atomskih claimov, od tega 20 insolvenčnih, 50 ms;
- AI-branje dokumenta: 200 identičnih zahtev, 1 provider klic; 200 unikatnih zahtev, največ 24 provider klicev in 176 varnih zavrnitev; celoten document contract 115 ms;
- Atena transport timeout fallback: p50 102–110 ms, p95/max 110–114 ms v injiciranem 100 ms testu.
- produkcijski statični read po objavi: 200/200 HTTP 200, p50 952 ms, p95 1191 ms, max 1240 ms;
- produkcijski `/api/citaj-racun` brez JWT: HTTP 401, `AUTH_TOKEN_MISSING`, `Cache-Control: no-store`;
- Vercel deployment `dpl_2mXQyVAGEZ9JGiRXnY7zWHKscRym`: READY in promoviran na `https://uspesni-jezek.vercel.app`.

Produkcijski PDF gate je strožji od generičnega testa: največ 2 aktivni generiranji in največ 32 čakajočih na posamezen Node proces.

## Preostali blockerji

1. Pravi `test-pos-payment-concurrency.js` je brez lokalne Supabase baze in testnega uporabnika preskočen. Statični/RPC/sandbox contracti so zeleni, toda 200 podvojenih zapisov na pravi bazi še ni sveže dokazano.
2. Zunanje kvote/paketi niso lokalna lastnost: OpenAI/Anthropic, OpenRegister, Apify/Scrapling, Stripe, Resend/SMS, Openapi Invoice, fiskaly, finAPI, S3, Supabase compute/connection pool in Vercel morajo imeti potrjene produkcijske limite. Sistem mora ostati varen tudi ob 429/5xx; lokalni test ne potrjuje kupljene kvote.

## Izvedeni varnostni contract

Uporabnik je odobril in lokalna izvedba zdaj dokazuje naslednje:

- `/api/citaj-racun` zahteva veljaven Supabase JWT; anonimni klic dobi 401. Oba brskalniška klicatelja dodata trenutni access token in stabilen `requestId`.
- AI-branje dokumenta ima omejen timeout/retry in uporablja produkcijsko porazdeljeno AI admission tabelo; migracija dovoljuje `request_kind='document'`. Za 5-minutno idempotentnost se shrani izvlečen JSON rezultat, nikoli izvorna slika/PDF.
- `potrdi-korak` uporablja skupno lokalno JWKS preverjanje in 12-sekundne DB timeoute. Poslovna optimistic-lock logika je ostala nespremenjena.

Produkcijski rollout je bil 30. avgusta 2026 izveden ciljno: uporabljena in v zgodovini evidentirana je samo migracija `20260830133746`; stare nepovezane čakajoče migracije niso bile uporabljene. Nato je bil preverjeni Vercel artefakt promoviran na obstoječo produkcijsko domeno.
