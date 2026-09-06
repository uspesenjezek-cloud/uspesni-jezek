"use strict";
/*
  Varna shramba brskalnika.

  Zakaj obstaja: sessionStorage in localStorage nista vedno na voljo. V
  zasebnem oknu, ob nastavitvi "blokiraj vse piškotke" in ponekod v iOS PWA
  dostop vrže SecurityError ali QuotaExceededError. V aplikaciji je bilo
  6. 9. 2026 izmerjenih 77 nezaščitenih dostopov; vsak od njih v takem
  brskalniku prekine uporabnikovo dejanje sredi izvajanja.

  Ta ovoj NIKOLI ne vrže. Branje vrne null, pisanje vrne true/false, da
  klicatelj lahko ukrepa ali opozori uporabnika. Semantike ne spreminja:
  privzeto uporablja isto shrambo kot prej, trajnost se ne razširi sama od
  sebe. Kdor hoče rezervo, jo mora izrecno zahtevati z drugim argumentom.
*/
(function (global) {
  function shramba(ime) {
    try {
      var s = global[ime];
      if (!s) return null;
      return s;
    } catch (_napaka) {
      return null;
    }
  }

  function seznam(zRezervo) {
    var izbrane = [];
    var seja = shramba("sessionStorage");
    if (seja) izbrane.push(seja);
    if (zRezervo === true) {
      var trajna = shramba("localStorage");
      if (trajna) izbrane.push(trajna);
    }
    return izbrane;
  }

  var api = {
    /* Vrne prvo najdeno vrednost ali null. Nikoli ne vrže. */
    preberi: function (kljuc, zRezervo) {
      var s = seznam(zRezervo);
      for (var i = 0; i < s.length; i += 1) {
        try {
          var v = s[i].getItem(kljuc);
          if (v !== null && v !== undefined) return v;
        } catch (_napaka) {}
      }
      return null;
    },
    /* Vrne true samo, ce je vrednost dejansko pristala v vsaj eni shrambi. */
    zapisi: function (kljuc, vrednost, zRezervo) {
      var s = seznam(zRezervo);
      var uspelo = false;
      for (var i = 0; i < s.length; i += 1) {
        try { s[i].setItem(kljuc, String(vrednost)); uspelo = true; } catch (_napaka) {}
      }
      return uspelo;
    },
    /* Odstrani iz vseh shramb, ki so na voljo. Nikoli ne vrze. */
    odstrani: function (kljuc, zRezervo) {
      var s = seznam(zRezervo);
      for (var i = 0; i < s.length; i += 1) {
        try { s[i].removeItem(kljuc); } catch (_napaka) {}
      }
    },
    /* JSON pomocnika: pokvarjen zapis se obravnava kot da ga ni. */
    preberiJson: function (kljuc, zRezervo) {
      var surovo = api.preberi(kljuc, zRezervo);
      if (surovo === null) return null;
      try {
        var razclenjeno = JSON.parse(surovo);
        return razclenjeno && typeof razclenjeno === "object" ? razclenjeno : null;
      } catch (_napaka) {
        return null;
      }
    },
    zapisiJson: function (kljuc, vrednost, zRezervo) {
      try {
        return api.zapisi(kljuc, JSON.stringify(vrednost), zRezervo);
      } catch (_napaka) {
        return false;
      }
    },
    /* Ali je shramba dejansko uporabna. Obstoj objekta ne zadostuje: v
       zasebnem oknu objekt obstaja, njegove metode pa vrzejo. Zato poskusimo
       s pravim zapisom in ga takoj pobrisemo. */
    naVoljo: function (zRezervo) {
      var s = seznam(zRezervo);
      var sonda = "__uj_sonda__";
      for (var i = 0; i < s.length; i += 1) {
        try {
          s[i].setItem(sonda, "1");
          s[i].removeItem(sonda);
          return true;
        } catch (_napaka) {}
      }
      return false;
    }
  };

  global.VarnaShramba = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : this);
