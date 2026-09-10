/* ============================================================
   store.js — per-account persistence
   ------------------------------------------------------------
   One localStorage bucket per user id, holding that account's
   trips. Deliberately dumb: it reads and writes JSON and knows
   nothing about the shape of a trip — app.js owns that.
   ============================================================ */

const Store = (() => {
  const dataKey = userId => `trippysplit.data.${userId}`;
  const LEGACY_KEY = 'trippysplit.v1';   // the pre-accounts single-trip save

  function load(userId) {
    try {
      const v = JSON.parse(localStorage.getItem(dataKey(userId)));
      if (v && Array.isArray(v.trips)) return v;
    } catch (err) {
      console.warn('Could not read saved trips:', err);
    }
    return { trips: [] };
  }

  function save(userId, db) {
    localStorage.setItem(dataKey(userId), JSON.stringify(db));
  }

  function remove(userId) {
    try { localStorage.removeItem(dataKey(userId)); } catch (_) {}
  }

  /* The trip saved by the version of this app that had no accounts.
     Returned once so it can be adopted by the first account created. */
  function legacyRaw() {
    try {
      const v = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (v && Array.isArray(v.people) && Array.isArray(v.expenses) && (v.people.length || v.expenses.length)) return v;
    } catch (_) {}
    return null;
  }

  function clearLegacy() {
    try { localStorage.removeItem(LEGACY_KEY); } catch (_) {}
  }

  return { load, save, remove, legacyRaw, clearLegacy };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Store;
