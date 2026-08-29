# Trenutno potrjene mobilne mere Bonitetnega centra

Referenca iz `CLAUDE.md` razdelka o zaklenjenih meram. Preberi to datoteko samo, kadar dejansko delaš na Bonitetnem centru (`app/bonitetna-preverba.*`, `app/boniteta-*`).

Pri širini do `620px` so naslednje mere trenutna osnova, ne predlog za samovoljno spreminjanje:

- zeleni hero: najmanj `160px`, notranji odmik `12px 20px 26px`, spodnji desni radij `40px`;
- naslovna vrstica: razmik `12px`; začasni gumb nazaj `30 × 30px`;
- glavni vnos: višina `46px`; potrditveni krog `58 × 58px`;
- kartica treh načinov vnosa: overlap `-22px`, stranski odmik `10px`, radij `22px`;
- trije vnosni elementi: najmanj `98px`, radij `14px`, medsebojni razmik `7px`;
- izbira vrste preverbe: dva enako široka stolpca; vsak najmanj `204px`;
- gumb `Začni preverbo`: najmanj `46px`, isti mehak teal gradient kot potrjeni CTA;
- spodnja navigacija: posamezen element najmanj `66px`, fiksna `8px + safe-area` od dna;
- vsebina rezervira `128px + safe-area` pod spodnjo navigacijo.

Če uporabnik zahteva spremembo ene mere, spremeni samo prizadeti sloj. Ne preoblikuj preostalih kartic in ne vračaj že zavrnjenih proporcev.
