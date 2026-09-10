/* The view layer: what a render puts on screen, and what the form and
   list handlers do with what the user typed.

   app.js talks to the document directly, so this file stands a recording
   DOM up first (see helpers/dom.js) and then reads back the markup and
   values each function produced. */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { installStorage } = require('./helpers/browser-env.js');
const { installDom, installSiblingScripts, calls } = require('./helpers/dom.js');

installStorage();
let doc = installDom();
installSiblingScripts();

const app = require('../app.js');                 // boot() runs on load
const { people } = require('./helpers/trips.js');

const $ = sel => doc.querySelector(sel);
const html = sel => $(sel).innerHTML;
const text = sel => $(sel).textContent;

/* Put the app in "signed in, one trip open" and hand the trip back. */
function openTripWith(fields = {}) {
  const ppl = people('Ann', 'Bo', 'Cy');
  const trip = app.blankTrip(Object.assign({ name: 'Tokyo', emoji: '🗼', people: ppl, meId: 'p1' }, fields));
  app.setAccount({ userId: 'u1', username: 'ann' });
  app.setDb({ trips: [trip] });
  app.setState(trip);
  app.openTrip(trip.id);
  return trip;
}

const expense = f => Object.assign({
  id: 'e1', created: 1, title: 'Dinner', amount: 30, currency: 'SGD', rate: 1,
  category: 'food', date: '2026-03-01', payerId: 'p1',
  participants: ['p1', 'p2', 'p3'], splitMode: 'equal', note: '', shares: {}, exact: {},
}, f);

beforeEach(() => {
  installStorage();
  doc = installDom();
  app.setAccount(null);
  app.setDb({ trips: [] });
  app.setState(null);
});

describe('setView', () => {
  test('shows one view and hides the rest', () => {
    app.setView('trips');
    assert.equal($('#view-trips').hidden, false);
    assert.equal($('#view-auth').hidden, true);
    assert.equal($('#view-trip').hidden, true);
    assert.equal($('#view-blocked').hidden, true);
  });

  test('swaps the header actions to match the view', () => {
    app.setView('trip');
    assert.equal($('#actions-trip').hidden, false);
    assert.equal($('#actions-trips').hidden, true);
    assert.equal($('#brand-trip').hidden, false);
    assert.equal($('#brand-static').hidden, true);
  });

  test('hides the footer on the sign-in and blocked screens', () => {
    app.setView('auth');
    assert.equal($('.foot').hidden, true);
    app.setView('trips');
    assert.equal($('.foot').hidden, false);
  });

  test('always closes the overflow menu', () => {
    $('#menu-pop').hidden = false;
    app.setView('trips');
    assert.equal($('#menu-pop').hidden, true);
  });
});

describe('toast', () => {
  test('shows the message', () => {
    app.toast('Saved 🎉');
    assert.equal(text('#toast'), 'Saved 🎉');
    assert.equal($('#toast').hidden, false);
  });

  test('a later message replaces the earlier one', () => {
    app.toast('first');
    app.toast('second');
    assert.equal(text('#toast'), 'second');
  });
});

