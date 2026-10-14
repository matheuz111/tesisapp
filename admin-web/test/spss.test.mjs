import { test } from 'node:test';
import assert from 'node:assert/strict';

// Core calculation logic from SpssExporterModal
function calculateSpssMetrics(data, history = []) {
  const toMillis = (val) => {
    if (!val) return null;
    if (val.toMillis) return val.toMillis();
    if (val.seconds) return val.seconds * 1000;
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? null : parsed;
  };

  const formatIso = (millis) => {
    if (!millis) return '';
    const d = new Date(millis);
    return d.toISOString().replace('T', ' ').substring(0, 19);
  };

  const tCrea = toMillis(data.createdAt) || (history[0] ? toMillis(history[0].timestamp) : null);
  let tResp = toMillis(data.firstResponseAt);
  let tAsig = toMillis(data.assignedAt);
  let tInic = toMillis(data.startedAt) || toMillis(data.pinValidatedAt);
  let tFin = toMillis(data.finishedAt);
  let tCier = toMillis(data.validatedAt) || toMillis(data.closedAt);

  const calcMin = (end, start) => {
    if (!end || !start || end < start) return '';
    return Number(((end - start) / 60000).toFixed(2));
  };

  const tRespMin = calcMin(tResp, tCrea);
  const tAsigMin = calcMin(tAsig, tCrea);
  const tVisMin = calcMin(tInic, tCrea);
  const tTotalMin = calcMin(tCier || tFin, tCrea);

  const regCorr = data.description && data.district && data.address && (data.specialty || data.serviceLabel) ? 1 : 0;
  const datosComp = regCorr && (data.clientPhone || data.clientName) ? 1 : 0;
  const trazComp = ['COMPLETED', 'VALIDATED'].includes(data.status) ? 1 : 0;
  const evidIni = data.issuePhoto ? 1 : 0;
  const evidFin = data.evidencePhoto ? 1 : 0;
  const cotAprob = data.quoteAccepted ? 'SI' : data.quoteRejectedAt ? 'NO' : 'NO_APLICA';

  return {
    COD_SOL: data.code || 'SOL-POST-0001',
    CANAL: data.intakeChannel || 'APP',
    ORIGEN: data.origin || 'CLIENT',
    DISTRITO: (data.district || 'LIMA').toUpperCase(),
    SERVICIO: (data.serviceLabel || data.specialty || 'GENERAL').toUpperCase(),
    PRIORIDAD: data.priority === 'HIGH' ? 'URGENTE' : 'NORMAL',
    COT_APROB: cotAprob,
    REG_CORR: regCorr,
    DATOS_COMP: datosComp,
    FECHA_CREA: formatIso(tCrea),
    FECHA_RESP: formatIso(tResp),
    FECHA_ASIG: formatIso(tAsig),
    FECHA_INIC: formatIso(tInic),
    FECHA_FIN: formatIso(tFin),
    FECHA_CIER: formatIso(tCier),
    T_RESP_MIN: tRespMin,
    T_ASIG_MIN: tAsigMin,
    T_VIS_MIN: tVisMin,
    T_TOTAL_MIN: tTotalMin,
    CAMBIOS_EST: Math.max(1, history.length || 3),
    TRAZ_COMP: trazComp,
    EVID_INI: evidIni,
    EVID_FIN: evidFin,
  };
}

test('SPSS: Computes response, assignment, arrival, and total minutes accurately', () => {
  const baseTime = new Date('2026-05-10T10:00:00Z').getTime();
  const sample = {
    code: 'SOL-POST-0010',
    status: 'COMPLETED',
    createdAt: baseTime,
    firstResponseAt: baseTime + 5 * 60 * 1000, // 5 min
    assignedAt: baseTime + 12 * 60 * 1000,    // 12 min
    startedAt: baseTime + 45 * 60 * 1000,     // 45 min
    finishedAt: baseTime + 95 * 60 * 1000,    // 95 min
    description: 'Fuga en cocina',
    district: 'Los Olivos',
    address: 'Av. Antúnez de Mayolo 1234',
    specialty: 'Gasfitería',
    clientName: 'Juan Pérez',
    clientPhone: '987654321',
    issuePhoto: 'https://storage/photo1.jpg',
    evidencePhoto: 'https://storage/photo2.jpg',
  };

  const row = calculateSpssMetrics(sample);
  assert.equal(row.COD_SOL, 'SOL-POST-0010');
  assert.equal(row.T_RESP_MIN, 5.0);
  assert.equal(row.T_ASIG_MIN, 12.0);
  assert.equal(row.T_VIS_MIN, 45.0);
  assert.equal(row.T_TOTAL_MIN, 95.0);
  assert.equal(row.REG_CORR, 1);
  assert.equal(row.DATOS_COMP, 1);
  assert.equal(row.TRAZ_COMP, 1);
  assert.equal(row.EVID_INI, 1);
  assert.equal(row.EVID_FIN, 1);
});

test('SPSS: Missing optional timestamps return empty string rather than NaN', () => {
  const sample = {
    code: 'SOL-POST-0011',
    status: 'PENDING_ASSIGNMENT',
    createdAt: new Date('2026-05-10T10:00:00Z').getTime(),
  };
  const row = calculateSpssMetrics(sample);
  assert.equal(row.T_RESP_MIN, '');
  assert.equal(row.T_ASIG_MIN, '');
  assert.equal(row.T_VIS_MIN, '');
  assert.equal(row.T_TOTAL_MIN, '');
  assert.equal(row.TRAZ_COMP, 0);
});
