# NAZORJEVA engine

- Engine: `nazorjeva-engine-v1`.
- Widget definition: `nazorjeva-widget-definition-v1`.
- Capability signature: `nazorjeva-capability-signature-v1`.
- Interface context: `atena-interface-context-v2`.
- Question binding: `nazorjeva-question-binding-v1`.
- Luna manifest: `nazorjeva-luna-manifest-v1`.

## Admission in promocija

`draft → test → iterating → ready_for_approval → approved`. Kandidat se lahko zavrne; approved widget se lahko vrne v TEST samo kot nova iteracija. Neposredni `test → approved` je blokiran. Promocijska transakcija zahteva ID kandidata, izrecno uporabniško odobritev, dokaz testov, renderer implementacijo, veljaven deep context in neboleč capability resolver. Ob neuspehu preverjanja se vsi registrski zapisi povrnejo.

## Capability collision

- `EXACT_DUPLICATE`: enak canonical capability podpis; blokirano.
- `FUNCTIONAL_OVERLAP`: isti scope in canonical oblika z vsebinskim prekrivanjem; blokirano.
- `COMPLEMENTARY_VARIANT`: dovoljeno le z dokazano novo podatkovno koristjo.
- `INCOMPATIBLE`: ni blokirne kolizije, vendar mora kandidat še vedno prestati celoten admission.

## Luna decision boundary

Luna prejme generirani manifest in sme predlagati odobreni widget samo z evidence spani. Deterministični engine preveri status, scope, canonical obliko, semantične oznake in interaction. Predlog nato potrdi, preoblikuje na varno kanonično izbiro ali zavrne z reason kodo; Luna ne spreminja poslovnega pomena, required pravil ali persistence.

## ID pokritje

- Widgeti: 62.
- Kartice: 89.
- Polja: 140.
- Kontrole: 179.
- Možnosti: 107.
- Relacije: 5.
- Skupno preverjenih globalnih ID-jev: 582; rezultat `IDS_VALID`.
