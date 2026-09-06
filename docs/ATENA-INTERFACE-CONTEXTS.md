# Obširni kontekst vseh Ateninih kartic in vnosnih vrstic

Ta dokument je generiran iz strojnega contracta `atena-interface-context-v2`. Vsak spodnji ID je stabilen in se izriše tudi v DOM-u. Context določa pomen, canonical podatke, validacijo, UI, native temo, responsive vedenje in persistence.

## Potrditev razumevanja — `atena:card:ponudba:4000`

- Tok in področje: Preverite ponudbo · Skupno.
- Vprašanje in namen: Ali je Atena pravilno razumela ponudbo? Potrdite, kaj je Atena razumela
- Podatkovna oblika: confirmation; 0 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: confirmation; templatei potrditev; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4000.

## Vloga ponudnika — `atena:card:ponudba:4001`

- Tok in področje: Preverite ponudbo · Tveganja.
- Vprašanje in namen: Kakšna je vloga osebe ali podjetja, ki vam je poslalo ponudbo? Izvajalec, prodajalec ali posrednik
- Podatkovna oblika: choices; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5001.
- UI in native tema: conditional; templatei mreza-izbir, da-ne-ne-vem; question-level način module-widget → odlocitvena-pot; reason code MODULE_CONDITIONAL_BENEFIT; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4001.

### Vloga ponudnika — `atena:field:ponudba:4001:5001`

- Identiteta: tok `ponudba`, modul `4001`, polje `5001`, koda `vloga-ponudnika`.
- Uporabniški namen: Kdo dejansko izvede ali dobavi ponudbo? Osnovno vprašanje: Kakšna je vloga osebe ali podjetja, ki vam je poslalo ponudbo?
- Canonical contract: tip `select`, storage key `5001`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: izvajalec = Izvajalec; proizvajalec = Proizvajalec; prodajalec = Prodajalec; posrednik = Posrednik.
- Kontrole: `atena:control:ponudba:4001:5001:choice-group`.
- Možnosti: `atena:option:ponudba:4001:5001:izvajalec`, `atena:option:ponudba:4001:5001:proizvajalec`, `atena:option:ponudba:4001:5001:prodajalec`, `atena:option:ponudba:4001:5001:posrednik`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-grid` → `mreza-izbir`. Štiri kratke možnosti se na telefonu berejo kot mreža 2 × 2 brez stisnjenih čipov.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4001, polje 5001. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4001, polje 5001.

### Ali je ponudnik posrednik — `atena:field:ponudba:4001:5602`

- Identiteta: tok `ponudba`, modul `4001`, polje `5602`, koda `posrednik-status`.
- Uporabniški namen: Ali je ponudnik posrednik Osnovno vprašanje: Kakšna je vloga osebe ali podjetja, ki vam je poslalo ponudbo?
- Canonical contract: tip `select`, storage key `5602`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: da = Da; ne = Ne; ni-jasno = Ni jasno.
- Kontrole: `atena:control:ponudba:4001:5602:choice-group`.
- Možnosti: `atena:option:ponudba:4001:5602:da`, `atena:option:ponudba:4001:5602:ne`, `atena:option:ponudba:4001:5602:ni-jasno`.
- Relacije: `atena:relation:ponudba:4001:show-5602-when-5001`.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Prikaže se, ko polje 5001 vsebuje posrednik.
- Interaction in template: `choice-segments` → `da-ne-ne-vem`. Dve ali tri kratke, medsebojno izključujoče možnosti ostanejo hkrati vidne kot veliki tap-gumbi.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4001, polje 5602. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4001, polje 5602.

## Odnos in vir ponudbe — `atena:card:ponudba:4002`

- Tok in področje: Preverite ponudbo · Skupno.
- Vprašanje in namen: Kako in od koga ste prejeli ponudbo? Kako je ponudba prišla do vas
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5002.
- UI in native tema: conditional; templatei navpicni-izbor, besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4002.

### Kako je ponudba prišla do vas — `atena:field:ponudba:4002:5002`

- Identiteta: tok `ponudba`, modul `4002`, polje `5002`, koda `vir-ponudbe`.
- Uporabniški namen: Kako je ponudba prišla do vas Osnovno vprašanje: Kako in od koga ste prejeli ponudbo?
- Canonical contract: tip `select`, storage key `5002`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: povprasevanje = Naše povpraševanje; obstojeci = Obstoječi ponudnik; hladni-klic = Hladni klic ali pošta; priporocilo = Priporočilo; drugo = Drugo.
- Kontrole: `atena:control:ponudba:4002:5002:choice-group`.
- Možnosti: `atena:option:ponudba:4002:5002:povprasevanje`, `atena:option:ponudba:4002:5002:obstojeci`, `atena:option:ponudba:4002:5002:hladni-klic`, `atena:option:ponudba:4002:5002:priporocilo`, `atena:option:ponudba:4002:5002:drugo`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-list` → `navpicni-izbor`. Možnosti so daljše ali številnejše, zato uporabljajo navpični izbor z dovolj prostora za celotno besedilo.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4002, polje 5002. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4002, polje 5002.

### Podrobnost o prvem stiku — `atena:field:ponudba:4002:5611`

- Identiteta: tok `ponudba`, modul `4002`, polje `5611`, koda `vir-ponudbe-opomba`.
- Uporabniški namen: Kdo vas je kontaktiral in kdaj? Osnovno vprašanje: Kako in od koga ste prejeli ponudbo?
- Canonical contract: tip `text`, storage key `5611`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4002:5611:input`.
- Možnosti: ni zaprtih možnosti.
- Relacije: `atena:relation:ponudba:4002:show-5611-when-5002`.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Prikaže se, ko polje 5002 vsebuje obstojeci, hladni-klic, priporocilo, drugo.
- Interaction in template: `short-text` → `besedilni-vnos`. Odgovor je eno kratko ime, kraj ali druga jedrnata vrednost in ne potrebuje večvrstičnega vnosa.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4002, polje 5611. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4002, polje 5611.

## Oblika sodelovanja — `atena:card:ponudba:4003`

- Tok in področje: Preverite ponudbo · Pogodbeni pogoji.
- Vprašanje in namen: Kakšna je osnovna oblika sodelovanja in kateri dodatni režimi veljajo? Osnovni odnos, pogodbeni režim in način obračuna
- Podatkovna oblika: choices; 4 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5003, 5004, 5005, 5006.
- UI in native tema: stacked; templatei da-ne-ne-vem; question-level način field-composition; reason code FIELD_COMPOSITION_ORTHOGONAL_AXES; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4003.

### Kaj najbolje opiše osnovni odnos — `atena:field:ponudba:4003:5003`

- Identiteta: tok `ponudba`, modul `4003`, polje `5003`, koda `osnovni-odnos`.
- Uporabniški namen: Izberite eno osnovno obliko; dodatne režime označite spodaj. Osnovno vprašanje: Kakšna je osnovna oblika sodelovanja in kateri dodatni režimi veljajo?
- Canonical contract: tip `select`, storage key `5003`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: nakup = Enkratni nakup; projekt = Posamezen projekt; redno = Redno sodelovanje.
- Kontrole: `atena:control:ponudba:4003:5003:choice-group`.
- Možnosti: `atena:option:ponudba:4003:5003:nakup`, `atena:option:ponudba:4003:5003:projekt`, `atena:option:ponudba:4003:5003:redno`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-segments` → `da-ne-ne-vem`. Dve ali tri kratke, medsebojno izključujoče možnosti ostanejo hkrati vidne kot veliki tap-gumbi.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4003, polje 5003. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4003, polje 5003.

### Naročnina ali daljša pogodba — `atena:field:ponudba:4003:5004`

- Identiteta: tok `ponudba`, modul `4003`, polje `5004`, koda `narocnina-pogodba`.
- Uporabniški namen: Ali ta režim velja poleg osnovne oblike? Osnovno vprašanje: Kakšna je osnovna oblika sodelovanja in kateri dodatni režimi veljajo?
- Canonical contract: tip `select`, storage key `5004`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: da = Da; ne = Ne; ni-naveden = Ni navedeno.
- Kontrole: `atena:control:ponudba:4003:5004:choice-group`.
- Možnosti: `atena:option:ponudba:4003:5004:da`, `atena:option:ponudba:4003:5004:ne`, `atena:option:ponudba:4003:5004:ni-naveden`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-segments` → `da-ne-ne-vem`. Dve ali tri kratke, medsebojno izključujoče možnosti ostanejo hkrati vidne kot veliki tap-gumbi.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4003, polje 5004. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4003, polje 5004.

### Najem — `atena:field:ponudba:4003:5005`

- Identiteta: tok `ponudba`, modul `4003`, polje `5005`, koda `najem`.
- Uporabniški namen: Ali ponudba vključuje najem opreme, prostora ali pravice uporabe? Osnovno vprašanje: Kakšna je osnovna oblika sodelovanja in kateri dodatni režimi veljajo?
- Canonical contract: tip `select`, storage key `5005`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: da = Da; ne = Ne; ni-naveden = Ni navedeno.
- Kontrole: `atena:control:ponudba:4003:5005:choice-group`.
- Možnosti: `atena:option:ponudba:4003:5005:da`, `atena:option:ponudba:4003:5005:ne`, `atena:option:ponudba:4003:5005:ni-naveden`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-segments` → `da-ne-ne-vem`. Dve ali tri kratke, medsebojno izključujoče možnosti ostanejo hkrati vidne kot veliki tap-gumbi.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4003, polje 5005. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4003, polje 5005.

### Plačilo po porabi — `atena:field:ponudba:4003:5006`

- Identiteta: tok `ponudba`, modul `4003`, polje `5006`, koda `obracun-po-porabi`.
- Uporabniški namen: Ali je del cene odvisen od dejanske porabe ali uporabe? Osnovno vprašanje: Kakšna je osnovna oblika sodelovanja in kateri dodatni režimi veljajo?
- Canonical contract: tip `select`, storage key `5006`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: da = Da; ne = Ne; ni-naveden = Ni navedeno.
- Kontrole: `atena:control:ponudba:4003:5006:choice-group`.
- Možnosti: `atena:option:ponudba:4003:5006:da`, `atena:option:ponudba:4003:5006:ne`, `atena:option:ponudba:4003:5006:ni-naveden`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-segments` → `da-ne-ne-vem`. Dve ali tri kratke, medsebojno izključujoče možnosti ostanejo hkrati vidne kot veliki tap-gumbi.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4003, polje 5006. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4003, polje 5006.

## Predmet ponudbe — `atena:card:ponudba:4004`

- Tok in področje: Preverite ponudbo · Obseg ponudbe.
- Vprašanje in namen: Kaj točno kupujete in kateri rezultat pričakujete? Kaj točno kupujete
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5201.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FIELD_WIDGET_SINGLE; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4004.

### Kaj točno kupujete — `atena:field:ponudba:4004:5201`

- Identiteta: tok `ponudba`, modul `4004`, polje `5201`, koda `predmet`.
- Uporabniški namen: Izdelek, storitev ali rezultat Osnovno vprašanje: Kaj točno kupujete in kateri rezultat pričakujete?
- Canonical contract: tip `textarea`, storage key `5201`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4004:5201:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4004, polje 5201. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4004, polje 5201.

## Vključeno in izključeno — `atena:card:ponudba:4005`

- Tok in področje: Preverite ponudbo · Obseg ponudbe.
- Vprašanje in namen: Kaj je vključeno in kaj boste morali naročiti ali plačati posebej? Kaj je vključeno in kaj manjka
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5203, 5204.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način module-widget → matrika-vkljucenosti; reason code MODULE_STRUCTURED_BENEFIT; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4005.

### Kaj je vključeno — `atena:field:ponudba:4005:5203`

- Identiteta: tok `ponudba`, modul `4005`, polje `5203`, koda `vkljuceno`.
- Uporabniški namen: Dostava, montaža, konfiguracija, usposabljanje … Osnovno vprašanje: Kaj je vključeno in kaj boste morali naročiti ali plačati posebej?
- Canonical contract: tip `textarea`, storage key `5203`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4005:5203:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4005, polje 5203. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4005, polje 5203.

### Kaj ni vključeno ali ni jasno — `atena:field:ponudba:4005:5204`

- Identiteta: tok `ponudba`, modul `4005`, polje `5204`, koda `izkljuceno`.
- Uporabniški namen: Kaj bo treba naročiti ali plačati posebej? Osnovno vprašanje: Kaj je vključeno in kaj boste morali naročiti ali plačati posebej?
- Canonical contract: tip `textarea`, storage key `5204`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4005:5204:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4005, polje 5204. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4005, polje 5204.

## Količina in enota — `atena:card:ponudba:4006`

- Tok in področje: Preverite ponudbo · Obseg ponudbe.
- Vprašanje in namen: Kakšna sta količina in obračunska enota? Količina, površina, uporabniki ali čas
- Podatkovna oblika: text; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5103.
- UI in native tema: stacked; templatei kolicina-in-enota; question-level način field-composition; reason code FIELD_WIDGET_SINGLE; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4006.

### Količina in obračunska enota — `atena:field:ponudba:4006:5103`

- Identiteta: tok `ponudba`, modul `4006`, polje `5103`, koda `kolicina-enota`.
- Uporabniški namen: npr. 12 ur, 30 m², 3 uporabniki Osnovno vprašanje: Kakšna sta količina in obračunska enota?
- Canonical contract: tip `text`, storage key `5103`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4006:5103:number`, `atena:control:ponudba:4006:5103:unit`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `quantity-unit` → `kolicina-in-enota`. Odgovor ni samo številka: količina in obračunska enota se zajameta skupaj in se shranita kot ena preverljiva vrednost.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4006, polje 5103. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4006, polje 5103.

## Specifikacija in kakovost — `atena:card:ponudba:4007`

- Tok in področje: Preverite ponudbo · Obseg ponudbe.
- Vprašanje in namen: Katere specifikacije, materiali, modeli ali standardi morajo veljati? Model, material, standard in različica
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5202.
- UI in native tema: stacked; templatei besedilni-vnos, kolicina-in-enota; question-level način field-composition; reason code FIELD_COMPOSITION_EXACT_TYPES; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4007.

### Specifikacije in kakovost — `atena:field:ponudba:4007:5202`

- Identiteta: tok `ponudba`, modul `4007`, polje `5202`, koda `kolicine-specifikacije`.
- Uporabniški namen: Mere, modeli, material, standard ali različica Osnovno vprašanje: Katere specifikacije, materiali, modeli ali standardi morajo veljati?
- Canonical contract: tip `textarea`, storage key `5202`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4007:5202:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4007, polje 5202. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4007, polje 5202.

### Licence, uporabniki, naprave ali lokacije — `atena:field:ponudba:4007:5208`

