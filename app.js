/* ============================================================
   Trippy Split — travel expense tracker with SGD as base
   Vanilla JS, no build step, saves to localStorage.

   Three views: sign in → your trips → one trip.
   All money maths is done in integer SGD cents so splits
   always add back up to the exact total.
   ============================================================ */

const BASE = 'SGD';

/* ---------- currencies: rate = how many SGD 1 unit is worth ---------- */
const CURRENCIES = [
  { code: 'SGD', name: 'Singapore Dollar',  flag: '🇸🇬', sym: 'S$',  dp: 2, rate: 1 },
  { code: 'MYR', name: 'Malaysian Ringgit', flag: '🇲🇾', sym: 'RM',  dp: 2, rate: 0.30 },
  { code: 'THB', name: 'Thai Baht',         flag: '🇹🇭', sym: '฿',   dp: 2, rate: 0.040 },
  { code: 'IDR', name: 'Indonesian Rupiah', flag: '🇮🇩', sym: 'Rp',  dp: 0, rate: 0.000080 },
  { code: 'VND', name: 'Vietnamese Dong',   flag: '🇻🇳', sym: '₫',   dp: 0, rate: 0.000051 },
  { code: 'PHP', name: 'Philippine Peso',   flag: '🇵🇭', sym: '₱',   dp: 2, rate: 0.0225 },
  { code: 'JPY', name: 'Japanese Yen',      flag: '🇯🇵', sym: '¥',   dp: 0, rate: 0.0088 },
  { code: 'KRW', name: 'Korean Won',        flag: '🇰🇷', sym: '₩',   dp: 0, rate: 0.00095 },
  { code: 'CNY', name: 'Chinese Yuan',      flag: '🇨🇳', sym: '¥',   dp: 2, rate: 0.180 },
  { code: 'HKD', name: 'Hong Kong Dollar',  flag: '🇭🇰', sym: 'HK$', dp: 2, rate: 0.166 },
  { code: 'TWD', name: 'Taiwan Dollar',     flag: '🇹🇼', sym: 'NT$', dp: 2, rate: 0.041 },
  { code: 'USD', name: 'US Dollar',         flag: '🇺🇸', sym: 'US$', dp: 2, rate: 1.30 },
  { code: 'EUR', name: 'Euro',              flag: '🇪🇺', sym: '€',   dp: 2, rate: 1.42 },
  { code: 'GBP', name: 'British Pound',     flag: '🇬🇧', sym: '£',   dp: 2, rate: 1.65 },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺', sym: 'A$',  dp: 2, rate: 0.86 },
  { code: 'NZD', name: 'New Zealand Dollar',flag: '🇳🇿', sym: 'NZ$', dp: 2, rate: 0.79 },
  { code: 'INR', name: 'Indian Rupee',      flag: '🇮🇳', sym: '₹',   dp: 2, rate: 0.0152 },
  { code: 'AED', name: 'UAE Dirham',        flag: '🇦🇪', sym: 'AED', dp: 2, rate: 0.354 },
  { code: 'CHF', name: 'Swiss Franc',       flag: '🇨🇭', sym: 'CHF', dp: 2, rate: 1.60 },
  { code: 'CAD', name: 'Canadian Dollar',   flag: '🇨🇦', sym: 'C$',  dp: 2, rate: 0.94 },
  { code: 'KHR', name: 'Cambodian Riel',    flag: '🇰🇭', sym: '៛',   dp: 0, rate: 0.00032 },
  { code: 'LAK', name: 'Lao Kip',           flag: '🇱🇦', sym: '₭',   dp: 0, rate: 0.000060 },
  { code: 'MMK', name: 'Myanmar Kyat',      flag: '🇲🇲', sym: 'K',   dp: 0, rate: 0.00062 },
  { code: 'LKR', name: 'Sri Lankan Rupee',  flag: '🇱🇰', sym: 'Rs',  dp: 2, rate: 0.0044 },
  { code: 'NPR', name: 'Nepalese Rupee',    flag: '🇳🇵', sym: 'Rs',  dp: 2, rate: 0.0095 },
  { code: 'MVR', name: 'Maldivian Rufiyaa', flag: '🇲🇻', sym: 'MVR', dp: 2, rate: 0.0845 },
  { code: 'TRY', name: 'Turkish Lira',      flag: '🇹🇷', sym: '₺',   dp: 2, rate: 0.032 },
  { code: 'ZAR', name: 'South African Rand',flag: '🇿🇦', sym: 'R',   dp: 2, rate: 0.072 },
  { code: 'EGP', name: 'Egyptian Pound',    flag: '🇪🇬', sym: 'E£',  dp: 2, rate: 0.027 },
  { code: 'SEK', name: 'Swedish Krona',     flag: '🇸🇪', sym: 'kr',  dp: 2, rate: 0.135 },
  { code: 'NOK', name: 'Norwegian Krone',   flag: '🇳🇴', sym: 'kr',  dp: 2, rate: 0.126 },
  { code: 'DKK', name: 'Danish Krone',      flag: '🇩🇰', sym: 'kr',  dp: 2, rate: 0.190 },
  { code: 'CZK', name: 'Czech Koruna',      flag: '🇨🇿', sym: 'Kč',  dp: 2, rate: 0.058 },
  { code: 'PLN', name: 'Polish Zloty',      flag: '🇵🇱', sym: 'zł',  dp: 2, rate: 0.335 },
  { code: 'HUF', name: 'Hungarian Forint',  flag: '🇭🇺', sym: 'Ft',  dp: 0, rate: 0.0036 },
  { code: 'MXN', name: 'Mexican Peso',      flag: '🇲🇽', sym: 'MX$', dp: 2, rate: 0.070 },
  { code: 'BRL', name: 'Brazilian Real',    flag: '🇧🇷', sym: 'R$',  dp: 2, rate: 0.24 },
];
const CUR = Object.fromEntries(CURRENCIES.map(c => [c.code, c]));
const DEFAULT_RATES = Object.fromEntries(CURRENCIES.map(c => [c.code, c.rate]));