describe('the sign-in screen', () => {
  test('offers to create an account when the browser has none', () => {
    app.showAuth();
    assert.equal($('#view-auth').hidden, false);
    assert.equal($('#auth-remember').checked, true);
    assert.equal($('#auth-form').wasReset, true);
  });

  test('shows an error and hides it again', () => {
    app.showAuthError('Wrong username or password.');
    assert.equal(text('#auth-error'), 'Wrong username or password.');
    assert.equal($('#auth-error').hidden, false);
    app.hideAuthError();
    assert.equal($('#auth-error').hidden, true);
  });

  test('switching mode retitles the submit button', () => {
    app.setAuthMode('up');
    assert.match(text('#auth-submit'), /account/i);
    app.setAuthMode('in');
    assert.match(text('#auth-submit'), /sign in/i);
  });

  test('busy disables the button and puts it back', () => {
    $('#auth-submit').textContent = 'Sign in';
    app.busy(true, 'Checking…');
    assert.equal($('#auth-submit').disabled, true);
    assert.equal(text('#auth-submit'), 'Checking…');
    app.busy(false);
    assert.equal($('#auth-submit').disabled, false);
    assert.equal(text('#auth-submit'), 'Sign in');
  });

  test('signing up creates the account, signs in and lands on the trips view', async () => {
    app.setAuthMode('up');
    $('#auth-user').value = 'ann';
    $('#auth-pass').value = 'holiday123';
    $('#auth-confirm').value = 'holiday123';
    await app.submitAuth({ preventDefault() {} });
    assert.equal($('#auth-error').hidden, true, text('#auth-error'));
    assert.equal($('#view-trips').hidden, false);
    assert.match(html('#whoami'), /ann/);
    assert.match(text('#toast'), /Account created/);
  });

  test('a rejected sign-up leaves the error showing and nobody signed in', async () => {
    app.setAuthMode('up');
    $('#auth-user').value = 'ab';
    $('#auth-pass').value = 'holiday123';
    $('#auth-confirm').value = 'holiday123';
    await app.submitAuth({ preventDefault() {} });
    assert.match(text('#auth-error'), /at least 3/);
    assert.equal($('#auth-error').hidden, false);
    assert.equal(app.getAccount(), null);
  });

  test('a wrong password is reported and does not sign anyone in', async () => {
    app.setAuthMode('up');
    $('#auth-user').value = 'ann';
    $('#auth-pass').value = 'holiday123';
    $('#auth-confirm').value = 'holiday123';
    await app.submitAuth({ preventDefault() {} });

    app.showAuth();
    app.setAuthMode('in');
    $('#auth-user').value = 'ann';
    $('#auth-pass').value = 'wrongpass1';
    await app.submitAuth({ preventDefault() {} });
    assert.match(text('#auth-error'), /Wrong username or password/);
    assert.equal(app.getAccount(), null);
  });

  test('signing back in greets you by name', async () => {
    app.setAuthMode('up');
    $('#auth-user').value = 'ann';
    $('#auth-pass').value = 'holiday123';
    $('#auth-confirm').value = 'holiday123';
    await app.submitAuth({ preventDefault() {} });

    app.signOut();
    app.setAuthMode('in');
    $('#auth-user').value = 'ann';
    $('#auth-pass').value = 'holiday123';
    await app.submitAuth({ preventDefault() {} });
    assert.match(text('#toast'), /Welcome back, ann/);
  });

  test('the first account adopts a trip left by the pre-accounts version', async () => {
    localStorage.setItem('trippysplit.v1', JSON.stringify({
      tripName: 'Old Trip',
      people: [{ id: 'p1', name: 'Ann' }],
      expenses: [{ id: 'e1', payerId: 'p1', participants: ['p1'], amount: 10, currency: 'SGD', rate: 1 }],
    }));
    app.setAuthMode('up');
    $('#auth-user').value = 'ann';
    $('#auth-pass').value = 'holiday123';
    $('#auth-confirm').value = 'holiday123';
    await app.submitAuth({ preventDefault() {} });
    assert.deepEqual(app.getDb().trips.map(t => t.name), ['Old Trip']);
    assert.match(text('#toast'), /came across/);
    assert.equal(localStorage.getItem('trippysplit.v1'), null, 'the legacy save is cleared once adopted');
  });

  test('the demo account signs in with a trip to poke at', async () => {
    await app.demoSignIn();
    assert.equal(app.getAccount().username, 'demo');
    assert.equal(app.getDb().trips.length, 1);
    assert.match(text('#toast'), /demo1234/);
  });

  test('signing out clears the account and goes back to sign in', async () => {
    await app.demoSignIn();
    app.signOut();
    assert.equal(app.getAccount(), null);
    assert.equal($('#view-auth').hidden, false);
    assert.match(text('#toast'), /Signed out/);
  });
});

describe('the trips dashboard', () => {
  test('says so when there are no trips yet', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    app.setDb({ trips: [] });
    app.showTrips();
    assert.equal($('#trips-empty').hidden, false);
    assert.equal(html('#trip-grid'), '');
  });

  test('shows a card per trip with its counts and total', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    const trip = app.blankTrip({ name: 'Tokyo', emoji: '🗼', people: people('Ann', 'Bo') });
    trip.expenses = [expense({ amount: 100, participants: ['p1', 'p2'] })];
    app.setDb({ trips: [trip] });
    app.showTrips();
    assert.equal($('#trips-empty').hidden, true);
    assert.match(html('#trip-grid'), /Tokyo/);
    assert.match(html('#trip-grid'), /S\$100\.00/);
    assert.match(html('#trip-grid'), /2 travellers/);
    assert.match(html('#trip-grid'), /1 expense/);
  });

  test('escapes a trip name that looks like markup', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    app.setDb({ trips: [app.blankTrip({ name: '<img src=x>' })] });
    app.showTrips();
    assert.ok(!html('#trip-grid').includes('<img src=x>'));
    assert.match(html('#trip-grid'), /&lt;img/);
  });

  test('tells you where you stand on each trip', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    const trip = app.blankTrip({ name: 'Tokyo', people: people('Ann', 'Bo'), meId: 'p1' });
    trip.expenses = [expense({ amount: 100, payerId: 'p2', participants: ['p1', 'p2'] })];
    app.setDb({ trips: [trip] });
    app.showTrips();
    assert.match(html('#trip-grid'), /You owe S\$50\.00/);
  });

  test('opening a trip that is gone bounces you back to the list', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    app.setDb({ trips: [] });
    app.openTrip('nope');
    assert.match(text('#toast'), /gone/);
    assert.equal($('#view-trips').hidden, false);
  });
});

