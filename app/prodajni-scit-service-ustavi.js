(function () {
  'use strict';
  const storitev = window.prodajniScitStoritve && window.prodajniScitStoritve.ustavi;
  if (!storitev) return;
  Object.assign(storitev, {
    naslov: 'Ustavi klice',
    opis: 'Po vaši potrditvi prodajalcu sporočimo izbrane zahteve.',
    moznosti: ['Zahtevajte, da me ne kličejo več', 'Zavrnite trenutno ponudbo', 'Odjavite me iz prodajne oziroma marketinške baze', 'Ustavite stik po vseh kanalih']
  });
  const popup = document.querySelector('.storitev-popup');
  function prilagodi() {
    if (!popup || popup.hidden || popup.dataset.tip !== 'ustavi') return;
    popup.querySelectorAll('[data-ustavi-fit]').forEach(function (el) {
      let size = Number(el.dataset.ustaviFit);
      el.style.fontSize = size + 'px';
      while ((el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) && size > 9) {
        size -= .25;
        el.style.fontSize = size + 'px';
      }
    });
  }
  document.addEventListener('click', function (event) {
    if (!event.target.closest('[data-storitev="ustavi"]') || !popup || popup.dataset.tip !== 'ustavi') return;
    const vsebina = popup.querySelector('[data-storitev-vsebina]');
    vsebina.querySelectorAll('[data-storitev-vrednost]').forEach(function (button, index) {
      const label = button.dataset.storitevVrednost;
      button.className = index === 0 ? 'ustavi-hero' : 'ustavi-vrstica';
      button.replaceChildren();
      if (index === 0) {
        const img = document.createElement('img');
        img.src = 'assets/jezomir-ustavi-stop-v1-thin-v2.png';
        img.alt = '';
        img.className = 'ustavi-hero__slika';
        button.append(img);
      }
      const copy = document.createElement('span');
      copy.className = index === 0 ? 'ustavi-hero__besedilo' : 'ustavi-vrstica__besedilo';
      if (index === 0) {
        const title = document.createElement('strong');
        title.textContent = 'Ustavite prodajne klice';
        title.dataset.ustaviFit = '20';
        copy.append(title);
      }
      const text = document.createElement('span');
      text.textContent = label;
      text.dataset.ustaviFit = index === 0 ? '12' : '13';
      copy.append(text);
      const circle = document.createElement('span');
      circle.className = 'ustavi-izbira';
      circle.setAttribute('aria-hidden', 'true');
      button.append(copy, circle);
    });
    const note = document.createElement('p');
    note.className = 'ustavi-pojasnilo';
    note.textContent = 'Podjetju posredujemo vašo zahtevo za odjavo ali prenehanje stikov. Izbris podatkov ni zagotovljen.';
    vsebina.append(note);
    popup.querySelector('.storitev-popup__varnost').textContent = 'Brez vaše končne potrditve ničesar ne naročimo ali sprejmemo.';
    requestAnimationFrame(prilagodi);
  });
  window.addEventListener('resize', prilagodi);
  if (document.fonts) document.fonts.ready.then(prilagodi);
})();
