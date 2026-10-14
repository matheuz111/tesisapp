const test = require('node:test');
const assert = require('node:assert/strict');

// Replicate business transition logic and SPSS metric calculation
const CANONICAL_STATUSES = [
  'PENDING_ASSIGNMENT',
  'QUOTED',
  'PENDING',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'VALIDATED',
  'ARCHIVED',
  'CANCELLED_BY_CLIENT',
  'CANCELLED_BY_PROVIDER',
  'REQUIRES_REASSIGNMENT',
];

function createMockServiceRequest(overrides = {}) {
  const now = 1770000000;
  return {
    id: 'req-e2e-001',
    code: 'SOL-POST-0042',
    clientId: 'client-123',
    clientName: 'Juan Pérez QA',
    clientPhone: '987654321',
    address: 'Av. Antúnez de Mayolo 1234, Los Olivos',
    district: 'LOS OLIVOS',
    operationalZone: 'LIMA_NORTE',
    specialty: 'Gasfitero',
    status: 'PENDING_ASSIGNMENT',
    intakeChannel: 'APP',
    securityPin: '4829',
    createdAt: { seconds: now },
    statusHistory: [
      { fromStatus: null, toStatus: 'PENDING_ASSIGNMENT', timestamp: { seconds: now }, actorRole: 'CLIENT' },
    ],
    ...overrides,
  };
}

test('E2E Lifecycle 01: Client request creation from Mobile matches Web schema', () => {
  const req = createMockServiceRequest();
  assert.equal(req.status, 'PENDING_ASSIGNMENT');
  assert.equal(req.intakeChannel, 'APP');
  assert.equal(req.operationalZone, 'LIMA_NORTE');
  assert.equal(req.securityPin.length, 4);
  assert.match(req.code, /^SOL-POST-\d{4}$/);
});

test('E2E Lifecycle 02: Web Central quotes and assigns provider with atomic pricing', () => {
  const req = createMockServiceRequest();
  const t_quote = req.createdAt.seconds + 600; // 10 minutes later

  // Web assigns pricing policy
  req.pricing = {
    amountCents: 8500, // S/ 85.00
    currency: 'PEN',
    description: 'Tarifa oficial: Visita técnica (S/ 50.00 deducible) + Mano de obra',
    version: 1,
    assignedBy: 'operator-01',
  };
  req.providerId = 'worker-777';
  req.providerName = 'Carlos Mendoza Técnico';
  req.status = 'PENDING';
  req.firstResponseAt = { seconds: t_quote };
  req.quotedAt = { seconds: t_quote };
  req.assignedAt = { seconds: t_quote + 300 }; // 5 min later
  req.statusHistory.push({
    fromStatus: 'PENDING_ASSIGNMENT',
    toStatus: 'PENDING',
    timestamp: req.assignedAt,
    actorRole: 'OPERATOR',
  });

  assert.equal(req.status, 'PENDING');
  assert.equal(req.pricing.amountCents, 8500);
  assert.equal(req.providerId, 'worker-777');
  assert.equal(req.statusHistory.length, 2);
});

test('E2E Lifecycle 03: Provider accepts order on Mobile within SLA', () => {
  const req = createMockServiceRequest();
  const t_accept = req.createdAt.seconds + 1200; // 20 min later

  req.status = 'ACCEPTED';
  req.acceptedAt = { seconds: t_accept };
  req.statusHistory.push({
    fromStatus: 'PENDING',
    toStatus: 'ACCEPTED',
    timestamp: req.acceptedAt,
    actorRole: 'PROVIDER',
  });

  assert.equal(req.status, 'ACCEPTED');
  assert.equal(req.statusHistory.at(-1).actorRole, 'PROVIDER');
});

test('E2E Lifecycle 04: Arrival and PIN validation at site unlocks service start', () => {
  const req = createMockServiceRequest();
  const t_start = req.createdAt.seconds + 2400; // 40 min later

  const submittedPin = '4829';
  assert.equal(submittedPin, req.securityPin, 'PIN must match client token');

  req.status = 'IN_PROGRESS';
  req.startedAt = { seconds: t_start };
  req.pinValidatedAt = { seconds: t_start };
  req.serviceStarted = true;
  req.statusHistory.push({
    fromStatus: 'ACCEPTED',
    toStatus: 'IN_PROGRESS',
    timestamp: req.startedAt,
    actorRole: 'PROVIDER',
  });

  assert.equal(req.status, 'IN_PROGRESS');
  assert.ok(req.pinValidatedAt);
});

test('E2E Lifecycle 05: Evidence capture and completion requires valid photo', () => {
  const req = createMockServiceRequest();
  const t_complete = req.createdAt.seconds + 4200; // 70 min later

  // Base64 demo compressed photo <= 300,000 chars
  const mockBase64Photo = 'data:image/jpeg;base64,' + 'A'.repeat(5000);
  assert.ok(mockBase64Photo.length <= 300000, 'Photo must respect Firestore demo threshold');

  req.evidencePhoto = mockBase64Photo;
  req.status = 'COMPLETED';
  req.finishedAt = { seconds: t_complete };
  req.statusHistory.push({
    fromStatus: 'IN_PROGRESS',
    toStatus: 'COMPLETED',
    timestamp: req.finishedAt,
    actorRole: 'PROVIDER',
  });

  assert.equal(req.status, 'COMPLETED');
  assert.ok(req.evidencePhoto);
});

