# Vodnik po 62 odobrenih widgetih NAZORJEVA

Ta dokument je generiran iz `app/nazorjeva-engine.js` in `app/atena-widget-contract.js`. Register `NAZORJEVA.js` določa, kateri widgeti so odobreni; strojni contract pa določa, kdaj jih sme Atena uporabiti. Model lahko predlaga widget, toda `evaluateWidget` ga mora deterministično potrditi.

## Skupne invariante

- Pomen vprašanja, canonical vrednost, required/conditional pravila, validacija in obstoječi osnutek imajo prednost pred obliko.
- `field` widget sme zamenjati samo predstavitev združljivega polja. `module` widget zahteva vsa povezana vhodna polja. `review` ne zajema novega dejstva. `workflow` zahteva resnična stanja ali odvisnosti.
- Native barvo poda gostitelj z `--obrazec-barva` in `--obrazec-ozadje`; varen adapter jo prenese v `--card-rgb`. Lastna demonstracijska barva iz kataloga ni produkcijska tema.
- Na telefonu 390 × 844 se dolge kontrole zložijo, na 980 × 900 so dovoljeni samo vsebinsko naravni pari. Vrednosti se prilagajajo brez clippinga ali horizontalnega overflowa.
- Napredni widget ni nagrada za monotonost. Uporabi se samo, kadar njegova struktura zmanjša miselno delo in ohrani podatkovno pogodbo.
- Vsak kandidat začne v `NAZORJEVA-TEST`; prehod `ready_for_approval → approved` zahteva izrecno odobritev konkretnega ID-ja in svež dokaz testov.

## Widgeti

### 1. Posrednik ali izvajalec (`da-ne-ne-vem`)

- Trajni interface ID in contract: `atena:widget:da-ne-ne-vem`; `atena-interface-context-v2`.
- Capability podpis: `field\|enum\|choice,da,ne,vem\|choice-grid,choice-list,choice-segments,dropdown,payment-method\|optional\|direct\|Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis.\|existing-draft`.
- Namen in mentalni model: Da / ne / ne vem · kratka enojna izbira. Ali je ponudnik posrednik?
- Raven in canonical oblika: `field`; `enum`.
- Dovoljene interaction variante: `choice-segments`, `choice-grid`, `choice-list`, `dropdown`, `payment-method`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Ali je ponudnik posrednik?
- Realna primera: Ali je ponudnik posrednik?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Prosto besedilo, natančen znesek ali več hkratnih neodvisnih dejstev.
- Validacija in conditional pravila: Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 2. Trajanje vezave (`stevilcna-lestvica`)

- Trajni interface ID in contract: `atena:widget:stevilcna-lestvica`; `atena-interface-context-v2`.
- Capability podpis: `field\|number-with-unit\|lestvica,number,stevilcna\|availability,duration,duration-pair,money,money-or-percent,quantity-unit,rate\|optional\|direct\|Končno število, dovoljen razpon in izrecna enota; brez tihega zaokroževanja ali menjave enote.\|existing-draft`.
- Namen in mentalni model: Vodoravna lestvica · 5–10 kratkih možnosti. Koliko mesecev traja vezava?
- Raven in canonical oblika: `field`; `number-with-unit`.
- Dovoljene interaction variante: `quantity-unit`, `duration`, `duration-pair`, `money`, `money-or-percent`, `rate`, `availability`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Koliko mesecev traja vezava?
- Realna primera: Koliko mesecev traja vezava?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Ocena brez naravne merilne enote ali besedilna razlaga.
- Validacija in conditional pravila: Končno število, dovoljen razpon in izrecna enota; brez tihega zaokroževanja ali menjave enote. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 3. Način obračuna (`dvojni-segment`)

- Trajni interface ID in contract: `atena:widget:dvojni-segment`; `atena-interface-context-v2`.
- Capability podpis: `field\|enum\|choice,dvojni,segment\|choice-grid,choice-list,choice-segments,dropdown,payment-method\|optional\|direct\|Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis.\|existing-draft`.
- Namen in mentalni model: Dva velika segmenta · medsebojno izključujoča. Ali je cena enkratna ali se ponavlja?
- Raven in canonical oblika: `field`; `enum`.
- Dovoljene interaction variante: `choice-segments`, `choice-grid`, `choice-list`, `dropdown`, `payment-method`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Ali je cena enkratna ali se ponavlja?
- Realna primera: Ali je cena enkratna ali se ponavlja?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Prosto besedilo, natančen znesek ali več hkratnih neodvisnih dejstev.
- Validacija in conditional pravila: Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 4. Vloga ponudnika (`mreza-izbir`)

- Trajni interface ID in contract: `atena:widget:mreza-izbir`; `atena-interface-context-v2`.
- Capability podpis: `field\|enum\|choice,izbir,mreza\|choice-grid,choice-list,choice-segments,dropdown,payment-method\|optional\|direct\|Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis.\|existing-draft`.
- Namen in mentalni model: Tap-mreža 2 × 2 · daljše, razločljive možnosti. Kdo storitev dejansko izvede ali dobavi?
- Raven in canonical oblika: `field`; `enum`.
- Dovoljene interaction variante: `choice-segments`, `choice-grid`, `choice-list`, `dropdown`, `payment-method`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kdo storitev dejansko izvede ali dobavi?
- Realna primera: Kdo storitev dejansko izvede ali dobavi?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Prosto besedilo, natančen znesek ali več hkratnih neodvisnih dejstev.
- Validacija in conditional pravila: Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 5. Vir ponudbe (`navpicni-izbor`)

