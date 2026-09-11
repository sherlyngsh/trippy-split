/* The wiring: what happens when someone actually clicks or types.

   boot() registers the listeners on the document that exists when
   app.js is first required, so this file keeps that one document for
   the whole run and resets the app's state between tests instead of
   standing up a fresh DOM. */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { installStorage } = require('./helpers/browser-env.js');
const { installDom, installSiblingScripts, calls } = require('./helpers/dom.js');

installStorage();
const doc = installDom();
installSiblingScripts();
const app = require('../app.js');            // boot() wires everything to `doc`
const { people } = require('./helpers/trips.js');

const $ = sel => doc.querySelector(sel);
const html = sel => $(sel).innerHTML;
const text = sel => $(sel).textContent;

/* Let the next confirm() be answered yes or no. */
let answerConfirm = () => true;
globalThis.confirm = msg => { calls.confirms.push(String(msg)); return answerConfirm(String(msg)); };

/* Fire a handler the way a click on a rendered button would: the event
   target carries the data- attributes that button was rendered with. */
const { El } = require('./helpers/dom.js');
const targetWith = (dataset, ...classes) => {
  const el = new El('button');
  el.dataset = dataset;
  classes.forEach(c => el.classList.add(c));
  return el;
};
const fire = (sel, type, dataset) => $(sel).dispatch(type, { target: targetWith(dataset) });

const expense = f => Object.assign({
  id: 'e1', created: 1, title: 'Dinner', amount: 30, currency: 'SGD', rate: 1,
  category: 'food', date: '2026-03-01', payerId: 'p1',
  participants: ['p1', 'p2', 'p3'], splitMode: 'equal', note: '', shares: {}, exact: {},
}, f);

function openTripWith(expenses = [], fields = {}) {
  const trip = app.blankTrip(Object.assign({
    name: 'Tokyo', emoji: '🗼', people: people('Ann', 'Bo', 'Cy'), meId: 'p1',
  }, fields));
  trip.expenses = expenses.map(expense);
  app.setAccount({ userId: 'u1', username: 'ann' });
  app.setDb({ trips: [trip] });
  app.setState(trip);
  app.openTrip(trip.id);
  return trip;
}

beforeEach(() => {
  installStorage();
  answerConfirm = () => true;
  calls.confirms.length = 0;
  app.setAccount(null);
  app.setDb({ trips: [] });
  app.setState(null);
});

describe('renaming a trip', () => {
  test('takes what was typed', () => {
    const trip = openTripWith();
    $('#trip-name').dispatch('input', { target: { value: '  Osaka  ' } });
    assert.equal(trip.name, 'Osaka');
  });

  test('falls back to a default rather than leaving it blank', () => {
    const trip = openTripWith();
    $('#trip-name').dispatch('input', { target: { value: '   ' } });
    assert.equal(trip.name, 'Our Holiday');
  });
});

describe('adding a traveller', () => {
  test('adds them, ticks them into the open expense and clears the box', () => {
    const trip = openTripWith();
    $('#person-name').value = 'Dee';
    $('#person-form').dispatch('submit', { preventDefault() {} });
    assert.deepEqual(trip.people.map(p => p.name), ['Ann', 'Bo', 'Cy', 'Dee']);
    const added = trip.people.at(-1);
    assert.ok(app.getUi().checked.has(added.id));
    assert.equal($('#person-name').value, '');
  });

  test('gives them an avatar nobody else has', () => {
    const trip = openTripWith();
    $('#person-name').value = 'Dee';
    $('#person-form').dispatch('submit', { preventDefault() {} });
    assert.equal(new Set(trip.people.map(p => p.avatar)).size, trip.people.length);
  });

  test('ignores a blank name', () => {
    const trip = openTripWith();
    $('#person-name').value = '   ';
    $('#person-form').dispatch('submit', { preventDefault() {} });
    assert.equal(trip.people.length, 3);
  });

  test('refuses a name someone already has, whatever the casing', () => {
    const trip = openTripWith();
    $('#person-name').value = 'ANN';
    $('#person-form').dispatch('submit', { preventDefault() {} });
    assert.equal(trip.people.length, 3);
    assert.match(text('#toast'), /already has that name/);
  });

  test('the first traveller on an empty trip becomes you', () => {
    const trip = app.blankTrip({ name: 'Empty' });
    app.setAccount({ userId: 'u1', username: 'ann' });
    app.setDb({ trips: [trip] });
    app.openTrip(trip.id);
    $('#person-name').value = 'Ann';
    $('#person-form').dispatch('submit', { preventDefault() {} });
    assert.equal(trip.meId, trip.people[0].id);
  });

  test('someone added mid-shares-split starts on one share', () => {
    const trip = openTripWith();
    app.resetForm();
    app.setMode('shares');
    $('#person-name').value = 'Dee';
    $('#person-form').dispatch('submit', { preventDefault() {} });
    assert.equal(app.getUi().nums[trip.people.at(-1).id], 1);
  });
});