- Identiteta: tok `ponudba`, modul `4007`, polje `5208`, koda `licence-uporabniki`.
- Uporabniški namen: Kaj omejuje uporabo? Osnovno vprašanje: Katere specifikacije, materiali, modeli ali standardi morajo veljati?
- Canonical contract: tip `text`, storage key `5208`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4007:5208:number`, `atena:control:ponudba:4007:5208:unit`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `quantity-unit` → `kolicina-in-enota`. Odgovor ni samo številka: količina in obračunska enota se zajameta skupaj in se shranita kot ena preverljiva vrednost.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4007, polje 5208. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4007, polje 5208.

## Obveznosti naročnika — `atena:card:ponudba:4008`

- Tok in področje: Preverite ponudbo · Obseg ponudbe.
- Vprašanje in namen: Kaj morate pred začetkom zagotoviti vi? Kaj morate zagotoviti vi
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5205.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FIELD_WIDGET_SINGLE; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4008.

### Kaj morate zagotoviti vi — `atena:field:ponudba:4008:5205`

- Identiteta: tok `ponudba`, modul `4008`, polje `5205`, koda `obveznosti-narocnika`.
- Uporabniški namen: Dostop, elektrika, vsebine, dovoljenja, materiali … Osnovno vprašanje: Kaj morate pred začetkom zagotoviti vi?
- Canonical contract: tip `textarea`, storage key `5205`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4008:5205:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4008, polje 5205. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4008, polje 5205.

## Enkratna cena — `atena:card:ponudba:4009`

- Tok in področje: Preverite ponudbo · Cena in stroški.
- Vprašanje in namen: Kakšna je enkratna cena in ali vključuje DDV? Znesek, valuta in DDV
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5101, 5102.
- UI in native tema: stacked; templatei natancen-znesek, da-ne-ne-vem; question-level način field-composition; reason code FIELD_COMPOSITION_EXACT_TYPES; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4009.

### Osnovna cena — `atena:field:ponudba:4009:5101`

- Identiteta: tok `ponudba`, modul `4009`, polje `5101`, koda `osnovna-cena`.
- Uporabniški namen: Cena brez dodatnih stroškov Osnovno vprašanje: Kakšna je enkratna cena in ali vključuje DDV?
- Canonical contract: tip `money`, storage key `5101`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4009:5101:amount`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `money` → `natancen-znesek`. Znesek mora biti natančen, zato uporablja numerični vnos z valuto in ne približnega sliderja.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4009, polje 5101. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4009, polje 5101.

### DDV — `atena:field:ponudba:4009:5102`

- Identiteta: tok `ponudba`, modul `4009`, polje `5102`, koda `ddv`.
- Uporabniški namen: DDV Osnovno vprašanje: Kakšna je enkratna cena in ali vključuje DDV?
- Canonical contract: tip `select`, storage key `5102`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: vkljucen = Vključen; ni-vkljucen = Ni vključen; ni-naveden = Ni naveden.
- Kontrole: `atena:control:ponudba:4009:5102:choice-group`.
- Možnosti: `atena:option:ponudba:4009:5102:vkljucen`, `atena:option:ponudba:4009:5102:ni-vkljucen`, `atena:option:ponudba:4009:5102:ni-naveden`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-segments` → `da-ne-ne-vem`. Dve ali tri kratke, medsebojno izključujoče možnosti ostanejo hkrati vidne kot veliki tap-gumbi.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4009, polje 5102. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4009, polje 5102.

## Ponavljajoča cena — `atena:card:ponudba:4010`

- Tok in področje: Preverite ponudbo · Cena in stroški.
- Vprašanje in namen: Kolikšen je redni strošek in kako pogosto se plača? Mesečni ali letni strošek
- Podatkovna oblika: money; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5106.
- UI in native tema: stacked; templatei natancen-znesek; question-level način field-composition; reason code FIELD_WIDGET_SINGLE; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4010.

### Ponavljajoči strošek — `atena:field:ponudba:4010:5106`

- Identiteta: tok `ponudba`, modul `4010`, polje `5106`, koda `ponavljajoci-strosek`.
- Uporabniški namen: Mesečni ali letni znesek Osnovno vprašanje: Kolikšen je redni strošek in kako pogosto se plača?
- Canonical contract: tip `money`, storage key `5106`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4010:5106:amount`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `money` → `natancen-znesek`. Znesek mora biti natančen, zato uporablja numerični vnos z valuto in ne približnega sliderja.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4010, polje 5106. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4010, polje 5106.

## Cena po porabi — `atena:card:ponudba:4011`

- Tok in področje: Preverite ponudbo · Cena in stroški.
- Vprašanje in namen: Po kateri enoti, pragu ali odstotku se obračuna poraba oziroma uspeh? Enota, prag in način obračuna
- Podatkovna oblika: text; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5108.
- UI in native tema: stacked; templatei znesek-ali-odstotek; question-level način field-composition; reason code FIELD_WIDGET_SINGLE; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4011.

### Cena po porabi ali uspehu — `atena:field:ponudba:4011:5108`

- Identiteta: tok `ponudba`, modul `4011`, polje `5108`, koda `provizija-osnova`.
- Uporabniški namen: Odstotek, enota, prag in osnova obračuna Osnovno vprašanje: Po kateri enoti, pragu ali odstotku se obračuna poraba oziroma uspeh?
- Canonical contract: tip `text`, storage key `5108`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4011:5108:value`, `atena:control:ponudba:4011:5108:basis`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `rate` → `znesek-ali-odstotek`. Cena po porabi ali uspehu potrebuje vrednost ter osnovo obračuna; sam slider bi izgubil zahtevano natančnost.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4011, polje 5108. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4011, polje 5108.

## Dodatki in popusti — `atena:card:ponudba:4012`

- Tok in področje: Preverite ponudbo · Cena in stroški.
- Vprašanje in namen: Kateri dodatni stroški, popusti ali podražitve lahko spremenijo končno ceno? Dodatni stroški, popusti in podražitve
- Podatkovna oblika: mixed-form; 3 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5105.
- UI in native tema: progressive; templatei besedilni-vnos; question-level način field-composition; reason code FIELD_COMPOSITION_EXACT_TYPES; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4012.

### Popusti in pogoji popusta — `atena:field:ponudba:4012:5104`

- Identiteta: tok `ponudba`, modul `4012`, polje `5104`, koda `popusti`.
- Uporabniški namen: Kdaj popust velja in kdaj se izgubi? Osnovno vprašanje: Kateri dodatni stroški, popusti ali podražitve lahko spremenijo končno ceno?
- Canonical contract: tip `textarea`, storage key `5104`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4012:5104:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4012, polje 5104. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4012, polje 5104.

### Dodatni in enkratni stroški — `atena:field:ponudba:4012:5105`

- Identiteta: tok `ponudba`, modul `4012`, polje `5105`, koda `dodatni-stroski`.
- Uporabniški namen: Aktivacija, dostava, montaža, pot, material … Osnovno vprašanje: Kateri dodatni stroški, popusti ali podražitve lahko spremenijo končno ceno?
- Canonical contract: tip `textarea`, storage key `5105`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4012:5105:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4012, polje 5105. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4012, polje 5105.

### Podražitve in indeksacija — `atena:field:ponudba:4012:5107`

- Identiteta: tok `ponudba`, modul `4012`, polje `5107`, koda `indeksacija`.
- Uporabniški namen: Kako in kdaj se cena lahko spremeni? Osnovno vprašanje: Kateri dodatni stroški, popusti ali podražitve lahko spremenijo končno ceno?
- Canonical contract: tip `textarea`, storage key `5107`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4012:5107:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4012, polje 5107. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4012, polje 5107.

## Začetek in rok — `atena:card:ponudba:4013`

- Tok in področje: Preverite ponudbo · Plačilo in roki.
- Vprašanje in namen: Kdaj se izvedba začne in do kdaj mora biti zaključena? Točen ali približen datum
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5302.
- UI in native tema: stacked; templatei datum-z-gotovostjo; question-level način module-widget → casovnica-mejnikov; reason code MODULE_ORDERED_TIME_BENEFIT; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4013.

### Predviden začetek — `atena:field:ponudba:4013:5301`

- Identiteta: tok `ponudba`, modul `4013`, polje `5301`, koda `zacetek`.
- Uporabniški namen: Predviden začetek Osnovno vprašanje: Kdaj se izvedba začne in do kdaj mora biti zaključena?
- Canonical contract: tip `date`, storage key `5301`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4013:5301:date`, `atena:control:ponudba:4013:5301:precision`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `date` → `datum-z-gotovostjo`. Ko je smiseln točen datum, se uporabi namenski date picker z možnostma »Ne vem« in »Približno«.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4013, polje 5301. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4013, polje 5301.

### Rok izvedbe ali dobave — `atena:field:ponudba:4013:5302`

- Identiteta: tok `ponudba`, modul `4013`, polje `5302`, koda `rok-izvedbe`.
- Uporabniški namen: Datum, približno obdobje ali število delovnih dni Osnovno vprašanje: Kdaj se izvedba začne in do kdaj mora biti zaključena?
- Canonical contract: tip `text`, storage key `5302`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4013:5302:value`, `atena:control:ponudba:4013:5302:unknown`, `atena:control:ponudba:4013:5302:approximate`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `deadline` → `datum-z-gotovostjo`. Odgovor je lahko datum, približno obdobje ali relativni rok, zato dobi neposredni vnos in jasni možnosti »Ne vem« ter »Približno«.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4013, polje 5302. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4013, polje 5302.

## Obroki in mejniki — `atena:card:ponudba:4014`

- Tok in področje: Preverite ponudbo · Plačilo in roki.
- Vprašanje in namen: Kolikšni so predplačilo, obroki in roki plačila ob posameznih mejnikih? Zneski, dogodki in roki
- Podatkovna oblika: mixed-form; 6 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5304, 5305.
- UI in native tema: progressive; templatei znesek-ali-odstotek, besedilni-vnos, kolicina-in-enota, natancen-znesek, navpicni-izbor; question-level način field-composition; reason code FIELD_COMPOSITION_EXACT_TYPES; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4014.

### Predplačilo — `atena:field:ponudba:4014:5303`

- Identiteta: tok `ponudba`, modul `4014`, polje `5303`, koda `predplacilo`.
- Uporabniški namen: Znesek ali odstotek Osnovno vprašanje: Kolikšni so predplačilo, obroki in roki plačila ob posameznih mejnikih?
- Canonical contract: tip `money`, storage key `5303`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4014:5303:amount`, `atena:control:ponudba:4014:5303:unit`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `money-or-percent` → `znesek-ali-odstotek`. Predplačilo je lahko znesek ali odstotek, zato uporabnik izbere enoto in vnese natančno številko.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4014, polje 5303. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4014, polje 5303.

### Obroki in mejniki — `atena:field:ponudba:4014:5304`

- Identiteta: tok `ponudba`, modul `4014`, polje `5304`, koda `obroki-mejniki`.
- Uporabniški namen: Kateri znesek zapade ob katerem dogodku? Osnovno vprašanje: Kolikšni so predplačilo, obroki in roki plačila ob posameznih mejnikih?
- Canonical contract: tip `textarea`, storage key `5304`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4014:5304:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4014, polje 5304. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4014, polje 5304.

### Rok plačila računa — `atena:field:ponudba:4014:5305`

- Identiteta: tok `ponudba`, modul `4014`, polje `5305`, koda `rok-placila`.
- Uporabniški namen: npr. 14 dni Osnovno vprašanje: Kolikšni so predplačilo, obroki in roki plačila ob posameznih mejnikih?
- Canonical contract: tip `text`, storage key `5305`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4014:5305:number`, `atena:control:ponudba:4014:5305:unit`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `duration` → `kolicina-in-enota`. Majhna časovna količina uporablja stepper in izrecno enoto; enkratno oziroma nedoločen čas ostaneta veliki bližnjici.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4014, polje 5305. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4014, polje 5305.

### Zamudne obresti in stroški — `atena:field:ponudba:4014:5306`

- Identiteta: tok `ponudba`, modul `4014`, polje `5306`, koda `zamuda-obresti`.
- Uporabniški namen: Zamudne obresti in stroški Osnovno vprašanje: Kolikšni so predplačilo, obroki in roki plačila ob posameznih mejnikih?
- Canonical contract: tip `textarea`, storage key `5306`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4014:5306:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4014, polje 5306. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4014, polje 5306.

### Zadržani znesek do prevzema — `atena:field:ponudba:4014:5307`

- Identiteta: tok `ponudba`, modul `4014`, polje `5307`, koda `zadrzani-znesek`.
- Uporabniški namen: Zadržani znesek do prevzema Osnovno vprašanje: Kolikšni so predplačilo, obroki in roki plačila ob posameznih mejnikih?
- Canonical contract: tip `money`, storage key `5307`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4014:5307:amount`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `money` → `natancen-znesek`. Znesek mora biti natančen, zato uporablja numerični vnos z valuto in ne približnega sliderja.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4014, polje 5307. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4014, polje 5307.

### Način plačila — `atena:field:ponudba:4014:5308`

- Identiteta: tok `ponudba`, modul `4014`, polje `5308`, koda `nacin-placila`.
- Uporabniški namen: Nakazilo, kartica, direktna obremenitev … Osnovno vprašanje: Kolikšni so predplačilo, obroki in roki plačila ob posameznih mejnikih?
- Canonical contract: tip `text`, storage key `5308`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4014:5308:choice-group`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `payment-method` → `navpicni-izbor`. Način plačila je majhen, znan nabor velikih možnosti z možnostjo »Drugo«.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4014, polje 5308. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4014, polje 5308.

## Termin in razpoložljivost — `atena:card:ponudba:4015`

- Tok in področje: Preverite ponudbo · Plačilo in roki.
- Vprašanje in namen: Kateri termin, časovno okno ali pogostost izvedbe velja? Termin, časovno okno in pogostost
- Podatkovna oblika: text; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5309.
- UI in native tema: stacked; templatei termin-in-pogostost; question-level način field-composition; reason code FIELD_WIDGET_SINGLE; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4015.

### Termin in razpoložljivost — `atena:field:ponudba:4015:5309`

- Identiteta: tok `ponudba`, modul `4015`, polje `5309`, koda `termin-pogostost`.
- Uporabniški namen: Datum, časovno okno ali pogostost storitve Osnovno vprašanje: Kateri termin, časovno okno ali pogostost izvedbe velja?
- Canonical contract: tip `text`, storage key `5309`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4015:5309:value`, `atena:control:ponudba:4015:5309:quick-choice`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `schedule` → `termin-in-pogostost`. Termin je lahko časovno okno ali pogostost, zato uporablja neposredni vnos z varnimi časovnimi bližnjicami.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4015, polje 5309. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4015, polje 5309.

## Trajanje in podaljšanje — `atena:card:ponudba:4016`

- Tok in področje: Preverite ponudbo · Pogodbeni pogoji.
- Vprašanje in namen: Koliko časa traja pogodba, kakšna je vezava in kako se podaljša? Trajanje, vezava in avtomatsko podaljšanje
- Podatkovna oblika: mixed-form; 3 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5401, 5403.
- UI in native tema: progressive; templatei kolicina-in-enota, besedilni-vnos; question-level način module-widget → pravilo-ponavljanja; reason code MODULE_ORDERED_RULE_BENEFIT; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4016.

### Trajanje pogodbe — `atena:field:ponudba:4016:5401`

- Identiteta: tok `ponudba`, modul `4016`, polje `5401`, koda `trajanje`.
- Uporabniški namen: Določen čas, nedoločen čas ali enkratno Osnovno vprašanje: Koliko časa traja pogodba, kakšna je vezava in kako se podaljša?
- Canonical contract: tip `text`, storage key `5401`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4016:5401:number`, `atena:control:ponudba:4016:5401:unit`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `duration` → `kolicina-in-enota`. Majhna časovna količina uporablja stepper in izrecno enoto; enkratno oziroma nedoločen čas ostaneta veliki bližnjici.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4016, polje 5401. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4016, polje 5401.

### Minimalna vezava — `atena:field:ponudba:4016:5402`

- Identiteta: tok `ponudba`, modul `4016`, polje `5402`, koda `vezava`.
- Uporabniški namen: Minimalna vezava Osnovno vprašanje: Koliko časa traja pogodba, kakšna je vezava in kako se podaljša?
- Canonical contract: tip `text`, storage key `5402`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4016:5402:number`, `atena:control:ponudba:4016:5402:unit`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `duration` → `kolicina-in-enota`. Majhna časovna količina uporablja stepper in izrecno enoto; enkratno oziroma nedoločen čas ostaneta veliki bližnjici.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4016, polje 5402. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4016, polje 5402.