- Trajni interface ID in contract: `atena:widget:navpicni-izbor`; `atena-interface-context-v2`.
- Capability podpis: `field\|enum\|choice,izbor,navpicni\|choice-grid,choice-list,choice-segments,dropdown,payment-method\|optional\|direct\|Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis.\|existing-draft`.
- Namen in mentalni model: Navpični izbor · možnost »Drugo« z dopolnitvijo. Kako je ponudba prišla do vas?
- Raven in canonical oblika: `field`; `enum`.
- Dovoljene interaction variante: `choice-segments`, `choice-grid`, `choice-list`, `dropdown`, `payment-method`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kako je ponudba prišla do vas?
- Realna primera: Kako je ponudba prišla do vas?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Prosto besedilo, natančen znesek ali več hkratnih neodvisnih dejstev.
- Validacija in conditional pravila: Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 6. Način plačila (`spustni-seznam`)

- Trajni interface ID in contract: `atena:widget:spustni-seznam`; `atena-interface-context-v2`.
- Capability podpis: `field\|enum\|choice,seznam,spustni\|choice-grid,choice-list,choice-segments,dropdown,payment-method\|optional\|direct\|Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis.\|existing-draft`.
- Namen in mentalni model: Spustni seznam · daljši ali stabilen nabor možnosti. Kako bo račun poravnan?
- Raven in canonical oblika: `field`; `enum`.
- Dovoljene interaction variante: `choice-segments`, `choice-grid`, `choice-list`, `dropdown`, `payment-method`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kako bo račun poravnan?
- Realna primera: Kako bo račun poravnan?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Prosto besedilo, natančen znesek ali več hkratnih neodvisnih dejstev.
- Validacija in conditional pravila: Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 7. Predmet ponudbe (`besedilni-vnos`)

- Trajni interface ID in contract: `atena:widget:besedilni-vnos`; `atena-interface-context-v2`.
- Capability podpis: `field\|string-or-string-list\|besedilni,text,vnos\|list-builder,long-text,short-text\|optional\|direct\|Trim, smiselna minimalna vsebina in največja dolžina; seznam ne sme hraniti praznih postavk.\|existing-draft`.
- Namen in mentalni model: Besedilo · kratka ali večvrstična različica istega vzorca. Kaj točno kupujete in kateri rezultat pričakujete?
- Raven in canonical oblika: `field`; `string-or-string-list`.
- Dovoljene interaction variante: `short-text`, `long-text`, `list-builder`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kaj točno kupujete in kateri rezultat pričakujete?
- Realna primera: Kaj točno kupujete in kateri rezultat pričakujete?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zaprta izbira, datum ali znesek, ki potrebuje tipizirano validacijo.
- Validacija in conditional pravila: Trim, smiselna minimalna vsebina in največja dolžina; seznam ne sme hraniti praznih postavk. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 8. Osnovna cena (`natancen-znesek`)

- Trajni interface ID in contract: `atena:widget:natancen-znesek`; `atena-interface-context-v2`.
- Capability podpis: `field\|number-with-unit\|natancen,number,znesek\|availability,duration,duration-pair,money,money-or-percent,quantity-unit,rate\|optional\|direct\|Končno število, dovoljen razpon in izrecna enota; brez tihega zaokroževanja ali menjave enote.\|existing-draft`.
- Namen in mentalni model: Natančen znesek · valuta in kratka dodatna izbira. Kakšna je enkratna cena in ali vključuje DDV?
- Raven in canonical oblika: `field`; `number-with-unit`.
- Dovoljene interaction variante: `quantity-unit`, `duration`, `duration-pair`, `money`, `money-or-percent`, `rate`, `availability`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kakšna je enkratna cena in ali vključuje DDV?
- Realna primera: Kakšna je enkratna cena in ali vključuje DDV?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Ocena brez naravne merilne enote ali besedilna razlaga.
- Validacija in conditional pravila: Končno število, dovoljen razpon in izrecna enota; brez tihega zaokroževanja ali menjave enote. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 9. Predplačilo (`znesek-ali-odstotek`)

- Trajni interface ID in contract: `atena:widget:znesek-ali-odstotek`; `atena-interface-context-v2`.
- Capability podpis: `field\|number-with-unit\|ali,number,odstotek,znesek\|availability,duration,duration-pair,money,money-or-percent,quantity-unit,rate\|optional\|direct\|Končno število, dovoljen razpon in izrecna enota; brez tihega zaokroževanja ali menjave enote.\|existing-draft`.
- Namen in mentalni model: Znesek ali odstotek · preklop enote brez ugibanja. Kolikšno predplačilo zahteva ponudnik?
- Raven in canonical oblika: `field`; `number-with-unit`.
- Dovoljene interaction variante: `quantity-unit`, `duration`, `duration-pair`, `money`, `money-or-percent`, `rate`, `availability`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kolikšno predplačilo zahteva ponudnik?
- Realna primera: Kolikšno predplačilo zahteva ponudnik?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Ocena brez naravne merilne enote ali besedilna razlaga.
- Validacija in conditional pravila: Končno število, dovoljen razpon in izrecna enota; brez tihega zaokroževanja ali menjave enote. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 10. Količina in enota (`kolicina-in-enota`)

- Trajni interface ID in contract: `atena:widget:kolicina-in-enota`; `atena-interface-context-v2`.
- Capability podpis: `field\|number-with-unit\|enota,in,kolicina,number\|availability,duration,duration-pair,money,money-or-percent,quantity-unit,rate\|optional\|direct\|Končno število, dovoljen razpon in izrecna enota; brez tihega zaokroževanja ali menjave enote.\|existing-draft`.
- Namen in mentalni model: Stepper + enota · količina, trajanje ali število. Kakšna sta količina in obračunska enota?
- Raven in canonical oblika: `field`; `number-with-unit`.
- Dovoljene interaction variante: `quantity-unit`, `duration`, `duration-pair`, `money`, `money-or-percent`, `rate`, `availability`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kakšna sta količina in obračunska enota?
- Realna primera: Kakšna sta količina in obračunska enota?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Ocena brez naravne merilne enote ali besedilna razlaga.
- Validacija in conditional pravila: Končno število, dovoljen razpon in izrecna enota; brez tihega zaokroževanja ali menjave enote. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 11. Merilo dogovora (`drsnik-razpona`)

