"use strict";

// Kanonični, uporabniško odobreni register widgetov.
// Nov widget se sem ne sme dodati neposredno: najprej mora biti v NAZORJEVA-TEST.js
// in se lahko preseli šele po uporabnikovi izrecni odobritvi.
function widget(number, id, title, approvedAt) {
  return Object.freeze({ number, id, title, status:"approved", approvedAt });
}

const WIDGETS = Object.freeze([
  widget(1, "da-ne-ne-vem", "Posrednik ali izvajalec", "2026-08-30"),
  widget(2, "stevilcna-lestvica", "Trajanje vezave", "2026-08-30"),
  widget(3, "dvojni-segment", "Način obračuna", "2026-08-30"),
  widget(4, "mreza-izbir", "Vloga ponudnika", "2026-08-30"),
  widget(5, "navpicni-izbor", "Vir ponudbe", "2026-08-30"),
  widget(6, "spustni-seznam", "Način plačila", "2026-08-30"),
  widget(7, "besedilni-vnos", "Predmet ponudbe", "2026-08-30"),
  widget(8, "natancen-znesek", "Osnovna cena", "2026-08-30"),
  widget(9, "znesek-ali-odstotek", "Predplačilo", "2026-08-30"),
  widget(10, "kolicina-in-enota", "Količina in enota", "2026-08-30"),
  widget(11, "drsnik-razpona", "Merilo dogovora", "2026-08-30"),
  widget(12, "datum-z-gotovostjo", "Predviden začetek", "2026-08-30"),
  widget(13, "termin-in-pogostost", "Termin izvedbe", "2026-08-30"),
  widget(14, "seznam-postavk", "Najpomembnejši pogoji", "2026-08-30"),
  widget(15, "dokazilo", "Dokazilo", "2026-08-30"),
  widget(16, "razdelitev-proracuna", "Razdelitev proračuna", "2026-08-30"),
  widget(17, "primerjava-moznosti", "Primerjava možnosti", "2026-08-30"),
  widget(18, "casovnica-mejnikov", "Časovnica mejnikov", "2026-08-30"),
  widget(19, "razvrscanje-prioritet", "Razvrstitev prioritet", "2026-08-30"),
  widget(20, "tedenski-termini", "Tedenski termini", "2026-08-30"),
  widget(21, "ocenjevalna-matrika", "Ocenjevalna matrika", "2026-08-30"),
  widget(22, "dvojni-razpon", "Proračunski razpon", "2026-08-30"),
  widget(23, "pogojna-garancija", "Garancija in kritje", "2026-08-30"),
  widget(24, "mini-koledar", "Izbira dneva", "2026-08-30"),
  widget(25, "kontrolni-seznam-dokazil", "Popolnost dokumentacije", "2026-08-30"),
  widget(26, "matrika-tveganja", "Matrika tveganja", "2026-08-30"),
  widget(27, "izbirnik-oznak", "Oznake ponudbe", "2026-08-30"),
  widget(28, "placilni-razrez", "Plačilni razrez", "2026-08-30"),
  widget(29, "trenutno-proti-cilju", "Trenutno proti cilju", "2026-08-30"),
  widget(30, "odlocitvena-pot", "Naslednji korak", "2026-08-30"),
  widget(31, "cenovni-most", "Kako nastane končna cena?", "2026-08-31"),
  widget(32, "trend-odzivnosti", "Trend odzivnosti", "2026-08-31"),
  widget(33, "ciljni-pas", "Ciljni pas", "2026-08-31"),
  widget(34, "ocena-z-negotovostjo", "Ocena z negotovostjo", "2026-08-31"),
  widget(35, "primerjava-sprememb", "Prej in zdaj", "2026-08-31"),
  widget(36, "prekoracitve-praga", "Kateri odgovori so zamujali?", "2026-08-31"),
  widget(37, "hierarhicni-izbor", "Obseg storitve", "2026-08-31"),
  widget(38, "iskalni-izbirnik", "Iskanje ponudnika", "2026-08-31"),
  widget(39, "pravilo-ponavljanja", "Pravilo ponavljanja", "2026-08-31"),
  widget(40, "relativni-rok", "Relativni rok", "2026-08-31"),
  widget(41, "lokacija-in-doseg", "Lokacija in doseg", "2026-08-31"),
  widget(42, "obrocni-nacrt", "Obročni načrt", "2026-08-31"),
  widget(43, "matrika-vkljucenosti", "Kaj je vključeno", "2026-08-31"),
  widget(44, "parna-primerjava", "Parna primerjava", "2026-08-31"),
  widget(45, "pregled-odgovorov", "Pregled odgovorov", "2026-08-31"),
  widget(46, "obcutljivost-izida", "Kaj najbolj spremeni ceno?", "2026-08-31"),
  widget(47, "mesalnik-scenarija", "Koliko denarja potrebujete v rezervi?", "2026-08-31"),
  widget(48, "prag-verjetnosti-zamude", "Koliko zamude še sprejmete?", "2026-08-31"),
  widget(49, "toplotni-koledar", "Zasedenost po dnevih", "2026-08-31"),
  widget(50, "lijak-izterjave", "Od računa do plačila", "2026-08-31"),
  widget(51, "mreza-odvisnosti", "Kaj urediti najprej?", "2026-08-31"),
  widget(52, "pogajalski-prostor", "Dogovor o popustu", "2026-08-31"),
  widget(53, "skupine-odstopanj", "Pregled spornih pogojev", "2026-08-31"),
  widget(54, "pasovi-zmogljivosti", "Kam lahko prestavite delo?", "2026-08-31"),
  widget(55, "ujemanje-pogojev-dokazil", "Povežite dogovor z dokazilom", "2026-08-31"),
  widget(56, "gradnik-pravila-eskalacije", "Kdaj naredimo naslednji korak?", "2026-08-31"),
  widget(57, "sled-izvora-podatka", "Ali lahko podatku zaupate?", "2026-08-31"),
  widget(58, "prag-rentabilnosti", "Kdaj so stroški pokriti?", "2026-08-31"),
  widget(59, "drevo-pricakovane-vrednosti", "Kako najlažje do plačila?", "2026-08-31"),
  widget(60, "kaskada-krsitve", "Kaj naredite, ko nastane težava?", "2026-08-31"),
  widget(61, "graficni-cenovni-most", "Cenovni most", "2026-08-31"),
  widget(62, "sprememba-in-potrditev", "Sprememba in potrditev", "2026-08-31")
]);

module.exports = Object.freeze({
  version:"nazorjeva-v1",
  name:"NAZORJEVA",
  status:"approved",
  widgets:WIDGETS,
  ids:Object.freeze(WIDGETS.map((entry) => entry.id))
});
