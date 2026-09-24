// Začetna stran »Moja spletna stran« (dizajn v6/v10): stanje za stranke, vrednost
// povpraševanj, od kod pridejo, poudarjena orodja, obisk in zadnje aktivnosti.
// Samo pregled – urejanje je v Nastavitvah, odgovarjanje v delu s strankami.
(() => {
  const main = document.querySelector('.app-scroll > main');
  const website = document.querySelector('#general .website');
  if (!main || !website || typeof render !== 'function') return;

  const SETTINGS_KEY = 'werktech-settings-page-v1';
  const AVG_LEAD_VALUE = 4100; // vzorčna povprečna vrednost povpraševanja iz izračuna
  const VISIT_PRICE = 30; // vzorčna cena ogleda, ki se ob naročilu odšteje
  const PLACES = ['Ljubljana', 'Domžale', 'Kamnik', 'Kranj'];
  const PLACE_WEIGHTS = [0.42, 0.25, 0.17, 0.16];
  const JOBS = ['Kuhinja po meri', 'Vgradna omara', 'Stopnice'];
  const JOBS_ACC = { 'Kuhinja po meri': 'kuhinjo po meri', 'Vgradna omara': 'vgradne omare', 'Stopnice': 'stopnice' };
  const SEARCHES = ['kuhinja po meri ljubljana', 'mizar domžale', 'vgradna omara cena'];
  let visitsCompare = false;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const euro = n => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;
  const noun = n => { const t = n % 100; return t === 1 ? 'povpraševanje' : t === 2 ? 'povpraševanji' : t === 3 || t === 4 ? 'povpraševanja' : 'povpraševanj'; };
  const settings = () => {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (_) {}
    return {
      availability: s.availability || 'open',
      nextDate: s.nextDate || '2026-10-06',
      cities: Array.isArray(s.cities) ? s.cities : ['Ljubljana', 'Domžale', 'Kamnik'],
      workEnabled: { urgent: true, visit: true, ...(s.workEnabled || {}) },
      workDistances: { urgent: 10, visit: 20, ...(s.workDistances || {}) }
    };
  };
  // Razdeli celo število po utežeh tako, da se vsota ujema.
  const split = (total, weights) => {
    const sum = weights.reduce((a, b) => a + b, 0);
    const raw = weights.map(w => w / sum * total), parts = raw.map(Math.floor);
    const left = total - parts.reduce((a, b) => a + b, 0);
    raw.map((v, i) => ({ i, f: v - parts[i] })).sort((a, b) => b.f - a.f).slice(0, left).forEach(x => parts[x.i]++);
    return parts;
  };
  const scale = () => datasets[period].opened / 42;
  const openSettings = target => {
    document.querySelector('.dock [data-modal="settings"]')?.click();
    if (target) setTimeout(() => document.querySelector(target)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  };
  const dialog = (title, body) => {
    document.querySelector('#dialog-content').innerHTML = `<h2 style="margin-top:6px">${title}</h2>${body}<p class="small muted" style="margin-top:20px">Primer podatkov · ${esc(periodLabel())} (${esc(periodRange())})</p>`;
    const d = document.querySelector('#dialog');
    if (!d.open) d.showModal();
  };
  const row = (a, b) => `<div class="detail-row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`;
  const svgIcon = (d, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    calc: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8 7h8M8 12h2M12 12h2M8 16h2M12 16h2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
    phone: '<path d="M6.6 3.5h2.6l1.4 4-2 1.4a12 12 0 0 0 6.5 6.5l1.4-2 4 1.4v2.6a2 2 0 0 1-2 2A16 16 0 0 1 4.6 5.5a2 2 0 0 1 2-2z"/>',
    pin: '<path d="M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z"/><circle cx="12" cy="10" r="2"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    bolt: '<path d="M13 2 5 13h6l-1 9 9-12h-6l1-8Z"/>',
    ruler: '<rect x="2.5" y="8" width="19" height="8" rx="2"/><path d="M6.5 8v3M10 8v4M13.5 8v3M17 8v4"/>',
    eye: '<path d="M2 12s3.7-5.5 10-5.5S22 12 22 12s-3.7 5.5-10 5.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/>'
  };

  // ---------- 1) Stranke zdaj vidijo + Stran prinesla
  const top = document.createElement('div');
  top.className = 'hv-cw';
  website.after(top);

  function valueData() {
    const d = datasets[period];
    const value = d.lead * AVG_LEAD_VALUE;
    const prevContacts = Math.max(1, d.contacts - d.delta);
    const prev = Math.round(value * prevContacts / d.contacts / 100) * 100;
    const change = prev ? Math.round((value - prev) / prev * 100) : 0;
    return { value, prev, change, weeks: split(value, [0.2, 0.26, 0.22, 0.32]), lead: d.lead };
  }
  function renderTop() {
    const s = settings();
    const [, m, day] = String(s.nextDate).split('-');
    const status = {
      open: ['Sprejemam', day ? `prost od ${Number(day)}. ${Number(m)}.` : 'nova dela', 'green'],
      urgent: ['Samo nujno', 'redna dela zasedena', 'amber'],
      vacation: ['Dopust', 'ne sprejemam novih del', 'grey']
    }[s.availability] || ['Sprejemam', 'nova dela', 'green'];
    const urgent = s.workEnabled.urgent !== false ? ['Nujna dela', 'Ljubljana', 'bolt', '#ffefeb', '#c2493a'] : ['Nujna dela', 'izklopljena', 'bolt', '#f1f2f6', '#8a93aa'];
    const visit = s.workEnabled.visit !== false ? [`Ogled ${VISIT_PRICE} €`, 'se odšteje', 'ruler', '#f2eeff', '#6c4fcf'] : ['Ogled', 'izklopljen', 'ruler', '#f1f2f6', '#8a93aa'];
    const tone = status[2];
    const statusTile = [status[0], status[1], 'check', { green: '#e8f7f0', amber: '#fff3e4', grey: '#f1f2f6' }[tone], { green: '#1f7a55', amber: '#a86a1f', grey: '#8a93aa' }[tone]];
    const tile = ([label, sub, icon, bg, ink]) => `<span class="hv-cs"><span>${svgIcon(ICONS[icon]).replace('<svg', `<svg style="stroke:${ink}"`)}</span><span><strong>${esc(label)}</strong><small>${esc(sub)}</small></span></span>`;
    const v = valueData();
    const max = Math.max(...v.weeks, 1);
    top.innerHTML = `
      <button type="button" class="hv-cw-top" data-hv="value" aria-label="Stran prinesla ${euro(v.value)} v povpraševanjih iz izračunov, prej ${euro(v.prev)}. Poglej podrobnosti">
        <span class="hv-cw-ic">${svgIcon(ICONS.calc)}</span>
        <span class="hv-cw-m"><small>Stran prinesla <i class="${v.change < 0 ? 'down' : ''}">${v.change >= 0 ? '+' : '−'}${Math.abs(v.change)} %</i></small><strong class="hv-eur">${euro(v.value)}</strong><span>iz izračunov · prej ${euro(v.prev)}</span></span>
        <span class="hv-cw-bars" aria-hidden="true">${v.weeks.map((w, i) => `<i style="height:${Math.max(18, w / max * 100)}%"${i === v.weeks.length - 1 ? ' class="on"' : ''}></i>`).join('')}</span>
      </button>
      <button type="button" class="hv-cw-cap" data-hv="status" aria-label="Stranke zdaj vidijo, odpri nastavitve">${svgIcon(ICONS.eye)}STRANKE ZDAJ VIDIJO</button>
      <div class="hv-cw-s" aria-label="Stranke zdaj vidijo: ${esc(status[0])}, ${esc(urgent[0])}, ${esc(visit[0])}">${tile(statusTile)}${tile(urgent)}${tile(visit)}</div>`;
    fitEuro();
  }
  function fitEuro() {
    requestAnimationFrame(() => {
      const el = top.querySelector('.hv-eur');
      if (!el || !el.clientWidth) return;
      el.style.fontSize = '';
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth + 1 && size > 20) { size -= 1; el.style.fontSize = `${size}px`; }
    });
  }

  // ---------- 2) Najbolj iskane storitve: mizarski primeri
  function mizarJobs(stats) {
    const side = stats.querySelector('.popular-jobs');
    if (!side) return;
    side.querySelectorAll('.popular-job span').forEach((el, i) => { if (JOBS[i]) el.textContent = JOBS[i]; });
    const counts = [...side.querySelectorAll('.popular-job strong')].map(n => Number(n.textContent));
    const leader = JOBS[counts.indexOf(Math.max(...counts))];
    const prev = datasets[period].previousJobs;
    const prevLeader = prev ? JOBS[prev.indexOf(Math.max(...prev))] : null;
    const p = side.querySelector('.popular-insight-copy p');
    if (p) p.innerHTML = prevLeader && prevLeader !== leader
      ? `<strong>${esc(leader)}</strong> je prehitela ${esc(JOBS_ACC[prevLeader] || prevLeader.toLocaleLowerCase('sl'))}.`
      : `<strong>${esc(leader)}</strong> je na vrhu zanimanja.`;
  }

  // ---------- 3) Od kod pridejo povpraševanja
  function placesCard() {
    const d = datasets[period];
    const s = settings();
    const counts = split(d.contacts, PLACE_WEIGHTS);
    const inArea = PLACES.map(p => s.cities.some(c => c.toLocaleLowerCase('sl') === p.toLocaleLowerCase('sl')));
    const shades = ['#7753d3', '#a987f5', '#c9b8f7'];
    let shade = 0;
    const colors = inArea.map(ok => ok ? shades[Math.min(shade++, shades.length - 1)] : '#f3a257');
    const outside = PLACES.filter((_, i) => !inArea[i] && counts[i] > 0);
    const card = document.createElement('section');
    card.className = 'card hv-places';
    card.setAttribute('aria-label', 'Od kod pridejo povpraševanja');
    card.innerHTML = `
      <div class="hv-places-head"><span class="hv-pin" aria-hidden="true">${svgIcon(ICONS.pin)}</span><h3>Od kod pridejo</h3><small>${d.contacts} ${noun(d.contacts)}</small></div>
      <div class="hv-share" role="img" aria-label="${PLACES.map((p, i) => `${p} ${counts[i]}`).join(', ')}">${PLACES.map((p, i) => counts[i] ? `<i class="${inArea[i] ? '' : 'out'}" style="flex:${counts[i]};--c:${colors[i]}"></i>` : '').join('')}</div>
      <div class="hv-place-chips">${PLACES.map((p, i) => `<span class="hv-place${inArea[i] ? '' : ' out'}"><i style="background:${colors[i]}"></i>${esc(p)}<b>${counts[i]}</b></span>`).join('')}</div>
      ${outside.length ? `<button type="button" class="hv-outside" data-hv="area"><span>${esc(outside.join(', '))} ni v vašem območju</span><b>Območje ›</b></button>` : ''}`;
    return card;
  }

  // ---------- 4) Orodja na strani (poudarjena kartica, trije zavihki)
  let toolTab = 0;
  function toolsData() {
    const k = scale(), r = n => Math.max(0, Math.round(n * k));
    const d = datasets[period];
    return [
      { say: 'Najraje odprejo <b>izračun kuhinje po meri</b>.', funnel: [d.opened, d.done, d.lead], labels: ['začelo izračun', 'dokončalo izračun', 'poslalo povpraševanje'],
        story: 'Najpogosteje načrtujejo <b>kuhinjo v obliki L</b>, običajno dolgo <em>3–4 m</em>.' },
      { say: 'Največ povpraševanj prinese <b>izračun vgradne omare</b>.', funnel: [r(26), r(17), r(8)], labels: ['začelo izračun', 'dokončalo izračun', 'poslalo povpraševanje'],
        story: 'Najpogosteje želijo <b>omaro do stropa</b>, široko <em>2–3 m</em>.' },
      { top: [['Izračun kuhinje', d.opened], ['Izračun omare', r(26)], ['Izračun stopnic', r(11)]] }
    ];
  }
  function toolsCard() {
    const data = toolsData()[toolTab];
    const tabs = ['Največkrat uporabljen', 'Največ povpraševanj', 'Top 3'];
    let body;
    if (data.top) {
      const max = Math.max(...data.top.map(t => t[1]), 1);
      body = `<div class="hv-t-top">${data.top.map(([name, n], i) => `<div class="hv-t-rank"><span class="hv-t-no">${i + 1}.</span><span class="hv-t-name">${esc(name)}<i><b style="width:${n / max * 100}%"></b></i></span><strong>${n}</strong><small>uporab</small></div>`).join('')}</div>`;
    } else {
      const [a, b, c] = data.funnel;
      const pct = a ? Math.round(b / a * 100) : 0;
      const every = c ? Math.max(1, Math.round(b / c)) : 0;
      body = `<div class="hv-t-say"><span class="hv-t-ico">${svgIcon(ICONS.calc)}</span><p>${data.say}</p></div>
        <div class="hv-t-body"><svg class="hv-t-fun" viewBox="0 0 120 82" role="img" aria-label="${a} začetih, ${b} dokončanih, ${c} povpraševanj"><defs>
          <linearGradient id="hvf1" x1="0" x2="1"><stop offset="0" stop-color="#7753d3"/><stop offset="1" stop-color="#a987f5"/></linearGradient>
          <linearGradient id="hvf2" x1="0" x2="1"><stop offset="0" stop-color="#a987f5"/><stop offset="1" stop-color="#c7b4f8"/></linearGradient>
          <linearGradient id="hvf3" x1="0" x2="1"><stop offset="0" stop-color="#5fc7a4"/><stop offset="1" stop-color="#9be3c8"/></linearGradient></defs>
          <path d="M4 1H116Q119 1 118 4L113 22Q112 24 109 24H11Q8 24 7 22L2 4Q1 1 4 1Z" fill="url(#hvf1)"/>
          <path d="M15 29H105Q108 29 107 32L102 50Q101 52 98 52H22Q19 52 18 50L13 32Q12 29 15 29Z" fill="url(#hvf2)"/>
          <path d="M26 57H94Q97 57 96 60L91 79Q90 81 87 81H33Q30 81 29 79L24 60Q23 57 26 57Z" fill="url(#hvf3)"/>
          <g font-family="-apple-system,Segoe UI,sans-serif" font-weight="800" text-anchor="middle" fill="#fff" font-size="14"><text x="60" y="17.5">${a}</text><text x="60" y="45.5">${b}</text><text x="60" y="74">${c}</text></g></svg>
          <div class="hv-t-lab"><div>${data.labels[0]}</div><div>${data.labels[1]} <b>${pct} %</b></div><div>${data.labels[2]} <b>${every ? `vsak ${every}.` : '—'}</b></div></div></div>
        <div class="hv-t-bub"><img src="jezomir-palec-gor.png" alt=""><p>${data.story}</p></div>`;
    }
    const card = document.createElement('article');
    card.className = 'hv-tools';
    card.innerHTML = `<div class="hv-t-in"><div class="hv-t-head"><div class="hv-t-title"><h3>Kako obiskovalci uporabljajo orodja</h3><button type="button" data-hv="tools-all">Vsa ›</button></div>
      <div class="hv-t-tabs" role="tablist" aria-label="Pregled uporabe orodij">${tabs.map((t, i) => `<button type="button" role="tab" data-hv-tool="${i}" aria-selected="${i === toolTab}" class="${i === toolTab ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      <div class="hv-t-panel" role="tabpanel">${body}</div></div>`;
    return card;
  }

  // ---------- 5) Obisk spletne strani (tri številke + črtni graf)
  function curve(values, w, h, top) {
    const pts = values.map((v, i) => [5 + i / (values.length - 1) * (w - 10), h - 6 - v / top * (h - 14)]);
    return pts.slice(1).reduce((path, point, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[i], d = pts[Math.min(pts.length - 1, i + 2)];
      return `${path} C${(b[0] + (point[0] - a[0]) / 6).toFixed(1)} ${(b[1] + (point[1] - a[1]) / 6).toFixed(1)},${(point[0] - (d[0] - b[0]) / 6).toFixed(1)} ${(point[1] - (d[1] - b[1]) / 6).toFixed(1)},${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
    }, `M${pts[0][0]} ${pts[0][1].toFixed(1)}`);
  }
  function visitsCard() {
    const d = datasets[period];
    const prevVisits = Math.max(0, Math.round(d.visits / (1 + d.visitDelta / 100)));
    const month = typeof period === 'string' ? monthDates.find(date => monthKey(date) === period) : null;
    const days = month ? new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() : period;
    const start = month ? new Date(month.getFullYear(), month.getMonth(), 1) : new Date(today);
    if (!month) start.setDate(start.getDate() - days + 1);
    const priorStart = month ? new Date(month.getFullYear(), month.getMonth() - 1, 1) : new Date(start);
    if (!month) priorStart.setDate(priorStart.getDate() - days);
    const dayDate = (index, previous = false) => {
      const date = new Date(previous ? priorStart : start);
      const day = previous && month ? Math.min(index + 1, new Date(priorStart.getFullYear(), priorStart.getMonth() + 1, 0).getDate()) : index + 1;
      date.setDate(date.getDate() + day - 1);
      return date.toLocaleDateString('sl-SI', { day: 'numeric', month: 'numeric' });
    };
    const weights = (length, offset) => Array.from({ length }, (_, i) => 8 + 1.6 * Math.sin(i * .22 + offset) + .55 * Math.sin(i * .48 + offset) + i / length * 3);
    const curWeights = weights(days, 0), prevWeights = weights(days, .7);
    const cur = visitsCompare ? split(d.visits, curWeights) : split(d.visits, [5, 6, 5.5, 8, 9, 8.5, 11, 12, 13]);
    const prev = visitsCompare ? split(prevVisits, prevWeights) : split(prevVisits, [5, 5.2, 6, 7, 8.5, 8, 9, 10.5, 11]);
    const curWeightTotal = curWeights.reduce((a, b) => a + b, 0), prevWeightTotal = prevWeights.reduce((a, b) => a + b, 0);
    const curPlot = visitsCompare ? curWeights.map(v => v * d.visits / curWeightTotal) : cur;
    const prevPlot = visitsCompare ? prevWeights.map(v => v * prevVisits / prevWeightTotal) : prev;
    const top = Math.max(...curPlot, ...prevPlot, 1);
    const W = 320, H = 110;
    const line = curve(curPlot, W, H, top), pline = curve(prevPlot, W, H, top);
    const label = typeof period === 'string' ? ['ta mesec', 'prejšnji mesec'] : period === 30 ? ['zadnjih 30 dni', 'prejšnjih 30 dni'] : ['zadnji 3 meseci', 'prejšnji 3 meseci'];
    const compareLabel = month ? `Primerjava za ${monthShortLabel(month)}` : period === 30 ? 'Primerjava zadnjih 30 dni' : 'Primerjava zadnjih 3 mesecev';
    const axis = typeof period === 'string' ? ['1. dan', '15. dan', 'konec meseca'] : period === 30 ? ['1. dan', '15. dan', '30. dan'] : ['1. mesec', '2. mesec', '3. mesec'];
    const card = document.createElement('section');
    card.className = 'card hv-visits';
    card.innerHTML = `<div class="hv-v-head"><h3>Obisk spletne strani</h3><button type="button" class="hv-v-compare" aria-pressed="${visitsCompare}">${esc(compareLabel)}</button></div>
      <div class="hv-kpi">
        <button type="button" data-modal="visits">${visitsCompare ? `<span class="hv-kpi-pair"><b class="before">${prevVisits}</b><i></i><b class="now">${d.visits}</b></span>` : `<strong>${d.visits}<em class="${d.visitDelta < 0 ? 'down' : ''}">${d.visitDelta >= 0 ? '+' : '−'}${Math.abs(d.visitDelta)} %</em></strong>`}<small><i style="background:#7753d3"></i>obiskovalcev</small></button>
        <button type="button" data-modal="rate"><strong>${esc(d.rate)} %</strong><small><i style="background:#a987f5"></i>pošlje povpr.</small></button>
        <button type="button" data-modal="calls"><strong>${d.clicks}</strong><small><i style="background:#5b8ef0"></i>klikov na tel.</small></button>
      </div>
      <svg class="hv-v-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="slider" tabindex="0" aria-label="Primerjava obiska" aria-valuemin="1" aria-valuemax="${cur.length}" aria-valuenow="${cur.length}"><defs>
        <linearGradient id="hvva" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a987f5" stop-opacity=".32"/><stop offset="1" stop-color="#a987f5" stop-opacity="0"/></linearGradient>
        <linearGradient id="hvvl" x1="0" x2="1"><stop offset="0" stop-color="#a987f5"/><stop offset="1" stop-color="#7753d3"/></linearGradient></defs>
        <path d="M0 ${H * .25}H${W}M0 ${H * .6}H${W}M0 ${H - 1}H${W}" stroke="#eef0f6" stroke-width="1"/>
        <path d="${pline}" fill="none" stroke="#78aee9" stroke-width="2.5" stroke-dasharray="4 5" vector-effect="non-scaling-stroke"/>
        <path d="${line} V${H} H5Z" fill="url(#hvva)"/>
        <path d="${line}" fill="none" stroke="url(#hvvl)" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <ellipse class="hv-v-point cur" cx="${W - 5}" cy="${H - 6 - curPlot.at(-1) / top * (H - 14)}" rx="4.5" ry="6"/>
        <ellipse class="hv-v-point prev" cx="${W - 5}" cy="${H - 6 - prevPlot.at(-1) / top * (H - 14)}" rx="4.5" ry="6"/></svg>
      <div class="hv-v-axis">${axis.map(a => `<span>${a}</span>`).join('')}</div>
      <div class="hv-v-legend" role="status" aria-live="polite"><span class="hv-v-before"><i></i><span class="hv-v-name" data-hv-previous-date>${esc(label[1])}</span><strong data-hv-previous>${prev.at(-1)}</strong></span><span class="hv-v-now"><i></i><span class="hv-v-name" data-hv-current-date>${esc(label[0])}</span><strong data-hv-current>${cur.at(-1)}</strong></span></div>`;
    const chart = card.querySelector('.hv-v-chart');
    const points = card.querySelectorAll('.hv-v-point');
    const currentValue = card.querySelector('[data-hv-current]');
    const previousValue = card.querySelector('[data-hv-previous]');
    const currentDate = card.querySelector('[data-hv-current-date]');
    const previousDate = card.querySelector('[data-hv-previous-date]');
    const updatePoint = index => {
      const i = Math.max(0, Math.min(cur.length - 1, index));
      const x = 5 + i / (cur.length - 1) * (W - 10);
      [curPlot, prevPlot].forEach((values, n) => {
        points[n].setAttribute('cx', x);
        points[n].setAttribute('cy', H - 6 - values[i] / top * (H - 14));
      });
      currentValue.textContent = cur[i];
      previousValue.textContent = prev[i];
      if (visitsCompare) {
        currentDate.textContent = `Zdaj · ${dayDate(i)}`;
        previousDate.textContent = `Prej · ${dayDate(i, true)}`;
      }
      chart.setAttribute('aria-valuenow', i + 1);
      chart.setAttribute('aria-valuetext', visitsCompare
        ? `${dayDate(i)}: ${cur[i]} obiskov; ${dayDate(i, true)}: ${prev[i]} obiskov`
        : `${label[0]}: ${cur[i]} obiskov; ${label[1]}: ${prev[i]} obiskov`);
    };
    const pointFromPointer = e => {
      const rect = chart.getBoundingClientRect();
      updatePoint(Math.round(((e.clientX - rect.left) / rect.width * W - 5) / (W - 10) * (cur.length - 1)));
    };
    chart.addEventListener('pointerdown', e => { chart.setPointerCapture(e.pointerId); pointFromPointer(e); });
    chart.addEventListener('pointermove', pointFromPointer);
    chart.addEventListener('keydown', e => {
      const i = Number(chart.getAttribute('aria-valuenow')) - 1;
      const next = e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowRight' ? i + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? cur.length - 1 : null;
      if (next !== null) { e.preventDefault(); updatePoint(next); }
    });
    card.querySelector('.hv-v-compare').addEventListener('click', () => {
      visitsCompare = !visitsCompare;
      card.replaceWith(visitsCard());
    });
    updatePoint(cur.length - 1);
    return card;
  }

  // ---------- 6) Zadnje aktivnosti (seznam treh)
  const ACTS = [
    ['calc', '#f0edff', '#7753d3', 'Nov izračun', 'Kuhinja · 3,6 m', 'pred 12 min', 'Izračun kuhinje', [['Storitev', 'Kuhinja po meri'], ['Oblika', 'L'], ['Dolžina', '3,6 m'], ['Okvirna vrednost', '5.200 €']]],
    ['mail', '#fff1de', '#e0761d', 'Novo povpraševanje', 'Vgradna omara v spalnici', 'pred 1 h', 'Povpraševanje iz Domžal', null],
    ['phone', '#e8f0fe', '#5b8ef0', 'Klic s strani', 'Domžale', 'včeraj', 'Klik na telefon', [['Kraj', 'Domžale'], ['Čas', 'včeraj, 16.42'], ['Vir', 'gumb Pokliči na strani']]]
  ];
  function activityCard() {
    const month = typeof period === 'string';
    const card = document.createElement('section');
    card.className = 'card hv-acts';
    card.innerHTML = `<div class="hv-v-head"><h3>Zadnje aktivnosti</h3><button type="button" data-hv="acts-all">Vse ›</button></div>
      ${ACTS.map((a, i) => `<button type="button" class="hv-act" data-hv-act="${i}"><span style="background:${a[1]}">${svgIcon(ICONS[a[0]]).replace('<svg', `<svg style="stroke:${a[2]}"`)}</span><span class="hv-act-copy"><strong>${esc(a[3])}</strong><small>${esc(a[4])}</small></span><time>${esc(month ? activityTime(i === 0) : a[5])}</time></button>`).join('')}`;
    return card;
  }

  // ---------- Obdobje: 30 dni / 3 meseci / Mesec ▾
  document.querySelectorAll('.period [data-period]').forEach(b => {
    b.textContent = b.dataset.period === '30' ? '30 dni' : b.dataset.period === '90' ? '3 meseci' : b.textContent;
  });
  const baseUpdatePeriod = updatePeriodContext;
  updatePeriodContext = function () {
    baseUpdatePeriod();
    const pick = document.querySelector('[data-pick-month]');
    const month = selectedMonth && monthDates.find(date => monthKey(date) === selectedMonth);
    pick.querySelector('span').textContent = typeof period === 'string' && month ? monthLabel(month).replace(/ \d{4}$/, '') : 'Mesec';
  };

  // ---------- Razširitev render()
  const baseRender = render;
  render = function () {
    baseRender();
    renderTop();
    const stats = document.querySelector('#stats');
    mizarJobs(stats);
    stats.querySelectorAll('.search-insights .search-queries li > span:last-child').forEach((el, i) => { if (SEARCHES[i]) el.textContent = SEARCHES[i]; });
    const grid = stats.querySelector('.overview-grid');
    const search = stats.querySelector('.search-insights');
    stats.querySelectorAll('.tools-widget, .trend-card, #stats > h2, .activity-pair').forEach(el => { el.hidden = true; });
    const places = placesCard(), tools = toolsCard();
    grid?.after(places);
    places.after(search || tools);
    if (search) search.after(tools);
    const visits = visitsCard();
    tools.after(visits);
    visits.after(activityCard());
  };

  // ---------- Dogodki
  document.addEventListener('click', e => {
    const tool = e.target.closest('[data-hv-tool]');
    if (tool) {
      toolTab = Number(tool.dataset.hvTool);
      const old = document.querySelector('#stats .hv-tools');
      const next = toolsCard();
      old.replaceWith(next);
      next.querySelector(`[data-hv-tool="${toolTab}"]`).focus({ preventScroll: true });
      return;
    }
    const act = e.target.closest('[data-hv-act]');
    if (act) {
      const a = ACTS[Number(act.dataset.hvAct)];
      dialog(a[6], a[7] ? a[7].map(([k, v]) => row(k, v)).join('')
        : '<p>Zanima me vgradna omara v spalnici, do stropa, širine približno 2,6 m. Prosim za okvirno ponudbo.</p><p class="muted">Odgovorite v delu s strankami.</p>');
      return;
    }
    const b = e.target.closest('[data-hv]');
    if (!b) return;
    const kind = b.dataset.hv;
    if (kind === 'status') openSettings('#wt-availability');
    else if (kind === 'area') openSettings('.wt-work-widget');
    else if (kind === 'tools-all') {
      const t = toolsData()[2].top;
      dialog('Orodja na strani', t.map(([n, c]) => row(n, `${c} uporab`)).join('') + row('Povpraševanj iz izračunov', datasets[period].lead) + '<p class="muted">Največ izračunov je za kuhinje po meri.</p>');
    }
    else if (kind === 'acts-all') dialog('Zadnje aktivnosti', ACTS.map(a => row(`${a[3]} · ${a[4]}`, a[5])).join(''));
    else if (kind === 'value') {
      const v = valueData();
      dialog('Stran prinesla', row('Povpraševanja iz izračunov', v.lead) + row('Povprečna vrednost', euro(AVG_LEAD_VALUE)) + row('Skupaj', euro(v.value)) + row('Prejšnje obdobje', euro(v.prev)) +
        '<p class="muted">Seštevek okvirnih zneskov iz izračunov, ki so jih stranke poslale skupaj s povpraševanjem. Končna cena se lahko razlikuje.</p>');
    }
  });
  // Tipkovnica v zavihkih orodij.
  document.addEventListener('keydown', e => {
    const tool = e.target.closest?.('[data-hv-tool]');
    if (!tool || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const next = (toolTab + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
    document.querySelector(`#stats [data-hv-tool="${next}"]`)?.click();
  });
  // Ko se obrtnik vrne iz nastavitev, osveži stanje.
  document.addEventListener('click', e => {
    if (e.target.closest('.dock [data-tab="Splošno"]')) setTimeout(() => render(), 0);
  });
  window.addEventListener('storage', e => { if (e.key === SETTINGS_KEY) render(); });
  window.addEventListener('resize', fitEuro);

  updatePeriodContext();
  render();
})();