- Trajni interface ID in contract: `atena:widget:drsnik-razpona`; `atena-interface-context-v2`.
- Capability podpis: `field\|number-with-unit\|drsnik,number,razpona\|availability,duration,duration-pair,money,money-or-percent,quantity-unit,rate\|optional\|direct\|Končno število, dovoljen razpon in izrecna enota; brez tihega zaokroževanja ali menjave enote.\|existing-draft`.
- Namen in mentalni model: Izbira merila → grafični drsnik z neposrednim prikazom vrednosti. Kaj želite določiti in kakšna vrednost velja?
- Raven in canonical oblika: `field`; `number-with-unit`.
- Dovoljene interaction variante: `quantity-unit`, `duration`, `duration-pair`, `money`, `money-or-percent`, `rate`, `availability`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kaj želite določiti in kakšna vrednost velja?
- Realna primera: Kaj želite določiti in kakšna vrednost velja?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Ocena brez naravne merilne enote ali besedilna razlaga.
- Validacija in conditional pravila: Končno število, dovoljen razpon in izrecna enota; brez tihega zaokroževanja ali menjave enote. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 12. Predviden začetek (`datum-z-gotovostjo`)

- Trajni interface ID in contract: `atena:widget:datum-z-gotovostjo`; `atena-interface-context-v2`.
- Capability podpis: `field\|date-or-relative-date\|date,datum,gotovostjo,z\|date,deadline,duration,schedule\|optional\|direct\|Veljaven datum ali eksplicitno označen približen/neznan/relativen rok; vrstni red datumov mora biti smiseln.\|existing-draft`.
- Namen in mentalni model: Datum · natančen, neznan ali približen. Kdaj se izvedba začne?
- Raven in canonical oblika: `field`; `date-or-relative-date`.
- Dovoljene interaction variante: `date`, `deadline`, `schedule`, `duration`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kdaj se izvedba začne?
- Realna primera: Kdaj se izvedba začne?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Dogodek brez časovnega pomena ali poljubna opomba.
- Validacija in conditional pravila: Veljaven datum ali eksplicitno označen približen/neznan/relativen rok; vrstni red datumov mora biti smiseln. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 13. Termin izvedbe (`termin-in-pogostost`)

- Trajni interface ID in contract: `atena:widget:termin-in-pogostost`; `atena-interface-context-v2`.
- Capability podpis: `field\|date-or-relative-date\|date,in,pogostost,termin\|date,deadline,duration,schedule\|optional\|direct\|Veljaven datum ali eksplicitno označen približen/neznan/relativen rok; vrstni red datumov mora biti smiseln.\|existing-draft`.
- Namen in mentalni model: Prosti termin + hitre bližnjice. Kateri termin, časovno okno ali pogostost velja?
- Raven in canonical oblika: `field`; `date-or-relative-date`.
- Dovoljene interaction variante: `date`, `deadline`, `schedule`, `duration`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kateri termin, časovno okno ali pogostost velja?
- Realna primera: Kateri termin, časovno okno ali pogostost velja?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Dogodek brez časovnega pomena ali poljubna opomba.
- Validacija in conditional pravila: Veljaven datum ali eksplicitno označen približen/neznan/relativen rok; vrstni red datumov mora biti smiseln. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 14. Najpomembnejši pogoji (`seznam-postavk`)

- Trajni interface ID in contract: `atena:widget:seznam-postavk`; `atena-interface-context-v2`.
- Capability podpis: `field\|string-or-string-list\|postavk,seznam,text\|list-builder,long-text,short-text\|optional\|direct\|Trim, smiselna minimalna vsebina in največja dolžina; seznam ne sme hraniti praznih postavk.\|existing-draft`.
- Namen in mentalni model: Ponovljiv seznam · dodajanje in odstranjevanje postavk. Kateri pogoji so za vas najpomembnejši?
- Raven in canonical oblika: `field`; `string-or-string-list`.
- Dovoljene interaction variante: `short-text`, `long-text`, `list-builder`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kateri pogoji so za vas najpomembnejši?
- Realna primera: Kateri pogoji so za vas najpomembnejši?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zaprta izbira, datum ali znesek, ki potrebuje tipizirano validacijo.
- Validacija in conditional pravila: Trim, smiselna minimalna vsebina in največja dolžina; seznam ne sme hraniti praznih postavk. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 15. Dokazilo (`dokazilo`)

- Trajni interface ID in contract: `atena:widget:dokazilo`; `atena-interface-context-v2`.
- Capability podpis: `field\|file-reference[]\|document,dokazilo\|document-upload\|optional\|direct\|Dovoljen tip in velikost, uspešen prenos, stabilen ID datoteke ter zahtevana opomba, kadar jo določa vprašanje.\|existing-draft`.
- Namen in mentalni model: Dokument · izbor, stanje datoteke, odstranitev in opomba. Katero dokazilo potrjuje navedene cene, pogoje in obljube?
- Raven in canonical oblika: `field`; `file-reference[]`.
- Dovoljene interaction variante: `document-upload`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Katero dokazilo potrjuje navedene cene, pogoje in obljube?
- Realna primera: Katero dokazilo potrjuje navedene cene, pogoje in obljube?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Trditev brez dejanskega dokazila ali navadno besedilno vprašanje.
- Validacija in conditional pravila: Dovoljen tip in velikost, uspešen prenos, stabilen ID datoteke ter zahtevana opomba, kadar jo določa vprašanje. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 16. Razdelitev proračuna (`razdelitev-proracuna`)

