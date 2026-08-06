/* Hamburger meni – odpre/zapre seznam povezav */
const nav = document.querySelector(".nav");
const toggle = document.querySelector(".nav__toggle");
const menu = document.querySelector(".nav__menu");

if (nav && toggle && menu) {
  toggle.addEventListener("click", () => {
    const jeOdprt = nav.classList.toggle("is-open");
    menu.hidden = !jeOdprt;
    toggle.setAttribute("aria-expanded", String(jeOdprt));
    toggle.setAttribute("aria-label", jeOdprt ? "Zapri meni" : "Odpri meni");
  });

  /* Ob kliku na povezavo zapri meni (priročno na mobilnem) */
  menu.querySelectorAll("a").forEach((povezava) => {
    povezava.addEventListener("click", () => {
      nav.classList.remove("is-open");
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Odpri meni");
    });
  });
}
