# Bonitetna preverba – nova ježka na karticah

Kartici »Mehka preverba« in »Podrobna preverba« dobita nova 3D ježka (prozorno ozadje, obrezano, 640 px, WebP):

| Kartica | Nova slika |
|---|---|
| Mehka preverba (Brezplačno) | `app/assets/jezomir-mehka-preverba-lupa-3d.webp` – ježek z lupo in listom |
| Podrobna preverba (20 €) | `app/assets/jezomir-podrobna-preverba-mikroskop-3d.webp` – ježek z mikroskopom |

Vgradnja v lokalni `app/bonitetna-preverba.html` (vijolična različica, ki je ni na GitHubu):
1. v obeh karticah zamenjaj `src` obstoječe slike ježka z zgornjima potema; velikost in položaj slike ostaneta kot zdaj;
2. dvigni `?v=` pri spremenjenem HTML/CSS;
3. preveri 390 px in 320 px: ježek ne sme prekrivati opisa (»Identiteta …«, »Razširjeni podatki …«) – nova ježka sta širša od starih, zato je slika največ ~92 px široka ob 390 px.

Predogled: `marketing-predlog/boniteta-novi-jezki.png`.
