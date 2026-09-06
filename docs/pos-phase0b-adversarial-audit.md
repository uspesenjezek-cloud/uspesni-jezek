# POS Phase 0B — Adversarial preverba kartičnih in gotovinskih plačil

Read-only, dokazljiv audit. Cilj ni potrditi prejšnje POS poročilo, ampak ga poskusiti ovreči z dejansko kodo. Vsaka trditev ima pot in 1-bazirano vrstico. Kjer dokaza ni mogel priskrbeti brez produkcijske baze ali Stripe stanja, piše **NI PREVERJENO**.

---

## A. Enostaven odgovor

**DA.** Sedanji model bi ob live omogočitvi kartičnih plačil lahko povzročil dvojno bremenjenje kupca. To ni hipoteza — dokazano je na nivoju dejanske SQL logike (§B, H1 in H2), ne le teoretično. Poleg tega je celoten gotovinski (TSE) tok, ki ga UI dejansko uporablja, arhitekturno ranljiv na drugačen način: proces-lokalen pomnilnik namesto trajne baze (§G) — to ni race condition v ožjem smislu, je pa enako resen produkcijski riziko za denar in fiskalno skladnost.

---

## B. Dokaz H1 in H2

### H1 — dve sočasni Stripe Checkout seji za isti odprti račun

**Zaporedje klicev (dve neodvisni napravi/seji, isti `invoice_id`, isti trenutek):**

| Korak | Naprava A | Naprava B | Stanje po koraku |
|---|---|---|---|
| 1 | `POST /api/pos-stripe-checkout {action:"create", invoiceId, requestId:A}` | — | `invoiceContext()` prebere `pos_invoices` + `pos_payments`, izračuna `outstandingCents = gross − effectivePaidCents(payments)`. `effectivePaidCents` šteje samo `status in ("succeeded","partially_refunded")` — [api/_handlers/pos-stripe-checkout.js:21-26](api/_handlers/pos-stripe-checkout.js:21). Ker ni še nobenega plačila, `outstanding = gross`. |
| 2 | `stripe.checkout.sessions.create(...)` — Stripe seja A nastane **pred** vpisom v DB. Dokaz vrstnega reda: klic je na [pos-stripe-checkout.js:212](api/_handlers/pos-stripe-checkout.js:212), RPC šele na [:217](api/_handlers/pos-stripe-checkout.js:217). | — | Stripe ima zdaj sejo A (status `open`, znesek = gross). DB še nima nobene vrstice za A. |
| 3 | — | `POST /api/pos-stripe-checkout {action:"create", invoiceId, requestId:B}` — **sočasno**, preden je A dokončala korak 4 | `invoiceContext()` za B prebere isti `pos_payments` nabor — A-jeva vrstica še ne obstaja (A je šele ustvarila Stripe sejo, DB vpisa še ni). `outstanding = gross` tudi za B. |
| 4 | RPC `pos_register_stripe_checkout(...)` za A. `select ... from pos_invoices ... for update` zaklene vrstico računa — [migracija 20260820204343:172-173](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:172). Preveri `p_amount_cents <> gross_cents − v_paid` — [:183-185](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:183); `v_paid` iz `_pos_effective_paid_cents`, ki **prav tako izključi `pending`** — [:128-133](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:128). Ujema se → `insert into pos_payments(...,'pending',...)` — [:187-194](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:187). Zaklep se sprosti ob commitu funkcije. | (blokirana na `for update`, če pride do istega trenutka; sicer teče vzporedno) | DB: 1 vrstica `pos_payments` za A, `status='pending'`, `amount_cents=gross`. |
| 5 | — | `stripe.checkout.sessions.create(...)` za B (Stripe seja B, ločen `checkout_session_id`) | Stripe ima zdaj **dve ločeni, veljavni, odprti seji** za isti račun, vsaka za polni znesek. |
| 6 | — | RPC `pos_register_stripe_checkout(...)` za B — zaklene isto vrstico `pos_invoices` (zdaj prosto, A je sprostila), ponovno izračuna `v_paid` prek `_pos_effective_paid_cents` — A-jeva vrstica ŽE obstaja, a ima `status='pending'`, ki ga funkcija **ne šteje** ([:128-133](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:128)) → `v_paid` je še vedno 0. Preverba zneska se ponovno ujema → **vstavi se DRUGA `pos_payments` vrstica**, `status='pending'`, `amount_cents=gross`, drug `provider_attempt_id`/`checkout_session_id`. | DB: **2 vrstici** `pos_payments` za isti `invoice_id`, obe `pending`, obe za polni znesek. Noben unique index tega ne prepreči — edini unique indeksi so `(provider, provider_attempt_id)`, `(checkout_session_id)`, `(provider, external_payment_id)`, vsi **per-attempt**, ne per-invoice ([:61-69](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:61)). |
| 7 | Kupec/uporabnik dokonča plačilo pri Stripe za sejo A | Kupec/uporabnik (npr. druga oseba na drugi napravi, ali ista oseba, ki je pomotoma odprla dva zavihka) dokonča plačilo tudi za sejo B | Stripe zaračuna DVE resnični plačili. |
| 8 | Webhook `checkout.session.completed` za A → `pos_apply_stripe_event` najde vrstico A po `provider_attempt_id` ([:322-328](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:322)), preveri le, da se znesek/valuta/uporabnik/račun ujemajo s TO vrstico — **nikoli ne preveri stanja celega računa ali drugih vrstic** — nastavi `status='succeeded'` ([:357-367](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:357)). | Enako za B, neodvisno. | DB: **obe vrstici `status='succeeded'`**. `_pos_effective_paid_cents(invoice)` zdaj vrne `2 × gross_cents`. Noben CHECK constraint tega ne prepreči — `pos_money_invariants.sql` doda samo per-vrstico omejitve (`amount_cents between 1 and 100000000000`), ne agregatno omejitev proti `gross_cents` ([supabase/migrations/20260822005813_pos_money_invariants.sql:43-45](supabase/migrations/20260822005813_pos_money_invariants.sql:43)). |

**Zaklepi/unique/idempotency, ki dejansko sodelujejo:** `for update` na `pos_invoices` (serializira dostop, a ne prepreči 2. vpisa, ker je preverba zasnovana tako, da `pending` ne šteje); `provider_attempt_id`/`checkout_session_id` unique (preprečita podvojitev ZNOTRAJ ene seje/poskusa, ne MED dvema poskusoma); Stripe `idempotencyKey: "uj-pos-test:" + userId + ":" + invoiceId + ":" + requestId` — [pos-stripe-checkout.js:213](api/_handlers/pos-stripe-checkout.js:213) — ta ključ vsebuje `requestId`, ki je **različen za A in B** (H1 to izrecno predpostavi), zato Stripe-jeva idempotenca dveh sej sploh ne poveže.