/* ---------- categories: colour slot is fixed per category ---------- */
const CATEGORIES = [
  { id: 'hotel',     label: 'Hotel',    icon: '🏨', slot: 1 },
  { id: 'transport', label: 'Transport',icon: '🚕', slot: 2 },
  { id: 'entrance',  label: 'Entrance', icon: '🎟️', slot: 3 },
  { id: 'food',      label: 'Food',     icon: '🍜', slot: 4 },
  { id: 'shopping',  label: 'Shopping', icon: '🛍️', slot: 5 },
  { id: 'other',     label: 'Other',    icon: '✨', slot: 6 },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const catColor = id => `var(--v${(CAT[id] || CAT.other).slot})`;

const AVATARS = ['🐨','🦊','🐼','🦩','🐧','🦖','🐙','🦉','🐝','🦄','🐳','🐢','🦥','🐷','🦜','🐰'];
const TRIP_ICONS = ['🗼','🏝️','⛩️','🏔️','🗽','🎡','🏰','🕌','🌊','🎿','🏜️','🚂','🛳️','✈️','🌴','🍜','🐘','🎢','🗿','🏟️'];

/* ============================================================
   State
   ============================================================ */
let account = null;              // { userId, username }
let db = { trips: [] };          // the signed-in account's trips
let state = null;                // the trip currently open, or null
let authMode = 'in';
let ui = { mode: 'equal', cat: 'food', editingId: null, checked: new Set(), nums: {} };

const uid = () => Math.random().toString(36).slice(2, 10);

function blankTrip(fields = {}) {
  return Object.assign({
    id: uid(),
    name: 'Our Holiday',
    emoji: TRIP_ICONS[0],
    from: '', to: '',
    created: Date.now(),
    updated: Date.now(),
    people: [],
    expenses: [],
    settlements: [],
    rates: { ...DEFAULT_RATES },
    meId: null,
  }, fields);
}

/* Imported numbers can be anything at all — strings, null, objects. Coerce to a
   finite number or fall back, so no NaN ever reaches the money maths. */
const finiteOr = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;

/* { personId: value } maps from an import, with every value made a sane number. */
function sanitiseMap(m, fallback) {
  if (!m || typeof m !== 'object') return {};
  const out = {};
  Object.keys(m).forEach(id => { out[id] = Math.max(0, finiteOr(m[id], fallback)); });
  return out;
}

/* Trips arrive from storage (or an import) as untrusted JSON — fill in
   whatever the app expects and drop anything that no longer hangs together. */
function normalizeTrip(t) {
  const trip = blankTrip({
    id: t.id || uid(),
    name: String(t.name || t.tripName || 'Our Holiday').slice(0, 40),
    emoji: TRIP_ICONS.includes(t.emoji) ? t.emoji : TRIP_ICONS[0],
    from: t.from || '', to: t.to || '',
    created: t.created || Date.now(),
    updated: t.updated || Date.now(),
    meId: t.meId || null,
  });
  trip.people = (Array.isArray(t.people) ? t.people : [])
    .filter(p => p && p.id && p.name)
    .map((p, i) => ({ id: p.id, name: String(p.name).slice(0, 24), avatar: p.avatar || AVATARS[i % AVATARS.length] }));
  const ids = new Set(trip.people.map(p => p.id));
  trip.expenses = (Array.isArray(t.expenses) ? t.expenses : [])
    .filter(e => e && e.id && ids.has(e.payerId))
    .map(e => ({
      id: e.id, created: e.created || Date.now(),
      title: String(e.title || 'Expense').slice(0, 60),
      amount: Number(e.amount) || 0,
      currency: CUR[e.currency] ? e.currency : BASE,
      rate: Number(e.rate) > 0 ? Number(e.rate) : (DEFAULT_RATES[e.currency] || 1),
      category: CAT[e.category] ? e.category : 'other',
      date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : todayISO(),
      payerId: e.payerId,
      participants: (Array.isArray(e.participants) ? e.participants : []).filter(id => ids.has(id)),
      splitMode: ['equal', 'shares', 'exact'].includes(e.splitMode) ? e.splitMode : 'equal',
      note: String(e.note || '').slice(0, 120),
      shares: sanitiseMap(e.shares, 1),
      exact: sanitiseMap(e.exact, 0),
    }))
    .filter(e => e.participants.length);
  trip.settlements = (Array.isArray(t.settlements) ? t.settlements : [])
    .filter(s => s && ids.has(s.fromId) && ids.has(s.toId) && Number(s.cents) > 0)
    .map(s => ({ id: s.id || uid(), fromId: s.fromId, toId: s.toId, cents: Math.round(Number(s.cents)), date: s.date || todayISO() }));
  trip.rates = { ...DEFAULT_RATES };
  Object.entries(t.rates && typeof t.rates === 'object' ? t.rates : {}).forEach(([code, v]) => {
    const r = finiteOr(v, 0);
    if (r > 0 && CUR[code]) trip.rates[code] = r;
  });
  if (!trip.people.some(p => p.id === trip.meId)) trip.meId = null;
  return trip;
}

function loadAccountData() {
  const raw = Store.load(account.userId);
  db = { trips: (raw.trips || []).map(normalizeTrip) };
}

function save() {
  if (!account) return;
  if (state) state.updated = Date.now();
  try {
    Store.save(account.userId, db);
  } catch (err) {
    toast('Could not save — browser storage is full or blocked.');
  }
}

/* ============================================================
   Money helpers
   ============================================================ */
const centsOf = (amount, rate) => Math.round(Number(amount) * Number(rate) * 100);

function sgd(cents) {
  const v = (Math.abs(cents) / 100).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (cents < 0 ? '-S$' : 'S$') + v;
}

function foreign(amount, code) {
  const c = CUR[code] || { sym: code, dp: 2 };
  const v = Number(amount).toLocaleString('en-SG', { minimumFractionDigits: c.dp, maximumFractionDigits: c.dp });
  return `${c.sym}${v}`;
}

const rateFor = code => Number((state && state.rates[code]) ?? DEFAULT_RATES[code] ?? 1);
const isForeign = code => code !== BASE;

/* Split one expense into { personId: sgdCents } that sums exactly to the total. */
function splitOf(exp, trip = state) {
  const total = centsOf(exp.amount, exp.rate);
  const ids = (exp.participants || []).filter(id => personIn(trip, id));
  const out = {};
  if (!ids.length) return out;

  if (exp.splitMode === 'exact') {
    let sum = 0;
    ids.forEach(id => {
      const c = centsOf(exp.exact?.[id] || 0, exp.rate);
      out[id] = c; sum += c;
    });
    // absorb any rounding gap on the largest line so it still ties to the total
    const gap = total - sum;
    if (gap !== 0) {
      const biggest = ids.reduce((a, b) => (out[b] > out[a] ? b : a), ids[0]);
      out[biggest] += gap;
    }
    return out;
  }

  const weights = ids.map(id => exp.splitMode === 'shares' ? Math.max(0, Number(exp.shares?.[id] ?? 1)) : 1);
  const W = weights.reduce((a, b) => a + b, 0);
  if (!(W > 0)) { ids.forEach(id => out[id] = 0); return out; }

  const raw = weights.map(w => total * w / W);
  const floors = raw.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  // hand out the leftover cents to the biggest fractional remainders first
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  const add = floors.slice();
  for (let k = 0; k < order.length && left > 0; k++, left--) add[order[k][1]]++;
  ids.forEach((id, i) => out[id] = add[i]);
  return out;
}

/* Net position per person, in SGD cents. Positive = they're owed money. */
function balancesFor(trip) {
  const paid = {}, owed = {};
  trip.people.forEach(p => { paid[p.id] = 0; owed[p.id] = 0; });

  trip.expenses.forEach(exp => {
    const total = centsOf(exp.amount, exp.rate);
    if (paid[exp.payerId] !== undefined) paid[exp.payerId] += total;
    const parts = splitOf(exp, trip);
    Object.entries(parts).forEach(([id, c]) => { if (owed[id] !== undefined) owed[id] += c; });
  });

  const net = {};
  trip.people.forEach(p => net[p.id] = paid[p.id] - owed[p.id]);

  // a recorded payment moves money for real: the payer's debt shrinks
  trip.settlements.forEach(s => {
    if (net[s.fromId] !== undefined) net[s.fromId] += s.cents;
    if (net[s.toId] !== undefined) net[s.toId] -= s.cents;
  });

  return { paid, owed, net };
}
const balances = () => balancesFor(state);

/* Fewest-transfers settlement plan. */
function settlePlan(net, trip = state) {
  const debtors = [], creditors = [];
  trip.people.forEach(p => {
    const n = net[p.id] || 0;
    if (n < 0) debtors.push({ id: p.id, amt: -n });
    else if (n > 0) creditors.push({ id: p.id, amt: n });
  });
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const plan = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0) plan.push({ fromId: debtors[i].id, toId: creditors[j].id, cents: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt <= 0) i++;
    if (creditors[j].amt <= 0) j++;
  }
  return plan;
}

const tripTotalCents = trip => trip.expenses.reduce((a, e) => a + centsOf(e.amount, e.rate), 0);

/* ============================================================
   Small utils
   ============================================================ */
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const personIn = (trip, id) => ((trip && trip.people) || []).find(p => p.id === id);
const personById = id => personIn(state, id);
const pname = id => { const p = personById(id); return p ? p.name : 'someone'; };
const pav = id => { const p = personById(id); return p ? p.avatar : '👤'; };
const who = id => `${pav(id)} ${esc(pname(id))}`;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prettyDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return iso;
  const label = dt.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
  return iso === todayISO() ? `Today · ${label}` : label;
}

