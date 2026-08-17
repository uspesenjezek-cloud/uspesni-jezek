/* ==========================================================
   zacasno-obvestila-data.js

   Prototipni podatkovni model za stran "Začasno" (zacasno-obvestila.html).
   En sam vir podatkov za VSE 10 kartic: iz vsakega zapisa se izrišeta
   mini sistemsko obvestilo IN zaslon "Kaj sledi" (glej zacasno-obvestila.js).
   Naslov, datum, dolžnik, kanali, sporočilo in barva se nikoli ne
   podvajajo v ločenih strukturah.

   ---------------------------------------------------------------
   MEJA PRIHODNJE INTEGRACIJE (ne implementirati v tej nalogi):

   Ko bo produkcijska logika aktivirana, bo vsak vključen korak načrta
   ob potrditvi dobil dva ločena, strogo razmejena zapisa:

     planStep          - urejljiv korak znotraj še odprtega načrta;
                         uporabnik ga lahko spremeni, dokler ni potrjen.
     executionSnapshot - nespremenljiv "posnetek" koraka v trenutku, ko
                         gre v izvršbo. Mini obvestilo in zaslon
                         "Kaj sledi" morata TAKRAT brati izključno ta
                         zamrznjeni posnetek, nikoli kasneje spremenjen
                         planStep - da uporabnik po sprožitvi vedno vidi
                         točno to, kar je (ali bo) dejansko poslano.

   Predlagana stanja izvršbe (samo dokumentacija, brez implementacije):

     scheduled -> due -> sending -> sent
                        \-> failed
     scheduled -> cancelled

       scheduled  korak je zaklenjen in čaka na termin
       due        termin je dosežen; mini obvestilo se sme prikazati in
                  odpreti "Kaj sledi"
       sending    dejanje se izvaja; UI mora preprečiti dvojni klik
       sent       dejanje je evidentirano; gumb ni več klikljiv
       failed     uporabniku je treba jasno ponuditi ponovitev
       cancelled  korak ni bil izveden

   Vsako pravo pošiljanje bo poleg tega potrebovalo `executionId` in
   `idempotencyKey`, da morebiten podvojen klik/dogodek ne pošlje
   sporočila dvakrat.

   Ta datoteka in zacasno-obvestila.js implementirata IZKLJUČNO prototip:
   vsi fixture koraki so v prototipnem stanju "due", nobeno dejanje ne
   pošilja ničesar in noben od zgornjih prehodov ni implementiran.
   ---------------------------------------------------------------

   window.UJZacasnoObvestilaData
   ============================================================ */
