// Unit tests for the ASTRA VITAL engine. Run: node tests/engine.test.js
const assert = require('assert');
const E = require('../src/engine.js');
const DAY = E.DAY; const now = Date.UTC(2026, 10, 15, 12);
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const rec = (metric, d, value, value2) => { const r = { id: metric + d + Math.random(), metric, ts: now - d * DAY, value, value2: value2 ?? null, version: 1 }; r.hash = E.hashRecord(r); return r; };

t('rejects implausible and inconsistent values', () => {
  assert.strictEqual(E.checkQuality(rec('hr', 0, 7)).ok, false);
  assert.strictEqual(E.checkQuality(rec('bp', 0, 80, 95)).ok, false); // diastolic > systolic
  assert.strictEqual(E.checkQuality(rec('spo2', 0, 101)).ok, false);
  assert.strictEqual(E.checkQuality(rec('temp', 0, 36.7)).ok, true);
});
t('SpO2 < 90% is priority', () => {
  const rs = [...Array(8)].map((_, i) => rec('spo2', 8 - i, 98)).concat([rec('spo2', 0, 88)]);
  const a = E.analyze(rs, now); assert(a.some(x => x.metric === 'spo2' && x.level === 'priority'));
  assert.strictEqual(E.status(a), 'priority');
});
t('fever >= 38.0 C is priority, 37.0 is not', () => {
  assert(E.analyze([rec('temp', 0, 38.0)], now).some(x => x.level === 'priority'));
  assert(!E.analyze([rec('temp', 0, 37.0)], now).some(x => x.level === 'priority'));
});
t('three short sleeps -> follow-up', () => {
  const rs = [7.2, 7.1, 7.4, 7.0, 7.3, 6.5, 6.2, 5.9].map((v, i) => rec('sleep', 8 - i, v));
  assert(E.analyze(rs, now).some(x => x.metric === 'sleep' && x.rule === 'reference' && x.level === 'followup'));
});
t('baseline deviation detected (z >= 2)', () => {
  const rs = [60, 61, 62, 60, 61, 62, 60, 75].map((v, i) => rec('hr', 8 - i, v));
  assert(E.analyze(rs, now).some(x => x.metric === 'hr' && x.rule === 'baseline'));
});
t('stable data -> nominal', () => {
  const rs = [61, 62, 60, 61, 62, 61, 60, 61].map((v, i) => rec('hr', 7 - i, v));
  assert.strictEqual(E.status(E.analyze(rs, now)), 'nominal');
});
t('missing data alert after 36 h', () => {
  assert(E.analyze([rec('hr', 3, 62)], now).some(x => x.rule === 'missing'));
});
t('sustained stage-1 blood pressure -> follow-up', () => {
  const rs = [[118, 75], [117, 74], [132, 82], [134, 83], [131, 81]].map((v, i) => rec('bp', 5 - i, v[0], v[1]));
  assert(E.analyze(rs, now).some(x => x.metric === 'bp' && x.level === 'followup'));
});
t('every alert explains what, why, action and contact', () => {
  const rs = [rec('spo2', 0, 88), rec('hr', 0, 7), rec('temp', 0, 38.4)];
  E.analyze(rs, now).forEach(a => ['title', 'changed', 'why', 'action', 'contact', 'level'].forEach(k => assert(a[k], k + ' missing')));
});
t('sync merge: adds new, updates newer version, reports conflicts', () => {
  const a = rec('hr', 1, 60); const b = Object.assign({}, a, { value: 61, version: 2 }); b.hash = E.hashRecord(b);
  let m = E.mergeInto([], [a]); assert.strictEqual(m.result.added, 1);
  m = E.mergeInto(m.records, [b]); assert.strictEqual(m.result.updated, 1);
  const c = Object.assign({}, b, { value: 70 }); c.hash = E.hashRecord(c);
  m = E.mergeInto(m.records, [c]); assert.strictEqual(m.result.conflicts.length, 1);
});
console.log(`\n${n} tests passed`);
