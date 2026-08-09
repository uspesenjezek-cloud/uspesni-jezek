/* ========== Skupna kartica priporočila (rok / obročno) ==========
   window.UJRecommendationCard
   ============================================ */
(function (root) {
  "use strict";

  /**
   * @param {HTMLElement} host
   * @param {{
   *   id: string,
   *   valueLabel?: string,
   *   description?: string,
   *   contextHash?: string,
   *   applyAriaLabel?: string,
   *   ignoreAriaLabel?: string,
   *   onApply: () => (Promise<void>|void),
   *   onIgnore?: () => void,
   *   onUndo?: () => void,
   *   onShowAgain?: () => void,
   *   onReapply?: () => (Promise<void>|void)
   * }} opts
   */
  function mount(host, opts) {
    if (!host || !opts) return null;

    var id = String(opts.id || "rec");
    var status = "visible";
    var valueLabel = String(opts.valueLabel || "");
    var description = String(opts.description || "");
    var contextHash = String(opts.contextHash || "");
    var ignoredHash = null;
    var applyAria =
      opts.applyAriaLabel || "Uporabi priporočilo " + valueLabel;
    var ignoreAria = opts.ignoreAriaLabel || "Prezri priporočilo";

    host.classList.add("recommendation-host");
    host.innerHTML =
      '<div class="recommendation-card" data-rec-view="card" hidden>' +
      '  <div class="recommendation-card__header">' +
      '    <span class="recommendation-card__star" aria-hidden="true">★</span>' +
      '    <h3 class="recommendation-card__title" id="recommendation-title-' +
      id +
      '">Priporočilo sistema</h3>' +
      '    <span class="recommendation-card__badge" data-rec="badge"></span>' +
      '    <button type="button" class="recommendation-card__zapri" data-rec="ignore" aria-hidden="false">×</button>' +
      "  </div>" +
      '  <p class="recommendation-card__description" data-rec="desc"></p>' +
      '  <p class="recommendation-card__error" data-rec="error" hidden>' +
      "Priporočila ni bilo mogoče uporabiti. Poskusite znova." +
      "</p>" +
      '  <div class="recommendation-card__actions">' +
      '    <button type="button" class="recommendation-card__button recommendation-card__button--apply" data-rec="apply"></button>' +
      '    <button type="button" class="recommendation-card__button recommendation-card__button--undo" data-rec="undo">Izklopi</button>' +
      "  </div>" +
      "</div>" +
      '<div class="recommendation-compact" data-rec-view="compact" hidden aria-live="polite">' +
      '  <p class="recommendation-compact__tekst">' +
      '    <span aria-hidden="true">★</span> ' +
      '    <span data-rec="compact-text"></span>' +
      "  </p>" +
      '  <button type="button" class="recommendation-compact__akcija" data-rec="compact-action"></button>' +
      "</div>" +
      '<button type="button" class="recommendation-show-again" data-rec-view="show" hidden>' +
      '<span aria-hidden="true">★</span> Prikaži priporočilo' +
      "</button>";

    var card = host.querySelector('[data-rec-view="card"]');
    var compact = host.querySelector('[data-rec-view="compact"]');
    var showAgain = host.querySelector('[data-rec-view="show"]');
    var badgeEl = host.querySelector('[data-rec="badge"]');
    var descEl = host.querySelector('[data-rec="desc"]');
    var errorEl = host.querySelector('[data-rec="error"]');
    var ignoreBtn = host.querySelector('[data-rec="ignore"]');
    var applyBtn = host.querySelector('[data-rec="apply"]');
    var undoBtn = host.querySelector('[data-rec="undo"]');
    var compactText = host.querySelector('[data-rec="compact-text"]');
    var compactAction = host.querySelector('[data-rec="compact-action"]');

    if (card) {
      card.setAttribute("aria-labelledby", "recommendation-title-" + id);
      card.setAttribute("role", "region");
    }

    function syncContent() {
      if (badgeEl) badgeEl.textContent = valueLabel;
      if (descEl) descEl.textContent = description;
      if (ignoreBtn) {
        ignoreBtn.setAttribute("aria-label", ignoreAria);
      }
      if (applyBtn) {
        applyBtn.textContent = "Uporabi priporočilo";
        applyBtn.setAttribute("aria-label", applyAria);
      }
    }

    function setButtonsDisabled(disabled) {
      if (ignoreBtn) ignoreBtn.disabled = disabled;
      if (applyBtn) applyBtn.disabled = disabled;
    }

    function render() {
      syncContent();
      var hasContent = Boolean(valueLabel && description);
      if (!hasContent) {
        status = "visible";
        if (card) card.hidden = true;
        if (compact) compact.hidden = true;
        if (showAgain) showAgain.hidden = true;
        return;
      }

      if (status === "ignored" && ignoredHash && ignoredHash === contextHash) {
        if (card) card.hidden = true;
        if (compact) compact.hidden = true;
        if (showAgain) showAgain.hidden = false;
        return;
      }

      if (status === "ignored") {
        status = "visible";
        ignoredHash = null;
      }

      if (status === "applied") {
        if (card) {
          card.hidden = false;
          card.classList.add("recommendation-card--applied");
        }
        if (showAgain) showAgain.hidden = true;
        if (compact) compact.hidden = true;
        if (errorEl) errorEl.hidden = true;
        if (ignoreBtn) {
          ignoreBtn.hidden = true;
        }
        if (applyBtn) {
          applyBtn.hidden = false;
          applyBtn.disabled = true;
          applyBtn.textContent = "✓ Priporočilo uporabljeno";
        }
        if (undoBtn) {
          undoBtn.hidden = false;
          undoBtn.disabled = typeof opts.onUndo !== "function";
          undoBtn.removeAttribute("aria-hidden");
          undoBtn.tabIndex = 0;
        }
        return;
      }

      if (status === "modified") {
        if (card) card.hidden = true;
        if (showAgain) showAgain.hidden = true;
        if (compact) {
          compact.hidden = false;
          if (compactText) {
            compactText.textContent = "Priporočilo je bilo prilagojeno";
          }
          if (compactAction) {
            compactAction.textContent = "Ponovno uporabi";
            compactAction.hidden = false;
          }
        }
        return;
      }

      // visible | applying | error
      if (card) card.classList.remove("recommendation-card--applied");
      if (compact) compact.hidden = true;
      if (showAgain) showAgain.hidden = true;
      if (card) card.hidden = false;
      if (ignoreBtn) ignoreBtn.hidden = false;
      if (applyBtn) applyBtn.hidden = false;
      if (undoBtn) {
        undoBtn.hidden = false;
        undoBtn.disabled = true;
        undoBtn.setAttribute("aria-hidden", "true");
        undoBtn.tabIndex = -1;
      }
      if (errorEl) errorEl.hidden = status !== "error";
      setButtonsDisabled(status === "applying");
      if (applyBtn) {
        applyBtn.textContent =
          status === "applying" ? "Uporabljam …" : "Uporabi priporočilo";
      }
    }

    function setStatus(next) {
      status = String(next || "visible");
      render();
    }

    function setContent(next) {
      if (!next) return;
      if (next.valueLabel != null) valueLabel = String(next.valueLabel);
      if (next.description != null) description = String(next.description);
      if (next.contextHash != null) contextHash = String(next.contextHash);
      if (next.applyAriaLabel) applyAria = String(next.applyAriaLabel);
      if (next.ignoreAriaLabel) ignoreAria = String(next.ignoreAriaLabel);
      if (
        ignoredHash &&
        contextHash &&
        ignoredHash !== contextHash &&
        status === "ignored"
      ) {
        status = "visible";
        ignoredHash = null;
      }
      render();
    }

    if (ignoreBtn) {
      ignoreBtn.addEventListener("click", function () {
        if (status === "applying") return;
        if (status === "applied" && typeof opts.onUndo === "function") {
          opts.onUndo();
          status = "visible";
          render();
          return;
        }
        ignoredHash = contextHash || "ignored";
        status = "ignored";
        if (typeof opts.onIgnore === "function") opts.onIgnore();
        render();
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener("click", function () {
        if (status === "applying") return;
        status = "applying";
        render();
        Promise.resolve()
          .then(function () {
            return opts.onApply();
          })
          .then(function () {
            status = "applied";
            render();
          })
          .catch(function () {
            status = "error";
            render();
          });
      });
    }

    if (undoBtn) {
      undoBtn.addEventListener("click", function () {
        if (status !== "applied" || typeof opts.onUndo !== "function") return;
        opts.onUndo();
        status = "visible";
        render();
      });
    }

    if (compactAction) {
      compactAction.addEventListener("click", function () {
        if (status === "applied" && typeof opts.onUndo === "function") {
          opts.onUndo();
          status = "visible";
          render();
          return;
        }
        if (status === "modified") {
          var fn = opts.onReapply || opts.onApply;
          if (typeof fn !== "function") return;
          status = "applying";
          render();
          Promise.resolve()
            .then(function () {
              return fn();
            })
            .then(function () {
              status = "applied";
              render();
            })
            .catch(function () {
              status = "error";
              render();
            });
        }
      });
    }

    if (showAgain) {
      showAgain.addEventListener("click", function () {
        ignoredHash = null;
        status = "visible";
        if (typeof opts.onShowAgain === "function") opts.onShowAgain();
        render();
      });
    }

    render();

    return {
      setStatus: setStatus,
      setContent: setContent,
      getStatus: function () {
        return status;
      },
      getContextHash: function () {
        return contextHash;
      },
      destroy: function () {
        host.innerHTML = "";
      },
    };
  }

  function contextHash(deli) {
    var d = deli || {};
    return [
      d.kind || "",
      d.toneId || "",
      d.overdueDays != null ? String(d.overdueDays) : "",
      d.amountCents != null ? String(d.amountCents) : "",
      d.termDays != null ? String(d.termDays) : "",
      d.installments != null ? String(d.installments) : "",
      d.sendDate || "",
      d.templateId || "",
      d.priority != null ? String(d.priority) : "",
    ].join("|");
  }

  var api = { mount: mount, contextHash: contextHash };
  root.UJRecommendationCard = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
