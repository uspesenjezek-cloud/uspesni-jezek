# POS plačilni življenjski cikel — Uspešni Ježek

Poglobljena produktna, tehnična, varnostna in UX analiza POS terminala za nemške obrtnike. State machine, podatkovni model, 43 robnih primerov, threat model, nemška compliance matrika in fazni načrt izvedbe.

Obseg: **read-only audit**, brez posegov v kodo. Vir kode: `app/pos-terminal.js`, `api/_handlers/pos-*`, `api/_lib/pos-*`, `supabase/migrations/*pos*`. Pravni viri: gesetze-im-internet.de, bundesfinanzministerium.de, bzst.de.

Legenda oznak, uporabljena skozi cel dokument:
- **[PREVERJENO]** — dejansko najdeno in prebrano v kodi te seje.
- **[PRIPOROČILO]** — predlog za nadgradnjo, ni opis obstoječega stanja.
- **[ODPRTO]** — nisem mogel potrditi read-only; preveri v aplikaciji.
- **[POTRDI]** — pravno/davčno vprašanje, zahteva potrditev nemškega Steuerberaterja/pravnika.

---

## 1. Izvršni povzetek

1. **[PREVERJENO]** Gotovinski checkout ima že danes pravo state-machine disciplino: `prepared → signed → completed`, s posebnim varnostnim stanjem `recovery_required`, ko TSE podpis vrže napako ali je izid negotov — plačilo se v tem primeru **ne zapiše** kot uspešno, dokler se ročno ne uskladi. (`api/_lib/pos-cash-checkout.js`)
2. **[PREVERJENO]** Ročna potrditev plačila (bančno nakazilo/gotovina brez TSE) uporablja idempotenčni `request_key`, vezan unikatno na uporabnika — ponovljen klic vrne isto plačilo, ne ustvari drugega. (migracija `pos_manual_payment_retry_idempotency.sql`)
3. **[PREVERJENO]** Stripe povračila so zaščitena pred zastarelimi/nezaporednimi webhook dogodki s trigerjem, ki nikoli ne zmanjša že zabeleženega `refunded_cents`. (`pos_stripe_refunds_monotonic.sql`)
4. **[PREVERJENO]** Izdan račun (`pos_invoices`) je na nivoju baze fizično nespremenljiv — trigger zavrne vsak UPDATE/DELETE. Popravki gredo izključno prek novih dokumentov (Storno/Korektur), kar je tudi GoBD zahteva.
5. **[ODPRTO]** V pregledanih migracijah nisem našel namenske tabele za blagajniški dnevnik/izmeno (cash session/shift) niti tabele naprav (device/terminal registry). Obstaja 120 pos-migracij in nisem prebral vseh — preveri eksplicitno pred nadaljnjim delom.
6. **[PRIPOROČILO]** Trenutni podatkovni model nima eksplicitnega `PaymentAttempt`, ločenega od `Payment` — `pos_payments` meša poskus in izid. To otežuje modeliranje UNKNOWN/RECONCILIATION_REQUIRED stanj za kartično plačilo (glej §5).
7. **[PREVERJENO]** Nemška fiskalna logika je nesorazmerno zrela za mlado aplikacijo: GoBD Verfahrensdokumentation PDF, WORM arhiv, DSFinV-K izvoz, KoSIT e-račun validacija in §35a postavke že obstajajo v kodi in imajo lastne teste.
8. **[PRIPOROČILO]** Kanonični state machine (CREATED…FAILED) danes ne obstaja kot en sam eksplicitni stolpec — stanje je razpršeno med `pos_payments.status` (Stripe) in ločen `cash.STATES` enum. Priporočam unifikacijo (glej §3, §15 faza 1).
9. **[PREVERJENO]** Belegausgabepflicht (§146a AO) je pravno obvezna za vsak POS izdan dokument v Nemčiji ne glede na znesek — kupec ni dolžan vzeti računa, obrtnik pa ga je dolžan izdati. Preveri v UI, da se to dosledno ponuja pri vsakem zaključku, tudi gotovinskem (glej §9).
10. **[ODPRTO]** Offline čakalna vrsta in ponovna sinhronizacija (točka 7 naročila) — nisem našel dokazane implementacije v pregledanih datotekah. Bodisi še nenapisano, bodisi obstaja v delu `app/pos-terminal.js`, ki ga nisem prebral v celoti (6523 vrstic). Glej §16.
11. **[PRIPOROČILO]** Najresnejše produktno tveganje ni v kodi, ki obstaja, ampak v tem, kar (še) ne obstaja: **rekoncilacija med terminalom in ponudnikom po timeoutu**. Obstoječi `recovery_required` vzorec za gotovino je odličen predlog za ponovno uporabo pri kartičnem plačilu — glej §7.

---

## 2. Zemljevid uporabniških tokov

Vsi tokovi izhajajo iz ene točke — izbranega računa (`pos_invoices`, lahko tudi še neizdan osnutek) z odprtim zneskom (`gross_cents − effective_paid_cents`). Od tu se pot razveji glede na način plačila.

| Tok | Vstopna točka | Ključne postaje | Terminalni izidi | Status v kodi |
|---|---|---|---|---|
| Kartica (Stripe) | Izbira zneska → "Plačaj s kartico" | Stripe Checkout Session → preusmeritev → webhook potrdi | CAPTURED / DECLINED / CANCELLED | Sandbox/Test only |
| Gotovina (TSE) | "Gotovina" → potrditev zneska | Priprava računa → TSE podpis → zaključek | CAPTURED / RECONCILIATION_REQUIRED | Training/Mock only |
| Ročno/bančno nakazilo | "Označi kot plačano" | Izrecna potrditev → idempotenčni zapis | CAPTURED | **Produkcijsko aktivno** |
| Delno plačilo | Vnos zneska < odprti znesek | Enak tok, znesek < outstanding | PARTIALLY_CAPTURED* | [ODPRTO] status kot tak ni potrjen |
| Kombinirano | Del gotovina + del kartica | Dva ločena `pos_payments` zapisa za isti račun | Skupno CAPTURED, ko vsota = gross | [PRIPOROČILO] potrebna eksplicitna orkestracija |
| Obročno | Plan obrokov ob izdaji | N ločenih plačilnih ciklov skozi čas | Vsak obrok CAPTURED/OVERDUE | [ODPRTO] ni najdenega POS-specifičnega planerja (obstaja ločeno v modulu "Izvedba/dogovor") |
| Vračilo/storno | Iz že plačanega računa | Refund API/RPC → korekturni dokument | REFUNDED / PARTIALLY_REFUNDED | Preverjeno v kodi |
| Offline | Ni omrežja ob zaključku | Lokalna čakalna vrsta → sinhronizacija | PENDING_SYNC → CAPTURED/FAILED | [ODPRTO] ni najdeno v pregledani kodi |

