/* splitOf — turning one expense into { personId: sgdCents }.
   The invariant that matters: the parts always add back up to the total. */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { splitOf, centsOf } = require('../app.js');
const { trip, expense, sumOf } = require('./helpers/trips.js');

const T = () => trip(['Ann', 'Bo', 'Cy']);

describe('splitOf — equally', () => {
  test('divides evenly when it divides evenly', () => {
    const parts = splitOf(expense({ amount: 30, participants: ['p1', 'p2', 'p3'] }), T());
    assert.deepEqual(parts, { p1: 1000, p2: 1000, p3: 1000 });
  });

  test('hands leftover cents to the earliest lines, and still ties to the total', () => {
    // the README's example: S$10.00 three ways is 334 / 333 / 333
    const parts = splitOf(expense({ amount: 10, participants: ['p1', 'p2', 'p3'] }), T());
    assert.deepEqual(parts, { p1: 334, p2: 333, p3: 333 });
    assert.equal(sumOf(parts), 1000);
  });

  test('only splits between the ticked participants', () => {
    const parts = splitOf(expense({ amount: 30, participants: ['p1', 'p3'] }), T());
    assert.deepEqual(parts, { p1: 1500, p3: 1500 });
  });

  test('a single participant carries the whole amount', () => {
    const parts = splitOf(expense({ amount: 7.77, participants: ['p2'] }), T());
    assert.deepEqual(parts, { p2: 777 });
  });

  test('ignores participants who are no longer on the trip', () => {
    const parts = splitOf(expense({ amount: 30, participants: ['p1', 'p2', 'ghost'] }), T());
    assert.deepEqual(parts, { p1: 1500, p2: 1500 });
  });

  test('an expense with nobody left in it splits to nothing', () => {
    assert.deepEqual(splitOf(expense({ participants: ['ghost'] }), T()), {});
    assert.deepEqual(splitOf(expense({ participants: [] }), T()), {});
  });

  test('a missing participants list is treated as empty', () => {
    const e = expense();
    delete e.participants;
    assert.deepEqual(splitOf(e, T()), {});
  });

  test('splits a foreign expense at its own stored rate', () => {
    const parts = splitOf(expense({ amount: 168000, currency: 'JPY', rate: 0.0088 }), T());
    assert.equal(sumOf(parts), 147840);
    assert.deepEqual(parts, { p1: 49280, p2: 49280, p3: 49280 });
  });

  test('every amount and headcount still ties to the total', () => {
    const t = trip(['A', 'B', 'C', 'D', 'E']);
    const everyone = t.people.map(p => p.id);
    for (let cents = 1; cents <= 400; cents++) {
      for (let n = 1; n <= 5; n++) {
        const parts = splitOf(expense({ amount: cents / 100, participants: everyone.slice(0, n) }), t);
        assert.equal(sumOf(parts), cents, `${cents}c between ${n}`);
      }
    }
  });

  test('never leaves anyone owing a negative amount of a positive bill', () => {
    const t = trip(['A', 'B', 'C', 'D']);
    const parts = splitOf(expense({ amount: 0.01, participants: t.people.map(p => p.id) }), t);
    assert.deepEqual(Object.values(parts).sort(), [0, 0, 0, 1]);
  });
});

describe('splitOf — by shares', () => {
  const shared = (shares, amount = 30, participants = ['p1', 'p2', 'p3']) =>
    splitOf(expense({ amount, participants, splitMode: 'shares', shares }), T());

  test('weights each person by their share count', () => {
    assert.deepEqual(shared({ p1: 1, p2: 2, p3: 1 }), { p1: 750, p2: 1500, p3: 750 });
  });

  test('treats a missing share count as one share', () => {
    assert.deepEqual(shared({ p2: 2 }), { p1: 750, p2: 1500, p3: 750 });
  });

  test('a zero share means that person owes nothing', () => {
    assert.deepEqual(shared({ p1: 0, p2: 1, p3: 1 }), { p1: 0, p2: 1500, p3: 1500 });
  });

  test('clamps a negative share to zero rather than crediting anyone', () => {
    const parts = shared({ p1: -5, p2: 1, p3: 1 });
    assert.deepEqual(parts, { p1: 0, p2: 1500, p3: 1500 });
    assert.equal(sumOf(parts), 3000);
  });

  test('all-zero shares split to nothing, leaving the payer out of pocket', () => {
    // there is no sane weighting left, so the app declines to guess
    assert.deepEqual(shared({ p1: 0, p2: 0, p3: 0 }), { p1: 0, p2: 0, p3: 0 });
  });

  test('uneven shares still tie to the total', () => {
    for (const amount of [10, 0.03, 99.99, 1234.56]) {
      const parts = shared({ p1: 1, p2: 2, p3: 4 }, amount);
      assert.equal(sumOf(parts), centsOf(amount, 1), `S$${amount}`);
    }
  });

  test('fractional shares are allowed and weighted as given', () => {
    const parts = shared({ p1: 0.5, p2: 0.5, p3: 1 }, 20);
    assert.deepEqual(parts, { p1: 500, p2: 500, p3: 1000 });
  });

  test('shares of a person no longer on the trip are ignored', () => {
    const parts = shared({ p1: 1, p2: 1, ghost: 98 }, 20, ['p1', 'p2']);
    assert.deepEqual(parts, { p1: 1000, p2: 1000 });
  });
});

