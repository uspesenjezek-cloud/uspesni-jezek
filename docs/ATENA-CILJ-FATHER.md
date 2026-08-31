# Atena: ciljni FATHER (korak 3)

Korak 3 odgovarja izključno na vprašanje »Kaj želite doseči s tem dolgom?«. Ne uporablja zgodovinskih dogodkov iz koraka 2 in ne knjiži plačila ali poravnave. Uporabnik izbere en glavni cilj; omejitve, podrobnosti in izvedbeni načrt pridejo v naslednjih fazah.

Kanonični katalog ciljnih kartic:

1. `full_payment` — Celotno plačilo
2. `partial_payment_now` — Delno plačilo čim prej
3. `installment_plan` — Plačilo v obrokih
4. `new_deadline` — Plačilo do novega roka
5. `amicable_settlement` — Sporazumna poravnava
6. `dispute_resolution` — Rešitev ugovora
7. `compensation` — Kompenzacija / pobot
8. `payment_security` — Zavarovanje plačila
9. `legal_recovery` — Pravna izterjava
10. `insolvency_claim` — Insolvenčni postopek
11. `close_without_recovery` — Zaključek brez izterjave
12. `custom_goal` — Drug cilj

## Kategorija kartic 2.0

Skupni podatkovni vir je isti kot za obstoječih 61 kartic: `app/atena-card-templates.js`. V njem zbirka `categories["2.0"]` vsebuje 12 glavnih ciljnih FATHER kartic in 6 ločenih pravnih rezultatov. Vsak zapis ohrani produkcijski ID ter z `templateId` kaže na eno od obstoječih kanoničnih interakcijskih zasnov. Ločena FATHER katalogna datoteka ne obstaja več.

Produkcijski korak `neplacila-cilj.html` naloži isti katalog pred `neplacila-cilj.js`; naslovi, ikone, barvni toni, ročna vidnost, obvezna polja in dovoljena pravna usmerjevalna polja tako prihajajo iz istega vira kot katalogski inventar in regresijski testi.

### Pravna izterjava

Kartica `legal_recovery` ne izbira odvetnika in ne podvaja končne predaje. Odpre izbiro želenega pravnega rezultata:

- plačilo po pravnem opominu,
- izvršba,
- plačilni nalog ali tožba,
- začasna sodna zaščita,
- čezmejna izterjava,
- pravna ocena najboljše poti.

Odvetnik, paket, dokumenti in sama predaja ostanejo del poznejšega izvedbenega koraka. Zato ciljna faza ne sprašuje po znesku, roku, načinu vročitve, dokazih, izvršilni podlagi, naslovu dolžnika, proračunu ali podrobnem opisu nevarnosti. Te operativne podatke zbere namenski vprašalnik v koraku »Odvetnik«, ko je iz želenega rezultata že znano, katera vprašanja so relevantna.

Prve tri pravne kartice po izbiri ne zahtevajo dodatnega vnosa. Začasna zaščita lahko neobvezno hrani le splošni predmet zaščite, čezmejna izterjava le državo, pravna ocena poti pa le uporabnikovo prednostno merilo. Cilj se v povzetek doda po potrditvi; v `settings.legalRecoveryData` se shranijo samo ta dovoljena usmerjevalna polja, tudi če seja ali Luna vsebuje stare podrobne podatke.

Enak FATHER velja za vseh 12 glavnih ciljnih kartic: klik kartico samo odpre in označi, pod karticami se prikaže njen namenski vnosnik, šele »+ Dodaj korak« doda nov korak v povzetek. Uporabnik lahko doda več korakov; novi vnos ne prepiše prejšnjih, odstranitev pa odstrani samo izbrani korak. Strukturirani odgovori glavnega cilja se shranijo v `settings.goalData`.

`unpaid_installment` in `payment_failed` sta zgodovinska dogodka, zato nista dovoljena cilja. Trenutna faza uvaja FATHER kartice in enojno ročno izbiro; Luna-first razumevanje naravnega ciljnega vnosa ter generiranje načrta sta ločeni naslednji fazi.
# Naravni Atena/Luna vnos