`*` oznake so predlagana imena stanj (§3), ne obstoječi nizi v bazi.

---

## 3. Kanonični state machine

Spodnja tabela je **predlagan enoten** state machine za `PaymentAttempt` (§5), ki bi nadomestil/poenotil obstoječi razpršeni par `pos_payments.status` (Stripe) + `cash.STATES` (gotovina). Obstoječa gotovinska logika (`PREPARED→SIGNED→COMPLETED`, `RECOVERY_REQUIRED`) se skoraj eksaktno preslika na `PROCESSING→AUTHORIZED→CAPTURED`, `RECONCILIATION_REQUIRED` — to ni nov koncept, je posplošitev že preverjenega vzorca.

```
CREATED --authorize--> READY --> PROCESSING --> AUTHORIZED --capture--> CAPTURED (terminal)
   |                     |             |               |
   v                     v             v               v
CANCELLED(t)      CANCELLED(t)    DECLINED(t)      FAILED(t)
                                       |               |
                                  brez odgovora    signing error
                                       v               v
                                  UNKNOWN -------> RECONCILIATION_REQUIRED
                                                        |
                                    ročno usklajeno: plačilo obstaja
                                                        v
                                                    CAPTURED

CAPTURED --refund start--> REFUND_PENDING --delno--> PARTIALLY_REFUNDED --v celoti--> REFUNDED (terminal)
```

| Stanje | Kako vanj pridemo | Dovoljeni naslednji prehodi | Kaj vidi uporabnik | Dovoljena dejanja | Preprečitev napačnega ponovnega plačila | Terminalno? |
|---|---|---|---|---|---|---|
| **CREATED** | Uporabnik izbere račun/znesek/način | READY, CANCELLED | Zaslon izbire zneska/metode | Uredi znesek, prekliči | Ni še poskusa pri ponudniku — ni tveganja | Ne |
| **READY** | Vsi vhodni podatki veljavni, idempotency ključ generiran | PROCESSING, CANCELLED | "Pripravljeno" / poteka priprava naprave | Prekliči (dokler ni poslano ponudniku) | Idempotency ključ (UUID) je že vezan na ta poskus, še ne poslan | Ne |
| **PROCESSING** | Zahteva poslana ponudniku/TSE (nepovratna točka) | AUTHORIZED, DECLINED, UNKNOWN, CANCELLED* | Spinner "Ne odmikajte terminala/kartice", brez gumba Prekliči po tej točki za kartico | Nobeno (samo čakanje) | Enkrat poslano se NE sme poslati še enkrat z istim ali novim ključem, dokler PROCESSING traja | Ne |
| **AUTHORIZED** | Ponudnik potrdi rezervacijo sredstev / TSE podpiše | CAPTURED, DECLINED (capture fail) | "Potrjeno, zaključujem…" | Nobeno uporabniško | Capture uporablja isti idempotency ključ kot authorize | Ne |
| **CAPTURED** | Sredstva dokončno zajeta | REFUND_PENDING | Zeleno potrdilo + ponudba tiskanja/pošiljanja Belega | Natisni/pošlji potrdilo, sproži vračilo | Nov poskus na istem računu preveri outstanding > 0, sicer zavrne | **Da** |
| **DECLINED** | Ponudnik izrecno zavrne | CREATED (nov poskus) | Jasen razlog + "Poskusi znova"/"Drug način" | Nov poskus (nov idempotency ključ) | Nov poskus dobi nov ključ — samo po sebi brez tveganja dvojnega bremenjenja | **Da** |
| **CANCELLED** | Uporabnik prekliče pred PROCESSING | CREATED (nov poskus) | "Preklicano" | Nov poskus | Ni bilo poslano ponudniku — brez tveganja | **Da** |
| **UNKNOWN** ⚠ | Timeout, izguba povezave ali crash med PROCESSING/AUTHORIZED, brez prejetega odgovora | RECONCILIATION_REQUIRED (avtomatsko, takoj) | Rumen/oranžen zaslon: "Preverjamo stanje plačila — ne poskušajte znova" | Izrecno nobeno — gumb za ponovno plačilo onemogočen | Sistem samodejno preide v RECONCILIATION_REQUIRED namesto da pusti uporabnika klikniti znova | Ne (mora prehajati naprej) |
| **RECONCILIATION_REQUIRED** ⚠ | Iz UNKNOWN, ali ko TSE/kartični podpis vrže napako po oddaji (že preverjen vzorec: `cash.STATES.RECOVERY_REQUIRED`) | CAPTURED / DECLINED / FAILED / ostane | "Preverjamo z bančnim ponudnikom, prosimo počakajte" + po X sekundah "Pokliči podporo" | Ročna/samodejna poizvedba (status lookup), NIKOLI nov poskus zaračunavanja | Poizvedba mora biti read-only GET po statusu, ne nov charge — glej §7 | Ne |
| **REFUND_PENDING** | Uporabnik sproži vračilo na CAPTURED plačilu | PARTIALLY_REFUNDED, REFUNDED, CAPTURED (če pade) | "Vračilo v obdelavi" | Nobeno dodatno vračilo, dokler ni razrešeno | Refund idempotency ključ (preverjeno: Stripe `idempotencyKey` vzorec) | Ne |
| **PARTIALLY_REFUNDED** | Delno vrnjen znesek < amount_cents | REFUND_PENDING (novo delno), REFUNDED | "Vrnjeno: X od Y €" | Dodatno delno vračilo do preostanka | DB trigger `pos_preserve_refund_progress` — ne dovoli zmanjšanja `refunded_cents` | Ne |
| **REFUNDED** | `refunded_cents = amount_cents` | — | "V celoti vrnjeno" | Samo vpogled/izpis dobropisa | Trigger onemogoča nadaljnje spremembe navzdol | **Da** |
| **FAILED** | Sistemska/tehnična napaka pred kakršnokoli komunikacijo s ponudnikom | CREATED (nov poskus) | "Tehnična napaka, poskusite znova" + diagnostična koda | Nov poskus | Ločeno od DECLINED/UNKNOWN: ponudnik ni bil nikoli dosežen, zato je varno ponoviti brez rekoncilacije | **Da** |