describe('creating a trip', () => {
  beforeEach(() => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    app.setDb({ trips: [] });
  });

  const fillForm = ({ name = 'Bali', from = '', to = '', ppl = '' }) => {
    $('#trip-new-name').value = name;
    $('#trip-new-from').value = from;
    $('#trip-new-to').value = to;
    $('#trip-new-people').value = ppl;
    $('#trip-new-emoji').value = '🏝️';
  };

  test('creates the trip and opens it', () => {
    fillForm({ name: 'Bali', ppl: 'Ann, Bo, Cy' });
    app.createTrip({ preventDefault() {} });
    assert.equal(app.getDb().trips.length, 1);
    const trip = app.getDb().trips[0];
    assert.equal(trip.name, 'Bali');
    assert.equal(trip.emoji, '🏝️');
    assert.deepEqual(trip.people.map(p => p.name), ['Ann', 'Bo', 'Cy']);
    assert.equal(trip.meId, trip.people[0].id, 'the first traveller listed is you');
    assert.equal($('#view-trip').hidden, false);
  });

  test('needs a name', () => {
    fillForm({ name: '   ' });
    app.createTrip({ preventDefault() {} });
    assert.match(text('#new-trip-error'), /Give the trip a name/);
    assert.equal(app.getDb().trips.length, 0);
  });

  test('refuses an end date before the start date', () => {
    fillForm({ name: 'Bali', from: '2026-06-10', to: '2026-06-01' });
    app.createTrip({ preventDefault() {} });
    assert.match(text('#new-trip-error'), /end date is before/);
    assert.equal(app.getDb().trips.length, 0);
  });

  test('accepts dates in the right order, and one on its own', () => {
    fillForm({ name: 'Bali', from: '2026-06-01', to: '2026-06-10' });
    app.createTrip({ preventDefault() {} });
    fillForm({ name: 'Phuket', from: '2026-07-01' });
    app.createTrip({ preventDefault() {} });
    assert.equal(app.getDb().trips.length, 2);
  });

  test('skips blanks and repeats in the traveller list', () => {
    fillForm({ name: 'Bali', ppl: 'Ann, , Bo,,ANN ,Cy' });
    app.createTrip({ preventDefault() {} });
    assert.deepEqual(app.getDb().trips[0].people.map(p => p.name), ['Ann', 'Bo', 'Cy']);
  });

  test('stops at sixteen travellers and caps each name', () => {
    fillForm({ name: 'Bali', ppl: Array.from({ length: 25 }, (_, i) => 'Traveller number ' + i).join(', ') });
    app.createTrip({ preventDefault() {} });
    const ppl = app.getDb().trips[0].people;
    assert.equal(ppl.length, 16);
    assert.ok(ppl.every(p => p.name.length <= 24));
  });

  test('a trip with nobody on it has no "me"', () => {
    fillForm({ name: 'Solo' });
    app.createTrip({ preventDefault() {} });
    assert.equal(app.getDb().trips[0].meId, null);
  });

  test('newest trip goes to the front of the list', () => {
    fillForm({ name: 'First' });
    app.createTrip({ preventDefault() {} });
    fillForm({ name: 'Second' });
    app.createTrip({ preventDefault() {} });
    assert.deepEqual(app.getDb().trips.map(t => t.name), ['Second', 'First']);
  });

  test('the new-trip form opens cleared and closes again', () => {
    app.openNewTripForm(true);
    assert.equal($('#new-trip-form').hidden, false);
    assert.equal($('#new-trip-form').wasReset, true);
    app.openNewTripForm(false);
    assert.equal($('#new-trip-form').hidden, true);
  });
});

describe('deleting a trip', () => {
  test('removes it once confirmed', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    const trip = app.blankTrip({ name: 'Tokyo' });
    app.setDb({ trips: [trip] });
    app.deleteTrip(trip.id);
    assert.deepEqual(app.getDb().trips, []);
    assert.match(text('#toast'), /Deleted/);
  });

  test('warns how much goes with it', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    const trip = app.blankTrip({ name: 'Tokyo', people: people('Ann') });
    trip.expenses = [expense({ amount: 250, participants: ['p1'] })];
    app.setDb({ trips: [trip] });
    app.deleteTrip(trip.id);
    assert.match(calls.confirms.join('\n'), /1 expense\(s\) worth S\$250\.00/);
  });

  test('keeps it when the confirmation is declined', () => {
    doc = installDom({ confirmWith: () => false });
    app.setAccount({ userId: 'u1', username: 'ann' });
    const trip = app.blankTrip({ name: 'Tokyo' });
    app.setDb({ trips: [trip] });
    app.deleteTrip(trip.id);
    assert.equal(app.getDb().trips.length, 1);
  });

  test('deleting a trip that is already gone does nothing', () => {
    app.setDb({ trips: [] });
    assert.doesNotThrow(() => app.deleteTrip('nope'));
  });
});

