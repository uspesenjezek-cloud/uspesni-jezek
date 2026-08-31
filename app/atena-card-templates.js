(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJAtenaCardTemplates = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char];
    });
  }

  var ICONS = Object.freeze({
    chevron:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    pencil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>',
    document:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></svg>',
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/></svg>'
  });

  function button(label, value, selected, extra) {
    return '<button type="button" data-card-choice="' + esc(value) + '" aria-pressed="' + String(Boolean(selected)) + '" class="' + (selected ? 'is-selected' : '') + '"' + (extra || '') + '><span>' + esc(label) + '</span></button>';
  }

  function field(label, content, className) {
    return '<div class="uj-card-field' + (className ? ' ' + className : '') + '"><span class="uj-card-label">' + esc(label) + '</span>' + content + '</div>';
  }

  function quickChoices(options, selected, className, extra) {
    return '<div class="uj-card-choices' + (className ? ' ' + className : '') + '" data-card-choice-group' + (extra || '') + '>' + options.map(function (option) {
      var row = Array.isArray(option) ? option : [option, option];
      return button(row[0], row[1], row[1] === selected);
    }).join("") + '</div>';
  }

  function numberChoices(options, selected, inputLabel, extra) {
    return '<div class="uj-card-choices uj-card-number-choices" data-card-choice-group data-number-choices data-number-option-count="' + options.length + '"' + (extra || '') + '>' + options.map(function (option) {
      var row = Array.isArray(option) ? option : [option, option];
      return button(row[0], row[1], row[1] === selected);
    }).join("") + '<label class="uj-card-number-custom"><input type="text" inputmode="decimal" maxlength="4" placeholder="Vnesi" aria-label="' + esc(inputLabel) + '" data-number-custom></label></div>';
  }

  function updateNumberChoiceConfirmation(group, value) {
    var output = group && group.closest("[data-answer-card]") && group.closest("[data-answer-card]").querySelector("[data-number-confirmation]");
    if (!output) return;
    var normalized = String(value == null ? "" : value).trim();
    output.textContent = normalized === "unknown" ? "Ne vem" : normalized === "none" ? "Brez vezave" : normalized ? normalized + " mesecev" : "Ni izbrano";
  }

  function dateControl() {
    return '<div class="uj-card-date" data-card-date><input type="date" aria-label="Datum"><button type="button" data-date-mode="unknown" aria-pressed="false">Ne vem</button><button type="button" data-date-mode="approximate" aria-pressed="false">Približno</button></div><input class="uj-card-date-approx" type="text" placeholder="Npr. začetek oktobra 2026" hidden>';
  }

  function resetControl() {
    return '<button type="button" class="uj-card-reset" data-card-reset><span aria-hidden="true">↺</span> Ponastavi</button>';
  }

  function saveControl() {
    return '<button type="button" class="uj-answer-card__save" data-card-save>Shrani podatke</button>';
  }

  function conditionSelect(kind, label, selectedValue, options) {
    var selected = options.find(function (option) { return option[0] === selectedValue; }) || options[0];
    return '<div class="uj-card-condition__select" data-condition-select><button type="button" data-condition-toggle data-condition-label="'+esc(label)+'" aria-haspopup="listbox" aria-expanded="false" aria-label="'+esc(label)+': '+esc(selected[1])+'"><span data-condition-select-value>'+esc(selected[1])+'</span><i aria-hidden="true"></i></button><div data-condition-menu role="listbox" aria-label="'+esc(label)+'" hidden>'+options.map(function(option){return '<button type="button" role="option" data-condition-choice="'+esc(option[0])+'" aria-selected="'+String(option[0]===selectedValue)+'" class="'+(option[0]===selectedValue?'is-selected':'')+'">'+esc(option[1])+'</button>';}).join("")+'</div><input type="hidden" data-condition-'+esc(kind)+' value="'+esc(selectedValue)+'"></div>';
  }

  function cardSelect(label, selectedValue, options, controlAttributes, className) {
    var selected = options.find(function (option) { return option[0] === selectedValue; }) || options[0];
    return '<div class="uj-card-condition__select uj-card-condition__select--simple'+(className?' '+esc(className):'')+'" data-condition-select><button type="button" data-condition-toggle data-condition-label="'+esc(label)+'" aria-haspopup="listbox" aria-expanded="false" aria-label="'+esc(label)+': '+esc(selected[1])+'"><span data-condition-select-value>'+esc(selected[1])+'</span><i aria-hidden="true"></i></button><div data-condition-menu role="listbox" aria-label="'+esc(label)+'" hidden>'+options.map(function(option){return '<button type="button" role="option" data-condition-choice="'+esc(option[0])+'" aria-selected="'+String(option[0]===selectedValue)+'" class="'+(option[0]===selectedValue?'is-selected':'')+'"'+(option[2]||'')+'>'+esc(option[1])+'</button>';}).join("")+'</div><input type="hidden" data-condition-field '+(controlAttributes||'')+' value="'+esc(selectedValue)+'"></div>';
  }

  var RANGE_MODES = Object.freeze({
    availability:{ label:"Dogovorjena razpoložljivost", unit:"%", min:90, max:100, step:0.1, value:99.5, ticks:[90,95,100], presets:[95,99,99.5,99.9] },
    prepayment:{ label:"Višina predplačila", unit:"%", min:0, max:100, step:5, value:30, ticks:[0,50,100], presets:[10,20,30,50] },
    deadline:{ label:"Rok plačila", unit:"dni", min:0, max:90, step:1, value:30, ticks:[0,45,90], presets:[7,14,30,60] }
  });

  function formatRangeValue(value, unit) {
    var number = Number(value);
    var text = Number.isFinite(number) ? number.toLocaleString("sl-SI", { maximumFractionDigits:1 }) : String(value).replace(".", ",");
    return text + (unit === "%" ? " %" : " " + unit);
  }

  function updateRangeVisual(card, range) {
    if (!card || !range) return;
    var unit = card.dataset.rangeUnit || "%";
    var output = card.querySelector("[data-range-output]");
    if (output) output.textContent = formatRangeValue(range.value, unit);
    var span = Number(range.max) - Number(range.min);
    var ratio = span > 0 ? (Number(range.value) - Number(range.min)) / span : 0;
    var bars = Array.from(card.querySelectorAll("[data-range-bars] span"));
    var activeBars = Math.round(Math.max(0, Math.min(1, ratio)) * bars.length);
    bars.forEach(function (bar, index) { bar.classList.toggle("is-active", index < activeBars); });
  }

  function applyRangeMode(card, modeKey) {
    var mode = RANGE_MODES[modeKey];
    if (!card || !mode) return;
    card.dataset.rangeUnit = mode.unit;
    var label = card.querySelector("[data-range-label]");
    var range = card.querySelector('input[type="range"]');
    if (label) label.textContent = mode.label;
    range.min = String(mode.min); range.max = String(mode.max); range.step = String(mode.step); range.value = String(mode.value);
    card.querySelectorAll("[data-range-tick]").forEach(function (tick, index) { tick.textContent = formatRangeValue(mode.ticks[index], mode.unit); });
    card.querySelectorAll("[data-range-presets] [data-card-choice]").forEach(function (button, index) {
      var value = mode.presets[index];
      button.dataset.cardChoice = String(value);
      button.querySelector("span").textContent = String(value).replace(".", ",");
      var selected = Number(value) === Number(mode.value);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    var custom = card.querySelector("[data-range-presets] [data-number-custom]");
    if (custom) { custom.value = ""; custom.setAttribute("aria-label", "Vnesite vrednost: " + mode.label.toLocaleLowerCase("sl-SI")); }
    updateRangeVisual(card, range);
  }

  function rangeBars() {
    return '<div class="uj-card-range__bars" data-range-bars aria-hidden="true">' + Array.from({ length:12 }, function (_, index) { return '<span class="' + (index < 11 ? 'is-active' : '') + '"></span>'; }).join("") + '</div>';
  }

  var APPROVED_TEMPLATE_IDS = Object.freeze([
    "da-ne-ne-vem", "stevilcna-lestvica", "dvojni-segment", "mreza-izbir", "navpicni-izbor",
    "spustni-seznam", "besedilni-vnos", "natancen-znesek", "znesek-ali-odstotek", "kolicina-in-enota",
    "drsnik-razpona", "datum-z-gotovostjo", "termin-in-pogostost", "seznam-postavk", "dokazilo",
    "razdelitev-proracuna", "primerjava-moznosti", "casovnica-mejnikov", "razvrscanje-prioritet", "tedenski-termini",
    "ocenjevalna-matrika", "dvojni-razpon", "pogojna-garancija", "mini-koledar", "kontrolni-seznam-dokazil",
    "matrika-tveganja", "izbirnik-oznak", "placilni-razrez", "trenutno-proti-cilju", "odlocitvena-pot"
  ]);

  var TEMPLATES = [
    {
      id:"da-ne-ne-vem", number:1, theme:"teal", rgb:"41,163,162", title:"Posrednik ali izvajalec",
      question:"Ali je ponudnik posrednik?", coverage:"Da / ne / ne vem · kratka enojna izbira",
      body:function () { return field("Izberite odgovor", quickChoices([["Da","yes"],["Ne","no"],["Ne vem","unknown"]], "no", "uj-card-choices--three")); }
    },
    {
      id:"stevilcna-lestvica", number:2, theme:"blue", rgb:"51,137,229", title:"Trajanje vezave",
      question:"Koliko mesecev traja vezava?", coverage:"Vodoravna lestvica · 5–10 kratkih možnosti",
      body:function () { return '<div class="uj-card-field"><div class="uj-card-field__heading"><span class="uj-card-label">Izberite ali vnesite trajanje</span><span class="uj-card-selection-note">Izbrano: <b data-number-confirmation>12 mesecev</b></span></div>' + numberChoices([["Ne vem","unknown"],["Brez","none"],["12","12"],["24","24"],["36","36"]], "12", "Vnesite število mesecev") + '</div>'; }
    },
    {
      id:"dvojni-segment", number:3, theme:"olive", rgb:"166,145,20", title:"Način obračuna",
      question:"Ali je cena enkratna ali se ponavlja?", coverage:"Dva velika segmenta · medsebojno izključujoča",
      body:function () { return quickChoices([["Enkratno","single"],["Redno","recurring"]], "single", "uj-card-segment"); }
    },
    {
      id:"mreza-izbir", number:4, theme:"purple", rgb:"126,88,210", title:"Vloga ponudnika",
      question:"Kdo storitev dejansko izvede ali dobavi?", coverage:"Tap-mreža 2 × 2 · daljše, razločljive možnosti",
      body:function () { return '<div class="uj-card-choice-grid" data-card-choice-group>' + [["Ponudnik sam","provider"],["Podizvajalec","subcontractor"],["Posrednik","broker"],["Ne vem","unknown"]].map(function (row, index) { return '<button type="button" data-card-choice="' + row[1] + '" aria-pressed="' + String(index === 0) + '" class="' + (index === 0 ? 'is-selected' : '') + '"><span class="uj-card-choice-grid__mark">' + ICONS.check + '</span><span>' + row[0] + '</span></button>'; }).join("") + '</div>'; }
    },
    {
      id:"navpicni-izbor", number:5, theme:"orange", rgb:"231,133,20", title:"Vir ponudbe",
      question:"Kako je ponudba prišla do vas?", coverage:"Navpični izbor · možnost »Drugo« z dopolnitvijo",
      body:function () { return '<div class="uj-card-choice-list" data-card-choice-group>' + [["Naše povpraševanje","inquiry"],["Priporočilo","referral"],["Hladni klic ali e-pošta","cold"],["Drugo","other"]].map(function (row) { return '<button type="button" data-card-choice="' + row[1] + '" aria-pressed="false"><span class="uj-card-radio" aria-hidden="true"></span><span>' + row[0] + '</span></button>'; }).join("") + '</div><label class="uj-card-other" hidden>Opišite drugo možnost<input type="text" placeholder="Vpišite način prvega stika"></label>'; }
    },
    {
      id:"spustni-seznam", number:6, theme:"green", rgb:"41,155,99", title:"Način plačila",
      question:"Kako bo račun poravnan?", coverage:"Spustni seznam · daljši ali stabilen nabor možnosti",
      body:function () { return field("Način plačila", cardSelect("Način plačila", "", [["","Izberite način plačila"],["transfer","Bančno nakazilo"],["card","Kartica"],["cash","Gotovina"],["debit","Direktna obremenitev"],["other","Drugo"]])); }
    },
    {
      id:"besedilni-vnos", number:7, theme:"orange", rgb:"230,126,34", title:"Predmet ponudbe",
      question:"Kaj točno kupujete in kateri rezultat pričakujete?", coverage:"Besedilo · kratka ali večvrstična različica istega vzorca",
      body:function () { return field("Opišite s svojimi besedami", '<textarea rows="4" placeholder="Npr. izdelava spletne strani z vsemi dogovorjenimi funkcijami"></textarea>'); }
    },
    {
      id:"natancen-znesek", number:8, theme:"gold", rgb:"199,157,0", title:"Osnovna cena",
      question:"Kakšna je enkratna cena in ali vključuje DDV?", coverage:"Natančen znesek · valuta in kratka dodatna izbira",
      body:function () { return field("Znesek", '<label class="uj-card-money"><span aria-hidden="true">' + ICONS.pencil + '</span><input type="text" inputmode="decimal" value="1.250,00" aria-label="Znesek"><b>€</b></label>') + field("DDV", quickChoices([["Vključen","included"],["Ni vključen","excluded"],["Ne vem","unknown"]], "included", "uj-card-choices--three")); }
    },
    {
      id:"znesek-ali-odstotek", number:9, theme:"teal", rgb:"41,163,162", title:"Predplačilo",
      question:"Kolikšno predplačilo zahteva ponudnik?", coverage:"Znesek ali odstotek · preklop enote brez ugibanja",
      body:function () { return field("Vrednost predplačila", '<div class="uj-card-value-switch"><label class="uj-card-money"><span aria-hidden="true">' + ICONS.pencil + '</span><input type="text" inputmode="decimal" value="30" aria-label="Vrednost predplačila"><b data-money-unit>%</b></label>' + quickChoices([["Znesek","eur"],["Odstotek","percent"]], "percent", "uj-card-segment uj-card-segment--unit") + '</div>'); }
    },
    {
      id:"kolicina-in-enota", number:10, theme:"blue", rgb:"51,137,229", title:"Količina in enota",
      question:"Kakšna sta količina in obračunska enota?", coverage:"Stepper + enota · količina, trajanje ali število",
      body:function () { return '<div class="uj-card-stepper" data-card-stepper><button type="button" data-step="-1" aria-label="Zmanjšaj">' + ICONS.minus + '</button><input type="number" min="0" value="12" aria-label="Količina">'+cardSelect("Enota", "ur", [["ur","ur"],["dni","dni"],["kosov","kosov"],["mesecev","mesecev"]], "", "uj-card-select--stepper")+'<button type="button" data-step="1" aria-label="Povečaj">' + ICONS.plus + '</button></div>'; }
    },
    {
      id:"drsnik-razpona", number:11, theme:"purple", rgb:"126,88,210", title:"Merilo dogovora",
      question:"Kaj želite določiti in kakšna vrednost velja?", coverage:"Izbira merila → grafični drsnik z neposrednim prikazom vrednosti",
      body:function () { return field("Najprej izberite merilo", quickChoices([["Razpoložljivost","availability"],["Predplačilo","prepayment"],["Rok plačila","deadline"]], "availability", "uj-card-range-modes", " data-range-mode-group")) + '<div class="uj-card-range" data-range-panel><div class="uj-card-range__readout"><span data-range-label>Dogovorjena razpoložljivost</span><output data-range-output>99,5 %</output></div>' + rangeBars() + '<input type="range" min="90" max="100" step="0.1" value="99.5" aria-label="Nastavite vrednost"><div class="uj-card-range__ticks"><span data-range-tick>90 %</span><span data-range-tick>95 %</span><span data-range-tick>100 %</span></div></div>'; }
    },
    {
      id:"datum-z-gotovostjo", number:12, theme:"coral", rgb:"238,91,88", title:"Predviden začetek",
      question:"Kdaj se izvedba začne?", coverage:"Datum · natančen, neznan ali približen",
      body:function () { return field("Predviden začetek", dateControl()); }
    },
    {
      id:"termin-in-pogostost", number:13, theme:"green", rgb:"41,155,99", title:"Termin izvedbe",
      question:"Kateri termin, časovno okno ali pogostost velja?", coverage:"Prosti termin + hitre bližnjice",
      body:function () { return field("Termin ali časovno okno", '<label class="uj-card-icon-input"><span aria-hidden="true">' + ICONS.calendar + '</span><input type="text" value="pon.–pet. med 8.00 in 16.00"></label>') + quickChoices([["Enkratno","once"],["Po dogovoru","agreement"],["Redno","regular"]], "regular", "uj-card-choices--three"); }
    },
    {
      id:"seznam-postavk", number:14, theme:"purple", rgb:"126,88,210", title:"Najpomembnejši pogoji",
      question:"Kateri pogoji so za vas najpomembnejši?", coverage:"Ponovljiv seznam · dodajanje in odstranjevanje postavk",
      body:function () { return '<div class="uj-card-list" data-card-list><div class="uj-card-list__items"><span>Jasen rok izvedbe<button type="button" data-list-remove aria-label="Odstrani">×</button></span></div><div class="uj-card-list__add"><input type="text" placeholder="Dodajte postavko"><button type="button" data-list-add>Dodaj</button></div></div>'; }
    },
    {
      id:"dokazilo", number:15, theme:"gold", rgb:"199,157,0", title:"Dokazilo",
      question:"Katero dokazilo potrjuje navedene cene, pogoje in obljube?", coverage:"Dokument · izbor, stanje datoteke, odstranitev in opomba",
      body:function () { return '<div class="uj-card-upload" data-card-upload><label><input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"><span aria-hidden="true">' + ICONS.document + '</span><b>+ Dodajte dokument</b><small>PDF, fotografija ali datoteka</small></label><div class="uj-card-upload__file" hidden><span data-file-name></span><button type="button" data-file-remove>Odstrani</button></div><label class="uj-card-upload__note">Kaj dokazilo potrjuje?<textarea rows="2" placeholder="Dodajte kratko povezavo z dejstvom"></textarea></label></div>'; }
    },
    {
      id:"razdelitev-proracuna", number:16, theme:"gold", rgb:"199,157,0", title:"Razdelitev proračuna",
      question:"Kolikšen delež proračuna je namenjen izvedbi in materialu?", coverage:"Krožni prikaz + drsnik · dve vrednosti s skupno vsoto 100 %",
      body:function () { return '<div class="uj-card-allocation" data-card-allocation><div class="uj-card-allocation__top"><div class="uj-card-allocation__donut" style="--allocation:60" aria-hidden="true"><span><b data-allocation-primary>60 %</b><small>izvedba</small></span></div><div class="uj-card-allocation__legend"><span><i></i>Izvedba <b data-allocation-primary>60 %</b></span><span><i></i>Material <b data-allocation-secondary>40 %</b></span></div></div><label><span class="uj-card-label">Premaknite razmerje</span><input type="range" min="0" max="100" step="5" value="60" data-allocation-range aria-label="Delež izvedbe"></label></div>'; }
    },
    {
      id:"primerjava-moznosti", number:17, theme:"teal", rgb:"41,163,162", title:"Primerjava možnosti",
      question:"Katera ponudba je za vas ugodnejša?", coverage:"Vzporedna primerjava · cena, rok in poudarjene razlike",
      body:function () { return '<div class="uj-card-comparison" data-card-choice-group><button type="button" data-card-choice="offer-a" aria-pressed="true" class="is-selected"><span class="uj-card-comparison__name">Ponudba A</span><strong>1.240 €</strong><small><b>14 dni</b><em>2 leti garancije</em></small></button><button type="button" data-card-choice="offer-b" aria-pressed="false"><span class="uj-card-comparison__name">Ponudba B</span><strong>1.090 €</strong><small><b>21 dni</b><em>1 leto garancije</em></small></button></div>'; }
    },
    {
      id:"casovnica-mejnikov", number:18, theme:"green", rgb:"41,155,99", title:"Časovnica mejnikov",
      question:"Kateri koraki so že dogovorjeni ali zaključeni?", coverage:"Vodoravna časovnica · klik za spremembo stanja posameznega koraka",
      body:function () { return '<div class="uj-card-timeline" data-card-timeline><button type="button" data-timeline-step class="is-done" aria-pressed="true"><i>' + ICONS.check + '</i><span>Ponudba<small>prejeta</small></span></button><button type="button" data-timeline-step class="is-current" aria-pressed="true"><i>2</i><span>Potrditev<small>v teku</small></span></button><button type="button" data-timeline-step aria-pressed="false"><i>3</i><span>Izvedba<small>čaka</small></span></button><button type="button" data-timeline-step aria-pressed="false"><i>4</i><span>Prevzem<small>čaka</small></span></button></div>'; }
    },
    {
      id:"razvrscanje-prioritet", number:19, theme:"purple", rgb:"126,88,210", title:"Razvrstitev prioritet",
      question:"Kaj je najpomembnejše pri končni izbiri?", coverage:"Razvrščanje · premikanje postavk gor in dol brez vlečenja",
      body:function () { return '<ol class="uj-card-priority" data-priority-list><li><b>1</b><span>Kakovost izvedbe</span><span><button type="button" data-priority-move="-1" aria-label="Premakni navzgor">↑</button><button type="button" data-priority-move="1" aria-label="Premakni navzdol">↓</button></span></li><li><b>2</b><span>Končna cena</span><span><button type="button" data-priority-move="-1" aria-label="Premakni navzgor">↑</button><button type="button" data-priority-move="1" aria-label="Premakni navzdol">↓</button></span></li><li><b>3</b><span>Rok izvedbe</span><span><button type="button" data-priority-move="-1" aria-label="Premakni navzgor">↑</button><button type="button" data-priority-move="1" aria-label="Premakni navzdol">↓</button></span></li></ol>'; }
    },
    {
      id:"tedenski-termini", number:20, theme:"blue", rgb:"51,137,229", title:"Tedenski termini",
      question:"Kdaj ste praviloma dosegljivi za izvedbo ali ogled?", coverage:"Tedenska mreža · večizbor dopoldanskih in popoldanskih terminov",
      body:function () { var days=["Pon","Tor","Sre","Čet","Pet","Sob","Ned"]; return '<div class="uj-card-week" data-slot-grid><div class="uj-card-week__head"><span></span>' + days.map(function(day){ return '<b>'+day+'</b>'; }).join("") + '</div><div class="uj-card-week__row"><span>8–12</span>' + days.map(function(day,index){ return '<button type="button" data-slot="'+day+' dopoldne" aria-pressed="'+String(index===1 || index===3)+'" class="'+(index===1 || index===3?'is-selected':'')+'"><span class="sr-only">'+day+' dopoldne</span></button>'; }).join("") + '</div><div class="uj-card-week__row"><span>12–16</span>' + days.map(function(day,index){ return '<button type="button" data-slot="'+day+' popoldne" aria-pressed="'+String(index===2)+'" class="'+(index===2?'is-selected':'')+'"><span class="sr-only">'+day+' popoldne</span></button>'; }).join("") + '</div><p>Izbrano: <b data-slot-count>3 termini</b></p></div>'; }
    },
    {
      id:"ocenjevalna-matrika", number:21, theme:"orange", rgb:"231,133,20", title:"Ocenjevalna matrika",
      question:"Kako ocenjujete ponudbo po ključnih merilih?", coverage:"Več meril + ocena · sproten izračun povprečja",
      body:function () { return '<div class="uj-card-score" data-score-card><div class="uj-card-score__summary"><span>Skupna ocena</span><output data-score-average>3,7</output><small>/ 5</small></div>' + [["Cena",4],["Kakovost",4],["Rok",3]].map(function(row){ return '<div class="uj-card-score__row" data-score-row><span>'+row[0]+'</span><button type="button" data-score-step="-1" aria-label="Znižaj oceno">−</button><input type="number" min="1" max="5" value="'+row[1]+'" aria-label="Ocena: '+row[0]+'"><button type="button" data-score-step="1" aria-label="Zvišaj oceno">+</button></div>'; }).join("") + '</div>'; }
    },
    {
      id:"dvojni-razpon", number:22, theme:"gold", rgb:"199,157,0", title:"Proračunski razpon",
      question:"Kakšen je najnižji in najvišji sprejemljivi proračun?", coverage:"Dvojni drsnik + histogram · jasno označena spodnja in zgornja meja",
      body:function () { return '<div class="uj-card-dual-range" data-dual-range><div class="uj-card-dual-range__readout"><span>Od <b data-dual-min-output>800 €</b></span><span>Do <b data-dual-max-output>2.400 €</b></span></div><div class="uj-card-dual-range__chart" style="--range-start:20%;--range-end:60%" aria-hidden="true">' + Array.from({length:12},function(_,index){ return '<i class="'+(index>=2 && index<=6?'is-active':'')+'" style="--bar:'+((index%5)+3)+'"></i>'; }).join("") + '</div><label><span class="uj-card-label">Spodnja meja</span><input type="range" min="0" max="4000" step="100" value="800" data-dual-min aria-label="Spodnja meja proračuna"></label><label><span class="uj-card-label">Zgornja meja</span><input type="range" min="0" max="4000" step="100" value="2400" data-dual-max aria-label="Zgornja meja proračuna"></label></div>'; }
    },
    {
      id:"pogojna-garancija", number:23, theme:"green", rgb:"41,155,99", title:"Garancija in kritje",
      question:"Ali ponudba vključuje garancijo?", coverage:"Pogojno razkritje · dodatna polja se pokažejo šele po izbiri",
      body:function () { return field("Izberite odgovor", quickChoices([["Da","yes"],["Ne","no"],["Ne vem","unknown"]],"yes","uj-card-choices--three"," data-warranty-choice")) + '<div class="uj-card-warranty" data-warranty-panel><div class="uj-card-stepper" data-card-stepper><button type="button" data-step="-1" aria-label="Zmanjšaj">' + ICONS.minus + '</button><input type="number" min="1" value="24" aria-label="Trajanje garancije">'+cardSelect("Enota garancije", "mesecev", [["mesecev","mesecev"],["let","let"]], "", "uj-card-select--stepper")+'<button type="button" data-step="1" aria-label="Povečaj">' + ICONS.plus + '</button></div><label class="uj-card-label">Kaj krije?<input type="text" placeholder="Npr. material in delo"></label></div>'; }
    },
    {
      id:"mini-koledar", number:24, theme:"coral", rgb:"238,91,88", title:"Izbira dneva",
      question:"Kateri dan je najprimernejši za prvi ogled?", coverage:"Mini koledar · izbor konkretnega dneva znotraj kartice",
      body:function () { var days=[27,28,29,30,31,1,2,3,4,5,6,7,8,9]; return '<div class="uj-card-calendar" data-mini-calendar data-month-index="0"><div class="uj-card-calendar__nav"><button type="button" data-calendar-shift="-1" aria-label="Prejšnji mesec">‹</button><strong data-calendar-month>September 2026</strong><button type="button" data-calendar-shift="1" aria-label="Naslednji mesec">›</button></div><div class="uj-card-calendar__week">' + ["P","T","S","Č","P","S","N"].map(function(day){return '<span>'+day+'</span>';}).join("") + '</div><div class="uj-card-calendar__days">' + days.map(function(day,index){ return '<button type="button" data-calendar-day="'+day+'" aria-pressed="'+String(day===4)+'" class="'+(index<5?'is-muted ':'')+(day===4?'is-selected':'')+'">'+day+'</button>'; }).join("") + '</div><p>Izbrano: <b data-calendar-output>4. september 2026</b></p></div>'; }
    },
    {
      id:"kontrolni-seznam-dokazil", number:25, theme:"teal", rgb:"41,163,162", title:"Popolnost dokumentacije",
      question:"Katera dokazila so že priložena?", coverage:"Kontrolni seznam + napredek · hitro pokaže manjkajoče elemente",
      body:function () { return '<div class="uj-card-checklist" data-checklist><div class="uj-card-checklist__progress"><span><i data-check-progress style="width:50%"></i></span><b data-check-output>2 od 4</b></div>' + [["Pisna ponudba",true],["Cenik ali predračun",true],["Pogoji garancije",false],["Reference izvajalca",false]].map(function(row){ return '<button type="button" data-check-item aria-pressed="'+String(row[1])+'" class="'+(row[1]?'is-done':'')+'"><i>'+ICONS.check+'</i><span>'+row[0]+'</span></button>'; }).join("") + '</div>'; }
    },
    {
      id:"matrika-tveganja", number:26, theme:"coral", rgb:"238,91,88", title:"Matrika tveganja",
      question:"Kako verjetno in kako resno je opaženo tveganje?", coverage:"Matrika 3 × 3 · verjetnost in vpliv v enem dotiku",
      body:function () { return '<div class="uj-card-risk" data-risk-matrix><div class="uj-card-risk__axis"><span>Vpliv →</span><b>Nizek</b><b>Srednji</b><b>Visok</b></div><div class="uj-card-risk__grid"><span>Visoka</span>' + [3,6,9].map(function(score){return '<button type="button" data-risk-score="'+score+'" aria-label="Tveganje '+score+'"></button>';}).join("") + '<span>Srednja</span>' + [2,4,6].map(function(score){return '<button type="button" data-risk-score="'+score+'" aria-label="Tveganje '+score+'"></button>';}).join("") + '<span>Nizka</span>' + [1,2,3].map(function(score){return '<button type="button" data-risk-score="'+score+'" aria-label="Tveganje '+score+'"></button>';}).join("") + '</div><p>Ocena: <b data-risk-output>Izberite polje</b></p></div>'; }
    },
    {
      id:"izbirnik-oznak", number:27, theme:"purple", rgb:"126,88,210", title:"Oznake ponudbe",
      question:"Katere lastnosti najbolje opisujejo ponudbo?", coverage:"Večizbor oznak + lasten vnos · izbrane oznake ostanejo pregledne",
      body:function () { return '<div class="uj-card-tags" data-tag-picker><div class="uj-card-tags__bank">' + ["Lokalno","Hitro","Premium","Na ključ","Eko"].map(function(tag,index){return '<button type="button" data-tag-option="'+tag+'" aria-pressed="'+String(index===0)+'" class="'+(index===0?'is-selected':'')+'">'+tag+'</button>';}).join("") + '</div><div class="uj-card-tags__selected" data-tag-selected><span data-tag-value="Lokalno">Lokalno<button type="button" data-tag-remove aria-label="Odstrani oznako">×</button></span></div><div class="uj-card-tags__add"><input type="text" placeholder="Vpišite svojo oznako" maxlength="24"><button type="button" data-tag-add>Dodaj</button></div></div>'; }
    },
    {
      id:"placilni-razrez", number:28, theme:"gold", rgb:"199,157,0", title:"Plačilni razrez",
      question:"Kako naj bo plačilo razdeljeno med faze?", coverage:"Sestavljeni stolpec + tri vrednosti · takojšen nadzor vsote",
      body:function () { return '<div class="uj-card-payment" data-payment-split><div class="uj-card-payment__bar"><i style="width:30%"></i><i style="width:40%"></i><i style="width:30%"></i></div><div class="uj-card-payment__fields">' + [["Avans",30],["Vmesno",40],["Prevzem",30]].map(function(row,index){return '<label><span>'+row[0]+'</span><span><input type="number" min="0" max="100" value="'+row[1]+'" data-payment-part="'+index+'" aria-label="'+row[0]+' v odstotkih"><b>%</b></span></label>';}).join("") + '</div><p class="is-valid" data-payment-total>Skupaj: <b>100 %</b></p></div>'; }
    },
    {
      id:"trenutno-proti-cilju", number:29, theme:"blue", rgb:"51,137,229", title:"Trenutno proti cilju",
      question:"Kolikšna je trenutna vrednost in kakšen cilj želite doseči?", coverage:"Dvojni merilnik + drsnik · razlika med stanjem in ciljem",
      body:function () { return '<div class="uj-card-goal" data-goal-card><div class="uj-card-goal__gauges"><div class="uj-card-goal__gauge" style="--gauge:62"><span><b>62 %</b><small>trenutno</small></span></div><div class="uj-card-goal__gauge" style="--gauge:80"><span><b data-goal-output>80 %</b><small>cilj</small></span></div></div><div class="uj-card-goal__delta">Manjka še <b data-goal-delta>18 odstotnih točk</b></div><label><span class="uj-card-label">Nastavite cilj</span><input type="range" min="62" max="100" value="80" data-goal-range aria-label="Ciljna vrednost"></label></div>'; }
    },
    {
      id:"odlocitvena-pot", number:30, theme:"teal", rgb:"41,163,162", title:"Naslednji korak",
      question:"Kaj želite narediti s ponudbo?", coverage:"Dvostopenjska odločitev · naslednja izbira se prilagodi prvi",
      body:function () { return '<div class="uj-card-decision" data-decision-card>' + field("1. Izberite smer", quickChoices([["Nadaljuj","continue"],["Primerjaj","compare"],["Zavrni","reject"]],"continue","uj-card-choices--three"," data-decision-path")) + '<div class="uj-card-decision__panel" data-decision-panel="continue">' + field("2. Določite naslednje dejanje", quickChoices([["Pokliči","call"],["Termin","meeting"],["Potrdi","confirm"]],"meeting","uj-card-choices--three")) + '</div><div class="uj-card-decision__panel" data-decision-panel="compare" hidden>' + field("2. Kaj želite primerjati?", quickChoices([["Ceno","price"],["Rok","deadline"],["Pogoje","terms"]],"price","uj-card-choices--three")) + '</div><div class="uj-card-decision__panel" data-decision-panel="reject" hidden>' + field("2. Izberite razlog", quickChoices([["Cena","price"],["Tveganje","risk"],["Drugo","other"]],"price","uj-card-choices--three")) + '</div></div>'; }
    },
    {
      id:"cenovni-most", number:31, theme:"orange", rgb:"231,133,20", title:"Kako nastane končna cena?",
      question:"Kliknite postavko in poglejte, kako spremeni ceno.", coverage:"Preprost račun po korakih · od začetne do končne cene",
      body:function () {
        var steps=[
          ["Osnovna cena","1.000 €","Začetna cena je 1.000 €.",1000,"base","1"],
          ["Popust","−120 €","Popust zniža ceno za 120 €. Nova cena je 880 €.",880,"negative","−"],
          ["Dodatna dela","+220 €","Dodatna dela zvišajo ceno za 220 €. Nova cena je 1.100 €.",1100,"positive","+"],
          ["DDV","+242 €","DDV zviša ceno za 242 €. Cena z DDV je 1.342 €.",1342,"positive","+"],
          ["Končna cena","1.342 €","Končna cena z DDV je 1.342 €.",1342,"total","="]
        ];
        return '<div class="uj-card-waterfall" data-waterfall><div class="uj-card-waterfall__chart" role="list" aria-label="Račun končne cene">' + steps.map(function(step,index){
          var runningTotal=formatEuro(step[3]);
          return '<button type="button" role="listitem" data-waterfall-step data-waterfall-total="'+step[3]+'" data-detail="'+esc(step[2])+'" class="'+(index===0?'is-selected ':'')+'is-'+step[4]+'" aria-label="'+esc(step[2])+'" aria-pressed="'+String(index===0)+'"><i aria-hidden="true">'+step[5]+'</i><span><b>'+step[0]+'</b><small>'+(step[4]==='base'?'Začetek':step[4]==='total'?'Za plačilo':'Novi znesek: '+runningTotal)+'</small></span><strong>'+step[1]+'</strong></button>';
        }).join("") + '</div><p data-waterfall-detail>Začetna cena je 1.000 €.</p></div>';
      }
    },
    {
      id:"trend-odzivnosti", number:32, theme:"teal", rgb:"41,163,162", title:"Trend odzivnosti",
      question:"Kako se je spreminjal odzivni čas ponudnika?", coverage:"Interaktivni trend · navpično merilo in vlečljive časovne točke",
      body:function () {
        var initialPoints=[["Jun",3.7],["Jul",3.4],["Avg",3.2]];
        var initialLine=initialPoints.map(function(point,index){return ((index+.5)*240/initialPoints.length)+","+trendYCoordinate(point[1],2,5);}).join(" ");
        return '<div class="uj-card-trend" data-trend-card data-trend-period-active="3m"><div class="uj-card-trend__top"><span class="uj-card-trend__metric"><small data-trend-selected-label>Avg</small><b data-trend-value aria-live="polite">3,2 dneva</b></span><span class="uj-card-trend__change"><b data-trend-change-icon aria-hidden="true">↓</b><span><strong data-trend-change>0,5 dneva hitreje</strong><small data-trend-scope>v zadnjih 3 mesecih</small></span></span></div><div class="uj-card-trend__periods" role="group" aria-label="Izberite obdobje"><button type="button" data-trend-period="1m" aria-pressed="false">1 mesec</button><button type="button" data-trend-period="3m" class="is-selected" aria-pressed="true">3 mesece</button><button type="button" data-trend-period="6m" aria-pressed="false">6 mesecev</button></div><div class="uj-card-trend__chart"><div class="uj-card-trend__scale-title" data-trend-scale><b>Merilo odziva</b><span>↑ počasneje · ↓ hitreje</span></div><div class="uj-card-trend__canvas"><div class="uj-card-trend__axis" aria-hidden="true"><span><b>5 dni</b><small>počasneje</small></span><span>3,5 d</span><span><b>2 dni</b><small>hitreje</small></span></div><div class="uj-card-trend__plot"><svg class="uj-card-trend__line" viewBox="0 0 240 120" preserveAspectRatio="none" role="img" aria-label="Odzivni časi Jun 3,7, Jul 3,4 in Avg 3,2 dneva"><path d="M0 12H240M0 60H240M0 108H240"/><polyline data-trend-line points="'+initialLine+'"/></svg><div class="uj-card-trend__handles" style="--trend-count:3" role="group" aria-label="Premaknite posamezno točko gor ali dol">' + Array.from({length:6},function(_,index){var point=initialPoints[index];var value=point?point[1]:2;return '<label data-trend-handle data-trend-index="'+index+'" style="--trend-y:'+trendYPercent(value,2,5)+'%" class="'+(index===2?'is-selected':'')+'"'+(point?'':' hidden')+'><input type="range" min="2" max="5" step="0.1" value="'+value+'" data-trend-input data-trend-index="'+index+'" data-trend-label="'+(point?point[0]:'')+'" aria-orientation="vertical" aria-label="'+(point?point[0]+': odzivni čas v dnevih':'Neaktivna trendna točka')+'" aria-valuetext="'+formatTrendNumber(value)+' dneva"><span aria-hidden="true"></span></label>';}).join("") + '</div></div></div><div class="uj-card-trend__labels" style="--trend-count:3">' + Array.from({length:6},function(_,index){var point=initialPoints[index];return '<span data-trend-label-index="'+index+'" class="'+(index===2?'is-selected':'')+'"'+(point?'':' hidden')+'><b>'+(point?point[0]:'')+'</b><small>'+(point?formatTrendNumber(point[1])+' d':'')+'</small></span>';}).join("") + '</div></div><p class="uj-card-trend__hint"><span aria-hidden="true">↕</span> Povlecite krogce gor ali dol. Spodaj pomeni hitrejši odziv.</p></div>';
      }
    },
    {
      id:"ciljni-pas", number:33, theme:"blue", rgb:"51,137,229", title:"Ciljni pas",
      question:"Ali je odziv znotraj dogovorjenega cilja?", coverage:"Ciljni pas + natančen vnos · dejanska vrednost, cilj in jasen status",
      body:function () { return '<div class="uj-card-bullet" data-bullet-card><div class="uj-card-bullet__summary"><span><small>Dejanski odziv</small><b data-bullet-output>4,2 dneva</b></span><span class="uj-card-bullet__status is-good" data-bullet-status aria-live="polite"><b data-bullet-status-title>✓ V cilju</b><small data-bullet-status-detail>0,8 dneva do cilja</small></span></div><div class="uj-card-bullet__scale" style="--bullet-value:42%"><div class="uj-card-bullet__bands"><span class="is-good">V cilju</span><span class="is-warning">Opozorilo</span><span class="is-bad">Kršitev</span></div><i data-bullet-marker><b data-bullet-marker-value>4,2</b></i><em aria-hidden="true"></em></div><div class="uj-card-bullet__labels"><span>0</span><span>Cilj 5</span><span>Meja 8</span><span>10 dni</span></div><div class="uj-card-bullet__input"><span>Nastavite odzivni čas</span><div><button type="button" data-bullet-step="-0.1" aria-label="Zmanjšaj odzivni čas za 0,1 dneva">−</button><span><input type="number" min="0" max="10" step="0.1" value="4.2" data-bullet-input aria-label="Odzivni čas v dnevih" aria-valuetext="4,2 dneva"><b>dni</b></span><button type="button" data-bullet-step="0.1" aria-label="Povečaj odzivni čas za 0,1 dneva">+</button></div></div></div>'; }
    },
    {
      id:"ocena-z-negotovostjo", number:34, theme:"gold", rgb:"199,157,0", title:"Ocena z negotovostjo",
      question:"Kakšen je realen razpon in najverjetnejši strošek?", coverage:"Point-and-range · spodnja meja, osrednja ocena in zgornja meja",
      body:function () { return '<div class="uj-card-estimate" data-estimate-card data-estimate-max="30000"><div class="uj-card-estimate__summary"><span><small>Najverjetnejša ocena</small><b data-estimate-summary>18.000 €</b></span><span><small>Verjetni razpon</small><b data-estimate-output>10.000–24.000 €</b></span></div><div class="uj-card-estimate__chart" style="--estimate-min:33%;--estimate-likely:60%;--estimate-max:80%"><span></span><i class="is-min" aria-hidden="true"></i><i class="is-likely"><b data-estimate-marker>18.000 €</b></i><i class="is-max" aria-hidden="true"></i></div><div class="uj-card-estimate__axis"><span>0 €</span><span>15.000 €</span><span>30.000 €</span></div><div class="uj-card-estimate__legend"><span><i></i>Meji razpona</span><span><i></i>Najverjetneje</span></div><div class="uj-card-estimate__fields">' + [["Najmanj",10000,"min"],["Najverjetneje",18000,"likely"],["Največ",24000,"max"]].map(function(row){return '<label class="is-'+row[2]+'"><span>'+row[0]+'</span><span><input type="number" min="0" max="30000" step="500" value="'+row[1]+'" data-estimate-'+row[2]+' aria-label="'+row[0]+' stroški"><b>€</b></span></label>';}).join("") + '</div><p>Širina razpona: <b data-estimate-width>14.000 €</b></p></div>'; }
    },
    {
      id:"primerjava-sprememb", number:35, theme:"purple", rgb:"126,88,210", title:"Prej in zdaj",
      question:"Kaj se je v novi ponudbi najbolj spremenilo?", coverage:"Interaktivna primerjava · obe vrednosti Prej in Zdaj sta neposredno drsni",
      body:function () {
        var rows=[
          { label:"Cena", kind:"price", from:1500, value:1320, min:800, max:1800, step:10 },
          { label:"Rok", kind:"day", from:30, value:21, min:7, max:45, step:1 },
          { label:"Garancija", kind:"month", from:12, value:24, min:0, max:36, step:1 }
        ];
        return '<div class="uj-card-change" data-change-card>' + rows.map(function(row,index){
          var span=Math.max(1,row.max-row.min);
          var fromPercent=(row.from-row.min)/span*100;
          var toPercent=(row.value-row.min)/span*100;
          var startPercent=Math.min(fromPercent,toPercent);
          var widthPercent=Math.abs(fromPercent-toPercent);
          var detail=changeDetailText(row.kind,row.from,row.value);
          return '<div class="uj-card-change__row '+(index===0?'is-selected':'')+'" data-change-row data-change-kind="'+row.kind+'" data-change-detail="'+esc(detail)+'"><div class="uj-card-change__head"><b>'+row.label+'</b><span class="uj-card-change__values"><small><em>Prej</em><b data-change-from-value>'+formatChangeValue(row.kind,row.from,true)+'</b></small><small class="is-now"><em>Zdaj</em><strong data-change-value>'+formatChangeValue(row.kind,row.value,true)+'</strong></small></span></div><div class="uj-card-change__slider" style="--change-from:'+fromPercent+'%;--change-to:'+toPercent+'%;--change-start:'+startPercent+'%;--change-width:'+widthPercent+'%"><span aria-hidden="true"><b></b></span><input type="range" min="'+row.min+'" max="'+row.max+'" step="'+row.step+'" value="'+row.from+'" data-change-input data-change-role="from" aria-label="Prej: '+row.label+'" aria-valuetext="'+formatChangeValue(row.kind,row.from,false)+'"><input type="range" min="'+row.min+'" max="'+row.max+'" step="'+row.step+'" value="'+row.value+'" data-change-input data-change-role="now" class="'+(index===0?'is-active':'')+'" aria-label="Zdaj: '+row.label+'" aria-valuetext="'+formatChangeValue(row.kind,row.value,false)+'"></div></div>';
        }).join("") + '<p data-change-output aria-live="polite">Cena je nižja za 180 €</p></div>';
      }
    },
    {
      id:"prekoracitve-praga", number:36, theme:"coral", rgb:"238,91,88", title:"Kateri odgovori so zamujali?",
      question:"Dogovor je odgovor v 5 dneh. Kliknite datum za podrobnost.", coverage:"Preprost seznam · takoj vidite, kateri odgovori so zamujali",
      body:function () {
        var limit=5;
        var points=[["3. 8.",3,false],["8. 8.",4,false],["13. 8.",7,true],["18. 8.",4,false],["23. 8.",8,true],["28. 8.",5,false]];
        return '<div class="uj-card-threshold" data-threshold-card><div class="uj-card-threshold__summary" data-threshold-summary><span><small>Zamujeni odgovori</small><b data-threshold-count>2 od 6</b><em>sta prišla po dogovorjenem roku</em></span><span><small>Dogovorjeni rok</small><b>5 dni</b><em>dlje pomeni zamudo</em></span></div><div class="uj-card-threshold__filters" role="group" aria-label="Katere odgovore želite videti?"><button type="button" data-threshold-filter="breach" class="is-selected" aria-pressed="true">Samo zamujeni <b>2</b></button><button type="button" data-threshold-filter="all" aria-pressed="false">Vsi odgovori <b>6</b></button></div><div class="uj-card-threshold__plot" data-threshold-list>' + points.map(function(point,index){
          var difference=point[1]-limit;
          var distance=Math.abs(difference);
          var dayLabel=point[1]===1?' dan':' dni';
          var status=difference>0?distance+(distance===1?' dan prepozno':' dni prepozno'):difference<0?distance+(distance===1?' dan hitreje':' dni hitreje'):'Pravočasno';
          var detail='Odgovor z dne '+point[0]+' je trajal '+point[1]+dayLabel+'. '+status+'.';
          return '<button type="button" data-threshold-point data-breach="'+String(point[2])+'" data-threshold-detail="'+esc(detail)+'" aria-label="'+esc(detail)+'" aria-pressed="'+String(index===4)+'" class="'+(index===4?'is-selected':'')+'"'+(point[2]?'':' hidden')+'><span class="uj-card-threshold__date">'+point[0]+'</span><span class="uj-card-threshold__plain"><b>Odgovor: '+point[1]+dayLabel+'</b><small>'+status+'</small></span></button>';
        }).join("") + '</div><p data-threshold-output>Odgovor z dne 23. 8. je trajal 8 dni. Zamujal je 3 dni.</p></div>';
      }
    },
    {
      id:"hierarhicni-izbor", number:37, theme:"green", rgb:"41,155,99", title:"Obseg storitve",
      question:"Kateri del storitve želite vključiti?", coverage:"Hierarhični drill-down · en nivo naenkrat brez širokega drevesa",
      body:function () { return '<div class="uj-card-tree" data-tree-card><div class="uj-card-tree__crumb"><button type="button" data-tree-back hidden aria-label="Nazaj">‹</button><span data-tree-crumb>Vse storitve</span></div><div data-tree-panel="root"><button type="button" data-tree-branch="Gradbena dela"><span>Gradbena dela</span><b>3 področja ›</b></button><button type="button" data-tree-branch="Digitalne storitve"><span>Digitalne storitve</span><b>3 področja ›</b></button><button type="button" data-tree-select="Svetovanje"><span>Svetovanje</span><b>Izberi</b></button></div><div data-tree-panel="Gradbena dela" hidden><button type="button" data-tree-select="Načrtovanje"><span>Načrtovanje</span><b>Izberi</b></button><button type="button" data-tree-select="Izvedba"><span>Izvedba</span><b>Izberi</b></button><button type="button" data-tree-select="Nadzor"><span>Nadzor</span><b>Izberi</b></button></div><div data-tree-panel="Digitalne storitve" hidden><button type="button" data-tree-select="Spletna rešitev"><span>Spletna rešitev</span><b>Izberi</b></button><button type="button" data-tree-select="Integracija"><span>Integracija</span><b>Izberi</b></button><button type="button" data-tree-select="Vzdrževanje"><span>Vzdrževanje</span><b>Izberi</b></button></div><p>Izbrano: <b data-tree-output>še ni izbrano</b></p></div>'; }
    },
    {
      id:"iskalni-izbirnik", number:38, theme:"teal", rgb:"41,163,162", title:"Iskanje ponudnika",
      question:"Katerega ponudnika želite povezati s ponudbo?", coverage:"Iskalni combobox · filtriranje velikega nabora in jasna izbrana vrednost",
      body:function () { var options=[["Alfa montaža d.o.o.","Ljubljana · preverjen"],["Beta sistemi d.o.o.","Kranj · preverjen"],["Dom servis Novak s.p.","Celje · nov ponudnik"],["Eko gradnje d.o.o.","Maribor · preverjen"]]; return '<div class="uj-card-combobox" data-combobox><label><span class="uj-card-label">Poiščite po imenu ali kraju</span><input type="text" value="" placeholder="Začnite tipkati …" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="atena-provider-options" data-combo-input></label><div id="atena-provider-options" role="listbox" data-combo-options>' + options.map(function(row){return '<button type="button" role="option" aria-selected="false" data-combo-option="'+row[0]+'"><span>'+row[0]+'</span><small>'+row[1]+'</small></button>';}).join("") + '<p data-combo-empty hidden>Ni zadetkov. Uporabite vpisano ime.</p></div><button type="button" class="uj-card-combobox__manual" data-combo-manual hidden>Uporabi vpisano ime</button><div class="uj-card-combobox__selected" data-combo-selected hidden><span>Izbrano</span><b></b><button type="button" data-combo-clear aria-label="Odstrani izbor">×</button></div></div>'; }
    },
    {
      id:"pravilo-ponavljanja", number:39, theme:"purple", rgb:"126,88,210", title:"Pravilo ponavljanja",
      question:"Kako pogosto naj se dogodek ponovi?", coverage:"Recurrence builder · interval, enota, dnevi in sproten opis pravila",
      body:function () { return '<div class="uj-card-recurrence" data-recurrence><div class="uj-card-recurrence__interval"><span>Vsakih</span><button type="button" data-recurrence-step="-1" aria-label="Zmanjšaj interval">−</button><input type="number" min="1" max="12" value="2" data-recurrence-count aria-label="Interval ponavljanja"><button type="button" data-recurrence-step="1" aria-label="Povečaj interval">+</button>'+cardSelect("Enota ponavljanja", "tedna", [["tedna","tedna"],["meseca","meseca"]], "data-recurrence-unit", "uj-card-select--recurrence")+'</div><div class="uj-card-recurrence__days" role="group" aria-label="Dnevi ponavljanja">' + ["Pon","Tor","Sre","Čet","Pet","Sob","Ned"].map(function(day,index){return '<button type="button" data-recurrence-day="'+day+'" aria-pressed="'+String(index===0 || index===2)+'" class="'+(index===0 || index===2?'is-selected':'')+'">'+day+'</button>';}).join("") + '</div><label class="uj-card-recurrence__end"><span>Zaključi</span>'+cardSelect("Zaključek ponavljanja", "count", [["count","po 6 ponovitvah"],["date","na izbrani datum"],["never","brez konca"]], "data-recurrence-end", "uj-card-select--recurrence-end")+'<input type="date" value="2026-12-31" data-recurrence-date hidden aria-label="Končni datum ponavljanja"></label><p data-recurrence-output aria-live="polite">Vsaka 2 tedna · pon, sre · 6 ponovitev</p></div>'; }
    },
    {
      id:"relativni-rok", number:40, theme:"coral", rgb:"238,91,88", title:"Relativni rok",
      question:"Na kateri dogodek je rok vezan in koliko dni velja?", coverage:"Dogodek + odmik · razumljiv stavek namesto izračunavanja datuma",
      body:function () { return '<div class="uj-card-relative" data-relative-deadline><label><span class="uj-card-label">Izhodiščni dogodek</span>'+cardSelect("Izhodiščni dogodek", "podpisu pogodbe", [["podpisu pogodbe","Podpis pogodbe",' data-relative-before="podpisom pogodbe"'],["prejemu računa","Prejem računa",' data-relative-before="prejemom računa"'],["zaključku izvedbe","Zaključek izvedbe",' data-relative-before="zaključkom izvedbe"']], "data-relative-anchor", "uj-card-select--relative")+'</label><div class="uj-card-relative__rule"><div><button type="button" data-relative-step="-1" aria-label="Zmanjšaj odmik">−</button><input type="number" min="0" max="180" value="14" data-relative-days aria-label="Število dni"><button type="button" data-relative-step="1" aria-label="Povečaj odmik">+</button></div><div><button type="button" data-relative-mode="pred" aria-pressed="false">pred</button><button type="button" data-relative-mode="po" class="is-selected" aria-pressed="true">po</button></div></div><p>Rok: <b data-relative-output>14 dni po podpisu pogodbe</b></p></div>'; }
    },
    {
      id:"lokacija-in-doseg", number:41, theme:"blue", rgb:"51,137,229", title:"Lokacija in doseg",
      question:"Od kod izvajalec prihaja in kako daleč storitev pokriva?", coverage:"Lokacija + radij · prostorski doseg z besedilno vrednostjo",
      body:function () { return '<div class="uj-card-radius" data-radius-card><label><span class="uj-card-label">Izhodiščna lokacija</span><input type="text" value="Ljubljana" aria-label="Izhodiščna lokacija"></label><div class="uj-card-radius__map" style="--radius-size:44%" aria-hidden="true"><i></i><i></i><i></i><b>●</b><span data-radius-map-label>25 km</span></div><div class="uj-card-radius__readout"><span>Doseg izvajanja</span><b data-radius-output>25 km</b></div><input type="range" min="5" max="100" step="5" value="25" data-radius-range aria-label="Doseg izvajanja v kilometrih" aria-valuetext="25 km"><div class="uj-card-radius__ticks"><span>5 km</span><span>50 km</span><span>100 km</span></div></div>'; }
    },
    {
      id:"obrocni-nacrt", number:42, theme:"gold", rgb:"199,157,0", title:"Obročni načrt",
      question:"Na koliko enakih obrokov naj se razdeli znesek 2.400 €?", coverage:"Stepper + dinamični stolpci · število obrokov in znesek posameznega obroka",
      body:function () { return '<div class="uj-card-installments" data-installments data-total="2400"><div class="uj-card-installments__summary"><span>Posamezni obrok</span><b data-installment-amount>600 €</b><small>skupaj 2.400 €</small></div><div class="uj-card-installments__bars" data-installment-bars>' + Array.from({length:4},function(_,index){return '<i style="--installment-index:'+(index+1)+'"><span>'+(index+1)+'</span></i>';}).join("") + '</div><div class="uj-card-installments__stepper"><button type="button" data-installment-step="-1" aria-label="Manj obrokov">−</button><input type="number" min="2" max="8" step="1" value="4" data-installment-count aria-label="Število obrokov"><span>obroki</span><button type="button" data-installment-step="1" aria-label="Več obrokov">+</button></div></div>'; }
    },
    {
      id:"matrika-vkljucenosti", number:43, theme:"green", rgb:"41,155,99", title:"Kaj je vključeno",
      question:"Kako je posamezna postavka obravnavana v ponudbi?", coverage:"Vrstične tekstovne izbire · vključeno, doplačilo ali ni vključeno za vsako zahtevo",
      body:function () { var rows=[["Dostava","included"],["Montaža","extra"],["Odvoz","excluded"]]; return '<div class="uj-card-inclusion" data-inclusion-card data-inclusion-included="Dostava" data-inclusion-extra="Montaža" data-inclusion-excluded="Odvoz">' + rows.map(function(row){return '<div data-inclusion-row data-inclusion-label="'+row[0]+'"><span>'+row[0]+'</span><div role="group" aria-label="Obravnava postavke '+row[0]+'">' + [["included","Vključeno"],["extra","Doplačilo"],["excluded","Ni vključeno"]].map(function(option){return '<button type="button" data-inclusion-choice="'+option[0]+'" aria-label="'+row[0]+': '+option[1]+'" aria-pressed="'+String(row[1]===option[0])+'" class="'+(row[1]===option[0]?'is-selected':'')+'"><span aria-hidden="true">✓</span><b>'+option[1]+'</b></button>';}).join("") + '</div></div>';}).join("") + '</div>'; }
    },
    {
      id:"parna-primerjava", number:44, theme:"orange", rgb:"231,133,20", title:"Parna primerjava",
      question:"Kaj vam je pri delu in dogovorih pomembnejše?", coverage:"Prilagodljivo število kratkih primerjav · vprašanja določi dejanska uporaba",
      body:function () {
        var pairings=[
          ["Pri izbiri ponudbe: kaj je pomembnejše?","Cena","Kakovost"],
          ["Pri izvedbi dela: kaj je pomembnejše?","Hiter rok","Natančnost"],
          ["Pri dogovoru s stranko: kaj je pomembnejše?","Jasna cena","Prilagodljivost"],
          ["Po koncu dela: kaj je pomembnejše?","Garancija","Reference"]
        ];
        return '<div class="uj-card-pairwise" data-pairwise data-pair-round="0" data-pair-results="" data-pairings="'+encodeURIComponent(JSON.stringify(pairings))+'"><div class="uj-card-pairwise__progress"><span><i style="width:'+(100/pairings.length)+'%" data-pair-progress></i></span><b data-pair-counter>1 od '+pairings.length+'</b></div><h4 data-pair-prompt>'+pairings[0][0]+'</h4><div class="uj-card-pairwise__options"><button type="button" data-pair-choice="'+pairings[0][1]+'"><small>Izberite</small><b data-pair-left>'+pairings[0][1]+'</b></button><em>ali</em><button type="button" data-pair-choice="'+pairings[0][2]+'"><small>Izberite</small><b data-pair-right>'+pairings[0][2]+'</b></button></div><p data-pair-output aria-live="polite">Izberite eno možnost</p><button type="button" data-pair-reset hidden>Ponovi primerjavo</button></div>';
      }
    },
    {
      id:"pregled-odgovorov", number:45, theme:"teal", rgb:"41,163,162", title:"Pregled odgovorov",
      question:"Ali so ključni podatki pravilni pred potrditvijo?", coverage:"Summary list + inline edit · pregled in popravek brez zapuščanja kartice",
      body:function () { var rows=[["Cena","1.342 €"],["Rok","21 dni"],["Garancija","24 mesecev"]]; return '<div class="uj-card-review" data-review-card>' + rows.map(function(row){return '<div data-review-row><span>'+row[0]+'</span><b data-review-value>'+row[1]+'</b><input type="text" value="'+row[1]+'" hidden aria-label="Uredite: '+row[0]+'"><button type="button" data-review-edit>Uredi</button></div>';}).join("") + '<p><span aria-hidden="true">'+ICONS.check+'</span> Vsi trije podatki so pripravljeni za potrditev.</p></div>'; }
    },
    {
      id:"obcutljivost-izida", number:46, theme:"orange", rgb:"231,133,20", title:"Kaj najbolj spremeni ceno?",
      question:"Kaj najbolj vpliva na končno ceno?", coverage:"Trije vplivi · spremenite vrednost in takoj vidite razliko",
      body:function () {
        var rows=[["Cena materiala","material",0],["Rok izvedbe","deadline",0],["Obseg del","scope",0]];
        return '<div class="uj-card-sensitivity" data-sensitivity data-base="12000"><div class="uj-card-sensitivity__baseline"><span>Osnovna ocena</span><b>12.000 €</b></div><div class="uj-card-sensitivity__chart">' + rows.map(function(row){return '<div class="uj-card-sensitivity__row is-neutral" data-sensitivity-row data-sensitivity-label="'+row[0]+'"><div class="uj-card-sensitivity__head"><b>'+row[0]+'</b><output data-sensitivity-value>0 €</output></div><div class="uj-card-sensitivity__controls"><div class="uj-card-sensitivity__track"><input type="range" min="-30" max="30" step="1" value="0" data-sensitivity-range aria-label="Vpliv: '+row[0]+'" aria-valuetext="0 odstotkov" style="--sensitivity-start:50%;--sensitivity-end:50%;--sensitivity-fill:#9aa9a6"><span aria-hidden="true">0</span></div><output data-sensitivity-number aria-label="Vpliv v odstotkih">0 %</output></div></div>';}).join("") + '</div><p class="uj-card-live" data-sensitivity-summary aria-live="polite">Cena ostane enaka · ocena 12.000 €</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"mesalnik-scenarija", number:47, theme:"teal", rgb:"41,163,162", title:"Koliko denarja potrebujete v rezervi?",
      question:"Koliko denarja potrebujete na računu, da lahko delo normalno dokončate?", coverage:"Tri preproste nastavitve · takojšen izračun potrebne rezerve",
      body:function () {
        var defaults={ scope:100, advance:30, delay:7 };
        var params=[["Obseg projekta","scope",70,140,5,100,"%"],["Predplačilo kupca","advance",0,80,5,30,"%"],["Zamuda plačila","delay",0,30,1,7,"dni"]];
        return '<div class="uj-card-scenario" data-scenario-mixer data-base="15000"><div class="uj-card-scenario__presets" data-scenario-preset-list role="group" aria-label="Izberite scenarij"><button type="button" data-scenario-preset="optimistic" data-scope="90" data-advance="50" data-delay="2" aria-pressed="false">Optimistično</button><button type="button" data-scenario-preset="real" data-scope="100" data-advance="30" data-delay="7" class="is-selected" aria-pressed="true">Realno</button><button type="button" data-scenario-preset="stress" data-scope="120" data-advance="10" data-delay="21" aria-pressed="false">Stresno</button><button type="button" data-scenario-add>+ Dodaj scenarij</button></div><div class="uj-card-scenario__preset-tools"><button type="button" data-scenario-save-criteria hidden>Shrani nove kriterije</button></div><div class="uj-card-scenario__new" data-scenario-new-form hidden><input type="text" maxlength="18" placeholder="Ime scenarija" aria-label="Ime novega scenarija" data-scenario-name><button type="button" data-scenario-create>Dodaj</button><button type="button" data-scenario-cancel>Prekliči</button><small>Uporabljene bodo spodnje vrednosti.</small></div><div class="uj-card-scenario__params">' + params.map(function(row){return '<div class="uj-card-scenario__param" data-scenario-param="'+row[1]+'"><div><b>'+row[0]+'</b><output data-scenario-output>'+scenarioImpactText(row[1],defaults,15000)+'</output></div><input type="range" min="'+row[2]+'" max="'+row[3]+'" step="'+row[4]+'" value="'+row[5]+'" data-scenario-range aria-label="'+row[0]+'" aria-valuetext="'+row[5]+' '+row[6]+'"><label><input type="number" min="'+row[2]+'" max="'+row[3]+'" step="'+row[4]+'" value="'+row[5]+'" data-scenario-number aria-label="Natančno: '+row[0]+'"><span>'+row[6]+'</span></label></div>';}).join("") + '</div><p class="uj-card-live" data-scenario-summary aria-live="polite">Realno · potrebna rezerva 11.760 €</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"prag-verjetnosti-zamude", number:48, theme:"purple", rgb:"126,88,210", title:"Koliko zamude še sprejmete?",
      question:"Koliko dni zamude je za vas še v redu?", coverage:"20 primerov zamude · izberete mejo in takoj vidite, koliko primerov jo preseže",
      body:function () {
        var days=[2,3,3,4,4,5,5,6,6,7,7,8,8,9,10,11,12,14,16,20];
        return '<div class="uj-card-probability" data-probability><div class="uj-card-probability__control"><div class="uj-card-probability__control-head"><span>Največ zamude</span><b data-probability-limit>10 dni</b></div><input type="range" min="2" max="20" step="1" value="10" data-probability-range aria-label="Največ sprejemljive zamude" aria-valuetext="10 dni"><label><input type="number" min="2" max="20" step="1" value="10" data-probability-number aria-label="Največ dni zamude"><span>dni</span></label></div><div class="uj-card-probability__stats"><span><small>Daljših primerov</small><b><strong data-probability-count>5</strong> / 20</b></span><span><small>Možnost daljše zamude</small><b data-probability-percent>25 %</b></span></div><div class="uj-card-probability__plot" data-probability-plot style="--threshold-ratio:50%" role="img" aria-label="Dvajset primerov zamude; pet jih traja dlje kot 10 dni">' + days.map(function(day){return '<i data-probability-dot data-day="'+day+'" class="'+(day>10?'is-over':'')+'" style="--day-height:'+(day/20*100).toFixed(0)+'%"><span>'+day+' dni</span></i>';}).join("") + '</div><div class="uj-card-probability__axis"><span>2 dni</span><b>običajno 7 dni</b><span>20 dni</span></div><div class="uj-card-probability__legend"><span><i></i>do izbrane meje</span><span><i></i>dlje od meje</span></div><p class="uj-card-live is-good" data-probability-summary aria-live="polite">Majhna možnost · 5 od 20 primerov traja dlje kot 10 dni</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"toplotni-koledar", number:49, theme:"blue", rgb:"51,137,229", title:"Zasedenost po dnevih",
      question:"Kateri dnevi so pri vas najbolj zasedeni?", coverage:"4 tedni × 7 dni · preproste barvne stopnje brez številk",
      body:function () {
        var days=[["Pon","ponedeljek"],["Tor","torek"],["Sre","sreda"],["Čet","četrtek"],["Pet","petek"],["Sob","sobota"],["Ned","nedelja"]], levels=["prosto","malo dela","srednje zasedeno","zelo zasedeno"], loads=[0,1,2,1,0,0,0,0,2,3,2,1,0,0,2,3,3,2,1,1,0,1,2,2,1,0,0,0];
        return '<div class="uj-card-heatmap" data-heatmap data-heat-mode="add"><div class="uj-card-heatmap__toolbar"><span>Spremeni zasedenost</span><div><button type="button" data-heat-mode="remove" aria-pressed="false"><b>−</b> Zmanjšaj</button><button type="button" data-heat-mode="add" class="is-selected" aria-pressed="true"><b>+</b> Povečaj</button></div></div><div class="uj-card-heatmap__calendar"><div class="uj-card-heatmap__head"><span>Teden</span>'+days.map(function(day){return '<b>'+day[0]+'</b>';}).join("")+'</div>' + Array.from({length:4},function(_,week){return '<div class="uj-card-heatmap__week"><span>T'+(week+1)+'</span>'+days.map(function(day,index){var load=loads[week*days.length+index];var dayLabel=day[1].charAt(0).toLocaleUpperCase("sl-SI")+day[1].slice(1);return '<button type="button" data-heat-cell data-heat-day="'+day[1]+'" data-heat-week="'+(week+1)+'" data-heat-day-index="'+index+'" data-load="'+load+'" aria-label="'+dayLabel+', '+(week+1)+'. teden: '+levels[load]+'"><span data-heat-mark aria-hidden="true"><i></i><i></i><i></i></span></button>';}).join("")+'</div>';}).join("") + '</div><div class="uj-card-heatmap__legend" aria-label="Stopnje zasedenosti"><span>Prosto</span><i data-level="0"></i><i data-level="1"></i><i data-level="2"></i><i data-level="3"></i><span>Zelo zasedeno</span></div><p class="uj-card-live" data-heat-summary aria-live="polite">Najbolj zaseden dan: sreda</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"lijak-izterjave", number:50, theme:"coral", rgb:"238,91,88", title:"Od računa do plačila",
      question:"Koliko denarja je ostalo po vsakem koraku?", coverage:"4 preprosti koraki · zneski in koliko denarja je odpadlo med koraki",
      body:function () {
        var stages=[["Odprti računi","invoices",18000],["Po opominu","reminders",14000],["Dogovorjeno","agreements",9000],["Plačano","paid",6200]];
        return '<div class="uj-card-funnel" data-funnel><div class="uj-card-funnel__overview"><span><small>Začetni znesek</small><b data-funnel-base>18.000 €</b></span><i aria-hidden="true">→</i><span><small>Prejeli ste</small><b data-funnel-paid>6.200 €</b></span><strong data-funnel-rate>34 % plačano</strong></div><p class="uj-card-funnel__hint">Znesek se po vsakem koraku lahko samo zmanjša.</p><div class="uj-card-funnel__stages">' + stages.map(function(row,index){var percent=Math.round(row[2]/stages[0][2]*100);return '<label class="uj-card-funnel__stage" data-funnel-stage data-funnel-key="'+row[1]+'" style="--funnel-width:'+percent+'%"><span><b>'+row[0]+'</b><small data-funnel-loss>'+(index?'manj '+formatEuro(stages[index-1][2]-row[2]):'začetek')+'</small></span><i aria-hidden="true"><em></em></i><span class="uj-card-funnel__input"><input type="number" min="0" max="50000" step="100" value="'+row[2]+'" data-funnel-input aria-label="Znesek po koraku '+row[0]+'"><b>€</b></span></label>';}).join("") + '</div><p class="uj-card-live" data-funnel-summary aria-live="polite">Prejeli ste 6.200 € od 18.000 € · največ je odpadlo pred korakom Dogovorjeno (5.000 €)</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"mreza-odvisnosti", number:51, theme:"green", rgb:"41,155,99", title:"Kaj urediti najprej?",
      question:"Kaj morate urediti in potrditi, da lahko nadaljujete?", coverage:"Štirje kratki koraki · jasno je, kaj uredite zdaj in kaj sledi",
      body:function () {
        var nodes=[["Dokumenti","documents",""],["Kontakt","contact","documents"],["Opomin","reminder","contact"],["Predaja","handoff","reminder"]];
        return '<div class="uj-card-dependencies" data-dependencies><div class="uj-card-dependencies__graph">' + nodes.map(function(row,index){var current=index===0;return '<button type="button" data-dependency-node data-dep-id="'+row[1]+'" data-dep-step="'+(index+1)+'" data-dep-requires="'+row[2]+'" aria-pressed="false" aria-disabled="false" aria-label="'+row[0]+'. '+(current?'Potrdi, ko je urejeno':'Sledi pozneje')+'"'+(current?' aria-current="step"':'')+' class="'+(current?'is-current':'is-future')+'"><span>'+(index+1)+'</span><b>'+row[0]+'</b><small>'+(current?'Potrdi, ko je urejeno':'Sledi potem')+'</small></button>';}).join("") + '</div><p class="uj-card-live" data-dependency-summary aria-live="polite">Najprej uredite in potrdite: Dokumenti</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"pogajalski-prostor", number:52, theme:"teal", rgb:"41,163,162", title:"Dogovor o popustu",
      question:"Kako stranka plačuje in koliko popusta ji želite dati?", coverage:"Preprost izbor načina plačevanja · popust in jasno priporočilo",
      body:function () { var payments=[["late","Pogosto zamuja",0,"Koliko dni po roku običajno plača?",1,60,21,"dni","običajno plača {value} dni po roku"],["sometimes","Včasih zamuja",5,"Kolikokrat na leto zamudi?",1,12,3,"krat","na leto zamudi približno {value}-krat"],["ontime","Plača v roku",10,"V koliko dneh plača račun?",0,60,14,"dni","račun plača v {value} dneh"],["advance","Plača vnaprej",15,"Koliko računa plača vnaprej?",0,100,50,"%","vnaprej plača {value} % računa"]]; return '<div class="uj-card-plane" data-plane data-plane-index="2"><div class="uj-card-plane__payments"><span>Kako stranka plačuje?</span><div data-plane-switch role="group" aria-label="Način plačevanja stranke">'+payments.map(function(row,index){return '<button type="button" data-plane-payment="'+row[0]+'" data-plane-index="'+index+'" data-plane-limit="'+row[2]+'" data-plane-detail-label="'+row[3]+'" data-plane-detail-min="'+row[4]+'" data-plane-detail-max="'+row[5]+'" data-plane-detail-value="'+row[6]+'" data-plane-detail-unit="'+row[7]+'" data-plane-detail-text="'+row[8]+'" class="'+(row[0]==='ontime'?'is-selected':'')+'" aria-pressed="'+String(row[0]==='ontime')+'">'+row[1]+'</button>';}).join("")+'</div></div><div class="uj-card-plane__detail"><div><span data-plane-detail-question>V koliko dneh plača račun?</span><b data-plane-detail-output>14 dni</b></div><input type="range" min="0" max="60" step="1" value="14" data-plane-detail-range aria-label="V koliko dneh plača račun?" aria-valuetext="14 dni" style="--plane-progress:23.33%"><label><input type="number" min="0" max="60" step="1" value="14" data-plane-detail-number aria-label="V koliko dneh plača račun?, natančno"><span data-plane-detail-unit-label>dni</span></label></div><div class="uj-card-plane__discount"><div><span>Kolikšen popust?</span><b data-plane-discount-output>5 %</b></div><input type="range" min="0" max="20" step="1" value="5" data-plane-discount-range aria-label="Popust v odstotkih" aria-valuetext="5 odstotkov" style="--plane-progress:25%"><label><input type="number" min="0" max="20" step="1" value="5" data-plane-discount-number aria-label="Natančen popust"><span>%</span></label></div><div class="uj-card-plane__recommendation"><span><small>Priporočen največji popust</small><b data-plane-recommended>10 %</b></span><em data-plane-payment-label>plača v roku · 14 dni</em></div><p class="uj-card-live is-good" data-plane-summary aria-live="polite">5 % popusta je v redu · račun plača v 14 dneh</p>'+resetControl()+'</div>'; }
    },
    {
      id:"skupine-odstopanj", number:53, theme:"purple", rgb:"126,88,210", title:"Pregled spornih pogojev",
      question:"Kaj želite narediti z vsakim pogojem?", coverage:"Vsak pogoj ima svoj jasen izbor · brez skritega prestavljanja med skupinami",
      body:function () {
        var choices=[["ok","V redu"],["change","Želim spremeniti"],["review","Naj se preveri"],["reject","Ne sprejmem"]];
        var items=[["Odpovedni rok","notice","review"],["Jamstvo","warranty","review"],["Rabat / popust","discount","reject"],["Zaupnost","privacy","reject"]];
        return '<div class="uj-card-grouping" data-clause-grouping><p class="uj-card-grouping__hint">Pri vsakem pogoju izberite eno možnost.</p><div class="uj-card-grouping__list">' + items.map(function(item){var selected=choices.find(function(choice){return choice[0]===item[2];});return '<div data-clause-item="'+item[1]+'" data-clause-state="'+item[2]+'"><b>'+item[0]+'</b><div class="uj-card-grouping__select" data-clause-select><button type="button" data-clause-toggle aria-haspopup="listbox" aria-expanded="false" aria-label="'+item[0]+': '+selected[1]+'"><span data-clause-value>'+selected[1]+'</span><i aria-hidden="true"></i></button><div data-clause-menu role="listbox" aria-label="Izbira za '+item[0]+'" hidden>'+choices.map(function(choice){return '<button type="button" role="option" data-clause-choice="'+choice[0]+'" aria-selected="'+String(choice[0]===item[2])+'" class="'+(choice[0]===item[2]?'is-selected':'')+'">'+choice[1]+'</button>';}).join("")+'</div></div></div>';}).join("") + '</div><p class="uj-card-live" data-clause-summary aria-live="polite">2 za preveriti · 2 ne sprejmete</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"pasovi-zmogljivosti", number:54, theme:"blue", rgb:"51,137,229", title:"Kam lahko prestavite delo?",
      question:"Katera ekipa ima dovolj prostega časa za to delo?", coverage:"Izberete delo in ekipo · takoj vidite proste ure",
      body:function () {
        var lanes=[["a","Ekipa A",12],["b","Ekipa B",8],["c","Ekipa C",6]];
        var tasks=[["Montaža","assembly",6,"a"],["Testiranje","testing",4,"a"],["Dokumentacija","docs",3,"b"]];
        return '<div class="uj-card-capacity" data-capacity><div class="uj-card-capacity__step"><h3><span>1</span>Izberite delo</h3><div class="uj-card-capacity__tasks" role="group" aria-label="Izberite delo">' + tasks.map(function(task){return '<button type="button" data-capacity-task="'+task[1]+'" data-capacity-hours="'+task[2]+'" data-capacity-team="'+task[3]+'" aria-pressed="false"><b>'+task[0]+'</b><small>'+task[2]+' h</small></button>';}).join("") + '</div></div><div class="uj-card-capacity__step"><h3><span>2</span>Izberite ekipo</h3><div class="uj-card-capacity__lanes">' + lanes.map(function(lane){var used=tasks.filter(function(task){return task[3]===lane[0];}).reduce(function(sum,task){return sum+task[2];},0);return '<div data-capacity-lane="'+lane[0]+'" data-capacity-max="'+lane[2]+'"><span class="uj-card-capacity__team"><b>'+lane[1]+'</b><small data-capacity-status>'+(lane[2]-used)+' h prosto</small></span><i data-capacity-bar aria-hidden="true"><em style="width:'+(used/lane[2]*100)+'%"></em></i><button type="button" data-capacity-target="'+lane[0]+'" aria-label="Premakni izbrano delo v '+lane[1]+'">Izberi</button></div>';}).join("") + '</div></div><p class="uj-card-live" data-capacity-summary aria-live="polite">Izberite delo, nato ekipo.</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"ujemanje-pogojev-dokazil", number:55, theme:"gold", rgb:"199,157,0", title:"Povežite dogovor z dokazilom",
      question:"Kateri dokument dokazuje posamezni dogovor?", coverage:"Najprej izberete dogovor, nato pravi dokument",
      body:function () {
        var claims=[["Cena z DDV","price","offer","231,126,0"],["Rok 21 dni","deadline","schedule","47,136,224"],["Garancija 24 mes.","warranty","certificate","123,87,214"]];
        var evidence=[["Podpisana ponudba","offer","231,126,0"],["Terminski načrt","schedule","47,136,224"],["Garancijski list","certificate","123,87,214"]];
        return '<div class="uj-card-matching" data-matching><div class="uj-card-matching__columns"><section><h3><span>1</span>Pogoj</h3>' + claims.map(function(row){return '<button type="button" style="--match-rgb:'+row[3]+'" data-match-claim="'+row[1]+'" data-match-label="'+row[0]+'" data-match-correct="'+row[2]+'" data-match-tone="'+row[3]+'" aria-pressed="false">'+row[0]+'</button>';}).join("") + '</section><section><h3><span>2</span>Dokazilo</h3>' + evidence.map(function(row){return '<button type="button" style="--match-rgb:'+row[2]+'" data-match-evidence="'+row[1]+'" data-match-label="'+row[0]+'" data-match-tone="'+row[2]+'" aria-pressed="false">'+row[0]+'</button>';}).join("") + '</section></div><p class="uj-card-live" data-match-summary aria-live="polite">Izberite pogoj, nato pravo dokazilo.</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"gradnik-pravila-eskalacije", number:56, theme:"coral", rgb:"238,91,88", title:"Kdaj naredimo naslednji korak?",
      question:"Kdaj naj Atena predlaga naslednji korak?", coverage:"Izberete preproste pogoje in dejanje, ki naj sledi",
      body:function () {
        var fields=[["zamuda","Zamuda"],["znesek","Znesek"],["odziv","Odziv"]];
        var operators=[["nad","več kot"],["pod","manj kot"],["enako","točno"]];
        var actions=[["pripravi drugi opomin","pripravi drugi opomin"],["predlagaj obročni dogovor","predlagaj obročni dogovor"],["predlagaj pravni pregled","predlagaj pravni pregled"]];
        return '<div class="uj-card-condition" data-condition-builder><div class="uj-card-condition__join" role="group" aria-label="Kako naj se pogoja upoštevata?"><button type="button" data-condition-join="all" class="is-selected" aria-pressed="true">Vsi pogoji (IN)</button><button type="button" data-condition-join="any" aria-pressed="false">Vsaj en pogoj (ALI)</button></div><div class="uj-card-condition__rows"><div data-condition-row data-condition-index="1"><b class="uj-card-condition__number" aria-hidden="true">1</b>'+conditionSelect("field","Kaj preverjamo pri prvem pogoju","zamuda",fields)+conditionSelect("operator","Primerjava prvega pogoja","nad",operators)+'<label><input type="number" min="0" max="365" step="1" value="15" data-condition-value aria-label="Vrednost prvega pogoja"><b data-condition-unit>dni</b></label></div><div data-condition-row data-condition-index="2"><b class="uj-card-condition__number" aria-hidden="true">2</b>'+conditionSelect("field","Kaj preverjamo pri drugem pogoju","znesek",fields)+conditionSelect("operator","Primerjava drugega pogoja","nad",operators)+'<label><input type="number" min="0" max="50000" step="100" value="1000" data-condition-value aria-label="Vrednost drugega pogoja"><b data-condition-unit>€</b></label></div></div><div class="uj-card-condition__action"><b>Potem</b>'+conditionSelect("action","Kaj naj Atena predlaga","pripravi drugi opomin",actions)+'</div><p class="uj-card-live" data-condition-summary aria-live="polite">Ko velja: zamuda več kot 15 dni in znesek več kot 1.000 €. Potem: pripravi drugi opomin.</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"sled-izvora-podatka", number:57, theme:"green", rgb:"41,155,99", title:"Ali lahko podatku zaupate?",
      question:"Odgovorite na tri kratka vprašanja.", coverage:"Od kod je podatek, kako star je in ali je potrjen",
      body:function () {
        return '<div class="uj-card-provenance" data-provenance><section class="uj-card-provenance__step"><h3><span>1</span>Od kod je podatek?</h3><div class="uj-card-provenance__sources" role="group" aria-label="Od kod je podatek?"><button type="button" data-provenance-source="contract" class="is-selected" aria-pressed="true">Podpisana pogodba</button><button type="button" data-provenance-source="email" aria-pressed="false">E-pošta ponudnika</button><button type="button" data-provenance-source="note" aria-pressed="false">Interna opomba</button></div></section><section class="uj-card-provenance__step"><h3><span>2</span>Kako star je?</h3><div class="uj-card-provenance__age"><input type="range" min="0" max="90" step="1" value="3" data-provenance-age-range aria-label="Kako star je podatek?" aria-valuetext="3 dni"><label><input type="number" min="0" max="90" step="1" value="3" data-provenance-age-number aria-label="Starost podatka v dneh"><span>dni</span></label></div></section><section class="uj-card-provenance__step"><h3><span>3</span>Je podatek potrjen?</h3><div class="uj-card-provenance__checks" role="group" aria-label="Je podatek potrjen?"><button type="button" data-provenance-answer="confirmed" data-provenance-confirm class="is-selected" aria-pressed="true">Da, potrjen je</button><button type="button" data-provenance-answer="conflict" data-provenance-conflict aria-pressed="false">Ne, podatki se ne ujemajo</button></div></section><p class="uj-card-live is-good" data-provenance-summary aria-live="polite">Podatek je svež in potrjen — lahko mu zaupate.</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"prag-rentabilnosti", number:58, theme:"orange", rgb:"231,133,20", title:"Kdaj so stroški pokriti?",
      question:"Vnesite svoje številke in takoj vidite, pri koliko poslih ste na ničli.", coverage:"Cena, strošek in stalni stroški · obe črti ter cilj se takoj preračunajo",
      body:function () { return '<div class="uj-card-breakeven is-under" data-breakeven data-fixed="3600" data-price="180" data-variable="120" data-max="120"><p class="uj-card-breakeven__edit-hint">Spremenite katerikoli znesek — graf se premakne takoj.</p><div class="uj-card-breakeven__setup"><label><span>Za en posel zaračunate</span><b><input type="number" inputmode="decimal" min="1" max="100000" step="10" value="180" data-breakeven-price aria-label="Koliko zaračunate za en posel"><em>€</em></b></label><label><span>En posel vas stane</span><b><input type="number" inputmode="decimal" min="0" max="99999" step="10" value="120" data-breakeven-variable aria-label="Koliko vas stane en posel"><em>€</em></b></label><label><span>Stalni stroški</span><b><input type="number" inputmode="decimal" min="0" max="1000000" step="100" value="3600" data-breakeven-fixed aria-label="Stalni stroški"><em>€</em></b></label></div><figure class="uj-card-breakeven__plot" data-breakeven-plot role="img" aria-label="Prihodki in stroški se srečajo pri 60 poslih; trenutno je izbranih 59 poslov"><svg viewBox="0 0 300 120" aria-hidden="true"><line class="uj-card-breakeven__axis" x1="18" y1="108" x2="282" y2="108"></line><line class="uj-card-breakeven__revenue" data-breakeven-revenue-line x1="18" y1="108" x2="282" y2="12"></line><line class="uj-card-breakeven__cost" data-breakeven-cost-line x1="18" y1="92" x2="282" y2="28"></line><circle data-breakeven-target-marker cx="150" cy="60" r="4"></circle><text data-breakeven-target-label x="150" y="49" text-anchor="middle">kritje 60</text><line class="uj-card-breakeven__guide" data-breakeven-guide x1="148" y1="61" x2="148" y2="108"></line><circle data-breakeven-marker cx="148" cy="61" r="14"></circle><text data-breakeven-marker-label x="148" y="61" text-anchor="middle" dominant-baseline="central">59</text><text class="uj-card-breakeven__revenue-label" data-breakeven-revenue-label x="280" y="11" text-anchor="end">prihodki</text><text class="uj-card-breakeven__cost-label" data-breakeven-cost-label x="280" y="38" text-anchor="end">stroški</text></svg><figcaption><span><i class="is-revenue"></i>Kar prejmete</span><span><i class="is-cost"></i>Vsi stroški</span></figcaption></figure><div class="uj-card-breakeven__top"><span><small>Za pokritje potrebujete</small><strong data-breakeven-threshold>60 poslov</strong></span><span><small data-breakeven-current>Pri 59 poslih</small><strong data-breakeven-current-result>−60 €</strong></span></div><div class="uj-card-breakeven__quantity"><b>Koliko poslov naredite?</b><div class="uj-card-breakeven__control"><div class="uj-card-breakeven__slider" data-breakeven-progress style="--break-even-progress:49.17%;--break-even-target:50%"><span data-breakeven-target>Cilj 60</span><input type="range" min="0" max="120" step="1" value="59" data-breakeven-range aria-label="Število opravljenih poslov" aria-valuetext="59 poslov; do pokritja manjka 1 posel"></div><label><input type="number" min="0" max="120" step="1" value="59" data-breakeven-number aria-label="Natančno število poslov"><span>poslov</span></label></div></div><p class="uj-card-live is-bad" data-breakeven-summary aria-live="polite">Do pokritja manjka 1 posel. Zdaj ste 60 € v minusu.</p>'+resetControl()+'</div>'; }
    },
    {
      id:"drevo-pricakovane-vrednosti", number:59, theme:"teal", rgb:"41,163,162", title:"Kako najlažje do plačila?",
      question:"Izberite ukrep. Nato po potrebi popravite oceno.", coverage:"Tri možnosti · ocene vsake možnosti ostanejo shranjene med primerjavo",
      body:function () {
        var params=[["Možnost, da uspe","probability",0,100,1,60,"%",""],["Koliko dolga dobite nazaj","recovery",0,100,1,80,"%",""],["Koliko vas ukrep stane","cost",0,1000,5,200,"€","več je slabše"]];
        return '<div class="uj-card-expected" data-expected-value data-debt="5000"><p class="uj-card-expected__step"><b>1</b>Izberite ukrep</p><div class="uj-card-expected__actions" role="group" aria-label="Izberite ukrep"><button type="button" data-expected-action="reminder" data-expected-label="Opomin" data-probability="60" data-recovery="80" data-cost="200" class="is-selected" aria-pressed="true"><b>Opomin</b><small data-expected-action-result>pribl. 2.200 €</small></button><button type="button" data-expected-action="installments" data-expected-label="Obroki" data-probability="76" data-recovery="92" data-cost="80" aria-pressed="false"><b>Obroki</b><small data-expected-action-result>pribl. 3.416 €</small></button><button type="button" data-expected-action="lawyer" data-expected-label="Odvetnik" data-probability="86" data-recovery="100" data-cost="520" aria-pressed="false"><b>Odvetnik</b><small data-expected-action-result>pribl. 3.780 €</small></button></div><p class="uj-card-expected__step"><b>2</b>Po potrebi popravite oceno</p><div class="uj-card-expected__params">' + params.map(function(row){return '<div data-expected-param="'+row[1]+'"><div><b>'+row[0]+(row[7]?'<small>'+row[7]+'</small>':'')+'</b><output data-expected-output>'+row[5]+' '+row[6]+'</output></div><input type="range" min="'+row[2]+'" max="'+row[3]+'" step="'+row[4]+'" value="'+row[5]+'" data-expected-range aria-label="'+row[0]+'" aria-valuetext="'+row[5]+' '+row[6]+'"><label><input type="number" min="'+row[2]+'" max="'+row[3]+'" step="'+row[4]+'" value="'+row[5]+'" data-expected-number aria-label="Natančno: '+row[0]+'"><span>'+row[6]+'</span></label></div>';}).join("") + '</div><p class="uj-card-live" data-expected-summary aria-live="polite">Opomin: pričakujete približno 2.200 € · največ kaže Odvetnik (3.780 €).</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"kaskada-krsitve", number:60, theme:"coral", rgb:"238,91,88", title:"Kaj naredite, ko nastane težava?",
      question:"Izberite težavo, prvi ukrep in rezervni korak.", coverage:"3 preprosti koraki · težava, prvi ukrep in rezervni korak",
      body:function () {
        var actions=["Pokličem dobavitelja","Zahtevam nov rok","Poiščem drugo rešitev"], fallbacks=["Pokličem drugega dobavitelja","Ustavim naročilo","Zahtevam povračilo"];
        return '<div class="uj-card-cascade" data-cascade><p class="uj-card-cascade__step"><b>1</b>Kaj je narobe?</p><div class="uj-card-cascade__events" role="group" aria-label="Kaj je narobe?"><button type="button" data-cascade-event="delay" data-cascade-actions="Pokličem dobavitelja|Zahtevam nov rok|Poiščem drugo rešitev" data-cascade-outcomes="Pokličem drugega dobavitelja|Ustavim naročilo|Zahtevam povračilo" aria-pressed="false">Zamuda dobave</button><button type="button" data-cascade-event="nonpayment" data-cascade-actions="Pokličem stranko|Pošljem opomin|Dogovorim obroke" data-cascade-outcomes="Ustavim delo|Pošljem zadnji opomin|Predam izterjavi" aria-pressed="false">Neplačilo</button><button type="button" data-cascade-event="complaint" data-cascade-actions="Pregledam napako|Dogovorim popravek|Preverim dogovor" data-cascade-outcomes="Ponovno popravim|Ponudim znižanje|Predam naprej" aria-pressed="false">Reklamacija</button></div><p class="uj-card-cascade__step"><b>2</b>Kaj naredite najprej?</p><div class="uj-card-cascade__guards is-locked" role="group" aria-label="Kaj naredite najprej?">' + actions.map(function(action,index){return '<button type="button" data-cascade-guard="'+(index+1)+'" aria-pressed="false" disabled><b data-cascade-action>'+action+'</b></button>';}).join("") + '</div><p class="uj-card-cascade__step"><b>3</b>Če to ne pomaga?</p><div class="uj-card-cascade__outcomes is-locked" role="group" aria-label="Kaj naredite, če prvi ukrep ne pomaga?">' + fallbacks.map(function(fallback,index){return '<button type="button" data-cascade-outcome="'+(index+1)+'" aria-pressed="false" disabled>'+fallback+'</button>';}).join("") + '</div><p class="uj-card-live" data-cascade-summary aria-live="polite">Začnite zgoraj: izberite težavo.</p>'+resetControl()+'</div>';
      }
    },
    {
      id:"graficni-cenovni-most", number:61, theme:"orange", rgb:"231,133,20", title:"Cenovni most",
      question:"Kako posamezne spremembe sestavijo končni znesek?", coverage:"Pravi cenovni most · začetna cena, odbitek, dodatki, DDV in končni seštevek",
      body:function () {
        var total=1342;
        var steps=[
          ["Osnovna cena","1.000 €","base",0,1000,1000,"skupaj 1.000 €","Začetna cena je 1.000 €.",[["base",1000]]],
          ["Popust","−120 €","negative",1000,880,1000,"ostane 880 €","Popust je črtasti del nad osnovo: od 1.000 € odvzame 120 €, zato ostane 880 €.",[["base",880],["discount",120]]],
          ["Dodatna dela","+220 €","positive",880,1100,1100,"skupaj 1.100 €","Spodaj ostane 880 € osnove, nad njo je 220 € dodatnih del → skupaj 1.100 €.",[["base",880],["work",220]]],
          ["DDV 22 %","+242 €","tax",1100,1342,1342,"skupaj 1.342 €","Stolpec pokaže celoto: 880 € osnove + 220 € del + 242 € DDV = 1.342 €.",[["base",880],["work",220],["tax",242]]],
          ["Končna cena","1.342 €","total",0,1342,1342,"za plačilo","Končni stolpec v barvah pokaže vse dele zneska za plačilo: 1.342 €.",[["base",880],["work",220],["tax",242]]]
        ];
        return '<div class="uj-card-price-bridge" data-price-bridge><div class="uj-card-price-bridge__chart" role="list" aria-label="Grafični izračun končne cene">' + steps.map(function(step,index){var offset=0,displayTotal=step[5];var segments=step[8].map(function(segment){var bottom=offset/displayTotal*100,height=segment[1]/displayTotal*100;offset+=segment[1];return '<i class="is-'+segment[0]+'" data-bridge-segment="'+segment[0]+'" style="--segment-bottom:'+bottom.toFixed(1)+'%;--segment-height:'+height.toFixed(1)+'%"></i>';}).join("");return '<button type="button" role="listitem" data-price-bridge-step data-bridge-start="'+step[3]+'" data-bridge-end="'+step[4]+'" data-bridge-display-total="'+displayTotal+'" data-detail="'+esc(step[7])+'" class="is-'+step[2]+(index===0?' is-selected':'')+'" style="--stack-height:'+(displayTotal/total*100).toFixed(1)+'%" aria-label="'+esc(step[7])+'" aria-pressed="'+String(index===0)+'"><span class="uj-card-price-bridge__visual" aria-hidden="true"><span class="uj-card-price-bridge__stack">'+segments+'</span></span><span class="uj-card-price-bridge__label"><b>'+step[0]+'</b><small>'+step[1]+'</small><em>'+step[6]+'</em></span></button>';}).join("") + '</div><p class="uj-card-price-bridge__equation" aria-label="Račun končne cene">1.000 € <b>− 120 €</b> <strong>+ 220 €</strong> <strong>+ 242 €</strong> = <em>1.342 €</em></p><p class="uj-card-price-bridge__detail" data-price-bridge-detail aria-live="polite">Začetna cena je 1.000 €.</p></div>';
      }
    }
  ];
  TEMPLATES = Object.freeze(TEMPLATES.map(function (template) {
    return Object.freeze(Object.assign({}, template, {
      approved:APPROVED_TEMPLATE_IDS.includes(template.id),
      approvedVersion:APPROVED_TEMPLATE_IDS.includes(template.id) ? "2026-08-30" : null
    }));
  }));

  function renderTemplateBody(template) {
    var body = template.body();
    var reset = resetControl();
    var hasReset = body.indexOf("data-card-reset") !== -1;
    return { html:hasReset ? body.replace(reset, "") : body, hasReset:hasReset };
  }

  function renderTemplate(template) {
    var renderedBody = renderTemplateBody(template);
    var actions = renderedBody.hasReset ? '<div class="uj-answer-card__actions">' + resetControl() + saveControl() + '</div>' : saveControl();
    return '<article class="uj-answer-card uj-answer-card--' + esc(template.theme) + '" style="--card-rgb:' + esc(template.rgb) + '" data-answer-card data-template-card="' + esc(template.id) + '">' +
      '<header class="uj-answer-card__header"><h2>' + esc(template.title) + '</h2><button type="button" class="uj-answer-card__toggle" data-card-toggle aria-expanded="true" aria-label="Skrči kartico"><span>' + ICONS.chevron + '</span></button></header>' +
      '<div class="uj-answer-card__content" data-card-content><p class="uj-answer-card__question">' + esc(template.question) + '</p><div class="uj-answer-card__body">' + renderedBody.html + '</div>' + actions + '</div>' +
    '</article>';
  }

  function renderGallery() {
    return TEMPLATES.map(function (template) {
      return '<section class="uj-template-tile' + (template.approved ? '' : ' uj-template-tile--draft') + '" data-template-id="' + esc(template.id) + '"><div class="uj-template-tile__meta"><span>' + String(template.number).padStart(2, "0") + '</span><p><strong>' + esc(template.title) + '</strong><small>' + (template.approved ? '' : '<em>Nov osnutek</em> · ') + esc(template.coverage) + '</small></p></div>' + renderTemplate(template) + '</section>';
    }).join("");
  }

  function updateScoreCard(root) {
    if (!root) return;
    var values = Array.from(root.querySelectorAll('input[type="number"]')).map(function (input) { return Number(input.value) || 1; });
    var average = values.reduce(function (sum, value) { return sum + value; }, 0) / Math.max(1, values.length);
    var output = root.querySelector("[data-score-average]");
    if (output) output.textContent = average.toLocaleString("sl-SI", { minimumFractionDigits:1, maximumFractionDigits:1 });
  }

  function updatePaymentSplit(root) {
    if (!root) return;
    var inputs = Array.from(root.querySelectorAll("[data-payment-part]"));
    var values = inputs.map(function (input) { return Math.max(0, Math.min(100, Number(input.value) || 0)); });
    root.querySelectorAll(".uj-card-payment__bar i").forEach(function (bar, index) { bar.style.width = values[index] + "%"; });
    var total = values.reduce(function (sum, value) { return sum + value; }, 0);
    var output = root.querySelector("[data-payment-total]");
    output.classList.toggle("is-valid", total === 100);
    output.classList.toggle("is-invalid", total !== 100);
    output.innerHTML = (total === 100 ? "Skupaj: " : "Vsota mora biti 100 % · trenutno: ") + "<b>" + total + " %</b>";
  }

  function updateDualRange(root, changed) {
    if (!root) return;
    var minInput = root.querySelector("[data-dual-min]");
    var maxInput = root.querySelector("[data-dual-max]");
    if (Number(minInput.value) > Number(maxInput.value)) {
      if (changed === minInput) maxInput.value = minInput.value;
      else minInput.value = maxInput.value;
    }
    var min = Number(minInput.value);
    var max = Number(maxInput.value);
    root.querySelector("[data-dual-min-output]").textContent = min.toLocaleString("sl-SI") + " €";
    root.querySelector("[data-dual-max-output]").textContent = max.toLocaleString("sl-SI") + " €";
    var chart = root.querySelector(".uj-card-dual-range__chart");
    var bars = Array.from(chart.querySelectorAll("i"));
    bars.forEach(function (bar, index) {
      var value = (index + .5) / bars.length * Number(minInput.max);
      bar.classList.toggle("is-active", value >= min && value <= max);
    });
  }

  function addSelectedTag(root, value) {
    if (!root || !value) return;
    var selected = root.querySelector("[data-tag-selected]");
    var exists = Array.from(selected.querySelectorAll("[data-tag-value]")).some(function (tag) { return tag.dataset.tagValue.toLocaleLowerCase("sl-SI") === value.toLocaleLowerCase("sl-SI"); });
    if (exists) return;
    var chip = document.createElement("span");
    chip.dataset.tagValue = value;
    chip.appendChild(document.createTextNode(value));
    var remove = document.createElement("button");
    remove.type = "button"; remove.dataset.tagRemove = ""; remove.setAttribute("aria-label", "Odstrani oznako"); remove.textContent = "×";
    chip.appendChild(remove); selected.appendChild(chip);
  }

  function formatEuro(value, maximumFractionDigits) {
    var number = Number(value) || 0;
    var decimals = Number.isInteger(number) ? 0 : (maximumFractionDigits == null ? 2 : maximumFractionDigits);
    return number.toLocaleString("sl-SI", { minimumFractionDigits:decimals, maximumFractionDigits:decimals }) + " €";
  }

  function updateBulletCard(root, normalize) {
    if (!root) return;
    var input = root.querySelector("[data-bullet-input]");
    var enteredValue = input.valueAsNumber;
    if (!Number.isFinite(enteredValue)) {
      if (!normalize) return;
      enteredValue = Number(input.min) || 0;
    }
    var value = Math.max(Number(input.min), Math.min(Number(input.max), enteredValue));
    if (normalize) input.value = String(value);
    var displayValue = value.toLocaleString("sl-SI", { maximumFractionDigits:1 });
    var dayUnit = value === 1 ? "dan" : value === 2 ? "dneva" : Number.isInteger(value) ? "dni" : "dneva";
    var position = Math.max(7, Math.min(93, value / Number(input.max) * 100));
    root.querySelector(".uj-card-bullet__scale").style.setProperty("--bullet-value", position + "%");
    root.querySelector("[data-bullet-output]").textContent = displayValue + " " + dayUnit;
    root.querySelector("[data-bullet-marker-value]").textContent = displayValue;
    input.setAttribute("aria-valuetext", displayValue + " " + dayUnit);
    var status = root.querySelector("[data-bullet-status]");
    var statusTitle = root.querySelector("[data-bullet-status-title]");
    var statusDetail = root.querySelector("[data-bullet-status-detail]");
    var difference = value <= 5 ? 5 - value : value <= 8 ? value - 5 : value - 8;
    var roundedDifference = Math.round(difference * 10) / 10;
    var differenceText = roundedDifference.toLocaleString("sl-SI", { maximumFractionDigits:1 }) + (roundedDifference === 1 ? " dan" : roundedDifference === 2 ? " dneva" : Number.isInteger(roundedDifference) ? " dni" : " dneva");
    status.classList.remove("is-good", "is-warning", "is-bad");
    if (value < 5) { status.classList.add("is-good"); statusTitle.textContent = "✓ V cilju"; statusDetail.textContent = differenceText + " do cilja"; }
    else if (value === 5) { status.classList.add("is-good"); statusTitle.textContent = "✓ Na cilju"; statusDetail.textContent = "dogovorjenih 5 dni"; }
    else if (value <= 8) { status.classList.add("is-warning"); statusTitle.textContent = "! Opozorilo"; statusDetail.textContent = differenceText + " nad ciljem"; }
    else { status.classList.add("is-bad"); statusTitle.textContent = "× Meja presežena"; statusDetail.textContent = differenceText + " nad mejo"; }
  }

  function updateEstimateCard(root) {
    if (!root) return;
    var minInput = root.querySelector("[data-estimate-min]");
    var likelyInput = root.querySelector("[data-estimate-likely]");
    var maxInput = root.querySelector("[data-estimate-max]");
    var upperLimit = Number(maxInput.max) || Infinity;
    var min = Math.min(upperLimit, Math.max(0, Number(minInput.value) || 0));
    var max = Math.min(upperLimit, Math.max(min, Number(maxInput.value) || min));
    var likely = Math.max(min, Math.min(max, Number(likelyInput.value) || min));
    minInput.value = String(min); likelyInput.value = String(likely); maxInput.value = String(max);
    var scale = Number(root.dataset.estimateMax) || Math.max(1, max);
    var chart = root.querySelector(".uj-card-estimate__chart");
    chart.style.setProperty("--estimate-min", Math.min(100, min / scale * 100) + "%");
    chart.style.setProperty("--estimate-likely", Math.min(100, likely / scale * 100) + "%");
    chart.style.setProperty("--estimate-max", Math.min(100, max / scale * 100) + "%");
    root.querySelector("[data-estimate-output]").textContent = formatEuro(min).replace(" €", "") + "–" + formatEuro(max);
    root.querySelector("[data-estimate-summary]").textContent = formatEuro(likely);
    root.querySelector("[data-estimate-marker]").textContent = formatEuro(likely);
    root.querySelector("[data-estimate-width]").textContent = formatEuro(max - min);
  }

  function formatChangeValue(kind, value, compact) {
    var number = Number(value) || 0;
    if (kind === "price") return Math.round(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
    if (kind === "day") return number.toLocaleString("sl-SI") + (number === 1 ? " dan" : number === 2 ? " dneva" : " dni");
    return number.toLocaleString("sl-SI") + (compact ? " mes." : number === 1 ? " mesec" : number === 2 ? " meseca" : " mesecev");
  }

  function changeDetailText(kind, from, value) {
    var difference = Number(value) - Number(from);
    if (difference === 0) return kind === "day" ? "Rok ostaja enak" : kind === "month" ? "Garancija ostaja enaka" : "Cena ostaja enaka";
    var label = kind === "day" ? "Rok" : kind === "month" ? "Garancija" : "Cena";
    var direction = kind === "day" ? (difference < 0 ? "krajši" : "daljši") : kind === "month" ? (difference < 0 ? "krajša" : "daljša") : difference < 0 ? "nižja" : "višja";
    return label + " je " + direction + " za " + formatChangeValue(kind, Math.abs(difference), false);
  }

  function selectChangeRow(root, row) {
    if (!root || !row) return;
    root.querySelectorAll("[data-change-row]").forEach(function (item) { item.classList.toggle("is-selected", item === row); });
    root.querySelector("[data-change-output]").textContent = row.dataset.changeDetail;
  }

  function activateChangeInput(input) {
    if (!input) return;
    var row = input.closest("[data-change-row]");
    var root = input.closest("[data-change-card]");
    row.querySelectorAll("[data-change-input]").forEach(function (control) { control.classList.toggle("is-active", control === input); });
    selectChangeRow(root, row);
  }

  function updateChangeCard(input) {
    if (!input) return;
    var row = input.closest("[data-change-row]");
    var fromInput = row.querySelector('[data-change-role="from"]');
    var nowInput = row.querySelector('[data-change-role="now"]');
    var min = Number(fromInput.min);
    var max = Number(fromInput.max);
    var from = Math.max(min, Math.min(max, Number(fromInput.value) || min));
    var value = Math.max(min, Math.min(max, Number(nowInput.value) || min));
    var span = Math.max(1, max - min);
    var fromPercent = (from - min) / span * 100;
    var toPercent = (value - min) / span * 100;
    fromInput.value = String(from);
    nowInput.value = String(value);
    fromInput.setAttribute("aria-valuetext", formatChangeValue(row.dataset.changeKind, from, false));
    nowInput.setAttribute("aria-valuetext", formatChangeValue(row.dataset.changeKind, value, false));
    row.querySelector("[data-change-from-value]").textContent = formatChangeValue(row.dataset.changeKind, from, true);
    row.querySelector("[data-change-value]").textContent = formatChangeValue(row.dataset.changeKind, value, true);
    row.dataset.changeDetail = changeDetailText(row.dataset.changeKind, from, value);
    var slider = row.querySelector(".uj-card-change__slider");
    slider.style.setProperty("--change-from", fromPercent + "%");
    slider.style.setProperty("--change-to", toPercent + "%");
    slider.style.setProperty("--change-start", Math.min(fromPercent, toPercent) + "%");
    slider.style.setProperty("--change-width", Math.abs(fromPercent - toPercent) + "%");
    activateChangeInput(input);
  }

  function selectThresholdPoint(root, point) {
    if (!root || !point) return;
    root.querySelectorAll("[data-threshold-point]").forEach(function (button) {
      button.classList.toggle("is-selected", button === point);
      button.setAttribute("aria-pressed", String(button === point));
    });
    root.querySelector("[data-threshold-output]").textContent = point.dataset.thresholdDetail;
  }

  function recurrenceCadence(unit, count) {
    var forms = unit === "meseca" ? ["mesec", "meseca", "mesece", "mesecev"] : ["teden", "tedna", "tedne", "tednov"];
    if (count === 1) return "Vsak " + forms[0];
    if (count === 2) return "Vsaka 2 " + forms[1];
    if (count <= 4) return "Vsake " + count + " " + forms[2];
    return "Vsakih " + count + " " + forms[3];
  }

  function recurrenceText(root) {
    if (!root) return;
    var countInput = root.querySelector("[data-recurrence-count]");
    var count = Math.max(Number(countInput.min), Math.min(Number(countInput.max), Number(countInput.value) || Number(countInput.min)));
    countInput.value = String(count);
    var unit = root.querySelector("[data-recurrence-unit]").value;
    var days = Array.from(root.querySelectorAll("[data-recurrence-day].is-selected")).map(function (button) { return button.dataset.recurrenceDay.toLocaleLowerCase("sl-SI"); });
    var dayText = days.length ? " · " + days.join(", ") : " · brez izbranega dne";
    var endSelect = root.querySelector("[data-recurrence-end]");
    var endInput = root.querySelector("[data-recurrence-date]");
    endInput.hidden = endSelect.value !== "date";
    var endText = endSelect.value === "never" ? " · brez konca" : endSelect.value === "date" ? " · do " + new Date(endInput.value + "T12:00:00").toLocaleDateString("sl-SI") : " · 6 ponovitev";
    root.querySelector("[data-recurrence-output]").textContent = recurrenceCadence(unit, count) + dayText + endText;
  }

  function relativeDeadlineText(root) {
    if (!root) return;
    var daysInput = root.querySelector("[data-relative-days]");
    var days = Math.max(Number(daysInput.min), Math.min(Number(daysInput.max), Number(daysInput.value) || 0));
    daysInput.value = String(days);
    var mode = root.querySelector("[data-relative-mode].is-selected").dataset.relativeMode;
    var anchorSelect = root.querySelector("[data-relative-anchor]");
    var selectedAnchor = anchorSelect.closest("[data-condition-select]").querySelector("[data-condition-choice].is-selected");
    var anchor = mode === "pred" ? selectedAnchor.dataset.relativeBefore : anchorSelect.value;
    root.querySelector("[data-relative-output]").textContent = days + (days === 1 ? " dan " : days === 2 ? " dneva " : " dni ") + mode + " " + anchor;
  }

  function updateInstallments(root, normalize) {
    if (!root) return;
    var input = root.querySelector("[data-installment-count]");
    var enteredCount = input.valueAsNumber;
    if (!Number.isFinite(enteredCount) || (!normalize && !Number.isInteger(enteredCount))) {
      if (!normalize) return;
      enteredCount = Number(input.min);
    }
    var count = Math.max(Number(input.min), Math.min(Number(input.max), Math.round(enteredCount)));
    if (normalize) input.value = String(count);
    var total = Number(root.dataset.total) || 0;
    var amount = total / count;
    var roundedAmount = Math.round(amount * 100) / 100;
    var exactToCent = Math.abs(roundedAmount * count - total) < .005;
    root.querySelector("[data-installment-amount]").textContent = (exactToCent ? "" : "≈ ") + formatEuro(amount, 2);
    var bars = root.querySelector("[data-installment-bars]");
    bars.innerHTML = Array.from({ length:count }, function (_, index) { return '<i style="--installment-index:' + (index + 1) + '"><span>' + (index + 1) + '</span></i>'; }).join("");
  }

  function updateInclusionSummary(root) {
    if (!root) return;
    var selected = { included:[], extra:[], excluded:[] };
    root.querySelectorAll("[data-inclusion-row]").forEach(function (row) {
      var choice = row.querySelector("[data-inclusion-choice].is-selected");
      if (choice) selected[choice.dataset.inclusionChoice].push(row.dataset.inclusionLabel);
    });
    root.dataset.inclusionIncluded = selected.included.join(", ");
    root.dataset.inclusionExtra = selected.extra.join(", ");
    root.dataset.inclusionExcluded = selected.excluded.join(", ");
    var includedOutput = root.querySelector("[data-inclusion-included]");
    var extraOutput = root.querySelector("[data-inclusion-extra]");
    var excludedOutput = root.querySelector("[data-inclusion-excluded]");
    if (includedOutput) includedOutput.textContent = selected.included.join(", ") || "—";
    if (extraOutput) extraOutput.textContent = selected.extra.join(", ") || "—";
    if (excludedOutput) excludedOutput.textContent = selected.excluded.join(", ") || "—";
  }

  function trendSeries(period) {
    var sets = {
      "1m":{ scope:"v zadnjem mesecu", labels:[["1. avg",3.5],["8. avg",3.4],["15. avg",3.6],["29. avg",3.2]] },
      "3m":{ scope:"v zadnjih 3 mesecih", labels:[["Jun",3.7],["Jul",3.4],["Avg",3.2]] },
      "6m":{ scope:"v zadnjih 6 mesecih", labels:[["Mar",4.0],["Apr",3.8],["Maj",3.6],["Jun",3.5],["Jul",3.4],["Avg",3.2]] }
    };
    return sets[period] || sets["3m"];
  }

  function formatTrendNumber(value) {
    return (Math.round((Number(value) || 0) * 10) / 10).toLocaleString("sl-SI", { minimumFractionDigits:1, maximumFractionDigits:1 });
  }

  function trendYCoordinate(value, min, max) {
    var safeValue = Math.max(min, Math.min(max, Number(value) || min));
    return Math.round((12 + (max - safeValue) / Math.max(.1, max - min) * 96) * 10) / 10;
  }

  function trendYPercent(value, min, max) {
    return trendYCoordinate(value, min, max) / 120 * 100;
  }

  function updateTrendChart(root, selectedInput) {
    if (!root) return;
    var handles = Array.from(root.querySelectorAll("[data-trend-handle]:not([hidden])"));
    var inputs = handles.map(function (handle) { return handle.querySelector("[data-trend-input]"); });
    if (!inputs.length) return;
    if (!selectedInput || selectedInput.hidden || !inputs.includes(selectedInput)) selectedInput = inputs[inputs.length - 1];
    var points = [];
    inputs.forEach(function (input, index) {
      var value = Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value) || Number(input.min)));
      value = Math.round(value * 10) / 10;
      input.value = String(value);
      input.setAttribute("aria-valuetext", formatTrendNumber(value) + " dneva");
      var handle = input.closest("[data-trend-handle]");
      handle.style.setProperty("--trend-y", trendYPercent(value, Number(input.min), Number(input.max)) + "%");
      handle.classList.toggle("is-selected", input === selectedInput);
      var label = root.querySelector('[data-trend-label-index="' + input.dataset.trendIndex + '"]');
      label.querySelector("small").textContent = formatTrendNumber(value) + " d";
      label.classList.toggle("is-selected", input === selectedInput);
      points.push(((index + .5) * 240 / inputs.length) + "," + trendYCoordinate(value, Number(input.min), Number(input.max)));
    });
    root.querySelector("[data-trend-line]").setAttribute("points", points.join(" "));
    root.querySelector("[data-trend-selected-label]").textContent = selectedInput.dataset.trendLabel;
    root.querySelector("[data-trend-value]").textContent = formatTrendNumber(selectedInput.value) + " dneva";
    var first = Number(inputs[0].value);
    var last = Number(inputs[inputs.length - 1].value);
    var difference = Math.round((last - first) * 10) / 10;
    var changeIcon = root.querySelector("[data-trend-change-icon]");
    var changeText = root.querySelector("[data-trend-change]");
    if (difference < 0) { changeIcon.textContent = "↓"; changeText.textContent = formatTrendNumber(Math.abs(difference)) + " dneva hitreje"; }
    else if (difference > 0) { changeIcon.textContent = "↑"; changeText.textContent = formatTrendNumber(difference) + " dneva počasneje"; }
    else { changeIcon.textContent = "→"; changeText.textContent = "brez spremembe"; }
    root.querySelector(".uj-card-trend__line").setAttribute("aria-label", "Odzivni časi: " + inputs.map(function (input) { return input.dataset.trendLabel + " " + formatTrendNumber(input.value); }).join(", ") + " dneva. Točke lahko premikate gor ali dol.");
  }

  function applyTrendPeriod(root, period) {
    if (!root) return;
    var series = trendSeries(period);
    root.dataset.trendPeriodActive = period;
    root.querySelector("[data-trend-scope]").textContent = series.scope;
    root.querySelector(".uj-card-trend__handles").style.setProperty("--trend-count", series.labels.length);
    root.querySelector(".uj-card-trend__labels").style.setProperty("--trend-count", series.labels.length);
    var selectedInput = null;
    root.querySelectorAll("[data-trend-handle]").forEach(function (handle, index) {
      var point = series.labels[index];
      var input = handle.querySelector("[data-trend-input]");
      var label = root.querySelector('[data-trend-label-index="' + index + '"]');
      handle.hidden = !point;
      label.hidden = !point;
      if (!point) return;
      input.value = String(point[1]);
      input.dataset.trendLabel = point[0];
      input.setAttribute("aria-label", point[0] + ": odzivni čas v dnevih");
      label.querySelector("b").textContent = point[0];
      label.querySelector("small").textContent = formatTrendNumber(point[1]) + " d";
      if (index === series.labels.length - 1) selectedInput = input;
    });
    updateTrendChart(root, selectedInput);
  }

  function updateTrendFromPointer(input, clientY) {
    if (!input) return;
    var rect = input.getBoundingClientRect();
    var inset = rect.height * .1;
    var ratio = Math.max(0, Math.min(1, (clientY - rect.top - inset) / Math.max(1, rect.height - inset * 2)));
    var min = Number(input.min);
    var max = Number(input.max);
    var step = Number(input.step) || .1;
    var raw = max - ratio * (max - min);
    var value = min + Math.round((raw - min) / step) * step;
    input.value = String(Math.round(value * 10) / 10);
    input.dispatchEvent(new Event("input", { bubbles:true }));
  }

  function clampNumber(value, min, max, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = fallback == null ? min : fallback;
    return Math.max(Number(min), Math.min(Number(max), number));
  }

  function signedPercent(value) {
    var number = Number(value) || 0;
    return (number > 0 ? "+" : number < 0 ? "−" : "") + Math.abs(number).toLocaleString("sl-SI") + " %";
  }

  function formatWholeEuro(value) {
    var number = Math.round(Number(value) || 0);
    return (number < 0 ? "−" : "") + Math.abs(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
  }

  function formatSignedEuro(value) {
    var number = Math.round(Number(value) || 0);
    return (number > 0 ? "+" : number < 0 ? "−" : "") + Math.abs(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
  }

  function updateSensitivity(root, source) {
    if (!root) return;
    if (source) {
      var changedRow = source.closest("[data-sensitivity-row]");
      var linkedRange = changedRow.querySelector("[data-sensitivity-range]");
      var changedValue = clampNumber(source.value, source.min, source.max, 0);
      linkedRange.value = String(changedValue);
    }
    var rows = Array.from(root.querySelectorAll("[data-sensitivity-row]"));
    var sum = 0;
    rows.forEach(function (row) {
      var range = row.querySelector("[data-sensitivity-range]");
      var number = row.querySelector("[data-sensitivity-number]");
      var value = clampNumber(range.value, range.min, range.max, 0);
      range.value = String(value); number.textContent = signedPercent(value); sum += value;
      row.classList.toggle("is-negative", value < 0); row.classList.toggle("is-positive", value > 0); row.classList.toggle("is-neutral", value === 0);
      row.querySelector("[data-sensitivity-value]").textContent = formatSignedEuro(Number(root.dataset.base) * value / 100);
      var position = (value - Number(range.min)) / (Number(range.max) - Number(range.min)) * 100; range.style.setProperty("--sensitivity-start", Math.min(50, position) + "%"); range.style.setProperty("--sensitivity-end", Math.max(50, position) + "%"); range.style.setProperty("--sensitivity-fill", value < 0 ? "#8d6ebc" : value > 0 ? "rgb(var(--card-rgb))" : "#9aa9a6");
      range.setAttribute("aria-valuetext", signedPercent(value).replace("%", "odstotkov"));
    });
    var strongest = rows.reduce(function (top, row) { return Math.abs(Number(row.querySelector("[data-sensitivity-range]").value)) > Math.abs(Number(top.querySelector("[data-sensitivity-range]").value)) ? row : top; }, rows[0]);
    var strongestValue = Number(strongest.querySelector("[data-sensitivity-range]").value);
    var total = Number(root.dataset.base) * (1 + sum / 100);
    root.querySelector("[data-sensitivity-summary]").textContent = strongestValue === 0 ? "Cena ostane enaka · ocena " + formatWholeEuro(total) : "Najbolj vpliva " + strongest.dataset.sensitivityLabel.toLocaleLowerCase("sl-SI") + " (" + signedPercent(strongestValue) + ") · nova ocena " + formatWholeEuro(total);
  }

  function scenarioPresetValues(button) {
    return button ? { advance:Number(button.dataset.advance), delay:Number(button.dataset.delay), scope:Number(button.dataset.scope) } : null;
  }

  function scenarioCurrentValues(root) {
    var values = {};
    root.querySelectorAll("[data-scenario-param]").forEach(function (row) { values[row.dataset.scenarioParam] = Number(row.querySelector("[data-scenario-range]").value); });
    return values;
  }

  function scenarioValuesMatch(first, second) {
    return Boolean(first && second && first.advance === second.advance && first.delay === second.delay && first.scope === second.scope);
  }

  function scenarioImpactText(key, values, base) {
    var projectValue = Number(base) * values.scope / 100;
    if (key === "scope") return formatWholeEuro(projectValue);
    if (key === "advance") return formatSignedEuro(-projectValue * values.advance / 100);
    return formatSignedEuro(values.delay * 180);
  }

  function updateScenario(root, source) {
    if (!root) return;
    if (source) {
      var changed = source.closest("[data-scenario-param]");
      var range = changed.querySelector("[data-scenario-range]");
      var number = changed.querySelector("[data-scenario-number]");
      var value = clampNumber(source.value, source.min, source.max, Number(range.value));
      range.value = String(value);
      if (source !== number || number.value !== String(value)) number.value = String(value);
    }
    var values = {};
    root.querySelectorAll("[data-scenario-param]").forEach(function (row) {
      var key = row.dataset.scenarioParam;
      var range = row.querySelector("[data-scenario-range]");
      var number = row.querySelector("[data-scenario-number]");
      var value = clampNumber(range.value, range.min, range.max, 0);
      var unit = key === "delay" ? "dni" : "%";
      range.value = String(value);
      if (source !== number || number.value !== String(value)) number.value = String(value);
      values[key] = value;
      range.setAttribute("aria-valuetext", value.toLocaleString("sl-SI") + " " + unit);
    });
    var base = Number(root.dataset.base);
    root.querySelectorAll("[data-scenario-param]").forEach(function (row) { row.querySelector("[data-scenario-output]").textContent = scenarioImpactText(row.dataset.scenarioParam, values, base); });
    var projectValue = base * values.scope / 100;
    var reserve = projectValue * (1 - values.advance / 100) + values.delay * 180;
    var selected = root.querySelector("[data-scenario-preset].is-selected") || root.querySelector('[data-scenario-preset="real"]');
    var dirty = !scenarioValuesMatch(values, scenarioPresetValues(selected));
    root.querySelector("[data-scenario-save-criteria]").hidden = !dirty;
    selected.classList.toggle("is-dirty", dirty);
    root.querySelector("[data-scenario-summary]").textContent = selected.textContent.trim() + (dirty ? " · spremenjeno" : "") + " · potrebna rezerva " + formatWholeEuro(reserve);
  }

  function applyScenarioPreset(root, button) {
    var values = scenarioPresetValues(button);
    if (!root || !values) return;
    root.querySelectorAll("[data-scenario-preset]").forEach(function (item) { item.classList.toggle("is-selected", item === button); item.classList.remove("is-dirty"); item.setAttribute("aria-pressed", String(item === button)); });
    root.querySelectorAll("[data-scenario-param]").forEach(function (row) {
      var value = values[row.dataset.scenarioParam];
      row.querySelector("[data-scenario-range]").value = String(value);
      row.querySelector("[data-scenario-number]").value = String(value);
    });
    updateScenario(root);
  }

  function saveScenarioCriteria(root) {
    var selected = root && root.querySelector("[data-scenario-preset].is-selected"); var values = root && scenarioCurrentValues(root);
    if (!selected || !values) return;
    selected.dataset.scope = String(values.scope); selected.dataset.advance = String(values.advance); selected.dataset.delay = String(values.delay);
    updateScenario(root);
  }

  function closeScenarioForm(root) {
    var form = root.querySelector("[data-scenario-new-form]"); var add = root.querySelector("[data-scenario-add]"); var input = root.querySelector("[data-scenario-name]");
    form.hidden = true; add.hidden = false; input.value = ""; input.removeAttribute("aria-invalid");
  }

  function createScenarioPreset(root) {
    var input = root.querySelector("[data-scenario-name]"); var name = input.value.trim().replace(/\s+/g, " ");
    if (!name) { input.setAttribute("aria-invalid", "true"); input.focus(); return; }
    var values = scenarioCurrentValues(root); var custom = document.createElement("span"); var button = document.createElement("button"); var remove = document.createElement("button"); custom.dataset.scenarioCustom = ""; button.type = "button"; button.dataset.scenarioPreset = "custom-" + Date.now(); button.dataset.scope = String(values.scope); button.dataset.advance = String(values.advance); button.dataset.delay = String(values.delay); button.setAttribute("aria-pressed", "true"); button.textContent = name; remove.type = "button"; remove.dataset.scenarioDelete = ""; remove.setAttribute("aria-label", "Izbriši scenarij " + name); remove.textContent = "×"; custom.appendChild(button); custom.appendChild(remove);
    root.querySelectorAll("[data-scenario-preset]").forEach(function (item) { item.classList.remove("is-selected", "is-dirty"); item.setAttribute("aria-pressed", "false"); });
    button.classList.add("is-selected"); root.querySelector("[data-scenario-preset-list]").insertBefore(custom, root.querySelector("[data-scenario-add]")); closeScenarioForm(root); updateScenario(root); button.focus();
  }

  function deleteScenarioPreset(root, remove) {
    if (!root || !remove) return;
    var custom = remove.closest("[data-scenario-custom]"); var preset = custom && custom.querySelector("[data-scenario-preset]"); var selected = preset && preset.classList.contains("is-selected");
    if (!custom || !preset) return;
    custom.remove();
    if (selected) applyScenarioPreset(root, root.querySelector('[data-scenario-preset="real"]'));
    else updateScenario(root);
    root.querySelector("[data-scenario-add]").focus();
  }

  function updateProbability(root, source) {
    if (!root) return;
    var range = root.querySelector("[data-probability-range]");
    var number = root.querySelector("[data-probability-number]");
    var threshold = clampNumber(source ? source.value : range.value, range.min, range.max, 10);
    range.value = String(threshold); number.value = String(threshold);
    var dots = Array.from(root.querySelectorAll("[data-probability-dot]"));
    var over = 0;
    dots.forEach(function (dot) { var exceeds = Number(dot.dataset.day) > threshold; dot.classList.toggle("is-over", exceeds); if (exceeds) over += 1; });
    var percent = Math.round(over / Math.max(1, dots.length) * 100);
    var risk = percent > 50 ? "Velika možnost" : percent > 25 ? "Srednja možnost" : "Majhna možnost";
    root.querySelector("[data-probability-limit]").textContent = threshold + " dni";
    root.querySelector("[data-probability-count]").textContent = String(over);
    root.querySelector("[data-probability-percent]").textContent = percent + " %";
    var summary = root.querySelector("[data-probability-summary]");
    summary.textContent = risk + " · " + over + " od " + dots.length + " primerov traja dlje kot " + threshold + " dni";
    summary.classList.toggle("is-bad", percent > 50); summary.classList.toggle("is-good", percent <= 25);
    range.setAttribute("aria-valuetext", threshold + " dni, " + percent + " odstotkov primerov traja dlje");
    var plot = root.querySelector("[data-probability-plot]");
    plot.style.setProperty("--threshold-ratio", (threshold / Number(range.max) * 100).toFixed(1) + "%");
    plot.setAttribute("aria-label", "Dvajset primerov zamude; " + over + " jih traja dlje kot " + threshold + " dni");
  }

  function updateHeatmap(root) {
    if (!root) return;
    var cells = Array.from(root.querySelectorAll("[data-heat-cell]"));
    var dayNames = ["ponedeljek","torek","sreda","četrtek","petek","sobota","nedelja"];
    var dayTotals = dayNames.map(function () { return 0; });
    var levelNames = ["prosto","malo dela","srednje zasedeno","zelo zasedeno"];
    var mode = root.dataset.heatMode === "remove" ? "remove" : root.dataset.heatMode === "add" ? "add" : "none";
    cells.forEach(function (cell) {
      var load = Number(cell.dataset.load);
      var dayIndex = Number(cell.dataset.heatDayIndex);
      dayTotals[dayIndex] += load;
      var action = " Klik spremeni stopnjo zasedenosti.";
      var dayLabel = cell.dataset.heatDay.charAt(0).toLocaleUpperCase("sl-SI") + cell.dataset.heatDay.slice(1); cell.setAttribute("aria-label", dayLabel + ", " + cell.dataset.heatWeek + ". teden: " + levelNames[load] + "." + action);
    });
    var maximum = Math.max.apply(null, dayTotals);
    var busiest = dayNames.filter(function (_, index) { return maximum > 0 && dayTotals[index] === maximum; });
    var summary = root.querySelector("[data-heat-summary]");
    if (!maximum) summary.textContent = "Vsi dnevi so prosti";
    else summary.textContent = (busiest.length === 1 ? "Najbolj zaseden dan: " : "Najbolj zasedeni dnevi: ") + busiest.join(", ");
  }

  function updateFunnel(root) {
    if (!root) return;
    var stages = Array.from(root.querySelectorAll("[data-funnel-stage]"));
    var previous = Infinity;
    var values = stages.map(function (stage) {
      var input = stage.querySelector("[data-funnel-input]");
      var value = Math.min(previous, clampNumber(input.value, input.min, input.max, 0));
      input.value = String(value); previous = value; return value;
    });
    var baseValue = values[0]; var base = Math.max(1, baseValue);
    var biggestLoss = -1; var biggestIndex = 1;
    stages.forEach(function (stage, index) {
      var percent = baseValue > 0 ? Math.round(values[index] / base * 100) : 0;
      stage.style.setProperty("--funnel-width", (values[index] > 0 ? Math.max(8, percent) : 0) + "%");
      var loss = index ? values[index - 1] - values[index] : 0;
      stage.querySelector("[data-funnel-loss]").textContent = index ? "manj " + formatWholeEuro(loss) : "začetek";
      if (index && loss > biggestLoss) { biggestLoss = loss; biggestIndex = index; }
    });
    var conversion = baseValue > 0 ? Math.round(values[values.length - 1] / base * 100) : 0;
    var labels = stages.map(function (stage) { return stage.querySelector("span b").textContent; });
    root.querySelector("[data-funnel-base]").textContent = formatWholeEuro(baseValue);
    root.querySelector("[data-funnel-paid]").textContent = formatWholeEuro(values[values.length - 1]);
    root.querySelector("[data-funnel-rate]").textContent = conversion + " % plačano";
    root.querySelector("[data-funnel-summary]").textContent = baseValue > 0 ? "Prejeli ste " + formatWholeEuro(values[values.length - 1]) + " od " + formatWholeEuro(baseValue) + " · največ je odpadlo pred korakom " + labels[biggestIndex] + " (" + formatWholeEuro(biggestLoss) + ")" : "Najprej vnesite začetni znesek";
  }

  function updateDependencies(root, message, neededId) {
    if (!root) return;
    var nodes = Array.from(root.querySelectorAll("[data-dependency-node]"));
    var next = nodes.find(function (node) { return !node.classList.contains("is-done"); });
    nodes.forEach(function (node) { var done=node.classList.contains("is-done"); var current=node===next; var label=node.querySelector("b").textContent; var status=done?"Urejeno":current?"Potrdi, ko je urejeno":"Sledi potem"; node.classList.toggle("is-current", current); node.classList.toggle("is-future", !done && !current); node.classList.toggle("is-needed", node.dataset.depId===neededId); node.setAttribute("aria-disabled", "false"); node.setAttribute("aria-pressed", String(done)); node.setAttribute("aria-label", label + ". " + status); if (current) node.setAttribute("aria-current", "step"); else node.removeAttribute("aria-current"); node.querySelector("span").textContent=done?"✓":node.dataset.depStep; node.querySelector("small").textContent=status; });
    root.querySelector("[data-dependency-summary]").textContent = message || (next ? "Zdaj uredite in potrdite: " + next.querySelector("b").textContent : "Vsi štirje koraki so urejeni");
  }

  function updatePlane(root, source) {
    if (!root) return;
    var range = root.querySelector("[data-plane-discount-range]"); var number = root.querySelector("[data-plane-discount-number]");
    var detailRange = root.querySelector("[data-plane-detail-range]"); var detailNumber = root.querySelector("[data-plane-detail-number]");
    var payment = root.querySelector("[data-plane-payment].is-selected");
    if (source && source.matches && source.matches("[data-plane-payment]")) {
      root.dataset.planeIndex=payment.dataset.planeIndex;
      detailRange.min=payment.dataset.planeDetailMin; detailRange.max=payment.dataset.planeDetailMax; detailRange.value=payment.dataset.planeDetailValue;
      detailNumber.min=payment.dataset.planeDetailMin; detailNumber.max=payment.dataset.planeDetailMax; detailNumber.value=payment.dataset.planeDetailValue;
    }
    var detailSource = source && source.matches && source.matches("[data-plane-detail-range], [data-plane-detail-number]") ? source : detailRange;
    var detail = clampNumber(detailSource.value, detailRange.min, detailRange.max, 0);
    detailRange.value=String(detail); detailNumber.value=String(detail); payment.dataset.planeDetailValue=String(detail);
    var discountSource = source && source.matches && source.matches("[data-plane-discount-range], [data-plane-discount-number]") ? source : range;
    var discount = clampNumber(discountSource.value, range.min, range.max, 0);
    range.value = String(discount); number.value = String(discount);
    var paymentKey = payment.dataset.planePayment; var limit = Number(payment.dataset.planeLimit);
    if (paymentKey === "sometimes") limit = detail <= 5 ? 5 : detail <= 10 ? 3 : 0;
    else if (paymentKey === "ontime") limit = detail <= 7 ? 12 : detail <= 14 ? 10 : 8;
    else if (paymentKey === "advance") limit = detail >= 14 ? 15 : detail >= 7 ? 12 : 10;
    var detailText = payment.dataset.planeDetailText.replace("{value}", detail);
    var acceptable = discount <= limit;
    range.style.setProperty("--plane-progress", (discount - Number(range.min)) / (Number(range.max) - Number(range.min)) * 100 + "%");
    detailRange.style.setProperty("--plane-progress", (detail - Number(detailRange.min)) / (Number(detailRange.max) - Number(detailRange.min)) * 100 + "%");
    root.querySelector("[data-plane-discount-output]").textContent = discount + " %";
    root.querySelector("[data-plane-detail-question]").textContent = payment.dataset.planeDetailLabel;
    var detailUnit = payment.dataset.planeDetailUnit;
    root.querySelector("[data-plane-detail-output]").textContent = detail + " " + detailUnit;
    root.querySelector("[data-plane-detail-unit-label]").textContent = detailUnit;
    root.querySelector("[data-plane-recommended]").textContent = limit + " %";
    root.querySelector("[data-plane-payment-label]").textContent = payment.textContent.toLocaleLowerCase("sl-SI") + " · " + detail + " " + detailUnit;
    range.setAttribute("aria-valuetext", discount + " odstotkov popusta");
    detailRange.setAttribute("aria-label", payment.dataset.planeDetailLabel); detailRange.setAttribute("aria-valuetext", detail + " " + detailUnit);
    detailNumber.setAttribute("aria-label", payment.dataset.planeDetailLabel + ", natančno");
    var summary = root.querySelector("[data-plane-summary]");
    summary.textContent = acceptable ? discount + " % popusta je v redu · " + detailText : "Popust je previsok · ker stranka " + detailText + ", dajte največ " + limit + " %";
    summary.classList.toggle("is-good", acceptable); summary.classList.toggle("is-bad", !acceptable);
  }

  function updateClauseGroups(root) {
    if (!root) return;
    var labels = { ok:"v redu", change:"za spremeniti", review:"za preveriti", reject:"ne sprejmete" };
    var parts = Object.keys(labels).map(function (key) { var count = root.querySelectorAll('[data-clause-item][data-clause-state="' + key + '"]').length; return count ? count + " " + labels[key] : ""; }).filter(Boolean);
    root.querySelector("[data-clause-summary]").textContent = parts.join(" · ");
  }

  function closeClauseMenus(scope, except) {
    if (!scope) return;
    scope.querySelectorAll("[data-clause-select]").forEach(function (select) {
      if (select === except) return;
      select.querySelector("[data-clause-menu]").hidden = true;
      select.querySelector("[data-clause-toggle]").setAttribute("aria-expanded", "false");
    });
  }

  function closeConditionMenus(scope, except) {
    if (!scope) return;
    scope.querySelectorAll("[data-condition-select]").forEach(function (select) {
      if (select === except) return;
      select.querySelector("[data-condition-menu]").hidden = true;
      select.querySelector("[data-condition-toggle]").setAttribute("aria-expanded", "false");
    });
  }

  function updateCapacity(root, message) {
    if (!root) return;
    var overloaded = false; var tasks = Array.from(root.querySelectorAll("[data-capacity-task]")); var selectedId = root.dataset.capacitySelected; var selectedTask = selectedId ? root.querySelector('[data-capacity-task="' + selectedId + '"]') : null;
    root.querySelectorAll("[data-capacity-lane]").forEach(function (lane) {
      var max = Number(lane.dataset.capacityMax); var laneId = lane.dataset.capacityLane; var used = tasks.filter(function (task) { return task.dataset.capacityTeam === laneId; }).reduce(function (sum, task) { return sum + Number(task.dataset.capacityHours); }, 0);
      var status = lane.querySelector("[data-capacity-status]"); var difference = max - used;
      status.textContent = difference >= 0 ? difference + " h prosto" : "manjka " + Math.abs(difference) + " h";
      lane.setAttribute("aria-label", lane.querySelector(".uj-card-capacity__team b").textContent + ": " + used + " od " + max + " ur zasedenih"); lane.classList.toggle("is-over", difference < 0); lane.querySelector("[data-capacity-bar] em").style.width = Math.min(100, used / max * 100) + "%"; overloaded = overloaded || difference < 0;
      var target = lane.querySelector("[data-capacity-target]"); var isCurrent = Boolean(selectedTask && selectedTask.dataset.capacityTeam === laneId); target.disabled = isCurrent; target.textContent = isCurrent ? "Tu je" : "Izberi";
    });
    var summary = root.querySelector("[data-capacity-summary]"); summary.textContent = message || (overloaded ? "Ena ekipa ima premalo prostih ur." : "Izberite delo, nato ekipo."); summary.classList.toggle("is-bad", overloaded || Boolean(message && message.indexOf("Ni dovolj") === 0));
  }

  function updateMatching(root, message, isError) {
    if (!root) return;
    var claims = Array.from(root.querySelectorAll("[data-match-claim]")); var matchedCount = 0;
    claims.forEach(function (claim) { var matched = Boolean(claim.dataset.matchedTo); if (matched) matchedCount += 1; claim.classList.toggle("is-matched", matched); claim.disabled = matched; claim.setAttribute("aria-disabled", String(matched)); claim.title = matched ? "Pogoj je že povezan." : ""; claim.setAttribute("aria-label", claim.dataset.matchLabel + (matched ? ", že povezano" : "")); if (matched) { claim.classList.remove("is-selected"); claim.setAttribute("aria-pressed", "false"); } });
    root.querySelectorAll("[data-match-evidence]").forEach(function (evidence) { var matched = claims.some(function (claim) { return claim.dataset.matchedTo === evidence.dataset.matchEvidence; }); evidence.classList.toggle("is-matched", matched); evidence.disabled = matched; evidence.setAttribute("aria-disabled", String(matched)); evidence.title = matched ? "Dokazilo je že povezano." : ""; evidence.setAttribute("aria-label", evidence.dataset.matchLabel + (matched ? ", že povezano" : "")); if (matched) { evidence.classList.remove("is-selected", "is-wrong"); evidence.setAttribute("aria-pressed", "false"); } });
    var summary = root.querySelector("[data-match-summary]");
    summary.textContent = message || (matchedCount === 3 ? "3 od 3 povezanih. Končano." : matchedCount ? matchedCount + " od 3 povezanih." : "Izberite pogoj, nato pravo dokazilo.");
    summary.classList.toggle("is-bad", Boolean(isError)); summary.classList.toggle("is-good", !isError && matchedCount > 0);
  }

  function updateConditionBuilder(root) {
    if (!root) return;
    var fieldLabels = { zamuda:"zamuda", znesek:"znesek", odziv:"odziv" }; var operatorLabels = { nad:"več kot", pod:"manj kot", enako:"točno" }; var fieldConfig = { zamuda:{ unit:"dni", max:365, step:1 }, znesek:{ unit:"€", max:50000, step:100 }, odziv:{ unit:"dni", max:90, step:1 } };
    var parts = Array.from(root.querySelectorAll("[data-condition-row]")).map(function (row) {
      var field = row.querySelector("[data-condition-field]").value; var operator = row.querySelector("[data-condition-operator]").value; var input = row.querySelector("[data-condition-value]");
      var config = fieldConfig[field]; input.max = String(config.max); input.step = String(config.step); var value = clampNumber(input.value, input.min, input.max, 0); input.value = String(value); row.querySelector("[data-condition-unit]").textContent = config.unit;
      return fieldLabels[field] + " " + operatorLabels[operator] + " " + (field === "znesek" ? formatWholeEuro(value) : value.toLocaleString("sl-SI") + " " + config.unit);
    });
    var join = root.querySelector("[data-condition-join].is-selected").dataset.conditionJoin === "all" ? " in " : " ali ";
    root.querySelector("[data-condition-summary]").textContent = "Ko velja: " + parts.join(join) + ". Potem: " + root.querySelector("[data-condition-action]").value + ".";
  }

  function updateProvenance(root, source) {
    if (!root) return;
    if (source && source.matches("[data-provenance-age-range], [data-provenance-age-number]")) {
      var ageRange = root.querySelector("[data-provenance-age-range]"); var ageNumber = root.querySelector("[data-provenance-age-number]");
      var ageValue = clampNumber(source.value, source.min, source.max, 0); ageRange.value = String(ageValue); ageNumber.value = String(ageValue);
    }
    var age = Number(root.querySelector("[data-provenance-age-range]").value); var selected = root.querySelector("[data-provenance-source].is-selected"); var conflict = root.querySelector('[data-provenance-answer="conflict"]').classList.contains("is-selected");
    root.querySelector("[data-provenance-age-range]").setAttribute("aria-valuetext", age + (age === 1 ? " dan" : " dni"));
    var summary = root.querySelector("[data-provenance-summary]");
    if (conflict) summary.textContent = "Podatki se ne ujemajo — najprej jih preverite.";
    else if (age > 30) summary.textContent = "Podatek je star — pred uporabo ga znova preverite.";
    else if (selected.dataset.provenanceSource === "note") summary.textContent = "Podatek je v interni opombi — preverite še izvirni dokument.";
    else if (age <= 7) summary.textContent = "Podatek je svež in potrjen — lahko mu zaupate.";
    else summary.textContent = "Podatek je potrjen, vendar preverite, ali še velja.";
    summary.classList.toggle("is-good", !conflict && age <= 7 && selected.dataset.provenanceSource !== "note"); summary.classList.toggle("is-bad", conflict || age > 30);
  }

  function updateBreakeven(root, source) {
    if (!root) return;
    var range = root.querySelector("[data-breakeven-range]"); var number = root.querySelector("[data-breakeven-number]");
    var priceInput = root.querySelector("[data-breakeven-price]"); var variableInput = root.querySelector("[data-breakeven-variable]"); var fixedInput = root.querySelector("[data-breakeven-fixed]");
    var price = Math.round(clampNumber(priceInput.value, priceInput.min, priceInput.max, 180)); var variable = Math.round(clampNumber(variableInput.value, variableInput.min, variableInput.max, 120)); var fixed = Math.round(clampNumber(fixedInput.value, fixedInput.min, fixedInput.max, 3600));
    priceInput.value = String(price); variableInput.value = String(variable); fixedInput.value = String(fixed); root.dataset.price = String(price); root.dataset.variable = String(variable); root.dataset.fixed = String(fixed);
    var margin = price - variable; var possible = margin > 0; var exactThreshold = possible ? fixed / margin : Infinity; var threshold = possible ? Math.ceil(exactThreshold) : null;
    var max = possible ? Math.max(120, Math.min(1000, Math.ceil(threshold * 1.25 / 10) * 10)) : 120; range.max = String(max); number.max = String(max); root.dataset.max = String(max);
    var quantitySource = source && source.matches("[data-breakeven-range], [data-breakeven-number]") ? source : range; var quantity = Math.round(clampNumber(quantitySource.value, 0, max, 0)); range.value = String(quantity); number.value = String(quantity);
    var result = margin * quantity - fixed; var thresholdOutput = root.querySelector("[data-breakeven-threshold]"); var currentOutput = root.querySelector("[data-breakeven-current]"); var currentResult = root.querySelector("[data-breakeven-current-result]"); var target = root.querySelector("[data-breakeven-target]");
    thresholdOutput.textContent = possible ? threshold + (threshold === 1 ? " posel" : threshold === 2 ? " posla" : threshold === 3 || threshold === 4 ? " posli" : " poslov") : "višja cena od stroška";
    currentOutput.textContent = "Pri " + quantity + (quantity === 1 ? " poslu" : " poslih"); currentResult.textContent = formatSignedEuro(result); target.textContent = possible ? "Cilj " + threshold : "Cilj ni dosegljiv"; target.hidden = !possible;
    var progress = root.querySelector("[data-breakeven-progress]"); progress.style.setProperty("--break-even-progress", quantity / max * 100 + "%"); progress.style.setProperty("--break-even-target", possible ? threshold / max * 100 + "%" : "100%");
    root.classList.toggle("is-under", !possible || quantity < threshold); root.classList.toggle("is-even", possible && quantity === threshold); root.classList.toggle("is-over", possible && quantity > threshold); root.classList.toggle("is-impossible", !possible);
    var xMin = 18; var xMax = 282; var yMin = 12; var yMax = 108; var highest = Math.max(1, price * max, fixed + variable * max) * 1.04; var xFor = function (value) { return xMin + value / max * (xMax - xMin); }; var yFor = function (value) { return yMax - value / highest * (yMax - yMin); };
    var revenueLine = root.querySelector("[data-breakeven-revenue-line]"); var costLine = root.querySelector("[data-breakeven-cost-line]"); var revenueEnd = yFor(price * max); var costStart = yFor(fixed); var costEnd = yFor(fixed + variable * max);
    [[revenueLine,"x1",xMin],[revenueLine,"y1",yMax],[revenueLine,"x2",xMax],[revenueLine,"y2",revenueEnd],[costLine,"x1",xMin],[costLine,"y1",costStart],[costLine,"x2",xMax],[costLine,"y2",costEnd]].forEach(function (row) { row[0].setAttribute(row[1], row[2].toFixed(2)); });
    var revenueLabel = root.querySelector("[data-breakeven-revenue-label]"); var costLabel = root.querySelector("[data-breakeven-cost-label]"); revenueLabel.setAttribute("y", String(Math.max(10, Math.min(112, revenueEnd - 5)))); costLabel.setAttribute("y", String(Math.max(10, Math.min(112, costEnd + 11))));
    var marker = root.querySelector("[data-breakeven-marker]"); var markerLabel = root.querySelector("[data-breakeven-marker-label]"); var guide = root.querySelector("[data-breakeven-guide]"); var currentX=xFor(quantity); var currentY=yFor(price*quantity); marker.setAttribute("cx",currentX.toFixed(2)); marker.setAttribute("cy",currentY.toFixed(2)); markerLabel.setAttribute("x",currentX.toFixed(2)); markerLabel.setAttribute("y",currentY.toFixed(2)); markerLabel.textContent=String(quantity); guide.setAttribute("x1",currentX.toFixed(2)); guide.setAttribute("x2",currentX.toFixed(2)); guide.setAttribute("y1",currentY.toFixed(2)); guide.setAttribute("y2",String(yMax));
    var targetMarker=root.querySelector("[data-breakeven-target-marker]"); var targetLabel=root.querySelector("[data-breakeven-target-label]"); var targetVisible=possible&&exactThreshold<=max; [targetMarker,targetLabel].forEach(function(item){item.hidden=!targetVisible;}); if(targetVisible){var targetX=xFor(exactThreshold);var targetY=yFor(price*exactThreshold);targetMarker.setAttribute("cx",targetX.toFixed(2));targetMarker.setAttribute("cy",targetY.toFixed(2));targetLabel.setAttribute("x",targetX.toFixed(2));targetLabel.setAttribute("y",String(Math.max(9,targetY-18)));targetLabel.textContent="kritje "+threshold;}
    root.querySelector("[data-breakeven-plot]").setAttribute("aria-label", possible ? "Trenutno " + quantity + " poslov; stroški so pokriti pri približno " + (Math.round(exactThreshold * 10) / 10).toLocaleString("sl-SI") + " poslih" : "Cena posla je prenizka, zato prihodki ne pokrijejo stroškov");
    var summary = root.querySelector("[data-breakeven-summary]");
    if (!possible) { summary.textContent = "Tako se stroški ne pokrijejo. Za posel morate zaračunati več, kot vas stane."; summary.classList.add("is-bad"); summary.classList.remove("is-good"); }
    else if (result < 0) { var missing = threshold - quantity; var missingText = missing === 1 ? "1 posel" : missing === 2 ? "2 posla" : missing === 3 || missing === 4 ? missing + " posli" : missing + " poslov"; summary.textContent = "Do pokritja manjka " + missingText + ". Zdaj ste " + formatWholeEuro(Math.abs(result)) + " v minusu."; summary.classList.add("is-bad"); summary.classList.remove("is-good"); }
    else if (result === 0) { summary.textContent = "Vsi stroški so pokriti. Ste na ničli."; summary.classList.add("is-good"); summary.classList.remove("is-bad"); }
    else { summary.textContent = "Stroški so pokriti. Ostane vam " + formatWholeEuro(result) + "."; summary.classList.add("is-good"); summary.classList.remove("is-bad"); }
    range.setAttribute("aria-valuetext", quantity + (quantity === 1 ? " posel" : " poslov") + "; " + summary.textContent);
  }

  function updateExpectedValue(root, source) {
    if (!root) return;
    if (source) {
      var changed = source.closest("[data-expected-param]"); var range = changed.querySelector("[data-expected-range]"); var number = changed.querySelector("[data-expected-number]");
      var value = clampNumber(source.value, source.min, source.max, 0); range.value = String(value); number.value = String(value);
    }
    var values = {};
    root.querySelectorAll("[data-expected-param]").forEach(function (row) {
      var key = row.dataset.expectedParam; var range = row.querySelector("[data-expected-range]"); var number = row.querySelector("[data-expected-number]"); var value = clampNumber(range.value, range.min, range.max, 0); var unit = key === "cost" ? "€" : "%";
      range.value = String(value); number.value = String(value); values[key] = value; row.querySelector("[data-expected-output]").textContent = value.toLocaleString("sl-SI") + " " + unit; range.setAttribute("aria-valuetext", value.toLocaleString("sl-SI") + " " + unit + (key === "cost" ? "; višji strošek je slabši" : ""));
    });
    var selected = root.querySelector("[data-expected-action].is-selected"); selected.dataset.probability = String(values.probability); selected.dataset.recovery = String(values.recovery); selected.dataset.cost = String(values.cost);
    var debt = Number(root.dataset.debt); var actionRows = Array.from(root.querySelectorAll("[data-expected-action]")); var scored = actionRows.map(function (button) { var result = debt * Number(button.dataset.recovery) / 100 * Number(button.dataset.probability) / 100 - Number(button.dataset.cost); button.querySelector("[data-expected-action-result]").textContent = "pribl. " + formatWholeEuro(result); return { button:button, result:result }; });
    var current = scored.find(function (item) { return item.button === selected; }); var best = scored.reduce(function (top, item) { return item.result > top.result ? item : top; }, scored[0]); var action = selected.dataset.expectedLabel;
    root.querySelector("[data-expected-summary]").textContent = action + ": pričakujete približno " + formatWholeEuro(current.result) + (best.button === selected ? " · trenutno največ." : " · največ kaže " + best.button.dataset.expectedLabel + " (" + formatWholeEuro(best.result) + ").");
  }

  function applyExpectedAction(root, button) {
    root.querySelectorAll("[data-expected-action]").forEach(function (item) { item.classList.toggle("is-selected", item === button); item.setAttribute("aria-pressed", String(item === button)); });
    ["probability","recovery","cost"].forEach(function (key) { var row = root.querySelector('[data-expected-param="' + key + '"]'); row.querySelector("[data-expected-range]").value = button.dataset[key]; row.querySelector("[data-expected-number]").value = button.dataset[key]; });
    updateExpectedValue(root);
  }

  function updateCascade(root) {
    if (!root) return;
    var eventButton = root.querySelector("[data-cascade-event].is-selected");
    var selectedGuard = root.querySelector("[data-cascade-guard].is-selected"); var selectedOutcome = root.querySelector("[data-cascade-outcome].is-selected");
    var guardGroup = root.querySelector(".uj-card-cascade__guards"); var outcomeGroup = root.querySelector(".uj-card-cascade__outcomes"); var summary = root.querySelector("[data-cascade-summary]");
    if (!eventButton) {
      guardGroup.classList.add("is-locked"); outcomeGroup.classList.add("is-locked");
      root.querySelectorAll("[data-cascade-guard], [data-cascade-outcome]").forEach(function (button) { button.disabled = true; });
      summary.textContent = "Začnite zgoraj: izberite težavo."; summary.classList.remove("is-good", "is-bad"); return;
    }
    var actions = eventButton.dataset.cascadeActions.split("|"); var outcomes = eventButton.dataset.cascadeOutcomes.split("|");
    root.querySelectorAll("[data-cascade-guard]").forEach(function (guard) { var index = Number(guard.dataset.cascadeGuard) - 1; guard.querySelector("[data-cascade-action]").textContent = actions[index]; guard.setAttribute("aria-label", actions[index]); });
    root.querySelectorAll("[data-cascade-outcome]").forEach(function (outcome) { var index = Number(outcome.dataset.cascadeOutcome) - 1; outcome.textContent = outcomes[index]; outcome.setAttribute("aria-label", outcomes[index]); });
    guardGroup.classList.remove("is-locked"); root.querySelectorAll("[data-cascade-guard]").forEach(function (button) { button.disabled = false; });
    outcomeGroup.classList.toggle("is-locked", !selectedGuard); root.querySelectorAll("[data-cascade-outcome]").forEach(function (button) { button.disabled = !selectedGuard; });
    if (!selectedGuard) { summary.textContent = "Zdaj izberite, kaj boste naredili najprej."; summary.classList.remove("is-good", "is-bad"); }
    else if (!selectedOutcome) { summary.textContent = "Če prvi ukrep ne pomaga, izberite rezervni korak."; summary.classList.remove("is-good", "is-bad"); }
    else { summary.textContent = "Vaš načrt: " + selectedGuard.querySelector("[data-cascade-action]").textContent.trim() + ". Če ne pomaga: " + selectedOutcome.textContent.trim() + "."; summary.classList.add("is-good"); summary.classList.remove("is-bad"); }
  }

  function resetTemplateCard(button) {
    var card = button.closest("[data-template-card]"); if (!card) return;
    var template = TEMPLATES.find(function (item) { return item.id === card.dataset.templateCard; }); var body = card.querySelector(".uj-answer-card__body");
    if (template && body) { body.innerHTML = renderTemplateBody(template).html; var nextReset = card.querySelector("[data-card-reset]"); if (nextReset) nextReset.focus({ preventScroll:true }); }
  }

  function bind(container) {
    if (!container || container.dataset.atenaTemplatesBound === "true") return;
    container.dataset.atenaTemplatesBound = "true";
    container.addEventListener("click", function (event) {
      closeClauseMenus(container, event.target.closest("[data-clause-select]"));
      closeConditionMenus(container, event.target.closest("[data-condition-select]"));
      var toggle = event.target.closest("[data-card-toggle]");
      if (toggle) {
        var card = toggle.closest("[data-answer-card]");
        var content = card && card.querySelector("[data-card-content]");
        var expanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!expanded));
        toggle.setAttribute("aria-label", expanded ? "Razširi kartico" : "Skrči kartico");
        if (content) content.hidden = expanded;
        card.classList.toggle("is-collapsed", expanded);
        return;
      }
      var choice = event.target.closest("[data-card-choice]");
      if (choice) {
        var group = choice.closest("[data-card-choice-group]");
        if (group && group.hasAttribute("data-multiple")) choice.classList.toggle("is-selected");
        else if (group) group.querySelectorAll("[data-card-choice]").forEach(function (button) { button.classList.toggle("is-selected", button === choice); button.setAttribute("aria-pressed", String(button === choice)); });
        choice.setAttribute("aria-pressed", String(choice.classList.contains("is-selected")));
        var card = choice.closest("[data-answer-card]");
        var other = card && card.querySelector(".uj-card-other");
        if (other) other.hidden = choice.dataset.cardChoice !== "other";
        if (choice.closest('[data-template-card="znesek-ali-odstotek"]')) {
          var unit = choice.closest("[data-answer-card]").querySelector("[data-money-unit]");
          if (unit) unit.textContent = choice.dataset.cardChoice === "percent" ? "%" : "€";
        }
        var rangeModeGroup = choice.closest("[data-range-mode-group]");
        if (rangeModeGroup) applyRangeMode(card, choice.dataset.cardChoice);
        var warrantyGroup = choice.closest("[data-warranty-choice]");
        if (warrantyGroup) {
          var warrantyPanel = card.querySelector("[data-warranty-panel]");
          if (warrantyPanel) warrantyPanel.hidden = choice.dataset.cardChoice !== "yes";
        }
        var decisionPath = choice.closest("[data-decision-path]");
        if (decisionPath) card.querySelectorAll("[data-decision-panel]").forEach(function (panel) { panel.hidden = panel.dataset.decisionPanel !== choice.dataset.cardChoice; });
        var numberGroup = choice.closest("[data-number-choices]");
        if (numberGroup) {
          var customNumber = numberGroup.querySelector("[data-number-custom]");
          if (customNumber) customNumber.value = "";
          updateNumberChoiceConfirmation(numberGroup, choice.dataset.cardChoice);
          if (numberGroup.hasAttribute("data-range-presets")) {
            var presetRange = choice.closest("[data-answer-card]").querySelector('input[type="range"]');
            if (presetRange) presetRange.value = choice.dataset.cardChoice;
            updateRangeVisual(card, presetRange);
          }
        }
        return;
      }
      var step = event.target.closest("[data-step]");
      if (step) {
        var input = step.closest("[data-card-stepper]").querySelector('input[type="number"]');
        input.value = String(Math.max(Number(input.min) || 0, (Number(input.value) || 0) + Number(step.dataset.step)));
        return;
      }
      var bulletStep = event.target.closest("[data-bullet-step]");
      if (bulletStep) {
        var bulletRoot = bulletStep.closest("[data-bullet-card]");
        var bulletInput = bulletRoot.querySelector("[data-bullet-input]");
        var nextBulletValue = Math.round(((Number(bulletInput.value) || 0) + Number(bulletStep.dataset.bulletStep)) * 10) / 10;
        bulletInput.value = String(Math.max(Number(bulletInput.min), Math.min(Number(bulletInput.max), nextBulletValue)));
        updateBulletCard(bulletRoot, true);
        return;
      }
      var scoreStep = event.target.closest("[data-score-step]");
      if (scoreStep) {
        var scoreRoot = scoreStep.closest("[data-score-card]");
        var scoreInput = scoreStep.closest("[data-score-row]").querySelector('input[type="number"]');
        scoreInput.value = String(Math.max(Number(scoreInput.min), Math.min(Number(scoreInput.max), Number(scoreInput.value) + Number(scoreStep.dataset.scoreStep))));
        updateScoreCard(scoreRoot);
        return;
      }
      var timelineStep = event.target.closest("[data-timeline-step]");
      if (timelineStep) {
        var timelineSteps = Array.from(timelineStep.closest("[data-card-timeline]").querySelectorAll("[data-timeline-step]"));
        var selectedIndex = timelineSteps.indexOf(timelineStep);
        timelineSteps.forEach(function (button, index) {
          button.classList.toggle("is-done", index < selectedIndex);
          button.classList.toggle("is-current", index === selectedIndex);
          button.setAttribute("aria-pressed", String(index <= selectedIndex));
          var marker = button.querySelector("i");
          marker.innerHTML = index < selectedIndex ? ICONS.check : String(index + 1);
        });
        return;
      }
      var priorityMove = event.target.closest("[data-priority-move]");
      if (priorityMove) {
        var priorityList = priorityMove.closest("[data-priority-list]");
        var priorityItem = priorityMove.closest("li");
        var direction = Number(priorityMove.dataset.priorityMove);
        if (direction < 0 && priorityItem.previousElementSibling) priorityList.insertBefore(priorityItem, priorityItem.previousElementSibling);
        if (direction > 0 && priorityItem.nextElementSibling) priorityList.insertBefore(priorityItem.nextElementSibling, priorityItem);
        Array.from(priorityList.children).forEach(function (item, index) { item.querySelector("b").textContent = String(index + 1); });
        return;
      }
      var slot = event.target.closest("[data-slot]");
      if (slot) {
        var slotGrid = slot.closest("[data-slot-grid]");
        slot.classList.toggle("is-selected");
        slot.setAttribute("aria-pressed", String(slot.classList.contains("is-selected")));
        var slotCount = slotGrid.querySelectorAll("[data-slot].is-selected").length;
        slotGrid.querySelector("[data-slot-count]").textContent = slotCount + (slotCount === 1 ? " termin" : slotCount === 2 ? " termina" : " termini");
        return;
      }
      var calendarShift = event.target.closest("[data-calendar-shift]");
      if (calendarShift) {
        var calendar = calendarShift.closest("[data-mini-calendar]");
        var months = ["Avgust 2026", "September 2026", "Oktober 2026"];
        var monthIndex = Math.max(-1, Math.min(1, Number(calendar.dataset.monthIndex) + Number(calendarShift.dataset.calendarShift)));
        calendar.dataset.monthIndex = String(monthIndex);
        calendar.querySelector("[data-calendar-month]").textContent = months[monthIndex + 1];
        return;
      }
      var calendarDay = event.target.closest("[data-calendar-day]");
      if (calendarDay) {
        var dayCalendar = calendarDay.closest("[data-mini-calendar]");
        dayCalendar.querySelectorAll("[data-calendar-day]").forEach(function (button) { button.classList.toggle("is-selected", button === calendarDay); button.setAttribute("aria-pressed", String(button === calendarDay)); });
        dayCalendar.querySelector("[data-calendar-output]").textContent = calendarDay.dataset.calendarDay + ". " + dayCalendar.querySelector("[data-calendar-month]").textContent.toLocaleLowerCase("sl-SI");
        return;
      }
      var checkItem = event.target.closest("[data-check-item]");
      if (checkItem) {
        var checklist = checkItem.closest("[data-checklist]");
        checkItem.classList.toggle("is-done"); checkItem.setAttribute("aria-pressed", String(checkItem.classList.contains("is-done")));
        var checked = checklist.querySelectorAll("[data-check-item].is-done").length;
        var allChecks = checklist.querySelectorAll("[data-check-item]").length;
        checklist.querySelector("[data-check-output]").textContent = checked + " od " + allChecks;
        checklist.querySelector("[data-check-progress]").style.width = (checked / allChecks * 100) + "%";
        return;
      }
      var riskCell = event.target.closest("[data-risk-score]");
      if (riskCell) {
        var riskRoot = riskCell.closest("[data-risk-matrix]");
        riskRoot.querySelectorAll("[data-risk-score]").forEach(function (button) { button.classList.toggle("is-selected", button === riskCell); });
        var riskScore = Number(riskCell.dataset.riskScore);
        riskRoot.querySelector("[data-risk-output]").textContent = riskScore <= 2 ? "nizko" : riskScore <= 4 ? "srednje" : riskScore <= 6 ? "povišano" : "visoko";
        return;
      }
      var tagOption = event.target.closest("[data-tag-option]");
      if (tagOption) {
        var tagRoot = tagOption.closest("[data-tag-picker]");
        tagOption.classList.toggle("is-selected"); tagOption.setAttribute("aria-pressed", String(tagOption.classList.contains("is-selected")));
        if (tagOption.classList.contains("is-selected")) addSelectedTag(tagRoot, tagOption.dataset.tagOption);
        else {
          var selectedTag = Array.from(tagRoot.querySelectorAll("[data-tag-value]")).find(function (tag) { return tag.dataset.tagValue === tagOption.dataset.tagOption; });
          if (selectedTag) selectedTag.remove();
        }
        return;
      }
      var tagRemove = event.target.closest("[data-tag-remove]");
      if (tagRemove) {
        var removeRoot = tagRemove.closest("[data-tag-picker]");
        var removedValue = tagRemove.parentElement.dataset.tagValue;
        tagRemove.parentElement.remove();
        var bankOption = Array.from(removeRoot.querySelectorAll("[data-tag-option]")).find(function (button) { return button.dataset.tagOption === removedValue; });
        if (bankOption) { bankOption.classList.remove("is-selected"); bankOption.setAttribute("aria-pressed", "false"); }
        return;
      }
      var tagAdd = event.target.closest("[data-tag-add]");
      if (tagAdd) {
        var addRoot = tagAdd.closest("[data-tag-picker]");
        var tagInput = addRoot.querySelector('input[type="text"]');
        var tagValue = tagInput.value.trim();
        addSelectedTag(addRoot, tagValue); tagInput.value = "";
        return;
      }
      var waterfallStep = event.target.closest("[data-waterfall-step]");
      if (waterfallStep) {
        var waterfall = waterfallStep.closest("[data-waterfall]");
        waterfall.querySelectorAll("[data-waterfall-step]").forEach(function (button) { button.classList.toggle("is-selected", button === waterfallStep); button.setAttribute("aria-pressed", String(button === waterfallStep)); });
        waterfall.querySelector("[data-waterfall-detail]").textContent = waterfallStep.dataset.detail;
        return;
      }
      var priceBridgeStep = event.target.closest("[data-price-bridge-step]");
      if (priceBridgeStep) {
        var priceBridge = priceBridgeStep.closest("[data-price-bridge]");
        priceBridge.querySelectorAll("[data-price-bridge-step]").forEach(function (button) { button.classList.toggle("is-selected", button === priceBridgeStep); button.setAttribute("aria-pressed", String(button === priceBridgeStep)); });
        priceBridge.querySelector("[data-price-bridge-detail]").textContent = priceBridgeStep.dataset.detail;
        return;
      }
      var trendPeriod = event.target.closest("[data-trend-period]");
      if (trendPeriod) {
        var trendRoot = trendPeriod.closest("[data-trend-card]");
        trendRoot.querySelectorAll("[data-trend-period]").forEach(function (button) { button.classList.toggle("is-selected", button === trendPeriod); button.setAttribute("aria-pressed", String(button === trendPeriod)); });
        applyTrendPeriod(trendRoot, trendPeriod.dataset.trendPeriod);
        return;
      }
      var changeRow = event.target.closest("[data-change-row]");
      if (changeRow) {
        var changeRoot = changeRow.closest("[data-change-card]");
        selectChangeRow(changeRoot, changeRow);
        return;
      }
      var thresholdFilter = event.target.closest("[data-threshold-filter]");
      if (thresholdFilter) {
        var thresholdRoot = thresholdFilter.closest("[data-threshold-card]");
        thresholdRoot.querySelectorAll("[data-threshold-filter]").forEach(function (button) { button.classList.toggle("is-selected", button === thresholdFilter); button.setAttribute("aria-pressed", String(button === thresholdFilter)); });
        var breachesOnly = thresholdFilter.dataset.thresholdFilter === "breach";
        thresholdRoot.querySelectorAll("[data-threshold-point]").forEach(function (button) { button.hidden = breachesOnly && button.dataset.breach !== "true"; });
        var selectedThresholdPoint = thresholdRoot.querySelector("[data-threshold-point].is-selected");
        if (breachesOnly && (!selectedThresholdPoint || selectedThresholdPoint.dataset.breach !== "true")) {
          var breachPoints = Array.from(thresholdRoot.querySelectorAll('[data-threshold-point][data-breach="true"]'));
          selectThresholdPoint(thresholdRoot, breachPoints[breachPoints.length - 1]);
        }
        return;
      }
      var thresholdPoint = event.target.closest("[data-threshold-point]");
      if (thresholdPoint) {
        var thresholdPointRoot = thresholdPoint.closest("[data-threshold-card]");
        selectThresholdPoint(thresholdPointRoot, thresholdPoint);
        return;
      }
      var treeBranch = event.target.closest("[data-tree-branch]");
      if (treeBranch) {
        var treeRoot = treeBranch.closest("[data-tree-card]");
        treeRoot.querySelectorAll("[data-tree-panel]").forEach(function (panel) { panel.hidden = panel.dataset.treePanel !== treeBranch.dataset.treeBranch; });
        treeRoot.dataset.treeCurrentBranch = treeBranch.dataset.treeBranch;
        treeRoot.querySelector("[data-tree-back]").hidden = false;
        treeRoot.querySelector("[data-tree-crumb]").textContent = "Vse storitve / " + treeBranch.dataset.treeBranch;
        var treeBranchPanel = treeRoot.querySelector('[data-tree-panel="' + treeBranch.dataset.treeBranch + '"]');
        if (treeBranchPanel && treeBranchPanel.querySelector("button")) treeBranchPanel.querySelector("button").focus();
        return;
      }
      var treeBack = event.target.closest("[data-tree-back]");
      if (treeBack) {
        var treeBackRoot = treeBack.closest("[data-tree-card]");
        var previousTreeBranch = treeBackRoot.dataset.treeCurrentBranch;
        treeBackRoot.querySelector('[data-tree-panel="root"]').hidden = false;
        treeBackRoot.querySelectorAll('[data-tree-panel]:not([data-tree-panel="root"])').forEach(function (panel) { panel.hidden = true; });
        delete treeBackRoot.dataset.treeCurrentBranch;
        treeBack.hidden = true;
        treeBackRoot.querySelector("[data-tree-crumb]").textContent = "Vse storitve";
        var previousTreeButton = previousTreeBranch ? treeBackRoot.querySelector('[data-tree-branch="' + previousTreeBranch + '"]') : null;
        if (previousTreeButton) previousTreeButton.focus();
        return;
      }
      var treeSelect = event.target.closest("[data-tree-select]");
      if (treeSelect) {
        var treeSelectRoot = treeSelect.closest("[data-tree-card]");
        treeSelectRoot.querySelector("[data-tree-output]").textContent = (treeSelectRoot.dataset.treeCurrentBranch ? treeSelectRoot.dataset.treeCurrentBranch + " / " : "") + treeSelect.dataset.treeSelect;
        return;
      }
      var comboOption = event.target.closest("[data-combo-option]");
      if (comboOption) {
        var comboRoot = comboOption.closest("[data-combobox]");
        var comboSelected = comboRoot.querySelector("[data-combo-selected]");
        var comboInput = comboRoot.querySelector("[data-combo-input]");
        comboRoot.querySelectorAll("[data-combo-option]").forEach(function (button) { button.setAttribute("aria-selected", String(button === comboOption)); });
        comboSelected.hidden = false; comboSelected.querySelector("b").textContent = comboOption.dataset.comboOption;
        comboInput.value = comboOption.dataset.comboOption;
        comboInput.setAttribute("aria-expanded", "false");
        comboRoot.querySelector("[data-combo-options]").hidden = true;
        comboRoot.querySelector("[data-combo-manual]").hidden = true;
        comboInput.focus();
        return;
      }
      var comboManual = event.target.closest("[data-combo-manual]");
      if (comboManual) {
        var comboManualRoot = comboManual.closest("[data-combobox]");
        var comboManualInput = comboManualRoot.querySelector("[data-combo-input]");
        var comboManualValue = comboManualInput.value.trim();
        if (!comboManualValue) { comboManualInput.focus(); return; }
        comboManualRoot.querySelector("[data-combo-selected]").hidden = false;
        comboManualRoot.querySelector("[data-combo-selected] b").textContent = comboManualValue;
        comboManualRoot.querySelector("[data-combo-options]").hidden = true;
        comboManualRoot.querySelector("[data-combo-manual]").hidden = true;
        comboManualInput.setAttribute("aria-expanded", "false");
        comboManualInput.focus();
        return;
      }
      var comboClear = event.target.closest("[data-combo-clear]");
      if (comboClear) {
        var comboClearRoot = comboClear.closest("[data-combobox]");
        var comboClearInput = comboClearRoot.querySelector("[data-combo-input]");
        comboClearRoot.querySelector("[data-combo-selected]").hidden = true;
        comboClearInput.value = "";
        comboClearInput.setAttribute("aria-expanded", "true");
        comboClearRoot.querySelector("[data-combo-options]").hidden = false;
        comboClearRoot.querySelector("[data-combo-manual]").hidden = true;
        comboClearRoot.querySelector("[data-combo-empty]").hidden = true;
        comboClearRoot.querySelectorAll("[data-combo-option]").forEach(function (button) { button.hidden = false; button.setAttribute("aria-selected", "false"); });
        comboClearInput.focus();
        return;
      }
      var recurrenceStep = event.target.closest("[data-recurrence-step]");
      if (recurrenceStep) {
        var recurrenceRoot = recurrenceStep.closest("[data-recurrence]");
        var recurrenceInput = recurrenceRoot.querySelector("[data-recurrence-count]");
        recurrenceInput.value = String(Math.max(Number(recurrenceInput.min), Math.min(Number(recurrenceInput.max), Number(recurrenceInput.value) + Number(recurrenceStep.dataset.recurrenceStep))));
        recurrenceText(recurrenceRoot);
        return;
      }
      var recurrenceDay = event.target.closest("[data-recurrence-day]");
      if (recurrenceDay) {
        var recurrenceDayRoot = recurrenceDay.closest("[data-recurrence]");
        recurrenceDay.classList.toggle("is-selected"); recurrenceDay.setAttribute("aria-pressed", String(recurrenceDay.classList.contains("is-selected")));
        recurrenceText(recurrenceDayRoot);
        return;
      }
      var relativeStep = event.target.closest("[data-relative-step]");
      if (relativeStep) {
        var relativeRoot = relativeStep.closest("[data-relative-deadline]");
        var relativeInput = relativeRoot.querySelector("[data-relative-days]");
        relativeInput.value = String(Math.max(Number(relativeInput.min), Math.min(Number(relativeInput.max), Number(relativeInput.value) + Number(relativeStep.dataset.relativeStep))));
        relativeDeadlineText(relativeRoot);
        return;
      }
      var relativeMode = event.target.closest("[data-relative-mode]");
      if (relativeMode) {
        var relativeModeRoot = relativeMode.closest("[data-relative-deadline]");
        relativeModeRoot.querySelectorAll("[data-relative-mode]").forEach(function (button) { button.classList.toggle("is-selected", button === relativeMode); button.setAttribute("aria-pressed", String(button === relativeMode)); });
        relativeDeadlineText(relativeModeRoot);
        return;
      }
      var installmentStep = event.target.closest("[data-installment-step]");
      if (installmentStep) {
        var installmentRoot = installmentStep.closest("[data-installments]");
        var installmentInput = installmentRoot.querySelector("[data-installment-count]");
        installmentInput.value = String(Number(installmentInput.value) + Number(installmentStep.dataset.installmentStep));
        updateInstallments(installmentRoot, true);
        return;
      }
      var inclusionChoice = event.target.closest("[data-inclusion-choice]");
      if (inclusionChoice) {
        var inclusionRoot = inclusionChoice.closest("[data-inclusion-card]");
        var inclusionRow = inclusionChoice.closest("[data-inclusion-row]");
        inclusionRow.querySelectorAll("[data-inclusion-choice]").forEach(function (button) { button.classList.toggle("is-selected", button === inclusionChoice); button.setAttribute("aria-pressed", String(button === inclusionChoice)); });
        updateInclusionSummary(inclusionRoot);
        return;
      }
      var pairReset = event.target.closest("[data-pair-reset]");
      if (pairReset) {
        var pairResetRoot = pairReset.closest("[data-pairwise]");
        var resetPairings = JSON.parse(decodeURIComponent(pairResetRoot.dataset.pairings));
        var firstPair = resetPairings[0];
        pairResetRoot.dataset.pairRound = "0";
        pairResetRoot.dataset.pairResults = "";
        pairResetRoot.querySelector("[data-pair-counter]").textContent = "1 od " + resetPairings.length;
        pairResetRoot.querySelector("[data-pair-progress]").style.width = (100 / resetPairings.length) + "%";
        pairResetRoot.querySelector(".uj-card-pairwise__options").hidden = false;
        pairResetRoot.querySelectorAll("[data-pair-choice]").forEach(function (button, index) { button.dataset.pairChoice = firstPair[index + 1]; });
        pairResetRoot.querySelector("[data-pair-prompt]").textContent = firstPair[0];
        pairResetRoot.querySelector("[data-pair-left]").textContent = firstPair[1];
        pairResetRoot.querySelector("[data-pair-right]").textContent = firstPair[2];
        pairResetRoot.querySelector("[data-pair-output]").textContent = "Izberite eno možnost";
        pairReset.hidden = true;
        pairResetRoot.querySelector("[data-pair-choice]").focus();
        return;
      }
      var pairChoice = event.target.closest("[data-pair-choice]");
      if (pairChoice) {
        var pairRoot = pairChoice.closest("[data-pairwise]");
        var pairings = JSON.parse(decodeURIComponent(pairRoot.dataset.pairings));
        var selectedPairs = pairRoot.dataset.pairResults ? pairRoot.dataset.pairResults.split("|") : [];
        selectedPairs.push(pairChoice.dataset.pairChoice);
        pairRoot.dataset.pairResults = selectedPairs.join("|");
        var pairRound = Number(pairRoot.dataset.pairRound) + 1;
        pairRoot.querySelector("[data-pair-output]").textContent = "Izbrano: " + pairChoice.dataset.pairChoice;
        if (pairRound < pairings.length) {
          pairRoot.dataset.pairRound = String(pairRound);
          pairRoot.querySelector("[data-pair-prompt]").textContent = pairings[pairRound][0];
          pairRoot.querySelector("[data-pair-left]").textContent = pairings[pairRound][1];
          pairRoot.querySelector("[data-pair-right]").textContent = pairings[pairRound][2];
          pairRoot.querySelectorAll("[data-pair-choice]").forEach(function (button, index) { button.dataset.pairChoice = pairings[pairRound][index + 1]; });
          pairRoot.querySelector("[data-pair-counter]").textContent = (pairRound + 1) + " od " + pairings.length;
          pairRoot.querySelector("[data-pair-progress]").style.width = ((pairRound + 1) / pairings.length * 100) + "%";
        } else {
          pairRoot.dataset.pairRound = String(pairings.length);
          pairRoot.querySelector("[data-pair-counter]").textContent = "Končano";
          pairRoot.querySelector("[data-pair-progress]").style.width = "100%";
          pairRoot.querySelector(".uj-card-pairwise__options").hidden = true;
          pairRoot.querySelector("[data-pair-output]").textContent = "Izbrane prednosti: " + selectedPairs.map(function (value, index) { return (index + 1) + ". " + value; }).join(" · ");
          var pairResetButton = pairRoot.querySelector("[data-pair-reset]");
          pairResetButton.hidden = false;
          pairResetButton.focus();
        }
        return;
      }
      var scenarioPreset = event.target.closest("[data-scenario-preset]");
      if (scenarioPreset) { applyScenarioPreset(scenarioPreset.closest("[data-scenario-mixer]"), scenarioPreset); return; }
      var scenarioDelete = event.target.closest("[data-scenario-delete]");
      if (scenarioDelete) { deleteScenarioPreset(scenarioDelete.closest("[data-scenario-mixer]"), scenarioDelete); return; }
      var scenarioSaveCriteria = event.target.closest("[data-scenario-save-criteria]");
      if (scenarioSaveCriteria) { saveScenarioCriteria(scenarioSaveCriteria.closest("[data-scenario-mixer]")); return; }
      var scenarioAdd = event.target.closest("[data-scenario-add]");
      if (scenarioAdd) { var addRoot = scenarioAdd.closest("[data-scenario-mixer]"); scenarioAdd.hidden = true; addRoot.querySelector("[data-scenario-new-form]").hidden = false; addRoot.querySelector("[data-scenario-name]").focus(); return; }
      var scenarioCreate = event.target.closest("[data-scenario-create]");
      if (scenarioCreate) { createScenarioPreset(scenarioCreate.closest("[data-scenario-mixer]")); return; }
      var scenarioCancel = event.target.closest("[data-scenario-cancel]");
      if (scenarioCancel) { closeScenarioForm(scenarioCancel.closest("[data-scenario-mixer]")); return; }
      var heatModeButton = event.target.closest("button[data-heat-mode]");
      if (heatModeButton) {
        var heatModeRoot = heatModeButton.closest("[data-heatmap]");
        var turnOffMode = heatModeButton.getAttribute("aria-pressed") === "true"; heatModeRoot.dataset.heatMode = turnOffMode ? "none" : heatModeButton.dataset.heatMode;
        heatModeRoot.querySelectorAll("button[data-heat-mode]").forEach(function (button) { var selected = !turnOffMode && button === heatModeButton; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); });
        updateHeatmap(heatModeRoot); return;
      }
      var heatCell = event.target.closest("[data-heat-cell]");
      if (heatCell) {
        var heatRoot = heatCell.closest("[data-heatmap]");
        var load = Number(heatCell.dataset.load); var nextLoad = heatRoot.dataset.heatMode === "remove" ? Math.max(0, load - 1) : Math.min(3, load + 1); heatCell.dataset.load = String(nextLoad);
        updateHeatmap(heatRoot); return;
      }
      var planePayment = event.target.closest("[data-plane-payment]");
      if (planePayment) {
        var planePaymentRoot = planePayment.closest("[data-plane]");
        planePaymentRoot.querySelectorAll("[data-plane-payment]").forEach(function (button) { var selected = button === planePayment; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); });
        updatePlane(planePaymentRoot, planePayment); return;
      }
      var dependencyNode = event.target.closest("[data-dependency-node]");
      if (dependencyNode) {
        var dependencyRoot=dependencyNode.closest("[data-dependencies]"); var current=dependencyRoot.querySelector("[data-dependency-node].is-current"); var label=dependencyNode.querySelector("b").textContent;
        if (dependencyNode.classList.contains("is-done")) { updateDependencies(dependencyRoot, label + " je že urejeno. Zdaj uredite in potrdite: " + (current ? current.querySelector("b").textContent : "naslednji korak") + "."); return; }
        if (dependencyNode === current) { dependencyNode.classList.add("is-done"); updateDependencies(dependencyRoot); return; }
        var actionLabels={ reminder:"pošljete opomin", handoff:"predate primer" }; updateDependencies(dependencyRoot, "Najprej uredite in potrdite: " + current.querySelector("b").textContent + ". Nato lahko " + (actionLabels[dependencyNode.dataset.depId] || "uredite " + label) + ".", current.dataset.depId); return;
      }
      var conditionToggle = event.target.closest("[data-condition-toggle]");
      if (conditionToggle) {
        var conditionSelectRoot = conditionToggle.closest("[data-condition-select]"); var conditionMenu = conditionSelectRoot.querySelector("[data-condition-menu]"); var conditionOpening = conditionMenu.hidden;
        closeConditionMenus(container, conditionSelectRoot); conditionMenu.hidden = !conditionOpening; conditionToggle.setAttribute("aria-expanded", String(conditionOpening)); return;
      }
      var conditionChoice = event.target.closest("button[data-condition-choice]");
      if (conditionChoice) {
        var conditionChoiceSelect = conditionChoice.closest("[data-condition-select]"); var conditionChoiceToggle = conditionChoiceSelect.querySelector("[data-condition-toggle]"); var conditionControl = conditionChoiceSelect.querySelector("[data-condition-field], [data-condition-operator], [data-condition-action]");
        conditionControl.value = conditionChoice.dataset.conditionChoice;
        conditionChoiceSelect.querySelectorAll("[data-condition-choice]").forEach(function (button) { var selected=button===conditionChoice; button.classList.toggle("is-selected",selected); button.setAttribute("aria-selected",String(selected)); });
        conditionChoiceToggle.querySelector("[data-condition-select-value]").textContent=conditionChoice.textContent.trim(); conditionChoiceToggle.setAttribute("aria-label",conditionChoiceToggle.dataset.conditionLabel+": "+conditionChoice.textContent.trim()); conditionChoiceSelect.querySelector("[data-condition-menu]").hidden=true; conditionChoiceToggle.setAttribute("aria-expanded","false"); conditionControl.dispatchEvent(new Event("change",{bubbles:true}));
        if (conditionControl.matches("[data-recurrence-unit], [data-recurrence-end]")) recurrenceText(conditionChoiceSelect.closest("[data-recurrence]"));
        if (conditionControl.matches("[data-relative-anchor]")) relativeDeadlineText(conditionChoiceSelect.closest("[data-relative-deadline]"));
        updateConditionBuilder(conditionChoice.closest("[data-condition-builder]")); conditionChoiceToggle.focus({preventScroll:true}); return;
      }
      var clauseToggle = event.target.closest("[data-clause-toggle]");
      if (clauseToggle) {
        var clauseSelect = clauseToggle.closest("[data-clause-select]"); var clauseMenu = clauseSelect.querySelector("[data-clause-menu]"); var opening = clauseMenu.hidden;
        closeClauseMenus(container, clauseSelect); clauseMenu.hidden = !opening; clauseToggle.setAttribute("aria-expanded", String(opening)); return;
      }
      var clauseChoice = event.target.closest("button[data-clause-choice]");
      if (clauseChoice) {
        var clauseChoiceItem = clauseChoice.closest("[data-clause-item]"); var clauseChoiceSelect = clauseChoice.closest("[data-clause-select]"); var clauseChoiceToggle = clauseChoiceSelect.querySelector("[data-clause-toggle]");
        clauseChoiceItem.dataset.clauseState = clauseChoice.dataset.clauseChoice;
        clauseChoiceSelect.querySelectorAll("[data-clause-choice]").forEach(function (button) { var selected = button === clauseChoice; button.classList.toggle("is-selected", selected); button.setAttribute("aria-selected", String(selected)); });
        clauseChoiceToggle.querySelector("[data-clause-value]").textContent = clauseChoice.textContent.trim(); clauseChoiceToggle.setAttribute("aria-label", clauseChoiceItem.querySelector(":scope > b").textContent + ": " + clauseChoice.textContent.trim());
        clauseChoiceSelect.querySelector("[data-clause-menu]").hidden = true; clauseChoiceToggle.setAttribute("aria-expanded", "false"); updateClauseGroups(clauseChoice.closest("[data-clause-grouping]")); clauseChoiceToggle.focus({ preventScroll:true }); return;
      }
      var clauseItem = event.target.closest("button[data-clause-item]");
      if (clauseItem) {
        var clauseRoot = clauseItem.closest("[data-clause-grouping]"); var order = ["accept","negotiate","review","reject"]; var labels = { accept:"Sprejmi", negotiate:"Pogajaj", review:"Preveri", reject:"Zavrni" };
        var nextState = order[(order.indexOf(clauseItem.dataset.clauseState) + 1) % order.length]; clauseItem.dataset.clauseState = nextState; clauseItem.querySelector("[data-clause-state-label]").textContent = labels[nextState] + " →"; clauseItem.setAttribute("aria-label", clauseItem.dataset.clauseLabel + ": " + labels[nextState] + ". Premakni v naslednjo skupino"); clauseRoot.querySelector('[data-clause-group="' + nextState + '"] > div').appendChild(clauseItem); updateClauseGroups(clauseRoot); return;
      }
      var capacityTask = event.target.closest("[data-capacity-task]");
      if (capacityTask) {
        var capacityRoot = capacityTask.closest("[data-capacity]"); var selectedTask = capacityTask.classList.toggle("is-selected");
        capacityRoot.querySelectorAll("[data-capacity-task]").forEach(function (task) { if (task !== capacityTask) task.classList.remove("is-selected"); task.setAttribute("aria-pressed", String(task.classList.contains("is-selected"))); });
        capacityRoot.dataset.capacitySelected = selectedTask ? capacityTask.dataset.capacityTask : ""; updateCapacity(capacityRoot, selectedTask ? "Izbrano: " + capacityTask.querySelector("b").textContent + " · zdaj izberite ciljno ekipo" : "Izberite opravilo, nato ciljno ekipo"); return;
      }
      var capacityTarget = event.target.closest("[data-capacity-target]");
      if (capacityTarget) {
        var targetRoot = capacityTarget.closest("[data-capacity]"); var selectedId = targetRoot.dataset.capacitySelected; var selectedCapacityTask = selectedId ? targetRoot.querySelector('[data-capacity-task="' + selectedId + '"]') : null;
        if (!selectedCapacityTask) { updateCapacity(targetRoot, "Najprej izberite delo."); return; }
        var targetLane = capacityTarget.closest("[data-capacity-lane]"); var targetId = targetLane.dataset.capacityLane; var currentUsed = Array.from(targetRoot.querySelectorAll("[data-capacity-task]")).filter(function (task) { return task.dataset.capacityTeam === targetId; }).reduce(function (sum, task) { return sum + Number(task.dataset.capacityHours); }, 0); var hours = Number(selectedCapacityTask.dataset.capacityHours);
        if (selectedCapacityTask.dataset.capacityTeam !== targetId && currentUsed + hours > Number(targetLane.dataset.capacityMax)) { updateCapacity(targetRoot, "Ni dovolj prostih ur v tej ekipi."); return; }
        selectedCapacityTask.dataset.capacityTeam = targetId; selectedCapacityTask.classList.remove("is-selected"); selectedCapacityTask.setAttribute("aria-pressed", "false"); targetRoot.dataset.capacitySelected = ""; updateCapacity(targetRoot, selectedCapacityTask.querySelector("b").textContent + " → " + targetLane.querySelector(".uj-card-capacity__team b").textContent + "."); return;
      }
      var matchClaim = event.target.closest("[data-match-claim]");
      var matchEvidence = event.target.closest("[data-match-evidence]");
      if (matchClaim || matchEvidence) {
        var matchRoot = (matchClaim || matchEvidence).closest("[data-matching]");
        if ((matchClaim || matchEvidence).disabled) return;
        if (matchClaim) {
          matchRoot.querySelectorAll("[data-match-claim]").forEach(function (button) { var selected = button === matchClaim; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); }); matchRoot.querySelectorAll("[data-match-evidence]").forEach(function (button) { button.classList.remove("is-selected", "is-wrong"); button.setAttribute("aria-pressed", "false"); }); matchRoot.dataset.selectedClaim = matchClaim.dataset.matchClaim; updateMatching(matchRoot, "Izbrano: " + matchClaim.dataset.matchLabel + ". Izberite dokazilo.", false); return;
        }
        var selectedMatchClaim = matchRoot.dataset.selectedClaim ? matchRoot.querySelector('[data-match-claim="' + matchRoot.dataset.selectedClaim + '"]') : null;
        if (!selectedMatchClaim) { updateMatching(matchRoot, "Najprej izberite pogoj na levi.", true); return; }
        matchRoot.querySelectorAll("[data-match-evidence]").forEach(function (button) { button.classList.remove("is-wrong"); });
        if (selectedMatchClaim.dataset.matchCorrect !== matchEvidence.dataset.matchEvidence) { matchEvidence.classList.add("is-wrong"); updateMatching(matchRoot, "Ne ustreza. Poskusite drugo dokazilo.", true); return; }
        selectedMatchClaim.dataset.matchedTo = matchEvidence.dataset.matchEvidence;
        var nextMatchClaim = Array.from(matchRoot.querySelectorAll("[data-match-claim]")).find(function (claim) { return !claim.dataset.matchedTo && claim !== selectedMatchClaim; });
        if (nextMatchClaim) { matchRoot.dataset.selectedClaim = nextMatchClaim.dataset.matchClaim; nextMatchClaim.classList.add("is-selected"); nextMatchClaim.setAttribute("aria-pressed", "true"); updateMatching(matchRoot, "Povezano. Zdaj izberite dokazilo za: " + nextMatchClaim.dataset.matchLabel + ".", false); }
        else { delete matchRoot.dataset.selectedClaim; updateMatching(matchRoot); }
        return;
      }
      var conditionJoin = event.target.closest("[data-condition-join]");
      if (conditionJoin) { var conditionRoot = conditionJoin.closest("[data-condition-builder]"); conditionRoot.querySelectorAll("[data-condition-join]").forEach(function (button) { button.classList.toggle("is-selected", button === conditionJoin); button.setAttribute("aria-pressed", String(button === conditionJoin)); }); updateConditionBuilder(conditionRoot); return; }
      var provenanceSource = event.target.closest("[data-provenance-source]");
      if (provenanceSource) { var provenanceRoot = provenanceSource.closest("[data-provenance]"); provenanceRoot.querySelectorAll("[data-provenance-source]").forEach(function (button) { button.classList.toggle("is-selected", button === provenanceSource); button.setAttribute("aria-pressed", String(button === provenanceSource)); }); updateProvenance(provenanceRoot); return; }
      var provenanceToggle = event.target.closest("[data-provenance-answer]");
      if (provenanceToggle) { var provenanceAnswerRoot = provenanceToggle.closest("[data-provenance]"); provenanceAnswerRoot.querySelectorAll("[data-provenance-answer]").forEach(function (button) { var selectedAnswer = button === provenanceToggle; button.classList.toggle("is-selected", selectedAnswer); button.setAttribute("aria-pressed", String(selectedAnswer)); }); updateProvenance(provenanceAnswerRoot); return; }
      var expectedAction = event.target.closest("[data-expected-action]");
      if (expectedAction) { applyExpectedAction(expectedAction.closest("[data-expected-value]"), expectedAction); return; }
      var cascadeEvent = event.target.closest("[data-cascade-event]");
      if (cascadeEvent) { var cascadeRoot = cascadeEvent.closest("[data-cascade]"); cascadeRoot.querySelectorAll("[data-cascade-event]").forEach(function (button) { button.classList.toggle("is-selected", button === cascadeEvent); button.setAttribute("aria-pressed", String(button === cascadeEvent)); }); cascadeRoot.querySelectorAll("[data-cascade-guard], [data-cascade-outcome]").forEach(function (button) { button.classList.remove("is-selected"); button.setAttribute("aria-pressed", "false"); }); updateCascade(cascadeRoot); return; }
      var cascadeGuard = event.target.closest("[data-cascade-guard]");
      if (cascadeGuard) { var guardRoot = cascadeGuard.closest("[data-cascade]"); var wasSelected = cascadeGuard.classList.contains("is-selected"); guardRoot.querySelectorAll("[data-cascade-guard]").forEach(function (guard) { guard.classList.remove("is-selected"); guard.setAttribute("aria-pressed", "false"); }); if (!wasSelected) { cascadeGuard.classList.add("is-selected"); cascadeGuard.setAttribute("aria-pressed", "true"); } updateCascade(guardRoot); return; }
      var cascadeOutcome = event.target.closest("[data-cascade-outcome]");
      if (cascadeOutcome) { var outcomeRoot = cascadeOutcome.closest("[data-cascade]"); var outcomeWasSelected = cascadeOutcome.classList.contains("is-selected"); outcomeRoot.querySelectorAll("[data-cascade-outcome]").forEach(function (outcome) { outcome.classList.remove("is-selected"); outcome.setAttribute("aria-pressed", "false"); }); if (!outcomeWasSelected) { cascadeOutcome.classList.add("is-selected"); cascadeOutcome.setAttribute("aria-pressed", "true"); } updateCascade(outcomeRoot); return; }
      var cardReset = event.target.closest("[data-card-reset]");
      if (cardReset) { resetTemplateCard(cardReset); return; }
      var reviewEdit = event.target.closest("[data-review-edit]");
      if (reviewEdit) {
        var reviewRow = reviewEdit.closest("[data-review-row]");
        var reviewValue = reviewRow.querySelector("[data-review-value]");
        var reviewInput = reviewRow.querySelector('input[type="text"]');
        var editing = !reviewInput.hidden;
        if (editing) {
          var nextReviewValue = reviewInput.value.trim() || reviewValue.textContent;
          reviewValue.textContent = nextReviewValue;
          reviewInput.value = nextReviewValue;
          reviewValue.hidden = false;
          reviewInput.hidden = true;
          reviewEdit.textContent = "Uredi";
        }
        else { reviewValue.hidden = true; reviewInput.hidden = false; reviewEdit.textContent = "Potrdi"; reviewInput.focus(); reviewInput.select(); }
        return;
      }
      var dateMode = event.target.closest("[data-date-mode]");
      if (dateMode) {
        var dateRoot = dateMode.closest("[data-card-date]");
        var dateInput = dateRoot.querySelector('input[type="date"]');
        var active = dateMode.classList.toggle("is-selected");
        dateRoot.querySelectorAll("[data-date-mode]").forEach(function (button) { if (button !== dateMode) button.classList.remove("is-selected"); button.setAttribute("aria-pressed", String(button.classList.contains("is-selected"))); });
        dateInput.disabled = active;
        var approximate = dateRoot.nextElementSibling;
        if (approximate && approximate.classList.contains("uj-card-date-approx")) approximate.hidden = !(active && dateMode.dataset.dateMode === "approximate");
        return;
      }
      var add = event.target.closest("[data-list-add]");
      if (add) {
        var list = add.closest("[data-card-list]");
        var input = list.querySelector('input[type="text"]');
        var value = input.value.trim();
        var existing = Array.from(list.querySelectorAll(".uj-card-list__items > span")).map(function (item) { return item.firstChild.textContent.trim().toLocaleLowerCase("sl-SI"); });
        if (value && !existing.includes(value.toLocaleLowerCase("sl-SI"))) {
          var item = document.createElement("span"); item.appendChild(document.createTextNode(value));
          var remove = document.createElement("button"); remove.type = "button"; remove.dataset.listRemove = ""; remove.setAttribute("aria-label", "Odstrani"); remove.textContent = "×"; item.appendChild(remove);
          list.querySelector(".uj-card-list__items").appendChild(item); input.value = "";
        }
        return;
      }
      var remove = event.target.closest("[data-list-remove]");
      if (remove) { remove.parentElement.remove(); return; }
      var fileRemove = event.target.closest("[data-file-remove]");
      if (fileRemove) {
        var upload = fileRemove.closest("[data-card-upload]");
        upload.querySelector('input[type="file"]').value = "";
        upload.querySelector(".uj-card-upload__file").hidden = true;
        return;
      }
      var save = event.target.closest("[data-card-save]");
      if (save) {
        save.classList.add("is-saved"); save.innerHTML = ICONS.check + '<span>Shranjeno</span>';
        setTimeout(function () { save.classList.remove("is-saved"); save.textContent = "Shrani podatke"; }, 1200);
      }
    });
    container.addEventListener("pointerdown", function (event) {
      var planeHandle = event.target.closest("[data-plane-handle]");
      if (planeHandle) {
        event.preventDefault(); planeHandle.focus({ preventScroll:true }); if (planeHandle.setPointerCapture) planeHandle.setPointerCapture(event.pointerId); updatePlaneFromPointer(planeHandle, event.clientX, event.clientY); return;
      }
      var trendInput = event.target.closest("[data-trend-input]");
      if (!trendInput) return;
      event.preventDefault();
      trendInput.focus({ preventScroll:true });
      if (trendInput.setPointerCapture) trendInput.setPointerCapture(event.pointerId);
      updateTrendFromPointer(trendInput, event.clientY);
    });
    container.addEventListener("pointermove", function (event) {
      var planeHandle = event.target.closest("[data-plane-handle]");
      if (planeHandle && planeHandle.hasPointerCapture && planeHandle.hasPointerCapture(event.pointerId)) { event.preventDefault(); updatePlaneFromPointer(planeHandle, event.clientX, event.clientY); return; }
      var trendInput = event.target.closest("[data-trend-input]");
      if (!trendInput || !trendInput.hasPointerCapture || !trendInput.hasPointerCapture(event.pointerId)) return;
      event.preventDefault();
      updateTrendFromPointer(trendInput, event.clientY);
    });
    container.addEventListener("pointerup", function (event) {
      var planeHandle = event.target.closest("[data-plane-handle]");
      if (planeHandle && planeHandle.hasPointerCapture && planeHandle.hasPointerCapture(event.pointerId)) { planeHandle.releasePointerCapture(event.pointerId); return; }
      var trendInput = event.target.closest("[data-trend-input]");
      if (trendInput && trendInput.hasPointerCapture && trendInput.hasPointerCapture(event.pointerId)) trendInput.releasePointerCapture(event.pointerId);
    });
    container.addEventListener("focusin", function (event) {
      if (event.target.matches("[data-change-input]")) activateChangeInput(event.target);
    });
    container.addEventListener("input", function (event) {
      if (event.target.matches("[data-sensitivity-range], [data-sensitivity-number]")) { updateSensitivity(event.target.closest("[data-sensitivity]"), event.target); return; }
      if (event.target.matches("[data-scenario-range]")) { updateScenario(event.target.closest("[data-scenario-mixer]"), event.target); return; }
      if (event.target.matches("[data-scenario-number]")) return;
      if (event.target.matches("[data-probability-range]")) { updateProbability(event.target.closest("[data-probability]"), event.target); return; }
      if (event.target.matches("[data-probability-number]")) return;
      if (event.target.matches("[data-funnel-input]")) return;
      if (event.target.matches("[data-plane-discount-range]")) { updatePlane(event.target.closest("[data-plane]"), event.target); return; }
      if (event.target.matches("[data-plane-discount-number]")) return;
      if (event.target.matches("[data-plane-detail-range]")) { updatePlane(event.target.closest("[data-plane]"), event.target); return; }
      if (event.target.matches("[data-plane-detail-number]")) return;
      if (event.target.matches("[data-condition-value]")) { updateConditionBuilder(event.target.closest("[data-condition-builder]")); return; }
      if (event.target.matches("[data-provenance-age-range], [data-provenance-age-number]")) { updateProvenance(event.target.closest("[data-provenance]"), event.target); return; }
      if (event.target.matches("[data-breakeven-range]")) { updateBreakeven(event.target.closest("[data-breakeven]"), event.target); return; }
      if (event.target.matches("[data-breakeven-number], [data-breakeven-price], [data-breakeven-variable], [data-breakeven-fixed]")) { if (event.target.value !== "") updateBreakeven(event.target.closest("[data-breakeven]"), event.target); return; }
      if (event.target.matches("[data-expected-range]")) { updateExpectedValue(event.target.closest("[data-expected-value]"), event.target); return; }
      if (event.target.matches("[data-expected-number]")) return;
      if (event.target.matches("[data-trend-input]")) { updateTrendChart(event.target.closest("[data-trend-card]"), event.target); return; }
      if (event.target.matches("[data-bullet-input]")) { updateBulletCard(event.target.closest("[data-bullet-card]")); return; }
      if (event.target.matches("[data-estimate-min], [data-estimate-likely], [data-estimate-max]")) { updateEstimateCard(event.target.closest("[data-estimate-card]")); return; }
      if (event.target.matches("[data-change-input]")) { updateChangeCard(event.target); return; }
      if (event.target.matches("[data-combo-input]")) {
        var comboInputRoot = event.target.closest("[data-combobox]");
        var comboQuery = event.target.value.trim().toLocaleLowerCase("sl-SI");
        var comboMatches = 0;
        comboInputRoot.querySelector("[data-combo-selected]").hidden = true;
        comboInputRoot.querySelector("[data-combo-options]").hidden = false;
        comboInputRoot.querySelector("[data-combo-manual]").hidden = !comboQuery;
        event.target.setAttribute("aria-expanded", "true");
        comboInputRoot.querySelectorAll("[data-combo-option]").forEach(function (button) {
          var visible = !comboQuery || button.textContent.toLocaleLowerCase("sl-SI").includes(comboQuery);
          button.hidden = !visible; button.setAttribute("aria-selected", "false"); if (visible) comboMatches += 1;
        });
        comboInputRoot.querySelector("[data-combo-empty]").hidden = comboMatches > 0;
        return;
      }
      if (event.target.matches("[data-recurrence-count]")) { recurrenceText(event.target.closest("[data-recurrence]")); return; }
      if (event.target.matches("[data-relative-days]")) { relativeDeadlineText(event.target.closest("[data-relative-deadline]")); return; }
      if (event.target.matches("[data-radius-range]")) {
        var radiusRoot = event.target.closest("[data-radius-card]");
        var radiusValue = Number(event.target.value);
        radiusRoot.querySelector("[data-radius-output]").textContent = radiusValue + " km";
        radiusRoot.querySelector("[data-radius-map-label]").textContent = radiusValue + " km";
        radiusRoot.querySelector(".uj-card-radius__map").style.setProperty("--radius-size", (28 + radiusValue / 100 * 64) + "%");
        event.target.setAttribute("aria-valuetext", radiusValue + " km");
        return;
      }
      if (event.target.matches("[data-installment-count]")) { updateInstallments(event.target.closest("[data-installments]")); return; }
      if (event.target.matches("[data-allocation-range]")) {
        var allocation = event.target.closest("[data-card-allocation]");
        var primary = Number(event.target.value); var secondary = 100 - primary;
        allocation.querySelector(".uj-card-allocation__donut").style.setProperty("--allocation", primary);
        allocation.querySelectorAll("[data-allocation-primary]").forEach(function (output) { output.textContent = primary + " %"; });
        allocation.querySelector("[data-allocation-secondary]").textContent = secondary + " %";
        return;
      }
      if (event.target.matches("[data-dual-min], [data-dual-max]")) { updateDualRange(event.target.closest("[data-dual-range]"), event.target); return; }
      if (event.target.matches("[data-payment-part]")) { updatePaymentSplit(event.target.closest("[data-payment-split]")); return; }
      if (event.target.matches("[data-goal-range]")) {
        var goalRoot = event.target.closest("[data-goal-card]");
        var goal = Number(event.target.value);
        var goalGauge = goalRoot.querySelectorAll(".uj-card-goal__gauge")[1];
        goalGauge.style.setProperty("--gauge", goal);
        goalRoot.querySelector("[data-goal-output]").textContent = goal + " %";
        goalRoot.querySelector("[data-goal-delta]").textContent = (goal - 62) + " odstotnih točk";
        return;
      }
      if (event.target.closest("[data-score-card]") && event.target.matches('input[type="number"]')) {
        event.target.value = String(Math.max(Number(event.target.min), Math.min(Number(event.target.max), Number(event.target.value) || Number(event.target.min))));
        updateScoreCard(event.target.closest("[data-score-card]"));
        return;
      }
      if (event.target.matches('input[type="range"]')) {
        var rangeCard = event.target.closest("[data-answer-card]");
        updateRangeVisual(rangeCard, event.target);
        var rangePresets = rangeCard.querySelector("[data-range-presets]");
        if (rangePresets) {
          var rangeCustom = rangePresets.querySelector("[data-number-custom]");
          if (rangeCustom) rangeCustom.value = "";
          rangePresets.querySelectorAll("[data-card-choice]").forEach(function (button) {
            var selected = Number(button.dataset.cardChoice) === Number(event.target.value);
            button.classList.toggle("is-selected", selected);
            button.setAttribute("aria-pressed", String(selected));
          });
        }
        return;
      }
      if (event.target.matches("[data-number-custom]")) {
        var customGroup = event.target.closest("[data-number-choices]");
        customGroup.querySelectorAll("[data-card-choice]").forEach(function (button) { button.classList.remove("is-selected"); button.setAttribute("aria-pressed", "false"); });
        updateNumberChoiceConfirmation(customGroup, event.target.value);
        if (customGroup.hasAttribute("data-range-presets")) {
          var customValue = Number(String(event.target.value).replace(",", "."));
          var customCard = event.target.closest("[data-answer-card]");
          var customRange = customCard.querySelector('input[type="range"]');
          if (customRange && Number.isFinite(customValue) && customValue >= Number(customRange.min) && customValue <= Number(customRange.max)) {
            customRange.value = String(customValue);
            updateRangeVisual(customCard, customRange);
          }
        }
      }
    });
    container.addEventListener("keydown", function (event) {
      var planeHandle = event.target.closest("[data-plane-handle]");
      if (planeHandle && ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(event.key)) {
        event.preventDefault(); var planeKeyRoot = planeHandle.closest("[data-plane]"); var planeX = Number(planeKeyRoot.querySelector("[data-plane-x]").value); var planeY = Number(planeKeyRoot.querySelector("[data-plane-y]").value); var planeStep = event.shiftKey ? 5 : 1;
        if (event.key === "ArrowLeft") planeX -= planeStep; if (event.key === "ArrowRight") planeX += planeStep; if (event.key === "ArrowUp") planeY += planeStep * 5; if (event.key === "ArrowDown") planeY -= planeStep * 5; if (event.key === "Home") { planeX = 0; planeY = 0; } if (event.key === "End") { planeX = 20; planeY = 100; }
        updatePlane(planeKeyRoot, planeX, planeY); return;
      }
      var clauseKeyToggle = event.target.closest("[data-clause-toggle]");
      if (clauseKeyToggle && ["ArrowDown","Escape"].includes(event.key)) {
        event.preventDefault(); var clauseKeySelect=clauseKeyToggle.closest("[data-clause-select]"); var clauseKeyMenu=clauseKeySelect.querySelector("[data-clause-menu]"); if (event.key === "Escape") { clauseKeyMenu.hidden=true; clauseKeyToggle.setAttribute("aria-expanded","false"); return; } if (clauseKeyToggle.getAttribute("aria-expanded") !== "true") clauseKeyToggle.click(); (clauseKeyMenu.querySelector(".is-selected") || clauseKeyMenu.querySelector("[data-clause-choice]")).focus(); return;
      }
      var clauseKeyChoice = event.target.closest("button[data-clause-choice]");
      if (clauseKeyChoice && ["ArrowDown","ArrowUp","Escape"].includes(event.key)) {
        event.preventDefault(); var clauseKeySelect = clauseKeyChoice.closest("[data-clause-select]"); var clauseKeyOptions = Array.from(clauseKeySelect.querySelectorAll("[data-clause-choice]"));
        if (event.key === "Escape") { clauseKeySelect.querySelector("[data-clause-menu]").hidden = true; clauseKeySelect.querySelector("[data-clause-toggle]").setAttribute("aria-expanded", "false"); clauseKeySelect.querySelector("[data-clause-toggle]").focus(); return; }
        var clauseKeyIndex = clauseKeyOptions.indexOf(clauseKeyChoice); clauseKeyOptions[(clauseKeyIndex + (event.key === "ArrowDown" ? 1 : -1) + clauseKeyOptions.length) % clauseKeyOptions.length].focus(); return;
      }
      var conditionKeyToggle = event.target.closest("[data-condition-toggle]");
      if (conditionKeyToggle && ["ArrowDown","Escape"].includes(event.key)) {
        event.preventDefault(); var conditionKeySelect=conditionKeyToggle.closest("[data-condition-select]"); var conditionKeyMenu=conditionKeySelect.querySelector("[data-condition-menu]"); if (event.key === "Escape") { conditionKeyMenu.hidden=true; conditionKeyToggle.setAttribute("aria-expanded","false"); return; } if (conditionKeyToggle.getAttribute("aria-expanded") !== "true") conditionKeyToggle.click(); (conditionKeyMenu.querySelector(".is-selected") || conditionKeyMenu.querySelector("[data-condition-choice]")).focus(); return;
      }
      var conditionKeyChoice = event.target.closest("button[data-condition-choice]");
      if (conditionKeyChoice && ["ArrowDown","ArrowUp","Escape"].includes(event.key)) {
        event.preventDefault(); var conditionKeySelect=conditionKeyChoice.closest("[data-condition-select]"); var conditionKeyOptions=Array.from(conditionKeySelect.querySelectorAll("[data-condition-choice]")); if (event.key === "Escape") { conditionKeySelect.querySelector("[data-condition-menu]").hidden=true; conditionKeySelect.querySelector("[data-condition-toggle]").setAttribute("aria-expanded","false"); conditionKeySelect.querySelector("[data-condition-toggle]").focus(); return; } var conditionKeyIndex=conditionKeyOptions.indexOf(conditionKeyChoice); conditionKeyOptions[(conditionKeyIndex+(event.key==="ArrowDown"?1:-1)+conditionKeyOptions.length)%conditionKeyOptions.length].focus(); return;
      }
      var comboInput = event.target.closest("[data-combo-input]");
      if (comboInput) {
        var comboKeyRoot = comboInput.closest("[data-combobox]");
        var comboKeyOptions = Array.from(comboKeyRoot.querySelectorAll("[data-combo-option]")).filter(function (button) { return !button.hidden; });
        if (event.key === "ArrowDown" && comboKeyOptions.length) { event.preventDefault(); comboKeyOptions[0].focus(); }
        else if (event.key === "Enter") {
          if (comboKeyOptions.length === 1) { event.preventDefault(); comboKeyOptions[0].click(); }
          else if (!comboKeyOptions.length && !comboKeyRoot.querySelector("[data-combo-manual]").hidden) { event.preventDefault(); comboKeyRoot.querySelector("[data-combo-manual]").click(); }
        } else if (event.key === "Escape") { comboKeyRoot.querySelector("[data-combo-options]").hidden = true; comboInput.setAttribute("aria-expanded", "false"); }
        return;
      }
      var comboKeyOption = event.target.closest("[data-combo-option]");
      if (comboKeyOption && ["ArrowDown", "ArrowUp", "Escape"].includes(event.key)) {
        event.preventDefault();
        var optionKeyRoot = comboKeyOption.closest("[data-combobox]");
        if (event.key === "Escape") {
          optionKeyRoot.querySelector("[data-combo-options]").hidden = true;
          optionKeyRoot.querySelector("[data-combo-input]").setAttribute("aria-expanded", "false");
          optionKeyRoot.querySelector("[data-combo-input]").focus();
          return;
        }
        var visibleKeyOptions = Array.from(optionKeyRoot.querySelectorAll("[data-combo-option]")).filter(function (button) { return !button.hidden; });
        var optionIndex = visibleKeyOptions.indexOf(comboKeyOption);
        visibleKeyOptions[(optionIndex + (event.key === "ArrowDown" ? 1 : -1) + visibleKeyOptions.length) % visibleKeyOptions.length].focus();
      }
    });
    container.addEventListener("change", function (event) {
      if (event.target.matches("[data-scenario-number]")) { updateScenario(event.target.closest("[data-scenario-mixer]"), event.target); return; }
      if (event.target.matches("[data-probability-number]")) { updateProbability(event.target.closest("[data-probability]"), event.target); return; }
      if (event.target.matches("[data-funnel-input]")) { updateFunnel(event.target.closest("[data-funnel]")); return; }
      if (event.target.matches("[data-plane-discount-number]")) { updatePlane(event.target.closest("[data-plane]"), event.target); return; }
      if (event.target.matches("[data-plane-detail-number]")) { updatePlane(event.target.closest("[data-plane]"), event.target); return; }
      if (event.target.matches("[data-clause-choice]")) { updateClauseGroups(event.target.closest("[data-clause-grouping]")); return; }
      if (event.target.matches("[data-condition-field], [data-condition-operator], [data-condition-action]")) { updateConditionBuilder(event.target.closest("[data-condition-builder]")); return; }
      if (event.target.matches("[data-breakeven-number], [data-breakeven-price], [data-breakeven-variable], [data-breakeven-fixed]")) { updateBreakeven(event.target.closest("[data-breakeven]"), event.target); return; }
      if (event.target.matches("[data-expected-number]")) { updateExpectedValue(event.target.closest("[data-expected-value]"), event.target); return; }
      if (event.target.matches("[data-bullet-input]")) { updateBulletCard(event.target.closest("[data-bullet-card]"), true); return; }
      if (event.target.matches("[data-installment-count]")) { updateInstallments(event.target.closest("[data-installments]"), true); return; }
      if (event.target.matches("[data-recurrence-unit], [data-recurrence-end], [data-recurrence-date]")) { recurrenceText(event.target.closest("[data-recurrence]")); return; }
      if (event.target.matches("[data-relative-anchor]")) { relativeDeadlineText(event.target.closest("[data-relative-deadline]")); return; }
      if (event.target.matches('.uj-card-upload input[type="file"]')) {
        var upload = event.target.closest("[data-card-upload]");
        var fileRow = upload.querySelector(".uj-card-upload__file");
        var name = upload.querySelector("[data-file-name]");
        var files = Array.from(event.target.files || []);
        name.textContent = files.map(function (file) { return file.name; }).join(", ");
        fileRow.hidden = !files.length;
      }
    });
  }

  var FATHER_GOALS = [
    { id:"full_payment", title:"Celotno plačilo", icon:"receiptCheck", tone:"placano-v-celoti", manualVisible:false, templateId:"natancen-znesek", required:["targetAmount","paymentDeadline","contactChannel"] },
    { id:"partial_payment_now", title:"Delno plačilo čim prej", icon:"cardDown", tone:"delno", templateId:"placilni-razrez", required:["requestedAmount","paymentDeadline","remainingStrategy"] },
    { id:"installment_plan", title:"Plačilo v obrokih", icon:"calendar", tone:"obrok", templateId:"obrocni-nacrt", required:["targetAmount","installmentCount","firstPaymentDate","frequency"] },
    { id:"new_deadline", title:"Plačilo do novega roka", icon:"calendarArrow", tone:"akcija-obljuba", templateId:"datum-z-gotovostjo", required:["targetAmount","newDeadline","contactChannel"] },
    { id:"amicable_settlement", title:"Sporazumna poravnava", icon:"handshake", tone:"kompenzacija", templateId:"pogajalski-prostor", required:["settlementAmount","settlementDeadline","settlementApproach"] },
    { id:"dispute_resolution", title:"Rešitev ugovora", icon:"messageX", tone:"ugovor", templateId:"skupine-odstopanj", required:["disputeTopic","desiredOutcome","disputeDescription"] },
    { id:"compensation", title:"Kompenzacija / pobot", icon:"scales", tone:"kompenzacija", templateId:"znesek-ali-odstotek", required:["compensationAmount","counterclaimReference"] },
    { id:"payment_security", title:"Zavarovanje plačila", icon:"shield", tone:"insolventnost", templateId:"pogojna-garancija", required:["securityType","securedAmount","securityDeadline"] },
    { id:"legal_recovery", title:"Pravna izterjava", icon:"scales", tone:"akcija-odvetnik", templateId:"odlocitvena-pot", required:[] },
    { id:"insolvency_claim", title:"Insolvenčni postopek", icon:"shield", tone:"insolventnost", templateId:"dokazilo", required:["proceedingType"] },
    { id:"close_without_recovery", title:"Zaključek brez izterjave", icon:"documentX", tone:"storno", templateId:"kaskada-krsitve", required:["closureReason","writeOffAmount","closureNote"] },
    { id:"custom_goal", title:"Drug cilj", icon:"pencil", tone:"drugo", templateId:"besedilni-vnos", required:["goalDescription"] }
  ];
  var FATHER_LEGAL_OUTCOMES = [
    { id:"legal_notice_payment", title:"Plačilo po pravnem opominu", icon:"message", templateId:"odlocitvena-pot", description:"Želite, da odvetnik oceni in pripravi pravni poziv za plačilo. Rok in način vročitve bo določil odvetnik." },
    { id:"enforcement", title:"Izvršba", icon:"scales", templateId:"odlocitvena-pot", description:"Želite začeti prisilno izterjavo. Podlago in možnosti izvršbe bo preveril odvetnik." },
    { id:"payment_order_or_claim", title:"Plačilni nalog / tožba", icon:"document", templateId:"odlocitvena-pot", description:"Želite sodno uveljaviti terjatev. Najprimernejši postopek bo po dokazih izbral odvetnik." },
    { id:"interim_protection", title:"Začasna sodna zaščita", icon:"shield", templateId:"navpicni-izbor", description:"Izberite samo, kaj želite predvsem zaščititi. Nujnost in primeren ukrep bo preveril odvetnik." },
    { id:"cross_border_recovery", title:"Čezmejna izterjava", icon:"mail", templateId:"besedilni-vnos", description:"Navedite samo državo, kjer je potrebna izterjava. Naslov in postopek bo preveril odvetnik." },
    { id:"legal_route_review", title:"Ocena najboljše pravne poti", icon:"sliders", templateId:"primerjava-moznosti", description:"Povejte le, kaj vam je pri pravni poti najpomembnejše. Podrobnosti bo zbral odvetnik." }
  ];
  var FATHER_LEGAL_FIELDS = {
    legal_notice_payment:[], enforcement:[], payment_order_or_claim:[],
    interim_protection:[{ type:"select", name:"protectionFocus", label:"Kaj želite predvsem zaščititi?", options:[["assets","Premoženje ali denarna sredstva"],["business","Poslovanje ali izvedbo pogodbe"],["evidence","Dokaze ali obstoječe stanje"],["other","Nekaj drugega"],["unsure","Naj presodi odvetnik"]] }],
    cross_border_recovery:[{ type:"text", name:"debtorCountry", label:"V kateri državi je potrebna izterjava?", placeholder:"Npr. Avstrija" }],
    legal_route_review:[{ type:"select", name:"priority", label:"Kaj vam je najpomembnejše?", options:[["speed","Najhitrejša rešitev"],["cost","Najnižji stroški"],["success","Največja verjetnost uspeha"],["balanced","Uravnotežena pot"],["unsure","Naj presodi odvetnik"]] }]
  };
  function freezeFatherRecord(record, family) {
    var copy = Object.assign({ category:"2.0", family:family }, record);
    if (copy.required) copy.required = Object.freeze(copy.required.slice());
    return Object.freeze(copy);
  }
  FATHER_GOALS = Object.freeze(FATHER_GOALS.map(function (record) { return freezeFatherRecord(record, "goal-father"); }));
  FATHER_LEGAL_OUTCOMES = Object.freeze(FATHER_LEGAL_OUTCOMES.map(function (record) { return freezeFatherRecord(record, "legal-outcome-father"); }));
  Object.keys(FATHER_LEGAL_FIELDS).forEach(function (key) {
    FATHER_LEGAL_FIELDS[key] = Object.freeze(FATHER_LEGAL_FIELDS[key].map(function (field) {
      var copy = Object.assign({}, field);
      if (copy.options) copy.options = Object.freeze(copy.options.map(function (row) { return Object.freeze(row.slice()); }));
      return Object.freeze(copy);
    }));
  });
  var CATEGORY_2_0 = Object.freeze({
    version:"atena-card-category-2.0-v1", category:"2.0", goals:FATHER_GOALS,
    legalOutcomes:FATHER_LEGAL_OUTCOMES, legalFields:Object.freeze(FATHER_LEGAL_FIELDS),
    records:Object.freeze(FATHER_GOALS.concat(FATHER_LEGAL_OUTCOMES))
  });

  return Object.freeze({ version:"atena-card-templates-v2", approvedTemplateIds:APPROVED_TEMPLATE_IDS, templates:TEMPLATES, categories:Object.freeze({ "2.0":CATEGORY_2_0 }), icons:ICONS, renderTemplate:renderTemplate, renderGallery:renderGallery, bind:bind });
});
