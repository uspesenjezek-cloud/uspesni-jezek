"use strict";

var REFERENCE_DATE = "2026-08-29";
var REMAINING_DEBT = 9446;
var DATES = [
  "2026-09-03", "2026-09-11", "2026-09-19", "2026-09-27", "2026-10-05",
  "2026-10-14", "2026-10-23", "2026-11-02", "2026-11-13", "2026-11-24",
  "2026-12-06", "2026-12-18", "2027-01-04", "2027-01-19", "2027-02-03",
  "2027-02-21", "2027-03-12", "2027-04-07", "2027-05-16", "2027-06-30",
];
var AMOUNTS = [35, 48, 63, 79, 95, 120, 145, 175, 210, 260, 325, 410, 525, 680, 875, 1100, 1450, 1900, 2750, 4200];
var CHANNELS = [
  { value: "phone", phrase: "po telefonu" }, { value: "email", phrase: "po e-pošti" },
  { value: "message", phrase: "v SMS sporočilu" }, { value: "in_person", phrase: "osebno na sestanku" },
  { value: "letter", phrase: "v pisnem dopisu" },
];
var DISPUTE_REASONS = [
  "ker količina na računu ne ustreza dobavi", "zaradi dveh zaračunanih ur preveč", "ker material po njegovem ni bil naročen",
  "zaradi domnevno napačne cene prevoza", "ker manjka podpis na prevzemnici", "zaradi reklamacije kakovosti izvedbe",
  "ker trdi, da je račun že zajet v avansu", "zaradi napačno navedene davčne stopnje", "ker ne priznava dodatnih del",
  "zaradi neusklajenega popusta",
];
var EXTENSION_REASONS = [
  "ker čaka nakazilo naročnika", "zaradi bolniške odsotnosti", "ker ima začasno blokiran račun", "zaradi zamude pri svojem projektu",
  "ker pričakuje vračilo davka", "zaradi sezonskega izpada prihodkov", "ker banka še obdeluje kredit", "zaradi zamujene plače",
  "ker prodaja službeno vozilo", "zaradi čakanja na zavarovalnino", "ker usklajuje financiranje", "zaradi nepričakovanega stroška materiala",
  "ker mu naročnik še ni potrdil situacije", "zaradi zamude pri subvenciji", "ker je računovodstvo odsotno", "zaradi menjave banke",
  "ker čaka izplačilo leasinga", "zaradi likvidnostne vrzeli", "ker pričakuje plačilo iz tujine", "zaradi začasne ustavitve poslovanja",
];
var REFUSAL_REASONS = [
  "dokler ne dobi nove specifikacije", "ker trenutno noče nameniti denarja za ta račun", "ker denarja preprosto noče porabiti za poravnavo",
  "ker je njegova odločitev o neplačilu dokončna", "dokler ne prejme zapisnika", "ker daje prednost drugim obveznostim", "dokler se ne zaključi reklamacija",
  "ker je plačilo izrecno zavrnil", "dokler mu ne pošljemo fotografij", "brez kakršnegakoli dodatnega pojasnila",
];