`*` PROCESSING → CANCELLED naj bo dovoljen samo za gotovino/ročno pred dejanskim TSE podpisom; za kartico po pošiljanju avtorizacijske zahteve preklic ni varen (R-07 v §6).

---

## 4. Priporočena arhitektura

**[PRIPOROČILO]** — gradi na obstoječem vzorcu (Vercel funkcije + Supabase Postgres RPC + RLS), ne predlaga menjave stacka.

| Plast | Odgovornost | Obstoječi gradnik za ponovno rabo | Kar manjka |
|---|---|---|---|
| Terminal UI (brskalnik/PWA) | Izbira, prikaz stanja, offline queue, tiskanje/pošiljanje Belega | `app/pos-terminal.js` | Eksplicitna offline-first plast (service worker queue) — ni potrjena |
| API rob (Vercel funkcije) | Auth, validacija payloada, klic ponudnika, zapis v RPC | `pos-stripe-checkout.js`, `pos-fiskaly.js` | Enoten `PaymentAttempt` orkestrator, poenoten čez kartico/gotovino/ročno |
| Webhook sprejemnik | Preveri podpis, normalizira dogodek, kliče idempotenčni RPC | `pos-stripe-webhook.js` + `pos_apply_stripe_event` RPC | Enakovreden webhook/poll adapter za fiskaly produkcijski TSE (danes samo training) |
| Baza (Postgres/Supabase) | Atomski zapis, RLS, nespremenljivost, monotoni trigerji | `pos_payments`, `pos_invoices` (immutable trigger), refund monotonic trigger | Tabele `payment_attempts`, `cash_sessions`, `devices`, `reconciliations` (§5) |
| Rekoncilacijski worker (cron) | Periodično poizveduje stanje pri ponudniku za vsak RECONCILIATION_REQUIRED/UNKNOWN zapis | Vzorec obstaja za opomine drugje v repozitoriju | POS-specifičen worker ni najden — [ODPRTO] |
| Observability | Strukturirani dogodki, alarmi brez PAN/kartičnih podatkov | `console.error("[pos-*]", koda)` že ločuje kodo od sporočila | Centralen alarm za `RECONCILIATION_REQUIRED > N minut` — najbolj kritična manjkajoča metrika |

> Dobra novica: vzorec "nikoli ne zapiši uspeha brez popolnega dokaza, ob negotovosti pojdi v varno vmesno stanje" že obstaja v kodi gotovinskega TSE toka (`createService()` v `pos-cash-checkout.js`). Priporočena arhitektura samo posplošuje ta že preverjen dober vzorec na kartično plačilo in splošni `PaymentAttempt` nivo.

---

## 5. Podatkovni model

### PaymentAttempt — [PRIPOROČILO] nov predlog
Ločuje "poskus" od "izida" — danes ju `pos_payments` deloma meša. Ključen za pravilno modeliranje UNKNOWN/RECONCILIATION_REQUIRED.

| Polje | Tip | Opomba |
|---|---|---|
| `id` | uuid PK | = idempotency key, generiran enkrat ob CREATED in ponovno uporabljen pri vsakem retryu istega poskusa |
| `invoice_id` | uuid FK → pos_invoices | lahko tudi FK na osnutek |
| `user_id` | uuid FK | RLS tenant izolacija |
| `method` | enum | `card, contactless, cash, bank_transfer, manual, split` |
| `state` | enum | 13 stanj iz §3 |
| `amount_cents` | bigint | > 0 |
| `provider` | text | `stripe, fiskaly_tse, manual` |
| `provider_ref` | text | PaymentIntent ID / TSE transactionId |
| `device_id` | uuid FK → devices | kateri terminal je sprožil |
| `cash_session_id` | uuid FK, nullable | samo za gotovino |
| `last_reconciled_at` | timestamptz | zadnja uspešna poizvedba pri ponudniku |
| `created_at / updated_at` | timestamptz | |

### Payment — [PREVERJENO] obstaja: `pos_payments`
`id, user_id, invoice_id, amount_cents, currency` (preverjeno v `pos_terminal_core.sql`); kasnejše migracije so dodale `provider, status, refunded_cents, failure_code, metadata` (razvidno iz poizvedb v `pos-stripe-checkout.js`). `status` vrednosti razvidne iz kode: `succeeded, partially_refunded, refunded` + implicitno `failed`; **ni** eksplicitnega `pending/processing` — priporočilo dodati. `refunded_cents` zaščiten z monotonim trigerjem.

[PRIPOROČILO]: dodaj `attempt_id` FK nazaj na `PaymentAttempt`.

### Refund — [PREVERJENO] obstaja implicitno prek `pos_payments.refunded_cents` + Stripe API
[PRIPOROČILO]: ločena tabela namesto samo kumulativnega stolpca, ker več delnih vračil danes ni posamično sledljivih. Polja: `id, payment_id, amount_cents, reason, requested_by, provider_refund_id, state (REFUND_PENDING/REFUNDED/FAILED), created_at`.

### Receipt — [PREVERJENO] obstaja kot PDF/dokument generatorji
`api/_lib/pos-pdf.js`, `pos-offer-pdf.js`, `pos-adjustment-pdf.js`, XRechnung generatorji, WORM arhiv (`pos-worm-archive.js`). [PRIPOROČILO]: eksplicitno `receipt_type` polje (`kassenbon` vs `rechnung` vs `e_invoice`), ker gre za pravno različne dokumente z različnimi obveznimi polji (§9).

### CashSession — [ODPRTO] ni najdeno v pregledanih datotekah
| Predlagano polje | Namen |
|---|---|
| `id, device_id, opened_by, opened_at` | začetek izmene |
| `opening_float_cents` | začetna gotovina v predalu ("Wechselgeld") |
| `closed_by, closed_at` | zaključek izmene |
| `counted_cents` | fizično prešteto ob zaključku |
| `expected_cents` | izračunano: opening + gotovinska prodaja − gotovinska vračila |
| `variance_cents` | `counted − expected`, obvezen komentar če ≠ 0 |
| `tse_export_ref` | povezava na DSFinV-K/Z-Bon izvoz za to izmeno |

