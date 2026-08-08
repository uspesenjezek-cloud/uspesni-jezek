/* ========== GSM-7 / UCS-2 števec SMS delov ==========
   Čista funkcija, brez DOM-a.
   Opomba: slovenski šumniki (č, š, ž) NISO v standardnem GSM-7
   naboru → štetje gre v UCS-2 (Unicode).
   window.UJGsm7Stevec
   ============================================ */
(function (root) {
  "use strict";

  /* Osnovni GSM 03.38 (osnovni alfabet). */
  var GSM7_OSNOVNI =
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

  /* Razširjeni nabor (escape 0x1B) – šteje kot 2 septeta. */
  var GSM7_RAZSIRENI = "^{}\\[~]|€";

  var osnovniSet = Object.create(null);
  var razsirjeniSet = Object.create(null);
  for (var i = 0; i < GSM7_OSNOVNI.length; i++) {
    osnovniSet[GSM7_OSNOVNI.charAt(i)] = true;
  }
  for (var j = 0; j < GSM7_RAZSIRENI.length; j++) {
    razsirjeniSet[GSM7_RAZSIRENI.charAt(j)] = true;
  }

  /**
   * @param {string} besedilo
   * @returns {{
   *   encoding: "gsm7"|"ucs2",
   *   chars: number,
   *   limit: number,
   *   parts: number,
   *   remaining: number,
   *   label: string,
   *   dolgoOpozorilo: boolean
   * }}
   */
  function stevejSms(besedilo) {
    var text = String(besedilo || "");
    var septeti = 0;
    var jeGsm = true;

    for (var k = 0; k < text.length; k++) {
      var ch = text.charAt(k);
      if (osnovniSet[ch]) {
        septeti += 1;
      } else if (razsirjeniSet[ch]) {
        septeti += 2;
      } else {
        jeGsm = false;
        break;
      }
    }

    if (jeGsm) {
      var deliGsm = septeti <= 160 ? 1 : Math.ceil(septeti / 153);
      var limitGsm = deliGsm === 1 ? 160 : 153;
      return {
        encoding: "gsm7",
        chars: septeti,
        limit: limitGsm,
        parts: deliGsm,
        remaining: Math.max(0, limitGsm * deliGsm - septeti),
        label: oblikujOznako(septeti, limitGsm, deliGsm, false),
        dolgoOpozorilo: deliGsm > 2,
      };
    }

    /* UCS-2: štej Unicode code pointe (ne UTF-16 enot). */
    var kode = Array.from(text);
    var dolzina = kode.length;
    var deliUcs = dolzina <= 70 ? 1 : Math.ceil(dolzina / 67);
    var limitUcs = deliUcs === 1 ? 70 : 67;
    return {
      encoding: "ucs2",
      chars: dolzina,
      limit: limitUcs,
      parts: deliUcs,
      remaining: Math.max(0, limitUcs * deliUcs - dolzina),
      label: oblikujOznako(dolzina, limitUcs, deliUcs, true),
      dolgoOpozorilo: deliUcs > 2,
    };
  }

  function oblikujOznako(chars, limit, parts, unicode) {
    var del =
      parts === 1 ? "1 SMS del" : parts + " SMS dela";
    if (unicode) {
      return chars + "/" + limit + " znakov (Unicode) · " + del;
    }
    return chars + "/" + limit + " znakov · " + del;
  }

  var api = {
    stevejSms: stevejSms,
  };

  root.UJGsm7Stevec = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