describe('rendering one trip', () => {
  test('the header shows the name, dates and headcount', () => {
    openTripWith({ from: '2026-06-01', to: '2026-06-05' });
    assert.equal($('#trip-name').value, 'Tokyo');
    assert.match(text('#trip-sub'), /3 travellers/);
    assert.match(text('#trip-sub'), /2026/);
  });

  test('the traveller list marks who you are', () => {
    openTripWith();
    assert.match(html('#people-list'), /Ann \(you\)/);
    assert.match(html('#people-list'), /data-remove="p2"/);
    assert.equal($('#people-empty').hidden, true);
  });

  test('an empty trip says there are no travellers yet', () => {
    const trip = app.blankTrip({ name: 'Empty' });
    app.setAccount({ userId: 'u1', username: 'ann' });
    app.setDb({ trips: [trip] });
    app.openTrip(trip.id);
    assert.equal($('#people-empty').hidden, false);
    assert.equal(html('#split-list'), '');
  });

  test('the pickers list everyone, and default to you', () => {
    openTripWith();
    assert.match(html('#me-select'), /value="p1"/);
    assert.equal($('#me-select').value, 'p1');
    assert.equal($('#exp-payer').value, 'p1');
    assert.match(html('#filter-person'), /Everyone/);
    assert.match(html('#filter-cat'), /All categories/);
  });

  test('the stats row totals the trip', () => {
    const trip = openTripWith();
    trip.expenses = [
      expense({ id: 'e1', amount: 90, category: 'food' }),
      expense({ id: 'e2', amount: 30, category: 'hotel' }),
    ];
    app.render();
    assert.equal(text('#stat-total'), 'S$120.00');
    assert.equal(text('#stat-count'), '2 expenses logged');
    assert.equal(text('#stat-avg'), 'S$40.00');
    assert.equal(text('#stat-people'), '3 travellers');
    assert.match(text('#stat-cat'), /Food/);
    assert.match(html('#stat-cat-note'), /75% of spend/);
  });

  test('the stats row copes with an empty trip', () => {
    openTripWith();
    assert.equal(text('#stat-total'), 'S$0.00');
    assert.equal(text('#stat-count'), 'no expenses yet');
    assert.equal(text('#stat-cat'), '—');
    assert.equal(text('#stat-settle-note'), 'all square 🎉');
  });

  test('the balances card shows what each person paid and owes', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ amount: 30, payerId: 'p1' })];
    app.render();
    assert.equal($('#balances-empty').hidden, true);
    assert.match(html('#balances'), /gets back/);
    assert.match(html('#balances'), /owes/);
    assert.match(html('#balances'), /paid S\$30\.00 · fair share S\$10\.00/);
    assert.equal($('#settle-block').hidden, false);
    assert.match(html('#settle-list'), /data-settle="p2\|p1\|1000"/);
  });

  test('the balances card is empty until there is something to balance', () => {
    openTripWith();
    assert.equal($('#balances-empty').hidden, false);
    assert.equal(html('#balances'), '');
    assert.equal($('#settle-block').hidden, true);
  });

  test('no transfers are offered once everyone is square', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ amount: 30, payerId: 'p1' })];
    trip.settlements = [
      { id: 's1', fromId: 'p2', toId: 'p1', cents: 1000, date: '2026-03-02' },
      { id: 's2', fromId: 'p3', toId: 'p1', cents: 1000, date: '2026-03-02' },
    ];
    app.render();
    assert.equal($('#settle-block').hidden, true);
    assert.match(html('#balances'), /All square/);
  });

  test('recorded payments are listed with a way to undo them', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ amount: 30, payerId: 'p1' })];
    trip.settlements = [{ id: 's1', fromId: 'p2', toId: 'p1', cents: 1000, date: '2026-03-02' }];
    app.render();
    assert.equal($('#settled-log').hidden, false);
    assert.match(html('#settlements-list'), /data-unsettle="s1"/);
    assert.match(html('#settlements-list'), /S\$10\.00/);
  });

  test('the breakdown direct-labels each category with its share of spend', () => {
    const trip = openTripWith();
    trip.expenses = [
      expense({ id: 'e1', amount: 75, category: 'hotel' }),
      expense({ id: 'e2', amount: 25, category: 'food' }),
    ];
    app.render();
    assert.equal($('#card-breakdown').hidden, false);
    assert.equal(text('#breakdown-total'), 'S$100.00 total');
    assert.match(html('#breakdown'), /🏨 Hotel/);
    assert.match(html('#breakdown'), />75%</);
    assert.match(html('#breakdown'), />25%</);
  });

  test('the breakdown is hidden when nothing has been spent', () => {
    openTripWith();
    assert.equal($('#card-breakdown').hidden, true);
  });

  test('the log lists expenses newest first, grouped by day', () => {
    const trip = openTripWith();
    trip.expenses = [
      expense({ id: 'e1', title: 'Older', date: '2026-03-01' }),
      expense({ id: 'e2', title: 'Newer', date: '2026-03-05' }),
    ];
    app.render();
    assert.ok(html('#log').indexOf('Newer') < html('#log').indexOf('Older'));
    assert.match(html('#log'), /day-label/);
    assert.equal($('#log-empty').hidden, true);
  });

  test('the log shows a foreign expense both ways, with its rate', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ amount: 168000, currency: 'JPY', rate: 0.0088 })];
    app.render();
    assert.match(html('#log'), /¥168,000/);
    assert.match(html('#log'), /S\$1,478\.40/);
    assert.match(html('#log'), /@ 0\.0088 SGD \/ JPY/);
  });

  test('the log names your own share', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ amount: 30 })];
    app.render();
    assert.match(html('#log'), /your share <b>S\$10\.00<\/b>/);
  });

  test('the log flags a non-equal split and shows the note', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ splitMode: 'shares', shares: { p1: 2, p2: 1, p3: 1 }, note: 'Ann had the wagyu' })];
    app.render();
    assert.match(html('#log'), /by shares/);
    assert.match(html('#log'), /Ann had the wagyu/);
  });

  test('the log escapes a title that looks like markup', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ title: '<script>alert(1)</script>' })];
    app.render();
    assert.ok(!html('#log').includes('<script>'));
  });

  test('the log filters by person and by category', () => {
    const trip = openTripWith();
    trip.expenses = [
      expense({ id: 'e1', title: 'Ann only', payerId: 'p1', participants: ['p1'], category: 'food' }),
      expense({ id: 'e2', title: 'Bo hotel', payerId: 'p2', participants: ['p2'], category: 'hotel' }),
    ];
    app.render();

    $('#filter-person').value = 'p2';
    app.renderLog();
    assert.match(html('#log'), /Bo hotel/);
    assert.ok(!html('#log').includes('Ann only'));

    $('#filter-person').value = '';
    $('#filter-cat').value = 'food';
    app.renderLog();
    assert.match(html('#log'), /Ann only/);
    assert.ok(!html('#log').includes('Bo hotel'));

    $('#filter-cat').value = 'entrance';
    app.renderLog();
    assert.equal($('#log-empty').hidden, false);
    assert.equal(text('#log-empty'), 'Nothing matches that filter.');
  });

  test('an empty log invites a first expense', () => {
    openTripWith();
    assert.equal($('#log-empty').hidden, false);
    assert.match(text('#log-empty'), /Nothing logged yet/);
  });

  test('the banner tells you what you owe and to whom', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ amount: 30, payerId: 'p2' })];
    app.render();
    assert.equal($('#you-banner').hidden, false);
    assert.match(html('#you-banner'), /You owe S\$10\.00/);
    assert.match(html('#you-banner'), /Pay S\$10\.00 to/);
  });

  test('the banner tells you what you are owed', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ amount: 30, payerId: 'p1' })];
    app.render();
    assert.match(html('#you-banner'), /You&#39;re owed S\$20\.00|You're owed S\$20\.00/);
    assert.match(html('#you-banner'), /Collect/);
  });

  test('the banner says all square when it is', () => {
    openTripWith();
    assert.match(html('#you-banner'), /all square/);
    assert.match(html('#you-banner'), /coconut/);
  });

  test('the banner stays hidden until you say who you are', () => {
    openTripWith({ meId: null });
    assert.equal($('#you-banner').hidden, true);
  });
});

