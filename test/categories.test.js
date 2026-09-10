/* catTotals — the "where the money went" breakdown. */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { catTotals, CATEGORIES, tripTotalCents } = require('../app.js');
const { trip, tripWith } = require('./helpers/trips.js');

describe('the category table', () => {
  test('has the six categories the form offers, each with its own colour slot', () => {
    assert.equal(CATEGORIES.length, 6);
    assert.deepEqual(CATEGORIES.map(c => c.id), ['hotel', 'transport', 'entrance', 'food', 'shopping', 'other']);
    assert.equal(new Set(CATEGORIES.map(c => c.slot)).size, 6);
    for (const c of CATEGORIES) {
      assert.ok(c.label, `${c.id} label`);
      assert.ok(c.icon, `${c.id} icon`);
    }
  });
});

describe('catTotals', () => {
  test('is empty for a trip with no expenses', () => {
    assert.deepEqual(catTotals(trip()), []);
  });

  test('totals each category and counts its expenses', () => {
    const t = tripWith([
      { amount: 100, category: 'hotel' },
      { amount: 20, category: 'food' },
      { amount: 30, category: 'food' },
    ]);
    assert.deepEqual(catTotals(t).map(c => [c.id, c.cents, c.count]), [
      ['hotel', 10000, 1],
      ['food', 5000, 2],
    ]);
  });

  test('lists the biggest spend first', () => {
    const t = tripWith([
      { amount: 5, category: 'food' },
      { amount: 500, category: 'hotel' },
      { amount: 50, category: 'transport' },
    ]);
    assert.deepEqual(catTotals(t).map(c => c.id), ['hotel', 'transport', 'food']);
  });

  test('leaves out categories nobody spent in', () => {
    const t = tripWith([{ amount: 10, category: 'food' }]);
    assert.deepEqual(catTotals(t).map(c => c.id), ['food']);
  });

  test('converts foreign spending before comparing', () => {
    const t = tripWith([
      { amount: 168000, currency: 'JPY', rate: 0.0088, category: 'hotel' },  // S$1,478.40
      { amount: 2000, currency: 'SGD', rate: 1, category: 'food' },          // S$2,000.00
    ]);
    assert.deepEqual(catTotals(t).map(c => c.id), ['food', 'hotel']);
  });

  test('files an unknown category under "other"', () => {
    const t = tripWith([{ amount: 10, category: 'yachts' }, { amount: 5, category: 'other' }]);
    assert.deepEqual(catTotals(t).map(c => [c.id, c.cents, c.count]), [['other', 1500, 2]]);
  });

  test('the breakdown adds up to the trip total', () => {
    const t = tripWith([
      { amount: 100, category: 'hotel' },
      { amount: 20.55, category: 'food' },
      { amount: 168000, currency: 'JPY', rate: 0.0088, category: 'transport' },
    ]);
    const sum = catTotals(t).reduce((a, c) => a + c.cents, 0);
    assert.equal(sum, tripTotalCents(t));
  });

  test('carries each category\'s label, icon and colour slot through', () => {
    const c = catTotals(tripWith([{ amount: 10, category: 'hotel' }]))[0];
    assert.equal(c.label, 'Hotel');
    assert.equal(c.icon, '🏨');
    assert.equal(c.slot, 1);
  });
});
