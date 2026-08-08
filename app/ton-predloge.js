/* ========== Predloge sporočil po tonih ==========
   v1: DE = 3×6 sistemskih predlog; SL/EN struktura pripravljena (prazno).
   window.UJTonPredloge / module.exports
   ============================================ */
(function (root) {
  "use strict";

  var TONE_IDS = ["friendly", "firm", "strict"];

  var NASLOVI_TONOV_SL = {
    friendly: "prijazen ton",
    firm: "odločen ton",
    strict: "strog ton",
  };

  var NASLOVI_PREDLOG_SL = {
    friendly: [
      "Vljuden opomin",
      "Prijazen opomnik",
      "Kratek opomin",
      "Novi rok – prijazno",
      "Prošnja za potrditev",
      "Obročno plačilo",
    ],
    firm: [
      "Odločen poziv",
      "Zadnji vljuden opomin",
      "Jasen rok",
      "Brez nadaljnjih zamud",
      "Kratek odločen",
      "Obroki – odločno",
    ],
    strict: [
      "Zadnji opomin",
      "Opozorilo pred ukrepi",
      "Skrajni rok",
      "Nujno plačilo",
      "Kratek strog",
      "Zadnja možnost obrokov",
    ],
  };

  function vrstice(seznam) {
    return seznam.filter(Boolean).join("\n");
  }

  function kontekstIzPodatkov(podatki) {
    var p = podatki || {};
    var invoiceNumber = String(p.stevilkaRacuna || "").trim();
    var znesek = p.znesek != null ? Number(p.znesek) : 0;
    var amount = Number.isFinite(znesek)
      ? znesek.toLocaleString("de-DE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) + " €"
      : "0,00 €";
    var dueDate = "";
    if (p.datumZapadlosti) {
      var dt = new Date(p.datumZapadlosti + "T12:00:00");
      if (!Number.isNaN(dt.getTime())) {
        dueDate = dt.toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    }
    var newDeadline = "";
    if (p.datumZapadlosti) {
      var nd = new Date(p.datumZapadlosti + "T12:00:00");
      if (!Number.isNaN(nd.getTime())) {
        nd.setDate(nd.getDate() + 7);
        newDeadline = nd.toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    }
    var racun =
      invoiceNumber.length > 0
        ? "Rechnung Nr. " + invoiceNumber + " über " + amount
        : "Rechnung über " + amount;
    return {
      invoiceNumber: invoiceNumber,
      amount: amount,
      dueDate: dueDate,
      newDeadline: newDeadline,
      racun: racun,
      iban: String(p.iban || "").trim(),
    };
  }

  /** Besedila DE: 6 različic na ton. */
  function besedilaDe(toneId, ctx) {
    var r = ctx.racun;
    var due = ctx.dueDate;
    var nd = ctx.newDeadline;
    var map = {
      friendly: [
        vrstice([
          "Guten Tag,",
          "ich möchte Sie freundlich an die noch offene " +
            r +
            " erinnern." +
            (due ? " Die Rechnung war am " + due + " fällig." : ""),
          "Bitte überweisen Sie den offenen Betrag zeitnah. Falls Sie bereits bezahlt haben, betrachten Sie diese Nachricht bitte als gegenstandslos.",
          "Vielen Dank und freundliche Grüße",
        ]),
        vrstice([
          "Guten Tag,",
          "für die " + r + " konnten wir noch keinen Zahlungseingang feststellen.",
          nd
            ? "Bitte begleichen Sie den offenen Betrag bis spätestens " +
              nd +
              ". Falls Sie bereits bezahlt haben, teilen Sie uns dies bitte kurz mit."
            : "Bitte begleichen Sie den offenen Betrag zeitnah. Falls Sie bereits bezahlt haben, teilen Sie uns dies bitte kurz mit.",
          "Vielen Dank und freundliche Grüße",
        ]),
        vrstice([
          "Guten Tag,",
          "die " + r + " ist noch offen. Bitte überweisen Sie den Betrag zeitnah.",
          "Sollte die Zahlung bereits erfolgt sein, können Sie diese Nachricht ignorieren.",
          "Freundliche Grüße",
        ]),
        vrstice([
          "Guten Tag,",
          "freundliche Erinnerung zur " + r + ".",
          nd
            ? "Bitte zahlen Sie bis " + nd + ". Danke im Voraus."
            : "Bitte zahlen Sie zeitnah. Danke im Voraus.",
          "Freundliche Grüße",
        ]),
        vrstice([
          "Guten Tag,",
          "bitte bestätigen Sie kurz, ob die Zahlung zur " +
            r +
            " bereits unterwegs ist – oder überweisen Sie den Betrag in den kommenden Tagen.",
          "Vielen Dank für Ihre Rückmeldung.",
          "Freundliche Grüße",
        ]),
        vrstice([
          "Guten Tag,",
          "die " + r + " ist weiterhin offen.",
          "Falls Sie den Gesamtbetrag derzeit nicht vollständig begleichen können, melden Sie sich bitte bei uns. Wir können gemeinsam eine passende Ratenzahlung vereinbaren.",
          "Freundliche Grüße",
        ]),
      ],
      firm: [
        vrstice([
          "Guten Tag,",
          "trotz Fälligkeit" +
            (due ? " am " + due : "") +
            " ist die " +
            r +
            " weiterhin unbezahlt.",
          "Bitte überweisen Sie den Betrag umgehend. Eine weitere Verzögerung ist nicht akzeptabel.",
          "Mit freundlichen Grüßen",
        ]),
        vrstice([
          "Guten Tag,",
          "dies ist eine erneute, deutliche Erinnerung zur " + r + ".",
          nd
            ? "Zahlen Sie bitte bis " +
              nd +
              ", andernfalls behalten wir uns weitere Schritte vor."
            : "Zahlen Sie bitte unverzüglich, andernfalls behalten wir uns weitere Schritte vor.",
          "Mit freundlichen Grüßen",
        ]),
        vrstice([
          "Guten Tag,",
          "die " + r + " muss jetzt beglichen werden.",
          "Bitte veranlassen Sie die Zahlung ohne weitere Verzögerung und senden Sie eine Bestätigung.",
          "Mit freundlichen Grüßen",
        ]),
        vrstice([
          "Guten Tag,",
          "wir erwarten den Zahlungseingang für die " + r + " ohne weiteren Aufschub.",
          nd ? "Letzter Termin: " + nd + "." : "Bitte handeln Sie sofort.",
          "Mit freundlichen Grüßen",
        ]),
        vrstice([
          "Guten Tag,",
          "offene " + r + " – bitte sofort überweisen.",
          "Mit freundlichen Grüßen",
        ]),
        vrstice([
          "Guten Tag,",
          "die " +
            r +
            " ist überfällig. Eine kurze Ratenzahlung ist nur nach sofortiger Rückmeldung möglich.",
          "Melden Sie sich noch heute.",
          "Mit freundlichen Grüßen",
        ]),
      ],
      strict: [
        vrstice([
          "Guten Tag,",
          "trotz Fälligkeit" +
            (due ? " am " + due : "") +
            " und unserer bisherigen Erinnerung ist die " +
            r +
            " noch offen.",
          nd
            ? "Bitte begleichen Sie den Betrag bis spätestens " +
              nd +
              ". Sollte bis dahin kein Zahlungseingang erfolgen, behalten wir uns weitere Schritte vor."
            : "Bitte begleichen Sie den Betrag ohne weitere Verzögerung. Sollte kein Zahlungseingang erfolgen, behalten wir uns weitere Schritte vor.",
          "Mit freundlichen Grüßen",
        ]),
        vrstice([
          "Guten Tag,",
          "letzte Mahnung zur " + r + ".",
          "Ohne Zahlung behalten wir uns rechtliche bzw. inkassorelevante Schritte vor.",
          "Mit freundlichen Grüßen",
        ]),
        vrstice([
          "Guten Tag,",
          "die " +
            r +
            " ist seit längerem unbezahlt. Dies ist die letzte Frist zur Begleichung.",
          nd ? "Zahlung bis " + nd + " erforderlich." : "Sofortige Zahlung erforderlich.",
          "Mit freundlichen Grüßen",
        ]),
        vrstice([
          "Guten Tag,",
          "dringend: offene " + r + ". Zahlen Sie unverzüglich.",
          "Andernfalls leiten wir weitere Maßnahmen ein.",
          "Mit freundlichen Grüßen",
        ]),
        vrstice([
          "Guten Tag,",
          "letzte Aufforderung: " + r + " sofort begleichen.",
          "Mit freundlichen Grüßen",
        ]),
        vrstice([
          "Guten Tag,",
          "bei der " +
            r +
            " bleibt nur noch eine kurzfristige Ratenzahlung möglich – ausschließlich nach sofortiger schriftlicher Zusage.",
          "Ohne Rückmeldung behalten wir uns weitere Schritte vor.",
          "Mit freundlichen Grüßen",
        ]),
      ],
    };
    return map[toneId] || map.friendly;
  }

  function sestaviSistemskePredloge(podatki, jezik) {
    var lang = jezik || "de";
    if (lang !== "de") {
      return [];
    }
    var ctx = kontekstIzPodatkov(podatki);
    var seznam = [];
    TONE_IDS.forEach(function (toneId) {
      var bodies = besedilaDe(toneId, ctx);
      var titles = NASLOVI_PREDLOG_SL[toneId] || [];
      for (var i = 0; i < 6; i++) {
        seznam.push({
          id: "sys-" + toneId + "-" + (i + 1),
          toneId: toneId,
          language: "de",
          naslov: titles[i] || "Predloga " + (i + 1),
          besedilo: bodies[i] || "",
          order: i + 1,
          isRecommended: i === 0,
          source: "system",
          jeMoj: false,
          ikona: "message-circle",
          stilIkone: i === 0 ? "krem" : "",
          _iban: ctx.iban,
        });
      }
    });
    return seznam;
  }

  function filtrirajPredloge(seznam, toneId, language) {
    var ton = toneId || "friendly";
    if (root.UJTonPriporocilo && typeof root.UJTonPriporocilo.normalizirajTonId === "function") {
      ton = root.UJTonPriporocilo.normalizirajTonId(ton);
    }
    var lang = language || "de";
    return (seznam || []).filter(function (p) {
      if (!p) return false;
      if (p.jeMoj || p.source === "user") {
        return !p.toneId || p.toneId === ton;
      }
      return p.toneId === ton && (p.language || "de") === lang;
    });
  }

  function sortirajPredlogeZaTon(seznam) {
    return (seznam || [])
      .slice()
      .sort(function (a, b) {
        if (Boolean(a.isRecommended) !== Boolean(b.isRecommended)) {
          return a.isRecommended ? -1 : 1;
        }
        var oa = Number(a.order) || 99;
        var ob = Number(b.order) || 99;
        if (oa !== ob) return oa - ob;
        return String(a.id).localeCompare(String(b.id));
      })
      .map(function (p, indeks) {
        var kopija = Object.assign({}, p);
        kopija.stevilka = Number(p.order) || indeks + 1;
        if (kopija.stevilka > 6) kopija.stevilka = indeks + 1;
        return kopija;
      });
  }

  function naslovRazdelkaZaTon(toneId) {
    var id = toneId;
    if (root.UJTonPriporocilo && typeof root.UJTonPriporocilo.normalizirajTonId === "function") {
      id = root.UJTonPriporocilo.normalizirajTonId(toneId);
    }
    var del = NASLOVI_TONOV_SL[id] || "izbrani ton";
    return "Predloge za " + del;
  }

  function imaPredlogeZaJezik(seznam, toneId, language) {
    return filtrirajPredloge(seznam, toneId, language).length > 0;
  }

  /** Privzeta (zvezdica) predloga znotraj seznama za ton. */
  function najdiPrivzetoPredlogo(seznam) {
    var sortirano = sortirajPredlogeZaTon(seznam);
    return (
      sortirano.find(function (p) {
        return p.isRecommended;
      }) ||
      sortirano[0] ||
      null
    );
  }

  var api = {
    TONE_IDS: TONE_IDS,
    NASLOVI_TONOV_SL: NASLOVI_TONOV_SL,
    sestaviSistemskePredloge: sestaviSistemskePredloge,
    filtrirajPredloge: filtrirajPredloge,
    sortirajPredlogeZaTon: sortirajPredlogeZaTon,
    naslovRazdelkaZaTon: naslovRazdelkaZaTon,
    imaPredlogeZaJezik: imaPredlogeZaJezik,
    najdiPrivzetoPredlogo: najdiPrivzetoPredlogo,
  };

  root.UJTonPredloge = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
