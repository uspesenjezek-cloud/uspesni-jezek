# Nemški POS — stanje Cloud pregleda

Datum ponovnega preverjanja: 24. avgust 2026.

Ta dokument povezuje sedem najdb podrobnega Cloud pregleda z dejanskim stanjem
kode. Ocena pomeni tehnično regresijsko preverjanje, ne pravnega mnenja.

## Zaprte najdbe

1. **Nemški UI in slovenski nizi — zaprto.** Slovar in vzorčni prevodi pokrijejo
   tudi dinamične statuse in sestavljene oznake. `test-pos-i18n.js` preverja
   znane slovenske ostanke, nemščina pa ostaja privzeti jezik POS terminala.
2. **KoSIT zapora — zaprto.** Izdaja, ki zahteva e-račun, sprejme samo svež
   strežniško ustvarjen dokaz, da je isti osnutek prestal KoSIT preflight.
   Odjemalčev `p_einvoice_validated` se ne šteje kot dokaz.
3. **RPC timeouti — zaprto.** POS RPC operacije gredo skozi omejen čas čakanja;
   tudi prehodi naročil, ročna plačila, uvoz banke in izdaja računa ne morejo
   več čakati brez konca.
4. **Sedem vrst izvirnikov v GoBD/WORM verigi — zaprto v kodi.** Račun PDF,
   XRechnung, popravek PDF, popravek XRechnung, ponudba, pogodbeno potrdilo in
   verzija dokumentacije postopka imajo arhivski manifest in repliko.
5. **Dvojni klik pri izdaji — zaprto.** Skupno stanje `invoiceIssuing`, onemogočen
   gumb in `aria-busy` preprečijo vzporedno izdajo v uporabniškem vmesniku;
   strežniška idempotenca ostaja dodatna zaščita.
6. **Stripe TEST povračilo — zaprto.** Uspeh se prikaže samo po potrditvi
   podpisanega webhooka. Po izteku preverjanja UI jasno pove, da je zahteva le
   sprejeta in da potrditev še manjka; idempotenčni ključ ostane ohranjen.
7. **Fiskaly/TSE obseg — pojasnjeno.** Fiskaly ostaja TRAINING in ni del
   brezgotovinskega produkcijskega obsega. To ni pogoj za zagon trenutnega POS.

## Dodatno utrjevanje po pregledu

- **Ura callbacka ponudnika — zaprto.** Uspešna lokalna oddaja Openapi ali
  Resend ne zapisuje več lokalne ure kot ponudnikove časovne meje. S tem `DONE`
  callback, ki je pri
  Openapi nastal tik pred lokalnim zaključkom in prispel zatem, ni napačno
  zavrnjen kot zastarel. Nova migracija sledljivo popravi tudi morebitne stare
  sintetične meje, ne da bi brisala nespremenljive dostavne dogodke.
- **Webhook pred lokalno registracijo — zaprto.** Podpisan Openapi ali Stripe
  dogodek, ki prehiti zapis lokalne reference, dobi začasni `503` in ga
  ponudnik lahko varno ponovi; tuj nepovezan Stripe dogodek ostane sprejet in
  prezrt brez posega v POS podatke.
- **Ročno plačilo po izgubljenem odgovoru — zaprto.** Trajni ključ zahteve
  poveže ponovitev z že zapisanim plačilom, zato timeout po uspešnem commitu ne
  povzroči drugega plačila niti zavajajoče napake »račun je že plačan«.
- **Trajna obnova vseh zaklenjenih originalov — zaprto.** Dnevni arhivski
  delavec poleg računov in popravkov sam obnovi tudi manjkajoči PDF zaklenjene
  ponudbe ter pogodbenega potrdila. Produkcijska pripravljenost ostane zaprta,
  dokler manjkajoči živi original ni ustvarjen in njegova arhivska replika ni
  preverjena.

## Dokaz regresije

- vse skripte `scripts/test-pos-*.js` se izvajajo z enim ukazom
  `npm run test:pos`;
- Vercel uporablja 11 od največ 12 funkcij;
- produkcijska pripravljenost se preveri z
  `npm run check:pos-production`;
- noben readiness izpis ne vsebuje vrednosti skrivnosti.

## Kar še ni zaprto s kodo

- nova koda je nameščena na stalnem Vercel Preview naslovu in preverjena v
  brskalniku brez konzolnih napak. Openapi sandbox je že sprejel dva originala
  tipa 380, zadnji namenski preizkus tipa 381 pa je ponovljivo potrdil spodnjo
  ponudniško blokado. Preview ima zaščiten sandbox žeton, sandbox način, testno
  fiskalno oznako in ločena webhook podatka; produkcija jih ne uporablja;
- dolgoročni produkcijski Openapi žeton in poslovni vklop; kratkotrajna žetona,
  ki potečeta 25. avgusta 2026, namenoma nista primerna za produkcijsko
  integracijo;
- ponudnikova potrjena rešitev za nemški Storno/Gutschrift tipa 381; ta je zdaj
  samostojna obvezna readiness kontrola in ostane zaprta tudi ob veljavnem
  produkcijskem žetonu. Pripravljen je angleški paket za podporo
  `POS-OPENAPI-DE-381-SUPPORT-TICKET.md` in strogo sandbox-only ponovitveni
  preizkus z dvema enkratnima potrditvama; običajna dostavna pot preizkusa ne
  more vključiti;
- produkcijski AWS S3 Object Lock ter dejanski obnovitveni preizkus;
- končni nemški davčni oziroma pravni pregled;
- pilot z dejanskim nemškim podjetjem in prejemnikom.

Ti koraki zahtevajo zunanjega ponudnika ali človekovo potrditev. Stripe live,
finAPI live in DATEV Cloud niso pogoji za začetni brezgotovinski pilot.
