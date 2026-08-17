/**
 * Pomožne funkcije za priloge v »Vsebina koraka« (brez DOM).
 * Uporablja jih UI in testi.
 */
(function (root) {
  "use strict";

  var K = root.UJPrilogeKonstante || {};

  function novId() {
    return (
      "att-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function formatVelikost(bajti) {
    if (!Number.isFinite(bajti) || bajti < 0) return "";
    if (bajti < 1024) return bajti + " B";
    if (bajti < 1024 * 1024) return Math.round(bajti / 1024) + " KB";
    return (bajti / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
  }

  function privzetiKanaliZaNovoPrilogo(opts) {
    opts = opts || {};
    var imaTel = Boolean(opts.imaTelefon);
    var imaEmail = Boolean(opts.imaEmail);
    var korakSms = opts.korakSms !== false;
    var korakEmail = opts.korakEmail !== false;
    var sms = imaTel && korakSms;
    var email = imaEmail && korakEmail;
    if (!sms && !email) {
      if (imaTel) sms = true;
      else if (imaEmail) email = true;
    }
    return { sms: sms, email: email };
  }

  function stevecReady(priloge) {
    return (priloge || []).filter(function (p) {
      return p && p.status === "ready";
    }).length;
  }

  function stevecNalaga(priloge) {
    return (priloge || []).filter(function (p) {
      return (
        p &&
        (p.status === "uploading" || p.status === "processing")
      );
    }).length;
  }

  function visinaSeznama(steviloVrstic) {
    if (steviloVrstic <= 0) return 0;
    if (steviloVrstic === 1) return 54;
    return 81;
  }

  function imaSmsKanal(priloge) {
    return (priloge || []).some(function (p) {
      return (
        p &&
        p.status === "ready" &&
        p.deliveryChannels &&
        p.deliveryChannels.sms
      );
    });
  }

  /** Ena kratka varna povezava za vse SMS-račune (predogled / stub). */
  function smsDodatekPovezave(priloge, zeton) {
    if (!imaSmsKanal(priloge)) return "";
    var t = zeton || "predogled";
    return (
      "\n\nRačune lahko varno pregledate tukaj: https://uj.link/r/" + t
    );
  }

  function sestaviSmsZPrilogami(osnova, priloge, zeton) {
    var base = String(osnova || "");
    var dodatek = smsDodatekPovezave(priloge, zeton);
    // Odstrani morebitni stari uj.link dodatek
    base = base.replace(
      /\n\nRačune lahko varno pregledate tukaj: https:\/\/uj\.link\/r\/\S+/g,
      ""
    );
    return base + dodatek;
  }

  function validirajDatoteko(file, obstojeci) {
    var maxN = K.MAX_ATTACHMENTS_PER_STEP || 10;
    var maxOne = K.MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024;
    var maxTot = K.MAX_TOTAL_ATTACHMENT_BYTES || 25 * 1024 * 1024;
    var seznam = obstojeci || [];
    if (seznam.length >= maxN) {
      return { napaka: "Dodate lahko največ " + maxN + " računov." };
    }
    if (!file) return { napaka: "Datoteke ni bilo mogoče prebrati." };
    if (
      K.jeMimeDovoljen &&
      !K.jeMimeDovoljen(file.type, file.name)
    ) {
      return { napaka: "Ta vrsta datoteke ni podprta." };
    }
    if (file.size > maxOne) {
      return { napaka: "Datoteka je večja od dovoljene velikosti." };
    }
    var skupaj = seznam.reduce(function (s, p) {
      return s + (Number(p.sizeBytes) || 0);
    }, 0);
    if (skupaj + file.size > maxTot) {
      return { napaka: "Datoteka je večja od dovoljene velikosti." };
    }
    return { ok: true };
  }

  function prilogaImaVeljavenKanal(p, imaTel, imaEmail) {
    /* Kanala sta neodvisna (SMS / e-pošta / oba / noben). */
    void imaTel;
    void imaEmail;
    return Boolean(p);
  }

  function normalizirajOpisPriloge(p) {
    var priloga = p || {};
    return {
      descriptionQuestion: String(
        priloga.descriptionQuestion || "Kdaj je nastala ta slika oziroma dokument?"
      ).trim(),
      description: String(priloga.description || "").trim(),
      descriptionRequired: Boolean(priloga.descriptionRequired),
    };
  }

  function prilogaImaVeljavenOpis(p) {
    var opis = normalizirajOpisPriloge(p);
    return !opis.descriptionRequired || Boolean(opis.description);
  }

  function vsePrilogeVeljavneZaPotrditev(priloge, imaTel, imaEmail) {
    var list = priloge || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.status === "uploading" || p.status === "processing") {
        return { ok: false, razlog: "Počakajte, da se vsi računi naložijo." };
      }
      if (p.status === "error") {
        return {
          ok: false,
          razlog: "Odstranite ali ponovno naložite neuspele račune.",
        };
      }
      if (!prilogaImaVeljavenOpis(p)) {
        return {
          ok: false,
          razlog: "Odgovorite na obvezno vprašanje pri vsaki prilogi.",
        };
      }
    }
    return { ok: true };
  }

  function izSejeVPriloge(k1) {
    var poti = (k1 && k1.racunDatotekePoti) || [];
    var origins = (k1 && k1.attachmentOrigins) || [];
    var kanali = (k1 && k1.attachmentKanali) || [];
    var meta = (k1 && k1.attachmentMeta) || [];
    return poti.map(function (pot, i) {
      var m = meta[i] || {};
      var k = kanali[i] || { sms: true, email: true };
      return {
        attachmentId: m.id || null,
        groupId: m.groupId || m.id || null,
        id: m.id || novId(),
        originalFileName:
          m.originalFileName ||
          String(pot).split("/").pop() ||
          "Račun",
        mimeType: m.mimeType || "",
        sizeBytes: m.sizeBytes != null ? m.sizeBytes : null,
        storagePath: String(pot),
        status: "ready",
        deliveryChannels: {
          sms: Boolean(k.sms),
          email: Boolean(k.email),
        },
        origin: origins[i] || "manual_attachment",
        createdAt: m.createdAt || null,
        updatedAt: m.updatedAt || null,
        descriptionQuestion: normalizirajOpisPriloge(m).descriptionQuestion,
        description: normalizirajOpisPriloge(m).description,
        descriptionRequired: normalizirajOpisPriloge(m).descriptionRequired,
        progress: 100,
      };
    });
  }

  function prilogeVSejo(priloge) {
    var ready = (priloge || []).filter(function (p) {
      return p && p.status === "ready" && p.storagePath;
    });
    return {
      racunDatotekePoti: ready.map(function (p) {
        return p.storagePath;
      }),
      attachmentOrigins: ready.map(function (p) {
        return p.origin || "manual_attachment";
      }),
      attachmentKanali: ready.map(function (p) {
        return {
          sms: Boolean(p.deliveryChannels && p.deliveryChannels.sms),
          email: Boolean(p.deliveryChannels && p.deliveryChannels.email),
        };
      }),
      attachmentMeta: ready.map(function (p) {
        return {
          id: p.id,
          groupId: p.groupId || p.id || null,
          originalFileName: p.originalFileName,
          mimeType: p.mimeType,
          sizeBytes: p.sizeBytes,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          descriptionQuestion: normalizirajOpisPriloge(p).descriptionQuestion,
          description: normalizirajOpisPriloge(p).description,
          descriptionRequired: normalizirajOpisPriloge(p).descriptionRequired,
        };
      }),
      shouldSendAttachment: ready.length > 0,
    };
  }

  function prilogeZaNacrt(k1) {
    var podatki = k1 || {};
    var poti = Array.isArray(podatki.racunDatotekePoti)
      ? podatki.racunDatotekePoti
      : [];
    var kanali = Array.isArray(podatki.attachmentKanali)
      ? podatki.attachmentKanali
      : [];
    var meta = Array.isArray(podatki.attachmentMeta)
      ? podatki.attachmentMeta
      : [];
    var izvori = Array.isArray(podatki.attachmentOrigins)
      ? podatki.attachmentOrigins
      : [];

    var racuni = poti.map(function (pot, i) {
      var k = kanali[i] || {};
      var m = meta[i] || {};
      return {
        documentType: "invoice",
        attachmentId: m.id || null,
        groupId: m.groupId || m.id || null,
        storagePath: String(pot),
        originalFileName: m.originalFileName || "Račun",
        mimeType: m.mimeType || "",
        sizeBytes: m.sizeBytes != null ? m.sizeBytes : null,
        origin: izvori[i] || "manual_attachment",
        descriptionQuestion: normalizirajOpisPriloge(m).descriptionQuestion,
        description: normalizirajOpisPriloge(m).description,
        descriptionRequired: normalizirajOpisPriloge(m).descriptionRequired,
        deliveryChannels: {
          sms: Boolean(k.sms),
          email: Boolean(k.email),
        },
      };
    });
    var opravljenoPoti = Array.isArray(podatki.opravljenoDatotekePoti)
      ? podatki.opravljenoDatotekePoti
      : [];
    var opravljenoMeta = Array.isArray(podatki.opravljenoAttachmentMeta)
      ? podatki.opravljenoAttachmentMeta
      : [];
    var dokazila = opravljenoPoti.map(function (pot, i) {
      var m = opravljenoMeta[i] || {};
      return {
        documentType: "work_evidence",
        attachmentId: m.id || null,
        groupId: m.groupId || m.id || null,
        storagePath: String(pot),
        originalFileName: m.originalFileName || "Dokazilo opravljenega dela",
        mimeType: m.mimeType || "",
        sizeBytes: m.sizeBytes != null ? m.sizeBytes : null,
        origin: "work_evidence",
        descriptionQuestion:
          m.descriptionQuestion || "Kdaj je nastala ta slika oziroma dokument?",
        description: m.description || "",
        descriptionRequired: Boolean(m.descriptionRequired),
        deliveryChannels: { sms: false, email: false },
      };
    });
    var brezSlike = (Array.isArray(podatki.opravljenoBrezSlike)
      ? podatki.opravljenoBrezSlike
      : []).map(function (m) {
      return {
        documentType: "work_evidence",
        attachmentId: m.id || null,
        groupId: m.groupId || m.id || null,
        storagePath: null,
        originalFileName: m.originalFileName || "Opis prvotnega stanja",
        mimeType: "text/plain",
        sizeBytes: null,
        origin: "work_evidence",
        textOnly: true,
        descriptionQuestion: m.descriptionQuestion || "Opišite prvotno stanje.",
        description: m.description || "",
        descriptionRequired: true,
        deliveryChannels: { sms: false, email: false },
        status: "ready",
      };
    });
    return racuni.concat(dokazila, brezSlike);
  }

  root.UJPrilogeVsebina = {
    novId: novId,
    formatVelikost: formatVelikost,
    privzetiKanaliZaNovoPrilogo: privzetiKanaliZaNovoPrilogo,
    stevecReady: stevecReady,
    stevecNalaga: stevecNalaga,
    visinaSeznama: visinaSeznama,
    imaSmsKanal: imaSmsKanal,
    smsDodatekPovezave: smsDodatekPovezave,
    sestaviSmsZPrilogami: sestaviSmsZPrilogami,
    validirajDatoteko: validirajDatoteko,
    prilogaImaVeljavenKanal: prilogaImaVeljavenKanal,
    normalizirajOpisPriloge: normalizirajOpisPriloge,
    prilogaImaVeljavenOpis: prilogaImaVeljavenOpis,
    vsePrilogeVeljavneZaPotrditev: vsePrilogeVeljavneZaPotrditev,
    izSejeVPriloge: izSejeVPriloge,
    prilogeVSejo: prilogeVSejo,
    prilogeZaNacrt: prilogeZaNacrt,
  };
})(typeof window !== "undefined" ? window : globalThis);
