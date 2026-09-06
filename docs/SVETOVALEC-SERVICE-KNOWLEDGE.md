# Atena/Luna: podatkovni bloki storitev

Kanonični vir je `app/svetovalec-service-knowledge-blocks.js`. Namen te plasti je ločiti Lunino semantično odločitev od lokalnega postavljanja standardnih podvprašanj.

## Potek

1. Prvi Luninin klic prejme uporabnikovo vprašanje in `compactOperatingModel()` (približno 490 tokenov podpornega konteksta).
2. Luna vrne hipotezo `{ profileId, actionCode, confidence }`, že znana dejstva, 3–4 `blockCodes` in največ tri konkretne predloge z razlogom.
3. `resolveSelection()` sprejme samo bloke, dovoljene za izbrani profil in dejanje, ter lokalno razširi njihove odvisnosti.
4. `missingFacts()` iz polnih lokalnih blokov pripravi manjkajoča vprašanja in odobrene `NAZORJEVA` widgete. Ta korak ne porabi modelskih tokenov.
5. Nov modelski klic je potreben samo ob nejasnem ali prostem odgovoru oziroma ob prehodu v novo fazo. Zaključek vedno zahteva pregled in potrditev.

## Pokritost

- 43 konkretnih profilov storitev brez generičnega fallbacka.
- 16 družinskih blokov.
- 13 skupnih poslovnih blokov.
- Skupaj 72 blokov in 244 stabilnih dejstev.
- Vsak blok in vsako dejstvo imata stabilen ID, `interfaceId`, context version, podatkovni tip, odobren widget, obveznost in completion gate.
- Povezani predlogi so `suggest-only` in imajo izrecni pogoj; ne sprožijo samodejne prodaje ali spremembe.

## Pogodbeni primer

Za zahtevo »preverite pogodbo za marketing agencijo; če ne znižajo cene, odpovejte« mora načrt vključiti ponudnika, obseg in dobave, ceno, metrike uspeha, trajanje in obnovo, odpovedni rok in penale, dokazila ter pogajalsko mejo. Blok trajanja lokalno odklene blok izstopa, zato začetek, konec, obnova, odpovedni rok, način odpovedi in penali ne zahtevajo novega Luninega klica.

## Produkcijska pot

`api/_handlers/razcleni-svetovalec.js` uporablja `api/_lib/svetovalec-luna-block-router.js`. Stari veliki batch engine ostaja nedotaknjen kot varna rezerva, vendar ni več priključen na endpoint.

- Celotna modelska zahteva za regresijski marketing/pogodba primer: 8.306 bajtov oziroma približno 2.069 tokenov skupaj s structured-output shemo.
- Prejšnja zahteva: 98.272 bajtov oziroma približno 24.363 tokenov.
- Zmanjšanje: 91,5 %.
- Reasoning: `low`; največji izhod: 1.400 tokenov.
- En modelski klic na sklop; ob neveljavnem izhodu ni avtomatskega drugega plačljivega klica.
- Statični operating model je pred dinamičnim uporabniškim tekstom zaradi stabilnega prompt-cache prefixa.

## Raziskovalna podlaga

Zasnova sledi priporočilom OpenAI: tanjši prompti, nižji reasoning za latency-sensitive tokove, krajši izhodi, stabilni cache prefixi in Structured Outputs brez podvajanja sheme v navodilih. Izkušnje razvijalcev na forumih in Redditu dodatno opozarjajo, da veliki prompti, kompleksne sheme in skriti retryji množijo latenco in strošek. Zato Luna opravi samo semantično izbiro; zaprti ID-ji, odvisnosti in validacija ostanejo lokalni.

## Preverba

Zaženi:

```powershell
node scripts/test-svetovalec-service-knowledge-blocks.js
node scripts/test-svetovalec-luna-block-router.js
```

Test preveri 43/43 profilov, vse ID-je in odvisnosti, samo odobrene widgete, action gates, pogojne povezane predloge, pogodbeni regresijski primer, token budget in 10.000 lokalnih razrešitev.
