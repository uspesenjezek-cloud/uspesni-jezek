# Obvezna navodila za Claude — Uspešni Ježek

Ta datoteka je trajni oblikovni in izvedbeni dogovor projekta. Pred vsakim posegom preberi tudi `AGENTS.md`. Pri delu na Bonitetnem centru obvezno preberi `docs/BONITETA-REGRESSION-GUARDRAILS.md` in `docs/BONITETA-MERE.md`.

## 1. Vrstni red virov resnice

1. Zadnje izrecno navodilo uporabnika.
2. Zadnji potrjeni posnetek dejanske PWA na telefonu.
3. Obstoječi produkcijski element, ki je nalogi najbližji.
4. Ta dokument in `AGENTS.md`.
5. Splošne oblikovalske konvencije.

Če se posnetek in koda razlikujeta, ne izmišljaj kompromisa. Ugotovi vzrok razlike in popravi živo stran. Ko uporabnik potrdi novo različico, ta postane novi vizualni precedens.

## 2. Zaklenjen oblikovni jezik

- Mobilno prvenstven, čist Apple/PWA-videz z mehkim, zadržanim teal/mint sistemom.
- Primarne barve iz obstoječih komponent: teal `#51999a`, temnejši teal `#10797d`, `#15959b`, `#168e94`; Bonitetni center uporablja tudi temnejše odtenke okoli `#075866`.
- Površine so bele ali rahlo toplo bele (`#fbfaf7`) z zelo nežnimi zelenkastimi gradienti.
- Obrobe so tanke, svetle in hladno zeleno-sive. Sence so mehke, široke in nizkega kontrasta.
- Naslovi uporabljajo obstoječi `Bricolage Grotesque`; telo in kontrolniki `Figtree` oziroma pisavo že uporabljene najbližje komponente.
- Ikone so lahke linijske SVG-ikone z enako debelino poteze kot sosednji elementi. Ne uporabljaj emojijev ali ikon drugega sloga.
- Zaobljenost, smer gradienta, senca, debelina obrobe in razmiki se vedno kopirajo iz najbližje potrjene komponente.
- Ne uvajaj nove palete, ostrejših senc, močnejših gradientov, generičnih kartic ali novega oblikovnega jezika brez izrecne uporabnikove zahteve.

## 3. Pravila proporcev

- Proporci se oblikujejo pri dejanski CSS-širini, ne po fizičnih pikah posnetka.
- Glavna referenčna širina telefona je `390px`. Obvezna dodatna kontrola je `320px`.
- Skupna največja širina aplikacijske vsebine ostaja `480px`, razen če obstoječa stran določa ožjo mero.
- Ne zmanjšuj celotnega zaslona z `transform: scale()`, `zoom` ali globalno manjšo pisavo. Popravi konkretne mere, razmik ali komponento.
- Kartice v isti vrstici imajo poravnane robove, enake višine in stabilna razmerja. Besedilo ne sme spreminjati geometrije kartice.
- Omejeno besedilo mora uporabljati obstoječe samodejno prilagajanje velikosti pisave. Ne reži, ne prekrivaj, ne lomi sredi vrednosti in ne širi okvirja.
- Minimalna dotikalna tarča je praviloma `44px`, razen že potrjenih kompaktnih dekorativnih kontrolnikov.
- Overlap je nameren samo tam, kjer ga potrjeni dizajn že uporablja. Ne odstrani ga in ga ne povečuje po občutku.
- Spodnja navigacija je fiksna. Vsebina mora rezervirati prostor zanjo in ne sme biti skrita pod njo.
- Kratka stran v PWA se ne sme prazno pomikati ali elastično poskakovati; dolga stran se mora normalno pomikati.

## 4. Referenčni okvir PWA in predogleda

- Končni vir resnice je nameščena PWA na dejanskem iPhonu, ne običajni Safari/Chrome z naslovno vrstico.
- Za namizni predogled odpri katerokoli zaščiteno kategorijo z `?app-preview=1` in uporabi Device Mode `390 × 844`, povečavo `100 %`.
- Predogled rezervira `47px` za zgornji iPhone statusni prostor. Ta način se med kategorijami ohrani v `sessionStorage`.
- Predogled izključiš z `?app-preview=0`.
- Črni Dynamic Island/notch je samo namizna maketa. V pravi PWA ga riše iOS; ne dodajaj druge kopije v dejanski PWA.
- Upoštevaj `env(safe-area-inset-top)` in `env(safe-area-inset-bottom)`.
- Pri primerjavi zaslonov loči: fizično višino telefona `844px`, sistemski zgornji prostor, fiksno spodnjo navigacijo in dejansko vsebinsko območje.

## 5. Mobilne mere Bonitetnega centra

Glej `docs/BONITETA-MERE.md` — preberi to datoteko samo, kadar dejansko delaš na Bonitetnem centru.

## 6. Način dela pri vsaki UI-spremembi

