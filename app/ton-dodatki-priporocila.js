/* ========== Berljiva priporočila za kartice Rok / Obročno ==========
   Gradivo nad obstoječimi dneviZaTon / predlogObrocnegaZaTon.
   window.UJTonDodatkiPriporocila
   ============================================ */
(function (root) {
  "use strict";

  /** 6 UI tonov; ostale ID-je mapiramo na najbližjega. */
  function normalizirajTon(toneId) {
    if (toneId === "super_evil") return "super_evil";
    if (toneId === "super_strict") return "super_strict";
    if (toneId === "strict") return "strict";
    if (toneId === "firm" || toneId === "neutral") return "firm";
    if (toneId === "friendly") return "friendly";
    if (toneId === "super_friendly" || toneId === "very_friendly") return "super_friendly";
    return "friendly";
  }

  /** ni_zapadlo | kratka | srednja | dolga */
  function razvrstiZamudo(overdueDays) {
    if (overdueDays == null || !Number.isFinite(Number(overdueDays))) {
      return "ni_zapadlo";
    }
    var d = Number(overdueDays);
    if (d < 0) return "ni_zapadlo";
    if (d <= 14) return "kratka";
    if (d <= 30) return "srednja";
    return "dolga";
  }

  /** nizek | srednji | visok */
  function razvrstiZnesek(amountCents) {
    var c = Math.round(Number(amountCents) || 0);
    if (c < 10000) return "nizek";
    if (c <= 50000) return "srednji";
    return "visok";
  }

  /* Opisi brez ponavljanja vrednosti (vrednost gre v značko kartice). */
  var ROK_BESEDILA = {
    friendly: {
      ni_zapadlo:
        "Račun še ni zapadel. Prijazen ton dopušča nekoliko daljši rok plačila.",
      kratka:
        "Zamuda je še kratka. Prijazen ton pusti dovolj časa za poravnavo brez pritiska.",
      srednja:
        "Kljub srednji zamudi prijazen ton ostaja sodelujoč – rok naj bo jasen, a ne preoster.",
      dolga:
        "Tudi pri daljši zamudi prijazen ton ohranja prostor za dogovor; rok naj bo jasen.",
    },
    firm: {
      ni_zapadlo:
        "Čeprav račun še ni zapadel, odločen ton zahteva jasen in bližnji rok.",
      kratka:
        "Opomin je že bolj odločen in pričakuje hitrejši odziv.",
      srednja:
        "Srednja zamuda in odločen ton zahtevata krajši, jasen rok.",
      dolga:
        "Pri daljši zamudi odločen ton drži pritisk z jasnim, kratkim rokom.",
    },
    strict: {
      ni_zapadlo:
        "Strog ton že pred zapadlostjo sporoča, da je rok zavezujoč.",
      kratka:
        "Strog opomin pričakuje hitro plačilo z jasnim, kratkim rokom.",
      srednja:
        "Srednja zamuda in strog ton zahtevata zelo kratek, nedvoumen rok.",
      dolga:
        "Pri dolgi zamudi strog ton pusti le kratek rok za takojšnje ukrepanje.",
    },
  };

  var OBROCNO_BESEDILA = {
    friendly: {
      ni_zapadlo:
        "Tudi pred zapadlostjo lahko večji znesek olajša dogovor.",
      kratka:
        "Pri kratki zamudi in prijaznem tonu so manjši obroki pogosto lažji kot enkratni znesek.",
      srednja:
        "Pri srednji zamudi razdelitev dolga poveča možnost, da dolžnik začne odplačevati.",
      dolga:
        "Pri daljši zamudi realen načrt v več obrokih pogosto pomaga prebiti zastoj.",
    },
    firm: {
      ni_zapadlo:
        "Odločen ton ostaja jasen, a še vedno omogoča plačilo v manj korakih.",
      kratka:
        "Krajši načrt se ujema z odločnim tonom in pričakovanjem hitrejše ureditve.",
      srednja:
        "Pri srednji zamudi kratek načrt drži pritisk, a olajša poravnavo.",
      dolga:
        "Pri daljši zamudi kratek obročni načrt pokaže odločnost in še vedno ponudi pot do plačila.",
    },
    strict: {
      ni_zapadlo:
        "Strog ton dopušča le omejeno razdelitev, ne dolgega odloga.",
      kratka:
        "Pri strogem opominu so obroki malo, a jasni – lažje kot celoten znesek naenkrat.",
      srednja:
        "Srednja zamuda in strog ton: kratek načrt, brez dolgega raztezanja.",
      dolga:
        "Pri dolgi zamudi strog ton ohrani pritisk; kratek načrt je zadnja praktična možnost pred zaostritvijo.",
    },
  };

  var ZNESEK_DODATEK = {
    nizek: "Pri nizkem znesku obročno plačilo ni nujno.",
    srednji: "Pri tem znesku so manjši obroki pogosto bolj izvedljivi.",
    visok: "Pri višjem znesku je obročno plačilo še posebej smiselno.",
  };

  function oblikujHtml(besedilo) {
    return String(besedilo || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function oznakaDni(n) {
    var d = Number(n);
    if (!Number.isFinite(d) || d <= 0) d = 14;
    return d + " dni";
  }

  function oznakaObrokov(n) {
    var c = Number(n);
    if (!Number.isFinite(c) || c < 1) c = 4;
    if (c === 1) return "1 obrok";
    if (c === 2) return "2 obroka";
    if (c === 3 || c === 4) return c + " obroki";
    return c + " obrokov";
  }

  /**
   * @param {{ toneId: string, overdueDays: number|null, amountCents: number }} vhod
   */
  function sestaviPriporocila(vhod) {
    var Rok = root.UJRokPlacila;
    var ton = normalizirajTon(vhod && vhod.toneId);
    var zamuda = razvrstiZamudo(vhod && vhod.overdueDays);
    var znesek = razvrstiZnesek(vhod && vhod.amountCents);

    var days =
      Rok && typeof Rok.dneviZaTon === "function" ? Rok.dneviZaTon(ton) : 14;
    var predlog =
      Rok && typeof Rok.predlogObrocnegaZaTon === "function"
        ? Rok.predlogObrocnegaZaTon(ton)
        : null;
    var installments = predlog && predlog.installments ? predlog.installments : 4;

    var rok = (ROK_BESEDILA[ton] && ROK_BESEDILA[ton][zamuda]) || ROK_BESEDILA.friendly.kratka;
    var obrocnoOsnova =
      (OBROCNO_BESEDILA[ton] && OBROCNO_BESEDILA[ton][zamuda]) ||
      OBROCNO_BESEDILA.friendly.kratka;
    var obrocno = obrocnoOsnova + " " + ZNESEK_DODATEK[znesek];

    return {
      toneId: ton,
      zamuda: zamuda,
      znesek: znesek,
      termDays: days,
      installments: installments,
      rokValueLabel: oznakaDni(days),
      obrocnoValueLabel: oznakaObrokov(installments),
      rokText: rok,
      obrocnoText: obrocno,
      rokHtml: oblikujHtml(rok),
      obrocnoHtml: oblikujHtml(obrocno),
    };
  }

  var api = {
    normalizirajTon: normalizirajTon,
    razvrstiZamudo: razvrstiZamudo,
    razvrstiZnesek: razvrstiZnesek,
    sestaviPriporocila: sestaviPriporocila,
    oblikujHtml: oblikujHtml,
    oznakaDni: oznakaDni,
    oznakaObrokov: oznakaObrokov,
  };

  root.UJTonDodatkiPriporocila = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
