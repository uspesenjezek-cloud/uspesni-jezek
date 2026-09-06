# Atena/Luna: kanonični DE/SI vprašalni graf

Status: arhitekturna odločitev, 2026-09-02.

## Meja odgovornosti

Luna razume prvi prosti opis in vrne samo registrirane `actionCode`, `profileId` in največ štiri `blockCodes`. Ne piše vprašanj, odgovorov, widgetov, validacij ali pravnih posledic. Lokalni engine razširi odvisnosti, uporabi skupni DE/SI tržni katalog, materializira kartice in deterministično izvede posledice.

Prvi modelski klic ima največ 2.000 ocenjenih vhodnih tokenov. Po prvi potrjeni hipotezi se `actionCode` in `profileId` shranita v sejo. Naslednji štirje sklopi se materializirajo lokalno, brez omrežja in brez novih AI-tokenov. Nov modelski klic je dovoljen le pri novi zahtevi, nejasnem prostem odgovoru, spremembi teme ali protislovju, ki ga lokalni graf ne zna razrešiti.

## Kanonični contract

```text
Question {
  id, factId, revision, labels, purpose,
  answer: {
    kind: choice|multiple|text|money|quantity|date|range,
    widgetId, options[], spec
  },
  required, allowOwn, consequences[], persistenceKey
}

Consequence {
  id,
  when: { questionId, operator: equals|in|includes|exists, value|optionIds },
  effects: [{ type: show|require|enqueue|requestEvidence|warn|recommend|compute|blockCompletion, targetId }],
  cleanupTargets[]
}

AnswerEnvelope {
  value,
  certainty: confirmed|estimated|unknown,
  source: user|document|register|calculation,
  capturedAt
}
```

Vsi ID-ji so stabilni. `factId` je edini persistence ključ. `other` je zaprta izbira, ki razkrije obvezni `otherText`; prosti tekst za typed money/date/range ni dovoljen. `unknown` je prava vrednost, vendar ne dokazuje skladnosti in ne zaključi kritičnega gatea.

## Evaluator

Evaluator brez `eval`:

1. normalizira in validira odgovor glede na `answer.kind`;
2. primerja semantično vrednost brez `updatedAt`;
3. izračuna aktivno closure posledic;
4. ob deaktivaciji veje odstrani njene potomce in izpeljane izračune;
5. validira samo aktivna obvezna polja;
6. ohrani prejšnje kartice v zgodovini, vendar jasno označi aktivno;
7. vrne stabilen vrstni red po fazi, prioriteti, pack ID-ju in question ID-ju.

## Widget semantika

| Pomen | Widget | Pravilo |
|---|---|---|
| da/ne/ne vem s posledico | `da-ne-ne-vem` | `Da` odpre datum/podrobnost/dokazilo; sprememba počisti potomce |
| točen denar | `natancen-znesek` | EUR, DDV in obdobje; 0 ni prazno |
| približen omejen denar | `drsnik-razpona` | konfigurirani min/max/step/suffix, numeric alternativa in `ne vem`; brez implicitnega defaulta |
| min/max denar | `dvojni-razpon` | min <= max; brez samodejne sredine |
| datum | `datum-z-gotovostjo` | ISO datum oziroma jasno `unknown` |
| več možnosti | `izbirnik-oznak` / `hierarhicni-izbor` | eksplicitna potrditev; `none` je ekskluziven |
| lastni odgovor | `besedilni-vnos` | isti canonical fact oziroma omejena ponovna semantična razčlenitev |
| dolg šifrant | `iskalni-izbirnik` | vedno ima vidno potrditveno akcijo |

## Pokritost trga

Kanonični profilni katalog vsebuje natanko 43 profilov in najmanj en realni `solutionType` na profil. Jedro je skupno, DE in SI dodajata samo tržne ali regulativne razlike. Državo določa kraj izvedbe, ne jezik vmesnika.

Začetni lokalni sklop je implementiran za vseh 43 profilov. Profil 1022 uporablja namenski marketinški sklop; preostalih 42 profilov dobi štiri stabilne kartice: konkretno vrsto rešitve iz tržnega kataloga, način obračuna, fazo odnosa in štiri družinsko specifična merila. To predstavlja 168 profilnih vprašanj oziroma fact ključev, označenih za trga `DE` in `SI`. Naslednji sklop nato izbere Luna samo z registriranimi block ID-ji; besedilo in widget ostaneta lokalna.

Marketing (1022) se začne s poslovnim ciljem in 15 kanoničnimi rešitvami: search, social, content, display, marketplaces, fizično/tisk, telefon, lokalno/OOH, sejmi/dogodki, radio/TV/video, partnerstva, PR, terenska prodaja, promocijski izdelki in retention/CRM. Drugi lokalni sklop preveri občinstvo, trge DE/SI, dostop do meritev ter lastništvo računov, podatkov in vsebin. Tretji sklop se lokalno prilagodi izbranemu kanalu v eno od petih izvedbenih družin in preveri dejanske predaje, metrike, neposreden dostop ter trg/jezik. Četrti sklop je vezan na izbrano dejanje (ponudba, naročnina, pogajanje, primerjava ali klic).

Za drugih 42 profilov je zaporedje: profilni vstop → družinske zahteve → akcijski sklop → dokazila in tveganja. Pri pogajanju se drugi sklop zamenja s pogodbenimi roki, nato sledita družinski in pogajalski sklop. Po četrtem sklopu lokalni engine vrne stanje `review` in gumb za predogled.

## Invariante in testi

- 43 aktivnih profilov, 16 družin in najmanj en solution type na profil.
- Globalno unikatni ID-ji, veljavni sklici in DAG brez ciklov.
- Vsak widget je odobren in združljiv s canonical tipom.
- Vsak renderer ima izvedljivo potrditveno akcijo.
- Ista vrednost ne izbriše naslednjih sklopov; druga vrednost jih pravilno razveljavi.
- Poškodovan `ready` restore se vrne v nepopolno stanje, nikoli v `TypeError`.
- Exact regresija: pogodba `Da` -> datum in odpovedni rok sta vidna, za nadaljevanje zadošča vsaj eden; `Da -> Ne/Ne vem` skrije in izbriše neveljavne potomce, `Ne vem` pa odpre dokazilo.
- Property matrika preveri vse možnosti, `other`, `unknown`, exclusive `none`, tipe, persistence in cleanup.
- Benchmark poroča p50/p95/max; compact indeks ostane pod 2.000 ocenjenimi tokeni.
- E2E uporablja mockan Lunin izbor; brez plačljivega live klica.
- Celotna lokalna lifecycle matrika pokriva 245 rešitev × 5 dejanj = 1.225 tokov na trgih DE in SI. Preverja štiri sklope, predogled, stabilne fact ključe in nič plačljivih nadaljevalnih klicev.

## Viri

Raziskava uporablja WZ 2025 (Destatis), SKD 2025 (SURS), nemški UWG §7/§7a in Bundesnetzagentur, slovenski ZEKom-2 §226 ter IP-RS, AKOS, SPOT, AJPES, Banko Slovenije, Agencijo za energijo, Borzen, AZN, OZS/GZS in Slovensko akreditacijo. Oblikovni vzorec sledi JSON Schema conditional modelu ter GOV.UK conditional reveal/question-page smernicam. Pravna pravila morajo imeti uradni vir; panožni vir sam ne dokazuje obveznosti.