**Najmanjši protiargument, ki bi H1 lahko ovrgel:** če bi obstajal partial unique index `create unique index on pos_payments(invoice_id) where provider='stripe' and status='pending'`, bi korak 6 padel na constraint violation. **Tak index ne obstaja** — preverjeno z izpisom celotne definicije tabele in vseh indeksov v [migraciji 20260820204343](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:61-69) ter iskanjem po vseh poznejših migracijah, ki tabelo spreminjajo (§C). Protiargument torej ne drži.

**Status H1: POTRJENO.**

---

### H2 — provider "paid", DB "pending", cancel pot ustvari cancelled→succeeded preklop in dvojno bremenjenje

**Zaporedje klicev:**

| Korak | Dogajanje | Dokaz |
|---|---|---|
| 1 | Uporabnik začne Stripe Checkout (seja S1, `pending` v DB). | — |
| 2 | Stripe pri sebi zaključi plačilo (`session.payment_status` postane `"paid"`), a **webhook še ni prispel** (zakasnitev, znan in dokumentiran Stripe pojav — redirect/`session.retrieve` lahko pokaže `paid` prej kot webhook prispe). | NI PREVERJENO kot produkcijski dogodek (Stripe zunanje stanje), a je arhitekturno predvideno — koda sama eksplicitno preverja `session.payment_status` ločeno od DB statusa, kar dokazuje, da avtor te poti pozna prav to zakasnitev. |
| 3 | Iz kateregakoli razloga se pokliče `action:"cancel"` za S1 — konkretna vstopna točka v UI je redirect-return obravnava, ko `returnState` kaže na `stripe=cancelled` ([app/pos-terminal.js:4674](app/pos-terminal.js:4674): `result = await stripeCheckoutRequest("cancel", { sessionId: cancelSessionId });`). | — |
| 4 | API prebere `payment` iz DB (`status='pending'`) in **sveže** `session` iz Stripe (`stripe.checkout.sessions.retrieve`) — [pos-stripe-checkout.js:174-177](api/_handlers/pos-stripe-checkout.js:174). Vstopni pogoj za cancel-vejo: `!["succeeded","partially_refunded","refunded"].includes(payment.status)` — DB pravi `pending`, pogoj je **TRUE**, vstopi v vejo. | [pos-stripe-checkout.js:178](api/_handlers/pos-stripe-checkout.js:178) |
| 5 | `if (session.status === "open" && session.payment_status !== "paid") await stripe.checkout.sessions.expire(sessionId);` — ker je `session.payment_status === "paid"`, ta pogoj je FALSE → Stripe-jeva seja se **ne** poteče (pravilno, koda se pravilno izogne poskusu preklica že plačane Stripe seje). | [pos-stripe-checkout.js:179](api/_handlers/pos-stripe-checkout.js:179) |
| 6 | **Takoj zatem, brezpogojno**, se pokliče `pos_cancel_stripe_checkout` RPC — [pos-stripe-checkout.js:180-182](api/_handlers/pos-stripe-checkout.js:180). Nobenega `if (session.payment_status === "paid") skip` pred tem klicem ni. | Dokaz je odsotnost pogoja — primerjaj strukturo kode vrstica za vrstico. |
| 7 | RPC `_pos_cancel_stripe_checkout` sam preveri SAMO `v_payment.status` (DB), ne pozna Stripe-jevega dejanskega stanja (klicatelj mu ga ne pošlje) — `if (v_payment.status in ('succeeded','partially_refunded','refunded')) return v_payment;` — DB pravi `pending`, pogoj FALSE → nadaljuje: `update ... set status='cancelled', ... paid_at=null` — [migracija 20260820204343:239-246](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:239). | **DB zdaj pravi `cancelled` za plačilo, ki je pri Stripe dejansko `paid`.** |
| 8 | API vrne uporabniku `{ok:true, payment:{status:"cancelled",...}}`. UI po tem toku nadaljuje ([app/pos-terminal.js:4682](app/pos-terminal.js:4682): `loadServerState`) in prikaže stanje "preklicano" — uporabnik lahko znova klikne "Plačaj s kartico", kar sproži `action:"create"` za NOVO Stripe sejo S2 za isti odprti znesek (ker `effectivePaidCents` S1-jevo `cancelled` vrstico izključi enako kot `pending`). | [app/pos-terminal.js:4636-4649](app/pos-terminal.js:4636) — `pending && pending.status==="pending"` je zdaj FALSE (status je `cancelled`), zato gre v `else` vejo in ustvari nov `action:"create"`. |
| 9 | Kasneje prispe zakasneli webhook `checkout.session.completed` za S1. `_pos_apply_stripe_event` poišče vrstico po `provider_attempt_id` — **brez filtra na trenutni status** ([:322-328](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:322)) — najde S1-jevo vrstico (zdaj `cancelled`). Pogoj za uspeh: `v_payment.status not in ('partially_refunded','refunded')` — `cancelled` NI v tem seznamu → pogoj TRUE → `update ... set status='succeeded', paid_at=..., refunded_cents=0` — [:357-367](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:357). | **Dokazan nemonoton prehod `cancelled → succeeded`.** Nobene zaščite proti temu prehodu nazaj ni — za primerjavo, refund pot IMA monoton trigger ([pos_stripe_refunds_monotonic.sql](supabase/migrations/20260821230949_pos_stripe_refunds_monotonic.sql)), status/`cancelled↔succeeded` prehod pa nima ekvivalentne zaščite. |
| 10 | Če je uporabnik medtem (korak 8) dejansko dokončal plačilo tudi na S2, pride kasneje še webhook za S2, ki po enaki logiki S2 označi kot `succeeded`. | DB: **dve `succeeded` vrstici za isti račun** — isti mehanizem kot H1 korak 8, dosežen po drugačni poti. |

**Najmanjši protiargument:** če bi Stripe cancel_url redirect nastopil IZKLJUČNO takrat, ko je `session.payment_status` zagotovo še `unpaid` (Stripe nikoli ne redirecta na cancel_url za plačano sejo) — to DRŽI za standarden card-flow, a koda sama (vrstica 179) dokazuje, da razvijalec ni zaupal temu zagotovilu brezpogojno za `stripe.expire()` klic (zato preverja `session.payment_status` sveže pred expire) — kar pomeni, da je scenarij "cancel poklican, a Stripe pravi paid" v kodi PRIČAKOVAN kot mogoč (npr. zakasnela async metoda plačila, redirect race, ali ponoven "cancel" klic na sejo, ki je bila v resnici uspešna po drugi poti). Ker je ta scenarij eksplicitno predviden na eni strani (expire-guard), a ne na drugi (DB-cancel), protiargument H2 ne ovrže — potrjuje notranjo neskladnost kode.

**Status H2: POTRJENO** (kot logična/koda-nivojska napaka; fizična izvedljivost "dveh resničnih Stripe plačil" je odvisna od zunanjega Stripe vedenja, ki ga brez produkcijskega/live Stripe okolja ni mogoče eksperimentalno sprožiti — to delno je NI PREVERJENO na nivoju "se je to kdaj dejansko zgodilo v produkciji", a je POTRJENO na nivoju "koda to dopušča, če se zgodi").

