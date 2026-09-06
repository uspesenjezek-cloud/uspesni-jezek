# Prompt za Spark — dokončaj NAZORJEVA-VRSTICE-MOCKUP.html

Preveril sem tvojo datoteko `NAZORJEVA-VRSTICE-MOCKUP.html`: vseh 133 kartic (V1-V133) je prisotnih, HTML in CSS sta veljavna in popolna. Manjka pa ti natanko ena stvar — **v celi datoteki ni niti ene `<script>` značke**. Primerjal sem s tvojo prejšnjo `NAZORJEVA-PREDLOGI-MOCKUP.html`, ki ima tak blok tik pred `</body>` (okoli vrstice 2370) — v novi datoteki generiranje očitno ni prišlo do tega zadnjega koraka.

Posledica: vsi gumbi, drsniki in koraki v 133 karticah so vizualno prisotni, a popolnoma neaktivni — klik na gumb ne naredi nič, vlečenje drsnika ne posodobi prikazane številke.

Prosim, dodaj **en `<script>` blok tik pred `</body>`**, ki generično pokrije te ponavljajoče se vzorce (ne rabiš vsake od 133 kartic ročno — večina uporablja skupne razrede):

1. **Izbirni gumbi** (`.mk-vr` vsebuje več `<button>` v skupini, npr. matrika tveganja, izbira paketa) — klik doda `is-selected` na kliknjen gumb; če gre za skupino z eno izbiro, odstrani `is-selected` s sosednjih.
2. **Drsniki** (`input[type="range"]`) — `input` dogodek naj posodobi sosednje besedilo/številko, ki prikazuje trenutno vrednost (poišči najbližji element z ustreznim razredom v isti `.mk-vr` kartici).
3. **Stepperji** (gumbi `+`/`−` ob številčnem prikazu) — klik poveča/zmanjša prikazano številko.
4. **Urejanje/potrditev vzorci** (npr. V130 citat-kot-gumb, V131 kartica z gumbom '×') — klik naj vsaj vizualno preklopi stanje (npr. prikaže/skrije urejevalno polje), ni treba prave logike shranjevanja.

Ni treba edinstvene funkcionalnosti za vsako od 133 — cilj je, da noben gumb/drsnik ne ostane popolnoma mrtev. Uporabi enak generičen, po-razredu-vezan pristop kot v tvojem prejšnjem `<script>` bloku (glej referenco), le prilagojeno na razrede te datoteke (`mk-vr-*`, `is-selected`, `je-uredi`, `je-x` ...).