### Samodejno podaljšanje — `atena:field:ponudba:4016:5403`

- Identiteta: tok `ponudba`, modul `4016`, polje `5403`, koda `podaljsanje`.
- Uporabniški namen: Za koliko časa in pod katerimi pogoji? Osnovno vprašanje: Koliko časa traja pogodba, kakšna je vezava in kako se podaljša?
- Canonical contract: tip `textarea`, storage key `5403`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4016:5403:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4016, polje 5403. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4016, polje 5403.

## Odpoved in izstop — `atena:card:ponudba:4017`

- Tok in področje: Preverite ponudbo · Pogodbeni pogoji.
- Vprašanje in namen: Kako in do kdaj lahko pogodbo odpoveste ter koliko stane izstop? Rok, način odpovedi in strošek izstopa
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5404.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FIELD_COMPOSITION_EXACT_TYPES; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4017.

### Odpovedni rok in način odpovedi — `atena:field:ponudba:4017:5404`

- Identiteta: tok `ponudba`, modul `4017`, polje `5404`, koda `odpovedni-rok`.
- Uporabniški namen: Rok, naslov in zahtevana oblika Osnovno vprašanje: Kako in do kdaj lahko pogodbo odpoveste ter koliko stane izstop?
- Canonical contract: tip `textarea`, storage key `5404`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4017:5404:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4017, polje 5404. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4017, polje 5404.

### Stroški izstopa, prenosa ali demontaže — `atena:field:ponudba:4017:5609`

- Identiteta: tok `ponudba`, modul `4017`, polje `5609`, koda `izstopni-stroski`.
- Uporabniški namen: Stroški izstopa, prenosa ali demontaže Osnovno vprašanje: Kako in do kdaj lahko pogodbo odpoveste ter koliko stane izstop?
- Canonical contract: tip `textarea`, storage key `5609`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4017:5609:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4017, polje 5609. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4017, polje 5609.

## Spremembe pogodbe — `atena:card:ponudba:4018`

- Tok in področje: Preverite ponudbo · Pogodbeni pogoji.
- Vprašanje in namen: Kaj lahko ponudnik enostransko spremeni in kako je omejena njegova odgovornost? Cena, obseg in enostranske spremembe
- Podatkovna oblika: mixed-form; 3 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5405.
- UI in native tema: progressive; templatei besedilni-vnos; question-level način field-composition; reason code FIELD_COMPOSITION_DISTINCT_PURPOSES; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4018.

### Enostranske spremembe pogojev — `atena:field:ponudba:4018:5405`

- Identiteta: tok `ponudba`, modul `4018`, polje `5405`, koda `spremembe-pogojev`.
- Uporabniški namen: Ali lahko ponudnik spremeni ceno ali storitev? Osnovno vprašanje: Kaj lahko ponudnik enostransko spremeni in kako je omejena njegova odgovornost?
- Canonical contract: tip `textarea`, storage key `5405`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4018:5405:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4018, polje 5405. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4018, polje 5405.

### Omejitev odgovornosti — `atena:field:ponudba:4018:5406`

- Identiteta: tok `ponudba`, modul `4018`, polje `5406`, koda `omejitev-odgovornosti`.
- Uporabniški namen: Omejitev odgovornosti Osnovno vprašanje: Kaj lahko ponudnik enostransko spremeni in kako je omejena njegova odgovornost?
- Canonical contract: tip `textarea`, storage key `5406`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4018:5406:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4018, polje 5406. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4018, polje 5406.

### Pravo in pristojno sodišče — `atena:field:ponudba:4018:5407`

- Identiteta: tok `ponudba`, modul `4018`, polje `5407`, koda `pravo-sodisce`.
- Uporabniški namen: Pravo in pristojno sodišče Osnovno vprašanje: Kaj lahko ponudnik enostransko spremeni in kako je omejena njegova odgovornost?
- Canonical contract: tip `text`, storage key `5407`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4018:5407:input`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `short-text` → `besedilni-vnos`. Odgovor je eno kratko ime, kraj ali druga jedrnata vrednost in ne potrebuje večvrstičnega vnosa.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4018, polje 5407. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4018, polje 5407.

## Rezultat in prevzem — `atena:card:ponudba:4019`

- Tok in področje: Preverite ponudbo · Obseg ponudbe.
- Vprašanje in namen: Po katerih merilih je delo končano in kdo potrdi prevzem? Kaj pomeni končano in kdo potrdi
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5207.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FIELD_COMPOSITION_DISTINCT_PURPOSES; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4019.

### Merila za rezultat in prevzem — `atena:field:ponudba:4019:5207`

- Identiteta: tok `ponudba`, modul `4019`, polje `5207`, koda `prevzem-merila`.
- Uporabniški namen: Kako se potrdi, da je delo pravilno zaključeno? Osnovno vprašanje: Po katerih merilih je delo končano in kdo potrdi prevzem?
- Canonical contract: tip `textarea`, storage key `5207`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4019:5207:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4019, polje 5207. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4019, polje 5207.

### Primerljive ponudbe ali tržne cene — `atena:field:ponudba:4019:5612`

- Identiteta: tok `ponudba`, modul `4019`, polje `5612`, koda `primerjava-trga`.
- Uporabniški namen: Primerljive ponudbe ali tržne cene Osnovno vprašanje: Po katerih merilih je delo končano in kdo potrdi prevzem?
- Canonical contract: tip `textarea`, storage key `5612`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4019:5612:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4019, polje 5612. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4019, polje 5612.

## Garancija in reklamacija — `atena:card:ponudba:4020`

- Tok in področje: Preverite ponudbo · Garancija.
- Vprašanje in namen: Kako dolgo velja garancija, kaj krije in kako prijavite napako? Trajanje, kritje in prijava napake
- Podatkovna oblika: mixed-form; 4 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5501, 5502, 5504.
- UI in native tema: progressive; templatei kolicina-in-enota, besedilni-vnos; question-level način module-widget → pogojna-garancija; reason code MODULE_CONDITIONAL_BENEFIT; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4020.

### Trajanje garancije ali jamstva — `atena:field:ponudba:4020:5501`

- Identiteta: tok `ponudba`, modul `4020`, polje `5501`, koda `trajanje-garancije`.
- Uporabniški namen: Trajanje garancije ali jamstva Osnovno vprašanje: Kako dolgo velja garancija, kaj krije in kako prijavite napako?
- Canonical contract: tip `text`, storage key `5501`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4020:5501:number`, `atena:control:ponudba:4020:5501:unit`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `duration` → `kolicina-in-enota`. Majhna časovna količina uporablja stepper in izrecno enoto; enkratno oziroma nedoločen čas ostaneta veliki bližnjici.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4020, polje 5501. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4020, polje 5501.

### Kaj garancija krije — `atena:field:ponudba:4020:5502`

- Identiteta: tok `ponudba`, modul `4020`, polje `5502`, koda `kritje-garancije`.
- Uporabniški namen: Kaj garancija krije Osnovno vprašanje: Kako dolgo velja garancija, kaj krije in kako prijavite napako?
- Canonical contract: tip `textarea`, storage key `5502`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4020:5502:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4020, polje 5502. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4020, polje 5502.

### Izključitve garancije — `atena:field:ponudba:4020:5503`

- Identiteta: tok `ponudba`, modul `4020`, polje `5503`, koda `izkljucitve-garancije`.
- Uporabniški namen: Izključitve garancije Osnovno vprašanje: Kako dolgo velja garancija, kaj krije in kako prijavite napako?
- Canonical contract: tip `textarea`, storage key `5503`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4020:5503:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4020, polje 5503. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4020, polje 5503.

### Kako prijavite napako ali reklamacijo — `atena:field:ponudba:4020:5504`

- Identiteta: tok `ponudba`, modul `4020`, polje `5504`, koda `prijava-napake`.
- Uporabniški namen: Kontakt, rok in zahtevana dokazila Osnovno vprašanje: Kako dolgo velja garancija, kaj krije in kako prijavite napako?
- Canonical contract: tip `textarea`, storage key `5504`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4020:5504:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4020, polje 5504. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4020, polje 5504.

## Podpora in odzivni roki — `atena:card:ponudba:4021`

- Tok in področje: Preverite ponudbo · Garancija.
- Vprašanje in namen: V kolikšnem času se ponudnik odzove in odpravi napako? Odziv, odprava in dosegljivost
- Podatkovna oblika: mixed-form; 3 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5505.
- UI in native tema: progressive; templatei kolicina-in-enota, besedilni-vnos, drsnik-razpona; question-level način field-composition; reason code FIELD_COMPOSITION_EXACT_TYPES; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4021.

### Odzivni in odpravljalni čas — `atena:field:ponudba:4021:5505`

- Identiteta: tok `ponudba`, modul `4021`, polje `5505`, koda `odzivni-cas`.
- Uporabniški namen: Odzivni in odpravljalni čas Osnovno vprašanje: V kolikšnem času se ponudnik odzove in odpravi napako?
- Canonical contract: tip `text`, storage key `5505`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4021:5505:response`, `atena:control:ponudba:4021:5505:resolution`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `duration-pair` → `kolicina-in-enota`. Odzivni in odpravljalni čas sta dve ločeni časovni obveznosti in morata biti razvidna v istem kontrolnem sklopu.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4021, polje 5505. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4021, polje 5505.

### Servis, rezervni deli in nadomestna oprema — `atena:field:ponudba:4021:5506`

- Identiteta: tok `ponudba`, modul `4021`, polje `5506`, koda `servis-deli`.
- Uporabniški namen: Servis, rezervni deli in nadomestna oprema Osnovno vprašanje: V kolikšnem času se ponudnik odzove in odpravi napako?
- Canonical contract: tip `textarea`, storage key `5506`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4021:5506:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4021, polje 5506. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4021, polje 5506.

### Dogovorjena razpoložljivost storitve — `atena:field:ponudba:4021:5507`

- Identiteta: tok `ponudba`, modul `4021`, polje `5507`, koda `sla-dostopnost`.
- Uporabniški namen: npr. 99,9 % ali delovni čas podpore Osnovno vprašanje: V kolikšnem času se ponudnik odzove in odpravi napako?
- Canonical contract: tip `text`, storage key `5507`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4021:5507:mode`, `atena:control:ponudba:4021:5507:value`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `availability` → `drsnik-razpona`. Razpoložljivost je lahko odstotek SLA ali delovni čas; uporabnik najprej izbere pomen in nato vnese ustrezno vrednost.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4021, polje 5507. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4021, polje 5507.

## Identiteta in dovoljenja — `atena:card:ponudba:4022`

- Tok in področje: Preverite ponudbo · Tveganja.
- Vprašanje in namen: Kdo je pravni ponudnik in katera veljavna dovoljenja ali dokazila ima? Pravna oseba, licence in dokazila
- Podatkovna oblika: mixed-form; 5 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5601.
- UI in native tema: progressive; templatei besedilni-vnos; question-level način module-widget → kontrolni-seznam-dokazil; reason code MODULE_STRUCTURED_BENEFIT; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4022.

### Pravna oseba in podpisnik — `atena:field:ponudba:4022:5601`

- Identiteta: tok `ponudba`, modul `4022`, polje `5601`, koda `pravna-identiteta`.
- Uporabniški namen: Kdo je dejanski pogodbeni partner? Osnovno vprašanje: Kdo je pravni ponudnik in katera veljavna dovoljenja ali dokazila ima?
- Canonical contract: tip `text`, storage key `5601`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4022:5601:input`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `short-text` → `besedilni-vnos`. Odgovor je eno kratko ime, kraj ali druga jedrnata vrednost in ne potrebuje večvrstičnega vnosa.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4022, polje 5601. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4022, polje 5601.

### Reference in primerljive izvedbe — `atena:field:ponudba:4022:5603`

- Identiteta: tok `ponudba`, modul `4022`, polje `5603`, koda `reference`.
- Uporabniški namen: Reference in primerljive izvedbe Osnovno vprašanje: Kdo je pravni ponudnik in katera veljavna dovoljenja ali dokazila ima?
- Canonical contract: tip `textarea`, storage key `5603`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4022:5603:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4022, polje 5603. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4022, polje 5603.

### Certifikati, licence in dovoljenja — `atena:field:ponudba:4022:5604`

- Identiteta: tok `ponudba`, modul `4022`, polje `5604`, koda `certifikati-dovoljenja`.
- Uporabniški namen: Certifikati, licence in dovoljenja Osnovno vprašanje: Kdo je pravni ponudnik in katera veljavna dovoljenja ali dokazila ima?
- Canonical contract: tip `textarea`, storage key `5604`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4022:5604:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4022, polje 5604. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4022, polje 5604.

### Zavarovanje odgovornosti — `atena:field:ponudba:4022:5605`

- Identiteta: tok `ponudba`, modul `4022`, polje `5605`, koda `zavarovanje-odgovornosti`.
- Uporabniški namen: Zavarovalnica, kritje in veljavnost Osnovno vprašanje: Kdo je pravni ponudnik in katera veljavna dovoljenja ali dokazila ima?
- Canonical contract: tip `textarea`, storage key `5605`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4022:5605:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4022, polje 5605. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4022, polje 5605.

### Varnostna in zakonska dokazila — `atena:field:ponudba:4022:5610`

- Identiteta: tok `ponudba`, modul `4022`, polje `5610`, koda `varnost-dokazila`.
- Uporabniški namen: Pregledi, meritve, izjave in roki veljavnosti Osnovno vprašanje: Kdo je pravni ponudnik in katera veljavna dovoljenja ali dokazila ima?
- Canonical contract: tip `textarea`, storage key `5610`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4022:5610:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4022, polje 5610. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4022, polje 5610.

## Podizvajalci in odvisnosti — `atena:card:ponudba:4023`

- Tok in področje: Preverite ponudbo · Tveganja.
- Vprašanje in namen: Ali bo ponudnik vključil podizvajalce in od katerih predpogojev je izvedba odvisna? Kdo izvaja in od česa je izvedba odvisna
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5206.
- UI in native tema: stacked; templatei da-ne-ne-vem, besedilni-vnos; question-level način module-widget → mreza-odvisnosti; reason code MODULE_ORDERED_RULE_BENEFIT; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4023.

### Podizvajalci — `atena:field:ponudba:4023:5206`

- Identiteta: tok `ponudba`, modul `4023`, polje `5206`, koda `podizvajalci`.
- Uporabniški namen: Ali sme ponudnik uporabiti podizvajalce? Osnovno vprašanje: Ali bo ponudnik vključil podizvajalce in od katerih predpogojev je izvedba odvisna?
- Canonical contract: tip `select`, storage key `5206`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: da = Da; ne = Ne; ni-naveden = Ni navedeno.
- Kontrole: `atena:control:ponudba:4023:5206:choice-group`.
- Možnosti: `atena:option:ponudba:4023:5206:da`, `atena:option:ponudba:4023:5206:ne`, `atena:option:ponudba:4023:5206:ni-naveden`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-segments` → `da-ne-ne-vem`. Dve ali tri kratke, medsebojno izključujoče možnosti ostanejo hkrati vidne kot veliki tap-gumbi.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4023, polje 5206. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4023, polje 5206.

### Ključne odvisnosti in predpogoji — `atena:field:ponudba:4023:5606`

