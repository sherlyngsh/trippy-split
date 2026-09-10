/* blankTrip and normalizeTrip — the gate every trip passes through on
   its way out of storage or in from an import. Everything past this
   point is trusted, so this is where untrusted JSON gets straightened
   out or dropped. */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { blankTrip, normalizeTrip, DEFAULT_RATES, TRIP_ICONS, CATEGORIES } = require('../app.js');

const TODAY = /^\d{4}-\d{2}-\d{2}$/;

describe('blankTrip', () => {
  test('has every field the app reads', () => {
    const t = blankTrip();
    assert.equal(typeof t.id, 'string');
    assert.ok(t.id.length);
    assert.equal(t.name, 'Our Holiday');
    assert.equal(t.emoji, TRIP_ICONS[0]);
    assert.deepEqual([t.people, t.expenses, t.settlements], [[], [], []]);
    assert.equal(t.meId, null);
    assert.equal(t.from, '');
    assert.equal(t.to, '');
    assert.equal(typeof t.created, 'number');
    assert.equal(typeof t.updated, 'number');
  });

  test('starts from the default rate table', () => {
    assert.deepEqual(blankTrip().rates, DEFAULT_RATES);
  });

  test('does not share its rate table with the defaults', () => {
    const t = blankTrip();
    t.rates.JPY = 999;
    assert.notEqual(DEFAULT_RATES.JPY, 999);
    assert.notEqual(blankTrip().rates.JPY, 999);
  });

  test('gives each trip its own id', () => {
    assert.notEqual(blankTrip().id, blankTrip().id);
  });

  test('overrides win over the defaults', () => {
    const t = blankTrip({ name: 'Bali', emoji: '🏝️', from: '2026-06-01' });
    assert.equal(t.name, 'Bali');
    assert.equal(t.emoji, '🏝️');
    assert.equal(t.from, '2026-06-01');
  });
});

describe('normalizeTrip — trip fields', () => {
  test('fills in everything an empty object is missing', () => {
    const t = normalizeTrip({});
    assert.equal(t.name, 'Our Holiday');
    assert.deepEqual([t.people, t.expenses, t.settlements], [[], [], []]);
    assert.equal(t.meId, null);
  });

  test('keeps the trip id, or mints one', () => {
    assert.equal(normalizeTrip({ id: 'trip-7' }).id, 'trip-7');
    assert.ok(normalizeTrip({}).id.length);
  });

  test('reads the old single-trip save\'s tripName', () => {
    assert.equal(normalizeTrip({ tripName: 'Old Trip' }).name, 'Old Trip');
    assert.equal(normalizeTrip({ name: 'New', tripName: 'Old' }).name, 'New');
  });

  test('caps the trip name at 40 characters', () => {
    assert.equal(normalizeTrip({ name: 'x'.repeat(200) }).name.length, 40);
  });

  test('an empty name falls back to the default', () => {
    assert.equal(normalizeTrip({ name: '' }).name, 'Our Holiday');
  });

  test('an emoji outside the picker falls back to the first icon', () => {
    assert.equal(normalizeTrip({ emoji: '💀' }).emoji, TRIP_ICONS[0]);
    assert.equal(normalizeTrip({ emoji: '🏝️' }).emoji, '🏝️');
  });

  test('drops a "me" who is not on the trip', () => {
    assert.equal(normalizeTrip({ meId: 'nobody' }).meId, null);
    const t = normalizeTrip({ people: [{ id: 'p1', name: 'Ann' }], meId: 'p1' });
    assert.equal(t.meId, 'p1');
  });
});

describe('normalizeTrip — travellers', () => {
  test('keeps well-formed people as they are', () => {
    const t = normalizeTrip({ people: [{ id: 'p1', name: 'Ann', avatar: '🦊' }] });
    assert.deepEqual(t.people, [{ id: 'p1', name: 'Ann', avatar: '🦊' }]);
  });

  test('drops anyone without an id or a name', () => {
    const t = normalizeTrip({ people: [{ id: 'p1', name: 'Ann' }, { name: 'No id' }, { id: 'p3' }, null, 'nope'] });
    assert.deepEqual(t.people.map(p => p.id), ['p1']);
  });

  test('hands out an avatar to anyone missing one', () => {
    const t = normalizeTrip({ people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] });
    assert.ok(t.people.every(p => p.avatar));
    assert.notEqual(t.people[0].avatar, t.people[1].avatar);
  });

  test('caps a name at 24 characters', () => {
    const t = normalizeTrip({ people: [{ id: 'p1', name: 'y'.repeat(80) }] });
    assert.equal(t.people[0].name.length, 24);
  });

  test('a people list that is not a list becomes empty', () => {
    assert.deepEqual(normalizeTrip({ people: 'Ann, Bo' }).people, []);
    assert.deepEqual(normalizeTrip({ people: null }).people, []);
  });
});

