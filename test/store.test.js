/* store.js — one localStorage bucket per account. */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { installStorage } = require('./helpers/browser-env.js');
installStorage();                       // in place before store.js is first used
const Store = require('../store.js');

const KEY = id => `trippysplit.data.${id}`;
const LEGACY_KEY = 'trippysplit.v1';

describe('Store.load / Store.save', () => {
  beforeEach(installStorage);

  test('an account with nothing saved starts with no trips', () => {
    assert.deepEqual(Store.load('u1'), { trips: [] });
  });

  test('reads back exactly what was saved', () => {
    const db = { trips: [{ id: 't1', name: 'Tokyo' }] };
    Store.save('u1', db);
    assert.deepEqual(Store.load('u1'), db);
  });

  test('keeps each account in its own bucket', () => {
    Store.save('u1', { trips: [{ id: 't1' }] });
    Store.save('u2', { trips: [{ id: 't2' }] });
    assert.deepEqual(Store.load('u1').trips.map(t => t.id), ['t1']);
    assert.deepEqual(Store.load('u2').trips.map(t => t.id), ['t2']);
  });

  test('writes under a key namespaced by user id', () => {
    Store.save('u1', { trips: [] });
    assert.ok(localStorage.getItem(KEY('u1')));
    assert.equal(localStorage.getItem(KEY('u2')), null);
  });

  test('a later save replaces the earlier one', () => {
    Store.save('u1', { trips: [{ id: 't1' }] });
    Store.save('u1', { trips: [] });
    assert.deepEqual(Store.load('u1'), { trips: [] });
  });

  test('unreadable JSON is treated as no trips rather than thrown', () => {
    localStorage.setItem(KEY('u1'), '{ not json');
    assert.deepEqual(Store.load('u1'), { trips: [] });
  });

  test('a saved blob without a trips array is treated as no trips', () => {
    for (const junk of ['null', '42', '"hello"', '{}', '{"trips":"nope"}', '[]']) {
      localStorage.setItem(KEY('u1'), junk);
      assert.deepEqual(Store.load('u1'), { trips: [] }, junk);
    }
  });

  test('survives round-tripping the fields a trip actually holds', () => {
    const db = { trips: [{ id: 't1', name: 'Tokyo', emoji: '🗼', people: [{ id: 'p1', name: 'Ann' }], expenses: [], settlements: [], rates: { JPY: 0.0088 }, meId: 'p1' }] };
    Store.save('u1', db);
    assert.deepEqual(Store.load('u1'), db);
  });
});

describe('Store.remove', () => {
  beforeEach(installStorage);

  test('forgets one account and leaves the others alone', () => {
    Store.save('u1', { trips: [{ id: 't1' }] });
    Store.save('u2', { trips: [{ id: 't2' }] });
    Store.remove('u1');
    assert.deepEqual(Store.load('u1'), { trips: [] });
    assert.deepEqual(Store.load('u2').trips.map(t => t.id), ['t2']);
  });

  test('removing an account that was never saved is harmless', () => {
    assert.doesNotThrow(() => Store.remove('nobody'));
  });
});

describe('Store — the pre-accounts save', () => {
  beforeEach(installStorage);

  const legacy = { tripName: 'Old Trip', people: [{ id: 'p1', name: 'Ann' }], expenses: [{ id: 'e1' }] };

  test('is offered up when it holds anything', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    assert.deepEqual(Store.legacyRaw(), legacy);
  });

  test('is offered up when it holds only travellers', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ people: [{ id: 'p1', name: 'Ann' }], expenses: [] }));
    assert.ok(Store.legacyRaw());
  });

  test('is not offered when there is nothing in it', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ people: [], expenses: [] }));
    assert.equal(Store.legacyRaw(), null);
  });

  test('is not offered when it is the wrong shape', () => {
    for (const junk of ['{ not json', 'null', '{"people":[]}', '{"expenses":[]}', '{"people":"Ann","expenses":[]}']) {
      localStorage.setItem(LEGACY_KEY, junk);
      assert.equal(Store.legacyRaw(), null, junk);
    }
  });

  test('is not offered when it was never there', () => {
    assert.equal(Store.legacyRaw(), null);
  });

  test('can be cleared once adopted, and clearing twice is harmless', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    Store.clearLegacy();
    assert.equal(Store.legacyRaw(), null);
    assert.doesNotThrow(() => Store.clearLegacy());
  });

  test('lives outside the per-account buckets', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    Store.save('u1', { trips: [] });
    Store.remove('u1');
    assert.ok(Store.legacyRaw(), 'the legacy save outlives an account');
  });
});

describe('Store — when the browser will not cooperate', () => {
  test('load falls back to no trips when reading throws', () => {
    installStorage();
    globalThis.localStorage.getItem = () => { throw new Error('SecurityError'); };
    assert.deepEqual(Store.load('u1'), { trips: [] });
  });

  test('legacyRaw falls back to null when reading throws', () => {
    installStorage();
    globalThis.localStorage.getItem = () => { throw new Error('SecurityError'); };
    assert.equal(Store.legacyRaw(), null);
  });

  test('remove swallows a storage error rather than breaking sign-out', () => {
    installStorage();
    globalThis.localStorage.removeItem = () => { throw new Error('SecurityError'); };
    assert.doesNotThrow(() => Store.remove('u1'));
  });

  test('save lets a quota error through, so the app can warn about it', () => {
    installStorage();
    globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    assert.throws(() => Store.save('u1', { trips: [] }), /QuotaExceededError/);
  });
});
