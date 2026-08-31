# Dejavnosti engine

## Namen

`app/dejavnosti-engine.js` lokalno razvršča uporabnikov pogovorni opis dejavnosti. Omrežni ali LLM-klic ni potreben, zato vnos ne porablja AI-tokenov in deluje tudi ob izpadu zunanjih storitev.

## Pogodba

- Katalog je hierarhičen: dejavnost pripada eni od širših skupin.
- Uporabnik lahko piše strokovni naziv ali opis po domače.
- Engine vrne razvrščene predloge, dokaz ujemanja in stopnjo zaupanja.
- Rezultat je vedno predlog (`zahtevaPotrditev: true`); engine sam ne spremeni glavne dejavnosti.
- Šibek ali neznan vnos ne sme postati samodejni sklep.
- Če engine ni naložen, obrazec pokaže majhen lokalni rezervni seznam.

## Viri zasnove

- NACE Rev. 2.1: evropska hierarhična klasifikacija gospodarskih dejavnosti in pojasnila vključitev/izključitev: https://ec.europa.eu/eurostat/en/web/nace/guidance
- ISIC Rev. 5: mednarodna štiristopenjska klasifikacija gospodarskih dejavnosti: https://unstats.un.org/unsd/classifications/Econ/isic/4
- Google Business Profile: glavna kategorija naj bo specifična in naj opisuje, kaj podjetje je; dodatne kategorije naj bodo omejene: https://support.google.com/business/answer/7249669

Interni katalog uporablja uporabniku razumljiva slovenska imena in pogovorne sopomenke; uradne klasifikacije so referenčni okvir, ne neposreden uporabniški slovar.

## Preverjanje

```powershell
node scripts/test-dejavnosti-engine.js
node scripts/test-svetovalec-preverba.js
```

Test pokriva velikost in enoličnost kataloga, pogovorne izraze, tipkarske napake, neznan vnos, izločanje že izbranih dejavnosti, kombinatorne različice ter p50/p95/max izvajanja.