function tripDateLabel(trip) {
  const fmt = iso => {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  if (trip.from && trip.to) {
    const a = fmt(trip.from), b = fmt(trip.to);
    return a === b ? a : `${a} – ${b}`;
  }
  return fmt(trip.from || trip.to);
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

/* ============================================================
   View switching
   ============================================================ */
function setView(name) {
  ['auth', 'trips', 'trip', 'blocked'].forEach(v => { $('#view-' + v).hidden = v !== name; });
  $('#actions-trips').hidden = name !== 'trips';
  $('#actions-trip').hidden = name !== 'trip';
  $('#brand-static').hidden = name === 'trip';
  $('#brand-trip').hidden = name !== 'trip';
  $('#menu-pop').hidden = true;
  $('.foot').hidden = name === 'auth' || name === 'blocked';
  window.scrollTo(0, 0);
}

function showAuth() {
  account = null; db = { trips: [] }; state = null;
  $('#auth-form').reset();
  $('#auth-remember').checked = true;
  setAuthMode(Auth.userCount() ? 'in' : 'up');
  hideAuthError();
  setView('auth');
}

function enterApp(user) {
  account = user;
  loadAccountData();
  state = null;
  showTrips();
}

function showTrips() {
  state = null;
  $('#whoami').innerHTML = `👋 Hi, <b>${esc(account.username)}</b>`;
  $('#new-trip-form').hidden = true;
  renderTrips();
  setView('trips');
}

function openTrip(id) {
  const trip = db.trips.find(t => t.id === id);
  if (!trip) { toast('That trip is gone.'); showTrips(); return; }
  state = trip;
  resetForm();
  render();
  setView('trip');
}

/* ============================================================
   Auth screen
   ============================================================ */
function setAuthMode(mode) {
  authMode = mode;
  const up = mode === 'up';
  document.querySelectorAll('[data-auth-tab]').forEach(b => {
    const on = b.dataset.authTab === mode;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', String(on));
  });
  $('#auth-title').textContent = up ? 'Pack your bags' : 'Welcome back';
  $('#auth-sub').textContent = up
    ? 'Create an account to keep your trips together on this device.'
    : 'Sign in to pick up where your trip left off.';
  $('#auth-confirm-field').hidden = !up;
  $('#auth-pass-hint').hidden = !up;
  $('#auth-submit').textContent = up ? 'Create account 🎉' : 'Sign in 🌞';
  $('#auth-pass').setAttribute('autocomplete', up ? 'new-password' : 'current-password');
  hideAuthError();
}

function showAuthError(msg) {
  const el = $('#auth-error');
  el.textContent = msg;
  el.hidden = false;
}
const hideAuthError = () => { $('#auth-error').hidden = true; };

function busy(on, label) {
  const btn = $('#auth-submit');
  btn.disabled = on;
  if (on) { btn.dataset.was = btn.textContent; btn.textContent = label; }
  else if (btn.dataset.was) btn.textContent = btn.dataset.was;
}

async function submitAuth(ev) {
  ev.preventDefault();
  hideAuthError();
  const username = $('#auth-user').value;
  const password = $('#auth-pass').value;
  const remember = $('#auth-remember').checked;
  const mode = authMode;

  busy(true, mode === 'up' ? 'Creating…' : 'Checking…');
  let res;
  try {
    res = mode === 'up'
      ? await Auth.signUp(username, password, $('#auth-confirm').value)
      : await Auth.signIn(username, password);
  } catch (err) {
    res = { error: 'Something went wrong: ' + err.message };
  }
  busy(false);

  if (res.error) { showAuthError(res.error); return; }

  Auth.startSession(res.user, remember);
  enterApp(res.user);

  if (mode === 'up') {
    /* A trip left behind by the pre-accounts version belongs to whoever
       sets up the first account on this browser. */
    const legacy = res.firstEver ? Store.legacyRaw() : null;
    if (legacy) {
      db.trips.unshift(normalizeTrip(legacy));
      Store.clearLegacy();
      save();
      renderTrips();
      toast('Account created — and your earlier trip came across 🧳');
    } else {
      toast(`Account created — welcome, ${res.user.username}! 🎉`);
    }
  } else {
    toast(`Welcome back, ${res.user.username}! 🌞`);
  }
}

async function demoSignIn() {
  hideAuthError();
  busy(true, 'Setting up…');
  let res = await Auth.signIn('demo', 'demo1234');
  if (res.error) res = await Auth.signUp('demo', 'demo1234', 'demo1234');
  busy(false);
  if (res.error) {
    showAuthError('A "demo" account already exists here with a different password. Sign in with that, or create your own account.');
    return;
  }
  Auth.startSession(res.user, false);
  enterApp(res.user);
  if (!db.trips.length) addSampleTrip();
  toast('Signed in as demo · password demo1234');
}

function signOut() {
  Auth.signOut();
  showAuth();
  toast('Signed out. See you next trip! 👋');
}

/* ============================================================
   Trips dashboard
   ============================================================ */
function renderTrips() {
  const trips = db.trips.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));

  $('#trips-empty').hidden = trips.length > 0;
  $('#trips-count').textContent = trips.length
    ? `${trips.length} trip${trips.length > 1 ? 's' : ''} · ${sgd(trips.reduce((a, t) => a + tripTotalCents(t), 0))} tracked in total`
    : 'Nothing here yet';

  $('#trip-grid').innerHTML = trips.map(t => {
    const total = tripTotalCents(t);
    const { net } = balancesFor(t);
    const me = personIn(t, t.meId);
    const n = me ? (net[me.id] || 0) : 0;
    const dates = tripDateLabel(t);

    let badge = '';
    if (me) {
      const cls = n > 0 ? 'owed' : n < 0 ? 'owe' : 'flat';
      const text = n > 0 ? `↙ You&rsquo;re owed ${sgd(n)}` : n < 0 ? `↗ You owe ${sgd(-n)}` : '✓ You&rsquo;re all square';
      badge = `<span class="trip-net ${cls}">${text}</span>`;
    } else if (t.people.length) {
      badge = `<span class="trip-net flat">Pick who you are inside</span>`;
    }

    return `<li class="trip-card">
      <div class="trip-body" data-open="${t.id}" role="button" tabindex="0" aria-label="Open ${esc(t.name)}">
        <span class="trip-emoji">${t.emoji}</span>
        <span class="trip-title">${esc(t.name)}</span>
        ${dates ? `<span class="trip-dates">🗓️ ${esc(dates)}</span>` : ''}
        <span class="trip-stats">${t.people.length} traveller${t.people.length === 1 ? '' : 's'} · ${t.expenses.length} expense${t.expenses.length === 1 ? '' : 's'}${t.people.length ? ` <span class="trip-avatars">${t.people.map(p => p.avatar).join('')}</span>` : ''}</span>
        <strong class="trip-total">${sgd(total)}</strong>
        ${badge}
      </div>
      <div class="trip-foot">
        <button class="btn btn-tiny btn-sun" type="button" data-open="${t.id}">Open trip</button>
        <button class="btn btn-tiny btn-ghost" type="button" data-del-trip="${t.id}">Delete</button>
      </div>
    </li>`;
  }).join('');
}

function buildTripIconPicker() {
  $('#trip-new-emoji').innerHTML = TRIP_ICONS.map(e => `<option value="${e}">${e}</option>`).join('');
}

