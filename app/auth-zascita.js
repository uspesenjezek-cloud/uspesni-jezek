/* ==========================================================
   auth-zascita.js - varuje app strani pred neprijavljenimi obiskovalci.

   Vključi to skripto na VSAKO app stran RAZEN prijava.html (na
   prijava.html bi povzročila neskončno preusmerjanje, ker takrat
   uporabnik še nima seje).

   Če uporabnik ni prijavljen, ga takoj preusmeri na prijava.html.
   ========================================================== */

(async function preveriPrijavo() {
  const { data } = await supabaseKlient.auth.getSession();
  if (!data.session) {
    window.location.href = "prijava.html";
  }
})();