### Device — [ODPRTO] ni najdeno kot ločena tabela
TSE koda referencira `tssSerialNumber`/`clientSerialNumber` na nivoju posameznega podpisa (preverjeno v `pos-cash-checkout.js`), a ni najdene centralne registracijske tabele naprav. §146a Abs. 4 AO zahteva prijavo vsakega elektronskega zapisovalnega sistema na Finanzamt (§9) — brez lastne tabele naprav je to težko avtomatizirati/revidirati.

### Reconciliation — [PRIPOROČILO] nov predlog, ključen za §7
| Polje | Namen |
|---|---|
| `id, payment_attempt_id` | kateri negotov poskus se preverja |
| `trigger` | `timeout, network_loss, app_crash, signing_error` |
| `queried_at, provider_response` | vsak poskus poizvedbe, tudi neuspešen — polna sled |
| `resolution` | `confirmed_captured, confirmed_failed, still_unknown, manual_override` |
| `resolved_by, resolved_at` | za manualni override — obvezen človeški podpis |

### AuditEvent — [PREVERJENO] obstaja: `pos_audit_events`
`entity_type, entity_id, action, details jsonb, created_at`, RLS na lastnika (preverjeno v `pos_terminal_core.sql`). [PRIPOROČILO]: razširiti `entity_type` nabor za `payment_attempt, cash_session, reconciliation, device`.

---

## 6. 43 konkretnih robnih primerov

| ID | Prio | Naslov | Pričakovano vedenje |
|---|---|---|---|
| R-01 | P0 | Uporabnik dvakrat hitro pritisne "Plačaj" | Drugi klik je no-op — isti `PaymentAttempt.id` se ne pošlje dvakrat; UI onemogoči gumb takoj ob prvem kliku. |
| R-02 | P0 | Timeout po oddaji kartičnega plačila, ponudnik je dejansko bremenil | Glej podrobno obravnavo v §7. |
| R-03 | P1 | Izguba WiFi/mobilne povezave med PROCESSING | → UNKNOWN → RECONCILIATION_REQUIRED, ne FAILED (ker je bilo že poslano). |
| R-04 | P0 | Crash aplikacije med PROCESSING | Ob ponovnem zagonu terminal prebere zadnje shranjeno stanje in ga takoj postavi v RECONCILIATION_REQUIRED, ne dovoli novega poskusa dokler traja. |
| R-05 | P1 | Uporabnik zapre aplikacijo (swipe away) med PROCESSING | Enako kot R-04; poskus mora biti persistiran na strežniku, ne le v pomnilniku brskalnika. |
| R-06 | — | Kartica zavrnjena (insufficient funds) | DECLINED, jasen razlog, takojšen nov poskus dovoljen z novim ključem. |
| R-07 | P1 | Uporabnik poskuša preklicati med PROCESSING kartičnega plačila | Gumb Prekliči izgine takoj ob prehodu v PROCESSING za kartico — preklic po oddaji ni varen. |
| R-08 | — | PIN vnesen napačno 3x | Terminal/kartičnik sam vrne DECLINED z ustrezno kodo; aplikacija ne sme razlagati kot UNKNOWN. |
| R-09 | — | Brezstično plačilo nad limitom brez PIN fallback | Ponudnik zahteva PIN — UI mora znati prikazati vmesni "vnesite PIN" korak, ne obravnavati kot napako. |
| R-10 | P1 | Gotovinski TSE podpis vrže napako po tem, ko je gotovina že prejeta v roke | Preverjeno: gre v RECOVERY_REQUIRED, NE v izgubljen zapis — UI mora obrtniku jasno povedati naj gotovino zadrži. |
| R-11 | — | Gotovinsko plačilo — kupec da napačen znesek (premalo) | Sistem preveri `grossCents` pred TSE podpisom (`normalizeCashReceipt`) — checkout se ne sme podpisati z neustreznim zneskom. |
| R-12 | — | Vračilo drobiža pri gotovini | Ni del TSE zneska plačila — ostaja izven fiskalnega zapisa, a mora biti viden v UI kalkulatorju drobiža. |
| R-13 | P1 | Delno plačilo: kupec plača 30 od 100 €, nato odide | Račun ostane PARTIALLY_CAPTURED, opomin mora vedeti za preostanek. |
| R-14 | — | Kombinirano plačilo: del kartica uspe, del gotovina odpove | Dva ločena PaymentAttempt zapisa — uspeli del ostane CAPTURED tudi če drugi pade. |
| R-15 | — | Obročno plačilo: 1. obrok kartično, 2. gotovina, 3. zamuja | Vsak obrok = svoj PaymentAttempt/Payment, povezan na skupni installment plan; zamuda ne spremeni že plačanih. |
| R-16 | — | Kupec zahteva vračilo dan po nakupu, terminal offline | Vračilo ni dovoljeno v offline queue brez potrditve TSE/ponudnika ob ponovni povezavi. |
| R-17 | P0 | Vračilo poskušano dvakrat (dvojni klik na "Povrni") | Enako kot R-01, na Refund idempotency ključu — preverjeno: Stripe pot že uporablja `idempotencyKey`. |
| R-18 | — | Delno vračilo, nato še eno do skupno > original | DB mora zavrniti (preverjeno: `remaining = amount − refunded`, zahteva > 0). |
| R-19 | — | Storno računa po tem, ko je bil delno plačan | Storno mora ustvariti vračilo za že plačani del, ne le izbrisati terjatev. |
| R-20 | — | Dobropis za napačno postavko na že izdanem računu | Nov dokument (Gutschrift/Korrekturrechnung), izvirni račun ostaja nespremenjen (immutable trigger). |
| R-21 | — | Popust dodan po tem, ko je bil izdan račun brez popusta | Ne sme popraviti obstoječega računa — nov korekturni dokument z razliko. |
| R-22 | — | Reklamacija: kupec trdi, da ni prejel blaga po plačilu | Ni avtomatiziran POS state — gre v obstoječi "Izvedba"/spor tok. |
| R-23 | P1 | Zaokroževanje: vsota postavk po centih ≠ prikazani skupni znesek | Preverjeno: DDV se računa na nivoju vrstice — preveri robni primer 0,005€ zaokroževanja pri liho št. postavk. |
| R-24 | — | Mešane DDV stopnje na istem računu (7% + 19%) | Preverjeno: `tax_rate_bps in (0,700,1900)` po postavki — podprto. |
| R-25 | P1 | Dvojna izdaja številke računa ob sočasnem zaključku dveh naprav | Preveri eksplicitno row-level locking pri increment `next_invoice_sequence` pod konkurenco. |
| R-26 | — | Test/sandbox račun se pomeša s pravim v štetju prometa | Preverjeno: `is_test` boolean loči `TEST-` prefiks in ločeno zaporedje. |
| R-27 | — | Zaključek dneva medtem ko je še en poskus v PROCESSING | Ne sme biti dovoljen, dokler obstajajo odprti PROCESSING/RECONCILIATION_REQUIRED poskusi. |
| R-28 | P0 | Blagajniška razlika (Kassendifferenz) ob zaključku izmene | Mora se zabeležiti kot `variance_cents` z obveznim komentarjem, nikoli tiho popraviti. |
| R-29 | — | Izmena se nikoli formalno ne zaključi (obrtnik pozabi) | Naslednji dan mora UI jasno opozoriti na odprto izmeno pred novo prodajo. |
| R-30 | — | Zaposlenec brez PIN dovoljenja poskusi izvesti vračilo | Vračilo/storno naj bosta privzeto rezervirana za lastnika/manager vlogo. |
| R-31 | — | PIN pozabljen — potreba po admin resetu | Reset mora pustiti AuditEvent sled (kdo, kdaj), ne tih reset. |
| R-32 | — | Dve napravi (telefon + tablica) hkrati na istem računu | Optimistic concurrency: kdor prvi zaključi, zaklene račun za drugega. |
| R-33 | P1 | Kartični podatki bi se skoraj shranili v log ob napaki | Preverjeno pozitivno: `console.error` beleži samo kodo/ID, ne payload — načelo mora veljati povsod. |
| R-34 | — | Uporabnik izklopi telefon sredi tiskanja Belega | Digitalni Beleg (SMS/e-pošta/QR) mora biti privzeta varovalka, ne odvisen izključno od tiskalnika. |
| R-35 | — | Kupec noče vzeti Belega | Pravno OK (§146a: izdati, ne vsiliti) — UI ne sme blokirati zaključka. |
| R-36 | — | DSFinV-K izvoz zahtevan sredi aktivne izmene | Izvoz zajame samo zaključene transakcije do trenutka zahteve, ne blokira odprte PROCESSING. |
| R-37 | P1 | TSE naprava fizično odklopljena/pokvarjena | Prodaja se lahko nadaljuje z ročnim beleženjem in obvezno kasnejšo dopolnitvijo; UI ponudi "izredni način" z jasnim opozorilom. |
| R-38 | — | Menjava TSE naprave (nova serijska št.) | Zahteva prijavo Finanzamtu v 1 mesecu (§146a Abs. 4) — opomnik/checklist ob menjavi naprave. |
| R-39 | — | Refund zahtevan za plačilo, ki je še RECONCILIATION_REQUIRED | Mora biti blokirano. |
| R-40 | — | Webhook dogodek prispe pred odgovorom na Checkout redirect | Preverjeno kot podprto: `pos_apply_stripe_event` ločen od `pos_register_stripe_checkout`, vrača `matched` zastavico. |
| R-41 | — | Webhook dogodek prispe dvakrat (Stripe at-least-once) | Preverjeno: dedup obstaja prek `p_event_id` in `duplicate` zastavice. |
| R-42 | — | Uporabnik spremeni sistemski čas telefona nazaj med PROCESSING | TSE validacija preverja `finishedAt >= startedAt` — dobra obramba; rekoncilacija naj uporabi strežniški čas, ne lokalni. |
| R-43 | — | Obrtnik menja iz Kleinunternehmer (§19 UStG) v redno obdavčitev sredi meseca | Preverjeno: `tax_mode` se validira proti profilu ob vsaki izdaji; stare fakture ostanejo nespremenjene (immutable). |

