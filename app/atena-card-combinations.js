(function (koren, tovarna) {
  var jedro = typeof module === "object" && module.exports ? require("./atena-card-combinations-engine") : koren && koren.UJAtenaCardCombinationsEngine;
  var vmesnik = tovarna(jedro);
  if (typeof module === "object" && module.exports) module.exports = vmesnik;
  if (koren) koren.UJAtenaCardCombinations = vmesnik;
})(typeof window !== "undefined" ? window : null, function (jedro) {
  "use strict";

  function globokoZamrzni(vrednost) {
    if (!vrednost || typeof vrednost !== "object" || Object.isFrozen(vrednost)) return vrednost;
    Object.keys(vrednost).forEach(function (kljuc) { globokoZamrzni(vrednost[kljuc]); });
    return Object.freeze(vrednost);
  }

  var DEFINICIJE = globokoZamrzni([
    {
      id:"pogodbe-stej-ponovi-sestej",
      version:"kombinacija-v1",
      razlog:"Uporabnik vnese število pogodb in ceno vsake pogodbe; aktivne cene se seštejejo v živi agregat.",
      vzorci:["stej-ponovi-in-sestej"],
      stevec:{ key:"stevilo", label:"Število pogodb", min:1, max:20, writes:["stevilo"] },
      ponovitev:{
        key:"pogodbe",
        label:"Pogodba",
        reads:["stevilo"],
        writes:["instance.*.cena"],
        fields:[{ key:"cena", fieldId:5101, required:true }]
      },
      agregati:[{ id:"skupaj", label:"Skupna vrednost", type:"sum-money", reads:["instance.*.cena"], unit:"EUR" }]
    }
  ]);

  if (!jedro || typeof jedro.preveriDefinicijo !== "function") throw new Error("Atena kombinacije: manjka čisti engine definicij.");
  DEFINICIJE.forEach(function (definicija) {
    var rezultat = jedro.preveriDefinicijo(definicija);
    if (!rezultat.ok) throw new Error("Atena kombinacije: neveljavna definicija " + definicija.id + " (" + rezultat.code + ").");
  });

  var PO_IDJU = globokoZamrzni(DEFINICIJE.reduce(function (vse, definicija) {
    if (vse[definicija.id]) throw new Error("Atena kombinacije: podvojen ID " + definicija.id + ".");
    vse[definicija.id] = definicija;
    return vse;
  }, {}));

  function preberi(id) { return PO_IDJU[String(id || "")] || null; }

  return Object.freeze({ version:"atena-card-combinations-v1", vzorci:jedro.podprtiVzorci, definicije:DEFINICIJE, byId:PO_IDJU, preberi:preberi });
});
