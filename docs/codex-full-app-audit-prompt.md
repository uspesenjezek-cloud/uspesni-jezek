Izvedi izjemno poglobljen, dokazljiv in read-only audit celotne aplikacije Uspešni Ježek.

Aplikacija je namenjena nemškim obrtnikom in pokriva podjetja, stranke, račune, plačila, opomine, izterjavo, zgodovino dolga, komunikacijo, glasovni vnos, AI obdelavo dogodkov, dokumente, DATEV/POS ter povezane poslovne procese.

GLAVNO PRAVILO

Ne implementiraj popravkov. Ne spreminjaj datotek, ne formatiraj kode, ne nameščaj paketov, ne commitaj, ne pushaj in ne deployaj. Ne uporabljaj destruktivnih Git ukazov.

Ne beri ali prikazuj skrivnosti, .env datotek, žetonov, gesel, osebnih podatkov ali zasebnih ključev. Če zaznaš možno skrivnost, navedi samo pot in vrsto tveganja, ne njene vrednosti.

Analiziraj dejansko trenutno kodo. Vsako tehnično ugotovitev podpri s konkretno potjo datoteke, funkcijo, selektorjem ali kratkim opisom dokaza. Če nečesa ni mogoče dokazati, ga označi kot hipotezo in napiši, kako bi ga preverili.

Ne podvajaj že opravljenega podrobnega POS audita. POS omeni samo tam, kjer vpliva na skupno arhitekturo, podatke ali varnost.

1. ARHITEKTURA IN MEJE SISTEMA

Preglej:

- strukturo repozitorija;
- glavne aplikacijske module;
- frontend, backend, API in podatkovno plast;
- avtentikacijo in avtorizacijo;
- zunanje ponudnike;
- AI in govorne storitve;
- dokumente, plačila, e-pošto in obvestila;
- lokalno stanje, predpomnilnike in sinhronizacijo;
- produkcijsko konfiguracijo brez branja skrivnosti;
- podvajanje logike in premočno povezane module;
- globalna stanja in implicitne stranske učinke;
- kritične single points of failure.

Izdelaj diagram sistema in jasno opiši meje zaupanja.

2. CELOTEN PODATKOVNI TOK

Sledi podatkom skozi resnične uporabniške procese:

- ustvarjanje in urejanje podjetja;
- ustvarjanje računa;
- sprememba stanja dolga;
- delno plačilo;
- obroki;
- obljuba plačila;
- plačano v celoti;
- neplačan obrok;
- neuspešno plačilo;
- preklic ali prestavitev opomina;
- dobropis in storno;
- predaja odvetniku ali izterjavi;
- dokumenti in priloge;
- brisanje, arhiviranje in obnovitev podatkov.

Za vsak tok dokumentiraj:

- vhod;
- validacijo;
- transformacije;
- shranjevanje;
- identifikatorje;
- časovne žige;
- dovoljenja;
- stranske učinke;
- uporabniški rezultat;
- obnašanje ob napaki;
- možnost podvojitve;
- revizijsko sled.

Posebej išči izgubo podatkov, stale state, race condition, dvojno izvedbo in nedeterministične rezultate.

3. STATE MACHINE POSLOVNIH PROCESOV

Iz dejanske kode rekonstruiraj kanonična stanja in prehode za:

- račun;
- dolg;
- opomin;
- načrt opominjanja;
- dogodek plačila;
- delno plačilo;
- obroke;
- obljubo plačila;
- preklic opomina;
- pravno predajo;
- dokument;
- sporočilo;
- uporabniško sejo.

Pripravi tabelo:

- trenutno stanje;
- dejanje;
- zahtevani pogoji;
- novo stanje;
- stranski učinki;
- možnost razveljavitve;
- obnašanje ob ponovitvi;
- nedovoljeni prehodi.

Označi prehode, ki jih koda dopušča, vendar poslovno nimajo smisla.

4. VARNOSTNI AUDIT

Preveri najmanj:

- avtentikacijo;
- avtorizacijo na ravni zapisa;
- ločevanje tenantov;
- neposreden dostop do tujih ID-jev;
- Supabase RLS, če se uporablja;
- XSS;
- CSRF;
- injection;
- nevarno sestavljanje HTML;
- open redirect;
- upload datotek;
- MIME in velikost datotek;
- podatke v URL-jih;
- localStorage/sessionStorage;
- občutljive podatke v logih;
- API rate limiting;
- replay napade;
- webhook podpise;
- idempotentnost;
- obnovitev gesla;
- upravljanje sej;
- role escalation;
- brisanje in izvoz osebnih podatkov;
- AI prompt injection iz dokumentov, glasovnega vnosa ali uporabniških podatkov.

