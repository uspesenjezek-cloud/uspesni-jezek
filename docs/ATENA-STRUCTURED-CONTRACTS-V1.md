# Atena structured contracts v1

## Veljavno stanje

- `api/_lib/atena-structured-contracts.js` je skupni Zod vir resnice za strukturirane izhode Dogovorov, Zgodovine, Ciljev in Svetovalca.
- JSON Schema za AI SDK se generira iz istega Zod kontrakta; ročno podvojena modelna shema ni dovoljena.
- Dogovor vedno vrne natanko eno od možnosti: seznam veljavnih kartic ali eno zaprto kodo pojasnila.
- Dovoljene kode pojasnila so `agreement_kind`, `accepted_or_proposed` in `promise_or_refusal`; uporabniško besedilo določi lokalni adapter.
- Vsak dokaz uporablja `EvidenceSpan` z `documentId`, `clauseId`, odmiki, dobesednim citatom in SHA-256 izvora. Napačen hash, odmik ali citat se zavrne fail-closed.
- Produkcijski Svetovalec uporablja `svetovalec-luna-block-router`; stari batch engine ni samodejni fallback.
- Zgodovina ohranja ločena `question` in `warning` stanja prek zaprte vrednosti `k` (`1` ali `2`); dinamično opozorilo še vedno navede primerjana zneska. Vsaka materializirana history kartica in pojasnilo vsebujeta canonical `EvidenceSpan`.
- Cilji uporabljajo Zod-generirani kompaktni token-range wire (`@first:last`). Vsaka materializirana ciljna kartica in pojasnilo ohranita obstoječi `evidence` za UI ter dodata canonical `evidenceSpan`.

## Stroškovni invariant

Normalni začetni tok ima en semantični modelni klic. Nadaljnja vprašanja in kombinacije rešuje lokalni graf; test 245 rešitev je preveril 1.225 tokov in 3.675 lokalnih nadaljevanj z 0 dodatnimi plačljivimi klici.

## Obvezni regresijski testi

- `node scripts/test-atena-structured-contracts.js`
- `node scripts/test-dogovor-naravni-vnos.js`
- `node scripts/test-zgodovina-debt-first-contract.js`
- `node scripts/test-zgodovina-naravni-vnos.js`
- `node scripts/test-zgodovina-1000-pogovornih-primerov.js`
- `node scripts/test-cilj-naravni-vnos.js`
- `node scripts/test-cilj-1000-pogovornih-primerov.js`
- `node scripts/test-svetovalec-luna-block-router.js`
- `node scripts/test-svetovalec-question-graph.js`
- `node scripts/test-svetovalec-245-lifecycle.js`

Kontraktov se ne spreminja brez testov za veljaven izhod, neveljaven ID, izključnost plan/vprašanje, pokvarjen dokaz in regresijo porabe konteksta.