- Trajni interface ID in contract: `atena:widget:razdelitev-proracuna`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|delež,proračun,vsota-100\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Krožni prikaz + drsnik · dve vrednosti s skupno vsoto 100 %. Kolikšen delež proračuna je namenjen izvedbi in materialu?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kolikšen delež proračuna je namenjen izvedbi in materialu?
- Realna primera: Kolikšen delež proračuna je namenjen izvedbi in materialu?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 17. Primerjava možnosti (`primerjava-moznosti`)

- Trajni interface ID in contract: `atena:widget:primerjava-moznosti`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|primerjava,več-možnosti\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Vzporedna primerjava · cena, rok in poudarjene razlike. Katera ponudba je za vas ugodnejša?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Katera ponudba je za vas ugodnejša?
- Realna primera: Katera ponudba je za vas ugodnejša?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 18. Časovnica mejnikov (`casovnica-mejnikov`)

- Trajni interface ID in contract: `atena:widget:casovnica-mejnikov`; `atena-interface-context-v2`.
- Capability podpis: `module\|ordered-rule-or-state[]\|mejnik,stanje,vrstni-red\|\|optional\|direct\|Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega.\|existing-draft`.
- Namen in mentalni model: Vodoravna časovnica · klik za spremembo stanja posameznega koraka. Kateri koraki so že dogovorjeni ali zaključeni?
- Raven in canonical oblika: `module`; `ordered-rule-or-state[]`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kateri koraki so že dogovorjeni ali zaključeni?
- Realna primera: Kateri koraki so že dogovorjeni ali zaključeni?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Nepovezana vprašanja ali okrasna časovnica brez dejanskih stanj.
- Validacija in conditional pravila: Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 19. Razvrstitev prioritet (`razvrscanje-prioritet`)

- Trajni interface ID in contract: `atena:widget:razvrscanje-prioritet`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|prioriteta,vrstni-red\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Razvrščanje · premikanje postavk gor in dol brez vlečenja. Kaj je najpomembnejše pri končni izbiri?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kaj je najpomembnejše pri končni izbiri?
- Realna primera: Kaj je najpomembnejše pri končni izbiri?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 20. Tedenski termini (`tedenski-termini`)

- Trajni interface ID in contract: `atena:widget:tedenski-termini`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|tedenski-termin,večizbor\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Tedenska mreža · večizbor dopoldanskih in popoldanskih terminov. Kdaj ste praviloma dosegljivi za izvedbo ali ogled?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kdaj ste praviloma dosegljivi za izvedbo ali ogled?
- Realna primera: Kdaj ste praviloma dosegljivi za izvedbo ali ogled?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 21. Ocenjevalna matrika (`ocenjevalna-matrika`)

- Trajni interface ID in contract: `atena:widget:ocenjevalna-matrika`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|merilo,ocena,povprečje\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Več meril + ocena · sproten izračun povprečja. Kako ocenjujete ponudbo po ključnih merilih?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kako ocenjujete ponudbo po ključnih merilih?
- Realna primera: Kako ocenjujete ponudbo po ključnih merilih?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 22. Proračunski razpon (`dvojni-razpon`)

- Trajni interface ID in contract: `atena:widget:dvojni-razpon`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|maximum,minimum,razpon\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Dvojni drsnik + histogram · jasno označena spodnja in zgornja meja. Kakšen je najnižji in najvišji sprejemljivi proračun?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kakšen je najnižji in najvišji sprejemljivi proračun?
- Realna primera: Kakšen je najnižji in najvišji sprejemljivi proračun?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 23. Garancija in kritje (`pogojna-garancija`)

- Trajni interface ID in contract: `atena:widget:pogojna-garancija`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|garancija,pogojna-polja\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Pogojno razkritje · dodatna polja se pokažejo šele po izbiri. Ali ponudba vključuje garancijo?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Ali ponudba vključuje garancijo?
- Realna primera: Ali ponudba vključuje garancijo?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 24. Izbira dneva (`mini-koledar`)

- Trajni interface ID in contract: `atena:widget:mini-koledar`; `atena-interface-context-v2`.
- Capability podpis: `field\|date-or-relative-date\|date,koledar,mini\|date,deadline,duration,schedule\|optional\|direct\|Veljaven datum ali eksplicitno označen približen/neznan/relativen rok; vrstni red datumov mora biti smiseln.\|existing-draft`.
- Namen in mentalni model: Mini koledar · izbor konkretnega dneva znotraj kartice. Kateri dan je najprimernejši za prvi ogled?
- Raven in canonical oblika: `field`; `date-or-relative-date`.
- Dovoljene interaction variante: `date`, `deadline`, `schedule`, `duration`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kateri dan je najprimernejši za prvi ogled?
- Realna primera: Kateri dan je najprimernejši za prvi ogled?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Dogodek brez časovnega pomena ali poljubna opomba.
- Validacija in conditional pravila: Veljaven datum ali eksplicitno označen približen/neznan/relativen rok; vrstni red datumov mora biti smiseln. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 25. Popolnost dokumentacije (`kontrolni-seznam-dokazil`)

- Trajni interface ID in contract: `atena:widget:kontrolni-seznam-dokazil`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|dokazila,popolnost\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Kontrolni seznam + napredek · hitro pokaže manjkajoče elemente. Katera dokazila so že priložena?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Katera dokazila so že priložena?
- Realna primera: Katera dokazila so že priložena?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 26. Matrika tveganja (`matrika-tveganja`)

