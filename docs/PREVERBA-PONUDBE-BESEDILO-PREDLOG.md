# Predlog poenostavitve besedila — "Preverite ponudbo" (60 polj, app/ponudba-moduli-engine.js)

Status: PREDLOG, še ni uveljavljeno v kodi. Ne spreminja field ID-jev, tipov ali logike — samo besedilo oznak (label) in pomoči (help).

Pregledal sem vseh 60 polj. **~50 od 60 je že dovolj preprostih** (npr. "Kaj točno kupujete", "Kaj je vključeno", "Predplačilo") — teh nisem spreminjal. Spodaj je samo tistih ~10, kjer je besedilo pravniško/administrativno in bi ga obrtnik verjetno sam povedal drugače. Kjer polje obstaja zaradi čezmejnega posla (SI+DE), sem to označil — vsebine nisem odstranil, samo poenostavil izraz.

| ID | Trenutna oznaka | Predlagana oznaka | Zakaj |
|---|---|---|---|
| 5001 | Vloga ponudnika | Kdo vam je poslal ponudbo? | "Vloga" je abstrakten pojem; select opcije (izvajalec/proizvajalec/prodajalec/posrednik) ostanejo enake |
| 5003 | Kaj najbolje opiše osnovni odnos | Za kakšen posel gre? | "Osnovni odnos" je birokratsko |
| 5107 | Podražitve in indeksacija | Ali se cena lahko podraži? | "Indeksacija" je finančni strokovni izraz |
| 5405 | Enostranske spremembe pogojev | Lahko ponudnik sam spremeni pogoje? | "Enostranske" je pravni izraz — help besedilo je že plain, samo label ne |
| 5406 | Omejitev odgovornosti | Koliko največ plača, če gre kaj narobe? | Klasičen pravni izraz ("liability limitation") |
| 5407 | Pravo in pristojno sodišče | Katero pravo in katero sodišče velja ob sporu? | Ohranjeno zaradi SI+DE čezmejnih pogodb — samo bolj razložen zapis |
| 5505 | Odzivni in odpravljalni čas | Kako hitro pridejo in kako hitro odpravijo napako? | "Odpravljalni" ni standardna beseda |
| 5601 | Pravna oseba in podpisnik | Kdo točno je vaš pogodbeni partner (ime podjetja)? | "Pravna oseba" je pravni izraz |
| 5605 | Zavarovanje odgovornosti | Ali ima ponudnik zavarovanje za škodo? | Zavarovalniški izraz |
| 5606 | Ključne odvisnosti in predpogoji | Od česa je odvisno, da se delo sploh začne? | Birokratsko |

## Kaj NISEM spremenil (namerno)
- "Zamudne obresti", "DDV", "vezava", "garancija", "podizvajalci" — to so besede, ki jih obrtniki v SI/DE vsakdanje uporabljajo (iz računov, mobilnih pogodb ipd.), niso žargon.
- Nobenega polja nisem izbrisal ali predlagal za izbris — to čaka na tvojo potrditev v naslednjem koraku (glej spodaj).

## Odprto — nisem se še lotil
- Ali je katero od 60 polj **odveč/podvojeno** (ne samo napačno formulirano) — to zahteva presojo, katera polja so za obrtnika resnično potrebna glede na 4 storitve, ki jih dejansko ponujamo (narocnina/pogajanje/ponudbe/klic že pregledano, tam so vprašanja večinoma plain).
- Preostale 4 kategorije (Preverite naročnino, Pogajajte se, Uredite mi ponudbe, Vas kliče prodajalec) — te so že pregledane in tam nisem našel podobno formalnih izrazov, a nisem naredil enako podrobne field-by-field tabele kot tukaj.

## Naslednji korak (čaka potrditev)
1. Če se strinjaš s tabelo zgoraj, uveljavim spremembe v `app/ponudba-moduli-engine.js` (samo besedilo, brez tveganja za logiko) in preverim na localhost:8001.
2. Nato lahko presodim, katera polja so odveč (večji poseg, potrebuje tvojo odobritev za vsako).
