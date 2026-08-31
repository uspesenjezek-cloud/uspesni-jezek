(function () {
  "use strict";

  var debug = window.UJPoravnavaWidget;
  var K = window.UJIzvedbaKomponente;
  var fatherCatalog = window.UJAtenaCardTemplates && window.UJAtenaCardTemplates.categories["2.0"];
  var root = document.getElementById("izvedba-action-sheet");
  var nacin = "natural";
  var naravniOpis = "";
  var ciljAiStatus = "idle";
  var ciljAiNapaka = "";
  var ciljAiRequestId = "";
  var ciljAiGeneracija = 0;
  var ciljAnalizaAbort = null;
  var ciljAiPredlogi = [];
  var ciljAiAktivniIndeks = 0;
  var CILJ_AI_MAX_KORAKOV = 20;
  var ciljAiPhase = "input";
  var ciljClarificationQuestion = "";
  var ciljClarificationAnswer = "";
  var ciljClarificationRound = 0;
  var ciljClarificationExhausted = false;
  var ciljVirUrejanje = false;
  var ciljVirOsnutek = "";
  var ciljCanary = null;
  var ciljSnemanjeAktivno = false;
  var ciljRavenGlasu = 0;
  var ciljAnalizaStatusCasovnik = 0;
  var ciljAnalizaStatusKorak = 0;
  var CILJ_ANALIZA_STATUS_BESEDILA = [
    "Berem vaš opis …",
    "Iščem ključni cilj …",
    "Preverjam zneske …",
    "Preverjam rok …",
    "Razvrščam možnosti …",
    "Preverjam podrobnosti …",
    "Pripravljam pregled …",
  ];
  var korak1 = null;
  var odprtaPodizbira = null;
  var ciljStran = 0;
  var ciljOsnutekId = null;
  var ciljOsnutekPodatki = {};
  var ciljNapaka = "";
  var pravnaOsnutekId = null;
  var pravnaOsnutekPodatki = {};
  var pravnaNapaka = "";
  var pravnaIzbiraIzLune = false;
  var KLJUC_SEJE_CILJ = "neplacilo-cilj-podatki";
  var SELECTOR_NADALJUJ = "[data-zgodovina-nadaljuj], [data-action-sheet-confirm]";
  var CILJ_FATHER_KARTICE = (fatherCatalog && fatherCatalog.goals || []).map(function (kartica) {
    return { id:kartica.id, naslov:kartica.title, ikona:kartica.icon, razred:kartica.tone, rocno:kartica.manualVisible };
  });
  var PRAVNA_IZTERJAVA_REZULTATI = (fatherCatalog && fatherCatalog.legalOutcomes || []).map(function (rezultat) {
    return { id:rezultat.id, naslov:rezultat.title, ikona:rezultat.icon, opis:rezultat.description };
  });
  var PRAVNA_CILJNA_POLJA = Object.freeze(Object.fromEntries(Object.entries(fatherCatalog && fatherCatalog.legalFields || {}).map(function (vnos) {
    return [vnos[0], vnos[1].map(function (polje) {
      return { tip:polje.type, ime:polje.name, oznaka:polje.label, placeholder:polje.placeholder, moznosti:polje.options };
    })];
  })));

  function preberiCiljSejo() {
    try {
      var podatki = JSON.parse(sessionStorage.getItem(KLJUC_SEJE_CILJ) || "null");
      return podatki && typeof podatki === "object" ? podatki : null;
    } catch (_napaka) {
      return null;
    }
  }

  try {
    korak1 = JSON.parse(sessionStorage.getItem("neplacilo-korak1-podatki") || "null");
  } catch (_napaka) {
    korak1 = null;
  }

  function izracunajCiljniDolg() {
    var prvotni = Number(korak1 && korak1.znesek) || 0;
    try {
      var zgodovina = JSON.parse(sessionStorage.getItem("neplacilo-zgodovina-podatki") || "null");
      if (!zgodovina || zgodovina.potrjena !== true || !Array.isArray(zgodovina.dogodki)) return prvotni;
      var zmanjsanje = zgodovina.dogodki.reduce(function (vsota, dogodek) {
        var znesek = Number(dogodek && dogodek.znesek);
        return vsota + (Number.isFinite(znesek) && znesek > 0 ? znesek : 0);
      }, 0);
      return Math.max(0, Math.round((prvotni - zmanjsanje) * 100) / 100);
    } catch (_napaka) {
      return prvotni;
    }
  }

  var ciljniDolg = izracunajCiljniDolg();

  if (!fatherCatalog || fatherCatalog.category !== "2.0" || !korak1 || !Number(korak1.znesek) || !debug || !debug.state || !root || !K) {
    var napaka = document.getElementById("cilj-napaka");
    if (napaka) {
      napaka.textContent = "Izbire cilja trenutno ni mogoče odpreti.";
      napaka.hidden = false;
    }
    return;
  }

  function naravniVnosHtml() {
    var pripravlja = ciljAiStatus === "analyzing";
    var recording = ciljSnemanjeAktivno || Boolean(ciljCanary && ciljCanary.isRecording());
    if (ciljAiPhase === "clarification" && ciljClarificationQuestion) return ciljAtenaPojasniloHtml();
    if (ciljAiPhase === "clarification_exhausted" && ciljClarificationExhausted) return ciljAtenaPojasniloIzcrpanoHtml();
    if (ciljAiPhase === "questions" && pravnaIzbiraIzLune && pravnaOsnutekId) return ciljAtenaPravnoVprasanjeHtml();
    if (ciljAiPhase === "questions" && ciljOsnutekId) return ciljAtenaVprasanjeHtml();
    if (ciljAiPhase === "review" && (ciljOsnutekId || ciljAiPredlogi.length)) return ciljAtenaPovzetekHtml();
    var status = ciljAiNapaka
      ? '<p class="zgodovina-ai__status is-error" aria-live="polite">' + K.esc(ciljAiNapaka) + '</p>'
      : '';
    var merilnik = recording ? '<span class="zgodovina-ai__glasnost" data-cilj-voice-meter aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' : '';
    return '<section class="zgodovina-ai" aria-label="Povejte ali napišite cilj">' +
      '<label class="zgodovina-ai__vnos"><span class="sr-only">Opis želenega cilja</span>' +
      '<textarea maxlength="2000" data-cilj-opis placeholder="Npr. želim čimprejšnje plačilo …"' + (pripravlja ? ' disabled' : '') + '>' + K.esc(naravniOpis) + '</textarea></label>' +
      '<div class="zgodovina-ai__akcije">' +
      '<button type="button" class="zgodovina-ai__snemaj' + (recording ? ' is-recording' : '') + '" data-cilj-snemaj aria-label="' + (recording ? 'Prekini snemanje' : 'Povej na glas') + '" aria-pressed="' + String(recording) + '"' + (pripravlja ? ' disabled' : '') + '>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg><span class="zgodovina-ai__snemaj-napis">' + (recording ? 'Prekini snemanje' : 'Povej na glas') + '</span>' + merilnik + '</button>' +
      '<button type="button" class="zgodovina-ai__razumi" data-cilj-pripravi' + (pripravlja ? ' aria-busy="true"' : '') + (pripravlja || recording || !naravniOpis.trim() ? ' disabled' : '') + '>' + (pripravlja ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span><span data-ai-analyze-status>' + K.esc(CILJ_ANALIZA_STATUS_BESEDILA[0]) + '</span>' : 'Pripravi cilje') + '</button>' +
      '</div>' + status + '</section>';
  }

  function ciljAtenaPojasniloHtml() {
    var busy = ciljAiStatus === "analyzing";
    var status = ciljAiNapaka
      ? '<p class="zgodovina-ai__status is-error" aria-live="polite">' + K.esc(ciljAiNapaka) + '</p>'
      : '';
    return '<div class="zgodovina-ai-pogovor zgodovina-ai-pogovor--pojasnilo">' + ciljAtenaVirOpisHtml() + ciljAtenaNapredekHtml(false) + ciljAtenaStanjeDolgaHtml() +
      '<div class="zgodovina-ai-pojasnilo" role="dialog" aria-modal="false" aria-labelledby="cilj-ai-pojasnilo-naslov">' +
      '<div class="zgodovina-ai-pojasnilo__ikona" aria-hidden="true">?</div>' +
      '<div class="zgodovina-ai-pojasnilo__vsebina"><p class="zgodovina-ai-pojasnilo__oznaka">Potrebujemo še en podatek</p>' +
      '<h3 id="cilj-ai-pojasnilo-naslov">' + K.esc(ciljClarificationQuestion) + '</h3>' +
      '<label><span class="sr-only">Vaš odgovor</span><textarea maxlength="400" data-cilj-clarification-answer placeholder="Odgovorite s kratkim jasnim stavkom …"' + (busy ? ' disabled' : '') + '>' + K.esc(ciljClarificationAnswer) + '</textarea></label>' +
      '<div class="zgodovina-ai-pojasnilo__akcije"><button type="button" data-cilj-clarification-edit' + (busy ? ' disabled' : '') + '>Uredi opis</button>' +
      '<button type="button" class="zgodovina-ai__potrdi" data-cilj-clarification-submit' + (!ciljClarificationAnswer.trim() || busy ? ' disabled' : '') + '>' + (busy ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span> Preverjam …' : 'Odgovori') + '</button></div>' +
      status + '</div></div></div>';
  }

  function ciljAtenaPojasniloIzcrpanoHtml() {
    return '<div class="zgodovina-ai-pogovor zgodovina-ai-pogovor--pojasnilo">' + ciljAtenaVirOpisHtml() + ciljAtenaNapredekHtml(false) + ciljAtenaStanjeDolgaHtml() +
      '<div class="zgodovina-ai-pojasnilo zgodovina-ai-pojasnilo--izcrpano" role="dialog" aria-modal="false" aria-labelledby="cilj-ai-pojasnilo-izcrpano-naslov">' +
      '<div class="zgodovina-ai-pojasnilo__ikona" aria-hidden="true">!</div>' +
      '<div class="zgodovina-ai-pojasnilo__vsebina"><p class="zgodovina-ai-pojasnilo__oznaka">Varna omejitev dosežena</p>' +
      '<h3 id="cilj-ai-pojasnilo-izcrpano-naslov">Opisa ni bilo mogoče dovolj zanesljivo razumeti.</h3>' +
      '<p class="zgodovina-ai-pojasnilo__besedilo">Cilj izberite ročno ali uredite prvotni opis.</p>' +
      '<div class="zgodovina-ai-pojasnilo__akcije"><button type="button" data-cilj-clarification-edit>Uredi opis</button>' +
      '<button type="button" class="zgodovina-ai__potrdi" data-cilj-ai-manual>Ročno izberi</button></div></div></div></div>';
  }

  function prilagodiVisinoCiljnegaVnosa(polje) {
    if (!polje) return;
    polje.style.height = "auto";
    var obroba = Math.max(0, polje.offsetHeight - polje.clientHeight);
    polje.style.height = Math.max(polje.scrollHeight + obroba, 91) + "px";
  }

  function ustaviCiljAnalizaStatus() {
    if (ciljAnalizaStatusCasovnik) window.clearInterval(ciljAnalizaStatusCasovnik);
    ciljAnalizaStatusCasovnik = 0;
    ciljAnalizaStatusKorak = 0;
  }

  function prekiniCiljAnalizo() {
    ciljAiGeneracija += 1;
    if (ciljAnalizaAbort) {
      ciljAnalizaAbort.abort();
      ciljAnalizaAbort.dispose();
      ciljAnalizaAbort = null;
    }
    ustaviCiljAnalizaStatus();
    if (ciljAiStatus === "analyzing") ciljAiStatus = "ready";
  }

  function posodobiCiljAnalizaStatus() {
    var oznaka = root.querySelector("[data-ai-analyze-status]");
    if (!oznaka || ciljAiStatus !== "analyzing") return;
    oznaka.textContent = CILJ_ANALIZA_STATUS_BESEDILA[ciljAnalizaStatusKorak];
    oznaka.classList.remove("is-changing");
    void oznaka.offsetWidth;
    oznaka.classList.add("is-changing");
    ciljAnalizaStatusKorak = (ciljAnalizaStatusKorak + 1) % CILJ_ANALIZA_STATUS_BESEDILA.length;
  }

  function zacniCiljAnalizaStatus() {
    ustaviCiljAnalizaStatus();
    posodobiCiljAnalizaStatus();
    ciljAnalizaStatusCasovnik = window.setInterval(posodobiCiljAnalizaStatus, 1200);
  }

  function zacniCiljRazsiritev(razred, preveri) {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var akcije = root.querySelector(".zgodovina-ai__akcije");
        if (akcije && preveri()) akcije.classList.add(razred);
      });
    });
  }

  function posodobiCiljGlasnost(vrednost) {
    ciljRavenGlasu = Math.min(1, Math.max(0, Number(vrednost) || 0));
    var merilnik = root.querySelector("[data-cilj-voice-meter]");
    if (!merilnik) return;
    var faktorji = [0.56, 0.82, 1, 0.76, 0.5];
    Array.prototype.forEach.call(merilnik.children, function (stolpec, indeks) {
      var nivo = Math.max(0.12, Math.min(1, ciljRavenGlasu * faktorji[indeks] + ciljRavenGlasu * ciljRavenGlasu * (indeks % 2 ? 0.14 : 0.24)));
      stolpec.style.setProperty("--voice-bar", nivo.toFixed(3));
    });
  }

  function pocakajNaCiljRazsiritev(zacetek) {
    var preostanek = 900 - (Date.now() - zacetek);
    return preostanek > 0 ? new Promise(function (resolve) { window.setTimeout(resolve, preostanek); }) : Promise.resolve();
  }

  function nacinaHtml() {
    return '<section class="zgodovina-nacina" data-cilj-nacina aria-label="Način izbire cilja">' +
      '<div class="zgodovina-nacina__izbira" role="tablist" aria-label="Način izbire cilja">' +
      '<button type="button" role="tab" data-cilj-nacin="natural" aria-selected="' + String(nacin === "natural") + '" class="' + (nacin === "natural" ? "is-selected" : "") + '">' +
      '<span aria-hidden="true">' + K.ikona("pencil") + '</span><strong>Povej ali napiši</strong><small>Hitrejši vnos</small></button>' +
      '<button type="button" role="tab" data-cilj-nacin="manual" aria-selected="' + String(nacin === "manual") + '" class="' + (nacin === "manual" ? "is-selected" : "") + '">' +
      '<span aria-hidden="true">' + K.ikona("checkCircle") + '</span><strong>Ročno izberi</strong><small>Obstoječe kartice</small></button>' +
      '</div>' + (nacin === "natural" ? naravniVnosHtml() : '') + '</section>';
  }

  function izbraniCiljId(state) {
    var prvi = state && Array.isArray(state.nacrtKoraki) ? state.nacrtKoraki[0] : null;
    return String(prvi && prvi.settings && prvi.settings.goalId || "");
  }

  function ciljAiPredlogiHtml() {
    if (!Array.isArray(ciljAiPredlogi) || ciljAiPredlogi.length < 2) return "";
    return '<section class="cilj-ai-predlogi" aria-label="Atenine pripravljene možnosti"><p>Atena je razumela več ciljev. Izberite, katerega želite pregledati:</p><div>' + ciljAiPredlogi.map(function (predlog, indeks) {
      var kartica = CILJ_FATHER_KARTICE.find(function (moznost) { return moznost.id === predlog.goalId; });
      if (!kartica) return "";
      return '<button type="button" data-cilj-ai-predlog="' + indeks + '" class="' + (ciljOsnutekId === predlog.goalId || odprtaPodizbira === predlog.goalId ? 'is-selected' : '') + '">' + K.esc(kartica.naslov) + '</button>';
    }).join("") + '</div></section>';
  }

  function ciljFatherKarticeHtml(state) {
    var gumbi = CILJ_FATHER_KARTICE.filter(function (kartica) { return kartica.rocno !== false; }).map(function (kartica) {
      var izbrana = kartica.id === ciljOsnutekId;
      return '<button type="button" class="izvedba-poravnava-svicer__gumb izvedba-poravnava-svicer__gumb--' + K.esc(kartica.razred) + (izbrana ? ' is-selected' : '') + '" data-cilj-father="' + K.esc(kartica.id) + '" aria-pressed="' + String(izbrana) + '">' +
        '<span class="izvedba-poravnava-svicer__ikona" aria-hidden="true">' + K.ikona(kartica.ikona) + '</span>' +
        '<span data-izvedba-fit data-fit-min="7">' + K.esc(kartica.naslov) + '</span></button>';
    }).join("");
    return '<div class="izvedba-poravnava-svicer" data-cilj-drsnik role="group" aria-label="Cilji za dolg">' + gumbi + '</div>' +
      '<div class="zgodovina-svicer__pikice" aria-label="Strani ciljnih kartic">' +
      '<button type="button" class="zgodovina-svicer__pikica' + (ciljStran === 0 ? ' is-active' : '') + '" data-cilj-stran="0" aria-label="Prva stran ciljev" aria-current="' + String(ciljStran === 0) + '"></button>' +
      '<button type="button" class="zgodovina-svicer__pikica' + (ciljStran === 1 ? ' is-active' : '') + '" data-cilj-stran="1" aria-label="Druga stran ciljev" aria-current="' + String(ciljStran === 1) + '"></button></div>' + ciljAiPredlogiHtml() + ciljniVnosnikHtml();
  }

  function posodobiStranDrsnika(drsnik) {
    if (!drsnik) return;
    var najvecjiPremik = Math.max(0, drsnik.scrollWidth - drsnik.clientWidth);
    ciljStran = najvecjiPremik > 0 && drsnik.scrollLeft >= najvecjiPremik / 2 ? 1 : 0;
    var ovoj = drsnik.parentElement;
    if (!ovoj) return;
    ovoj.querySelectorAll("[data-cilj-stran]").forEach(function (pikica) {
      var aktivna = Number(pikica.getAttribute("data-cilj-stran")) === ciljStran;
      pikica.classList.toggle("is-active", aktivna);
      pikica.setAttribute("aria-current", String(aktivna));
    });
  }

  function poveziCiljniDrsnik(vsebnik) {
    var drsnik = vsebnik.querySelector("[data-cilj-drsnik]");
    if (!drsnik) return;
    drsnik.scrollLeft = ciljStran === 1 ? drsnik.scrollWidth : 0;
    drsnik.addEventListener("scroll", function () { posodobiStranDrsnika(drsnik); }, { passive: true });
    posodobiStranDrsnika(drsnik);
  }

  function ciljVrednost(ime, privzeta) {
    var vrednost = ciljOsnutekPodatki[ime];
    return vrednost == null || vrednost === "" ? (privzeta == null ? "" : privzeta) : vrednost;
  }

  function ciljStevilcnoPolje(ime, oznaka, privzeta, min, max) {
    return '<label class="zgodovina-dogodek__polje is-amount"><span class="zgodovina-ai-vprasanje__oznaka">' + K.esc(oznaka) + '</span><span class="zgodovina-ai-vprasanje__znesek"><input type="number" min="' + K.esc(min == null ? "0.01" : min) + '"' + (max == null ? '' : ' max="' + K.esc(max) + '"') + ' step="0.01" inputmode="decimal" data-cilj-polje="' + K.esc(ime) + '" data-izvedba-fit data-fit-min="10" value="' + K.esc(ciljVrednost(ime, privzeta)) + '" placeholder="Vnesite vrednost"><b>€</b></span></label>';
  }

  function ciljCeloStevilcnoPolje(ime, oznaka, privzeta, min, max) {
    return '<label class="zgodovina-dogodek__polje is-count"><span class="zgodovina-ai-vprasanje__oznaka">' + K.esc(oznaka) + '</span><input type="number" min="' + K.esc(min) + '" max="' + K.esc(max) + '" step="1" inputmode="numeric" data-cilj-polje="' + K.esc(ime) + '" data-izvedba-fit data-fit-min="10" value="' + K.esc(ciljVrednost(ime, privzeta)) + '" placeholder="Vnesite število"></label>';
  }

  function ciljBesedilnoPolje(ime, oznaka, placeholder, obvezno) {
    return '<label class="zgodovina-dogodek__polje"><span class="zgodovina-ai-vprasanje__oznaka">' + K.esc(oznaka) + (obvezno ? '' : ' <small>neobvezno</small>') + '</span><input type="text" maxlength="180" data-cilj-polje="' + K.esc(ime) + '" data-izvedba-fit data-fit-min="10" value="' + K.esc(ciljVrednost(ime, "")) + '" placeholder="' + K.esc(placeholder) + '"></label>';
  }

  function ciljDatumPolje(ime, oznaka, obvezno) {
    return '<label class="zgodovina-dogodek__polje is-date"><span class="zgodovina-ai-vprasanje__oznaka">' + K.esc(oznaka) + (obvezno ? '' : ' <small>neobvezno</small>') + '</span><input type="date" data-cilj-polje="' + K.esc(ime) + '" data-izvedba-fit data-fit-min="10" value="' + K.esc(ciljVrednost(ime, "")) + '"></label>';
  }

  function ciljRokSHitroIzbiroPolje(ime, oznaka) {
    var vrednost = String(ciljVrednost(ime, ""));
    return '<div class="zgodovina-dogodek__polje cilj-rok-hitri" role="group" aria-labelledby="cilj-rok-hitri-oznaka">' +
      '<label class="cilj-rok-hitri__polje"><span class="zgodovina-ai-vprasanje__oznaka" id="cilj-rok-hitri-oznaka">' + K.esc(oznaka) + '</span><input type="text" maxlength="40" data-cilj-polje="' + K.esc(ime) + '" data-izvedba-fit data-fit-min="9" value="' + K.esc(vrednost) + '" placeholder="dd. mm. llll"></label>' +
      '<button type="button" data-cilj-rok-hitri="Čim prej" aria-pressed="' + String(vrednost === "Čim prej") + '" class="' + (vrednost === "Čim prej" ? 'is-selected' : '') + '">Čim prej</button>' +
      '<button type="button" data-cilj-rok-hitri="Drugo" aria-pressed="' + String(vrednost === "Drugo") + '" class="' + (vrednost === "Drugo" ? 'is-selected' : '') + '">Drugo</button></div>';
  }

  function ciljSelectPolje(ime, oznaka, moznosti) {
    var vrednost = String(ciljVrednost(ime, ""));
    var izbrana = moznosti.find(function (moznost) { return moznost[0] === vrednost; });
    var seznamId = "cilj-izbira-" + ime;
    var opcije = moznosti.map(function (moznost) {
      var aktivna = vrednost === moznost[0];
      return '<button type="button" role="option" data-cilj-choice-option data-cilj-choice-value="' + K.esc(moznost[0]) + '" aria-selected="' + String(aktivna) + '" class="' + (aktivna ? 'is-selected' : '') + '"><span>' + K.esc(moznost[1]) + '</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 3 3 7-7"/></svg></button>';
    }).join("");
    return '<label class="zgodovina-dogodek__polje is-payment-method"><span class="zgodovina-ai-vprasanje__oznaka">' + K.esc(oznaka) + '</span><div class="zgodovina-ai-vprasanje__izbira" data-cilj-choice>' +
      '<input class="zgodovina-ai-vprasanje__izbira-input" type="hidden" data-cilj-polje="' + K.esc(ime) + '" value="' + K.esc(vrednost) + '">' +
      '<button type="button" class="zgodovina-ai-vprasanje__izbira-gumb" data-cilj-choice-toggle aria-haspopup="listbox" aria-expanded="false" aria-controls="' + K.esc(seznamId) + '"><span data-izvedba-fit data-fit-min="8">' + K.esc(izbrana ? izbrana[1] : "Izberite …") + '</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg></button>' +
      '<div class="zgodovina-ai-vprasanje__izbira-seznam" id="' + K.esc(seznamId) + '" role="listbox" hidden>' + opcije + '</div></div></label>';
  }

  function ciljOpisnoPolje(ime, oznaka, placeholder, obvezno) {
    return '<label class="zgodovina-dogodek__polje zgodovina-dogodek__polje--polno"><span class="zgodovina-ai-vprasanje__oznaka">' + K.esc(oznaka) + (obvezno ? '' : ' <small>neobvezno</small>') + '</span><textarea maxlength="500" rows="2" data-cilj-polje="' + K.esc(ime) + '" data-izvedba-fit data-fit-min="10" placeholder="' + K.esc(placeholder) + '">' + K.esc(ciljVrednost(ime, "")) + '</textarea></label>';
  }

  function ciljnaPoljaHtml(ciljId) {
    var dolg = ciljniDolg;
    if (ciljId === "full_payment") {
      return ciljStevilcnoPolje("targetAmount", "Ciljni znesek", dolg, 0.01, dolg) +
        ciljSelectPolje("contactChannel", "Prednostni način poziva", [["email", "E-pošta"], ["sms", "SMS"], ["phone", "Telefon"], ["registered_mail", "Priporočena pošta"], ["any", "Najprimernejši kanal"]]) +
        ciljRokSHitroIzbiroPolje("paymentDeadline", "Želeni rok plačila") +
        ciljOpisnoPolje("note", "Dodatna zahteva", "Npr. plačilo celotnega dolga brez dodatnega odloga", false);
    }
    if (ciljId === "partial_payment_now") {
      return ciljStevilcnoPolje("requestedAmount", "Znesek prvega plačila", "", 0.01, dolg) +
        ciljDatumPolje("paymentDeadline", "Rok prvega plačila", true) +
        ciljSelectPolje("remainingStrategy", "Kaj s preostankom?", [["installments", "Razdelitev na obroke"], ["new_deadline", "Nov skupni rok"], ["later_agreement", "Nov dogovor po prvem plačilu"]]) +
        ciljDatumPolje("remainingDeadline", "Rok za preostanek", ciljVrednost("remainingStrategy", "") === "new_deadline");
    }
    if (ciljId === "installment_plan") {
      return ciljStevilcnoPolje("installmentAmount", "Znesek posameznega obroka", "", 0.01, dolg) +
        ciljStevilcnoPolje("targetAmount", "Skupni ciljni znesek", dolg, 0.01, dolg) +
        ciljCeloStevilcnoPolje("installmentCount", "Število obrokov", "", 2, 36) +
        ciljDatumPolje("firstPaymentDate", "Datum prvega obroka", true) +
        ciljSelectPolje("frequency", "Pogostost obrokov", [["weekly", "Tedensko"], ["monthly", "Mesečno"], ["custom", "Drug dogovor"]]);
    }
    if (ciljId === "new_deadline") {
      return ciljStevilcnoPolje("targetAmount", "Znesek do novega roka", dolg, 0.01, dolg) +
        ciljDatumPolje("newDeadline", "Novi rok plačila", true) +
        ciljSelectPolje("contactChannel", "Način potrditve roka", [["email", "E-pošta"], ["sms", "SMS"], ["phone", "Telefon"], ["written", "Pisna potrditev"]]) +
        ciljOpisnoPolje("reason", "Razlog novega roka", "Zakaj je nov rok sprejemljiv?", false);
    }
    if (ciljId === "amicable_settlement") {
      return ciljStevilcnoPolje("settlementAmount", "Ciljni znesek poravnave", "", 0.01, dolg) +
        ciljDatumPolje("settlementDeadline", "Rok poravnave", true) +
        ciljSelectPolje("settlementApproach", "Način dogovora", [["single_payment", "Enkratno plačilo"], ["installments", "Plačilo v obrokih"], ["mutual_concession", "Vzajemno popuščanje"]]);
    }
    if (ciljId === "dispute_resolution") {
      return ciljSelectPolje("disputeTopic", "Predmet ugovora", [["quality", "Kakovost izvedbe"], ["quantity", "Obseg ali količina"], ["invoice", "Vsebina računa"], ["contract", "Pogodbeni dogovor"], ["other", "Drugo"]]) +
        ciljSelectPolje("desiredOutcome", "Želeni rezultat", [["full_payment", "Potrditev celotnega dolga"], ["partial_agreement", "Delni dogovor"], ["correction", "Popravek računa ali izvedbe"], ["negotiation", "Skupen sestanek"]]) +
        ciljOpisnoPolje("disputeDescription", "Kaj je treba razrešiti?", "Na kratko opišite ugovor in svoje stališče", true);
    }
    if (ciljId === "compensation") {
      return ciljStevilcnoPolje("compensationAmount", "Znesek pobota", "", 0.01, dolg) +
        ciljBesedilnoPolje("counterclaimReference", "Nasprotna terjatev", "Npr. račun ali številka dokumenta", true) +
        ciljDatumPolje("settlementDate", "Predvideni datum pobota", false);
    }
    if (ciljId === "payment_security") {
      return ciljSelectPolje("securityType", "Vrsta zavarovanja", [["guarantee", "Poroštvo"], ["collateral", "Zastava"], ["debt_acknowledgment", "Priznanje dolga"], ["direct_debit", "Direktna obremenitev"], ["other", "Drugo"]]) +
        ciljStevilcnoPolje("securedAmount", "Zavarovani znesek", dolg, 0.01, dolg) +
        ciljDatumPolje("securityDeadline", "Rok za ureditev zavarovanja", true);
    }
    if (ciljId === "insolvency_claim") {
      return ciljSelectPolje("proceedingType", "Vrsta postopka", [["bankruptcy", "Stečaj"], ["compulsory_settlement", "Prisilna poravnava"], ["unknown", "Ne vem"]]) +
        ciljBesedilnoPolje("caseReference", "Opravilna številka", "Npr. St 123/2026", false) +
        ciljDatumPolje("filingDeadline", "Rok za prijavo terjatve", false);
    }
    if (ciljId === "close_without_recovery") {
      return ciljSelectPolje("closureReason", "Razlog zaključka", [["uncollectible", "Terjatev ni izterljiva"], ["uneconomical", "Izterjava ni gospodarna"], ["business_decision", "Poslovna odločitev"], ["other", "Drug razlog"]]) +
        ciljStevilcnoPolje("writeOffAmount", "Znesek za zaključek", dolg, 0.01, dolg) +
        ciljOpisnoPolje("closureNote", "Utemeljitev", "Zapišite razlog za zaključek brez izterjave", true);
    }
    return ciljOpisnoPolje("goalDescription", "Opišite cilj", "Kaj želite doseči s tem dolgom?", true) +
      ciljDatumPolje("desiredDeadline", "Želeni rok", false) +
      ciljBesedilnoPolje("successMeasure", "Kako boste vedeli, da je cilj dosežen?", "Npr. podpisan dogovor", false);
  }

  function ciljniVnosnikHtml() {
    if (!ciljOsnutekId || ciljOsnutekId === "legal_recovery") return "";
    var kartica = CILJ_FATHER_KARTICE.find(function (moznost) { return moznost.id === ciljOsnutekId; });
    if (!kartica) return "";
    return '<div class="izvedba-poravnava-podrobnosti izvedba-poravnava-podrobnosti--' + K.esc(kartica.razred) + ' cilj-father-vnosnik">' +
      '<button type="button" class="izvedba-poravnava-podrobnosti__strni" data-cilj-strni aria-label="Zapri vnosnik">' + K.ikona("chevron") + '</button>' +
      '<div class="izvedba-poravnava-podrobnosti__naslov">' + K.esc(kartica.naslov) + '</div>' +
      '<p class="izvedba-poravnava-podrobnosti__opis">Vnesite podatke, po katerih bomo sestavili ustrezen načrt.</p>' +
      '<div class="cilj-father-vnosnik__polja">' + ciljnaPoljaHtml(kartica.id) + '</div>' +
      (ciljNapaka ? '<p class="cilj-father-vnosnik__napaka" role="alert">' + K.esc(ciljNapaka) + '</p>' : '') +
      '<button type="button" class="izvedba-poravnava-dodaj-korak" data-cilj-potrdi>+ Dodaj korak</button></div>';
  }

  function ciljAtenaVirOpisHtml() {
    var svincnik = '<span class="zgodovina-ai-pogovor__opis-svincnik" aria-hidden="true">' + K.ikona("pencil") + '</span>';
    if (ciljVirUrejanje) {
      return '<label class="zgodovina-ai-pogovor__opis zgodovina-ai-pogovor__opis--urejanje"><span class="sr-only">Popravite opis cilja</span><textarea maxlength="2000" data-cilj-source-edit aria-label="Popravite opis cilja">' + K.esc(ciljVirOsnutek) + '</textarea>' + svincnik + '</label>';
    }
    return '<button type="button" class="zgodovina-ai-pogovor__opis" data-cilj-source-edit-open aria-label="Popravi opis cilja"><span>“' + K.esc(naravniOpis) + '”</span>' + svincnik + '</button>';
  }

  function ciljAtenaNapredekHtml(povzetek) {
    var steviloCiljev = Math.max(1, ciljAiPredlogi.length);
    var aktivniIndeks = Math.max(0, Math.min(ciljAiAktivniIndeks, steviloCiljev - 1));
    var krogi = [];
    var skupaj = steviloCiljev + 1;
    var trenutni = povzetek ? steviloCiljev : aktivniIndeks;
    var indeksi = [];
    if (skupaj <= 8) for (var i = 0; i < skupaj; i += 1) indeksi.push(i);
    else {
      indeksi = [0];
      for (var j = Math.max(1, trenutni - 2); j <= Math.min(skupaj - 2, trenutni + 2); j += 1) if (indeksi.indexOf(j) < 0) indeksi.push(j);
      if (indeksi[indeksi.length - 1] !== skupaj - 1) indeksi.push(skupaj - 1);
    }
    indeksi.forEach(function (indeks, mesto) {
      if (mesto > 0 && indeks - indeksi[mesto - 1] > 1) krogi.push('<span class="is-gap" aria-hidden="true">…</span>');
      if (indeks === steviloCiljev) {
        krogi.push('<button type="button" data-cilj-ai-review class="is-tone-povzetek is-' + (povzetek ? 'current' : 'upcoming') + '" aria-label="Povzetek, ' + (povzetek ? 'trenutni' : 'prihodnji') + '"' + (povzetek ? ' aria-current="step"' : '') + '><span>' + K.ikona("thumbsUp") + '</span></button>');
        return;
      }
      var predlog = ciljAiPredlogi[indeks];
      var kartica = predlog && CILJ_FATHER_KARTICE.find(function (moznost) { return moznost.id === predlog.goalId; });
      var razred = kartica ? kartica.razred : "drugo";
      var stanje = !povzetek && indeks === aktivniIndeks ? "current" : indeks < aktivniIndeks || povzetek ? "completed" : "upcoming";
      krogi.push('<button type="button" data-cilj-ai-step="' + indeks + '" class="is-tone-' + K.esc(razred) + ' is-' + stanje + '" aria-label="Cilj ' + (indeks + 1) + ', ' + (stanje === "current" ? "trenutni" : stanje === "completed" ? "dokončan" : "prihodnji") + '"' + (stanje === "current" ? ' aria-current="step"' : '') + '><span>' + (indeks + 1) + '</span></button>');
    });
    return '<div class="zgodovina-ai-napredek" aria-label="Korak ' + (trenutni + 1) + ' od ' + skupaj + '"><i aria-hidden="true"></i>' + krogi.join("") + '</div>';
  }

  function ciljAtenaStanjeDolgaHtml() {
    return '<div class="zgodovina-ai-stanje-dolga" aria-label="Originalni in preostali znesek">' +
      '<div class="zgodovina-ai-stanje-dolga__stolpec"><span>Originalni znesek</span><strong data-izvedba-fit data-fit-min="9">' + K.esc(K.formatirajEur(Number(korak1.znesek))) + '</strong></div>' +
      '<i aria-hidden="true"></i>' +
      '<div class="zgodovina-ai-stanje-dolga__stolpec zgodovina-ai-stanje-dolga__stolpec--preostanek"><span>Preostali znesek</span><strong data-izvedba-fit data-fit-min="9">' + K.esc(K.formatirajEur(ciljniDolg)) + '</strong></div></div>';
  }

  function ciljAtenaVprasanjeHtml() {
    var kartica = CILJ_FATHER_KARTICE.find(function (moznost) { return moznost.id === ciljOsnutekId; });
    if (!kartica) return '<section class="zgodovina-ai" aria-label="Povejte ali napišite cilj"></section>';
    var napaka = preveriCiljniVnos();
    var seNaslednjiKorak = ciljAiAktivniIndeks < ciljAiPredlogi.length - 1;
    var naslednjiGumb = ciljVirUrejanje
      ? '<button type="button" data-cilj-source-update' + (!ciljVirOsnutek.trim() || ciljVirOsnutek.trim() === naravniOpis.trim() ? ' disabled' : '') + '>Posodobi</button>'
      : '<button type="button" data-cilj-ai-next' + (napaka ? ' disabled' : '') + '>' + (seNaslednjiKorak ? 'Naprej' : 'Pokaži povzetek') + '</button>';
    var kompaktnaPolja = ["full_payment", "new_deadline", "amicable_settlement"].includes(kartica.id);
    var enakiObroki = kartica.id === "installment_plan" ? ciljAiPredlogi.filter(function (predlog) { return predlog && predlog.goalId === "installment_plan"; }) : [];
    var naslovKoraka = enakiObroki.length > 1 ? (ciljAiAktivniIndeks + 1) + "/" + enakiObroki.length + " obrok" : kartica.naslov;
    return '<section class="zgodovina-ai" aria-label="Povejte ali napišite cilj"><div class="zgodovina-ai-pogovor zgodovina-ai-pogovor--' + K.esc(kartica.razred) + '">' +
      ciljAtenaVirOpisHtml() + ciljAtenaNapredekHtml(false) + ciljAtenaStanjeDolgaHtml() +
      '<div class="zgodovina-ai-vprasanje zgodovina-ai-vprasanje--' + K.esc(kartica.razred) + '"><button type="button" class="zgodovina-ai-vprasanje__odstrani" data-cilj-ai-reset aria-label="Odstrani pripravljeni cilj"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<span class="zgodovina-ai-vprasanje__ikona" aria-hidden="true">' + K.ikona(kartica.ikona) + '</span><div><h4>Dopolnite ' + K.esc(naslovKoraka) + '</h4><p>Vsi manjkajoči podatki tega cilja so združeni tukaj.</p></div>' +
      '<button type="button" class="zgodovina-ai-vprasanje__spremeni" data-cilj-ai-manual>Spremeni</button><div class="zgodovina-ai-vprasanje__polja' + (kompaktnaPolja ? ' zgodovina-ai-vprasanje__polja--placilo-kompaktno' : '') + '">' + ciljnaPoljaHtml(kartica.id) + '</div></div>' +
      '<div class="zgodovina-ai-pogovor__akcije"><button type="button" data-cilj-edit-description>Spremeni opis</button>' + naslednjiGumb + '</div></div></section>';
  }

  function ciljAtenaPravnoVprasanjeHtml() {
    var rezultat = PRAVNA_IZTERJAVA_REZULTATI.find(function (moznost) { return moznost.id === pravnaOsnutekId; });
    if (!rezultat) return '<section class="zgodovina-ai" aria-label="Povejte ali napišite cilj"></section>';
    var napaka = preveriPravniVnos();
    var seNaslednjiKorak = ciljAiAktivniIndeks < ciljAiPredlogi.length - 1;
    var naslednjiGumb = ciljVirUrejanje
      ? '<button type="button" data-cilj-source-update' + (!ciljVirOsnutek.trim() || ciljVirOsnutek.trim() === naravniOpis.trim() ? ' disabled' : '') + '>Posodobi</button>'
      : '<button type="button" data-cilj-ai-next' + (napaka ? ' disabled' : '') + '>' + (seNaslednjiKorak ? 'Naprej' : 'Pokaži povzetek') + '</button>';
    return '<section class="zgodovina-ai" aria-label="Povejte ali napišite cilj"><div class="zgodovina-ai-pogovor zgodovina-ai-pogovor--akcija-odvetnik">' +
      ciljAtenaVirOpisHtml() + ciljAtenaNapredekHtml(false) + ciljAtenaStanjeDolgaHtml() +
      '<div class="zgodovina-ai-vprasanje zgodovina-ai-vprasanje--akcija-odvetnik"><button type="button" class="zgodovina-ai-vprasanje__odstrani" data-cilj-ai-reset aria-label="Odstrani pripravljeni cilj"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<span class="zgodovina-ai-vprasanje__ikona" aria-hidden="true">' + K.ikona(rezultat.ikona) + '</span><div><h4>Potrdite ' + K.esc(rezultat.naslov) + '</h4><p>' + K.esc(rezultat.opis) + '</p></div>' +
      '<button type="button" class="zgodovina-ai-vprasanje__spremeni" data-cilj-ai-manual>Spremeni</button><div class="zgodovina-ai-vprasanje__polja">' + pravnaPoljaHtml(rezultat.id) + '</div>' +
      (pravnaNapaka ? '<p class="cilj-pravna-vnosnik__napaka" role="alert">' + K.esc(pravnaNapaka) + '</p>' : '') + '</div>' +
      '<div class="zgodovina-ai-pogovor__akcije"><button type="button" data-cilj-edit-description>Spremeni opis</button>' + naslednjiGumb + '</div></div></section>';
  }

  function ciljAtenaPovzetekHtml() {
    var aktivniPredlog = ciljAiPredlogi[ciljAiAktivniIndeks];
    var kartica = CILJ_FATHER_KARTICE.find(function (moznost) { return moznost.id === (ciljOsnutekId || aktivniPredlog && aktivniPredlog.goalId); });
    if (!kartica) return '<section class="zgodovina-ai" aria-label="Povzetek cilja"></section>';
    var povzetiKoraki = ciljAiPredlogi.length ? ciljAiPredlogi : [{ goalId: ciljOsnutekId, goalData: ciljOsnutekPodatki }];
    var povzetki = povzetiKoraki.map(function (predlog, indeks) {
      var ciljKartica = CILJ_FATHER_KARTICE.find(function (moznost) { return moznost.id === predlog.goalId; }) || kartica;
      var podatki = predlog.goalData && typeof predlog.goalData === "object" ? predlog.goalData : {};
      var podatkiZaPovzetek = ciljKartica.id === "legal_recovery" && podatki.legalRecoveryData ? podatki.legalRecoveryData : podatki;
      var vrednosti = Object.keys(podatkiZaPovzetek).map(function (ime) {
        var vrednost = podatkiZaPovzetek[ime];
        return vrednost == null || vrednost === "" ? "" : String(vrednost);
      }).filter(Boolean).join(" · ");
      var enakiObroki = ciljKartica.id === "installment_plan" ? povzetiKoraki.filter(function (item) { return item.goalId === "installment_plan"; }).length : 0;
      var pravniRezultat = ciljKartica.id === "legal_recovery" ? PRAVNA_IZTERJAVA_REZULTATI.find(function (rezultat) { return rezultat.id === podatki.legalOutcome; }) : null;
      var naslov = enakiObroki > 1 ? (indeks + 1) + "/" + enakiObroki + " obrok" : pravniRezultat ? pravniRezultat.naslov : ciljKartica.naslov;
      var ikona = pravniRezultat ? pravniRezultat.ikona : ciljKartica.ikona;
      var privzetiPovzetek = ciljKartica.id === "legal_recovery" ? "Podrobnosti bo zbral odvetnik." : "Podatki so pripravljeni.";
      return '<article class="zgodovina-ai-povzetek zgodovina-ai-povzetek--' + K.esc(ciljKartica.razred) + '"><span aria-hidden="true">' + K.ikona(ikona) + '</span><div><strong>' + K.esc(naslov) + '</strong><p>' + K.esc(vrednosti || privzetiPovzetek) + '</p></div></article>';
    }).join("");
    var akcije = ciljVirUrejanje
      ? '<button type="button" data-cilj-source-cancel>Nazaj</button><button type="button" data-cilj-source-update' + (!ciljVirOsnutek.trim() || ciljVirOsnutek.trim() === naravniOpis.trim() ? ' disabled' : '') + '>Posodobi</button>'
      : '<button type="button" data-cilj-edit-description>Popravi opis</button><button type="button" data-cilj-potrdi>Da, potrdi cilj</button>';
    return '<section class="zgodovina-ai" aria-label="Povzetek cilja"><div class="zgodovina-ai-pogovor zgodovina-ai-pogovor--povzetek">' +
      ciljAtenaVirOpisHtml() + ciljAtenaNapredekHtml(true) + ciljAtenaStanjeDolgaHtml() +
      '<div class="zgodovina-ai-pogovor__potrditev"><span aria-hidden="true">' + K.ikona("checkCircle") + '</span><div><h4>Če prav razumem …</h4><p>Preverite cilj in ga potrdite.</p></div></div>' +
      '<div class="zgodovina-ai-povzetki">' + povzetki + '</div>' +
      '<div class="zgodovina-ai-pogovor__akcije zgodovina-ai-pogovor__akcije--potrditev-cilja">' + akcije + '</div></div></section>';
  }

  function pravnaVrednost(ime, privzeta) {
    var vrednost = pravnaOsnutekPodatki[ime];
    return vrednost == null || vrednost === "" ? (privzeta == null ? "" : privzeta) : vrednost;
  }

  function pravnoBesedilnoPolje(ime, oznaka, placeholder) {
    return '<label class="zgodovina-dogodek__polje"><span>' + K.esc(oznaka) + ' <small>neobvezno</small></span><input type="text" maxlength="100" data-cilj-pravno-polje="' + K.esc(ime) + '" data-izvedba-fit data-fit-min="10" value="' + K.esc(pravnaVrednost(ime, "")) + '" placeholder="' + K.esc(placeholder) + '"></label>';
  }

  function pravnoSelectPolje(ime, oznaka, moznosti) {
    var vrednost = String(pravnaVrednost(ime, ""));
    var izbrana = moznosti.find(function (moznost) { return moznost[0] === vrednost; });
    var seznamId = "cilj-pravna-izbira-" + (pravnaOsnutekId || "pravna") + "-" + ime;
    var opcije = moznosti.map(function (moznost) {
      var aktivna = vrednost === moznost[0];
      return '<button type="button" role="option" data-cilj-choice-option data-cilj-choice-value="' + K.esc(moznost[0]) + '" aria-selected="' + String(aktivna) + '" class="' + (aktivna ? 'is-selected' : '') + '"><span>' + K.esc(moznost[1]) + '</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 3 3 7-7"/></svg></button>';
    }).join("");
    return '<label class="zgodovina-dogodek__polje is-payment-method"><span class="zgodovina-ai-vprasanje__oznaka">' + K.esc(oznaka) + '</span><div class="zgodovina-ai-vprasanje__izbira cilj-pravna-izbira" data-cilj-choice>' +
      '<input class="zgodovina-ai-vprasanje__izbira-input" type="hidden" data-cilj-pravno-polje="' + K.esc(ime) + '" value="' + K.esc(vrednost) + '">' +
      '<button type="button" class="zgodovina-ai-vprasanje__izbira-gumb" data-cilj-choice-toggle aria-haspopup="listbox" aria-expanded="false" aria-controls="' + K.esc(seznamId) + '"><span data-izvedba-fit data-fit-min="8">' + K.esc(izbrana ? izbrana[1] : "Izberite …") + '</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg></button>' +
      '<div class="zgodovina-ai-vprasanje__izbira-seznam" id="' + K.esc(seznamId) + '" role="listbox" hidden>' + opcije + '</div></div></label>';
  }

  function ocistiPravneCiljnePodatke(rezultatId, podatki) {
    var dovoljena = (PRAVNA_CILJNA_POLJA[rezultatId] || []).map(function (polje) { return polje.ime; });
    return Object.fromEntries(dovoljena.filter(function (ime) {
      return podatki && podatki[ime] != null && String(podatki[ime]).trim() !== "";
    }).map(function (ime) { return [ime, String(podatki[ime]).slice(0, 100)]; }));
  }

  function pravnaPoljaHtml(rezultatId) {
    var polja = PRAVNA_CILJNA_POLJA[rezultatId] || [];
    if (!polja.length) return '<p class="cilj-pravna-usmeritev">Za izbiro tega cilja dodatni podatki niso potrebni. Podrobnosti boste dopolnili v koraku Odvetnik.</p>';
    return polja.map(function (polje) {
      return polje.tip === "select"
        ? pravnoSelectPolje(polje.ime, polje.oznaka + " (neobvezno)", polje.moznosti)
        : pravnoBesedilnoPolje(polje.ime, polje.oznaka, polje.placeholder);
    }).join("");
  }

  function pravniVnosnikHtml() {
    if (!pravnaOsnutekId) return "";
    var rezultat = PRAVNA_IZTERJAVA_REZULTATI.find(function (moznost) { return moznost.id === pravnaOsnutekId; });
    if (!rezultat) return "";
    return '<div class="izvedba-poravnava-podrobnosti izvedba-poravnava-podrobnosti--akcija-odvetnik cilj-pravna-vnosnik">' +
      '<button type="button" class="izvedba-poravnava-podrobnosti__strni" data-cilj-pravna-strni aria-label="Zapri vnosnik">' + K.ikona("chevron") + '</button>' +
      '<div class="izvedba-poravnava-podrobnosti__naslov">' + K.esc(rezultat.naslov) + '</div>' +
      '<p class="izvedba-poravnava-podrobnosti__opis">' + K.esc(rezultat.opis) + '</p>' +
      '<div class="cilj-pravna-vnosnik__polja">' + pravnaPoljaHtml(rezultat.id) + '</div>' +
      (pravnaNapaka ? '<p class="cilj-pravna-vnosnik__napaka" role="alert">' + K.esc(pravnaNapaka) + '</p>' : '') +
      '<button type="button" class="izvedba-poravnava-dodaj-korak" data-cilj-pravna-potrdi>+ Dodaj korak</button></div>';
  }

  function pravnaIzterjavaHtml(state) {
    if (pravnaIzbiraIzLune && pravnaOsnutekId) {
      return '<section class="cilj-pravna-podizbira" aria-label="Lunin izbrani pravni cilj">' + pravniVnosnikHtml() + '</section>';
    }
    var gumbi = PRAVNA_IZTERJAVA_REZULTATI.map(function (rezultat) {
      var izbran = rezultat.id === pravnaOsnutekId;
      return '<button type="button" class="izvedba-poravnava-svicer__gumb izvedba-poravnava-svicer__gumb--akcija-odvetnik' + (izbran ? ' is-selected' : '') + '" data-cilj-pravna-resitev="' + K.esc(rezultat.id) + '" aria-pressed="' + String(izbran) + '">' +
        '<span class="izvedba-poravnava-svicer__ikona" aria-hidden="true">' + K.ikona(rezultat.ikona) + '</span>' +
        '<span data-izvedba-fit data-fit-min="7">' + K.esc(rezultat.naslov) + '</span></button>';
    }).join("");
    return '<section class="cilj-pravna-podizbira" aria-labelledby="cilj-pravna-podizbira-naslov">' +
      '<div class="cilj-pravna-podizbira__glava"><button type="button" data-cilj-nazaj aria-label="Nazaj na vse cilje"><span aria-hidden="true">' + K.ikona("chevron") + '</span></button>' +
      '<div><h3 id="cilj-pravna-podizbira-naslov">Kaj želite doseči po pravni poti?</h3><p>Izberite rezultat. Odvetnika, paket in dokumente boste določili šele na koncu načrta.</p></div></div>' +
      '<div class="izvedba-poravnava-svicer cilj-pravna-podizbira__kartice" role="group" aria-label="Rezultati pravne izterjave">' + gumbi + '</div>' +
      '<p class="cilj-pravna-podizbira__opomba">Končna pravna pot se potrdi po pregledu dokazov.</p>' + pravniVnosnikHtml() + '</section>';
  }

  function zamenjajBesediloNaslova(element, besedilo) {
    if (!element) return;
    var vozlisce = Array.prototype.find.call(element.childNodes, function (item) {
      return item.nodeType === 3;
    });
    if (vozlisce) vozlisce.nodeValue = " " + besedilo + " ";
  }

  window.UJZgodovinaPoIzrisu = function (state, vsebnik) {
    if (typeof window.UJOsveziKompaktniPovzetekDolga === "function") {
      window.UJOsveziKompaktniPovzetekDolga(Object.assign({}, korak1, { znesek: ciljniDolg }));
    }
    vsebnik.classList.add("atena");
    vsebnik.setAttribute("data-engine", "atena");
    vsebnik.setAttribute("data-engine-version", "atena-v7");
    var panel = vsebnik.querySelector(".izvedba-action-sheet__panel");
    if (panel) {
      panel.removeAttribute("aria-modal");
      panel.setAttribute("role", "region");
      panel.classList.add("atena__panel", "atena__povrsina", "stran--neplacila-zgodovina");
    }

    var glava = vsebnik.querySelector(".izvedba-action-sheet__header");
    if (glava) {
      glava.classList.add("zgodovina-ai-glava--z-izbrisom");
      var naslov = glava.querySelector("h2");
      var opis = glava.querySelector("p");
      if (naslov) naslov.textContent = "Kaj želite, da se zgodi?";
      if (opis) opis.textContent = "Izberite, kaj želite doseči s tem dolgom.";
      if (!glava.querySelector("[data-cilj-izbrisi]")) {
        glava.insertAdjacentHTML(
          "beforeend",
          '<button type="button" class="zgodovina-ai-pogovor__izbrisi-vse atena__ponastavi" data-cilj-izbrisi' +
            (!naravniOpis.trim() && !ciljOsnutekId && !state.nacrtKoraki.length ? " disabled" : "") +
            ' aria-label="Ponastavi Ateno"><span aria-hidden="true">' +
            K.ikona("refresh") +
            '</span><span>Ponastavi</span></button>'
        );
      }
    }

    var obstojeciNacini = vsebnik.querySelector("[data-cilj-nacina]");
    if (obstojeciNacini) obstojeciNacini.remove();
    var obstojeciTokDolga = vsebnik.querySelector("[data-cilj-dolg-tok]");
    if (obstojeciTokDolga) obstojeciTokDolga.remove();
    vsebnik.querySelectorAll(".izvedba-action-sheet__scroll > .zgodovina-stanje-dolga").forEach(function (stanjeDolga) {
      stanjeDolga.remove();
    });
    var cone = vsebnik.querySelectorAll(".izvedba-poravnava-cona");
    if (cone[0]) {
      var tokDolgaHtml = nacin === "manual"
        ? '<div data-cilj-dolg-tok>' + ciljAtenaStanjeDolgaHtml() + '</div>'
        : "";
      cone[0].insertAdjacentHTML("beforebegin", nacinaHtml() + tokDolgaHtml);
    }
    if (nacin === "natural") {
      if (cone[0]) cone[0].hidden = true;
      if (cone[1]) cone[1].hidden = true;
      var opisPolje = vsebnik.querySelector("[data-cilj-opis]");
      prilagodiVisinoCiljnegaVnosa(opisPolje);
      if (ciljAiStatus === "analyzing") {
        zacniCiljRazsiritev("is-analyzing", function () { return ciljAiStatus === "analyzing"; });
      } else if (ciljSnemanjeAktivno) {
        zacniCiljRazsiritev("is-recording", function () { return ciljSnemanjeAktivno; });
        posodobiCiljGlasnost(ciljRavenGlasu);
      }
    } else {
      if (cone[0]) {
        cone[0].hidden = false;
        cone[0].innerHTML = odprtaPodizbira === "legal_recovery" ? pravnaIzterjavaHtml(state) : ciljFatherKarticeHtml(state);
        if (!odprtaPodizbira) poveziCiljniDrsnik(cone[0]);
      }
      if (cone[1]) cone[1].hidden = true;
    }

    var potek = cone.length ? cone[cone.length - 1] : null;
    if (potek) {
      potek.classList.add("izvedba-poravnava-cona--atena-dogodki");
      potek.hidden = state.nacrtKoraki.length === 0;
      var potekNaslov = potek.querySelector(".izvedba-poravnava-cona__naslov");
      zamenjajBesediloNaslova(potekNaslov, "Pripravljeni cilji");
      var stevec = potek.querySelector(".izvedba-poravnava-cona__stevilo-korakov");
      if (stevec) {
        var stKorakov = state.nacrtKoraki.length;
        var besedaKorakov = stKorakov === 1 ? " korak" : stKorakov === 2 ? " koraka" : stKorakov === 3 || stKorakov === 4 ? " koraki" : " korakov";
        stevec.textContent = stKorakov + besedaKorakov;
      }
      var prazno = potek.querySelector(".izvedba-poravnava-potek__prazno");
      if (prazno) prazno.remove();
      potek.querySelectorAll(".izvedba-poravnava-korak__pill").forEach(function (ciljPill, indeks) {
        ciljPill.textContent = indeks === 0 ? "Glavni cilj" : "Korak " + (indeks + 1);
      });
      potek.querySelectorAll("[data-nacrt-odstrani]").forEach(function (odstraniCilj, indeks) {
        odstraniCilj.setAttribute("aria-label", "Odstrani korak " + (indeks + 1));
      });
    }

    var brezCilja = state.nacrtKoraki.length === 0;
    var nadaljuj = vsebnik.querySelector(SELECTOR_NADALJUJ);
    if (nadaljuj) {
      nadaljuj.textContent = brezCilja ? "Nadaljuj brez cilja" : "Nadaljuj";
      nadaljuj.disabled = false;
      nadaljuj.setAttribute("aria-disabled", "false");
      if (brezCilja && panel) {
        var praznaNoga = nadaljuj.closest(".izvedba-action-sheet__footer");
        vsebnik.classList.add("zgodovina-nadaljuj-je-zunaj");
        panel.classList.add("ima-zunanje-nadaljevanje");
        nadaljuj.classList.add("zgodovina-nadaljuj-zunaj");
        panel.insertAdjacentElement("afterend", nadaljuj);
        if (praznaNoga && !praznaNoga.children.length) praznaNoga.remove();
      }
    }
  };

  var state = debug.state;
  state.globalnaNapaka = null;
  state.error = null;
  state.zadeva = {
    prvotniZnesek: Number(korak1.znesek),
    preostaliDolg: ciljniDolg,
    znesek: ciljniDolg,
  };
  state.ukrepi = [];
  var shranjeniCilj = preberiCiljSejo();
  nacin = "natural";
  naravniOpis = String(shranjeniCilj && shranjeniCilj.naravniOpis || "").slice(0, 2000);
  odprtaPodizbira = shranjeniCilj && shranjeniCilj.odprtaPodizbira === "legal_recovery"
    ? "legal_recovery"
    : null;
  ciljStran = shranjeniCilj && shranjeniCilj.ciljStran === 1 ? 1 : 0;
  ciljOsnutekId = shranjeniCilj && CILJ_FATHER_KARTICE.some(function (kartica) {
    return kartica.id === shranjeniCilj.ciljOsnutekId && kartica.id !== "legal_recovery";
  }) ? shranjeniCilj.ciljOsnutekId : null;
  ciljOsnutekPodatki = shranjeniCilj && shranjeniCilj.ciljOsnutekPodatki && typeof shranjeniCilj.ciljOsnutekPodatki === "object"
    ? shranjeniCilj.ciljOsnutekPodatki
    : {};
  ciljAiPredlogi = shranjeniCilj && Array.isArray(shranjeniCilj.ciljAiPredlogi) ? shranjeniCilj.ciljAiPredlogi.slice(0, CILJ_AI_MAX_KORAKOV) : [];
  ciljAiAktivniIndeks = Math.max(0, Math.min(Number(shranjeniCilj && shranjeniCilj.ciljAiAktivniIndeks) || 0, Math.max(0, ciljAiPredlogi.length - 1)));
  ciljAiPhase = shranjeniCilj && ["input", "clarification", "clarification_exhausted", "questions", "review"].includes(shranjeniCilj.ciljAiPhase)
    ? shranjeniCilj.ciljAiPhase
    : "input";
  ciljClarificationQuestion = String(shranjeniCilj && shranjeniCilj.ciljClarificationQuestion || "").slice(0, 240);
  ciljClarificationAnswer = String(shranjeniCilj && shranjeniCilj.ciljClarificationAnswer || "").slice(0, 400);
  ciljClarificationRound = Math.max(0, Math.min(2, Number(shranjeniCilj && shranjeniCilj.ciljClarificationRound) || 0));
  ciljClarificationExhausted = Boolean(shranjeniCilj && shranjeniCilj.ciljClarificationExhausted === true);
  if (ciljAiPhase === "clarification" && !ciljClarificationQuestion) ciljAiPhase = "input";
  if (ciljAiPhase === "clarification_exhausted" && !ciljClarificationExhausted) ciljAiPhase = "input";
  pravnaOsnutekId = shranjeniCilj && PRAVNA_IZTERJAVA_REZULTATI.some(function (rezultat) {
    return rezultat.id === shranjeniCilj.pravnaOsnutekId;
  }) ? shranjeniCilj.pravnaOsnutekId : null;
  pravnaOsnutekPodatki = shranjeniCilj && shranjeniCilj.pravnaOsnutekPodatki && typeof shranjeniCilj.pravnaOsnutekPodatki === "object"
    ? ocistiPravneCiljnePodatke(pravnaOsnutekId, shranjeniCilj.pravnaOsnutekPodatki)
    : {};
  pravnaIzbiraIzLune = Boolean(shranjeniCilj && shranjeniCilj.pravnaIzbiraIzLune === true && pravnaOsnutekId);
  state.nacrtKoraki = shranjeniCilj && Array.isArray(shranjeniCilj.cilji)
    ? shranjeniCilj.cilji.filter(function (cilj) { return cilj && typeof cilj === "object"; })
    : shranjeniCilj && shranjeniCilj.cilj && typeof shranjeniCilj.cilj === "object"
      ? [shranjeniCilj.cilj]
      : [];
  if (!pravnaOsnutekId && state.nacrtKoraki[0] && state.nacrtKoraki[0].settings && state.nacrtKoraki[0].settings.goalId === "legal_recovery") {
    pravnaOsnutekId = state.nacrtKoraki[0].settings.legalRecoveryOutcome || null;
    pravnaOsnutekPodatki = ocistiPravneCiljnePodatke(pravnaOsnutekId, state.nacrtKoraki[0].settings.legalRecoveryData || {});
  }
  if (!ciljOsnutekId && state.nacrtKoraki[0] && state.nacrtKoraki[0].settings && state.nacrtKoraki[0].settings.goalId !== "legal_recovery") {
    ciljOsnutekId = state.nacrtKoraki[0].settings.goalId || null;
    ciljOsnutekPodatki = state.nacrtKoraki[0].settings.goalData || {};
  }
  state.selectedSettlementType = null;
  state.actionSheetOpen = true;
  state.actionSheetMode = "payment";
  state.actionSheetStep = "izbira";

  function shraniCilj(potrjena) {
    pravnaOsnutekPodatki = ocistiPravneCiljnePodatke(pravnaOsnutekId, pravnaOsnutekPodatki);
    sessionStorage.setItem(KLJUC_SEJE_CILJ, JSON.stringify({
      potrjena: potrjena === true,
      nacin: nacin,
      naravniOpis: naravniOpis,
      cilj: state.nacrtKoraki.length ? state.nacrtKoraki[0] : null,
      cilji: state.nacrtKoraki,
      odprtaPodizbira: odprtaPodizbira,
      ciljStran: ciljStran,
      ciljOsnutekId: ciljOsnutekId,
      ciljOsnutekPodatki: ciljOsnutekPodatki,
      ciljAiPredlogi: ciljAiPredlogi,
      ciljAiAktivniIndeks: ciljAiAktivniIndeks,
      ciljAiPhase: ciljAiPhase,
      ciljClarificationQuestion: ciljClarificationQuestion,
      ciljClarificationAnswer: ciljClarificationAnswer,
      ciljClarificationRound: ciljClarificationRound,
      ciljClarificationExhausted: ciljClarificationExhausted,
      pravnaOsnutekId: pravnaOsnutekId,
      pravnaOsnutekPodatki: pravnaOsnutekPodatki,
      pravnaIzbiraIzLune: pravnaIzbiraIzLune,
    }));
    if (typeof window.UJInicializirajWizardProgressHeader === "function") {
      window.UJInicializirajWizardProgressHeader(3);
    }
  }

  function dokoncajCiljInNadaljuj() {
    shraniCilj(true);
    window.location.href = "neplacila-posiljanje.html";
  }

  function preveriCiljniVnos() {
    var katalogskaKartica = fatherCatalog.goals.find(function (kartica) { return kartica.id === ciljOsnutekId; });
    var manjka = (katalogskaKartica && katalogskaKartica.required || []).some(function (ime) {
      return String(ciljOsnutekPodatki[ime] == null ? "" : ciljOsnutekPodatki[ime]).trim() === "";
    });
    if (!manjka && ciljOsnutekId === "partial_payment_now" && ciljOsnutekPodatki.remainingStrategy === "new_deadline") {
      manjka = String(ciljOsnutekPodatki.remainingDeadline || "").trim() === "";
    }
    if (manjka) return "Izpolnite vsa obvezna polja.";
    var denarnaPolja = ["targetAmount", "requestedAmount", "installmentAmount", "settlementAmount", "compensationAmount", "securedAmount", "writeOffAmount"];
    var napacenZnesek = denarnaPolja.some(function (ime) {
      if (ciljOsnutekPodatki[ime] == null || ciljOsnutekPodatki[ime] === "") return false;
      var vrednost = Number(ciljOsnutekPodatki[ime]);
      return !Number.isFinite(vrednost) || vrednost <= 0 || vrednost > ciljniDolg;
    });
    if (napacenZnesek) return "Znesek mora biti večji od 0 in ne sme presegati trenutnega dolga.";
    if (ciljOsnutekId === "installment_plan") {
      var stevilo = Number(ciljOsnutekPodatki.installmentCount);
      if (!Number.isInteger(stevilo) || stevilo < 2 || stevilo > 36) return "Število obrokov mora biti celo število med 2 in 36.";
    }
    return "";
  }

  function osredotociPrvoNapacnoCiljnoPolje() {
    var katalogskaKartica = fatherCatalog.goals.find(function (kartica) { return kartica.id === ciljOsnutekId; });
    var zahtevana = (katalogskaKartica && katalogskaKartica.required || []).slice();
    if (ciljOsnutekId === "partial_payment_now" && ciljOsnutekPodatki.remainingStrategy === "new_deadline") zahtevana.push("remainingDeadline");
    var prvoIme = zahtevana.find(function (ime) { return String(ciljOsnutekPodatki[ime] == null ? "" : ciljOsnutekPodatki[ime]).trim() === ""; });
    if (!prvoIme) {
      prvoIme = ["targetAmount", "requestedAmount", "installmentAmount", "settlementAmount", "compensationAmount", "securedAmount", "writeOffAmount"].find(function (ime) {
        if (ciljOsnutekPodatki[ime] == null || ciljOsnutekPodatki[ime] === "") return false;
        var vrednost = Number(ciljOsnutekPodatki[ime]);
        return !Number.isFinite(vrednost) || vrednost <= 0 || vrednost > ciljniDolg;
      });
    }
    if (!prvoIme && ciljOsnutekId === "installment_plan") {
      var stevilo = Number(ciljOsnutekPodatki.installmentCount);
      if (!Number.isInteger(stevilo) || stevilo < 2 || stevilo > 36) prvoIme = "installmentCount";
    }
    if (!prvoIme) return;
    window.requestAnimationFrame(function () {
      var polje = root.querySelector('[data-cilj-polje="' + prvoIme + '"]');
      if (!polje) return;
      polje.setAttribute("aria-invalid", "true");
      var fokus = polje.type === "hidden" ? polje.closest("[data-cilj-choice]").querySelector("[data-cilj-choice-toggle]") : polje;
      if (fokus) fokus.focus({ preventScroll:false });
    });
  }

  function preveriPravniVnos() {
    pravnaOsnutekPodatki = ocistiPravneCiljnePodatke(pravnaOsnutekId, pravnaOsnutekPodatki);
    return "";
  }

  function novCiljRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return "goal:" + window.crypto.randomUUID();
    return "goal:" + Date.now() + ":" + Math.random().toString(36).slice(2, 18);
  }

  function jeLokalniAtenaPredogled() {
    var jeLoopback = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    return jeLoopback && (
      globalThis.UJ_LOKALNI_APP_PREDOGLED === true ||
      new URLSearchParams(window.location.search).get("app-preview") === "1" ||
      sessionStorage.getItem("app-iphone-preview") === "1"
    );
  }

  function ciljApiGlave(accessToken) {
    var glave = { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" };
    if (jeLokalniAtenaPredogled()) glave["X-UJ-Local-Preview"] = "1";
    return glave;
  }

  function pravniPodatkiIzGoalData(goalData) {
    var rezultatId = String(goalData && goalData.legalOutcome || pravnaOsnutekId || "");
    var podatki = goalData && typeof goalData.legalRecoveryData === "object" ? Object.assign({}, goalData.legalRecoveryData) : {};
    if (rezultatId === "legal_route_review" && goalData && goalData.legalPriority && podatki.priority == null) podatki.priority = goalData.legalPriority;
    return ocistiPravneCiljnePodatke(rezultatId, podatki);
  }

  function goalDataIzPravnihPodatkov(osnova) {
    var goalData = Object.assign({}, osnova || {});
    delete goalData.legalAmount;
    delete goalData.legalDeadline;
    delete goalData.legalPriority;
    delete goalData.legalNote;
    goalData.legalOutcome = pravnaOsnutekId;
    goalData.legalRecoveryData = ocistiPravneCiljnePodatke(pravnaOsnutekId, pravnaOsnutekPodatki);
    return goalData;
  }

  async function ciljAccessToken(prisilnoOsvezi) {
    if (jeLokalniAtenaPredogled()) return "local-preview";
    if (typeof supabaseKlient === "undefined" || !supabaseKlient || !supabaseKlient.auth) throw new Error("Prijava ni na voljo. Osvežite stran in poskusite znova.");
    var rezultat = prisilnoOsvezi ? await supabaseKlient.auth.refreshSession() : await supabaseKlient.auth.getSession();
    if (rezultat && rezultat.error) throw rezultat.error;
    var seja = rezultat && rezultat.data && rezultat.data.session;
    if (!seja || !seja.access_token) {
      rezultat = await supabaseKlient.auth.refreshSession();
      if (rezultat && rezultat.error) throw rezultat.error;
      seja = rezultat && rezultat.data && rezultat.data.session;
    }
    if (!seja || !seja.access_token) throw new Error("Prijava je potekla. Prijavite se znova.");
    return seja.access_token;
  }

  function shraniAktivniLuninCilj() {
    if (nacin !== "natural" || !ciljAiPredlogi[ciljAiAktivniIndeks]) return;
    if (ciljAiPredlogi[ciljAiAktivniIndeks].goalId === "legal_recovery") {
      ciljAiPredlogi[ciljAiAktivniIndeks].goalData = goalDataIzPravnihPodatkov(ciljAiPredlogi[ciljAiAktivniIndeks].goalData);
      return;
    }
    if (ciljOsnutekId) ciljAiPredlogi[ciljAiAktivniIndeks].goalData = Object.assign({}, ciljOsnutekPodatki);
  }

  function prviNeveljavniLuninKorak() {
    if (!ciljAiPredlogi.length) return null;
    shraniAktivniLuninCilj();
    var prejsnjiId = ciljOsnutekId;
    var prejsnjiPodatki = ciljOsnutekPodatki;
    var prejsnjiPravniId = pravnaOsnutekId;
    var prejsnjiPravniPodatki = pravnaOsnutekPodatki;
    for (var indeks = 0; indeks < ciljAiPredlogi.length; indeks += 1) {
      var predlog = ciljAiPredlogi[indeks];
      var napaka = "";
      if (predlog.goalId === "legal_recovery") {
        ciljOsnutekId = null;
        ciljOsnutekPodatki = {};
        pravnaOsnutekId = predlog.goalData && predlog.goalData.legalOutcome || null;
        pravnaOsnutekPodatki = pravniPodatkiIzGoalData(predlog.goalData || {});
        napaka = preveriPravniVnos();
      } else {
        ciljOsnutekId = predlog.goalId;
        ciljOsnutekPodatki = predlog.goalData && typeof predlog.goalData === "object" ? predlog.goalData : {};
        napaka = preveriCiljniVnos();
      }
      if (napaka) {
        ciljOsnutekId = prejsnjiId;
        ciljOsnutekPodatki = prejsnjiPodatki;
        pravnaOsnutekId = prejsnjiPravniId;
        pravnaOsnutekPodatki = prejsnjiPravniPodatki;
        return { indeks: indeks, napaka: napaka };
      }
    }
    ciljOsnutekId = prejsnjiId;
    ciljOsnutekPodatki = prejsnjiPodatki;
    pravnaOsnutekId = prejsnjiPravniId;
    pravnaOsnutekPodatki = prejsnjiPravniPodatki;
    return null;
  }

  function normalizirajCiljnePodatke(podatki) {
    var rezultat = Object.assign({}, podatki || {});
    ["targetAmount", "requestedAmount", "installmentAmount", "installmentCount", "settlementAmount", "compensationAmount", "securedAmount", "writeOffAmount"].forEach(function (ime) {
      if (rezultat[ime] !== "" && rezultat[ime] != null) rezultat[ime] = Number(rezultat[ime]);
    });
    return rezultat;
  }

  function uporabiLuninCilj(priporocilo, ohraniNaravniNacin, indeks) {
    var kartica = priporocilo && CILJ_FATHER_KARTICE.find(function (moznost) { return moznost.id === priporocilo.goalId; });
    if (!kartica) throw new Error("Luna ni vrnila veljavne ciljne kartice.");
    nacin = ohraniNaravniNacin ? "natural" : "manual";
    ciljAiStatus = "ready";
    ciljAiNapaka = "";
    ciljAiAktivniIndeks = Number.isInteger(indeks) ? Math.max(0, Math.min(indeks, Math.max(0, ciljAiPredlogi.length - 1))) : Math.max(0, ciljAiPredlogi.indexOf(priporocilo));
    ciljStran = CILJ_FATHER_KARTICE.findIndex(function (moznost) { return moznost.id === kartica.id; }) >= 6 ? 1 : 0;
    if (kartica.id === "legal_recovery") {
      ciljAiPhase = "questions";
      ciljOsnutekId = null;
      ciljOsnutekPodatki = {};
      odprtaPodizbira = "legal_recovery";
      pravnaOsnutekId = priporocilo.goalData && priporocilo.goalData.legalOutcome || null;
      pravnaIzbiraIzLune = PRAVNA_IZTERJAVA_REZULTATI.some(function (rezultat) { return rezultat.id === pravnaOsnutekId; });
      pravnaOsnutekPodatki = pravniPodatkiIzGoalData(priporocilo.goalData || {});
    } else {
      odprtaPodizbira = null;
      pravnaIzbiraIzLune = false;
      ciljOsnutekId = kartica.id;
      ciljOsnutekPodatki = priporocilo.goalData && typeof priporocilo.goalData === "object" ? Object.assign({}, priporocilo.goalData) : {};
      ciljAiPhase = ohraniNaravniNacin ? "questions" : "input";
    }
    ciljNapaka = "";
    state.error = null;
    shraniCilj(false);
    debug.izrisiActionSheet();
  }

  async function pripraviCiljneMoznosti(pojasnilo) {
    var opis = String(naravniOpis || "").trim();
    if (!opis || ciljAiStatus === "analyzing") return;
    var odgovorNaPojasnilo = String(pojasnilo || "").trim();
    var besediloZaAnalizo = odgovorNaPojasnilo ? opis + "\nPojasnilo uporabnika: " + odgovorNaPojasnilo : opis;
    var analizaZacetek = Date.now();
    ciljAiGeneracija += 1;
    var mojaGeneracija = ciljAiGeneracija;
    if (ciljAnalizaAbort) ciljAnalizaAbort.abort();
    ciljAnalizaAbort = window.UJAtenaRequest.create();
    ciljAiStatus = "analyzing";
    ciljAiNapaka = "";
    if (!ciljAiRequestId) ciljAiRequestId = novCiljRequestId();
    var mojRequestId = ciljAiRequestId;
    debug.izrisiActionSheet();
    zacniCiljRazsiritev("is-analyzing", function () { return ciljAiStatus === "analyzing"; });
    zacniCiljAnalizaStatus();
    try {
      var telo = JSON.stringify({ requestId: ciljAiRequestId, text: besediloZaAnalizo, remainingDebt: ciljniDolg, referenceDate: new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Ljubljana" }), clarificationRound: ciljClarificationRound });
      var odgovor = null;
      var podatki = {};
      for (var poskus = 0; poskus < 2; poskus += 1) {
        var accessToken = await ciljAccessToken(poskus > 0);
        odgovor = await fetch("/api/razcleni-cilj", { method: "POST", headers: ciljApiGlave(accessToken), body: telo, signal: ciljAnalizaAbort.signal })
          .catch(function (error) { throw window.UJAtenaRequest.networkError(error); });
        podatki = await odgovor.json().catch(function () { return {}; });
        if (odgovor.ok || !["AUTH_SESSION_INVALID", "AUTH_SESSION_REFRESH_REQUIRED"].includes(podatki.code) || poskus === 1) break;
      }
      await pocakajNaCiljRazsiritev(analizaZacetek);
      if (mojaGeneracija !== ciljAiGeneracija || mojRequestId !== ciljAiRequestId) return;
      if (!odgovor || !odgovor.ok) {
        throw window.UJAtenaRequest.errorFromPayload(podatki, "Cilja trenutno ni bilo mogoče razumeti.");
      }
      if (podatki.requestId !== ciljAiRequestId || podatki.engineVersion !== "atena-v7" || podatki.contractVersion !== "goal-fact-v17") throw new Error("Atena je bila posodobljena. Osvežite stran in poskusite znova.");
      if (podatki.clarificationExhausted === true) {
        ciljAiStatus = "ready";
        ciljAiNapaka = "";
        ciljAiPhase = "clarification_exhausted";
        ciljClarificationQuestion = "";
        ciljClarificationAnswer = "";
        ciljClarificationExhausted = true;
        ciljAiPredlogi = [];
        ciljOsnutekId = null;
        ciljOsnutekPodatki = {};
        shraniCilj(false);
        debug.izrisiActionSheet();
        return;
      }
      if (podatki.clarification && podatki.clarification.question) {
        ciljAiStatus = "ready";
        ciljAiNapaka = "";
        ciljAiPhase = "clarification";
        ciljClarificationQuestion = String(podatki.clarification.question).slice(0, 240);
        ciljClarificationAnswer = "";
        ciljClarificationRound = Math.max(1, Math.min(2, Number(podatki.clarification.round) || 1));
        ciljClarificationExhausted = false;
        ciljAiPredlogi = [];
        ciljOsnutekId = null;
        ciljOsnutekPodatki = {};
        shraniCilj(false);
        debug.izrisiActionSheet();
        return;
      }
      if (!Array.isArray(podatki.goals) || !podatki.goals.length) throw new Error("Luna ni pripravila nobene ciljne možnosti.");
      ciljClarificationQuestion = "";
      ciljClarificationAnswer = "";
      ciljClarificationRound = 0;
      ciljClarificationExhausted = false;
      ciljAiPredlogi = podatki.goals.slice(0, CILJ_AI_MAX_KORAKOV);
      ciljAiAktivniIndeks = 0;
      uporabiLuninCilj(ciljAiPredlogi[0], true, 0);
    } catch (error) {
      if (mojaGeneracija !== ciljAiGeneracija || mojRequestId !== ciljAiRequestId) return;
      if (error && error.name === "AbortError") {
        if (!ciljAnalizaAbort || !ciljAnalizaAbort.timedOut()) return;
        error = new Error("Atena se ni pravočasno odzvala. Poskusite znova.");
        error.code = "CLIENT_TIMEOUT";
        error.retryable = true;
      }
      await pocakajNaCiljRazsiritev(analizaZacetek);
      if (!window.UJAtenaRequest.isRetryable(error)) ciljAiRequestId = "";
      ciljAiStatus = "error";
      ciljAiNapaka = error && error.message || "Cilja trenutno ni bilo mogoče razumeti.";
      debug.izrisiActionSheet();
    } finally {
      if (mojaGeneracija === ciljAiGeneracija) {
        ustaviCiljAnalizaStatus();
        if (ciljAnalizaAbort) ciljAnalizaAbort.dispose();
        ciljAnalizaAbort = null;
      }
    }
  }

  function ciljZagotoviCanary() {
    if (ciljCanary) return ciljCanary;
    if (!window.UJHandyCanary) throw new Error("Lokalni Handy/Canary vmesnik ni naložen.");
    ciljCanary = window.UJHandyCanary.create({
      onText: function (text) {
        naravniOpis = String(text || "").slice(0, 2000);
        ciljAiRequestId = "";
        ciljAiPredlogi = [];
        ciljAiPhase = "input";
        ciljClarificationQuestion = "";
        ciljClarificationAnswer = "";
        ciljClarificationRound = 0;
        ciljClarificationExhausted = false;
        var polje = root.querySelector("[data-cilj-opis]");
        if (polje) {
          polje.value = naravniOpis;
          prilagodiVisinoCiljnegaVnosa(polje);
        }
        shraniCilj(false);
      },
      onState: function (podatek) {
        var prejAktivno = ciljSnemanjeAktivno;
        ciljSnemanjeAktivno = ["starting", "recording", "transcribing", "stopping"].includes(podatek && podatek.state);
        ciljAiNapaka = "";
        if (!ciljSnemanjeAktivno) ciljRavenGlasu = 0;
        if (prejAktivno !== ciljSnemanjeAktivno) {
          debug.izrisiActionSheet();
          if (ciljSnemanjeAktivno) zacniCiljRazsiritev("is-recording", function () { return ciljSnemanjeAktivno; });
        }
        if (ciljSnemanjeAktivno) posodobiCiljGlasnost(ciljRavenGlasu);
      },
      onLevel: function (podatek) {
        posodobiCiljGlasnost(podatek && podatek.level);
      },
      onError: function (error) {
        ciljSnemanjeAktivno = false;
        ciljRavenGlasu = 0;
        ciljAiNapaka = error && error.message || "Lokalni prepis ni uspel.";
        debug.izrisiActionSheet();
      },
    });
    return ciljCanary;
  }

  root.addEventListener("click", function (dogodek) {
    var ciljRokHitri = dogodek.target.closest("[data-cilj-rok-hitri]");
    if (ciljRokHitri) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var ciljRokPolje = ciljRokHitri.closest(".cilj-rok-hitri").querySelector('[data-cilj-polje="paymentDeadline"]');
      if (!ciljRokPolje) return;
      var ciljRokVrednost = ciljRokHitri.getAttribute("data-cilj-rok-hitri") || "";
      ciljRokPolje.value = ciljRokPolje.value === ciljRokVrednost ? "" : ciljRokVrednost;
      ciljOsnutekPodatki.paymentDeadline = ciljRokPolje.value;
      ciljNapaka = "";
      shraniAktivniLuninCilj();
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    var ciljChoiceToggle = dogodek.target.closest("[data-cilj-choice-toggle]");
    if (ciljChoiceToggle) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var ciljChoice = ciljChoiceToggle.closest("[data-cilj-choice]");
      var ciljChoiceSeznam = ciljChoice && ciljChoice.querySelector(".zgodovina-ai-vprasanje__izbira-seznam");
      var odpri = Boolean(ciljChoiceSeznam && ciljChoiceSeznam.hidden);
      root.querySelectorAll("[data-cilj-choice]").forEach(function (izbira) {
        izbira.classList.remove("is-open");
        var gumb = izbira.querySelector("[data-cilj-choice-toggle]");
        var seznam = izbira.querySelector(".zgodovina-ai-vprasanje__izbira-seznam");
        if (gumb) gumb.setAttribute("aria-expanded", "false");
        if (seznam) seznam.hidden = true;
      });
      if (odpri && ciljChoice && ciljChoiceSeznam) {
        ciljChoice.classList.add("is-open");
        ciljChoiceToggle.setAttribute("aria-expanded", "true");
        ciljChoiceSeznam.hidden = false;
      }
      return;
    }
    var ciljChoiceOption = dogodek.target.closest("[data-cilj-choice-option]");
    if (ciljChoiceOption) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var ciljChoiceOvoj = ciljChoiceOption.closest("[data-cilj-choice]");
      var ciljChoiceInput = ciljChoiceOvoj && ciljChoiceOvoj.querySelector("[data-cilj-polje], [data-cilj-pravno-polje]");
      if (!ciljChoiceInput) return;
      var ciljChoiceVrednost = ciljChoiceOption.getAttribute("data-cilj-choice-value") || "";
      ciljChoiceInput.value = ciljChoiceInput.value === ciljChoiceVrednost ? "" : ciljChoiceVrednost;
      var pravnoPolje = ciljChoiceInput.getAttribute("data-cilj-pravno-polje");
      if (pravnoPolje) {
        pravnaOsnutekPodatki[pravnoPolje] = ciljChoiceInput.value;
        pravnaNapaka = "";
      } else {
        ciljOsnutekPodatki[ciljChoiceInput.getAttribute("data-cilj-polje")] = ciljChoiceInput.value;
        ciljNapaka = "";
      }
      shraniAktivniLuninCilj();
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-cilj-pripravi]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      void pripraviCiljneMoznosti();
      return;
    }
    if (dogodek.target.closest("[data-cilj-clarification-submit]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var pojasnilo = ciljClarificationAnswer.trim();
      if (!pojasnilo || ciljAiStatus === "analyzing") return;
      ciljAiRequestId = novCiljRequestId();
      void pripraviCiljneMoznosti(pojasnilo);
      return;
    }
    if (dogodek.target.closest("[data-cilj-clarification-edit]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      ciljAiPhase = "input";
      ciljAiStatus = "idle";
      ciljAiNapaka = "";
      ciljClarificationQuestion = "";
      ciljClarificationAnswer = "";
      ciljClarificationRound = 0;
      ciljClarificationExhausted = false;
      ciljAiRequestId = "";
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-cilj-snemaj]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      try {
        var canary = ciljZagotoviCanary();
        if (canary.isRecording()) canary.stop().catch(function (error) {
          ciljAiNapaka = error && error.message || "Prepisa ni bilo mogoče zaključiti.";
          debug.izrisiActionSheet();
        });
        else canary.start(naravniOpis).catch(function (error) {
          ciljSnemanjeAktivno = false;
          ciljAiNapaka = error && error.message || "Snemanja ni bilo mogoče začeti.";
          debug.izrisiActionSheet();
        });
      } catch (error) {
        ciljAiNapaka = error && error.message || "Glasovni vnos ni na voljo.";
        debug.izrisiActionSheet();
      }
      return;
    }
    var ciljAiKorak = dogodek.target.closest("[data-cilj-ai-step]");
    if (ciljAiKorak) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var ciljAiIndeks = Number(ciljAiKorak.getAttribute("data-cilj-ai-step"));
      if (Number.isInteger(ciljAiIndeks) && ciljAiPredlogi[ciljAiIndeks]) {
        shraniAktivniLuninCilj();
        uporabiLuninCilj(ciljAiPredlogi[ciljAiIndeks], true, ciljAiIndeks);
      }
      return;
    }
    if (dogodek.target.closest("[data-cilj-ai-review], [data-cilj-ai-next]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      if (ciljAiPredlogi[ciljAiAktivniIndeks] && ciljAiPredlogi[ciljAiAktivniIndeks].goalId === "legal_recovery") {
        pravnaNapaka = preveriPravniVnos();
        ciljNapaka = pravnaNapaka;
      } else {
        ciljNapaka = preveriCiljniVnos();
      }
      if (!ciljNapaka) {
        shraniAktivniLuninCilj();
        if (dogodek.target.closest("[data-cilj-ai-next]") && ciljAiAktivniIndeks < ciljAiPredlogi.length - 1) {
          var naslednjiIndeks = ciljAiAktivniIndeks + 1;
          uporabiLuninCilj(ciljAiPredlogi[naslednjiIndeks], true, naslednjiIndeks);
          return;
        }
        var neveljavniKorak = prviNeveljavniLuninKorak();
        if (neveljavniKorak) {
          ciljNapaka = neveljavniKorak.napaka;
          uporabiLuninCilj(ciljAiPredlogi[neveljavniKorak.indeks], true, neveljavniKorak.indeks);
          return;
        }
        ciljAiPhase = "review";
        shraniCilj(false);
      }
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-cilj-source-edit-open], [data-cilj-edit-description]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      ciljVirUrejanje = true;
      ciljVirOsnutek = naravniOpis;
      debug.izrisiActionSheet();
      requestAnimationFrame(function () {
        var poljeVir = root.querySelector("[data-cilj-source-edit]");
        if (poljeVir) poljeVir.focus({ preventScroll: true });
      });
      return;
    }
    if (dogodek.target.closest("[data-cilj-source-cancel]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      ciljVirUrejanje = false;
      ciljVirOsnutek = "";
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-cilj-source-update]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var noviOpis = ciljVirOsnutek.trim();
      if (!noviOpis || noviOpis === naravniOpis.trim()) return;
      naravniOpis = noviOpis;
      ciljVirUrejanje = false;
      ciljVirOsnutek = "";
      ciljAiRequestId = "";
      ciljAiPhase = "input";
      ciljClarificationQuestion = "";
      ciljClarificationAnswer = "";
      ciljClarificationRound = 0;
      ciljClarificationExhausted = false;
      ciljAiPredlogi = [];
      ciljOsnutekId = null;
      ciljOsnutekPodatki = {};
      pravnaIzbiraIzLune = false;
      shraniCilj(false);
      void pripraviCiljneMoznosti();
      return;
    }
    if (dogodek.target.closest("[data-cilj-ai-reset]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      ciljAiPhase = "input";
      ciljClarificationQuestion = "";
      ciljClarificationAnswer = "";
      ciljClarificationRound = 0;
      ciljClarificationExhausted = false;
      ciljAiPredlogi = [];
      ciljOsnutekId = null;
      ciljOsnutekPodatki = {};
      pravnaOsnutekId = null;
      pravnaOsnutekPodatki = {};
      pravnaIzbiraIzLune = false;
      ciljNapaka = "";
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-cilj-ai-manual]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      prekiniCiljAnalizo();
      nacin = "manual";
      ciljAiRequestId = "";
      ciljAiPhase = "input";
      ciljClarificationQuestion = "";
      ciljClarificationAnswer = "";
      ciljClarificationRound = 0;
      ciljClarificationExhausted = false;
      pravnaIzbiraIzLune = false;
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    var aiPredlog = dogodek.target.closest("[data-cilj-ai-predlog]");
    if (aiPredlog) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var aiIndeks = Number(aiPredlog.getAttribute("data-cilj-ai-predlog"));
      if (Number.isInteger(aiIndeks) && ciljAiPredlogi[aiIndeks]) uporabiLuninCilj(ciljAiPredlogi[aiIndeks]);
      return;
    }
    var ciljStranGumb = dogodek.target.closest("[data-cilj-stran]");
    if (ciljStranGumb) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      ciljStran = Number(ciljStranGumb.getAttribute("data-cilj-stran")) === 1 ? 1 : 0;
      var drsnik = root.querySelector("[data-cilj-drsnik]");
      if (drsnik) {
        drsnik.scrollTo({ left: ciljStran === 1 ? drsnik.scrollWidth : 0, behavior: "smooth" });
        posodobiStranDrsnika(drsnik);
      }
      return;
    }
    var ciljFather = dogodek.target.closest("[data-cilj-father]");
    if (ciljFather) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var ciljId = ciljFather.getAttribute("data-cilj-father");
      var kartica = CILJ_FATHER_KARTICE.find(function (moznost) { return moznost.id === ciljId; });
      if (!kartica) return;
      if (kartica.id === ciljOsnutekId) {
        ciljOsnutekId = null;
        ciljOsnutekPodatki = {};
        ciljNapaka = "";
        state.error = null;
        shraniCilj(false);
        debug.izrisiActionSheet();
        return;
      }
      if (kartica.id === "legal_recovery") {
        ciljStran = 1;
        ciljOsnutekId = null;
        ciljOsnutekPodatki = {};
        ciljNapaka = "";
        odprtaPodizbira = "legal_recovery";
        pravnaIzbiraIzLune = false;
        state.error = null;
        shraniCilj(false);
        debug.izrisiActionSheet();
        return;
      }
      odprtaPodizbira = null;
      pravnaIzbiraIzLune = false;
      pravnaOsnutekId = null;
      pravnaOsnutekPodatki = {};
      pravnaNapaka = "";
      ciljOsnutekId = kartica.id;
      ciljOsnutekPodatki = {};
      if (["full_payment", "installment_plan", "new_deadline"].includes(kartica.id) && !ciljOsnutekPodatki.targetAmount) ciljOsnutekPodatki.targetAmount = String(ciljniDolg);
      if (kartica.id === "payment_security" && !ciljOsnutekPodatki.securedAmount) ciljOsnutekPodatki.securedAmount = String(ciljniDolg);
      if (kartica.id === "close_without_recovery" && !ciljOsnutekPodatki.writeOffAmount) ciljOsnutekPodatki.writeOffAmount = String(ciljniDolg);
      ciljNapaka = "";
      state.selectedSettlementType = null;
      state.error = null;
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-cilj-strni]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      ciljOsnutekId = null;
      ciljNapaka = "";
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-cilj-potrdi]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var potrdiAteninCilj = nacin === "natural" && ciljAiPhase === "review";
      var aktivniGoalId = ciljOsnutekId || nacin === "natural" && ciljAiPredlogi[ciljAiAktivniIndeks] && ciljAiPredlogi[ciljAiAktivniIndeks].goalId;
      var izbranaKartica = CILJ_FATHER_KARTICE.find(function (moznost) { return moznost.id === aktivniGoalId; });
      ciljNapaka = aktivniGoalId === "legal_recovery" ? preveriPravniVnos() : preveriCiljniVnos();
      if (!izbranaKartica || ciljNapaka) {
        debug.izrisiActionSheet();
        osredotociPrvoNapacnoCiljnoPolje();
        return;
      }
      shraniAktivniLuninCilj();
      var korakiZaPotrditev = nacin === "natural" && ciljAiPredlogi.length ? ciljAiPredlogi.slice() : [{ goalId: izbranaKartica.id, goalData: ciljOsnutekPodatki }];
      korakiZaPotrditev.forEach(function (predlog, indeks) {
        var karticaKoraka = CILJ_FATHER_KARTICE.find(function (moznost) { return moznost.id === predlog.goalId; });
        if (!karticaKoraka) return;
        var enakiObroki = karticaKoraka.id === "installment_plan" ? korakiZaPotrditev.filter(function (item) { return item.goalId === "installment_plan"; }).length : 0;
        var pravniRezultat = karticaKoraka.id === "legal_recovery" ? PRAVNA_IZTERJAVA_REZULTATI.find(function (rezultat) { return rezultat.id === predlog.goalData.legalOutcome; }) : null;
        var settingsKoraka = pravniRezultat ? {
          goalId: "legal_recovery",
          legalRecoveryOutcome: pravniRezultat.id,
          legalRecoveryData: pravniPodatkiIzGoalData(predlog.goalData),
        } : { goalId: karticaKoraka.id, goalData: normalizirajCiljnePodatke(predlog.goalData) };
        state.nacrtKoraki.push({
          id: "goal-" + Date.now() + "-" + state.nacrtKoraki.length,
          jeNacrtovan: true,
          tip: "goal",
          actionType: "goal_selection",
          settings: settingsKoraka,
          naslov: pravniRezultat ? "Pravna izterjava: " + pravniRezultat.naslov : enakiObroki > 1 ? (indeks + 1) + "/" + enakiObroki + " obrok" : karticaKoraka.naslov,
          znesek: null,
          ikona: pravniRezultat ? pravniRezultat.ikona : karticaKoraka.ikona,
          razred: karticaKoraka.razred,
          datum: null,
        });
      });
      ciljNapaka = "";
      state.selectedSettlementType = null;
      state.error = null;
      if (nacin === "manual") {
        ciljOsnutekId = null;
        ciljOsnutekPodatki = {};
      }
      if (nacin === "natural") {
        ciljAiPhase = "input";
        ciljAiPredlogi = [];
        ciljAiAktivniIndeks = 0;
        ciljAiRequestId = "";
        ciljAiStatus = "idle";
        ciljOsnutekId = null;
        ciljOsnutekPodatki = {};
        pravnaOsnutekId = null;
        pravnaOsnutekPodatki = {};
        pravnaIzbiraIzLune = false;
        naravniOpis = "";
      }
      if (potrdiAteninCilj) {
        dokoncajCiljInNadaljuj();
        return;
      }
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    var pravnaResitev = dogodek.target.closest("[data-cilj-pravna-resitev]");
    if (pravnaResitev) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var rezultatId = pravnaResitev.getAttribute("data-cilj-pravna-resitev");
      var rezultat = PRAVNA_IZTERJAVA_REZULTATI.find(function (moznost) { return moznost.id === rezultatId; });
      if (!rezultat) return;
      pravnaIzbiraIzLune = false;
      if (rezultat.id === pravnaOsnutekId) {
        pravnaOsnutekId = null;
        pravnaOsnutekPodatki = {};
        pravnaNapaka = "";
        state.error = null;
        shraniCilj(false);
        debug.izrisiActionSheet();
        return;
      }
      pravnaOsnutekId = rezultat.id;
      pravnaOsnutekPodatki = {};
      pravnaNapaka = "";
      state.selectedSettlementType = null;
      state.error = null;
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-cilj-pravna-strni]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      pravnaOsnutekId = null;
      pravnaIzbiraIzLune = false;
      pravnaNapaka = "";
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-cilj-pravna-potrdi]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var izbraniRezultat = PRAVNA_IZTERJAVA_REZULTATI.find(function (moznost) { return moznost.id === pravnaOsnutekId; });
      pravnaNapaka = preveriPravniVnos();
      if (!izbraniRezultat || pravnaNapaka) {
        debug.izrisiActionSheet();
        return;
      }
      var shranjeniPravniPodatki = ocistiPravneCiljnePodatke(izbraniRezultat.id, pravnaOsnutekPodatki);
      state.nacrtKoraki.push({
        id: "goal-legal-" + Date.now() + "-" + state.nacrtKoraki.length,
        jeNacrtovan: true,
        tip: "goal",
        actionType: "goal_selection",
        settings: { goalId: "legal_recovery", legalRecoveryOutcome: izbraniRezultat.id, legalRecoveryData: shranjeniPravniPodatki },
        naslov: "Pravna izterjava: " + izbraniRezultat.naslov,
        znesek: null,
        ikona: izbraniRezultat.ikona,
        razred: "akcija-odvetnik",
        datum: null,
      });
      pravnaNapaka = "";
      pravnaOsnutekId = null;
      pravnaOsnutekPodatki = {};
      state.selectedSettlementType = null;
      state.error = null;
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-cilj-nazaj]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      odprtaPodizbira = null;
      pravnaIzbiraIzLune = false;
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    var preklop = dogodek.target.closest("[data-cilj-nacin]");
    if (preklop) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      nacin = preklop.getAttribute("data-cilj-nacin") === "manual" ? "manual" : "natural";
      ciljAiRequestId = "";
      if (nacin === "manual" && ciljCanary && ciljCanary.isRecording()) ciljCanary.stop().catch(function () {});
      odprtaPodizbira = null;
      pravnaIzbiraIzLune = false;
      ciljNapaka = "";
      ciljAiNapaka = "";
      ciljVirUrejanje = false;
      ciljVirOsnutek = "";
      state.selectedSettlementType = null;
      state.error = null;
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-cilj-izbrisi]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      prekiniCiljAnalizo();
      state.nacrtKoraki = [];
      odprtaPodizbira = null;
      pravnaOsnutekId = null;
      pravnaOsnutekPodatki = {};
      pravnaNapaka = "";
      pravnaIzbiraIzLune = false;
      ciljOsnutekId = null;
      ciljOsnutekPodatki = {};
      ciljNapaka = "";
      naravniOpis = "";
      ciljAiRequestId = "";
      ciljAiPredlogi = [];
      ciljAiPhase = "input";
      ciljClarificationQuestion = "";
      ciljClarificationAnswer = "";
      ciljClarificationRound = 0;
      ciljClarificationExhausted = false;
      ciljAiStatus = "idle";
      ciljAiNapaka = "";
      ciljVirUrejanje = false;
      ciljVirOsnutek = "";
      state.selectedSettlementType = null;
      state.error = null;
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-nacrt-odstrani]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var odstraniIndeks = Number(dogodek.target.closest("[data-nacrt-odstrani]").getAttribute("data-nacrt-odstrani"));
      if (Number.isInteger(odstraniIndeks) && odstraniIndeks >= 0 && odstraniIndeks < state.nacrtKoraki.length) {
        state.nacrtKoraki.splice(odstraniIndeks, 1);
      }
      state.selectedSettlementType = null;
      state.error = null;
      shraniCilj(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest(SELECTOR_NADALJUJ)) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      dokoncajCiljInNadaljuj();
      return;
    }
  }, true);

  root.addEventListener("keydown", function (dogodek) {
    var preklopIzbire = dogodek.target.closest("[data-cilj-choice-toggle]");
    if (preklopIzbire && dogodek.key === "ArrowDown") {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      if (preklopIzbire.getAttribute("aria-expanded") !== "true") preklopIzbire.click();
      var preklopniSeznam = preklopIzbire.closest("[data-cilj-choice]").querySelector(".zgodovina-ai-vprasanje__izbira-seznam");
      var preklopnaMoznost = preklopniSeznam.querySelector('[aria-selected="true"]') || preklopniSeznam.querySelector("[data-cilj-choice-option]");
      if (preklopnaMoznost) preklopnaMoznost.focus();
      return;
    }
    var moznostIzbire = dogodek.target.closest("[data-cilj-choice-option]");
    if (!moznostIzbire || !["ArrowDown", "ArrowUp", "Home", "End", "Escape"].includes(dogodek.key)) return;
    dogodek.preventDefault();
    dogodek.stopImmediatePropagation();
    var ovojIzbire = moznostIzbire.closest("[data-cilj-choice]");
    var gumbIzbire = ovojIzbire.querySelector("[data-cilj-choice-toggle]");
    var seznamIzbire = ovojIzbire.querySelector(".zgodovina-ai-vprasanje__izbira-seznam");
    if (dogodek.key === "Escape") {
      ovojIzbire.classList.remove("is-open");
      gumbIzbire.setAttribute("aria-expanded", "false");
      seznamIzbire.hidden = true;
      gumbIzbire.focus();
      return;
    }
    var moznostiIzbire = Array.from(seznamIzbire.querySelectorAll("[data-cilj-choice-option]"));
    var trenutniIndeks = moznostiIzbire.indexOf(moznostIzbire);
    var noviIndeks = dogodek.key === "Home" ? 0 : dogodek.key === "End" ? moznostiIzbire.length - 1 : dogodek.key === "ArrowDown" ? (trenutniIndeks + 1) % moznostiIzbire.length : (trenutniIndeks - 1 + moznostiIzbire.length) % moznostiIzbire.length;
    moznostiIzbire[noviIndeks].focus();
  }, true);

  root.addEventListener("input", function (dogodek) {
    if (dogodek.target.matches("[data-cilj-clarification-answer]")) {
      ciljClarificationAnswer = dogodek.target.value.slice(0, 400);
      ciljAiNapaka = "";
      shraniCilj(false);
      var odgovori = root.querySelector("[data-cilj-clarification-submit]");
      if (odgovori) odgovori.disabled = !ciljClarificationAnswer.trim();
    }
    if (dogodek.target.matches("[data-cilj-opis]")) {
      prilagodiVisinoCiljnegaVnosa(dogodek.target);
      naravniOpis = dogodek.target.value.slice(0, 2000);
      ciljAiRequestId = "";
      ciljAiPredlogi = [];
      ciljClarificationQuestion = "";
      ciljClarificationAnswer = "";
      ciljClarificationRound = 0;
      ciljClarificationExhausted = false;
      ciljAiStatus = "idle";
      ciljAiNapaka = "";
      shraniCilj(false);
      var pripravi = root.querySelector("[data-cilj-pripravi]");
      if (pripravi) pripravi.disabled = !naravniOpis.trim();
    }
    if (dogodek.target.matches("[data-cilj-source-edit]")) {
      ciljVirOsnutek = dogodek.target.value.slice(0, 2000);
      var posodobiOpis = root.querySelector("[data-cilj-source-update]");
      if (posodobiOpis) posodobiOpis.disabled = !ciljVirOsnutek.trim() || ciljVirOsnutek.trim() === naravniOpis.trim();
    }
    if (dogodek.target.matches("[data-cilj-pravno-polje]")) {
      pravnaOsnutekPodatki[dogodek.target.getAttribute("data-cilj-pravno-polje")] = dogodek.target.value;
      shraniAktivniLuninCilj();
      pravnaNapaka = "";
      shraniCilj(false);
      var naslednjiPravniKorak = root.querySelector("[data-cilj-ai-next]");
      if (naslednjiPravniKorak) naslednjiPravniKorak.disabled = Boolean(preveriPravniVnos());
    }
    if (dogodek.target.matches("[data-cilj-polje]")) {
      ciljOsnutekPodatki[dogodek.target.getAttribute("data-cilj-polje")] = dogodek.target.value;
      shraniAktivniLuninCilj();
      ciljNapaka = "";
      shraniCilj(false);
      var naslednjiKorak = root.querySelector("[data-cilj-ai-next]");
      if (naslednjiKorak) naslednjiKorak.disabled = Boolean(preveriCiljniVnos());
    }
  }, true);

  root.addEventListener("change", function (dogodek) {
    if (dogodek.target.matches("[data-cilj-pravno-polje]")) {
      pravnaOsnutekPodatki[dogodek.target.getAttribute("data-cilj-pravno-polje")] = dogodek.target.value;
      shraniAktivniLuninCilj();
      pravnaNapaka = "";
      shraniCilj(false);
      var naslednjiPravniKorak = root.querySelector("[data-cilj-ai-next]");
      if (naslednjiPravniKorak) naslednjiPravniKorak.disabled = Boolean(preveriPravniVnos());
    }
    if (dogodek.target.matches("[data-cilj-polje]")) {
      ciljOsnutekPodatki[dogodek.target.getAttribute("data-cilj-polje")] = dogodek.target.value;
      shraniAktivniLuninCilj();
      ciljNapaka = "";
      shraniCilj(false);
    }
  }, true);

  if (typeof window.UJInicializirajWizardProgressHeader === "function") {
    window.UJInicializirajWizardProgressHeader(3);
  }
  debug.izrisiActionSheet();
})();