- Trajni interface ID in contract: `atena:widget:matrika-tveganja`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|verjetnost,vpliv\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Matrika 3 × 3 · verjetnost in vpliv v enem dotiku. Kako verjetno in kako resno je opaženo tveganje?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kako verjetno in kako resno je opaženo tveganje?
- Realna primera: Kako verjetno in kako resno je opaženo tveganje?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 27. Oznake ponudbe (`izbirnik-oznak`)

- Trajni interface ID in contract: `atena:widget:izbirnik-oznak`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|izbirnik,multi,oznak\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Večizbor oznak + lasten vnos · izbrane oznake ostanejo pregledne. Katere lastnosti najbolje opisujejo ponudbo?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Katere lastnosti najbolje opisujejo ponudbo?
- Realna primera: Katere lastnosti najbolje opisujejo ponudbo?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 28. Plačilni razrez (`placilni-razrez`)

- Trajni interface ID in contract: `atena:widget:placilni-razrez`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|faze,plačilo,vsota-100\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Sestavljeni stolpec + tri vrednosti · takojšen nadzor vsote. Kako naj bo plačilo razdeljeno med faze?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kako naj bo plačilo razdeljeno med faze?
- Realna primera: Kako naj bo plačilo razdeljeno med faze?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 29. Trenutno proti cilju (`trenutno-proti-cilju`)

- Trajni interface ID in contract: `atena:widget:trenutno-proti-cilju`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|cilj,trenutno\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Dvojni merilnik + drsnik · razlika med stanjem in ciljem. Kolikšna je trenutna vrednost in kakšen cilj želite doseči?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kolikšna je trenutna vrednost in kakšen cilj želite doseči?
- Realna primera: Kolikšna je trenutna vrednost in kakšen cilj želite doseči?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 30. Naslednji korak (`odlocitvena-pot`)

- Trajni interface ID in contract: `atena:widget:odlocitvena-pot`; `atena-interface-context-v2`.
- Capability podpis: `module\|ordered-rule-or-state[]\|naslednji-korak,odločitev\|\|optional\|direct\|Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega.\|existing-draft`.
- Namen in mentalni model: Dvostopenjska odločitev · naslednja izbira se prilagodi prvi. Kaj želite narediti s ponudbo?
- Raven in canonical oblika: `module`; `ordered-rule-or-state[]`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kaj želite narediti s ponudbo?
- Realna primera: Kaj želite narediti s ponudbo?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Nepovezana vprašanja ali okrasna časovnica brez dejanskih stanj.
- Validacija in conditional pravila: Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 31. Kako nastane končna cena? (`cenovni-most`)

- Trajni interface ID in contract: `atena:widget:cenovni-most`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|cena,izračun,spremembe\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Preprost račun po korakih · od začetne do končne cene. Kliknite postavko in poglejte, kako spremeni ceno.
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kliknite postavko in poglejte, kako spremeni ceno.
- Realna primera: Kliknite postavko in poglejte, kako spremeni ceno.; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 32. Trend odzivnosti (`trend-odzivnosti`)

- Trajni interface ID in contract: `atena:widget:trend-odzivnosti`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|odzivnost,časovna-vrsta\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Interaktivni trend · navpično merilo in vlečljive časovne točke. Kako se je spreminjal odzivni čas ponudnika?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kako se je spreminjal odzivni čas ponudnika?
- Realna primera: Kako se je spreminjal odzivni čas ponudnika?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 33. Ciljni pas (`ciljni-pas`)

- Trajni interface ID in contract: `atena:widget:ciljni-pas`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|cilj,dejansko,status\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Ciljni pas + natančen vnos · dejanska vrednost, cilj in jasen status. Ali je odziv znotraj dogovorjenega cilja?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Ali je odziv znotraj dogovorjenega cilja?
- Realna primera: Ali je odziv znotraj dogovorjenega cilja?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 34. Ocena z negotovostjo (`ocena-z-negotovostjo`)

- Trajni interface ID in contract: `atena:widget:ocena-z-negotovostjo`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|maximum,minimum,ocena\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Point-and-range · spodnja meja, osrednja ocena in zgornja meja. Kakšen je realen razpon in najverjetnejši strošek?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kakšen je realen razpon in najverjetnejši strošek?
- Realna primera: Kakšen je realen razpon in najverjetnejši strošek?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 35. Prej in zdaj (`primerjava-sprememb`)

- Trajni interface ID in contract: `atena:widget:primerjava-sprememb`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|prej,zdaj\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Interaktivna primerjava · obe vrednosti Prej in Zdaj sta neposredno drsni. Kaj se je v novi ponudbi najbolj spremenilo?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kaj se je v novi ponudbi najbolj spremenilo?
- Realna primera: Kaj se je v novi ponudbi najbolj spremenilo?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 36. Kateri odgovori so zamujali? (`prekoracitve-praga`)

- Trajni interface ID in contract: `atena:widget:prekoracitve-praga`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|prekoračitev,rok\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Preprost seznam · takoj vidite, kateri odgovori so zamujali. Dogovor je odgovor v 5 dneh. Kliknite datum za podrobnost.
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Dogovor je odgovor v 5 dneh. Kliknite datum za podrobnost.
- Realna primera: Dogovor je odgovor v 5 dneh. Kliknite datum za podrobnost.; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 37. Obseg storitve (`hierarhicni-izbor`)

- Trajni interface ID in contract: `atena:widget:hierarhicni-izbor`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|hierarhicni,izbor,multi\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Hierarhični drill-down · en nivo naenkrat brez širokega drevesa. Kateri del storitve želite vključiti?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kateri del storitve želite vključiti?
- Realna primera: Kateri del storitve želite vključiti?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 38. Iskanje ponudnika (`iskalni-izbirnik`)