- Identiteta: tok `ponudba`, modul `4023`, polje `5606`, koda `odvisnosti`.
- Uporabniški namen: Ključne odvisnosti in predpogoji Osnovno vprašanje: Ali bo ponudnik vključil podizvajalce in od katerih predpogojev je izvedba odvisna?
- Canonical contract: tip `textarea`, storage key `5606`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4023:5606:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4023, polje 5606. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4023, polje 5606.

## Podatki in lastništvo — `atena:card:ponudba:4024`

- Tok in področje: Preverite ponudbo · Tveganja.
- Vprašanje in namen: Kdo dobi dostop do podatkov in kdo obdrži datoteke, vsebine ter dostope? Dostopi, osebni podatki in izvorne datoteke
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5408, 5607.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FIELD_COMPOSITION_DISTINCT_PURPOSES; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4024.

### Lastništvo datotek, vsebin in podatkov — `atena:field:ponudba:4024:5408`

- Identiteta: tok `ponudba`, modul `4024`, polje `5408`, koda `lastnistvo-podatkov`.
- Uporabniški namen: Kdo obdrži izvorne datoteke in dostop? Osnovno vprašanje: Kdo dobi dostop do podatkov in kdo obdrži datoteke, vsebine ter dostope?
- Canonical contract: tip `textarea`, storage key `5408`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4024:5408:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4024, polje 5408. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4024, polje 5408.

### Osebni podatki, dostopi in zasebnost — `atena:field:ponudba:4024:5607`

- Identiteta: tok `ponudba`, modul `4024`, polje `5607`, koda `podatki-zasebnost`.
- Uporabniški namen: Osebni podatki, dostopi in zasebnost Osnovno vprašanje: Kdo dobi dostop do podatkov in kdo obdrži datoteke, vsebine ter dostope?
- Canonical contract: tip `textarea`, storage key `5607`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4024:5607:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4024, polje 5607. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4024, polje 5607.

## Ustna prodajna obljuba — `atena:card:ponudba:4025`

- Tok in področje: Preverite ponudbo · Tveganja.
- Vprašanje in namen: Kaj vam je bilo obljubljeno ustno, vendar v ponudbi ni jasno zapisano? Kaj je bilo obljubljeno po telefonu
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5608.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FIELD_WIDGET_SINGLE; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4025.

### Kaj je bilo obljubljeno po telefonu ali ustno — `atena:field:ponudba:4025:5608`

- Identiteta: tok `ponudba`, modul `4025`, polje `5608`, koda `ustni-dogovor`.
- Uporabniški namen: Kaj je bilo obljubljeno po telefonu ali ustno Osnovno vprašanje: Kaj vam je bilo obljubljeno ustno, vendar v ponudbi ni jasno zapisano?
- Canonical contract: tip `textarea`, storage key `5608`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4025:5608:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4025, polje 5608. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4025, polje 5608.

## Dokazilo — `atena:card:ponudba:4026`

- Tok in področje: Preverite ponudbo · Tveganja.
- Vprašanje in namen: Katero dokazilo potrjuje navedene cene, pogoje in obljube? Ponudba, pogodba, cenik ali sporočilo
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 5701.
- UI in native tema: stacked; templatei spustni-seznam, dokazilo; question-level način module-widget → ujemanje-pogojev-dokazil; reason code MODULE_ORDERED_RULE_BENEFIT; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4026.

### Vrsta dokazila — `atena:field:ponudba:4026:5701`

- Identiteta: tok `ponudba`, modul `4026`, polje `5701`, koda `dokazilo-vrsta`.
- Uporabniški namen: Vrsta dokazila Osnovno vprašanje: Katero dokazilo potrjuje navedene cene, pogoje in obljube?
- Canonical contract: tip `select`, storage key `5701`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: ponudba = Ponudba; pogodba = Pogodba; cenik = Cenik; eposta = E-pošta; posnetek = Posnetek zaslona; drugo = Drugo.
- Kontrole: `atena:control:ponudba:4026:5701:select`.
- Možnosti: `atena:option:ponudba:4026:5701:ponudba`, `atena:option:ponudba:4026:5701:pogodba`, `atena:option:ponudba:4026:5701:cenik`, `atena:option:ponudba:4026:5701:eposta`, `atena:option:ponudba:4026:5701:posnetek`, `atena:option:ponudba:4026:5701:drugo`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `dropdown` → `spustni-seznam`. Sekundarni standardizirani seznam uporablja dropdown, da ne prevzame prostora glavnemu dejanju.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4026, polje 5701. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4026, polje 5701.

### Kaj dokazilo potrjuje — `atena:field:ponudba:4026:5702`

- Identiteta: tok `ponudba`, modul `4026`, polje `5702`, koda `dokazilo-opomba`.
- Uporabniški namen: Povežite dokazilo z dejstvom, ki ga želite preveriti Osnovno vprašanje: Katero dokazilo potrjuje navedene cene, pogoje in obljube?
- Canonical contract: tip `textarea`, storage key `5702`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudba:4026:5702:file`, `atena:control:ponudba:4026:5702:note`, `atena:control:ponudba:4026:5702:remove`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `document-upload` → `dokazilo`. Vprašanje zahteva dejansko dokazilo, zato uporablja nalaganje z imenom datoteke, opombo, odstranitvijo in napako.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 4026, polje 5702. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: ponudba-moduli-engine.js, modul 4026, polje 5702.

## Končni povzetek — `atena:card:ponudba:4027`

- Tok in področje: Preverite ponudbo · Skupno.
- Vprašanje in namen: Ali so zbrana dejstva pravilna in kateri ključni podatki še manjkajo? Potrjena dejstva in manjkajoči podatki
- Podatkovna oblika: confirmation; 0 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: confirmation; templatei potrditev; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: ponudba-moduli-engine.js, modul 4027.

## Predmet naročnine — `atena:card:narocnina:6101`

- Tok in področje: Preverite naročnino · Storitev in uporaba.
- Vprašanje in namen: Kaj točno vključuje naročnina? Storitev, paket ali licenca
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16101, 16102.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6101.

### Storitev ali paket — `atena:field:narocnina:6101:16101`

- Identiteta: tok `narocnina`, modul `6101`, polje `16101`, koda `predmet`.
- Uporabniški namen: Kaj dobite za naročnino? Osnovno vprašanje: Kaj točno vključuje naročnina?
- Canonical contract: tip `textarea`, storage key `16101`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6101:16101:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6101, polje 16101. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6101, polje 16101.

### Ponudnik — `atena:field:narocnina:6101:16102`

- Identiteta: tok `narocnina`, modul `6101`, polje `16102`, koda `ponudnik`.
- Uporabniški namen: Ime pogodbenega ponudnika Osnovno vprašanje: Kaj točno vključuje naročnina?
- Canonical contract: tip `text`, storage key `16102`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6101:16102:input`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `short-text` → `besedilni-vnos`. Odgovor je eno kratko ime, kraj ali druga jedrnata vrednost in ne potrebuje večvrstičnega vnosa.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6101, polje 16102. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6101, polje 16102.

## Obseg uporabe — `atena:card:narocnina:6102`

- Tok in področje: Preverite naročnino · Storitev in uporaba.
- Vprašanje in namen: Koliko naročnine dejansko uporabljate? Uporabniki, naprave in dejanska raba
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16104.
- UI in native tema: stacked; templatei kolicina-in-enota, mreza-izbir; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6102.

### Uporabniki, naprave ali lokacije — `atena:field:narocnina:6102:16103`

- Identiteta: tok `narocnina`, modul `6102`, polje `16103`, koda `enote`.
- Uporabniški namen: npr. 5 uporabnikov ali 2 telefonski številki Osnovno vprašanje: Koliko naročnine dejansko uporabljate?
- Canonical contract: tip `text`, storage key `16103`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6102:16103:number`, `atena:control:narocnina:6102:16103:unit`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `quantity-unit` → `kolicina-in-enota`. Odgovor ni samo številka: količina in obračunska enota se zajameta skupaj in se shranita kot ena preverljiva vrednost.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6102, polje 16103. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6102, polje 16103.

### Dejanska uporaba — `atena:field:narocnina:6102:16104`

- Identiteta: tok `narocnina`, modul `6102`, polje `16104`, koda `raba`.
- Uporabniški namen: Dejanska uporaba Osnovno vprašanje: Koliko naročnine dejansko uporabljate?
- Canonical contract: tip `select`, storage key `16104`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: redno = Redno; delno = Delno; ne = Ne uporabljamo; ne-vem = Ne vem.
- Kontrole: `atena:control:narocnina:6102:16104:choice-group`.
- Možnosti: `atena:option:narocnina:6102:16104:redno`, `atena:option:narocnina:6102:16104:delno`, `atena:option:narocnina:6102:16104:ne`, `atena:option:narocnina:6102:16104:ne-vem`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-grid` → `mreza-izbir`. Štiri kratke možnosti se na telefonu berejo kot mreža 2 × 2 brez stisnjenih čipov.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6102, polje 16104. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6102, polje 16104.

## Izvedba storitve — `atena:card:narocnina:6103`

- Tok in področje: Preverite naročnino · Storitev in uporaba.
- Vprašanje in namen: Ali storitev deluje tako, kot je bilo obljubljeno? Ali storitev ustreza dogovoru
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16105.
- UI in native tema: conditional; templatei mreza-izbir, besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6103.

### Ustreznost storitve — `atena:field:narocnina:6103:16105`

- Identiteta: tok `narocnina`, modul `6103`, polje `16105`, koda `ustreznost`.
- Uporabniški namen: Ustreznost storitve Osnovno vprašanje: Ali storitev deluje tako, kot je bilo obljubljeno?
- Canonical contract: tip `select`, storage key `16105`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: da = Da; delno = Delno; ne = Ne; ne-vem = Ne vem.
- Kontrole: `atena:control:narocnina:6103:16105:choice-group`.
- Možnosti: `atena:option:narocnina:6103:16105:da`, `atena:option:narocnina:6103:16105:delno`, `atena:option:narocnina:6103:16105:ne`, `atena:option:narocnina:6103:16105:ne-vem`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-grid` → `mreza-izbir`. Štiri kratke možnosti se na telefonu berejo kot mreža 2 × 2 brez stisnjenih čipov.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6103, polje 16105. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6103, polje 16105.

### Kaj manjka ali ne deluje — `atena:field:narocnina:6103:16106`

- Identiteta: tok `narocnina`, modul `6103`, polje `16106`, koda `tezava`.
- Uporabniški namen: Opišite samo dejansko opaženo težavo Osnovno vprašanje: Ali storitev deluje tako, kot je bilo obljubljeno?
- Canonical contract: tip `textarea`, storage key `16106`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6103:16106:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: `atena:relation:narocnina:6103:show-16106-when-16105`.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Prikaže se, ko polje 16105 vsebuje delno, ne, ne-vem.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6103, polje 16106. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6103, polje 16106.

## Redni strošek — `atena:card:narocnina:6104`

- Tok in področje: Preverite naročnino · Stroški naročnine.
- Vprašanje in namen: Koliko zdaj plačujete in kako pogosto? Znesek in pogostost plačila
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16107, 16108.
- UI in native tema: stacked; templatei natancen-znesek, mreza-izbir; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6104.

### Trenutni znesek — `atena:field:narocnina:6104:16107`

- Identiteta: tok `narocnina`, modul `6104`, polje `16107`, koda `znesek`.
- Uporabniški namen: Vpišite tudi valuto Osnovno vprašanje: Koliko zdaj plačujete in kako pogosto?
- Canonical contract: tip `money`, storage key `16107`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6104:16107:amount`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `money` → `natancen-znesek`. Znesek mora biti natančen, zato uporablja numerični vnos z valuto in ne približnega sliderja.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6104, polje 16107. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6104, polje 16107.

### Pogostost plačila — `atena:field:narocnina:6104:16108`

- Identiteta: tok `narocnina`, modul `6104`, polje `16108`, koda `pogostost`.
- Uporabniški namen: Pogostost plačila Osnovno vprašanje: Koliko zdaj plačujete in kako pogosto?
- Canonical contract: tip `select`, storage key `16108`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: mesec = Mesečno; leto = Letno; poraba = Po porabi; drugo = Drugo.
- Kontrole: `atena:control:narocnina:6104:16108:choice-group`.
- Možnosti: `atena:option:narocnina:6104:16108:mesec`, `atena:option:narocnina:6104:16108:leto`, `atena:option:narocnina:6104:16108:poraba`, `atena:option:narocnina:6104:16108:drugo`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-grid` → `mreza-izbir`. Štiri kratke možnosti se na telefonu berejo kot mreža 2 × 2 brez stisnjenih čipov.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6104, polje 16108. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6104, polje 16108.

## Dodatni stroški — `atena:card:narocnina:6105`

- Tok in področje: Preverite naročnino · Stroški naročnine.
- Vprašanje in namen: Kateri dodatni stroški se pojavljajo poleg naročnine? Poraba, dodatki in oprema
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6105.

### Dodatni ali spremenljivi stroški — `atena:field:narocnina:6105:16109`

- Identiteta: tok `narocnina`, modul `6105`, polje `16109`, koda `dodatki`.
- Uporabniški namen: Poraba, oprema, dodatne licence, administracija … Osnovno vprašanje: Kateri dodatni stroški se pojavljajo poleg naročnine?
- Canonical contract: tip `textarea`, storage key `16109`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6105:16109:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6105, polje 16109. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6105, polje 16109.

## Podražitve — `atena:card:narocnina:6106`

- Tok in področje: Preverite naročnino · Stroški naročnine.
- Vprašanje in namen: Kdaj in kako se je cena nazadnje spremenila? Zadnja sprememba cene
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6106.

### Zadnja podražitev — `atena:field:narocnina:6106:16110`

- Identiteta: tok `narocnina`, modul `6106`, polje `16110`, koda `sprememba`.
- Uporabniški namen: Stari in novi znesek ter datum, če so znani Osnovno vprašanje: Kdaj in kako se je cena nazadnje spremenila?
- Canonical contract: tip `textarea`, storage key `16110`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6106:16110:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6106, polje 16110. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6106, polje 16110.

## Trajanje in vezava — `atena:card:narocnina:6107`

- Tok in področje: Preverite naročnino · Trajanje in podaljšanje.
- Vprašanje in namen: Koliko časa pogodba traja in ali še velja vezava? Začetek, konec in minimalna vezava
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16111.
- UI in native tema: stacked; templatei kolicina-in-enota; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6107.

### Trajanje pogodbe — `atena:field:narocnina:6107:16111`

- Identiteta: tok `narocnina`, modul `6107`, polje `16111`, koda `trajanje`.
- Uporabniški namen: Določen ali nedoločen čas Osnovno vprašanje: Koliko časa pogodba traja in ali še velja vezava?
- Canonical contract: tip `text`, storage key `16111`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6107:16111:number`, `atena:control:narocnina:6107:16111:unit`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `duration` → `kolicina-in-enota`. Majhna časovna količina uporablja stepper in izrecno enoto; enkratno oziroma nedoločen čas ostaneta veliki bližnjici.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6107, polje 16111. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6107, polje 16111.

### Minimalna vezava — `atena:field:narocnina:6107:16112`

