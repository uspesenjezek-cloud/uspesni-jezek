(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJPogajanjeNamenEngine = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // "Možganski sloj" za splošna pogajanja/preverbe cen (NAZORJEVA-PREDLOGI-MOCKUP.html,
  // P3-P60) — LOČEN od zgodovine neplačil (api/_lib/zgodovina-naravni-vnos.js), ki
  // pokriva samo dogodke neplačevanja. Ta modul iz prostega besedila obrtnika prepozna
  // NAMEN (za kaj gre) in vrne NAČRT POGOVORA: urejen seznam KARTIČNIH NAMENOV
  // (semantični ključi, npr. "cilj-in-meja"), ne končnih widget ID-jev — te šele
  // dobimo, ko Spark dokonča/prenovi grafiko (glej pogovor 2026-09-04). Ko so prave
  // kartice znane, jih samo povežemo s temi ključi po `kartica.namen === plan[i].id`.
  //
  // v1 razpoznava namen s preprostimi ključnimi besedami (brez klica na Luno/LLM) —
  // to je namenoma provizorično: enak vzorec kot zgodovina-naravni-vnos.js (analyze())
  // kasneje zamenja to s pravim klicem na model, ko bo klasifikacija pokazala, da
  // ključne besede ne zadostujejo za resnično prosto besedilo. Pogodba (oblika
  // vrnjenega objekta) se s to zamenjavo NE bo spremenila.

  var VERSION = "pogajanje-namen-v1";

  var NAMEN = Object.freeze({
    ZNIZANJE_STROSKA: "znizanje-stroska",   // "preveč mi računajo za X, znižajte/preverite konkurenco"
    NEZNAN: "neznan"                          // ni dovolj zaupanja v noben znan namen
  });

  // Kartični nameni (semantični ključi) — vsak z referenco na mockup (P-številka),
  // NE na končen widget/predlogo. Ko Spark preda prenovljeno grafiko, se ta ista
  // vrstica poveže na pravi widget prek novega polja `kartica.namen`.
  var KARTICNI_NAMENI = Object.freeze({
    CILJ_IN_MEJA: Object.freeze({ id: "cilj-in-meja", naslov: "Kaj želite doseči? Povejte cilj in mejo", vir: "mockup P6" }),
    TRENUTNO_STANJE: Object.freeze({ id: "trenutno-stanje", naslov: "Kaj imate zdaj? Poglejte, če povzetek drži", vir: "mockup P7" }),
    KAJ_JE_VKLJUCENO: Object.freeze({ id: "kaj-je-vkljuceno", naslov: "Kaj je v ceni? Povejte za vsako stvar", vir: "mockup P13" }),
    PRIMERJAVA_PONUDB: Object.freeze({ id: "primerjava-ponudb", naslov: "Primerjajte ponudbe: cena, rok in garancija", vir: "mockup P14" }),
    VPRASANJA_ZA_PONUDNIKA: Object.freeze({ id: "vprasanja-za-ponudnika", naslov: "Kaj še vprašamo ponudnika? Tapnite in dodamo", vir: "mockup P15" }),
    ROK_VARNOSTI: Object.freeze({ id: "rok-varnosti", naslov: "Pazite na rok: koliko dni imate še čas", vir: "mockup P16" }),
    NASTOP_TON: Object.freeze({ id: "nastop-ton", naslov: "Kako naj se pogovorimo? Izberite nastop", vir: "mockup P10" }),
    PRIPRAVLJENI: Object.freeze({ id: "pripravljeni", naslov: "Ste pripravljeni? Izberite, kaj sledi", vir: "mockup P20" })
  });

  // Ključne besede za v1 klasifikacijo. Namenoma preprosto in pregledno — širimo z
  // dodajanjem besed, ne s spreminjanjem logike. Primerjava je brez ločil/velikih črk.
  var KLJUCNE_BESEDE = Object.freeze((function () {
    var karta = {};
    karta[NAMEN.ZNIZANJE_STROSKA] = Object.freeze([
      "narocnina", "narocnini", "narocnino", "prevec mi racunajo", "znizajte", "znizanje",
      "konkurenc", "cenejsa ponudba", "cenejso ponudbo", "nizja cena", "nizjo ceno",
      "predrago", "preverite cene", "preverite konkurenco"
    ]);
    return karta;
  })());

  var NACRTI = Object.freeze((function () {
    var karta = {};
    karta[NAMEN.ZNIZANJE_STROSKA] = Object.freeze([
      KARTICNI_NAMENI.TRENUTNO_STANJE,
      KARTICNI_NAMENI.CILJ_IN_MEJA,
      KARTICNI_NAMENI.KAJ_JE_VKLJUCENO,
      KARTICNI_NAMENI.PRIMERJAVA_PONUDB,
      KARTICNI_NAMENI.VPRASANJA_ZA_PONUDNIKA,
      KARTICNI_NAMENI.NASTOP_TON,
      KARTICNI_NAMENI.ROK_VARNOSTI,
      KARTICNI_NAMENI.PRIPRAVLJENI
    ]);
    return karta;
  })());

  function normaliziraj(besedilo) {
    return String(besedilo || "")
      .toLowerCase()
      .normalize("NFKD").replace(/[̀-ͯ]/g, "") // odstrani šumnike: š→s, č→c, ž→z
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function steviloUjemanj(normalizirano, besede) {
    return besede.reduce(function (stevilo, beseda) {
      return normalizirano.indexOf(normaliziraj(beseda)) >= 0 ? stevilo + 1 : stevilo;
    }, 0);
  }

  // Vrne { namen, zaupanje (0-1), razlog }. `zaupanje` je namenoma grobo (deljeno
  // število-ujemanj/3, omejeno na 1) — dovolj za odločitev "ali sploh predlagaj
  // načrt", ne pretendira biti prava verjetnost. Pri prehodu na LLM klasifikacijo
  // (glej opombo na vrhu datoteke) bo to polje dobilo pravo, modelsko zaupanje.
  function prepoznajNamen(besedilo) {
    var normalizirano = normaliziraj(besedilo);
    if (!normalizirano) return Object.freeze({ namen: NAMEN.NEZNAN, zaupanje: 0, razlog: "prazno besedilo" });

    var najboljsi = null;
    Object.keys(KLJUCNE_BESEDE).forEach(function (namen) {
      var stevilo = steviloUjemanj(normalizirano, KLJUCNE_BESEDE[namen]);
      if (stevilo > 0 && (!najboljsi || stevilo > najboljsi.stevilo)) najboljsi = { namen: namen, stevilo: stevilo };
    });

    if (!najboljsi) return Object.freeze({ namen: NAMEN.NEZNAN, zaupanje: 0, razlog: "brez ujemanja ključnih besed" });
    var zaupanje = Math.min(1, najboljsi.stevilo / 3);
    return Object.freeze({ namen: najboljsi.namen, zaupanje: zaupanje, razlog: najboljsi.stevilo + " ujemanj ključnih besed" });
  }

  // Vrne urejen seznam kartičnih namenov (Object.freeze-anih objektov z {id, naslov, vir})
  // za dani namen, ali prazen seznam za NEZNAN/nepokrit namen — klicatelj naj v tem
  // primeru pade nazaj na obstoječ splošen tok (ne sme sam izumljati kartic).
  function nacrtujPogovor(namen) {
    return NACRTI[namen] || Object.freeze([]);
  }

  // Priročna kombinacija obeh korakov za en klic iz UI/API plasti.
  function nacrtujIzBesedila(besedilo) {
    var prepoznava = prepoznajNamen(besedilo);
    return Object.freeze({
      namen: prepoznava.namen,
      zaupanje: prepoznava.zaupanje,
      razlog: prepoznava.razlog,
      nacrt: nacrtujPogovor(prepoznava.namen)
    });
  }

  return Object.freeze({
    version: VERSION,
    NAMEN: NAMEN,
    KARTICNI_NAMENI: KARTICNI_NAMENI,
    prepoznajNamen: prepoznajNamen,
    nacrtujPogovor: nacrtujPogovor,
    nacrtujIzBesedila: nacrtujIzBesedila
  });
});
