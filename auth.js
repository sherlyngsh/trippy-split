/* ============================================================
   auth.js — local accounts for Trippy Split
   ------------------------------------------------------------
   Passwords are salted and stretched with PBKDF2-SHA256 before
   anything is written down, and only the derived hash is stored.

   Be clear-eyed about what this is: every account, hash and trip
   lives in this browser's localStorage, which the person using
   the browser can read and edit. That makes this a sign-in gate
   for sharing a laptop — NOT server-grade authentication. Real
   auth needs a backend that holds the hashes out of reach.
   Never reuse a password you care about here.
   ============================================================ */

const Auth = (() => {
  const USERS_KEY = 'trippysplit.users.v1';
  const SESSION_KEY = 'trippysplit.session.v1';
  const ITERATIONS = 150000;
  const KEY_BITS = 256;

  /* Web Crypto is required. It is available on https:, localhost and
     file:// in current browsers; if it is missing we say so loudly
     rather than quietly falling back to something weaker. */
  const ready = () => !!(globalThis.crypto && globalThis.crypto.subtle && globalThis.crypto.getRandomValues);

  const enc = s => new TextEncoder().encode(s);
  const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const norm = u => String(u || '').trim().toLowerCase();

  function readUsers() {
    try {
      const v = JSON.parse(localStorage.getItem(USERS_KEY));
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  }
  const writeUsers = list => localStorage.setItem(USERS_KEY, JSON.stringify(list));

  async function derive(password, salt, iterations) {
    const material = await crypto.subtle.importKey('raw', enc(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, KEY_BITS);
    return toB64(bits);
  }

  /* compare without leaking the answer through how long it takes */
  function same(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function checkUsername(u) {
    const v = String(u || '').trim();
    if (!v) return 'Pick a username.';
    if (v.length < 3) return 'Username needs at least 3 characters.';
    if (v.length > 20) return 'Username can be at most 20 characters.';
    if (!/^[a-zA-Z0-9._-]+$/.test(v)) return 'Use letters, numbers, dots, dashes or underscores only.';
    return null;
  }

  function checkPassword(p) {
    const v = String(p || '');
    if (v.length < 8) return 'Password needs at least 8 characters.';
    if (v.length > 200) return 'That password is unreasonably long.';
    return null;
  }

  const userCount = () => readUsers().length;
  const taken = username => readUsers().some(u => u.key === norm(username));

  async function signUp(username, password, confirm) {
    if (!ready()) return { error: 'This browser has no Web Crypto, so passwords cannot be hashed safely.' };
    const nameErr = checkUsername(username);
    if (nameErr) return { error: nameErr };
    const passErr = checkPassword(password);
    if (passErr) return { error: passErr };
    if (confirm !== undefined && password !== confirm) return { error: 'The two passwords do not match.' };
    if (taken(username)) return { error: 'That username is already taken on this browser.' };

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt, ITERATIONS);
    const user = {
      id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      key: norm(username),
      username: String(username).trim(),
      salt: toB64(salt),
      iterations: ITERATIONS,
      hash,
      created: Date.now(),
    };
    const list = readUsers();
    list.push(user);
    writeUsers(list);
    return { user: publicUser(user), firstEver: list.length === 1 };
  }

  async function signIn(username, password) {
    if (!ready()) return { error: 'This browser has no Web Crypto, so passwords cannot be checked safely.' };
    const user = readUsers().find(u => u.key === norm(username));
    /* Derive either way so a missing username and a wrong password
       take the same time and give the same message. */
    const salt = user ? fromB64(user.salt) : crypto.getRandomValues(new Uint8Array(16));
    const iterations = user?.iterations || ITERATIONS;
    const hash = await derive(password, salt, iterations);
    if (!user || !same(hash, user.hash)) return { error: 'Wrong username or password.' };
    return { user: publicUser(user) };
  }

  const publicUser = u => ({ userId: u.id, username: u.username });

  function startSession(user, remember) {
    const payload = JSON.stringify({ ...user, at: Date.now() });
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, payload);
    } catch (_) { /* storage blocked — the session just won't survive a reload */ }
    return user;
  }

  function current() {
    for (const store of [sessionStorage, localStorage]) {
      let raw = null;
      try { raw = store.getItem(SESSION_KEY); } catch (_) { continue; }
      if (!raw) continue;
      try {
        const s = JSON.parse(raw);
        const stillThere = readUsers().find(u => u.id === s.userId);
        if (stillThere) return publicUser(stillThere);
        store.removeItem(SESSION_KEY);        // account gone; drop the stale session
      } catch (_) { store.removeItem(SESSION_KEY); }
    }
    return null;
  }

  function signOut() {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  return { ready, signUp, signIn, signOut, startSession, current, checkUsername, checkPassword, taken, userCount, ITERATIONS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Auth;
