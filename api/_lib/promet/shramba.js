"use strict";

/* Zapis in branje prometnih podatkov prek Supabase PostgREST (service role). */

var supa = require("../supabase-server");

async function zahteva(cfg, pot, opcije) {
  var res = await fetch(cfg.url + "/rest/v1/" + pot, Object.assign({}, opcije, {
    headers: supa.serviceHeaders(cfg, Object.assign({ "Content-Type": "application/json" }, (opcije && opcije.headers) || {}))
  }));
  var besedilo = await res.text();
  if (!res.ok) {
    var err = new Error("Supabase " + pot.split("?")[0] + ": HTTP " + res.status + " " + besedilo.slice(0, 300));
    err.code = "DATABASE_FAILED";
    throw err;
  }
  return besedilo ? JSON.parse(besedilo) : null;
}

async function zapisiZajem(cfg, rezultat, cas) {
  var uspeh = rezultat.napake.length === 0 && rezultat.pokritost > 0;
  var vrstica = (await zahteva(cfg, "promet_zajem", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ vir: rezultat.vir, cas: cas, uspeh: uspeh, pokritost: rezultat.pokritost, skupaj: rezultat.skupaj,
      st_opazovanj: rezultat.opazovanja.length, napake: rezultat.napake })
  }))[0];
  for (var i = 0; i < rezultat.opazovanja.length; i += 1000) {
    await zahteva(cfg, "promet_opazovanje", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rezultat.opazovanja.slice(i, i + 1000).map(function (o) {
        return { zajem_id: vrstica.id, vir: o.vir, celica: o.celica, cesta: o.cesta || null, zamuda_s: o.zamudaS, hitrost_kmh: o.hitrostKmh, zunanji_id: o.zunanjiId || null };
      }))
    });
  }
  if (rezultat.dogodki && rezultat.dogodki.length) {
    var zdaj = new Date(cas).toISOString();
    await zahteva(cfg, "promet_dogodek?on_conflict=vir,zunanji_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rezultat.dogodki.filter(function (d) { return d.zunanjiId; }).map(function (d) {
        var z = d.zacetek && !isNaN(Date.parse(d.zacetek)) ? new Date(d.zacetek).toISOString() : null;
        return { vir: d.vir, zunanji_id: d.zunanjiId, tip: d.tip, cesta: d.cesta || null, naslov: d.naslov || null, opis: d.opis || null,
          zacetek: z, zaprto: !!d.zaprto, tocke: d.tocke, zadnjic_videno: zdaj };
      }))
    });
  }
  return { id: vrstica.id, uspeh: uspeh };
}

async function preberiVse(cfg, tabela, qs) {
  var vse = [];
  var korak = 10000;
  for (var od = 0; ; od += korak) {
    var del = await zahteva(cfg, tabela + "?" + qs, { headers: { Range: od + "-" + (od + korak - 1) } });
    vse = vse.concat(del || []);
    if (!del || del.length < korak) return vse;
  }
}

async function preberiZgodovino(cfg, odIso) {
  var zajemi = await preberiVse(cfg, "promet_zajem", "select=id,vir,cas,uspeh&order=id.asc&cas=gte." + encodeURIComponent(odIso));
  var prviId = zajemi.length ? zajemi[0].id : 0;
  var opazovanja = await preberiVse(cfg, "promet_opazovanje", "select=zajem_id,vir,celica,zamuda_s&order=id.asc&zajem_id=gte." + prviId);
  return {
    zajemi: zajemi,
    opazovanja: opazovanja.map(function (o) { return { zajemId: o.zajem_id, vir: o.vir, celica: o.celica, zamudaS: o.zamuda_s }; })
  };
}

async function zamenjajProfil(cfg, profil) {
  await zahteva(cfg, "rpc/promet_zamenjaj_profil", { method: "POST", body: JSON.stringify({ p_vrstice: profil.vrstice, p_pokritost: profil.pokritost }) });
  await zahteva(cfg, "rpc/promet_pocisti", { method: "POST", body: JSON.stringify({ p_dni: 56 }) });
}

async function preberiProfil(cfg, celiceSeznam) {
  var filter = celiceSeznam && celiceSeznam.length ? "&celica=in.(" + celiceSeznam.map(encodeURIComponent).join(",") + ")" : "";
  return {
    vrstice: await preberiVse(cfg, "promet_profil", "select=vir,celica,tip_dneva,interval,n_vzorcev,p_zastoja,mediana_s,p85_s" + filter),
    pokritost: await preberiVse(cfg, "promet_pokritost", "select=vir,tip_dneva,interval,n_vzorcev")
  };
}

async function preberiDogodke(cfg) {
  var vrstice = await preberiVse(cfg, "promet_dogodek", "select=vir,zunanji_id,tip,cesta,naslov,zaprto,tocke&zadnjic_videno=gte." + encodeURIComponent(new Date(Date.now() - 2 * 3600 * 1000).toISOString()));
  return vrstice.map(function (d) { return { vir: d.vir, zunanjiId: d.zunanji_id, tip: d.tip, cesta: d.cesta, naslov: d.naslov, zaprto: d.zaprto, tocke: d.tocke }; });
}

module.exports = { zapisiZajem: zapisiZajem, preberiZgodovino: preberiZgodovino, zamenjajProfil: zamenjajProfil, preberiProfil: preberiProfil, preberiDogodke: preberiDogodke };
