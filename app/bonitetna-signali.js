(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJBonitetaSignali = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var DAN = 86400000;

  function besedilo(vrednost) {
    return String(vrednost == null ? "" : vrednost).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function stevilo(vrednost) {
    var rezultat = Number(vrednost && typeof vrednost === "object" ? vrednost.value : vrednost);
    return Number.isFinite(rezultat) ? rezultat : null;
  }

  function leto(vrednost) {
    var neposredno = Number(vrednost && vrednost.year);
    if (Number.isFinite(neposredno) && neposredno > 1900) return neposredno;
    var zadetek = String(vrednost && (vrednost.date || vrednost.publicationDate || vrednost.report_end_date) || "").match(/\b(19|20)\d{2}\b/);
    return zadetek ? Number(zadetek[0]) : null;
  }

  function datum(vrednost) {
    var zapis = String(vrednost || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(zapis) ? zapis : "";
  }

  function odstotek(prej, zdaj) {
    if (!prej || !zdaj || !Number.isFinite(prej.value) || !Number.isFinite(zdaj.value)) return null;
    if (prej.value === 0) return zdaj.value === 0 ? 0 : null;
    if (prej.value < 0 !== zdaj.value < 0) return null;
    return (zdaj.value - prej.value) / Math.abs(prej.value) * 100;
  }

  function metrikaKljuc(oznaka) {
    var zapis = besedilo(oznaka);
    if (/net.?income|earnings|net.?profit|annual.?result|jahres.*(?:uberschuss|fehlbetrag)|ergebnis|poslovni rezultat|cisti dobicek/.test(zapis)) return "earnings";
    if (/total.?assets|balance.?sheet.?total|bilanzsumme|bilancna vsota|summe aktiva/.test(zapis)) return "assets";
    if (/revenue|sales|turnover|umsatz|prihodki/.test(zapis)) return "revenue";
    if (/cash|bank|liquid funds|liquide mittel|denarna sredstva/.test(zapis)) return "cash";
    if (/liabilities|verbindlichkeiten|obveznosti/.test(zapis)) return "liabilities";
    if (/equity|eigenkapital|kapital/.test(zapis) && !/share|stamm|registered/.test(zapis)) return "equity";
    if (/share capital|stammkapital|registered capital|gezeichnetes kapital|osnovni kapital/.test(zapis)) return "shareCapital";
    return "";
  }

  function financneSerije(company) {
    var serije = { earnings: [], assets: [], revenue: [], cash: [], liabilities: [], equity: [], shareCapital: [] };
    function dodaj(kljuc, vnos, letoRezerva) {
      var l = leto(vnos) || letoRezerva, vrednost = stevilo(vnos);
      if (!kljuc || !serije[kljuc] || !l || vrednost === null) return;
      if (["assets", "revenue", "cash", "liabilities", "shareCapital"].includes(kljuc) && vrednost < 0) return;
      var obstojeca = serije[kljuc].find(function (postavka) { return postavka.year === l; });
      if (obstojeca) obstojeca.value = vrednost;
      else serije[kljuc].push({ year: l, value: vrednost });
    }
    (company && Array.isArray(company.financials) ? company.financials : []).forEach(function (metrika) {
      var kljuc = metrikaKljuc(metrika && (metrika.metric || metrika.name || metrika.label));
      (metrika && Array.isArray(metrika.values) ? metrika.values : []).forEach(function (vnos) { dodaj(kljuc, vnos); });
    });
    var neposredni = { earnings: "earnings", assets: "totalAssets", revenue: "revenue", cash: "cash", liabilities: "liabilities", equity: "equity", shareCapital: "shareCapital" };
    Object.keys(neposredni).forEach(function (kljuc) {
      var vrednosti = company && company[neposredni[kljuc]];
      if (Array.isArray(vrednosti)) vrednosti.forEach(function (vnos) { dodaj(kljuc, vnos); });
    });
    (company && Array.isArray(company.balanceSheets) ? company.balanceSheets : []).forEach(function (izkaz) {
      var l = leto(izkaz);
      (izkaz && Array.isArray(izkaz.lines) ? izkaz.lines : []).forEach(function (vrstica) {
        dodaj(metrikaKljuc(vrstica && (vrstica.name || vrstica.label)), vrstica, l);
      });
    });
    Object.keys(serije).forEach(function (kljuc) { serije[kljuc].sort(function (a, b) { return a.year - b.year; }); });
    return serije;
  }

  function vsiDogodki(company) {
    return (company && Array.isArray(company.events) ? company.events : []).filter(Boolean).map(function (dogodek) {
      var zapis = besedilo([dogodek.category, dogodek.type, dogodek.title, dogodek.description].join(" "));
      var vrsta = /liquid|insolven|dissolv|losch|inactive/.test(zapis) ? "liquidation"
        : /officer|director|management|geschaftsfuhr|prokur|vodstv|vertreter/.test(zapis) ? "leadership"
          : /owner|shareholder|gesellschafter|lastni/.test(zapis) ? "ownership"
            : /capital|kapital|stammkapital|einlage/.test(zapis) ? "capital"
              : /legal form|rechtsform|umwandl|ug|gmbh/.test(zapis) ? "legalForm"
                : /court|gericht|registersitz|sodisc/.test(zapis) ? "court"
                  : /address|seat|sitz|sedez|anschrift/.test(zapis) ? "address"
                    : /purpose|gegenstand|dejavnost/.test(zapis) ? "purpose"
                      : /name|firma|naziv/.test(zapis) ? "name" : "record";
      return { raw: dogodek, text: zapis, type: vrsta, date: datum(dogodek.date || dogodek.publicationDate) };
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  function imeOsebe(oseba) {
    return String(oseba && (oseba.name || oseba.full_name || [oseba.givenName, oseba.familyName].filter(Boolean).join(" ")) || "").trim();
  }

  function datumOsebeIzPolj(oseba, polja) {
    for (var i = 0; i < polja.length; i += 1) {
      if (oseba && oseba[polja[i]]) return datum(oseba[polja[i]]);
    }
    return "";
  }

  function spremembaVodstva(dogodek, company) {
    var osebe = company && Array.isArray(company.officers) ? company.officers : [];
    function imenaZaDatum(polja) {
      return Array.from(new Set(osebe.filter(function (oseba) {
        return datumOsebeIzPolj(oseba, polja) === dogodek.date;
      }).map(imeOsebe).filter(Boolean)));
    }
    var nastopili = imenaZaDatum(["startDate", "appointedAt", "from"]);
    var zakljucili = imenaZaDatum(["endDate", "endedAt", "to"]);
    var raw = dogodek.raw || {};
    var podrobnost = String(raw.description || raw.title || "").trim();
    if (/^(new director|director changed|management change|sprememba vodstva|novo vodstvo)$/i.test(podrobnost)) podrobnost = "";
    return { date: dogodek.date, appointed: nastopili, departed: zakljucili, detail: podrobnost };
  }

  function signal(id, category, tone, priority, title, summary, extra) {
    var dovoljeniToni = ["critical", "warning", "positive", "info", "neutral"];
    var dovoljenePostavitve = ["transition", "bars", "compare-bars", "liquidity", "capital", "equity-alert", "leadership", "reorganization", "legal-form", "ownership", "stable", "court", "new-company", "mismatch", "network", "filing-gap", "limited"];
    var rezultat = Object.assign({ id: id, category: category, tone: tone, priority: priority, title: title, summary: summary, confidence: "high", evidence: [] }, extra || {});
    rezultat.id = String(rezultat.id || "").trim();
    rezultat.category = String(rezultat.category || "data").trim();
    rezultat.tone = dovoljeniToni.includes(rezultat.tone) ? rezultat.tone : "neutral";
    rezultat.priority = Math.max(0, Math.min(100, Number(rezultat.priority) || 0));
    rezultat.title = String(rezultat.title || "Podatek zahteva pregled").trim();
    rezultat.summary = String(rezultat.summary || "Za zanesljiv sklep ni dovolj podatkov.").trim();
    rezultat.layout = dovoljenePostavitve.includes(rezultat.layout) ? rezultat.layout : "";
    rezultat.evidence = Array.from(new Set((Array.isArray(rezultat.evidence) ? rezultat.evidence : []).map(String).filter(Boolean)));
    return rezultat;
  }

  // Poslovni vrstni red je namerno trdo določen. Številčna prioriteta je samo
  // dodatna varovalka za neznane prihodnje signale; znanih kartic ne sme nikoli
  // prerazporediti glede na vrstni red podatkov v odgovoru ponudnika.
  var TRDI_VRSTNI_RED_SIGNALOV = [
    "contact_mismatch", "negative_equity", "equity_decline_material", "profit_to_loss", "liquidity_weaker",
    "loss_to_profit", "reorganization", "profit_drop", "leadership_turnover",
    "profit_decline_multi", "filing_gap", "majority_owner", "ug_to_gmbh", "capital_stronger",
    "assets_change", "profit_growth", "court_change", "director_network", "new_company",
    "stable_management"
  ];
  var TRDI_RANG_SIGNALOV = TRDI_VRSTNI_RED_SIGNALOV.reduce(function (rangi, id, indeks) { rangi[id] = indeks; return rangi; }, {});

  function primerjajSignale(a, b) {
    var aId = String(a && a.id || ""), bId = String(b && b.id || "");
    var aZnan = Object.prototype.hasOwnProperty.call(TRDI_RANG_SIGNALOV, aId);
    var bZnan = Object.prototype.hasOwnProperty.call(TRDI_RANG_SIGNALOV, bId);
    if (aZnan || bZnan) {
      if (!aZnan) return 1;
      if (!bZnan) return -1;
      return TRDI_RANG_SIGNALOV[aId] - TRDI_RANG_SIGNALOV[bId];
    }
    var poPrioriteti = Number(b && b.priority || 0) - Number(a && a.priority || 0);
    return poPrioriteti || aId.localeCompare(bId);
  }

  function jeFinancniHeadsUp(signal) {
    return Boolean(signal && signal.category === "finance" && ["critical", "warning"].includes(signal.tone) && [
      "profit_to_loss", "profit_drop", "profit_decline_multi", "liquidity_weaker",
      "negative_equity", "equity_decline_material", "assets_change"
    ].includes(signal.id));
  }

  function jeEkstremniFinancniHeadsUp(signal) {
    if (!jeFinancniHeadsUp(signal)) return false;
    var vrednosti = Array.isArray(signal.values) ? signal.values : [];
    var prej = vrednosti[0] && Number(vrednosti[0].value);
    var zdaj = vrednosti[vrednosti.length - 1] && Number(vrednosti[vrednosti.length - 1].value);
    var absolutniPremik = Number.isFinite(prej) && Number.isFinite(zdaj) ? Math.abs(zdaj - prej) : 0;
    if (signal.id === "profit_to_loss") return Number.isFinite(zdaj) && zdaj <= -25000 || absolutniPremik >= 50000;
    if (signal.id === "profit_drop") {
      if (signal.changeKind === "loss") return Number.isFinite(zdaj) && zdaj <= -50000 && Number(signal.lossRatio) >= 2;
      return Number(signal.change) <= -50 && absolutniPremik >= 25000;
    }
    if (signal.id === "profit_decline_multi") {
      var trend = Array.isArray(signal.series) ? signal.series : [];
      var prvi = trend[0] && Number(trend[0].value), zadnji = trend[trend.length - 1] && Number(trend[trend.length - 1].value);
      var trendPct = Number.isFinite(prvi) && prvi !== 0 && Number.isFinite(zadnji) ? (zadnji - prvi) / Math.abs(prvi) * 100 : 0;
      return Number.isFinite(zadnji) && zadnji < 0 || Number.isFinite(prvi) && Number.isFinite(zadnji) && prvi - zadnji >= 50000 && trendPct <= -50;
    }
    if (signal.id === "liquidity_weaker") return Number(signal.change) <= -70 && Number(signal.secondaryChange) >= 40;
    if (signal.id === "negative_equity") return Number.isFinite(zdaj) && zdaj <= -25000 || absolutniPremik >= 50000;
    if (signal.id === "equity_decline_material") return Number(signal.change) <= -40 && absolutniPremik >= 25000;
    if (signal.id === "assets_change") return signal.tone === "warning" && Number(signal.change) <= -50 && absolutniPremik >= 100000;
    return false;
  }

  function manjkajocaLetaObjav(leta) {
    var objavljena = Array.from(new Set((Array.isArray(leta) ? leta : []).map(Number).filter(function (v) { return Number.isInteger(v) && v >= 1900 && v <= 2200; }))).sort(function (a, b) { return a - b; });
    if (objavljena.length < 2) return [];
    var manjkajoca = [];
    for (var leto = objavljena[0]; leto <= objavljena[objavljena.length - 1]; leto += 1) if (!objavljena.includes(leto)) manjkajoca.push(leto);
    return manjkajoca;
  }

  function financeSignali(serije) {
    var rezultat = [], dobicek = serije.earnings, sredstva = serije.assets;
    if (dobicek.length >= 2) {
      var prej = dobicek[dobicek.length - 2], zdaj = dobicek[dobicek.length - 1], sprememba = odstotek(prej, zdaj), razlika = zdaj.value - prej.value;
      var triletniPozitivniSignal = null;
      if (dobicek.length >= 3) {
        var triPozitivnaLeta = dobicek.slice(-3);
        if (triPozitivnaLeta.every(function (v) { return v.value >= 0; })) {
          var prvo = triPozitivnaLeta[0], srednje = triPozitivnaLeta[1], zadnje = triPozitivnaLeta[2];
          var prviPremik = srednje.value - prvo.value, drugiPremik = zadnje.value - srednje.value;
          var prviOdstotek = odstotek(prvo, srednje), drugiOdstotek = odstotek(srednje, zadnje);
          var prviMocan = prviOdstotek !== null && Math.abs(prviOdstotek) >= 30 && Math.abs(prviPremik) >= 5000;
          var drugiMocan = drugiOdstotek !== null && Math.abs(drugiOdstotek) >= 30 && Math.abs(drugiPremik) >= 5000;
          function opisPremika(premik, mocan) {
            if (premik > 0) return mocan ? "močno zrasel" : "zrasel";
            if (premik < 0) return mocan ? "močno padel" : "padel";
            return "ostal nespremenjen";
          }
          if (drugiMocan && prviPremik !== 0) {
            var jeOkrevanje = prviPremik < 0 && drugiPremik > 0;
            var jeObratNavzdol = prviPremik > 0 && drugiPremik < 0;
            var triletniNaslov = jeOkrevanje ? "Dobiček je po padcu okreval" : jeObratNavzdol ? "Dobiček je po rasti znova padel" : drugiPremik > 0 ? "Dobiček raste dve leti" : "Dobiček pada dve leti";
            var delnoOkrevanje = jeOkrevanje && zadnje.value < prvo.value;
            var triletniTon = drugiPremik < 0 || delnoOkrevanje ? "warning" : "positive";
            var triletniId = drugiPremik < 0 ? "profit_drop" : "profit_growth";
            var triletniPovzetek = "Dobiček je leta " + srednje.year + " " + opisPremika(prviPremik, prviMocan) + ", leta " + zadnje.year + " pa " + (drugiPremik > 0 ? "je ponovno " : "je ") + opisPremika(drugiPremik, drugiMocan) + ".";
            triletniPozitivniSignal = signal(triletniId, "finance", triletniTon, triletniTon === "warning" ? 64 : 48, triletniNaslov, triletniPovzetek, {
              layout: "bars", values: [srednje, zadnje], change: drugiOdstotek,
              changeKind: "three-year-result", changeLabel: srednje.year + (prviPremik < 0 ? " padec" : " rast") + " · " + zadnje.year + (drugiPremik < 0 ? " padec" : " rast"),
              series: triPozitivnaLeta, evidence: ["earnings"]
            });
          }
        }
      }
      if (triletniPozitivniSignal) rezultat.push(triletniPozitivniSignal);
      else if (prej.value >= 0 && zdaj.value < 0) rezultat.push(signal("profit_to_loss", "finance", "critical", 84, "Prehod v izgubo", "Poslovni rezultat je iz pozitivnega prešel v negativnega.", { layout: "transition", values: [prej, zdaj], change: sprememba, series: dobicek.slice(-5), evidence: ["earnings"] }));
      else if (prej.value < 0 && zdaj.value >= 0) rezultat.push(signal("loss_to_profit", "finance", "positive", 72, "Preobrat v dobiček", "Poslovni rezultat se je vrnil nad ničlo.", { layout: "transition", values: [prej, zdaj], change: sprememba, series: dobicek.slice(-5), evidence: ["earnings"] }));
      else if (sprememba !== null && Math.abs(sprememba) >= 30 && Math.abs(razlika) >= 5000) {
        var obeIzgubi = prej.value < 0 && zdaj.value < 0;
        var prikazanaSerija = dobicek.slice(-3);
        var letaIzgube = prikazanaSerija.filter(function (v) { return v.value < 0; }).map(function (v) { return v.year; });
        var skupnaIzguba = prikazanaSerija.reduce(function (vsota, v) { return vsota + (v.value < 0 ? Math.abs(v.value) : 0); }, 0);
        var izgubaSePovecuje = obeIzgubi && zdaj.value < prej.value;
        var izgubaSeZmanjsuje = obeIzgubi && zdaj.value > prej.value;
        var naslov = izgubaSePovecuje ? "Izguba se je povečala" : izgubaSeZmanjsuje ? "Izguba se je zmanjšala" : razlika < 0 ? "Dobiček močno upadel" : "Dobiček močno zrasel";
        var povzetek = izgubaSePovecuje ? "Negativni poslovni rezultat se je glede na prejšnje objavljeno leto občutno poglobil." : izgubaSeZmanjsuje ? "Negativni poslovni rezultat se je glede na prejšnje objavljeno leto zmanjšal." : razlika < 0 ? "Sprememba je materialna glede na prejšnje objavljeno leto." : "Objavljeni rezultat se je opazno izboljšal.";
        rezultat.push(signal(razlika < 0 ? "profit_drop" : "profit_growth", "finance", razlika < 0 ? "warning" : "positive", razlika < 0 ? 64 : 48, naslov, povzetek, { layout: "bars", values: [prej, zdaj], change: sprememba, changeKind: obeIzgubi ? "loss" : "result", lossRatio: obeIzgubi ? Math.abs(zdaj.value) / Math.abs(prej.value) : null, lossYears: obeIzgubi ? letaIzgube : [], lossTotal: obeIzgubi ? skupnaIzguba : null, series: prikazanaSerija, evidence: ["earnings"] }));
      }
      if (dobicek.length >= 3) {
        var zadnjeTri = dobicek.slice(-3);
        if (zadnjeTri[0].value > zadnjeTri[1].value && zadnjeTri[1].value > zadnjeTri[2].value && !rezultat.some(function (v) { return v.category === "finance"; })) rezultat.push(signal("profit_decline_multi", "finance", "warning", 59, "Rezultat pada več let", "Poslovni rezultat se je znižal v dveh zaporednih obdobjih.", { layout: "bars", series: zadnjeTri, changeLabel: "3 zaporedna leta upada", evidence: ["earnings"] }));
      }
      if (dobicek.length >= 3 && !rezultat.some(function (v) { return v.category === "finance"; })) {
        var zgodovinskiSkok = null;
        for (var indeksSkoka = 1; indeksSkoka < dobicek.length; indeksSkoka += 1) {
          var skokPrej = dobicek[indeksSkoka - 1], skokZdaj = dobicek[indeksSkoka];
          var skokOdstotek = odstotek(skokPrej, skokZdaj);
          if (skokPrej.value >= 0 && skokZdaj.value >= 0 && skokOdstotek !== null && skokOdstotek >= 75 && skokZdaj.value - skokPrej.value >= 5000 && (!zgodovinskiSkok || skokOdstotek > zgodovinskiSkok.odstotek)) {
            zgodovinskiSkok = { prej: skokPrej, zdaj: skokZdaj, odstotek: skokOdstotek };
          }
        }
        if (zgodovinskiSkok) {
          var zaokrozenSkok = Math.round(zgodovinskiSkok.odstotek);
          rezultat.push(signal("profit_growth", "finance", "positive", 48, "Poslovni rezultat je močno zrasel", "Med letoma " + zgodovinskiSkok.prej.year + " in " + zgodovinskiSkok.zdaj.year + " se je poslovni rezultat povečal za " + zaokrozenSkok + " %.", {
            layout: "bars", values: [zgodovinskiSkok.prej, zgodovinskiSkok.zdaj], change: zgodovinskiSkok.odstotek,
            changeKind: "historical-growth", changeLabel: zgodovinskiSkok.prej.year + " → " + zgodovinskiSkok.zdaj.year + " · +" + zaokrozenSkok + " %",
            series: [zgodovinskiSkok.prej, zgodovinskiSkok.zdaj], evidence: ["earnings"]
          }));
        }
      }
    }
    if (sredstva.length >= 2) {
      var sredstvaPrej = sredstva[sredstva.length - 2], sredstvaZdaj = sredstva[sredstva.length - 1], sredstvaPct = odstotek(sredstvaPrej, sredstvaZdaj);
      if (sredstvaPrej.value >= 0 && sredstvaZdaj.value >= 0 && sredstvaPct !== null && Math.abs(sredstvaPct) >= 30 && Math.abs(sredstvaZdaj.value - sredstvaPrej.value) >= 25000) rezultat.push(signal("assets_change", "finance", sredstvaPct < 0 ? "warning" : "info", 52, sredstvaPct < 0 ? "Bilanca se je zmanjšala" : "Bilanca se je povečala", "Sprememba bilančne vsote je materialna; razlog iz objavljenih podatkov ni nujno razviden.", { layout: "compare-bars", values: [sredstvaPrej, sredstvaZdaj], change: sredstvaPct, evidence: ["assets"] }));
    }
    var denar = serije.cash, obveznosti = serije.liabilities;
    if (denar.length >= 2 && obveznosti.length >= 2) {
      var denarPct = odstotek(denar[denar.length - 2], denar[denar.length - 1]);
      var obveznostiPct = odstotek(obveznosti[obveznosti.length - 2], obveznosti[obveznosti.length - 1]);
      var denarneVrednostiSoVeljavne = denar[denar.length - 2].value >= 0 && denar[denar.length - 1].value >= 0;
      var obveznostiSoVeljavne = obveznosti[obveznosti.length - 2].value >= 0 && obveznosti[obveznosti.length - 1].value >= 0;
      if (denarneVrednostiSoVeljavne && obveznostiSoVeljavne && denarPct !== null && obveznostiPct !== null && denarPct <= -50 && obveznostiPct >= 20) rezultat.push(signal("liquidity_weaker", "finance", "critical", 76, "Likvidnost se je poslabšala", "Denarna sredstva so močno upadla, obveznosti pa so hkrati zrasle.", { layout: "liquidity", change: denarPct, secondaryChange: obveznostiPct, evidence: ["cash", "liabilities"] }));
    }
    var kapital = serije.equity;
    if (kapital.length) {
      var kapitalZdaj = kapital[kapital.length - 1];
      if (kapitalZdaj.value < 0) rezultat.push(signal("negative_equity", "finance", "critical", 88, "Kapital je negativen", "Objavljeni lastniški kapital je pod ničlo.", { layout: "capital", values: kapital.slice(-2), evidence: ["equity"] }));
      else if (kapital.length >= 2) {
        var kapitalPrej = kapital[kapital.length - 2], kapitalPct = odstotek(kapitalPrej, kapitalZdaj);
        if (kapitalPrej.value < 0 && kapitalZdaj.value >= 0) rezultat.push(signal("capital_stronger", "finance", "positive", 54, "Kapital je ponovno pozitiven", "Objavljeni lastniški kapital se je vrnil nad ničlo.", { layout: "capital", values: kapital.slice(-2), changeKind: "transition", evidence: ["equity"] }));
        else if (kapitalPrej.value > 0 && kapitalZdaj.value > 0 && kapitalPct !== null && kapitalPct <= -20 && kapitalPrej.value - kapitalZdaj.value >= 5000) rezultat.push(signal("equity_decline_material", "finance", "warning", 86, "Kapital je opazno upadel", "Kapital se je glede na prejšnje leto zmanjšal za " + Math.abs(kapitalPct).toLocaleString("sl-SI", { maximumFractionDigits: 1 }) + " %.", { layout: "equity-alert", values: kapital.slice(-2), change: kapitalPct, evidence: ["equity"] }));
        else if (kapitalPrej.value >= 0 && kapitalPct !== null && kapitalPct >= 50) rezultat.push(signal("capital_stronger", "finance", "positive", 46, "Kapital se je okrepil", "Objavljeni kapital se je materialno povečal.", { layout: "capital", values: kapital.slice(-2), change: kapitalPct, evidence: ["equity"] }));
      }
    }
    return rezultat;
  }

  function registrskiSignali(company, dogodki, context) {
    var rezultat = [];

    var vodstvo = dogodki.filter(function (v) { return v.type === "leadership" && v.date; });
    if (vodstvo.length >= 3) {
      var konec = Date.parse(vodstvo[vodstvo.length - 1].date), vOkvirju = vodstvo.filter(function (v) { return konec - Date.parse(v.date) <= 548 * DAN; });
      if (vOkvirju.length >= 3) rezultat.push(signal("leadership_turnover", "register", "warning", 62, "Pogoste menjave vodstva", vOkvirju.length + " menjave v 18 mesecih.", { layout: "leadership", changes: vOkvirju.slice(-3).map(function (v) { return spremembaVodstva(v, company); }), evidence: ["events", "officers"] }));
    }

    var spremembe = dogodki.filter(function (v) { return ["leadership", "ownership", "capital", "legalForm", "court", "address", "purpose", "name"].includes(v.type) && v.date; });
    var najboljsiSkupek = [];
    spremembe.forEach(function (zacetna, i) {
      var skupina = spremembe.slice(i).filter(function (v) { return Date.parse(v.date) - Date.parse(zacetna.date) <= 180 * DAN; });
      var kategorije = Array.from(new Set(skupina.map(function (v) { return v.type; })));
      if (kategorije.length >= 3 && skupina.length > najboljsiSkupek.length) najboljsiSkupek = skupina;
    });
    if (najboljsiSkupek.length) rezultat.push(signal("reorganization", "register", "info", 70, "Večja reorganizacija", "V šestih mesecih so se spremenili najmanj trije ključni registrski podatki.", { layout: "reorganization", dateRange: [najboljsiSkupek[0].date, najboljsiSkupek[najboljsiSkupek.length - 1].date], eventTypes: Array.from(new Set(najboljsiSkupek.map(function (v) { return v.type; }))).slice(0, 3), evidence: ["events"] }));

    var pravnaSprememba = dogodki.find(function (v) { return /\bug\b/.test(v.text) && /gmbh/.test(v.text); });
    if (pravnaSprememba) rezultat.push(signal("ug_to_gmbh", "register", "positive", 55, "Iz UG v GmbH", "Družba je spremenila pravno obliko iz UG v GmbH.", { layout: "legal-form", date: pravnaSprememba.date, evidence: ["events"] }));

    var lastniki = company && (Array.isArray(company.owners) ? company.owners : Array.isArray(company.shareholders) ? company.shareholders : []);
    var vecinski = null;
    lastniki.forEach(function (lastnik) {
      var zgodovina = Array.isArray(lastnik.ownership_history) ? lastnik.ownership_history : Array.isArray(lastnik.history) ? lastnik.history : [];
      var delez = function (v) { var n = Number(v && (v.percentage_shares != null ? v.percentage_shares : v.percentage_share != null ? v.percentage_share : v.percentage)); return Number.isFinite(n) ? n : null; };
      if (zgodovina.length >= 2) {
        var urejena = zgodovina.slice().sort(function (a, b) { return datum(a.document_date || a.date).localeCompare(datum(b.document_date || b.date)); });
        var prej = delez(urejena[urejena.length - 2]), zdaj = delez(urejena[urejena.length - 1]);
        if (prej !== null && zdaj !== null && prej >= 0 && prej <= 100 && zdaj >= 0 && zdaj <= 100 && (zdaj - prej >= 25 || prej < 50 && zdaj >= 50)) vecinski = { name: String(lastnik.name || lastnik.full_name || "").trim(), before: prej, after: zdaj };
      }
    });
    if (vecinski) rezultat.push(signal("majority_owner", "register", "neutral", 57, "Nov večinski lastnik", "Nadzor nad družbo se je spremenil.", { layout: "ownership", owner: vecinski.name, before: vecinski.before, after: vecinski.after, evidence: ["owners"] }));

    var sodisce = dogodki.filter(function (v) { return v.type === "court"; }).slice(-1)[0];
    if (sodisce) rezultat.push(signal("court_change", "register", "info", 38, "Novo registrsko sodišče", "Družba je prenesla registrski sedež.", { layout: "court", date: sodisce.date, text: sodisce.raw && (sodisce.raw.description || sodisce.raw.title), evidence: ["events"] }));

    var officers = company && Array.isArray(company.officers) ? company.officers : [];
    var trenutni = officers.filter(function (oseba) { return !oseba.endDate && !oseba.endedAt && !/former|ceased|ended|resigned|ehemalig/.test(besedilo([oseba.status, oseba.action].join(" "))); });
    var najstarejsi = trenutni.map(function (oseba) { return { name: String(oseba.name || [oseba.givenName, oseba.familyName].filter(Boolean).join(" ")).trim(), date: datum(oseba.startDate || oseba.appointedAt || oseba.from) }; }).filter(function (v) { return v.date; }).sort(function (a, b) { return a.date.localeCompare(b.date); })[0];
    if (najstarejsi) {
      var leta = Math.floor((Date.now() - Date.parse(najstarejsi.date)) / (365.25 * DAN));
      if (leta >= 10 && !rezultat.some(function (v) { return v.id === "leadership_turnover"; })) rezultat.push(signal("stable_management", "register", "positive", 24, "Stabilno vodstvo", leta + " let", { layout: "stable", person: najstarejsi.name, date: najstarejsi.date, years: leta, evidence: ["officers"] }));
    }

    var ustanovitev = datum(company && company.foundingDate);
    if (ustanovitev) {
      var meseci = Math.floor((Date.now() - Date.parse(ustanovitev)) / (30.44 * DAN));
      if (meseci >= 0 && meseci < 24) rezultat.push(signal("new_company", "data", "info", 30, "Podjetje je še novo", "Prva letna bilanca še ni nujno pričakovana.", { layout: "new-company", date: ustanovitev, ageMonths: meseci, evidence: ["foundingDate"] }));
    }

    var mismatch = context && (context.contactMismatch || context.locationStatus === "mismatch" || context.identityStatus === "mismatch");
    if (mismatch) rezultat.push(signal("contact_mismatch", "identity", "critical", 94, "Kontakt pripada drugi družbi", "Spletna stran in uradni register se ne ujemata.", { layout: "mismatch", evidence: ["identity", "locationMatch"], action: "kljucni" }));

    var omrezje = company && (company.officerNetwork || company.directorNetwork);
    if (omrezje && Number(omrezje.activeCompanies) >= 3) rezultat.push(signal("director_network", "data", "neutral", 34, "Direktor vodi več družb", "Povezava z več družbami sama po sebi ni negativen signal.", { layout: "network", activeCompanies: Number(omrezje.activeCompanies) || 0, liquidatingCompanies: Number(omrezje.liquidatingCompanies) || 0, evidence: ["officerNetwork"] }));

    var manjkajocaObjava = company && company.filingGap;
    var objavljenaLeta = manjkajocaObjava && Array.isArray(manjkajocaObjava.years) ? manjkajocaObjava.years : [];
    var manjkajocaLeta = manjkajocaLetaObjav(objavljenaLeta);
    if (manjkajocaObjava && manjkajocaObjava.officiallyChecked === true && manjkajocaLeta.length) rezultat.push(signal("filing_gap", "data", "warning", 58, manjkajocaLeta.length === 1 ? "Manjka pričakovana objava" : "Manjkajo pričakovane objave", "Pred opozorilom je bil preverjen uradni register.", { layout: "filing-gap", years: objavljenaLeta, missingYears: manjkajocaLeta, evidence: ["filingGap"] }));
    return rezultat;
  }

  function pokritost(company, serije) {
    return {
      register: Boolean(company && (company.status || company.events || company.officers)),
      management: Boolean(company && Array.isArray(company.officers) && company.officers.length),
      finance: Object.keys(serije).some(function (kljuc) { return serije[kljuc].length; })
    };
  }

  function izpelji(company, context) {
    company = company || {};
    var serije = financneSerije(company), dogodki = vsiDogodki(company);
    var vsi = registrskiSignali(company, dogodki, context || {}).concat(financeSignali(serije));
    var zadnjiVodstveni = dogodki.filter(function (v) { return v.type === "leadership" && v.date; }).slice(-1)[0];
    var financni = vsi.find(function (v) { return v.category === "finance" && v.values && v.values.length; });
    if (zadnjiVodstveni && financni) {
      var zadnjeLeto = financni.values[financni.values.length - 1].year;
      var razmik = Math.abs(Date.parse(zadnjiVodstveni.date) - Date.parse(String(zadnjeLeto) + "-12-31"));
      if (razmik <= 365 * DAN) {
        financni.relatedEvent = { type: "leadership", date: zadnjiVodstveni.date };
        financni.summary += " Sprememba vodstva časovno sovpada, vendar sama po sebi ne dokazuje vzroka.";
      }
    }
    var poKljucu = {};
    vsi.forEach(function (postavka) { if (!poKljucu[postavka.id] || poKljucu[postavka.id].priority < postavka.priority) poKljucu[postavka.id] = postavka; });
    var urejeni = Object.keys(poKljucu).map(function (kljuc) { return poKljucu[kljuc]; }).sort(primerjajSignale);
    urejeni.forEach(function (postavka) {
      if (!jeFinancniHeadsUp(postavka)) return;
      postavka.financialCaution = true;
      postavka.financialCautionLevel = jeEkstremniFinancniHeadsUp(postavka) ? "extreme" : "notice";
      if (postavka.financialCautionLevel === "extreme") postavka.recheckReason = "financial_caution";
    });
    var izbrani = [], kategorije = {};
    urejeni.forEach(function (postavka) {
      if (izbrani.length >= 3) return;
      var dedupe = postavka.id === "profit_drop" || postavka.id === "profit_decline_multi" ? "profit_trend" : postavka.id;
      if (kategorije[dedupe]) return;
      kategorije[dedupe] = true;
      izbrani.push(postavka);
    });
    return { signals: izbrani, allSignals: urejeni, coverage: pokritost(company, serije), empty: izbrani.length === 0, version: 5 };
  }

  return { izpelji: izpelji, financneSerije: financneSerije, odstotek: odstotek, primerjajSignale: primerjajSignale, _test: { vsiDogodki: vsiDogodki, financeSignali: financeSignali, registrskiSignali: registrskiSignali, jeFinancniHeadsUp: jeFinancniHeadsUp, jeEkstremniFinancniHeadsUp: jeEkstremniFinancniHeadsUp, hardOrder: TRDI_VRSTNI_RED_SIGNALOV.slice() } };
});