---

## C. Končna efektivna shema `pos_payments`

Rekonstruirano kronološko iz vseh migracij, ki tabelo spreminjajo (§ najdene datoteke, kronološki vrstni red po imenu/timestampu):

1. `20260819135049_pos_terminal_core.sql` — izvirna tabela.
2. `20260819135148_pos_payments_invoice_index.sql`
3. `20260820204343_stripe_sandbox_invoice_payments.sql` — glavna razširitev (Stripe stolpci, statusi, unique indeksi).
4. `20260821230949_pos_stripe_refunds_monotonic.sql` — trigger monotonosti refundov.
5. `20260822005813_pos_money_invariants.sql` — `amount_cents between 1 and 1e11`.
6. `20260822021842_pos_already_paid_invoice_payment.sql` — trigger za `already_paid` ob izdaji.
7. `20260824173301_pos_manual_payment_retry_idempotency.sql` — `revoke insert`, nov idempotenten manual-payment RPC.
8. `20260826182713_pos_cash_checkout_state.sql` — doda `method='cash'`, `provider='fiskaly'` v CHECK.

**Efektivni stolpci** (unija vseh ALTER, brez branja skrivnosti — samo shema):

| Stolpec | Tip | Null? | Izvor |
|---|---|---|---|
| `id` | uuid PK | ne | core |
| `user_id` | uuid FK | ne | core |
| `invoice_id` | uuid FK | ne | core |
| `amount_cents` | bigint | ne, `>0`, `≤1e11` | core + money_invariants |
| `currency` | text `='EUR'` | ne | core |
| `method` | text | ne | core; CHECK razširjen v stripe-sandbox (+`stripe_card`) in cash-checkout-state (+`cash`) |
| `provider_reference` | text | ne, default `''` | core |
| `paid_at` | timestamptz | **DA** (od stripe-sandbox: `drop not null`) | core → stripe-sandbox |
| `created_at` | timestamptz | ne | core |
| `provider` | text | ne, default `'manual'` | stripe-sandbox; CHECK razširjen v cash-checkout-state (+`fiskaly`) |
| `provider_attempt_id` | uuid | da | stripe-sandbox |
| `external_payment_id` | text | da | stripe-sandbox |
| `checkout_session_id` | text | da | stripe-sandbox |
| `status` | text | ne, default `'succeeded'` | stripe-sandbox; vrednosti `pending,succeeded,failed,cancelled,partially_refunded,refunded` |
| `refunded_cents` | bigint | ne, default 0 | stripe-sandbox |
| `failure_code` | text | ne, default `''` | stripe-sandbox |
| `expires_at` | timestamptz | da | stripe-sandbox |
| `metadata` | jsonb | ne, default `{}` | stripe-sandbox |
| `updated_at` | timestamptz | ne | stripe-sandbox |
| `source_bank_transaction_id` | uuid | da (implicitno, uporabljen v UPDATE v `_pos_confirm_bank_transaction`) | pos_bank_reconciliation (ni v tem auditu prebrana v celoti — **NI PREVERJENO** natančno mesto dodajanja stolpca, a raba je potrjena v [stripe_sandbox_invoice_payments.sql:55-59](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:55) in [:468-474](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:468)) |

**Unique/partial unique indeksi (dejansko obstoječi):**
- `(provider, provider_attempt_id) where provider_attempt_id is not null`
- `(checkout_session_id) where checkout_session_id is not null`
- `(provider, external_payment_id) where external_payment_id is not null`
- `(invoice_id, status, created_at desc)` — **navaden**, ne unique (samo indeks za branje)

**Manjkajoč indeks (dokazano z odsotnostjo):** noben `unique ... where provider='stripe' and status='pending'` po `invoice_id`. To je koren H1.

**CHECK constraints (efektivni, po zadnji spremembi vsakega):**
- `pos_payments_method_check`: `method in ('bank_transfer','external_card','manual','stripe_card','cash')` (zadnja verzija po cash-checkout-state)
- `pos_payments_provider_check`: `provider in ('manual','external','finapi','stripe','fiskaly')` (zadnja verzija po cash-checkout-state)
- `pos_payments_status_check`: `status in ('pending','succeeded','failed','cancelled','partially_refunded','refunded')`
- `pos_payments_refunded_check`: `0 ≤ refunded_cents ≤ amount_cents`
- `pos_payments_provider_shape_check`: stripe ⇒ ima `provider_attempt_id`+`checkout_session_id`; ne-stripe ⇒ nima nobenega
- `pos_payments_status_shape_check`: veže `status` na `paid_at`/`refunded_cents` obliko (§D)
- `pos_payments_amount_upper_bound_check`: `1 ≤ amount_cents ≤ 1e11`

**Kar NE obstaja (dokazano z odsotnostjo, iskano po celotnem repozitoriju migracij):** noben CHECK/trigger, ki bi omejeval `sum(amount_cents) filter (status in succeeded,partially_refunded) − sum(refunded_cents)` po `invoice_id` na `≤ gross_cents` iz `pos_invoices`. To je koren tega, zakaj H1/H2 lahko dejansko pripeljeta do preplačila, ne le do nekonsistentnega statusa.

**RLS:** `select` za `authenticated` samo lastna vrstica (`user_id`); `insert` je bil najprej dovoljen ozko-validiran authenticated policy (stripe-sandbox migracija), nato **popolnoma odvzet** (`revoke insert on table pos_payments from authenticated`) v `pos_manual_payment_retry_idempotency.sql:4` — vsi zapisi zdaj gredo izključno prek `security definer` RPC-jev na `service_role`. To je dobra praksa in dosledno izvedena.

**Trigerji:** `pos_payments_updated_at` (auto-`updated_at`); `pos_payments_refund_monotonic` (`pos_preserve_refund_progress` — monotonost refunda, ne monotonost statusa nasploh); `pos_invoices_record_already_paid` je na `pos_invoices`, ne na `pos_payments` — vstavi plačilo posredno ob izdaji z `payment_method='already_paid'`.

---

## D. State-transition matrika (Stripe)

