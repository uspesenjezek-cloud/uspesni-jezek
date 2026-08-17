"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app", "zacasno-global.js"), "utf8");

const listeners = {};
const document = {
  body: null,
  head: { appendChild() {} },
  readyState: "interactive",
  documentElement: { style: {} },
  createElement() {
    return {
      hidden: false,
      className: "",
      innerHTML: "",
      setAttribute() {},
      addEventListener() {},
    };
  },
  getElementById() { return null; },
  addEventListener(type, callback) { listeners[type] = callback; },
};

const window = {
  location: { pathname: "/app/index.html" },
  localStorage: { getItem() { return null; }, setItem() {} },
  clearTimeout() {},
  setTimeout() { return 1; },
  addEventListener() {},
};

assert.doesNotThrow(() => vm.runInNewContext(source, { document, window, Date, JSON }));
assert.equal(document.body, null, "Test mora ohraniti stanje dokumenta med preusmeritvijo.");
console.log("zacasno-global: preusmeritev brez body elementa ne prekine aplikacije");