Za vsako ugotovitev navedi:

- resnost;
- verjetnost;
- vpliv;
- napadalni scenarij;
- dokaz v kodi;
- priporočeno rešitev;
- test, ki potrdi rešitev.

Ne izvajaj napadov na produkcijo.

5. GLASOVNI IN AI ENGINE

Ta del naj bo posebej poglobljen, ker je glasovni vnos kritičen.

Analiziraj:

- začetek in konec snemanja;
- nepričakovano prenehanje poslušanja;
- stanje, ko gumb kaže snemanje, engine pa več ne posluša;
- silence timeout;
- VAD;
- samodejni restart;
- izgubo povezave;
- browser permission;
- prehod aplikacije v background;
- zaklep zaslona;
- audio focus;
- izbiro mikrofona;
- sample rate;
- prekinjene ali podvojene transkripte;
- partial in final rezultate;
- pozne dogodke po prekinitvi;
- race condition pri stop/start;
- ponavljajoče znake, na primer "555555...";
- napačen jezik ali model;
- fallback engine;
- nemško in slovensko prepoznavanje;
- ločila, številke, valute in datume;
- čiščenje transkripta;
- pretvorbo transkripta v strukturirane dogodke;
- zaščito pred napačnimi dejanji AI;
- stanje UI med poslušanjem, obdelavo in napako;
- telemetry brez shranjevanja občutljivega zvoka.

Primerjaj zasnovo z načeli zanesljivega dictation produkta, kot je Handy, vendar ne ugibaj njegove zasebne implementacije.

Pripravi ločen state machine za snemanje in transkripcijo ter najmanj 30 robnih primerov.

6. UX IN VIZUALNA KONSISTENTNOST

Preglej dejanske zaslone in komponente:

- mobilne širine 320, 360, 390 in 430 px;
- tablet;
- desktop;
- dolga nemška besedila;
- velike zneske;
- različne valute;
- povečano pisavo;
- tipkovnico na telefonu;
- safe areas in notch;
- landscape;
- scroll;
- modalna okna;
- back button;
- reset;
- loading;
- empty;
- error;
- disabled;
- selected;
- success;
- unknown state.

Posebej preveri:

- Atena engine;
- Hitra dejanja;
- Bo plačal;
- Ne bo plačal;
- Prekliči opomin;
- stanje dolga;
- originalni in preostali znesek;
- kartice dogodkov;
- podjetja in kategorije;
- dokumente;
- DATEV;
- POS;
- navigacijo;
- vse X gumbe za zapiranje.

Poišči:

- odrezano besedilo;
- clipping;
- horizontalni overflow;
- prekrivanje;
- premajhne touch tarče;
- nejasno aktivno stanje;
- podvojene možnosti;
- nelogično hierarhijo;
- napačno zaporedje;
- nedosledne ikone;
- neustrezen kontrast;
- elemente, ki so videti aktivni, vendar niso;
- dejanja brez jasne posledice.

7. DOSTOPNOST

Preveri:

- semantični HTML;
- vrstni red fokusa;
- vidni focus;
- keyboard navigation;
- screen reader imena;
- aria-expanded;
- aria-selected ali aria-pressed;
- dialog semantiko;
- focus trap;
- obnovitev fokusa po zaprtju;
- escape;
- kontrast;
- reduced motion;
- statusna sporočila;
- napake obrazcev;
- velikost tarč;
- zoom do 200 %;
- razlikovanje stanj brez odvisnosti samo od barve.

Rezultate razvrsti glede na WCAG 2.2 AA.

8. ZMOGLJIVOST IN ODPORNOST

Analiziraj:

- začetno nalaganje;
- velikost JS in CSS;
- podvajanje assetov;
- cache;
- lazy loading;
- dolge sezname;
- slike;
- dokumente;
- event listenerje;
- memory leak;
- re-renderje;
- debouncing;
- počasno omrežje;
- offline stanje;
- retry;
- timeout;
- cancelation;
- delo v backgroundu;
- obnovitev po crashu;
- mobilne naprave z malo pomnilnika;
- slabe povezave;
- ponavljajoče API zahteve;
- drage poizvedbe;
- N+1;
- manjkajočo paginacijo.