Korak »Cilj« uporablja `goal-fact-v17`, skupno `atena-luna-policy` in model `gpt-5.6-luna`. Pred vsako izbiro Luna prejme popoln opis vseh kartic: numerični `cardId`, namen, `useWhen`, `doNotUseWhen`, primere, polja z numeričnimi ID-ji in dovoljene vrednosti. Za pravno izterjavo prejme še popoln opis vseh šestih pravnih rezultatov z njihovim `valueId`, namenom, mejami in primeri. Skupna metoda `luna-compositional-reasoning-v1` zahteva, da Luna najprej prebere celoten vir, razdeli vse samostojne pomene ter ohrani njihove povezave, med drugim zaporedje, pogoj, rezervno vejo, alternativo, izjemo, zanikanje, čas, ponovitve in lastništvo. Nato s pregledom klavzule za klavzulo preveri, da ni izpuščen noben materialen del. Skupna meja `luna-semantic-authority-v3` določa, da Luna sama izbere in razvrsti vse kartice, jim pripiše dejstva in izpolni polja; lokalni adapter po odgovoru ne bere več surove povedi, ne zamenja kartice in ne prestavlja podatkov. Dovoljeno mu je le strogo preverjanje zaprte sheme, preslikava ID-jev, računanje eksplicitno vrnjenih relacij in priprava človeškega pregleda. Vsaka kartica, vsako vrnjeno polje in top-level evidence morajo imeti lasten dobesedni neprekinjeni izsek iz izvirnika. Neznan, podvojen ali nezdružljiv ID, nepovezan evidence, neveljavna vrednost ali hkratni plan in vprašanje zavrnejo celoten odgovor; delni plan se nikoli ne prikaže kot uspeh. Vsak samostojno zahtevani pravni rezultat je svoj `legal_recovery` korak. Materialna dvoumnost sproži največ eno vprašanje na odgovor in največ dva kroga pojasnil; nato tok varno preide na ročno izbiro.

Vse ciljne FATHER kartice uporabljajo skupni `atena-semantic-lexicon-v1`. Vsaka kartica ima lasten kontekst, širok nabor sopomenk, pogovorne oblike, pomenske signale in meje do zamenljivih kartic. Sopomenke so primeri, ne zaprt seznam ključnih besed: Luna mora pomen določiti iz celotne povedi, časa, akterja in želenega rezultata ter `custom_goal` ne sme izbrati samo zato, ker je ena beseda neznana.

`full_payment`, `new_deadline` in obročni načrt za celoten dolg uporabljajo trenutni preostanek kot ciljni znesek tudi takrat, ko uporabnik ne ponovi številke. Obročna kartica ločeno hrani skupni ciljni znesek in znesek posameznega obroka. Pravna izterjava lahko iz Luninega rezultata neposredno odpre eno od šestih podkartic. Vsi predlogi ostanejo reviewable; Luna ne shranjuje ali izvaja cilja brez uporabnikove potrditve. Končni klik »Da, potrdi cilj« potrjene Atenine cilje varno shrani in uporabnika neposredno odpre v koraku »Načrt«; vmesni seznam »Pripravljeni cilji« je namenjen ročnemu sestavljanju in se po tej potrditvi ne prikazuje.

`partial_payment_now` podpira tudi sestavljen cilj »del do prvega roka, preostanek do drugega roka«. Polje `paymentDeadline` je rok prvega delnega plačila, `remainingStrategy=new_deadline` izbere nov rok za preostanek, `remainingDeadline` pa hrani ta drugi rok. Delež, kot je »polovico«, Luna izračuna iz trenutnega preostalega dolga; cilj ostane samo predlog in ne zmanjša knjiženega dolga.

Eksplicitni odpust ob plačilu preostanka je vedno `amicable_settlement`: »naj plača vse, odpustim X EUR« pomeni ciljni znesek `trenutni preostanek − X`. Odpust ni `full_payment`, `close_without_recovery`, pobot ali drug cilj. Luna dobi to pravilo, katalog in primere; lokalni resolver pa izračun preveri ter popravi napačen modelski predlog. Cilj ostane predlog in ne knjiži odpusta ali zmanjšanja dolga.
## Transport, idempotenca in evidence

Ciljni motor uporablja isto `atena-luna-policy.js` produkcijsko mejo kot history in agreement: omejeni retryji samo za timeout/omrežje/`429`/`5xx`, skupni deadline, varna klasifikacija napak, skupni rate-limit algoritem ter in-flight deduplikacija po uporabniku, contractu in `requestId`. Enak ID z drugačno vsebino je konflikt `409`; rezultat ali varna napaka sta znotraj TTL ponovljiva. UI rezultat uporabi samo, če se ujemata trenutna generacija in trenutni `requestId`, zato pozen odgovor ne sme prepisati novejšega stanja.

Luna mora za kartico in polja vrniti dobesedne neprekinjene evidence izseke iz `sourceText`. Lokalni adapter ne razlaga parafraz: zadostuje najmanj en povezan card/field izsek na kartico, popolnoma nepovezan plan pa je fail-closed. Kartični guide uporablja `fieldIds`/`requiredFieldIds`, podrobnosti polj in allowed values pa ostanejo enkrat v skupnih tabelah kataloga.