- Identiteta: tok `narocnina`, modul `6107`, polje `16112`, koda `vezava`.
- Uporabniški namen: Če je znana Osnovno vprašanje: Koliko časa pogodba traja in ali še velja vezava?
- Canonical contract: tip `text`, storage key `16112`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6107:16112:number`, `atena:control:narocnina:6107:16112:unit`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `duration` → `kolicina-in-enota`. Majhna časovna količina uporablja stepper in izrecno enoto; enkratno oziroma nedoločen čas ostaneta veliki bližnjici.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6107, polje 16112. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6107, polje 16112.

## Samodejno podaljšanje — `atena:card:narocnina:6108`

- Tok in področje: Preverite naročnino · Trajanje in podaljšanje.
- Vprašanje in namen: Ali se naročnina samodejno podaljšuje? Način in obdobje podaljšanja
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16113.
- UI in native tema: conditional; templatei da-ne-ne-vem, kolicina-in-enota; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6108.

### Samodejno podaljšanje — `atena:field:narocnina:6108:16113`

- Identiteta: tok `narocnina`, modul `6108`, polje `16113`, koda `podaljsanje`.
- Uporabniški namen: Samodejno podaljšanje Osnovno vprašanje: Ali se naročnina samodejno podaljšuje?
- Canonical contract: tip `select`, storage key `16113`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: da = Da; ne = Ne; nejasno = Ni jasno.
- Kontrole: `atena:control:narocnina:6108:16113:choice-group`.
- Možnosti: `atena:option:narocnina:6108:16113:da`, `atena:option:narocnina:6108:16113:ne`, `atena:option:narocnina:6108:16113:nejasno`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-segments` → `da-ne-ne-vem`. Dve ali tri kratke, medsebojno izključujoče možnosti ostanejo hkrati vidne kot veliki tap-gumbi.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6108, polje 16113. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6108, polje 16113.

### Obdobje podaljšanja — `atena:field:narocnina:6108:16114`

- Identiteta: tok `narocnina`, modul `6108`, polje `16114`, koda `obdobje`.
- Uporabniški namen: npr. za 12 mesecev Osnovno vprašanje: Ali se naročnina samodejno podaljšuje?
- Canonical contract: tip `text`, storage key `16114`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6108:16114:number`, `atena:control:narocnina:6108:16114:unit`.
- Možnosti: ni zaprtih možnosti.
- Relacije: `atena:relation:narocnina:6108:show-16114-when-16113`.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Prikaže se, ko polje 16113 vsebuje da, nejasno.
- Interaction in template: `duration` → `kolicina-in-enota`. Majhna časovna količina uporablja stepper in izrecno enoto; enkratno oziroma nedoločen čas ostaneta veliki bližnjici.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6108, polje 16114. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6108, polje 16114.

## Rok za odločitev — `atena:card:narocnina:6109`

- Tok in področje: Preverite naročnino · Trajanje in podaljšanje.
- Vprašanje in namen: Do kdaj morate ukrepati, da se naročnina ne podaljša? Znani odpovedni datum
- Podatkovna oblika: text; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei datum-z-gotovostjo; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6109.

### Znani rok za odpoved — `atena:field:narocnina:6109:16115`

- Identiteta: tok `narocnina`, modul `6109`, polje `16115`, koda `rok`.
- Uporabniški namen: Datum ali število dni pred iztekom Osnovno vprašanje: Do kdaj morate ukrepati, da se naročnina ne podaljša?
- Canonical contract: tip `text`, storage key `16115`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6109:16115:value`, `atena:control:narocnina:6109:16115:unknown`, `atena:control:narocnina:6109:16115:approximate`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `deadline` → `datum-z-gotovostjo`. Odgovor je lahko datum, približno obdobje ali relativni rok, zato dobi neposredni vnos in jasni možnosti »Ne vem« ter »Približno«.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6109, polje 16115. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6109, polje 16115.

## Vaš cilj — `atena:card:narocnina:6110`

- Tok in področje: Preverite naročnino · Sprememba ali izstop.
- Vprašanje in namen: Kaj želite doseči z naročnino? Ohranitev, sprememba ali odpoved
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16116.
- UI in native tema: conditional; templatei navpicni-izbor, datum-z-gotovostjo; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6110.

### Želeni rezultat — `atena:field:narocnina:6110:16116`

- Identiteta: tok `narocnina`, modul `6110`, polje `16116`, koda `cilj`.
- Uporabniški namen: Želeni rezultat Osnovno vprašanje: Kaj želite doseči z naročnino?
- Canonical contract: tip `select`, storage key `16116`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: obdrzi = Obdržati pod boljšimi pogoji; spremeni = Spremeniti paket; odpovej = Odpovedati; preveri = Najprej preveriti možnosti.
- Kontrole: `atena:control:narocnina:6110:16116:choice-group`.
- Možnosti: `atena:option:narocnina:6110:16116:obdrzi`, `atena:option:narocnina:6110:16116:spremeni`, `atena:option:narocnina:6110:16116:odpovej`, `atena:option:narocnina:6110:16116:preveri`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-list` → `navpicni-izbor`. Možnosti so daljše ali številnejše, zato uporabljajo navpični izbor z dovolj prostora za celotno besedilo.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6110, polje 16116. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6110, polje 16116.

### Želeni datum spremembe — `atena:field:narocnina:6110:16117`

- Identiteta: tok `narocnina`, modul `6110`, polje `16117`, koda `datum`.
- Uporabniški namen: Želeni datum spremembe Osnovno vprašanje: Kaj želite doseči z naročnino?
- Canonical contract: tip `date`, storage key `16117`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6110:16117:date`, `atena:control:narocnina:6110:16117:precision`.
- Možnosti: ni zaprtih možnosti.
- Relacije: `atena:relation:narocnina:6110:show-16117-when-16116`.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Prikaže se, ko polje 16116 vsebuje spremeni, odpovej.
- Interaction in template: `date` → `datum-z-gotovostjo`. Ko je smiseln točen datum, se uporabi namenski date picker z možnostma »Ne vem« in »Približno«.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6110, polje 16117. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6110, polje 16117.

## Strošek izstopa — `atena:card:narocnina:6111`

- Tok in področje: Preverite naročnino · Sprememba ali izstop.
- Vprašanje in namen: Ali so navedeni stroški predčasnega izstopa? Znana nadomestila in odprte obveznosti
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6111.

### Znani stroški izstopa — `atena:field:narocnina:6111:16118`

- Identiteta: tok `narocnina`, modul `6111`, polje `16118`, koda `stroski`.
- Uporabniški namen: Brez pravne presoje; prepišite navedeno Osnovno vprašanje: Ali so navedeni stroški predčasnega izstopa?
- Canonical contract: tip `textarea`, storage key `16118`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6111:16118:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6111, polje 16118. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6111, polje 16118.

## Prenos po izstopu — `atena:card:narocnina:6112`

- Tok in področje: Preverite naročnino · Sprememba ali izstop.
- Vprašanje in namen: Kaj mora po spremembi ostati dostopno ali se prenesti? Oprema, podatki, številke in dostopi
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6112.

### Kaj je treba vrniti ali prenesti — `atena:field:narocnina:6112:16119`

- Identiteta: tok `narocnina`, modul `6112`, polje `16119`, koda `prenos`.
- Uporabniški namen: Oprema, številke, podatki, domene, licence … Osnovno vprašanje: Kaj mora po spremembi ostati dostopno ali se prenesti?
- Canonical contract: tip `textarea`, storage key `16119`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6112:16119:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6112, polje 16119. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6112, polje 16119.

## Obvestilo o spremembi — `atena:card:narocnina:6113`

- Tok in področje: Preverite naročnino · Spremembe in dokazila.
- Vprašanje in namen: Katero spremembo vam je ponudnik napovedal? Kaj in kdaj je ponudnik spremenil
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16120.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6113.

### Vsebina in datum obvestila — `atena:field:narocnina:6113:16120`

- Identiteta: tok `narocnina`, modul `6113`, polje `16120`, koda `obvestilo`.
- Uporabniški namen: Kaj se spreminja in od kdaj? Osnovno vprašanje: Katero spremembo vam je ponudnik napovedal?
- Canonical contract: tip `textarea`, storage key `16120`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6113:16120:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6113, polje 16120. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6113, polje 16120.

## Vaš odziv — `atena:card:narocnina:6114`

- Tok in področje: Preverite naročnino · Spremembe in dokazila.
- Vprašanje in namen: Ali ste spremembo izrecno sprejeli ali ji ugovarjali? Soglasje ali ugovor uporabnika
- Podatkovna oblika: single-choice; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16121.
- UI in native tema: stacked; templatei mreza-izbir; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6114.

### Vaš dosedanji odziv — `atena:field:narocnina:6114:16121`

- Identiteta: tok `narocnina`, modul `6114`, polje `16121`, koda `odziv`.
- Uporabniški namen: Vaš dosedanji odziv Osnovno vprašanje: Ali ste spremembo izrecno sprejeli ali ji ugovarjali?
- Canonical contract: tip `select`, storage key `16121`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: sprejel = Sprejel sem; ugovarjal = Ugovarjal sem; brez = Brez odziva; ne-vem = Ne vem.
- Kontrole: `atena:control:narocnina:6114:16121:choice-group`.
- Možnosti: `atena:option:narocnina:6114:16121:sprejel`, `atena:option:narocnina:6114:16121:ugovarjal`, `atena:option:narocnina:6114:16121:brez`, `atena:option:narocnina:6114:16121:ne-vem`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-grid` → `mreza-izbir`. Štiri kratke možnosti se na telefonu berejo kot mreža 2 × 2 brez stisnjenih čipov.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6114, polje 16121. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6114, polje 16121.

## Dokazila — `atena:card:narocnina:6115`

- Tok in področje: Preverite naročnino · Spremembe in dokazila.
- Vprašanje in namen: Kateri dokumenti potrjujejo dogovor in spremembe? Pogodba, račun, pogoji in sporočila
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16122.
- UI in native tema: stacked; templatei dokazilo; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6115.

### Razpoložljivi dokumenti — `atena:field:narocnina:6115:16122`

- Identiteta: tok `narocnina`, modul `6115`, polje `16122`, koda `dokazila`.
- Uporabniški namen: Pogodba, splošni pogoji, računi, e-pošta ali posnetek zaslona Osnovno vprašanje: Kateri dokumenti potrjujejo dogovor in spremembe?
- Canonical contract: tip `textarea`, storage key `16122`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:narocnina:6115:16122:file`, `atena:control:narocnina:6115:16122:note`, `atena:control:narocnina:6115:16122:remove`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `document-upload` → `dokazilo`. Vprašanje zahteva dejansko dokazilo, zato uporablja nalaganje z imenom datoteke, opombo, odstranitvijo in napako.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6115, polje 16122. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6115, polje 16122.

## Glavni cilj — `atena:card:pogajanje:6201`

- Tok in področje: Pogajajte se ali odpovejte · Cilj in prioritete.
- Vprašanje in namen: Kaj je vaš glavni cilj? Prednostna sprememba ali izstop
- Podatkovna oblika: single-choice; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16201.
- UI in native tema: stacked; templatei navpicni-izbor; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6201.

### Glavni cilj — `atena:field:pogajanje:6201:16201`

- Identiteta: tok `pogajanje`, modul `6201`, polje `16201`, koda `cilj`.
- Uporabniški namen: Glavni cilj Osnovno vprašanje: Kaj je vaš glavni cilj?
- Canonical contract: tip `select`, storage key `16201`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: cena = Boljša cena; pogoji = Boljši pogoji; obseg = Več ali drugačen obseg; odpoved = Odpoved; kombinacija = Kombinacija.
- Kontrole: `atena:control:pogajanje:6201:16201:choice-group`.
- Možnosti: `atena:option:pogajanje:6201:16201:cena`, `atena:option:pogajanje:6201:16201:pogoji`, `atena:option:pogajanje:6201:16201:obseg`, `atena:option:pogajanje:6201:16201:odpoved`, `atena:option:pogajanje:6201:16201:kombinacija`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-list` → `navpicni-izbor`. Možnosti so daljše ali številnejše, zato uporabljajo navpični izbor z dovolj prostora za celotno besedilo.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6201, polje 16201. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6201, polje 16201.

## Najpomembnejši pogoji — `atena:card:pogajanje:6202`

- Tok in področje: Pogajajte se ali odpovejte · Cilj in prioritete.
- Vprašanje in namen: Kateri pogoji so za vas najpomembnejši? Cena, obseg, rok ali kakovost
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16202.
- UI in native tema: stacked; templatei seznam-postavk; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6202.

### Najpomembnejše prioritete — `atena:field:pogajanje:6202:16202`

- Identiteta: tok `pogajanje`, modul `6202`, polje `16202`, koda `prioritete`.
- Uporabniški namen: Navedite največ tri Osnovno vprašanje: Kateri pogoji so za vas najpomembnejši?
- Canonical contract: tip `textarea`, storage key `16202`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6202:16202:item`, `atena:control:pogajanje:6202:16202:add`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `list-builder` → `seznam-postavk`. Uporabnik mora navesti več ločenih postavk; urejevalnik seznama ohrani vsako postavko pregledno in popravljivo.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6202, polje 16202. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6202, polje 16202.

## Rdeče črte — `atena:card:pogajanje:6203`

- Tok in področje: Pogajajte se ali odpovejte · Cilj in prioritete.
- Vprašanje in namen: Kje je vaša meja, čez katero ne boste šli? Česa ne želite sprejeti
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16203.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6203.

### Nesprejemljivi pogoji — `atena:field:pogajanje:6203:16203`

- Identiteta: tok `pogajanje`, modul `6203`, polje `16203`, koda `meje`.
- Uporabniški namen: Kaj mora Atena jasno zavrniti? Osnovno vprašanje: Kje je vaša meja, čez katero ne boste šli?
- Canonical contract: tip `textarea`, storage key `16203`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6203:16203:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6203, polje 16203. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6203, polje 16203.

## Trenutni dogovor — `atena:card:pogajanje:6204`

- Tok in področje: Pogajajte se ali odpovejte · Trenutno izhodišče.
- Vprašanje in namen: Kakšen dogovor ali pogodba trenutno velja? Kaj trenutno velja
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16204.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6204.

### Trenutni dogovor — `atena:field:pogajanje:6204:16204`

- Identiteta: tok `pogajanje`, modul `6204`, polje `16204`, koda `dogovor`.
- Uporabniški namen: Cena, obseg, trajanje in kar je za cilj pomembno Osnovno vprašanje: Kakšen dogovor ali pogodba trenutno velja?
- Canonical contract: tip `textarea`, storage key `16204`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6204:16204:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6204, polje 16204. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6204, polje 16204.

## Razlog za spremembo — `atena:card:pogajanje:6205`

- Tok in področje: Pogajajte se ali odpovejte · Trenutno izhodišče.
- Vprašanje in namen: Zakaj želite pogoje spremeniti ali razmerje končati? Kaj je sprožilo pogajanje
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16205.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6205.

### Razlog za spremembo — `atena:field:pogajanje:6205:16205`

- Identiteta: tok `pogajanje`, modul `6205`, polje `16205`, koda `razlog`.
- Uporabniški namen: Opišite dejstva brez pravne razlage Osnovno vprašanje: Zakaj želite pogoje spremeniti ali razmerje končati?
- Canonical contract: tip `textarea`, storage key `16205`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6205:16205:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6205, polje 16205. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6205, polje 16205.

## Sogovornik — `atena:card:pogajanje:6206`

- Tok in področje: Pogajajte se ali odpovejte · Trenutno izhodišče.
- Vprašanje in namen: S kom ste se doslej pogovarjali? Kdo odloča na drugi strani
- Podatkovna oblika: text; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16206.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6206.

### Podjetje in kontaktna oseba — `atena:field:pogajanje:6206:16206`