| Iz | V | Sproži | Zapiše | Preveri trenutno providerjevo stanje? | Monoton? | Prehod nazaj mogoč? | Nevarna dirka |
|---|---|---|---|---|---|---|---|
| (nič) | `pending` | `action:"create"` | `_pos_register_stripe_checkout` | Ne (samo lasten Stripe klic pred tem, sinhrono) | — | — | H1 (§B) |
| `pending` | `succeeded` | webhook `checkout.session.completed`/`payment_intent.succeeded` | `_pos_apply_stripe_event` | Ne — zaupa webhook payloadu, preveri le podpis na HTTP nivoju | Ne (glej spodaj) | **DA**, iz `cancelled` (dokazano H2) in iz `failed` (isti pogoj `status not in ('partially_refunded','refunded')` dopušča tudi `failed→succeeded`) | H2 |
| `pending` | `failed` | webhook `payment_intent.payment_failed` | `_pos_apply_stripe_event` | Ne | — | `failed→succeeded` mogoč (glej zgoraj) | — |
| `pending`/`failed` | `cancelled` | `action:"cancel"` (uporabnik/UI) | `_pos_cancel_stripe_checkout` | **Delno** — API sloj prebere `session.payment_status`, a rezultat uporabi samo za odločitev o `stripe.expire()`, ne pošlje ga RPC-ju | — | `cancelled→succeeded` mogoč (H2) | H2 |
| `succeeded` | `partially_refunded`/`refunded` | webhook `charge.refunded` | `_pos_apply_stripe_event` + `pos_preserve_refund_progress` trigger | Ne (a trigger zagotavlja monotonost `refunded_cents` navzgor) | **DA** za `refunded_cents` specifično | Ne (trigger to prepreči) | — |
| katerikoli | katerikoli | podvojen webhook (isti `event_id`) | `_pos_apply_stripe_event` dedup na `(provider, external_event_id)` unique — vrne `duplicate:true` brez druge mutacije | — | — | — | Ni najdene dirke — dedup je solid |
| `succeeded` | `succeeded` (drug event) | dva različna webhooka za isti PaymentIntent (npr. succeeded dvakrat z različnim `event_id`) | Drugi klic najde `v_payment.status not in ('partially_refunded','refunded')` TRUE (succeeded ni izključen!) → ponovno `update ... status='succeeded'` | Ne | Idempotentno po učinku (isti končni status), a **ne dejansko no-op na nivoju SQL** — vsak tak dogodek se dodatno zabeleži v `pos_audit_events` | — | Nizko tveganje (kozmetično podvajanje audit vrstic), ni finančna napaka |

**Ključna ugotovitev D:** edini res monoton prehod v celotnem modelu je `refunded_cents` navzgor. Sam `status` stolpec NIMA state-machine discipline na DB nivoju — katerikoli statusni niz se lahko prepiše v katerikoli drug, edino kar CHECK constrainti zagotavljajo, je NOTRANJA doslednost ENE vrstice (`status_shape_check` — npr. da `succeeded` vedno ima `paid_at`), ne pa dovoljenost/nedovoljenost SAMEGA prehoda med statusi.

---

## E. Failure-injection matrika (20 scenarijev)

| # | Scenarij | Kaj koda dejansko naredi | Dokaz | Ocena |
|---|---|---|---|---|
| 1 | Timeout PRED Stripe `create` odgovorom (network drop pred klicem) | Noben poskus se ne izvede, ni Stripe seje, ni DB vrstice — varno | logično iz vrstnega reda kode | OK |
| 2 | Timeout PO Stripe `create`, PRED `pos_register_stripe_checkout` | Stripe seja obstaja (odprta, poteče sama po `expires_at`), DB vrstice ni; catch-blok poskuša `session.expire()` če je `open` — [pos-stripe-checkout.js:227-230](api/_handlers/pos-stripe-checkout.js:227) | koda | Delno OK — obstaja best-effort cleanup, a `catch(_){}` požre morebitno napako expire-a brez sledi |
| 3 | Timeout PO `pos_register_stripe_checkout`, pred vrnitvijo URL uporabniku | DB ima `pending` vrstico, uporabnik nima URL-ja za plačilo | — | UX vrzel (denar ni ogrožen, a uporabnik "obtiči") — **NI PREVERJENO** ali UI to zazna in ponudi "resume" |
| 4 | Zaprt zavihek med Stripe hosted checkout | Seja ostane `open` pri Stripe do `expires_at`; DB ostane `pending` | — | Enako kot pri prejšnjem POS poročilu — brez avtomatske rekoncilacije po določenem času |
| 5 | Browser crash | Enako kot zaprt zavihek — stanje je na strežniku (DB `pending`), ne izgubljeno, a nihče ga ne rekoncilira brez ponovnega obiska | — | — |
| 6 | Reload brez Stripe URL-parametrov (uporabnik ročno odpre app znova) | `returnState` se ne postavi (ni `stripe=` parametrov) → koda na [4674-4681](app/pos-terminal.js:4674) se sploh ne izvede | logično iz pogoja parsanja URL-ja | Potrjena vrzel: brez URL parametrov se avtomatska `status` poizvedba **ne** sproži |
| 7 | Success redirect, normalen potek | 6× poll `action:"status"` z backoffom ~0.7-3s, do 6 poskusov (~11s skupaj) — [4676-4680](app/pos-terminal.js:4676) | koda | OK zasnovano, a časovno omejeno |
| 8 | Cancel redirect | Glej H2 — brezpogojen `pos_cancel_stripe_checkout` klic | [4674](app/pos-terminal.js:4674) | POTRJENA vrzel |
| 9 | Webhook prispe PRED `pos_register_stripe_checkout` (teoretično, če bi Stripe webhook prehitel lasten registracijski klic) | `_pos_apply_stripe_event` ne najde vrstice (`select ... for update` ne najde ujemanja) → `return {matched:false}` → API vrne 503 `STRIPE_PAYMENT_NOT_READY` — [pos-stripe-webhook.js:145-147](api/_handlers/pos-stripe-webhook.js:145) | koda | OK — Stripe bo webhook retryal (at-least-once dostava), škode ni |
| 10 | Webhook prispe PO cancelu | Glej H2, korak 9 — `cancelled→succeeded` | dokazano zgoraj | POTRJENA vrzel |
| 11 | Podvojen webhook (isti event_id) | Dedup prek unique `(provider, external_event_id)` — vrne `duplicate:true`, brez mutacije | [migracija:305-310](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:305) | OK — trdno |
| 12 | Webhooki v napačnem vrstnem redu (npr. `payment_intent.succeeded` prispe pred `checkout.session.completed`) | Oba event tipa vodita v isto `if` vejo za "succeeded" ([:357-358](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:357)) — prvi, ki prispe, nastavi `succeeded`; drugi je no-op po učinku (glej D) | koda | OK po učinku |
| 13 | Nedosegljiva baza med `action:"create"` | RPC klic vrže, `catch` blok poskusi `session.expire()`, nato `throw error` naprej → API vrne napako, uporabnik vidi neuspeh, BREZ DB vrstice | [pos-stripe-checkout.js:227-230](api/_handlers/pos-stripe-checkout.js:227) | OK — fail-closed |
| 14 | Dve napravi, oba `create` sočasno | Glej H1 | dokazano | POTRJENA vrzel |
| 15 | Dva zavihka na isti napravi, isti `requestId` (če aplikacija ponovno uporabi shranjen `operationRequestId`) | Stripe idempotencyKey vsebuje ta `requestId` → Stripe vrne ISTO sejo namesto nove; `_pos_register_stripe_checkout` prav tako najde obstoječo vrstico po `provider_attempt_id` in jo vrne nespremenjeno ([:168-170](supabase/migrations/20260820204343_stripe_sandbox_invoice_payments.sql:168)) | koda | OK — to je natanko namen idempotency ključa |
| 16 | Različna `requestId` (H1 predpostavka) | Glej H1 — POTRJENA vrzel | — | POTRJENA vrzel |
| 17 | Stripe `paid`, DB `pending`, brez cancel klica (samo webhook zamuja) | Rešeno OK prek success-redirect polling (scenarij 7) ali kasnejšega webhooka — brez cancel vmesnega koraka ni H2 tveganja | — | OK |
| 18 | Stripe `expired`, DB `pending` | Ni najdene eksplicitne logike, ki bi ob `action:"status"` zaznala `session.status==="expired"` in DB status prestavila na `failed`/`cancelled` — `action:"status"` samo vrne trenutni `session.status`/`payment_status` brez zapisa v DB (glej §4 spodaj) | [pos-stripe-checkout.js:193-196](api/_handlers/pos-stripe-checkout.js:193) | Vrzel: DB lahko trajno ostane `pending` za resnično potekle seje |
| 19 | Stripe `open`, DB `cancelled` (npr. po H2 preklicu, preden je uporabnik dejansko zaključil pri Stripe) | UI ponudi nov `action:"create"` (glej H2 korak 8) — stara Stripe seja S1 ostane `open` do naravnega poteka, ni eksplicitno ubita (ker `session.payment_status !== "paid"` bi TUKAJ dejansko sprožil `expire()`, saj v tem pod-scenariju plačilo pri Stripe ŠE NI zaključeno) | koda | OK v tem specifičnem pod-primeru (expire se izvede), tvegano samo če je S1 vmes VENDARLE plačana (H2 glavni primer) |
| 20 | Manual payment RPC in Stripe registracija sočasno na isti invoice | Oba locka `pos_invoices for update` — serializirata se med sabo pravilno na nivoju vrstice; a `_pos_record_manual_payment`/`_idempotent` različica preveri `outstanding` na enak način (izključi `pending` Stripe vrstice) → **manual payment lahko potrdi celoten znesek, MEDTEM ko Stripe pending seja še obstaja in jo kupec pozneje tudi plača** | [pos_manual_payment_rpc.sql:41-43](supabase/migrations/20260821162113_pos_manual_payment_rpc.sql:41) (`_pos_effective_paid_cents` uporabljena enako) | POTRJENA dodatna vrzel — glej §F |