describe('removing a traveller', () => {
  test('takes them off a trip they are not involved in, without asking', () => {
    const trip = openTripWith();
    fire('#people-list', 'click', { remove: 'p3' });
    assert.deepEqual(trip.people.map(p => p.id), ['p1', 'p2']);
    assert.deepEqual(calls.confirms, []);
  });

  test('warns first when they appear in expenses', () => {
    const trip = openTripWith([{ amount: 30 }]);
    fire('#people-list', 'click', { remove: 'p3' });
    assert.match(calls.confirms.join('\n'), /appears in existing expenses/);
    assert.deepEqual(trip.people.map(p => p.id), ['p1', 'p2']);
  });

  test('keeps them when the warning is declined', () => {
    const trip = openTripWith([{ amount: 30 }]);
    answerConfirm = () => false;
    fire('#people-list', 'click', { remove: 'p3' });
    assert.equal(trip.people.length, 3);
  });

  test('deletes the expenses they paid for', () => {
    const trip = openTripWith([
      { id: 'e1', payerId: 'p3', participants: ['p1', 'p2', 'p3'] },
      { id: 'e2', payerId: 'p1', participants: ['p1', 'p2', 'p3'] },
    ]);
    fire('#people-list', 'click', { remove: 'p3' });
    assert.deepEqual(trip.expenses.map(e => e.id), ['e2']);
  });

  test('drops them from expenses they only shared in', () => {
    const trip = openTripWith([{ id: 'e1', payerId: 'p1', participants: ['p1', 'p2', 'p3'] }]);
    fire('#people-list', 'click', { remove: 'p3' });
    assert.deepEqual(trip.expenses[0].participants, ['p1', 'p2']);
  });

  test('deletes an expense that was only theirs', () => {
    const trip = openTripWith([{ id: 'e1', payerId: 'p1', participants: ['p3'] }]);
    fire('#people-list', 'click', { remove: 'p3' });
    assert.deepEqual(trip.expenses, []);
  });

  test('drops recorded payments that involved them', () => {
    const trip = openTripWith([{ amount: 30 }]);
    trip.settlements = [
      { id: 's1', fromId: 'p3', toId: 'p1', cents: 500, date: '2026-03-02' },
      { id: 's2', fromId: 'p2', toId: 'p1', cents: 500, date: '2026-03-02' },
    ];
    fire('#people-list', 'click', { remove: 'p3' });
    assert.deepEqual(trip.settlements.map(s => s.id), ['s2']);
  });

  test('clears "me" when it was them', () => {
    const trip = openTripWith();
    fire('#people-list', 'click', { remove: 'p1' });
    assert.equal(trip.meId, null);
  });

  test('the books still balance afterwards', () => {
    const trip = openTripWith([
      { id: 'e1', amount: 30, payerId: 'p1', participants: ['p1', 'p2', 'p3'] },
      { id: 'e2', amount: 60, payerId: 'p2', participants: ['p1', 'p2', 'p3'] },
    ]);
    fire('#people-list', 'click', { remove: 'p3' });
    const { net } = app.balancesFor(trip);
    assert.equal(Object.values(net).reduce((a, b) => a + b, 0), 0);
  });

  test('a click that is not on a remove button is ignored', () => {
    const trip = openTripWith();
    $('#people-list').dispatch('click', { target: targetWith({}) });
    assert.equal(trip.people.length, 3);
  });
});

describe('choosing who you are', () => {
  test('sets and clears "me"', () => {
    const trip = openTripWith();
    $('#me-select').dispatch('change', { target: { value: 'p2' } });
    assert.equal(trip.meId, 'p2');
    $('#me-select').dispatch('change', { target: { value: '' } });
    assert.equal(trip.meId, null);
  });
});