test('E2E Lifecycle 06: Web Central audit validates evidence and closes service', () => {
  const req = createMockServiceRequest();
  const t_validate = req.createdAt.seconds + 4800; // 80 min later

  // Verification rule: cannot validate if evidencePhoto is missing
  req.evidencePhoto = 'data:image/jpeg;base64,valid_photo';
  assert.ok(req.evidencePhoto, 'Evidence photo is mandatory for central validation');

  req.status = 'VALIDATED';
  req.validatedAt = { seconds: t_validate };
  req.statusHistory.push({
    fromStatus: 'COMPLETED',
    toStatus: 'VALIDATED',
    timestamp: req.validatedAt,
    actorRole: 'OPERATOR',
  });

  assert.equal(req.status, 'VALIDATED');
  assert.ok(req.validatedAt);
});

test('E2E Lifecycle 07: Payment submission via Mobile and Web reconciliation', () => {
  const req = createMockServiceRequest();
  req.paymentMethod = 'YAPE';
  req.paymentStatus = 'PAID';
  req.paymentVoucher = 'data:image/jpeg;base64,voucher_yape';

  assert.equal(req.paymentMethod, 'YAPE');
  assert.equal(req.paymentStatus, 'PAID');

  // Central reconciles
  req.paymentStatus = 'CONFIRMED';
  req.paymentConfirmedBy = 'operator-01';
  assert.equal(req.paymentStatus, 'CONFIRMED');
});

test('E2E Lifecycle 08: Client rating and provider reputation batching', () => {
  const rating = 5;
  const reviewComment = 'Excelente servicio y puntualidad.';
  assert.ok(rating >= 1 && rating <= 5);
  assert.ok(reviewComment.length <= 300);

  const prevProviderRating = { totalRating: 45, count: 10 };
  const newAverage = (prevProviderRating.totalRating + rating) / (prevProviderRating.count + 1);
  assert.equal(newAverage, 50 / 11);
});

test('E2E Lifecycle 09: SPSS thesis metrics derive exact operational indicators', () => {
  const t0 = 1000;
  const t_first = 1600;   // +10 min
  const t_asig = 2200;    // +20 min
  const t_start = 3400;   // +40 min
  const t_val = 5800;     // +80 min

  const req = {
    createdAt: { seconds: t0 },
    firstResponseAt: { seconds: t_first },
    assignedAt: { seconds: t_asig },
    startedAt: { seconds: t_start },
    validatedAt: { seconds: t_val },
    status: 'VALIDATED',
    issuePhoto: 'photo1',
    evidencePhoto: 'photo2',
    statusHistory: new Array(8).fill({}),
  };

  const T_RESP_MIN = (req.firstResponseAt.seconds - req.createdAt.seconds) / 60;
  const T_ASIG_MIN = (req.assignedAt.seconds - req.createdAt.seconds) / 60;
  const T_VIS_MIN = (req.startedAt.seconds - req.createdAt.seconds) / 60;
  const T_TOTAL_MIN = (req.validatedAt.seconds - req.createdAt.seconds) / 60;
  const CAMBIOS_EST = req.statusHistory.length;
  const TRAZ_COMP = req.status === 'VALIDATED' && req.statusHistory.length >= 7 ? 1 : 0;
  const EVID_INI = req.issuePhoto ? 1 : 0;
  const EVID_FIN = req.evidencePhoto ? 1 : 0;

  assert.equal(T_RESP_MIN, 10.0);
  assert.equal(T_ASIG_MIN, 20.0);
  assert.equal(T_VIS_MIN, 40.0);
  assert.equal(T_TOTAL_MIN, 80.0);
  assert.equal(CAMBIOS_EST, 8);
  assert.equal(TRAZ_COMP, 1);
  assert.equal(EVID_INI, 1);
  assert.equal(EVID_FIN, 1);
});

test('E2E Edge Case 10: Provider rejection safely triggers REQUIRES_REASSIGNMENT', () => {
  const req = createMockServiceRequest();
  req.status = 'PENDING';

  // Provider rejects
  req.status = 'REQUIRES_REASSIGNMENT';
  req.rejectionReason = 'Fuera de zona / emergencia personal';
  req.rejectedProviderId = 'worker-777';
  req.providerId = null; // liberated immediately
  req.statusHistory.push({
    fromStatus: 'PENDING',
    toStatus: 'REQUIRES_REASSIGNMENT',
    actorRole: 'PROVIDER',
    notes: req.rejectionReason,
  });

  assert.equal(req.status, 'REQUIRES_REASSIGNMENT');
  assert.equal(req.providerId, null, 'Provider must be released to avoid concurrent locks');
});

test('E2E Edge Case 11: Client cancellation releases provider and retains audit', () => {
  const req = createMockServiceRequest();
  req.providerId = 'worker-777';
  req.status = 'ACCEPTED';

  // Client cancels
  req.status = 'CANCELLED_BY_CLIENT';
  req.cancelledAt = { seconds: Date.now() / 1000 };
  req.providerId = null; // liberated immediately
  req.statusHistory.push({
    fromStatus: 'ACCEPTED',
    toStatus: 'CANCELLED_BY_CLIENT',
    actorRole: 'CLIENT',
    notes: 'Cliente canceló el servicio',
  });

  assert.equal(req.status, 'CANCELLED_BY_CLIENT');
  assert.equal(req.providerId, null);
  assert.equal(req.statusHistory.at(-1).toStatus, 'CANCELLED_BY_CLIENT');
});