- Trajni interface ID in contract: `atena:widget:iskalni-izbirnik`; `atena-interface-context-v2`.
- Capability podpis: `field\|enum\|choice,iskalni,izbirnik\|choice-grid,choice-list,choice-segments,dropdown,payment-method\|optional\|direct\|Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis.\|existing-draft`.
- Namen in mentalni model: Iskalni combobox · filtriranje velikega nabora in jasna izbrana vrednost. Katerega ponudnika želite povezati s ponudbo?
- Raven in canonical oblika: `field`; `enum`.
- Dovoljene interaction variante: `choice-segments`, `choice-grid`, `choice-list`, `dropdown`, `payment-method`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Katerega ponudnika želite povezati s ponudbo?
- Realna primera: Katerega ponudnika želite povezati s ponudbo?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Prosto besedilo, natančen znesek ali več hkratnih neodvisnih dejstev.
- Validacija in conditional pravila: Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 39. Pravilo ponavljanja (`pravilo-ponavljanja`)

- Trajni interface ID in contract: `atena:widget:pravilo-ponavljanja`; `atena-interface-context-v2`.
- Capability podpis: `module\|ordered-rule-or-state[]\|interval,ponavljanje\|\|optional\|direct\|Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega.\|existing-draft`.
- Namen in mentalni model: Recurrence builder · interval, enota, dnevi in sproten opis pravila. Kako pogosto naj se dogodek ponovi?
- Raven in canonical oblika: `module`; `ordered-rule-or-state[]`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kako pogosto naj se dogodek ponovi?
- Realna primera: Kako pogosto naj se dogodek ponovi?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Nepovezana vprašanja ali okrasna časovnica brez dejanskih stanj.
- Validacija in conditional pravila: Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 40. Relativni rok (`relativni-rok`)

- Trajni interface ID in contract: `atena:widget:relativni-rok`; `atena-interface-context-v2`.
- Capability podpis: `field\|date-or-relative-date\|dogodek,odmik\|date,deadline,duration,schedule\|optional\|direct\|Veljaven datum ali eksplicitno označen približen/neznan/relativen rok; vrstni red datumov mora biti smiseln.\|existing-draft`.
- Namen in mentalni model: Dogodek + odmik · razumljiv stavek namesto izračunavanja datuma. Na kateri dogodek je rok vezan in koliko dni velja?
- Raven in canonical oblika: `field`; `date-or-relative-date`.
- Dovoljene interaction variante: `date`, `deadline`, `schedule`, `duration`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Na kateri dogodek je rok vezan in koliko dni velja?
- Realna primera: Na kateri dogodek je rok vezan in koliko dni velja?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Dogodek brez časovnega pomena ali poljubna opomba.
- Validacija in conditional pravila: Veljaven datum ali eksplicitno označen približen/neznan/relativen rok; vrstni red datumov mora biti smiseln. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če podatkovni tip in interaction ostaneta povsem enaka; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 41. Lokacija in doseg (`lokacija-in-doseg`)

- Trajni interface ID in contract: `atena:widget:lokacija-in-doseg`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|doseg,in,lokacija,multi\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Lokacija + radij · prostorski doseg z besedilno vrednostjo. Od kod izvajalec prihaja in kako daleč storitev pokriva?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Od kod izvajalec prihaja in kako daleč storitev pokriva?
- Realna primera: Od kod izvajalec prihaja in kako daleč storitev pokriva?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 42. Obročni načrt (`obrocni-nacrt`)

- Trajni interface ID in contract: `atena:widget:obrocni-nacrt`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|obroki,znesek\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Stepper + dinamični stolpci · število obrokov in znesek posameznega obroka. Na koliko enakih obrokov naj se razdeli znesek 2.400 €?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Na koliko enakih obrokov naj se razdeli znesek 2.400 €?
- Realna primera: Na koliko enakih obrokov naj se razdeli znesek 2.400 €?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 43. Kaj je vključeno (`matrika-vkljucenosti`)

- Trajni interface ID in contract: `atena:widget:matrika-vkljucenosti`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|postavka,vključeno\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Vrstične tekstovne izbire · vključeno, doplačilo ali ni vključeno za vsako zahtevo. Kako je posamezna postavka obravnavana v ponudbi?
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kako je posamezna postavka obravnavana v ponudbi?
- Realna primera: Kako je posamezna postavka obravnavana v ponudbi?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 44. Parna primerjava (`parna-primerjava`)

- Trajni interface ID in contract: `atena:widget:parna-primerjava`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|analysis,parna,primerjava\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Prilagodljivo število kratkih primerjav · vprašanja določi dejanska uporaba. Kaj vam je pri delu in dogovorih pomembnejše?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kaj vam je pri delu in dogovorih pomembnejše?
- Realna primera: Kaj vam je pri delu in dogovorih pomembnejše?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 45. Pregled odgovorov (`pregled-odgovorov`)

- Trajni interface ID in contract: `atena:widget:pregled-odgovorov`; `atena-interface-context-v2`.
- Capability podpis: `review\|existing-values-reference\|potrditev,pregled\|confirmation\|optional\|direct\|Ne ustvarja novega dejstva; potrdi obstoječe canonical vrednosti ali vrne uporabnika v urejanje.\|existing-draft`.
- Namen in mentalni model: Summary list + inline edit · pregled in popravek brez zapuščanja kartice. Ali so ključni podatki pravilni pred potrditvijo?
- Raven in canonical oblika: `review`; `existing-values-reference`.
- Dovoljene interaction variante: `confirmation`.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Ali so ključni podatki pravilni pred potrditvijo?
- Realna primera: Ali so ključni podatki pravilni pred potrditvijo?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Prvi zajem podatka ali nadomestilo za obvezno vprašanje.
- Validacija in conditional pravila: Ne ustvarja novega dejstva; potrdi obstoječe canonical vrednosti ali vrne uporabnika v urejanje. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 46. Kaj najbolj spremeni ceno? (`obcutljivost-izida`)

