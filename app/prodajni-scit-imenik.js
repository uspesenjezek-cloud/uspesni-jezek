(function () {
  "use strict";
  const gumb = document.querySelector("[data-scit-imenik]");
  const kontakt = document.querySelector("[data-scit-atena-kontakt]");
  if (!gumb || !kontakt) return;
  const status = document.querySelector("[data-scit-imenik-status]");
  gumb.hidden = false;
  gumb.textContent = "Odpri imenik";
  kontakt.readOnly = false;
  kontakt.placeholder = "Išči podjetje";
  kontakt.setAttribute("aria-label", "Hitro iskanje podjetja");
  const quickResults = document.createElement("div");
  quickResults.className = "scit-hitri-stiki";
  quickResults.hidden = true;
  quickResults.id = "scit-hitri-stiki";
  kontakt.setAttribute("aria-controls", quickResults.id);
  kontakt.setAttribute("aria-expanded", "false");
  const quickRow = kontakt.closest(".scit-atena__kontakt-vrstica");
  quickRow.append(quickResults);
  function closeQuickResults() { quickResults.hidden = true; kontakt.setAttribute("aria-expanded", "false"); }
  function showQuickResults(event) {
    if (event && !event.isTrusted) return;
    const query = kontakt.value.trim().toLocaleLowerCase("sl");
    quickResults.replaceChildren();
    if (!query) { closeQuickResults(); return; }
    try {
      const saved = JSON.parse(localStorage.getItem("uj_scit_podjetja_podatki_v1") || "{}");
      const deleted = new Set(JSON.parse(localStorage.getItem("uj_scit_podjetja_izbrisana_v1") || "[]"));
      const matches = Object.entries(saved).filter(([key,c]) => !deleted.has(key) && [c.name,c.phone,c.email].filter(Boolean).join(" ").toLocaleLowerCase("sl").includes(query)).slice(0,8);
      matches.forEach(([key,c]) => {
        const button = document.createElement("button"); button.type = "button";
        const name = document.createElement("strong"), detail = document.createElement("span");
        name.textContent = c.name; detail.textContent = [c.phone,c.email].filter(Boolean).join(" · ");
        button.append(name,detail);
        button.onclick = () => {
          window.UJCompanyContact.save({...c,id:key});
          kontakt.value = [c.name,c.phone || c.email].filter(Boolean).join(" · ");
          kontakt.dispatchEvent(new Event("input", {bubbles:true}));
          kontakt.dispatchEvent(new Event("change", {bubbles:true}));
          closeQuickResults(); kontakt.focus({preventScroll:true});
        };
        quickResults.append(button);
      });
      if (!matches.length) { const empty = document.createElement("p"); empty.textContent = "Nenašli smo kontakta. Dodajte ga pod »Dodaj novo«."; quickResults.append(empty); }
      quickResults.hidden = false; kontakt.setAttribute("aria-expanded", "true");
    } catch (_) { closeQuickResults(); }
  }
  kontakt.addEventListener("input", showQuickResults);
  kontakt.addEventListener("keydown", e => {
    if (e.key === "Escape") closeQuickResults();
    if (e.key === "ArrowDown" && !quickResults.hidden) { e.preventDefault(); quickResults.querySelector("button")?.focus(); }
  });
  document.addEventListener("click", e => { if (!quickRow.contains(e.target)) closeQuickResults(); });
  gumb.addEventListener("click", closeQuickResults);

  let imenik = null;
  let nalaganje = null;
  let zadeve = [];

  function prilagodiKontakt() {
    const platno = document.createElement("canvas");
    const ctx = platno.getContext("2d");
    const slog = getComputedStyle(kontakt);
    const sirina = kontakt.clientWidth - parseFloat(slog.paddingLeft) - parseFloat(slog.paddingRight);
    if (!ctx || sirina <= 0) return;
    ctx.font = "500 16px " + slog.fontFamily;
    const mera = ctx.measureText(kontakt.value || kontakt.placeholder).width;
    kontakt.style.setProperty("font-size", Math.min(16, 16 * sirina / Math.max(1, mera + 2)) + "px", "important");
  }
  kontakt.addEventListener("input", prilagodiKontakt);
  kontakt.addEventListener("change", prilagodiKontakt);
  new ResizeObserver(prilagodiKontakt).observe(kontakt);
  document.fonts.ready.then(prilagodiKontakt);

  const contactSection = document.querySelector(".scit-prodajalec-zgoraj");
  const switcher = document.createElement("div");
  switcher.className = "scit-kontakt-preklop";
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", "Kontakt prodajalca");
  switcher.innerHTML = '<button type="button" aria-pressed="true">Imenik</button><button type="button" aria-pressed="false">Dodaj novo</button>';
  const inlineForm = document.createElement("form");
  inlineForm.className = "scit-novi-kontakt-inline";
  inlineForm.hidden = true;
  inlineForm.innerHTML = '<label>Ime podjetja ali kontakta<input name="name" required maxlength="200" autocomplete="organization"></label><label>Telefon<input name="phone" type="tel" autocomplete="tel"></label><label>E-pošta<input name="email" type="email" autocomplete="email"></label><label style="grid-column:1/-1">Spletna stran (neobvezno)<input name="website" autocomplete="url" placeholder="www.podjetje.si"></label><label>Skupina<select name="group"><option value="">Brez skupine</option></select></label><div class="scit-kontakt-akcije"><button type="button" data-inline-preklici>Prekliči</button><button type="submit">Shrani kontakt</button></div><p role="status" hidden></p>';
  inlineForm.elements.phone.closest('label').style.gridColumn='auto';
  inlineForm.elements.email.closest('label').style.gridColumn='auto';
  const websiteRow=inlineForm.elements.website.closest('label');
  inlineForm.elements.name.closest('label').after(websiteRow);
  const groupSelect = inlineForm.elements.group;
  groupSelect.closest('label').style.gridColumn='1 / -1';
  groupSelect.hidden = true;
  const groupPicker = document.createElement("div");
  groupPicker.className = "scit-skupina-picker";
  const groupButton = document.createElement("button");
  groupButton.type = "button";
  groupButton.className = "scit-skupina-picker-toggle";
  groupButton.setAttribute("aria-label", "Izberi skupino");
  groupButton.setAttribute("aria-expanded", "false");
  const groupMenu = document.createElement("div");
  groupMenu.className = "scit-skupina-picker-menu";
  groupMenu.hidden = true;
  function closeGroups() { groupMenu.hidden = true; groupButton.setAttribute("aria-expanded", "false"); }
  function renderGroups() {
    groupButton.textContent = groupSelect.selectedOptions[0]?.textContent || "Brez skupine";
    groupMenu.replaceChildren();
    Array.from(groupSelect.options).forEach(option => {
      const item = document.createElement("button");
      item.type = "button"; item.textContent = option.textContent;
      item.setAttribute("aria-pressed", String(option.value === groupSelect.value));
      item.onclick = () => { groupSelect.value = option.value; renderGroups(); closeGroups(); groupButton.focus(); };
      groupMenu.append(item);
    });
  }
  groupButton.onclick = () => { const open = groupMenu.hidden; renderGroups(); groupMenu.hidden = !open; groupButton.setAttribute("aria-expanded", String(open)); };
  groupPicker.append(groupButton, groupMenu);
  groupSelect.after(groupPicker);
  groupSelect.addEventListener("change", renderGroups);
  document.addEventListener("click", e => { if (!groupPicker.contains(e.target)) closeGroups(); });
  groupPicker.addEventListener("keydown", e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeGroups(); groupButton.focus(); } });
  renderGroups();
  const getContactDetails = window.UJContactDetails(inlineForm);
  contactSection.prepend(switcher);
  contactSection.append(inlineForm);
  function setContactMode(add) {
    closeGroups();
    switcher.classList.toggle("je-novo", add);
    inlineForm.hidden = !add;
    kontakt.closest(".scit-atena__kontakt-vrstica").hidden = add;
    switcher.children[0].setAttribute("aria-pressed", String(!add));
    switcher.children[1].setAttribute("aria-pressed", String(add));
    if (add) {
      if(!inlineForm.elements.name.value){const c=window.UJCompanyContact.active();for(const k of ['name','website','phone','email'])inlineForm.elements[k].value=c[k]||'';getContactDetails.restore(c.details);}
      const select = inlineForm.elements.group;
      const selected = select.value;
      select.replaceChildren(new Option("Brez skupine", ""));
      const groups = JSON.parse(localStorage.getItem("uj_scit_podjetja_kategorije_v1") || "[]");
      groups.forEach(group => select.add(new Option(group.name, group.id)));
      select.value = selected;
      renderGroups();
    }
  }
  switcher.children[0].onclick = () => setContactMode(false);
  switcher.children[1].onclick = () => setContactMode(true);
  inlineForm.querySelector("[data-inline-preklici]").onclick = () => {
    inlineForm.reset();
    inlineForm.querySelector("p").hidden = true;
    setContactMode(false);
    switcher.children[0].focus({preventScroll:true});
  };
  inlineForm.onsubmit = e => {
    e.preventDefault();
    const fields = inlineForm.elements;
    const name = fields.name.value.trim();
    if (!name) { fields.name.focus(); return; }
    const message = inlineForm.querySelector("p");
    try {
      const existing = window.UJCompanyContact.full({name});
      const key = existing.id || "scit-" + crypto.randomUUID();
      const contacts = JSON.parse(localStorage.getItem("uj_scit_podjetja_podatki_v1") || "{}");
      const groups = JSON.parse(localStorage.getItem("uj_scit_podjetja_kategorije_v1") || "[]");
      const group = groups.find(item => item.id === fields.group.value);
      contacts[key] = { ...existing, id:key, name, phone: fields.phone.value.trim(), email: fields.email.value.trim(), website: fields.website.value.trim(), details: getContactDetails(), usedAt: new Date().toISOString() };
      if (group && !group.companyKeys.includes(key)) group.companyKeys.push(key);
      localStorage.setItem("uj_scit_podjetja_podatki_v1", JSON.stringify(contacts));
      localStorage.setItem("uj_scit_podjetja_kategorije_v1", JSON.stringify(groups));
      window.UJCompanyContact.save(contacts[key]);
      kontakt.value = [name, contacts[key].phone || contacts[key].email].filter(Boolean).join(" · ");
      kontakt.dispatchEvent(new Event("input", {bubbles:true}));
      kontakt.dispatchEvent(new Event("change", {bubbles:true}));
      imenik?.refresh([]);
      inlineForm.reset();
      setContactMode(false);
      status.textContent = "Kontakt je shranjen."; status.hidden = false;
    } catch (_) { message.textContent = "Kontakta ni mogoče shraniti. Poskusite znova."; message.hidden = false; }
  };

  async function pripravi() {
    if (imenik) return imenik;
    // Import only the existing directory markup; no scripts or other page UI.
    const odziv = await fetch("neplacila.html", { signal: AbortSignal.timeout(10000) });
    if (!odziv.ok) throw new Error("Imenika trenutno ni mogoče odpreti. Poskusite znova.");
    const vir = new DOMParser().parseFromString(await odziv.text(), "text/html");
    const sheet = vir.getElementById("podjetja-sheet");
    if (!sheet || !window.UJNedavnaPodjetja) throw new Error("Imenika trenutno ni mogoče odpreti. Poskusite znova.");
    const gostitelj = document.createElement("div");
    gostitelj.hidden = true;
    gostitelj.innerHTML = '<div id="nedavna-podjetja"><div id="nedavna-podjetja-trak"></div><button id="nedavna-podjetja-vec" type="button"></button></div>';
    document.body.append(gostitelj, document.importNode(sheet, true));
    const okno = document.getElementById("podjetja-sheet");
    okno.classList.add("scit-imenik");
    okno.querySelector(".ocena-sheet__podnaslov").hidden = true;
    const obvestilo = document.createElement("p");
    obvestilo.className = "scit-imenik__status";
    obvestilo.setAttribute("role", "status");
    obvestilo.dataset.scitImenikObvestilo = "";
    okno.querySelector(".podjetja-sheet__seznam").before(obvestilo);
    const velikosti = new WeakMap();
    function prilagodiImenik() {
      if (okno.hidden) return;
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return;
      okno.querySelectorAll("[data-fit-text], .podjetja-sheet__kontaktni-podatek strong").forEach(function (el) {
        if (!el.clientWidth) return;
        const slog = getComputedStyle(el);
        const max = velikosti.get(el) || parseFloat(slog.fontSize);
        velikosti.set(el, max);
        ctx.font = slog.fontWeight + " " + max + "px " + slog.fontFamily;
        const mera = ctx.measureText(el.textContent).width;
        const velikost = Math.min(max, max * el.clientWidth / Math.max(1, mera + 2));
        el.style.setProperty("font-size", velikost + "px", "important");
      });
    }
    new ResizeObserver(prilagodiImenik).observe(okno);
    new MutationObserver(prilagodiImenik).observe(okno, { childList: true, subtree: true, characterData: true });
    imenik = window.UJNedavnaPodjetja.init(document, window, {
      allowEmpty: true,
      contactOnly: true,
      storagePrefix: "uj_scit_podjetja_",
      eventPrefix: "uj:scit:",
      onEdit: function (podjetje) {
        for (const key of ['name','website','phone','email']) inlineForm.elements[key].value = podjetje[key] || '';
        getContactDetails.restore(podjetje.details);
        setContactMode(true);
        inlineForm.elements.name.focus({preventScroll:true});
      },
      onSelect: function (podjetje) {
        window.UJCompanyContact.save(window.UJCompanyContact.full(podjetje));
        const deli = [podjetje.name, podjetje.phone || podjetje.email].filter(Boolean);
        kontakt.value = deli.join(" · ");
        kontakt.dispatchEvent(new Event("input", { bubbles: true }));
        kontakt.dispatchEvent(new Event("change", { bubbles: true }));
        requestAnimationFrame(function () { kontakt.focus({ preventScroll: true }); });
      }
    });
    if (!imenik) throw new Error("Imenika trenutno ni mogoče odpreti. Poskusite znova.");
    return imenik;
  }

  async function osvezi() {
    // Sales contacts belong exclusively to this directory, never debt cases.
    imenik.refresh([]);
  }

  window.UJScitImenik = {
    async open(options = {}) {
      const api = await pripravi();
      api.refresh(zadeve);
      const sheet = document.getElementById("podjetja-sheet");
      options.beforeOpen?.();
      api.open();
      requestAnimationFrame(() => sheet.querySelector("input, button")?.focus({ preventScroll: true }));
      if (options.onClose) {
        const observer = new MutationObserver(() => {
          if (!sheet.hidden) return;
          observer.disconnect();
          options.onClose();
        });
        observer.observe(sheet, { attributes: true, attributeFilter: ["hidden"] });
      }
      void osvezi();
    }
  };

  gumb.addEventListener("click", async function () {
    if (nalaganje) return;
    gumb.disabled = true;
    gumb.setAttribute("aria-busy", "true");
    status.hidden = true;
    nalaganje = (async function () {
      const api = await pripravi();
      api.refresh(zadeve);
      api.open();
      await osvezi();
    })();
    try { await nalaganje; }
    catch (napaka) { status.textContent = napaka.message; status.hidden = false; }
    finally { nalaganje = null; gumb.disabled = false; gumb.removeAttribute("aria-busy"); }
  });

  document.addEventListener("keydown", function (event) {
    const sheet = document.getElementById("podjetja-sheet");
    if (!sheet || sheet.hidden || event.key !== "Tab") return;
    const elementi = Array.from(sheet.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')).filter(el => el.getClientRects().length);
    const prvi = elementi[0], zadnji = elementi[elementi.length - 1];
    if (event.shiftKey && (document.activeElement === prvi || !elementi.includes(document.activeElement))) { event.preventDefault(); zadnji?.focus(); }
    else if (!event.shiftKey && document.activeElement === zadnji) { event.preventDefault(); prvi?.focus(); }
  });
})();