describe('normalizeTrip — expenses', () => {
  const withPeople = (expenses, people = [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }]) =>
    normalizeTrip({ people, expenses });

  test('keeps a well-formed expense', () => {
    const t = withPeople([{
      id: 'e1', title: 'Ramen', amount: 6400, currency: 'JPY', rate: 0.0088,
      category: 'food', date: '2026-03-01', payerId: 'p1', participants: ['p1', 'p2'],
      splitMode: 'equal', note: 'yum',
    }]);
    assert.equal(t.expenses.length, 1);
    assert.deepEqual(t.expenses[0].participants, ['p1', 'p2']);
    assert.equal(t.expenses[0].rate, 0.0088);
    assert.equal(t.expenses[0].note, 'yum');
  });

  test('drops an expense whose payer is gone', () => {
    assert.deepEqual(withPeople([{ id: 'e1', payerId: 'ghost', participants: ['p1'] }]).expenses, []);
  });

  test('drops an expense with no id', () => {
    assert.deepEqual(withPeople([{ payerId: 'p1', participants: ['p1'] }]).expenses, []);
  });

  test('drops participants who are gone, and the expense if none are left', () => {
    const t = withPeople([
      { id: 'e1', payerId: 'p1', participants: ['p1', 'ghost'] },
      { id: 'e2', payerId: 'p1', participants: ['ghost'] },
    ]);
    assert.deepEqual(t.expenses.map(e => e.id), ['e1']);
    assert.deepEqual(t.expenses[0].participants, ['p1']);
  });

  test('an unknown category becomes "other"', () => {
    assert.equal(withPeople([{ id: 'e1', payerId: 'p1', participants: ['p1'], category: 'yachts' }]).expenses[0].category, 'other');
  });

  test('every real category is kept', () => {
    for (const c of CATEGORIES) {
      const t = withPeople([{ id: 'e1', payerId: 'p1', participants: ['p1'], category: c.id }]);
      assert.equal(t.expenses[0].category, c.id, c.id);
    }
  });

  test('an unknown currency falls back to the base currency', () => {
    assert.equal(withPeople([{ id: 'e1', payerId: 'p1', participants: ['p1'], currency: 'ZZZ' }]).expenses[0].currency, 'SGD');
  });

  test('a missing rate is taken from the defaults for that currency', () => {
    const t = withPeople([{ id: 'e1', payerId: 'p1', participants: ['p1'], currency: 'JPY' }]);
    assert.equal(t.expenses[0].rate, DEFAULT_RATES.JPY);
  });

  test('a zero, negative or unparseable rate is replaced', () => {
    for (const rate of [0, -1, 'soon', null, NaN]) {
      const t = withPeople([{ id: 'e1', payerId: 'p1', participants: ['p1'], currency: 'JPY', rate }]);
      assert.equal(t.expenses[0].rate, DEFAULT_RATES.JPY, `rate ${JSON.stringify(rate)}`);
    }
  });

  test('a bad date is replaced with today', () => {
    for (const date of ['yesterday', '2026-3-1', '', undefined, 20260301]) {
      const t = withPeople([{ id: 'e1', payerId: 'p1', participants: ['p1'], date }]);
      assert.match(t.expenses[0].date, TODAY, `date ${JSON.stringify(date)}`);
    }
  });

  test('a well-formed date is kept', () => {
    assert.equal(withPeople([{ id: 'e1', payerId: 'p1', participants: ['p1'], date: '2026-03-01' }]).expenses[0].date, '2026-03-01');
  });

  test('an unparseable amount becomes zero', () => {
    assert.equal(withPeople([{ id: 'e1', payerId: 'p1', participants: ['p1'], amount: 'lots' }]).expenses[0].amount, 0);
  });

  test('an unknown split mode becomes an equal split', () => {
    assert.equal(withPeople([{ id: 'e1', payerId: 'p1', participants: ['p1'], splitMode: 'vibes' }]).expenses[0].splitMode, 'equal');
  });

  test('shares and exact must be objects', () => {
    const t = withPeople([{ id: 'e1', payerId: 'p1', participants: ['p1'], shares: 'lots', exact: 7 }]);
    assert.deepEqual(t.expenses[0].shares, {});
    assert.deepEqual(t.expenses[0].exact, {});
  });

  test('caps the title and the note', () => {
    const t = withPeople([{ id: 'e1', payerId: 'p1', participants: ['p1'], title: 't'.repeat(200), note: 'n'.repeat(400) }]);
    assert.equal(t.expenses[0].title.length, 60);
    assert.equal(t.expenses[0].note.length, 120);
  });

  test('an untitled expense gets a placeholder title', () => {
    assert.equal(withPeople([{ id: 'e1', payerId: 'p1', participants: ['p1'] }]).expenses[0].title, 'Expense');
  });

  test('an expenses list that is not a list becomes empty', () => {
    assert.deepEqual(normalizeTrip({ expenses: { e1: {} } }).expenses, []);
  });
});

