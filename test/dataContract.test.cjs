const test = require('node:test');
const assert = require('node:assert');

test('SOL-POST correlative formatting logic produces exactly 4 zero-padded digits', () => {
  const formatCode = (val, prefix = 'SOL-POST') => `${prefix}-${String(val).padStart(4, '0')}`;
  
  assert.strictEqual(formatCode(1), 'SOL-POST-0001');
  assert.strictEqual(formatCode(42), 'SOL-POST-0042');
  assert.strictEqual(formatCode(105), 'SOL-POST-0105');
  assert.strictEqual(formatCode(1234), 'SOL-POST-1234');
});

test('Data Contract: SPSS variables mapping logic', () => {
  const mockRequest = {
    code: 'SOL-POST-0001',
    intakeChannel: 'APP',
    origin: 'CLIENT',
    district: 'Miraflores',
    specialty: 'Gasfitero',
    priority: 'NORMAL',
    technicalVisitFee: 50.00,
    pricing: { price: 120.00, amountCents: 12000 },
    quoteAccepted: true,
    datosCompletos: true,
    issuePhoto: 'https://storage/issue.jpg',
    evidencePhoto: 'https://storage/evidence.jpg',
    createdAt: { seconds: 1000 },
    firstResponseAt: { seconds: 1600 },
    assignedAt: { seconds: 2200 },
    startedAt: { seconds: 3400 },
    finishedAt: { seconds: 5200 },
    validatedAt: { seconds: 5800 },
    status: 'VALIDATED',
  };

  const mockHistory = [
    { fromStatus: null, toStatus: 'PENDING_ASSIGNMENT' },
    { fromStatus: 'PENDING_ASSIGNMENT', toStatus: 'QUOTED' },
    { fromStatus: 'QUOTED', toStatus: 'PENDING_ASSIGNMENT' },
    { fromStatus: 'PENDING_ASSIGNMENT', toStatus: 'PENDING' },
    { fromStatus: 'PENDING', toStatus: 'ACCEPTED' },
    { fromStatus: 'ACCEPTED', toStatus: 'IN_PROGRESS' },
    { fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED' },
    { fromStatus: 'COMPLETED', toStatus: 'VALIDATED' },
  ];

  // Cálculos SPSS según el plan acordado entre Persona 1 y Persona 2
  const T_RESP_MIN = (mockRequest.firstResponseAt.seconds - mockRequest.createdAt.seconds) / 60;
  const T_ASIG_MIN = (mockRequest.assignedAt.seconds - mockRequest.createdAt.seconds) / 60;
  const T_VIS_MIN = (mockRequest.startedAt.seconds - mockRequest.createdAt.seconds) / 60;
  const T_TOTAL_MIN = (mockRequest.validatedAt.seconds - mockRequest.createdAt.seconds) / 60;
  const CAMBIOS_EST = mockHistory.length;
  const TRAZ_COMP = mockRequest.status === 'VALIDATED' && mockHistory.length >= 7 ? 1 : 0;
  const EVID_INI = mockRequest.issuePhoto ? 1 : 0;
  const EVID_FIN = mockRequest.evidencePhoto ? 1 : 0;

  assert.strictEqual(T_RESP_MIN, 10);
  assert.strictEqual(T_ASIG_MIN, 20);
  assert.strictEqual(T_VIS_MIN, 40);
  assert.strictEqual(T_TOTAL_MIN, 80);
  assert.strictEqual(CAMBIOS_EST, 8);
  assert.strictEqual(TRAZ_COMP, 1);
  assert.strictEqual(EVID_INI, 1);
  assert.strictEqual(EVID_FIN, 1);
});