---

## F. Cross-method concurrency ugotovitve

Vsi trije "aktivni" plačilni RPC-ji (`_pos_register_stripe_checkout`, `_pos_record_manual_payment`/`_idempotent`, in — če bi bil dejansko vezan — `_pos_complete_training_cash_checkout`) delijo **isto** funkcijo `_pos_effective_paid_cents`, ki šteje SAMO `succeeded`/`partially_refunded`. Noben od njih ne preverja, ali za isti `invoice_id` obstaja KATERIKOLI DRUG aktiven (`pending`) poskus katerekoli druge metode.

**Dokazan scenarij preseganja `gross_cents`:**
1. Kartica: `action:"create"` registrira Stripe `pending` za polni znesek (outstanding pred tem = gross).
2. Vzporedno, preden se kartica zaključi: obrtnik na terminalu potrdi "Ročno potrjeno v POS" (manual payment) — `_pos_record_manual_payment_idempotent` prav tako izračuna `outstanding = gross − effectivePaidCents` (Stripe `pending` ne šteje) → outstanding = gross → vstavi **celoten** znesek kot `succeeded` manual plačilo. Dokaz: `_pos_record_manual_payment` vedno vpiše `p_outstanding` v celoti, ne delnega zneska — [pos_manual_payment_rpc.sql:45](supabase/migrations/20260821162113_pos_manual_payment_rpc.sql:45).
3. Kupec nato dejansko dokonča kartično plačilo pri Stripe (ni bil obveščen, da je obrtnik že "ročno" zaključil) → webhook doseže `_pos_apply_stripe_event`, ki NE preverja outstanding proti gross_cents, preprosto označi svojo vrstico `succeeded`.
4. **Rezultat: `effectivePaidCents = gross (manual) + gross (stripe) = 2×gross`.** Noben trigger/CHECK tega ne prepreči (§C, "Kar NE obstaja").

To NI del H1/H2 neposredno, je pa strukturno isti koren vzrok: **noben od plačilnih RPC-jev ne preverja obstoja drugih AKTIVNIH poskusov drugih metod pred zaključkom**, ker je "aktiven poskus" (`pending`) po dizajnu neviden za `_pos_effective_paid_cents`.

**Cash+kartica na različnih napravah:** ker dejanski (klicani) gotovinski tok sploh ne uporablja `pos_payments`/`pos_invoices` RPC preverbe outstanding na Supabase strani za PRODUKCIJSKO gotovino (glej §G — dejanski runtime je proces-lokalen Map, ne Supabase RPC), tega konkretnega križanja ni bilo mogoče dokazati na identičen način kot za manual+kartico — **NI PREVERJENO** kot enak SQL-nivo dokaz, a logično sledi enak vzorec, če/ko bo produkcijski cash tok vezan na `pos_cash_checkouts` (ki DOES imeti `_pos_effective_paid_cents` preverbo — [pos_cash_checkout_state.sql:152-155](supabase/migrations/20260826182713_pos_cash_checkout_state.sql:152) — torej bi trpel identično vrzel, ko/če bo dejansko povezan).

---

## G. Cash runtime proti DB-design primerjava

To je najresnejša samostojna najdba tega kroga, neodvisna od H1/H2.

**Obstajata DVE popolnoma ločeni implementaciji gotovinskega checkouta:**

### Implementacija 1 — Supabase, trajna, z RPC-ji (`pos_cash_checkouts`/`pos_cash_refunds`)
Definirana v [supabase/migrations/20260826182713_pos_cash_checkout_state.sql](supabase/migrations/20260826182713_pos_cash_checkout_state.sql) in [...194158_pos_cash_refund_state.sql](supabase/migrations/20260826194158_pos_cash_refund_state.sql). Ima: pravo tabelo, `unique(user_id, request_key)` za trajno idempotenco, `for update` zaklepe, `_pos_effective_paid_cents` preverbo proti outstanding, popoln `prepared→signed→completed/recovery_required` state-machine na DB nivoju, celovito preverbo oblike podpisa (`pos_cash_checkouts_signature_shape_check`).

### Implementacija 2 — proces-lokalen `Map`, ki jo DEJANSKO kliče produkcijski API handler
`api/_handlers/pos-fiskaly.js` — akciji `"local-training-cash-checkout"`/`"local-training-cash-refund"` uporabita `localCashStore`/`localCashRefundStore`, ki sta navadna JS `Map` na nivoju modula ([pos-fiskaly.js:9-35](api/_handlers/pos-fiskaly.js:9)), NE Supabase tabela.