function slovenianDate(iso) {
  var parts = iso.split("-");
  return Number(parts[2]) + ". " + Number(parts[1]) + ". " + parts[0];
}
function channel(index) { return CHANNELS[index % CHANNELS.length]; }
function cap(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

function paymentParaphrases(object, date, channelPhrase) {
  var day = slovenianDate(date);
  return [
    "Dolžnik je obljubil, da bo " + object + " plačal do " + day + ", dogovor pa je podal " + channelPhrase + ".",
    "Dogovorila sva se " + channelPhrase + ": " + object + " bo poravnal najpozneje do " + day + ".",
    "Pristal je na to, da do " + day + " nakaže " + object + "; potrditev je bila " + channelPhrase + ".",
    "Njegova zaveza " + channelPhrase + " je jasna — do " + day + " bo plačal " + object + ".",
    "Potrdil je " + channelPhrase + ", da bo " + object + " poravnal do " + day + ".",
    "Za plačilo " + object + " je sprejel rok " + day + "; to je sporočil " + channelPhrase + ".",
    cap(channelPhrase) + " je rekel: »" + object + " bom plačal do " + day + ".«",
    "Rok je " + day + ", znesek pa " + object + "; dolžnik se je " + channelPhrase + " zavezal k plačilu.",
    "Najpozneje do " + day + " bo po lastni obljubi poravnal " + object + ". Obljubo je dal " + channelPhrase + ".",
    "Izrecno je pristal na plačilo " + object + " z datumom " + day + " in to " + channelPhrase + ".",
    "Sporočeno " + channelPhrase + ": dolžnik bo do " + day + " nakazal " + object + ".",
    "Za " + day + " sva določila plačilo " + object + "; dolžnik je dogovor potrdil " + channelPhrase + ".",
    "Plačilo " + object + " je obljubil za " + day + ", ko sva govorila " + channelPhrase + ".",
    "Po dogovoru, sklenjenem " + channelPhrase + ", mora dolžnik do " + day + " poravnati " + object + ".",
    "Dolžnik pravi, da bo " + object + " nakazal do " + day + "; izjavo imamo " + channelPhrase + ".",
    "Zavezal se je k temu, da do " + day + " plača " + object + ", dogovorjeno " + channelPhrase + ".",
    "Dogovor o prihodnjem plačilu je bil dosežen " + channelPhrase + ": " + object + " zapade " + day + ".",
    "Na predlog plačila " + object + " do " + day + " je pristal " + channelPhrase + ".",
    "Dolžnik bo, kot je potrdil " + channelPhrase + ", do " + day + " poravnal " + object + ".",
    "Končni dogovor: " + object + " bo plačan do " + day + "; dolžnik ga je sprejel " + channelPhrase + ".",
  ];
}
function installmentParaphrases(count, amount, date, channelPhrase) {
  var money = amount + " EUR";
  var day = slovenianDate(date);
  return [
    "Obljubil je " + count + " obroke po " + money + ", prvi bo plačan do " + day + "; dogovorjeno " + channelPhrase + ".",
    cap(channelPhrase) + " sva določila: " + count + " obrokov, vsak po " + money + ", začetek do " + day + ".",
    "Pristal je na obročno plačilo — " + count + " krat po " + money + ", prvi rok " + day + ". Potrdil je " + channelPhrase + ".",
    "Dogovor o " + count + " obrokih po " + money + " določa prvi obrok do " + day + "; dolžnik ga je sprejel " + channelPhrase + ".",
    "Dolžnik bo plačeval v " + count + " obrokih po " + money + ", prvega do " + day + ", kot je povedal " + channelPhrase + ".",
    "Za dolg je potrdil načrt " + count + " obrokov; posamezni obrok znaša " + money + ", prvi je " + day + ", dogovor " + channelPhrase + ".",
    "Zavezal se je " + channelPhrase + " k " + count + " plačilom po " + money + ", pri čemer prvo zapade do " + day + ".",
    "Prvi od " + count + " obrokov po " + money + " bo nakazan do " + day + "; tako sva se dogovorila " + channelPhrase + ".",
    "Obročno poravnavo je sprejel " + channelPhrase + ": " + count + " obrokov po " + money + ", začetek " + day + ".",
    "Plačilo bo razdelil na " + count + " obrokov po " + money + "; za prvi obrok je obljubil datum " + day + " " + channelPhrase + ".",
    "Sporočil je " + channelPhrase + ", da bo dolg poravnal v " + count + " obrokih po " + money + " od " + day + ".",
    "Na predlog " + count + " zaporednih obrokov po " + money + " je pristal; prvi rok je " + day + ", potrjeno " + channelPhrase + ".",
    "Dogovorili smo " + count + " obrokov, vsak v višini " + money + ", s prvim plačilom do " + day + "; komunikacija " + channelPhrase + ".",
    "Dolžnik je obljubil, da bo od " + day + " dalje plačal " + count + " obrokov po " + money + "; izjavo je dal " + channelPhrase + ".",
    "Za obročno rešitev je izbral " + count + " plačil po " + money + ", začetek do " + day + ", in jo potrdil " + channelPhrase + ".",
    "Razpored: " + count + " obrokov po " + money + ", prvi " + day + ". Dolžnik se je k temu zavezal " + channelPhrase + ".",
    "Sprejel je obveznost " + count + " obročnih nakazil po " + money + "; prvo bo izvedel do " + day + ", dogovorjeno " + channelPhrase + ".",
    "Po dogovoru " + channelPhrase + " bo plačilo izvedeno v " + count + " obrokih po " + money + ", prvi del " + day + ".",
    "Potrdil je obroke: " + count + " po " + money + ", z začetnim rokom " + day + "; potrditev " + channelPhrase + ".",
    "Končni obročni dogovor je " + count + " obrokov po " + money + " od " + day + "; dolžnik je pristal " + channelPhrase + ".",
  ];
}
function extensionParaphrases(date, channelPhrase, reason) {
  var day = slovenianDate(date);
  return [
    "Dolžnik je prosil za nov rok " + day + " " + reason + "; prošnjo je podal " + channelPhrase + ".",
    cap(channelPhrase) + " sva se dogovorila za podaljšan rok do " + day + " " + reason + ".",
    "Pristal je na dodatni rok plačila " + day + "; razlog je navedel " + reason + ", vse " + channelPhrase + ".",
    "Novi rok je po dogovoru " + day + ", " + reason + "; dolžnik ga je potrdil " + channelPhrase + ".",
    "Za podaljšanje roka do " + day + " je zaprosil " + channelPhrase + " " + reason + ".",
    "Dogovorjen je dodatni rok: " + day + ". Dolžnik pravi, da ga potrebuje " + reason + ", sporočeno " + channelPhrase + ".",
    "Rok plačila sva prestavila na " + day + "; nov rok je zahteval " + channelPhrase + " " + reason + ".",
    "Dolžnik je " + channelPhrase + " sprejel podaljšan rok, ki se izteče " + day + ", " + reason + ".",
    "Do " + day + " velja novi rok plačila; prošnja je prišla " + channelPhrase + " in temelji na tem, da " + reason + ".",
    "Dodatni rok do " + day + " je potrjen " + channelPhrase + ", potem ko je pojasnil, da ga potrebuje " + reason + ".",
    "Sporočil je " + channelPhrase + ", naj določimo nov rok " + day + " " + reason + ".",
    "Na datum " + day + " smo premaknili plačilo; podaljšan rok je bil dogovorjen " + channelPhrase + " " + reason + ".",
    "Za račun zdaj velja novi rok " + day + ", potrjen " + channelPhrase + "; pojasnilo: " + reason + ".",
    "Prošnja za dodatni rok se glasi na " + day + " in je bila dana " + channelPhrase + " " + reason + ".",
    "Dolžnik je zahteval podaljšan rok do " + day + ", ker pravi, da ga potrebuje " + reason + "; kontakt " + channelPhrase + ".",
    "Novi dogovorjeni rok plačila je " + day + "; sprejet je bil " + channelPhrase + " zaradi tega, ker " + reason + ".",
    "Plačilni rok je dodatno podaljšan do " + day + ", kot je dolžnik prosil " + channelPhrase + " " + reason + ".",
    "Dogovor o novem roku do " + day + " je nastal " + channelPhrase + "; dolžnikov razlog je, da " + reason + ".",
    "Potrdili smo dodatni rok " + day + ", zahtevan " + channelPhrase + " " + reason + ".",
    "Končni podaljšan rok je " + day + "; dolžnik ga je predlagal " + channelPhrase + " in navedel, da " + reason + ".",
  ];
}
function disputeParaphrases(reason, channelPhrase) {
  return [
    "Dolžnik ugovarja računu " + reason + "; ugovor je podal " + channelPhrase + ".",
    cap(channelPhrase) + " je povedal, da računa ne prizna " + reason + ".",
    "Račun reklamira " + reason + ", kar je sporočil " + channelPhrase + ".",
    "Po njegovem je račun sporen " + reason + "; izjavo smo prejeli " + channelPhrase + ".",
    "Izrecno ugovarja zaračunanemu znesku " + reason + ", in sicer " + channelPhrase + ".",
    "Dolžnik računa ne priznava " + reason + "; kontakt je bil " + channelPhrase + ".",
    "Ugovor na račun je vložil " + channelPhrase + " z obrazložitvijo, da " + reason + ".",
    "Reklamira izdani račun, saj pravi, da " + reason + "; to je navedel " + channelPhrase + ".",
    "Sporen mu je račun " + reason + ", o čemer nas je obvestil " + channelPhrase + ".",
    "Zavrnil je priznanje računa " + reason + "; njegov ugovor je prišel " + channelPhrase + ".",
    "Sporočeno " + channelPhrase + ": dolžnik ugovarja računu " + reason + ".",
    "Njegova reklamacija se nanaša na račun " + reason + "; podana je bila " + channelPhrase + ".",
    "Računu oporeka " + reason + ", kot je pojasnil " + channelPhrase + ".",
    "Ne priznava obveznosti iz računa " + reason + "; izjavo je dal " + channelPhrase + ".",
    "Dolžnik je račun označil kot sporen " + reason + ", ko smo govorili " + channelPhrase + ".",
    "Formalno ugovarja računu " + reason + "; ugovor je bil poslan " + channelPhrase + ".",
    "Reklamacijo računa utemeljuje s tem, da " + reason + ", prejeto " + channelPhrase + ".",
    "Na plačilo računa je podal ugovor " + reason + "; komunikacija je potekala " + channelPhrase + ".",
    "Računa ne sprejema " + reason + " in ga zato reklamira " + channelPhrase + ".",
    "Končna izjava dolžnika je, da je račun sporen " + reason + "; dana je bila " + channelPhrase + ".",
  ];
}
function refusalParaphrases(reason, channelPhrase) {
  return [
    "Dolžnik je povedal, da ne bo plačal " + reason + "; izjavo je dal " + channelPhrase + ".",
    cap(channelPhrase) + " je plačilo zavrnil " + reason + ".",
    "Izrecno je zavrnil plačilo " + reason + ", sporočeno " + channelPhrase + ".",
    "Njegovo stališče je, da ne bo poravnal računa " + reason + "; kontakt " + channelPhrase + ".",
    "Dolžnik plačila ne namerava izvesti " + reason + ", kar je potrdil " + channelPhrase + ".",
    "Povedal je " + channelPhrase + ", da ne bo plačal " + reason + ".",
    "Plačilo je zavrnil z navedbo, da " + reason + "; odgovor smo prejeli " + channelPhrase + ".",
    "Ne bo poravnal dolga " + reason + ", kot je izjavil " + channelPhrase + ".",
    "Dolžnik ostaja pri zavrnitvi plačila " + reason + "; to je sporočil " + channelPhrase + ".",
    "Sporočeno " + channelPhrase + ": računa ne bo plačal " + reason + ".",
    "Odklonil je plačilo " + reason + " in to povedal " + channelPhrase + ".",
    "Njegov odgovor na zahtevo je zavrnitev plačila " + reason + ", podana " + channelPhrase + ".",
    "Plačati noče " + reason + "; izjava je bila dana " + channelPhrase + ".",
    "Dolžnik je " + channelPhrase + " jasno dejal, da ne bo plačal " + reason + ".",
    "Zavrnil je možnost poravnave računa " + reason + ", komunikacija " + channelPhrase + ".",
    "Ne namerava poravnati obveznosti " + reason + "; tako je odgovoril " + channelPhrase + ".",
    "Njegova odločitev je: plačila ne bo " + reason + ". To je potrdil " + channelPhrase + ".",
    "Račun bo ostal neplačan " + reason + ", saj je dolžnik plačilo zavrnil " + channelPhrase + ".",
    "Na plačilo ni pristal " + reason + "; zavrnitev je sporočil " + channelPhrase + ".",
    "Končno je izjavil, da ne bo plačal " + reason + ", in sicer " + channelPhrase + ".",
  ];
}

function buildBases() {
  var bases = [];
  for (var i = 0; i < 20; i += 1) {
    var ch = channel(i);
    bases.push({ id: "promise-" + String(i + 1).padStart(2, "0"), family: "payment_promise", expected: { type: "payment_promise", amount: AMOUNTS[i], date: DATES[i], channel: ch.value }, variants: paymentParaphrases(AMOUNTS[i] + " EUR", DATES[i], ch.phrase) });
  }
  for (var j = 0; j < 20; j += 1) {
    var fullChannel = channel(j + 2);
    var fullDate = DATES[(j + 7) % DATES.length];
    bases.push({ id: "full-debt-" + String(j + 1).padStart(2, "0"), family: "full_debt_promise", expected: { type: "payment_promise", amount: REMAINING_DEBT, date: fullDate, channel: fullChannel.value }, variants: paymentParaphrases(j % 2 ? "ves preostanek" : "celoten dolg", fullDate, fullChannel.phrase) });
  }
  for (var k = 0; k < 20; k += 1) {
    var installmentChannel = channel(k + 1);
    var count = 2 + (k % 7);
    var installmentAmount = AMOUNTS[(k + 5) % AMOUNTS.length];
    var installmentDate = DATES[(k + 3) % DATES.length];
    bases.push({ id: "installments-" + String(k + 1).padStart(2, "0"), family: "installment_agreement", expected: { type: "installment_agreement", amount: installmentAmount, date: installmentDate, channel: installmentChannel.value }, variants: installmentParaphrases(count, installmentAmount, installmentDate, installmentChannel.phrase) });
  }
  for (var m = 0; m < 20; m += 1) {
    var extensionChannel = channel(m + 3);
    var extensionDate = DATES[(m + 11) % DATES.length];
    bases.push({ id: "extension-" + String(m + 1).padStart(2, "0"), family: "deadline_extension", expected: { type: "deadline_extension", amount: null, date: extensionDate, channel: extensionChannel.value }, variants: extensionParaphrases(extensionDate, extensionChannel.phrase, EXTENSION_REASONS[m]) });
  }
  for (var n = 0; n < 10; n += 1) {
    var disputeChannel = channel(n + 4);
    bases.push({ id: "dispute-" + String(n + 1).padStart(2, "0"), family: "invoice_dispute", expected: { type: "invoice_dispute", amount: null, date: null, channel: disputeChannel.value }, variants: disputeParaphrases(DISPUTE_REASONS[n], disputeChannel.phrase) });
  }
  for (var p = 0; p < 10; p += 1) {
    var refusalChannel = channel(p);
    bases.push({ id: "refusal-" + String(p + 1).padStart(2, "0"), family: "debtor_statement", expected: { type: "debtor_statement", amount: null, date: null, channel: refusalChannel.value }, variants: refusalParaphrases(REFUSAL_REASONS[p], refusalChannel.phrase) });
  }
  return bases;
}
var BASES = buildBases();
var CASES = BASES.flatMap(function (base) {
  return base.variants.slice(0, 10).map(function (text, index) {
    return { baseIntentId: base.id, family: base.family, paraphraseId: index + 1, text: text, expected: base.expected };
  });
});

module.exports = { REFERENCE_DATE: REFERENCE_DATE, REMAINING_DEBT: REMAINING_DEBT, BASES: BASES, CASES: CASES };