describe('the expense form', () => {
  const fill = ({ title = 'Dinner', amount = '30', currency = 'SGD', rate = '', payer = 'p1', date = '2026-03-01', note = '' }) => {
    $('#exp-title').value = title;
    $('#exp-amount').value = amount;
    $('#exp-currency').value = currency;
    $('#exp-rate').value = rate;
    $('#exp-payer').value = payer;
    $('#exp-date').value = date;
    $('#exp-note').value = note;
  };
  const submit = () => app.submitExpense({ preventDefault() {} });

  test('a fresh form ticks everyone and starts on an equal split', () => {
    openTripWith();
    app.resetForm();
    assert.equal(app.getUi().mode, 'equal');
    assert.equal(app.getUi().editingId, null);
    assert.deepEqual([...app.getUi().checked].sort(), ['p1', 'p2', 'p3']);
    assert.equal($('#exp-currency').value, 'SGD');
    assert.equal($('#btn-cancel-edit').hidden, true);
  });

  test('adds an expense', () => {
    const trip = openTripWith();
    app.resetForm();
    fill({ title: 'Ramen', amount: '25.50' });
    submit();
    assert.equal(trip.expenses.length, 1);
    const e = trip.expenses[0];
    assert.equal(e.title, 'Ramen');
    assert.equal(e.amount, 25.5);
    assert.equal(e.rate, 1);
    assert.deepEqual(e.participants, ['p1', 'p2', 'p3']);
    assert.match(text('#toast'), /Added Ramen · S\$25\.50/);
  });

  test('needs a title', () => {
    const trip = openTripWith();
    app.resetForm();
    fill({ title: '   ' });
    submit();
    assert.equal(trip.expenses.length, 0);
    assert.match(text('#toast'), /Give it a name/);
  });

  test('needs an amount above zero', () => {
    const trip = openTripWith();
    app.resetForm();
    for (const amount of ['', '0', '-5', 'lots']) {
      fill({ amount });
      submit();
    }
    assert.equal(trip.expenses.length, 0);
    assert.match(text('#toast'), /above zero/);
  });

  test('needs someone to have paid', () => {
    const trip = openTripWith();
    app.resetForm();
    fill({ payer: '' });
    submit();
    assert.equal(trip.expenses.length, 0);
    assert.match(text('#toast'), /Who paid/);
  });

  test('needs at least one person to split with', () => {
    const trip = openTripWith();
    app.resetForm();
    app.getUi().checked.clear();
    fill({});
    submit();
    assert.equal(trip.expenses.length, 0);
    assert.match(text('#toast'), /at least one person/);
  });

  test('needs a traveller before anything can be logged', () => {
    const trip = app.blankTrip({ name: 'Empty' });
    app.setAccount({ userId: 'u1', username: 'ann' });
    app.setDb({ trips: [trip] });
    app.openTrip(trip.id);
    fill({});
    submit();
    assert.equal(trip.expenses.length, 0);
    assert.match(text('#toast'), /Add at least one traveller/);
  });

  test('falls back to today when no date is given', () => {
    const trip = openTripWith();
    app.resetForm();
    fill({ date: '' });
    submit();
    assert.equal(trip.expenses[0].date, app.todayISO());
  });

  test('a foreign expense keeps the rate that was used', () => {
    const trip = openTripWith();
    app.resetForm();
    fill({ amount: '168000', currency: 'JPY', rate: '0.0091' });
    submit();
    assert.equal(trip.expenses[0].currency, 'JPY');
    assert.equal(trip.expenses[0].rate, 0.0091);
  });

  test('a foreign expense with no rate typed uses the trip\'s rate', () => {
    const trip = openTripWith();
    app.resetForm();
    fill({ amount: '1000', currency: 'JPY', rate: '' });
    submit();
    assert.equal(trip.expenses[0].rate, trip.rates.JPY);
  });

  test('an SGD expense is always rate 1, whatever is in the rate box', () => {
    const trip = openTripWith();
    app.resetForm();
    fill({ currency: 'SGD', rate: '0.5' });
    submit();
    assert.equal(trip.expenses[0].rate, 1);
  });

  test('saves a shares split', () => {
    const trip = openTripWith();
    app.resetForm();
    app.setMode('shares');
    Object.assign(app.getUi().nums, { p1: 2, p2: 1, p3: 1 });
    fill({ amount: '40' });
    submit();
    assert.equal(trip.expenses[0].splitMode, 'shares');
    assert.deepEqual(trip.expenses[0].shares, { p1: 2, p2: 1, p3: 1 });
  });

  test('refuses shares that add up to nothing', () => {
    const trip = openTripWith();
    app.resetForm();
    app.setMode('shares');
    Object.assign(app.getUi().nums, { p1: 0, p2: 0, p3: 0 });
    fill({});
    submit();
    assert.equal(trip.expenses.length, 0);
    assert.match(text('#toast'), /add up to more than zero/);
  });

  test('saves an exact split that adds up', () => {
    const trip = openTripWith();
    app.resetForm();
    app.setMode('exact');
    Object.assign(app.getUi().nums, { p1: 10, p2: 10, p3: 10 });
    fill({ amount: '30' });
    submit();
    assert.equal(trip.expenses[0].splitMode, 'exact');
    assert.deepEqual(trip.expenses[0].exact, { p1: 10, p2: 10, p3: 10 });
  });

  test('refuses an exact split that does not add up, and says by how much', () => {
    const trip = openTripWith();
    app.resetForm();
    app.setMode('exact');
    Object.assign(app.getUi().nums, { p1: 10, p2: 10, p3: 5 });
    fill({ amount: '30' });
    submit();
    assert.equal(trip.expenses.length, 0);
    assert.match(text('#toast'), /S\$25\.00.*S\$30\.00/);
  });

  test('editing replaces the expense and keeps when it was created', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ id: 'e1', title: 'Dinner', amount: 30, created: 1234 })];
    app.render();
    app.loadForEdit('e1');
    assert.equal(app.getUi().editingId, 'e1');
    assert.equal($('#exp-title').value, 'Dinner');
    assert.equal($('#btn-cancel-edit').hidden, false);

    fill({ title: 'Dinner (fixed)', amount: '45' });
    submit();
    assert.equal(trip.expenses.length, 1);
    assert.equal(trip.expenses[0].id, 'e1');
    assert.equal(trip.expenses[0].title, 'Dinner (fixed)');
    assert.equal(trip.expenses[0].created, 1234);
    assert.match(text('#toast'), /updated/);
  });

  test('editing loads a shares split back into the form', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ id: 'e1', splitMode: 'shares', shares: { p1: 3, p2: 1, p3: 1 } })];
    app.render();
    app.loadForEdit('e1');
    assert.equal(app.getUi().mode, 'shares');
    assert.equal(app.getUi().nums.p1, 3);
  });

  test('editing loads an exact split back into the form', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ id: 'e1', splitMode: 'exact', exact: { p1: 20, p2: 5, p3: 5 } })];
    app.render();
    app.loadForEdit('e1');
    assert.equal(app.getUi().mode, 'exact');
    assert.equal(app.getUi().nums.p1, 20);
  });

  test('editing a foreign expense opens the rate box', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ id: 'e1', currency: 'JPY', rate: 0.0088 })];
    app.render();
    app.loadForEdit('e1');
    assert.equal($('#fx-edit').hidden, false);
    assert.equal($('#exp-currency').value, 'JPY');
  });

  test('editing an expense that is gone does nothing', () => {
    openTripWith();
    assert.doesNotThrow(() => app.loadForEdit('nope'));
    assert.equal(app.getUi().editingId, null);
  });

  test('switching to shares seeds one share each; switching to exact clears the amounts', () => {
    openTripWith();
    app.resetForm();
    app.setMode('shares');
    assert.deepEqual(app.getUi().nums, { p1: 1, p2: 1, p3: 1 });
    app.setMode('exact');
    assert.deepEqual(app.getUi().nums, {});
  });

  test('the category chips track the choice', () => {
    openTripWith();
    app.setCat('hotel');
    assert.equal(app.getUi().cat, 'hotel');
  });

  test('the split list previews each person\'s share', () => {
    openTripWith();
    app.resetForm();
    $('#exp-amount').value = '30';
    app.renderSplitList();
    assert.match(html('#split-list'), /S\$10\.00/);
    assert.match(text('#split-hint'), /Split 3 ways · S\$10\.00 each/);
  });

  test('the split list asks you to tick someone when nobody is ticked', () => {
    openTripWith();
    app.resetForm();
    app.getUi().checked.clear();
    app.renderSplitList();
    assert.match(text('#split-hint'), /Tick everyone/);
  });

  test('the split hint counts shares', () => {
    openTripWith();
    app.resetForm();
    app.setMode('shares');
    Object.assign(app.getUi().nums, { p1: 2, p2: 1, p3: 1 });
    app.renderSplitList();
    assert.match(text('#split-hint'), /4 shares in total/);
  });

  test('the split hint warns when shares add up to nothing', () => {
    openTripWith();
    app.resetForm();
    app.setMode('shares');
    Object.assign(app.getUi().nums, { p1: 0, p2: 0, p3: 0 });
    app.renderSplitList();
    assert.match(text('#split-hint'), /at least one person a share above 0/);
  });

  test('the split hint tracks an exact split as it is typed', () => {
    openTripWith();
    app.resetForm();
    app.setMode('exact');
    $('#exp-amount').value = '30';

    Object.assign(app.getUi().nums, { p1: 10 });
    app.renderSplitList();
    assert.match(text('#split-hint'), /S\$20\.00 still unassigned/);

    Object.assign(app.getUi().nums, { p1: 10, p2: 10, p3: 10 });
    app.renderSplitList();
    assert.match(text('#split-hint'), /Adds up to S\$30\.00 exactly/);

    Object.assign(app.getUi().nums, { p1: 20, p2: 10, p3: 10 });
    app.renderSplitList();
    assert.match(text('#split-hint'), /Over by S\$10\.00/);
  });

  test('the fx strip previews the conversion, and hides for SGD', () => {
    openTripWith();
    app.resetForm();
    $('#exp-currency').value = 'JPY';
    $('#exp-amount').value = '168000';
    app.syncFxStrip();
    assert.equal($('#fx-strip').hidden, false);
    assert.equal(text('#fx-code'), 'JPY');
    assert.match(html('#fx-preview'), /¥168,000/);
    assert.match(html('#fx-preview'), /S\$1,478\.40/);

    $('#exp-currency').value = 'SGD';
    app.syncFxStrip();
    assert.equal($('#fx-strip').hidden, true);
  });
});