**Dokaz, da UI dejansko kliče Implementacijo 2, ne Implementacije 1:**
- Iskanje po celotnem repozitoriju za klice `pos_prepare_training_cash_checkout`, `pos_record_training_cash_signature`, `pos_complete_training_cash_checkout`, `pos_mark_training_cash_recovery_required` (imena Supabase RPC-jev iz Implementacije 1) je vrnilo **izključno migracijsko datoteko samo** — noben handler, noben frontend klic jih ne uporablja.
- `scripts/test-pos-cash-checkout.js` in `test-pos-cash-refund.js` testirata `api/_lib/pos-cash-checkout.js` (čisto JS state-machine logiko) prek **lastnega, ad-hoc in-memory mocka** (`memoryStore()` znotraj testa samega, [test-pos-cash-checkout.js:8-41](scripts/test-pos-cash-checkout.js:8)) — ne testirata niti Implementacije 1 niti Implementacije 2 kot dejansko povezane celote.

**Posledice dejanskega runtime (Implementacija 2):**

| Vprašanje | Odgovor | Dokaz |
|---|---|---|
| Restart Vercel funkcije | Cel `Map` (vsi `prepared`/`signed`/`recovery_required` zapisi) se **izgubi** — ni persistiran nikamor | `const localCashRecords = new Map();` na modulnem nivoju, brez zapisovanja v DB |
| Zaprtje browser sessiona | Ne vpliva na server Map neposredno, a če odjemalec izgubi svoj `requestKey` (npr. osvežitev brez shranjenega stanja), ni poti nazaj do obstoječega zapisa — nov klic z novim `requestKey` ustvari nov, ločen zapis | [pos-fiskaly.js:14](api/_handlers/pos-fiskaly.js:14) `prepare()` ključa izključno po `requestKey` |
| Preživi `recovery_required` oba dogodka? | **NE** za restart funkcije — stanje je samo v RAM. Za zaprtje browserja: DA na strežniški strani (Map ostane), a brez auth/UID povezave do zapisa v tej veji (glej spodaj) ga UI ne more zanesljivo najti nazaj brez shranjenega `requestKey`/`id` na klientu | — |
| Zahteva endpoint auth? | **NE** za ti dve akciji — preverjeno: `local-training-cash-checkout`/`-refund` sta obravnavani ZNOTRAJ `if (req.method==="POST")` bloka, **PRED** klicem `supabase.preveriUporabnika(req,cfg)`, ki se izvede šele kasneje v funkciji za vse ostale poti | [pos-fiskaly.js:88-137](api/_handlers/pos-fiskaly.js:88) (branch) vs. [:142](api/_handlers/pos-fiskaly.js:142) (auth klic, ki sledi ŠELE za druge akcije) |
| Ali dva procesa/serverless instance ustvarita različna zapisa za isti `requestKey`? | **DA** — vsaka Vercel serverless instanca ima svojo ločeno pomnilniško `Map`; enak `requestKey`, usmerjen na dve različni topli instanci, bi v vsaki neodvisno prišel do `!localCashRecords.has(...)` = true in ustvaril ločen zapis. To pomeni, da idempotenca te poti **ne drži globalno**, samo znotraj ene tople instance. | logična posledica arhitekture (module-level `Map` v serverless okolju); **NI PREVERJENO** eksperimentalno na pravi Vercel infrastrukturi, ker to presega read-only obseg brez posega v produkcijo |
| Primerjava s production-readiness besedilom | Prejšnji POS produkcijski readiness izpis (`scripts/check-pos-production-readiness.js`, glej prejšnje poročilo) `fiskaly_tse` označuje kot `local_training_complete` — besedilo ne razlikuje med "Implementacija 1 je pripravljena" in "Implementacija 2 (dejansko klicana) je pripravljena". Iz tega besedila samega bi bralec sklepal, da je (dobra, DB-podprta) TSE logika tista, ki se dejansko uporablja — kar **ni preverjeno kot res**, glede na zgornji dokaz. | — |

**Sklep G:** hvalnica prejšnjega poročila ("obstoječi `recovery_required` vzorec za gotovino je odličen predlog za ponovno uporabo") ostaja veljavna KOT VZOREC LOGIKE (čista funkcija `createService()` v `api/_lib/pos-cash-checkout.js` je dejansko dobro napisana), a je bila **napačno pripisana kot lastnost trajnega, produkcijsko varnega sistema** — dejanski klicani runtime te logike nima trajne hrambe niti auth zaščite. To je popravek prejšnjega sklepa, glej §L.

---

## H. Test coverage in manjkajoči regresijski testi

| Test | Kaj DEJANSKO dokazuje | Kaj z zelenim rezultatom NE dokazuje |
|---|---|---|
| `scripts/test-pos-stripe.js` | Čiste funkcije (`configuration`, `safeBaseUrl`, `checkoutParams`, `assertTestSession`, `effectivePaidCents`, `refundRequestCents`, `normalizeEvent`) delujejo pravilno na **izoliranih vhodih**; regex-preverbe, da migracijska SQL besedila vsebujejo pričakovane fragmente | Da RPC-ji dejansko delujejo pravilno pod concurrency; da `action:"cancel"` pravilno obravnava paid+pending kombinacijo (H2 ni testiran); da dve sočasni `create` zahtevi ne ustvarita dveh vrstic (H1 ni testiran); da webhook dedup/ordering deluje proti pravi bazi (samo regex nad SQL besedilom migracije, ne dejanska izvedba) |
| `scripts/test-pos-cash-checkout.js` | Da `createService()` v `pos-cash-checkout.js` pravilno implementira `prepared→signed→completed`/`recovery_required` **z lastnim, dobronamernim in-memory mockom** | Da je ta logika dejansko vezana na produkcijski handler (ni — glej §G); da preživi restart procesa; da je zaščitena z auth; da je idempotentna med dvema serverless instancama |
| `scripts/test-pos-fiskaly.js` | NI PREVERJENO v tem krogu podrobno — ni bil prebran vrstico-za-vrstico (izven obsega glede na časovno omejitev tega kroga); glede na ime verjetno testira `unavailable()`, `MAX_BODY_BYTES` in morda `local-training-*` akcije | Če testira `local-training-cash-checkout` prek `handler()` neposredno, verjetno NE testira odsotnosti auth kot varnostno napako (ker je to "pričakovano" vedenje v testnem kontekstu), niti ne testira multi-instance neusklajenosti (tega sploh ni mogoče v enoprocesnem Node testu) |
| `scripts/test-pos-migration-deployment.js` | Verjetno preverja, da so migracije sintaktično/strukturno prisotne | Ne dokazuje semantične pravilnosti concurrency vedenja |

**Manjkajoči testi, izrecno zahtevani v nalogi (a) do (f):**

