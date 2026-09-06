# Atenin skupni sistem kartic

## UX-pogodba

- Naravni vnos je privzeta pot. Po opisu se pokažejo največ tri relevantna področja, ne celoten katalog.
- Vsak predlog z enim tapom odpre obstoječi področni obrazec in ohrani shranjevanje, validacijo ter dogodke.
- Ročna pot ostane nespremenjena in vedno omogoča dostop do vseh storitev ter področij.
- Mobilna kartica ima najmanj 44 px visoko zadetno površino. Dve koloni sta dovoljeni samo za kratke izbire; daljše izbire uporabljajo seznam.
- Vprašanje uporablja največ dve vrstici v strnjeni kartici. Dodatna polja se pokažejo progresivno v obstoječem obrazcu.
- Možnost »Drugo« ima opisni nadaljnji vnos; shema jo označi z `hasOther` in `followUps`.
- Kartica ne uvaja novega poslovnega stanja. `eventMapping` jo poveže z obstoječim področjem, `stateMapping` pa z obstoječim osnutkom.
- Vsa besedila in ARIA-oznake ostanejo v slovenščini.

## Podatkovna pogodba

`atena-card-schema.js` normalizira 89 obstoječih modulov iz obeh obstoječih engine-ov. Vsaka kartica vsebuje tok in področje, vprašanje, tip odgovora, primarne izbire, nadaljnja polja, validacijo, postavitev, ARIA-oznako ter preslikavo na obstoječi handler in osnutek.

`atena-widget-contract.js` je strojna meja za vse trenutno odobrene widgete. Vsak widget določa raven (`field`, `module`, `review` ali `workflow`), canonical podatkovno obliko, dovoljene interaction variante, validacijo, native temo in responsive omejitve. Model sme predlagati, contract pa mora predlog potrditi ali zavrniti. Človeško berljiv vir je `docs/NAZORJEVA-WIDGET-GUIDE.md`, celotna presoja 137 polj pa `docs/ATENA-QUESTION-WIDGET-MATRIX.md`.

Vsak widget, vsaka kartica in vsaka vnosna vrstica ima tudi trajni hierarhični `interfaceId`. Celotni strojno generirani kontekst 89 kartic in 137 vrstic je v `docs/ATENA-INTERFACE-CONTEXTS.md`; isti ID in različica contracta se izrišeta v produkcijskem DOM-u, zato lahko prihodnji engine, testi in agenti zanesljivo povežejo prikaz s pomenom, validacijo ter shranjevanjem.

Prva navpična pot je skupna za vseh pet storitev: naravni opis → lokalno deterministično prepoznavanje namena → največ tri predlagana področja → obstoječi področni obrazec. »Preverite ponudbo« in »Preverite naročnino« sta vključena brez podvajanja pravil. Celotna vizualna migracija 89 podrobnih obrazcev ostaja postopna.

## Meje mobilnega prikaza

Izhodiščna meritev pri 390 × 844 je pokazala skoraj celozaslonski modal (približno 797 px višine). Predlogi zato ostanejo zunaj modala, največ tri. Obstoječi modal ostane prostor za progresivna podvprašanja.
