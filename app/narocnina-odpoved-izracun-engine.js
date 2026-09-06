(function (koren, tovarna) {
  var vmesnik = tovarna();
  if (typeof module === "object" && module.exports) module.exports = vmesnik;
  if (koren) koren.UJNarocninaOdpovedIzracunEngine = vmesnik;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var VERSION = "narocnina-odpoved-izracun-v1";
  var ENOTE_DNI = Object.freeze({ dni:1, tedni:7 });
  var ENOTE_MESECEV = Object.freeze({ meseci:1, leta:12 });

  function zamrzni(vrednost) { return Object.freeze(vrednost); }

  function razberiDatum(surovo) {
    var vir = String(surovo == null ? "" : surovo).trim();
    if (!vir) return zamrzni({ status:"prazen", casovnaZnamka:null, izvirnik:vir });
    if (vir === "Ne vem") return zamrzni({ status:"neznan", casovnaZnamka:null, izvirnik:vir });
    var priblizno = vir.indexOf("Približno: ") === 0;
    var golDatum = priblizno ? vir.slice("Približno: ".length) : vir;
    var ujemanje = /^(\d{4})-(\d{2})-(\d{2})$/.exec(golDatum);
    if (!ujemanje) return zamrzni({ status:"neveljaven", casovnaZnamka:null, izvirnik:vir });
    var leto = Number(ujemanje[1]), mesec = Number(ujemanje[2]), dan = Number(ujemanje[3]);
    var casovnaZnamka = Date.UTC(leto, mesec - 1, dan);
    var preverjanje = new Date(casovnaZnamka);
    if (preverjanje.getUTCFullYear() !== leto || preverjanje.getUTCMonth() !== mesec - 1 || preverjanje.getUTCDate() !== dan) return zamrzni({ status:"neveljaven", casovnaZnamka:null, izvirnik:vir });
    return zamrzni({ status:priblizno ? "priblizen" : "znan", casovnaZnamka:casovnaZnamka, izvirnik:vir });
  }

  function razberiTrajanje(surovo) {
    var vir = String(surovo == null ? "" : surovo).trim();
    if (!vir) return zamrzni({ status:"prazen", stevilo:null, enota:null, izvirnik:vir });
    if (vir === "Enkratno") return zamrzni({ status:"enkratno", stevilo:null, enota:null, izvirnik:vir });
    if (vir === "Nedoločen čas") return zamrzni({ status:"nedolocen-cas", stevilo:null, enota:null, izvirnik:vir });
    var ujemanje = /^(\d+)\s+(dni|tedni|meseci|leta)$/.exec(vir);
    if (!ujemanje) return zamrzni({ status:"neveljaven", stevilo:null, enota:null, izvirnik:vir });
    var stevilo = Number(ujemanje[1]);
    if (!Number.isInteger(stevilo) || stevilo <= 0) return zamrzni({ status:"neveljaven", stevilo:null, enota:null, izvirnik:vir });
    return zamrzni({ status:"doloceno", stevilo:stevilo, enota:ujemanje[2], izvirnik:vir });
  }

  function zadnjiDanMeseca(leto, mesecIndeks) {
    return new Date(Date.UTC(leto, mesecIndeks + 1, 0)).getUTCDate();
  }

  function dodajTrajanjeCasovniZnamki(casovnaZnamka, trajanje) {
    if (Object.prototype.hasOwnProperty.call(ENOTE_DNI, trajanje.enota)) {
      return casovnaZnamka + trajanje.stevilo * ENOTE_DNI[trajanje.enota] * 86400000;
    }
    var mesecev = trajanje.stevilo * ENOTE_MESECEV[trajanje.enota];
    var izhodisce = new Date(casovnaZnamka);
    var leto = izhodisce.getUTCFullYear(), mesec = izhodisce.getUTCMonth(), dan = izhodisce.getUTCDate();
    var novMesecSkupaj = mesec + mesecev;
    var novoLeto = leto + Math.floor(novMesecSkupaj / 12);
    var novMesec = ((novMesecSkupaj % 12) + 12) % 12;
    var najvecjiDan = zadnjiDanMeseca(novoLeto, novMesec);
    return Date.UTC(novoLeto, novMesec, Math.min(dan, najvecjiDan));
  }

  function formatDatum(casovnaZnamka) {
    var datum = new Date(casovnaZnamka);
    var leto = datum.getUTCFullYear();
    var mesec = String(datum.getUTCMonth() + 1).padStart(2, "0");
    var dan = String(datum.getUTCDate()).padStart(2, "0");
    return leto + "-" + mesec + "-" + dan;
  }

  function izracunajNajzgodnejsoOdpoved(vhod) {
    vhod = vhod && typeof vhod === "object" ? vhod : {};
    var zacetek = razberiDatum(vhod.zacetek);
    if (zacetek.status === "prazen" || zacetek.status === "neznan")
      return zamrzni({ status:"manjka-zacetek", datum:null, priblizno:false, viraTrajanja:null, sporocilo:"Za izračun potrebujemo datum, od kdaj imate to pogodbo." });
    if (zacetek.status === "neveljaven")
      return zamrzni({ status:"neveljaven-zacetek", datum:null, priblizno:false, viraTrajanja:null, sporocilo:"Datum začetka pogodbe ni v prepoznavni obliki." });

    var vezava = razberiTrajanje(vhod.vezava);
    var trajanje = razberiTrajanje(vhod.trajanje);
    var izbrano = vezava.status === "doloceno" ? vezava : (trajanje.status === "doloceno" ? trajanje : null);
    var viraTrajanja = vezava.status === "doloceno" ? "vezava" : (trajanje.status === "doloceno" ? "trajanje" : null);

    if (!izbrano) {
      if (trajanje.status === "enkratno")
        return zamrzni({ status:"ni-vezave", datum:null, priblizno:false, viraTrajanja:null, sporocilo:"Enkratni posel nima vezave, ki bi jo bilo treba izračunati." });
      if (trajanje.status === "nedolocen-cas" && vezava.status !== "doloceno")
        return zamrzni({ status:"ni-znane-vezave", datum:null, priblizno:false, viraTrajanja:null, sporocilo:"Trajanje je nedoločeno in minimalna vezava ni znana, zato ne moremo izračunati datuma." });
      return zamrzni({ status:"manjka-trajanje", datum:null, priblizno:false, viraTrajanja:null, sporocilo:"Za izračun potrebujemo trajanje pogodbe ali minimalno vezavo." });
    }

    var koncnaCasovnaZnamka = dodajTrajanjeCasovniZnamki(zacetek.casovnaZnamka, izbrano);
    return zamrzni({
      status:"izracunano",
      datum:formatDatum(koncnaCasovnaZnamka),
      priblizno:zacetek.status === "priblizen",
      viraTrajanja:viraTrajanja,
      sporocilo:"Najzgodnejši datum izteka minimalne vezave. To ni nujno pravi odpovedni rok — če je naveden ločen odpovedni rok pred tem datumom, upoštevajte njega."
    });
  }

  return zamrzni({
    version:VERSION,
    razberiDatum:razberiDatum,
    razberiTrajanje:razberiTrajanje,
    izracunajNajzgodnejsoOdpoved:izracunajNajzgodnejsoOdpoved
  });
});