describe('the expense form controls', () => {
  test('a category chip picks that category', () => {
    openTripWith();
    fire('#cat-chips', 'click', { cat: 'hotel' });
    assert.equal(app.getUi().cat, 'hotel');
  });

  test('a split-mode button switches mode', () => {
    openTripWith();
    fire('#split-modes', 'click', { mode: 'shares' });
    assert.equal(app.getUi().mode, 'shares');
  });

  test('ticking someone off the split takes them out of it', () => {
    openTripWith();
    app.resetForm();
    const box = targetWith({ split: 'p2' });
    box.checked = false;
    $('#split-list').dispatch('change', { target: box });
    assert.ok(!app.getUi().checked.has('p2'));

    box.checked = true;
    $('#split-list').dispatch('change', { target: box });
    assert.ok(app.getUi().checked.has('p2'));
  });

  test('typing a share or an amount records it', () => {
    openTripWith();
    app.resetForm();
    app.setMode('shares');
    const input = targetWith({ num: 'p2' });
    input.value = '3';
    $('#split-list').dispatch('input', { target: input });
    assert.equal(app.getUi().nums.p2, '3');
  });

  test('the fx toggle opens the rate box', () => {
    openTripWith();
    app.resetForm();
    $('#exp-currency').value = 'JPY';
    $('#fx-edit').hidden = true;
    $('#fx-toggle').dispatch('click', {});
    assert.equal($('#fx-edit').hidden, false);
  });
});

describe('the expense log', () => {
  test('edit loads the expense into the form', () => {
    openTripWith([{ id: 'e1', title: 'Ramen' }]);
    fire('#log', 'click', { edit: 'e1' });
    assert.equal(app.getUi().editingId, 'e1');
    assert.equal($('#exp-title').value, 'Ramen');
  });

  test('delete removes it once confirmed', () => {
    const trip = openTripWith([{ id: 'e1', title: 'Ramen' }]);
    fire('#log', 'click', { del: 'e1' });
    assert.deepEqual(trip.expenses, []);
    assert.match(calls.confirms.join('\n'), /Delete “Ramen”/);
    assert.match(text('#toast'), /Expense deleted/);
  });

  test('delete keeps it when declined', () => {
    const trip = openTripWith([{ id: 'e1' }]);
    answerConfirm = () => false;
    fire('#log', 'click', { del: 'e1' });
    assert.equal(trip.expenses.length, 1);
  });

  test('deleting the expense being edited clears the form', () => {
    openTripWith([{ id: 'e1' }]);
    app.loadForEdit('e1');
    fire('#log', 'click', { del: 'e1' });
    assert.equal(app.getUi().editingId, null);
  });

  test('deleting an expense that is already gone does nothing', () => {
    const trip = openTripWith([{ id: 'e1' }]);
    fire('#log', 'click', { del: 'nope' });
    assert.equal(trip.expenses.length, 1);
  });

  test('changing a filter re-renders the log', () => {
    openTripWith([
      { id: 'e1', title: 'Ann only', payerId: 'p1', participants: ['p1'] },
      { id: 'e2', title: 'Bo only', payerId: 'p2', participants: ['p2'] },
    ]);
    $('#filter-person').value = 'p2';
    $('#filter-person').dispatch('change', {});
    assert.match(html('#log'), /Bo only/);
    assert.ok(!html('#log').includes('Ann only'));
  });
});

describe('recording and undoing a payment', () => {
  test('marking a transfer paid records it and clears the debt', () => {
    const trip = openTripWith([{ amount: 30, payerId: 'p1' }]);
    fire('#settle-list', 'click', { settle: 'p2|p1|1000' });
    assert.equal(trip.settlements.length, 1);
    assert.deepEqual(
      { ...trip.settlements[0], id: undefined, date: undefined },
      { id: undefined, date: undefined, fromId: 'p2', toId: 'p1', cents: 1000 });
    assert.equal(app.balancesFor(trip).net.p2, 0);
    assert.match(text('#toast'), /Recorded/);
  });

  test('undo takes it back off', () => {
    const trip = openTripWith([{ amount: 30, payerId: 'p1' }]);
    fire('#settle-list', 'click', { settle: 'p2|p1|1000' });
    const id = trip.settlements[0].id;
    fire('#settlements-list', 'click', { unsettle: id });
    assert.deepEqual(trip.settlements, []);
    assert.equal(app.balancesFor(trip).net.p2, -1000);
    assert.match(text('#toast'), /Payment undone/);
  });

  test('settling the whole plan leaves everyone square', () => {
    const trip = openTripWith([{ amount: 30, payerId: 'p1' }, { amount: 15, payerId: 'p2' }]);
    for (const t of app.settlePlan(app.balancesFor(trip).net, trip)) {
      fire('#settle-list', 'click', { settle: `${t.fromId}|${t.toId}|${t.cents}` });
    }
    assert.deepEqual(app.balancesFor(trip).net, { p1: 0, p2: 0, p3: 0 });
    assert.deepEqual(app.settlePlan(app.balancesFor(trip).net, trip), []);
  });

  test('a stray click on either list is ignored', () => {
    const trip = openTripWith([{ amount: 30, payerId: 'p1' }]);
    $('#settle-list').dispatch('click', { target: targetWith({}) });
    $('#settlements-list').dispatch('click', { target: targetWith({}) });
    assert.deepEqual(trip.settlements, []);
  });
});