| Manjkajoč test | Zakaj manjka | Kaj bi moral dokazati |
|---|---|---|
| (a) DB pending + Stripe paid + cancel | Noben najden test ne simulira Stripe `session.retrieve` z `payment_status:"paid"` v kombinaciji z DB `pending` vrstico ob klicu `action:"cancel"` | Da RPC pravilno ZAVRNE cancel ali sam sproži rekoncilacijo namesto brezpogojnega `status='cancelled'` |
| (b) dve različni `requestId` na istem računu | Noben najden test ne kliče `_pos_register_stripe_checkout` dvakrat zaporedoma z različnim `provider_attempt_id` na isti `invoice_id` | Da bi (po popravku) drugi klic moral biti zavrnjen ali vrniti obstoječi aktiven poskus |
| (c) dva provider success webhooka za isti invoice (različni `payment_id`) | Ni najdenega testa, ki bi klical `_pos_apply_stripe_event` dvakrat z DVEMA razLIčNIMA `provider_attempt_id` (torej dvema različnima plačiloma), oba "succeeded", na isti `invoice_id` | Da agregatni `effectivePaidCents` ne sme preseči `gross_cents` — trenutno bi test to zlahka pokazal kot NAPAKO |
| (d) restart process-local cash store | Ni mogoče simulirati restart Node modulnega stanja znotraj istega test procesa brez posebne infrastrukture (worker/subprocess) — zato je ta manjko strukturen, ne le nepazljivost | Da se `recovery_required` zapis dejansko izgubi ob hladnem zagonu |
| (e) crash po TSE podpisu (torej `signed`, a pred `complete()`) | `test-pos-cash-checkout.js` testira srečno pot in namerni `tse.sign` fail (→`recovery_required`), a NI PREVERJENO ali testira crash MED `store.complete()` klicem samim (delno izveden zapis) | Da delno izveden `complete()` ne pusti nekonsistentnega vmesnega stanja |
| (f) skupni payment amount > invoice gross | Noben najden test ne preveri agregatno prek več vrstic `pos_payments` za isti `invoice_id`, da vsota ne presega `gross_cents` — ker tak CHECK/trigger sploh ne obstaja (§C), tudi test zanj ne obstaja | Regresijski test, ki bi FAILAL danes, če bi bil napisan — kar je najboljši dokaz vrzeli |

---

## I. Potrjene P0/P1 vrzeli

| ID | Resnost | Naslov | Dokaz |
|---|---|---|---|
| PB-01 | **P0** | Dve sočasni Stripe Checkout seji za isti račun lahko obe uspeta (H1) | §B, §C |
| PB-02 | **P0** | `action:"cancel"` lahko prepiše dejansko plačano sejo v `cancelled`, poznejši webhook pa jo tiho vrne v `succeeded`, kar omogoči dvojno bremenjenje (H2) | §B |
| PB-03 | **P0** | Noben DB invariant ne omejuje vsote uspešnih plačil na `gross_cents` po računu — H1/H2/cross-method (§F) vse pripeljejo do iste posledice brez ene same zaščitne ograje | §C, §F |
| PB-04 | **P0** | Produkcijsko klicana gotovinska (TSE) pot je proces-lokalen pomnilnik brez trajnosti in brez auth — ne preživi restart, ne skalira čez več instanc | §G |
| PB-05 | **P1** | Manual payment in Stripe pending lahko sočasno "prekrijeta" isti odprti znesek (§F) | §F |
| PB-06 | **P1** | `action:"status"` ne zapiše DB stanja niti za `expired` Stripe sejo — pending lahko trajno obtiči | §E scenarij 18 |
| PB-07 | **P1** | Testna pokritost je izključno enotska/regex, brez ene same concurrency/integracijske preverbe za katerokoli od zgornjih P0 | §H |

---

## J. Tri variante rešitve (samo specifikacija, brez implementacije)

### J.1 Najmanjši hotfix
- **SQL:** en `partial unique index`: `create unique index on pos_payments(invoice_id) where provider='stripe' and status='pending'` — to sámo prepreči H1 na najnižjem nivoju (drugi `insert` bi padel na constraint violation, ki ga API mora ujeti in vrniti razumljivo napako namesto 500).
- **API:** v `action:"cancel"` dodati eksplicitno vejo: `if (session.payment_status === "paid") return json(res, 409, {code:"PROVIDER_ALREADY_PAID", ...})` PRED klicem `pos_cancel_stripe_checkout` — brez tega je H2 nespremenjen.
- **UI:** ob `PROVIDER_ALREADY_PAID` odgovoru prikazati "Preverjamo plačilo" namesto "Preklicano", sprožiti dodatno `action:"status"` poizvedbo.
- **Migracijsko tveganje:** nizko — nov index se lahko doda brez `not valid`/`validate` dvokoraka, ker gre za nov (ne spremenjen obstoječ) index; treba je najprej v produkciji preveriti, da trenutno NI že obstoječih podvojenih `pending` vrstic (sicer `create unique index` sam pade).
- **Rollback:** `drop index`, revert API diff.
- **Katere dirke odpravi:** H1 v celoti. H2 delno (zapre najbolj očiten vstopni kanal prek redirect-cancel, ne odpravi teoretične možnosti, da med `session.retrieve` in RPC klicem Stripe stanje spremeni — ostane majhno okno).
- **Katerih NE odpravi:** §F cross-method (manual+stripe), §G (cash runtime), PB-06 (expired handling).
- **Potrebni testi:** (b) in (a) iz §H, plus nov test za 409 odgovor.

### J.2 Priporočen srednji popravek
Vse iz J.1, plus:
- **SQL:** nova RPC `pos_reconcile_stripe_payment(session_id)`, ki service-role kliče `stripe.checkout.sessions.retrieve` (na Node strani, RPC sam samo sprejme rezultat) in ATOMSKO odloči succeeded/failed/cancelled na podlagi SVEŽEGA providerjevega stanja, ne le internega DB statusa — nadomesti neposredni `pos_cancel_stripe_checkout` klic iz UI-ja povsod.
- **SQL invariant:** trigger na `pos_payments` (`before insert or update`), ki za `status in ('succeeded','partially_refunded')` preveri `_pos_effective_paid_cents(invoice_id) ≤ gross_cents` in ZAVRNE (raise exception) mutacijo, ki bi to prekršila — to je "cap" iz vprašanja na koncu naloge.
- **API:** blokada novega `action:"create"` poskusa, dokler obstaja KATERIKOLI drug `pending`/`recovery_required` poskus (katerekoli metode) za isti `invoice_id` — vrne "Račun se že obdeluje" namesto tihega dovoljevanja.
- **UI:** en skupen "Preverjamo plačilo" zaslon za vse pending/negotove primere (kot v prejšnjem POS poročilu, §11 tam).
- **Migracijsko tveganje:** srednje — invariant trigger lahko zavrne obstoječe (zgodovinske) nekonsistentne vrstice, če takšne obstajajo v produkciji; potreben je predhoden avdit obstoječih podatkov.
- **Rollback:** `drop trigger`, revert RPC/API/UI.
- **Katere dirke odpravi:** H1, H2 v celoti (rekoncilacija zamenja slepo zaupanje redirectu); §F delno (cap trigger prepreči FINANČNO škodo, tudi če dirka na nivoju vrstic ostane).
- **Katerih NE odpravi:** §G (cash runtime ostaja proces-lokalen, dokler se to ne poveže na Implementacijo 1).
- **Potrebni testi:** vseh (a)-(c), (f) iz §H.