function openNewTripForm(open) {
  const form = $('#new-trip-form');
  form.hidden = !open;
  $('#new-trip-error').hidden = true;
  if (open) {
    form.reset();
    $('#trip-new-emoji').value = TRIP_ICONS[Math.floor(Math.random() * TRIP_ICONS.length)];
    $('#trip-new-name').focus();
  }
}

function tripError(msg) {
  const el = $('#new-trip-error');
  el.textContent = msg;
  el.hidden = false;
}

function createTrip(ev) {
  ev.preventDefault();
  const name = $('#trip-new-name').value.trim();
  const from = $('#trip-new-from').value;
  const to = $('#trip-new-to').value;
  if (!name) { tripError('Give the trip a name.'); return; }
  if (from && to && to < from) { tripError('The end date is before the start date.'); return; }

  const trip = blankTrip({ name, emoji: $('#trip-new-emoji').value, from, to });
  $('#trip-new-people').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 16)
    .forEach(personName => {
      if (trip.people.some(p => p.name.toLowerCase() === personName.toLowerCase())) return;
      trip.people.push({ id: uid(), name: personName.slice(0, 24), avatar: AVATARS[trip.people.length % AVATARS.length] });
    });
  if (trip.people.length) trip.meId = trip.people[0].id;

  db.trips.unshift(trip);
  state = trip;
  save();
  openNewTripForm(false);
  openTrip(trip.id);
  toast(`${trip.emoji} ${trip.name} created — add your expenses! 🎉`);
}

function deleteTrip(id) {
  const trip = db.trips.find(t => t.id === id);
  if (!trip) return;
  const detail = trip.expenses.length
    ? `\n\n${trip.expenses.length} expense(s) worth ${sgd(tripTotalCents(trip))} will go with it.`
    : '';
  if (!confirm(`Delete “${trip.name}”?${detail}\n\nThis cannot be undone.`)) return;
  db.trips = db.trips.filter(t => t.id !== id);
  if (state && state.id === id) state = null;
  save();
  showTrips();
  toast(`Deleted “${trip.name}”`);
}

/* ============================================================
   Render — one trip
   ============================================================ */
function render() {
  if (!state) return;
  renderPeople();
  renderPickers();
  renderSplitList();
  renderStats();
  renderBalances();
  renderBreakdown();
  renderLog();
  renderYou();
  $('#trip-name').value = state.name;
  const dates = tripDateLabel(state);
  $('#trip-sub').textContent = [state.emoji, dates, `${state.people.length} traveller${state.people.length === 1 ? '' : 's'}`]
    .filter(Boolean).join(' · ');
}

function renderPeople() {
  $('#people-list').innerHTML = state.people.map(p => `
    <li class="person-chip ${p.id === state.meId ? 'is-me' : ''}">
      <span class="av">${p.avatar}</span>
      <span>${esc(p.name)}${p.id === state.meId ? ' (you)' : ''}</span>
      <button class="x" type="button" data-remove="${p.id}" title="Remove ${esc(p.name)}" aria-label="Remove ${esc(p.name)}">✕</button>
    </li>`).join('');
  $('#people-empty').hidden = state.people.length > 0;
}

function renderPickers() {
  const me = $('#me-select');
  me.innerHTML = `<option value="">— pick —</option>` +
    state.people.map(p => `<option value="${p.id}">${p.avatar} ${esc(p.name)}</option>`).join('');
  me.value = state.meId || '';

  const payer = $('#exp-payer');
  const keep = payer.value;
  payer.innerHTML = state.people.length
    ? state.people.map(p => `<option value="${p.id}">${p.avatar} ${esc(p.name)}</option>`).join('')
    : `<option value="">add a traveller first</option>`;
  if (state.people.some(p => p.id === keep)) payer.value = keep;
  else if (state.meId) payer.value = state.meId;

  const fp = $('#filter-person'), fpKeep = fp.value;
  fp.innerHTML = `<option value="">Everyone</option>` +
    state.people.map(p => `<option value="${p.id}">${p.avatar} ${esc(p.name)}</option>`).join('');
  fp.value = state.people.some(p => p.id === fpKeep) ? fpKeep : '';

  const fc = $('#filter-cat'), fcKeep = fc.value;
  fc.innerHTML = `<option value="">All categories</option>` +
    CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
  fc.value = fcKeep;
}

function renderSplitList() {
  if (!state) return;
  const list = $('#split-list');
  if (!state.people.length) {
    list.innerHTML = '';
    $('#split-hint').textContent = '';
    return;
  }

  const amount = Number($('#exp-amount').value) || 0;
  const code = $('#exp-currency').value || BASE;
  const rate = Number($('#exp-rate').value) || rateFor(code);
  const chosen = state.people.filter(p => ui.checked.has(p.id));

  list.innerHTML = state.people.map(p => {
    const on = ui.checked.has(p.id);
    let right = '';
    if (ui.mode === 'equal') {
      const cents = on && chosen.length ? Math.round(centsOf(amount, rate) / chosen.length) : 0;
      right = `<span class="val">${on ? sgd(cents) : '—'}</span>`;
    } else if (ui.mode === 'shares') {
      right = `<input class="num" type="number" min="0" step="1" data-num="${p.id}" value="${ui.nums[p.id] ?? 1}" ${on ? '' : 'disabled'} aria-label="Shares for ${esc(p.name)}">
               <span class="val">share${(ui.nums[p.id] ?? 1) == 1 ? '' : 's'}</span>`;
    } else {
      right = `<input class="num" type="number" min="0" step="0.01" data-num="${p.id}" value="${ui.nums[p.id] ?? ''}" placeholder="0.00" ${on ? '' : 'disabled'} aria-label="Amount for ${esc(p.name)}">
               <span class="val">${esc(code)}</span>`;
    }
    return `<li class="split-row ${on ? '' : 'off'}">
      <input type="checkbox" data-split="${p.id}" ${on ? 'checked' : ''} aria-label="Include ${esc(p.name)}">
      <span class="av">${p.avatar}</span>
      <span class="nm">${esc(p.name)}</span>
      ${right}
    </li>`;
  }).join('');

  const hint = $('#split-hint');
  hint.className = 'split-hint';
  if (!chosen.length) {
    hint.textContent = 'Tick everyone this expense should be shared with.';
  } else if (ui.mode === 'equal') {
    hint.textContent = `Split ${chosen.length} way${chosen.length > 1 ? 's' : ''} · ${sgd(Math.round(centsOf(amount, rate) / chosen.length))} each`;
  } else if (ui.mode === 'shares') {
    const tot = chosen.reduce((a, p) => a + (Number(ui.nums[p.id] ?? 1) || 0), 0);
    hint.textContent = tot > 0
      ? `${tot} shares in total — e.g. 2 shares means that person covers twice as much.`
      : 'Give at least one person a share above 0.';
  } else {
    const tot = chosen.reduce((a, p) => a + (Number(ui.nums[p.id]) || 0), 0);
    const diff = Math.round((amount - tot) * 100) / 100;
    if (Math.abs(diff) < 0.005) hint.textContent = `Adds up to ${foreign(amount, code)} exactly. Nice.`;
    else {
      hint.className = 'split-hint bad';
      hint.textContent = diff > 0
        ? `${foreign(diff, code)} still unassigned (of ${foreign(amount, code)}).`
        : `Over by ${foreign(-diff, code)} — the parts must add up to ${foreign(amount, code)}.`;
    }
  }
}

