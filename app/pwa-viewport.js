(function () {
  "use strict";

  var root = document.documentElement;
  var isStandalone =
    root.classList.contains("boniteta-standalone") ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (!isStandalone) return;
  root.classList.add("boniteta-standalone");

  var scheduled = false;
  var panels = [];
  var nav = null;

  function isVisible(element) {
    if (!element || element.hidden) return false;
    var style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updateScrollLock);
  }

  function getVisibleContentBottom(panel) {
    var children = Array.prototype.filter.call(panel.children, isVisible);
    var bottom = panel.getBoundingClientRect().top + window.scrollY;

    children.forEach(function (child) {
      bottom = Math.max(bottom, child.getBoundingClientRect().bottom + window.scrollY);
    });

    return bottom;
  }

  function updateScrollLock() {
    scheduled = false;
    nav = nav || document.querySelector(".boniteta-center-nav");
    panels = panels.length
      ? panels
      : Array.prototype.slice.call(
          document.querySelectorAll(
            "#boniteta-center-new, #boniteta-center-active, #boniteta-center-workspace"
          )
        );

    var panel = panels.find(isVisible);
    if (!panel || !nav) {
      root.classList.remove("boniteta-pwa-fits");
      return;
    }

    var contentBottom = getVisibleContentBottom(panel);
    var availableBottom = nav.getBoundingClientRect().top - 6;
    var fits = contentBottom <= availableBottom;

    root.classList.toggle("boniteta-pwa-fits", fits);
    if (fits && window.scrollY > 0) window.scrollTo(0, 0);
  }

  document.addEventListener("DOMContentLoaded", function () {
    nav = document.querySelector(".boniteta-center-nav");
    panels = Array.prototype.slice.call(
      document.querySelectorAll(
        "#boniteta-center-new, #boniteta-center-active, #boniteta-center-workspace"
      )
    );

    var observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "aria-hidden"]
    });

    if (window.ResizeObserver) {
      var resizeObserver = new ResizeObserver(scheduleUpdate);
      panels.concat(nav ? [nav] : []).forEach(function (element) {
        if (element) resizeObserver.observe(element);
      });
    }

    window.addEventListener("resize", scheduleUpdate, { passive: true });
    window.addEventListener("orientationchange", scheduleUpdate, { passive: true });
    window.addEventListener("pageshow", scheduleUpdate, { passive: true });
    document.addEventListener("click", scheduleUpdate, { passive: true });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleUpdate);
    }

    scheduleUpdate();
  });
})();
