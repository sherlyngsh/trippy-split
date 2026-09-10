/* balancesFor and settlePlan — who paid, who owes, and the shortest
   set of transfers that squares everyone up. */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { balancesFor, settlePlan, splitOf, centsOf } = require('../app.js');
const { trip, tripWith, expense, sumOf } = require('./helpers/trips.js');

describe('balancesFor', () => {
  test('an empty trip leaves everyone at zero', () => {
    const { paid, owed, net } = balancesFor(trip());
    assert.deepEqual(paid, { p1: 0, p2: 0, p3: 0 });
    assert.deepEqual(owed, { p1: 0, p2: 0, p3: 0 });
    assert.deepEqual(net, { p1: 0, p2: 0, p3: 0 });
  });

  test('credits the payer the whole bill and debits each person their share', () => {
    const t = tripWith([{ amount: 30, payerId: 'p1' }]);
    const { paid, owed, net } = balancesFor(t);
    assert.deepEqual(paid, { p1: 3000, p2: 0, p3: 0 });
    assert.deepEqual(owed, { p1: 1000, p2: 1000, p3: 1000 });
    assert.deepEqual(net, { p1: 2000, p2: -1000, p3: -1000 });
  });

  test('a bill you paid and did not share in is owed to you in full', () => {
    const t = tripWith([{ amount: 20, payerId: 'p1', participants: ['p2', 'p3'] }]);
    const { net } = balancesFor(t);
    assert.deepEqual(net, { p1: 2000, p2: -1000, p3: -1000 });
  });

  test('paying for yourself alone changes nothing', () => {
    const t = tripWith([{ amount: 20, payerId: 'p2', participants: ['p2'] }]);
    const { net } = balancesFor(t);
    assert.deepEqual(net, { p1: 0, p2: 0, p3: 0 });
  });

  test('adds up across several expenses and split modes', () => {
    const t = tripWith([
      { amount: 30, payerId: 'p1' },
      { amount: 60, payerId: 'p2', splitMode: 'shares', shares: { p1: 1, p2: 1, p3: 4 } },
      { amount: 10, payerId: 'p3', splitMode: 'exact', exact: { p1: 10 }, participants: ['p1', 'p3'] },
    ]);
    const { paid, owed, net } = balancesFor(t);
    assert.deepEqual(paid, { p1: 3000, p2: 6000, p3: 1000 });
    assert.deepEqual(owed, { p1: 1000 + 1000 + 1000, p2: 1000 + 1000, p3: 1000 + 4000 + 0 });
    assert.deepEqual(net, { p1: 0, p2: 4000, p3: -4000 });
  });

  test('the net positions always cancel out', () => {
    const t = tripWith([
      { amount: 99.99, payerId: 'p1' },
      { amount: 0.01, payerId: 'p2', participants: ['p1', 'p2'] },
      { amount: 168000, currency: 'JPY', rate: 0.0088, payerId: 'p3', splitMode: 'shares', shares: { p1: 1, p2: 2, p3: 3 } },
    ]);
    const { net } = balancesFor(t);
    assert.equal(sumOf(net), 0);
  });

  test('what everyone owes adds up to what was spent', () => {
    const t = tripWith([
      { amount: 10, payerId: 'p1' },
      { amount: 33.33, payerId: 'p2', splitMode: 'shares', shares: { p1: 2, p2: 1, p3: 1 } },
    ]);
    const { paid, owed } = balancesFor(t);
    assert.equal(sumOf(owed), sumOf(paid));
  });

  test('an expense paid by someone off the trip is not credited to anyone', () => {
    const t = tripWith([{ amount: 30, payerId: 'ghost' }]);
    const { paid, owed, net } = balancesFor(t);
    assert.deepEqual(paid, { p1: 0, p2: 0, p3: 0 });
    assert.deepEqual(owed, { p1: 1000, p2: 1000, p3: 1000 });
    assert.deepEqual(net, { p1: -1000, p2: -1000, p3: -1000 });
  });
});