describe('the rates dialog', () => {
  test('lists every currency except the base one', () => {
    openTripWith();
    app.renderRatesGrid();
    assert.match(html('#rates-grid'), /data-rate="JPY"/);
    assert.ok(!html('#rates-grid').includes('data-rate="SGD"'));
  });
});

describe('the plain-text summary', () => {
  test('covers the total, the breakdown, who paid and how to settle', () => {
    const trip = openTripWith();
    trip.expenses = [
      expense({ id: 'e1', title: 'Hotel', amount: 300, category: 'hotel', payerId: 'p1' }),
      expense({ id: 'e2', title: 'Ramen', amount: 30, category: 'food', payerId: 'p2' }),
    ];
    app.render();
    const out = app.buildSummary();
    assert.match(out, /🗼 Tokyo — expense summary/);
    assert.match(out, /Total: S\$330\.00 across 2 expense\(s\), 3 traveller\(s\)/);
    assert.match(out, /WHERE IT WENT/);
    assert.match(out, /🏨 Hotel: S\$300\.00/);
    assert.match(out, /WHO PAID WHAT/);
    assert.match(out, /paid S\$300\.00, fair share S\$110\.00/);
    assert.match(out, /BOTTOM LINE/);
    assert.match(out, /gets back S\$190\.00/);
    assert.match(out, /SETTLE UP LIKE THIS/);
    assert.match(out, /converted to SGD/);
  });

  test('leaves out the settle section when everyone is square', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ amount: 30, payerId: 'p1', participants: ['p1'] })];
    app.render();
    const out = app.buildSummary();
    assert.ok(!out.includes('SETTLE UP LIKE THIS'));
    assert.match(out, /all square/);
  });

  test('lists payments already made', () => {
    const trip = openTripWith();
    trip.expenses = [expense({ amount: 30, payerId: 'p1' })];
    trip.settlements = [{ id: 's1', fromId: 'p2', toId: 'p1', cents: 1000, date: '2026-03-02' }];
    app.render();
    assert.match(app.buildSummary(), /ALREADY PAID/);
  });

  test('includes the dates when the trip has them', () => {
    openTripWith({ from: '2026-06-01', to: '2026-06-05' });
    assert.match(app.buildSummary(), /2026/);
  });
});

