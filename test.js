/* ============================================================
   test.js — regression tests for the money maths and the
   import guards.  Run with:  node test.js
   (Needs Node 14+, for `??` and `?.` in app.js.)
   ============================================================ */

const A = require('./app.js');

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ok   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg); }
};
const group = name => console.log('\n' + name);
const sum = o => Object.keys(o).reduce((a, k) => a + o[k], 0);

const person = (id, name) => ({ id, name, avatar: '🐨' });
const trip = (people, expenses, extra = {}) =>
  A.normalizeTrip(Object.assign({ name: 'T', people, expenses, settlements: [] }, extra));
const expense = (o = {}) => Object.assign({
  id: 'e1', title: 'Thing', amount: 90, currency: 'SGD', rate: 1,
  payerId: 'a', participants: ['a', 'b'], splitMode: 'equal',
  date: '2026-01-01', category: 'food',
}, o);

/* ---------------------------------------------------------------- */
group('Invariants that must always hold');

[[10, 3], [0.01, 3], [100, 7], [3000, 6], [0.05, 4], [999.99, 11], [-10, 3]].forEach(([amt, n]) => {
  const people = [], ids = [];
  for (let i = 0; i < n; i++) { people.push(person('p' + i, 'P' + i)); ids.push('p' + i); }
  const t = trip(people, [expense({ amount: amt, payerId: 'p0', participants: ids })]);
  const parts = A.splitOf(t.expenses[0], t);
  ok(sum(parts) === A.centsOf(amt, 1), `S$${amt} split ${n} ways ties to the total`);
});

{
  const t = trip([person('a', 'A'), person('b', 'B'), person('c', 'C')], [
    expense({ id: 'e1', amount: 120, participants: ['a', 'b', 'c'] }),
    expense({ id: 'e2', amount: 55.55, payerId: 'b', participants: ['a', 'c'] }),
    expense({ id: 'e3', amount: 3000, currency: 'JPY', rate: 0.0088, payerId: 'c', participants: ['a', 'b', 'c'] }),
  ]);
  ok(sum(A.balancesFor(t).net) === 0, 'net balances across a mixed trip sum to zero');
  const plan = A.settlePlan(A.balancesFor(t).net, t);
  ok(plan.length <= t.people.length - 1, 'settlement needs at most n-1 transfers');
  ok(plan.every(p => p.cents > 0), 'no zero-value transfers in the plan');
}

/* ---------------------------------------------------------------- */
group('Import guard: ids and avatars cannot carry markup');

