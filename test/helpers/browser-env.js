/* ============================================================
   browser-env.js — the slice of the browser that auth.js and
   store.js actually touch.
   ------------------------------------------------------------
   Both modules talk to Web Storage directly, so tests get an
   in-memory stand-in rather than a real browser. Everything
   else they need (crypto.subtle, btoa/atob, TextEncoder) node
   already provides.
   ============================================================ */

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(String(k)) ? this.map.get(String(k)) : null; }
  setItem(k, v) { this.map.set(String(k), String(v)); }
  removeItem(k) { this.map.delete(String(k)); }
  clear() { this.map.clear(); }
  key(i) { return [...this.map.keys()][i] ?? null; }
  get length() { return this.map.size; }
}

/* Install fresh, empty storages. Call from beforeEach so no test
   can see what another one wrote. */
function installStorage() {
  globalThis.localStorage = new MemoryStorage();
  globalThis.sessionStorage = new MemoryStorage();
  return { localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage };
}

/* A storage whose writes always throw, for the quota-exceeded paths. */
function makeFailingStorage(message = 'QuotaExceededError') {
  return {
    getItem() { throw new Error(message); },
    setItem() { throw new Error(message); },
    removeItem() { throw new Error(message); },
  };
}

module.exports = { MemoryStorage, installStorage, makeFailingStorage };
