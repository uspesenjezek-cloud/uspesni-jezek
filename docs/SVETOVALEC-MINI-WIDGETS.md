# Svetovalec: pogovorni mini-widgeti

## Namen

Ko Luna razume splošno uporabnikovo potrebo, vendar manjka ena zaprta odločitev, ne vrne več poljubnega dolgega vprašanja. Vrne strukturirano pojasnilo z `clarificationId`, odobrenim Nazorjevim `widgetId` in dobesednim evidence izsekom. Brskalnik vprašanje ter možnosti vzame iz lokalnega, verzioniranega registra `app/svetovalec-clarification-engine.js`.

Prosto pogovorno vprašanje (`mode: "conversation"`) je dovoljeno samo, kadar nobena registrirana odločitev ne zajame manjkajočega pomena. Tak primer se na napravi zapiše v `uj_atena_svetovalec_fallbacks_v1`. Lokalni optimizacijski korpus je `docs/data/svetovalec-conversation-fallbacks.jsonl`; test ga ob ponovnem zagonu ohrani, ponovno grupira in v poročilu označi ponavljajoče se skupine za pregled.

## Kdo odloča naslednje korake

Luna je edina semantična avtoriteta za izbor profila, namena in vsebine naslednjih vprašanj. Ne izbira več iz fiksnega vprašalnika. Vrne `questionBatch` s tremi ali štirimi koherentnimi vprašanji; po zaključku celotnega sklopa prejme saniran povzetek odgovorov in odloči naslednji sklop ali stanje `review`.

Vsako vprašanje ima dve do štiri možnosti. Strežnik ne spreminja pomena, temveč strogo preveri pogodbo, izpelje stabilne `interfaceId`/`fieldInterfaceId` ter samodejno preslika dve možnosti v odobreni `dvojni-segment`, tri ali štiri pa v odobreno `mreza-izbir`. Model zato ne izbira poljubnega UI-ja. Največ so štirje sklopi oziroma šestnajst vprašanj.

Pretekli sklopi ostanejo v pogovoru. Sprememba starega odgovora odstrani poznejše sklope in zahteva nov Luninin načrt. Odgovori, vključno z »Napiši sam«, se pošljejo samo v omejenem `conversation` kontekstu in se nikoli ne obravnavajo kot sistemska navodila.

## Varnostne meje

- Model napiše vprašanje in možnosti, ne sme pa izumiti widgeta ali `interfaceId`.
- `clarificationId` in `widgetId` morata biti veljaven par iz zaprtega registra.
- Evidence mora biti dobesedni podniz uporabnikovega vira.
- Klik na možnost se shrani kot jasen uporabnikov odgovor in pošlje Luni v ponovno preverjanje.
- Pojasnila z `selectionMode: "multiple"` dovolijo več označitev in jih pošljejo šele z gumbom `Izberi`; izključujoča pojasnila ostanejo enojna in se pošljejo takoj.
- Strežnik ponovno razreši ID možnosti in ne zaupa odjemalčevemu seznamu storitev.
- Po odgovoru mini-widgeta dobi naslednji klic samo relevantni del storitvenega kataloga.
- Runtime ne trdi, da lahko Vercelova serverless funkcija append-a v repozitorijsko datoteko. Brskalnik trajno čaka v lokalni vrsti; kanonični JSONL se posodablja z lokalnim analiznim tokom.

## Brezplačna regresija pogovorov

Zaženi:

```powershell
node scripts/test-svetovalec-mini-widget-200.js
node scripts/test-svetovalec-mini-widget-200.js --count=500
```

Test prepove `fetch`, privzeto preveri 200 različnih vnosov (ali zahtevano sodo število prek `--count`), zaprti contract, delež strukturiranih pojasnil, zmanjšanje naslednjega kataloga, čas izvajanja in ponovno analizo fallback korpusa. Strojno berljiva rezultata sta v `docs/data/svetovalec-mini-widget-200-report.json` in `docs/data/svetovalec-mini-widget-500-report.json`.
