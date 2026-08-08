/* ========== Berljiva priporočila za kartice Rok / Obročno ==========
   Gradivo nad obstoječimi dneviZaTon / predlogObrocnegaZaTon.
   window.UJTonDodatkiPriporocila
   ============================================ */
(function (root) {
  "use strict";

  /** Samo 3 UI toni; ostale ID-je mapiramo na najbližjega. */
  function normalizirajTon(toneId) {
    if (toneId === "strict") return "strict";
    if (toneId === "firm" || toneId === "neutral") return "firm";
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

  var ROK_BESEDILA = {
    friendly: {
      ni_zapadlo:
        "Priporočamo daljši rok plačila (**14 dni**). Račun še ni zapadel – prijazen ton pusti dovolj časa brez pritiska.",
      kratka:
        "Priporočamo daljši rok plačila (**14 dni**). Zamuda je še kratka, zato je smiselnejši prijazen opomin z dovolj časa za poravnavo.",
      srednja:
        "Priporočamo rok plačila **14 dni**. Kljub srednji zamudi prijazen ton ostaja sodelujoč – rok naj bo jasen, a ne preoster.",
      dolga:
        "Priporočamo rok plačila **14 dni**. Tudi pri daljši zamudi prijazen ton ohranja prostor za dogovor; rok naj bo jasen.",
    },
    firm: {
      ni_zapadlo:
        "Priporočamo krajši rok plačila (**7 dni**). Čeprav račun še ni zapadel, odločen ton zahteva jasen in bližnji rok.",
      kratka:
        "Priporočamo krajši rok plačila (**7 dni**), ker je opomin že bolj odločen in pričakuje hitrejši odziv.",
      srednja:
        "Priporočamo rok plačila **7 dni**. Srednja zamuda in odločen ton zahtevata krajši, jasen rok.",
      dolga:
        "Priporočamo rok plačila **7 dni**. Pri daljši zamudi odločen ton drži pritisk z jasnim, kratkim rokom.",
    },
    strict: {
      ni_zapadlo:
        "Priporočamo najkrajši rok plačila (**3 dni**). Strog ton že pred zapadlostjo sporoča, da je rok zavezujoč.",
      kratka:
        "Priporočamo najkrajši rok plačila (**3 dni**), ker gre za strog opomin z jasnim pričakovanjem hitrega plačila.",
      srednja:
        "Priporočamo rok plačila **3 dni**. Srednja zamuda in strog ton zahtevata zelo kratek, nedvoumen rok.",
      dolga:
        "Priporočamo rok plačila **3 dni**. Pri dolgi zamudi strog ton pusti le kratek rok za takojšnje ukrepanje.",
    },
  };

  var OBROCNO_BESEDILA = {
    friendly: {
      ni_zapadlo:
        "Priporočamo obročno plačilo (**4 obroki**). Tudi pred zapadlostjo lahko več manjših zneskov olajša dogovor.",
      kratka:
        "Priporočamo obročno plačilo (**4 obroki**). Pri kratki zamudi in prijaznem tonu so manjši obroki pogosto lažji kot enkratni znesek.",
      srednja:
        "Priporočamo obročno plačilo (**4 obroki**). Pri srednji zamudi razdelitev dolga poveča možnost, da dolžnik začne odplačevati.",
      dolga:
        "Priporočamo obročno plačilo (**4 obroki**). Pri daljši zamudi realen načrt v več obrokih pogosto pomaga prebiti zastoj.",
    },
    firm: {
      ni_zapadlo:
        "Priporočamo kratko obročno (**2 obroka**). Odločen ton ostaja jasen, a še vedno omogoča plačilo v dveh korakih.",
      kratka:
        "Priporočamo obročno plačilo (**2 obroka**). Krajši načrt se ujema z odločnim tonom in pričakovanjem hitrejše ureditve.",
      srednja:
        "Priporočamo obročno plačilo (**2 obroka**). Pri srednji zamudi dva jasna obroka držita pritisk, a olajšata poravnavo.",
      dolga:
        "Priporočamo obročno plačilo (**2 obroka**). Pri daljši zamudi kratek obročni načrt pokaže odločnost in še vedno ponudi pot do plačila.",
    },
    strict: {
      ni_zapadlo:
        "Priporočamo zelo kratek obročni načrt (**2 obroka**). Strog ton dopušča le omejeno razdelitev, ne dolgega odloga.",
      kratka:
        "Priporočamo obročno plačilo (**2 obroka**). Pri strogem opominu sta obroka malo, a jasna – lažje kot celoten znesek naenkrat.",
      srednja:
        "Priporočamo obročno plačilo (**2 obroka**). Srednja zamuda in strog ton: kratek načrt, brez dolgega raztezanja.",
      dolga:
        "Priporočamo obročno plačilo (**2 obroka**). Pri dolgi zamudi strog ton ohrani pritisk; dva obroka sta zadnja praktična možnost pred zaostritvijo.",
    },
  };

  var ZNESEK_DODATEK = {
    nizek: "Pri nizkem znesku obročno ni nujno, a ga lahko vseeno ponudite.",
    srednji: "Pri tem znesku so manjši obroki pogosto bolj izvedljivi.",
    visok: "Pri višjem znesku je obročno plačilo še posebej smiselno.",
  };

  /** **krepko** → <strong> za varen prikaz (samo naše predloge). */
  function oblikujHtml(besedilo) {
    return String(besedilo || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  /**
   * @param {{ toneId: string, overdueDays: number|null, amountCents: number }} vhod
   */
  function sestaviPriporocila(vhod) {
    var Rok = root.UJRokPlacila;
    var ton = normalizirajTon(vhod && vhod.toneId);
    var zamuda = razvrstiZamudo(vhod && vhod.overdueDays);
    var znesek = razvrstiZnesek(vhod && vhod.amountCents);

    var days = Rok && typeof Rok.dneviZaTon === "function" ? Rok.dneviZaTon(ton) : null;
    var predlog =
      Rok && typeof Rok.predlogObrocnegaZaTon === "function"
        ? Rok.predlogObrocnegaZaTon(ton)
        : null;

    var rok = (ROK_BESEDILA[ton] && ROK_BESEDILA[ton][zamuda]) || ROK_BESEDILA.friendly.kratka;
    var obrocnoOsnova =
      (OBROCNO_BESEDILA[ton] && OBROCNO_BESEDILA[ton][zamuda]) ||
      OBROCNO_BESEDILA.friendly.kratka;
    var obrocno = obrocnoOsnova + " " + ZNESEK_DODATEK[znesek];

    // Če se dnevi/št. obrokov iz utils razlikujejo od vpisanih v besedilu,
    // še vedno uporabimo potrjena besedila (so usklajena s privzetimi vrednostmi).
    return {
      toneId: ton,
      zamuda: zamuda,
      znesek: znesek,
      termDays: days,
      installments: predlog ? predlog.installments : null,
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
  };

  root.UJTonDodatkiPriporocila = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
