/* ==========================================================
   index.js - logika glavnega zaslona (gumb "Odjava" v headerju).
   ========================================================== */

document.getElementById("gumb-odjava").addEventListener("click", async () => {
  await supabaseKlient.auth.signOut();
  window.location.href = "prijava.html";
});
