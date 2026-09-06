(function(){
window.UJContactDetails = function(form){
  const choices = {
    vloga: {
      naslov: "Vloga ponudnika",
      pomoc: "Izberite možnost, ki najbolje opiše podjetje.",
      ikona: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3" /><path d="M5 21v-4a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v4M8 17v4M16 17v4" /></svg>',
      moznosti: ["Storitve izvajajo sami", "Agencija", "Preprodajalec", "Posrednik / zastopnik", "Portal / platforma", "Proizvajalec", "Ne vem"],
    },
    odnos: {
      naslov: "Odnos s podjetjem",
      pomoc: "Izberite trenutno stanje odnosa s podjetjem.",
      ikona: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1.1l2-2A5 5 0 0 0 12 4l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></svg>',
      moznosti: ["Prvi stik", "Prejel sem ponudbo", "Razmišljam o menjavi", "Že uporabljam storitve", "Aktivna naročnina", "Želim prekiniti", "Nekdanji ponudnik"],
    },
    sodelovanje: {
      naslov: "Vrsta sodelovanja",
      pomoc: "Izberite obliko sodelovanja s podjetjem.",
      ikona: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18m-12 5 2 2 4-4" /></svg>',
      moznosti: ["Enkratni nakup", "Posamezen projekt", "Redno sodelovanje", "Naročnina ali pogodba", "Še ne sodelujemo"],
    },
    stik: {
      naslov: "Način stika",
      pomoc: "Izberite, kako ste prišli v stik s podjetjem.",
      ikona: '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></svg>',
      moznosti: ["Hladni prodajni klic", "Nepričakovana e-pošta", "Oglas", "Poslovni portal", "Sejem / osebni obisk", "Priporočilo", "Našel sam", "Že sodelovali", "Drugo"],
    },
  };

 const values={};
 const wrap=document.createElement('div');wrap.className='scit-contact-details';
 wrap.innerHTML='<div class="scit-contact-details-body"><label>Kaj podjetje ponuja?<input name="activity" placeholder="Npr. polaganje ploščic"></label><div class="scit-contact-facts"></div></div>';
 form.querySelector('.scit-kontakt-akcije').before(wrap);
 const grid=wrap.querySelector('.scit-contact-facts');
 Object.entries(choices).forEach(([key,config])=>{
 const tile=document.createElement('button');tile.type='button';tile.className='podjetje-povzetek__vrstica';tile.setAttribute('aria-expanded','false');tile.dataset.fact=key;
 tile.innerHTML=config.ikona+'<span><strong></strong><em>Izberite</em></span><b aria-hidden="true">›</b>';tile.querySelector('strong').textContent=config.naslov;grid.append(tile);
 tile.onclick=()=>{
 const previous=wrap.querySelector('.scit-contact-editor');if(previous)previous.remove();grid.querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded','false'));
 tile.setAttribute('aria-expanded','true');
 const panel=document.createElement('section');panel.className='scit-contact-editor';panel.setAttribute('aria-label',config.naslov);
 const title=document.createElement('strong');title.textContent=config.naslov;panel.append(title);
 const options=document.createElement('div');options.className='scit-contact-options';panel.append(options);
 const selected=new Set(values[key]?.selected||[]);
 config.moznosti.forEach(text=>{const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-pressed',String(selected.has(text)));button.onclick=()=>{selected.has(text)?selected.delete(text):selected.add(text);button.setAttribute('aria-pressed',String(selected.has(text)));};options.append(button);});
 const label=document.createElement('label');label.textContent='Napiši sam (neobvezno)';const input=document.createElement('textarea');input.rows=2;input.placeholder='Dodajte svoj odgovor …';input.value=values[key]?.custom||'';label.append(input);panel.append(label);
 const actions=document.createElement('div');actions.className='scit-contact-editor-actions';panel.append(actions);
 const close=()=>{panel.remove();tile.setAttribute('aria-expanded','false');tile.focus({preventScroll:true});};
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Prekliči';cancel.onclick=close;
 const save=document.createElement('button');save.type='button';save.textContent='Shrani';save.onclick=()=>{values[key]={selected:[...selected],custom:input.value.trim()};const text=[...selected,input.value.trim()].filter(Boolean).join(' · ');tile.querySelector('em').textContent=text||'Izberite';tile.classList.toggle('is-filled',Boolean(text));close();};actions.append(cancel,save);
 wrap.append(panel);
 const wrapRect=wrap.getBoundingClientRect();
 const tileRect=tile.getBoundingClientRect();
 panel.style.bottom=(wrapRect.bottom-tileRect.top+6)+'px';
 panel.style.transformOrigin='bottom center';
 panel.animate([{opacity:0,clipPath:'inset(100% 0 0 0)'},{opacity:1,clipPath:'inset(0)'}],{duration:220,easing:'ease-out'});
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
 };
 });
 form.addEventListener('reset',()=>{Object.keys(values).forEach(k=>delete values[k]);wrap.querySelector('.scit-contact-editor')?.remove();grid.querySelectorAll('button').forEach(b=>{b.classList.remove('is-filled');b.setAttribute('aria-expanded','false');b.querySelector('em').textContent='Izberite';});});
 const get=()=>({activity:form.elements.activity.value.trim(),answers:JSON.parse(JSON.stringify(values))});
 get.restore=data=>{form.elements.activity.value=data?.activity||'';Object.keys(values).forEach(k=>delete values[k]);Object.assign(values,data?.answers||{});grid.querySelectorAll('[data-fact]').forEach(b=>{const v=values[b.dataset.fact];const text=v?[...(v.selected||[]),v.custom||''].filter(Boolean).join(' · '):'';b.querySelector('em').textContent=text||'Izberite';b.classList.toggle('is-filled',Boolean(text));});};return get;
};
})();
