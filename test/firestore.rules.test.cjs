const { before, after, beforeEach, test } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, serverTimestamp, writeBatch } = require('firebase/firestore');
let env;
const base = { clientId: 'client', providerId: 'worker', status: 'PENDING', securityPin: '1234', location: { latitude: -12, longitude: -77 }, address: 'Destino A', notificationTokens: { client: ['c'], provider: ['p'] } };
const instances = new Map();
const db = (uid) => { if (!instances.has(uid)) instances.set(uid, env.authenticatedContext(uid).firestore()); return instances.get(uid); };
const service = (uid) => doc(db(uid), 'service_requests/job');
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-tesis-servicios', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') } }); });
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    for (const [uid, role] of [['client','CLIENT'], ['worker','PROVIDER'], ['stranger','CLIENT'], ['operator','OPERATOR'], ['admin','ADMIN']]) await setDoc(doc(database, 'users', uid), { role, is_verified: true });
    await setDoc(doc(database, 'service_requests/job'), base);
  });
});
const price = () => ({ amountCents: 8500, currency: 'PEN', description: 'Visita y mano de obra', version: 1, assignedBy: 'operator', updatedAt: serverTimestamp() });
test('Central can assign a price and create an immutable audit record atomically', async () => {
  const batch = writeBatch(db('operator')); const pricing = price();
  batch.update(service('operator'), { pricing, price_agreed: 'S/ 85.00' });
  batch.set(doc(db('operator'), 'service_requests/job/price_history/rev1'), pricing);
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(doc(db('operator'), 'service_requests/job/price_history/rev1'), { amountCents: 1 }));
});
test('Client and worker cannot set or modify price, even through Firestore directly', async () => {
  for (const uid of ['client','worker']) await assertFails(updateDoc(service(uid), { pricing: price(), price_agreed: 'S/ 1.00' }));
});
test('Invalid price and edits after acceptance are rejected for central too', async () => {
  await assertFails(updateDoc(service('operator'), { pricing: { ...price(), amountCents: -1 }, price_agreed: 'S/ -1' }));
  await assertSucceeds(updateDoc(service('worker'), { status: 'ACCEPTED' }));
  await assertFails(updateDoc(service('operator'), { pricing: price(), price_agreed: 'S/ 85.00' }));
});
test('Each participant may refresh only their own notification tokens', async () => {
  await assertSucceeds(updateDoc(service('worker'), { 'notificationTokens.provider': ['new-p'] }));
  await assertSucceeds(updateDoc(service('client'), { 'notificationTokens.client': ['new-c'] }));
  await assertFails(updateDoc(service('client'), { 'notificationTokens.provider': ['forged'] }));
  await assertFails(updateDoc(service('worker'), { notificationTokens: {} }));
});
test('Selected destination cannot be altered by the worker', async () => {
  await assertFails(updateDoc(service('worker'), { location: { latitude: 0, longitude: 0 }, address: 'Otro destino' }));
});
test('New clients cannot self-assign or inject a price', async () => {
  const ref = doc(db('client'), 'service_requests/new');
  await assertSucceeds(setDoc(ref, { clientId: 'client', status: 'PENDING_ASSIGNMENT' }));
  await assertFails(setDoc(doc(db('client'), 'service_requests/forged'), { clientId: 'client', providerId: 'worker', status: 'PENDING_ASSIGNMENT', pricing: price() }));
});
test('Only own GPS is writable and central can monitor both participants', async () => {
  const gps = { latitude: -12, longitude: -77, accuracy: 10, capturedAt: Date.now(), updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db('worker'), 'service_requests/job/locations/worker'), gps));
  for (const uid of ['operator','admin']) await assertSucceeds(getDoc(doc(db(uid), 'service_requests/job/locations/worker')));
  await assertFails(getDoc(doc(db('stranger'), 'service_requests/job/locations/worker')));
  await assertFails(setDoc(doc(db('client'), 'service_requests/job/locations/worker'), gps));
  await assertFails(setDoc(doc(db('worker'), 'service_requests/job/locations/worker'), { ...gps, latitude: 100 }));
});
test('GPS stops on completion and a previously assigned worker loses write access', async () => {
  const gps = { latitude: -12, longitude: -77, accuracy: null, capturedAt: Date.now(), updatedAt: serverTimestamp() };
  await assertSucceeds(updateDoc(service('operator'), { status: 'COMPLETED' }));
  await assertFails(setDoc(doc(db('worker'), 'service_requests/job/locations/worker'), gps));
  await assertSucceeds(updateDoc(service('operator'), { status: 'PENDING', providerId: 'replacement' }));
  await assertFails(setDoc(doc(db('worker'), 'service_requests/job/locations/worker'), gps));
});
test('Central can observe chat while unrelated accounts cannot', async () => {
  const ref = 'service_requests/job/messages/one';
  await assertSucceeds(setDoc(doc(db('client'), ref), { senderId: 'client', text: 'Hola', type: 'text', createdAt: serverTimestamp() }));
  for (const uid of ['operator', 'admin','worker']) await assertSucceeds(getDoc(doc(db(uid), ref)));
  await assertFails(getDoc(doc(db('stranger'), ref)));
});
test('Worker cannot change profile tariff or approve themselves', async () => {
  await assertFails(updateDoc(doc(db('worker'), 'users/worker'), { price_range: 'S/ 900' }));
  await assertFails(updateDoc(doc(db('worker'), 'users/worker'), { approval_status: 'APPROVED' }));
});
