# Atena – laboratorij vprašanj

Notranji route `app/atena-question-lab.html?app-preview=1` omogoča ročno presojo, kateri odobren Nazorjev format kartice naj Atena uporabi za posamezno vprašanje.

## Viri podatkov

- pogovorna vprašanja: `svetovalec-guided-question-catalog.js`;
- fiksna vprašanja storitev: `svetovalec-service-knowledge-blocks.js`;
- 62 osnovnih Nazorjevih zasnov: `atena-card-templates.js`;
- 89 sestavljenih Ateninih kartic iz petih tokov: `atena-card-schema.js`, izris prek `atena-card-renderer.js`.

Laboratorij vprašanj in kartic ne podvaja. Ob odprtju sestavi združeni katalog 151 izbir iz kanoničnih virov.

## Preslikave

Klik kartice jo najprej samo označi in ob njej odpre vnos razloga oziroma želenega popravka. Preslikava skupaj s tem opisom se shrani in naslednje vprašanje odpre šele po kliku **Potrdi**. Obstoječa preslikava ima izvor `existing`, uporabniško potrjena ali spremenjena pa `user`. Stanje se shrani v lokalni ključ `uj_atena_question_card_bindings_v1`; gumb **Izvozi preslikave** ustvari `atena-question-card-bindings.json` z opisom v polju `note` za poznejši nadzorovan prenos v produkcijski engine.

## Preverjanje

```powershell
node scripts/test-atena-question-lab.js
npm run verify:local
node scripts/test-atena-question-lab-browser.mjs
```
