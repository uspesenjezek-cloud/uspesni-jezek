"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

var center = source("app/boniteta-sredisce.js");
var css = source("app/boniteta-pro.css");
var shellCss = source("app/bonitetna-preverba.css");
var html = source("app/bonitetna-preverba.html");

assert.ok(
  center.includes("if(profilesLoading)return") && center.includes("finally{profilesLoading=false}"),
  "sočasni ali ponovljeni kliki ne smejo ustvariti vzporednih nalaganj profilov"
);
assert.ok(
  center.includes('state.textContent="Nalagam preverjene stranke …"') &&
    center.includes("Preverjenih podjetij trenutno ni bilo mogoče naložiti.") &&
    center.includes("data-retry-profiles") &&
    center.includes("Poskusi znova"),
  "neuspešen klic mora končati vrteče stanje in ponuditi ponovni poskus"
);
assert.ok(
  center.includes('el("bp-profile-count").textContent="0"') &&
    center.includes('grid.innerHTML=""') &&
    center.includes("profilesLoaded=false"),
  "neuspeh ne sme prikazati zastarelega števca ali zastarelih kartic kot aktualne"
);
assert.ok(
  css.includes(".bp-state__retry") && /boniteta-sredisce\.js\?v=[^"']+-v\d+/.test(html),
  "ponovni poskus mora biti oblikovan in dostavljen z novo različico sredstva"
);
assert.ok(
  /id="bp-profiles"[^>]*aria-label="Preverjena podjetja"[\s\S]*?id="bp-profile-count" hidden/.test(html) &&
    !/id="bp-profiles"[^>]*>[\s\S]*?<div class="bp-panel-head"><h3>Preverjena podjetja<\/h3>/.test(html),
  "vidna naslovna vrstica Preverjena podjetja mora biti odstranjena, skriti števec pa mora ostati povezan"
);
assert.ok(
  css.includes("#bp-profiles { padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; }") &&
    css.includes("#bp-profiles .bp-profile-card") && css.includes("border-radius:18px"),
  "profilne kartice morajo biti samostojni widgeti brez zunanjega panela"
);
assert.ok(
  /id="boniteta-center-active"[^>]*aria-label="Spremljana podjetja"[\s\S]*?id="bp-watched"[\s\S]*?Spremljamo 0 podjetij/.test(html) &&
    /data-boniteta-center-view="active"[\s\S]*?<span data-fit-text>Spremljano<\/span>/.test(html),
  "srednji pogled mora prikazovati dejansko spremljana podjetja in biti poimenovan Spremljano"
);
assert.ok(
  center.includes('function profileInitials(name)') && center.includes('function profileInsight(p)') &&
    center.includes('function companyCard(p)') && center.includes('rows.map(companyCard)') &&
    center.includes('function watchedCard(m){return profileCard(watchedProfile(m),m)}') &&
    html.includes('id="bp-profiles-grid" class="bp-grid bp-profiles-list"') &&
    html.includes('id="bp-watched-grid" class="bp-grid bp-profiles-list"') &&
    center.includes('if(!companyCardsPreview&&!monitoringStatesPreview)loadWatched()'),
  "Podjetja uporabljajo svoj obstoječi widget z dodatno akcijo, Spremljano pa ohrani spremljevalno kartico"
);
assert.ok(
  center.includes('resultHtml=monitor?monitoringResultHtml(p,monitor,profileHref,defaultInsight):defaultInsight'),
  "spremljevalni rezultat se sme prikazati samo v pogledu Spremljano, Podjetja pa ohranijo navadni widget zadnje preverbe"
);
assert.ok(
  shellCss.includes("#bp-watched .bp-profile-card__izberi { display: none; }") &&
    shellCss.includes("#bp-profiles.is-comparison-open .bp-profile-card__izberi"),
  "Spremljano mora skriti primerjalni izbirnik, profili pa ga morajo ohraniti"
);
assert.ok(
  center.includes('<span>Nova preverba</span>') && center.includes('<span>Spremljaj</span>') &&
    center.includes('section=monitoring#new') &&
    center.includes('function applyWatchedNextDates(grid,monitors){applyProfileMonitoringStates(grid,monitors)}'),
  "obe kartici morata imeti isto novo preverbo ter isti gumb spremljanja"
);
assert.ok(
  center.includes('class="bp-card-actions"><a class="bp-secondary"') &&
    center.includes('data-fit-text data-fit-text-min="10">'+"'+shieldIcon()+'"+'<span>Spremljaj</span>') &&
    center.includes('<span>Nova preverba</span>') &&
    center.includes('<strong>Poglej zadnjo preverbo</strong>') &&
    center.includes('newCheckHref="bonitetna-preverba.html?profile="+encodeURIComponent(p.id)+"&recheck=1#new"') &&
    center.includes('function openProfileMonitoring(link,event)') &&
    center.includes('openMonitoringSetup([{name:profile.legal_name||"Podjetje",profileId:profile.id||"",monitoring:monitoring}]') &&
    center.includes('label.textContent="Spremeni spremljanje"') &&
    center.includes('return"Naslednja preverba: "+datum') &&
    center.includes('api("/api/boniteta-profili?view=watched")') &&
    center.includes('window.UJBonitetaPonovnoPreveriProfil(profile)') &&
    center.includes('insight.tone==="danger"?profileIcon("danger"):shieldIcon()') &&
    center.includes("bp-company-card__avatar '+(inactive?'is-inactive':'is-active')+'") &&
    center.includes('class="bp-company-card__state ') &&
    center.includes('class="bp-company-card__meta"'),
  "profilna kartica mora odpreti zadnji rezultat, isto okno spremljanja, pripraviti novo preverbo in barvno označiti avatar"
);
assert.ok(
  source("app/bonitetna-preverba.js").includes('window.UJBonitetaPonovnoPreveriProfil = async function (profile)') &&
    source("app/bonitetna-preverba.js").includes('recheckMode: "saved_profile"') &&
    source("api/_lib/mehka-boniteta-queue.js").includes('telo && telo.recheckMode === "saved_profile" ? null') &&
    source("api/_handlers/mehka-boniteta.js").includes('telo.recheckMode === "saved_profile"'),
  "Nova preverba mora v ozadju ustvariti sveže opravilo, ohraniti aktivno deduplikacijo in nato prikazati rezultat"
);
assert.ok(
  shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-card-actions { margin: 12px 0 0;') &&
    shellCss.includes('grid-template-columns: minmax(104px,.78fr) minmax(0,1.22fr)') &&
    shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-card-actions .bp-primary { border: 1px solid #0b8f91;') &&
    shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-card-delete { top: 12px; right: 12px; width: 30px; height: 30px; border: 1px solid #e1e8e6; border-radius: 50%;'),
  "Spremljaj mora biti levo, Nova preverba desno, izbris pa v okroglem zgornjem kontrolniku"
);
assert.ok(
  shellCss.includes('.bp-secondary.is-monitored') &&
    center.includes('function applyMonitoringNextText') &&
    center.includes('card&&card.querySelector(".bp-monitoring-next span")||card&&card.querySelector(".bp-company-card__insight small")') &&
    !center.includes('function appendMonitoringNextLine') &&
    !shellCss.includes('.bp-company-card__next-check') &&
    shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-monitoring-next'),
  "običajna kartica ohrani termin v informacijskem bloku, primerjalno stanje pa ga prikaže v kompaktni namenski vrstici"
);
assert.ok(
  html.includes('id="boniteta-spremljanje-ura" type="time" value="12:00"') &&
    center.includes('checkTime:el("boniteta-spremljanje-ura").value') &&
    center.includes('checkTime:schedule.checkTime') &&
    center.includes('" · ob "+schedule.checkTime') &&
    shellCss.includes('.boniteta-spremljanje-obdobje__ura'),
  "okno spremljanja mora ponuditi desno poravnano uro 12:00 in jo poslati razporejevalniku"
);
assert.ok(
  shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-company-card__insight.is-danger { border: 1px solid #efc4c0;') &&
    shellCss.includes('linear-gradient(135deg,#fff8f7,#fdeceb)') &&
    shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-company-card__insight.is-danger strong { color: #a4443f; }') &&
    shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-company-card__avatar.is-inactive { border: 2px solid #d65a54;') &&
    shellCss.includes('background: #fdecea; color: #b44742;'),
  "neaktivno podjetje mora imeti rdeč opozorilni odtenek in jasno obrobljen avatar"
);
assert.ok(
  shellCss.includes(".bp-company-card__header") && shellCss.includes(".bp-company-card__insight") &&
    shellCss.includes(".boniteta-watched-summary") && shellCss.includes("grid-template-columns: repeat(2,minmax(0,1fr))"),
  "oba pogleda morata uporabljati enoten kompaktni sistem kartic in povzetkov"
);

console.log("Moja podjetja — zaključek nalaganja in ponovni poskus: OK");
