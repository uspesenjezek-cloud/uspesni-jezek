Uspesni Jezek

## Scrapling fallback za nemški Impressum

Aplikacija lahko pri javnih nemških pravnih straneh uporabi ločeno Scrapling storitev, kadar običajen HTTP-zajem ne vrne uporabne vsebine. Storitev je samo transportni fallback: končno identiteto še vedno potrdita kanonični Impressum parser in obstoječa pravila za pravni kontekst, ime ter naslov.

Nastavite `SCRAPLING_IMPRESSUM_URL` na HTTPS naslov storitve in `SCRAPLING_IMPRESSUM_TOKEN` na isti naključni žeton z najmanj 32 znaki. Za lokalni razvoj je dovoljen `http://127.0.0.1:8766`. Navodila za zagon in varnostne omejitve so v `services/scrapling-impressum/README.md`.

## North Data prek Apify

Obogatitev osnovne bonitetne preverbe uporablja samo strežniško skrivnost
`APIFY_API_TOKEN`. Ključ naj bo nastavljen v Vercelu za Production in Preview,
za lokalni razvoj pa samo v prezrti datoteki `.env.local`. Nikoli ga ne dodajaj
v odjemalske datoteke ali v Git.

Če ključ ni nastavljen, preverjanje varno nadaljuje brez North Data podatkov in
ne izvede plačljivega Apify klica.