- Identiteta: tok `pogajanje`, modul `6206`, polje `16206`, koda `sogovornik`.
- Uporabniški namen: Podjetje in kontaktna oseba Osnovno vprašanje: S kom ste se doslej pogovarjali?
- Canonical contract: tip `text`, storage key `16206`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6206:16206:input`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `short-text` → `besedilni-vnos`. Odgovor je eno kratko ime, kraj ali druga jedrnata vrednost in ne potrebuje večvrstičnega vnosa.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6206, polje 16206. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6206, polje 16206.

## Ciljni rezultat — `atena:card:pogajanje:6207`

- Tok in področje: Pogajajte se ali odpovejte · Pogajalski okvir.
- Vprašanje in namen: Kakšen konkreten rezultat želite doseči? Želena cena ali drugi merljiv rezultat
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16207.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6207.

### Želeni rezultat — `atena:field:pogajanje:6207:16207`

- Identiteta: tok `pogajanje`, modul `6207`, polje `16207`, koda `cilj-rezultat`.
- Uporabniški namen: npr. 15 % nižja cena ali odpoved brez dodatnih stroškov Osnovno vprašanje: Kakšen konkreten rezultat želite doseči?
- Canonical contract: tip `textarea`, storage key `16207`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6207:16207:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6207, polje 16207. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6207, polje 16207.

## Sprejemljiva meja — `atena:card:pogajanje:6208`

- Tok in področje: Pogajajte se ali odpovejte · Pogajalski okvir.
- Vprašanje in namen: Kaj je za vas še sprejemljivo? Najslabši še sprejemljiv rezultat
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16208.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6208.

### Najnižji sprejemljiv rezultat — `atena:field:pogajanje:6208:16208`

- Identiteta: tok `pogajanje`, modul `6208`, polje `16208`, koda `minimum`.
- Uporabniški namen: Najnižji sprejemljiv rezultat Osnovno vprašanje: Kaj je za vas še sprejemljivo?
- Canonical contract: tip `textarea`, storage key `16208`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6208:16208:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6208, polje 16208. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6208, polje 16208.

## Alternativa in rok — `atena:card:pogajanje:6209`

- Tok in področje: Pogajajte se ali odpovejte · Pogajalski okvir.
- Vprašanje in namen: Kaj boste naredili, če dogovora ne bo, in do kdaj ga potrebujete? Druga možnost ter časovna omejitev
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: paired; templatei besedilni-vnos, datum-z-gotovostjo; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6209.

### Vaša alternativa — `atena:field:pogajanje:6209:16209`

- Identiteta: tok `pogajanje`, modul `6209`, polje `16209`, koda `alternativa`.
- Uporabniški namen: Drug ponudnik, manjši paket, premor … Osnovno vprašanje: Kaj boste naredili, če dogovora ne bo, in do kdaj ga potrebujete?
- Canonical contract: tip `textarea`, storage key `16209`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6209:16209:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6209, polje 16209. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6209, polje 16209.

### Rok za dogovor — `atena:field:pogajanje:6209:16210`

- Identiteta: tok `pogajanje`, modul `6209`, polje `16210`, koda `rok`.
- Uporabniški namen: Rok za dogovor Osnovno vprašanje: Kaj boste naredili, če dogovora ne bo, in do kdaj ga potrebujete?
- Canonical contract: tip `date`, storage key `16210`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6209:16210:date`, `atena:control:pogajanje:6209:16210:precision`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `date` → `datum-z-gotovostjo`. Ko je smiseln točen datum, se uporabi namenski date picker z možnostma »Ne vem« in »Približno«.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6209, polje 16210. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6209, polje 16210.

## Želeni konec — `atena:card:pogajanje:6210`

- Tok in področje: Pogajajte se ali odpovejte · Priprava odpovedi.
- Vprašanje in namen: Kdaj naj bi pogodba ali sodelovanje prenehalo? Kdaj želite razmerje zaključiti
- Podatkovna oblika: date; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei datum-z-gotovostjo; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6210.

### Želeni datum konca — `atena:field:pogajanje:6210:16211`

- Identiteta: tok `pogajanje`, modul `6210`, polje `16211`, koda `konec`.
- Uporabniški namen: Želeni datum konca Osnovno vprašanje: Kdaj naj bi pogodba ali sodelovanje prenehalo?
- Canonical contract: tip `date`, storage key `16211`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6210:16211:date`, `atena:control:pogajanje:6210:16211:precision`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `date` → `datum-z-gotovostjo`. Ko je smiseln točen datum, se uporabi namenski date picker z možnostma »Ne vem« in »Približno«.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6210, polje 16211. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6210, polje 16211.

## Znani pogoji izstopa — `atena:card:pogajanje:6211`

- Tok in področje: Pogajajte se ali odpovejte · Priprava odpovedi.
- Vprašanje in namen: Kaj v dokumentih piše o odpovedi ali izstopu? Rok, vezava in strošek
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6211.

### Znani pogoji odpovedi — `atena:field:pogajanje:6211:16212`

- Identiteta: tok `pogajanje`, modul `6211`, polje `16212`, koda `pogoji`.
- Uporabniški namen: Prepišite rok, vezavo in stroške; način pravne izvedbe določi strokovnjak Osnovno vprašanje: Kaj v dokumentih piše o odpovedi ali izstopu?
- Canonical contract: tip `textarea`, storage key `16212`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6211:16212:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6211, polje 16212. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6211, polje 16212.

## Posledice izstopa — `atena:card:pogajanje:6212`

- Tok in področje: Pogajajte se ali odpovejte · Priprava odpovedi.
- Vprašanje in namen: Kaj mora biti urejeno, preden sodelovanje preneha? Prenos, oprema, podatki in neprekinjenost
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6212.

### Kaj je treba urediti pred izstopom — `atena:field:pogajanje:6212:16213`

- Identiteta: tok `pogajanje`, modul `6212`, polje `16213`, koda `posledice`.
- Uporabniški namen: Oprema, podatki, številke, prehod na drugega ponudnika … Osnovno vprašanje: Kaj mora biti urejeno, preden sodelovanje preneha?
- Canonical contract: tip `textarea`, storage key `16213`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6212:16213:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6212, polje 16213. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6212, polje 16213.

## Ustne obljube — `atena:card:pogajanje:6213`

- Tok in področje: Pogajajte se ali odpovejte · Sporočilo in dokazila.
- Vprašanje in namen: Katere pomembne obljube so bile dane ustno? Kaj je bilo povedano, a ni zapisano
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6213.

### Ustne obljube — `atena:field:pogajanje:6213:16214`

- Identiteta: tok `pogajanje`, modul `6213`, polje `16214`, koda `obljube`.
- Uporabniški namen: Kdo, kaj in približno kdaj Osnovno vprašanje: Katere pomembne obljube so bile dane ustno?
- Canonical contract: tip `textarea`, storage key `16214`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6213:16214:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6213, polje 16214. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6213, polje 16214.

## Dokumenti — `atena:card:pogajanje:6214`

- Tok in področje: Pogajajte se ali odpovejte · Sporočilo in dokazila.
- Vprašanje in namen: Kateri dokumenti podpirajo vaše izhodišče? Pogodba, ponudba in komunikacija
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16215.
- UI in native tema: stacked; templatei dokazilo; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6214.

### Razpoložljivi dokumenti — `atena:field:pogajanje:6214:16215`

- Identiteta: tok `pogajanje`, modul `6214`, polje `16215`, koda `dokazila`.
- Uporabniški namen: Razpoložljivi dokumenti Osnovno vprašanje: Kateri dokumenti podpirajo vaše izhodišče?
- Canonical contract: tip `textarea`, storage key `16215`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6214:16215:file`, `atena:control:pogajanje:6214:16215:note`, `atena:control:pogajanje:6214:16215:remove`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `document-upload` → `dokazilo`. Vprašanje zahteva dejansko dokazilo, zato uporablja nalaganje z imenom datoteke, opombo, odstranitvijo in napako.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6214, polje 16215. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6214, polje 16215.

## Način pogovora — `atena:card:pogajanje:6215`

- Tok in področje: Pogajajte se ali odpovejte · Sporočilo in dokazila.
- Vprašanje in namen: Kako želite, da poteka naslednji pogovor? Ton in kanal naslednjega stika
- Podatkovna oblika: mixed-form; 3 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16216, 16217.
- UI in native tema: progressive; templatei mreza-izbir, navpicni-izbor, besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6215.

### Prednostni kanal — `atena:field:pogajanje:6215:16216`

- Identiteta: tok `pogajanje`, modul `6215`, polje `16216`, koda `kanal`.
- Uporabniški namen: Prednostni kanal Osnovno vprašanje: Kako želite, da poteka naslednji pogovor?
- Canonical contract: tip `select`, storage key `16216`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: eposta = E-pošta; telefon = Telefon; sestanek = Sestanek; priporoceno = Priporočena pošta.
- Kontrole: `atena:control:pogajanje:6215:16216:choice-group`.
- Možnosti: `atena:option:pogajanje:6215:16216:eposta`, `atena:option:pogajanje:6215:16216:telefon`, `atena:option:pogajanje:6215:16216:sestanek`, `atena:option:pogajanje:6215:16216:priporoceno`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-grid` → `mreza-izbir`. Štiri kratke možnosti se na telefonu berejo kot mreža 2 × 2 brez stisnjenih čipov.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6215, polje 16216. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6215, polje 16216.

### Želeni ton — `atena:field:pogajanje:6215:16217`

- Identiteta: tok `pogajanje`, modul `6215`, polje `16217`, koda `ton`.
- Uporabniški namen: Želeni ton Osnovno vprašanje: Kako želite, da poteka naslednji pogovor?
- Canonical contract: tip `select`, storage key `16217`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: miren = Miren in sodelovalen; odlocen = Odločen; kratek = Kratek in neposreden.
- Kontrole: `atena:control:pogajanje:6215:16217:choice-group`.
- Možnosti: `atena:option:pogajanje:6215:16217:miren`, `atena:option:pogajanje:6215:16217:odlocen`, `atena:option:pogajanje:6215:16217:kratek`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-list` → `navpicni-izbor`. Možnosti so daljše ali številnejše, zato uporabljajo navpični izbor z dovolj prostora za celotno besedilo.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6215, polje 16217. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6215, polje 16217.

### Dodatna navodila Ateni — `atena:field:pogajanje:6215:16218`

- Identiteta: tok `pogajanje`, modul `6215`, polje `16218`, koda `sporocilo`.
- Uporabniški namen: Česa naj ne obljubi ali sprejme Osnovno vprašanje: Kako želite, da poteka naslednji pogovor?
- Canonical contract: tip `textarea`, storage key `16218`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:pogajanje:6215:16218:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6215, polje 16218. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6215, polje 16218.

## Predmet povpraševanja — `atena:card:ponudbe:6301`

- Tok in področje: Uredite mi ponudbe · Potreba in rezultat.
- Vprašanje in namen: Kaj točno potrebujete? Izdelek, storitev ali rezultat
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16301.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6301.

### Kaj potrebujete — `atena:field:ponudbe:6301:16301`

- Identiteta: tok `ponudbe`, modul `6301`, polje `16301`, koda `predmet`.
- Uporabniški namen: Kaj potrebujete Osnovno vprašanje: Kaj točno potrebujete?
- Canonical contract: tip `textarea`, storage key `16301`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6301:16301:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6301, polje 16301. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6301, polje 16301.

## Uspešen rezultat — `atena:card:ponudbe:6302`

- Tok in področje: Uredite mi ponudbe · Potreba in rezultat.
- Vprašanje in namen: Kako boste vedeli, da je naročilo uspešno izvedeno? Merila dokončanja
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16302.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6302.

### Merljiv uspešen rezultat — `atena:field:ponudbe:6302:16302`

- Identiteta: tok `ponudbe`, modul `6302`, polje `16302`, koda `rezultat`.
- Uporabniški namen: Merljiv uspešen rezultat Osnovno vprašanje: Kako boste vedeli, da je naročilo uspešno izvedeno?
- Canonical contract: tip `textarea`, storage key `16302`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6302:16302:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6302, polje 16302. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6302, polje 16302.

## Razlog in uporaba — `atena:card:ponudbe:6303`

- Tok in področje: Uredite mi ponudbe · Potreba in rezultat.
- Vprašanje in namen: Za kaj boste rešitev uporabljali? Zakaj to potrebujete
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6303.

### Namen uporabe — `atena:field:ponudbe:6303:16303`

- Identiteta: tok `ponudbe`, modul `6303`, polje `16303`, koda `uporaba`.
- Uporabniški namen: Namen uporabe Osnovno vprašanje: Za kaj boste rešitev uporabljali?
- Canonical contract: tip `textarea`, storage key `16303`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6303:16303:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6303, polje 16303. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6303, polje 16303.

## Količina in obseg — `atena:card:ponudbe:6304`

- Tok in področje: Uredite mi ponudbe · Obseg in zahteve.
- Vprašanje in namen: Kolikšen obseg potrebujete? Enote, uporabniki, lokacije ali ure
- Podatkovna oblika: text; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16304.
- UI in native tema: stacked; templatei kolicina-in-enota; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6304.

### Količina in enota — `atena:field:ponudbe:6304:16304`

- Identiteta: tok `ponudbe`, modul `6304`, polje `16304`, koda `obseg`.
- Uporabniški namen: npr. 200 m², 8 uporabnikov, 3 vozila Osnovno vprašanje: Kolikšen obseg potrebujete?
- Canonical contract: tip `text`, storage key `16304`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6304:16304:number`, `atena:control:ponudbe:6304:16304:unit`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `quantity-unit` → `kolicina-in-enota`. Odgovor ni samo številka: količina in obračunska enota se zajameta skupaj in se shranita kot ena preverljiva vrednost.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6304, polje 16304. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6304, polje 16304.

## Nujne zahteve — `atena:card:ponudbe:6305`

- Tok in področje: Uredite mi ponudbe · Obseg in zahteve.
- Vprašanje in namen: Katere zahteve mora izpolniti vsaka ponudba? Specifikacije in standardi
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16305.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6305.

### Nujne zahteve — `atena:field:ponudbe:6305:16305`

- Identiteta: tok `ponudbe`, modul `6305`, polje `16305`, koda `nujno`.
- Uporabniški namen: Ločite nujno od zaželenega Osnovno vprašanje: Katere zahteve mora izpolniti vsaka ponudba?
- Canonical contract: tip `textarea`, storage key `16305`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6305:16305:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6305, polje 16305. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6305, polje 16305.

## Vaš prispevek — `atena:card:ponudbe:6306`

- Tok in področje: Uredite mi ponudbe · Obseg in zahteve.
- Vprašanje in namen: Kaj lahko zagotovite vi? Podatki, dostopi in materiali naročnika
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6306.

### Kaj zagotovite vi — `atena:field:ponudbe:6306:16306`

- Identiteta: tok `ponudbe`, modul `6306`, polje `16306`, koda `prispevek`.
- Uporabniški namen: Kaj zagotovite vi Osnovno vprašanje: Kaj lahko zagotovite vi?
- Canonical contract: tip `textarea`, storage key `16306`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6306:16306:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6306, polje 16306. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6306, polje 16306.

## Proračun — `atena:card:ponudbe:6307`

- Tok in področje: Uredite mi ponudbe · Proračun in plačilo.
- Vprašanje in namen: Kakšen cenovni okvir imate? Ciljni in najvišji znesek
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: paired; templatei natancen-znesek; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6307.

### Ciljni proračun — `atena:field:ponudbe:6307:16307`

- Identiteta: tok `ponudbe`, modul `6307`, polje `16307`, koda `ciljni-proracun`.
- Uporabniški namen: Ciljni proračun Osnovno vprašanje: Kakšen cenovni okvir imate?
- Canonical contract: tip `money`, storage key `16307`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6307:16307:amount`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `money` → `natancen-znesek`. Znesek mora biti natančen, zato uporablja numerični vnos z valuto in ne približnega sliderja.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6307, polje 16307. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6307, polje 16307.

