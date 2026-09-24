# Dejanska lokalna stran WerkTech za vgradnjo Status C

Ta mapa je nespremenjena kopija virov strani, ki teče na `http://127.0.0.1:18763/` (24. 9. 2026). Datoteke so po kopiranju preverjene s SHA-256. Vsebuje samo delujočo stran in njene lokalne slikovne vire; podatki iz brskalnikovega localStorage niso del prenosa.

## Naloga za Claude

V **tej mapi**, ne v korenski aplikaciji Uspešni Ježek, vgradi že potrjeni paket `../dosegljivost-status/` po njegovem README. Ne izdeluj nove zasnove. Stare tri ploščice »Kaj trenutno sprejemam« zamenjaj s potrjenim Status C in vsemi njegovimi nastavitvami ter logiko.

- `index.html`: vstopna stran, povezave CSS/JS z `?v=`.
- `settings-view.js/css`: stran Nastavitve, trenutni blok `availability()`, kontakti in kombiji. Obstoječi ključ shranjevanja je `werktech-settings-page-v1`; novo stanje priklopi na obstoječi `state` in `save()`, obstoječo izbiro migriraj.
- `settings-urnik.js/css`: obstoječi urnik. Njegov `mount()` preverja prisotnost `.wt-availability` in ga postavi za glavo strani. Ohrani ta pogoj oziroma združljiv ovoj, vrstni red, logiko in shranjene podatke.
- `home-overview.js/css`: obstoječa začetna stran; ohrani jo.

Pred zapisom preberi aktualne vire; en pisec, brez prepisovanja tujih sprememb. Ohrani urnik, kontakte in kombije. Brez odstopanja od potrjenega Status C. Preveri vse tri plošče, ločene kroge, Zapri, spremembe nastavitev, shranjevanje in ponovno nalaganje pri 320/390 px in namizju. Besedilo mora ostati berljivo. Poročaj točno preverjeno in morebitne blokade. Samodejno štetje zasedenosti zahteva dejanski vir koledarskih dogodkov; ne trdi, da obstaja povezava, če je ni.

Zagon za pregled: v tej mapi `python3 -m http.server 18763 --bind 127.0.0.1`, nato odpri `/index.html` in v spodnji navigaciji Nastavitve. Vgradnja v to GitHub kopijo še ne spremeni uporabnikove lokalne strani; po končanem commitu je treba spremenjene datoteke prenesti nazaj in lokalno preveriti isti tok.

## Samodejni prenos na lokalno stran 8001

Ta mapa je vir, ki ga ureja Claude. Na računalniku, kjer teče `http://localhost:8001/app/spletna-stran/`, v korenu repozitorija zaženi:

```
python3 tools/werktech-sync.py
```

Skripta vsakih 5 s naredi `git fetch` veje `claude/happy-maxwell-n3dkxx` in spremenjene datoteke iz te mape zapiše v `app/spletna-stran/`. Trenutne veje in delovnega drevesa ne spreminja. Stran z `?_dev=` se po prenosu sama osveži.

Datoteke, ki so bile lokalno spremenjene in se razlikujejo od GitHuba, skripta **ne prepiše** in jih izpiše kot `KONFLIKT`. Take lokalne spremembe je treba kopirati v to mapo in pushati, da jih Claude vidi; potem se naslednji prenosi spet izvajajo samodejno.
