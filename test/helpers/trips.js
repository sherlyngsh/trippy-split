/* ============================================================
   trips.js — tiny builders so the tests read like the app.
   ============================================================ */

const app = require('../../app.js');

/* People with fixed ids, so expectations can name them. */
function people(...names) {
  return names.map((name, i) => ({ id: 'p' + (i + 1), name, avatar: ['🐨', '🦊', '🐼', '🦩', '🐧'][i] || '👤' }));
}

/* A trip with real people and no expenses. */
function trip(names = ['Ann', 'Bo', 'Cy'], fields = {}) {
  const ppl = people(...names);
  return app.blankTrip(Object.assign({ people: ppl, meId: ppl[0].id }, fields));
}

/* An expense with every field the app expects already filled in,
   so a test only states the part it cares about. */
let seq = 0;
function expense(fields = {}) {
  return Object.assign({
    id: 'e' + (++seq),
    created: 1700000000000,
    title: 'Dinner',
    amount: 30,
    currency: 'SGD',
    rate: 1,
    category: 'food',
    date: '2026-03-01',
    payerId: 'p1',
    participants: ['p1', 'p2', 'p3'],
    splitMode: 'equal',
    note: '',
    shares: {},
    exact: {},
  }, fields);
}

/* Give every trip-level test the same starting point. */
function tripWith(expenses, names = ['Ann', 'Bo', 'Cy']) {
  const t = trip(names);
  t.expenses = expenses.map(e => expense(e));
  return t;
}

const sumOf = obj => Object.values(obj).reduce((a, b) => a + b, 0);

module.exports = { people, trip, expense, tripWith, sumOf };
