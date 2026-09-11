/* ============================================================
   dom.js — just enough DOM to run app.js outside a browser.
   ------------------------------------------------------------
   app.js reaches for elements by id and writes text, HTML and
   a handful of properties into them. Rather than pull in a full
   DOM implementation (this project ships with no dependencies),
   every selector here resolves to a recording element: writes
   are kept so a test can read them back, and the handful of
   methods app.js calls are no-ops.

   What this can check: the values and markup a render produces,
   and the branches a handler takes. What it cannot: layout,
   real event bubbling, or anything that needs a parser.
   ============================================================ */

class El {
  constructor(sel) {
    this.selector = sel;
    this.id = String(sel).replace(/^#/, '');
    this.tagName = 'DIV';
    this._value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.checked = false;
    this.disabled = false;
    this.className = '';
    this.href = '';
    this.download = '';
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.children = [];
    this.listeners = {};
    this.scrolledIntoView = false;
    this.focused = false;
    this.wasReset = false;
    this.clicked = false;
    this.classList = {
      _set: new Set(),
      add: (...c) => c.forEach(x => this.classList._set.add(x)),
      remove: (...c) => c.forEach(x => this.classList._set.delete(x)),
      toggle: (c, on) => { on ? this.classList._set.add(c) : this.classList._set.delete(c); },
      contains: c => this.classList._set.has(c),
    };
  }

  get value() { return this._value; }
  set value(v) { this._value = v === null || v === undefined ? '' : String(v); }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  appendChild(c) { this.children.push(c); return c; }
  focus() { this.focused = true; }
  blur() { this.focused = false; }
  reset() { this.wasReset = true; }
  select() { this.selected = true; }
  click() { this.clicked = true; }
  scrollIntoView() { this.scrolledIntoView = true; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest(sel) {
    /* Handlers ask for the nearest [data-thing], sometimes qualified by a
       class (".trip-body[data-open]"). A test drives them by dispatching a
       target that already carries the dataset — and the class, if the
       selector asks for one. */
    const m = /^(\.[\w-]+)?\[data-([\w-]+)]$/.exec(sel);
    if (!m) return null;
    const [, cls, attr] = m;
    if (cls && !this.classList.contains(cls.slice(1))) return null;
    const prop = attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return prop in this.dataset ? this : null;
  }
  /* Fire the handlers app.js registered on this element. */
  dispatch(type, event = {}) {
    const ev = Object.assign({
      type, target: this, currentTarget: this,
      preventDefault() { ev.defaultPrevented = true; },
      stopPropagation() {},
      defaultPrevented: false,
    }, event);
    (this.listeners[type] || []).forEach(fn => fn(ev));
    return ev;
  }
}

/* One document, one element per selector, so `$('#toast')` twice is the
   same element and a test can read what a render left behind. */
class Doc {
  constructor() {
    this.byId = new Map();
    this.groups = new Map();     // querySelectorAll results a test wants to control
    this.activeElement = null;
    this.body = new El('body');
    this.listeners = {};
  }
  el(sel) {
    if (!this.byId.has(sel)) this.byId.set(sel, new El(sel));
    return this.byId.get(sel);
  }
  querySelector(sel) { return this.el(sel); }
  querySelectorAll(sel) { return this.groups.get(sel) || []; }
  createElement(tag) { const e = new El(tag); e.tagName = String(tag).toUpperCase(); return e; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatch(type, event = {}) {
    const ev = Object.assign({ type, target: this.body, preventDefault() {}, stopPropagation() {} }, event);
    (this.listeners[type] || []).forEach(fn => fn(ev));
    return ev;
  }
}

/* A stand-in for a file chosen from disk. */
class FakeFileReader {
  constructor() { this.result = null; this.onload = null; this.onerror = null; }
  readAsText(file) {
    this.result = typeof file === 'string' ? file : file.text;
    if (this.onload) this.onload({ target: this });
  }
}

const calls = { toasts: [], confirms: [], alerts: [], copied: [] };

/* In the browser, auth.js and store.js are separate <script> tags, so
   app.js sees Auth and Store as globals. Under node it has to be told. */
function installSiblingScripts() {
  globalThis.Auth = require('../../auth.js');
  globalThis.Store = require('../../store.js');
}

/* Install the globals app.js touches. `confirm` answers `true` unless a
   test says otherwise, because most handlers are gated behind one. */
function installDom({ confirmWith = () => true } = {}) {
  const document = new Doc();
  globalThis.document = document;
  globalThis.confirm = msg => { calls.confirms.push(String(msg)); return confirmWith(String(msg)); };
  globalThis.alert = msg => { calls.alerts.push(String(msg)); };
  globalThis.FileReader = FakeFileReader;
  globalThis.Blob = class Blob { constructor(parts, opts) { this.parts = parts; this.type = opts?.type; } };
  globalThis.URL = Object.assign(globalThis.URL || {}, {
    createObjectURL: () => 'blob:trip',
    revokeObjectURL: () => {},
  });
  // node defines `navigator` as a getter with no setter, so it takes
  // defineProperty rather than a plain assignment
  Object.defineProperty(globalThis, 'navigator', {
    value: { clipboard: { writeText: async t => { calls.copied.push(t); } } },
    configurable: true, writable: true,
  });
  globalThis.window = { scrollTo: () => {}, document, location: { href: 'file:///index.html' } };
  calls.toasts.length = 0;
  calls.confirms.length = 0;
  calls.alerts.length = 0;
  calls.copied.length = 0;
  return document;
}

module.exports = { El, Doc, FakeFileReader, installDom, installSiblingScripts, calls };
