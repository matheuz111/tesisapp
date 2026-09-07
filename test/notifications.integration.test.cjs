const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(fetcher, storage = new Map()) {
  const auth = { currentUser: { uid: 'sender' } };
  const source = fs.readFileSync('src/services/demoPushService.ts', 'utf8');
  const context = { exports: {}, require: (name) => name.includes('async-storage') ? { default: { getItem: async (k) => storage.get(k) || null, setItem: async (k,v) => storage.set(k,v), removeItem: async (k) => storage.delete(k) } } : { auth }, process: { env: { EXPO_PUBLIC_NOTIFICATION_MODE: 'demo-direct' } }, fetch: fetcher, console: { log() {}, warn() {} }, setTimeout, clearTimeout, AbortController };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: false } }).outputText, context);
  return { api: context.exports, auth, storage };
}
const token = 'ExpoPushToken[valid-token_1]';
const ok = async () => ({ ok: true, json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }) });

test('Persisting an alert does not wait for the network, and new alerts join the active drain', { timeout: 2000 }, async () => {
  let finish;
  let calls = 0;
  const { api, storage } = load(async () => {
    calls++;
    if (calls === 1) return new Promise((resolve) => { finish = resolve; });
    return ok();
  });
  await api.queueDemoPushNotification(token, 'First', 'Body');
  const drain = api.flushDemoPushOutbox('sender');
  await api.queueDemoPushNotification(token, 'Second', 'Body');
  assert.equal(JSON.parse(storage.get('push-outbox:sender')).length, 2);
  for (let i = 0; !finish && i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof finish, 'function');
  finish(await ok());
  await drain;
  assert.equal(calls, 2);
  assert.equal(JSON.parse(storage.get('push-outbox:sender')).length, 0);
});

test('Actual push module validates token structure, not just prefixes', () => {
  const { api } = load(ok);
  assert.equal(api.isExpoPushToken('ExpoPushToken[broken'), false);
  assert.equal(api.isExpoPushToken(token), true);
  assert.equal(api.extractValidTokens([token, ` ${token} `, 'FCM-token']).length, 1);
});
test('An HTTP failure does not suppress the next retry of the same event', async () => {
  let calls = 0;
  const { api } = load(async () => ++calls === 1 ? { ok: false, status: 503 } : ok());
  const event = { requestId: 'job', eventType: 'ASSIGNED' };
  assert.equal(await api.sendDemoPushNotification(token, 'Title', 'Body', {}, event), false);
  assert.equal(await api.sendDemoPushNotification(token, 'Title', 'Body', {}, event), true);
  assert.equal(calls, 2);
});
test('Separate chat messages and different recipients are not deduplicated together', async () => {
  let calls = 0;
  const { api } = load(async () => { calls++; return ok(); });
  await api.sendDemoPushNotification(token, 'Chat', 'First', {}, { requestId: 'job', eventType: 'MESSAGE', eventId: '1' });
  await api.sendDemoPushNotification(token, 'Chat', 'Second', {}, { requestId: 'job', eventType: 'MESSAGE', eventId: '2' });
  await api.sendDemoPushNotification('ExpoPushToken[other]', 'Chat', 'First', {}, { requestId: 'job', eventType: 'MESSAGE', eventId: '1' });
  assert.equal(calls, 3);
});
test('Failed pushes survive a restart and are retried from the durable queue', async () => {
  const storage = new Map();
  const first = load(async () => { throw new Error('offline'); }, storage);
  await first.api.queueDemoPushNotification(token, 'Assignment', 'Body');
  await first.api.flushDemoPushOutbox('sender');
  assert.equal(JSON.parse(storage.get('push-outbox:sender')).length, 1);
  let calls = 0;
  const second = load(async () => { calls++; return ok(); }, storage);
  await second.api.flushDemoPushOutbox('sender');
  assert.equal(calls, 1);
  assert.equal(JSON.parse(storage.get('push-outbox:sender')).length, 0);
});
test('Queue from another account is never sent after switching users', async () => {
  let calls = 0;
  const { api, auth } = load(async () => { calls++; return ok(); });
  auth.currentUser = { uid: 'another' };
  await api.flushDemoPushOutbox('sender');
  assert.equal(calls, 0);
});
test('Payload has high priority, channel and a bounded body', async () => {
  let payload;
  const { api } = load(async (_url, request) => { payload = JSON.parse(request.body)[0]; return ok(); });
  await api.queueDemoPushNotification(token, 'Chat', 'x'.repeat(2000), { screen: 'chat', requestId: 'job' });
  await api.flushDemoPushOutbox('sender');
  assert.equal(payload.priority, 'high'); assert.equal(payload.channelId, 'default'); assert.equal(payload.body.length, 160);
  assert.equal(payload.data.requestId, 'job');
});

test('FCM receipt errors are persisted for the diagnostic shown in the profile', async () => {
  const storage = new Map([['push-receipts:sender', JSON.stringify([{ id: 'receipt-1', createdAt: Date.now() - 20000 }])]]);
  const { api } = load(async (url) => {
    assert.match(url, /getReceipts$/);
    return { ok: true, json: async () => ({ data: { 'receipt-1': { status: 'error', details: { error: 'InvalidCredentials' } } } }) };
  }, storage);
  await api.checkPushReceipts('sender');
  assert.equal((await api.getPushDiagnostics('sender')).lastError, 'InvalidCredentials');
  assert.equal(JSON.parse(storage.get('push-receipts:sender')).length, 0);
});

test('A successful handoff receipt clears the previous diagnostic', async () => {
  const storage = new Map([['push-last-error:sender', 'InvalidCredentials'], ['push-receipts:sender', JSON.stringify([{ id: 'receipt-2', createdAt: Date.now() - 20000 }])]]);
  const { api } = load(async () => ({ ok: true, json: async () => ({ data: { 'receipt-2': { status: 'ok' } } }) }), storage);
  await api.checkPushReceipts('sender');
  assert.equal((await api.getPushDiagnostics('sender')).lastError, null);
});

test('Only the failed device remains queued when another device succeeds', async () => {
  let failed = true;
  const sent = [];
  const { api, storage } = load(async (_url, request) => {
    const to = JSON.parse(request.body)[0].to;
    sent.push(to);
    if (to === 'ExpoPushToken[second]' && failed) return { ok: false, status: 503 };
    return ok();
  });
  await api.queueDemoPushNotification([token, 'ExpoPushToken[second]'], 'Servicio', 'Aviso');
  await api.flushDemoPushOutbox('sender');
  assert.equal(JSON.parse(storage.get('push-outbox:sender')).length, 1);
  failed = false;
  await api.flushDemoPushOutbox('sender');
  assert.deepEqual(sent, [token, 'ExpoPushToken[second]', 'ExpoPushToken[second]']);
  assert.equal(JSON.parse(storage.get('push-outbox:sender')).length, 0);
});