---

## 7. Nevaren primer: fantomski neuspeh

> **Uporabnik vidi na zaslonu "Plačilo ni uspelo" ali timeout, ponudnik pa je denar dejansko že bremenil.** Če aplikacija na to reagira s ponudbo "Poskusi znova" in uporabnik znova zaračuna isti znesek, je kupec bremenjen dvakrat — najresnejša mogoča napaka v celotnem POS toku.

**Zakaj se to zgodi:** HTTP/omrežna povezava med terminalom in strežnikom (ali med strežnikom in ponudnikom) se lahko prekine PO tem, ko je ponudnik zahtevo že prejel in obdelal, a PREDEN je odgovor prispel nazaj do terminala. Aplikacija v tem trenutku objektivno ne ve, ali je plačilo uspelo — edina napaka je, če se odloči, da to pomeni "ni uspelo".

**Varen postopek — korak za korakom:**

1. Terminal ob prehodu v PROCESSING **trajno shrani** `PaymentAttempt.id` (idempotency key) lokalno in na strežniku, PRED pošiljanjem ponudniku. Ključ mora preživeti crash/reload.
2. Ob timeoutu/izgubi povezave terminal **ne prikaže** "neuspeh" — prikaže nevtralno "Preverjamo stanje plačila" in preide v UNKNOWN → takoj RECONCILIATION_REQUIRED. Nobena uporabniška akcija (ponoven "Plačaj") ni na voljo.
3. Strežnik (ne terminal!) sproži **status poizvedbo** pri ponudniku po istem idempotency key/PaymentIntent ID — to je GET/read-only klic, nikoli nov charge.
4. Če poizvedba pokaže **uspeh**: RPC atomsko zapiše Payment kot CAPTURED, poveže z originalnim PaymentAttempt, sproži izdajo Belega. Idempotenca na DB nivoju je zadnja varovalka (preverjeno: obstoječi `pos_manual_payment_requests` vzorec je pravi predlog za posplošitev sem).
5. Če poizvedba pokaže **neuspeh**: zapiše se DECLINED/FAILED, šele zdaj UI ponudi nov poskus z **novim** idempotency ključem.
6. Če ponudnik tudi sam ne ve: stanje ostane RECONCILIATION_REQUIRED, UI po ~60–120s ponudi "Pokliči podporo" in prikaže referenčno številko. To je edini primer, kjer je dovoljen ročni `manual_override` v Reconciliation tabeli — in samo z zabeleženim razlogom in podpisom osebe.
7. Ozadenjski worker ponavlja poizvedbo v razmiku (10s, 30s, 60s, 5min) za vsak zapis, ki ostane v RECONCILIATION_REQUIRED dlje kot nekaj sekund — ne čaka samo na uporabnikov naslednji obisk zaslona.

