# Trajna pravila projekta Uspešni Ježek

## Obvezno samodejno prilagajanje besedila

- Vsak omejen UI-element z besedilom ali številko mora ohraniti svojo dogovorjeno širino in višino.
- Če je vnesena ali prikazana vrednost predolga, se mora velikost pisave samodejno in sproti zmanjšati, dokler celotna vrednost ne paše v polje.
- To velja povsod: imena, priimki, podjetja, kontaktni podatki, zneski, številke računov, datumi, časi, naslovi kartic, gumbi, izbirna polja in vse prihodnje komponente.
- Pri vnosnih poljih mora prilagajanje delovati v živo ob vsaki vneseni črki ali številki, ne šele po shranjevanju ali osvežitvi.
- Preračun mora delovati tudi po programskem ali AI-izpolnjevanju, obnovi shranjenih podatkov, nalaganju pisav, spremembi širine zaslona in spremembi vsebine.
- Obstoječi CSS, tudi pravila z `!important`, ne sme preglasiti samodejno izračunane velikosti pisave.
- Besedilo se ne sme prekrivati, rezati, lomiti sredi vrednosti, širiti okvirja ali premikati sosednjih elementov.
- Ob vsakem posegu v omejeno polje preveri kratko in namerno dolgo realistično vrednost na telefonu in računalniku ter dodaj ali posodobi regresijski test.

To je privzeto pravilo za vse prihodnje UI-spremembe in ga ni treba znova potrjevati z uporabnikom.

## Obvezno odpravljanje celotne družine napak

- Prikazani simptom ni dovolj: pri vsaki napaki najprej določi temeljni vzrok in vse poti, po katerih lahko ista vrsta napačnega podatka ali stanja pride do rezultata.
- Popravek mora biti postavljen na vseh potrebnih mejah: ob zajemu/razčlenitvi, ob uporabnikovi potrditvi ali obnovi, pred zunanjo poizvedbo oziroma zapisom ter ob prikazu rezultata.
- Vedno preveri sorodne primere, ne samo prijavljene domene ali konkretne vrednosti. Prepovedani so popravki, vezani na eno podjetje, URL, ime ali posnetek.
- Obvezno preveri: predpomnilnik in njegovo različico, čakalno vrsto, ponovitve in časovne omejitve, delne rezultate, staro stanje strežnika, ponovno odprtje strani ter razliko med lokalnim in produkcijskim tokom.
- Napaka zunanjega vira mora biti ločena od napake naše aplikacije. Uspeh pomeni, da je zunanji obrazec poizvedbo dejansko sprejel in vrnil prepoznaven rezultat; prikazan ali posnet obrazec sam po sebi ni uspeh.
- Za vsak temeljni vzrok dodaj regresijski test prvotnega primera in najmanj en soroden/splošen primer. Nato izvedi celoten testni sklop prizadetega modula in, kadar je varno, dejanski end-to-end preizkus z javnim virom.
- Naloge ne označi kot končane, če je popravljen samo UI, mockup ali ena funkcija, medtem ko lahko produkcijska pot še uporablja staro kodo, star predpomnilnik ali drug vhod.
- Pri delu na Bonitetnem centru je obvezno prebrati in upoštevati `docs/BONITETA-REGRESSION-GUARDRAILS.md`.

To je trajno navodilo projekta za vse prihodnje odpravljanje napak in ga ni treba znova potrjevati z uporabnikom.
