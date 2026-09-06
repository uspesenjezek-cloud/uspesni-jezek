(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJSvetovalecPreverbaUgotovitveEngine = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // Svetovalna plast nad obstoječim intake tokom (facts[] iz ponudba-moduli-engine).
  // Ta modul NE spreminja, NE piše nazaj in NE podvaja intake toka (Atena, Lego moduli,
  // NAZORJEVA widgeti). Samo BERE že potrjena dejstva in izračuna: ugotovitve, en glavni
  // izid, in vprašanja za ponudnika. Glej docs/PREVERBA-PONUDBE-SVETOVALNA-PLAST.md.

  var VERSION = "svetovalec-preverba-ugotovitve-v1";

  var POMEMBNOST = Object.freeze({ NIZKA:"nizka", SREDNJA:"srednja", VISOKA:"visoka" });
  var POTREBNOST = Object.freeze({
    INFORMACIJA:"samo-informacija",
    OPOZORILO:"opozorilo",
    RAZJASNITE:"razjasnite-pred-odlocitvijo",
    NE_PODPISUJTE:"ne-podpisujte-pred-razjasnitvijo",
    STROKOVNJAK:"potreben-strokovni-pregled"
  });
  var PRAVNA_MEJA = Object.freeze({
    VARNA:"varna-splosna-razlaga",
    PREVERI_VIR:"potrebno-preverjanje-vira",
    PRAVNIK:"potreben-pravni-pregled"
  });
  var IZID = Object.freeze({ A:"A", B:"B", C:"C", D:"D" });

  // Vrstni red potrebnosti ukrepanja, od najnižje do najvišje — uporabljen za
  // določitev glavnega izida po pravilu prednosti (razdelek 5 specifikacije).
  var POTREBNOST_RANG = [
    POTREBNOST.INFORMACIJA,
    POTREBNOST.OPOZORILO,
    POTREBNOST.RAZJASNITE,
    POTREBNOST.STROKOVNJAK,
    POTREBNOST.NE_PODPISUJTE
  ];

  function normaliziraj(value) {
    return String(value == null ? "" : value)
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
  }
  // "vsebuje" ujema cele fraze kot podniz (za večbesedne fraze, npr. "ni naveden"),
  // "vsebujeBesedo" pa ujema samo CELO BESEDO med presledki, da se npr. "ne"
  // ne ujame znotraj "dnevno". Uporabljaj vsebujeBesedo za kratke, enobesedne
  // zanikalne izraze.
  function vsebuje(text, words) {
    var n = normaliziraj(text);
    return words.some(function (w) { return n.indexOf(w) >= 0; });
  }
  function vsebujeBesedo(text, words) {
    var tokeni = normaliziraj(text).split(" ");
    return words.some(function (w) { return tokeni.indexOf(w) >= 0; });
  }
  function najdiOdstotek(text) {
    var m = normaliziraj(text).match(/(\d{1,3})\s*%/);
    return m ? Number(m[1]) : null;
  }
  function jePrazno(value) {
    var n = normaliziraj(value);
    if (!n) return true;
    return (vsebuje(value, ["ni naveden", "ni navedeno", "ni predviden"]) || vsebujeBesedo(value, ["brez", "ne", "ni"])) && n.length < 25;
  }

  // Vsako pravilo presoja EN znan field iz kataloga ponudba-moduli-engine.js.
  // Presoja je namenoma konzervativna, ključno-besedna hevristika — NI polno
  // semantično razumevanje besedila. Zato je zanesljivostRazlage vedno kvečjemu
  // "srednja", nikoli "visoka". Namen je zagotoviti, da se jasno zapisan, a
  // pomemben pogoj NIKOLI tiho spregleda (razdelek 4 specifikacije), ne da bi
  // trdili pravno gotovost o njem.
  function pravilo(fieldId, naslov, presojevalec) {
    return { fieldId: fieldId, naslov: naslov, presodi: presojevalec };
  }

  var PRAVILA = Object.freeze([
    pravilo(5303, "Predplačilo", function (value) {
      if (jePrazno(value)) return null;
      var odstotek = najdiOdstotek(value);
      var celoten = odstotek !== null && odstotek >= 90;
      if (celoten || vsebuje(value, ["v celoti vnaprej", "celoten znesek vnaprej", "100 odstotkov"])) {
        return {
          pomembnost: POMEMBNOST.VISOKA,
          potrebnostUkrepanja: POTREBNOST.NE_PODPISUJTE,
          pravnaMeja: PRAVNA_MEJA.VARNA,
          zanesljivostRazlage: "srednja",
          kajTopomeni: "Celoten ali skoraj celoten znesek plačate, preden karkoli prejmete.",
          vprasanjeZaPonudnika: "Kaj se zgodi s predplačilom, če dela ne dokončate ali ga ne dokonča ponudnik? Ali obstaja možnost delnega vračila?"
        };
      }
      return {
        pomembnost: POMEMBNOST.SREDNJA,
        potrebnostUkrepanja: POTREBNOST.OPOZORILO,
        pravnaMeja: PRAVNA_MEJA.VARNA,
        zanesljivostRazlage: "srednja",
        kajTopomeni: "Del zneska plačate vnaprej, preden je delo opravljeno.",
        vprasanjeZaPonudnika: null
      };
    }),
    pravilo(5403, "Samodejno podaljšanje", function (value) {
      if (jePrazno(value)) return null;
      return {
        pomembnost: POMEMBNOST.SREDNJA,
        potrebnostUkrepanja: POTREBNOST.OPOZORILO,
        pravnaMeja: PRAVNA_MEJA.VARNA,
        zanesljivostRazlage: "srednja",
        kajTopomeni: "Pogodba se lahko sama podaljša, če je pravočasno ne odpoveste.",
        vprasanjeZaPonudnika: null
      };
    }),
    pravilo(5405, "Enostranske spremembe pogojev", function (value) {
      if (jePrazno(value)) return null;
      var neomejeno = vsebuje(value, ["brez omejitev", "po lastni presoji"]) || vsebujeBesedo(value, ["kadarkoli", "enostransko"]);
      return {
        pomembnost: POMEMBNOST.VISOKA,
        potrebnostUkrepanja: neomejeno ? POTREBNOST.NE_PODPISUJTE : POTREBNOST.RAZJASNITE,
        pravnaMeja: PRAVNA_MEJA.PREVERI_VIR,
        zanesljivostRazlage: "srednja",
        kajTopomeni: "Ponudnik lahko med trajanjem sodelovanja spremeni ceno ali pogoje.",
        vprasanjeZaPonudnika: "Pod katerimi pogoji in s kolikšnim vnaprejšnjim obvestilom lahko spremenite ceno ali pogoje?"
      };
    }),
    pravilo(5406, "Omejitev odgovornosti ponudnika", function (value) {
      if (jePrazno(value)) return null;
      return {
        pomembnost: POMEMBNOST.SREDNJA,
        potrebnostUkrepanja: POTREBNOST.RAZJASNITE,
        pravnaMeja: PRAVNA_MEJA.PREVERI_VIR,
        zanesljivostRazlage: "srednja",
        kajTopomeni: "Odgovornost ponudnika za morebitno škodo ali napako je omejena.",
        vprasanjeZaPonudnika: "Na kateri najvišji znesek je omejena vaša odgovornost, če pride do napake pri delu?"
      };
    }),
    pravilo(5408, "Lastništvo datotek in dostopov", function (value) {
      if (jePrazno(value)) return null;
      var jasnoNarocnikov = vsebujeBesedo(value, ["vas", "vam", "narocnik", "narocnika", "meni", "moj", "moja", "moje"]);
      return {
        pomembnost: POMEMBNOST.VISOKA,
        potrebnostUkrepanja: jasnoNarocnikov ? POTREBNOST.INFORMACIJA : POTREBNOST.RAZJASNITE,
        pravnaMeja: PRAVNA_MEJA.PREVERI_VIR,
        zanesljivostRazlage: "srednja",
        kajTopomeni: "To določa, kdo po koncu sodelovanja obdrži dostope, gesla in datoteke.",
        vprasanjeZaPonudnika: jasnoNarocnikov ? null : "Kdo po zaključku sodelovanja obdrži dostope, gesla in izvorne datoteke?"
      };
    }),
    pravilo(5307, "Zadržani znesek", function (value) {
      if (jePrazno(value)) return null;
      return {
        pomembnost: POMEMBNOST.SREDNJA,
        potrebnostUkrepanja: POTREBNOST.OPOZORILO,
        pravnaMeja: PRAVNA_MEJA.VARNA,
        zanesljivostRazlage: "srednja",
        kajTopomeni: "Del zneska ponudnik zadrži do končnega prevzema dela.",
        vprasanjeZaPonudnika: null
      };
    }),
    pravilo(5609, "Stroški izstopa", function (value) {
      if (jePrazno(value)) return null;
      return {
        pomembnost: POMEMBNOST.SREDNJA,
        potrebnostUkrepanja: POTREBNOST.RAZJASNITE,
        pravnaMeja: PRAVNA_MEJA.VARNA,
        zanesljivostRazlage: "srednja",
        kajTopomeni: "Predčasen izstop ali prenehanje sodelovanja je dodatno plačljivo.",
        vprasanjeZaPonudnika: "Kolikšen je natančen strošek izstopa in kdaj natančno zapade?"
      };
    }),
    pravilo(5306, "Zamudne obresti ali kazen", function (value) {
      if (jePrazno(value)) return null;
      var odstotek = najdiOdstotek(value);
      var dnevno = vsebuje(value, ["dnevno", "na dan"]);
      var visoka = dnevno && odstotek !== null && odstotek >= 1;
      return {
        pomembnost: POMEMBNOST.VISOKA,
        potrebnostUkrepanja: visoka ? POTREBNOST.STROKOVNJAK : POTREBNOST.OPOZORILO,
        pravnaMeja: visoka ? PRAVNA_MEJA.PRAVNIK : PRAVNA_MEJA.VARNA,
        zanesljivostRazlage: "srednja",
        kajTopomeni: "To določa, koliko vas stane zamuda pri plačilu.",
        vprasanjeZaPonudnika: visoka ? null : "Kako natančno se obračunajo zamudne obresti in od kdaj tečejo?"
      };
    })
  ]);

  var PRAVILO_BY_FIELD = new Map(PRAVILA.map(function (r) { return [r.fieldId, r]; }));

  /**
   * Izračuna ugotovitve, en glavni izid in vprašanja za ponudnika iz že
   * potrjenih dejstev (facts[]). Ne spreminja vhoda. Vhod facts mora biti
   * oblike [{fieldId, value, evidence, requiresHumanReview}], enako kot ga
   * vrača ponudba-moduli-engine.validateLunaProposal / obstoječi intake tok.
   */
  function izracunajUgotovitve(facts) {
    var list = Array.isArray(facts) ? facts : [];
    var ugotovitve = [];
    var vprasanjaZaPonudnika = [];

    list.forEach(function (fact) {
      if (!fact || typeof fact.fieldId !== "number") return;
      var pravilo = PRAVILO_BY_FIELD.get(fact.fieldId);
      if (!pravilo) return;
      var presoja = pravilo.presodi(fact.value);
      if (!presoja) return;
      var ugotovitev = Object.freeze({
        fieldId: fact.fieldId,
        naslov: pravilo.naslov,
        kajSmoNasli: String(fact.value == null ? "" : fact.value),
        kajTopomeni: presoja.kajTopomeni,
        dokaz: fact.evidence || null,
        pomembnost: presoja.pomembnost,
        potrebnostUkrepanja: presoja.potrebnostUkrepanja,
        pravnaMeja: presoja.pravnaMeja,
        zanesljivostRazlage: presoja.zanesljivostRazlage
      });
      ugotovitve.push(ugotovitev);
      if (presoja.vprasanjeZaPonudnika) {
        vprasanjaZaPonudnika.push(Object.freeze({
          fieldId: fact.fieldId,
          besedilo: presoja.vprasanjeZaPonudnika
        }));
      }
    });

    var glavniIzid = dolociGlavniIzid(ugotovitve);

    return Object.freeze({
      version: VERSION,
      ugotovitve: Object.freeze(ugotovitve),
      glavniIzid: glavniIzid,
      vprasanjaZaPonudnika: Object.freeze(vprasanjaZaPonudnika)
    });
  }

  function najvisjaPotrebnost(ugotovitve) {
    var najvisjiIndeks = -1;
    ugotovitve.forEach(function (u) {
      var indeks = POTREBNOST_RANG.indexOf(u.potrebnostUkrepanja);
      if (indeks > najvisjiIndeks) najvisjiIndeks = indeks;
    });
    return najvisjiIndeks < 0 ? POTREBNOST.INFORMACIJA : POTREBNOST_RANG[najvisjiIndeks];
  }

  // En glavni izid, po pravilu prednosti iz specifikacije (razdelek 5):
  // C prevlada nad B in D (D postane dodatno priporočilo, če je hkrati prisoten).
  // D je glavni izid samo, če ni sočasne "ne-podpisujte" ugotovitve.
  function dolociGlavniIzid(ugotovitve) {
    var imaNePodpisujte = ugotovitve.some(function (u) { return u.potrebnostUkrepanja === POTREBNOST.NE_PODPISUJTE; });
    var imaStrokovnjaka = ugotovitve.some(function (u) { return u.potrebnostUkrepanja === POTREBNOST.STROKOVNJAK; });
    var imaRazjasnite = ugotovitve.some(function (u) { return u.potrebnostUkrepanja === POTREBNOST.RAZJASNITE; });

    var dodatnaPriporocila = [];
    var koda;
    if (imaNePodpisujte) {
      koda = IZID.C;
      if (imaStrokovnjaka) dodatnaPriporocila.push("To konkretno točko naj pred odločitvijo preveri tudi strokovnjak.");
    } else if (imaStrokovnjaka) {
      koda = IZID.D;
    } else if (imaRazjasnite) {
      koda = IZID.B;
    } else {
      koda = IZID.A;
    }

    var besedilo = {
      A: "Nismo našli ničesar, kar bi zahtevalo ukrep pred podpisom.",
      B: "Preden se odločite, razjasnite tole.",
      C: "Pred podpisom razjasnite tole — brez tega je izpostavljenost prevelika.",
      D: "To presega, kar lahko zanesljivo ocenimo — priporočamo kratek pregled pri strokovnjaku."
    }[koda];

    return Object.freeze({
      koda: koda,
      besedilo: besedilo,
      najvisjaPotrebnost: najvisjaPotrebnost(ugotovitve),
      dodatnaPriporocila: Object.freeze(dodatnaPriporocila)
    });
  }

  return Object.freeze({
    version: VERSION,
    POMEMBNOST: POMEMBNOST,
    POTREBNOST: POTREBNOST,
    PRAVNA_MEJA: PRAVNA_MEJA,
    IZID: IZID,
    izracunajUgotovitve: izracunajUgotovitve
  });
});
