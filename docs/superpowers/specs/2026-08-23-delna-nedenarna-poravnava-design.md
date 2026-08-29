# Delna nedenarna poravnava (dobropis/odpust po korakih) — zasnova

Datum: 2026-08-23
Status: v pregledu

## 1. Problem

Obrtnik danes lahko primer poravna samo na dva načina:

- **Delno** (`partial_payment`) — samo denar, primer ostane odprt, mehanizem se lahko uporabi večkrat zaporedoma skozi čas (obrok 1, obrok 2, ...).
- **Terminalno** (`paid_in_full`) — plačano v celoti / kompenzacija / dobropis / storno, vedno zapre primer in mora pokriti natanko cel takratni preostanek.

Manjka: **delni, nedenarni** korak (delni dobropis, delni odpust), ki primera NE zapre, ampak samo zmanjša preostali dolg — enako kot `partial_payment`, le da gre znesek v ne-denarno evidenco. Primer iz prakse: obrtnik in dolžnik se dogovorita, da bosta dva obroka plačana normalno, tretji del pa se pozneje (ko se izkaže, da ga dolžnik ne bo poravnal) odpiše — ne da bi se to vedelo vnaprej ob prvem obroku.

## 2. Obstoječa arhitektura (ugotovljeno s pregledom kode)

Ključno odkritje: sistem **že ima** mehanizem za korake skozi čas — `partial_payment`. Ni ga treba na novo izumljati, samo razširiti.

- `api/_lib/izvedba-core.js:121-142` — validacija `partial_payment`: zahteva `0 < placilo < preostaliDolg`, vrne `{ placiloZnesek, placiloVrsta }`.
- `api/izvedi-opomin-ukrep.js:95-129` — posreduje `placiloZnesek`/`placiloVrsta` v RPC klic.
- `supabase/migrations/20260823150000_nedenarne_poravnave.sql:222-249` (RPC `izvedi_opomin_ukrep`, veja `partial_payment`) — zapiše v `zadeva_placila`, zmanjša `preostali_dolg`, poveča `placano_skupaj`. Primer **ostane odprt**.
- Ista datoteka, vrstice 267-284 (veja `paid_in_full`, ne-`full` podvrste) — zapiše v `zadeva_poravnave` (obstoječa tabela, `vrsta in ('compensation','credit_note','cancelled_invoice')`), poveča `poravnano_nedenarno`, **zapre primer** (`preostali_dolg = 0`, `status = 'Rešeno'`).
- UI: `app/izvedba.js:320-358` (`pripraviPoravnavoZaOddajo`) — pripravi payload za enega od zgornjih dveh backend akcijskih tipov glede na izbrano kartico v dialogu "Kako je bil račun poravnan?". Ista `partial_payment` akcija je dosegljiva tudi iz ločenega dialoga "Kaj želite narediti?" prek kartice "Račun je delno poravnan" (`izvedba-komponente.js:72`).
- Med aktivnim primerom (dokler ni zaprt) **ne obstaja** noben prikaz že izvedenih delnih korakov — taka zgodovina se izriše šele po zaprtju primera, v `app/koncani-primeri.js` ("Zgodovina plačil" / "Nedenarna poravnava").

## 3. Zasnova

### 3.1 Nov backend akcijski tip: `partial_settlement`

En nov `actionType`, ne dva ločena — po vzoru obstoječega `partial_payment`, ki že danes z enim tipom in podpoljem (`settlementType: partial|installment`) pokriva dve kartici. Enako tu:

```
actionType: "partial_settlement"
settings: {
  kind: "credit" | "writeoff",   // dobropis | odpust
  amount: number,                 // > 0 in < trenutni preostali_dolg
  reason: string | null           // obvezno, če kind === "writeoff"; neobvezno pri "credit"
}
```

**Validacija** (`izvedba-core.js`, nova veja, zrcali `partial_payment` točno):
- `preostaliDolg > 0`
- `0 < amount < preostaliDolg` (enaka meja kot pri `partial_payment` — enak znesek bi pomenil "zapri primer", za to obstaja terminalna pot)
- če `kind === "writeoff"`, `reason` je obvezen (enako kot pri obstoječem terminalnem `cancelled_invoice`)

