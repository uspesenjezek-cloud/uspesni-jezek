/* ========== Načrt opominjanja (korak 3) – podatkovna plast ==========
   window.UJOpominNacrt – brez DOM klicev.
   ============================================ */
(function (root) {
  "use strict";

  var KLJUC_SEJE = "neplacilo-korak3-nacrt";

  var ODMKI_BAZA = {
    super_evil: [0, 3, 6, 10, 14, 18, 22, 26, 30, 34],
    super_strict: [0, 5, 11, 17, 24, 30, 36, 42, 48, 54],
    strict: [0, 6, 13, 20, 28, 36, 44, 52, 60, 68],
    firm: [0, 8, 17, 26, 34, 42, 50, 58, 66, 74],
    friendly: [0, 11, 22, 30, 38, 46, 54, 62, 70, 78],
    super_friendly: [0, 14, 28, 36, 44, 52, 60, 68, 76, 84],
  };

  var KORAKI_META = [
    {
      order: 1,
      type: "friendly_reminder",
      title: "Prijazen opomin",
      toneId: "friendly",
      deliveryMode: "automatic",
    },
    {
      order: 2,
      type: "firm_reminder",
      title: "Odločen opomin",
      toneId: "firm",
      deliveryMode: "automatic",
    },
    {
      order: 3,
      type: "strict_reminder",
      title: "Strog opomin",
      toneId: "strict",
      deliveryMode: "automatic",
    },
    {
      order: 4,
      type: "strict_reminder",
      title: "Dodaten odločen opomin",
      toneId: "strict",
      deliveryMode: "automatic",
    },
    {
      order: 5,
      type: "final_reminder",
      title: "Zadnji formalni opomin",
      toneId: "strict",
      deliveryMode: "automatic",
    },
    {
      order: 6,
      type: "final_reminder",
      title: "Zadnji formalni opomin",
      toneId: "strict",
      deliveryMode: "automatic",
    },
    {
      order: 7,
      type: "final_reminder",
      title: "Dodaten formalni opomin",
      toneId: "strict",
      deliveryMode: "automatic",
    },
    {
      order: 8,
      type: "final_reminder",
      title: "Resen opomin",
      toneId: "strict",
      deliveryMode: "automatic",
    },
    {
      order: 9,
      type: "final_reminder",
      title: "Predzadnji opomin",
      toneId: "strict",
      deliveryMode: "automatic",
    },
    {
      order: 10,
      type: "lawyer_handoff",
      title: "Predaja odvetniku",
      toneId: null,
      deliveryMode: "manual",
    },
  ];

  /* Tri kratke poti na zadnjem koraku. `totalSteps` vključuje tudi stalni
     zadnji korak ročne predaje odvetniku. */
  var PRISTOPI_IZTERJAVE = [
    {
      id: "postopno",
      label: "Postopno",
      description: "Več časa za dogovor",
      totalSteps: 6,
    },
    {
      id: "uravnotezeno",
      label: "Uravnoteženo",
      description: "Jasen ritem in pritisk",
      totalSteps: 5,
    },
    {
      id: "odlocno",
      label: "Odločno",
      description: "Hitrejša eskalacija",
      totalSteps: 4,
    },
  ];

  var TON_OZNAKE_SL = {
    super_evil: "Super zloben",
    super_strict: "Super strog",
    strict: "Strog",
    firm: "Odločen",
    friendly: "Prijazen",
    super_friendly: "Super prijazen",
    neutral: "Odločen",
  };

  var VELJAVNI_TONI_KORAKA = [
    "super_friendly",
    "friendly",
    "firm",
    "strict",
    "super_strict",
    "super_evil",
  ];

  var BARVE_KORAKA_PO_MERI = [
    { id: "mint", label: "Mint", hex: "#55b99a", toneId: "super_friendly", level: 1 },
    { id: "green", label: "Zelena", hex: "#76aa57", toneId: "friendly", level: 2 },
    { id: "lime", label: "Limeta", hex: "#a8b84c", toneId: "friendly", level: 2 },
    { id: "yellow", label: "Rumena", hex: "#d2aa2e", toneId: "firm", level: 3 },
    { id: "amber", label: "Jantarna", hex: "#d58b2d", toneId: "firm", level: 5 },
    { id: "orange", label: "Oranžna", hex: "#ce7138", toneId: "strict", level: 6 },
    { id: "peach", label: "Breskova", hex: "#d9875b", toneId: "strict", level: 6 },
    { id: "coral", label: "Koralna", hex: "#cb6158", toneId: "super_strict", level: 8 },
    { id: "red", label: "Rdeča", hex: "#b74954", toneId: "super_evil", level: 9 },
    { id: "rose", label: "Vinsko rožnata", hex: "#b85e73", toneId: "super_strict", level: 8 },
    { id: "pink", label: "Rožnata", hex: "#bf5c88", toneId: "firm", level: 8 },
    { id: "magenta", label: "Magenta", hex: "#a95d9a", toneId: "firm", level: 7 },
    { id: "purple", label: "Vijolična", hex: "#8762aa", toneId: "firm", level: 8 },
    { id: "indigo", label: "Indigo", hex: "#6672b5", toneId: "friendly", level: 4 },
    { id: "blue", label: "Modra", hex: "#4e84bd", toneId: "friendly", level: 2 },
    { id: "sky", label: "Nebesno modra", hex: "#4e9fbe", toneId: "friendly", level: 2 },
    { id: "aqua", label: "Akvamarin", hex: "#35a6a0", toneId: "friendly", level: 1 },
    { id: "teal", label: "Turkizna", hex: "#168f90", toneId: "friendly", level: 1 },
    { id: "emerald", label: "Smaragdna", hex: "#3f9d73", toneId: "friendly", level: 2 },
    { id: "forest", label: "Temno zelena", hex: "#3f8768", toneId: "friendly", level: 2 },
  ];

  function normalizirajHexBarvo(value, fallback) {
    var hex = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : String(fallback || "#55b99a");
  }

  /* Deset kartic za preoblikovanje izbranega opomina. Več kartic lahko
     namenoma uporablja isti ton; razlikujejo se po mestu in predlogi
     besedila, zato uporabnik ni omejen na en primerek posameznega tona. */
  var PREDLOGE_PREOBLIKOVANJA = [
    { id: "card-1", title: "Prijazen opomin", toneId: "super_friendly", messageIndex: 1 },
    { id: "card-2", title: "Prijazen opomin", toneId: "friendly", messageIndex: 1 },
    { id: "card-3", title: "Odločen opomin", toneId: "firm", messageIndex: 2 },
    { id: "card-4", title: "Strog opomin", toneId: "strict", messageIndex: 3 },
    { id: "card-5", title: "Zadnji opomin", toneId: "super_strict", messageIndex: 5 },
    { id: "card-6", title: "Odločen opomin", toneId: "firm", messageIndex: 4 },
    { id: "card-7", title: "Strog opomin", toneId: "strict", messageIndex: 4 },
    { id: "card-8", title: "Formalni opomin", toneId: "strict", messageIndex: 5 },
    { id: "card-9", title: "Zadnji formalni opomin", toneId: "super_strict", messageIndex: 5 },
    { id: "card-10", title: "Zelo strog opomin", toneId: "super_evil", messageIndex: 5 },
  ];

  function zdajIso() {
    return new Date().toISOString();
  }

  function minuteIzUre(value) {
    var m = String(value || "").match(/^(\d{2}):(\d{2})$/);
    if (!m) return null;
    var ura = Number(m[1]);
    var minuta = Number(m[2]);
    if (ura > 23 || minuta > 59) return null;
    return ura * 60 + minuta;
  }

  function normalizirajDovoljenoOkno(value) {
    var start = value && value.start;
    var end = value && value.end;
    var startMinute = minuteIzUre(start);
    var endMinute = minuteIzUre(end);
    if (startMinute == null || endMinute == null || endMinute <= startMinute) {
      return { start: "07:00", end: "21:00" };
    }
    return { start: String(start), end: String(end) };
  }

  function dovoljenoOknoZaKorak(plan, stepOrIndex) {
    var step =
      stepOrIndex && typeof stepOrIndex === "object"
        ? stepOrIndex
        : najdiKorak(plan, stepOrIndex);
    var loceno = Boolean(
      plan &&
        (plan.allowedSendWindowMode === "per_step" ||
          (plan.allowedSendWindowMode == null && step && step.allowedSendWindow))
    );
    return normalizirajDovoljenoOkno(
      (loceno && step && step.allowedSendWindow) ||
        (plan && plan.allowedSendWindow)
    );
  }

  function normalizirajNacinDovoljenegaOkna(plan) {
    if (plan && plan.allowedSendWindowMode === "per_step") return "per_step";
    if (plan && plan.allowedSendWindowMode === "all") return "all";
    return plan && (plan.steps || []).some(function (step) {
      return Boolean(step && step.allowedSendWindow);
    })
      ? "per_step"
      : "all";
  }

  function jeUraVDovoljenemOkvirju(plan, iso, stepOrIndex) {
    var datum = new Date(iso);
    if (Number.isNaN(datum.getTime())) return false;
    var okno = dovoljenoOknoZaKorak(plan, stepOrIndex);
    var minute = datum.getHours() * 60 + datum.getMinutes();
    return minute >= minuteIzUre(okno.start) && minute <= minuteIzUre(okno.end);
  }

  function nastaviDovoljenoOkno(plan, start, end, opts) {
    if (!plan) return plan;
    var startMinute = minuteIzUre(start);
    var endMinute = minuteIzUre(end);
    if (startMinute == null || endMinute == null || endMinute <= startMinute) {
      return plan;
    }
    plan.allowedSendWindow = { start: String(start), end: String(end) };
    plan._randomScheduleDefaults = Object.assign(
      {},
      plan._randomScheduleDefaults || {},
      { minSendTime: String(start), maxSendTime: String(end) }
    );
    var ohraniIzjeme = Boolean(opts && opts.ohraniIzjeme);
    if (!ohraniIzjeme) plan.allowedSendWindowMode = "all";
    (plan.steps || []).forEach(function (step) {
      if (!ohraniIzjeme) delete step.allowedSendWindow;
      if (ohraniIzjeme && step.allowedSendWindow) return;
      if (step._randomSchedule) {
        step._randomSchedule.minSendTime = String(start);
        step._randomSchedule.maxSendTime = String(end);
        step._randomSchedule.resolvedScheduledAt = null;
        step._randomSchedule.resolvedAt = null;
        delete step._randomSchedule._previewResolvedAt;
        delete step._randomSchedule._previewGeneratedAt;
        delete step._randomSchedule._previewBaseAt;
        if (step._randomSchedule.enabled) oznaciNeedsReview(step);
      }
      if (
        !step.isExcluded &&
        step.kind !== "manual_lawyer" &&
        step.deliveryMode !== "manual" &&
        step.status !== "sent" &&
        !jeUraVDovoljenemOkvirju(plan, step.sendAt || step.scheduledAt)
      ) {
        oznaciNeedsReview(step);
      }
    });
    return osveziPlanStatus(plan);
  }

  function nastaviDovoljenoOknoKoraka(plan, index, start, end) {
    if (!plan) return plan;
    var step = najdiKorak(plan, index);
    var startMinute = minuteIzUre(start);
    var endMinute = minuteIzUre(end);
    if (
      !step ||
      step.kind === "manual_lawyer" ||
      step.deliveryMode === "manual" ||
      startMinute == null ||
      endMinute == null ||
      endMinute <= startMinute
    ) {
      return plan;
    }
    plan.allowedSendWindowMode = "per_step";
    step.allowedSendWindow = { start: String(start), end: String(end) };
    if (step._randomSchedule) {
      step._randomSchedule.minSendTime = String(start);
      step._randomSchedule.maxSendTime = String(end);
      step._randomSchedule.resolvedScheduledAt = null;
      step._randomSchedule.resolvedAt = null;
      delete step._randomSchedule._previewResolvedAt;
      delete step._randomSchedule._previewGeneratedAt;
      delete step._randomSchedule._previewBaseAt;
      if (step._randomSchedule.enabled) oznaciNeedsReview(step);
    }
    if (
      !step.isExcluded &&
      step.status !== "sent" &&
      !jeUraVDovoljenemOkvirju(
        plan,
        step.sendAt || step.scheduledAt,
        step
      )
    ) {
      oznaciNeedsReview(step);
    }
    return osveziPlanStatus(plan);
  }

  function eurosToCents(euros) {
    var n = Number(euros);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function izracunajZamudoDni(datumZapadlosti) {
    if (!datumZapadlosti) return 0;
    var due = new Date(String(datumZapadlosti) + "T12:00:00");
    if (Number.isNaN(due.getTime())) return 0;
    var danes = new Date();
    danes.setHours(12, 0, 0, 0);
    return Math.max(0, Math.floor((danes.getTime() - due.getTime()) / 86400000));
  }

  function preberiTonIzKorak2(podatkiKorak2) {
    var tr =
      podatkiKorak2 && podatkiKorak2.toneRecommendation
        ? podatkiKorak2.toneRecommendation
        : null;
    var raw =
      (tr && (tr.appliedToneId || tr.selectedToneId)) ||
      (podatkiKorak2 && podatkiKorak2.izbranTonId) ||
      "friendly";
    var UJ = root.UJTonDodatkiPriporocila;
    if (UJ && typeof UJ.normalizirajTon === "function") {
      return UJ.normalizirajTon(raw);
    }
    if (raw === "strict") return "strict";
    if (raw === "firm" || raw === "neutral") return "firm";
    return "friendly";
  }

  function oznakaTona(toneId) {
    return TON_OZNAKE_SL[toneId] || "Izbrani ton";
  }

  function izracunajHash(deli) {
    var s = Array.isArray(deli) ? deli.join("|") : String(deli || "");
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h.toString(16) + ":" + s.length;
  }

  function vhodniHash(amountCents, toneId, overdueDays) {
    return izracunajHash([
      String(amountCents),
      String(toneId),
      String(overdueDays),
    ]);
  }

  /** Hash podatkov o dolžniku, ki jih hrani preparedSnapshot (glej
      sestaviPreparedSnapshot). NAMENOMA ločen od vhodniHash: vhodniHash krmili
      PRERAČUN DATUMOV pošiljanja, ta pa samo RAZVELJAVITEV potrditev in
      posnetka predaje.

      Če bi ta polja dodali v vhodniHash, bi že preimenovanje dolžnika padlo v
      vejo, ki na novo izračuna sendAt vseh korakov, ponastavi
      manualScheduleOverride in razveljavi Random čase – uporabniku bi torej
      pobrisalo ročni urnik. */
  function identitetniDel(vrednost) {
    if (vrednost == null) return "";
    if (typeof vrednost === "number" && !isFinite(vrednost)) return "";
    return String(vrednost);
  }

  /* Vrstni red polj mora biti ENAK v identitetniHash in
     identitetniHashIzPosnetka, sicer se hasha nikoli ne ujemata. */
  function identitetniHashIzDelov(deli) {
    return izracunajHash(deli.map(identitetniDel));
  }

  function identitetniHash(podatkiKorak1, amountCents) {
    var k1 = podatkiKorak1 || {};
    return identitetniHashIzDelov([
      k1.imeDolznika,
      k1.vrstaDolznika,
      k1.davcnaStevilka,
      k1.kontaktnaOseba,
      k1.telefonDolznika,
      k1.emailDolznika,
      amountCents,
      k1.stevilkaRacuna,
      k1.datumZapadlosti,
    ]);
  }

  /** Isti hash, izračunan iz že shranjenega preparedSnapshot. Potrebujemo ga za
      načrte, ki so nastali PRED uvedbo plan.identityHash: pri njih je
      identityHash prazen, zato ne bi vedeli, ali so se podatki po pripravi
      predaje spremenili. S primerjavo s posnetkom to ugotovimo natančno,
      namesto da bi vse stare načrte po vrsti označili kot needs_review. */
  function identitetniHashIzPosnetka(snapshot) {
    var d = (snapshot && snapshot.dolznik) || null;
    if (!d) return null;
    return identitetniHashIzDelov([
      d.ime,
      d.vrsta,
      d.davcnaStevilka,
      d.kontaktnaOseba,
      d.telefon,
      d.email,
      d.znesekCentov,
      d.stevilkaRacuna,
      d.datumZapadlosti,
    ]);
  }

  function korakSnapshotHash(step) {
    return izracunajHash([
      String(step.sendAt || ""),
      String(step.scheduledOffsetDays),
      String(step.toneId || ""),
      String(step.templateId || ""),
      JSON.stringify(step.paymentDeadline || null),
      JSON.stringify(step.installment || null),
      JSON.stringify(step.bankTransfer || null),
      String(step.finalMessage || ""),
    ]);
  }

  function izracunajOdmike(toneId, overdueDays, amountCents) {
    var UJ = root.UJTonDodatkiPriporocila;
    var ton = toneId;
    if (UJ && typeof UJ.normalizirajTon === "function") {
      ton = UJ.normalizirajTon(toneId);
    }
    var baza = (ODMKI_BAZA[ton] || ODMKI_BAZA.friendly).slice();
    var zamuda = "kratka";
    var znesek = "nizek";
    if (UJ) {
      if (typeof UJ.razvrstiZamudo === "function") {
        zamuda = UJ.razvrstiZamudo(overdueDays);
      }
      if (typeof UJ.razvrstiZnesek === "function") {
        znesek = UJ.razvrstiZnesek(amountCents);
      }
    }

    var out = baza.slice(0, KORAKI_META.length);

    if (zamuda === "dolga") {
      for (var i = 1; i < out.length; i++) {
        out[i] = Math.max(i, Math.round(out[i] * 0.7));
      }
    }

    if (znesek === "visok") {
      var razmik23 = out[2] - out[1];
      out[2] = out[1] + Math.max(2, Math.round(razmik23 * 0.75));
    }

    for (var j = 1; j < out.length; j++) {
      if (out[j] <= out[j - 1]) out[j] = out[j - 1] + 2;
    }
    return out;
  }

  function sestaviRazlog(amountCents, overdueDays, toneId) {
    var znesek =
      ((Number(amountCents) || 0) / 100).toLocaleString("sl-SI", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " €";
    var ton = oznakaTona(toneId).toLowerCase();
    return (
      "Časovnica je predlagana glede na znesek dolga (" +
      znesek +
      "), " +
      overdueDays +
      " dni zamude, izbrani ton (" +
      ton +
      ") in pretek poteka opominjanja."
    );
  }

  function formatirajZnesekDe(cents) {
    var euros = (Number(cents) || 0) / 100;
    return (
      euros.toLocaleString("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " €"
    );
  }

  function privzetiSendAt(offsetDays, osnovniIso) {
    var dni = Number(offsetDays) || 0;
    var d = osnovniIso ? new Date(osnovniIso) : new Date();
    if (Number.isNaN(d.getTime())) d = new Date();
    /* Vsi naslednji koraki privzeto podedujejo uro prvega koraka. Priporočila
       jo lahko pozneje namensko spremenijo. */
    d.setDate(d.getDate() + dni);
    return d.toISOString();
  }

  /** Lokalni koledarski datum YYYY-MM-DD (časovni pas naprave / podjetja). */
  function formatLocalYYYYMMDD(dt) {
    var y = dt.getFullYear();
    var m = String(dt.getMonth() + 1).padStart(2, "0");
    var d = String(dt.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function parseLocalDateTime(isoOrLocal) {
    if (!isoOrLocal) return null;
    var dt = new Date(isoOrLocal);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  /** Koledarska razlika v dnevih (B − A), ne milisekunde / 86400000. */
  function koledarskiDneviMed(isoA, isoB) {
    var a = parseLocalDateTime(isoA);
    var b = parseLocalDateTime(isoB);
    if (!a || !b) return null;
    var da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    var db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  }

  function dodajKoledarskeDniInCas(iso, deltaDni, deltaMsCas) {
    var d = parseLocalDateTime(iso);
    if (!d) return null;
    var out = new Date(d.getTime());
    if (deltaMsCas) out.setTime(out.getTime() + deltaMsCas);
    if (deltaDni) out.setDate(out.getDate() + deltaDni);
    return out.toISOString();
  }

  function slovenskaDniBeseda(n) {
    if (root.UJTonPriporocilo && typeof root.UJTonPriporocilo.slovenskaDniBeseda === "function") {
      return root.UJTonPriporocilo.slovenskaDniBeseda(n);
    }
    var d = Math.abs(Number(n) || 0);
    if (d === 1) return "1 dan";
    if (d === 2) return "2 dni";
    if (d === 3 || d === 4) return d + " dni";
    return d + " dni";
  }

  function oznakaCezDni(n) {
    return "Čez " + slovenskaDniBeseda(n);
  }

  function oznakaPoPrejsnjem(n) {
    return slovenskaDniBeseda(n) + " po prejšnjem koraku";
  }

  function syncScheduledAt(step) {
    if (!step) return step;
    if (step.scheduledAt && !step.sendAt) step.sendAt = step.scheduledAt;
    if (step.sendAt && !step.scheduledAt) step.scheduledAt = step.sendAt;
    if (step.sendAt) step.scheduledAt = step.sendAt;
    return step;
  }

  /** Prestavi korake, ki bi padli na neaktiven dan v tednu (plan._aktivniDnevi),
      na prvi naslednji aktiven dan – in ta zamik VERIŽNO prenese naprej na vse
      naslednje premakljive korake (vsak dobi enak "podedovan" zamik + morda še
      dodaten zamik, če tudi njegov novi datum pade na neaktiven dan).
      Izključeni in nepremakljivi (poslani/preklicani) koraki obdržijo svoj
      datum, a ne prekinejo verige za korake za njimi.
      Idempotentno: vsak klic najprej razveljavi zamik, ki ga je morda dodal
      prejšnji klic (step._preskokDni), zato ponovni klici (npr. po ponovnem
      vklopu dneva) ne kopičijo dni v nedogled, temveč pravilno preračunajo
      od izvirnega (nezamaknjenega) datuma. */
  function uskladiOffseteIzDatumov(plan) {
    var steps = (plan && plan.steps) || [];
    if (!steps.length) return plan;
    var first = steps[0];
    syncScheduledAt(first);
    var baseIso = first.sendAt || first.scheduledAt || privzetiSendAt(0);
    first._preskokDni = 0;

    var aktivniDnevi = plan._aktivniDnevi;
    var prilagodiDneve = Array.isArray(aktivniDnevi) && aktivniDnevi.length === 7 &&
      !aktivniDnevi.every(function (a) { return a; });

    var verizniZamikDni = 0;
    /* Datum (brez ure) prejšnjega OBDELANEGA (ne-izključenega) koraka – dodatna
       spodnja meja za morebitno prilagoditev NAZAJ, da korak nikoli ne pade
       pred prejšnjega (negativen razmik med koraki). */
    var prejsnjiKoncniDatumMs = (function () {
      var d = new Date(baseIso);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();

    steps.forEach(function (s, i) {
      if (i === 0) {
        var off0 = koledarskiDneviMed(baseIso, baseIso);
        s.scheduledOffsetDays = off0 == null ? 0 : off0;
        s.offsetDays = s.scheduledOffsetDays;
        return;
      }
      syncScheduledAt(s);
      var trenutniIso = s.sendAt || s.scheduledAt;
      var trenutniDatum = new Date(trenutniIso);
      if (Number.isNaN(trenutniDatum.getTime())) return;

      if (s.isExcluded || !jeKorakPremakljiv(s)) {
        /* Ne premikamo datuma (izključen ali fiksen/zgodovinski korak), a
           veriga se nadaljuje – naslednji premakljiv korak dobi enak
           podedovan zamik, kot da tega koraka ne bi bilo. */
        var offFix = koledarskiDneviMed(baseIso, trenutniIso);
        s.scheduledOffsetDays = offFix == null ? (Number(s.scheduledOffsetDays) || 0) : offFix;
        s.offsetDays = s.scheduledOffsetDays;
        if (!s.isExcluded) {
          var dZacetek = new Date(trenutniDatum.getTime());
          dZacetek.setHours(0, 0, 0, 0);
          prejsnjiKoncniDatumMs = dZacetek.getTime();
        }
        return;
      }

      /* "Čist" (nezamaknjen) datum tega koraka – odštejemo zamik, ki ga je
         morda dodal prejšnji klic te funkcije. */
      var prejsnjiPreskok = Number(s._preskokDni) || 0;
      var cistDatum = new Date(trenutniDatum.getTime() - prejsnjiPreskok * 86400000);
      var kandidat = new Date(cistDatum.getTime() + verizniZamikDni * 86400000);

      var pristej = 0;
      if (prilagodiDneve) {
        var dan = kandidat.getDay();
        var sloIdx = dan === 0 ? 6 : dan - 1;
        if (!aktivniDnevi[sloIdx]) {
          /* Smer prilagoditve sledi predznaku prejšnjega zamika tega koraka
             (npr. če je bil korak ravnokar ročno pomaknjen nazaj prek "−",
             ostane prilagojen nazaj – sicer bi ga kaskada spet poskočila
             naprej in izničila uporabnikov klik). */
          var smerNazaj = prejsnjiPreskok < 0;
          for (var adj = 1; adj <= 7; adj++) {
            var ni = smerNazaj ? (sloIdx - adj + 7) % 7 : (sloIdx + adj) % 7;
            if (aktivniDnevi[ni]) { pristej = adj; break; }
          }
          var poskusniKandidat = new Date(kandidat.getTime());
          poskusniKandidat.setDate(
            poskusniKandidat.getDate() + (smerNazaj ? -pristej : pristej)
          );
          /* Nazaj nikoli pred danes IN nikoli pred prejšnjim korakom –
             sicer bi lahko razmik med koraki postal negativen. */
          if (
            smerNazaj &&
            (poskusniKandidat.getTime() < danesZacetekSafe() ||
              poskusniKandidat.getTime() < prejsnjiKoncniDatumMs)
          ) {
            smerNazaj = false;
            for (var adjF = 1; adjF <= 7; adjF++) {
              var niF = (sloIdx + adjF) % 7;
              if (aktivniDnevi[niF]) { pristej = adjF; break; }
            }
            poskusniKandidat = new Date(kandidat.getTime());
            poskusniKandidat.setDate(poskusniKandidat.getDate() + pristej);
          }
          kandidat = poskusniKandidat;
          pristej = smerNazaj ? -pristej : pristej;
        }
      }

      var noviZamik = verizniZamikDni + pristej;
      var novIso = kandidat.toISOString();
      s.sendAt = novIso;
      s.scheduledAt = novIso;
      s._preskokDni = noviZamik;

      var off = koledarskiDneviMed(baseIso, novIso);
      s.scheduledOffsetDays = off == null ? (Number(s.scheduledOffsetDays) || 0) : off;
      s.offsetDays = s.scheduledOffsetDays;

      verizniZamikDni = noviZamik;
      var dZacetekTega = new Date(kandidat.getTime());
      dZacetekTega.setHours(0, 0, 0, 0);
      prejsnjiKoncniDatumMs = dZacetekTega.getTime();
    });

    var last = steps[steps.length - 1];
    plan.totalDurationDays = last ? last.scheduledOffsetDays : plan.totalDurationDays;
    return plan;
  }

  function jeKorakPremakljiv(step) {
    if (!step) return false;
    if (step.status === "sent" || step.status === "cancelled") return false;
    return true;
  }

  function sestaviGeneratedMessage(index, ctx) {
    var ime = String(ctx.imeDolznika || "Kunde").trim() || "Kunde";
    var znesek = formatirajZnesekDe(ctx.amountCents);
    var stevilka = ctx.stevilkaRacuna
      ? " Nr. " + String(ctx.stevilkaRacuna).trim()
      : "";

    if (index === 1) {
      var izKorak2 = String(ctx.sporociloDolzniku || "").trim();
      if (izKorak2) return izKorak2;
      return (
        "Guten Tag, wir erinnern freundlich an die offene Rechnung" +
        stevilka +
        " über " +
        znesek +
        ". Bitte begleichen Sie den Betrag zeitnah. Danke."
      );
    }
    if (index === 2) {
      return (
        "Guten Tag " +
        ime +
        ", trotz vorheriger Erinnerung ist die Rechnung" +
        stevilka +
        " über " +
        znesek +
        " noch offen. Bitte zahlen Sie umgehend."
      );
    }
    if (index === 3) {
      return (
        "Letzte Mahnung: Die Rechnung" +
        stevilka +
        " über " +
        znesek +
        " ist weiterhin unbezahlt. Ohne Zahlung behalten wir uns weitere Schritte vor."
      );
    }
    if (index === 4) {
      return (
        "Guten Tag " +
        ime +
        ", die Rechnung" +
        stevilka +
        " über " +
        znesek +
        " bleibt unbezahlt. Wir bitten Sie dringend um Begleichung, um weitere rechtliche Schritte abzuwenden."
      );
    }
    if (index >= 5) {
      return (
        "Letzte Aufforderung: Rechnung" +
        stevilka +
        " über " +
        znesek +
        " ist noch offen. Bei Nichtzahlung werden wir die Angelegenheit an unseren Rechtsbeistand übergeben."
      );
    }
    return "";
  }

  var VELJAVNI_NAMENI_PREDAJE = ["review", "debt_collection", "legal_proceedings"];

  /** Avtoritativna stanja odziva dolžnika za snapshot.responseStatus – glej
      sestaviPreparedSnapshot. Nikoli se ne sme sklepati "no_response" samo iz
      števila poslanih opominov; vrednost pride izključno iz plan.debtorResponseStatus
      / plan.paymentStatus (če ju kdaj zapiše zunanji sistem), sicer "unknown". */
  var VELJAVNI_ODZIVI_DOLZNIKA = [
    "unknown",
    "no_response",
    "responded",
    "partially_paid",
    "paid",
  ];

  /** Slovenska sklanjatev: oblike = [ena, dve, tri_do_stiri, pet_in_vec].
      Uporablja ostanek n % 100, zato pravilno obravnava tudi 11/12 (padeta v
      "pet_in_vec", ne v ednino/dvojino) in sestavljena števila kot 21/101
      (ostanek === 1 -> ednina, kot v knjižni slovenščini). */
  function slovenskaOblika(n, oblike) {
    var ostanek = Math.abs(n) % 100;
    if (ostanek === 1) return oblike[0];
    if (ostanek === 2) return oblike[1];
    if (ostanek === 3 || ostanek === 4) return oblike[2];
    return oblike[3];
  }

  function stevecPoslanih(n) {
    return n + " " + slovenskaOblika(n, ["poslan", "poslana", "poslani", "poslanih"]);
  }

  function stevecNacrtovanih(n) {
    return n + " " + slovenskaOblika(n, ["načrtovan", "načrtovana", "načrtovani", "načrtovanih"]);
  }

  function stevecZapisov(n) {
    return n + " " + slovenskaOblika(n, ["zapis", "zapisa", "zapisi", "zapisov"]);
  }

  function stevecDokumentov(n) {
    return n + " " + slovenskaOblika(n, ["dokument", "dokumenta", "dokumenti", "dokumentov"]);
  }

  function stevecDatotek(n) {
    return n + " " + slovenskaOblika(n, ["datoteka", "datoteki", "datoteke", "datotek"]);
  }

  /** Kratko stabilno besedilo za števec datotek na ploščici: 0 → "Ni datotek",
      1 → "1 datoteka", 2 → "2 datoteki", 3/4 → "3 datoteke", 5+ → "5 datotek". */
  function besediloStevilaDatotek(n) {
    if (!n) return "Ni datotek";
    return stevecDatotek(n);
  }

  function opisDogodkaPredNacrtom(dogodek) {
    var d = dogodek || {};
    var nastavitve = d.settings || {};
    var tip = String(d.tip || d.razred || d.actionType || "");
    var znesek = Number(
      d.znesek != null ? d.znesek
        : nastavitve.paymentAmount != null ? nastavitve.paymentAmount
        : nastavitve.amount != null ? nastavitve.amount
        : nastavitve.settlementAmount
    );
    var znesekBesedilo = Number.isFinite(znesek) && znesek > 0
      ? " v višini " + formatirajZnesekDe(Math.round(znesek * 100))
      : "";
    var naciniPlacila = { bank_transfer: "z bančnim nakazilom", cash: "z gotovino", card: "s kartico", direct_debit: "z direktno obremenitvijo", other: "na drug način" };
    var nacinBesedilo = naciniPlacila[nastavitve.paymentMethod] ? " " + naciniPlacila[nastavitve.paymentMethod] : "";
    if (tip === "partial" || tip === "delno") return "Račun je bil delno poravnan" + znesekBesedilo + nacinBesedilo + ".";
    if (tip === "installment" || tip === "obrok") return "Plačan je bil obrok" + znesekBesedilo + nacinBesedilo + ".";
    if (tip === "payment_promised" || tip === "obljuba") return "Dolžnik je obljubil plačilo.";
    if (tip === "credit_note" || tip === "dobropis") return "Izdan je bil dobropis" + znesekBesedilo + ".";
    if (tip === "compensation" || tip === "kompenzacija") return "Izvedena je bila kompenzacija" + znesekBesedilo + ".";
    if (tip === "cancelled_invoice" || tip === "storno") return "Račun je bil odpisan oziroma storniran.";
    if (tip === "debtor_statement" || tip === "izjava") return "Dolžnik je izjavil: " + String(nastavitve.description || d.naslov || "").replace(/^Izjava dolžnika:\s*/i, "").replace(/[.!?]+$/, "") + ".";
    var opis = String(nastavitve.description || d.naslov || "").trim();
    if (!opis) return "Zabeležen je bil dodaten dogodek pri računu.";
    return /[.!?]$/.test(opis) ? opis : opis + ".";
  }

  function povzetekDogodkovPredNacrtom(ctx) {
    var dogodki = Array.isArray(ctx && ctx.historyBeforePlan) ? ctx.historyBeforePlan.filter(Boolean) : [];
    return dogodki.map(opisDogodkaPredNacrtom).join(" ");
  }

  /** Samodejno besedilo za "Sporočilo odvetniku" – odvisno od izbranega
      namena predaje. Kliče se le, dokler uporabnik sporočila ni ročno
      popravil (lawyerHandoff.messageEditedManually). */
  function sestaviSporociloOdvetniku(requestedAction, ctx) {
    var ime = String((ctx && ctx.imeDolznika) || "").trim() || "dolžnika";
    var znesek = formatirajZnesekDe((ctx && ctx.amountCents) || 0);
    var povzetekDogodkov = povzetekDogodkovPredNacrtom(ctx);
    var zgodovinaBesedilo = povzetekDogodkov
      ? " Pred začetkom postopka se je pri računu zgodilo: " + povzetekDogodkov
      : "";
    if (requestedAction === "review") {
      return (
        "Pozdravljeni, prosim za pregled primera dolga v višini " +
        znesek +
        " od dolžnika " +
        ime +
        ". Priloženi so podatki primera, račun in zgodovina poslanih opominov." +
        zgodovinaBesedilo
      );
    }
    if (requestedAction === "legal_proceedings") {
      return (
        "Pozdravljeni, prosim za uvedbo pravnega postopka zaradi neplačanega dolga v višini " +
        znesek +
        " od dolžnika " +
        ime +
        ". Priloženi so podatki primera, račun in zgodovina poslanih opominov." +
        zgodovinaBesedilo
      );
    }
    return (
      "Pozdravljeni, prosim za pomoč pri izterjavi zapadlega dolga v višini " +
      znesek +
      " od dolžnika " +
      ime +
      ". Priloženi so podatki primera, račun in zgodovina poslanih opominov." +
      zgodovinaBesedilo
    );
  }

  function vsebinaIzKorak2(podatkiKorak2) {
    var k2 = podatkiKorak2 || {};
    var pd = k2.paymentDeadline || null;
    var ip = k2.installmentPlan || null;
    var dodatki = k2.dodatki || {};
    return {
      paymentDeadline: {
        enabled: Boolean(dodatki.rok || (pd && pd.enabled)),
        days: pd && pd.termDays != null ? Number(pd.termDays) : null,
      },
      installment: {
        enabled: Boolean(dodatki.obrocno || (ip && ip.enabled)),
        planId: ip && ip.id ? String(ip.id) : null,
        mode: ip && ip.paymentMode === "partial" ? "partial" : "installment",
        count:
          ip && ip.installmentCount != null
            ? Number(ip.installmentCount)
            : null,
        partialAmountCents:
          ip && ip.paymentMode === "partial"
            ? Number(ip.partialAmountCents) || null
            : null,
        partialDueDate:
          ip && ip.paymentMode === "partial" ? ip.partialDueDate || null : null,
      },
      bankTransfer: {
        enabled: Boolean(dodatki.trr),
        accountId: null,
        accountLabel: dodatki.trr ? "Privzeti" : null,
        ibanLastFour: null,
      },
      templateId: k2.izbranPredlogId ? String(k2.izbranPredlogId) : null,
    };
  }

  /** Privzeto (prazno) stanje predaje odvetniku – ločeno od splošnih polj
      koraka (datum/uro/ročni-preklic že hranita step.sendAt in
      step.manualScheduleOverride, zato se tu ne podvajata). */
  var PRIVZETI_DNEVI_PREDAJE = [true, true, true, true, true, false, false];

  function normalizirajDnevePredaje(dnevi) {
    if (!Array.isArray(dnevi) || dnevi.length !== 7) {
      return PRIVZETI_DNEVI_PREDAJE.slice();
    }
    var normalizirani = dnevi.map(Boolean);
    return normalizirani.some(Boolean)
      ? normalizirani
      : PRIVZETI_DNEVI_PREDAJE.slice();
  }

  function praznaPredajaOdvetniku() {
    return {
      status: "draft", // draft | prepared | needs_review | handed_over
      lawyerId: null,
      visibleLawyerIds: null,
      offerFilter: null,
      customLawyers: [],
      lawyerSnapshot: {
        name: "",
        officeName: "",
        email: "",
        phone: "",
        attachmentRequirements: {},
      },
      availableHandoffDays: PRIVZETI_DNEVI_PREDAJE.slice(),
      availableHandoffDaysEditedManually: false,
      availableHandoffDaysSourceLawyerId: null,
      handoffTimingMode: "asap",
      scheduledHandoffAt: null,
      requestedAction: "debt_collection",
      message: "",
      messageEditedManually: false,
      documents: [],
      preparedSnapshot: null,
      preparedAt: null,
      snapshotHistory: [],
      handoverIdempotencyKey: null,
      handedOverAt: null,
      manuallyConfirmedAt: null,
      manualHandoffAcknowledgedAt: null,
      readyForManualHandoffAt: null,
    };
  }

  function generirajIdempotencyKljuc() {
    if (
      typeof crypto !== "undefined" &&
      crypto &&
      typeof crypto.getRandomValues === "function"
    ) {
      var arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      return Array.prototype.map
        .call(arr, function (b) {
          return b.toString(16).padStart(2, "0");
        })
        .join("");
    }
    return (
      "ho-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)
    );
  }

  function narediKorak(meta, offsetDays, ctx, vsebina, osnovniCas) {
    var kind = meta.deliveryMode === "manual" ? "manual_lawyer" : "sms";
    var sendAt = privzetiSendAt(offsetDays, osnovniCas);
    var base = {
      id: "stage-" + meta.order,
      index: meta.order,
      order: meta.order,
      type: meta.type,
      title: meta.title,
      kind: kind,
      deliveryMode: meta.deliveryMode,
      scheduledOffsetDays: offsetDays,
      offsetDays: offsetDays,
      sendAt: sendAt,
      scheduledAt: sendAt,
      manualScheduleOverride: false,
      toneId: meta.toneId,
      templateId: vsebina.templateId,
      paymentDeadline: vsebina.paymentDeadline,
      installment: vsebina.installment,
      bankTransfer: vsebina.bankTransfer,
      status: "draft",
      generatedMessage: "",
      finalMessage: "",
      messageEditedManually: false,
      messageNeedsReview: false,
      snapshotHash: null,
      confirmedAt: null,
      confirmedSnapshotHash: null,
    };

    if (kind === "manual_lawyer") {
      base.lawyerHandoff = praznaPredajaOdvetniku();
      base.lawyerHandoff.message = sestaviSporociloOdvetniku(
        base.lawyerHandoff.requestedAction,
        ctx
      );
      return base;
    }

    var msg = sestaviGeneratedMessage(meta.order, ctx);
    base.generatedMessage = msg;
    base.finalMessage = msg;
    return base;
  }

  function narediNovPlan(podatkiKorak1, podatkiKorak2) {
    var amountCents = eurosToCents(podatkiKorak1 && podatkiKorak1.znesek);
    var toneId = preberiTonIzKorak2(podatkiKorak2);
    var overdue = izracunajZamudoDni(
      podatkiKorak1 && podatkiKorak1.datumZapadlosti
    );
    var odmiki = izracunajOdmike(toneId, overdue, amountCents);
    var ctx = {
      imeDolznika: podatkiKorak1 && podatkiKorak1.imeDolznika,
      stevilkaRacuna: podatkiKorak1 && podatkiKorak1.stevilkaRacuna,
      sporociloDolzniku: podatkiKorak2 && podatkiKorak2.sporociloDolzniku,
      amountCents: amountCents,
      historyBeforePlan: Array.isArray(podatkiKorak1 && podatkiKorak1.zgodovinaPredNacrtom)
        ? podatkiKorak1.zgodovinaPredNacrtom
        : [],
      remainingBeforePlan: Number(podatkiKorak1 && podatkiKorak1.preostaliDolgPredNacrtom) || (amountCents / 100),
    };
    var vsebina = vsebinaIzKorak2(podatkiKorak2);
    var osnovniCas = zdajIso();
    var steps = KORAKI_META.map(function (meta, i) {
      return narediKorak(meta, odmiki[i], ctx, vsebina, osnovniCas);
    });
    var now = osnovniCas;
    var totalDurationDays = odmiki[odmiki.length - 1] || 0;
    var activationAt = steps[0] && steps[0].sendAt ? steps[0].sendAt : now;
    return {
      schemaVersion: 4,
      id: "plan-" + now,
      debtId: null,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      activationAt: activationAt,
      toneId: toneId,
      amountCents: amountCents,
      overdueDays: overdue,
      overdueDaysAtCreation: overdue,
      recommendationReason: sestaviRazlog(amountCents, overdue, toneId),
      recommendedGapDays: odmiki[1] != null ? odmiki[1] : 11,
      totalDurationDays: totalDurationDays,
      selectedStageId: steps[0].id,
      collectionApproachConfirmed: false,
      keepStageIntervals: true,
      allowedSendWindow: { start: "07:00", end: "21:00" },
      allowedSendWindowMode: "all",
      version: "1",
      updatedAt: now,
      _baseOffsets: odmiki.slice(),
      inputsHash: vhodniHash(amountCents, toneId, overdue),
      identityHash: identitetniHash(podatkiKorak1, amountCents),
      _step2MessageSnapshot: String(
        (podatkiKorak2 && podatkiKorak2.sporociloDolzniku) || ""
      ).trim(),
      _step2TemplateSnapshot: String(
        (podatkiKorak2 && podatkiKorak2.izbranPredlogId) || ""
      ),
      steps: steps,
      stages: steps,
    };
  }

  function izracunajPlanStatus(plan) {
    if (!plan) return "draft";
    if (plan.status === "activated" || plan.status === "active") return "activated";
    var steps = (plan.steps || []).filter(function (s) { return !s.isExcluded; });
    if (
      steps.length > 0 &&
      steps.every(function (s) {
        return s.status === "confirmed";
      })
    ) {
      return "ready_to_activate";
    }
    return "draft";
  }

  function osveziPlanStatus(plan) {
    plan.status = izracunajPlanStatus(plan);
    plan.updatedAt = zdajIso();
    plan.stages = plan.steps;
    return plan;
  }

  function normalizirajKorak(step, i) {
    var meta = KORAKI_META[i] || KORAKI_META[0];
    if (!step.title) step.title = meta.title;
    if (!step.type) step.type = meta.type;
    if (!step.order) step.order = step.index || meta.order;
    if (!step.id) step.id = "stage-" + step.order;
    if (!step.deliveryMode) {
      step.deliveryMode =
        step.kind === "manual_lawyer" ? "manual" : "automatic";
    }
    if (!step.toneId) step.toneId = meta.toneId;
    if (step.kind === "manual_lawyer" && !step.lawyerHandoff) {
      step.lawyerHandoff = praznaPredajaOdvetniku();
    }
    if (step.kind === "manual_lawyer" && !Array.isArray(step.lawyerHandoff.snapshotHistory)) {
      step.lawyerHandoff.snapshotHistory = [];
    }
    if (step.kind === "manual_lawyer" && step.lawyerHandoff.manualHandoffAcknowledgedAt === undefined) {
      step.lawyerHandoff.manualHandoffAcknowledgedAt = null;
    }
    if (step.kind === "manual_lawyer" && step.lawyerHandoff.readyForManualHandoffAt === undefined) {
      step.lawyerHandoff.readyForManualHandoffAt = null;
    }
    if (step.kind === "manual_lawyer" && step.lawyerHandoff.visibleLawyerIds === undefined) {
      step.lawyerHandoff.visibleLawyerIds = null;
    }
    if (step.kind === "manual_lawyer" && step.lawyerHandoff.offerFilter === undefined) {
      step.lawyerHandoff.offerFilter = null;
    }
    if (step.kind === "manual_lawyer" && !Array.isArray(step.lawyerHandoff.customLawyers)) {
      step.lawyerHandoff.customLawyers = [];
    }
    if (step.kind === "manual_lawyer") {
      step.lawyerHandoff.availableHandoffDays = normalizirajDnevePredaje(
        step.lawyerHandoff.availableHandoffDays
      );
      if (step.lawyerHandoff.availableHandoffDaysEditedManually === undefined) {
        step.lawyerHandoff.availableHandoffDaysEditedManually = false;
      }
      if (step.lawyerHandoff.availableHandoffDaysSourceLawyerId === undefined) {
        step.lawyerHandoff.availableHandoffDaysSourceLawyerId =
          step.lawyerHandoff.lawyerId || null;
      }
      if (step.lawyerHandoff.handoffTimingMode !== "custom") {
        step.lawyerHandoff.handoffTimingMode = "asap";
      }
      if (!step.lawyerHandoff.scheduledHandoffAt) {
        step.lawyerHandoff.scheduledHandoffAt = null;
      }
    }
    if (step.sendAt == null && step.scheduledAt) step.sendAt = step.scheduledAt;
    if (step.sendAt == null) {
      step.sendAt = privzetiSendAt(step.scheduledOffsetDays || 0);
    }
    step.scheduledAt = step.sendAt;
    if (step.offsetDays == null) {
      step.offsetDays = step.scheduledOffsetDays || 0;
    }
    if (step.customContacts == null) {
      step.customContacts = { phoneNumbers: [], emailAddresses: [] };
    } else {
      if (!Array.isArray(step.customContacts.phoneNumbers)) step.customContacts.phoneNumbers = [];
      if (!Array.isArray(step.customContacts.emailAddresses)) step.customContacts.emailAddresses = [];
    }
    if (step.manualScheduleOverride == null) {
      step.manualScheduleOverride = false;
    }
    if (step.allowedSendWindow) {
      step.allowedSendWindow = normalizirajDovoljenoOkno(
        step.allowedSendWindow
      );
    }
    return step;
  }

  function sinhronizirajPrvoSporociloIzKoraka2(plan, podatkiKorak2, ctx) {
    var prviKorak = plan && plan.steps && plan.steps[0];
    if (!prviKorak || prviKorak.kind === "manual_lawyer") return false;

    var novoSporocilo = String(
      (podatkiKorak2 && podatkiKorak2.sporociloDolzniku) || ""
    ).trim();
    var noviTemplateId = String(
      (podatkiKorak2 && podatkiKorak2.izbranPredlogId) || ""
    );
    var staroSporocilo = plan._step2MessageSnapshot;
    var stariTemplateId = plan._step2TemplateSnapshot;

    /* Pri starejĹˇih osnutkih je generatedMessage najboljĹˇi posnetek
       sporoÄŤila, ki je bilo nazadnje preneseno iz 2. koraka. */
    if (staroSporocilo == null) {
      staroSporocilo = String(prviKorak.generatedMessage || "").trim();
    }
    if (stariTemplateId == null) {
      stariTemplateId = String(prviKorak.templateId || "");
    }

    var jeSpremenjeno =
      novoSporocilo !== String(staroSporocilo || "") ||
      noviTemplateId !== String(stariTemplateId || "");

    plan._step2MessageSnapshot = novoSporocilo;
    plan._step2TemplateSnapshot = noviTemplateId;

    if (!jeSpremenjeno) return false;

    var prenesenoSporocilo = sestaviGeneratedMessage(1, ctx);
    prviKorak.generatedMessage = prenesenoSporocilo;
    prviKorak.finalMessage = prenesenoSporocilo;
    prviKorak.messageEditedManually = false;
    prviKorak.templateId = noviTemplateId || null;

    if (prviKorak.status === "confirmed" || prviKorak.confirmedAt) {
      prviKorak.status = "needs_review";
      prviKorak.messageNeedsReview = true;
      prviKorak.reviewRequiredAt = zdajIso();
      prviKorak.reviewRequiredRevision = "review-v1:" + prviKorak.reviewRequiredAt;
      prviKorak.snapshotHash = null;
      prviKorak.confirmedSnapshotHash = null;
      prviKorak.confirmedAt = null;
    }

    return true;
  }

  function uskladiZVhodi(plan, podatkiKorak1, podatkiKorak2) {
    if (!plan || plan.status === "activated") return plan;

    plan.allowedSendWindow = normalizirajDovoljenoOkno(
      plan.allowedSendWindow
    );
    plan.allowedSendWindowMode = normalizirajNacinDovoljenegaOkna(plan);

    (plan.steps || []).forEach(function (s, i) {
      normalizirajKorak(s, i);
    });

    var amountCents = eurosToCents(podatkiKorak1 && podatkiKorak1.znesek);
    var toneId = preberiTonIzKorak2(podatkiKorak2);
    var overdue = izracunajZamudoDni(
      podatkiKorak1 && podatkiKorak1.datumZapadlosti
    );
    var novHash = vhodniHash(amountCents, toneId, overdue);
    var ctx = {
      imeDolznika: podatkiKorak1 && podatkiKorak1.imeDolznika,
      stevilkaRacuna: podatkiKorak1 && podatkiKorak1.stevilkaRacuna,
      sporociloDolzniku: podatkiKorak2 && podatkiKorak2.sporociloDolzniku,
      amountCents: amountCents,
      historyBeforePlan: Array.isArray(podatkiKorak1 && podatkiKorak1.zgodovinaPredNacrtom)
        ? podatkiKorak1.zgodovinaPredNacrtom
        : [],
    };

    plan.recommendationReason = sestaviRazlog(amountCents, overdue, toneId);
    plan.overdueDays = overdue;
    plan.historyBeforePlan = Array.isArray(podatkiKorak1 && podatkiKorak1.zgodovinaPredNacrtom)
      ? podatkiKorak1.zgodovinaPredNacrtom
      : [];
    plan.remainingBeforePlan = Number(podatkiKorak1 && podatkiKorak1.preostaliDolgPredNacrtom) || (amountCents / 100);

    /* SporoÄŤilo, izbrano v 2. koraku, vedno pripada prvi kartici.
       To preverimo loÄŤeno, da sprememba besedila ne premakne datumov. */
    sinhronizirajPrvoSporociloIzKoraka2(plan, podatkiKorak2, ctx);

    /* Razveljavitev ob spremembi podatkov o dolžniku. Mora biti PRED izhodom na
       plan.inputsHash spodaj: sprememba imena, davčne, kontakta, zapadlosti ipd.
       ne spremeni vhodniHash (ta pozna le znesek, ton in dneve zamude), zato bi
       se funkcija vrnila v prazno in kartica predaje bi še naprej kazala staro
       ime iz preparedSnapshot – brez opozorila, da so podatki zastareli.
       Datumov tu namenoma ne prevzemamo; to ostane naloga inputsHash. */
    var novIdentitetniHash = identitetniHash(podatkiKorak1, amountCents);
    var prejsnjiIdentitetniHash = plan.identityHash;
    if (prejsnjiIdentitetniHash == null) {
      /* Star načrt brez identityHash: izhodišče preberemo iz posnetka predaje,
         da spremembo od priprave naprej zaznamo tudi pri njih. Če posnetka ni,
         ni česa razveljaviti in hash samo zabeležimo. */
      (plan.steps || []).forEach(function (s) {
        if (prejsnjiIdentitetniHash == null && s.kind === "manual_lawyer") {
          prejsnjiIdentitetniHash = identitetniHashIzPosnetka(
            s.lawyerHandoff && s.lawyerHandoff.preparedSnapshot
          );
        }
      });
    }
    if (prejsnjiIdentitetniHash != null && prejsnjiIdentitetniHash !== novIdentitetniHash) {
      plan.collectionApproachConfirmed = false;
      plan = uporabiPristopIzterjave(
        plan,
        priporoceniPristopIzterjave({ overdueDays: overdue, amountCents: amountCents })
      );
      (plan.steps || []).forEach(function (s) {
        if (s.kind === "manual_lawyer") {
          if (s.lawyerHandoff) oznaciPredajaNeedsReview(s.lawyerHandoff);
          return;
        }
        oznaciNeedsReview(s);
      });
    }
    plan.identityHash = novIdentitetniHash;

    /* Zgodovina pred načrtom ni del inputsHash (ne spreminja terminov), mora pa
       vedno osvežiti samodejno sporočilo odvetniku. Zato to naredimo pred
       hitrim izhodom za nespremenjene zneske/ton/zamudo. */
    (plan.steps || []).forEach(function (s) {
      if (s.kind !== "manual_lawyer") return;
      if (!s.lawyerHandoff) s.lawyerHandoff = praznaPredajaOdvetniku();
      if (s.lawyerHandoff.messageEditedManually) {
        var prejsnjiPovzetek = String(s.lawyerHandoff.historySummaryAuto || "").trim();
        var noviPovzetek = povzetekDogodkovPredNacrtom(ctx);
        var osnovnoSporocilo = String(s.lawyerHandoff.message || "");
        if (prejsnjiPovzetek) {
          osnovnoSporocilo = osnovnoSporocilo.replace("\n\nPovzetek zgodovine: " + prejsnjiPovzetek, "");
        }
        var sporociloSPovzetkom = osnovnoSporocilo + (noviPovzetek ? "\n\nPovzetek zgodovine: " + noviPovzetek : "");
        if (sporociloSPovzetkom !== s.lawyerHandoff.message) {
          s.lawyerHandoff.message = sporociloSPovzetkom;
          oznaciPredajaNeedsReview(s.lawyerHandoff);
        }
        s.lawyerHandoff.historySummaryAuto = noviPovzetek;
        return;
      }
      var novoSporociloOdvetniku = sestaviSporociloOdvetniku(
        s.lawyerHandoff.requestedAction,
        ctx
      );
      if (novoSporociloOdvetniku !== s.lawyerHandoff.message) {
        s.lawyerHandoff.message = novoSporociloOdvetniku;
        oznaciPredajaNeedsReview(s.lawyerHandoff);
      }
    });

    if (plan.inputsHash === novHash) {
      return osveziPlanStatus(plan);
    }

    var odmiki = izracunajOdmike(toneId, overdue, amountCents);
    var vsebina = vsebinaIzKorak2(podatkiKorak2);
    plan.toneId = toneId;
    plan.amountCents = amountCents;
    plan.overdueDaysAtCreation = overdue;
    plan.inputsHash = novHash;
    plan.totalDurationDays = odmiki[odmiki.length - 1] || 0;
    plan.recommendedGapDays = odmiki[1] != null ? odmiki[1] : 11;
    if (plan.keepStageIntervals == null) plan.keepStageIntervals = true;
    /* Spodaj se vsem korakom dejansko prepiše razpored (sendAt/scheduledOffsetDays)
       po sveže preračunanih "odmiki" (npr. ker je zamuda medtem prestopila nov
       razred). Če _baseOffsets ne bi sledil isti spremembi, bi "priporočeni
       razmik" ostal star in se ne bi nikoli več ujel z dejanskim razporedom –
       kartica "Priporočen čas pošiljanja" bi zato trajno izgubila strnjen
       prikaz in ostala v razprti obliki za VSE naslednje korake. */
    plan._baseOffsets = odmiki.slice();

    var osnovniCasPlana =
      (plan.steps && plan.steps[0] &&
        (plan.steps[0].sendAt || plan.steps[0].scheduledAt)) ||
      zdajIso();
    (plan.steps || []).forEach(function (step, i) {
      /* Ohrani Random nastavitve, a razveljavi izračun (osnovni čas se spreminja). */
      var shranjenRS = step._randomSchedule;
      step.scheduledOffsetDays = odmiki[i];
      step.offsetDays = odmiki[i];
      step.sendAt = privzetiSendAt(odmiki[i], osnovniCasPlana);
      step.scheduledAt = step.sendAt;
      step.manualScheduleOverride = false;
      step._preskokDni = 0;
      if (shranjenRS && shranjenRS.enabled) {
        step._randomSchedule = shranjenRS;
        step._randomSchedule.resolvedScheduledAt = null;
        step._randomSchedule.resolvedAt = null;
        delete step._randomSchedule._previewResolvedAt;
        delete step._randomSchedule._previewGeneratedAt;
        delete step._randomSchedule._previewBaseAt;
      }
      if (!step.paymentDeadline) step.paymentDeadline = vsebina.paymentDeadline;
      if (!step.installment) step.installment = vsebina.installment;
      if (!step.bankTransfer) step.bankTransfer = vsebina.bankTransfer;
      if (step.kind === "manual_lawyer") {
        if (!step.lawyerHandoff) step.lawyerHandoff = praznaPredajaOdvetniku();
        if (!step.lawyerHandoff.messageEditedManually) {
          var novoSporociloOdv = sestaviSporociloOdvetniku(
            step.lawyerHandoff.requestedAction,
            ctx
          );
          if (novoSporociloOdv !== step.lawyerHandoff.message) {
            step.lawyerHandoff.message = novoSporociloOdv;
            oznaciPredajaNeedsReview(step.lawyerHandoff);
          }
        }
        return;
      }
      var novoGenerated = sestaviGeneratedMessage(step.index, ctx);
      step.generatedMessage = novoGenerated;
      if (!step.messageEditedManually) {
        step.finalMessage = novoGenerated;
      }
      if (step.status === "confirmed" || step.confirmedAt) {
        step.status = "needs_review";
        step.messageNeedsReview = true;
        step.reviewRequiredAt = zdajIso();
        step.reviewRequiredRevision = "review-v1:" + step.reviewRequiredAt;
        step.snapshotHash = null;
        step.confirmedSnapshotHash = null;
        step.confirmedAt = null;
      }
    });

    plan.activationAt = plan.steps[0] ? plan.steps[0].sendAt : plan.activationAt;
    return osveziPlanStatus(plan);
  }

  function naloziOsnutek() {
    try {
      var surovo = sessionStorage.getItem(KLJUC_SEJE);
      if (!surovo) return null;
      var plan = JSON.parse(surovo);
      if (!plan || !Array.isArray(plan.steps) || plan.steps.length < 2) {
        return null;
      }
      if (plan.keepStageIntervals == null) plan.keepStageIntervals = true;
      plan.allowedSendWindow = normalizirajDovoljenoOkno(
        plan.allowedSendWindow
      );
      plan.allowedSendWindowMode = normalizirajNacinDovoljenegaOkna(plan);
      plan.steps.forEach(normalizirajKorak);
      uskladiOffseteIzDatumov(plan);
      if (!Array.isArray(plan._baseOffsets) || plan._baseOffsets.length !== plan.steps.length) {
        plan._baseOffsets = plan.steps.map(function (s) { return Number(s.scheduledOffsetDays) || 0; });
      }
      plan.stages = plan.steps;
      return plan;
    } catch (_e) {
      return null;
    }
  }

  function shraniOsnutek(plan) {
    if (!plan) return;
    plan.allowedSendWindow = normalizirajDovoljenoOkno(
      plan.allowedSendWindow
    );
    plan.allowedSendWindowMode = normalizirajNacinDovoljenegaOkna(plan);
    plan.updatedAt = zdajIso();
    plan.version = String(Number(plan.version || 0) + 1);
    plan.status = izracunajPlanStatus(plan);
    plan.stages = plan.steps;
    sessionStorage.setItem(KLJUC_SEJE, JSON.stringify(plan));
  }

  function pocistiOsnutek() {
    sessionStorage.removeItem(KLJUC_SEJE);
  }

  function jeStariStiriKoracniNacrt(plan) {
    var koraki = (plan && plan.steps) || [];
    return (
      !plan.schemaVersion &&
      koraki.length === 4 &&
      koraki.filter(function (korak) { return korak.kind === "sms"; }).length === 3 &&
      koraki[3] &&
      koraki[3].kind === "manual_lawyer"
    );
  }

  function nadgradiStariNacrt(plan, podatkiKorak1, podatkiKorak2) {
    var nov = narediNovPlan(podatkiKorak1, podatkiKorak2);
    var stariKoraki = plan.steps || [];

    /* Ohranimo obstoječe prve tri opomine; dodamo le nova 4. in 5. korak. */
    for (var i = 0; i < 3; i++) {
      if (!stariKoraki[i]) continue;
      nov.steps[i] = Object.assign({}, nov.steps[i], stariKoraki[i], {
        id: "stage-" + (i + 1),
        index: i + 1,
        order: i + 1,
      });
    }

    /* Obstoječo ročno predajo premaknemo na novi 6. korak. */
    var stariRocni = stariKoraki[3];
    if (stariRocni) {
      var noviRocni = nov.steps[5];
      nov.steps[5] = Object.assign({}, noviRocni, stariRocni, {
        id: noviRocni.id,
        index: noviRocni.index,
        order: noviRocni.order,
        type: noviRocni.type,
        title: noviRocni.title,
        toneId: noviRocni.toneId,
        kind: noviRocni.kind,
        deliveryMode: noviRocni.deliveryMode,
        scheduledOffsetDays: noviRocni.scheduledOffsetDays,
        offsetDays: noviRocni.offsetDays,
        sendAt: noviRocni.sendAt,
        scheduledAt: noviRocni.scheduledAt,
      });
    }

    nov.id = plan.id || nov.id;
    nov.createdAt = plan.createdAt || nov.createdAt;
    nov.stages = nov.steps;
    return nov;
  }

  function jeNeureljivSestiKorak(plan) {
    var koraki = (plan && plan.steps) || [];
    var sesti = koraki.find(function (korak, i) {
      return Number(korak.index || korak.order || i + 1) === 6;
    });
    return !!(
      sesti &&
      (sesti.kind === "manual_lawyer" || sesti.deliveryMode === "manual")
    );
  }

  function zamenjajNeureljivSestiKorak(plan, podatkiKorak1, podatkiKorak2) {
    if (!jeNeureljivSestiKorak(plan)) return plan;
    var pozicija = plan.steps.findIndex(function (korak, i) {
      return Number(korak.index || korak.order || i + 1) === 6;
    });
    if (pozicija < 0) return plan;
    var stariSesti = plan.steps[pozicija];
    var noviSesti = narediNovPlan(podatkiKorak1, podatkiKorak2).steps[5];

    /* Ohranimo uporabnikov termin in izklop koraka, kartica pa postane običajna in urejljiva. */
    if (stariSesti.scheduledOffsetDays != null) {
      noviSesti.scheduledOffsetDays = stariSesti.scheduledOffsetDays;
      noviSesti.offsetDays = stariSesti.scheduledOffsetDays;
    }
    if (stariSesti.sendAt || stariSesti.scheduledAt) {
      noviSesti.sendAt = stariSesti.sendAt || stariSesti.scheduledAt;
      noviSesti.scheduledAt = noviSesti.sendAt;
      noviSesti.manualScheduleOverride = !!stariSesti.manualScheduleOverride;
    }
    if (stariSesti.isExcluded != null) {
      noviSesti.isExcluded = !!stariSesti.isExcluded;
    }

    plan.steps[pozicija] = noviSesti;
    if (plan.selectedStageId === stariSesti.id) {
      plan.selectedStageId = noviSesti.id;
    }
    plan.schemaVersion = 3;
    plan.stages = plan.steps;
    return plan;
  }

  /** Zadnji korak v osnutku se ne ujema s trenutno predlogo (npr. osnutek je
      bil shranjen, ko je bila zadnja pozicija še avtomatski SMS, predloga pa
      jo zdaj določa kot ročno predajo odvetniku – ali obratno). */
  function jeNeureljivZadnjiKorak(plan) {
    var koraki = plan && plan.steps;
    if (!koraki || !koraki.length) return false;
    var zadnjaMeta = KORAKI_META[KORAKI_META.length - 1];
    if (!zadnjaMeta) return false;
    var zadnji = koraki[koraki.length - 1];
    var moraBitiRocen = zadnjaMeta.deliveryMode === "manual";
    var jeTrenutnoRocen = zadnji.kind === "manual_lawyer";
    return moraBitiRocen !== jeTrenutnoRocen;
  }

  function zamenjajNeureljivZadnjiKorak(plan, podatkiKorak1, podatkiKorak2) {
    if (!jeNeureljivZadnjiKorak(plan)) return plan;
    var pozicija = plan.steps.length - 1;
    var stariZadnji = plan.steps[pozicija];
    var noviZadnji = narediNovPlan(podatkiKorak1, podatkiKorak2).steps[pozicija];
    /* Obrambna zaščita: če je bil načrt kdaj shranjen z neobičajnim
       zaporedjem korakov (npr. korak dodan za "Predaja odvetniku"), sveži
       vzorčni načrt na tej poziciji morda nima koraka. Brez tega bi
       naslednja vrstica vrgla napako in izris cele strani bi se ustavil. */
    if (!noviZadnji) return plan;

    /* Ohranimo uporabnikov termin in izklop koraka. */
    if (stariZadnji.scheduledOffsetDays != null) {
      noviZadnji.scheduledOffsetDays = stariZadnji.scheduledOffsetDays;
      noviZadnji.offsetDays = stariZadnji.scheduledOffsetDays;
    }
    if (stariZadnji.sendAt || stariZadnji.scheduledAt) {
      noviZadnji.sendAt = stariZadnji.sendAt || stariZadnji.scheduledAt;
      noviZadnji.scheduledAt = noviZadnji.sendAt;
      noviZadnji.manualScheduleOverride = !!stariZadnji.manualScheduleOverride;
    }
    if (stariZadnji.isExcluded != null) {
      noviZadnji.isExcluded = !!stariZadnji.isExcluded;
    }

    plan.steps[pozicija] = noviZadnji;
    if (plan.selectedStageId === stariZadnji.id) {
      plan.selectedStageId = noviZadnji.id;
    }
    plan.stages = plan.steps;
    return plan;
  }

  function nadgradiNacrtNaDesetKorakov(plan, podatkiKorak1, podatkiKorak2) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    if ((Number(plan.schemaVersion) || 0) >= 4) return plan;

    var predloga = narediNovPlan(podatkiKorak1, podatkiKorak2);
    var prviCas =
      (plan.steps[0] &&
        (plan.steps[0].sendAt || plan.steps[0].scheduledAt)) ||
      zdajIso();

    for (var i = plan.steps.length; i < KORAKI_META.length; i++) {
      var noviKorak = Object.assign({}, predloga.steps[i]);
      noviKorak.sendAt = privzetiSendAt(
        noviKorak.scheduledOffsetDays,
        prviCas
      );
      noviKorak.scheduledAt = noviKorak.sendAt;
      plan.steps.push(noviKorak);
    }

    plan.steps.forEach(function (korak, index) {
      korak.index = index + 1;
      korak.order = index + 1;
      korak.id = "stage-" + (index + 1);
    });
    plan.schemaVersion = 4;
    plan.stages = plan.steps;
    plan._baseOffsets = plan.steps.map(function (korak) {
      return Number(korak.scheduledOffsetDays) || 0;
    });
    plan.totalDurationDays = plan.steps.length
      ? Number(plan.steps[plan.steps.length - 1].scheduledOffsetDays) || 0
      : 0;
    return plan;
  }

  /* Zadnja originalna kartica »Predaja odvetniku« je stalni zaključek načrta.
     Števec jo zato vedno vključuje; gumba −/+ upravljata samo običajne opomine. */
  function zagotoviVkljucenZadnjiRocniKorak(plan) {
    var koraki = plan && plan.steps;
    if (!Array.isArray(koraki) || !koraki.length) return plan;
    var zadnji = koraki[koraki.length - 1];
    if (zadnji.kind === "manual_lawyer" || zadnji.deliveryMode === "manual") {
      zadnji.isExcluded = false;
    }
    return plan;
  }

  function pridobiAliUstvari(podatkiKorak1, podatkiKorak2) {
    var plan = naloziOsnutek();
    if (!plan) {
      plan = narediNovPlan(podatkiKorak1, podatkiKorak2);
      plan = zagotoviVkljucenZadnjiRocniKorak(plan);
      shraniOsnutek(plan);
      return plan;
    }
    if (jeStariStiriKoracniNacrt(plan)) {
      plan = nadgradiStariNacrt(plan, podatkiKorak1, podatkiKorak2);
      plan = zagotoviVkljucenZadnjiRocniKorak(plan);
      shraniOsnutek(plan);
      return plan;
    }
    if (jeNeureljivSestiKorak(plan)) {
      plan = zamenjajNeureljivSestiKorak(
        plan,
        podatkiKorak1,
        podatkiKorak2
      );
    }
    plan = nadgradiNacrtNaDesetKorakov(
      plan,
      podatkiKorak1,
      podatkiKorak2
    );
    if (jeNeureljivZadnjiKorak(plan)) {
      plan = zamenjajNeureljivZadnjiKorak(plan, podatkiKorak1, podatkiKorak2);
    }
    plan = zagotoviVkljucenZadnjiRocniKorak(plan);
    plan = uskladiZVhodi(plan, podatkiKorak1, podatkiKorak2);
    shraniOsnutek(plan);
    return plan;
  }

  function najdiKorak(plan, index) {
    return (plan.steps || []).find(function (s) {
      return Number(s.index) === Number(index);
    });
  }

  function najdiNaslednjiVkljuceniKorak(plan, index) {
    var koraki = (plan && plan.steps) || [];
    var trenutniPolozaj = koraki.findIndex(function (s) {
      return Number(s.index) === Number(index);
    });
    if (trenutniPolozaj < 0) return null;
    for (var i = trenutniPolozaj + 1; i < koraki.length; i++) {
      if (!koraki[i].isExcluded) return koraki[i];
    }
    return null;
  }

  function oznaciNeedsReview(step) {
    if (!step) return;
    if (step.status === "confirmed" || step.confirmedAt) {
      step.status = "needs_review";
      step.confirmedAt = null;
      step.snapshotHash = null;
      step.confirmedSnapshotHash = null;
      step.messageNeedsReview = true;
      step.reviewRequiredAt = zdajIso();
      step.reviewRequiredRevision = "review-v1:" + step.reviewRequiredAt;
    }
  }

  /** Če se podatki predaje spremenijo potem, ko je bila predaja že
      pripravljena, mora uporabnik pripravo ponoviti. Obstoječi preparedSnapshot
      in preparedAt OHRANIMO nespremenjena kot nespremenljivo revizijsko sled –
      zamenja ju šele naslednja uspešna priprava (glej pripraviPredajoOdvetniku). */
  function oznaciPredajaNeedsReview(lawyerHandoff) {
    if (!lawyerHandoff) return;
    if (lawyerHandoff.status === "prepared") {
      lawyerHandoff.status = "needs_review";
      /* Morebitna prejšnja ročna evidenca predaje se je nanašala na staro
         različico paketa in po spremembi ni več veljavna. */
      lawyerHandoff.manuallyConfirmedAt = null;
    }
  }

  function posodobiIzbraniPaket(plan, index, snapshot) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "manual_lawyer" || !snapshot) return plan;
    if (!step.lawyerHandoff) step.lawyerHandoff = praznaPredajaOdvetniku();
    step.lawyerHandoff.selectedPackage = JSON.parse(JSON.stringify(snapshot));
    oznaciPredajaNeedsReview(step.lawyerHandoff);
    return osveziPlanStatus(plan);
  }

  function posodobiSporociloKoraka(plan, index, besedilo) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "sms") return plan;
    var t = String(besedilo || "");
    step.finalMessage = t;
    step.messageEditedManually = true;
    oznaciNeedsReview(step);
    if (step.status === "confirmed") {
      step.status = "draft";
    }
    return osveziPlanStatus(plan);
  }

  /** Shrani izbranega/ročno vnesenega odvetnika – zmeraj samo v lokalen
      posnetek (lawyerSnapshot), brez novega imenika. lawyerId ostane null za
      ročni vnos, da struktura kasneje omogoča povezavo z resničnim virom. */
  function posodobiOdvetnika(plan, index, snapshot, lawyerId) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "manual_lawyer") return plan;
    if (!step.lawyerHandoff) step.lawyerHandoff = praznaPredajaOdvetniku();
    var prejsnjiLawyerId = step.lawyerHandoff.lawyerId || null;
    var noviLawyerId = lawyerId || null;
    step.lawyerHandoff.lawyerId = noviLawyerId;
    step.lawyerHandoff.lawyerSnapshot = {
      name: String((snapshot && snapshot.name) || "").trim(),
      officeName: String((snapshot && snapshot.officeName) || "").trim(),
      email: String((snapshot && snapshot.email) || "").trim(),
      phone: String((snapshot && snapshot.phone) || "").trim(),
      attachmentRequirements:
        snapshot && snapshot.attachmentRequirements
          ? JSON.parse(JSON.stringify(snapshot.attachmentRequirements))
          : {},
    };
    if (
      prejsnjiLawyerId !== noviLawyerId ||
      !step.lawyerHandoff.availableHandoffDaysEditedManually
    ) {
      step.lawyerHandoff.availableHandoffDays = normalizirajDnevePredaje(
        snapshot && snapshot.availableHandoffDays
      );
      step.lawyerHandoff.availableHandoffDaysEditedManually = false;
      step.lawyerHandoff.availableHandoffDaysSourceLawyerId = noviLawyerId;
    }
    oznaciPredajaNeedsReview(step.lawyerHandoff);
    return osveziPlanStatus(plan);
  }

  /** Paketna kartica že predstavlja konkretno ponudbo odvetnika, zato morata
      biti paket in ta odvetnik shranjena skupaj. Tako spodnji pill nikoli ne
      ostane prazen ali neusklajen z izbrano kartico. */
  function posodobiPaketInOdvetnika(plan, index, paketSnapshot, lawyerSnapshot, lawyerId) {
    if (!paketSnapshot || !lawyerSnapshot) return plan;
    plan = posodobiIzbraniPaket(plan, index, paketSnapshot);
    plan = posodobiOdvetnika(plan, index, lawyerSnapshot, lawyerId);
    return osveziPlanStatus(plan);
  }

  function posodobiDnevePredaje(plan, index, dnevi) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "manual_lawyer") return plan;
    if (!step.lawyerHandoff) step.lawyerHandoff = praznaPredajaOdvetniku();
    if (!Array.isArray(dnevi) || dnevi.length !== 7 || !dnevi.some(Boolean)) {
      return plan;
    }
    step.lawyerHandoff.availableHandoffDays = dnevi.map(Boolean);
    step.lawyerHandoff.availableHandoffDaysEditedManually = true;
    step.lawyerHandoff.availableHandoffDaysSourceLawyerId =
      step.lawyerHandoff.lawyerId || null;
    oznaciPredajaNeedsReview(step.lawyerHandoff);
    return osveziPlanStatus(plan);
  }

  function posodobiCasPredajeOdvetniku(plan, index, nacin, iso) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "manual_lawyer") return plan;
    if (nacin !== "asap" && nacin !== "custom") return plan;
    var datum = new Date(iso);
    if (!iso || Number.isNaN(datum.getTime())) return plan;
    if (!step.lawyerHandoff) step.lawyerHandoff = praznaPredajaOdvetniku();
    var normaliziranIso = datum.toISOString();
    step.lawyerHandoff.handoffTimingMode = nacin;
    step.lawyerHandoff.scheduledHandoffAt = normaliziranIso;
    step.sendAt = normaliziranIso;
    step.scheduledAt = normaliziranIso;
    step.manualScheduleOverride = nacin === "custom";
    oznaciPredajaNeedsReview(step.lawyerHandoff);
    return osveziPlanStatus(plan);
  }

  function posodobiPrikazaneOdvetnike(plan, index, lawyerIds) {
    return posodobiFilterPonudb(plan, index, {
      mode: "best_match",
      lawyerIds: lawyerIds,
    });
  }

  /** Atomski zapis filtra prikaza odvetniških ponudb v lawyerHandoff. Filter
      je en sam vir resnice (visibleLawyerIds je le združljivostna projekcija),
      zato ga ni dovoljeno pisati mimo tega helperja. Velja samo za ročni
      odvetniški korak (manual_lawyer). */
  function posodobiFilterPonudb(plan, index, filter) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "manual_lawyer") return plan;
    if (!step.lawyerHandoff) step.lawyerHandoff = praznaPredajaOdvetniku();

    var f = filter || {};
    var mode = f.mode === "single_lawyer" ? "single_lawyer" : "best_match";

    /* 1. Normaliziraj ID-je: samo ne-prazni nizi, brez podvojenih. */
    var ids = Array.isArray(f.lawyerIds)
      ? f.lawyerIds
          .map(function (id) { return String(id == null ? "" : id).trim(); })
          .filter(Boolean)
      : [];
    ids = Array.from(new Set(ids));

    /* 2. Neveljavni ID-ji (izven veljavnega nabora), če je nabor podan. */
    if (Array.isArray(f.validLawyerIds)) {
      var veljavni = new Set(f.validLawyerIds.map(String));
      ids = ids.filter(function (id) { return veljavni.has(id); });
    }

    /* 3. Normaliziraj lastne odvetnike v lokalno spremenljivko (brez pisanja
          v plan, da zavrnjena validacija ne pusti delnih sprememb). */
    var customLawyers = Array.isArray(f.customLawyers)
      ? f.customLawyers
          .filter(function (c) { return c && String(c.name || "").trim(); })
          .map(function (c, i) {
            return {
              id: String(
                c.id || "custom_" + (c._key != null ? c._key : i) + "_" + Date.now().toString(36)
              ),
              name: String(c.name || "").trim(),
              officeName: String(c.officeName || "").trim(),
              email: String(c.email || "").trim(),
              phone: String(c.phone || "").trim(),
              createdAt: c.createdAt || zdajIso(),
            };
          })
      : null;

    /* 4. Validacija: zahtevaj najmanj enega odvetnika. */
    if (!ids.length) return plan;

    /* 5. Validacija: single_lawyer zahteva veljaven singleLawyerId, ki mora
          biti tudi v lawyerIds. */
    var singleLawyerId = f.singleLawyerId ? String(f.singleLawyerId) : null;
    if (mode === "single_lawyer") {
      if (!singleLawyerId || ids.indexOf(singleLawyerId) < 0) return plan;
    } else {
      singleLawyerId = null;
    }

    /* 6. Atomski zapis šele po uspešni validaciji. */
    if (customLawyers !== null) {
      step.lawyerHandoff.customLawyers = customLawyers;
    }
    step.lawyerHandoff.offerFilter = {
      version: 1,
      mode: mode,
      lawyerIds: ids,
      singleLawyerId: singleLawyerId,
      updatedAt: zdajIso(),
    };
    /* Združljivostna projekcija – isti podatki, ne drug vir resnice. */
    step.lawyerHandoff.visibleLawyerIds = ids.slice();

    /* Filter prikaza NE spreminja izbranega paketa/odvetnika, zato ne
       označimo predaje kot needs_review. */
    return osveziPlanStatus(plan);
  }

  /** Čisti helper za draft filtra: vrne novo { lawyerIds, singleLawyerId },
      ko uporabnik doda novega lastnega odvetnika. Ne mutira vhoda. V načinu
      single_lawyer nov odvetnik takoj postane izbrani (in edini) odvetnik. */
  function dodajOdvetnikaVDraftStanje(draft, novOdvetnikId) {
    var d = draft || {};
    var id = String(novOdvetnikId || "");
    var lawyerIds = Array.isArray(d.lawyerIds) ? d.lawyerIds.slice() : [];
    var singleLawyerId = d.singleLawyerId || null;
    if (d.mode === "single_lawyer") {
      singleLawyerId = id;
      lawyerIds = [id];
    } else {
      if (id && lawyerIds.indexOf(id) < 0) lawyerIds.push(id);
      singleLawyerId = null;
    }
    return { lawyerIds: lawyerIds, singleLawyerId: singleLawyerId };
  }

  /** @param {object} [podatkiKorak1] – če je podan in sporočilo ni ročno
      popravljeno, se samodejno besedilo takoj osveži za nov namen (ne šele
      ob naslednjem uskladiZVhodi). */
  function posodobiNamenPredaje(plan, index, namen, podatkiKorak1) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "manual_lawyer") return plan;
    if (VELJAVNI_NAMENI_PREDAJE.indexOf(namen) < 0) return plan;
    if (!step.lawyerHandoff) step.lawyerHandoff = praznaPredajaOdvetniku();
    step.lawyerHandoff.requestedAction = namen;
    if (!step.lawyerHandoff.messageEditedManually) {
      var ctx = {
        imeDolznika: podatkiKorak1 && podatkiKorak1.imeDolznika,
        amountCents:
          plan.amountCents != null
            ? plan.amountCents
            : eurosToCents(podatkiKorak1 && podatkiKorak1.znesek),
        historyBeforePlan: Array.isArray(plan && plan.historyBeforePlan)
          ? plan.historyBeforePlan
          : Array.isArray(podatkiKorak1 && podatkiKorak1.zgodovinaPredNacrtom)
          ? podatkiKorak1.zgodovinaPredNacrtom
          : [],
      };
      step.lawyerHandoff.message = sestaviSporociloOdvetniku(namen, ctx);
    }
    oznaciPredajaNeedsReview(step.lawyerHandoff);
    return osveziPlanStatus(plan);
  }

  /** @param {boolean} [rocno] – true, ko besedilo spremeni uporabnik (ne
      samodejno osveževanje), da se sporočilo označi kot ročno popravljeno in
      ga uskladiZVhodi ne prepiše več. */
  function posodobiSporociloOdvetniku(plan, index, besedilo, rocno) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "manual_lawyer") return plan;
    if (!step.lawyerHandoff) step.lawyerHandoff = praznaPredajaOdvetniku();
    step.lawyerHandoff.message = String(besedilo || "");
    if (rocno) step.lawyerHandoff.messageEditedManually = true;
    oznaciPredajaNeedsReview(step.lawyerHandoff);
    return osveziPlanStatus(plan);
  }

  /** Doda referenco (ne datoteko) v paket dokumentov za predajo. */
  function dodajDokumentOdvetniku(plan, index, dokument) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "manual_lawyer") return plan;
    if (!step.lawyerHandoff) step.lawyerHandoff = praznaPredajaOdvetniku();
    if (!Array.isArray(step.lawyerHandoff.documents)) {
      step.lawyerHandoff.documents = [];
    }
    var d = dokument || {};
    step.lawyerHandoff.documents.push({
      id:
        d.id ||
        "doc-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      type: d.type || "other",
      source: d.source || "uploaded",
      attachmentId: d.attachmentId || null,
      storagePath: d.storagePath || null,
      groupId: d.groupId || null,
      name: String(d.name || ""),
      mimeType: String(d.mimeType || ""),
      sizeBytes: d.sizeBytes != null ? Number(d.sizeBytes) || null : null,
      status: d.status || "ready",
      descriptionQuestion: String(
        d.descriptionQuestion || "Kdaj je nastala ta slika oziroma dokument?"
      ),
      description: String(d.description || ""),
      descriptionRequired: Boolean(d.descriptionRequired),
      recommendation: String(d.recommendation || ""),
      textOnly: Boolean(d.textOnly),
    });
    oznaciPredajaNeedsReview(step.lawyerHandoff);
    return osveziPlanStatus(plan);
  }

  function odstraniDokumentOdvetniku(plan, index, dokumentId) {
    var step = najdiKorak(plan, index);
    if (!step || !step.lawyerHandoff || !Array.isArray(step.lawyerHandoff.documents)) {
      return plan;
    }
    step.lawyerHandoff.documents = step.lawyerHandoff.documents.filter(function (d) {
      return d.id !== dokumentId;
    });
    oznaciPredajaNeedsReview(step.lawyerHandoff);
    return osveziPlanStatus(plan);
  }

  function posodobiOpisDokumentaOdvetniku(plan, index, dokumentId, odgovor) {
    var step = najdiKorak(plan, index);
    if (!step || !step.lawyerHandoff || !Array.isArray(step.lawyerHandoff.documents)) {
      return plan;
    }
    var dokument = step.lawyerHandoff.documents.find(function (d) {
      return d.id === dokumentId;
    });
    if (!dokument) return plan;
    dokument.description = String(odgovor || "").trim();
    oznaciPredajaNeedsReview(step.lawyerHandoff);
    return osveziPlanStatus(plan);
  }

  function oznaciZunanjePrilogePredajeSpremenjene(plan, index) {
    var step = najdiKorak(plan, index);
    if (!step || !step.lawyerHandoff) return plan;
    oznaciPredajaNeedsReview(step.lawyerHandoff);
    return osveziPlanStatus(plan);
  }

  function prilogePredajeIzKoraka1(podatkiKorak1) {
    var k1 = podatkiKorak1 || {};
    var rezultat = [];

    function dodajDatoteke(type, poti, meta, origin) {
      (Array.isArray(poti) ? poti : []).forEach(function (pot, i) {
        if (!pot) return;
        var m = (Array.isArray(meta) ? meta[i] : null) || {};
        rezultat.push({
          documentType: type,
          attachmentId: m.id || null,
          groupId: m.groupId || m.id || null,
          storagePath: String(pot),
          originalFileName:
            m.originalFileName ||
            (type === "invoice" ? "Racun" : "Dokazilo opravljenega dela"),
          mimeType: m.mimeType || "",
          sizeBytes: m.sizeBytes != null ? m.sizeBytes : null,
          origin: origin,
          descriptionQuestion: m.descriptionQuestion || "",
          description: m.description || "",
          descriptionRequired: Boolean(m.descriptionRequired),
          status: "ready",
        });
      });
    }

    dodajDatoteke(
      "invoice",
      k1.racunDatotekePoti,
      k1.attachmentMeta,
      "manual_attachment"
    );
    dodajDatoteke(
      "work_evidence",
      k1.opravljenoDatotekePoti,
      k1.opravljenoAttachmentMeta,
      "work_evidence"
    );

    (Array.isArray(k1.opravljenoBrezSlike) ? k1.opravljenoBrezSlike : []).forEach(
      function (m) {
        if (!m) return;
        rezultat.push({
          documentType: "work_evidence",
          attachmentId: m.id || null,
          groupId: m.groupId || m.id || null,
          storagePath: null,
          originalFileName: m.originalFileName || "Opis opravljenega dela",
          mimeType: "text/plain",
          sizeBytes: null,
          origin: "work_evidence",
          textOnly: true,
          descriptionQuestion: m.descriptionQuestion || "",
          description: m.description || "",
          descriptionRequired: true,
          status: "ready",
        });
      }
    );

    return rezultat;
  }

  /** Normaliziran seznam vseh datotek izbrane kategorije (npr. "invoice").
      Za račun združi uporabniško dodane dokumente iz lawyerHandoff.documents
      in obstoječe prilogeKoraka (zunanji računi iz 1. koraka). Prepreči
      podvojitev iste datoteke: najprej po id, nato po storagePath, nato po
      kombinaciji name + sizeBytes + mimeType. */
  function dokumentiPredajePoTipu(plan, index, type, podatkiKorak1, prilogeKoraka) {
    var step = najdiKorak(plan, index);
    var lh = (step && step.lawyerHandoff) || praznaPredajaOdvetniku();
    var dokumenti = Array.isArray(lh.documents) ? lh.documents : [];
    var seen = Object.create(null);
    var rezultat = [];

    function kljucDatoteke(d) {
      if (d.id) return "id:" + d.id;
      if (d.attachmentId) return "aid:" + d.attachmentId;
      if (d.storagePath) return "sp:" + d.storagePath;
      return (
        "ns:" +
        String(d.name || "") +
        "|" +
        (d.sizeBytes != null ? d.sizeBytes : "") +
        "|" +
        String(d.mimeType || "")
      );
    }

    function dodaj(d) {
      if (!d) return;
      if (d.status && d.status !== "ready") return;
      var k = kljucDatoteke(d);
      if (seen[k]) return;
      seen[k] = true;
      rezultat.push({
        id: d.id || null,
        type: type,
        source: d.source || "uploaded",
        attachmentId: d.attachmentId || null,
        groupId: d.groupId || d.id || d.attachmentId || null,
        storagePath: d.storagePath || null,
        name: d.name || d.originalFileName || "",
        mimeType: d.mimeType || "",
        sizeBytes: d.sizeBytes != null ? d.sizeBytes : null,
        status: d.status || "ready",
        descriptionQuestion: String(
          d.descriptionQuestion || "Kdaj je nastala ta slika oziroma dokument?"
        ),
        description: String(d.description || ""),
        descriptionRequired: Boolean(d.descriptionRequired),
        recommendation: String(d.recommendation || ""),
        textOnly: Boolean(d.textOnly),
      });
    }

    dokumenti.forEach(function (d) {
      if (d.type === type) dodaj(d);
    });

    if (type === "invoice" || type === "work_evidence") {
      var zunanjePriloge = prilogePredajeIzKoraka1(podatkiKorak1).concat(
        Array.isArray(prilogeKoraka) ? prilogeKoraka : []
      );
      zunanjePriloge.forEach(function (p) {
        if (!p) return;
        var tipPriloge = p.documentType || "invoice";
        if (tipPriloge !== type) return;
        dodaj({
          id: null,
          source: "uploaded",
          attachmentId: p.attachmentId || null,
          groupId: p.groupId || p.attachmentId || null,
          storagePath: p.storagePath || null,
          name: p.originalFileName || p.name || "",
          mimeType: p.mimeType || "",
          sizeBytes: p.sizeBytes != null ? p.sizeBytes : null,
          status: p.status,
          descriptionQuestion: p.descriptionQuestion,
          description: p.description,
          descriptionRequired: p.descriptionRequired,
          textOnly: Boolean(p.textOnly),
        });
      });
    }

    return rezultat;
  }

  /** Enoten vir stanja dokumentov za sestavljalnik 10. koraka (Faza 7).
      Uporabljajo ga izris, validacija (preveriPogojeZaPripravoPredaje) in
      sestaviPreparedSnapshot, da se pripravljenost/število dokumentov nikoli
      ne izračuna na več različnih mestih. Vedno vrne natanko 4 osnovne
      ploščice (račun, podatki dolžnika, zgodovina opominov, pogodba); dodatna
      dokazila ne spreminjajo imenovalca 4. Vsaka ploščica ima tudi poln
      seznam datotek (files) in število datotek (fileCount). */
  function dokumentnoStanjePredaje(plan, index, podatkiKorak1, prilogeKoraka) {
    var step = najdiKorak(plan, index);
    var lh = (step && step.lawyerHandoff) || praznaPredajaOdvetniku();
    var k1 = podatkiKorak1 || {};
    var dokumenti = Array.isArray(lh.documents) ? lh.documents : [];

    function uporabiZahtevoOdvetnika(files, type) {
      var zahteve = (lh.lawyerSnapshot && lh.lawyerSnapshot.attachmentRequirements) || {};
      var zahteva = zahteve[type] || {};
      return files.map(function (d) {
        return Object.assign({}, d, {
          descriptionQuestion:
            zahteva.question ||
            d.descriptionQuestion ||
            "Kdaj je nastala ta slika oziroma dokument?",
          descriptionRequired: Boolean(zahteva.required || d.descriptionRequired),
        });
      });
    }

    var racunFiles = dokumentiPredajePoTipu(plan, index, "invoice", k1, prilogeKoraka);
    var pogodbaFiles = dokumentiPredajePoTipu(plan, index, "contract", k1, prilogeKoraka);
    var dolznikFiles = dokumentiPredajePoTipu(plan, index, "debtor_info", k1, prilogeKoraka);
    var zgodovinaFiles = dokumentiPredajePoTipu(plan, index, "reminder_history", k1, prilogeKoraka);
    var opravljenoFiles = dokumentiPredajePoTipu(plan, index, "work_evidence", k1, prilogeKoraka);
    racunFiles = uporabiZahtevoOdvetnika(racunFiles, "invoice");
    pogodbaFiles = uporabiZahtevoOdvetnika(pogodbaFiles, "contract");
    dolznikFiles = uporabiZahtevoOdvetnika(dolznikFiles, "debtor_info");
    zgodovinaFiles = uporabiZahtevoOdvetnika(zgodovinaFiles, "reminder_history");
    opravljenoFiles = uporabiZahtevoOdvetnika(opravljenoFiles, "work_evidence");

    var imeDolznikaVeljavno = Boolean(String(k1.imeDolznika || "").trim());

    var steviloOpominov = (plan && Array.isArray(plan.steps) ? plan.steps : [])
      .filter(function (s) {
        return s.kind !== "manual_lawyer" && !s.isExcluded;
      }).length;
    var zgodovinskiDogodki = Array.isArray(plan && plan.historyBeforePlan)
      ? plan.historyBeforePlan.filter(Boolean)
      : Array.isArray(k1.zgodovinaPredNacrtom)
      ? k1.zgodovinaPredNacrtom.filter(Boolean)
      : [];
    var steviloZgodovinskihDogodkov = zgodovinskiDogodki.length;

    var dodatniDokumenti = dokumenti
      .filter(function (d) {
        return d.type === "other" && d.status === "ready";
      })
      .map(function (d) {
        return {
          id: d.id,
          type: "other",
          title: d.name || "Dokazilo",
          status: "ready",
          subtitle: d.name || "",
          fileCount: 1,
          files: [
            {
              id: d.id,
              type: "other",
              source: d.source || "uploaded",
              attachmentId: d.attachmentId || null,
              storagePath: d.storagePath || null,
              name: d.name || "",
              mimeType: d.mimeType || "",
              sizeBytes: d.sizeBytes != null ? d.sizeBytes : null,
              status: "ready",
              descriptionQuestion: d.descriptionQuestion,
              description: d.description,
              descriptionRequired: Boolean(d.descriptionRequired),
            },
          ],
          documentId: d.id,
          storagePath: d.storagePath || null,
        };
      })
      .concat(
        opravljenoFiles.map(function (d) {
          return {
            id: d.id || d.attachmentId || d.storagePath,
            type: "work_evidence",
            title: d.name || "Dokazilo opravljenega dela",
            status: "ready",
            subtitle: d.description || "Dokazilo opravljenega dela",
            fileCount: 1,
            files: [d],
            documentId: d.id || null,
            storagePath: d.storagePath || null,
          };
        })
      );

    /* Stranka je lahko izrecno izjavila, da računa ne more priložiti (gumb
       "Nimam" ob "Priložite račun"). Ta izjava šteje enako kot dejansko
       priložen račun za pripravljenost predaje odvetniku – glej tudi
       preveriPogojeZaPripravoPredaje spodaj. */
    var racunNiNaVoljo = Boolean(k1.racunNiNaVoljo) && !racunFiles.length;

    var osnovniDokumenti = [
      {
        type: "invoice",
        title: "Račun",
        status: racunFiles.length || racunNiNaVoljo ? "ready" : "missing",
        subtitle: racunNiNaVoljo
          ? "Stranka nima računa"
          : besediloStevilaDatotek(racunFiles.length),
        fileCount: racunFiles.length,
        files: racunFiles,
        generatedReady: racunNiNaVoljo,
        documentId: racunFiles.length ? racunFiles[0].id : null,
        storagePath: racunFiles.length ? racunFiles[0].storagePath || null : null,
      },
      {
        type: "debtor_info",
        title: "Podatki dolžnika",
        status: imeDolznikaVeljavno ? "ready" : "missing",
        subtitle: imeDolznikaVeljavno
          ? "Pripravljeno · " + stevecDatotek(dolznikFiles.length)
          : "Ni vnesenih podatkov",
        fileCount: dolznikFiles.length,
        files: dolznikFiles,
        generatedReady: imeDolznikaVeljavno,
        documentId: null,
        storagePath: null,
      },
      {
        type: "reminder_history",
        title: "Zgodovina primera",
        status: steviloOpominov > 0 || steviloZgodovinskihDogodkov > 0 ? "ready" : "missing",
        subtitle: steviloZgodovinskihDogodkov > 0
          ? "Pripravljeno · " + steviloZgodovinskihDogodkov + " " + slovenskaOblika(steviloZgodovinskihDogodkov, ["dogodek", "dogodka", "dogodki", "dogodkov"])
          : steviloOpominov > 0
          ? "Pripravljeno · " + stevecDatotek(zgodovinaFiles.length)
          : "Ni zapisov",
        fileCount: zgodovinaFiles.length,
        files: zgodovinaFiles,
        generatedReady: steviloOpominov > 0 || steviloZgodovinskihDogodkov > 0,
        documentId: null,
        storagePath: null,
      },
      {
        type: "contract",
        title: "Pogodba ali ponudba",
        status: pogodbaFiles.length ? "ready" : "missing",
        subtitle: besediloStevilaDatotek(pogodbaFiles.length),
        fileCount: pogodbaFiles.length,
        files: pogodbaFiles,
        generatedReady: false,
        documentId: pogodbaFiles.length ? pogodbaFiles[0].id : null,
        storagePath: pogodbaFiles.length ? pogodbaFiles[0].storagePath || null : null,
      },
    ];

    var preparedCount = osnovniDokumenti.filter(function (d) {
      return d.status === "ready";
    }).length;

    return {
      osnovniDokumenti: osnovniDokumenti,
      dodatniDokumenti: dodatniDokumenti,
      preparedCount: preparedCount,
      baseTotal: 4,
      allCount: 4 + dodatniDokumenti.length,
      reminderCount: steviloOpominov,
      historyBeforePlanCount: steviloZgodovinskihDogodkov,
    };
  }

  /** Obvezni podatki za pripravo predaje (odsek 11 specifikacije): dolžnik,
      znesek, priložen račun, dokumenti, ki jih zahteva izbrani odvetnik,
      izbran odvetnik, izbran paket, namen in sporočilo. Manjkajoča resnično
      neobvezna dokazila ne blokirajo. */
  function preveriPogojeZaPripravoPredaje(plan, index, podatkiKorak1, prilogeKoraka) {
    var step = najdiKorak(plan, index);
    var manjkajoce = [];
    if (!step || step.kind !== "manual_lawyer") {
      return { ok: false, manjkajoce: ["Korak ni najden."] };
    }
    var lh = step.lawyerHandoff || praznaPredajaOdvetniku();
    var k1 = podatkiKorak1 || {};

    if (!String(k1.imeDolznika || "").trim()) manjkajoce.push("Ime dolžnika");
    if (!String(k1.opisDolga || "").trim()) manjkajoce.push("Kaj je bilo opravljeno");

    var znesekNum =
      plan.amountCents != null
        ? plan.amountCents / 100
        : Number(k1.znesek);
    if (!(znesekNum > 0)) manjkajoce.push("Znesek dolga");

    var dokStanje = dokumentnoStanjePredaje(plan, index, podatkiKorak1, prilogeKoraka);
    var racunTile = dokStanje.osnovniDokumenti.find(function (d) {
      return d.type === "invoice";
    });
    var racunNiNaVoljoDeklarirano = Boolean(k1.racunNiNaVoljo) && !(racunTile && racunTile.fileCount > 0);
    if (
      !racunTile ||
      racunTile.status !== "ready" ||
      (!(racunTile.fileCount > 0) && !racunNiNaVoljoDeklarirano)
    ) {
      manjkajoce.push("Priložen račun");
    }

    var snap = lh.lawyerSnapshot || {};
    if (!String(snap.name || "").trim() && !String(snap.officeName || "").trim()) {
      manjkajoce.push("Izbran odvetnik");
    }

    if (!lh.selectedPackage || !lh.selectedPackage.packageId) {
      manjkajoce.push("Izbran paket");
    }

    if (VELJAVNI_NAMENI_PREDAJE.indexOf(lh.requestedAction) < 0) {
      manjkajoce.push("Namen predaje");
    }

    if (!String(lh.message || "").trim()) {
      manjkajoce.push("Sporočilo odvetniku");
    }

    /* Izbrani odvetnik lahko poleg računa zahteva še posamezne vrste dokazil.
       Samodejno ustvarjen povzetek podatkov ne šteje kot priložena datoteka,
       kadar odvetnik izrecno zahteva dokazilo. Besedilna možnost »Nimam
       slike« pa se shrani kot textOnly dokazilo in zato veljavno šteje. */
    var zahtevePrilog = (lh.lawyerSnapshot && lh.lawyerSnapshot.attachmentRequirements) || {};
    var oznakeDokumentov = {
      invoice: "Priložen račun",
      debtor_info: "Dokazilo o podatkih dolžnika",
      reminder_history: "Dokazilo o dosedanji komunikaciji",
      contract: "Pogodba ali ponudba",
      work_evidence: "Dokazilo opravljenega dela",
    };
    Object.keys(zahtevePrilog).forEach(function (tip) {
      if (!zahtevePrilog[tip] || !zahtevePrilog[tip].required) return;
      var imaDokument = false;
      if (tip === "work_evidence") {
        imaDokument = dokStanje.dodatniDokumenti.some(function (d) {
          return d.type === "work_evidence" && d.fileCount > 0;
        });
      } else {
        var ploscica = dokStanje.osnovniDokumenti.find(function (d) {
          return d.type === tip;
        });
        imaDokument = Boolean(ploscica && ploscica.fileCount > 0);
      }
      var oznaka = oznakeDokumentov[tip] || "Zahtevano dokazilo";
      if (!imaDokument && manjkajoce.indexOf(oznaka) < 0) manjkajoce.push(oznaka);
    });

    var neopisaneObvezne = dokStanje.osnovniDokumenti
      .concat(dokStanje.dodatniDokumenti)
      .some(function (sklop) {
        return (sklop.files || []).some(function (d) {
          return d.descriptionRequired && !String(d.description || "").trim();
        });
      });
    if (neopisaneObvezne) manjkajoce.push("Opis obveznih prilog");

    return { ok: manjkajoce.length === 0, manjkajoce: manjkajoce };
  }

  /** Nespremenljiv posnetek stanja primera v trenutku priprave predaje –
      poznejše spremembe podatkov nanj ne vplivajo (glej oznaciPredajaNeedsReview). */
  function sestaviPreparedSnapshot(plan, step, podatkiKorak1, prilogeKoraka) {
    var k1 = podatkiKorak1 || {};
    var lh = step.lawyerHandoff || praznaPredajaOdvetniku();
    var dokStanjeZaSnapshot = dokumentnoStanjePredaje(plan, step.index, podatkiKorak1, prilogeKoraka);
    var racunTileZaSnapshot = dokStanjeZaSnapshot.osnovniDokumenti.find(function (d) {
      return d.type === "invoice";
    });

    var zgodovina = (plan.steps || [])
      .filter(function (s) {
        return s.kind !== "manual_lawyer" && !s.isExcluded;
      })
      .map(function (s) {
        var primarniKontakti = s.primaryContacts || { sms: true, email: true };
        var dodatniKontakti = s.customContacts || {};
        var kanali = [];
        if (
          (primarniKontakti.sms !== false && k1.telefonDolznika) ||
          (Array.isArray(dodatniKontakti.phoneNumbers) && dodatniKontakti.phoneNumbers.length)
        ) {
          kanali.push("SMS");
        }
        if (
          (primarniKontakti.email !== false && k1.emailDolznika) ||
          (Array.isArray(dodatniKontakti.emailAddresses) && dodatniKontakti.emailAddresses.length)
        ) {
          kanali.push("E-pošta");
        }
        return {
          index: s.index,
          naslov: s.title || null,
          status: s.status,
          kanali: kanali,
          sendAt:
            (s._randomSchedule &&
              s._randomSchedule.enabled &&
              s._randomSchedule.resolvedScheduledAt) ||
            s.sentAt ||
            s.sendAt ||
            s.scheduledAt ||
            null,
          sporocilo: s.finalMessage || s.generatedMessage || "",
        };
      });

    var odzivDolznika = plan.debtorResponseStatus || plan.paymentStatus || "unknown";
    if (VELJAVNI_ODZIVI_DOLZNIKA.indexOf(odzivDolznika) < 0) odzivDolznika = "unknown";

    return {
      pripravljenoOb: zdajIso(),
      responseStatus: odzivDolznika,
      dolznik: {
        ime: k1.imeDolznika || "",
        vrsta: k1.vrstaDolznika || null,
        davcnaStevilka: k1.davcnaStevilka || null,
        kontaktnaOseba: k1.kontaktnaOseba || null,
        telefon: k1.telefonDolznika || "",
        email: k1.emailDolznika || "",
        znesekCentov:
          plan.amountCents != null
            ? plan.amountCents
            : eurosToCents(k1.znesek),
        stevilkaRacuna: k1.stevilkaRacuna || null,
        racunPriloga:
          racunTileZaSnapshot && racunTileZaSnapshot.status === "ready"
            ? racunTileZaSnapshot.files && racunTileZaSnapshot.files.length === 1
              ? racunTileZaSnapshot.files[0].name
              : true
            : null,
        datumZapadlosti: k1.datumZapadlosti || null,
      },
      odvetnik: {
        lawyerId: lh.lawyerId || null,
        ime: (lh.lawyerSnapshot && lh.lawyerSnapshot.name) || "",
        pisarna: (lh.lawyerSnapshot && lh.lawyerSnapshot.officeName) || "",
        email: (lh.lawyerSnapshot && lh.lawyerSnapshot.email) || "",
        telefon: (lh.lawyerSnapshot && lh.lawyerSnapshot.phone) || "",
        mozniDneviPredaje: normalizirajDnevePredaje(
          lh.availableHandoffDays
        ),
        dneviPredajeSpremenjeniRocno: Boolean(
          lh.availableHandoffDaysEditedManually
        ),
      },
      namenPredaje: lh.requestedAction,
      casPredaje: {
        nacin: lh.handoffTimingMode === "custom" ? "custom" : "asap",
        scheduledAt:
          lh.scheduledHandoffAt || step.sendAt || step.scheduledAt || null,
      },
      sporociloOdvetniku: lh.message || "",
      izbraniPaket: lh.selectedPackage
        ? JSON.parse(JSON.stringify(lh.selectedPackage))
        : null,
      dokumenti: dokStanjeZaSnapshot.osnovniDokumenti.reduce(function (vsi, sklop) {
        return vsi.concat(sklop.files || []);
      }, []).concat(dokStanjeZaSnapshot.dodatniDokumenti.reduce(function (vsi, sklop) {
        return vsi.concat(sklop.files || []);
      }, [])).map(function (d) {
        return {
          id: d.id,
          type: d.type,
          name: d.name,
          mimeType: d.mimeType || "",
          sizeBytes: d.sizeBytes != null ? d.sizeBytes : null,
          status: d.status,
          storagePath: d.storagePath || null,
          attachmentId: d.attachmentId || null,
          groupId: d.groupId || d.id || d.attachmentId || null,
          descriptionQuestion: d.descriptionQuestion || "",
          recommendation: d.recommendation || "",
          description: d.description || "",
          descriptionRequired: Boolean(d.descriptionRequired),
          textOnly: Boolean(d.textOnly),
        };
      }),
      zgodovinaOpominov: zgodovina,
    };
  }

  /** Čist, ponovno uporaben razčlenjevalec cene izbranega paketa (Faza 8,
      končni pregled) – navaden paket da eno postavko, paket po meri (s
      services[]) da po eno postavko na storitev. Cena se sešteje IZKLJUČNO iz
      priceCents; priceLabel se nikoli ne parsa (besedilna oblika ni
      zanesljiva za izračune). */
  function povzetekCenePredaje(izbraniPaket) {
    if (!izbraniPaket) {
      return { postavke: [], znaniSkupajCents: 0, imaCenoPoPonudbi: false };
    }
    var storitve = Array.isArray(izbraniPaket.services) ? izbraniPaket.services : [];
    var postavke;
    if (storitve.length) {
      postavke = storitve.map(function (s, i) {
        var veljavnaCena =
          typeof s.priceCents === "number" && isFinite(s.priceCents) && s.priceCents >= 0;
        return {
          id: s.serviceId || "storitev-" + i,
          naslov: s.titleSnapshot || s.title || "Storitev",
          priceCents: veljavnaCena ? s.priceCents : null,
          priceOnRequest: !veljavnaCena,
        };
      });
    } else {
      var veljavnaCenaPaketa =
        typeof izbraniPaket.priceCents === "number" &&
        isFinite(izbraniPaket.priceCents) &&
        izbraniPaket.priceCents >= 0;
      postavke = [
        {
          id: izbraniPaket.packageId || "paket",
          naslov: izbraniPaket.titleSnapshot || izbraniPaket.title || "Izbrani paket",
          priceCents: veljavnaCenaPaketa ? izbraniPaket.priceCents : null,
          priceOnRequest: !veljavnaCenaPaketa,
        },
      ];
    }
    var znaniSkupajCents = postavke.reduce(function (vsota, p) {
      return vsota + (p.priceCents != null ? p.priceCents : 0);
    }, 0);
    var imaCenoPoPonudbi = postavke.some(function (p) {
      return p.priceOnRequest;
    });
    return {
      postavke: postavke,
      znaniSkupajCents: znaniSkupajCents,
      imaCenoPoPonudbi: imaCenoPoPonudbi,
    };
  }

  /** Pripravi predajo: ustvari nespremenljiv preparedSnapshot in preklopi
      status v "prepared". Idempotentno – ponoven klic brez vmesne spremembe
      podatkov (status ostane "prepared") ne ustvari nove različice niti je ne
      prepiše. Če je status "needs_review" (podatki so se spremenili po
      zadnji pripravi), prejšnjo različico preparedSnapshot pred zamenjavo
      shrani v snapshotHistory kot nespremenljivo revizijsko sled. */
  function pripraviPredajoOdvetniku(plan, index, podatkiKorak1, prilogeKoraka) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "manual_lawyer") return plan;
    if (!step.lawyerHandoff) step.lawyerHandoff = praznaPredajaOdvetniku();
    var lh = step.lawyerHandoff;

    if (lh.status === "prepared" && lh.preparedSnapshot) {
      return plan;
    }

    var preverjeno = preveriPogojeZaPripravoPredaje(
      plan,
      index,
      podatkiKorak1,
      prilogeKoraka
    );
    if (!preverjeno.ok) return plan;

    if (lh.status === "needs_review" && lh.preparedSnapshot) {
      if (!Array.isArray(lh.snapshotHistory)) lh.snapshotHistory = [];
      lh.snapshotHistory.push({
        snapshot: lh.preparedSnapshot,
        preparedAt: lh.preparedAt,
        supersededAt: zdajIso(),
      });
    }

    lh.preparedSnapshot = sestaviPreparedSnapshot(
      plan,
      step,
      podatkiKorak1,
      prilogeKoraka
    );
    lh.preparedAt = zdajIso();
    lh.status = "prepared";
    /* Nov ključ ob vsaki novi različici – prihodnji strežnik ga lahko uporabi
       za razločevanje poskusov predaje te konkretne različice paketa. */
    lh.handoverIdempotencyKey = generirajIdempotencyKljuc();
    return osveziPlanStatus(plan);
  }

  /** Ali je predajo trenutno dovoljeno izvesti (za gumb "Predaj odvetniku").
      Samo status "prepared" z veljavnim posnetkom – "needs_review" predajo
      blokira, dokler uporabnik ne pripravi nove različice. */
  function moznaPredajaOdvetniku(lawyerHandoff) {
    return Boolean(
      lawyerHandoff &&
        lawyerHandoff.status === "prepared" &&
        lawyerHandoff.preparedSnapshot
    );
  }

  /** Izvede dejansko predajo odvetniku. Klicati šele PO uspešno zaključeni
      (bodoči) strežniški operaciji – ta funkcija samo zapiše lokalni rezultat.
      Idempotentno: če je predaja že izvedena, se ne spremeni ničesar (ščiti
      pred dvojnim klikom ali podvojeno zahtevo). Ne dotakne se preparedSnapshot,
      ki ostane nespremenljiv tudi po predaji. */
  function izvediPredajoOdvetniku(plan, index) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "manual_lawyer") return plan;
    var lh = step.lawyerHandoff;
    if (!lh) return plan;
    if (lh.status === "handed_over" && lh.handedOverAt) {
      return plan;
    }
    if (!moznaPredajaOdvetniku(lh)) return plan;
    lh.status = "handed_over";
    lh.handedOverAt = zdajIso();
    return osveziPlanStatus(plan);
  }

  /** Uporabnik ročno evidentira, da je zadevo odvetniku predal SAM, mimo
      aplikacije (pošta, e-pošta, osebno) – dokler ni povezanega ponudnika,
      ki bi predajo dejansko izvedel, to NE sme nastaviti statusa
      "handed_over" (ta je rezerviran izključno za uspešen odgovor strežnika,
      glej izvediPredajoOdvetniku). Zapiše samo informativen časovni žig.
      Idempotentno: če je evidenca za trenutno različico že zapisana, je
      ponoven klic ne sme prepisati (izvirni čas ostane veljaven). */
  function oznaciRocnoPredanoOdvetniku(plan, index) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "manual_lawyer") return plan;
    var lh = step.lawyerHandoff;
    if (!moznaPredajaOdvetniku(lh)) return plan;
    if (lh.manuallyConfirmedAt) return plan;
    lh.manuallyConfirmedAt = zdajIso();
    return osveziPlanStatus(plan);
  }

  /** Faza D končnega pregleda (korak "Predaja odvetniku"): "Dokončaj načrt in
      pripravi paket". Zaključi zadnji korak in pripravljeni paket pusti
      pripravljen za POZNEJŠO ročno predajo – NE izvede dejanske predaje (glej
      izvediPredajoOdvetniku/oznaciRocnoPredanoOdvetniku za to), ne pošlje
      ničesar, ne nastavi handedOverAt/status "handed_over". Zahteva veljaven
      preparedSnapshot (status "prepared") – če je "needs_review" ali snapshot
      manjka, se ne izvede nič. Idempotentno: ponoven klic po uspešnem prvem
      klicu ne spremeni ničesar. */
  function dokoncajRocnoPredajoNacrta(plan, index) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "manual_lawyer") return plan;
    var lh = step.lawyerHandoff;
    if (!moznaPredajaOdvetniku(lh)) return plan;
    if (step.status === "confirmed" && lh.manualHandoffAcknowledgedAt) {
      return plan;
    }
    if (!lh.manualHandoffAcknowledgedAt) lh.manualHandoffAcknowledgedAt = zdajIso();
    if (!lh.readyForManualHandoffAt) lh.readyForManualHandoffAt = zdajIso();
    return potrdiKorak(plan, index, "");
  }

  /** Koncni klik »Potrdi oddajo« sme potrditi samo zadnji rocni korak.
      Vsi prejsnji vkljuceni koraki morajo biti ze posebej izpolnjeni in
      potrjeni; zadnji korak jih ne sme samodejno potrditi namesto uporabnika. */
  function potrdiCelotenNacrtZaOddajo(plan, indexPredaje) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    var predaja = najdiKorak(plan, indexPredaje);
    if (
      !predaja ||
      predaja.kind !== "manual_lawyer" ||
      !moznaPredajaOdvetniku(predaja.lawyerHandoff)
    ) {
      return plan;
    }

    var samodejni = plan.steps.filter(function (step) {
      return (
        step &&
        !step.isExcluded &&
        step.kind !== "manual_lawyer" &&
        step.deliveryMode !== "manual"
      );
    });
    var vsiSoIzpolnjeniInPotrjeni = samodejni.every(function (step) {
      return (
        step.status === "confirmed" &&
        Boolean(String(step.finalMessage || step.generatedMessage || "").trim())
      );
    });
    if (!vsiSoIzpolnjeniInPotrjeni) return plan;
    return dokoncajRocnoPredajoNacrta(plan, indexPredaje);
  }

  function potrdiKorak(plan, index, besedilo) {
    var step = najdiKorak(plan, index);
    if (!step) return plan;

    if (step.kind === "manual_lawyer") {
      step.status = "confirmed";
      step.messageNeedsReview = false;
      step.reviewRequiredAt = null;
      step.reviewRequiredRevision = null;
      step.confirmedAt = zdajIso();
      step.confirmedSnapshotHash = korakSnapshotHash(step);
      step.snapshotHash = step.confirmedSnapshotHash;
      return osveziPlanStatus(plan);
    }

    var t = String(besedilo != null ? besedilo : step.finalMessage || "").trim();
    if (!t) return plan;
    step.finalMessage = t;
    step.status = "confirmed";
    step.messageNeedsReview = false;
    step.reviewRequiredAt = null;
    step.reviewRequiredRevision = null;
    step.confirmedAt = zdajIso();
    step.confirmedSnapshotHash = korakSnapshotHash(step);
    step.snapshotHash = step.confirmedSnapshotHash;
    return osveziPlanStatus(plan);
  }

  function nastaviKeepIntervals(plan, vrednost) {
    plan.keepStageIntervals = Boolean(vrednost);
    return osveziPlanStatus(plan);
  }

  /**
   * Premakni čas koraka.
   * @param {object} [opts]
   * @param {boolean} [opts.shiftFollowing=true] – prestavi tudi naslednje premakljive korake
   */
  function posodobiCasKoraka(plan, index, novSendAtIso, opts) {
    var step = najdiKorak(plan, index);
    if (!step || !novSendAtIso) return plan;
    if (!jeKorakPremakljiv(step)) return plan;

    var options = opts || {};
    var shiftFollowing =
      options.shiftFollowing != null
        ? Boolean(options.shiftFollowing)
        : Boolean(plan.keepStageIntervals);

    var staroIso = step.sendAt || step.scheduledAt || null;
    var staro = staroIso ? new Date(staroIso) : new Date();
    var novo = new Date(novSendAtIso);
    if (Number.isNaN(novo.getTime())) return plan;
    if (
      step.kind !== "manual_lawyer" &&
      step.deliveryMode !== "manual" &&
      !jeUraVDovoljenemOkvirju(plan, novo.toISOString(), step)
    ) {
      return plan;
    }

    /* Če se osnovni čas spremeni, razveljavi star naključni izračun. */
    if (step._randomSchedule && step._randomSchedule.enabled) {
      step._randomSchedule.resolvedScheduledAt = null;
      step._randomSchedule.resolvedAt = null;
      delete step._randomSchedule._previewResolvedAt;
      delete step._randomSchedule._previewGeneratedAt;
      delete step._randomSchedule._previewBaseAt;
    }

    var deltaMs = novo.getTime() - staro.getTime();
    /* Če so nastavljeni aktivni dnevi, prestavi na najbližji aktiven dan – v
       SMERI spremembe (naprej, če uporabnik datum pomika naprej/enako; nazaj,
       če ga pomika nazaj). Brez tega bi npr. klik "−" na dan, ki mu neposredno
       sledi neaktiven dan, vedno "poskočil" nazaj na izhodiščni datum (naprej
       čez neaktiven dan) in gumb bi bil videti zamrznjen. */
    var aktivniDnevi = plan._aktivniDnevi;
    if (Array.isArray(aktivniDnevi) && aktivniDnevi.length === 7) {
      var vseAktivni = aktivniDnevi.every(function (a) { return a; });
      if (!vseAktivni) {
        /* Spodnja meja za morebitno prilagoditev NAZAJ: nikoli pred danes IN
           nikoli pred (začetkom dne) prejšnjega, ne-izključenega koraka –
           sicer bi se ta korak lahko znašel PRED prejšnjim (negativen razmik). */
        var spodnjaMejaMs = danesZacetekSafe();
        var idxTegaKoraka = (plan.steps || []).indexOf(step);
        for (var piMeja = idxTegaKoraka - 1; piMeja >= 0; piMeja--) {
          var morebitniPrejsnji = plan.steps[piMeja];
          if (morebitniPrejsnji && !morebitniPrejsnji.isExcluded) {
            var prejsnjiCasMs = new Date(
              morebitniPrejsnji.sendAt || morebitniPrejsnji.scheduledAt
            ).getTime();
            if (!Number.isNaN(prejsnjiCasMs)) {
              var zacetekPrejsnjegaDneva = new Date(prejsnjiCasMs);
              zacetekPrejsnjegaDneva.setHours(0, 0, 0, 0);
              if (zacetekPrejsnjegaDneva.getTime() > spodnjaMejaMs) {
                spodnjaMejaMs = zacetekPrejsnjegaDneva.getTime();
              }
            }
            break;
          }
        }

        var dan = novo.getDay(); // 0=Ned
        var sloIdx = dan === 0 ? 6 : dan - 1; // Pon=0...Ned=6
        if (!aktivniDnevi[sloIdx]) {
          var smerNazaj = deltaMs < 0;
          var pristejDni = 1;
          for (var adjD = 1; adjD <= 7; adjD++) {
            var ni = smerNazaj ? (sloIdx - adjD + 7) % 7 : (sloIdx + adjD) % 7;
            if (aktivniDnevi[ni]) { pristejDni = adjD; break; }
          }
          var poskusniNovo = new Date(novo.getTime());
          poskusniNovo.setDate(
            poskusniNovo.getDate() + (smerNazaj ? -pristejDni : pristejDni)
          );
          if (smerNazaj && poskusniNovo.getTime() < spodnjaMejaMs) {
            /* Nazaj bi šlo pred danes ali pred prejšnji korak – namesto tega
               prestavi naprej. */
            smerNazaj = false;
            pristejDni = 1;
            for (var adjF = 1; adjF <= 7; adjF++) {
              var niF = (sloIdx + adjF) % 7;
              if (aktivniDnevi[niF]) { pristejDni = adjF; break; }
            }
            poskusniNovo = new Date(novo.getTime());
            poskusniNovo.setDate(poskusniNovo.getDate() + pristejDni);
          }
          novo = poskusniNovo;
          step._preskokDni = smerNazaj ? -pristejDni : pristejDni;
        } else {
          step._preskokDni = 0;
        }
      }
    }
    step.sendAt = novo.toISOString();
    step.scheduledAt = step.sendAt;
    step.manualScheduleOverride = true;

    /* Razveljavi naključni čas na vseh naslednjih nepotrjenih korakih. */
    (plan.steps || []).forEach(function (s) {
      if (Number(s.index) > Number(step.index) && s._randomSchedule && s._randomSchedule.enabled && s.status !== "confirmed") {
        s._randomSchedule.resolvedScheduledAt = null;
        s._randomSchedule.resolvedAt = null;
        delete s._randomSchedule._previewResolvedAt;
        delete s._randomSchedule._previewGeneratedAt;
        delete s._randomSchedule._previewBaseAt;
      }
    });

    /* Preračunaj odmik od prvega koraka, da carousel takoj prikaže nov datum. */
    var prvi = plan.steps && plan.steps[0];
    if (prvi) {
      var off = koledarskiDneviMed(
        prvi.sendAt || prvi.scheduledAt,
        step.sendAt
      );
      if (off != null) {
        step.scheduledOffsetDays = off;
        step.offsetDays = off;
      }
    }
    oznaciNeedsReview(step);

    if (shiftFollowing && deltaMs !== 0) {
      var premakljivi = (plan.steps || []).filter(function (s) {
        return Number(s.index) > Number(step.index) && jeKorakPremakljiv(s);
      });
      if (premakljivi.length) {
        if (Number(step.index) === 1 && options.gapDays == null) {
          premakljivi.forEach(function (s) {
            var stariRazmik = koledarskiDneviMed(
              staro.toISOString(),
              s.sendAt || s.scheduledAt
            );
            var dnPrvi = new Date(novo.getTime());
            dnPrvi.setDate(
              dnPrvi.getDate() + Math.max(0, Number(stariRazmik) || 0)
            );
            dnPrvi.setHours(novo.getHours(), novo.getMinutes(), 0, 0);
            s.sendAt = dnPrvi.toISOString();
            s.scheduledAt = s.sendAt;
            s._preskokDni = 0;
            oznaciNeedsReview(s);
          });
        } else {
        var intervalDni =
          options.gapDays != null
            ? Math.max(0, Math.round(Number(options.gapDays)))
            : null;
        if (
          intervalDni == null ||
          !Number.isFinite(intervalDni) ||
          intervalDni <= 0
        ) {
          /* Razmik, ki ga ravnokar določamo (prejšnji korak → ta korak),
             postane predloga za razmik do vseh naslednjih korakov –
             ne stari razmik do koraka, ki mu je sledil pred to spremembo. */
          intervalDni = null;
          var prejsnjiKorak = najdiKorak(plan, Number(step.index) - 1);
          var prejsnjiKorakCas = prejsnjiKorak
            ? parseLocalDateTime(
                prejsnjiKorak.sendAt || prejsnjiKorak.scheduledAt
              )
            : null;
          if (prejsnjiKorakCas) {
            intervalDni = koledarskiDneviMed(
              prejsnjiKorakCas.toISOString(),
              novo.toISOString()
            );
          }
          if (
            intervalDni == null ||
            !Number.isFinite(intervalDni) ||
            intervalDni <= 0
          ) {
            intervalDni = 1;
          }
        }
        var prejsnjiCas = novo;
        premakljivi.forEach(function (s) {
          var dn = new Date(prejsnjiCas.getTime());
          dn.setDate(dn.getDate() + intervalDni);
          dn.setHours(novo.getHours(), novo.getMinutes(), 0, 0);
          s.sendAt = dn.toISOString();
          s.scheduledAt = s.sendAt;
          /* Svež "čist" datum, brez podedovanega zamika – morebiten zamik
             zaradi neaktivnega dne se ponovno izračuna spodaj. */
          s._preskokDni = 0;
          oznaciNeedsReview(s);
          prejsnjiCas = dn;
        });
        }
      }
    }

    uskladiOffseteIzDatumov(plan);
    if (!plan.activationAt && plan.steps[0]) {
      plan.activationAt = plan.steps[0].sendAt;
    }
    return osveziPlanStatus(plan);
  }

  /**
   * Validacija pred shranjevanjem časa koraka.
   * @returns {{ ok: boolean, napaka: string|null, preview: object }}
   */
  function validirajCasKoraka(plan, index, novSendAtIso, shiftFollowing, opts) {
    var step = najdiKorak(plan, index);
    var preview = {
      shiftedCount: 0,
      lastSendAt: null,
      nextGapDays: null,
      onlyCurrent: !shiftFollowing,
    };
    var zacetekDanes = danesZacetekSafe();

    if (!step) {
      return { ok: false, napaka: "Korak ni najden.", preview: preview };
    }
    if (!jeKorakPremakljiv(step)) {
      return {
        ok: false,
        napaka: "Poslanega koraka ni mogoče spreminjati.",
        preview: preview,
      };
    }

    var novo = parseLocalDateTime(novSendAtIso);
    if (!novo) {
      return { ok: false, napaka: "Neveljaven datum.", preview: preview };
    }

    if (
      step.kind !== "manual_lawyer" &&
      step.deliveryMode !== "manual" &&
      !jeUraVDovoljenemOkvirju(plan, novo.toISOString(), step)
    ) {
      var dovoljenoOkno = dovoljenoOknoZaKorak(plan, step);
      return {
        ok: false,
        napaka:
          "Časa " +
          String(novo.getHours()).padStart(2, "0") +
          ":" +
          String(novo.getMinutes()).padStart(2, "0") +
          " ni mogoče izbrati zaradi omejitve. Dovoljeno je od " +
          dovoljenoOkno.start +
          " do " +
          dovoljenoOkno.end +
          ".",
        preview: preview,
      };
    }

    if (novo.getTime() < zacetekDanes) {
      return {
        ok: false,
        napaka: "Datum ne sme biti v preteklosti.",
        preview: preview,
      };
    }

    /* Korak ne sme biti pred prejšnjim (ne-izključenim) korakom – sicer bi
       razmik med koraki postal negativen. */
    var idxTegaValid = (plan.steps || []).indexOf(step);
    for (var piValid = idxTegaValid - 1; piValid >= 0; piValid--) {
      var morebitniPrejsnjiValid = plan.steps[piValid];
      if (morebitniPrejsnjiValid && !morebitniPrejsnjiValid.isExcluded) {
        var prejsnjiCasValid = parseLocalDateTime(
          morebitniPrejsnjiValid.sendAt || morebitniPrejsnjiValid.scheduledAt
        );
        if (prejsnjiCasValid && novo.getTime() < prejsnjiCasValid.getTime()) {
          return {
            ok: false,
            napaka: "Datum ne sme biti pred prejšnjim korakom.",
            preview: preview,
          };
        }
        break;
      }
    }

    var vOpts = opts || {};

    if (shiftFollowing) {
      var premakljivi = (plan.steps || []).filter(function (s) {
        return Number(s.index) > Number(step.index) && jeKorakPremakljiv(s);
      });
      var count = 0;
      var lastIso = novo.toISOString();
      var badPast = false;
      var intervalDni =
        vOpts.gapDays != null
          ? Math.max(0, Math.round(Number(vOpts.gapDays)))
          : null;
      if (
        intervalDni == null ||
        !Number.isFinite(intervalDni) ||
        intervalDni <= 0
      ) {
        intervalDni = null;
        var prviNaslednji = premakljivi[0];
        if (prviNaslednji) {
          var stariNaslednjiCas = parseLocalDateTime(
            prviNaslednji.sendAt || prviNaslednji.scheduledAt
          );
          if (stariNaslednjiCas) {
            intervalDni = koledarskiDneviMed(
              step.sendAt || step.scheduledAt,
              stariNaslednjiCas.toISOString()
            );
          }
        }
        if (
          intervalDni == null ||
          !Number.isFinite(intervalDni) ||
          intervalDni <= 0
        ) {
          intervalDni = 1;
        }
      }
      var prejsnjiCas = novo;
      premakljivi.forEach(function (s) {
        count += 1;
        var dn = new Date(prejsnjiCas.getTime());
        dn.setDate(dn.getDate() + intervalDni);
        dn.setHours(novo.getHours(), novo.getMinutes(), 0, 0);
        lastIso = dn.toISOString();
        if (dn.getTime() < zacetekDanes) badPast = true;
        prejsnjiCas = dn;
      });
      preview.shiftedCount = count;
      preview.lastSendAt = lastIso;
      if (badPast) {
        return {
          ok: false,
          napaka: "Premik bi postavil prihodnje korake v preteklost.",
          preview: preview,
        };
      }
    }

    return { ok: true, napaka: null, preview: preview };
  }

  function danesZacetekSafe() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  /**
   * Nastavi razmik (v dnevih) od koraka index do naslednjega.
   * Ob shiftFollowing (ali keepStageIntervals) premakne tudi poznejše korake.
   */
  function posodobiRazmikDoNaslednjega(plan, index, noviDneviRazmika, opts) {
    var step = najdiKorak(plan, index);
    if (!step) return plan;

    // Poišči naslednji vključeni ne-odvetniški korak
    var koraki = plan.steps || [];
    var stepIdx = -1;
    for (var fi = 0; fi < koraki.length; fi++) {
      if (koraki[fi].index === index) { stepIdx = fi; break; }
    }
    var naslednji = null;
    for (var ni = stepIdx + 1; ni < koraki.length; ni++) {
      var k = koraki[ni];
      if (k.isExcluded) continue;
      if (k.kind === "manual_lawyer" || k.deliveryMode === "manual") break;
      naslednji = k;
      break;
    }
    if (!naslednji || !jeKorakPremakljiv(naslednji)) return plan;

    var options = opts || {};

    var dnevi = Math.max(0, Math.round(Number(noviDneviRazmika)));
    if (!Number.isFinite(dnevi)) return plan;

    var osnovniSend = step.sendAt
      ? new Date(step.sendAt)
      : new Date();
    if (Number.isNaN(osnovniSend.getTime())) osnovniSend = new Date();

    var novSend = new Date(osnovniSend.getTime());
    novSend.setDate(novSend.getDate() + dnevi);
    // Ohrani obstoječo uro naslednjega koraka
    if (naslednji.sendAt || naslednji.scheduledAt) {
      var naslednjiStari = new Date(naslednji.sendAt || naslednji.scheduledAt);
      if (!Number.isNaN(naslednjiStari.getTime())) {
        novSend.setHours(
          naslednjiStari.getHours(),
          naslednjiStari.getMinutes(),
          naslednjiStari.getSeconds(),
          0
        );
      }
    }

    // Shrani razmike poznejših korakov
    var vkljuceni = koraki.filter(function (s) { return !s.isExcluded; });
    var startShift = false;
    var poznejsiZRazmiki = [];
    var prejsnjiZaRazmik = null;
    for (var vi = 0; vi < vkljuceni.length; vi++) {
      var vk = vkljuceni[vi];
      if (vk.index === naslednji.index) {
        startShift = true;
        prejsnjiZaRazmik = { iso: novSend.toISOString() };
        continue;
      }
      if (startShift && vk.kind !== "manual_lawyer" && vk.deliveryMode !== "manual" && jeKorakPremakljiv(vk)) {
        poznejsiZRazmiki.push({
          index: vk.index,
          days: prejsnjiZaRazmik
            ? koledarskiDneviMed(prejsnjiZaRazmik.iso, vk.sendAt || vk.scheduledAt)
            : 0,
        });
      }
      prejsnjiZaRazmik = { iso: vk.sendAt || vk.scheduledAt };
    }

    // Nastavi naslednji korak brez shiftFollowing
    plan = posodobiCasKoraka(plan, naslednji.index, novSend.toISOString(), {
      shiftFollowing: false,
    });

    // Ročno nastavi poznejše korake z njihovimi ohranjenimi razmiki
    var zadnjiIso = novSend.toISOString();
    for (var pi = 0; pi < poznejsiZRazmiki.length; pi++) {
      var p = poznejsiZRazmiki[pi];
      var razmikDni = Math.max(0, p.days);
      var zadnjiDatum = new Date(zadnjiIso);
      var naslDatum = new Date(zadnjiDatum.getTime() + razmikDni * 86400000);
      // Ohrani obstoječo uro poznejšega koraka
      var poznejsiKorak = najdiKorak(plan, p.index);
      if (poznejsiKorak && (poznejsiKorak.sendAt || poznejsiKorak.scheduledAt)) {
        var poznejsiStari = new Date(poznejsiKorak.sendAt || poznejsiKorak.scheduledAt);
        if (!Number.isNaN(poznejsiStari.getTime())) {
          naslDatum.setHours(
            poznejsiStari.getHours(),
            poznejsiStari.getMinutes(),
            poznejsiStari.getSeconds(),
            0
          );
        }
      }
      plan = posodobiCasKoraka(plan, p.index, naslDatum.toISOString(), {
        shiftFollowing: false,
      });
      zadnjiIso = naslDatum.toISOString();
    }

    return osveziPlanStatus(plan);
  }

  function oznaciAktiviran(plan) {
    plan.status = "activated";
    plan.updatedAt = zdajIso();
    plan.activatedAt = zdajIso();
    return plan;
  }

  function prviNepotrjenSmsIndex(plan) {
    var step = (plan.steps || []).find(function (s) {
      return !s.isExcluded && s.status !== "confirmed";
    });
    return step ? step.index : null;
  }

  function soVsiSmsPotrjeni(plan) {
    if (!plan || !Array.isArray(plan.steps)) return false;
    var vkljuceni = plan.steps.filter(function (step) {
      return step && !step.isExcluded;
    });
    /* Status plana je lahko ze "activated"/"active" (npr. po prekinjeni
       zahtevi ali obnovi osnutka z druge naprave). Zato pripravljenosti ne
       smemo sklepati iz oznake plana, ampak neposredno iz korakov. */
    return (
      vkljuceni.length > 0 &&
      vkljuceni.every(function (step) {
        return step.status === "confirmed";
      })
    );
  }

  /** Zadnji rocni korak je dostopen sele, ko so vsi vkljuceni koraki pred
      njim potrjeni. Izkljucene kartice se namenoma ne stejejo. */
  /* Prej je bila kartica "Predaja odvetniku" zaklenjena, dokler niso bili
     potrjeni vsi prejšnji koraki – uporabnik jo je izrecno hotel odklenjeno,
     zato ta funkcija zdaj vedno vrne null (nič ne blokira). Klicna mesta
     (poudarek na zaklenjeni kartici, blokada klika) ostanejo nedotaknjena. */
  function prviNepotrjenPredZadnjimKorakom(plan, ciljniIndex) {
    return null;
  }

  function steviloPotrjenih(plan) {
    return (plan.steps || []).filter(function (s) {
      return !s.isExcluded && s.status === "confirmed";
    }).length;
  }

  /** Odstrani korak z danim indexom iz plana. Preštevilči prikazne in
      interne indekse, da navigacija med sosednjimi koraki ostane pravilna. */
  function odstraniKorak(plan, index) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    var idx = -1;
    for (var i = 0; i < plan.steps.length; i++) {
      if (Number(plan.steps[i].index) === Number(index)) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return plan;
    var izbraniKorak = (plan.steps || []).find(function (s) {
      return s.id === plan.selectedStageId;
    });
    plan.steps.splice(idx, 1);
    /* UI išče prejšnji/naslednji korak z index - 1 oziroma index + 1,
       zato morajo po odstranitvi ostati zaporedni tudi interni indeksi. */
    for (var j = 0; j < plan.steps.length; j++) {
      var korak = plan.steps[j];
      var novoZaporedje = j + 1;
      korak.index = novoZaporedje;
      korak.order = novoZaporedje;
      korak.id = "stage-" + novoZaporedje;
    }
    plan.selectedStageId =
      izbraniKorak && plan.steps.indexOf(izbraniKorak) !== -1
        ? izbraniKorak.id
        : plan.steps[0]
          ? plan.steps[0].id
          : null;
    plan.stages = plan.steps;
    plan.totalDurationDays = plan.steps.length
      ? (plan.steps[plan.steps.length - 1].scheduledOffsetDays || 0)
      : 0;
    plan.updatedAt = zdajIso();
    return osveziPlanStatus(plan);
  }

  function steviloSmsKorakov(plan) {
    return (plan.steps || []).filter(function (s) {
      return s.kind === "sms";
    }).length;
  }

  /** Spremeni samo ton izbranega samodejnega koraka. Uporabnikovo besedilo
      ostane nedotaknjeno; že potrjen korak se zaradi spremembe vrne v pregled. */
  function nastaviTonKoraka(plan, index, toneId) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    var noviTon = String(toneId || "");
    if (VELJAVNI_TONI_KORAKA.indexOf(noviTon) < 0) return plan;
    var step = najdiKorak(plan, index);
    if (
      !step ||
      step.isExcluded ||
      step.kind === "manual_lawyer" ||
      step.deliveryMode === "manual"
    ) {
      return plan;
    }
    if (step.toneId === noviTon) return plan;
    step.toneId = noviTon;
    if (step.status === "confirmed" || step.confirmedAt) {
      step.status = "needs_review";
      step.messageNeedsReview = true;
      step.reviewRequiredAt = zdajIso();
      step.reviewRequiredRevision = "review-v1:" + step.reviewRequiredAt;
      step.snapshotHash = null;
      step.confirmedSnapshotHash = null;
      step.confirmedAt = null;
    }
    plan.updatedAt = zdajIso();
    plan.stages = plan.steps;
    return osveziPlanStatus(plan);
  }

  /** Izbrano kartico preoblikuje po eni od desetih predlog. Čas, kanali,
      priloge in dodatki koraka ostanejo nespremenjeni; zamenjajo se le ton,
      naziv predloge in samodejno besedilo opomina. */
  function preoblikujOpomin(plan, index, predlogaId, ctx) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    var step = najdiKorak(plan, index);
    if (
      !step ||
      step.isExcluded ||
      step.kind === "manual_lawyer" ||
      step.deliveryMode === "manual" ||
      step.status === "sent" ||
      step.status === "processing"
    ) {
      return plan;
    }
    var predloga = PREDLOGE_PREOBLIKOVANJA.find(function (p) {
      return p.id === String(predlogaId || "");
    });
    if (!predloga) return plan;

    var vhod = Object.assign({}, ctx || {}, {
      amountCents:
        ctx && ctx.amountCents != null ? ctx.amountCents : plan.amountCents,
      /* Prva predloga mora dobiti sveže standardno besedilo, ne besedila iz
         prejšnjega koraka 2, saj je uporabnik izrecno zahteval preoblikovanje. */
      sporociloDolzniku: "",
    });
    var novoBesedilo = sestaviGeneratedMessage(predloga.messageIndex, vhod);

    step.toneId = predloga.toneId;
    step.cardTemplateId = predloga.id;
    step.cardTemplateTitle = predloga.title;
    step.templateId = "reminder-" + predloga.id;
    step.templateSelectionMode = "manual";
    step.generatedMessage = novoBesedilo;
    step.finalMessage = novoBesedilo;
    step.messageEditedManually = false;
    oznaciNeedsReview(step);
    if (step.status !== "needs_review") step.status = "draft";
    plan.updatedAt = zdajIso();
    plan.stages = plan.steps;
    return osveziPlanStatus(plan);
  }

  /** Ustvari uporabnikov samodejni korak iz prvega še neuporabljenega mesta.
      Načrt ima največ deset mest (zadnje je predaja odvetniku), zato s tem ne
      spreminjamo pogodbe shranjevanja ali vrstnega reda končnega koraka. */
  function dodajKorakPoMeri(plan, podatki, ctx) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    var naslov = String((podatki && podatki.title) || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 40);
    var barvaId = String((podatki && podatki.colorId) || "mint");
    var barva = BARVE_KORAKA_PO_MERI.find(function (item) {
      return item.id === barvaId;
    });
    var predloga = PREDLOGE_PREOBLIKOVANJA.find(function (item) {
      return item.id === String((podatki && podatki.templateId) || "");
    }) || PREDLOGE_PREOBLIKOVANJA[0];
    var korak = plan.steps.find(function (step) {
      return step && step.isExcluded && step.kind !== "manual_lawyer" && step.deliveryMode !== "manual";
    });
    if (naslov.length < 2 || !barva || !korak) return plan;

    korak.isExcluded = false;
    korak.title = naslov;
    korak.customCardTitle = naslov;
    korak.customCardColor = barva.id;
    korak.customCardColorHex = normalizirajHexBarvo(podatki && podatki.colorHex, barva.hex);
    korak.customCardColorLevel = barva.level;
    korak.customContentTemplateId = predloga.id;
    var osebniTon = String((podatki && podatki.toneId) || "");
    korak.toneId = VELJAVNI_TONI_KORAKA.indexOf(osebniTon) >= 0
      ? osebniTon
      : (predloga.toneId || barva.toneId);
    korak.cardTemplateId = "custom-" + korak.id;
    korak.cardTemplateTitle = naslov;
    korak.templateId = "reminder-custom-" + korak.id;
    korak.templateSelectionMode = "manual";
    if (podatki && podatki.libraryId) {
      korak.customCardLibraryId = String(podatki.libraryId).slice(0, 80);
    }
    var vhod = Object.assign({}, ctx || {}, {
      amountCents: ctx && ctx.amountCents != null ? ctx.amountCents : plan.amountCents,
      sporociloDolzniku: "",
    });
    var novoBesedilo = String((podatki && podatki.message) || "").trim() ||
      sestaviGeneratedMessage(predloga.messageIndex || korak.index, vhod);
    korak.generatedMessage = novoBesedilo;
    korak.finalMessage = novoBesedilo;
    korak.messageEditedManually = Boolean(String((podatki && podatki.message) || "").trim());
    korak.paymentDeadline = Object.assign({}, korak.paymentDeadline || {}, {
      enabled: Boolean(podatki && podatki.addons && podatki.addons.paymentDeadline),
    });
    korak.installment = Object.assign({}, korak.installment || {}, {
      enabled: Boolean(podatki && podatki.addons && podatki.addons.installment),
    });
    korak.bankTransfer = Object.assign({}, korak.bankTransfer || {}, {
      enabled: Boolean(podatki && podatki.addons && podatki.addons.bankTransfer),
    });
    korak.messageNeedsReview = false;
    korak.status = "draft";
    korak.reviewRequiredAt = zdajIso();
    korak.reviewRequiredRevision = "review-v1:" + korak.reviewRequiredAt;
    korak.confirmedAt = null;
    korak.confirmedSnapshotHash = null;
    korak.snapshotHash = null;
    plan.selectedStageId = korak.id;
    plan.updatedAt = zdajIso();
    plan.stages = plan.steps;
    return osveziPlanStatus(plan);
  }

  /** Na obstoječo samodejno kartico prenese uporabnikov shranjeni korak.
      Čas, prejemniki, priloge in dodatki ostanejo vezani na trenutno kartico. */
  function uporabiMojKorak(plan, index, podatki) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    var step = najdiKorak(plan, index);
    if (
      !step ||
      step.isExcluded ||
      step.kind === "manual_lawyer" ||
      step.deliveryMode === "manual" ||
      step.status === "sent" ||
      step.status === "processing"
    ) {
      return plan;
    }
    var naslov = String((podatki && podatki.title) || "")
      .trim().replace(/\s+/g, " ").slice(0, 40);
    var barvaId = String((podatki && podatki.colorId) || "mint");
    var barva = BARVE_KORAKA_PO_MERI.find(function (item) {
      return item.id === barvaId;
    });
    var ton = String((podatki && podatki.toneId) || "friendly");
    if (naslov.length < 2 || !barva || VELJAVNI_TONI_KORAKA.indexOf(ton) < 0) {
      return plan;
    }

    step.title = naslov;
    step.customCardTitle = naslov;
    step.customCardColor = barva.id;
    step.customCardColorHex = normalizirajHexBarvo(podatki && podatki.colorHex, barva.hex);
    step.customCardColorLevel = barva.level;
    step.customCardLibraryId = String((podatki && podatki.id) || "").slice(0, 80);
    step.customContentTemplateId = String((podatki && podatki.templateId) || "card-1");
    step.toneId = ton;
    step.cardTemplateId = "custom-" + step.id;
    step.cardTemplateTitle = naslov;
    step.templateId = "reminder-custom-" + step.id;
    step.templateSelectionMode = "manual";
    var osebnoBesedilo = String((podatki && podatki.message) || "").trim();
    if (osebnoBesedilo) {
      step.generatedMessage = osebnoBesedilo;
      step.finalMessage = osebnoBesedilo;
      step.messageEditedManually = true;
    }
    oznaciNeedsReview(step);
    if (step.status !== "needs_review") step.status = "draft";
    plan.updatedAt = zdajIso();
    plan.stages = plan.steps;
    return osveziPlanStatus(plan);
  }

  function predogledSporocilaKorakaPoMeri(plan, predlogaId, ctx) {
    var predloga = PREDLOGE_PREOBLIKOVANJA.find(function (item) {
      return item.id === String(predlogaId || "");
    }) || PREDLOGE_PREOBLIKOVANJA[0];
    var vhod = Object.assign({}, ctx || {}, {
      amountCents: ctx && ctx.amountCents != null
        ? ctx.amountCents
        : plan && plan.amountCents,
      sporociloDolzniku: "",
    });
    return sestaviGeneratedMessage(predloga.messageIndex || 1, vhod);
  }

  function zacniKorakPoMeri(plan, ctx) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    var pred = plan.steps.find(function (step) {
      return step && step.isExcluded && step.kind !== "manual_lawyer" && step.deliveryMode !== "manual";
    });
    if (!pred) return plan;
    dodajKorakPoMeri(plan, {
      title: "Nova kartica",
      colorId: "mint",
      colorHex: "#55b99a",
      templateId: "card-1",
      addons: { paymentDeadline: false, installment: false, bankTransfer: false },
    }, ctx);
    pred.customCardDraft = true;
    plan.selectedStageId = pred.id;
    return osveziPlanStatus(plan);
  }

  function posodobiVidezKorakaPoMeri(plan, index, podatki) {
    var step = najdiKorak(plan, index);
    if (!step || !step.customCardTitle || step.kind === "manual_lawyer") return plan;
    var naslov = String((podatki && podatki.title) || step.customCardTitle || "")
      .trim().replace(/\s+/g, " ").slice(0, 40);
    var barvaId = String((podatki && podatki.colorId) || step.customCardColor || "mint");
    var barva = BARVE_KORAKA_PO_MERI.find(function (item) { return item.id === barvaId; }) || BARVE_KORAKA_PO_MERI[0];
    if (naslov.length >= 2) {
      step.title = naslov;
      step.customCardTitle = naslov;
      step.cardTemplateTitle = naslov;
    }
    step.customCardColor = barva.id;
    step.customCardColorHex = normalizirajHexBarvo(podatki && podatki.colorHex, barva.hex);
    step.customCardColorLevel = barva.level;
    plan.updatedAt = zdajIso();
    plan.stages = plan.steps;
    return osveziPlanStatus(plan);
  }

  function dokoncajKorakPoMeri(plan, index, podatki) {
    var step = najdiKorak(plan, index);
    var naslov = String((podatki && podatki.title) || "").trim().replace(/\s+/g, " ");
    if (!step || !step.customCardDraft || naslov.length < 2) return plan;
    posodobiVidezKorakaPoMeri(plan, index, podatki);
    delete step.customCardDraft;
    return osveziPlanStatus(plan);
  }

  function prekliciKorakPoMeri(plan, index, ctx) {
    var step = najdiKorak(plan, index);
    if (!step || !step.customCardDraft) return plan;
    ponastaviPreoblikovanOpomin(plan, index, ctx);
    step.isExcluded = true;
    delete step.customCardDraft;
    if (plan.selectedStageId === step.id) plan.selectedStageId = null;
    return osveziPlanStatus(plan);
  }

  /** Aktivno kartico vrne na njeno prvotno samodejno predlogo. Čas,
      prejemniki, priloge in dodatki ostanejo nedotaknjeni. */
  function ponastaviPreoblikovanOpomin(plan, index, ctx) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    var step = najdiKorak(plan, index);
    if (
      !step ||
      step.isExcluded ||
      step.kind === "manual_lawyer" ||
      step.deliveryMode === "manual" ||
      step.status === "sent" ||
      step.status === "processing"
    ) {
      return plan;
    }
    var meta = KORAKI_META[Math.max(0, Number(step.index || 1) - 1)];
    if (!meta || meta.deliveryMode === "manual") return plan;
    var vhod = Object.assign({}, ctx || {}, {
      amountCents:
        ctx && ctx.amountCents != null ? ctx.amountCents : plan.amountCents,
    });
    var novoBesedilo = sestaviGeneratedMessage(meta.order, vhod);

    step.title = meta.title;
    step.toneId = meta.toneId;
    step.templateId = plan._step2TemplateSnapshot || null;
    step.templateSelectionMode = "automatic";
    delete step.cardTemplateId;
    delete step.cardTemplateTitle;
    delete step.customCardTitle;
    delete step.customCardColor;
    delete step.customCardColorHex;
    delete step.customCardColorLevel;
    delete step.customCardLibraryId;
    delete step.customContentTemplateId;
    step.generatedMessage = novoBesedilo;
    step.finalMessage = novoBesedilo;
    step.messageEditedManually = false;
    oznaciNeedsReview(step);
    if (step.status !== "needs_review") step.status = "draft";
    plan.updatedAt = zdajIso();
    plan.stages = plan.steps;
    return osveziPlanStatus(plan);
  }

  function dodajKorak(plan) {
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length >= 10) return plan;
    var manualIndex = plan.steps.findIndex(function (s) {
      return s.kind === "manual_lawyer";
    });
    var insertAt = manualIndex >= 0 ? manualIndex : plan.steps.length;
    var prejsnji = plan.steps.slice(0, insertAt).filter(function (s) {
      return s.kind === "sms";
    }).pop();
    if (!prejsnji) return plan;

    var odmik = (Number(prejsnji.scheduledOffsetDays) || 0) + (Number(plan.recommendedGapDays) || 8);
    var prviCas =
      (plan.steps[0] && (plan.steps[0].sendAt || plan.steps[0].scheduledAt)) ||
      null;
    var novSendAt = privzetiSendAt(odmik, prviCas);
    var nov = Object.assign({}, prejsnji, {
      id: "",
      index: 0,
      order: 0,
      type: "strict_reminder",
      title: "Dodaten opomin",
      toneId: "strict",
      status: "draft",
      confirmedAt: null,
      messageNeedsReview: false,
      scheduledOffsetDays: odmik,
      offsetDays: odmik,
      sendAt: novSendAt,
      scheduledAt: novSendAt,
      _preskokDni: 0,
    });
    plan.steps.splice(insertAt, 0, nov);
    plan.steps.forEach(function (step, i) {
      step.index = i + 1;
      step.order = i + 1;
      step.id = "stage-" + (i + 1);
    });
    plan.stages = plan.steps;
    plan.totalDurationDays = plan.steps.length
      ? Number(plan.steps[plan.steps.length - 1].scheduledOffsetDays) || 0
      : 0;
    plan._baseOffsets = plan.steps.map(function (s) { return Number(s.scheduledOffsetDays) || 0; });
    return osveziPlanStatus(plan);
  }

  function jeZadnjiKorakManualLawyer(plan) {
    var steps = plan && plan.steps;
    if (!steps || !steps.length) return false;
    var last = steps[steps.length - 1];
    return last.kind === "manual_lawyer";
  }

  /** Ko uporabnik izključi ali vključi korak, prestavi odmike naslednjih
      vidnih korakov, da zapolnijo praznino ali naredijo prostor.
      Uporablja _baseOffsets shranjene ob inicializaciji plana. */
  function preracunajOdmikePoIzkljucitvi(plan) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    var koraki = plan.steps;
    var prviCas =
      (koraki[0] && (koraki[0].sendAt || koraki[0].scheduledAt)) || null;
    /* Vsak neizključen korak dobi odmik iz _baseOffsets glede na svojo pozicijo
       v zaporedju neizključenih korakov. */
    var neizkljucenIdx = 0;
    koraki.forEach(function (s) {
      if (!s.isExcluded) {
        s.scheduledOffsetDays = (plan._baseOffsets || [])[neizkljucenIdx] || 0;
        s.offsetDays = s.scheduledOffsetDays;
        s.sendAt = privzetiSendAt(s.scheduledOffsetDays, prviCas);
        s.scheduledAt = s.sendAt;
        s._preskokDni = 0;
        neizkljucenIdx++;
      }
    });
    plan.totalDurationDays = koraki.length
      ? (koraki[koraki.length - 1].scheduledOffsetDays || 0)
      : 0;
    return osveziPlanStatus(plan);
  }

  function najdiPristopIzterjave(pristopId) {
    return PRISTOPI_IZTERJAVE.find(function (pristop) {
      return pristop.id === String(pristopId || "");
    }) || null;
  }

  function priporoceniPristopIzterjave(plan) {
    var zamuda = Math.max(0, Number(plan && plan.overdueDays) || 0);
    var znesek = Math.max(0, Number(plan && plan.amountCents) || 0);
    if (zamuda >= 90 || znesek >= 500000) return "odlocno";
    if (zamuda <= 30 && znesek < 250000) return "postopno";
    return "uravnotezeno";
  }

  function aktivniPristopIzterjave(plan) {
    if (!plan || !Array.isArray(plan.steps)) return null;
    var vkljucenih = plan.steps.filter(function (step) {
      return step && !step.isExcluded;
    }).length;
    var shranjeni = najdiPristopIzterjave(plan.collectionApproach);
    if (shranjeni && shranjeni.totalSteps === vkljucenih) return shranjeni.id;
    var poStevilu = PRISTOPI_IZTERJAVE.find(function (pristop) {
      return pristop.totalSteps === vkljucenih;
    });
    return poStevilu ? poStevilu.id : null;
  }

  function lahkoSpremeniPristopIzterjave(plan) {
    if (!plan || !Array.isArray(plan.steps)) return false;
    if (plan.status === "activated" || plan.status === "active") return false;
    return !plan.steps.some(function (step) {
      return step && (step.status === "sent" || step.status === "processing");
    });
  }

  function uporabiPristopIzterjave(plan, pristopId) {
    var pristop = najdiPristopIzterjave(pristopId);
    if (!pristop || !lahkoSpremeniPristopIzterjave(plan)) return plan;
    var samodejni = plan.steps.filter(function (step) {
      return step && step.kind !== "manual_lawyer" && step.deliveryMode !== "manual";
    });
    var steviloSamodejnih = Math.max(1, pristop.totalSteps - 1);
    samodejni.forEach(function (step, index) {
      step.isExcluded = index >= steviloSamodejnih;
    });
    zagotoviVkljucenZadnjiRocniKorak(plan);
    plan.collectionApproach = pristop.id;
    plan = preracunajOdmikePoIzkljucitvi(plan);

    var izbrani = (plan.steps || []).find(function (step) {
      return step && step.id === plan.selectedStageId && !step.isExcluded;
    });
    if (!izbrani) {
      izbrani = (plan.steps || []).find(function (step) {
        return step && !step.isExcluded;
      }) || null;
      plan.selectedStageId = izbrani ? izbrani.id : null;
    }
    plan.updatedAt = zdajIso();
    return osveziPlanStatus(plan);
  }

  var api = {
    KLJUC_SEJE: KLJUC_SEJE,
    KORAKI_META: KORAKI_META,
    sestaviGeneratedMessage: sestaviGeneratedMessage,
    zagotoviVkljucenZadnjiRocniKorak: zagotoviVkljucenZadnjiRocniKorak,
    eurosToCents: eurosToCents,
    izracunajZamudoDni: izracunajZamudoDni,
    preberiTonIzKorak2: preberiTonIzKorak2,
    oznakaTona: oznakaTona,
    izracunajOdmike: izracunajOdmike,
    izracunajHash: izracunajHash,
    sestaviRazlog: sestaviRazlog,
    narediNovPlan: narediNovPlan,
    pridobiAliUstvari: pridobiAliUstvari,
    zagotoviUrejljivSestiKorak: zamenjajNeureljivSestiKorak,
    naloziOsnutek: naloziOsnutek,
    shraniOsnutek: shraniOsnutek,
    pocistiOsnutek: pocistiOsnutek,
    uskladiZVhodi: uskladiZVhodi,
    najdiKorak: najdiKorak,
    najdiNaslednjiVkljuceniKorak: najdiNaslednjiVkljuceniKorak,
    posodobiSporociloKoraka: posodobiSporociloKoraka,
    potrdiKorak: potrdiKorak,
    nastaviKeepIntervals: nastaviKeepIntervals,
    normalizirajDovoljenoOkno: normalizirajDovoljenoOkno,
    normalizirajNacinDovoljenegaOkna: normalizirajNacinDovoljenegaOkna,
    dovoljenoOknoZaKorak: dovoljenoOknoZaKorak,
    jeUraVDovoljenemOkvirju: jeUraVDovoljenemOkvirju,
    nastaviDovoljenoOkno: nastaviDovoljenoOkno,
    nastaviDovoljenoOknoKoraka: nastaviDovoljenoOknoKoraka,
    posodobiCasKoraka: posodobiCasKoraka,
    posodobiRazmikDoNaslednjega: posodobiRazmikDoNaslednjega,
    validirajCasKoraka: validirajCasKoraka,
    uskladiOffseteIzDatumov: uskladiOffseteIzDatumov,
    koledarskiDneviMed: koledarskiDneviMed,
    slovenskaDniBeseda: slovenskaDniBeseda,
    oznakaCezDni: oznakaCezDni,
    oznakaPoPrejsnjem: oznakaPoPrejsnjem,
    jeKorakPremakljiv: jeKorakPremakljiv,
    oznaciAktiviran: oznaciAktiviran,
    izracunajPlanStatus: izracunajPlanStatus,
    prviNepotrjenSmsIndex: prviNepotrjenSmsIndex,
    prviNepotrjenPredZadnjimKorakom: prviNepotrjenPredZadnjimKorakom,
    soVsiSmsPotrjeni: soVsiSmsPotrjeni,
    steviloPotrjenih: steviloPotrjenih,
    odstraniKorak: odstraniKorak,
    dodajKorak: dodajKorak,
    steviloSmsKorakov: steviloSmsKorakov,
    nastaviTonKoraka: nastaviTonKoraka,
    preoblikujOpomin: preoblikujOpomin,
    ponastaviPreoblikovanOpomin: ponastaviPreoblikovanOpomin,
    dodajKorakPoMeri: dodajKorakPoMeri,
    uporabiMojKorak: uporabiMojKorak,
    predogledSporocilaKorakaPoMeri: predogledSporocilaKorakaPoMeri,
    zacniKorakPoMeri: zacniKorakPoMeri,
    posodobiVidezKorakaPoMeri: posodobiVidezKorakaPoMeri,
    dokoncajKorakPoMeri: dokoncajKorakPoMeri,
    prekliciKorakPoMeri: prekliciKorakPoMeri,
    PREDLOGE_PREOBLIKOVANJA: PREDLOGE_PREOBLIKOVANJA,
    BARVE_KORAKA_PO_MERI: BARVE_KORAKA_PO_MERI,
    VELJAVNI_TONI_KORAKA: VELJAVNI_TONI_KORAKA,
    jeZadnjiKorakManualLawyer: jeZadnjiKorakManualLawyer,
    preracunajOdmikePoIzkljucitvi: preracunajOdmikePoIzkljucitvi,
    PRISTOPI_IZTERJAVE: PRISTOPI_IZTERJAVE,
    priporoceniPristopIzterjave: priporoceniPristopIzterjave,
    aktivniPristopIzterjave: aktivniPristopIzterjave,
    lahkoSpremeniPristopIzterjave: lahkoSpremeniPristopIzterjave,
    uporabiPristopIzterjave: uporabiPristopIzterjave,
    praznaPredajaOdvetniku: praznaPredajaOdvetniku,
    jeNeureljivZadnjiKorak: jeNeureljivZadnjiKorak,
    zamenjajNeureljivZadnjiKorak: zamenjajNeureljivZadnjiKorak,
    VELJAVNI_NAMENI_PREDAJE: VELJAVNI_NAMENI_PREDAJE,
    sestaviSporociloOdvetniku: sestaviSporociloOdvetniku,
    povzetekDogodkovPredNacrtom: povzetekDogodkovPredNacrtom,
    posodobiOdvetnika: posodobiOdvetnika,
    posodobiDnevePredaje: posodobiDnevePredaje,
    posodobiCasPredajeOdvetniku: posodobiCasPredajeOdvetniku,
    posodobiPrikazaneOdvetnike: posodobiPrikazaneOdvetnike,
    posodobiFilterPonudb: posodobiFilterPonudb,
    dodajOdvetnikaVDraftStanje: dodajOdvetnikaVDraftStanje,
    posodobiNamenPredaje: posodobiNamenPredaje,
    posodobiSporociloOdvetniku: posodobiSporociloOdvetniku,
    posodobiIzbraniPaket: posodobiIzbraniPaket,
    posodobiPaketInOdvetnika: posodobiPaketInOdvetnika,
    dodajDokumentOdvetniku: dodajDokumentOdvetniku,
    odstraniDokumentOdvetniku: odstraniDokumentOdvetniku,
    posodobiOpisDokumentaOdvetniku: posodobiOpisDokumentaOdvetniku,
    oznaciZunanjePrilogePredajeSpremenjene: oznaciZunanjePrilogePredajeSpremenjene,
    dokumentnoStanjePredaje: dokumentnoStanjePredaje,
    dokumentiPredajePoTipu: dokumentiPredajePoTipu,
    povzetekCenePredaje: povzetekCenePredaje,
    preveriPogojeZaPripravoPredaje: preveriPogojeZaPripravoPredaje,
    pripraviPredajoOdvetniku: pripraviPredajoOdvetniku,
    moznaPredajaOdvetniku: moznaPredajaOdvetniku,
    izvediPredajoOdvetniku: izvediPredajoOdvetniku,
    oznaciRocnoPredanoOdvetniku: oznaciRocnoPredanoOdvetniku,
    dokoncajRocnoPredajoNacrta: dokoncajRocnoPredajoNacrta,
    potrdiCelotenNacrtZaOddajo: potrdiCelotenNacrtZaOddajo,
    slovenskaOblika: slovenskaOblika,
    stevecPoslanih: stevecPoslanih,
    stevecNacrtovanih: stevecNacrtovanih,
    stevecZapisov: stevecZapisov,
    stevecDokumentov: stevecDokumentov,
    stevecDatotek: stevecDatotek,
    besediloStevilaDatotek: besediloStevilaDatotek,
  };

  root.UJOpominNacrt = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
