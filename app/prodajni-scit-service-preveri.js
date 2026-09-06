(function () {
  'use strict';
  const config = window.prodajniScitStoritve && window.prodajniScitStoritve.preveri;
  if (!config) return;
  config.opis = 'Izberite, kaj naj preverimo pred vašo odločitvijo.';
  config.moznosti = ['Preverite prodajalca in ponudbo', 'Preverite podjetje in registracijo', 'Preverite prodajalca in kontakt', 'Preverite ceno, pogodbo in pogoje', 'Pripravite oceno in priporočilo', 'Primerjajte ponudbo z drugimi ponudbami'];
  const popup = document.querySelector('[data-storitev-popup]');
  const check = '<span class="preveri-izbira" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>';
  function fit() {
    if (popup.hidden || popup.dataset.tip !== 'preveri') return;
    popup.querySelectorAll('[data-preveri-fit]').forEach(function (el) {
      let size = Number(el.dataset.preveriFit);
      el.style.fontSize = size + 'px';
      while ((el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) && size > 9) {
        size -= .5; el.style.fontSize = size + 'px';
      }
    });
  }
  document.addEventListener('click', function (event) {
    if (!event.target.closest('[data-storitev="preveri"]')) return;
    const content = popup.querySelector('[data-storitev-vsebina]');
    content.querySelectorAll('[data-storitev-vrednost]').forEach(function (button, index) {
      const label = button.textContent;
      button.textContent = '';
      button.className = index === 0 ? 'preveri-hero' : 'preveri-vrstica';
      if (index === 0) {
        const img = document.createElement('img');
        img.className = 'preveri-hero__slika'; img.src = 'assets/jezomir-preveri-ogledalo-thin-loupe-v3.png'; img.alt = '';
        button.appendChild(img);
      }
      const text = document.createElement('span');
      text.className = index === 0 ? 'preveri-hero__besedilo' : 'preveri-vrstica__besedilo';
      if (index === 0) {
        const title = document.createElement('strong');
        title.dataset.preveriFit = '20'; title.textContent = label;
        const subtitle = document.createElement('span');
        subtitle.dataset.preveriFit = '12'; subtitle.textContent = 'Preverimo podatke in podamo oceno.';
        text.append(title, subtitle);
      } else { text.dataset.preveriFit = '13'; text.textContent = label; }
      button.appendChild(text);
      button.insertAdjacentHTML('beforeend', check);
    });
    popup.querySelector('.storitev-popup__varnost').textContent = 'Brez vaše končne potrditve ničesar ne naročimo ali sprejmemo.';
    requestAnimationFrame(fit);
  });
  new ResizeObserver(fit).observe(popup.querySelector('.storitev-popup__list'));
  if (document.fonts) document.fonts.ready.then(fit);
})();
