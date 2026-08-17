/* ==========================================================
   obvestila-globalno.js
   Globalni prikaz OBVESTIL V APLIKACIJI (ne OS push - v tem
   repozitoriju ni push infrastrukture) za vse zaščitene strani.
   Bere tabelo obrtnik_obvestila (RLS: obrtnik vidi samo svoja),
   posluša Supabase Realtime za nova obvestila, ob kliku pokliče
   RPC oznaci_obvestilo_prebrano in odpre izvedba.html za pravo
   zadevo. Vidno ob vsakem odprtju aplikacije (bere neprebrana ob
   nalaganju strani), ne samo dokler je stran odprta.
   ========================================================== */
(function () {
  "use strict";

  if (/\/prijava\.html$/i.test(window.location.pathname)) return;
  if (typeof supabaseKlient === "undefined") return;

  var TIPI_NASLOVI = {
    opomin_potrditev: "Opomin čaka na vašo potrditev",
    obljuba_placila_potek: "Preverite obljubljeno plačilo",
  };

  var state = {
    obvestila: [],
    odprto: false,
    userId: null,
    channel: null,
  };

  var host = null;
  var gumb = null;
  var znacka = null;
  var plosca = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function dodajSloge() {
    if (document.getElementById("uj-obvestila-globalno-slogi")) return;
    var slog = document.createElement("style");
    slog.id = "uj-obvestila-globalno-slogi";
    slog.textContent =
      ".ujog{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:2147482900;font-family:inherit}" +
      ".ujog__gumb{position:relative;display:grid;place-items:center;width:48px;height:48px;border-radius:50%;border:1px solid rgba(24,58,58,.14);background:#fff;box-shadow:0 8px 22px rgba(20,30,40,.18);cursor:pointer;color:#183a3a}" +
      ".ujog__gumb svg{width:22px;height:22px}" +
      ".ujog__gumb:focus-visible{outline:2px solid #2f7d6a;outline-offset:2px}" +
      ".ujog__znacka{position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#d64545;color:#fff;font-size:10px;font-weight:800;display:grid;place-items:center;line-height:1}" +
      ".ujog__znacka[hidden]{display:none}" +
      ".ujog__plosca{position:absolute;right:0;bottom:58px;width:min(320px,86vw);max-height:70vh;overflow:auto;border-radius:18px;border:1px solid rgba(24,58,58,.12);background:#fff;box-shadow:0 18px 48px rgba(18,34,34,.25);padding:8px}" +
      ".ujog__plosca[hidden]{display:none}" +
      ".ujog__glava{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 8px;color:#183a3a;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}" +
      ".ujog__prazno{padding:16px 10px;color:#718483;font-size:12px;text-align:center}" +
      ".ujog__vrstica{display:block;width:100%;text-align:left;padding:10px;border-radius:12px;border:1px solid transparent;background:none;font:inherit;color:#172224;cursor:pointer}" +
      ".ujog__vrstica:hover,.ujog__vrstica:focus-visible{background:rgba(47,125,106,.08);border-color:rgba(47,125,106,.25)}" +
      ".ujog__vrstica-naslov{display:block;font-size:12.5px;font-weight:700;margin-bottom:2px}" +
      ".ujog__vrstica-cas{display:block;font-size:10.5px;color:#718483}";
    document.head.appendChild(slog);
  }

  function zgradiHost() {
    if (host) return host;
    dodajSloge();
    host = document.createElement("div");
    host.className = "ujog";
    host.innerHTML =
      '<button type="button" class="ujog__gumb" aria-haspopup="true" aria-expanded="false" aria-label="Obvestila v aplikaciji">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
      '<span class="ujog__znacka" hidden>0</span>' +
      "</button>" +
      '<div class="ujog__plosca" hidden role="menu" aria-label="Seznam obvestil"></div>';
    document.body.appendChild(host);
    gumb = host.querySelector(".ujog__gumb");
    znacka = host.querySelector(".ujog__znacka");
    plosca = host.querySelector(".ujog__plosca");

    gumb.addEventListener("click", function () {
      state.odprto = !state.odprto;
      render();
    });
    document.addEventListener("click", function (event) {
      if (!state.odprto) return;
      if (host.contains(event.target)) return;
      state.odprto = false;
      render();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.odprto) {
        state.odprto = false;
        render();
      }
    });
    plosca.addEventListener("click", function (event) {
      var vrstica = event.target.closest("[data-ujog-id]");
      if (!vrstica) return;
      odpriObvestilo(vrstica.getAttribute("data-ujog-id"), vrstica.getAttribute("data-ujog-zadeva"));
    });

    return host;
  }

  function formatCas(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  function render() {
    if (!host) return;
    gumb.setAttribute("aria-expanded", state.odprto ? "true" : "false");
    plosca.hidden = !state.odprto;

    var stevilo = state.obvestila.length;
    znacka.hidden = stevilo === 0;
    znacka.textContent = stevilo > 9 ? "9+" : String(stevilo);

    if (!state.odprto) return;

    if (!stevilo) {
      plosca.innerHTML = '<div class="ujog__glava">Obvestila</div><div class="ujog__prazno">Trenutno ni novih obvestil.</div>';
      return;
    }

    var vrstice = state.obvestila.map(function (o) {
      var naslov = o.naslov || TIPI_NASLOVI[o.tip] || "Obvestilo";
      return (
        '<button type="button" class="ujog__vrstica" role="menuitem" data-ujog-id="' + esc(o.id) + '" data-ujog-zadeva="' + esc(o.zadeva_id) + '">' +
        '<span class="ujog__vrstica-naslov">' + esc(naslov) + "</span>" +
        '<span class="ujog__vrstica-cas">' + esc(formatCas(o.ustvarjeno_at)) + "</span>" +
        "</button>"
      );
    });

    plosca.innerHTML = '<div class="ujog__glava">Obvestila</div>' + vrstice.join("");
  }

  async function odpriObvestilo(id, zadevaId) {
    try {
      await supabaseKlient.rpc("oznaci_obvestilo_prebrano", { p_id: id });
    } catch (e) {
      /* Ne blokiramo navigacije, tudi če označevanje spodleti. */
    }
    if (zadevaId) {
      window.location.href = "izvedba.html?zadevaId=" + encodeURIComponent(zadevaId);
    }
  }

  async function naloziNeprebrana() {
    try {
      var odgovor = await supabaseKlient
        .from("obrtnik_obvestila")
        .select("id,zadeva_id,step_id,tip,naslov,ustvarjeno_at")
        .is("prebrano_at", null)
        .order("ustvarjeno_at", { ascending: false })
        .limit(30);
      if (odgovor && !odgovor.error && Array.isArray(odgovor.data)) {
        state.obvestila = odgovor.data;
        render();
      }
    } catch (e) {
      /* Tiho - obvestila niso kritičen del strani. */
    }
  }

  function narociRealtime() {
    if (!state.userId || state.channel) return;
    state.channel = supabaseKlient
      .channel("obvestila-globalno-" + state.userId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "obrtnik_obvestila", filter: "obrtnik_id=eq." + state.userId },
        function () { naloziNeprebrana(); }
      )
      .subscribe(function (status) {
        if (status === "SUBSCRIBED") naloziNeprebrana();
      });
  }

  async function init() {
    zgradiHost();
    render();
    try {
      var seja = await supabaseKlient.auth.getSession();
      var uid = seja && seja.data && seja.data.session && seja.data.session.user && seja.data.session.user.id;
      if (!uid) return;
      state.userId = uid;
    } catch (e) {
      return;
    }
    await naloziNeprebrana();
    narociRealtime();
  }

  window.addEventListener("beforeunload", function () {
    if (state.channel) {
      try { supabaseKlient.removeChannel(state.channel); } catch (e) { /* no-op */ }
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