function renderStats() {
  const totalCents = tripTotalCents(state);
  $('#stat-total').textContent = sgd(totalCents);
  $('#stat-count').textContent = state.expenses.length
    ? `${state.expenses.length} expense${state.expenses.length > 1 ? 's' : ''} logged`
    : 'no expenses yet';

  const n = state.people.length || 1;
  $('#stat-avg').textContent = sgd(Math.round(totalCents / n));
  $('#stat-people').textContent = `${state.people.length} traveller${state.people.length === 1 ? '' : 's'}`;

  const top = catTotals()[0];
  $('#stat-cat').textContent = top ? `${top.icon} ${top.label}` : '—';
  $('#stat-cat-note').innerHTML = top
    ? `${sgd(top.cents)} · ${Math.round(top.cents / totalCents * 100)}% of spend`
    : '&nbsp;';

  const { net } = balances();
  const plan = settlePlan(net);
  const outstanding = Object.values(net).filter(v => v > 0).reduce((a, b) => a + b, 0);
  $('#stat-settle').textContent = sgd(outstanding);
  $('#stat-settle-note').textContent = outstanding > 0
    ? `${plan.length} payment${plan.length > 1 ? 's' : ''} to square up`
    : 'all square 🎉';
}

function catTotals(trip = state) {
  const map = {};
  trip.expenses.forEach(e => {
    const id = CAT[e.category] ? e.category : 'other';
    map[id] = (map[id] || 0) + centsOf(e.amount, e.rate);
  });
  return CATEGORIES
    .filter(c => map[c.id])
    .map(c => ({ ...c, cents: map[c.id], count: trip.expenses.filter(e => (CAT[e.category] ? e.category : 'other') === c.id).length }))
    .sort((a, b) => b.cents - a.cents);
}

function renderBalances() {
  const box = $('#balances');
  const hasData = state.people.length && (state.expenses.length || state.settlements.length);
  $('#balances-empty').hidden = !!hasData;

  if (!hasData) {
    box.innerHTML = '';
    $('#settle-block').hidden = true;
    renderSettlements();
    return;
  }

  const { paid, owed, net } = balances();
  box.innerHTML = state.people.map(p => {
    const n = net[p.id] || 0;
    const cls = n > 0 ? 'owed' : n < 0 ? 'owe' : 'flat';
    const tag = n > 0 ? '↙ gets back' : n < 0 ? '↗ owes' : '✓ settled';
    const amt = n === 0 ? 'All square' : sgd(Math.abs(n));
    return `<div class="bal ${cls}">
      <div class="bal-top">
        <span class="av">${p.avatar}</span>
        <span class="bal-name">${esc(p.name)}${p.id === state.meId ? ' (you)' : ''}</span>
        <span class="bal-tag">${tag}</span>
      </div>
      <div class="bal-amt">${amt}</div>
      <div class="bal-sub">paid ${sgd(paid[p.id])} · fair share ${sgd(owed[p.id])}</div>
    </div>`;
  }).join('');

  const plan = settlePlan(net);
  $('#settle-block').hidden = plan.length === 0;
  $('#settle-list').innerHTML = plan.map(t => `
    <li class="settle-row">
      <span class="settle-who">
        <span>${who(t.fromId)}</span>
        <span class="settle-arrow">pays →</span>
        <span>${who(t.toId)}</span>
      </span>
      <span class="settle-amt">${sgd(t.cents)}</span>
      <button class="btn btn-tiny btn-ghost" type="button"
        data-settle="${t.fromId}|${t.toId}|${t.cents}">Mark paid</button>
    </li>`).join('');

  renderSettlements();
}

function renderSettlements() {
  $('#settled-log').hidden = state.settlements.length === 0;
  $('#settlements-list').innerHTML = state.settlements.map(s => `
    <li>
      <span>${who(s.fromId)} → ${who(s.toId)}</span>
      <span class="amt">${sgd(s.cents)}</span>
      <button class="icon-btn del" type="button" data-unsettle="${s.id}" title="Undo this payment">undo</button>
    </li>`).join('');
}

function renderBreakdown() {
  const cats = catTotals();
  $('#card-breakdown').hidden = cats.length === 0;
  if (!cats.length) return;

  const total = cats.reduce((a, c) => a + c.cents, 0);
  const max = cats[0].cents;
  $('#breakdown-total').textContent = `${sgd(total)} total`;

  $('#breakdown').innerHTML = cats.map(c => {
    const pct = Math.round(c.cents / total * 100);
    return `<div class="bar-row" title="${c.label}: ${sgd(c.cents)} across ${c.count} expense${c.count > 1 ? 's' : ''} (${pct}% of trip spend)">
      <div class="bar-head">
        <span class="nm">${c.icon} ${c.label}</span>
        <span class="pct">${pct}%</span>
        <span class="amt">${sgd(c.cents)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.max(2, c.cents / max * 100)}%;background:${catColor(c.id)}"></div>
      </div>
    </div>`;
  }).join('');
}

function renderLog() {
  const fPerson = $('#filter-person').value;
  const fCat = $('#filter-cat').value;

  let rows = state.expenses.slice();
  if (fPerson) rows = rows.filter(e => e.payerId === fPerson || (e.participants || []).includes(fPerson));
  if (fCat) rows = rows.filter(e => (CAT[e.category] ? e.category : 'other') === fCat);
  rows.sort((a, b) => (b.date === a.date ? (b.created || 0) - (a.created || 0) : (b.date < a.date ? -1 : 1)));

  $('#log-empty').hidden = rows.length > 0;
  $('#log-empty').textContent = state.expenses.length
    ? 'Nothing matches that filter.'
    : 'Nothing logged yet. Add your first holiday spend above! 🍹';

  let html = '', lastDate = null;
  rows.forEach(e => {
    if (e.date !== lastDate) {
      html += `<li class="day-label">${esc(prettyDate(e.date))}</li>`;
      lastDate = e.date;
    }
    const c = CAT[e.category] || CAT.other;
    const cents = centsOf(e.amount, e.rate);
    const parts = splitOf(e);
    const share = state.meId && parts[state.meId] !== undefined ? parts[state.meId] : null;
    const avatars = (e.participants || []).map(id => pav(id)).join('');

    html += `<li class="exp" style="--cat:${catColor(c.id)}">
      <span class="exp-ico">${c.icon}</span>
      <div class="exp-body">
        <div class="exp-title">${esc(e.title)}</div>
        <div class="exp-meta">
          <span class="tag">${c.icon} ${c.label}</span>
          paid by <b>${who(e.payerId)}</b> · split ${(e.participants || []).length} way${(e.participants || []).length === 1 ? '' : 's'}
          <span title="${esc((e.participants || []).map(id => pname(id)).join(', '))}">${avatars}</span>
          ${e.splitMode !== 'equal' ? `· <i>${e.splitMode === 'shares' ? 'by shares' : 'exact amounts'}</i>` : ''}
          ${share !== null ? `· your share <b>${sgd(share)}</b>` : ''}
        </div>
        ${e.note ? `<div class="exp-note">“${esc(e.note)}”</div>` : ''}
      </div>
      <div class="exp-right">
        ${isForeign(e.currency)
          ? `<span class="exp-fx">${CUR[e.currency]?.flag || ''} ${foreign(e.amount, e.currency)}</span>
             <span class="exp-sgd">${sgd(cents)}</span>
             <span class="exp-rate">@ ${e.rate} SGD / ${e.currency}</span>`
          : `<span class="exp-sgd">${sgd(cents)}</span>`}
        <span class="exp-acts">
          <button class="icon-btn" type="button" data-edit="${e.id}">edit</button>
          <button class="icon-btn del" type="button" data-del="${e.id}">delete</button>
        </span>
      </div>
    </li>`;
  });
  $('#log').innerHTML = html;
}