describe('splitOf — exact amounts', () => {
  const exactly = (exact, amount = 30, participants = ['p1', 'p2', 'p3']) =>
    splitOf(expense({ amount, participants, splitMode: 'exact', exact }), T());

  test('uses the amounts as entered', () => {
    assert.deepEqual(exactly({ p1: 5, p2: 10, p3: 15 }), { p1: 500, p2: 1000, p3: 1500 });
  });

  test('a person entered as zero owes nothing', () => {
    assert.deepEqual(exactly({ p1: 0, p2: 15, p3: 15 }), { p1: 0, p2: 1500, p3: 1500 });
  });

  test('a missing entry counts as zero when the rest cover the bill', () => {
    assert.deepEqual(exactly({ p1: 10, p2: 20 }), { p1: 1000, p2: 2000, p3: 0 });
  });

  test('converts each exact amount at the expense rate', () => {
    const parts = exactly({ p1: 100000, p2: 68000 }, 168000, ['p1', 'p2']);
    const e = expense({ amount: 168000, currency: 'JPY', rate: 0.0088, participants: ['p1', 'p2'], splitMode: 'exact', exact: { p1: 100000, p2: 68000 } });
    assert.equal(sumOf(splitOf(e, T())), 147840);
    assert.equal(sumOf(parts), 16800000);
  });

  test('re-splits a share left behind by a removed traveller', () => {
    // three people were down for S$10 each; the third has since been
    // removed from the trip, so their S$10 has to go somewhere
    const t = trip(['Ann', 'Bo']);
    const parts = splitOf(expense({
      amount: 30, participants: ['p1', 'p2'], splitMode: 'exact',
      exact: { p1: 10, p2: 10, p3: 10 },
    }), t);
    assert.deepEqual(parts, { p1: 1500, p2: 1500 }, 'split between whoever is left');
    assert.equal(sumOf(parts), 3000);
  });

  test('re-splits it in proportion to what each person was down for', () => {
    const t = trip(['Ann', 'Bo']);
    const parts = splitOf(expense({
      amount: 60, participants: ['p1', 'p2'], splitMode: 'exact',
      exact: { p1: 20, p2: 10, p3: 30 },
    }), t);
    assert.deepEqual(parts, { p1: 4000, p2: 2000 }, 'Ann was down for twice Bo');
    assert.equal(sumOf(parts), 6000);
  });

  test('scales back down when the amounts on file overshoot the bill', () => {
    const t = trip(['Ann', 'Bo']);
    const parts = splitOf(expense({
      amount: 30, participants: ['p1', 'p2'], splitMode: 'exact',
      exact: { p1: 30, p2: 10 },
    }), t);
    assert.equal(sumOf(parts), 3000);
    assert.ok(parts.p1 > parts.p2, 'the larger line stays the larger line');
  });

  test('falls back to an equal split when nothing was entered at all', () => {
    const t = trip(['Ann', 'Bo']);
    const parts = splitOf(expense({
      amount: 30, participants: ['p1', 'p2'], splitMode: 'exact', exact: {},
    }), t);
    assert.deepEqual(parts, { p1: 1500, p2: 1500 });
  });

  test('a re-split always ties to the total, however lopsided', () => {
    const t = trip(['Ann', 'Bo', 'Cy']);
    for (const amount of [0.03, 10, 99.99, 1234.56]) {
      for (const exact of [{ p1: 1 }, { p1: 1, p2: 2 }, { p1: 7, p2: 1, p3: 1 }, { p1: 0, p2: 0, p3: 0 }]) {
        const parts = splitOf(expense({
          amount, participants: ['p1', 'p2', 'p3'], splitMode: 'exact', exact,
        }), t);
        assert.equal(sumOf(parts), centsOf(amount, 1), `S$${amount} over ${JSON.stringify(exact)}`);
      }
    }
  });

  test('absorbs a sub-cent rounding gap so the parts still tie to the total', () => {
    // three exact thirds of a foreign bill each round down; the gap has
    // to land somewhere or the split would not add up
    const e = expense({
      amount: 100, currency: 'USD', rate: 1.30,
      participants: ['p1', 'p2', 'p3'], splitMode: 'exact',
      exact: { p1: 33.33, p2: 33.33, p3: 33.34 },
    });
    const parts = splitOf(e, T());
    assert.equal(sumOf(parts), centsOf(100, 1.30));
  });
});

describe('splitOf — mode fallback', () => {
  test('an unrecognised split mode is treated as an equal split', () => {
    const parts = splitOf(expense({ amount: 30, splitMode: 'nonsense' }), T());
    assert.deepEqual(parts, { p1: 1000, p2: 1000, p3: 1000 });
  });

  test('a shares expense with no shares object splits equally', () => {
    const e = expense({ amount: 30, splitMode: 'shares' });
    delete e.shares;
    assert.deepEqual(splitOf(e, T()), { p1: 1000, p2: 1000, p3: 1000 });
  });

  test('an exact expense with no exact object gives everyone zero and the gap to the first', () => {
    const e = expense({ amount: 30, splitMode: 'exact' });
    delete e.exact;
    const parts = splitOf(e, T());
    assert.equal(sumOf(parts), 3000);
  });
});