describe('normalizeTrip — recorded payments', () => {
  const withPeople = settlements =>
    normalizeTrip({ people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }], settlements });

  test('keeps a well-formed payment', () => {
    const t = withPeople([{ id: 's1', fromId: 'p1', toId: 'p2', cents: 1000, date: '2026-03-02' }]);
    assert.deepEqual(t.settlements, [{ id: 's1', fromId: 'p1', toId: 'p2', cents: 1000, date: '2026-03-02' }]);
  });

  test('drops a payment involving someone who is gone', () => {
    assert.deepEqual(withPeople([
      { id: 's1', fromId: 'ghost', toId: 'p2', cents: 1000 },
      { id: 's2', fromId: 'p1', toId: 'ghost', cents: 1000 },
    ]).settlements, []);
  });

  test('drops a payment of nothing, or of a negative amount', () => {
    assert.deepEqual(withPeople([
      { id: 's1', fromId: 'p1', toId: 'p2', cents: 0 },
      { id: 's2', fromId: 'p1', toId: 'p2', cents: -500 },
      { id: 's3', fromId: 'p1', toId: 'p2', cents: 'some' },
    ]).settlements, []);
  });

  test('rounds a fractional amount to whole cents', () => {
    assert.equal(withPeople([{ id: 's1', fromId: 'p1', toId: 'p2', cents: 1000.6 }]).settlements[0].cents, 1001);
  });

  test('mints an id and dates a payment that has neither', () => {
    const s = withPeople([{ fromId: 'p1', toId: 'p2', cents: 500 }]).settlements[0];
    assert.ok(s.id.length);
    assert.match(s.date, TODAY);
  });
});

describe('normalizeTrip — the rate table', () => {
  test('an absent table becomes the defaults', () => {
    assert.deepEqual(normalizeTrip({}).rates, DEFAULT_RATES);
    assert.deepEqual(normalizeTrip({ rates: null }).rates, DEFAULT_RATES);
  });

  test('a saved rate wins over the default', () => {
    assert.equal(normalizeTrip({ rates: { JPY: 0.0095 } }).rates.JPY, 0.0095);
  });

  test('missing currencies are topped up from the defaults', () => {
    const t = normalizeTrip({ rates: { JPY: 0.0095 } });
    assert.deepEqual(Object.keys(t.rates).sort(), Object.keys(DEFAULT_RATES).sort());
    assert.equal(t.rates.USD, DEFAULT_RATES.USD);
  });

  test('normalizing twice is a no-op', () => {
    const once = normalizeTrip({
      people: [{ id: 'p1', name: 'Ann' }],
      expenses: [{ id: 'e1', payerId: 'p1', participants: ['p1'], amount: 10, currency: 'SGD', rate: 1, date: '2026-03-01' }],
      settlements: [],
    });
    assert.deepEqual(normalizeTrip(once), once);
  });
});