function renderYou() {
  const banner = $('#you-banner');
  if (!state.meId || !personById(state.meId)) { banner.hidden = true; return; }

  const { net } = balances();
  const n = net[state.meId] || 0;
  const mine = settlePlan(net).filter(t => t.fromId === state.meId || t.toId === state.meId);
  const me = personById(state.meId);

  let cls, badge, detail;
  if (n < 0) {
    cls = 'owe'; badge = `You owe ${sgd(-n)}`;
    const to = mine.filter(t => t.fromId === state.meId)
      .map(t => `${sgd(t.cents)} to <b>${who(t.toId)}</b>`).join(', ');
    detail = to ? `Pay ${to}.` : '';
  } else if (n > 0) {
    cls = 'owed'; badge = `You're owed ${sgd(n)}`;
    const from = mine.filter(t => t.toId === state.meId)
      .map(t => `${sgd(t.cents)} from <b>${who(t.fromId)}</b>`).join(', ');
    detail = from ? `Collect ${from}.` : '';
  } else {
    cls = 'flat'; badge = 'You&rsquo;re all square';
    detail = 'Nothing owed either way. Go enjoy a coconut. 🥥';
  }

  banner.className = `you-banner ${cls}`;
  banner.hidden = false;
  banner.innerHTML = `<span>${me.avatar}</span><span class="badge">${badge}</span><span>${detail}</span>`;
}

/* ============================================================
   Controls built once
   ============================================================ */
function buildStaticControls() {
  $('#cat-chips').innerHTML = CATEGORIES.map(c => `
    <button type="button" class="chip" role="radio" data-cat="${c.id}"
      aria-checked="${c.id === ui.cat}" style="color:${catColor(c.id)}">
      <span class="dot"></span><span class="chip-label">${c.icon} ${c.label}</span>
    </button>`).join('');

  $('#exp-currency').innerHTML = CURRENCIES
    .map(c => `<option value="${c.code}">${c.flag} ${c.code} — ${c.name}</option>`).join('');
  $('#exp-currency').value = BASE;
  $('#exp-date').value = todayISO();
  buildTripIconPicker();
}

function syncFxStrip() {
  const code = $('#exp-currency').value;
  const amount = Number($('#exp-amount').value) || 0;
  const strip = $('#fx-strip');
  if (!isForeign(code)) { strip.hidden = true; return; }
  strip.hidden = false;
  $('#fx-code').textContent = code;
  if (document.activeElement !== $('#exp-rate')) $('#exp-rate').value = rateFor(code);
  const rate = Number($('#exp-rate').value) || rateFor(code);
  $('#fx-preview').innerHTML = `${foreign(amount, code)} &nbsp;≈&nbsp; <b>${sgd(centsOf(amount, rate))}</b>`;
}

/* ============================================================
   Expense form
   ============================================================ */
function resetForm() {
  ui.editingId = null;
  ui.mode = 'equal';
  ui.nums = {};
  ui.checked = new Set((state ? state.people : []).map(p => p.id));
  $('#expense-form').reset();
  $('#exp-currency').value = BASE;
  $('#exp-date').value = todayISO();
  $('#expense-form-title').textContent = '🧾 Add an expense';
  $('#expense-submit').textContent = 'Add expense 🎉';
  $('#btn-cancel-edit').hidden = true;
  $('#fx-edit').hidden = true;
  setCat('food');
  setMode('equal');
  syncFxStrip();
  renderSplitList();
}

function setMode(mode, keepNums = false) {
  ui.mode = mode;
  document.querySelectorAll('#split-modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  if (mode === 'shares') {
    (state ? state.people : []).forEach(p => { if (ui.nums[p.id] === undefined || ui.nums[p.id] === '') ui.nums[p.id] = 1; });
  } else if (mode === 'exact' && !keepNums) {
    ui.nums = {};   // share counts are not amounts, so start the amounts blank
  }
  renderSplitList();
}

function setCat(id) {
  ui.cat = id;
  document.querySelectorAll('#cat-chips .chip').forEach(b => b.setAttribute('aria-checked', String(b.dataset.cat === id)));
}

function loadForEdit(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  ui.editingId = id;
  $('#exp-title').value = e.title;
  $('#exp-amount').value = e.amount;
  $('#exp-currency').value = e.currency;
  $('#exp-rate').value = e.rate;
  $('#exp-date').value = e.date;
  $('#exp-payer').value = e.payerId;
  $('#exp-note').value = e.note || '';
  setCat(CAT[e.category] ? e.category : 'other');
  ui.checked = new Set(e.participants || []);
  ui.nums = {};
  if (e.splitMode === 'shares') Object.assign(ui.nums, e.shares || {});
  if (e.splitMode === 'exact') Object.assign(ui.nums, e.exact || {});
  setMode(e.splitMode || 'equal', true);
  $('#expense-form-title').textContent = '✏️ Editing expense';
  $('#expense-submit').textContent = 'Save changes';
  $('#btn-cancel-edit').hidden = false;
  if (isForeign(e.currency)) $('#fx-edit').hidden = false;
  syncFxStrip();
  $('#card-expense').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function submitExpense(ev) {
  ev.preventDefault();
  if (!state) return;
  if (!state.people.length) { toast('Add at least one traveller first 🧳'); return; }

  const title = $('#exp-title').value.trim();
  const amount = Number($('#exp-amount').value);
  const code = $('#exp-currency').value;
  const rate = isForeign(code) ? (Number($('#exp-rate').value) || rateFor(code)) : 1;
  const payerId = $('#exp-payer').value;
  const date = $('#exp-date').value || todayISO();
  const parts = state.people.filter(p => ui.checked.has(p.id)).map(p => p.id);

  if (!title) { toast('Give it a name so you remember what it was.'); return; }
  if (!(amount > 0)) { toast('Enter an amount above zero.'); return; }
  if (!payerId) { toast('Who paid for this?'); return; }
  if (!parts.length) { toast('Pick at least one person to split this with.'); return; }

  const exp = {
    id: ui.editingId || uid(),
    created: ui.editingId ? (state.expenses.find(x => x.id === ui.editingId)?.created || Date.now()) : Date.now(),
    title, amount, currency: code, rate,
    category: ui.cat, date, payerId,
    participants: parts,
    splitMode: ui.mode,
    note: $('#exp-note').value.trim(),
    shares: {}, exact: {},
  };

  if (ui.mode === 'shares') {
    let tot = 0;
    parts.forEach(id => { const v = Math.max(0, Number(ui.nums[id] ?? 1) || 0); exp.shares[id] = v; tot += v; });
    if (tot <= 0) { toast('Shares must add up to more than zero.'); return; }
  }
  if (ui.mode === 'exact') {
    let tot = 0;
    parts.forEach(id => { const v = Math.max(0, Number(ui.nums[id]) || 0); exp.exact[id] = v; tot += v; });
    if (Math.abs(tot - amount) > 0.005) {
      toast(`Exact amounts add up to ${foreign(tot, code)}, but the expense is ${foreign(amount, code)}.`);
      return;
    }
  }

  if (ui.editingId) {
    state.expenses = state.expenses.map(x => x.id === exp.id ? exp : x);
    toast('Expense updated ✏️');
  } else {
    state.expenses.push(exp);
    toast(`Added ${title} · ${sgd(centsOf(amount, rate))} 🎉`);
  }
  save();
  resetForm();
  render();
}

/* ============================================================
   Rates dialog
   ============================================================ */
function renderRatesGrid() {
  $('#rates-grid').innerHTML = CURRENCIES.filter(c => c.code !== BASE).map(c => `
    <label class="rate-item">
      <span class="code">${c.flag} ${c.code}</span>
      <input type="number" step="0.0000001" min="0" data-rate="${c.code}" value="${rateFor(c.code)}"
        aria-label="SGD per 1 ${c.code}">
    </label>`).join('');
}

function openRates() {
  renderRatesGrid();
  $('#rates-dialog').showModal();
}

/* ============================================================
   Summary / import / export / sample
   ============================================================ */
function buildSummary() {
  const { paid, owed, net } = balances();
  const L = [];
  L.push(`${state.emoji} ${state.name} — expense summary`);
  const dates = tripDateLabel(state);
  if (dates) L.push(dates);
  L.push(`Total: ${sgd(tripTotalCents(state))} across ${state.expenses.length} expense(s), ${state.people.length} traveller(s)`);
  L.push('');
  L.push('WHERE IT WENT');
  catTotals().forEach(c => L.push(`  ${c.icon} ${c.label}: ${sgd(c.cents)}`));
  L.push('');
  L.push('WHO PAID WHAT');
  state.people.forEach(p => L.push(`  ${p.avatar} ${p.name}: paid ${sgd(paid[p.id])}, fair share ${sgd(owed[p.id])}`));
  L.push('');
  L.push('BOTTOM LINE');
  state.people.forEach(p => {
    const n = net[p.id] || 0;
    L.push(`  ${p.avatar} ${p.name}: ${n > 0 ? `gets back ${sgd(n)}` : n < 0 ? `owes ${sgd(-n)}` : 'all square'}`);
  });
  const plan = settlePlan(net);
  if (plan.length) {
    L.push('');
    L.push('SETTLE UP LIKE THIS');
    plan.forEach(t => L.push(`  ${pname(t.fromId)} → ${pname(t.toId)}: ${sgd(t.cents)}`));
  }
  if (state.settlements.length) {
    L.push('');
    L.push('ALREADY PAID');
    state.settlements.forEach(s => L.push(`  ${pname(s.fromId)} → ${pname(s.toId)}: ${sgd(s.cents)}`));
  }
  L.push('');
  L.push('(All amounts converted to SGD. Foreign expenses use the rate saved with each entry.)');
  return L.join('\n');
}

function exportJSON() {
  const payload = { kind: 'trippysplit-trip', version: 2, exported: new Date().toISOString(), trip: state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${state.name.replace(/[^\w\- ]+/g, '').trim() || 'trip'}-expenses.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Trip exported ⬇️');
}

function importJSON(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const data = JSON.parse(fr.result);
      const raw = data.trip || data;      // v2 wrapper, a bare trip, or the old single-trip save
      if (!raw || !Array.isArray(raw.people) || !Array.isArray(raw.expenses)) throw new Error('bad shape');
      if (!confirm(`Replace everything in “${state.name}” with the contents of this file?`)) return;
      const incoming = normalizeTrip(raw);
      incoming.id = state.id;             // keep this trip's identity and place in the list
      incoming.created = state.created;
      db.trips = db.trips.map(t => t.id === state.id ? incoming : t);
      state = incoming;
      save(); resetForm(); render();
      toast('Trip imported 🎒');
    } catch (err) {
      toast('That file does not look like a Trippy Split export.');
    }
  };
  fr.readAsText(file);
}

