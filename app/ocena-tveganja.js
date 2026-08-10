/* ========== Ocena tv naslednji korak na 10eganja – kategorizacija & priporočilo tona ==========
   Samostojen modul za 1. korak. Bere znesek/datum zapadlosti iz obrazca,
   uporabniško nastavljive meje iz localStorage, zgodovino zamud in vprašalnik.

   4 kategorije dolga: Nizek (od A do B), Srednji (od B do C), Visok (od C do D),
   Ekstremni (od D naprej).
   3 kategorije zamude: Kratka (od A do B), Srednja (od B do C),
   Visoka (od C naprej).
   ============================================ */
(function (root) {
  "use strict";

  var KLJUC_PRAGOVI_OSNOVA = "neplacilo-ocena-tveganja-pragovi";
  var _trenutniUid = null;

  function vrniPrivzetePragove() {
    return {
      dolgNizekOd: 0, dolgNizekDo: 500,
      dolgSrednjiOd: 501, dolgSrednjiDo: 2000,
      dolgVisokOd: 2001, dolgVisokDo: 5000,
      dolgEkstremniOd: 5001,
      zamudaKratkaOd: 1, zamudaKratkaDo: 7,
      zamudaSrednjaOd: 8, zamudaSrednjaDo: 30,
      zamudaVisokaOd: 31, zamudaVisokaDo: 60,
      zamudaEkstremnaOd: 61,
    };
  }

  function preberiUid() {
    try {
      if (typeof supabaseKlient !== "undefined" && supabaseKlient && supabaseKlient.auth) {
        return supabaseKlient.auth.getSession().then(function (res) {
          return (res && res.data && res.data.session && res.data.session.user && res.data.session.user.id) || null;
        }).catch(function () { return null; });
      }
    } catch (_e) {}
    return Promise.resolve(null);
  }

  function kljucZUid(osnova, uid) { return uid ? osnova + "-" + uid : osnova; }

  function preberiPragove(uid) {
    try {
      var raw = localStorage.getItem(kljucZUid(KLJUC_PRAGOVI_OSNOVA, uid));
      if (!raw) return vrniPrivzetePragove();
      var p = JSON.parse(raw);
      var d = vrniPrivzetePragove();
      function n(k) { return Number.isFinite(Number(p[k])) ? Number(p[k]) : d[k]; }
      return {
        dolgNizekOd: n("dolgNizekOd"), dolgNizekDo: n("dolgNizekDo"),
        dolgSrednjiOd: n("dolgSrednjiOd"), dolgSrednjiDo: n("dolgSrednjiDo"),
        dolgVisokOd: n("dolgVisokOd"), dolgVisokDo: n("dolgVisokDo"),
        dolgEkstremniOd: n("dolgEkstremniOd"),
        zamudaKratkaOd: n("zamudaKratkaOd"), zamudaKratkaDo: n("zamudaKratkaDo"),
        zamudaSrednjaOd: n("zamudaSrednjaOd"), zamudaSrednjaDo: n("zamudaSrednjaDo"),
        zamudaVisokaOd: n("zamudaVisokaOd"), zamudaVisokaDo: n("zamudaVisokaDo"),
        zamudaEkstremnaOd: n("zamudaEkstremnaOd"),
      };
    } catch (_e) { return vrniPrivzetePragove(); }
  }

  function shraniPragove(uid, p) {
    try { localStorage.setItem(kljucZUid(KLJUC_PRAGOVI_OSNOVA, uid), JSON.stringify(p)); } catch (_e) {}
  }

  function koledarskiDneviZamude(datumZapadlosti) {
    if (!datumZapadlosti) return null;
    try {
      var danes = new Date();
      var polnocDanes = new Date(danes.getFullYear(), danes.getMonth(), danes.getDate());
      var d = new Date(String(datumZapadlosti).slice(0, 10) + "T12:00:00");
      if (Number.isNaN(d.getTime())) return null;
      var polnocZapadlosti = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return Math.round((polnocDanes.getTime() - polnocZapadlosti.getTime()) / 86400000);
    } catch (_e) { return null; }
  }

  function kategorijaDolga(znesek, pragovi) {
    var z = Number(znesek);
    if (!Number.isFinite(z) || z <= 0) return { kategorija: "Ni podatka", tocke: 0 };
    if (z <= pragovi.dolgNizekDo) return { kategorija: "Nizek dolg", tocke: 0 };
    if (z <= pragovi.dolgSrednjiDo) return { kategorija: "Srednji dolg", tocke: 1 };
    if (z <= pragovi.dolgVisokDo) return { kategorija: "Visok dolg", tocke: 2 };
    return { kategorija: "Ekstremni dolg", tocke: 3 };
  }

  function kategorijaZamude(datumZapadlosti, pragovi) {
    var dnevi = koledarskiDneviZamude(datumZapadlosti);
    if (dnevi == null) return { kategorija: "Ni podatka", tocke: 0, dnevi: null };
    if (dnevi <= 0) return { kategorija: "Ni zapadel", tocke: 0, dnevi: dnevi };
    if (dnevi <= pragovi.zamudaKratkaDo) return { kategorija: "Kratka zamuda", tocke: 0, dnevi: dnevi };
    if (dnevi <= pragovi.zamudaSrednjaDo) return { kategorija: "Srednja zamuda", tocke: 1, dnevi: dnevi };
    if (dnevi <= pragovi.zamudaVisokaDo) return { kategorija: "Visoka zamuda", tocke: 2, dnevi: dnevi };
    return { kategorija: "Ekstremna zamuda", tocke: 3, dnevi: dnevi };
  }

  function tockeZgodovine(zgodovinaZamud) {
    var z = String(zgodovinaZamud);
    if (z === "unknown" || z === "0") return 0;
    if (z === "1" || z === "2") return 1;
    if (z === "3" || z === "4" || z === "5") return 2;
    if (z === "6" || z === "7" || z === "8" || z === "9plus") return 3;
    return 0;
  }

  function tockeVprasalnika(odgovori, zgodovinaZamud) {
    var z = String(zgodovinaZamud);
    if (z === "unknown" || z === "0" || !odgovori) return 0;
    var t = 0;
    if (odgovori.poravnalVedno === false) t += 1;
    if (odgovori.opomniliVeckrat === true) t += 1;
    if (odgovori.prekrsilDogovor === true) t += 1;
    return t;
  }

  function izracunajTon(dolgTocke, zamudaTocke, zgodovinaTocke, vprasalnikTocke, jeZapadel) {
    var skupaj = dolgTocke + zamudaTocke + zgodovinaTocke + vprasalnikTocke;
    if (!jeZapadel) return "friendly";
    if (skupaj <= 1) return "friendly";
    if (skupaj <= 3) return "firm";
    return "strict";
  }

  function pridevnikTona(toneId) {
    if (toneId === "super_friendly") return "super prijazen";
    if (toneId === "friendly") return "prijazen";
    if (toneId === "firm") return "odločen";
    if (toneId === "strict") return "strog";
    if (toneId === "super_strict") return "super strog";
    if (toneId === "super_evil") return "super zloben";
    return "predlagani";
  }

  function sklanjajZamude(n) {
    if (n === 1) return "1 zamude";
    if (n === 2) return "2 zamud";
    if (n === 3 || n === 4) return n + " zamud";
    return n + " zamud";
  }

  function sestaviReasonText(dolgKat, zamudaKat, zamudaDnevi, zgodovinaTocke, vprasalnikTocke, zgodovinaZamud, odgovori) {
    var deli = [];
    if (dolgKat.tocke > 0) {
      if (dolgKat.kategorija === "Ekstremni dolg") deli.push("zaradi ekstremnega dolga");
      else if (dolgKat.kategorija === "Visok dolg") deli.push("zaradi visokega dolga");
      else if (dolgKat.kategorija === "Srednji dolg") deli.push("zaradi srednjega dolga");
    }
    if (zamudaKat.tocke > 0 && zamudaDnevi != null && zamudaDnevi > 0) {
      deli.push(zamudaDnevi + "-dnevne zamude");
    }
    if (zgodovinaTocke > 0) {
      var z = String(zgodovinaZamud);
      var stevilo = z === "9plus" ? 9 : (Number(z) || 0);
      deli.push(sklanjajZamude(stevilo) + " preteklih zamud");
    }
    if (deli.length === 0) return "Predlagamo prijazen ton.";
    return "Predlagamo " + pridevnikTona(izracunajTon(dolgKat.tocke, zamudaKat.tocke, zgodovinaTocke, vprasalnikTocke, zamudaKat.kategorija !== "Ni zapadel" && zamudaKat.kategorija !== "Ni podatka")) + " ton zaradi " + deli[0] + (deli.length > 1 ? ", " + deli.slice(1).join(" in ") : "") + ".";
  }

  /* ---------- Javni API ---------- */

  function izracunajPriporocilo(vhod) {
    vhod = vhod || {};
    var amountCents = Number(vhod.totalDebtCents);
    if (!Number.isFinite(amountCents)) amountCents = 0;
    var znesek = amountCents / 100;
    var originalDueDate = vhod.originalDueDate || null;
    var evaluationDate = vhod.evaluationDate || new Date().toISOString();
    var pragovi = preberiPragove(_trenutniUid);
    var dolg = kategorijaDolga(znesek, pragovi);
    var zamuda = kategorijaZamude(originalDueDate, pragovi);
    var podatkiKorak1 = preberiPodatkeKorak1();
    var zgodovinaZamud = (podatkiKorak1 && podatkiKorak1.zgodovinaZamud) || "0";
    var odgovori = (podatkiKorak1 && podatkiKorak1.vprasalnikOdgovori) || { poravnalVedno: null, opomniliVeckrat: null, prekrsilDogovor: null };
    var zTocke = tockeZgodovine(zgodovinaZamud);
    var vTocke = tockeVprasalnika(odgovori, zgodovinaZamud);
    var jeZapadel = zamuda.kategorija !== "Ni zapadel" && zamuda.kategorija !== "Ni podatka";
    var toneId = izracunajTon(dolg.tocke, zamuda.tocke, zTocke, vTocke, jeZapadel);
    var debtCategory = dolg.kategorija === "Ni podatka" ? "unknown" : dolg.kategorija;
    var excessiveCategory = zamuda.kategorija === "Ni podatka" ? "unknown" : zamuda.kategorija;
    var timingLabel = zamuda.dnevi != null ? (zamuda.dnevi <= 0 ? "Ni zapadel" : zamuda.dnevi + " dni zamude") : "Ni podatka";
    var amountLabel = dolg.kategorija !== "Ni podatka" ? (znesek.toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €") : "Ni podatka";
    var reasonText = sestaviReasonText(dolg, zamuda, zamuda.dnevi, zTocke, vTocke, zgodovinaZamud, odgovori);
    return {
      recommendedToneId: toneId, reasonText: reasonText, reasonDetailText: reasonText,
      debtCategory: debtCategory, debtCategoryLabel: dolg.kategorija,
      overdueCategory: excessiveCategory, timingLabel: timingLabel,
      overdueDays: zamuda.dnevi != null ? zamuda.dnevi : null,
      missingDue: originalDueDate ? false : true, missingAmount: amountCents > 0 ? false : true,
      amountLabel: amountLabel, amountCentsSnapshot: amountCents,
      originalDueDateSnapshot: originalDueDate, evaluationDate: evaluationDate,
      calculatedAt: new Date().toISOString(), recommendationVersion: "ocena-tveganja-v1",
    };
  }

  function preberiPodatkeKorak1() {
    try { return JSON.parse(sessionStorage.getItem("neplacilo-korak1-podatki") || "{}"); } catch (_e) { return {}; }
  }

  function preberiOdgovoreVprasalnika() {
    var p = preberiPodatkeKorak1();
    return p.vprasalnikOdgovori || { poravnalVedno: null, opomniliVeckrat: null, prekrsilDogovor: null };
  }

  function osveziKartice() {
    var znesekEl = document.getElementById("znesek-dolga");
    var datumEl = document.getElementById("datum-zapadlosti");
    var dolgStatus = document.getElementById("ocena-tveganja-dolg-status");
    var dolgVrednost = document.getElementById("ocena-tveganja-dolg-vrednost");
    var zamudaStatus = document.getElementById("ocena-tveganja-zamuda-status");
    var zamudaVrednost = document.getElementById("ocena-tveganja-zamuda-vrednost");
    var znesek = znesekEl ? Number(String(znesekEl.value || "").replace(",", ".")) : 0;
    var datumZapadlosti = datumEl ? datumEl.value : "";
    preberiUid().then(function (uid) {
      _trenutniUid = uid || null;
      var pragovi = preberiPragove(uid);
      var dolg = kategorijaDolga(znesek, pragovi);
      var zamuda = kategorijaZamude(datumZapadlosti, pragovi);
      if (dolgStatus) dolgStatus.textContent = dolg.kategorija;
      if (dolgVrednost) dolgVrednost.textContent = Number.isFinite(znesek) && znesek > 0 ? znesek.toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "—";
      if (zamudaStatus) zamudaStatus.textContent = zamuda.kategorija;
      if (zamudaVrednost) zamudaVrednost.textContent = zamuda.dnevi != null ? (zamuda.dnevi <= 0 ? "0 dni" : zamuda.dnevi + " dni") : "—";
    });
  }

  /* ---------- Sync funkcije ---------- */

  function syncOdVrednosti() {
    var nDo = Number(String((document.getElementById("ocena-dolg-nizek-do") || {}).value || "").replace(",", "."));
    var sDo = Number(String((document.getElementById("ocena-dolg-srednji-do") || {}).value || "").replace(",", "."));
    var vDo = Number(String((document.getElementById("ocena-dolg-visok-do") || {}).value || "").replace(",", "."));
    var sOd = document.getElementById("ocena-dolg-srednji-od");
    var vOd = document.getElementById("ocena-dolg-visok-od");
    var eOd = document.getElementById("ocena-dolg-ekstremni-od");
    if (Number.isFinite(nDo) && sOd) sOd.value = String(Math.round((nDo + 1) * 100) / 100);
    if (Number.isFinite(sDo) && vOd) vOd.value = String(Math.round((sDo + 1) * 100) / 100);
    if (Number.isFinite(vDo) && eOd) eOd.value = String(Math.round((vDo + 1) * 100) / 100);
  }

  function syncOdZamude() {
    var kDo = Number(String((document.getElementById("ocena-zamuda-kratka-do") || {}).value || ""));
    var sDo = Number(String((document.getElementById("ocena-zamuda-srednja-do") || {}).value || ""));
    var vDo = Number(String((document.getElementById("ocena-zamuda-visoka-do") || {}).value || ""));
    var sOd = document.getElementById("ocena-zamuda-srednja-od");
    var vOd = document.getElementById("ocena-zamuda-visoka-od");
    var eOd = document.getElementById("ocena-zamuda-ekstremna-od");
    if (Number.isFinite(kDo) && sOd) sOd.value = String(Math.round(kDo + 1));
    if (Number.isFinite(sDo) && vOd) vOd.value = String(Math.round(sDo + 1));
    if (Number.isFinite(vDo) && eOd) eOd.value = String(Math.round(vDo + 1));
  }

  function beriDolgPragoveIzDOM() {
    var f = function (id) { return Number(String((document.getElementById(id) || {}).value || "").replace(",", ".")); };
    return {
      dolgNizekOd: f("ocena-dolg-nizek-od"), dolgNizekDo: f("ocena-dolg-nizek-do"),
      dolgSrednjiOd: f("ocena-dolg-srednji-od"), dolgSrednjiDo: f("ocena-dolg-srednji-do"),
      dolgVisokOd: f("ocena-dolg-visok-od"), dolgVisokDo: f("ocena-dolg-visok-do"),
      dolgEkstremniOd: f("ocena-dolg-ekstremni-od"),
    };
  }

  function beriZamudaPragoveIzDOM() {
    var f = function (id) { return Number((document.getElementById(id) || {}).value || ""); };
    return {
      zamudaKratkaOd: f("ocena-zamuda-kratka-od"), zamudaKratkaDo: f("ocena-zamuda-kratka-do"),
      zamudaSrednjaOd: f("ocena-zamuda-srednja-od"), zamudaSrednjaDo: f("ocena-zamuda-srednja-do"),
      zamudaVisokaOd: f("ocena-zamuda-visoka-od"), zamudaVisokaDo: f("ocena-zamuda-visoka-do"),
      zamudaEkstremnaOd: f("ocena-zamuda-ekstremna-od"),
    };
  }

  function nastaviDolgInpute(p) {
    var s = function (id, v) { var el = document.getElementById(id); if (el) el.value = String(v); };
    s("ocena-dolg-nizek-od", p.dolgNizekOd); s("ocena-dolg-nizek-do", p.dolgNizekDo);
    s("ocena-dolg-srednji-od", p.dolgSrednjiOd); s("ocena-dolg-srednji-do", p.dolgSrednjiDo);
    s("ocena-dolg-visok-od", p.dolgVisokOd); s("ocena-dolg-visok-do", p.dolgVisokDo);
    s("ocena-dolg-ekstremni-od", p.dolgEkstremniOd);
  }

  function nastaviZamudaInpute(p) {
    var s = function (id, v) { var el = document.getElementById(id); if (el) el.value = String(v); };
    s("ocena-zamuda-kratka-od", p.zamudaKratkaOd); s("ocena-zamuda-kratka-do", p.zamudaKratkaDo);
    s("ocena-zamuda-srednja-od", p.zamudaSrednjaOd); s("ocena-zamuda-srednja-do", p.zamudaSrednjaDo);
    s("ocena-zamuda-visoka-od", p.zamudaVisokaOd); s("ocena-zamuda-visoka-do", p.zamudaVisokaDo);
    s("ocena-zamuda-ekstremna-od", p.zamudaEkstremnaOd);
  }

  /* ---------- DOM vezava ---------- */

  var _inicializirano = false;

  function preberiParZPrefixom(prefix) {
    var vsi = document.querySelectorAll('[data-ocena-zgodovina-' + prefix + ']');
    var da = null, ne = null;
    for (var i = 0; i < vsi.length; i++) {
      var g = vsi[i];
      if (g.getAttribute('data-ocena-zgodovina-' + prefix) === "da") da = g;
      if (g.getAttribute('data-ocena-zgodovina-' + prefix) === "ne") ne = g;
    }
    if (da && da.getAttribute("aria-pressed") === "true") return true;
    if (ne && ne.getAttribute("aria-pressed") === "true") return false;
    return null;
  }

  function nastaviParSPrefixom(prefix, vrednost) {
    var vsi = document.querySelectorAll('[data-ocena-zgodovina-' + prefix + ']');
    for (var i = 0; i < vsi.length; i++) {
      var btn = vsi[i];
      var attrVal = btn.getAttribute('data-ocena-zgodovina-' + prefix);
      var jeAktiven = (vrednost === true && attrVal === "da") || (vrednost === false && attrVal === "ne");
      btn.setAttribute("aria-pressed", jeAktiven ? "true" : "false");
    }
  }

  function obnoviZgodovinaSheetUI() {
    var odg = preberiOdgovoreVprasalnika();
    nastaviParSPrefixom("poravnal", odg.poravnalVedno);
    nastaviParSPrefixom("opomniti", odg.opomniliVeckrat);
    nastaviParSPrefixom("prekrsil", odg.prekrsilDogovor);
  }

  function inicializirajUIOceno() {
    if (_inicializirano) return;
    _inicializirano = true;

    preberiUid().then(function (uid) {
      _trenutniUid = uid || null;
      var p = preberiPragove(uid);
      nastaviDolgInpute(p);
      nastaviZamudaInpute(p);
    });

    // --- Sync on input ---
    var dolgInputi = document.querySelectorAll("#ocena-dolg-nizek-do, #ocena-dolg-srednji-do, #ocena-dolg-visok-do");
    for (var di = 0; di < dolgInputi.length; di++) dolgInputi[di].addEventListener("input", syncOdVrednosti);

    var zamInputi = document.querySelectorAll("#ocena-zamuda-kratka-do, #ocena-zamuda-srednja-do, #ocena-zamuda-visoka-do");
    for (var zi = 0; zi < zamInputi.length; zi++) zamInputi[zi].addEventListener("input", syncOdZamude);

    // --- Takojšnja validacija ob zapustitvi polja (blur) ---
    var vsiDolgInputi = document.querySelectorAll("#ocena-dolg-nizek-od, #ocena-dolg-nizek-do, #ocena-dolg-srednji-od, #ocena-dolg-srednji-do, #ocena-dolg-visok-od, #ocena-dolg-visok-do, #ocena-dolg-ekstremni-od");
    for (var di = 0; di < vsiDolgInputi.length; di++) {
      vsiDolgInputi[di].addEventListener("blur", function () {
        var p = beriDolgPragoveIzDOM();
        if (!validirajDolgPragove(p)) this.focus();
      });
    }
    var vsiZamInputi = document.querySelectorAll("#ocena-zamuda-kratka-od, #ocena-zamuda-kratka-do, #ocena-zamuda-srednja-od, #ocena-zamuda-srednja-do, #ocena-zamuda-visoka-od, #ocena-zamuda-visoka-do, #ocena-zamuda-ekstremna-od");
    for (var zi = 0; zi < vsiZamInputi.length; zi++) {
      vsiZamInputi[zi].addEventListener("blur", function () {
        var p = beriZamudaPragoveIzDOM();
        if (!validirajZamudaPragove(p)) this.focus();
      });
    }

    // --- Meni za dolg ---
    vezaviMeni("ocena-dolg-sheet", "[data-odpri-nastavitve-dolga]", "[data-ocena-dolg-zapri]", "[data-ocena-dolg-ponastavi]", "[data-ocena-dolg-shrani]",
      function () { nastaviDolgInpute(vrniPrivzetePragove()); },
      function () {
        var p = beriDolgPragoveIzDOM();
        if (!validirajDolgPragove(p)) return false;
        preberiUid().then(function (uid) { _trenutniUid = uid || null; shraniPragove(uid, p); osveziKartice(); });
        skrijNapakoVDolgu();
        return true;
      }
    );

    // --- Meni za zamudo ---
    vezaviMeni("ocena-zamuda-sheet", "[data-odpri-nastavitve-zamude]", "[data-ocena-zamuda-zapri]", "[data-ocena-zamuda-ponastavi]", "[data-ocena-zamuda-shrani]",
      function () { nastaviZamudaInpute(vrniPrivzetePragove()); },
      function () {
        var p = beriZamudaPragoveIzDOM();
        if (!validirajZamudaPragove(p)) return false;
        preberiUid().then(function (uid) { _trenutniUid = uid || null; shraniPragove(uid, p); osveziKartice(); });
        skrijNapakoVZamudi();
        return true;
      }
    );

    // --- Zgodovina zamud gumbi ---
    var zgodovinaIzbori = document.querySelectorAll("[data-zgodovina-zamud]");
    for (var i = 0; i < zgodovinaIzbori.length; i++) {
      zgodovinaIzbori[i].addEventListener("click", function () {
        for (var j = 0; j < zgodovinaIzbori.length; j++) zgodovinaIzbori[j].setAttribute("aria-pressed", "false");
        this.setAttribute("aria-pressed", "true");
        var vrednost = this.getAttribute("data-zgodovina-zamud");
        shraniZgodovinoZamud(vrednost);
        if (vrednost !== "unknown" && vrednost !== "0") odpriZgodovinaSheet(vrednost);
      });
    }

    function odpriZgodovinaSheet(vrednost) {
      var izbranoEl = document.getElementById("ocena-zgodovina-izbrano");
      if (izbranoEl) {
        var st = vrednost === "9plus" ? "9 ali več" : vrednost;
        izbranoEl.textContent = "Izbrano: " + (vrednost === "1" ? "1 zamuda" : st + " zamud");
      }
      obnoviZgodovinaSheetUI();
      var sheet = document.getElementById("ocena-zgodovina-sheet");
      if (sheet) sheet.hidden = false;
    }

    var povprasalniGumbi = document.querySelectorAll("[data-ocena-zgodovina-poravnal], [data-ocena-zgodovina-opomniti], [data-ocena-zgodovina-prekrsil]");
    for (var k = 0; k < povprasalniGumbi.length; k++) {
      povprasalniGumbi[k].addEventListener("click", function () {
        if (this.getAttribute("aria-pressed") === "true") return;
        var skupina = this.parentElement;
        if (skupina) {
          var sosedi = skupina.querySelectorAll(".ocena-sheet__da-ne-gumb");
          for (var m = 0; m < sosedi.length; m++) sosedi[m].setAttribute("aria-pressed", sosedi[m] === this ? "true" : "false");
        }
      });
    }

    var zgZapriBtns = document.querySelectorAll("[data-ocena-zgodovina-zapri]");
    for (var z = 0; z < zgZapriBtns.length; z++) {
      zgZapriBtns[z].addEventListener("click", function () {
        var sheet = document.getElementById("ocena-zgodovina-sheet");
        if (sheet) sheet.hidden = true;
      });
    }

    var shraniBtn = document.querySelector("[data-ocena-zgodovina-shrani]");
    if (shraniBtn) {
      shraniBtn.addEventListener("click", function () {
        var odgovori = { poravnalVedno: preberiParZPrefixom("poravnal"), opomniliVeckrat: preberiParZPrefixom("opomniti"), prekrsilDogovor: preberiParZPrefixom("prekrsil") };
        shraniVprasalnik(odgovori);
        var sheet = document.getElementById("ocena-zgodovina-sheet");
        if (sheet) sheet.hidden = true;
      });
    }

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        var sheets = ["ocena-dolg-sheet", "ocena-zamuda-sheet", "ocena-zgodovina-sheet"];
        for (var s = 0; s < sheets.length; s++) { var el = document.getElementById(sheets[s]); if (el) el.hidden = true; }
      }
    });
  }

  function validirajDolgPragove(p) {
    if (!Number.isFinite(p.dolgNizekDo) || p.dolgNizekDo < 0) { return oknoNapake("Vnesite veljavno mejo za nizek dolg."); }
    if (Number.isFinite(p.dolgNizekOd) && Number.isFinite(p.dolgNizekDo) && p.dolgNizekOd > p.dolgNizekDo) { return oknoNapake("Številka mora biti nižja od " + p.dolgNizekDo + "."); }
    if (Number.isFinite(p.dolgSrednjiOd) && Number.isFinite(p.dolgSrednjiDo) && p.dolgSrednjiOd > p.dolgSrednjiDo) { return oknoNapake("Številka mora biti nižja od " + p.dolgSrednjiDo + "."); }
    if (!Number.isFinite(p.dolgSrednjiDo) || p.dolgSrednjiDo <= p.dolgNizekDo) { return oknoNapake("Številka mora biti višja od " + p.dolgNizekDo + "."); }
    if (Number.isFinite(p.dolgVisokOd) && Number.isFinite(p.dolgVisokDo) && p.dolgVisokOd > p.dolgVisokDo) { return oknoNapake("Številka mora biti nižja od " + p.dolgVisokDo + "."); }
    if (!Number.isFinite(p.dolgVisokDo) || p.dolgVisokDo <= p.dolgSrednjiDo) { return oknoNapake("Številka mora biti višja od " + p.dolgSrednjiDo + "."); }
    if (Number.isFinite(p.dolgEkstremniOd) && Number.isFinite(p.dolgVisokDo) && p.dolgEkstremniOd <= p.dolgVisokDo) { return oknoNapake("Številka mora biti višja od " + p.dolgVisokDo + "."); }
    return true;
  }

  function validirajZamudaPragove(p) {
    if (!Number.isFinite(p.zamudaKratkaDo) || p.zamudaKratkaDo < 1) { return oknoNapake("Vnesite veljavno mejo za kratko zamudo."); }
    if (Number.isFinite(p.zamudaKratkaOd) && Number.isFinite(p.zamudaKratkaDo) && p.zamudaKratkaOd > p.zamudaKratkaDo) { return oknoNapake("Številka mora biti nižja od " + p.zamudaKratkaDo + "."); }
    if (Number.isFinite(p.zamudaSrednjaOd) && Number.isFinite(p.zamudaSrednjaDo) && p.zamudaSrednjaOd > p.zamudaSrednjaDo) { return oknoNapake("Številka mora biti nižja od " + p.zamudaSrednjaDo + "."); }
    if (!Number.isFinite(p.zamudaSrednjaDo) || p.zamudaSrednjaDo <= p.zamudaKratkaDo) { return oknoNapake("Številka mora biti višja od " + p.zamudaKratkaDo + "."); }
    if (Number.isFinite(p.zamudaVisokaOd) && Number.isFinite(p.zamudaVisokaDo) && p.zamudaVisokaOd > p.zamudaVisokaDo) { return oknoNapake("Številka mora biti nižja od " + p.zamudaVisokaDo + "."); }
    if (!Number.isFinite(p.zamudaVisokaDo) || p.zamudaVisokaDo <= p.zamudaSrednjaDo) { return oknoNapake("Številka mora biti višja od " + p.zamudaSrednjaDo + "."); }
    if (Number.isFinite(p.zamudaEkstremnaOd) && Number.isFinite(p.zamudaVisokaDo) && p.zamudaEkstremnaOd <= p.zamudaVisokaDo) { return oknoNapake("Številka mora biti višja od " + p.zamudaVisokaDo + "."); }
    return true;
  }

  function oknoNapake(sporocilo) {
    if (root.potrdiVprasanje && typeof root.potrdiVprasanje === "function") {
      root.potrdiVprasanje({
        naslov: "Napaka pri vnosu",
        opis: sporocilo,
        potrdiBesedilo: "V redu",
        samoEnGumb: true,
        stil: "primary",
      });
    }
    return false;
  }

  function vezaviMeni(sheetId, odpriSelector, zapriSelector, ponastaviSelector, shraniSelector, ponastaviFn, shraniFn) {
    var sheet = document.getElementById(sheetId);
    if (!sheet) return;
    var odpriBtn = document.querySelector(odpriSelector);
    if (odpriBtn) odpriBtn.addEventListener("click", function () { sheet.hidden = false; });
    var zapriBtns = sheet.querySelectorAll(zapriSelector);
    for (var i = 0; i < zapriBtns.length; i++) zapriBtns[i].addEventListener("click", function () { sheet.hidden = true; });
    var ponastaviBtn = sheet.querySelector(ponastaviSelector);
    if (ponastaviBtn && ponastaviFn) ponastaviBtn.addEventListener("click", ponastaviFn);
    var shraniBtn = sheet.querySelector(shraniSelector);
    if (shraniBtn && shraniFn) shraniBtn.addEventListener("click", function () { var ok = shraniFn(); if (ok) sheet.hidden = true; });
  }

  function opozoriVDolgu(msg) { napakaVSheetu("ocena-dolg-sheet", msg); }
  function skrijNapakoVDolgu() { skrijNapakoVSheetu("ocena-dolg-sheet"); }
  function opozoriVZamudi(msg) { napakaVSheetu("ocena-zamuda-sheet", msg); }
  function skrijNapakoVZamudi() { skrijNapakoVSheetu("ocena-zamuda-sheet"); }

  function napakaVSheetu(sheetId, msg) {
    var sheet = document.getElementById(sheetId);
    if (!sheet) return;
    var napaka = sheet.querySelector(".ocena-sheet__napaka");
    if (!napaka) { napaka = document.createElement("p"); napaka.className = "ocena-sheet__napaka"; napaka.setAttribute("role", "alert"); var telo = sheet.querySelector(".ocena-sheet__telo"); if (telo) telo.appendChild(napaka); }
    napaka.textContent = msg; napaka.hidden = false;
  }

  function skrijNapakoVSheetu(sheetId) {
    var sheet = document.getElementById(sheetId);
    if (!sheet) return;
    var napaka = sheet.querySelector(".ocena-sheet__napaka");
    if (napaka) napaka.hidden = true;
  }

  function shraniZgodovinoZamud(vrednost) {
    try {
      var raw = sessionStorage.getItem("neplacilo-korak1-podatki"); var p = raw ? JSON.parse(raw) : {};
      p.zgodovinaZamud = vrednost;
      if (!p.vprasalnikOdgovori) p.vprasalnikOdgovori = { poravnalVedno: null, opomniliVeckrat: null, prekrsilDogovor: null };
      sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify(p));
    } catch (_e) {}
  }

  function shraniVprasalnik(odgovori) {
    try {
      var raw = sessionStorage.getItem("neplacilo-korak1-podatki"); var p = raw ? JSON.parse(raw) : {};
      p.vprasalnikOdgovori = odgovori;
      sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify(p));
    } catch (_e) {}
  }

  var api = {
    izracunajPriporocilo: izracunajPriporocilo, osveziKartice: osveziKartice,
    inicializirajUIOceno: inicializirajUIOceno, preberiOdgovoreVprasalnika: preberiOdgovoreVprasalnika,
    preberiPodatkeKorak1: preberiPodatkeKorak1, koledarskiDneviZamude: koledarskiDneviZamude,
  };
  root.UJOcenaTveganja = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
