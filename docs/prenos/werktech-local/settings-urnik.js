// Nastavitve · »Kdaj me stranke dosežejo« (urnik po vrstah dela, s premori).
// Samostojen modul: vstavi se na vrh #settings-view in se po vsakem
// ponovnem izrisu nastavitev vstavi znova. Stanje hrani v svojem ključu.
(() => {
  const KEY = 'werktech-urnik-v1';
  const SHORT = ['Po', 'To', 'Sr', 'Če', 'Pe', 'So', 'Ne'];
  const FULL = ['Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota', 'Nedelja'];
  const MODES = [
    ['obic', 'Običajna', 'brez doplačila', 'p', '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 12.6a6 6 0 0 1-7.6 1.5l-6.3 6.3a2 2 0 0 1-2.8-2.8l6.3-6.3A6 6 0 0 1 12.1 3.7l1.3 1.3a4 4 0 0 0 1.3 1.3z"/>'],
    ['vec', 'Večja', 'nad 1.000 €', 'b', '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>'],
    ['nuj', 'Nujna', 'z doplačilom', 'o', '<path d="M13 3 5 13.5h6l-1 7.5 8-10.5h-6z"/>']
  ];
  const wd = [[7, 12], [13, 16.5]];
  const DEFAULTS = {
    mode: 'obic',
    weeks: {
      obic: [wd, wd, wd, wd, [[7, 14]], [[8, 11], [11.5, 13]], null],
      vec: [[[7, 15]], [[7, 15]], [[7, 15]], [[7, 15]], [[7, 13]], null, null],
      nuj: [[[6, 20]], [[6, 20]], [[6, 20]], [[6, 20]], [[6, 20]], [[8, 16]], [[9, 13]]]
    },
    lasts: {
      obic: [wd, wd, wd, wd, [[7, 14]], [[8, 11], [11.5, 13]], [[8, 12]]],
      vec: [[[7, 15]], [[7, 15]], [[7, 15]], [[7, 15]], [[7, 13]], [[7, 13]], [[7, 13]]],
      nuj: [[[6, 20]], [[6, 20]], [[6, 20]], [[6, 20]], [[6, 20]], [[8, 16]], [[9, 13]]]
    }
  };
  const validWeek = w => Array.isArray(w) && w.length === 7 && w.every(d => d === null || (Array.isArray(d) && d.length >= 1 && d.length <= 2 && d.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] < p[1])));
  let st;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    st = { mode: MODES.some(m => m[0] === s.mode) ? s.mode : 'obic', weeks: {}, lasts: {} };
    MODES.forEach(([m]) => {
      st.weeks[m] = validWeek(s.weeks && s.weeks[m]) ? s.weeks[m] : DEFAULTS.weeks[m];
      st.lasts[m] = s.lasts && Array.isArray(s.lasts[m]) && s.lasts[m].length === 7 ? s.lasts[m] : DEFAULTS.lasts[m];
    });
  } catch (_) { st = JSON.parse(JSON.stringify(DEFAULTS)); }
  let sel = -1;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ mode: st.mode, weeks: st.weeks, lasts: st.lasts })); } catch (_) {} };

  const fmt = h => { const m = Math.round((h % 1) * 60); return Math.floor(h) + '.' + (m < 10 ? '0' : '') + m; };
  const hh = h => String(Math.floor(h));
  const mm = h => { const m = Math.round((h % 1) * 60); return (m < 10 ? '0' : '') + m; };
  const key = d => d ? JSON.stringify(d) : 'x';
  const txt = d => d.map(p => fmt(p[0]) + '–' + fmt(p[1])).join(' · ');
  const svg = (d, w = 17, sw = 2) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const MINUS = svg('<path d="M6 12h12"/>', 12, 3), PLUS = svg('<path d="M6 12h12M12 6v12"/>', 12, 3);

  const usualOf = week => {
    const counts = {}; let best = null;
    week.forEach(d => { if (!d) return; const k = key(d); counts[k] = (counts[k] || 0) + 1; if (!best || counts[k] > counts[best]) best = k; });
    return best ? JSON.parse(best) : null;
  };
  const setDay = (i, val) => {
    const w = st.weeks[st.mode].slice(); w[i] = val;
    const l = st.lasts[st.mode].slice(); if (val) l[i] = val;
    st.weeks[st.mode] = w; st.lasts[st.mode] = l; save();
  };

  function html() {
    const week = st.weeks[st.mode];
    const u = usualOf(week);
    const isDif = d => !!(d && u && key(d) !== key(u));
    let openN = 0, anyBrk = false;
    const days = week.map((d, i) => {
      if (d) openN++;
      if (d && d.length > 1) anyBrk = true;
      const dif = isDif(d), on = sel === i;
      const pill = (p, cls) => `<span class="pl ${cls}"><b>${hh(p[0])}<small>${mm(p[0])}</small></b><i></i><b>${hh(p[1])}<small>${mm(p[1])}</small></b></span>`;
      const inner = d
        ? pill(d[0], d.length > 1 ? 'top' : '') + (d[1] ? pill(d[1], 'bot') : '')
        : `<span class="pl"><span class="z">${svg('<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>', 18)}</span></span>`;
      return `<button type="button" class="dy ${d ? (dif ? 'dif' : 'reg') : 'cls'}${d && d.length > 1 ? ' split' : ''}${on ? ' sel' : ''}" data-urnik-day="${i}" aria-expanded="${on}" aria-label="${FULL[i]}${d ? ', ' + txt(d) + (dif ? ', drugačne ure' : '') : ', zaprto'}"><span class="n">${SHORT[i]}</span><span class="stk">${inner}</span></button>`;
    }).join('');
    const d = sel >= 0 ? week[sel] : null;
    const p1 = d ? d[0] : [7, 16], p2 = d && d[1] ? d[1] : null;
    const stepper = (act, label, val) => `<div class="stp"><button type="button" data-urnik="${act}Down" aria-label="${label} prej">${MINUS}</button><span><small>${act[0] === 'f' ? 'od' : 'do'}</small>${val}</span><button type="button" data-urnik="${act}Up" aria-label="${label} kasneje">${PLUS}</button></div>`;
    const panel = sel < 0 ? '' : `<div class="pn">
      <div class="pt"><b>${FULL[sel]}</b>${isDif(d) ? '<small>drugačne ure</small>' : ''}</div>
      <div class="seg"><button type="button" class="${d ? 'on' : ''}" data-urnik="open">Odprto</button><button type="button" class="${d ? '' : 'on'}" data-urnik="closed">Zaprto</button></div>
      ${d ? `<div class="tm">${stepper('f1', 'Začetek', fmt(p1[0]))}${stepper('t1', 'Konec', fmt(p1[1]))}</div>` : ''}
      ${p2 ? `<div class="pp"><i></i>zaprto od ${fmt(p1[1])} do ${fmt(p2[0])}<i></i></div><div class="tm">${stepper('f2', 'Ponovni začetek', fmt(p2[0]))}${stepper('t2', 'Konec', fmt(p2[1]))}</div>` : ''}
      <div class="pa">
        ${d && !p2 ? `<button type="button" class="ghost add" data-urnik="addBreak">${PLUS}Dodaj premor</button>` : ''}
        ${p2 ? '<button type="button" class="ghost add" data-urnik="removeBreak">Odstrani premor</button>' : ''}
        <button type="button" class="ok" data-urnik="close">Končano</button>
      </div></div>`;
    const modeIdx = MODES.findIndex(m => m[0] === st.mode);
    return `<div class="urnik-title"><span class="urnik-no">${svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 14, 2.4)}</span><h2>Kdaj me stranke dosežejo</h2></div>
      <div class="sg" role="tablist" aria-label="Vrsta dela"><span class="th ${MODES[modeIdx][3]}"></span>${MODES.map(([id, name, sub, cls, icon]) => `<button type="button" role="tab" class="sb ${cls}${st.mode === id ? ' on' : ''}" aria-selected="${st.mode === id}" data-urnik-mode="${id}">${svg(icon)}<span class="tx"><b>${name}</b><span>${sub}</span></span></button>`).join('')}</div>
      <div class="wk${anyBrk ? ' tall' : ''}">${days}</div>${panel}`;
  }

  function act(a) {
    const week = st.weeks[st.mode], i = sel, d = i >= 0 ? week[i] : null;
    const p1 = d ? d[0] : [7, 16], p2 = d && d[1] ? d[1] : null;
    const put = (x, y) => setDay(i, y ? [x, y] : [x]);
    const u = usualOf(week);
    switch (a) {
      case 'open': if (!d) setDay(i, st.lasts[st.mode][i] || u || [[7, 16]]); break;
      case 'closed': if (d) setDay(i, null); break;
      case 'f1Down': if (d && p1[0] > 5) put([p1[0] - 0.5, p1[1]], p2); break;
      case 'f1Up': if (d && p1[0] + 0.5 < p1[1]) put([p1[0] + 0.5, p1[1]], p2); break;
      case 't1Down': if (d && p1[1] - 0.5 > p1[0]) put([p1[0], p1[1] - 0.5], p2); break;
      case 't1Up': if (d && p1[1] + 0.5 < (p2 ? p2[0] : 22.5)) put([p1[0], p1[1] + 0.5], p2); break;
      case 'f2Down': if (p2 && p2[0] - 0.5 > p1[1]) put(p1, [p2[0] - 0.5, p2[1]]); break;
      case 'f2Up': if (p2 && p2[0] + 0.5 < p2[1]) put(p1, [p2[0] + 0.5, p2[1]]); break;
      case 't2Down': if (p2 && p2[1] - 0.5 > p2[0]) put(p1, [p2[0], p2[1] - 0.5]); break;
      case 't2Up': if (p2 && p2[1] < 22) put(p1, [p2[0], p2[1] + 0.5]); break;
      case 'addBreak': {
        if (!d || p2) break;
        const a0 = p1[0], b0 = p1[1], lunch = a0 < 12 && b0 > 13;
        const s = lunch ? 12 : a0 + Math.floor(b0 - a0) / 2, e = lunch ? 13 : s + 0.5;
        if (s > a0 && e < b0) put([a0, s], [e, b0]);
        break;
      }
      case 'removeBreak': if (p2) put([p1[0], p2[1]]); break;
      case 'close': sel = -1; break;
    }
  }

  let box = null;
  function mount() {
    const screen = document.getElementById('settings-view');
    if (!screen || !screen.querySelector('.wt-page-head')) return;
    if (!screen.querySelector('.wt-availability')) { box?.remove(); return; } // samo na zaslonu Nastavitve
    if (!box) {
      box = document.createElement('section');
      box.className = 'wt-card urnik';
      box.setAttribute('aria-label', 'Kdaj me stranke dosežejo');
      box.addEventListener('click', onClick);
    }
    const head = screen.querySelector('.wt-page-head');
    if (head.nextElementSibling !== box) head.after(box);
    box.innerHTML = html();
  }
  function onClick(e) {
    const b = e.target.closest('button');
    if (!b || !box.contains(b)) return;
    e.stopPropagation();
    if (b.dataset.urnikMode) { st.mode = b.dataset.urnikMode; sel = -1; save(); }
    else if (b.dataset.urnikDay !== undefined) { const i = Number(b.dataset.urnikDay); sel = sel === i ? -1 : i; }
    else if (b.dataset.urnik) act(b.dataset.urnik);
    box.innerHTML = html();
    if (b.dataset.urnikDay !== undefined) box.querySelector(`[data-urnik-day="${b.dataset.urnikDay}"]`)?.focus({ preventScroll: true });
  }

  const screen = document.getElementById('settings-view');
  if (!screen) return;
  // settings-view.js ob vsaki spremembi na novo izriše zaslon, zato se vstavimo znova.
  new MutationObserver(() => { if (!screen.contains(box) || screen.firstElementChild?.nextElementSibling !== box) mount(); })
    .observe(screen, { childList: true });
  mount();
})();
