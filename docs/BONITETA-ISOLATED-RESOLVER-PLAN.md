# Izolirani resolver identitete — načrt in hipoteza

## Najmanjši odgovorni poseg

Dodamo čist, neuporabljen modul `api/_lib/boniteta-identity-resolver.js` in njegov
deterministični test. Modul ne kliče omrežja in ne spreminja handlerja, queue-ja ali
uporabniškega vmesnika. Zunanji zajem strani, OpenRegister in insolvenčni portal
dobiva prek adapterjev. Tako lahko isti vhod primerjamo z obstoječim tokom brez
ponovnega porabljanja kreditov ali spreminjanja produkcije.

## Preverljiva hipoteza

Trenutne regresije nastajajo, ker en handler hkrati odloča o transportu, iskanju
Impressuma, kandidatu, OpenRegisterju, potrditvi in terminalnem rezultatu. Če se
te odgovornosti razločijo v en skupen contract z dvema potema, bo vsak simuliran
primer vrnil pravo, ločeno stanje; tehnična napaka ne bo postala poslovni rezultat
in URL s tracking parametri ne bo ustvaril druge identitete ali opravila.

## Dve poti

1. **Registrirana družba:** kandidat iz legalne strani -> OpenRegister -> stroga
   primerjava registrske številke ali pravnega imena in kraja -> kanonična
   OpenRegister identiteta -> dovoljeno insolvenčno preverjanje.
2. **Neregistrirani podjetnik:** kandidat iz legalne strani -> strogo preverjen
   nosilec in naslov -> potrjena Impressum identiteta -> dovoljeno insolvenčno
   preverjanje.

## Testna matrika

Test pokriva: blokiran javni dostop, manjkajoči Impressum, drugo blagovno/pravno
ime, več poslovalnic, GmbH & Co. KG, star naslov, podobni družbi, več kontaktnih
oseb, tracking parametre, vse štiri OpenRegister napake, spremembo portala in
obnovitev aktivnega opravila. Pri vsakem primeru preverja pot, terminalno stanje,
dovoljenost insolvenčnega koraka in časovne meritve faz.

## Časovni cilj

10 sekund je merjeni SLO običajnega uspešnega toka, ne hard timeout. Resolver
beleži `timing.totalMs`, p50 in p95 v benchmarku. Posamezen zunanji adapter sam
poroča dejansko trajanje; resolver ga ne prekine samo zaradi doseženih 10 sekund.

## Izoliran crawler-first zbiralnik

`boniteta-impressum-collector.js` je priključena prva faza. Najprej pokliče
že obstoječi produkcijski Scrapling servis in iz njegovega dejanskega pravnega
dokumenta izlušči kandidata. Ne izvaja sedmih zaporednih legacy poti. `robots`,
omejitev zahtev, transportna napaka in manjkajoča pravna identiteta ostanejo
ločena stanja. Osemsekundni zdravstveni rok enega zbiralnika ni globalni rok
preverbe: ob njegovem izpadu handler vrne ločen transportni problem in ne zažene
še enega zaporednega legacy drevesa za isti URL.
