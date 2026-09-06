(function (koren, tovarna) {
  var vmesnik = tovarna();
  if (typeof module === "object" && module.exports) module.exports = vmesnik;
  if (koren) koren.UJAtenaCardCombinationsEngine = vmesnik;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var RAZLICICA = "atena-card-combinations-engine-v1";
  var RAZLICICA_DEFINICIJE = "kombinacija-v1";
  var RAZLICICA_STANJA = "reaktivni-sklop-state-v1";
  var PODPRTI_VZORCI = Object.freeze(["stej-ponovi-in-sestej"]);

  function jeNavadenObjekt(vrednost) {
    return Boolean(vrednost) && Object.prototype.toString.call(vrednost) === "[object Object]";
  }

  function globokoZamrzni(vrednost) {
    if (!vrednost || typeof vrednost !== "object" || Object.isFrozen(vrednost)) return vrednost;
    Object.keys(vrednost).forEach(function (kljuc) { globokoZamrzni(vrednost[kljuc]); });
    return Object.freeze(vrednost);
  }

  function globokoZamrznjeno(vrednost) {
    if (!vrednost || typeof vrednost !== "object" || !Object.isFrozen(vrednost)) return false;
    return Object.keys(vrednost).every(function (kljuc) {
      var podatek = vrednost[kljuc];
      return !podatek || typeof podatek !== "object" || globokoZamrznjeno(podatek);
    });
  }

  function rezultatNapake(koda, pot, dodatno) {
    return globokoZamrzni(Object.assign({ ok:false, code:koda, path:pot || "" }, dodatno || {}));
  }

  function enakiNizi(dejanski, pricakovani) {
    return Array.isArray(dejanski) && dejanski.length === pricakovani.length && pricakovani.every(function (vrednost) { return dejanski.includes(vrednost); });
  }

  function preveriDefinicijo(definicija) {
    if (!jeNavadenObjekt(definicija)) return rezultatNapake("DEFINICIJA_NI_OBJEKT", "");
    if (!globokoZamrznjeno(definicija)) return rezultatNapake("DEFINICIJA_NI_GLOBOKO_ZAMRZNJENA", "");
    if (definicija.version !== RAZLICICA_DEFINICIJE) return rezultatNapake("RAZLICICA_DEFINICIJE_NI_PODPRTA", "version");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(definicija.id || ""))) return rezultatNapake("ID_DEFINICIJE_NI_VELJAVEN", "id");
    if (!String(definicija.razlog || "").trim()) return rezultatNapake("RAZLOG_MANJKA", "razlog");
    if (!enakiNizi(definicija.vzorci, PODPRTI_VZORCI) || new Set(definicija.vzorci).size !== definicija.vzorci.length) return rezultatNapake("VZORCI_NISO_PODPRTI", "vzorci");

    var stevec = definicija.stevec;
    if (!jeNavadenObjekt(stevec) || stevec.key !== "stevilo") return rezultatNapake("STEVEC_NI_VELJAVEN", "stevec.key");
    if (!Number.isInteger(stevec.min) || !Number.isInteger(stevec.max) || stevec.min < 0 || stevec.max < stevec.min) return rezultatNapake("MEJE_STEVCA_NISO_VELJAVNE", "stevec");
    if (!enakiNizi(stevec.writes, ["stevilo"])) return rezultatNapake("STEVEC_WRITES_NI_VELJAVEN", "stevec.writes");

    var ponovitev = definicija.ponovitev;
    if (!jeNavadenObjekt(ponovitev) || !/^[a-z][a-z0-9-]*$/.test(String(ponovitev.key || ""))) return rezultatNapake("PONOVITEV_NI_VELJAVNA", "ponovitev.key");
    if (!enakiNizi(ponovitev.reads, ["stevilo"])) return rezultatNapake("PONOVITEV_READS_NI_VELJAVEN", "ponovitev.reads");
    if (!Array.isArray(ponovitev.fields) || !ponovitev.fields.length) return rezultatNapake("POLJA_PONOVITVE_MANJKAJO", "ponovitev.fields");
    var kljuciPolj = [];
    for (var indeksPolja = 0; indeksPolja < ponovitev.fields.length; indeksPolja += 1) {
      var polje = ponovitev.fields[indeksPolja];
      var potPolja = "ponovitev.fields." + indeksPolja;
      if (!jeNavadenObjekt(polje) || !/^[a-z][a-z0-9-]*$/.test(String(polje.key || ""))) return rezultatNapake("KLJUC_POLJA_NI_VELJAVEN", potPolja + ".key");
      if (kljuciPolj.includes(polje.key)) return rezultatNapake("KLJUC_POLJA_JE_PODVOJEN", potPolja + ".key");
      if (!Number.isInteger(polje.fieldId) || polje.fieldId <= 0) return rezultatNapake("FIELD_ID_NI_VELJAVEN", potPolja + ".fieldId");
      if (polje.required !== true && polje.required !== false) return rezultatNapake("REQUIRED_NI_BOOLEAN", potPolja + ".required");
      if (polje.allowNegative !== undefined && typeof polje.allowNegative !== "boolean") return rezultatNapake("ALLOW_NEGATIVE_NI_BOOLEAN", potPolja + ".allowNegative");
      kljuciPolj.push(polje.key);
    }
    var dovoljenaPisanja = kljuciPolj.map(function (kljuc) { return "instance.*." + kljuc; });
    if (!enakiNizi(ponovitev.writes, dovoljenaPisanja) || new Set(ponovitev.writes).size !== ponovitev.writes.length) return rezultatNapake("PONOVITEV_WRITES_NI_VELJAVEN", "ponovitev.writes");

    if (!Array.isArray(definicija.agregati) || !definicija.agregati.length) return rezultatNapake("AGREGATI_MANJKAJO", "agregati");
    var idjiAgregatov = [];
    for (var indeksAgregata = 0; indeksAgregata < definicija.agregati.length; indeksAgregata += 1) {
      var agregat = definicija.agregati[indeksAgregata];
      var potAgregata = "agregati." + indeksAgregata;
      if (!jeNavadenObjekt(agregat) || !/^[a-z][a-z0-9-]*$/.test(String(agregat.id || ""))) return rezultatNapake("ID_AGREGATA_NI_VELJAVEN", potAgregata + ".id");
      if (idjiAgregatov.includes(agregat.id)) return rezultatNapake("ID_AGREGATA_JE_PODVOJEN", potAgregata + ".id");
      if (agregat.type !== "sum-money") return rezultatNapake("TIP_AGREGATA_NI_PODPRT", potAgregata + ".type");
      if (!Array.isArray(agregat.reads) || agregat.reads.length !== 1 || !dovoljenaPisanja.includes(agregat.reads[0])) return rezultatNapake("AGREGAT_READS_NI_VELJAVEN", potAgregata + ".reads");
      if (Object.prototype.hasOwnProperty.call(agregat, "writes")) return rezultatNapake("AGREGAT_NE_SME_PISATI", potAgregata + ".writes");
      if (!String(agregat.unit || "").trim()) return rezultatNapake("ENOTA_AGREGATA_MANJKA", potAgregata + ".unit");
      idjiAgregatov.push(agregat.id);
    }
    return globokoZamrzni({ ok:true });
  }

  function omejiStevilo(definicija, vrednost) {
    return Math.min(definicija.stevec.max, Math.max(definicija.stevec.min, vrednost));
  }

  function praznaInstanca(definicija) {
    var rezultat = {};
    definicija.ponovitev.fields.forEach(function (polje) { rezultat[polje.key] = ""; });
    return rezultat;
  }

  function stanjeIz(definicija, stevilo, instance) {
    var normaliziraneInstance = {};
    for (var indeks = 1; indeks <= stevilo; indeks += 1) {
      var kljuc = String(indeks);
      var vir = jeNavadenObjekt(instance && instance[kljuc]) ? instance[kljuc] : {};
      var cilj = praznaInstanca(definicija);
      definicija.ponovitev.fields.forEach(function (polje) {
        var vrednost = vir[polje.key];
        cilj[polje.key] = vrednost == null ? "" : String(vrednost);
      });
      normaliziraneInstance[kljuc] = cilj;
    }
    return globokoZamrzni({ version:RAZLICICA_STANJA, stevilo:stevilo, instance:normaliziraneInstance });
  }

  function ustvari(definicija) {
    var validacija = preveriDefinicijo(definicija);
    if (!validacija.ok) return globokoZamrzni({ ok:false, code:validacija.code, path:validacija.path, stanje:null });
    var stanje = stanjeIz(definicija, definicija.stevec.min, {});
    return globokoZamrzni({ ok:true, stanje:stanje, diagnostics:Object.freeze([]) });
  }

  function obnovi(definicija, shranjenoStanje) {
    var validacija = preveriDefinicijo(definicija);
    if (!validacija.ok) return globokoZamrzni({ ok:false, code:validacija.code, path:validacija.path, stanje:null, diagnostics:Object.freeze([]) });
    var diagnostika = [];
    if (!jeNavadenObjekt(shranjenoStanje) || shranjenoStanje.version !== RAZLICICA_STANJA) {
      if (shranjenoStanje != null) diagnostika.push("STATE_VERSION_RESET");
      var ustvarjeno = stanjeIz(definicija, definicija.stevec.min, {});
      return globokoZamrzni({ ok:true, stanje:ustvarjeno, diagnostics:diagnostika });
    }
    var surovoStevilo = shranjenoStanje.stevilo;
    var stevilo = Number.isInteger(surovoStevilo) ? omejiStevilo(definicija, surovoStevilo) : definicija.stevec.min;
    if (stevilo !== surovoStevilo) diagnostika.push("STATE_COUNT_NORMALIZED");
    var normalizirano = stanjeIz(definicija, stevilo, shranjenoStanje.instance);
    if (JSON.stringify(normalizirano) !== JSON.stringify(shranjenoStanje)) diagnostika.push("STATE_SHAPE_NORMALIZED");
    return globokoZamrzni({ ok:true, stanje:normalizirano, diagnostics:diagnostika });
  }

  function sestaviStorageKey(scopeId, indeksInstance, kljucPolja) {
    return String(scopeId) + "." + String(indeksInstance) + "." + String(kljucPolja);
  }

  function pretvoriDenarVMajhneEnote(surovaVrednost, dovoliNegativno) {
    var vir = String(surovaVrednost == null ? "" : surovaVrednost).trim();
    if (!vir) return { status:"missing", valueMinor:null };
    var surovo = vir.replace(/\s/g, "").replace(/(?:€|EUR)$/i, "");
    var negativno = surovo.charAt(0) === "-";
    if (negativno) surovo = surovo.slice(1);
    if (!surovo || (negativno && !dovoliNegativno) || !/^[0-9.,]+$/.test(surovo)) return { status:"invalid", valueMinor:null };
    var celo;
    var decimalke = "";
    if (surovo.indexOf(",") >= 0) {
      if (!/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/.test(surovo) && !/^\d+(?:,\d{1,2})?$/.test(surovo)) return { status:"invalid", valueMinor:null };
      var deliZVejico = surovo.split(",");
      celo = deliZVejico[0].replace(/\./g, "");
      decimalke = deliZVejico[1] || "";
    } else if (/^\d{1,3}(?:\.\d{3})+$/.test(surovo)) {
      celo = surovo.replace(/\./g, "");
    } else if (/^\d+(?:\.\d{1,2})?$/.test(surovo)) {
      var deliSPiko = surovo.split(".");
      celo = deliSPiko[0];
      decimalke = deliSPiko[1] || "";
    } else if (/^\d+$/.test(surovo)) celo = surovo;
    else return { status:"invalid", valueMinor:null };
    var majhneEnote = Number(celo) * 100 + Number((decimalke + "00").slice(0, 2));
    if (!Number.isSafeInteger(majhneEnote)) return { status:"invalid", valueMinor:null };
    return { status:"valid", valueMinor:negativno ? -majhneEnote : majhneEnote };
  }

  function preberiPogled(definicija, stanje, scopeId) {
    var obnovljeno = obnovi(definicija, stanje);
    if (!obnovljeno.ok) return globokoZamrzni({ ok:false, code:obnovljeno.code, path:obnovljeno.path });
    var posnetek = obnovljeno.stanje;
    var runtimeScopeId = String(scopeId || definicija.id);
    var instance = [];
    for (var indeks = 1; indeks <= posnetek.stevilo; indeks += 1) {
      var kljucInstance = String(indeks);
      instance.push({
        index:indeks,
        key:kljucInstance,
        fields:definicija.ponovitev.fields.map(function (polje) {
          return {
            key:polje.key,
            fieldId:polje.fieldId,
            required:polje.required,
            storageKey:sestaviStorageKey(runtimeScopeId, kljucInstance, polje.key),
            value:posnetek.instance[kljucInstance][polje.key]
          };
        })
      });
    }
    var agregati = definicija.agregati.map(function (agregat) {
      var kljucPolja = agregat.reads[0].split(".").pop();
      var definicijaPolja = definicija.ponovitev.fields.find(function (polje) { return polje.key === kljucPolja; });
      var manjkajoceInstance = [];
      var neveljavneInstance = [];
      var vrednostVMajhnihEnotah = 0;
      var presezenaVarnaMeja = false;
      instance.forEach(function (posameznaInstanca) {
        var pretvorjeno = pretvoriDenarVMajhneEnote(posnetek.instance[posameznaInstanca.key][kljucPolja], Boolean(definicijaPolja && definicijaPolja.allowNegative));
        if (pretvorjeno.status === "missing") manjkajoceInstance.push(posameznaInstanca.index);
        else if (pretvorjeno.status === "invalid") neveljavneInstance.push(posameznaInstanca.index);
        else if (!presezenaVarnaMeja) {
          var naslednjaVsota = vrednostVMajhnihEnotah + pretvorjeno.valueMinor;
          if (!Number.isSafeInteger(naslednjaVsota)) presezenaVarnaMeja = true;
          else vrednostVMajhnihEnotah = naslednjaVsota;
        }
      });
      return {
        id:agregat.id,
        status:presezenaVarnaMeja ? "overflow" : neveljavneInstance.length ? "invalid" : manjkajoceInstance.length ? "incomplete" : "complete",
        valueMinor:presezenaVarnaMeja ? null : vrednostVMajhnihEnotah,
        unit:agregat.unit,
        missingInstances:manjkajoceInstance,
        invalidInstances:neveljavneInstance,
        overflow:presezenaVarnaMeja
      };
    });
    return globokoZamrzni({ id:definicija.id, stevilo:posnetek.stevilo, instance:instance, agregati:agregati });
  }

  function zavrnjenaSprememba(definicija, stanje, koda, pot, scopeId) {
    var obnovljeno = obnovi(definicija, stanje);
    var posnetek = obnovljeno.ok ? obnovljeno.stanje : null;
    return globokoZamrzni({ ok:false, code:koda, path:pot || "sprememba", stanje:posnetek, pogled:posnetek ? preberiPogled(definicija, posnetek, scopeId) : null, changedKeys:Object.freeze([]), affected:Object.freeze([]) });
  }

  function spremeni(definicija, stanje, sprememba, scopeId) {
    var obnovljeno = obnovi(definicija, stanje);
    if (!obnovljeno.ok) return globokoZamrzni({ ok:false, code:obnovljeno.code, path:obnovljeno.path, stanje:null, pogled:null, changedKeys:Object.freeze([]), affected:Object.freeze([]) });
    if (!jeNavadenObjekt(sprememba)) return zavrnjenaSprememba(definicija, obnovljeno.stanje, "SPREMEMBA_NI_OBJEKT", "sprememba", scopeId);
    var posnetek = obnovljeno.stanje;
    var naslednjeStevilo = posnetek.stevilo;
    var naslednjeInstance = JSON.parse(JSON.stringify(posnetek.instance));
    var spremenjeniKljuci = [];
    var prizadeto = [];

    if (sprememba.vrsta === "nastavi-stevilo") {
      if (!Number.isInteger(sprememba.value)) return zavrnjenaSprememba(definicija, posnetek, "STEVILO_NI_CELO", "sprememba.value", scopeId);
      naslednjeStevilo = omejiStevilo(definicija, sprememba.value);
      if (naslednjeStevilo !== posnetek.stevilo) {
        spremenjeniKljuci.push("stevilo");
        prizadeto.push("ponovitev:" + definicija.ponovitev.key);
        definicija.agregati.forEach(function (agregat) { prizadeto.push("agregat:" + agregat.id); });
      }
    } else if (sprememba.vrsta === "nastavi-vrednost") {
      var indeksInstance = Number(sprememba.instance);
      var polje = definicija.ponovitev.fields.find(function (kandidat) { return kandidat.key === sprememba.fieldKey; });
      if (!Number.isInteger(indeksInstance) || indeksInstance < 1 || indeksInstance > posnetek.stevilo) return zavrnjenaSprememba(definicija, posnetek, "INSTANCA_NI_AKTIVNA", "sprememba.instance", scopeId);
      if (!polje) return zavrnjenaSprememba(definicija, posnetek, "POLJE_NI_DOVOLJENO", "sprememba.fieldKey", scopeId);
      if (sprememba.value != null && typeof sprememba.value !== "string" && typeof sprememba.value !== "number") return zavrnjenaSprememba(definicija, posnetek, "VREDNOST_NI_NIZ", "sprememba.value", scopeId);
      var vrednost = sprememba.value == null ? "" : String(sprememba.value);
      if (vrednost.length > 500) return zavrnjenaSprememba(definicija, posnetek, "VREDNOST_JE_PREDOLGA", "sprememba.value", scopeId);
      if (naslednjeInstance[String(indeksInstance)][polje.key] !== vrednost) {
        naslednjeInstance[String(indeksInstance)][polje.key] = vrednost;
        var spremenjeniKljuc = "instance." + indeksInstance + "." + polje.key;
        spremenjeniKljuci.push(spremenjeniKljuc);
        definicija.agregati.filter(function (agregat) { return agregat.reads.includes("instance.*." + polje.key); }).forEach(function (agregat) { prizadeto.push("agregat:" + agregat.id); });
      }
    } else return zavrnjenaSprememba(definicija, posnetek, "VRSTA_SPREMEMBE_NI_PODPRTA", "sprememba.vrsta", scopeId);

    var naslednjeStanje = spremenjeniKljuci.length ? stanjeIz(definicija, naslednjeStevilo, naslednjeInstance) : posnetek;
    return globokoZamrzni({ ok:true, stanje:naslednjeStanje, pogled:preberiPogled(definicija, naslednjeStanje, scopeId), changedKeys:spremenjeniKljuci, affected:prizadeto });
  }

  return Object.freeze({
    version:RAZLICICA,
    definitionVersion:RAZLICICA_DEFINICIJE,
    stateVersion:RAZLICICA_STANJA,
    podprtiVzorci:PODPRTI_VZORCI,
    preveriDefinicijo:preveriDefinicijo,
    obnovi:obnovi,
    ustvari:ustvari,
    spremeni:spremeni,
    preberiPogled:preberiPogled,
    sestaviStorageKey:sestaviStorageKey
  });
});
