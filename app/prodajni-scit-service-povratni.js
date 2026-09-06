(function () {
  'use strict';
  const config = window.prodajniScitStoritve && window.prodajniScitStoritve.povratni;
  if (!config) return;
  config.opis = 'Pokličemo prodajalca, pridobimo odgovore in vam sporočimo izid.';
  config.moznosti = ['Pokličite prodajalca namesto mene', 'Pridobite manjkajoče informacije', 'Zahtevajte pisni odgovor', 'Dogovorite nov termin pogovora'];
  const popup = document.querySelector('[data-storitev-popup]');
  const content = popup.querySelector('[data-storitev-vsebina]');
  const details = { termin: '', navodilo: '' }; // Preview-only form data; selections belong to the shared renderer.
  let dialog;
  let opener;
  const tick = '<span class="povratni-izbira" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span>';
  const paths = ['<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>', '<path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6"/>', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h3"/>'];
  function fit() {
    if (popup.hidden || popup.dataset.tip !== 'povratni') return;
    popup.querySelectorAll('[data-povratni-fit]').forEach(function (el) {
      let size = Number(el.dataset.povratniFit);
      el.style.fontSize = size + 'px';
      while (size > 9 && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
        size -= .5;
        el.style.fontSize = size + 'px';
      }
    });
  }
  function refreshDetails() {
    const button = content.querySelector('[data-povratni-termin]');
    const selected = content.querySelector('[data-storitev-vrednost="' + config.moznosti[3] + '"]');
    if (!button || !selected) return;
    button.hidden = selected.getAttribute('aria-pressed') !== 'true';
    const label = button.querySelector('span');
    label.textContent = details.termin ? 'Termin: ' + details.termin.replace('T', ' ob ') : 'Določite želeni termin';
    fit();
  }
  function render() {
    content.querySelectorAll('[data-storitev-vrednost]').forEach(function (button, index) {
      button.className = index === 0 ? 'povratni-hero' : 'povratni-vrstica';
      button.replaceChildren();
      if (index === 0) {
        button.innerHTML = '<img class="povratni-hero__slika" src="assets/jezomir-povratni-pozicija-v4-thin-v2.png" alt=""/><span class="povratni-hero__besedilo"><strong data-povratni-fit="20"></strong><span data-povratni-fit="12">Pokličemo prodajalca in vam sporočimo izid pogovora.</span></span>' + tick;
        button.querySelector('strong').textContent = config.moznosti[index];
      } else {
        button.innerHTML = '<svg class="povratni-ikona" viewBox="0 0 24 24" aria-hidden="true">' + paths[index - 1] + '</svg><span class="povratni-naziv" data-povratni-fit="13"></span>' + tick;
        button.querySelector('.povratni-naziv').textContent = config.moznosti[index];
      }
    });
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'povratni-termin';
    button.dataset.povratniTermin = '';
    button.setAttribute('aria-haspopup', 'dialog');
    button.innerHTML = '<span data-povratni-fit="13"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
    content.append(button);
    popup.querySelector('.storitev-popup__varnost').textContent = 'Brez vaše končne potrditve ničesar ne naročimo ali sprejmemo.';
    refreshDetails();
    requestAnimationFrame(fit);
  }
  function openDetails(button) {
    opener = button;
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'povratni-dialog';
      dialog.setAttribute('aria-labelledby', 'povratni-termin-naslov');
      dialog.innerHTML = '<header><h2 id="povratni-termin-naslov">Želeni termin pogovora</h2><button type="button" data-povratni-zapri aria-label="Zapri termin">×</button></header><p>Pri prodajalcu preverimo razpoložljivost in vam potrdimo dogovor.</p><form><label>Datum in ura<input name="termin" type="datetime-local" required/></label><label>Kratko navodilo (neobvezno)<textarea name="navodilo" maxlength="300" rows="4" placeholder="npr. pogovor po 15. uri, o ceni in vezavi"></textarea></label><p class="povratni-napaka" role="alert" hidden>Izberite prihodnji datum in uro.</p><button class="povratni-shrani" type="submit">Shrani termin</button><button class="povratni-preklic" type="button" data-povratni-zapri>Prekliči</button></form>';
      popup.append(dialog);
      dialog.addEventListener('keydown', function (event) { if (event.key === 'Escape') event.stopPropagation(); });
      dialog.addEventListener('click', function (event) { if (event.target.closest('[data-povratni-zapri]')) dialog.close(); });
      dialog.addEventListener('close', function () { if (opener && opener.isConnected) opener.focus(); });
      dialog.querySelector('form').addEventListener('submit', function (event) {
        event.preventDefault();
        const value = dialog.querySelector('input').value;
        const invalid = !value || new Date(value).getTime() <= Date.now();
        dialog.querySelector('.povratni-napaka').hidden = !invalid;
        if (invalid) { dialog.querySelector('input').focus(); return; }
        details.termin = value;
        details.navodilo = dialog.querySelector('textarea').value.trim();
        config.podrobnosti = details;
        refreshDetails();
        dialog.close();
      });
    }
    dialog.querySelector('input').value = details.termin;
    dialog.querySelector('textarea').value = details.navodilo;
    dialog.querySelector('.povratni-napaka').hidden = true;
    dialog.showModal();
  }
  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-storitev="povratni"]')) { render(); return; }
    if (popup.hidden || popup.dataset.tip !== 'povratni') return;
    if (event.target.closest('[data-storitev-vrednost]')) refreshDetails();
    const button = event.target.closest('[data-povratni-termin]');
    if (button) openDetails(button);
  });
  window.addEventListener('resize', fit);
  if (document.fonts) document.fonts.ready.then(fit);
}());
