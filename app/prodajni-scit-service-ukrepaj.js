(function () {
  'use strict';
  const config = window.prodajniScitStoritve.ukrepaj;
  const options = ['Preverite ponudbo', 'Primerjajte jo z drugimi ponudbami', 'Pogajajte se za boljše pogoje', 'Pridobite druge ponudbe', 'Zavrnite ponudbo', 'Ustavite nadaljnje kontakte'];
  Object.assign(config, { naslov: 'Ukrepaj naprej', opis: 'Iz poročila izberite, kako naj nadaljujemo.', moznosti: options });
  const popup = document.querySelector('.storitev-popup');
  let syncing = false;
  function fit() {
    if (popup.hidden || popup.dataset.tip !== 'ukrepaj') return;
    popup.querySelectorAll('[data-ukrepaj-fit]').forEach(function (el) {
      let size = Number(el.dataset.ukrepajFit);
      el.style.fontSize = size + 'px';
      while ((el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && size > 10) {
        size -= .5;
        el.style.fontSize = size + 'px';
      }
    });
  }
  function enhance() {
    if (popup.hidden || popup.dataset.tip !== 'ukrepaj') return;
    const content = popup.querySelector('[data-storitev-vsebina]');
    if (content.querySelector('.ukrepaj-hero')) return;
    const list = content.querySelector('.storitev-moznosti');
    const hero = document.createElement('section');
    hero.className = 'ukrepaj-hero';
    hero.innerHTML = '<img src="assets/jezomir-ukrepaj-palec-v7.png" alt="" class="ukrepaj-hero__slika"><div class="ukrepaj-hero__besedilo"><strong data-ukrepaj-fit="20">Izberite naslednji korak</strong><span data-ukrepaj-fit="12">Vi odločite. Mi uredimo po vaši potrditvi.</span></div>';
    content.prepend(hero);
    const paths = ['M21 11.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7 M7 8h10 M7 12h5 M16 18l2 2 4-5', 'M8 3v18 M16 3v18 M3 7h10 M11 17h10', 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6A8.4 8.4 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5Z', 'M12 5v14 M5 12h14', 'M6 6l12 12 M18 6 6 18', 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4 M3 3l18 18'];
    list.querySelectorAll('[data-storitev-vrednost]').forEach(function (button, i) {
      button.className = 'ukrepaj-moznost';
      const label = document.createElement('span');
      label.className = 'ukrepaj-moznost__naziv';
      label.dataset.ukrepajFit = '13';
      label.textContent = button.dataset.storitevVrednost;
      button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + paths[i] + '"/></svg>';
      button.append(label);
      button.insertAdjacentHTML('beforeend', '<span class="ukrepaj-izbira" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>');
    });
    list.insertAdjacentHTML('afterend', '<p class="ukrepaj-pojasnilo">Zavrnitev izključi preverjanje, primerjavo in pogajanja o tej ponudbi. Ustavitev kontaktov velja za tega prodajalca in izključi pogajanja.</p><p class="ukrepaj-status" role="status" aria-live="polite"></p>');
    popup.querySelector('.storitev-popup__varnost').textContent = 'Brez vaše končne potrditve ničesar ne naročimo ali sprejmemo.';
    requestAnimationFrame(fit);
  }
  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-storitev="ukrepaj"]')) { enhance(); return; }
    if (popup.hidden || popup.dataset.tip !== 'ukrepaj' || syncing) return;
    const choice = event.target.closest('[data-storitev-vrednost]');
    if (!choice || !popup.contains(choice)) return;
    const status = popup.querySelector('.ukrepaj-status');
    status.textContent = '';
    if (choice.getAttribute('aria-pressed') !== 'true') return;
    const index = options.indexOf(choice.dataset.storitevVrednost);
    const conflicts = index === 4 ? [0, 1, 2] : index === 5 ? [2] : index === 2 ? [4, 5] : index < 2 ? [4] : [];
    syncing = true;
    const removed = [];
    try {
      popup.querySelectorAll('[data-storitev-vrednost][aria-pressed="true"]').forEach(function (other) {
        if (conflicts.includes(options.indexOf(other.dataset.storitevVrednost))) {
          removed.push(other.dataset.storitevVrednost);
          // Use the existing handler to update its single source of truth.
          other.click();
        }
      });
    } finally { syncing = false; }
    if (removed.length) status.textContent = 'Odstranjene nezdružljive izbire: ' + removed.join(', ') + '.';
  });
  new ResizeObserver(fit).observe(popup.querySelector('[data-storitev-vsebina]'));
  document.fonts.ready.then(fit);
})();
