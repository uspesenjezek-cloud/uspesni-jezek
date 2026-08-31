(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJAtenaCardRenderer = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var documentFiles = new Map();
  var fitCanvas = null;
  var autoFitBound = false;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char];
    });
  }
  function asArray(value) { return Array.isArray(value) ? value : []; }
  function optionRows(field) { return asArray((field.ui && field.ui.options) || field.options); }
  function parseDocumentValue(value) {
    var raw = String(value || "").trim();
    if (!raw) return { files:[], note:"" };
    if (raw.indexOf("atena-document:") === 0) {
      try {
        var parsed = JSON.parse(raw.slice(15));
        return { files:asArray(parsed.files).map(String).filter(Boolean), note:String(parsed.note || "") };
      } catch (error) { /* Stare ali poškodovane vrednosti spodaj obravnavamo kot ime datoteke. */ }
    }
    return { files:raw.split(/,\s*/).filter(Boolean), note:"" };
  }
  function serializeDocumentValue(files, note) {
    var names = asArray(files).map(String).filter(Boolean);
    return names.length ? "atena-document:" + JSON.stringify({ files:names, note:String(note || "").trim() }) : "";
  }
  function canonicalInput(field, value) {
    return '<input type="hidden" data-ponudba-field="' + field.id + '" value="' + escapeHtml(value) + '">';
  }
  function fieldAttrs(field) {
    var ui = field.ui || {};
    var show = ui.showWhen || null;
    return ' data-atena-field-root data-atena-field-id="' + field.id + '" data-atena-interaction="' + escapeHtml(ui.interaction || field.type || "short-text") + '"' +
      (ui.templateId ? ' data-atena-template-id="' + escapeHtml(ui.templateId) + '"' : '') +
      (field.required ? ' data-atena-required="true"' : '') +
      (show ? ' data-atena-show-field="' + show.fieldId + '" data-atena-show-values="' + escapeHtml(asArray(show.values).join("|")) + '"' : '');
  }
  function fieldOpen(field, value, extraClass) {
    var ui = field.ui || {};
    return '<div class="atena-polje' + (ui.fullWidth !== false ? ' atena-polje--polno' : '') + (extraClass ? ' ' + extraClass : '') + '"' + fieldAttrs(field) + '>' +
      '<span class="atena-polje__oznaka">' + escapeHtml(field.label) + (field.required ? ' <b aria-hidden="true">*</b>' : '') + '</span>' + canonicalInput(field, value);
  }
  function fieldClose(field) {
    return (field.help ? '<small class="atena-polje__pomoc">' + escapeHtml(field.help) + '</small>' : '') +
      '<p class="atena-polje__napaka" data-atena-field-error hidden>To polje je obvezno.</p></div>';
  }
  function choiceHtml(field, value, interaction) {
    var base = String(value || "").split("::")[0];
    var otherValue = String(value || "").indexOf("drugo::") === 0 ? String(value).slice(8) : "";
    var rows = optionRows(field);
    var options = rows.map(function (option) {
      var selected = String(option.id) === base;
      return '<button type="button" class="atena-izbira" data-atena-choice="' + escapeHtml(option.id) + '" aria-pressed="' + (selected ? 'true' : 'false') + '"><span class="atena-izbira__krog" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span><span>' + escapeHtml(option.label) + '</span></button>';
    }).join("");
    var other = rows.some(function (option) { return option.id === "drugo"; })
      ? '<div class="atena-drugo" data-atena-other-wrap' + (base === "drugo" ? '' : ' hidden') + '><label>Opišite drugo možnost<input type="text" data-atena-other-value value="' + escapeHtml(otherValue) + '" autocomplete="off"></label></div>' : '';
    return fieldOpen(field, value, 'atena-polje--izbira') + '<div class="atena-izbire atena-izbire--' + interaction + '" role="group" aria-label="' + escapeHtml(field.label) + '">' + options + '</div>' + other + fieldClose(field);
  }
  function parseNumberUnit(value) {
    var match = String(value || "").trim().match(/^([0-9]+(?:[.,][0-9]+)?)\s+(.+)$/);
    return match ? { number:match[1], unit:match[2] } : { number:"", unit:"" };
  }
  function unitOptions(values, selected) {
    return asArray(values).map(function (unit) { return '<option value="' + escapeHtml(unit) + '"' + (unit === selected ? ' selected' : '') + '>' + escapeHtml(unit) + '</option>'; }).join("");
  }
  function quantityHtml(field, value) {
    var parsed = parseNumberUnit(value);
    var units = (field.ui && field.ui.units) || ["kos","ura","dan","mesec","drugo"];
    return fieldOpen(field, value, 'atena-polje--sestavljeno') + '<div class="atena-kolicina" data-atena-composite><button type="button" data-atena-step="-1" aria-label="Zmanjšaj">−</button><input type="number" min="0" step="1" inputmode="decimal" data-atena-number value="' + escapeHtml(parsed.number) + '" aria-label="Količina"><button type="button" data-atena-step="1" aria-label="Povečaj">+</button><select data-atena-unit aria-label="Enota"><option value="">Enota</option>' + unitOptions(units, parsed.unit) + '</select></div>' + fieldClose(field);
  }
  function durationHtml(field, value) {
    var preset = /^(Enkratno|Nedoločen čas)$/.test(String(value || "")) ? String(value) : "";
    var parsed = preset ? { number:"", unit:"" } : parseNumberUnit(value);
    var showPresets = [5401,16111].includes(Number(field.id));
    var presets = showPresets ? '<div class="atena-hitre-izbire"><button type="button" data-atena-quick-value="Enkratno" aria-pressed="' + (preset === "Enkratno") + '">Enkratno</button><button type="button" data-atena-quick-value="Nedoločen čas" aria-pressed="' + (preset === "Nedoločen čas") + '">Nedoločen čas</button></div>' : '';
    return fieldOpen(field, value, 'atena-polje--sestavljeno') + presets + '<div class="atena-kolicina" data-atena-composite><button type="button" data-atena-step="-1" aria-label="Zmanjšaj">−</button><input type="number" min="0" step="1" inputmode="numeric" data-atena-number value="' + escapeHtml(parsed.number) + '" aria-label="Trajanje"><button type="button" data-atena-step="1" aria-label="Povečaj">+</button><select data-atena-unit aria-label="Časovna enota"><option value="">Enota</option>' + unitOptions(["dni","tedni","meseci","leta"], parsed.unit) + '</select></div>' + fieldClose(field);
  }
  function moneyHtml(field, value) {
    return fieldOpen(field, value, 'atena-polje--znesek') + '<label class="atena-znesek"><input type="text" inputmode="decimal" data-atena-value value="' + escapeHtml(value) + '" placeholder="0,00" autocomplete="off"><span>€</span></label>' + fieldClose(field);
  }
  function moneyPercentHtml(field, value) {
    var parsed = String(value || "").trim().match(/^([0-9]+(?:[.,][0-9]+)?)\s*(€|%)$/);
    var number = parsed ? parsed[1] : "";
    var unit = parsed ? parsed[2] : "€";
    return fieldOpen(field, value, 'atena-polje--sestavljeno') + '<div class="atena-znesek-enota" data-atena-composite><input type="text" inputmode="decimal" data-atena-number value="' + escapeHtml(number) + '" placeholder="0,00" aria-label="Vrednost"><div role="group" aria-label="Enota"><button type="button" data-atena-unit-button="€" aria-pressed="' + (unit === "€") + '">€</button><button type="button" data-atena-unit-button="%" aria-pressed="' + (unit === "%") + '">%</button></div></div>' + fieldClose(field);
  }
  function dateHtml(field, value) {
    var raw = String(value || "");
    var approximate = raw.indexOf("Približno: ") === 0;
    var unknown = raw === "Ne vem";
    var date = approximate ? raw.slice(11) : (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "");
    return fieldOpen(field, value, 'atena-polje--datum') + '<div class="atena-datum" data-atena-composite><input type="date" data-atena-date-value value="' + escapeHtml(date) + '" aria-label="' + escapeHtml(field.label) + '"><div class="atena-hitre-izbire" role="group" aria-label="Natančnost datuma"><button type="button" data-atena-date-mode="unknown" aria-pressed="' + unknown + '">Ne vem</button><button type="button" data-atena-date-mode="approximate" aria-pressed="' + approximate + '">Približno</button></div></div>' + fieldClose(field);
  }
  function deadlineHtml(field, value) {
    var raw = String(value || "");
    var prefix = raw.indexOf("Približno: ") === 0 ? "Približno: " : "";
    var text = raw === "Ne vem" ? "" : raw.slice(prefix.length);
    return fieldOpen(field, value, 'atena-polje--rok') + '<div class="atena-rok" data-atena-composite><input type="text" data-atena-free-value value="' + escapeHtml(text) + '" placeholder="Datum, obdobje ali število dni"><div class="atena-hitre-izbire"><button type="button" data-atena-deadline-mode="unknown" aria-pressed="' + (raw === "Ne vem") + '">Ne vem</button><button type="button" data-atena-deadline-mode="approximate" aria-pressed="' + Boolean(prefix) + '">Približno</button></div></div>' + fieldClose(field);
  }
  function scheduleHtml(field, value) {
    var quicks = (field.ui && field.ui.quickValues) || ["Enkratno","Po dogovoru","Redno"];
    return fieldOpen(field, value, 'atena-polje--termin') + '<div class="atena-termin" data-atena-composite><input type="text" data-atena-free-value value="' + escapeHtml(value) + '" placeholder="Datum, časovno okno ali pogostost"><div class="atena-hitre-izbire">' + quicks.map(function (quick) { return '<button type="button" data-atena-quick-value="' + escapeHtml(quick) + '" aria-pressed="' + (quick === value) + '">' + escapeHtml(quick) + '</button>'; }).join("") + '</div></div>' + fieldClose(field);
  }
  function rateHtml(field, value) {
    var parsed = String(value || "").match(/^(.+?)\s+(%|€\/enoto|€\/uro|drugo)$/);
    return fieldOpen(field, value, 'atena-polje--sestavljeno') + '<div class="atena-stopnja" data-atena-composite><input type="text" inputmode="decimal" data-atena-free-value value="' + escapeHtml(parsed ? parsed[1] : value) + '" placeholder="Vrednost ali prag"><select data-atena-unit><option value="">Osnova</option>' + unitOptions(["%","€/enoto","€/uro","drugo"], parsed ? parsed[2] : "") + '</select></div>' + fieldClose(field);
  }
  function durationPairHtml(field, value) {
    var parts = String(value || "").split(";");
    var first = parseNumberUnit((parts[0] || "").replace(/^Odziv:\s*/, ""));
    var second = parseNumberUnit((parts[1] || "").replace(/^Odprava:\s*/, ""));
    function row(label, prefix, parsed) { return '<label><span>' + label + '</span><span class="atena-cas-par__vnos"><input type="number" min="0" data-atena-pair-number="' + prefix + '" value="' + escapeHtml(parsed.number) + '"><select data-atena-pair-unit="' + prefix + '"><option value="">Enota</option>' + unitOptions(["ur","dni","tedni"], parsed.unit) + '</select></span></label>'; }
    return fieldOpen(field, value, 'atena-polje--sestavljeno') + '<div class="atena-cas-par" data-atena-composite>' + row("Odziv", "response", first) + row("Odprava", "resolution", second) + '</div>' + fieldClose(field);
  }
  function availabilityHtml(field, value) {
    var percent = String(value || "").match(/^([0-9]+(?:[.,][0-9]+)?)\s*%$/);
    var mode = percent ? "percent" : "hours";
    return fieldOpen(field, value, 'atena-polje--sestavljeno') + '<div class="atena-razpolozljivost" data-atena-composite data-atena-mode="' + mode + '"><div class="atena-hitre-izbire"><button type="button" data-atena-mode-button="percent" aria-pressed="' + (mode === "percent") + '">Odstotek SLA</button><button type="button" data-atena-mode-button="hours" aria-pressed="' + (mode === "hours") + '">Delovni čas</button></div><label data-atena-mode-panel="percent"><input type="range" min="90" max="100" step="0.1" value="' + escapeHtml(percent ? percent[1].replace(",", ".") : "99.9") + '" data-atena-range><output>' + escapeHtml(percent ? percent[1] : "99,9") + ' %</output></label><input type="text" data-atena-free-value value="' + escapeHtml(mode === "hours" ? value : "") + '" placeholder="npr. pon.–pet. 8.00–16.00" data-atena-mode-panel="hours"></div>' + fieldClose(field);
  }
  function documentHtml(field, value) {
    var saved = parseDocumentValue(value);
    var summary = saved.files.join(", ");
    return fieldOpen(field, value, 'atena-polje--dokument') + '<div class="atena-dokument" data-atena-composite><label class="atena-dokument__dodaj"><input type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.heic,.txt" data-atena-file-input><span><b>＋ Dodajte dokument</b><small>PDF, fotografija ali datoteka</small></span></label><div class="atena-dokument__datoteke" data-atena-file-list' + (summary ? '' : ' hidden') + '><span data-atena-file-summary>' + escapeHtml(summary) + '</span><button type="button" data-atena-file-remove aria-label="Odstrani dokument">Odstrani</button></div><label class="atena-dokument__opomba">Kaj dokazilo potrjuje?<textarea rows="2" data-atena-file-note placeholder="Dodajte kratko povezavo z dejstvom">' + escapeHtml(saved.note) + '</textarea></label></div>' + fieldClose(field);
  }
  function listBuilderHtml(field, value) {
    var items = String(value || "").split(/\r?\n/).map(function (item) { return item.trim(); }).filter(Boolean);
    return fieldOpen(field, value, 'atena-polje--seznam') + '<div class="atena-seznam" data-atena-composite><div data-atena-list-items>' + items.map(function (item, index) { return '<span>' + escapeHtml(item) + '<button type="button" data-atena-list-remove="' + index + '" aria-label="Odstrani ' + escapeHtml(item) + '">×</button></span>'; }).join("") + '</div><div class="atena-seznam__dodaj"><input type="text" data-atena-list-input placeholder="Dodajte postavko"><button type="button" data-atena-list-add>Dodaj</button></div></div>' + fieldClose(field);
  }
  function fieldHtml(field, value) {
    var interaction = field.ui && field.ui.interaction || field.type || "short-text";
    value = value == null ? "" : String(value);
    if (["choice-segments","choice-grid","choice-list","payment-method"].includes(interaction)) return choiceHtml(field, value, interaction);
    if (interaction === "dropdown") return fieldOpen(field, value, 'atena-polje--dropdown') + '<select data-atena-value aria-label="' + escapeHtml(field.label) + '"><option value="">Izberite možnost</option>' + optionRows(field).map(function (option) { return '<option value="' + escapeHtml(option.id) + '"' + (String(option.id) === value ? ' selected' : '') + '>' + escapeHtml(option.label) + '</option>'; }).join("") + '</select>' + fieldClose(field);
    if (interaction === "quantity-unit") return quantityHtml(field, value);
    if (interaction === "duration") return durationHtml(field, value);
    if (interaction === "money") return moneyHtml(field, value);
    if (interaction === "money-or-percent") return moneyPercentHtml(field, value);
    if (interaction === "date") return dateHtml(field, value);
    if (interaction === "deadline") return deadlineHtml(field, value);
    if (interaction === "schedule") return scheduleHtml(field, value);
    if (interaction === "rate") return rateHtml(field, value);
    if (interaction === "duration-pair") return durationPairHtml(field, value);
    if (interaction === "availability") return availabilityHtml(field, value);
    if (interaction === "document-upload") return documentHtml(field, value);
    if (interaction === "list-builder") return listBuilderHtml(field, value);
    if (interaction === "long-text") return fieldOpen(field, value, 'atena-polje--besedilo') + '<textarea rows="3" data-atena-value data-ponudba-samorastoci placeholder="Vpišite odgovor s svojimi besedami">' + escapeHtml(value) + '</textarea>' + fieldClose(field);
    return fieldOpen(field, value, 'atena-polje--kratko') + '<input type="text" data-atena-value value="' + escapeHtml(value) + '" autocomplete="off">' + fieldClose(field);
  }
  function moduleContentHtml(card, fields, values) {
    var allFields = asArray(fields || (card && card.fields));
    var state = values || {};
    var secondaryIds = new Set(asArray(card && card.ui && card.ui.secondaryFieldIds).map(Number));
    var primary = allFields.filter(function (field) { return !secondaryIds.has(Number(field.id)); });
    var secondary = allFields.filter(function (field) { return secondaryIds.has(Number(field.id)); });
    var html = primary.map(function (field) { return fieldHtml(field, state[field.id]); }).join("");
    if (secondary.length) html += '<details class="atena-dodatna-polja"><summary>Dodajte še druge znane pogoje <span>＋</span></summary><div class="atena-dodatna-polja__vsebina">' + secondary.map(function (field) { return fieldHtml(field, state[field.id]); }).join("") + '</div></details>';
    return html;
  }
  function questionShellHtml(config) {
    var card = config || {};
    var step = Math.max(1, Number(card.step) || 1);
    var total = Math.max(step, Number(card.total) || step);
    return '<section class="ponudba-obrazec__modul atena-vprasanje-kartica" aria-label="' + escapeHtml(card.ariaLabel || card.question || card.title) + '"><header class="atena-vprasanje-kartica__glava"><span class="atena-vprasanje-kartica__ikona" aria-hidden="true">' + (card.iconHtml || "") + '</span><span class="atena-vprasanje-kartica__naslov"><strong>Dopolnite ' + step + '/' + total + ' · ' + escapeHtml(card.title) + '</strong><small>' + escapeHtml(card.description || "Vsi manjkajoči podatki tega vprašanja so združeni tukaj.") + '</small></span><button type="button" class="atena-vprasanje-kartica__spremeni" data-atena-question-change>Spremeni</button></header>' + (card.question ? '<p class="atena-vprasanje-kartica__vprasanje">' + escapeHtml(card.question) + '</p>' : '') + '<div class="ponudba-obrazec__modul-polja">' + (card.contentHtml || "") + '</div></section>';
  }
  function renderAreas(container, suggestions, options) {
    if (!container) return;
    var config = options || {}; container.innerHTML = ""; container.hidden = !suggestions.length; if (!suggestions.length) return;
    var heading = document.createElement("p"); heading.className = "atena-predlogi__naslov"; heading.textContent = config.heading || "Atena predlaga najpomembnejša področja"; container.appendChild(heading);
    var list = document.createElement("div"); list.className = "atena-predlogi__mreza"; list.setAttribute("role", "group"); list.setAttribute("aria-label", "Predlagana področja");
    suggestions.forEach(function (suggestion) { var button = document.createElement("button"); button.type = "button"; button.className = "atena-predlogi__kartica"; button.dataset.atenaArea = suggestion.code; button.setAttribute("aria-label", suggestion.ariaLabel); var title = document.createElement("strong"); title.textContent = suggestion.label; var detail = document.createElement("small"); detail.textContent = suggestion.moduleIds.length === 1 ? "1 relevantno vprašanje" : suggestion.moduleIds.length === 2 ? "2 relevantni vprašanji" : suggestion.moduleIds.length + " relevantna vprašanja"; button.appendChild(title); button.appendChild(detail); button.addEventListener("click", function () { if (config.onOpen) config.onOpen(suggestion); }); list.appendChild(button); });
    container.appendChild(list);
  }
  function rootFor(target) { return target && target.closest ? target.closest("[data-atena-field-root]") : null; }
  function canonical(root) { return root && root.querySelector("[data-ponudba-field]"); }
  function setCanonical(root, value) { var input = canonical(root); if (input) input.value = String(value == null ? "" : value).trim(); }
  function getCanonical(root) { var input = canonical(root); return input ? String(input.value || "").trim() : ""; }
  function fitTextControl(control) {
    if (!control || !control.matches || !control.matches('input[type="text"],input[type="number"]') || typeof document === "undefined" || typeof getComputedStyle !== "function") return;
    var value = String(control.value || control.placeholder || "");
    var computed = getComputedStyle(control);
    var base = Number(control.dataset.atenaBaseFontSize) || parseFloat(computed.fontSize) || 16;
    control.dataset.atenaBaseFontSize = String(base);
    if (!value || !control.clientWidth) { control.style.setProperty("font-size", base + "px", "important"); return; }
    fitCanvas = fitCanvas || document.createElement("canvas");
    var context = fitCanvas.getContext("2d");
    if (!context) return;
    context.font = [computed.fontStyle, computed.fontWeight, base + "px", computed.fontFamily].filter(Boolean).join(" ");
    var horizontalPadding = (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0) + 4;
    var available = Math.max(24, control.clientWidth - horizontalPadding);
    var measured = context.measureText(value).width;
    var size = measured > available ? Math.max(8, Math.floor(base * available / measured * 10) / 10) : base;
    control.style.setProperty("font-size", size + "px", "important");
  }
  function fitTextControls(container) {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('input[type="text"],input[type="number"]').forEach(fitTextControl);
  }
  function syncComposite(root) {
    if (!root) return;
    var interaction = root.dataset.atenaInteraction; var direct = root.querySelector("[data-atena-value]"); if (direct) setCanonical(root, direct.value);
    if (interaction === "quantity-unit" || interaction === "duration") { var number = root.querySelector("[data-atena-number]"); var unit = root.querySelector("[data-atena-unit]"); if (number && unit) setCanonical(root, [number.value, unit.value].filter(Boolean).join(" ")); }
    else if (interaction === "money-or-percent") { var amount = root.querySelector("[data-atena-number]"); var unitButton = root.querySelector("[data-atena-unit-button][aria-pressed=true]"); setCanonical(root, amount && amount.value ? amount.value + " " + (unitButton ? unitButton.dataset.atenaUnitButton : "€") : ""); }
    else if (interaction === "rate") { var rate = root.querySelector("[data-atena-free-value]"); var basis = root.querySelector("[data-atena-unit]"); setCanonical(root, [rate && rate.value, basis && basis.value].filter(Boolean).join(" ")); }
    else if (interaction === "schedule") { var schedule = root.querySelector("[data-atena-free-value]"); setCanonical(root, schedule && schedule.value); }
    else if (interaction === "deadline") { var deadline = root.querySelector("[data-atena-free-value]"); var approximate = root.querySelector("[data-atena-deadline-mode=approximate][aria-pressed=true]"); if (deadline && deadline.value) setCanonical(root, (approximate ? "Približno: " : "") + deadline.value); }
    else if (interaction === "date") { var date = root.querySelector("[data-atena-date-value]"); var approxDate = root.querySelector("[data-atena-date-mode=approximate][aria-pressed=true]"); if (date && date.value) setCanonical(root, (approxDate ? "Približno: " : "") + date.value); }
    else if (interaction === "duration-pair") { var rn = root.querySelector("[data-atena-pair-number=response]"); var ru = root.querySelector("[data-atena-pair-unit=response]"); var fn = root.querySelector("[data-atena-pair-number=resolution]"); var fu = root.querySelector("[data-atena-pair-unit=resolution]"); var response = [rn && rn.value, ru && ru.value].filter(Boolean).join(" "); var resolution = [fn && fn.value, fu && fu.value].filter(Boolean).join(" "); setCanonical(root, [response ? "Odziv: " + response : "", resolution ? "Odprava: " + resolution : ""].filter(Boolean).join("; ")); }
    else if (interaction === "availability") { var wrapper = root.querySelector(".atena-razpolozljivost"); var mode = wrapper && wrapper.dataset.atenaMode; var range = root.querySelector("[data-atena-range]"); var hours = root.querySelector("[data-atena-free-value]"); setCanonical(root, mode === "percent" ? (range ? String(range.value).replace(".", ",") + " %" : "") : (hours && hours.value)); var output = root.querySelector("output"); if (output && range) output.textContent = String(range.value).replace(".", ",") + " %"; }
  }
  function refreshConditional(container) {
    if (!container) return;
    container.querySelectorAll("[data-atena-show-field]").forEach(function (fieldRoot) { var controller = container.querySelector('[data-atena-field-id="' + fieldRoot.dataset.atenaShowField + '"]'); var current = getCanonical(controller).split("::")[0]; var visible = String(fieldRoot.dataset.atenaShowValues || "").split("|").includes(current); fieldRoot.hidden = !visible; fieldRoot.querySelectorAll("input:not([type=hidden]),select,textarea,button").forEach(function (control) { control.disabled = !visible; }); });
  }
  function clearError(root) { if (!root) return; root.removeAttribute("data-atena-error"); var error = root.querySelector("[data-atena-field-error]"); if (error) error.hidden = true; root.querySelectorAll("[aria-invalid=true]").forEach(function (control) { control.removeAttribute("aria-invalid"); }); }
  function refreshChoice(root, selected) { root.querySelectorAll("[data-atena-choice]").forEach(function (button) { button.setAttribute("aria-pressed", button.dataset.atenaChoice === selected ? "true" : "false"); }); var other = root.querySelector("[data-atena-other-wrap]"); if (other) other.hidden = selected !== "drugo"; }
  function renderListItems(root) { var holder = root.querySelector("[data-atena-list-items]"); if (!holder) return; var items = getCanonical(root).split(/\r?\n/).map(function (item) { return item.trim(); }).filter(Boolean); holder.innerHTML = items.map(function (item, index) { return '<span>' + escapeHtml(item) + '<button type="button" data-atena-list-remove="' + index + '" aria-label="Odstrani ' + escapeHtml(item) + '">×</button></span>'; }).join(""); }
  function refreshModePanels(root) { var wrapper = root.querySelector(".atena-razpolozljivost"); if (!wrapper) return; root.querySelectorAll("[data-atena-mode-panel]").forEach(function (panel) { panel.hidden = panel.dataset.atenaModePanel !== wrapper.dataset.atenaMode; }); }
  function handleClick(event, container) {
    var target = event.target.closest("button"); if (!target) return false; var root = rootFor(target); if (!root) return false;
    if (target.hasAttribute("data-atena-choice")) { var selected = target.dataset.atenaChoice; setCanonical(root, selected); refreshChoice(root, selected); var other = root.querySelector("[data-atena-other-value]"); if (selected === "drugo" && other) other.focus(); }
    else if (target.hasAttribute("data-atena-step")) { var number = root.querySelector("[data-atena-number]"); if (number) number.value = String(Math.max(0, (Number(number.value) || 0) + Number(target.dataset.atenaStep))); syncComposite(root); }
    else if (target.hasAttribute("data-atena-unit-button")) { root.querySelectorAll("[data-atena-unit-button]").forEach(function (button) { button.setAttribute("aria-pressed", button === target ? "true" : "false"); }); syncComposite(root); }
    else if (target.hasAttribute("data-atena-quick-value")) { var quick = target.dataset.atenaQuickValue; setCanonical(root, quick); var free = root.querySelector("[data-atena-free-value]"); if (free) free.value = quick; root.querySelectorAll("[data-atena-quick-value]").forEach(function (button) { button.setAttribute("aria-pressed", button === target ? "true" : "false"); }); var numberInput = root.querySelector("[data-atena-number]"); if (numberInput) numberInput.value = ""; }
    else if (target.hasAttribute("data-atena-date-mode")) { var mode = target.dataset.atenaDateMode; root.querySelectorAll("[data-atena-date-mode]").forEach(function (button) { button.setAttribute("aria-pressed", button === target ? "true" : "false"); }); if (mode === "unknown") setCanonical(root, "Ne vem"); else syncComposite(root); }
    else if (target.hasAttribute("data-atena-deadline-mode")) { var dm = target.dataset.atenaDeadlineMode; root.querySelectorAll("[data-atena-deadline-mode]").forEach(function (button) { button.setAttribute("aria-pressed", button === target ? "true" : "false"); }); if (dm === "unknown") setCanonical(root, "Ne vem"); else syncComposite(root); }
    else if (target.hasAttribute("data-atena-mode-button")) { var wrapper = root.querySelector(".atena-razpolozljivost"); if (wrapper) wrapper.dataset.atenaMode = target.dataset.atenaModeButton; root.querySelectorAll("[data-atena-mode-button]").forEach(function (button) { button.setAttribute("aria-pressed", button === target ? "true" : "false"); }); refreshModePanels(root); syncComposite(root); }
    else if (target.hasAttribute("data-atena-file-remove")) { setCanonical(root, ""); documentFiles.delete(root.dataset.atenaFieldId); var fileInput = root.querySelector("[data-atena-file-input]"); if (fileInput) fileInput.value = ""; var fileList = root.querySelector("[data-atena-file-list]"); if (fileList) fileList.hidden = true; var note = root.querySelector("[data-atena-file-note]"); if (note) note.value = ""; }
    else if (target.hasAttribute("data-atena-list-add")) { var listInput = root.querySelector("[data-atena-list-input]"); var item = listInput && listInput.value.trim(); if (item) { var items = getCanonical(root).split(/\r?\n/).filter(Boolean); var duplicate = items.some(function (existing) { return existing.localeCompare(item, "sl-SI", { sensitivity:"accent" }) === 0; }); if (!duplicate) items.push(item); setCanonical(root, items.join("\n")); listInput.value = ""; renderListItems(root); } }
    else if (target.hasAttribute("data-atena-list-remove")) { var rows = getCanonical(root).split(/\r?\n/).filter(Boolean); rows.splice(Number(target.dataset.atenaListRemove), 1); setCanonical(root, rows.join("\n")); renderListItems(root); }
    else return false;
    fitTextControls(root); clearError(root); refreshConditional(container || root.closest("form") || document); return true;
  }
  function handleInput(event, container) { var root = rootFor(event.target); if (!root) return false; if (event.target.hasAttribute("data-atena-other-value")) setCanonical(root, event.target.value ? "drugo::" + event.target.value : "drugo"); else if (event.target.hasAttribute("data-atena-file-note")) { var saved = parseDocumentValue(getCanonical(root)); setCanonical(root, serializeDocumentValue(saved.files, event.target.value)); } else syncComposite(root); fitTextControl(event.target); clearError(root); refreshConditional(container || root.closest("form") || document); return true; }
  function handleChange(event, container) { var root = rootFor(event.target); if (!root) return false; if (event.target.hasAttribute("data-atena-file-input")) { var files = Array.from(event.target.files || []); var names = files.map(function (file) { return file.name; }); var note = root.querySelector("[data-atena-file-note]"); documentFiles.set(root.dataset.atenaFieldId, files); setCanonical(root, serializeDocumentValue(names, note && note.value)); var summary = names.join(", "); var list = root.querySelector("[data-atena-file-list]"); var label = root.querySelector("[data-atena-file-summary]"); if (list) list.hidden = !summary; if (label) label.textContent = summary; } else syncComposite(root); fitTextControl(event.target); clearError(root); refreshConditional(container || root.closest("form") || document); return true; }
  function hydrate(container) { if (!container) return; container.querySelectorAll("[data-atena-field-root]").forEach(refreshModePanels); refreshConditional(container); fitTextControls(container); if (typeof document !== "undefined" && document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitTextControls(container); }); if (!autoFitBound && typeof window !== "undefined") { autoFitBound = true; window.addEventListener("resize", function () { fitTextControls(document); }, { passive:true }); } }
  function validate(container) {
    if (!container) return true; var first = null;
    container.querySelectorAll('[data-atena-field-root][data-atena-required="true"]').forEach(function (root) { if (root.hidden || root.closest("details:not([open])")) return; var value = getCanonical(root); var invalid = !value || (root.dataset.atenaInteraction === "document-upload" && !parseDocumentValue(value).files.length); root.toggleAttribute("data-atena-error", invalid); var error = root.querySelector("[data-atena-field-error]"); if (error) error.hidden = !invalid; var focus = root.querySelector("input:not([type=hidden]),textarea,select,button"); if (focus) { if (invalid) focus.setAttribute("aria-invalid", "true"); else focus.removeAttribute("aria-invalid"); } if (invalid && !first) first = focus; });
    if (first) { first.focus({ preventScroll:true }); if (first.scrollIntoView) first.scrollIntoView({ block:"center", behavior:"smooth" }); return false; } return true;
  }
  function collectValues(container) { var values = {}; if (!container) return values; container.querySelectorAll("[data-atena-field-root]").forEach(function (root) { if (!root.hidden) values[root.dataset.atenaFieldId] = getCanonical(root); }); return values; }
  function displayValue(field, value) { var raw = String(value || ""); if (field && field.ui && field.ui.interaction === "document-upload") { var documentValue = parseDocumentValue(raw); return documentValue.files.join(", ") + (documentValue.note ? " — " + documentValue.note : ""); } var base = raw.split("::")[0]; var option = optionRows(field).find(function (row) { return String(row.id) === base; }); return option ? option.label + (raw.indexOf("::") > -1 ? ": " + raw.split("::").slice(1).join("::") : "") : raw; }
  function getFiles(fieldId) { return asArray(documentFiles.get(String(fieldId))); }
  return Object.freeze({ version:"atena-card-renderer-v5", renderAreas:renderAreas, questionShellHtml:questionShellHtml, fieldHtml:fieldHtml, moduleContentHtml:moduleContentHtml, handleClick:handleClick, handleInput:handleInput, handleChange:handleChange, hydrate:hydrate, validate:validate, collectValues:collectValues, displayValue:displayValue, getFiles:getFiles });
});
