"use strict";

var assert = require("node:assert/strict");
var renderer = require("../app/atena-card-renderer");

var field = { id:7, label:"Ime", type:"text", required:false, help:"", interfaceId:"atena:field:test:1:7", ui:{ interaction:"short-text", fullWidth:true } };
var expectedStatic = '<div class="atena-polje atena-polje--polno atena-polje--kratko" data-atena-field-root data-atena-field-id="7" data-atena-interaction="short-text" data-atena-interface-id="atena:field:test:1:7"><span class="atena-polje__oznaka">Ime</span><input type="hidden" data-ponudba-field="7" value="Ana"><input type="text" data-atena-value value="Ana" autocomplete="off"><p class="atena-polje__napaka" data-atena-field-error hidden>To polje je obvezno.</p></div>';
assert.equal(renderer.fieldHtml(field, "Ana"), expectedStatic, "klic brez scopea mora ostati dobesedno enak");

var scopedOne = renderer.fieldHtml(field, "Ana", { storageKey:"test:1:sklop.1.ime", instanceKey:"1", interfaceId:"atena:field:test:1:7:scope:test-1-sklop:instance:1", scopeId:"test:1:sklop", definitionId:"sklop" });
var scopedTwo = renderer.fieldHtml(field, "Bine", { storageKey:"test:1:sklop.2.ime", instanceKey:"2", interfaceId:"atena:field:test:1:7:scope:test-1-sklop:instance:2", scopeId:"test:1:sklop", definitionId:"sklop" });
assert.match(scopedOne, /data-atena-storage-key="test:1:sklop\.1\.ime"/);
assert.match(scopedOne, /data-atena-instance-key="1"/);
assert.match(scopedOne, /data-reaktivni-scope-id="test:1:sklop"/);
assert.match(scopedOne, /data-reaktivni-definicija-id="sklop"/);
assert.match(scopedOne, /data-atena-interface-id="atena:field:test:1:7:scope:test-1-sklop:instance:1"/);
assert.notEqual(scopedOne.match(/data-atena-interface-id="([^"]+)/)[1], scopedTwo.match(/data-atena-interface-id="([^"]+)/)[1]);

var pogodbeniKontekst = { cardId:"atena:card:test:1", ui:{ controlInterfaceIds:["atena:control:test:1:8:value"], optionInterfaceIds:["atena:option:test:1:8:a"] }, canonical:{ allowedValues:[{ id:"a", interfaceId:"atena:option:test:1:8:a" }] }, relations:[{ interfaceId:"atena:relation:test:1:8:show" }] };
var dropdown = { id:8, label:"Vrsta", type:"select", required:false, help:"", interfaceId:"atena:field:test:1:8", options:[{ id:"a", label:"A" }], context:pogodbeniKontekst, ui:{ interaction:"dropdown", fullWidth:true } };
var dropdownOne = renderer.fieldHtml(dropdown, "a", { storageKey:"test:1:sklop.1.vrsta", instanceKey:"1", interfaceId:"atena:field:test:1:8:scope:test-1-sklop:instance:1", scopeId:"test:1:sklop", definitionId:"sklop" });
var dropdownTwo = renderer.fieldHtml(dropdown, "a", { storageKey:"test:1:sklop.2.vrsta", instanceKey:"2", interfaceId:"atena:field:test:1:8:scope:test-1-sklop:instance:2", scopeId:"test:1:sklop", definitionId:"sklop" });
assert.notEqual(dropdownOne.match(/aria-controls="([^"]+)/)[1], dropdownTwo.match(/aria-controls="([^"]+)/)[1], "aria-controls mora biti scoped");
assert.notEqual(dropdownOne.match(/data-atena-control-ids="([^"]+)/)[1], dropdownTwo.match(/data-atena-control-ids="([^"]+)/)[1], "declared control ID mora biti scoped");
assert.notEqual(dropdownOne.match(/data-atena-option-ids="([^"]+)/)[1], dropdownTwo.match(/data-atena-option-ids="([^"]+)/)[1], "declared option ID mora biti scoped");
assert.notEqual(dropdownOne.match(/data-atena-relation-ids="([^"]+)/)[1], dropdownTwo.match(/data-atena-relation-ids="([^"]+)/)[1], "declared relation ID mora biti scoped");
assert.notEqual(dropdownOne.match(/data-atena-option-id="([^"]+)/)[1], dropdownTwo.match(/data-atena-option-id="([^"]+)/)[1], "fizični option contract ID mora biti scoped");
assert.notEqual(dropdownOne.match(/role="option"[^>]*id="([^"]+)/)[1], dropdownTwo.match(/role="option"[^>]*id="([^"]+)/)[1], "dropdown option DOM ID mora biti scoped");
var vsiDropdownDomIdji = Array.from((dropdownOne + dropdownTwo).matchAll(/\sid="([^"]+)"/g)).map(function (ujemanje) { return ujemanje[1]; });
assert.equal(new Set(vsiDropdownDomIdji).size, vsiDropdownDomIdji.length, "vsi scoped dropdown DOM ID-ji morajo biti enolični");

var choice = Object.assign({}, dropdown, { ui:{ interaction:"choice-grid", fullWidth:true } });
var choiceOne = renderer.fieldHtml(choice, "a", { storageKey:"test:1:sklop.1.vrsta", instanceKey:"1", interfaceId:"atena:field:test:1:8:scope:test-1-sklop:instance:1", scopeId:"test:1:sklop", definitionId:"sklop" });
var choiceTwo = renderer.fieldHtml(choice, "a", { storageKey:"test:1:sklop.2.vrsta", instanceKey:"2", interfaceId:"atena:field:test:1:8:scope:test-1-sklop:instance:2", scopeId:"test:1:sklop", definitionId:"sklop" });
assert.notEqual(choiceOne.match(/data-atena-choice="a"[^>]*id="([^"]+)/)[1], choiceTwo.match(/data-atena-choice="a"[^>]*id="([^"]+)/)[1], "choice option DOM ID mora biti scoped");
assert.notEqual(choiceOne.match(/data-atena-option-id="([^"]+)/)[1], choiceTwo.match(/data-atena-option-id="([^"]+)/)[1], "choice option contract ID mora biti scoped");