**RPC (`izvedi_opomin_ukrep`), nova veja**, vzporedna `partial_payment` veji:
- zmanjša `preostali_dolg` za `amount`
- poveča `poravnano_nedenarno` za `amount` (NE `placano_skupaj` — to je bila prav napaka, ki jo je popravila prejšnja migracija za terminalne primere)
- primer **ostane odprt** (status se ne spremeni)
- zapiše vrstico v obstoječo tabelo `zadeva_poravnave` — `vrsta` bo `credit_note` (za `kind: "credit"`) ali `cancelled_invoice` (za `kind: "writeoff"`), kar sta že dovoljeni vrednosti obstoječega check-a; nove tabele ali sprememb sheme NI treba.

Denarni invariant po tej spremembi: `placano_skupaj + poravnano_nedenarno + preostali_dolg = prvotni_znesek` velja enako kot danes — nova veja samo doda še en način, kako se `preostali_dolg` zmanjšuje.

### 3.2 UI — dva dialoga, en dosleden vzorec

Brez novih kartic na najvišjem nivoju (ne raste 6→8 kvadratkov v preklopniku). Namesto tega dobi obstoječa kartica **"Delno plačilo"** (in njen dvojnik "Obrok") majhen dodaten 3-smerni preklopnik **Denar / Dobropis / Odpust** znotraj svojih nastavitev — enak vzorec v obeh dialogih, ker oba danes kličeta isti backend:

- **"Kako je bil račun poravnan?"** (`izvedba.js`, kartici `partial`/`installment` v `izrisiPoravnavaKontrolnik`): pod poljem za znesek dodan segmentiran kontrolnik (ponovna uporaba obstoječega `izrisiPoravnavaSegment`, kot ga že uporabljata `full`/`compensation` za izbiro datuma). Ob izbiri "Odpust" se prikaže še polje razlog (ista `izvedba-poravnava__razlog` komponenta, ki jo danes uporablja samo `cancelled_invoice`).
- **"Kaj želite narediti?"** (`izvedba-komponente.js` `AKCIJE_META.partial_payment`, izris v `izvedba.js`): identičen 3-smerni preklopnik znotraj iste kartice "Račun je delno poravnan".

V obeh primerih: "Denar" pošlje obstoječi `partial_payment` (brez sprememb), "Dobropis"/"Odpust" pošljeta nov `partial_settlement` (glej 3.1).

Nobenega novega "wizard" zaslona za vnaprejšnje sestavljanje več korakov naenkrat (to je bila napačna smer prejšnjih mockupov) — vsak korak se doda posebej, ko se dejansko zgodi, tako kot danes deluje `partial_payment`.

### 3.3 Nov prikaz: "Dosedanji koraki" med aktivnim primerom

Trenutno obrtnik med odprtim primerom ne vidi zgodovine že izvedenih delnih korakov (samo po zaprtju, v `koncani-primeri.js`). Dodamo enak, a manjši prikaz tudi v `izvedba.js` (v obstoječem prostoru za povzetek primera): oštevilčen seznam že izvedenih `zadeva_placila`/`zadeva_poravnave` vrstic za to zadevo, z vsoto proti `prvotni_znesek`. Bere obstoječe podatke, brez novih API klicev, ki jih ni že.

## 4. Zunaj obsega (namerno)

- Povezava s POS terminalom (pravi izdani dokumenti/računi/dobropisi) — ločen prihodnji projekt, glej pogovor. Ta zasnova NE ustvarja nobene odvisnosti do `pos_invoices` ali podobnega; polje za morebitno prihodnjo povezavo (npr. `linked_pos_document_id`) se NE dodaja zdaj (YAGNI) — če pride, bo to nova migracija.
- Urejanje/brisanje že dodanega koraka po tem, ko je zapisan (backend akcije so že danes append-only/nepovratne — to ostaja tako).

## 5. Testiranje

- Razširiti `scripts/test-izvedba-actions.mjs` (obstoječ vzorec za `partial_payment`/`paid_in_full`) z novimi primeri za `partial_settlement`: znesek 0/negativen, znesek ≥ preostanek, odpust brez razloga, uspešen dobropis/odpust ki ne zapre primera, invariant `placano_skupaj+poravnano_nedenarno+preostali_dolg=prvotni_znesek` po vsakem koraku.
- Ročno preverjanje UI na 320/390px za obe dialoga (nova kartica/podizbira ne sme podreti obstoječega razporeda).

## 6. Odprta vprašanja za pregled

Ni odprtih blokirajočih vprašanj — glavna arhitekturna odločitev (razširitev obstoječega `partial_payment` vzorca namesto novega podatkovnega modela) je bila eksplicitno potrjena v pogovoru.
