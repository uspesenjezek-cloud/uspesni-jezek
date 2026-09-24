/* Uspešni Ježek – »Kaj trenutno sprejemam« (Status C, potrjena zasnova 24. 9. 2026)
 *
 * Samostojna komponenta brez odvisnosti.
 *   UJDosegljivost.mount(element, {
 *     storageKey: 'uj.dosegljivost.v1',   // privzeto shranjevanje v localStorage
 *     load: function () { return stanje | null },   // neobvezno: lastno nalaganje
 *     save: function (stanje) {},                   // neobvezno: lastno shranjevanje
 *     onCalendar: function () {}                    // neobvezno: tap na »Povezano s koledarjem«
 *   });
 * Ob vsaki spremembi element sproži dogodek 'ujds:change' (detail = stanje).
 */
(function (global) {
  'use strict';

  var SD = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];
  var FD = ['Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota', 'Nedelja'];
  var CAL = ['NED', 'PON', 'TOR', 'SRE', 'ČET', 'PET', 'SOB'];
  var STEP = { min: 15, h: 1, d: 1 };
  var UNIT_DEF = { min: [30, 60], h: [1, 3], d: [1, 2] };

  function defaults() {
    return {
      v: 1,
      on: { a: true, b: false, c: false },
      cap: 3, per: 'teden', af: true, kinds: { obic: true, vec: true, ogl: true },
      ed: [[7, 20], [7, 20], [7, 20], [7, 20], [7, 20], null, null], edF: 0,
      mu: 'h', ra: 1, rb: 3,
      unit: 'eur', fee: 40, sh: true,
      nd: false, vac: [], nextId: 1
    };
  }

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    var out = {};
    Object.keys(base).forEach(function (k) {
      var b = base[k], s = saved[k];
      if (s === undefined) { out[k] = b; return; }
      if (b && typeof b === 'object' && !Array.isArray(b) && s && typeof s === 'object' && !Array.isArray(s)) out[k] = Object.assign({}, b, s);
      else out[k] = s;
    });
    return out;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function iso(x) { var m = x.getMonth() + 1, d = x.getDate(); return x.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
  function parse(v) { var p = String(v).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fd(x) { return x.getDate() + '. ' + (x.getMonth() + 1) + '.'; }
  function h2(h) { var m = Math.round((h % 1) * 60); return Math.floor(h) + '.' + (m < 10 ? '0' : '') + m; }
  function dni(n) { return n === 1 ? '1 dan' : (n === 2 ? '2 dni' : (n < 5 ? n + ' dnevi' : n + ' dni')); }
  function word(n, u) {
    var m = n % 100;
    var f = { min: ['minuta', 'minuti', 'minute', 'minut'], h: ['ura', 'uri', 'ure', 'ur'], d: ['dan', 'dneva', 'dni', 'dni'] }[u];
    return m === 1 ? f[0] : m === 2 ? f[1] : (m === 3 || m === 4) ? f[2] : f[3];
  }
  function dela(n, a) { return a ? (n === 1 ? 'novo delo' : n === 2 ? 'novi deli' : n < 5 ? 'nova dela' : 'novih del') : (n === 1 ? 'delo' : n === 2 ? 'deli' : n < 5 ? 'dela' : 'del'); }

  var I = {
    pulse: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h4l2.5-6 5 12 2.5-6h4"/></svg>',
    cal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3.5"/><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5M9 14.8l2 2 4-4"/></svg>',
    siren: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18v-5a5 5 0 0 1 10 0v5"/><rect x="4.5" y="18" width="15" height="3" rx="1.2"/><path d="M12 2.8v1.8M4.4 6l1.3 1.3M19.6 6l-1.3 1.3M12 10.5v3.5"/></svg>',
    umb: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 11.5a8.5 8.5 0 0 1 17 0z"/><path d="M12 11.5v7.5a2 2 0 0 0 4 0"/><path d="M12 3v1"/></svg>',
    ok: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    up2: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 12 6-6 6 6M6 18l6-6 6 6"/></svg>',
    minus: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>',
    plus: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>',
    plus16: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>',
    plus13: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
    link: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    chev: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'
  };

  function mount(root, opts) {
    opts = opts || {};
    var key = opts.storageKey || 'uj.dosegljivost.v1';
    var focus = '';
    var draft = { nf: '', nt: '' };

    function load() {
      try {
        if (opts.load) return merge(defaults(), opts.load());
        var raw = global.localStorage && global.localStorage.getItem(key);
        return merge(defaults(), raw ? JSON.parse(raw) : null);
      } catch (e) { return defaults(); }
    }
    var st = load();

    function persist() {
      try {
        if (opts.save) opts.save(JSON.parse(JSON.stringify(st)));
        else if (global.localStorage) global.localStorage.setItem(key, JSON.stringify(st));
      } catch (e) { /* shranjevanje ni na voljo: stanje ostane v pomnilniku */ }
      try { root.dispatchEvent(new CustomEvent('ujds:change', { detail: JSON.parse(JSON.stringify(st)) })); } catch (e) {}
    }
    function set(patch, noRender) { Object.assign(st, patch); persist(); if (!noRender) render(); }

    function today() { var t = opts.today ? new Date(opts.today) : new Date(); t.setHours(0, 0, 0, 0); return t; }

    function derived() {
      var t = today();
      var vac = st.vac.map(function (v) { return Object.assign({}, v, { f: parse(v.from), to_: parse(v.to) }); })
        .filter(function (v) { return v.to_ >= t; })
        .sort(function (x, y) { return x.f - y.f; });
      var feeTxt = '+' + st.fee + (st.unit === 'eur' ? ' €' : ' %');
      var resp = st.ra + '–' + st.rb + ' ' + word(st.rb, st.mu);
      var capTxt = 'do ' + st.cap + ' ' + dela(st.cap) + ' na ' + st.per;
      var parts = [];
      if (st.on.c) {
        parts.push('Na dopustu');
        if (st.on.b) parts.push('nujni primeri v ' + resp + (st.sh ? ' (' + feeTxt + ')' : ''));
      } else {
        parts.push(st.on.a ? 'Sprejema nova dela (' + capTxt + ')' : 'Trenutno ne sprejema novih del');
        if (st.on.b) parts.push('nujno v ' + resp + (st.sh ? ' (' + feeTxt + ')' : ''));
      }
      var nv = vac.filter(function (v) { return v.f >= t; })[0];
      if (nv) parts.push('odsoten ' + fd(nv.f) + '–' + fd(nv.to_) + (nv.label && nv.pub ? ' · ' + nv.label : ''));
      return {
        t: t, vac: vac, feeTxt: feeTxt, resp: resp, capTxt: capTxt, preview: parts.join(' · '),
        subA: st.on.a ? capTxt : 'ne sprejemam',
        subB: st.on.b ? feeTxt + ' · ' + resp : 'izklopljeno',
        tileA: st.on.a ? st.cap + ' na ' + st.per : 'izklop',
        tileB: st.on.b ? resp : 'izklop',
        subC: vac.length ? 'naslednji ' + fd(vac[0].f) : 'z datumom'
      };
    }

    function tile(k, cls, icon, name, sub, x) {
      var on = st.on[k];
      return '<div class="tw">' +
        '<button class="t ' + cls + (on ? ' on' : '') + (focus === k ? ' fo' : '') + '" data-act="focus" data-k="' + k + '" aria-expanded="' + (focus === k) + '">' +
        '<span class="ic">' + icon + '</span><span class="tx"><b>' + name + '</b><small>' + esc(sub) + '</small></span></button>' +
        '<button class="okb" data-act="toggle" data-k="' + k + '" aria-label="' + name + ' vklop ali izklop" aria-pressed="' + on + '"><span class="ok ' + x + '">' + I.ok + '</span></button>' +
        '</div>';
    }
    function head(title, sub) {
      return '<div class="ph"><b>' + title + '</b><span>' + esc(sub) + '</span><button class="cl" data-act="close" aria-label="Zapri">' + I.up2 + 'Zapri</button></div>';
    }
    function tail(k, D) {
      var on = st.on[k];
      var what = { a: 'sprejemanje', b: 'nujne primere', c: 'dopust' }[k];
      return '<div class="pvw">' + I.eye + '<span><b>Kaj vidijo stranke</b>' + esc(D.preview) + '</span></div>' +
        '<button class="tgl' + (on ? '' : ' off') + '" data-act="toggle" data-k="' + k + '">' + (on ? 'Izklopi ' : 'Vklopi ') + what + '</button>';
    }
    function sw(act, on, label) {
      return '<button class="sw2' + (on ? ' on' : '') + '" data-act="' + act + '" aria-pressed="' + !!on + '" aria-label="' + label + '"><i></i></button>';
    }

    function panelA(D) {
      var kinds = [['Običajna', 'obic', 'p'], ['Večja', 'vec', 'b'], ['Ogled', 'ogl', 'g']].map(function (k) {
        return '<button class="kd ' + (st.kinds[k[1]] ? 'on ' : '') + k[2] + '" data-act="kind" data-k="' + k[1] + '" aria-pressed="' + !!st.kinds[k[1]] + '">' + k[0] + '</button>';
      }).join('');
      var per = [['na teden', 'teden'], ['na mesec', 'mesec']].map(function (o) {
        return '<button class="' + (st.per === o[1] ? 'on' : '') + '" data-act="per" data-v="' + o[1] + '">' + o[0] + '</button>';
      }).join('');
      return '<div class="pn pg c1">' + head('Sprejemam', D.subA) +
        '<div class="pack">' +
          '<button class="calw" data-act="calendar"><span class="ct"><i>' + CAL[D.t.getDay()] + '</i><b>' + D.t.getDate() + '</b></span>' +
          '<span class="cx"><b>Povezano s koledarjem</b><small>' + I.link + 'zasedenost se šteje samodejno</small></span><span class="cv">' + I.chev + '</span></button>' +
          '<div class="rw col gr"><div class="pv"><span class="rl"><b>Nova dela</b><small>koliko jih sprejmem</small></span><span class="mu g">' + per + '</span></div>' +
            '<div class="cap"><span class="capl">največ</span><span class="sp g"><button data-act="cap" data-d="-1" aria-label="Manj">' + I.minus + '</button><b>' + st.cap + '</b><button data-act="cap" data-d="1" aria-label="Več">' + I.plus + '</button></span><span class="capu">' + dela(st.cap, true) + '</span></div></div>' +
          '<div class="rw col gr"><div class="pv"><span class="rl"><b>Vrste del</b><small>katera nova dela sprejemam</small></span></div><div class="chs">' + kinds + '</div></div>' +
        '</div>' +
        '<div class="rw gr"><span class="rl"><b>Ko je polno, pokaži »zasedeno«</b><small>' + (st.af ? 'stranke vidijo prvi prost termin' : 'sprejemaš tudi, ko je polno') + '</small></span>' + sw('af', st.af, 'Samodejno zasedeno') + '</div>' +
        tail('a', D) + '</div>';
    }

    function panelB(D) {
      var ef = st.edF, ev = ef >= 0 ? st.ed[ef] : null;
      var onN = st.ed.filter(Boolean).length;
      var days = st.ed.map(function (v, i) {
        var fo = ef === i && !!v;
        return '<button class="' + (v ? (fo ? 'fo' : 'on') : '') + '" data-act="day" data-i="' + i + '" aria-pressed="' + !!v + '" aria-label="' + FD[i] + (v ? ', ' + h2(v[0]) + ' do ' + h2(v[1]) : ', ne sprejemam') + '">' + SD[i] + '</button>';
      }).join('');
      var units = [['minute', 'min'], ['ure', 'h'], ['dnevi', 'd']].map(function (u) {
        return '<button class="' + (st.mu === u[1] ? 'on' : '') + '" data-act="unit" data-v="' + u[1] + '">' + u[0] + '</button>';
      }).join('');
      var dayPill = ev ? '<div class="mi on dy"><span class="dn">' + SD[ef] + '</span>' +
        '<span class="sp"><small>od</small><button data-act="dayh" data-w="0" data-d="-1" aria-label="Od prej">' + I.minus + '</button><b class="tm2">' + h2(ev[0]) + '</b><button data-act="dayh" data-w="0" data-d="1" aria-label="Od kasneje">' + I.plus + '</button></span>' +
        '<span class="sp"><small>do</small><button data-act="dayh" data-w="1" data-d="-1" aria-label="Do prej">' + I.minus + '</button><b class="tm2">' + h2(ev[1]) + '</b><button data-act="dayh" data-w="1" data-d="1" aria-label="Do kasneje">' + I.plus + '</button></span></div>' : '';
      return '<div class="pn pr c2">' + head('Nujni primeri', D.subB) +
        '<div class="rw col"><div class="pv"><span class="rl"><b>Kdaj sprejemam nujne</b><small>' + (onN === 7 ? 'vse dni' : onN + ' dni') + ' · tapni dan za uri</small></span></div><div class="dd">' + days + '</div>' + dayPill + '</div>' +
        '<div class="rw col"><div class="pv"><span class="rl"><b>Pridem v</b></span><span class="mu">' + units + '</span></div>' +
          '<div class="mi on"><span class="sp"><small>od</small><button data-act="rng" data-w="a" data-d="-1" aria-label="Od manj">' + I.minus + '</button><b>' + st.ra + '</b><button data-act="rng" data-w="a" data-d="1" aria-label="Od več">' + I.plus + '</button></span>' +
          '<span class="sp"><small>do</small><button data-act="rng" data-w="b" data-d="-1" aria-label="Do manj">' + I.minus + '</button><b>' + st.rb + '</b><button data-act="rng" data-w="b" data-d="1" aria-label="Do več">' + I.plus + '</button></span>' +
          '<span class="uw">' + word(st.rb, st.mu) + '</span></div></div>' +
        '<div class="rw fee"><span class="rl"><b>Doplačilo</b><small>za nujen izhod</small></span>' +
          '<span class="un"><button class="' + (st.unit === 'eur' ? 'on' : '') + '" data-act="feeu" data-v="eur" aria-label="Evri">€</button><button class="' + (st.unit === 'pct' ? 'on' : '') + '" data-act="feeu" data-v="pct" aria-label="Odstotki">%</button></span>' +
          '<span class="st3"><button data-act="fee" data-d="-1" aria-label="Manj">' + I.minus + '</button><b>' + esc(D.feeTxt) + '</b><button data-act="fee" data-d="1" aria-label="Več">' + I.plus + '</button></span></div>' +
        '<div class="rw"><span class="rl"><b>Pokaži strankam</b><small>doplačilo in odzivni čas</small></span>' + sw('sh', st.sh, 'Pokaži doplačilo in odzivni čas strankam') + '</div>' +
        tail('b', D) + '</div>';
    }

    function panelC(D) {
      var t = D.t;
      var nextSat = (6 - t.getDay() + 7) % 7 || 7;
      var nextMon = (8 - t.getDay()) % 7 || 7;
      var add = function (n) { var x = new Date(t); x.setDate(x.getDate() + n); return x; };
      var nf = draft.nf || iso(add(nextMon)), nt = draft.nt || iso(add(nextMon + 6));
      var quick = [['Ta vikend', nextSat, nextSat + 1], ['1 teden', nextMon, nextMon + 6], ['2 tedna', nextMon, nextMon + 13]].map(function (q) {
        return '<button class="ch add" data-act="vadd" data-a="' + iso(add(q[1])) + '" data-b="' + iso(add(q[2])) + '">' + I.plus13 + q[0] + '</button>';
      }).join('');
      var list = D.vac.map(function (v) {
        var len = Math.round((v.to_ - v.f) / 864e5) + 1;
        return '<div class="vw"><div class="r1"><span class="dt"><b>' + fd(v.f) + ' – ' + fd(v.to_) + ' ' + v.to_.getFullYear() + '</b><small>' + dni(len) + '</small></span>' +
          '<button class="ib" data-act="vdel" data-id="' + v.id + '" aria-label="Odstrani dopust">' + I.x + '</button></div>' +
          '<div class="r2"><input class="nm2" type="text" maxlength="40" placeholder="Dodaj naziv, npr. Sejem" value="' + esc(v.label) + '" data-act="vlabel" data-id="' + v.id + '" aria-label="Naziv odsotnosti">' +
          '<span class="sl">Pokaži<br>strankam</span>' +
          '<button class="sw2' + (v.pub ? ' on' : '') + '" data-act="vpub" data-id="' + v.id + '" aria-pressed="' + !!v.pub + '" aria-label="Pokaži naziv strankam"><i></i></button></div></div>';
      }).join('') || '<div class="em">Ni načrtovanih dopustov.</div>';
      return '<div class="pn pb c3">' + head('Dopusti', D.subC) +
        '<div class="lb">Hitro dodaj</div><div class="chs">' + quick + '</div>' +
        '<div class="rg"><label class="bb"><span>od</span><input type="date" value="' + nf + '" data-act="nf" aria-label="Dopust od"></label>' +
        '<label class="bb"><span>do</span><input type="date" value="' + nt + '" min="' + nf + '" data-act="nt" aria-label="Dopust do"></label>' +
        '<button class="ad" data-act="vrange" aria-label="Dodaj dopust">' + I.plus16 + '</button></div>' +
        '<div class="lb">Načrtovano</div><div class="vl">' + list + '</div>' +
        '<div class="rw bl"><span class="rl"><b>Nujni tudi med dopustom</b><small>' + (st.nd ? 'nujne primere sprejemaš tudi na dopustu' : 'med dopustom si nedosegljiv') + '</small></span>' + sw('nd', st.nd, 'Nujni tudi med dopustom') + '</div>' +
        tail('c', D) + '</div>';
    }

    function render() {
      var D = derived();
      var active = document.activeElement;
      var keep = active && root.contains(active) && active.getAttribute('data-act') ? { act: active.getAttribute('data-act'), id: active.getAttribute('data-id'), k: active.getAttribute('data-k') } : null;
      root.innerHTML = '<section class="card" aria-label="Kaj trenutno sprejemam">' +
        '<div class="hd"><span class="hi">' + I.pulse + '</span><h2>Kaj trenutno sprejemam</h2></div>' +
        '<div class="tl">' + tile('a', 'g', I.cal, 'Sprejemam', D.tileA, 'gx') + tile('b', 'r', I.siren, 'Nujno', D.tileB, 'rx') + tile('c', 'b', I.umb, 'Dopust', D.subC, 'bx') + '</div>' +
        (focus === 'a' ? panelA(D) : focus === 'b' ? panelB(D) : focus === 'c' ? panelC(D) : '') +
        '</section>';
      fit();
      if (keep) {
        var sel = '[data-act="' + keep.act + '"]' + (keep.id ? '[data-id="' + keep.id + '"]' : '') + (keep.k ? '[data-k="' + keep.k + '"]' : '');
        var el = root.querySelector(sel);
        if (el && el.focus) el.focus({ preventScroll: true });
      }
    }

    /* Samodejno prilagajanje velikosti pisave: besedilo se ne reže, okvir se ne širi. */
    function fit() {
      var els = root.querySelectorAll('.t b, .t small, .ph span, .uw, .dt b, .pv .rl b, .cx b');
      Array.prototype.forEach.call(els, function (el) {
        el.style.fontSize = '';
        var size = parseFloat(global.getComputedStyle(el).fontSize), min = Math.max(9, size * 0.72), guard = 0;
        while (el.scrollWidth > el.clientWidth + 0.5 && size > min && guard++ < 30) { size -= 0.5; el.style.fontSize = size + 'px'; }
      });
    }
    var rt; global.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(fit, 80); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

    function toggle(k) {
      var n = Object.assign({}, st.on);
      if (k === 'c') { n = { a: false, b: st.nd ? st.on.b : false, c: !st.on.c }; if (!n.c) n.a = true; }
      else if (k === 'b' && st.on.c && st.nd) { n.b = !st.on.b; }
      else { n[k] = !st.on[k]; n.c = false; if (!n.a && !n.b) return; }
      set({ on: n });
    }

    root.classList.add('ujds');
    root.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el || !root.contains(el)) return;
      var a = el.getAttribute('data-act'), d = +el.getAttribute('data-d') || 0;
      if (a === 'focus') { focus = focus === el.getAttribute('data-k') ? '' : el.getAttribute('data-k'); render(); }
      else if (a === 'close') { focus = ''; render(); }
      else if (a === 'toggle') toggle(el.getAttribute('data-k'));
      else if (a === 'calendar') { if (opts.onCalendar) opts.onCalendar(); }
      else if (a === 'per') set({ per: el.getAttribute('data-v') });
      else if (a === 'cap') set({ cap: Math.max(1, Math.min(20, st.cap + d)) });
      else if (a === 'kind') { var kn = Object.assign({}, st.kinds); var kk = el.getAttribute('data-k'); kn[kk] = !kn[kk]; if (kn.obic || kn.vec || kn.ogl) set({ kinds: kn }); }
      else if (a === 'af' || a === 'sh' || a === 'nd') { var p = {}; p[a] = !st[a]; set(p); }
      else if (a === 'day') {
        var i = +el.getAttribute('data-i'), v = st.ed[i], ed = st.ed.slice();
        if (!v) { ed[i] = [7, 20]; set({ ed: ed, edF: i }); }
        else if (st.edF === i) { ed[i] = null; set({ ed: ed, edF: -1 }); }
        else set({ edF: i });
      }
      else if (a === 'dayh') {
        var f = st.edF, cur = st.ed[f]; if (!cur) return;
        var w = +el.getAttribute('data-w'), nv = cur.slice(); nv[w] += d;
        if (nv[0] < 0 || nv[1] > 24 || nv[0] >= nv[1]) return;
        var e2 = st.ed.slice(); e2[f] = nv; set({ ed: e2 });
      }
      else if (a === 'unit') { var u = el.getAttribute('data-v'); set({ mu: u, ra: UNIT_DEF[u][0], rb: UNIT_DEF[u][1] }); }
      else if (a === 'rng') {
        var s = STEP[st.mu], ra = st.ra, rb = st.rb;
        if (el.getAttribute('data-w') === 'a') { ra += d * s; if (ra < s) return; if (rb < ra) rb = ra; }
        else { rb += d * s; if (rb < ra) return; }
        set({ ra: ra, rb: rb });
      }
      else if (a === 'feeu') { var fu = el.getAttribute('data-v'); if (fu !== st.unit) set({ unit: fu, fee: fu === 'eur' ? 40 : 30 }); }
      else if (a === 'fee') { var nf2 = st.fee + d * 5; if (nf2 >= 5 && nf2 <= 500) set({ fee: nf2 }); }
      else if (a === 'vadd') addVac(el.getAttribute('data-a'), el.getAttribute('data-b'));
      else if (a === 'vrange') {
        var D0 = derived(), t0 = D0.t;
        var nm = (8 - t0.getDay()) % 7 || 7, ad = function (n) { var x = new Date(t0); x.setDate(x.getDate() + n); return iso(x); };
        var fa = draft.nf || ad(nm), fb = draft.nt || ad(nm + 6);
        if (fb < fa) { var tmp = fa; fa = fb; fb = tmp; }
        draft = { nf: '', nt: '' }; addVac(fa, fb);
      }
      else if (a === 'vdel') { var id = +el.getAttribute('data-id'); set({ vac: st.vac.filter(function (x) { return x.id !== id; }) }); }
      else if (a === 'vpub') { var id2 = +el.getAttribute('data-id'); set({ vac: st.vac.map(function (x) { return x.id === id2 ? Object.assign({}, x, { pub: !x.pub }) : x; }) }); }
    });
    root.addEventListener('click', function (e) {
      var inp = e.target.closest('input[type="date"]');
      if (inp && inp.showPicker) { try { inp.showPicker(); } catch (err) {} }
    });
    root.addEventListener('input', function (e) {
      var el = e.target; var a = el.getAttribute('data-act');
      if (a === 'vlabel') { var id = +el.getAttribute('data-id'); set({ vac: st.vac.map(function (x) { return x.id === id ? Object.assign({}, x, { label: el.value.slice(0, 40) }) : x; }) }, true); }
    });
    root.addEventListener('change', function (e) {
      var el = e.target; var a = el.getAttribute('data-act');
      if (a === 'vlabel') render();
      else if (a === 'nf') { draft.nf = el.value; if (draft.nt && draft.nt < draft.nf) draft.nt = draft.nf; render(); }
      else if (a === 'nt') { draft.nt = el.value; render(); }
    });

    function addVac(from, to) {
      set({ vac: st.vac.concat([{ id: st.nextId, from: from, to: to, label: '', pub: true }]), nextId: st.nextId + 1 });
    }

    render();
    return {
      getState: function () { return JSON.parse(JSON.stringify(st)); },
      setState: function (patch) { set(patch); },
      open: function (k) { focus = k || ''; render(); },
      reload: function () { st = load(); render(); }
    };
  }

  global.UJDosegljivost = { mount: mount, defaults: defaults };
})(window);
