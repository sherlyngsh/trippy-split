/* auth.js — local accounts. PBKDF2 at 150k iterations is deliberately
   slow, so the tests that actually hash are kept few and pointed. */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { installStorage } = require('./helpers/browser-env.js');
installStorage();                       // in place before auth.js is first used
const Auth = require('../auth.js');

const USERS_KEY = 'trippysplit.users.v1';
const SESSION_KEY = 'trippysplit.session.v1';

describe('Auth.checkUsername', () => {
  test('accepts a plain username', () => {
    for (const u of ['ann', 'Ann', 'a_b', 'a.b', 'a-b', 'abc123', 'x'.repeat(20)]) {
      assert.equal(Auth.checkUsername(u), null, u);
    }
  });

  test('asks for one when it is blank', () => {
    for (const u of ['', '   ', null, undefined]) {
      assert.match(Auth.checkUsername(u), /Pick a username/, JSON.stringify(u));
    }
  });

  test('holds out for three characters', () => {
    assert.match(Auth.checkUsername('ab'), /at least 3/);
    assert.equal(Auth.checkUsername('abc'), null);
  });

  test('stops at twenty', () => {
    assert.match(Auth.checkUsername('x'.repeat(21)), /at most 20/);
  });

  test('rejects characters it will not store', () => {
    for (const u of ['ann smith', 'ann@example.com', 'ann!', 'añn', '<script>']) {
      assert.match(Auth.checkUsername(u), /letters, numbers/, u);
    }
  });

  test('measures the trimmed username', () => {
    assert.equal(Auth.checkUsername('  ann  '), null);
    assert.match(Auth.checkUsername('  ab  '), /at least 3/);
  });
});

describe('Auth.checkPassword', () => {
  test('accepts eight characters or more', () => {
    assert.equal(Auth.checkPassword('12345678'), null);
    assert.equal(Auth.checkPassword('x'.repeat(200)), null);
  });

  test('holds out for eight', () => {
    for (const p of ['', 'short', '1234567', null, undefined]) {
      assert.match(Auth.checkPassword(p), /at least 8/, JSON.stringify(p));
    }
  });

  test('draws the line at two hundred', () => {
    assert.match(Auth.checkPassword('x'.repeat(201)), /unreasonably long/);
  });

  test('does not trim — spaces are part of a password', () => {
    assert.equal(Auth.checkPassword('        '), null);
  });
});

/* globalThis.crypto is a getter with no setter, so pretending it is
   missing takes defineProperty rather than assignment. */
function withoutWebCrypto(fn) {
  const real = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true, writable: true });
  try { return fn(); } finally { Object.defineProperty(globalThis, 'crypto', real); }
}

describe('Auth.ready', () => {
  test('is true where Web Crypto is available', () => {
    assert.equal(Auth.ready(), true);
  });

  test('is false when Web Crypto is missing', () => {
    withoutWebCrypto(() => assert.equal(Auth.ready(), false));
  });

  test('is false when subtle crypto alone is missing', () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const grv = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
    Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: grv }, configurable: true, writable: true });
    try { assert.equal(Auth.ready(), false); } finally { Object.defineProperty(globalThis, 'crypto', real); }
  });
});