**Zakaj obstoječa gotovinska koda že dokazuje, da je to izvedljivo:** v `api/_lib/pos-cash-checkout.js` je natanko ta vzorec že implementiran za TSE podpis: če `tse.sign()` vrže napako, se zapis NE označi kot COMPLETED, ampak preide v RECOVERY_REQUIRED in metoda vrže `CASH_RECOVERY_REQUIRED` namesto tihe napake. Vprašanje je samo, ali je enaka disciplina uveljavljena tudi za kartično (Stripe) pot — [ODPRTO]: obstaja `action:"status"` GET pot v `pos-stripe-checkout.js`, ki bi lahko služila temu namenu, a nisem preveril, ali jo terminal UI dejansko kliče avtomatsko ob timeoutu.

---

## 8. Threat model

| Grožnja | Vektor | Vpliv | Obstoječa obramba / manjko |
|---|---|---|---|
| Dvojno bremenjenje kupca | Retry po timeoutu, dvojni klik, crash+reload | Finančna škoda kupcu, spor, ugled | ✓ Idempotency ključi obstajajo → potrebna enotna rekoncilacija za kartico (§7) |
| Kraja/uhajanje kartičnih podatkov (PAN, CVV) | Log, error sporočilo, network capture | PCI DSS kršitev, pravna odgovornost | ✓ Stripe Checkout (hosted page) — PAN nikoli ne pride v aplikacijo/strežnik; logi beležijo samo kode napak |
| Manipulacija fiskalnih zapisov (davčna utaja) | Izbris/urejanje transakcij, izklop TSE | Kazenska odgovornost obrtnika, KassenSichV kršitev | ✓ Immutable invoice trigger, TSE podpis, WORM arhiv → preveri alarm ob "izrednem načinu brez TSE" (R-37) |
| Cross-tenant uhajanje podatkov | Napačna RLS politika | En obrtnik vidi podatke drugega | ✓ Dosledna RLS, `auth.uid() = user_id` vzorec |
| Webhook ponarejanje | Napadalec pošlje ponarejen Stripe webhook | Blago izdano brez plačila | ✓ `stripe.webhooks.constructEvent` preverja podpis; livemode dogodki zavrnjeni v test okolju |
| Replay starega/zastarelega vračila | Pozen/podvojen webhook z manjšim refunded_cents | Prikaz manjšega vračila, zmeda v knjigah | ✓ `pos_preserve_refund_progress` trigger — monoton |
| Odklop naprave med izmeno (device spoofing) | Neregistrirana naprava izvaja transakcije | Otežena revizijska sled, kršena Mitteilungspflicht | → Ni najdene device-registracijske tabele (§5) |
| Insider zloraba (lažno vračilo sebi) | Zaposlenec z dostopom do vračil brez nadzora | Finančna izguba, prikrita v prometu | → Vloge/PIN dovoljenja za vračilo/storno niso bile del pregledane kode (R-30) |
| Man-in-the-middle na terminalu (javni WiFi) | Prestrežena komunikacija terminal↔strežnik | Prestrežen token, manipulacija zneska | ✓ HTTPS povsod, Bearer token auth; preveri CSP/HSTS na terminal domeni |
| Fizična kraja terminala z odklenjeno sejo | Naprava ostane odklenjena med izmenami | Nepooblaščen dostop do vračil/nastavitev | → Avtomatski PIN-lock po neaktivnosti ni bil del pregledane kode |

---

## 9. Nemška compliance matrika

> Spodnje je tehnično-produktna interpretacija primarnih virov, **ne pravno ali davčno mnenje**. Vsaka vrstica označena [POTRDI] zahteva potrditev nemškega Steuerberaterja/pravnika pred zanašanjem v produkciji.

| Zahteva | Kaj pomeni za POS | Trenutno stanje v kodi | Primarni vir |
|---|---|---|---|
| **KassenSichV** + TSE (§146a AO) | Vsaka elektronska blagajna potrebuje certificirano TSE, ki nespremenljivo podpiše vsako transakcijo | ✓ TSE arhitektura strukturno pravilna; produkcijski TSE zaklenjen — samo training/mock | https://www.gesetze-im-internet.de/kassensichv/ |
| **§146a AO** — osnovna norma | Pravna podlaga za KassenSichV in Belegausgabepflicht | ni presojano ločeno | https://www.gesetze-im-internet.de/ao_1977/__146a.html |
| **Belegausgabepflicht** (§146a AO) | Vsak POS zaključek (tudi gotovinski, tudi majhen znesek) mora ponuditi Beleg — kupec ga ni dolžan vzeti | [POTRDI] ali UI to dosledno ponuja pri VSEH poteh, ne le glavnem toku | https://www.bundesfinanzministerium.de/Content/DE/FAQ/FAQ-steuergerechtigkeit-belegpflicht.html |
| **§146a Abs. 4 AO** — Mitteilungspflicht | Vsak elektronski zapisovalni sistem/TSE je treba prijaviti Finanzamtu prek Mein ELSTER v 1 mesecu od nabave/ukinitve | [POTRDI]; priporočilo: checklist/opomnik ob aktivaciji in menjavi naprave (R-38); brez Device tabele (§5) težko avtomatizirati | https://www.elster.de/eportal/formulare-leistungen/alleformulare/aufzeichnung146a , https://www.bundesfinanzministerium.de/Content/DE/Downloads/Steuern/FAQ-Ausfuellanleitung.html |
| **GoBD** (zadnja sprememba 14.7.2025) | Nespremenljivost, popolnost, pravočasnost, sledljivost; Verfahrensdokumentation obvezna | ✓ GoBD Verfahrensdokumentation PDF generator obstaja s testi; immutable invoice trigger ustreza nespremenljivosti | https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Weitere_Steuerthemen/Abgabenordnung/2025-07-14-GoBD-2-aenderung.pdf |
| **Aufbewahrungsfrist** | Retencija skrajšana z 10 na 8 let (BEG IV, od 1.1.2025) | [POTRDI] ali WORM retencijska politika že odraža 8 (ne 10) let | isti BMF GoBD dokument |
| **DSFinV-K** | Standardiziran izvozni format za Z3 dostop pri davčni reviziji; trenutna verzija 2.5 | ✓ `app/pos-dsfinvk.js` obstaja z lastnimi testi (TRAINING model, cash movements, export) | https://www.bzst.de/DE/Unternehmen/Aussenpruefungen/DigitaleSchnittstelleFinV/digitaleschnittstellefinv_node.html |
| **E-Rechnung Pflicht** (B2B) | Od 1.1.2025 sprejem obvezen; izdaja v strukturiranem formatu postopoma obvezna do 1.1.2028 (prag 800.000 € za 2027) | ✓ KoSIT/XRechnung validacija in generator obstajata, vgrajena kot pogoj izdaje za javne/2028+ primere | https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.html , https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Umsatzsteuer/2024-10-15-einfuehrung-e-rechnung.pdf |
| **PCI DSS** (mednarodni, ne nemški, a obvezen) | Aplikacija ne sme nikoli videti/shraniti PAN/CVV — hosted checkout je pravilna izbira | ✓ ni sledi kartičnih podatkov v shemi/kodi, Stripe hosted Checkout | PCI Security Standards Council (ni nemški vir) |
| **§35a EStG** (Handwerkerleistungen) | Ločevanje delovnega/materialnega dela postavke za davčni odbitek gospodinjstev | ✓ `eligible_35a_cents` stolpec, kategorije `labour/travel/machine` se štejejo | [POTRDI] — primarni vir ni bil preverjen v tej seji |