- Trajni interface ID in contract: `atena:widget:obcutljivost-izida`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|dejavniki,vpliv\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Trije vplivi · spremenite vrednost in takoj vidite razliko. Kaj najbolj vpliva na končno ceno?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kaj najbolj vpliva na končno ceno?
- Realna primera: Kaj najbolj vpliva na končno ceno?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 47. Koliko denarja potrebujete v rezervi? (`mesalnik-scenarija`)

- Trajni interface ID in contract: `atena:widget:mesalnik-scenarija`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|izračun,scenarij\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Tri preproste nastavitve · takojšen izračun potrebne rezerve. Koliko denarja potrebujete na računu, da lahko delo normalno dokončate?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Koliko denarja potrebujete na računu, da lahko delo normalno dokončate?
- Realna primera: Koliko denarja potrebujete na računu, da lahko delo normalno dokončate?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 48. Koliko zamude še sprejmete? (`prag-verjetnosti-zamude`)

- Trajni interface ID in contract: `atena:widget:prag-verjetnosti-zamude`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|prag,zamuda\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: 20 primerov zamude · izberete mejo in takoj vidite, koliko primerov jo preseže. Koliko dni zamude je za vas še v redu?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Koliko dni zamude je za vas še v redu?
- Realna primera: Koliko dni zamude je za vas še v redu?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 49. Zasedenost po dnevih (`toplotni-koledar`)

- Trajni interface ID in contract: `atena:widget:toplotni-koledar`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|datum,intenzivnost\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: 4 tedni × 7 dni · preproste barvne stopnje brez številk. Kateri dnevi so pri vas najbolj zasedeni?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kateri dnevi so pri vas najbolj zasedeni?
- Realna primera: Kateri dnevi so pri vas najbolj zasedeni?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 50. Od računa do plačila (`lijak-izterjave`)

- Trajni interface ID in contract: `atena:widget:lijak-izterjave`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|faze,znesek\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: 4 preprosti koraki · zneski in koliko denarja je odpadlo med koraki. Koliko denarja je ostalo po vsakem koraku?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Koliko denarja je ostalo po vsakem koraku?
- Realna primera: Koliko denarja je ostalo po vsakem koraku?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 51. Kaj urediti najprej? (`mreza-odvisnosti`)

- Trajni interface ID in contract: `atena:widget:mreza-odvisnosti`; `atena-interface-context-v2`.
- Capability podpis: `module\|ordered-rule-or-state[]\|odvisnost,vrstni-red\|\|optional\|direct\|Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega.\|existing-draft`.
- Namen in mentalni model: Štirje kratki koraki · jasno je, kaj uredite zdaj in kaj sledi. Kaj morate urediti in potrditi, da lahko nadaljujete?
- Raven in canonical oblika: `module`; `ordered-rule-or-state[]`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kaj morate urediti in potrditi, da lahko nadaljujete?
- Realna primera: Kaj morate urediti in potrditi, da lahko nadaljujete?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Nepovezana vprašanja ali okrasna časovnica brez dejanskih stanj.
- Validacija in conditional pravila: Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 52. Dogovor o popustu (`pogajalski-prostor`)

- Trajni interface ID in contract: `atena:widget:pogajalski-prostor`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|plačilo,popust\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Preprost izbor načina plačevanja · popust in jasno priporočilo. Kako stranka plačuje in koliko popusta ji želite dati?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kako stranka plačuje in koliko popusta ji želite dati?
- Realna primera: Kako stranka plačuje in koliko popusta ji želite dati?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 53. Pregled spornih pogojev (`skupine-odstopanj`)

- Trajni interface ID in contract: `atena:widget:skupine-odstopanj`; `atena-interface-context-v2`.
- Capability podpis: `module\|ordered-rule-or-state[]\|odločitev,pogoj\|\|optional\|direct\|Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega.\|existing-draft`.
- Namen in mentalni model: Vsak pogoj ima svoj jasen izbor · brez skritega prestavljanja med skupinami. Kaj želite narediti z vsakim pogojem?
- Raven in canonical oblika: `module`; `ordered-rule-or-state[]`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kaj želite narediti z vsakim pogojem?
- Realna primera: Kaj želite narediti z vsakim pogojem?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Nepovezana vprašanja ali okrasna časovnica brez dejanskih stanj.
- Validacija in conditional pravila: Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 54. Kam lahko prestavite delo? (`pasovi-zmogljivosti`)

- Trajni interface ID in contract: `atena:widget:pasovi-zmogljivosti`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|ekipa,zmogljivost\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Izberete delo in ekipo · takoj vidite proste ure. Katera ekipa ima dovolj prostega časa za to delo?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Katera ekipa ima dovolj prostega časa za to delo?
- Realna primera: Katera ekipa ima dovolj prostega časa za to delo?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 55. Povežite dogovor z dokazilom (`ujemanje-pogojev-dokazil`)

- Trajni interface ID in contract: `atena:widget:ujemanje-pogojev-dokazil`; `atena-interface-context-v2`.
- Capability podpis: `module\|ordered-rule-or-state[]\|dokazilo,trditev\|\|optional\|direct\|Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega.\|existing-draft`.
- Namen in mentalni model: Najprej izberete dogovor, nato pravi dokument. Kateri dokument dokazuje posamezni dogovor?
- Raven in canonical oblika: `module`; `ordered-rule-or-state[]`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kateri dokument dokazuje posamezni dogovor?
- Realna primera: Kateri dokument dokazuje posamezni dogovor?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Nepovezana vprašanja ali okrasna časovnica brez dejanskih stanj.
- Validacija in conditional pravila: Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 56. Kdaj naredimo naslednji korak? (`gradnik-pravila-eskalacije`)

