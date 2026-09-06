(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJAtenaCardRenderer = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var documentFiles = new Map();
  var fitCanvas = null;
  var autoFitBound = false;
  var customSelectContainers = typeof WeakSet !== "undefined" ? new WeakSet() : null;
  var customSelectDocumentBound = false;
  var CONTEXT_VERSION = "atena-interface-context-v2";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char];
    });
  }
  function asArray(value) { return Array.isArray(value) ? value : []; }
  function optionRows(field) {
    var rows = asArray((field.ui && field.ui.options) || field.options);
    var contracts = asArray(field.context && field.context.canonical && field.context.canonical.allowedValues);
    return rows.map(function (row) {
      var match = contracts.find(function (item) { return String(item.id) === String(row.id); });
      var interfaceId = match && match.interfaceId ? scopedContractId(field, match.interfaceId) : "";
      return Object.assign({}, row, interfaceId ? { interfaceId:interfaceId } : {});
    });
  }
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
  function fieldScope(field) { return field && field._atenaScope || null; }
  function scopedContractId(field, interfaceId) {
    var scope = fieldScope(field);
    if (!scope || !interfaceId) return interfaceId;
    return String(interfaceId) + ":scope:" + idSlug(scope.scopeId || "scope") + ":instance:" + idSlug(scope.instanceKey || "instance");
  }
  function canonicalInput(field, value) {
    var scope = fieldScope(field);
    return '<input type="hidden" data-ponudba-field="' + field.id + '"' + (scope && scope.storageKey ? ' data-atena-storage-key="' + escapeHtml(scope.storageKey) + '"' : '') + ' value="' + escapeHtml(value) + '">';
  }
  function fieldAttrs(field) {
    var ui = field.ui || {};
    var show = ui.showWhen || null;
    var context = field.context || {};
    var scope = fieldScope(field);
    var interfaceId = scope && scope.interfaceId || field.interfaceId;
    var controlIds = context.ui && context.ui.controlInterfaceIds;
    var optionIds = context.ui && context.ui.optionInterfaceIds;
    var relationIds = context.relations && context.relations.map(function (item) { return item.interfaceId; });
    return ' data-atena-field-root data-atena-field-id="' + field.id + '" data-atena-interaction="' + escapeHtml(ui.interaction || field.type || "short-text") + '"' +
      (interfaceId ? ' data-atena-interface-id="' + escapeHtml(interfaceId) + '"' : '') +
      (scope && scope.storageKey ? ' data-atena-storage-key="' + escapeHtml(scope.storageKey) + '"' : '') +
      (scope && scope.instanceKey ? ' data-atena-instance-key="' + escapeHtml(scope.instanceKey) + '"' : '') +
      (scope && scope.scopeId ? ' data-reaktivni-scope-id="' + escapeHtml(scope.scopeId) + '"' : '') +
      (scope && scope.definitionId ? ' data-reaktivni-definicija-id="' + escapeHtml(scope.definitionId) + '"' : '') +
      (field.context && field.context.cardId ? ' data-atena-card-id="' + escapeHtml(field.context.cardId) + '"' : '') +
      (ui.contextVersion ? ' data-atena-context-version="' + escapeHtml(ui.contextVersion) + '"' : '') +
      (ui.templateId ? ' data-atena-template-id="' + escapeHtml(ui.templateId) + '"' : '') +
      (controlIds ? ' data-atena-control-ids="' + escapeHtml(controlIds.map(function (id) { return scopedContractId(field, id); }).join("|")) + '"' : '') +
      (optionIds ? ' data-atena-option-ids="' + escapeHtml(optionIds.map(function (id) { return scopedContractId(field, id); }).join("|")) + '"' : '') +
      (relationIds && relationIds.length ? ' data-atena-relation-ids="' + escapeHtml(relationIds.map(function (id) { return scopedContractId(field, id); }).join("|")) + '"' : '') +
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
      var domId = fieldScope(field) && option.interfaceId ? ' id="' + escapeHtml(idSlug(option.interfaceId + "-choice")) + '"' : '';
      return '<button type="button" class="atena-izbira" data-atena-choice="' + escapeHtml(option.id) + '"' + domId + (option.interfaceId ? ' data-atena-option-id="' + escapeHtml(option.interfaceId) + '"' : '') + ' aria-pressed="' + (selected ? 'true' : 'false') + '"><span class="atena-izbira__krog" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span><span>' + escapeHtml(option.label) + '</span></button>';
    }).join("");
    var other = rows.some(function (option) { return option.id === "drugo"; })
      ? '<div class="atena-drugo" data-atena-other-wrap' + (base === "drugo" ? '' : ' hidden') + '><label>Opišite drugo možnost<input type="text" data-atena-other-value value="' + escapeHtml(otherValue) + '" autocomplete="off"></label></div>' : '';
    return fieldOpen(field, value, 'atena-polje--izbira') + '<div class="atena-izbire atena-izbire--' + interaction + '" role="group" aria-label="' + escapeHtml(field.label) + '">' + options + '</div>' + other + fieldClose(field);
  }
  function parseNumberUnit(value) {
    var match = String(value || "").trim().match(/^([0-9]+(?:[.,][0-9]+)?)\s+(.+)$/);
    return match ? { number:match[1], unit:match[2] } : { number:"", unit:"" };
  }
  function customSelectHtml(field, config) {
    var settings = config || {};
    var selectedValue = String(settings.selected || "");
    var placeholder = settings.placeholder || "Izberite možnost";
    var rows = [{ id:"", label:placeholder }].concat(asArray(settings.rows));
    var selected = rows.find(function (row) { return String(row.id) === selectedValue; }) || rows[0];
    var scope = fieldScope(field);
    var menuScope = scope ? "-" + (scope.scopeId || "scope") + "-" + (scope.instanceKey || scope.storageKey || "instance") : "";
    var menuId = "atena-select-" + idSlug(field.id + "-" + (settings.key || "value") + menuScope);
    var label = settings.label || field.label || placeholder;
    var options = rows.map(function (row) {
      var active = String(row.id) === selectedValue;
      var optionId = row.interfaceId ? ' data-atena-option-id="' + escapeHtml(row.interfaceId) + '"' : '';
      var domId = scope && row.interfaceId ? ' id="' + escapeHtml(idSlug(row.interfaceId + "-dropdown")) + '"' : '';
      return '<button type="button" class="atena-lep-izbirnik__izbira' + (active ? ' is-selected' : '') + '" role="option" tabindex="-1" data-atena-select-option="' + escapeHtml(row.id) + '" aria-selected="' + String(active) + '"' + domId + optionId + '>' + escapeHtml(row.label) + '</button>';
    }).join("");
    var nativeOptions = rows.map(function (row) {
      var optionId = row.interfaceId ? ' data-atena-option-id="' + escapeHtml(row.interfaceId) + '"' : '';
      var domId = scope && row.interfaceId ? ' id="' + escapeHtml(idSlug(row.interfaceId + "-native")) + '"' : '';
      return '<option value="' + escapeHtml(row.id) + '"' + domId + optionId + (String(row.id) === selectedValue ? ' selected' : '') + '>' + escapeHtml(row.label) + '</option>';
    }).join("");
    return '<div class="atena-lep-izbirnik" data-atena-select><select hidden tabindex="-1" aria-hidden="true" data-atena-select-source ' + (settings.nativeAttrs || "") + '>' + nativeOptions + '</select><button type="button" class="atena-lep-izbirnik__gumb" data-atena-select-toggle role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + escapeHtml(menuId) + '" aria-label="' + escapeHtml(label + ": " + selected.label) + '"><span data-atena-select-label>' + escapeHtml(selected.label) + '</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg></button><div class="atena-lep-izbirnik__meni" id="' + escapeHtml(menuId) + '" data-atena-select-menu role="listbox" aria-label="' + escapeHtml(label) + '" hidden>' + options + '</div></div>';
  }
  function quantityHtml(field, value) {
    var parsed = parseNumberUnit(value);
    var units = (field.ui && field.ui.units) || ["kos","ura","dan","mesec","drugo"];
    return fieldOpen(field, value, 'atena-polje--sestavljeno') + '<div class="atena-kolicina" data-atena-composite><button type="button" data-atena-step="-1" aria-label="Zmanjšaj">−</button><input type="number" min="0" step="1" inputmode="decimal" data-atena-number value="' + escapeHtml(parsed.number) + '" aria-label="Količina"><button type="button" data-atena-step="1" aria-label="Povečaj">+</button>' + customSelectHtml(field, { key:"unit", label:"Enota", placeholder:"Enota", selected:parsed.unit, rows:asArray(units).map(function (unit) { return { id:unit, label:unit }; }), nativeAttrs:'data-atena-unit aria-label="Enota"' }) + '</div>' + fieldClose(field);
  }
  function durationHtml(field, value) {
    var preset = /^(Enkratno|Nedoločen čas)$/.test(String(value || "")) ? String(value) : "";
    var parsed = preset ? { number:"", unit:"" } : parseNumberUnit(value);
    var showPresets = [5401,16111].includes(Number(field.id));
    var presets = showPresets ? '<div class="atena-hitre-izbire"><button type="button" data-atena-quick-value="Enkratno" aria-pressed="' + (preset === "Enkratno") + '">Enkratno</button><button type="button" data-atena-quick-value="Nedoločen čas" aria-pressed="' + (preset === "Nedoločen čas") + '">Nedoločen čas</button></div>' : '';
    return fieldOpen(field, value, 'atena-polje--sestavljeno') + presets + '<div class="atena-kolicina" data-atena-composite><button type="button" data-atena-step="-1" aria-label="Zmanjšaj">−</button><input type="number" min="0" step="1" inputmode="numeric" data-atena-number value="' + escapeHtml(parsed.number) + '" aria-label="Trajanje"><button type="button" data-atena-step="1" aria-label="Povečaj">+</button>' + customSelectHtml(field, { key:"duration-unit", label:"Časovna enota", placeholder:"Enota", selected:parsed.unit, rows:["dni","tedni","meseci","leta"].map(function (unit) { return { id:unit, label:unit }; }), nativeAttrs:'data-atena-unit aria-label="Časovna enota"' }) + '</div>' + fieldClose(field);
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
    return fieldOpen(field, value, 'atena-polje--sestavljeno') + '<div class="atena-stopnja" data-atena-composite><input type="text" inputmode="decimal" data-atena-free-value value="' + escapeHtml(parsed ? parsed[1] : value) + '" placeholder="Vrednost ali prag">' + customSelectHtml(field, { key:"rate-unit", label:"Osnova", placeholder:"Osnova", selected:parsed ? parsed[2] : "", rows:["%","€/enoto","€/uro","drugo"].map(function (unit) { return { id:unit, label:unit }; }), nativeAttrs:'data-atena-unit aria-label="Osnova"' }) + '</div>' + fieldClose(field);
  }
  function durationPairHtml(field, value) {
    var parts = String(value || "").split(";");
    var first = parseNumberUnit((parts[0] || "").replace(/^Odziv:\s*/, ""));
    var second = parseNumberUnit((parts[1] || "").replace(/^Odprava:\s*/, ""));
    function row(label, prefix, parsed) { return '<label><span>' + label + '</span><span class="atena-cas-par__vnos"><input type="number" min="0" data-atena-pair-number="' + prefix + '" value="' + escapeHtml(parsed.number) + '">' + customSelectHtml(field, { key:"pair-" + prefix, label:label + " – enota", placeholder:"Enota", selected:parsed.unit, rows:["ur","dni","tedni"].map(function (unit) { return { id:unit, label:unit }; }), nativeAttrs:'data-atena-pair-unit="' + prefix + '" aria-label="' + label + ' – enota"' }) + '</span></label>'; }
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
  function fieldHtml(field, value, scope) {
    if (scope) field = Object.assign({}, field, { _atenaScope:{ storageKey:String(scope.storageKey || ""), instanceKey:String(scope.instanceKey || ""), interfaceId:String(scope.interfaceId || field.interfaceId || ""), scopeId:String(scope.scopeId || ""), definitionId:String(scope.definitionId || "") } });
    var interaction = field.ui && field.ui.interaction || field.type || "short-text";
    value = value == null ? "" : String(value);
    if (["choice-segments","choice-grid","choice-list","payment-method"].includes(interaction)) return choiceHtml(field, value, interaction);
    if (interaction === "dropdown") return fieldOpen(field, value, 'atena-polje--dropdown') + customSelectHtml(field, { key:"value", label:field.label, selected:value, rows:optionRows(field), nativeAttrs:'data-atena-value aria-label="' + escapeHtml(field.label) + '"' }) + fieldClose(field);
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
  function specialModuleContentHtml(card, state) {
    var context = state || {};
    if (card && card.moduleCode === "C00") {
      return '<div class="ponudba-obrazec__potrditve ponudba-obrazec__polje--polno" aria-label="Povzetek razumevanja">' + [
        ["Vrsta ponudnika", context.profileLabel],
        ["Oblika ponudbe", context.modelLabel],
        ["Vir ponudbe", context.channelLabel]
      ].map(function (row) { return '<div class="ponudba-obrazec__potrditev"><span>' + escapeHtml(row[0]) + '</span><strong>' + escapeHtml(row[1] || "Še ni izbrano") + '</strong></div>'; }).join("") + '</div>';
    }
    return '<div class="ponudba-obrazec__potrditve ponudba-obrazec__polje--polno" aria-label="Končni povzetek"><div class="ponudba-obrazec__potrditev"><span>Potrjeni moduli</span><strong>' + (Number(context.completedCount) || 0) + ' od ' + (Number(context.totalModules) || 27) + '</strong></div><div class="ponudba-obrazec__potrditev"><span>Zbrani odgovori</span><strong>' + (Number(context.answerCount) || 0) + '</strong></div></div>';
  }
  function moduleIconHtml(code) {
    var group = String(code || "").charAt(0);
    if (group === "P") return '<svg viewBox="0 0 24 24"><path d="M20 12 12 20 4 12V4h8l8 8Z"/><path d="M8 8h.01"/></svg>';
    if (["S", "Q"].includes(group)) return '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>';
    if (group === "T") return '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>';
    if (["C", "K"].includes(group)) return '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>';
    if (group === "G") return '<svg viewBox="0 0 24 24"><path d="M12 3 14 5l3-.2.8 2.9L20 10l-2.2 2.3.2 3-3 .7-2 2.2-2-2.2-3-.7.2-3L6 10l2.2-2.3.8-2.9 3 .2 2-2Z"/><path d="m9 10 2 2 4-4"/></svg>';
    if (group === "R") return '<svg viewBox="0 0 24 24"><path d="M10.3 3.8 2.5 17.3A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.7L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>';
    return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>';
  }
  function questionShellHtml(config) {
    var card = config || {};
    var step = Math.max(1, Number(card.step) || 1);
    var total = Math.max(step, Number(card.total) || step);
    var widget = card.questionWidget || {};
    var presentation = widget.presentation || {};
    var templateId = presentation.templateId || widget.templateId || "besedilni-vnos";
    var templateInterfaceId = presentation.interfaceId || widget.interfaceId || ("atena:widget:" + templateId);
    var theme = presentation.theme || "teal";
    var rgb = presentation.rgb || "41,163,162";
    return '<article class="ponudba-obrazec__modul atena-vprasanje-kartica uj-answer-card uj-answer-card--' + escapeHtml(theme) + (widget.mode === "module-widget" ? ' atena-vprasanje-kartica--module-widget' : ' atena-vprasanje-kartica--field-composition') + '" style="--card-rgb:' + escapeHtml(rgb) + ';--obrazec-barva:rgb(' + escapeHtml(rgb) + ');--obrazec-ozadje:rgba(' + escapeHtml(rgb) + ',.08)" data-answer-card data-nazorjeva-question-card data-template-card="' + escapeHtml(templateId) + '" data-atena-module-template-id="' + escapeHtml(templateId) + '" data-atena-module-widget-id="' + escapeHtml(templateInterfaceId) + '"' + (card.interfaceId ? ' data-atena-interface-id="' + escapeHtml(card.interfaceId) + '" data-atena-context-version="' + escapeHtml(card.contextVersion || CONTEXT_VERSION) + '"' : '') + (widget.reasonCode ? ' data-atena-module-reason-code="' + escapeHtml(widget.reasonCode) + '"' : '') + ' aria-label="' + escapeHtml(card.ariaLabel || card.question || card.title) + '"><header class="uj-answer-card__header atena-vprasanje-kartica__glava"><span class="atena-vprasanje-kartica__ikona" aria-hidden="true">' + (card.iconHtml || "") + '</span><span class="atena-vprasanje-kartica__naslov"><small>Dopolnite ' + step + '/' + total + '</small><h2>' + escapeHtml(card.title) + '</h2></span><button type="button" class="atena-vprasanje-kartica__spremeni" data-atena-question-change>Uredi</button>' + (card.showClose ? '<button type="button" class="ponudba-obrazec__zapri atena-vprasanje-kartica__zapri" aria-label="Zapri obrazec ponudbe" data-ponudba-obrazec-zapri>×</button>' : '') + '</header><div class="uj-answer-card__content">' + (card.question ? '<p class="uj-answer-card__question atena-vprasanje-kartica__vprasanje">' + escapeHtml(card.question) + '</p>' : '') + '<div class="uj-answer-card__body ponudba-obrazec__modul-polja">' + (card.contentHtml || "") + '</div></div></article>';
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
  function fieldStorageKey(root) { return root && (root.dataset.atenaStorageKey || root.dataset.atenaFieldId); }
  function setCanonical(root, value) {
    var input = canonical(root);
    if (!input) return;
    var canonicalValue = String(value == null ? "" : value).trim();
    input.value = canonicalValue;
    input.setAttribute("value", canonicalValue);
  }
  function getCanonical(root) {
    var select = root && root.dataset.atenaInteraction === "dropdown" ? root.querySelector("[data-atena-select-source]") : null;
    var input = select || canonical(root);
    var value = input ? String(input.value || "").trim() : "";
    if (!value && root && ["choice-segments","choice-grid","choice-list","payment-method"].includes(root.dataset.atenaInteraction)) {
      var selected = root.querySelector('[data-atena-choice][aria-pressed="true"]');
      if (selected) value = String(selected.dataset.atenaChoice || "").trim();
    }
    return value;
  }
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
    container.querySelectorAll("[data-atena-show-field]").forEach(function (fieldRoot) { var controllers = Array.from(container.querySelectorAll('[data-atena-field-id="' + fieldRoot.dataset.atenaShowField + '"]')); var controller = controllers.find(function (candidate) { return fieldRoot.dataset.atenaInstanceKey ? candidate.dataset.atenaInstanceKey === fieldRoot.dataset.atenaInstanceKey && candidate.dataset.reaktivniScopeId === fieldRoot.dataset.reaktivniScopeId : !candidate.dataset.atenaInstanceKey; }); var current = getCanonical(controller).split("::")[0]; var visible = String(fieldRoot.dataset.atenaShowValues || "").split("|").includes(current); fieldRoot.hidden = !visible; fieldRoot.querySelectorAll("input:not([type=hidden]),select,textarea,button").forEach(function (control) { control.disabled = !visible; }); });
  }
  function clearError(root) { if (!root) return; root.removeAttribute("data-atena-error"); var error = root.querySelector("[data-atena-field-error]"); if (error) error.hidden = true; root.querySelectorAll("[aria-invalid=true]").forEach(function (control) { control.removeAttribute("aria-invalid"); }); }
  function refreshChoice(root, selected) { root.querySelectorAll("[data-atena-choice]").forEach(function (button) { button.setAttribute("aria-pressed", button.dataset.atenaChoice === selected ? "true" : "false"); }); var other = root.querySelector("[data-atena-other-wrap]"); if (other) other.hidden = selected !== "drugo"; }
  function renderListItems(root) { var holder = root.querySelector("[data-atena-list-items]"); if (!holder) return; var items = getCanonical(root).split(/\r?\n/).map(function (item) { return item.trim(); }).filter(Boolean); holder.innerHTML = items.map(function (item, index) { return '<span>' + escapeHtml(item) + '<button type="button" data-atena-list-remove="' + index + '" aria-label="Odstrani ' + escapeHtml(item) + '">×</button></span>'; }).join(""); }
  function refreshModePanels(root) { var wrapper = root.querySelector(".atena-razpolozljivost"); if (!wrapper) return; root.querySelectorAll("[data-atena-mode-panel]").forEach(function (panel) { panel.hidden = panel.dataset.atenaModePanel !== wrapper.dataset.atenaMode; }); }
  function refreshCustomSelect(wrapper) {
    if (!wrapper) return;
    var source = wrapper.querySelector("[data-atena-select-source]");
    var toggle = wrapper.querySelector("[data-atena-select-toggle]");
    var label = wrapper.querySelector("[data-atena-select-label]");
    if (!source || !toggle) return;
    var selectedOption = source.options[source.selectedIndex] || source.options[0];
    var selectedValue = selectedOption ? String(selectedOption.value) : "";
    var selectedLabel = selectedOption ? selectedOption.textContent : "Izberite možnost";
    if (label) label.textContent = selectedLabel;
    toggle.setAttribute("aria-label", (source.getAttribute("aria-label") || "Izbira") + ": " + selectedLabel);
    toggle.classList.toggle("has-value", Boolean(selectedValue));
    wrapper.querySelectorAll("[data-atena-select-option]").forEach(function (option) {
      var active = option.dataset.atenaSelectOption === selectedValue;
      option.classList.toggle("is-selected", active);
      option.setAttribute("aria-selected", String(active));
    });
  }
  function closeCustomSelect(wrapper, returnFocus) {
    if (!wrapper) return;
    var toggle = wrapper.querySelector("[data-atena-select-toggle]");
    var menu = wrapper.querySelector("[data-atena-select-menu]");
    wrapper.classList.remove("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (menu) { menu.hidden = true; menu.removeAttribute("style"); }
    if (returnFocus && toggle) toggle.focus({ preventScroll:true });
  }
  function closeCustomSelects(container, except) {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll("[data-atena-select].is-open").forEach(function (wrapper) { if (wrapper !== except) closeCustomSelect(wrapper, false); });
  }
  function openCustomSelect(wrapper, focusDirection) {
    if (!wrapper || typeof window === "undefined") return;
    var toggle = wrapper.querySelector("[data-atena-select-toggle]");
    var menu = wrapper.querySelector("[data-atena-select-menu]");
    if (!toggle || !menu) return;
    closeCustomSelects(document, wrapper);
    menu.hidden = false;
    wrapper.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    var rect = toggle.getBoundingClientRect();
    var margin = 8;
    var below = Math.max(0, window.innerHeight - rect.bottom - margin);
    var above = Math.max(0, rect.top - margin);
    var useAbove = below < Math.min(220, menu.scrollHeight || 220) && above > below;
    var available = Math.max(96, (useAbove ? above : below) - 5);
    var width = Math.max(0, Math.min(rect.width, window.innerWidth - margin * 2));
    var left = Math.min(Math.max(margin, rect.left), window.innerWidth - margin - width);
    var naturalHeight = Math.min(220, menu.scrollHeight || 220, available);
    var top = useAbove ? Math.max(margin, rect.top - 5 - naturalHeight) : Math.min(window.innerHeight - margin - naturalHeight, rect.bottom + 5);
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    menu.style.width = width + "px";
    menu.style.maxHeight = naturalHeight + "px";
    var options = Array.from(menu.querySelectorAll("[data-atena-select-option]"));
    var selected = menu.querySelector('[aria-selected="true"]');
    var focusTarget = focusDirection === "last" ? options[options.length - 1] : (selected || options[0]);
    if (focusTarget) focusTarget.focus({ preventScroll:true });
  }
  function chooseCustomSelect(option, container) {
    var wrapper = option && option.closest("[data-atena-select]");
    var root = rootFor(option);
    var source = wrapper && wrapper.querySelector("[data-atena-select-source]");
    if (!wrapper || !root || !source) return false;
    source.value = option.dataset.atenaSelectOption;
    refreshCustomSelect(wrapper);
    syncComposite(root);
    source.dispatchEvent(new Event("input", { bubbles:true }));
    source.dispatchEvent(new Event("change", { bubbles:true }));
    setCanonical(root, source.value);
    closeCustomSelect(wrapper, true);
    clearError(root);
    refreshConditional(container || root.closest("form") || document);
    return true;
  }
  function handleKeydown(event, container) {
    var toggle = event.target.closest && event.target.closest("[data-atena-select-toggle]");
    var option = event.target.closest && event.target.closest("[data-atena-select-option]");
    if (toggle) {
      var wrapper = toggle.closest("[data-atena-select]");
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (toggle.getAttribute("aria-expanded") === "true") closeCustomSelect(wrapper, true);
        else openCustomSelect(wrapper, event.key === "ArrowUp" ? "last" : "selected");
        return true;
      }
      if (event.key === "Escape") { event.preventDefault(); closeCustomSelect(wrapper, true); return true; }
      return false;
    }
    if (!option) return false;
    var menu = option.closest("[data-atena-select-menu]");
    var options = Array.from(menu.querySelectorAll("[data-atena-select-option]"));
    var index = options.indexOf(option);
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      var next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[next].focus({ preventScroll:true });
      return true;
    }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); return chooseCustomSelect(option, container); }
    if (event.key === "Escape") { event.preventDefault(); closeCustomSelect(option.closest("[data-atena-select]"), true); return true; }
    if (event.key === "Tab") closeCustomSelect(option.closest("[data-atena-select]"), false);
    return false;
  }
  function handleClick(event, container) {
    var target = event.target.closest("button"); if (!target) return false; var root = rootFor(target); if (!root) return false;
    if (target.hasAttribute("data-atena-select-toggle")) { var selectWrapper = target.closest("[data-atena-select]"); if (target.getAttribute("aria-expanded") === "true") closeCustomSelect(selectWrapper, true); else openCustomSelect(selectWrapper, "selected"); }
    else if (target.hasAttribute("data-atena-select-option")) return chooseCustomSelect(target, container);
    else if (target.hasAttribute("data-atena-choice")) { var selected = target.dataset.atenaChoice; setCanonical(root, selected); refreshChoice(root, selected); var other = root.querySelector("[data-atena-other-value]"); if (selected === "drugo" && other) other.focus(); }
    else if (target.hasAttribute("data-atena-step")) { var number = root.querySelector("[data-atena-number]"); if (number) number.value = String(Math.max(0, (Number(number.value) || 0) + Number(target.dataset.atenaStep))); syncComposite(root); }
    else if (target.hasAttribute("data-atena-unit-button")) { root.querySelectorAll("[data-atena-unit-button]").forEach(function (button) { button.setAttribute("aria-pressed", button === target ? "true" : "false"); }); syncComposite(root); }
    else if (target.hasAttribute("data-atena-quick-value")) { var quick = target.dataset.atenaQuickValue; setCanonical(root, quick); var free = root.querySelector("[data-atena-free-value]"); if (free) free.value = quick; root.querySelectorAll("[data-atena-quick-value]").forEach(function (button) { button.setAttribute("aria-pressed", button === target ? "true" : "false"); }); var numberInput = root.querySelector("[data-atena-number]"); if (numberInput) numberInput.value = ""; }
    else if (target.hasAttribute("data-atena-date-mode")) { var mode = target.dataset.atenaDateMode; root.querySelectorAll("[data-atena-date-mode]").forEach(function (button) { button.setAttribute("aria-pressed", button === target ? "true" : "false"); }); if (mode === "unknown") setCanonical(root, "Ne vem"); else syncComposite(root); }
    else if (target.hasAttribute("data-atena-deadline-mode")) { var dm = target.dataset.atenaDeadlineMode; root.querySelectorAll("[data-atena-deadline-mode]").forEach(function (button) { button.setAttribute("aria-pressed", button === target ? "true" : "false"); }); if (dm === "unknown") setCanonical(root, "Ne vem"); else syncComposite(root); }
    else if (target.hasAttribute("data-atena-mode-button")) { var wrapper = root.querySelector(".atena-razpolozljivost"); if (wrapper) wrapper.dataset.atenaMode = target.dataset.atenaModeButton; root.querySelectorAll("[data-atena-mode-button]").forEach(function (button) { button.setAttribute("aria-pressed", button === target ? "true" : "false"); }); refreshModePanels(root); syncComposite(root); }
    else if (target.hasAttribute("data-atena-file-remove")) { setCanonical(root, ""); documentFiles.delete(fieldStorageKey(root)); var fileInput = root.querySelector("[data-atena-file-input]"); if (fileInput) fileInput.value = ""; var fileList = root.querySelector("[data-atena-file-list]"); if (fileList) fileList.hidden = true; var note = root.querySelector("[data-atena-file-note]"); if (note) note.value = ""; }
    else if (target.hasAttribute("data-atena-list-add")) { var listInput = root.querySelector("[data-atena-list-input]"); var item = listInput && listInput.value.trim(); if (item) { var items = getCanonical(root).split(/\r?\n/).filter(Boolean); var duplicate = items.some(function (existing) { return existing.localeCompare(item, "sl-SI", { sensitivity:"accent" }) === 0; }); if (!duplicate) items.push(item); setCanonical(root, items.join("\n")); listInput.value = ""; renderListItems(root); } }
    else if (target.hasAttribute("data-atena-list-remove")) { var rows = getCanonical(root).split(/\r?\n/).filter(Boolean); rows.splice(Number(target.dataset.atenaListRemove), 1); setCanonical(root, rows.join("\n")); renderListItems(root); }
    else return false;
    fitTextControls(root); clearError(root); refreshConditional(container || root.closest("form") || document); return true;
  }
  function handleInput(event, container) { var root = rootFor(event.target); if (!root) return false; if (event.target.hasAttribute("data-atena-other-value")) setCanonical(root, event.target.value ? "drugo::" + event.target.value : "drugo"); else if (event.target.hasAttribute("data-atena-file-note")) { var saved = parseDocumentValue(getCanonical(root)); setCanonical(root, serializeDocumentValue(saved.files, event.target.value)); } else syncComposite(root); fitTextControl(event.target); clearError(root); refreshConditional(container || root.closest("form") || document); return true; }
  function handleChange(event, container) { var root = rootFor(event.target); if (!root) return false; if (event.target.hasAttribute("data-atena-file-input")) { var files = Array.from(event.target.files || []); var names = files.map(function (file) { return file.name; }); var note = root.querySelector("[data-atena-file-note]"); documentFiles.set(fieldStorageKey(root), files); setCanonical(root, serializeDocumentValue(names, note && note.value)); var summary = names.join(", "); var list = root.querySelector("[data-atena-file-list]"); var label = root.querySelector("[data-atena-file-summary]"); if (list) list.hidden = !summary; if (label) label.textContent = summary; } else syncComposite(root); fitTextControl(event.target); clearError(root); refreshConditional(container || root.closest("form") || document); return true; }
  function idSlug(value) { return String(value == null ? "" : value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "control"; }
  function controlRole(control) {
    var attributes = Array.from(control.attributes || []).filter(function (attribute) {
      return attribute.name.indexOf("data-") === 0 && !/^data-atena-(control|option|interface|context|card|field|template|relation)-/.test(attribute.name) && attribute.name !== "data-ponudba-field";
    }).sort(function (a,b) { return a.name.localeCompare(b.name); });
    if (attributes.length) return idSlug(attributes[0].name.slice(5) + (attributes[0].value ? "-" + attributes[0].value : ""));
    return idSlug(control.tagName.toLowerCase() + "-" + (control.type || control.getAttribute("role") || "primary"));
  }
  function stampControls(scope, prefix) {
    var counts = new Map();
    Array.from(scope.querySelectorAll("button,input:not([type=hidden]),select,textarea")).filter(function (control) { return control.closest("[data-atena-field-root]") === scope || (!scope.hasAttribute("data-atena-field-root") && !control.closest("[data-atena-field-root]")); }).forEach(function (control) {
      var role = controlRole(control);
      var count = (counts.get(role) || 0) + 1;
      counts.set(role, count);
      control.dataset.atenaControlId = prefix + ":" + role + (count > 1 ? "-" + count : "");
      control.dataset.atenaContextVersion = CONTEXT_VERSION;
    });
  }
  function stampInterfaceIds(container) {
    if (!container || !container.querySelectorAll) return Object.freeze({ ok:true, total:0, duplicates:Object.freeze([]) });
    container.querySelectorAll("[data-atena-field-root][data-atena-interface-id]").forEach(function (fieldRoot) {
      stampControls(fieldRoot, fieldRoot.dataset.atenaInterfaceId.replace(/^atena:field:/, "atena:control:"));
    });
    container.querySelectorAll(".atena-vprasanje-kartica[data-atena-interface-id]").forEach(function (cardRoot) {
      stampControls(cardRoot, cardRoot.dataset.atenaInterfaceId.replace(/^atena:card:/, "atena:control:") + ":card");
    });
    var ids = Array.from(container.querySelectorAll("[data-atena-control-id]")).map(function (control) { return control.dataset.atenaControlId; });
    var duplicates = ids.filter(function (id, index) { return ids.indexOf(id) !== index; });
    return Object.freeze({ ok:!duplicates.length, total:ids.length, duplicates:Object.freeze(Array.from(new Set(duplicates))) });
  }
  function hydrate(container) { if (!container) return; stampInterfaceIds(container); container.querySelectorAll("[data-atena-field-root]").forEach(refreshModePanels); container.querySelectorAll("[data-atena-select]").forEach(refreshCustomSelect); refreshConditional(container); fitTextControls(container); if (typeof document !== "undefined" && document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitTextControls(container); }); if (customSelectContainers && !customSelectContainers.has(container)) { customSelectContainers.add(container); container.addEventListener("keydown", function (event) { handleKeydown(event, container); }); container.addEventListener("scroll", function () { closeCustomSelects(container); }, true); } if (!customSelectDocumentBound && typeof document !== "undefined") { customSelectDocumentBound = true; document.addEventListener("pointerdown", function (event) { if (!event.target.closest("[data-atena-select]")) closeCustomSelects(document); }); } if (!autoFitBound && typeof window !== "undefined") { autoFitBound = true; window.addEventListener("resize", function () { fitTextControls(document); closeCustomSelects(document); }, { passive:true }); } }
  function validate(container) {
    if (!container) return true; var first = null;
    container.querySelectorAll('[data-atena-field-root][data-atena-required="true"]').forEach(function (root) { if (root.hidden || root.closest("details:not([open])")) return; var value = getCanonical(root); var invalid = !value || (root.dataset.atenaInteraction === "document-upload" && !parseDocumentValue(value).files.length); root.toggleAttribute("data-atena-error", invalid); var error = root.querySelector("[data-atena-field-error]"); if (error) error.hidden = !invalid; var focus = root.querySelector("[data-atena-select-toggle],input:not([type=hidden]),textarea,select:not([data-atena-select-source]),button"); if (focus) { if (invalid) focus.setAttribute("aria-invalid", "true"); else focus.removeAttribute("aria-invalid"); } if (invalid && !first) first = focus; });
    if (first) { first.focus({ preventScroll:true }); if (first.scrollIntoView) first.scrollIntoView({ block:"center", behavior:"smooth" }); return false; } return true;
  }
  function collectValues(container) { var values = {}; if (!container) return values; container.querySelectorAll("[data-atena-field-root]").forEach(function (root) { if (!root.hidden) values[fieldStorageKey(root)] = getCanonical(root); }); return values; }
  function displayValue(field, value) { var raw = String(value || ""); if (field && field.ui && field.ui.interaction === "document-upload") { var documentValue = parseDocumentValue(raw); return documentValue.files.join(", ") + (documentValue.note ? " — " + documentValue.note : ""); } var base = raw.split("::")[0]; var option = optionRows(field).find(function (row) { return String(row.id) === base; }); return option ? option.label + (raw.indexOf("::") > -1 ? ": " + raw.split("::").slice(1).join("::") : "") : raw; }
  function getFiles(storageKey) { return asArray(documentFiles.get(String(storageKey))); }
  return Object.freeze({ version:"atena-card-renderer-v10", contextVersion:CONTEXT_VERSION, renderAreas:renderAreas, questionShellHtml:questionShellHtml, moduleIconHtml:moduleIconHtml, specialModuleContentHtml:specialModuleContentHtml, fieldHtml:fieldHtml, moduleContentHtml:moduleContentHtml, stampInterfaceIds:stampInterfaceIds, handleClick:handleClick, handleInput:handleInput, handleChange:handleChange, handleKeydown:handleKeydown, hydrate:hydrate, validate:validate, collectValues:collectValues, displayValue:displayValue, getFiles:getFiles });
});