---

## 10. UX priporočila za mobilni POS (enoročna hitra uporaba)

- **Palec-cona prva:** gumb "Plačaj"/potrditev vedno v spodnji tretjini zaslona.
- **Ni dvojnega branja:** med PROCESSING/RECONCILIATION_REQUIRED je zaslon namensko "prazen" razen enega sporočila in ene animacije — obrtnik mora med hrupno delavnico/gradbiščem razumeti stanje na en pogled.
- **Zvočna/haptična povratna informacija** ob CAPTURED in DECLINED — roke so pogosto umazane/v rokavicah.
- **Velike tipke za znesek** (numerična tipkovnica, ne drsnik).
- **Jasna pot nazaj po vsakem koraku, RAZEN v PROCESSING** (namerna odsotnost, glej §3).
- **Offline indikator vedno viden** (trajna ikona v vrhu, ne samo ob napaki).
- **Kontrast na soncu:** POS se pogosto uporablja zunaj — visok kontrast za kritična stanja, ne zanašati se samo na barvni odtenek.
- **Velik, nedvoumen prikaz zneska tik pred "Plačaj"** — najpogostejši realen napačni-znesek scenarij je tipkarska napaka, ne sistemska.

---

## 11. Predlog besedil za kritična stanja

**RECONCILIATION_REQUIRED — obrtniku (SL UI):**
> Preverjamo plačilo …
> Povezava se je prekinila, medtem ko je banka obdelovala plačilo. Preverjamo pri ponudniku, ali je uspelo. To lahko traja do minute — ne poskušajte znova zaračunati.
Po 60s brez razrešitve: dodaj sekundarni gumb "Pokliči podporo" + prikaži referenčno št. poskusa.

**RECONCILIATION_REQUIRED razrešen kot CAPTURED:**
> Plačilo je uspelo
> Potrjeno pri ponudniku po krajši prekinitvi povezave. Znesek {amount} € je bil zaračunan enkrat.

**DECLINED — zaslon za stranko (DE):**
> Zahlung nicht möglich
> Ihre Bank hat die Zahlung abgelehnt. Bitte versuchen Sie es mit einer anderen Karte oder wählen Sie eine andere Zahlungsart.

**Gotovina, TSE recovery_required — obrtniku:**
> Gotovino zadržite
> Davčni podpis še ni potrjen. Gotovine stranki še ne vračajte niti ne oddajte kot uspešno prodajo — poskus se samodejno preverja.

**Belegausgabepflicht — ponudba potrdila (DE):**
> Beleg
> Möchten Sie den Kassenbon per SMS, E-Mail oder Ausdruck erhalten? Sie sind nicht verpflichtet, ihn anzunehmen.

**Offline queue — obrtniku:**
> Brez povezave
> Plačilo je shranjeno in bo obdelano takoj, ko se poveže internet. Gotovinsko/ročno plačilo lahko potrdite zdaj; kartično plačilo počaka na povezavo.

---

## 12. Testni načrt

| Nivo | Kaj pokriva | Primer / obstoječi vzorec za ponovno rabo |
|---|---|---|
| Unit | Čiste funkcije: DDV split, zaokroževanje, state machine prehodi, TSE signature validacija | `normalizeCashReceipt`, `validateSignature` že imata jasno testljivo čisto obliko |
| Integration | API handler + realen (test) Postgres: idempotenca, RLS, immutable trigger | Obstoječi vzorec: `scripts/test-pos-*.js` |
| Contract | Stripe/TSE webhook payload oblika se ne spremeni tiho pod nogami | Snapshot testi na `normalizeEvent()` izhodu za vsak dogodek tip |
| Simulator | Mock TSE/Stripe, ki namerno vrača timeout/negotov izid | `mockTseAdapter({fail:true})` že obstaja — razširi na Stripe test doubles za R-02/R-03/R-04 |
| Offline | Prekini omrežje sredi toka, preveri queue in ponovno sinhronizacijo | Nov testni sloj — [ODPRTO], §16 |
| Chaos | Naključno prekini povezavo/ubij proces med vsakim korakom state machine | Nov — najvišja prioriteta za R-02/R-04 |
| E2E | Realen brskalnik skozi cel UI tok, vklj. tiskanje/pošiljanje Belega, zaključek izmene | Obstoječ Playwright vzorec v repozitoriju kot precedens za orodje |

---

## 13. Ugotovitve po prioritetah

| Prio | Ugotovitev | Vrsta |
|---|---|---|
| P0 | Ni potrjenega samodejnega rekoncilacijskega mehanizma za kartično plačilo po timeoutu/izgubi povezave (R-02, R-03, R-04) | [ODPRTO] → preveri/implementiraj |
| P0 | Ni enotnega PaymentAttempt nivoja idempotence, skupnega kartici/gotovini/ročnemu | [PRIPOROČILO] |
| P0 | Ni CashSession/blagajniški dnevnik modela — brez njega ni nadzora nad Kassendifferenz (R-28) | [ODPRTO] |
| P1 | Ni Device registra — otežuje §146a Abs.4 Mitteilungspflicht disciplino (R-38) | [ODPRTO] |
| P1 | Offline queue za plačila (točka 7 naročila) ni bila najdena v pregledanem delu kode | [ODPRTO] |
| P1 | Vloge/PIN dovoljenja za vračilo/storno niso bile del pregledane kode | [ODPRTO] |
| P1 | Concurrent-naprava zaklep na nivoju enega računa (R-32) ni bil potrjen | [ODPRTO] |
| P2 | Ločena Refund tabela namesto samo kumulativnega stolpca | [PRIPOROČILO] |
| P2 | Retencijska politika WORM arhiva — preveri 8 (ne 10) let po BEG IV | [POTRDI] |
| P2 | Auto-lock terminala po neaktivnosti | [PRIPOROČILO] |
| P3 | Zvočna/haptična povratna informacija za delo v rokavicah/hrupu | [PRIPOROČILO] |
| P3 | §35a EStG primarni vir ni bil preverjen v tej seji (samo koda) | [POTRDI] |