1. Najprej preglej umazano delovno drevo in ohrani nepovezane spremembe.
2. Najdi živi element, njegov CSS, dogodke, stanje, shranjevanje in najbližje teste.
3. Uredi obstoječo komponento; ne izdeluj vzporednega mockupa ali druge strani.
4. Popravi najmanjši odgovorni sloj. Ne dodajaj kupa preglasitev na konec CSS-datoteke, če lahko popraviš pravo obstoječe pravilo.
5. Ohrani vse funkcije. Vizualna sprememba ne sme odklopiti dogodka, podatkov, validacije, shranjevanja ali navigacije.
6. Po spremembi posodobi cache različico spremenjenega CSS/JS vira.
7. Preveri kratko in dolgo realistično besedilo pri `320px` in `390px`.
8. Preveri dejansko dejanje, prazno stanje, nalaganje, napako in uspeh, kadar jih sprememba lahko prizadene.
9. Za PWA preveri nameščeno aplikacijo ali jasno napiši, če dejanskega telefonskega prikaza nisi mogel potrditi.
10. Ne razglasi vizualne skladnosti samo zato, ker testi uspejo.
11. Po zadnji spremembi odpri točen prizadeti URL povsem na novo, ponovi dejanski uporabnikov tok in naredi nov posnetek zaslona. Primerjaj ga z uporabnikovo sliko in navodilom; že odprt zavihek ali starejši posnetek ne šteje. Če se ne ujema, nadaljuj s popravljanjem in ne razglasi naloge za končano. To velja za vse agente in prihodnje pogovore na projektu.

## 7. Prepovedane bližnjice

- Ne ugibaj novega dizajna in ne »izboljšuj« potrjenega zaslona brez zahteve.
- Ne rešuj prostora z globalnim skaliranjem.
- Ne dodajaj trdo kodiranih podatkov, imen, domen ali posebnih popravkov za en primer.
- Ne prikazuj mock podatkov kot delujoč produkcijski tok.
- Ne skrivaj zahtevane vsebine samo zato, da zaslon vizualno paše.
- Ne prepisuj uporabnikovih ali drugih lokalnih sprememb.
- Ne spreminjaj poslovne logike pri nalogi, ki zahteva samo oblikovno korekcijo.

## 8. Začasni elementi

Element z razredom `.boniteta-zacasno-nazaj` je trenutno izrecno začasen gumb za vrnitev iz Bonitetnega centra na `index.html`. Ne odstrani, ne preoblikuj v trajno globalno navigacijo in ne razširjaj na druge strani brez uporabnikovega navodila.

## 9. Objava in preverjanje na Vercelu

- Delaj samo v kanoničnem projektu: `C:\Users\jkjob\Desktop\uspesen jezik git`.
- Edini uporabniški in končni preverjevalni naslov je: `https://uspesni-jezek.vercel.app/app/index.html`.
- `http://localhost:8001` uporabljaj samo interno med razvojem. Ne prikazuj ga uporabniku in ga ne uporabljaj za končno potrditev.
- Razvoj in sprotno vizualno preverjanje (ali sprememba sploh izgleda in deluje pravilno) potekata na `8001`. Delo se nadaljuje brez čakanja na Vercel — objava je ločen, zadnji korak, ne pogoj za nadaljevanje razvoja.
- Pred zaključkom spremembe izvedi ustrezne teste.
- Če testi uspejo, spremembo objavi na obstoječi Vercel produkcijski projekt `uspesni-jezek`.
- Pred preverjanjem na Vercelu potrdi, da stran dejansko streže pravi, sveži vir (ne stare predpomnjene različice) — po potrebi z novo cache-busting oznako ali trdim osvežitvijo.
- Nato preveri dejansko spremenjeno stran na stalnem Vercel naslovu.
- Naloge ne označi kot končane, dokler sprememba ni objavljena in preverjena na Vercelu.
- Če objava na Vercel trenutno ni mogoča (npr. omejitev števila objav), to blokira samo sam korak objave in končne potrditve — ne razvoja. Razvoj, popravki in vizualno preverjanje na `8001` se nadaljujejo naprej; uporabniku jasno povej, da končna objava/potrditev še čaka.
- Vedno uporabljaj isti Vercel projekt in isti URL. Ne ustvarjaj novega projekta, novega produkcijskega naslova, začasne povezave `trycloudflare` ali kakršnekoli ločene kopije.
- Ne objavi različice, če katerikoli pomemben test ne uspe. To pomeni teste, ki dejansko pokrivajo spremenjene datoteke — ne celotnega `npm test`. Ker v repozitoriju hkrati dela več agentov, je lahko kadarkoli neuspešen nepovezan test iz tuje, nedokončane spremembe; tak test ne sme blokirati objave, mora pa biti uporabniku jasno omenjen.
- Ohrani vse obstoječe spremembe drugih agentov in ne prepisuj njihovega dela.