(function (root) {
  "use strict";

  /** Obstoječa eskalacijska paleta aplikacije (glej
      .opomin-nacrt__stage--eskalacija-1..9 in --predaja v styles.css).
      Tu je zapisana kot statična tabela – ista barvna identiteta, brez
      nove palete in brez nalaganja opomin-nacrt-ui.js na tej strani. */
  var ESKALACIJA_BARVE = [
    { accent: "#6cae90", accentRgb: "108, 174, 144" },
    { accent: "#87af72", accentRgb: "135, 175, 114" },
    { accent: "#c3a13b", accentRgb: "195, 161, 59" },
    { accent: "#c49025", accentRgb: "196, 144, 37" },
    { accent: "#c8842e", accentRgb: "200, 132, 46" },
    { accent: "#c8773f", accentRgb: "200, 119, 63" },
    { accent: "#c76b46", accentRgb: "199, 107, 70" },
    { accent: "#c65d57", accentRgb: "198, 93, 87" },
    { accent: "#b95660", accentRgb: "185, 86, 96" },
  ];
  var PREDAJA_BARVA = { accent: "#8762aa", accentRgb: "135, 98, 170" };

  var DOLZNIK = {
    displayName: "Novak Gradnje d.o.o.",
    amountLabel: "1.240,00 €",
    invoiceLabel: "št. 2026-014",
  };

  /** Deset fixture korakov – devet samodejnih opominov (eskalacija 1–9) +
      en ročni korak "Predaja odvetniku" (vijolična, --predaja). Isti
      dolžnik/znesek/račun skozi ves prototipni primer, kot bi šlo za en
      resnični plan v napredovanju. */
  var KATALOG = [
    {
      id: "step-01",
      order: 1,
      kind: "automatic_reminder",
      title: "Prijazen opomin",
      scheduledAt: "2026-08-14T10:38:00+02:00",
      icon: "message",
      accent: ESKALACIJA_BARVE[0].accent,
      accentRgb: ESKALACIJA_BARVE[0].accentRgb,
      debtor: DOLZNIK,
      channels: ["sms", "email"],
      toneLabel: "Prijazen",
      paymentDeadlineLabel: "21. 8. 2026",
      previousStepLabel: "Ni prejšnjega koraka",
      reason: "Prvi opomin se pošlje takoj, ko zapade rok plačila računa.",
      summary:
        "Ker je račun zapadel, bo dolžnik danes prejel prijazen opomin s prošnjo za poravnavo.",
      message:
        "Pozdravljeni,\n\nopažamo, da račun " +
        DOLZNIK.invoiceLabel +
        " v znesku " +
        DOLZNIK.amountLabel +
        " še ni poravnan. Prosimo, da ga poravnate v najkrajšem možnem času.\n\nHvala za razumevanje.",
      nextIfUnpaid:
        "Če dolg ne bo poravnan, boste prejeli obvestilo za naslednji korak.",
      notification: {
        title: "Čas je za 1. korak",
        body: "Prijazen opomin za " + DOLZNIK.displayName + " je pripravljen. Tapnite za pregled in pošiljanje.",
      },
      primaryActionLabel: "Pošlji",
    },
    {
      id: "step-02",
      order: 2,
      kind: "automatic_reminder",
      title: "Odločen opomin",
      scheduledAt: "2026-08-17T10:38:00+02:00",
      icon: "mail",
      accent: ESKALACIJA_BARVE[1].accent,
      accentRgb: ESKALACIJA_BARVE[1].accentRgb,
      debtor: DOLZNIK,
      channels: ["sms", "email"],
      toneLabel: "Odločen",
      paymentDeadlineLabel: "24. 8. 2026",
      previousStepLabel: "Prijazen opomin",
      reason: "Dolžnik se na prvi, prijazen opomin ni odzval.",
      summary:
        "Ker se dolžnik na prvi opomin ni odzval, mu bo danes poslan bolj odločen SMS in e-pošta.",
      message:
        "Pozdravljeni,\n\nponovno vas opozarjamo, da račun " +
        DOLZNIK.invoiceLabel +
        " v znesku " +
        DOLZNIK.amountLabel +
        " še vedno ni poravnan. Prosimo za plačilo v roku 3 dni.",
      nextIfUnpaid:
        "Če dolg ne bo poravnan, boste prejeli obvestilo za naslednji korak.",
      notification: {
        title: "Čas je za 2. korak",
        body: "Odločen opomin za " + DOLZNIK.displayName + " je pripravljen. Tapnite za pregled in pošiljanje.",
      },
      primaryActionLabel: "Pošlji",
    },
    {
      id: "step-03",
      order: 3,
      kind: "automatic_reminder",
      title: "Strog opomin",
      scheduledAt: "2026-08-20T10:38:00+02:00",
      icon: "warning",
      accent: ESKALACIJA_BARVE[2].accent,
      accentRgb: ESKALACIJA_BARVE[2].accentRgb,
      debtor: DOLZNIK,
      channels: ["sms", "email"],
      toneLabel: "Strog",
      paymentDeadlineLabel: "27. 8. 2026",
      previousStepLabel: "Odločen opomin",
      reason: "Dolžnik se ni odzval niti na drugi, odločnejši opomin.",
      summary:
        "Ker se dolžnik še vedno ni odzval, mu bo danes poslan strožji opomin z jasnim rokom.",
      message:
        "Pozdravljeni,\n\nto je tretje opozorilo glede neplačanega računa " +
        DOLZNIK.invoiceLabel +
        " (" +
        DOLZNIK.amountLabel +
        "). Plačilo pričakujemo najkasneje v 3 dneh, sicer bomo prisiljeni nadaljevati s formalnimi koraki.",
      nextIfUnpaid:
        "Če dolg ne bo poravnan, boste prejeli obvestilo za naslednji korak.",
      notification: {
        title: "Čas je za 3. korak",
        body: "Strog opomin za " + DOLZNIK.displayName + " je pripravljen. Tapnite za pregled in pošiljanje.",
      },
      primaryActionLabel: "Pošlji",
    },
    {
      id: "step-04",
      order: 4,
      kind: "automatic_reminder",
      title: "Dodaten odločen opomin",
      scheduledAt: "2026-08-23T10:38:00+02:00",
      icon: "mail",
      accent: ESKALACIJA_BARVE[3].accent,
      accentRgb: ESKALACIJA_BARVE[3].accentRgb,
      debtor: DOLZNIK,
      channels: ["sms", "email"],
      toneLabel: "Odločen",
      paymentDeadlineLabel: "30. 8. 2026",
      previousStepLabel: "Strog opomin",
      reason: "Dolžnik se na prejšnji opomin ni odzval.",
      summary:
        "Ker se dolžnik na prejšnji opomin ni odzval, mu bo danes poslan bolj odločen SMS in e-pošta.",
      message:
        "Pozdravljeni,\n\nračun " +
        DOLZNIK.invoiceLabel +
        " v znesku " +
        DOLZNIK.amountLabel +
        " je še vedno neporavnan. To je zadnje opozorilo pred formalnimi opomini.",
      nextIfUnpaid:
        "Če dolg ne bo poravnan, boste prejeli obvestilo za naslednji korak.",
      notification: {
        title: "Čas je za 4. korak",
        body: "Dodaten odločen opomin za " + DOLZNIK.displayName + " je pripravljen. Tapnite za pregled in pošiljanje.",
      },
      primaryActionLabel: "Pošlji",
    },
    {
      id: "step-05",
      order: 5,
      kind: "automatic_reminder",
      title: "Zadnji formalni opomin",
      scheduledAt: "2026-08-26T10:38:00+02:00",
      icon: "document",
      accent: ESKALACIJA_BARVE[4].accent,
      accentRgb: ESKALACIJA_BARVE[4].accentRgb,
      debtor: DOLZNIK,
      channels: ["sms", "email"],
      toneLabel: "Formalen",
      paymentDeadlineLabel: "2. 9. 2026",
      previousStepLabel: "Dodaten odločen opomin",
      reason: "Rok za prostovoljno plačilo se izteka.",
      summary:
        "Ker se rok za prostovoljno plačilo izteka, dolžnik danes prejme prvi formalni opomin.",
      message:
        "Pozdravljeni,\n\nto je uradni formalni opomin za neplačan račun " +
        DOLZNIK.invoiceLabel +
        " (" +
        DOLZNIK.amountLabel +
        "). Prosimo za takojšnje plačilo, da se izognete nadaljnjim korakom.",
      nextIfUnpaid:
        "Če dolg ne bo poravnan, boste prejeli obvestilo za naslednji korak.",
      notification: {
        title: "Čas je za 5. korak",
        body: "Zadnji formalni opomin za " + DOLZNIK.displayName + " je pripravljen. Tapnite za pregled in pošiljanje.",
      },
      primaryActionLabel: "Pošlji",
    },
    {
      id: "step-06",
      order: 6,
      kind: "automatic_reminder",
      title: "Zadnji formalni opomin",
      scheduledAt: "2026-08-29T10:38:00+02:00",
      icon: "document",
      accent: ESKALACIJA_BARVE[5].accent,
      accentRgb: ESKALACIJA_BARVE[5].accentRgb,
      debtor: DOLZNIK,
      channels: ["sms", "email"],
      toneLabel: "Formalen",
      paymentDeadlineLabel: "5. 9. 2026",
      previousStepLabel: "Zadnji formalni opomin",
      reason: "Dolžnik se ni odzval niti na formalni opomin.",
      summary:
        "Ker se dolžnik ni odzval niti na formalni opomin, sledi ponovljen formalni opomin z dodatnim rokom.",
      message:
        "Pozdravljeni,\n\nponavljamo uradni formalni opomin za račun " +
        DOLZNIK.invoiceLabel +
        " (" +
        DOLZNIK.amountLabel +
        "). To je zadnja priložnost za prostovoljno poravnavo dolga.",
      nextIfUnpaid:
        "Če dolg ne bo poravnan, boste prejeli obvestilo za naslednji korak.",
      notification: {
        title: "Čas je za 6. korak",
        body: "Zadnji formalni opomin za " + DOLZNIK.displayName + " je pripravljen. Tapnite za pregled in pošiljanje.",
      },
      primaryActionLabel: "Pošlji",
    },
    {
      id: "step-07",
      order: 7,
      kind: "automatic_reminder",
      title: "Dodaten formalni opomin",
      scheduledAt: "2026-09-01T10:38:00+02:00",
      icon: "document",
      accent: ESKALACIJA_BARVE[6].accent,
      accentRgb: ESKALACIJA_BARVE[6].accentRgb,
      debtor: DOLZNIK,
      channels: ["sms", "email"],
      toneLabel: "Formalen",
      paymentDeadlineLabel: "8. 9. 2026",
      previousStepLabel: "Zadnji formalni opomin",
      reason: "Dolg ostaja neporavnan kljub dvema formalnima opominoma.",
      summary:
        "Ker dolg kljub dvema formalnima opominoma ostaja neporavnan, sledi dodaten formalni opomin.",
      message:
        "Pozdravljeni,\n\ndolg iz računa " +
        DOLZNIK.invoiceLabel +
        " (" +
        DOLZNIK.amountLabel +
        ") ostaja neporavnan. Opozarjamo, da bomo v primeru neplačila primer predali v nadaljnjo obravnavo.",
      nextIfUnpaid:
        "Če dolg ne bo poravnan, boste prejeli obvestilo za naslednji korak.",
      notification: {
        title: "Čas je za 7. korak",
        body: "Dodaten formalni opomin za " + DOLZNIK.displayName + " je pripravljen. Tapnite za pregled in pošiljanje.",
      },
      primaryActionLabel: "Pošlji",
    },
    {
      id: "step-08",
      order: 8,
      kind: "automatic_reminder",
      title: "Resen opomin",
      scheduledAt: "2026-09-04T10:38:00+02:00",
      icon: "warning",
      accent: ESKALACIJA_BARVE[7].accent,
      accentRgb: ESKALACIJA_BARVE[7].accentRgb,
      debtor: DOLZNIK,
      channels: ["sms", "email"],
      toneLabel: "Resen",
      paymentDeadlineLabel: "11. 9. 2026",
      previousStepLabel: "Dodaten formalni opomin",
      reason: "Primer se približuje predaji odvetniku.",
      summary:
        "Ker se primer približuje predaji odvetniku, dolžnik prejme resen opomin z jasnim opozorilom.",
      message:
        "Pozdravljeni,\n\nto je resno opozorilo glede neplačanega računa " +
        DOLZNIK.invoiceLabel +
        " (" +
        DOLZNIK.amountLabel +
        "). Če dolg ne bo poravnan v navedenem roku, bo primer predan odvetniku.",
      nextIfUnpaid:
        "Če dolg ne bo poravnan, boste prejeli obvestilo za naslednji korak.",
      notification: {
        title: "Čas je za 8. korak",
        body: "Resen opomin za " + DOLZNIK.displayName + " je pripravljen. Tapnite za pregled in pošiljanje.",
      },
      primaryActionLabel: "Pošlji",
    },
    {
      id: "step-09",
      order: 9,
      kind: "automatic_reminder",
      title: "Predzadnji opomin",
      scheduledAt: "2026-09-07T10:38:00+02:00",
      icon: "warning",
      accent: ESKALACIJA_BARVE[8].accent,
      accentRgb: ESKALACIJA_BARVE[8].accentRgb,
      debtor: DOLZNIK,
      channels: ["sms", "email"],
      toneLabel: "Resen",
      paymentDeadlineLabel: "14. 9. 2026",
      previousStepLabel: "Resen opomin",
      reason: "To je zadnja priložnost pred predajo odvetniku.",
      summary:
        "Ker je to zadnja priložnost pred predajo odvetniku, dolžnik prejme predzadnje, dokončno opozorilo.",
      message:
        "Pozdravljeni,\n\nto je zadnje opozorilo pred predajo zadeve odvetniku. Račun " +
        DOLZNIK.invoiceLabel +
        " (" +
        DOLZNIK.amountLabel +
        ") poravnajte nemudoma, da se izognete dodatnim stroškom.",
      nextIfUnpaid:
        "Če dolg ne bo poravnan, bo primer predan odvetniku.",
      notification: {
        title: "Čas je za 9. korak",
        body: "Predzadnji opomin za " + DOLZNIK.displayName + " je pripravljen. Tapnite za pregled in pošiljanje.",
      },
      primaryActionLabel: "Pošlji",
    },
    {
      id: "step-10",
      order: 10,
      kind: "manual_lawyer",
      title: "Predaja odvetniku",
      scheduledAt: "2026-09-10T10:38:00+02:00",
      icon: "scales",
      accent: PREDAJA_BARVA.accent,
      accentRgb: PREDAJA_BARVA.accentRgb,
      debtor: DOLZNIK,
      channels: ["email"],
      toneLabel: null,
      paymentDeadlineLabel: null,
      previousStepLabel: "Predzadnji opomin",
      reason: "Dolžnik se ni odzval na noben od devetih opominov.",
      summary:
        "Ker se dolžnik ni odzval na noben opomin, bo pripravljen paket za ročno predajo izbranemu odvetniku.",
      message:
        "Pozdravljeni,\n\nprosim za pomoč pri izterjavi zapadlega dolga v višini " +
        DOLZNIK.amountLabel +
        " od dolžnika " +
        DOLZNIK.displayName +
        ". Priloženi so podatki primera, račun in zgodovina poslanih opominov.",
      nextIfUnpaid:
        "Aplikacija ne pošlje ničesar samodejno – paket boste odvetniku predali sami.",
      notification: {
        title: "Čas je za 10. korak",
        body: "Predaja odvetniku za " + DOLZNIK.displayName + " je pripravljena. Tapnite za pregled.",
      },
      primaryActionLabel: "Potrdi predajo",
      handoff: {
        lawyerName: "Odvetnik Jože Kovač",
        packageLabel: "Odvetnik pošlje opomin",
        priceLabel: "29,90 € enkratno",
        methodLabel: "Ročna predaja (aplikacija ne pošilja)",
      },
    },
  ];

  /** Vsi fixture koraki so v prototipnem stanju "due" (glej opombo o mejah
      integracije zgoraj) – mini obvestilo in "Kaj sledi" se smeta prikazati. */
  KATALOG.forEach(function (korak) {
    korak.executionState = "due";
  });

  /** Čista funkcija brez pravega push SDK-ja – samo dokumentirana meja za
      prihodnjo Capacitor/native integracijo. Pravo sistemsko obvestilo bo
      nosilo samo executionId + stepOrder + kratko (varno) besedilo; celoten
      SMS se prebere šele po odprtju aplikacije prek te povezave.
      @param {string} executionId
      @returns {string} */
  function buildStepDeepLink(executionId) {
    var varenId = encodeURIComponent(String(executionId == null ? "" : executionId));
    return "neplacila-posiljanje.html?view=next-step&executionId=" + varenId;
  }

  /** Adapter (samo za branje): če je v seji shranjen resničen plan v znani
      obliki ({ steps: [...] }), ga poskusi pretvoriti v isto obliko kot
      KATALOG. Nikoli ne piše nazaj v sessionStorage/localStorage. Ob
      kakršnem koli odstopanju oblike ali manjkajočih podatkih vrne null,
      da klicatelj varno pade nazaj na fixture katalog. */
  function poskusiPretvoriObstojeciNacrt() {
    try {
      var surovo = sessionStorage.getItem("neplacilo-korak3-nacrt");
      if (!surovo) return null;
      var plan = JSON.parse(surovo);
      if (!plan || !Array.isArray(plan.steps) || !plan.steps.length) return null;

      var vkljuceni = plan.steps.filter(function (s) {
        return s && !s.isExcluded;
      });
      if (!vkljuceni.length) return null;

      return vkljuceni.map(function (s, i) {
        var jeRocni = s.kind === "manual_lawyer";
        var barva = jeRocni
          ? PREDAJA_BARVA
          : ESKALACIJA_BARVE[Math.min(ESKALACIJA_BARVE.length - 1, i)];
        return {
          id: "plan-step-" + (s.index != null ? s.index : i + 1),
          order: i + 1,
          kind: jeRocni ? "manual_lawyer" : "automatic_reminder",
          title: s.title || (jeRocni ? "Predaja odvetniku" : "Opomin"),
          scheduledAt: s.sendAt || s.scheduledAt || null,
          icon: jeRocni ? "scales" : "message",
          accent: barva.accent,
          accentRgb: barva.accentRgb,
          debtor: DOLZNIK,
          channels: ["sms", "email"],
          toneLabel: jeRocni ? null : "—",
          paymentDeadlineLabel: null,
          previousStepLabel: i > 0 ? vkljuceni[i - 1].title || "Prejšnji korak" : "Ni prejšnjega koraka",
          reason: "—",
          summary: jeRocni
            ? "Pripravljen bo paket za ročno predajo izbranemu odvetniku."
            : "Samodejni opomin bo poslan po načrtovani časovnici.",
          message: s.finalMessage || s.generatedMessage || "",
          nextIfUnpaid: "Če dolg ne bo poravnan, boste prejeli obvestilo za naslednji korak.",
          notification: {
            title: "Čas je za " + (i + 1) + ". korak",
            body: (s.title || "Korak") + " je pripravljen. Tapnite za pregled.",
          },
          primaryActionLabel: jeRocni ? "Potrdi predajo" : "Pošlji",
          executionState: "due",
        };
      });
    } catch (napaka) {
      return null;
    }
  }

  /** Javni API strani "Začasno". getKatalog() poskusi najprej varno (samo
      za branje) prebrati obstoječi shranjeni načrt; če ni na voljo ali ni v
      pričakovani obliki, vrne fixture katalog desetih korakov. */
  function getKatalog() {
    var izNacrta = poskusiPretvoriObstojeciNacrt();
    return izNacrta || KATALOG;
  }

  root.UJZacasnoObvestilaData = {
    getKatalog: getKatalog,
    buildStepDeepLink: buildStepDeepLink,
  };
})(typeof window !== "undefined" ? window : this);