function sampleTrip() {
  const ids = [uid(), uid(), uid(), uid()];
  const names = [account ? account.username : 'You', 'Wei Ming', 'Priya', 'Ben'];
  const trip = blankTrip({ name: 'Tokyo, 5 days', emoji: '🗼' });
  trip.people = names.map((n, i) => ({ id: ids[i], name: String(n).slice(0, 24), avatar: AVATARS[i] }));
  trip.meId = ids[0];

  const d = back => {
    const dt = new Date(); dt.setDate(dt.getDate() - back);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  trip.from = d(6); trip.to = d(1);

  const mk = o => Object.assign({
    id: uid(), created: Date.now() + Math.random(), splitMode: 'equal',
    participants: ids.slice(), shares: {}, exact: {}, note: '',
  }, o, { rate: o.rate ?? DEFAULT_RATES[o.currency] });

  trip.expenses = [
    mk({ title: 'Shinjuku hotel, 4 nights', amount: 168000, currency: 'JPY', category: 'hotel', date: d(5), payerId: ids[1] }),
    mk({ title: 'Airport train (Narita Express)', amount: 12480, currency: 'JPY', category: 'transport', date: d(5), payerId: ids[0] }),
    mk({ title: 'Ramen at Ichiran', amount: 6400, currency: 'JPY', category: 'food', date: d(4), payerId: ids[2] }),
    mk({ title: 'teamLab Planets tickets', amount: 15200, currency: 'JPY', category: 'entrance', date: d(4), payerId: ids[0] }),
    mk({ title: 'Suica top-ups', amount: 8000, currency: 'JPY', category: 'transport', date: d(3), payerId: ids[3] }),
    mk({ title: 'Yakiniku dinner', amount: 22600, currency: 'JPY', category: 'food', date: d(3), payerId: ids[1],
         splitMode: 'shares', shares: { [ids[0]]: 1, [ids[1]]: 2, [ids[2]]: 1, [ids[3]]: 2 },
         note: 'Wei Ming and Ben had the wagyu set' }),
    mk({ title: 'Mt Fuji day tour', amount: 34000, currency: 'JPY', category: 'entrance', date: d(2), payerId: ids[2],
         participants: [ids[0], ids[2], ids[3]], note: 'Wei Ming stayed in — spa day' }),
    mk({ title: 'Don Quijote snacks run', amount: 9800, currency: 'JPY', category: 'shopping', date: d(1), payerId: ids[0] }),
    mk({ title: 'Pocket wifi rental', amount: 42.50, currency: 'SGD', category: 'other', date: d(6), payerId: ids[3] }),
    mk({ title: 'Convenience store breakfast', amount: 2860, currency: 'JPY', category: 'food', date: d(1), payerId: ids[2] }),
  ];
  return trip;
}

function addSampleTrip() {
  const trip = sampleTrip();
  db.trips.unshift(trip);
  save();
  renderTrips();
  toast('Sample trip added 🎒 Open it and poke around!');
  return trip;
}

/* ============================================================
   Wiring — auth screen
   ============================================================ */
function wireAuth() {
  document.querySelectorAll('[data-auth-tab]').forEach(b =>
    b.addEventListener('click', () => setAuthMode(b.dataset.authTab)));

  $('#auth-form').addEventListener('submit', submitAuth);
  $('#auth-demo').addEventListener('click', demoSignIn);
  $('#auth-user').addEventListener('input', hideAuthError);
  $('#auth-pass').addEventListener('input', hideAuthError);

  $('#auth-eye').addEventListener('click', () => {
    const shown = $('#auth-pass').type === 'text';
    ['#auth-pass', '#auth-confirm'].forEach(s => { $(s).type = shown ? 'password' : 'text'; });
    $('#auth-eye').setAttribute('aria-pressed', String(!shown));
    $('#auth-eye').setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
  });

  $('#btn-signout').addEventListener('click', signOut);
}

/* ============================================================
   Wiring — trips dashboard
   ============================================================ */
function wireTrips() {
  $('#btn-new-trip').addEventListener('click', () => openNewTripForm($('#new-trip-form').hidden));
  $('#btn-cancel-trip').addEventListener('click', () => openNewTripForm(false));
  $('#new-trip-form').addEventListener('submit', createTrip);
  $('#btn-sample-trip').addEventListener('click', addSampleTrip);

  $('#trip-grid').addEventListener('click', e => {
    const del = e.target.closest('[data-del-trip]');
    if (del) { deleteTrip(del.dataset.delTrip); return; }
    const open = e.target.closest('[data-open]');
    if (open) openTrip(open.dataset.open);
  });
  $('#trip-grid').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const body = e.target.closest('.trip-body[data-open]');
    if (!body) return;
    e.preventDefault();
    openTrip(body.dataset.open);
  });

  $('#btn-back').addEventListener('click', () => { save(); showTrips(); });
}

/* ============================================================
   Wiring — one trip
   ============================================================ */