### Najvišji znesek — `atena:field:ponudbe:6307:16308`

- Identiteta: tok `ponudbe`, modul `6307`, polje `16308`, koda `najvec`.
- Uporabniški namen: Najvišji znesek Osnovno vprašanje: Kakšen cenovni okvir imate?
- Canonical contract: tip `money`, storage key `16308`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6307:16308:amount`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `money` → `natancen-znesek`. Znesek mora biti natančen, zato uporablja numerični vnos z valuto in ne približnega sliderja.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6307, polje 16308. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6307, polje 16308.

## Način obračuna — `atena:card:ponudbe:6308`

- Tok in področje: Uredite mi ponudbe · Proračun in plačilo.
- Vprašanje in namen: Kako naj ponudniki prikažejo ceno? Fiksno, po enoti ali po porabi
- Podatkovna oblika: single-choice; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16309.
- UI in native tema: stacked; templatei navpicni-izbor; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6308.

### Želeni način obračuna — `atena:field:ponudbe:6308:16309`

- Identiteta: tok `ponudbe`, modul `6308`, polje `16309`, koda `obracun`.
- Uporabniški namen: Želeni način obračuna Osnovno vprašanje: Kako naj ponudniki prikažejo ceno?
- Canonical contract: tip `select`, storage key `16309`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: fiksno = Fiksna skupna cena; enota = Cena po enoti; poraba = Po porabi; primerjaj = Naj ponudniki predlagajo.
- Kontrole: `atena:control:ponudbe:6308:16309:choice-group`.
- Možnosti: `atena:option:ponudbe:6308:16309:fiksno`, `atena:option:ponudbe:6308:16309:enota`, `atena:option:ponudbe:6308:16309:poraba`, `atena:option:ponudbe:6308:16309:primerjaj`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-list` → `navpicni-izbor`. Možnosti so daljše ali številnejše, zato uporabljajo navpični izbor z dovolj prostora za celotno besedilo.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6308, polje 16309. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6308, polje 16309.

## Plačilni okvir — `atena:card:ponudbe:6309`

- Tok in področje: Uredite mi ponudbe · Proračun in plačilo.
- Vprašanje in namen: Kateri plačilni pogoji so za vas sprejemljivi? Predplačilo, obroki in valuta
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6309.

### Sprejemljivi plačilni pogoji — `atena:field:ponudbe:6309:16310`

- Identiteta: tok `ponudbe`, modul `6309`, polje `16310`, koda `placilo`.
- Uporabniški namen: Sprejemljivi plačilni pogoji Osnovno vprašanje: Kateri plačilni pogoji so za vas sprejemljivi?
- Canonical contract: tip `textarea`, storage key `16310`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6309:16310:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6309, polje 16310. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6309, polje 16310.

## Začetek in zaključek — `atena:card:ponudbe:6310`

- Tok in področje: Uredite mi ponudbe · Rok in izvedba.
- Vprašanje in namen: Kdaj naj se izvedba začne in konča? Želeni časovni okvir
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei datum-z-gotovostjo; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6310.

### Želeni začetek — `atena:field:ponudbe:6310:16311`

- Identiteta: tok `ponudbe`, modul `6310`, polje `16311`, koda `zacetek`.
- Uporabniški namen: Želeni začetek Osnovno vprašanje: Kdaj naj se izvedba začne in konča?
- Canonical contract: tip `date`, storage key `16311`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6310:16311:date`, `atena:control:ponudbe:6310:16311:precision`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `date` → `datum-z-gotovostjo`. Ko je smiseln točen datum, se uporabi namenski date picker z možnostma »Ne vem« in »Približno«.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6310, polje 16311. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6310, polje 16311.

### Želeni zaključek — `atena:field:ponudbe:6310:16312`

- Identiteta: tok `ponudbe`, modul `6310`, polje `16312`, koda `zakljucek`.
- Uporabniški namen: Želeni zaključek Osnovno vprašanje: Kdaj naj se izvedba začne in konča?
- Canonical contract: tip `date`, storage key `16312`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6310:16312:date`, `atena:control:ponudbe:6310:16312:precision`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `date` → `datum-z-gotovostjo`. Ko je smiseln točen datum, se uporabi namenski date picker z možnostma »Ne vem« in »Približno«.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6310, polje 16312. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6310, polje 16312.

## Lokacija izvedbe — `atena:card:ponudbe:6311`

- Tok in področje: Uredite mi ponudbe · Rok in izvedba.
- Vprašanje in namen: Kje se naročilo izvaja? Naslov, območje ali delo na daljavo
- Podatkovna oblika: text; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16313.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6311.

### Lokacija ali območje — `atena:field:ponudbe:6311:16313`

- Identiteta: tok `ponudbe`, modul `6311`, polje `16313`, koda `lokacija`.
- Uporabniški namen: Lokacija ali območje Osnovno vprašanje: Kje se naročilo izvaja?
- Canonical contract: tip `text`, storage key `16313`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6311:16313:input`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `short-text` → `besedilni-vnos`. Odgovor je eno kratko ime, kraj ali druga jedrnata vrednost in ne potrebuje večvrstičnega vnosa.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6311, polje 16313. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6311, polje 16313.

## Časovne omejitve — `atena:card:ponudbe:6312`

- Tok in področje: Uredite mi ponudbe · Rok in izvedba.
- Vprašanje in namen: Katere časovne omejitve morajo ponudniki poznati? Dostopnost, termini in odvisnosti
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6312.

### Termini in odvisnosti — `atena:field:ponudbe:6312:16314`

- Identiteta: tok `ponudbe`, modul `6312`, polje `16314`, koda `omejitve`.
- Uporabniški namen: Termini in odvisnosti Osnovno vprašanje: Katere časovne omejitve morajo ponudniki poznati?
- Canonical contract: tip `textarea`, storage key `16314`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6312:16314:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6312, polje 16314. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6312, polje 16314.

## Iskanje ponudnikov — `atena:card:ponudbe:6313`

- Tok in področje: Uredite mi ponudbe · Ponudniki in izbor.
- Vprašanje in namen: Kakšne ponudnike naj Atena poišče? Območje in tip ponudnika
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16315.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6313.

### Vrsta in območje ponudnikov — `atena:field:ponudbe:6313:16315`

- Identiteta: tok `ponudbe`, modul `6313`, polje `16315`, koda `ponudniki`.
- Uporabniški namen: Vrsta in območje ponudnikov Osnovno vprašanje: Kakšne ponudnike naj Atena poišče?
- Canonical contract: tip `textarea`, storage key `16315`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6313:16315:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6313, polje 16315. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6313, polje 16315.

## Izključitve — `atena:card:ponudbe:6314`

- Tok in področje: Uredite mi ponudbe · Ponudniki in izbor.
- Vprašanje in namen: Ali katerega ponudnika ali rešitev ne želite? Koga ali česa ne vključiti
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6314.

### Izključeni ponudniki ali rešitve — `atena:field:ponudbe:6314:16316`

- Identiteta: tok `ponudbe`, modul `6314`, polje `16316`, koda `izkljuci`.
- Uporabniški namen: Izključeni ponudniki ali rešitve Osnovno vprašanje: Ali katerega ponudnika ali rešitev ne želite?
- Canonical contract: tip `textarea`, storage key `16316`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6314:16316:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6314, polje 16316. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6314, polje 16316.

## Merila primerjave — `atena:card:ponudbe:6315`

- Tok in področje: Uredite mi ponudbe · Ponudniki in izbor.
- Vprašanje in namen: Po katerih merilih naj ponudbe primerjamo? Cena, rok, kakovost in reference
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16317.
- UI in native tema: stacked; templatei seznam-postavk; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6315.

### Tri glavna merila — `atena:field:ponudbe:6315:16317`

- Identiteta: tok `ponudbe`, modul `6315`, polje `16317`, koda `merila`.
- Uporabniški namen: npr. skupna cena, rok in garancija Osnovno vprašanje: Po katerih merilih naj ponudbe primerjamo?
- Canonical contract: tip `textarea`, storage key `16317`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6315:16317:item`, `atena:control:ponudbe:6315:16317:add`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `list-builder` → `seznam-postavk`. Uporabnik mora navesti več ločenih postavk; urejevalnik seznama ohrani vsako postavko pregledno in popravljivo.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6315, polje 16317. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6315, polje 16317.

## Obseg pridobivanja — `atena:card:ponudbe:6316`

- Tok in področje: Uredite mi ponudbe · Ponudniki in izbor.
- Vprašanje in namen: Koliko ponudb želite in kaj smemo deliti s ponudniki? Število ponudb in dovoljen stik
- Podatkovna oblika: mixed-form; 3 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16318, 16319, 16320.
- UI in native tema: stacked; templatei mreza-izbir, besedilni-vnos, da-ne-ne-vem; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6316.

### Želeno število ponudb — `atena:field:ponudbe:6316:16318`

- Identiteta: tok `ponudbe`, modul `6316`, polje `16318`, koda `stevilo`.
- Uporabniški namen: Želeno število ponudb Osnovno vprašanje: Koliko ponudb želite in kaj smemo deliti s ponudniki?
- Canonical contract: tip `select`, storage key `16318`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: dve = 2 ponudbi; tri = 3 ponudbe; pet = 5 ponudb; predlagaj = Naj Atena predlaga.
- Kontrole: `atena:control:ponudbe:6316:16318:choice-group`.
- Možnosti: `atena:option:ponudbe:6316:16318:dve`, `atena:option:ponudbe:6316:16318:tri`, `atena:option:ponudbe:6316:16318:pet`, `atena:option:ponudbe:6316:16318:predlagaj`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-grid` → `mreza-izbir`. Štiri kratke možnosti se na telefonu berejo kot mreža 2 × 2 brez stisnjenih čipov.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6316, polje 16318. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6316, polje 16318.

### Kaj smemo deliti — `atena:field:ponudbe:6316:16319`

- Identiteta: tok `ponudbe`, modul `6316`, polje `16319`, koda `deljenje`.
- Uporabniški namen: Ne vključujte skrivnosti ali nepotrebnih osebnih podatkov Osnovno vprašanje: Koliko ponudb želite in kaj smemo deliti s ponudniki?
- Canonical contract: tip `textarea`, storage key `16319`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:ponudbe:6316:16319:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6316, polje 16319. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6316, polje 16319.

### Prednostni kanal odgovorov — `atena:field:ponudbe:6316:16320`

- Identiteta: tok `ponudbe`, modul `6316`, polje `16320`, koda `kontakt`.
- Uporabniški namen: Prednostni kanal odgovorov Osnovno vprašanje: Koliko ponudb želite in kaj smemo deliti s ponudniki?
- Canonical contract: tip `select`, storage key `16320`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: eposta = E-pošta; telefon = Telefon; portal = Spletni portal.
- Kontrole: `atena:control:ponudbe:6316:16320:choice-group`.
- Možnosti: `atena:option:ponudbe:6316:16320:eposta`, `atena:option:ponudbe:6316:16320:telefon`, `atena:option:ponudbe:6316:16320:portal`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-segments` → `da-ne-ne-vem`. Dve ali tri kratke, medsebojno izključujoče možnosti ostanejo hkrati vidne kot veliki tap-gumbi.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6316, polje 16320. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6316, polje 16320.

## Podjetje in klicatelj — `atena:card:klic:6401`

- Tok in področje: Vas kliče prodajalec? · Kdo kliče.
- Vprašanje in namen: Kdo kliče in iz katerega podjetja? Identiteta sogovornika
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16401.
- UI in native tema: paired; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6401.

### Podjetje — `atena:field:klic:6401:16401`

- Identiteta: tok `klic`, modul `6401`, polje `16401`, koda `podjetje`.
- Uporabniški namen: Podjetje Osnovno vprašanje: Kdo kliče in iz katerega podjetja?
- Canonical contract: tip `text`, storage key `16401`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6401:16401:input`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `short-text` → `besedilni-vnos`. Odgovor je eno kratko ime, kraj ali druga jedrnata vrednost in ne potrebuje večvrstičnega vnosa.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6401, polje 16401. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6401, polje 16401.

### Ime klicatelja — `atena:field:klic:6401:16402`

- Identiteta: tok `klic`, modul `6401`, polje `16402`, koda `oseba`.
- Uporabniški namen: Če ga poznate Osnovno vprašanje: Kdo kliče in iz katerega podjetja?
- Canonical contract: tip `text`, storage key `16402`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6401:16402:input`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `short-text` → `besedilni-vnos`. Odgovor je eno kratko ime, kraj ali druga jedrnata vrednost in ne potrebuje večvrstičnega vnosa.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6401, polje 16402. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6401, polje 16402.

## Odnos s podjetjem — `atena:card:klic:6402`

- Tok in področje: Vas kliče prodajalec? · Kdo kliče.
- Vprašanje in namen: Ali s podjetjem že sodelujete? Prvi stik ali obstoječe sodelovanje
- Podatkovna oblika: single-choice; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16403.
- UI in native tema: stacked; templatei navpicni-izbor; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6402.

### Odnos s podjetjem — `atena:field:klic:6402:16403`

- Identiteta: tok `klic`, modul `6402`, polje `16403`, koda `odnos`.
- Uporabniški namen: Odnos s podjetjem Osnovno vprašanje: Ali s podjetjem že sodelujete?
- Canonical contract: tip `select`, storage key `16403`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prvi = Prvi stik; ponudba = Že imam ponudbo; stranka = Obstoječa stranka; nekdanji = Nekdanji ponudnik; ne-vem = Ne vem.
- Kontrole: `atena:control:klic:6402:16403:choice-group`.
- Možnosti: `atena:option:klic:6402:16403:prvi`, `atena:option:klic:6402:16403:ponudba`, `atena:option:klic:6402:16403:stranka`, `atena:option:klic:6402:16403:nekdanji`, `atena:option:klic:6402:16403:ne-vem`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-list` → `navpicni-izbor`. Možnosti so daljše ali številnejše, zato uporabljajo navpični izbor z dovolj prostora za celotno besedilo.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6402, polje 16403. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6402, polje 16403.

## Čas klica — `atena:card:klic:6403`

- Tok in področje: Vas kliče prodajalec? · Kdo kliče.
- Vprašanje in namen: Kdaj poteka klic ali je dogovorjen povratni stik? Kdaj kliče oziroma kdaj naj pokliče nazaj
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: paired; templatei datum-z-gotovostjo, termin-in-pogostost; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6403.

### Datum povratnega stika — `atena:field:klic:6403:16404`

- Identiteta: tok `klic`, modul `6403`, polje `16404`, koda `datum`.
- Uporabniški namen: Datum povratnega stika Osnovno vprašanje: Kdaj poteka klic ali je dogovorjen povratni stik?
- Canonical contract: tip `date`, storage key `16404`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6403:16404:date`, `atena:control:klic:6403:16404:precision`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `date` → `datum-z-gotovostjo`. Ko je smiseln točen datum, se uporabi namenski date picker z možnostma »Ne vem« in »Približno«.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6403, polje 16404. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6403, polje 16404.

### Primeren čas — `atena:field:klic:6403:16405`