describe('the fx rates dialog', () => {
  test('typing a rate saves it against this trip only', () => {
    const trip = openTripWith();
    const input = targetWith({ rate: 'JPY' });
    input.value = '0.0095';
    $('#rates-grid').dispatch('input', { target: input });
    assert.equal(trip.rates.JPY, 0.0095);
    assert.equal(app.DEFAULT_RATES.JPY, 0.0088, 'the shipped defaults are untouched');
  });

  test('a rate of zero or nonsense is not saved', () => {
    const trip = openTripWith();
    const before = trip.rates.JPY;
    for (const v of ['0', '-1', 'soon', '']) {
      const input = targetWith({ rate: 'JPY' });
      input.value = v;
      $('#rates-grid').dispatch('input', { target: input });
    }
    assert.equal(trip.rates.JPY, before);
  });

  test('reset puts every rate back to the shipped default', () => {
    const trip = openTripWith();
    trip.rates.JPY = 0.02;
    trip.rates.USD = 9;
    $('#rates-reset').dispatch('click', {});
    assert.deepEqual(trip.rates, app.DEFAULT_RATES);
    assert.match(text('#toast'), /Rates reset/);
  });

  test('editing a rate does not rewrite expenses already logged', () => {
    const trip = openTripWith([{ amount: 1000, currency: 'JPY', rate: 0.0088 }]);
    const before = app.tripTotalCents(trip);
    const input = targetWith({ rate: 'JPY' });
    input.value = '0.02';
    $('#rates-grid').dispatch('input', { target: input });
    assert.equal(app.tripTotalCents(trip), before);
  });
});

describe('the overflow menu', () => {
  test('opens and closes', () => {
    openTripWith();
    $('#menu-pop').hidden = true;
    $('#btn-menu').dispatch('click', {});
    assert.equal($('#menu-pop').hidden, false);
    $('#btn-menu').dispatch('click', {});
    assert.equal($('#menu-pop').hidden, true);
  });

  test('a click elsewhere closes it', () => {
    openTripWith();
    $('#menu-pop').hidden = true;
    $('#btn-menu').dispatch('click', {});
    doc.dispatch('click', { target: targetWith({}) });
    assert.equal($('#menu-pop').hidden, true);
  });

  test('copying the summary puts it on the clipboard', async () => {
    openTripWith([{ amount: 30, payerId: 'p1' }]);
    $('#summary-text').value = app.buildSummary();
    calls.copied.length = 0;
    await $('#summary-copy').dispatch('click', {});
    await new Promise(r => setImmediate(r));
    assert.equal(calls.copied.length, 1);
    assert.match(calls.copied[0], /expense summary/);
  });
});

describe('the trips grid', () => {
  test('clicking a card opens that trip', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    const trip = app.blankTrip({ name: 'Tokyo' });
    app.setDb({ trips: [trip] });
    app.showTrips();
    fire('#trip-grid', 'click', { open: trip.id });
    assert.equal(app.getState(), trip);
    assert.equal($('#view-trip').hidden, false);
  });

  test('the delete button on a card deletes that trip', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    const trip = app.blankTrip({ name: 'Tokyo' });
    app.setDb({ trips: [trip] });
    app.showTrips();
    fire('#trip-grid', 'click', { delTrip: trip.id });
    assert.deepEqual(app.getDb().trips, []);
  });

  test('enter and space open a focused card', () => {
    app.setAccount({ userId: 'u1', username: 'ann' });
    const trip = app.blankTrip({ name: 'Tokyo' });
    app.setDb({ trips: [trip] });
    app.showTrips();
    const card = targetWith({ open: trip.id }, 'trip-body');
    $('#trip-grid').dispatch('keydown', { key: 'Enter', target: card, preventDefault() {} });
    assert.equal(app.getState(), trip);

    app.showTrips();
    $('#trip-grid').dispatch('keydown', { key: ' ', target: card, preventDefault() {} });
    assert.equal(app.getState(), trip);

    app.showTrips();
    $('#trip-grid').dispatch('keydown', { key: 'a', target: card, preventDefault() {} });
    assert.equal(app.getState(), null, 'any other key is left alone');
  });
});
