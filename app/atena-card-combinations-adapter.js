(function (koren, tovarna) {
  var jedro = typeof module === "object" && module.exports ? require("./atena-card-combinations-engine") : koren && koren.UJAtenaCardCombinationsEngine;
  var renderer = typeof module === "object" && module.exports ? require("./atena-card-renderer") : koren && koren.UJAtenaCardRenderer;
  var vmesnik = tovarna(jedro, renderer);
  if (typeof module === "object" && module.exports) module.exports = vmesnik;
  if (koren) koren.UJAtenaCardCombinationsAdapter = vmesnik;
})(typeof window !== "undefined" ? window : null, function (jedro, renderer) {
  "use strict";

  function pobegniHtml(vrednost) {
    return String(vrednost == null ? "" : vrednost).replace(/[&<>"']/g, function (znak) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[znak];
    });
  }

  function varenDelIdja(vrednost) {
    return String(vrednost == null ? "" : vrednost).trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function sestaviScopeId(kartica, definicijaId) {
    var flow = varenDelIdja(kartica && kartica.flow);
    var modul = varenDelIdja(kartica && kartica.moduleId);
    var definicija = varenDelIdja(definicijaId || kartica && kartica.kombinacijaId);
    return flow && modul && definicija ? flow + ":" + modul + ":" + definicija : "";
  }

  function razdeliPolja(definicija, polja) {
    var ponovljeniIdji = new Set((definicija && definicija.ponovitev && definicija.ponovitev.fields || []).map(function (polje) { return Number(polje.fieldId); }));
    var vsaPolja = Array.isArray(polja) ? polja : [];
    return Object.freeze({
      ponovljena:Object.freeze(vsaPolja.filter(function (polje) { return ponovljeniIdji.has(Number(polje.id)); })),
      staticna:Object.freeze(vsaPolja.filter(function (polje) { return !ponovljeniIdji.has(Number(polje.id)); }))
    });
  }

  function posodobiStaticneOdgovore(definicija, polja, vrednosti, trenutniOdgovori) {
    var naslednjiOdgovori = Object.assign({}, trenutniOdgovori || {});
    var razdeljeno = razdeliPolja(definicija, polja);
    razdeljeno.ponovljena.forEach(function (polje) { delete naslednjiOdgovori[polje.id]; });
    razdeljeno.staticna.forEach(function (polje) {
      var vrednost = String(vrednosti && vrednosti[polje.id] != null ? vrednosti[polje.id] : "").trim();
      if (vrednost) naslednjiOdgovori[polje.id] = vrednost;
      else delete naslednjiOdgovori[polje.id];
    });
    return Object.freeze(naslednjiOdgovori);
  }

  function pripraviZacetnoStanje(definicija, shranjenoStanje, trenutniOdgovori, scopeId) {
    if (!jedro || typeof jedro.obnovi !== "function" || typeof jedro.spremeni !== "function") return Object.freeze({ ok:false, code:"MANJKA_ENGINE" });
    var obnovljeno = jedro.obnovi(definicija, shranjenoStanje);
    if (!obnovljeno.ok) return Object.freeze({ ok:false, code:obnovljeno.code, path:obnovljeno.path || "" });
    var stanje = obnovljeno.stanje;
    var odgovori = Object.assign({}, trenutniOdgovori || {});
    var preseljeniIdji = [];
    if (shranjenoStanje == null) {
      definicija.ponovitev.fields.forEach(function (polje) {
        var imaVrednost = Object.prototype.hasOwnProperty.call(odgovori, polje.fieldId) && String(odgovori[polje.fieldId] == null ? "" : odgovori[polje.fieldId]).trim();
        if (!imaVrednost) return;
        if (stanje.stevilo < 1) {
          var povecano = jedro.spremeni(definicija, stanje, { vrsta:"nastavi-stevilo", value:1 }, scopeId);
          if (!povecano.ok) return;
          stanje = povecano.stanje;
        }
        var preseljeno = jedro.spremeni(definicija, stanje, { vrsta:"nastavi-vrednost", instance:1, fieldKey:polje.key, value:odgovori[polje.fieldId] }, scopeId);
        if (!preseljeno.ok) return;
        stanje = preseljeno.stanje;
        delete odgovori[polje.fieldId];
        preseljeniIdji.push(polje.fieldId);
      });
    }
    return Object.freeze({
      ok:true,
      stanje:stanje,
      odgovori:Object.freeze(odgovori),
      preseljeniFieldIds:Object.freeze(preseljeniIdji),
      diagnostics:obnovljeno.diagnostics
    });
  }

  function ponovitveHtml(definicija, scopeId, pogled, polja) {
    if (!jedro || !renderer || typeof renderer.fieldHtml !== "function") return Object.freeze({ ok:false, code:"MANJKA_RENDERER", html:"" });
    var poIdju = new Map((Array.isArray(polja) ? polja : []).map(function (polje) { return [Number(polje.id), polje]; }));
    var poljaRendererja = definicija.ponovitev.fields.map(function (pogodbenoPolje) {
      var polje = poIdju.get(Number(pogodbenoPolje.fieldId));
      return polje ? Object.assign({}, polje, { required:pogodbenoPolje.required }) : null;
    });
    if (poljaRendererja.some(function (polje) { return !polje; })) return Object.freeze({ ok:false, code:"MANJKA_POLJE", html:"" });
    var html = pogled.instance.map(function (instanca) {
      var vsebina = instanca.fields.map(function (pogledPolja, indeks) {
        var polje = poljaRendererja[indeks];
        return renderer.fieldHtml(polje, pogledPolja.value, {
          storageKey:pogledPolja.storageKey,
          instanceKey:instanca.key,
          scopeId:scopeId,
          definitionId:definicija.id,
          interfaceId:polje.interfaceId + ":scope:" + varenDelIdja(scopeId) + ":instance:" + instanca.key
        });
      }).join("");
      var oznaka = (definicija.ponovitev.label || "Vnos") + " " + instanca.index;
      return '<section class="uj-card-composed" data-reaktivni-instanca="' + pobegniHtml(instanca.key) + '" aria-label="' + pobegniHtml(oznaka) + '"><h3 class="uj-card-step-header"><span>' + instanca.index + '</span>' + pobegniHtml(oznaka) + '</h3>' + vsebina + '</section>';
    }).join("");
    return Object.freeze({ ok:true, html:html });
  }

  function oblikujDenar(vrednostVMajhnihEnotah, enota) {
    var predznak = vrednostVMajhnihEnotah < 0 ? "−" : "";
    var absolutno = Math.abs(vrednostVMajhnihEnotah);
    var celo = Math.floor(absolutno / 100);
    var decimalke = String(absolutno % 100).padStart(2, "0");
    return predznak + new Intl.NumberFormat("sl-SI", { maximumFractionDigits:0 }).format(celo) + "," + decimalke + " " + enota;
  }

  function povzetkiHtml(definicija, pogled) {
    return pogled.agregati.map(function (agregat) {
      var podatki = definicija.agregati.find(function (kandidat) { return kandidat.id === agregat.id; });
      var zapis = agregat.status === "overflow" ? "Vsota presega varno mejo izračuna." : oblikujDenar(agregat.valueMinor, agregat.unit);
      var opozorilo = agregat.status === "invalid"
        ? " Preverite vnos pri mestu " + agregat.invalidInstances.join(", ") + "."
        : agregat.status === "incomplete" ? " Manjka vnos pri mestu " + agregat.missingInstances.join(", ") + "." : "";
      var ton = agregat.status === "complete" ? "is-good" : "is-warning";
      return '<p class="uj-card-live ' + ton + '" data-reaktivni-agregat-id="' + pobegniHtml(agregat.id) + '" aria-live="polite"><strong>' + pobegniHtml(podatki && podatki.label || agregat.id) + ':</strong> ' + pobegniHtml(zapis + opozorilo) + '</p>';
    }).join("");
  }

  function preberiSpremembo(definicija, scopeId, cilj) {
    if (!jedro || !cilj || typeof cilj.closest !== "function") return Object.freeze({ ok:false, code:"CILJ_NI_VELJAVEN" });
    var stevec = cilj.closest("[data-reaktivni-stevec]");
    var korenPolja = cilj.closest("[data-atena-field-root][data-atena-storage-key][data-atena-instance-key]");
    var lastnik = stevec || korenPolja;
    if (!lastnik || lastnik.dataset.reaktivniScopeId !== scopeId || lastnik.dataset.reaktivniDefinicijaId !== definicija.id) return Object.freeze({ ok:false, code:"SCOPE_SE_NE_UJEMA" });
    if (stevec) return Object.freeze({ ok:true, sprememba:Object.freeze({ vrsta:"nastavi-stevilo", value:Number(stevec.value) }) });
    var kanonicniVnos = korenPolja.querySelector("[data-ponudba-field]");
    var kljucInstance = korenPolja.dataset.atenaInstanceKey;
    var polje = definicija.ponovitev.fields.find(function (kandidat) {
      return jedro.sestaviStorageKey(scopeId, kljucInstance, kandidat.key) === korenPolja.dataset.atenaStorageKey;
    });
    if (!kanonicniVnos || !polje) return Object.freeze({ ok:false, code:"POLJE_NI_VELJAVNO" });
    return Object.freeze({ ok:true, sprememba:Object.freeze({ vrsta:"nastavi-vrednost", instance:Number(kljucInstance), fieldKey:polje.key, value:kanonicniVnos.value }) });
  }

  function izvediSpremembo(definicija, scopeId, stanje, cilj) {
    var prebrano = preberiSpremembo(definicija, scopeId, cilj);
    if (!prebrano.ok) return prebrano;
    return jedro.spremeni(definicija, stanje, prebrano.sprememba, scopeId);
  }

  return Object.freeze({
    version:"atena-card-combinations-adapter-v1",
    sestaviScopeId:sestaviScopeId,
    razdeliPolja:razdeliPolja,
    posodobiStaticneOdgovore:posodobiStaticneOdgovore,
    pripraviZacetnoStanje:pripraviZacetnoStanje,
    ponovitveHtml:ponovitveHtml,
    povzetkiHtml:povzetkiHtml,
    preberiSpremembo:preberiSpremembo,
    izvediSpremembo:izvediSpremembo
  });
});
