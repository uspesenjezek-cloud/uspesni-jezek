/* ==========================================================
   nastavitve-izidov.js
   Enoten vir resnice za izide poravnave računa (kako je bil / bo
   dolg zaključen). Uporabljata ga izvedba.js (izbira načina ob
   zaključku) IN koncani-primeri.js (končni prikaz v "Podrobnosti
   zaključka") - da besedilo in barva ne moreta nikoli razpasti.

   Barve so prevzete iz obstoječih kartic v izvedba.css
   (.izvedba-action-card--poravnava-*) in se tu ne smejo spreminjati
   brez izrecne uporabnikove zahteve.
   ========================================================== */
(function (root) {
  "use strict";

  /* action_type v bazi (opomin_ukrepi.action_type / zadeva_placila.vrsta /
     zadeva_poravnave.vrsta) -> prikazni izid. installment_completed in
     partial_then_full NISTA action_type - izpeljana sta samo za prikaz iz
     zgodovine zadeva_placila (glej koncani-primeri.js: izpelјiZivljenjskiIzid). */
  var IZIDI = {
    full: {
      id: "full",
      terminalen: true,
      naslov: "Plačano v celoti",
      opis: "Prejeli ste celotno plačilo.",
      razred: "placano",
      barva: "#299b63",
      rgb: "41,155,99",
      ikona: "checkCircle",
      oznakaDatuma: "PLAČANO",
      financniPrikaz: "denarno",
      gumb: "Potrdi celotno plačilo",
    },
    partial: {
      id: "partial",
      terminalen: false,
      naslov: "Delno plačilo",
      opis: "Prejet je le del zneska.",
      razred: "delno",
      barva: "#3aa99c",
      rgb: "58,169,156",
      ikona: "coinCheck",
      oznakaDatuma: "DELNO PLAČANO",
      financniPrikaz: "denarno",
      gumb: "Shrani delno plačilo",
    },
    compensation: {
      id: "compensation",
      terminalen: true,
      naslov: "Zaključeno s kompenzacijo",
      opis: "Preostali dolg je bil zaprt s pobotom.",
      razred: "kompenzacija",
      barva: "#448bd3",
      rgb: "68,139,211",
      ikona: "swap",
      oznakaDatuma: "ZAKLJUČENO",
      financniPrikaz: "kompenzacija",
      gumb: "Potrdi kompenzacijo",
    },
    installment: {
      id: "installment",
      terminalen: false,
      naslov: "Plačilo v obrokih",
      opis: "Evidentirajte prejeti obrok.",
      razred: "obrok",
      barva: "#397fd0",
      rgb: "57,127,208",
      ikona: "calendarArrow",
      oznakaDatuma: "OBROK PREJET",
      financniPrikaz: "denarno",
      gumb: "Shrani prejeti obrok",
    },
    credit_note: {
      id: "credit_note",
      terminalen: true,
      naslov: "Zaključeno z dobropisom",
      opis: "Preostali dolg je bil pokrit z dobropisom ali odpustom.",
      razred: "dobropis",
      barva: "#e89524",
      rgb: "232,149,36",
      ikona: "tag",
      oznakaDatuma: "ZAKLJUČENO",
      financniPrikaz: "dobropis",
      gumb: "Potrdi dobropis",
    },
    cancelled_invoice: {
      id: "cancelled_invoice",
      terminalen: true,
      naslov: "Račun storniran",
      opis: "Račun je bil storniran in se ne izterjuje.",
      razred: "storno",
      barva: "#cf4c4c",
      rgb: "207,76,76",
      ikona: "documentX",
      oznakaDatuma: "STORNIRANO",
      financniPrikaz: "storno",
      gumb: "Potrdi storno računa",
    },

    /* Izpeljana (UI-only) izida za "Končane primere" - resnični action_type
       ostane 'full' oz. zadnje 'partial'/'installment' plačilo, prikaz pa
       upošteva CELOTNO zgodovino zadeva_placila (glej razdelek 3 naloge). */
    installment_completed: {
      id: "installment_completed",
      terminalen: true,
      naslov: "Plačano v obrokih",
      opis: "Prejeti so bili vsi dogovorjeni obroki.",
      razred: "obrok",
      barva: "#397fd0",
      rgb: "57,127,208",
      ikona: "calendarArrow",
      oznakaDatuma: "PLAČANO",
      financniPrikaz: "denarno",
      gumb: null,
    },
    partial_then_full: {
      id: "partial_then_full",
      terminalen: true,
      naslov: "Plačano po delih",
      opis: "Dolg je bil v celoti poravnan z več plačili.",
      razred: "delno",
      barva: "#3aa99c",
      rgb: "58,169,156",
      ikona: "coinCheck",
      oznakaDatuma: "PLAČANO",
      financniPrikaz: "denarno",
      gumb: null,
    },

    /* Samo za stare/nepopolne zapise pred uvedbo tega sistema. Novi primeri
       ne smejo pasti sem - glej razdelek 7 naloge. */
    legacy: {
      id: "legacy",
      terminalen: true,
      naslov: "Primer zaključen",
      opis: "Podrobnosti načina zaključka niso na voljo.",
      razred: "other",
      barva: "#3d7676",
      rgb: "61,118,118",
      ikona: "checkCircle",
      oznakaDatuma: "ZAKLJUČENO",
      financniPrikaz: "neznano",
      gumb: null,
    },
  };

  /* Vrstni red kartic v "Kako je bil račun poravnan?" (samo terminalni +
     partial/installment, ki tam prav tako nastopata kot izbirni kartici). */
  var VRSTNI_RED_PORAVNAVE = ["full", "partial", "compensation", "installment", "credit_note", "cancelled_invoice"];

  function izid(id) {
    return IZIDI[id] || null;
  }

  root.UJNastavitveIzidov = {
    IZIDI: IZIDI,
    VRSTNI_RED_PORAVNAVE: VRSTNI_RED_PORAVNAVE,
    izid: izid,
  };
})(typeof window !== "undefined" ? window : this);