function wireTrip() {
  $('#trip-name').addEventListener('input', e => {
    if (!state) return;
    state.name = e.target.value.trim() || 'Our Holiday';
    save();
  });

  $('#person-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!state) return;
    const input = $('#person-name');
    const name = input.value.trim();
    if (!name) return;
    if (state.people.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast('Someone already has that name.'); return; }
    const used = new Set(state.people.map(p => p.avatar));
    const avatar = AVATARS.find(a => !used.has(a)) || AVATARS[state.people.length % AVATARS.length];
    const p = { id: uid(), name, avatar };
    state.people.push(p);
    ui.checked.add(p.id);
    if (ui.mode === 'shares') ui.nums[p.id] = 1;
    if (!state.meId && state.people.length === 1) state.meId = p.id;
    input.value = '';
    save(); render();
  });

  $('#people-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-remove]');
    if (!btn || !state) return;
    const id = btn.dataset.remove;
    const used = state.expenses.some(x => x.payerId === id || (x.participants || []).includes(id))
      || state.settlements.some(s => s.fromId === id || s.toId === id);
    if (used && !confirm(`${pname(id)} appears in existing expenses.\n\nRemove them anyway? Expenses they only shared in get re-split between whoever is left, and expenses they paid for will be deleted.`)) return;
    state.people = state.people.filter(p => p.id !== id);
    state.expenses.forEach(x => { x.participants = (x.participants || []).filter(pid => pid !== id); });
    state.expenses = state.expenses.filter(x => personById(x.payerId) && x.participants.length);
    state.settlements = state.settlements.filter(s => personById(s.fromId) && personById(s.toId));
    if (state.meId === id) state.meId = null;
    ui.checked.delete(id);
    save(); render();
  });

  $('#me-select').addEventListener('change', e => {
    if (!state) return;
    state.meId = e.target.value || null;
    save(); render();
  });

  $('#cat-chips').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (b) setCat(b.dataset.cat);
  });

  $('#exp-amount').addEventListener('input', () => { syncFxStrip(); renderSplitList(); });
  $('#exp-currency').addEventListener('change', () => { $('#exp-rate').value = rateFor($('#exp-currency').value); syncFxStrip(); renderSplitList(); });
  $('#exp-rate').addEventListener('input', () => { syncFxStrip(); renderSplitList(); });
  $('#fx-toggle').addEventListener('click', () => {
    const box = $('#fx-edit');
    box.hidden = !box.hidden;
    if (!box.hidden) $('#exp-rate').focus();
  });

  $('#split-modes').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (b) setMode(b.dataset.mode);
  });
  $('#split-all').addEventListener('click', () => { if (state) { ui.checked = new Set(state.people.map(p => p.id)); renderSplitList(); } });
  $('#split-none').addEventListener('click', () => { ui.checked = new Set(); renderSplitList(); });

  $('#split-list').addEventListener('change', e => {
    const cb = e.target.closest('[data-split]');
    if (!cb) return;
    if (cb.checked) { ui.checked.add(cb.dataset.split); if (ui.mode === 'shares' && !ui.nums[cb.dataset.split]) ui.nums[cb.dataset.split] = 1; }
    else ui.checked.delete(cb.dataset.split);
    renderSplitList();
  });
  $('#split-list').addEventListener('input', e => {
    const num = e.target.closest('[data-num]');
    if (!num) return;
    ui.nums[num.dataset.num] = num.value;
    const keep = num.dataset.num, pos = num.selectionStart;
    renderSplitList();
    const again = document.querySelector(`[data-num="${keep}"]`);
    if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (_) {} }
  });

  $('#expense-form').addEventListener('submit', submitExpense);
  $('#btn-cancel-edit').addEventListener('click', () => { resetForm(); render(); });

  $('#log').addEventListener('click', e => {
    if (!state) return;
    const ed = e.target.closest('[data-edit]');
    if (ed) { loadForEdit(ed.dataset.edit); return; }
    const del = e.target.closest('[data-del]');
    if (!del) return;
    const exp = state.expenses.find(x => x.id === del.dataset.del);
    if (!exp || !confirm(`Delete “${exp.title}”?`)) return;
    state.expenses = state.expenses.filter(x => x.id !== del.dataset.del);
    if (ui.editingId === del.dataset.del) resetForm();
    save(); render(); toast('Expense deleted');
  });
  $('#filter-person').addEventListener('change', renderLog);
  $('#filter-cat').addEventListener('change', renderLog);

  $('#settle-list').addEventListener('click', e => {
    const b = e.target.closest('[data-settle]');
    if (!b || !state) return;
    const [fromId, toId, cents] = b.dataset.settle.split('|');
    state.settlements.push({ id: uid(), fromId, toId, cents: Number(cents), date: todayISO() });
    save(); render();
    toast(`Recorded: ${pname(fromId)} paid ${pname(toId)} ${sgd(Number(cents))} ✅`);
  });
  $('#settlements-list').addEventListener('click', e => {
    const b = e.target.closest('[data-unsettle]');
    if (!b || !state) return;
    state.settlements = state.settlements.filter(s => s.id !== b.dataset.unsettle);
    save(); render(); toast('Payment undone');
  });

  $('#btn-rates').addEventListener('click', openRates);
  $('#rates-grid').addEventListener('input', e => {
    const inp = e.target.closest('[data-rate]');
    if (!inp || !state) return;
    const v = Number(inp.value);
    if (v > 0) { state.rates[inp.dataset.rate] = v; save(); syncFxStrip(); }
  });
  $('#rates-reset').addEventListener('click', () => {
    if (!state) return;
    state.rates = { ...DEFAULT_RATES };
    save(); renderRatesGrid(); syncFxStrip();
    toast('Rates reset to defaults');
  });

  const pop = $('#menu-pop');
  $('#btn-menu').addEventListener('click', () => {
    pop.hidden = !pop.hidden;
    $('#btn-menu').setAttribute('aria-expanded', String(!pop.hidden));
  });
  document.addEventListener('click', e => {
    if (!pop.hidden && !e.target.closest('.menu')) { pop.hidden = true; $('#btn-menu').setAttribute('aria-expanded', 'false'); }
  });

  pop.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act || !state) return;
    pop.hidden = true;
    if (act === 'summary') { $('#summary-text').value = buildSummary(); $('#summary-dialog').showModal(); }
    if (act === 'export') exportJSON();
    if (act === 'import') $('#import-file').click();
    if (act === 'clear') {
      if (!state.expenses.length && !state.settlements.length) { toast('Nothing to clear.'); return; }
      if (!confirm(`Clear all ${state.expenses.length} expense(s) from “${state.name}”? The travellers stay.`)) return;
      state.expenses = []; state.settlements = [];
      save(); resetForm(); render(); toast('Expenses cleared 🧽');
    }
    if (act === 'delete') deleteTrip(state.id);
  });

  $('#import-file').addEventListener('change', e => {
    if (e.target.files[0]) importJSON(e.target.files[0]);
    e.target.value = '';
  });

  $('#summary-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#summary-text').value);
      toast('Summary copied 📋');
    } catch (_) {
      $('#summary-text').select();
      toast('Press Ctrl/Cmd+C to copy');
    }
  });
}

/* ============================================================
   Boot
   ============================================================ */
function boot() {
  buildStaticControls();
  wireAuth();
  wireTrips();
  wireTrip();

  if (!Auth.ready()) { setView('blocked'); return; }

  const session = Auth.current();
  if (session) enterApp(session);
  else showAuth();
}

if (typeof document !== 'undefined') boot();

/* Exposed for the node test harness (no effect in the browser). */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    centsOf, sgd, foreign, splitOf, balancesFor, settlePlan, catTotals,
    blankTrip, normalizeTrip, tripTotalCents,
    DEFAULT_RATES, CATEGORIES, CURRENCIES, TRIP_ICONS,
    setState: t => { state = t; },
    getState: () => state,
  };
}