describe('Auth.signUp', () => {
  beforeEach(installStorage);

  test('creates an account and hands back a public user', async () => {
    const { user, error, firstEver } = await Auth.signUp('ann', 'holiday123', 'holiday123');
    assert.equal(error, undefined);
    assert.equal(user.username, 'ann');
    assert.ok(user.userId);
    assert.equal(firstEver, true);
    assert.equal(Auth.userCount(), 1);
  });

  test('never writes the password down', async () => {
    await Auth.signUp('ann', 'holiday123', 'holiday123');
    const raw = localStorage.getItem(USERS_KEY);
    assert.ok(!raw.includes('holiday123'));
    const [stored] = JSON.parse(raw);
    assert.equal(stored.iterations, Auth.ITERATIONS);
    assert.ok(stored.salt && stored.hash);
    assert.equal(stored.password, undefined);
  });

  test('does not hand the hash or salt back to the caller', async () => {
    const { user } = await Auth.signUp('ann', 'holiday123', 'holiday123');
    assert.deepEqual(Object.keys(user).sort(), ['userId', 'username']);
  });

  test('salts each account separately, so equal passwords hash differently', async () => {
    await Auth.signUp('ann', 'holiday123', 'holiday123');
    await Auth.signUp('bob', 'holiday123', 'holiday123');
    const [a, b] = JSON.parse(localStorage.getItem(USERS_KEY));
    assert.notEqual(a.salt, b.salt);
    assert.notEqual(a.hash, b.hash);
  });

  test('refuses a username that is already taken, whatever the casing', async () => {
    await Auth.signUp('ann', 'holiday123', 'holiday123');
    const again = await Auth.signUp('ANN', 'different1', 'different1');
    assert.match(again.error, /already taken/);
    assert.equal(Auth.userCount(), 1);
  });

  test('keeps the username as typed but matches it case-insensitively', async () => {
    const { user } = await Auth.signUp('AnnSmith', 'holiday123', 'holiday123');
    assert.equal(user.username, 'AnnSmith');
    assert.equal(Auth.taken('annsmith'), true);
    assert.equal(Auth.taken('ANNSMITH'), true);
    assert.equal(Auth.taken('bob'), false);
  });

  test('refuses a bad username or password without writing anything', async () => {
    assert.match((await Auth.signUp('ab', 'holiday123', 'holiday123')).error, /at least 3/);
    assert.match((await Auth.signUp('ann', 'short', 'short')).error, /at least 8/);
    assert.equal(Auth.userCount(), 0);
  });

  test('refuses when the confirmation does not match', async () => {
    const res = await Auth.signUp('ann', 'holiday123', 'holiday124');
    assert.match(res.error, /do not match/);
    assert.equal(Auth.userCount(), 0);
  });

  test('skips the confirmation check when none is given', async () => {
    const res = await Auth.signUp('ann', 'holiday123');
    assert.equal(res.error, undefined);
  });

  test('only the very first account is flagged as such', async () => {
    assert.equal((await Auth.signUp('ann', 'holiday123')).firstEver, true);
    assert.equal((await Auth.signUp('bob', 'holiday123')).firstEver, false);
  });

  test('says so plainly when the browser has no Web Crypto', async () => {
    const res = await withoutWebCrypto(() => Auth.signUp('ann', 'holiday123'));
    assert.match(res.error, /no Web Crypto/);
    assert.equal(Auth.userCount(), 0);
  });
});

describe('Auth.signIn', () => {
  beforeEach(installStorage);

  test('lets the right password in', async () => {
    const { user } = await Auth.signUp('ann', 'holiday123', 'holiday123');
    const res = await Auth.signIn('ann', 'holiday123');
    assert.equal(res.error, undefined);
    assert.deepEqual(res.user, user);
  });

  test('accepts the username in any casing, with stray spaces', async () => {
    await Auth.signUp('ann', 'holiday123');
    assert.equal((await Auth.signIn('  ANN  ', 'holiday123')).error, undefined);
  });

  test('turns away the wrong password', async () => {
    await Auth.signUp('ann', 'holiday123');
    const res = await Auth.signIn('ann', 'holiday124');
    assert.match(res.error, /Wrong username or password/);
    assert.equal(res.user, undefined);
  });

  test('gives an unknown username the same answer as a wrong password', async () => {
    await Auth.signUp('ann', 'holiday123');
    const missing = await Auth.signIn('nobody', 'holiday123');
    const wrong = await Auth.signIn('ann', 'holiday124');
    assert.equal(missing.error, wrong.error);
  });

  test('is case-sensitive about the password', async () => {
    await Auth.signUp('ann', 'holiday123');
    assert.match((await Auth.signIn('ann', 'HOLIDAY123')).error, /Wrong/);
  });

  test('honours the iteration count stored with the account', async () => {
    await Auth.signUp('ann', 'holiday123');
    const list = JSON.parse(localStorage.getItem(USERS_KEY));
    list[0].iterations = 1000;            // as if written by an older build
    list[0].hash = 'not-the-right-hash';
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
    // the wrong hash must not let anyone in, but it must not throw either
    assert.match((await Auth.signIn('ann', 'holiday123')).error, /Wrong/);
  });

  test('says so plainly when the browser has no Web Crypto', async () => {
    const res = await withoutWebCrypto(() => Auth.signIn('ann', 'holiday123'));
    assert.match(res.error, /no Web Crypto/);
  });
});