describe('balancesFor — recorded payments', () => {
  test('a recorded payment shrinks the debt it settles', () => {
    const t = tripWith([{ amount: 30, payerId: 'p1' }]);
    t.settlements = [{ id: 's1', fromId: 'p2', toId: 'p1', cents: 1000, date: '2026-03-02' }];
    const { net } = balancesFor(t);
    assert.deepEqual(net, { p1: 1000, p2: 0, p3: -1000 });
  });

  test('paying up in full leaves everyone square', () => {
    const t = tripWith([{ amount: 30, payerId: 'p1' }]);
    t.settlements = [
      { id: 's1', fromId: 'p2', toId: 'p1', cents: 1000, date: '2026-03-02' },
      { id: 's2', fromId: 'p3', toId: 'p1', cents: 1000, date: '2026-03-02' },
    ];
    assert.deepEqual(balancesFor(t).net, { p1: 0, p2: 0, p3: 0 });
  });

  test('leaves paid and fair-share untouched — a payment is not an expense', () => {
    const t = tripWith([{ amount: 30, payerId: 'p1' }]);
    t.settlements = [{ id: 's1', fromId: 'p2', toId: 'p1', cents: 1000, date: '2026-03-02' }];
    const { paid, owed } = balancesFor(t);
    assert.deepEqual(paid, { p1: 3000, p2: 0, p3: 0 });
    assert.deepEqual(owed, { p1: 1000, p2: 1000, p3: 1000 });
  });

  test('overpaying flips the balance the other way', () => {
    const t = tripWith([{ amount: 30, payerId: 'p1' }]);
    t.settlements = [{ id: 's1', fromId: 'p2', toId: 'p1', cents: 2500, date: '2026-03-02' }];
    const { net } = balancesFor(t);
    assert.equal(net.p2, 1500);
    assert.equal(sumOf(net), 0);
  });

  test('a payment involving someone off the trip is ignored on that side', () => {
    const t = tripWith([{ amount: 30, payerId: 'p1' }]);
    t.settlements = [{ id: 's1', fromId: 'p2', toId: 'ghost', cents: 1000, date: '2026-03-02' }];
    const { net } = balancesFor(t);
    assert.equal(net.p2, 0);
  });
});

describe('settlePlan', () => {
  const planFor = t => settlePlan(balancesFor(t).net, t);

  test('nothing to do when everyone is square', () => {
    assert.deepEqual(planFor(trip()), []);
    assert.deepEqual(planFor(tripWith([{ amount: 30, payerId: 'p1' }].slice(0, 0))), []);
  });

  test('one debtor and one creditor is a single transfer', () => {
    const t = tripWith([{ amount: 20, payerId: 'p1', participants: ['p1', 'p2'] }]);
    assert.deepEqual(planFor(t), [{ fromId: 'p2', toId: 'p1', cents: 1000 }]);
  });

  test('transfers add up to exactly what each debtor owes', () => {
    const t = tripWith([
      { amount: 90, payerId: 'p1' },
      { amount: 30, payerId: 'p2' },
    ]);
    const { net } = balancesFor(t);
    const plan = settlePlan(net, t);
    for (const id of ['p1', 'p2', 'p3']) {
      const out = plan.filter(x => x.fromId === id).reduce((a, x) => a + x.cents, 0);
      const inc = plan.filter(x => x.toId === id).reduce((a, x) => a + x.cents, 0);
      assert.equal(inc - out, net[id], `${id} nets out`);
    }
  });

  test('needs at most one transfer fewer than there are travellers', () => {
    const t = trip(['A', 'B', 'C', 'D', 'E']);
    t.expenses = [
      expense({ amount: 100, payerId: 'p1', participants: ['p1', 'p2', 'p3', 'p4', 'p5'] }),
      expense({ amount: 37.5, payerId: 'p2', participants: ['p1', 'p2', 'p3', 'p4', 'p5'] }),
      expense({ amount: 12.34, payerId: 'p5', participants: ['p3', 'p4'] }),
    ];
    const plan = settlePlan(balancesFor(t).net, t);
    assert.ok(plan.length <= t.people.length - 1, `${plan.length} transfers for ${t.people.length} people`);
  });

  test('never asks anyone to pay themselves', () => {
    const t = tripWith([{ amount: 30, payerId: 'p1' }, { amount: 15, payerId: 'p3' }]);
    for (const x of planFor(t)) assert.notEqual(x.fromId, x.toId);
  });

  test('every transfer is a positive amount', () => {
    const t = tripWith([{ amount: 0.01, payerId: 'p1' }, { amount: 77.77, payerId: 'p2' }]);
    for (const x of planFor(t)) assert.ok(x.cents > 0, `${x.cents} > 0`);
  });

  test('settles the largest debt against the largest credit first', () => {
    const t = trip(['A', 'B', 'C']);
    const plan = settlePlan({ p1: 5000, p2: -1000, p3: -4000 }, t);
    assert.deepEqual(plan, [
      { fromId: 'p3', toId: 'p1', cents: 4000 },
      { fromId: 'p2', toId: 'p1', cents: 1000 },
    ]);
  });

  test('splits one debt across two creditors when it has to', () => {
    const t = trip(['A', 'B', 'C']);
    const plan = settlePlan({ p1: -3000, p2: 2000, p3: 1000 }, t);
    assert.deepEqual(plan, [
      { fromId: 'p1', toId: 'p2', cents: 2000 },
      { fromId: 'p1', toId: 'p3', cents: 1000 },
    ]);
  });

  test('ignores balances for people who are not on the trip', () => {
    const t = trip(['A', 'B', 'C']);
    const plan = settlePlan({ p1: -1000, p2: 1000, ghost: -9999 }, t);
    assert.deepEqual(plan, [{ fromId: 'p1', toId: 'p2', cents: 1000 }]);
  });

  test('a traveller with no balance is left out of the plan', () => {
    const t = trip(['A', 'B', 'C']);
    const plan = settlePlan({ p1: -1000, p2: 1000, p3: 0 }, t);
    assert.ok(!plan.some(x => x.fromId === 'p3' || x.toId === 'p3'));
  });

  test('a plan already recorded as paid leaves nothing left to do', () => {
    const t = tripWith([{ amount: 30, payerId: 'p1' }]);
    settlePlan(balancesFor(t).net, t).forEach((x, i) =>
      t.settlements.push({ id: 's' + i, fromId: x.fromId, toId: x.toId, cents: x.cents, date: '2026-03-02' }));
    assert.deepEqual(balancesFor(t).net, { p1: 0, p2: 0, p3: 0 });
    assert.deepEqual(planFor(t), []);
  });
});