describe('export and import', () => {
  test('export offers a JSON file named after the trip', () => {
    openTripWith();
    app.exportJSON();
    assert.match(text('#toast'), /exported/);
  });

  test('import replaces the open trip, keeping its identity', () => {
    const trip = openTripWith();
    const incoming = {
      kind: 'trippysplit-trip', version: 2,
      trip: {
        name: 'Imported', people: [{ id: 'q1', name: 'Zed' }],
        expenses: [{ id: 'x1', payerId: 'q1', participants: ['q1'], amount: 12, currency: 'SGD', rate: 1, date: '2026-03-01' }],
      },
    };
    app.importJSON({ text: JSON.stringify(incoming) });
    const after = app.getState();
    assert.equal(after.id, trip.id, 'keeps its place in the trip list');
    assert.equal(after.name, 'Imported');
    assert.deepEqual(after.people.map(p => p.name), ['Zed']);
    assert.equal(app.getDb().trips.length, 1);
    assert.match(text('#toast'), /imported/);
  });

  test('import accepts a bare trip as well as the wrapped form', () => {
    openTripWith();
    app.importJSON({ text: JSON.stringify({ name: 'Bare', people: [], expenses: [] }) });
    assert.equal(app.getState().name, 'Bare');
  });

  test('import rejects a file of the wrong shape', () => {
    const trip = openTripWith();
    for (const body of ['not json at all', '{}', '{"trip":{"people":[]}}', 'null']) {
      app.importJSON({ text: body });
      assert.match(text('#toast'), /does not look like a Trippy Split export/, body);
    }
    assert.equal(app.getState(), trip, 'the open trip is untouched');
  });

  test('import leaves the trip alone if the confirmation is declined', () => {
    doc = installDom({ confirmWith: () => false });
    const trip = openTripWith();
    app.importJSON({ text: JSON.stringify({ name: 'Nope', people: [], expenses: [] }) });
    assert.equal(app.getState().name, trip.name);
  });
});