### J.3 Dolgoročni `PaymentAttempt` model
Kot opisano v prejšnjem POS poročilu (§4-5 tam) — ločen `payment_attempts` sloj z enim kanoničnim state machine za VSE metode (kartica, gotovina, ročno), z enim invoice-level "aktiven poskus" zaklepom, ki ga tudi Implementacija 1 gotovine (§G) dejansko uporabi (namesto proces-lokalnega Mapa).
- **SQL:** nova tabela `payment_attempts` + migracija obstoječih `pos_payments`/`pos_cash_checkouts` vrstic vanjo; `pos_payments` postane "izid", ne "poskus".
- **API:** en skupen orkestrator endpoint za create/cancel/reconcile/status čez vse tri metode.
- **UI:** en skupen komponenta za "negotovo stanje", ne ločeno besedilo za Stripe vs. cash.
- **Migracijsko tveganje:** visoko — sprememba podatkovnega modela, zahteva postopno soobstoječo migracijo (dvojno pisanje) preden se stari poti opustijo.
- **Rollback:** kompleksen — potreben feature-flag preklop nazaj na stare RPC-je med prehodnim obdobjem.
- **Katere dirke odpravi:** vse, vključno z multi-instance cash Map problemom (§G), ker bi Implementacija 1 (Supabase-backed) postala EDINA pot.
- **Potrebni testi:** celotna piramida iz prejšnjega POS poročila §12, plus chaos/concurrency sloj.

**Odgovor na eksplicitno vprašanje naloge — ali bi najmanjši varen hotfix moral vsebovati:**
- invoice-level active-attempt lock → **DA**, to JE jedro J.1 (partial unique index).
- prepoved canceliranja provider-paid seje → **DA**, brez tega H2 ostane odprt tudi po J.1.
- avtomatska statusna rekoncilacija → **Ne nujno v hotfixu** (to je J.2 razlika) — hotfix lahko samo ZAVRNE nevarno dejanje, rekoncilacija je naslednji korak.
- blokada novega plačila med pending/reconciliation → **Delno v hotfixu** (unique index to naredi implicitno za Stripe-Stripe primer), eksplicitna cross-method blokada je J.2.
- cap/invariant proti `gross_cents` → **Priporočeno tudi v hotfixu**, ker je poceni (en trigger) in edini pravi zadnji varovalni sloj, ki pokrije tudi neznane/prihodnje race-e, ne le H1/H2 specifično.

---

## K. Konkretna acceptance criteria

| Zahteva | Merilo sprejema |
|---|---|
| PB-01 (H1) fix | Dva zaporedna/sočasna `action:"create"` klica z različnim `requestId` na isti `invoice_id`: drugi klic MORA dobiti jasno napako ("račun se že obdeluje") namesto druge veljavne Stripe seje. Test: dva vzporedna Node procesa/promisa, oba kličeta RPC neposredno z realno (test) Postgres povezavo. |
| PB-02 (H2) fix | `action:"cancel"` klican na sejo, kjer `stripe.checkout.sessions.retrieve` (mockano) vrne `payment_status:"paid"`: DB status MORA ostati nespremenjen ali preiti v rekoncilacijsko stanje, NIKOLI v `cancelled`. |
| PB-03 (cap invariant) | Poskus `update pos_payments set status='succeeded'` na vrstici, ki bi skupno vsoto za invoice pripeljala nad `gross_cents`, MORA vreči SQL izjemo. |
| PB-04 (cash runtime) | Po popravku MORA biti dokazljivo (grep + integracijski test), da isti handler, ki ga kliče produkcijski UI, piše v `pos_cash_checkouts` (Implementacija 1), ne v proces-lokalen Map. |
| PB-06 (expired handling) | `action:"status"` klican na Stripe sejo s `session.status==="expired"`: DB vrstica MORA preiti v `failed`/`cancelled`, ne ostati `pending` v nedogled. |

---

## L. Seznam prejšnjih sklepov, ki so bili ovrženi ali omejeni

1. **Ovrženo (delno):** prejšnje poročilo je pohvalilo gotovinski `recovery_required` vzorec kot "dokaz koncepta, da je ekipa to tveganje pravilno rešila" brez ločevanja med LOGIKO (dobra) in DEJANSKIM RUNTIME-om (proces-lokalen, brez auth, brez trajnosti). Ta ločnica ni bila del prejšnjega poročila — dodana je zdaj v §G in je materialno pomembna.
2. **Omejeno:** prejšnje poročilo je predpostavilo, da `action:"status"` "BI LAHKO služil" rekonciliaciji ob timeoutu, in to označilo kot [ODPRTO]. Ta krog dokazuje NATANČNO, da se `status` DEJANSKO kliče avtomatsko, a SAMO na success-redirect poti, ni pisan v DB kot trajen zapis (samo bere), in ne pokriva `expired` prehod (PB-06). To je precizacija, ne popolna ovržba.
3. **Novo, ni bilo del prejšnjega poročila:** H1 in H2 kot konkretni, dokazani mehanizmi dvojnega bremenjenja — prejšnje poročilo je imelo samo splošno priporočilo "potrebna je rekoncilacija", brez SQL-nivo dokaza, da je trenutni model AKTIVNO nezaščiten (ne le "manjka dodatna zaščita", ampak "obstoječa zaščita ima dokazano luknjo").
4. **Novo:** §F (cross-method preseganje gross_cents) ni bilo omenjeno v prejšnjem poročilu niti kot odprto vprašanje.
5. **Potrjeno nespremenjeno:** Stripe refund monotonost (`pos_preserve_refund_progress`), webhook dedup, `pos_invoices` immutable trigger — vsi ostajajo dokazano solidni, brez novih pripomb.

---

## M. docs-impact

**DA.** Priporočam dopolniti `docs/pos-audit-report.md`/artefakt iz prejšnjega kroga z opombo, ki usmeri bralca na ta dokument za H1/H2 in popravek §G (cash runtime) — brez tega bi prejšnji dokument ostal delno zavajajoč glede zrelosti gotovinskega toka. Razlog: prejšnji dokument je bil objavljen kot referenčni artefakt in bo verjetno ponovno brano brez konteksta tega drugega kroga.

---

*Pripravljeno kot strogo read-only, adversarial preverba. Brez sprememb kode, brez commit/push/deploy, brez branja skrivnosti. Vsaka trditev o obstoju/odsotnosti kode je preverjena z neposrednim branjem navedenih datotek in vrstic v tej seji; trditve o zunanjem Stripe/produkcijskem vedenju so eksplicitno označene kot NI PREVERJENO, kjer to velja.*
