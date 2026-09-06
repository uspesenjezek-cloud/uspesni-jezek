(function () {
  "use strict";

  const popup = document.querySelector("[data-popup]");
  const popupKorak = document.querySelector("[data-popup-korak]");
  const popupNaslov = document.querySelector("[data-popup-naslov]");
  const popupOpis = document.querySelector("[data-popup-opis]");
  const popupVsebina = document.querySelector("[data-popup-vsebina]");
  const oddaj = document.querySelector("[data-oddaj]");
  const oddajStevec = document.querySelector("[data-oddaj-stevec]");
  const toast = document.querySelector("[data-toast]");
  const storitevPopup = document.querySelector("[data-storitev-popup]");
  const storitevNaslov = document.querySelector("[data-storitev-naslov]");
  const storitevOpis = document.querySelector("[data-storitev-opis]");
  const storitevIkona = document.querySelector("[data-storitev-ikona]");
  const storitevVsebina = document.querySelector("[data-storitev-vsebina]");
  const storitevOddaj = document.querySelector("[data-storitev-oddaj]");
  const primerPopup = document.querySelector("[data-primer-popup]");
  const primerNadnaslov = document.querySelector("[data-primer-nadnaslov]");
  const primerNaslov = document.querySelector("[data-primer-naslov]");
  const primerOpis = document.querySelector("[data-primer-opis]");
  const potrdiUkrep = document.querySelector("[data-potrdi-ukrep]");
  const carovnikPilli = document.querySelector("[data-carovnik-pilli]");
  const carovnikKartica = document.querySelector("[data-carovnik-kartica]");
  const carovnikStevilka = document.querySelector("[data-carovnik-stevilka]");
  const carovnikNaslov = document.querySelector("[data-carovnik-naslov]");
  const carovnikOpis = document.querySelector("[data-carovnik-opis]");
  const carovnikVsebina = document.querySelector("[data-carovnik-vsebina]");
  const carovnikNapredek = document.querySelector("[data-carovnik-napredek]");
  const carovnikNazaj = document.querySelector("[data-carovnik-nazaj]");
  const carovnikNaprej = document.querySelector("[data-carovnik-naprej]");
  const atenaPanel = document.querySelector("[data-scit-atena-panel]");
  const rocnoPanel = document.querySelector("[data-scit-rocno-panel]");
  const atenaKontakt = document.querySelector("[data-scit-atena-kontakt]");
  const atenaOpis = document.querySelector("[data-scit-atena-opis]");
  const atenaPoizveduj = document.querySelector("[data-scit-atena-poizveduj]");
  const atenaGlas = document.querySelector("[data-scit-atena-glas]");
  const atenaKamera = document.querySelector("[data-scit-atena-kamera]");
  const atenaUvoz = document.querySelector("[data-scit-atena-uvoz]");
  const atenaKameraDatoteka = document.querySelector("[data-scit-atena-kamera-datoteka]");
  const atenaUvozDatoteka = document.querySelector("[data-scit-atena-uvoz-datoteka]");
  const nacina = Array.from(document.querySelectorAll("[data-scit-nacin]"));
  rocnoPanel.before(atenaPanel);
  function nastaviNacin(nacin) {
    const rocno = nacin === "manual";
    rocnoPanel.hidden = !rocno;
    atenaPanel.hidden = rocno;
    nacina.forEach(function (gumb) {
      const izbran = gumb.dataset.scitNacin === (rocno ? "manual" : "natural");
      gumb.setAttribute("aria-selected", String(izbran));
      gumb.tabIndex = izbran ? 0 : -1;
    });
  }
  nacina.forEach(function (gumb, indeks) {
    gumb.addEventListener("click", function () { nastaviNacin(gumb.dataset.scitNacin); });
    gumb.addEventListener("keydown", function (event) {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const naslednji = event.key === "Home" ? nacina[0] : event.key === "End" ? nacina[1] : nacina[1 - indeks];
      nastaviNacin(naslednji.dataset.scitNacin);
      naslednji.focus();
    });
  });
  nastaviNacin("natural");
  const stanje = { kontakt: "", brezKontakta: false, dogodek: "", ukrepi: [], kategorija: "", meja: [], opomba: "", lastno: {} };
  const stanjeStoritev = {};
  const prednastavitve = [
    { id: "mir", naziv: "Naj ne težijo", storitve: ["ustavi", "zascita"] },
    { id: "uredi", naziv: "Uredite zame", storitve: ["zascita", "povratni"] },
    { id: "ponudba", naziv: "Pridobi ponudbo", storitve: ["povratni", "ponudba"] },
    { id: "preveri", naziv: "Preveri ponudbo", storitve: ["preveri"] }
  ];
  const storitveniGumbi = Array.from(document.querySelectorAll(".scit-storitev[data-storitev]"));
  const prednastavitveVsebnik = document.querySelector("[data-scit-prednastavitve]");
  prednastavitve.forEach(function (prednastavitev) {
    const gumb = document.createElement("button");
    gumb.type = "button";
    gumb.className = "scit-prednastavitev";
    gumb.dataset.scitPrednastavitev = prednastavitev.id;
    gumb.setAttribute("aria-pressed", "false");
    const krog = document.createElement("span");
    krog.className = "scit-prednastavitev__krog";
    krog.setAttribute("aria-hidden", "true");
    const barve = prednastavitev.storitve.map(function (id) {
      const storitev = storitveniGumbi.find(function (element) { return element.dataset.storitev === id; });
      return getComputedStyle(storitev).getPropertyValue("--storitev-barva").trim();
    });
    krog.style.setProperty("--preset-obroba", "conic-gradient(" + barve[0] + " 0deg 180deg," + (barve[1] || barve[0]) + " 180deg 360deg)");
    krog.appendChild(storitveniGumbi.find(function (element) { return element.dataset.storitev === prednastavitev.storitve[0]; }).querySelector("svg").cloneNode(true));
    const naziv = document.createElement("strong");
    naziv.textContent = prednastavitev.naziv;
    gumb.append(krog, naziv);
    gumb.addEventListener("click", function () {
      if(prednastavitev.korak){izberiLastni(prednastavitev.korak);return;}
      zapustiLastni();
      if (gumb.getAttribute("aria-pressed") === "true") {
        prednastavitveVsebnik.querySelectorAll("button").forEach(function (element) { element.setAttribute("aria-pressed", "false"); });
        storitveniGumbi.forEach(function (element) { element.classList.remove("je-v-prednastavitvi"); });
        document.querySelector("[data-scit-prednastavitev-opis]").textContent = "";
        delete document.querySelector(".scit-storitve").dataset.prednastavitev;
        return;
      }
      prednastavitveVsebnik.querySelectorAll("button").forEach(function (element) { element.setAttribute("aria-pressed", String(element === gumb)); });
      const vkljucene = [];
      storitveniGumbi.forEach(function (element) {
        const izbran = prednastavitev.storitve.includes(element.dataset.storitev);
        element.classList.toggle("je-v-prednastavitvi", izbran);
        if (izbran) vkljucene.push(element.innerText.replace(/\s+/g, " "));
      });
      const opis = document.querySelector("[data-scit-prednastavitev-opis]");
      const naslov = document.createElement("strong");
      naslov.textContent = prednastavitev.naziv;
      const korakiOpis = document.createElement("span");
      korakiOpis.textContent = vkljucene.join(" + ");
      opis.replaceChildren(naslov, korakiOpis);
      document.querySelector(".scit-storitve").dataset.prednastavitev = prednastavitev.id;
    });
    prednastavitveVsebnik.appendChild(gumb);
  });
  const upravljajPredizbor = document.querySelector('[data-preset-upravljaj]');
  function zakljuciPredizbor() {
    prednastavitveVsebnik.querySelectorAll('.scit-preset-urejanje').forEach(function(ovoj) { ovoj.replaceWith(ovoj.querySelector('.scit-prednastavitev')); });
    prednastavitveVsebnik.classList.remove('ureja-predizbor');
    upravljajPredizbor.setAttribute('aria-pressed','false'); upravljajPredizbor.textContent='Uredi'; osveziPike();
  }
  upravljajPredizbor.addEventListener('click', function() {
    if (upravljajPredizbor.getAttribute('aria-pressed')==='true') { zakljuciPredizbor(); return; }
    upravljajPredizbor.setAttribute('aria-pressed','true'); upravljajPredizbor.textContent='Končaj urejanje';
    prednastavitveVsebnik.classList.add('ureja-predizbor');
    Array.from(prednastavitveVsebnik.children).forEach(function(gumb) {
      const ovoj=document.createElement('div'); ovoj.className='scit-preset-urejanje'; gumb.replaceWith(ovoj); ovoj.append(gumb);
      const brisi=document.createElement('button'); brisi.type='button'; brisi.className='scit-preset-izbrisi'; brisi.textContent='×'; brisi.setAttribute('aria-label','Izbriši '+gumb.innerText);
      brisi.addEventListener('click',function(){ if(gumb.getAttribute('aria-pressed')==='true')gumb.click(); ovoj.remove();osveziPike(); });
      const uredi=document.createElement('button'); uredi.type='button'; uredi.className='scit-preset-uredi';uredi.textContent='Uredi';uredi.setAttribute('aria-label','Uredi '+gumb.innerText);
      uredi.addEventListener('click',function(){
        zakljuciPredizbor();
        const preset=prednastavitve.find(p=>p.id===gumb.dataset.scitPrednastavitev);
        let korak=lastniKoraki.find(k=>k.gumb===gumb) || (preset && preset.korak);
        if(!korak && preset){
          const vsebina={};preset.storitve.forEach(tip=>{vsebina[tip]=kopija(stanjeStoritev[tip] || {moznosti:[]});});
          korak={id:preset.id,naziv:gumb.querySelector('strong').textContent,vsebina:vsebina,gumb:gumb};preset.korak=korak;
        }
        if(!korak)return;
        prejsnjaIzbira=null;
        if(aktivniLastni!==korak)izberiLastni(korak);
        lastniPanel.hidden=false;
        lastniPanel.querySelector('input').value=korak.naziv;
        lastniMeni.querySelector('[data-lastni-meni-vsebina]').append(lastniMreza,lastniPanel);
        lastniMeni.classList.remove('je-pregled');lastniMeni.hidden=false;
        osveziLastni();document.body.classList.add('scit-lastni-odprt');
        lastniMeni.querySelector('[data-lastni-preklic]').focus();
      });
      ovoj.append(brisi,uredi);
    });
  });
  let aktivniLastni = null;
  let osnovneStoritve = null;
  const lastniKoraki = [];
  const lastniPanel = document.createElement('section');
  lastniPanel.className = 'scit-lastni'; lastniPanel.hidden = true;
  lastniPanel.innerHTML = '<form data-lastni-ime><label><input name="naziv" maxlength="32" required aria-label="Ime koraka" placeholder="Ime koraka" autocomplete="off"></label><button type="submit">Shrani korak</button></form><div data-lastni-vsebina></div><p data-lastni-status role="status"></p>';
  lastniPanel.prepend(lastniPanel.querySelector('[data-lastni-vsebina]'));
  const uporabiZa = document.createElement('div');
  uporabiZa.className = 'scit-uporabi-za';
  uporabiZa.innerHTML = '<div><strong>Uporabi za</strong><span data-skupine-povzetek aria-live="polite">Brez skupine</span></div><button type="button" data-skupine-izberi aria-haspopup="dialog">Izberi skupino</button>';
  lastniPanel.querySelector('form > button').before(uporabiZa);
  const skupineDialog = document.createElement('dialog');
  skupineDialog.className = 'scit-skupine-dialog';
  skupineDialog.setAttribute('aria-labelledby', 'scit-skupine-naslov');
  skupineDialog.innerHTML = '<header><h2 id="scit-skupine-naslov">Imenik · skupine</h2><button type="button" data-skupine-zapri aria-label="Zapri imenik">×</button></header><p>Izberite eno ali več skupin za celoten korak.</p><div data-skupine-seznam></div><p data-skupine-napaka role="status" hidden></p><footer><span data-skupine-stevilo aria-live="polite"></span><button type="button" data-skupine-potrdi>Potrdi izbiro</button></footer>';
  document.body.append(skupineDialog);
  let prikazaneSkupine = [];
  let osnutekSkupin = new Set();
  let skupineZadeve = [];
  document.addEventListener('uj:scit:zadeve-nalozene', e => { skupineZadeve = e.detail || []; });
  function stikiSkupin() {
    const api=window.UJNedavnaPodjetja;
    const deleted=new Set(JSON.parse(localStorage.getItem('uj_scit_podjetja_izbrisana_v1')||'[]'));
    return api.zdruziPodjetjaSStiki(api.podjetjaIzZadev(skupineZadeve),JSON.parse(localStorage.getItem('uj_scit_podjetja_podatki_v1')||'{}')).filter(c=>!deleted.has(c.storageKey));
  }
  function preberiSkupineKoraka() {
    const groups=window.UJNedavnaPodjetja.normalizirajKategorije(JSON.parse(localStorage.getItem('uj_scit_podjetja_kategorije_v1') || '[]'));
    return [{id:'__vse__',name:'Vse',companyKeys:stikiSkupin().map(c=>c.storageKey)},...groups];
  }
  function preglejSkupino(group,total,panel) {
    let adding=false;
    const status=document.createElement('p');status.setAttribute('role','status');
    function change(contact,add) {
      try {
        const key='uj_scit_podjetja_kategorije_v1';
        const groups=window.UJNedavnaPodjetja.normalizirajKategorije(JSON.parse(localStorage.getItem(key)||'[]'));
        const target=groups.find(g=>g.id===group.id);
        if(!target) throw new Error('missing');
        target.companyKeys=target.companyKeys.filter(k=>k!==contact.storageKey);
        if(add) target.companyKeys.push(contact.storageKey);
        localStorage.setItem(key,JSON.stringify(groups));group.companyKeys=[...target.companyKeys];render();osveziSkupinePovzetek();
      } catch (_) { status.textContent='Spremembe ni bilo mogoče shraniti.'; }
    }
    function render() {
      panel.replaceChildren();
      const all=stikiSkupin();const contacts=all.filter(c=>group.companyKeys.includes(c.storageKey));
      total.textContent=contacts.length+' stikov';
      if(!contacts.length){const empty=document.createElement('p');empty.textContent='V tej skupini še ni podjetij.';panel.append(empty);}
      function contactRow(c,add) {
        const row=document.createElement('div');row.className='scit-skupina-kontakt';
        const info=document.createElement('div'),name=document.createElement('strong'),details=document.createElement('span');
        name.textContent=c.name;details.textContent=c.phone||c.email||'';info.append(name,details);row.append(info);
        if(group.id!=='__vse__') {const button=document.createElement('button');button.type='button';button.className='scit-skupina-odstrani';button.textContent=add?'+':'×';button.setAttribute('aria-label',(add?'Dodaj ':'Odstrani ')+c.name+(add?' v skupino':' iz skupine'));button.onclick=()=>change(c,add);row.append(button);}
        return row;
      }
      contacts.forEach(c=>panel.append(contactRow(c,false)));
      if(group.id!=='__vse__') {
        const add=document.createElement('button');add.type='button';add.className='scit-skupina-dodaj';add.textContent=adding?'Skrij dodajanje':'＋ Dodaj podjetje';add.onclick=()=>{adding=!adding;render();};panel.append(add);
        if(adding){const available=all.filter(c=>!group.companyKeys.includes(c.storageKey));if(!available.length){const empty=document.createElement('p');empty.textContent='Vsa podjetja iz imenika so že v skupini.';panel.append(empty);}available.forEach(c=>panel.append(contactRow(c,true)));}
      }
      status.textContent='';panel.append(status);
    }
    render();
  }
  function osveziSkupinePovzetek() {
    const selected = aktivniLastni?.skupine || [];
    let groups;
    try { groups = preberiSkupineKoraka(); } catch (_) { uporabiZa.querySelector('[data-skupine-povzetek]').textContent = 'Imenik ni dosegljiv'; return; }
    const valid = groups.filter(group => selected.includes(group.id));
    uporabiZa.querySelector('[data-skupine-povzetek]').textContent = !valid.length ? 'Brez skupine' : (valid.length === 1 ? valid[0].name : 'Več skupin') + ' · ' + valid.length + '/' + groups.length;
  }
  uporabiZa.querySelector('button').addEventListener('click', function odpriSkupine() {
    if (!aktivniLastni) return;
    const list = skupineDialog.querySelector('[data-skupine-seznam]');
    const error = skupineDialog.querySelector('[data-skupine-napaka]');
    const confirm = skupineDialog.querySelector('[data-skupine-potrdi]');
    list.replaceChildren(); error.hidden = true; confirm.disabled = false;
    try { prikazaneSkupine = preberiSkupineKoraka(); }
    catch (_) { prikazaneSkupine = []; error.textContent = 'Skupin ni mogoče prebrati. Zaprite imenik in poskusite znova.'; error.hidden = false; confirm.disabled = true; }
    osnutekSkupin = new Set(prikazaneSkupine.filter(group => (aktivniLastni.skupine || []).includes(group.id)).map(group => group.id));
    const noGroup = document.createElement('button');
    noGroup.type = 'button'; noGroup.className = 'scit-brez-skupine';
    noGroup.innerHTML = '<span aria-hidden="true"></span><strong>Brez skupine</strong><small>Za posamezno podjetje</small>';
    noGroup.onclick = () => {
      osnutekSkupin.clear();
      list.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; });
      count();
    };
    list.append(noGroup);
    function count() {
      noGroup.setAttribute('aria-pressed', String(osnutekSkupin.size === 0));
      skupineDialog.querySelector('[data-skupine-stevilo]').textContent = osnutekSkupin.size ? 'Izbrano: ' + osnutekSkupin.size + '/' + prikazaneSkupine.length : 'Brez skupine';
    }
    prikazaneSkupine.forEach(function (group) {
      const row = document.createElement('div'); row.className = 'scit-skupina-izbira';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = osnutekSkupin.has(group.id);
      const name = document.createElement('span'); name.textContent = group.name;
      const total = document.createElement('small'); total.textContent = group.companyKeys.length + ' stikov';
      checkbox.addEventListener('change', function () { if (checkbox.checked) osnutekSkupin.add(group.id); else osnutekSkupin.delete(group.id); count(); });
      const choice=document.createElement('label');choice.className='scit-skupina-ime';choice.append(checkbox,name);row.append(choice);
      if(group.id!=='__vse__'){
        const rename=document.createElement('button');rename.type='button';rename.className='scit-skupina-preimenuj';rename.textContent='Preimenuj';
        const input=document.createElement('input');input.type='text';input.maxLength=40;input.className='scit-skupina-ime-polje';input.setAttribute('aria-label','Novo ime skupine');input.hidden=true;row.append(input,rename);
        function save(){const value=input.value.trim();if(!value){input.setCustomValidity('Vnesite ime skupine.');input.reportValidity();return;}try{const key='uj_scit_podjetja_kategorije_v1';const groups=preberiSkupineKoraka().filter(g=>g.id!=='__vse__');const target=groups.find(g=>g.id===group.id);if(!target)throw Error('Missing group');target.name=value;localStorage.setItem(key,JSON.stringify(groups));group.name=value;name.textContent=value;input.hidden=true;choice.hidden=false;rename.textContent='Preimenuj';osveziSkupinePovzetek();}catch(_){error.textContent='Imena ni mogoče shraniti.';error.hidden=false;}}
        rename.onclick=()=>{if(!input.hidden){save();return;}input.value=group.name;choice.hidden=true;input.hidden=false;rename.textContent='Shrani';input.focus();input.select();};
        input.oninput=()=>input.setCustomValidity('');input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();save();}if(e.key==='Escape'){e.stopPropagation();e.preventDefault();input.hidden=true;choice.hidden=false;rename.textContent='Preimenuj';rename.focus();}};
      }
      const card=document.createElement('div');card.className='scit-skupina-kartica';if(group.id!=='__vse__' && /^#[0-9a-f]{6}$/i.test(group.color||'')){card.classList.add('ima-barvo-skupine');card.style.setProperty('--barva-skupine',group.color);}if(group.id==='__vse__')card.classList.add('je-vse');
      const review=document.createElement('button');review.type='button';review.className='scit-skupina-preglej';const reviewLabel=document.createElement('span');reviewLabel.textContent='Preglej skupino';review.append(reviewLabel,total);const panel=document.createElement('div');panel.className='scit-skupina-harmonika';panel.hidden=true;review.setAttribute('aria-expanded','false');review.onclick=()=>{panel.hidden=!panel.hidden;review.setAttribute('aria-expanded',String(!panel.hidden));reviewLabel.textContent=panel.hidden?'Preglej skupino':'Skrij skupino ⌃';if(!panel.hidden)preglejSkupino(group,total,panel);};
      card.append(row,review,panel);list.append(card);
    });
    if (!prikazaneSkupine.length && error.hidden) { const empty = document.createElement('p'); empty.textContent = 'V imeniku še ni skupin. Najprej jih ustvarite v imeniku.'; list.append(empty); }
    count(); if (!skupineDialog.open) skupineDialog.showModal();
  });
  skupineDialog.querySelector('[data-skupine-zapri]').addEventListener('click', () => skupineDialog.close());
  skupineDialog.querySelector('[data-skupine-potrdi]').addEventListener('click', function () {
    if (!aktivniLastni) return;
    aktivniLastni.skupine = Array.from(osnutekSkupin);
    osveziSkupinePovzetek(); skupineDialog.close();
  });
  skupineDialog.addEventListener('keydown', function (event) { if (event.key === 'Escape') event.stopPropagation(); });
  skupineDialog.addEventListener('close', () => { uporabiZa.querySelector('button').focus({preventScroll:true}); });
  document.querySelector('.scit-storitve__mreza').after(lastniPanel);
  const lastniMreza = document.querySelector('.scit-storitve__mreza');
  const lastniSidro = document.createComment('storitve'); lastniMreza.before(lastniSidro);
  const lastniMeni = document.createElement('section');lastniMeni.className='scit-lastni-meni';lastniMeni.hidden=true;lastniMeni.setAttribute('role','region');lastniMeni.setAttribute('aria-labelledby','lastni-meni-naslov');
  lastniMeni.innerHTML='<div class="scit-lastni-meni__list"><header><button type="button" data-lastni-preklic aria-label="Nazaj na Prodajni ščit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>Nazaj</span></button><h2 id="lastni-meni-naslov">Sestavite svoj korak</h2></header><p>Izberite možnosti v storitvah, preverite vsebino in poimenujte svoj korak.</p><div data-lastni-meni-vsebina></div></div>';
  document.body.appendChild(lastniMeni);
  const storitevSidro=document.createComment('storitev-popup');storitevPopup.before(storitevSidro);
  const pregledGumb=document.createElement('button');pregledGumb.type='button';pregledGumb.className='scit-lastni-preglej';pregledGumb.textContent='Izbrano: 0 · Preglej';lastniMeni.querySelector('.scit-lastni-meni__list').appendChild(pregledGumb);
  pregledGumb.addEventListener('click',function(){const pregled=lastniMeni.classList.toggle('je-pregled');if(pregled)zapriStoritev();osveziLastni();});
  let prejsnjaIzbira=null;
  function zapriLastniMeni() { if(storitevPopup.classList.contains("je-harmonika"))zapriStoritev(); lastniSidro.after(lastniMreza);lastniMreza.after(lastniPanel);lastniMeni.hidden=true;document.body.classList.remove('scit-lastni-odprt');document.querySelector('[data-preset-dodaj]').focus(); }
  function prekliciLastni() { zapustiLastni();zapriLastniMeni();storitveniGumbi.forEach(g=>g.classList.remove('je-v-prednastavitvi'));delete document.querySelector('.scit-storitve').dataset.prednastavitev;document.querySelector('[data-scit-prednastavitev-opis]').textContent='';if(prejsnjaIzbira)prejsnjaIzbira.click(); }
  lastniMeni.querySelector('[data-lastni-preklic]').addEventListener('click',prekliciLastni);
  lastniMeni.addEventListener('keydown',function(e){if(e.key==='Escape' && storitevPopup.hidden){e.preventDefault();e.stopPropagation();prekliciLastni();}});
  function kopija(v) { return JSON.parse(JSON.stringify(v)); }
  function naloziStoritve(v) { Object.keys(stanjeStoritev).forEach(k => delete stanjeStoritev[k]); Object.assign(stanjeStoritev, kopija(v)); }
  function zapustiLastni() {
    if (!aktivniLastni) return;
    aktivniLastni.vsebina = kopija(stanjeStoritev);
    aktivniLastni = null; lastniPanel.hidden = true;
    naloziStoritve(osnovneStoritve || {}); osnovneStoritve = null;
  }
  function osveziLastni() {
    if (!aktivniLastni) return;
    osveziSkupinePovzetek();
    aktivniLastni.vsebina = kopija(stanjeStoritev);
    const stevilo=Object.values(stanjeStoritev).reduce((n,v)=>n+(v.moznosti||[]).length,0);pregledGumb.textContent=lastniMeni.classList.contains('je-pregled')?'‹ Nazaj na izbiro':'Izbrano: '+stevilo+' · Preglej';
    const seznam = lastniPanel.querySelector('[data-lastni-vsebina]'); seznam.replaceChildren();
    if (!stevilo) { const namig=document.createElement('p'); namig.className='scit-lastni-prazno'; namig.textContent='Izberite možnosti zgoraj. Tukaj se sestavi vaš korak.'; seznam.appendChild(namig); }
    osveziShranjevanje();
    const barve = [], nazivi = [];
    storitveniGumbi.forEach(function(gumb) {
      const tip = gumb.dataset.storitev, izbire = (stanjeStoritev[tip] || {}).moznosti || [];
      gumb.classList.toggle('je-v-prednastavitvi', izbire.length > 0);
      if (!izbire.length) return;
      const barva = getComputedStyle(gumb).getPropertyValue('--storitev-barva').trim(); barve.push(barva);
      const naziv = gumb.innerText.replace(/\s+/g,' '); nazivi.push(naziv);
      const skupina = document.createElement('div'); skupina.className = 'scit-lastni-skupina'; skupina.style.setProperty('--lastni-barva',barva);
      const naslov = document.createElement('strong'); naslov.textContent = naziv; skupina.appendChild(naslov);
      izbire.forEach(function(izbira) { const vrstica = document.createElement('div'); const tekst = document.createElement('span'); tekst.textContent = izbira; const brisi = document.createElement('button'); brisi.type='button'; brisi.textContent='×'; brisi.setAttribute('aria-label','Odstrani: '+izbira); brisi.addEventListener('click',function(){ stanjeStoritev[tip].moznosti=stanjeStoritev[tip].moznosti.filter(v=>v!==izbira);osveziLastni(); }); vrstica.append(tekst,brisi);skupina.appendChild(vrstica); });
      seznam.appendChild(skupina);
    });

    const opis=document.querySelector('[data-scit-prednastavitev-opis]');
    const naslov=document.createElement('strong');naslov.textContent=aktivniLastni.naziv;
    const podnaslov=document.createElement('span');const izbraneMoznosti=Object.values(stanjeStoritev).flatMap(v=>v.moznosti||[]);podnaslov.textContent=izbraneMoznosti.length?izbraneMoznosti.join(' · '):'Izberite, kaj naj korak vsebuje.';opis.replaceChildren(naslov,podnaslov);
    aktivniLastni.gumb.querySelector('strong').textContent=aktivniLastni.naziv;
    aktivniLastni.gumb.querySelector('.scit-prednastavitev__krog').style.setProperty('--preset-obroba',barve.length?'conic-gradient('+barve.map((b,i)=>b+' '+(i*100/barve.length)+'% '+((i+1)*100/barve.length)+'%').join(',')+')':'linear-gradient(#3f9998,#3f9998)');
  }
  function izberiLastni(korak) {
    if (aktivniLastni===korak) {
      zapustiLastni();korak.gumb.setAttribute('aria-pressed','false');storitveniGumbi.forEach(g=>g.classList.remove('je-v-prednastavitvi'));delete document.querySelector('.scit-storitve').dataset.prednastavitev;document.querySelector('[data-scit-prednastavitev-opis]').textContent='';return;
    }
    zapustiLastni();osnovneStoritve=kopija(stanjeStoritev);aktivniLastni=korak;naloziStoritve(korak.vsebina);
    prednastavitveVsebnik.querySelectorAll('button').forEach(g=>g.setAttribute('aria-pressed',String(g===korak.gumb)));
    document.querySelector('.scit-storitve').dataset.prednastavitev=korak.id;
    lastniPanel.hidden=false;lastniPanel.querySelector('input').value=korak.naziv==='Moj korak'?'':korak.naziv;lastniPanel.querySelector('[data-lastni-status]').textContent='';osveziLastni();
  }
  function osveziShranjevanje() { lastniPanel.querySelector('[type=submit]').disabled = !lastniPanel.querySelector('input').value.trim() || !Object.values(stanjeStoritev).some(v => (v.moznosti || []).length); }
  lastniPanel.querySelector('input').addEventListener('input', osveziShranjevanje);
  lastniPanel.querySelector('form').addEventListener('submit',function(e){e.preventDefault();const ime=lastniPanel.querySelector('input').value.trim();if(!ime||!aktivniLastni)return;if(!Object.values(stanjeStoritev).some(v=>(v.moznosti||[]).length)){lastniPanel.querySelector('[data-lastni-status]').textContent='Izberite vsaj eno možnost v storitvah.';return;}aktivniLastni.naziv=ime;if(!aktivniLastni.gumb.isConnected){lastniKoraki.push(aktivniLastni);prednastavitveVsebnik.appendChild(aktivniLastni.gumb);aktivniLastni.gumb.setAttribute('aria-pressed','true');}osveziLastni();zapriLastniMeni();osveziPike();prednastavitveVsebnik.scrollTo({left:prednastavitveVsebnik.scrollWidth,behavior:'smooth'});lastniPanel.querySelector('[data-lastni-status]').textContent='Korak je shranjen.';});
  const pikeVsebnik = document.querySelector('[data-preset-pike]');
  function osveziPike() {
    const stevilo=Math.max(1,prednastavitveVsebnik.children.length-3);
    if(pikeVsebnik.children.length!==stevilo){pikeVsebnik.replaceChildren();for(let i=0;i<stevilo;i++){const pika=document.createElement('button');pika.type='button';pika.setAttribute('aria-label','Prikaži prednastavitve '+(i+1)+'–'+(i+4));pika.addEventListener('click',()=>prednastavitveVsebnik.scrollTo({left:i*prednastavitveVsebnik.clientWidth/4,behavior:'smooth'}));pikeVsebnik.appendChild(pika);}}
    const indeks=Math.min(stevilo-1,Math.round(prednastavitveVsebnik.scrollLeft/(prednastavitveVsebnik.clientWidth/4||1)));
    Array.from(pikeVsebnik.children).forEach((p,i)=>p.setAttribute('aria-current',String(i===indeks)));
  }
  prednastavitveVsebnik.addEventListener('scroll',osveziPike,{passive:true});window.addEventListener('resize',osveziPike);osveziPike();
  document.querySelector('[data-preset-dodaj]').addEventListener('click',function(){
    const korak={id:'lastni-'+(lastniKoraki.length+1),naziv:'Moj korak',vsebina:{}};
    const gumb=document.createElement('button');gumb.type='button';gumb.className='scit-prednastavitev';gumb.dataset.scitPrednastavitev=korak.id;gumb.setAttribute('aria-pressed','false');gumb.innerHTML='<span class="scit-prednastavitev__krog" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 16 12-12 4 4-12 12-5 1Z"/></svg></span><strong>Moj korak</strong>';korak.gumb=gumb;gumb.addEventListener('click',()=>izberiLastni(korak));prejsnjaIzbira=prednastavitveVsebnik.querySelector('[aria-pressed="true"]');izberiLastni(korak);lastniMeni.querySelector('[data-lastni-meni-vsebina]').append(lastniMreza,lastniPanel);lastniMeni.classList.remove('je-pregled');lastniMeni.hidden=false;osveziLastni();document.body.classList.add('scit-lastni-odprt');odpriStoritev('zascita', lastniMreza.querySelector('[data-storitev=zascita]'));lastniMeni.querySelector('[data-lastni-preklic]').focus();
  });

  let odprtTip = "";
  let odprtaStoritev = "";
  let izbraniUkrep = "";
  let toastCas = 0;
  const vrstniRed = ["kontakt", "dogodek", "ukrepi", "kategorija", "meja", "opomba"];
  let trenutniKorak = 0;
  let povlekX = 0;

  const koraki = {
    kontakt: { stevilka: 1, naslov: "Kdo vas kontaktira?", opis: "Prilepite telefonsko številko, e-pošto ali prejeto sporočilo.", placeholder: "npr. 031 555 222 ali prodaja@podjetje.si" },
    dogodek: { stevilka: 2, naslov: "Kaj se je zgodilo?", opis: "Izberite odgovor, ki najbolje opiše stik.", moznosti: [["telefon", "Kliče zdaj"], ["nazaj", "Želi povratni klic"], ["ponudba", "Poslal je ponudbo"], ["sporocilo", "Poslal je sporočilo"], ["obisk", "Želi sestanek"], ["drugo", "Nekaj drugega"]], placeholder: "npr. kliče ponovno čez eno uro" },
    ukrepi: { stevilka: 3, naslov: "Kaj naj naredimo?", opis: "Izberete lahko več nalog.", vec: true, moznosti: [["prevzem", "Prevzemite klic"], ["poklic", "Pokličite nazaj"], ["pisna", "Pridobite pisno ponudbo"], ["preveri", "Preverite prodajalca"], ["pogajanja", "Pogajajte se"], ["ustavi", "Naj me ne kliče več"]], placeholder: "npr. najprej mi pošljite SMS" },
    kategorija: { stevilka: 4, naslov: "Kaj vam ponuja?", opis: "Označite področje ponudbe.", moznosti: [["telekom", "Telefonija in internet"], ["energija", "Elektrika ali plin"], ["zavarovanje", "Zavarovanje"], ["oprema", "Orodje ali oprema"], ["vozilo", "Vozilo ali leasing"], ["marketing", "Oglaševanje"], ["finance", "Finance"], ["drugo", "Drugo"]], placeholder: "npr. sončno elektrarno" },
    meja: { stevilka: 5, naslov: "Kaj naj upoštevamo?", opis: "Izberite najpomembnejše pogoje.", vec: true, moznosti: [["stroski", "Brez skritih stroškov"], ["vezava", "Brez dolge vezave"], ["cena", "Najnižja končna cena"], ["pisno", "Vse mora biti pisno"], ["presodite", "Presodite vi"], ["porocilo", "Najprej samo poročilo"]], placeholder: "npr. klic samo dopoldne" },
    opomba: { stevilka: 6, naslov: "Še kaj pomembnega?", opis: "Dodajte neobvezno navodilo za našo ekipo.", placeholder: "npr. pokličite po 15. uri", textarea: true }
  };

  const storitve = {
    zascita: {
      naslov: "Zaščita pred klici",
      opis: "Dodajte tudi stare prodajne klice ali kontakte, ki vas še vedno motijo.",
      polje: "Prodajalec, številka ali e-pošta",
      placeholder: "npr. 030 555 222 ali prodaja@podjetje.si",
      moznosti: ["Zaščiti prihodnje klice", "Po vsakem klicu mi pošljite sporočilo", "Spustite skozi samo potrjene klice", "Dodajte tudi stare klicatelje"],
      gumb: "Vklopi zaščito"
    },
    povratni: {
      naslov: "Povratni klic",
      opis: "Mi pokličemo prodajalca in opravimo pogovor namesto vas.",
      polje: "Koga naj pokličemo?",
      placeholder: "Telefonska številka, e-pošta ali ime podjetja",
      moznosti: ["Čim prej", "Danes", "Naslednji delovni dan", "Termin določim v opombi"],
      opomba: "Kaj naj vprašamo ali sporočimo?",
      gumb: "Naroči povratni klic"
    },
    ponudba: {
      naslov: "Pridobi ponudbo",
      opis: "Izberite, v kakšni obliki želite jasno in primerljivo ponudbo.",
      polje: "Prodajalec ali podjetje",
      placeholder: "Kontakt, ime podjetja ali prejeta ponudba",
      moznosti: ["Pisno po e-pošti", "PDF ponudba", "Predračun", "Končna cena z vsemi stroški", "Pogajajte se za boljše pogoje", "Pridobite druge ponudbe"],
      opomba: "Kaj mora ponudba vsebovati?",
      gumb: "Pridobi ponudbo"
    },
    ustavi: {
      naslov: "Ustavi klice",
      opis: "Ponudbo zavrnemo in prodajalcu jasno sporočimo, naj vas ne kontaktira več.",
      polje: "Kdo naj vas ne kliče več?",
      placeholder: "Številka, e-pošta ali ime prodajalca",
      moznosti: ["Vljudno zavrni ponudbo", "Prepovej nadaljnje klice", "Zahtevaj izbris kontakta", "Ustavi vse kanale"],
      opomba: "Posebno navodilo za zavrnitev",
      gumb: "Ustavi prodajne klice"
    },
    preveri: {
      naslov: "Preveri in oceni",
      opis: "Preverimo prodajalca in podjetje ter pripravimo oceno s priporočilom.",
      polje: "Koga naj preverimo?",
      placeholder: "Ime podjetja, spletna stran, telefon ali e-pošta",
      moznosti: ["Podjetje in registracija", "Cena in pogoji", "Tveganja in ugled", "Celovito preverjanje", "Primerjajte ponudbo z drugimi ponudbami"],
      opomba: "Kaj vas pri ponudbi najbolj skrbi?",
      gumb: "Začni preverjanje"
    }
  };
  window.prodajniScitStoritve = storitve;
  const storitevVUkrep = { zascita: "prevzem", povratni: "poklic", ponudba: "pisna", ustavi: "ustavi", preveri: "preveri" };

  const oznake = {};
  Object.keys(koraki).forEach(function (tip) { (koraki[tip].moznosti || []).forEach(function (moznost) { oznake[moznost[0]] = moznost[1]; }); });

  function pokaziToast(besedilo) {
    window.clearTimeout(toastCas);
    toast.textContent = besedilo;
    toast.hidden = false;
    toastCas = window.setTimeout(function () { toast.hidden = true; }, 2500);
  }

  function brezSumnikov(besedilo) {
    return besedilo.toLocaleLowerCase("sl").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function vsebuje(besedilo, iskano) {
    return iskano.some(function (del) { return besedilo.includes(del); });
  }

  function razcleniAteninVnos() {
    const kontakt = atenaKontakt.value.trim();
    if (kontakt.length < 3) {
      atenaKontakt.focus();
      pokaziToast("Najprej vnesite kontakt prodajalca.");
      return;
    }
    const opis = atenaOpis.value.trim();
    if (!opis) {
      atenaOpis.focus();
      pokaziToast("Zdaj napišite vprašanje ali navodilo za Ateno.");
      return;
    }

    const cisto = brezSumnikov(opis);
    stanje.kontakt = kontakt;
    stanje.brezKontakta = false;

    if (vsebuje(cisto, ["sporocil", "e-post", "email", "mail"])) stanje.dogodek = "sporocilo";
    else if (vsebuje(cisto, ["ponudb", "predracun"])) stanje.dogodek = "ponudba";
    else if (vsebuje(cisto, ["sestanek", "obisk"])) stanje.dogodek = "obisk";
    else if (vsebuje(cisto, ["povratni", "poklic nazaj"])) stanje.dogodek = "nazaj";
    else if (vsebuje(cisto, ["klice", "klical", "telefon"])) stanje.dogodek = "telefon";
    else stanje.dogodek = "drugo";

    stanje.ukrepi = [];
    if (vsebuje(cisto, ["prevzem", "javite se", "oglasite se"])) stanje.ukrepi.push("prevzem");
    if (vsebuje(cisto, ["poklic", "povratni"])) stanje.ukrepi.push("poklic");
    if (vsebuje(cisto, ["pisn", "ponudb", "predracun"])) stanje.ukrepi.push("pisna");
    if (vsebuje(cisto, ["prever", "ocen", "ali je posten"])) stanje.ukrepi.push("preveri");
    if (vsebuje(cisto, ["pogaj", "boljsa cena"])) stanje.ukrepi.push("pogajanja");
    if (vsebuje(cisto, ["ne klice", "ustav", "zavrni", "izbris kontakta"])) stanje.ukrepi.push("ustavi");
    if (!stanje.ukrepi.length) stanje.ukrepi = ["preveri"];

    if (vsebuje(cisto, ["marketing", "oglasevan", "reklam"] )) stanje.kategorija = "marketing";
    else if (vsebuje(cisto, ["telefonij", "internet", "telekom"])) stanje.kategorija = "telekom";
    else if (vsebuje(cisto, ["elektrik", "plin", "energij"])) stanje.kategorija = "energija";
    else if (vsebuje(cisto, ["zavarov"] )) stanje.kategorija = "zavarovanje";
    else if (vsebuje(cisto, ["orodj", "oprem"] )) stanje.kategorija = "oprema";
    else if (vsebuje(cisto, ["vozil", "avto", "leasing"])) stanje.kategorija = "vozilo";
    else if (vsebuje(cisto, ["financ", "kredit", "posojil"] )) stanje.kategorija = "finance";
    else stanje.kategorija = "drugo";

    stanje.meja = [];
    if (vsebuje(cisto, ["skrit", "strosk"])) stanje.meja.push("stroski");
    if (vsebuje(cisto, ["vezav", "pogodbena doba"])) stanje.meja.push("vezava");
    if (vsebuje(cisto, ["cena", "najcenej", "znesek"])) stanje.meja.push("cena");
    if (vsebuje(cisto, ["pisno", "e-post", "email"])) stanje.meja.push("pisno");
    if (vsebuje(cisto, ["porocil", "samo prever"] )) stanje.meja.push("porocilo");
    if (!stanje.meja.length) stanje.meja = ["presodite"];

    stanje.opomba = opis.length > 220 ? opis.slice(0, 217) + "…" : opis;
    stanje.lastno = {};
    trenutniKorak = 0;
    osveziKartice();
    nastaviNacin("manual");
    rocnoPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    pokaziToast("Atena je izpolnila podatke. Zdaj jih samo preverite.");
  }

  function dodajDatoteko(polje) {
    const datoteka = polje.files && polje.files[0];
    if (!datoteka) return;
    const priponka = "Priloženo: " + datoteka.name;
    atenaOpis.value = [atenaOpis.value.trim(), priponka].filter(Boolean).join("\n");
    pokaziToast("Dokument je dodan v opis.");
    polje.value = "";
  }

  function prikaziPrimerZaslon(tip) {
    document.querySelectorAll("[data-primer-zaslon]").forEach(function (zaslon) { zaslon.hidden = zaslon.dataset.primerZaslon !== tip; });
    if (tip === "porocilo") {
      primerNadnaslov.textContent = "POROČILO O KLICU";
      primerNaslov.textContent = "Telekom Beispiel GmbH";
      primerOpis.textContent = "Danes ob 11:42 · preverjeno";
    } else if (tip === "ukrep") {
      primerNadnaslov.textContent = "NASLEDNJI KORAK";
      primerNaslov.textContent = "Kako naj nadaljujemo?";
      primerOpis.textContent = "Iz poročila neposredno v izvedbo";
    } else {
      primerNadnaslov.textContent = "KONČNA POTRDITEV";
      primerNaslov.textContent = "Preverite izbrani ukrep";
      primerOpis.textContent = "Izvedemo samo tisto, kar potrdite";
    }
    primerPopup.dataset.zaslon = tip;
  }

  function odpriPrimer(tip) {
    prikaziPrimerZaslon(tip);
    primerPopup.hidden = false;
    document.body.classList.add("scit-popup-odprt");
  }

  function zapriPrimer() {
    primerPopup.hidden = true;
    document.body.classList.remove("scit-popup-odprt");
    delete primerPopup.dataset.zaslon;
  }

    const razlage={
      zascita:['','Po klicu prejmete kratek povzetek pogovora in dogovorov.','Do vas spustimo samo klicatelje, ki jih določite kot potrjene v nastavitvah koraka.','Zaščito razširite tudi na prodajalce, ki so vas kontaktirali že prej.'],
      povratni:['','Pri prodajalcu preverimo podatke, ki jih še potrebujete.','Prodajalca prosimo, da odgovor pošlje v pisni obliki.','Dogovorimo se za čas, ki vam ustreza.'],
      ponudba:['','Ponudbo pridobimo kot dokument PDF.','Pridobimo predračun za pregled pred odločitvijo.','Preverimo celoten znesek, vključno z dodatnimi stroški.','Pri prodajalcu preverimo možnost ugodnejše cene ali pogojev.','Pridobimo dodatne ponudbe za primerjavo.'],
      ustavi:['','Prodajalcu sporočimo, da trenutne ponudbe ne sprejmete.','Posredujemo zahtevo za odjavo iz prodajne ali marketinške baze.','Zahtevamo prenehanje prodajnih stikov po telefonu in drugih kanalih.'],
      preveri:['','Preverimo osnovne podatke podjetja in registracijo.','Preverimo, kdo vas kontaktira in katere podatke je navedel.','Pregledamo ceno, pogodbo in pogoje ponudbe.','Povzamemo ugotovitve in opozorimo na pomembne podrobnosti.','Primerjamo ceno in pogoje z drugimi ponudbami.'],
    };
  function prikaziRazlagoStoritve(tip) {
    if (storitevPopup.hidden || !lastniMeni.hidden || odprtaStoritev !== tip) return;
    storitevVsebina.querySelectorAll('.zascita-kontakti').forEach(function(skupina){
      const izbor=skupina.querySelector('[data-storitev-vrednost]');
      if(!izbor)return;
      const kartica=document.createElement('button');kartica.type='button';kartica.className='zascita-vrstica';kartica.dataset.storitevVrednost=izbor.dataset.storitevVrednost;
      const naslov=document.createElement('span');naslov.className='zascita-vrstica__naziv';naslov.textContent=izbor.dataset.storitevVrednost;kartica.appendChild(naslov);skupina.replaceWith(kartica);
    });

    storitevVsebina.querySelectorAll('[data-storitev-vrednost]').forEach(function(gumb,i){
      gumb.removeAttribute('data-storitev-vrednost');gumb.removeAttribute('aria-pressed');gumb.setAttribute('role','article');gumb.tabIndex=-1;
      gumb.querySelectorAll('[class$="-izbira"]').forEach(e=>e.remove());
      if(razlage[tip] && razlage[tip][i]) {const opis=document.createElement('span');opis.className='storitev-razlaga';opis.textContent=razlage[tip][i];gumb.appendChild(opis);}
    });
  }
  function odpriStoritev(tip, gumb) {
    storitevPopup.classList.toggle('je-razlaga',lastniMeni.hidden);
    if (!lastniMeni.hidden) {
      if (odprtaStoritev === tip && !storitevPopup.hidden) { zapriStoritev(); return; }
      if (!storitevPopup.hidden) zapriStoritev();
      storitevPopup.classList.add('je-harmonika');storitevPopup.removeAttribute('aria-modal');storitevPopup.setAttribute('role','region');
      const indeks=storitveniGumbi.indexOf(gumb);const konecVrstice=storitveniGumbi[storitveniGumbi.length-1];konecVrstice.after(storitevPopup);
      storitveniGumbi.forEach(g=>g.setAttribute('aria-expanded',String(g===gumb)));
    }

    const nastavitev = storitve[tip];
    const shranjeno = stanjeStoritev[tip] || { moznosti: [] };
    stanjeStoritev[tip] = shranjeno;
    odprtaStoritev = tip;
    storitevPopup.dataset.tip = tip;
    storitevNaslov.textContent = nastavitev.naslov;
    storitevOpis.textContent = nastavitev.opis;
    storitevIkona.innerHTML = gumb.querySelector("svg").outerHTML;
    storitevOddaj.textContent = "Potrdi izbiro";
    storitevVsebina.innerHTML = '<div class="storitev-moznosti" aria-label="Izberite, kaj potrebujete">' + nastavitev.moznosti.map(function (moznost, indeks) {
        const zascita = tip === "zascita";
        if (zascita && indeks >= 2) return zascitaKontaktiHTML(indeks === 2 ? 'potrjeni' : 'stari', moznost, shranjeno);
        let vsebina = varno(moznost);
        if (zascita && indeks === 0) {
          vsebina = '<img class="zascita-hero__slika" src="assets/jezomir-slusalke-v1-thin-v2.png" alt="" /><span class="zascita-hero__besedilo"><strong data-zascita-fit="20">' + varno(moznost) + '</strong><span data-zascita-fit="12">Prevzamemo prodajne klice.</span></span>';
        } else if (zascita) {
          const ikone = ['ponudba', 'preveri', 'povratni'];
          const ikona = document.querySelector('[data-storitev="' + ikone[indeks - 1] + '"] svg');
          vsebina = '<span class="zascita-vrstica__ikona" aria-hidden="true">' + ikona.outerHTML + '</span><span class="zascita-vrstica__naziv" data-zascita-fit="13">' + varno(moznost) + '</span>';
        }
        return '<button type="button" class="' + (zascita ? (indeks === 0 ? 'zascita-hero' : 'zascita-vrstica') : '') + '" data-storitev-vrednost="' + varno(moznost) + '" aria-pressed="' + shranjeno.moznosti.includes(moznost) + '">' + vsebina + (zascita ? '<span class="zascita-izbira" aria-hidden="true"></span>' : '') + '</button>';
      }).join("") + '</div>';
    storitevPopup.querySelector('.storitev-popup__varnost').textContent = tip === 'zascita' ? 'Brez vaše končne potrditve ničesar ne naročimo ali sprejmemo.' : 'Pred izvedbo vsake pomembne odločitve vas prosimo za potrditev.';
    storitevPopup.hidden = false;
    requestAnimationFrame(function(){ prilagodiZascito(); prikaziRazlagoStoritve(tip); });
    document.body.classList.add("scit-popup-odprt");
  }


  function zascitaKontaktiHTML(vrsta, naslov, shranjeno) {
    if (!shranjeno.kontakti) shranjeno.kontakti = { potrjeni: [], stari: [] };
    return '<section class="zascita-kontakti" data-kontakt-skupina="' + vrsta + '"><div class="zascita-kontakti__glava"><button type="button" class="zascita-kontakti__izbor" data-storitev-vrednost="' + varno(naslov) + '" aria-pressed="' + shranjeno.moznosti.includes(naslov) + '"><span class="zascita-kontakti__naslov" data-zascita-fit="13">' + varno(naslov) + '</span><span class="zascita-izbira" aria-hidden="true"></span></button><button class="zascita-kontakti__plus" type="button" data-kontakt-plus aria-haspopup="dialog" aria-label="Dodaj ' + (vrsta === 'potrjeni' ? 'potrjeni kontakt' : 'starega klicatelja') + '">+</button></div><button type="button" class="zascita-kontakti__pregled" data-kontakt-pregled aria-haspopup="dialog"><span>' + (vrsta === 'potrjeni' ? 'Potrjeni klici' : 'Stari klicatelji') + '</span><span data-kontakt-stevilo>' + shranjeno.kontakti[vrsta].length + '</span><span aria-hidden="true">›</span></button></section>';
  }

  const kontaktDialog = document.createElement('dialog');
  kontaktDialog.className = 'zascita-kontakt-dialog';
  kontaktDialog.setAttribute('aria-labelledby', 'zascita-kontakt-naslov');
  kontaktDialog.innerHTML = '<header><div><h2 id="zascita-kontakt-naslov" tabindex="-1"></h2><p data-kontakt-pojasnilo></p></div><button type="button" data-kontakt-zapri aria-label="Zapri kontakte">×</button></header><form class="zascita-kontakti__obrazec" data-kontakt-obrazec><h3>Dodajte kontakt</h3><label>Ime ali podjetje (neobvezno)<input name="ime" autocomplete="off" placeholder="Ime kontakta ali podjetja" maxlength="120" /></label><label>Telefon ali e-pošta<input name="kontakt" autocomplete="off" placeholder="Telefonska številka ali e-pošta" required maxlength="160" /></label><p class="zascita-kontakti__napaka" data-kontakt-napaka role="alert" hidden></p><button class="zascita-kontakt-dialog__dodaj" type="submit">+ Dodaj kontakt</button></form><section class="zascita-kontakt-dialog__kontakti" aria-label="Dodani kontakti"><header><h3>Vsi kontakti</h3><span data-dialog-stevilo></span></header><div data-dialog-seznam></div></section><p class="zascita-kontakt-dialog__status" role="status" data-kontakt-status></p><button type="button" class="zascita-kontakt-dialog__koncano" data-kontakt-zapri>Končano</button>';
  document.body.appendChild(kontaktDialog);
  const kontaktObrazec = kontaktDialog.querySelector('form');
  let kontaktVrsta = '';

  function osveziKontaktDialog() {
    const seznam = stanjeStoritev.zascita.kontakti[kontaktVrsta];
    kontaktDialog.querySelector('[data-dialog-stevilo]').textContent = String(seznam.length);
    kontaktDialog.querySelector('[data-dialog-seznam]').innerHTML = seznam.length ? seznam.map(function (kontakt, indeks) {
      return '<div class="zascita-kontakti__kontakt"><span><strong data-zascita-fit="14">' + varno(kontakt.ime || kontakt.kontakt) + '</strong>' + (kontakt.ime ? '<small data-zascita-fit="12">' + varno(kontakt.kontakt) + '</small>' : '') + '</span><button type="button" data-kontakt-odstrani="' + indeks + '" aria-label="Odstrani ' + varno(kontakt.ime || kontakt.kontakt) + '">×</button></div>';
    }).join('') : '<p class="zascita-kontakt-dialog__prazno">Seznam je še prazen. Dodajte prvi kontakt zgoraj.</p>';
    const skupina = storitevVsebina.querySelector('[data-kontakt-skupina="' + kontaktVrsta + '"]');
    skupina.querySelector('[data-kontakt-stevilo]').textContent = String(seznam.length);
    prilagodiZascito();
  }

  storitevVsebina.addEventListener('click', function (dogodek) {
    const sprozilec = dogodek.target.closest('[data-kontakt-plus], [data-kontakt-pregled]');
    if (!sprozilec) return;
    kontaktVrsta = sprozilec.closest('[data-kontakt-skupina]').dataset.kontaktSkupina;
    kontaktDialog.querySelector('h2').textContent = kontaktVrsta === 'potrjeni' ? 'Potrjeni klici' : 'Stari klicatelji';
    kontaktDialog.querySelector('[data-kontakt-pojasnilo]').textContent = kontaktVrsta === 'potrjeni' ? 'Dodajte kontakte, katerih klice želite spustiti skozi. Vsi dodani kontakti so na seznamu spodaj.' : 'Dodajte klicatelje, ki so vas že kontaktirali. Vse zbrane kontakte lahko pregledate spodaj.';
    kontaktObrazec.reset();
    kontaktObrazec.querySelectorAll('input').forEach(function (input) { input.style.fontSize = '16px'; });
    kontaktDialog.querySelector('[data-kontakt-napaka]').hidden = true;
    kontaktDialog.querySelector('[data-kontakt-status]').textContent = '';
    kontaktDialog.showModal();
    osveziKontaktDialog();
    if (sprozilec.hasAttribute('data-kontakt-plus')) kontaktObrazec.elements.kontakt.focus();
    else kontaktDialog.querySelector('h2').focus();
  });

  kontaktDialog.addEventListener('click', function (dogodek) {
    if (dogodek.target.closest('[data-kontakt-zapri]')) { kontaktDialog.close(); return; }
    const odstrani = dogodek.target.closest('[data-kontakt-odstrani]');
    if (!odstrani) return;
    stanjeStoritev.zascita.kontakti[kontaktVrsta].splice(Number(odstrani.dataset.kontaktOdstrani), 1);
    osveziKontaktDialog();
    kontaktDialog.querySelector('[data-kontakt-status]').textContent = 'Kontakt je odstranjen.';
  });

  kontaktObrazec.addEventListener('submit', function (dogodek) {
    dogodek.preventDefault();
    const kontakt = kontaktObrazec.elements.kontakt.value.trim();
    const ime = kontaktObrazec.elements.ime.value.trim();
    const seznam = stanjeStoritev.zascita.kontakti[kontaktVrsta];
    const kljuc = function (v) { return v.includes('@') ? v.toLowerCase() : v.replace(/[\s().-]/g, ''); };
    const veljaven = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kontakt) || (/^\+?[\d\s().-]+$/.test(kontakt) && kontakt.replace(/\D/g, '').length >= 5);
    const napaka = kontaktDialog.querySelector('[data-kontakt-napaka]');
    napaka.textContent = !veljaven ? 'Vnesite veljavno telefonsko številko ali e-pošto.' : seznam.some(function (v) { return kljuc(v.kontakt) === kljuc(kontakt); }) ? 'Ta kontakt je že dodan.' : '';
    napaka.hidden = !napaka.textContent;
    if (!napaka.hidden) { kontaktObrazec.elements.kontakt.focus(); return; }
    seznam.push({ ime: ime, kontakt: kontakt });
    const skupina = storitevVsebina.querySelector('[data-kontakt-skupina="' + kontaktVrsta + '"]');
    const izbira = skupina.querySelector('[data-storitev-vrednost]');
    izbira.setAttribute('aria-pressed', 'true');
    if (!stanjeStoritev.zascita.moznosti.includes(izbira.dataset.storitevVrednost)) stanjeStoritev.zascita.moznosti.push(izbira.dataset.storitevVrednost);
    kontaktObrazec.reset();
    kontaktObrazec.querySelectorAll('input').forEach(function (input) { input.style.fontSize = '16px'; });
    osveziKontaktDialog();
    kontaktDialog.querySelector('[data-kontakt-status]').textContent = 'Kontakt je dodan. Dodate lahko naslednjega.';
  });

  kontaktDialog.addEventListener('input', function (dogodek) {
    const polje = dogodek.target;
    if (polje.tagName !== 'INPUT') return;
    const platno = document.createElement('canvas').getContext('2d');
    const slog = getComputedStyle(polje);
    let velikost = 16;
    const sirina = polje.clientWidth - parseFloat(slog.paddingLeft) - parseFloat(slog.paddingRight);
    do { platno.font = velikost + 'px ' + slog.fontFamily; if (platno.measureText(polje.value).width <= sirina) break; velikost -= 0.5; } while (velikost > 9);
    polje.style.fontSize = velikost + 'px';
  });
  new ResizeObserver(prilagodiZascito).observe(kontaktDialog);

  function prilagodiZascito() {
    if (storitevPopup.hidden || odprtaStoritev !== 'zascita') return;
    document.querySelectorAll('[data-zascita-fit]').forEach(function (element) {
      if (!element.getClientRects().length) return;
      let velikost = Number(element.dataset.zascitaFit);
      element.style.fontSize = velikost + 'px';
      while ((element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) && velikost > 9) {
        velikost -= 0.5;
        element.style.fontSize = velikost + 'px';
      }
    });
  }
  new ResizeObserver(prilagodiZascito).observe(storitevVsebina);
  document.fonts.ready.then(prilagodiZascito);

  function zapriStoritev() {
    osveziLastni();
    storitevPopup.hidden = true;
    if(storitevPopup.classList.contains('je-harmonika')) { storitevPopup.classList.remove('je-harmonika');storitevSidro.after(storitevPopup);storitevPopup.setAttribute('role','dialog');storitevPopup.setAttribute('aria-modal','true');storitveniGumbi.forEach(g=>g.removeAttribute('aria-expanded')); }
    document.body.classList.remove("scit-popup-odprt");
    odprtaStoritev = "";
    delete storitevPopup.dataset.tip;
  }

  function imaOdgovor(tip) {
    if (tip === "kontakt") return stanje.brezKontakta || stanje.kontakt.length >= 5;
    if (tip === "ukrepi" || tip === "meja") return stanje[tip].length > 0 || Boolean(stanje.lastno[tip]);
    if (tip === "opomba") return Boolean(stanje.opomba);
    return Boolean(stanje[tip] || stanje.lastno[tip]);
  }

  function povzetek(tip) {
    if (tip === "kontakt") return stanje.brezKontakta ? "Kontakta še nimam" : stanje.kontakt || "Še brez odgovora";
    if (tip === "opomba") return stanje.opomba || "Brez opombe";
    if (stanje.lastno[tip]) return stanje.lastno[tip];
    if (Array.isArray(stanje[tip])) return stanje[tip].map(function (v) { return oznake[v]; }).join(", ") || "Še brez odgovora";
    return oznake[stanje[tip]] || "Še brez odgovora";
  }

  function osveziKartice() {
    carovnikPilli.innerHTML = vrstniRed.map(function (tip, indeks) {
      const razredi = [indeks === trenutniKorak ? "je-aktiven" : "", imaOdgovor(tip) ? "je-izpolnjen" : ""].filter(Boolean).join(" ");
      const oznaka = imaOdgovor(tip) ? "✓ " + (indeks + 1) : String(indeks + 1);
      return '<button type="button" data-carovnik-korak="' + indeks + '" class="' + razredi + '" aria-label="' + koraki[tip].naslov + '">' + oznaka + '</button>';
    }).join("");
    izrisiCarovnik();
    const obvezni = ["kontakt", "dogodek", "ukrepi", "kategorija", "meja"];
    const izpolnjeni = obvezni.filter(imaOdgovor).length;
    oddajStevec.textContent = izpolnjeni + "/" + obvezni.length;
    oddaj.style.setProperty("--scit-izpolnjeno", ((izpolnjeni / obvezni.length) * 100) + "%");
    oddaj.disabled = izpolnjeni !== obvezni.length;
  }

  function izrisiCarovnik() {
    const tip = vrstniRed[trenutniKorak];
    const nastavitev = koraki[tip];
    carovnikKartica.dataset.tip = tip;
    carovnikStevilka.textContent = nastavitev.stevilka;
    carovnikNaslov.textContent = nastavitev.naslov;
    carovnikOpis.textContent = nastavitev.opis;
    let html = "";
    if (tip === "kontakt") {
      html = '<div class="scit-carovnik__lastno"><label>ŠTEVILKA, E-POŠTA ALI SPOROČILO</label><input data-carovnik-lastno autocomplete="off" placeholder="' + nastavitev.placeholder + '" value="' + varno(stanje.kontakt) + '" /></div>';
      html += '<div class="scit-carovnik__izbire scit-carovnik__izbire--kontakt"><button type="button" data-carovnik-brez aria-pressed="' + (stanje.brezKontakta ? "true" : "false") + '">Kontakta še nimam</button></div>';
    } else if (nastavitev.moznosti) {
      html += '<div class="scit-carovnik__izbire">' + nastavitev.moznosti.map(function (moznost) {
        const izbran = nastavitev.vec ? stanje[tip].includes(moznost[0]) : stanje[tip] === moznost[0];
        return '<button type="button" data-carovnik-vrednost="' + moznost[0] + '" aria-pressed="' + izbran + '">' + moznost[1] + '</button>';
      }).join("") + '</div>';
    }
    if (tip !== "kontakt") {
      const vrednost = tip === "opomba" ? stanje.opomba : (stanje.lastno[tip] || "");
      const polje = nastavitev.textarea ? '<textarea data-carovnik-lastno placeholder="' + nastavitev.placeholder + '">' + varno(vrednost) + '</textarea>' : '<input data-carovnik-lastno autocomplete="off" placeholder="' + nastavitev.placeholder + '" value="' + varno(vrednost) + '" />';
      html += '<div class="scit-carovnik__lastno"><label>' + (tip === "opomba" ? "NEOBVEZNA OPOMBA" : "ALI NAPIŠITE SVOJ ODGOVOR") + '</label>' + polje + '</div>';
    }
    carovnikVsebina.innerHTML = html;
    carovnikNazaj.disabled = trenutniKorak <= 0;
    carovnikNaprej.textContent = trenutniKorak === vrstniRed.length - 1 ? "Končano ✓" : "Naprej ›";
    carovnikNapredek.textContent = (trenutniKorak + 1) + " od " + vrstniRed.length;
  }

  function premakniCarovnik(smer) {
    const tip = vrstniRed[trenutniKorak];
    if (smer > 0 && tip !== "opomba" && !imaOdgovor(tip)) {
      pokaziToast("Najprej izberite ali napišite odgovor.");
      return;
    }
    const naslednji = Math.max(0, Math.min(vrstniRed.length - 1, trenutniKorak + smer));
    if (naslednji === trenutniKorak) {
      if (smer > 0) oddaj.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    carovnikKartica.classList.add(smer > 0 ? "je-izhod-levo" : "je-izhod-desno");
    window.setTimeout(function () {
      trenutniKorak = naslednji;
      carovnikKartica.classList.remove("je-izhod-levo", "je-izhod-desno");
      osveziKartice();
    }, 100);
  }

  function varno(vrednost) { return vrednost.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

  function poljeHTML(tip, nastavitev) {
    const vrednost = tip === "kontakt" ? stanje.kontakt : (tip === "opomba" ? stanje.opomba : (stanje.lastno[tip] || ""));
    const polje = nastavitev.textarea ? '<textarea data-lastno-polje placeholder="' + nastavitev.placeholder + '">' + varno(vrednost) + '</textarea>' : '<input data-lastno-polje autocomplete="off" placeholder="' + nastavitev.placeholder + '" value="' + varno(vrednost) + '" />';
    const oznaka = tip === "kontakt" ? "KONTAKT" : (tip === "opomba" ? "OPOMBA" : "ALI NAPIŠITE SVOJ ODGOVOR");
    return '<div class="scit-popup__lastno"><label>' + oznaka + '</label>' + polje + '</div>';
  }

  function odpriPopup(tip) {
    const nastavitev = koraki[tip];
    odprtTip = tip;
    popup.dataset.tip = tip;
    popupKorak.textContent = "KORAK " + nastavitev.stevilka + " OD 6";
    popupNaslov.textContent = nastavitev.naslov;
    popupOpis.textContent = nastavitev.opis;
    let html = "";
    if (nastavitev.moznosti) {
      html += '<div class="scit-popup__izbire">' + nastavitev.moznosti.map(function (moznost) {
        const izbran = nastavitev.vec ? stanje[tip].includes(moznost[0]) : stanje[tip] === moznost[0];
        return '<button type="button" data-popup-vrednost="' + moznost[0] + '" aria-pressed="' + izbran + '">' + moznost[1] + '</button>';
      }).join("") + "</div>";
    }
    html += poljeHTML(tip, nastavitev);
    if (tip === "kontakt") html += '<button type="button" class="scit-popup__kontakt-brez" data-popup-brez aria-pressed="' + stanje.brezKontakta + '">Kontakta še nimam</button>';
    popupVsebina.innerHTML = html;
    popup.hidden = false;
    document.body.classList.add("scit-popup-odprt");
  }

  function zapriPopup() {
    popup.hidden = true;
    document.body.classList.remove("scit-popup-odprt");
    odprtTip = "";
    delete popup.dataset.tip;
    osveziKartice();
  }

  document.querySelectorAll("[data-odpri]").forEach(function (gumb) { gumb.addEventListener("click", function () { odpriPopup(gumb.dataset.odpri); }); });
  document.querySelectorAll("[data-zapri]").forEach(function (gumb) { gumb.addEventListener("click", zapriPopup); });
  document.querySelector("[data-koncano]").addEventListener("click", zapriPopup);

  carovnikPilli.addEventListener("click", function (dogodek) {
    const gumb = dogodek.target.closest("[data-carovnik-korak]");
    if (!gumb) return;
    const indeks = Number(gumb.dataset.carovnikKorak);
    trenutniKorak = indeks;
    osveziKartice();
  });
  carovnikVsebina.addEventListener("click", function (dogodek) {
    const brezKontakta = dogodek.target.closest("[data-carovnik-brez]");
    if (brezKontakta) {
      stanje.brezKontakta = !stanje.brezKontakta;
      if (stanje.brezKontakta) { stanje.kontakt = ""; atenaKontakt.value = ""; }
      osveziKartice();
      return;
    }
    const gumb = dogodek.target.closest("[data-carovnik-vrednost]");
    if (!gumb) return;
    const tip = vrstniRed[trenutniKorak];
    const nastavitev = koraki[tip];
    const vrednost = gumb.dataset.carovnikVrednost;
    if (nastavitev.vec) stanje[tip] = stanje[tip].includes(vrednost) ? stanje[tip].filter(function (v) { return v !== vrednost; }) : stanje[tip].concat(vrednost);
    else stanje[tip] = stanje[tip] === vrednost ? "" : vrednost;
    stanje.lastno[tip] = "";
    osveziKartice();
  });
  carovnikVsebina.addEventListener("input", function (dogodek) {
    if (!dogodek.target.matches("[data-carovnik-lastno]")) return;
    const tip = vrstniRed[trenutniKorak];
    const vrednost = dogodek.target.value.trim();
    if (tip === "kontakt") { stanje.kontakt = vrednost; atenaKontakt.value = vrednost; if (vrednost) stanje.brezKontakta = false; }
    else if (tip === "opomba") stanje.opomba = vrednost;
    else { stanje.lastno[tip] = vrednost; if (vrednost && !koraki[tip].vec) stanje[tip] = ""; }
  });
  carovnikVsebina.addEventListener("focusout", osveziKartice);
  carovnikNazaj.addEventListener("click", function () { premakniCarovnik(-1); });
  carovnikNaprej.addEventListener("click", function () { premakniCarovnik(1); });
  carovnikKartica.addEventListener("pointerdown", function (dogodek) { povlekX = dogodek.clientX; });
  carovnikKartica.addEventListener("pointerup", function (dogodek) {
    const razlika = dogodek.clientX - povlekX;
    if (Math.abs(razlika) >= 45) premakniCarovnik(razlika < 0 ? 1 : -1);
  });

  atenaPoizveduj.addEventListener("click", razcleniAteninVnos);
  atenaGlas.addEventListener("click", function () {
    const aktivno = atenaGlas.getAttribute("aria-pressed") !== "true";
    atenaGlas.setAttribute("aria-pressed", aktivno ? "true" : "false");
    atenaOpis.focus();
    pokaziToast(aktivno ? "Poslušam – povejte, kaj se je zgodilo." : "Glasovni vnos je ustavljen.");
  });
  atenaKamera.addEventListener("click", function () { atenaKameraDatoteka.click(); });
  atenaUvoz.addEventListener("click", function () { atenaUvozDatoteka.click(); });
  atenaKameraDatoteka.addEventListener("change", function () { dodajDatoteko(atenaKameraDatoteka); });
  atenaUvozDatoteka.addEventListener("change", function () { dodajDatoteko(atenaUvozDatoteka); });

  document.querySelectorAll("[data-storitev]").forEach(function (gumb) {
    gumb.addEventListener("click", function () { odpriStoritev(gumb.dataset.storitev, gumb); });
  });
  document.querySelectorAll("[data-storitev-zapri]").forEach(function (gumb) { gumb.addEventListener("click", zapriStoritev); });
  storitevVsebina.addEventListener("click", function (dogodek) {
    const izbira = dogodek.target.closest("[data-storitev-vrednost]");
    if (!izbira || !odprtaStoritev) return;
    const vrednost = izbira.dataset.storitevVrednost;
    const izbrane = stanjeStoritev[odprtaStoritev].moznosti;
    stanjeStoritev[odprtaStoritev].moznosti = izbrane.includes(vrednost) ? izbrane.filter(function (v) { return v !== vrednost; }) : izbrane.concat(vrednost);
    izbira.setAttribute("aria-pressed", izbira.getAttribute("aria-pressed") === "true" ? "false" : "true");
    if (!lastniMeni.hidden) osveziLastni();
  });
  storitevOddaj.addEventListener("click", function () {
    const shranjeno = stanjeStoritev[odprtaStoritev];
    if (!shranjeno.moznosti.length && !aktivniLastni) {
      storitevPopup.querySelector(".storitev-popup__list").animate([{ transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }], { duration: 220 });
      pokaziToast("Izberite vsaj eno možnost.");
      return;
    }
    if (aktivniLastni) { zapriStoritev(); return; }
    const tip = odprtaStoritev;
    const naslov = storitve[tip].naslov;
    const ukrep = storitevVUkrep[tip];
    if (ukrep && !stanje.ukrepi.includes(ukrep)) stanje.ukrepi = stanje.ukrepi.concat(ukrep);
    zapriStoritev();
    osveziKartice();
    pokaziToast(naslov + " – izbira je shranjena.");
  });

  document.querySelectorAll("[data-odpri-porocilo]").forEach(function (gumb) { gumb.addEventListener("click", function () { odpriPrimer("porocilo"); }); });
  document.querySelectorAll("[data-odpri-ukrep]").forEach(function (gumb) { gumb.addEventListener("click", function () { odpriPrimer("ukrep"); }); });
  document.querySelectorAll("[data-primer-zapri]").forEach(function (gumb) { gumb.addEventListener("click", zapriPrimer); });
  document.querySelector("[data-iz-porocila-ukrep]").addEventListener("click", function () { prikaziPrimerZaslon("ukrep"); });

  document.querySelector(".ukrep-moznosti").addEventListener("click", function (dogodek) {
    const gumb = dogodek.target.closest("[data-ukrep-vrednost]");
    if (!gumb) return;
    izbraniUkrep = gumb.dataset.ukrepVrednost;
    document.querySelectorAll("[data-ukrep-vrednost]").forEach(function (moznost) { moznost.setAttribute("aria-pressed", moznost === gumb ? "true" : "false"); });
    potrdiUkrep.disabled = false;
  });

  potrdiUkrep.addEventListener("click", function () {
    if (!izbraniUkrep) return;
    const opomba = document.querySelector("[data-ukrep-opomba]").value.trim();
    document.querySelector("[data-ukrep-povzetek]").textContent = izbraniUkrep;
    document.querySelector("[data-ukrep-povzetek-opomba]").textContent = opomba || "Brez dodatnih navodil.";
    prikaziPrimerZaslon("potrditev");
  });

  document.querySelector("[data-nazaj-na-ukrep]").addEventListener("click", function () { prikaziPrimerZaslon("ukrep"); });
  document.querySelector("[data-dokoncno-potrdi]").addEventListener("click", function () {
    document.querySelector("[data-glavni-status]").textContent = "Ukrep v pripravi";
    document.querySelector("[data-seznam-glavni-status]").textContent = "Ukrep v pripravi";
    document.querySelectorAll(".klic-status span")[2].className = "je-koncano";
    document.querySelectorAll(".klic-status span")[3].className = "je-aktivno";
    zapriPrimer();
    pokaziToast(izbraniUkrep + " – ukrep je potrjen in v pripravi.");
  });

  document.querySelectorAll("[data-primer-filter]").forEach(function (gumb) {
    gumb.addEventListener("click", function () {
      const filter = gumb.dataset.primerFilter;
      document.querySelectorAll("[data-primer-filter]").forEach(function (izbira) { izbira.setAttribute("aria-selected", izbira === gumb ? "true" : "false"); });
      document.querySelectorAll("[data-primer-seznam]").forEach(function (seznam) { seznam.hidden = seznam.dataset.primerSeznam !== filter; });
      document.querySelector("[data-primeri-stevec]").textContent = filter === "aktivni" ? "2 aktivna" : "2 zaključena";
    });
  });
  document.querySelectorAll("[data-primer-obvestilo]").forEach(function (gumb) { gumb.addEventListener("click", function () { pokaziToast(gumb.dataset.primerObvestilo); }); });
  // One case widget, using the existing report and case actions.
  {
    const widget = document.querySelector(".primeri-pregled");
    const report = document.querySelector(".klic-porocilo");
    const lists = [...widget.querySelectorAll("[data-primer-seznam]")];
    const viewport = document.createElement("div"); viewport.className = "primeri-carousel";
    const nav = document.createElement("div"); nav.className = "primeri-listanje";
    nav.innerHTML = '<button type="button" aria-label="Prejšnji primer">‹</button><span aria-live="polite"></span><button type="button" aria-label="Naslednji primer">›</button>';
    const slides = {aktivni:[], zakljuceni:[]};
    lists.forEach(list => {
      [...list.children].forEach((row,index) => {
        if (list.dataset.primerSeznam === "aktivni" && index === 0) {
          slides.aktivni.push(report); viewport.append(report); return;
        }
        const card = document.createElement("section"); card.className = "klic-porocilo primeri-carousel__primer";
        const header = document.createElement("header");
        const icon = row.querySelector(".primer-vrstica__znak").cloneNode(true);
        const text = document.createElement("div");
        text.append(row.querySelector("strong").cloneNode(true));
        const description = document.createElement("p"); description.textContent = row.querySelector("small").textContent; text.append(description);
        header.append(icon,text,row.querySelector("em").cloneNode(true));
        const note = document.createElement("div"); note.className = "klic-nasvet";
        const paragraph = document.createElement("p"); paragraph.textContent = row.dataset.primerObvestilo; note.append(paragraph);
        const actions = document.createElement("div"); actions.className = "klic-porocilo__dejanja";
        const action = document.createElement("button"); action.type = "button"; action.textContent = "Podrobnosti primera"; action.onclick = () => row.click(); actions.append(action);
        card.append(header,note,actions); viewport.append(card); slides[list.dataset.primerSeznam].push(card);
      });
      list.hidden = true;
      list.style.display = "none";
    });
    widget.append(viewport,nav);
    report.querySelector("header small").textContent = "Obravnava primera";
    let filter = 'oddani', index = 0, opened = null;
    const groups = {oddani:Object.values(slides).flat(), porocila:[report]};
    widget.classList.add('primeri-pregled--strnjeno');
    widget.querySelector(':scope > header').hidden = true;
    widget.querySelector('.primeri-filtri').hidden = true;
    const switcher = document.createElement('div'); switcher.className='primeri-vstop';
    switcher.innerHTML='<button type="button" data-case-panel="oddani" aria-expanded="false" aria-controls="scit-case-content"><span class="primeri-vstop__ikona" aria-hidden="true">↗</span><strong>Oddani primeri</strong><small>Pregled obravnave</small><b>'+groups.oddani.length+'</b></button><button type="button" data-case-panel="porocila" aria-expanded="false" aria-controls="scit-case-content"><span class="primeri-vstop__ikona" aria-hidden="true">≡</span><strong>Poročila in dopolnitve</strong><small>Rezultati in vaši odgovori</small><b>'+groups.porocila.length+'</b></button>';
    const content=document.createElement('div');content.id='scit-case-content';content.className='primeri-vsebina';content.hidden=true;
    const heading=document.createElement('h3');
    const note=document.createElement('p');note.className='primeri-vsebina__opis';
    const close=document.createElement('button');close.type='button';close.className='primeri-skrij';close.textContent='Skrij pregled ↑';
    widget.prepend(switcher);content.append(heading,note,viewport,nav,close);widget.append(content);
    const submitted=document.createElement('div');submitted.className='case-register';
    lists.forEach(list=>Array.from(list.children).forEach((row,i)=>{
      const item=document.createElement('button');item.type='button';item.className='case-register__row';
      const icon=row.querySelector('.primer-vrstica__znak').cloneNode(true);
      const body=document.createElement('span');body.className='case-register__body';
      body.append(row.querySelector('strong').cloneNode(true),row.querySelector('small').cloneNode(true));
      const state=row.querySelector('em').cloneNode(true);body.append(state);
      const arrow=document.createElement('span');arrow.className='case-register__arrow';arrow.textContent='›';
      item.append(icon,body,arrow);item.addEventListener('click',()=>row.click());submitted.append(item);
    }));
    const inbox=document.createElement('div');inbox.className='case-inbox';
    inbox.innerHTML='<div class="case-inbox__clear"><span aria-hidden="true">✓</span><div><strong>Vse dopolnjeno</strong><small>Trenutno od vas ne potrebujemo dodatnih podatkov.</small></div></div><article class="case-result"><header><span>POROČILO PRIPRAVLJENO</span><small>Mobilna naročnina</small></header><h4>Telekom Beispiel GmbH</h4><p class="case-result__summary">Ponudba je preverjena. Pred odločitvijo razjasnite ceno in vezavo.</p><div class="case-result__facts"><span><small>Ocena</small><strong>64 / 100</strong></span><span><small>Ugotovitev</small><strong>Povišana previdnost</strong></span></div><p class="case-result__next"><strong>Priporočamo</strong>Zahtevajte popolno pisno ponudbo.</p><footer><button type="button" data-result-open>Preberi poročilo <span aria-hidden="true">↗</span></button><button type="button" data-result-next>Izberi naslednji korak</button></footer></article>';
    inbox.querySelector('[data-result-open]').addEventListener('click',()=>report.querySelector('[data-odpri-porocilo]').click());
    inbox.querySelector('[data-result-next]').addEventListener('click',()=>report.querySelector('[data-odpri-ukrep]').click());
    viewport.hidden=true;nav.hidden=true;content.insertBefore(submitted,close);content.insertBefore(inbox,close);
    function show() {
      viewport.hidden=true;nav.hidden=true;
      submitted.hidden=filter!=='oddani';inbox.hidden=filter!=='porocila';
      content.dataset.category=filter;
      heading.textContent=filter==='oddani'?'Oddani primeri':'Poročila in dopolnitve';
      note.textContent=filter==='oddani'?'Vaše oddaje in trenutno stanje obravnave.':'Ugotovitve, priporočila in naslednji koraki.';
    }
    let panelAnimation=null;
    function toggle(key){
      const from=content.hidden?0:content.getBoundingClientRect().height;
      if(panelAnimation){panelAnimation.cancel();panelAnimation=null;}
      opened=opened===key?null:key;
      switcher.querySelectorAll('button').forEach(button=>button.setAttribute('aria-expanded',String(button.dataset.casePanel===opened)));
      content.hidden=false;
      if(opened){filter=opened;index=0;show();}
      const to=opened?content.getBoundingClientRect().height:0;
      if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){content.hidden=!opened;return;}
      content.style.overflow='hidden';
      panelAnimation=content.animate([
        {height:from+'px',opacity:from?1:0,marginTop:from?'9px':'0px',paddingTop:from?'14px':'0px',paddingBottom:from?'14px':'0px',borderWidth:from?'1px':'0px'},
        {height:to+'px',opacity:opened?1:0,marginTop:opened?'9px':'0px',paddingTop:opened?'14px':'0px',paddingBottom:opened?'14px':'0px',borderWidth:opened?'1px':'0px'}
      ],{duration:280,easing:'cubic-bezier(.22,.75,.25,1)'});
      panelAnimation.onfinish=()=>{content.hidden=!opened;content.style.overflow='';panelAnimation=null;};
    }
    switcher.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>toggle(button.dataset.casePanel)));
    close.addEventListener('click',()=>{const key=opened;toggle(key);switcher.querySelector('[data-case-panel="'+key+'"]').focus();});
    function move(delta){index=Math.max(0,Math.min(groups[filter].length-1,index+delta));show();}
    nav.children[0].onclick=()=>move(-1);nav.children[2].onclick=()=>move(1);
    let touchX=null;
    viewport.addEventListener('touchstart',event=>{touchX=event.touches[0].clientX;},{passive:true});
    viewport.addEventListener('touchend',event=>{if(touchX===null)return;const delta=event.changedTouches[0].clientX-touchX;touchX=null;if(Math.abs(delta)>45)move(delta<0?1:-1);},{passive:true});
    show();

  }


  popupVsebina.addEventListener("click", function (dogodek) {
    const gumb = dogodek.target.closest("[data-popup-vrednost]");
    if (gumb) {
      const nastavitev = koraki[odprtTip];
      const vrednost = gumb.dataset.popupVrednost;
      if (nastavitev.vec) stanje[odprtTip] = stanje[odprtTip].includes(vrednost) ? stanje[odprtTip].filter(function (v) { return v !== vrednost; }) : stanje[odprtTip].concat(vrednost);
      else stanje[odprtTip] = stanje[odprtTip] === vrednost ? "" : vrednost;
      if (stanje.lastno[odprtTip]) { stanje.lastno[odprtTip] = ""; const polje = popupVsebina.querySelector("[data-lastno-polje]"); if (polje) polje.value = ""; }
      popupVsebina.querySelectorAll("[data-popup-vrednost]").forEach(function (izbira) {
        const izbran = nastavitev.vec ? stanje[odprtTip].includes(izbira.dataset.popupVrednost) : stanje[odprtTip] === izbira.dataset.popupVrednost;
        izbira.setAttribute("aria-pressed", izbran ? "true" : "false");
      });
    }
    const brez = dogodek.target.closest("[data-popup-brez]");
    if (brez) {
      stanje.brezKontakta = !stanje.brezKontakta;
      if (stanje.brezKontakta) { stanje.kontakt = ""; atenaKontakt.value = ""; popupVsebina.querySelector("[data-lastno-polje]").value = ""; }
      brez.setAttribute("aria-pressed", stanje.brezKontakta ? "true" : "false");
    }
  });

  popupVsebina.addEventListener("input", function (dogodek) {
    if (!dogodek.target.matches("[data-lastno-polje]")) return;
    const vrednost = dogodek.target.value.trim();
    if (odprtTip === "kontakt") { stanje.kontakt = vrednost; atenaKontakt.value = vrednost; if (vrednost) stanje.brezKontakta = false; }
    else if (odprtTip === "opomba") stanje.opomba = vrednost;
    else { stanje.lastno[odprtTip] = vrednost; if (vrednost && !koraki[odprtTip].vec) stanje[odprtTip] = ""; }
  });

  oddaj.addEventListener("click", function () {
    const manjkajoci = ["kontakt", "dogodek", "ukrepi", "kategorija", "meja"].filter(function (tip) { return !imaOdgovor(tip); });
    if (manjkajoci.length) {
      const prvi = manjkajoci[0];
      trenutniKorak = vrstniRed.indexOf(prvi);
      osveziKartice();
      document.querySelector(".scit-tok").scrollIntoView({ behavior: "smooth", block: "start" });
      pokaziToast("Dopolnite manjkajoči korak.");
      return;
    }
    document.querySelector("[data-vsi-koraki]").innerHTML = '<div class="scit-uspeh"><span class="scit-uspeh__ikona"><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.8 2.8 8.2 7 10 4.2-1.8 7-5.2 7-10V6l-7-3Z"/><path d="m8.7 12 2.1 2.1 4.5-4.5"/></svg></span><h2>Prodajalca smo prevzeli.</h2><p>Primer je pripravljen. Tukaj boste dobili poročilo in potrdili vsak naslednji korak.</p></div>';
    oddaj.hidden = true;
  });

  document.querySelector(".prodajni-scit__pomoc").addEventListener("click", function () { pokaziToast("Vnesite kontakt, nato odgovarjajte z gumbom Naprej ali podrsajte."); });
  document.addEventListener("keydown", function (dogodek) { if (dogodek.key !== "Escape" || kontaktDialog.open) return; if (!primerPopup.hidden) zapriPrimer(); else if (!storitevPopup.hidden) zapriStoritev(); else if (!popup.hidden) zapriPopup(); });

  // Shared explanations beside each option in the five-service composer.
  let infoSequence = 0;
  function dodajInformacijeMoznosti() {
    if (!storitevPopup.classList.contains('je-harmonika')) return;
    const tip = storitevPopup.dataset.tip;
    const grid = storitevVsebina.querySelector('.storitev-moznosti');
    if (!grid) return;
    grid.classList.add('ima-info');
    grid.querySelectorAll('[data-storitev-vrednost]').forEach(function (option, index) {
      if (!option.querySelector('.scit-moznost-ikona')) {
        const original = option.querySelector('svg') || document.querySelector('[data-storitev="' + tip + '"] svg');
        if (original) { const icon = original.cloneNode(true); icon.classList.add('scit-moznost-ikona'); icon.setAttribute('aria-hidden','true'); option.prepend(icon); }
      }
      const row = option.closest('.zascita-kontakti') || option;
      if (row.parentElement !== grid || row.previousElementSibling?.classList.contains('storitev-info')) return;
      const description = index === 0 ? storitve[tip].opis : (razlage[tip] || [])[index];
      if (!description) return;
      const info = document.createElement('button');
      info.type = 'button';
      info.textContent = 'Info';
      info.className = 'storitev-info';
      info.setAttribute('aria-label', 'Informacije: ' + option.dataset.storitevVrednost);
      info.setAttribute('aria-expanded', 'false');
      const panel = document.createElement('section');
      panel.className = 'storitev-info-opis';
      panel.id = 'storitev-info-' + (++infoSequence);
      const heading=document.createElement('header'),title=document.createElement('strong');
      const icon=option.querySelector('.scit-moznost-ikona');if(icon)heading.append(icon.cloneNode(true));
      title.textContent=option.dataset.storitevVrednost;heading.append(title);
      const body=document.createElement('p');body.textContent=description;
      const outcome=document.createElement('p');
      const more={
        zascita:'Určíte, jaké hovory má ochrana zahrnovat.',
        povratni:'Ta možnost določa namen povratnega klica. Podatke in dogovore potrebujete za odločitev o nadaljnjem sodelovanju s prodajalcem.',
        ponudba:'Cilj je pridobiti jasne pisne podatke, da lahko ponudbo pregledate in primerjate pred odločitvijo. Sama izbira te možnosti še ne pomeni sprejema ponudbe ali naročila.',
        ustavi:'Ta možnost določa, kakšno zahtevo posredujemo prodajalcu. Njegovega odziva ali dejanskega prenehanja stikov ne moremo zagotoviti.',
        preveri:'Ugotovitve vam pomagajo oceniti ponudbo in prepoznati podatke, ki jih je treba dodatno preveriti. Ocena ni zagotovilo, da je ponudba brez tveganja.'
      };
      more.zascita='S to možnostjo določite obseg zaščite in način obveščanja. Skupine podjetij, za katere bo korak veljal, izberete v polju »Uporabi za«.';
      outcome.textContent=more[tip]||'';panel.append(heading,body,outcome);
      panel.hidden = true;
      info.setAttribute('aria-controls', panel.id);
      const closeInfo=document.createElement('button');closeInfo.type='button';closeInfo.className='storitev-info-zapri';closeInfo.textContent='Zapri info';heading.append(closeInfo);
      let infoAnimation=null;
      function animateInfo(open) {
        if(infoAnimation){infoAnimation.cancel();infoAnimation=null;}
        info.setAttribute('aria-expanded',String(open));info.textContent='Info';
        panel.hidden=false;
        const h=panel.getBoundingClientRect().height;
        if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){panel.hidden=!open;return;}
        const collapsed={height:'0px',opacity:0,paddingTop:'0px',paddingBottom:'0px',marginBottom:'0px',transform:'translateY(-6px)'};
        const expanded={height:h+'px',opacity:1,paddingTop:'13px',paddingBottom:'13px',marginBottom:'4px',transform:'translateY(0)'};
        panel.style.overflow='hidden';
        infoAnimation=panel.animate(open?[collapsed,expanded]:[expanded,collapsed],{duration:300,easing:'cubic-bezier(.22,.61,.36,1)'});
        infoAnimation.onfinish=()=>{panel.hidden=!open;panel.style.overflow='';infoAnimation=null;};
      }
      panel.closeInfo=()=>animateInfo(false);
      closeInfo.onclick=()=>{animateInfo(false);info.focus({preventScroll:true});};
      info.addEventListener('click', function (event) {
        event.stopPropagation();
        const open=info.getAttribute('aria-expanded')!=='true';
        if(open)grid.querySelectorAll('.storitev-info-opis').forEach(p=>{if(p!==panel&&!p.hidden)p.closeInfo?.();});
        const tiles=Array.from(grid.querySelectorAll(':scope > .scit-moznost-kartica'));
        const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
        const i=tiles.indexOf(slot),end=tiles[Math.min(tiles.length-1,Math.floor(i/columns)*columns+columns-1)];
        end.after(panel);animateInfo(open);
      });
      const slot=document.createElement("div");slot.className="scit-moznost-kartica";
      row.before(slot);slot.append(info,row,panel);
      function fitOptionText() {
        const labels=option.querySelectorAll('[class$="-hero__besedilo"] strong,[class$="-vrstica__naziv"],.zascita-kontakti__naslov');
        labels.forEach(label=>{
          const limit=info.getBoundingClientRect().top-6;
          for(let size=12;size>=8;size-=0.25){
            label.style.setProperty('font-size',size+'px','important');
            label.style.setProperty('line-height','1.2','important');
            const range=document.createRange();range.selectNodeContents(label);
            const rect=range.getBoundingClientRect();
            if(rect.bottom<=limit && rect.width<=option.clientWidth-16)break;
          }
        });
      }
      new ResizeObserver(()=>requestAnimationFrame(fitOptionText)).observe(option);
      document.fonts.ready.then(()=>requestAnimationFrame(fitOptionText));


    });
  }
  new MutationObserver(dodajInformacijeMoznosti).observe(storitevVsebina, {childList:true, subtree:true});
  osveziKartice();
  document.documentElement.dataset.prodajniScitReady = "true";
}());
