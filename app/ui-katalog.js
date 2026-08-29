(function () {
  "use strict";

  var STORAGE_KEY = "uj-ui-icon-review-v2";
  var FAMILY_STORAGE_KEY = "uj-ui-icon-graphic-review-v3";
  var state = { inventory: null, families: null, resolution: null, resolvedFingerprints: new Set(), resolvedDefinitions: new Set(), decisions: loadDecisions(), graphicReview: loadGraphicReview(), fatherCollecting: false };
  var els = {
    grid: document.getElementById("ikone-mreza"),
    template: document.getElementById("ikona-predloga"),
    summary: document.getElementById("katalog-povzetki"),
    count: document.getElementById("rezultat-stevec"),
    empty: document.getElementById("katalog-prazno"),
    search: document.getElementById("iskanje"),
    kind: document.getElementById("filter-tip"),
    scope: document.getElementById("filter-obseg"),
    decision: document.getElementById("filter-odlocitev"),
    page: document.getElementById("filter-stran"),
    file: document.getElementById("uvoz-datoteka"),
    resolution: document.getElementById("katalog-uskladitev"),
    familyList: document.getElementById("druzine-seznam"),
    familyTemplate: document.getElementById("druzina-predloga"),
    familyMemberTemplate: document.getElementById("druzina-razlicica-predloga"),
    familySearch: document.getElementById("druzine-iskanje"),
    familyDisplay: document.getElementById("druzine-prikaz"),
    familyChoice: document.getElementById("druzine-izbira"),
    familyCount: document.getElementById("druzine-stevec"),
    familySummary: document.getElementById("druzine-povzetek"),
    familyFile: document.getElementById("druzine-uvoz-datoteka"),
    fatherWidget: document.getElementById("father-widget"),
    fatherWidgetList: document.getElementById("father-widget-list"),
    fatherWidgetMode: document.getElementById("father-widget-mode"),
    fatherWidgetStop: document.getElementById("father-widget-stop"),
  };

  function loadDecisions() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveDecisions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.decisions));
  }

  function loadGraphicReview() {
    try {
      var parsed = JSON.parse(localStorage.getItem(FAMILY_STORAGE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object") return { assignments: {}, fathers: {}, activeFather: null };
      var fathers = parsed.fathers || {};
      var fallbackFather = Object.keys(fathers).map(Number).filter(function (number) { return number > 0; }).sort(function (a, b) { return a - b; }).pop() || null;
      return { assignments: parsed.assignments || {}, fathers: fathers, activeFather: Number(parsed.activeFather) || fallbackFather };
    } catch (_) {
      return { assignments: {}, fathers: {}, activeFather: null };
    }
  }

  function saveGraphicReview() {
    localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(state.graphicReview));
  }

  function text(value) {
    return String(value == null ? "" : value);
  }

  function summaryCard(value, label) {
    return '<div class="katalog-povzetek"><strong>' + text(value) + '</strong><span>' + label + '</span></div>';
  }

  function renderSummary() {
    var summary = state.inventory.summary;
    var resolved = state.resolution ? state.resolution.summary.off : 0;
    els.summary.innerHTML = summaryCard(summary.uniqueIcons, "unikatnih vizualnih ikon") +
      summaryCard(summary.occurrences, "zaznanih pojavitev") +
      summaryCard(summary.canonical, "v kanoničnem registru") +
      summaryCard(resolved, "usklajenih iz zadnjega pregleda");
    if (state.resolution) {
      els.resolution.hidden = false;
      els.resolution.innerHTML = '<strong>✓ Zadnji pregled je uporabljen</strong><span>' + resolved + ' odločitev OFF je obdelanih. Zelene kartice so rezultat; rdeče se pokažejo samo ob novi oznaki OFF.</span>';
    }
  }

  function setupPages() {
    var pages = Array.from(new Set(state.inventory.items.flatMap(function (item) { return item.pages; }))).sort();
    pages.forEach(function (page) {
      var option = document.createElement("option");
      option.value = page;
      option.textContent = page.replace(/^app\//, "");
      els.page.appendChild(option);
    });
  }

  function definitionKey(source, name) {
    return source + "\u0000" + name;
  }

  function isResolved(item) {
    return state.resolvedFingerprints.has(item.fingerprint) || item.definitions.some(function (definition) {
      return state.resolvedDefinitions.has(definitionKey(definition.source, definition.name));
    });
  }

  function decisionFor(item) {
    return state.decisions[item.id] || (isResolved(item) ? "resolved" : "unreviewed");
  }

  function haystack(item) {
    return [item.name, item.aliases.join(" "), item.kind, item.pages.join(" "), item.definitions.map(function (entry) { return entry.source; }).join(" "), item.occurrences.map(function (entry) { return entry.context; }).join(" ")].join(" ").toLocaleLowerCase("sl");
  }

  function matches(item) {
    var query = els.search.value.trim().toLocaleLowerCase("sl");
    var scopeMatches = !els.scope.value ||
      (els.scope.value === "active" ? ["canonical", "active"].includes(item.scope) : item.scope === els.scope.value);
    return (!query || haystack(item).includes(query)) &&
      (!els.kind.value || item.kind === els.kind.value) &&
      scopeMatches &&
      (!els.decision.value || decisionFor(item) === els.decision.value) &&
      (!els.page.value || item.pages.includes(els.page.value));
  }

  function previewInto(container, item) {
    if (item.kind === "svg") {
      container.dataset.svgStyle = item.geometry.fill === "ni navedeno" && item.geometry.stroke === "podedovano/ni navedeno" ? "line" : "native";
      container.innerHTML = item.preview;
    }
    else if (item.kind === "image") {
      var img = document.createElement("img");
      img.src = item.preview;
      img.alt = "";
      container.appendChild(img);
    } else container.textContent = item.preview;
  }

  function setDecision(item, decision, card) {
    if (state.decisions[item.id] === decision) delete state.decisions[item.id];
    else state.decisions[item.id] = decision;
    saveDecisions();
    applyDecision(card, item);
    renderSummary();
    if (els.decision.value) render();
  }

  function applyDecision(card, item) {
    var decision = decisionFor(item);
    if (decision === "unreviewed") card.removeAttribute("data-decision");
    else card.dataset.decision = decision;
    var status = card.querySelector(".ikona-status");
    status.hidden = decision !== "resolved";
    status.textContent = decision === "resolved" ? "USKLAJENO" : "";
    card.querySelectorAll("[data-decision]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.decision === decision));
    });
  }

  function buildCard(item) {
    var card = els.template.content.firstElementChild.cloneNode(true);
    card.dataset.iconId = item.id;
    card.dataset.scope = item.scope;
    previewInto(card.querySelector(".ikona-predogled"), item);
    card.querySelector("h3").textContent = item.name;
    var scopeLabels = { canonical: "register", active: "aktivna stran", illustration: "ilustracija", orphan: "nepovezan vir" };
    card.querySelector(".ikona-tip").textContent = item.kind + " · " + scopeLabels[item.scope];
    card.querySelector(".ikona-geometrija").textContent = "viewBox " + item.geometry.viewBox + " · " + item.geometry.width + "×" + item.geometry.height + " · stroke " + item.geometry.strokeWidth + " · fill " + item.geometry.fill;
    card.querySelector(".ikona-viri").textContent = item.definitions.length + " definicij · " + item.occurrences.length + " pojavitev · " + (item.pages.length ? item.pages.join(", ") : "brez neposredno povezane HTML strani");
    var occurrences = card.querySelector(".ikona-pojavitve");
    item.occurrences.forEach(function (entry) {
      var row = document.createElement("div");
      row.className = "ikona-pojavitev";
      row.textContent = entry.source + ":" + entry.line + " · " + entry.role + "\n" + entry.context;
      occurrences.appendChild(row);
    });
    card.querySelector("details").hidden = !item.occurrences.length;
    card.querySelectorAll("[data-decision]").forEach(function (button) {
      button.addEventListener("click", function () { setDecision(item, button.dataset.decision, card); });
    });
    applyDecision(card, item);
    return card;
  }

  function render() {
    var items = state.inventory.items.filter(matches);
    var fragment = document.createDocumentFragment();
    items.forEach(function (item) { fragment.appendChild(buildCard(item)); });
    els.grid.replaceChildren(fragment);
    els.count.textContent = "Prikazanih " + items.length + " od " + state.inventory.summary.uniqueIcons + " ikon.";
    els.empty.hidden = Boolean(items.length);
  }

  function familyItems(family) {
    return family.members.map(function (id) { return state.inventory.items.find(function (item) { return item.id === id; }); }).filter(Boolean);
  }

  function effectiveFamilies() {
    var groups = new Map();
    state.families.families.forEach(function (family) {
      family.members.forEach(function (itemId) {
        var assigned = Number(state.graphicReview.assignments[itemId]);
        var number = Number.isInteger(assigned) && assigned > 0 ? assigned : family.number;
        if (!groups.has(number)) groups.set(number, { id: "grafika-" + number, number: number, label: "Grafična skupina " + String(number).padStart(3, "0"), members: [], occurrences: 0, visualEvidence: [] });
        var group = groups.get(number);
        var item = state.inventory.items.find(function (entry) { return entry.id === itemId; });
        group.members.push(itemId);
        group.occurrences += item ? item.occurrences.length : 0;
        if (family.visualEvidence && !group.visualEvidence.includes(family.visualEvidence)) group.visualEvidence.push(family.visualEvidence);
      });
    });
    return [...groups.values()].map(function (group) {
      group.recommendedId = group.members[0];
      group.recommendation = "Združeno po izrisani geometriji: " + group.visualEvidence.slice(0, 3).join(" · ");
      return group;
    }).sort(function (a, b) { return a.number - b.number; });
  }

  function reasonForOccurrence(occurrence) {
    var context = text(occurrence.context).replace(/\\["']/g, '"');
    var aria = context.match(/aria-label=["']([^"']+)["']/i);
    if (aria) return "Uporabljena za dejanje ali stanje »" + aria[1] + "«.";
    var title = context.match(/(?:data-flow-label>|<h\d[^>]*>|<span[^>]*>)([^<]{3,70})</i);
    if (title) return "Vizualno spremlja vsebino »" + title[1].replace(/[+"']/g, "").trim() + "«.";
    if (occurrence.role === "uporaba") return "Prikazuje dejanje, stanje ali podatek v tej komponenti.";
    return "Tu je grafika definirana oziroma vstavljena v izris komponente.";
  }

  function activeFatherData() {
    var number = Number(state.graphicReview.activeFather);
    var itemId = state.graphicReview.fathers[number];
    var item = state.inventory && state.inventory.items.find(function (entry) { return entry.id === itemId; });
    return number && item ? { number: number, item: item } : null;
  }

  function renderFatherWidget() {
    var active = activeFatherData();
    var fathers = Object.keys(state.graphicReview.fathers).map(Number).filter(function (number) {
      var itemId = state.graphicReview.fathers[number];
      return number > 0 && state.inventory.items.some(function (item) { return item.id === itemId; });
    }).sort(function (a, b) { return a - b; });
    els.fatherWidget.hidden = fathers.length === 0;
    document.body.classList.toggle("is-father-collecting", Boolean(active && state.fatherCollecting));
    els.fatherWidgetList.replaceChildren();
    fathers.forEach(function (number) {
      var itemId = state.graphicReview.fathers[number];
      var item = state.inventory.items.find(function (entry) { return entry.id === itemId; });
      var button = document.createElement("button");
      button.type = "button";
      button.className = "father-widget__item";
      button.classList.toggle("is-current", Boolean(active && active.number === number));
      button.setAttribute("aria-pressed", String(Boolean(active && active.number === number && state.fatherCollecting)));
      var preview = document.createElement("span");
      preview.className = "father-widget__predogled";
      previewInto(preview, item);
      var copy = document.createElement("span");
      copy.className = "father-widget__besedilo";
      var name = document.createElement("strong");
      name.textContent = item.name;
      var meta = document.createElement("small");
      meta.textContent = "Skupina " + number;
      copy.append(name, meta);
      button.append(preview, copy);
      button.addEventListener("click", function () {
        state.graphicReview.activeFather = number;
        state.fatherCollecting = true;
        saveGraphicReview();
        renderFatherWidget();
      });
      els.fatherWidgetList.appendChild(button);
    });
    els.fatherWidgetMode.textContent = state.fatherCollecting && active ? "AKTIVNO · DODAJAM V SKUPINO " + active.number : fathers.length + (fathers.length === 1 ? " FATHER · klikni ga" : " FATHERJEV · izberi cilj");
    els.fatherWidget.classList.toggle("is-active", state.fatherCollecting);
  }

  function addItemToActiveFather(item) {
    var active = activeFatherData();
    if (!active || active.item.id === item.id) return;
    Object.keys(state.graphicReview.fathers).forEach(function (key) {
      if (state.graphicReview.fathers[key] === item.id) delete state.graphicReview.fathers[key];
    });
    state.graphicReview.assignments[item.id] = active.number;
    saveGraphicReview();
    renderFamilies();
  }

  function familyMatches(family) {
    var query = els.familySearch.value.trim().toLocaleLowerCase("sl");
    var members = familyItems(family);
    var display = els.familyDisplay.value;
    var selected = Boolean(state.graphicReview.fathers[family.number]);
    return (!query || [family.label, family.id, family.recommendation].concat(members.flatMap(function (item) { return [item.name].concat(item.aliases); })).join(" ").toLocaleLowerCase("sl").includes(query)) &&
      (display === "all" || (display === "multi" ? family.members.length > 1 : family.members.length === 1)) &&
      (!els.familyChoice.value || (els.familyChoice.value === "selected" ? selected : !selected));
  }

  function buildFamilyMember(family, item) {
    var option = els.familyMemberTemplate.content.firstElementChild.cloneNode(true);
    var numberInput = option.querySelector(".druzina-stevilka-vnos");
    var fatherButton = option.querySelector(".druzina-father");
    var recommended = item.id === family.recommendedId;
    var isFather = state.graphicReview.fathers[family.number] === item.id;
    numberInput.value = family.number;
    numberInput.setAttribute("aria-label", "Številka grafične skupine za " + item.name);
    previewInto(option.querySelector(".druzina-razlicica__predogled"), item);
    option.querySelector("strong").textContent = item.name;
    option.querySelector("small").textContent = item.kind.toUpperCase() + " · " + item.occurrences.length + " pojavitev" + (item.status === "canonical" ? " · REGISTER" : "");
    option.classList.toggle("is-recommended", recommended);
    option.classList.toggle("is-father", isFather);
    option.querySelector(".druzina-razlicica__oznaka").textContent = isFather ? "FATHER · VZOREC" : (recommended ? "GRAFIČNI PREDLOG" : "");
    fatherButton.setAttribute("aria-pressed", String(isFather));
    var reasons = option.querySelector(".druzina-razlicica__pojavitve");
    item.occurrences.forEach(function (occurrence) {
      var row = document.createElement("div");
      row.className = "druzina-uporaba";
      row.innerHTML = "<strong>" + text(occurrence.source) + ":" + text(occurrence.line) + "</strong><span>" + reasonForOccurrence(occurrence) + "</span>";
      reasons.appendChild(row);
    });
    option.querySelector("summary").textContent = "Zakaj je uporabljena (" + item.occurrences.length + ")";
    option.title = item.aliases.join(" · ");
    option.addEventListener("click", function (event) {
      if (!state.fatherCollecting || event.target.closest("button, input, summary, a")) return;
      addItemToActiveFather(item);
    });
    function saveNumber() {
      var number = Math.max(1, Math.round(Number(numberInput.value) || family.number));
      numberInput.value = number;
      state.graphicReview.assignments[item.id] = number;
      Object.keys(state.graphicReview.fathers).forEach(function (key) {
        if (state.graphicReview.fathers[key] !== item.id) return;
        delete state.graphicReview.fathers[key];
        if (Number(state.graphicReview.activeFather) === Number(key)) {
          state.graphicReview.activeFather = null;
          state.fatherCollecting = false;
        }
      });
      saveGraphicReview();
      return number;
    }
    numberInput.addEventListener("input", saveNumber);
    numberInput.addEventListener("change", function () { saveNumber(); setTimeout(renderFamilies, 0); });
    numberInput.addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); saveNumber(); renderFamilies(); } });
    fatherButton.addEventListener("click", function () {
      var number = saveNumber();
      Object.keys(state.graphicReview.fathers).forEach(function (key) { if (state.graphicReview.fathers[key] === item.id) delete state.graphicReview.fathers[key]; });
      state.graphicReview.fathers[number] = item.id;
      state.graphicReview.activeFather = number;
      state.fatherCollecting = false;
      saveGraphicReview();
      renderFamilies();
    });
    return option;
  }

  function buildFamilyCard(family) {
    var card = els.familyTemplate.content.firstElementChild.cloneNode(true);
    var selectedId = state.graphicReview.fathers[family.number];
    card.dataset.familyId = family.id;
    card.dataset.selected = String(Boolean(selectedId));
    card.querySelector("h3").textContent = family.label;
    card.querySelector(".druzina-meta").textContent = family.members.length + (family.members.length === 1 ? " različica" : " različic") + " · " + family.occurrences + " pojavitev";
    card.querySelector(".druzina-opis").textContent = family.recommendation;
    card.querySelector(".druzina-stanje").textContent = selectedId ? "FATHER IZBRAN" : "ČAKA FATHER";
    var group = card.querySelector(".druzina-razlicice");
    group.setAttribute("aria-label", family.label);
    familyItems(family).forEach(function (item) { group.appendChild(buildFamilyMember(family, item)); });
    return card;
  }

  function renderFamilySummary() {
    if (!state.families) return;
    var summary = state.families.summary;
    var current = effectiveFamilies();
    var selected = current.filter(function (family) { return Boolean(state.graphicReview.fathers[family.number]); }).length;
    els.familySummary.innerHTML = "<span>" + summary.icons + " ikon</span><span>" + current.length + " grafičnih skupin</span><span>" + current.filter(function (family) { return family.members.length > 1; }).length + " skupin z različicami</span><span>" + selected + "/" + current.length + " izbranih FATHER vzorcev</span>";
  }

  function renderFamilies() {
    if (!state.families || !state.inventory) return;
    var allFamilies = effectiveFamilies();
    var families = allFamilies.filter(familyMatches);
    var fragment = document.createDocumentFragment();
    families.forEach(function (family) { fragment.appendChild(buildFamilyCard(family)); });
    els.familyList.replaceChildren(fragment);
    els.familyCount.textContent = "Prikazanih " + families.length + " od " + allFamilies.length + " grafičnih skupin.";
    renderFamilySummary();
    renderFatherWidget();
  }

  function exportFamilySelections() {
    var payload = {
      schemaVersion: 2,
      catalogSchemaVersion: state.inventory.schemaVersion,
      exportedAt: new Date().toISOString(),
      assignments: state.graphicReview.assignments,
      fathers: state.graphicReview.fathers,
      activeFather: state.graphicReview.activeFather,
      families: [],
    };
    effectiveFamilies().forEach(function (family) {
      var selectedId = state.graphicReview.fathers[family.number];
      if (!selectedId) return;
      var candidate = state.inventory.items.find(function (item) { return item.id === selectedId; });
      if (!candidate || !family.members.includes(selectedId)) return;
      payload.families.push({
        id: family.id,
        number: family.number,
        label: family.label,
        selected: { id: candidate.id, name: candidate.name, fingerprint: candidate.fingerprint },
        members: familyItems(family).map(function (item) { return { id: item.id, name: item.name, fingerprint: item.fingerprint, definitions: item.definitions }; }),
      });
    });
    var blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "uspesni-jezek-ui-ikone-druzine.json";
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function importFamilySelections(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var payload = JSON.parse(String(reader.result || ""));
        if (!payload || payload.schemaVersion !== 2 || !payload.assignments || !payload.fathers) throw new Error("Neveljavna shema");
        var validIds = new Set(state.inventory.items.map(function (item) { return item.id; }));
        var assignments = {};
        Object.keys(payload.assignments).forEach(function (id) { var number = Number(payload.assignments[id]); if (validIds.has(id) && Number.isInteger(number) && number > 0) assignments[id] = number; });
        var fathers = {};
        Object.keys(payload.fathers).forEach(function (number) { if (validIds.has(payload.fathers[number])) fathers[number] = payload.fathers[number]; });
        var activeFather = Number(payload.activeFather);
        state.graphicReview = { assignments: assignments, fathers: fathers, activeFather: fathers[activeFather] ? activeFather : null };
        state.fatherCollecting = false;
        saveGraphicReview();
        renderFamilies();
      } catch (_) {
        window.alert("JSON izbire družin ni veljaven ali ne pripada tej različici kataloga.");
      }
    };
    reader.readAsText(file);
  }

  function exportJson() {
    var payload = {
      schemaVersion: 1,
      catalogSchemaVersion: state.inventory.schemaVersion,
      exportedAt: new Date().toISOString(),
      source: state.inventory.source,
      selections: state.decisions,
      review: state.inventory.items.filter(function (item) { return state.decisions[item.id]; }).map(function (item) {
        return { id: item.id, name: item.name, decision: state.decisions[item.id], fingerprint: item.fingerprint, definitions: item.definitions };
      }),
    };
    var blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "uspesni-jezek-ui-ikone-pregled.json";
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var payload = JSON.parse(String(reader.result || ""));
        if (!payload || payload.schemaVersion !== 1 || !payload.selections || typeof payload.selections !== "object") throw new Error("Neveljavna shema");
        var validIds = new Set(state.inventory.items.map(function (item) { return item.id; }));
        var next = {};
        Object.keys(payload.selections).forEach(function (id) {
          if (validIds.has(id) && ["ok", "off"].includes(payload.selections[id])) next[id] = payload.selections[id];
        });
        state.decisions = next;
        saveDecisions();
        renderSummary();
        render();
      } catch (error) {
        window.alert("JSON pregleda ni veljaven ali ne pripada tej različici kataloga.");
      }
    };
    reader.readAsText(file);
  }

  function renderCanonicalSamples() {
    var host = document.getElementById("kanonicne-ikone");
    var registry = window.UJIzvedbaKomponente;
    if (!registry || typeof registry.ikona !== "function") return;
    [["checkCircle", 14], ["calendar", 18], ["scales", 22]].forEach(function (entry) {
      var sample = document.createElement("span");
      sample.style.width = entry[1] + "px";
      sample.style.height = entry[1] + "px";
      sample.innerHTML = registry.ikona(entry[0]);
      host.appendChild(sample);
    });
  }

  [els.search, els.kind, els.scope, els.decision, els.page].forEach(function (control) { control.addEventListener("input", render); });
  [els.familySearch, els.familyDisplay, els.familyChoice].forEach(function (control) { control.addEventListener("input", renderFamilies); });
  els.fatherWidgetStop.addEventListener("click", function () {
    state.fatherCollecting = false;
    renderFatherWidget();
  });
  document.getElementById("druzine-izvozi").addEventListener("click", exportFamilySelections);
  document.getElementById("druzine-uvozi").addEventListener("click", function () { els.familyFile.click(); });
  els.familyFile.addEventListener("change", function () { if (els.familyFile.files[0]) importFamilySelections(els.familyFile.files[0]); els.familyFile.value = ""; });
  document.getElementById("druzine-pocisti").addEventListener("click", function () {
    if (!window.confirm("Počistim številčne prerazporeditve in vse FATHER vzorce?")) return;
    state.graphicReview = { assignments: {}, fathers: {}, activeFather: null };
    state.fatherCollecting = false;
    saveGraphicReview();
    renderFamilies();
  });
  document.getElementById("izvozi").addEventListener("click", exportJson);
  document.getElementById("uvozi").addEventListener("click", function () { els.file.click(); });
  els.file.addEventListener("change", function () { if (els.file.files[0]) importJson(els.file.files[0]); els.file.value = ""; });
  document.getElementById("pocisti").addEventListener("click", function () {
    if (!window.confirm("Počistim vse lokalne oznake OK/OFF?")) return;
    state.decisions = {};
    saveDecisions();
    renderSummary();
    render();
  });

  renderCanonicalSamples();
  Promise.all([
    fetch("ui-ikone-inventura.json", { cache: "no-store" }).then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); }),
    fetch("ui-ikone-uskladitev.json", { cache: "no-store" }).then(function (response) { return response.ok ? response.json() : null; }).catch(function () { return null; }),
    fetch("ui-ikone-druzine.json", { cache: "no-store" }).then(function (response) { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); }),
  ])
    .then(function (results) {
      state.inventory = results[0];
      state.resolution = results[1];
      state.families = results[2];
      if (state.resolution && Array.isArray(state.resolution.resolved)) {
        state.resolution.resolved.forEach(function (item) {
          state.resolvedFingerprints.add(item.fingerprint);
          item.definitions.forEach(function (definition) {
            state.resolvedDefinitions.add(definitionKey(definition.source, definition.name));
          });
        });
      }
      setupPages();
      renderSummary();
      renderFamilies();
      render();
    })
    .catch(function (error) {
      els.grid.innerHTML = '<p class="katalog-prazno">Inventure ni bilo mogoče naložiti. Zaženite <code>npm run icons:inventory</code>.<br>' + text(error.message) + '</p>';
    });
})();
