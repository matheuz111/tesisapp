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

test('Provider presence: provider can publish own presence with server timestamps and valid coordinates', async () => {
  const presenceDoc = doc(db('worker'), 'provider_presence/worker');
  const validPayload = {
    providerId: 'worker',
    providerName: 'Juan Técnico',
    providerPhone: '987654321',
    status: 'AVAILABLE',
    location: { latitude: -12.06, longitude: -77.04 },
    geohash: '6mc5v1234',
    accuracy: 15,
    specialties: ['Plomería', 'Electricidad'],
    zones: ['LIMA_CENTRO'],
    district: 'LIMA',
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await assertSucceeds(setDoc(presenceDoc, validPayload));

  // Operator and provider can read
  await assertSucceeds(getDoc(doc(db('operator'), 'provider_presence/worker')));
  await assertSucceeds(getDoc(doc(db('worker'), 'provider_presence/worker')));

  // Stranger cannot read
  await assertFails(getDoc(doc(db('stranger'), 'provider_presence/worker')));

  // Worker cannot spoof another worker's presence
  await assertFails(setDoc(doc(db('worker'), 'provider_presence/other_worker'), {
    ...validPayload,
    providerId: 'other_worker',
  }));

  // Client cannot write provider presence
  await assertFails(setDoc(doc(db('client'), 'provider_presence/client'), {
    ...validPayload,
    providerId: 'client',
  }));

  // Disallowed admin keys are rejected by keys().hasOnly()
  await assertFails(setDoc(presenceDoc, {
    ...validPayload,
    role: 'ADMIN',
  }));

  // Non-server timestamp is rejected
  await assertFails(setDoc(presenceDoc, {
    ...validPayload,
    updatedAt: new Date(2020, 0, 1),
  }));

  // Out of range coordinates are rejected
  await assertFails(setDoc(presenceDoc, {
    ...validPayload,
    location: { latitude: 95, longitude: -77.04 },
  }));
});


// ── Certificados de garantía verificables (QR) ──
const { Timestamp, collection, getDocs } = require('firebase/firestore');
const CERT = 'ABCDEFGHJKMNPQRS';
const publicDb = () => env.unauthenticatedContext().firestore();
const certRef = (database, id = CERT) => doc(database, `warranty_certificates/${id}`);
const newCert = (overrides = {}) => {
  const from = Date.now();
  return {
    code: CERT, requestId: 'job', serviceLabel: 'Pintura', clientMasked: 'Ros*** Qui***',
    issuedAt: serverTimestamp(), validFrom: Timestamp.fromMillis(from), validUntil: Timestamp.fromMillis(from + 30 * 86400000),
    status: 'ACTIVE', issuedBy: 'operator', ...overrides,
  };
};
const seedCertificate = async () => env.withSecurityRulesDisabled(async (context) => {
  const from = Date.now();
  await setDoc(doc(context.firestore(), `warranty_certificates/${CERT}`), {
    code: CERT, requestId: 'job', serviceLabel: 'Pintura', clientMasked: 'Ros*** Qui***', issuedAt: Timestamp.now(),
    validFrom: Timestamp.fromMillis(from), validUntil: Timestamp.fromMillis(from + 30 * 86400000), status: 'ACTIVE', issuedBy: 'operator',
  });
});
const dayKey = () => { const d = new Date(); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`; };
const scan = (overrides = {}) => ({ certificateId: CERT, at: serverTimestamp(), expireAt: Timestamp.fromMillis(Date.now() + 365 * 86400000), ...overrides });

test('Certificates: anyone can read one by its code but nobody anonymous can list them', async () => {
  await seedCertificate();
  await assertSucceeds(getDoc(certRef(publicDb())));
  await assertFails(getDocs(collection(publicDb(), 'warranty_certificates')));
  await assertSucceeds(getDocs(collection(db('operator'), 'warranty_certificates')));
  await assertFails(getDocs(collection(db('client'), 'warranty_certificates')));
});

test('Certificates: only the central issues, with a valid code, exact 30 days and no extra data', async () => {
  await assertSucceeds(setDoc(certRef(db('operator')), newCert()));
  await assertFails(setDoc(certRef(db('client'), 'BBBBBBBBBBBBBBBB'), newCert({ code: 'BBBBBBBBBBBBBBBB', issuedBy: 'client' })));
  await assertFails(setDoc(certRef(publicDb(), 'CCCCCCCCCCCCCCCC'), newCert({ code: 'CCCCCCCCCCCCCCCC' })));
  await assertFails(setDoc(certRef(db('operator'), 'abc'), newCert({ code: 'abc' })));
  await assertFails(setDoc(certRef(db('operator'), 'DDDDDDDDDDDDDDDD'), newCert({ code: 'DDDDDDDDDDDDDDDD', clientPhone: '999' })));
  await assertFails(setDoc(certRef(db('operator'), 'EEEEEEEEEEEEEEEE'), newCert({ code: 'EEEEEEEEEEEEEEEE', validUntil: Timestamp.fromMillis(Date.now() + 90 * 86400000) })));
  await assertFails(setDoc(certRef(db('operator'), 'FFFFFFFFFFFFFFFF'), newCert({ code: 'FFFFFFFFFFFFFFFF', status: 'REVOKED' })));
});

test('Certificates: the only edit is a one-way revocation by the central; reason stays private', async () => {
  await seedCertificate();
  await assertFails(updateDoc(certRef(db('client')), { status: 'REVOKED', revokedAt: serverTimestamp(), revokedBy: 'client' }));
  await assertFails(updateDoc(certRef(db('operator')), { serviceLabel: 'Otro' }));
  await assertFails(updateDoc(certRef(db('operator')), { validUntil: Timestamp.fromMillis(Date.now() + 999 * 86400000) }));
  const batch = writeBatch(db('operator'));
  batch.update(certRef(db('operator')), { status: 'REVOKED', revokedAt: serverTimestamp(), revokedBy: 'operator' });
  batch.set(doc(db('operator'), `warranty_certificates/${CERT}/admin/revocation`), { reason: 'Servicio reabierto por reclamo', revokedAt: serverTimestamp(), revokedBy: 'operator' });
  await assertSucceeds(batch.commit());
  await assertFails(updateDoc(certRef(db('operator')), { status: 'ACTIVE' }));
  await assertFails(getDoc(doc(publicDb(), `warranty_certificates/${CERT}/admin/revocation`)));
  await assertSucceeds(getDoc(doc(db('operator'), `warranty_certificates/${CERT}/admin/revocation`)));
});

test('Certificates: never deletable, not even by the central', async () => {
  await seedCertificate();
  await assertFails(require('firebase/firestore').deleteDoc(certRef(db('operator'))));
});

test('Scans: anyone may log one scan per certificate per day, only for existing certificates', async () => {
  await seedCertificate();
  const ok = doc(publicDb(), `warranty_scans/${CERT}_${dayKey()}`);
  await assertSucceeds(setDoc(ok, scan()));
  await assertFails(setDoc(ok, scan()), 'a second scan the same day cannot overwrite');
  await assertFails(setDoc(doc(publicDb(), 'warranty_scans/aleatorio'), scan()));
  await assertFails(setDoc(doc(publicDb(), `warranty_scans/ZZZZZZZZZZZZZZZZ_${dayKey()}`), scan({ certificateId: 'ZZZZZZZZZZZZZZZZ' })));
  await assertFails(setDoc(doc(publicDb(), `warranty_scans/${CERT}_20200101`), scan()));
});

test('Scans: schema is strict, retention is 12 months, and only the central can read them', async () => {
  await seedCertificate();
  const ref = doc(publicDb(), `warranty_scans/${CERT}_${dayKey()}`);
  await assertFails(setDoc(ref, scan({ ip: '1.2.3.4' })));
  await assertFails(setDoc(ref, scan({ expireAt: Timestamp.fromMillis(Date.now() + 5 * 365 * 86400000) })));
  await assertFails(setDoc(ref, scan({ expireAt: Timestamp.fromMillis(Date.now() + 86400000) })));
  await assertFails(setDoc(ref, scan({ at: Timestamp.now() })));
  await assertSucceeds(setDoc(ref, scan()));
  await assertFails(getDoc(ref));
  await assertSucceeds(getDoc(doc(db('operator'), `warranty_scans/${CERT}_${dayKey()}`)));
  await assertFails(updateDoc(doc(db('operator'), `warranty_scans/${CERT}_${dayKey()}`), { certificateId: CERT }));
});

test('Scans: the central can purge only records older than 12 months', async () => {
  await seedCertificate();
  await env.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, `warranty_scans/${CERT}_20240101`), { certificateId: CERT, at: Timestamp.fromMillis(Date.now() - 800 * 86400000), expireAt: Timestamp.fromMillis(Date.now() - 435 * 86400000) });
    await setDoc(doc(database, `warranty_scans/${CERT}_20990101`), { certificateId: CERT, at: Timestamp.now(), expireAt: Timestamp.fromMillis(Date.now() + 300 * 86400000) });
  });
  const { deleteDoc } = require('firebase/firestore');
  await assertFails(deleteDoc(doc(publicDb(), `warranty_scans/${CERT}_20240101`)));
  await assertFails(deleteDoc(doc(db('client'), `warranty_scans/${CERT}_20240101`)));
  await assertFails(deleteDoc(doc(db('operator'), `warranty_scans/${CERT}_20990101`)));
  await assertSucceeds(deleteDoc(doc(db('operator'), `warranty_scans/${CERT}_20240101`)));
});

// ── Entrada de solicitudes por WhatsApp (intake_requests) ──
const intakeRef = (database, id = 'gs_abc_2_1700000000000') => doc(database, `intake_requests/${id}`);
const validIntake = (overrides = {}) => ({
  source: 'GOOGLE_FORM', channel: 'WHATSAPP', status: 'NEW', submittedBy: 'intake', createdAt: serverTimestamp(),
  clientName: 'Carlos Mendoza', clientPhone: '+51999888777', specialty: 'Gasfitería', district: 'Miraflores',
  address: 'Av. Larco 450 Dpto 302', description: 'Fuga de agua en tubería de cocina', urgency: 'NOW', sourceRow: 2, ...overrides,
});
const seedIntakeUser = () => env.withSecurityRulesDisabled(async (context) => {
  await setDoc(doc(context.firestore(), 'users/intake'), { role: 'INTAKE', is_verified: true });
});

test('Intake: el usuario INTAKE solo puede crear entradas válidas con estado NEW', async () => {
  await seedIntakeUser();
  await assertSucceeds(setDoc(intakeRef(db('intake')), validIntake()));
  await assertFails(setDoc(intakeRef(db('intake'), 'x1'), validIntake({ status: 'PROCESSED' })));
  await assertFails(setDoc(intakeRef(db('intake'), 'x2'), validIntake({ submittedBy: 'otro' })));
  await assertFails(setDoc(intakeRef(db('intake'), 'x3'), validIntake({ channel: 'APP' })));
  await assertFails(setDoc(intakeRef(db('intake'), 'x4'), validIntake({ isAdmin: true })));
  await assertFails(setDoc(intakeRef(db('intake'), 'x5'), validIntake({ description: 'x'.repeat(2000) })));
  await assertFails(setDoc(intakeRef(db('intake'), 'x6'), validIntake({ createdAt: Timestamp.fromMillis(1) })));
});

test('Intake: nadie más puede crear entradas y nadie sin sesión puede leerlas', async () => {
  await seedIntakeUser();
  await assertFails(setDoc(intakeRef(db('client'), 'y1'), validIntake({ submittedBy: 'client' })));
  await assertFails(setDoc(intakeRef(db('worker'), 'y2'), validIntake({ submittedBy: 'worker' })));
  await assertFails(setDoc(intakeRef(publicDb(), 'y3'), validIntake()));
  await assertSucceeds(setDoc(intakeRef(db('intake')), validIntake()));
  await assertFails(getDoc(intakeRef(db('intake'))));
  await assertFails(getDoc(intakeRef(db('client'))));
  await assertFails(getDoc(intakeRef(publicDb())));
  await assertSucceeds(getDoc(intakeRef(db('operator'))));
});

test('Intake: la central cierra la entrada una sola vez y no puede alterar lo recibido', async () => {
  await seedIntakeUser();
  await assertSucceeds(setDoc(intakeRef(db('intake')), validIntake()));
  await assertFails(updateDoc(intakeRef(db('operator')), { clientName: 'Otro' }));
  await assertFails(updateDoc(intakeRef(db('client')), { status: 'PROCESSED' }));
  await assertFails(updateDoc(intakeRef(db('operator')), { status: 'NEW' }));
  await assertSucceeds(updateDoc(intakeRef(db('operator')), { status: 'PROCESSED', requestId: 'r1', requestCode: 'SOL-POST-0001', processedBy: 'operator', processedAt: serverTimestamp() }));
  await assertFails(updateDoc(intakeRef(db('operator')), { status: 'REJECTED', processedBy: 'operator' }), 'ya cerrada: no se reabre ni se vuelve a cerrar');
  await assertFails(require('firebase/firestore').deleteDoc(intakeRef(db('operator'))));
});
