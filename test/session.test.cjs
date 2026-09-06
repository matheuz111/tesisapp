const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load() {
  const auth = { currentUser: null };
  const states = [], listeners = [], timers = new Set();
  let onAuth;
  const source = fs.readFileSync('src/context/SessionContext.tsx', 'utf8');
  const context = {
    exports: {},
    require: (name) => {
      if (name === 'firebase/auth') return { onAuthStateChanged: (_auth, callback) => { onAuth = callback; return () => {}; } };
      if (name === 'firebase/firestore') return {
        doc: (_db, collection, uid) => ({ collection, uid }),
        onSnapshot: (ref, _options, next, error) => { const listener = { ref, next, error, stopped: false }; listeners.push(listener); return () => { listener.stopped = true; }; },
      };
      if (name.includes('config/firebase')) return { auth, db: {} };
      if (name === 'react') return { createContext: () => ({}) };
      return {};
    },
    setTimeout: (callback) => { timers.add(callback); return callback; },
    clearTimeout: (callback) => timers.delete(callback),
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  const controller = context.exports.subscribeToSession((state) => states.push(state));
  const authenticate = (uid) => { auth.currentUser = uid ? { uid } : null; onAuth(auth.currentUser); };
  const snapshot = (listener, data, fromCache = false) => listener.next({ exists: () => !!data, data: () => data, metadata: { fromCache } });
  return { controller, auth, authenticate, snapshot, listeners, states, timers, state: () => states.at(-1), timeout: () => { for (const callback of [...timers]) { timers.delete(callback); callback(); } } };
}

test('Profile cache is usable immediately without waiting for the server', () => {
  const h = load(); h.authenticate('alice');
  h.snapshot(h.listeners[0], { role: 'CLIENT', full_name: 'Alice' }, true);
  assert.equal(h.state().loading, false);
  assert.equal(h.state().profile.uid, 'alice');
  assert.equal(h.state().fromCache, true);
  assert.equal(h.timers.size, 0);
  h.controller.stop();
});

test('Empty cache times out with an actionable error, then recovers on server response', () => {
  const h = load(); h.authenticate('alice');
  h.snapshot(h.listeners[0], null, true);
  assert.equal(h.state().loading, true);
  h.timeout();
  assert.equal(h.state().loading, false);
  assert.match(h.state().error, /conexión/);
  h.snapshot(h.listeners[0], { role: 'CLIENT' });
  assert.equal(h.state().error, null);
  assert.equal(h.state().profile.role, 'CLIENT');
  h.controller.stop();
});

test('Logout clears the previous profile and discards a late snapshot', () => {
  const h = load(); h.authenticate('alice');
  h.snapshot(h.listeners[0], { role: 'ADMIN' });
  h.authenticate(null);
  h.snapshot(h.listeners[0], { role: 'ADMIN' });
  assert.equal(h.state().user, null);
  assert.equal(h.state().profile, null);
  assert.equal(h.listeners[0].stopped, true);
  h.controller.stop();
});

test('Changing accounts cannot inherit the previous role or late callback', () => {
  const h = load(); h.authenticate('alice');
  h.snapshot(h.listeners[0], { role: 'ADMIN' });
  h.authenticate('bob');
  assert.equal(h.state().profile, null);
  h.snapshot(h.listeners[0], { role: 'ADMIN' });
  assert.equal(h.state().profile, null);
  h.snapshot(h.listeners[1], { role: 'CLIENT' });
  assert.equal(h.state().profile.uid, 'bob');
  assert.equal(h.state().profile.role, 'CLIENT');
  h.controller.stop();
});

test('Retry retains the loaded profile and replaces its previous listener', () => {
  const h = load(); h.authenticate('alice');
  h.snapshot(h.listeners[0], { role: 'CLIENT', full_name: 'Alice' });
  h.listeners[0].error({ code: 'unavailable' });
  assert.equal(h.state().profile.full_name, 'Alice');
  h.controller.retry();
  assert.equal(h.state().profile.full_name, 'Alice');
  assert.equal(h.state().loading, false);
  assert.equal(h.listeners[0].stopped, true);
  h.snapshot(h.listeners[0], { role: 'ADMIN' });
  assert.equal(h.state().profile.role, 'CLIENT');
  h.controller.stop();
  assert.equal(h.listeners[1].stopped, true);
  assert.equal(h.timers.size, 0);
});

test('A missing server profile resolves the spinner without inventing a role', () => {
  const h = load(); h.authenticate('alice');
  h.snapshot(h.listeners[0], null);
  assert.equal(h.state().loading, false);
  assert.equal(h.state().profile, null);
  assert.match(h.state().error, /perfil/);
  h.controller.stop();
});
