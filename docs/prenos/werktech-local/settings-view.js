(() => {
  const main = document.querySelector('.app-scroll > main');
  const scroller = document.querySelector('.app-scroll');
  const dock = document.querySelector('.dock');
  if (!main || !scroller || !dock) return;

  const key = 'werktech-settings-page-v1';
  const defaults = {
    phone: '041 555 210', phoneOn: true, email: 'info@mizarstvo-novak.si', whatsappOn: true,
    radius: 3, cities: ['Ljubljana', 'Domžale', 'Kamnik'],
    days: [true, true, true, true, true, false, false], from: '07:00', to: '16:00',
    availability: 'open', accepted: 'Kuhinje, omare', nextDate: '2026-10-06', notice: '',
    workDistances: { urgent: 10, visit: 20, regular: 30, large: 80 },
    workEnabled: { urgent: true, visit: true, regular: true, large: true },
    services: [
      { name: 'Kuhinje po meri', mode: 'from', amount: 3900, max: 0, unit: '' },
      { name: 'Omare po meri', mode: 'inquiry', amount: 0, max: 0, unit: '' },
      { name: 'Montaža kuhinje', mode: 'inquiry', amount: 0, max: 0, unit: '' },
      { name: 'Izris pohištva', mode: 'from', amount: 40, max: 0, unit: '' }
    ],
    projects: [
      { id: 'sample-1', title: 'Projekt 1', image: 'website-glass.png', published: true },
      { id: 'sample-2', title: 'Projekt 2', image: 'website-glass-left.png', published: true }
    ],
    formOn: true, formRecipient: 'info@mizarstvo-novak.si',
    replyMethods: ['phone', 'email', 'whatsapp'],
    modules: { calculator: true, gallery: true, reviews: false, notice: false },
    faqs: [
      { question: 'Ali je možen ogled?', answer: '' },
      { question: 'Kje opravljate delo?', answer: '' },
      { question: 'Kdaj lahko pričakujem odgovor?', answer: '' }
    ]
  };
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) {}
  const state = {
    ...defaults, ...stored,
    cities: Array.isArray(stored.cities) ? stored.cities : defaults.cities,
    days: Array.isArray(stored.days) && stored.days.length === 7 ? stored.days : defaults.days,
    services: Array.isArray(stored.services) ? stored.services : defaults.services,
    projects: Array.isArray(stored.projects) ? stored.projects : defaults.projects,
    faqs: Array.isArray(stored.faqs) ? stored.faqs : defaults.faqs,
    modules: { ...defaults.modules, ...stored.modules },
    workDistances: { ...defaults.workDistances, ...(stored.workDistances && typeof stored.workDistances === 'object' ? stored.workDistances : {}) },
    workEnabled: { ...defaults.workEnabled, ...(stored.workEnabled && typeof stored.workEnabled === 'object' ? stored.workEnabled : {}) }
  };
  // Status C »Kaj trenutno sprejemam«: podrobno stanje komponente UJDosegljivost.
  // Obstoječa izbira state.availability se ob prvem nalaganju prenese v novo stanje in se ohranja za začetno stran.
  if (!state.dosegljivost || typeof state.dosegljivost !== 'object') {
    state.dosegljivost = { on: { open: { a: true, b: false, c: false }, urgent: { a: false, b: true, c: false }, vacation: { a: false, b: false, c: true } }[state.availability] || { a: true, b: false, c: false } };
  }
  let availabilityFocus = '';
  let panel = '';
  let view = 'settings';
  let edit = '';
  let message = '';
  const workMotionTimers = new WeakMap();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const save = () => {
    try { localStorage.setItem(key, JSON.stringify(state)); message = 'Spremembe so shranjene v tem brskalniku.'; return true; }
    catch (_) { message = 'Shranjevanje ni uspelo. Preveri prostor v brskalniku.'; return false; }
  };
  const distance = () => ['Samo kraj', 'do 10 km', 'do 20 km', 'do 30 km', 'do 50 km', 'do 100 km', 'Vsa Slovenija'][state.radius] || 'do 30 km';
  const timeSummary = () => {
    const days = state.days.map((on, i) => on ? i : -1).filter(i => i >= 0);
    const label = days.length === 5 && days.every((d, i) => d === i) ? 'pon–pet' : days.length === 7 ? 'vse dni' : days.length ? days.map(i => ['po', 'to', 'sr', 'če', 'pe', 'so', 'ne'][i]).join(', ') : 'po dogovoru';
    return `${label} · ${state.from.replace(/^0/, '')}–${state.to.replace(/^0/, '')}`;
  };
  const statusText = () => ({ open: 'Sprejemam naročila', urgent: 'Samo nujno', vacation: 'Na dopustu' })[state.availability];
  const formatAmount = value => String(Math.max(0, Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const price = service => {
    const n = formatAmount(service.amount);
    if (service.mode === 'inquiry') return 'Po povpraševanju';
    if (service.mode === 'range') return `${n}–${formatAmount(service.max)} €`;
    if (service.mode === 'unit') return `${n} € / ${service.unit || 'enoto'}`;
    return `od ${n} €`;
  };
  const moduleCount = () => [state.modules.calculator, state.modules.gallery, state.modules.reviews, state.whatsappOn, state.modules.notice].filter(Boolean).length;
  const incompleteCount = () => Number(state.projects.filter(p => p.published).length < 3) + Number(state.faqs.some(f => !f.answer.trim()));
  const screen = document.createElement('section');
  screen.id = 'settings-view';
  screen.className = 'settings-screen';
  screen.hidden = true;
  screen.setAttribute('aria-label', 'Nastavitve spletne strani');
  main.after(screen);
  const icon = (name, color = '') => {
    const paths = {
      phone: '<path d="M5.5 3.5h3l2.1 4.7-2 1.8a15 15 0 0 0 5.4 5.4l1.8-2 4.7 2.1v3a2 2 0 0 1-2.2 2C9.7 19.8 4.2 14.3 3.5 5.7a2 2 0 0 1 2-2.2Z"/>',
      whatsapp: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.7a8.5 8.5 0 1 1 15.6-4.3Z"/><path d="m9 8.5 1.3-.3 1 2-1 1c.7 1.3 1.7 2.3 3 3l1-1 2 1-.3 1.3c-.2.8-1 1.1-1.8.9-2.9-.8-5.2-3.1-6-6-.2-.8.1-1.6.8-1.9Z"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
      eye: '<path d="M2 12s3.7-5.5 10-5.5S22 12 22 12s-3.7 5.5-10 5.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/>',
      pin: '<path d="M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z"/><circle cx="12" cy="10" r="2"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
      bolt: '<path d="M13 2 5 13h6l-1 9 9-12h-6l1-8Z"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
      wrench: '<path d="M20 7.5a5 5 0 0 1-6.5 6.5L7 20.5a2 2 0 0 1-2.8-2.8l6.5-6.5A5 5 0 0 1 17.2 4L14 7.2l2.8 2.8L20 7.5Z"/>',
      house: '<path d="m3 10 9-7 9 7v10h-7v-6h-4v6H3V10Z"/>'
    };
    return `<span class="wt-icon ${color}"><svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg></span>`;
  };
  const switchButton = (name, on, label) => `<button type="button" class="wt-switch" data-action="${name}" aria-label="${esc(label)}" aria-pressed="${Boolean(on)}"></button>`;
  const namedRow = (name, value, iconName, action, control = '') => `<div class="wt-contact-row" id="wt-${name}">${icon(iconName, iconName === 'mail' ? 'blue' : 'mint')}<div class="wt-row-copy"><span>${esc(name)}</span><strong data-fit>${esc(value)}</strong></div>${action ? `<button type="button" class="wt-pencil" data-action="${action}" aria-label="Uredi ${esc(name)}">✎</button>` : ''}${control}</div>`;
  const photo = (src, label) => `<img src="${esc(src)}" alt="${esc(label)}">`;
  const contact = () => {
    const tile = (label, status, symbol, active, action) => `<button type="button" class="wt-channel ${active ? 'is-on' : ''}" data-action="${action}" aria-label="${esc(label)}: ${esc(status)}">
      ${icon(symbol)}<strong data-fit>${esc(label)}</strong><small data-fit>${esc(status)}</small></button>`;
    return `<section class="wt-contact-module" aria-labelledby="wt-module-title">
      <div class="wt-module-title"><span class="wt-module-number">1</span><h2 id="wt-module-title">Kako me dosežejo</h2><span class="wt-module-hint">Tapni ploščico</span></div>
      <div class="wt-channel-grid">
        ${tile('Telefon', state.phoneOn ? 'vklop' : 'izklop', 'phone', state.phoneOn, 'edit-phone')}
        ${tile('WhatsApp', state.whatsappOn ? 'vklop' : 'izklop', 'whatsapp', state.whatsappOn, 'toggle-whatsapp')}
        ${tile('E-pošta', 'izklop', 'mail', false, 'edit-email')}
        ${tile('Naslov', 'samo kraj', 'eye', false, 'address-info')}
      </div>
      ${edit === 'phone' || edit === 'email' ? `<form class="wt-inline-editor wt-module-editor" data-form="${edit}"><label>${edit === 'phone' ? 'Telefonska številka' : 'E-pošta'}<input name="value" type="${edit === 'phone' ? 'tel' : 'email'}" value="${esc(edit === 'phone' ? state.phone : state.email)}" maxlength="120" required></label>${edit === 'phone' ? switchButton('toggle-phone', state.phoneOn, 'Prikaži telefon') : ''}<button type="submit">Shrani</button><button type="button" data-action="cancel-edit">Prekliči</button></form>` : ''}
      ${edit === 'address' ? '<p class="wt-module-editor">Strankam je trenutno prikazan samo kraj.</p>' : ''}
    </section>`;
  };
  const reach = () => `<section class="wt-card wt-reach" aria-label="Kontaktni čas in območje dela">
    <div class="wt-reach-part" id="wt-time"><div class="wt-section-head">${icon('clock', 'violet')}<span><strong>Kontaktni čas</strong><small>Stranke vedo, kdaj me lahko kontaktirajo</small></span></div>
      <div class="wt-days" role="group" aria-label="Dnevi za stik">${['Po', 'To', 'Sr', 'Če', 'Pe', 'So', 'Ne'].map((d, i) => `<button type="button" data-day="${i}" class="${state.days[i] ? 'active' : ''}" aria-pressed="${state.days[i]}">${d}</button>`).join('')}</div>
      <div class="wt-times"><label>Od<input type="time" data-time="from" value="${esc(state.from)}"></label><label>Do<input type="time" data-time="to" value="${esc(state.to)}"></label></div>
    </div>
    <div class="wt-reach-part" id="wt-area"><div class="wt-section-head">${icon('pin', 'violet')}<span><strong>Območje dela</strong><small>Stranke me najdejo v tem območju</small></span></div>
      <div class="wt-radius"><input type="range" min="0" max="6" step="1" value="${state.radius}" aria-label="Obseg območja dela"><strong id="wt-radius-value">${esc(distance())}</strong></div>
      <div class="wt-cities">${state.cities.map(city => `<span class="wt-city"><span data-fit>${esc(city)}</span><button type="button" data-remove-city="${esc(city)}" aria-label="Odstrani ${esc(city)}">×</button></span>`).join('')}<button type="button" class="wt-add-city" data-action="add-city">+ Dodaj kraj</button></div>
      ${edit === 'city' ? `<form class="wt-inline-editor" data-form="city"><label>Dodaj kraj<input name="value" maxlength="60" required></label><button type="submit">Dodaj</button><button type="button" data-action="cancel-edit">Prekliči</button></form>` : ''}
    </div>
  </section>`;
  const availability = () => `<section class="wt-availability wt-dstat" id="wt-availability" aria-label="Kaj trenutno sprejemam"><div id="wt-dosegljivost"></div></section>`;
  const mountAvailability = () => {
    const host = screen.querySelector('#wt-dosegljivost');
    if (!host || !window.UJDosegljivost) return;
    window.UJDosegljivost.mount(host, {
      load: () => state.dosegljivost,
      save: next => {
        state.dosegljivost = next;
        state.availability = next.on.c ? 'vacation' : next.on.a ? 'open' : 'urgent';
        save();
      },
      focus: availabilityFocus,
      onFocusChange: k => { availabilityFocus = k; }
    });
  };
  const workArea = () => {
    const van = (km, color) => {
      return `<span class="wt-work-van wt-work-van-side" role="img" aria-label="Ilustriran kombi, ${km} kilometrov"><img src="van-side-${color}.svg" alt="" decoding="async"><span class="wt-work-wheel wt-work-wheel-back" aria-hidden="true"></span><span class="wt-work-wheel wt-work-wheel-front" aria-hidden="true"></span><span class="wt-work-headlight wt-work-headlight-near" aria-hidden="true"></span><span class="wt-work-signal wt-work-signal-near" aria-hidden="true"></span><span class="wt-work-signal wt-work-signal-rear" aria-hidden="true"></span><span class="wt-work-brakelight" aria-hidden="true"></span></span>`;
    };
    const rows = [
      ['urgent', 'red', '#ec5c69', 'Nujno', 'bolt'],
      ['visit', 'green', '#24ae85', 'Ogled', 'clock'],
      ['regular', 'violet', '#8057dc', 'Običajno', 'wrench'],
      ['large', 'blue', '#347de6', 'Večja dela', 'house']
    ];
    return `<section class="wt-work-widget" aria-labelledby="wt-work-title">
      <div class="wt-work-heading"><h2 id="wt-work-title">Kje in kaj delam</h2><span>Tapni vrsto dela</span></div>
      <div class="wt-work-card"><div class="wt-work-card-heading"><h3>Kako daleč grem</h3><span>Povleci kombi</span></div>
        <div class="wt-work-rows">${rows.map(([id, color, accent, title, symbol]) => { const distance = Math.max(0, Math.min(9999, Math.round(Number(state.workDistances[id]) || 0))); const km = Math.min(80, distance); const enabled = state.workEnabled[id] !== false; return `<div class="wt-work-row wt-work-${id}${enabled ? '' : ' is-off'}" style="--work-accent:${accent}">
          <div class="wt-work-reach"><span class="wt-work-km" data-fit><span class="wt-work-km-number" data-digits="${String(distance).length}">${distance}</span> km</span><div class="wt-work-track"><span class="wt-work-progress"></span><span class="wt-work-smoke" aria-hidden="true"><i></i><i></i><i></i></span>${van(distance, color)}<input class="wt-work-slider" type="range" min="0" max="80" step="1" value="${km}" data-work-distance="${id}" aria-label="${title}: oddaljenost v kilometrih"${enabled ? '' : ' disabled'}><label class="wt-work-extra"${km < 80 ? ' hidden' : ''}><span class="wt-work-extra-copy"><span>Vpišite koliko</span><span>km ročno</span></span><input type="number" inputmode="numeric" min="81" max="9999" step="1" value="${distance > 80 ? distance : ''}" placeholder="km" data-work-extra="${id}" aria-label="${title}: vpišite razdaljo nad 80 kilometrov"${enabled ? '' : ' disabled'}></label></div></div>
          <button type="button" class="wt-work-label" data-work-toggle="${id}" aria-pressed="${enabled}" aria-label="${title}: ${enabled ? 'vklopljeno' : 'izklopljeno'}"><span class="wt-work-symbol">${icon(symbol)}</span><span class="wt-work-copy"><strong data-fit>${title}</strong><small data-fit>${enabled ? 'Vklopljeno' : 'Izklopljeno'}</small></span></button>
        </div>`; }).join('')}</div>
      </div>
    </section>`;
  };
  const updateWorkRow = input => {
    const track = input.closest('.wt-work-track');
    const width = track.clientWidth;
    if (!width) return;
    const km = Math.max(0, Math.min(80, Number(input.value) || 0));
    const distance = km === 80 ? Math.min(9999, Math.max(km, Number(state.workDistances[input.dataset.workDistance]) || km)) : km;
    const lineEnd = 2 + Math.max(0, width - 2) * km / 80;
    track.style.setProperty('--work-van-left', `${lineEnd - 8}px`);
    track.style.setProperty('--work-line-width', km ? `${Math.min(width, lineEnd)}px` : '0px');
    const number = track.closest('.wt-work-reach').querySelector('.wt-work-km-number');
    number.textContent = distance;
    number.dataset.digits = String(distance).length;
    track.querySelector('.wt-work-van').setAttribute('aria-label', `Ilustriran kombi, ${distance} kilometrov`);
    const extra = track.querySelector('.wt-work-extra');
    extra.hidden = km < 80;
    const extraInput = extra.querySelector('input');
    if (document.activeElement !== extraInput) extraInput.value = distance > 80 ? String(distance) : '';
  };
  const stopWorkRow = track => {
    clearTimeout(workMotionTimers.get(track));
    const reversing = track.classList.contains('is-reversing');
    track.classList.remove('is-driving', 'is-reversing');
    track.classList.toggle('is-signaling', reversing);
    track.classList.add('is-braking');
    workMotionTimers.set(track, setTimeout(() => track.classList.remove('is-braking', 'is-signaling'), 620));
  };
  const animateWorkRow = input => {
    const track = input.closest('.wt-work-track');
    const previous = Number(input.dataset.previous ?? input.defaultValue);
    const current = Number(input.value);
    input.dataset.previous = String(current);
    if (current === previous) return;
    track.classList.remove('is-braking', 'is-signaling');
    track.classList.toggle('is-reversing', current < previous);
    track.classList.add('is-driving');
    clearTimeout(workMotionTimers.get(track));
    workMotionTimers.set(track, setTimeout(() => stopWorkRow(track), 450));
  };
  const updateWorkRows = () => screen.querySelectorAll('.wt-work-slider').forEach(updateWorkRow);
  const contentCards = () => {
    const cards = [
      ['services', '3', 'Storitve in cene', `${state.services.length} storitve · vidno v kalkulatorju`, 'Urejeno'],
      ['projects', '4', 'Izvedeni projekti', `${state.projects.filter(p => p.published).length} projekta · dodajte več primerov`, 'Dopolni'],
      ['form', '5', 'Kontaktni obrazec', `Obvestila na ${state.formRecipient}`, state.formOn ? 'Deluje' : 'Skrito'],
      ['faq', '6', 'Kratki odgovori', 'Ogled · območje · odzivni čas', state.faqs.every(f => f.answer.trim()) ? 'Urejeno' : 'Dopolni']
    ];
    return `<section class="wt-content" id="wt-content"><h2>Vsebina strani</h2><div class="wt-content-grid">${cards.map(([id, n, title, desc, badge]) => `<button type="button" class="wt-content-card wt-${id} ${panel === id ? 'selected' : ''}" data-panel="${id}" aria-expanded="${panel === id}">
      <div class="wt-card-art">${id === 'projects' ? state.projects.filter(p => p.published).slice(0, 2).map(p => photo(p.image, p.title)).join('') : id === 'services' ? `<span>Kuhinje po meri<br><b>${esc(price(state.services[0]))}</b></span>` : id === 'modules' ? '<span>Kalkulator　 ●<br>Ocene　　　 ●</span>' : id === 'form' ? '<span class="wt-form-lines">━━━<br>━━━━<br>━━</span>' : '<span>Ogled · območje<br>odzivni čas</span>'}</div>
      <strong><em>${n}</em>${title}</strong><small data-fit>${esc(desc)}</small><span class="wt-card-bottom"><i>${esc(badge)}</i><span aria-hidden="true">›</span></span>
    </button>`).join('')}</div>${panel ? editorPanel() : ''}</section>`;
  };
  const editorPanel = () => {
    if (panel === 'services') return `<div class="wt-panel" id="wt-panel"><h3>Storitve in prikazane cene</h3><form data-form="services">${state.services.map((service, i) => `<div class="wt-service-edit"><strong>${esc(service.name)}</strong><select name="mode-${i}" aria-label="Prikaz cene za ${esc(service.name)}"><option value="from" ${service.mode === 'from' ? 'selected' : ''}>Cena od</option><option value="range" ${service.mode === 'range' ? 'selected' : ''}>Razpon</option><option value="unit" ${service.mode === 'unit' ? 'selected' : ''}>Cena na enoto</option><option value="inquiry" ${service.mode === 'inquiry' ? 'selected' : ''}>Po povpraševanju</option></select><input type="number" name="amount-${i}" value="${Number(service.amount || 0)}" min="0" step="1" aria-label="Cena za ${esc(service.name)}"><input type="number" name="max-${i}" value="${Number(service.max || 0)}" min="0" step="1" aria-label="Zgornja meja za ${esc(service.name)}"><input name="unit-${i}" value="${esc(service.unit || '')}" maxlength="24" placeholder="Enota, npr. m²" aria-label="Enota za ${esc(service.name)}"></div>`).join('')}<button class="wt-save" type="submit">Shrani cene</button></form><p>To so prikazane cene v lokalnem predogledu.</p></div>`;
    if (panel === 'projects') return `<div class="wt-panel" id="wt-panel"><h3>Izvedeni projekti</h3><form data-form="projects"><div class="wt-projects">${state.projects.map((p, i) => `<div class="wt-project-edit">${photo(p.image, p.title)}<label>Ime projekta<input name="title-${i}" value="${esc(p.title)}" maxlength="80" required></label><label>Kratek opis<textarea name="description-${i}" maxlength="180">${esc(p.description || '')}</textarea></label><label>Storitev<input name="service-${i}" value="${esc(p.service || '')}" maxlength="80"></label><label>Okvirna lokacija<input name="location-${i}" value="${esc(p.location || '')}" maxlength="80"></label><label>Fotografija<select name="stage-${i}"><option value="single" ${!p.stage || p.stage === 'single' ? 'selected' : ''}>Samostojna</option><option value="before" ${p.stage === 'before' ? 'selected' : ''}>Prej</option><option value="after" ${p.stage === 'after' ? 'selected' : ''}>Potem</option></select></label><label class="wt-public"><input type="checkbox" name="published-${i}" ${p.published ? 'checked' : ''}> Prikaži v javni galeriji</label><button type="button" class="wt-remove-project" data-remove-project="${esc(p.id)}">Odstrani projekt</button></div>`).join('')}</div><button class="wt-save" type="submit">Shrani projekte</button></form><label class="wt-upload">Dodaj fotografije projektov<input type="file" accept="image/*" multiple data-project-files></label><p>Fotografije se shranijo samo v tem brskalniku.</p></div>`;
    if (panel === 'form') return `<div class="wt-panel" id="wt-panel"><h3>Kontaktni obrazec</h3><div class="wt-panel-row"><span>Prikaži obrazec na strani</span>${switchButton('toggle-form', state.formOn, 'Prikaži kontaktni obrazec')}</div><form data-form="form"><label>Prejemnik obvestil<input type="email" name="recipient" value="${esc(state.formRecipient)}" maxlength="120" required></label><fieldset><legend>Dovoljeni načini odgovora</legend>${[['phone', 'Telefon'], ['email', 'E-pošta'], ['whatsapp', 'WhatsApp']].map(([value, label]) => `<label><input type="checkbox" name="reply" value="${value}" ${state.replyMethods.includes(value) ? 'checked' : ''}> ${label}</label>`).join('')}</fieldset><button class="wt-save" type="submit">Shrani obrazec</button></form></div>`;
    if (panel === 'modules') return `<div class="wt-panel" id="wt-panel"><h3>Pripravljeni moduli</h3>${[['calculator', 'Kalkulator'], ['gallery', 'Galerija'], ['reviews', 'Ocene'], ['whatsapp', 'WhatsApp'], ['notice', 'Obvestilo']].map(([id, label]) => `<div class="wt-panel-row"><span>${label}${id === 'calculator' ? `<small>Primer cene: ${esc(price(state.services[0]))}</small>` : ''}</span>${switchButton(`module-${id}`, id === 'whatsapp' ? state.whatsappOn : state.modules[id], `Prikaži modul ${label}`)}</div>`).join('')}</div>`;
    return `<div class="wt-panel" id="wt-panel"><h3>Kratki odgovori za stranke</h3><form data-form="faq">${state.faqs.map((f, i) => `<label>${esc(f.question)}<textarea name="answer-${i}" maxlength="240" placeholder="Kratek odgovor">${esc(f.answer)}</textarea></label>`).join('')}<button class="wt-save" type="submit">Shrani odgovore</button></form></div>`;
  };
  const render = (keepScroll = true) => {
    const y = keepScroll ? scroller.scrollTop : 0;
    if (view === 'modules') {
      panel = 'modules';
      screen.setAttribute('aria-label', 'Moduli spletne strani');
      screen.innerHTML = `<header class="wt-page-head"><div><small>Mizarstvo Novak</small><h1>Moduli</h1></div><span class="wt-avatar">FN</span></header>
        ${editorPanel()}
        ${message ? `<p class="wt-message" role="status">${esc(message)}</p>` : ''}
        <p class="wt-demo-note">Demonstracijski moduli · spremembe so shranjene samo v tem brskalniku in niso objavljene na spletni strani.</p>`;
      scroller.scrollTop = y;
      fitText();
      return;
    }
    screen.setAttribute('aria-label', 'Nastavitve spletne strani');
    screen.innerHTML = `<header class="wt-page-head"><div><small>Mizarstvo Novak</small><h1>Nastavitve</h1></div><span class="wt-avatar">FN</span></header>
      ${availability()}
      ${contact()}
      ${workArea()}
      ${message ? `<p class="wt-message" role="status">${esc(message)}</p>` : ''}`;
    mountAvailability();
    scroller.scrollTop = y;
    fitText();
    requestAnimationFrame(updateWorkRows);
  };
  function fitText() {
    requestAnimationFrame(() => {
      screen.querySelectorAll('[data-fit]').forEach(el => {
        el.style.fontSize = '';
        const initial = parseFloat(getComputedStyle(el).fontSize);
        for (let size = initial; size >= 9 && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1); size -= .5) el.style.fontSize = `${size - .5}px`;
      });
    });
  }
  function show(nextView = 'settings') {
    view = nextView;
    panel = '';
    message = '';
    render(false);
    main.hidden = true;
    screen.hidden = false;
    dock.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
    const b = dock.querySelector(nextView === 'modules' ? '[data-view="modules"]' : '[data-modal="settings"]');
    b.classList.add('active'); b.setAttribute('aria-current', 'page');
    scroller.scrollTop = 0;
  }
  function hide() {
    screen.hidden = true; main.hidden = false;
    dock.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
    const b = dock.querySelector('[data-tab="Splošno"]');
    b.classList.add('active'); b.setAttribute('aria-current', 'page');
    scroller.scrollTop = 0;
  }
  document.addEventListener('click', event => {
    if (event.target.closest('.dock [data-modal="settings"]')) {
      event.preventDefault(); event.stopPropagation(); show('settings');
    } else if (event.target.closest('.dock [data-view="modules"]')) {
      event.preventDefault(); event.stopPropagation(); show('modules');
    } else if (!screen.hidden && event.target.closest('.dock [data-tab="Splošno"]')) hide();
  }, true);
  screen.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.go) {
      document.getElementById(button.dataset.go)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    if (button.dataset.workToggle) {
      const id = button.dataset.workToggle;
      const enabled = state.workEnabled[id] === false;
      state.workEnabled[id] = enabled;
      const row = button.closest('.wt-work-row');
      row.classList.toggle('is-off', !enabled);
      button.setAttribute('aria-pressed', String(enabled));
      button.setAttribute('aria-label', `${button.querySelector('.wt-work-copy strong').textContent}: ${enabled ? 'vklopljeno' : 'izklopljeno'}`);
      button.querySelector('.wt-work-copy small').textContent = enabled ? 'Vklopljeno' : 'Izklopljeno';
      row.querySelector('.wt-work-slider').disabled = !enabled;
      row.querySelector('.wt-work-extra input').disabled = !enabled;
      save(); return;
    }
    if (button.dataset.panel) {
      panel = panel === button.dataset.panel ? '' : button.dataset.panel; message = ''; render();
      if (panel) document.getElementById('wt-panel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    if (button.dataset.day !== undefined) {
      state.days[Number(button.dataset.day)] = !state.days[Number(button.dataset.day)];
      save(); render(); return;
    }
    if (button.dataset.availability) {
      const selected = button.dataset.availability;
      if (state.availability !== selected) { state.availability = selected; save(); render(); }
      return;
    }
    if (button.dataset.removeCity) {
      state.cities = state.cities.filter(c => c !== button.dataset.removeCity); save(); render(); return;
    }
    const action = button.dataset.action || '';
    if (action === 'edit-area' || action === 'edit-hours' || action === 'address-info') {
      const next = action === 'edit-area' ? 'area' : action === 'edit-hours' ? 'hours' : 'address';
      edit = edit === next ? '' : next;
      message = '';
      render(); return;
    }
    if (action === 'edit-phone' || action === 'edit-email' || action === 'add-city') {
      edit = action === 'add-city' ? 'city' : action.slice(5); message = ''; render();
      screen.querySelector('.wt-inline-editor input')?.focus(); return;
    }
    if (action === 'cancel-edit') { edit = ''; render(); return; }
    if (action === 'toggle-phone' || action === 'toggle-whatsapp') {
      if (action === 'toggle-phone') state.phoneOn = !state.phoneOn;
      else state.whatsappOn = !state.whatsappOn;
      if (!state.phoneOn && !state.whatsappOn && !state.email.trim()) {
        if (action === 'toggle-phone') state.phoneOn = true; else state.whatsappOn = true;
        message = 'Ohranite vsaj en delujoč način stika.';
      } else save();
      render(); return;
    }
    if (action === 'toggle-form') {
      if (state.formOn && !state.phoneOn && !state.whatsappOn && !state.email.trim()) message = 'Najprej omogočite drug način stika.';
      else { state.formOn = !state.formOn; save(); }
      render(); return;
    }
    if (action.startsWith('module-')) {
      const id = action.slice(7);
      if (id === 'whatsapp') state.whatsappOn = !state.whatsappOn;
      else state.modules[id] = !state.modules[id];
      if (!state.phoneOn && !state.whatsappOn && !state.email.trim()) {
        state.whatsappOn = true; message = 'Ohranite vsaj en delujoč način stika.';
      } else save();
      render(); return;
    }
    if (button.dataset.removeProject) {
      const project = state.projects.find(p => p.id === button.dataset.removeProject);
      if (project && window.confirm(`Odstranim projekt »${project.title}« iz tega brskalnika?`)) {
        state.projects = state.projects.filter(p => p.id !== project.id);
        save(); render();
      }
    }
  });
  screen.addEventListener('input', event => {
    if (event.target.matches('.wt-work-slider')) {
      animateWorkRow(event.target);
      state.workDistances[event.target.dataset.workDistance] = Number(event.target.value);
      updateWorkRow(event.target);
    } else if (event.target.matches('[data-work-extra]')) {
      const input = event.target;
      const value = Math.round(Number(input.value));
      const distance = input.value && Number.isFinite(value) && value > 80 ? Math.min(9999, value) : 80;
      const row = input.closest('.wt-work-row');
      const number = row.querySelector('.wt-work-km-number');
      number.textContent = distance;
      number.dataset.digits = String(distance).length;
      row.querySelector('.wt-work-van').setAttribute('aria-label', `Ilustriran kombi, ${distance} kilometrov`);
      fitText();
    } else if (event.target.matches('.wt-radius input')) {
      const labels = ['Samo kraj', 'do 10 km', 'do 20 km', 'do 30 km', 'do 50 km', 'do 100 km', 'Vsa Slovenija'];
      screen.querySelector('#wt-radius-value').textContent = labels[Number(event.target.value)];
    }
  });
  screen.addEventListener('change', event => {
    if (event.target.matches('.wt-work-slider')) {
      state.workDistances[event.target.dataset.workDistance] = Number(event.target.value);
      save();
      const track = event.target.closest('.wt-work-track');
      if (track.classList.contains('is-driving')) stopWorkRow(track);
    } else if (event.target.matches('[data-work-extra]')) {
      const input = event.target;
      const value = Math.round(Number(input.value));
      const distance = input.value && Number.isFinite(value) && value > 80 ? Math.min(9999, value) : 80;
      state.workDistances[input.dataset.workExtra] = distance;
      input.value = distance > 80 ? String(distance) : '';
      updateWorkRow(input.closest('.wt-work-track').querySelector('.wt-work-slider'));
      fitText();
      save();
    } else if (event.target.matches('.wt-radius input')) {
      state.radius = Number(event.target.value); save(); render();
    } else if (event.target.dataset.time) {
      const field = event.target.dataset.time;
      const value = event.target.value;
      const from = field === 'from' ? value : state.from;
      const to = field === 'to' ? value : state.to;
      if (from >= to) message = 'Končni čas mora biti poznejši od začetnega.';
      else { state[field] = value; save(); }
      render();
    } else if (event.target.name === 'accepted' || event.target.name === 'nextDate' || event.target.name === 'notice') {
      state[event.target.name] = event.target.value.trim(); save(); render();
    }
  });
  screen.addEventListener('focusout', event => {
    if (event.target.name === 'notice' && state.notice !== event.target.value.trim()) {
      state.notice = event.target.value.trim(); save(); render();
    }
  });
  screen.addEventListener('submit', event => {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    if (form.dataset.form === 'phone' || form.dataset.form === 'email') {
      const field = form.dataset.form;
      const value = String(data.get('value') || '').trim();
      if (field === 'email' && !value && !state.phoneOn && !state.whatsappOn) {
        message = 'Ohranite vsaj en delujoč način stika.'; render(); return;
      }
      state[field] = value; edit = '';
    } else if (form.dataset.form === 'city') {
      const value = String(data.get('value') || '').trim();
      if (value && !state.cities.some(c => c.toLocaleLowerCase('sl') === value.toLocaleLowerCase('sl'))) state.cities.push(value);
      edit = '';
    } else if (form.dataset.form === 'services') {
      const services = state.services.map((s, i) => ({
        ...s, mode: String(data.get(`mode-${i}`)), amount: Math.max(0, Number(data.get(`amount-${i}`)) || 0),
        max: Math.max(0, Number(data.get(`max-${i}`)) || 0), unit: String(data.get(`unit-${i}`) || '').trim()
      }));
      if (services.some(s => s.mode === 'range' && s.max < s.amount)) {
        message = 'Zgornja cena razpona mora biti večja od začetne.'; render(); return;
      }
      state.services = services;
    } else if (form.dataset.form === 'projects') {
      state.projects = state.projects.map((p, i) => ({
        ...p,
        title: String(data.get(`title-${i}`) || '').trim(),
        description: String(data.get(`description-${i}`) || '').trim(),
        service: String(data.get(`service-${i}`) || '').trim(),
        location: String(data.get(`location-${i}`) || '').trim(),
        stage: String(data.get(`stage-${i}`) || 'single'),
        published: data.has(`published-${i}`)
      }));
    } else if (form.dataset.form === 'form') {
      state.formRecipient = String(data.get('recipient') || '').trim();
      state.replyMethods = data.getAll('reply').map(String);
      if (!state.replyMethods.length) { message = 'Izberite vsaj en način odgovora.'; render(); return; }
    } else if (form.dataset.form === 'faq') {
      state.faqs = state.faqs.map((f, i) => ({ ...f, answer: String(data.get(`answer-${i}`) || '').trim() }));
    }
    save(); render();
  });
  screen.addEventListener('change', async event => {
    if (!event.target.matches('[data-project-files]')) return;
    const files = Array.from(event.target.files || []).filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        state.projects.push({ id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: file.name.replace(/\.[^.]+$/, '').slice(0, 80), image: canvas.toDataURL('image/jpeg', .7), published: true });
      } catch (_) { message = 'Fotografije ni bilo mogoče dodati.'; }
    }
    save(); render();
  });
  document.fonts?.ready.then(fitText);
  window.addEventListener('resize', () => { if (!screen.hidden) { fitText(); updateWorkRows(); } });
  render(false);
})();

