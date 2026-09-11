/* Money helpers: conversion into integer SGD cents and back out again. */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { centsOf, sgd, foreign, tripTotalCents, DEFAULT_RATES, CURRENCIES } = require('../app.js');
const { tripWith } = require('./helpers/trips.js');

describe('centsOf', () => {
  test('converts a foreign amount at a stored rate', () => {
    // the worked example from the README
    assert.equal(centsOf(168000, 0.0088), 147840);
  });

  test('SGD at rate 1 is just cents', () => {
    assert.equal(centsOf(42.5, 1), 4250);
    assert.equal(centsOf(0.01, 1), 1);
  });

  test('rounds to the nearest cent rather than truncating', () => {
    assert.equal(centsOf(1.006, 1), 101);
    assert.equal(centsOf(1.004, 1), 100);
    assert.equal(centsOf(0.006, 1), 1);
  });

  test('is exact for every amount the form can accept', () => {
    // the amount input steps in hundredths, so two decimal places is
    // the finest thing a user can type — all of them must land on the
    // cent they name, with no binary-float drift
    for (let c = 1; c <= 200000; c++) {
      if (centsOf(c / 100, 1) !== c) {
        assert.fail(`centsOf(${c / 100}, 1) gave ${centsOf(c / 100, 1)}, expected ${c}`);
      }
    }
  });

  test('sub-cent input is rounded by binary float, not by decimal rules', () => {
    // documented, not endorsed: 1.005 is not representable, so it lands
    // just under the halfway point. Harmless while the form steps in
    // hundredths; worth knowing if that ever changes.
    assert.equal(1.005 * 100, 100.49999999999999);
    assert.equal(centsOf(1.005, 1), 100);
  });

  test('never returns a fraction of a cent', () => {
    for (const amount of [1 / 3, 9.999, 12345.678, 0.125]) {
      assert.equal(centsOf(amount, 0.0088) % 1, 0);
    }
  });

  test('accepts numeric strings, as they arrive from form inputs', () => {
    assert.equal(centsOf('12.50', '1'), 1250);
  });

  test('zero and negative amounts pass straight through', () => {
    assert.equal(centsOf(0, 1), 0);
    assert.equal(centsOf(-5, 1), -500);
  });
});

describe('sgd', () => {
  test('formats cents with a currency mark and two decimals', () => {
    assert.equal(sgd(0), 'S$0.00');
    assert.equal(sgd(1), 'S$0.01');
    assert.equal(sgd(4250), 'S$42.50');
    assert.equal(sgd(147840), 'S$1,478.40');
  });

  test('puts the sign before the currency mark, not inside the number', () => {
    assert.equal(sgd(-12030), '-S$120.30');
    assert.equal(sgd(-1), '-S$0.01');
  });

  test('always shows two decimal places', () => {
    assert.equal(sgd(100), 'S$1.00');
    assert.equal(sgd(1000), 'S$10.00');
  });
});

describe('foreign', () => {
  test('uses each currency\'s own symbol', () => {
    assert.equal(foreign(100, 'SGD'), 'S$100.00');
    assert.equal(foreign(1.5, 'USD'), 'US$1.50');
    assert.equal(foreign(12, 'GBP'), '£12.00');
  });

  test('drops the decimals on currencies that have none', () => {
    assert.equal(foreign(168000, 'JPY'), '¥168,000');
    assert.equal(foreign(50000, 'KRW'), '₩50,000');
    assert.equal(foreign(1500, 'VND'), '₫1,500');
  });

  test('falls back to the bare code for a currency it does not know', () => {
    assert.equal(foreign(10, 'ZZZ'), 'ZZZ10.00');
  });
});

describe('the currency table', () => {
  test('every currency has the fields the app reads', () => {
    for (const c of CURRENCIES) {
      assert.equal(typeof c.code, 'string', `${c.code} code`);
      assert.match(c.code, /^[A-Z]{3}$/, `${c.code} looks like a currency code`);
      assert.equal(typeof c.name, 'string', `${c.code} name`);
      assert.equal(typeof c.sym, 'string', `${c.code} symbol`);
      assert.ok(c.dp === 0 || c.dp === 2, `${c.code} decimal places`);
      assert.ok(c.rate > 0, `${c.code} rate is positive`);
    }
  });

  test('codes are unique', () => {
    const codes = CURRENCIES.map(c => c.code);
    assert.equal(new Set(codes).size, codes.length);
  });

  test('SGD is the base and sits at rate 1', () => {
    assert.equal(DEFAULT_RATES.SGD, 1);
    assert.equal(CURRENCIES[0].code, 'SGD');
  });

  test('DEFAULT_RATES covers exactly the listed currencies', () => {
    assert.deepEqual(Object.keys(DEFAULT_RATES).sort(), CURRENCIES.map(c => c.code).sort());
  });
});

describe('tripTotalCents', () => {
  test('is zero for a trip with no expenses', () => {
    assert.equal(tripTotalCents(tripWith([])), 0);
  });

  test('adds every expense at its own stored rate', () => {
    const t = tripWith([
      { amount: 10, currency: 'SGD', rate: 1 },
      { amount: 168000, currency: 'JPY', rate: 0.0088 },
    ]);
    assert.equal(tripTotalCents(t), 1000 + 147840);
  });

  test('ignores who paid and how it was split', () => {
    const a = tripWith([{ amount: 30, payerId: 'p1', splitMode: 'equal' }]);
    const b = tripWith([{ amount: 30, payerId: 'p2', splitMode: 'shares', shares: { p1: 5, p2: 1, p3: 1 } }]);
    assert.equal(tripTotalCents(a), tripTotalCents(b));
  });
});
