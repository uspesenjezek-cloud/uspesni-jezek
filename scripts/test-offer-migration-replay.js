"use strict";
// A deterministic migration replay model, not a replacement for PostgreSQL CI.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = require("../app/ponudba-moduli-engine");
const read = (file) => fs.readFileSync(path.join(__dirname, "../supabase/migrations", file), "utf8");
const before = read("20260829210652_ponudba_modularni_katalog.sql");
const after = read("20260829223000_offer_lego_modules_v2.sql");
function fields(sql) {
  const values = sql.split("insert into public.offer_review_fields")[1].split("values")[1].split(/on conflict|alter table/)[0];
  const rows = [];
  let quoted = false, start = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === "'") {
      if (quoted && values[i + 1] === "'") { i++; continue; }
      quoted = !quoted;
    }
    if (!quoted && values[i] === "(") start = i + 1;
    if (!quoted && values[i] === ")") {
      const tuple = values.slice(start, i);
      const head = tuple.match(/^(\d+),(\d+),'([^']+)'/);
      rows.push({id:+head[1], module:+head[2], code:head[3], order:+tuple.match(/,(\d+)$/)[1]});
    }
  }
  return rows;
}
const legacy = fields(before), added = fields(after);
const moves = [...after.split("with premik")[1].split("), razvrstitev")[0].matchAll(/\((\d+),(\d+)\)/g)].map(m => ({id:+m[1], module:+m[2]}));
const parked = after.match(/moved_ids integer\[\] := array\[([\d,]+)\]/)[1].split(",").map(Number);
assert.equal(legacy.length, 51);
assert.deepEqual([...parked].sort(), moves.map(m => m.id).sort());
assert.match(after, /sort_order = -id where id = any\(moved_ids\)/);
assert.match(after, /occupied\.sort_order = -moved\.id/);
assert.match(after, /sort_order <= 0/);
assert.ok(after.indexOf("sort_order = -id") < after.indexOf("with premik"));
const rename = after.match(/set code='([^']+)' where id=5611/)[1];
function replay(reverse, parking, renaming) {
  const rows = legacy.map(r => ({...r}));
  const custom = {id:9999,module:4006,code:"custom-field",order:30};
  rows.push(custom);
  function update(id, patch) {
    const row = rows.find(r => r.id === id), next = {...row,...patch};
    assert.ok(!rows.some(r => r.id !== id && r.module === next.module && r.order === next.order), "ordering collision");
    assert.ok(!rows.some(r => r.id !== id && r.code === next.code), "code collision");
    if (row) Object.assign(row,next); else rows.push(next);
  }
  if (parking) for (const id of parked) update(id,{order:-id});
  if (renaming) update(5611,{code:rename});
  const planned = moves.map(m => ({...m,order:moves.filter(x => x.module === m.module && x.id <= m.id).length}));
  for (const m of reverse ? planned.reverse() : planned) update(m.id,{module:m.module,order:m.order});
  for (const id of [5602,5611]) update(id,{order:2});
  for (const row of added) update(row.id,row);
  assert.deepEqual(custom,{id:9999,module:4006,code:"custom-field",order:30});
  assert.equal(rows.length,61);
  for (const old of legacy) assert.ok(rows.some(r => r.id === old.id), "answer FK target retained");
  for (const id of [5002,5611]) assert.equal(rows.find(r=>r.id===id).code,engine.fields.find(r=>r.id===id).code);
}
assert.throws(()=>replay(false,false,false),/ordering collision/);
assert.throws(()=>replay(false,true,false),/code collision/);
replay(false,true,true);
replay(true,true,true);
console.log("Offer migration replay model: OK (ordering, unique codes, stable IDs, custom row)");