describe('the books always balance', () => {
  /* A deterministic sweep over shapes the app can actually produce:
     every one must leave the net positions summing to zero and the
     settle plan clearing them exactly. */
  const modes = ['equal', 'shares', 'exact'];

  for (let seed = 0; seed < 60; seed++) {
    test(`case ${seed}`, () => {
      const size = 2 + (seed % 4);
      const t = trip(['A', 'B', 'C', 'D', 'E'].slice(0, size));
      const ids = t.people.map(p => p.id);

      for (let k = 0; k < 1 + (seed % 5); k++) {
        const mode = modes[(seed + k) % 3];
        const parts = ids.filter((_, i) => (i + k) % 3 !== 1) .length ? ids.filter((_, i) => (i + k) % 3 !== 1) : ids;
        const amount = ((seed * 977 + k * 31) % 100000) / 100;
        const e = expense({
          amount, rate: 1, payerId: ids[(seed + k) % size],
          participants: parts, splitMode: mode, shares: {}, exact: {},
        });
        if (mode === 'shares') {
          parts.forEach((id, i) => e.shares[id] = (i + seed) % 4);
          // the form refuses to save shares that add up to zero, so neither does the sweep
          if (!parts.some(id => e.shares[id] > 0)) e.shares[parts[0]] = 1;
        }
        if (mode === 'exact') {
          let left = Math.round(amount * 100);
          parts.forEach((id, i) => {
            const c = i === parts.length - 1 ? left : Math.round(left / (parts.length - i));
            e.exact[id] = c / 100; left -= c;
          });
        }
        t.expenses.push(e);
      }

      for (const e of t.expenses) {
        const parts = splitOf(e, t);
        const expected = Object.keys(parts).length ? centsOf(e.amount, e.rate) : 0;
        assert.equal(sumOf(parts), expected, `expense ${e.id} (${e.splitMode}) ties to its total`);
      }

      const { net } = balancesFor(t);
      assert.equal(sumOf(net), 0, 'net positions cancel');

      const plan = settlePlan(net, t);
      assert.ok(plan.length <= t.people.length - 1, 'at most n-1 transfers');
      const after = { ...net };
      for (const x of plan) { after[x.fromId] += x.cents; after[x.toId] -= x.cents; }
      for (const id of ids) assert.equal(after[id], 0, `${id} ends up square`);
    });
  }
});