Ne izvajaj nevarnih obremenitvenih testov proti produkciji.

9. TESTNA POKRITOST

Naredi inventar obstoječih testov in ugotovi:

- katere kritične poti nimajo testov;
- kateri testi preverjajo samo strukturo, ne pa vedenja;
- kateri vizualni problemi bi šli skozi teste;
- kateri testi so krhki;
- kateri testi ne preverjajo podatkovne integritete;
- kateri race conditions niso simulirani;
- kateri produkcijski incidenti niso pokriti.

Predlagaj piramido testov:

- unit;
- state-machine;
- integration;
- contract;
- database/RLS;
- browser E2E;
- accessibility;
- visual regression;
- offline;
- concurrency;
- chaos;
- production smoke.

Za P0 in P1 ugotovitve napiši konkretne testne scenarije Given/When/Then.

10. NEMŠKI PRODUKTNI IN COMPLIANCE KONTEKST

Preglej področja:

- GDPR;
- hrambo in izbris podatkov;
- pravico do izvoza;
- GoBD;
- račune;
- opomine;
- davčne dokumente;
- DATEV;
- komunikacijo z dolžnikom;
- dokazljivost zgodovine;
- privolitve;
- avtomatizirane AI odločitve;
- KassenSichV/TSE, kjer je relevantno.

Za časovno občutljive trditve uporabi samo aktualne uradne ali primarne vire in dodaj povezave. Jasno označi, kaj zahteva presojo nemškega pravnega ali davčnega strokovnjaka.

11. OPERATIVNA PRIPRAVLJENOST

Preveri:

- error handling;
- strukturirane loge;
- correlation ID;
- audit dogodke;
- metrike;
- alarme;
- Sentry ali ekvivalent;
- anonimizacijo;
- health checks;
- backup;
- restore;
- migracije;
- rollback;
- feature flags;
- varni deploy;
- smoke test;
- incident response;
- možnost podpore uporabniku brez dostopa do njegovih občutljivih podatkov.

12. KONČNI REZULTAT

Pripravi en celovit dokument v slovenščini z naslednjo strukturo:

A. Izvršni povzetek
B. Zemljevid sistema in modulov
C. Zemljevid ključnih uporabniških tokov
D. Rekonstruirani state machines
E. Podatkovna integriteta in race conditions
F. Varnostni audit in threat model
G. Glasovni ter AI audit
H. UX in vizualna konsistentnost
I. Dostopnost
J. Zmogljivost in odpornost
K. Testna vrzel
L. Nemški compliance
M. Operativna pripravljenost
N. Prioritetni register ugotovitev
O. Načrt varne izvedbe

Za vsako ugotovitev uporabi tabelo:

- ID;
- področje;
- naslov;
- resnost P0/P1/P2/P3;
- uporabniški vpliv;
- poslovni vpliv;
- dokaz;
- datoteka/funkcija;
- scenarij reprodukcije;
- predlagana rešitev;
- test sprejema;
- tveganje spremembe;
- odvisnosti.

Dodaj najmanj:

- 15 najpomembnejših ugotovitev;
- 40 robnih primerov za celotno aplikacijo;
- 30 robnih primerov samo za voice/AI;
- 20 varnostnih scenarijev;
- 20 scenarijev podatkovne integritete;
- 20 UX/accessibility scenarijev;
- prioritetni načrt za 30, 60 in 90 dni.

Na koncu pripravi:

1. seznam P0 težav, ki lahko povzročijo izgubo denarja, podatkov ali zaupanja;
2. seznam P1 težav, ki pomembno škodujejo uporabniškemu procesu;
3. hitre izboljšave z velikim učinkom;
4. spremembe, ki zahtevajo arhitekturno odločitev;
5. področja, kjer dokazov ni dovolj;
6. natančen seznam naslednjih read-only preverjanj;
7. ločen, kopirljiv IMPLEMENTATION BRIEF za Codex, vendar brez samodejne izvedbe.

Bodi kritičen. Ne olepšuj rezultatov in ne izmišljaj težav samo zato, da bi zapolnil seznam. Kakovost dokazov je pomembnejša od števila ugotovitev.