describe('Auth — the user list', () => {
  beforeEach(installStorage);

  test('starts empty', () => {
    assert.equal(Auth.userCount(), 0);
    assert.equal(Auth.taken('ann'), false);
  });

  test('shrugs off a corrupt user list rather than throwing', () => {
    for (const junk of ['{ not json', 'null', '{"users":[]}', '42']) {
      localStorage.setItem(USERS_KEY, junk);
      assert.equal(Auth.userCount(), 0, junk);
      assert.equal(Auth.taken('ann'), false, junk);
    }
  });
});

describe('Auth — sessions', () => {
  beforeEach(installStorage);

  const someone = { userId: 'u1', username: 'ann' };
  const listWith = (...users) => localStorage.setItem(USERS_KEY, JSON.stringify(users));

  test('there is nobody signed in to begin with', () => {
    assert.equal(Auth.current(), null);
  });

  test('"keep me signed in" survives a closed tab', () => {
    listWith({ id: 'u1', key: 'ann', username: 'ann' });
    Auth.startSession(someone, true);
    assert.ok(localStorage.getItem(SESSION_KEY));
    assert.equal(sessionStorage.getItem(SESSION_KEY), null);
    assert.deepEqual(Auth.current(), someone);
  });

  test('without it, the session dies with the tab', () => {
    listWith({ id: 'u1', key: 'ann', username: 'ann' });
    Auth.startSession(someone, false);
    assert.ok(sessionStorage.getItem(SESSION_KEY));
    assert.equal(localStorage.getItem(SESSION_KEY), null);
    assert.deepEqual(Auth.current(), someone);
  });

  test('starting a session clears any earlier one, so only one is live', () => {
    listWith({ id: 'u1', key: 'ann', username: 'ann' });
    Auth.startSession(someone, true);
    Auth.startSession(someone, false);
    assert.equal(localStorage.getItem(SESSION_KEY), null);
    assert.ok(sessionStorage.getItem(SESSION_KEY));
  });

  test('reads the username back from the account, not from the session blob', () => {
    listWith({ id: 'u1', key: 'ann', username: 'Ann Renamed' });
    Auth.startSession(someone, true);
    assert.deepEqual(Auth.current(), { userId: 'u1', username: 'Ann Renamed' });
  });

  test('a session whose account is gone is dropped', () => {
    listWith({ id: 'u1', key: 'ann', username: 'ann' });
    Auth.startSession(someone, true);
    listWith();                            // the account is deleted
    assert.equal(Auth.current(), null);
    assert.equal(localStorage.getItem(SESSION_KEY), null, 'the stale session is cleared out');
  });

  test('an unreadable session blob is dropped', () => {
    listWith({ id: 'u1', key: 'ann', username: 'ann' });
    sessionStorage.setItem(SESSION_KEY, '{ not json');
    assert.equal(Auth.current(), null);
    assert.equal(sessionStorage.getItem(SESSION_KEY), null);
  });

  test('signing out clears both kinds of session', () => {
    listWith({ id: 'u1', key: 'ann', username: 'ann' });
    Auth.startSession(someone, true);
    localStorage.setItem(SESSION_KEY, localStorage.getItem(SESSION_KEY));
    sessionStorage.setItem(SESSION_KEY, localStorage.getItem(SESSION_KEY));
    Auth.signOut();
    assert.equal(Auth.current(), null);
    assert.equal(localStorage.getItem(SESSION_KEY), null);
    assert.equal(sessionStorage.getItem(SESSION_KEY), null);
  });

  test('signing out twice is harmless', () => {
    Auth.signOut();
    assert.doesNotThrow(() => Auth.signOut());
  });

  test('a blocked storage does not stop the sign-in itself', () => {
    installStorage();
    globalThis.localStorage.setItem = () => { throw new Error('SecurityError'); };
    globalThis.sessionStorage.setItem = () => { throw new Error('SecurityError'); };
    assert.deepEqual(Auth.startSession(someone, true), someone);
  });

  test('signing up then signing in end to end', async () => {
    installStorage();
    const up = await Auth.signUp('ann', 'holiday123', 'holiday123');
    Auth.startSession(up.user, true);
    assert.deepEqual(Auth.current(), up.user);
    Auth.signOut();
    assert.equal(Auth.current(), null);
    const back = await Auth.signIn('ann', 'holiday123');
    assert.deepEqual(back.user, up.user);
  });
});