---

## 14. Merila sprejema — P0 in P1

| Naloga | Merilo sprejema (Definition of Done) |
|---|---|
| Kartična rekoncilacija po timeoutu (P0) | Chaos test, ki namerno prekine povezavo v vsakem od PROCESSING/AUTHORIZED podstanj, v 100/100 ponovitvah pripelje TOČNO do enega od: CAPTURED (potrjeno pri ponudniku) ali DECLINED/FAILED — nikoli dvojno bremenjenje, nikoli trajno obtičal UNKNOWN brez alarma po 5 min. |
| Enoten PaymentAttempt (P0) | En sam idempotency mehanizem (DB-nivo unique constraint na `attempt_id`) pokriva kartico, gotovino IN ročno potrditev; obstoječi ločeni vzorci migrirani brez izgube zgodovinskih podatkov. |
| CashSession model (P0) | Ni mogoče izvesti gotovinskega plačila brez odprte izmene; zaključek zahteva vnos preštetega zneska in avtomatsko izračuna/prikaže razliko; razlika ≠ 0 zahteva obvezen komentar. |
| Device register (P1) | Vsaka nova naprava, ki izvede prvo TSE transakcijo, ustvari zapis z opozorilom "Prijavite napravo na Finanzamt (§146a Abs. 4 AO) v 1 mesecu" in sledi potrditvi prijave. |
| Offline queue (P1) | Ročno/gotovinsko plačilo brez povezave se po ponovni vzpostavitvi poveže z originalnim računom brez podvajanja; kartično plačilo je offline eksplicitno onemogočeno (ne queued). |
| Vloge za vračilo/storno (P1) | Uporabnik brez ustrezne vloge/PIN-a ne vidi/ne more klikniti gumba za vračilo/storno; vsak dogodek nosi AuditEvent z identiteto izvajalca. |
| Concurrent-device zaklep (P1) | Dva sočasna poskusa na istem računu z različnih naprav: drugi dobi jasno sporočilo "Račun se že obdeluje na drugi napravi". |

---

## 15. Varen fazni načrt izvedbe

| Faza | Obseg | Zakaj v tem vrstnem redu |
|---|---|---|
| 0 — Potrditev dejstev | Razvijalec potrdi/ovrže vse [ODPRTO] točke (§16) v celotni kodni bazi (vklj. neprebranih delov `pos-terminal.js`) | Brez tega je vsaka naslednja faza lahko rešitev za problem, ki morda že obstaja drugje ali ne obstaja |
| 1 — Read-only rekoncilacijska poizvedba (P0) | Dodaj/preveri status-lookup klic ob UNKNOWN za kartico; ne spreminja obstoječih uspešnih poti | Najvišje razmerje tveganje/korist — čisto dodajanje |
| 2 — Enoten PaymentAttempt (P0) | Nova tabela + migracija podatkov iz obstoječih; stari vzorci ostanejo delujoči vzporedno do preklopa | Temelj za vse nadaljnje, a mora iti PO fazi 1 |
| 3 — CashSession (P0) | Nova tabela, UI za odprtje/zaključek izmene, obvezna pred gotovinskim plačilom | Neodvisno od faz 1-2, a zahteva mirno okno |
| 4 — Device register + Mitteilungspflicht opomnik (P1) | Nova tabela, checklist UI | Nizko tvegano, odvisno od tega, kako TSE aktivacija danes teče v produkciji (faza 0) |
| 5 — Offline queue (P1) | Service worker/lokalna vrsta za ročno/gotovinsko; eksplicitna onemogočitev kartice offline | Največji obseg — zadnja, gradi na stabilnem PaymentAttempt modelu iz faze 2 |
| 6 — Vloge in concurrent-lock (P1) | PIN/vloge za vračilo, verzija/lock stolpec na računu | Lahko teče vzporedno s fazo 5 |
| 7 — Produkcijska aktivacija | Šele po fazah 1-3 in zunanji potrditvi (Stripe live keys, TSE produkcijske poverilnice, pravni pregled) — glede na obstoječi `check-pos-production-readiness.js` gate | Nobena faza ne sme biti razlog za prehiter live preklop brez zunanjih potrditev |

---

## 16. Odprta vprašanja za preverbo v dejanski aplikaciji

- Ali obstaja kjerkoli v `app/pos-terminal.js` (6523 vrstic, ni v celoti prebrano) offline čakalna vrsta in samodejna ponovna sinhronizacija?
- Ali se GET `action:"status"` pot v `pos-stripe-checkout.js` dejansko kliče avtomatsko ob timeoutu, ali samo na uporabnikov ročni "Preveri stanje"?
- Ali obstaja kjerkoli v preostalih ~100 nepregledanih pos-migracijah tabela za blagajniško izmeno/dnevnik ali napravo, ki je ta pregled zgrešil?
- Kako je danes dejansko rešeno kombinirano/split plačilo v UI — kot dva ločena zaključka ali kot en sestavljen tok?
- Ali obstaja obročni plačilni načrt specifično za POS prodajo (ne za splošne terjatve v "Izvedba" modulu)?
- Kakšne vloge/PIN dovoljenja dejansko obstajajo danes za zaposlene na POS terminalu?
- Kakšna je trenutna retencijska nastavitev WORM arhiva v dnevih/letih — 8 ali 10?
- Ali produkcijski Fiskaly TSE ključi in Stripe live ključi sploh že obstajajo pripravljeni za preklop, ali je to še povsem odprto (glede na prejšnje ugotovitve: "local_training_complete", "sandbox_only")?

---

*Pripravljeno kot read-only audit, brez posegov v kodo, deploya ali oblikovanja novega UI-ja. Pravna in davčna določila zahtevajo potrditev nemškega Steuerberaterja/pravnika pred zanašanjem v produkciji — glej §9.*
