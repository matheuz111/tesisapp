const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness({ write, getExpo, storage = new Map() } = {}) {
  const calls = { native: 0, expo: 0, writes: [], logout: 0, stopped: 0 };
  const listeners = [];
  const auth = { currentUser: { uid: 'alice' }, signOut: async () => { calls.logout++; auth.currentUser = null; } };
  const native = { type: 'android', data: 'native-one' };
  const notifications = {
    AndroidImportance: { MAX: 5 }, AndroidNotificationVisibility: { PUBLIC: 1 },
    setNotificationHandler() {}, setNotificationChannelAsync: async () => {},
    getPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
    getDevicePushTokenAsync: async () => { calls.native++; return native; },
    getExpoPushTokenAsync: async (options) => { calls.expo++; assert.ok(options.devicePushToken); return getExpo ? getExpo(options) : { data: 'ExpoPushToken[phone-one]' }; },
    dismissAllNotificationsAsync: async () => {}, clearLastNotificationResponseAsync: async () => {},
  };
  const firebase = {
    doc: (_db, ...parts) => ({ path: parts.join('/') }), collection: (_db, ...parts) => ({ path: parts.join('/') }),
    query: (...parts) => ({ parts }), where: (...parts) => parts,
    arrayRemove: (token) => ({ remove: token }), arrayUnion: (token) => ({ add: token }), serverTimestamp: () => 'now',
    setDoc: (ref, data) => { calls.writes.push({ ref, data }); return write ? write(ref, data) : Promise.resolve(); },
    updateDoc: (ref, data) => { calls.writes.push({ ref, data }); return write ? write(ref, data) : Promise.resolve(); },
    onSnapshot: (ref, next) => { listeners.push({ ref, next }); return () => { calls.stopped++; }; },
  };
  function evaluate(file, requireModule) {
    const context = { exports: {}, require: requireModule, console: { warn() {} }, setTimeout, clearTimeout };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: false } }).outputText, context);
    return context.exports;
  }
  const asyncApi = evaluate('src/services/async.ts', () => {});
  const api = evaluate('utils/pushNotifications.ts', (name) => {
    if (name.includes('async-storage')) return { default: { getItem: async (key) => storage.get(key) || null, setItem: async (key, value) => storage.set(key, value), removeItem: async (key) => storage.delete(key) } };
    if (name === 'expo-constants') return { default: { easConfig: { projectId: 'project' } } };
    if (name === 'expo-device') return { isDevice: true };
    if (name === 'expo-notifications') return notifications;
    if (name.includes('notificationsWrapper')) return { Notifications: notifications, isExpoGo: false };
    if (name === 'firebase/firestore') return firebase;
    if (name === 'react-native') return { Platform: { OS: 'android' } };
    if (name.endsWith('/async')) return asyncApi;
    if (name.endsWith('/monitoring')) return { MONITORED_STATUSES: ['PENDING', 'ACCEPTED'] };
    if (name.endsWith('/firebase')) return { auth, db: {} };
    throw new Error('Unexpected import ' + name);
  });
  return { api, auth, calls, native, listeners, storage };
}

test('Repeated native token events do not fetch native tokens or rewrite Firestore', async () => {
  const { api, calls, native } = harness();
  await api.registerForPushNotificationsAsync('alice', { devicePushToken: native });
  for (let i = 0; i < 20; i++) await api.registerForPushNotificationsAsync('alice', { devicePushToken: native });
  assert.equal(calls.native, 0);
  assert.equal(calls.expo, 1);
  assert.equal(calls.writes.length, 1);
});

test('Concurrent registration requests share the same operation', async () => {
  const { api, calls } = harness();
  await Promise.all(Array.from({ length: 20 }, () => api.registerForPushNotificationsAsync('alice')));
  assert.equal(calls.native, 1); assert.equal(calls.expo, 1); assert.equal(calls.writes.length, 1);
});

test('Logout succeeds with rejected cleanup and duplicate clicks call auth.signOut only once', async () => {
  const { api, calls, storage } = harness({ write: async () => { throw new Error('permission-denied'); } });
  storage.set('push-device:alice', 'ExpoPushToken[old]');
  api.watchServicePushTokens('alice', 'PROVIDER');
  const first = api.signOutWithNotifications();
  assert.equal(api.signOutWithNotifications(), first);
  await first;
  assert.equal(calls.logout, 1); assert.equal(calls.stopped, 2);
});

test('Logout never waits indefinitely for offline Firestore writes, including after app restart', async () => {
  const { api, calls, storage } = harness({ write: () => new Promise(() => {}) });
  storage.set('push-device:alice', 'ExpoPushToken[persisted]');
  const started = Date.now();
  await api.signOutWithNotifications();
  assert.equal(calls.logout, 1);
  assert.ok(Date.now() - started < 2500);
  assert.equal(calls.writes[0].data.tokens.remove, 'ExpoPushToken[persisted]');
});

test('A registration completing after logout cannot attach an old account to the device', async () => {
  let complete;
  const { api, auth, calls } = harness({ getExpo: () => new Promise((resolve) => { complete = resolve; }) });
  const pending = api.registerForPushNotificationsAsync('alice');
  for (let i = 0; !complete && i < 50; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof complete, 'function');
  await api.signOutWithNotifications();
  auth.currentUser = { uid: 'bob' };
  complete({ data: 'ExpoPushToken[old]' });
  assert.equal(await pending, undefined);
  assert.equal(calls.writes.length, 0);
});

test('Switching accounts requires a fresh registration even on the same phone', async () => {
  const { api, auth, calls } = harness();
  await api.registerForPushNotificationsAsync('alice');
  await api.signOutWithNotifications();
  auth.currentUser = { uid: 'bob' };
  await api.registerForPushNotificationsAsync('bob');
  assert.equal(calls.expo, 2);
  assert.equal(calls.writes.at(-1).ref.path, 'push_tokens/bob');
});