describe('the sample trip', () => {
  test('is a filled-in Tokyo trip whose books balance', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    app.setDb({ trips: [] });
    const trip = app.addSampleTrip();
    assert.equal(trip.name, 'Tokyo, 5 days');
    assert.equal(trip.people.length, 4);
    assert.equal(trip.expenses.length, 10);
    assert.equal(app.getDb().trips[0], trip);

    const { net } = app.balancesFor(trip);
    assert.equal(Object.values(net).reduce((a, b) => a + b, 0), 0);
    assert.ok(app.tripTotalCents(trip) > 0);
  });

  test('names the signed-in account as the first traveller', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    app.setDb({ trips: [] });
    assert.equal(app.sampleTrip().people[0].name, 'ann');
  });

  test('every sample expense carries a usable rate', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    app.setDb({ trips: [] });
    for (const e of app.sampleTrip().expenses) assert.ok(e.rate > 0, e.title);
  });
});

describe('saving', () => {
  test('writes the trips to the signed-in account\'s bucket', () => {
    const trip = openTripWith();
    app.save();
    const raw = JSON.parse(localStorage.getItem('trippysplit.data.u1'));
    assert.deepEqual(raw.trips.map(t => t.name), [trip.name]);
  });

  test('stamps the open trip as updated', () => {
    const trip = openTripWith();
    trip.updated = 0;
    app.save();
    assert.ok(trip.updated > 0);
  });

  test('does nothing when nobody is signed in', () => {
    app.setAccount(null);
    assert.doesNotThrow(() => app.save());
  });

  test('warns instead of throwing when storage is full', () => {
    openTripWith();
    globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    app.save();
    assert.match(text('#toast'), /browser storage is full or blocked/);
  });

  test('reading an account back normalizes every trip', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    localStorage.setItem('trippysplit.data.u1', JSON.stringify({
      trips: [{ id: 't1', name: 'Tokyo', people: [{ id: 'p1', name: 'Ann' }], expenses: [{ id: 'e1', payerId: 'ghost', participants: ['p1'] }] }],
    }));
    app.loadAccountData();
    assert.equal(app.getDb().trips.length, 1);
    assert.deepEqual(app.getDb().trips[0].expenses, [], 'the orphaned expense is dropped on the way in');
    assert.ok(app.getDb().trips[0].rates.JPY > 0, 'the rate table is topped up');
  });
});

describe('date helpers', () => {
  test('todayISO is a plain yyyy-mm-dd', () => {
    assert.match(app.todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  });

  test('prettyDate marks today as such', () => {
    assert.match(app.prettyDate(app.todayISO()), /^Today · /);
    assert.ok(!app.prettyDate('2026-03-01').startsWith('Today'));
  });

  test('prettyDate hands back anything it cannot read', () => {
    assert.equal(app.prettyDate('not a date'), 'not a date');
  });

  test('tripDateLabel joins a range, collapses one day, and copes with neither', () => {
    assert.match(app.tripDateLabel({ from: '2026-06-01', to: '2026-06-05' }), / – /);
    assert.ok(!app.tripDateLabel({ from: '2026-06-01', to: '2026-06-01' }).includes('–'));
    assert.equal(app.tripDateLabel({ from: '', to: '' }), '');
    assert.ok(app.tripDateLabel({ from: '2026-06-01', to: '' }).length);
    assert.ok(app.tripDateLabel({ from: '', to: '2026-06-01' }).length);
  });
});

describe('esc', () => {
  test('neutralises every character that could break out of markup', () => {
    assert.equal(app.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });

  test('turns nothing into an empty string', () => {
    assert.equal(app.esc(null), '');
    assert.equal(app.esc(undefined), '');
    assert.equal(app.esc(0), '0');
  });
});

describe('rateFor and isForeign', () => {
  test('reads the open trip\'s rate table, falling back to the defaults', () => {
    const trip = openTripWith();
    trip.rates.JPY = 0.01;
    assert.equal(app.rateFor('JPY'), 0.01);
    assert.equal(app.rateFor('USD'), app.DEFAULT_RATES.USD);
    assert.equal(app.rateFor('ZZZ'), 1, 'an unknown code is treated as parity');
  });

  test('only SGD is not foreign', () => {
    assert.equal(app.isForeign('SGD'), false);
    assert.equal(app.isForeign('JPY'), true);
  });
});
