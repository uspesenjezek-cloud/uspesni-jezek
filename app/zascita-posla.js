(function () {
  "use strict";

  var button = document.getElementById("boniteta-crif-toggle");
  var state = document.getElementById("boniteta-crif-toggle-state");
  var storageKey = "uj:boniteta:crif-elements-visible";
  if (!button || !state) return;

  function readVisibility() {
    try {
      return localStorage.getItem(storageKey) !== "false";
    } catch (_) {
      return true;
    }
  }

  function render(visible) {
    button.setAttribute("aria-checked", visible ? "true" : "false");
    button.classList.toggle("is-off", !visible);
    state.textContent = visible ? "Vključen" : "Izključen";
    if (window.UJPrilagodiVelikostBesedila) {
      button.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
    }
  }

  var visible = readVisibility();
  render(visible);
  button.addEventListener("click", function () {
    visible = !visible;
    try {
      localStorage.setItem(storageKey, visible ? "true" : "false");
    } catch (_) {}
    render(visible);
  });
})();