function narediRoot(config) {
  var error = { hidden:true };
  var canonical = { value:config.value || "" };
  var root;
  var control = {
    attributes:[{ name:"data-atena-value", value:"" }], dataset:{}, tagName:"INPUT", type:"text", focused:false,
    closest:function (selector) { return selector === "[data-atena-field-root]" ? root : null; },
    getAttribute:function () { return null; },
    setAttribute:function (name, value) { this[name] = value; },
    removeAttribute:function (name) { delete this[name]; },
    focus:function () { this.focused = true; },
    scrollIntoView:function () {}
  };
  root = {
    hidden:false,
    dataset:{ atenaFieldId:String(config.fieldId), atenaStorageKey:config.storageKey || "", atenaInterfaceId:config.interfaceId, atenaInteraction:"short-text" },
    invalid:false,
    hasAttribute:function (name) { return name === "data-atena-field-root" || (name === "data-atena-interface-id" && Boolean(this.dataset.atenaInterfaceId)); },
    querySelector:function (selector) {
      if (selector === "[data-ponudba-field]") return canonical;
      if (selector === "[data-atena-field-error]") return error;
      if (selector.indexOf("input:not([type=hidden])") >= 0) return control;
      return null;
    },
    querySelectorAll:function (selector) {
      if (selector === "button,input:not([type=hidden]),select,textarea") return [control];
      if (selector === "[aria-invalid=true]") return control["aria-invalid"] ? [control] : [];
      return [];
    },
    closest:function () { return null; },
    toggleAttribute:function (name, force) { if (name === "data-atena-error") this.invalid = Boolean(force); }
  };
  return { root:root, control:control, error:error };
}

var prva = narediRoot({ fieldId:7, storageKey:"sklop.1.ime", interfaceId:"atena:field:test:1:7:instance:1", value:"Ana" });
var druga = narediRoot({ fieldId:7, storageKey:"sklop.2.ime", interfaceId:"atena:field:test:1:7:instance:2", value:"" });
var staticna = narediRoot({ fieldId:9, interfaceId:"atena:field:test:1:9", value:"Staro" });
var roots = [prva.root, druga.root, staticna.root];
var container = {
  querySelectorAll:function (selector) {
    if (selector === "[data-atena-field-root]") return roots;
    if (selector === '[data-atena-field-root][data-atena-required="true"]') return [prva.root, druga.root];
    if (selector === "[data-atena-field-root][data-atena-interface-id]") return roots;
    if (selector === ".atena-vprasanje-kartica[data-atena-interface-id]") return [];
    if (selector === "[data-atena-control-id]") return [prva.control, druga.control, staticna.control];
    return [];
  }
};

assert.deepEqual(renderer.collectValues(container), { "sklop.1.ime":"Ana", "sklop.2.ime":"", "9":"Staro" }, "collectValues mora lociti scoped in staticne kljuce");
var stamped = renderer.stampInterfaceIds(container);
assert.equal(stamped.ok, true);
assert.equal(new Set([prva.control.dataset.atenaControlId, druga.control.dataset.atenaControlId, staticna.control.dataset.atenaControlId]).size, 3, "kontrolni ID-ji morajo biti enolicni");
assert.equal(renderer.validate(container), false, "prazna zahtevana instanca mora blokirati");
assert.equal(prva.root.invalid, false, "izpolnjena instanca ne sme dobiti napake");
assert.equal(druga.root.invalid, true, "required napaka mora pripadati konkretni prazni instanci");
assert.equal(druga.control.focused, true);

var datotecniCanonical = { value:"", setAttribute:function (_ime, vrednost) { this.value = vrednost; } };
var datotecniSeznam = { hidden:true };
var datotecnaOznaka = { textContent:"" };
var datotecniRoot = {
  dataset:{ atenaStorageKey:"test:1:sklop.1.dokument", atenaFieldId:"9", atenaInteraction:"document-upload" },
  querySelector:function (selector) {
    if (selector === "[data-ponudba-field]") return datotecniCanonical;
    if (selector === "[data-atena-file-note]") return { value:"" };
    if (selector === "[data-atena-file-list]") return datotecniSeznam;
    if (selector === "[data-atena-file-summary]") return datotecnaOznaka;
    return null;
  },
  querySelectorAll:function () { return []; },
  removeAttribute:function () {},
  closest:function () { return null; }
};
var datotecniVnos = {
  files:[{ name:"pogodba.pdf" }],
  closest:function (selector) { return selector === "[data-atena-field-root]" ? datotecniRoot : null; },
  hasAttribute:function (ime) { return ime === "data-atena-file-input"; },
  matches:function () { return false; }
};
renderer.handleChange({ target:datotecniVnos }, { querySelectorAll:function () { return []; } });
assert.equal(renderer.getFiles("test:1:sklop.1.dokument")[0].name, "pogodba.pdf", "getFiles mora sprejeti scoped storage key");
assert.deepEqual(renderer.getFiles("9"), [], "scoped datoteka ne sme biti dosegljiva prek osnovnega fieldId");

console.log("Atena card renderer scoping: OK (staticni HTML, scope, collect, control IDs, required)");
