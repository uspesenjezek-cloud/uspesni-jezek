"use strict";

// Samo pozitiven signal: neznano ime ni nikoli razlog za zavrnitev.
// Lokalni Set nima omreznega klica in ima konstanten cas preverjanja.
var GIVEN_NAMES = new Set((
  "aaron abdallah abdel abdullah adam adem adnan adrian ahmad ahmed ahmet " +
  "aleksandar aleksander alex alexander ali alina amina amir ammar ana anastasia " +
  "andreas andrej andrei anna anton antonio arda armin arslan artur ayhan aylin " +
  "ayse aziz baran benjamin bilal bojan boris branko burak carlos cem christian " +
  "christina christoph daniel daniela dario david denis dennis dejan diana dimitri " +
  "dragan edina edward elena elif elmar emir emre enes ercan erdem erhan erik erkan " +
  "eva fabian farid fatih fatima filip florian francesco frank gabriel georg george " +
  "giovanni gokhan gregor hakan hamza hans harun hasan helena ibrahim igor ilhan " +
  "ilija irina ivan ivo jaqueline jakob jana janis jasmin jaweed jens joachim johann " +
  "johannes jonas josef julia kadir karim katarina katja kenan klaus kristian " +
  "kristina kristof leon luka lukas marc marco maria marija mario marko markus martin " +
  "martina matthias max maxim mehmet melanie michael mihail milan milena milos miran " +
  "mirza mohamad mohamed mohammad muhammed murat mustafa natalia nikola nina oliver " +
  "osman patrick paul peter philipp piotr rafal ramazan robert roman sabine samir " +
  "sandra sascha sebastian selim sergej sinan stefan steffen stephen tanja thomas tim " +
  "tobias tomas viktor waled wolfgang yasin yusuf zeljko zorica"
).split(/\s+/));

function normalize(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z]+/g, "").trim();
}

function score(value) {
  var parts = String(value || "").split(/\s+/).map(normalize).filter(Boolean);
  if (parts.length < 2) return 0;
  var hits = parts.reduce(function (sum, part) { return sum + (GIVEN_NAMES.has(part) ? 1 : 0); }, 0);
  return hits > 1 ? 2 : hits;
}

module.exports = { score: score, size: GIVEN_NAMES.size };
