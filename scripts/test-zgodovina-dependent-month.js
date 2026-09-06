'use strict';
const assert = require('node:assert/strict');
const dates = require('../app/neplacila-zgodovina-relativni-datumi');
// Regression: "plačal je 4 obroke po 10 evrov mesec dni nazaj vsak obrok je bil v 2 dnevnem razmaku danes je pa plačal 100€".
function chain(month, unit='day', amount=2) {
  return Array.from({length:4}, (_, i) => i === 0
    ? {candidateId:'p0', occurredDate:null, occurredDateKnownYearMonth:month}
    : {candidateId:'p'+i, occurredDate:null, dateRelation:{anchor:'previous_event', field:'occurredDate', anchorCandidateId:'p'+(i-1), direction:1, unit, amount}});
}
const list=chain('2026-08');
dates.razresiDatume(list);
assert.deepEqual(list.map(c=>c.occurredDateKnownYearMonth || c.occurredDateSuggestedYearMonth),Array(4).fill('2026-08'));
assert.ok(list.every(c=>c.occurredDate===null), 'month preset must not invent an exact day');
assert.equal(dates.razresiDatume(list),false,'stable rerender');
list[0].occurredDate='2026-08-29';
dates.razresiDatume(list);
assert.deepEqual(list.map(c=>c.occurredDate),['2026-08-29','2026-08-31','2026-09-02','2026-09-04']);
list[0].occurredDate=null; list[0].occurredDateKnownYearMonth='2025-12';
dates.razresiDatume(list);
assert.ok(list.slice(1).every(c=>c.occurredDateSuggestedYearMonth==='2025-12' && c.occurredDate===null));
list[0].occurredDateUnknown=true; dates.razresiDatume(list);
assert.ok(list.slice(1).every(c=>!c.occurredDateSuggestedYearMonth));
const monthly=chain('2025-12','month',1); dates.razresiDatume(monthly);
assert.deepEqual(monthly.slice(1).map(c=>c.occurredDateSuggestedYearMonth),['2026-01','2026-02','2026-03']);
monthly[1].occurredDateKnownYearMonth='2026-05'; dates.oznaciRocniPopravek(monthly[1],'occurredDate'); dates.razresiDatume(monthly);
assert.equal(monthly[2].occurredDateSuggestedYearMonth,'2026-06');
console.log('PASS dependent installment month presets, exact rollover, unknown anchor, manual override');