- Identiteta: tok `klic`, modul `6403`, polje `16405`, koda `cas`.
- Uporabniški namen: npr. med 10.00 in 12.00 Osnovno vprašanje: Kdaj poteka klic ali je dogovorjen povratni stik?
- Canonical contract: tip `text`, storage key `16405`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6403:16405:value`, `atena:control:klic:6403:16405:quick-choice`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `schedule` → `termin-in-pogostost`. Termin je lahko časovno okno ali pogostost, zato uporablja neposredni vnos z varnimi časovnimi bližnjicami.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6403, polje 16405. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6403, polje 16405.

## Predmet ponudbe — `atena:card:klic:6404`

- Tok in področje: Vas kliče prodajalec? · Kaj ponuja.
- Vprašanje in namen: Kaj vam prodajalec ponuja? Izdelek ali storitev
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16406.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6404.

### Kaj prodajalec ponuja — `atena:field:klic:6404:16406`

- Identiteta: tok `klic`, modul `6404`, polje `16406`, koda `predmet`.
- Uporabniški namen: Kaj prodajalec ponuja Osnovno vprašanje: Kaj vam prodajalec ponuja?
- Canonical contract: tip `textarea`, storage key `16406`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6404:16406:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6404, polje 16406. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6404, polje 16406.

## Cena in obveznosti — `atena:card:klic:6405`

- Tok in področje: Vas kliče prodajalec? · Kaj ponuja.
- Vprašanje in namen: Kakšno ceno in obveznosti je prodajalec navedel? Znesek, trajanje in dodatki
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: paired; templatei natancen-znesek, besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6405.

### Navedena cena — `atena:field:klic:6405:16407`

- Identiteta: tok `klic`, modul `6405`, polje `16407`, koda `cena`.
- Uporabniški namen: Navedena cena Osnovno vprašanje: Kakšno ceno in obveznosti je prodajalec navedel?
- Canonical contract: tip `money`, storage key `16407`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6405:16407:amount`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `money` → `natancen-znesek`. Znesek mora biti natančen, zato uporablja numerični vnos z valuto in ne približnega sliderja.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6405, polje 16407. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6405, polje 16407.

### Trajanje, vezava in dodatki — `atena:field:klic:6405:16408`

- Identiteta: tok `klic`, modul `6405`, polje `16408`, koda `obveznosti`.
- Uporabniški namen: Trajanje, vezava in dodatki Osnovno vprašanje: Kakšno ceno in obveznosti je prodajalec navedel?
- Canonical contract: tip `textarea`, storage key `16408`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6405:16408:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6405, polje 16408. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6405, polje 16408.

## Prodajne trditve — `atena:card:klic:6406`

- Tok in področje: Vas kliče prodajalec? · Kaj ponuja.
- Vprašanje in namen: Katere pomembne koristi ali obljube prodajalec navaja? Prihranki, ugodnosti in roki
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16409.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6406.

### Obljube in prodajne trditve — `atena:field:klic:6406:16409`

- Identiteta: tok `klic`, modul `6406`, polje `16409`, koda `trditve`.
- Uporabniški namen: Obljube in prodajne trditve Osnovno vprašanje: Katere pomembne koristi ali obljube prodajalec navaja?
- Canonical contract: tip `textarea`, storage key `16409`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6406:16409:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6406, polje 16409. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6406, polje 16409.

## Cilj klica — `atena:card:klic:6407`

- Tok in področje: Vas kliče prodajalec? · Vaš cilj in meje.
- Vprašanje in namen: Kaj naj Atena v tem klicu doseže? Informacije, ponudba ali zavrnitev
- Podatkovna oblika: single-choice; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16410.
- UI in native tema: stacked; templatei navpicni-izbor; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6407.

### Želeni cilj — `atena:field:klic:6407:16410`

- Identiteta: tok `klic`, modul `6407`, polje `16410`, koda `cilj`.
- Uporabniški namen: Želeni cilj Osnovno vprašanje: Kaj naj Atena v tem klicu doseže?
- Canonical contract: tip `select`, storage key `16410`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: informacije = Samo zbrati informacije; pisno = Pridobiti pisno ponudbo; pogajanje = Pogajati se; zavrni = Vljudno zavrniti; prekini = Zahtevati konec trženjskih stikov.
- Kontrole: `atena:control:klic:6407:16410:choice-group`.
- Možnosti: `atena:option:klic:6407:16410:informacije`, `atena:option:klic:6407:16410:pisno`, `atena:option:klic:6407:16410:pogajanje`, `atena:option:klic:6407:16410:zavrni`, `atena:option:klic:6407:16410:prekini`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-list` → `navpicni-izbor`. Možnosti so daljše ali številnejše, zato uporabljajo navpični izbor z dovolj prostora za celotno besedilo.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6407, polje 16410. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6407, polje 16410.

## Vprašanja za prodajalca — `atena:card:klic:6408`

- Tok in področje: Vas kliče prodajalec? · Vaš cilj in meje.
- Vprašanje in namen: Katera vprašanja mora Atena obvezno postaviti? Kaj mora biti pojasnjeno
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16411.
- UI in native tema: stacked; templatei seznam-postavk; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6408.

### Obvezna vprašanja — `atena:field:klic:6408:16411`

- Identiteta: tok `klic`, modul `6408`, polje `16411`, koda `vprasanja`.
- Uporabniški namen: Obvezna vprašanja Osnovno vprašanje: Katera vprašanja mora Atena obvezno postaviti?
- Canonical contract: tip `textarea`, storage key `16411`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6408:16411:item`, `atena:control:klic:6408:16411:add`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `list-builder` → `seznam-postavk`. Uporabnik mora navesti več ločenih postavk; urejevalnik seznama ohrani vsako postavko pregledno in popravljivo.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6408, polje 16411. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6408, polje 16411.

## Meje pooblastila — `atena:card:klic:6409`

- Tok in področje: Vas kliče prodajalec? · Vaš cilj in meje.
- Vprašanje in namen: Česa Atena brez vaše potrditve ne sme narediti? Brez naročila, soglasja ali deljenja podatkov
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16412.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6409.

### Atena brez potrditve ne sme — `atena:field:klic:6409:16412`

- Identiteta: tok `klic`, modul `6409`, polje `16412`, koda `meje`.
- Uporabniški namen: npr. skleniti pogodbe, potrditi naročila ali deliti bančnih podatkov Osnovno vprašanje: Česa Atena brez vaše potrditve ne sme narediti?
- Canonical contract: tip `textarea`, storage key `16412`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6409:16412:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6409, polje 16412. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6409, polje 16412.

## Pritisk in nujnost — `atena:card:klic:6410`

- Tok in področje: Vas kliče prodajalec? · Varnost klica.
- Vprašanje in namen: Ali prodajalec zahteva takojšnjo odločitev? Časovno omejene zahteve
- Podatkovna oblika: single-choice; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16413.
- UI in native tema: stacked; templatei da-ne-ne-vem; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6410.

### Zahteva takojšnjo odločitev — `atena:field:klic:6410:16413`

- Identiteta: tok `klic`, modul `6410`, polje `16413`, koda `nujnost`.
- Uporabniški namen: Zahteva takojšnjo odločitev Osnovno vprašanje: Ali prodajalec zahteva takojšnjo odločitev?
- Canonical contract: tip `select`, storage key `16413`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: da = Da; ne = Ne; ne-vem = Ne vem.
- Kontrole: `atena:control:klic:6410:16413:choice-group`.
- Možnosti: `atena:option:klic:6410:16413:da`, `atena:option:klic:6410:16413:ne`, `atena:option:klic:6410:16413:ne-vem`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-segments` → `da-ne-ne-vem`. Dve ali tri kratke, medsebojno izključujoče možnosti ostanejo hkrati vidne kot veliki tap-gumbi.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6410, polje 16413. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6410, polje 16413.

## Zahtevani podatki — `atena:card:klic:6411`

- Tok in področje: Vas kliče prodajalec? · Varnost klica.
- Vprašanje in namen: Katere podatke ali dostope prodajalec zahteva? Osebni, bančni ali dostopni podatki
- Podatkovna oblika: textarea; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: stacked; templatei besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6411.

### Zahtevani podatki ali dostopi — `atena:field:klic:6411:16414`

- Identiteta: tok `klic`, modul `6411`, polje `16414`, koda `podatki`.
- Uporabniški namen: Zahtevani podatki ali dostopi Osnovno vprašanje: Katere podatke ali dostope prodajalec zahteva?
- Canonical contract: tip `textarea`, storage key `16414`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6411:16414:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6411, polje 16414. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6411, polje 16414.

## Dokazilo ponudbe — `atena:card:klic:6412`

- Tok in področje: Vas kliče prodajalec? · Varnost klica.
- Vprašanje in namen: Ali je prodajalec poslal pisno ponudbo? Pisna ponudba ali pogoji
- Podatkovna oblika: single-choice; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16415.
- UI in native tema: stacked; templatei mreza-izbir; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6412.

### Pisna ponudba obstaja — `atena:field:klic:6412:16415`

- Identiteta: tok `klic`, modul `6412`, polje `16415`, koda `pisno`.
- Uporabniški namen: Pisna ponudba obstaja Osnovno vprašanje: Ali je prodajalec poslal pisno ponudbo?
- Canonical contract: tip `select`, storage key `16415`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: da = Da; ne = Ne; obljubljena = Obljubljena; ne-vem = Ne vem.
- Kontrole: `atena:control:klic:6412:16415:choice-group`.
- Možnosti: `atena:option:klic:6412:16415:da`, `atena:option:klic:6412:16415:ne`, `atena:option:klic:6412:16415:obljubljena`, `atena:option:klic:6412:16415:ne-vem`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-grid` → `mreza-izbir`. Štiri kratke možnosti se na telefonu berejo kot mreža 2 × 2 brez stisnjenih čipov.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6412, polje 16415. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6412, polje 16415.

## Prednostni kanal — `atena:card:klic:6413`

- Tok in področje: Vas kliče prodajalec? · Povratni stik.
- Vprašanje in namen: Po katerem kanalu želite nadaljevati? Telefon, e-pošta, SMS ali pisno
- Podatkovna oblika: single-choice; 1 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16416.
- UI in native tema: stacked; templatei mreza-izbir; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6413.

### Prednostni način stika — `atena:field:klic:6413:16416`

- Identiteta: tok `klic`, modul `6413`, polje `16416`, koda `kanal`.
- Uporabniški namen: Prednostni način stika Osnovno vprašanje: Po katerem kanalu želite nadaljevati?
- Canonical contract: tip `select`, storage key `16416`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: eposta = E-pošta; sms = SMS; telefon = Telefon; posta = Priporočena pošta.
- Kontrole: `atena:control:klic:6413:16416:choice-group`.
- Možnosti: `atena:option:klic:6413:16416:eposta`, `atena:option:klic:6413:16416:sms`, `atena:option:klic:6413:16416:telefon`, `atena:option:klic:6413:16416:posta`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-grid` → `mreza-izbir`. Štiri kratke možnosti se na telefonu berejo kot mreža 2 × 2 brez stisnjenih čipov.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6413, polje 16416. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6413, polje 16416.

## Čas nadaljevanja — `atena:card:klic:6414`

- Tok in področje: Vas kliče prodajalec? · Povratni stik.
- Vprašanje in namen: Kdaj je najprimernejši naslednji stik? Datum in čas povratnega stika
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: ni novih podatkov.
- UI in native tema: paired; templatei datum-z-gotovostjo, termin-in-pogostost; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6414.

### Želeni datum — `atena:field:klic:6414:16417`

- Identiteta: tok `klic`, modul `6414`, polje `16417`, koda `datum`.
- Uporabniški namen: Želeni datum Osnovno vprašanje: Kdaj je najprimernejši naslednji stik?
- Canonical contract: tip `date`, storage key `16417`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6414:16417:date`, `atena:control:klic:6414:16417:precision`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `date` → `datum-z-gotovostjo`. Ko je smiseln točen datum, se uporabi namenski date picker z možnostma »Ne vem« in »Približno«.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6414, polje 16417. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6414, polje 16417.

### Želeni čas — `atena:field:klic:6414:16418`

- Identiteta: tok `klic`, modul `6414`, polje `16418`, koda `cas`.
- Uporabniški namen: npr. čim prej ali po 15.00 Osnovno vprašanje: Kdaj je najprimernejši naslednji stik?
- Canonical contract: tip `text`, storage key `16418`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6414:16418:value`, `atena:control:klic:6414:16418:quick-choice`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `schedule` → `termin-in-pogostost`. Termin je lahko časovno okno ali pogostost, zato uporablja neposredni vnos z varnimi časovnimi bližnjicami.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6414, polje 16418. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6414, polje 16418.

## Naslednji korak — `atena:card:klic:6415`

- Tok in področje: Vas kliče prodajalec? · Povratni stik.
- Vprašanje in namen: Kakšen naj bo naslednji korak po klicu? Kaj naj se zgodi po pogovoru
- Podatkovna oblika: mixed-form; 2 vnosnih vrstic.
- Validacija: Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna. Obvezna polja: 16419.
- UI in native tema: stacked; templatei navpicni-izbor, besedilni-vnos; question-level način field-composition; reason code FLOW_FIELD_COMPOSITION; tokeni --obrazec-barva, --obrazec-ozadje, --card-rgb.
- Persistence in izvor: Kartica ne uvaja vzporednega stanja ali drugega shranjevanja. Vir: svetovalec-storitve-engine.js, modul 6415.

### Naslednji korak — `atena:field:klic:6415:16419`

- Identiteta: tok `klic`, modul `6415`, polje `16419`, koda `naslednje`.
- Uporabniški namen: Naslednji korak Osnovno vprašanje: Kakšen naj bo naslednji korak po klicu?
- Canonical contract: tip `select`, storage key `16419`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: povzetek = Pisni povzetek; primerjava = Primerjava ponudbe; ponovni-klic = Ponovni klic po pregledu; brez = Zaključek brez nadaljevanja.
- Kontrole: `atena:control:klic:6415:16419:choice-group`.
- Možnosti: `atena:option:klic:6415:16419:povzetek`, `atena:option:klic:6415:16419:primerjava`, `atena:option:klic:6415:16419:ponovni-klic`, `atena:option:klic:6415:16419:brez`.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `choice-list` → `navpicni-izbor`. Možnosti so daljše ali številnejše, zato uporabljajo navpični izbor z dovolj prostora za celotno besedilo.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6415, polje 16419. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6415, polje 16419.

### Dodatna zahteva — `atena:field:klic:6415:16420`

- Identiteta: tok `klic`, modul `6415`, polje `16420`, koda `opomba`.
- Uporabniški namen: Dodatna zahteva Osnovno vprašanje: Kakšen naj bo naslednji korak po klicu?
- Canonical contract: tip `textarea`, storage key `16420`; Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek.
- Dovoljene vrednosti: prosta tipizirana canonical vrednost.
- Kontrole: `atena:control:klic:6415:16420:textarea`.
- Možnosti: ni zaprtih možnosti.
- Relacije: ni conditional relacij.
- Validacija in vidnost: Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano. Polje nima dodatnega showWhen pogoja.
- Interaction in template: `long-text` → `besedilni-vnos`. Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.
- Native, responsive in auto-fit: --obrazec-barva, --obrazec-ozadje, --card-rgb. 390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par. Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.
- Persistence: existing-draft, modul 6415, polje 16420. Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka.
- Anti-pattern: Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost.
- Izvor: svetovalec-storitve-engine.js, modul 6415, polje 16420.

