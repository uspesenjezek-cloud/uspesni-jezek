Uspesni Jezek

## North Data prek Apify

Obogatitev osnovne bonitetne preverbe uporablja samo strežniško skrivnost
`APIFY_API_TOKEN`. Ključ naj bo nastavljen v Vercelu za Production in Preview,
za lokalni razvoj pa samo v prezrti datoteki `.env.local`. Nikoli ga ne dodajaj
v odjemalske datoteke ali v Git.

Če ključ ni nastavljen, preverjanje varno nadaljuje brez North Data podatkov in
ne izvede plačljivega Apify klica.