{
  const t = A.normalizeTrip({
    name: 'Holiday',
    id: '" onmouseover="alert(1)',
    people: [
      { id: 'p1', name: 'Wei Ming', avatar: '<img src=x onerror="alert(1)">' },
      { id: 'p2" onfocus="alert(2)', name: 'Sherlyn', avatar: '🦊' },
    ],
    expenses: [], settlements: [],
  });
  ok(!/[<>"']/.test(t.id), 'trip id is stripped of quotes and angle brackets');
  ok(A.TRIP_ICONS.includes(t.emoji), 'trip emoji is one we ship');
  ok(t.people.every(p => !/[<>"']/.test(p.id)), 'person ids are stripped');
  ok(t.people.every(p => !/[<>]/.test(p.avatar)), 'avatars cannot contain markup');
  ok(t.people[1].avatar === '🦊', 'a legitimate avatar is kept as-is');
}

{
  /* a rewritten person id must not orphan the expenses pointing at it */
  const t = A.normalizeTrip({
    name: 'T',
    people: [{ id: 'bad"id', name: 'A', avatar: '🐨' }, { id: 'b', name: 'B', avatar: '🦊' }],
    expenses: [expense({ payerId: 'bad"id', participants: ['bad"id', 'b'] })],
    settlements: [{ id: 's1', fromId: 'b', toId: 'bad"id', cents: 500, date: '2026-01-01' }],
  });
  ok(t.expenses.length === 1, 'the expense survives its payer being re-identified');
  ok(t.expenses[0].payerId === t.people[0].id, 'payerId follows the new id');
  ok(t.expenses[0].participants.includes(t.people[0].id), 'participants follow the new id');
  ok(t.settlements.length === 1 && t.settlements[0].toId === t.people[0].id, 'settlements follow too');
  ok(sum(A.balancesFor(t).net) === 0, 'balances still net to zero afterwards');
}

/* ---------------------------------------------------------------- */
group('Import guard: numbers must be numbers');

{
  const t = trip(
    [person('a', 'A'), person('b', 'B')],
    [expense({ amount: 3000, currency: 'JPY', rate: 0.0088, splitMode: 'shares', shares: { a: 'abc', b: 2 } })],
    { rates: { JPY: 'not-a-number' } }
  );
  ok(Number.isFinite(t.rates.JPY) && t.rates.JPY > 0, 'a junk rate falls back to the default');
  ok(Object.values(t.expenses[0].shares).every(Number.isFinite), 'junk share weights become numbers');
  const net = A.balancesFor(t).net;
  ok(Object.values(net).every(Number.isFinite), 'balances never come out NaN');
  ok(sum(net) === 0, 'and they still net to zero');
}

{
  const t = trip([person('a', 'A'), person('b', 'B')],
    [expense({ splitMode: 'shares', shares: { a: 0, b: 0 } })]);
  const parts = A.splitOf(t.expenses[0], t);
  ok(Object.values(parts).every(v => v === 0), 'all-zero shares split to zero rather than NaN');
}

/* ---------------------------------------------------------------- */
group('Import guard: duplicate ids');

{
  const t = trip([person('a', 'A'), person('b', 'B')],
    [expense({ amount: 90, participants: ['a', 'a', 'b'] })]);
  ok(t.expenses[0].participants.length === 2, 'a repeated participant is de-duplicated');
  const parts = A.splitOf(t.expenses[0], t);
  ok(sum(parts) === 9000, 'the split still ties to the total (no money vanishes)');
  ok(sum(A.balancesFor(t).net) === 0, 'balances net to zero');
}

{
  const t = A.normalizeTrip({
    name: 'T', settlements: [],
    people: [person('a', 'Amir'), { id: 'a', name: 'Impostor', avatar: '🦊' }, person('b', 'B')],
    expenses: [expense({ amount: 60 })],
  });
  const ids = t.people.map(p => p.id);
  ok(new Set(ids).size === ids.length, 'two people cannot end up sharing an id');
  ok(t.people[0].id === 'a' && t.people[0].name === 'Amir', 'the first claimant keeps the id');
}

/* ---------------------------------------------------------------- */
group('Exact splits stay honest when someone leaves');

{
  const t = trip([person('a', 'A'), person('b', 'B'), person('c', 'C')],
    [expense({ amount: 300, participants: ['a', 'b', 'c'], splitMode: 'exact', exact: { a: 100, b: 100, c: 100 } })]);
  ok(sum(A.splitOf(t.expenses[0], t)) === 30000, 'an exact split ties to the total');

  /* C leaves the expense but their S$100 is still sitting in `exact` */
  t.expenses[0].participants = ['a', 'b'];
  const parts = A.splitOf(t.expenses[0], t);
  ok(sum(parts) === 30000, 'it still ties to the total afterwards');
  ok(parts.a === parts.b, "the leaver's share is re-split evenly, not dumped on one person");
  ok(parts.a === 15000, 'each remaining person pays S$150, not S$200');
}

{
  /* a genuine rounding gap is still absorbed rather than triggering a re-split */
  const t = trip([person('a', 'A'), person('b', 'B'), person('c', 'C')],
    [expense({ amount: 10, participants: ['a', 'b', 'c'], splitMode: 'exact',
               exact: { a: 3.34, b: 3.33, c: 3.33 } })]);
  const parts = A.splitOf(t.expenses[0], t);
  ok(sum(parts) === 1000, 'a one-cent rounding gap still ties to the total');
  ok(parts.a === 334 && parts.b === 333 && parts.c === 333, 'and the stated amounts are respected');
}

/* ---------------------------------------------------------------- */
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