- Trajni interface ID in contract: `atena:widget:gradnik-pravila-eskalacije`; `atena-interface-context-v2`.
- Capability podpis: `module\|ordered-rule-or-state[]\|dejanje,pogoji\|\|optional\|direct\|Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega.\|existing-draft`.
- Namen in mentalni model: Izberete preproste pogoje in dejanje, ki naj sledi. Kdaj naj Atena predlaga naslednji korak?
- Raven in canonical oblika: `module`; `ordered-rule-or-state[]`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kdaj naj Atena predlaga naslednji korak?
- Realna primera: Kdaj naj Atena predlaga naslednji korak?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Nepovezana vprašanja ali okrasna časovnica brez dejanskih stanj.
- Validacija in conditional pravila: Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 57. Ali lahko podatku zaupate? (`sled-izvora-podatka`)

- Trajni interface ID in contract: `atena:widget:sled-izvora-podatka`; `atena-interface-context-v2`.
- Capability podpis: `module\|structured-object\|potrditev,starost,vir\|\|optional\|direct\|Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.\|existing-draft`.
- Namen in mentalni model: Od kod je podatek, kako star je in ali je potrjen. Odgovorite na tri kratka vprašanja.
- Raven in canonical oblika: `module`; `structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Odgovorite na tri kratka vprašanja.
- Realna primera: Odgovorite na tri kratka vprašanja.; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija.
- Validacija in conditional pravila: Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 58. Kdaj so stroški pokriti? (`prag-rentabilnosti`)

- Trajni interface ID in contract: `atena:widget:prag-rentabilnosti`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|cena,količina,stroški\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Cena, strošek in stalni stroški · obe črti ter cilj se takoj preračunajo. Vnesite svoje številke in takoj vidite, pri koliko poslih ste na ničli.
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Vnesite svoje številke in takoj vidite, pri koliko poslih ste na ničli.
- Realna primera: Vnesite svoje številke in takoj vidite, pri koliko poslih ste na ničli.; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 59. Kako najlažje do plačila? (`drevo-pricakovane-vrednosti`)

- Trajni interface ID in contract: `atena:widget:drevo-pricakovane-vrednosti`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|izplen,strošek,ukrep,verjetnost\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Tri možnosti · ocene vsake možnosti ostanejo shranjene med primerjavo. Izberite ukrep. Nato po potrebi popravite oceno.
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Izberite ukrep. Nato po potrebi popravite oceno.
- Realna primera: Izberite ukrep. Nato po potrebi popravite oceno.; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 60. Kaj naredite, ko nastane težava? (`kaskada-krsitve`)

- Trajni interface ID in contract: `atena:widget:kaskada-krsitve`; `atena-interface-context-v2`.
- Capability podpis: `module\|ordered-rule-or-state[]\|rezerva,težava,ukrep\|\|optional\|direct\|Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega.\|existing-draft`.
- Namen in mentalni model: 3 preprosti koraki · težava, prvi ukrep in rezervni korak. Izberite težavo, prvi ukrep in rezervni korak.
- Raven in canonical oblika: `module`; `ordered-rule-or-state[]`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Izberite težavo, prvi ukrep in rezervni korak.
- Realna primera: Izberite težavo, prvi ukrep in rezervni korak.; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Nepovezana vprašanja ali okrasna časovnica brez dejanskih stanj.
- Validacija in conditional pravila: Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 61. Cenovni most (`graficni-cenovni-most`)

- Trajni interface ID in contract: `atena:widget:graficni-cenovni-most`; `atena-interface-context-v2`.
- Capability podpis: `module\|derived-structured-object\|cena,graf,izračun,spremembe\|\|optional\|direct\|Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.\|existing-draft`.
- Namen in mentalni model: Pravi cenovni most · začetna cena, odbitek, dodatki, DDV in končni seštevek. Kako posamezne spremembe sestavijo končni znesek?
- Raven in canonical oblika: `module`; `derived-structured-object`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kako posamezne spremembe sestavijo končni znesek?
- Realna primera: Kako posamezne spremembe sestavijo končni znesek?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov.
- Validacija in conditional pravila: Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

### 62. Sprememba in potrditev (`sprememba-in-potrditev`)

- Trajni interface ID in contract: `atena:widget:sprememba-in-potrditev`; `atena-interface-context-v2`.
- Capability podpis: `module\|ordered-rule-or-state[]\|potrditev,rok,sprememba,znesek\|\|optional\|direct\|Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega.\|existing-draft`.
- Namen in mentalni model: Vrsta spremembe, vpliv na znesek in rok ter jasna stopnja potrditve. Kaj se je spremenilo in ali je sprememba potrjena?
- Raven in canonical oblika: `module`; `ordered-rule-or-state[]`.
- Dovoljene interaction variante: sestavljeni modul; brez neposredne zamenjave enega polja.
- Primerno: Uporabi samo, ko vprašanje neposredno zajema: Kaj se je spremenilo in ali je sprememba potrjena?
- Realna primera: Kaj se je spremenilo in ali je sprememba potrjena?; Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje.
- Neprimerno / anti-pattern: Nepovezana vprašanja ali okrasna časovnica brez dejanskih stanj.
- Validacija in conditional pravila: Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega. Pogojno polje se prikaže le po izrecno dovoljenem canonical odgovoru in skrito polje se ne shranjuje.
- Mobilno / namizno: Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.
- Native barva: Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.
- Monotonost: Dovoljen je za razbitje monotonosti le, če modul že vsebuje vse zahtevane povezane podatke; sicer je dekoracija in selection ga zavrne.
- Shranjevanje: Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.

