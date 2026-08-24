# Povzetek plačilnega načrta in predogled računov — zasnova (finalna)

## Namen

Ob kliku "Potrdi" v dialogu "Kako je bil račun poravnan?" se zdaj namesto takojšnje izvedbe najprej pokaže zaslon "Povzetek načrta": besedilni povzetek konteksta, seznam korakov (razširljiv), izbira kanala pošiljanja (SMS/e-pošta) in predogled dokumentov (po enega na korak z denarnim/pravnim učinkom), s podrobnim PDF-izgledom na klik. Šele gumb "Potrdi in pošlji" na tem zaslonu dejansko izvede načrt.

To je predogled, ne generacija/pošiljanje pravega dokumenta — prava izdaja ostane vezana na prihodnjo POS integracijo.

## Obseg

Velja **samo** za dialog "Kako je bil račun poravnan?" (`state.actionSheetMode === "payment"`).

## Arhitektura

Novo polje stanja `state.actionSheetStep`: `"izbira"` (privzeto) | `"povzetek"`. Brez navigacije — tretje stanje istega panela.

- "Potrdi" na coni izbire: če `nacrtKoraki.length > 0`, preklopi `actionSheetStep = "povzetek"` (ne pošlje ničesar).
- Puščica nazaj na povzetku: `actionSheetStep = "izbira"`, `nacrtKoraki` ostane.
- Gumb "Potrdi in pošlji" na povzetku: kliče obstoječo `nastaviNovNacrt()` (nespremenjeno).
- `racunPoravnan()` ob odprtju ponastavi `actionSheetStep = "izbira"` in nova polja spodaj.

## Podatki: razširitev `pridobi-izvedbo.js`

Doda branje `public.pos_business_profiles` za trenutnega uporabnika, vrne `prodajalec` (isto polje shape kot v prejšnji verziji specifikacije) ali `null`.

## UI: zaslon "Povzetek načrta"

### Glava
Puščica nazaj + "Povzetek načrta" + obstoječi × za zapiranje.

### Cona 1 — Besedilni povzetek konteksta
Kratek odstavek, samodejno sestavljen iz resničnih podatkov (NE izmišljenih dolžnikovih izjav — glej ugotovitev spodaj):

> "Pri **{N}. opominu** ste zabeležili {opis zadnjega izvedenega ukrepa}. Zdaj sledi nov plačilni plan z **{število} koraki**."

- `{N}` = pozicija trenutnega koraka v planu (`step_index`/pozicija iz `state.plan.steps`, 1-indeksirano).
- `{opis zadnjega izvedenega ukrepa}` = zadnji `completed` vnos iz `state.ukrepi` za ta primer, prek `opisUkrepaZaZgodovino(...).naslov` z malo začetnico (npr. "obljubo plačila" za `payment_promised`, "prestavitev opomina" za `postpone_reminder`). Če ni prejšnjih ukrepov, se prvi stavek izpusti.
- **Nikoli** ne trdi, kaj je dolžnik rekel/predlagal — samo kaj je obrtnik zabeležil.

### Cona 2 — Koraki plačilnega načrta
Seznam `state.nacrtKoraki` v istem vizualnem slogu kot `izrisiPotekPrimera()` (barvna značka, ikona, znesek, "N. obrok" oznaka), a vsaka vrstica je **razširljiva** (klik/pikica dol): razširjeno prikaže način/razlog, natančen datum-uro, in preostanek po tem koraku. Brez × za brisanje (urejanje zaklenjeno — za spremembo nazaj na cono izbire).

### Cona 3 — Kanal pošiljanja
Dva pill-gumba en ob drugem, oba privzeto vključena (`aria-pressed="true"`):
- "SMS · {telefonDolznika}" (onemogočen/opozorilo, če `state.zadeva.telefonDolznika` manjka)
- "E-pošta · {emailDolznika}" (onemogočen/opozorilo, če manjka)

Za zdaj samo vizualno stanje v `state` (ni realnega pošiljanja — izven obsega tega koraka).

### Cona 4 — Predogled računov
Zložljiva kartica "Predogled računov" z majhnim števcem (npr. "3") v naslovu, privzeto **odprta**.

Za vsak korak v `state.nacrtKoraki`, ki ima denarni/pravni učinek (vsi trenutno imajo), en "dokument": tip glede na `razred` (npr. "Račun" za denarna plačila/obroke, "Dobropis" za credit_note/writeoff). Oštevilčeni "N. dokument" prek `zadeva.stevilkaRacuna + "/" + N` (prikazna oznaka, ni prava izdana številka).

- Če je **1 dokument**: brez zavihkov, samo njegova vsebina.
- Če je **več dokumentov**: vodoravna vrsta zavihkov "1. račun" / "2. račun" ... (klikljivi pill gumbi, aktiven zavihek poudarjen) nad vsebino; klik preklopi prikazano vsebino spodaj (ne vodoravno drsenje — po uporabnikovi zadnji odločitvi jasni oštevilčeni zavihki, ne pikice).

Vsebina posameznega dokumenta (kompaktna, ne polni PDF izgled):
- Glava: `prodajalec` ime+naslov (ali namig, če manjka) + oznaka dokumenta + datum
- Postavke: znesek pred tem korakom → ta korak (+/− glede na tip) → preostanek/za plačilo po tem koraku
- Gumb "Preglej celoten račun" na dnu kartice: odpre **poln PDF-izgled** trenutno izbranega dokumenta (glava podjetja s polnimi podatki — DŠ, IBAN —, kupec, opis, tabela postavk, skupaj) prek istega preklopa `state.actionSheetStep`-podobnega mehanizma (novo `state.pregledDokumenta = indeks|null`); puščica nazaj v glavi tega pogleda vrne na povzetek.

### Noga
Gumb "Potrdi in pošlji" (nadomesti "Potrdi" na tem zaslonu).

## Omejitve

- Noben pravi dokument se ne ustvari/shrani/pošlje — vse je predogled znotraj dialoga. Ko pride POS integracija, se cona 4 poveže z resnično izdajo.
- Če `pos_business_profiles` manjka, glava dokumenta jasno pove, da podatki podjetja še niso nastavljeni.
- Besedilni povzetek (cona 1) nikoli ne trdi ničesar o dolžnikovih besedah/predlogih — samo kaj je obrtnik zabeležil.

## Testiranje

- Klik "Potrdi" na coni izbire NE pošlje ničesar, samo preklopi `actionSheetStep`.
- "Potrdi in pošlji" na povzetku sproži obstoječo `nastaviNovNacrt()`.
- Puščica nazaj vrne na izbiro brez izgube `nacrtKoraki`.
- Zavihki med več dokumenti pravilno preklopijo prikazano vsebino.
- Manjkajoč `pos_business_profiles` vrne `prodajalec: null`, UI se ne zlomi.
