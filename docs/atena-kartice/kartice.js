/* Atena · »Kaj želite urediti?« — izris in vedenje kartic opravil.
   Uporaba: UJAtenaOpravila.izrisi(elKoren, { hitri: 4, moji: 5, skupina: "klici", vir: "hitri" });
   Ob izbiri sproži na korenu dogodek "atena:skupina" z detail { skupina, vir }. */
(function (root) {
  "use strict";
  var I = function (d, s) {
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  };
  var IKONE = {
    klici: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/>',
    ponudba: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><circle cx="12" cy="15" r="2.5"/><path d="M14 17l2 2"/>',
    pogodbe: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M9 15h6"/>',
    pogajanje: '<path d="M4 5h11v8H8l-4 3z"/><path d="M15 9h5v8l-3-2h-6v-2"/>',
    iskanje: '<path d="M5 21V5l7-2v18M12 8h7v13"/><path d="M8 8h1M8 12h1M8 16h1M15 12h1M15 16h1"/>',
    mojster: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    hitri: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
    moji: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>'
  };
  var SKUPINE = [
    { id: "ponudba", naslov: "Preverite<br>ponudbo", kontekst: "pred podpisom" },
    { id: "pogodbe", naslov: "Preverite<br>pogodbe", kontekst: "po podpisu" },
    { id: "pogajanje", naslov: "Pogajajte<br>se", kontekst: "cena ali odpoved" },
    { id: "iskanje", naslov: "Poiščite<br>ponudbe", kontekst: "primerjamo za vas" },
    { id: "mojster", naslov: "Poiščite<br>mojstra", kontekst: "z izkušnjami" }
  ];
  var BARVE = { klici: "#c4566f", ponudba: "#d48a12", pogodbe: "#2d7fd0", pogajanje: "#7a4fe0", iskanje: "#14928f", mojster: "#3d8a4f" };

  function izrisi(el, o) {
    o = o || {};
    var stanje = { skupina: o.skupina || "klici", vir: o.vir || "hitri" };
    function html() {
      var kl = stanje.skupina === "klici";
      return '<h2 class="atena-opravila__naslov">Kaj želite urediti?</h2>' +
        '<div class="atena-opravila__glava"><div class="atena-opravila__glavna" role="button" tabindex="0" data-skupina="klici" aria-pressed="' + kl + '">' +
        '<span class="atena-opravila__glavna-ikona">' + I(IKONE.klici, 18) + "</span><span>" +
        '<span class="atena-opravila__glavna-naslov" data-fit-text data-fit-text-min="11">Klici prodajalcev</span>' +
        '<span class="atena-opravila__glavna-opis" data-fit-text data-fit-text-min="8">Ustavite ali preusmerite</span></span>' +
        '<span class="atena-opravila__stikalo" role="tablist" aria-label="Vir korakov">' +
        '<button type="button" role="tab" data-vir="hitri" aria-label="Hitri koraki: ' + (o.hitri || 0) + '" aria-selected="' + (stanje.vir === "hitri") + '"><b>' + I(IKONE.hitri, 12) + (o.hitri || 0) + "</b><small>hitri</small></button>" +
        '<button type="button" role="tab" data-vir="moji" aria-label="Moji koraki: ' + (o.moji || 0) + '" aria-selected="' + (stanje.vir === "moji") + '"><b>' + I(IKONE.moji, 12) + (o.moji || 0) + "</b><small>moji</small></button>" +
        "</span></div></div>" +
        '<div class="atena-opravila__vrsta">' + SKUPINE.map(function (s) {
          var iz = stanje.skupina === s.id;
          return '<button type="button" class="atena-opravila__kartica' + (iz ? " is-izbrana" : "") + '" data-skupina="' + s.id + '" aria-pressed="' + iz + '">' +
            '<span class="atena-opravila__kartica-ikona">' + I(IKONE[s.id], 15) + "</span>" +
            '<span class="atena-opravila__kartica-naslov" data-fit-text data-fit-text-min="9" data-fit-text-lines="2">' + s.naslov + "</span>" +
            '<span class="atena-opravila__kartica-kontekst" data-fit-text data-fit-text-min="8" data-fit-text-lines="2">' + s.kontekst + "</span></button>";
        }).join("") + "</div>";
    }
    function sporoci() {
      el.style.setProperty("--atena-c", BARVE[stanje.skupina]);
      el.dispatchEvent(new CustomEvent("atena:skupina", { bubbles: true, detail: { skupina: stanje.skupina, vir: stanje.vir } }));
    }
    function osvezi() { el.innerHTML = html(); sporoci(); }
    el.classList.add("atena-opravila");
    el.addEventListener("click", function (e) {
      var vir = e.target.closest("[data-vir]");
      if (vir) { stanje.vir = vir.getAttribute("data-vir"); stanje.skupina = "klici"; osvezi(); return; }
      var k = e.target.closest("[data-skupina]");
      if (k) { stanje.skupina = k.getAttribute("data-skupina"); osvezi(); }
    });
    el.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches(".atena-opravila__glavna")) { e.preventDefault(); stanje.skupina = "klici"; osvezi(); }
    });
    osvezi();
    return { stanje: function () { return { skupina: stanje.skupina, vir: stanje.vir }; } };
  }
  root.UJAtenaOpravila = { izrisi: izrisi };
})(typeof window !== "undefined" ? window : this);
