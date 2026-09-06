(function () {
  'use strict';
  const service = window.prodajniScitStoritve && window.prodajniScitStoritve.ponudba;
  if (!service) return;
  service.naslov = 'Pridobi ponudbo';
  service.opis = 'Pridobimo pisno ali drugo ponudbo ter se po vašem naročilu pogajamo za boljše pogoje.';
  service.moznosti = ['Pridobite pisno ponudbo', 'PDF ponudba', 'Predračun', 'Končna cena z vsemi stroški', 'Pogajajte se za boljše pogoje', 'Pridobite druge ponudbe'];
  const popup = document.querySelector('.storitev-popup');
  const check = '<span class="ponudba-izbira" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>';
  function fit() {
    if (popup.hidden || popup.dataset.tip !== 'ponudba') return;
    popup.querySelectorAll('[data-ponudba-fit]').forEach(function (element) {
      let size = Number(element.dataset.ponudbaFit);
      element.style.fontSize = size + 'px';
      while ((element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) && size > 9) {
        size -= 0.25;
        element.style.fontSize = size + 'px';
      }
    });
  }
  document.addEventListener('click', function (event) {
    if (!event.target.closest('[data-storitev="ponudba"]') || popup.dataset.tip !== 'ponudba') return;
    const buttons = popup.querySelectorAll('[data-storitev-vrednost]');
    const icon = document.querySelector('[data-storitev="ponudba"] svg');
    buttons.forEach(function (button, index) {
      const label = button.dataset.storitevVrednost;
      button.replaceChildren();
      button.className = index === 0 ? 'ponudba-hero' : 'ponudba-vrstica';
      if (index === 0) {
        button.innerHTML = '<img class="ponudba-hero__slika" src="assets/jezomir-ponudba-palec-v5.png" alt="" /><span class="ponudba-hero__besedilo"><strong data-ponudba-fit="20"></strong><span data-ponudba-fit="12">Od prodajalca pridobimo ponudbo po e-pošti.</span></span>' + check;
        button.querySelector('strong').textContent = label;
      } else {
        button.innerHTML = '<span class="ponudba-vrstica__ikona" aria-hidden="true">' + (icon ? icon.outerHTML : '') + '</span><span class="ponudba-vrstica__naziv" data-ponudba-fit="13"></span>' + check;
        button.querySelector('.ponudba-vrstica__naziv').textContent = label;
      }
    });
    popup.querySelector('.storitev-popup__varnost').textContent = 'Brez vaše končne potrditve ničesar ne naročimo ali sprejmemo.';
    requestAnimationFrame(fit);
  });
  window.addEventListener('resize', fit);
  if (document.fonts) document.fonts.ready.then(fit);
  new ResizeObserver(fit).observe(popup.querySelector('.storitev-popup__list'));
}());
